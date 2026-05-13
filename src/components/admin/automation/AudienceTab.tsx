import { useCallback, useState, useMemo } from 'react';
import { Search } from 'lucide-react';
import { toast } from 'sonner';
import { invokeRecipients, type RecipientUser } from '@/services/automation';
import { isLikelyAutomationInfraMissing } from '@/lib/automationErrors';
import { AutomationSetupBanner } from '@/components/admin/automation/AutomationSetupBanner';
import { SEGMENT_OPTIONS } from './constants';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export function AudienceTab() {
  const [segment, setSegment] = useState('all_members');
  const [users, setUsers] = useState<RecipientUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState('');
  const [infraMissing, setInfraMissing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await invokeRecipients({ action: 'list_segment', segment, limit: 1500 });
      setUsers(data.users || []);
      setInfraMissing(false);
      toast.success(`${(data.users || []).length} משתמשים בקהל`);
    } catch (e) {
      console.error(e);
      if (isLikelyAutomationInfraMissing(e)) {
        setInfraMissing(true);
        setUsers([]);
      } else {
        toast.error('טעינה נכשלה');
      }
    }
    setLoading(false);
  }, [segment]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return users;
    return users.filter(
      (u) =>
        (u.email || '').toLowerCase().includes(s) ||
        (u.first_name || '').toLowerCase().includes(s) ||
        (u.phone || '').includes(s),
    );
  }, [users, q]);

  return (
    <div className="space-y-4" dir="rtl">
      {infraMissing && <AutomationSetupBanner />}
      <p className="text-sm text-muted-foreground">
        בחירת סגמנט והצגת רשימת משתמשים (אימיילים נטענים בצד שרת מאובטח).
      </p>
      <div className="flex flex-wrap gap-2 items-end">
        <label className="space-y-1">
          <span className="text-xs text-muted-foreground block">סגמנט</span>
          <select
            value={segment}
            onChange={(e) => setSegment(e.target.value)}
            className="h-10 min-w-[200px] rounded-xl border border-border bg-white px-2 text-sm"
          >
            {SEGMENT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <Button type="button" onClick={() => void load()} disabled={loading} className="rounded-full bg-primary">
          {loading ? 'טוען…' : 'הצג קהל'}
        </Button>
        <div className="relative flex-1 min-w-[180px] max-w-sm ms-auto">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="חיפוש באימייל / שם / טלפון"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="pr-10 bg-white"
          />
        </div>
      </div>

      <div className="rounded-2xl border border-border/60 bg-white/95 overflow-hidden">
        <div className="max-h-[480px] overflow-y-auto">
          {filtered.length === 0 ? (
            <p className="p-8 text-center text-muted-foreground text-sm">בחר סגמנט והצג קהל</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-muted/40 sticky top-0">
                <tr>
                  <th className="text-right p-2">שם</th>
                  <th className="text-right p-2">אימייל</th>
                  <th className="text-right p-2 hidden md:table-cell">טלפון</th>
                  <th className="text-right p-2 hidden lg:table-cell">נקודות</th>
                </tr>
              </thead>
              <tbody>
                {filtered.slice(0, 300).map((u) => (
                  <tr key={u.user_id} className="border-t border-border/40 hover:bg-primary/[0.03]">
                    <td className="p-2">{[u.first_name, u.last_name].filter(Boolean).join(' ') || '—'}</td>
                    <td className="p-2" dir="ltr">
                      {u.email || '—'}
                    </td>
                    <td className="p-2 hidden md:table-cell" dir="ltr">
                      {u.phone || '—'}
                    </td>
                    <td className="p-2 hidden lg:table-cell">{u.points ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        {filtered.length > 300 && (
          <p className="text-xs text-center text-muted-foreground p-2">מוצגות 300 ראשונות</p>
        )}
      </div>
    </div>
  );
}
