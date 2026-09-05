// Public booking flow: service → staff → date & time → details → confirmed.
import { esc, icon, money, priceLabel, fmtTime, fmtDate, setCurrency, todayStr, addDaysStr, parseDate } from './ui.js';
import { resolveScheme, applyScheme } from './schemes.js';
import { lockZoom } from './nozoom.js';

const root = document.getElementById('book');
// state.services is the "cart" — one or more chosen services, booked back-to-
// back with the same team member for one combined appointment.
const state = {
  info: null, location: null, services: [], staff: null, date: todayStr(), slot: null, step: 1,
  // A slot this visitor was sent here for, waiting to be matched against what
  // is actually free. Cleared the moment the times step has dealt with it, so
  // changing date doesn't keep re-announcing an offer they have moved on from.
  pending: null,
  // True when they arrived from "change the time" on an existing booking.
  moving: false,
  // Who sent them, when they arrived on somebody's referral link.
  referral: null,
  // A patch-test slot they picked after the gate asked for one, carried into
  // the retry so the test and the treatment are booked in one go.
  patch: null,
};

// --- multi-service cart helpers -------------------------------------------
const cartIds = () => state.services.map((s) => s.id);
const cartDuration = () => state.services.reduce((sum, s) => sum + s.duration_min, 0);
const cartTotalCents = () => state.services.reduce((sum, s) => sum + (s.price_cents || 0), 0);
const cartHasFrom = () => state.services.some((s) => s.price_type === 'from');
function cartPriceLabel() {
  if (!state.services.length) return '';
  if (state.services.every((s) => s.price_type === 'free')) return 'Free';
  return `${cartHasFrom() ? 'From ' : ''}${money(cartTotalCents())}`;
}
function cartLabel() {
  if (state.services.length === 1) return state.services[0].name;
  return `${state.services.length} services`;
}

async function getJson(url, opts) {
  const res = await fetch(url, opts);
  // Read as text, then parse. Going straight to res.json() and falling back to
  // {} turns a 200 whose body was cut off — a dropped connection, a proxy
  // giving up mid-stream — into an empty object, which then travels into the
  // page and surfaces as "cannot read properties of undefined" on some
  // unrelated line. A customer sees a blank screen and blames the salon. A
  // reply that arrived and would not parse is a failure, and saying so here is
  // the difference between "try again" and nothing at all.
  const text = await res.text().catch(() => '');
  let data = {};
  // Nothing arriving is the same failure as something arriving half-written:
  // every reply this API sends has a JSON body, so an empty one means the
  // transfer was cut off.
  let unreadable = !text;
  if (text) {
    try { data = JSON.parse(text); } catch { unreadable = true; }
  }
  if (!res.ok) {
    const err = new Error(data.error || 'Something went wrong');
    // The body of a refusal, kept rather than thrown away. A booking that needs
    // a patch test or a consent is refused with everything the page needs to
    // offer that in the same flow — and "you need a patch test" with nothing
    // behind it is just a locked door.
    err.status = res.status;
    err.data = data;
    throw err;
  }
  if (unreadable) throw new Error('The reply was cut short — please try again.');
  return data;
}

function stepsHtml() {
  return `<div class="steps">${[1, 2, 3, 4].map((i) => `<div class="s ${state.step >= i ? 'done' : ''}"></div>`).join('')}</div>`;
}

function headHtml({ cover = false } = {}) {
  const b = state.info;
  const brand = b.brand || {};
  const isImg = (s) => typeof s === 'string' && s.startsWith('data:image/');
  const coverHtml = cover && isImg(brand.cover)
    ? `<img class="brand-cover" src="${esc(brand.cover)}" alt="${esc(b.business_name)}">` : '';
  const logo = isImg(brand.logo)
    ? `<img class="brand-logo" src="${esc(brand.logo)}" alt="${esc(b.business_name)} logo">` : '';
  return `
    ${coverHtml}
    <div class="book-head">
      ${logo}
      <h1>${esc(b.business_name)}</h1>
      <div class="sub">${esc(b.business_address || '')}${b.business_phone ? ` · ${esc(b.business_phone)}` : ''}</div>
      ${brand.tagline ? `<div class="brand-tagline">${esc(brand.tagline)}</div>` : ''}
    </div>`;
}

/** Apply the business's chosen colour scheme, accent, font — set in Settings → Booking page. */
function applyBrand(brand) {
  if (!brand) return;
  const root = document.documentElement;
  applyScheme(resolveScheme(brand)); // full palette (background, panels, text, borders)
  if (brand.font && brand.font !== 'modern') root.dataset.brandFont = brand.font;
  const accent = /^#[0-9a-fA-F]{6}$/.test(brand.accent || '') ? brand.accent : '#38bdf8';
  // readable text on the accent: white on dark accents, near-black on light ones
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(accent.slice(i, i + 2), 16));
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  root.style.setProperty('--accent', accent);
  root.style.setProperty('--accent-ink', luminance > 0.56 ? '#0b1220' : '#ffffff');
  // Filled surfaces take the brand colour flat. A gradient here would fight
  // whatever the business actually uses on its own signage.
  root.style.setProperty('--accent-fill', accent);
  root.style.setProperty('--accent-hover', `color-mix(in srgb, ${accent} 86%, #fff)`);
}

function poweredHtml() {
  return '<div class="powered">Powered by <b>◆ Kairo</b></div>';
}

// --- Turnstile -------------------------------------------------------------
// Cloudflare's stand-in for a CAPTCHA. Most visitors see a box that ticks
// itself and never has to be touched.
//
// The script is fetched only when the business has actually switched this on,
// so a salon that hasn't gets no third-party request from its booking page at
// all — which is also why there's no <script> tag in book.html.
//
// Everything here fails quietly. A blocked script, a widget that never solves,
// a customer on a network that can't reach Cloudflare — all of them end with an
// empty token and the booking still being attempted, because the server also
// lets bookings through when it can't reach Cloudflare. A lost booking costs
// the salon more than the spam it would have stopped.
const TURNSTILE_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
const ts = { script: null, widget: null, token: '', waiters: [] };

function loadTurnstileScript() {
  if (ts.script) return ts.script;
  ts.script = new Promise((resolve, reject) => {
    const el = document.createElement('script');
    el.src = TURNSTILE_SRC;
    el.async = true;
    el.onload = () => resolve(window.turnstile || null);
    el.onerror = () => reject(new Error('Turnstile script blocked'));
    document.head.appendChild(el);
  });
  return ts.script;
}

/** Hand the token to anything already waiting on it, and remember it. */
function settleTurnstile(token) {
  ts.token = token || '';
  ts.waiters.splice(0).forEach((w) => w(ts.token));
}

