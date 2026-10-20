// Kairo Operator: the business at a glance, and everything waiting on a person.
//
// Three tabs — Overview, Salons, Activity — over one call to the platform, so
// what the phone shows is one consistent moment. Built for the home screen:
// it refreshes itself every minute while it is open, and every action asks
// before it moves money or deletes anything.
const app = document.getElementById('app');
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = (c) => `A$${((c || 0) / 100).toLocaleString('en-AU', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
// Paid, or nearly, with no salon yet: those are settled with retry, approve or refund, never removed.
const UNSETTLED = new Set(['paid', 'screening', 'flagged', 'provisioning']);
const TAB_KEY = 'kairo_op_tab';

let data = null;
let tab = (() => { try { return localStorage.getItem(TAB_KEY) || 'overview'; } catch { return 'overview'; } })();
let query = '';
let filter = 'all';
let timer = null;

const ICON = {
  home: '<path d="M3 11.5 12 4l9 7.5"/><path d="M5 10v10h14V10"/>',
  store: '<path d="M4 9h16l-1.5-5h-13z"/><path d="M5 9v11h14V9"/><path d="M9 20v-6h6v6"/>',
  pulse: '<path d="M3 12h4l2-6 4 12 2-6h6"/>',
  refresh: '<path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 4v7h-7"/>',
  out: '<path d="M15 4h4v16h-4"/><path d="M10 8l-4 4 4 4"/><path d="M6 12h10"/>',
  money: '<rect x="3" y="6" width="18" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/>',
  live: '<circle cx="12" cy="12" r="3"/><path d="M5.6 5.6a9 9 0 0 0 0 12.8M18.4 5.6a9 9 0 0 1 0 12.8"/>',
  bell: '<path d="M6 8a6 6 0 1 1 12 0c0 7 3 8 3 8H3s3-1 3-8"/><path d="M10 20a2 2 0 0 0 4 0"/>',
  funnel: '<path d="M3 5h18l-7 8v6l-4 2v-8z"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  check: '<path d="m5 12 5 5 9-10"/>',
  undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
  alert: '<path d="M12 3 2 21h20z"/><path d="M12 10v5M12 18h.01"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
};
const icon = (n, s = 18) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[n] || ''}</svg>`;

async function call(method, path, body) {
  const res = await fetch(path, { method, headers: body ? { 'content-type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined });
  const text = await res.text();
  let out = null; try { out = JSON.parse(text); } catch { /* not json */ }
  if (res.status === 401 && !path.endsWith('/login')) { stop(); renderLogin(); throw new Error('signed out'); }
  if (!res.ok) throw new Error(out?.error || `Failed (${res.status})`);
  return out;
}

const toast = (msg) => {
  const t = document.createElement('div');
  t.className = 'toast'; t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2600);
};

// ── time, in the operator's own words ──────────────────────────────────────
const when = (sql) => (sql ? new Date(`${String(sql).replace(' ', 'T')}Z`) : null);
function ago(sql) {
  const d = when(sql);
  if (!d || Number.isNaN(d.getTime())) return '';
  const s = (Date.now() - d.getTime()) / 1000;
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  if (s < 86400 * 2) return `yesterday, ${d.toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit' })}`;
  if (s < 86400 * 7) return d.toLocaleDateString('en-AU', { weekday: 'long' });
  return d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: d.getFullYear() === new Date().getFullYear() ? undefined : 'numeric' });
}
const dateOnly = (sql) => { const d = when(sql); return d ? d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' }) : ''; };
const greeting = () => { const h = new Date().getHours(); return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'; };
const initials = (n) => String(n || '?').split(/\s+/).filter((w) => /^[a-z0-9]/i.test(w)).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?';
// A history line in words when there are words for it; the raw event otherwise.
const say = (kind) => data?.labels?.[kind] || String(kind).replace(/[:_-]/g, ' ');

const STATE_LABEL = {
  created: 'Started', verified: 'Email confirmed', payment_pending: 'At payment', paid: 'Paid', screening: 'Checking',
  flagged: 'Held', provisioning: 'Building', ready: 'Live', refunded: 'Refunded', expired: 'Expired', deleted: 'Closed',
};
const pill = (b) => (b.state === 'ready' && b.refund_days_left > 0
  ? `<span class="pill window" title="Could still ask for a refund">Live · ${b.refund_days_left}d window</span>`
  : `<span class="pill ${esc(b.state)}">${esc(STATE_LABEL[b.state] || b.state)}</span>`);

// ── sign in ────────────────────────────────────────────────────────────────
function renderLogin(error = '') {
  app.innerHTML = `<div class="login">
    <div class="card">
      <div class="mark">K</div>
      <h1>Kairo Operator</h1>
      <p>Every salon, sale and signup — and anything waiting on you.</p>
      <form id="f">
        <input id="p" type="password" autocomplete="current-password" placeholder="Operator password" required aria-label="Operator password">
        <label class="keep"><input type="checkbox" id="keep" checked> Keep me signed in on this device</label>
        <button class="btn go" type="submit">Sign in</button>
        ${error ? `<div class="err">${esc(error)}</div>` : ''}
      </form>
    </div>
  </div>`;
  const f = app.querySelector('#f');
  app.querySelector('#p').focus();
  f.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      await call('POST', '/api/operator/login', { password: app.querySelector('#p').value, remember: app.querySelector('#keep').checked });
      await load();
    } catch (err) { renderLogin(err.message); }
  });
}

