import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AnimatedBackground from '@/components/ui/AnimatedBackground';
import GlassCard from '@/components/clicks/GlassCard';
import { supabase } from '@/integrations/supabase/client';
import { resolvePostAuthRedirect } from '@/lib/routing/postAuthRedirect';
import { notifyProfileUpdated } from '@/hooks/useCurrentUser';
import { Loader2, ShieldCheck, Mail } from 'lucide-react';
import { toast } from 'sonner';

export default function PendingReviewPage() {
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session && !cancelled) navigate('/', { replace: true });
    })();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  async function refreshStatus() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate('/', { replace: true });
      return;
    }
    const { route, profile } = await resolvePostAuthRedirect(user.id);
    if (route === '/clicks') {
      toast.success('הפרופיל אושר — מעבירים אותך לאפליקציה');
      notifyProfileUpdated(user.id);
      navigate('/clicks', { replace: true });
      return;
    }
    if (route === '/blocked') {
      navigate('/blocked', { replace: true });
      return;
    }
    if (route === '/complete-profile') {
      toast.message('נדרש להשלים פרטים בפרופיל. מעבירים לעמוד ההשלמה.');
      navigate('/complete-profile', { replace: true });
      return;
    }
    if (import.meta.env.DEV) {
      console.info('[PendingReviewPage] refresh still pending', profile);
    }
    toast.message('הפרופיל עדיין ממתין לבדיקה');
  }

  async function signOut() {
    await supabase.auth.signOut();
    navigate('/', { replace: true });
  }

  return (
    <AnimatedBackground className="min-h-screen flex items-center justify-center px-6 py-16">
      <GlassCard variant="strong" className="max-w-md w-full p-8 md:p-10 text-center transition-all duration-500 space-y-5">
        <div className="mx-auto w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
          <ShieldCheck size={28} className="text-primary" />
        </div>
        <h1 className="text-xl md:text-2xl font-bold text-foreground leading-snug">
          הפרופיל שלך נמצא בבדיקה
        </h1>
        <p className="text-muted-foreground text-sm md:text-base leading-relaxed">
          הצוות שלנו בודק את הפרטים שלך כדי לשמור על קהילה איכותית ובטוחה. נעדכן אותך בהקדם.
        </p>

        <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground bg-muted/35 rounded-xl py-2">
          <Loader2 size={14} className="animate-spin" />
          סטטוס: ממתין לאישור
        </div>

        <div className="grid grid-cols-1 gap-2 text-sm">
          <button
            type="button"
            onClick={() => void refreshStatus()}
            className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-semibold"
          >
            רענון סטטוס
          </button>
          <a
            href="mailto:support@clickcommunity.co.il"
            className="w-full py-3 rounded-xl border border-primary/30 text-primary font-semibold inline-flex items-center justify-center gap-2"
          >
            <Mail size={15} />
            יצירת קשר עם התמיכה
          </a>
          <button
            type="button"
            onClick={() => void signOut()}
            className="w-full py-3 rounded-xl border border-destructive/30 text-destructive font-semibold"
          >
            התנתקות
          </button>
        </div>
      </GlassCard>
    </AnimatedBackground>
  );
}
