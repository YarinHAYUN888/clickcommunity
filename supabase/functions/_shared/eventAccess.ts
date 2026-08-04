import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

export const EVENT_ACCESS_MIN_INCOMING_CLICKS = 5;

export type ProfileClickStatsRow = {
  incoming_click_count: number;
  event_access_unlocked_at: string | null;
};

export type EventAccessProfile = {
  super_role?: boolean | null;
  role?: string | null;
  suitability_status?: string | null;
  is_shadow?: boolean | null;
  moderation_status?: string | null;
};

export type EventAudienceGroup = "A" | "B" | "ALL";

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

/** Approved Group A: active + not shadow + moderation approved */
export function isApprovedGroupA(p: EventAccessProfile | null | undefined): boolean {
  if (!p) return false;
  return (
    p.suitability_status === "active" &&
    !p.is_shadow &&
    (p.moderation_status ?? "pending") === "approved"
  );
}

/**
 * Approved Group B — all three required:
 * shadow + is_shadow + moderation approved
 */
export function isApprovedGroupB(p: EventAccessProfile | null | undefined): boolean {
  if (!p) return false;
  return (
    p.suitability_status === "shadow" &&
    p.is_shadow === true &&
    (p.moderation_status ?? "pending") === "approved"
  );
}

export function normalizeAudienceGroup(raw: unknown): EventAudienceGroup {
  if (raw === "A" || raw === "B" || raw === "ALL") return raw;
  return "ALL";
}

/** Server-side audience check. Pending B candidates fail both A and B. */
export function canAccessEventAudience(
  profile: EventAccessProfile | null | undefined,
  audienceGroup: unknown,
): boolean {
  if (isEventAccessAdmin(profile)) return true;
  const audience = normalizeAudienceGroup(audienceGroup);
  if (isApprovedGroupA(profile)) {
    return audience === "A" || audience === "ALL";
  }
  if (isApprovedGroupB(profile)) {
    return audience === "B" || audience === "ALL";
  }
  return false;
}

export async function fetchEventAccessProfile(
  admin: SupabaseClient,
  userId: string,
): Promise<EventAccessProfile | null> {
  const { data, error } = await admin
    .from("profiles")
    .select("super_role, role, suitability_status, is_shadow, moderation_status")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) {
    console.error("[eventAccess] profile lookup failed", error.message);
    return null;
  }
  return (data as EventAccessProfile) ?? null;
}

/**
 * Full gate for edge functions: clicks unlock + audience group.
 * Returns null if allowed, or an error payload if denied.
 */
export async function assertEventParticipantAccess(
  admin: SupabaseClient,
  userId: string,
  event: { audience_group?: unknown },
  profile?: EventAccessProfile | null,
): Promise<{ ok: true; profile: EventAccessProfile } | { ok: false; status: number; error: string; message: string }> {
  const p = profile ?? (await fetchEventAccessProfile(admin, userId));
  if (!p) {
    return {
      ok: false,
      status: 403,
      error: "profile_required",
      message: "לא נמצא פרופיל משתמש",
    };
  }
  if (!isEventAccessAdmin(p)) {
    const unlocked = await userHasEventAccess(admin, userId, p);
    if (!unlocked) {
      return {
        ok: false,
        status: 403,
        error: "insufficient_clicks",
        message: "נדרשים 5 קליקים ממשתמשים אחרים כדי לצפות באירוע",
      };
    }
  }
  if (!canAccessEventAudience(p, event.audience_group)) {
    return {
      ok: false,
      status: 403,
      error: "audience_forbidden",
      message: "האירוע אינו זמין לקבוצה שלך",
    };
  }
  return { ok: true, profile: p };
}
