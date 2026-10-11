// The messages the platform itself sends: a six-digit code to an inbox and the
// "your Kairo is ready" email. sendSms is kept and tested, but since 1.76.0
// nothing calls it: the signup asks for the email code alone.
//
// These are the only messages Kairo the *platform* ever sends. Everything a
// salon sends goes from the salon's own Resend and ClickSend accounts, from
// inside its own Kairo. This keeps that boundary visible: different file,
// different credentials, different bill.
import { SELLER, SELLER_COUNTRY } from './seller.js';
const RESEND_KEY = () => String(process.env.RESEND_API_KEY || '').trim();
const FROM = () => String(process.env.PLATFORM_FROM_EMAIL || '').trim();
const CS_USER = () => String(process.env.CLICKSEND_USERNAME || '').trim();
const CS_KEY = () => String(process.env.CLICKSEND_API_KEY || '').trim();
// The sender a code arrives from. UNSET means "Kairo", the alpha tag. SET BUT
// EMPTY means "use ClickSend's shared number", which is a real and deliberate
// choice, not an oversight: an alphanumeric sender ID in Australia needs a
// one-off ACMA registration, and that needs an ABN. Without one the tag is not
// ours to use.
//
// A plain `|| fallback` cannot express that — an empty string is falsy, so
// it silently became 'Kairo' again. Kairo then sent an unregistered tag and
// ClickSend quietly swapped in a number of its own. The right outcome by
// accident, resting on a provider behaviour nobody documented and nobody would
// notice changing.
const CS_FROM = () => (process.env.CLICKSEND_FROM === undefined ? 'Kairo' : String(process.env.CLICKSEND_FROM).trim());
// Same override the salon side uses (src/notify.js), so the platform's own
// sending can be pointed at a stand-in and actually tested. Until now it could
// not be, which is how "Send another" shipped claiming success without sending.
const RESEND_API = () => process.env.RESEND_API_BASE || 'https://api.resend.com';
const CLICKSEND_API = () => process.env.CLICKSEND_API_BASE || 'https://rest.clicksend.com/v3';

export async function sendEmail(to, subject, text, html = '') {
  if (!RESEND_KEY() || !FROM()) return { ok: false, skipped: true, detail: 'platform email not configured (RESEND_API_KEY, PLATFORM_FROM_EMAIL)' };
  try {
    const res = await fetch(`${RESEND_API()}/emails`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${RESEND_KEY()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: FROM(), to: [to], subject, text, ...(html ? { html } : {}) }),
      signal: AbortSignal.timeout(15000),
    });
    if (res.ok) return { ok: true, detail: 'sent' };
    return { ok: false, detail: `Resend ${res.status}: ${(await res.text().catch(() => '')).slice(0, 200)}` };
  } catch (err) {
    return { ok: false, detail: `Resend unreachable: ${String(err.message).slice(0, 120)}` };
  }
}

