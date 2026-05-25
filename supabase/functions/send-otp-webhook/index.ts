import { jsonResponse, optionsOk, requireWebhookSecret } from "../_shared/edgeAuth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-webhook-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const secretErr = requireWebhookSecret(req);
  if (secretErr) return secretErr;

  try {
    const { phone } = await req.json();
    const normalizedPhone = typeof phone === "string" ? phone.trim() : "";

    if (!/^\+9725\d{8}$/.test(normalizedPhone)) {
      return jsonResponse({ error: "Invalid phone" }, 400);
    }

    const n8nUrl = Deno.env.get("N8N_OTP_WEBHOOK_URL")?.trim();
    if (!n8nUrl) {
      return jsonResponse({ error: "N8N_OTP_WEBHOOK_URL not configured" }, 503);
    }

    const webhookResponse = await fetch(n8nUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: normalizedPhone }),
    });

    const responseText = await webhookResponse.text();

    if (!webhookResponse.ok) {
      console.error("[send-otp-webhook] n8n status", webhookResponse.status);
      return jsonResponse({
        ok: false,
        fallback: true,
        status: webhookResponse.status,
        error: "Webhook failed",
      });
    }

    let parsedBody: unknown = null;
    try {
      parsedBody = responseText ? JSON.parse(responseText) : null;
    } catch {
      parsedBody = responseText || null;
    }

    return jsonResponse({ ok: true, fallback: false, data: parsedBody });
  } catch (error) {
    console.error("[send-otp-webhook] unexpected", error);
    return jsonResponse({
      ok: false,
      fallback: true,
      error: error instanceof Error ? error.message : "Unexpected error",
    });
  }
});
