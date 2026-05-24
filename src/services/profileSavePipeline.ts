import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import { isValidLifeNiche } from '@/data/lifeNiche';
import {
  hasRequiredOnboardingFields,
  NEW_SIGNUP_PROFILE_DEFAULTS,
} from '@/lib/profileCompletion';
import {
  uploadOnboardingPhotosFromDataUrls,
  uploadPhotoSlot,
} from '@/services/profile';

type ProfilesInsert = Database['public']['Tables']['profiles']['Insert'];

export type OnboardingDraft = {
  firstName?: string;
  lastName?: string | null;
  phone?: string;
  dateOfBirth?: { day: number; month: number; year: number };
  gender?: string;
  region?: string;
  regionOther?: string | null;
  occupation?: string;
  life_niche?: string;
  bio?: string;
  instagram?: string | null;
  tiktok?: string | null;
  interests?: string[];
  questionnaireResponses?: Record<string, unknown>;
  photos?: string[];
};

const PROGRESS_KEY = 'clicks_profile_save_progress';

export type SaveProgress = {
  textSaved?: boolean;
  photoUrls?: string[];
  imageUploadStatus?: 'pending' | 'success' | 'failed';
};

export function readSaveProgress(userId: string): SaveProgress | null {
  try {
    const raw = sessionStorage.getItem(`${PROGRESS_KEY}:${userId}`);
    if (!raw) return null;
    return JSON.parse(raw) as SaveProgress;
  } catch {
    return null;
  }
}

export function writeSaveProgress(userId: string, progress: SaveProgress): void {
  try {
    sessionStorage.setItem(`${PROGRESS_KEY}:${userId}`, JSON.stringify(progress));
  } catch {
    /* quota */
  }
}

function draftToProfileRow(
  data: OnboardingDraft,
  userId: string,
  photoList: string[],
  imageUploadStatus: 'pending' | 'success' | 'failed',
): ProfilesInsert {
  const dob = data.dateOfBirth
    ? `${data.dateOfBirth.year}-${String(data.dateOfBirth.month).padStart(2, '0')}-${String(data.dateOfBirth.day).padStart(2, '0')}`
    : null;

  const row: ProfilesInsert = {
    user_id: userId,
    updated_at: new Date().toISOString(),
    ...NEW_SIGNUP_PROFILE_DEFAULTS,
    profile_completed: hasRequiredOnboardingFields({
      first_name: data.firstName,
      date_of_birth: dob,
      gender: data.gender,
      life_niche: data.life_niche,
      interests: data.interests,
      questionnaire_responses: data.questionnaireResponses,
      moderation_status: 'approved',
      profile_completed: false,
    }),
    image_upload_status: imageUploadStatus,
  };

  if (data.firstName) row.first_name = data.firstName;
  if (data.lastName !== undefined && data.lastName !== null) {
    const ln = String(data.lastName).trim();
    row.last_name = ln.length > 0 ? ln : null;
  }
  if (data.phone) row.phone = data.phone;
  if (dob) row.date_of_birth = dob;
  if (data.gender) row.gender = data.gender;
  if (photoList.length > 0) {
    row.photos = photoList;
    row.avatar_url = photoList[0];
  }
  if (data.occupation) row.occupation = data.occupation;
  if (data.life_niche && isValidLifeNiche(data.life_niche)) row.life_niche = data.life_niche;
  if (data.bio !== undefined) row.bio = data.bio;
  if (data.interests && data.interests.length > 0) row.interests = data.interests;
  if (data.region) row.region = data.region;
  if (data.regionOther !== undefined) row.region_other = data.regionOther || null;
  if (data.instagram !== undefined) row.instagram = data.instagram || null;
  if (data.tiktok !== undefined) row.tiktok = data.tiktok || null;
  if (data.questionnaireResponses && Object.keys(data.questionnaireResponses).length > 0) {
    row.questionnaire_responses =
      data.questionnaireResponses as ProfilesInsert['questionnaire_responses'];
  }

  return row;
}

