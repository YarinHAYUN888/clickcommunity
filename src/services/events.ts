import { FunctionsHttpError } from '@supabase/functions-js';
import { supabase } from '@/integrations/supabase/client';
import { countRowsInCurrentJerusalemMonth } from '@/lib/jerusalemMonth';
import { canViewEventParticipantStats } from '@/lib/eventPermissions';

const DEFAULT_MONTHLY_EVENT_CAP = 3;

export interface EventRow {
  id: string;
  name: string;
  description: string | null;
  cover_image_url: string | null;
  date: string;
  time: string;
  location_name: string;
  location_address: string | null;
  location_url: string | null;
  host_id: string | null;
  max_capacity: number;
  reserved_new_spots: number;
  requires_subscription: boolean;
  gender_balance_target: number;
  status: 'open' | 'almost_full' | 'full' | 'past' | 'cancelled';
  is_past_voting_open: boolean;
  created_at: string;
  updated_at: string;
}

export interface EventStats {
  total: number;
  femalePercent: number;
  malePercent: number;
}

export interface EventRegistration {
  id: string;
  event_id: string;
  user_id: string;
  status: string;
  waitlist_position: number | null;
  paid_amount: number | null;
  payment_status: string;
  entry_code?: string | null;
  cancelled_at?: string | null;
  checked_in_at?: string | null;
  created_at: string;
}

async function filterEventsByHostIsolation(
  events: EventRow[],
  isShadowUser: boolean,
): Promise<EventRow[]> {
  const hostIds = [...new Set(events.map((e) => e.host_id).filter(Boolean) as string[])];
  if (hostIds.length === 0) {
    return isShadowUser ? [] : events;
  }
  const { data: hosts } = await supabase
    .from('profiles')
    .select('user_id, is_shadow, suitability_status, super_role')
    .in('user_id', hostIds);

  const allowedHosts = new Set(
    (hosts || [])
      .filter((h) => {
        if (h.super_role) return true;
        const sh = !!h.is_shadow;
        const activeNormal = h.suitability_status === 'active' && !sh;
        const shadowHost = h.suitability_status === 'shadow' && sh;
        return isShadowUser ? shadowHost : activeNormal;
      })
      .map((h) => h.user_id),
  );

  return events.filter((e) => {
    if (!e.host_id) return !isShadowUser;
    return allowedHosts.has(e.host_id);
  });
}

export async function getUpcomingEvents(isShadowUser = false): Promise<EventRow[]> {
  const today = new Date().toISOString().split('T')[0];
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .in('status', ['open', 'almost_full', 'full'])
    .gte('date', today)
    .order('date', { ascending: true });
  if (error) throw error;
  return filterEventsByHostIsolation((data || []) as EventRow[], isShadowUser);
}

export async function getPastEvents(isShadowUser = false): Promise<EventRow[]> {
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .eq('status', 'past')
    .order('date', { ascending: false })
    .limit(20);
  if (error) throw error;
  return filterEventsByHostIsolation((data || []) as EventRow[], isShadowUser);
}

export interface CalendarEvent extends EventRow {
  is_mine: boolean;
  mutual_match_count?: number;
  click_score?: number;
}

/**
 * Fetches events for the calendar within a date range (inclusive YYYY-MM-DD).
 * Annotates each event with `is_mine` if the current user is registered for it.
 */
export async function getCalendarEvents(
  startDate: string,
  endDate: string,
  currentUserId?: string,
  isShadowUser = false,
): Promise<CalendarEvent[]> {
  const { data: events, error } = await supabase
    .from('events')
    .select('*')
    .in('status', ['open', 'almost_full', 'full', 'past'])
    .gte('date', startDate)
    .lte('date', endDate)
    .order('date', { ascending: true });

  if (error) throw error;
  if (!events || events.length === 0) return [];

  const filtered = await filterEventsByHostIsolation(events as EventRow[], isShadowUser);

  const ranked = currentUserId
    ? await rankEventsForViewer(filtered, currentUserId)
    : filtered;

  let myEventIds = new Set<string>();
  if (currentUserId) {
    const { data: regs } = await supabase
      .from('event_registrations')
      .select('event_id, status')
      .eq('user_id', currentUserId)
      .in('status', ['registered', 'approved']);
    if (regs) myEventIds = new Set(regs.map(r => r.event_id));
  }

  return ranked.map(e => ({
    ...e,
    is_mine: myEventIds.has(e.id),
  }));
}