// ── the shell ──────────────────────────────────────────────────────────────
const TABS = [['overview', 'Overview', 'home'], ['salons', 'Salons', 'store'], ['activity', 'Activity', 'pulse']];
function shell(inner) {
  const waiting = data.tasks.length;
  const h = data.health;
  const healthy = h.shard.ok && h.email && h.stripe === 'live';
  return `
    <div class="top">
      <div class="mark">K</div>
      <div>
        <h1>${greeting()}</h1>
        <div class="sub">${new Date().toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long' })}</div>
        <div class="status"><span class="dot ${healthy ? 'ok' : 'warn'}"></span>${healthy ? 'All systems normal' : 'Check System below'}</div>
      </div>
      <div class="spacer"></div>
      <button class="icon-btn" data-act="reload" aria-label="Refresh">${icon('refresh')}</button>
      <button class="icon-btn" data-act="logout" aria-label="Sign out">${icon('out')}</button>
    </div>
    <nav class="tabs" aria-label="Sections">
      ${TABS.map(([id, label, ic]) => `<button class="tab ${tab === id ? 'on' : ''}" data-tab="${id}">${icon(ic, 17)}<span>${label}</span>${id === 'overview' && waiting ? `<span class="n">${waiting}</span>` : ''}</button>`).join('')}
    </nav>
    ${inner}`;
}

function render() {
  if (!data) return;
  const body = tab === 'salons' ? salonsTab() : tab === 'activity' ? activityTab() : overviewTab();
  const keep = document.activeElement?.id === 'q' ? document.activeElement.selectionStart : null;
  app.innerHTML = shell(body);
  if (keep !== null) { const q = app.querySelector('#q'); if (q) { q.focus(); q.setSelectionRange(keep, keep); } }
}

// ── overview ───────────────────────────────────────────────────────────────
function overviewTab() {
  const m = data.money; const c = data.counts; const waiting = data.tasks.length;
  const conv = c.started_30d ? Math.round((c.paid_30d / c.started_30d) * 100) : 0;
  return `
    <div class="grid kpis">
      <div class="card kpi"><div class="lbl">${icon('money', 15)} Revenue</div><div class="val">${money(m.net)}</div>
        <div class="foot">${money(m.month)} this month${m.refunded_n ? ` · ${m.refunded_n} refunded` : ''}</div></div>
      <div class="card kpi"><div class="lbl">${icon('live', 15)} Live salons</div><div class="val">${c.live}</div>
        <div class="foot">${c.live_7d ? `+${c.live_7d} this week` : 'none new this week'}${c.in_window ? ` · ${c.in_window} in refund window` : ''}</div></div>
      <div class="card kpi ${waiting ? 'alert' : 'calm'}"><div class="lbl">${icon('bell', 15)} Waiting on you</div><div class="val">${waiting}</div>
        <div class="foot">${waiting ? 'see below' : 'nothing to do'}</div></div>
      <div class="card kpi"><div class="lbl">${icon('funnel', 15)} Conversion</div><div class="val">${conv}%</div>
        <div class="foot">${c.paid_30d} paid of ${c.started_30d} started · 30 days</div></div>
    </div>

    ${waiting ? `<div class="section"><div class="grid">${data.tasks.map(taskCard).join('')}</div></div>` : ''}

    <div class="grid two section">
      <div class="card"><h2>Sales by week</h2><div class="cap">Salons sold in each of the last 12 weeks</div>${chart()}</div>
      <div class="card"><h2>Last 30 days</h2><div class="cap">From first click to a live salon</div>${funnel()}</div>
    </div>

    <div class="grid two section">
      <div class="card"><h2>Newest salons</h2><div class="cap">Tap one for details and actions</div>
        <div class="list">${data.salons.filter((s) => s.state === 'ready').slice(0, 6).map(salonRow).join('') || '<div class="empty">No live salons yet.</div>'}</div></div>
      <div class="card"><h2>System</h2><div class="cap">Checked ${ago(data.generated_at.replace('T', ' ').slice(0, 19))}</div>${system()}</div>
    </div>`;
}