function mountTurnstile() {
  const host = root.querySelector('#bk-turnstile');
  if (!host || !state.info?.turnstile_site_key) return;
  ts.widget = null;
  settleTurnstile('');
  loadTurnstileScript().then((api) => {
    if (!api || !host.isConnected) return;
    ts.widget = api.render(host, {
      sitekey: state.info.turnstile_site_key,
      theme: resolveScheme(state.info.brand).mode === 'light' ? 'light' : 'dark',
      action: 'book',
      callback: settleTurnstile,
      // A token is good for five minutes. Someone who leaves the form open
      // longer than that should get a fresh one rather than a refusal.
      'expired-callback': () => { settleTurnstile(''); api.reset(ts.widget); },
      'error-callback': () => { settleTurnstile(''); return true; },
    });
  }).catch(() => { settleTurnstile(''); });
}

/**
 * The token, waiting a moment if the widget hasn't finished thinking.
 *
 * It normally solves within a second of appearing — long before anyone has
 * typed their phone number — but a fast typist shouldn't be told to complete a
 * check that is still running. Waiting beats refusing.
 */
function turnstileToken({ waitMs = 6000 } = {}) {
  if (!ts.widget) return Promise.resolve('');
  if (ts.token) return Promise.resolve(ts.token);
  return new Promise((resolve) => {
    const done = (token) => {
      clearTimeout(timer);
      ts.waiters = ts.waiters.filter((w) => w !== done);
      resolve(token || '');
    };
    const timer = setTimeout(() => done(''), waitMs);
    ts.waiters.push(done);
  });
}

/** Tokens are single-use, so a failed submit needs a fresh one before retrying. */
function resetTurnstile() {
  if (!ts.widget || !window.turnstile) return;
  settleTurnstile('');
  try { window.turnstile.reset(ts.widget); } catch { /* widget already gone */ }
}

/**
 * A way back when the phone refused to hand this page to the browser.
 *
 * The booking page carries no manifest of its own, so "running standalone"
 * here can only mean one thing: the owner tapped their booking link inside
 * Kairo's home-screen app and the OS kept it in the same window. There's no
 * address bar and no back button in that window, so without this bar the only
 * escape is force-quitting the app. Customers never see it.
 */
function addReturnBar() {
  const inApp = window.navigator.standalone === true
    || window.matchMedia?.('(display-mode: standalone)').matches === true;
  if (!inApp) return;
  const bar = document.createElement('a');
  bar.className = 'back-to-app';
  bar.href = '/';
  bar.innerHTML = `${icon('chevL', 15)} Back to Kairo`;
  document.body.appendChild(bar);
}

/**
 * The salon is being updated (a few minutes, announced in advance). Say so
 * once, at the top, instead of letting "Confirm" fail with a message nobody
 * expected. Inline style only: the CSP allows it and there is nothing to load.
 */
function showMaintenanceBar() {
  if (document.getElementById('book-maint')) return;
  const bar = document.createElement('div');
  bar.id = 'book-maint';
  bar.setAttribute('role', 'status');
  bar.style.cssText = 'position:sticky;top:0;z-index:50;padding:.75rem 1rem;background:#b45309;color:#fff;font:600 14px system-ui;text-align:center';
  bar.textContent = 'Bookings are paused for a few minutes while we update. You can look around — please try confirming again shortly.';
  document.body.prepend(bar);
}

async function boot() {
  addReturnBar();
  // "Book another / a different time" buttons — delegated so no inline
  // onclick is needed (keeps the page compatible with a strict script-src CSP).
  root.addEventListener('click', (e) => {
    if (e.target.closest('[data-book-again]')) location.href = '/book';
  });
  try {
    state.info = await getJson('/api/public/info');
    if (state.info.read_only) showMaintenanceBar();
    setCurrency(state.info.currency);
    applyBrand(state.info.brand);
    document.title = `Book with ${state.info.business_name}`;

    const params = new URLSearchParams(location.search);

    // Arrived from a message we sent? Remember which one, so the booking can be
    // credited to it. Held in sessionStorage rather than the URL because the
    // customer may take three days and several visits to decide, and the link
    // they came back on the second time is usually just the plain one.
    const cameFrom = params.get('m');
    if (cameFrom) {
      try { sessionStorage.setItem('kairo_from_message', cameFrom); } catch { /* private mode */ }
    }

    // Moving an existing appointment rather than making a new one. Held for the
    // whole session, because they may take three screens to settle on a time
    // and the old booking must still be released when they finally do.
    const moving = params.get('r');
    if (moving) {
      try { sessionStorage.setItem('kairo_reschedule', moving); } catch { /* private mode */ }
      state.moving = true;
    }

    // Sent by an existing client. Held for the session like the message token,
    // for the same reason: they may look, leave, and come back before booking.
    const ref = params.get('ref');
    if (ref) {
      try { sessionStorage.setItem('kairo_referral', ref); } catch { /* private mode */ }
    }
    try {
      const held = sessionStorage.getItem('kairo_referral');
      if (held) {
        const res = await getJson(`/api/public/referral?ref=${encodeURIComponent(held)}`);
        state.referral = res.referral || null;
      }
    } catch { state.referral = null; }

    // Returning from Stripe after a deposit?
    if (params.get('deposit') && params.get('appt')) {
      history.replaceState(null, '', '/book');
      await handleDepositReturn(params);
      return;
    }

    // Came from "2:30 on Thursday just came free"? Land on 2:30 on Thursday.
    const offer = await resolveOffer(params, cameFrom);
    history.replaceState(null, '', location.pathname);
    if (offer) { await openOnOffer(offer); return; }

    if (state.info.locations.length > 1) renderLocationStep();
    else renderServiceStep();
  } catch (err) {
    root.innerHTML = `<div class="empty" style="padding-top:80px">${icon('alert', 26)}<div>${esc(err.message)}</div></div>`;
  }
}

/**
 * The exact slot this visitor was sent here for, if there is one.
 *
 * Two ways in, and they are not equal. Query parameters are for a link the
 * owner pasted somewhere by hand — Instagram, a WhatsApp message — and are
 * checked here against what the salon actually offers, because anybody can type
 * anything into a URL. A message token is for the salon's own texts, where the
 * offer is a record on the server rather than a claim in the address bar, and
 * costs the salon nothing per character.
 *
 * Explicit parameters win when both are present: they are the more specific
 * instruction, and if they disagree with the message the person clicking is
 * looking at the parameters.
 *
 * Never throws. A link that cannot be honoured must open the ordinary booking
 * page, not an error — the client cannot tell the difference between "that slot
 * went" and "this salon's booking is broken", and will assume the second.
 */
