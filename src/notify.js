// Appointment confirmations, reminders, payment receipts & review requests.
//
// Messages are queued in the `messages` table and delivered by a background
// scheduler. Providers are plain HTTPS APIs (no SDKs, keeping zero deps):
//   email → Resend  (settings: resend_api_key, notif_from_email)
//   sms   → chosen via `sms_provider`: clicksend | telnyx | twilio
//           clicksend → clicksend_username, clicksend_api_key, clicksend_from
//           telnyx    → telnyx_api_key, telnyx_from, telnyx_profile_id
//           twilio    → twilio_sid, twilio_token, twilio_from
// With no provider configured a message is marked `skipped` (never lost
// silently — the Messages page shows exactly what happened).
//
// SMS costs real money per message, so it is gated behind
// `sms_notifications_enabled` (default off) in addition to having a provider
// configured — a business opts in deliberately.
import crypto from 'node:crypto';
import { db, getSetting, setSetting, replyToAddress, publicUrl } from './db.js';
import { renderEmail } from './email-html.js';

function money(cents) {
  const currency = getSetting('currency', '$') || '$';
  return `${currency}${((Number(cents) || 0) / 100).toFixed(2)}`;
}

const METHOD_LABELS = { card: 'Card', square: 'Square', cash: 'Cash', transfer: 'Bank transfer', other: 'Other', stripe: 'Card' };
const methodLabel = (m) => METHOD_LABELS[m] || (m ? m.charAt(0).toUpperCase() + m.slice(1) : '');

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
  const a = db.prepare(
    `SELECT a.*, c.first_name, c.last_name AS client_last,
            c.email AS client_email, c.phone AS client_phone,
            s.name AS staff_name, sv.name AS service_name
     FROM appointments a
     LEFT JOIN clients c ON c.id = a.client_id
     LEFT JOIN staff s ON s.id = a.staff_id
     LEFT JOIN services sv ON sv.id = a.service_id
     WHERE a.id = ?`
  ).get(apptId);
  if (a) {
    // Combined label for multi-service bookings ("Colour + Blow Dry"); falls
    // back to the single primary service name.
    const names = db.prepare(
      `SELECT sv.name FROM appointment_services aps JOIN services sv ON sv.id = aps.service_id
       WHERE aps.appointment_id = ? ORDER BY aps.sort_order, aps.id`
    ).all(apptId).map((r) => r.name);
    if (names.length) a.service_name = names.join(' + ');
  }
  return a;
}

/**
 * Which channels a given message KIND should go out on, honouring the
 * per-type preference (Settings → Notifications: Email / SMS / Both) while
 * still gating SMS behind the master "Also send SMS" switch. If the preferred
 * channel isn't available (e.g. SMS chosen but the client has no phone, or SMS
 * is off), it falls back to whatever the client CAN receive so the message is
 * never silently dropped.
 */
function channelsFor(kind, email, phone, override = '') {
  // `override` is the owner picking a channel for this one message — "text her,
  // she never reads email" — which beats the standing setting for its kind.
  const saved = getSetting(`chan_${kind}`, 'email');
  const wanted = ['email', 'sms', 'both'].includes(override) ? override : saved;
  const pref = ['email', 'sms', 'both'].includes(wanted) ? wanted : 'email';
  const smsReady = Boolean(phone) && getSetting('sms_notifications_enabled', '0') === '1';
  const out = [];
  if (pref !== 'sms' && email) out.push(['email', email]);
  if (pref !== 'email' && smsReady) out.push(['sms', phone]);
  if (!out.length) { // preferred channel unavailable → fall back so it still sends
    if (email) out.push(['email', email]);
    else if (smsReady) out.push(['sms', phone]);
  }
  return out;
}

/** "12 hours" / "1 hour" / "2 days" — reads naturally in a sentence. */
function hoursLabel(h) {
  if (h >= 48 && h % 24 === 0) return `${h / 24} days`;
  if (h === 24) return '24 hours';
  return `${h} hour${h === 1 ? '' : 's'}`;
}

/**
 * The client's own cancel link for an appointment, minting the token on first
 * use. Empty when self-cancellation is switched off, which is what keeps the
 * link out of the message copy entirely rather than sending a dead one.
 */
