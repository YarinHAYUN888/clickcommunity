const OTP_SALT = Deno.env.get("OTP_HASH_SALT") ?? "clicks-onboarding-otp-v1";

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

export function normalizeIdentifier(
  email?: string,
  phone?: string,
  channel?: string,
): string | null {
  const e = typeof email === "string" ? email.trim().toLowerCase() : "";
  if (channel === "email" || (!channel && e)) {
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) return `email:${e}`;
  }
  const p = typeof phone === "string" ? phone.trim() : "";
  if (p && /^\+9725\d{8}$/.test(p)) return `phone:${p}`;
  if (e) return `email:${e}`;
  return null;
}
