// Kai — say what you want changed, and it changes.
//
// This was a command bar that proposed things and waited for a press. The owner
// wanted an assistant: "change Sunday from 11 to 4 to 2 to 6" should make Sunday
// two till six, say so, and be done — hands free, no button. So it does.
//
// How it decides what a sentence is:
//
//   TYPING searches. Every keystroke asks the read-only endpoint and shows what
//   it finds. Nothing changes while you type, ever.
//   ENTER, or finishing a spoken sentence, tries to DO it. If there is nothing
//   to do — it was a question, or nonsense — the search results stay and Enter
//   falls back to opening the highlighted row, exactly as it used to.
//
// That split means no classifier in the browser guessing at intent: the server
// either has a change for the sentence or it does not.
//
// What keeps it safe is not that Kai is careful. It is that everything it does
// here is reversible, it says what it did in words the owner can check at a
// glance, and Undo is one press or one word away. Where a sentence reads two
// ways it asks instead of picking — an undo does not help somebody who never
// realised the wrong thing happened.
import { esc, icon, copyText, toast } from './ui.js';
import { api } from './api.js';

let el = null;
let items = [];      // search results for what is currently typed
let cursor = 0;
let seq = 0;
let turns = [];      // the conversation: what was asked, and what came back
let busy = false;
let lastUndo = null; // { title, token } — something taken back with one press
// Tokens that have already been spent. The transcript keeps every reply on
// screen, so without this an owner scrolling back finds an Undo button from
// three changes ago that can only fail.
const spent = new Set();
// The last thing the server sent. Kept so a repaint after acting can redraw the
// panel without a round trip, and without the suggestions vanishing because the
// repaint had nothing to draw them from.
let shown = { answers: [], suggestions: [] };

const ICONS = { client: 'user', figure: 'dollar', list: 'grid', place: 'chevR', copy: 'link', action: 'zap' };

// ---------------------------------------------------------------------------
// Drawing
// ---------------------------------------------------------------------------

function changesHtml(changes) {
  return (changes || []).map((c) => `
    <div class="kai-change">
      <span class="kc-day">${esc(c.label)}</span>
      <span class="kc-from">${esc(c.from)}</span>
      <span class="kc-arrow">→</span>
      <span class="kc-to">${esc(c.to)}</span>
    </div>`).join('');
}

function warningsHtml(warnings) {
  return (warnings || []).map((w) => `
    <div class="kai-warn">${icon('alert', 13)} <span>${esc(w)}</span></div>`).join('');
}

/** One exchange: what the owner said, and what Kai did about it. */
function turnHtml(t, i) {
  const r = t.reply || {};
  const done = r.kind === 'done' || r.kind === 'undone';
  return `
    <div class="kai-turn">
      <div class="kai-you">${esc(t.you)}</div>
      <div class="kai-said ${done ? 'ok' : r.kind === 'ambiguous' ? 'ask' : ''}">
        ${done ? icon('check', 14) : r.kind === 'ambiguous' ? icon('alert', 14) : icon('zap', 14)}
        <span>${esc(r.said || '…')}</span>
      </div>
      ${changesHtml(r.changes)}
      ${warningsHtml(r.warnings)}
      ${(r.options || []).length ? `
        <div class="kai-options">
          ${r.options.map((o, k) => `
            <button type="button" class="btn small" data-pick="${i}:${k}">
              ${esc(o.title)}</button>`).join('')}
        </div>` : ''}
      ${r.undo_token && !spent.has(r.undo_token) ? `
        <div class="kai-undo-row">
          <button type="button" class="btn small" data-undo="${esc(r.undo_token)}">
            ${icon('back', 13)} Undo that</button>
          <span class="kai-do-note">or just say “undo”</span>
        </div>` : ''}
    </div>`;
}

