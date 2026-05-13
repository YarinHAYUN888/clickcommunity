import { supabase } from '@/integrations/supabase/client';
import type { SupabaseProfile } from '@/hooks/useCurrentUser';

export type PostAuthRoute = '/pending-review' | '/clicks' | '/blocked' | '/complete-profile';

export type ProfileRowForRedirect = Pick<
  SupabaseProfile,
  | 'moderation_status'
  | 'suitability_status'
  | 'status'
  | 'profile_completed'
  | 'image_upload_status'
  | 'avatar_url'
  | 'photos'
>;

/** Human moderation cleared — even if suitability_status lags in DB */
function isModerationApproved(p: ProfileRowForRedirect | SupabaseProfile | null): boolean {
  return p?.moderation_status === 'approved';
}

function hasPersistedPhotos(p: ProfileRowForRedirect | SupabaseProfile | null): boolean {
  if (!p) return false;
  const photos = p.photos;
  if (Array.isArray(photos) && photos.length > 0 && photos.some((u) => typeof u === 'string' && u.length > 0)) {
    return true;
  }
  return typeof p.avatar_url === 'string' && p.avatar_url.length > 0;
}

/**
 * Waiting for staff / AI queue. `profiles.status` is member tier (new/veteran/ambassador), NOT review — do not use it here.
 */
function isPendingReview(p: ProfileRowForRedirect | SupabaseProfile | null): boolean {
  if (!p) return false;
  if (isModerationApproved(p)) return false;
  const moderation = p.moderation_status ?? '';
  const suitability = p.suitability_status ?? '';
  return moderation === 'pending' || suitability === 'pending';
}

function isBlockedOrRejected(p: ProfileRowForRedirect | SupabaseProfile | null): boolean {
  if (!p) return false;
  const moderation = p.moderation_status ?? '';
  const suitability = p.suitability_status ?? '';
  return moderation === 'rejected' || suitability === 'blocked';
}

function needsCompleteProfile(p: ProfileRowForRedirect | SupabaseProfile | null): boolean {
  if (!p) return true;
  if (p.profile_completed === true && p.image_upload_status !== 'failed') {
    return false;
  }
  if (isModerationApproved(p) && (p.suitability_status === 'active' || p.suitability_status === 'shadow')) {
    if (hasPersistedPhotos(p)) return false;
  }
  const imageBad = p.image_upload_status === 'failed';
  const profileFlagIncomplete = p.profile_completed === false;
  const imagePending = p.image_upload_status === 'pending';
  if (hasPersistedPhotos(p) && !imageBad) {
    return false;
  }
  if (profileFlagIncomplete || imageBad) return true;
  if (imagePending && !hasPersistedPhotos(p)) return true;
  return false;
}

/**
 * Sync routing from an already-loaded profile (e.g. SuitabilityGate).
 * Returns where the user should be; `/clicks` means the main gated shell is OK.
 */
export function getPostAuthRouteFromProfile(profile: SupabaseProfile | ProfileRowForRedirect | null): PostAuthRoute {
  if (!profile) return '/complete-profile';
  if (isBlockedOrRejected(profile)) return '/blocked';
  if (isPendingReview(profile)) return '/pending-review';
  // Staff approved this user — always allow the main app (no "complete profile" trap after approval).
  if (isModerationApproved(profile)) {
    return '/clicks';
  }
  if (needsCompleteProfile(profile)) return '/complete-profile';
  return '/clicks';
}

/**
 * Fetch profile by auth user id and return the correct post-auth route.
 */
export async function resolvePostAuthRedirect(
  userId: string,
): Promise<{ route: PostAuthRoute; profile: ProfileRowForRedirect | null }> {
  const { data: profile, error } = await supabase
    .from('profiles')
    .select(
      'moderation_status, suitability_status, status, profile_completed, image_upload_status, avatar_url, photos',
    )
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    console.error('resolvePostAuthRedirect:', error.message);
    return { route: '/complete-profile', profile: null };
  }

  const row = (profile as ProfileRowForRedirect | null) ?? null;
  const route = getPostAuthRouteFromProfile(row);
  return { route, profile: row };
}
