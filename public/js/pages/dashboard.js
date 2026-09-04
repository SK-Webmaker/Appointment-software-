// Dashboard: "today at a glance" (run of the day, what's next, where the gaps
// are, what's been taken), client growth & retention, then the longer-range
// trends. Built to answer "what do I need to know right now?" first.
import { api } from '../api.js';
import { esc, icon, money, fmtTime, fmtTimeShort, fmtDate, statusChip, initials, avatarColor, todayStr, openModal, toast, confirmDialog } from '../ui.js';
import { barChart } from '../charts.js';
import { state } from '../app.js';

const HOUR_LABEL = (h) => {
  const ap = h >= 12 ? 'PM' : 'AM';
  return `${h % 12 || 12} ${ap}`;
};

const fmtDur = (min) => (min >= 60 ? `${Math.floor(min / 60)}h${min % 60 ? ` ${min % 60}m` : ''}` : `${min}m`);

// Compact but unambiguous clock time for the day's run ("10 AM", "1:15 PM") —
// the list has no time gutter to give it context, so the meridiem stays.
const tlTime = (min) => {
  const h = Math.floor(min / 60), m = min % 60;
  return `${h % 12 || 12}${m ? `:${String(m).padStart(2, '0')}` : ''} ${h >= 12 ? 'PM' : 'AM'}`;
};

function busiestWindow(byHour) {
  if (!byHour.length) return null;
  let best = null;
  for (let i = 0; i < byHour.length - 1; i++) {
    const a = byHour[i], b = byHour[i + 1];
    if (b.hour !== a.hour + 1) continue;
    const sum = a.count + b.count;
    if (!best || sum > best.sum) best = { from: a.hour, to: b.hour + 1, sum };
  }
  if (!best) {
    const top = [...byHour].sort((x, y) => y.count - x.count)[0];
    best = { from: top.hour, to: top.hour + 1 };
  }
  return `${HOUR_LABEL(best.from)}–${HOUR_LABEL(best.to)}`;
}

/**
 * Who is with them now, who is next, and how much of the day is behind them —
 * worked out from the current clock rather than the one the server had when
 * the page loaded.
 *
 * The dashboard is the page an owner leaves open on the back bench all day, so
 * a snapshot goes wrong within the hour: the 9:30 client stays "Next up" long
 * after they've gone home. Mirrors the server's rules exactly (src/api.js), so
 * a reload never disagrees with what was on screen a second earlier.
 */
function liveState(t, nowMin) {
  const live = t.appointments; // already excludes cancelled and no-shows, sorted by start
  const unfinished = (a) => a.status !== 'completed';
  return {
    now: nowMin,
    in_progress: live.find((a) => a.start_min <= nowMin && a.end_min > nowMin && unfinished(a)) || null,
    next: live.find((a) => a.start_min > nowMin && unfinished(a)) || null,
    done_count: live.filter((a) => a.status === 'completed' || a.end_min <= nowMin).length,
    // A gap only counts as free time if it hasn't been used up by the clock.
    free_min: t.gaps.reduce((n, g) => n + Math.max(0, g.end_min - Math.max(g.start_min, nowMin)), 0),
  };
}

/** The "Next up" / "With you now" / "All done" card, rebuilt as the day moves. */
function nextUpHtml(s, t) {
  const appt = s.in_progress || s.next;
  if (!appt) {
    return `<div class="next-up is-empty">
      <div class="nu-tag">${icon('check', 13)} ${t.count ? 'All done' : 'Nothing booked'}</div>
      <div class="nu-name">${t.count ? "That's everyone for today" : 'No appointments today'}</div>
      <div class="cell-sub">${t.count ? 'Nice work.' : t.is_open_day ? 'Your day is wide open.' : "You're closed today."}</div>
    </div>`;
  }
  const name = appt.client_name || 'Walk-in';
  return `<a class="next-up ${s.in_progress ? 'is-now' : ''}" href="#/calendar?date=${esc(appt.date)}">
      <div class="nu-tag">${s.in_progress ? '<span class="nu-dot"></span>' : icon('clock', 13)} ${s.in_progress ? 'With you now' : 'Next up'}</div>
      <div class="nu-row">
        <div class="avatar-sm" style="background:${esc(avatarColor(name))}">${esc(initials(name))}</div>
        <div style="min-width:0">
          <div class="nu-name">${esc(name)}</div>
          <div class="cell-sub">${esc(appt.services_summary || appt.service_name || 'Appointment')}</div>
        </div>
      </div>
      <div class="nu-time">${fmtTime(appt.start_min)} – ${fmtTime(appt.end_min)}${appt.staff_name ? ` · ${esc(appt.staff_name)}` : ''}</div>
    </a>`;
}

