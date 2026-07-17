// App shell: session check, login screen, sidebar navigation, hash router.
import { api, ApiError } from './api.js';
import { esc, icon, LOGO_SVG, toast, setCurrency, fmtDate, todayStr, initials } from './ui.js';
import { renderDashboard } from './pages/dashboard.js';
import { renderCalendar } from './pages/calendar.js';
import { renderClients } from './pages/clients.js';
import { renderServices } from './pages/services.js';
import { renderInvoices } from './pages/invoices.js';
import { renderStaff } from './pages/staff.js';
import { renderSettings } from './pages/settings.js';
import { renderMessages } from './pages/messages.js';
import { renderReviews } from './pages/reviews.js';
import { renderPos } from './pages/pos.js';
import { renderProducts } from './pages/products.js';
import { runSetupWizard } from './wizard.js';
import { mountIntro } from './intro.js';

export const state = {
  user: null,
  settings: {},
  version: '',
  staff: [],
  services: [],
  locations: [],
};

export async function refreshLookups() {
  [state.staff, state.services, state.locations] = await Promise.all([
    api.get('/api/staff'), api.get('/api/services'), api.get('/api/locations'),
  ]);
}

const ROUTES = {
  dashboard: { title: 'Dashboard', icon: 'grid', render: renderDashboard },
  pos: { title: 'Point of Sale', icon: 'card', render: renderPos },
  calendar: { title: 'Calendar', icon: 'calendar', render: renderCalendar },
  clients: { title: 'Clients', icon: 'users', render: renderClients },
  services: { title: 'Services', icon: 'tag', render: renderServices },
  products: { title: 'Products', icon: 'tag', render: renderProducts },
  invoices: { title: 'Billing', icon: 'invoice', render: renderInvoices },
  messages: { title: 'Messages', icon: 'send', render: renderMessages },
  reviews: { title: 'Reviews', icon: 'star', render: renderReviews },
  staff: { title: 'Team', icon: 'user', render: renderStaff },
  settings: { title: 'Settings', icon: 'settings', render: renderSettings },
};

const root = document.getElementById('app');
let pendingIntro = null; // set on login; reveal()ed once the workspace is rendered

function parseHash() {
  const raw = location.hash.replace(/^#\/?/, '') || 'dashboard';
  const [path, queryStr] = raw.split('?');
  return { page: path.split('/')[0] || 'dashboard', params: new URLSearchParams(queryStr || '') };
}

// ---------------------------------------------------------------------------
// Login
// ---------------------------------------------------------------------------

function renderLogin() {
  document.title = 'Sign in — Kairo';
  root.innerHTML = `
    <div class="login-wrap">
      <div class="login-card">
        <div class="brand">${LOGO_SVG}<div><div class="brand-name">Kairo</div></div></div>
        <div class="login-tag">The booking OS for modern service businesses</div>
        <form id="login-form">
          <div class="field"><label>Email</label>
            <input name="email" type="email" required autocomplete="username" placeholder="you@business.com"></div>
          <div class="field"><label>Password</label>
            <input name="password" type="password" required autocomplete="current-password" placeholder="••••••••"></div>
          <div class="login-error" id="login-error"></div>
          <button class="btn primary" type="submit" style="justify-content:center">Sign in</button>
        </form>
        <div class="login-demo">Demo workspace<br><code>admin@kairo.local</code> / <code>admin123</code></div>
      </div>
    </div>`;
  root.querySelector('#login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const errEl = root.querySelector('#login-error');
    errEl.textContent = '';
    try {
      await api.post('/api/auth/login', { email: fd.get('email'), password: fd.get('password') });
      // Cinematic brand intro doubles as the loading screen: it plays over
      // boot(), then splits open to reveal the loaded workspace.
      pendingIntro = mountIntro();
      await boot();
    } catch (err) {
      errEl.textContent = err.message;
      pendingIntro?.abort();
      pendingIntro = null;
    }
  });
}

// ---------------------------------------------------------------------------
// Shell
// ---------------------------------------------------------------------------

