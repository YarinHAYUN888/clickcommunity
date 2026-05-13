import { supabase } from '@/integrations/supabase/client';
import type { RecipientUser } from '@/services/automation';

/** Columns needed for the audience picker (read via existing profiles SELECT RLS). */
export const AUDIENCE_PROFILE_COLUMNS =
  'user_id, first_name, last_name, phone, date_of_birth, points, role, status, suitability_status, moderation_status, last_seen, gender, profile_completed, avatar_url, photos, interests, super_role, suspended' as const;

export type AudienceProfileRow = {
  user_id: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  date_of_birth: string | null;
  points: number | null;
  role: string | null;
  status: string | null;
  suitability_status: string;
  moderation_status: string;
  last_seen: string | null;
  gender: string | null;
  profile_completed: boolean | null;
  avatar_url: string | null;
  photos: string[] | null;
  interests: string[] | null;
  super_role: string | null;
  suspended: boolean | null;
};

export const AUDIENCE_PAGE_SIZE = 72;

function escapeIlikeToken(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
}

export type AudienceProfileQueryFilters = {
  /** Free text — first name, last name, or phone */
  text?: string;
  pointsMin?: number | null;
  pointsMax?: number | null;
  role?: 'guest' | 'member' | '';
  moderation?: 'pending' | 'approved' | '';
  profileCompleted?: 'yes' | 'no' | '';
  interestsToken?: string;
  inactiveOnly?: boolean;
  managersOnly?: boolean;
  /** When set (1–12), only rows whose birthday month matches (client may still refine). */
  birthdayMonth?: number | null;
};

function activeNotSuspended() {
  return supabase.from('profiles').select(AUDIENCE_PROFILE_COLUMNS).or('suspended.is.null,suspended.eq.false');
}