// One row of the day's run — an appointment, or a free window between them.
function timelineRowHtml(item) {
  if (item.gap) {
    return `<div class="tl-gap" data-start="${item.start_min}" data-end="${item.end_min}"><span class="tl-gap-line"></span>
      <span class="tl-gap-text">${fmtDur(item.end_min - item.start_min)} free · ${fmtTimeShort(item.start_min)}–${fmtTime(item.end_min)}</span>
      <span class="tl-gap-line"></span></div>`;
  }
  const a = item;
  const name = a.client_name || 'Walk-in';
  const notes = String(a.client_notes || '').trim();
  return `
    <a class="tl-row" href="#/calendar?date=${esc(a.date)}" data-start="${a.start_min}" data-end="${a.end_min}"${notes ? ` title="Note: ${esc(notes)}"` : ''}>
      <div class="tl-time">
        <div class="tl-t1">${tlTime(a.start_min)}</div>
        <div class="tl-t2">${fmtDur(a.end_min - a.start_min)}</div>
      </div>
      <div class="tl-bar" style="background:${esc(a.staff_color || '#3987e5')}"></div>
      <div class="avatar-sm" style="background:${esc(avatarColor(name))}">${esc(initials(name))}</div>
      <div class="tl-main">
        <div class="cell-main">${esc(name)}${notes ? `<span class="tl-noteflag" aria-label="Has client notes">${icon('note', 11)}</span>` : ''}</div>
        <div class="cell-sub">${esc(a.services_summary || a.service_name || 'Appointment')}${a.staff_name ? ` · ${esc(a.staff_name)}` : ''}</div>
        ${notes ? `<div class="tl-note">${icon('note', 11)}<span>${esc(notes)}</span></div>` : ''}
      </div>
      <div class="tl-end">${statusChip(a.status)}</div>
    </a>`;
}

// Only ever one dashboard on screen; a re-render or a move to another page
// must not leave the previous page's clock running.
let liveTimer = null;
let mounted = null;        // the container the dashboard is currently drawn in
let loading = false;       // a refresh is already in flight
let loadedAt = 0;          // when the data on screen was fetched

/**
 * Is the dashboard the page actually on screen right now?
 *
 * `container.isConnected` cannot answer this: the router reuses one #page
 * element for every route, so it stays connected for the life of the session
 * whichever page is showing. Looking for the dashboard's own card is the honest
 * test, and it is what stops a timer or a wake-up from redrawing the dashboard
 * over the top of the calendar.
 */
const isShowing = () => Boolean(mounted?.isConnected && mounted.querySelector('.today-card'));

// A phone fires visibilitychange every time the screen comes on — and can fire
// it several times in a second. Nothing on this page changes fast enough to
// justify refetching that often.
const MIN_REFRESH_MS = 10_000;

async function refreshOnWake() {
  if (document.visibilityState !== 'visible') return;
  if (!isShowing() || loading) return;
  if (Date.now() - loadedAt < MIN_REFRESH_MS) return;
  try { await renderDashboard(mounted); } catch { /* a failed refresh must not break the page */ }
}

// Registered ONCE, when this module is first loaded — never per render.
//
// This listener used to be added inside renderDashboard, and it re-renders. So
// every render left another copy behind, and each wake of the phone fired all
// of them, each one adding another: 1, 2, 4, 8, 16… By the eleventh unlock a
// single phone was firing over a thousand requests in one burst and the rate
// limiter locked the owner out of their own salon with "Too many requests".
document.addEventListener('visibilitychange', refreshOnWake);

// The minute the owner is actually standing in, straight off the device.
const deviceMin = () => { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); };

export async function renderDashboard(container) {
  if (liveTimer) { clearInterval(liveTimer); liveTimer = null; }
  mounted = container;
  loading = true;
  try {
    await drawDashboard(container);
  } finally {
    loading = false;
    loadedAt = Date.now();
  }
}

