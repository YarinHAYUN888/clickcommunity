import { useCallback, useEffect, useState } from 'react';
import { ArrowRight, CheckCircle2, RefreshCcw, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { fetchLogs } from '@/services/automation';
import type { Database } from '@/integrations/supabase/types';

type LogRow = Database['public']['Tables']['automation_logs']['Row'];

const TRIGGER_LABELS: Record<string, string> = {
  manual_send: 'שליחה ידנית',
  birthday_today: 'יום הולדת',
  user_approved: 'אישור לקהילה',
  user_registered: 'הרשמה חדשה',
  event_starting_soon: 'תזכורת אירוע',
  user_reached_200_points: 'הגיע ל־200 נקודות',
};

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleString('he-IL', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export function ManagerHistoryPanel({ onBack }: { onBack: () => void }) {
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const data = await fetchLogs(60);
      setLogs((data as LogRow[]) ?? []);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const okCount = logs.filter((l) => l.status === 'success').length;
  const failCount = logs.filter((l) => l.status !== 'success').length;

  return (
    <div dir="rtl" className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onBack}
            className="p-2 rounded-xl hover:bg-violet-50 text-violet-600 transition-colors"
          >
            <ArrowRight className="h-5 w-5" />
          </button>
          <h2 className="text-xl font-bold text-violet-950">היסטוריית שליחות</h2>
        </div>
        <Button type="button" variant="outline" size="sm" className="rounded-xl gap-1.5" onClick={() => void load()}>
          <RefreshCcw className="h-4 w-4" />
          רענן
        </Button>
      </div>

      {/* Summary pills */}
      {!loading && logs.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          <span className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-green-50 text-green-700 border border-green-200">
            <CheckCircle2 className="h-3.5 w-3.5" />
            {okCount} נשלחו בהצלחה
          </span>
          {failCount > 0 && (
            <span className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-red-50 text-red-700 border border-red-200">
              <XCircle className="h-3.5 w-3.5" />
              {failCount} נכשלו
            </span>
          )}
        </div>
      )}

      {/* States */}
      {loading && <p className="text-center text-muted-foreground py-16">טוען היסטוריה…</p>}

      {!loading && error && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center">
          <p className="text-amber-800">לא הצלחנו לטעון את ההיסטוריה כרגע.</p>
          <p className="text-sm text-amber-700 mt-1">נסה שוב בעוד רגע.</p>
          <Button type="button" variant="outline" size="sm" className="mt-4 rounded-xl" onClick={() => void load()}>
            נסה שוב
          </Button>
        </div>
      )}

      {!loading && !error && logs.length === 0 && (
        <p className="text-center text-muted-foreground py-16">עדיין לא בוצעו שליחות.</p>
      )}

      {!loading && !error && logs.length > 0 && (
        <div className="rounded-2xl border border-violet-100/80 bg-white/90 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-violet-50/60 border-b border-violet-100">
                  <th className="p-3 text-right font-medium text-muted-foreground">תאריך ושעה</th>
                  <th className="p-3 text-right font-medium text-muted-foreground">סוג הודעה</th>
                  <th className="p-3 text-right font-medium text-muted-foreground">סטטוס</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id} className="border-t border-violet-50 hover:bg-violet-50/30 transition-colors">
                    <td className="p-3 text-muted-foreground whitespace-nowrap text-xs">
                      {formatDate(log.created_at)}
                    </td>
                    <td className="p-3 font-medium">
                      {TRIGGER_LABELS[log.trigger_type] ?? log.trigger_type}
                    </td>
                    <td className="p-3">
                      {log.status === 'success' ? (
                        <span className="inline-flex items-center gap-1.5 text-green-700 font-medium">
                          <CheckCircle2 className="h-4 w-4 shrink-0" />
                          נשלח
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-red-600 font-medium">
                          <XCircle className="h-4 w-4 shrink-0" />
                          נכשל
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
