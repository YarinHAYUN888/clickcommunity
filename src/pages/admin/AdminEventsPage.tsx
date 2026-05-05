import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Plus, Calendar } from 'lucide-react';
import { LumaSpin } from '@/components/ui/luma-spin';
import GlassCard from '@/components/clicks/GlassCard';
import { useAdmin } from '@/contexts/AdminContext';
import { supabase } from '@/integrations/supabase/client';

const statusColors: Record<string, string> = {
  open: 'bg-success/10 text-success',
  almost_full: 'bg-warning/10 text-warning',
  full: 'bg-muted text-muted-foreground',
  past: 'bg-muted text-muted-foreground',
  cancelled: 'bg-destructive/10 text-destructive',
};
const statusLabels: Record<string, string> = {
  open: 'פתוח', almost_full: 'כמעט מלא', full: 'מלא', past: 'עבר', cancelled: 'בוטל',
};

export default function AdminEventsPage() {
  const navigate = useNavigate();
  const { isSuperUser, loading: adminLoading } = useAdmin();
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (adminLoading) return;
    if (!isSuperUser) { navigate('/clicks', { replace: true }); return; }
    (async () => {
      const { data } = await supabase.from('events').select('*').order('date', { ascending: true });
      // Sort: upcoming first, then past
      const upcoming = (data || []).filter(e => e.status !== 'past').sort((a, b) => a.date.localeCompare(b.date));
      const past = (data || []).filter(e => e.status === 'past').sort((a, b) => b.date.localeCompare(a.date));
      setEvents([...upcoming, ...past]);
      setLoading(false);
    })();
  }, [adminLoading, isSuperUser, navigate]);

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
        ) : events.length === 0 ? (
          <p className="text-center text-muted-foreground py-8 text-sm">אין אירועים</p>
        ) : (
          <div className="space-y-2">
            {events.map(event => (
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
    </div>
  );
}
