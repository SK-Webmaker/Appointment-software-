// The operator's dashboard: how the business is doing, in one answer.
//
// Everything here is counted from the platform's own records — the money from
// what Stripe confirmed, the salons from what was built — so a number on the
// operator's phone is never a guess. Test records the operator removed are
// left out of every figure, exactly as they are left out of the queue.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { db } from './db.js';
import * as shard from './shard.js';
import * as stripe from './stripe.js';
import { refundDaysLeft, BASE_DOMAIN } from './signup.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const VERSION = (() => { try { return JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')).version; } catch { return ''; } })();

const one = (sql, ...a) => db.prepare(sql).get(...a);
const KEPT = "state != 'removed'";
const WEEKS = 12;

/** What happened, in the words the operator would use. Anything else is plumbing. */
export const ACTIVITY = {
  'signup:start': 'Started signing up',
  'verified:email': 'Confirmed their email',
  'state:payment_pending': 'Opened the payment page',
  'state:paid': 'Paid',
  'state:flagged': 'Held for a check',
  'state:ready': 'Went live',
  'state:refunded': 'Refunded',
  'state:expired': 'Signup expired unpaid',
  'state:deleted': 'Closed their account',
  'email:ready': 'Welcome email sent',
  'refund:copy-emailed': 'Their data was emailed to them',
  'refund:copy-failed': 'Their data could not be emailed',
  'purge:done': 'Files deleted',
  'stripe:dispute': 'Card payment disputed',
  'operator:approve': 'You approved them',
  'operator:refund': 'You refunded them',
  'operator:welcome': 'You resent the welcome email',
};

/** The same, plus the steps that belong in one salon's history but not the feed. */
const LABELS = {
  ...ACTIVITY,
  'state:created': 'Signup created',
  'state:verified': 'Email confirmed',
  'state:screening': 'Checking the signup',
  'state:provisioning': 'Building their salon',
  'state:removed': 'Removed as a test record',
  'code:email': 'Code emailed',
  'code:email:resend': 'Code emailed again',
  'email:sending': 'Email sending set up',
  'refund:stripe': 'Money returned in Stripe',
  'refund:files-delete-scheduled': 'Files scheduled for deletion',
  'operator:remove': 'You removed the record',
  'operator:send-copy': 'You sent their data',
  'operator:retry': 'You retried the setup',
  'copy:emailed': 'Their data was emailed to them',
};

/** Monday 00:00 UTC of the week containing `ms`. */
const weekStart = (ms) => {
  const d = new Date(ms);
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.getTime();
};
const parse = (s) => (s ? Date.parse(`${String(s).replace(' ', 'T')}Z`) : NaN);

async function shardHealth() {
  try {
    const h = await Promise.race([shard.health(), new Promise((_, no) => setTimeout(() => no(new Error('no answer in 6s')), 6000))]);
    return { ok: true, version: h.version, salons: h.tenants };
  } catch (e) {
    return { ok: false, error: String(e.message || e).slice(0, 160) };
  }
}