export function cancelUrlFor(apptId, existingToken = '') {
  if (getSetting('client_cancel_enabled', '1') !== '1') return '';
  let token = existingToken;
  if (!token) {
    token = crypto.randomBytes(16).toString('hex');
    db.prepare('UPDATE appointments SET cancel_token = ? WHERE id = ?').run(token, apptId);
  }
  const origin = publicUrl();
  return origin ? `${origin}/cancel/${token}` : `/cancel/${token}`;
}

// Builds {subject, body (plain text — used for SMS and as the email text
// fallback), html (branded email layout)} for every message kind.
function buildCopy(kind, a, extra = {}) {
  const biz = getSetting('business_name', 'us');
  const phone = getSetting('business_phone', '');
  const phoneLine = phone ? ` · ${phone}` : '';
  const when = a.date ? `${fmtDate(a.date)} at ${fmtTime(a.start_min)}` : '';
  const what = a.service_name || 'your appointment';
  const who = a.staff_name ? ` with ${a.staff_name}` : '';
  const name = a.first_name || 'there';
  const visitDetails = [
    ['Service', a.service_name || ''],
    ['With', a.staff_name || ''],
    ['When', when],
    ['Where', getSetting('business_address', '')],
  ];

  // Self-cancellation link + the notice period, so the deadline is stated
  // wherever a client might look for it rather than only on the booking page.
  const cancelUrl = extra.cancelUrl || '';
  const windowHrs = Number(getSetting('cancel_window_hours', '12')) || 0;
  const noticeText = windowHrs
    ? `You can cancel online up to ${hoursLabel(windowHrs)} before your appointment. After that, please call${phone ? ` us on ${phone}` : ''} so we can fill the slot.`
    : 'You can cancel online any time before your appointment.';

  if (kind === 'confirmation') {
    return {
      subject: `Booking confirmed: ${what} on ${fmtDate(a.date)}`,
      body: `Hi ${name},\n\nYou're booked for ${what}${who} on ${when}.`
        + (cancelUrl ? `\n\nNeed to cancel? ${cancelUrl}\n${noticeText}` : '')
        + `\n\nSee you soon!\n${biz}${phoneLine}`,
      html: renderEmail({
        heading: 'Your booking is confirmed',
        greeting: `Hi ${name},`,
        paragraphs: ['Your appointment is locked in. Here are the details:'],
        details: visitDetails,
        ...(cancelUrl ? { cta: { label: 'Cancel this appointment', url: cancelUrl } } : {}),
        footNote: cancelUrl
          ? noticeText
          : (phone ? `Need to change it? Call us on ${phone}.` : ''),
      }),
    };
  }
  if (kind === 'reminder') {
    // The reminder is the one message worth turning into a question.
    //
    // "Here is your appointment" gets read and forgotten. "Are you still
    // coming?" gets answered, and an answer either way is worth money: a yes
    // makes the no-show less likely, and a no arrives while the slot can still
    // be sold. So when confirmations are on, the ask is the headline and the
    // cancel link stops being the only thing to click.
    const asking = extra.confirmRequested && cancelUrl;
    if (asking) {
      return {
        subject: `Still on for ${fmtDate(a.date)}? — ${what}`,
        body: `Hi ${name},\n\nYou're booked for ${what}${who} on ${when}.`
          + `\n\nJust tap to let us know either way: ${cancelUrl}`
          + `\n\nIf you can't make it, the same link cancels it and frees the time for somebody else.`
          + `\n\n${biz}${phoneLine}`,
        html: renderEmail({
          heading: 'Are we still seeing you?',
          greeting: `Hi ${name},`,
          paragraphs: ['One tap either way, and we\'ll know where we stand:'],
          details: visitDetails,
          cta: { label: "Yes, I'll be there", url: cancelUrl },
          footNote: `Can't make it? The same link cancels it. ${noticeText}`,
        }),
      };
    }
    return {
      subject: `Reminder: ${what} on ${fmtDate(a.date)}`,
      body: `Hi ${name},\n\nA friendly reminder about ${what}${who} on ${when}.`
        + (cancelUrl ? `\n\nCan't make it? ${cancelUrl}\n${noticeText}` : `\n\nNeed to change it? Call us on ${phone || 'our usual number'}.`)
        + `\n\n${biz}`,
      html: renderEmail({
        heading: 'See you soon!',
        greeting: `Hi ${name},`,
        paragraphs: ['A friendly reminder about your upcoming visit:'],
        details: visitDetails,
        ...(cancelUrl ? { cta: { label: "Can't make it? Cancel here", url: cancelUrl } } : {}),
        footNote: cancelUrl ? noticeText : (phone ? `Running late or need to reschedule? Call us on ${phone}.` : ''),
      }),
    };
  }
  if (kind === 'reschedule') {
    // The old time is the whole point of this message: a client who only reads
    // the new one can't tell whether anything actually moved, and will still
    // turn up when they always did.
    const wasWhen = extra.fromDate
      ? `${fmtDate(extra.fromDate)} at ${fmtTime(extra.fromStart)}`
      : 'its previous time';
    return {
      subject: `Moved: ${what} is now ${fmtDate(a.date)} at ${fmtTime(a.start_min)}`,
      body: `Hi ${name},\n\nWe've moved your appointment.\n\nWas: ${wasWhen}\nNow: ${when}\n\n${what}${who}.`
        + (cancelUrl ? `\n\nIf the new time doesn't suit, you can cancel here: ${cancelUrl}\n${noticeText}` : '')
        + (phone ? `\n\nAny trouble, call us on ${phone}.` : '')
        + `\n\n${biz}`,
      html: renderEmail({
        heading: 'Your appointment has moved',
        greeting: `Hi ${name},`,
        paragraphs: [`This was booked for <b>${wasWhen}</b>. It's now at the time below — everything else is the same.`],
        details: visitDetails,
        ...(cancelUrl ? { cta: { label: "New time doesn't suit? Cancel here", url: cancelUrl } } : {}),
        footNote: phone ? `Need a different time instead? Call us on ${phone} and we'll sort it.` : noticeText,
      }),
    };
  }
  if (kind === 'cancellation') {
    const byClient = extra.by === 'client';
    return {
      subject: `Cancelled: ${what} on ${fmtDate(a.date)}`,
      body: `Hi ${name},\n\n${byClient ? 'Your appointment has been cancelled as requested' : `We've had to cancel your appointment`}: ${what}${who} on ${when}.\n\n`
        + `You haven't been charged.${phone ? ` To rebook, call us on ${phone}.` : ' Book again any time.'}\n\n${biz}`,
      html: renderEmail({
        heading: 'Your appointment is cancelled',
        greeting: `Hi ${name},`,
        paragraphs: [byClient
          ? "That's done. Your appointment has been cancelled and the time released."
          : "We're sorry, we've had to cancel this appointment. Nothing has been charged."],
        details: visitDetails,
        ...(extra.bookUrl ? { cta: { label: 'Book another time', url: extra.bookUrl } } : {}),
        footNote: phone ? `Want a different time? Call us on ${phone} and we'll sort it.` : '',
      }),
    };
  }
  if (kind === 'owner_cancellation') {
    const clientName = [a.first_name, a.client_last].filter(Boolean).join(' ') || 'A client';
    const contact = [a.client_phone, a.client_email].filter(Boolean).join(' · ');
    const byClient = extra.by === 'client';
    return {
      subject: `Cancelled: ${clientName}, ${what} on ${fmtDate(a.date)}`,
      body: `${byClient ? `${clientName} cancelled online` : 'Appointment cancelled'}\n\n${what}${who}\n${when}${contact ? `\nContact: ${contact}` : ''}\n\nThe slot is free again and back on your booking page.\n${biz}`,
      html: renderEmail({
        heading: byClient ? 'A client cancelled' : 'Appointment cancelled',
        paragraphs: [byClient
          ? `${clientName} cancelled this appointment online. The slot is free again and already back on your booking page.`
          : 'This appointment has been cancelled. The slot is free again and already back on your booking page.'],
        details: [
          ['Customer', clientName],
          ['Contact', contact],
          ['Service', a.service_name || ''],
          ['With', a.staff_name || ''],
          ['Was booked for', when],
        ],
        footNote: 'It stays on your calendar marked Cancelled, so the history is intact.',
      }),
    };
  }
  if (kind === 'receipt') {
    if (extra.isDeposit) {
      return {
        subject: `Deposit received: ${money(extra.amountCents)} · ${biz}`,
        body: `Hi ${name},\n\nWe've received your ${money(extra.amountCents)} deposit for ${what}${who} on ${when}. It comes off your total when you visit.\n\nSee you soon!\n${biz}${phoneLine}`,
        html: renderEmail({
          heading: 'Deposit received',
          greeting: `Hi ${name},`,
          paragraphs: ['Your deposit is in and your appointment is secured. It comes off your total on the day.'],
          details: [['Deposit paid', money(extra.amountCents)], ...visitDetails],
        }),
      };
    }
    const paidInFull = !(extra.balanceCents > 0);
    return {
      subject: `Receipt: ${money(extra.amountCents)} · ${a.invoiceNumber || biz}`,
      body: `Hi ${name},\n\nThis confirms your payment of ${money(extra.amountCents)} (${methodLabel(extra.method)}) for ${what}${who}.${paidInFull ? '\nPaid in full. Thank you!' : `\nRemaining balance: ${money(extra.balanceCents)}`}\n\n${biz}${phoneLine}`,
      html: renderEmail({
        heading: paidInFull ? 'Payment received, thank you!' : 'Payment received',
        greeting: `Hi ${name},`,
        paragraphs: ['This confirms your payment. A summary for your records:'],
        details: [
          ['Amount paid', money(extra.amountCents)],
          ['Method', methodLabel(extra.method)],
          ['Invoice', a.invoiceNumber || ''],
          ['Service', a.service_name || ''],
          paidInFull ? ['Balance', 'Paid in full'] : ['Balance remaining', money(extra.balanceCents)],
        ],
      }),
    };
  }
  if (kind === 'owner_new_booking') {
    const clientName = [a.first_name, a.client_last].filter(Boolean).join(' ') || 'A new client';
    const contact = [a.client_phone, a.client_email].filter(Boolean).join(' · ');
    return {
      subject: `New booking: ${clientName}, ${what} on ${fmtDate(a.date)}`,
      body: `New online booking\n\n${clientName}\n${what}${who}\n${when}${contact ? `\nContact: ${contact}` : ''}\n\nIt's already on your calendar.\n${biz}`,
      html: renderEmail({
        heading: 'New booking received',
        paragraphs: [`${clientName} just booked online. It's already on your calendar:`],
        details: [
          ['Customer', clientName],
          ['Contact', contact],
          ['Service', a.service_name || ''],
          ['With', a.staff_name || ''],
          ['When', when],
        ],
        footNote: 'You get these because new-booking alerts are on (Settings → Notifications).',
      }),
    };
  }
  if (kind === 'review_request') {
    return {
      subject: `How was your visit to ${biz}?`,
      body: `Hi ${name},\n\nThanks for visiting ${biz} for ${what}${who}. We'd love to hear how it went. It takes 30 seconds:\n${extra.reviewUrl}\n\n${biz}`,
      html: renderEmail({
        heading: 'How did we do?',
        greeting: `Hi ${name},`,
        paragraphs: [`Thanks for visiting us for ${what}${who}. Your feedback takes 30 seconds and means a lot to a small business.`],
        cta: { label: 'Rate your visit', url: extra.reviewUrl },
      }),
    };
  }
  return { subject: '', body: '', html: '' };
}

