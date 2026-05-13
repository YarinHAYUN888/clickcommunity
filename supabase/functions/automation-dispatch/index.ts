import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { applyTransactionalEmailWrapper } from "../_shared/emailTransactionalHtml.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type AutomationPayload = {
  mode?: string;
  trigger?: string;
  template?: {
    id?: string;
    subject?: string;
    body?: string;
    body_html?: string;
    body_plain?: string;
  };
  recipient?: Record<string, unknown>;
  event?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
};

type RecipientMode = "manual_test" | "single_user" | "segment_member";

function resolveWebhookUrl(params: { intent: string; envMode: string }): { url: string | null; urlType: string } {
  const testUrl = Deno.env.get("AUTOMATION_WEBHOOK_TEST_URL")?.trim() || "";
  const prodUrl = Deno.env.get("AUTOMATION_WEBHOOK_PRODUCTION_URL")?.trim() || "";
  const globalMode = (Deno.env.get("AUTOMATION_WEBHOOK_MODE") || "test").toLowerCase();

  if (params.intent === "test_send") {
    return { url: testUrl || null, urlType: "test" };
  }

  if (globalMode === "production" && prodUrl) {
    return { url: prodUrl, urlType: "production" };
  }

  return { url: testUrl || null, urlType: testUrl ? "test_fallback" : "none" };
}

function isValidEmail(s: string): boolean {
  const t = s.trim();
  if (!t || t.length > 254) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t);
}

function redactEmail(email: string): string {
  const e = email.trim();
  const at = e.indexOf("@");
  if (at <= 1) return "***";
  const local = e.slice(0, at);
  const domain = e.slice(at + 1);
  return `${local.slice(0, 1)}***@${domain}`;
}

async function loadUserRecipient(
  supabaseAdmin: ReturnType<typeof createClient>,
  userId: string,
): Promise<Record<string, unknown> | null> {
  const { data: prof } = await supabaseAdmin.from("profiles").select(
    "user_id, first_name, last_name, phone, date_of_birth, points, role, status",
  ).eq("user_id", userId).maybeSingle();

  const { data: au, error: auErr } = await supabaseAdmin.auth.admin.getUserById(userId);
  const email = !auErr && au?.user?.email ? au.user.email : "";

  if (!email && !prof) return null;

  return {
    user_id: userId,
    email: email || "",
    first_name: prof?.first_name ?? "",
    last_name: prof?.last_name ?? "",
    phone: prof?.phone ?? "",
    date_of_birth: prof?.date_of_birth ?? null,
    points: prof?.points ?? 0,
    role: prof?.role ?? "",
    status: prof?.status ?? "",
  };
}

