/**
 * שליחת OTP ל-webhook של n8n מהדפדפן.
 *
 * CORS: שרת ה-webhook חייב להחזיר כותרות שמאשרות את דומיין האתר,
 * אחרת השליחה תיכשל. חלופה: פרוקסי same-origin (Edge/Netlify וכו').
 */

import { logOnboardingStep } from '@/lib/onboarding/onboardingFlowDebug';

export const DEFAULT_N8N_OTP_WEBHOOK_URL =
  'https://redagentai.app.n8n.cloud/webhook/send-otp';

function resolveSyncTimeoutMs(): number {
  const raw = import.meta.env.VITE_OTP_WEBHOOK_TIMEOUT_MS;
  const parsed = raw ? Number(raw) : NaN;
  if (Number.isFinite(parsed) && parsed > 0) return parsed;
  return 35_000;
}

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
  body?: unknown;
}

export function resolveOtpWebhookUrl(): string {
  return (
    import.meta.env.VITE_N8N_OTP_WEBHOOK_URL?.trim() || DEFAULT_N8N_OTP_WEBHOOK_URL
  );
}

function bodyIndicatesSuccess(body: unknown): boolean {
  if (!body || typeof body !== 'object') return false;
  const o = body as Record<string, unknown>;
  if (o.success === true || o.ok === true) return true;
  return false;
}

export async function syncOtpToWebhook(
  payload: Record<string, unknown>,
): Promise<SyncOtpWebhookResult> {
  const url = resolveOtpWebhookUrl();
  const controller = new AbortController();
  const timeoutMs = resolveSyncTimeoutMs();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);

  logOnboardingStep(2, { phase: 'webhook_start', url: url.replace(/\/\/[^/]+/, '//***') });

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    window.clearTimeout(timer);

    let body: unknown;
    try {
      const text = await res.text();
      body = text ? JSON.parse(text) : null;
    } catch {
      body = undefined;
    }

    const ok = res.ok || bodyIndicatesSuccess(body);
    if (!ok && import.meta.env.DEV) {
      console.error('[n8n OTP webhook]', res.status, body);
    }

    logOnboardingStep(2, { phase: 'webhook_done', ok, status: res.status });

    return { ok, status: res.status, body };
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
    logOnboardingStep(2, { phase: 'webhook_error', error });
    return { ok: false, status: 0, error };
  }
}

/** מחלץ 6 ספרות רצופות מהטקסט (למשל מהלוח) */
export function extractSixDigitCode(text: string): string | null {
  const digits = text.replace(/\D/g, '');
  return digits.length >= 6 ? digits.slice(0, 6) : null;
}
