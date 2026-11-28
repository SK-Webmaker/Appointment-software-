// The signup, start to finish. Four steps and a status screen.
//
// The token from step one is kept in localStorage, so closing the tab in the
// middle — which people do, on a phone, at the counter — comes back to where
// they were rather than to an empty form.
const app = document.getElementById('app');
const KEY = 'kairo_signup_token';
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = (c) => `A$${(c / 100).toFixed(2).replace(/\.00$/, '')}`;
let price = {
  price_cents: 40000,
  base_domain: 'kairobookings.com',
  plans: [
    { id: 'once', cents: 40000, payments: 1, total_cents: 40000 },
    { id: 'monthly', cents: 15000, payments: 3, total_cents: 45000 },
  ],
};
// Which way they chose to pay. Kept through a reload like the page they came
// from, and changeable again on the payment step.
const PLAN_KEY = 'kairo_signup_plan';
// A pricing card on the website can arrive with ?plan= already chosen.
// ?plan=trial (or ?trial=1) arrives from the website's "Start your free trial".
const PLAN_IDS = ['trial', 'once', 'monthly', 'founder'];
// The founding price exists only behind its private link (?offer=…), and the
// server decides; this only stops the page offering what it can't have.
const planId = (id) => (PLAN_IDS.includes(id) && (id !== 'founder' || price.offer) ? id : (price.offer ? 'founder' : 'once'));
let chosenPlan = (() => {
  const q = new URLSearchParams(location.search);
  const given = q.get('trial') === '1' ? 'trial' : q.get('plan');
  try {
    if (PLAN_IDS.includes(given)) sessionStorage.setItem(PLAN_KEY, given);
    return planId(sessionStorage.getItem(PLAN_KEY));
  } catch { return planId(given); }
})();
const choosePlan = (id) => { chosenPlan = planId(id); try { sessionStorage.setItem(PLAN_KEY, chosenPlan); } catch { /* fine */ } };
const planById = (id) => price.plans.find((p) => p.id === id) || price.plans[0];
// The private link's code, kept through a reload like the page they came from.
const OFFER_KEY = 'kairo_signup_offer';
let offerCode = (() => {
  const given = new URLSearchParams(location.search).get('offer') || '';
  const ok = (v) => /^[A-Za-z0-9_-]{12,80}$/.test(v);
  try {
    if (ok(given)) sessionStorage.setItem(OFFER_KEY, given);
    const kept = sessionStorage.getItem(OFFER_KEY) || '';
    return ok(kept) ? kept : '';
  } catch { return ok(given) ? given : ''; }
})();
/** The founding offer, once the server has said the link is good. */
function useOffer(o) {
  price.offer = o;
  if (!price.plans.some((p) => p.id === 'founder')) price.plans = [...price.plans, o.plan];
}

// With the private link: two ways in, both at the founding price.
function offerPicker(selected) {
  const o = price.offer;
  const days = price.trial_days || 14;
  return `<div class="offer-note"><b>Founding offer</b> · ${o.places_left} of ${o.places} places left<br>
      Kairo for ${money(o.plan.cents)} once instead of ${money(o.usual_cents)}. In return, we'll ask you for an honest review after your first month.</div>
    <div class="plans" role="radiogroup" aria-label="How would you like to start?">
    <label class="plan"><input type="radio" name="plan" value="founder" ${selected !== 'trial' ? 'checked' : ''}>
      <div class="p-top"><span class="p-name">Founding price<span class="p-tag">Half price</span></span>
        <span class="p-price">${money(o.plan.cents)}<small> once</small></span></div>
      <div class="p-note">One payment instead of ${money(o.usual_cents)}, then $0 a month, ever.</div>
    </label>
    <label class="plan"><input type="radio" name="plan" value="trial" ${selected === 'trial' ? 'checked' : ''}>
      <div class="p-top"><span class="p-name">Try it free first<span class="p-tag">No card</span></span>
        <span class="p-price">$0<small> today</small></span></div>
      <div class="p-note">${days} days free with your real clients, then keep it for ${money(o.plan.cents)} while founding places last.</div>
    </label>
  </div>`;
}

