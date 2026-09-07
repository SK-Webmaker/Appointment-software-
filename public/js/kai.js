// Kai — the bar you open with ⌘K and ask a question, in words of your own.
//
// The top bar carried a search box reading "Search clients, invoices…" from the
// beginning. It never searched invoices; pressing Enter jumped to the clients
// page with a query string, and that was the whole of it. This is what went
// behind it, and it now does two things rather than one:
//
//   FINDS. Takings, who owes, who has drifted, no-shows, today's diary, the
//   booking link, anybody by name, and every settings page under the words an
//   owner would actually use. Asked in a sentence — "what did we take last week
//   for Monday and Tuesday" — rather than in the phrasing Kai happens to know.
//
//   CHANGES. Opening days and hours, by asking for them.
//
// That second one is why the rules below are stricter than they look:
//
//   1. AN ANSWER IS FREE; A CHANGE IS NOT. Navigating happens on one press.
//      Changing a setting needs its own deliberate press, on a card that has
//      already shown what it would change and what it would change it from.
//   2. NEVER GO BLANK. A bar that returns nothing has taught the owner not to
//      open it again. When Kai does not understand, it says so plainly and
//      offers what it does understand.
//   3. THE MICROPHONE ONLY TYPES. Speaking fills the bar and searches, exactly
//      as typing would. It can never be the thing that presses Confirm — a
//      misheard "close on Mondays" would otherwise cost a salon a week.
import { esc, icon, copyText, toast } from './ui.js';
import { api } from './api.js';

let el = null;
let items = [];
let cursor = 0;
let seq = 0;
// The row an owner has pressed Enter on once. Enter again applies it. Same
// two-step as cancelling an appointment, for the same reason: the highlight can
// move under you, and a single keystroke should not be able to shut a salon.
let armed = -1;

const ICONS = { client: 'user', figure: 'dollar', list: 'grid', place: 'chevR', copy: 'link', action: 'zap' };

function actionHtml(a, i) {
  const changes = (a.rows || []).map((r) => `
    <div class="kai-change">
      <span class="kc-day">${esc(r.label)}</span>
      <span class="kc-from">${esc(r.sub)}</span>
      <span class="kc-arrow">→</span>
      <span class="kc-to">${esc(r.value)}</span>
    </div>`).join('');
  const warnings = (a.plan?.warnings || []).map((w) => `
    <div class="kai-warn">${icon('alert', 13)} <span>${esc(w)}</span></div>`).join('');
  return `
    <div class="kai-item kai-action ${i === cursor ? 'sel' : ''}" data-i="${i}">
      <span class="kai-ico">${icon('zap', 15)}</span>
      <span class="kai-body">
        <span class="kai-title">${esc(a.title)}</span>
        ${a.detail ? `<span class="kai-detail">${esc(a.detail)}</span>` : ''}
        ${changes}
        ${warnings}
        <span class="kai-do">
          <button type="button" class="btn small primary" data-apply="${i}">
            ${icon('check', 13)} Make this change</button>
          <span class="kai-do-note">${i === armed
            ? 'Press Enter again to make it'
            : 'Nothing changes until you press this'}</span>
        </span>
      </span>
      <span class="kai-matched">${esc(a.matched || 'a change')}</span>
    </div>`;
}

function rowHtml(a, i) {
  if (a.kind === 'action') return actionHtml(a, i);
  const rows = a.rows.slice(0, 5).map((r) => `
    <div class="kai-sub">
      <span class="kai-sub-l">${esc(r.label)}</span>
      <span class="kai-sub-s">${esc(r.sub || '')}</span>
      <span class="kai-sub-v">${esc(r.value || '')}</span>
    </div>`).join('');
  return `
    <div class="kai-item ${i === cursor ? 'sel' : ''}" data-i="${i}">
      <span class="kai-ico">${icon(ICONS[a.kind] || 'zap', 15)}</span>
      <span class="kai-body">
        <span class="kai-title">${esc(a.title)}</span>
        ${a.detail ? `<span class="kai-detail">${esc(a.detail)}</span>` : ''}
        ${rows}
      </span>
      ${a.matched ? `<span class="kai-matched">${esc(a.matched)}</span>` : ''}
    </div>`;
}

