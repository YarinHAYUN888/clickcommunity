/**
 * Transactional email HTML shell — premium RTL template. Used by automation-dispatch and client preview.
 * All user-controlled strings must pass through escapeHtml.
 */

export type TransactionalEmailOptions = {
  logoUrl?: string;
  /** Primary heading — used as <title>, hero header, and content card heading fallback */
  subjectLine: string;
  /** Optional subtitle shown below the hero title in the gradient header */
  heroSubtitle?: string;
  /** Card heading — defaults to subjectLine if omitted */
  contentTitle?: string;
  /** Plain or lightly formatted body text (after template vars); newlines become paragraphs */
  bodyText: string;
  /** When set, inserted as inner HTML instead of bodyText paragraphs (trusted compiled blocks only) */
  bodyHtmlFragment?: string;
  /** Optional personal message shown in the purple highlight box ("הודעה אישית") */
  messageBody?: string;
  /** CTA button URL — button is omitted when either ctaUrl or ctaText is absent */
  ctaUrl?: string;
  /** CTA button label */
  ctaText?: string;
  /** Support email shown in the footer */
  supportEmail?: string;
  footerLine: string;
  brandAccentColor: string;
};

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Normalize accidental literal "\n" sequences from stored templates */
function normalizeNewlines(t: string): string {
  return t.replace(/\\n/g, "\n");
}

export function bodyTextToHtmlParagraphs(bodyText: string): string {
  const normalized = normalizeNewlines(bodyText).trim();
  if (!normalized) return `<p style="margin:0 0 12px;">&nbsp;</p>`;

  const blocks = normalized.split(/\n\s*\n/);
  const parts: string[] = [];
  for (const block of blocks) {
    const lines = block.split("\n").map((l) => escapeHtml(l.trim())).filter(Boolean);
    if (lines.length === 0) continue;
    const inner = lines.join("<br />");
    parts.push(
      `<p style="margin:0 0 14px;line-height:1.65;color:#4b4763;">${inner}</p>`,
    );
  }
  return parts.length
    ? parts.join("")
    : `<p style="margin:0 0 12px;">${escapeHtml(normalized)}</p>`;
}

