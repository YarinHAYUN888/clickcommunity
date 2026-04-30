import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { X, MessageCircle, Search, Users, Lock, Loader2 } from 'lucide-react';
import { createOrGetDm } from '@/services/chat';
import { toast } from 'sonner';

export interface AttendeeProfile {
  user_id: string;
  first_name: string | null;
  avatar_url: string | null;
  photos: string[] | null;
  gender: string | null;
}

interface AttendeesModalProps {
  open: boolean;
  onClose: () => void;
  attendees: AttendeeProfile[];
  currentUserId: string;
  isMember: boolean;
  eventName?: string;
}

export default function AttendeesModal({
  open,
  onClose,
  attendees,
  currentUserId,
  isMember,
  eventName,
}: AttendeesModalProps) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [pendingDmFor, setPendingDmFor] = useState<string | null>(null);

  // Body scroll lock + Escape close
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', handler);
    };
  }, [open, onClose]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return attendees;
    return attendees.filter(a =>
      (a.first_name || '').toLowerCase().includes(q),
    );
  }, [attendees, query]);

  const handleStartChat = async (otherUserId: string) => {
    if (!isMember) {
      toast('שליחת הודעות זמינה לחברי קהילה בלבד', { icon: '🔒' });
      return;
    }
    if (otherUserId === currentUserId) return;
    if (pendingDmFor) return;
    setPendingDmFor(otherUserId);
    try {
      const result = await createOrGetDm(otherUserId);
      const chatId = result?.chat_id || result?.id;
      if (!chatId) throw new Error('no_chat_id');
      onClose();
      navigate(`/chats/${chatId}`);
    } catch (err) {
      console.error('Failed to start DM:', err);
      toast.error('לא הצלחנו לפתוח צ׳אט. נסו שוב.');
    } finally {
      setPendingDmFor(null);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[80] bg-black/50 backdrop-blur-sm"
            onClick={onClose}
            aria-hidden
          />
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed inset-x-0 bottom-0 z-[81] bg-card rounded-t-3xl overflow-hidden flex flex-col"
            style={{ height: '85vh', maxWidth: 560, margin: '0 auto' }}
            role="dialog"
            aria-modal="true"
            aria-label={`משתתפי האירוע${eventName ? ` ${eventName}` : ''}`}
          >
            {/* Drag handle */}
            <div className="flex justify-center pt-2 pb-1 shrink-0">
              <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
            </div>

            {/* Header */}
            <div className="px-5 pt-2 pb-3 flex items-center justify-between gap-3 shrink-0 border-b border-border/40">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                  <Users size={16} />
                </div>
                <div>
                  <h2 className="font-bold text-[16px] text-foreground leading-tight">מי מגיע?</h2>
                  <p className="text-[12px] text-muted-foreground">
                    {attendees.length} משתתפים
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="סגור"
                className="w-9 h-9 rounded-full bg-secondary flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Search */}
            {attendees.length > 6 && (
              <div className="px-5 pt-3 pb-2 shrink-0">
                <div
                  className="flex items-center h-11 rounded-full px-4 gap-2 bg-secondary"
                  style={{ border: '1px solid hsl(var(--border))' }}
                >
                  <Search size={16} className="text-muted-foreground shrink-0" />
                  <input
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    placeholder="חיפוש לפי שם"
                    className="flex-1 h-full bg-transparent outline-none text-sm placeholder:text-muted-foreground/60"
                  />
                  {query && (
                    <button
                      type="button"
                      onClick={() => setQuery('')}
                      aria-label="נקה חיפוש"
                      className="text-muted-foreground/70 hover:text-foreground transition-colors"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Member-gating notice */}
            {!isMember && (
              <div className="mx-5 mt-3 mb-1 p-3 rounded-2xl flex items-start gap-2 shrink-0"
                style={{
                  background: 'rgba(124,58,237,0.06)',
                  border: '1px solid rgba(124,58,237,0.18)',
                }}
              >
                <Lock size={16} className="text-primary mt-[2px] shrink-0" />
                <div>
                  <p className="text-[13px] font-medium text-foreground">פתיחת צ׳אט זמינה לחברי קהילה</p>
                  <button
                    type="button"
                    onClick={() => { onClose(); navigate('/subscription'); }}
                    className="text-[12px] text-primary font-semibold underline mt-0.5"
                  >
                    למידע על מנוי
                  </button>
                </div>
              </div>
            )}

            {/* List */}
            <div className="flex-1 overflow-y-auto px-2 py-2">
              {filtered.length === 0 ? (
                <div className="text-center py-12 text-sm text-muted-foreground">
                  {query ? 'לא נמצאו תוצאות' : 'עדיין אין נרשמים'}
                </div>
              ) : (
                <ul className="space-y-1">
                  {filtered.map((a, i) => {
                    const isSelf = a.user_id === currentUserId;
                    const photo = a.avatar_url || a.photos?.[0];
                    const isPending = pendingDmFor === a.user_id;

                    return (
                      <motion.li
                        key={a.user_id}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.2, delay: Math.min(i * 0.02, 0.4) }}
                        className="flex items-center gap-3 px-3 py-2.5 rounded-2xl hover:bg-muted/40 transition-colors"
                      >
                        <div className="w-11 h-11 rounded-full overflow-hidden bg-muted flex items-center justify-center shrink-0 border border-border/50">
                          {photo ? (
                            <img
                              src={photo}
                              alt={a.first_name || 'משתתפ/ת'}
                              className="w-full h-full object-cover"
                              loading="lazy"
                              draggable={false}
                            />
                          ) : (
                            <span className="text-base font-semibold text-muted-foreground">
                              {(a.first_name || '?').charAt(0)}
                            </span>
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-[15px] text-foreground truncate">
                            {a.first_name || 'משתמש/ת'}
                            {isSelf && (
                              <span className="text-[11px] font-normal text-muted-foreground mr-1.5">(אתה)</span>
                            )}
                          </p>
                        </div>

                        {!isSelf && (
                          <button
                            type="button"
                            onClick={() => handleStartChat(a.user_id)}
                            disabled={isPending || !isMember}
                            aria-label={`פתיחת צ׳אט עם ${a.first_name || 'משתמש'}`}
                            className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-full text-[13px] font-semibold transition-all disabled:cursor-not-allowed"
                            style={{
                              background: isMember
                                ? 'linear-gradient(135deg, #7C3AED 0%, #9333EA 100%)'
                                : 'hsl(var(--secondary))',
                              color: isMember ? 'white' : 'hsl(var(--muted-foreground))',
                              opacity: isPending ? 0.7 : 1,
                              boxShadow: isMember ? '0 2px 8px rgba(124,58,237,0.25)' : 'none',
                            }}
                          >
                            {isPending ? (
                              <Loader2 size={14} className="animate-spin" />
                            ) : (
                              <MessageCircle size={14} />
                            )}
                            צ׳אט
                          </button>
                        )}
                      </motion.li>
                    );
                  })}
                </ul>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