async function resolveOffer(params, token) {
  const services = state.info.services || [];
  const byId = (id) => services.find((s) => s.id === Number(id));

  const wantIds = String(params.get('s') || '').split(',').map(Number).filter(Boolean);
  const picked = wantIds.map(byId).filter(Boolean);
  const date = params.get('d') || '';
  const startMin = Number(params.get('t'));
  // A date or a time that is PRESENT but unreadable means the link is malformed,
  // and the whole thing is discarded rather than half-honoured. Quietly dropping
  // the broken half would land somebody on a service they didn't pick on a day
  // they didn't ask for, and they would never know the link was wrong.
  const asked = params.has('d') || params.has('t');
  const exact = /^\d{4}-\d{2}-\d{2}$/.test(date) && Number.isInteger(startMin);
  if (asked && !exact) return null;

  if (picked.length && picked.length === wantIds.length) {
    const staff = (state.info.staff || []).find((m) => m.id === Number(params.get('st'))) || null;
    // Services and a stylist with NO date or time asked for at all is the
    // "change the time" case: they already know what they're having and with
    // whom, they just want a different slot. Skipping them past two screens
    // they would answer identically is the whole point of that link.
    return {
      services: picked, staff,
      date: exact ? date : '',
      start_min: exact ? startMin : null,
      checked: false,
    };
  }

  if (!token) return null;
  try {
    const res = await getJson(`/api/public/offer?m=${encodeURIComponent(token)}`);
    if (!res.offer) return null;
    const o = res.offer;
    // The server hands back the services as it holds them; use the page's own
    // copies so prices, names and the cart maths all come from one place.
    const cart = o.service_ids.map(byId).filter(Boolean);
    if (cart.length !== o.service_ids.length) return null;
    return {
      services: cart,
      staff: o.staff ? (state.info.staff || []).find((m) => m.id === o.staff.id) || null : null,
      date: o.date,
      start_min: o.start_min,
      // The server already looked: true means free a moment ago, false means
      // somebody beat them to it and the page should say so rather than let
      // them find out at the last screen.
      checked: true,
      still_free: o.still_free,
      staff_id: o.staff_id,
    };
  } catch {
    return null;
  }
}

/**
 * Open the page on the offered slot.
 *
 * It still opens on the TIMES step rather than jumping to the details form, and
 * that is deliberate. The slot may have gone in the twenty minutes since the
 * text arrived, and the kindest place to be told that is the screen that also
 * shows the other times that day. Landing them on a form and failing at the
 * last button would be one tap shorter and much worse.
 */
async function openOnOffer(offer) {
  state.services = offer.services;
  state.staff = offer.staff;
  if (offer.date) state.date = offer.date;
  state.location = offer.staff && offer.staff.location_id
    ? (state.info.locations || []).find((l) => l.id === offer.staff.location_id) || null
    : null;
  // Only when a particular slot was named. A "change the time" link has none —
  // they are here to pick one, and pre-selecting anything would be putting
  // words in their mouth.
  state.pending = offer.start_min !== null && offer.date
    ? { date: offer.date, start_min: offer.start_min } : null;
  await renderTimeStep();
}

async function handleDepositReturn(params) {
  const apptId = Number(params.get('appt'));
  if (params.get('deposit') === 'success' && params.get('session_id')) {
    try {
      const res = await getJson('/api/public/confirm-deposit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appointment_id: apptId, session_id: params.get('session_id') }),
      });
      renderConfirmed(res, { depositPaid: res.paid, depositCents: res.deposit_cents });
      return;
    } catch { /* fall through to generic message */ }
  }
  root.innerHTML = `
    ${headHtml()}
    <div class="card confirm-card">
      <div class="confirm-icon" style="background:rgba(251,191,36,0.12);border-color:rgba(251,191,36,0.4);color:var(--amber)">${icon('clock', 28)}</div>
      <h2 style="font-size:20px;margin-bottom:6px">Your booking is held</h2>
      <div style="color:var(--text-2);max-width:400px;margin:0 auto 20px;line-height:1.6">
        The deposit payment wasn't completed, but we've kept your slot for now.
        Give us a call${state.info.business_phone ? ` on <b>${esc(state.info.business_phone)}</b>` : ''} to confirm your appointment.
      </div>
      <button class="btn" data-book-again>Book a different time</button>
    </div>
    ${poweredHtml()}`;
}

function renderLocationStep() {
  state.step = 1;
  root.innerHTML = `
    ${headHtml({ cover: true })}${stepsHtml()}
    <div class="bk-section-title">Choose a location</div>
    ${state.info.locations.map((l) => `
      <button class="bk-option" data-loc="${l.id}">
        <div><div class="o-name">${esc(l.name)}</div>
          <div class="o-sub">${esc(l.address || '')}${l.phone ? ` · ${esc(l.phone)}` : ''}</div></div>
      </button>`).join('')}
    ${poweredHtml()}`;
  root.querySelectorAll('[data-loc]').forEach((b) => {
    b.onclick = () => {
      state.location = state.info.locations.find((l) => l.id === Number(b.dataset.loc));
      renderServiceStep();
    };
  });
}

/**
 * "Emma sent you" — shown on the first screen and nowhere else.
 *
 * The friend's name is the whole persuasion here; the discount is secondary and
 * sometimes absent. It appears once, at the top, and does not follow them
 * through the flow, because a banner repeated on every screen stops being a
 * welcome and starts being a nag.
 */
