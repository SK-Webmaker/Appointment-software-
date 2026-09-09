// Kai — the assistant that runs the salon when your hands are full.
//
// Say what you want. It happens, it tells you, and you can take it back.
//
// WHAT THIS PANEL IS
//
// A console, not a command bar. It has a face, a conversation, and a composer,
// because the thing it does now is not "search" — it changes what a salon
// trades on, it takes you places, and it does both from a spoken sentence. An
// owner with wet hands and a client in the chair should be able to talk to it
// across the room and see, in one glance, that the right thing happened.
//
// HOW IT DECIDES WHAT A SENTENCE IS
//
//   TYPING SEARCHES. Every keystroke asks the read-only endpoint and shows what
//   it finds — including a preview of what Enter would change or where it would
//   go. Nothing changes while you type, ever.
//   ENTER, OR A FINISHED SPOKEN SENTENCE, DOES IT. If there is nothing to do —
//   it was a question, or nonsense — the results stay and Enter falls back to
//   opening the highlighted row.
//
// That split means no classifier in the browser guessing at intent: the server
// either has something to do for the sentence or it does not.
//
// WHY IT IS SAFE TO HAVE A PERSONALITY
//
// The warm opener and the fact are two different fields (see src/kai-voice.js).
// `warm` always ends with `said`, character for character, so the charm never
// gets between the owner and the receipt. Everything Kai does here is
// reversible, it says what it did in words that can be checked at a glance, and
// Undo is one press or one word away. Where a sentence reads two ways it asks
// instead of picking — an undo does not help somebody who never realised the
// wrong thing happened.
import { esc, icon, copyText, toast, kairoOrb } from './ui.js';
import { api } from './api.js';

let el = null;
let items = [];      // search results for what is currently typed
let cursor = 0;
// Whether the owner has actually moved the highlight. Until they have, nothing
// is drawn as chosen: a chip that looks selected the instant the panel opens
// reads as a decision somebody already made for you.
let steered = false;
let seq = 0;
let turns = [];      // the conversation: what was asked, and what came back
let busy = false;
let lastUndo = null; // { title, token } — something taken back with one press
// Tokens that have already been spent. The transcript keeps every reply on
// screen, so without this an owner scrolling back finds an Undo button from
// three changes ago that can only fail.
const spent = new Set();
// The last thing the server sent, so a repaint after acting can redraw without
// a round trip and without the suggestions vanishing.
let shown = { answers: [], suggestions: [] };

const ICONS = { client: 'user', figure: 'dollar', list: 'grid', place: 'chevR',
  copy: 'link', action: 'zap', goto: 'chevR' };

const STILL = () => typeof matchMedia === 'function'
  && matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---------------------------------------------------------------------------
// The face
// ---------------------------------------------------------------------------

/** idle · thinking · listening · done — the orb and the status line together. */
function setState(state, line) {
  const orb = el?.querySelector('.kai-orb');
  if (orb) orb.dataset.state = state;
  const status = el?.querySelector('#kai-state');
  if (status && line !== undefined) status.textContent = line;
}

const READY_LINE = 'Ask for anything — it happens, and you can undo it.';

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
  return (warnings || []).filter(Boolean).map((w) => `
    <div class="kai-warn">${icon('alert', 13)} <span>${esc(w)}</span></div>`).join('');
}

