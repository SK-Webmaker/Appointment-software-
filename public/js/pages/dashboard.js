// Dashboard: stat tiles, booking rhythm, revenue trend, upcoming appointments.
import { api } from '../api.js';
import { esc, icon, money, fmtTime, fmtDate, statusChip, initials, avatarColor, todayStr } from '../ui.js';
import { barChart } from '../charts.js';
import { state } from '../app.js';

const HOUR_LABEL = (h) => {
  const ap = h >= 12 ? 'PM' : 'AM';
  return `${h % 12 || 12} ${ap}`;
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

export async function renderDashboard(container) {
  const d = await api.get('/api/dashboard');
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const firstName = (state.user.name || '').split(' ')[0];

  container.innerHTML = `
    <div class="page-head">
      <div class="ph-icon">${icon('grid', 20)}</div>
      <div>
        <h1>${greeting}, ${esc(firstName)}</h1>
        <div class="ph-sub">Here's what's happening at ${esc(state.settings.business_name || 'your business')}</div>
      </div>
      <div class="ph-actions"><div class="live-hint"><span class="dot"></span>Updated live as you work</div></div>
    </div>

    <div class="stats-row">
      <div class="card stat-tile">
        <div class="st-top"><span class="st-label">Today's bookings</span>
          <span class="st-icon tint-blue">${icon('calendar')}</span></div>
        <div class="st-value">${d.today.count}</div>
        <div class="st-foot">${money(d.today.expected_cents)} expected</div>
      </div>
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
        <div class="st-foot">+${d.clients.new_30d} this month</div>
      </div>
    </div>

    <div class="grid-31">
      <div class="card">
        <div style="display:flex;align-items:flex-start;justify-content:space-between">
          <div>
            <div class="card-title">Your booking rhythm</div>
            <div class="card-sub">Appointments by hour of day — last 30 days</div>
          </div>
          <span class="st-icon tint-cyan">${icon('trendUp')}</span>
        </div>
        <div class="chart-box" id="rhythm-chart"></div>
        <div id="rhythm-insight"></div>
      </div>
      <div class="card">
        <div class="card-title">Upcoming</div>
        <div class="card-sub">Next confirmed &amp; booked visits</div>
        <div class="mt" id="upcoming-list"></div>
      </div>
    </div>

    <div class="grid-2 mt">
      <div class="card">
        <div class="card-title">Revenue trend</div>
        <div class="card-sub">Payments collected per day — last 7 days</div>
        <div class="chart-box" id="revenue-chart"></div>
      </div>
      <div class="card">
        <div class="card-title">Top services</div>
        <div class="card-sub">Most booked — last 30 days</div>
        <div class="mt" id="top-services"></div>
      </div>
    </div>`;

  // Booking rhythm — single series, blue (validated on this surface).
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
        `<div class="insight">You're busiest between <b>${esc(windowLabel)}</b> — keep those slots protected for your best-selling services.</div>`;
    }
  } else {
    container.querySelector('#rhythm-chart').innerHTML = '<div class="empty">No bookings yet — your rhythm will appear here.</div>';
  }

  // Revenue — single series, green (second sequential context per palette rules).
  barChart(container.querySelector('#revenue-chart'), {
    data: d.revenue_by_day.map((r) => ({
      label: fmtDate(r.date).split(',')[0], sub: fmtDate(r.date), value: r.cents,
    })),
    color: '#199e70', height: 200,
    format: (v, axis) => axis ? (v >= 100000 ? `${Math.round(v / 100000) / 10}k` : `${Math.round(v / 100)}`) : money(v),
  });

  // Upcoming list
  const up = container.querySelector('#upcoming-list');
  if (!d.upcoming.length) {
    up.innerHTML = `<div class="empty">${icon('calendar')}<div>Nothing coming up — add an appointment.</div></div>`;
  } else {
    up.innerHTML = d.upcoming.map((a) => `
      <a class="list-item" href="#/calendar?date=${a.date}" style="color:inherit">
        <div class="avatar-sm" style="background:${esc(avatarColor(a.client_name))}">${esc(initials(a.client_name || 'W'))}</div>
        <div style="flex:1;min-width:0">
          <div class="cell-main">${esc(a.client_name || 'Walk-in')}</div>
          <div class="cell-sub">${esc(a.service_name || 'Appointment')} · ${esc(a.staff_name || '')}</div>
        </div>
        <div style="text-align:right">
          <div style="font-weight:600;font-size:12.5px">${a.date === todayStr() ? 'Today' : fmtDate(a.date)}</div>
          <div class="cell-sub">${fmtTime(a.start_min)}</div>
        </div>
      </a>`).join('');
  }

  // Top services
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
            <div style="height:100%;width:${Math.round((s.n / maxN) * 100)}%;background:var(--accent-grad);border-radius:3px"></div>
          </div>
        </div>
        <div style="text-align:right;padding-left:14px">
          <div class="cell-main money">${s.n}×</div>
          <div class="cell-sub money">${money(s.revenue_cents)}</div>
        </div>
      </div>`).join('');
  }
}