const PLACEHOLDER_USER = "00000000-0000-0000-0000-000000000001";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const supabaseAdmin = createClient(supabaseUrl, serviceKey);

    const { data: { user }, error: userErr } = await createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    }).auth.getUser();

    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const { data: adminProfile } = await supabaseAdmin.from("profiles").select("super_role").eq("user_id", user.id).single();
    if (!adminProfile?.super_role) {
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: corsHeaders });
    }

    const body = await req.json().catch(() => null) as {
      intent?: string;
      automation?: AutomationPayload;
      template_id?: string | null;
      flow_id?: string | null;
      recipient_mode?: RecipientMode | string;
      recipient_user_id?: string | null;
      segment_key?: string | null;
      manual_test_email?: string | null;
      segment_filters?: Record<string, unknown> | null;
    } | null;

    if (!body?.automation) {
      return new Response(JSON.stringify({ error: "automation payload required" }), { status: 400, headers: corsHeaders });
    }

    const intent = body.intent === "test_send" ? "test_send" : "campaign";
    const envMode = (Deno.env.get("AUTOMATION_WEBHOOK_MODE") || "test").toLowerCase();
    const allowRealAudienceInTest = Deno.env.get("AUTOMATION_ALLOW_REAL_AUDIENCE_IN_TEST") === "true";

    const modeRaw = body.recipient_mode;
    const mode = modeRaw === "manual_test" || modeRaw === "single_user" || modeRaw === "segment_member"
      ? modeRaw as RecipientMode
      : null;

    const manualEmail = typeof body.manual_test_email === "string" ? body.manual_test_email.trim() : "";
    const topLevelUid = typeof body.recipient_user_id === "string" ? body.recipient_user_id.trim() : "";
    const automationUid = typeof body.automation.recipient?.user_id === "string"
      ? String(body.automation.recipient.user_id).trim()
      : "";
    const effectiveUid = topLevelUid || automationUid;

    if (
      intent === "campaign" &&
      envMode === "test" &&
      mode === "segment_member" &&
      !allowRealAudienceInTest
    ) {
      return new Response(
        JSON.stringify({
          error: "campaign_segment_blocked_in_test",
          message:
            "Bulk segment sends are disabled while AUTOMATION_WEBHOOK_MODE=test. Set AUTOMATION_WEBHOOK_MODE=production or set secret AUTOMATION_ALLOW_REAL_AUDIENCE_IN_TEST=true for staging.",
        }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (intent === "campaign" && mode === "manual_test") {
      return new Response(
        JSON.stringify({ error: "invalid_recipient_mode", message: "manual_test is only valid for test_send" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (envMode === "test" && intent === "test_send" && mode === "single_user") {
      return new Response(
        JSON.stringify({
          error: "single_user_test_blocked_in_test_env",
          message:
            "במצב בדיקה בשרת (AUTOMATION_WEBHOOK_MODE=test) השתמשו ב־manual_test + אימייל ידני, או העבירו את השרת ל־production.",
        }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { url: webhookUrl, urlType } = resolveWebhookUrl({ intent, envMode });

    const resolutionMeta: Record<string, unknown> = {
      recipient_count: 1,
      intent,
      resolved_at: new Date().toISOString(),
    };
    if (body.segment_key) resolutionMeta.segment_key = body.segment_key;
    if (body.segment_filters && typeof body.segment_filters === "object") {
      resolutionMeta.segment_filters = body.segment_filters;
    }

    let recipientModeLog: string | null = mode ?? "legacy";
    let segmentKeyLog: string | null = typeof body.segment_key === "string" ? body.segment_key : null;
    let manualTestEmailLog: string | null = null;

    const outbound: AutomationPayload = {
      ...body.automation,
      recipient: { ...(body.automation.recipient || {}) },
      metadata: { ...(body.automation.metadata || {}) },
    };

    if (mode === "manual_test") {
      if (!manualEmail || !isValidEmail(manualEmail)) {
        return new Response(JSON.stringify({ error: "invalid_manual_test_email" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const previewId = effectiveUid || "";
      manualTestEmailLog = redactEmail(manualEmail);
      if (manualEmail && isValidEmail(manualEmail)) {
        if (previewId && /^[0-9a-f-]{36}$/i.test(previewId)) {
          const loaded = await loadUserRecipient(supabaseAdmin, previewId);
          if (loaded) {
            outbound.recipient = { ...loaded, email: manualEmail };
            resolutionMeta.preview_user_id = previewId;
            resolutionMeta.recipient_resolution = "manual_test_with_preview";
          } else {
            outbound.recipient = {
              user_id: PLACEHOLDER_USER,
              email: manualEmail,
              first_name: "בדיקה",
              last_name: "",
              phone: "",
            };
            resolutionMeta.recipient_resolution = "manual_test_preview_not_found";
          }
        } else {
          outbound.recipient = {
            user_id: PLACEHOLDER_USER,
            email: manualEmail,
            first_name: typeof outbound.recipient?.first_name === "string" ? outbound.recipient.first_name : "בדיקה",
            last_name: typeof outbound.recipient?.last_name === "string" ? outbound.recipient.last_name : "",
            phone: typeof outbound.recipient?.phone === "string" ? outbound.recipient.phone : "",
          };
          resolutionMeta.recipient_resolution = "manual_test_only";
        }
      }
    } else if (mode === "single_user") {
      if (!effectiveUid || !/^[0-9a-f-]{36}$/i.test(effectiveUid)) {
        return new Response(JSON.stringify({ error: "recipient_user_id required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const loaded = await loadUserRecipient(supabaseAdmin, effectiveUid);
      if (!loaded || !loaded.email) {
        return new Response(JSON.stringify({ error: "recipient_not_found" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      outbound.recipient = loaded;
      resolutionMeta.recipient_resolution = "single_user";
    } else if (mode === "segment_member") {
      if (!effectiveUid || !/^[0-9a-f-]{36}$/i.test(effectiveUid)) {
        return new Response(JSON.stringify({ error: "recipient_user_id required for segment_member" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const loaded = await loadUserRecipient(supabaseAdmin, effectiveUid);
      if (!loaded || !loaded.email) {
        return new Response(JSON.stringify({ error: "recipient_not_found" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      outbound.recipient = loaded;
      resolutionMeta.recipient_resolution = "segment_member";
    } else {
      recipientModeLog = "legacy";
      resolutionMeta.recipient_resolution = "legacy_client_payload";
    }

    outbound.metadata = {
      ...outbound.metadata,
      sent_by: user.id,
      source: "click_admin",
      created_at: new Date().toISOString(),
      recipient_resolution: {
        mode: recipientModeLog,
        segment_key: segmentKeyLog,
        delivery_email_redacted: redactEmail(String(outbound.recipient?.email ?? "")),
        preview_user_id: resolutionMeta.preview_user_id ?? null,
      },
    };

    applyTransactionalEmailWrapper(outbound, {
      logoUrl: Deno.env.get("EMAIL_LOGO_URL")?.trim() || "",
      brandAccentColor: Deno.env.get("EMAIL_BRAND_COLOR")?.trim() || "#7c3aed",
      footerLine: Deno.env.get("EMAIL_FOOTER_LINE")?.trim() || "צוות Clicks",
      supportEmail: Deno.env.get("EMAIL_SUPPORT_EMAIL")?.trim() || "",
    });

    if (!webhookUrl) {
      const logRow = {
        flow_id: body.flow_id ?? null,
        template_id: body.template_id ?? null,
        recipient_user_id: typeof outbound.recipient?.user_id === "string" ? outbound.recipient.user_id : null,
        trigger_type: outbound.trigger ?? "manual_send",
        webhook_mode: envMode,
        webhook_url_type: "missing",
        payload: outbound as unknown as Record<string, unknown>,
        status: "failed" as const,
        error_message: "Webhook URL not configured for this mode",
        sent_by: user.id,
        recipient_mode: recipientModeLog,
        segment_key: segmentKeyLog,
        manual_test_email: manualTestEmailLog,
        resolution_meta: { ...resolutionMeta, webhook_http_status: null },
      };
      await supabaseAdmin.from("automation_logs").insert(logRow);
      return new Response(
        JSON.stringify({ success: false, error: "webhook_not_configured", details: { envMode, intent } }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    let webhookOk = false;
    let webhookStatus = 0;
    let errorText = "";

    try {
      const wr = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(outbound),
      });
      webhookStatus = wr.status;
      webhookOk = wr.ok;
      if (!wr.ok) {
        errorText = await wr.text().catch(() => wr.statusText);
      }
    } catch (e) {
      errorText = e instanceof Error ? e.message : String(e);
    }

    resolutionMeta.webhook_http_status = webhookStatus;
    resolutionMeta.delivery_status = webhookOk ? "success" : "failed";
    if (!webhookOk && errorText) resolutionMeta.webhook_error_snippet = errorText.slice(0, 300);

    const recipientId = typeof outbound.recipient?.user_id === "string" ? outbound.recipient.user_id : null;

    const logInsert = {
      flow_id: body.flow_id ?? null,
      template_id: body.template_id ?? null,
      recipient_user_id: recipientId,
      trigger_type: outbound.trigger ?? "manual_send",
      webhook_mode: envMode,
      webhook_url_type: urlType,
      payload: outbound as unknown as Record<string, unknown>,
      status: webhookOk ? "success" as const : "failed" as const,
      error_message: webhookOk ? null : (errorText || `HTTP ${webhookStatus}`).slice(0, 2000),
      sent_by: user.id,
      recipient_mode: recipientModeLog,
      segment_key: segmentKeyLog,
      manual_test_email: manualTestEmailLog,
      resolution_meta: resolutionMeta as unknown as Record<string, unknown>,
    };

    const { error: logErr } = await supabaseAdmin.from("automation_logs").insert(logInsert);
    if (logErr) console.error("automation_logs insert:", logErr);

    await supabaseAdmin.from("admin_logs").insert({
      admin_id: user.id,
      action: webhookOk ? "automation_webhook_success" : "automation_webhook_failed",
      target_type: "automation",
      target_id: body.template_id || body.flow_id || null,
      details: {
        trigger: outbound.trigger,
        intent,
        webhook_url_type: urlType,
        http_status: webhookStatus,
        recipient_mode: recipientModeLog,
      },
    });

    return new Response(
      JSON.stringify({
        success: webhookOk,
        http_status: webhookStatus,
        webhook_url_type: urlType,
        intent,
        message: webhookOk ? "dispatched" : "webhook_error",
        ...(webhookOk ? {} : {
          webhook_error_detail: (errorText || `HTTP ${webhookStatus}`).slice(0, 500),
        }),
      }),
      {
        status: webhookOk ? 200 : 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("automation-dispatch:", err);
    return new Response(JSON.stringify({ error: message }), { status: 500, headers: corsHeaders });
  }
});
