// Public booking flow: service → staff → date & time → details → confirmed.
import { esc, icon, money, priceLabel, fmtTime, fmtDate, setCurrency, todayStr, addDaysStr, parseDate } from './ui.js';
import { resolveScheme, applyScheme } from './schemes.js';

const root = document.getElementById('book');
// state.services is the "cart" — one or more chosen services, booked back-to-
// back with the same team member for one combined appointment.
const state = { info: null, location: null, services: [], staff: null, date: todayStr(), slot: null, step: 1 };

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
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Something went wrong');
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
  root.style.setProperty('--accent-grad', `linear-gradient(135deg, ${accent}, color-mix(in srgb, ${accent} 72%, #000))`);
}

function poweredHtml() {
  return '<div class="powered">Powered by <b>◆ Kairo</b> — booking for modern businesses</div>';
}

async function boot() {
  // "Book another / a different time" buttons — delegated so no inline
  // onclick is needed (keeps the page compatible with a strict script-src CSP).
  root.addEventListener('click', (e) => {
    if (e.target.closest('[data-book-again]')) location.href = '/book';
  });
  try {
    state.info = await getJson('/api/public/info');
    setCurrency(state.info.currency);
    applyBrand(state.info.brand);
    document.title = `Book — ${state.info.business_name}`;

    // Returning from Stripe after a deposit?
    const params = new URLSearchParams(location.search);
    if (params.get('deposit') && params.get('appt')) {
      history.replaceState(null, '', '/book');
      await handleDepositReturn(params);
      return;
    }

    if (state.info.locations.length > 1) renderLocationStep();
    else renderServiceStep();
  } catch (err) {
    root.innerHTML = `<div class="empty" style="padding-top:80px">${icon('alert', 26)}<div>${esc(err.message)}</div></div>`;
  }
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

function renderServiceStep() {
  state.step = 1;
  const cats = [...new Set(state.info.services.map((s) => s.category))];
  const chosen = new Set(cartIds());
  root.innerHTML = `
    ${headHtml({ cover: !state.location })}${stepsHtml()}
    ${state.location ? `<button class="bk-back" id="back-loc">${icon('chevL', 14)} ${esc(state.location.name)}</button>` : ''}
    <div class="bk-section-title">Choose your services</div>
    <div class="bk-hint">Add as many as you like — tap to select.</div>
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
  // Show the next 14 days the business is actually OPEN. The server works the
  // list out, because a day that only runs on alternating weeks (every second
  // Sunday, say) can't be told from its weekday alone.
  let days = (state.info.open_dates || []).map((d) => d.date).filter((d) => d >= todayStr()).slice(0, 14);
  if (!days.length) {
    const openDays = Array.isArray(state.info.open_days) && state.info.open_days.length
      ? state.info.open_days : [0, 1, 2, 3, 4, 5, 6];
    for (let i = 0; i < 45 && days.length < 14; i++) {
      const d = addDaysStr(todayStr(), i);
      if (openDays.includes(parseDate(d).getDay())) days.push(d);
    }
  }
  if (!days.includes(state.date)) state.date = days[0];
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const monNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  // Days that run only every second week leave gaps, so the strip can cross a
  // month boundary — name the month when it does, or "Sun 5" is ambiguous.
  const spansMonths = new Set(days.map((d) => d.slice(0, 7))).size > 1;

  root.innerHTML = `
    ${headHtml()}${stepsHtml()}
    <button class="bk-back" id="back">${icon('chevL', 14)} ${esc(cartLabel())} with ${esc(state.staff?.name || 'any available')}</button>
    <div class="bk-section-title">Pick a date &amp; time</div>
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

  root.querySelector('#back').onclick = renderStaffStep;
  root.querySelector('#dates').addEventListener('click', (e) => {
    const chip = e.target.closest('[data-date]');
    if (!chip) return;
    state.date = chip.dataset.date;
    root.querySelectorAll('.date-chip').forEach((c) => c.classList.toggle('sel', c.dataset.date === state.date));
    loadSlots();
  });
  root.querySelector('#next').onclick = () => { if (state.slot != null) renderDetailsStep(); };

  await loadSlots();

  async function loadSlots() {
    const slotsEl = root.querySelector('#slots');
    slotsEl.innerHTML = '<div class="empty">Loading times…</div>';
    try {
      const staffQ = state.staff ? state.staff.id : 'any';
      const locQ = state.location ? `&location_id=${state.location.id}` : '';
      const res = await getJson(`/api/public/availability?service_ids=${cartIds().join(',')}&staff_id=${staffQ}&date=${state.date}${locQ}`);
      if (!res.slots.length) {
        slotsEl.innerHTML = `<div class="empty">${icon('clock', 22)}<div>No free times that day — try another date.</div></div>`;
        return;
      }
      slotsEl.innerHTML = `<div class="slot-grid">${res.slots.map((s) =>
        `<button class="slot" data-slot="${s.start_min}" data-sid="${s.staff_id}">${fmtTime(s.start_min)}</button>`).join('')}</div>`;
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
    ${depositNoteHtml()}
    <div class="bk-section-title">Your details</div>
    <form id="bk-form" class="form-grid">
      <div class="field"><label>First name *</label><input name="first_name" required></div>
      <div class="field"><label>Last name</label><input name="last_name"></div>
      <div class="field"><label>Phone *</label><input name="phone" required placeholder="So we can reach you"></div>
      <div class="field"><label>Email</label><input name="email" type="email"></div>
      <div class="field span2"><label>Notes</label><textarea name="notes" placeholder="Anything we should know?"></textarea></div>
      <div class="span2" style="text-align:right">
        <button class="btn primary" type="submit" style="min-width:180px;justify-content:center">${icon('check')} ${depositCents() > 0 ? 'Continue to deposit' : 'Confirm booking'}</button>
      </div>
      <div class="span2" id="bk-error" style="color:var(--red);font-size:13px;text-align:center"></div>
    </form>
    ${poweredHtml()}`;

  root.querySelector('#back').onclick = renderTimeStep;
  root.querySelector('#bk-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const btn = e.target.querySelector('button[type=submit]');
    btn.disabled = true;
    try {
      const res = await getJson('/api/public/book', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          service_id: state.services[0].id,
          service_ids: cartIds(),
          staff_id: state.staff ? state.staff.id : state.slot.staff_id,
          location_id: state.location?.id,
          date: state.date,
          start_min: state.slot.start_min,
          notes: fd.get('notes'),
          origin: location.origin,
          client: {
            first_name: fd.get('first_name'), last_name: fd.get('last_name'),
            phone: fd.get('phone'), email: fd.get('email'),
          },
        }),
      });
      if (res.checkout_url) { location.href = res.checkout_url; return; }
      renderConfirmed(res);
    } catch (err) {
      root.querySelector('#bk-error').textContent = err.message;
      btn.disabled = false;
      if (/just taken/i.test(err.message)) setTimeout(renderTimeStep, 1600);
    }
  });
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
      <div>A <b>${money(cents)} deposit</b> secures your booking — you'll pay it by card on the next screen.
        <span style="color:var(--text-2)">It comes off your bill on the day.</span></div>
    </div>`;
}

function renderConfirmed(res, { depositPaid = false, depositCents: paidCents = 0 } = {}) {
  state.step = 4;
  root.innerHTML = `
    ${headHtml()}
    <div class="card confirm-card">
      <div class="confirm-icon">${icon('check', 28)}</div>
      <h2 style="font-size:20px;margin-bottom:6px">You're booked!</h2>
      <div style="color:var(--text-2);margin-bottom:20px">Reference <b style="color:var(--accent)">${esc(res.reference)}</b></div>
      <div class="bk-summary" style="justify-content:center">
        <div style="text-align:center">
          <b>${esc(res.service)}</b> with ${esc(res.staff)}<br>
          <span style="color:var(--text-2)">${fmtDate(res.date)} · ${fmtTime(res.start_min)} – ${fmtTime(res.end_min)}</span>
          ${depositPaid ? `<br><span style="color:var(--green);font-weight:600">💳 ${money(paidCents)} deposit paid</span>` : ''}
        </div>
      </div>
      <div style="color:var(--muted);font-size:13px">We look forward to seeing you at ${esc(res.business_name)}.</div>
      <div style="display:flex;gap:10px;justify-content:center;margin-top:22px">
        <a class="btn" href="/api/public/ics/${res.appointment_id}" download>${icon('calendar')} Add to calendar</a>
        <button class="btn" data-book-again>Book another</button>
      </div>
    </div>
    ${poweredHtml()}`;
}

boot();