// The two plans as a choice. Same Kairo either way; the only difference is
// whether it is paid in one go or spread over three months for $50 more.
function planPicker(selected) {
  if (price.offer) return offerPicker(selected);
  const once = planById('once');
  const monthly = planById('monthly');
  const extra = monthly.total_cents - once.total_cents;
  const days = price.trial_days || 14;
  return `<div class="plans" role="radiogroup" aria-label="How would you like to start?">
    <label class="plan"><input type="radio" name="plan" value="trial" ${selected === 'trial' ? 'checked' : ''}>
      <div class="p-top"><span class="p-name">Free ${days}-day trial<span class="p-tag">No card</span></span>
        <span class="p-price">$0<small> today</small></span></div>
      <div class="p-note">Try Kairo with your real clients for ${days} days. Pay only if you keep it, and everything you set up stays.</div>
    </label>
    <label class="plan"><input type="radio" name="plan" value="once" ${selected === 'once' ? 'checked' : ''}>
      <div class="p-top"><span class="p-name">Pay once<span class="p-tag">Lowest total</span></span>
        <span class="p-price">${money(once.cents)}</span></div>
      <div class="p-note">One payment, then $0 a month, ever.</div>
    </label>
    <label class="plan"><input type="radio" name="plan" value="monthly" ${selected === 'monthly' ? 'checked' : ''}>
      <div class="p-top"><span class="p-name">Pay monthly</span>
        <span class="p-price">${money(monthly.cents)}<small> /month × ${monthly.payments}</small></span></div>
      <div class="p-note">${money(monthly.cents)} today, then the same for ${monthly.payments - 1} more months — ${money(monthly.total_cents)} in all${extra > 0 ? ` (${money(extra)} more)` : ''}, then $0 a month.</div>
    </label>
  </div>`;
}
const payLabel = (id) => {
  if (id === 'trial') return 'Start my free trial';
  const p = planById(id);
  return p.payments > 1 ? `Pay ${money(p.cents)} today and set up my Kairo` : `Pay ${money(p.cents)} and set up my Kairo`;
};
const ticksFor = (id) => (id === 'trial'
  ? '<li>Free for 14 days. No card, nothing to cancel</li><li>Pay only if you keep it, and everything you set up stays</li><li>Your data is yours, exportable any time</li>'
  : '<li>No commission, and nothing to pay after your plan</li><li>14 days to change your mind, no reason needed</li><li>Your data is yours, exportable any time</li>');
const payHint = (id) => (id === 'trial'
  ? 'No payment details needed. We\'ll remind you before your trial ends.'
  : 'Secure payment by Stripe. Card, Apple&nbsp;Pay or Google&nbsp;Pay.');
let offerError = '';
let token = localStorage.getItem(KEY) || new URLSearchParams(location.search).get('t') || '';
// The website page that sent them here (?from=fresha-price), kept through a
// reload so the signup still says where it came from. A page name, nothing more.
const FROM_KEY = 'kairo_signup_from';
const from = (() => {
  const given = new URLSearchParams(location.search).get('from') || '';
  try {
    if (/^[a-z0-9][a-z0-9-]{0,59}$/.test(given)) sessionStorage.setItem(FROM_KEY, given);
    return sessionStorage.getItem(FROM_KEY) || '';
  } catch { return /^[a-z0-9][a-z0-9-]{0,59}$/.test(given) ? given : ''; }
})();

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

