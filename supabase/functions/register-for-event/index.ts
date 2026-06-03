import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { jsonResponse, optionsOk, requireAuthUser } from "../_shared/edgeAuth.ts";

function generateUniqueCode() {
  return "EVT-" + Math.random().toString(36).substring(2, 10).toUpperCase();
}

function jerusalemYearMonth(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jerusalem",
    year: "numeric",
    month: "2-digit",
  }).format(d);
}

function countRegsInCurrentJerusalemMonth(rows: { created_at: string }[]): number {
  const ym = jerusalemYearMonth(new Date());
  let n = 0;
  for (const r of rows) {
    if (!r?.created_at) continue;
    if (jerusalemYearMonth(new Date(r.created_at)) === ym) n += 1;
  }
  return n;
}

function isUniqueViolation(err: { code?: string; message?: string } | null): boolean {
  if (!err) return false;
  if (err.code === "23505") return true;
  const msg = (err.message || "").toLowerCase();
  return msg.includes("duplicate") || msg.includes("unique");
}

function alreadyRegisteredPayload(existing: {
  status: string;
  waitlist_position: number | null;
  entry_code?: string | null;
}) {
  return jsonResponse({
    ok: true,
    status: "already_registered",
    message: "כבר נרשמת לאירוע",
    registration_status: existing.status,
    waitlist_position: existing.waitlist_position,
    entry_code: existing.entry_code ?? null,
    success: true,
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return optionsOk();

  try {
    console.log("EVENT REGISTRATION REQUEST RECEIVED");

    const auth = await requireAuthUser(req);
    if (!auth.ok) return auth.response;

    const userId = auth.user.id;
    console.log("USER ID", userId);

    let body: { event_id?: string };
    try {
      body = await req.json();
    } catch {
      return jsonResponse({
        ok: false,
        error_code: "invalid_request",
        message: "בקשה לא תקינה",
      });
    }

    const event_id = typeof body.event_id === "string" ? body.event_id.trim() : "";
    if (!event_id) {
      return jsonResponse({
        ok: false,
        error_code: "invalid_request",
        message: "חסר מזהה אירוע",
      });
    }

    console.log("EVENT ID", event_id);

    const admin = auth.admin;

    const { data: event, error: eventError } = await admin
      .from("events")
      .select("*")
      .eq("id", event_id)
      .single();

    if (eventError || !event) {
      console.error("REGISTRATION FAILED", { stage: "event_not_found", event_id });
      return jsonResponse({
        ok: false,
        error_code: "event_not_found",
        message: "האירוע לא נמצא",
      });
    }

    console.log("EVENT FOUND", { event_id, status: event.status });

    if (event.status === "past" || event.status === "cancelled") {
      return jsonResponse({
        ok: false,
        error_code: "user_not_allowed",
        message: "האירוע אינו פתוח להרשמה",
      });
    }

    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .select("role, super_role, subscription_status")
      .eq("user_id", userId)
      .maybeSingle();

    if (profileError) {
      console.error("REGISTRATION FAILED", { stage: "profile_lookup", message: profileError.message });
      return jsonResponse({
        ok: false,
        error_code: "server_error",
        message: "לא הצלחנו להשלים את ההרשמה. נסה/י שוב",
      });
    }

    const role = profile?.super_role ? "admin" : profile?.role;
    const requiresSubscription = event.requires_subscription === true;
    console.log("SUBSCRIPTION REQUIRED", requiresSubscription);

    if (requiresSubscription && role !== "admin") {
      const { data: activeSubscription, error: subError } = await admin
        .from("subscriptions")
        .select("id, status, current_period_end")
        .eq("user_id", userId)
        .eq("status", "active")
        .order("current_period_end", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (subError) {
        console.error("REGISTRATION FAILED", { stage: "subscription_lookup", message: subError.message });
        return jsonResponse({
          ok: false,
          error_code: "subscription_validation_unavailable",
          message: "לא הצלחנו לאמת מנוי כרגע. נסו שוב בעוד רגע",
        });
      }

      const hasActiveSubscription =
        !!activeSubscription || profile?.subscription_status === "active";
      console.log("SUBSCRIPTION STATUS", hasActiveSubscription ? "active" : "inactive");

      if (!hasActiveSubscription) {
        return jsonResponse({
          ok: false,
          error_code: "subscription_required",
          message: "אירוע זה דורש מנוי פעיל",
        });
      }
    }

    const monthlyCap = Math.max(
      1,
      Math.min(31, Number(Deno.env.get("MONTHLY_EVENT_REGISTRATION_CAP") || "3")),
    );

    if (role !== "admin" && role === "member") {
      const { data: monthRegs, error: monthErr } = await admin
        .from("event_registrations")
        .select("created_at")
        .eq("user_id", userId)
        .in("status", ["registered", "approved", "checked_in"]);

      if (monthErr) {
        console.error("REGISTRATION FAILED", { stage: "monthly_cap", message: monthErr.message });
        return jsonResponse({
          ok: false,
          error_code: "server_error",
          message: "לא הצלחנו להשלים את ההרשמה. נסה/י שוב",
        });
      }

      const usedThisMonth = countRegsInCurrentJerusalemMonth(monthRegs || []);
      if (usedThisMonth >= monthlyCap) {
        return jsonResponse({
          ok: false,
          error_code: "monthly_event_limit_reached",
          message: `הגעת למכסה החודשית (${usedThisMonth}/${monthlyCap} אירועים)`,
          used: usedThisMonth,
          cap: monthlyCap,
        });
      }
    }

    const { data: existing, error: existingError } = await admin
      .from("event_registrations")
      .select("id, status, waitlist_position, entry_code")
      .eq("event_id", event_id)
      .eq("user_id", userId)
      .maybeSingle();

    if (existingError) {
      console.error("REGISTRATION FAILED", { stage: "existing_check", message: existingError.message });
      return jsonResponse({
        ok: false,
        error_code: "server_error",
        message: "לא הצלחנו להשלים את ההרשמה. נסה/י שוב",
      });
    }

    if (existing) {
      console.log("ALREADY REGISTERED", { event_id, userId });
      return alreadyRegisteredPayload(existing);
    }

    const capacity = Math.max(0, Number(event.max_capacity) || 0);

    const { count } = await admin
      .from("event_registrations")
      .select("*", { count: "exact", head: true })
      .eq("event_id", event_id)
      .in("status", ["registered", "approved"]);

    const currentCount = count || 0;
    console.log("CAPACITY CHECK", { currentCount, capacity });

    let regStatus: string;
    let waitlistPosition: number | null = null;

    if (capacity > 0 && currentCount >= capacity) {
      const { count: waitlistCount } = await admin
        .from("event_registrations")
        .select("*", { count: "exact", head: true })
        .eq("event_id", event_id)
        .eq("status", "waitlist");
      waitlistPosition = (waitlistCount || 0) + 1;
      regStatus = "waitlist";
    } else {
      regStatus = "registered";
    }

    let insertError: { code?: string; message: string } | null = null;
    let entryCode: string | null = null;

    for (let i = 0; i < 5; i++) {
      entryCode = generateUniqueCode();
      const insertPayload: Record<string, unknown> = {
        event_id,
        user_id: userId,
        status: regStatus,
        waitlist_position: waitlistPosition,
        entry_code: entryCode,
      };

      let { error } = await admin.from("event_registrations").insert(insertPayload);

      if (error?.message?.toLowerCase().includes("entry_code")) {
        const fallbackResult = await admin.from("event_registrations").insert({
          event_id,
          user_id: userId,
          status: regStatus,
          waitlist_position: waitlistPosition,
        });
        error = fallbackResult.error;
        if (!error) entryCode = null;
      }

      if (!error) {
        insertError = null;
        break;
      }

      if (isUniqueViolation(error)) {
        const { data: raced } = await admin
          .from("event_registrations")
          .select("id, status, waitlist_position, entry_code")
          .eq("event_id", event_id)
          .eq("user_id", userId)
          .maybeSingle();
        if (raced) {
          console.log("ALREADY REGISTERED", { event_id, userId, reason: "race" });
          return alreadyRegisteredPayload(raced);
        }
      }

      insertError = { code: error.code, message: error.message };
    }

    if (insertError) {
      console.error("REGISTRATION FAILED", { stage: "insert", message: insertError.message });
      return jsonResponse({
        ok: false,
        error_code: "server_error",
        message: "לא הצלחנו להשלים את ההרשמה. נסה/י שוב",
      });
    }

    if (regStatus === "waitlist") {
      console.log("WAITLIST CREATED", { event_id, userId, waitlistPosition });
      return jsonResponse({
        ok: true,
        status: "waitlisted",
        message: `נוספת לרשימת המתנה (מקום ${waitlistPosition})`,
        registration_status: regStatus,
        waitlist_position: waitlistPosition,
        entry_code: entryCode,
        success: true,
      });
    }

    console.log("REGISTRATION CREATED", { event_id, userId });
    return jsonResponse({
      ok: true,
      status: "registered",
      message: "נרשמת לאירוע בהצלחה",
      registration_status: regStatus,
      waitlist_position: waitlistPosition,
      entry_code: entryCode,
      success: true,
    });
  } catch (err) {
    console.error("REGISTRATION FAILED", err);
    return jsonResponse(
      {
        ok: false,
        error_code: "server_error",
        message: "לא הצלחנו להשלים את ההרשמה. נסה/י שוב",
      },
      500,
    );
  }
});
