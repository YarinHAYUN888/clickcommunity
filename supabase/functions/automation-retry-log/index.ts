import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { applyTransactionalEmailWrapper } from "../_shared/emailTransactionalHtml.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type AutomationPayload = {
  mode?: string;
  trigger?: string;
  template?: Record<string, unknown>;
  recipient?: Record<string, unknown>;
  event?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
};

function resolveWebhookUrl(params: { intent: string }): { url: string | null; urlType: string } {
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

function intentFromRecipientMode(mode: string | null | undefined): "test_send" | "campaign" {
  const m = (mode || "").trim();
  if (m === "manual_test" || m === "single_user") return "test_send";
  return "campaign";
}

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

    const body = await req.json().catch(() => null) as { log_id?: string } | null;
    const logId = typeof body?.log_id === "string" ? body.log_id.trim() : "";
    if (!logId || !/^[0-9a-f-]{36}$/i.test(logId)) {
      return new Response(JSON.stringify({ error: "invalid_log_id" }), { status: 400, headers: corsHeaders });
    }

    const { data: log, error: logErr } = await supabaseAdmin.from("automation_logs").select("*").eq("id", logId).maybeSingle();
    if (logErr || !log) {
      return new Response(JSON.stringify({ error: "log_not_found" }), { status: 404, headers: corsHeaders });
    }

    const payload = log.payload as Record<string, unknown> | null;
    if (!payload || typeof payload !== "object") {
      return new Response(JSON.stringify({ error: "empty_payload" }), { status: 400, headers: corsHeaders });
    }

    const outbound = JSON.parse(JSON.stringify(payload)) as AutomationPayload;
    applyTransactionalEmailWrapper(outbound, {
      logoUrl: Deno.env.get("EMAIL_LOGO_URL")?.trim() || "",
      brandAccentColor: Deno.env.get("EMAIL_BRAND_COLOR")?.trim() || "#7c3aed",
      footerLine: Deno.env.get("EMAIL_FOOTER_LINE")?.trim() || "צוות Clicks",
    });

    const intent = intentFromRecipientMode(log.recipient_mode);
    const { url: webhookUrl, urlType } = resolveWebhookUrl({ intent });

    if (!webhookUrl) {
      return new Response(JSON.stringify({ success: false, error: "webhook_not_configured" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
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
      if (!wr.ok) errorText = await wr.text().catch(() => wr.statusText);
    } catch (e) {
      errorText = e instanceof Error ? e.message : String(e);
    }

    const recipientId = typeof outbound.recipient?.user_id === "string" ? outbound.recipient.user_id : null;

    await supabaseAdmin.from("automation_logs").insert({
      flow_id: log.flow_id ?? null,
      template_id: log.template_id ?? null,
      recipient_user_id: recipientId,
      trigger_type: outbound.trigger ?? log.trigger_type ?? "manual_send",
      webhook_mode: log.webhook_mode,
      webhook_url_type: urlType,
      payload: outbound as unknown as Record<string, unknown>,
      status: webhookOk ? "success" : "failed",
      error_message: webhookOk ? null : (errorText || `HTTP ${webhookStatus}`).slice(0, 2000),
      sent_by: user.id,
      recipient_mode: log.recipient_mode,
      segment_key: log.segment_key,
      manual_test_email: log.manual_test_email,
      resolution_meta: {
        ...(typeof log.resolution_meta === "object" && log.resolution_meta ? log.resolution_meta : {}),
        retry_of: logId,
        retried_at: new Date().toISOString(),
        webhook_http_status: webhookStatus,
      },
    });

    return new Response(
      JSON.stringify({
        success: webhookOk,
        http_status: webhookStatus,
        webhook_url_type: urlType,
        message: webhookOk ? "retry_dispatched" : "webhook_error",
      }),
      { status: webhookOk ? 200 : 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("automation-retry-log:", err);
    return new Response(JSON.stringify({ error: message }), { status: 500, headers: corsHeaders });
  }
});
