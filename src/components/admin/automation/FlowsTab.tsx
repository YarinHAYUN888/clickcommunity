import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Plus, Pencil, Trash2, Zap } from 'lucide-react';
import { toast } from 'sonner';
import type { Database, Json } from '@/integrations/supabase/types';
import {
  fetchTemplates,
  fetchFlows,
  saveFlow,
  deleteFlow,
  invokeDispatch,
  buildPayloadFromTemplate,
  recipientToTemplateContext,
  type RecipientUser,
} from '@/services/automation';
import { getClientAutomationMode, isProductionCampaignsEnabled } from '@/lib/automationEnv';
import { automationDispatchFailureMessage, isLikelyAutomationInfraMissing } from '@/lib/automationErrors';
import { AutomationSetupBanner } from '@/components/admin/automation/AutomationSetupBanner';
import { FLOW_TRIGGERS } from './constants';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

type FlowRow = Database['public']['Tables']['automation_flows']['Row'];
type TemplateRow = Database['public']['Tables']['automation_templates']['Row'];

export function FlowsTab() {
  const [flows, setFlows] = useState<FlowRow[]>([]);
  const [templates, setTemplates] = useState<TemplateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<FlowRow | 'new' | null>(null);
  const [form, setForm] = useState({
    name: '',
    trigger_type: 'manual_send',
    conditions: '{}',
    actions: '[{"type":"send_email_webhook"}]',
    template_id: '' as string,
    is_active: false,
  });
  const [infraMissing, setInfraMissing] = useState(false);
  const [manualTestEmail, setManualTestEmail] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [f, t] = await Promise.all([fetchFlows(), fetchTemplates()]);
      setFlows(f as FlowRow[]);
      setTemplates(t as TemplateRow[]);
      setInfraMissing(false);
    } catch (e) {
      console.error(e);
      if (isLikelyAutomationInfraMissing(e)) {
        setInfraMissing(true);
        setFlows([]);
        setTemplates([]);
      } else {
        toast.error('טעינת זרימות נכשלה');
      }
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function openNew() {
    setForm({
      name: '',
      trigger_type: 'manual_send',
      conditions: '{}',
      actions: '[{"type":"send_email_webhook"}]',
      template_id: templates[0]?.id || '',
      is_active: false,
    });
    setEditing('new');
  }

  function openEdit(f: FlowRow) {
    setForm({
      name: f.name,
      trigger_type: f.trigger_type,
      conditions: JSON.stringify(f.conditions ?? {}, null, 2),
      actions: JSON.stringify(f.actions ?? [], null, 2),
      template_id: f.template_id || '',
      is_active: f.is_active,
    });
    setEditing(f);
  }

  async function handleSave() {
    try {
      let conditions: Record<string, unknown> = {};
      let actions: unknown[] = [];
      try {
        conditions = JSON.parse(form.conditions) as Record<string, unknown>;
      } catch {
        toast.error('תנאים — JSON לא תקין');
        return;
      }
      try {
        actions = JSON.parse(form.actions) as unknown[];
      } catch {
        toast.error('פעולות — JSON לא תקין');
        return;
      }

      await saveFlow({
        id: editing !== 'new' && editing ? editing.id : undefined,
        name: form.name,
        trigger_type: form.trigger_type,
        conditions: conditions as Json,
        actions: actions as Json,
        template_id: form.template_id || null,
        is_active: form.is_active,
      });
      toast.success('הזרימה נשמרה');
      setEditing(null);
      await load();
    } catch (e) {
      console.error(e);
      toast.error('שמירה נכשלה');
    }
  }

  async function handleDelete(f: FlowRow) {
    if (!window.confirm('למחוק זרימה?')) return;
    try {
      await deleteFlow(f.id);
      toast.success('נמחק');
      await load();
    } catch (e) {
      console.error(e);
      toast.error('מחיקה נכשלה');
    }
  }

  async function testFlow(f: FlowRow) {
    const tpl = templates.find((t) => t.id === f.template_id);
    if (!tpl) {
      toast.error('בחר תבנית לזרימה');
      return;
    }
    const sample: RecipientUser = {
      user_id: '00000000-0000-0000-0000-000000000000',
      first_name: 'בדיקה',
      last_name: 'מערכת',
      phone: '0500000000',
      email: '',
      date_of_birth: null,
      points: 200,
      role: 'member',
      status: 'new',
    };
    const ctx = recipientToTemplateContext(sample);
    const mode = getClientAutomationMode();
    const payload = buildPayloadFromTemplate(mode, f.trigger_type, { id: tpl.id, subject: tpl.subject, body: tpl.body }, sample, ctx);
    try {
      const em = manualTestEmail.trim();
      const res = await invokeDispatch({
        intent: 'test_send',
        automation: payload,
        template_id: tpl.id,
        flow_id: f.id,
        ...(em ? { recipient_mode: 'manual_test' as const, manual_test_email: em } : {}),
      });
      if (res.success) toast.success('נשלח ל־webhook (בדיקה)');
      else toast.error(automationDispatchFailureMessage(res));
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : 'בדיקה נכשלה');
    }
  }

  return (
    <div className="space-y-4" dir="rtl">
      {infraMissing && <AutomationSetupBanner />}
      <div className="flex justify-between items-center flex-wrap gap-3">
        <div className="space-y-2 max-w-xl">
          <p className="text-sm text-muted-foreground">
            הגדרת טריגר, תנאים (JSON) ופעולות. שליחת אימייל בפועל מתבצעת ב־N8N דרך webhook.
          </p>
          <label className="block space-y-1 text-xs text-muted-foreground">
            אימייל לבדיקת זרימה (מומלץ — נשלח כ־manual_test)
            <Input
              dir="ltr"
              type="email"
              placeholder={isProductionCampaignsEnabled() ? 'you@example.com' : 'חובה כשהשרת במצב test'}
              value={manualTestEmail}
              onChange={(e) => setManualTestEmail(e.target.value)}
              className="h-9 rounded-xl max-w-sm bg-white"
            />
          </label>
          <p className="text-xs text-muted-foreground">
            בדיקות מלאות עם תבנית, קהל ו־<code className="bg-muted/80 px-1 rounded">template.body_html</code>:{' '}
            <Link to="/admin/automation?tab=integration" className="text-primary font-medium underline underline-offset-2">
              טאב מפתחים
            </Link>
          </p>
        </div>
        <Button type="button" onClick={openNew} className="gap-2 rounded-full bg-primary shrink-0">
          <Plus className="h-4 w-4" />
          זרימה חדשה
        </Button>
      </div>

      {loading ? (
        <p className="text-center py-12 text-muted-foreground">טוען…</p>
      ) : flows.length === 0 ? (
        <p className="text-center py-12 text-muted-foreground">אין זרימות עדיין</p>
      ) : (
        <div className="grid gap-3">
          {flows.map((f) => (
            <motion.div
              key={f.id}
              layout
              className="rounded-2xl border border-border/60 bg-white/95 p-4 shadow-sm flex flex-wrap items-center justify-between gap-3"
            >
              <div>
                <p className="font-semibold text-foreground">{f.name}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  טריגר: {f.trigger_type} · {f.is_active ? 'פעיל' : 'כבוי'}
                </p>
              </div>
              <div className="flex gap-2">
                <Button type="button" size="sm" variant="outline" className="gap-1" onClick={() => void testFlow(f)}>
                  <Zap className="h-3 w-3" />
                  בדיקה
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={() => openEdit(f)}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={() => void handleDelete(f)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm overflow-y-auto">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-2xl rounded-2xl border border-border bg-white p-5 shadow-xl my-8"
          >
            <h3 className="text-lg font-bold mb-4">{editing === 'new' ? 'זרימה חדשה' : 'עריכת זרימה'}</h3>
            <div className="space-y-3">
              <label className="block space-y-1">
                <span className="text-xs text-muted-foreground">שם הזרימה</span>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="bg-white" />
              </label>
              <label className="block space-y-1">
                <span className="text-xs text-muted-foreground">טריגר</span>
                <select
                  value={form.trigger_type}
                  onChange={(e) => setForm({ ...form, trigger_type: e.target.value })}
                  className="w-full h-10 rounded-xl border border-border bg-white px-2 text-sm"
                >
                  {FLOW_TRIGGERS.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block space-y-1">
                <span className="text-xs text-muted-foreground">תבנית</span>
                <select
                  value={form.template_id}
                  onChange={(e) => setForm({ ...form, template_id: e.target.value })}
                  className="w-full h-10 rounded-xl border border-border bg-white px-2 text-sm"
                >
                  <option value="">—</option>
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block space-y-1">
                <span className="text-xs text-muted-foreground">תנאים (JSON)</span>
                <textarea
                  value={form.conditions}
                  onChange={(e) => setForm({ ...form, conditions: e.target.value })}
                  rows={4}
                  className="w-full rounded-xl border border-border bg-muted/20 font-mono text-xs p-2"
                />
              </label>
              <label className="block space-y-1">
                <span className="text-xs text-muted-foreground">פעולות (JSON מערך)</span>
                <textarea
                  value={form.actions}
                  onChange={(e) => setForm({ ...form, actions: e.target.value })}
                  rows={4}
                  className="w-full rounded-xl border border-border bg-muted/20 font-mono text-xs p-2"
                />
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                  className="rounded border-border"
                />
                <span className="text-sm">זרימה פעילה</span>
              </label>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <Button type="button" variant="outline" onClick={() => setEditing(null)}>
                ביטול
              </Button>
              <Button type="button" className="bg-primary" onClick={() => void handleSave()}>
                שמירה
              </Button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