function rowHtml(a, i) {
  const rows = (a.rows || []).slice(0, 5).map((r) => `
    <div class="kai-sub">
      <span class="kai-sub-l">${esc(r.label)}</span>
      <span class="kai-sub-s">${esc(r.sub || '')}</span>
      <span class="kai-sub-v">${esc(r.value || '')}</span>
    </div>`).join('');
  return `
    <div class="kai-item ${a.kind === 'action' ? 'kai-action' : ''} ${i === cursor ? 'sel' : ''}" data-i="${i}">
      <span class="kai-ico">${icon(ICONS[a.kind] || 'zap', 15)}</span>
      <span class="kai-body">
        <span class="kai-title">${esc(a.title)}</span>
        ${a.detail ? `<span class="kai-detail">${esc(a.detail)}</span>` : ''}
        ${rows}
      </span>
      ${a.matched ? `<span class="kai-matched">${esc(a.matched)}</span>` : ''}
    </div>`;
}

/**
 * A standing "you can still take that back" — shown when the last change came
 * from an earlier visit rather than from a turn on screen. Acting immediately
 * is only fair if undo outlives the panel being closed.
 */
function standingUndoHtml() {
  if (!lastUndo?.token || spent.has(lastUndo.token)) return '';
  if (turns.some((t) => t.reply?.undo_token === lastUndo.token)) return '';
  return `
    <div class="kai-undo-row standing">
      <button type="button" class="btn small" data-undo="${esc(lastUndo.token)}">
        ${icon('back', 13)} Undo</button>
      <span class="kai-do-note">${esc(lastUndo.title || 'your last change')}</span>
    </div>`;
}

function paint(data) {
  if (data) shown = data;
  const list = el.querySelector('#kai-list');
  const q = el.querySelector('#kai-q').value.trim();
  const convo = turns.length ? `<div class="kai-convo">${turns.map(turnHtml).join('')}</div>` : '';

  if (!q) {
    // Before anything is typed: the conversation so far, then the things worth
    // knowing Kai can do. Shown as examples to press rather than a paragraph.
    list.innerHTML = `${convo}${standingUndoHtml()}
      <div class="kai-hint">Ask for it in your own words — it happens, and you can undo it.</div>
      ${(shown.suggestions || []).map((sx, i) => `
        <div class="kai-item ${i === cursor ? 'sel' : ''}" data-suggest="${esc(sx)}" data-i="${i}">
          <span class="kai-ico">${icon('search', 15)}</span>
          <span class="kai-body"><span class="kai-title">${esc(sx)}</span></span>
        </div>`).join('')}`;
    items = (shown.suggestions || []).map((sx) => ({ kind: 'suggest', suggest: sx }));
    wire();
    scrollDown();
    return;
  }

  items = shown.answers || [];
  const found = items.length
    ? items.map(rowHtml).join('')
    : `<div class="kai-none">
        <b>Nothing to show for that yet.</b>
        <span>Press Enter and Kai will try to do it. It answers questions about your own
        data too — takings, who owes you, who hasn't been in — and finds people by name.</span>
      </div>`;
  list.innerHTML = convo + found;
  wire();
}

function repaintRows() {
  el.querySelectorAll('.kai-item').forEach((n, i) => n.classList.toggle('sel', i === cursor));
  el.querySelector('.kai-item.sel')?.scrollIntoView({ block: 'nearest' });
}

const scrollDown = () => {
  const list = el.querySelector('#kai-list');
  if (list) list.scrollTop = list.scrollHeight;
};

function wire() {
  el.querySelectorAll('[data-undo]').forEach((b) => {
    b.onclick = (e) => { e.stopPropagation(); runUndo(b.dataset.undo); };
  });
  el.querySelectorAll('[data-pick]').forEach((b) => {
    b.onclick = (e) => {
      e.stopPropagation();
      const [ti, oi] = b.dataset.pick.split(':').map(Number);
      pickOption(ti, oi);
    };
  });
}

// ---------------------------------------------------------------------------
// Doing
// ---------------------------------------------------------------------------

/**
 * Say something to Kai. Returns true when the server had an answer for it —
 * a change made, a change taken back, a reading it wants picked, or "there is
 * nothing to undo". Only `unknown` comes back false, and only that falls
 * through to opening a search row.
 */
