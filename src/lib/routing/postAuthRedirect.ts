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
  | 'suspended'
  | 'first_name'
  | 'date_of_birth'
  | 'gender'
  | 'life_niche'
  | 'interests'
  | 'questionnaire_responses'
>;

/** Human moderation cleared — even if suitability_status lags in DB */
function isModerationApproved(p: ProfileRowForRedirect | SupabaseProfile | null): boolean {
  return p?.moderation_status === 'approved';
}

/**
 * Human review queue: only `moderation_status = pending` (not suitability alone — avoids shadow/isolated users re-entering the queue UI).
 */
function isPendingReview(p: ProfileRowForRedirect | SupabaseProfile | null): boolean {
  if (!p) return false;
  if (isModerationApproved(p)) return false;
  return (p.moderation_status ?? '') === 'pending';
}

function isSuspended(p: ProfileRowForRedirect | SupabaseProfile | null): boolean {
  return p?.suspended === true;
}

function isBlockedOrRejected(p: ProfileRowForRedirect | SupabaseProfile | null): boolean {
  if (!p) return false;
  const moderation = p.moderation_status ?? '';
  const suitability = p.suitability_status ?? '';
  return moderation === 'rejected' || suitability === 'blocked';
}

/**
 * Sync routing from an already-loaded profile (e.g. SuitabilityGate).
 * Returns where the user should be; `/clicks` means the main gated shell is OK.
 */
export function getPostAuthRouteFromProfile(profile: SupabaseProfile | ProfileRowForRedirect | null): PostAuthRoute {
  if (!profile) return '/clicks';
  if (isSuspended(profile) || isBlockedOrRejected(profile)) return '/blocked';
  if (isPendingReview(profile)) return '/pending-review';
  // Frontend no longer blocks users with /complete-profile.
  // Profile completion remains an in-profile action only.
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
      'moderation_status, suitability_status, status, profile_completed, image_upload_status, avatar_url, photos, suspended, first_name, date_of_birth, gender, life_niche, interests, questionnaire_responses',
    )
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    console.error('resolvePostAuthRedirect:', error.message);
    return { route: '/clicks', profile: null };
  }

  const row = (profile as ProfileRowForRedirect | null) ?? null;
  const route = getPostAuthRouteFromProfile(row);
  return { route, profile: row };
}
