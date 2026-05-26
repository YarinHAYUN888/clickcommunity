/**
 * Onboarding OTP — issued and verified server-side via Edge Functions.
 * Codes are never stored in the browser; delivery goes through n8n from the Edge only.
 */

import { FunctionsHttpError } from '@supabase/functions-js';
import { supabase } from '@/integrations/supabase/client';
import { logEmailOtpStep } from '@/lib/onboarding/emailOtpDebug';
import { logOnboardingStep } from '@/lib/onboarding/onboardingFlowDebug';

export type VerificationChannel = 'email' | 'phone';

/** API channel sent to Edge (Contract A). SMS uses "sms"; internal DB may use "phone". */
export type OtpApiChannel = 'email' | 'sms';

/** @deprecated Legacy webhook result type for classifyOtpWebhookFailure */
export type SyncOtpWebhookResult = {
  ok: boolean;
  status?: number;
  error?: string;
};

export type OtpDeliveryStatus = 'sent' | 'pending' | 'uncertain' | 'skipped_no_webhook' | string;

export interface OnboardingOtpPayloadSource {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  gender?: string;
  dateOfBirth?: unknown;
  region?: string;
  regionOther?: string;
  occupation?: string;
  bio?: string;
  instagram?: string;
  tiktok?: string;
  interests?: unknown;
}

export interface IssueOtpResult {
  ok: boolean;
  challengeId?: string;
  expiresAt?: string;
  error?: string;
  errorCode?: string;
  deliveryStatus?: OtpDeliveryStatus;
  deliveryUncertain?: boolean;
}

export interface VerifyOtpResult {
  ok: boolean;
  verificationToken?: string;
  error?: string;
}

type IssueOtpEdgeBody = {
  ok?: boolean;
  challenge_id?: string;
  expires_at?: string;
  channel?: string;
  error?: string;
  error_code?: string;
  delivery_status?: OtpDeliveryStatus;
  delivery_channel?: string;
  message?: string;
  retry_after_sec?: number;
};

function phoneE164(phone: string): string {
  const cleaned = phone.replace(/[-\s]/g, '').replace(/^0/, '');
  return cleaned ? `+972${cleaned}` : '';
}

export function toOtpApiChannel(method: VerificationChannel): OtpApiChannel {
  return method === 'email' ? 'email' : 'sms';
}

const PROFILE_FIELDS_FOR_N8N = (data: OnboardingOtpPayloadSource) => ({
  firstName: data.firstName,
  lastName: data.lastName,
  gender: data.gender,
  dateOfBirth: data.dateOfBirth,
  region: data.region,
  regionOther: data.regionOther,
  occupation: data.occupation,
  bio: data.bio,
  instagram: data.instagram,
  tiktok: data.tiktok,
  interests: data.interests,
});

/** Contract A: Frontend → Edge invoke body */
export function buildIssueOtpInvokeBody(
  data: OnboardingOtpPayloadSource,
  verificationMethod: VerificationChannel,
  registrationSessionId?: string,
): Record<string, unknown> {
  const channel = toOtpApiChannel(verificationMethod);
  const profile = PROFILE_FIELDS_FOR_N8N(data);

  if (channel === 'email') {
    return {
      channel: 'email',
      email: (data.email ?? '').trim().toLowerCase(),
      registration_session_id: registrationSessionId,
      ...profile,
    };
  }

  const phoneClean = (data.phone ?? '').replace(/[-\s]/g, '').replace(/^0/, '');
  return {
    channel: 'sms',
    phone: phoneClean ? phoneE164(data.phone ?? '') : undefined,
    registration_session_id: registrationSessionId,
    ...profile,
  };
}

export function buildVerifyOtpInvokeBody(
  data: OnboardingOtpPayloadSource,
  verificationMethod: VerificationChannel,
  challengeId: string,
  code: string,
  registrationSessionId?: string,
): Record<string, unknown> {
  const channel = toOtpApiChannel(verificationMethod);
  const base = {
    channel,
    challenge_id: challengeId,
    code,
    registration_session_id: registrationSessionId,
  };

  if (channel === 'email') {
    return { ...base, email: (data.email ?? '').trim().toLowerCase() };
  }

  const phoneClean = (data.phone ?? '').replace(/[-\s]/g, '').replace(/^0/, '');
  return {
    ...base,
    phone: phoneClean ? phoneE164(data.phone ?? '') : undefined,
  };
}

function logIssueOtpPayloadDev(invokeBody: Record<string, unknown>): void {
  if (!import.meta.env.DEV && import.meta.env.VITE_ONBOARDING_DEBUG !== 'true') return;
  console.info('ISSUE OTP PAYLOAD', {
    channel: invokeBody.channel,
    hasEmail: typeof invokeBody.email === 'string' && invokeBody.email.length > 0,
    hasPhone: typeof invokeBody.phone === 'string' && invokeBody.phone.length > 0,
    registration_session_id: invokeBody.registration_session_id,
  });
}

async function parseIssueOtpEdgeBody(
  data: unknown,
  error: unknown,
): Promise<{ body: IssueOtpEdgeBody | null; httpStatus: number | null }> {
  if (data && typeof data === 'object') {
    return { body: data as IssueOtpEdgeBody, httpStatus: null };
  }

  if (error instanceof FunctionsHttpError) {
    const res = error.context as Response;
    const httpStatus = res.status;
    try {
      const body = (await res.json()) as IssueOtpEdgeBody;
      return { body, httpStatus };
    } catch {
      return { body: null, httpStatus };
    }
  }

  return { body: null, httpStatus: null };
}

