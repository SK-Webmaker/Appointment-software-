// Account: the owner's own page, kept separate from Settings.
//
// Settings configures the business (hours, services, branding, providers).
// This answers a different question — who am I signed in as, what am I paying,
// and what am I getting for it. It is also where billing will live once there
// is a bill: the plan card reads from settings the reseller sets per
// deployment, so a business always sees the terms it was actually sold.
import { api } from '../api.js';
import { esc, icon, toast, fmtDate, initials, confirmDialog, openModal } from '../ui.js';
import { state } from '../app.js';

const PLAN_LABELS = {
  active: { label: 'Active', tone: 'ok' },
  trial: { label: 'Free trial', tone: 'info' },
  pilot: { label: 'Pilot', tone: 'info' },
  past_due: { label: 'Payment due', tone: 'warn' },
  cancelled: { label: 'Cancelled', tone: 'off' },
};

const INTERVALS = { month: 'per month', year: 'per year', once: 'one-off' };

// Kept in step with MIN_LENGTH in src/password.js — the server is the enforcer,
// this is only so the owner finds out before pressing the button.
const PW_MIN = 10;
const PW_COMMON = ['password', 'letmein', 'welcome', 'qwerty', 'admin', 'kairo', 'salon',
  'hair', 'changeme', 'iloveyou', 'monkey', 'dragon', 'sunshine', 'football', 'secret'];

/** Live, honest feedback on a candidate password. Mirrors the server's rules. */
function judgePassword(pw, context) {
  const skeleton = (s) => String(s).toLowerCase().replace(/[^a-z]/g, '');
  const skel = skeleton(pw);
  if (!pw) return null;
  if (pw.length < PW_MIN) return { level: 0, say: `${PW_MIN - pw.length} more character${PW_MIN - pw.length === 1 ? '' : 's'} needed` };
  if (PW_COMMON.includes(skel)) return { level: 0, say: 'Far too common — anyone would try this' };
  if (/^(.)\1+$/.test(pw)) return { level: 0, say: 'That is one character repeated' };
  if (/^(?:0123456789|1234567890|abcdefghij|qwertyuiop)/.test(pw.toLowerCase())) {
    return { level: 0, say: 'That is a keyboard run' };
  }
  // Mirrors tooPersonal() in src/password.js: a single word from their world,
  // and the whole name run together, which is what people actually type.
  const near = (c) => c.length >= 4 && (skel === c || (skel.startsWith(c) && skel.length - c.length <= 2));
  for (const raw of context) {
    const words = String(raw || '').split(/[^A-Za-z]+/).map((w) => w.toLowerCase());
    if (near(skeleton(raw)) || near(skeleton(String(raw || '').split('@')[0])) || words.some(near)) {
      return { level: 0, say: 'Too close to your own name or business' };
    }
  }
  const variety = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((r) => r.test(pw)).length;
  if (pw.length >= 16 || (pw.length >= 12 && variety >= 3)) return { level: 3, say: 'Strong' };
  if (pw.length >= 12 || variety >= 3) return { level: 2, say: 'Good' };
  return { level: 1, say: 'Passable — longer would be better' };
}

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

/**
 * The 14-day, no-reason guarantee.
 *
 * Shown as a countdown while it is live, because "14 days" means nothing on day
 * nine — "5 days left" does. Drawn only when the platform actually answered:
 * inventing a countdown locally would be a promise about somebody's money made
 * by a screen that does not know what they paid.
 */