function referralHtml() {
  const r = state.referral;
  if (!r) return '';
  const perk = r.friend_type === 'fixed' && r.friend_value > 0
    ? `${money(Math.round(r.friend_value * 100))} off your first visit`
    : r.friend_type === 'percent' && r.friend_value > 0
      ? `${r.friend_value}% off your first visit`
      : '';
  return `
    <div class="bk-referral">
      ${icon('users', 16)}
      <span><b>${esc(r.first_name)} sent you.</b>
      ${perk ? `They've got you ${esc(perk)} — it comes off on the day.`
        : 'Lovely to meet you — pick whatever suits.'}</span>
    </div>`;
}

function renderServiceStep() {
  state.step = 1;
  const cats = [...new Set(state.info.services.map((s) => s.category))];
  const chosen = new Set(cartIds());
  root.innerHTML = `
    ${headHtml({ cover: !state.location })}${stepsHtml()}
    ${state.location ? `<button class="bk-back" id="back-loc">${icon('chevL', 14)} ${esc(state.location.name)}</button>` : ''}
    ${referralHtml()}
    <div class="bk-section-title">Choose your services</div>
    <div class="bk-hint">Add as many as you like. Tap to select.</div>
    ${cats.map((cat) => `
      <div class="bk-cat">${esc(cat)}</div>
      ${state.info.services.filter((s) => s.category === cat).map((s) => `
        <button class="bk-option svc-pick ${chosen.has(s.id) ? 'picked' : ''}" data-id="${s.id}">
          <div class="svc-check">${icon('check', 14)}</div>
          <div style="flex:1">
            <div class="o-name">${esc(s.name)}</div>
            <div class="o-sub">${s.duration_min} min${s.description ? ` · ${esc(s.description)}` : ''}</div>
          </div>
          <div class="o-price">${priceLabel(s)}</div>
        </button>`).join('')}`).join('')}
    <div style="height:76px"></div>
    <div class="bk-cartbar" id="cartbar" style="${state.services.length ? '' : 'display:none'}">
      <div class="cart-info">
        <b id="cart-count"></b>
        <span id="cart-meta"></span>
      </div>
      <button class="btn primary" id="cart-continue">Continue ${icon('chevR', 14)}</button>
    </div>
    ${poweredHtml()}`;

  root.querySelector('#back-loc')?.addEventListener('click', renderLocationStep);

  const refreshCart = () => {
    const bar = root.querySelector('#cartbar');
    bar.style.display = state.services.length ? '' : 'none';
    root.querySelector('#cart-count').textContent = cartPriceLabel();
    root.querySelector('#cart-meta').textContent =
      ` · ${state.services.length} service${state.services.length === 1 ? '' : 's'} · ${cartDuration()} min`;
  };
  refreshCart();

  root.querySelectorAll('.svc-pick').forEach((b) => {
    b.onclick = () => {
      const svc = state.info.services.find((s) => s.id === Number(b.dataset.id));
      const i = state.services.findIndex((s) => s.id === svc.id);
      if (i >= 0) state.services.splice(i, 1);
      else state.services.push(svc);
      b.classList.toggle('picked');
      refreshCart();
    };
  });
  root.querySelector('#cart-continue').onclick = () => {
    if (state.services.length) renderStaffStep();
  };
}

function locationStaff() {
  return state.location
    ? state.info.staff.filter((s) => s.location_id === state.location.id)
    : state.info.staff;
}

function renderStaffStep() {
  state.step = 2;
  root.innerHTML = `
    ${headHtml()}${stepsHtml()}
    <button class="bk-back" id="back">${icon('chevL', 14)} ${esc(cartLabel())} · ${cartPriceLabel()}</button>
    <div class="bk-section-title">Who would you like?</div>
    <button class="bk-option" data-staff="any">
      <div><div class="o-name">Any available</div><div class="o-sub">First free team member</div></div>
    </button>
    ${locationStaff().map((s) => `
      <button class="bk-option" data-staff="${s.id}">
        <div><div class="o-name">${esc(s.name)}</div><div class="o-sub">${esc(s.title || '')}</div></div>
      </button>`).join('')}
    ${poweredHtml()}`;
  root.querySelector('#back').onclick = renderServiceStep;
  root.querySelectorAll('[data-staff]').forEach((b) => {
    b.onclick = () => {
      state.staff = b.dataset.staff === 'any' ? null : state.info.staff.find((s) => s.id === Number(b.dataset.staff));
      renderTimeStep();
    };
  });
}

async function renderTimeStep() {
  state.step = 3;
  state.slot = null;
  // Every open date the business allows booking into — the server works the
  // list out, because a day that only runs on alternating weeks (every second
  // Sunday, say) can't be told from its weekday alone. The strip shows a
  // fortnight at a time; the picker beside it reaches the whole horizon, so a
  // client wanting a slot two or three months out isn't stuck scrolling.
  let allDays = (state.info.open_dates || []).map((d) => d.date).filter((d) => d >= todayStr());

  // Narrow that to the days the chosen stylist actually works. Offering a
  // Tuesday that turns out to have no times on it wastes a tap and reads as a
  // fault; "Any available" keeps every day at least one of them is rostered.
  const staffList = state.info.staff || [];
  // state.staff is the chosen member, or null for "any available".
  const pool = state.staff ? [state.staff] : staffList.filter((m) => Array.isArray(m.open_dates));
  const rostered = pool.length && pool.every((m) => Array.isArray(m.open_dates))
    ? [...new Set(pool.flatMap((m) => m.open_dates))]
    : null;
  if (rostered) {
    const allowed = new Set(rostered);
    const narrowed = allDays.filter((d) => allowed.has(d));
    // Only apply it when it leaves something — a roster that somehow rules out
    // every day should fall back to the salon's dates and let the slot list say
    // there is nothing free, rather than showing an empty calendar.
    if (narrowed.length) allDays = narrowed;
  }

  if (!allDays.length) {
    const openDays = Array.isArray(state.info.open_days) && state.info.open_days.length
      ? state.info.open_days : [0, 1, 2, 3, 4, 5, 6];
    for (let i = 0; i < 120 && allDays.length < 60; i++) {
      const d = addDaysStr(todayStr(), i);
      if (openDays.includes(parseDate(d).getDay())) allDays.push(d);
    }
  }
  if (!allDays.length) {
    root.innerHTML = `${headHtml()}${stepsHtml()}
      <div class="empty">${icon('calendar', 22)}<div>There are no dates open for booking right now.</div></div>
      ${poweredHtml()}`;
    return;
  }
  if (!allDays.includes(state.date)) state.date = allDays[0];
  // The window of dates on screen: a fortnight starting at whatever's selected,
  // so jumping to November shows November rather than snapping back to today.
  const selIdx = Math.max(0, allDays.indexOf(state.date));
  const from = Math.min(selIdx, Math.max(0, allDays.length - 14));
  const days = allDays.slice(from, from + 14);
  const lastDay = allDays[allDays.length - 1];
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const monNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  // Days that run only every second week leave gaps, so the strip can cross a
  // month boundary — name the month when it does, or "Sun 5" is ambiguous.
  const spansMonths = new Set(days.map((d) => d.slice(0, 7))).size > 1;

  root.innerHTML = `
    ${headHtml()}${stepsHtml()}
    <button class="bk-back" id="back">${icon('chevL', 14)} ${esc(cartLabel())} with ${esc(state.staff?.name || 'any available')}</button>
    ${requirementNoticeHtml()}
    <div class="bk-datehead">
      <div class="bk-section-title" style="margin-bottom:0">Pick a date &amp; time</div>
      <label class="bk-jump" title="Jump to a date">
        ${icon('calendar', 14)}<span>Another date</span>
        <input type="date" id="date-jump" value="${esc(state.date)}" min="${esc(allDays[0])}" max="${esc(lastDay)}">
      </label>
    </div>
    <div class="date-strip" id="dates">
      ${days.map((d) => {
        const dt = parseDate(d);
        return `<button class="date-chip ${d === state.date ? 'sel' : ''}" data-date="${d}">
          <div class="d-day">${dayNames[dt.getDay()]}</div><div class="d-num">${dt.getDate()}</div>
          ${spansMonths ? `<div class="d-mon">${monNames[dt.getMonth()]}</div>` : ''}</button>`;
      }).join('')}
    </div>
    <div id="slots"><div class="empty">Loading times…</div></div>
    <div style="margin-top:20px;text-align:right">
      <button class="btn primary" id="next" disabled>Continue ${icon('chevR', 14)}</button>
    </div>
    ${poweredHtml()}`;

  // A client who came from "change the time" needs to know the old booking is
  // still theirs until they pick something. Otherwise the safe thing — closing
  // the tab — feels like the risky thing.
  if (state.moving) {
    root.querySelector('#slots').insertAdjacentHTML('beforebegin', `
      <div class="bk-held moving">${icon('calendar', 15)}
        <span>Pick a new time and we'll move you. <b>Your current appointment stays
        as it is</b> until you do.</span>
      </div>`);
  }

  root.querySelector('#back').onclick = renderStaffStep;
  root.querySelector('#dates').addEventListener('click', (e) => {
    const chip = e.target.closest('[data-date]');
    if (!chip) return;
    state.date = chip.dataset.date;
    root.querySelectorAll('.date-chip').forEach((c) => c.classList.toggle('sel', c.dataset.date === state.date));
    loadSlots();
  });
  root.querySelector('#next').onclick = () => { if (state.slot != null) renderDetailsStep(); };

  // Jumping to a date the salon is shut on lands on the next open one, so the
  // picker can never leave someone staring at an empty day.
  root.querySelector('#date-jump').addEventListener('change', (e) => {
    const wanted = e.target.value;
    if (!wanted) return;
    state.date = allDays.includes(wanted) ? wanted : (allDays.find((d) => d >= wanted) || allDays[allDays.length - 1]);
    renderTimeStep();
  });

  await loadSlots();

  async function loadSlots() {
    const slotsEl = root.querySelector('#slots');
    slotsEl.innerHTML = '<div class="empty">Loading times…</div>';
    try {
      const staffQ = state.staff ? state.staff.id : 'any';
      const locQ = state.location ? `&location_id=${state.location.id}` : '';
      const res = await getJson(`/api/public/availability?service_ids=${cartIds().join(',')}&staff_id=${staffQ}&date=${state.date}${locQ}`);
      if (!res.slots.length) {
        // A full day is the moment a waitlist is worth offering — they wanted
        // this day, and telling them "try another" is how you lose them to the
        // salon down the road that asked.
        // Somebody sent here for a specific time deserves to be told that time
        // has gone, not a generic "no free times" that reads as though the
        // message was made up.
        const missed = state.pending && state.pending.date === state.date ? state.pending.start_min : null;
        state.pending = null;
        slotsEl.innerHTML = `
          ${missed !== null ? `
            <div class="bk-held gone">${icon('clock', 15)}
              <span><b>${fmtTime(missed)} has just gone.</b> Sorry — it was first to book,
              and that day is now full.</span>
            </div>` : ''}
          <div class="empty">${icon('clock', 22)}<div>No free times that day. Try another date${state.info.waitlist_enabled ? ', or put your name down' : ''}.</div></div>
          ${state.info.waitlist_enabled ? `
            <button class="btn primary" id="join-wl" style="display:block;margin:0 auto">
              ${icon('users')} Let me know if this day frees up</button>` : ''}`;
        if (state.info.waitlist_enabled) {
          slotsEl.querySelector('#join-wl').onclick = () => renderWaitlistStep({ dayFull: true });
        }
        return;
      }
      // Times exist — but not necessarily the one they came for. A day showing
      // 8am and 4pm is "available" to the software and useless to somebody who
      // finishes work at five, and they leave without ever saying so. The offer
      // sits under the grid, quiet, so it never competes with a time they could
      // actually take.
      slotsEl.innerHTML = `<div class="slot-grid">${res.slots.map((s) =>
        `<button class="slot" data-slot="${s.start_min}" data-sid="${s.staff_id}">${fmtTime(s.start_min)}</button>`).join('')}</div>`
        + (state.info.waitlist_enabled ? `
          <div class="wl-foot">
            <span>Nothing here that suits?</span>
            <button type="button" id="join-wl-foot">Tell us when you'd like, and we'll message you if it frees up</button>
          </div>` : '');
      if (state.info.waitlist_enabled) {
        slotsEl.querySelector('#join-wl-foot').onclick = () => renderWaitlistStep({ dayFull: false });
      }
      // Sent here for one particular time? Select it, and say so above the
      // grid. Or say it has gone — with the rest of that day's times already on
      // screen underneath, which is the only version of that news worth giving.
      if (state.pending && state.pending.date === state.date) {
        const want = state.pending.start_min;
        const btn = [...slotsEl.querySelectorAll('.slot')].find((b) => Number(b.dataset.slot) === want);
        state.pending = null;
        if (btn) {
          btn.classList.add('sel');
          state.slot = { start_min: Number(btn.dataset.slot), staff_id: Number(btn.dataset.sid) };
          root.querySelector('#next').disabled = false;
          slotsEl.insertAdjacentHTML('afterbegin', `
            <div class="bk-held">${icon('check', 15)}
              <span><b>${fmtTime(want)}</b> is still free${state.staff ? ` with ${esc(state.staff.name)}` : ''} —
              it's picked below. Tap Continue and it's yours.</span>
            </div>`);
          btn.scrollIntoView({ block: 'nearest' });
        } else {
          slotsEl.insertAdjacentHTML('afterbegin', `
            <div class="bk-held gone">${icon('clock', 15)}
              <span><b>${fmtTime(want)} has just gone.</b> Sorry — it was first to book.
              Here's what's still free that day.</span>
            </div>`);
        }
      }

      slotsEl.querySelectorAll('.slot').forEach((b) => {
        b.onclick = () => {
          state.slot = { start_min: Number(b.dataset.slot), staff_id: Number(b.dataset.sid) };
          slotsEl.querySelectorAll('.slot').forEach((x) => x.classList.toggle('sel', x === b));
          root.querySelector('#next').disabled = false;
        };
      });
    } catch (err) {
      slotsEl.innerHTML = `<div class="empty">${esc(err.message)}</div>`;
    }
  }
}

/**
 * Joining the waitlist — the same short form as booking, because somebody who
 * has just been told "no times that day" has already spent their patience.
 */
function renderWaitlistStep({ dayFull = true } = {}) {
  // Two ways in, and they must not say the same thing. Telling somebody the day
  // is full when they can plainly see three times on the previous screen is the
  // kind of small lie that makes a customer distrust everything else on it.
  const heading = dayFull
    ? `${esc(fmtDate(state.date))} is full`
    : `Tell us when suits on ${esc(fmtDate(state.date))}`;
  const blurb = dayFull
    ? `Leave your details and we'll message you the moment ${esc(cartLabel())} frees up${state.staff ? ` with ${esc(state.staff.name)}` : ''}. No obligation.`
    : `Say what time you were after and we'll message you if it comes free. You can still book one of the times we do have — this is only in case none of them work.`;
  root.innerHTML = `
    ${headHtml()}${stepsHtml()}
    <button class="bk-back" id="back">${icon('chevL', 14)} Back to times</button>
    <div class="bk-summary">
      <span class="st-icon tint-cyan" style="width:34px;height:34px">${icon('users')}</span>
      <div><b>${heading}</b><br>
        <span style="color:var(--text-2)">${blurb}</span></div>
    </div>
    <form id="wl-form" class="form-grid">
      <div class="field"><label>First name *</label><input name="first_name" required></div>
      <div class="field"><label>Last name</label><input name="last_name"></div>
      <div class="field"><label>Phone</label><input name="phone" placeholder="So we can text you"></div>
      <div class="field"><label>Email</label><input name="email" type="email"></div>
      <div class="field span2"><label>${dayFull ? 'Anything else?' : 'What time were you after?'}</label>
        <textarea name="note" placeholder="${dayFull
          ? 'e.g. mornings are best, or any day that week'
          : 'e.g. after 5pm, or Saturday morning'}"></textarea></div>
      <div class="span2" style="text-align:right">
        <button class="btn primary" type="submit" style="min-width:180px;justify-content:center">
          ${icon('check')} Put me on the list</button>
      </div>
      <div class="span2" id="wl-error" style="color:var(--red);font-size:13px;text-align:center"></div>
    </form>
    ${poweredHtml()}`;

  root.querySelector('#back').onclick = renderTimeStep;
  root.querySelector('#wl-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const btn = e.target.querySelector('button[type=submit]');
    btn.disabled = true;
    try {
      const res = await getJson('/api/public/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          first_name: fd.get('first_name'), last_name: fd.get('last_name'),
          phone: fd.get('phone'), email: fd.get('email'), note: fd.get('note'),
          service_id: state.services[0]?.id,
          staff_id: state.staff ? state.staff.id : undefined,
          weekdays: String(parseDate(state.date).getDay()),
          from_date: state.date,
        }),
      });
      root.innerHTML = `
        ${headHtml()}
        <div class="card confirm-card">
          <div class="confirm-icon">${icon('check', 28)}</div>
          <h2 style="font-size:20px;margin-bottom:6px">You're on the list</h2>
          <div style="color:var(--text-2);max-width:34ch;margin:0 auto 20px">${esc(res.detail)}</div>
          <button class="btn" data-book-again>Look at other days</button>
        </div>
        ${poweredHtml()}`;
    } catch (err) {
      root.querySelector('#wl-error').textContent = err.message;
      btn.disabled = false;
    }
  });
}

