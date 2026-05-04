import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageCirclePlus, X, Loader2 } from 'lucide-react';
import GlassCard from '@/components/clicks/GlassCard';
import { createAdminGroupChat, getAdminUsers } from '@/services/admin';
import { toast } from 'sonner';

export function AdminCreateGroupChatSection() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [search, setSearch] = useState('');
  const [users, setUsers] = useState<{ user_id: string; first_name: string | null; phone?: string | null }[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);

  const loadUsers = useCallback(async () => {
    setLoadingUsers(true);
    try {
      const data = await getAdminUsers(undefined, search.trim() || undefined, 1, 80);
      setUsers(data.users || []);
    } catch (e) {
      console.error(e);
      toast.error('לא ניתן לטעון משתמשים');
    } finally {
      setLoadingUsers(false);
    }
  }, [search]);

  useEffect(() => {
    if (!open) return;
    void loadUsers();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => void loadUsers(), 320);
    return () => clearTimeout(t);
  }, [search, open, loadUsers]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleCreate() {
    const name = groupName.trim();
    if (!name || selected.size < 2) {
      toast.error('יש לבחור לפחות שני משתמשים ולתת שם לקבוצה');
      return;
    }
    setSubmitting(true);
    try {
      const res = await createAdminGroupChat(name, [...selected]);
      toast.success('צ׳אט קבוצתי נוצר');
      setOpen(false);
      setGroupName('');
      setSelected(new Set());
      setSearch('');
      if (res?.chat_id) navigate(`/chats/${res.chat_id}`);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'יצירת הקבוצה נכשלה';
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <motion.div whileTap={{ scale: 0.98 }}>
        <GlassCard
          variant="strong"
          className="p-4 h-20 flex items-center gap-3 cursor-pointer mb-3"
          onClick={() => setOpen(true)}
        >
          <MessageCirclePlus size={28} className="text-primary flex-shrink-0" />
          <span className="font-semibold text-foreground text-sm flex-1">יצירת צ׳אט קבוצתי</span>
        </GlassCard>
      </motion.div>

      <AnimatePresence>
        {open && (
          <motion.div
            className="fixed inset-0 z-[100] flex items-end md:items-center justify-center p-0 md:p-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <button
              type="button"
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
              aria-label="סגירה"
              onClick={() => !submitting && setOpen(false)}
            />
            <motion.div
              dir="rtl"
              className="relative w-full max-w-lg max-h-[85vh] overflow-hidden rounded-t-3xl md:rounded-3xl bg-card border border-border shadow-2xl flex flex-col"
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 24, opacity: 0 }}
              transition={{ type: 'spring', damping: 26, stiffness: 280 }}
            >
              <div className="flex items-center justify-between px-5 py-4 border-b border-border">
                <h2 className="text-lg font-bold text-foreground">יצירת צ׳אט קבוצתי</h2>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => setOpen(false)}
                  className="p-2 rounded-xl hover:bg-muted/80 transition-colors disabled:opacity-50"
                >
                  <X size={20} className="text-muted-foreground" />
                </button>
              </div>

              <div className="p-4 space-y-3 overflow-y-auto flex-1">
                <label className="block text-sm font-medium text-foreground">שם הקבוצה</label>
                <input
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  placeholder="למשל: קבוצת תיאום אירוע"
                  className="w-full rounded-xl border border-border bg-muted/40 px-3 py-2 text-sm text-foreground"
                />

                <label className="block text-sm font-medium text-foreground pt-2">חיפוש משתמשים</label>
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="שם או טלפון"
                  className="w-full rounded-xl border border-border bg-muted/40 px-3 py-2 text-sm text-foreground"
                />

                <p className="text-xs text-muted-foreground">
                  נבחרו {selected.size}. חובה לפחות 2 משתמשים מאותו עולם (רגיל / צל).
                </p>

                <div className="rounded-xl border border-border/60 max-h-[240px] overflow-y-auto divide-y divide-border/40">
                  {loadingUsers ? (
                    <div className="flex justify-center py-8">
                      <Loader2 className="animate-spin text-primary" size={28} />
                    </div>
                  ) : users.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-6">לא נמצאו משתמשים</p>
                  ) : (
                    users.map((u) => (
                      <label
                        key={u.user_id}
                        className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-muted/40"
                      >
                        <input
                          type="checkbox"
                          checked={selected.has(u.user_id)}
                          onChange={() => toggle(u.user_id)}
                          className="rounded border-border"
                        />
                        <span className="text-sm text-foreground flex-1 truncate">
                          {u.first_name || 'ללא שם'}
                          {u.phone ? (
                            <span className="text-muted-foreground mr-2 text-xs">{u.phone}</span>
                          ) : null}
                        </span>
                      </label>
                    ))
                  )}
                </div>
              </div>

              <div className="p-4 border-t border-border flex gap-2 justify-end">
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => setOpen(false)}
                  className="px-4 py-2 rounded-xl text-sm border border-border hover:bg-muted/60 disabled:opacity-50"
                >
                  ביטול
                </button>
                <button
                  type="button"
                  disabled={submitting || selected.size < 2 || !groupName.trim()}
                  onClick={() => void handleCreate()}
                  className="px-4 py-2 rounded-xl text-sm font-semibold bg-primary text-primary-foreground disabled:opacity-50 inline-flex items-center gap-2"
                >
                  {submitting ? <Loader2 className="animate-spin" size={18} /> : null}
                  צור צ׳אט
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
