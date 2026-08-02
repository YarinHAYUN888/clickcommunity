/** Maps internal errors to safe Hebrew messages for users (no stack traces or SDK text). */
export function userFacingErrorMessage(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err ?? '');
  const lower = msg.toLowerCase();

  if (
    lower.includes('postgres_changes') ||
    lower.includes('after subscribe') ||
    lower.includes('realtime:') ||
    lower.includes('supabase') ||
    lower.includes('websocket')
  ) {
    return 'לא הצלחנו לעדכן את הנתונים בזמן אמת. ניתן להמשיך להשתמש במסך ולנסות לרענן.';
  }

  return 'שגיאה לא צפויה. נסו לרענן את הדף.';
}
