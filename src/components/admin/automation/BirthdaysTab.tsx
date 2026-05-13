import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  fetchTemplates,
  invokeRecipients,
  invokeDispatch,
  buildPayloadFromTemplate,
  recipientToTemplateContext,
  type RecipientUser,
} from '@/services/automation';
import { getClientAutomationMode, isProductionCampaignsEnabled } from '@/lib/automationEnv';
import { automationDispatchFailureMessage, isLikelyAutomationInfraMissing } from '@/lib/automationErrors';
import { AutomationSetupBanner } from '@/components/admin/automation/AutomationSetupBanner';
import { Button } from '@/components/ui/button';
import type { Database } from '@/integrations/supabase/types';

type Tpl = Database['public']['Tables']['automation_templates']['Row'];

function ageFromDob(dob: string | null): number | null {
  if (!dob) return null;
  const d = new Date(dob);
  const t = new Date();
  let a = t.getFullYear() - d.getFullYear();
  const m = t.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && t.getDate() < d.getDate())) a -= 1;
  return a;
}

export function BirthdaysTab() {
  const [tplId, setTplId] = useState('');
  const [templates, setTemplates] = useState<Tpl[]>([]);
  const [loading, setLoading] = useState(true);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [infraMissing, setInfraMissing] = useState(false);
  const [groups, setGroups] = useState<{
    today: RecipientUser[];
    thisWeek: RecipientUser[];
    thisMonth: RecipientUser[];
    all: RecipientUser[];
  } | null>(null);

  const loadAll = useCallback(async () => {
    setLoading(true);
    let infra = false;
    try {
      const t = await fetchTemplates();
      const list = t as Tpl[];
      setTemplates(list);
      const b = list.find((x) => x.category === 'birthday');
      setTplId(b?.id || list[0]?.id || '');
    } catch (e) {
      console.error(e);
      if (isLikelyAutomationInfraMissing(e)) infra = true;
      else toast.error('טעינת תבניות נכשלה');
    }
    try {
      const data = await invokeRecipients({ action: 'birthday_dashboard' });
      setGroups({
        today: (data.today as RecipientUser[]) || [],
        thisWeek: (data.thisWeek as RecipientUser[]) || [],
        thisMonth: (data.thisMonth as RecipientUser[]) || [],
        all: (data.all as RecipientUser[]) || [],
      });
    } catch (e) {
      console.error(e);
      if (isLikelyAutomationInfraMissing(e)) {
        infra = true;
        setGroups({ today: [], thisWeek: [], thisMonth: [], all: [] });
      } else {
        toast.error('טעינת ימי הולדת נכשלה');
      }
    }
    setInfraMissing(infra);
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  async function sendToUser(u: RecipientUser) {
    const tpl = templates.find((t) => t.id === tplId);
    if (!tpl) {
      toast.error('בחר תבנית יום הולדת');
      return;
    }
    setSendingId(u.user_id);
    const ctx = recipientToTemplateContext(u);
    const mode = getClientAutomationMode();
    const payload = buildPayloadFromTemplate(
      mode,
      'birthday_today',
      { id: tpl.id, subject: tpl.subject, body: tpl.body },
      u,
      ctx,
    );
    try {
      const res = await invokeDispatch({
        intent: 'test_send',
        automation: payload,
        template_id: tpl.id,
        ...(isProductionCampaignsEnabled()
          ? { recipient_mode: 'single_user' as const, recipient_user_id: u.user_id }
          : {}),
      });
      if (res.success) toast.success('נשלח ל־webhook');
      else toast.error(automationDispatchFailureMessage(res));
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : 'שגיאה');
    }
    setSendingId(null);
  }

  async function bulkSend(list: RecipientUser[]) {
    if (!list.length) return;
    const tpl = templates.find((t) => t.id === tplId);
    if (!tpl) {
      toast.error('בחר תבנית');
      return;
    }
    if (!window.confirm(`לשלוח ${list.length} webhooks?`)) return;
    let ok = 0,
      fail = 0;
    const mode = getClientAutomationMode();
    for (const u of list) {
      const ctx = recipientToTemplateContext(u);
      const payload = buildPayloadFromTemplate(
        mode,
        'birthday_today',
        { id: tpl.id, subject: tpl.subject, body: tpl.body },
        u,
        ctx,
      );
      try {
        const res = await invokeDispatch({
          intent: 'campaign',
          automation: payload,
          template_id: tpl.id,
          recipient_mode: 'segment_member',
          recipient_user_id: u.user_id,
          segment_key: 'birthday_dashboard',
        });
        if (res.success) ok += 1;
        else fail += 1;
      } catch {
        fail += 1;
      }
    }
    toast.success(`נשלחו: ${ok}, שגיאות: ${fail}`);
  }

  function UserTable({ list, title }: { list: RecipientUser[]; title: string }) {
    if (!list.length) return null;
    return (
      <div className="rounded-2xl border border-border/60 bg-white/95 overflow-hidden mb-4">
        <div className="px-3 py-2 border-b border-border/50 font-semibold text-sm flex justify-between items-center">
          <span>{title}</span>
          <Button type="button" size="sm" variant="outline" className="rounded-full text-xs" onClick={() => void bulkSend(list)}>
            שליחה מרוכזת לקבוצה
          </Button>
        </div>
        <div className="overflow-x-auto max-h-64 overflow-y-auto">
          <table className="w-full text-xs">
            <thead className="bg-muted/30 sticky top-0">
              <tr>
                <th className="text-right p-2">שם</th>
                <th className="text-right p-2 hidden sm:table-cell">אימייל</th>
                <th className="text-right p-2 hidden md:table-cell">טלפון</th>
                <th className="text-right p-2">תאריך לידה</th>
                <th className="text-right p-2">גיל</th>
                <th className="text-right p-2 w-24"></th>
              </tr>
            </thead>
            <tbody>
              {list.map((u) => (
                <tr key={u.user_id} className="border-t border-border/40">
                  <td className="p-2">{[u.first_name, u.last_name].filter(Boolean).join(' ') || '—'}</td>
                  <td className="p-2 hidden sm:table-cell" dir="ltr">
                    {u.email}
                  </td>
                  <td className="p-2 hidden md:table-cell" dir="ltr">
                    {u.phone}
                  </td>
                  <td className="p-2">{u.date_of_birth || '—'}</td>
                  <td className="p-2">{ageFromDob(u.date_of_birth) ?? '—'}</td>
                  <td className="p-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      className="h-7 text-[11px]"
                      disabled={sendingId === u.user_id}
                      onClick={() => void sendToUser(u)}
                    >
                      שלח
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4" dir="rtl">
      {infraMissing && <AutomationSetupBanner />}
      <div className="flex flex-wrap gap-3 items-end justify-between">
        <label className="space-y-1">
          <span className="text-xs text-muted-foreground">תבנית ברכה</span>
          <select
            value={tplId}
            onChange={(e) => setTplId(e.target.value)}
            className="h-10 min-w-[220px] rounded-xl border border-border bg-white px-2 text-sm"
          >
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
        <Button type="button" variant="outline" onClick={() => void loadAll()} disabled={loading} className="rounded-full">
          רענון
        </Button>
      </div>

      {loading || !groups ? (
        <p className="text-center text-muted-foreground py-12">טוען…</p>
      ) : (
        <>
          <UserTable list={groups.today} title="היום 🎂" />
          <UserTable list={groups.thisWeek} title="השבוע" />
          <UserTable list={groups.thisMonth} title="החודש" />
          {!groups.today.length && !groups.thisWeek.length && !groups.thisMonth.length && (
            <p className="text-center text-muted-foreground py-8">אין ימי הולדת בטווח המחושב</p>
          )}
        </>
      )}
    </div>
  );
}
