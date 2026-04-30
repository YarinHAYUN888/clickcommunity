import { useNavigate } from 'react-router-dom';
import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Crown, Check, Sparkles, Heart, Gift, Loader2, Copy, MessageCircle } from 'lucide-react';
import { SpinnerOverlay, LumaSpin } from '@/components/ui/luma-spin';
import GlassCard from '@/components/clicks/GlassCard';
import { supabase } from '@/integrations/supabase/client';
import { getProfileStats, getSubscription, checkSubscriptionEligibility, cancelSubscription } from '@/services/profile';
import PointsCard from '@/components/clicks/PointsCard';
import BenefitsCard from '@/components/clicks/BenefitsCard';
import { toast } from 'sonner';

// ---- Guest View ----
function GuestView({ userId }: { userId: string }) {
  const navigate = useNavigate();
  const [modalType, setModalType] = useState<'must_attend' | 'insufficient_votes' | null>(null);
  const [checking, setChecking] = useState(false);

  const handleCTA = async () => {
    setChecking(true);
    try {
      const result = await checkSubscriptionEligibility(userId);
      if (result.eligible) {
        toast('מערכת התשלום תחובר בקרוב!', { icon: '💳' });
      } else {
        setModalType(result.reason === 'must_attend_event' ? 'must_attend' : 'insufficient_votes');
      }
    } catch {
      toast.error('שגיאה בבדיקת הזכאות');
    }
    setChecking(false);
  };

  return (
    <div className="min-h-screen gradient-bg pb-24">
      {/* Hero */}
      <div className="relative overflow-hidden" style={{ background: 'linear-gradient(135deg, hsl(263 84% 55%) 0%, hsl(271 50% 36%) 50%, hsl(280 70% 52%) 100%)', borderRadius: '0 0 24px 24px' }}>
        <div className="px-6 pt-16 pb-12 text-center relative z-10">
          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', damping: 15 }}>
            <Crown size={48} className="text-primary-foreground mx-auto mb-4" />
          </motion.div>
          <h1 className="text-2xl font-bold text-primary-foreground mb-2">הצטרף/י לקהילת Clicks</h1>
          <p className="text-primary-foreground/80 text-3xl font-bold">₪120<span className="text-base font-normal"> / לחודש</span></p>
        </div>
      </div>

      <div className="px-4 -mt-5 relative z-10 space-y-4">
        <GlassCard variant="strong" className="p-6 space-y-3">
          {[
            'עד 3 אירועים בחודש',
            'שליחת הודעות לקליקים',
            'צפייה ברשימת משתתפים באירועים',
            'צ׳אטים קבוצתיים',
            'קליקים מותאמים לאירועים',
            'אחרי חודשיים — יצירת אירועים בעצמך!',
          ].map((benefit, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              className="flex items-center gap-3"
            >
              <div className="w-7 h-7 rounded-full bg-success/10 flex items-center justify-center flex-shrink-0">
                <Check size={14} className="text-success" />
              </div>
              <span className="text-sm text-foreground">{benefit}</span>
            </motion.div>
          ))}
        </GlassCard>

        <button
          onClick={handleCTA}
          disabled={checking}
          className="w-full h-14 rounded-full gradient-primary text-primary-foreground font-semibold text-lg shadow-glass-md active:scale-[0.97] transition-transform flex items-center justify-center gap-2"
        >
          {checking ? <Loader2 className="animate-spin" size={20} /> : 'הצטרף/י עכשיו'}
        </button>
      </div>

      {/* Modals */}
      <AnimatePresence>
        {modalType && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/40" onClick={() => setModalType(null)} />
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="fixed inset-x-4 top-1/2 -translate-y-1/2 z-50 max-w-sm mx-auto"
            >
              <GlassCard variant="strong" className="p-6 text-center space-y-4">
                {modalType === 'must_attend' ? (
                  <>
                    <Sparkles size={40} className="text-primary mx-auto" />
                    <h3 className="text-lg font-bold text-foreground">✨ כדי להצטרף כחבר/ה יש להגיע לאירוע חד-פעמי לפני</h3>
                    <p className="text-sm text-muted-foreground">הגיעו לאירוע, קבלו אישור מהקהילה, ואז תוכלו להצטרף!</p>
                    <button onClick={() => { setModalType(null); navigate('/events'); }} className="w-full h-12 rounded-full gradient-primary text-primary-foreground font-semibold">לאירועים</button>
                    <button onClick={() => setModalType(null)} className="text-sm text-muted-foreground">סגור</button>
                  </>
                ) : (
                  <>
                    <Heart size={40} className="text-accent mx-auto" />
                    <h3 className="text-lg font-bold text-foreground">עוד קצת סבלנות! 💜</h3>
                    <p className="text-sm text-muted-foreground">עדיין לא קיבלת מספיק אישורים מהקהילה. המשך/י להגיע לאירועים!</p>
                    <button onClick={() => { setModalType(null); navigate('/events'); }} className="w-full h-12 rounded-full gradient-primary text-primary-foreground font-semibold">לאירועים</button>
                    <button onClick={() => setModalType(null)} className="text-sm text-muted-foreground">סגור</button>
                  </>
                )}
              </GlassCard>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

// ---- Donut Circle ----
function DonutCircle({ index, used, delay }: { index: number; used: boolean; delay: number }) {
  const size = 60;
  const strokeWidth = 4;
  const r = (size - strokeWidth * 2) / 2;
  const circ = 2 * Math.PI * r;

  return (
    <div className="relative flex flex-col items-center gap-1">
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="hsl(var(--color-primary-ultra-light))" strokeWidth={strokeWidth} />
        {used && (
          <motion.circle
            cx={size/2} cy={size/2} r={r} fill="none"
            stroke="hsl(var(--primary))" strokeWidth={strokeWidth} strokeLinecap="round"
            strokeDasharray={circ}
            initial={{ strokeDashoffset: circ }}
            animate={{ strokeDashoffset: 0 }}
            transition={{ duration: 0.6, ease: 'easeOut', delay }}
          />
        )}
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-base font-semibold text-foreground" style={{ marginBottom: 4 }}>
        {index + 1}
      </span>
    </div>
  );
}

function ReferralShareCard({
  stats,
}: {
  stats: {
    referral_code?: string | null;
    referral_disabled?: boolean;
    referrals_joined_count?: number;
    referral_points_earned?: number;
    referrals_remaining?: number;
    referral_cap?: number;
  };
}) {
  const code = stats?.referral_code;
  const disabled = stats?.referral_disabled;
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const link = code ? `${origin}/r/${code}` : '';

  const shareWhatsApp = () => {
    const text = `הצטרף/י ל-Clicks עם הקישור שלי 💜\n${link}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  const copyLink = async () => {
    if (!link) return;
    await navigator.clipboard.writeText(link);
    toast.success('הקישור הועתק!');
  };

  if (disabled) {
    return (
      <GlassCard variant="strong" className="p-5 border border-border/60">
        <p className="text-sm text-muted-foreground text-center">
          הפניות דרך קישור אישי אינן זמינות לחשבונך כרגע. נשמח לעזור בדרך אחרת — פנה/י לצוות.
        </p>
      </GlassCard>
    );
  }

  return (
    <div className="relative rounded-2xl p-[2px] overflow-hidden" style={{ background: 'conic-gradient(from 0deg, hsl(263 84% 55%), hsl(258 95% 76%), hsl(330 80% 60%), hsl(263 84% 55%))' }}>
      <GlassCard variant="strong" className="rounded-[14px] border-0 p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Gift size={22} className="text-primary" />
          <h3 className="font-semibold text-foreground text-sm leading-snug">הזמינו חברים עם הקישור האישי שלכם</h3>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">
          כל חבר שמצטרף דרך הקישור שלך זוכים את שניכם בחוויה — ותקבלו נקודות על הצטרפות מוצלחת (עד תקרה חודשית).
        </p>

        {code && (
          <div className="rounded-xl bg-muted/50 px-3 py-2 border border-border/40">
            <p className="text-[10px] text-muted-foreground mb-1">הקישור שלך</p>
            <p className="text-xs font-mono text-foreground break-all dir-ltr text-left">{link}</p>
          </div>
        )}

        <div className="flex gap-2">
          <button
            type="button"
            onClick={copyLink}
            disabled={!link}
            className="flex-1 h-11 rounded-xl bg-muted text-foreground text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-40"
          >
            <Copy size={16} /> העתק קישור
          </button>
          <button
            type="button"
            onClick={shareWhatsApp}
            disabled={!link}
            className="flex-1 h-11 rounded-xl bg-[#25D366]/15 text-[#25D366] text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-40"
          >
            <MessageCircle size={16} /> וואטסאפ
          </button>
        </div>

        <div className="text-xs text-muted-foreground space-y-1 border-t border-border/40 pt-3">
          <p>
            <span className="font-semibold text-foreground">{stats?.referrals_joined_count ?? 0}</span> חברים הצטרפו דרכך ·{' '}
            <span className="font-semibold text-foreground">{stats?.referral_points_earned ?? 0}</span> נקודות מהפניות
          </p>
          <p className="text-primary font-medium">
            נשארו {stats?.referrals_remaining ?? 0} מתוך {stats?.referral_cap ?? 5} הזמנות החודש
          </p>
        </div>
      </GlassCard>
    </div>
  );
}

// ---- Member View ----
function MemberView({ userId }: { userId: string }) {
  const navigate = useNavigate();
  const [stats, setStats] = useState<any>(null);
  const [sub, setSub] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [cancelModal, setCancelModal] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const refreshStats = useCallback(async () => {
    try {
      const s = await getProfileStats(userId);
      setStats(s);
    } catch (e) {
      console.error(e);
    }
  }, [userId]);

  useEffect(() => {
    (async () => {
      try {
        const [s, subscription, p] = await Promise.all([
          getProfileStats(userId),
          getSubscription(userId),
          supabase.from('profiles').select('status').eq('user_id', userId).single().then(r => r.data),
        ]);
        setStats(s);
        setSub(subscription);
        setProfile(p);
      } catch (e) { console.error(e); }
      setLoading(false);
    })();
  }, [userId]);

  const handleCancel = async () => {
    setCancelling(true);
    try {
      const result = await cancelSubscription(userId);
      toast.success(`המנוי יבוטל ב-${new Date(result.ends_at).toLocaleDateString('he-IL')}`);
      setCancelModal(false);
      window.location.reload();
    } catch {
      toast.error('שגיאה בביטול המנוי');
    }
    setCancelling(false);
  };

  if (loading) return <div className="flex justify-center py-16"><LumaSpin size={52} /></div>;

  const eventsUsed = stats?.events_this_month ?? 0;
  const isCancelled = sub?.cancel_at_period_end;

  return (
    <div className="min-h-screen gradient-bg pb-24">
      <div className="px-6 pt-[env(safe-area-inset-top)]">
        <h1 className="text-xl font-bold text-foreground pt-4 mb-6">המנוי שלי</h1>
      </div>

      <div className="px-4 space-y-6">
        {/* Cancelled banner */}
        {isCancelled && (
          <div className="rounded-xl p-3 bg-warning/10 text-center">
            <p className="text-sm font-medium" style={{ color: 'hsl(var(--warning))' }}>
              המנוי שלך יסתיים ב-{new Date(sub.current_period_end).toLocaleDateString('he-IL')}
            </p>
          </div>
        )}

        {/* Monthly Quota */}
        <GlassCard variant="strong" className="p-5">
          <h3 className="text-sm font-semibold text-muted-foreground mb-4">אירועים החודש</h3>
          <div className="flex justify-center gap-6">
            {[0, 1, 2].map(i => (
              <DonutCircle key={i} index={i} used={i < eventsUsed} delay={i * 0.2} />
            ))}
          </div>
          <p className="text-center text-sm font-medium text-foreground mt-3">
            {eventsUsed >= 3
              ? <span style={{ color: 'hsl(var(--warning))' }}>ניצלת את כל האירועים החודש</span>
              : `נשארו לך ${stats?.events_remaining ?? 3} מתוך 3 אירועים`}
          </p>
        </GlassCard>

        {/* Points */}
        <GlassCard variant="strong" className="p-5">
          <PointsCard
            userId={userId}
            status={profile?.status || 'new'}
            points={stats?.points ?? 0}
            onRefreshStats={refreshStats}
          />
        </GlassCard>

        <BenefitsCard points={stats?.points ?? 0} />

        {/* Referral — all members */}
        {stats && <ReferralShareCard stats={stats} />}

        {/* Subscription Details */}
        {sub && (
          <GlassCard variant="strong" className="p-5 space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground">פרטי מנוי</h3>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">תאריך חיוב הבא:</span>
                <span className="text-foreground font-medium">{new Date(sub.current_period_end).toLocaleDateString('he-IL')}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">סכום:</span>
                <span className="text-foreground font-medium">₪120</span>
              </div>
              {sub.payment_method_last4 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">אמצעי תשלום:</span>
                  <span className="text-foreground font-medium">•••• {sub.payment_method_last4}</span>
                </div>
              )}
            </div>

            <button className="w-full h-11 rounded-xl border border-primary text-primary text-sm font-medium active:scale-[0.97] transition-transform">
              שנה אמצעי תשלום
            </button>

            {!isCancelled && (
              <button onClick={() => setCancelModal(true)} className="w-full text-center text-sm text-destructive font-medium">
                בטל מנוי
              </button>
            )}
          </GlassCard>
        )}
      </div>

      {/* Cancel Modal */}
      <AnimatePresence>
        {cancelModal && sub && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/40" onClick={() => setCancelModal(false)} />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="fixed inset-x-4 top-1/2 -translate-y-1/2 z-50 max-w-sm mx-auto">
              <GlassCard variant="strong" className="p-6 space-y-4">
                <h3 className="text-lg font-bold text-foreground text-center">בטוח/ה שברצונך לבטל?</h3>
                <p className="text-sm text-muted-foreground text-center">
                  המנוי יישאר פעיל עד סוף התקופה הנוכחית ({new Date(sub.current_period_end).toLocaleDateString('he-IL')})
                </p>
                <button onClick={handleCancel} disabled={cancelling} className="w-full h-12 rounded-full bg-destructive text-primary-foreground font-semibold flex items-center justify-center">
                  {cancelling ? <Loader2 className="animate-spin" size={18} /> : 'בטל מנוי'}
                </button>
                <button onClick={() => setCancelModal(false)} className="w-full h-12 rounded-full gradient-primary text-primary-foreground font-semibold">
                  השאר מנוי
                </button>
              </GlassCard>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

// ---- Main ----
export default function SubscriptionPage() {
  const [userId, setUserId] = useState('');
  const [role, setRole] = useState<string>('guest');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) { setLoading(false); return; }
      setUserId(session.user.id);
      const { data } = await supabase
        .from('profiles')
        .select('role, subscription_status')
        .eq('user_id', session.user.id)
        .single();
      if (data?.role === 'member' || data?.subscription_status === 'active') setRole('member');
      setLoading(false);
    })();
  }, []);

  if (loading) return <SpinnerOverlay />;

  return role === 'member' ? <MemberView userId={userId} /> : <GuestView userId={userId} />;
}
