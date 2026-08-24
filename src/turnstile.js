// Keeping bots off the public booking form.
//
// The booking page is the one door left deliberately unlocked: no login, and by
// design it creates real appointments in a real diary. Kairo already caps it at
// 12 bookings per 5 minutes from one address, which stops one machine and does
// nothing at all against a hundred. A salon whose Saturday fills with junk
// appointments loses the day's takings just as surely as if the diary were
// stolen.
//
// Turnstile is Cloudflare's CAPTCHA replacement: free, unlimited, and it works
// on any site whether or not the domain is proxied through Cloudflare. Usually
// the visitor sees nothing at all.
//
// Deliberately fails OPEN. If Cloudflare is unreachable, a real customer trying
// to book at 9pm matters more than the spam that might slip through in the same
// window — the rate limiter is still there, and a lost booking is a lost client.
// The decision is logged so it can never be silent.
import { getSetting } from './db.js';

const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

export const turnstileEnabled = () =>
  getSetting('turnstile_enabled', '0') === '1'
  && Boolean(getSetting('turnstile_site_key', ''))
  && Boolean(getSetting('turnstile_secret_key', ''));

/** The public half, safe to hand to the browser (that is what it is for). */
export const turnstileSiteKey = () => (turnstileEnabled() ? getSetting('turnstile_site_key', '') : '');

/**
 * @returns {{ ok: boolean, skipped?: boolean, detail: string }}
 *   ok:false only when Cloudflare actively says the token is bad.
 */
export async function verifyTurnstile(token, ip = '', { fetchImpl = fetch } = {}) {
  if (!turnstileEnabled()) return { ok: true, skipped: true, detail: 'Turnstile is off' };
  if (!token) return { ok: false, detail: 'Please complete the "I am human" check and try again.' };

  const body = new URLSearchParams({ secret: getSetting('turnstile_secret_key', ''), response: String(token).slice(0, 2048) });
  if (ip) body.set('remoteip', ip);

  let data;
  try {
    const res = await fetchImpl(VERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
      signal: AbortSignal.timeout(8000),
    });
    data = await res.json();
  } catch (err) {
    console.error('turnstile: could not reach Cloudflare, letting the booking through —', String(err?.message || err).slice(0, 120));
    return { ok: true, skipped: true, detail: 'Turnstile unreachable — booking allowed' };
  }

  if (data?.success) return { ok: true, detail: 'verified' };
  const codes = Array.isArray(data?.['error-codes']) ? data['error-codes'] : [];
  // A stale or already-used token is the common, innocent case: the customer
  // left the form open too long. Say something they can act on.
  const expired = codes.includes('timeout-or-duplicate');
  return {
    ok: false,
    detail: expired
      ? 'That check expired — please tick it again and resubmit.'
      : 'We couldn\'t verify that you\'re human. Please try again.',
    codes,
  };
}