function guaranteeCard(g) {
  if (!g || !g.available) return '';
  if (g.refunded) {
    return `
      <div class="card">
        <div class="card-title">Refunded</div>
        <div class="card-sub">This Kairo has been refunded and switched off. Your data was emailed to
          you at the address on the account.</div>
      </div>`;
  }
  const left = Number(g.days_left || 0);
  const live = left > 0;
  const amount = g.price_cents ? `$${(g.price_cents / 100).toFixed(2).replace(/\.00$/, '')}` : 'what you paid';
  return `
    <div class="card gtee-card">
      <div class="card-title">Your ${g.window_days}-day guarantee</div>
      <div class="card-sub">${live
    ? `No reason needed, no questions asked. We refund ${esc(amount)} and your whole business is emailed to you first.`
    : `The no-reason window has passed, but asking is still worth it — Australian consumer law may
       still apply, and a person reads every request.`}</div>
      <div class="gtee-row">
        <div class="gtee-days ${live ? 'live' : 'past'}">
          ${live
    ? `<b>${left}</b><span>day${left === 1 ? '' : 's'} left</span>`
    // Not "0 days left" — a zero next to a countdown reads as "today is your
    // last chance", which is the opposite of what has happened.
    : `<b>Closed</b><span>${g.window_days}-day window</span>`}
        </div>
        <div class="gtee-say">
          ${live
    ? 'Press once and it happens — the money goes back the way it came, usually within a few business days.'
    : 'This sends a request to a person rather than refunding automatically. You will hear back by email.'}
        </div>
      </div>
      ${live ? '' : `
      <div class="field" style="margin-top:14px">
        <label>Anything you want to say (optional)</label>
        <textarea id="acct-refund-reason" rows="3" maxlength="300"
          placeholder="What went wrong, or what you needed and didn't get."></textarea>
      </div>`}
      <button type="button" class="btn ${live ? 'danger' : ''}" id="acct-refund">
        ${icon('back', 14)} ${live ? 'Refund and close my Kairo' : 'Ask for a refund'}
      </button>
      ${g.paid_at ? `<div class="acct-meta" style="margin-top:10px">Bought ${esc(fmtDate(String(g.paid_at).slice(0, 10), { weekday: false }))}${g.price_cents ? ` · ${esc(amount)} once, nothing after` : ''}</div>` : ''}
    </div>`;
}

