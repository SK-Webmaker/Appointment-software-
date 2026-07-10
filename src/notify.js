// Appointment confirmations & reminders.
//
// Messages are queued in the `messages` table and delivered by a background
// scheduler. Providers are plain HTTPS APIs (no SDKs, keeping zero deps):
//   email → Resend  (settings: resend_api_key, notif_from_email)
//   sms   → Twilio  (settings: twilio_sid, twilio_token, twilio_from)
// With no provider configured a message is marked `skipped` (never lost
// silently — the Messages page shows exactly what happened).
import { db, getSetting } from './db.js';

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

function buildCopy(kind, a) {
  const biz = getSetting('business_name', 'us');
  const when = `${fmtDate(a.date)} at ${fmtTime(a.start_min)}`;
  const what = a.service_name || 'your appointment';
  const who = a.staff_name ? ` with ${a.staff_name}` : '';
  if (kind === 'confirmation') {
    return {
      subject: `Booking confirmed — ${what} on ${fmtDate(a.date)}`,
      body: `Hi ${a.first_name || 'there'},\n\nYou're booked for ${what}${who} on ${when}.\n\nSee you soon!\n${biz}${getSetting('business_phone') ? ` · ${getSetting('business_phone')}` : ''}`,
    };
  }
  return {
    subject: `Reminder — ${what} ${fmtDate(a.date)}`,
    body: `Hi ${a.first_name || 'there'},\n\nA friendly reminder about ${what}${who} on ${when}.\n\nNeed to change it? Call us on ${getSetting('business_phone') || 'our usual number'}.\n\n${biz}`,
  };
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

  const channels = [];
  if (a.client_email) channels.push(['email', a.client_email]);
  if (a.client_phone) channels.push(['sms', a.client_phone]);
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
