import { Navigate, Outlet } from 'react-router-dom';
import { useAdmin } from '@/contexts/AdminContext';
import { SpinnerOverlay } from '@/components/ui/luma-spin';

/** Guards all /admin/* routes — super users only. */
export default function AdminRoute() {
  const { isSuperUser, loading } = useAdmin();

  if (loading) return <SpinnerOverlay />;
  if (!isSuperUser) return <Navigate to="/clicks" replace />;
  return <Outlet />;
}