const insMessage = () => db.prepare(
  `INSERT INTO messages (appointment_id, client_id, channel, kind, to_addr, subject, body, html, status, send_after)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'queued', ?)`
);

/**
 * Queue confirmation (sent immediately) and reminder (sent N hours before
 * start) for an appointment, on every channel the client can receive.
 */
export function queueAppointmentMessages(apptId, { confirmation = true, reminder = true, channels = '' } = {}) {
  const a = apptContext(apptId);
  if (!a || !a.client_id) return;
  if (!['booked', 'confirmed'].includes(a.status)) return;

  const now = localStamp();
  const ins = insMessage();
  // One link per appointment, reused by the confirmation and the reminder so a
  // client can cancel from whichever message they still have.
  const cancelUrl = cancelUrlFor(a.id, a.cancel_token);

  if (confirmation && getSetting('confirm_enabled', '1') === '1') {
    const copy = buildCopy('confirmation', a, { cancelUrl });
    for (const [channel, to] of channelsFor('confirmation', a.client_email, a.client_phone, channels)) {
      ins.run(a.id, a.client_id, channel, 'confirmation', to, copy.subject, copy.body, channel === 'email' ? copy.html : '', now);
    }
  }

  if (reminder && getSetting('reminders_enabled', '1') === '1') {
    const hours = Number(getSetting('reminder_hours', '24')) || 24;
    const start = new Date(`${a.date}T00:00:00`);
    start.setMinutes(a.start_min - hours * 60);
    const sendAfter = localStamp(start);
    if (sendAfter > now) { // don't remind about appointments that are (nearly) now
      // Off by default. Asking a question changes what the salon is saying to
      // its clients, and that is the owner's decision, not a default somebody
      // discovers after it has gone out to two hundred people.
      const copy = buildCopy('reminder', a, {
        cancelUrl,
        confirmRequested: getSetting('confirm_requests_enabled', '0') === '1',
      });
      for (const [channel, to] of channelsFor('reminder', a.client_email, a.client_phone)) {
        ins.run(a.id, a.client_id, channel, 'reminder', to, copy.subject, copy.body, channel === 'email' ? copy.html : '', sendAfter);
      }
    }
  }
}

