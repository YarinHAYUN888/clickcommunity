import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
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
import { automationDispatchFailureMessage, isLikelyAutomationInfraMissing } from '@/lib/automationErrors';
import { AutomationSetupBanner } from '@/components/admin/automation/AutomationSetupBanner';
import { AutomationUserPicker } from '@/components/admin/automation/AutomationUserPicker';
import { SEGMENT_OPTIONS, EVENT_REGISTRATION_FILTERS } from './constants';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { Database } from '@/integrations/supabase/types';

type Tpl = Database['public']['Tables']['automation_templates']['Row'];
type EventRow = Pick<
  Database['public']['Tables']['events']['Row'],
  'id' | 'name' | 'date' | 'time' | 'location_name' | 'location_address'
>;

function placeholderRecipient(): RecipientUser {
  return {
    user_id: '00000000-0000-0000-0000-000000000001',
    first_name: 'בדיקה',
    last_name: '',
    email: '',
    phone: '',
    date_of_birth: null,
    points: 0,
    role: 'member',
    status: 'new',
  };
}

/** Webhook test sends, manual email override, and integration notes — separated from day-to-day campaigns. */
export function DeveloperIntegrationTab() {
  const [templates, setTemplates] = useState<Tpl[]>([]);
  const [tplId, setTplId] = useState('');
  const [segment, setSegment] = useState('all_members');
  const [users, setUsers] = useState<RecipientUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [eventId, setEventId] = useState('');
  const [eventRegFilter, setEventRegFilter] = useState('registered');
  const [campaignMode, setCampaignMode] = useState<'segment' | 'event'>('segment');
  const [infraMissing, setInfraMissing] = useState(false);

  const [testSendKind, setTestSendKind] = useState<'manual' | 'single_user'>('manual');
  const [manualTestEmail, setManualTestEmail] = useState('');
  const [previewUser, setPreviewUser] = useState<RecipientUser | null>(null);
  const [singleTestUser, setSingleTestUser] = useState<RecipientUser | null>(null);

  const [pointsMin, setPointsMin] = useState(200);
  const [segmentEventId, setSegmentEventId] = useState('');

  const loadMeta = useCallback(async () => {
    try {
      const t = await fetchTemplates();
      setTemplates(t as Tpl[]);
      if (t[0]) setTplId((t[0] as Tpl).id);
      setInfraMissing(false);
    } catch (e) {
      console.error(e);
      if (isLikelyAutomationInfraMissing(e)) {
        setInfraMissing(true);
      } else {
        toast.error('לא ניתן לטעון תבניות');
      }
    }
    try {
      const { data: ev, error } = await supabase
        .from('events')
        .select('id, name, date, time, location_name, location_address')
        .order('date', { ascending: false })
        .limit(80);
      if (!error && ev) setEvents(ev as EventRow[]);
    } catch (e) {
      console.error(e);
    }
  }, []);

  useEffect(() => {
    void loadMeta();
  }, [loadMeta]);

  const loadAudience = useCallback(async () => {
    setLoading(true);
    try {
      if (campaignMode === 'event') {
        if (!eventId) {
          toast.error('בחר אירוע');
          setLoading(false);
          return;
        }
        const data = await invokeRecipients({
          action: 'event_registrations',
          event_id: eventId,
          registration_filter: eventRegFilter,
        });
        setUsers(data.users || []);
        setInfraMissing(false);
        toast.success(`נמצאו ${(data.users || []).length} נמענים`);
      } else {
        const filters: AutomationSegmentFilters = {};
        if (segment === 'points_min') {
          filters.min_points = pointsMin;
        }
        if (segment === 'event_participants') {
          if (!segmentEventId) {
            toast.error('בחר אירוע עבור משתתפי אירוע');
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
        setUsers(data.users || []);
        setInfraMissing(false);
        toast.success(`נמצאו ${(data.users || []).length} נמענים`);
      }
    } catch (e) {
      console.error(e);
      if (isLikelyAutomationInfraMissing(e)) {
        setInfraMissing(true);
        setUsers([]);
      } else {
        toast.error('טעינת קהל נכשלה');
      }
    }
    setLoading(false);
  }, [campaignMode, eventId, eventRegFilter, segment, pointsMin, segmentEventId]);

  async function sendTest() {
    const tpl = templates.find((t) => t.id === tplId);
    if (!tpl) {
      toast.error('בחר תבנית');
      return;
    }
    const ev = events.find((e) => e.id === eventId);
    const clientMode = getClientAutomationMode();

    let sample: RecipientUser;
    if (testSendKind === 'single_user') {
      if (!isProductionCampaignsEnabled()) {
        toast.error('שליחת בדיקה למשתמש מהמסד זמינה כשמצב האוטומציה בלקוח הוא production.');
        return;
      }
      if (!singleTestUser) {
        toast.error('בחר משתמש לשליחת הבדיקה');
        return;
      }
      sample = singleTestUser;
    } else {
      sample = previewUser || users[0] || placeholderRecipient();
    }

    const ctx = {
      ...recipientToTemplateContext(sample),
      ...(campaignMode === 'event' && ev ? eventToTemplateContext(ev) : {}),
    };
    const mode = clientMode;
    const payload = buildPayloadFromTemplate(
      mode,
      'manual_send',
      { id: tpl.id, subject: tpl.subject, body: tpl.body },
      sample,
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
      setSending(true);
      if (testSendKind === 'single_user' && singleTestUser) {
        const res = await invokeDispatch({
          intent: 'test_send',
          automation: payload,
          template_id: tpl.id,
          recipient_mode: 'single_user',
          recipient_user_id: singleTestUser.user_id,
        });
        if (res.success) toast.success('נשלח ל־webhook (משתמש מהמסד)');
        else toast.error(automationDispatchFailureMessage(res));
      } else {
        const em = manualTestEmail.trim();
        if (!em) {
          toast.error('הזן אימייל לבדיקה');
          return;
        }
        const res = await invokeDispatch({
          intent: 'test_send',
          automation: payload,
          template_id: tpl.id,
          recipient_mode: 'manual_test',
          manual_test_email: em,
          recipient_user_id: previewUser?.user_id ?? null,
        });
        if (res.success) toast.success('נשלח ל־webhook (מצב בדיקה)');
        else toast.error(automationDispatchFailureMessage(res));
      }
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : 'שגיאת שליחה');
    }
    setSending(false);
  }

  return (
    <div className="space-y-6" dir="rtl">
      {infraMissing && <AutomationSetupBanner />}

      <div className="rounded-2xl border border-border/60 bg-white/95 p-4 space-y-2 text-sm text-muted-foreground">
        <p>
          כאן מרכזים <strong className="text-foreground">בדיקות webhook</strong> וניסויים — בלי לערבב עם שליחת
          קמפיינים שוטפת.           השרת מוסיף ל-payload את{' '}
          <code className="text-xs bg-muted px-1 rounded">template.body_html</code> ו-
          <code className="text-xs bg-muted px-1 rounded">template.body_plain</code> לשימוש ב-N8N (Gmail HTML).
        </p>
        <p className="text-xs">
          סודות ב-Supabase: <code className="bg-muted px-1 rounded">AUTOMATION_WEBHOOK_*</code>,{' '}
          <code className="bg-muted px-1 rounded">EMAIL_LOGO_URL</code>, ואופציונלי{' '}
          <code className="bg-muted px-1 rounded">EMAIL_BRAND_COLOR</code>, <code className="bg-muted px-1 rounded">EMAIL_FOOTER_LINE</code>.
        </p>
        <p className="text-xs">
          מיפוי ל-Gmail/HTML: ראו <code className="bg-muted px-1 rounded">docs/n8n-email-mapping.md</code> במאגר.
        </p>
      </div>

      <div className="rounded-2xl border border-border/60 bg-white/95 p-4 space-y-4">
        <p className="text-sm text-muted-foreground">
          בוחרים תבנית והקשר (סגמנט או אירוע) כדי למלא משתני תבנית — כמו בקמפיין. שליחת הבדיקה תמיד נכנסת ל-
          <strong> webhook בדיקה</strong> (intent=test_send).
        </p>

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant={campaignMode === 'segment' ? 'default' : 'outline'}
            size="sm"
            className="rounded-full"
            onClick={() => setCampaignMode('segment')}
          >
            לפי קהל (סגמנט)
          </Button>
          <Button
            type="button"
            variant={campaignMode === 'event' ? 'default' : 'outline'}
            size="sm"
            className="rounded-full"
            onClick={() => setCampaignMode('event')}
          >
            לפי אירוע
          </Button>
        </div>

        <div className="grid md:grid-cols-2 gap-3">
          <label className="block space-y-1">
            <span className="text-xs font-medium text-muted-foreground">תבנית</span>
            <select
              value={tplId}
              onChange={(e) => setTplId(e.target.value)}
              className="w-full h-10 rounded-xl border border-border bg-white px-2 text-sm"
            >
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>

          {campaignMode === 'segment' ? (
            <>
              <label className="block space-y-1">
                <span className="text-xs font-medium text-muted-foreground">סגמנט</span>
                <select
                  value={segment}
                  onChange={(e) => setSegment(e.target.value)}
                  className="w-full h-10 rounded-xl border border-border bg-white px-2 text-sm"
                >
                  {SEGMENT_OPTIONS.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </label>
              {segment === 'points_min' && (
                <label className="block space-y-1 md:col-span-2">
                  <span className="text-xs font-medium text-muted-foreground">מינימום נקודות</span>
                  <Input
                    type="number"
                    min={1}
                    value={pointsMin}
                    onChange={(e) => setPointsMin(Number(e.target.value) || 200)}
                    className="rounded-xl"
                  />
                </label>
              )}
              {segment === 'event_participants' && (
                <label className="block space-y-1 md:col-span-2">
                  <span className="text-xs font-medium text-muted-foreground">אירוע (למשתתפים)</span>
                  <select
                    value={segmentEventId}
                    onChange={(e) => setSegmentEventId(e.target.value)}
                    className="w-full h-10 rounded-xl border border-border bg-white px-2 text-sm"
                  >
                    <option value="">בחר…</option>
                    {events.map((ev) => (
                      <option key={ev.id} value={ev.id}>
                        {ev.name} — {ev.date}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </>
          ) : (
            <>
              <label className="block space-y-1">
                <span className="text-xs font-medium text-muted-foreground">אירוע</span>
                <select
                  value={eventId}
                  onChange={(e) => setEventId(e.target.value)}
                  className="w-full h-10 rounded-xl border border-border bg-white px-2 text-sm"
                >
                  <option value="">בחר…</option>
                  {events.map((ev) => (
                    <option key={ev.id} value={ev.id}>
                      {ev.name} — {ev.date}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block space-y-1">
                <span className="text-xs font-medium text-muted-foreground">סטטוס רישום</span>
                <select
                  value={eventRegFilter}
                  onChange={(e) => setEventRegFilter(e.target.value)}
                  className="w-full h-10 rounded-xl border border-border bg-white px-2 text-sm"
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

        <div className="rounded-xl border border-violet-200/80 bg-violet-50/40 p-3 space-y-3">
          <p className="text-xs font-semibold text-violet-900">שליחת בדיקה</p>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant={testSendKind === 'manual' ? 'default' : 'outline'}
              className="rounded-full"
              onClick={() => setTestSendKind('manual')}
            >
              אימייל ידני (+ תצוגה מקדימה)
            </Button>
            <Button
              type="button"
              size="sm"
              variant={testSendKind === 'single_user' ? 'default' : 'outline'}
              className="rounded-full"
              onClick={() => setTestSendKind('single_user')}
              disabled={!isProductionCampaignsEnabled()}
              title={
                !isProductionCampaignsEnabled()
                  ? 'הפעל VITE_AUTOMATION_WEBHOOK_MODE=production לשליחה למשתמש מהמסד'
                  : undefined
              }
            >
              משתמש מהמסד (אימייל אמיתי)
            </Button>
          </div>
          {testSendKind === 'manual' ? (
            <div className="grid gap-3 md:grid-cols-2">
              <label className="block space-y-1">
                <span className="text-xs font-medium text-muted-foreground">אימייל לבדיקה (חובה)</span>
                <Input
                  dir="ltr"
                  type="email"
                  placeholder="you@example.com"
                  value={manualTestEmail}
                  onChange={(e) => setManualTestEmail(e.target.value)}
                  className="rounded-xl text-sm"
                />
              </label>
              <div className="md:col-span-2">
                <AutomationUserPicker
                  label="תצוגה מקדימה כמשתמש (אופציונלי)"
                  value={previewUser}
                  onChange={setPreviewUser}
                />
              </div>
            </div>
          ) : (
            <AutomationUserPicker label="בחר משתמש" value={singleTestUser} onChange={setSingleTestUser} />
          )}
        </div>

        <div className="flex flex-wrap gap-2 items-center">
          <Button type="button" variant="outline" onClick={() => void loadAudience()} disabled={loading}>
            {loading ? 'טוען…' : 'טען נמענים (להקשר משתנים)'}
          </Button>
          <Button
            type="button"
            className="bg-violet-600 hover:bg-violet-700 text-white"
            onClick={() => void sendTest()}
            disabled={sending}
          >
            שליחת בדיקה ל-webhook
          </Button>
          <Link
            to="/admin/automation?tab=logs"
            className="text-xs text-primary underline underline-offset-2 hover:text-primary/80"
          >
            יומני webhook →
          </Link>
        </div>

        <p className="text-[11px] text-muted-foreground">
          מצב לקוח (תצוגה): <strong>{getClientAutomationMode()}</strong>
          {isProductionCampaignsEnabled()
            ? ' — קמפיינים יכולים לכוון ל-production בשרת כשההגדרות מאפשרות.'
            : ' — intent=test_send תמיד משתמש ב-webhook בדיקה בשרת.'}
        </p>
      </div>

      <div className="rounded-2xl border border-border/60 bg-white/95 overflow-hidden">
        <div className="p-3 border-b border-border/50 text-sm font-medium">נמענים לטעינה — {users.length}</div>
        <div className="max-h-72 overflow-y-auto">
          {users.length === 0 ? (
            <p className="p-6 text-center text-muted-foreground text-sm">
              לחצו על &quot;טען נמענים&quot; כדי להשתמש בנמען הראשון כברירת מחדל לבדיקה (מצב ידני).
            </p>
          ) : (
            <table className="w-full text-xs">
              <thead className="bg-muted/30 sticky top-0">
                <tr>
                  <th className="text-right p-2">שם</th>
                  <th className="text-right p-2">אימייל</th>
                  <th className="text-right p-2 hidden sm:table-cell">טלפון</th>
                </tr>
              </thead>
              <tbody>
                {users.slice(0, 80).map((u) => (
                  <tr key={u.user_id} className="border-t border-border/40">
                    <td className="p-2">{[u.first_name, u.last_name].filter(Boolean).join(' ')}</td>
                    <td className="p-2" dir="ltr">
                      {u.email}
                    </td>
                    <td className="p-2 hidden sm:table-cell" dir="ltr">
                      {u.phone}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {users.length > 80 && (
            <p className="p-2 text-center text-muted-foreground text-xs">מוצגות 80 ראשונות מתוך {users.length}</p>
          )}
        </div>
      </div>
    </div>
  );
}