function renderShell() {
  document.title = `Kairo — ${esc(state.settings.business_name || 'Booking OS')}`;
  const navMain = ['dashboard', 'pos', 'calendar', 'clients', 'services', 'products', 'invoices'];
  const navManage = ['messages', 'reviews', 'staff', 'settings'];
  const navHtml = (keys) => keys.map((k) =>
    `<a class="nav-item" data-nav="${k}" href="#/${k}">${icon(ROUTES[k].icon)}<span>${ROUTES[k].title}</span></a>`
  ).join('');

  root.innerHTML = `
    <div class="app">
      <aside class="sidebar">
        <div class="brand">${LOGO_SVG}
          <div><div class="brand-name">Kairo</div>
          <div class="brand-sub">${esc(state.settings.business_name || '')}</div></div>
        </div>
        <nav class="nav">
          <div class="nav-label">Workspace</div>
          ${navHtml(navMain)}
          <div class="nav-label">Manage</div>
          ${navHtml(navManage)}
          <a class="nav-item" href="/book" target="_blank">${icon('globe')}<span>Booking page ↗</span></a>
        </nav>
        <div class="sidebar-foot">
          <div class="user-card">
            <div class="avatar">${esc(initials(state.user.name))}</div>
            <div><div class="u-name">${esc(state.user.name)}</div><div class="u-role">${esc(state.user.role)}</div></div>
            <button class="icon-btn" id="logout" title="Sign out">${icon('logout')}</button>
          </div>
          <div style="text-align:center;color:var(--muted);font-size:10.5px;margin-top:8px;letter-spacing:0.03em">Kairo v${esc(state.version || '')}</div>
        </div>
      </aside>
      <div class="main">
        <header class="topbar">
          <div class="search-box">${icon('search')}
            <input id="global-search" placeholder="Search clients, invoices…"></div>
          <div class="topbar-right">
            <span class="topbar-date">${fmtDate(todayStr())}</span>
            <button class="btn primary" id="quick-new">${icon('plus')} New appointment</button>
          </div>
        </header>
        ${state.settings.default_password_active === '1' ? `
        <div class="security-banner">
          ${icon('alert', 16)}
          <span><b>Change your password.</b> You're signed in with the default password — anyone who knows it can access your business. Set a new one in <a href="#/settings">Settings → Security</a>.</span>
        </div>` : ''}
        <main class="content"><div class="page" id="page"></div></main>
      </div>
    </div>`;

  root.querySelector('#logout').addEventListener('click', async () => {
    await api.post('/api/auth/logout');
    state.user = null;
    renderLogin();
  });
  root.querySelector('#quick-new').addEventListener('click', async () => {
    const { openAppointmentModal } = await import('./pages/calendar.js');
    openAppointmentModal({ onSaved: () => navigate() });
  });
  const search = root.querySelector('#global-search');
  search.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && search.value.trim()) {
      location.hash = `#/clients?q=${encodeURIComponent(search.value.trim())}`;
    }
  });
}

async function navigate() {
  const { page, params } = parseHash();
  const route = ROUTES[page] || ROUTES.dashboard;
  root.querySelectorAll('.nav-item[data-nav]').forEach((el) => {
    el.classList.toggle('active', el.dataset.nav === page);
  });
  const container = root.querySelector('#page');
  if (!container) return;
  container.innerHTML = '<div class="empty">Loading…</div>';
  try {
    await route.render(container, params);
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) { renderLogin(); return; }
    console.error(err);
    container.innerHTML = `<div class="empty">${icon('alert')}<div>Something went wrong: ${esc(err.message)}</div></div>`;
  }
}

async function boot() {
  try {
    const me = await api.get('/api/auth/me');
    state.user = me.user;
    state.settings = me.settings;
    state.version = me.version || '';
    setCurrency(state.settings.currency);
    // First login on a fresh deployment → guided setup wizard before the app.
    if (state.settings.setup_complete !== '1') {
      root.innerHTML = '';
      runSetupWizard({ firstRun: true, settings: state.settings, onDone: () => boot() });
      pendingIntro?.reveal();
      pendingIntro = null;
      return;
    }
    await refreshLookups();
    renderShell();
    await navigate();
    pendingIntro?.reveal();
    pendingIntro = null;
  } catch (err) {
    pendingIntro?.abort();
    pendingIntro = null;
    if (err instanceof ApiError && err.status === 401) renderLogin();
    else {
      root.innerHTML = `<div class="empty" style="padding-top:80px">${icon('alert')}<div>Cannot reach the Kairo server: ${esc(err.message)}</div></div>`;
    }
  }
}

window.addEventListener('hashchange', () => { if (state.user) navigate(); });
boot();
