// The page a "Reset your password" email opens: /reset#t=<link>
//
// The link travels after '#', so it never reaches a server log or another
// site's Referer header. It is read once, then wiped from the address bar,
// and only ever sent in the body of a request to this salon.
import { PW_MIN, judgePassword } from './password-judge.js';

const $ = (id) => document.getElementById(id);
const show = (id) => {
  for (const s of ['rs-checking', 'rs-choose', 'rs-done', 'rs-dead']) $(s).hidden = s !== id;
};

const token = new URLSearchParams(location.hash.slice(1)).get('t') || '';
history.replaceState(null, '', location.pathname);

async function post(url, body) {
  let res;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      credentials: 'same-origin',
    });
  } catch {
    const e = new Error("Couldn't reach Kairo. Check your connection and try again.");
    e.status = 0;
    throw e;
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const e = new Error(data.error || 'Something went wrong. Please try again.');
    e.status = res.status;
    throw e;
  }
  return data;
}

let context = [];

async function start() {
  if (!token) { show('rs-dead'); return; }
  try {
    const info = await post('/api/auth/reset/check', { token });
    context = [info.business];
    $('rs-lede').textContent = info.business
      ? `Choose a new password for ${info.email} at ${info.business}.`
      : `Choose a new password for ${info.email}.`;
    $('rs-hint').textContent = `At least ${PW_MIN} characters. A few ordinary words you'll remember beats one clever word with symbols.`;
    show('rs-choose');
    $('rs-new').focus();
  } catch (e) {
    if (e.status === 0) $('rs-dead-say').textContent = e.message;
    show('rs-dead');
  }
}

const pw = $('rs-new');
const meter = $('rs-meter');
pw.addEventListener('input', () => {
  const verdict = judgePassword(pw.value, context);
  meter.hidden = !verdict;
  if (verdict) {
    meter.dataset.level = String(verdict.level);
    meter.querySelector('.pw-say').textContent = verdict.say;
  }
});

$('rs-show').addEventListener('click', (e) => {
  const on = pw.type === 'password';
  pw.type = on ? 'text' : 'password';
  $('rs-again').type = pw.type;
  e.currentTarget.textContent = on ? 'Hide' : 'Show';
  e.currentTarget.setAttribute('aria-pressed', String(on));
});

$('rs-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const err = $('rs-error');
  err.textContent = '';
  if (pw.value.length < PW_MIN) { err.textContent = `Use at least ${PW_MIN} characters.`; pw.focus(); return; }
  if (pw.value !== $('rs-again').value) { err.textContent = "Those two passwords don't match."; $('rs-again').focus(); return; }
  const go = $('rs-go');
  go.disabled = true;
  go.textContent = 'Saving…';
  try {
    await post('/api/auth/reset', { token, password: pw.value });
    show('rs-done');
    setTimeout(() => location.replace('/'), 900);
  } catch (e2) {
    if (e2.status === 410) { show('rs-dead'); return; }
    err.textContent = e2.message;
    go.disabled = false;
    go.textContent = 'Save new password';
  }
});

start();
