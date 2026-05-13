import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { AudienceMemberCard } from '@/components/admin/automation/manager/AudienceMemberCard';
import { EVENT_REGISTRATION_FILTERS } from '@/components/admin/automation/constants';
import {
  AUDIENCE_PAGE_SIZE,
  type AudienceProfileQueryFilters,
  type AudienceProfileRow,
  fetchAudienceProfilesPage,
} from '@/services/automationAudienceProfiles';
import { invokeRecipients, type RecipientUser } from '@/services/automation';
import { cn } from '@/lib/utils';
import { Loader2, Users } from 'lucide-react';

export type PickerTab = 'browse' | 'birthdays' | 'points' | 'events';

type EventOption = { id: string; name: string };

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Current selection when opening */
  initialSelectedIds: Set<string>;
  initialUsers: RecipientUser[];
  events: EventOption[];
  /** Load users from wizard segment / event (existing Edge — unchanged). */
  loadWizardAudience: () => Promise<RecipientUser[]>;
  onApply: (users: RecipientUser[], selectedIds: Set<string>) => void;
};

function recipientToProfileRow(u: RecipientUser): AudienceProfileRow {
  return {
    user_id: u.user_id,
    first_name: u.first_name,
    last_name: u.last_name,
    phone: u.phone,
    date_of_birth: u.date_of_birth,
    points: u.points,
    role: u.role,
    status: u.status,
    suitability_status: u.suitability_status ?? 'pending',
    moderation_status: u.moderation_status ?? 'pending',
    last_seen: u.last_seen ?? null,
    gender: u.gender ?? null,
    profile_completed: u.profile_completed ?? null,
    avatar_url: null,
    photos: null,
    interests: null,
    super_role: null,
    suspended: false,
  };
}

const MONTHS_HE = [
  '',
  'ינואר',
  'פברואר',
  'מרץ',
  'אפריל',
  'מאי',
  'יוני',
  'יולי',
  'אוגוסט',
  'ספטמבר',
  'אוקטובר',
  'נובמבר',
  'דצמבר',
];

