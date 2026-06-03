import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import { isValidLifeNiche } from '@/data/lifeNiche';
import {
  hasRequiredOnboardingFields,
  NEW_SIGNUP_PROFILE_DEFAULTS,
} from '@/lib/profileCompletion';
import {
  ensureSessionReadyForStorage,
  updateProfile,
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
  profileCompletedOverride?: boolean,
): ProfilesInsert {
  const dob = data.dateOfBirth
    ? `${data.dateOfBirth.year}-${String(data.dateOfBirth.month).padStart(2, '0')}-${String(data.dateOfBirth.day).padStart(2, '0')}`
    : null;

  const row: ProfilesInsert = {
    user_id: userId,
    updated_at: new Date().toISOString(),
    ...NEW_SIGNUP_PROFILE_DEFAULTS,
    profile_completed:
      typeof profileCompletedOverride === 'boolean'
        ? profileCompletedOverride
        : hasRequiredOnboardingFields({
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

/** Apply system_settings default role via Edge (service role). */
export async function applyDefaultUserRole(userId: string): Promise<void> {
  const { data, error } = await supabase.functions.invoke('apply-default-user-role', {
    body: { user_id: userId },
  });
  if (error) {
    console.warn('[applyDefaultUserRole] invoke failed', error.message);
    return;
  }
  if (data && typeof data === 'object' && 'error' in data && (data as { error?: string }).error) {
    console.warn('[applyDefaultUserRole] edge error', data);
  }
}

/**
 * Idempotent moderation defaults only (role handled by applyDefaultUserRole).
 */
export async function ensureCommunityMemberDefaults(userId: string): Promise<void> {
  const { data: row, error: fetchErr } = await supabase
    .from('profiles')
    .select('moderation_status')
    .eq('user_id', userId)
    .maybeSingle();

  if (fetchErr) {
    console.error('[ensureCommunityMemberDefaults] fetch failed', fetchErr);
    return;
  }

  const currentModeration = row?.moderation_status ?? null;
  if (currentModeration) return;

  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
    moderation_status: NEW_SIGNUP_PROFILE_DEFAULTS.moderation_status,
  };
  if (row?.moderation_status === 'rejected') delete patch.moderation_status;

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
  profileCompletedOverride?: boolean,
): Promise<void> {
  const profileData = draftToProfileRow(
    data,
    userId,
    photoList,
    imageUploadStatus,
    profileCompletedOverride,
  );

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

/** Persist uploaded photo URLs via update-profile Edge (same path as edit profile). */
export async function persistProfilePhotoUrls(
  userId: string,
  photoUrls: string[],
): Promise<'success' | 'failed' | 'skipped'> {
  if (photoUrls.length === 0) return 'skipped';

  try {
    await updateProfile(userId, { photos: photoUrls });
    const { error } = await supabase
      .from('profiles')
      .update({
        image_upload_status: 'success',
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId);

    if (error) {
      console.error('PROFILE IMAGE UPLOAD FAILED', { userId, stage: 'image_upload_status', message: error.message });
      return 'failed';
    }

    console.log('PROFILE IMAGE URL SAVED TO PROFILE', { userId, count: photoUrls.length });
    console.log('PROFILE IMAGE FINAL PROFILE UPDATE SUCCESS', { userId, count: photoUrls.length });
    return 'success';
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error('PROFILE IMAGE UPLOAD FAILED', { userId, stage: 'update_profile_edge', message });
    return 'failed';
  }
}

export type FinalizeOnboardingResult = {
  userId: string;
  profileSyncFailed: boolean;
  photoUrls: string[];
  failedSlots: number[];
  partialFailure: boolean;
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
  console.log('onboarding start', { userId, photoSourceCount: photoSources.length });
  let photoUrls: string[] = [];
  let failedSlots: number[] = [];
  let partialFailure = false;
  let imageUploadStatus: 'pending' | 'success' | 'failed' = 'pending';
  let profileSyncFailed = false;

  await applyDefaultUserRole(userId);
  await ensureCommunityMemberDefaults(userId);

  const validPhotoSources = photoSources.filter((s) => typeof s === 'string' && s.length > 0);

  if (validPhotoSources.length > 0) {
    try {
      await ensureSessionReadyForStorage(userId);
      const uploadResult = await uploadOnboardingPhotosFromDataUrls(userId, validPhotoSources);
      photoUrls = uploadResult.photoUrls;
      failedSlots = uploadResult.failedSlots;
      partialFailure = uploadResult.partialFailure;
      imageUploadStatus = partialFailure ? 'failed' : 'success';
    } catch (e) {
      imageUploadStatus = 'failed';
      if (e instanceof Error && e.message.startsWith('photo_upload_failed')) {
        console.error('[finalizeOnboardingProfile] all photos failed — text kept, status failed', e);
      } else {
        console.error('[finalizeOnboardingProfile] photo upload failed', e);
      }
      throw e;
    }
  }

  const computedImageStatus: 'pending' | 'success' | 'failed' =
    validPhotoSources.length === 0 ? 'pending' : imageUploadStatus;

  try {
    console.log('profile save', {
      userId,
      imageUploadStatus: computedImageStatus,
      uploadedCount: photoUrls.length,
      partialFailure,
    });
    await saveProfileTextFromDraft(userId, data, photoUrls, computedImageStatus, false);
  } catch (e) {
    console.error('[finalizeOnboardingProfile] text/profile save failed', e);
    profileSyncFailed = true;
  }

  if (photoUrls.length > 0 && !profileSyncFailed) {
    const photoPersist = await persistProfilePhotoUrls(userId, photoUrls);
    if (photoPersist === 'failed') {
      profileSyncFailed = true;
      imageUploadStatus = 'failed';
    } else if (photoPersist === 'success' && !partialFailure) {
      imageUploadStatus = 'success';
    }
  }

  const finalImageStatus: 'pending' | 'success' | 'failed' =
    validPhotoSources.length === 0 ? 'pending' : imageUploadStatus;

  const photosFullySaved =
    validPhotoSources.length === 0 ||
    (photoUrls.length === validPhotoSources.length && finalImageStatus === 'success' && !partialFailure);

  const shouldMarkProfileCompleted =
    !profileSyncFailed &&
    photosFullySaved &&
    hasRequiredOnboardingFields({
      first_name: data.firstName,
      date_of_birth: data.dateOfBirth
        ? `${data.dateOfBirth.year}-${String(data.dateOfBirth.month).padStart(2, '0')}-${String(data.dateOfBirth.day).padStart(2, '0')}`
        : null,
      gender: data.gender,
      life_niche: data.life_niche,
      interests: data.interests,
      questionnaire_responses: data.questionnaireResponses,
      moderation_status: 'approved',
      profile_completed: false,
    });

  if (shouldMarkProfileCompleted) {
    const { error: completeErr } = await supabase
      .from('profiles')
      .update({ profile_completed: true, updated_at: new Date().toISOString() })
      .eq('user_id', userId);
    if (completeErr) {
      console.error('[finalizeOnboardingProfile] profile_completed update failed', completeErr);
      profileSyncFailed = true;
    } else {
      console.log('PROFILE IMAGE FINAL PROFILE UPDATE SUCCESS', { userId, profile_completed: true });
    }
  }

  if (partialFailure && !profileSyncFailed) {
    profileSyncFailed = true;
  }

  writeSaveProgress(userId, {
    textSaved: !profileSyncFailed,
    photoUrls,
    imageUploadStatus: finalImageStatus,
  });
  return {
    userId,
    profileSyncFailed,
    photoUrls,
    failedSlots,
    partialFailure,
    imageUploadStatus: finalImageStatus,
  };
}

export { uploadPhotoSlot };
