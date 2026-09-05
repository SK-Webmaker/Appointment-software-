// Marketing that runs itself — carefully.
//
// Everything in campaigns.js is one person pressing one button having seen the
// list. This is the same machinery with nobody watching, which makes it the
// most dangerous code in Kairo: a mistake here doesn't show a wrong number on a
// screen, it texts four hundred people at six in the morning and bills the
// salon for it.
//
// So the safety is structural rather than careful:
//
//   1. OFF UNTIL ASKED. Every automation defaults to off. Turning one on is a
//      deliberate act with a preview of exactly who it would reach.
//   2. ONCE, EVER. automation_sends has a unique index on (kind, client, ref).
//      "Once per first visit" and "once a year" are true because the database
//      refuses the second one, not because a query remembered to check.
//   3. A CEILING PER DAY. Per automation, and across all of them together. The
//      first run after switching one on is the dangerous one — a salon with six
//      years of history has hundreds of lapsed clients — so the cap is what
//      stands between "it started working" and a $40 morning.
//   4. DAYLIGHT ONLY. Queued for business hours, never 6am, never 11pm.
//   5. THE EXISTING RULES STILL APPLY. Opt-outs, the shared cooldown across
//      every campaign kind, and no contact method means no message.
//
// Nothing here sends directly. It queues into the same messages table as
// everything else, so the owner sees it in the same log, with the same status,
// and the same retry.
import { db, getSetting } from './db.js';
import { current } from './tenant.js';
import { clientRhythms } from './opportunities.js';
import { mintToken, fillTokens, recentlyMessagedSet } from './campaigns.js';
import { expiringPatchTests } from './safety.js';

/** Nothing is queued outside these hours, local time. */
const SEND_FROM_HOUR = 10;
const SEND_TO_HOUR = 18;

/** Across every automation combined, per day. The last line of defence. */
const GLOBAL_DAILY_CAP = 60;

const pad = (n) => String(n).padStart(2, '0');
const stamp = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
const dayOf = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/**
 * The next moment it is decent to send something a client did not ask for.
 *
 * Business hours, today if there is still time, otherwise tomorrow morning. A
 * reminder at 7am is useful; an offer at 7am is a nuisance, and the difference
 * is the whole reason marketing gets muted.
 */
export function nextSendTime(now = new Date()) {
  const d = new Date(now);
  if (d.getHours() >= SEND_TO_HOUR) {
    d.setDate(d.getDate() + 1);
    d.setHours(SEND_FROM_HOUR, 0, 0, 0);
  } else if (d.getHours() < SEND_FROM_HOUR) {
    d.setHours(SEND_FROM_HOUR, 0, 0, 0);
  }
  return stamp(d);
}

// ---------------------------------------------------------------------------
// The automations themselves
// ---------------------------------------------------------------------------

/**
 * Each one answers three questions: who qualifies, what it is about (the `ref`,
 * which is what stops it firing twice), and what it says.
 *
 * The drafts are written to sound like the salon rather than like software —
 * short, no exclamation marks, and never inventing a discount. If an offer is
 * going out, the owner types it.
 */
