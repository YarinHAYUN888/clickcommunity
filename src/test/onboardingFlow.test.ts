import { describe, it, expect } from 'vitest';
import { classifyOtpWebhookFailure, getHebrewOnboardingMessage } from '@/lib/onboarding/onboardingErrors';
import { ONBOARDING_STEP_LABELS } from '@/lib/onboarding/onboardingFlowDebug';

describe('onboardingErrors', () => {
  it('classifyOtpWebhookFailure timeout', () => {
    expect(classifyOtpWebhookFailure({ ok: false, status: 0, error: 'timeout' })).toBe(
      'otp_webhook_timeout',
    );
  });

  it('classifyOtpWebhookFailure network', () => {
    expect(classifyOtpWebhookFailure({ ok: false, status: 0 })).toBe('otp_webhook_network');
  });

  it('classifyOtpWebhookFailure http', () => {
    expect(classifyOtpWebhookFailure({ ok: false, status: 500 })).toBe('otp_webhook_failed');
  });

  it('getHebrewOnboardingMessage returns Hebrew for known codes', () => {
    const msg = getHebrewOnboardingMessage('otp_code_invalid');
    expect(msg.length).toBeGreaterThan(5);
    expect(msg).toMatch(/קוד/);
  });
});

describe('onboardingFlowDebug', () => {
  it('has STEP labels 1-8', () => {
    expect(ONBOARDING_STEP_LABELS[1]).toContain('signup');
    expect(ONBOARDING_STEP_LABELS[8]).toContain('redirect');
  });
});
