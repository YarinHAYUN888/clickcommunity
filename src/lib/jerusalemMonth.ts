/** Calendar year-month in Asia/Jerusalem (for monthly quotas). */
export function jerusalemYearMonth(d: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jerusalem',
    year: 'numeric',
    month: '2-digit',
  }).format(d);
}

export function countRowsInCurrentJerusalemMonth<T extends { created_at: string }>(rows: T[]): number {
  const ym = jerusalemYearMonth(new Date());
  let n = 0;
  for (const r of rows) {
    if (!r.created_at) continue;
    if (jerusalemYearMonth(new Date(r.created_at)) === ym) n += 1;
  }
  return n;
}
