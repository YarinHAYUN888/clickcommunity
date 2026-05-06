import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, Search, Loader2, X, User } from 'lucide-react';
import { LumaSpin } from '@/components/ui/luma-spin';
import GlassCard from '@/components/clicks/GlassCard';
import PointsAdjustModal from '@/components/admin/PointsAdjustModal';
import { useAdmin } from '@/contexts/AdminContext';
import { getAdminUsers, performAdminAction } from '@/services/admin';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const filters = [
  { key: '', label: 'כולם' },
  { key: 'guests', label: 'אורחים' },
  { key: 'members', label: 'חברים' },
  { key: 'veterans', label: 'ותיקים' },
  { key: 'ambassadors', label: 'שגרירים' },
  { key: 'suspended', label: 'מושעים' },
];

const roleBadgeColors: Record<string, string> = {
  guest: 'bg-muted text-muted-foreground',
  member: 'bg-primary/10 text-primary',
};

const statusConfig: Record<string, { label: string; bg: string; text: string }> = {
  new: { label: 'חדש 🌱', bg: 'rgba(16,185,129,0.15)', text: 'hsl(var(--success))' },
  veteran: { label: 'ותיק ⭐', bg: 'rgba(124,58,237,0.15)', text: 'hsl(var(--primary))' },
  ambassador: { label: 'שגריר 👑', bg: 'rgba(245,158,11,0.15)', text: 'hsl(var(--warning))' },
};