export async function renderAccount(container) {
  container.innerHTML = `<div class="empty" style="padding-top:60px">Loading your account…</div>`;
  let a;
  let guarantee = null;
  try {
    // Two requests in parallel. The guarantee lives on the platform that took
    // the card, so it is allowed to be unavailable — the page still draws.
    [a, guarantee] = await Promise.all([
      api.get('/api/account'),
      api.get('/api/account/guarantee').catch(() => null),
    ]);
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
        <div class="acct-session">
          <button type="button" class="btn" id="acct-signout">${icon('logout', 14)} Sign out</button>
          <button type="button" class="btn" id="acct-signout-all">${icon('shield', 14)} Sign out everywhere</button>
        </div>
        <div class="hint" style="margin-top:8px">"Everywhere" ends every session on every device,
          this one included — for a phone that went missing, or someone who has left.</div>

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

      ${guaranteeCard(guarantee)}

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
        </div>` : a.user.handover_password ? `
        <div class="acct-warn">${icon('alert', 15)}
          <div><b>You're still using the password you were sent.</b> It was emailed to you when your system was set
            up, so it's sitting in at least two inboxes. Pick your own below and it becomes yours alone —
            everything else keeps working exactly as it is.</div>
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
          <div class="field"><label>New password</label>
            <input name="next" type="password" autocomplete="new-password" required minlength="${PW_MIN}" id="pw-next">
            <div class="pw-meter" id="pw-meter" hidden><span class="pw-bar"><i></i></span><span class="pw-say"></span></div>
            <div class="hint">At least ${PW_MIN} characters. A few ordinary words you'll remember beats one clever word with symbols.</div>
          </div>
          <button class="btn primary" style="align-self:flex-start">${icon('check')} Change password</button>
        </form>
        <div class="hint" style="margin-top:10px">Changing your password signs out every other device. We also check it against
          known data breaches — only a fragment of its fingerprint is sent, never the password itself.</div>
      </div>

      <div class="card">
        <div class="card-title">Your workspace</div>
        <div class="card-sub" style="margin-bottom:16px">This instance and what's switched on</div>
        <dl class="plan-rows">
          <div><dt>Booking page</dt><dd>${a.instance.online_booking
            ? `<a href="${esc(a.instance.booking_url)}" target="_blank" rel="noopener noreferrer">Live ↗</a>`
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

      <div class="card acct-close">
        <div class="card-title">Closing your account</div>
        <div class="card-sub">This is your whole book — every client, every appointment, every invoice.
          Closing signs everybody out and takes your booking page down straight away. The files are
          deleted seven days later, so if you press this at 11pm by mistake, it can still be undone at 9am.</div>
        <div class="hint" style="margin:14px 0 0">Export your clients first if you want a copy. A refund, if
          you are still inside the guarantee, is the button further up — this one closes the account
          without refunding anything.</div>
        <button type="button" class="btn danger" id="acct-close" style="margin-top:16px">
          ${icon('trash', 14)} Close my account
        </button>
      </div>
    </div>`;

  // Closing the account. The route has existed since the App Store work and
  // nothing called it, which means the app shipped a thing Apple requires and
  // no owner could reach. Two proofs are asked for — the password and the
  // business name typed out — because a mis-tap must not be able to do this.
  container.querySelector('#acct-close').onclick = () => {
    const name = state.settings?.business_name || '';
    const m = openModal({
      title: 'Close this account',
      body: `
        <p style="color:var(--text-2);line-height:1.6">Your booking page goes off now and everyone is
          signed out. Your data is deleted in seven days — until then, a message to us brings it back.</p>
        <form id="acct-close-form" style="display:flex;flex-direction:column;gap:13px;margin-top:16px">
          <div class="field"><label>Your password</label>
            <input name="password" type="password" autocomplete="current-password" required></div>
          <div class="field"><label>Type your business name to confirm</label>
            <input name="confirm" autocomplete="off" required placeholder="${esc(name)}">
            <div class="hint">Exactly as it appears on your invoices.</div></div>
          <div class="login-error" id="acct-close-err"></div>
          <button class="btn danger" type="submit" style="align-self:flex-start">Close the account</button>
        </form>`,
    });
    m.querySelector('#acct-close-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const err = m.querySelector('#acct-close-err');
      err.textContent = '';
      const btn = e.target.querySelector('button[type=submit]');
      btn.disabled = true;
      try {
        const r = await api.post('/api/account/delete', {
          password: fd.get('password'), confirm: fd.get('confirm'),
        });
        m.close();
        // Everything is already signed out server-side; reloading lands on the
        // login screen, which is the honest end of this.
        toast(r.message || 'Your account is closed.', 'ok');
        setTimeout(() => location.reload(), 2500);
      } catch (e2) {
        err.textContent = e2.message;
        btn.disabled = false;
      }
    });
  };

  // ---- profile -------------------------------------------------------------
  // Signing out. The ordinary one ends this session; "everywhere" retires every
  // session this user has anywhere, including this one.
  container.querySelector('#acct-signout').onclick = async () => {
    await api.post('/api/auth/logout').catch(() => {});
    location.reload();
  };
  container.querySelector('#acct-signout-all').onclick = async () => {
    const yes = await confirmDialog('Sign out everywhere',
      'Every device signed in as you will be signed out — including this one. Anyone who still has '
      + 'Kairo open will have to sign in again. Your data is untouched.',
      { okText: 'Sign out everywhere' });
    if (!yes) return;
    await api.post('/api/auth/logout-everywhere').catch(() => {});
    location.reload();
  };

  // The refund. Asks twice on purpose while the window is live, because the
  // press is irreversible and takes the salon offline with it.
  const refundBtn = container.querySelector('#acct-refund');
  if (refundBtn) {
    refundBtn.onclick = async () => {
      const live = Number(guarantee?.days_left || 0) > 0;
      const yes = await confirmDialog(
        live ? 'Refund and close your Kairo' : 'Ask for a refund',
        live
          ? 'Your money goes back to the card that paid, your whole business is emailed to you first, '
            + 'and your booking page stops taking bookings. This cannot be undone.'
          : 'This sends a request to a person, along with anything you wrote. Nothing is refunded or '
            + 'switched off until somebody has read it.',
        { okText: live ? 'Refund and close' : 'Send the request', danger: live });
      if (!yes) return;
      refundBtn.disabled = true;
      try {
        const note = container.querySelector('#acct-refund-reason');
        const r = await api.post('/api/account/refund', { reason: note ? note.value.trim() : '' });
        if (r.refunded) {
          toast('Refunded. Your data is on its way to you by email.', 'ok');
        } else if (r.queued) {
          toast('Request sent — somebody will read it and come back to you.', 'ok');
        } else if (r.already) {
          toast('This Kairo has already been refunded.', 'ok');
        }
        renderAccount(container);
      } catch (err) {
        refundBtn.disabled = false;
        toast(err.message, 'err');
      }
    };
  }

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

  // Live verdict as they type. The server still decides; this only saves them
  // filling in the form and being told no.
  const pwField = container.querySelector('#pw-next');
  const meter = container.querySelector('#pw-meter');
  const pwContext = [a.user.email, a.user.name, a.business.name];
  pwField.addEventListener('input', () => {
    const verdict = judgePassword(pwField.value, pwContext);
    meter.hidden = !verdict;
    if (!verdict) return;
    meter.dataset.level = String(verdict.level);
    meter.querySelector('.pw-say').textContent = verdict.say;
  });

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
