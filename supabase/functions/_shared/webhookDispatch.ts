/** Server-only webhook dispatch with optional HMAC signature. */

export type OtpDeliveryChannel = "email" | "phone";

async function hmacSign(body: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function firstNonEmpty(...values: (string | undefined)[]): string | null {
  for (const v of values) {
    const t = v?.trim();
    if (t) return t;
  }
  return null;
}

export function resolveOtpWebhookUrl(channel: OtpDeliveryChannel): string | null {
  if (channel === "email") {
    return firstNonEmpty(
      Deno.env.get("OTP_EMAIL_WEBHOOK_URL"),
      Deno.env.get("OTP_WEBHOOK_URL"),
      Deno.env.get("N8N_OTP_WEBHOOK_URL"),
    );
  }
  return firstNonEmpty(
    Deno.env.get("OTP_SMS_WEBHOOK_URL"),
    Deno.env.get("OTP_WEBHOOK_URL"),
    Deno.env.get("N8N_OTP_WEBHOOK_URL"),
  );
}

/** @deprecated Use resolveOtpWebhookUrl(channel) */
export function resolveOtpWebhookUrlLegacy(): string | null {
  return resolveOtpWebhookUrl("phone");
}

export async function postSignedWebhook(
  url: string,
  payload: Record<string, unknown>,
  timeoutMs = 12_000,
): Promise<{ ok: boolean; status: number; timedOut?: boolean }> {
  const body = JSON.stringify(payload);
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  const secret =
    Deno.env.get("N8N_WEBHOOK_SECRET")?.trim() ||
    Deno.env.get("WEBHOOK_INTERNAL_SECRET")?.trim();
  if (secret) {
    headers["X-Webhook-Signature"] = await hmacSign(body, secret);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers,
      body,
      signal: controller.signal,
    });
    return { ok: res.ok, status: res.status };
  } catch (e) {
    const timedOut = e instanceof Error && e.name === "AbortError";
    return { ok: false, status: 0, timedOut };
  } finally {
    clearTimeout(timer);
  }
}

export type WebhookDispatchResult = {
  ok: boolean;
  status: number;
  uncertain: boolean;
};

/** POST with one retry on timeout/network failure only. */
export async function postSignedWebhookWithRetry(
  url: string,
  payload: Record<string, unknown>,
  opts?: { timeoutMs?: number; retries?: number },
): Promise<WebhookDispatchResult> {
  const timeoutMs = opts?.timeoutMs ?? 12_000;
  const retries = opts?.retries ?? 1;
  let last: { ok: boolean; status: number; timedOut?: boolean } = {
    ok: false,
    status: 0,
  };

  for (let attempt = 0; attempt <= retries; attempt++) {
    last = await postSignedWebhook(url, payload, timeoutMs);
    if (last.ok) {
      return { ok: true, status: last.status, uncertain: false };
    }
    const retryable = last.timedOut || last.status === 0;
    if (!retryable || attempt >= retries) break;
  }

  const uncertain = last.timedOut === true || last.status === 0;
  return { ok: false, status: last.status, uncertain };
}

/** Redact OTP from payloads before logging. */
export function redactWebhookPayloadForLog(
  payload: Record<string, unknown>,
): Record<string, unknown> {
  const copy = { ...payload };
  if ("code" in copy) copy.code = "[redacted]";
  if ("photos" in copy) copy.photos = "[redacted]";
  return copy;
}
