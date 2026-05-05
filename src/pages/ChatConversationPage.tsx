import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, Send, Loader2 } from 'lucide-react';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import {
  getChatMessages,
  getDmPartner,
  subscribeToMessages,
  sendMessage,
  markAsRead,
  createOrGetDm,
  MessageRow,
  type ChatLocationState,
} from '@/services/chat';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { notifyChatUnreadRefresh } from '@/contexts/ChatUnreadContext';

function formatMsgTime(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
}

function formatDateSeparator(dateStr: string) {
  const d = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 86400000 && d.getDate() === now.getDate()) return 'היום';
  if (diff < 172800000) return 'אתמול';
  return d.toLocaleDateString('he-IL', { day: 'numeric', month: 'long' });
}

const USER_UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** מסלול מהקליקים: /chats/new-{user_id} — לא מזהה צ'אט אמיתי */
function parseNewDmUserId(routeChatId: string): string | null {
  if (!routeChatId.startsWith('new-')) return null;
  const uid = routeChatId.slice('new-'.length);
  return USER_UUID_RE.test(uid) ? uid : null;
}

function readPartnerPreview(state: unknown): { name: string; avatar: string | null } | null {
  if (!state || typeof state !== 'object') return null;
  const pv = (state as ChatLocationState).partnerPreview;
  if (!pv) return null;
  return {
    name: pv.firstName?.trim() || 'משתמש/ת',
    avatar: pv.photoUrl || null,
  };
}

