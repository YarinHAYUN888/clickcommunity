import { useEffect } from 'react';
import { Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { SpinnerOverlay } from '@/components/ui/luma-spin';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { getPostAuthRouteFromProfile } from '@/lib/routing/postAuthRedirect';

/**
 * Redirects users who must not use the main app shell (pending / blocked / incomplete profile).
 */
export default function SuitabilityGate() {
  const { profile, loading, authId } = useCurrentUser();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (loading || !authId) return;
    if (profile?.super_role) return;

    const route = getPostAuthRouteFromProfile(profile);
    if (route === '/clicks') return;

    if (
      route === '/complete-profile' &&
      (location.pathname === '/profile' || location.pathname.startsWith('/profile/edit'))
    ) {
      return;
    }

    navigate(route, { replace: true });
  }, [
    loading,
    authId,
    navigate,
    location.pathname,
    profile,
    profile?.super_role,
    profile?.moderation_status,
    profile?.suitability_status,
    profile?.status,
    profile?.profile_completed,
    profile?.image_upload_status,
  ]);

  if (loading) {
    return <SpinnerOverlay />;
  }

  if (!authId) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