/** One exchange: what the owner said, and what Kai did about it. */
function turnHtml(t, i) {
  const r = t.reply || {};
  const done = r.kind === 'done' || r.kind === 'undone';
  const went = r.kind === 'went' || r.kind === 'prepare';
  const tone = done ? 'ok' : went ? 'went' : r.kind === 'ambiguous' ? 'ask'
    : r.kind === 'unknown' ? 'no' : '';
  const mark = done ? icon('check', 13)
    : r.kind === 'prepare' ? icon('calendar', 13)
      : went ? icon('chevR', 13)
        : r.kind === 'ambiguous' ? icon('alert', 13) : icon('zap', 13);
  // The sentence is revealed a character at a time on its first paint. `full`
  // carries the whole thing so a repaint — an undo further down, a new turn —
  // redraws it complete instead of typing it out all over again.
  const text = t.typed === false ? '' : (r.warm || r.said || '');
  return `
    <div class="kai-turn" data-turn="${i}">
      <div class="kai-you"><span>${esc(t.you)}</span></div>
      <div class="kai-row">
        <div class="kai-mark ${tone}">${mark}</div>
        <div class="kai-bubble ${tone}">
          <div class="kai-said" data-full="${esc(r.warm || r.said || '')}">${esc(text)}${
  t.pending ? '<i class="kai-dots"><b></b><b></b><b></b></i>' : ''}</div>
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
        </div>
      </div>
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
    <div class="kai-item ${a.kind === 'action' ? 'kai-action' : a.kind === 'goto' ? 'kai-goto' : ''} ${i === cursor ? 'sel' : ''}" data-i="${i}">
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
    // knowing Kai can do. Shown as chips to press rather than a paragraph.
    list.innerHTML = `${convo}${standingUndoHtml()}
      ${turns.length ? '' : `<div class="kai-intro">
        <div class="kai-intro-title">Tell me what you need.</div>
        <div class="kai-intro-sub">I can change your hours, your prices, your reminders and your
          booking page, take you to any screen on any day, and answer questions about your own
          numbers. Everything I change can be undone.</div>
      </div>`}
      <div class="kai-chips">
        ${(shown.suggestions || []).map((sx, i) => `
          <button type="button" class="kai-chip ${steered && i === cursor ? 'sel' : ''}"
                  data-suggest="${esc(sx)}" data-i="${i}">${esc(sx)}</button>`).join('')}
      </div>`;
    items = (shown.suggestions || []).map((sx) => ({ kind: 'suggest', suggest: sx }));
    wire();
    scrollDown();
    return;
  }

  items = shown.answers || [];
  const found = items.length
    ? `<div class="kai-results">${items.map(rowHtml).join('')}</div>`
    : `<div class="kai-none">
        <b>Nothing to show for that yet.</b>
        <span>Press Enter and I'll try to do it. I answer questions about your own
        data too — takings, who owes you, who hasn't been in — and find people by name.</span>
      </div>`;
  list.innerHTML = convo + found;
  wire();
}

function repaintRows() {
  el.querySelectorAll('.kai-item, .kai-chip').forEach((n, i) => n.classList.toggle('sel', i === cursor));
  el.querySelector('.kai-item.sel, .kai-chip.sel')?.scrollIntoView({ block: 'nearest' });
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
  el.querySelectorAll('[data-suggest]').forEach((b) => {
    b.onclick = () => {
      const input = el.querySelector('#kai-q');
      input.value = b.dataset.suggest;
      input.focus();
      input.dispatchEvent(new Event('input'));
    };
  });
}

/**
 * Reveal Kai's sentence a character at a time.
 *
 * Pure theatre, and worth it: an answer that appears letter by letter reads as
 * somebody replying, and one that appears all at once reads as a page load.
 * Capped so a long sentence never outstays its welcome, skipped entirely for
 * anybody who has asked their system to stop moving things.
 */
function typeOut(node) {
  const full = node?.dataset.full || '';
  if (!node || !full) return;
  if (STILL()) { node.textContent = full; return; }
  const step = Math.max(6, Math.min(22, Math.round(700 / Math.max(1, full.length))));
  let i = 0;
  node.textContent = '';
  const tick = () => {
    if (!node.isConnected) return;
    i = Math.min(full.length, i + Math.ceil(full.length / (700 / step)));
    node.textContent = full.slice(0, i);
    scrollDown();
    if (i < full.length) setTimeout(tick, step);
  };
  tick();
}

// ---------------------------------------------------------------------------
// Doing
// ---------------------------------------------------------------------------

/**
 * Say something to Kai. Returns true when the server had an answer for it —
 * a change made, somewhere gone, a change taken back, a reading it wants
 * picked, or "there is nothing to undo". Only `unknown` comes back false, and
 * only that falls through to opening a search row.
 */
async function submit(text, { spoken = false } = {}) {
  const q = String(text || '').trim();
  if (!q || busy) return false;
  busy = true;
  const turn = { you: q, reply: { warm: acknowledge() }, pending: true };
  turns.push(turn);
  setState('thinking', 'Working on that…');
  paint();
  scrollDown();

  let handled = true;
  let acted = false;
  try {
    const r = await api.post('/api/ask/do', { q, turn: turns.length - 1 });
    turn.reply = r;
    turn.pending = false;
    turn.typed = false;
    if (r.kind === 'went' || r.kind === 'prepare') {
      // Moving the screen is not a change — there is nothing to undo and
      // nothing to refresh. A screen leaves the console open so the next
      // sentence can follow straight on, which is what makes a hands-free run
      // of them work.
      //
      // A prepared booking is the exception: it opens a form the owner has to
      // press a button in, and the console's own scrim sits on top of that
      // form. Handing somebody a Book button they cannot reach is worse than
      // not opening the form at all.
      acted = true;
      el.querySelector('#kai-q').value = '';
      location.hash = r.href;
      if (r.kind === 'prepare') setTimeout(close, 260);
    } else if (r.kind === 'done' || r.kind === 'undone') {
      acted = true;
      // Said out loud, "undo" takes the top of the stack — the server names
      // which one so the reply that made it can retire its own button.
      if (r.undone_token) spent.add(r.undone_token);
      lastUndo = r.undo_token ? { token: r.undo_token, title: r.did } : null;
      el.querySelector('#kai-q').value = '';
      // The rest of the workspace is showing settings that just changed.
      const { refreshAll } = await import('./app.js');
      refreshAll().catch(() => { /* the panel already said what happened */ });
    } else if (r.kind === 'unknown') {
      // Not a change. Leave the search results and let Enter open a row.
      turns.pop();
      handled = false;
    }
  } catch (err) {
    turn.reply = { said: err.message || 'That did not work.', warm: err.message || 'That did not work.' };
    turn.pending = false;
    turn.typed = false;
  }
  busy = false;
  setState('idle', READY_LINE);
  paint();
  reveal();
  if (acted) load(el.querySelector('#kai-q').value.trim());
  if (acted && spoken) speak(turns[turns.length - 1]?.reply?.said);
  return handled;
}

/** Type out whichever bubble has just landed, and mark it as typed. */
function reveal() {
  const last = turns[turns.length - 1];
  if (!last || last.typed !== false) { scrollDown(); return; }
  last.typed = true;
  const node = el.querySelector(`.kai-turn[data-turn="${turns.length - 1}"] .kai-said`);
  typeOut(node);
}

/** The opener Kai shows the instant Enter lands, before it knows the answer. */
const ON_IT = ['On it…', 'Right, one sec…', 'Doing that now…', 'Got it, one moment…'];
const acknowledge = () => ON_IT[turns.length % ON_IT.length];

async function runUndo(token) {
  if (busy) return;
  busy = true;
  setState('thinking', 'Putting that back…');
  try {
    const r = await api.post('/api/ask/undo', { token: token || '' });
    if (token) spent.add(token);
    turns.push({ you: 'Undo that', reply: { ...r, kind: 'undone', warm: r.said }, typed: false });
    lastUndo = null;
    const { refreshAll } = await import('./app.js');
    refreshAll().catch(() => {});
  } catch (err) {
    // Already taken back — most likely from a newer reply further down. Retire
    // the button rather than leaving one on screen that can only fail again.
    if (token) spent.add(token);
    const said = err.message || "There's nothing to undo.";
    turns.push({ you: 'Undo that', reply: { said, warm: said }, typed: false });
    if (lastUndo?.token === token) lastUndo = null;
  }
  busy = false;
  setState('idle', READY_LINE);
  paint();
  reveal();
}

/** The owner picked one of the readings Kai offered. */
async function pickOption(turnIndex, optionIndex) {
  const t = turns[turnIndex];
  const opt = t?.reply?.options?.[optionIndex];
  if (!opt || busy) return;
  // A reading that resolves to a screen rather than a setting — which of two
  // Sarahs to fill the booking form in for. There is nothing to apply: the
  // choice IS the destination.
  if (opt.href) {
    t.reply = { ...t.reply, options: [] };
    turns.push({
      you: opt.title,
      reply: { kind: 'prepare', said: opt.detail || 'Opening that one.', warm: opt.detail || 'Opening that one.', warnings: opt.warnings },
      typed: false,
    });
    el.querySelector('#kai-q').value = '';
    location.hash = opt.href;
    paint();
    reveal();
    load('');
    // Same reason as above: the form it just opened needs to be reachable.
    setTimeout(close, 260);
    return;
  }
  busy = true;
  setState('thinking', 'Working on that…');
  try {
    const r = await api.post('/api/ask/apply', { q: t.you, fingerprint: opt.fingerprint });
    turns.push({ you: opt.title, reply: { ...r, kind: 'done', warm: r.said }, typed: false });
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
  setState('idle', READY_LINE);
  paint();
  reveal();
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
 * instruction — the server either has something for it or it does not.
 */
async function onEnter({ spoken = false } = {}) {
  const q = el.querySelector('#kai-q').value.trim();
  if (busy) return;
  // Nothing typed: the chips on screen are the examples, so Enter fills one in
  // rather than sending an empty sentence to be interpreted.
  if (!q) { if (steered) runRow(cursor); return; }
  const handled = await submit(q, { spoken });
  if (!handled) runRow(cursor);
}

function move(by) {
  if (!items.length) return;
  // Search rows already show the top one as chosen, so an arrow advances from
  // it. Chips show nothing chosen, so the first arrow press lands ON one rather
  // than stepping past it.
  const fresh = !steered && items[0]?.kind === 'suggest';
  cursor = fresh ? (by > 0 ? 0 : items.length - 1) : (cursor + by + items.length) % items.length;
  steered = true;
  repaintRows();
}

export function close() {
  stopListening();
  el?.classList.remove('open');
  document.documentElement.classList.remove('kai-showing');
}

export function open(prefill = '') {
  if (!el) return;
  el.classList.add('open');
  document.documentElement.classList.add('kai-showing');
  const input = el.querySelector('#kai-q');
  input.value = prefill;
  cursor = 0;
  steered = false;
  setState('idle', READY_LINE);
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
      steered = false;
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
// Speaking is the whole loop: say it, it happens, it tells you. That is the
// hands-free case the owner asked for, and it works because everything Kai does
// this way can be taken back by saying "undo".

const SpeechRecognition = typeof window !== 'undefined'
  && (window.SpeechRecognition || window.webkitSpeechRecognition);
let rec = null;
let listening = false;

/**
 * Read the answer out, but only when the question was spoken.
 *
 * The FACT, not the warm version. An opener is a visual courtesy; heard out
 * loud on every single change it becomes a tic.
 */
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
  if (!busy) setState('idle', READY_LINE);
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
  setState('listening', 'Listening…');
  el.querySelector('.kai-composer').insertAdjacentHTML('beforebegin',
    '<div class="kai-listening"><i></i><i></i><i></i><i></i><i></i>'
    + '<span>Listening — say what you want, then stop talking.</span></div>');

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
    <div class="kai-panel" role="dialog" aria-label="Kai, your assistant">
      <div class="kai-head">
        <div class="kai-orb" data-state="idle">${kairoOrb(40)}</div>
        <div class="kai-who">
          <div class="kai-name">Kai</div>
          <div class="kai-state" id="kai-state" aria-live="polite">${READY_LINE}</div>
        </div>
        <button type="button" class="kai-x" data-close aria-label="Close">${icon('x', 16)}</button>
      </div>
      <div class="kai-stream" id="kai-list"></div>
      <form class="kai-composer" id="kai-form" autocomplete="off">
        <input id="kai-q" aria-label="Ask Kai"
               placeholder="Change my Sunday hours to 2 to 6…"
               autocomplete="off" spellcheck="false">
        ${SpeechRecognition
          ? `<button type="button" id="kai-mic" class="kai-mic" aria-label="Speak to Kai"
                     title="Speak to Kai">${icon('mic', 16)}</button>` : ''}
        <button type="submit" class="kai-send" aria-label="Send">${icon('send', 15)}</button>
      </form>
      <div class="kai-foot">
        <span><kbd>Enter</kbd> to do it · <kbd>↑</kbd><kbd>↓</kbd> to move · <kbd>Esc</kbd> to close</span>
        <span>Everything it changes can be undone. Nothing leaves your salon${
  SpeechRecognition ? ' except speech, which your browser transcribes' : ''}.</span>
      </div>
    </div>`;
  root.appendChild(el);

  el.querySelectorAll('[data-close]').forEach((n) => n.addEventListener('click', close));
  el.querySelector('#kai-q').addEventListener('input', (e) => load(e.target.value.trim()));
  el.querySelector('#kai-mic')?.addEventListener('click', startListening);
  el.querySelector('#kai-form').addEventListener('submit', (e) => { e.preventDefault(); onEnter(); });
  el.querySelector('#kai-list').addEventListener('click', (e) => {
    if (e.target.closest('[data-undo]') || e.target.closest('[data-pick]')
      || e.target.closest('[data-suggest]')) return;
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
