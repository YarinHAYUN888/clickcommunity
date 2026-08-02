import { Navigate, Outlet } from 'react-router-dom';
import { Lock } from 'lucide-react';
import { SpinnerOverlay } from '@/components/ui/luma-spin';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useIncomingClickCount } from '@/hooks/useIncomingClickCount';
import { EVENT_ACCESS_MIN_INCOMING_CLICKS } from '@/config/clicks';

/**
 * Blocks event view/participation routes until the user has permanent event access
 * (5 incoming clicks) or is admin. UX gate — server enforces on registration/APIs.
 */
export default function EventsAccessGate() {
  const { authId, profile } = useCurrentUser();
  const isAdmin = !!profile?.super_role || profile?.role === 'admin';
  const { loading, error, hasAccess, displayCount, refresh } = useIncomingClickCount(authId, isAdmin);

  if (!authId) {
    return <Navigate to="/" replace />;
  }

  if (loading) {
    return <SpinnerOverlay />;
  }

  if (error) {
    return (
      <div className="min-h-screen gradient-bg pb-24 flex items-center justify-center px-6" dir="rtl">
        <div className="text-center max-w-sm">
          <p className="text-destructive font-medium mb-2">{error}</p>
          <button
            type="button"
            onClick={() => void refresh()}
            className="gradient-primary text-primary-foreground px-6 py-3 rounded-full text-sm font-medium"
          >
            נסה/י שוב
          </button>
        </div>
      </div>
    );
  }

  if (!hasAccess) {
    return (
      <div className="min-h-screen gradient-bg pb-24 flex items-center justify-center px-6" dir="rtl">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center mx-auto mb-4">
            <Lock size={32} className="text-primary" />
          </div>
          <h2 className="text-lg font-semibold text-foreground mb-2">האירועים נעולים</h2>
          <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
            נדרשים {EVENT_ACCESS_MIN_INCOMING_CLICKS} קליקים כדי להיכנס לאירוע. יש לך {displayCount} מתוך{' '}
            {EVENT_ACCESS_MIN_INCOMING_CLICKS}.
          </p>
          <p className="text-xs text-muted-foreground mb-6 font-mono tabular-nums">
            {displayCount}/{EVENT_ACCESS_MIN_INCOMING_CLICKS}
          </p>
          <a
            href="/clicks"
            className="inline-block gradient-primary text-primary-foreground px-6 py-3 rounded-full text-sm font-medium"
          >
            לקליקים שלי
          </a>
        </div>
      </div>
    );
  }

  return <Outlet />;
}
