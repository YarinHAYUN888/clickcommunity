import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Users } from 'lucide-react';
import GlassCard from '@/components/clicks/GlassCard';
import { SpinnerOverlay } from '@/components/ui/luma-spin';
import { useAdmin } from '@/contexts/AdminContext';
import { COMMUNITY_PIPELINE } from '@/lib/community/communityPipeline';
import { listRecentCommunityVouches, type CommunityVouchRow } from '@/services/communityVouches';

export default function AdminCommunityPage() {
  const navigate = useNavigate();
  const { isSuperUser, loading: adminLoading } = useAdmin();
  const [rows, setRows] = useState<CommunityVouchRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (adminLoading) return;
    if (!isSuperUser) {
      navigate('/clicks', { replace: true });
      return;
    }
    listRecentCommunityVouches(100).then(setRows).finally(() => setLoading(false));
  }, [adminLoading, isSuperUser, navigate]);

  if (adminLoading || loading) return <SpinnerOverlay />;

  return (
    <div className="min-h-screen gradient-bg pb-24 px-4 pt-[env(safe-area-inset-top)]">
      <div className="flex items-center gap-2 pt-4 mb-4">
        <button type="button" onClick={() => navigate('/admin')} className="p-2 -mr-1" aria-label="חזרה">
          <ChevronLeft className="text-foreground" size={22} />
        </button>
        <h1 className="text-xl font-bold text-foreground">קהילה ואישורים</h1>
      </div>

      <GlassCard variant="strong" className="p-4 mb-4 space-y-2 text-sm text-muted-foreground">
        <p className="font-semibold text-foreground flex items-center gap-2">
          <Users size={18} className="text-primary" />
          מצב שדות (מיפוי)
        </p>
        <ul className="list-disc list-inside space-y-1 leading-relaxed">
          {Object.entries(COMMUNITY_PIPELINE).map(([k, v]) => (
            <li key={k}>
              <span className="text-foreground/90">{k}</span>: {v}
            </li>
          ))}
        </ul>
      </GlassCard>

      <GlassCard variant="strong" className="p-4">
        <h2 className="font-semibold text-foreground mb-3">אישורי קהילה אחרונים ({rows.length})</h2>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">אין רשומות עדיין — אחרי מיגרציה ושימוש ב-API יופיעו כאן.</p>
        ) : (
          <div className="space-y-2 max-h-[60vh] overflow-y-auto text-xs font-mono">
            {rows.map((r) => (
              <div
                key={r.id}
                className="flex flex-wrap gap-x-3 gap-y-1 border-b border-border/40 pb-2 last:border-0"
                dir="ltr"
              >
                <span className="text-muted-foreground">{new Date(r.created_at).toLocaleString('he-IL')}</span>
                <span>target={r.target_user_id.slice(0, 8)}…</span>
                <span>voucher={r.voucher_user_id.slice(0, 8)}…</span>
                {r.event_id && <span>event={r.event_id.slice(0, 8)}…</span>}
              </div>
            ))}
          </div>
        )}
      </GlassCard>
    </div>
  );
}
