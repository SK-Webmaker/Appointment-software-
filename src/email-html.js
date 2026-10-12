// Branded HTML email rendering — email-client-safe (tables, inline styles,
// no flexbox, no external assets). The header band takes the business's brand
// colour; text contrast on it is computed from luminance, so any accent works.
//
// One layout serves every message kind: heading, greeting, body paragraphs, an
// optional detail card (label/value rows), an optional big CTA button, footer.
import { getSetting, publicUrl } from './db.js';
import { formatAbn } from './invoice-math.js';

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
 * @param {object} [p.receipt]    an itemised receipt (see receiptBlock)
 */
export function renderEmail(p) {
  const biz = getSetting('business_name', 'Your booking');
  const accent = /^#[0-9a-fA-F]{6}$/.test(getSetting('brand_accent', '')) ? getSetting('brand_accent') : '#2563eb';
  const ink = accentInk(accent);
  const phone = getSetting('business_phone', '');
  const address = getSetting('business_address', '');
  const abn = formatAbn(getSetting('business_abn', ''));

  // The business's own logo, served over HTTP. It is stored as a data: URI,
  // which Gmail and Outlook strip from <img> — so it only goes in when the
  // instance has a public address to serve it from, and the name stands in
  // otherwise. Sits on its own light strip so a logo with its own background
  // never clashes with the brand colour below it.
  const origin = publicUrl();
  const hasLogo = /^data:image\//i.test(getSetting('brand_logo', '') || '');
  const logoBand = (hasLogo && origin) ? `
    <tr><td align="center" style="background:#ffffff;border-radius:14px 14px 0 0;padding:22px 32px 18px;border-bottom:1px solid #e6eaf0;">
      <img src="${esc(origin)}/api/public/logo" alt="${esc(biz)}" height="44"
           style="display:block;max-height:44px;max-width:190px;width:auto;border:0;outline:none;text-decoration:none;">
    </td></tr>` : '';

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

  const receipt = p.receipt ? receiptBlock(p.receipt) : '';

  // A one-time code, large and spaced, so it can be typed without a second look.
  const codeBlock = p.code ? `
    <div style="margin:20px 0 6px;text-align:center;">
      <div style="display:inline-block;padding:14px 22px 14px 30px;border-radius:12px;background:#f5f7fa;border:1px solid #e6eaf0;font-family:Menlo,Consolas,'Courier New',monospace;font-size:32px;font-weight:bold;letter-spacing:0.3em;color:#101828;">${esc(p.code)}</div>
    </div>` : '';

  const paragraphs = (p.paragraphs || []).map((t) =>
    `<p style="margin:0 0 14px;font-size:14.5px;line-height:1.65;color:#3b4657;">${esc(t)}</p>`
  ).join('');

  return `<!doctype html>
<html><body style="margin:0;padding:0;background:#eef1f5;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef1f5;padding:28px 12px;">
<tr><td align="center">
  <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;font-family:Arial,Helvetica,sans-serif;">
    ${logoBand}
    <tr><td style="background:${accent};${logoBand ? '' : 'border-radius:14px 14px 0 0;'}padding:24px 32px;">
      ${logoBand ? '' : `<div style="font-size:12px;letter-spacing:0.14em;text-transform:uppercase;color:${ink};opacity:0.75;">${esc(biz)}</div>`}
      <div style="font-size:21px;font-weight:bold;color:${ink};${logoBand ? '' : 'margin-top:6px;'}line-height:1.3;">${esc(p.heading)}</div>
    </td></tr>
    <tr><td style="background:#ffffff;padding:28px 32px 24px;border-radius:0 0 14px 14px;">
      ${p.greeting ? `<p style="margin:0 0 14px;font-size:14.5px;line-height:1.65;color:#101828;font-weight:bold;">${esc(p.greeting)}</p>` : ''}
      ${paragraphs}
      ${codeBlock}
      ${receipt}
      ${detailCard}
      ${ctaBlock ? `<div style="text-align:center;">${ctaBlock}</div>` : ''}
      ${p.footNote ? `<p style="margin:16px 0 0;font-size:12.5px;line-height:1.6;color:#6b7686;">${esc(p.footNote)}</p>` : ''}
    </td></tr>
    <tr><td style="padding:18px 12px;text-align:center;">
      <div style="font-size:12px;color:#8a94a4;line-height:1.7;">
        ${esc(biz)}${address ? ` · ${esc(address)}` : ''}${phone ? ` · ${esc(phone)}` : ''}${abn ? `<br>ABN ${esc(abn)}` : ''}<br>
        Powered by Kairo${p.unsubscribeUrl ? `<br>
        <a href="${esc(p.unsubscribeUrl)}" style="color:#8a94a4;text-decoration:underline;">Stop receiving offers like this</a>` : ''}
      </div>
    </td></tr>
  </table>
</td></tr>
</table>
</body></html>`;
}

