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
import { renderAccount } from './pages/account.js';
import { renderMessages } from './pages/messages.js';
import { renderReviews } from './pages/reviews.js';
import { renderPos } from './pages/pos.js';
import { renderProducts } from './pages/products.js';
import { runSetupWizard } from './wizard.js';
import { mountIntro, adoptBootSplash } from './intro.js';
import { lockZoom } from './nozoom.js';

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
  account: { title: 'Account', icon: 'user', render: renderAccount },
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
  // Home-screen ("Add to Home Screen") label defaults to the business name.
  const appleTitle = document.querySelector('meta[name="apple-mobile-web-app-title"]');
  if (appleTitle && state.settings.business_name) appleTitle.setAttribute('content', state.settings.business_name);
  const navMain = ['dashboard', 'pos', 'calendar', 'clients', 'services', 'products', 'invoices'];
  const navManage = ['messages', 'reviews', 'staff', 'settings', 'account'];
  const navHtml = (keys) => keys.map((k) =>
    `<a class="nav-item" data-nav="${k}" href="#/${k}">${icon(ROUTES[k].icon)}<span>${ROUTES[k].title}</span></a>`
  ).join('');

  root.innerHTML = `
    <div class="app">
      <div class="nav-scrim" id="nav-scrim"></div>
      <aside class="sidebar">
        <div class="brand">${LOGO_SVG}
          <div><div class="brand-name">Kairo</div>
          <div class="brand-sub">${esc(state.settings.business_name || '')}</div></div>
          <button class="icon-btn nav-close" id="nav-close" title="Close menu" aria-label="Close menu">${icon('x')}</button>
        </div>
        <nav class="nav">
          <div class="nav-label">Workspace</div>
          ${navHtml(navMain)}
          <div class="nav-label">Manage</div>
          ${navHtml(navManage)}
          <a class="nav-item" href="/book" target="_blank" rel="noopener noreferrer">${icon('globe')}<span>Booking page ↗</span></a>
        </nav>
        <div class="sidebar-foot">
          <div class="user-card">
            <a class="avatar" href="#/account" title="Your account">${esc(initials(state.user.name))}</a>
            <a class="u-id" href="#/account" title="Your account">
              <div class="u-name">${esc(state.user.name)}</div><div class="u-role">${esc(state.user.role)}</div></a>
            <button class="icon-btn" id="logout" title="Sign out">${icon('logout')}</button>
          </div>
          <div style="text-align:center;color:var(--muted);font-size:10.5px;margin-top:8px;letter-spacing:0.03em">Kairo v${esc(state.version || '')}</div>
        </div>
      </aside>
      <div class="main">
        <header class="topbar">
          <button class="icon-btn nav-toggle" id="nav-toggle" title="Menu" aria-label="Open menu">${icon('menu', 20)}</button>
          <div class="brand-mobile">${LOGO_SVG}<span>${esc(state.settings.business_name || 'Kairo')}</span></div>
          <div class="search-box">${icon('search')}
            <input id="global-search" placeholder="Search clients, invoices…"></div>
          <div class="topbar-right">
            <span class="topbar-date">${fmtDate(todayStr())}</span>
            <button class="btn primary" id="quick-new">${icon('plus')} <span class="btn-label">New appointment</span></button>
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

  // Phone nav drawer: the sidebar slides in over the content and closes on a
  // scrim tap, the ✕, or after picking a destination (desktop ignores all this).
  const appEl = root.querySelector('.app');
  const openNav = () => appEl.classList.add('nav-open');
  const closeNav = () => appEl.classList.remove('nav-open');
  root.querySelector('#nav-toggle').addEventListener('click', openNav);
  root.querySelector('#nav-close').addEventListener('click', closeNav);
  root.querySelector('#nav-scrim').addEventListener('click', closeNav);
  root.querySelectorAll('.sidebar .nav-item').forEach((a) => a.addEventListener('click', closeNav));

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
  // The static splash from index.html is already on screen; hold it until the
  // workspace (or the login screen) is really rendered, then fade it out.
  const splash = adoptBootSplash();
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
      splash.done();
      return;
    }
    await refreshLookups();
    // Self-heal the business time zone for installs made before this existed:
    // the owner's browser zone is the salon's zone, and it's what keeps the
    // booking page from offering times that have already passed today.
    if (!state.settings.business_tz) {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (tz) {
        try { state.settings = await api.put('/api/settings', { business_tz: tz }); } catch { /* non-fatal */ }
      }
    }
    renderShell();
    await navigate();
    pendingIntro?.reveal();
    pendingIntro = null;
    splash.done();
  } catch (err) {
    pendingIntro?.abort();
    pendingIntro = null;
    if (err instanceof ApiError && err.status === 401) renderLogin();
    else {
      root.innerHTML = `<div class="empty" style="padding-top:80px">${icon('alert')}<div>Cannot reach the Kairo server: ${esc(err.message)}</div></div>`;
    }
    splash.done();
  }
}

window.addEventListener('hashchange', () => { if (state.user) navigate(); });
lockZoom(); // fixed scale — the workspace runs as a home-screen app
boot();
