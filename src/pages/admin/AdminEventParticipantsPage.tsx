import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowRight, CheckCircle2, Search } from 'lucide-react';
import { SpinnerOverlay } from '@/components/ui/luma-spin';
import GlassCard from '@/components/clicks/GlassCard';
import { useAdmin } from '@/contexts/AdminContext';
import { getAdminEventDetails, performAdminAction } from '@/services/admin';
import { toast } from 'sonner';

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'registered', label: 'Registered' },
  { key: 'cancelled', label: 'Cancelled' },
  { key: 'checked_in', label: 'Checked In' },
];

export default function AdminEventParticipantsPage() {
  const navigate = useNavigate();
  const { eventId } = useParams();
  const { isSuperUser, loading: adminLoading } = useAdmin();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState('all');
  const [entryCode, setEntryCode] = useState('');
  const [eventName, setEventName] = useState('');
  const [rows, setRows] = useState<any[]>([]);
  const [eventStatus, setEventStatus] = useState<string>('');
  const [votesRaw, setVotesRaw] = useState<{ voter_id: string; votee_id: string; vote: string }[]>([]);
  const [voteScores, setVoteScores] = useState<any[]>([]);
  const [reporterId, setReporterId] = useState<string>('');

  const load = async () => {
    if (!eventId) return;
    setLoading(true);
    try {
      const data = await getAdminEventDetails(eventId);
      setEventName(data?.event?.name || '');
      setEventStatus(data?.event?.status || '');
      setRows(data?.registrations || []);
      setVotesRaw(data?.votes_raw || []);
      setVoteScores(data?.votes || []);
    } catch {
      toast.error('שגיאה בטעינת משתתפים');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (adminLoading) return;
    if (!isSuperUser) {
      navigate('/clicks', { replace: true });
      return;
    }
    load();
  }, [adminLoading, isSuperUser, eventId, navigate]);

  const filteredRows = useMemo(() => {
    if (filter === 'all') return rows;
    return rows.filter((r) => r.status === filter);
  }, [rows, filter]);

  const attendees = useMemo(
    () => rows.filter((r) => ['registered', 'approved', 'checked_in'].includes(r.status)),
    [rows],
  );

  const voteByPair = useMemo(() => {
    const map: Record<string, string> = {};
    for (const v of votesRaw) map[`${v.voter_id}|${v.votee_id}`] = v.vote;
    return map;
  }, [votesRaw]);

  const scoreByUser = useMemo(() => {
    const map: Record<string, { positive: number; negative: number }> = {};
    for (const s of voteScores) {
      const uid = s?.votee?.user_id;
      if (uid) map[uid] = { positive: s.positive ?? 0, negative: s.negative ?? 0 };
    }
    return map;
  }, [voteScores]);

  const markFeedback = async (targetUserId: string, hadClick: boolean) => {
    if (!eventId || !reporterId) return;
    setSaving(true);
    try {
      await performAdminAction('upsert_event_click_feedback', 'event', eventId, {
        reporter_user_id: reporterId,
        target_user_id: targetUserId,
        had_click: hadClick,
      });
      toast.success('המשוב נשמר');
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'שמירת המשוב נכשלה');
    } finally {
      setSaving(false);
    }
  };

  const fmt = (value?: string | null) => {
    if (!value) return '—';
    return new Date(value).toLocaleString('he-IL');
  };

  const checkInByCode = async () => {
    const code = entryCode.trim().toUpperCase();
    if (!code || !eventId) return;
    setSaving(true);
    try {
      await performAdminAction('checkin_by_entry_code', 'event', eventId, { event_id: eventId, entry_code: code });
      toast.success('בוצע Check-in בהצלחה');
      setEntryCode('');
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Check-in נכשל');
    } finally {
      setSaving(false);
    }
  };

  const checkInRow = async (registrationId: string) => {
    setSaving(true);
    try {
      await performAdminAction('checkin_registration', 'event_registration', registrationId);
      toast.success('סומן כ־Checked In');
      await load();
    } catch {
      toast.error('לא ניתן לעדכן סטטוס');
    } finally {
      setSaving(false);
    }
  };

  if (adminLoading || loading) return <SpinnerOverlay />;

  return (
    <div className="min-h-screen gradient-bg pb-24">
      <div className="px-4 pt-[env(safe-area-inset-top)]">
        <div className="flex items-center gap-3 pt-4 mb-4">
          <button onClick={() => navigate(`/admin/events/${eventId}`)} className="text-primary">
            <ArrowRight size={24} />
          </button>
          <h1 className="text-xl font-bold text-foreground truncate">משתתפי אירוע · {eventName}</h1>
        </div>

        <GlassCard variant="strong" className="p-3 mb-4">
          <div className="flex items-center gap-2">
            <div className="flex-1 relative">
              <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                value={entryCode}
                onChange={(e) => setEntryCode(e.target.value)}
                placeholder="EVT-XXXXXXXX"
                className="w-full h-10 rounded-xl border border-border bg-background px-9 text-sm"
              />
            </div>
            <button
              onClick={checkInByCode}
              disabled={saving || !entryCode.trim()}
              className="h-10 px-4 rounded-xl gradient-primary text-primary-foreground text-sm font-semibold disabled:opacity-60"
            >
              Check-in
            </button>
          </div>
        </GlassCard>

        <div className="flex gap-2 overflow-x-auto pb-3">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap ${
                filter === f.key ? 'bg-primary text-primary-foreground' : 'bg-primary/10 text-foreground'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[920px] text-sm">
            <thead>
              <tr className="text-muted-foreground text-xs">
                <th className="text-right p-2">Name</th>
                <th className="text-right p-2">Status</th>
                <th className="text-right p-2">Created_at</th>
                <th className="text-right p-2">Cancelled_at</th>
                <th className="text-right p-2">Checked_in_at</th>
                <th className="text-right p-2">Entry Code</th>
                <th className="text-right p-2">Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((r) => (
                <tr key={r.id} className="border-t border-border/30">
                  <td className="p-2 font-medium text-foreground">{r.user?.first_name || '—'}</td>
                  <td className="p-2">{r.status}</td>
                  <td className="p-2">{fmt(r.created_at)}</td>
                  <td className="p-2">{fmt(r.cancelled_at)}</td>
                  <td className="p-2">{fmt(r.checked_in_at)}</td>
                  <td className="p-2 font-mono text-xs">{r.entry_code || '—'}</td>
                  <td className="p-2">
                    {r.status !== 'checked_in' && (
                      <button
                        onClick={() => checkInRow(r.id)}
                        disabled={saving}
                        className="h-8 px-3 rounded-full bg-success/10 text-success text-xs font-semibold inline-flex items-center gap-1"
                      >
                        <CheckCircle2 size={13} />
                        Check-in
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {eventStatus === 'past' && (
          <GlassCard variant="strong" className="p-4 mt-6 space-y-4">
            <div>
              <h2 className="text-base font-bold text-foreground">משוב קליקים לאחר האירוע</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                סמנ/י עבור משתתף/ת מדווח/ת אם היה קליק עם שאר המשתתפים/ות.
              </p>
            </div>

            <div>
              <label className="block text-xs text-muted-foreground mb-1">משתתף/ת מדווח/ת</label>
              <select
                value={reporterId}
                onChange={(e) => setReporterId(e.target.value)}
                className="w-full h-10 rounded-xl border border-border bg-background px-3 text-sm"
              >
                <option value="">בחר/י משתתף/ת…</option>
                {attendees.map((r) => (
                  <option key={r.user_id} value={r.user_id}>
                    {r.user?.first_name || r.user_id}
                  </option>
                ))}
              </select>
            </div>

            {reporterId && (
              <div className="space-y-2">
                {attendees
                  .filter((r) => r.user_id !== reporterId)
                  .map((r) => {
                    const current = voteByPair[`${reporterId}|${r.user_id}`];
                    const counts = scoreByUser[r.user_id] || { positive: 0, negative: 0 };
                    return (
                      <div
                        key={r.user_id}
                        className="flex items-center justify-between gap-2 rounded-xl border border-border/40 bg-muted/20 p-2"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{r.user?.first_name || r.user_id}</p>
                          <p className="text-[11px] text-muted-foreground">💜 {counts.positive} · 👎 {counts.negative}</p>
                        </div>
                        <div className="flex gap-2 shrink-0">
                          <button
                            onClick={() => markFeedback(r.user_id, true)}
                            disabled={saving}
                            className={`h-8 px-3 rounded-full text-xs font-semibold ${
                              current === 'clicked' ? 'bg-success text-primary-foreground' : 'bg-success/10 text-success'
                            } disabled:opacity-50`}
                          >
                            היה קליק
                          </button>
                          <button
                            onClick={() => markFeedback(r.user_id, false)}
                            disabled={saving}
                            className={`h-8 px-3 rounded-full text-xs font-semibold ${
                              current === 'no_click' ? 'bg-destructive text-primary-foreground' : 'bg-destructive/10 text-destructive'
                            } disabled:opacity-50`}
                          >
                            לא היה קליק
                          </button>
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </GlassCard>
        )}
      </div>
    </div>
  );
}