export const AUTOMATIONS = [
  {
    kind: 'due_back',
    label: 'Due back soon',
    blurb: 'Fires just BEFORE a client is due, based on their own visit rhythm — while they are still yours to lose.',
    defaults: {
      channel: 'sms',
      subject: 'Time for your next visit?',
      body: 'Hi {first_name}, you\'re about due for your next visit. '
        + 'Grab a time whenever suits: {booking_link}\n\n{business_name}',
    },
    find({ today }) {
      const out = [];
      for (const r of clientRhythms({ today })) {
        if (r.has_future) continue;
        // The window between "about now" and "drifting". Past 1.5 they belong
        // to the win-back instead, so the two never both fire.
        if (r.ratio < 0.9 || r.ratio >= 1.5) continue;
        out.push({ clientId: r.client_id, ref: r.last_visit, context: r });
      }
      return out;
    },
  },
  {
    kind: 'lapsed_winback',
    label: 'Win back a lapsed client',
    blurb: 'Fires once a client is well past their own rhythm — the same finding the Opportunities panel shows.',
    defaults: {
      channel: 'sms',
      subject: 'We\'d love to see you again',
      body: 'Hi {first_name}, it\'s been a while since we saw you and we\'d love to get you back in. '
        + 'Book whenever suits: {booking_link}\n\n{business_name}',
    },
    find({ today }) {
      const out = [];
      for (const r of clientRhythms({ today })) {
        if (r.has_future || r.ratio < 1.5) continue;
        out.push({ clientId: r.client_id, ref: r.last_visit, context: r });
      }
      return out;
    },
  },
  {
    kind: 'first_visit',
    label: 'After a first visit',
    blurb: 'A day after somebody\'s first-ever appointment — the moment that decides whether they come back.',
    defaults: {
      channel: 'sms',
      subject: 'Thanks for coming in',
      body: 'Hi {first_name}, thanks for coming in yesterday — it was lovely to meet you. '
        + 'Whenever you\'re ready for the next one: {booking_link}\n\n{business_name}',
    },
    find({ today }) {
      // Their first completed appointment, and it was yesterday. Counted across
      // their whole history so somebody returning after years is not greeted as
      // though they are new.
      const rows = db.prepare(
        `SELECT client_id, MIN(date) AS first_date, COUNT(*) AS visits
           FROM appointments
          WHERE client_id IS NOT NULL AND status NOT IN ('cancelled','no_show') AND date <= ?
          GROUP BY client_id
         HAVING visits = 1 AND first_date = date(?, '-1 day')`
      ).all(today, today);
      return rows.map((r) => ({ clientId: r.client_id, ref: r.first_date, context: r }));
    },
  },
  {
    kind: 'abandoned_booking',
    label: 'Started booking but didn\'t finish',
    blurb: 'A client already on your list picked a time, typed their details and never confirmed. One message, then the record is deleted. First-timers are never recorded at all.',
    defaults: {
      channel: 'sms',
      subject: 'Did you still want that appointment?',
      body: 'Hi {first_name}, looks like you started booking with us and got interrupted. '
        + 'Here\'s the diary if you\'d still like a time: {booking_link}\n\n{business_name}',
    },
    find() {
      // At least an hour old, so it isn't chasing somebody who is still on the
      // page deciding.
      //
      // The far edge is two days rather than one, and that is not slack. The
      // pass runs once a day, so an attempt made in the hour BEFORE a pass is
      // too fresh at that pass and would be a day and a bit old at the next —
      // outside a one-day window, and silently never followed up. The window
      // has to be wider than the gap between passes or it drops people. In
      // practice nobody is messaged more than about 25 hours late; two days is
      // only reached if a pass was missed entirely.
      const rows = db.prepare(
        `SELECT id, first_name, email, phone, client_id FROM booking_attempts
          WHERE converted = 0
            AND created_at <= datetime('now', '-1 hour')
            AND created_at >= datetime('now', '-2 days')`
      ).all();
      const out = [];
      for (const r of rows) {
        // Every attempt is stored against a client — the capture route refuses
        // to record anyone else — so this is a person with an opt-out on their
        // record and a cooldown that already applies to them. The lookup is the
        // fallback for a client created between the attempt and this pass.
        const c = r.client_id || db.prepare(
          'SELECT id FROM clients WHERE (email != \'\' AND email = ?) OR (phone != \'\' AND phone = ?) LIMIT 1'
        ).get(r.email, r.phone)?.id;
        if (!c) continue;
        out.push({ clientId: c, ref: `attempt:${r.id}`, context: r });
      }
      return out;
    },
  },
  {
    kind: 'birthday',
    label: 'Birthday',
    blurb: 'A week before a client\'s birthday — only for the ones who gave you a date.',
    defaults: {
      channel: 'sms',
      subject: 'Happy birthday from {business_name}',
      body: 'Hi {first_name}, happy birthday for next week from all of us. '
        + 'If you\'d like to get in beforehand: {booking_link}\n\n{business_name}',
    },
    find({ today }) {
      const isLeapYear = (y) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;

      // Five to seven days out, not exactly seven. The pass runs once a day, so
      // a single day it does not run — a restart, a deploy, a box that was
      // asleep — would skip somebody's birthday for the entire year. A window
      // costs nothing, because the year on the record is what stops a second
      // greeting, not the narrowness of the day.
      //
      // Matched on month and day alone; the year of birth is never stored.
      const wanted = new Map(); // 'MM-DD' → the year that birthday falls in
      for (let d = 7; d >= 5; d--) {
        const t = new Date(`${today}T12:00:00`);
        t.setDate(t.getDate() + d);
        const mm = String(t.getMonth() + 1).padStart(2, '0');
        const dd = String(t.getDate()).padStart(2, '0');
        if (!wanted.has(`${mm}-${dd}`)) wanted.set(`${mm}-${dd}`, t.getFullYear());
        // 29 February comes round every fourth year. In a common year the
        // greeting rides along with the 28th rather than being skipped for
        // three years running.
        if (mm === '02' && dd === '28' && !isLeapYear(t.getFullYear()) && !wanted.has('02-29')) {
          wanted.set('02-29', t.getFullYear());
        }
      }

      const keys = [...wanted.keys()];
      const rows = db.prepare(
        `SELECT id, birthday FROM clients WHERE birthday IN (${keys.map(() => '?').join(',')})`
      ).all(...keys);
      // Once per calendar year, so a birthday greeting can never go twice.
      return rows.map((r) => ({
        clientId: r.id,
        ref: String(wanted.get(r.birthday)),
        context: { birthday: r.birthday },
      }));
    },
  },
  {
    kind: 'no_future_booking',
    label: 'Left without rebooking',
    blurb: 'A few days after a visit, when a regular has walked out with nothing in the diary.',
    defaults: {
      channel: 'sms',
      subject: 'Shall we get you back in?',
      body: 'Hi {first_name}, we didn\'t get a chance to book your next one. '
        + 'Here\'s the diary whenever you\'re ready: {booking_link}\n\n{business_name}',
    },
    find({ today }) {
      // Three days after the visit — long enough not to tread on the goodbye,
      // short enough that the visit is still in their head. Only for clients
      // with a rhythm, so a one-off walk-in is not chased.
      const rows = db.prepare(
        `SELECT a.client_id, MAX(a.date) AS last_date
           FROM appointments a
          WHERE a.client_id IS NOT NULL AND a.status NOT IN ('cancelled','no_show') AND a.date <= ?
          GROUP BY a.client_id
         HAVING last_date = date(?, '-3 days')`
      ).all(today, today);
      if (!rows.length) return [];
      const rhythm = new Map(clientRhythms({ today }).map((r) => [r.client_id, r]));
      return rows
        .filter((r) => rhythm.has(r.client_id) && !rhythm.get(r.client_id).has_future)
        .map((r) => ({ clientId: r.client_id, ref: r.last_date, context: rhythm.get(r.client_id) }));
    },
  },
  {
    kind: 'patch_test_expiring',
    label: 'Patch test running out',
    blurb: 'Before an appointment that needs a patch test the client no longer has a valid one — '
      + 'early enough to fix in ten minutes rather than on the day.',
    defaults: {
      channel: 'sms',
      subject: 'Quick patch test before your appointment',
      body: 'Hi {first_name}, before your next colour we need to redo your patch test — '
        + 'it takes ten minutes and has to be done a few days beforehand. '
        + 'Pop in any time, or grab a slot here: {booking_link}\n\n{business_name}',
    },
    find({ today }) {
      // Three weeks of warning. On the morning of a four-hour balayage this
      // sentence is a cancelled appointment and an empty chair; three weeks out
      // it is a ten-minute visit nobody remembers.
      //
      // The ref is the appointment, so it goes once per booking rather than
      // once per client — somebody with two colours in the diary should hear
      // about the one that is actually at risk, and only once about it.
      return expiringPatchTests({ today, withinDays: 21 })
        .map((e) => ({ clientId: e.client_id, ref: `a${e.appointment_id}`, context: e }));
    },
  },
];