/**
 * An itemised receipt, laid out like a printed one: what it is and its number,
 * who it is for, each line with its price, the totals, and what was paid.
 * Tables and inline styles only, so it reads the same in Gmail, Outlook and
 * Apple Mail.
 *
 * @param {object} r
 * @param {string} r.title            "Receipt", "Tax invoice", "Deposit receipt"
 * @param {string} [r.number]         "INV-0042"
 * @param {boolean} [r.paid]          shows a PAID mark beside the title
 * @param {Array<[string,string]>} [r.meta]   small label/value rows: date, billed to
 * @param {Array<{label:string, sub?:string, qty?:number, amount:string}>} r.lines
 * @param {Array<[string,string,('strong'|'')?]>} [r.totals]
 * @param {Array<[string,string,('good'|'due'|'')?]>} [r.payments]
 */
export function receiptBlock(r) {
  const cell = 'font-family:Arial,Helvetica,sans-serif;';
  const meta = (r.meta || []).filter(([, v]) => v).map(([k, v]) => `
      <tr><td style="${cell}padding:3px 0;font-size:12.5px;color:#6b7686;">${esc(k)}</td>
          <td style="${cell}padding:3px 0;font-size:12.5px;color:#101828;text-align:right;">${esc(v)}</td></tr>`).join('');
  const lines = (r.lines || []).map((l) => `
      <tr>
        <td style="${cell}padding:11px 0;border-top:1px solid #edf0f4;vertical-align:top;">
          <div style="font-size:14px;color:#101828;font-weight:bold;">${esc(l.label)}</div>
          ${l.sub ? `<div style="font-size:12.5px;color:#6b7686;margin-top:2px;">${esc(l.sub)}</div>` : ''}
        </td>
        <td style="${cell}padding:11px 0;border-top:1px solid #edf0f4;vertical-align:top;text-align:right;font-size:14px;color:#101828;white-space:nowrap;">${esc(l.amount)}</td>
      </tr>`).join('');
  const spacer = '<tr><td colspan="2" style="height:6px;line-height:6px;font-size:0;">&nbsp;</td></tr>';
  const totals = (r.totals || []).map(([k, v, tone], i) => `${tone === 'strong' && i > 0 ? spacer : ''}
      <tr><td style="${cell}padding:${tone === 'strong' ? '10px 0 4px' : '3px 0'};font-size:${tone === 'strong' ? '15px' : '13px'};color:${tone === 'strong' ? '#101828' : '#4a5566'};${tone === 'strong' ? 'font-weight:bold;border-top:2px solid #101828;' : ''}">${esc(k)}</td>
          <td style="${cell}padding:${tone === 'strong' ? '10px 0 4px' : '3px 0'};font-size:${tone === 'strong' ? '15px' : '13px'};color:#101828;text-align:right;white-space:nowrap;${tone === 'strong' ? 'font-weight:bold;border-top:2px solid #101828;' : ''}">${esc(v)}</td></tr>`).join('');
  const payments = (r.payments || []).map(([k, v, tone]) => `
      <tr><td style="${cell}padding:4px 0;font-size:13px;color:#4a5566;">${esc(k)}</td>
          <td style="${cell}padding:4px 0;font-size:13px;text-align:right;white-space:nowrap;font-weight:bold;color:${tone === 'good' ? '#067647' : tone === 'due' ? '#b54708' : '#101828'};">${esc(v)}</td></tr>`).join('');
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e3e8ef;border-radius:12px;margin:20px 0;border-collapse:separate;">
      <tr><td style="padding:18px 20px 4px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
          <td style="${cell}font-size:12px;letter-spacing:0.14em;text-transform:uppercase;color:#101828;font-weight:bold;">${esc(r.title)}${r.paid ? ' <span style="display:inline-block;margin-left:8px;padding:2px 8px;border-radius:99px;background:#ecfdf3;color:#067647;font-size:10.5px;letter-spacing:0.1em;vertical-align:1px;">Paid</span>' : ''}</td>
          <td style="${cell}font-size:12.5px;color:#6b7686;text-align:right;">${esc(r.number || '')}</td>
        </tr></table>
      </td></tr>
      ${meta ? `<tr><td style="padding:6px 20px 8px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${meta}</table></td></tr>` : ''}
      <tr><td style="padding:2px 20px 4px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${lines}</table></td></tr>
      ${totals ? `<tr><td style="padding:${(r.totals || []).length > 1 ? '6px' : '0'} 20px 14px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="${(r.totals || []).length > 1 ? 'border-top:1px solid #edf0f4;' : ''}padding-top:6px;">${totals}</table></td></tr>` : ''}
      ${payments ? `<tr><td style="background:#f6f8fa;border-radius:0 0 12px 12px;padding:12px 20px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${payments}</table></td></tr>` : ''}
    </table>`;
}