function chart() {
  const w = data.weeks;
  const max = Math.max(1, ...w.map((x) => x.paid));
  const total = w.reduce((s, x) => s + x.cents, 0);
  return `<div class="chart" role="img" aria-label="Salons sold by week">
    ${w.map((x) => {
      const d = new Date(`${x.start}T00:00:00Z`);
      return `<div class="bar" title="Week of ${d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}: ${x.paid} sold (${money(x.cents)}), ${x.started} started">
        <div class="y">${x.paid || ''}</div>
        <div class="col ${x.paid ? '' : 'zero'}" style="height:${Math.max(3, (x.paid / max) * 100)}%"></div>
        <div class="x">${d.toLocaleDateString('en-AU', { day: 'numeric', month: 'numeric' })}</div>
      </div>`;
    }).join('')}
  </div>
  <div class="legend"><span><i style="background:#3b82f6"></i>${money(total)} in 12 weeks</span>
    <span>${w.reduce((s, x) => s + x.started, 0)} signups started</span></div>`;
}

function funnel() {
  const c = data.counts;
  const top = Math.max(1, c.started_30d);
  const step = (label, n) => `<div class="step"><div class="row"><span>${label}</span><b>${n}</b></div>
    <div class="track"><span style="width:${Math.round((n / top) * 100)}%"></span></div></div>`;
  return `<div class="funnel">
    ${step('Started signing up', c.started_30d)}
    ${step('Confirmed their email', c.verified_30d)}
    ${step('Paid', c.paid_30d)}
    ${step('Went live', c.live_30d)}
  </div>
  <div class="legend" style="margin-top:14px"><span>${c.unpaid} signup${c.unpaid === 1 ? '' : 's'} not paid yet · each held a week</span></div>`;
}

function system() {
  const h = data.health;
  const s = (state, k, v) => `<div class="s"><span class="dot ${state}"></span><div><div class="k">${k}</div><div class="v">${v}</div></div></div>`;
  return `<div class="sys">
    ${s(h.shard.ok ? 'ok' : 'bad', 'Salon server', h.shard.ok ? `Running v${esc(h.shard.version)} · ${h.shard.salons} salon${h.shard.salons === 1 ? '' : 's'}` : `Not answering — ${esc(h.shard.error)}`)}
    ${s('ok', 'Signup site', `Running v${esc(h.platform_version)}`)}
    ${s(h.stripe === 'live' ? 'ok' : 'warn', 'Payments (Stripe)', h.stripe === 'live' ? 'Live — taking real money' : h.stripe === 'test' ? 'Test mode — no real money' : 'Not set up')}
    ${s(h.email ? 'ok' : 'bad', 'Signup emails', h.email ? 'Sending' : 'Not configured')}
    ${s('ok', 'Last sale', h.last_payment_at ? ago(h.last_payment_at) : 'None yet')}
    ${s(h.purges_waiting ? 'warn' : 'ok', 'Refunded files', h.purges_waiting ? `${h.purges_waiting} to delete on schedule` : 'Nothing waiting')}
  </div>`;
}

