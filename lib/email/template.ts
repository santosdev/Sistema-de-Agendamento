/**
 * Plain e-mail layout: inline styles and tables, because e-mail clients ignore most CSS.
 * Colors from DESIGN.md (brand, ink, surfaces). Every dynamic value is escaped.
 */

export type EmailContent = {
  title: string;
  intro: string;
  rows: [label: string, value: string][];
  cta?: { label: string; url: string };
  notes?: string[];
  footer: string;
};

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const nl2br = (value: string) => escapeHtml(value).replace(/\r?\n/g, "<br>");

export function renderEmail(c: EmailContent): { html: string; text: string } {
  const rows = c.rows
    .map(
      ([label, value]) => `
        <tr>
          <td style="padding:8px 0;color:#5B5670;font-size:13px;vertical-align:top;width:140px">${escapeHtml(label)}</td>
          <td style="padding:8px 0;color:#16131F;font-size:15px">${nl2br(value)}</td>
        </tr>`,
    )
    .join("");

  const cta = c.cta
    ? `<p style="margin:24px 0 0"><a href="${escapeHtml(c.cta.url)}" style="display:inline-block;background:#5B02FD;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 20px;border-radius:12px">${escapeHtml(c.cta.label)}</a></p>`
    : "";

  const notes = (c.notes ?? [])
    .map((n) => `<p style="margin:16px 0 0;color:#5B5670;font-size:13px;line-height:18px">${nl2br(n)}</p>`)
    .join("");

  const html = `<!doctype html>
<html lang="pt-BR">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(c.title)}</title></head>
<body style="margin:0;padding:0;background:#F7F5FC;font-family:Inter,Segoe UI,Helvetica,Arial,sans-serif">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F7F5FC;padding:24px 12px">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid #E7E3F1;border-radius:20px">
        <tr><td style="padding:28px">
          <p style="margin:0 0 20px;color:#5B02FD;font-weight:700;font-size:15px">Tech Resolute</p>
          <h1 style="margin:0 0 8px;color:#16131F;font-size:22px;line-height:28px">${escapeHtml(c.title)}</h1>
          <p style="margin:0 0 16px;color:#3D3850;font-size:15px;line-height:22px">${nl2br(c.intro)}</p>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #EEEAF5">${rows}
          </table>
          ${cta}
          ${notes}
        </td></tr>
      </table>
      <p style="margin:16px 0 0;color:#5B5670;font-size:12px">${escapeHtml(c.footer)}</p>
    </td></tr>
  </table>
</body>
</html>`;

  const text = [
    c.title,
    "",
    c.intro,
    "",
    ...c.rows.map(([label, value]) => `${label}: ${value}`),
    ...(c.cta ? ["", `${c.cta.label}: ${c.cta.url}`] : []),
    ...(c.notes ?? []).flatMap((n) => ["", n]),
    "",
    c.footer,
  ].join("\n");

  return { html, text };
}
