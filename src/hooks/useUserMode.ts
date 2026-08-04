import { useMemo } from 'react';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import type { ViewerEventAccess } from '@/services/events';

export function useUserMode() {
  const { profile, loading } = useCurrentUser();

  const suitabilityRaw = profile?.suitability_status ?? 'active';
  const moderation = profile?.moderation_status ?? 'pending';
  const isShadow = !!profile?.is_shadow;

  const isShadowUser = useMemo(
    () => suitabilityRaw === 'shadow' && isShadow,
    [suitabilityRaw, isShadow],
  );

  const isApprovedGroupA = useMemo(
    () => suitabilityRaw === 'active' && !isShadow && moderation === 'approved',
    [suitabilityRaw, isShadow, moderation],
  );

  /** Event access for Group B requires shadow + is_shadow + approved */
  const isApprovedGroupB = useMemo(
    () => suitabilityRaw === 'shadow' && isShadow && moderation === 'approved',
    [suitabilityRaw, isShadow, moderation],
  );

  const eventViewerAccess = useMemo<ViewerEventAccess>(
    () => ({
      isShadowUser,
      isApprovedGroupA,
      isApprovedGroupB,
      isSuperUser: !!profile?.super_role,
    }),
    [isShadowUser, isApprovedGroupA, isApprovedGroupB, profile?.super_role],
  );

  return {
    loading,
    isShadowUser,
    isApprovedGroupA,
    isApprovedGroupB,
    eventViewerAccess,
    suitability_status: suitabilityRaw,
  };
}
