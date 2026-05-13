import { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, Eye, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { buildTransactionalEmailHtml } from '@/lib/emailTransactionalHtml';
import { applyTemplateVars } from '@/lib/templateVariables';
import { fetchTemplates } from '@/services/automation';
import type { Database } from '@/integrations/supabase/types';

type Tpl = Database['public']['Tables']['automation_templates']['Row'];

const DEMO_CTX = {
  first_name: 'ירין',
  last_name: 'חיון',
  email: 'yarin@example.com',
  phone: '050-0000000',
  points: '320',
  community_name: 'Clicks',
  event_name: 'מפגש קהילה',
  event_date: '01/06/2025',
};

const CAT_LABELS: Record<string, string> = {
  birthday: 'יום הולדת',
  event_reminder: 'תזכורת אירוע',
  approval: 'אישור לקהילה',
  points: 'נקודות',
  custom: 'כללי',
};

export function ManagerTemplatesPanel({ onBack }: { onBack: () => void }) {
  const [templates, setTemplates] = useState<Tpl[]>([]);
  const [loading, setLoading] = useState(true);
  const [preview, setPreview] = useState<Tpl | null>(null);

  const load = useCallback(async () => {
    try {
      const t = await fetchTemplates();
      setTemplates(t as Tpl[]);
    } catch {
      // silent — no sensitive technical errors for managers
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const previewHtml = useMemo(() => {
    if (!preview) return '';
    const logo = (import.meta as { env?: Record<string, string> }).env?.VITE_EMAIL_LOGO_URL?.trim();
    const subject = applyTemplateVars(preview.subject, DEMO_CTX);
    const body = applyTemplateVars(preview.body, DEMO_CTX);
    const isHtml = /<\s*(table|p|div|a|img|h1|h2|br)\b/i.test(body);
    return buildTransactionalEmailHtml({
      logoUrl: logo || undefined,
      subjectLine: subject,
      bodyText: isHtml ? '' : body,
      bodyHtmlFragment: isHtml ? body : undefined,
      footerLine: 'צוות Clicks',
      brandAccentColor: '#7c3aed',
    });
  }, [preview]);

  return (
    <div dir="rtl" className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onBack}
          className="p-2 rounded-xl hover:bg-violet-50 text-violet-600 transition-colors"
        >
          <ArrowRight className="h-5 w-5" />
        </button>
        <h2 className="text-xl font-bold text-violet-950">תבניות מייל</h2>
      </div>

      {/* List */}
      {loading ? (
        <p className="text-center text-muted-foreground py-16">טוען תבניות…</p>
      ) : templates.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-muted-foreground">אין תבניות זמינות כרגע.</p>
          <p className="text-sm text-muted-foreground mt-1">ניתן ליצור תבניות חדשות דרך אזור המפתחים.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {templates.map((t) => (
            <div
              key={t.id}
              className="flex items-start justify-between gap-3 rounded-2xl border border-violet-100/80 bg-white/90 p-4 shadow-sm"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold text-foreground">{t.name}</p>
                  {t.category ? (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-violet-100 text-violet-700 border border-violet-200/80">
                      {CAT_LABELS[t.category] ?? t.category}
                    </span>
                  ) : null}
                  {t.status === 'draft' ? (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200/80">
                      טיוטה
                    </span>
                  ) : null}
                </div>
                <p className="text-sm text-muted-foreground mt-1 truncate max-w-xs">{t.subject}</p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="rounded-xl shrink-0 gap-1.5"
                onClick={() => setPreview(t)}
              >
                <Eye className="h-4 w-4" />
                תצוגה
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Preview modal */}
      <AnimatePresence>
        {preview && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
            onClick={() => setPreview(null)}
          >
            <motion.div
              initial={{ scale: 0.96, y: 16 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.96, y: 16 }}
              transition={{ type: 'spring', stiffness: 380, damping: 28 }}
              className="relative bg-white rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl"
              style={{ maxHeight: '90dvh' }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-5 py-4 border-b border-violet-100">
                <p className="font-semibold text-foreground">{preview.name}</p>
                <button
                  type="button"
                  onClick={() => setPreview(null)}
                  className="rounded-xl p-2 hover:bg-violet-50 text-muted-foreground transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="overflow-y-auto" style={{ maxHeight: 'calc(90dvh - 64px)' }}>
                <iframe
                  srcDoc={previewHtml}
                  title="תצוגה מקדימה"
                  className="w-full border-0"
                  style={{ height: '640px', minHeight: '400px' }}
                />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