export default function ChatConversationPage() {
  const { chatId } = useParams<{ chatId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { authId } = useCurrentUser();
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const previewInit = readPartnerPreview(location.state);
  const [partnerName, setPartnerName] = useState(() => previewInit?.name || '');
  const [partnerAvatar, setPartnerAvatar] = useState<string | null>(() => previewInit?.avatar ?? null);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [chatClosed, setChatClosed] = useState(false);
  const [chatExpired, setChatExpired] = useState(false);
  const [loading, setLoading] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const p = readPartnerPreview(location.state);
    if (p) {
      setPartnerName(p.name);
      setPartnerAvatar(p.avatar);
    }
  }, [location.state]);

  useEffect(() => {
    if (!chatId) return;

    let channel: ReturnType<typeof subscribeToMessages> | undefined;
    let cancelled = false;

    async function init() {
      if (!authId) {
        setLoading(false);
        return;
      }

      if (chatId.startsWith('new-')) {
        const otherFromClicks = parseNewDmUserId(chatId);
        if (!otherFromClicks) {
          toast.error('קישור צ׳אט לא תקין');
          navigate('/chats', { replace: true });
          setLoading(false);
          return;
        }
        setLoading(true);
        try {
          const ice =
            typeof location.state === 'object' &&
            location.state !== null &&
            'icebreaker' in location.state &&
            typeof (location.state as { icebreaker?: string }).icebreaker === 'string'
              ? (location.state as { icebreaker?: string }).icebreaker!.trim()
              : '';
          const result = await createOrGetDm(otherFromClicks, ice || undefined);
          if (cancelled) return;
          const realId = result?.chat_id;
          if (!realId) throw new Error('לא התקבל מזהה צ׳אט מהשרת');
          const st = location.state;
          const nextState =
            typeof st === 'object' && st !== null ? { ...(st as object), icebreaker: undefined } : {};
          navigate(`/chats/${realId}`, { replace: true, state: nextState });
          return;
        } catch (err) {
          console.error('Open DM error:', err);
          toast.error(err instanceof Error ? err.message : 'לא ניתן לפתוח צ׳אט פרטי');
          if (!cancelled) navigate('/chats', { replace: true });
          setLoading(false);
          return;
        }
      }


      setLoading(true);
      try {
        const { data: chatData } = await supabase
          .from('chats')
          .select('*')
          .eq('id', chatId)
          .single();

        if (chatData) {
          setChatClosed(chatData.is_closed || false);
          setChatExpired(chatData.expires_at ? new Date(chatData.expires_at) < new Date() : false);
          if (chatData.type === 'group' && chatData.display_name) {
            setPartnerName(chatData.display_name);
          }
        }

        if (!chatData || chatData.type === 'direct') {
          const partner = await getDmPartner(chatId, authId);
          if (partner) {
            setPartnerName((prev) => partner.first_name?.trim() || prev || 'משתמש/ת');
            setPartnerAvatar((prev) => partner.photos?.[0] || partner.avatar_url || prev);
          }
        }

        const msgs = await getChatMessages(chatId);
        setMessages(msgs);

        markAsRead(chatId)
          .then(() => notifyChatUnreadRefresh())
          .catch(() => {});

        channel = subscribeToMessages(chatId, (newMsg) => {
          setMessages((prev) => {
            if (prev.find((m) => m.id === newMsg.id)) {
              return prev.map((m) => (m.id === newMsg.id ? newMsg : m));
            }
            return [...prev, newMsg];
          });
          markAsRead(chatId)
            .then(() => notifyChatUnreadRefresh())
            .catch(() => {});
        });
      } catch (err) {
        console.error('Chat init error:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void init();

    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, [chatId, authId, navigate, location.state]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = useCallback(async () => {
    if (!input.trim() || !chatId || sending || loading || chatId.startsWith('new-')) return;
    if (!authId) {
      toast.error('יש להתחבר כדי לשלוח הודעות');
      return;
    }
    const text = input.trim();
    setInput('');
    setSending(true);
    try {
      const res = await sendMessage(chatId, text);
      if (res?.message_id && authId) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === res.message_id)) return prev;
          return [
            ...prev,
            {
              id: res.message_id,
              chat_id: chatId,
              sender_id: authId,
              content: text,
              is_system: false,
              is_pinned: false,
              is_deleted: false,
              deleted_by: null,
              read_by: [authId],
              created_at: new Date().toISOString(),
            },
          ];
        });
      }
    } catch (err) {
      console.error('Send error:', err);
      const msg =
        err instanceof Error ? err.message : typeof err === 'object' && err && 'message' in err ? String((err as Error).message) : 'לא ניתן לשלוח את ההודעה';
      toast.error(msg);
      setInput(text);
    } finally {
      setSending(false);
    }
  }, [input, chatId, sending, authId, loading]);

  const isReadOnly = chatClosed || chatExpired;

  // Group messages by date
  const groupedMessages: { date: string; msgs: MessageRow[] }[] = [];
  messages.forEach((msg) => {
    const dateKey = new Date(msg.created_at).toDateString();
    const last = groupedMessages[groupedMessages.length - 1];
    if (last && last.date === dateKey) {
      last.msgs.push(msg);
    } else {
      groupedMessages.push({ date: dateKey, msgs: [msg] });
    }
  });

  return (
    <div className="h-screen flex flex-col bg-background" dir="rtl">
      {/* Header */}
      <div className="sticky top-0 z-40 glass-strong px-4 py-3 flex items-center gap-3 border-b border-border/30">
        <button onClick={() => navigate('/chats')} className="p-1 text-foreground">
          <ArrowRight size={22} />
        </button>
        <div className="w-9 h-9 rounded-full bg-muted overflow-hidden flex-shrink-0">
          {partnerAvatar ? (
            <img src={partnerAvatar} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-muted-foreground text-sm font-semibold">
              {partnerName.charAt(0)}
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm text-foreground truncate">{partnerName}</p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {loading ? (
          <div className="space-y-4 animate-pulse">
            {[1, 2, 3].map((i) => (
              <div key={i} className={`flex ${i % 2 === 0 ? 'justify-start' : 'justify-end'}`}>
                <div className="h-10 bg-muted rounded-2xl w-48" />
              </div>
            ))}
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground text-sm">
            אין הודעות עדיין — שלח/י את ההודעה הראשונה!
          </div>
        ) : (
          groupedMessages.map((group) => (
            <div key={group.date}>
              {/* Date separator */}
              <div className="flex items-center justify-center my-4">
                <span className="text-xs text-muted-foreground bg-secondary px-4 py-1 rounded-full">
                  {formatDateSeparator(group.msgs[0].created_at)}
                </span>
              </div>

              {/* Messages */}
              {group.msgs.map((msg, i) => {
                const isMine = msg.sender_id === authId;
                const isSystem = msg.is_system;

                if (isSystem) {
                  return (
                    <div key={msg.id} className="flex items-center justify-center my-3 gap-2">
                      <div className="h-px flex-1 bg-border/30" />
                      <span className="text-xs text-muted-foreground italic px-2">{msg.content}</span>
                      <div className="h-px flex-1 bg-border/30" />
                    </div>
                  );
                }

                if (msg.is_deleted) {
                  return (
                    <div key={msg.id} className={`flex mb-2 ${isMine ? 'justify-end' : 'justify-start'}`}>
                      <div className="border border-dashed border-border rounded-2xl px-4 py-2.5 max-w-[75%]">
                        <p className="text-sm text-muted-foreground italic">
                          {msg.deleted_by && msg.deleted_by !== msg.sender_id
                            ? 'ההודעה נמחקה ע״י מנהל'
                            : 'ההודעה נמחקה'}
                        </p>
                      </div>
                    </div>
                  );
                }

                return (
                  <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, scale: 0.92, rotate: isMine ? 2 : -2 }}
                    animate={{ opacity: 1, scale: 1, rotate: 0 }}
                    transition={{ type: 'spring', damping: 18, stiffness: 260 }}
                    className={`flex mb-2 ${isMine ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`relative overflow-hidden px-4 py-2.5 max-w-[75%] shine-sweep ${
                        isMine
                          ? 'rounded-[18px_18px_4px_18px] text-primary-foreground shadow-[0_4px_12px_rgba(124,58,237,0.25)]'
                          : 'rounded-[18px_18px_18px_4px] glass-premium text-foreground'
                      }`}
                      style={isMine ? { background: 'linear-gradient(135deg, #7C3AED 0%, #9333EA 60%, #A78BFA 100%)' } : undefined}
                    >
                      {isMine && (
                        <span aria-hidden className="absolute inset-0 pointer-events-none rounded-[inherit]" style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.18), transparent 55%)' }} />
                      )}
                      <p className="relative text-sm leading-relaxed whitespace-pre-wrap break-words">{msg.content}</p>
                      <div className={`relative flex items-center gap-1 mt-1 ${isMine ? 'justify-start' : 'justify-end'}`}>
                        <span className={`text-[10px] ${isMine ? 'text-primary-foreground/60' : 'text-muted-foreground'}`}>
                          {formatMsgTime(msg.created_at)}
                        </span>
                        {isMine && (
                          <motion.span
                            key={msg.read_by?.length || 0}
                            initial={{ scale: 1.4 }}
                            animate={{ scale: 1 }}
                            transition={{ type: 'spring', damping: 12, stiffness: 300 }}
                            className={`text-[10px] font-bold ${msg.read_by && msg.read_by.length > 1 ? 'text-white' : 'text-primary-foreground/60'}`}
                          >
                            {msg.read_by && msg.read_by.length > 1 ? '✓✓' : '✓'}
                          </motion.span>
                        )}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      {isReadOnly ? (
        <div className="px-4 py-3 pb-[env(safe-area-inset-bottom)]">
          <div className="bg-secondary rounded-xl h-12 flex items-center justify-center">
            <span className="text-sm text-muted-foreground font-medium">
              {chatClosed ? 'הצ׳אט נסגר ע״י מנהל' : 'הצ׳אט הסתיים'}
            </span>
          </div>
        </div>
      ) : (
        <div className="glass-strong border-t border-border/30 px-4 py-2 pb-[env(safe-area-inset-bottom)]">
          <div className="flex items-end gap-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder={loading && chatId.startsWith('new-') ? 'פותח צ׳אט…' : 'כתוב/י הודעה…'}
              rows={1}
              disabled={loading && chatId.startsWith('new-')}
              className="flex-1 resize-none bg-muted/50 border border-border/30 rounded-full px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 max-h-24 disabled:opacity-60"
              style={{ minHeight: '40px' }}
            />
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={handleSend}
              disabled={!input.trim() || sending || (loading && chatId.startsWith('new-'))}
              aria-busy={sending}
              className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 transition-colors ${
                input.trim()
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-secondary text-muted-foreground'
              }`}
            >
              {sending ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} className="rotate-180" />}
            </motion.button>
          </div>
        </div>
      )}
    </div>
  );
}