function paint(data) {
  const list = el.querySelector('#kai-list');
  const q = el.querySelector('#kai-q').value.trim();

  if (!q) {
    // Before anything is typed: the questions worth knowing Kai can answer.
    // Shown as examples to press rather than described in a paragraph nobody
    // reads.
    list.innerHTML = `
      <div class="kai-hint">Ask in your own words — nothing here leaves your salon.</div>
      ${(data.suggestions || []).map((sx, i) => `
        <div class="kai-item ${i === cursor ? 'sel' : ''}" data-suggest="${esc(sx)}" data-i="${i}">
          <span class="kai-ico">${icon('search', 15)}</span>
          <span class="kai-body"><span class="kai-title">${esc(sx)}</span></span>
        </div>`).join('')}`;
    items = (data.suggestions || []).map((sx) => ({ kind: 'suggest', suggest: sx }));
    return;
  }

  items = data.answers || [];
  if (!items.length) {
    list.innerHTML = `
      <div class="kai-none">
        <b>Kai didn't understand that one.</b>
        <span>It answers questions about your own data — takings, who owes you, who hasn't
        been in, no-shows, your booking link — finds people by name, and can change your
        opening days and hours if you ask it to. It never guesses.</span>
      </div>`;
    return;
  }
  list.innerHTML = items.map(rowHtml).join('');
  wireApply();
}

/** Send one proposed change back to be done. */
async function applyPlan(i) {
  const a = items[i];
  if (!a?.plan) return;
  const btn = el.querySelector(`[data-apply="${i}"]`);
  if (btn) btn.disabled = true;
  try {
    // The sentence goes back with it. The server re-reads it and checks the
    // fingerprint still describes the settings as they stand — so this cannot
    // apply a change Kai never offered, nor one built against hours that have
    // since moved.
    const res = await api.post('/api/ask/apply', {
      q: el.querySelector('#kai-q').value.trim(),
      fingerprint: a.plan.fingerprint,
    });
    close();
    toast(res.applied || 'Done', 'ok');
    const { refreshAll } = await import('./app.js');
    await refreshAll();
  } catch (err) {
    if (btn) btn.disabled = false;
    armed = -1;
    toast(err.message, 'err');
  }
}

function wireApply() {
  el.querySelectorAll('[data-apply]').forEach((b) => {
    b.addEventListener('click', (e) => {
      e.stopPropagation();
      applyPlan(Number(b.dataset.apply));
    });
  });
}

/** Do the thing the highlighted row offers. Always a press, never automatic. */
async function run(i) {
  const a = items[i];
  if (!a) return;
  if (a.kind === 'suggest') {
    const input = el.querySelector('#kai-q');
    input.value = a.suggest;
    input.dispatchEvent(new Event('input'));
    return;
  }
  if (a.kind === 'action') {
    // Two presses, deliberately. The first says "this one"; the second does it.
    if (armed !== i) { armed = i; repaintRows(); return; }
    await applyPlan(i);
    return;
  }
  if (a.copy) {
    const done = await copyText(a.copy);
    toast(done ? 'Booking link copied' : 'Copy it from the bar', done ? 'ok' : 'err');
    close();
    return;
  }
  if (a.href) {
    location.hash = a.href;
    close();
  }
}

function repaintRows() {
  const list = el.querySelector('#kai-list');
  list.innerHTML = items.map(rowHtml).join('');
  wireApply();
}

function move(by) {
  if (!items.length) return;
  cursor = (cursor + by + items.length) % items.length;
  // Moving off an armed change disarms it: the press that armed it was about
  // the row that was highlighted then, not whichever one is now.
  if (armed !== cursor) armed = -1;
  repaintRows();
  el.querySelector('.kai-item.sel')?.scrollIntoView({ block: 'nearest' });
}

export function close() {
  stopListening();
  el?.classList.remove('open');
  document.documentElement.classList.remove('kai-open');
}

export function open(prefill = '') {
  if (!el) return;
  el.classList.add('open');
  document.documentElement.classList.add('kai-open');
  const input = el.querySelector('#kai-q');
  input.value = prefill;
  cursor = 0;
  armed = -1;
  input.focus();
  input.select();
  load(prefill);
}

let timer;
function load(q) {
  clearTimeout(timer);
  // Debounced, and every reply carries the sequence number of the request that
  // asked for it. Without that, a slow answer to "sar" lands after the fast one
  // to "sarah" and the owner watches their results go backwards.
  const mine = ++seq;
  timer = setTimeout(async () => {
    try {
      const data = await api.get(`/api/ask?q=${encodeURIComponent(q)}`);
      if (mine !== seq) return;
      cursor = 0;
      armed = -1;
      paint(data || { answers: [], suggestions: [] });
    } catch {
      if (mine !== seq) return;
      paint({ answers: [], suggestions: [] });
    }
  }, q ? 160 : 0);
}

