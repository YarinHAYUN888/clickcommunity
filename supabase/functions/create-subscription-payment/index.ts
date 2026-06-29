import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import {
  jsonResponse,
  optionsOk,
  requireAuthUser,
} from "../_shared/edgeAuth.ts";
import { checkRateLimit } from "../_shared/securityRateLimit.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return optionsOk();

  const auth = await requireAuthUser(req);
  if (!auth.ok) return auth.response;

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const rate = await checkRateLimit(admin, {
    action: "create_subscription_payment",
    key: auth.user.id,
    maxCount: 5,
    windowMs: 60 * 1000,
  });
  if (!rate.allowed) {
    return jsonResponse({ success: false, error: "rate_limited" }, 429);
  }

  const webhookUrl = Deno.env.get("MAKE_SUBSCRIPTION_WEBHOOK_URL")?.trim();
  if (!webhookUrl) {
    console.error("SUBSCRIPTION PAYMENT WEBHOOK FAILED (missing secret)");
    return jsonResponse({ success: false, error: "unavailable" }, 503);
  }

  console.log("SUBSCRIPTION PAYMENT REQUEST START", { user_id: auth.user.id });

  try {
    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .select("first_name, last_name, phone, points")
      .eq("user_id", auth.user.id)
      .single();

    if (profileError) throw profileError;

    console.log("SUBSCRIPTION PAYMENT USER LOADED", { user_id: auth.user.id });

    const payload = {
      user_id: auth.user.id,
      email: auth.user.email ?? null,
      first_name: profile?.first_name ?? null,
      last_name: profile?.last_name ?? null,
      phone: profile?.phone ?? null,
      points: typeof profile?.points === "number" ? profile.points : 0,
      source: "click_subscription_tab",
      requested_plan: "monthly",
      created_at: new Date().toISOString(),
    };

    let makeRes: Response;
    try {
      makeRes = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } catch (_err) {
      console.error("SUBSCRIPTION PAYMENT WEBHOOK FAILED");
      return jsonResponse({ success: false, error: "payment_failed" }, 502);
    }

    if (!makeRes.ok) {
      console.error("SUBSCRIPTION PAYMENT WEBHOOK FAILED");
      return jsonResponse({ success: false, error: "payment_failed" }, 502);
    }

    console.log("SUBSCRIPTION PAYMENT WEBHOOK SENT");

    let paymentUrl: string | null = null;
    const rawBody = await makeRes.text();
    if (rawBody) {
      try {
        const parsed = JSON.parse(rawBody);
        if (parsed && typeof parsed.payment_url === "string" && parsed.payment_url.length > 0) {
          paymentUrl = parsed.payment_url;
        }
      } catch (_err) {
        // Make may return a plain acknowledgement (e.g. "Accepted") without JSON.
      }
    }

    console.log("SUBSCRIPTION PAYMENT SUCCESS");
    return jsonResponse({ success: true, payment_url: paymentUrl });
  } catch (_err) {
    console.error("SUBSCRIPTION PAYMENT WEBHOOK FAILED");
    return jsonResponse({ success: false, error: "payment_failed" }, 500);
  }
});
