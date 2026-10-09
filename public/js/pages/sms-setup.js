// Turning text messages on, for somebody who has never heard of ClickSend.
//
// Written for an owner who is not "good with computers", on a phone, between
// clients. Every step says what to tap and what they will see, checks itself
// before offering the next, and the last step leaves texts actually ON.
//
// That last part is the one the first version missed. It connected ClickSend,
// verified a number and sent a test, and then nothing reached a client: the
// master switch ("Turn SMS on") and the per-message choice (Email / SMS / Both)
// sat further down Settings, both off by default, and nothing said so. An
// owner who finished every step had texts that did not go out.
//
//   1. a ClickSend account   → a link, and what happens when they get there
//   2. connect it            → two pastes, checked with ClickSend on the spot
//   3. credit                → their balance read back; a top-up link if low
//   4. what to text + a test → a real text first, and only if it is accepted
//                              are texts switched on for what they ticked
//   then, optionally, texts from their own mobile number.
import { api } from '../api.js';
import { esc, icon, openModal, toast } from '../ui.js';
import { state } from '../app.js';

const CLICKSEND_SIGNUP = 'https://dashboard.clicksend.com/signup';
const CLICKSEND_KEYS = 'https://dashboard.clicksend.com/account/subaccounts';
const CLICKSEND_TOPUP = 'https://dashboard.clicksend.com/account/billing-recharge/top-up-account';

/** The messages a salon can also send by text, in the order an owner cares. */
const KINDS = [
  ['reminder', 'Appointment reminders', 'The one that stops no-shows.', true],
  ['confirmation', 'Booking confirmations', 'Sent the moment someone books.', true],
  ['receipt', 'Payment receipts', 'Most clients are happy with these by email.', false],
  ['review_request', 'Review requests', 'Usually fine by email.', false],
];

/** One step's shell, so they all read the same. */
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

const money = (symbol, n) => `${esc(symbol || '$')}${Number(n).toFixed(2)}`;

function creditHtml(b) {
  if (!b || !b.ok) return '';
  if (b.balance >= 1) {
    return `${icon('check', 14)}<span>You have <b>${money(b.symbol, b.balance)}</b> of credit${
      b.messages_left ? ` — about <b>${b.messages_left}</b> texts` : ''}.</span>`;
  }
  return '';
}