export const AUTOMATION_KINDS = new Set(AUTOMATIONS.map((a) => a.kind));
const byKind = new Map(AUTOMATIONS.map((a) => [a.kind, a]));

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

/** Every automation with its stored settings, filling in defaults on first read. */
export function listAutomations() {
  const rows = new Map(db.prepare('SELECT * FROM automations').all().map((r) => [r.kind, r]));
  return AUTOMATIONS.map((a) => {
    const row = rows.get(a.kind);
    return {
      kind: a.kind,
      label: a.label,
      blurb: a.blurb,
      enabled: row ? row.enabled === 1 : false,
      channel: row?.channel || a.defaults.channel,
      subject: row?.subject ?? a.defaults.subject,
      body: row?.body ?? a.defaults.body,
      cooldown_days: row?.cooldown_days ?? 14,
      max_per_day: row?.max_per_day ?? 20,
      last_run: row?.last_run || '',
    };
  });
}

export function getAutomation(kind) {
  return listAutomations().find((a) => a.kind === kind) || null;
}

export function saveAutomation(kind, patch = {}) {
  if (!AUTOMATION_KINDS.has(kind)) throw new Error('Unknown automation');
  const cur = getAutomation(kind);
  const next = {
    enabled: patch.enabled === undefined ? cur.enabled : Boolean(patch.enabled),
    channel: ['sms', 'email', 'both'].includes(patch.channel) ? patch.channel : cur.channel,
    subject: patch.subject === undefined ? cur.subject : String(patch.subject).slice(0, 300),
    body: patch.body === undefined ? cur.body : String(patch.body).slice(0, 2000),
    // Clamped rather than validated-and-rejected: these are the two numbers
    // standing between an enthusiastic owner and a bill they didn't expect.
    cooldown_days: patch.cooldown_days === undefined ? cur.cooldown_days
      : Math.max(0, Math.min(365, Number(patch.cooldown_days) || 0)),
    max_per_day: patch.max_per_day === undefined ? cur.max_per_day
      : Math.max(1, Math.min(GLOBAL_DAILY_CAP, Number(patch.max_per_day) || 1)),
  };
  if (!next.body.trim()) throw new Error('The message cannot be empty');
  db.prepare(
    `INSERT INTO automations (kind, enabled, channel, subject, body, cooldown_days, max_per_day, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
     ON CONFLICT(kind) DO UPDATE SET
       enabled = excluded.enabled, channel = excluded.channel, subject = excluded.subject,
       body = excluded.body, cooldown_days = excluded.cooldown_days,
       max_per_day = excluded.max_per_day, updated_at = excluded.updated_at`
  ).run(kind, next.enabled ? 1 : 0, next.channel, next.subject, next.body,
    next.cooldown_days, next.max_per_day);
  return getAutomation(kind);
}