export function AudiencePickerModal({
  open,
  onOpenChange,
  initialSelectedIds,
  initialUsers,
  events,
  loadWizardAudience,
  onApply,
}: Props) {
  const [tab, setTab] = useState<PickerTab>('browse');
  const [text, setText] = useState('');
  const [debouncedText, setDebouncedText] = useState('');
  const [pointsMin, setPointsMin] = useState<number | null>(null);
  const [pointsMax, setPointsMax] = useState<number | null>(null);
  const [role, setRole] = useState<'guest' | 'member' | ''>('');
  const [moderation, setModeration] = useState<'pending' | 'approved' | ''>('');
  const [profileCompleted, setProfileCompleted] = useState<'yes' | 'no' | ''>('');
  const [interestsToken, setInterestsToken] = useState('');
  const [inactiveOnly, setInactiveOnly] = useState(false);
  const [managersOnly, setManagersOnly] = useState(false);
  const [birthdayMonth, setBirthdayMonth] = useState<number | null>(null);

  const [profileRows, setProfileRows] = useState<AudienceProfileRow[]>([]);
  const [eventRows, setEventRows] = useState<RecipientUser[]>([]);
  const [pageIdx, setPageIdx] = useState(0);
  const [loading, setLoading] = useState(false);
  const [exhausted, setExhausted] = useState(false);
  const loadingMoreRef = useRef(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [applying, setApplying] = useState(false);
  const [edgeHint, setEdgeHint] = useState<string | null>(null);

  const [eventId, setEventId] = useState('');
  const [eventRegFilter, setEventRegFilter] = useState('registered');

  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedText(text.trim()), 380);
    return () => clearTimeout(t);
  }, [text]);

  const queryFilters = useMemo((): AudienceProfileQueryFilters => {
    return {
      text: debouncedText || undefined,
      pointsMin,
      pointsMax,
      role: role || undefined,
      moderation: moderation || undefined,
      profileCompleted: profileCompleted || undefined,
      interestsToken: interestsToken.trim() || undefined,
      inactiveOnly: inactiveOnly || undefined,
      managersOnly: managersOnly || undefined,
      birthdayMonth: tab === 'birthdays' ? birthdayMonth : null,
    };
  }, [
    debouncedText,
    pointsMin,
    pointsMax,
    role,
    moderation,
    profileCompleted,
    interestsToken,
    inactiveOnly,
    managersOnly,
    birthdayMonth,
    tab,
  ]);

  const profileMode = tab === 'birthdays' || tab === 'points' ? tab : 'browse';

  const resetBrowseState = useCallback(() => {
    setProfileRows([]);
    setPageIdx(0);
    setExhausted(false);
    loadingMoreRef.current = false;
  }, []);

  useEffect(() => {
    if (!open) return;
    setSelected(new Set(initialSelectedIds));
    setEdgeHint(null);
    setTab('browse');
    setText('');
    setDebouncedText('');
    setEventRows([]);
  }, [open, initialSelectedIds]);

  useEffect(() => {
    if (!open) return;
    if (tab === 'events') return;
    resetBrowseState();
    let cancelled = false;
    (async () => {
      setLoading(true);
      loadingMoreRef.current = true;
      const { rows, error } = await fetchAudienceProfilesPage(0, queryFilters, profileMode);
      if (cancelled) return;
      if (error) {
        setProfileRows([]);
        setExhausted(true);
        const detail = error.message?.trim();
        setEdgeHint(
          detail
            ? `לא ניתן לטעון רשימה מהשרת. ${detail}`
            : 'לא ניתן לטעון רשימה מהשרת. בדקו חיבור או הרשאות.',
        );
      } else {
        setProfileRows(rows);
        setPageIdx(0);
        setExhausted(rows.length < AUDIENCE_PAGE_SIZE);
        setEdgeHint(null);
      }
      setLoading(false);
      loadingMoreRef.current = false;
    })();
    return () => {
      cancelled = true;
    };
  }, [open, tab, queryFilters, profileMode, resetBrowseState]);

  const loadNextPage = useCallback(async () => {
    if (tab === 'events' || loading || exhausted || loadingMoreRef.current) return;
    loadingMoreRef.current = true;
    setLoading(true);
    const next = pageIdx + 1;
    const { rows, error } = await fetchAudienceProfilesPage(next, queryFilters, profileMode);
    if (error) {
      setExhausted(true);
      setLoading(false);
      loadingMoreRef.current = false;
      return;
    }
    setProfileRows((prev) => {
      const seen = new Set(prev.map((r) => r.user_id));
      const merged = [...prev];
      for (const r of rows) {
        if (!seen.has(r.user_id)) {
          seen.add(r.user_id);
          merged.push(r);
        }
      }
      return merged;
    });
    setPageIdx(next);
    if (rows.length < AUDIENCE_PAGE_SIZE) setExhausted(true);
    setLoading(false);
    loadingMoreRef.current = false;
  }, [tab, loading, exhausted, pageIdx, queryFilters, profileMode]);

  const onScrollList = useCallback(() => {
    const el = scrollRef.current;
    if (!el || tab === 'events' || exhausted || loading || loadingMoreRef.current) return;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 140) {
      void loadNextPage();
    }
  }, [tab, exhausted, loading, loadNextPage]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };

  const selectAllLoaded = () => {
    if (tab === 'events') {
      setSelected(new Set(eventRows.map((u) => u.user_id)));
      return;
    }
    setSelected(new Set(profileRows.map((r) => r.user_id)));
  };

  const clearSelection = () => setSelected(new Set());

  const invertLoaded = () => {
    if (tab === 'events') {
      const ids = eventRows.map((u) => u.user_id);
      setSelected(new Set(ids.filter((id) => !selected.has(id))));
      return;
    }
    const ids = profileRows.map((r) => r.user_id);
    setSelected(new Set(ids.filter((id) => !selected.has(id))));
  };

  const loadFromWizardSegment = async () => {
    setLoading(true);
    setEdgeHint(null);
    try {
      const list = await loadWizardAudience();
      const rows = list.map(recipientToProfileRow);
      setTab('browse');
      setProfileRows(rows);
      setPageIdx(0);
      setExhausted(true);
      setSelected(new Set(list.map((u) => u.user_id)));
      setEventRows([]);
    } catch (e) {
      const code = e instanceof Error ? e.message : '';
      if (code === 'event') setEdgeHint('בחרו אירוע באשף ואז טענו שוב.');
      else if (code === 'segment_event') setEdgeHint('בחרו אירוע לסגמנט ״משתתפי אירוע״ באשף.');
      else setEdgeHint('לא ניתן לטעון את הקהל לפי הסגמנט. נסו שוב.');
    } finally {
      setLoading(false);
    }
  };

  const loadEventParticipants = async () => {
    if (!eventId) {
      setEdgeHint('בחרו אירוע.');
      return;
    }
    setLoading(true);
    setEdgeHint(null);
    try {
      const data = await invokeRecipients({
        action: 'event_registrations',
        event_id: eventId,
        registration_filter: eventRegFilter,
      } as { action: string; event_id: string; registration_filter: string });
      const list = (data.users || []) as RecipientUser[];
      setEventRows(list);
      setSelected(new Set(list.map((u) => u.user_id)));
      setExhausted(true);
    } catch {
      setEdgeHint('לא ניתן לטעון משתתפים לאירוע.');
      setEventRows([]);
    } finally {
      setLoading(false);
    }
  };

  const birthdayGroups = useMemo(() => {
    if (tab !== 'birthdays') return [];
    const map = new Map<number, AudienceProfileRow[]>();
    for (const r of profileRows) {
      if (!r.date_of_birth) continue;
      const d = new Date(r.date_of_birth);
      if (Number.isNaN(d.getTime())) continue;
      const m = d.getUTCMonth() + 1;
      if (!map.has(m)) map.set(m, []);
      map.get(m)!.push(r);
    }
    const months = [...map.keys()].sort((a, b) => a - b);
    return months.map((m) => ({
      month: m,
      label: MONTHS_HE[m] || String(m),
      rows: (map.get(m) || []).sort((a, b) => {
        const da = new Date(a.date_of_birth!).getUTCDate();
        const db = new Date(b.date_of_birth!).getUTCDate();
        return da - db;
      }),
    }));
  }, [tab, profileRows]);

  const pointsPresets = useMemo(
    () =>
      [
        { label: '0–100', min: 0, max: 100 },
        { label: '100–500', min: 100, max: 500 },
        { label: '500–1000', min: 500, max: 1000 },
        { label: 'VIP 1000+', min: 1000, max: null as number | null },
      ] as const,
    [],
  );

  const handleApply = async () => {
    if (selected.size === 0) return;
    setApplying(true);
    try {
      const ids = [...selected].slice(0, 500);
      const data = await invokeRecipients({ action: 'resolve_users', user_ids: ids });
      const resolved = (data.users || []) as RecipientUser[];
      if (resolved.length === 0) {
        setEdgeHint('לא ניתן לאמת את החברים שנבחרו. נסו שוב בעוד רגע.');
        setApplying(false);
        return;
      }
      if (resolved.length < ids.length) {
        setEdgeHint(`אומתו ${resolved.length} מתוך ${ids.length} נבחרים — שאר החברים לא הוחזרו מהשרת.`);
      }
      const byId = new Map(resolved.map((u) => [u.user_id, u]));
      const ordered: RecipientUser[] = [];
      for (const id of ids) {
        const u = byId.get(id);
        if (u) ordered.push(u);
      }
      onApply(ordered, new Set(ordered.map((u) => u.user_id)));
      onOpenChange(false);
    } catch {
      setEdgeHint('פעולת האישור נכשלה. נסו שוב — אם הבעיה נמשכת, פנו לצוות טכני.');
    } finally {
      setApplying(false);
    }
  };

  const displayRows: { row: AudienceProfileRow; email?: string | null }[] = useMemo(() => {
    if (tab === 'events') {
      return eventRows.map((u) => ({ row: recipientToProfileRow(u), email: u.email }));
    }
    const emailFromInitial = new Map(initialUsers.map((u) => [u.user_id, u.email]));
    return profileRows.map((row) => ({ row, email: emailFromInitial.get(row.user_id) || undefined }));
  }, [tab, eventRows, profileRows, initialUsers]);

  const emailByUserId = useMemo(() => {
    const m = new Map<string, string | null | undefined>();
    for (const d of displayRows) m.set(d.row.user_id, d.email);
    return m;
  }, [displayRows]);

  const loadedCount = tab === 'events' ? eventRows.length : profileRows.length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        dir="rtl"
        className={cn(
          'fixed z-50 flex flex-col gap-0 p-0 overflow-hidden border-violet-200/60',
          'left-0 top-0 translate-x-0 translate-y-0 w-full max-w-none h-[100dvh] rounded-none sm:rounded-2xl sm:left-[50%] sm:top-[50%] sm:translate-x-[-50%] sm:translate-y-[-50%] sm:max-w-5xl sm:h-[min(92vh,900px)] sm:max-h-[900px]',
          'bg-gradient-to-b from-violet-50/95 via-white to-white shadow-[0_24px_80px_-30px_rgba(109,40,217,0.45)]',
        )}
      >
        <DialogHeader className="px-4 pt-4 pb-3 sm:px-6 border-b border-violet-100/80 bg-white/70 backdrop-blur-xl shrink-0 space-y-1 text-right">
          <DialogTitle className="text-xl sm:text-2xl font-bold text-violet-950 flex items-center gap-2 justify-end">
            <Users className="h-6 w-6 text-violet-600 shrink-0" />
            בחירת קהל
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            בחרו חברים מהרשימה — האימיילים נטענים רק בשלב האישור, דרך מערכת האוטומציה הקיימת.
          </DialogDescription>
          <div className="flex flex-wrap gap-2 justify-end pt-2">
            <Badge variant="secondary" className="rounded-full bg-violet-100 text-violet-900">
              נבחרו: {selected.size}
            </Badge>
            <Badge variant="outline" className="rounded-full">
              בטעינה במסך: {loadedCount}
            </Badge>
          </div>
        </DialogHeader>

        <div className="sticky top-0 z-10 px-3 sm:px-5 py-3 border-b border-violet-100/90 bg-white/80 backdrop-blur-lg space-y-3 shrink-0">
          <div className="flex flex-wrap gap-1.5 justify-end">
            {(
              [
                ['browse', 'עיון'],
                ['birthdays', 'ימי הולדת'],
                ['points', 'נקודות'],
                ['events', 'אירועים'],
              ] as const
            ).map(([k, label]) => (
              <Button
                key={k}
                type="button"
                size="sm"
                variant={tab === k ? 'default' : 'outline'}
                className="rounded-full"
                onClick={() => {
                  setTab(k);
                  if (k === 'events') {
                    setProfileRows([]);
                    resetBrowseState();
                  } else {
                    setEventRows([]);
                  }
                }}
              >
                {label}
              </Button>
            ))}
          </div>

          {tab !== 'events' ? (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              <Input
                placeholder="חיפוש לפי שם או טלפון…"
                value={text}
                onChange={(e) => setText(e.target.value)}
                className="bg-white/90 rounded-xl border-violet-100"
              />
              <select
                className="h-10 rounded-xl border border-input bg-white px-2 text-sm"
                value={role}
                onChange={(e) => setRole(e.target.value as typeof role)}
              >
                <option value="">כל התפקידים</option>
                <option value="member">חבר</option>
                <option value="guest">אורח</option>
              </select>
              <select
                className="h-10 rounded-xl border border-input bg-white px-2 text-sm"
                value={moderation}
                onChange={(e) => setModeration(e.target.value as typeof moderation)}
              >
                <option value="">כל סטטוסי האישור</option>
                <option value="approved">מאושרים</option>
                <option value="pending">ממתינים</option>
              </select>
              <select
                className="h-10 rounded-xl border border-input bg-white px-2 text-sm"
                value={profileCompleted}
                onChange={(e) => setProfileCompleted(e.target.value as typeof profileCompleted)}
              >
                <option value="">פרופיל — הכל</option>
                <option value="yes">הושלם</option>
                <option value="no">לא הושלם</option>
              </select>
              <Input
                placeholder="תג עניין (מדויק ברשימה)"
                value={interestsToken}
                onChange={(e) => setInterestsToken(e.target.value)}
                className="bg-white/90 rounded-xl border-violet-100"
              />
              {tab === 'birthdays' ? (
                <select
                  className="h-10 rounded-xl border border-input bg-white px-2 text-sm"
                  value={birthdayMonth ?? ''}
                  onChange={(e) => setBirthdayMonth(e.target.value ? Number(e.target.value) : null)}
                >
                  <option value="">כל החודשים</option>
                  {MONTHS_HE.map((name, i) =>
                    i ? (
                      <option key={i} value={i}>
                        {name}
                      </option>
                    ) : null,
                  )}
                </select>
              ) : null}
              {tab === 'points' ? (
                <div className="flex flex-wrap gap-1 justify-end sm:col-span-2">
                  {pointsPresets.map((p) => (
                    <Button
                      key={p.label}
                      type="button"
                      size="sm"
                      variant="outline"
                      className="rounded-full text-xs"
                      onClick={() => {
                        setPointsMin(p.min);
                        setPointsMax(p.max);
                      }}
                    >
                      {p.label}
                    </Button>
                  ))}
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="rounded-full text-xs"
                    onClick={() => {
                      setPointsMin(null);
                      setPointsMax(null);
                    }}
                  >
                    נקה טווח נקודות
                  </Button>
                </div>
              ) : null}
              <label className="flex items-center gap-2 text-sm justify-end sm:col-span-2 lg:col-span-3">
                <input type="checkbox" checked={inactiveOnly} onChange={(e) => setInactiveOnly(e.target.checked)} />
                לא פעילים בלבד
              </label>
              <label className="flex items-center gap-2 text-sm justify-end sm:col-span-2 lg:col-span-3">
                <input type="checkbox" checked={managersOnly} onChange={(e) => setManagersOnly(e.target.checked)} />
                מנהלי קהילה בלבד
              </label>
            </div>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              <select
                className="h-10 rounded-xl border border-input bg-white px-2 text-sm"
                value={eventId}
                onChange={(e) => setEventId(e.target.value)}
              >
                <option value="">בחרו אירוע…</option>
                {events.map((ev) => (
                  <option key={ev.id} value={ev.id}>
                    {ev.name}
                  </option>
                ))}
              </select>
              <select
                className="h-10 rounded-xl border border-input bg-white px-2 text-sm"
                value={eventRegFilter}
                onChange={(e) => setEventRegFilter(e.target.value)}
              >
                {EVENT_REGISTRATION_FILTERS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              <Button type="button" className="rounded-full sm:col-span-2" onClick={() => void loadEventParticipants()}>
                טען משתתפים
              </Button>
            </div>
          )}

          <div className="flex flex-wrap gap-2 justify-end">
            <Button type="button" size="sm" variant="secondary" className="rounded-full" onClick={() => void loadFromWizardSegment()}>
              טען לפי סגמנט באשף
            </Button>
            <Button type="button" size="sm" variant="outline" className="rounded-full" onClick={selectAllLoaded}>
              סמן הכל במסך
            </Button>
            <Button type="button" size="sm" variant="outline" className="rounded-full" onClick={invertLoaded}>
              הפוך בחירה
            </Button>
            <Button type="button" size="sm" variant="ghost" className="rounded-full" onClick={clearSelection}>
              נקה בחירה
            </Button>
          </div>
          {edgeHint ? <p className="text-xs text-amber-800 bg-amber-50 border border-amber-100 rounded-lg px-2 py-1.5">{edgeHint}</p> : null}
          {tab === 'birthdays' && birthdayMonth ? (
            <p className="text-[11px] text-muted-foreground">
              סינון לפי חודש מחיל את התוצאות על העמודים שנטענו — גללו למטה לטעינה נוספת.
            </p>
          ) : null}
        </div>

        <div
          ref={scrollRef}
          onScroll={onScrollList}
          className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-3 sm:px-5 py-4"
        >
          {tab === 'birthdays' && birthdayGroups.length > 0 ? (
            <div className="space-y-8">
              {birthdayGroups.map((g) => (
                <section key={g.month}>
                  <h3 className="text-sm font-bold text-violet-900 mb-3 border-r-4 border-violet-500 pr-2">
                    ימי הולדת — {g.label}
                  </h3>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {g.rows.map((row) => (
                      <AudienceMemberCard
                        key={row.user_id}
                        profile={row}
                        email={emailByUserId.get(row.user_id)}
                        selected={selected.has(row.user_id)}
                        onToggle={() => toggle(row.user_id)}
                      />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          ) : tab === 'birthdays' && birthdayGroups.length === 0 && profileRows.length > 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              אין ימי הולדת בעמודים שנטענו עבור החודש שנבחר. גללו למטה לטעינה נוספת או שחררו את סינון החודש.
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {displayRows.map(({ row, email }) => (
                <AudienceMemberCard
                  key={row.user_id}
                  profile={row}
                  email={email}
                  selected={selected.has(row.user_id)}
                  onToggle={() => toggle(row.user_id)}
                />
              ))}
            </div>
          )}

          {!loading && loadedCount === 0 ? (
            <div className="py-20 text-center text-muted-foreground text-sm">
              לא נמצאו חברים התואמים למסננים. נסו לרכך את החיפוש או לטעון לפי סגמנט.
            </div>
          ) : null}

          {loading ? (
            <div className="flex justify-center py-6 text-violet-700">
              <Loader2 className="h-7 w-7 animate-spin" />
            </div>
          ) : null}
        </div>

        <div className="shrink-0 border-t border-violet-100 bg-white/90 backdrop-blur-xl px-4 py-3 sm:px-6 pb-[max(0.75rem,env(safe-area-inset-bottom))] flex flex-wrap gap-2 justify-between items-center">
          <Button type="button" variant="outline" className="rounded-full" onClick={() => onOpenChange(false)}>
            ביטול
          </Button>
          <Button
            type="button"
            className="rounded-full bg-violet-600 hover:bg-violet-700 px-8"
            disabled={selected.size === 0 || applying}
            onClick={() => void handleApply()}
          >
            {applying ? 'מאשר…' : `אישור (${selected.size})`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
