/**
 * שליחת OTP ל-webhook של n8n מהדפדפן.
 *
 * CORS: שרת ה-webhook חייב להחזיר כותרות שמאשרות את דומיין האתר,
 * אחרת השליחה תיכשל. חלופה: פרוקסי same-origin (Edge/Netlify וכו').
 */

export const DEFAULT_N8N_OTP_WEBHOOK_URL =
  'https://redagentai.app.n8n.cloud/webhook-test/send-otp';

const SYNC_TIMEOUT_MS = 20_000;

/** שישה ספרות בטווח [100000, 999999] — קריפטוגרפית אקראי */
export function generateNumericOtp(): string {
  const buf = new Uint32Array(2);
  crypto.getRandomValues(buf);
  const combined = Number(buf[0]) * 0x100000000 + Number(buf[1]);
  const range = 900_000;
  const n = (combined % range) + 100_000;
  return String(n);
}

export type VerificationChannel = 'email' | 'phone';

/** שדות פרופיל מה-onboarding לצורך שליחת webhook */
export interface OnboardingOtpPayloadSource {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  gender?: string;
  dateOfBirth?: unknown;
  region?: string;
  regionOther?: string;
  occupation?: string;
  bio?: string;
  instagram?: string;
  tiktok?: string;
  interests?: unknown;
  photos?: unknown;
}

/** גוף JSON עקבי ל-n8n; `action` נשמר לתאימות עם flows קיימים */
export function buildOtpWebhookPayload(
  data: OnboardingOtpPayloadSource,
  verificationMethod: VerificationChannel,
  code: string,
): Record<string, unknown> {
  const phoneClean = (data.phone ?? '').replace(/[-\s]/g, '').replace(/^0/, '');
  return {
    event: 'otp_send',
    action: 'send',
    code,
    verificationMethod,
    firstName: data.firstName,
    lastName: data.lastName,
    email: data.email,
    phone: `+972${phoneClean}`,
    gender: data.gender,
    dateOfBirth: data.dateOfBirth,
    region: data.region,
    regionOther: data.regionOther,
    occupation: data.occupation,
    bio: data.bio,
    instagram: data.instagram,
    tiktok: data.tiktok,
    interests: data.interests,
    photos: data.photos,
  };
}

export interface SyncOtpWebhookResult {
  ok: boolean;
  status: number;
  error?: string;
}

export function resolveOtpWebhookUrl(): string {
  return (
    import.meta.env.VITE_N8N_OTP_WEBHOOK_URL?.trim() || DEFAULT_N8N_OTP_WEBHOOK_URL
  );
}

export async function syncOtpToWebhook(
  payload: Record<string, unknown>,
): Promise<SyncOtpWebhookResult> {
  const url = resolveOtpWebhookUrl();
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), SYNC_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    window.clearTimeout(timer);
    if (import.meta.env.DEV && !res.ok) {
      console.error('[n8n OTP webhook]', res.status);
    }
    return { ok: res.ok, status: res.status };
  } catch (e) {
    window.clearTimeout(timer);
    const error =
      e instanceof Error
        ? e.name === 'AbortError'
          ? 'timeout'
          : e.message
        : 'network_error';
    if (import.meta.env.DEV) {
      console.error('[n8n OTP webhook]', error);
    }
    return { ok: false, status: 0, error };
  }
}

/** מחלץ 6 ספרות רצופות מהטקסט (למשל מהלוח) */
export function extractSixDigitCode(text: string): string | null {
  const digits = text.replace(/\D/g, '');
  return digits.length >= 6 ? digits.slice(0, 6) : null;
}