export async function overview() {
  const money = one(`SELECT
      COALESCE(SUM(CASE WHEN paid_at != '' AND refunded_at = '' THEN price_cents END), 0) AS net,
      COALESCE(SUM(CASE WHEN paid_at != '' AND refunded_at = '' AND paid_at >= datetime('now', 'start of month') THEN price_cents END), 0) AS month,
      COALESCE(SUM(CASE WHEN paid_at != '' AND refunded_at = '' AND paid_at >= datetime('now', '-30 days') THEN price_cents END), 0) AS d30,
      COALESCE(SUM(CASE WHEN refunded_at != '' THEN price_cents END), 0) AS refunded,
      SUM(refunded_at != '') AS refunded_n,
      SUM(paid_at != '') AS paid_n
    FROM businesses WHERE ${KEPT}`);
  const counts = one(`SELECT
      SUM(state = 'ready') AS live,
      SUM(state = 'ready' AND ready_at >= datetime('now', '-7 days')) AS live_7d,
      SUM(state IN ('created', 'verified', 'payment_pending')) AS unpaid,
      SUM(created_at >= datetime('now', '-30 days')) AS started_30d,
      SUM(paid_at >= datetime('now', '-30 days')) AS paid_30d
    FROM businesses WHERE ${KEPT}`);
  const verified30 = one(`SELECT COUNT(DISTINCT b.id) AS n FROM businesses b JOIN owners o ON o.id = b.owner_id
      WHERE b.${KEPT} AND b.created_at >= datetime('now', '-30 days') AND o.email_verified = 1`).n;
  const live30 = one(`SELECT COUNT(*) AS n FROM businesses WHERE ${KEPT} AND created_at >= datetime('now', '-30 days') AND ready_at != ''`).n;

  // Twelve weeks of signups and sales, oldest first, for the chart.
  const since = weekStart(Date.now()) - (WEEKS - 1) * 7 * 86400000;
  const weeks = Array.from({ length: WEEKS }, (_, i) => ({ start: new Date(since + i * 7 * 86400000).toISOString().slice(0, 10), started: 0, paid: 0, cents: 0 }));
  const sinceSql = new Date(since).toISOString().slice(0, 19).replace('T', ' ');
  for (const r of db.prepare(`SELECT created_at, paid_at, refunded_at, price_cents FROM businesses WHERE ${KEPT} AND (created_at >= ? OR paid_at >= ?)`).all(sinceSql, sinceSql)) {
    const c = Math.floor((weekStart(parse(r.created_at)) - since) / (7 * 86400000));
    if (weeks[c]) weeks[c].started += 1;
    if (r.paid_at) {
      const p = Math.floor((weekStart(parse(r.paid_at)) - since) / (7 * 86400000));
      if (weeks[p]) { weeks[p].paid += 1; if (!r.refunded_at) weeks[p].cents += r.price_cents; }
    }
  }

  const salons = db.prepare(`SELECT b.id, b.slug, b.name, b.state, b.price_cents, b.created_at, b.paid_at, b.ready_at, b.refunded_at,
        b.abn, b.abn_name, b.files_purged_at, o.name AS owner, o.email, o.phone
      FROM businesses b LEFT JOIN owners o ON o.id = b.owner_id WHERE b.${KEPT} ORDER BY b.id DESC LIMIT 500`).all()
    .map((b) => ({ ...b, refund_days_left: b.state === 'ready' && b.paid_at ? Math.max(0, refundDaysLeft(b)) : 0 }));

  const kinds = Object.keys(ACTIVITY);
  const activity = db.prepare(`SELECT e.id, e.at, e.kind, e.detail, b.id AS business_id, b.name, b.slug FROM events e
      LEFT JOIN businesses b ON b.id = e.business_id
      WHERE e.kind IN (${kinds.map(() => '?').join(',')}) AND (b.id IS NULL OR b.${KEPT})
      ORDER BY e.id DESC LIMIT 60`).all(...kinds)
    .map((e) => ({ ...e, label: ACTIVITY[e.kind], detail: e.kind === 'signup:start' ? '' : e.detail }));

  const lastPaid = one("SELECT MAX(at) AS at FROM events WHERE kind = 'state:paid'").at || '';
  const lastRejected = one("SELECT MAX(at) AS at FROM events WHERE kind = 'webhook:rejected'").at || '';

  return {
    generated_at: new Date().toISOString(),
    base_domain: BASE_DOMAIN(),
    labels: LABELS,
    money: { ...money, refunded_n: money.refunded_n || 0, paid_n: money.paid_n || 0 },
    counts: {
      live: counts.live || 0, live_7d: counts.live_7d || 0, unpaid: counts.unpaid || 0,
      started_30d: counts.started_30d || 0, verified_30d: verified30, paid_30d: counts.paid_30d || 0, live_30d: live30,
      in_window: salons.filter((s) => s.refund_days_left > 0).length,
    },
    weeks,
    salons,
    activity,
    health: {
      platform_version: VERSION,
      shard: await shardHealth(),
      stripe: stripe.stripeConfigured() ? stripe.stripeMode() : 'off',
      email: Boolean(process.env.RESEND_API_KEY && process.env.PLATFORM_FROM_EMAIL),
      last_payment_at: lastPaid,
      last_rejected_webhook_at: lastRejected,
      purges_waiting: one("SELECT COUNT(*) AS n FROM businesses WHERE files_purge_at != '' AND files_purged_at = ''").n,
    },
  };
}
