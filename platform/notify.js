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
const CS_FROM = () => String(process.env.CLICKSEND_FROM || 'Kairo').trim();

export async function sendEmail(to, subject, text, html = '') {
  if (!RESEND_KEY() || !FROM()) return { ok: false, skipped: true, detail: 'platform email not configured (RESEND_API_KEY, PLATFORM_FROM_EMAIL)' };
  try {
    const res = await fetch('https://api.resend.com/emails', {
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
    const res = await fetch('https://rest.clicksend.com/v3/sms/send', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${CS_USER()}:${CS_KEY()}`).toString('base64')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ messages: [{ to, body, from: CS_FROM() }] }),
      signal: AbortSignal.timeout(15000),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data?.response_code === 'SUCCESS') return { ok: true, detail: 'sent' };
    return { ok: false, detail: `ClickSend: ${data?.response_msg || res.status}` };
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
