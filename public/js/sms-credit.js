// The SMS credit left with the provider, rendered the same way everywhere it
// appears (Settings, where texting is switched on, and Messages, where the
// sending is watched).
//
// Texts are prepaid. When the balance runs out messages stop going out and
// nothing in the salon says why — the reminders just quietly stop reducing
// no-shows. So the number is shown as money AND as roughly how many texts that
// buys, because "$4.10" means nothing to an owner who has never looked up the
// per-message rate.
import { esc, icon } from './ui.js';

/** Below this many texts remaining, say so plainly. */
const LOW = 50;
const CRITICAL = 15;

const ago = (iso) => {
  const secs = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (secs < 90) return 'just now';
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  return hrs < 24 ? `${hrs}h ago` : `${Math.round(hrs / 24)}d ago`;
};

const refreshBtn = '<button type="button" class="sc-btn" data-credit-refresh>Refresh</button>';
const topUpBtn = '<a class="sc-btn" href="https://dashboard.clicksend.com" target="_blank" rel="noopener noreferrer">'
  + 'Top up at ClickSend ↗</a>';

/**
 * @param {object} d  the /api/sms/balance payload
 * @returns {{ html: string, tone: string }}
 */
export function renderSmsCredit(d) {
  if (!d || !d.ok) {
    // Not set up, wrong provider, bad keys, or ClickSend unreachable — all of
    // which are worth saying out loud rather than showing a blank space.
    return {
      tone: 'is-muted',
      html: `<div class="sc-main">
        <span class="sc-sub">${icon('alert', 14)} ${esc(d?.detail || 'Credit balance unavailable.')}</span>
      </div>
      <div class="sc-actions">${d?.configured ? refreshBtn : ''}</div>`,
    };
  }

  const left = d.messages_left;
  const tone = d.balance <= 0 || (left != null && left <= CRITICAL) ? 'is-out'
    : (left != null && left <= LOW) ? 'is-low' : 'is-ok';
  const amount = `${esc(d.symbol || '$')}${Number(d.balance).toFixed(2)}${d.currency ? ` ${esc(d.currency)}` : ''}`;

  // "About N texts" is the number an owner can act on. It only appears once a
  // text has actually been sent, because that is when the real per-message rate
  // for this account and this country is known — guessing it would be worse
  // than saying nothing.
  const estimate = left != null
    ? `about <b>${left.toLocaleString()}</b> more text${left === 1 ? '' : 's'}`
    : 'send a text and Kairo will work out how many that buys';

  const warning = tone === 'is-out'
    ? '<div class="sc-warn">Texts have stopped, or are about to. Top up to start them again.</div>'
    : tone === 'is-low'
      ? '<div class="sc-warn">Running low — worth topping up before it runs out.</div>'
      : '';

  return {
    tone,
    html: `<div class="sc-main">
      <span class="sc-amount">${amount}</span>
      <span class="sc-sub">${estimate}${d.account ? ` · ${esc(d.account)}` : ''} · checked ${esc(ago(d.checked_at))}</span>
    </div>
    ${warning}
    <div class="sc-actions">${refreshBtn}${topUpBtn}</div>`,
  };
}

/** Load and paint into a container; used by every page that shows the balance. */
export async function mountSmsCredit(el, api, { refresh = false } = {}) {
  el.className = 'sms-credit is-loading';
  el.innerHTML = '<div class="sc-main"><span class="sc-amount">·····</span>'
    + '<span class="sc-sub">checking your balance…</span></div>';
  let out;
  try {
    out = renderSmsCredit(await api.get(`/api/sms/balance${refresh ? '?refresh=1' : ''}`));
  } catch (err) {
    out = { tone: 'is-muted', html: `<div class="sc-main"><span class="sc-sub">${esc(err.message)}</span></div>` };
  }
  el.className = `sms-credit ${out.tone}`;
  el.innerHTML = out.html;
}
