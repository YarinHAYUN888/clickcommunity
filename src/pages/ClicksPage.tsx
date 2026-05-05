import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Heart, Sparkles, Zap } from 'lucide-react';
import { LumaSpin } from '@/components/ui/luma-spin';
import ProfileCard from '@/components/clicks/ProfileCard';
import ClicksFeedSkeleton from '@/components/clicks/ClicksFeedSkeleton';
import IcebreakerSheet from '@/components/clicks/IcebreakerSheet';
import FullProfileModal from '@/components/clicks/FullProfileModal';
import { useCurrentUser, SupabaseProfile } from '@/hooks/useCurrentUser';
import { useClicksFeed, ClickFeedItem } from '@/hooks/useClicksFeed';
import { useNavigate } from 'react-router-dom';
import { getUnreadMessageFromUserIds, partnerPreviewFromProfile } from '@/services/chat';
import { CHAT_UNREAD_REFRESH_EVENT } from '@/contexts/ChatUnreadContext';

export default function ClicksPage() {
  const navigate = useNavigate();
  const { profile: myProfile, authId, role, loading: userLoading } = useCurrentUser();
  const isMember = role === 'member';
  const myInterests = myProfile?.interests || [];
  /** חובה להשתמש ב-authId מהסשן — לא ב-myProfile.user_id: אחרת כשטעינת הפרופיל מתעכבת הפיד יוצא ריק לצמיתות */
  const { items, loading: feedLoading, refresh } = useClicksFeed(authId, myInterests);
  const loading = userLoading || feedLoading;

  const [tab, setTab] = useState<'general' | 'event'>('general');
  const feedRef = useRef<HTMLDivElement>(null);

  // Icebreaker state
  const [icebreakerOpen, setIcebreakerOpen] = useState(false);
  const [icebreakerTarget, setIcebreakerTarget] = useState<ClickFeedItem | null>(null);

  // Full profile modal state
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileTarget, setProfileTarget] = useState<ClickFeedItem | null>(null);

  // Pull to refresh
  const [refreshing, setRefreshing] = useState(false);
  const [pullY, setPullY] = useState(0);
  const touchStartY = useRef(0);

  const feedUserIds = useMemo(() => items.map((i) => i.profile.user_id), [items]);
  const feedUserIdsKey = feedUserIds.join(',');

  const [unreadFromUser, setUnreadFromUser] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!authId || feedUserIds.length === 0) {
      setUnreadFromUser({});
      return;
    }
    let cancelled = false;
    getUnreadMessageFromUserIds(authId, feedUserIds).then((m) => {
      if (!cancelled) setUnreadFromUser(m);
    });
    return () => {
      cancelled = true;
    };
  }, [authId, feedUserIdsKey]);

  useEffect(() => {
    if (!authId || feedUserIds.length === 0) return;
    const refresh = () => {
      getUnreadMessageFromUserIds(authId, feedUserIds).then(setUnreadFromUser);
    };
    window.addEventListener(CHAT_UNREAD_REFRESH_EVENT, refresh);
    const iv = window.setInterval(() => {
      if (document.visibilityState === 'visible') refresh();
    }, 22000);
    return () => {
      window.removeEventListener(CHAT_UNREAD_REFRESH_EVENT, refresh);
      window.clearInterval(iv);
    };
  }, [authId, feedUserIdsKey, feedUserIds.length]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    refresh().finally(() => {
      setRefreshing(false);
      setPullY(0);
      if (authId && feedUserIds.length > 0) {
        getUnreadMessageFromUserIds(authId, feedUserIds).then(setUnreadFromUser);
      }
    });
  }, [refresh, authId, feedUserIds, feedUserIds.length]);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (feedRef.current && feedRef.current.scrollTop === 0) {
      const diff = e.touches[0].clientY - touchStartY.current;
      if (diff > 0) setPullY(Math.min(diff * 0.4, 80));
    }
  };

  const handleTouchEnd = () => {
    if (pullY > 50) handleRefresh();
    else setPullY(0);
  };

  // For now, all clicks are "general" — event tab will be populated when events system is connected
  const displayItems = tab === 'general' ? items : [];

  return (
    <div className="min-h-screen gradient-bg pb-24">
      {/* Header */}
      <div className="sticky top-0 z-40 glass-strong px-4 pt-[env(safe-area-inset-top)] pb-3">
        <div className="flex items-center justify-center gap-2 pt-3 mb-3">
          <Sparkles size={22} className="text-accent" />
          <h1 className="text-2xl md:text-3xl text-h1-premium text-foreground">הקליקים שלך</h1>
        </div>

        {/* Tab toggle */}
        <div className="flex justify-center">
          <div className="relative flex gap-0 bg-secondary rounded-full p-1">
            <motion.div
              layoutId="tab-indicator"
              className="absolute top-1 bottom-1 bg-card rounded-full shadow-sm"
              style={{
                width: isMember ? '50%' : '100%',
                ...(tab === 'general' ? { right: 4 } : { left: 4 }),
              }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            />
            <button
              onClick={() => setTab('general')}
              className={`relative z-10 px-5 py-2 rounded-full text-[15px] font-medium transition-colors ${tab === 'general' ? 'text-primary font-semibold' : 'text-muted-foreground'}`}
            >
              כללי
            </button>
            {isMember && (
              <button
                onClick={() => setTab('event')}
                className={`relative z-10 px-5 py-2 rounded-full text-[15px] font-medium transition-colors ${tab === 'event' ? 'text-primary font-semibold' : 'text-muted-foreground'}`}
              >
                לאירוע הקרוב
              </button>
            )}
          </div>
        </div>
      </div>

      {/* New clicks counter */}
      {!loading && items.length > 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center justify-center gap-1.5 py-2">
          <Zap size={16} className="text-accent" />
          <span className="text-sm font-medium text-muted-foreground">
            {items.length} קליקים חדשים היום
          </span>
        </motion.div>
      )}

      {/* Pull to refresh indicator */}
      <AnimatePresence>
        {(pullY > 10 || refreshing) && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1, y: pullY > 50 ? 0 : -10 }} exit={{ opacity: 0 }} className="flex justify-center py-2">
            <LumaSpin size={40} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Feed */}
      <div ref={feedRef} className="px-4 md:px-6 lg:px-8 pt-2" onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}>
        <div className="max-w-[560px] mx-auto">
          {loading ? (
            <ClicksFeedSkeleton />
          ) : displayItems.length === 0 ? (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center py-20">
              <div className="relative mx-auto mb-6 w-24 h-24 flex items-center justify-center">
                <span className="absolute inset-0 rounded-full bg-gradient-to-br from-primary/15 to-accent/15 animate-breathe" />
                <span className="absolute -top-3 -left-4 w-12 h-12 rounded-full blur-2xl" style={{ background: 'rgba(236,72,153,0.18)' }} />
                <span className="absolute -bottom-2 -right-3 w-10 h-10 rounded-full blur-2xl" style={{ background: 'rgba(124,58,237,0.18)' }} />
                <Heart size={42} className="relative text-primary" fill="currentColor" />
              </div>
              <p className="text-[24px] text-h1-premium text-foreground">עוד אין קליקים</p>
              <p className="text-[15px] text-muted-foreground mt-2 max-w-[280px] mx-auto leading-relaxed">
                ברגע שמשתמשים מתאימים (פעילים באותו עולם קהילה) עם תמונה בפרופיל יופיעו כאן.
                משתמשים שממתינים לאישור מנהל לא נכללים בפיד עד לאישור.
              </p>
            </motion.div>
          ) : (
            <div className="space-y-6">
              {displayItems.map((item, i) => (
                <ProfileCard
                  key={item.profile.id}
                  profile={item.profile}
                  compatibilityScore={item.compatibilityScore}
                  sharedInterests={item.sharedInterests}
                  index={i}
                  isMember={isMember}
                  hasUnreadDm={!!unreadFromUser[item.profile.user_id]}
                  onViewProfile={() => { setProfileTarget(item); setProfileOpen(true); }}
                  onIcebreaker={() => { setIcebreakerTarget(item); setIcebreakerOpen(true); }}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Icebreaker Sheet */}
      {icebreakerTarget && (
        <IcebreakerSheet
          open={icebreakerOpen}
          onClose={() => setIcebreakerOpen(false)}
          targetProfile={icebreakerTarget.profile}
          sharedInterests={icebreakerTarget.sharedInterests}
          onSend={(msg) =>
            navigate(`/chats/new-${icebreakerTarget.profile.user_id}`, {
              state: {
                icebreaker: msg,
                partnerPreview: partnerPreviewFromProfile(icebreakerTarget.profile),
              },
            })
          }
        />
      )}

      {/* Full Profile Modal */}
      {profileTarget && (
        <FullProfileModal
          open={profileOpen}
          onClose={() => setProfileOpen(false)}
          profile={profileTarget.profile}
          compatibilityScore={profileTarget.compatibilityScore}
          sharedInterests={profileTarget.sharedInterests}
          isMember={isMember}
        />
      )}
    </div>
  );
}
