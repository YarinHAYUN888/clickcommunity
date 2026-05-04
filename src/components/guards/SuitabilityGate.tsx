import { useEffect } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { SpinnerOverlay } from '@/components/ui/luma-spin';
import { useCurrentUser } from '@/hooks/useCurrentUser';

/**
 * Redirects users who must not use the main app shell (pending / blocked).
 */
export default function SuitabilityGate() {
  const { profile, loading, authId } = useCurrentUser();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading || !authId) return;
    if (profile?.super_role) return;
    const s = profile?.suitability_status ?? 'active';
    if (s === 'pending') {
      navigate('/pending-review', { replace: true });
      return;
    }
    if (s === 'blocked') {
      navigate('/blocked', { replace: true });
    }
  }, [loading, authId, profile?.suitability_status, profile?.super_role, navigate]);

  if (loading && authId) {
    return <SpinnerOverlay />;
  }

  return <Outlet />;
}
