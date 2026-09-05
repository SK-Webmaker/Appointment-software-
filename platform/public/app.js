// The signup, start to finish. Four steps and a status screen.
//
// The token from step one is kept in localStorage, so closing the tab in the
// middle — which people do, on a phone, at the counter — comes back to where
// they were rather than to an empty form.
const app = document.getElementById('app');
const KEY = 'kairo_signup_token';
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = (c) => `A$${(c / 100).toFixed(2).replace(/\.00$/, '')}`;
let price = { price_cents: 41000, base_domain: 'kairobookings.com' };
let token = localStorage.getItem(KEY) || new URLSearchParams(location.search).get('t') || '';

async function call(method, path, body) {
  const res = await fetch(path, {
    method,
    headers: body ? { 'content-type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data = null;
  try { data = JSON.parse(text); } catch { /* not json */ }
  if (!res.ok) throw new Error(data?.error || `Something went wrong (${res.status})`);
  if (!data) throw new Error('The reply was cut short — please try again.');
  return data;
}

const header = (step) => `
  <div class="brand"><span class="mark">K</span><b>Kairo</b></div>
  ${step ? `<div class="steps">${[1, 2, 3].map((i) => `<i class="${i <= step ? 'on' : ''}"></i>`).join('')}</div>` : ''}`;

const foot = `<div class="foot">
  <a href="/terms.html">Terms</a> · <a href="/refunds.html">Refunds</a> · <a href="/privacy.html">Privacy</a><br>
  Kairo — booking software for appointment businesses.
</div>`;

// ── step 1: the form ───────────────────────────────────────────────────────
function renderForm(prefill = {}, error = '') {
  app.innerHTML = `${header(1)}
    <h1>Your salon's booking system, for one payment.</h1>
    <p class="lede">Bookings, reminders, clients, payments and your own booking page — under your name, on your own address.</p>
    <div class="card">
      <div class="price"><b>${money(price.price_cents)}</b><span>once. No monthly fee, no commission, ever.</span></div>
      <ul class="ticks">
        <li>Your own booking page customers book on</li>
        <li>Automatic confirmations and reminders</li>
        <li>Client records, invoices and payments</li>
        <li>Hosting, updates and backups included</li>
      </ul>
    </div>
    <div class="card">
      <h2>Create your Kairo</h2>
      <p class="hint">Takes about three minutes.</p>
      <form id="f">
        <label for="business_name">Business name</label>
        <input id="business_name" name="business_name" type="text" required autocomplete="organization" placeholder="ABC Hair Studio" value="${esc(prefill.business_name)}">

        <label for="slug">Your booking address</label>
        <div class="addr">
          <input id="slug" name="slug" type="text" spellcheck="false" autocapitalize="none" autocomplete="off" placeholder="abchairstudio" value="${esc(prefill.slug)}">
          <span>.${esc(price.base_domain)}</span>
        </div>
        <div class="hint" id="slug-hint">We'll suggest one from your business name.</div>

        <div class="row">
          <div><label for="name">Your name</label>
            <input id="name" name="name" type="text" required autocomplete="name" value="${esc(prefill.name)}"></div>
          <div><label for="phone">Your mobile</label>
            <input id="phone" name="phone" type="tel" required autocomplete="tel" placeholder="04…" value="${esc(prefill.phone)}"></div>
        </div>

        <label for="email">Email</label>
        <input id="email" name="email" type="email" required autocomplete="email" value="${esc(prefill.email)}">

        <label for="abn">ABN <span style="font-weight:400">— optional, speeds up approval</span></label>
        <input id="abn" name="abn" type="text" inputmode="numeric" autocomplete="off" value="${esc(prefill.abn)}">

        <label for="password">Choose a password</label>
        <input id="password" name="password" type="password" required autocomplete="new-password" minlength="10">
        <div class="hint">At least 10 characters. This is how you'll sign in to Kairo.</div>

        <label class="check"><input type="checkbox" id="agree" required>
          <span>I agree to the <a href="/terms.html" target="_blank">Terms</a>, <a href="/refunds.html" target="_blank">Refund Policy</a> and <a href="/privacy.html" target="_blank">Privacy Policy</a>.</span></label>

        ${error ? `<div class="err">${esc(error)}</div>` : ''}
        <button class="primary" type="submit" id="go">Create my Kairo</button>
        <div class="hint" style="text-align:center;margin-top:10px">You'll verify your email and mobile before paying.</div>
      </form>
    </div>${foot}`;

  const bizEl = app.querySelector('#business_name');
  const slugEl = app.querySelector('#slug');
  const hint = app.querySelector('#slug-hint');
  let touched = Boolean(prefill.slug);
  let timer = null;

  const checkSlug = async () => {
    const wanted = slugEl.value.trim().toLowerCase();
    if (!wanted && !bizEl.value.trim()) { hint.className = 'hint'; hint.textContent = "We'll suggest one from your business name."; return; }
    try {
      const r = await call('GET', `/api/slug?slug=${encodeURIComponent(wanted)}&from=${encodeURIComponent(bizEl.value)}`);
      if (!touched && r.slug) slugEl.value = r.slug;
      hint.className = `hint ${r.ok ? 'ok' : 'bad'}`;
      hint.textContent = r.ok ? `${r.slug}.${price.base_domain} is available` : r.reason;
    } catch { hint.className = 'hint'; hint.textContent = ''; }
  };
  const debounced = () => { clearTimeout(timer); timer = setTimeout(checkSlug, 350); };
  bizEl.addEventListener('input', debounced);
  slugEl.addEventListener('input', () => { touched = true; debounced(); });
  if (prefill.business_name || prefill.slug) checkSlug();

  app.querySelector('#f').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = app.querySelector('#go');
    btn.disabled = true; btn.textContent = 'Creating…';
    const data = Object.fromEntries(['business_name', 'slug', 'name', 'phone', 'email', 'abn', 'password'].map((k) => [k, app.querySelector(`#${k}`).value.trim()]));
    data.tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Australia/Melbourne';
    try {
      const out = await call('POST', '/api/signup', data);
      token = out.token;
      localStorage.setItem(KEY, token);
      renderCodes();
    } catch (err) {
      const { password, ...keep } = data;
      renderForm(keep, err.message);
    }
  });
}

// ── step 2: the two codes ──────────────────────────────────────────────────
async function renderCodes(error = '') {
  const st = await call('GET', `/api/status?token=${encodeURIComponent(token)}`);
  if (st.email_verified && st.phone_verified) return renderPay();
  const kind = st.email_verified ? 'phone' : 'email';
  const where = kind === 'email' ? st.email : st.phone_hint;
  app.innerHTML = `${header(2)}
    <div class="card">
      <h2>Check your ${kind === 'email' ? 'email' : 'phone'}</h2>
      <p class="lede">We sent a 6-digit code to <b>${esc(where)}</b>.</p>
      <form id="c">
        <input id="code" class="code" type="text" inputmode="numeric" autocomplete="one-time-code" maxlength="6" required placeholder="000000">
        ${error ? `<div class="err">${esc(error)}</div>` : ''}
        <button class="primary" type="submit">Confirm</button>
      </form>
      <p class="hint" style="text-align:center;margin-top:14px">
        Didn't get it? <button class="link" id="again">Send another</button>
      </p>
      <p class="hint" style="text-align:center">
        ${st.email_verified ? '✓ Email confirmed' : ''} ${st.phone_verified ? '✓ Mobile confirmed' : ''}
      </p>
    </div>${foot}`;
  app.querySelector('#code').focus();
  app.querySelector('#c').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      const r = await call('POST', '/api/verify', { token, kind, code: app.querySelector('#code').value.trim() });
      if (r.ready_to_pay) renderPay(); else renderCodes();
    } catch (err) { renderCodes(err.message); }
  });
  app.querySelector('#again').addEventListener('click', async () => {
    try { await call('POST', '/api/resend', { token, kind }); renderCodes(''); } catch (err) { renderCodes(err.message); }
  });
}

