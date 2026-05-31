import type { AuthError } from '@supabase/supabase-js';

function isServiceRestricted(error: AuthError): boolean {
  const status = error.status;
  const msg = (error.message ?? '').toLowerCase();
  return (
    status === 402 ||
    status === 503 ||
    msg.includes('restricted') ||
    msg.includes('exceed') ||
    msg.includes('egress') ||
    msg.includes('quota') ||
    msg.includes('spend cap')
  );
}

/** User-facing Hebrew message for login / password auth failures. */
export function getLoginErrorMessage(error: AuthError | null | undefined): string {
  if (!error) return 'אימייל או סיסמה שגויים';

  if (isServiceRestricted(error)) {
    return 'המערכת מושהה זמנית בגלל מגבלת תעבורה בשרת. יש לשדרג את תוכנית Supabase או להסיר מגבלות — ואז ההתחברות תחזור לעבוד.';
  }

  const msg = error.message.toLowerCase();
  if (msg.includes('email not confirmed')) {
    return 'יש לאמת את כתובת האימייל לפני ההתחברות.';
  }
  if (
    msg.includes('invalid login credentials') ||
    msg.includes('invalid email or password') ||
    error.status === 400
  ) {
    return 'אימייל או סיסמה שגויים';
  }

  if (import.meta.env.DEV) {
    console.error('[auth]', error.status, error.message);
  }
  return 'שגיאה בהתחברות. נסו שוב.';
}
