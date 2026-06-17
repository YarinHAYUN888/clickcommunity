import { isValidLifeNiche } from '@/data/lifeNiche';
import type { SupabaseProfile } from '@/hooks/useCurrentUser';

export type DbNewUserRole = 'guest' | 'member';
export const DEFAULT_NEW_USER_ROLE_FALLBACK: DbNewUserRole = 'guest';

export function normalizeDbNewUserRole(value: unknown): DbNewUserRole {
  const role = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (role === 'guest') return 'guest';
  if (role === 'community_member') return 'member';
  if (role === 'member') return 'member';
  return DEFAULT_NEW_USER_ROLE_FALLBACK;
}

/** Defaults applied on new signup (onboarding / complete-registration). */
export const NEW_SIGNUP_PROFILE_DEFAULTS = {
  moderation_status: 'approved' as const,
  suitability_status: 'active' as const,
  is_shadow: false as const,
};

export type ProfileCompletionStatus = 'incomplete' | 'pending_review' | 'approved' | 'rejected';

type ProfileLike = Pick<
  SupabaseProfile,
  | 'first_name'
  | 'date_of_birth'
  | 'gender'
  | 'life_niche'
  | 'interests'
  | 'questionnaire_responses'
  | 'moderation_status'
  | 'profile_completed'
>;

export function hasQuestionnaireResponses(q: unknown): boolean {
  if (!q || typeof q !== 'object') return false;
  return Object.keys(q as Record<string, unknown>).length > 0;
}

/** Required onboarding fields — photos are optional for completion gates. */
export function hasRequiredOnboardingFields(p: ProfileLike | null | undefined): boolean {
  if (!p) return false;
  const fn = (p.first_name || '').trim();
  if (fn.length < 2) return false;
  if (!p.date_of_birth) return false;
  if (!p.gender?.trim()) return false;
  if (!isValidLifeNiche(p.life_niche)) return false;
  const interests = Array.isArray(p.interests) ? p.interests : [];
  if (interests.length >= 5) return true;
  return hasQuestionnaireResponses(p.questionnaire_responses);
}

export function deriveProfileCompletionStatus(
  p: ProfileLike | null | undefined,
): ProfileCompletionStatus {
  if (!p) return 'incomplete';
  const mod = p.moderation_status ?? '';
  if (mod === 'rejected') return 'rejected';
  if (mod === 'approved') return 'approved';
  if (mod === 'pending') return 'pending_review';
  if (p.profile_completed === true && hasRequiredOnboardingFields(p)) return 'approved';
  return 'incomplete';
}

export function hasDisplayPhoto(p: {
  photos?: string[] | null;
  avatar_url?: string | null;
} | null | undefined): boolean {
  if (!p) return false;
  if (Array.isArray(p.photos) && p.photos.some((u) => typeof u === 'string' && u.trim().length > 0)) {
    return true;
  }
  return typeof p.avatar_url === 'string' && p.avatar_url.trim().length > 0;
}
