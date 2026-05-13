import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Pencil, Plus, Search, Trash2, Eye, Copy } from 'lucide-react';
import { toast } from 'sonner';
import type { Database } from '@/integrations/supabase/types';
import {
  applyTemplateVars,
  type TemplateContext,
} from '@/lib/templateVariables';
import { buildTransactionalEmailHtml } from '@/lib/emailTransactionalHtml';
import {
  createTemplate,
  deleteTemplate,
  duplicateTemplate,
  fetchTemplates,
  updateTemplate,
} from '@/services/automation';
import { isLikelyAutomationInfraMissing } from '@/lib/automationErrors';
import { AutomationSetupBanner } from '@/components/admin/automation/AutomationSetupBanner';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

type Row = Database['public']['Tables']['automation_templates']['Row'];

const demoCtx: TemplateContext = {
  first_name: 'תמר',
  last_name: 'דוגמה',
  email: 'user@example.com',
  phone: '0500000000',
  points: 200,
  birthday: '15.5.1995',
  event_name: 'מפגש קהילה',
  event_date: '2026-06-01',
  event_time: '19:30',
  location_name: 'תל אביב',
  location_address: 'רחוב הרצל 1',
};

export function TemplatesTab() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState<Row | 'new' | null>(null);
  const [previewOpen, setPreviewOpen] = useState<Row | null>(null);
  const [form, setForm] = useState({
    name: '',
    subject: '',
    body: '',
    category: 'custom',
    status: 'active',
  });
  const [infraMissing, setInfraMissing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await fetchTemplates());
      setInfraMissing(false);
    } catch (e) {
      console.error(e);
      if (isLikelyAutomationInfraMissing(e)) {
        setInfraMissing(true);
        setRows([]);
      } else {
        toast.error('לא ניתן לטעון תבניות');
      }
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const previewHtml = useMemo(() => {
    if (!previewOpen) return '';
    const subject = applyTemplateVars(previewOpen.subject, demoCtx);
    const body = applyTemplateVars(previewOpen.body, demoCtx);
    const logo = import.meta.env.VITE_EMAIL_LOGO_URL?.trim();
    const htmlMode = /<\s*(table|p|div|a|img|h1|h2|br)\b/i.test(body);
    return buildTransactionalEmailHtml({
      logoUrl: logo || undefined,
      subjectLine: subject,
      bodyText: htmlMode ? '' : body,
      bodyHtmlFragment: htmlMode ? body : undefined,
      footerLine: 'צוות Clicks',
      brandAccentColor: '#7c3aed',
    });
  }, [previewOpen]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter(
      (r) =>
        r.name.toLowerCase().includes(s) ||
        r.subject.toLowerCase().includes(s) ||
        r.category.toLowerCase().includes(s),
    );
  }, [rows, q]);

  function openNew() {
    setForm({ name: '', subject: '', body: '', category: 'custom', status: 'active' });
    setEditing('new');
  }

  function openEdit(r: Row) {
    setForm({
      name: r.name,
      subject: r.subject,
      body: r.body,
      category: r.category,
      status: r.status,
    });
    setEditing(r);
  }

  async function handleSave() {
    try {
      if (editing === 'new') {
        await createTemplate(form);
        toast.success('התבנית נוצרה');
      } else if (editing && editing !== 'new') {
        await updateTemplate(editing.id, form);
        toast.success('התבנית עודכנה');
      }
      setEditing(null);
      await load();
    } catch (e) {
      console.error(e);
      toast.error('שמירה נכשלה');
    }
  }

  async function handleDelete(r: Row) {
    if (r.is_system) {
      if (!window.confirm('תבנית מערכת — למחוק בכל זאת?')) return;
    } else if (!window.confirm('למחוק את התבנית?')) return;
    try {
      await deleteTemplate(r.id);
      toast.success('נמחק');
      await load();
    } catch (e) {
      console.error(e);
      toast.error('מחיקה נכשלה');
    }
  }

  async function handleDuplicate(r: Row) {
    try {
      await duplicateTemplate(r.id);
      toast.success('נוצרה עותק');
      await load();
    } catch (e) {
      console.error(e);
      toast.error('שכפול נכשל');
    }
  }

  return (
    <div className="space-y-4" dir="rtl">
      {infraMissing && <AutomationSetupBanner />}
      <div className="flex flex-wrap items-center gap-3 justify-between">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="חיפוש לפי שם או נושא..."
            className="pr-10 bg-white"
          />
        </div>
        <Button
          type="button"
          onClick={openNew}
          className="gap-2 rounded-full bg-primary"
        >
          <Plus className="h-4 w-4" />
          תבנית חדשה
        </Button>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground text-center py-12">טוען…</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-12">אין תבניות להצגה</p>
      ) : (
        <div className="rounded-2xl border border-border/60 overflow-hidden bg-white/90 shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-muted/40">
              <tr className="text-right">
                <th className="p-3 font-semibold">שם</th>
                <th className="p-3 font-semibold hidden md:table-cell">נושא</th>
                <th className="p-3 font-semibold">קטגוריה</th>
                <th className="p-3 font-semibold">סטטוס</th>
                <th className="p-3 w-40"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <motion.tr
                  key={r.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="border-t border-border/50 hover:bg-primary/[0.04]"
                >
                  <td className="p-3 font-medium">{r.name}</td>
                  <td className="p-3 text-muted-foreground hidden md:table-cell line-clamp-1">{r.subject}</td>
                  <td className="p-3">{r.category}</td>
                  <td className="p-3">{r.status}</td>
                  <td className="p-3">
                    <div className="flex gap-1 justify-end">
                      <button
                        type="button"
                        className="p-2 rounded-lg hover:bg-muted"
                        onClick={() => setPreviewOpen(r)}
                        aria-label="תצוגה מקדימה"
                      >
                        <Eye className="h-4 w-4 text-primary" />
                      </button>
                      <button
                        type="button"
                        className="p-2 rounded-lg hover:bg-muted"
                        onClick={() => void handleDuplicate(r)}
                        aria-label="שכפול"
                      >
                        <Copy className="h-4 w-4 text-muted-foreground" />
                      </button>
                      <button
                        type="button"
                        className="p-2 rounded-lg hover:bg-muted"
                        onClick={() => openEdit(r)}
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        className="p-2 rounded-lg hover:bg-destructive/10"
                        onClick={() => void handleDelete(r)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </button>
                    </div>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-6 bg-black/30 backdrop-blur-sm">
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-t-3xl md:rounded-2xl border border-border bg-white p-5 shadow-xl"
          >
            <h3 className="text-lg font-bold mb-4">{editing === 'new' ? 'תבנית חדשה' : 'עריכת תבנית'}</h3>
            <div className="space-y-3">
              <label className="block space-y-1">
                <span className="text-xs text-muted-foreground">שם</span>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="bg-white" />
              </label>
              <label className="block space-y-1">
                <span className="text-xs text-muted-foreground">נושא</span>
                <Input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} className="bg-white" />
              </label>
              <label className="block space-y-1">
                <span className="text-xs text-muted-foreground">גוף ההודעה — placeholders כמו first_name בסוגריים כפולים</span>
                <textarea
                  value={form.body}
                  onChange={(e) => setForm({ ...form, body: e.target.value })}
                  rows={8}
                  className="w-full rounded-xl border border-border bg-white px-3 py-2 text-sm"
                />
              </label>
              <div className="grid grid-cols-2 gap-2">
                <label className="block space-y-1">
                  <span className="text-xs text-muted-foreground">קטגוריה</span>
                  <Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="bg-white" />
                </label>
                <label className="block space-y-1">
                  <span className="text-xs text-muted-foreground">סטטוס</span>
                  <select
                    value={form.status}
                    onChange={(e) => setForm({ ...form, status: e.target.value })}
                    className="w-full h-10 rounded-xl border border-border bg-white px-2 text-sm"
                  >
                    <option value="active">פעיל</option>
                    <option value="draft">טיוטה</option>
                    <option value="archived">בארכיון</option>
                  </select>
                </label>
              </div>
            </div>
            <div className="flex gap-2 justify-end mt-6">
              <Button type="button" variant="outline" onClick={() => setEditing(null)}>
                ביטול
              </Button>
              <Button type="button" onClick={() => void handleSave()} className="bg-primary">
                שמירה
              </Button>
            </div>
          </motion.div>
        </div>
      )}

      {previewOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-full max-w-lg rounded-2xl border border-border bg-white p-5 shadow-xl max-h-[85vh] overflow-y-auto"
          >
            <h3 className="text-lg font-bold mb-2">תצוגה מקדימה (HTML)</h3>
            <p className="text-xs text-muted-foreground mb-2">
              נתוני דוגמה; לוגו מוצג אם הוגדר <code className="bg-muted px-1 rounded text-[10px]">VITE_EMAIL_LOGO_URL</code>{' '}
              (כמו <code className="bg-muted px-1 rounded text-[10px]">EMAIL_LOGO_URL</code> בשרת).
            </p>
            <div className="rounded-xl border border-border/50 overflow-hidden bg-white">
              <iframe
                title="תצוגת אימייל"
                className="w-full min-h-[360px] border-0 bg-white"
                srcDoc={previewHtml}
              />
            </div>
            <Button className="mt-4 w-full" variant="outline" onClick={() => setPreviewOpen(null)}>
              סגירה
            </Button>
          </motion.div>
        </div>
      )}
    </div>
  );
}