export const EVENT_CLICK_COMPAT_THRESHOLD = 40;

export type RankedEventRow = EventRow & {
  mutual_match_count?: number;
  click_score?: number;
};

type ProfileSignals = { interests: string[] | null; region: string | null };

/** Jaccard interest overlap + region bonus (same as event attendee scoring). */
export function computeAttendeeCompatScore(viewer: ProfileSignals, attendee: ProfileSignals): number {
  const myInterests = viewer.interests || [];
  const theirInterests = attendee.interests || [];
  const shared = myInterests.filter((i) => theirInterests.includes(i));
  const totalUnique = new Set([...myInterests, ...theirInterests]).size;
  const jaccard = totalUnique > 0 ? Math.round((shared.length / totalUnique) * 100) : 0;
  const sameRegion =
    !!viewer.region && !!attendee.region && viewer.region === attendee.region;
  return Math.min(100, jaccard + (sameRegion ? 15 : 0));
}

export function sortEventsByMatchPriority(
  events: EventRow[],
  scoresByEventId: Map<string, { mutual_score: number; click_score: number }>,
): RankedEventRow[] {
  return [...events]
    .sort((a, b) => {
      const sa = scoresByEventId.get(a.id) ?? { mutual_score: 0, click_score: 0 };
      const sb = scoresByEventId.get(b.id) ?? { mutual_score: 0, click_score: 0 };
      if (sb.mutual_score !== sa.mutual_score) return sb.mutual_score - sa.mutual_score;
      if (sb.click_score !== sa.click_score) return sb.click_score - sa.click_score;
      const dateCmp = a.date.localeCompare(b.date);
      if (dateCmp !== 0) return dateCmp;
      return (a.time || '').localeCompare(b.time || '');
    })
    .map((e) => {
      const scores = scoresByEventId.get(e.id);
      return {
        ...e,
        mutual_match_count: scores?.mutual_score ?? 0,
        click_score: scores?.click_score ?? 0,
      };
    });
}

export async function rankEventsForViewer(
  events: EventRow[],
  viewerId: string | undefined,
): Promise<RankedEventRow[]> {
  if (!viewerId || events.length === 0) return events;

  const eventIds = events.map((e) => e.id);
  const { data: regs, error: regErr } = await supabase
    .from('event_registrations')
    .select('event_id, user_id')
    .in('event_id', eventIds)
    .in('status', ['registered', 'approved']);

  if (regErr) {
    console.warn('rankEventsForViewer:', regErr.message);
    return events;
  }

  const attendeesByEvent = new Map<string, string[]>();
  const allAttendeeIds = new Set<string>();
  for (const row of regs || []) {
    if (row.user_id === viewerId) continue;
    allAttendeeIds.add(row.user_id);
    const list = attendeesByEvent.get(row.event_id) || [];
    list.push(row.user_id);
    attendeesByEvent.set(row.event_id, list);
  }

  if (allAttendeeIds.size === 0) return events;

  const attendeeIdList = [...allAttendeeIds];
  const [{ data: viewerProfile }, { data: attendeeProfiles }, { data: myLikes }, { data: likesToMe }] =
    await Promise.all([
      supabase.from('profiles').select('interests, region').eq('user_id', viewerId).maybeSingle(),
      supabase
        .from('profiles')
        .select('user_id, interests, region')
        .in('user_id', attendeeIdList),
      supabase
        .from('profile_swipes')
        .select('to_user_id, action')
        .eq('from_user_id', viewerId)
        .in('to_user_id', attendeeIdList)
        .in('action', ['like', 'super_like']),
      supabase
        .from('profile_swipes')
        .select('from_user_id, action')
        .eq('to_user_id', viewerId)
        .in('from_user_id', attendeeIdList)
        .in('action', ['like', 'super_like']),
    ]);

  const viewerSignals: ProfileSignals = {
    interests: (viewerProfile?.interests as string[] | null) ?? null,
    region: viewerProfile?.region ?? null,
  };

  const profileById = new Map<string, ProfileSignals>();
  for (const p of attendeeProfiles || []) {
    profileById.set(p.user_id, {
      interests: (p.interests as string[] | null) ?? null,
      region: p.region ?? null,
    });
  }

  const iLiked = new Set((myLikes || []).map((r) => r.to_user_id));
  const likedMe = new Set((likesToMe || []).map((r) => r.from_user_id));

  const scoresByEventId = new Map<string, { mutual_score: number; click_score: number }>();
  for (const eventId of eventIds) {
    const attendeeIds = attendeesByEvent.get(eventId) || [];
    let mutual_score = 0;
    let click_score = 0;
    for (const aid of attendeeIds) {
      if (iLiked.has(aid) && likedMe.has(aid)) mutual_score += 1;
      const signals = profileById.get(aid);
      if (!signals) continue;
      const compat = computeAttendeeCompatScore(viewerSignals, signals);
      if (compat >= EVENT_CLICK_COMPAT_THRESHOLD) click_score += 1;
    }
    scoresByEventId.set(eventId, { mutual_score, click_score });
  }

  return sortEventsByMatchPriority(events, scoresByEventId);
}

