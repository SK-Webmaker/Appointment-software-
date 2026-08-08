// Dashboard: "today at a glance" (run of the day, what's next, where the gaps
// are, what's been taken), client growth & retention, then the longer-range
// trends. Built to answer "what do I need to know right now?" first.
import { api } from '../api.js';
import { esc, icon, money, fmtTime, fmtTimeShort, fmtDate, statusChip, initials, avatarColor, todayStr } from '../ui.js';
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
    return `<div class="tl-gap"><span class="tl-gap-line"></span>
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

export async function renderDashboard(container) {
  if (liveTimer) { clearInterval(liveTimer); liveTimer = null; }
  const d = await api.get('/api/dashboard');
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const firstName = (state.user.name || '').split(' ')[0];
  const t = d.today;

  // Interleave the day's appointments with the free windows between them.
  const runOfDay = [...t.appointments.map((a) => ({ ...a, gap: false })), ...t.gaps.map((g) => ({ ...g, gap: true }))]
    .sort((a, b) => a.start_min - b.start_min);

  // The clock the page runs on. Anchored to the server's minute — which is
  // already in the business's own time zone, not the device's — and advanced by
  // however long the page has actually been open.
  const loadedAt = Date.now();
  const nowMin = () => t.now_min + Math.floor((Date.now() - loadedAt) / 60000);

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
    </div>`;

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
  }
  paintLive();

  liveTimer = setInterval(() => {
    // There is no page-teardown hook to unsubscribe from, so the timer stops
    // itself once its container is no longer on the page.
    if (!container.isConnected) { clearInterval(liveTimer); liveTimer = null; return; }
    // Past midnight the day itself is stale, not just the minute — and a phone
    // that slept for hours comes back to a page built for yesterday.
    if (nowMin() >= 24 * 60 || t.date !== todayStr()) { renderDashboard(container); return; }
    paintLive();
  }, 30000);

  // Coming back to the tab is the moment stale data is most obvious, and
  // anything booked or completed elsewhere since needs picking up.
  const onVisible = () => {
    if (document.visibilityState !== 'visible') return;
    if (!container.isConnected) { document.removeEventListener('visibilitychange', onVisible); return; }
    renderDashboard(container);
  };
  document.addEventListener('visibilitychange', onVisible);

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
}