async function drawDashboard(container) {
  // Ask for the day the phone is in, not the day the server thinks it is. The
  // calendar has always drawn the device's date; the dashboard now does too, so
  // "Today at a glance" and the day book can never be a day apart.
  const d = await api.get(`/api/dashboard?date=${todayStr()}&now_min=${deviceMin()}`);
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const firstName = (state.user.name || '').split(' ')[0];
  const t = d.today;

  // Interleave the day's appointments with the free windows between them.
  const runOfDay = [...t.appointments.map((a) => ({ ...a, gap: false })), ...t.gaps.map((g) => ({ ...g, gap: true }))]
    .sort((a, b) => a.start_min - b.start_min);

  // The clock this page runs on is the device's — that is where the owner is
  // standing, and it's what the calendar uses.
  //
  // The business's configured time zone is checked against it all the same. If
  // the zone is wrong (most often never set, in which case the server falls
  // back to its own clock, which on a hosted box is UTC) this panel still reads
  // correctly, but the booking page and the reminders do not — so the owner is
  // told, rather than left with a salon whose confirmation emails quote the
  // wrong time.
  const serverMin = t.server_now_min ?? t.now_min;
  // Signed difference, wrapped so 23:55 vs 00:05 reads as 10 minutes, not 1430.
  const drift = ((deviceMin() - serverMin + 2160) % 1440) - 720;
  const clockOff = Math.abs(drift) > 10 || (t.server_date && t.server_date !== t.date);
  const baseMin = deviceMin();

  const loadedAt = Date.now();
  const nowMin = () => baseMin + Math.floor((Date.now() - loadedAt) / 60000);

  let dayState = liveState(t, nowMin());

  container.innerHTML = `
    <div class="page-head">
      <div class="ph-icon">${icon('grid', 20)}</div>
      <div>
        <h1>${greeting}, ${esc(firstName)}</h1>
        <div class="ph-sub">Here's what's happening at ${esc(state.settings.business_name || 'your business')}</div>
      </div>
      <div class="ph-actions">
        <button class="btn" id="qa-pos">${icon('card')} Take payment</button>
        <button class="btn" id="qa-block">${icon('lock')} Block time</button>
        <button class="btn primary" id="qa-new">${icon('plus')} New appointment</button>
      </div>
    </div>

    <!-- Today at a glance -->
    <div class="card today-card">
      <div class="today-head">
        <div>
          <div class="card-title">Today at a glance</div>
          <div class="card-sub">${esc(fmtDate(t.date))}${t.is_open_day ? '' : ' · closed today'}</div>
        </div>
        <a class="btn small" href="#/calendar?date=${esc(t.date)}">${icon('calendar')} Open calendar</a>
      </div>

      ${clockOff ? `
      <div class="clock-warn">${icon('alert', 15)}
        <div><b>Your time zone needs fixing.</b> Kairo thinks it's
          <b>${fmtTime(((serverMin % 1440) + 1440) % 1440)}${t.server_date && t.server_date !== t.date ? ` on ${esc(fmtDate(t.server_date))}` : ''}</b>
          right now, but your phone says <b>${fmtTime(deviceMin())}</b>. Today's panel and the
          calendar are using your phone, so they read correctly — but your <b>booking page and
          reminders are still using the wrong one</b>, so set it in
          <a href="#/settings">Settings → Hours &amp; booking → Time zone</a>.</div>
      </div>` : ''}

      <div class="today-grid">
        <div class="today-metrics">
          <div class="tm">
            <div class="tm-value">${t.count}</div>
            <div class="tm-label">appointment${t.count === 1 ? '' : 's'}</div>
          </div>
          <div class="tm">
            <div class="tm-value" id="tm-done">${dayState.done_count}<span class="tm-of">/${t.count}</span></div>
            <div class="tm-label" id="tm-done-label">done · ${Math.max(0, t.appointments.length - dayState.done_count)} to go</div>
          </div>
          <div class="tm">
            <div class="tm-value money">${money(t.takings_cents)}</div>
            <div class="tm-label">taken · ${money(t.expected_cents)} expected</div>
          </div>
          <div class="tm">
            <div class="tm-value" id="tm-free">${dayState.free_min ? fmtDur(dayState.free_min) : '—'}</div>
            <div class="tm-label" id="tm-free-label">${dayState.free_min ? 'free time left' : 'fully booked'}</div>
          </div>
        </div>

        ${nextUpHtml(dayState, t)}
      </div>

      <div class="today-timeline" id="today-timeline"></div>
    </div>

    <div class="stats-row">
      <div class="card stat-tile">
        <div class="st-top"><span class="st-label">Revenue collected</span>
          <span class="st-icon tint-green">${icon('dollar')}</span></div>
        <div class="st-value">${money(d.week_revenue_cents)}</div>
        <div class="st-foot">Last 7 days</div>
      </div>
      <div class="card stat-tile">
        <div class="st-top"><span class="st-label">Outstanding</span>
          <span class="st-icon tint-amber">${icon('invoice')}</span></div>
        <div class="st-value">${money(d.outstanding_cents)}</div>
        <div class="st-foot">Unpaid sent invoices</div>
      </div>
      <div class="card stat-tile">
        <div class="st-top"><span class="st-label">Clients</span>
          <span class="st-icon tint-violet">${icon('users')}</span></div>
        <div class="st-value">${d.clients.total}</div>
        <div class="st-foot">+${d.clients.new_30d} added this month</div>
      </div>
      <div class="card stat-tile">
        <div class="st-top"><span class="st-label">Rebooking rate</span>
          <span class="st-icon tint-cyan">${icon('reply')}</span></div>
        <div class="st-value">${d.clients.rebook_rate == null ? '—' : `${d.clients.rebook_rate}%`}</div>
        <div class="st-foot">${d.clients.rebook_rate == null ? 'Not enough history yet' : 'Came back within a month'}</div>
      </div>
    </div>

    <div class="grid-31 mt">
      <div class="card">
        <div class="card-title">Client growth &amp; retention</div>
        <div class="card-sub">New vs returning visits, last 30 days</div>
        <div id="retention-body" class="mt"></div>
      </div>
      <div class="card">
        <div class="card-title">Coming up</div>
        <div class="card-sub">Next confirmed &amp; booked visits</div>
        <div class="mt" id="upcoming-list"></div>
      </div>
    </div>

    <div class="grid-2 mt">
      <div class="card">
        <div style="display:flex;align-items:flex-start;justify-content:space-between">
          <div>
            <div class="card-title">Your booking rhythm</div>
            <div class="card-sub">Appointments by hour of day, last 30 days</div>
          </div>
          <span class="st-icon tint-cyan">${icon('trendUp')}</span>
        </div>
        <div class="chart-box" id="rhythm-chart"></div>
        <div id="rhythm-insight"></div>
      </div>
      <div class="card">
        <div class="card-title">Revenue trend</div>
        <div class="card-sub">Payments collected per day, last 7 days</div>
        <div class="chart-box" id="revenue-chart"></div>
      </div>
    </div>

    <div class="card mt">
      <div class="card-title">Top services</div>
      <div class="card-sub">Most booked over the last 30 days</div>
      <div class="mt" id="top-services"></div>
    </div>

    <!-- Deliberately last: the day's work comes first, and this is the part
         you scroll to when you have a minute to think rather than a client
         waiting. Loaded separately so a slow analysis never holds up the
         panel the owner actually opens the app for. -->
    <div id="opps-slot"></div>`;

  // --- Quick actions -------------------------------------------------------
  container.querySelector('#qa-new').onclick = async () => {
    const { openAppointmentModal } = await import('./calendar.js');
    openAppointmentModal({ date: todayStr(), onSaved: () => renderDashboard(container) });
  };
  container.querySelector('#qa-block').onclick = async () => {
    const { openBlockModal } = await import('./calendar.js');
    openBlockModal({ date: todayStr(), onSaved: () => renderDashboard(container) });
  };
  container.querySelector('#qa-pos').onclick = () => { location.hash = '#/pos'; };

  // --- Today's run ---------------------------------------------------------
  const tl = container.querySelector('#today-timeline');
  if (!runOfDay.length) {
    tl.innerHTML = `<div class="empty">${icon('calendar')}
      <div>${t.is_open_day ? 'Nothing booked today yet.' : "You're closed today."}</div></div>`;
  } else {
    tl.innerHTML = runOfDay.map(timelineRowHtml).join('');
  }

  // --- Keep it honest as the day passes ------------------------------------
  // Repaint only the parts that depend on the clock. Everything else (the
  // charts, the month's figures) is unaffected by a minute going by.
  function paintLive() {
    const card = container.querySelector('.next-up');
    if (!card) return;
    dayState = liveState(t, nowMin());

    card.outerHTML = nextUpHtml(dayState, t);

    const done = container.querySelector('#tm-done');
    if (done) done.innerHTML = `${dayState.done_count}<span class="tm-of">/${t.count}</span>`;
    const doneLabel = container.querySelector('#tm-done-label');
    if (doneLabel) doneLabel.textContent = `done · ${Math.max(0, t.appointments.length - dayState.done_count)} to go`;

    const free = container.querySelector('#tm-free');
    if (free) free.textContent = dayState.free_min ? fmtDur(dayState.free_min) : '—';
    const freeLabel = container.querySelector('#tm-free-label');
    if (freeLabel) freeLabel.textContent = dayState.free_min ? 'free time left' : 'fully booked';

    // The run of the day reads as a to-do list, so a visit that's been and gone
    // should not look identical to one still ahead of them.
    tl.querySelectorAll('.tl-row[data-end]').forEach((row) => {
      const start = Number(row.dataset.start), end = Number(row.dataset.end);
      row.classList.toggle('is-past', end <= dayState.now);
      row.classList.toggle('is-now', start <= dayState.now && end > dayState.now);
    });
    // A free window that has already gone by isn't a window you can fill.
    tl.querySelectorAll('.tl-gap[data-end]').forEach((g) => {
      g.classList.toggle('is-past', Number(g.dataset.end) <= dayState.now);
    });
  }
  paintLive();

  liveTimer = setInterval(() => {
    // There is no page-teardown hook to unsubscribe from, so the timer stops
    // itself once the dashboard is no longer the page on screen.
    if (!isShowing()) { clearInterval(liveTimer); liveTimer = null; return; }
    // Past midnight the day itself is stale, not just the minute — and a phone
    // that slept for hours comes back to a page built for yesterday.
    if (nowMin() >= 24 * 60 || t.date !== todayStr()) { renderDashboard(container); return; }
    paintLive();
  }, 30000);

  // --- Growth & retention --------------------------------------------------
  const c = d.clients;
  const totalVisits = c.new_visits_30d + c.returning_visits_30d;
  const newPct = totalVisits ? Math.round((c.new_visits_30d / totalVisits) * 100) : 0;
  const ret = container.querySelector('#retention-body');
  ret.innerHTML = `
    ${totalVisits ? `
      <div class="split-bar">
        <div class="sb-fill sb-new" style="width:${newPct}%"></div>
        <div class="sb-fill sb-ret" style="width:${100 - newPct}%"></div>
      </div>
      <div class="split-key">
        <span><i class="k-new"></i>${c.new_visits_30d} new <b>${newPct}%</b></span>
        <span><i class="k-ret"></i>${c.returning_visits_30d} returning <b>${100 - newPct}%</b></span>
      </div>
      <div class="insight" style="margin-top:12px">${
        newPct >= 50
          ? `Lots of fresh faces: <b>${newPct}% new</b>. Getting them to rebook before they leave is the big win.`
          : `A loyal book: <b>${100 - newPct}% returning</b>.${c.rebook_rate != null ? ` About <b>${c.rebook_rate}%</b> come back within a month.` : ''}`
      }</div>` : `<div class="empty">${icon('users')}<div>No visits in the last 30 days yet.</div></div>`}

    <div class="lapsed-head">
      <div class="card-title" style="font-size:13.5px">Worth a nudge</div>
      ${c.lapsed_count > c.lapsed.length ? `<span class="cell-sub">${c.lapsed_count} total</span>` : ''}
    </div>
    ${c.lapsed.length ? c.lapsed.map((l) => {
      const nm = `${l.first_name} ${l.last_name}`.trim();
      return `<a class="list-item" href="#/clients?open=${l.id}" style="color:inherit">
        <div class="avatar-sm" style="background:${esc(avatarColor(nm))}">${esc(initials(nm))}</div>
        <div style="flex:1;min-width:0">
          <div class="cell-main">${esc(nm)}</div>
          <div class="cell-sub">${l.visits} visits · last ${esc(fmtDate(l.last_visit))}</div>
        </div>
        <span class="cell-sub">${icon('chevR', 14)}</span>
      </a>`;
    }).join('') : '<div class="cell-sub" style="padding:6px 2px">Everyone has been in recently or is already booked in.</div>'}`;

  // --- Upcoming ------------------------------------------------------------
  const up = container.querySelector('#upcoming-list');
  if (!d.upcoming.length) {
    up.innerHTML = `<div class="empty">${icon('calendar')}<div>Nothing coming up. Add an appointment.</div></div>`;
  } else {
    up.innerHTML = d.upcoming.map((a) => `
      <a class="list-item" href="#/calendar?date=${a.date}" style="color:inherit">
        <div class="avatar-sm" style="background:${esc(avatarColor(a.client_name))}">${esc(initials(a.client_name || 'W'))}</div>
        <div style="flex:1;min-width:0">
          <div class="cell-main">${esc(a.client_name || 'Walk-in')}</div>
          <div class="cell-sub">${esc(a.services_summary || a.service_name || 'Appointment')} · ${esc(a.staff_name || '')}</div>
        </div>
        <div style="text-align:right">
          <div style="font-weight:600;font-size:12.5px">${a.date === todayStr() ? 'Today' : fmtDate(a.date)}</div>
          <div class="cell-sub">${fmtTime(a.start_min)}</div>
        </div>
      </a>`).join('');
  }

  // --- Charts --------------------------------------------------------------
  const rhythmData = d.bookings_by_hour.map((r) => ({
    label: HOUR_LABEL(r.hour), sub: `${HOUR_LABEL(r.hour)} – ${HOUR_LABEL(r.hour + 1)}`, value: r.count,
  }));
  if (rhythmData.length) {
    barChart(container.querySelector('#rhythm-chart'), {
      data: rhythmData, color: '#3987e5', height: 220,
      format: (v, axis) => axis ? String(Math.round(v)) : `${v} booking${v === 1 ? '' : 's'}`,
    });
    const windowLabel = busiestWindow(d.bookings_by_hour);
    if (windowLabel) {
      container.querySelector('#rhythm-insight').innerHTML =
        `<div class="insight">You're busiest between <b>${esc(windowLabel)}</b>. Keep those slots protected for your best-selling services.</div>`;
    }
  } else {
    container.querySelector('#rhythm-chart').innerHTML = '<div class="empty">No bookings yet. Your rhythm will appear here.</div>';
  }

  barChart(container.querySelector('#revenue-chart'), {
    data: d.revenue_by_day.map((r) => ({
      label: fmtDate(r.date).split(',')[0], sub: fmtDate(r.date), value: r.cents,
    })),
    color: '#199e70', height: 200,
    format: (v, axis) => axis ? (v >= 100000 ? `${Math.round(v / 100000) / 10}k` : `${Math.round(v / 100)}`) : money(v),
  });

  // --- Top services --------------------------------------------------------
  const top = container.querySelector('#top-services');
  if (!d.top_services.length) {
    top.innerHTML = '<div class="empty">No data yet.</div>';
  } else {
    const maxN = Math.max(...d.top_services.map((s) => s.n));
    top.innerHTML = d.top_services.map((s) => `
      <div class="list-item" style="cursor:default">
        <div style="flex:1;min-width:0">
          <div class="cell-main">${esc(s.name)}</div>
          <div style="height:5px;border-radius:3px;background:var(--panel-3);margin-top:7px;overflow:hidden">
            <div style="height:100%;width:${Math.round((s.n / maxN) * 100)}%;background:var(--accent-fill);border-radius:3px"></div>
          </div>
        </div>
        <div style="text-align:right;padding-left:14px">
          <div class="cell-main money">${s.n}×</div>
          <div class="cell-sub money">${money(s.revenue_cents)}</div>
        </div>
      </div>`).join('');
  }

  drawOpportunities(container.querySelector('#opps-slot'));
}

