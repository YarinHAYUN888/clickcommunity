import { useCurrentUserContext } from '@/contexts/CurrentUserContext';

export interface SupabaseProfile {
  id: string;
  user_id: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  date_of_birth: string | null;
  gender: string | null;
  photos: string[] | null;
  occupation: string | null;
  /** Persona key for feed matching (see LIFE_NICHE_OPTIONS) */
  life_niche?: string | null;
  /** Distinct community vouches where this user is target (DB trigger maintained) */
  community_vouch_count?: number | null;
  region?: string | null;
  bio: string | null;
  interests: string[] | null;
  avatar_url: string | null;
  role: string | null;
  status: string | null;
  subscription_status: string | null;
  profile_completion: number | null;
  super_role: string | null;
  suspended: boolean | null;
  suitability_status?: string | null;
  is_shadow?: boolean | null;
  risk_flags?: unknown;
  ai_summary?: string | null;
  moderation_status?: string | null;
  moderation_reason?: string | null;
  moderation_confidence?: number | null;
  moderation_flags?: unknown;
  profile_completed?: boolean | null;
  image_upload_status?: string | null;
}

export interface CurrentUser {
  authId: string;
  profile: SupabaseProfile | null;
  role: 'guest' | 'member';
  loading: boolean;
}

/** Shared listener registry for profile refresh signals. */
export const profileListeners = new Set<(userId: string) => void>();

/** Call after server-side profile changes (e.g. admin approval) so all consumers refetch. */
export function notifyProfileUpdated(userId: string) {
  profileListeners.forEach((fn) => {
    try {
      fn(userId);
    } catch {
      /* ignore */
    }
  });
}

export function useCurrentUser(): CurrentUser {
  return useCurrentUserContext();
}
