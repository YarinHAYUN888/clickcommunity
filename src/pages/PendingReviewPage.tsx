import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AnimatedBackground from '@/components/ui/AnimatedBackground';
import GlassCard from '@/components/clicks/GlassCard';
import { supabase } from '@/integrations/supabase/client';

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

  return (
    <AnimatedBackground className="min-h-screen flex items-center justify-center px-6 py-16">
      <GlassCard variant="strong" className="max-w-md w-full p-8 md:p-10 text-center transition-all duration-500">
        <h1 className="text-xl md:text-2xl font-bold text-foreground mb-4 leading-snug">
          פרופיל המשתמש שלך נמצא בבדיקה
        </h1>
        <p className="text-muted-foreground text-sm md:text-base leading-relaxed">
          מנהלי המערכת בודקים התאמה לקהילה.
          <br />
          נעדכן אותך בהקדם.
        </p>
      </GlassCard>
    </AnimatedBackground>
  );
}
