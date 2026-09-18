// The two messages the platform itself sends: a six-digit code to an inbox and
// one to a handset, plus the "your Kairo is ready" email.
//
// These are the only messages Kairo the *platform* ever sends. Everything a
// salon sends goes from the salon's own Resend and ClickSend accounts, from
// inside its own Kairo. This keeps that boundary visible: different file,
// different credentials, different bill.
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
// `process.env.X || default` cannot express that — an empty string is falsy, so
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

export const smsCode = (to, code) => sendSms(to, `${code} is your Kairo verification code. It expires in 10 minutes.`);

export const emailReady = (to, { businessName, url, appUrl }) => sendEmail(to,
  `${businessName} is ready on Kairo`,
  `Your Kairo is live at ${url}\n\nSign in with the email and password you chose.\n\n`
  + `Two minutes of setup left: connect your email so confirmations and reminders send, and put your booking link `
  + `(${url}/book) in your Instagram bio.\n\nThe app: ${appUrl}`,
  shell(`${businessName} is ready`, [
    `Your Kairo is live at <a href="${url}" style="color:#2563eb">${url}</a> — sign in with the email and password you chose.`,
    `Your booking link, for your Instagram bio: <a href="${url}/book" style="color:#2563eb">${url}/book</a>`,
    'Confirmations and reminders start sending once your email is connected. It takes about two minutes and Kairo walks you through it.',
  ]));
