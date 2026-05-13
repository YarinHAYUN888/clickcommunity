import { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import {
  AlertTriangle,
  ArrowRight,
  Check,
  ChevronLeft,
  Code2,
  Monitor,
  Smartphone,
} from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { EVENT_REGISTRATION_FILTERS } from '@/components/admin/automation/constants';
import { EmailBlockEditor } from '@/components/admin/automation/manager/EmailBlockEditor';
import { AUTOMATION_PRESETS, MANAGER_WIZARD_SEGMENT_GROUPS } from '@/components/admin/automation/manager/wizardConstants';
import { AudiencePickerModal } from '@/components/admin/automation/manager/AudiencePickerModal';
import {
  fetchTemplates,
  invokeRecipients,
  invokeDispatch,
  buildPayloadFromTemplate,
  eventToTemplateContext,
  recipientToTemplateContext,
  type RecipientUser,
  type AutomationSegmentFilters,
} from '@/services/automation';
import { getClientAutomationMode, isProductionCampaignsEnabled } from '@/lib/automationEnv';
import { isLikelyAutomationInfraMissing } from '@/lib/automationErrors';
import {
  compileEmailDocumentToHtml,
  defaultEmailDocumentFromPlainBody,
  parseBuilderDocument,
  type EmailBlock,
} from '@/lib/emailBlocks';
import { buildTransactionalEmailHtml } from '@/lib/emailTransactionalHtml';
import type { Database } from '@/integrations/supabase/types';

type Tpl = Database['public']['Tables']['automation_templates']['Row'];
type EventRow = Pick<
  Database['public']['Tables']['events']['Row'],
  'id' | 'name' | 'date' | 'time' | 'location_name' | 'location_address'
>;

const STEP_LABELS = ['סוג הודעה', 'קהל יעד', 'תוכן המייל', 'תצוגה ושליחה'] as const;

const TEMPLATE_VARS = [
  { v: '{{first_name}}', l: 'שם פרטי' },
  { v: '{{last_name}}', l: 'שם משפחה' },
  { v: '{{full_name}}', l: 'שם מלא' },
  { v: '{{email}}', l: 'אימייל' },
  { v: '{{phone}}', l: 'טלפון' },
  { v: '{{points}}', l: 'נקודות' },
  { v: '{{community_name}}', l: 'שם הקהילה' },
  { v: '{{event_name}}', l: 'שם האירוע' },
  { v: '{{event_date}}', l: 'תאריך האירוע' },
  { v: '{{support_email}}', l: 'מייל תמיכה' },
];

type Props = { onBackToHub?: () => void };

export function AutomationManagerWizard({ onBackToHub }: Props) {
  const [step, setStep] = useState(0);
  const [presetCategory, setPresetCategory] = useState<string | null>(null);
  const [templates, setTemplates] = useState<Tpl[]>([]);
  const [tplId, setTplId] = useState('');
  const [subject, setSubject] = useState('');
  const [blocks, setBlocks] = useState<EmailBlock[]>(() => defaultEmailDocumentFromPlainBody(''));

  const [campaignMode, setCampaignMode] = useState<'segment' | 'event'>('segment');
  const [segment, setSegment] = useState('all_members');
  const [users, setUsers] = useState<RecipientUser[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [eventId, setEventId] = useState('');
  const [eventRegFilter, setEventRegFilter] = useState('registered');
  const [pointsMin, setPointsMin] = useState(200);
  const [segmentEventId, setSegmentEventId] = useState('');
  const [audiencePickerOpen, setAudiencePickerOpen] = useState(false);

  const [previewSize, setPreviewSize] = useState<'desktop' | 'mobile'>('desktop');
  const [showConfirm, setShowConfirm] = useState(false);

  // ─── load templates + events ─────────────────────────────────────────────
  const loadMeta = useCallback(async () => {
    try {
      const t = await fetchTemplates();
      setTemplates(t as Tpl[]);
    } catch (e) {
      if (isLikelyAutomationInfraMissing(e)) {
        toast.error('המערכת אינה זמינה כרגע. נסה שוב בעוד רגע.');
      } else {
        toast.error('לא הצלחנו לטעון את התבניות. נסה שוב.');
      }
    }
    try {
      const { data: ev, error } = await supabase
        .from('events')
        .select('id, name, date, time, location_name, location_address')
        .order('date', { ascending: false })
        .limit(80);
      if (!error && ev) setEvents(ev as EventRow[]);
    } catch {
      // non-critical
    }
  }, []);

  useEffect(() => {
    void loadMeta();
  }, [loadMeta]);

  // ─── auto-select first matching template when preset changes ─────────────
  const filteredTemplates = useMemo(() => {
    if (!presetCategory) return templates;
    return templates.filter((t) => t.category === presetCategory);
  }, [templates, presetCategory]);

  useEffect(() => {
    const list = filteredTemplates;
    if (!list.length) return;
    if (list.some((t) => t.id === tplId)) return;
    const first = list[0];
    setTplId(first.id);
    setSubject(first.subject);
    const parsed = parseBuilderDocument(first.builder_document);
    setBlocks(parsed ?? defaultEmailDocumentFromPlainBody(first.body));
  }, [filteredTemplates, tplId]);

  function applyTemplate(t: Tpl) {
    setTplId(t.id);
    setSubject(t.subject);
    const parsed = parseBuilderDocument(t.builder_document);
    setBlocks(parsed ?? defaultEmailDocumentFromPlainBody(t.body));
  }

  // ─── audience loading ─────────────────────────────────────────────────────
  const loadAudience = useCallback(async () => {
    setLoading(true);
    try {
      if (campaignMode === 'event') {
        if (!eventId) {
          toast.error('יש לבחור אירוע תחילה.');
          setLoading(false);
          return;
        }
        const data = await invokeRecipients({
          action: 'event_registrations',
          event_id: eventId,
          registration_filter: eventRegFilter,
        });
        const u = data.users || [];
        setUsers(u);
        setSelectedIds(new Set(u.map((x) => x.user_id)));
        toast.success(`נמצאו ${u.length} נמענים`);
      } else {
        const filters: AutomationSegmentFilters = {};
        if (segment === 'points_min') filters.min_points = pointsMin;
        if (segment === 'event_participants') {
          if (!segmentEventId) {
            toast.error('יש לבחור אירוע עבור קהל משתתפי האירוע.');
            setLoading(false);
            return;
          }
          filters.event_id = segmentEventId;
          filters.registration_filter = 'registered';
        }
        const hasFilters = Object.keys(filters).length > 0;
        const data = await invokeRecipients({
          action: 'list_segment',
          segment,
          limit: 500,
          ...(hasFilters ? { segment_filters: filters } : {}),
        });
        const u = data.users || [];
        setUsers(u);
        setSelectedIds(new Set(u.map((x) => x.user_id)));
        toast.success(`נמצאו ${u.length} נמענים`);
      }
    } catch (e) {
      if (isLikelyAutomationInfraMissing(e)) {
        toast.error('לא הצלחנו לטעון את הקהל כרגע. נסה שוב בעוד רגע.');
        setUsers([]);
        setSelectedIds(new Set());
      } else {
        toast.error('לא הצלחנו לטעון משתמשים. נסה שוב.');
      }
    }
    setLoading(false);
  }, [campaignMode, eventId, eventRegFilter, segment, pointsMin, segmentEventId]);

  const loadWizardAudienceForPicker = useCallback(async (): Promise<RecipientUser[]> => {
    if (campaignMode === 'event') {
      if (!eventId) throw new Error('event');
      const data = await invokeRecipients({
        action: 'event_registrations',
        event_id: eventId,
        registration_filter: eventRegFilter,
      });
      return (data.users || []) as RecipientUser[];
    }
    const filters: AutomationSegmentFilters = {};
    if (segment === 'points_min') filters.min_points = pointsMin;
    if (segment === 'event_participants') {
      if (!segmentEventId) throw new Error('segment_event');
      filters.event_id = segmentEventId;
      filters.registration_filter = 'registered';
    }
    const hasFilters = Object.keys(filters).length > 0;
    const data = await invokeRecipients({
      action: 'list_segment',
      segment,
      limit: 500,
      ...(hasFilters ? { segment_filters: filters } : {}),
    });
    return (data.users || []) as RecipientUser[];
  }, [campaignMode, eventId, eventRegFilter, segment, pointsMin, segmentEventId]);

  // ─── segment helpers ──────────────────────────────────────────────────────
  function segmentKeyForCampaign(): string {
    if (campaignMode === 'event') return `event:${eventId}:${eventRegFilter}`;
    if (segment === 'event_participants') return `event:${segmentEventId}:registered`;
    return segment;
  }

  function segmentFiltersForCampaign(): AutomationSegmentFilters | null {
    if (campaignMode === 'event') return { event_id: eventId, registration_filter: eventRegFilter };
    if (segment === 'points_min') return { min_points: pointsMin };
    if (segment === 'event_participants' && segmentEventId) {
      return { event_id: segmentEventId, registration_filter: 'registered' };
    }
    return null;
  }

  const recipients = useMemo(
    () => (selectedIds.size === 0 ? [] : users.filter((u) => selectedIds.has(u.user_id))),
    [users, selectedIds],
  );

  // ─── full email preview HTML for step 3 ──────────────────────────────────
  const fullPreviewHtml = useMemo(() => {
    const logo = (import.meta as { env?: Record<string, string> }).env?.VITE_EMAIL_LOGO_URL?.trim();
    const bodyHtml = compileEmailDocumentToHtml(blocks);
    return buildTransactionalEmailHtml({
      logoUrl: logo || undefined,
      subjectLine: subject || '(ללא נושא)',
      bodyText: '',
      bodyHtmlFragment: bodyHtml,
      footerLine: 'צוות Clicks',
      brandAccentColor: '#7c3aed',
    });
  }, [blocks, subject]);

  // ─── send campaign ────────────────────────────────────────────────────────
  async function sendCampaign() {
    if (!isProductionCampaignsEnabled()) {
      toast.message('שים לב: שליחה לקהל רחב דורשת הגדרת production במערכת.');
    }
    const tpl = templates.find((t) => t.id === tplId);
    if (!tpl || recipients.length === 0) {
      toast.error('יש לבחור תבנית ולטעון נמענים לפני השליחה.');
      return;
    }
    const ev = events.find((e) => e.id === eventId);
    const bodyHtml = compileEmailDocumentToHtml(blocks);
    let ok = 0;
    let fail = 0;
    setSending(true);
    const mode = getClientAutomationMode();
    const segKey = segmentKeyForCampaign();
    const segFilters = segmentFiltersForCampaign();

    for (const u of recipients) {
      const ctx = {
        ...recipientToTemplateContext(u),
        ...(campaignMode === 'event' && ev ? eventToTemplateContext(ev) : {}),
      };
      const payload = buildPayloadFromTemplate(
        mode,
        'manual_send',
        { id: tpl.id, subject, body: bodyHtml },
        u,
        ctx,
        campaignMode === 'event' && ev
          ? {
              id: ev.id,
              name: ev.name,
              date: String(ev.date),
              time: String(ev.time),
              location_name: ev.location_name ?? '',
              location_address: ev.location_address ?? '',
            }
          : undefined,
      );
      try {
        const res = await invokeDispatch({
          intent: 'campaign',
          automation: payload,
          template_id: tpl.id,
          recipient_mode: 'segment_member',
          recipient_user_id: u.user_id,
          segment_key: segKey,
          ...(segFilters ? { segment_filters: segFilters } : {}),
        });
        if (res.success) ok += 1;
        else fail += 1;
      } catch {
        fail += 1;
      }
    }
    setSending(false);
    if (fail === 0) {
      toast.success(`נשלחו בהצלחה ${ok} הודעות`);
    } else {
      toast.warning(`נשלחו ${ok} הודעות, ${fail} נכשלו`);
    }
  }

  function toggleUser(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAll(on: boolean) {
    if (on) setSelectedIds(new Set(users.map((u) => u.user_id)));
    else setSelectedIds(new Set());
  }

  // ─── step progress indicator ──────────────────────────────────────────────
  function StepBar() {
    return (
      <div className="flex items-start gap-0 mb-6">
        {STEP_LABELS.map((label, i) => (
          <div key={label} className="flex items-center flex-1 min-w-0">
            <div className="flex flex-col items-center gap-1.5">
              <button
                type="button"
                onClick={() => setStep(i)}
                className={[
                  'w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm transition-all border-2 shrink-0',
                  i < step
                    ? 'bg-violet-600 border-violet-600 text-white'
                    : i === step
                    ? 'bg-white border-violet-600 text-violet-700 shadow-sm'
                    : 'bg-white border-gray-200 text-gray-400',
                ].join(' ')}
              >
                {i < step ? <Check className="h-4 w-4" /> : i + 1}
              </button>
              <span
                className={[
                  'text-[11px] text-center leading-tight hidden sm:block max-w-[72px]',
                  i === step ? 'text-violet-700 font-semibold' : 'text-muted-foreground',
                ].join(' ')}
              >
                {label}
              </span>
            </div>
            {i < STEP_LABELS.length - 1 && (
              <div
                className={[
                  'h-0.5 flex-1 mx-1 -mt-5 sm:-mt-6 rounded-full transition-all',
                  i < step ? 'bg-violet-400' : 'bg-gray-200',
                ].join(' ')}
              />
            )}
          </div>
        ))}
      </div>
    );
  }

  // ─── render ───────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4" dir="rtl">
      {/* Back to hub */}
      {onBackToHub && (
        <button
          type="button"
          onClick={onBackToHub}
          className="flex items-center gap-1.5 text-sm text-violet-600 hover:text-violet-800 transition-colors"
        >
          <ArrowRight className="h-4 w-4" />
          חזרה לדף הבית
        </button>
      )}

      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.2 }}
          className="rounded-3xl border border-white/60 bg-gradient-to-br from-white/95 via-violet-50/40 to-white/90 backdrop-blur-xl p-5 md:p-8 shadow-[0_20px_60px_-24px_rgba(124,58,237,0.35)]"
        >
          <StepBar />

          {/* ── STEP 0: Choose email type ─────────────────────────────── */}
          {step === 0 && (
            <div className="space-y-4">
              <div>
                <h2 className="text-xl font-bold text-foreground">מה נשלח היום?</h2>
                <p className="text-sm text-muted-foreground mt-1">בחר סוג הודעה — נציג תבניות מתאימות בשלב הבא</p>
              </div>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {AUTOMATION_PRESETS.map((p) => {
                  const Icon = p.icon;
                  const active = presetCategory === p.category;
                  return (
                    <motion.button
                      key={p.id}
                      type="button"
                      whileHover={{ y: -3 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => {
                        setPresetCategory(p.category);
                        setStep(1);
                      }}
                      className={[
                        'text-right rounded-2xl border p-4 transition-all',
                        active
                          ? 'border-violet-400 bg-white shadow-lg ring-2 ring-violet-200/80'
                          : 'border-violet-100/80 bg-white/80 hover:border-violet-200 hover:shadow-md',
                      ].join(' ')}
                    >
                      <div className="flex items-start gap-3">
                        <span className="rounded-xl bg-violet-100 p-2 text-violet-700 shrink-0">
                          <Icon className="h-5 w-5" />
                        </span>
                        <div>
                          <p className="font-semibold text-foreground">{p.title}</p>
                          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{p.description}</p>
                        </div>
                      </div>
                    </motion.button>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── STEP 1: Choose audience ───────────────────────────────── */}
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <h2 className="text-xl font-bold">למי נשלח?</h2>
                <p className="text-sm text-muted-foreground mt-1">בחר קהל יעד — ניתן לטעון במהירות או לבחור ידנית</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={campaignMode === 'segment' ? 'default' : 'outline'}
                  className="rounded-full"
                  onClick={() => setCampaignMode('segment')}
                >
                  לפי קהל
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={campaignMode === 'event' ? 'default' : 'outline'}
                  className="rounded-full"
                  onClick={() => setCampaignMode('event')}
                >
                  לפי אירוע
                </Button>
              </div>

              <div className="grid md:grid-cols-2 gap-3">
                {campaignMode === 'segment' ? (
                  <>
                    <label className="block space-y-1 text-sm">
                      <span className="text-muted-foreground font-medium">קבוצת קהל</span>
                      <select
                        value={segment}
                        onChange={(e) => setSegment(e.target.value)}
                        className="w-full h-10 rounded-xl border border-border bg-white px-2"
                      >
                        {MANAGER_WIZARD_SEGMENT_GROUPS.map((g) => (
                          <optgroup key={g.label} label={g.label}>
                            {g.options.map((s) => (
                              <option key={s.value} value={s.value}>
                                {s.label}
                              </option>
                            ))}
                          </optgroup>
                        ))}
                      </select>
                    </label>
                    {segment === 'points_min' && (
                      <label className="block space-y-1 text-sm">
                        <span className="text-muted-foreground font-medium">מינימום נקודות</span>
                        <Input
                          type="number"
                          value={pointsMin}
                          onChange={(e) => setPointsMin(Number(e.target.value) || 0)}
                          className="bg-white"
                        />
                      </label>
                    )}
                    {segment === 'event_participants' && (
                      <label className="block space-y-1 text-sm md:col-span-2">
                        <span className="text-muted-foreground font-medium">אירוע</span>
                        <select
                          value={segmentEventId}
                          onChange={(e) => setSegmentEventId(e.target.value)}
                          className="w-full h-10 rounded-xl border border-border bg-white px-2"
                        >
                          <option value="">בחרו אירוע…</option>
                          {events.map((ev) => (
                            <option key={ev.id} value={ev.id}>
                              {ev.name}
                            </option>
                          ))}
                        </select>
                      </label>
                    )}
                  </>
                ) : (
                  <>
                    <label className="block space-y-1 text-sm">
                      <span className="text-muted-foreground font-medium">אירוע</span>
                      <select
                        value={eventId}
                        onChange={(e) => setEventId(e.target.value)}
                        className="w-full h-10 rounded-xl border border-border bg-white px-2"
                      >
                        <option value="">בחרו אירוע…</option>
                        {events.map((ev) => (
                          <option key={ev.id} value={ev.id}>
                            {ev.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="block space-y-1 text-sm">
                      <span className="text-muted-foreground font-medium">סטטוס רישום</span>
                      <select
                        value={eventRegFilter}
                        onChange={(e) => setEventRegFilter(e.target.value)}
                        className="w-full h-10 rounded-xl border border-border bg-white px-2"
                      >
                        {EVENT_REGISTRATION_FILTERS.map((s) => (
                          <option key={s.value} value={s.value}>
                            {s.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  </>
                )}
              </div>

              {/* Audience card */}
              <div className="rounded-2xl border border-violet-200/80 bg-gradient-to-br from-white via-violet-50/30 to-white p-4 space-y-3 shadow-inner">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold text-violet-950">נמענים נבחרים</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      נבחרו <span className="font-semibold text-foreground">{selectedIds.size}</span> מתוך{' '}
                      <span className="font-semibold text-foreground">{users.length}</span> שנטענו
                    </p>
                  </div>
                  <Button
                    type="button"
                    className="rounded-full bg-violet-600 hover:bg-violet-700 shadow-md"
                    onClick={() => setAudiencePickerOpen(true)}
                  >
                    בחירת חברים
                  </Button>
                </div>
                {users.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {users.slice(0, 10).map((u) => {
                      const label = [u.first_name, u.last_name].filter(Boolean).join(' ') || 'ללא שם';
                      const initials = label
                        .split(/\s+/)
                        .map((w) => w[0])
                        .join('')
                        .slice(0, 2);
                      return (
                        <div
                          key={u.user_id}
                          className="flex items-center gap-2 rounded-full border border-violet-100 bg-white/90 pl-3 pr-2 py-1.5 text-xs shadow-sm"
                        >
                          <span className="font-medium truncate max-w-[130px]">{label}</span>
                          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-violet-100 text-violet-800 font-bold text-[11px]">
                            {initials}
                          </span>
                        </div>
                      );
                    })}
                    {users.length > 10 && (
                      <span className="text-xs text-muted-foreground self-center">
                        +{users.length - 10} נוספים
                      </span>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-3">
                    טרם נבחרו נמענים. פתחו את בוחר החברים או טענו קהל מהיר.
                  </p>
                )}
              </div>

              <div className="flex gap-2 flex-wrap">
                <Button type="button" onClick={() => void loadAudience()} disabled={loading}>
                  {loading ? 'טוען…' : 'טען קהל מהיר'}
                </Button>
                <Button type="button" variant="outline" onClick={() => selectAll(true)} disabled={users.length === 0}>
                  סמן הכל
                </Button>
                <Button type="button" variant="outline" onClick={() => selectAll(false)} disabled={users.length === 0}>
                  נקה בחירה
                </Button>
              </div>

              {users.length > 0 && selectedIds.size > 0 && (
                <div className="max-h-48 overflow-y-auto rounded-xl border border-border/60 bg-white/90">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/40 sticky top-0">
                      <tr>
                        <th className="p-2 w-8" />
                        <th className="p-2 text-right">שם</th>
                        <th className="p-2 text-right hidden sm:table-cell">אימייל</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users
                        .filter((u) => selectedIds.has(u.user_id))
                        .slice(0, 100)
                        .map((u) => (
                          <tr key={u.user_id} className="border-t border-border/40">
                            <td className="p-2">
                              <Checkbox
                                checked={selectedIds.has(u.user_id)}
                                onCheckedChange={() => toggleUser(u.user_id)}
                              />
                            </td>
                            <td className="p-2">{[u.first_name, u.last_name].filter(Boolean).join(' ')}</td>
                            <td className="p-2 hidden sm:table-cell" dir="ltr">
                              {u.email}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="flex justify-between gap-2">
                <Button type="button" variant="outline" onClick={() => setStep(0)}>
                  <ChevronLeft className="h-4 w-4 ml-1" />
                  חזרה
                </Button>
                <Button type="button" className="rounded-full bg-primary" onClick={() => setStep(2)}>
                  המשך לתוכן
                </Button>
              </div>
            </div>
          )}

          {/* ── STEP 2: Edit content ──────────────────────────────────── */}
          {step === 2 && (
            <div className="space-y-4">
              <div>
                <h2 className="text-xl font-bold">תוכן ההודעה</h2>
                <p className="text-sm text-muted-foreground mt-1">ערוך את נושא ההודעה וגוף המייל</p>
              </div>

              <label className="block space-y-1 text-sm max-w-md">
                <span className="text-muted-foreground font-medium">תבנית בסיס</span>
                <select
                  value={tplId}
                  onChange={(e) => {
                    const t = templates.find((x) => x.id === e.target.value);
                    if (t) applyTemplate(t);
                  }}
                  className="w-full h-10 rounded-xl border border-border bg-white px-2"
                >
                  {(filteredTemplates.length ? filteredTemplates : templates).map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </label>

              <EmailBlockEditor
                subject={subject}
                blocks={blocks}
                onSubjectChange={setSubject}
                onBlocksChange={setBlocks}
              />

              {/* Variables helper */}
              <details className="rounded-2xl border border-violet-100/80 bg-violet-50/40 p-3 text-sm group">
                <summary className="cursor-pointer select-none list-none flex items-center gap-2 text-violet-800 font-medium">
                  <Code2 className="h-4 w-4 shrink-0" />
                  משתני תבנית זמינים
                  <span className="text-xs text-muted-foreground mr-1">(לחץ להצגה)</span>
                </summary>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 mt-3">
                  {TEMPLATE_VARS.map(({ v, l }) => (
                    <div
                      key={v}
                      className="flex items-center justify-between gap-2 bg-white rounded-lg px-2.5 py-1.5 border border-violet-100 text-[11px]"
                    >
                      <code className="text-violet-700 font-mono">{v}</code>
                      <span className="text-muted-foreground">{l}</span>
                    </div>
                  ))}
                </div>
              </details>

              <div className="flex justify-between gap-2">
                <Button type="button" variant="outline" onClick={() => setStep(1)}>
                  <ChevronLeft className="h-4 w-4 ml-1" />
                  חזרה
                </Button>
                <Button type="button" className="rounded-full bg-primary" onClick={() => setStep(3)}>
                  תצוגה מקדימה
                </Button>
              </div>
            </div>
          )}

          {/* ── STEP 3: Preview & send ────────────────────────────────── */}
          {step === 3 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-xl font-bold">תצוגה מקדימה ושליחה</h2>
                <p className="text-sm text-muted-foreground mt-1">בדוק את המייל לפני השליחה הסופית</p>
              </div>

              {/* Summary pills */}
              <div className="flex flex-wrap gap-2">
                <span className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-violet-100 text-violet-800 border border-violet-200">
                  {recipients.length} נמענים
                </span>
                <span className="inline-flex items-center text-xs px-3 py-1.5 rounded-full bg-white border border-border max-w-xs truncate">
                  נושא: {subject || '(ללא נושא)'}
                </span>
              </div>

              {/* Desktop / Mobile toggle */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPreviewSize('desktop')}
                  className={[
                    'flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border transition-all',
                    previewSize === 'desktop'
                      ? 'bg-violet-600 text-white border-violet-600'
                      : 'bg-white text-muted-foreground border-border hover:border-violet-200',
                  ].join(' ')}
                >
                  <Monitor className="h-3.5 w-3.5" />
                  מחשב
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewSize('mobile')}
                  className={[
                    'flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border transition-all',
                    previewSize === 'mobile'
                      ? 'bg-violet-600 text-white border-violet-600'
                      : 'bg-white text-muted-foreground border-border hover:border-violet-200',
                  ].join(' ')}
                >
                  <Smartphone className="h-3.5 w-3.5" />
                  נייד
                </button>
              </div>

              {/* Preview iframe */}
              <div
                className={[
                  'mx-auto overflow-hidden rounded-2xl border border-violet-100 shadow-[0_8px_32px_-12px_rgba(124,58,237,0.2)] bg-white transition-all',
                  previewSize === 'mobile' ? 'max-w-[390px]' : 'max-w-full',
                ].join(' ')}
              >
                <iframe
                  srcDoc={fullPreviewHtml}
                  title="תצוגה מקדימה של המייל"
                  className="w-full border-0 block"
                  style={{ height: previewSize === 'mobile' ? '700px' : '600px' }}
                />
              </div>

              {/* No recipients warning */}
              {recipients.length === 0 && (
                <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  לא נבחרו נמענים. חזור לשלב הקהל ובחר נמענים.
                </div>
              )}

              <div className="flex justify-between gap-2 flex-wrap">
                <Button type="button" variant="outline" onClick={() => setStep(2)}>
                  <ChevronLeft className="h-4 w-4 ml-1" />
                  חזרה לעריכה
                </Button>
                <Button
                  type="button"
                  className="rounded-full bg-violet-600 hover:bg-violet-700 px-8 shadow-md"
                  disabled={sending || recipients.length === 0}
                  onClick={() => setShowConfirm(true)}
                >
                  שליחה לקהל
                </Button>
              </div>
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {/* ── Confirm send modal ────────────────────────────────────────────── */}
      <AnimatePresence>
        {showConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
            onClick={() => setShowConfirm(false)}
          >
            <motion.div
              initial={{ scale: 0.95, y: 12 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 12 }}
              transition={{ type: 'spring', stiffness: 380, damping: 28 }}
              className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-xl font-bold text-violet-950 mb-2">אישור שליחה</h3>
              <p className="text-muted-foreground text-sm mb-1">
                על סף שליחת מייל ל‑<strong className="text-foreground">{recipients.length} נמענים</strong>.
              </p>
              <p className="text-sm text-foreground font-medium mb-4 truncate">
                נושא: {subject || '(ללא נושא)'}
              </p>
              <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-800 mb-6">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                לאחר השליחה לא ניתן לבטל. ודא שהמייל תקין.
              </div>
              <div className="flex gap-3 justify-end">
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-xl"
                  onClick={() => setShowConfirm(false)}
                >
                  ביטול
                </Button>
                <Button
                  type="button"
                  className="rounded-xl bg-violet-600 hover:bg-violet-700"
                  disabled={sending}
                  onClick={async () => {
                    setShowConfirm(false);
                    await sendCampaign();
                  }}
                >
                  {sending ? 'שולח…' : 'כן, שלח'}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Audience picker modal ─────────────────────────────────────────── */}
      <AudiencePickerModal
        open={audiencePickerOpen}
        onOpenChange={setAudiencePickerOpen}
        initialSelectedIds={selectedIds}
        initialUsers={users}
        events={events.map((e) => ({ id: e.id, name: e.name }))}
        loadWizardAudience={loadWizardAudienceForPicker}
        onApply={(resolved, ids) => {
          setUsers(resolved);
          setSelectedIds(ids);
          toast.success(`עודכנו ${ids.size} נמענים נבחרים`);
        }}
      />
    </div>
  );
}
