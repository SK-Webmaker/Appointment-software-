// The client's side of a consultation-first booking.
//
// They have already spoken to the salon — in a DM, on the phone, across the
// counter. This page is the last step: here is what we agreed, here is what it
// costs, pay and you are in the book.
//
// Two things shape every screen below.
//
// First, it is opened on a phone, from a message, by somebody who has never
// seen Kairo and never will again. So it asks for the least it can (a name and
// one way to reach them), it never explains itself twice, and the button that
// moves them forward is always the obvious one.
//
// Second, under the `link` payment route Kairo genuinely cannot see the money.
// A Stripe Payment Link or a PayPal.me address reports nothing back. Two
// things follow, and they are the whole design of the pay screen:
//
//   "I have paid" cannot be tapped until they have opened the payment page.
//   Not as a nicety — the open is recorded server-side and the tick is refused
//   without it. It does not prove they paid; nothing can. It rules out the
//   client who lands here, ignores the payment and ticks the box to get their
//   slot confirmed.
//
//   What the page says afterwards depends on who the salon asked to confirm.
//   Under 'auto' the booking is made and it says so. Under 'owner' the salon
//   checks its own account first, and the page says the slot is held and NOT
//   yet booked — because that is what is true, and a client who leaves here
//   believing they have an appointment they do not have is the single worst
//   outcome this page can produce.
import { esc, icon, fmtDate, fmtTime } from './ui.js';
import { resolveScheme, applyScheme } from './schemes.js';
import { lockZoom } from './nozoom.js';

const root = document.getElementById('invite');
const token = decodeURIComponent(location.pathname.replace(/^\/invite\/?/, ''));

async function getJson(url, opts) {
  const res = await fetch(url, opts);
  // Read as text then parse, so a 200 whose body was cut off mid-stream is a
  // failure we can name rather than an empty object that travels into the page
  // and surfaces later as "cannot read properties of undefined".
  const text = await res.text().catch(() => '');
  let data = {};
  let unreadable = !text;
  if (text) {
    try { data = JSON.parse(text); } catch { unreadable = true; }
  }
  if (!res.ok) throw new Error(data.error || 'Something went wrong');
  if (unreadable) throw new Error('The reply was cut short — please try again.');
  return data;
}

function applyBrand(brand) {
  if (!brand) return;
  const el = document.documentElement;
  applyScheme(resolveScheme(brand));
  if (brand.font && brand.font !== 'modern') el.dataset.brandFont = brand.font;
  const accent = /^#[0-9a-fA-F]{6}$/.test(brand.accent || '') ? brand.accent : '#38bdf8';
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(accent.slice(i, i + 2), 16));
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  el.style.setProperty('--accent', accent);
  el.style.setProperty('--accent-ink', luminance > 0.56 ? '#0b1220' : '#ffffff');
  el.style.setProperty('--accent-fill', accent);
  el.style.setProperty('--accent-hover', `color-mix(in srgb, ${accent} 86%, #fff)`);
}

const money = (cents, symbol) => `${symbol || '$'}${(Math.max(0, cents) / 100).toFixed(2)}`;

const headHtml = (inv) => `
  <div class="cx-head">
    ${inv.brand?.logo ? `<img class="brand-logo" src="${esc(inv.brand.logo)}" alt="${esc(inv.business?.name || '')}">` : ''}
    <h1>${esc(inv.business?.name || 'Your booking')}</h1>
    ${inv.business?.phone ? `<div class="sub">${esc(inv.business.phone)}</div>` : ''}
  </div>`;

const detailsHtml = (inv) => `
  <dl class="cx-details">
    <div class="cx-row"><dt>Service</dt>
      <dd>${esc(inv.services.map((s) => s.name).join(' + ') || 'Appointment')}</dd></div>
    ${inv.staff_name ? `<div class="cx-row"><dt>With</dt><dd>${esc(inv.staff_name)}</dd></div>` : ''}
    <div class="cx-row"><dt>When</dt>
      <dd>${esc(fmtDate(inv.date))} · ${esc(fmtTime(inv.start_min))}</dd></div>
    ${inv.price_cents > 0
      ? `<div class="cx-row"><dt>Price</dt><dd>${esc(money(inv.price_cents, inv.currency))}</dd></div>`
      : ''}
  </dl>
  ${inv.note ? `<div class="cx-callout">${esc(inv.note)}</div>` : ''}`;