function quoteOrValue(s: string): string {
  return `"${s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

function applyManagersAndBirthdayClient(
  rows: AudienceProfileRow[],
  filters: AudienceProfileQueryFilters,
  mode: 'browse' | 'birthdays' | 'points',
): AudienceProfileRow[] {
  let out = rows;
  if (filters.managersOnly) {
    out = out.filter((r) => r.super_role != null && String(r.super_role).trim() !== '');
  }
  if (mode === 'birthdays' && filters.birthdayMonth != null && filters.birthdayMonth >= 1 && filters.birthdayMonth <= 12) {
    out = out.filter((r) => {
      if (!r.date_of_birth) return false;
      const d = new Date(r.date_of_birth);
      return !Number.isNaN(d.getTime()) && d.getUTCMonth() + 1 === filters.birthdayMonth;
    });
  }
  return out;
}

/** When the main PostgREST query fails, filter a minimal fetch entirely on the client. */
function applyAllClientFilters(
  rows: AudienceProfileRow[],
  filters: AudienceProfileQueryFilters,
  mode: 'browse' | 'birthdays' | 'points',
): AudienceProfileRow[] {
  let out = rows;
  const t = filters.text?.trim().toLowerCase();
  if (t) {
    out = out.filter((r) => {
      const blob = [r.first_name, r.last_name, r.phone].filter(Boolean).join(' ').toLowerCase();
      return blob.includes(t) || (r.phone && r.phone.replace(/\s/g, '').includes(t.replace(/\s/g, '')));
    });
  }
  if (filters.pointsMin != null && Number.isFinite(filters.pointsMin)) {
    out = out.filter((r) => (r.points ?? 0) >= filters.pointsMin!);
  }
  if (filters.pointsMax != null && Number.isFinite(filters.pointsMax)) {
    out = out.filter((r) => (r.points ?? 0) <= filters.pointsMax!);
  }
  if (filters.role === 'guest') out = out.filter((r) => r.role === 'guest');
  if (filters.role === 'member') out = out.filter((r) => r.role === 'member');
  if (filters.moderation === 'pending') {
    out = out.filter((r) => r.moderation_status === 'pending' || r.suitability_status === 'pending');
  }
  if (filters.moderation === 'approved') {
    out = out.filter((r) => r.moderation_status === 'approved' && r.role === 'member');
  }
  if (filters.profileCompleted === 'yes') out = out.filter((r) => r.profile_completed === true);
  if (filters.profileCompleted === 'no') out = out.filter((r) => r.profile_completed === false);
  const it = filters.interestsToken?.trim().toLowerCase();
  if (it) {
    out = out.filter((r) => (r.interests || []).some((x) => String(x).toLowerCase().includes(it)));
  }
  if (filters.inactiveOnly) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 30);
    const ms = cutoff.getTime();
    out = out.filter((r) => {
      if (!r.last_seen) return true;
      const ls = new Date(r.last_seen).getTime();
      return Number.isNaN(ls) || ls < ms;
    });
  }
  return applyManagersAndBirthdayClient(out, filters, mode);
}

/**
 * Paginated profile load for the automation audience picker.
 * Uses public.profiles + existing RLS (authenticated read).
 */
export async function fetchAudienceProfilesPage(
  pageIndex: number,
  filters: AudienceProfileQueryFilters,
  mode: 'browse' | 'birthdays' | 'points',
): Promise<{ rows: AudienceProfileRow[]; error: Error | null }> {
  const from = pageIndex * AUDIENCE_PAGE_SIZE;
  const to = from + AUDIENCE_PAGE_SIZE - 1;

  let q = activeNotSuspended();

  if (mode === 'birthdays') {
    q = q.not('date_of_birth', 'is', null);
  }

  const t = filters.text?.trim();
  if (t) {
    const pat = `%${escapeIlikeToken(t)}%`;
    q = q.or(`first_name.ilike.${pat},last_name.ilike.${pat},phone.ilike.${pat}`);
  }

  if (filters.pointsMin != null && Number.isFinite(filters.pointsMin)) {
    q = q.gte('points', filters.pointsMin);
  }
  if (filters.pointsMax != null && Number.isFinite(filters.pointsMax)) {
    q = q.lte('points', filters.pointsMax);
  }

  if (filters.role === 'guest') q = q.eq('role', 'guest');
  if (filters.role === 'member') q = q.eq('role', 'member');

  if (filters.moderation === 'pending') {
    q = q.or('moderation_status.eq.pending,suitability_status.eq.pending');
  }
  if (filters.moderation === 'approved') {
    q = q.eq('moderation_status', 'approved').eq('role', 'member');
  }

  if (filters.profileCompleted === 'yes') q = q.eq('profile_completed', true);
  if (filters.profileCompleted === 'no') q = q.eq('profile_completed', false);

  const it = filters.interestsToken?.trim();
  if (it) {
    q = q.contains('interests', [it]);
  }

  if (filters.inactiveOnly) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 30);
    const iso = cutoff.toISOString();
    const qiso = quoteOrValue(iso);
    q = q.or(`last_seen.is.null,last_seen.lt.${qiso}`);
  }

  if (mode === 'birthdays') {
    q = q.order('date_of_birth', { ascending: true });
  } else {
    q = q.order('last_name', { ascending: true }).order('first_name', { ascending: true });
  }
  q = q.order('user_id', { ascending: true });

  const { data, error } = await q.range(from, to);
  if (error) {
    let mq = supabase
      .from('profiles')
      .select(AUDIENCE_PROFILE_COLUMNS)
      .or('suspended.is.null,suspended.eq.false');
    if (mode === 'birthdays') {
      mq = mq.not('date_of_birth', 'is', null);
    }
    const minimal = await mq.order('user_id', { ascending: true }).range(from, to);
    if (minimal.error) return { rows: [], error: new Error(`${error.message} (${minimal.error.message})`) };
    const rows = applyAllClientFilters((minimal.data || []) as AudienceProfileRow[], filters, mode);
    return { rows, error: null };
  }

  let rows = applyManagersAndBirthdayClient((data || []) as AudienceProfileRow[], filters, mode);

  return { rows, error: null };
}

export function audienceProfileToRecipientStub(row: AudienceProfileRow): RecipientUser {
  return {
    user_id: row.user_id,
    first_name: row.first_name,
    last_name: row.last_name,
    phone: row.phone,
    email: '',
    date_of_birth: row.date_of_birth,
    points: row.points,
    role: row.role,
    status: row.status,
    suitability_status: row.suitability_status,
    moderation_status: row.moderation_status,
    last_seen: row.last_seen ?? undefined,
    gender: row.gender,
    profile_completed: row.profile_completed,
  };
}

export function displayFullName(p: Pick<AudienceProfileRow, 'first_name' | 'last_name'>): string {
  return [p.first_name, p.last_name].filter(Boolean).join(' ').trim() || 'ללא שם';
}

export function profilePhotoSrc(p: Pick<AudienceProfileRow, 'photos' | 'avatar_url'>): string | null {
  const u = p.photos?.[0] || p.avatar_url;
  return u && u.length > 0 ? u : null;
}
