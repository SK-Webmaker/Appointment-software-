// Calendar: Fresha-style day view (staff columns) + week view, click-to-book,
// drag-to-reschedule, and the appointment editor modal.
import { api, ApiError } from '../api.js';
import {
  esc, icon, money, priceLabel, fmtTime, fmtTimeShort, fmtDate, todayStr, addDaysStr, parseDate, dateToStr,
  openModal, confirmDialog, toast, timeOptions, statusChip, initials, avatarColor,
} from '../ui.js';
import { state, refreshLookups } from '../app.js';
import { hoursForDate, describeRule, parseDayRules } from '../hours.js';
import { bookableWindow, buildRoster } from '../roster.js';

const PX_PER_MIN = 1.15;
const SNAP = 15;

const cal = {
  date: todayStr(),
  view: 'day',        // 'day' | 'week'
  staffFilter: 0,     // 0 = everyone
  locationFilter: 0,  // 0 = all locations
  appointments: [],
  blocks: [],         // owner-only blocked time (unbookable online)
  rosters: {},        // staff id → their working pattern, for the shading
};

function visibleStaff() {
  return cal.locationFilter
    ? state.staff.filter((s) => s.location_id === cal.locationFilter)
    : state.staff;
}

const openMin = () => Number(state.settings.open_min || 480);
const closeMin = () => Number(state.settings.close_min || 1200);

// Opening hours for one date — respects days that run only every 2nd/3rd/4th
// week and days with their own hours. Returns null when the salon is shut.
const hoursOn = (date) => hoursForDate(date, state.settings);
// The dates currently on screen: one in day view, seven in week view.
function visibleDates() {
  if (cal.view !== 'week') return [cal.date];
  const ws = weekStart(cal.date);
  return Array.from({ length: 7 }, (_, i) => addDaysStr(ws, i));
}

// The calendar shows a WIDER range than opening hours (Fresha-style): a couple
// of padding hours before/after, expanded further to include any appointment
// the owner squeezed in outside hours. Opening hours are the normal (bookable)
// band; the padded off-hours are shaded but still schedulable by the owner.
// The public booking page is unaffected — it still uses open/close only.
const RANGE_PAD = 120; // default padding shown before open / after close
function computeRange() {
  // The owner can set an explicit visible window (Settings → Calendar view);
  // otherwise it's a couple of hours around opening time. Either way it expands
  // to include any appointment booked outside the window so none is hidden.
  const cs = state.settings.cal_start_min, ce = state.settings.cal_end_min;
  // On Auto, the band follows the hours of the days actually on screen, so a
  // day with its own longer hours is never cut off at the top or bottom.
  const shown = visibleDates().map(hoursOn).filter(Boolean);
  const dayOpen = shown.length ? Math.min(...shown.map((h) => h.open)) : openMin();
  const dayClose = shown.length ? Math.max(...shown.map((h) => h.close)) : closeMin();
  let lo = (cs !== '' && cs != null) ? Number(cs) : dayOpen - RANGE_PAD;
  let hi = (ce !== '' && ce != null) ? Number(ce) : dayClose + RANGE_PAD;
  for (const a of [...(cal.appointments || []), ...(cal.blocks || [])]) {
    lo = Math.min(lo, a.start_min); hi = Math.max(hi, a.end_min);
  }
  cal.gridStart = Math.max(0, Math.floor(lo / 60) * 60);
  cal.gridEnd = Math.min(1440, Math.ceil(hi / 60) * 60);
}
const gridStart = () => cal.gridStart ?? Math.max(0, openMin() - RANGE_PAD);
const gridEnd = () => cal.gridEnd ?? Math.min(1440, closeMin() + RANGE_PAD);
const yFor = (min) => (min - gridStart()) * PX_PER_MIN;
const minFor = (y) => Math.round((y / PX_PER_MIN + gridStart()) / SNAP) * SNAP;