function renderDetailsStep() {
  state.step = 4;
  root.innerHTML = `
    ${headHtml()}${stepsHtml()}
    <button class="bk-back" id="back">${icon('chevL', 14)} Back to times</button>
    <div class="bk-summary">
      <span class="st-icon tint-cyan" style="width:34px;height:34px">${icon('calendar')}</span>
      <div>
        <b>${esc(cartLabel())}</b> · ${cartPriceLabel()}<br>
        ${state.services.length > 1 ? `<span style="color:var(--text-2);font-size:12.5px">${state.services.map((s) => esc(s.name)).join(' · ')}</span><br>` : ''}
        <span style="color:var(--text-2)">${fmtDate(state.date)} at ${fmtTime(state.slot.start_min)} – ${fmtTime(state.slot.start_min + cartDuration())}${state.staff ? ` with ${esc(state.staff.name)}` : ''}</span>
        ${cartHasFrom() ? '<div style="color:var(--muted);font-size:11.5px;margin-top:2px">Final price confirmed at your appointment</div>' : ''}
      </div>
    </div>
    ${requirementNoticeHtml()}
    ${depositNoteHtml()}
    ${cancelPolicyHtml()}
    <div class="bk-section-title">Your details</div>
    <form id="bk-form" class="form-grid">
      <div class="field"><label>First name *</label><input name="first_name" required value="${esc(state.lastDetails?.first_name || '')}"></div>
      <div class="field"><label>Last name</label><input name="last_name" value="${esc(state.lastDetails?.last_name || '')}"></div>
      <div class="field"><label>Phone *</label><input name="phone" required placeholder="So we can reach you" value="${esc(state.lastDetails?.phone || '')}"></div>
      <div class="field"><label>Email</label><input name="email" type="email" value="${esc(state.lastDetails?.email || '')}"></div>
      <div class="field span2"><label>Notes</label><textarea name="notes" placeholder="Anything we should know?">${esc(state.lastDetails?.notes || '')}</textarea></div>
      ${consentHtml()}
      ${state.info.ask_heard_from && !state.referral ? `
        <div class="field span2"><label>How did you hear about us?
          <span class="bk-optional">optional</span></label>
          <select name="heard_from" class="nice-select">
            <option value="">Rather not say</option>
            ${(state.info.heard_options || []).map((o) =>
              `<option value="${esc(o.value)}">${esc(o.label)}</option>`).join('')}
          </select></div>` : ''}
      ${state.info.follow_up_unfinished ? `
        <div class="span2 bk-privacy">
          If you don't finish booking, we'll keep your name and number for up to 7 days
          so we can check whether you still wanted a time. Nothing else, and then it's deleted.
        </div>` : ''}
      ${state.info.turnstile_site_key ? '<div class="span2" id="bk-turnstile" style="display:flex;justify-content:center"></div>' : ''}
      <div class="span2" style="text-align:right">
        <button class="btn primary" type="submit" style="min-width:180px;justify-content:center">${icon('check')} ${depositCents() > 0 ? 'Continue to deposit' : 'Confirm booking'}</button>
      </div>
      <div class="span2" id="bk-error" style="color:var(--red);font-size:13px;text-align:center"></div>
    </form>
    ${poweredHtml()}`;

  root.querySelector('#back').onclick = renderTimeStep;
  mountTurnstile();

  // If they wander off from here, the salon can ask whether they still wanted a
  // time. Sent when they finish typing a contact field rather than on every
  // keystroke, and only when the business has the follow-up switched on — the
  // notice above the button and this listener are the same switch, so nobody is
  // ever recorded without having been told. The server refuses it independently
  // too, so a stale page loses nothing.
  if (state.info.follow_up_unfinished) {
    const form = root.querySelector('#bk-form');
    let noted = '';
    const noteAttempt = () => {
      const fd = new FormData(form);
      const first = String(fd.get('first_name') || '').trim();
      const phone = String(fd.get('phone') || '').trim();
      const email = String(fd.get('email') || '').trim();
      if (!first || (!phone && !email)) return;
      const sig = `${first}|${phone}|${email}`;
      if (sig === noted) return;
      noted = sig;
      fetch('/api/public/booking-attempt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          first_name: first, phone, email,
          service_id: state.services[0]?.id,
          date: state.date, start_min: state.slot?.start_min,
        }),
      }).catch(() => { /* never let this get in the way of booking */ });
    };
    for (const n of ['first_name', 'phone', 'email']) {
      form.querySelector(`[name="${n}"]`)?.addEventListener('blur', noteAttempt);
    }
  }

  root.querySelector('#bk-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const btn = e.target.querySelector('button[type=submit]');
    // Everything they typed, kept so a refusal that sends them to the patch-test
    // step can put the booking through afterwards without asking for it again.
    // Held in memory for this page only; nothing is stored.
    const details = {
      first_name: fd.get('first_name'), last_name: fd.get('last_name'),
      phone: fd.get('phone'), email: fd.get('email'),
      notes: fd.get('notes'), heard_from: fd.get('heard_from') || '',
      consents: [...root.querySelectorAll('[data-consent]')].map((box) => ({
        service_id: Number(box.dataset.consent),
        typed_name: box.querySelector('input')?.value.trim() || '',
      })).filter((c) => c.typed_name),
    };
    state.lastDetails = details;

    const missing = [...root.querySelectorAll('[data-consent]')]
      .filter((box) => !box.querySelector('input')?.value.trim());
    if (missing.length) {
      root.querySelector('#bk-error').textContent = 'Please type your name to agree before we book this in';
      missing[0].querySelector('input')?.focus();
      return;
    }

    btn.disabled = true;
    try {
      await submitBooking(details);
    } catch (err) {
      root.querySelector('#bk-error').textContent = err.message;
      btn.disabled = false;
      resetTurnstile(); // the token the server just saw is spent either way
      if (/just taken/i.test(err.message)) setTimeout(renderTimeStep, 1600);
    }
  });
}