/**
 * Alert the business owner by email the moment a customer books online.
 * Goes to the business's own email address (Settings → business email),
 * always by email (never SMS — no per-text cost for an internal alert).
 * Off if `owner_notify_enabled` is '0' or no business email is set. Only the
 * public booking route calls this — staff bookings don't alert the owner,
 * they made them.
 */
export function queueOwnerNotification(apptId) {
  if (getSetting('owner_notify_enabled', '1') !== '1') return;
  const to = getSetting('business_email', '');
  if (!to) return;
  const a = apptContext(apptId);
  if (!a) return;

  const copy = buildCopy('owner_new_booking', a);
  insMessage().run(a.id, a.client_id || null, 'email', 'owner_new_booking', to, copy.subject, copy.body, copy.html, localStamp());
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

  const channels = channelsFor('receipt', inv.client_email || ctx.client_email, inv.client_phone || ctx.client_phone);
  if (!channels.length) return;

  const copy = buildCopy('receipt', ctx, { amountCents, method, balanceCents, invoiceNumber: inv.number });
  const now = localStamp();
  const ins = insMessage();
  for (const [channel, to] of channels) {
    ins.run(inv.appointment_id || null, inv.client_id, channel, 'receipt', to, copy.subject, copy.body, channel === 'email' ? copy.html : '', now);
  }
}

