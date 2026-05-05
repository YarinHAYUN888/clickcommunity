import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Loader2, CreditCard, User } from 'lucide-react';
import { SpinnerOverlay } from '@/components/ui/luma-spin';
import GlassCard from '@/components/clicks/GlassCard';
import { useAdmin } from '@/contexts/AdminContext';
import { getAdminStats, performAdminAction } from '@/services/admin';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const subFilters = [
  { key: '', label: 'כולם' },
  { key: 'active', label: 'פעילים' },
  { key: 'free', label: 'חינמיים' },
  { key: 'paid', label: 'בתשלום' },
  { key: 'cancelled', label: 'מבוטלים' },
];

export default function AdminSubscriptionsPage() {
  const navigate = useNavigate();
  const { isSuperUser, loading: adminLoading } = useAdmin();
  const [stats, setStats] = useState<any>(null);
  const [subs, setSubs] = useState<any[]>([]);
  const [filter, setFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchData = async () => {
    try {
      const [statsData, { data: subsData }] = await Promise.all([
        getAdminStats(),
        supabase.from('subscriptions').select('*, profiles!inner(first_name, phone, avatar_url, photos, user_id)').order('created_at', { ascending: false }),
      ]);
      setStats(statsData?.subscriptions);
      setSubs(subsData || []);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  useEffect(() => {
    if (adminLoading) return;
    if (!isSuperUser) { navigate('/clicks', { replace: true }); return; }
    fetchData();
  }, [adminLoading, isSuperUser, navigate]);

  const filteredSubs = subs.filter(s => {
    if (!filter) return true;
    if (filter === 'active') return s.status === 'active';
    if (filter === 'free') return s.status === 'active' && s.amount === 0;
    if (filter === 'paid') return s.status === 'active' && s.amount > 0;
    if (filter === 'cancelled') return s.status === 'cancelled';
    return true;
  });

  const doAction = async (action: string, userId: string, details?: any) => {
    setActionLoading(true);
    try {
      await performAdminAction(action, 'subscription', userId, details);
      toast.success('הפעולה בוצעה ✓');
      fetchData();
    } catch { toast.error('שגיאה'); }
    setActionLoading(false);
  };

  if (adminLoading || loading) return <SpinnerOverlay />;

  return (
    <div className="min-h-screen gradient-bg pb-24">
      <div className="px-4 pt-[env(safe-area-inset-top)]">
        <div className="flex items-center gap-3 pt-4 mb-4">
          <button onClick={() => navigate('/admin')} className="text-primary"><ArrowRight size={24} /></button>
          <h1 className="text-xl font-bold text-foreground">ניהול מנויים</h1>
        </div>

        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-4 gap-2 mb-4">
            {[
              { label: 'פעילים', value: stats.active_total },
              { label: 'חינמיים', value: stats.active_free },
              { label: 'הכנסה', value: `₪${stats.monthly_revenue}` },
              { label: 'ביטולים', value: stats.cancelled_this_month },
            ].map((s, i) => (
              <GlassCard key={i} variant="strong" className="p-3 text-center">
                <div className="text-lg font-bold text-primary">{s.value}</div>
                <div className="text-[10px] text-muted-foreground">{s.label}</div>
              </GlassCard>
            ))}
          </div>
        )}

        {/* Filters */}
        <div className="flex gap-2 overflow-x-auto pb-3 scrollbar-hide">
          {subFilters.map(f => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                filter === f.key ? 'bg-primary text-primary-foreground' : 'bg-primary/10 text-foreground'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* List */}
        <div className="space-y-2">
          {filteredSubs.map((sub: any) => {
            const profile = sub.profiles;
            return (
              <GlassCard key={sub.id} variant="strong" className="p-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-muted overflow-hidden flex-shrink-0">
                    {profile?.photos?.[0] || profile?.avatar_url ? (
                      <img src={profile?.photos?.[0] || profile?.avatar_url} alt="" className="w-full h-full object-cover" />
                    ) : <User size={16} className="text-muted-foreground w-full h-full flex items-center justify-center" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-foreground">{profile?.first_name || '?'}</span>
                      <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium ${sub.amount === 0 ? 'bg-accent/10 text-accent' : 'bg-success/10 text-success'}`}>
                        {sub.amount === 0 ? 'חינם' : `₪${sub.amount}`}
                      </span>
                      <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium ${sub.status === 'active' ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning'}`}>
                        {sub.status === 'active' ? 'פעיל' : 'מבוטל'}
                      </span>
                    </div>
                    <p className="text-[10px] text-muted-foreground">
                      {new Date(sub.current_period_start).toLocaleDateString('he-IL')} → {new Date(sub.current_period_end).toLocaleDateString('he-IL')}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    {sub.amount === 0 && sub.status === 'active' && (
                      <button onClick={() => doAction('revoke_free_subscription', sub.user_id)} disabled={actionLoading} className="px-2 h-7 rounded-full text-destructive text-[10px] font-medium bg-destructive/10">בטל</button>
                    )}
                    {sub.status === 'active' && sub.amount > 0 && (
                      <button onClick={() => doAction('cancel_subscription', sub.user_id)} disabled={actionLoading} className="px-2 h-7 rounded-full text-warning text-[10px] font-medium bg-warning/10">בטל</button>
                    )}
                  </div>
                </div>
              </GlassCard>
            );
          })}
        </div>
      </div>
    </div>
  );
}