/**
 * Put the booking through, and deal with the two answers that are not a
 * refusal: a patch test that has to happen first, and wording that has to be
 * agreed to. Both come back as a 409 carrying what is missing, and both are
 * handled by moving the person forward rather than by printing an error.
 */
async function submitBooking(details) {
  const humanToken = await turnstileToken();
  const fromStore = (k) => { try { return sessionStorage.getItem(k) || ''; } catch { return ''; } };
  let res;
  try {
    res = await getJson('/api/public/book', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        service_id: state.services[0].id,
        service_ids: cartIds(),
        staff_id: state.staff ? state.staff.id : state.slot.staff_id,
        location_id: state.location?.id,
        date: state.date,
        start_min: state.slot.start_min,
        notes: details.notes,
        origin: location.origin,
        turnstile_token: humanToken,
        from_message: fromStore('kairo_from_message'),
        // Releases the appointment they are moving — but only once this one
        // exists. The server checks the token names a live booking of theirs.
        reschedule_token: fromStore('kairo_reschedule'),
        referral_token: fromStore('kairo_referral'),
        heard_from: details.heard_from || '',
        consents: details.consents?.length ? details.consents : undefined,
        patch: state.patch
          ? { date: state.patch.date, start_min: state.patch.start_min, staff_id: state.patch.staff_id }
          : undefined,
        client: {
          first_name: details.first_name, last_name: details.last_name,
          phone: details.phone, email: details.email,
        },
      }),
    });
  } catch (err) {
    if (err.data?.needs === 'consent') {
      // The wording changed between this page loading and them pressing the
      // button. Re-read it and show the new words rather than storing agreement
      // to a sentence that is no longer the one on file.
      try {
        const fresh = await getJson('/api/public/info');
        state.info.requirements = fresh.requirements || {};
      } catch { /* keep what we have; the server will refuse again */ }
      renderDetailsStep();
      root.querySelector('#bk-error').textContent =
        'We\'ve updated this wording — please read it and type your name again.';
      return;
    }
    if (err.data?.needs === 'patch_test') {
      // Not an error to read — a step to take. The slot they had chosen is
      // cleared first, because whatever was in it did not satisfy the server.
      state.patch = null;
      resetTurnstile();
      renderPatchStep(err.data.patch_test);
      return;
    }
    throw err;
  }
  if (res.checkout_url) { location.href = res.checkout_url; return; }
  renderConfirmed(res);
}

