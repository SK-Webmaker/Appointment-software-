// Team: who takes bookings, and when they work.
//
// Two tabs, deliberately. Fresha puts four here — team members, scheduled
// shifts, timesheets and pay runs — but the last two are payroll: clocking in
// to evidence hours, and settling wages, tips and commission. Neither changes
// what a customer can book, which is what this system is for, so neither is
// here. What matters is the roster: it is the difference between a booking page
// that offers Tuesday and a stylist who does not work Tuesdays.
import { api } from '../api.js';
import { esc, icon, openModal, confirmDialog, toast, initials, timeOptions, fmtDate, todayStr, addDaysStr, parseDate, dateToStr } from '../ui.js';
import { refreshLookups, state } from '../app.js';
import { fmtDuration } from '../roster.js';

const COLORS = ['#3987e5', '#199e70', '#9085e9', '#e5a039', '#d55181', '#2dd4bf', '#60a5fa'];
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const view = { tab: 'members', weekStart: mondayOf(todayStr()) };

function mondayOf(dateStr) {
  const d = parseDate(dateStr);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return dateToStr(d);
}

export async function renderStaff(container, params) {
  if (params?.get('tab') === 'shifts') view.tab = 'shifts';
  container.innerHTML = `
    <div class="page-head">
      <div class="ph-icon">${icon('user', 20)}</div>
      <div><h1>Team</h1><div class="ph-sub">Who takes bookings, and the hours they work</div></div>
      <div class="ph-actions" id="team-actions"></div>
    </div>
    <div class="seg team-tabs" id="team-tabs">
      <button data-tab="members" class="${view.tab === 'members' ? 'active' : ''}">Team members</button>
      <button data-tab="shifts" class="${view.tab === 'shifts' ? 'active' : ''}">Scheduled shifts</button>
    </div>
    <div id="team-body"><div class="empty">Loading…</div></div>`;

  container.querySelector('#team-tabs').addEventListener('click', (e) => {
    const b = e.target.closest('[data-tab]');
    if (!b || b.dataset.tab === view.tab) return;
    view.tab = b.dataset.tab;
    renderStaff(container);
  });

  if (view.tab === 'members') await renderMembers(container);
  else await renderShifts(container);
}

// ---------------------------------------------------------------------------
// Team members
// ---------------------------------------------------------------------------

async function renderMembers(container) {
  const staff = await api.get('/api/staff?all=1');
  const redraw = async () => { await refreshLookups(); renderStaff(container); };

  container.querySelector('#team-actions').innerHTML =
    `<button class="btn primary" id="st-new">${icon('plus')} Add team member</button>`;
  container.querySelector('#st-new').onclick = () => openStaffModal({ onSaved: redraw });

  container.querySelector('#team-body').innerHTML = `
    <div class="svc-grid">
      ${staff.map((s) => `
        <div class="card svc-card" data-id="${s.id}" style="${s.active ? '' : 'opacity:0.55'}">
          <div class="row-flex">
            <div class="avatar-sm" style="width:38px;height:38px;background:${esc(s.color)}">${esc(initials(s.name))}</div>
            <div style="flex:1;min-width:0">
              <div class="sc-name">${esc(s.name)}</div>
              <div class="cell-sub">${esc(s.title || 'Team member')}${s.location_name && state.locations.length > 1 ? ` · ${esc(s.location_name)}` : ''}</div>
            </div>
            ${s.active ? '' : '<span class="chip">Inactive</span>'}
          </div>
        </div>`).join('')}
    </div>`;

  container.querySelectorAll('[data-id]').forEach((el) => {
    el.onclick = () => openStaffModal({ staff: staff.find((s) => s.id === Number(el.dataset.id)), onSaved: redraw });
  });
}

// ---------------------------------------------------------------------------
// Scheduled shifts
// ---------------------------------------------------------------------------

