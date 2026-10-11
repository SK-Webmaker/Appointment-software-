// A walk round the place, once.
//
// The wizard collects settings. It does not teach anybody where anything is —
// and the owner it hands over to has usually never used booking software, only
// a paper diary and their phone. Left to work it out, they find the calendar
// and nothing else, and six months later are still writing clients in a book.
//
// So: a guided lap of every area, pointing at the real thing on the real page
// rather than showing pictures of it — one sentence or two each, because the
// point is "this is where that lives", not a manual.
//
// Rules, because a tour that traps someone is worse than no tour:
//   - SKIP IS ALWAYS THERE, on every step, in the same place. So is Back.
//   - A step whose target isn't on the page is silently dropped rather than
//     pointing at nothing.
//   - On a phone the menu is a drawer, off the side of the screen. The tour
//     opens it for the steps that live in it and closes it again after — the
//     first version pointed at links that were off-screen.
//   - It runs once. Finished or skipped, it does not come back uninvited.
import { icon, esc } from './ui.js';

const nav = (key) => `.sidebar [data-nav="${key}"]`;

export const STEPS = [
  { sel: nav('dashboard'), group: 'Every day', title: 'Dashboard — your day at a glance',
    body: "Who's in today, what's next and what you've taken. Your setup list sits here until everything is ticked." },
  { sel: nav('calendar'), group: 'Every day', title: 'Calendar — your day book',
    body: 'Tap an empty time to book someone in. Drag an appointment to move it, and Kairo asks whether to tell the client. Block out lunch or a day off here too.' },
  { sel: nav('pos'), group: 'Every day', title: 'Point of Sale — take payment',
    body: 'Ring up services and products at the counter, by card or cash. Each sale links to its appointment and emails the receipt.' },
  { sel: nav('clients'), group: 'Your business', title: 'Clients — everyone who has been in',
    body: 'Built as people book. Notes, formulas and allergies you keep here show on their next appointment.' },
  { sel: nav('services'), group: 'Your business', title: 'Services — your menu',
    body: 'What you offer, what it costs and how long it takes. This is exactly what clients see on your booking page.' },
  { sel: nav('products'), group: 'Your business', title: 'Products — what you sell',
    body: 'Retail stock with prices and counts. Sell through Point of Sale and the count goes down by itself.' },
  { sel: nav('invoices'), group: 'Your business', title: 'Billing — invoices and payments',
    body: 'Every invoice, deposit and payment in one list, so you can see at a glance who still owes.' },
  { sel: nav('messages'), group: 'Keeping in touch', title: 'Messages — sent for you',
    body: 'Confirmations, reminders, receipts and review requests already go out by email. Every one is listed here. Texts can be added any time — there is a one-minute video in Settings → Messages.' },
  { sel: nav('reviews'), group: 'Keeping in touch', title: 'Reviews — what clients say',
    body: 'After a visit, clients are asked how it went. Happy ones get a one-tap link to post it on Google.' },
  { sel: nav('growth'), group: 'Keeping in touch', title: 'Growth — where new clients come from',
    body: 'Referrals, your Google profile and a short plan of what to do next, in numbers you can check.' },
  { sel: nav('staff'), group: 'Running it', title: 'Team — the people who work with you',
    body: 'Add staff, their hours and what they do. Each person can have their own sign-in.' },
  { sel: nav('settings'), group: 'Running it', title: 'Settings — how Kairo works for you',
    body: 'Your business, booking rules, messages, payments and policies, in seven sections with a search. Your booking link is under Online booking.' },
  { sel: nav('account'), group: 'Running it', title: 'Account — your plan and your data',
    body: 'Your subscription, your password, and a full copy of your data whenever you want it.' },
  { sel: nav('help'), group: 'Running it', title: 'Help — never stuck for long',
    body: 'Step-by-step guides for every part of Kairo, and a real person at Kairo by email.' },
  { sel: '.sidebar .nav a[href="/book"]', group: 'Out in the world', title: 'Your booking page',
    body: 'What your clients see. Put its link in your Instagram bio and Google profile, and people book themselves, even at midnight.' },
  { sel: '#kai-btn', drawer: false, group: 'Out in the world', title: 'Ask Kai',
    body: 'Type what you need in plain words — "book Jane in Friday at 2", "show me next week" — and Kai does it.' },
  { sel: '#quick-new', drawer: false, group: 'You are ready', title: 'New appointment, always here',
    body: 'Book someone in whenever you are ready. Nothing you do here can break anything, and Help is always one tap away.',
    last: true },
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
  const app = document.querySelector('.app');
  // Is the menu a drawer here (a phone or a small tablet)?
  const drawer = () => getComputedStyle(document.querySelector('.sidebar') || document.body).position === 'fixed';
  const steps = STEPS.filter((s) => document.querySelector(s.sel));
  if (!steps.length) { markSeen(); return; }

  let i = 0;
  const layer = document.createElement('div');
  layer.className = 'tour-layer';
  layer.innerHTML = '<div class="tour-hole"></div><div class="tour-pop" role="dialog" aria-live="polite"></div>';
  document.body.appendChild(layer);
  const hole = layer.querySelector('.tour-hole');
  const pop = layer.querySelector('.tour-pop');
  let wait = null;

  const setDrawer = (open) => {
    if (!app || !drawer()) return false;
    const was = app.classList.contains('nav-open');
    app.classList.toggle('nav-open', open);
    return was !== open;
  };
  const end = () => {
    markSeen();
    clearTimeout(wait);
    setDrawer(false);
    layer.remove();
    window.removeEventListener('resize', place);
    document.removeEventListener('keydown', onKey);
  };
  const onKey = (e) => {
    if (e.key === 'Escape') end();
    if (e.key === 'ArrowRight' || e.key === 'Enter') { e.preventDefault(); next(); }
    if (e.key === 'ArrowLeft') back();
  };
  const next = () => { if (i >= steps.length - 1) end(); else { i++; go(); } };
  const back = () => { if (i > 0) { i--; go(); } };

  // Open or close the phone's menu for this step, and let it slide before
  // measuring where the target is.
  function go() {
    clearTimeout(wait);
    const moved = setDrawer(steps[i].drawer !== false);
    if (moved) {
      layer.classList.add('moving');
      wait = setTimeout(() => { layer.classList.remove('moving'); place(); }, 280);
    } else place();
  }

  function place() {
    const step = steps[i];
    const el = document.querySelector(step.sel);
    if (!el) { next(); return; }
    el.scrollIntoView({ block: 'nearest', behavior: 'auto' });
    const r = el.getBoundingClientRect();
    const pad = 5;
    Object.assign(hole.style, {
      top: `${r.top - pad}px`, left: `${r.left - pad}px`,
      width: `${r.width + pad * 2}px`, height: `${r.height + pad * 2}px`,
    });

    pop.innerHTML = `
      <div class="tp-bar"><i style="width:${((i + 1) / steps.length) * 100}%"></i></div>
      <div class="tp-step">${esc(step.group)}<span>${i + 1} of ${steps.length}</span></div>
      <div class="tp-title">${esc(step.title)}</div>
      <div class="tp-body">${esc(step.body)}</div>
      <div class="tp-foot">
        <button type="button" class="btn ghost" data-skip>${step.last ? 'Close' : 'Skip tour'}</button>
        ${i > 0 ? `<button type="button" class="btn ghost" data-back>${icon('chevL', 14)} Back</button>` : ''}
        <button type="button" class="btn primary" data-next>
          ${step.last ? `${icon('check', 14)} Start using Kairo` : `Next ${icon('chevR', 14)}`}</button>
      </div>`;

    // Beside the target when it is in the menu and there is room, else below
    // it, else above — and never off the side of a phone.
    const vw = window.innerWidth, vh = window.innerHeight;
    const popW = Math.min(340, vw - 24);
    pop.style.width = `${popW}px`;
    const h = pop.offsetHeight;
    const inMenu = Boolean(el.closest('.sidebar'));
    let top, left;
    if (inMenu && r.right + 16 + popW < vw - 12) {
      left = r.right + 16;
      top = Math.min(Math.max(12, r.top + r.height / 2 - h / 2), vh - h - 12);
    } else {
      const below = r.bottom + 14;
      top = below + h < vh - 12 ? below : Math.max(12, r.top - h - 14);
      left = Math.min(Math.max(12, r.left), vw - popW - 12);
    }
    pop.style.top = `${top}px`;
    pop.style.left = `${left}px`;

    pop.querySelector('[data-skip]').onclick = end;
    pop.querySelector('[data-next]').onclick = next;
    const b = pop.querySelector('[data-back]');
    if (b) b.onclick = back;
  }

  window.addEventListener('resize', place);
  document.addEventListener('keydown', onKey);
  go();
}

/** Has the owner already been round? Used to label the Settings button. */
export const tourSeen = seen;
