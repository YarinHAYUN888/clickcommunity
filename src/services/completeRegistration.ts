import { FunctionsHttpError } from '@supabase/functions-js';
import { supabase } from '@/integrations/supabase/client';
import { logAuthCompletionStep } from '@/lib/onboarding/authCompletionDebug';

/**
 * Payload expected by Edge Function `complete-registration` (see supabase/functions/complete-registration).
 * Requires server-verified OTP (`verification_token` from verify-onboarding-otp).
 */
/** Onboarding fields synced to profiles (Edge admin upsert + client photo merge). */
export interface CompleteRegistrationProfilePayload {
  phone?: string;
  dateOfBirth?: { day: number; month: number; year: number } | null;
  gender?: string;
  region?: string;
  regionOther?: string;
  occupation?: string;
  /** Same values as profiles.life_niche check constraint */
  lifeNiche?: string;
  bio?: string;
  instagram?: string;
  tiktok?: string;
  interests?: string[];
}

export interface CompleteRegistrationBody {
  email: string;
  password: string;
  verification_token: string;
  firstName?: string;
  lastName?: string;
  referralCode?: string;
  /** Written to public.profiles by Edge (service role) for brand-new auth users only. */
  profile?: CompleteRegistrationProfilePayload;
}

type EdgePayload = {
  tokenHash?: string;
  error?: string;
  success?: boolean;
  code?: 'created' | 'already_exists';
  userId?: string | null;
  diagnostics?: { stage?: string };
};

export type RegistrationInvokeSuccess = {
  ok: true;
  tokenHash: string;
  code: 'created' | 'already_exists';
  userId: string | null;
};

export type RegistrationInvokeFailure = {
  ok: false;
  recoverable: boolean;
  reason: 'transport' | 'missing_token' | 'server_error';
  detail?: string;
};

export type RegistrationInvokeResult = RegistrationInvokeSuccess | RegistrationInvokeFailure;

async function parseEdgeBody(
  data: unknown,
  error: unknown,
): Promise<{ body: EdgePayload | null; httpStatus: number | null }> {
  if (data && typeof data === 'object') {
    return { body: data as EdgePayload, httpStatus: null };
  }

  if (error instanceof FunctionsHttpError) {
    const res = error.context as Response;
    const httpStatus = res.status;
    try {
      const body = (await res.json()) as EdgePayload;
      return { body, httpStatus };
    } catch {
      return { body: null, httpStatus };
    }
  }

  return { body: null, httpStatus: null };
}

function isTransportFailure(error: unknown, httpStatus: number | null): boolean {
  if (httpStatus !== null && httpStatus >= 500) return true;
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    if (error.name === 'AbortError' || msg.includes('fetch') || msg.includes('network')) {
      return true;
    }
  }
  return false;
}

async function invokeOnce(
  payload: CompleteRegistrationBody,
): Promise<{ body: EdgePayload | null; error: unknown; httpStatus: number | null }> {
  const { data, error } = await supabase.functions.invoke('complete-registration', { body: payload });
  const parsed = await parseEdgeBody(data, error);
  return { body: parsed.body, error, httpStatus: parsed.httpStatus };
}

/**
 * Calls Edge Function `complete-registration` with mobile-safe parsing and retry.
 * Does not throw — use recoverable flag for session fallback.
 */
export async function invokeCompleteRegistration(
  payload: CompleteRegistrationBody,
): Promise<RegistrationInvokeResult> {
  logAuthCompletionStep(1, { phase: 'invoke_start', email: payload.email });

  let lastError: unknown;
  let lastBody: EdgePayload | null = null;
  let lastStatus: number | null = null;

  for (let attempt = 0; attempt < 2; attempt++) {
    const { body, error, httpStatus } = await invokeOnce(payload);
    lastError = error;
    lastBody = body;
    lastStatus = httpStatus;

    if (!error && body?.tokenHash && !body.error) {
      logAuthCompletionStep(1, {
        phase: 'invoke_ok',
        code: body.code,
        userId: body.userId,
        attempt,
      });
      return {
        ok: true,
        tokenHash: body.tokenHash,
        code: body.code ?? 'created',
        userId: body.userId ?? null,
      };
    }

    if (!isTransportFailure(error, httpStatus) || attempt === 1) break;
    logAuthCompletionStep(1, { phase: 'invoke_retry', attempt });
    await new Promise((r) => setTimeout(r, 400));
  }

  if (lastBody?.tokenHash && !lastBody.error) {
    return {
      ok: true,
      tokenHash: lastBody.tokenHash,
      code: lastBody.code ?? 'created',
      userId: lastBody.userId ?? null,
    };
  }

  if (lastBody?.error) {
    console.error('[complete-registration] error in JSON body:', lastBody.error, lastBody);
    const recoverable =
      lastBody.code === 'already_exists' ||
      lastStatus === 500 ||
      lastBody.diagnostics?.stage === 'profile_upsert';
    return {
      ok: false,
      recoverable,
      reason: 'server_error',
      detail: lastBody.error,
    };
  }

  if (!lastBody?.tokenHash) {
    console.error('[complete-registration] missing tokenHash', JSON.stringify(lastBody));
    return {
      ok: false,
      recoverable: isTransportFailure(lastError, lastStatus),
      reason: 'missing_token',
    };
  }

  console.error('[complete-registration] invoke failed', lastError);
  return {
    ok: false,
    recoverable: isTransportFailure(lastError, lastStatus),
    reason: 'transport',
    detail: lastError instanceof Error ? lastError.message : undefined,
  };
}
