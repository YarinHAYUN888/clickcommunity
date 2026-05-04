import type { SupabaseProfile } from '@/hooks/useCurrentUser';

export type SuitabilityRedirect = '/pending-review' | '/blocked' | null;

export function getSuitabilityRedirect(profile: SupabaseProfile | null): SuitabilityRedirect {
  if (!profile) return null;
  const s = profile.suitability_status;
  if (s === 'pending') return '/pending-review';
  if (s === 'blocked') return '/blocked';
  return null;
}