/** Idempotent: ensure new signups are community members (role=member), not guest. */
export async function ensureCommunityMemberDefaults(userId: string): Promise<void> {
  const { data: row, error: fetchErr } = await supabase
    .from('profiles')
    .select('role, moderation_status')
    .eq('user_id', userId)
    .maybeSingle();

  if (fetchErr) {
    console.error('[ensureCommunityMemberDefaults] fetch failed', fetchErr);
    return;
  }

  const role = row?.role ?? 'guest';
  if (role === 'member') return;

  const patch: Record<string, unknown> = {
    ...NEW_SIGNUP_PROFILE_DEFAULTS,
    updated_at: new Date().toISOString(),
  };
  if (row?.moderation_status === 'rejected') {
    delete patch.moderation_status;
  }

  const { error: updateErr } = await supabase.from('profiles').update(patch).eq('user_id', userId);
  if (updateErr) {
    console.error('[ensureCommunityMemberDefaults] update failed', updateErr);
  }
}

/** Persist text + flags without requiring photos. */
export async function saveProfileTextFromDraft(
  userId: string,
  data: OnboardingDraft,
  photoList: string[] = [],
  imageUploadStatus: 'pending' | 'success' | 'failed' = 'pending',
): Promise<void> {
  const profileData = draftToProfileRow(data, userId, photoList, imageUploadStatus);

  let { error } = await supabase.from('profiles').upsert(profileData, { onConflict: 'user_id' });
  if (error) {
    const fallback: ProfilesInsert = { ...profileData };
    delete (fallback as Record<string, unknown>).profile_completed;
    delete (fallback as Record<string, unknown>).image_upload_status;
    const retry = await supabase.from('profiles').upsert(fallback, { onConflict: 'user_id' });
    error = retry.error;
  }
  if (error) {
    console.error('[saveProfileTextFromDraft]', error);
    throw new Error('profile_save_failed');
  }

  const flagsPatch: Record<string, unknown> = {
    ...NEW_SIGNUP_PROFILE_DEFAULTS,
    profile_completed: profileData.profile_completed,
    image_upload_status: imageUploadStatus,
    updated_at: new Date().toISOString(),
  };
  const { error: flagsErr } = await supabase
    .from('profiles')
    .update(flagsPatch)
    .eq('user_id', userId);

  if (flagsErr) {
    console.error('[saveProfileTextFromDraft] flags update failed', flagsErr);
    throw new Error('profile_save_failed');
  }

  writeSaveProgress(userId, { textSaved: true, photoUrls: photoList, imageUploadStatus });
}

export type FinalizeOnboardingResult = {
  userId: string;
  profileSyncFailed: boolean;
  photoUrls: string[];
  imageUploadStatus: 'pending' | 'success' | 'failed';
};

/**
 * Safe onboarding finale: text first, photos per-slot, never blanket-fail profile on non-photo errors.
 */
export async function finalizeOnboardingProfile(
  userId: string,
  data: OnboardingDraft,
  photoSources: string[],
): Promise<FinalizeOnboardingResult> {
  let photoUrls: string[] = [];
  let imageUploadStatus: 'pending' | 'success' | 'failed' = 'pending';
  let profileSyncFailed = false;

  await ensureCommunityMemberDefaults(userId);

  try {
    await saveProfileTextFromDraft(userId, data, [], 'pending');
  } catch (e) {
    console.error('[finalizeOnboardingProfile] text save failed', e);
    profileSyncFailed = true;
  }

  if (photoSources.length > 0) {
    try {
      photoUrls = await uploadOnboardingPhotosFromDataUrls(userId, photoSources);
      imageUploadStatus = photoUrls.length > 0 ? 'success' : 'pending';
    } catch (e) {
      if (e instanceof Error && e.message.startsWith('photo_upload_failed')) {
        imageUploadStatus = 'pending';
        console.error('[finalizeOnboardingProfile] all photos failed — text kept, status pending', e);
      } else {
        console.warn('[finalizeOnboardingProfile] partial photo upload', e);
        imageUploadStatus = 'pending';
      }
    }

    if (photoUrls.length > 0) {
      try {
        await saveProfileTextFromDraft(userId, data, photoUrls, imageUploadStatus);
      } catch (e) {
        console.error('[finalizeOnboardingProfile] photo merge save failed', e);
        profileSyncFailed = true;
      }
    } else if (imageUploadStatus === 'failed') {
      try {
        await saveProfileTextFromDraft(userId, data, [], 'failed');
      } catch {
        profileSyncFailed = true;
      }
    }
  } else {
    try {
      await saveProfileTextFromDraft(userId, data, [], 'pending');
    } catch {
      profileSyncFailed = true;
    }
  }

  writeSaveProgress(userId, { textSaved: !profileSyncFailed, photoUrls, imageUploadStatus });
  return { userId, profileSyncFailed, photoUrls, imageUploadStatus };
}

export { uploadPhotoSlot };
