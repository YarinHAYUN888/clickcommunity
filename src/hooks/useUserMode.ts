import { useMemo } from 'react';
import { useCurrentUser } from '@/hooks/useCurrentUser';

export function useUserMode() {
  const { profile, loading } = useCurrentUser();

  const suitabilityRaw = profile?.suitability_status ?? 'active';
  const isShadowUser = useMemo(
    () => suitabilityRaw === 'shadow' && !!profile?.is_shadow,
    [suitabilityRaw, profile?.is_shadow],
  );

  return {
    loading,
    isShadowUser,
    suitability_status: suitabilityRaw,
  };
}
