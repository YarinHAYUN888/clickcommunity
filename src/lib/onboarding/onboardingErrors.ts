import type { SyncOtpWebhookResult } from '@/services/otpDelivery';
import type { OnboardingFlowErrorCode } from '@/lib/onboarding/onboardingFlowDebug';

const HEBREW_MESSAGES: Record<OnboardingFlowErrorCode, string> = {
  otp_webhook_failed: 'שליחת קוד האימות נכשלה. נסה/י שוב בעוד רגע.',
  otp_webhook_timeout: 'שליחת הקוד ארכה יותר מדי. בדקו חיבור לאינטרנט ונסו שוב.',
  otp_webhook_network: 'לא הצלחנו להגיע לשרת השליחה. בדקו חיבור לאינטרנט.',
  otp_code_invalid: 'קוד האימות שגוי או פג תוקף. אפשר לבקש קוד חדש.',
  registration_failed: 'השרת לא הצליח ליצור את החשבון. נסה/י שוב או בדקו את החיבור.',
  session_token_missing: 'לא הצלחנו ליצור חיבור מאובטח. נסה/י שוב.',
  session_restore_failed: 'החשבון נוצר אך ההתחברות נכשלה. נסה/י להתחבר עם האימייל והסיסמה.',
  profile_save_failed: 'לא הצלחנו לשמור את פרטי הפרופיל. נסה/י שוב.',
  photo_upload_partial:
    'החשבון נוצר. חלק מהתמונות לא נשמרו — אפשר להוסיף תמונות מעמוד הפרופיל.',
  onboarding_finalize_partial:
    'החשבון נוצר בהצלחה, אך חלק מנתוני הפרופיל נשמרו חלקית. אפשר להשלים בעמוד הפרופיל.',
  missing_credentials: 'חסרים פרטי הרשמה. חזרו להתחלה ונסו שוב.',
  unknown: 'שגיאה ביצירת החשבון. נסה/י שוב.',
};

export function getHebrewOnboardingMessage(code: OnboardingFlowErrorCode): string {
  return HEBREW_MESSAGES[code] ?? HEBREW_MESSAGES.unknown;
}

export function classifyOtpWebhookFailure(result: SyncOtpWebhookResult): OnboardingFlowErrorCode {
  if (result.ok) return 'otp_webhook_failed';
  if (result.error === 'timeout') return 'otp_webhook_timeout';
  if (result.status === 0) return 'otp_webhook_network';
  return 'otp_webhook_failed';
}

export function errorCodeFromMessage(message: string): OnboardingFlowErrorCode {
  if (message === 'session_creation_failed') return 'session_restore_failed';

  const known: OnboardingFlowErrorCode[] = [
    'missing_credentials',
    'session_token_missing',
    'registration_failed',
    'session_restore_failed',
    'profile_save_failed',
    'photo_upload_partial',
    'onboarding_finalize_partial',
  ];
  if (known.includes(message as OnboardingFlowErrorCode)) {
    return message as OnboardingFlowErrorCode;
  }
  return 'unknown';
}

export const OTP_PENDING_STORAGE_KEY = 'clicks_otp_pending';
export const OTP_PENDING_TTL_MS = 15 * 60 * 1000;

export function persistPendingOtp(code: string): void {
  try {
    sessionStorage.setItem(
      OTP_PENDING_STORAGE_KEY,
      JSON.stringify({ code, at: Date.now() }),
    );
  } catch {
    /* private mode */
  }
}

export function readPendingOtp(): string | null {
  try {
    const raw = sessionStorage.getItem(OTP_PENDING_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { code?: string; at?: number };
    if (!parsed.code || typeof parsed.at !== 'number') return null;
    if (Date.now() - parsed.at > OTP_PENDING_TTL_MS) {
      sessionStorage.removeItem(OTP_PENDING_STORAGE_KEY);
      return null;
    }
    return parsed.code;
  } catch {
    return null;
  }
}

export function clearPendingOtp(): void {
  try {
    sessionStorage.removeItem(OTP_PENDING_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