// ---------------------------------------------------------------------------
// Running
// ---------------------------------------------------------------------------

const alreadySent = (kind) => new Set(
  db.prepare('SELECT client_id || \'|\' || ref AS k FROM automation_sends WHERE kind = ?')
    .all(kind).map((r) => r.k)
);

const sentToday = () => db.prepare(
  "SELECT COUNT(*) AS n FROM automation_sends WHERE substr(created_at, 1, 10) = date('now')"
).get().n;

/**
 * Who this automation would message right now, and why not for everyone else.
 *
 * The same function the runner uses, so the preview an owner sees before
 * switching something on is the actual list — not an optimistic approximation
 * of it. `limit` is applied last so the count of skipped reasons stays honest.
 */
export function candidatesFor(kind, { today = dayOf(), limit = 0 } = {}) {
  const def = byKind.get(kind);
  if (!def) return { eligible: [], blocked: {} };
  const conf = getAutomation(kind);

  const found = def.find({ today });
  const done = alreadySent(kind);
  const cooled = recentlyMessagedSet();
  const optedOut = new Set(
    db.prepare('SELECT id FROM clients WHERE marketing_opt_out = 1').all().map((r) => r.id)
  );

  const blocked = { already_sent: 0, opted_out: 0, cooling_off: 0, no_contact: 0 };
  const eligible = [];

  for (const cand of found) {
    if (done.has(`${cand.clientId}|${cand.ref}`)) { blocked.already_sent++; continue; }
    if (optedOut.has(cand.clientId)) { blocked.opted_out++; continue; }
    if (cooled.has(cand.clientId)) { blocked.cooling_off++; continue; }
    const c = db.prepare('SELECT id, first_name, last_name, email, phone FROM clients WHERE id = ?')
      .get(cand.clientId);
    if (!c) { blocked.no_contact++; continue; }
    const canEmail = conf.channel !== 'sms' && Boolean((c.email || '').trim());
    const canSms = conf.channel !== 'email' && Boolean((c.phone || '').trim());
    if (!canEmail && !canSms) { blocked.no_contact++; continue; }
    eligible.push({ ...c, ref: cand.ref, context: cand.context });
  }

  return {
    eligible: limit ? eligible.slice(0, limit) : eligible,
    total_eligible: eligible.length,
    blocked,
  };
}

const insMessage = () => db.prepare(
  `INSERT INTO messages (appointment_id, client_id, channel, kind, to_addr, subject, body, html, status, send_after, token)
   VALUES (NULL, ?, ?, ?, ?, ?, ?, '', 'queued', ?, ?)`
);

/**
 * Run one automation. Queues messages; never sends them directly.
 *
 * Returns what happened in the owner's terms — queued, and why the rest were
 * not — because "ran successfully" tells them nothing and this is a thing that
 * happened to their clients while they were cutting hair.
 */