export async function sendSms(to, body) {
  if (!CS_USER() || !CS_KEY()) return { ok: false, skipped: true, detail: 'platform SMS not configured (CLICKSEND_USERNAME, CLICKSEND_API_KEY)' };
  try {
    const res = await fetch(`${CLICKSEND_API()}/sms/send`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${CS_USER()}:${CS_KEY()}`).toString('base64')}`,
        'Content-Type': 'application/json',
      },
      // Omitted entirely when empty, rather than sent blank: ClickSend then
      // picks a shared number, which is what a sender with no ABN should do.
      body: JSON.stringify({ messages: [{ to, body, ...(CS_FROM() ? { from: CS_FROM() } : {}) }] }),
      signal: AbortSignal.timeout(15000),
    });
    const data = await res.json().catch(() => ({}));
    // The envelope is not the answer. A ClickSend account with no credit replies
    // response_code: SUCCESS, response_msg: "Messages queued for delivery" — and
    // then sends nothing at all. Proven on 18 September against the live
    // account: the call reported success, this function returned ok, the signup
    // told the customer a code was on its way, and the account's own SMS history
    // stayed empty. Nobody could have completed a signup, and nothing anywhere
    // said so.
    //
    // The truth is per message. An empty list means nothing was queued, whatever
    // the envelope claims. A status that is present and not SUCCESS is a refusal.
    // A message with no status at all is allowed through, matching the shard's
    // check in src/notify.js, which got this right first.
    const msgs = data?.data?.messages;
    const queued = Array.isArray(msgs) && msgs.length > 0
      && msgs.every((m) => String(m?.status ?? 'SUCCESS').toUpperCase() === 'SUCCESS');
    if (res.ok && data?.response_code === 'SUCCESS' && queued) return { ok: true, detail: 'sent' };
    const why = Array.isArray(msgs) && msgs.length === 0
      ? 'accepted the request but queued no message (usually no credit)'
      : (msgs?.find?.((m) => String(m?.status ?? 'SUCCESS').toUpperCase() !== 'SUCCESS')?.status
         || data?.response_msg || `HTTP ${res.status}`);
    return { ok: false, detail: `ClickSend: ${why}` };
  } catch (err) {
    return { ok: false, detail: `ClickSend unreachable: ${String(err.message).slice(0, 120)}` };
  }
}

const shell = (heading, lines) => `<!doctype html><html><body style="margin:0;background:#f4f6fb;font-family:-apple-system,system-ui,sans-serif;padding:28px">
<div style="max-width:520px;margin:0 auto;background:#fff;border-radius:14px;padding:28px">
<div style="font-weight:700;font-size:19px;color:#0f172a;margin-bottom:14px">${heading}</div>
${lines.map((l) => `<p style="color:#334155;line-height:1.65;margin:0 0 12px">${l}</p>`).join('')}
<p style="color:#94a3b8;font-size:12px;margin-top:22px">Kairo — booking software for salons. One payment, no monthly fee.</p>
</div></body></html>`;

export const emailCode = (to, code) => sendEmail(to, `${code} is your Kairo code`,
  `Your Kairo verification code is ${code}.\n\nIt expires in 10 minutes. If you didn't ask for it, ignore this email.`,
  shell('Your verification code', [`Enter this code to carry on setting up Kairo:`,
    `<span style="font-size:30px;font-weight:700;letter-spacing:5px;color:#0f172a">${code}</span>`,
    'It expires in 10 minutes.']));

const escHtml = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Where an owner is sent for help. One address, the same on every page and
// email the platform sends, so "how do I reach Kairo" has one answer.
export const SUPPORT_EMAIL = () => String(process.env.PLATFORM_SUPPORT_EMAIL || 'support@kairobookings.com').trim();
export const GUIDE_URL = () => String(process.env.KAIRO_GUIDE_URL || 'https://kairobookings.com/guide').trim();
// Where the Kairo mark is served from for emails. The platform serves its own
// icons; an email needs an absolute address that will still work in a year.
const ASSETS = () => String(process.env.PLATFORM_ASSET_ORIGIN || 'https://start.kairobookings.com').replace(/\/+$/, '');

/** The Kairo mark and name, as the first row of every platform email. */
const markRow = () => `<table role="presentation" cellpadding="0" cellspacing="0"><tr>
      <td style="width:34px;height:34px;vertical-align:middle"><img src="${ASSETS()}/icons/kairo-180.png" width="34" height="34" alt="K" style="display:block;width:34px;height:34px;border-radius:9px;border:0;background:#3b82f6;color:#ffffff;font-weight:800;font-size:19px;text-align:center;line-height:34px"></td>
      <td style="padding-left:11px;color:#ffffff;font-weight:800;font-size:19px;letter-spacing:.06em">KAIRO</td>
    </tr></table>`;