// ── needs you ──────────────────────────────────────────────────────────────
const TASK_TITLES = {
  flagged: 'Check this signup',
  email_setup: 'Set up their email',
  provision_failed: 'Setting up failed',
  refund_request: 'Refund requested',
  parting_copy: 'Send their data',
  switch_off: 'Switch the salon off',
  purge: 'Delete the files',
  purge_failed: 'Files not deleted',
};
function taskCard(t) {
  const flags = (() => { try { return JSON.parse(t.flags || '[]'); } catch { return []; } })();
  return `<div class="card task" data-task="${t.id}">
    <div style="display:flex;justify-content:space-between;gap:12px;align-items:start">
      <div><h3>${esc(TASK_TITLES[t.kind] || t.kind)}</h3>
        <div class="who">${esc(t.business_name || '')} · <span class="mono">${esc(t.slug || '')}</span>${t.email ? ` · ${esc(t.email)}` : ''}</div></div>
      <span class="pill flagged">${ago(t.created_at)}</span>
    </div>
    ${flags.length ? `<ul>${flags.map((f) => `<li>${esc(f)}</li>`).join('')}</ul>` : ''}
    ${t.detail && !flags.length ? `<p class="det">${esc(t.detail)}</p>` : ''}
    ${t.kind === 'flagged' ? `<p class="det">${t.abn ? `ABN ${esc(t.abn)}${t.abn_name ? ` — registered to ${esc(t.abn_name)}` : ''}` : 'No ABN given'}</p>` : ''}
    <div class="acts">
      ${t.kind === 'flagged' ? `<button class="btn go" data-act="approve" data-id="${t.business_id}">${icon('check', 15)} Approve &amp; set up</button>
        <button class="btn danger" data-act="refund" data-id="${t.business_id}">Refund ${money(t.price_cents)}</button>` : ''}
      ${t.kind === 'provision_failed' ? `<button class="btn go" data-act="retry" data-id="${t.business_id}">Try again</button>
        <button class="btn danger" data-act="refund" data-id="${t.business_id}">Refund</button>` : ''}
      ${t.kind === 'refund_request' ? `<button class="btn danger" data-act="refund" data-id="${t.business_id}">Refund ${money(t.price_cents)}</button>` : ''}
      ${t.kind === 'parting_copy' ? `<button class="btn go" data-act="send-copy" data-id="${t.business_id}">Send their data again</button>` : ''}
      ${t.business_id ? `<button class="btn" data-open="${t.business_id}">Details</button>` : ''}
      <button class="btn" data-act="done" data-task="${t.id}">Mark done</button>
    </div>
  </div>`;
}

// ── salons ─────────────────────────────────────────────────────────────────
function salonRow(b) {
  return `<div class="item" data-open="${b.id}" role="button" tabindex="0">
    <div class="av">${esc(initials(b.name))}</div>
    <div class="body"><div class="nm">${esc(b.name)}</div>
      <div class="meta">${esc(b.owner || '')}${b.owner ? ' · ' : ''}<span class="mono">${esc(b.slug)}</span>${b.source ? ` · from ${esc(b.source)}` : ''}</div></div>
    <div class="right"><div class="amt">${b.paid_at ? money(b.price_cents) : ''}</div>${pill(b)}</div>
  </div>`;
}
const FILTERS = [['all', 'All'], ['live', 'Live'], ['window', 'In refund window'], ['unpaid', 'Not paid'], ['refunded', 'Refunded']];
function salonsTab() {
  const q = query.trim().toLowerCase();
  const list = data.salons.filter((b) => {
    if (filter === 'live' && b.state !== 'ready') return false;
    if (filter === 'window' && !(b.refund_days_left > 0)) return false;
    if (filter === 'unpaid' && !['created', 'verified', 'payment_pending'].includes(b.state)) return false;
    if (filter === 'refunded' && b.state !== 'refunded') return false;
    return !q || [b.name, b.slug, b.owner, b.email, b.phone].some((v) => String(v || '').toLowerCase().includes(q));
  });
  return `
    <div class="tools">
      <div class="search">${icon('search', 17)}<input id="q" type="search" placeholder="Search salons or owners" value="${esc(query)}" autocomplete="off"></div>
    </div>
    <div class="chips" style="margin-bottom:12px">${FILTERS.map(([id, label]) => `<button class="chip ${filter === id ? 'on' : ''}" data-filter="${id}">${label}</button>`).join('')}</div>
    <div class="card"><div class="cap" style="margin:0 0 4px">${list.length} of ${data.salons.length}</div>
      <div class="list">${list.map(salonRow).join('') || '<div class="empty">Nothing matches.</div>'}</div></div>`;
}

// ── activity ───────────────────────────────────────────────────────────────
const TONE = { 'state:ready': ['good', 'live'], 'state:paid': ['good', 'money'], 'state:refunded': ['bad', 'undo'], 'refund:copy-failed': ['bad', 'alert'],
  'stripe:dispute': ['bad', 'alert'], 'state:flagged': ['warn', 'alert'], 'purge:done': ['', 'trash'], 'email:ready': ['', 'mail'], 'signup:start': ['', 'user'] };
