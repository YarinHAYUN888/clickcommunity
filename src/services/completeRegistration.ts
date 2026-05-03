import { supabase } from '@/integrations/supabase/client';

/**
 * Payload expected by Edge Function `complete-registration` (see supabase/functions/complete-registration).
 * Email OTP is validated in the client before this is called; the function does not accept an OTP field.
 */
export interface CompleteRegistrationBody {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
  referralCode?: string;
}

function logInvokeError(scope: string, err: unknown) {
  console.error(`[${scope}] invoke failed`);
  if (err instanceof Error) {
    console.error('message:', err.message);
    console.error('stack:', err.stack);
    const cause = (err as Error & { cause?: unknown }).cause;
    if (cause !== undefined) console.error('cause:', cause);
  }
  try {
    if (err !== null && typeof err === 'object') {
      console.error('details:', JSON.stringify(err, Object.getOwnPropertyNames(err)));
    }
  } catch {
    console.error('raw error:', err);
  }
}

/**
 * Calls deployed Edge Function `complete-registration` only (no legacy `verify` function).
 */
export async function invokeCompleteRegistration(
  payload: CompleteRegistrationBody,
): Promise<{ tokenHash: string; code: 'created' | 'already_exists'; userId: string | null }> {
  const { data, error } = await supabase.functions.invoke('complete-registration', { body: payload });

  if (error) {
    logInvokeError('complete-registration', error);
    throw new Error('registration_failed');
  }

  const regPayload = data as {
    tokenHash?: string;
    error?: string;
    success?: boolean;
    code?: 'created' | 'already_exists';
    userId?: string | null;
  } | null;

  if (regPayload?.error) {
    console.error('[complete-registration] error in JSON body:', regPayload.error, regPayload);
    throw new Error('registration_failed');
  }

  if (!regPayload?.tokenHash) {
    console.error('[complete-registration] missing tokenHash. Full body:', JSON.stringify(data));
    throw new Error('session_token_missing');
  }

  return {
    tokenHash: regPayload.tokenHash,
    code: regPayload.code ?? 'created',
    userId: regPayload.userId ?? null,
  };
}
