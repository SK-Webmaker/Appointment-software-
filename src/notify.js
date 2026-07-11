// Appointment confirmations, reminders, payment receipts & review requests.
//
// Messages are queued in the `messages` table and delivered by a background
// scheduler. Providers are plain HTTPS APIs (no SDKs, keeping zero deps):
//   email → Resend  (settings: resend_api_key, notif_from_email)
//   sms   → Twilio  (settings: twilio_sid, twilio_token, twilio_from)
// With no provider configured a message is marked `skipped` (never lost
// silently — the Messages page shows exactly what happened).
//
// SMS costs real money (per-message + a one-time carrier registration), so
// it is gated behind `sms_notifications_enabled` (default off) in addition
// to having Twilio credentials configured — a business opts in deliberately.
import crypto from 'node:crypto';
import { db, getSetting } from './db.js';

function money(cents) {
  const currency = getSetting('currency', '$') || '$';
  return `${currency}${((Number(cents) || 0) / 100).toFixed(2)}`;
}

const fmtTime = (min) => {
  let h = Math.floor(min / 60), m = min % 60;
  const ap = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${String(m).padStart(2, '0')} ${ap}`;
};
const fmtDate = (s) => new Date(`${s}T12:00:00`).toLocaleDateString('en-US', {
  weekday: 'long', month: 'long', day: 'numeric',
});

/** Local timestamp 'YYYY-MM-DD HH:MM' (string compare == time compare). */
function localStamp(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

function apptContext(apptId) {
  return db.prepare(
    `SELECT a.*, c.first_name, c.email AS client_email, c.phone AS client_phone,
            s.name AS staff_name, sv.name AS service_name
     FROM appointments a
     LEFT JOIN clients c ON c.id = a.client_id
     LEFT JOIN staff s ON s.id = a.staff_id
     LEFT JOIN services sv ON sv.id = a.service_id
     WHERE a.id = ?`
  ).get(apptId);
}

/** Channels a client can be reached on, gated by whether SMS is opted in. */
function clientChannels(email, phone) {
  const channels = [];
  if (email) channels.push(['email', email]);
  if (phone && getSetting('sms_notifications_enabled', '0') === '1') channels.push(['sms', phone]);
  return channels;
}

function buildCopy(kind, a, extra = {}) {
  const biz = getSetting('business_name', 'us');
  const phoneLine = getSetting('business_phone') ? ` · ${getSetting('business_phone')}` : '';
  const when = `${fmtDate(a.date)} at ${fmtTime(a.start_min)}`;
  const what = a.service_name || 'your appointment';
  const who = a.staff_name ? ` with ${a.staff_name}` : '';
  const name = a.first_name || 'there';

  if (kind === 'confirmation') {
    return {
      subject: `Booking confirmed — ${what} on ${fmtDate(a.date)}`,
      body: `Hi ${name},\n\nYou're booked for ${what}${who} on ${when}.\n\nSee you soon!\n${biz}${phoneLine}`,
    };
  }
  if (kind === 'reminder') {
    return {
      subject: `Reminder — ${what} ${fmtDate(a.date)}`,
      body: `Hi ${name},\n\nA friendly reminder about ${what}${who} on ${when}.\n\nNeed to change it? Call us on ${getSetting('business_phone') || 'our usual number'}.\n\n${biz}`,
    };
  }
  if (kind === 'receipt') {
    if (extra.isDeposit) {
      return {
        subject: `Deposit received — ${money(extra.amountCents)} · ${biz}`,
        body: `Hi ${name},\n\nWe've received your ${money(extra.amountCents)} deposit for ${what}${who} on ${when}. It comes off your total when you visit.\n\nSee you soon!\n${biz}${phoneLine}`,
      };
    }
    const balanceLine = extra.balanceCents > 0
      ? `\nRemaining balance: ${money(extra.balanceCents)}`
      : '\nPaid in full — thank you!';
    return {
      subject: `Receipt — ${money(extra.amountCents)} · ${a.invoiceNumber || biz}`,
      body: `Hi ${name},\n\nThis confirms your payment of ${money(extra.amountCents)} (${extra.method}) for ${what}${who}.${balanceLine}\n\n${biz}${phoneLine}`,
    };
  }
  if (kind === 'review_request') {
    return {
      subject: `How was your visit to ${biz}?`,
      body: `Hi ${name},\n\nThanks for visiting ${biz} for ${what}${who}. We'd love to hear how it went — it takes 30 seconds:\n${extra.reviewUrl}\n\n${biz}`,
    };
  }
  return { subject: '', body: '' };
}