async function submit(text, { spoken = false } = {}) {
  const q = String(text || '').trim();
  if (!q || busy) return false;
  busy = true;
  const turn = { you: q, reply: { said: 'Working on it…' } };
  turns.push(turn);
  paint();
  scrollDown();

  let handled = true;
  let acted = false;
  try {
    const r = await api.post('/api/ask/do', { q });
    turn.reply = r;
    if (r.kind === 'done' || r.kind === 'undone') {
      acted = true;
      // Said out loud, "undo" takes the top of the stack — the server names
      // which one so the reply that made it can retire its own button.
      if (r.undone_token) spent.add(r.undone_token);
      lastUndo = r.undo_token ? { token: r.undo_token, title: r.did } : null;
      el.querySelector('#kai-q').value = '';
      // The rest of the workspace is showing settings that just changed.
      const { refreshAll } = await import('./app.js');
      refreshAll().catch(() => { /* the bar already said what happened */ });
    } else if (r.kind === 'unknown') {
      // Not a change. Leave the search results and let Enter open a row.
      turns.pop();
      handled = false;
    }
  } catch (err) {
    turn.reply = { said: err.message || 'That did not work.' };
  }
  busy = false;
  paint();
  scrollDown();
  if (acted) load(el.querySelector('#kai-q').value.trim());
  if (acted && spoken) speak(turns[turns.length - 1]?.reply?.said);
  return handled;
}

async function runUndo(token) {
  if (busy) return;
  busy = true;
  try {
    const r = await api.post('/api/ask/undo', { token: token || '' });
    if (token) spent.add(token);
    turns.push({ you: 'Undo that', reply: { ...r, kind: 'undone' } });
    lastUndo = null;
    const { refreshAll } = await import('./app.js');
    refreshAll().catch(() => {});
  } catch (err) {
    // Already taken back — most likely from a newer reply further down. Retire
    // the button rather than leaving one on screen that can only fail again.
    if (token) spent.add(token);
    turns.push({ you: 'Undo that', reply: { said: err.message || "There's nothing to undo." } });
    if (lastUndo?.token === token) lastUndo = null;
  }
  busy = false;
  paint();
  scrollDown();
}

/** The owner picked one of the readings Kai offered. */
async function pickOption(turnIndex, optionIndex) {
  const t = turns[turnIndex];
  const opt = t?.reply?.options?.[optionIndex];
  if (!opt || busy) return;
  busy = true;
  try {
    const r = await api.post('/api/ask/apply', { q: t.you, fingerprint: opt.fingerprint });
    turns.push({ you: opt.title, reply: { ...r, kind: 'done' } });
    lastUndo = r.undo_token ? { token: r.undo_token, title: r.did } : null;
    // The question has been answered, so retire the options rather than leaving
    // a second live "which did you mean?" further up the transcript.
    t.reply = { ...t.reply, options: [] };
    el.querySelector('#kai-q').value = '';
    const { refreshAll } = await import('./app.js');
    refreshAll().catch(() => {});
  } catch (err) {
    toast(err.message, 'err');
  }
  busy = false;
  paint();
  scrollDown();
  load('');
}

/** Do the thing the highlighted row offers — the search half, unchanged. */
async function runRow(i) {
  const a = items[i];
  if (!a) return;
  if (a.kind === 'suggest') {
    const input = el.querySelector('#kai-q');
    input.value = a.suggest;
    input.dispatchEvent(new Event('input'));
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

/**
 * Enter: try to do it; if there is nothing to do, open the highlighted row.
 *
 * No guessing in the browser about whether a sentence is a question or an
 * instruction — the server either has a change for it or it does not.
 */
async function onEnter({ spoken = false } = {}) {
  const q = el.querySelector('#kai-q').value.trim();
  if (busy) return;
  // Nothing typed: the rows on screen are the examples, so Enter fills one in
  // rather than sending an empty sentence to be interpreted.
  if (!q) { runRow(cursor); return; }
  const handled = await submit(q, { spoken });
  if (!handled) runRow(cursor);
}

function move(by) {
  if (!items.length) return;
  cursor = (cursor + by + items.length) % items.length;
  repaintRows();
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
      // The server is the authority on whether anything is still undoable — a
      // stale token left here would draw an Undo button that refuses.
      lastUndo = data?.undo ? { token: data.undo.token, title: data.undo.title } : null;
      paint(data || { answers: [], suggestions: [] });
    } catch {
      if (mine !== seq) return;
      paint({ answers: [], suggestions: shown.suggestions || [] });
    }
  }, q ? 160 : 0);
}

