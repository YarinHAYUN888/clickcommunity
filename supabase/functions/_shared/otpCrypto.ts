const OTP_SALT = Deno.env.get("OTP_HASH_SALT") ?? "clicks-onboarding-otp-v1";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function generateNumericOtp(): string {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  const n = (buf[0] % 900_000) + 100_000;
  return String(n);
}

export async function hashOtpCode(code: string, identifier: string): Promise<string> {
  const data = new TextEncoder().encode(`${OTP_SALT}:${identifier}:${code}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function generateVerificationToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function isValidEmail(email: string): boolean {
  return EMAIL_RE.test(email.trim().toLowerCase());
}

/** Channel-strict: email path never falls back to phone and vice versa. */
export function normalizeIdentifier(
  email?: string,
  phone?: string,
  channel?: string,
): string | null {
  const ch = typeof channel === "string" ? channel.trim().toLowerCase() : "";
  const e = typeof email === "string" ? email.trim().toLowerCase() : "";
  const p = typeof phone === "string" ? phone.trim() : "";

  if (ch === "email") {
    if (isValidEmail(e)) return `email:${e}`;
    return null;
  }

  if (ch === "phone" || ch === "sms") {
    if (p && /^\+9725\d{8}$/.test(p)) return `phone:${p}`;
    return null;
  }

  if (e && isValidEmail(e)) return `email:${e}`;
  if (p && /^\+9725\d{8}$/.test(p)) return `phone:${p}`;
  return null;
}