const insMessage = () => db.prepare(
  `INSERT INTO messages (appointment_id, client_id, channel, kind, to_addr, subject, body, status, send_after)
   VALUES (?, ?, ?, ?, ?, ?, ?, 'queued', ?)`
);

/**
 * Queue confirmation (sent immediately) and reminder (sent N hours before
 * start) for an appointment, on every channel the client can receive.
 */
export function queueAppointmentMessages(apptId, { confirmation = true, reminder = true } = {}) {
  const a = apptContext(apptId);
  if (!a || !a.client_id) return;
  if (!['booked', 'confirmed'].includes(a.status)) return;

  const channels = clientChannels(a.client_email, a.client_phone);
  if (!channels.length) return;

  const now = localStamp();
  const ins = insMessage();

  if (confirmation && getSetting('confirm_enabled', '1') === '1') {
    const copy = buildCopy('confirmation', a);
    for (const [channel, to] of channels) {
      ins.run(a.id, a.client_id, channel, 'confirmation', to, copy.subject, copy.body, now);
    }
  }

  if (reminder && getSetting('reminders_enabled', '1') === '1') {
    const hours = Number(getSetting('reminder_hours', '24')) || 24;
    const start = new Date(`${a.date}T00:00:00`);
    start.setMinutes(a.start_min - hours * 60);
    const sendAfter = localStamp(start);
    if (sendAfter > now) { // don't remind about appointments that are (nearly) now
      const copy = buildCopy('reminder', a);
      for (const [channel, to] of channels) {
        ins.run(a.id, a.client_id, channel, 'reminder', to, copy.subject, copy.body, sendAfter);
      }
    }
  }
}

/**
 * Queue a payment receipt (sent immediately) for whichever appointment an
 * invoice is linked to. amountCents is the amount of THIS payment;
 * balanceCents is what (if anything) remains owed after it.
 */
export function queueReceiptMessage(invoiceId, { amountCents, method, balanceCents }) {
  if (getSetting('receipts_enabled', '1') !== '1') return;
  const inv = db.prepare(
    `SELECT i.number, i.appointment_id, i.client_id,
            c.first_name, c.email AS client_email, c.phone AS client_phone
     FROM invoices i LEFT JOIN clients c ON c.id = i.client_id
     WHERE i.id = ?`
  ).get(invoiceId);
  if (!inv || !inv.client_id) return;

  // Reuse appointment context for service/staff naming when there is one;
  // walk-in / non-appointment invoices still get a receipt with less detail.
  const a = inv.appointment_id ? apptContext(inv.appointment_id) : null;
  const ctx = a || { first_name: inv.first_name, client_email: inv.client_email, client_phone: inv.client_phone, date: '', start_min: 0 };

  const channels = clientChannels(inv.client_email || ctx.client_email, inv.client_phone || ctx.client_phone);
  if (!channels.length) return;

  const copy = buildCopy('receipt', ctx, { amountCents, method, balanceCents, invoiceNumber: inv.number });
  const now = localStamp();
  const ins = insMessage();
  for (const [channel, to] of channels) {
    ins.run(inv.appointment_id || null, inv.client_id, channel, 'receipt', to, copy.subject, copy.body, now);
  }
}

/** Queue a receipt for an online deposit (no invoice exists yet at booking time). */
export function queueDepositReceipt(apptId, amountCents) {
  if (getSetting('receipts_enabled', '1') !== '1') return;
  const a = apptContext(apptId);
  if (!a || !a.client_id) return;
  const channels = clientChannels(a.client_email, a.client_phone);
  if (!channels.length) return;

  const copy = buildCopy('receipt', a, { amountCents, isDeposit: true });
  const now = localStamp();
  const ins = insMessage();
  for (const [channel, to] of channels) {
    ins.run(a.id, a.client_id, channel, 'receipt', to, copy.subject, copy.body, now);
  }
}

/**
 * Queue a review request for a just-completed appointment, sent
 * `review_delay_hours` after the visit (default 1h — not the instant they
 * stand up, but same-day while it's fresh). Generates a one-time review link
 * token if the appointment doesn't already have one.
 */
