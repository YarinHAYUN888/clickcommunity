import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { MessageCircle, Loader2, Sparkles, MapPin } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import InterestPill from './InterestPill';
import { getEventClicks, EventClick } from '@/services/events';
import { createOrGetDm } from '@/services/chat';
import { getInterestEmoji } from '@/hooks/useClicksFeed';
import { toast } from 'sonner';

interface EventClicksSectionProps {
  eventId: string;
  currentUserId: string;
  isMember: boolean;
}

export default function EventClicksSection({ eventId, currentUserId, isMember }: EventClicksSectionProps) {
  const navigate = useNavigate();
  const [clicks, setClicks] = useState<EventClick[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingDmFor, setPendingDmFor] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    getEventClicks(eventId, currentUserId, 6)
      .then(res => {
        if (active) setClicks(res);
      })
      .catch(err => {
        console.error('Failed to load event clicks:', err);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [eventId, currentUserId]);

  const handleStartChat = async (otherUserId: string) => {
    if (!isMember) {
      toast('שליחת הודעות זמינה לחברי קהילה בלבד', { icon: '🔒' });
      return;
    }
    if (pendingDmFor) return;
    setPendingDmFor(otherUserId);
    try {
      const result = await createOrGetDm(otherUserId);
      const chatId = result?.chat_id || result?.id;
      if (!chatId) throw new Error('no_chat_id');
      navigate(`/chats/${chatId}`);
    } catch (err) {
      console.error('Failed to start DM:', err);
      toast.error('לא הצלחנו לפתוח צ׳אט. נסו שוב.');
    } finally {
      setPendingDmFor(null);
    }
  };

  // Hide section entirely when nothing meaningful to show
  if (!loading && clicks.length === 0) return null;

  return (
    <section aria-labelledby="event-clicks-heading">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span
            className="w-7 h-7 rounded-full flex items-center justify-center"
            style={{
              background: 'linear-gradient(135deg, #7C3AED 0%, #EC4899 100%)',
              boxShadow: '0 4px 12px rgba(124,58,237,0.30)',
            }}
          >
            <Sparkles size={14} className="text-white" />
          </span>
          <div>
            <h3
              id="event-clicks-heading"
              className="font-bold text-[15px] text-gradient-premium leading-tight"
              style={{ fontFamily: 'Rubik, sans-serif' }}
            >
              קליקים בשבילך באירוע
            </h3>
            <p className="text-[11px] text-muted-foreground leading-tight">
              אנשים שמתחברים אליך לפי תחומי עניין משותפים
            </p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1">
          {[0, 1, 2].map(i => (
            <div key={i} className="shrink-0 w-[160px]">
              <Skeleton className="w-full h-[200px] rounded-2xl" />
              <div className="mt-2 space-y-1.5">
                <Skeleton className="w-3/4 h-3 rounded-full" />
                <Skeleton className="w-1/2 h-3 rounded-full" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1 snap-x snap-mandatory">
          {clicks.map((c, i) => (
            <ClickCard
              key={c.profile.user_id}
              click={c}
              index={i}
              pending={pendingDmFor === c.profile.user_id}
              onChat={() => handleStartChat(c.profile.user_id)}
              isMember={isMember}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function ClickCard({
  click,
  index,
  pending,
  onChat,
  isMember,
}: {
  click: EventClick;
  index: number;
  pending: boolean;
  onChat: () => void;
  isMember: boolean;
}) {
  const { profile, compatibilityScore, sharedInterests, sameRegion } = click;
  const photo = profile.photos?.[0] || profile.avatar_url || '';
  const age = profile.date_of_birth
    ? Math.floor((Date.now() - new Date(profile.date_of_birth).getTime()) / 31557600000)
    : null;

  return (
    <motion.article
      initial={{ opacity: 0, y: 12, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.4, delay: Math.min(index * 0.06, 0.4), ease: 'easeOut' }}
      className="shrink-0 w-[170px] snap-start"
    >
      <div className="relative rounded-2xl overflow-hidden bg-card border border-border/40 shadow-[0_4px_18px_rgba(124,58,237,0.10)]">
        {/* Photo */}
        <div className="relative w-full aspect-[3/4] overflow-hidden bg-muted">
          {photo ? (
            <img
              src={photo}
              alt={profile.first_name || ''}
              loading="lazy"
              draggable={false}
              className="w-full h-full object-cover select-none"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-3xl text-muted-foreground">👤</div>
          )}
          {/* Gradient overlay for text readability */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                'linear-gradient(to top, rgba(0,0,0,0.65), rgba(0,0,0,0.10) 45%, transparent 60%)',
            }}
          />
          {/* Compatibility pill */}
          <div
            className="absolute top-2 right-2 px-2 py-0.5 rounded-full text-[11px] font-bold text-white flex items-center gap-1"
            style={{
              background: 'linear-gradient(135deg, #7C3AED 0%, #EC4899 100%)',
              boxShadow: '0 2px 8px rgba(124,58,237,0.40)',
            }}
          >
            <Sparkles size={10} />
            {compatibilityScore}%
          </div>
          {/* Same region pill */}
          {sameRegion && profile.region && (
            <div
              className="absolute top-2 left-2 px-2 py-0.5 rounded-full text-[10px] font-medium text-white flex items-center gap-1 backdrop-blur-md"
              style={{ background: 'rgba(255,255,255,0.18)' }}
            >
              <MapPin size={9} />
              {profile.region}
            </div>
          )}
          {/* Bottom name */}
          <div className="absolute inset-x-0 bottom-0 p-2.5">
            <p className="font-semibold text-[14px] text-white leading-tight truncate"
              style={{ textShadow: '0 1px 4px rgba(0,0,0,0.5)' }}>
              {profile.first_name || 'משתמש/ת'}
              {age ? `, ${age}` : ''}
            </p>
            {profile.occupation && (
              <p className="text-[11px] text-white/80 truncate" style={{ textShadow: '0 1px 3px rgba(0,0,0,0.5)' }}>
                {profile.occupation}
              </p>
            )}
          </div>
        </div>

        {/* Footer: shared interests + chat */}
        <div className="p-2.5 space-y-2">
          {sharedInterests.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {sharedInterests.slice(0, 2).map(interest => (
                <InterestPill
                  key={interest}
                  label={interest}
                  emoji={getInterestEmoji(interest)}
                  shared
                  size="sm"
                />
              ))}
              {sharedInterests.length > 2 && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-secondary text-muted-foreground">
                  +{sharedInterests.length - 2}
                </span>
              )}
            </div>
          ) : (
            <p className="text-[11px] text-muted-foreground italic">לחיצה לפתיחת שיחה</p>
          )}

          <motion.button
            type="button"
            whileTap={{ scale: 0.95 }}
            onClick={onChat}
            disabled={pending}
            aria-label={`פתיחת צ׳אט עם ${profile.first_name || 'משתמש'}`}
            className="w-full h-9 rounded-full text-[13px] font-semibold text-white inline-flex items-center justify-center gap-1.5 transition-all disabled:opacity-70 disabled:cursor-default"
            style={{
              background: isMember
                ? 'linear-gradient(135deg, #7C3AED 0%, #9333EA 100%)'
                : 'hsl(var(--secondary))',
              color: isMember ? 'white' : 'hsl(var(--muted-foreground))',
              boxShadow: isMember ? '0 2px 8px rgba(124,58,237,0.25)' : 'none',
            }}
          >
            {pending ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <MessageCircle size={14} />
            )}
            צ׳אט
          </motion.button>
        </div>
      </div>
    </motion.article>
  );
}