/**
 * "Welcome to Kairo": the email a new owner gets the moment their Kairo is
 * built. It does three jobs and no more — welcome them as a person, hand them
 * everything they need to start (where to sign in, their booking link, the
 * app, the guide), and say plainly how to reach a human at Kairo.
 *
 * `sending` is what the shard reported when it built the salon: 'kairo' (the
 * platform's shared sender) or 'own' means confirmations already go out, so the
 * email says so rather than sending the owner off to "connect" something that
 * already works. Only 'none' asks them to wait for email to be set up. Texts
 * are always the owner's own ClickSend account, so that step is always named.
 *
 * Laid out in tables with inline styles, because that is what every mail
 * client — Outlook included — renders the same way.
 */
export const emailReady = (to, { businessName, url, appUrl, sending = 'kairo', ownerName = '' }) => {
  const first = String(ownerName || '').trim().split(/\s+/)[0] || '';
  const hi = first ? `Welcome to Kairo, ${first}.` : 'Welcome to Kairo.';
  const support = SUPPORT_EMAIL();
  const guide = GUIDE_URL();
  const book = `${url}/book`;
  const emailLine = sending === 'none'
    ? 'Confirmations and reminders start sending once your email is connected. We will be in touch to set that up with you.'
    : 'Booking confirmations, reminders and receipts already go out by email with your business name on them, and replies come straight to you.';
  const smsLine = 'Want text reminders too? In Kairo go to Settings → Messages → "Set up text messages". It takes about five minutes, a one-minute video shows every step, and you pay ClickSend directly for your texts.';
  const steps = [
    ['Sign in', `Open ${url} and sign in with the email and password you chose. A short setup walks you through your hours, services and team.`],
    ['Share your booking link', `Put ${book} in your Instagram bio and Google profile. Clients book themselves, any hour.`],
    ['Get the iPhone app', 'New bookings arrive as notifications, and your day is one tap away.'],
    ['Turn on texts (optional)', smsLine],
  ];

  const text = `${hi}\n\n`
    + `Thank you for choosing Kairo. ${businessName} is set up and ready: your own booking system, on your own address, paid for once.\n\n`
    + `Your Kairo: ${url}\nYour booking link: ${book}\nSign in with: ${to}\n\n`
    + `Your first fifteen minutes\n${steps.map(([h, d], i) => `${i + 1}. ${h}: ${d}`).join('\n')}\n\n`
    + `${emailLine}\n\n`
    + `The Kairo app for your iPhone: ${appUrl}\n`
    + `How to do everything, step by step: ${guide}\n\n`
    + `We're here to help\nEmail ${support} and a person at Kairo will reply, Monday to Friday, 9am to 5pm Melbourne time. Usually the same day.\n\n`
    + `Not what you needed? You have 14 days for a full refund, no reason needed: Account → Refund and delete my Kairo.\n\n`
    + `— The Kairo team\nkairobookings.com`;

  const e = escHtml;
  const a = (href, label) => `<a href="${e(href)}" style="color:#2563eb;text-decoration:none;font-weight:600">${e(label)}</a>`;
  const row = (label, value) => `<tr><td style="padding:6px 0;color:#64748b;font-size:13px;width:130px;vertical-align:top">${label}</td><td style="padding:6px 0;color:#0f172a;font-size:14px;word-break:break-all">${value}</td></tr>`;
  const html = `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"></head>
<body style="margin:0;padding:0;background:#eef2f8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
<span style="display:none;max-height:0;overflow:hidden">${e(businessName)} is ready. Here is everything you need to start, and how to reach us.</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef2f8;padding:28px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:580px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0">
  <tr><td style="background:linear-gradient(135deg,#0b1220,#15233f);background-color:#0f1a30;padding:26px 32px">
    ${markRow()}
    <div style="color:#ffffff;font-size:26px;font-weight:700;line-height:1.25;margin-top:22px">${e(hi)}</div>
    <div style="color:#b6c3dc;font-size:15px;line-height:1.6;margin-top:8px">${e(businessName)} is set up and ready.</div>
  </td></tr>
  <tr><td style="padding:28px 32px 6px">
    <p style="margin:0 0 16px;color:#334155;font-size:15px;line-height:1.65">Thank you for choosing Kairo. You now have your own booking system, on your own address, paid for once — no monthly fee, no commission.</p>
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:6px 0 22px"><tr><td style="background:#2563eb;border-radius:10px">
      <a href="${e(url)}" style="display:inline-block;padding:13px 24px;color:#ffffff;font-weight:700;font-size:15px;text-decoration:none">Open ${e(businessName)}</a>
    </td></tr></table>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:10px 16px">
      ${row('Your Kairo', a(url, url))}
      ${row('Booking link', a(book, book))}
      ${row('Sign in with', e(to))}
    </table>
  </td></tr>
  <tr><td style="padding:24px 32px 4px">
    <div style="color:#0f172a;font-weight:700;font-size:16px;margin-bottom:12px">Your first fifteen minutes</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      ${steps.map(([h, d], i) => `<tr><td style="width:30px;vertical-align:top;padding:0 0 14px"><div style="width:24px;height:24px;border-radius:12px;background:#dbeafe;color:#1d4ed8;font-weight:700;font-size:13px;text-align:center;line-height:24px">${i + 1}</div></td>
        <td style="vertical-align:top;padding:2px 0 14px 8px"><div style="color:#0f172a;font-weight:600;font-size:14px">${e(h)}</div><div style="color:#475569;font-size:13.5px;line-height:1.55;margin-top:2px">${e(d)}</div></td></tr>`).join('')}
    </table>
    <p style="margin:2px 0 0;color:#475569;font-size:13.5px;line-height:1.6">${e(emailLine)}</p>
    <p style="margin:14px 0 0;font-size:14px">${a(appUrl, 'Get the Kairo iPhone app')} &nbsp;·&nbsp; ${a(guide, 'Read the Kairo guide')}</p>
  </td></tr>
  <tr><td style="padding:24px 32px 28px">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eff6ff;border-radius:12px"><tr><td style="padding:18px 20px">
      <div style="color:#0f172a;font-weight:700;font-size:15px">We're here to help</div>
      <div style="color:#334155;font-size:14px;line-height:1.6;margin-top:6px">Email ${a(`mailto:${support}`, support)} and a person at Kairo will reply — Monday to Friday, 9am to 5pm Melbourne time, usually the same day.</div>
    </td></tr></table>
    <p style="margin:18px 0 0;color:#64748b;font-size:12.5px;line-height:1.6">Not what you needed? You have 14 days for a full refund, no reason needed: Account → Refund and delete my Kairo.</p>
    <p style="margin:18px 0 0;color:#0f172a;font-size:14px">— The Kairo team</p>
  </td></tr>
</table>
<div style="color:#94a3b8;font-size:12px;line-height:1.6;margin-top:16px">Kairo · booking software for salons and studios · <a href="https://kairobookings.com" style="color:#94a3b8">kairobookings.com</a><br>You're receiving this because you bought Kairo for ${e(businessName)}.</div>
</td></tr></table></body></html>`;

  return sendEmail(to, `Welcome to Kairo — ${businessName} is ready`, text, html);
};

