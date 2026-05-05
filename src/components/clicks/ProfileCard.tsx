import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MessageCircle, Eye, Lock, Snowflake, Calendar } from 'lucide-react';
import { motion, useInView } from 'framer-motion';
import GlassCard from './GlassCard';
import StatusBadge from './StatusBadge';
import InterestPill from './InterestPill';
import CompatibilityArc from './CompatibilityArc';
import { SupabaseProfile } from '@/hooks/useCurrentUser';
import { getInterestEmoji } from '@/hooks/useClicksFeed';
import { toast } from 'sonner';
import PremiumButton from '@/components/ui/PremiumButton';
import { springs } from '@/lib/motion';
import { partnerPreviewFromProfile } from '@/services/chat';

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
  onViewProfile: () => void;
  onIcebreaker: () => void;
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
  onViewProfile,
  onIcebreaker,
}: ProfileCardProps) {
  const navigate = useNavigate();
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: '-50px' });
  const [arcVisible, setArcVisible] = useState(false);

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

  const photoSrc = profile.photos?.[0] || profile.avatar_url || '';
  const allInterestsArr = profile.interests || [];
  const nonShared = allInterestsArr.filter(i => !sharedInterests.includes(i));

  // Calculate age from date_of_birth
  const age = profile.date_of_birth
    ? Math.floor((Date.now() - new Date(profile.date_of_birth).getTime()) / 31557600000)
    : null;

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
            <motion.img
              src={photoSrc}
              alt={profile.first_name || ''}
              className="w-full h-full object-cover"
              animate={{ scale: [1, 1.03, 1] }}
              transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
            />
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
            {profile.occupation && (
              <p className="text-white/75 text-[13px] mt-0.5">{profile.occupation}</p>
            )}
          </div>
        </div>

        {/* Info section */}
        <div className="p-4 space-y-4">
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
            <CompatibilityArc score={compatibilityScore} size="sm" animate={arcVisible} />
          </div>

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