export async function getUpcomingEventsRanked(
  isShadowUser = false,
  viewerId?: string,
): Promise<RankedEventRow[]> {
  const events = await getUpcomingEvents(isShadowUser);
  return rankEventsForViewer(events, viewerId);
}

export async function getPastEventsRanked(
  isShadowUser = false,
  viewerId?: string,
): Promise<RankedEventRow[]> {
  const events = await getPastEvents(isShadowUser);
  return rankEventsForViewer(events, viewerId);
}

function logEventDev(message: string, detail?: Record<string, unknown>) {
  if (import.meta.env.DEV) {
    if (detail) console.log(message, detail);
    else console.log(message);
  }
}

export async function getEventById(
  eventId: string,
  isShadowUser = false,
): Promise<EventRow | null> {
  const trimmed = eventId?.trim();
  if (!trimmed) {
    logEventDev('EVENT NOT FOUND', { reason: 'empty_event_id' });
    return null;
  }

  const { data, error } = await supabase
    .from('events')
    .select('*')
    .eq('id', trimmed)
    .maybeSingle();

  if (error) {
    logEventDev('EVENT NOT FOUND', {
      eventId: trimmed,
      code: error.code,
      message: error.message,
    });
    return null;
  }

  if (!data) {
    logEventDev('EVENT NOT FOUND', { eventId: trimmed, code: 'PGRST116' });
    return null;
  }

  const [visible] = await filterEventsByHostIsolation([data as EventRow], isShadowUser);
  if (!visible) {
    logEventDev('EVENT NOT FOUND', { eventId: trimmed, reason: 'host_isolation' });
    return null;
  }

  logEventDev('EVENT FOUND', { eventId: trimmed });
  return visible;
}

/** Maps Promise.allSettled results for event detail secondary loads (stats, attendees, photos, registration). */
export function applyEventDetailSecondarySettled(
  settled: [
    PromiseSettledResult<EventStats | null>,
    PromiseSettledResult<Awaited<ReturnType<typeof getEventAttendees>>>,
    PromiseSettledResult<Awaited<ReturnType<typeof getEventPhotos>>>,
    PromiseSettledResult<EventRegistration | null>,
  ],
): {
  stats: EventStats | null;
  attendees: Awaited<ReturnType<typeof getEventAttendees>>;
  photos: Awaited<ReturnType<typeof getEventPhotos>>;
  registration: EventRegistration | null;
} {
  const pick = <T,>(r: PromiseSettledResult<T>, fallback: T): T =>
    r.status === 'fulfilled' ? r.value : fallback;

  return {
    stats: pick(settled[0], null),
    attendees: pick(settled[1], []),
    photos: pick(settled[2], []),
    registration: pick(settled[3], null),
  };
}

/** Returns null for non–super users (no client-side aggregate stats). */
export async function getEventStats(eventId: string): Promise<EventStats | null> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.user) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('super_role')
    .eq('user_id', session.user.id)
    .maybeSingle();

  if (!canViewEventParticipantStats(profile?.super_role)) {
    return null;
  }

  const { data, error } = await supabase.functions.invoke('get-event-stats', {
    body: { event_id: eventId },
  });

  if (error) {
    const forbidden =
      (data && typeof data === 'object' && (data as { error?: string }).error === 'Forbidden') ||
      error.message?.includes('403');
    if (forbidden) return null;
    throw error;
  }

  if (data && typeof data === 'object' && 'error' in data) {
    if ((data as { error?: string }).error === 'Forbidden') return null;
    throw new Error(String((data as { message?: string }).message || (data as { error: string }).error));
  }

  const stats = data as EventStats | null;
  if (!stats || typeof stats.total !== 'number') return null;
  return stats;
}

