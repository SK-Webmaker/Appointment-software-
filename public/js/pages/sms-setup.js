// Turning SMS on, for somebody who has never heard of ClickSend.
//
// The settings card already has the fields. Fields are not the problem. The
// problem is that a salon owner looking at "ClickSend username" and "ClickSend
// API key" has no idea where those come from, no idea whether what they pasted
// is right, and no idea whether a text will actually arrive — and finds out
// three weeks later when a client says they never got a reminder.
//
// So this is four steps, each of which proves itself before offering the next:
//
//   1. an account          → a link, and what to click when they get there
//   2. the credentials     → checked against ClickSend on the spot, with the
//                            account name and balance read back
//   3. who it comes from   → their own salon number, verified by a code
//   4. a real text         → sent to their phone, from their setup
//
// Step 4 is the point of the whole thing. Every other step can look finished
// and still not deliver: "accepted is not delivered" has bitten this project
// on Cloudflare, Resend and ClickSend already. A green tick nobody earned is
// the kind that fails at nine o'clock on a Saturday.
import { api } from '../api.js';
import { esc, icon, openModal, toast } from '../ui.js';
import { state } from '../app.js';

const CLICKSEND_SIGNUP = 'https://dashboard.clicksend.com/signup';
const CLICKSEND_KEYS = 'https://dashboard.clicksend.com/account/subaccounts';

/** One step's shell, so all four read the same. */
function stepHtml(n, title, body, { done = false, open = false } = {}) {
  return `
    <section class="ss-step ${done ? 'done' : ''} ${open ? 'open' : ''}" data-step="${n}">
      <div class="ss-head">
        <span class="ss-num">${done ? icon('check', 13) : n}</span>
        <h3>${esc(title)}</h3>
      </div>
      <div class="ss-body">${body}</div>
    </section>`;
}

