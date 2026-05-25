export type EmailOtpDebugStep = 1 | 2 | 3 | 4 | 5 | 6;

const STEP_LABELS: Record<EmailOtpDebugStep, string> = {
  1: 'button clicked',
  2: 'payload prepared',
  3: 'edge function called',
  4: 'edge response received',
  5: 'email dispatch result',
  6: 'UI moved to code screen',
};

export function isEmailOtpDebugEnabled(): boolean {
  return import.meta.env.DEV || import.meta.env.VITE_ONBOARDING_DEBUG === 'true';
}

export function logEmailOtpStep(step: EmailOtpDebugStep, detail?: Record<string, unknown>): void {
  if (!isEmailOtpDebugEnabled()) return;
  console.info(`[email-otp] STEP ${step} - ${STEP_LABELS[step]}`, detail ?? {});
}