// --- safety requirements ----------------------------------------------------

/** The requirements attached to whatever is in the cart. */
function cartRequirements() {
  const map = state.info?.requirements || {};
  return state.services
    .map((s) => ({ service: s, req: map[s.id] || map[String(s.id)] || null }))
    .filter((x) => x.req);
}

/**
 * The heads-up, shown while they are still choosing.
 *
 * It says the same thing to everybody — a first-timer, a regular whose test
 * lapsed last week, somebody who was tested on Tuesday — because the page has
 * no idea who is reading it and must never become a way of finding out what the
 * salon holds on a person. Whether they actually need one is decided at the
 * moment they book, by the server, once there is a name to check.
 */
function requirementNoticeHtml() {
  const reqs = cartRequirements();
  const needsPatch = reqs.filter((r) => r.req.patch_test);
  if (!needsPatch.length) return '';
  const lead = state.info?.patch?.lead_hours || 48;
  const hrs = lead % 24 === 0 && lead >= 48 ? `${lead / 24} days` : `${lead} hours`;
  const names = needsPatch.map((r) => r.service.name).join(' and ');
  return `
    <div class="bk-safety">${icon('alert', 15)}
      <div><b>${esc(names)} needs a patch test.</b>
      It has to be done at least ${esc(hrs)} beforehand. If you've had one with us recently
      you're all set — if not, ${state.info?.patch?.bookable
        ? 'we\'ll offer you a free one to book at the same time.'
        : 'we\'ll ask you to give us a ring so we can sort one out.'}</div>
    </div>`;
}

/** The wording, and the box they type their name into. */
function consentHtml() {
  return cartRequirements()
    .filter((r) => r.req.consent?.text)
    .map((r) => `
      <div class="bk-consent span2" data-consent="${r.service.id}">
        <div class="words">${esc(r.req.consent.text)}</div>
        <label>Type your full name to agree — ${esc(r.service.name)} *</label>
        <input name="consent_${r.service.id}" autocomplete="name" placeholder="Your full name">
        <span class="co-hint">Kept word-for-word with the time you agreed. Your name typed here
          is a record of consent, not a witnessed signature.</span>
      </div>`).join('');
}

/**
 * The patch test, offered rather than demanded.
 *
 * This screen only ever appears after the server has refused the booking, and
 * it carries the refusal's own answer: the slots that would still count. The
 * treatment they picked is held in state and re-submitted with the test, so
 * they leave with both in the diary rather than being sent back to the start.
 */