function activityTab() {
  return `<div class="card"><h2>What happened</h2><div class="cap">The last ${data.activity.length} things, newest first</div>
    ${data.activity.map((e) => {
      const [tone, ic] = TONE[e.kind] || ['', 'pulse'];
      return `<div class="ev"><div class="ic ${tone}">${icon(ic, 16)}</div><div>
        <div class="t">${e.name ? `<b>${esc(e.name)}</b> — ` : ''}${esc(e.label)}</div>
        <div class="when">${ago(e.at)}${e.detail && e.kind !== 'state:paid' ? ` · ${esc(String(e.detail).slice(0, 90))}` : ''}</div></div></div>`;
    }).join('') || '<div class="empty">Nothing yet.</div>'}</div>`;
}

// ── the salon sheet ────────────────────────────────────────────────────────
async function openSalon(id) {
  const b = data.salons.find((s) => String(s.id) === String(id));
  if (!b) return;
  const scrim = document.createElement('div');
  scrim.className = 'scrim';
  const host = `${b.slug}.${data.base_domain || 'kairobookings.com'}`;
  const url = `https://${host}`;
  scrim.innerHTML = `<div class="sheet" role="dialog" aria-label="${esc(b.name)}">
    <div class="hd"><div class="av">${esc(initials(b.name))}</div>
      <div style="flex:1;min-width:0"><h2>${esc(b.name)}</h2><div class="meta">${pill(b)}</div></div>
      <button class="icon-btn" data-close aria-label="Close">${icon('x')}</button></div>
    <dl class="facts">
      <dt>Owner</dt><dd>${esc(b.owner || '—')}</dd>
      <dt>Email</dt><dd>${b.email ? `<a href="mailto:${esc(b.email)}">${esc(b.email)}</a>` : '—'}</dd>
      <dt>Mobile</dt><dd>${b.phone ? `<a href="tel:${esc(String(b.phone).replace(/\s/g, ''))}">${esc(b.phone)}</a>` : '—'}</dd>
      <dt>Address</dt><dd class="mono">${esc(host)}</dd>
      <dt>ABN</dt><dd>${b.abn ? `${esc(b.abn)}${b.abn_name ? ` · ${esc(b.abn_name)}` : ''}` : '—'}</dd>
      <dt>Started</dt><dd>${dateOnly(b.created_at)}</dd>
      ${b.paid_at ? `<dt>Paid</dt><dd>${dateOnly(b.paid_at)} · ${money(b.price_cents)}</dd>` : ''}
      ${b.ready_at ? `<dt>Live since</dt><dd>${dateOnly(b.ready_at)}</dd>` : ''}
      ${b.refunded_at ? `<dt>Refunded</dt><dd>${dateOnly(b.refunded_at)}${b.files_purged_at ? ' · files deleted' : ''}</dd>` : ''}
    </dl>
    <div class="acts">
      ${b.state === 'ready' ? `<a class="btn" href="${esc(url)}/book" target="_blank" rel="noopener">Booking page</a>
        <a class="btn" href="${esc(url)}" target="_blank" rel="noopener">Their Kairo</a>
        <button class="btn" data-act="welcome" data-id="${b.id}">${icon('mail', 15)} Resend welcome</button>` : ''}
      ${b.paid_at && !b.refunded_at ? `<button class="btn" data-act="receipt" data-id="${b.id}">${icon('mail', 15)} Resend receipt</button>` : ''}
      ${b.email ? `<a class="btn" href="mailto:${esc(b.email)}">${icon('mail', 15)} Email</a>` : ''}
      ${['ready', 'flagged', 'paid', 'provisioning', 'screening'].includes(b.state) && b.paid_at ? `<button class="btn danger" data-act="refund" data-id="${b.id}">Refund ${money(b.price_cents)}</button>` : ''}
      ${UNSETTLED.has(b.state) || b.state === 'ready' ? '' : `<button class="btn" data-act="remove" data-id="${b.id}" data-slug="${esc(b.slug)}">Remove test record</button>`}
    </div>
    <h2 style="font-size:14px;margin:22px 0 4px">History</h2>
    <div class="timeline" id="tl"><div class="e"><span class="when">Loading…</span></div></div>
  </div>`;
  document.body.appendChild(scrim);
  const close = () => { scrim.remove(); document.removeEventListener('keydown', onKey); };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', onKey);
  scrim.addEventListener('click', (e) => {
    if (e.target === scrim || e.target.closest('[data-close]')) { close(); return; }
    act(e);
  });
  try {
    const d = await call('GET', `/api/operator/business/${b.id}`);
    scrim.querySelector('#tl').innerHTML = d.events.slice(0, 40).map((e) => `<div class="e">${esc(say(e.kind))}${e.detail ? ` <span class="when">— ${esc(String(e.detail).slice(0, 120))}</span>` : ''}<div class="when">${ago(e.at)}</div></div>`).join('') || '<div class="e">Nothing recorded.</div>';
  } catch (err) {
    scrim.querySelector('#tl').innerHTML = `<div class="e">${esc(err.message)}</div>`;
  }
}