export default function AdminUsersPage() {
  const navigate = useNavigate();
  const { isSuperUser, loading: adminLoading } = useAdmin();
  const [users, setUsers] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [filter, setFilter] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{ action: string; label: string } | null>(null);
  const [pointsModalOpen, setPointsModalOpen] = useState(false);
  const [ledger, setLedger] = useState<any[]>([]);
  const [capDraft, setCapDraft] = useState('');

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getAdminUsers(filter || undefined, search || undefined, page);
      setUsers(data.users);
      setTotal(data.total);
      setPages(data.pages);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [filter, search, page]);

  useEffect(() => {
    if (adminLoading) return;
    if (!isSuperUser) { navigate('/clicks', { replace: true }); return; }
    fetchUsers();
  }, [adminLoading, isSuperUser, fetchUsers, navigate]);

  useEffect(() => {
    const timer = setTimeout(() => { setPage(1); fetchUsers(); }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    if (!selectedUser) return;
    setCapDraft(selectedUser.referral_cap_override != null ? String(selectedUser.referral_cap_override) : '');
    (async () => {
      const { data, error } = await supabase
        .from('points_history')
        .select('id, type, amount, description, created_at')
        .eq('user_id', selectedUser.user_id)
        .order('created_at', { ascending: false })
        .limit(5);
      if (!error) setLedger(data || []);
    })();
  }, [selectedUser]);

  const doAction = async (action: string, targetId: string, details?: any) => {
    setActionLoading(true);
    try {
      await performAdminAction(action, 'user', targetId, details);
      toast.success('הפעולה בוצעה בהצלחה ✓');
      setSelectedUser(null);
      setConfirmAction(null);
      fetchUsers();
    } catch { toast.error('שגיאה בביצוע הפעולה'); }
    setActionLoading(false);
  };

  return (
    <div className="min-h-screen gradient-bg pb-24">
      <div className="px-4 pt-[env(safe-area-inset-top)]">
        {/* Header */}
        <div className="flex items-center gap-3 pt-4 mb-4">
          <button onClick={() => navigate('/admin')} className="text-primary"><ArrowRight size={24} /></button>
          <h1 className="text-xl font-bold text-foreground">ניהול משתמשים</h1>
        </div>

        {/* Search */}
        <div className="relative mb-3">
          <Search size={20} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="חיפוש לפי שם או טלפון..."
            className="w-full h-12 rounded-2xl bg-card/60 backdrop-blur-sm border border-border/50 pr-10 pl-4 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>

        {/* Filters */}
        <div className="flex gap-2 overflow-x-auto pb-3 scrollbar-hide">
          {filters.map(f => (
            <button
              key={f.key}
              onClick={() => { setFilter(f.key); setPage(1); }}
              className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                filter === f.key ? 'bg-primary text-primary-foreground' : 'bg-primary/10 text-foreground'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* User List */}
        {loading ? (
          <div className="flex justify-center py-12"><LumaSpin size={48} /></div>
        ) : users.length === 0 ? (
          <p className="text-center text-muted-foreground py-8 text-sm">לא נמצאו משתמשים</p>
        ) : (
          <div className="space-y-2">
            {users.map((u) => {
              const statusCfg = statusConfig[u.status] || statusConfig.new;
              return (
                <GlassCard
                  key={u.user_id}
                  variant="strong"
                  className="p-3 cursor-pointer"
                  onClick={() => setSelectedUser(u)}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center overflow-hidden flex-shrink-0">
                      {u.photos?.[0] || u.avatar_url ? (
                        <img src={u.photos?.[0] || u.avatar_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <User size={18} className="text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-foreground text-sm">{u.first_name || 'ללא שם'}</span>
                        <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium ${roleBadgeColors[u.role] || roleBadgeColors.guest}`}>
                          {u.role === 'member' ? 'חבר' : 'אורח'}
                        </span>
                        <span className="px-1.5 py-0.5 rounded-full text-[10px] font-medium" style={{ background: statusCfg.bg, color: statusCfg.text }}>
                          {statusCfg.label}
                        </span>
                        {u.suspended && <span className="px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-destructive/10 text-destructive">מושעה</span>}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {u.phone || 'ללא טלפון'} · {u.events_attended} אירועים · הצטרף/ה {new Date(u.created_at).toLocaleDateString('he-IL')}
                      </div>
                    </div>
                  </div>
                </GlassCard>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {pages > 1 && (
          <div className="flex items-center justify-center gap-4 mt-4 text-sm">
            <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="text-primary disabled:text-muted-foreground">הקודם</button>
            <span className="text-muted-foreground">עמוד {page} מתוך {pages}</span>
            <button disabled={page >= pages} onClick={() => setPage(p => p + 1)} className="text-primary disabled:text-muted-foreground">הבא</button>
          </div>
        )}
      </div>

      {/* User Management Panel */}
      <AnimatePresence>
        {selectedUser && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/40" onClick={() => setSelectedUser(null)} />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="fixed bottom-0 inset-x-0 z-50 max-h-[85vh] overflow-y-auto rounded-t-2xl"
            >
              <GlassCard variant="strong" className="p-5 space-y-4 rounded-t-2xl rounded-b-none min-h-[50vh]">
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-3">
                    <div className="w-16 h-16 rounded-full bg-muted overflow-hidden">
                      {selectedUser.photos?.[0] || selectedUser.avatar_url ? (
                        <img src={selectedUser.photos?.[0] || selectedUser.avatar_url} alt="" className="w-full h-full object-cover" />
                      ) : <User size={28} className="text-muted-foreground w-full h-full flex items-center justify-center" />}
                    </div>
                    <div>
                      <h3 className="font-bold text-foreground text-lg">{selectedUser.first_name || 'ללא שם'}</h3>
                      <p className="text-sm text-muted-foreground">{selectedUser.phone}</p>
                    </div>
                  </div>
                  <button onClick={() => setSelectedUser(null)}><X size={20} className="text-muted-foreground" /></button>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="text-muted-foreground">פרופיל: <span className="text-foreground font-medium">{selectedUser.profile_completion || 0}%</span></div>
                  <div className="text-muted-foreground">אירועים: <span className="text-foreground font-medium">{selectedUser.events_attended}</span></div>
                  <div className="text-muted-foreground col-span-2">נקודות: <span className="text-foreground font-medium">{selectedUser.points ?? 0}</span></div>
                </div>

                {/* Management */}
                <div className="space-y-2 pt-1">
                  <h4 className="text-sm font-semibold text-muted-foreground">ניהול</h4>
                  <button
                    onClick={() => setConfirmAction({ action: 'remove_user', label: 'הסרת משתמש' })}
                    disabled={actionLoading}
                    className="w-full h-11 rounded-xl bg-destructive/10 text-destructive text-sm font-medium"
                  >
                    הסרת משתמש
                  </button>
                </div>

                {ledger.length > 0 && (
                  <div className="rounded-xl bg-muted/30 border border-border/40 p-3">
                    <p className="text-[11px] font-semibold text-muted-foreground mb-2">לוח נקודות (אחרונות)</p>
                    <ul className="space-y-1.5 text-[11px]">
                      {ledger.map((row) => (
                        <li key={row.id} className="flex justify-between gap-2 border-b border-border/30 pb-1 last:border-0">
                          <span className="text-muted-foreground truncate">{row.description || row.type}</span>
                          <span className={`tabular-nums shrink-0 ${row.amount >= 0 ? 'text-success' : 'text-destructive'}`}>
                            {row.amount >= 0 ? '+' : ''}{row.amount}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="space-y-2 pt-1">
                  <h4 className="text-sm font-semibold text-muted-foreground">נקודות והפניות</h4>
                  <button
                    type="button"
                    onClick={() => setPointsModalOpen(true)}
                    disabled={actionLoading}
                    className="w-full h-10 rounded-xl bg-primary/10 text-primary text-xs font-medium"
                  >
                    התאם נקודות
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      doAction('toggle_referral_disabled', selectedUser.user_id, {
                        disabled: !selectedUser.referral_disabled,
                      })
                    }
                    disabled={actionLoading}
                    className="w-full h-10 rounded-xl bg-muted text-foreground text-xs font-medium"
                  >
                    {selectedUser.referral_disabled ? 'אפשר הפניות' : 'השבת הפניות'}
                  </button>
                  <div className="flex gap-2 items-center">
                    <input
                      type="number"
                      min={0}
                      placeholder="תקרת הפניות (ברירת מחדל 5)"
                      value={capDraft}
                      onChange={(e) => setCapDraft(e.target.value)}
                      className="flex-1 h-10 rounded-xl border border-border bg-background px-3 text-xs"
                    />
                    <button
                      type="button"
                      onClick={async () => {
                        const raw = capDraft.trim();
                        const payload =
                          raw === '' ? null : Math.floor(Number(raw));
                        if (raw !== '' && (!Number.isFinite(payload!) || payload! < 0)) {
                          toast.error('ערך לא חוקי');
                          return;
                        }
                        await doAction('set_referral_cap_override', selectedUser.user_id, {
                          cap_override: raw === '' ? null : payload,
                        });
                      }}
                      disabled={actionLoading}
                      className="h-10 px-3 rounded-xl border border-primary text-primary text-xs font-medium whitespace-nowrap"
                    >
                      שמור תקרה
                    </button>
                  </div>
                  <p className="text-[10px] text-muted-foreground">השאר ריק לברירת המחדל (5 החודש).</p>
                </div>

                {/* Actions */}
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold text-muted-foreground">פעולות</h4>

                  {/* Role */}
                  <div className="flex gap-2">
                    {['guest', 'member'].map(r => (
                      <button
                        key={r}
                        onClick={() => doAction('update_user_role', selectedUser.user_id, { new_role: r })}
                        disabled={actionLoading || selectedUser.role === r}
                        className={`flex-1 h-10 rounded-xl text-xs font-medium transition-colors ${
                          selectedUser.role === r ? 'bg-primary text-primary-foreground' : 'bg-primary/10 text-foreground'
                        } disabled:opacity-50`}
                      >
                        {r === 'guest' ? 'אורח' : 'חבר קהילה'}
                      </button>
                    ))}
                  </div>

                  {/* Status */}
                  <div className="flex gap-2">
                    {['new', 'veteran', 'ambassador'].map(s => (
                      <button
                        key={s}
                        onClick={() => doAction('set_user_tier', selectedUser.user_id, { tier: s })}
                        disabled={actionLoading || selectedUser.status === s}
                        className={`flex-1 h-10 rounded-xl text-xs font-medium transition-colors ${
                          selectedUser.status === s ? 'bg-primary text-primary-foreground' : 'bg-primary/10 text-foreground'
                        } disabled:opacity-50`}
                      >
                        {s === 'new' ? 'חדש' : s === 'veteran' ? 'ותיק' : 'שגריר'}
                      </button>
                    ))}
                  </div>

                  {/* Free subscription toggle */}
                  <button
                    onClick={() => doAction(
                      selectedUser.subscription_status === 'active' ? 'revoke_free_subscription' : 'grant_free_subscription',
                      selectedUser.user_id
                    )}
                    disabled={actionLoading}
                    className="w-full h-11 rounded-xl border border-primary text-primary text-sm font-medium active:scale-[0.97] transition-transform"
                  >
                    {selectedUser.subscription_status === 'active' ? 'בטל מנוי חינם' : 'הענק מנוי חינם'}
                  </button>

                  {/* Suspend */}
                  <button
                    onClick={() => setConfirmAction({ action: selectedUser.suspended ? 'unsuspend_user' : 'suspend_user', label: selectedUser.suspended ? 'בטל השעיה' : 'השעה משתמש' })}
                    disabled={actionLoading}
                    className={`w-full h-11 rounded-xl text-sm font-medium ${selectedUser.suspended ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning'}`}
                  >
                    {selectedUser.suspended ? 'בטל השעיה' : 'השעה משתמש'}
                  </button>

                </div>
              </GlassCard>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <PointsAdjustModal
        open={pointsModalOpen}
        onOpenChange={setPointsModalOpen}
        userId={selectedUser?.user_id ?? null}
        onDone={() => {
          fetchUsers();
          setSelectedUser(null);
        }}
      />

      {/* Confirm Modal */}
      <AnimatePresence>
        {confirmAction && selectedUser && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[60] bg-black/50" onClick={() => setConfirmAction(null)} />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="fixed inset-x-4 top-1/2 -translate-y-1/2 z-[60] max-w-sm mx-auto">
              <GlassCard variant="strong" className="p-6 space-y-4 text-center">
                <h3 className="text-lg font-bold text-foreground">בטוח/ה?</h3>
                <p className="text-sm text-muted-foreground">
                  {confirmAction.action === 'remove_user' ? 'פעולה זו תמחק את המשתמש לצמיתות מהמערכת (כולל Auth).' : `פעולה: ${confirmAction.label}`}
                </p>
                <button
                  onClick={() => doAction(confirmAction.action, selectedUser.user_id)}
                  disabled={actionLoading}
                  className="w-full h-12 rounded-full bg-destructive text-primary-foreground font-semibold flex items-center justify-center"
                >
                  {actionLoading ? <Loader2 className="animate-spin" size={18} /> : confirmAction.label}
                </button>
                <button onClick={() => setConfirmAction(null)} className="w-full h-12 rounded-full gradient-primary text-primary-foreground font-semibold">ביטול</button>
              </GlassCard>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
