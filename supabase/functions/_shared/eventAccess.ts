import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

export const EVENT_ACCESS_MIN_INCOMING_CLICKS = 5;

export type ProfileClickStatsRow = {
  incoming_click_count: number;
  event_access_unlocked_at: string | null;
};

export type EventAccessProfile = {
  super_role?: boolean | null;
  role?: string | null;
};

export function isEventAccessAdmin(profile: EventAccessProfile | null | undefined): boolean {
  if (!profile) return false;
  if (profile.super_role) return true;
  return profile.role === "admin";
}

export function hasEventAccessFromStats(stats: ProfileClickStatsRow | null | undefined): boolean {
  if (!stats) return false;
  if (stats.event_access_unlocked_at) return true;
  return (stats.incoming_click_count ?? 0) >= EVENT_ACCESS_MIN_INCOMING_CLICKS;
}

export async function fetchProfileClickStats(
  admin: SupabaseClient,
  userId: string,
): Promise<ProfileClickStatsRow | null> {
  const { data, error } = await admin
    .from("profile_click_stats")
    .select("incoming_click_count, event_access_unlocked_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) {
    console.error("[eventAccess] stats lookup failed", error.message);
    return null;
  }
  if (!data) {
    return { incoming_click_count: 0, event_access_unlocked_at: null };
  }
  return data as ProfileClickStatsRow;
}

export async function userHasEventAccess(
  admin: SupabaseClient,
  userId: string,
  profile: EventAccessProfile | null | undefined,
): Promise<boolean> {
  if (isEventAccessAdmin(profile)) return true;
  const stats = await fetchProfileClickStats(admin, userId);
  return hasEventAccessFromStats(stats);
}