function isNetworkFailure(error: unknown, httpStatus: number | null): boolean {
  if (httpStatus === 0) return true;
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    if (error.name === 'AbortError' || msg.includes('fetch') || msg.includes('network')) {
      return true;
    }
  }
  return false;
}

/** Maps Edge issue-otp response to a stable error_code for UI (exported for tests). */
export function resolveIssueOtpErrorCode(
  body: IssueOtpEdgeBody | null,
  error: unknown,
  httpStatus: number | null,
): string {
  if (body?.error_code) return body.error_code;
  if (body?.error && typeof body.error === 'string') return body.error;
  if (isNetworkFailure(error, httpStatus)) return 'network_error';
  if (httpStatus !== null && httpStatus >= 500) return 'unexpected_error';
  return 'issue_failed';
}

export async function issueOnboardingOtp(
  data: OnboardingOtpPayloadSource,
  verificationMethod: VerificationChannel,
  registrationSessionId?: string,
): Promise<IssueOtpResult> {
  const invokeBody = buildIssueOtpInvokeBody(data, verificationMethod, registrationSessionId);
  const channel = invokeBody.channel as OtpApiChannel;

  if (channel === 'email') {
    const email = typeof invokeBody.email === 'string' ? invokeBody.email : '';
    if (!email) {
      return { ok: false, error: 'email_required', errorCode: 'email_required' };
    }
  }

  if (channel === 'sms') {
    const phone = typeof invokeBody.phone === 'string' ? invokeBody.phone : '';
    if (!phone) {
      return { ok: false, error: 'phone_required', errorCode: 'phone_required' };
    }
  }

  logIssueOtpPayloadDev(invokeBody);

  if (verificationMethod === 'email') {
    logEmailOtpStep(2, { email: invokeBody.email, hasSession: !!registrationSessionId });
    logEmailOtpStep(3, { function: 'issue-onboarding-otp' });
  }

  logOnboardingStep(2, { phase: 'issue_otp_start', method: verificationMethod });

  const { data: res, error } = await supabase.functions.invoke('issue-onboarding-otp', {
    body: invokeBody,
  });

  const { body, httpStatus } = await parseIssueOtpEdgeBody(res, error);

  if (verificationMethod === 'email') {
    logEmailOtpStep(4, {
      ok: body?.ok,
      challengeId: body?.challenge_id,
      errorCode: body?.error_code ?? body?.error,
      httpStatus,
      hasInvokeError: !!error,
    });
  }

  if (body?.ok === true && body.challenge_id) {
    const deliveryStatus = body.delivery_status;
    const deliveryUncertain =
      deliveryStatus === 'pending' ||
      deliveryStatus === 'uncertain' ||
      deliveryStatus === 'skipped_no_webhook';

    if (verificationMethod === 'email') {
      logEmailOtpStep(5, { deliveryStatus, deliveryUncertain });
    }

    logOnboardingStep(2, { phase: 'issue_otp_ok', challengeId: body.challenge_id, deliveryStatus });
    return {
      ok: true,
      challengeId: body.challenge_id,
      expiresAt: body.expires_at,
      deliveryStatus,
      deliveryUncertain,
    };
  }

  const errorCode = resolveIssueOtpErrorCode(body, error, httpStatus);

  if (import.meta.env.DEV) {
    console.error('[issue-onboarding-otp]', { errorCode, httpStatus, error });
  }

  return { ok: false, error: errorCode, errorCode };
}

export async function verifyOnboardingOtp(
  data: OnboardingOtpPayloadSource,
  verificationMethod: VerificationChannel,
  challengeId: string,
  code: string,
  registrationSessionId?: string,
): Promise<VerifyOtpResult> {
  const { data: res, error } = await supabase.functions.invoke('verify-onboarding-otp', {
    body: buildVerifyOtpInvokeBody(data, verificationMethod, challengeId, code, registrationSessionId),
  });

  if (res && typeof res === 'object') {
    const body = res as { ok?: boolean; verification_token?: string; error?: string; error_code?: string };
    if (body?.ok && body.verification_token) {
      return { ok: true, verificationToken: body.verification_token };
    }
    const err = body?.error_code ?? body?.error;
    if (err) return { ok: false, error: err };
  }

  if (error instanceof FunctionsHttpError) {
    try {
      const res = error.context as Response;
      const body = (await res.json()) as { error?: string; error_code?: string };
      const err = body?.error_code ?? body?.error;
      if (err) return { ok: false, error: err };
    } catch {
      /* ignore */
    }
  }

  if (error) {
    if (import.meta.env.DEV) console.error('[verify-onboarding-otp]', error);
    return { ok: false, error: 'verify_failed' };
  }

  return { ok: false, error: 'otp_invalid' };
}

/** @deprecated Client-side OTP generation removed — use issueOnboardingOtp */
export function generateNumericOtp(): string {
  const buf = new Uint32Array(2);
  crypto.getRandomValues(buf);
  const combined = Number(buf[0]) * 0x100000000 + Number(buf[1]);
  return String((combined % 900_000) + 100_000);
}

export function extractSixDigitCode(text: string): string | null {
  const digits = text.replace(/\D/g, '');
  return digits.length >= 6 ? digits.slice(0, 6) : null;
}
