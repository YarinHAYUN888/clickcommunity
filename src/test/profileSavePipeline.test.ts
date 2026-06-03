import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockEnsureSession = vi.fn();
const mockUpload = vi.fn();
const mockUpdateProfile = vi.fn();
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(() => ({
      upsert: vi.fn().mockResolvedValue({ error: null }),
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({ data: { moderation_status: 'approved' }, error: null }),
        }),
      }),
    })),
    functions: {
      invoke: vi.fn().mockResolvedValue({ data: {}, error: null }),
    },
  },
}));

vi.mock('@/services/profile', () => ({
  ensureSessionReadyForStorage: (...args: unknown[]) => mockEnsureSession(...args),
  uploadOnboardingPhotosFromDataUrls: (...args: unknown[]) => mockUpload(...args),
  updateProfile: (...args: unknown[]) => mockUpdateProfile(...args),
  uploadPhotoSlot: vi.fn(),
}));

import { finalizeOnboardingProfile, persistProfilePhotoUrls } from '@/services/profileSavePipeline';

const baseDraft = {
  firstName: 'Test',
  dateOfBirth: { day: 1, month: 1, year: 2000 },
  gender: 'male',
  life_niche: 'student',
  interests: ['a', 'b', 'c', 'd', 'e'],
};

describe('persistProfilePhotoUrls', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpdateProfile.mockResolvedValue({ success: true });
  });

  it('uses updateProfile edge for photo URLs', async () => {
    const status = await persistProfilePhotoUrls('user-1', ['https://example.com/1.jpg']);
    expect(status).toBe('success');
    expect(mockUpdateProfile).toHaveBeenCalledWith('user-1', {
      photos: ['https://example.com/1.jpg'],
    });
  });
});

describe('finalizeOnboardingProfile', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEnsureSession.mockResolvedValue(undefined);
    mockUpdateProfile.mockResolvedValue({ success: true });
  });

  it('uploads before persisting photo URLs when photos provided', async () => {
    const order: string[] = [];
    mockUpload.mockImplementation(async () => {
      order.push('upload');
      return {
        photoUrls: ['https://example.com/a.jpg'],
        failedSlots: [],
        partialFailure: false,
      };
    });
    mockUpdateProfile.mockImplementation(async () => {
      order.push('persist');
      return { success: true };
    });

    const result = await finalizeOnboardingProfile('user-1', baseDraft, ['data:image/jpeg;base64,abc']);

    expect(order).toEqual(['upload', 'persist']);
    expect(mockEnsureSession).toHaveBeenCalledWith('user-1');
    expect(result.photoUrls).toHaveLength(1);
    expect(result.partialFailure).toBe(false);
    expect(result.profileSyncFailed).toBe(false);
  });

  it('reports partial failure when not all slots upload', async () => {
    mockUpload.mockResolvedValue({
      photoUrls: ['https://example.com/a.jpg'],
      failedSlots: [1],
      partialFailure: true,
    });

    const result = await finalizeOnboardingProfile('user-1', baseDraft, [
      'data:image/jpeg;base64,one',
      'data:image/jpeg;base64,two',
    ]);

    expect(result.partialFailure).toBe(true);
    expect(result.failedSlots).toEqual([1]);
    expect(result.profileSyncFailed).toBe(true);
    expect(result.photoUrls).toHaveLength(1);
  });
});
