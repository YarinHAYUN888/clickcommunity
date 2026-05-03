import { useNavigate, useParams } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { User, Edit3, LogOut, Loader2, Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import { SpinnerOverlay } from '@/components/ui/luma-spin';
import GlassCard from '@/components/clicks/GlassCard';
import InterestPill from '@/components/clicks/InterestPill';
import { supabase } from '@/integrations/supabase/client';
import { getMyProfile, getProfileStats } from '@/services/profile';
import { motion } from 'framer-motion';
import { getInterestEmoji } from '@/hooks/useClicksFeed';

interface ProfileStats {
  events_attended: number;
  next_event: { id: string; name: string; date: string } | null;
  events_this_month: number;
  events_remaining: number;
  vote_score: number;
  profile_completion: number;
  referrals_this_month: number;
  referrals_remaining: number;
}

function CompletionRing({ percentage, size = 120 }: { percentage: number; size?: number }) {
  const strokeWidth = 3;
  const radius = (size - strokeWidth * 2) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percentage / 100) * circumference;
  const isComplete = percentage >= 100;

  return (
    <svg width={size} height={size} className="transform -rotate-90">
      <circle
        cx={size / 2} cy={size / 2} r={radius}
        fill="none"
        stroke="hsl(var(--color-primary-ultra-light))"
        strokeWidth={strokeWidth}
      />
      <motion.circle
        cx={size / 2} cy={size / 2} r={radius}
        fill="none"
        stroke={isComplete ? 'hsl(var(--success))' : 'hsl(var(--primary))'}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={circumference}
        initial={{ strokeDashoffset: circumference }}
        animate={{ strokeDashoffset: offset }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
      />
    </svg>
  );
}

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; bg: string; text: string; shimmer?: boolean }> = {
    new: { label: 'חדש 🌱', bg: 'rgba(16,185,129,0.15)', text: 'hsl(var(--success))' },
    veteran: { label: 'ותיק ⭐', bg: 'rgba(124,58,237,0.15)', text: 'hsl(var(--primary))' },
    ambassador: { label: 'שגריר 👑', bg: 'rgba(245,158,11,0.15)', text: 'hsl(var(--warning))', shimmer: true },
  };
  const c = config[status] || config.new;

  return (
    <span
      className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${c.shimmer ? 'animate-pulse' : ''}`}
      style={{ background: c.bg, color: c.text }}
    >
      {c.label}
    </span>
  );
}

export default function ProfilePage() {
  const navigate = useNavigate();
  const { userId: paramUserId } = useParams();
  const [profile, setProfile] = useState<any>(null);
  const [stats, setStats] = useState<ProfileStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [noSession, setNoSession] = useState(false);
  const [photoIdx, setPhotoIdx] = useState(0);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) {
          if (mounted) { setNoSession(true); setLoading(false); }
          return;
        }
        const uid = paramUserId || session.user.id;

        // Load profile first (fast DB query), show page immediately
        const profileData = await getMyProfile(uid);
        if (mounted) {
          setProfile(profileData);
          setLoading(false); // Show the page NOW
        }

        // Load stats in background (edge function, can be slow)
        getProfileStats(uid)
          .then(statsData => { if (mounted) setStats(statsData); })
          .catch(err => console.error('Stats load error:', err));
      } catch (e) {
        console.error('Profile load error:', e);
        if (mounted) setLoading(false);
      }
    })();

    return () => { mounted = false; };
  }, [paramUserId]);

  if (noSession) {
    return (
      <div className="min-h-screen gradient-bg pb-24 flex flex-col items-center justify-center px-6">
        <p className="text-muted-foreground text-center mb-4">אין חיבור פעיל. יש להתחבר מחדש.</p>
        <button onClick={() => navigate('/')} className="px-6 py-3 rounded-full font-medium text-primary-foreground gradient-primary">
          חזרה למסך הכניסה
        </button>
      </div>
    );
  }

  if (loading) {
    return <SpinnerOverlay />;
  }

  const photos = profile?.photos?.length ? profile.photos : (profile?.avatar_url ? [profile.avatar_url] : []);
  const age = profile?.date_of_birth
    ? Math.floor((Date.now() - new Date(profile.date_of_birth).getTime()) / 31557600000)
    : null;
  const completion = stats?.profile_completion ?? profile?.profile_completion ?? 0;

  return (
    <div className="min-h-screen gradient-bg pb-24">
      {/* Photo Carousel */}
      <div className="relative overflow-hidden" style={{ height: 400 }}>
        {photos.length > 0 ? (
          <img src={photos[photoIdx]} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-muted flex items-center justify-center">
            <User size={64} className="text-muted-foreground" />
          </div>
        )}

        {photos.length > 1 && (
          <>
            <div className="absolute bottom-20 inset-x-0 flex justify-center gap-2 z-10">
              {photos.map((_: string, i: number) => (
                <button key={i} onClick={() => setPhotoIdx(i)} className={`w-2 h-2 rounded-full transition-all ${i === photoIdx ? 'bg-primary scale-125' : 'bg-white/50'}`} />
              ))}
            </div>
            {photoIdx > 0 && (
              <button onClick={() => setPhotoIdx(i => i - 1)} className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/30 rounded-full p-1.5 z-10">
                <ChevronRight size={20} className="text-white" />
              </button>
            )}
            {photoIdx < photos.length - 1 && (
              <button onClick={() => setPhotoIdx(i => i + 1)} className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/30 rounded-full p-1.5 z-10">
                <ChevronLeft size={20} className="text-white" />
              </button>
            )}
          </>
        )}

        {/* Gradient overlay with name */}
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-5 pt-20 z-10">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-bold text-white" style={{ textShadow: '0 1px 4px rgba(0,0,0,0.3)' }}>
              {[profile?.first_name, profile?.last_name].filter(Boolean).join(' ') ||
                'השלם/י את הפרופיל'}
              {age ? `, ${age}` : ''}
            </h1>
            {profile?.status && <StatusBadge status={profile.status} />}
          </div>
          {profile?.occupation && <p className="text-white/80 text-base mt-0.5">{profile.occupation}</p>}
        </div>

        {/* Completion ring overlay */}
        {completion < 100 && (
          <div className="absolute top-4 right-4 z-20">
            <div className="relative">
              <CompletionRing percentage={completion} size={52} />
              <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-primary">
                {completion}%
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Edit button */}
      <div className="px-4 mt-3">
        <button
          onClick={() => navigate('/profile/edit')}
          className="w-full glass rounded-xl py-3 flex items-center justify-center gap-2 text-sm font-medium text-primary active:scale-[0.97] transition-transform border border-primary/10"
        >
          <Edit3 size={15} />
          ערוך פרופיל
        </button>
      </div>

      {/* Stats */}
      <div className="px-4 mt-4 space-y-3">
        {completion < 100 && (
          <p className="text-xs text-primary text-center cursor-pointer" onClick={() => navigate('/profile/edit')}>
            הפרופיל שלך {completion}% מלא — לחץ/י להשלמה
          </p>
        )}

        {/* Event stats */}
        {stats && stats.events_attended > 0 && (
          <p className="text-sm text-muted-foreground text-center">
            היה/תה ב-{stats.events_attended} אירועים
          </p>
        )}

        {/* Next event banner */}
        {stats?.next_event && (
          <GlassCard
            variant="strong"
            className="p-3 cursor-pointer"
            onClick={() => navigate(`/events/${stats.next_event!.id}`)}
          >
            <div className="flex items-center gap-2">
              <Calendar size={16} className="text-primary" />
              <span className="text-sm font-medium text-primary">
                מגיע/ה לאירוע הבא: {stats.next_event.name} 🎉
              </span>
            </div>
          </GlassCard>
        )}

        {/* Bio */}
        <GlassCard variant="strong" className="p-4">
          <h2 className="font-bold text-foreground mb-1.5 text-sm">קצת עליי</h2>
          <p className="text-[13px] text-muted-foreground leading-relaxed">
            {profile?.bio || 'עדיין לא הוספת תיאור...'}
          </p>
        </GlassCard>

        {/* Interests */}
        <GlassCard variant="strong" className="p-4">
          <h2 className="font-bold text-foreground mb-2 text-sm">תחומי עניין</h2>
          {profile?.interests && profile.interests.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {profile.interests.map((i: string) => (
                <InterestPill key={i} label={i} emoji={getInterestEmoji(i)} size="sm" />
              ))}
            </div>
          ) : (
            <p className="text-[13px] text-muted-foreground">עדיין לא נבחרו תחומי עניין</p>
          )}
        </GlassCard>

        {/* Logout */}
        <button
          onClick={async () => {
            await supabase.auth.signOut();
            navigate('/');
          }}
          className="w-full rounded-xl py-3 flex items-center justify-center gap-2 text-sm font-medium text-destructive bg-destructive/5 hover:bg-destructive/10 active:scale-[0.97] transition-all"
        >
          <LogOut size={15} />
          התנתק/י
        </button>
      </div>
    </div>
  );
}
