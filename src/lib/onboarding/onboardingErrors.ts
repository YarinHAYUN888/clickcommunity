import type { SyncOtpWebhookResult } from '@/services/otpDelivery';
import type { OnboardingFlowErrorCode } from '@/lib/onboarding/onboardingFlowDebug';
import type { AuthCompletionFailureStage } from '@/lib/onboarding/authCompletionDebug';

const HEBREW_MESSAGES: Record<OnboardingFlowErrorCode, string> = {
  otp_webhook_failed: 'שליחת קוד האימות נכשלה. נסה/י שוב בעוד רגע.',
  otp_webhook_timeout: 'שליחת הקוד ארכה יותר מדי. בדקו חיבור לאינטרנט ונסו שוב.',
  otp_webhook_network: 'לא הצלחנו להגיע לשרת השליחה. בדקו חיבור לאינטרנט.',
  otp_code_invalid: 'קוד האימות שגוי או פג תוקף. אפשר לבקש קוד חדש.',
  registration_failed: 'השרת לא הצליח ליצור את החשבון. נסה/י שוב או בדקו את החיבור.',
  registration_invoke_transport:
    'בעיית תקשורת עם השרת. אם קיבלתם מייל אימות, נסו שוב בעוד רגע או התחברו עם הסיסמה.',
  session_token_missing: 'לא הצלחנו ליצור חיבור מאובטח. נסה/י שוב.',
  session_restore_failed: 'החשבון נוצר אך ההתחברות נכשלה. נסה/י להתחבר עם האימייל והסיסמה.',
  profile_save_failed: 'לא הצלחנו לשמור את פרטי הפרופיל. נסה/י שוב.',
  photo_upload_partial:
    'החשבון נוצר. חלק מהתמונות לא נשמרו — אפשר להוסיף תמונות מעמוד הפרופיל.',
  onboarding_finalize_partial:
    'החשבון נוצר בהצלחה, אך חלק מנתוני הפרופיל נשמרו חלקית. אפשר להשלים בעמוד הפרופיל.',
  auth_completion_sync_pending:
    'החשבון נוצר בהצלחה. חלק מהמידע יסונכרן בעוד רגע.',
  missing_credentials: 'חסרים פרטי הרשמה. חזרו להתחלה ונסו שוב.',
  unknown: 'שגיאה ביצירת החשבון. נסה/י שוב.',
};

export function getHebrewOnboardingMessage(code: OnboardingFlowErrorCode): string {
  return HEBREW_MESSAGES[code] ?? HEBREW_MESSAGES.unknown;
}

/** Never show "registration failed" when auth/session already exists. */
export function shouldShowRegistrationFailed(
  sessionExists: boolean,
  profileRowExists = false,
): boolean {
  return !sessionExists && !profileRowExists;
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
    'registration_invoke_transport',
    'session_restore_failed',
    'profile_save_failed',
    'photo_upload_partial',
    'onboarding_finalize_partial',
    'auth_completion_sync_pending',
  ];
  if (known.includes(message as OnboardingFlowErrorCode)) {
    return message as OnboardingFlowErrorCode;
  }
  return 'unknown';
}

export function verifyErrorCodeForStage(
  stage: AuthCompletionFailureStage,
  sessionExists: boolean,
): OnboardingFlowErrorCode {
  if (sessionExists) {
    return 'auth_completion_sync_pending';
  }
  switch (stage) {
    case 'registration_invoke':
      return 'registration_invoke_transport';
    case 'session':
      return 'session_restore_failed';
    case 'profile':
      return 'profile_save_failed';
    case 'images':
      return 'photo_upload_partial';
    case 'completion':
      return 'onboarding_finalize_partial';
    default:
      return 'unknown';
  }
}

export const OTP_PENDING_STORAGE_KEY = 'clicks_otp_pending';
export const OTP_PENDING_TTL_MS = 15 * 60 * 1000;

export function persistPendingOtpChallenge(challengeId: string): void {
  try {
    sessionStorage.setItem(
      OTP_PENDING_STORAGE_KEY,
      JSON.stringify({ challengeId, at: Date.now() }),
    );
  } catch {
    /* private mode */
  }
}

export function readPendingOtpChallenge(): string | null {
  try {
    const raw = sessionStorage.getItem(OTP_PENDING_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { challengeId?: string; at?: number };
    if (!parsed.challengeId || typeof parsed.at !== 'number') return null;
    if (Date.now() - parsed.at > OTP_PENDING_TTL_MS) {
      sessionStorage.removeItem(OTP_PENDING_STORAGE_KEY);
      return null;
    }
    return parsed.challengeId;
  } catch {
    return null;
  }
}

/** @deprecated Use persistPendingOtpChallenge — OTP codes are not stored client-side */
export function persistPendingOtp(_code: string): void {
  /* no-op: server-side OTP */
}

/** @deprecated */
export function readPendingOtp(): string | null {
  return null;
}

export function clearPendingOtp(): void {
  try {
    sessionStorage.removeItem(OTP_PENDING_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
