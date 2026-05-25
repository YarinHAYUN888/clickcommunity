import { describe, it, expect } from 'vitest';
import {
  classifyOtpWebhookFailure,
  getHebrewOnboardingMessage,
  mapEdgeOtpError,
  mapIssueOtpError,
} from '@/lib/onboarding/onboardingErrors';
import { ONBOARDING_STEP_LABELS } from '@/lib/onboarding/onboardingFlowDebug';
import { buildIssueOtpInvokeBody } from '@/services/otpDelivery';

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

  it('mapIssueOtpError maps invalid_email', () => {
    expect(mapIssueOtpError('invalid_email')).toBe('otp_email_invalid');
    expect(getHebrewOnboardingMessage('otp_email_invalid')).toMatch(/מייל/);
  });

  it('mapIssueOtpError maps rate_limited', () => {
    expect(mapIssueOtpError('rate_limited')).toBe('otp_rate_limited');
  });

  it('mapIssueOtpError maps transport codes to network/timeout', () => {
    expect(mapIssueOtpError('issue_failed')).toBe('otp_webhook_network');
    expect(mapIssueOtpError('otp_delivery_timeout')).toBe('otp_webhook_timeout');
  });

  it('mapEdgeOtpError maps verify errors', () => {
    expect(mapEdgeOtpError('otp_invalid')).toBe('otp_code_invalid');
    expect(mapEdgeOtpError('too_many_attempts')).toBe('otp_too_many_attempts');
  });
});

describe('otpDelivery buildIssueOtpInvokeBody', () => {
  const sample = {
    email: 'User@Example.com',
    phone: '0521234567',
    firstName: 'Test',
  };

  it('email payload omits phone', () => {
    const body = buildIssueOtpInvokeBody(sample, 'email');
    expect(body.email).toBe('user@example.com');
    expect(body.phone).toBeUndefined();
    expect(body.verificationMethod).toBe('email');
  });

  it('phone payload omits email', () => {
    const body = buildIssueOtpInvokeBody(sample, 'phone');
    expect(body.email).toBeUndefined();
    expect(body.phone).toBe('+972521234567');
    expect(body.verificationMethod).toBe('phone');
  });
});

describe('onboardingFlowDebug', () => {
  it('has STEP labels 1-8', () => {
    expect(ONBOARDING_STEP_LABELS[1]).toContain('signup');
    expect(ONBOARDING_STEP_LABELS[8]).toContain('redirect');
  });
});
