import { describe, it, expect } from 'vitest';
import { buildClicksFeedCandidates } from '@/lib/matching/clicksFeedBuilder';
import type { SupabaseProfile } from '@/hooks/useCurrentUser';

function mockProfile(overrides: Partial<SupabaseProfile> & { user_id: string }): SupabaseProfile {
  return {
    id: overrides.user_id,
    user_id: overrides.user_id,
    first_name: 'Test',
    last_name: null,
    phone: null,
    date_of_birth: '2000-01-01',
    gender: 'male',
    photos: ['https://example.com/p.jpg'],
    avatar_url: null,
    occupation: 'dev',
    life_niche: 'student',
    bio: 'bio',
    interests: ['מוזיקה', 'טיולים', 'יוגה', 'ספורט', 'קפה'],
    region: 'מרכז',
    role: 'member',
    status: 'new',
    moderation_status: 'approved',
    suitability_status: 'active',
    profile_completed: true,
    image_upload_status: 'success',
    suspended: false,
    is_shadow: false,
    super_role: null,
    ...overrides,
  } as SupabaseProfile;
}

describe('clicksFeedBuilder', () => {
  const viewer = mockProfile({ user_id: 'viewer-1', life_niche: 'student', interests: ['מוזיקה', 'טיולים', 'יוגה', 'ספורט', 'קפה'] });

  it('tier2 same niche without shared interest', () => {
    const other = mockProfile({
      user_id: 'u2',
      life_niche: 'student',
      interests: ['אוכל', 'יין', 'בישול', 'סדרות', 'משחקי קופסה'],
    });
    const { items, report } = buildClicksFeedCandidates(viewer, [other], new Set(), 'viewer-1');
    expect(items.length).toBe(1);
    expect(report.selectedTier).toBe('tier2_niche');
  });

  it('excludes guests', () => {
    const guest = mockProfile({ user_id: 'g1', role: 'guest' });
    const { items, report } = buildClicksFeedCandidates(viewer, [guest], new Set(), 'viewer-1');
    expect(items.length).toBe(0);
    expect(report.excludedCounts.guest).toBe(1);
  });

  it('includes approved active member even without photo and partial profile', () => {
    const memberNoPhoto = mockProfile({
      user_id: 'm1',
      photos: [],
      avatar_url: null,
      bio: null,
      interests: [],
      profile_completed: false,
      image_upload_status: 'pending',
    });
    const { items } = buildClicksFeedCandidates(viewer, [memberNoPhoto], new Set(), 'viewer-1');
    expect(items.length).toBe(1);
    expect(items[0].profile.user_id).toBe('m1');
  });

  it('excludes pending moderation even if role member', () => {
    const pending = mockProfile({ user_id: 'm2', moderation_status: 'pending' });
    const { items, report } = buildClicksFeedCandidates(viewer, [pending], new Set(), 'viewer-1');
    expect(items.length).toBe(0);
    expect(report.excludedCounts.not_approved).toBe(1);
  });
});
