import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MessageCircle, Eye, Lock, Calendar, Heart, X, Zap } from 'lucide-react';
import { motion, useInView } from 'framer-motion';
import GlassCard from './GlassCard';
import InterestPill from './InterestPill';
import CompatibilityArc from './CompatibilityArc';
import { SupabaseProfile } from '@/hooks/useCurrentUser';
import { getInterestEmoji } from '@/hooks/useClicksFeed';
import { lifeNicheLabel } from '@/data/lifeNiche';
import { toast } from 'sonner';
import PremiumButton from '@/components/ui/PremiumButton';
import { springs } from '@/lib/motion';
import { partnerPreviewFromProfile } from '@/services/chat';
import { SwipeAction } from '@/services/clicksSwipe';
import type { CompatibilityEnrichment } from '@/services/matching';
import PremiumMatchSection from '@/components/clicks/PremiumMatchSection';

interface ProfileCardProps {
  profile: SupabaseProfile;
  compatibilityScore: number;
  sharedInterests: string[];
  isProfilePartial: boolean;
  index: number;
  isMember: boolean;
  showEventBanner?: string;
  /** יש הודעה שלא נקראה ממנו בצ׳אט ישיר */
  hasUnreadDm?: boolean;
  swipeBusy?: boolean;
  onSwipe?: (action: SwipeAction) => void | Promise<void>;
  onViewProfile: () => void;
  onIcebreaker: () => void;
  /** Server-side match row + highlights when compute-compatibility ran */
  matchEnrichment?: CompatibilityEnrichment | null;
}

