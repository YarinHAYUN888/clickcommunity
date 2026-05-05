import { supabase } from '@/integrations/supabase/client';

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
    .gte('date', startDate)
    .lte('date', endDate)
    .order('date', { ascending: true });

  if (error) throw error;
  if (!events || events.length === 0) return [];

  const filtered = await filterEventsByHostIsolation(events as EventRow[], isShadowUser);

  let myEventIds = new Set<string>();
  if (currentUserId) {
    const { data: regs } = await supabase
      .from('event_registrations')
      .select('event_id, status')
      .eq('user_id', currentUserId)
      .in('status', ['registered', 'approved']);
    if (regs) myEventIds = new Set(regs.map(r => r.event_id));
  }

  return filtered.map(e => ({
    ...e,
    is_mine: myEventIds.has(e.id),
  }));
}

export async function getEventById(eventId: string): Promise<EventRow | null> {
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .eq('id', eventId)
    .single();
  if (error) return null;
  return data as EventRow;
}

export async function getEventStats(eventId: string): Promise<EventStats> {
  const { data } = await supabase
    .from('event_registrations')
    .select('user_id, status')
    .eq('event_id', eventId)
    .in('status', ['registered', 'approved']);

  const total = data?.length || 0;
  if (total === 0) return { total: 0, femalePercent: 50, malePercent: 50 };

  const userIds = data!.map(r => r.user_id);
  const { data: profiles } = await supabase
    .from('profiles')
    .select('user_id, gender')
    .in('user_id', userIds);

  const females = profiles?.filter(p => p.gender === 'female').length || 0;
  const males = profiles?.filter(p => p.gender === 'male').length || 0;

  return {
    total,
    femalePercent: Math.round((females / total) * 100),
    malePercent: Math.round((males / total) * 100),
  };
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
      .select('user_id, first_name, photos, avatar_url, occupation, bio, date_of_birth, interests, region')
      .in('user_id', otherIds),
  ]);

  if (!othersRows || othersRows.length === 0) return [];

  const me = (meRows || {}) as { interests: string[] | null; region: string | null };
  const myInterests = me.interests || [];
  const myRegion = me.region || null;

  // 3. Compute scores
  const scored: EventClick[] = (othersRows as EventClickProfile[])
    .filter(p => !!p.first_name && (p.photos?.length || p.avatar_url))
    .map(profile => {
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

export async function registerForEvent(eventId: string) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) throw new Error('Not authenticated');
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, super_role')
    .eq('user_id', session.user.id)
    .maybeSingle();
  const role = profile?.super_role ? 'admin' : profile?.role;
  if (!['member', 'admin'].includes(role || '')) {
    throw new Error('Registration is available for members only');
  }

  const { data, error } = await supabase.functions.invoke('register-for-event', {
    body: { event_id: eventId },
  });
  if (error) throw error;
  return data;
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