const poweredHtml = () => '<div class="powered">Powered by <b>Kairo</b></div>';

function shell(inv, inner) {
  root.innerHTML = `${headHtml(inv)}<div class="cx-card">${inner}</div>${poweredHtml()}`;
}

function renderError(message) {
  root.innerHTML = `
    <div class="cx-card">
      <div class="cx-mark warn">${icon('alert', 26)}</div>
      <h2>This link isn't active</h2>
      <div class="lede">${esc(message)}</div>
    </div>${poweredHtml()}`;
}

/**
 * Dead ends, said plainly.
 *
 * A client who taps an expired link deserves to know it expired, and to be told
 * how to get another one — not to be left looking at an error.
 */
function renderClosed(inv, status) {
  const lines = {
    expired: ['This link has expired', 'It was held for a while and then released. Message us and we\'ll send a new one.'],
    cancelled: ['This link has been withdrawn', 'The time is no longer being held. Message us and we\'ll sort out another.'],
    declined: ['You turned this one down', 'The time has been released. If that was a mistake, just message us.'],
  };
  const [title, lede] = lines[status] || lines.cancelled;
  shell(inv, `
    <div class="cx-mark warn">${icon('clock', 26)}</div>
    <h2>${esc(title)}</h2>
    <div class="lede">${esc(lede)}</div>
    ${detailsHtml(inv)}
    ${inv.business?.phone
      ? `<div class="cx-note">Call us on <span class="cx-phone">${esc(inv.business.phone)}</span>.</div>` : ''}`);
}

/** Booked, and genuinely booked — an appointment exists behind this screen. */
function renderBooked(inv) {
  shell(inv, `
    <div class="cx-mark done">${icon('check', 28)}</div>
    <h2>You're booked in</h2>
    <div class="lede">That's confirmed. We've sent it to you in writing, and you'll get a
      reminder before the day.</div>
    ${detailsHtml(inv)}
    ${inv.business?.phone
      ? `<div class="cx-note">Need to change it? Call us on <span class="cx-phone">${esc(inv.business.phone)}</span>.</div>` : ''}`);
}

/**
 * Paid, but under a payment link — so the salon has to look.
 *
 * Every word here is chosen to stop somebody walking away thinking they have an
 * appointment. The slot IS being held, which is the reassuring part and is
 * true; the booking is not yet made, which is the important part and is also
 * true.
 */
function renderAwaiting(inv) {
  shell(inv, `
    <div class="cx-mark warn">${icon('clock', 26)}</div>
    <h2>Thanks — we're checking your payment</h2>
    <div class="lede">Your time is being held. We confirm payments by hand, so you'll get a
      confirmation from us shortly — <b>this isn't booked until then</b>.</div>
    ${detailsHtml(inv)}
    ${inv.business?.phone
      ? `<div class="cx-note">Heard nothing? Call us on <span class="cx-phone">${esc(inv.business.phone)}</span>.</div>` : ''}`);
}

/** Step one: who are you. Nothing is booked and nothing is charged here. */
function renderClaim(inv) {
  shell(inv, `
    <h2>Your appointment</h2>
    <div class="lede">We've held this time for you. Pop your details in to confirm it's yours.</div>
    ${detailsHtml(inv)}
    <form class="iv-form" id="iv-claim" novalidate>
      <div class="iv-field">
        <label for="iv-name">Your name</label>
        <input id="iv-name" name="name" autocomplete="name" required value="${esc(inv.client_name || '')}">
      </div>
      <div class="iv-field">
        <label for="iv-email">Email</label>
        <input id="iv-email" name="email" type="email" autocomplete="email"
               inputmode="email" value="${esc(inv.client_email || '')}">
      </div>
      <div class="iv-field">
        <label for="iv-phone">Mobile</label>
        <input id="iv-phone" name="phone" type="tel" autocomplete="tel"
               inputmode="tel" value="${esc(inv.client_phone || '')}">
      </div>
      <div class="iv-err" id="iv-err"></div>
      <button class="cx-btn brand" type="submit">${icon('check', 16)} That's me</button>
    </form>
    <div class="cx-note">One of email or mobile is enough — it's where your confirmation goes.</div>
    ${expiryNote(inv)}
    <div class="cx-actions" style="margin-top:14px">
      <button class="cx-btn quiet danger-text" type="button" id="iv-decline">I can't make this time</button>
    </div>`);

  root.querySelector('#iv-claim').addEventListener('submit', async (e) => {
    e.preventDefault();
    const err = root.querySelector('#iv-err');
    const btn = e.target.querySelector('button[type=submit]');
    err.textContent = '';
    btn.disabled = true;
    const fd = new FormData(e.target);
    try {
      const out = await getJson('/api/public/invite/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          name: String(fd.get('name') || '').trim(),
          email: String(fd.get('email') || '').trim(),
          phone: String(fd.get('phone') || '').trim(),
        }),
      });
      render(out.invite);
    } catch (e2) {
      err.textContent = e2.message;
      btn.disabled = false;
    }
  });

  root.querySelector('#iv-decline').addEventListener('click', async (e) => {
    e.target.disabled = true;
    try {
      await getJson('/api/public/invite/decline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      renderClosed(inv, 'declined');
    } catch (e2) {
      e.target.disabled = false;
      root.querySelector('#iv-err').textContent = e2.message;
    }
  });
}