// Shaded off-hours bands for one day column. On a closed day the whole column
// is off-hours; otherwise the areas before open and after close are shaded.
//
// With a staff id, the band is that person's own rostered window instead of the
// salon's — so a column reads at a glance as "Maya isn't in until 11", which is
// the whole point of having a roster. The owner can still book into the shade;
// it is information, not a wall.
function offHoursHtml(date, staffId = null) {
  const gs = gridStart(), ge = gridEnd();
  const band = (from, to, off = false) => (to > from
    ? `<div class="off-hours${off ? ' is-off-duty' : ''}" style="top:${(from - gs) * PX_PER_MIN}px;height:${(to - from) * PX_PER_MIN}px"></div>`
    : '');
  const salon = hoursOn(date);
  if (!salon) return band(gs, ge); // shut that day → whole column shaded

  const window = staffId ? bookableWindow(date, cal.rosters?.[staffId], salon) : salon;
  if (!window) return band(gs, ge, true); // rostered off → the whole column
  const offDuty = staffId && (window.open !== salon.open || window.close !== salon.close);
  return band(gs, window.open, offDuty) + band(window.close, ge, offDuty);
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
  const [appts, blocks, rosters] = await Promise.all([
    api.get(`/api/appointments?from=${from}&to=${to}${staffQ}`),
    api.get(`/api/time-blocks?from=${from}&to=${to}`),
    // Who is actually working, so a column can be shaded where its owner is not
    // in. Cheap and cached by the browser between navigations.
    api.get('/api/roster/patterns').catch(() => ({ rosters: {} })),
  ]);
  cal.rosters = Object.fromEntries(
    Object.entries(rosters.rosters || {}).map(([id, rows]) => [id, buildRoster(rows)])
  );
  // A cancelled booking is not a booking, so it comes off the diary entirely.
  //
  // Everything else already treats it that way — the booking page offers the
  // slot again the moment it's cancelled, and every availability query excludes
  // it. Leaving a faded ghost on the calendar was worse than useless: it sat on
  // top of the freed time and swallowed the click the owner would use to put
  // somebody else in it, it kept stealing a lane so the replacement booking
  // rendered half-width, and a cancelled late booking held the whole day's grid
  // stretched down to 8pm.
  //
  // Nothing is lost. The appointment stays on the client's own page under past
  // visits, in Messages, and in the Opportunities panel's count of
  // cancellations nobody filled. Undo still restores it, because that puts the
  // status back and this reads the status.
  //
  // No-shows deliberately stay: the client didn't turn up, but the time was
  // still spent, and the owner needs to see that it was.
  cal.appointments = appts.filter((a) => a.status !== 'cancelled');
  // Blocks are stored per staff member (or for everyone when staff_id is null),
  // so apply the staff filter here rather than in the query.
  cal.blocks = cal.staffFilter ? blocks.filter((b) => !b.staff_id || b.staff_id === cal.staffFilter) : blocks;
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
        <button class="btn" id="block-time">${icon('lock')} Block time</button>
        <button class="btn primary" id="new-appt">${icon('plus')} New appointment</button>
      </div>
    </div>
    <div class="card cal-card">
      <div class="cal-toolbar">
        <!-- Grouped so the chevrons can never be split from the date they move. -->
        <div class="cal-nav">
          <button class="icon-btn" id="cal-prev" aria-label="Previous">${icon('chevL')}</button>
          <!-- The date doubles as the date picker: tapping it opens the native
               calendar, so no separate date field is needed on a phone. -->
          <label class="cal-date-label" title="Jump to a date">${esc(label)}
            <input type="date" id="cal-date" value="${cal.date}" aria-label="Jump to date"></label>
          <button class="icon-btn" id="cal-next" aria-label="Next">${icon('chevR')}</button>
        </div>
        <div class="cal-tools">
          <button class="btn small" id="cal-today">Today</button>
          ${state.locations.length > 1 ? `
          <select id="cal-location" class="cal-pick">
            <option value="0">All locations</option>
            ${state.locations.map((l) => `<option value="${l.id}" ${cal.locationFilter === l.id ? 'selected' : ''}>${esc(l.name)}</option>`).join('')}
          </select>` : ''}
          <select id="cal-staff" class="cal-pick">
            <option value="0">All team members</option>
            ${visibleStaff().map((s) => `<option value="${s.id}" ${cal.staffFilter === s.id ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}
          </select>
          <div class="seg cal-viewseg">
            <button data-view="day" class="${cal.view === 'day' ? 'active' : ''}">Day</button>
            <button data-view="week" class="${cal.view === 'week' ? 'active' : ''}">Week</button>
          </div>
        </div>
      </div>
      ${cal.view === 'day' ? closedNoticeHtml(cal.date) : ''}
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
  // Under about two lines there is no room for both the time and the name, and
  // half a name sheared off by the block's edge reads as breakage. The name is
  // the part that identifies the booking, so on a very short one it is the part
  // that stays; the time is already obvious from where the block sits.
  const tiny = height < 30;
  // The client's standing notes (allergies, colour formula, preferences). A
  // marker always shows so nothing is missed on a short booking; the text
  // itself appears once the block is tall enough to hold it, and the full note
  // is always in the hover title.
  const notes = String(a.client_notes || '').trim();
  const roomy = height >= 76;
  const title = [
    `${fmtTime(a.start_min)} – ${fmtTime(a.end_min)}`,
    a.client_name || 'Walk-in',
    a.services_summary || a.service_name || '',
    notes ? `\nNote: ${notes}` : '',
  ].filter(Boolean).join(' · ');
  return `
    <div class="appt s-${esc(a.status)}${notes ? ' has-note' : ''}" data-appt="${a.id}" tabindex="0" title="${esc(title)}"
      style="--c:${esc(color)};top:${top}px;height:${height}px;left:calc(${left}% + 2px);width:calc(${width}% - 5px)">
      ${tiny ? '' : `<div class="a-time">${fmtTimeShort(a.start_min)} – ${fmtTime(a.end_min)}${a.source === 'online' ? ' · ⚡ online' : ''}${a.deposit_status === 'paid' ? ' · 💳 deposit' : ''}</div>`}
      <div class="a-client">${esc(a.client_name || 'Walk-in')}${notes ? `<span class="a-noteflag" aria-label="Has client notes">${icon('note', 12)}</span>` : ''}</div>
      ${compact ? '' : `<div class="a-service">${esc(a.services_summary || a.service_name || '')}${showStaff && a.staff_name ? ` · ${esc(a.staff_name)}` : ''}</div>`}
      ${notes && roomy ? `<div class="a-note">${icon('note', 11)}<span>${esc(notes)}</span></div>` : ''}
      <div class="a-resize" data-resize="${a.id}"></div>
    </div>`;
}

// Blocked time: a hatched band the owner can see (with their private reason)
// that online booking will never offer. Rendered under the appointment layer so
// an appointment booked over it still shows on top.
function blockHtml(b) {
  const top = yFor(b.start_min);
  const height = Math.max(16, (b.end_min - b.start_min) * PX_PER_MIN - 2);
  const compact = height < 36;
  const who = b.staff_id ? '' : ' · everyone';
  return `
    <div class="cal-block" data-block="${b.id}" tabindex="0"
      title="Blocked ${esc(fmtTimeShort(b.start_min))}–${esc(fmtTime(b.end_min))}${b.reason ? ` — ${esc(b.reason)}` : ''}"
      style="top:${top}px;height:${height}px">
      <div class="cb-label">${icon('lock', 12)} ${esc(b.reason || 'Blocked')}</div>
      ${compact ? '' : `<div class="cb-time">${fmtTimeShort(b.start_min)} – ${fmtTime(b.end_min)}${who}</div>`}
    </div>`;
}

/** Blocks that apply to one staff column on one date (null staff = everyone). */
function blocksForCol(date, staffId) {
  return (cal.blocks || []).filter((b) => b.date === date && (!b.staff_id || !staffId || b.staff_id === staffId));
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/**
 * How a cancellation would actually reach this client: "email", "text",
 * "email and text", or '' when there's no way to contact them. Mirrors the
 * server's channel rules so the dialog promises only what will really be sent.
 */
function clientReach(a) {
  if (!a?.client_id) return '';
  const pref = ['email', 'sms', 'both'].includes(state.settings.chan_confirmation)
    ? state.settings.chan_confirmation : 'email';
  const canEmail = Boolean(a.client_email);
  const canText = Boolean(a.client_phone) && state.settings.sms_notifications_enabled === '1';
  const out = [];
  if (pref !== 'sms' && canEmail) out.push('email');
  if (pref !== 'email' && canText) out.push('text');
  // The server falls back to whatever the client CAN receive, so match that.
  if (!out.length) {
    if (canEmail) out.push('email');
    else if (canText) out.push('text');
  }
  return out.join(' and ');
}

/** The ways this client can actually be reached, given what the salon has on. */
function reachWays(c) {
  return {
    email: Boolean(c?.client_email),
    sms: Boolean(c?.client_phone) && state.settings.sms_notifications_enabled === '1',
  };
}

/**
 * Ask whether the client should hear about this, and by what.
 *
 * Every booking the owner makes or moves is a change to somebody else's day,
 * and only the owner knows whether that person is standing at the counter or
 * expecting a text. So it is asked once, at the moment of saving, with the
 * channels this particular client can actually receive — never a promise of a
 * text to someone with no mobile, or of an email to someone who gave none.
 *
 * Returns null if the owner backed out of the save entirely, otherwise
 * { notify, channel, reach }.
 */
async function askNotify(contact, { title, message, okText }) {
  const ways = reachWays(contact);
  // Nobody to tell: no email, and either no mobile or texting is switched off.
  // Asking anyway would be a dialog whose only honest answer is "can't".
  if (!ways.email && !ways.sms) return { notify: false, channel: '', reach: false };

  const options = [];
  if (ways.email) options.push({ value: 'email', label: 'Email them', hint: contact.client_email });
  if (ways.sms) options.push({ value: 'sms', label: 'Text them', hint: contact.client_phone });
  if (ways.email && ways.sms) options.push({ value: 'both', label: 'Email and text them' });
  options.push({ value: 'none', label: 'Don\'t send anything', hint: 'You\'ll tell them yourself.' });

  // Starts on whatever Settings → Notifications says, narrowed to what this
  // client can receive, so the usual answer is one tap on Save.
  const pref = state.settings.chan_confirmation;
  const dflt = options.find((o) => o.value === pref)?.value || options[0].value;

  const ok = await confirmDialog(title, message, {
    okText, cancelText: 'Back', choices: { value: dflt, options },
  });
  if (!ok) return null;
  return { notify: ok.choice !== 'none', channel: ok.choice === 'none' ? '' : ok.choice, reach: true };
}

/** Put the owner's answer onto an appointment payload. */
function applyNotify(payload, choice) {
  payload.notify_client = Boolean(choice?.notify);
  if (choice?.channel) payload.notify_channel = choice.channel;
  return payload;
}

/**
 * Why the salon is shut today. Without this an "off" week of an alternating
 * day is just a fully shaded column, which reads as a fault rather than a
 * setting. The owner can still book over it — the grid stays clickable.
 */
function closedNoticeHtml(date) {
  if (hoursOn(date)) return '';
  const dow = parseDate(date).getDay();
  const rule = parseDayRules(state.settings.day_rules)[dow];
  const why = rule && rule.every_weeks > 1
    ? `${DAY_NAMES[dow]}s only run ${describeRule(rule).replace(/^E/, 'e')}, and this is an off week`
    : `Closed on ${DAY_NAMES[dow]}s`;
  return `<div class="cal-closed">${icon('lock', 14)}<span>${esc(why)}. Online booking is off; you can still book in here yourself.</span></div>`;
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
        ${offHoursHtml(cal.date, s.id)}
        ${gridLinesHtml(height)}
        ${blocksForCol(cal.date, s.id).map(blockHtml).join('')}
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
        <div class="ch-sub">${(() => {
          const n = weekAppts.filter((a) => a.date === d && a.status !== 'cancelled').length;
          return `${n} appointment${n === 1 ? '' : 's'}`;
        })()}</div>
      </div>`;
  }).join('');

  const cols = days.map((d) => {
    const appts = layoutLanes(weekAppts.filter((a) => a.date === d));
    return `
      <div class="cal-col ${d === today ? 'today-col' : ''}" data-date="${d}" data-staff="0" style="height:${height}px">
        ${offHoursHtml(d)}
        ${gridLinesHtml(height)}
        ${blocksForCol(d, 0).map(blockHtml).join('')}
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
  container.querySelector('#block-time').onclick = () =>
    openBlockModal({ date: cal.date, staff_id: cal.staffFilter, onSaved: redraw });
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

    // Dragging a block to a new time is a reschedule, and the client is the
    // one it happens to — so it asks before it saves, exactly as the editor
    // does. A resize only changes how long it runs, so it goes straight in.
    const movedTime = payload.date !== d.appt.date || payload.start_min !== d.appt.start_min;
    if (movedTime) {
      const choice = await askNotify(d.appt, {
        title: 'Moving this appointment',
        message: `<b>${esc(d.appt.client_name || 'This appointment')}</b> moves from `
          + `<b>${esc(fmtDate(d.appt.date))} at ${esc(fmtTime(d.appt.start_min))}</b> to `
          + `<b>${esc(fmtDate(payload.date))} at ${esc(fmtTime(payload.start_min))}</b>.`,
        okText: 'Move it',
      });
      if (!choice) { redraw(); return; }   // backed out → the block snaps back
      applyNotify(payload, choice);
    }
    const done = (out) => toast(!movedTime ? 'Appointment updated'
      : out?.client_notified ? `Moved — ${d.appt.client_name || 'the client'} has been told`
        : 'Moved — no message sent');

    try {
      done(await api.put(`/api/appointments/${d.appt.id}`, payload));
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        const blk = err.data?.block;
        const force = blk
          ? await confirmDialog('Blocked time', `That time is blocked out${blk.reason ? ` for <b>${esc(blk.reason)}</b>` : ''}. Book over it anyway?`, { okText: 'Book anyway' })
          : await confirmDialog('Double booking', `${esc(err.data?.conflict?.client_name || 'Another appointment')} is already booked then. Book anyway?`, { okText: 'Double-book' });
        if (force) done(await api.put(`/api/appointments/${d.appt.id}`, { ...payload, force: true }));
      } else toast(err.message, 'err');
    }
    redraw();
  };
  scroll.addEventListener('mouseup', finishDrag);
  scroll.addEventListener('mouseleave', finishDrag);

  // click empty slot → new appointment (or a blocked band → edit that block)
  scroll.addEventListener('click', (e) => {
    if (e.target.closest('.appt')) return;
    const blockEl = e.target.closest('.cal-block');
    if (blockEl) {
      const block = cal.blocks.find((b) => b.id === Number(blockEl.dataset.block));
      if (block) { openBlockModal({ block, onSaved: redraw }); return; }
    }
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
    return `<option value="">No service</option>` + cats.map((c) =>
      `<optgroup label="${esc(c)}">${state.services.filter((s) => s.category === c).map((s) =>
        `<option value="${s.id}" data-dur="${s.duration_min}" ${s.id === selId ? 'selected' : ''}>${esc(s.name)} · ${priceLabel(s)}</option>`).join('')}</optgroup>`
    ).join('');
  };

  const m = openModal({
    title: a ? 'Edit appointment' : 'New appointment',
    wide: true,
    body: `
      <form id="appt-form" class="form-grid">
        <div class="field span2"><label>Client</label>
          <div class="combo" id="client-combo">
            <div class="combo-input">${icon('search')}
              <input type="text" id="client-search" autocomplete="off" placeholder="Search name, phone or email, or leave blank for a walk-in">
              <button type="button" class="combo-clear icon-btn" id="client-clear" title="Clear" hidden>${icon('x', 14)}</button>
            </div>
            <input type="hidden" name="client_id" value="${a?.client_id || ''}">
            <div class="combo-menu" id="client-menu" hidden></div>
          </div></div>
        <!-- Whatever you've recorded about this client (allergies, formula,
             preferences) surfaces the moment they're picked. -->
        <div class="span2 client-note" id="client-note" hidden></div>
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
          <select name="staff_id" class="nice-select">${state.staff.map((s) => `<option value="${s.id}" ${s.id === selStaff ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}</select></div>
        <div class="field"><label>Date</label>
          <input type="date" name="date" value="${a?.date || date || todayStr()}" required style="color-scheme:dark"></div>
        <div class="field"><label>Start</label>
          <select name="start_min" class="nice-select">${timeOptions(selStart, { from: 0, to: 1425 })}</select></div>
        <div class="field"><label>Duration</label>
          <select name="duration" class="nice-select">${[15, 30, 45, 60, 75, 90, 105, 120, 150, 180, 240, 300].map((v) =>
            `<option value="${v}" ${v === duration ? 'selected' : ''}>${v >= 60 ? `${Math.floor(v / 60)}h${v % 60 ? ` ${v % 60}m` : ''}` : `${v} min`}</option>`).join('')}</select></div>
        <div class="span2 appt-summary" id="appt-summary"></div>
        <div class="field span2"><label>Status</label>
          <select name="status" class="nice-select">${['booked', 'confirmed', 'completed', 'cancelled', 'no_show'].map((s) =>
            `<option value="${s}" ${(a?.status || 'booked') === s ? 'selected' : ''}>${{ booked: 'Booked', confirmed: 'Confirmed', completed: 'Completed', cancelled: 'Cancelled', no_show: 'No-show' }[s]}</option>`).join('')}</select></div>
        <div class="field span2"><label>Notes</label><textarea name="notes" placeholder="Anything the team should know…">${esc(a?.notes || '')}</textarea>
          <div class="hint">Saved to this booking and added to the client's record, dated, so it comes up next time.</div></div>
        ${a?.deposit_status ? `<div class="span2 cell-sub">💳 Online deposit ${a.deposit_status === 'paid'
          ? `<b style="color:var(--green)">${money(a.deposit_cents)} paid</b>, credited automatically at checkout`
          : '<b style="color:var(--amber)">pending</b>. The client started but didn\'t finish the deposit payment'}</div>` : ''}
      </form>`,
    footer: `
      ${a && a.status !== 'cancelled' ? `<button class="btn danger" id="appt-cancel">${icon('x')} Cancel appointment</button>` : ''}
      <div class="spacer"></div>
      ${a && a.client_id ? `<button class="btn" id="appt-rebook">${icon('reply')} Rebook</button>` : ''}
      ${a ? `<button class="btn" id="appt-invoice">${icon('invoice')} ${a.invoice_id ? 'View invoice' : 'Checkout / bill'}</button>` : ''}
      <button class="btn primary" id="appt-save">${icon('check')} ${a ? 'Save changes' : 'Book appointment'}</button>`,
  });

  const form = m.querySelector('#appt-form');
  const svcList = form.querySelector('#svc-list');
  const durationSel = form.querySelector('[name=duration]');
  const startSel = form.querySelector('[name=start_min]');
  const summaryEl = form.querySelector('#appt-summary');
  const chosenServiceIds = () => [...svcList.querySelectorAll('.svc-sel')].map((s) => Number(s.value)).filter(Boolean);

  // Live "calculated time" — the total of all chosen services and the end time,
  // updated whenever the services, start or duration change.
  const fmtDur = (min) => (min >= 60 ? `${Math.floor(min / 60)}h${min % 60 ? ` ${min % 60}m` : ''}` : `${min}m`);
  const updateSummary = () => {
    const start = Number(startSel.value) || 0;
    const dur = Number(durationSel.value) || 0;
    const n = chosenServiceIds().length;
    summaryEl.innerHTML = `<span class="as-dur">${icon('clock', 14)} Total ${fmtDur(dur)}${n > 1 ? ` · ${n} services` : ''}</span>
      <span class="as-end">Ends ${fmtTime(Math.min(1440, start + dur))}</span>`;
  };
  // Multi-service rows: one or more service pickers; the duration auto-sums to
  // the total service time (the owner can still override it afterwards).
  // A summed total may not be one of the preset duration options (e.g. 330m),
  // so make sure a matching option exists before selecting it.
  const setDuration = (min) => {
    if (![...durationSel.options].some((o) => Number(o.value) === min)) {
      const opt = document.createElement('option');
      opt.value = min;
      opt.textContent = min >= 60 ? `${Math.floor(min / 60)}h${min % 60 ? ` ${min % 60}m` : ''}` : `${min} min`;
      // Keep the options in ascending order so the list stays tidy.
      const before = [...durationSel.options].find((o) => Number(o.value) > min);
      durationSel.insertBefore(opt, before || null);
    }
    durationSel.value = min;
  };
  const recomputeDuration = () => {
    const total = chosenServiceIds().reduce((sum, id) => sum + (state.services.find((s) => s.id === id)?.duration_min || 0), 0);
    if (total) setDuration(total);
    updateSummary();
  };
  startSel.addEventListener('change', updateSummary);
  durationSel.addEventListener('change', updateSummary);
  const addServiceRow = (selId = '') => {
    const row = document.createElement('div');
    row.className = 'svc-row';
    row.innerHTML = `<select class="svc-sel nice-select">${serviceOpts(selId)}</select>
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
  updateSummary();

  // Searchable client picker (type to filter by name / phone / email).
  const combo = form.querySelector('#client-combo');
  const searchInp = combo.querySelector('#client-search');
  const hidden = combo.querySelector('[name=client_id]');
  const menu = combo.querySelector('#client-menu');
  const clearBtn = combo.querySelector('#client-clear');
  const newFields = form.querySelector('#new-client-fields');
  const notePanel = form.querySelector('#client-note');
  const nameOf = (c) => `${c.first_name} ${c.last_name}`.trim() || '(no name)';

  // Show whatever is on record for this client — the thing you want in front of
  // you before you start (allergies, colour formula, how they like it).
  const showClientNote = (id) => {
    const c = clients.find((x) => x.id === Number(id));
    const notes = String(c?.notes || '').trim();
    if (!notes) { notePanel.hidden = true; notePanel.innerHTML = ''; return; }
    notePanel.hidden = false;
    notePanel.innerHTML = `
      <div class="cn-head">${icon('note', 13)} Notes on ${esc(nameOf(c))}
        <a class="cn-open" href="#/clients?open=${c.id}" title="Open client record">Open client</a></div>
      <div class="cn-body">${esc(notes)}</div>`;
  };

  if (a?.client_id) {
    const c = clients.find((x) => x.id === a.client_id);
    if (c) { searchInp.value = nameOf(c); clearBtn.hidden = false; }
    showClientNote(a.client_id);
  }

  const renderMenu = (q = '') => {
    const ql = q.trim().toLowerCase();
    const matches = clients
      .filter((c) => !ql || `${nameOf(c)} ${c.phone || ''} ${c.email || ''}`.toLowerCase().includes(ql))
      .slice(0, 60);
    menu.innerHTML =
      `<button type="button" class="combo-opt" data-id="">${icon('user', 14)} Walk-in / no client</button>` +
      matches.map((c) => `<button type="button" class="combo-opt" data-id="${c.id}">
        <span class="co-name">${esc(nameOf(c))}${String(c.notes || '').trim()
          ? `<span class="co-note" title="Has notes">${icon('note', 11)}</span>` : ''}</span>
        <span class="co-sub">${esc(c.phone || c.email || '')}</span></button>`).join('') +
      (ql && !matches.length ? `<div class="combo-empty">No client matches “${esc(q.trim())}”</div>` : '') +
      `<button type="button" class="combo-opt combo-new" data-id="__new__">${icon('plus', 14)} Add new client${ql ? `: “${esc(q.trim())}”` : ''}</button>`;
    menu.hidden = false;
  };
  const selectClient = (id, label = '') => {
    hidden.value = id;
    const isNew = id === '__new__';
    newFields.style.display = isNew ? 'grid' : 'none';
    if (isNew) { searchInp.value = ''; searchInp.placeholder = 'New client: fill in the details below'; if (label) newFields.querySelector('[name=nc_first]').value = label; }
    else { searchInp.value = id ? label : ''; }
    clearBtn.hidden = !(id && id !== '__new__');
    menu.hidden = true;
    showClientNote(id);
  };
  searchInp.addEventListener('focus', () => renderMenu(searchInp.value));
  searchInp.addEventListener('input', () => { hidden.value = ''; clearBtn.hidden = true; renderMenu(searchInp.value); });
  searchInp.addEventListener('blur', () => setTimeout(() => { menu.hidden = true; }, 150));
  menu.addEventListener('mousedown', (e) => e.preventDefault()); // keep input focus so the click lands before blur hides the menu
  menu.addEventListener('click', (e) => {
    const btn = e.target.closest('.combo-opt'); if (!btn) return;
    const id = btn.dataset.id;
    if (id === '__new__') selectClient('__new__', searchInp.value.trim());
    else if (id === '') selectClient('', '');
    else { const c = clients.find((x) => x.id === Number(id)); selectClient(Number(id), c ? nameOf(c) : ''); }
    searchInp.blur();
  });
  clearBtn.onclick = () => { selectClient('', ''); searchInp.focus(); };

  // There are two ways to call off a booking — the Cancel button, and setting
  // Status to Cancelled in the editor — and they must behave identically. Both
  // ask first, both offer the same choice about telling the client, and both
  // leave an undo. Shared here so the two can't drift apart.
  const askCancel = async () => {
    const who = a.client_name ? esc(a.client_name) : 'this client';
    const reach = clientReach(a);
    const ok = await confirmDialog(
      'Cancel this appointment?',
      `<b>${esc(fmtDate(a.date))} at ${esc(fmtTime(a.start_min))}</b> goes back on your booking page `
      + 'straight away. It stays on the calendar marked Cancelled.',
      {
        danger: true,
        okText: 'Cancel appointment',
        cancelText: 'Keep it',
        // Sometimes the owner is already on the phone to them, or it's a
        // no-show they'd rather handle in person. The choice belongs here,
        // at the moment of cancelling, not in Settings.
        ...(reach ? {
          checkbox: { label: `Let ${who} know by ${reach}`, hint: 'Turn off if you\'d rather tell them yourself.', checked: true },
        } : {}),
      },
    );
    if (!ok) return null;
    return { notify: reach ? Boolean(ok.checked) : false };
  };

  const cancelledToast = (out) => {
    // The client's message is held for a moment, so undo can still catch it —
    // that is what makes this a real undo and not just a re-booking. The server
    // is the one that knows whether a message actually went out: asking for one
    // doesn't create an email address, so this follows what it reports back.
    const held = out?.undo_seconds > 0;
    toast(
      held ? `Cancelled — ${a.client_name || 'the client'} will be told in a moment`
        : 'Cancelled — no message sent',
      'ok',
      {
        ms: 15000,
        action: {
          label: 'Undo',
          onClick: async () => {
            try {
              const back = await api.post(`/api/appointments/${a.id}/undo-cancel`, {});
              onSaved?.();
              toast(
                back.client_already_told
                  ? `Put back — but ${a.client_name || 'the client'} was already told, so give them a call`
                  : 'Put back on the calendar',
                back.client_already_told ? 'err' : 'ok',
                { ms: back.client_already_told ? 9000 : 3200 },
              );
            } catch (err) { toast(err.message, 'err', { ms: 7000 }); }
          },
        },
      },
    );
  };

  // Who this booking is for, as the notify prompt needs to see them: either a
  // client already on the books, or the one being typed in right now.
  const contactInForm = () => {
    const fd = new FormData(form);
    const id = fd.get('client_id');
    if (id === '__new__') {
      const nm = `${fd.get('nc_first') || ''} ${fd.get('nc_last') || ''}`.trim();
      return { client_id: -1, client_name: nm, client_email: fd.get('nc_email') || '', client_phone: fd.get('nc_phone') || '' };
    }
    const c = clients.find((x) => x.id === Number(id));
    return c ? { client_id: c.id, client_name: nameOf(c), client_email: c.email, client_phone: c.phone } : null;
  };

  const save = async (force = false, cancelChoice = null, notifyChoice = null) => {
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
    // Switching Status to Cancelled and hitting Save is a cancellation, so it
    // asks the same question rather than quietly emailing the client.
    if (a && payload.status === 'cancelled' && a.status !== 'cancelled') {
      cancelChoice = cancelChoice || await askCancel();
      if (!cancelChoice) return;
      payload.notify_client = cancelChoice.notify;
    }

    // Booking someone in, or moving them, is a change to their day — so ask
    // once, here, whether they hear about it and how. Anything else (a note, a
    // status, a longer service) doesn't change what they turn up for, so it
    // saves without a dialog. A cancellation has already asked, just above.
    const contact = contactInForm();
    const movedTime = Boolean(a) && (payload.date !== a.date || payload.start_min !== a.start_min);
    const isNew = !a && payload.status !== 'cancelled';
    if (!cancelChoice && contact && (isNew || movedTime)) {
      notifyChoice = notifyChoice || await askNotify(contact, movedTime
        ? {
          title: 'Moving this appointment',
          message: `<b>${esc(contact.client_name || 'This appointment')}</b> moves from `
            + `<b>${esc(fmtDate(a.date))} at ${esc(fmtTime(a.start_min))}</b> to `
            + `<b>${esc(fmtDate(payload.date))} at ${esc(fmtTime(payload.start_min))}</b>.`,
          okText: 'Save the change',
        }
        : {
          title: 'Booking them in',
          message: `<b>${esc(contact.client_name || 'This client')}</b> for `
            + `<b>${esc(fmtDate(payload.date))} at ${esc(fmtTime(payload.start_min))}</b>.`,
          okText: 'Book it',
        });
      if (!notifyChoice) return;
      applyNotify(payload, notifyChoice);
    }

    try {
      let out;
      if (a) out = await api.put(`/api/appointments/${a.id}`, payload);
      else out = await api.post('/api/appointments', payload);
      m.close();
      onSaved?.();
      const who = contact?.client_name || 'the client';
      if (cancelChoice) cancelledToast(out);
      else if (movedTime) toast(out?.client_notified ? `Moved — ${who} has been told` : 'Moved — no message sent');
      else if (isNew) toast(out?.client_notified ? `Booked — ${who} has been sent a confirmation` : 'Booked — no message sent');
      else toast('Appointment updated');
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        const blk = err.data?.block;
        const ok = blk
          ? await confirmDialog('Blocked time',
              `That slot runs into time you blocked out${blk.reason ? ` — <b>${esc(blk.reason)}</b>` : ''} (${fmtTime(blk.start_min)} – ${fmtTime(blk.end_min)}). Book over it anyway?`,
              { okText: 'Book anyway' })
          : await confirmDialog('Double booking',
              `That slot overlaps <b>${esc(err.data?.conflict?.client_name || 'another appointment')}</b> (${fmtTime(err.data?.conflict?.start_min || 0)}). Book anyway?`,
              { okText: 'Double-book' });
        if (ok) save(true, cancelChoice, notifyChoice);   // don't ask about the client twice
      } else toast(err.message, 'err');
    }
  };
  m.querySelector('#appt-save').onclick = () => save();

  if (a) {
    // Cancelling is the only way an appointment comes off the day — it frees
    // the slot, tells the client, and keeps the booking on record. There is no
    // separate delete: the two did the same job, except delete told nobody.
    const cancelBtn = m.querySelector('#appt-cancel');
    if (cancelBtn) cancelBtn.onclick = async () => {
      const choice = await askCancel();
      if (!choice) return;
      try {
        const out = await api.post(`/api/appointments/${a.id}/cancel`, { notify_client: choice.notify });
        m.close();
        onSaved?.();
        cancelledToast(out);
      } catch (err) { toast(err.message, 'err'); }
    };
    m.querySelector('#appt-invoice').onclick = async () => {
      try {
        const inv = await api.post('/api/invoices/from-appointment', { appointment_id: a.id });
        m.close();
        location.hash = `#/invoices?open=${inv.id}`;
      } catch (err) { toast(err.message, 'err'); }
    };
    const rebookBtn = m.querySelector('#appt-rebook');
    if (rebookBtn) rebookBtn.onclick = () => { m.close(); openRebookModal({ appointment: a, onSaved }); };
  }
}

