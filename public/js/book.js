// Public booking flow: service → staff → date & time → details → confirmed.
import { esc, icon, money, fmtTime, fmtDate, setCurrency, todayStr, addDaysStr, parseDate } from './ui.js';

const root = document.getElementById('book');
const state = { info: null, service: null, staff: null, date: todayStr(), slot: null, step: 1 };

async function getJson(url, opts) {
  const res = await fetch(url, opts);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Something went wrong');
  return data;
}

function stepsHtml() {
  return `<div class="steps">${[1, 2, 3, 4].map((i) => `<div class="s ${state.step >= i ? 'done' : ''}"></div>`).join('')}</div>`;
}

function headHtml() {
  const b = state.info;
  return `
    <div class="book-head">
      <h1>${esc(b.business_name)}</h1>
      <div class="sub">${esc(b.business_address || '')}${b.business_phone ? ` · ${esc(b.business_phone)}` : ''}</div>
    </div>`;
}

function poweredHtml() {
  return '<div class="powered">Powered by <b>◆ Kairo</b> — booking for modern businesses</div>';
}

async function boot() {
  try {
    state.info = await getJson('/api/public/info');
    setCurrency(state.info.currency);
    document.title = `Book — ${state.info.business_name}`;
    renderServiceStep();
  } catch (err) {
    root.innerHTML = `<div class="empty" style="padding-top:80px">${icon('alert', 26)}<div>${esc(err.message)}</div></div>`;
  }
}

function renderServiceStep() {
  state.step = 1;
  const cats = [...new Set(state.info.services.map((s) => s.category))];
  root.innerHTML = `
    ${headHtml()}${stepsHtml()}
    <div class="bk-section-title">Choose a service</div>
    ${cats.map((cat) => `
      <div class="bk-cat">${esc(cat)}</div>
      ${state.info.services.filter((s) => s.category === cat).map((s) => `
        <button class="bk-option" data-id="${s.id}">
          <div>
            <div class="o-name">${esc(s.name)}</div>
            <div class="o-sub">${s.duration_min} min${s.description ? ` · ${esc(s.description)}` : ''}</div>
          </div>
          <div class="o-price">${money(s.price_cents)}</div>
        </button>`).join('')}`).join('')}
    ${poweredHtml()}`;
  root.querySelectorAll('[data-id]').forEach((b) => {
    b.onclick = () => {
      state.service = state.info.services.find((s) => s.id === Number(b.dataset.id));
      renderStaffStep();
    };
  });
}

function renderStaffStep() {
  state.step = 2;
  root.innerHTML = `
    ${headHtml()}${stepsHtml()}
    <button class="bk-back" id="back">${icon('chevL', 14)} ${esc(state.service.name)} · ${money(state.service.price_cents)}</button>
    <div class="bk-section-title">Who would you like?</div>
    <button class="bk-option" data-staff="any">
      <div><div class="o-name">Any available</div><div class="o-sub">First free team member</div></div>
    </button>
    ${state.info.staff.map((s) => `
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
  const days = Array.from({ length: 14 }, (_, i) => addDaysStr(todayStr(), i));
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  root.innerHTML = `
    ${headHtml()}${stepsHtml()}
    <button class="bk-back" id="back">${icon('chevL', 14)} ${esc(state.service.name)} with ${esc(state.staff?.name || 'any available')}</button>
    <div class="bk-section-title">Pick a date &amp; time</div>
    <div class="date-strip" id="dates">
      ${days.map((d) => {
        const dt = parseDate(d);
        return `<button class="date-chip ${d === state.date ? 'sel' : ''}" data-date="${d}">
          <div class="d-day">${dayNames[dt.getDay()]}</div><div class="d-num">${dt.getDate()}</div></button>`;
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
      const res = await getJson(`/api/public/availability?service_id=${state.service.id}&staff_id=${staffQ}&date=${state.date}`);
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
        <b>${esc(state.service.name)}</b> · ${money(state.service.price_cents)}<br>
        <span style="color:var(--text-2)">${fmtDate(state.date)} at ${fmtTime(state.slot.start_min)}${state.staff ? ` with ${esc(state.staff.name)}` : ''}</span>
      </div>
    </div>
    <div class="bk-section-title">Your details</div>
    <form id="bk-form" class="form-grid">
      <div class="field"><label>First name *</label><input name="first_name" required></div>
      <div class="field"><label>Last name</label><input name="last_name"></div>
      <div class="field"><label>Phone *</label><input name="phone" required placeholder="So we can reach you"></div>
      <div class="field"><label>Email</label><input name="email" type="email"></div>
      <div class="field span2"><label>Notes</label><textarea name="notes" placeholder="Anything we should know?"></textarea></div>
      <div class="span2" style="text-align:right">
        <button class="btn primary" type="submit" style="min-width:180px;justify-content:center">${icon('check')} Confirm booking</button>
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
          service_id: state.service.id,
          staff_id: state.staff ? state.staff.id : state.slot.staff_id,
          date: state.date,
          start_min: state.slot.start_min,
          notes: fd.get('notes'),
          client: {
            first_name: fd.get('first_name'), last_name: fd.get('last_name'),
            phone: fd.get('phone'), email: fd.get('email'),
          },
        }),
      });
      renderConfirmed(res);
    } catch (err) {
      root.querySelector('#bk-error').textContent = err.message;
      btn.disabled = false;
      if (/just taken/i.test(err.message)) setTimeout(renderTimeStep, 1600);
    }
  });
}

function renderConfirmed(res) {
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
        </div>
      </div>
      <div style="color:var(--muted);font-size:13px">We look forward to seeing you at ${esc(res.business_name)}.</div>
      <button class="btn" style="margin-top:22px" onclick="location.reload()">Book another appointment</button>
    </div>
    ${poweredHtml()}`;
}

boot();
