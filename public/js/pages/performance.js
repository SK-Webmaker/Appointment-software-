// Performance: how the business has actually been doing, for any dates.
//
// Growth is about what to do next; this page is what happened. Every figure
// comes from /api/stats (src/stats.js), which defines each one once so this
// page, the emailed report and the operator's copy can never disagree. The
// definitions are on the page too, in plain words, because a number an owner
// cannot check is a number they will not trust.
import { api } from '../api.js';
import { esc, icon, money, toast, fmtDate } from '../ui.js';
import { barChart } from '../charts.js';

const PRESETS = [
  ['this_month', 'This month'], ['last_month', 'Last month'], ['last_3_months', 'Last 3 months'],
  ['last_6_months', 'Last 6 months'], ['last_12_months', 'Last 12 months'], ['this_year', 'This year'],
];
const KEY = 'kairo_perf_range';

/** The range last looked at, so coming back to the page lands on it again. */
function remembered() {
  try { return JSON.parse(localStorage.getItem(KEY) || 'null') || { preset: 'last_3_months' }; } catch { return { preset: 'last_3_months' }; }
}
function remember(r) { try { localStorage.setItem(KEY, JSON.stringify(r)); } catch { /* private mode */ } }

const rate = (v) => (v == null ? '—' : `${Math.round(v)}%`);
const shortRange = (a, b) => `${fmtDate(a, { weekday: false })} – ${fmtDate(b, { weekday: false })}`;

/**
 * Change against the period before, as a small line under a figure. For rates
 * the change is in points, not percent-of-a-percent, and "fewer no-shows" is
 * the good direction.
 */
function delta(now, before, { kind = 'count', lowerIsBetter = false } = {}) {
  if (now == null || before == null) return '';
  let diff; let text;
  if (kind === 'rate') {
    diff = Math.round(now - before);
    if (diff === 0) return '<span class="pf-d">Same as before</span>';
    text = `${diff > 0 ? '+' : '−'}${Math.abs(diff)} pts`;
  } else {
    // Nothing in Kairo to compare with (often: before the salon started using it).
    if (!before) return '';
    diff = Math.round(((now - before) / before) * 100);
    if (diff === 0) return '<span class="pf-d">Same as before</span>';
    text = `${diff > 0 ? '+' : '−'}${Math.abs(diff)}%`;
  }
  const good = lowerIsBetter ? diff < 0 : diff > 0;
  return `<span class="pf-d ${good ? 'up' : 'down'}">${diff > 0 ? '▲' : '▼'} ${text}</span>`;
}

function tile(label, value, foot, ic, tint, deltaHtml = '') {
  return `<div class="card stat-tile">
    <div class="st-top"><span class="st-label">${esc(label)}</span><span class="st-icon ${tint}">${icon(ic)}</span></div>
    <div class="st-value">${value}</div>
    <div class="st-foot">${deltaHtml}${deltaHtml && foot ? ' · ' : ''}${esc(foot)}</div>
  </div>`;
}

/** The rows of the month-by-month table, the same ones the emailed report uses. */
const ROWS = [
  ['Appointment value', (m) => money(m.value_cents)],
  ['Appointments', (m) => String(m.visits)],
  ['Average appointment', (m) => (m.visits ? money(m.avg_value_cents) : '—')],
  ['Clients seen', (m) => String(m.clients_seen)],
  ['New clients', (m) => String(m.new_clients)],
  ['Rebooked before leaving', (m) => rate(m.rebook_rate)],
  ['Came back or booked again', (m) => rate(m.return_rate)],
  ['Diary full', (m) => rate(m.diary_full)],
  ['Booked online', (m) => rate(m.online_share)],
  ['Cancellations', (m) => `${m.cancelled} <span class="pf-sub">${rate(m.cancel_rate)}</span>`],
  ['No-shows', (m) => `${m.no_shows} <span class="pf-sub">${rate(m.no_show_rate)}</span>`],
  ['Payments taken in Kairo', (m) => money(m.takings_cents)],
];

const monthHead = (m) => `${esc(m.label.replace(/ \d{4}$/, ''))}<div class="pf-sub">${m.to_date ? 'so far' : m.partial ? `${+m.from.slice(8)}–${+m.to.slice(8)}` : esc(m.key.slice(0, 4))}</div>`;