async function renderShifts(container) {
  const from = view.weekStart;
  const to = addDaysStr(from, 6);
  const body = container.querySelector('#team-body');
  const grid = await api.get(`/api/roster?from=${from}&to=${to}`);

  container.querySelector('#team-actions').innerHTML = '';

  const dayTotals = grid.dates.map((d) => grid.members
    .reduce((n, m) => n + (m.days.find((x) => x.date === d)?.working
      ? m.days.find((x) => x.date === d).close_min - m.days.find((x) => x.date === d).open_min : 0), 0));

  body.innerHTML = `
    <div class="card">
      <div class="cal-toolbar">
        <div class="cal-nav">
          <button class="icon-btn" id="sh-prev" aria-label="Previous week">${icon('chevL')}</button>
          <span class="cal-date-label" style="cursor:default">${esc(fmtDate(from))} – ${esc(fmtDate(to))}</span>
          <button class="icon-btn" id="sh-next" aria-label="Next week">${icon('chevR')}</button>
        </div>
        <div class="cal-tools"><button class="btn small" id="sh-this">This week</button></div>
      </div>

      <div class="roster-scroll">
        <table class="roster">
          <thead>
            <tr>
              <th class="rs-who">Team member</th>
              ${grid.dates.map((d, i) => `
                <th${d === todayStr() ? ' class="is-today"' : ''}>
                  <div class="rs-day">${DAY_SHORT[parseDate(d).getDay()]}, ${esc(fmtDate(d).replace(/^\w+,\s*/, ''))}</div>
                  <div class="rs-sub">${grid.salon_hours[d] ? fmtDuration(dayTotals[i]) : 'Closed'}</div>
                </th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${grid.members.map((m) => `
              <tr>
                <td class="rs-who">
                  <div class="row-flex">
                    <div class="avatar-sm" style="background:${esc(m.color)}">${esc(initials(m.name))}</div>
                    <div style="flex:1;min-width:0">
                      <div class="cell-main">${esc(m.name)}</div>
                      <div class="cell-sub">${fmtDuration(m.minutes)}${m.follows_opening_hours ? ' · follows salon hours' : ''}</div>
                    </div>
                    <button class="icon-btn" data-pattern="${m.id}" title="Set ${esc(m.name)}'s usual week">${icon('edit', 15)}</button>
                  </div>
                </td>
                ${m.days.map((d) => `
                  <td>
                    <button class="rs-cell${d.working ? '' : ' is-off'}${d.source === 'date' ? ' is-custom' : ''}"
                      data-shift="${m.id}" data-date="${d.date}" ${d.salon_closed ? 'disabled' : ''}>
                      ${d.salon_closed ? 'Closed'
                        : d.working ? `${shortTime(d.open_min)} – ${shortTime(d.close_min)}` : 'Not working'}
                    </button>
                  </td>`).join('')}
              </tr>`).join('')}
          </tbody>
        </table>
      </div>

      <div class="insight" style="text-align:left;margin:16px 0 0">
        <b>This roster is what your booking page offers.</b> A customer is only shown times
        when the person they picked is rostered on <i>and</i> the salon is open. Anyone with no
        usual week set simply follows your opening hours, so nothing changes until you set one.
      </div>
    </div>`;

  const reload = () => renderStaff(container);
  body.querySelector('#sh-prev').onclick = () => { view.weekStart = addDaysStr(from, -7); reload(); };
  body.querySelector('#sh-next').onclick = () => { view.weekStart = addDaysStr(from, 7); reload(); };
  body.querySelector('#sh-this').onclick = () => { view.weekStart = mondayOf(todayStr()); reload(); };

  body.querySelectorAll('[data-pattern]').forEach((b) => {
    b.onclick = (e) => {
      e.stopPropagation();
      const m = grid.members.find((x) => x.id === Number(b.dataset.pattern));
      openWeeklyPattern(m, reload);
    };
  });
  body.querySelectorAll('[data-shift]').forEach((b) => {
    b.onclick = () => {
      const m = grid.members.find((x) => x.id === Number(b.dataset.shift));
      const day = m.days.find((d) => d.date === b.dataset.date);
      openDayShift(m, day, reload);
    };
  });
}

const shortTime = (min) => {
  const h = Math.floor(min / 60), mm = min % 60;
  return `${h % 12 || 12}${mm ? `:${String(mm).padStart(2, '0')}` : ''} ${h >= 12 ? 'PM' : 'AM'}`;
};

/** The usual week — the pattern every date falls back to. */
async function openWeeklyPattern(member, onSaved) {
  const current = await api.get(`/api/staff/${member.id}/shifts`);
  const weekly = {};
  for (const w of current.weekly) weekly[w.weekday] = w;
  // Monday first: a working week reads Monday to Sunday, not Sunday first.
  const order = [1, 2, 3, 4, 5, 6, 0];

  const m = openModal({
    title: `${member.name}'s usual week`,
    body: `
      <p style="color:var(--text-2);line-height:1.6;margin:0 0 4px">
        The hours ${esc(member.name.split(' ')[0])} is normally available for bookings. Anything
        outside these is never offered online${current.follows_opening_hours
          ? " — right now they have no week set, so they follow the salon's opening hours." : '.'}
      </p>
      <div id="wk-rows">
        ${order.map((dow) => {
          const row = weekly[dow];
          return `
          <div class="shift-row" data-dow="${dow}">
            <label class="shift-on">
              <input type="checkbox" class="chk" data-on ${row ? 'checked' : ''}>
              <span>${DAY_NAMES[dow]}</span>
            </label>
            <div class="shift-times" ${row ? '' : 'hidden'}>
              <select data-start class="nice-select">${timeOptions(row?.start_min ?? 540, { step: 15 })}</select>
              <span class="shift-dash">–</span>
              <select data-end class="nice-select">${timeOptions(row?.end_min ?? 1020, { step: 15 })}</select>
            </div>
            <span class="shift-off" ${row ? 'hidden' : ''}>Not working</span>
          </div>`;
        }).join('')}
      </div>`,
    footer: `
      ${current.follows_opening_hours ? '' : `<button class="btn" id="wk-clear">Clear the week</button>`}
      <div class="spacer"></div>
      <button class="btn" data-cancel>Cancel</button>
      <button class="btn primary" id="wk-save">${icon('check')} Save</button>`,
  });

  m.querySelector('#wk-rows').addEventListener('change', (e) => {
    const row = e.target.closest('.shift-row');
    if (!row || !e.target.matches('[data-on]')) return;
    const on = e.target.checked;
    row.querySelector('.shift-times').hidden = !on;
    row.querySelector('.shift-off').hidden = on;
  });
  m.querySelector('[data-cancel]').onclick = () => m.close();

  const collect = () => [...m.querySelectorAll('.shift-row')]
    .filter((row) => row.querySelector('[data-on]').checked)
    .map((row) => ({
      weekday: Number(row.dataset.dow),
      start_min: Number(row.querySelector('[data-start]').value),
      end_min: Number(row.querySelector('[data-end]').value),
      working: true,
    }));

  m.querySelector('#wk-save').onclick = async () => {
    const days = collect();
    const bad = days.find((d) => d.end_min <= d.start_min);
    if (bad) { toast(`${DAY_NAMES[bad.weekday]} finishes before it starts`, 'err'); return; }
    try {
      await api.put(`/api/staff/${member.id}/shifts`, { days });
      toast(days.length ? `${member.name}'s week saved` : `${member.name} now follows salon hours`);
      m.close(); onSaved?.();
    } catch (err) { toast(err.message, 'err'); }
  };
  const clear = m.querySelector('#wk-clear');
  if (clear) clear.onclick = async () => {
    const ok = await confirmDialog('Clear the usual week',
      `${esc(member.name)} would go back to following the salon's opening hours — available whenever you're open.`,
      { okText: 'Clear it' });
    if (!ok) return;
    await api.put(`/api/staff/${member.id}/shifts`, { days: [] });
    toast(`${member.name} now follows salon hours`);
    m.close(); onSaved?.();
  };
}

