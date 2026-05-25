import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { jsonResponse } from "./edgeAuth.ts";
import {
  generateNumericOtp,
  generateVerificationToken,
  hashOtpCode,
  isValidEmail,
  normalizeIdentifier,
} from "./otpCrypto.ts";
import { getRequestMeta } from "./requestMeta.ts";
import { checkRateLimit } from "./securityRateLimit.ts";
import { writeSecurityAudit } from "./securityAudit.ts";
import { buildN8nWebhookEnvelope, toApiChannel } from "./n8nOtpEnvelope.ts";
import {
  postSignedWebhookWithRetry,
  redactWebhookPayloadForLog,
  resolveOtpWebhookUrl,
  type OtpDeliveryChannel,
} from "./webhookDispatch.ts";

const OTP_TTL_MINUTES = 15;
const MAX_PHONE_ISSUES_PER_HOUR = 8;
const DEFAULT_MAX_ATTEMPTS = 5;
const BLOCK_AFTER_MAX_MS = 15 * 60 * 1000;
const EMAIL_RATE_WINDOW_MS = 10 * 60 * 1000;
const EMAIL_MAX_PER_ADDRESS = 3;
const EMAIL_MAX_PER_IP = 5;

function serviceClient(): SupabaseClient {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

function failResponse(
  errorCode: string,
  status: number,
  extra?: Record<string, unknown>,
): Response {
  return jsonResponse({ ok: false, error_code: errorCode, error: errorCode, ...extra }, status);
}

async function checkIssueRateLimits(
  supabase: SupabaseClient,
  channel: OtpDeliveryChannel,
  identifier: string,
  ipHash: string | null,
): Promise<{ allowed: boolean; retryAfterSec?: number }> {
  if (channel === "email") {
    const emailRate = await checkRateLimit(supabase, {
      action: "otp_issue_email",
      key: identifier,
      maxCount: EMAIL_MAX_PER_ADDRESS,
      windowMs: EMAIL_RATE_WINDOW_MS,
      blockMs: EMAIL_RATE_WINDOW_MS,
    });
    if (!emailRate.allowed) {
      return { allowed: false, retryAfterSec: emailRate.retryAfterSec };
    }
    if (ipHash) {
      const ipRate = await checkRateLimit(supabase, {
        action: "otp_issue_email_ip",
        key: ipHash,
        maxCount: EMAIL_MAX_PER_IP,
        windowMs: EMAIL_RATE_WINDOW_MS,
        blockMs: EMAIL_RATE_WINDOW_MS,
      });
      if (!ipRate.allowed) {
        return { allowed: false, retryAfterSec: ipRate.retryAfterSec };
      }
    }
    return { allowed: true };
  }

  const phoneRate = await checkRateLimit(supabase, {
    action: "otp_issue_phone",
    key: identifier,
    maxCount: MAX_PHONE_ISSUES_PER_HOUR,
    windowMs: 60 * 60 * 1000,
    blockMs: 60 * 60 * 1000,
  });
  if (!phoneRate.allowed) {
    return { allowed: false, retryAfterSec: phoneRate.retryAfterSec };
  }
  return { allowed: true };
}

function normalizeChannel(
  raw: unknown,
): { internal: OtpDeliveryChannel | null; api: "email" | "sms" | null } {
  const s = String(raw ?? "").toLowerCase();
  if (s === "email") return { internal: "email", api: "email" };
  if (s === "sms" || s === "phone") return { internal: "phone", api: "sms" };
  return { internal: null, api: null };
}

async function dispatchOtp(
  channel: OtpDeliveryChannel,
  code: string,
  challengeId: string,
  body: Record<string, unknown>,
  destination: string,
  registrationSessionId: string | null,
): Promise<"sent" | "uncertain" | "skipped_no_webhook"> {
  const n8nUrl = resolveOtpWebhookUrl(channel);
  if (!n8nUrl) {
    console.warn(`[issue-otp] no webhook URL for channel=${channel}`);
    return "skipped_no_webhook";
  }

  const webhookPayload = buildN8nWebhookEnvelope(
    channel,
    code,
    challengeId,
    destination,
    body,
    registrationSessionId,
  );
  try {
    const res = await postSignedWebhookWithRetry(n8nUrl, webhookPayload, {
      timeoutMs: 12_000,
      retries: 1,
    });
    if (res.ok) return "sent";
    console.error(
      `[issue-otp] webhook channel=${channel} status=${res.status}`,
      redactWebhookPayloadForLog(webhookPayload),
    );
    return res.uncertain ? "uncertain" : "uncertain";
  } catch (e) {
    console.error(`[issue-otp] webhook channel=${channel} failed`, e);
    return "uncertain";
  }
}

export async function handleIssueOtp(req: Request): Promise<Response> {
  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  let { internal: channel, api: apiChannel } = normalizeChannel(
    body.channel ?? body.verificationMethod,
  );

  const email =
    typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const phone =
    typeof body.phone === "string" ? body.phone.trim() : "";

  if (!channel && email) {
    channel = "email";
    apiChannel = "email";
  }
  if (!channel && phone) {
    channel = "phone";
    apiChannel = "sms";
  }

  if (!channel) {
    return failResponse("email_required", 400);
  }

  if (channel === "email") {
    if (!email) return failResponse("email_required", 400);
    if (!isValidEmail(email)) return failResponse("invalid_email", 400);
  }

  if (channel === "phone") {
    if (!phone) return failResponse("phone_required", 400);
  }

  const identifier = normalizeIdentifier(
    channel === "email" ? email : undefined,
    channel === "phone" ? phone : undefined,
    channel,
  );
  if (!identifier) {
    return failResponse(channel === "email" ? "invalid_email" : "invalid_phone", 400);
  }

  const supabase = serviceClient();
  const meta = await getRequestMeta(req);
  const sessionId =
    typeof body.registration_session_id === "string"
      ? body.registration_session_id.trim()
      : null;

  const rate = await checkIssueRateLimits(supabase, channel, identifier, meta.ipHash);
  if (!rate.allowed) {
    await writeSecurityAudit(supabase, {
      action: "otp_issue_rate_limited",
      severity: "warn",
      meta,
      metadata: { channel, identifier: identifier.slice(0, 12) + "…" },
    });
    return failResponse("rate_limited", 429, { retry_after_sec: rate.retryAfterSec });
  }

  const code = generateNumericOtp();
  const codeHash = await hashOtpCode(code, identifier);
  const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000).toISOString();
  const { data: row, error: insertErr } = await supabase
    .from("onboarding_otp_challenges")
    .insert({
      identifier,
      channel,
      code_hash: codeHash,
      expires_at: expiresAt,
      registration_session_id: sessionId,
      ip_hash: meta.ipHash,
      user_agent_hash: meta.userAgentHash,
      max_attempts: DEFAULT_MAX_ATTEMPTS,
    })
    .select("id")
    .single();

  if (insertErr || !row?.id) {
    console.error("[issue-otp] insert failed", insertErr?.message);
    return failResponse("otp_issue_failed", 500);
  }

  const destinationForWebhook = channel === "email"
    ? (email ?? "")
    : (phone ?? "");
  const deliveryStatus = await dispatchOtp(
    channel,
    code,
    row.id,
    body,
    destinationForWebhook,
    sessionId,
  );

  await writeSecurityAudit(supabase, {
    action: "otp_issued",
    severity: "info",
    meta,
    targetType: "challenge",
    targetId: row.id,
    metadata: { channel, delivery_status: deliveryStatus, session_id: sessionId },
  });

  return jsonResponse({
    ok: true,
    challenge_id: row.id,
    expires_at: expiresAt,
    channel: apiChannel ?? toApiChannel(channel),
    delivery_channel: channel,
    delivery_status: deliveryStatus,
    message: "otp_sent",
  });
}