export async function getUserRegistration(eventId: string, userId: string): Promise<EventRegistration | null> {
  const { data, error } = await supabase
    .from('event_registrations')
    .select('*')
    .eq('event_id', eventId)
    .eq('user_id', userId)
    .single();
  if (error && error.code !== 'PGRST116') throw error;
  return (data as EventRegistration) || null;
}

export async function getEventAttendees(eventId: string) {
  const { data } = await supabase
    .from('event_registrations')
    .select('user_id, status')
    .eq('event_id', eventId)
    .in('status', ['registered', 'approved']);

  if (!data || data.length === 0) return [];

  const userIds = data.map(r => r.user_id);
  const { data: profiles } = await supabase
    .from('profiles')
    .select('user_id, first_name, photos, gender, avatar_url')
    .in('user_id', userIds);

  return profiles || [];
}

export async function getEventPhotos(eventId: string) {
  const { data, error } = await supabase
    .from('event_photos')
    .select('*')
    .eq('event_id', eventId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export interface EventClickProfile {
  user_id: string;
  first_name: string | null;
  photos: string[] | null;
  avatar_url: string | null;
  occupation: string | null;
  bio: string | null;
  date_of_birth: string | null;
  interests: string[] | null;
  region: string | null;
}

export interface EventClick {
  profile: EventClickProfile;
  compatibilityScore: number;
  sharedInterests: string[];
  sameRegion: boolean;
}

/**
 * Returns top "clicks" (best matches) among the event's attendees for the current user.
 * Score = Jaccard% of shared interests, +15 bonus if same region (capped at 100).
 * Filters out attendees with no first_name/photo. Returns empty array when not enough data.
 */
export async function getEventClicks(
  eventId: string,
  currentUserId: string,
  limit = 5,
): Promise<EventClick[]> {
  if (!currentUserId) return [];

  // 1. Get attendees
  const { data: regs } = await supabase
    .from('event_registrations')
    .select('user_id, status')
    .eq('event_id', eventId)
    .in('status', ['registered', 'approved']);

  if (!regs || regs.length === 0) return [];

  const otherIds = regs
    .map(r => r.user_id)
    .filter(id => id !== currentUserId);

  if (otherIds.length === 0) return [];

  // 2. Fetch profiles for current user (for compare baseline) + the others
  const [{ data: meRows }, { data: othersRows }] = await Promise.all([
    supabase
      .from('profiles')
      .select('interests, region')
      .eq('user_id', currentUserId)
      .single(),
    supabase
      .from('profiles')
      .select(
        'user_id, first_name, photos, avatar_url, occupation, bio, date_of_birth, interests, region, moderation_status',
      )
      .in('user_id', otherIds),
  ]);

  if (!othersRows || othersRows.length === 0) return [];

  const me = (meRows || {}) as { interests: string[] | null; region: string | null };
  const myInterests = me.interests || [];
  const myRegion = me.region || null;

  // 3. Compute scores
  const scored: EventClick[] = (othersRows as (EventClickProfile & { moderation_status?: string | null })[])
    .filter((p) => p.moderation_status === 'approved')
    .filter(p => !!p.first_name && (p.photos?.length || p.avatar_url))
    .map((row) => {
      const full = row as EventClickProfile & { moderation_status?: string | null };
      const { moderation_status: _m, ...profile } = full;
      const theirInterests = profile.interests || [];
      const shared = myInterests.filter(i => theirInterests.includes(i));
      const totalUnique = new Set([...myInterests, ...theirInterests]).size;
      const jaccard = totalUnique > 0 ? Math.round((shared.length / totalUnique) * 100) : 0;
      const sameRegion = !!myRegion && !!profile.region && myRegion === profile.region;
      const score = Math.min(100, jaccard + (sameRegion ? 15 : 0));

      return {
        profile,
        compatibilityScore: score,
        sharedInterests: shared,
        sameRegion,
      };
    })
    .sort((a, b) => b.compatibilityScore - a.compatibilityScore);

  return scored.slice(0, limit);
}

export class MonthlyEventLimitError extends Error {
  readonly used: number;
  readonly cap: number;
  constructor(used: number, cap: number) {
    super('monthly_event_limit');
    this.name = 'MonthlyEventLimitError';
    this.used = used;
    this.cap = cap;
  }
}

export class SubscriptionRequiredError extends Error {
  constructor() {
    super('subscription_required');
    this.name = 'SubscriptionRequiredError';
  }
}

export class SubscriptionValidationUnavailableError extends Error {
  constructor() {
    super('subscription_validation_unavailable');
    this.name = 'SubscriptionValidationUnavailableError';
  }
}

export class EventRegistrationError extends Error {
  readonly errorCode: string;
  constructor(errorCode: string, message: string) {
    super(errorCode);
    this.name = 'EventRegistrationError';
    this.errorCode = errorCode;
    this.message = message;
  }
}

export type EventRegistrationResult = {
  ok: true;
  status: 'registered' | 'waitlisted' | 'already_registered';
  message: string;
  registration_status: string;
  waitlist_position: number | null;
  entry_code: string | null;
  success: true;
};

async function parseEdgeFunctionJsonBody(
  data: unknown,
  fnError: unknown,
): Promise<Record<string, unknown> | null> {
  if (data && typeof data === 'object') return data as Record<string, unknown>;

  if (fnError instanceof FunctionsHttpError) {
    const res = fnError.context as Response;
    try {
      const body = await res.json();
      if (body && typeof body === 'object') return body as Record<string, unknown>;
    } catch {
      /* ignore */
    }
  }

  const ctx = fnError as { context?: { body?: unknown } } | null;
  const b = ctx?.context?.body;
  if (b && typeof b === 'object') return b as Record<string, unknown>;
  return null;
}

function extractFunctionErrorBody(data: unknown, fnError: unknown): Record<string, unknown> | null {
  if (data && typeof data === 'object') return data as Record<string, unknown>;
  const ctx = fnError as { context?: { body?: unknown } } | null;
  const b = ctx?.context?.body;
  if (b && typeof b === 'object') return b as Record<string, unknown>;
  return null;
}

/** Maps register-for-event body to result or typed errors (Hebrew messages). */
export function mapEventRegistrationResponse(body: Record<string, unknown>): EventRegistrationResult {
  if (body.ok === false) {
    const code = String(body.error_code || body.error || 'server_error');
    const message =
      typeof body.message === 'string' && body.message.trim()
        ? body.message
        : mapEventRegistrationErrorMessage(code, body);

    if (code === 'monthly_event_limit_reached') {
      throw new MonthlyEventLimitError(Number(body.used) || 0, Number(body.cap) || DEFAULT_MONTHLY_EVENT_CAP);
    }
    if (code === 'subscription_required') {
      throw new SubscriptionRequiredError();
    }
    if (code === 'subscription_validation_unavailable') {
      throw new SubscriptionValidationUnavailableError();
    }
    throw new EventRegistrationError(code, message);
  }

  const status = String(body.status || body.registration_status || 'registered');
  const registrationStatus =
    status === 'waitlisted' ? 'waitlist' : status === 'already_registered' ? String(body.registration_status || 'registered') : status;

  return {
    ok: true,
    status: status === 'waitlisted' ? 'waitlisted' : status === 'already_registered' ? 'already_registered' : 'registered',
    message:
      typeof body.message === 'string' && body.message.trim()
        ? body.message
        : status === 'waitlisted'
          ? 'נוספת לרשימת המתנה'
          : status === 'already_registered'
            ? 'כבר נרשמת לאירוע'
            : 'נרשמת לאירוע בהצלחה',
    registration_status: registrationStatus,
    waitlist_position:
      typeof body.waitlist_position === 'number' ? body.waitlist_position : null,
    entry_code: typeof body.entry_code === 'string' ? body.entry_code : null,
    success: true,
  };
}

export function mapEventRegistrationErrorMessage(
  code: string,
  body?: Record<string, unknown>,
): string {
  switch (code) {
    case 'subscription_required':
      return 'אירוע זה דורש מנוי פעיל';
    case 'subscription_validation_unavailable':
      return 'לא הצלחנו לאמת מנוי כרגע. נסו שוב בעוד רגע';
    case 'monthly_event_limit_reached':
      return typeof body?.message === 'string' ? body.message : 'הגעת למכסה החודשית לאירועים';
    case 'user_not_allowed':
      return 'אין אפשרות להירשם לאירוע זה';
    case 'event_not_found':
      return 'האירוע לא נמצא';
    case 'invalid_request':
      return 'בקשה לא תקינה';
    case 'already_registered':
      return 'כבר נרשמת לאירוע';
    default:
      return 'לא הצלחנו להשלים את ההרשמה. נסה/י שוב';
  }
}

export function isOpaqueEdgeInvokeMessage(msg: string): boolean {
  const lower = msg.toLowerCase();
  return lower.includes('non-2xx') || lower.includes('edge function returned');
}

export async function getMyMonthlyEventRegistrationUsage(): Promise<{ used: number; cap: number } | null> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.user) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('super_role, role')
    .eq('user_id', session.user.id)
    .maybeSingle();
  if (profile?.super_role) {
    return { used: 0, cap: DEFAULT_MONTHLY_EVENT_CAP };
  }
  if (profile?.role !== 'member') {
    return null;
  }

  const { data: rows, error } = await supabase
    .from('event_registrations')
    .select('created_at')
    .eq('user_id', session.user.id)
    .in('status', ['registered', 'approved', 'checked_in']);
  if (error) {
    console.warn('getMyMonthlyEventRegistrationUsage:', error.message);
    return { used: 0, cap: DEFAULT_MONTHLY_EVENT_CAP };
  }
  const used = countRowsInCurrentJerusalemMonth(rows || []);
  return { used, cap: DEFAULT_MONTHLY_EVENT_CAP };
}

