import { describe, it, expect } from 'vitest';
import {
  hasRequiredOnboardingFields,
  deriveProfileCompletionStatus,
} from '@/lib/profileCompletion';

describe('profileCompletion', () => {
  const base = {
    first_name: 'שיעור',
    date_of_birth: '2000-01-01',
    gender: 'female',
    life_niche: 'student',
    interests: ['מוזיקה', 'טיולים', 'יוגה', 'ספורט', 'קפה'],
    questionnaire_responses: null,
    moderation_status: 'approved',
    profile_completed: true,
  };

  it('hasRequiredOnboardingFields when interests >= 5', () => {
    expect(hasRequiredOnboardingFields(base)).toBe(true);
  });

  it('deriveProfileCompletionStatus approved', () => {
    expect(deriveProfileCompletionStatus(base)).toBe('approved');
  });

  it('incomplete without niche', () => {
    expect(hasRequiredOnboardingFields({ ...base, life_niche: null })).toBe(false);
  });
});