export function runAutomation(kind, { today = dayOf(), now = new Date(), dryRun = false } = {}) {
  const conf = getAutomation(kind);
  if (!conf) return { kind, queued: 0, reason: 'unknown' };
  if (!conf.enabled) return { kind, queued: 0, reason: 'off' };

  const roomToday = Math.max(0, GLOBAL_DAILY_CAP - sentToday());
  if (!roomToday) return { kind, queued: 0, reason: 'daily cap reached', ...candidatesFor(kind, { today }) };

  const cap = Math.min(conf.max_per_day, roomToday);
  const { eligible, total_eligible: totalEligible, blocked } = candidatesFor(kind, { today });
  const take = eligible.slice(0, cap);

  if (dryRun) {
    return { kind, queued: 0, would_queue: take.length, held_back: totalEligible - take.length, blocked, dry_run: true };
  }

  const ins = insMessage();
  const rec = db.prepare(
    'INSERT OR IGNORE INTO automation_sends (kind, client_id, message_id, ref) VALUES (?, ?, ?, ?)'
  );
  const biz = getSetting('business_name', '');
  const sendAt = nextSendTime(now);
  let queued = 0;

  for (const c of take) {
    const token = mintToken();
    const fill = { firstName: c.first_name, token, businessName: biz };
    const body = fillTokens(conf.body, fill);
    const subject = fillTokens(conf.subject, fill);

    const wants = [];
    if (conf.channel !== 'sms' && (c.email || '').trim()) wants.push(['email', c.email.trim()]);
    if (conf.channel !== 'email' && (c.phone || '').trim()) wants.push(['sms', c.phone.trim()]);
    if (!wants.length) continue;

    // Claim it FIRST. If queueing then fails halfway, the worst outcome is a
    // client who didn't get a message — not one who gets it twice tomorrow.
    const claim = rec.run(kind, c.id, null, String(c.ref));
    if (!claim.changes) continue; // someone else got there; the index said no

    let firstId = null;
    for (const [ch, to] of wants) {
      const info = ins.run(c.id, ch, kind, to, subject, body, sendAt, token);
      if (firstId === null) firstId = Number(info.lastInsertRowid);
    }
    if (firstId !== null) {
      db.prepare('UPDATE automation_sends SET message_id = ? WHERE kind = ? AND client_id = ? AND ref = ?')
        .run(firstId, kind, c.id, String(c.ref));
    }
    queued++;
  }

  db.prepare('UPDATE automations SET last_run = ? WHERE kind = ?').run(stamp(now), kind);
  return { kind, queued, held_back: Math.max(0, totalEligible - queued), blocked, send_at: sendAt };
}

/**
 * The daily pass over every enabled automation.
 *
 * Hung on the scheduler's existing minute tick and guarded to once a day. That
 * guard saves work, not clients: running this every sixty seconds would still
 * send nobody a second message, because the unique index on automation_sends
 * refuses it. Two independent layers, and this is the cheaper one.
 */
// Per tenant (on the tenant's own state), because one process now serves
// many salons and "ran today" is a fact about one of them.
const marker = () => current().state;

export function runDailyPass({ now = new Date(), force = false } = {}) {
  const today = dayOf(now);
  if (!force && marker().lastPassDay === today) return null;

  // Survives a restart: the marker lives in the database, not in memory.
  const stored = getSetting('automations_last_pass', '');
  if (!force && stored === today) { marker().lastPassDay = today; return null; }

  marker().lastPassDay = today;
  db.prepare("INSERT INTO settings (key, value) VALUES ('automations_last_pass', ?) "
    + 'ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(today);

  // The booking page promises an unfinished attempt is deleted after a week.
  // That promise is only worth making if something actually keeps it, so it
  // runs here whether or not the follow-up automation is even switched on.
  try {
    db.prepare("DELETE FROM booking_attempts WHERE created_at < datetime('now', '-7 days')").run();
  } catch { /* never let housekeeping stop the pass */ }

  const results = [];
  for (const a of listAutomations()) {
    if (!a.enabled) continue;
    try {
      results.push(runAutomation(a.kind, { today, now }));
    } catch (err) {
      results.push({ kind: a.kind, queued: 0, error: err.message });
    }
  }
  return { day: today, ran: results };
}

/** Test seam — lets a suite pretend a new day started. */
export function _resetPassMarker() { marker().lastPassDay = ''; }