export default function ProfileCard({
  profile,
  compatibilityScore,
  sharedInterests,
  isProfilePartial,
  index,
  isMember,
  showEventBanner,
  hasUnreadDm,
  swipeBusy,
  onSwipe,
  onViewProfile,
  onIcebreaker,
  matchEnrichment,
}: ProfileCardProps) {
  const navigate = useNavigate();
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: '-50px' });
  const [arcVisible, setArcVisible] = useState(false);
  const [photoBroken, setPhotoBroken] = useState(false);
  const [photoLoaded, setPhotoLoaded] = useState(false);

  useEffect(() => {
    if (isInView) {
      const t = setTimeout(() => setArcVisible(true), 200);
      return () => clearTimeout(t);
    }
  }, [isInView]);

  const handleMessage = () => {
    if (!isMember) {
      toast('שליחת הודעות זמינה לחברי קהילה בלבד', { icon: '🔒' });
      return;
    }
    navigate(`/chats/new-${profile.user_id}`, {
      state: { partnerPreview: partnerPreviewFromProfile(profile) },
    });
  };

  const runSwipe = (action: SwipeAction) => {
    if (!onSwipe) return;
    if (!isMember) {
      toast('לייק ודילוג זמינים לחברי קהילה בלבד', { icon: '🔒' });
      return;
    }
    void onSwipe(action);
  };

  const photoSrc = !photoBroken ? (profile.photos?.[0] || profile.avatar_url || '') : '';
  const nicheLabel = lifeNicheLabel(profile.life_niche);
  const personalityLine =
    matchEnrichment?.match?.compatibility_reason ||
    matchEnrichment?.match?.ai_summary ||
    (profile.ai_summary ? String(profile.ai_summary).slice(0, 120) : '');
  const allInterestsArr = profile.interests || [];
  const nonShared = allInterestsArr.filter(i => !sharedInterests.includes(i));

  // Calculate age from date_of_birth
  const age = profile.date_of_birth
    ? Math.floor((Date.now() - new Date(profile.date_of_birth).getTime()) / 31557600000)
    : null;

  const effectiveScore = matchEnrichment?.match?.compatibility_score ?? compatibilityScore;

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 30, rotateX: -10 }}
      animate={isInView ? { opacity: 1, y: 0, rotateX: 0 } : {}}
      transition={{ delay: index * 0.08, ...springs.gentle }}
      style={{ perspective: 1000 }}
    >
      <GlassCard className="overflow-hidden">
        {showEventBanner && (
          <div className="bg-secondary px-4 py-2 flex items-center gap-1.5 justify-center">
            <Calendar size={14} className="text-primary" />
            <span className="text-[13px] font-medium text-primary">
              מגיע/ה לאירוע &lsquo;{showEventBanner}&rsquo;
            </span>
          </div>
        )}

        {/* Photo section */}
        <div className="relative overflow-hidden cursor-pointer" style={{ height: 320 }} onClick={onViewProfile}>
          {isProfilePartial && (
            <div
              className="absolute top-3 start-3 z-20 rounded-full bg-background/90 text-foreground px-2.5 py-1 text-[11px] font-semibold border border-border"
              title="חלק מהפרטים עדיין לא הושלמו"
            >
              פרופיל חלקי
            </div>
          )}
          {hasUnreadDm && (
            <div
              className="absolute top-3 end-3 z-20 flex items-center gap-1 rounded-full bg-primary text-primary-foreground px-2.5 py-1 shadow-lg border border-background"
              title="יש הודעה שלא נקראה"
            >
              <MessageCircle size={14} className="shrink-0" />
              <span className="text-[11px] font-bold leading-none">הודעה</span>
            </div>
          )}
          {photoSrc ? (
            <>
              {!photoLoaded && (
                <div className="absolute inset-0 bg-muted animate-pulse" aria-hidden />
              )}
              <motion.img
                src={photoSrc}
                alt={profile.first_name || ''}
                className="w-full h-full object-cover"
                onLoad={() => setPhotoLoaded(true)}
                onError={() => {
                  setPhotoBroken(true);
                  setPhotoLoaded(true);
                }}
                animate={{ scale: [1, 1.03, 1] }}
                transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
              />
            </>
          ) : (
            <div className="w-full h-full bg-muted flex items-center justify-center text-muted-foreground text-4xl">
              👤
            </div>
          )}
          {/* Vignette */}
          <div className="absolute inset-0 pointer-events-none" style={{ boxShadow: 'inset 0 0 80px rgba(0,0,0,0.25)' }} />
          {/* Subtle purple overlay */}
          <div className="absolute inset-0 pointer-events-none" style={{ background: 'linear-gradient(to top, rgba(124,58,237,0.10), transparent 50%)' }} />
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-4 pt-20">
            <div className="flex items-center gap-2">
              <h3 className="text-2xl font-bold text-white" style={{ textShadow: '0 1px 4px rgba(0,0,0,0.3)' }}>
                {profile.first_name ? (
                  <>
                    <span className="text-gradient-premium" style={{ WebkitTextFillColor: 'transparent' }}>
                      {profile.first_name.charAt(0)}
                    </span>
                    <span>{profile.first_name.slice(1)}</span>
                  </>
                ) : 'אנונימי'}
                {age ? `, ${age}` : ''}
              </h3>
            </div>
            {nicheLabel && (
              <p className="text-white/85 text-[12px] mt-0.5 font-medium">{nicheLabel}</p>
            )}
            {profile.occupation && (
              <p className="text-white/75 text-[13px] mt-0.5">{profile.occupation}</p>
            )}
          </div>
        </div>

        {/* Info section */}
        <div className="p-4 space-y-4">
          {personalityLine && (
            <p className="text-sm text-muted-foreground leading-snug line-clamp-2">{personalityLine}</p>
          )}
          {/* Interests */}
          {(sharedInterests.length > 0 || nonShared.length > 0) && (
            <div className="flex flex-wrap gap-1.5">
              {sharedInterests.slice(0, 4).map(interest => (
                <InterestPill key={interest} label={interest} emoji={getInterestEmoji(interest)} shared size="sm" />
              ))}
              {nonShared.slice(0, Math.max(0, 4 - sharedInterests.length)).map(interest => (
                <InterestPill key={interest} label={interest} emoji={getInterestEmoji(interest)} size="sm" />
              ))}
              {allInterestsArr.length > 4 && (
                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-secondary text-muted-foreground">
                  +{allInterestsArr.length - 4}
                </span>
              )}
            </div>
          )}

          {/* Compatibility arc */}
          <div className="flex justify-center">
            <CompatibilityArc score={effectiveScore} size="sm" animate={arcVisible} />
          </div>

          {matchEnrichment && (
            <PremiumMatchSection
              compatibilityReason={matchEnrichment.match.compatibility_reason}
              aiSummary={matchEnrichment.match.ai_summary}
              highlights={matchEnrichment.highlights ?? null}
            />
          )}

          {onSwipe && (
            <div className="flex justify-center gap-3 pt-1" dir="ltr">
              <motion.button
                type="button"
                disabled={!!swipeBusy}
                whileTap={{ scale: swipeBusy ? 1 : 0.95 }}
                transition={springs.snappy}
                onClick={() => runSwipe('pass')}
                className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-border bg-background text-muted-foreground shadow-sm disabled:opacity-50"
                title="דילוג"
              >
                <X size={22} strokeWidth={2.5} />
              </motion.button>
              <motion.button
                type="button"
                disabled={!!swipeBusy}
                whileTap={{ scale: swipeBusy ? 1 : 0.95 }}
                transition={springs.snappy}
                onClick={() => runSwipe('super_like')}
                className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-accent/50 bg-gradient-to-br from-accent/25 to-primary/20 text-accent shadow-sm disabled:opacity-50"
                title="סופר־לייק"
              >
                <Zap size={22} className="fill-current" />
              </motion.button>
              <motion.button
                type="button"
                disabled={!!swipeBusy}
                whileTap={{ scale: swipeBusy ? 1 : 0.95 }}
                transition={springs.snappy}
                onClick={() => runSwipe('like')}
                className="flex h-12 w-12 items-center justify-center rounded-full gradient-primary text-primary-foreground shadow-md disabled:opacity-50"
                title="לייק"
              >
                <Heart size={22} className="fill-current" />
              </motion.button>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-3">
            <PremiumButton
              tier="primary"
              onClick={handleMessage}
              className="flex-1 h-11 text-[15px]"
            >
              {isMember ? <MessageCircle size={16} /> : <Lock size={16} />}
              שלח/י הודעה
            </PremiumButton>
            <motion.button
              onClick={onViewProfile}
              whileTap={{ scale: 0.97 }}
              transition={springs.snappy}
              className="flex items-center justify-center gap-1.5 rounded-xl h-11 px-4 border border-border text-muted-foreground font-medium text-[15px]"
            >
              <Eye size={16} />
              צפה בפרופיל
            </motion.button>
          </div>
        </div>
      </GlassCard>
    </motion.div>
  );
}