export function buildTransactionalEmailHtml(
  opts: TransactionalEmailOptions,
): string {
  const subject = escapeHtml(opts.subjectLine);
  const heroTitle = subject;
  const contentTitle = opts.contentTitle
    ? escapeHtml(opts.contentTitle)
    : subject;

  const bodyInner = opts.bodyHtmlFragment?.trim()
    ? opts.bodyHtmlFragment.trim()
    : bodyTextToHtmlParagraphs(opts.bodyText);

  const logoBlock = opts.logoUrl?.trim()
    ? `<img src="${escapeHtml(opts.logoUrl.trim())}" alt="Clicks Logo" style="max-width:130px;margin-bottom:20px;" />`
    : "";

  const heroSubtitleBlock = opts.heroSubtitle?.trim()
    ? `<p style="margin:14px 0 0;color:#f5ecff;font-size:17px;line-height:1.8;">${
      escapeHtml(opts.heroSubtitle.trim())
    }</p>`
    : "";

  const messageBodyBlock = opts.messageBody?.trim()
    ? `<div style="margin-top:24px;background:#f3ecff;border-radius:18px;padding:18px;">
        <strong style="display:block;color:#6d28d9;font-size:15px;margin-bottom:8px;">הודעה אישית</strong>
        <div style="color:#443d5f;font-size:15px;line-height:1.9;">${
      escapeHtml(opts.messageBody.trim())
    }</div>
      </div>`
    : "";

  const ctaBlock = opts.ctaUrl?.trim() && opts.ctaText?.trim()
    ? `<div style="text-align:center;margin-top:34px;">
        <a href="${escapeHtml(opts.ctaUrl.trim())}" style="display:inline-block;background:linear-gradient(135deg,#7c3aed,#a855f7);color:#ffffff;text-decoration:none;font-size:16px;font-weight:800;padding:15px 34px;border-radius:999px;box-shadow:0 12px 28px rgba(124,58,237,0.24);">${
      escapeHtml(opts.ctaText.trim())
    }</a>
      </div>`
    : "";

  const supportEmailBlock = opts.supportEmail?.trim()
    ? `<div style="margin-top:14px;color:#a19ab8;font-size:12px;">${
      escapeHtml(opts.supportEmail.trim())
    }</div>`
    : "";

  return `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>${subject}</title>
</head>

<body style="margin:0;padding:0;background:#f6f3ff;font-family:'Assistant',Arial,sans-serif;color:#1c1733;direction:rtl;">

  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f6f3ff;padding:32px 12px;">
    <tr>
      <td align="center">

        <!-- Main Container -->
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:650px;background:#ffffff;border-radius:32px;overflow:hidden;box-shadow:0 18px 45px rgba(91,33,182,0.12);">

          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#7c3aed,#a855f7);padding:42px 32px;text-align:center;">
              ${logoBlock}
              <h1 style="margin:0;color:#ffffff;font-size:34px;font-weight:800;line-height:1.4;">${heroTitle}</h1>
              ${heroSubtitleBlock}
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:34px 28px;background:#ffffff;">

              <!-- Glass Card -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:rgba(255,255,255,0.86);border:1px solid rgba(124,58,237,0.14);border-radius:24px;padding:28px;box-shadow:0 12px 35px rgba(91,33,182,0.08);">
                <tr>
                  <td>

                    <!-- Main Heading -->
                    <h2 style="margin:0 0 18px;color:#2a1857;font-size:24px;font-weight:800;line-height:1.5;">${contentTitle}</h2>

                    <!-- Main Body -->
                    <div style="color:#4b4763;font-size:16px;line-height:2;">${bodyInner}</div>

                    ${messageBodyBlock}
                    ${ctaBlock}

                  </td>
                </tr>
              </table>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#faf8ff;padding:28px 24px;text-align:center;border-top:1px solid #eee7ff;">
              <div style="color:#5b21b6;font-size:15px;font-weight:700;margin-bottom:8px;">צוות Clicks</div>
              <div style="color:#8a84a3;font-size:13px;line-height:1.8;">המייל נשלח אוטומטית ממערכת הקהילה.</div>
              ${supportEmailBlock}
            </td>
          </tr>

        </table>

      </td>
    </tr>
  </table>

</body>
</html>`;
}

export function buildPlainTextEmail(
  subjectLine: string,
  bodyText: string,
): string {
  const body = normalizeNewlines(bodyText).trim();
  return `${subjectLine.trim()}\n\n${body}`.trim();
}

function stripHtmlToPlain(s: string): string {
  return s.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function bodyLooksLikeHtml(body: string): boolean {
  return /<\s*(table|p|div|a|img|h1|h2|br)\b/i.test(body);
}

export function applyTransactionalEmailWrapper(
  outbound: { template?: Record<string, unknown> },
  env: {
    logoUrl: string;
    brandAccentColor: string;
    footerLine: string;
    supportEmail?: string;
  },
): void {
  const t = outbound.template;
  if (!t || typeof t !== "object") return;

  const subjectLine = String(t.subject ?? "");
  const bodyText = String(t.body ?? "");
  const htmlMode = bodyLooksLikeHtml(bodyText);
  const messageBody = typeof t.message_body === "string" ? t.message_body : undefined;
  const ctaUrl = typeof t.cta_url === "string" ? t.cta_url : undefined;
  const ctaText = typeof t.cta_text === "string" ? t.cta_text : undefined;
  const heroSubtitle = typeof t.hero_subtitle === "string" ? t.hero_subtitle : undefined;
  const contentTitle = typeof t.content_title === "string" ? t.content_title : undefined;

  t.body_html = buildTransactionalEmailHtml({
    logoUrl: env.logoUrl || undefined,
    subjectLine,
    heroSubtitle,
    contentTitle,
    bodyText: htmlMode ? "" : bodyText,
    bodyHtmlFragment: htmlMode ? bodyText : undefined,
    messageBody,
    ctaUrl,
    ctaText,
    supportEmail: env.supportEmail,
    footerLine: env.footerLine,
    brandAccentColor: env.brandAccentColor,
  });
}
