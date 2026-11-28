// The free trial, on the owner's screen.
//
// A slim bar on every page says how long is left, and what happens when it
// runs out. Five features are shown but held back (src/trial.js on the
// server); reaching for one opens a card that says what it does and that it
// comes with a plan. Everything else is the whole of Kairo.
//
// Inside the iPhone app there is no "Choose a plan" button and no link to
// one: the app links to nothing that sells (App Review 3.1.1). The countdown
// and the locks are still shown; the plans are on the web and in the emails.
import { api } from './api.js';
import { esc, icon, openModal } from './ui.js';

let info = { trial: false };
const inApp = () => typeof window !== 'undefined' && Boolean(window.kairoNative);

export const trialState = () => info;

/** Ask the server. Never throws: a salon that cannot say is treated as paid. */
export async function loadTrial() {
  try { info = (await api.get('/api/trial')) || { trial: false }; } catch { info = { trial: false }; }
  return info;
}

const longDate = (iso) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long' });
};

/** The bar across the top. Empty for a salon that has paid. */
export function trialBannerHtml() {
  if (!info.trial) return '';
  const cta = !inApp() && info.keep_url
    ? `<a class="btn primary trial-cta" href="${esc(info.keep_url)}">Choose a plan</a>` : '';
  if (info.ended) {
    return `<div class="trial-bar ended" role="status">${icon('lock', 15)}
      <span><b>Your free trial has ended.</b> Your account is paused${info.deletes_at ? ` and will be deleted on ${esc(longDate(info.deletes_at))}` : ''}. Choose a plan to keep everything you've set up.</span>${cta}</div>`;
  }
  const n = info.days_left;
  const tone = n <= 1 ? 'last' : n <= 3 ? 'soon' : '';
  const left = n <= 1 ? 'Last day of your free trial' : `${n} days left in your free trial`;
  return `<div class="trial-bar ${tone}" role="status">${icon('clock', 15)}
    <span><b>${esc(left)}.</b> ${n <= 3 ? 'Choose a plan and everything you have set up stays exactly as it is.' : 'Everything you set up now is yours to keep.'}</span>${cta}</div>`;
}

/** A make-believe exchange, so the owner sees what Kai is like without it running. */
const KAI_EXAMPLE = [
  ['me', 'Book Jane in for a cut and colour on Friday at 2'],
  ['kai', 'Done. Jane Smith, Friday 2:00 pm with Maya, cut and colour, 2 hours. I sent her a confirmation.'],
  ['me', "Who hasn't been in for two months?"],
  ['kai', '6 regulars. Want me to send them a "we miss you" message with your next free times?'],
];

/** The card for a locked feature. */
export function showLock(feature) {
  const lock = info.locks?.[feature];
  if (!lock) return;
  const example = feature === 'kai' ? `<div class="trial-kai">${KAI_EXAMPLE.map(([who, t]) =>
    `<div class="tk-${who}">${esc(t)}</div>`).join('')}</div>` : '';
  const footer = inApp()
    ? '<button class="btn" data-close-lock>OK</button>'
    : `<button class="btn" data-close-lock>Not now</button>${info.keep_url ? `<a class="btn primary" href="${esc(info.keep_url)}">See the plans</a>` : ''}`;
  const m = openModal({
    title: lock.title,
    body: `<div class="trial-lock">${icon('lock', 18)}<span>${inApp() ? 'Not included in the free trial.' : 'Comes with Kairo when you choose a plan.'}</span></div>
      <p class="trial-lock-body">${esc(lock.body)}</p>${example}
      ${inApp() ? '' : '<p class="trial-lock-small">Pay once, then nothing to pay, ever. Everything you have set up in your trial stays.</p>'}`,
    footer,
  });
  m.querySelector('[data-close-lock]')?.addEventListener('click', () => m.close());
}

/** True (and shows the card) if this feature is locked right now. */
export function guardLocked(feature) {
  if (!info.trial) return false;
  showLock(feature);
  return true;
}

// Any request the server refused as locked shows the same card, wherever it
// came from, so no screen needs to know which of its buttons are locked.
if (typeof window !== 'undefined') {
  window.addEventListener('kairo:locked', (e) => { if (info.trial) showLock(e.detail); });
}
