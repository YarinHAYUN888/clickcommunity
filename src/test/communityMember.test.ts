import { describe, it, expect } from 'vitest';
import { isValidLifeNiche } from '@/data/lifeNiche';
import { NEW_SIGNUP_PROFILE_DEFAULTS } from '@/lib/profileCompletion';

describe('community member defaults', () => {
  it('NEW_SIGNUP_PROFILE_DEFAULTS keeps moderation defaults', () => {
    expect(NEW_SIGNUP_PROFILE_DEFAULTS.moderation_status).toBe('approved');
    expect(NEW_SIGNUP_PROFILE_DEFAULTS.suitability_status).toBe('active');
  });
});

describe('lifeNiche options', () => {
  it('soldier_post_service is no longer valid', () => {
    expect(isValidLifeNiche('soldier_post_service')).toBe(false);
  });

  it('student remains valid', () => {
    expect(isValidLifeNiche('student')).toBe(true);
  });
});