// --- Opportunities ---------------------------------------------------------
// The money the diary is quietly leaving on the table. Read-only for now: every
// action here navigates to the screen where the owner can decide, rather than
// doing something on their behalf. Sending comes later, behind their own hand.

const OPP_TINT = {
  empty_time: 'tint-cyan',
  unfilled_cancellations: 'tint-amber',
  overdue_regulars: 'tint-violet',
  weakest_period: 'tint-green',
  repeat_no_shows: 'tint-amber',
};
const OPP_ICON = {
  empty_time: 'clock',
  unfilled_cancellations: 'alert',
  overdue_regulars: 'reply',
  weakest_period: 'bar',
  repeat_no_shows: 'card',
};

/**
 * Fetched after the panel is already on screen, and failing silently.
 *
 * This is the "when you have a minute" section — if the analysis is slow or
 * errors, the owner should still get the day's run instantly and simply not
 * see this, rather than watch the whole dashboard wait on it.
 */
async function drawOpportunities(slot) {
  if (!slot) return;
  let data;
  try { data = await api.get('/api/opportunities'); } catch { return; }
  if (!data?.findings?.length) return;

  slot.innerHTML = `
    <div class="opps">
      <div class="opps-head">
        <span class="oh-icon">${icon('zap', 19)}</span>
        <div style="min-width:0">
          <h2>Opportunities</h2>
          <div class="oh-sub">${data.findings.length} thing${data.findings.length === 1 ? '' : 's'} worth
            a look. Worked out from your own diary — nothing has been sent.</div>
        </div>
        ${data.total_worth_cents > 0 ? `
        <div class="oh-money">
          <div class="v">${money(data.total_worth_cents)}</div>
          <div class="l">recoverable, on these findings</div>
        </div>` : ''}
      </div>
      <div class="opp-list">
        ${data.findings.map((f) => `
          <div class="opp">
            <span class="op-icon ${OPP_TINT[f.kind] || 'tint-cyan'}">${icon(OPP_ICON[f.kind] || 'zap', 17)}</span>
            <div class="op-body">
              <div class="op-kicker">${esc(f.kicker)}</div>
              <div class="op-title">${esc(f.title)}</div>
              <div class="op-why">${f.detail}</div>
              ${f.evidence.length ? `
                <div class="op-ev">
                  ${f.evidence.map((e) => `
                    <span class="ev">
                      <b>${esc(e.label)}</b>
                      <span>${esc(e.sub || '')}</span>
                    </span>`).join('')}
                </div>` : ''}
              ${f.suggestion ? `
                <div class="op-sug">
                  <div class="sg-head">${icon('zap', 13)} ${esc(f.suggestion.headline)}</div>
                  <div class="sg-body">${esc(f.suggestion.body)}</div>
                  ${f.suggestion.tip ? `<div class="sg-tip"><b>Tip</b> ${esc(f.suggestion.tip)}</div>` : ''}
                </div>` : ''}
              <div class="op-actions">
                ${f.campaign ? `
                  <button class="btn primary" data-draft="${esc(JSON.stringify(f.campaign))}">
                    ${icon('send', 14)} Draft a message</button>` : ''}
                ${f.suggestion?.action ? `
                  <a class="btn" href="${esc(f.suggestion.action.href)}">${icon('tag', 14)} ${esc(f.suggestion.action.label)}</a>` : ''}
                ${f.actions.map((a) => `
                  <a class="btn" href="${esc(a.href)}">${icon(a.icon || 'chevR', 14)} ${esc(a.label)}</a>`).join('')}
              </div>
            </div>
            ${f.worth_cents > 0 ? `
              <div class="op-worth">
                <div class="v">${money(f.worth_cents)}</div>
                <div class="l">${esc(f.worth_label)}</div>
              </div>` : ''}
          </div>`).join('')}
      </div>
      <div class="opps-foot">${icon('alert', 14)}
        <span>Worked out from bookings that already exist, and valued at the <b>cheapest</b> service
        that fits — so the real number is usually higher, never lower. Nothing is sent until you
        press send, and you see the exact list first.</span>
      </div>
    </div>`;

  slot.querySelectorAll('[data-draft]').forEach((b) => {
    b.onclick = () => openCampaign(JSON.parse(b.dataset.draft));
  });
}