// ── The receipt for Kairo itself ──────────────────────────────────────────
//
// An owner who has just paid A$410 wants a receipt they can hand their
// accountant: who sold it, what it was, when, how much, how it was paid, and
// the number to quote. It comes from Kairo, looks like Kairo, and is separate
// from the welcome email so it can be filed on its own.
//
// Who sold it comes from platform/seller.js, the same line the Terms read, so
// the receipt and the contract can never name different people. The rest is
// configuration: PLATFORM_ABN adds the ABN, PLATFORM_GST=1 says the price
// includes GST (and so titles it a tax invoice and shows the GST in it).
// Neither set, it is a plain receipt.

const BRANDS = { visa: 'Visa', mastercard: 'Mastercard', amex: 'American Express', discover: 'Discover', jcb: 'JCB', diners: 'Diners Club', unionpay: 'UnionPay', eftpos_au: 'eftpos' };

export function receiptFacts({ amountCents, card = {} }) {
  const abn = String(process.env.PLATFORM_ABN || '').trim();
  const gst = String(process.env.PLATFORM_GST || '') === '1';
  const brand = BRANDS[String(card.brand || '').toLowerCase()] || (card.brand ? card.brand[0].toUpperCase() + card.brand.slice(1) : 'Card');
  const cardLabel = card.last4 ? `${card.wallet ? `${card.wallet} · ` : ''}${brand} ending ${card.last4}` : (card.wallet || 'Card');
  return {
    title: abn && gst ? 'Tax invoice' : 'Receipt',
    gstCents: gst ? Math.round(amountCents / 11) : 0,
    seller: [`Kairo, sold by ${SELLER}, ${SELLER_COUNTRY}`, abn ? `ABN ${abn}` : ''].filter(Boolean).join(' · '),
    cardLabel,
  };
}

