import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageCircle, Users, Lock, Calendar } from 'lucide-react';
import BottomTabBar from '@/components/clicks/BottomTabBar';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import {
  getDirectChats,
  getGroupChats,
  getDmPartner,
  getLastMessage,
  getUnreadCount,
  getEventForChat,
  ChatRow,
  MessageRow,
} from '@/services/chat';

function formatTime(dateStr: string) {
  const d = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const dayMs = 86400000;

  if (diff < dayMs && d.getDate() === now.getDate()) {
    return d.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
  }
  if (diff < 2 * dayMs) return 'אתמול';
  return `${d.getDate()}.${d.getMonth() + 1}`;
}

interface DmRowData {
  chat: ChatRow;
  partnerName: string;
  partnerAvatar: string | null;
  lastMsg: MessageRow | null;
  unread: number;
}

interface GroupRowData {
  chat: ChatRow;
  eventName: string;
  eventCover: string | null;
  lastMsg: MessageRow | null;
  unread: number;
  expiresAt: string | null;
}

export default function ChatsPage() {
  const navigate = useNavigate();
  const { authId, role, loading: userLoading } = useCurrentUser();
  const [tab, setTab] = useState<'direct' | 'group'>('direct');
  const [dms, setDms] = useState<DmRowData[]>([]);
  const [groups, setGroups] = useState<GroupRowData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authId) return;
    loadChats();
  }, [authId, tab]);

  async function loadChats() {
    setLoading(true);
    try {
      if (tab === 'direct') {
        const chats = await getDirectChats(authId);
        const rows: (DmRowData | null)[] = await Promise.all(
          chats.map(async (chat) => {
            const partner = await getDmPartner(chat.id, authId);
            if (!partner) return null;
            const [lastMsg, unread] = await Promise.all([
              getLastMessage(chat.id),
              getUnreadCount(chat.id, authId),
            ]);
            return {
              chat,
              partnerName: partner.first_name || 'משתמש/ת',
              partnerAvatar: partner.photos?.[0] || partner.avatar_url || null,
              lastMsg,
              unread,
            };
          })
        );
        setDms(rows.filter((r): r is DmRowData => r !== null));
      } else {
        const chats = await getGroupChats(authId);
        const rows: GroupRowData[] = await Promise.all(
          chats.map(async (chat) => {
            const [eventInfo, lastMsg, unread] = await Promise.all([
              chat.event_id ? getEventForChat(chat.event_id) : Promise.resolve(null),
              getLastMessage(chat.id),
              getUnreadCount(chat.id, authId),
            ]);
            return {
              chat,
              eventName: eventInfo?.name || chat.display_name || 'צ׳אט קבוצתי',
              eventCover: eventInfo?.cover_image_url || null,
              lastMsg,
              unread,
              expiresAt: chat.expires_at,
            };
          })
        );
        setGroups(rows);
      }
    } catch (err) {
      console.error('Error loading chats:', err);
    } finally {
      setLoading(false);
    }
  }

  // Guest lock screen
  if (!userLoading && role === 'guest') {
    return (
      <div className="min-h-screen gradient-bg pb-24 flex items-center justify-center">
        <div className="text-center px-6">
          <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center mx-auto mb-4">
            <Lock size={32} className="text-primary" />
          </div>
          <h2 className="text-lg font-semibold text-foreground mb-2">הצ׳אטים זמינים לחברי קהילה בלבד</h2>
          <p className="text-sm text-muted-foreground mb-6 max-w-[300px] mx-auto">
            הצטרפו לקהילה כדי לשלוח הודעות ולהשתתף בצ׳אטים קבוצתיים
          </p>
          <button
            onClick={() => navigate('/subscription')}
            className="gradient-primary text-primary-foreground px-6 py-3 rounded-full text-sm font-medium"
          >
            למידע על מנוי
          </button>
        </div>
        <BottomTabBar />
      </div>
    );
  }

  return (
    <div className="min-h-screen gradient-bg pb-24" dir="rtl">
      {/* Header */}
      <div className="sticky top-0 z-40 glass-strong px-6 pt-[env(safe-area-inset-top)] pb-3">
        <h1 className="text-xl text-h1-premium text-foreground pt-4 mb-3">צ׳אטים</h1>
        <div className="flex gap-2">
          <button
            onClick={() => setTab('direct')}
            className={`flex-1 rounded-full py-2.5 text-sm font-medium transition-all relative ${
              tab === 'direct' ? 'gradient-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
            }`}
          >
            הודעות
          </button>
          <button
            onClick={() => setTab('group')}
            className={`flex-1 rounded-full py-2.5 text-sm font-medium transition-all relative ${
              tab === 'group' ? 'gradient-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
            }`}
          >
            קבוצות
          </button>
        </div>
      </div>

      {/* Content */}
      <AnimatePresence mode="wait">
        {loading ? (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="px-4 pt-4 space-y-3"
          >
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-3 p-3">
                <div className="w-12 h-12 rounded-full bg-muted animate-pulse" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-muted rounded animate-pulse w-1/3" />
                  <div className="h-3 bg-muted rounded animate-pulse w-2/3" />
                </div>
              </div>
            ))}
          </motion.div>
        ) : tab === 'direct' ? (
          <motion.div
            key="direct"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
          >
            {dms.length === 0 ? (
              <EmptyState
                icon={<MessageCircle size={56} className="text-primary" />}
                title="אין שיחות עדיין"
                subtitle="שלח/י הודעה לקליק הראשון שלך!"
                ctaText="לקליקים שלי"
                ctaPath="/clicks"
              />
            ) : (
              <div className="divide-y divide-border/30">
                {dms.map((dm, i) => (
                  <motion.button
                    key={dm.chat.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    onClick={() => navigate(`/chats/${dm.chat.id}`)}
                    className="flex items-center gap-3 w-full px-5 py-3.5 text-right hover:bg-muted/30 transition-colors"
                  >
                    <div className="relative flex-shrink-0">
                      <div className="w-12 h-12 rounded-full bg-muted overflow-hidden">
                        {dm.partnerAvatar ? (
                          <img src={dm.partnerAvatar} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-muted-foreground font-semibold">
                            {dm.partnerName.charAt(0)}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="font-semibold text-sm text-foreground truncate">{dm.partnerName}</span>
                        {dm.lastMsg && (
                          <span className="text-xs text-muted-foreground mr-2 flex-shrink-0">
                            {formatTime(dm.lastMsg.created_at)}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center justify-between">
                        <p className="text-sm text-muted-foreground truncate">
                          {dm.lastMsg?.content || 'אין הודעות'}
                        </p>
                        {dm.unread > 0 && (
                          <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            className="w-5 h-5 rounded-full bg-primary flex items-center justify-center flex-shrink-0 mr-2"
                          >
                            <span className="text-[10px] font-bold text-primary-foreground">{dm.unread}</span>
                          </motion.div>
                        )}
                      </div>
                    </div>
                  </motion.button>
                ))}
              </div>
            )}
          </motion.div>
        ) : (
          <motion.div
            key="group"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
          >
            {groups.length === 0 ? (
              <EmptyState
                icon={<Users size={56} className="text-primary" />}
                title="אין צ׳אטים קבוצתיים"
                subtitle="כשתירשם/י לאירוע, הצ׳אט הקבוצתי יופיע כאן"
                ctaText="לאירועים"
                ctaPath="/events"
              />
            ) : (
              <div className="divide-y divide-border/30">
                {groups.map((g, i) => {
                  const isExpired = g.expiresAt && new Date(g.expiresAt) < new Date();
                  const isClosed = g.chat.is_closed;
                  return (
                    <motion.button
                      key={g.chat.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05 }}
                      onClick={() => navigate(`/chats/${g.chat.id}`)}
                      className={`flex items-center gap-3 w-full px-5 py-3.5 text-right hover:bg-muted/30 transition-colors ${
                        isExpired || isClosed ? 'opacity-50' : ''
                      }`}
                    >
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-accent overflow-hidden flex items-center justify-center flex-shrink-0">
                        {g.eventCover ? (
                          <img src={g.eventCover} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <Calendar size={20} className="text-primary-foreground" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="font-semibold text-sm text-foreground truncate">{g.eventName}</span>
                          {g.lastMsg && (
                            <span className="text-xs text-muted-foreground mr-2 flex-shrink-0">
                              {formatTime(g.lastMsg.created_at)}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground truncate">
                          {isClosed ? 'הצ׳אט נסגר ע״י מנהל' : isExpired ? 'הצ׳אט הסתיים' : g.lastMsg?.content || 'אין הודעות'}
                        </p>
                      </div>
                      {g.unread > 0 && !isExpired && !isClosed && (
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          className="w-5 h-5 rounded-full bg-destructive flex items-center justify-center flex-shrink-0"
                        >
                          <span className="text-[10px] font-bold text-destructive-foreground">{g.unread}</span>
                        </motion.div>
                      )}
                    </motion.button>
                  );
                })}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <BottomTabBar />
    </div>
  );
}

function EmptyState({
  icon,
  title,
  subtitle,
  ctaText,
  ctaPath,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  ctaText: string;
  ctaPath: string;
}) {
  const navigate = useNavigate();
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="text-center py-20 px-6"
    >
      <div className="relative mx-auto mb-6 w-24 h-24 flex items-center justify-center">
        <span className="absolute inset-0 rounded-full bg-gradient-to-br from-primary/15 to-accent/15 animate-breathe" />
        <span className="absolute -top-3 -left-4 w-12 h-12 rounded-full blur-2xl" style={{ background: 'rgba(236,72,153,0.18)' }} />
        <span className="absolute -bottom-2 -right-3 w-10 h-10 rounded-full blur-2xl" style={{ background: 'rgba(124,58,237,0.18)' }} />
        <span className="relative">{icon}</span>
      </div>
      <p className="text-[22px] text-h1-premium text-foreground">{title}</p>
      <p className="text-sm text-muted-foreground mt-1 mb-6">{subtitle}</p>
      <button
        onClick={() => navigate(ctaPath)}
        className="btn-shine-loop gradient-primary text-primary-foreground px-6 py-2.5 rounded-xl text-sm font-semibold shadow-[0_8px_24px_rgba(124,58,237,0.35)]"
      >
        {ctaText}
      </button>
    </motion.div>
  );
}
