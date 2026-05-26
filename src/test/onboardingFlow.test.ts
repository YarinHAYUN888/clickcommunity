import { describe, it, expect } from 'vitest';
import {
  classifyOtpWebhookFailure,
  getHebrewOnboardingMessage,
  mapEdgeOtpError,
  mapIssueOtpError,
} from '@/lib/onboarding/onboardingErrors';
import { ONBOARDING_STEP_LABELS } from '@/lib/onboarding/onboardingFlowDebug';
import { buildIssueOtpInvokeBody, resolveIssueOtpErrorCode } from '@/services/otpDelivery';

describe('onboardingErrors', () => {
  it('classifyOtpWebhookFailure timeout', () => {
    expect(classifyOtpWebhookFailure({ ok: false, status: 0, error: 'timeout' })).toBe(
      'otp_webhook_timeout',
    );
  });

  it('classifyOtpWebhookFailure network', () => {
    expect(classifyOtpWebhookFailure({ ok: false, status: 0 })).toBe('otp_network_error');
  });

  it('classifyOtpWebhookFailure http', () => {
    expect(classifyOtpWebhookFailure({ ok: false, status: 500 })).toBe('otp_webhook_failed');
  });

  it('getHebrewOnboardingMessage returns Hebrew for known codes', () => {
    const msg = getHebrewOnboardingMessage('otp_code_invalid');
    expect(msg.length).toBeGreaterThan(5);
    expect(msg).toMatch(/קוד/);
  });

  it('mapIssueOtpError maps email_required', () => {
    expect(mapIssueOtpError('email_required')).toBe('otp_email_required');
    expect(getHebrewOnboardingMessage('otp_email_required')).toMatch(/מייל/);
  });

  it('mapIssueOtpError maps invalid_email to email_required message', () => {
    expect(mapIssueOtpError('invalid_email')).toBe('otp_email_required');
  });

  it('mapIssueOtpError maps db_insert_failed', () => {
    expect(mapIssueOtpError('db_insert_failed')).toBe('otp_db_unavailable');
    expect(getHebrewOnboardingMessage('otp_db_unavailable')).toMatch(/שירות/);
  });

  it('mapIssueOtpError maps server_config_error', () => {
    expect(mapIssueOtpError('server_config_error')).toBe('otp_server_config');
    expect(getHebrewOnboardingMessage('otp_server_config')).toMatch(/תמיכה/);
  });

  it('mapIssueOtpError maps network_error', () => {
    expect(mapIssueOtpError('network_error')).toBe('otp_network_error');
    expect(getHebrewOnboardingMessage('otp_network_error')).toMatch(/אינטרנט/);
  });

  it('mapIssueOtpError maps rate_limited', () => {
    expect(mapIssueOtpError('rate_limited')).toBe('otp_rate_limited');
  });

  it('mapIssueOtpError maps email_delivery_failed', () => {
    expect(mapIssueOtpError('email_delivery_failed')).toBe('otp_email_delivery_failed');
  });

  it('mapIssueOtpError maps issue_failed to db unavailable not network', () => {
    expect(mapIssueOtpError('issue_failed')).toBe('otp_db_unavailable');
  });

  it('mapEdgeOtpError maps verify errors', () => {
    expect(mapEdgeOtpError('otp_invalid')).toBe('otp_code_invalid');
    expect(mapEdgeOtpError('too_many_attempts')).toBe('otp_too_many_attempts');
  });
});

describe('resolveIssueOtpErrorCode', () => {
  it('prefers body error_code over generic 500', () => {
    expect(resolveIssueOtpErrorCode({ error_code: 'db_insert_failed' }, null, 500)).toBe(
      'db_insert_failed',
    );
  });

  it('maps bare 500 to unexpected_error', () => {
    expect(resolveIssueOtpErrorCode(null, null, 500)).toBe('unexpected_error');
  });

  it('maps status 0 to network_error', () => {
    expect(resolveIssueOtpErrorCode(null, null, 0)).toBe('network_error');
  });
});

describe('otpDelivery buildIssueOtpInvokeBody (Contract A)', () => {
  const sample = {
    email: 'User@Example.com',
    phone: '0521234567',
    firstName: 'Test',
  };

  it('email payload uses channel and omits phone', () => {
    const body = buildIssueOtpInvokeBody(sample, 'email', 'sess-uuid');
    expect(body.channel).toBe('email');
    expect(body.email).toBe('user@example.com');
    expect(body.phone).toBeUndefined();
    expect(body.registration_session_id).toBe('sess-uuid');
    expect(body.verificationMethod).toBeUndefined();
  });

  it('sms payload uses channel sms and omits email', () => {
    const body = buildIssueOtpInvokeBody(sample, 'phone');
    expect(body.channel).toBe('sms');
    expect(body.email).toBeUndefined();
    expect(body.phone).toBe('+972521234567');
    expect(body.verificationMethod).toBeUndefined();
  });
});

describe('n8n webhook envelope (Contract B)', () => {
  it('nested body.email and body.code for Gmail', async () => {
    const { buildN8nWebhookEnvelope } = await import(
      '../../supabase/functions/_shared/n8nOtpEnvelope.ts'
    );
    const envelope = buildN8nWebhookEnvelope(
      'email',
      '123456',
      'challenge-uuid',
      'user@example.com',
      { firstName: 'A', lastName: 'B' },
      'sess-uuid',
    );
    const nested = envelope.body as Record<string, unknown>;
    expect(nested.email).toBe('user@example.com');
    expect(nested.code).toBe('123456');
    expect(nested.channel).toBe('email');
    expect(nested.purpose).toBe('registration');
    expect(envelope.email).toBe('user@example.com');
  });
});

describe('onboardingFlowDebug', () => {
  it('has STEP labels 1-8', () => {
    expect(ONBOARDING_STEP_LABELS[1]).toContain('signup');
    expect(ONBOARDING_STEP_LABELS[8]).toContain('redirect');
  });
});
