import { useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import AnimatedBackground from '@/components/ui/AnimatedBackground';
import GlassCard from '@/components/clicks/GlassCard';
import { supabase } from '@/integrations/supabase/client';
import { UserRoundPen } from 'lucide-react';
import { resolvePostAuthRedirect } from '@/lib/routing/postAuthRedirect';
import { SpinnerOverlay } from '@/components/ui/luma-spin';

export default function CompleteProfilePage() {
  const navigate = useNavigate();
  const [booting, setBooting] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.user) {
        if (!cancelled) {
          setBooting(false);
          navigate('/', { replace: true });
        }
        return;
      }
      const { route } = await resolvePostAuthRedirect(session.user.id);
      if (cancelled) return;
      if (route !== '/complete-profile') {
        navigate(route, { replace: true });
        return;
      }
      setBooting(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  if (booting) {
    return <SpinnerOverlay label="טוען..." />;
  }

  return (
    <AnimatedBackground className="min-h-screen flex items-center justify-center px-6 py-16">
      <GlassCard variant="strong" className="max-w-md w-full p-8 md:p-10 text-center space-y-5">
        <div className="mx-auto w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
          <UserRoundPen size={28} className="text-primary" />
        </div>
        <h1 className="text-xl md:text-2xl font-bold text-foreground leading-snug">נשאר להשלים את הפרופיל</h1>
        <p className="text-muted-foreground text-sm md:text-base leading-relaxed">
          כדי להמשיך, עדכנו את פרטי הפרופיל או את התמונות. אפשר להיכנס לפרופיל ואז ללחוץ על עריכה, או לפתוח ישר את מסך העריכה המלא.
        </p>
        <div className="grid grid-cols-1 gap-2 text-sm">
          <button
            type="button"
            onClick={() => navigate('/profile', { replace: true })}
            className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-semibold"
          >
            מעבר לפרופיל שלי
          </button>
          <button
            type="button"
            onClick={() => navigate('/profile/edit', { replace: true })}
            className="w-full py-3 rounded-xl border border-primary/30 text-primary font-semibold"
          >
            עריכה מלאה (תמונות ופרטים)
          </button>
          <button
            type="button"
            onClick={async () => {
              await supabase.auth.signOut();
              navigate('/', { replace: true });
            }}
            className="w-full py-3 rounded-xl border border-border text-foreground font-semibold"
          >
            התנתקות
          </button>
        </div>
      </GlassCard>
    </AnimatedBackground>
  );
}