export async function renderPerformance(container) {
  let range = remembered();

  async function load() {
    const q = range.preset && range.preset !== 'custom'
      ? `preset=${encodeURIComponent(range.preset)}`
      : `from=${encodeURIComponent(range.from)}&to=${encodeURIComponent(range.to)}`;
    let d;
    try { d = await api.get(`/api/stats?${q}`); } catch (err) {
      container.innerHTML = `
        <div class="page-head"><div class="ph-icon">${icon('bar', 20)}</div>
          <div><h1>Performance</h1><div class="ph-sub">How the business is doing</div></div></div>
        <div class="card"><div class="empty">${icon('lock', 18)}<div>${esc(err?.status === 403 ? 'Only the business owner can see the numbers.' : (err?.message || "Couldn't load this just now."))}</div></div></div>`;
      return;
    }
    if (!d || !d.total) return;
    draw(d);
  }

  function draw(d) {
    const t = d.total; const p = d.previous; const rr = d.run_rate;
    const vs = `vs ${shortRange(p.from, p.to)}`;
    const custom = d.preset === 'custom';
    container.innerHTML = `
      <div class="page-head">
        <div class="ph-icon">${icon('bar', 20)}</div>
        <div><h1>Performance</h1><div class="ph-sub">${esc(shortRange(d.from, d.to))} · ${d.days} day${d.days === 1 ? '' : 's'}</div></div>
        <div class="ph-actions">
          <button class="btn" id="pf-email">${icon('mail')} <span class="btn-label">Email this report</span></button>
        </div>
      </div>

      <div class="pf-filters">
        <div class="seg pf-seg" role="group" aria-label="Dates">
          ${PRESETS.map(([id, l]) => `<button type="button" data-preset="${id}" class="${d.preset === id ? 'active' : ''}">${l}</button>`).join('')}
          <button type="button" data-preset="custom" class="${custom ? 'active' : ''}">Choose dates</button>
        </div>
        <div class="pf-custom" ${custom ? '' : 'hidden'}>
          <input type="date" id="pf-from" value="${esc(d.from)}" aria-label="From">
          <span>to</span>
          <input type="date" id="pf-to" value="${esc(d.to)}" aria-label="To">
          <button type="button" class="btn primary" id="pf-go">Show</button>
        </div>
      </div>

      <div class="card pf-hero">
        <div>
          <div class="st-label">Appointment value</div>
          <div class="pf-big">${money(t.value_cents)}</div>
          <div class="st-foot">${p.visits ? `${delta(t.value_cents, p.value_cents)} ${esc(vs)}` : `Nothing in Kairo to compare with for ${esc(shortRange(p.from, p.to))}`}</div>
        </div>
        <div class="pf-run">
          <div class="st-label">At this pace</div>
          <div class="pf-run-v">${money(rr.month_cents)} <span>a month</span></div>
          <div class="pf-run-v">${money(rr.year_cents)} <span>a year</span></div>
          <div class="st-foot">From the last 30 days (${money(rr.last_30_days_cents)})</div>
        </div>
        <div class="pf-run">
          <div class="st-label">This month</div>
          <div class="pf-run-v">${money(rr.this_month_so_far_cents)} <span>so far</span></div>
          <div class="pf-run-v">${money(rr.this_month_pace_cents)} <span>on pace for</span></div>
          <div class="st-foot">${money(rr.next_30_days_booked_cents)} already booked for the next 30 days (${rr.next_30_days_booked})</div>
        </div>
      </div>

      <div class="stats-row">
        ${tile('Appointments', String(t.visits), `avg ${t.visits ? money(t.avg_value_cents) : '—'}`, 'calendar', 'tint-blue', delta(t.visits, p.visits))}
        ${tile('New clients', String(t.new_clients), `${t.clients_seen} seen in all`, 'users', 'tint-violet', delta(t.new_clients, p.new_clients))}
        ${tile('Rebooked before leaving', rate(t.rebook_rate), 'of visits', 'reply', 'tint-cyan', delta(t.rebook_rate, p.rebook_rate, { kind: 'rate' }))}
        ${tile('Diary full', rate(t.diary_full), 'of rostered time', 'clock', 'tint-green', delta(t.diary_full, p.diary_full, { kind: 'rate' }))}
        ${tile('Came back or booked again', rate(t.return_rate), 'of clients seen', 'trendUp', 'tint-green', '')}
        ${tile('Booked online', rate(t.online_share), `${t.online} appointments`, 'globe', 'tint-blue', delta(t.online_share, p.online_share, { kind: 'rate' }))}
        ${tile('No-shows', String(t.no_shows), `${rate(t.no_show_rate)} · ${t.cancelled} cancelled`, 'alert', 'tint-amber', delta(t.no_shows, p.no_shows, { lowerIsBetter: true }))}
        ${tile('Payments taken in Kairo', money(t.takings_cents), 'recorded in Kairo', 'dollar', 'tint-green', delta(t.takings_cents, p.takings_cents))}
      </div>

      ${d.months.length > 1 ? `
      <div class="card mt">
        <div class="card-title">Appointment value by month</div>
        <div class="card-sub">What each month's appointments were worth at your prices</div>
        <div id="pf-chart"></div>
      </div>` : ''}

      <div class="card mt">
        <div class="card-title">Month by month</div>
        <div class="card-sub">Each month on its own${d.months.some((m) => m.to_date) ? '. This month is still filling up.' : ''}</div>
        ${d.months.length > 1 ? '<div class="pf-swipe">Swipe sideways for each month →</div>' : ''}
        <div class="table-wrap"><table class="data pf-table">
          <thead><tr><th></th>${d.months.map((m) => `<th>${monthHead(m)}</th>`).join('')}${d.months.length > 1 ? '<th>Total</th>' : ''}</tr></thead>
          <tbody>${ROWS.map(([label, f]) => `<tr><td>${esc(label)}</td>${d.months.map((m) => `<td>${f(m)}</td>`).join('')}${d.months.length > 1 ? `<td><b>${f(t)}</b></td>` : ''}</tr>`).join('')}</tbody>
        </table></div>
      </div>

      <div class="grid-2 mt pf-grid">
        <div class="card">
          <div class="card-title">Top services</div>
          <div class="card-sub">By appointment value</div>
          ${d.top_services.length ? `<div class="table-wrap"><table class="data pf-list"><tbody>${d.top_services.map((s) => `
            <tr><td>${esc(s.name)}</td><td>${s.count}×</td><td><b>${money(s.value_cents)}</b></td></tr>`).join('')}</tbody></table></div>`
            : '<div class="empty">No appointments in these dates.</div>'}
        </div>
        <div class="card">
          <div class="card-title">Team</div>
          <div class="card-sub">Appointments, value and how full each diary was</div>
          ${d.team.length ? `<div class="table-wrap"><table class="data pf-list"><tbody>${d.team.map((s) => `
            <tr><td>${esc(s.name)}</td><td>${s.visits}</td><td><b>${money(s.value_cents)}</b></td><td>${rate(s.diary_full)} full</td></tr>`).join('')}</tbody></table></div>`
            : '<div class="empty">No appointments in these dates.</div>'}
        </div>
      </div>

      <div class="card mt">
        <div class="card-title">Busiest days</div>
        <div class="card-sub">Appointments by day of the week</div>
        <div id="pf-days"></div>
      </div>

      <details class="card mt pf-how">
        <summary>How these are counted</summary>
        <ul>
          <li><b>Appointment value</b> is what the appointments were worth at your menu prices. A "from" price counts at its starting price. Cancellations and no-shows are left out.</li>
          <li><b>Payments taken in Kairo</b> only counts payments recorded in Kairo. If you take most payments on another machine, appointment value is the better guide.</li>
          <li><b>Rebooked before leaving</b> means the client had their next appointment booked by the end of the day of their visit.</li>
          <li><b>Came back or booked again</b> means a client seen in these dates has visited since, or is booked in. Recent months always look lower: their clients haven't had time to come back yet.</li>
          <li><b>Diary full</b> is booked time against the hours your team was rostered on, less any time you blocked out.</li>
          <li><b>At this pace</b> takes the last 30 days of appointment value and scales it to a month and a year.</li>
          <li>Each figure is compared with ${esc(shortRange(p.from, p.to))}.</li>
        </ul>
      </details>`;

    if (d.months.length > 1) {
      barChart(container.querySelector('#pf-chart'), {
        data: d.months.map((m) => ({ label: m.label.slice(0, 3), sub: `${m.label}${m.to_date ? ' (so far)' : ''} · ${m.visits} appointments`, value: m.value_cents })),
        color: '#199e70', height: 220,
        format: (v, axis) => (axis ? (v >= 100000 ? `${Math.round(v / 10000) / 10}k` : `${Math.round(v / 100)}`) : money(v)),
      });
    }
    // Monday first: that is how a salon's week reads.
    const days = [...d.weekdays.slice(1), d.weekdays[0]];
    barChart(container.querySelector('#pf-days'), {
      data: days.map((w) => ({ label: w.name.slice(0, 3), sub: `${w.name} · ${money(w.value_cents)}`, value: w.visits })),
      color: '#3987e5', height: 190,
      format: (v, axis) => (axis ? String(Math.round(v)) : `${v} appointment${v === 1 ? '' : 's'}`),
    });

    container.querySelectorAll('[data-preset]').forEach((b) => b.addEventListener('click', () => {
      if (b.dataset.preset === 'custom') { container.querySelector('.pf-custom').hidden = false; container.querySelector('#pf-from').focus(); return; }
      range = { preset: b.dataset.preset };
      remember(range);
      load();
    }));
    container.querySelector('#pf-go').addEventListener('click', () => {
      const from = container.querySelector('#pf-from').value;
      const to = container.querySelector('#pf-to').value;
      if (!from || !to) { toast('Choose both dates', 'err'); return; }
      range = { preset: 'custom', from, to };
      remember(range);
      load();
    });
    container.querySelector('#pf-email').addEventListener('click', async (e) => {
      const btn = e.currentTarget;
      btn.disabled = true;
      try {
        const body = d.preset === 'custom' ? { from: d.from, to: d.to } : { preset: d.preset };
        const r = await api.post('/api/stats/email', body);
        toast(`Report sent to ${r.to}`);
      } catch (err) {
        toast(err.message || 'The report could not be sent', 'err');
      } finally {
        btn.disabled = false;
      }
    });
  }

  container.innerHTML = '<div class="empty">Working out your numbers…</div>';
  await load();
}
