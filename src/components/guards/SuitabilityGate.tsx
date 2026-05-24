import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { SpinnerOverlay } from '@/components/ui/luma-spin';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { getEntryRouteFromProfile } from '@/lib/routing/resolveAuthenticatedEntry';

/**
 * Redirects users who must not use the main app shell (pending / blocked / incomplete profile).
 */
export default function SuitabilityGate() {
  const { profile, loading, authId } = useCurrentUser();
  const location = useLocation();

  if (loading) {
    return <SpinnerOverlay />;
  }

  if (!authId) {
    return <Navigate to="/" replace />;
  }

  if (profile?.super_role) {
    return <Outlet />;
  }

  const targetRoute = getEntryRouteFromProfile(profile);

  if (
    targetRoute === '/complete-profile' &&
    (location.pathname === '/profile' || location.pathname.startsWith('/profile/edit'))
  ) {
    return <Outlet />;
  }

  if (targetRoute !== '/clicks') {
    return <Navigate to={targetRoute} replace />;
  }

  return <Outlet />;
}
