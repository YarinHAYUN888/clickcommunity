import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Plus, Calendar, Check, X } from 'lucide-react';
import { LumaSpin } from '@/components/ui/luma-spin';
import GlassCard from '@/components/clicks/GlassCard';
import { useAdmin } from '@/contexts/AdminContext';
import { supabase } from '@/integrations/supabase/client';
import { performAdminAction } from '@/services/admin';
import { toast } from 'sonner';

const statusColors: Record<string, string> = {
  open: 'bg-success/10 text-success',
  almost_full: 'bg-warning/10 text-warning',
  full: 'bg-muted text-muted-foreground',
  past: 'bg-muted text-muted-foreground',
  cancelled: 'bg-destructive/10 text-destructive',
  pending_review: 'bg-warning/10 text-warning',
  rejected: 'bg-destructive/10 text-destructive',
};
const statusLabels: Record<string, string> = {
  open: 'פתוח', almost_full: 'כמעט מלא', full: 'מלא', past: 'עבר', cancelled: 'בוטל',
  pending_review: 'ממתין לאישור', rejected: 'נדחה',
};

type EventLite = {
  id: string;
  name: string;
  status: string;
  date: string;
  time: string | null;
  location_name: string;
  max_capacity: number;
  cover_image_url: string | null;
  created_by: string | null;
};

export default function AdminEventsPage() {
  const navigate = useNavigate();
  const { isSuperUser, loading: adminLoading } = useAdmin();
  const [events, setEvents] = useState<EventLite[]>([]);
  const [creatorNames, setCreatorNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabase.from('events').select('*').order('date', { ascending: true });
    const rows = (data || []) as EventLite[];
    setEvents(rows);

    const creatorIds = [
      ...new Set(
        rows
          .filter((e) => e.status === 'pending_review' || e.status === 'rejected')
          .map((e) => e.created_by)
          .filter((id): id is string => !!id),
      ),
    ];
    if (creatorIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, first_name, last_name')
        .in('user_id', creatorIds);
      const map: Record<string, string> = {};
      for (const p of profiles || []) {
        map[p.user_id] = [p.first_name, p.last_name].filter(Boolean).join(' ').trim() || 'משתמש';
      }
      setCreatorNames(map);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (adminLoading) return;
    if (!isSuperUser) { navigate('/clicks', { replace: true }); return; }
    void load();
  }, [adminLoading, isSuperUser, navigate, load]);

  const handleReview = async (eventId: string, action: 'approve_event' | 'reject_event') => {
    if (actingId) return;
    setActingId(eventId);
    try {
      await performAdminAction(action, 'event', eventId);
      toast.success(action === 'approve_event' ? 'האירוע אושר' : 'האירוע נדחה');
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'הפעולה נכשלה');
    } finally {
      setActingId(null);
    }
  };

  const pending = events.filter((e) => e.status === 'pending_review');
  const upcoming = events
    .filter((e) => !['past', 'pending_review', 'rejected'].includes(e.status))
    .sort((a, b) => a.date.localeCompare(b.date));
  const past = events.filter((e) => e.status === 'past').sort((a, b) => b.date.localeCompare(a.date));
  const listed = [...upcoming, ...past];

  return (
    <div className="min-h-screen gradient-bg pb-24">
      <div className="px-4 pt-[env(safe-area-inset-top)]">
        <div className="flex items-center justify-between pt-4 mb-4">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/admin')} className="text-primary"><ArrowRight size={24} /></button>
            <h1 className="text-xl font-bold text-foreground">ניהול אירועים</h1>
          </div>
          <button
            onClick={() => navigate('/admin/events/new')}
            className="h-9 px-4 rounded-full gradient-primary text-primary-foreground text-sm font-medium flex items-center gap-1.5"
          >
            <Plus size={16} /> אירוע חדש
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><LumaSpin size={48} /></div>
        ) : (
          <div className="space-y-6">
            {pending.length > 0 && (
              <section className="space-y-2">
                <h2 className="text-sm font-bold text-foreground px-1">אירועים לאישור ({pending.length})</h2>
                {pending.map((event) => (
                  <GlassCard key={event.id} variant="strong" className="p-3 space-y-3">
                    <div
                      className="flex items-center gap-3 cursor-pointer"
                      onClick={() => navigate(`/admin/events/${event.id}`)}
                    >
                      <div className="w-14 h-14 rounded-lg overflow-hidden flex-shrink-0 bg-primary/10 flex items-center justify-center">
                        {event.cover_image_url ? (
                          <img src={event.cover_image_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <Calendar size={22} className="text-primary" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-foreground text-sm truncate">{event.name}</span>
                          <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium ${statusColors.pending_review}`}>
                            {statusLabels.pending_review}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {new Date(event.date).toLocaleDateString('he-IL')} · {event.time?.slice(0, 5)} · {event.location_name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          נוצר על ידי: {event.created_by ? (creatorNames[event.created_by] ?? '…') : '—'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={actingId === event.id}
                        onClick={() => void handleReview(event.id, 'approve_event')}
                        className="flex-1 h-9 rounded-xl bg-success/10 text-success text-sm font-semibold flex items-center justify-center gap-1.5 active:scale-[0.97] transition-transform disabled:opacity-50"
                      >
                        <Check size={15} /> אישור אירוע
                      </button>
                      <button
                        type="button"
                        disabled={actingId === event.id}
                        onClick={() => void handleReview(event.id, 'reject_event')}
                        className="flex-1 h-9 rounded-xl bg-destructive/10 text-destructive text-sm font-semibold flex items-center justify-center gap-1.5 active:scale-[0.97] transition-transform disabled:opacity-50"
                      >
                        <X size={15} /> דחיית אירוע
                      </button>
                    </div>
                  </GlassCard>
                ))}
              </section>
            )}

            {listed.length === 0 && pending.length === 0 ? (
              <p className="text-center text-muted-foreground py-8 text-sm">אין אירועים</p>
            ) : (
              <div className="space-y-2">
                {listed.map((event) => (
                  <GlassCard
                    key={event.id}
                    variant="strong"
                    className="p-3 cursor-pointer"
                    onClick={() => navigate(`/admin/events/${event.id}`)}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-14 h-14 rounded-lg overflow-hidden flex-shrink-0 bg-primary/10 flex items-center justify-center">
                        {event.cover_image_url ? (
                          <img src={event.cover_image_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <Calendar size={22} className="text-primary" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-foreground text-sm truncate">{event.name}</span>
                          <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium ${statusColors[event.status] || statusColors.open}`}>
                            {statusLabels[event.status] || event.status}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {new Date(event.date).toLocaleDateString('he-IL')} · {event.time?.slice(0, 5)} · {event.location_name}
                        </p>
                        <p className="text-xs text-muted-foreground">{event.max_capacity} מקומות</p>
                      </div>
                    </div>
                  </GlassCard>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