// Four named steps, not three anonymous dots. Someone paying for Kairo on a
// phone at the counter should be able to see how much is left before they
// start, and what the thing they are in the middle of is called.
const STEP_NAMES = ['Your details', 'Confirm it\'s you', 'Payment', 'Setting up'];
const stepName = (i) => (i === 3 && chosenPlan === 'trial' ? 'Start your trial' : STEP_NAMES[i - 1]);
const header = (step) => `
  <div class="brand"><a href="/" style="display:flex;align-items:center;gap:10px;color:inherit">
    <svg class="mark" viewBox="0 0 48 48" width="32" height="32" aria-hidden="true">
      <defs><linearGradient id="bm" x1="2" y1="2" x2="46" y2="46" gradientUnits="userSpaceOnUse">
        <stop stop-color="#38bdf8"/><stop offset="1" stop-color="#3b82f6"/>
      </linearGradient></defs>
      <rect width="48" height="48" fill="url(#bm)"/>
      <path d="M15.6 13V35" stroke="#fff" stroke-width="4.6" stroke-linecap="round"/>
      <path d="M18.5 25.4A13 13 0 0 1 28.6 15.9" stroke="#fff" stroke-width="4.6" stroke-linecap="round" fill="none"/>
      <path d="M18.5 25.4L31.6 35" stroke="#fff" stroke-width="4.6" stroke-linecap="round"/>
      <circle cx="33" cy="13.2" r="3.2" fill="#bae6fd"/>
    </svg><b>Kairo</b></a></div>
  ${step ? `
    <div class="steps" role="progressbar" aria-valuemin="1" aria-valuemax="4" aria-valuenow="${step}"
         aria-label="Step ${step} of 4: ${stepName(step)}">
      ${[1, 2, 3, 4].map((i) => `<i class="${i <= step ? 'on' : ''}"></i>`).join('')}
    </div>
    <div class="hint" style="margin:-16px 0 22px;display:flex;justify-content:space-between">
      <span>Step ${step} of 4</span><span>${esc(stepName(step))}</span>
    </div>` : ''}`;

const foot = `<div class="foot">
  <a href="/terms">Terms</a> · <a href="/refunds">Refunds</a> · <a href="/privacy">Privacy</a> · <a href="/support">Support</a><br>
  Kairo — booking software for appointment businesses.
</div>`;

