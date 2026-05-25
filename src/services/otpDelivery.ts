/**
 * Onboarding OTP — issued and verified server-side via Edge Functions.
 * Codes are never stored in the browser; delivery goes through n8n from the Edge only.
 */

import { supabase } from '@/integrations/supabase/client';
import { logOnboardingStep } from '@/lib/onboarding/onboardingFlowDebug';

export type VerificationChannel = 'email' | 'phone';

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
}

export interface VerifyOtpResult {
  ok: boolean;
  verificationToken?: string;
  error?: string;
}

function phoneE164(phone: string): string {
  const cleaned = phone.replace(/[-\s]/g, '').replace(/^0/, '');
  return cleaned ? `+972${cleaned}` : '';
}

export async function issueOnboardingOtp(
  data: OnboardingOtpPayloadSource,
  verificationMethod: VerificationChannel,
): Promise<IssueOtpResult> {
  const phoneClean = (data.phone ?? '').replace(/[-\s]/g, '').replace(/^0/, '');
  logOnboardingStep(2, { phase: 'issue_otp_start', method: verificationMethod });

  const { data: res, error } = await supabase.functions.invoke('issue-onboarding-otp', {
    body: {
      email: data.email,
      phone: phoneClean ? phoneE164(data.phone ?? '') : undefined,
      verificationMethod,
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
    },
  });

  if (error) {
    if (import.meta.env.DEV) console.error('[issue-onboarding-otp]', error);
    return { ok: false, error: 'issue_failed' };
  }

  const body = res as { ok?: boolean; challenge_id?: string; expires_at?: string; error?: string };
  if (!body?.ok || !body.challenge_id) {
    return { ok: false, error: body?.error ?? 'issue_failed' };
  }

  logOnboardingStep(2, { phase: 'issue_otp_ok', challengeId: body.challenge_id });
  return {
    ok: true,
    challengeId: body.challenge_id,
    expiresAt: body.expires_at,
  };
}

export async function verifyOnboardingOtp(
  data: OnboardingOtpPayloadSource,
  verificationMethod: VerificationChannel,
  challengeId: string,
  code: string,
): Promise<VerifyOtpResult> {
  const phoneClean = (data.phone ?? '').replace(/[-\s]/g, '').replace(/^0/, '');
  const { data: res, error } = await supabase.functions.invoke('verify-onboarding-otp', {
    body: {
      challenge_id: challengeId,
      code,
      email: data.email,
      phone: phoneClean ? phoneE164(data.phone ?? '') : undefined,
      verificationMethod,
    },
  });

  if (error) {
    if (import.meta.env.DEV) console.error('[verify-onboarding-otp]', error);
    return { ok: false, error: 'verify_failed' };
  }

  const body = res as {
    ok?: boolean;
    verification_token?: string;
    error?: string;
  };

  if (!body?.ok || !body.verification_token) {
    return { ok: false, error: body?.error ?? 'otp_invalid' };
  }

  return { ok: true, verificationToken: body.verification_token };
}

/** @deprecated Client-side OTP generation removed — use issueOnboardingOtp */
export function generateNumericOtp(): string {
  const buf = new Uint32Array(2);
  crypto.getRandomValues(buf);
  const combined = Number(buf[0]) * 0x100000000 + Number(buf[1]);
  return String((combined % 900_000) + 100_000);
}

/** מחלץ 6 ספרות רצופות מהטקסט (למשל מהלוח) */
export function extractSixDigitCode(text: string): string | null {
  const digits = text.replace(/\D/g, '');
  return digits.length >= 6 ? digits.slice(0, 6) : null;
}