async function renderPatchStep(detail) {
  const svcName = detail?.service?.name || 'Patch test';
  const lead = detail?.lead_hours || state.info?.patch?.lead_hours || 48;
  const hrs = lead % 24 === 0 && lead >= 48 ? `${lead / 24} days` : `${lead} hours`;
  root.innerHTML = `
    ${headHtml()}${stepsHtml()}
    <button class="bk-back" id="back">${icon('chevL', 14)} Back to your details</button>
    <div class="bk-section-title">One quick thing first</div>
    <div class="bk-safety">${icon('alert', 15)}
      <div><b>${esc(cartLabel())} needs a patch test.</b>
      It takes a few minutes and has to be at least ${esc(hrs)} before your appointment on
      ${esc(fmtDate(state.date))}.</div>
    </div>
    <div id="bk-patch-body"><div class="bk-hint">Finding you a time…</div></div>
    ${poweredHtml()}`;
  root.querySelector('#back').onclick = renderDetailsStep;

  const body = root.querySelector('#bk-patch-body');
  if (!detail?.bookable) {
    body.innerHTML = `
      <div class="bk-hint">We book patch tests in over the phone.
        ${detail?.phone ? `Give us a ring on <b>${esc(detail.phone)}</b> and we'll` : 'Give us a ring and we\'ll'}
        get one done, then your appointment is ready to book.</div>`;
    return;
  }

  let data;
  try {
    data = await getJson(`/api/public/patch-slots?for_date=${encodeURIComponent(state.date)}`
      + `&for_start_min=${state.slot.start_min}`);
  } catch {
    body.innerHTML = '<div class="bk-hint">We couldn\'t load patch test times just now — please try again.</div>';
    return;
  }

  if (!data.slots?.length) {
    // No room before the deadline. Said as what to do rather than as a refusal:
    // the appointment they want is still available, just not this soon.
    body.innerHTML = `
      <div class="bk-hint">There's no patch test time left before
        ${esc(fmtDate(state.date))}. Pick a later date for your appointment and we'll fit the
        test in beforehand${data.service ? '' : ''}.</div>
      <div style="margin-top:14px"><button class="btn primary" id="bk-later">Choose another date</button></div>`;
    root.querySelector('#bk-later').onclick = renderTimeStep;
    return;
  }

  body.innerHTML = `
    <div class="bk-hint">Pick a time for your free ${esc(svcName)}. We'll book both in one go.</div>
    <div class="bk-patch-slots">
      ${data.slots.map((sl, i) => `
        <button type="button" data-i="${i}">${esc(fmtDate(sl.date, { weekday: true }))} · ${esc(fmtTime(sl.start_min))}</button>`).join('')}
    </div>
    ${state.info.turnstile_site_key ? '<div id="bk-turnstile" style="display:flex;justify-content:center;margin-top:14px"></div>' : ''}
    <div style="margin-top:16px;text-align:right">
      <button class="btn primary" id="bk-patch-go" disabled style="min-width:200px;justify-content:center">
        ${icon('check')} Book both</button>
    </div>
    <div id="bk-error" style="color:var(--red);font-size:13px;text-align:center;margin-top:10px"></div>`;

  // The token the first attempt used is spent, so this step needs its own
  // widget — without it the retry waits six seconds and then fails on a check
  // the person already passed.
  mountTurnstile();

  const go = root.querySelector('#bk-patch-go');
  root.querySelectorAll('.bk-patch-slots button').forEach((b) => {
    b.onclick = () => {
      root.querySelectorAll('.bk-patch-slots button').forEach((x) => x.classList.toggle('sel', x === b));
      state.patch = data.slots[Number(b.dataset.i)];
      go.disabled = false;
    };
  });
  go.onclick = async () => {
    go.disabled = true;
    try {
      await submitBooking(state.lastDetails || {});
    } catch (err) {
      root.querySelector('#bk-error').textContent = err.message;
      go.disabled = false;
    }
  };
}

function depositCents() {
  const d = state.info?.deposit;
  if (!d?.enabled || !state.services.length) return 0;
  if (d.type === 'fixed') return Math.round(d.value * 100);
  if (d.type === 'percent') return Math.round(cartTotalCents() * (d.value / 100));
  return 0;
}

function depositNoteHtml() {
  const cents = depositCents();
  if (!cents) return '';
  return `
    <div class="bk-summary" style="border-color:color-mix(in srgb, var(--accent) 40%, transparent)">
      <span class="st-icon tint-cyan" style="width:34px;height:34px">${icon('card')}</span>
      <div>A <b>${money(cents)} deposit</b> secures your booking. You'll pay it by card on the next screen.
        <span style="color:var(--text-2)">It comes off your bill on the day.</span></div>
    </div>`;
}

/** "12 hours" / "24 hours" / "2 days" — reads naturally mid-sentence. */
const hoursLabel = (h) => (h >= 48 && h % 24 === 0 ? `${h / 24} days` : h === 1 ? '1 hour' : `${h} hours`);

/**
 * The cancellation terms, stated before someone commits rather than buried in
 * the confirmation email. -1 means the business handles changes by phone.
 */
function cancelPolicyHtml() {
  const hrs = state.info?.cancel_window_hours;
  if (hrs === undefined || hrs === null) return '';
  const phone = state.info.business_phone ? ` or call us on <b>${esc(state.info.business_phone)}</b>` : '';
  return `
    <div class="bk-policy">
      ${icon('clock', 15)}
      <div>${hrs < 0
        ? `Need to change or cancel? Give us a call${state.info.business_phone ? ` on <b>${esc(state.info.business_phone)}</b>` : ''} and we'll sort it out.`
        : hrs === 0
          ? `You can cancel any time from the link in your confirmation${phone}.`
          : `Plans change. You can cancel from the link in your confirmation up to
             <b>${hoursLabel(hrs)}</b> before your appointment${phone}.`}</div>
    </div>`;
}

function renderConfirmed(res, { depositPaid = false, depositCents: paidCents = 0 } = {}) {
  state.step = 4;
  root.innerHTML = `
    ${headHtml()}
    <div class="card confirm-card">
      <div class="confirm-icon">${icon('check', 28)}</div>
      <h2 style="font-size:20px;margin-bottom:6px">${res.moved_from ? 'Your appointment has moved' : "You're booked!"}</h2>
      <div style="color:var(--text-2);margin-bottom:20px">Reference <b style="color:var(--accent)">${esc(res.reference)}</b></div>
      ${res.moved_from ? `
        <div class="bk-moved">Your old time on
          <b>${fmtDate(res.moved_from.from_date)} at ${fmtTime(res.moved_from.from_start_min)}</b>
          has been released — you only have the one below.</div>` : ''}
      ${res.referred_by ? `
        <div class="bk-moved">${esc(res.referred_by.first_name)} referred you${
          res.friend_reward_cents ? `, so <b>${money(res.friend_reward_cents)}</b> comes off on the day` : ''}.
          We'll let them know you came.</div>` : ''}
      <div class="bk-summary" style="justify-content:center">
        <div style="text-align:center">
          <b>${esc(res.service)}</b> with ${esc(res.staff)}<br>
          <span style="color:var(--text-2)">${fmtDate(res.date)} · ${fmtTime(res.start_min)} – ${fmtTime(res.end_min)}</span>
          ${depositPaid ? `<br><span style="color:var(--green);font-weight:600">💳 ${money(paidCents)} deposit paid</span>` : ''}
        </div>
      </div>
      ${res.patch_appointment ? `
        <div class="bk-moved"><b>Two appointments, not one.</b> Your patch test is on
          <b>${fmtDate(res.patch_appointment.date)} at ${fmtTime(res.patch_appointment.start_min)}</b>
          (${res.patch_appointment.duration_min} minutes), and the appointment above follows it.
          You'll get a confirmation for each.</div>` : ''}
      <div style="color:var(--muted);font-size:13px">We look forward to seeing you at ${esc(res.business_name)}.</div>
      <div style="display:flex;gap:10px;justify-content:center;margin-top:22px">
        <a class="btn" href="${esc(res.ics_url || '')}" download>${icon('calendar')} Add to calendar</a>
        <button class="btn" data-book-again>Book another</button>
      </div>
    </div>
    ${poweredHtml()}`;
}

lockZoom(); // fixed scale, so a stray pinch can't leave the page offset mid-booking
boot();