export async function openSmsSetup({ onDone = null } = {}) {
  const s = state.settings || {};
  let connected = Boolean(s.clicksend_username && s.clicksend_api_key_set);
  const sender = String(s.clicksend_from || '').trim();
  const phone = String(s.business_phone || '').trim();
  const smsOn = s.sms_notifications_enabled === '1';
  const textsFor = (kind) => ['sms', 'both'].includes(s[`chan_${kind}`]);
  const live = connected && smsOn;

  const m = openModal({
    title: 'Text your clients',
    wide: true,
    body: `
      <p class="ss-lede">Clients get their reminders by <b>text</b> as well as email. It's the best way
        to stop no-shows. Texts go through <b>ClickSend</b>, an Australian company. You pay them
        directly, a few cents a text, and Kairo adds nothing. <b>About five minutes.</b></p>

      ${stepHtml(1, 'Open a free ClickSend account', `
        <p>Tap the button, sign up with your email and mobile, and type in the code ClickSend
          texts you. New accounts come with <b>$2 of free credit</b> to try it.</p>
        <a class="btn" href="${CLICKSEND_SIGNUP}" target="_blank" rel="noopener noreferrer">
          ${icon('external', 14)} Open ClickSend</a>
        <p class="ss-note">Already have an account? Go straight to step 2. Come back to this screen
          when you're signed in to ClickSend.</p>`, { done: connected, open: !connected })}

      ${stepHtml(2, 'Connect it to Kairo', `
        <p>In ClickSend, tap the <b>key icon</b> at the top right. You'll see your
          <b>Username</b> and your <b>API Key</b>. Copy each one into the boxes below.</p>
        <a class="btn" href="${CLICKSEND_KEYS}" target="_blank" rel="noopener noreferrer">
          ${icon('external', 14)} Show me where</a>
        <form id="ss-creds" class="ss-form">
          <div class="field"><label>Username</label>
            <input name="username" autocomplete="off" autocapitalize="none" spellcheck="false"
              value="${esc(s.clicksend_username || '')}" placeholder="usually the email you signed up with"></div>
          <div class="field"><label>API Key</label>
            <input name="api_key" autocomplete="off" autocapitalize="none" spellcheck="false"
              placeholder="${connected ? 'saved — paste a new one only to change it' : 'the long one with dashes, not your password'}"></div>
          <div class="ss-err" id="ss-creds-err"></div>
          <button class="btn primary" type="submit">${icon('check', 14)} Connect</button>
        </form>
        <div class="ss-ok" id="ss-creds-ok" ${connected ? '' : 'hidden'}>
          ${connected ? `${icon('check', 14)}<span>Connected as <b>${esc(s.clicksend_username)}</b></span>` : ''}</div>`,
    { done: connected, open: !connected })}

      ${stepHtml(3, 'Make sure there is credit', `
        <div class="ss-ok" id="ss-credit-ok" hidden></div>
        <div id="ss-credit-low" hidden>
          <p>Your ClickSend balance is <b id="ss-credit-amt"></b>. That's only a few texts. Add
            <b>$20</b> to start — that's a few hundred texts.</p>
          <a class="btn" href="${CLICKSEND_TOPUP}" target="_blank" rel="noopener noreferrer">
            ${icon('external', 14)} Add credit in ClickSend</a>
          <button class="btn ghost" type="button" id="ss-credit-recheck">I've added it — check again</button>
        </div>
        <p class="ss-note" id="ss-credit-wait">${connected ? 'Checking your balance…' : 'Shows here once you are connected.'}</p>
        <p class="ss-note">So reminders never stop, switch on <b>Auto-recharge</b> in ClickSend:
          Billing → Balance Management. It tops you up before you run out.</p>`)}

      ${stepHtml(4, 'Choose what to text, and test it', `
        <p>Ticked messages go by <b>text and email</b>. Anyone without a mobile still gets the
          email, and anyone without an email still gets the text.</p>
        <div class="ss-kinds" id="ss-kinds">
          ${KINDS.map(([kind, label, hint, dflt]) => `
          <label class="opt-out">
            <input type="checkbox" class="chk" name="${kind}" ${(live ? textsFor(kind) : dflt) ? 'checked' : ''}>
            <span><b>${label}</b><span>${hint}</span></span>
          </label>`).join('')}
        </div>
        <div class="field" style="margin-top:12px"><label>Send the test text to</label>
          <input id="ss-test-to" inputmode="tel" value="${esc(phone)}" placeholder="your mobile, e.g. 0412 345 678"></div>
        <div class="ss-err" id="ss-test-err"></div>
        <button class="btn primary" id="ss-test">${icon('send', 14)} ${live ? 'Save and send a test' : 'Turn on texts and send me a test'}</button>
        <div class="ss-ok" id="ss-test-ok" ${live ? '' : 'hidden'}>${live
          ? `${icon('check', 14)}<span>Texts are <b>on</b>.</span>` : ''}</div>
        <p class="ss-note">Texts only switch on once ClickSend accepts the test, so nothing goes
          half-working to your clients. Turn them off any time in Settings → SMS.</p>`, { done: live })}

      <details class="ss-manual ss-own">
        <summary>Optional: send texts from your own mobile number</summary>
        <p class="ss-note" style="margin-top:0">Without this, texts come from a shared ClickSend
          number and replies land in your ClickSend inbox. With it, clients see your number and
          replies come straight to your phone.</p>
        <form id="ss-number" class="ss-form">
          <div class="field"><label>Your mobile</label>
            <input name="number" inputmode="tel" value="${esc(sender || phone)}" placeholder="0412 345 678"></div>
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
          ${sender ? `${icon('check', 14)}<span>Texts come from <b>${esc(sender)}</b></span>` : ''}</div>
      </details>
    `,
    footer: `<div class="spacer"></div>
      <button class="btn primary" id="ss-close">${icon('check', 14)} Done</button>`,
  });

  const $ = (sel) => m.querySelector(sel);
  const fail = (sel, msg) => { $(sel).textContent = msg; };
  const markDone = (n, done = true) => {
    const step = m.querySelector(`.ss-step[data-step="${n}"]`);
    if (!step) return;
    step.classList.toggle('done', done);
    step.querySelector('.ss-num').innerHTML = done ? icon('check', 13) : String(n);
  };

  // ── Step 3: the balance, read back so "no credit" is caught before the test
  const showCredit = (b) => {
    $('#ss-credit-wait').hidden = true;
    const ok = $('#ss-credit-ok');
    if (!b || !b.ok) {
      $('#ss-credit-wait').hidden = false;
      $('#ss-credit-wait').textContent = b?.detail || 'Could not read your balance just now.';
      return;
    }
    if (b.balance >= 1) {
      ok.hidden = false;
      ok.innerHTML = creditHtml(b);
      $('#ss-credit-low').hidden = true;
      markDone(3);
    } else {
      ok.hidden = true;
      $('#ss-credit-low').hidden = false;
      $('#ss-credit-amt').textContent = `${b.symbol || '$'}${Number(b.balance).toFixed(2)}`;
      markDone(3, false);
    }
  };
  const checkCredit = async (refresh = false) => {
    try { showCredit(await api.get(`/api/sms/balance${refresh ? '?refresh=1' : ''}`)); } catch { showCredit(null); }
  };
  if (connected) checkCredit();
  $('#ss-credit-recheck').addEventListener('click', () => checkCredit(true));

  // ── Step 2: the two pastes, checked with ClickSend before they are kept
  $('#ss-creds').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button[type=submit]');
    fail('#ss-creds-err', '');
    const fd = new FormData(e.target);
    const username = String(fd.get('username') || '').trim();
    const apiKey = String(fd.get('api_key') || '').trim();
    if (connected && !apiKey && username === (state.settings?.clicksend_username || '')) {
      toast('Already connected'); return;
    }
    btn.disabled = true;
    try {
      const out = await api.post('/api/sms/connect', { username, api_key: apiKey });
      connected = true;
      if (state.settings) { state.settings.clicksend_username = username; state.settings.clicksend_api_key_set = true; }
      const ok = $('#ss-creds-ok');
      ok.hidden = false;
      ok.innerHTML = `${icon('check', 14)}<span>Connected as <b>${esc(out.account || username)}</b></span>`;
      markDone(1); markDone(2);
      showCredit({ ok: true, balance: out.balance, symbol: out.symbol });
      toast('ClickSend connected');
      m.querySelector('.ss-step[data-step="3"]')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } catch (e2) {
      fail('#ss-creds-err', e2.message);
    }
    btn.disabled = false;
  });

  // ── Step 4: a real text first; only then are texts switched on
  $('#ss-test').addEventListener('click', async () => {
    const btn = $('#ss-test');
    fail('#ss-test-err', '');
    if (!connected) { fail('#ss-test-err', 'Connect ClickSend in step 2 first.'); return; }
    const to = $('#ss-test-to').value.trim();
    if (!to) { fail('#ss-test-err', 'Put in the mobile to send the test to.'); return; }
    const picked = KINDS.filter(([kind]) => $(`#ss-kinds input[name="${kind}"]`).checked).map(([kind]) => kind);
    if (!picked.length) { fail('#ss-test-err', 'Tick at least one message to send by text.'); return; }
    btn.disabled = true;
    try {
      const out = await api.post('/api/messages/test', { channel: 'sms', to });
      if (!out.ok) {
        fail('#ss-test-err', `${out.detail || 'ClickSend would not take it.'} Texts were not switched on.`);
        btn.disabled = false;
        return;
      }
      const patch = { sms_notifications_enabled: '1' };
      for (const [kind] of KINDS) patch[`chan_${kind}`] = picked.includes(kind) ? 'both' : 'email';
      state.settings = await api.put('/api/settings', patch);
      const ok = $('#ss-test-ok');
      ok.hidden = false;
      ok.innerHTML = `${icon('check', 14)}<span>Texts are <b>on</b>. A test is on its way to <b>${esc(to)}</b> —
        it should arrive within a minute. If it doesn't, check your ClickSend credit.</span>`;
      markDone(4);
      toast('Texts are on');
    } catch (e2) {
      fail('#ss-test-err', e2.message);
    }
    btn.disabled = false;
  });

  // ── Optional: their own number, proved by a code ClickSend texts them
  let verificationId = '';
  $('#ss-number').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button[type=submit]');
    fail('#ss-number-err', '');
    if (!connected) { fail('#ss-number-err', 'Connect ClickSend in step 2 first.'); return; }
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
      ok.innerHTML = `${icon('check', 14)}<span>Texts come from <b>${esc(out.from)}</b></span>`;
      $('#ss-code').hidden = true;
      toast('Number confirmed');
    } catch (e2) {
      fail('#ss-code-err', e2.message);
    }
    btn.disabled = false;
  });

  $('#ss-close').addEventListener('click', () => { m.close(); onDone?.(); });
  return m;
}