// ── actions ────────────────────────────────────────────────────────────────
const CONFIRM = {
  refund: () => 'Refund in full?\n\nTheir data is emailed to them first, their salon is switched off, and its files are deleted 7 days later.',
  remove: (b) => `Remove the record for ${b.dataset.slug}?\n\nOnly for test signups. No money moves and no salon is touched; it just leaves this list and the totals. A salon that is still live can't be removed — refund it instead.`,
  approve: () => 'Approve this signup and build their salon now?',
  welcome: () => 'Send the Welcome to Kairo email to the owner again?',
  receipt: () => 'Email the owner their receipt for Kairo again?',
};
const DONE = { done: 'Marked done', refund: 'Refunded', remove: 'Removed', approve: 'Approved — building now', welcome: 'Welcome email sent', receipt: 'Receipt sent', retry: 'Trying again', 'send-copy': 'Their data was sent' };
async function act(e) {
  const btn = e.target.closest('[data-act]');
  if (!btn) return;
  const a = btn.dataset.act;
  if (a === 'reload') { load(true); return; }
  if (a === 'logout') { await call('POST', '/api/operator/logout', {}).catch(() => {}); stop(); data = null; renderLogin(); return; }
  if (CONFIRM[a] && !window.confirm(CONFIRM[a](btn))) return;
  btn.disabled = true;
  try {
    if (a === 'done') await call('POST', `/api/operator/task/${btn.dataset.task}/done`, {});
    else if (a === 'refund') await call('POST', `/api/operator/business/${btn.dataset.id}/refund`, { reason: 'operator' });
    else await call('POST', `/api/operator/business/${btn.dataset.id}/${a}`, {});
    toast(DONE[a] || 'Done');
    document.querySelector('.scrim')?.remove();
    await load();
  } catch (err) {
    btn.disabled = false;
    if (err.message !== 'signed out') window.alert(err.message);
  }
}

// One delegated listener for the life of the page, so a failed action never
// leaves the console with dead buttons.
app.addEventListener('click', (e) => {
  const t = e.target.closest('[data-tab]');
  if (t) { tab = t.dataset.tab; try { localStorage.setItem(TAB_KEY, tab); } catch { /* private mode */ } render(); window.scrollTo(0, 0); return; }
  const f = e.target.closest('[data-filter]');
  if (f) { filter = f.dataset.filter; render(); return; }
  const o = e.target.closest('[data-open]');
  if (o && !e.target.closest('[data-act]')) { openSalon(o.dataset.open); return; }
  act(e);
});
app.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && e.target.matches('[data-open]')) openSalon(e.target.dataset.open);
});
app.addEventListener('input', (e) => { if (e.target.id === 'q') { query = e.target.value; render(); } });

// ── loading ────────────────────────────────────────────────────────────────
function stop() { clearInterval(timer); timer = null; }
async function load(manual = false) {
  app.querySelector('[data-act="reload"]')?.classList.add('spin');
  try {
    data = await call('GET', '/api/operator/overview');
    render();
    if (manual) toast('Up to date');
    if (!timer) timer = setInterval(() => { if (!document.hidden && !document.querySelector('.scrim')) load().catch(() => {}); }, 60000);
  } catch (err) {
    if (err.message === 'signed out') return;
    if (!data) renderLogin(err.message); else toast(err.message);
  } finally {
    app.querySelector('[data-act="reload"]')?.classList.remove('spin');
  }
}
document.addEventListener('visibilitychange', () => { if (!document.hidden && timer) load().catch(() => {}); });

load();
