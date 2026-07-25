// Calendar: Fresha-style day view (staff columns) + week view, click-to-book,
// drag-to-reschedule, and the appointment editor modal.
import { api, ApiError } from '../api.js';
import {
  esc, icon, money, priceLabel, fmtTime, fmtTimeShort, fmtDate, todayStr, addDaysStr, parseDate, dateToStr,
  openModal, confirmDialog, toast, timeOptions, statusChip, initials, avatarColor,
} from '../ui.js';
import { state, refreshLookups } from '../app.js';

const PX_PER_MIN = 1.15;
const SNAP = 15;

const cal = {
  date: todayStr(),
  view: 'day',        // 'day' | 'week'
  staffFilter: 0,     // 0 = everyone
  locationFilter: 0,  // 0 = all locations
  appointments: [],
};

function visibleStaff() {
  return cal.locationFilter
    ? state.staff.filter((s) => s.location_id === cal.locationFilter)
    : state.staff;
}

const openMin = () => Number(state.settings.open_min || 480);
const closeMin = () => Number(state.settings.close_min || 1200);

// The calendar shows a WIDER range than opening hours (Fresha-style): a couple
// of padding hours before/after, expanded further to include any appointment
// the owner squeezed in outside hours. Opening hours are the normal (bookable)
// band; the padded off-hours are shaded but still schedulable by the owner.
// The public booking page is unaffected — it still uses open/close only.
const RANGE_PAD = 120; // minutes of padding shown before open / after close
function computeRange() {
  let lo = openMin() - RANGE_PAD, hi = closeMin() + RANGE_PAD;
  for (const a of cal.appointments || []) { lo = Math.min(lo, a.start_min); hi = Math.max(hi, a.end_min); }
  cal.gridStart = Math.max(0, Math.floor(lo / 60) * 60);
  cal.gridEnd = Math.min(1440, Math.ceil(hi / 60) * 60);
}
const gridStart = () => cal.gridStart ?? Math.max(0, openMin() - RANGE_PAD);
const gridEnd = () => cal.gridEnd ?? Math.min(1440, closeMin() + RANGE_PAD);
const yFor = (min) => (min - gridStart()) * PX_PER_MIN;
const minFor = (y) => Math.round((y / PX_PER_MIN + gridStart()) / SNAP) * SNAP;

// Shaded off-hours bands for one day column. On a closed day the whole column
// is off-hours; otherwise the areas before open and after close are shaded.
function offHoursHtml(date) {
  const dow = parseDate(date).getDay();
  const openDays = String(state.settings.open_days ?? '0,1,2,3,4,5,6').split(',').map(Number);
  const gs = gridStart(), ge = gridEnd();
  const band = (from, to) => `<div class="off-hours" style="top:${(from - gs) * PX_PER_MIN}px;height:${(to - from) * PX_PER_MIN}px"></div>`;
  if (!openDays.includes(dow)) return band(gs, ge); // closed day → all shaded
  let html = '';
  if (openMin() > gs) html += band(gs, openMin());
  if (closeMin() < ge) html += band(closeMin(), ge);
  return html;
}

function weekStart(dateStr) {
  const d = parseDate(dateStr);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); // Monday
  return dateToStr(d);
}

export async function renderCalendar(container, params) {
  if (params?.get('date')) cal.date = params.get('date');
  await loadAndDraw(container);
}

async function loadAndDraw(container) {
  const from = cal.view === 'day' ? cal.date : weekStart(cal.date);
  const to = cal.view === 'day' ? cal.date : addDaysStr(weekStart(cal.date), 6);
  const staffQ = cal.staffFilter ? `&staff_id=${cal.staffFilter}` : '';
  cal.appointments = await api.get(`/api/appointments?from=${from}&to=${to}${staffQ}`);
  draw(container);
}