function expiryNote(inv) {
  if (!inv.expires_at) return '';
  const when = new Date(inv.expires_at.replace(' ', 'T') + 'Z');
  if (Number.isNaN(when.getTime())) return '';
  return `<div class="iv-expiry">We'll hold this time until ${esc(
    when.toLocaleString(undefined, { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })
  )}.</div>`;
}

/** Step two: pay. Which of the three routes is decided by the salon. */
function renderPay(inv) {
  const route = inv.pay?.route || 'none';
  if (route === 'none') return renderAcceptOnly(inv);
  if (route === 'checkout') return renderCheckout(inv);
  return renderPayLink(inv);
}

/** No payment wanted: accepting is the whole of it. */
function renderAcceptOnly(inv) {
  shell(inv, `
    <h2>One tap and it's yours</h2>
    <div class="lede">Nothing to pay now, ${esc(firstName(inv))} — we'll settle up on the day.</div>
    ${detailsHtml(inv)}
    <div class="iv-err" id="iv-err"></div>
    <div class="cx-actions">
      <button class="cx-btn brand" id="iv-accept">${icon('check', 16)} Confirm my booking</button>
    </div>
    ${expiryNote(inv)}`);
  wire('#iv-accept', '/api/public/invite/accept', {}, (out) => render(out.invite));
}

/** A real hosted checkout. Kairo asks the provider afterwards, so this is exact. */
function renderCheckout(inv) {
  const returning = new URLSearchParams(location.search).get('paid');
  shell(inv, `
    <h2>Pay to confirm</h2>
    <div class="lede">Last step, ${esc(firstName(inv))}. Once this goes through you're in the book.</div>
    <div class="iv-price">${esc(money(inv.price_cents, inv.currency))}
      <small>${esc(inv.services.map((s) => s.name).join(' + '))}</small></div>
    ${detailsHtml(inv)}
    <div class="iv-err" id="iv-err">${returning ? 'That payment hasn\'t come through yet — try again.' : ''}</div>
    <div class="cx-actions">
      <button class="cx-btn brand" id="iv-checkout">${icon('dollar', 16)} Pay ${esc(money(inv.price_cents, inv.currency))}</button>
    </div>
    ${expiryNote(inv)}`);

  root.querySelector('#iv-checkout').addEventListener('click', async (e) => {
    e.target.disabled = true;
    try {
      const out = await getJson('/api/public/invite/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, origin: location.origin }),
      });
      location.href = out.url;
    } catch (e2) {
      root.querySelector('#iv-err').textContent = e2.message;
      e.target.disabled = false;
    }
  });
}

/**
 * The salon's own payment link.
 *
 * Numbered, because this is the one route with a step the client has to do
 * somewhere else and then come back from. An unnumbered version of this screen
 * loses people between the two taps.
 */