export const emailReceipt = (to, { receiptNo, ownerName = '', businessName, amountCents, paidAt = new Date(), card = {}, receiptUrl = '' }) => {
  const e = escHtml;
  const f = receiptFacts({ amountCents, card });
  const aud = (c) => `A$${(c / 100).toFixed(2)}`;
  const date = paidAt.toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Australia/Melbourne' });
  const first = String(ownerName || '').trim().split(/\s+/)[0] || '';
  const support = SUPPORT_EMAIL();
  const item = `Kairo — booking software for ${businessName}`;
  const text = `${f.title} ${receiptNo}\n\n${first ? `Hi ${first}, thank you` : 'Thank you'} for buying Kairo.\n\n`
    + `Date: ${date}\nBilled to: ${ownerName ? `${ownerName}, ` : ''}${businessName} (${to})\nFrom: ${f.seller}\n\n`
    + `${item} — one payment, no monthly fee: ${aud(amountCents)}\n`
    + `${f.gstCents ? `Includes GST: ${aud(f.gstCents)}\n` : ''}Total paid: ${aud(amountCents)} (${f.cardLabel})\n\n`
    + `Not what you needed? You have 14 days for a full refund: in Kairo, Account → Refund and delete my Kairo.\n`
    + `${receiptUrl ? `Stripe's copy of this payment: ${receiptUrl}\n` : ''}Questions: ${support}\n\n— The Kairo team\nkairobookings.com`;
  const meta = (k, v) => `<tr><td style="padding:4px 0;color:#64748b;font-size:13px">${k}</td><td style="padding:4px 0;color:#0f172a;font-size:13px;text-align:right">${v}</td></tr>`;
  const html = `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"></head>
<body style="margin:0;padding:0;background:#eef2f8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
<span style="display:none;max-height:0;overflow:hidden">${e(f.title)} ${e(receiptNo)} · ${e(aud(amountCents))} paid for Kairo.</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef2f8;padding:28px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:580px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0">
  <tr><td style="background:linear-gradient(135deg,#0b1220,#15233f);background-color:#0f1a30;padding:26px 32px">
    ${markRow()}
    <div style="color:#ffffff;font-size:24px;font-weight:700;line-height:1.25;margin-top:22px">Thank you for buying Kairo${first ? `, ${e(first)}` : ''}</div>
    <div style="color:#b6c3dc;font-size:15px;line-height:1.6;margin-top:6px">Your receipt, for your records.</div>
  </td></tr>
  <tr><td style="padding:28px 32px 8px">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e2e8f0;border-radius:12px;border-collapse:separate">
      <tr><td style="padding:18px 20px 6px">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
          <td style="font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:#0f172a;font-weight:700">${e(f.title)} <span style="display:inline-block;margin-left:8px;padding:2px 8px;border-radius:99px;background:#ecfdf3;color:#067647;font-size:10.5px;letter-spacing:.1em">Paid</span></td>
          <td style="font-size:12.5px;color:#64748b;text-align:right">${e(receiptNo)}</td>
        </tr></table>
      </td></tr>
      <tr><td style="padding:4px 20px 10px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        ${meta('Date', e(date))}
        ${meta('Billed to', `${ownerName ? `${e(ownerName)}<br>` : ''}${e(businessName)}<br>${e(to)}`)}
        ${meta('From', e(f.seller))}
      </table></td></tr>
      <tr><td style="padding:0 20px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        <tr><td style="padding:12px 0;border-top:1px solid #edf0f4;vertical-align:top"><div style="font-size:14px;color:#0f172a;font-weight:700">${e(item)}</div><div style="font-size:12.5px;color:#64748b;margin-top:2px">One payment · no monthly fee, no commission</div></td>
          <td style="padding:12px 0;border-top:1px solid #edf0f4;vertical-align:top;text-align:right;font-size:14px;color:#0f172a;white-space:nowrap">${e(aud(amountCents))}</td></tr>
      </table></td></tr>
      <tr><td style="padding:6px 20px 14px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        ${f.gstCents ? `<tr><td style="padding:3px 0;font-size:13px;color:#475569">Includes GST</td><td style="padding:3px 0;font-size:13px;color:#0f172a;text-align:right">${e(aud(f.gstCents))}</td></tr>` : ''}
        <tr><td style="padding:10px 0 2px;font-size:15px;font-weight:700;color:#0f172a;border-top:2px solid #0f172a">Total</td><td style="padding:10px 0 2px;font-size:15px;font-weight:700;color:#0f172a;text-align:right;border-top:2px solid #0f172a">${e(aud(amountCents))}</td></tr>
      </table></td></tr>
      <tr><td style="background:#f6f8fa;border-radius:0 0 12px 12px;padding:12px 20px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        <tr><td style="padding:4px 0;font-size:13px;color:#475569">Paid · ${e(f.cardLabel)}</td><td style="padding:4px 0;font-size:13px;font-weight:700;color:#0f172a;text-align:right">${e(aud(amountCents))}</td></tr>
        <tr><td style="padding:4px 0;font-size:13px;color:#475569">Balance</td><td style="padding:4px 0;font-size:13px;font-weight:700;color:#067647;text-align:right">Paid in full</td></tr>
      </table></td></tr>
    </table>
  </td></tr>
  <tr><td style="padding:14px 32px 28px">
    <p style="margin:0 0 10px;color:#475569;font-size:13.5px;line-height:1.6">Not what you needed? You have <b>14 days</b> for a full refund, no reason needed: in Kairo, Account → Refund and delete my Kairo.</p>
    ${receiptUrl ? `<p style="margin:0 0 10px;color:#475569;font-size:13.5px;line-height:1.6"><a href="${e(receiptUrl)}" style="color:#2563eb;text-decoration:none;font-weight:600">Stripe's copy of this payment</a></p>` : ''}
    <p style="margin:0;color:#475569;font-size:13.5px;line-height:1.6">Questions about this receipt? Email <a href="mailto:${e(support)}" style="color:#2563eb;text-decoration:none;font-weight:600">${e(support)}</a>.</p>
  </td></tr>
</table>
<div style="color:#94a3b8;font-size:12px;line-height:1.6;margin-top:16px">Kairo · booking software for salons and studios · <a href="https://kairobookings.com" style="color:#94a3b8">kairobookings.com</a></div>
</td></tr></table></body></html>`;
  return sendEmail(to, `${f.title} ${receiptNo} — Kairo for ${businessName}`, text, html);
};