// --- The campaign preview --------------------------------------------------
// The screen that makes sending safe. Nothing goes anywhere until the owner has
// seen the exact list, the exact words and the exact cost, and pressed send.

const CH_LABEL = { email: 'Email', sms: 'SMS', both: 'Email + SMS' };

async function openCampaign(campaign) {
  // `audience` is the new axis: the same freed slot can go to the handful of
  // people it actually suits, or to the whole list as a long shot. They are not
  // the same message and they are not the same decision, so the switch is the
  // first thing in the dialog rather than a checkbox buried under the draft.
  let state_ = { channel: 'email', audience: 'matched', data: null, chosen: new Set() };

  const m = openModal({
    title: 'Draft a message',
    wide: true,
    body: '<div id="cmp-body" class="cmp-loading">Working out who this should go to…</div>',
    footer: `<div class="spacer"></div>
      <button class="btn" data-cancel>Cancel</button>
      <button class="btn primary" id="cmp-send" disabled>Send</button>`,
  });
  m.querySelector('[data-cancel]').onclick = () => m.close();

  const load = async () => {
    const q = new URLSearchParams({
      kind: campaign.kind, channel: state_.channel, audience: state_.audience,
    });
    if (campaign.weekday !== undefined) q.set('weekday', campaign.weekday);
    if (campaign.when) q.set('when', campaign.when);
    if (campaign.times) q.set('times', campaign.times);
    try {
      state_.data = await api.get(`/api/campaigns/preview?${q}`);
    } catch (err) {
      const el = m.querySelector('#cmp-body');
      el.className = '';
      el.innerHTML = `<div class="empty">${esc(err.message)}</div>`;
      return;
    }
    // The server decides the channel for a broadcast — it forces email — so
    // take its answer rather than keeping a stale SMS selection on screen.
    state_.channel = state_.data.channel;
    // Everyone reachable starts ticked; anyone inside the cooldown cannot be.
    state_.chosen = new Set(state_.data.recipients.filter((r) => !r.cooling_off).map((r) => r.id));
    paint();
  };

  const paint = () => {
    const d = state_.data;
    const body = m.querySelector('#cmp-body');
    // The loading state centres its text; leaving that class on once the real
    // content is in centres the whole recipient list with it.
    body.className = '';
    const live = d.recipients.filter((r) => !r.cooling_off);
    const cooling = d.recipients.filter((r) => r.cooling_off);
    const picked = live.filter((r) => state_.chosen.has(r.id));
    const broadcast = d.audience === 'everyone';
    const sizes = d.audience_sizes || {};

    body.innerHTML = `
      <div class="cmp-grid">
        <div class="cmp-left">
          <div class="cmp-label">Send to</div>
          <div class="seg" id="cmp-aud">
            <button type="button" data-aud="matched" class="${broadcast ? '' : 'sel'}">
              Best matches${sizes.matched !== undefined ? ` · ${sizes.matched}` : ''}</button>
            <button type="button" data-aud="everyone" class="${broadcast ? 'sel' : ''}">
              Everyone${sizes.everyone !== undefined ? ` · ${sizes.everyone}` : ''}</button>
          </div>
          <div class="cmp-aud-note">${broadcast
            ? `Your whole client list. Nobody has been picked out, so the message says
               <b>first come, first served</b> — and it goes by email, because two hundred
               texts is real money for a long shot and this one is free.`
            : `The people this actually suits: due for a visit, and they've booked this day
               of the week before. Fewer names, far more replies.`}</div>

          ${broadcast ? '' : `
          <div class="cmp-label" style="margin-top:16px">Send by</div>
          <div class="seg" id="cmp-seg">
            ${['email', 'sms', 'both'].map((c) => `
              <button type="button" data-ch="${c}" class="${state_.channel === c ? 'sel' : ''}">${CH_LABEL[c]}</button>`).join('')}
          </div>`}
          <div class="cmp-cost ${state_.channel === 'email' ? 'free' : 'paid'}" id="cmp-cost"></div>

          <div class="cmp-label" style="margin-top:16px">Message</div>
          ${state_.channel !== 'sms' ? `
            <input id="cmp-subject" class="cmp-subject" value="${esc(d.draft.subject)}" placeholder="Subject">` : ''}
          <textarea id="cmp-body-text" class="cmp-text" rows="7">${esc(d.draft.body)}</textarea>
          <div class="cmp-hint">
            <b>{first_name}</b> becomes each person's name.
            ${d.booking_url
              ? `<b>{booking_link}</b> becomes your booking page — a different link for each
                 person, so you can see who booked because of this message.`
              : '<b style="color:var(--amber)">No booking link yet</b> — set your website address in Settings and it will be included.'}
          </div>
        </div>

        <div class="cmp-right">
          <div class="cmp-label">
            Going to <b id="cmp-count">${picked.length}</b> of ${live.length}
            ${live.length ? '<button type="button" class="cmp-all" id="cmp-all">Select all</button>' : ''}
          </div>
          <div class="cmp-people" id="cmp-people">
            ${live.length ? live.map((r) => `
              <label class="cmp-person">
                <input type="checkbox" class="chk" data-id="${r.id}" ${state_.chosen.has(r.id) ? 'checked' : ''}>
                <span class="cp-main">
                  <b>${esc(`${r.first_name} ${r.last_name}`.trim())}</b>
                  <span>${esc(r.why)}</span>
                </span>
              </label>`).join('')
              : `<div class="empty" style="padding:22px 10px">Nobody fits this right now.
                   ${cooling.length ? 'Everyone who does has heard from you in the last fortnight.' : ''}</div>`}
          </div>
          ${cooling.length ? `
            <div class="cmp-cooling">${icon('clock', 13)}
              <span><b>${cooling.length} left out</b> — messaged in the last ${d.cooldown_days} days.
              Kairo won't contact the same client twice inside that window, whichever campaign it is.</span>
            </div>` : ''}
        </div>
      </div>`;

    const recost = () => {
      const n = live.filter((r) => state_.chosen.has(r.id));
      const text = m.querySelector('#cmp-body-text').value;
      const len = text.length;
      const seg = len <= 160 ? 1 : Math.ceil(len / 153);
      const smsTo = state_.channel === 'email' ? 0 : n.filter((r) => r.phone).length;
      const cents = smsTo * seg * 8;
      const el = m.querySelector('#cmp-cost');
      el.className = `cmp-cost ${state_.channel === 'email' ? 'free' : 'paid'}`;
      el.innerHTML = state_.channel === 'email'
        ? `<b>Free</b> — ${n.filter((r) => r.email).length} of ${n.length} have an email address`
        : `About <b>${money(cents)}</b> in SMS credit · ${smsTo} text${smsTo === 1 ? '' : 's'}`
          + `${seg > 1 ? ` × ${seg} segments (${len} characters)` : ''}`;
      m.querySelector('#cmp-count').textContent = n.length;
      m.querySelector('#cmp-send').disabled = n.length === 0;
      m.querySelector('#cmp-send').innerHTML = `${icon('send', 14)} Send to ${n.length}`;
    };
    recost();

    m.querySelector('#cmp-aud').onclick = (e) => {
      const b = e.target.closest('[data-aud]');
      if (!b || b.dataset.aud === state_.audience) return;
      state_.audience = b.dataset.aud;
      // The draft is rewritten for the new audience, so any edits the owner
      // made are about to be replaced. Only worth asking if they made some.
      load();
    };
    // Absent on a broadcast — that one is email or nothing.
    const seg = m.querySelector('#cmp-seg');
    if (seg) seg.onclick = (e) => {
      const b = e.target.closest('[data-ch]');
      if (!b) return;
      state_.channel = b.dataset.ch;
      load();
    };
    m.querySelector('#cmp-body-text').oninput = recost;
    m.querySelector('#cmp-people').onchange = (e) => {
      const c = e.target.closest('[data-id]');
      if (!c) return;
      const id = Number(c.dataset.id);
      if (c.checked) state_.chosen.add(id); else state_.chosen.delete(id);
      recost();
    };
    const all = m.querySelector('#cmp-all');
    if (all) all.onclick = () => {
      const everyone = state_.chosen.size === live.length;
      state_.chosen = everyone ? new Set() : new Set(live.map((r) => r.id));
      m.querySelectorAll('#cmp-people [data-id]').forEach((c) => { c.checked = !everyone; });
      all.textContent = everyone ? 'Select all' : 'Select none';
      recost();
    };
  };

  m.querySelector('#cmp-send').onclick = async (e) => {
    const btn = e.currentTarget;
    // A speed bump proportionate to the size of the thing. Twelve messages is a
    // normal afternoon; a hundred and ninety is a decision, and it cannot be
    // taken back once the queue starts.
    const n = state_.chosen.size;
    if (n >= 30) {
      const okBig = await confirmDialog(
        `Email ${n} clients?`,
        `This goes out to <b>${n} people</b> at once, and there's no unsending it.`
        + ` Emails cost you nothing, but your inbox may get busy — that's the point.`,
        { okText: `Send to ${n}` },
      );
      if (!okBig) return;
    }
    btn.disabled = true;
    const was = btn.innerHTML;
    btn.innerHTML = 'Sending…';
    try {
      const res = await api.post('/api/campaigns/send', {
        kind: campaign.kind,
        channel: state_.channel,
        subject: m.querySelector('#cmp-subject')?.value || '',
        body: m.querySelector('#cmp-body-text').value,
        client_ids: [...state_.chosen],
      });
      toast(res.detail, res.queued ? 'ok' : 'err', { ms: 6000 });
      m.close();
      if (isShowing()) renderDashboard(mounted);
    } catch (err) {
      toast(err.message, 'err', { ms: 7000 });
      btn.disabled = false; btn.innerHTML = was;
    }
  };

  load();
}
