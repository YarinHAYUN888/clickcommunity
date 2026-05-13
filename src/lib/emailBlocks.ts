import { bodyTextToHtmlParagraphs, escapeHtml } from '@/lib/emailTransactionalHtml';

export type EmailBlockType = 'text' | 'button' | 'divider' | 'spacer' | 'image' | 'hero';

export type EmailBlock = {
  id: string;
  type: EmailBlockType;
  props: Record<string, unknown>;
};

function uid(): string {
  return `b_${Math.random().toString(36).slice(2, 11)}`;
}

export function defaultEmailDocumentFromPlainBody(body: string): EmailBlock[] {
  const t = (body || '').trim();
  if (!t) return [{ id: uid(), type: 'text', props: { content: '' } }];
  return [{ id: uid(), type: 'text', props: { content: body } }];
}

function coerceBlocks(raw: unknown): EmailBlock[] | null {
  if (!Array.isArray(raw)) return null;
  const out: EmailBlock[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const o = item as { id?: unknown; type?: unknown; props?: unknown };
    const id = typeof o.id === 'string' && o.id ? o.id : uid();
    const type = typeof o.type === 'string' ? o.type : '';
    if (!['text', 'button', 'divider', 'spacer', 'image', 'hero'].includes(type)) continue;
    const props = o.props && typeof o.props === 'object' && !Array.isArray(o.props) ? (o.props as Record<string, unknown>) : {};
    out.push({ id, type: type as EmailBlockType, props });
  }
  return out.length ? out : null;
}

export function parseBuilderDocument(raw: unknown): EmailBlock[] | null {
  return coerceBlocks(raw);
}

export function compileEmailDocumentToHtml(blocks: EmailBlock[]): string {
  const parts: string[] = [];
  for (const b of blocks) {
    switch (b.type) {
      case 'text': {
        const content = String(b.props.content ?? '');
        parts.push(
          `<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 16px;"><tr><td dir="rtl" style="text-align:right;">${bodyTextToHtmlParagraphs(content)}</td></tr></table>`,
        );
        break;
      }
      case 'hero': {
        const title = escapeHtml(String(b.props.title ?? ''));
        const subtitle = escapeHtml(String(b.props.subtitle ?? ''));
        parts.push(
          `<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 20px;border-radius:14px;overflow:hidden;background:linear-gradient(135deg,#7c3aed 0%,#a855f7 55%,#c084fc 100%);"><tr><td style="padding:24px 20px;text-align:center;" dir="rtl">` +
            `<p style="margin:0 0 8px;font-size:22px;font-weight:700;color:#ffffff;line-height:1.35;">${title}</p>` +
            (subtitle
              ? `<p style="margin:0;font-size:15px;line-height:1.5;color:rgba(255,255,255,0.92);">${subtitle}</p>`
              : '') +
            `</td></tr></table>`,
        );
        break;
      }
      case 'button': {
        const label = escapeHtml(String(b.props.label ?? 'פתיחה'));
        const href = String(b.props.href ?? '#').trim() || '#';
        const safeHref = /^https?:\/\//i.test(href) || href.startsWith('{{') ? href : '#';
        parts.push(
          `<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:20px 0;"><tr><td align="center" dir="rtl">` +
            `<a href="${escapeHtml(safeHref)}" style="display:inline-block;padding:14px 28px;border-radius:999px;background:#7c3aed;color:#ffffff;font-weight:600;text-decoration:none;font-size:15px;">${label}</a>` +
            `</td></tr></table>`,
        );
        break;
      }
      case 'divider':
        parts.push(
          `<table role="presentation" width="100%" style="margin:16px 0;"><tr><td style="height:1px;background:#e5e7eb;line-height:1px;font-size:0;">&nbsp;</td></tr></table>`,
        );
        break;
      case 'spacer': {
        const h = Math.min(80, Math.max(8, Number(b.props.height ?? 16) || 16));
        parts.push(
          `<table role="presentation" width="100%"><tr><td style="height:${h}px;line-height:${h}px;font-size:0;">&nbsp;</td></tr></table>`,
        );
        break;
      }
      case 'image': {
        const src = String(b.props.src ?? '').trim();
        const alt = escapeHtml(String(b.props.alt ?? ''));
        if (!src || !/^https:\/\//i.test(src)) break;
        parts.push(
          `<table role="presentation" width="100%" style="margin:12px 0;"><tr><td align="center">` +
            `<img src="${escapeHtml(src)}" alt="${alt}" width="560" style="max-width:100%;height:auto;border-radius:12px;display:block;border:0;" />` +
            `</td></tr></table>`,
        );
        break;
      }
      default:
        break;
    }
  }
  return parts.join('\n');
}

export function createEmptyTextBlock(): EmailBlock {
  return { id: uid(), type: 'text', props: { content: '' } };
}