// ── step 3: pay ────────────────────────────────────────────────────────────
async function renderPay(error = '') {
  const st = await call('GET', `/api/status?token=${encodeURIComponent(token)}`);
  if (st.state === 'ready') return renderStatus();
  const cancelled = new URLSearchParams(location.search).get('cancelled');
  app.innerHTML = `${header(3)}
    <div class="card">
      <h2>${esc(st.business_name)} is ready to go live</h2>
      <p class="lede">Your address will be <span class="mono">${esc(st.slug)}.${esc(price.base_domain)}</span></p>
      <div class="price"><b>${money(st.price_cents)}</b><span>once — that's everything</span></div>
      <ul class="ticks"><li>No monthly fee, no commission</li><li>14 days to change your mind, no reason needed</li><li>Your data is yours, exportable any time</li></ul>
      ${cancelled ? '<div class="err">Payment cancelled — nothing was charged.</div>' : ''}
      ${error ? `<div class="err">${esc(error)}</div>` : ''}
      <button class="primary" id="pay">Pay ${money(st.price_cents)} and set up my Kairo</button>
      <p class="hint" style="text-align:center;margin-top:10px">Secure payment by Stripe. Card, Apple&nbsp;Pay or Google&nbsp;Pay.</p>
    </div>${foot}`;
  app.querySelector('#pay').addEventListener('click', async (e) => {
    e.target.disabled = true; e.target.textContent = 'Opening secure payment…';
    try {
      const r = await call('POST', '/api/checkout', { token });
      location.href = r.checkout_url;
    } catch (err) { renderPay(err.message); }
  });
}

