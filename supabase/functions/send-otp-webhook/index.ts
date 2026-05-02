const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const WEBHOOK_URL = "https://redagentai.app.n8n.cloud/webhook-test/send-otp";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { phone } = await req.json();
    const normalizedPhone = typeof phone === "string" ? phone.trim() : "";

    if (!/^\+9725\d{8}$/.test(normalizedPhone)) {
      return new Response(JSON.stringify({ error: "Invalid phone" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Sending POST to ${WEBHOOK_URL} with phone: ${normalizedPhone}`);

    const webhookResponse = await fetch(WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: normalizedPhone }),
    });

    const responseText = await webhookResponse.text();
    console.log(`Webhook response: status=${webhookResponse.status}, body=${responseText}`);

    if (!webhookResponse.ok) {
      console.error("n8n webhook error", webhookResponse.status, responseText);
      return new Response(JSON.stringify({
        ok: false,
        fallback: true,
        status: webhookResponse.status,
        error: "Webhook failed",
        details: responseText,
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let parsedBody: unknown = null;
    try {
      parsedBody = responseText ? JSON.parse(responseText) : null;
    } catch {
      parsedBody = responseText || null;
    }

    return new Response(JSON.stringify({ ok: true, fallback: false, data: parsedBody }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Unexpected send-otp-webhook error", error);

    return new Response(JSON.stringify({
      ok: false,
      fallback: true,
      error: error instanceof Error ? error.message : "Unexpected error",
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