// ---------------------------------------------------------------------------
// Blocked time modal (create / edit) — owner-only, never shown to customers.
// ---------------------------------------------------------------------------

export function openBlockModal({ block = null, date, staff_id, start_min, onSaved } = {}) {
  const b = block;
  const selStaff = b ? (b.staff_id || 0) : (staff_id || 0);
  const selStart = b?.start_min ?? (start_min ?? Math.max(openMin(), 720));
  const selEnd = b?.end_min ?? Math.min(1440, selStart + 60);

  const m = openModal({
    title: b ? 'Edit blocked time' : 'Block out time',
    body: `
      <form id="block-form" class="form-grid">
        <div class="field span2"><label>Who is unavailable</label>
          <select name="staff_id" class="nice-select">
            <option value="0" ${!selStaff ? 'selected' : ''}>Everyone (whole business)</option>
            ${state.staff.map((s) => `<option value="${s.id}" ${s.id === selStaff ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}
          </select></div>
        <div class="field"><label>Date</label>
          <input type="date" name="date" value="${b?.date || date || todayStr()}" required style="color-scheme:dark"></div>
        <div class="field"><label>Quick set</label>
          <button type="button" class="btn small" id="block-allday" style="width:100%;justify-content:center">${icon('clock')} All day</button></div>
        <div class="field"><label>From</label>
          <select name="start_min" class="nice-select">${timeOptions(selStart, { from: 0, to: 1425 })}</select></div>
        <div class="field"><label>Until</label>
          <select name="end_min" class="nice-select">${timeOptions(selEnd, { from: 15, to: 1440 })}</select></div>
        <div class="span2 appt-summary" id="block-summary"></div>
        <div class="field span2"><label>Reason (only you can see this)</label>
          <textarea name="reason" placeholder="Lunch, training, dentist, holiday…">${esc(b?.reason || '')}</textarea>
          <div class="hint">${icon('lock', 12)} Shown on your calendar only — customers never see it. Online booking is turned off for this time.</div></div>
      </form>`,
    footer: `
      ${b ? `<button class="btn danger" id="block-delete">${icon('trash')} Remove block</button>` : ''}
      <div class="spacer"></div>
      <button class="btn primary" id="block-save">${icon('check')} ${b ? 'Save changes' : 'Block this time'}</button>`,
  });

  const form = m.querySelector('#block-form');
  const startSel = form.querySelector('[name=start_min]');
  const endSel = form.querySelector('[name=end_min]');
  const summaryEl = form.querySelector('#block-summary');

  const fmtDur = (min) => (min >= 60 ? `${Math.floor(min / 60)}h${min % 60 ? ` ${min % 60}m` : ''}` : `${min}m`);
  const updateSummary = () => {
    const start = Number(startSel.value), end = Number(endSel.value);
    const mins = end - start;
    summaryEl.innerHTML = mins > 0
      ? `<span class="as-dur">${icon('lock', 14)} Blocked for ${fmtDur(mins)}</span>
         <span class="as-end">${fmtTime(start)} – ${fmtTime(end)}</span>`
      : `<span class="as-dur" style="color:var(--amber)">${icon('alert', 14)} The end time must be after the start</span>`;
  };
  // Keep the end sensible when the start moves past it.
  startSel.addEventListener('change', () => {
    if (Number(endSel.value) <= Number(startSel.value)) endSel.value = Math.min(1440, Number(startSel.value) + 60);
    updateSummary();
  });
  endSel.addEventListener('change', updateSummary);
  form.querySelector('#block-allday').onclick = () => {
    startSel.value = 0; endSel.value = 1440; updateSummary();
  };
  updateSummary();

  m.querySelector('#block-save').onclick = async () => {
    const fd = new FormData(form);
    const payload = {
      staff_id: Number(fd.get('staff_id')) || 0,
      date: fd.get('date'),
      start_min: Number(fd.get('start_min')),
      end_min: Number(fd.get('end_min')),
      reason: String(fd.get('reason') || '').trim(),
    };
    if (payload.end_min <= payload.start_min) { toast('The end time must be after the start time', 'err'); return; }
    try {
      if (b) await api.put(`/api/time-blocks/${b.id}`, payload);
      else await api.post('/api/time-blocks', payload);
      toast(b ? 'Blocked time updated' : 'Time blocked — online booking is off for it');
      m.close();
      onSaved?.();
    } catch (err) { toast(err.message, 'err'); }
  };

  if (b) {
    m.querySelector('#block-delete').onclick = async () => {
      const ok = await confirmDialog('Remove this block?',
        'The time opens back up and customers will be able to book it online again.',
        { danger: true, okText: 'Remove block' });
      if (!ok) return;
      await api.del(`/api/time-blocks/${b.id}`);
      toast('Block removed — the time is bookable again');
      m.close();
      onSaved?.();
    };
  }
}

// ---------------------------------------------------------------------------
// Rebook — "see you in N weeks". Carries the same client, services, team member
// and time of day forward to a date N weeks out, which is how a repeat booking
// is almost always made at the chair.
// ---------------------------------------------------------------------------

const REBOOK_PRESETS = [2, 3, 4, 6, 8, 12];

export function openRebookModal({ appointment, onSaved } = {}) {
  const a = appointment;
  if (!a) return;
  const duration = a.end_min - a.start_min;
  const defaultWeeks = Math.min(52, Math.max(1, Number(state.settings.rebook_weeks_default) || 4));
  let weeks = defaultWeeks;

  const dateFor = (w) => addDaysStr(a.date, w * 7);
  const isOpenOn = (dateStr) => hoursOn(dateStr) !== null;

  const m = openModal({
    title: `Rebook ${a.client_name || 'this client'}`,
    body: `
      <form id="rebook-form" class="form-grid">
        <div class="field span2"><label>How far ahead</label>
          <div class="seg rebook-seg" id="rb-presets">
            ${REBOOK_PRESETS.map((w) => `<button type="button" data-w="${w}" class="${w === weeks ? 'active' : ''}">${w}w</button>`).join('')}
          </div>
        </div>
        <div class="field"><label>Or exact weeks</label>
          <input type="number" name="weeks" min="1" max="52" step="1" value="${weeks}" inputmode="numeric"></div>
        <div class="field"><label>Time</label>
          <select name="start_min" class="nice-select">${timeOptions(a.start_min, { from: 0, to: 1425 })}</select></div>
        <div class="field span2"><label>Team member</label>
          <select name="staff_id" class="nice-select">${state.staff.map((s) =>
            `<option value="${s.id}" ${s.id === a.staff_id ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}</select></div>
        <div class="span2 appt-summary" id="rb-summary"></div>
        <div class="span2" id="rb-warn"></div>
        <div class="field span2"><label>Repeating</label>
          <div class="cell-sub">${esc(a.services_summary || a.service_name || 'Appointment')}
            · ${duration >= 60 ? `${Math.floor(duration / 60)}h${duration % 60 ? ` ${duration % 60}m` : ''}` : `${duration}m`}</div></div>
      </form>`,
    footer: `
      <div class="spacer"></div>
      <button class="btn" data-rb-cancel>Cancel</button>
      <button class="btn primary" id="rb-go">${icon('check')} Rebook</button>`,
  });

  const form = m.querySelector('#rebook-form');
  const weeksInp = form.querySelector('[name=weeks]');
  const startSel = form.querySelector('[name=start_min]');
  const staffSel = form.querySelector('[name=staff_id]');
  const summaryEl = form.querySelector('#rb-summary');
  const warnEl = form.querySelector('#rb-warn');
  const presets = form.querySelector('#rb-presets');

  const refresh = () => {
    weeks = Math.min(52, Math.max(1, Number(weeksInp.value) || defaultWeeks));
    const date = dateFor(weeks);
    const start = Number(startSel.value);
    presets.querySelectorAll('[data-w]').forEach((b) => b.classList.toggle('active', Number(b.dataset.w) === weeks));
    summaryEl.innerHTML = `<span class="as-dur">${icon('calendar', 14)} ${esc(fmtDate(date))}</span>
      <span class="as-end">${fmtTime(start)} – ${fmtTime(Math.min(1440, start + duration))}</span>`;
    warnEl.innerHTML = isOpenOn(date) ? '' :
      `<div class="hint" style="color:var(--amber)">${icon('alert', 13)} That's a day you're normally closed — you can still book it.</div>`;
  };
  presets.addEventListener('click', (e) => {
    const b = e.target.closest('[data-w]');
    if (!b) return;
    weeksInp.value = b.dataset.w;
    refresh();
  });
  weeksInp.addEventListener('input', refresh);
  startSel.addEventListener('change', refresh);
  refresh();

  m.querySelector('[data-rb-cancel]').onclick = () => m.close();

  const book = async (force = false) => {
    const date = dateFor(weeks);
    const start = Number(startSel.value);
    const payload = {
      client_id: a.client_id,
      service_id: a.service_id,
      service_ids: String(a.service_ids_csv || '').split(',').map(Number).filter(Boolean),
      staff_id: Number(staffSel.value),
      date,
      start_min: start,
      end_min: Math.min(1440, start + duration),
      status: 'booked',
      notes: a.notes || '',
      force,
    };
    try {
      await api.post('/api/appointments', payload);
      toast(`Rebooked for ${fmtDate(date)}`);
      m.close();
      cal.date = date;          // jump the calendar to the new booking
      onSaved?.();
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        const blk = err.data?.block;
        const ok = blk
          ? await confirmDialog('Blocked time',
              `${esc(fmtDate(date))} at that time is blocked out${blk.reason ? ` — <b>${esc(blk.reason)}</b>` : ''}. Book over it anyway?`,
              { okText: 'Book anyway' })
          : await confirmDialog('Double booking',
              `<b>${esc(err.data?.conflict?.client_name || 'Another appointment')}</b> is already booked at ${fmtTime(err.data?.conflict?.start_min || 0)} that day. Book anyway?`,
              { okText: 'Double-book' });
        if (ok) book(true);
      } else toast(err.message, 'err');
    }
  };
  m.querySelector('#rb-go').onclick = () => book();
}