export async function getMyEventVotesForEvent(
  eventId: string,
  voterId: string,
): Promise<{ votee_id: string; vote: string }[]> {
  const { data, error } = await supabase
    .from('event_votes')
    .select('votee_id, vote')
    .eq('event_id', eventId)
    .eq('voter_id', voterId);
  if (error) throw error;
  return data || [];
}

export async function getVotableAttendees(eventId: string, voterId: string) {
  const { data } = await supabase
    .from('event_registrations')
    .select('user_id, status')
    .eq('event_id', eventId)
    .in('status', ['registered', 'approved'])
    .neq('user_id', voterId);

  if (!data || data.length === 0) return [];

  const userIds = data.map(r => r.user_id);
  const { data: profiles } = await supabase
    .from('profiles')
    .select('user_id, first_name, photos, gender, interests, avatar_url')
    .in('user_id', userIds);

  return profiles || [];
}

export class EventCancellationLockedError extends Error {
  constructor() {
    super('cancellation_locked');
    this.name = 'EventCancellationLockedError';
  }
}

export async function cancelEventRegistration(eventId: string) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) throw new Error('Not authenticated');

  const { data, error } = await supabase.functions.invoke('cancel-event-registration', {
    body: { event_id: eventId },
  });
  const body = extractFunctionErrorBody(data, error);
  if (body?.error === 'cancellation_locked') {
    throw new EventCancellationLockedError();
  }
  if (error) {
    const msg = typeof body?.message === 'string' ? body.message : error.message;
    throw new Error(msg || 'Cancellation failed');
  }
  if (data && typeof data === 'object' && 'error' in data && !('success' in data && data.success === true)) {
    throw new Error(String((data as { message?: string }).message || (data as { error: string }).error));
  }
  return data;
}

