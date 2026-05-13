/**
 * Detects errors that usually mean DB migration or Edge Functions were not deployed yet,
 * so callers can show a setup hint instead of a generic failure toast.
 */
export function isLikelyAutomationInfraMissing(err: unknown): boolean {
  const text = stringifyErr(err).toLowerCase();
  if (!text) return false;

  const mentionsAutomation =
    text.includes('automation_logs') ||
    text.includes('automation_templates') ||
    text.includes('automation_flows') ||
    text.includes('schema cache');

  if (mentionsAutomation && (text.includes('does not exist') || text.includes('could not find'))) {
    return true;
  }

  if (text.includes('relation') && text.includes('automation') && text.includes('exist')) {
    return true;
  }

  const mentionsAutomationFn =
    text.includes('automation-recipients') ||
    text.includes('automation-dispatch') ||
    text.includes('automation-retry-log');

  if (
    mentionsAutomationFn &&
    (text.includes('non-2xx') ||
      text.includes('edge function') ||
      text.includes('function not found') ||
      (text.includes('404') && (text.includes('function') || text.includes('invoke'))))
  ) {
    return true;
  }

  if (text.includes('failed to fetch') && text.includes('functions') && mentionsAutomationFn) {
    return true;
  }

  return false;
}

/** User-facing toast when automation-dispatch returns success: false (parsed from Edge / HTTP body). */
export function automationDispatchFailureMessage(res: {
  success?: boolean;
  error?: string;
  message?: string;
  http_status?: number;
  webhook_error_detail?: string;
}): string {
  if (res.error === 'webhook_not_configured') {
    return 'כתובת ה-webhook לא מוגדרת בשרת (Secrets: AUTOMATION_WEBHOOK_TEST_URL).';
  }
  if (res.error === 'campaign_segment_blocked_in_test') {
    return (
      res.message ||
      'קמפיין לקהל חסום במצב בדיקה בשרת. הגדר AUTOMATION_WEBHOOK_MODE=production או AUTOMATION_ALLOW_REAL_AUDIENCE_IN_TEST.'
    );
  }
  if (res.error === 'single_user_test_blocked_in_test_env') {
    return res.message || 'במצב בדיקה בשרת השתמשו באימייל ידני לבדיקה.';
  }
  if (res.error === 'manual_test_email_required' || res.error === 'invalid_manual_test_email') {
    return res.message || 'נדרש אימייל בדיקה תקין במצב בדיקה.';
  }
  if (res.error === 'recipient_not_found') {
    return 'הנמען לא נמצא במערכת.';
  }
  if (res.message === 'webhook_error') {
    const status = res.http_status != null ? `HTTP ${res.http_status}` : 'שגיאת רשת';
    const hint = res.webhook_error_detail?.trim()
      ? ` — ${res.webhook_error_detail.trim().slice(0, 180)}`
      : '';
    return `ה-webhook ב-n8n החזיר ${status}${hint}. ודא שהזרימה פעילה ובודקת POST ל-webhook הבדיקה.`;
  }
  return res.message || res.error || 'השליחה נכשלה';
}

export function stringifyErr(err: unknown): string {
  if (err == null) return '';
  if (typeof err === 'string') return err;
  if (err instanceof Error) {
    const c = 'cause' in err ? (err as Error & { cause?: unknown }).cause : undefined;
    return `${err.name}: ${err.message}${c != null ? `\n${String(c)}` : ''}`;
  }
  try {
    return JSON.stringify(err, Object.getOwnPropertyNames(err as object));
  } catch {
    return String(err);
  }
}
