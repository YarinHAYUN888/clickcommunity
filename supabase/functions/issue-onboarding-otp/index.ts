import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { jsonResponse, optionsOk } from "../_shared/edgeAuth.ts";
import {
  generateNumericOtp,
  hashOtpCode,
  normalizeIdentifier,
} from "../_shared/otpCrypto.ts";

const MAX_ISSUES_PER_HOUR = 8;
const OTP_TTL_MINUTES = 15;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return optionsOk();

  try {
    const body = await req.json().catch(() => ({}));
    const identifier = normalizeIdentifier(
      body.email,
      body.phone,
      body.verificationMethod ?? body.channel,
    );
    if (!identifier) {
      return jsonResponse({ error: "email or phone required" }, 400);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count } = await supabase
      .from("onboarding_otp_challenges")
      .select("*", { count: "exact", head: true })
      .eq("identifier", identifier)
      .gte("created_at", since);

    if ((count ?? 0) >= MAX_ISSUES_PER_HOUR) {
      return jsonResponse({ error: "rate_limited" }, 429);
    }

    const code = generateNumericOtp();
    const codeHash = await hashOtpCode(code, identifier);
    const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000).toISOString();
    const channel = identifier.startsWith("phone:") ? "phone" : "email";

    const { data: row, error: insertErr } = await supabase
      .from("onboarding_otp_challenges")
      .insert({
        identifier,
        channel,
        code_hash: codeHash,
        expires_at: expiresAt,
      })
      .select("id")
      .single();

    if (insertErr || !row?.id) {
      console.error("[issue-onboarding-otp] insert failed", insertErr?.message);
      return jsonResponse({ error: "otp_issue_failed" }, 500);
    }

    const n8nUrl = Deno.env.get("N8N_OTP_WEBHOOK_URL")?.trim();
    if (n8nUrl) {
      const webhookPayload = {
        event: "otp_send",
        action: "send",
        code,
        challengeId: row.id,
        verificationMethod: channel,
        email: body.email ?? "",
        phone: body.phone ?? "",
        firstName: body.firstName ?? "",
        lastName: body.lastName ?? "",
        gender: body.gender ?? "",
        dateOfBirth: body.dateOfBirth ?? null,
        region: body.region ?? "",
        regionOther: body.regionOther ?? "",
        occupation: body.occupation ?? "",
        bio: body.bio ?? "",
        instagram: body.instagram ?? "",
        tiktok: body.tiktok ?? "",
        interests: body.interests ?? [],
      };
      try {
        const res = await fetch(n8nUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(webhookPayload),
        });
        if (!res.ok) {
          console.error("[issue-onboarding-otp] n8n status", res.status);
        }
      } catch (e) {
        console.error("[issue-onboarding-otp] n8n fetch failed", e);
      }
    }

    return jsonResponse({
      ok: true,
      challenge_id: row.id,
      expires_at: expiresAt,
    });
  } catch (err) {
    console.error("[issue-onboarding-otp]", err);
    return jsonResponse({ error: "unexpected_error" }, 500);
  }
});
