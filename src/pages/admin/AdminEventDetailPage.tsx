import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowRight, Download, Edit3, X, Check, User } from 'lucide-react';
import { SpinnerOverlay } from '@/components/ui/luma-spin';
import GlassCard from '@/components/clicks/GlassCard';
import { useAdmin } from '@/contexts/AdminContext';
import { getAdminEventDetails, performAdminAction, exportRegistrationsCSV } from '@/services/admin';
import { toast } from 'sonner';
import { AnimatePresence, motion } from 'framer-motion';

const regStatusColors: Record<string, string> = {
  registered: 'bg-success/10 text-success',
  approved: 'bg-success/10 text-success',
  pending: 'bg-warning/10 text-warning',
  waitlist: 'bg-muted text-muted-foreground',
  cancelled: 'bg-destructive/10 text-destructive',
};
const regStatusLabels: Record<string, string> = {
  registered: 'רשום', approved: 'מאושר', pending: 'ממתין', waitlist: 'המתנה', cancelled: 'בוטל',
};

const regFilters = [
  { key: '', label: 'כולם' },
  { key: 'approved', label: 'מאושרים' },
  { key: 'pending', label: 'ממתינים' },
  { key: 'waitlist', label: 'המתנה' },
  { key: 'cancelled', label: 'בוטלו' },
];

