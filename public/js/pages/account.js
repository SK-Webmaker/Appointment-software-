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
import { PW_MIN, judgePassword } from '../password-judge.js';
import { signedOut as nativeSignedOut } from '../native.js';

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
    ? `No reason needed, no questions asked. We email you a copy of everything, refund ${esc(amount)},
       then close and delete your Kairo.`
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
    ? 'Nothing happens on the first press. The next screens show what you would be giving up and exactly what a refund does, then we email you a code to confirm it is you.'
    : 'This sends a request to a person rather than refunding automatically. We email you a code first to confirm it is you, and you hear back by email.'}
        </div>
      </div>
      ${live ? '' : `
      <div class="field" style="margin-top:14px">
        <label>Anything you want to say (optional)</label>
        <textarea id="acct-refund-reason" rows="3" maxlength="300"
          placeholder="What went wrong, or what you needed and didn't get."></textarea>
      </div>`}
      <button type="button" class="btn ${live ? 'danger' : ''}" id="acct-refund">
        ${icon('back', 14)} ${live ? 'Refund and delete my Kairo' : 'Ask for a refund'}
      </button>
      ${g.paid_at ? `<div class="acct-meta" style="margin-top:10px">Bought ${esc(fmtDate(String(g.paid_at).slice(0, 10), { weekday: false }))}${g.price_cents ? ` · ${esc(amount)} once, nothing after` : ''}</div>` : ''}
    </div>`;
}

const dollars = (cents) => `$${(cents / 100).toFixed(2).replace(/\.00$/, '')}`;

/** One line of the refund warning: what happens, then the detail. */
const warnRow = (ic, head, detail, tone = '', i = 0) => `
  <li class="rf-row ${tone}" style="--i:${i}">
    <span class="rf-ic">${icon(ic, 16)}</span>
    <span><b>${head}</b><span class="rf-detail">${detail}</span></span>
  </li>`;

// ── The refund, one screen at a time ───────────────────────────────────────
//
// A refund is the one thing in Kairo that cannot be taken back, so it is not a
// single "Are you sure?". It is five screens in one window:
//
//   1. Before you go: what this salon would be giving up, in its own numbers
//   2. What happens: every consequence, in the order the server does it, and a
//      box to tick that says it was read
//   3. It's you: six digits emailed to the owner's sign-in address. The server
//      refuses the refund without them (src/refund-code.js)
//   4. Refunding: each stage on screen, and none of them ticked until the
//      server has said it is done
//   5. Done: what happened, then signed out, because the salon is closed
//
// After the 14 days the same flow sends a request a person reads instead, and
// says so at every step.

const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const pause = (ms) => new Promise((r) => setTimeout(r, reducedMotion() ? Math.min(ms, 40) : ms));

/** A number that counts up and lands, rather than just appearing. */
function countUp(el, to) {
  const n = Number(to) || 0;
  if (reducedMotion() || !n) { el.textContent = n.toLocaleString(); return; }
  const t0 = performance.now();
  const tick = (t) => {
    const p = Math.min(1, (t - t0) / 900);
    el.textContent = Math.round(n * (1 - (1 - p) ** 3)).toLocaleString();
    if (p < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

const tile = (n, label, tone = '') => `
  <div class="rf-tile ${tone}"><b data-count="${Number(n) || 0}">0</b><span>${label}</span></div>`;

const gain = (ic, head, detail, i) => `
  <li class="rf-gain" style="--i:${i}">
    <span class="rf-ic">${icon(ic, 16)}</span>
    <span><b>${head}</b><span class="rf-detail">${detail}</span></span>
  </li>`;

function refundFlow(g, a, container) {
  const live = Number(g.days_left || 0) > 0;
  const amount = g.price_cents ? dollars(g.price_cents) : 'what you paid';
  const bizName = a.business.name || 'your business';
  const biz = esc(bizName);
  const u = a.usage || {};
  const upcoming = Number(u.upcoming || 0);
  const reason = container.querySelector('#acct-refund-reason')?.value.trim() || '';
  const STEPS = ['Before you go', 'What happens', "It's you", live ? 'Done' : 'Sent'];

  let busy = false;      // a request in flight: the window stays open until it answers
  let closed = false;    // the salon is gone: closing the window signs out
  let sent = null;       // { to, at, resendAt } once a code has been emailed
  let timer = 0;

  const leave = () => { if (!nativeSignedOut()) location.reload(); };
  const m = openModal({
    title: STEPS[0],
    body: `
      <div class="rf-flow">
        <ol class="rf-steps" aria-label="Refund steps">${STEPS.map((s, i) => `<li data-i="${i}"><i></i><span>${s}</span></li>`).join('')}</ol>
        <div class="rf-stage" aria-live="polite"></div>
      </div>`,
    footer: ' ',
    onClose: () => { clearInterval(timer); removeEventListener('keydown', holdKeys, true); if (closed) leave(); },
  });
  const stage = m.querySelector('.rf-stage');
  const foot = m.querySelector('.modal-foot');
  const head = m.querySelector('.modal-head h2');
  const scroller = m.querySelector('.modal-body');

  // While the refund is running, the window cannot be closed into a state
  // where the owner never learns whether it happened.
  function holdKeys(e) { if (busy && e.key === 'Escape') { e.stopPropagation(); e.preventDefault(); } }
  addEventListener('keydown', holdKeys, true);
  m.addEventListener('mousedown', (e) => { if (busy) e.stopImmediatePropagation(); }, true);
  m.addEventListener('click', (e) => { if (busy && e.target.closest('[data-close]')) e.stopImmediatePropagation(); }, true);
  const setBusy = (on) => { busy = on; m.classList.toggle('rf-busy', on); };

  /** Swap the screen: the old one slides away, the new one slides in. */
  async function show(step, title, html, footer, { back = false } = {}) {
    clearInterval(timer);
    m.querySelectorAll('.rf-steps li').forEach((li, k) => {
      li.classList.toggle('done', k < step);
      li.classList.toggle('now', k === step);
      if (k === step) li.setAttribute('aria-current', 'step'); else li.removeAttribute('aria-current');
    });
    if (stage.childElementCount) {
      stage.classList.remove('rf-in');
      stage.classList.add('rf-out');
      stage.classList.toggle('rf-back', back);
      await pause(170);
    }
    head.textContent = title;
    stage.innerHTML = html;
    foot.innerHTML = footer;
    stage.classList.remove('rf-out');
    stage.classList.toggle('rf-back', back);
    void stage.offsetWidth; // restart the arrival animation
    stage.classList.add('rf-in');
    scroller.scrollTop = 0;
    const keep = foot.querySelector('[data-keep]');
    if (keep) keep.onclick = () => m.close();
  }

  // ── 1. Before you go ────────────────────────────────────────────────────
  async function giveUp({ back = false } = {}) {
    const anyNumbers = [u.clients, upcoming, u.online_bookings_30d, u.messages_this_month].some((n) => Number(n) > 0);
    const appts = Number(u.appointments_30d || 0);
    const host = String(a.instance?.booking_url || '').replace(/^https?:\/\//, '').replace(/\/$/, '');
    await show(0, 'Before you go', `
      <div class="rf-lose">
        <p class="rf-lede">${appts
          ? `In the last 30 days Kairo kept <b>${appts.toLocaleString()} appointment${appts === 1 ? '' : 's'}</b> on track for ${biz}.
             Here's what ${live ? 'a refund' : 'a refund, if it is approved,'} takes away.`
          : `Here's what ${biz} would be giving up.`}</p>
        ${anyNumbers ? `<div class="rf-tiles">
          ${tile(u.clients, Number(u.clients) === 1 ? 'client on your books' : 'clients on your books')}
          ${tile(upcoming, upcoming === 1 ? 'appointment still to come' : 'appointments still to come', upcoming ? 'warn' : '')}
          ${tile(u.online_bookings_30d, 'booked online in 30 days')}
          ${tile(u.messages_this_month, 'messages sent for you this month')}
        </div>` : ''}
        <ul class="rf-gains">
          ${gain('globe', 'Your own booking page', a.instance?.online_booking && host
            ? `Clients book themselves, day or night, at <b>${esc(host)}</b>.`
            : 'Clients book themselves, day or night, without a phone call.', 0)}
          ${gain('clock', 'Reminders that send themselves', 'Confirmations and reminders go out on their own, so fewer clients forget.', 1)}
          ${gain('calendar', 'Your whole book in one place', 'Your calendar, your clients and their notes, invoices and payments, on any device.', 2)}
          ${gain('phone', 'Kairo on your iPhone', 'Your day and your clients in your pocket, wherever you are.', 3)}
          ${gain('dollar', 'Already paid for, for good', `${esc(amount)} once. No subscription and nothing more to pay, ever.`, 4)}
        </ul>
      </div>`, `
      <button class="btn" data-next>${live ? 'Continue to the refund' : 'Continue'}</button>
      <div class="spacer"></div>
      <button class="btn primary" data-keep>${icon('check', 14)} Keep my Kairo</button>`, { back });
    stage.querySelectorAll('[data-count]').forEach((el, i) => setTimeout(() => countUp(el, el.dataset.count), reducedMotion() ? 0 : 120 + i * 90));
    foot.querySelector('[data-next]').onclick = () => consequences();
  }

  // ── 2. What happens ─────────────────────────────────────────────────────
  async function consequences({ back = false } = {}) {
    const rows = live ? [
      ['card', `${esc(amount)} goes back to the card that paid`,
        'Usually 5–10 business days to show on your statement, depending on your bank.'],
      ['globe', 'Your Kairo closes straight away',
        'Your booking page stops working. Clients can no longer book, change or cancel online.', 'bad'],
      ['mail', 'Your clients stop hearing from you',
        upcoming
          ? `No more confirmations, reminders or texts — including for the <b>${upcoming} appointment${upcoming === 1 ? '' : 's'}
             already booked</b>. Let ${upcoming === 1 ? 'that client' : 'those clients'} know yourself.`
          : 'No more confirmations, reminders or texts are sent.', upcoming ? 'bad' : ''],
      ['logout', 'Everyone is signed out',
        'You, your team, and the Kairo iPhone app. Nobody can sign in to this Kairo again.'],
      ['download', 'A copy is emailed to you first',
        'Your clients, appointments, invoices, payments and services, as spreadsheets, to the email you signed up with. Keep it — it will be the only copy.'],
      ['trash', 'Then all of it is deleted, for good',
        `7 days after the refund, everything in ${biz} is permanently deleted from Kairo's servers. Backup copies expire on their own after that.`, 'bad'],
      ['alert', 'This cannot be undone',
        'To use Kairo again you would need to buy it again and set it up from the start.', 'bad'],
    ] : [
      ['send', 'Your request goes to a person',
        `Along with anything you wrote. Nothing is refunded or switched off until somebody has read it.`],
      ['mail', 'You hear back by email', 'At the address on the account, whatever the answer is.'],
      ['alert', 'If it is approved, it works like any refund',
        `A copy of your data is emailed to you, ${esc(amount)} goes back to your card, ${biz} closes and everybody is signed out.
         Its data is deleted for good 7 days later.`, 'bad'],
    ];
    await show(1, live ? 'What a refund does' : 'What asking does', `
      <p class="rf-lede">${live
        ? `This refunds <b>${esc(amount)}</b> and deletes <b>${biz}</b> from Kairo. Please read all of it before you go on.`
        : 'The 14-day window has passed, so this is a request rather than an automatic refund.'}</p>
      <ul class="rf-list">${rows.map(([ic, h, d, tone], i) => warnRow(ic, h, d, tone, i)).join('')}</ul>
      <label class="confirm-opt rf-ack" style="--i:${rows.length}">
        <input type="checkbox" class="chk" id="rf-ack">
        <span><b>${live ? `I understand. Refund me and delete ${biz}.` : 'I understand. Send my refund request.'}</b>
          <span class="co-hint">I have read the list above.</span></span>
      </label>
      <div class="login-error" id="rf-err" role="alert"></div>`, `
      <button class="btn" data-back>${icon('chevL', 14)} Back</button>
      <div class="spacer"></div>
      <button class="btn" data-keep>Keep my Kairo</button>
      <button class="btn danger rf-go" data-go disabled>${icon('mail', 14)} Email me a code</button>`, { back });
    const ack = stage.querySelector('#rf-ack');
    const go = foot.querySelector('[data-go]');
    ack.onchange = () => { go.disabled = !ack.checked; };
    foot.querySelector('[data-back]').onclick = () => giveUp({ back: true });
    go.onclick = async () => {
      if (!ack.checked) return;
      // A code from a minute ago is still good: going back and forth does not
      // fill the inbox.
      if (sent && Date.now() - sent.at < 9 * 60_000) { itsYou(); return; }
      go.disabled = true;
      go.innerHTML = '<span class="rf-spin" aria-hidden="true"></span> Sending…';
      const err = stage.querySelector('#rf-err');
      err.textContent = '';
      try {
        await emailCode();
        itsYou();
      } catch (e) {
        err.textContent = e.message;
        go.disabled = false;
        go.innerHTML = `${icon('mail', 14)} Email me a code`;
      }
    };
  }

  /** Ask the server to email a code. A 429 means one went out moments ago: use that one. */
  async function emailCode() {
    try {
      const r = await api.post('/api/account/refund/code', {});
      sent = { to: r.sent_to, at: Date.now(), resendAt: Date.now() + (r.resend_after || 45) * 1000 };
    } catch (e) {
      if (e.status !== 429) throw e;
      sent = { to: sent?.to || 'your email', at: sent?.at || Date.now(), resendAt: Date.now() + (e.data?.retry_after || 45) * 1000 };
    }
  }

  // ── 3. It's you ─────────────────────────────────────────────────────────
  async function itsYou({ back = false, problem = '', why = '', typed = '' } = {}) {
    const finalLabel = live ? `${icon('trash', 14)} Refund ${esc(amount)} and delete` : `${icon('send', 14)} Send my request`;
    await show(2, "Confirm it's you", `
      <div class="rf-code">
        <div class="rf-envelope" aria-hidden="true">${icon('mail', 26)}</div>
        <p class="rf-lede">We've emailed a 6-digit code to <b>${esc(sent.to)}</b>. Type it in to confirm it's really you.</p>
        <div class="rf-digits" role="group" aria-label="The 6-digit code from the email">
          ${[0, 1, 2, 3, 4, 5].map((i) => `<input inputmode="numeric" pattern="[0-9]*" maxlength="1" aria-label="Digit ${i + 1}"
              ${i === 0 ? 'autocomplete="one-time-code"' : 'autocomplete="off"'} data-d="${i}">`).join('')}
        </div>
        <div class="login-error rf-code-err" role="alert">${esc(problem)}</div>
        <div class="rf-resend"><button type="button" class="btn small" data-resend disabled>Send a new code</button>
          <span data-wait></span></div>
        <p class="rf-note">It works for 10 minutes. Can't see it? Check your spam folder, and use the newest one.</p>
      </div>`, `
      <button class="btn" data-back>${icon('chevL', 14)} Back</button>
      <div class="spacer"></div>
      <button class="btn" data-keep>Keep my Kairo</button>
      <button class="btn danger rf-go" data-final disabled>${finalLabel}</button>`, { back });

    const boxes = [...stage.querySelectorAll('[data-d]')];
    const final = foot.querySelector('[data-final]');
    const errEl = stage.querySelector('.rf-code-err');
    const digits = () => boxes.map((b) => b.value).join('');
    const sync = () => {
      final.disabled = digits().length !== 6;
      boxes.forEach((b) => b.classList.toggle('filled', !!b.value));
    };
    /** Spread typed or pasted digits across the boxes from `from` onwards. */
    const spread = (from, text) => {
      const ds = String(text).replace(/\D/g, '').slice(0, 6 - from).split('');
      ds.forEach((d, k) => { boxes[from + k].value = d; });
      boxes[Math.min(from + ds.length, 5)].focus();
      sync();
      if (ds.length) errEl.textContent = '';
    };
    boxes.forEach((b, i) => {
      b.addEventListener('input', () => {
        const v = b.value.replace(/\D/g, '');
        b.value = '';
        if (v) spread(i, v); else sync();
      });
      b.addEventListener('keydown', (e) => {
        if (e.key === 'Backspace' && !b.value && i > 0) { boxes[i - 1].value = ''; boxes[i - 1].focus(); sync(); e.preventDefault(); }
        else if (e.key === 'ArrowLeft' && i > 0) boxes[i - 1].focus();
        else if (e.key === 'ArrowRight' && i < 5) boxes[i + 1].focus();
        else if (e.key === 'Enter' && !final.disabled) final.click();
      });
      b.addEventListener('paste', (e) => { e.preventDefault(); spread(i, e.clipboardData.getData('text')); });
      b.addEventListener('focus', () => b.select());
    });
    if (why) {
      const row = stage.querySelector('.rf-digits');
      row.classList.add('rf-shake');
      setTimeout(() => row.classList.remove('rf-shake'), 500);
    }
    // The billing service failed, not the code: it was given back, so it is
    // still in the boxes for another try.
    if (typed) { typed.split('').forEach((d, k) => { boxes[k].value = d; }); sync(); }
    setTimeout(() => (typed ? final : boxes[0]).focus({ preventScroll: true }), reducedMotion() ? 0 : 200);

    // "Send a new code", with the wait shown rather than a button that does nothing.
    const resend = stage.querySelector('[data-resend]');
    const waitEl = stage.querySelector('[data-wait]');
    const tickWait = () => {
      const s = Math.max(0, Math.ceil((sent.resendAt - Date.now()) / 1000));
      resend.disabled = s > 0;
      waitEl.textContent = s > 0 ? `in ${s}s` : '';
    };
    tickWait();
    timer = setInterval(tickWait, 1000);
    resend.onclick = async () => {
      resend.disabled = true;
      try {
        await emailCode();
        boxes.forEach((b) => { b.value = ''; });
        sync();
        boxes[0].focus();
        errEl.textContent = '';
        toast(`A new code is on its way to ${sent.to}.`);
      } catch (e) { errEl.textContent = e.message; }
      tickWait();
    };

    foot.querySelector('[data-back]').onclick = () => consequences({ back: true });
    final.onclick = () => { if (digits().length === 6) refunding(digits()); };
  }

  // ── 4. Refunding ────────────────────────────────────────────────────────
  async function refunding(code) {
    const stages = live
      ? ["Confirming it's you", 'Emailing you a copy of your data', `Refunding ${esc(amount)} to your card`, `Closing ${biz}`]
      : ["Confirming it's you", 'Sending your request to a person'];
    setBusy(true);
    await show(3, live ? 'Refunding' : 'Sending', `
      <div class="rf-work">
        <div class="rf-orbit" aria-hidden="true"><span></span></div>
        <ul class="rf-stages">${stages.map((s) => `<li><i aria-hidden="true"></i><span>${s}</span></li>`).join('')}</ul>
        <p class="rf-note">Keep this window open. It takes a few seconds.</p>
      </div>`, '');
    foot.style.display = 'none';
    const rows = [...stage.querySelectorAll('.rf-stages li')];
    let at = 0;
    rows[0].classList.add('now');
    // The marker walks forward while the server works, but stops on the last
    // stage: nothing is ticked as done until the server has said so.
    timer = setInterval(() => {
      if (at >= rows.length - 1) return;
      rows[at].classList.replace('now', 'past');
      rows[++at].classList.add('now');
    }, reducedMotion() ? 250 : 1100);

    let r;
    try {
      [r] = await Promise.all([
        api.post('/api/account/refund', { confirm: 'refund-and-delete', code, ...(reason ? { reason } : {}) }),
        pause(1600),
      ]);
    } catch (e) {
      clearInterval(timer);
      setBusy(false);
      foot.style.display = '';
      // Back to the code, saying why. Nothing has changed on any of these paths.
      const why = e.data?.code_error || '';
      await itsYou({ back: true, problem: e.message, why: why || 'failed', typed: why ? '' : code });
      return;
    }
    clearInterval(timer);
    // Now tick them, one after another, as the server reported them.
    for (let k = 0; k < rows.length; k++) {
      rows[k].classList.remove('now', 'past');
      const copyStage = live && k === 1;
      rows[k].classList.add(copyStage && r.refunded && !r.copy_emailed ? 'warn' : 'done');
      if (copyStage && r.refunded && !r.copy_emailed) rows[k].querySelector('span').textContent = 'Your copy will be sent by hand';
      await pause(260);
    }
    stage.querySelector('.rf-orbit').classList.add('settled');
    await pause(420);
    closed = Boolean(r.refunded || r.already);
    setBusy(false);
    foot.style.display = '';
    m.querySelector('.rf-steps').classList.add('complete');
    done(r);
  }

  // ── 5. Done ─────────────────────────────────────────────────────────────
  async function done(r) {
    const seal = `<svg class="rf-seal" viewBox="0 0 64 64" aria-hidden="true">
      <circle cx="32" cy="32" r="28"/><path d="M20 33.5l8.5 8.5L45 24"/></svg>`;
    if (!r.refunded && !r.already) {
      // After the window: a request, sent. The salon carries on as it was.
      await show(3, 'Request sent', `
        <div class="rf-end">${seal}
          <h3>Your request is with us</h3>
          <p>A person will read it and email you at the address on the account.
            Nothing has been refunded or switched off in the meantime — ${biz} carries on as it was.</p>
        </div>`, '<div class="spacer"></div><button class="btn primary" data-ok>Done</button>');
      m.querySelectorAll('.rf-steps li').forEach((li) => li.classList.add('done'));
      foot.querySelector('[data-ok]').onclick = () => { m.close(); renderAccount(container); };
      return;
    }
    const deleteOn = r.files_deleted_after ? fmtDate(String(r.files_deleted_after).slice(0, 10), { weekday: false }) : '';
    await show(3, r.already ? 'Already refunded' : 'Refund complete', `
      <div class="rf-end">${seal}
        ${r.already ? `<h3>Already refunded</h3><p>This Kairo had already been refunded and closed.</p>` : `
        <h3>Refund complete</h3>
        <p><b>${esc(amount)}</b> is on its way back to the card that paid. Allow 5–10 business days.</p>
        <dl class="rf-receipt">
          <div style="--i:0"><dt>Refunded</dt><dd>${esc(amount)}</dd></div>
          <div style="--i:1"><dt>Copy of your data</dt><dd>${r.copy_emailed ? 'Emailed to you' : 'Being sent to you by hand'}</dd></div>
          <div style="--i:2"><dt>${biz}</dt><dd>Closed, everyone signed out</dd></div>
          <div style="--i:3"><dt>Deleted for good</dt><dd>${deleteOn ? `On ${esc(deleteOn)}` : 'Not until you have your copy'}</dd></div>
        </dl>
        <p class="rf-thanks">Thank you for trying Kairo. Keep the email with your data: it's the only copy.</p>`}
        <p class="rf-leaving">Signing you out in <b data-left>30</b> seconds.</p>
      </div>`, '<div class="spacer"></div><button class="btn primary" data-ok>Done</button>');
    m.querySelectorAll('.rf-steps li').forEach((li) => { li.classList.add('done'); li.classList.remove('now'); });
    foot.querySelector('[data-ok]').onclick = leave;
    // The salon is closed and this session with it: there is nothing left to
    // do here, so the screen leaves on its own if nobody presses Done.
    const until = Date.now() + 30_000;
    const left = stage.querySelector('[data-left]');
    timer = setInterval(() => {
      const s = Math.max(0, Math.ceil((until - Date.now()) / 1000));
      left.textContent = String(s);
      if (!s) { clearInterval(timer); leave(); }
    }, 500);
  }

  giveUp();
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
            <input name="email" type="email" value="${esc(a.user.email)}" required id="acct-email">
            <div class="hint">This is what you sign in with, and where a password reset is sent. Use an address
              you read yourself — changing it means confirming the new one.</div></div>
          <div class="field" id="acct-email-pw" hidden><label>Current password</label>
            <input name="current_password" type="password" autocomplete="current-password">
            <div class="hint">Needed to change the email, because whoever controls this address can reset your password.</div></div>
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
          ${a.user.email_verified ? '<div class="hint">If you ever forget your password, you can reset it yourself from the sign-in page.</div>'
            : `<div class="hint">Confirm it and you can reset your own password from the sign-in page if you ever forget it
                 — without it, a reset has to go through Kairo support.${a.user.can_email ? '' : ' Needs email set up in Settings → Messages → Notifications first.'}</div>`}
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
        // Inside the app, back to its sign-in screen rather than this salon's.
        setTimeout(() => { if (!nativeSignedOut()) location.reload(); }, 2500);
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
    if (!nativeSignedOut()) location.reload();   // the app goes back to its own sign-in
  };
  container.querySelector('#acct-signout-all').onclick = async () => {
    const yes = await confirmDialog('Sign out everywhere',
      'Every device signed in as you will be signed out — including this one. Anyone who still has '
      + 'Kairo open will have to sign in again. Your data is untouched.',
      { okText: 'Sign out everywhere' });
    if (!yes) return;
    await api.post('/api/auth/logout-everywhere').catch(() => {});
    if (!nativeSignedOut()) location.reload();
  };

  // The refund. Nothing happens on the first press: it opens the step-by-step
  // window above — what would be lost, what a refund does, then six digits
  // from the owner's email. The server refuses a refund that did not come
  // through it.
  const refundBtn = container.querySelector('#acct-refund');
  if (refundBtn) refundBtn.onclick = () => refundFlow(guarantee, a, container);

  // Changing the email asks for the password, so the field appears the moment
  // the address differs from the one on the account — and not before.
  const emailInput = container.querySelector('#acct-email');
  const emailPw = container.querySelector('#acct-email-pw');
  emailInput.addEventListener('input', () => {
    emailPw.hidden = emailInput.value.trim().toLowerCase() === a.user.email.toLowerCase();
  });

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
      const out = await api.put('/api/account/profile', {
        name: fd.get('name'), email: fd.get('email'), current_password: fd.get('current_password') || '',
      });
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
