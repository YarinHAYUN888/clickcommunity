export type OnboardingFlowStep = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

export const ONBOARDING_STEP_LABELS: Record<OnboardingFlowStep, string> = {
  1: 'signup success',
  2: 'otp sent',
  3: 'otp verified',
  4: 'session restored',
  5: 'profile inserted',
  6: 'image uploaded',
  7: 'onboarding completed',
  8: 'redirect success',
};

export type OnboardingFlowErrorCode =
  | 'otp_webhook_failed'
  | 'otp_webhook_timeout'
  | 'otp_webhook_network'
  | 'otp_code_invalid'
  | 'otp_rate_limited'
  | 'otp_too_many_attempts'
  | 'otp_email_required'
  | 'otp_email_invalid'
  | 'otp_email_delivery_failed'
  | 'otp_db_unavailable'
  | 'otp_server_config'
  | 'otp_network_error'
  | 'otp_sent_uncertain'
  | 'otp_delivery_pending'
  | 'registration_failed'
  | 'session_token_missing'
  | 'session_restore_failed'
  | 'profile_save_failed'
  | 'photo_upload_partial'
  | 'onboarding_finalize_partial'
  | 'auth_completion_sync_pending'
  | 'registration_invoke_transport'
  | 'missing_credentials'
  | 'unknown';

export function isOnboardingDebugEnabled(): boolean {
  return import.meta.env.DEV || import.meta.env.VITE_ONBOARDING_DEBUG === 'true';
}

export function logOnboardingStep(step: OnboardingFlowStep, detail?: Record<string, unknown>): void {
  if (!isOnboardingDebugEnabled()) return;
  const label = ONBOARDING_STEP_LABELS[step];
  console.info(`[onboarding] STEP ${step} - ${label}`, detail ?? {});
}
