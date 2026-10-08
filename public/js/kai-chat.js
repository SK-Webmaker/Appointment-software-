// Kai, full screen: talk to the salon and it does the work.
//
// The whole screen, on purpose. This is where an owner runs the business by
// talking — "add a note to Jane", "move Tom's 3 o'clock to Friday", "what did
// we take last week" — so it gets the room a conversation needs, on a phone as
// much as on a laptop.
//
// WHAT THE OWNER SEES
//
//   Kai's words, in plain sentences.
//   A receipt for every change, in the order it happened: ✓ "Book Jane Smith,
//   Cut, Fri 3 Oct 10:00 am" — or ✕ with the reason it was refused.
//   A card with Confirm / Don't for anything that deletes, messages a client
//   or moves money. Nothing behind that card runs until Confirm is pressed.
//   A link to any screen Kai opened, which also changes the page underneath.
//
// Conversations are kept (the list on the left), and the page underneath is
// refreshed when the chat closes, so what Kai changed is what the owner sees.
import { esc, icon, kairoOrb, toast } from './ui.js';
import { api } from './api.js';

let el = null;
let ready = false;        // the server has an agent key
let consented = false;    // this owner has said yes to sharing with Anthropic
let chatId = null;
let events = [];
let working = false;
let changed = false;      // something was written — refresh the page on close
let chats = [];

// Not inside the iPhone app: its web view would need microphone and speech
// permissions the app does not ask for, and the iPhone keyboard's own
// dictation button already does this job there.
const SpeechRecognition = typeof window !== 'undefined' && !window.kairoNative
  && (window.SpeechRecognition || window.webkitSpeechRecognition);

const SUGGESTIONS = [
  "What's on today?",
  'Add a note to a client',
  'Book a client in for tomorrow',
  'Block out Friday afternoon',
  'How did last week go?',
  "Who hasn't been back in a while?",
];

export const agentReady = () => ready;

// ── Text ──────────────────────────────────────────────────────────────────────

/** Kai's replies: paragraphs, "- " lists, **bold**, `code`. Escaped first, always. */
function md(text) {
  const inline = (s) => esc(s)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code>$1</code>');
  const out = [];
  let list = null;
  for (const line of String(text).split('\n')) {
    const item = line.match(/^\s*(?:[-•*]|\d+[.)])\s+(.*)$/);
    if (item) { (list ||= []).push(`<li>${inline(item[1])}</li>`); continue; }
    if (list) { out.push(`<ul>${list.join('')}</ul>`); list = null; }
    if (line.trim() === '') { out.push(''); continue; }
    out.push(`<p>${inline(line)}</p>`);
  }
  if (list) out.push(`<ul>${list.join('')}</ul>`);
  return out.join('');
}

const PAGE_NAMES = {
  dashboard: 'Dashboard', calendar: 'Calendar', clients: 'Clients', services: 'Services', products: 'Products',
  pos: 'Point of Sale', invoices: 'Billing', messages: 'Messages', reviews: 'Reviews', growth: 'Growth',
  staff: 'Team', settings: 'Settings', account: 'Account', enquiries: 'Enquiries',
};
const hashFor = (e) => {
  const q = new URLSearchParams(e.params || {}).toString();
  return `#/${e.page}${q ? `?${q}` : ''}`;
};

// ── Drawing ──────────────────────────────────────────────────────────────────

