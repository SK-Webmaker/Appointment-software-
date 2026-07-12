// Branded HTML email rendering — email-client-safe (tables, inline styles,
// no flexbox, no external assets). The header band takes the business's brand
// colour; text contrast on it is computed from luminance, so any accent works.
//
// One layout serves every message kind: heading, greeting, body paragraphs, an
// optional detail card (label/value rows), an optional big CTA button, footer.
import { getSetting } from './db.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));

function accentInk(hex) {
  if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return '#ffffff';
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.56 ? '#101828' : '#ffffff';
}

/**
 * Render a branded email.
 * @param {object} p
 * @param {string} p.heading      big line in the header band
 * @param {string} [p.greeting]   "Hi Amara,"
 * @param {string[]} [p.paragraphs]
 * @param {Array<[string,string]>} [p.details]  label/value rows in a card
 * @param {{label:string,url:string}} [p.cta]
 * @param {string} [p.footNote]   small line under the body
 */
export function renderEmail(p) {
  const biz = getSetting('business_name', 'Your booking');
  const accent = /^#[0-9a-fA-F]{6}$/.test(getSetting('brand_accent', '')) ? getSetting('brand_accent') : '#2563eb';
  const ink = accentInk(accent);
  const phone = getSetting('business_phone', '');
  const address = getSetting('business_address', '');

  const detailRows = (p.details || []).filter(([, v]) => v !== '' && v != null).map(([label, value]) => `
    <tr>
      <td style="padding:7px 0;font-size:12px;color:#6b7686;letter-spacing:0.04em;text-transform:uppercase;vertical-align:top;white-space:nowrap;padding-right:18px;">${esc(label)}</td>
      <td style="padding:7px 0;font-size:14px;color:#101828;font-weight:600;text-align:right;">${esc(value)}</td>
    </tr>`).join('');

  const detailCard = detailRows ? `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f7fa;border-radius:10px;margin:20px 0;">
      <tr><td style="padding:16px 20px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${detailRows}</table>
      </td></tr>
    </table>` : '';

  const ctaBlock = p.cta ? `
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px auto 6px;">
      <tr><td style="border-radius:10px;background:${accent};">
        <a href="${esc(p.cta.url)}" style="display:inline-block;padding:13px 34px;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:bold;color:${ink};text-decoration:none;border-radius:10px;">${esc(p.cta.label)}</a>
      </td></tr>
    </table>` : '';

  const paragraphs = (p.paragraphs || []).map((t) =>
    `<p style="margin:0 0 14px;font-size:14.5px;line-height:1.65;color:#3b4657;">${esc(t)}</p>`
  ).join('');

  return `<!doctype html>
<html><body style="margin:0;padding:0;background:#eef1f5;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef1f5;padding:28px 12px;">
<tr><td align="center">
  <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;font-family:Arial,Helvetica,sans-serif;">
    <tr><td style="background:${accent};border-radius:14px 14px 0 0;padding:26px 32px;">
      <div style="font-size:12px;letter-spacing:0.14em;text-transform:uppercase;color:${ink};opacity:0.75;">${esc(biz)}</div>
      <div style="font-size:22px;font-weight:bold;color:${ink};margin-top:6px;line-height:1.3;">${esc(p.heading)}</div>
    </td></tr>
    <tr><td style="background:#ffffff;padding:28px 32px 24px;border-radius:0 0 14px 14px;">
      ${p.greeting ? `<p style="margin:0 0 14px;font-size:14.5px;line-height:1.65;color:#101828;font-weight:bold;">${esc(p.greeting)}</p>` : ''}
      ${paragraphs}
      ${detailCard}
      ${ctaBlock ? `<div style="text-align:center;">${ctaBlock}</div>` : ''}
      ${p.footNote ? `<p style="margin:16px 0 0;font-size:12.5px;line-height:1.6;color:#6b7686;">${esc(p.footNote)}</p>` : ''}
    </td></tr>
    <tr><td style="padding:18px 12px;text-align:center;">
      <div style="font-size:12px;color:#8a94a4;line-height:1.7;">
        ${esc(biz)}${address ? ` · ${esc(address)}` : ''}${phone ? ` · ${esc(phone)}` : ''}<br>
        Powered by Kairo
      </div>
    </td></tr>
  </table>
</td></tr>
</table>
</body></html>`;
}