export async function registerForEvent(eventId: string): Promise<EventRegistrationResult> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) throw new Error('Not authenticated');

  const { data, error } = await supabase.functions.invoke('register-for-event', {
    body: { event_id: eventId },
  });

  const body = await parseEdgeFunctionJsonBody(data, error);

  if (body) {
    return mapEventRegistrationResponse(body);
  }

  if (error) {
    const raw = error.message || 'Registration failed';
    if (isOpaqueEdgeInvokeMessage(raw)) {
      throw new EventRegistrationError('server_error', mapEventRegistrationErrorMessage('server_error'));
    }
    throw new EventRegistrationError('server_error', raw);
  }

  throw new EventRegistrationError('server_error', mapEventRegistrationErrorMessage('server_error'));
}

export async function submitVotes(
  eventId: string,
  votes: { votee_id: string; vote: string }[]
) {
  const { data, error } = await supabase.functions.invoke('submit-votes', {
    body: { event_id: eventId, votes },
  });
  if (error) throw error;
  return data;
}

export function generateIcsFile(event: EventRow): string {
  const startDate = new Date(`${event.date}T${event.time}`);
  const endDate = new Date(startDate.getTime() + 3 * 60 * 60 * 1000); // 3 hours
  const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'BEGIN:VEVENT',
    `DTSTART:${fmt(startDate)}`,
    `DTEND:${fmt(endDate)}`,
    `SUMMARY:${event.name}`,
    `LOCATION:${event.location_address || event.location_name}`,
    `DESCRIPTION:${event.description || ''}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
}

export function downloadIcs(event: EventRow) {
  const ics = generateIcsFile(event);
  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${event.name}.ics`;
  a.click();
  URL.revokeObjectURL(url);
}