// ---------------------------------------------------------------------------
// Speaking to it
// ---------------------------------------------------------------------------
//
// The browser's own dictation, which costs nothing and adds no dependency —
// this product ships without a package manager and is not going to grow one for
// a microphone. Where a browser has no speech recognition the button simply is
// not drawn, rather than appearing and failing.
//
// It fills the bar and searches. That is all it does. It cannot press Confirm
// on a change: a misheard "close on Mondays" that acted on its own would cost a
// salon a week of bookings, and no amount of accuracy makes that an acceptable
// thing to risk.

const SpeechRecognition = typeof window !== 'undefined'
  && (window.SpeechRecognition || window.webkitSpeechRecognition);
let rec = null;
let listening = false;

function stopListening() {
  if (rec && listening) { try { rec.stop(); } catch { /* already stopped */ } }
  listening = false;
  el?.querySelector('#kai-mic')?.classList.remove('on');
  el?.querySelector('.kai-listening')?.remove();
}

function startListening() {
  if (!SpeechRecognition) return;
  if (listening) { stopListening(); return; }

  rec = new SpeechRecognition();
  rec.lang = navigator.language || 'en-AU';
  rec.interimResults = true;
  rec.continuous = false;
  rec.maxAlternatives = 1;

  const input = el.querySelector('#kai-q');
  const mic = el.querySelector('#kai-mic');
  mic.classList.add('on');
  listening = true;
  el.querySelector('.kai-bar').insertAdjacentHTML('afterend',
    '<div class="kai-listening">Listening… say what you want, then stop talking.</div>');

  rec.onresult = (e) => {
    let text = '';
    let final = false;
    for (let i = e.resultIndex; i < e.results.length; i++) {
      text += e.results[i][0].transcript;
      if (e.results[i].isFinal) final = true;
    }
    input.value = text.trim();
    // Searched as they speak, so the answer is already there when they stop.
    load(input.value);
    if (final) stopListening();
  };
  rec.onerror = (e) => {
    stopListening();
    if (e.error === 'no-speech') { toast("Didn't catch that — try again", 'err'); return; }
    if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
      toast('Your browser blocked the microphone — allow it and try again', 'err');
      return;
    }
    if (e.error !== 'aborted') toast('The microphone stopped working', 'err');
  };
  rec.onend = () => stopListening();

  try { rec.start(); } catch { stopListening(); }
}

export function mountKai(root) {
  el = document.createElement('div');
  el.className = 'kai';
  el.innerHTML = `
    <div class="kai-scrim" data-close></div>
    <div class="kai-panel" role="dialog" aria-label="Ask Kai">
      <div class="kai-bar">
        ${icon('zap', 16)}
        <input id="kai-q" placeholder="Ask Kai — what did we take last week, open Friday 11 to 2…"
               autocomplete="off" spellcheck="false">
        ${SpeechRecognition
          ? `<button type="button" id="kai-mic" class="kai-mic" aria-label="Speak to Kai"
                     title="Speak to Kai">${icon('mic', 16)}</button>` : ''}
        <kbd>Esc</kbd>
      </div>
      <div class="kai-list" id="kai-list"></div>
      <div class="kai-foot">
        <span><kbd>↑</kbd><kbd>↓</kbd> to move · <kbd>Enter</kbd> to open</span>
        <span>Answered from your own data. Nothing is sent anywhere${
          SpeechRecognition ? ', except speech, which your browser transcribes' : ''}.</span>
      </div>
    </div>`;
  root.appendChild(el);

  el.querySelector('[data-close]').addEventListener('click', close);
  el.querySelector('#kai-q').addEventListener('input', (e) => load(e.target.value.trim()));
  el.querySelector('#kai-mic')?.addEventListener('click', startListening);
  el.querySelector('#kai-list').addEventListener('click', (e) => {
    if (e.target.closest('[data-apply]')) return; // its own handler ran already
    const row = e.target.closest('.kai-item');
    if (row) { cursor = Number(row.dataset.i); run(cursor); }
  });

  el.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { close(); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); move(1); return; }
    if (e.key === 'ArrowUp') { e.preventDefault(); move(-1); return; }
    if (e.key === 'Enter') { e.preventDefault(); run(cursor); }
  });

  // ⌘K on a Mac, Ctrl+K everywhere else — the shortcut every command bar uses,
  // and the letter Kai is named after. "/" too, for people who live in Gmail.
  document.addEventListener('keydown', (e) => {
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) || e.target.isContentEditable;
    if ((e.key === 'k' || e.key === 'K') && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      el.classList.contains('open') ? close() : open();
      return;
    }
    if (e.key === '/' && !typing && !el.classList.contains('open')) {
      e.preventDefault();
      open();
    }
  });
}