export async function handleVerifyOtp(req: Request): Promise<Response> {
  const body = await req.json().catch(() => ({}));
  const challengeId = typeof body.challenge_id === "string" ? body.challenge_id : "";
  const code = typeof body.code === "string" ? body.code.replace(/\D/g, "") : "";
  const { internal: channel } = normalizeChannel(body.channel ?? body.verificationMethod);

  const email =
    channel === "email" && typeof body.email === "string"
      ? body.email.trim().toLowerCase()
      : undefined;
  const phone =
    channel === "phone" && typeof body.phone === "string"
      ? body.phone.trim()
      : undefined;

  if (!channel) {
    return jsonResponse({ error: "invalid_request", error_code: "invalid_request" }, 400);
  }

  const identifier = normalizeIdentifier(email, phone, channel);

  if (!challengeId || code.length !== 6 || !identifier) {
    return jsonResponse({ error: "invalid_request" }, 400);
  }

  const supabase = serviceClient();
  const meta = await getRequestMeta(req);

  const { data: challenge, error: fetchErr } = await supabase
    .from("onboarding_otp_challenges")
    .select(
      "id, identifier, code_hash, expires_at, verified_at, attempt_count, verification_token, max_attempts, blocked_until, consumed_at",
    )
    .eq("id", challengeId)
    .maybeSingle();

  if (fetchErr || !challenge) {
    return jsonResponse({ error: "challenge_not_found" }, 404);
  }

  if (challenge.identifier !== identifier) {
    return jsonResponse({ error: "identifier_mismatch" }, 403);
  }

  if (challenge.verified_at && challenge.verification_token) {
    return jsonResponse({
      ok: true,
      verification_token: challenge.verification_token,
      already_verified: true,
    });
  }

  if (challenge.blocked_until && new Date(challenge.blocked_until).getTime() > Date.now()) {
    return jsonResponse({ error: "too_many_attempts" }, 429);
  }

  if (new Date(challenge.expires_at).getTime() < Date.now()) {
    return jsonResponse({ error: "otp_expired" }, 400);
  }

  const maxAttempts = challenge.max_attempts ?? DEFAULT_MAX_ATTEMPTS;
  if ((challenge.attempt_count ?? 0) >= maxAttempts) {
    const blockedUntil = new Date(Date.now() + BLOCK_AFTER_MAX_MS).toISOString();
    await supabase
      .from("onboarding_otp_challenges")
      .update({ blocked_until: blockedUntil })
      .eq("id", challengeId);
    await writeSecurityAudit(supabase, {
      action: "otp_verify_blocked",
      severity: "warn",
      meta,
      targetType: "challenge",
      targetId: challengeId,
    });
    return jsonResponse({ error: "too_many_attempts" }, 429);
  }

  const codeHash = await hashOtpCode(code, identifier);
  const match = codeHash === challenge.code_hash;
  const nextAttempts = (challenge.attempt_count ?? 0) + 1;

  await supabase
    .from("onboarding_otp_challenges")
    .update({ attempt_count: nextAttempts })
    .eq("id", challengeId);

  if (!match) {
    if (nextAttempts >= maxAttempts) {
      const blockedUntil = new Date(Date.now() + BLOCK_AFTER_MAX_MS).toISOString();
      await supabase
        .from("onboarding_otp_challenges")
        .update({ blocked_until: blockedUntil })
        .eq("id", challengeId);
    }
    await writeSecurityAudit(supabase, {
      action: "otp_verify_failed",
      severity: "warn",
      meta,
      targetType: "challenge",
      targetId: challengeId,
      metadata: { attempts: nextAttempts },
    });
    return jsonResponse({ error: "otp_invalid" }, 401);
  }

  const verificationToken = generateVerificationToken();
  const now = new Date().toISOString();
  const { error: updateErr } = await supabase
    .from("onboarding_otp_challenges")
    .update({
      verified_at: now,
      consumed_at: now,
      verification_token: verificationToken,
    })
    .eq("id", challengeId);

  if (updateErr) {
    console.error("[verify-otp] update failed", updateErr.message);
    return jsonResponse({ error: "verify_failed" }, 500);
  }

  await writeSecurityAudit(supabase, {
    action: "otp_verified",
    severity: "info",
    meta,
    targetType: "challenge",
    targetId: challengeId,
  });

  return jsonResponse({
    ok: true,
    verification_token: verificationToken,
  });
}