// ---------------------------------------------------------------------------
// Speaking and being spoken to
// ---------------------------------------------------------------------------
//
// The browser's own dictation and its own voice. Both cost nothing and add no
// dependency — this ships without a package manager and is not growing one for
// a microphone. Where a browser cannot hear, the button is not drawn rather
// than drawn and broken.
//
// Speaking is now the whole loop: say it, it happens, it tells you. That is the
// hands-free case the owner asked for, and it works because everything Kai does
// this way can be taken back by saying "undo".

const SpeechRecognition = typeof window !== 'undefined'
  && (window.SpeechRecognition || window.webkitSpeechRecognition);
let rec = null;
let listening = false;

/** Read the answer out, but only when the question was spoken. */
function speak(text) {
  if (!text || typeof speechSynthesis === 'undefined') return;
  try {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(String(text));
    u.lang = navigator.language || 'en-AU';
    u.rate = 1.05;
    speechSynthesis.speak(u);
  } catch { /* a salon with no voice still sees the answer on screen */ }
}

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
  el.querySelector('#kai-mic').classList.add('on');
  listening = true;
  el.querySelector('.kai-bar').insertAdjacentHTML('afterend',
    '<div class="kai-listening">Listening… say what you want changed, then stop talking.</div>');

  rec.onresult = (e) => {
    let text = '';
    let final = false;
    for (let i = e.resultIndex; i < e.results.length; i++) {
      text += e.results[i][0].transcript;
      if (e.results[i].isFinal) final = true;
    }
    input.value = text.trim();
    if (final) {
      stopListening();
      // The sentence is finished, so this is the moment it counts — the same
      // as pressing Enter, which is what makes the loop hands-free.
      onEnter({ spoken: true });
    } else {
      load(input.value);
    }
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
        <input id="kai-q" placeholder="Tell Kai what to change — “Sunday 2 to 6”, “close Mondays”…"
               autocomplete="off" spellcheck="false">
        ${SpeechRecognition
          ? `<button type="button" id="kai-mic" class="kai-mic" aria-label="Speak to Kai"
                     title="Speak to Kai">${icon('mic', 16)}</button>` : ''}
        <kbd>Esc</kbd>
      </div>
      <div class="kai-list" id="kai-list"></div>
      <div class="kai-foot">
        <span><kbd>Enter</kbd> to do it · <kbd>↑</kbd><kbd>↓</kbd> to move</span>
        <span>Everything it changes can be undone. Nothing leaves your salon${
          SpeechRecognition ? ' except speech, which your browser transcribes' : ''}.</span>
      </div>
    </div>`;
  root.appendChild(el);

  el.querySelector('[data-close]').addEventListener('click', close);
  el.querySelector('#kai-q').addEventListener('input', (e) => load(e.target.value.trim()));
  el.querySelector('#kai-mic')?.addEventListener('click', startListening);
  el.querySelector('#kai-list').addEventListener('click', (e) => {
    if (e.target.closest('[data-undo]') || e.target.closest('[data-pick]')) return;
    const row = e.target.closest('.kai-item');
    if (row) { cursor = Number(row.dataset.i); runRow(cursor); }
  });

  el.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { close(); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); move(1); return; }
    if (e.key === 'ArrowUp') { e.preventDefault(); move(-1); return; }
    if (e.key === 'Enter') { e.preventDefault(); onEnter(); }
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
