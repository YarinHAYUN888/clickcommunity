import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { jsonResponse, optionsOk } from "../_shared/edgeAuth.ts";
import { hashOtpCode, normalizeIdentifier, generateVerificationToken } from "../_shared/otpCrypto.ts";

const MAX_ATTEMPTS = 10;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return optionsOk();

  try {
    const body = await req.json().catch(() => ({}));
    const challengeId = typeof body.challenge_id === "string" ? body.challenge_id : "";
    const code = typeof body.code === "string" ? body.code.replace(/\D/g, "") : "";
    const identifier = normalizeIdentifier(
      body.email,
      body.phone,
      body.verificationMethod ?? body.channel,
    );

    if (!challengeId || code.length !== 6 || !identifier) {
      return jsonResponse({ error: "invalid_request" }, 400);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: challenge, error: fetchErr } = await supabase
      .from("onboarding_otp_challenges")
      .select("id, identifier, code_hash, expires_at, verified_at, attempt_count, verification_token")
      .eq("id", challengeId)
      .maybeSingle();

    if (fetchErr || !challenge) {
      return jsonResponse({ error: "challenge_not_found" }, 404);
    }

    if (challenge.identifier !== identifier) {
      return jsonResponse({ error: "identifier_mismatch" }, 403);
    }

    if (challenge.verified_at) {
      return jsonResponse({
        ok: true,
        verification_token: challenge.verification_token ?? null,
        already_verified: true,
      });
    }

    if (new Date(challenge.expires_at).getTime() < Date.now()) {
      return jsonResponse({ error: "otp_expired" }, 400);
    }

    if ((challenge.attempt_count ?? 0) >= MAX_ATTEMPTS) {
      return jsonResponse({ error: "too_many_attempts" }, 429);
    }

    const codeHash = await hashOtpCode(code, identifier);
    const match = codeHash === challenge.code_hash;

    await supabase
      .from("onboarding_otp_challenges")
      .update({ attempt_count: (challenge.attempt_count ?? 0) + 1 })
      .eq("id", challengeId);

    if (!match) {
      return jsonResponse({ error: "otp_invalid" }, 401);
    }

    const verificationToken = generateVerificationToken();
    const { error: updateErr } = await supabase
      .from("onboarding_otp_challenges")
      .update({
        verified_at: new Date().toISOString(),
        verification_token: verificationToken,
      })
      .eq("id", challengeId);

    if (updateErr) {
      console.error("[verify-onboarding-otp] update failed", updateErr.message);
      return jsonResponse({ error: "verify_failed" }, 500);
    }

    return jsonResponse({
      ok: true,
      verification_token: verificationToken,
    });
  } catch (err) {
    console.error("[verify-onboarding-otp]", err);
    return jsonResponse({ error: "unexpected_error" }, 500);
  }
});