function draw(container) {
  computeRange();
  const pool = visibleStaff();
  const staffList = cal.staffFilter
    ? pool.filter((s) => s.id === cal.staffFilter)
    : pool;

  const label = cal.view === 'day'
    ? fmtDate(cal.date)
    : `${fmtDate(weekStart(cal.date))} – ${fmtDate(addDaysStr(weekStart(cal.date), 6))}`;

  container.innerHTML = `
    <div class="page-head">
      <div class="ph-icon">${icon('calendar', 20)}</div>
      <div><h1>Calendar</h1><div class="ph-sub">Click an empty slot to book · drag to reschedule</div></div>
      <div class="ph-actions">
        <button class="btn primary" id="new-appt">${icon('plus')} New appointment</button>
      </div>
    </div>
    <div class="card cal-card">
      <div class="cal-toolbar">
        <button class="btn small" id="cal-today">Today</button>
        <button class="icon-btn" id="cal-prev">${icon('chevL')}</button>
        <span class="cal-date-label">${esc(label)}</span>
        <button class="icon-btn" id="cal-next">${icon('chevR')}</button>
        <input type="date" id="cal-date" value="${cal.date}" style="background:var(--bg-raise);border:1px solid var(--border);border-radius:8px;padding:5px 9px;color-scheme:dark">
        <div class="spacer" style="flex:1"></div>
        ${state.locations.length > 1 ? `
        <select id="cal-location" style="background:var(--bg-raise);border:1px solid var(--border);border-radius:8px;padding:6px 10px">
          <option value="0">All locations</option>
          ${state.locations.map((l) => `<option value="${l.id}" ${cal.locationFilter === l.id ? 'selected' : ''}>${esc(l.name)}</option>`).join('')}
        </select>` : ''}
        <select id="cal-staff" style="background:var(--bg-raise);border:1px solid var(--border);border-radius:8px;padding:6px 10px">
          <option value="0">All team members</option>
          ${visibleStaff().map((s) => `<option value="${s.id}" ${cal.staffFilter === s.id ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}
        </select>
        <div class="seg">
          <button data-view="day" class="${cal.view === 'day' ? 'active' : ''}">Day</button>
          <button data-view="week" class="${cal.view === 'week' ? 'active' : ''}">Week</button>
        </div>
      </div>
      <div class="cal-scroll" id="cal-scroll">
        ${cal.view === 'day' ? dayGridHtml(staffList) : weekGridHtml()}
      </div>
    </div>`;

  wireToolbar(container);
  wireGrid(container, staffList);

  // Land on opening hours (off-hours sit above, reachable by scrolling up); on
  // today, bias to ~1h before now but never above the opening time.
  const scroll = container.querySelector('#cal-scroll');
  const nowMin = new Date().getHours() * 60 + new Date().getMinutes();
  const target = cal.date === todayStr()
    ? Math.max(yFor(openMin()), yFor(nowMin - 60))
    : yFor(openMin());
  scroll.scrollTop = Math.max(0, target);
}

// ---------------------------------------------------------------------------
// Grid HTML
// ---------------------------------------------------------------------------

function gridLinesHtml(height) {
  let html = '';
  for (let t = gridStart(); t <= gridEnd(); t += 60) {
    html += `<div class="hour-line" style="top:${yFor(t)}px"></div>`;
    if (t + 30 <= gridEnd()) html += `<div class="half-line" style="top:${yFor(t + 30)}px"></div>`;
  }
  return html;
}

function gutterHtml(height) {
  let labels = '';
  for (let t = gridStart(); t <= gridEnd(); t += 60) {
    // first label would be half-clipped by the sticky header if centered on its line
    const align = t === gridStart() ? ';transform:none' : '';
    labels += `<div class="g-label" style="top:${yFor(t)}px${align}">${fmtTime(t).replace(':00', '')}</div>`;
  }
  return `<div class="cal-gutter" style="height:${height}px">${labels}</div>`;
}

/** Assign side-by-side lanes to overlapping appointments within one column. */
function layoutLanes(appts) {
  const sorted = [...appts].sort((a, b) => a.start_min - b.start_min || a.end_min - b.end_min);
  const placed = [];
  for (const a of sorted) {
    const overlapping = placed.filter((p) => a.start_min < p.end_min && a.end_min > p.start_min);
    const used = new Set(overlapping.map((p) => p.lane));
    let lane = 0;
    while (used.has(lane)) lane++;
    a.lane = lane;
    placed.push(a);
  }
  for (const a of placed) {
    const cluster = placed.filter((p) => a.start_min < p.end_min && a.end_min > p.start_min);
    a.lanes = Math.max(...cluster.map((p) => p.lane)) + 1;
  }
  return placed;
}

function apptHtml(a, showStaff = false) {
  const top = yFor(a.start_min);
  const height = Math.max(20, (a.end_min - a.start_min) * PX_PER_MIN - 2);
  const width = 100 / (a.lanes || 1);
  const left = (a.lane || 0) * width;
  const color = a.staff_color || '#3987e5';
  const compact = height < 44;
  return `
    <div class="appt s-${esc(a.status)}" data-appt="${a.id}" tabindex="0"
      style="--c:${esc(color)};top:${top}px;height:${height}px;left:calc(${left}% + 2px);width:calc(${width}% - 5px)">
      <div class="a-time">${fmtTimeShort(a.start_min)} – ${fmtTime(a.end_min)}${a.source === 'online' ? ' · ⚡ online' : ''}${a.deposit_status === 'paid' ? ' · 💳 deposit' : ''}</div>
      <div class="a-client">${esc(a.client_name || 'Walk-in')}</div>
      ${compact ? '' : `<div class="a-service">${esc(a.services_summary || a.service_name || '')}${showStaff && a.staff_name ? ` · ${esc(a.staff_name)}` : ''}</div>`}
      <div class="a-resize" data-resize="${a.id}"></div>
    </div>`;
}

function dayGridHtml(staffList) {
  const height = yFor(gridEnd());
  const isToday = cal.date === todayStr();
  const nowMin = new Date().getHours() * 60 + new Date().getMinutes();

  const heads = staffList.map((s) => `
    <div class="cal-head-col">
      <div class="avatar-sm" style="background:${esc(s.color)}">${esc(initials(s.name))}</div>
      <div><div class="ch-name">${esc(s.name)}</div><div class="ch-sub">${esc(s.title || '')}</div></div>
    </div>`).join('');

  const cols = staffList.map((s) => {
    const appts = layoutLanes(cal.appointments.filter((a) => a.staff_id === s.id));
    return `
      <div class="cal-col" data-staff="${s.id}" data-date="${cal.date}" style="height:${height}px">
        ${offHoursHtml(cal.date)}
        ${gridLinesHtml(height)}
        ${isToday && nowMin >= gridStart() && nowMin <= gridEnd() ? `<div class="now-line" style="top:${yFor(nowMin)}px"></div>` : ''}
        ${appts.map((a) => apptHtml(a)).join('')}
      </div>`;
  }).join('');

  return `
    <div class="cal-head-row"><div class="cal-head-gutter"></div>${heads}</div>
    <div class="cal-body">${gutterHtml(height)}${cols}</div>`;
}

function weekGridHtml() {
  const height = yFor(gridEnd());
  const start = weekStart(cal.date);
  const today = todayStr();
  const nowMin = new Date().getHours() * 60 + new Date().getMinutes();
  const days = Array.from({ length: 7 }, (_, i) => addDaysStr(start, i));
  const staffIds = new Set(visibleStaff().map((s) => s.id));
  const weekAppts = cal.appointments.filter((a) => staffIds.has(a.staff_id));

  const heads = days.map((d) => {
    const dt = parseDate(d);
    return `
      <div class="cal-head-col day-head ${d === today ? 'today-col' : ''}" data-goto="${d}">
        <div class="ch-name">${['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][dt.getDay()]} ${dt.getDate()}</div>
        <div class="ch-sub">${weekAppts.filter((a) => a.date === d && a.status !== 'cancelled').length} appointments</div>
      </div>`;
  }).join('');

  const cols = days.map((d) => {
    const appts = layoutLanes(weekAppts.filter((a) => a.date === d));
    return `
      <div class="cal-col ${d === today ? 'today-col' : ''}" data-date="${d}" data-staff="0" style="height:${height}px">
        ${offHoursHtml(d)}
        ${gridLinesHtml(height)}
        ${d === today && nowMin >= gridStart() && nowMin <= gridEnd() ? `<div class="now-line" style="top:${yFor(nowMin)}px"></div>` : ''}
        ${appts.map((a) => apptHtml(a, true)).join('')}
      </div>`;
  }).join('');

  return `
    <div class="cal-head-row"><div class="cal-head-gutter"></div>${heads}</div>
    <div class="cal-body">${gutterHtml(height)}${cols}</div>`;
}

// ---------------------------------------------------------------------------
// Interaction
// ---------------------------------------------------------------------------

function wireToolbar(container) {
  const redraw = () => loadAndDraw(container);
  const step = cal.view === 'day' ? 1 : 7;
  container.querySelector('#cal-today').onclick = () => { cal.date = todayStr(); redraw(); };
  container.querySelector('#cal-prev').onclick = () => { cal.date = addDaysStr(cal.date, -step); redraw(); };
  container.querySelector('#cal-next').onclick = () => { cal.date = addDaysStr(cal.date, step); redraw(); };
  container.querySelector('#cal-date').onchange = (e) => { if (e.target.value) { cal.date = e.target.value; redraw(); } };
  container.querySelector('#cal-staff').onchange = (e) => { cal.staffFilter = Number(e.target.value); redraw(); };
  const locSel = container.querySelector('#cal-location');
  if (locSel) locSel.onchange = (e) => { cal.locationFilter = Number(e.target.value); cal.staffFilter = 0; redraw(); };
  container.querySelectorAll('[data-view]').forEach((b) => {
    b.onclick = () => { cal.view = b.dataset.view; redraw(); };
  });
  container.querySelector('#new-appt').onclick = () =>
    openAppointmentModal({ date: cal.date, onSaved: redraw });
}

function wireGrid(container, staffList) {
  const scroll = container.querySelector('#cal-scroll');
  const redraw = () => loadAndDraw(container);
  let drag = null; // {mode:'move'|'resize', appt, el, startY, startX, moved}

  scroll.querySelectorAll('.cal-head-col[data-goto]').forEach((h) => {
    h.onclick = () => { cal.date = h.dataset.goto; cal.view = 'day'; redraw(); };
  });

  scroll.addEventListener('mousedown', (e) => {
    const resizeEl = e.target.closest('[data-resize]');
    const apptEl = e.target.closest('.appt');
    if (!apptEl) return;
    const appt = cal.appointments.find((a) => a.id === Number(apptEl.dataset.appt));
    if (!appt) return;
    drag = {
      mode: resizeEl ? 'resize' : 'move',
      appt, el: apptEl,
      startY: e.clientY, startX: e.clientX,
      origStart: appt.start_min, origEnd: appt.end_min,
      moved: false,
      col: apptEl.closest('.cal-col'),
    };
    e.preventDefault();
  });

  scroll.addEventListener('mousemove', (e) => {
    if (!drag) return;
    const dy = e.clientY - drag.startY;
    const dx = e.clientX - drag.startX;
    if (!drag.moved && Math.abs(dy) < 5 && Math.abs(dx) < 5) return;
    drag.moved = true;
    drag.el.classList.add('dragging');
    const deltaMin = Math.round(dy / PX_PER_MIN / SNAP) * SNAP;

    if (drag.mode === 'resize') {
      const newEnd = Math.max(drag.origStart + SNAP, Math.min(gridEnd(), drag.origEnd + deltaMin));
      drag.newEnd = newEnd;
      drag.el.style.height = `${Math.max(20, (newEnd - drag.appt.start_min) * PX_PER_MIN - 2)}px`;
      return;
    }
    // move: vertical time shift + horizontal column change (into off-hours too)
    const newStart = Math.max(gridStart(), Math.min(gridEnd() - (drag.origEnd - drag.origStart), drag.origStart + deltaMin));
    drag.newStart = newStart;
    drag.el.style.top = `${yFor(newStart)}px`;
    const col = document.elementsFromPoint(e.clientX, e.clientY).find((el) => el.classList?.contains('cal-col'));
    if (col && col !== drag.col) {
      col.appendChild(drag.el);
      drag.col = col;
      drag.el.style.left = '2px';
      drag.el.style.width = 'calc(100% - 5px)';
    }
  });

  const finishDrag = async () => {
    if (!drag) return;
    const d = drag; drag = null;
    d.el.classList.remove('dragging');
    if (!d.moved) { openAppointmentModal({ appointment: d.appt, onSaved: redraw }); return; }

    const duration = d.origEnd - d.origStart;
    const payload = {
      client_id: d.appt.client_id, service_id: d.appt.service_id,
      staff_id: d.mode === 'move' && d.col?.dataset.staff !== '0' ? Number(d.col.dataset.staff) : d.appt.staff_id,
      date: d.mode === 'move' ? (d.col?.dataset.date || d.appt.date) : d.appt.date,
      start_min: d.mode === 'move' ? (d.newStart ?? d.origStart) : d.appt.start_min,
      end_min: d.mode === 'move' ? (d.newStart ?? d.origStart) + duration : (d.newEnd ?? d.origEnd),
      status: d.appt.status, notes: d.appt.notes,
    };
    try {
      await api.put(`/api/appointments/${d.appt.id}`, payload);
      toast('Appointment updated');
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        const force = await confirmDialog('Double booking', `${esc(err.data?.conflict?.client_name || 'Another appointment')} is already booked then. Book anyway?`, { okText: 'Double-book' });
        if (force) { await api.put(`/api/appointments/${d.appt.id}`, { ...payload, force: true }); toast('Appointment updated'); }
      } else toast(err.message, 'err');
    }
    redraw();
  };
  scroll.addEventListener('mouseup', finishDrag);
  scroll.addEventListener('mouseleave', finishDrag);

  // click empty slot → new appointment
  scroll.addEventListener('click', (e) => {
    if (e.target.closest('.appt')) return;
    const col = e.target.closest('.cal-col');
    if (!col) return;
    const rect = col.getBoundingClientRect();
    // Clamp to the whole visible range, not just opening hours, so the owner
    // can click the shaded off-hours area to book a walk-in before/after hours.
    const min = Math.max(gridStart(), Math.min(gridEnd() - SNAP, minFor(e.clientY - rect.top)));
    openAppointmentModal({
      date: col.dataset.date,
      staff_id: Number(col.dataset.staff) || staffList[0]?.id,
      start_min: min,
      onSaved: redraw,
    });
  });
}

// ---------------------------------------------------------------------------
// Appointment modal (create / edit) — also used by the topbar quick action.
// ---------------------------------------------------------------------------

export async function openAppointmentModal({ appointment = null, date, staff_id, start_min, onSaved } = {}) {
  if (!state.staff.length || !state.services.length) await refreshLookups();
  const clients = await api.get('/api/clients');
  const a = appointment;
  const initialServiceIds = a?.service_ids_csv
    ? String(a.service_ids_csv).split(',').map(Number).filter(Boolean)
    : (a?.service_id ? [a.service_id] : []);
  const selStaff = a?.staff_id || staff_id || state.staff[0]?.id;
  const selStart = a?.start_min ?? start_min ?? 600;
  const duration = a ? a.end_min - a.start_min : (state.services.find((s) => s.id === initialServiceIds[0])?.duration_min || 60);

  const serviceOpts = (selId) => {
    const cats = [...new Set(state.services.map((s) => s.category))];
    return `<option value="">— No service —</option>` + cats.map((c) =>
      `<optgroup label="${esc(c)}">${state.services.filter((s) => s.category === c).map((s) =>
        `<option value="${s.id}" data-dur="${s.duration_min}" ${s.id === selId ? 'selected' : ''}>${esc(s.name)} — ${priceLabel(s)}</option>`).join('')}</optgroup>`
    ).join('');
  };

  const m = openModal({
    title: a ? 'Edit appointment' : 'New appointment',
    wide: true,
    body: `
      <form id="appt-form" class="form-grid">
        <div class="field span2"><label>Client</label>
          <select name="client_id">
            <option value="">— Walk-in / no client —</option>
            ${clients.map((c) => `<option value="${c.id}" ${a?.client_id === c.id ? 'selected' : ''}>${esc(c.first_name)} ${esc(c.last_name)}${c.phone ? ` · ${esc(c.phone)}` : ''}</option>`).join('')}
            <option value="__new__">＋ Add new client…</option>
          </select></div>
        <div class="form-grid span2" id="new-client-fields" style="display:none">
          <div class="field"><label>First name *</label><input name="nc_first"></div>
          <div class="field"><label>Last name</label><input name="nc_last"></div>
          <div class="field"><label>Phone</label><input name="nc_phone"></div>
          <div class="field"><label>Email</label><input name="nc_email" type="email"></div>
        </div>
        <div class="field span2"><label>Services</label>
          <div id="svc-list" class="svc-rows"></div>
          <button type="button" class="btn small" id="svc-add" style="margin-top:8px">${icon('plus')} Add another service</button></div>
        <div class="field"><label>Team member</label>
          <select name="staff_id">${state.staff.map((s) => `<option value="${s.id}" ${s.id === selStaff ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}</select></div>
        <div class="field"><label>Date</label>
          <input type="date" name="date" value="${a?.date || date || todayStr()}" required style="color-scheme:dark"></div>
        <div class="field"><label>Start</label>
          <select name="start_min">${timeOptions(selStart, { from: 0, to: 1425 })}</select></div>
        <div class="field"><label>Duration</label>
          <select name="duration">${[15, 30, 45, 60, 75, 90, 105, 120, 150, 180, 240, 300].map((v) =>
            `<option value="${v}" ${v === duration ? 'selected' : ''}>${v >= 60 ? `${Math.floor(v / 60)}h${v % 60 ? ` ${v % 60}m` : ''}` : `${v} min`}</option>`).join('')}</select></div>
        <div class="field span2"><label>Status</label>
          <select name="status">${['booked', 'confirmed', 'completed', 'cancelled', 'no_show'].map((s) =>
            `<option value="${s}" ${(a?.status || 'booked') === s ? 'selected' : ''}>${{ booked: 'Booked', confirmed: 'Confirmed', completed: 'Completed', cancelled: 'Cancelled', no_show: 'No-show' }[s]}</option>`).join('')}</select></div>
        <div class="field span2"><label>Notes</label><textarea name="notes" placeholder="Anything the team should know…">${esc(a?.notes || '')}</textarea></div>
        ${a?.deposit_status ? `<div class="span2 cell-sub">💳 Online deposit ${a.deposit_status === 'paid'
          ? `<b style="color:var(--green)">${money(a.deposit_cents)} paid</b> — it will be credited automatically at checkout`
          : '<b style="color:var(--amber)">pending</b> — the client started but didn\'t finish the deposit payment'}</div>` : ''}
      </form>`,
    footer: `
      ${a ? `<button class="btn danger" id="appt-delete">${icon('trash')} Delete</button>` : ''}
      <div class="spacer"></div>
      ${a ? `<button class="btn" id="appt-invoice">${icon('invoice')} ${a.invoice_id ? 'View invoice' : 'Checkout / bill'}</button>` : ''}
      <button class="btn primary" id="appt-save">${icon('check')} ${a ? 'Save changes' : 'Book appointment'}</button>`,
  });

  const form = m.querySelector('#appt-form');
  const clientSel = form.querySelector('[name=client_id]');
  clientSel.addEventListener('change', () => {
    form.querySelector('#new-client-fields').style.display = clientSel.value === '__new__' ? 'grid' : 'none';
  });
  // Multi-service rows: one or more service pickers; the duration auto-sums
  // whenever the set changes (the owner can still override it afterwards).
  const svcList = form.querySelector('#svc-list');
  const durationSel = form.querySelector('[name=duration]');
  const chosenServiceIds = () => [...svcList.querySelectorAll('.svc-sel')].map((s) => Number(s.value)).filter(Boolean);
  const recomputeDuration = () => {
    const total = chosenServiceIds().reduce((sum, id) => sum + (state.services.find((s) => s.id === id)?.duration_min || 0), 0);
    if (total) durationSel.value = total;
  };
  const addServiceRow = (selId = '') => {
    const row = document.createElement('div');
    row.className = 'svc-row';
    row.innerHTML = `<select class="svc-sel">${serviceOpts(selId)}</select>
      <button type="button" class="icon-btn svc-rm" title="Remove service">${icon('x', 14)}</button>`;
    svcList.appendChild(row);
    row.querySelector('.svc-sel').addEventListener('change', recomputeDuration);
    row.querySelector('.svc-rm').onclick = () => {
      if (svcList.querySelectorAll('.svc-row').length <= 1) { row.querySelector('.svc-sel').value = ''; }
      else row.remove();
      recomputeDuration();
    };
  };
  (initialServiceIds.length ? initialServiceIds : ['']).forEach((id) => addServiceRow(id));
  form.querySelector('#svc-add').onclick = () => addServiceRow('');

  const save = async (force = false) => {
    const fd = new FormData(form);
    const start = Number(fd.get('start_min'));
    const payload = {
      client_id: fd.get('client_id') === '__new__' ? null : Number(fd.get('client_id')) || null,
      new_client: fd.get('client_id') === '__new__' ? {
        first_name: fd.get('nc_first'), last_name: fd.get('nc_last'),
        phone: fd.get('nc_phone'), email: fd.get('nc_email'),
      } : undefined,
      service_ids: chosenServiceIds(),
      service_id: chosenServiceIds()[0] || null,
      staff_id: Number(fd.get('staff_id')),
      date: fd.get('date'),
      start_min: start,
      end_min: start + Number(fd.get('duration')),
      status: fd.get('status'),
      notes: fd.get('notes'),
      force,
    };
    if (payload.new_client && !String(payload.new_client.first_name || '').trim()) {
      toast('Enter the new client\'s first name', 'err');
      return;
    }
    try {
      if (a) await api.put(`/api/appointments/${a.id}`, payload);
      else await api.post('/api/appointments', payload);
      toast(a ? 'Appointment updated' : 'Appointment booked');
      m.close();
      onSaved?.();
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        const ok = await confirmDialog('Double booking',
          `That slot overlaps <b>${esc(err.data?.conflict?.client_name || 'another appointment')}</b> (${fmtTime(err.data?.conflict?.start_min || 0)}). Book anyway?`,
          { okText: 'Double-book' });
        if (ok) save(true);
      } else toast(err.message, 'err');
    }
  };
  m.querySelector('#appt-save').onclick = () => save();

  if (a) {
    m.querySelector('#appt-delete').onclick = async () => {
      const ok = await confirmDialog('Delete appointment', 'This permanently removes the appointment. Cancelling instead keeps it on record.', { danger: true, okText: 'Delete' });
      if (!ok) return;
      await api.del(`/api/appointments/${a.id}`);
      toast('Appointment deleted');
      m.close();
      onSaved?.();
    };
    m.querySelector('#appt-invoice').onclick = async () => {
      try {
        const inv = await api.post('/api/invoices/from-appointment', { appointment_id: a.id });
        m.close();
        location.hash = `#/invoices?open=${inv.id}`;
      } catch (err) { toast(err.message, 'err'); }
    };
  }
}