/** Queue a receipt for an online deposit (no invoice exists yet at booking time). */
export function queueDepositReceipt(apptId, amountCents) {
  if (getSetting('receipts_enabled', '1') !== '1') return;
  const a = apptContext(apptId);
  if (!a || !a.client_id) return;
  const channels = channelsFor('receipt', a.client_email, a.client_phone);
  if (!channels.length) return;

  const copy = buildCopy('receipt', a, { amountCents, isDeposit: true });
  const now = localStamp();
  const ins = insMessage();
  for (const [channel, to] of channels) {
    ins.run(a.id, a.client_id, channel, 'receipt', to, copy.subject, copy.body, channel === 'email' ? copy.html : '', now);
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

  const channels = channelsFor('review_request', a.client_email, a.client_phone);
  if (!channels.length) return;

  let token = a.review_token;
  if (!token) {
    token = crypto.randomBytes(16).toString('hex');
    db.prepare('UPDATE appointments SET review_token = ? WHERE id = ?').run(token, apptId);
  }
  const origin = publicUrl();
  const reviewUrl = origin ? `${origin}/review/${token}` : `/review/${token}`;

  const delayHours = Number(getSetting('review_delay_hours', '1')) || 0;
  const sendAfter = localStamp(new Date(Date.now() + delayHours * 60 * 60 * 1000));

  const copy = buildCopy('review_request', a, { reviewUrl });
  const ins = insMessage();
  for (const [channel, to] of channels) {
    ins.run(a.id, a.client_id, channel, 'review_request', to, copy.subject, copy.body, channel === 'email' ? copy.html : '', sendAfter);
  }
}

/**
 * Tell both sides an appointment is off — the client gets a confirmation that
 * it's really cancelled, the owner gets an alert so a freed slot never goes
 * unnoticed. Sent whoever cancelled, so neither side is ever left guessing.
 */
export function queueCancellationMessages(apptId, { by = 'owner', notifyClient = true, holdSeconds = 0 } = {}) {
  const a = apptContext(apptId);
  if (!a) return;
  const ins = insMessage();
  const now = localStamp();
  // The client's message can be held back for a moment so an undo can catch it.
  // The owner's own copy is never held — it is the record that it happened.
  const clientAfter = holdSeconds > 0 ? localStamp(new Date(Date.now() + holdSeconds * 1000)) : now;
  const origin = publicUrl();

  // → the client, unless the owner chose to tell them in person. A client who
  // cancelled themselves always gets the confirmation: they asked for it.
  if (notifyClient && a.client_id && getSetting('confirm_enabled', '1') === '1') {
    const copy = buildCopy('cancellation', a, { by, bookUrl: origin ? `${origin}/book` : '' });
    for (const [channel, to] of channelsFor('confirmation', a.client_email, a.client_phone)) {
      ins.run(a.id, a.client_id, channel, 'cancellation', to, copy.subject, copy.body, channel === 'email' ? copy.html : '', clientAfter);
    }
  }

  // → the owner, by email only (an internal alert should never cost a text)
  const ownerTo = getSetting('business_email', '');
  if (ownerTo && getSetting('owner_notify_enabled', '1') === '1') {
    const copy = buildCopy('owner_cancellation', a, { by });
    ins.run(a.id, a.client_id || null, 'email', 'owner_cancellation', ownerTo, copy.subject, copy.body, copy.html, now);
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

/**
 * Tell the client their appointment has moved.
 *
 * Kept apart from the confirmation on purpose. Re-sending "you're booked for
 * Tuesday" to someone who already had Monday reads as a duplicate, not a
 * change — they skim it, see a booking they already knew about, and turn up on
 * Monday. This message leads with what it used to be.
 *
 * Call it AFTER requeueAppointmentMessages, which skips everything still
 * queued — otherwise this notice is swept away with the stale reminder.
 */
export function queueRescheduleMessage(apptId, { from = null, channels = '' } = {}) {
  const a = apptContext(apptId);
  if (!a || !a.client_id) return 0;
  if (!['booked', 'confirmed'].includes(a.status)) return 0;
  if (getSetting('confirm_enabled', '1') !== '1') return 0;

  const cancelUrl = cancelUrlFor(a.id, a.cancel_token);
  const copy = buildCopy('reschedule', a, {
    cancelUrl, fromDate: from?.date || '', fromStart: from?.start_min ?? 0,
  });
  const ins = insMessage();
  const now = localStamp();
  let sent = 0;
  for (const [channel, to] of channelsFor('confirmation', a.client_email, a.client_phone, channels)) {
    ins.run(a.id, a.client_id, channel, 'reschedule', to, copy.subject, copy.body, channel === 'email' ? copy.html : '', now);
    sent++;
  }
  return sent;
}

// ---------------------------------------------------------------------------
// Delivery
// ---------------------------------------------------------------------------

/**
 * @param {Array} attachments  [{ filename, content: Buffer }] — used by the
 *   backup, which posts the salon's own database to the owner's inbox.
 */
/**
 * Is this a usable sending address?
 *
 * Deliberately strict rather than clever: the characters excluded here are the
 * ones that break the From header itself, and a trailing space is the single
 * most common way this gets saved wrong.
 */
export function looksLikeEmail(v) {
  return /^[^\s@<>",;]+@[^\s@<>",;]+\.[a-z]{2,}$/i.test(String(v || '').trim());
}

/**
 * Build the From header.
 *
 * The display name has to be quoted. "Cut & Colour (Kew)" and "Hair by Sha,
 * Camberwell" are ordinary salon names and both produce an invalid header
 * unquoted — the comma reads as an address separator, the parentheses as a
 * comment — and then every single email that business sends is rejected.
 */
export function fromHeader(name, address) {
  const addr = String(address || '').trim();
  const display = String(name || '').trim();
  if (!display) return addr;
  return `"${display.replace(/[\\"]/g, (ch) => `\\${ch}`)}" <${addr}>`;
}

export async function sendEmail(to, subject, body, html = '', { attachments = [] } = {}) {
  const key = getSetting('resend_api_key');
  const from = String(getSetting('notif_from_email') || '').trim();
  if (!key || !from) return { ok: false, skipped: true, detail: 'Email not configured (add a Resend API key + from address in Settings → Notifications)' };
  // Catch a malformed address here rather than letting Resend answer with a
  // 422 that names no setting and tells the owner nothing they can act on.
  if (!looksLikeEmail(from)) {
    return { ok: false, detail: `The From address in Settings → Notifications is not a valid email address: "${from}"` };
  }
  const replyTo = replyToAddress();
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: fromHeader(getSetting('business_name', 'Bookings'), from),
      to: [to],
      ...(replyTo ? { reply_to: replyTo } : {}),
      subject,
      text: body,               // plain-text fallback for clients that prefer it
      ...(html ? { html } : {}), // branded layout for everyone else
      ...(attachments.length ? {
        attachments: attachments.map((a) => ({
          filename: a.filename,
          content: Buffer.isBuffer(a.content) ? a.content.toString('base64') : String(a.content),
        })),
      } : {}),
    }),
  });
  if (res.ok) return { ok: true, detail: 'Delivered via Resend' };
  const err = await res.text().catch(() => '');
  return { ok: false, detail: `Resend ${res.status}: ${err.slice(0, 300)}` };
}

