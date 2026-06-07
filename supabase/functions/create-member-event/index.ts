import { jsonResponse, optionsOk, requireAuthUser } from "../_shared/edgeAuth.ts";
import { MEMBER_EVENT_MIN_POINTS } from "../_shared/points.ts";

const sanitizeEventDetails = (raw: Record<string, unknown>) => {
  const allowed = [
    "name",
    "description",
    "cover_image_url",
    "date",
    "time",
    "location_name",
    "location_address",
    "location_url",
    "max_capacity",
    "reserved_new_spots",
  ] as const;
  const next: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in raw) next[key] = raw[key];
  }
  return next;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return optionsOk();

  const auth = await requireAuthUser(req);
  if (!auth.ok) return auth.response;

  const userId = auth.user.id;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ ok: false, error_code: "invalid_request", message: "בקשה לא תקינה" });
  }

  const { data: profile, error: profileErr } = await auth.admin
    .from("profiles")
    .select("role, moderation_status, suitability_status, is_shadow, points")
    .eq("user_id", userId)
    .maybeSingle();

  if (profileErr || !profile) {
    return jsonResponse({ ok: false, error_code: "profile_not_found", message: "פרופיל לא נמצא" }, 404);
  }

  if (profile.role !== "member") {
    return jsonResponse({ ok: false, error_code: "not_member", message: "יצירת אירוע זמינה לחברי קהילה בלבד" }, 403);
  }
  if (profile.moderation_status !== "approved") {
    return jsonResponse({ ok: false, error_code: "not_approved", message: "הפרופיל טרם אושר" }, 403);
  }
  if (profile.suitability_status !== "active") {
    return jsonResponse({ ok: false, error_code: "not_active", message: "החשבון אינו פעיל" }, 403);
  }
  if (profile.is_shadow === true) {
    return jsonResponse({ ok: false, error_code: "shadow_user", message: "לא ניתן ליצור אירוע מחשבון זה" }, 403);
  }

  const points = typeof profile.points === "number" ? profile.points : 0;
  if (points < MEMBER_EVENT_MIN_POINTS) {
    return jsonResponse({
      ok: false,
      error_code: "insufficient_points",
      message: `נדרשות לפחות ${MEMBER_EVENT_MIN_POINTS} נקודות ליצירת אירוע`,
    }, 403);
  }

  const safeDetails = sanitizeEventDetails(body);
  const name = typeof safeDetails.name === "string" ? safeDetails.name.trim() : "";
  const date = typeof safeDetails.date === "string" ? safeDetails.date.trim() : "";
  const time = typeof safeDetails.time === "string" ? safeDetails.time.trim() : "";
  const locationName = typeof safeDetails.location_name === "string" ? safeDetails.location_name.trim() : "";

  if (!name || !date || !time || !locationName) {
    return jsonResponse({ ok: false, error_code: "missing_fields", message: "יש למלא שם, תאריך, שעה ומיקום" }, 400);
  }

  const rawCapacity = Number(safeDetails.max_capacity);
  const max_capacity = Number.isFinite(rawCapacity) ? Math.min(30, Math.max(5, Math.round(rawCapacity))) : 15;
  const rawReserved = Number(safeDetails.reserved_new_spots);
  const reserved_new_spots = Number.isFinite(rawReserved)
    ? Math.min(5, Math.max(0, Math.round(rawReserved)))
    : 0;

  const toOptional = (value: unknown): string | null => {
    if (typeof value !== "string") return null;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  };

  const insertPayload = {
    name,
    date,
    time,
    location_name: locationName,
    location_address: toOptional(safeDetails.location_address),
    location_url: toOptional(safeDetails.location_url),
    description: toOptional(safeDetails.description),
    cover_image_url: toOptional(safeDetails.cover_image_url),
    max_capacity,
    reserved_new_spots,
    gender_balance_target: 0.5,
    requires_subscription: false,
    status: "open" as const,
    host_id: userId,
    created_by: userId,
  };

  const { data: event, error: insertErr } = await auth.admin
    .from("events")
    .insert(insertPayload)
    .select()
    .single();

  if (insertErr) {
    return jsonResponse({ ok: false, error_code: "server_error", message: insertErr.message }, 500);
  }

  return jsonResponse({ ok: true, event });
});
