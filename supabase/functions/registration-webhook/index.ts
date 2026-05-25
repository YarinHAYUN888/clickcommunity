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
    const body = await req.json();
    const action = body.action || "send";

    const n8nUrl = Deno.env.get("N8N_OTP_WEBHOOK_URL")?.trim();
    if (!n8nUrl) {
      return jsonResponse({ error: "N8N_OTP_WEBHOOK_URL not configured" }, 503);
    }

    const payload = {
      action,
      firstName: body.firstName || "",
      lastName: body.lastName || "",
      email: body.email || "",
      phone: body.phone || "",
      gender: body.gender || "",
      dateOfBirth: body.dateOfBirth || null,
      region: body.region || "",
      regionOther: body.regionOther || "",
      occupation: body.occupation || "",
      bio: body.bio || "",
      instagram: body.instagram || "",
      tiktok: body.tiktok || "",
      interests: body.interests || [],
      verificationMethod: body.verificationMethod || "",
      registeredAt: new Date().toISOString(),
    };

    console.log(`[registration-webhook] action=${action} email=${payload.email ? "[set]" : "[empty]"}`);

    const webhookResponse = await fetch(n8nUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const responseText = await webhookResponse.text();
    if (!webhookResponse.ok) {
      console.error("[registration-webhook] n8n failed", webhookResponse.status);
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
    console.error("[registration-webhook] unexpected", error);
    return jsonResponse({
      ok: false,
      fallback: true,
      error: error instanceof Error ? error.message : "Unexpected error",
    });
  }
});