const SMS_NOT_CONFIGURED = (name, fields) =>
  ({ ok: false, skipped: true, detail: `SMS not configured (add ${name} ${fields} in Settings → Notifications)` });

// Each sender returns { ok, skipped?, detail }. `skipped` means "not set up"
// (logged as skipped, not failed) so the Messages page shows exactly what
// happened. All three are plain HTTPS calls — no SDKs, keeping zero deps.

async function sendTwilio(to, body) {
  const sid = getSetting('twilio_sid');
  const token = getSetting('twilio_token');
  const from = getSetting('twilio_from');
  if (!sid || !token || !from) return SMS_NOT_CONFIGURED('Twilio', 'credentials');
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

async function sendClickSend(to, body) {
  const username = getSetting('clicksend_username');
  const apiKey = getSetting('clicksend_api_key');
  const from = getSetting('clicksend_from'); // optional sender ID (business name) / dedicated number
  if (!username || !apiKey) return SMS_NOT_CONFIGURED('ClickSend', 'username + API key');
  const message = { body, to };
  if (from) message.from = from;
  const res = await fetch('https://rest.clicksend.com/v3/sms/send', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${username}:${apiKey}`).toString('base64')}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ messages: [message] }),
  });
  const data = await res.json().catch(() => ({}));
  const msgStatus = data?.data?.messages?.[0]?.status;
  if (res.ok && data?.response_code === 'SUCCESS' && (!msgStatus || msgStatus === 'SUCCESS')) {
    // What that text actually cost. Remembered so the credit left can be
    // expressed as "about N messages" — a number an owner can act on, unlike
    // a bare dollar figure whose per-message rate they'd have to look up.
    const price = Number(data?.data?.total_price);
    if (Number.isFinite(price) && price > 0) setSetting('sms_last_price', String(price));
    return { ok: true, detail: `Delivered via ClickSend${data?.data?.total_price != null ? ` (cost ${data.data.total_price})` : ''}` };
  }
  return { ok: false, detail: `ClickSend: ${data?.response_msg || msgStatus || `HTTP ${res.status}`}` };
}

/**
 * How much sending credit is left with the SMS provider.
 *
 * Texts are prepaid: the balance runs down with every reminder and confirmation
 * and then, one quiet morning, messages simply stop going out. Nothing in the
 * salon says why. Showing the balance where the owner already works turns that
 * into a number they can watch, and a top-up they make before it bites.
 *
 * Never throws — a provider being unreachable is a fact to report, not an error
 * that should take a settings page down with it.
 */
export async function smsBalance({ fetchImpl = fetch } = {}) {
  const provider = getSetting('sms_provider', 'clicksend');
  const checked_at = new Date().toISOString();
  if (provider !== 'clicksend') {
    return { ok: false, provider, unsupported: true, checked_at,
      detail: `Kairo can only read the credit balance from ClickSend. Check your ${provider} dashboard.` };
  }

  const username = getSetting('clicksend_username');
  const apiKey = getSetting('clicksend_api_key');
  if (!username || !apiKey) {
    return { ok: false, provider, configured: false, checked_at,
      detail: 'Add your ClickSend username and API key in Settings → Notifications.' };
  }

  let res;
  try {
    res = await fetchImpl('https://rest.clicksend.com/v3/account', {
      headers: {
        Authorization: `Basic ${Buffer.from(`${username}:${apiKey}`).toString('base64')}`,
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(12000),
    });
  } catch (err) {
    return { ok: false, provider, configured: true, checked_at,
      detail: `Couldn't reach ClickSend (${String(err?.message || err).slice(0, 120)}).` };
  }

  const data = await res.json().catch(() => ({}));
  if (res.status === 401 || res.status === 403) {
    return { ok: false, provider, configured: true, checked_at,
      detail: 'ClickSend refused those credentials. Check the username and API key in Settings → Notifications.' };
  }
  const balance = Number(data?.data?.balance);
  if (!res.ok || !Number.isFinite(balance)) {
    return { ok: false, provider, configured: true, checked_at,
      detail: `ClickSend: ${data?.response_msg || `HTTP ${res.status}`}` };
  }

  // Currency comes back as an object; fall back gracefully if the shape moves.
  const cur = data?.data?.currency || {};
  const lastPrice = Number(getSetting('sms_last_price', ''));
  const perMessage = Number.isFinite(lastPrice) && lastPrice > 0 ? lastPrice : null;
  return {
    ok: true,
    provider,
    configured: true,
    balance,
    currency: cur.currency_name_short || '',
    symbol: cur.currency_prefix_d || '$',
    account: data?.data?.account_name || data?.data?.username || '',
    per_message: perMessage,
    // Deliberately rounded down: an owner should never be told they have more
    // messages left than they do.
    messages_left: perMessage ? Math.floor(balance / perMessage) : null,
    checked_at,
  };
}

async function sendTelnyx(to, body) {
  const apiKey = getSetting('telnyx_api_key');
  const from = getSetting('telnyx_from');           // Telnyx number or alphanumeric sender ID
  const profileId = getSetting('telnyx_profile_id'); // optional messaging profile
  if (!apiKey || (!from && !profileId)) return SMS_NOT_CONFIGURED('Telnyx', 'API key + sender number/ID');
  const payload = { to, text: body };
  if (from) payload.from = from;
  if (profileId) payload.messaging_profile_id = profileId;
  const res = await fetch('https://api.telnyx.com/v2/messages', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (res.ok && data?.data?.id) return { ok: true, detail: 'Delivered via Telnyx' };
  const reason = data?.errors?.[0]?.detail || data?.errors?.[0]?.title || `HTTP ${res.status}`;
  return { ok: false, detail: `Telnyx: ${reason}` };
}

/** Dispatch to the SMS provider chosen in Settings (default ClickSend). */
async function sendSms(to, body) {
  const provider = getSetting('sms_provider', 'clicksend');
  if (provider === 'twilio') return sendTwilio(to, body);
  if (provider === 'telnyx') return sendTelnyx(to, body);
  return sendClickSend(to, body);
}

export async function deliverMessage(msg) {
  let result;
  try {
    result = msg.channel === 'sms'
      ? await sendSms(msg.to_addr, msg.body)
      : await sendEmail(msg.to_addr, msg.subject, msg.body, msg.html || '');
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
let onTick = null;

/**
 * @param {() => Promise<any>} tick  extra work to run each minute — the backup
 *   check. Injected rather than imported so notify.js does not depend on
 *   backup.js, which already depends on it.
 */
export function startScheduler({ tick = null } = {}) {
  onTick = tick;
  if (timer) return;
  timer = setInterval(() => {
    processQueue().catch((err) => console.error('notify scheduler:', err.message));
    // Piggy-backed on the same minute tick rather than a second timer. It costs
    // one date comparison a minute and does nothing until a backup is due.
    onTick?.().catch?.((err) => console.error('backup scheduler:', err.message));
  }, 60 * 1000);
  timer.unref?.();
  // deliver anything due at boot too
  processQueue().catch(() => {});
}
