import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Heart, Sparkles, Zap, Rocket } from 'lucide-react';
import { LumaSpin } from '@/components/ui/luma-spin';
import ProfileCard from '@/components/clicks/ProfileCard';
import ClicksFeedSkeleton from '@/components/clicks/ClicksFeedSkeleton';
import IcebreakerSheet from '@/components/clicks/IcebreakerSheet';
import FullProfileModal from '@/components/clicks/FullProfileModal';
import { useCurrentUser, SupabaseProfile } from '@/hooks/useCurrentUser';
import { useClicksFeed, ClickFeedItem } from '@/hooks/useClicksFeed';
import { useEventClicksTab } from '@/hooks/useEventClicksTab';
import { useCompatibilityLayer } from '@/hooks/useCompatibilityLayer';
import { useNavigate } from 'react-router-dom';
import { getUnreadMessageFromUserIds, partnerPreviewFromProfile } from '@/services/chat';
import { CHAT_UNREAD_REFRESH_EVENT, notifyChatUnreadRefresh } from '@/contexts/ChatUnreadContext';
import { recordProfileSwipe, SwipeAction } from '@/services/clicksSwipe';
import { recordBoost } from '@/services/clickActions';
import { toast } from 'sonner';

export default function ClicksPage() {
  const navigate = useNavigate();
  const { profile: myProfile, authId, role, loading: userLoading } = useCurrentUser();
  const isMember = role === 'member';
  const [tab, setTab] = useState<'general' | 'event'>('general');
  /** חובה להשתמש ב-authId מהסשן — לא ב-myProfile.user_id: אחרת כשטעינת הפרופיל מתעכבת הפיד יוצא ריק לצמיתות */
  const { items, loading: feedLoading, error: feedError, refresh, removeFromFeed } = useClicksFeed(authId, myProfile);
  const {
    items: eventTabItems,
    loading: eventTabLoading,
    emptyMessage: eventTabEmptyMessage,
    eventName: eventTabEventName,
    refresh: refreshEventTab,
    removeFromFeed: removeFromEventTab,
  } = useEventClicksTab(authId);
  const matchByUserId = useCompatibilityLayer(authId, items);
  const eventMatchByUserId = useCompatibilityLayer(authId, eventTabItems);
  const loading =
    (!authId && userLoading) || (tab === 'general' ? feedLoading : eventTabLoading);
  const [swipeBusyUserId, setSwipeBusyUserId] = useState<string | null>(null);

  const feedRef = useRef<HTMLDivElement>(null);
  const [boosting, setBoosting] = useState(false);

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

  const handleSwipe = useCallback(
    async (toUserId: string, action: SwipeAction) => {
      if (!isMember) {
        toast('לייק ודילוג זמינים לחברי קהילה בלבד', { icon: '🔒' });
        return;
      }

      const logLabel =
        action === 'pass' ? 'CLICKS PASS CLICKED' : action === 'like' ? 'CLICKS LIKE CLICKED' : 'CLICKS SUPER LIKE CLICKED';
      console.info(logLabel, { toUserId });

      const removeFromActiveFeed = tab === 'general' ? removeFromFeed : removeFromEventTab;

      try {
        setSwipeBusyUserId(toUserId);
        removeFromActiveFeed(toUserId);
        setProfileOpen(false);

        const r = await recordProfileSwipe(toUserId, action);
        console.info('CLICKS ACTION SAVED', { toUserId, action, mutual: r.mutual });

        if (r.mutual) {
          if (r.chat_id) {
            toast.success('יש התאמה! עוברים לצ׳אט');
            notifyChatUnreadRefresh();
            navigate(`/chats/${r.chat_id}`);
          } else {
            toast.error('נוצרה התאמה אך לא נמצא צ׳אט. נסו שוב או פתחו הודעה מהרשימה.');
          }
        }

        void (tab === 'general' ? refresh(true) : refreshEventTab(true));
      } catch (e) {
        console.warn('CLICKS ACTION FAILED', { toUserId, action, error: e });
        const msg = e instanceof Error ? e.message : 'הפעולה נכשלה. נסה/י שוב';
        toast.error(msg);
        void (tab === 'general' ? refresh(true) : refreshEventTab(true));
      } finally {
        setSwipeBusyUserId(null);
      }
    },
    [isMember, refresh, refreshEventTab, tab, navigate, removeFromFeed, removeFromEventTab],
  );

  const handleBoost = useCallback(async () => {
    if (!isMember) {
      toast('לא ניתן לבצע פעולה זו כרגע', { icon: '🔒' });
      return;
    }
    setBoosting(true);
    try {
      await recordBoost();
      toast.success('בוצע בהצלחה');
      await refresh();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'הפעולה נכשלה. נסה/י שוב';
      toast.error(msg);
    } finally {
      setBoosting(false);
    }
  }, [isMember, refresh]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    const refreshPromise = tab === 'general' ? refresh() : refreshEventTab();
    refreshPromise.finally(() => {
      setRefreshing(false);
      setPullY(0);
      if (authId && feedUserIds.length > 0) {
        getUnreadMessageFromUserIds(authId, feedUserIds).then(setUnreadFromUser);
      }
    });
  }, [tab, refresh, refreshEventTab, authId, feedUserIds, feedUserIds.length]);

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

  const activeItems = tab === 'general' ? items : eventTabItems;
  const activeMatchByUserId = tab === 'general' ? matchByUserId : eventMatchByUserId;
  const displayItems = activeItems;

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

        {isMember && (
          <div className="flex justify-center mt-3">
            <button
              type="button"
              onClick={handleBoost}
              disabled={boosting}
              className="inline-flex items-center gap-1.5 rounded-full gradient-primary text-primary-foreground px-4 py-1.5 text-sm font-medium active:scale-[0.97] transition-transform disabled:opacity-50"
            >
              <Rocket size={16} />
              {boosting ? '...' : 'בוסט'}
            </button>
          </div>
        )}
      </div>

      {/* New clicks counter */}
      {!loading && tab === 'general' && items.length > 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center justify-center gap-1.5 py-2">
          <Zap size={16} className="text-accent" />
          <span className="text-sm font-medium text-muted-foreground">
            {items.length} קליקים חדשים היום
          </span>
        </motion.div>
      )}

      {!loading && tab === 'event' && eventTabEventName && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center justify-center gap-1.5 py-2 px-4">
          <span className="text-sm font-medium text-muted-foreground text-center">
            התאמות ל{eventTabEventName}
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
          ) : tab === 'general' && feedError ? (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center py-20">
              <div className="relative mx-auto mb-6 w-24 h-24 flex items-center justify-center">
                <span className="absolute inset-0 rounded-full bg-gradient-to-br from-destructive/15 to-warning/15 animate-breathe" />
                <Heart size={42} className="relative text-destructive" />
              </div>
              <p className="text-[24px] text-h1-premium text-foreground">לא הצלחנו לטעון קליקים</p>
              <p className="text-[15px] text-muted-foreground mt-2 max-w-[320px] mx-auto leading-relaxed">{feedError}</p>
              <button
                type="button"
                onClick={() => void refresh()}
                className="mt-5 rounded-full px-5 py-2.5 text-sm font-semibold bg-primary text-primary-foreground"
              >
                נסו שוב
              </button>
            </motion.div>
          ) : displayItems.length === 0 ? (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center py-20">
              <div className="relative mx-auto mb-6 w-24 h-24 flex items-center justify-center">
                <span className="absolute inset-0 rounded-full bg-gradient-to-br from-primary/15 to-accent/15 animate-breathe" />
                <span className="absolute -top-3 -left-4 w-12 h-12 rounded-full blur-2xl" style={{ background: 'rgba(236,72,153,0.18)' }} />
                <span className="absolute -bottom-2 -right-3 w-10 h-10 rounded-full blur-2xl" style={{ background: 'rgba(124,58,237,0.18)' }} />
                <Heart size={42} className="relative text-primary" fill="currentColor" />
              </div>
              <p className="text-[24px] text-h1-premium text-foreground">
                {tab === 'event' ? (eventTabEmptyMessage || 'אין אירוע קרוב רשום') : 'עוד אין קליקים'}
              </p>
              {tab === 'general' && (
                <p className="text-[15px] text-muted-foreground mt-2 max-w-[300px] mx-auto leading-relaxed">
                  נחפש קודם אנשים באותה תחום חיים ועם עניינים משותפים, ואז נרחיב בהדרגה לכל חברי הקהילה הזמינים.
                </p>
              )}
            </motion.div>
          ) : (
            <div className="space-y-6">
              {displayItems.map((item, i) => (
                <ProfileCard
                  key={item.profile.id}
                  profile={item.profile}
                  compatibilityScore={item.compatibilityScore}
                  sharedInterests={item.sharedInterests}
                  isProfilePartial={item.isProfilePartial}
                  index={i}
                  isMember={isMember}
                  hasUnreadDm={!!unreadFromUser[item.profile.user_id]}
                  swipeBusy={swipeBusyUserId === item.profile.user_id}
                  onSwipe={(action) => handleSwipe(item.profile.user_id, action)}
                  matchEnrichment={activeMatchByUserId[item.profile.user_id] ?? null}
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
          swipeBusy={swipeBusyUserId === profileTarget.profile.user_id}
          onSwipe={(action) => handleSwipe(profileTarget.profile.user_id, action)}
          matchEnrichment={matchByUserId[profileTarget.profile.user_id] ?? null}
        />
      )}
    </div>
  );
}