export function queueReviewRequest(apptId) {
  if (getSetting('review_requests_enabled', '1') !== '1') return;
  const a = apptContext(apptId);
  if (!a || !a.client_id || a.status !== 'completed') return;
  if (db.prepare('SELECT 1 FROM reviews WHERE appointment_id = ?').get(apptId)) return; // already reviewed

  const channels = clientChannels(a.client_email, a.client_phone);
  if (!channels.length) return;

  let token = a.review_token;
  if (!token) {
    token = crypto.randomBytes(16).toString('hex');
    db.prepare('UPDATE appointments SET review_token = ? WHERE id = ?').run(token, apptId);
  }
  const origin = getSetting('public_url') || '';
  const reviewUrl = origin ? `${origin}/review/${token}` : `/review/${token}`;

  const delayHours = Number(getSetting('review_delay_hours', '1')) || 0;
  const sendAfter = localStamp(new Date(Date.now() + delayHours * 60 * 60 * 1000));

  const copy = buildCopy('review_request', a, { reviewUrl });
  const ins = insMessage();
  for (const [channel, to] of channels) {
    ins.run(a.id, a.client_id, channel, 'review_request', to, copy.subject, copy.body, sendAfter);
  }
}

/** Drop queued messages for an appointment (cancelled / rescheduled). */
export function cancelQueuedMessages(apptId) {
  db.prepare(
    "UPDATE messages SET status = 'skipped', detail = 'Appointment changed or cancelled' WHERE appointment_id = ? AND status = 'queued'"
  ).run(apptId);
}

/** Re-queue reminders after a reschedule. */
export function requeueAppointmentMessages(apptId) {
  cancelQueuedMessages(apptId);
  queueAppointmentMessages(apptId, { confirmation: false, reminder: true });
}

// ---------------------------------------------------------------------------
// Delivery
// ---------------------------------------------------------------------------

async function sendEmail(to, subject, body) {
  const key = getSetting('resend_api_key');
  const from = getSetting('notif_from_email');
  if (!key || !from) return { ok: false, skipped: true, detail: 'Email not configured (add a Resend API key + from address in Settings → Notifications)' };
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: `${getSetting('business_name', 'Bookings')} <${from}>`,
      to: [to],
      subject,
      text: body,
    }),
  });
  if (res.ok) return { ok: true, detail: 'Delivered via Resend' };
  const err = await res.text().catch(() => '');
  return { ok: false, detail: `Resend ${res.status}: ${err.slice(0, 300)}` };
}

async function sendSms(to, body) {
  const sid = getSetting('twilio_sid');
  const token = getSetting('twilio_token');
  const from = getSetting('twilio_from');
  if (!sid || !token || !from) return { ok: false, skipped: true, detail: 'SMS not configured (add Twilio credentials in Settings → Notifications)' };
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ To: to, From: from, Body: body }),
  });
  if (res.ok) return { ok: true, detail: 'Delivered via Twilio' };
  const err = await res.text().catch(() => '');
  return { ok: false, detail: `Twilio ${res.status}: ${err.slice(0, 300)}` };
}

export async function deliverMessage(msg) {
  let result;
  try {
    result = msg.channel === 'sms'
      ? await sendSms(msg.to_addr, msg.body)
      : await sendEmail(msg.to_addr, msg.subject, msg.body);
  } catch (err) {
    result = { ok: false, detail: `Network error: ${err.message}` };
  }
  const status = result.ok ? 'sent' : result.skipped ? 'skipped' : 'failed';
  db.prepare('UPDATE messages SET status = ?, detail = ?, sent_at = ? WHERE id = ?')
    .run(status, result.detail, result.ok ? localStamp() : '', msg.id);
  return { ...result, status };
}

/** Process everything due. Called by the scheduler and after queueing. */
export async function processQueue() {
  const due = db.prepare(
    "SELECT * FROM messages WHERE status = 'queued' AND send_after <= ? ORDER BY id LIMIT 25"
  ).all(localStamp());
  for (const msg of due) {
    await deliverMessage(msg);
  }
  return due.length;
}

let timer = null;
export function startScheduler() {
  if (timer) return;
  timer = setInterval(() => {
    processQueue().catch((err) => console.error('notify scheduler:', err.message));
  }, 60 * 1000);
  timer.unref?.();
  // deliver anything due at boot too
  processQueue().catch(() => {});
}
