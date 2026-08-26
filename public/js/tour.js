// A walk round the place, once.
//
// The wizard collects settings. It does not teach anybody where anything is —
// and the owner it hands over to has usually never used booking software, only
// a paper diary and their phone. Left to work it out, they find the calendar
// and nothing else, and six months later are still writing clients in a book.
//
// So: a short guided lap of the handful of screens that matter, pointing at the
// real thing on the real page rather than showing pictures of it.
//
// Rules, because a tour that traps someone is worse than no tour:
//   - SKIP IS ALWAYS THERE, on every step, in the same place.
//   - A step whose target isn't on the page is silently dropped rather than
//     pointing at nothing. Screens differ (a phone has no sidebar), and a tour
//     that highlights empty space reads as broken software.
//   - It runs once. Finished or skipped, it does not come back uninvited.
import { icon, esc } from './ui.js';

const STEPS = [
  {
    sel: '#nav-dashboard, [href="#/dashboard"]',
    title: 'This is home',
    body: 'Everything you need first thing: who is in today, what is next, what you have taken. '
      + 'Scroll to the bottom and Kairo tells you where you are losing money and what to do about it.',
  },
  {
    sel: '[href="#/calendar"]',
    title: 'Your day book',
    body: 'Tap any empty space to book somebody in. Drag an appointment to move it — Kairo asks whether '
      + 'to tell the client, and how. This replaces the paper diary entirely.',
  },
  {
    sel: '[href="#/clients"]',
    title: 'Everyone who has ever been in',
    body: 'Built automatically as people book. Notes you keep here — colour formula, allergies, how they '
      + 'like it — show up on their appointment so nothing gets forgotten.',
  },
  {
    sel: '[href="#/services"]',
    title: 'What you offer, and what it costs',
    body: 'Your prices and how long each thing takes. This is what customers see on your booking page, '
      + 'and what Kairo uses to work out your day.',
  },
  {
    sel: '[href="#/pos"]',
    title: 'Taking the money',
    body: 'Ring up a sale at the counter — services, products, cash or card. It links back to the '
      + 'appointment, so your takings add up without you doing anything.',
  },
  {
    sel: '[data-tour="booking-link"], [href="#/settings"]',
    title: 'Your booking link',
    body: 'In Settings you will find one link that never changes. Put it in your Instagram bio and your '
      + 'Google profile. Customers book themselves, at midnight, without ringing you.',
  },
  {
    sel: '#qa-new, .ph-actions .btn.primary',
    title: 'And that is the lot',
    body: 'Book someone in whenever you are ready. Nothing you do here can break anything — and if you '
      + 'get stuck, everything has a plain-English explanation under it.',
    last: true,
  },
];

const seen = () => {
  try { return localStorage.getItem('kairo_tour_done') === '1'; } catch { return false; }
};
const markSeen = () => {
  try { localStorage.setItem('kairo_tour_done', '1'); } catch { /* private window — the tour just repeats */ }
};

/**
 * @param {boolean} force  run it even if it has been seen (the Settings button).
 */
export function runTour({ force = false } = {}) {
  if (seen() && !force) return;
  // Only steps whose target actually exists on this screen. On a phone the
  // sidebar is collapsed, so this quietly becomes a shorter tour rather than a
  // broken one.
  const steps = STEPS.filter((s) => document.querySelector(s.sel));
  if (!steps.length) { markSeen(); return; }

  let i = 0;
  const layer = document.createElement('div');
  layer.className = 'tour-layer';
  layer.innerHTML = '<div class="tour-hole"></div><div class="tour-pop"></div>';
  document.body.appendChild(layer);
  const hole = layer.querySelector('.tour-hole');
  const pop = layer.querySelector('.tour-pop');

  const end = () => {
    markSeen();
    layer.remove();
    window.removeEventListener('resize', place);
    document.removeEventListener('keydown', onKey);
  };
  const onKey = (e) => {
    if (e.key === 'Escape') end();
    if (e.key === 'ArrowRight' || e.key === 'Enter') next();
  };
  const next = () => { if (i >= steps.length - 1) end(); else { i++; place(); } };

  function place() {
    const step = steps[i];
    const el = document.querySelector(step.sel);
    if (!el) { next(); return; }
    el.scrollIntoView({ block: 'center', behavior: 'auto' });
    const r = el.getBoundingClientRect();
    const pad = 6;
    Object.assign(hole.style, {
      top: `${r.top - pad}px`, left: `${r.left - pad}px`,
      width: `${r.width + pad * 2}px`, height: `${r.height + pad * 2}px`,
    });

    pop.innerHTML = `
      <div class="tp-step">${i + 1} of ${steps.length}</div>
      <div class="tp-title">${esc(step.title)}</div>
      <div class="tp-body">${esc(step.body)}</div>
      <div class="tp-foot">
        <button type="button" class="btn ghost" data-skip>${step.last ? 'Close' : 'Skip the tour'}</button>
        <button type="button" class="btn primary" data-next>
          ${step.last ? `${icon('check', 14)} Got it` : `Next ${icon('chevR', 14)}`}</button>
      </div>`;

    // Below the target where there's room, above it where there isn't — and
    // never off the side of a phone.
    const popW = Math.min(330, window.innerWidth - 24);
    pop.style.width = `${popW}px`;
    const below = r.bottom + 14;
    const fitsBelow = below + pop.offsetHeight < window.innerHeight - 12;
    pop.style.top = fitsBelow ? `${below}px` : `${Math.max(12, r.top - pop.offsetHeight - 14)}px`;
    pop.style.left = `${Math.min(Math.max(12, r.left), window.innerWidth - popW - 12)}px`;

    pop.querySelector('[data-skip]').onclick = end;
    pop.querySelector('[data-next]').onclick = next;
  }

  window.addEventListener('resize', place);
  document.addEventListener('keydown', onKey);
  place();
}

/** Has the owner already been round? Used to label the Settings button. */
export const tourSeen = seen;
