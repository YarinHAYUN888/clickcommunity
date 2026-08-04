import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { jsonResponse, optionsOk } from "../_shared/edgeAuth.ts";
import { getRequestMeta } from "../_shared/requestMeta.ts";
import { checkRateLimit } from "../_shared/securityRateLimit.ts";
import { writeSecurityAudit } from "../_shared/securityAudit.ts";

type DecisionStatus = "active" | "pending" | "shadow" | "blocked";

/**
 * Persist registration suitability with service role (bypasses privileged-column guard).
 * Shadow candidates stay moderation=pending until a community admin approves Group B.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return optionsOk();

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

  const admin = createClient(supabaseUrl, serviceKey);
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData?.user) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }
  const userId = userData.user.id;

  try {
    const body = await req.json().catch(() => ({})) as {
      suitability_status?: string;
      is_shadow?: boolean;
      risk_flags?: unknown;
      ai_summary?: string | null;
      moderation_reason?: string | null;
      moderation_confidence?: number | null;
      moderation_flags?: unknown;
    };

    const status = body.suitability_status as DecisionStatus;
    if (!["active", "pending", "shadow", "blocked"].includes(status)) {
      return jsonResponse({ error: "invalid_status" }, 400);
    }

    const meta = await getRequestMeta(req);
    const rate = await checkRateLimit(admin, {
      action: "apply_registration_suitability",
      key: userId,
      maxCount: 8,
      windowMs: 60 * 60 * 1000,
    });
    if (!rate.allowed) {
      return jsonResponse({ error: "rate_limited", retry_after_sec: rate.retryAfterSec }, 429);
    }

    const is_shadow = status === "shadow" ? true : false;
    const moderation_status =
      status === "active"
        ? "approved"
        : status === "blocked"
          ? "rejected"
          : "pending";

    const patch: Record<string, unknown> = {
      suitability_status: status,
      is_shadow,
      moderation_status,
      updated_at: new Date().toISOString(),
    };

    if (Array.isArray(body.risk_flags)) patch.risk_flags = body.risk_flags;
    if (typeof body.ai_summary === "string") patch.ai_summary = body.ai_summary;
    if (body.moderation_reason !== undefined) patch.moderation_reason = body.moderation_reason;
    if (typeof body.moderation_confidence === "number") {
      patch.moderation_confidence = body.moderation_confidence;
    }
    if (Array.isArray(body.moderation_flags)) patch.moderation_flags = body.moderation_flags;

    const { error: updErr } = await admin.from("profiles").update(patch).eq("user_id", userId);
    if (updErr) {
      console.error("[apply-registration-suitability] update failed", updErr);
      return jsonResponse({ error: "update_failed", detail: updErr.message }, 500);
    }

    await writeSecurityAudit(admin, {
      action: "apply_registration_suitability",
      userId,
      meta,
      metadata: { suitability_status: status, is_shadow, moderation_status },
    });

    return jsonResponse({
      ok: true,
      suitability_status: status,
      is_shadow,
      moderation_status,
    });
  } catch (err) {
    console.error("[apply-registration-suitability]", err);
    return jsonResponse({ error: "unexpected_error" }, 500);
  }
});
