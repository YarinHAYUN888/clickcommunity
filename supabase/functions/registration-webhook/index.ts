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
    const body = await req.json();
    const action = body.action || "send"; // "send" or "verify"

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
      photos: body.photos || [],
      verificationMethod: body.verificationMethod || "",
      code: body.code || "",
      registeredAt: new Date().toISOString(),
    };

    console.log(`[${action}] Sending to ${WEBHOOK_URL}`, JSON.stringify(payload));

    const webhookResponse = await fetch(WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const responseText = await webhookResponse.text();
    console.log(`Webhook response: status=${webhookResponse.status}, body=${responseText}`);

    let parsedBody: unknown = null;
    try {
      parsedBody = responseText ? JSON.parse(responseText) : null;
    } catch {
      parsedBody = responseText || null;
    }

    if (!webhookResponse.ok) {
      console.error("Webhook error", webhookResponse.status, responseText);
      return new Response(JSON.stringify({
        ok: false,
        status: webhookResponse.status,
        error: "Webhook failed",
        data: parsedBody,
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true, data: parsedBody }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Registration webhook error", error);
    return new Response(JSON.stringify({
      ok: false,
      error: error instanceof Error ? error.message : "Unexpected error",
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