// ── step 4: watching it happen, then done ──────────────────────────────────
async function renderStatus() {
  const st = await call('GET', `/api/status?token=${encodeURIComponent(token)}`);
  if (st.state === 'ready') {
    localStorage.removeItem(KEY);
    app.innerHTML = `${header(0)}
      <div class="card">
        <div class="big">🎉</div>
        <h2 style="text-align:center">${esc(st.business_name)} is ready</h2>
        <p class="lede" style="text-align:center">Sign in with the email and password you chose.</p>
        <a class="primary" href="${esc(st.url)}" style="display:block;text-align:center;text-decoration:none;padding:14px;border-radius:12px;background:var(--accent);color:var(--accent-ink);font-weight:700">Open ${esc(st.slug)}.${esc(price.base_domain)}</a>
        <p class="hint" style="text-align:center;margin-top:16px">Your booking link for Instagram:<br><span class="mono">${esc(st.url)}/book</span></p>
      </div>
      <div class="card">
        <h2>Two minutes left</h2>
        <p class="hint">Kairo will walk you through connecting your email so confirmations and reminders send. We've also emailed you everything above.</p>
      </div>${foot}`;
    return;
  }
  if (['created', 'verified'].includes(st.state)) return st.email_verified && st.phone_verified ? renderPay() : renderCodes();
  if (st.state === 'payment_pending') return renderPay();
  if (['refunded', 'expired'].includes(st.state)) { localStorage.removeItem(KEY); return renderForm({}, st.message); }

  app.innerHTML = `${header(0)}
    <div class="card" style="text-align:center">
      <div class="big">${st.state === 'flagged' ? '🔎' : '<span class="spin"></span>'}</div>
      <h2>${st.state === 'flagged' ? 'Just checking a couple of details' : 'Setting up your Kairo'}</h2>
      <p class="lede">${esc(st.message)}</p>
      ${st.state === 'flagged' ? '<p class="hint">Nothing more for you to do. We\'ll email you.</p>' : ''}
    </div>${foot}`;
  if (st.state !== 'flagged') setTimeout(renderStatus, 2000);
}

// ── boot ───────────────────────────────────────────────────────────────────
(async () => {
  try { price = await call('GET', '/api/price'); } catch { /* the defaults are fine */ }
  if (!token) return renderForm();
  try { await renderStatus(); } catch { localStorage.removeItem(KEY); token = ''; renderForm(); }
})();