function renderPayLink(inv) {
  const link = inv.pay?.link || '';
  const opened = Boolean(inv.pay?.opened);
  shell(inv, `
    <h2>Pay to confirm</h2>
    <div class="lede">Two quick steps, ${esc(firstName(inv))}, and your time is locked in.</div>
    <div class="iv-price">${esc(money(inv.price_cents, inv.currency))}
      <small>${esc(inv.services.map((s) => s.name).join(' + '))}</small></div>
    ${detailsHtml(inv)}
    <div class="iv-steps">
      <div class="iv-step ${opened ? 'done' : ''}"><span class="iv-num">${opened ? '✓' : '1'}</span>
        <span>Pay using the button below. It opens the payment page in a new tab.</span></div>
      <div class="iv-step ${opened ? '' : 'later'}"><span class="iv-num">2</span>
        <span>Come back here and confirm, and your booking is made.</span></div>
    </div>
    <div class="iv-err" id="iv-err"></div>
    <div class="cx-actions">
      <a class="cx-btn brand" id="iv-open" href="${esc(link)}" target="_blank" rel="noopener noreferrer">
        ${icon('dollar', 16)} Pay ${esc(money(inv.price_cents, inv.currency))}</a>
      <button class="cx-btn quiet" id="iv-paid" ${opened ? '' : 'disabled'}>
        ${icon('check', 16)} I've paid — confirm my booking</button>
    </div>
    ${opened
    ? ''
    : '<div class="cx-note" id="iv-gate">Open the payment page first — this unlocks once you have.</div>'}
    ${expiryNote(inv)}`);

  // Tapping Pay is what unlocks the second step, and it is recorded on the
  // server rather than in this page: a disabled button is a suggestion, not a
  // gate. The link still opens either way — a failure here must never stand
  // between somebody and paying the salon.
  const payBtn = root.querySelector('#iv-open');
  payBtn?.addEventListener('click', async () => {
    try {
      const out = await getJson('/api/public/invite/opened', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      // Unlock in place rather than redrawing: they are mid-tap, and swapping
      // the page under them would lose the new tab they just opened.
      const paid = root.querySelector('#iv-paid');
      if (paid) paid.disabled = false;
      root.querySelector('#iv-gate')?.remove();
      root.querySelector('.iv-step')?.classList.add('done');
      root.querySelector('.iv-step .iv-num')?.replaceChildren('✓');
      root.querySelectorAll('.iv-step')[1]?.classList.remove('later');
      inv.pay = { ...inv.pay, opened: true, confirm_by: out.invite?.pay?.confirm_by };
    } catch { /* the payment page is open; unlocking can wait for a reload */ }
  });

  wire('#iv-paid', '/api/public/invite/declare-paid', {}, (out) => render(out.invite));
}

const firstName = (inv) => String(inv.client_name || '').trim().split(/\s+/)[0] || 'there';

/** One POST behind one button, with the button disabled while it is in flight. */
function wire(selector, url, extra, onOk) {
  const el = root.querySelector(selector);
  if (!el) return;
  el.addEventListener('click', async () => {
    el.disabled = true;
    const err = root.querySelector('#iv-err');
    if (err) err.textContent = '';
    try {
      onOk(await getJson(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, ...extra }),
      }));
    } catch (e) {
      if (err) err.textContent = e.message;
      el.disabled = false;
    }
  });
}

/** Which screen this invite is on. The status is the whole of the decision. */
function render(inv) {
  applyBrand(inv.brand);
  if (inv.status === 'confirmed') return renderBooked(inv);
  if (['expired', 'cancelled', 'declined'].includes(inv.status)) return renderClosed(inv, inv.status);
  if (inv.status === 'paid') return renderAwaiting(inv);
  if (!inv.client_name) return renderClaim(inv);
  return renderPay(inv);
}

/**
 * Back from a hosted checkout.
 *
 * Verified with the provider before anything is drawn, because a client who
 * edits "?paid=1" into the address bar has told us nothing at all.
 */
async function settleCheckoutReturn() {
  const q = new URLSearchParams(location.search);
  const sessionId = q.get('session_id') || '';
  if (q.get('paid') !== 'success') return null;
  try {
    const out = await getJson('/api/public/invite/paid', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, session_id: sessionId }),
    });
    return out.invite;
  } catch {
    // Not paid, or not ours. Fall through to a normal load, which puts them
    // back on the pay screen with the error showing.
    return null;
  }
}

async function start() {
  lockZoom();
  if (!token) return renderError('That link is incomplete. Please use the whole link we sent you.');
  try {
    const settled = await settleCheckoutReturn();
    if (settled) return render(settled);
    const out = await getJson(`/api/public/invite?token=${encodeURIComponent(token)}`);
    render(out.invite);
  } catch (e) {
    renderError(e.message);
  }
  return undefined;
}

start();
