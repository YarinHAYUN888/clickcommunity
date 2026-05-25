/** Structured logs for post-OTP auth completion (mobile/Safari). */

export type AuthCompletionStep = 1 | 2 | 3 | 4 | 5 | 6;

export const AUTH_COMPLETION_STEP_LABELS: Record<AuthCompletionStep, string> = {
  1: 'otp verified',
  2: 'session restore',
  3: 'create/update profile',
  4: 'upload images',
  5: 'onboarding completion',
  6: 'redirect',
};

export type AuthCompletionFailureStage =
  | 'otp'
  | 'registration_invoke'
  | 'session'
  | 'profile'
  | 'images'
  | 'completion';

export function isAuthCompletionDebugEnabled(): boolean {
  return import.meta.env.DEV || import.meta.env.VITE_ONBOARDING_DEBUG === 'true';
}

export function logAuthCompletionStep(
  step: AuthCompletionStep,
  detail?: Record<string, unknown>,
): void {
  if (!isAuthCompletionDebugEnabled()) return;
  const label = AUTH_COMPLETION_STEP_LABELS[step];
  console.info(`[auth-completion] STEP ${step} - ${label}`, detail ?? {});
}

export function isLikelyMobileSafari(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  return /iPhone|iPad|iPod/i.test(ua) || (/Safari/i.test(ua) && !/Chrome|CriOS|FxiOS/i.test(ua));
}