/** One date: a different shift, or a day off. */
function openDayShift(member, day, onSaved) {
  const working = day.working;
  const m = openModal({
    title: `${member.name} — ${fmtDate(day.date)}`,
    body: `
      <div class="shift-choice" id="sd-choice">
        <label class="confirm-opt"><input type="radio" name="sd" class="chk" value="work" ${working ? 'checked' : ''}>
          <span><b>Working</b><span class="co-hint">Available for bookings between these times.</span></span></label>
        <label class="confirm-opt"><input type="radio" name="sd" class="chk" value="off" ${working ? '' : 'checked'}>
          <span><b>Not working</b><span class="co-hint">Nothing can be booked with them that day.</span></span></label>
      </div>
      <div class="shift-times" id="sd-times" ${working ? '' : 'hidden'} style="margin-top:14px">
        <select id="sd-start" class="nice-select">${timeOptions(day.open_min ?? 540, { step: 15 })}</select>
        <span class="shift-dash">–</span>
        <select id="sd-end" class="nice-select">${timeOptions(day.close_min ?? 1020, { step: 15 })}</select>
      </div>
      <div class="hint" style="margin-top:12px">
        ${day.source === 'date'
          ? 'This day has its own hours, set here.'
          : day.source === 'salon'
            ? 'Right now this follows your opening hours.'
            : `Right now this follows ${esc(member.name.split(' ')[0])}'s usual ${DAY_NAMES[parseDate(day.date).getDay()]}.`}
      </div>`,
    footer: `
      ${day.source === 'date' ? '<button class="btn" id="sd-reset">Back to usual</button>' : ''}
      <div class="spacer"></div>
      <button class="btn" data-cancel>Cancel</button>
      <button class="btn primary" id="sd-save">${icon('check')} Save</button>`,
  });

  m.querySelector('#sd-choice').addEventListener('change', () => {
    m.querySelector('#sd-times').hidden = m.querySelector('[value="work"]').checked === false;
  });
  m.querySelector('[data-cancel]').onclick = () => m.close();

  // Anyone already in the book for a time that is being rostered away is the
  // owner's problem to solve, so it is put in front of them rather than left to
  // be discovered when the client turns up.
  const warnStranded = (res) => {
    if (!res?.stranded?.length) return;
    const list = res.stranded.map((a) => `${esc(a.client_name || 'Walk-in')} at ${shortTime(a.start_min)}`).join(', ');
    toast(`Still booked outside those hours: ${list}`, 'err', { ms: 9000 });
  };

  m.querySelector('#sd-save').onclick = async () => {
    const isWorking = m.querySelector('[value="work"]').checked;
    const start = Number(m.querySelector('#sd-start').value);
    const end = Number(m.querySelector('#sd-end').value);
    if (isWorking && end <= start) { toast('That shift finishes before it starts', 'err'); return; }
    try {
      const res = await api.put(`/api/staff/${member.id}/shifts/${day.date}`,
        isWorking ? { working: true, start_min: start, end_min: end } : { working: false });
      toast(isWorking ? 'Shift saved' : `${member.name} is off that day`);
      m.close(); onSaved?.();
      warnStranded(res);
    } catch (err) { toast(err.message, 'err'); }
  };
  const reset = m.querySelector('#sd-reset');
  if (reset) reset.onclick = async () => {
    const res = await api.del(`/api/staff/${member.id}/shifts/${day.date}`);
    toast('Back to their usual hours');
    m.close(); onSaved?.();
    warnStranded(res);
  };
}

// ---------------------------------------------------------------------------
// Add / edit a team member
// ---------------------------------------------------------------------------

function openStaffModal({ staff = null, onSaved } = {}) {
  const s = staff;
  let color = s?.color || COLORS[0];
  const m = openModal({
    title: s ? 'Edit team member' : 'Add team member',
    body: `
      <form id="st-form" class="form-grid">
        <div class="field"><label>Name *</label><input name="name" required value="${esc(s?.name || '')}"></div>
        <div class="field"><label>Title</label><input name="title" value="${esc(s?.title || '')}" placeholder="Stylist"></div>
        ${state.locations.length > 1 ? `
        <div class="field span2"><label>Location</label>
          <select name="location_id">
            ${state.locations.map((l) => `<option value="${l.id}" ${s?.location_id === l.id ? 'selected' : ''}>${esc(l.name)}</option>`).join('')}
          </select></div>` : ''}
        <div class="field span2"><label>Calendar colour</label>
          <div id="st-colors" class="color-row">
            ${COLORS.map((c) => `<button type="button" class="color-dot${c === color ? ' is-on' : ''}" data-c="${c}" style="--dot:${c}" aria-label="Colour ${esc(c)}"></button>`).join('')}
          </div></div>
        ${s ? `<div class="field span2">
          <label style="display:flex;align-items:center;gap:8px;font-weight:500;color:var(--text-2);cursor:pointer">
            <input type="checkbox" name="active" ${s.active ? 'checked' : ''} class="chk"> Active (shown on calendar &amp; booking page)</label></div>` : ''}
      </form>`,
    footer: `
      ${s ? `<button class="btn danger" id="st-delete">${icon('trash')} Remove</button>` : ''}
      <div class="spacer"></div>
      ${s ? `<button class="btn" id="st-hours">${icon('clock')} Working hours</button>` : ''}
      <button class="btn primary" id="st-save">${icon('check')} ${s ? 'Save' : 'Add'}</button>`,
  });

  m.querySelector('#st-colors').addEventListener('click', (e) => {
    const b = e.target.closest('[data-c]');
    if (!b) return;
    color = b.dataset.c;
    m.querySelectorAll('[data-c]').forEach((x) => x.classList.toggle('is-on', x.dataset.c === color));
  });

  m.querySelector('#st-save').onclick = async () => {
    const fd = new FormData(m.querySelector('#st-form'));
    if (!String(fd.get('name') || '').trim()) { toast('Name is required', 'err'); return; }
    const payload = {
      name: fd.get('name'), title: fd.get('title'), color,
      active: s ? fd.get('active') === 'on' : true,
      location_id: fd.get('location_id') ? Number(fd.get('location_id')) : (s?.location_id ?? state.locations[0]?.id),
    };
    try {
      if (s) await api.put(`/api/staff/${s.id}`, payload);
      else await api.post('/api/staff', payload);
      toast(s ? 'Team member updated' : 'Team member added');
      m.close(); onSaved?.();
    } catch (err) { toast(err.message, 'err'); }
  };
  const hoursBtn = m.querySelector('#st-hours');
  if (hoursBtn) hoursBtn.onclick = () => { m.close(); openWeeklyPattern(s, onSaved); };
  if (s) {
    m.querySelector('#st-delete').onclick = async () => {
      const ok = await confirmDialog('Remove team member', `Remove <b>${esc(s.name)}</b>? If they have appointment history they are deactivated instead of deleted.`, { danger: true, okText: 'Remove' });
      if (!ok) return;
      const res = await api.del(`/api/staff/${s.id}`);
      toast(res.deactivated ? 'Deactivated (has appointment history)' : 'Removed');
      m.close(); onSaved?.();
    };
  }
}
