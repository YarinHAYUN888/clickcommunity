export type TemplateContext = Record<string, string | number | undefined | null>;

/** Adds derived keys (full_name, community_*, support_email, rank, approval_status) without removing originals. */
export function expandTemplateContextAliases(ctx: TemplateContext): TemplateContext {
  const first = String(ctx.first_name ?? '').trim();
  const last = String(ctx.last_name ?? '').trim();
  const full_name = [first, last].filter(Boolean).join(' ').trim();

  const community_name =
    typeof import.meta !== 'undefined' && import.meta.env?.VITE_COMMUNITY_NAME
      ? String(import.meta.env.VITE_COMMUNITY_NAME)
      : 'Clicks';
  const community_url =
    typeof import.meta !== 'undefined' && import.meta.env?.VITE_COMMUNITY_URL
      ? String(import.meta.env.VITE_COMMUNITY_URL)
      : typeof window !== 'undefined'
        ? window.location.origin
        : '';
  const support_email =
    typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPPORT_EMAIL
      ? String(import.meta.env.VITE_SUPPORT_EMAIL)
      : '';

  const rank = ctx.rank != null && ctx.rank !== '' ? String(ctx.rank) : '';
  const approval_status = typeof ctx.approval_status === 'string' ? ctx.approval_status : '';

  return {
    ...ctx,
    full_name,
    community_name,
    community_url,
    support_email,
    rank,
    approval_status,
  };
}

/** Replaces {{key}} placeholders (whitespace-tolerant). */
export function applyTemplateVars(template: string, ctx: TemplateContext): string {
  const merged = expandTemplateContextAliases(ctx);
  return template.replace(/\{\{\s*([^}]+)\s*\}\}/g, (_, rawKey: string) => {
    const k = rawKey.trim();
    const v = merged[k];
    if (v === undefined || v === null) return '';
    return String(v);
  });
}
