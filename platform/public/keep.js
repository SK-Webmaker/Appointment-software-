// Keeping a free trial: choose a plan, pay, and the very same Kairo stays,
// with the five held-back features switched on.
//
// Reached by the "Choose a plan" button inside a trial salon (on the web, never
// in the iPhone app) and from the trial's emails, by a handle only that owner
// was given. Nothing is rebuilt: Stripe's signed webhook tells the platform the
// money moved, and the platform lifts the locks on the salon that already exists.
const app = document.getElementById('app');
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = (c) => `A$${((c || 0) / 100).toFixed(2).replace(/\.00$/, '')}`;
const q = new URLSearchParams(location.search);
const t = q.get('t') || '';
let plan = 'once';

async function call(method, path, body) {
  const res = await fetch(path, { method, headers: body ? { 'content-type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined });
  const text = await res.text();
  let data = null; try { data = JSON.parse(text); } catch { /* not json */ }
  if (!res.ok) throw new Error(data?.error || `Something went wrong (${res.status})`);
  return data;
}

const longDate = (iso) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long' });
};
const brand = '<div class="brand"><b>Kairo</b></div>';
const foot = `<div class="foot"><a href="/terms">Terms</a> · <a href="/refunds">Refunds</a> · <a href="/privacy">Privacy</a> · <a href="/support">Support</a></div>`;

function planPicker(plans) {
  const once = plans.find((p) => p.id === 'once');
  const monthly = plans.find((p) => p.id === 'monthly');
  return `<div class="plans" role="radiogroup" aria-label="How would you like to pay?">
    <label class="plan"><input type="radio" name="plan" value="once" ${plan === 'once' ? 'checked' : ''}>
      <div class="p-top"><span class="p-name">Pay once<span class="p-tag">Lowest total</span></span>
        <span class="p-price">${money(once.cents)}</span></div>
      <div class="p-note">One payment, then $0 a month, ever.</div>
    </label>
    <label class="plan"><input type="radio" name="plan" value="monthly" ${plan === 'monthly' ? 'checked' : ''}>
      <div class="p-top"><span class="p-name">Pay monthly</span>
        <span class="p-price">${money(monthly.cents)}<small> /month × ${monthly.payments}</small></span></div>
      <div class="p-note">${money(monthly.cents)} today, then the same for ${monthly.payments - 1} more months (${money(monthly.total_cents)} in all), then $0 a month.</div>
    </label>
  </div>`;
}

function kept(s) {
  app.innerHTML = `${brand}
    <div class="card">
      <div class="big"><span class="done-tick"><svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg></span></div>
      <h2 style="text-align:center">Thank you. ${esc(s.business_name)} is yours</h2>
      <p class="lede" style="text-align:center">Everything you set up in your trial is just as you left it, and Kai, text reminders, deposits and card payments, automatic messages and your own email address are now unlocked.</p>
      <a class="primary" href="${esc(s.url)}" style="display:block;text-align:center;text-decoration:none;padding:14px;border-radius:12px;background:var(--accent);color:var(--accent-ink);font-weight:700">Open ${esc(s.business_name)}</a>
      <p class="hint" style="text-align:center;margin-top:14px">Your receipt is on its way by email.</p>
    </div>${foot}`;
}

async function render(error = '') {
  if (!t) { app.innerHTML = `${brand}<div class="card"><h2>This link is missing a part</h2><p class="hint">Open it again from inside your Kairo, or from the email we sent you.</p></div>${foot}`; return; }
  let s;
  try { s = await call('GET', `/api/keep/status?t=${encodeURIComponent(t)}`); } catch (err) {
    app.innerHTML = `${brand}<div class="card"><h2>We couldn't find that trial</h2><p class="hint">${esc(err.message)}</p></div>${foot}`;
    return;
  }
  if (s.kept) { kept(s); return; }
  // Back from Stripe: the webhook is usually a second or two behind the browser.
  if (q.get('paid') === '1') {
    app.innerHTML = `${brand}<div class="card" style="text-align:center"><div class="big"><span class="spin"></span></div>
      <h2>Payment received. Unlocking ${esc(s.business_name)}</h2><p class="lede">This takes a few seconds.</p></div>${foot}`;
    setTimeout(() => render(), 2000);
    return;
  }
  if (!s.trial) {
    app.innerHTML = `${brand}<div class="card"><h2>This free trial has ended</h2><p class="hint">The account was deleted when the trial ended. You can get Kairo again any time at <a href="https://kairobookings.com">kairobookings.com</a>.</p></div>${foot}`;
    return;
  }
  const ended = s.state === 'trial_ended';
  app.innerHTML = `${brand}
    <h1>Keep ${esc(s.business_name)}</h1>
    <p class="lede">${ended
      ? `Your free trial has ended and ${esc(s.business_name)} is paused. It is kept until ${esc(longDate(s.deletes_at))}. Choose a plan and it all comes back at once.`
      : `${s.days_left <= 1 ? 'Your free trial ends tomorrow' : `${s.days_left} days left in your free trial`}. Choose a plan and nothing changes: your clients, services and bookings stay exactly as they are.`}</p>
    <div class="card">
      <h2 style="margin-bottom:10px">How would you like to pay?</h2>
      ${planPicker(s.plans)}
      <ul class="ticks">
        <li>Kai, your assistant</li>
        <li>Text reminders and confirmations</li>
        <li>Deposits and card payments</li>
        <li>Automatic and bulk messages</li>
        <li>Your own email address</li>
      </ul>
      <div class="hint">No commission, nothing more to pay after your plan, and a full refund within 14 days if it isn't right for you.</div>
      ${error ? `<div class="err">${esc(error)}</div>` : ''}
      <button class="primary" id="pay">Continue to payment</button>
      <p class="hint" style="text-align:center;margin-top:10px">Secure payment by Stripe. Card, Apple&nbsp;Pay or Google&nbsp;Pay.</p>
    </div>${foot}`;
  app.querySelectorAll('input[name="plan"]').forEach((r) => r.addEventListener('change', () => { plan = r.value === 'monthly' ? 'monthly' : 'once'; }));
  app.querySelector('#pay').addEventListener('click', async (e) => {
    e.target.disabled = true; e.target.textContent = 'Opening secure payment…';
    try {
      const r = await call('POST', '/api/keep/checkout', { t, plan });
      location.href = r.checkout_url;
    } catch (err) { render(err.message); }
  });
}

render();