// ── step 1: the form ───────────────────────────────────────────────────────
function renderForm(prefill = {}, error = '') {
  app.innerHTML = `${header(1)}
    ${offerError ? `<div class="err">${esc(offerError)}</div>` : ''}
    <h1>${price.offer ? 'Kairo at the founding price.' : 'Your booking system. No ongoing fees.'}</h1>
    <p class="lede">Bookings, reminders, clients, payments and your own booking page — under your name, on your own address.</p>
    <div class="card">
      <h2 style="margin-bottom:10px">How would you like to start?</h2>
      ${planPicker(chosenPlan)}
      <div class="hint">Same Kairo every way. No commission, and a full refund within 14 days of paying.</div>
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
          <span>I agree to the <a href="/terms" target="_blank">Terms</a>, <a href="/refunds" target="_blank">Refund Policy</a> and <a href="/privacy" target="_blank">Privacy Policy</a>.</span></label>

        ${error ? `<div class="err">${esc(error)}</div>` : ''}
        <button class="primary" type="submit" id="go">Create my Kairo</button>
        <div class="hint" style="text-align:center;margin-top:10px" id="go-hint">${chosenPlan === 'trial' ? "You'll confirm your email with a code, then your trial starts. No card." : "You'll confirm your email with a code before paying."}</div>
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
  app.querySelectorAll('input[name="plan"]').forEach((r) => r.addEventListener('change', () => {
    choosePlan(r.value);
    const h = app.querySelector('#go-hint');
    if (h) h.textContent = chosenPlan === 'trial' ? "You'll confirm your email with a code, then your trial starts. No card." : "You'll confirm your email with a code before paying.";
  }));

  app.querySelector('#f').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = app.querySelector('#go');
    btn.disabled = true; btn.textContent = 'Creating…';
    const data = Object.fromEntries(['business_name', 'slug', 'name', 'phone', 'email', 'abn', 'password'].map((k) => [k, app.querySelector(`#${k}`).value.trim()]));
    data.tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Australia/Melbourne';
    data.source = from;
    data.plan = chosenPlan;
    if (offerCode) data.offer = offerCode;
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

// ── step 2: the email code ─────────────────────────────────────────────────
async function renderCodes(error = '') {
  const st = await call('GET', `/api/status?token=${encodeURIComponent(token)}`);
  if (st.email_verified) return renderPay();
  const kind = 'email';
  app.innerHTML = `${header(2)}
    <div class="card">
      <h2>Check your email</h2>
      <p class="lede">We sent a 6-digit code to <b>${esc(st.email)}</b>. It can take a minute, and it
        sometimes lands in junk or promotions.</p>
      <form id="c">
        <input id="code" class="code" type="text" inputmode="numeric" autocomplete="one-time-code" maxlength="6" required placeholder="000000">
        ${error ? `<div class="err">${esc(error)}</div>` : ''}
        <button class="primary" type="submit">Confirm</button>
      </form>
      <p class="hint" style="text-align:center;margin-top:14px">
        Didn't get it? <button class="link" id="again">Send another</button>
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
  if (['ready', 'trial'].includes(st.state)) return renderStatus();
  const cancelled = new URLSearchParams(location.search).get('cancelled');
  if (st.offer) useOffer(st.offer);
  let selected = planId(st.plan);
  chosenPlan = selected;
  app.innerHTML = `${header(3)}
    <div class="card">
      <h2>${esc(st.business_name)} is ready to go live</h2>
      <p class="lede">Your address will be <span class="mono">${esc(st.slug)}.${esc(price.base_domain)}</span></p>
      ${planPicker(selected)}
      <ul class="ticks" id="pay-ticks">${ticksFor(selected)}</ul>
      ${cancelled ? '<div class="err">Payment cancelled — nothing was charged.</div>' : ''}
      ${error ? `<div class="err">${esc(error)}</div>` : ''}
      <button class="primary" id="pay">${esc(payLabel(selected))}</button>
      <p class="hint" style="text-align:center;margin-top:10px" id="pay-hint">${payHint(selected)}</p>
    </div>${foot}`;
  const payBtn = app.querySelector('#pay');
  app.querySelectorAll('input[name="plan"]').forEach((r) => r.addEventListener('change', () => {
    choosePlan(r.value); selected = chosenPlan; payBtn.textContent = payLabel(selected);
    app.querySelector('#pay-ticks').innerHTML = ticksFor(selected);
    app.querySelector('#pay-hint').innerHTML = payHint(selected);
  }));
  payBtn.addEventListener('click', async (e) => {
    e.target.disabled = true;
    try {
      if (selected === 'trial') {
        e.target.textContent = 'Setting up your Kairo…';
        await call('POST', '/api/trial/start', { token });
        renderStatus();
        return;
      }
      e.target.textContent = 'Opening secure payment…';
      const r = await call('POST', '/api/checkout', { token, plan: selected });
      location.href = r.checkout_url;
    } catch (err) { renderPay(err.message); }
  });
}

// ── step 4: watching it happen, then done ──────────────────────────────────
async function renderStatus() {
  const st = await call('GET', `/api/status?token=${encodeURIComponent(token)}`);
  if (st.state === 'trial') {
    localStorage.removeItem(KEY);
    const ends = st.trial_ends_at ? new Date(st.trial_ends_at).toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long' }) : '';
    app.innerHTML = `${header(0)}
      <div class="card">
        <div class="big"><span class="done-tick"><svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg></span></div>
        <h2 style="text-align:center">Your free trial has started</h2>
        <p class="lede" style="text-align:center">${esc(st.business_name)} is yours to try${ends ? ` until ${esc(ends)}` : ''}. Sign in with the email and password you chose.</p>
        <a class="primary" href="${esc(st.url)}" style="display:block;text-align:center;text-decoration:none;padding:14px;border-radius:12px;background:var(--accent);color:var(--accent-ink);font-weight:700">Open ${esc(st.slug)}.${esc(price.base_domain)}</a>
        <p class="hint" style="text-align:center;margin-top:16px">Your booking link for Instagram:<br><span class="mono">${esc(st.url)}/book</span></p>
      </div>
      <div class="card">
        <h2>On your iPhone</h2>
        <p class="hint">Get the Kairo app and sign in with the same email and password. Kairo walks you through your hours, services and team the first time.</p>
        <a href="${esc(st.app_url)}" style="display:inline-block;margin-top:8px;font-weight:700">Get the Kairo app</a>
      </div>
      <div class="card">
        <h2>What's in your trial</h2>
        <p class="hint">Everything except Kai, text reminders, deposits and card payments, automatic and bulk messages, and your own email address. Those come with a plan. Keep Kairo and everything you set up stays exactly as it is. We've emailed you all of this.</p>
      </div>${foot}`;
    return;
  }
  if (st.state === 'ready') {
    localStorage.removeItem(KEY);
    app.innerHTML = `${header(0)}
      <div class="card">
        <div class="big"><span class="done-tick"><svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg></span></div>
        <h2 style="text-align:center">${esc(st.business_name)} is ready</h2>
        <p class="lede" style="text-align:center">Sign in with the email and password you chose.</p>
        <a class="primary" href="${esc(st.url)}" style="display:block;text-align:center;text-decoration:none;padding:14px;border-radius:12px;background:var(--accent);color:var(--accent-ink);font-weight:700">Open ${esc(st.slug)}.${esc(price.base_domain)}</a>
        <p class="hint" style="text-align:center;margin-top:16px">Your booking link for Instagram:<br><span class="mono">${esc(st.url)}/book</span></p>
      </div>
      <div class="card">
        <h2>A few minutes left</h2>
        <p class="hint">Sign in and Kairo walks you through your hours, services and team. Email confirmations
          already work; texts are optional, from your own ClickSend account. We've also emailed you everything above.</p>
      </div>${foot}`;
    return;
  }
  if (['created', 'verified'].includes(st.state)) return st.email_verified ? renderPay() : renderCodes();
  if (st.state === 'payment_pending') return renderPay();
  if (['refunded', 'expired', 'trial_ended', 'trial_deleted'].includes(st.state)) { localStorage.removeItem(KEY); return renderForm({}, st.message); }

  app.innerHTML = `${header(4)}
    <div class="card" style="text-align:center">
      <div class="big">${st.state === 'flagged' ? '<span class="done-tick wait"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg></span>' : '<span class="spin"></span>'}</div>
      <h2>${st.state === 'flagged' ? 'Just checking a couple of details' : 'Setting up your Kairo'}</h2>
      <p class="lede">${esc(st.message)}</p>
      ${st.state === 'flagged' ? '<p class="hint">Nothing more for you to do. We\'ll email you.</p>' : ''}
    </div>${foot}`;
  if (st.state !== 'flagged') setTimeout(renderStatus, 2000);
}

// ── boot ───────────────────────────────────────────────────────────────────
(async () => {
  try {
    const got = await call('GET', '/api/price');
    price = { ...price, ...got, plans: Array.isArray(got.plans) && got.plans.length ? got.plans : price.plans };
  } catch { /* the defaults are fine */ }
  if (offerCode) {
    try {
      const o = await call('GET', `/api/offer?code=${encodeURIComponent(offerCode)}`);
      if (o.ok && o.places_left > 0) { useOffer(o); if (chosenPlan !== 'trial') choosePlan('founder'); }
      else {
        offerError = o.ok ? `All ${o.places} founding places have been taken. The normal prices are below.` : 'That offer link is not valid. The normal prices are below.';
        offerCode = '';
        try { sessionStorage.removeItem(OFFER_KEY); } catch { /* fine */ }
      }
    } catch { /* the normal prices still work */ }
  }
  if (!token) return renderForm();
  try { await renderStatus(); } catch { localStorage.removeItem(KEY); token = ''; renderForm(); }
})();