export async function openSmsSetup({ onDone = null } = {}) {
  const s = state.settings || {};
  const connected = Boolean(s.clicksend_username && s.clicksend_api_key_set);
  const sender = String(s.clicksend_from || '').trim();
  const phone = String(s.business_phone || '').trim();

  const m = openModal({
    title: 'Set up text messages',
    wide: true,
    body: `
      <p class="ss-lede">Kairo sends texts through <b>ClickSend</b>, an Australian service you pay
        directly. There is no markup and no subscription — you top up credit and each text costs a
        few cents. Four steps, about five minutes.</p>

      ${stepHtml(1, 'Create a ClickSend account', `
        <p>Free to open. You only pay for texts you send.</p>
        <a class="btn" href="${CLICKSEND_SIGNUP}" target="_blank" rel="noopener noreferrer">
          ${icon('external', 14)} Open ClickSend sign-up</a>
        <p class="ss-note">Already have one? Skip to step 2.</p>`, { done: connected, open: !connected })}

      ${stepHtml(2, 'Copy your username and API key', `
        <p>In ClickSend, go to <b>Account → API Credentials</b>. You want two things: the
          <b>username</b> you log in with, and the <b>API key</b> shown on that page.</p>
        <a class="btn" href="${CLICKSEND_KEYS}" target="_blank" rel="noopener noreferrer">
          ${icon('external', 14)} Open API Credentials</a>
        <form id="ss-creds" class="ss-form">
          <div class="field"><label>ClickSend username</label>
            <input name="username" autocomplete="off" value="${esc(s.clicksend_username || '')}"
              placeholder="the email or username you log in with"></div>
          <div class="field"><label>API key</label>
            <input name="api_key" type="password" autocomplete="off"
              placeholder="${connected ? 'saved — paste a new one to replace it' : 'a long string of letters and numbers'}"></div>
          <div class="ss-err" id="ss-creds-err"></div>
          <button class="btn primary" type="submit">${icon('check', 14)} Check and connect</button>
        </form>
        <div class="ss-ok" id="ss-creds-ok" ${connected ? '' : 'hidden'}>
          ${connected ? `${icon('check', 14)} Connected as <b>${esc(s.clicksend_username)}</b>` : ''}
        </div>
        <p class="ss-note">We check these with ClickSend straight away, so a typo is caught here
          rather than by a reminder that silently never sends.</p>`,
    { done: connected, open: !connected })}

      ${stepHtml(3, 'Choose who the text comes from', `
        <p>Use <b>your own salon number</b>. Texts then come from the number your clients already
          have, and when somebody replies "can I move to 3?" it lands on your phone where you'll
          read it.</p>
        <form id="ss-number" class="ss-form">
          <div class="field"><label>Your salon mobile</label>
            <input name="number" inputmode="tel" value="${esc(sender || phone)}" placeholder="+61…"></div>
          <div class="ss-err" id="ss-number-err"></div>
          <button class="btn" type="submit">${icon('send', 14)} Text me a code</button>
        </form>
        <form id="ss-code" class="ss-form" hidden>
          <div class="field"><label>The code we just texted you</label>
            <input name="code" inputmode="numeric" autocomplete="one-time-code" placeholder="6 digits"></div>
          <div class="ss-err" id="ss-code-err"></div>
          <button class="btn primary" type="submit">${icon('check', 14)} Confirm this number</button>
        </form>
        <div class="ss-ok" id="ss-number-ok" ${sender ? '' : 'hidden'}>
          ${sender ? `${icon('check', 14)} Texts will come from <b>${esc(sender)}</b>` : ''}</div>
        <p class="ss-note">Prefer your business name to show instead of a number? That needs a
          free one-off ACMA registration with your ABN, which ClickSend handles. You can do it
          later — a number works today.</p>`, { done: Boolean(sender) })}

      ${stepHtml(4, 'Send yourself a real text', `
        <p>The only step that proves any of this. Everything above can look finished and still
          not deliver.</p>
        <div class="ss-err" id="ss-test-err"></div>
        <button class="btn primary" id="ss-test">${icon('send', 14)} Send me a test text</button>
        <div class="ss-ok" id="ss-test-ok" hidden></div>
        <p class="ss-note">It goes to <b>${esc(phone || 'your business phone')}</b>, costs one
          message, and is logged under Messages like any other.</p>`)}
    `,
    footer: `<div class="spacer"></div>
      <button class="btn primary" id="ss-close">${icon('check', 14)} Done</button>`,
  });

  const $ = (sel) => m.querySelector(sel);
  const fail = (sel, msg) => { $(sel).textContent = msg; };
  const markDone = (n) => {
    const step = m.querySelector(`.ss-step[data-step="${n}"]`);
    step?.classList.add('done');
    step?.querySelector('.ss-num')?.replaceChildren();
    if (step) step.querySelector('.ss-num').innerHTML = icon('check', 13);
  };

  // ── Step 2: the credentials, checked with ClickSend before they are stored
  $('#ss-creds').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button[type=submit]');
    fail('#ss-creds-err', '');
    btn.disabled = true;
    const fd = new FormData(e.target);
    try {
      const out = await api.post('/api/sms/connect', {
        username: String(fd.get('username') || '').trim(),
        api_key: String(fd.get('api_key') || '').trim(),
      });
      const ok = $('#ss-creds-ok');
      ok.hidden = false;
      ok.innerHTML = `${icon('check', 14)} Connected as <b>${esc(out.account || fd.get('username'))}</b>`
        + (out.balance !== undefined
          ? ` — <b>${esc(out.symbol || '$')}${Number(out.balance).toFixed(2)}</b> of credit`
          : '');
      markDone(1); markDone(2);
      toast('ClickSend connected');
    } catch (e2) {
      fail('#ss-creds-err', e2.message);
    }
    btn.disabled = false;
  });

  // ── Step 3: their own number, proved by a code ClickSend texts them
  let verificationId = '';
  $('#ss-number').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button[type=submit]');
    fail('#ss-number-err', '');
    btn.disabled = true;
    try {
      const out = await api.post('/api/sms/own-number', {
        number: String(new FormData(e.target).get('number') || '').trim(),
        label: state.settings?.business_name || '',
      });
      verificationId = out.verification_id;
      $('#ss-code').hidden = false;
      $('#ss-code').querySelector('input')?.focus();
      toast(`Code sent to ${out.sent_to}`);
    } catch (e2) {
      fail('#ss-number-err', e2.message);
    }
    btn.disabled = false;
  });

  $('#ss-code').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button[type=submit]');
    fail('#ss-code-err', '');
    btn.disabled = true;
    try {
      const number = String(new FormData($('#ss-number')).get('number') || '').trim();
      const out = await api.post('/api/sms/own-number/verify', {
        verification_id: verificationId,
        code: String(new FormData(e.target).get('code') || '').trim(),
        number,
      });
      const ok = $('#ss-number-ok');
      ok.hidden = false;
      ok.innerHTML = `${icon('check', 14)} Texts will come from <b>${esc(out.from)}</b>`;
      $('#ss-code').hidden = true;
      markDone(3);
      toast('Number confirmed');
    } catch (e2) {
      fail('#ss-code-err', e2.message);
    }
    btn.disabled = false;
  });

  // ── Step 4: the only step that proves anything
  $('#ss-test').addEventListener('click', async () => {
    const btn = $('#ss-test');
    fail('#ss-test-err', '');
    btn.disabled = true;
    try {
      const out = await api.post('/api/messages/test', { channel: 'sms' });
      const ok = $('#ss-test-ok');
      ok.hidden = false;
      if (out.ok) {
        ok.innerHTML = `${icon('check', 14)} Sent. If it lands on your phone, your SMS is live.`;
        markDone(4);
      } else {
        ok.hidden = true;
        fail('#ss-test-err', out.detail || 'ClickSend would not take it.');
      }
    } catch (e2) {
      fail('#ss-test-err', e2.message);
    }
    btn.disabled = false;
  });

  $('#ss-close').addEventListener('click', () => { m.close(); onDone?.(); });
  return m;
}