export default function AdminEventDetailPage() {
  const navigate = useNavigate();
  const { eventId } = useParams();
  const { isSuperUser, loading: adminLoading } = useAdmin();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [regFilter, setRegFilter] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [cancelConfirm, setCancelConfirm] = useState(false);

  const fetchData = async () => {
    if (!eventId) return;
    try {
      const d = await getAdminEventDetails(eventId);
      setData(d);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  useEffect(() => {
    if (adminLoading) return;
    if (!isSuperUser) { navigate('/clicks', { replace: true }); return; }
    fetchData();
  }, [adminLoading, isSuperUser, eventId, navigate]);

  const doAction = async (action: string, targetId: string, targetType = 'event', details?: any) => {
    setActionLoading(true);
    try {
      await performAdminAction(action, targetType, targetId, details);
      toast.success('הפעולה בוצעה בהצלחה ✓');
      fetchData();
    } catch { toast.error('שגיאה'); }
    setActionLoading(false);
  };

  if (adminLoading || loading) return <SpinnerOverlay />;
  if (!data) return null;

  const { event, registrations, stats, votes } = data;
  const filteredRegs = regFilter ? registrations.filter((r: any) => r.status === regFilter) : registrations;

  return (
    <div className="min-h-screen gradient-bg pb-24">
      <div className="px-4 pt-[env(safe-area-inset-top)]">
        <div className="flex items-center gap-3 pt-4 mb-4">
          <button onClick={() => navigate('/admin/events')} className="text-primary"><ArrowRight size={24} /></button>
          <h1 className="text-xl font-bold text-foreground truncate">{event.name}</h1>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-2 mb-4">
          {[
            { label: 'נרשמים', value: `${stats.total_registered}/${event.max_capacity}` },
            { label: 'מאושרים', value: stats.total_approved },
            { label: 'המתנה', value: stats.total_waitlist },
            { label: 'מאזן', value: `♀${stats.female_percent}% ♂${stats.male_percent}%` },
          ].map((s, i) => (
            <GlassCard key={i} variant="strong" className="p-3 text-center">
              <div className="text-lg font-bold text-primary">{s.value}</div>
              <div className="text-[10px] text-muted-foreground">{s.label}</div>
            </GlassCard>
          ))}
        </div>

        {/* Actions */}
        <div className="flex gap-2 mb-4 overflow-x-auto">
          <button onClick={() => navigate(`/admin/events/${eventId}/edit`)} className="h-9 px-4 rounded-full border border-primary text-primary text-xs font-medium flex items-center gap-1.5 whitespace-nowrap">
            <Edit3 size={14} /> ערוך
          </button>
          <button onClick={() => exportRegistrationsCSV(registrations)} className="h-9 px-4 rounded-full border border-primary text-primary text-xs font-medium flex items-center gap-1.5 whitespace-nowrap">
            <Download size={14} /> ייצוא
          </button>
          {event.status !== 'cancelled' && (
            <button onClick={() => setCancelConfirm(true)} className="h-9 px-4 rounded-full border border-destructive text-destructive text-xs font-medium whitespace-nowrap">
              בטל אירוע
            </button>
          )}
        </div>

        {/* Registration Filters */}
        <div className="flex gap-2 overflow-x-auto pb-3 scrollbar-hide">
          {regFilters.map(f => (
            <button
              key={f.key}
              onClick={() => setRegFilter(f.key)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                regFilter === f.key ? 'bg-primary text-primary-foreground' : 'bg-primary/10 text-foreground'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Registrations */}
        <h3 className="text-sm font-semibold text-muted-foreground mb-2">רשימת נרשמים</h3>
        <div className="space-y-2 mb-6">
          {filteredRegs.map((reg: any) => (
            <GlassCard key={reg.id} variant="strong" className="p-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-muted overflow-hidden flex-shrink-0">
                  {reg.user?.photos?.[0] ? <img src={reg.user.photos[0]} alt="" className="w-full h-full object-cover" /> : <User size={16} className="text-muted-foreground w-full h-full flex items-center justify-center" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-foreground">{reg.user?.first_name || '?'}</span>
                    <span className="text-xs">{reg.user?.gender === 'female' ? '♀' : '♂'}</span>
                    <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium ${regStatusColors[reg.status] || ''}`}>
                      {regStatusLabels[reg.status] || reg.status}
                    </span>
                  </div>
                  <p className="text-[10px] text-muted-foreground">{new Date(reg.created_at).toLocaleDateString('he-IL')}</p>
                </div>
                <div className="flex gap-1">
                  {reg.status === 'pending' && (
                    <>
                      <button onClick={() => doAction('approve_registration', reg.id)} disabled={actionLoading} className="w-7 h-7 rounded-full bg-success/10 flex items-center justify-center"><Check size={14} className="text-success" /></button>
                      <button onClick={() => doAction('reject_registration', reg.id)} disabled={actionLoading} className="w-7 h-7 rounded-full bg-destructive/10 flex items-center justify-center"><X size={14} className="text-destructive" /></button>
                    </>
                  )}
                  {reg.status === 'registered' && (
                    <button onClick={() => doAction('move_to_waitlist', reg.id)} disabled={actionLoading} className="px-2 h-7 rounded-full bg-warning/10 text-warning text-[10px] font-medium">המתנה</button>
                  )}
                  <button onClick={() => doAction('remove_registration', reg.id)} disabled={actionLoading} className="px-2 h-7 rounded-full text-destructive text-[10px] font-medium">הסר</button>
                </div>
              </div>
            </GlassCard>
          ))}
        </div>

        {/* Votes (past events) */}
        {event.status === 'past' && votes?.length > 0 && (
          <>
            <h3 className="text-sm font-semibold text-muted-foreground mb-2">תוצאות הצבעה</h3>
            <div className="space-y-2">
              {votes.map((v: any) => (
                <GlassCard key={v.votee?.user_id} variant="strong" className="p-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-muted overflow-hidden flex-shrink-0">
                      {v.votee?.photos?.[0] ? <img src={v.votee.photos[0]} alt="" className="w-full h-full object-cover" /> : <User size={16} className="text-muted-foreground" />}
                    </div>
                    <div className="flex-1">
                      <span className="text-sm font-medium text-foreground">{v.votee?.first_name || '?'}</span>
                      <div className="text-xs text-muted-foreground">💜 {v.positive} · 👎 {v.negative} · ציון: {v.score}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-medium ${v.passed ? 'text-success' : 'text-destructive'}`}>
                        {v.passed ? 'עבר ✓' : 'לא עבר'}
                      </span>
                      {!v.passed && (
                        <button
                          onClick={() => doAction('force_approve_member', v.votee?.user_id, 'user')}
                          disabled={actionLoading}
                          className="px-2 h-7 rounded-full bg-primary/10 text-primary text-[10px] font-medium"
                        >
                          אשר כחבר
                        </button>
                      )}
                    </div>
                  </div>
                </GlassCard>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Cancel Confirm */}
      <AnimatePresence>
        {cancelConfirm && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/40" onClick={() => setCancelConfirm(false)} />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="fixed inset-x-4 top-1/2 -translate-y-1/2 z-50 max-w-sm mx-auto">
              <GlassCard variant="strong" className="p-6 space-y-4 text-center">
                <h3 className="text-lg font-bold text-foreground">בטל אירוע?</h3>
                <p className="text-sm text-muted-foreground">פעולה זו תבטל את האירוע לכל הנרשמים</p>
                <button onClick={() => { doAction('cancel_event', eventId!, 'event'); setCancelConfirm(false); }} className="w-full h-12 rounded-full bg-destructive text-primary-foreground font-semibold">בטל אירוע</button>
                <button onClick={() => setCancelConfirm(false)} className="w-full h-12 rounded-full gradient-primary text-primary-foreground font-semibold">השאר</button>
              </GlassCard>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
