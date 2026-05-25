import { describe, expect, it } from 'vitest';
import {
  errorCodeFromMessage,
  shouldShowRegistrationFailed,
  verifyErrorCodeForStage,
} from '@/lib/onboarding/onboardingErrors';

describe('auth completion recovery', () => {
  it('should not show registration_failed when session exists', () => {
    expect(shouldShowRegistrationFailed(true, false)).toBe(false);
  });

  it('maps registration transport errors correctly', () => {
    expect(errorCodeFromMessage('registration_invoke_transport')).toBe('registration_invoke_transport');
  });

  it('maps stage to sync-pending when session already exists', () => {
    expect(verifyErrorCodeForStage('registration_invoke', true)).toBe('auth_completion_sync_pending');
  });

  it('does not map profile/image errors to registration_failed', () => {
    expect(errorCodeFromMessage('profile_save_failed')).toBe('profile_save_failed');
    expect(errorCodeFromMessage('photo_upload_partial')).toBe('photo_upload_partial');
    expect(errorCodeFromMessage('registration_invoke_transport')).not.toBe('registration_failed');
  });
});
