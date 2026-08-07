// Account: the owner's own page, kept separate from Settings.
//
// Settings configures the business (hours, services, branding, providers).
// This answers a different question — who am I signed in as, what am I paying,
// and what am I getting for it. It is also where billing will live once there
// is a bill: the plan card reads from settings the reseller sets per
// deployment, so a business always sees the terms it was actually sold.
import { api } from '../api.js';
import { esc, icon, toast, fmtDate, initials, confirmDialog } from '../ui.js';
import { state } from '../app.js';

const PLAN_LABELS = {
  active: { label: 'Active', tone: 'ok' },
  trial: { label: 'Free trial', tone: 'info' },
  pilot: { label: 'Pilot', tone: 'info' },
  past_due: { label: 'Payment due', tone: 'warn' },
  cancelled: { label: 'Cancelled', tone: 'off' },
};

const INTERVALS = { month: 'per month', year: 'per year', once: 'one-off' };

/** Bytes as something a salon owner would actually say out loud. */
function fileSize(bytes) {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

const statRow = (label, value, sub = '') => `
  <div class="acct-stat">
    <div class="as-value">${esc(String(value))}</div>
    <div class="as-label">${esc(label)}</div>
    ${sub ? `<div class="as-sub">${esc(sub)}</div>` : ''}
  </div>`;

export async function renderAccount(container) {
  container.innerHTML = `<div class="empty" style="padding-top:60px">Loading your account…</div>`;
  let a;
  try {
    a = await api.get('/api/account');
  } catch (err) {
    container.innerHTML = `<div class="empty" style="padding-top:60px">${icon('alert', 24)}<div>${esc(err.message)}</div></div>`;
    return;
  }

  const plan = a.plan;
  const st = PLAN_LABELS[plan.status] || PLAN_LABELS.active;
  const priced = plan.price_cents > 0;
  const cur = plan.currency || '$';

  container.innerHTML = `
    <div class="page-head">
      <div class="ph-icon">${icon('user', 20)}</div>
      <div><h1>Account</h1><div class="ph-sub">Your profile, your plan and how much of Kairo you're using</div></div>
    </div>

    <div class="settings-grid">
      <div class="card">
        <div class="acct-id">
          <div class="acct-avatar">${esc(initials(a.user.name))}</div>
          <div style="min-width:0">
            <div class="acct-name">${esc(a.user.name)}</div>
            <div class="acct-meta"><span class="acct-role">${esc(a.user.role)}</span>${a.business.name ? ` · ${esc(a.business.name)}` : ''}</div>
            ${a.user.created_at ? `<div class="acct-meta">Account opened ${esc(fmtDate(String(a.user.created_at).slice(0, 10), { weekday: false }))}</div>` : ''}
          </div>
        </div>
        <form id="acct-profile" style="display:flex;flex-direction:column;gap:13px;margin-top:20px">
          <div class="field"><label>Your name</label><input name="name" value="${esc(a.user.name)}" required></div>
          <div class="field"><label>Sign-in email</label>
            <input name="email" type="email" value="${esc(a.user.email)}" required>
            <div class="hint">This is what you sign in with. Changing it means verifying the new address.</div></div>
          <button class="btn primary" style="align-self:flex-start">${icon('check')} Save profile</button>
        </form>
      </div>

      <div class="card">
        <div class="card-title">Your plan</div>
        <div class="card-sub" style="margin-bottom:16px">What you're on and what it costs</div>
        <div class="plan-box">
          <div class="plan-top">
            <div>
              <div class="plan-name">${esc(plan.name || 'Kairo')}</div>
              <div class="plan-price">${priced
                ? `<b>${esc(cur)}${(plan.price_cents / 100).toFixed(2)}</b> ${esc(INTERVALS[plan.interval] || '')}`
                : '<b>No charge</b> on this plan'}</div>
            </div>
            <span class="plan-chip t-${st.tone}">${esc(st.label)}</span>
          </div>
          <dl class="plan-rows">
            ${plan.started_at ? `<div><dt>Started</dt><dd>${esc(fmtDate(plan.started_at, { weekday: false }))}</dd></div>` : ''}
            <div><dt>${priced ? 'Next payment' : 'Next review'}</dt>
              <dd>${plan.renews_at ? esc(fmtDate(plan.renews_at, { weekday: false })) : 'Nothing scheduled'}</dd></div>
            <div><dt>Billed to</dt><dd>${esc(a.business.email || a.user.email)}</dd></div>
          </dl>
          ${plan.note ? `<div class="plan-note">${esc(plan.note)}</div>` : ''}
        </div>
        <div class="plan-help">
          ${plan.contact
            ? `Questions about your bill? Contact <b>${esc(plan.contact)}</b>.`
            : 'Invoices and payment history will appear here once billing is switched on.'}
        </div>
      </div>

      <div class="card">
        <div class="card-title">What you're using</div>
        <div class="card-sub" style="margin-bottom:16px">Across this workspace right now</div>
        <div class="acct-stats">
          ${statRow('Clients', a.usage.clients)}
          ${statRow('Team members', a.usage.team)}
          ${statRow('Services', a.usage.services)}
          ${statRow('Products', a.usage.products)}
          ${statRow('Appointments', a.usage.appointments_30d, 'last 30 days')}
          ${statRow('Booked online', a.usage.online_bookings_30d, 'last 30 days')}
          ${statRow('Messages sent', a.usage.messages_this_month, 'this month')}
          ${statRow('Collected', `${cur}${(a.usage.collected_cents_this_month / 100).toFixed(2)}`, 'this month')}
        </div>
      </div>

      <div class="card">
        <div class="card-title">Security</div>
        <div class="card-sub" style="margin-bottom:16px">Signed in as ${esc(a.user.email)}</div>

        ${a.user.default_password ? `
        <div class="acct-warn">${icon('alert', 15)}
          <div><b>You're still on the default password.</b> Anyone who knows it can open your business. Change it below.</div>
        </div>` : ''}

        <div class="field" style="margin-bottom:16px"><label>Email verification</label>
          <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
            ${a.user.email_verified
              ? `<span class="chip s-paid"><span class="dot"></span>Verified</span>
                 <span class="hint" style="margin:0">${esc(a.user.email)} is confirmed.</span>`
              : `<span class="chip s-sent"><span class="dot"></span>Not verified</span>
                 <button type="button" class="btn small" id="acct-verify">${icon('mail')} Send verification email</button>`}
          </div>
          ${a.user.email_verified ? '' : '<div class="hint">Confirms you own this address. Needs email set up in Settings → Notifications first.</div>'}
        </div>

        <form id="acct-password" style="display:flex;flex-direction:column;gap:13px">
          <div class="field"><label>Current password</label><input name="current" type="password" autocomplete="current-password" required></div>
          <div class="field"><label>New password (min 8 chars)</label><input name="next" type="password" autocomplete="new-password" required minlength="8"></div>
          <button class="btn primary" style="align-self:flex-start">${icon('check')} Change password</button>
        </form>
        <div class="hint" style="margin-top:10px">Changing your password signs out every other device.</div>
      </div>

      <div class="card">
        <div class="card-title">Your workspace</div>
        <div class="card-sub" style="margin-bottom:16px">This instance and what's switched on</div>
        <dl class="plan-rows">
          <div><dt>Booking page</dt><dd>${a.instance.online_booking
            ? `<a href="${esc(a.instance.booking_url)}" target="_blank" rel="noreferrer">Live ↗</a>`
            : 'Turned off'}</dd></div>
          <div><dt>Email sending</dt><dd>${a.instance.email_ready ? 'Set up' : 'Not set up'}</dd></div>
          <div><dt>Text messages</dt><dd>${a.instance.sms_ready ? 'On' : 'Off'}</dd></div>
          <div><dt>Your data</dt><dd>${esc(fileSize(a.instance.db_bytes))} in one file</dd></div>
          <div><dt>Version</dt><dd>Kairo v${esc(a.instance.version)}</dd></div>
        </dl>
        <div class="acct-actions">
          <a class="btn" href="/api/clients/export" download>${icon('download')} Export clients</a>
          <a class="btn" href="#/settings">${icon('settings')} Business settings</a>
        </div>
        <div class="hint" style="margin-top:12px">Your data is yours. Export it any time, and ask for a copy of the whole database whenever you want one.</div>
      </div>
    </div>`;

  // ---- profile -------------------------------------------------------------
  container.querySelector('#acct-profile').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const nextEmail = String(fd.get('email') || '').trim().toLowerCase();
    if (nextEmail !== a.user.email.toLowerCase()) {
      const ok = await confirmDialog(
        'Change your sign-in email?',
        `You'll sign in with <b>${esc(nextEmail)}</b> from now on, and it will need verifying before it counts as confirmed.`,
        { okText: 'Change email', cancelText: 'Keep the old one' },
      );
      if (!ok) return;
    }
    try {
      const out = await api.put('/api/account/profile', { name: fd.get('name'), email: fd.get('email') });
      state.user = { ...state.user, name: out.name, email: out.email, email_verified: out.email_verified };
      toast(out.email_changed ? 'Profile saved. Verify your new email when you can.' : 'Profile saved');
      renderAccount(container);
    } catch (err) { toast(err.message, 'err'); }
  });

  // ---- security ------------------------------------------------------------
  const verifyBtn = container.querySelector('#acct-verify');
  if (verifyBtn) verifyBtn.onclick = async () => {
    verifyBtn.disabled = true;
    try {
      await api.post('/api/auth/send-verification', {});
      toast('Verification email sent. Check your inbox.');
    } catch (err) { toast(err.message, 'err'); }
    verifyBtn.disabled = false;
  };

  container.querySelector('#acct-password').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    try {
      await api.put('/api/auth/password', { current: fd.get('current'), next: fd.get('next') });
      toast('Password changed');
      e.target.reset();
      renderAccount(container);
    } catch (err) { toast(err.message, 'err'); }
  });
}
