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

  it('excludes approved active member without any photo', () => {
    const memberNoPhoto = mockProfile({
      user_id: 'm1',
      photos: [],
      avatar_url: null,
      bio: null,
      interests: [],
      profile_completed: false,
      image_upload_status: 'pending',
    });
    const { items, report } = buildClicksFeedCandidates(viewer, [memberNoPhoto], new Set(), 'viewer-1');
    expect(items.length).toBe(0);
    expect(report.excludedCounts.no_photo).toBe(1);
  });

  it('includes approved active member with photo in photos[]', () => {
    const member = mockProfile({
      user_id: 'm-photos',
      photos: ['https://example.com/pic.jpg'],
      avatar_url: null,
    });
    const { items } = buildClicksFeedCandidates(viewer, [member], new Set(), 'viewer-1');
    expect(items.length).toBe(1);
    expect(items[0].profile.user_id).toBe('m-photos');
  });

  it('includes approved active member with avatar_url only', () => {
    const member = mockProfile({
      user_id: 'm-avatar',
      photos: [],
      avatar_url: 'https://example.com/avatar.jpg',
    });
    const { items } = buildClicksFeedCandidates(viewer, [member], new Set(), 'viewer-1');
    expect(items.length).toBe(1);
    expect(items[0].profile.user_id).toBe('m-avatar');
  });

  it('excludes member whose photo fields contain only empty strings', () => {
    const member = mockProfile({
      user_id: 'm-empty',
      photos: ['', '   '],
      avatar_url: '  ',
    });
    const { items, report } = buildClicksFeedCandidates(viewer, [member], new Set(), 'viewer-1');
    expect(items.length).toBe(0);
    expect(report.excludedCounts.no_photo).toBe(1);
  });

  it('excludes guest even with photo', () => {
    const guest = mockProfile({
      user_id: 'g-photo',
      role: 'guest',
      photos: ['https://example.com/p.jpg'],
    });
    const { items, report } = buildClicksFeedCandidates(viewer, [guest], new Set(), 'viewer-1');
    expect(items.length).toBe(0);
    expect(report.excludedCounts.guest).toBe(1);
  });

  it('excludes pending moderation even with photo', () => {
    const pending = mockProfile({
      user_id: 'm-pending-photo',
      moderation_status: 'pending',
      photos: ['https://example.com/p.jpg'],
    });
    const { items, report } = buildClicksFeedCandidates(viewer, [pending], new Set(), 'viewer-1');
    expect(items.length).toBe(0);
    expect(report.excludedCounts.not_approved).toBe(1);
  });

  it('excludes pending moderation even if role member', () => {
    const pending = mockProfile({ user_id: 'm2', moderation_status: 'pending' });
    const { items, report } = buildClicksFeedCandidates(viewer, [pending], new Set(), 'viewer-1');
    expect(items.length).toBe(0);
    expect(report.excludedCounts.not_approved).toBe(1);
  });

  it('includes shadow members for shadow viewer', () => {
    const shadowViewer = mockProfile({
      user_id: 'shadow-viewer',
      suitability_status: 'shadow',
      is_shadow: true,
    });
    const shadowCandidate = mockProfile({
      user_id: 'shadow-1',
      suitability_status: 'shadow',
      is_shadow: true,
    });
    const { items } = buildClicksFeedCandidates(shadowViewer, [shadowCandidate], new Set(), 'shadow-viewer');
    expect(items.length).toBe(1);
    expect(items[0].profile.user_id).toBe('shadow-1');
  });

  it('excludes shadow candidates for active viewer', () => {
    const shadowCandidate = mockProfile({
      user_id: 'shadow-1',
      suitability_status: 'shadow',
      is_shadow: true,
    });
    const { items, report } = buildClicksFeedCandidates(viewer, [shadowCandidate], new Set(), 'viewer-1');
    expect(items.length).toBe(0);
    expect(report.excludedCounts.not_active).toBe(1);
  });
});