function eventHtml(e, i) {
  switch (e.t) {
    case 'user':
      return `<div class="kc-msg kc-you"><div class="kc-bubble">${esc(e.text)}</div></div>`;
    case 'kai':
      return `<div class="kc-msg kc-kai"><div class="kc-ava">${kairoOrb(26, `kc${i}`)}</div><div class="kc-bubble">${md(e.text)}</div></div>`;
    case 'act':
      return `<div class="kc-act ${e.ok ? 'ok' : 'bad'}">${icon(e.ok ? 'check' : 'x', 13)}<span>${esc(e.summary)}${
        !e.ok && e.error ? ` <em>— ${esc(e.error)}</em>` : ''}</span></div>`;
    case 'nav':
      return `<div class="kc-act kc-open-page">${icon('external', 13)}<span>Opened ${esc(PAGE_NAMES[e.page] || e.page)}${
        e.label ? ` · ${esc(e.label)}` : ''}</span><button type="button" class="kc-go" data-go="${esc(hashFor(e))}">Show me</button></div>`;
    case 'confirm':
      return `<div class="kc-confirm ${esc(e.state)}" data-confirm="${esc(e.id)}">
        <div class="kc-confirm-head">${icon(e.state === 'done' ? 'check' : e.state === 'declined' ? 'x' : 'shield', 15)}
          <b>${e.state === 'done' ? 'Done' : e.state === 'declined' ? 'Not done' : 'Kai needs your OK'}</b></div>
        <ul>${e.items.map((x) => `<li>${esc(x.summary)}</li>`).join('')}</ul>
        ${e.state === 'waiting' ? `<div class="kc-confirm-actions">
          <button type="button" class="btn primary" data-approve="1">${icon('check', 14)} Confirm</button>
          <button type="button" class="btn ghost" data-approve="0">Don't</button></div>` : ''}
      </div>`;
    case 'error':
      return `<div class="kc-act bad">${icon('alert', 13)}<span>${esc(e.text)}</span></div>`;
    default:
      return '';
  }
}

function emptyHtml() {
  return `<div class="kc-empty">
    <div class="kc-empty-orb">${kairoOrb(72, 'kc-empty')}</div>
    <h2>What can I do for you?</h2>
    <p>Ask me anything about the business, or tell me what to change — book, move or cancel
      appointments, add notes, update prices and hours, chase invoices. I'll do it and show you what I did.</p>
    <div class="kc-chips">${SUGGESTIONS.map((s) => `<button type="button" class="kai-chip" data-suggest="${esc(s)}">${esc(s)}</button>`).join('')}</div>
  </div>`;
}

/**
 * Before the first message: what Kai shares, with whom, and a real choice.
 * Nothing the owner types reaches Anthropic until "Turn on Kai" is pressed
 * (the server refuses with 428 until then, too).
 */
function consentHtml() {
  return `<div class="kc-empty kc-consent">
    <div class="kc-empty-orb">${kairoOrb(72, 'kc-consent')}</div>
    <h2>Before you start</h2>
    <p>Kai runs on <b>Claude</b>, an AI made by <b>Anthropic</b>. To do what you ask, what you type to Kai
      and the records it looks up or changes for you — for example a client's name, appointments or
      notes — are sent to Anthropic in the United States. Anthropic processes them only to answer you
      and doesn't use them to train its AI.</p>
    <p>Nothing is sent until you turn Kai on, and you can turn it off at any time.${window.kairoNative ? ''
      // Not in the iPhone app: the website it opens also sells Kairo, and the
      // app links to nothing that sells (App Review 3.1.1).
      : ' <a href="https://kairobookings.com/legal/sub-processors" target="_blank" rel="noreferrer">Who sees what</a>'}</p>
    <div class="kc-consent-actions">
      <button type="button" class="btn primary" data-consent="yes">${icon('check', 14)} Turn on Kai</button>
      <button type="button" class="btn ghost" data-consent="no">Not now</button>
    </div>
  </div>`;
}

function paint({ scroll = true } = {}) {
  const stream = el.querySelector('#kc-stream');
  el.classList.toggle('needs-consent', !consented);
  if (!consented) {
    stream.innerHTML = consentHtml();
    setStatus('Needs your OK');
    return;
  }
  stream.innerHTML = events.length
    ? events.map(eventHtml).join('') + (working ? `<div class="kc-msg kc-kai kc-typing"><div class="kc-ava">${kairoOrb(26, 'kc-t')}</div>
        <div class="kc-bubble"><span class="kc-dots"><i></i><i></i><i></i></span></div></div>` : '')
    : emptyHtml();
  const waiting = events.some((e) => e.t === 'confirm' && e.state === 'waiting');
  setStatus(working ? 'Working on it…' : waiting ? 'Waiting for your OK' : 'Ready');
  el.querySelector('#kc-send').disabled = working;
  if (scroll) stream.scrollTop = stream.scrollHeight;
}

function setStatus(line) {
  const s = el.querySelector('#kc-status');
  if (s) s.textContent = line;
  const orb = el.querySelector('.kc-head .kai-orb');
  if (orb) orb.dataset.state = working ? 'thinking' : 'idle';
}

function paintList() {
  const list = el.querySelector('#kc-list');
  list.innerHTML = chats.length
    ? chats.map((c) => `<div class="kc-item${c.id === chatId ? ' on' : ''}" data-chat="${c.id}">
        <span>${esc(c.title || 'Conversation')}</span>
        <button type="button" class="kc-del" data-del="${c.id}" aria-label="Delete this conversation" title="Delete">${icon('trash', 13)}</button>
      </div>`).join('')
    : '<div class="kc-none">Your conversations with Kai will be kept here.</div>';
}

async function refreshList() {
  try { chats = (await api.get('/api/kai/chats')).chats || []; } catch { chats = []; }
  paintList();
}

// ── Doing ────────────────────────────────────────────────────────────────────

function absorb(r) {
  chatId = r.chat_id;
  // The server echoes the owner's own line first; it is already on screen.
  const fresh = r.events.filter((e, i) => !(i === 0 && e.t === 'user'));
  for (const e of fresh) {
    if (e.t === 'act' && e.ok) changed = true;
    if (e.t === 'nav') { location.hash = hashFor(e); }
  }
  events.push(...fresh);
}

async function send(text) {
  text = text.trim();
  if (!text || working) return;
  events.push({ t: 'user', text });
  // Typing instead of answering a Confirm is a no — show it as one at once.
  for (const e of events) if (e.t === 'confirm' && e.state === 'waiting') e.state = 'declined';
  working = true;
  paint();
  try {
    const r = await api.post('/api/kai/chats', { message: text, ...(chatId ? { chat_id: chatId } : {}) });
    absorb(r);
    refreshList();
  } catch (err) {
    if (err.status === 428) { consented = false; events.pop(); return; }
    events.push({ t: 'error', text: err.message || "Couldn't reach Kai — check your connection and try again." });
  } finally {
    working = false;
    paint();
    el.querySelector('#kc-q')?.focus();
  }
}

async function answer(id, approve) {
  if (working || !chatId) return;
  const card = events.find((e) => e.t === 'confirm' && e.id === id);
  if (!card || card.state !== 'waiting') return;
  card.state = approve ? 'done' : 'declined';
  working = true;
  paint();
  try {
    const r = await api.post(`/api/kai/chats/${chatId}/confirm`, { approve });
    absorb(r);
  } catch (err) {
    card.state = 'waiting';
    events.push({ t: 'error', text: err.message });
  } finally {
    working = false;
    paint();
  }
}

async function openChat(id) {
  try {
    const c = await api.get(`/api/kai/chats/${id}`);
    chatId = c.id;
    events = c.events || [];
  } catch (err) { toast(err.message); return; }
  el.classList.remove('side-open');
  paintList();
  paint();
}

function newChat() {
  chatId = null;
  events = [];
  el.classList.remove('side-open');
  paintList();
  paint();
  el.querySelector('#kc-q').focus();
}

// ── Voice ────────────────────────────────────────────────────────────────────

let rec = null;
function listen() {
  if (!SpeechRecognition || working) return;
  if (rec) { try { rec.stop(); } catch { /* already stopped */ } return; }
  rec = new SpeechRecognition();
  rec.lang = navigator.language || 'en-AU';
  rec.interimResults = true;
  const q = el.querySelector('#kc-q');
  const mic = el.querySelector('#kc-mic');
  mic.classList.add('on');
  setStatus('Listening…');
  let finalText = '';
  rec.onresult = (ev) => {
    let interim = '';
    for (let i = ev.resultIndex; i < ev.results.length; i++) {
      if (ev.results[i].isFinal) finalText += ev.results[i][0].transcript;
      else interim += ev.results[i][0].transcript;
    }
    q.value = (finalText + interim).trim();
    grow(q);
  };
  rec.onend = () => {
    mic.classList.remove('on');
    rec = null;
    if (finalText.trim()) { q.value = ''; grow(q); send(finalText); } else paint({ scroll: false });
  };
  rec.onerror = () => { mic.classList.remove('on'); };
  try { rec.start(); } catch { mic.classList.remove('on'); rec = null; }
}

function grow(t) {
  t.style.height = 'auto';
  t.style.height = `${Math.min(t.scrollHeight, 160)}px`;
}

// ── Open / close ─────────────────────────────────────────────────────────────

export function openKaiChat(prefill = '') {
  if (!el) return;
  el.hidden = false;
  document.documentElement.classList.add('kc-lock');
  requestAnimationFrame(() => el.classList.add('open'));
  refreshList();
  paint();
  const q = el.querySelector('#kc-q');
  if (prefill) { q.value = prefill; grow(q); }
  // Not on a phone: the keyboard covering the conversation is not a welcome.
  if (!matchMedia('(pointer: coarse)').matches) q.focus();
}

export async function closeKaiChat() {
  if (!el || el.hidden) return;
  if (rec) { try { rec.stop(); } catch { /* gone */ } }
  el.classList.remove('open');
  document.documentElement.classList.remove('kc-lock');
  setTimeout(() => { el.hidden = true; }, 160);
  if (changed) {
    changed = false;
    try { (await import('./app.js')).refreshAll(); } catch { /* the next navigation refreshes anyway */ }
  }
}

export const isKaiChatOpen = () => Boolean(el && !el.hidden);

export async function mountKaiChat(root) {
  el = document.createElement('div');
  el.className = 'kc';
  el.hidden = true;
  el.innerHTML = `
    <div class="kc-shell" role="dialog" aria-modal="true" aria-label="Kai, your assistant">
      <header class="kc-head">
        <button type="button" class="kc-icon kc-hist" id="kc-hist" aria-label="Conversations" title="Conversations">${icon('menu', 17)}</button>
        <div class="kai-orb" data-state="idle">${kairoOrb(34, 'kc-head')}</div>
        <div class="kc-who"><div class="kc-name">Kai</div><div class="kc-status" id="kc-status" aria-live="polite">Ready</div></div>
        <button type="button" class="kc-icon" id="kc-new" aria-label="New conversation" title="New conversation">${icon('plus', 17)}</button>
        <button type="button" class="kc-icon" id="kc-close" aria-label="Close Kai" title="Close (Esc)">${icon('x', 17)}</button>
      </header>
      <div class="kc-body">
        <aside class="kc-side" aria-label="Conversations">
          <button type="button" class="btn kc-newbtn" id="kc-new2">${icon('plus', 14)} New conversation</button>
          <div class="kc-list" id="kc-list"></div>
        </aside>
        <div class="kc-scrim" id="kc-scrim"></div>
        <main class="kc-main">
          <div class="kc-stream" id="kc-stream" aria-live="polite"></div>
          <form class="kc-compose" id="kc-form" autocomplete="off">
            <textarea id="kc-q" rows="1" aria-label="Message Kai" placeholder="Tell Kai what to do…"></textarea>
            ${SpeechRecognition ? `<button type="button" class="kc-icon kc-mic" id="kc-mic" aria-label="Speak to Kai" title="Speak">${icon('mic', 17)}</button>` : ''}
            <button type="submit" class="kc-send" id="kc-send" aria-label="Send">${icon('send', 16)}</button>
          </form>
          <div class="kc-note">Kai changes things in your business for you. Deleting, messaging clients and payments always wait for your Confirm.
            Runs on Claude by Anthropic<span class="kc-off-wrap"> · <button type="button" class="kc-off" id="kc-off">Turn Kai off</button></span></div>
        </main>
      </div>
    </div>`;
  root.appendChild(el);

  const q = el.querySelector('#kc-q');
  q.addEventListener('input', () => grow(q));
  q.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); const t = q.value; q.value = ''; grow(q); send(t); }
  });
  el.querySelector('#kc-form').addEventListener('submit', (e) => { e.preventDefault(); const t = q.value; q.value = ''; grow(q); send(t); });
  el.querySelector('#kc-close').addEventListener('click', closeKaiChat);
  el.querySelector('#kc-new').addEventListener('click', newChat);
  el.querySelector('#kc-new2').addEventListener('click', newChat);
  el.querySelector('#kc-hist').addEventListener('click', () => el.classList.toggle('side-open'));
  el.querySelector('#kc-scrim').addEventListener('click', () => el.classList.remove('side-open'));
  el.querySelector('#kc-mic')?.addEventListener('click', listen);
  el.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeKaiChat(); });

  el.querySelector('#kc-off').addEventListener('click', async () => {
    try { await api.del('/api/kai/consent'); } catch (err) { toast(err.message); return; }
    consented = false;
    toast('Kai is off — nothing more is sent to Anthropic');
    paint();
  });
  el.querySelector('#kc-stream').addEventListener('click', async (e) => {
    const yes = e.target.closest('[data-consent]');
    if (yes) {
      if (yes.dataset.consent !== 'yes') { closeKaiChat(); return; }
      try { await api.post('/api/kai/consent', {}); } catch (err) { toast(err.message); return; }
      consented = true;
      paint();
      if (!matchMedia('(pointer: coarse)').matches) q.focus();
      return;
    }
    const sug = e.target.closest('[data-suggest]');
    if (sug) { q.value = sug.dataset.suggest; grow(q); q.focus(); return; }
    const ap = e.target.closest('[data-approve]');
    if (ap) { answer(ap.closest('[data-confirm]').dataset.confirm, ap.dataset.approve === '1'); return; }
    const go = e.target.closest('[data-go]');
    if (go) { location.hash = go.dataset.go; closeKaiChat(); }
  });
  el.querySelector('#kc-list').addEventListener('click', async (e) => {
    const del = e.target.closest('[data-del]');
    if (del) {
      e.stopPropagation();
      const id = Number(del.dataset.del);
      try { await api.del(`/api/kai/chats/${id}`); } catch (err) { toast(err.message); return; }
      if (id === chatId) newChat();
      refreshList();
      return;
    }
    const item = e.target.closest('[data-chat]');
    if (item) openChat(Number(item.dataset.chat));
  });

  return refreshKaiStatus();
}

/** Ask the server again whether Kai runs here (after Settings changes it). */
export async function refreshKaiStatus() {
  try {
    const st = await api.get('/api/kai/status');
    ready = Boolean(st.agent);
    consented = Boolean(st.consented);
  } catch { ready = false; }
  return ready;
}
