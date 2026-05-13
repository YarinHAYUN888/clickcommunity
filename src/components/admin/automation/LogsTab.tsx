import { Fragment, useCallback, useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { fetchLogs, invokeRetryAutomationLog } from '@/services/automation';
import type { Database } from '@/integrations/supabase/types';
import { isLikelyAutomationInfraMissing } from '@/lib/automationErrors';
import { AutomationSetupBanner } from '@/components/admin/automation/AutomationSetupBanner';

type LogRow = Database['public']['Tables']['automation_logs']['Row'];

export function LogsTab() {
  const [rows, setRows] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState<string | null>(null);
  const [infraMissing, setInfraMissing] = useState(false);
  const [retrying, setRetrying] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows((await fetchLogs(120)) as LogRow[]);
      setInfraMissing(false);
    } catch (e) {
      console.error(e);
      if (isLikelyAutomationInfraMissing(e)) {
        setInfraMissing(true);
        setRows([]);
      } else {
        toast.error('טעינת יומנים נכשלה');
      }
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function retryOne(id: string) {
    setRetrying(id);
    try {
      const res = await invokeRetryAutomationLog(id);
      if (res.success) {
        toast.success('נשלח שוב בהצלחה');
        await load();
      } else {
        toast.error(res.error || res.message || 'שידור חוזר נכשל');
      }
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : 'שגיאה');
    }
    setRetrying(null);
  }

  return (
    <div className="space-y-4" dir="rtl">
      {infraMissing && <AutomationSetupBanner />}
      <p className="text-sm text-muted-foreground">יומני שליחת webhook ושגיאות (קריאה בלבד).</p>
      {loading ? (
        <p className="text-center py-12 text-muted-foreground">טוען…</p>
      ) : rows.length === 0 ? (
        <p className="text-center py-12 text-muted-foreground">אין רשומות עדיין</p>
      ) : (
        <div className="rounded-2xl border border-border/60 bg-white/95 overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-muted/40">
              <tr>
                <th className="p-2 text-right">זמן</th>
                <th className="p-2 text-right">סטטוס</th>
                <th className="p-2 text-right hidden md:table-cell">טריגר</th>
                <th className="p-2 text-right hidden lg:table-cell">מצב URL</th>
                <th className="p-2 w-10"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <Fragment key={r.id}>
                  <tr className="border-t border-border/50 hover:bg-muted/20">
                    <td className="p-2 whitespace-nowrap">
                      {r.created_at ? new Date(r.created_at).toLocaleString('he-IL') : '—'}
                    </td>
                    <td className="p-2">
                      <span
                        className={
                          r.status === 'success' ? 'text-emerald-600 font-medium' : 'text-destructive font-medium'
                        }
                      >
                        {r.status}
                      </span>
                    </td>
                    <td className="p-2 hidden md:table-cell">{r.trigger_type || '—'}</td>
                    <td className="p-2 hidden lg:table-cell text-muted-foreground">{r.webhook_url_type || '—'}</td>
                    <td className="p-2">
                      <button
                        type="button"
                        className="p-1 rounded hover:bg-muted"
                        onClick={() => setOpen((id) => (id === r.id ? null : r.id))}
                        aria-label="פרטים"
                      >
                        {open === r.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </button>
                    </td>
                  </tr>
                  {open === r.id && (
                    <tr className="bg-muted/15">
                      <td colSpan={5} className="p-3 font-mono text-[10px] leading-relaxed break-all" dir="ltr">
                        {r.error_message && <p className="text-destructive mb-2">Error: {r.error_message}</p>}
                        <div className="flex flex-wrap gap-2 mb-2">
                          <button
                            type="button"
                            className="inline-flex items-center gap-1 rounded-lg border border-violet-200 bg-violet-50 px-2 py-1 text-[11px] font-medium text-violet-900 hover:bg-violet-100 disabled:opacity-50"
                            disabled={retrying === r.id}
                            onClick={() => void retryOne(r.id)}
                          >
                            <RotateCcw className="h-3 w-3" />
                            שידור חוזר
                          </button>
                        </div>
                        {(r.recipient_mode || r.segment_key || r.manual_test_email) && (
                          <p className="mb-2 text-foreground/90">
                            {r.recipient_mode && <span className="mr-3">mode: {r.recipient_mode}</span>}
                            {r.segment_key && <span className="mr-3">segment: {r.segment_key}</span>}
                            {r.manual_test_email && <span>manual_test: {r.manual_test_email}</span>}
                          </p>
                        )}
                        {r.resolution_meta != null &&
                          typeof r.resolution_meta === 'object' &&
                          Object.keys(r.resolution_meta as object).length > 0 && (
                            <pre className="mb-2 whitespace-pre-wrap opacity-90 border border-border/40 rounded p-2">
                              resolution_meta: {JSON.stringify(r.resolution_meta, null, 2)}
                            </pre>
                          )}
                        <pre className="whitespace-pre-wrap opacity-90">
                          {JSON.stringify(r.payload, null, 2)}
                        </pre>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
