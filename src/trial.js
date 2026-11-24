// The free 14-day trial, as the salon itself sees it.
//
// The platform decides who gets a trial, when it ends, when it pauses and when
// it is deleted (platform/signup.js). The salon only needs to know three
// things, all set by the platform when it builds the salon and changed by it
// again when the trial is paid for:
//
//   plan_status       'trial' until the owner pays, then 'active'
//   trial_ends_at     ISO time the trial ends (it pauses then)
//   trial_deletes_at  ISO time it is deleted if nobody has paid
//
// While plan_status is 'trial', five things are held back, each one either a
// running cost (Kai, text messages, bulk email) or money moving through an
// account nobody has paid for (deposits and card payments). A locked request
// is answered 402 with { locked: <feature> }, and the app shows what the
// feature does and that it comes with a plan. Everything else is the full
// Kairo, so the owner sees exactly what they would be buying.
import { getSetting, platformHandles } from './db.js';
import { httpError } from './util.js';
import { current as currentTenant, isReadOnly } from './tenant.js';

// Both, never one alone: a trial is only ever made by the platform, which sets
// the end date with it. An old salon whose status somebody once typed as
// "trial" by hand must never find its features locked overnight.
export const isTrial = () => getSetting('plan_status', '') === 'trial' && Boolean(getSetting('trial_ends_at', ''));

/** What each locked feature is, in the words the lock card uses. */
export const LOCKS = {
  kai: {
    title: 'Kai, your assistant',
    body: 'Type what you need in plain words, like "book Jane in Friday at 2", "move my 3 o\'clock to Thursday" or "who hasn\'t been in for two months?", and Kai does it across your whole diary.',
  },
  sms: {
    title: 'Text reminders',
    body: 'A text the day before is the single best cure for no-shows. Confirmations and reminders by text, from your own ClickSend account, with your business name on them.',
  },
  payments: {
    title: 'Deposits and card payments',
    body: 'Take a deposit when someone books online, straight into your own Stripe or Square account, so a no-show has already paid. Card payments at the counter too.',
  },
  marketing: {
    title: 'Automatic and bulk messages',
    body: 'Win back clients who have drifted, remind people when they are due back, wish them happy birthday, and message all your clients at once about an opening or a special.',
  },
  email: {
    title: 'Your own email address',
    body: 'Send every confirmation and reminder from your own domain, like bookings@yoursalon.com.au.',
  },
};

/** Settings that switch a locked feature on, by feature. */
const LOCKED_SETTINGS = {
  sms: ['sms_provider', 'clicksend_username', 'clicksend_api_key', 'clicksend_from', 'telnyx_api_key', 'telnyx_from',
    'telnyx_profile_id', 'twilio_sid', 'twilio_token', 'twilio_from', 'sms_notifications_enabled'],
  payments: ['stripe_secret_key', 'square_access_token', 'square_location_id', 'pay_provider', 'deposit_type', 'deposit_value',
    'deposit_over_cents', 'pos_payment_link', 'invite_pay'],
  email: ['resend_api_key', 'notif_from_email'],
  kai: ['kai_enabled'],
};

/** Refuse a locked feature during the trial. A no-op once the salon has paid. */
export function trialLock(feature) {
  if (!isTrial()) return;
  const lock = LOCKS[feature] || { title: 'This' };
  const err = httpError(402, `${lock.title} comes with Kairo once you choose a plan. Everything you've set up stays exactly as it is.`);
  err.data = { locked: feature };
  throw err;
}

/**
 * The settings in a save that would switch a locked feature on. Turning a
 * feature OFF, or saving a blank, is always allowed: a trial must never be
 * stuck with something it cannot undo.
 */
export function lockedSettingIn(body) {
  if (!isTrial()) return '';
  for (const [feature, keys] of Object.entries(LOCKED_SETTINGS)) {
    for (const k of keys) {
      if (!(k in body)) continue;
      const v = String(body[k] ?? '').trim();
      if (v === '' || v === '0' || v === 'none' || v === 'off') continue;
      if (feature === 'kai' && v !== '0') continue; // switching Kai on is not the lock; using it is
      return feature;
    }
  }
  return '';
}

const DAY = 86400000;

/** The trial as the banner shows it, or { trial: false }. */
export function trialInfo(now = Date.now()) {
  if (!isTrial()) return { trial: false };
  const ends = Date.parse(getSetting('trial_ends_at', '')) || 0;
  const deletes = Date.parse(getSetting('trial_deletes_at', '')) || 0;
  const { platform_url: platformUrl, connect_token: token } = platformHandles();
  const platform = String(platformUrl || '').replace(/\/+$/, '');
  return {
    trial: true,
    ends_at: ends ? new Date(ends).toISOString() : '',
    deletes_at: deletes ? new Date(deletes).toISOString() : '',
    // Whole days left, counting today: "1 day left" on the last day.
    days_left: ends ? Math.max(0, Math.ceil((ends - now) / DAY)) : null,
    ended: Boolean(ends && now >= ends) || isReadOnly(),
    keep_url: platform && token ? `${platform}/keep?t=${encodeURIComponent(token)}` : '',
    locks: LOCKS,
  };
}

// ── Email during a trial ─────────────────────────────────────────────────────
//
// A trial salon sends its clients real confirmations and reminders, through
// the platform's shared sender, whose free allowance is shared with every
// paying salon. So a trial is capped per day, and all trials together are
// capped well below the allowance, so a rush of trials can never stop a paying
// salon's reminders. The counters live in memory: a restart forgets them,
// which errs on the side of a trial's clients getting their email.
export const TRIAL_EMAILS_PER_DAY = () => Number(process.env.KAIRO_TRIAL_EMAILS_PER_DAY || 15);
export const TRIAL_EMAILS_ALL_PER_DAY = () => Number(process.env.KAIRO_TRIAL_EMAILS_ALL_PER_DAY || 50);
const sent = new Map();
const today = () => new Date().toISOString().slice(0, 10);

/** May this trial salon send one more client email today? Always yes once paid. */
export function trialEmailAllowed() {
  if (!isTrial()) return true;
  const d = today();
  const mine = sent.get(`${currentTenant()?.slug || ''}|${d}`) || 0;
  const all = sent.get(`*|${d}`) || 0;
  return mine < TRIAL_EMAILS_PER_DAY() && all < TRIAL_EMAILS_ALL_PER_DAY();
}

export function trialEmailSent() {
  if (!isTrial()) return;
  const d = today();
  for (const k of [`${currentTenant()?.slug || ''}|${d}`, `*|${d}`]) sent.set(k, (sent.get(k) || 0) + 1);
  // Yesterday's counters are of no further use.
  for (const k of sent.keys()) if (!k.endsWith(d)) sent.delete(k);
}
