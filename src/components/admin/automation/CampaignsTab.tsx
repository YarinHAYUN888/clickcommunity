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
import { SEGMENT_OPTIONS, EVENT_REGISTRATION_FILTERS } from './constants';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { Database } from '@/integrations/supabase/types';

type Tpl = Database['public']['Tables']['automation_templates']['Row'];
type EventRow = Pick<
  Database['public']['Tables']['events']['Row'],
  'id' | 'name' | 'date' | 'time' | 'location_name' | 'location_address'
>;

export function CampaignsTab() {
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

  function segmentKeyForCampaign(): string {
    if (campaignMode === 'event') return `event:${eventId}:${eventRegFilter}`;
    if (segment === 'event_participants') return `event:${segmentEventId}:registered`;
    return segment;
  }

  function segmentFiltersForCampaign(): AutomationSegmentFilters | null {
    if (campaignMode === 'event') {
      return { event_id: eventId, registration_filter: eventRegFilter };
    }
    if (segment === 'points_min') return { min_points: pointsMin };
    if (segment === 'event_participants' && segmentEventId) {
      return { event_id: segmentEventId, registration_filter: 'registered' };
    }
    return null;
  }

  async function sendCampaign() {
    if (!isProductionCampaignsEnabled()) {
      toast.message('מצב האוטומציה בלקוח אינו production — קמפיין לקהל חסום אם גם השרת במצב test (אלא אם הוגדר האפשר המתאים).');
    }
    const tpl = templates.find((t) => t.id === tplId);
    if (!tpl || users.length === 0) {
      toast.error('בחר תבנית ונטען קהל');
      return;
    }
    const ev = events.find((e) => e.id === eventId);
    let ok = 0;
    let fail = 0;
    setSending(true);
    const mode = getClientAutomationMode();
    const segKey = segmentKeyForCampaign();
    const segFilters = segmentFiltersForCampaign();

    for (const u of users) {
      const ctx = {
        ...recipientToTemplateContext(u),
        ...(campaignMode === 'event' && ev ? eventToTemplateContext(ev) : {}),
      };
      const payload = buildPayloadFromTemplate(
        mode,
        'manual_send',
        { id: tpl.id, subject: tpl.subject, body: tpl.body },
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
    toast.success(`נשלח: ${ok}, נכשל: ${fail}`);
  }

  return (
    <div className="space-y-6" dir="rtl">
      {infraMissing && <AutomationSetupBanner />}
      <div className="rounded-2xl border border-border/60 bg-white/95 p-4 space-y-4">
        <p className="text-sm text-muted-foreground">
          בוחרים תבנית וקהל יעד. השליחה נשלחת כ־payload ל־webhook (N8N). לא נשלח אימייל ישירות מהאפליקציה.{' '}
          <Link
            to="/admin/automation?tab=integration"
            className="text-primary font-medium underline underline-offset-2 hover:text-primary/80"
          >
            בדיקות webhook ובדיקת אימייל
          </Link>{' '}
          — בטאב מפתחים.
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

        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={() => void loadAudience()} disabled={loading}>
            {loading ? 'טוען…' : 'טען נמענים'}
          </Button>
          <Button type="button" className="bg-primary" onClick={() => void sendCampaign()} disabled={sending}>
            שליחת קמפיין
          </Button>
        </div>

        <p className="text-[11px] text-muted-foreground">
          מצב לקוח: <strong>{getClientAutomationMode()}</strong>
          {isProductionCampaignsEnabled() ? ' (קמפיין לכתובת production בשרת)' : ' (קמפיין ישתמש ב־test בשרת אם לא הוגדר production)'}
        </p>
      </div>

      <div className="rounded-2xl border border-border/60 bg-white/95 overflow-hidden">
        <div className="p-3 border-b border-border/50 text-sm font-medium">תצוגה מקדימה — {users.length} נמענים</div>
        <div className="max-h-72 overflow-y-auto">
          {users.length === 0 ? (
            <p className="p-6 text-center text-muted-foreground text-sm">לחצו על &quot;טען נמענים&quot;</p>
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
