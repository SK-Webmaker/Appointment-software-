// Kai — the bar you open with ⌘K and ask a question.
//
// The top bar has had a search box since the beginning, reading "Search
// clients, invoices…". It never searched invoices. Pressing Enter jumped to the
// clients page with a query string, and that was the whole of it — a front door
// with nothing behind it. This is what goes behind it.
//
// Two rules, and they are the same rule twice:
//
//   1. NOTHING HAPPENS WITHOUT A PRESS. Kai shows what it matched and waits.
//      No answer here changes anything by being looked at.
//   2. NEVER GO BLANK. A bar that returns nothing has taught the owner not to
//      open it again. When Kai does not understand, it says so plainly and
//      offers the things it does understand.
import { esc, icon, copyText, toast } from './ui.js';
import { api } from './api.js';

let el = null;
let items = [];
let cursor = 0;
let seq = 0;

const ICONS = { client: 'user', figure: 'dollar', list: 'grid', place: 'chevR', copy: 'link' };

function rowHtml(a, i) {
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
      <div class="kai-hint">Ask about your own diary — nothing here leaves your salon.</div>
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
        been in, no-shows, your booking link — and finds people by name. It never guesses.</span>
      </div>`;
    return;
  }
  list.innerHTML = items.map(rowHtml).join('');
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

function move(by) {
  if (!items.length) return;
  cursor = (cursor + by + items.length) % items.length;
  el.querySelectorAll('.kai-item').forEach((n, i) => n.classList.toggle('sel', i === cursor));
  el.querySelector('.kai-item.sel')?.scrollIntoView({ block: 'nearest' });
}

export function close() {
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
      paint(data || { answers: [], suggestions: [] });
    } catch {
      if (mine !== seq) return;
      paint({ answers: [], suggestions: [] });
    }
  }, q ? 160 : 0);
}

export function mountKai(root) {
  el = document.createElement('div');
  el.className = 'kai';
  el.innerHTML = `
    <div class="kai-scrim" data-close></div>
    <div class="kai-panel" role="dialog" aria-label="Ask Kai">
      <div class="kai-bar">
        ${icon('zap', 16)}
        <input id="kai-q" placeholder="Ask Kai — last week, who owes me, a client's name…"
               autocomplete="off" spellcheck="false">
        <kbd>Esc</kbd>
      </div>
      <div class="kai-list" id="kai-list"></div>
      <div class="kai-foot">
        <span><kbd>↑</kbd><kbd>↓</kbd> to move · <kbd>Enter</kbd> to open</span>
        <span>Answered from your own data. Nothing is sent anywhere.</span>
      </div>
    </div>`;
  root.appendChild(el);

  el.querySelector('[data-close]').addEventListener('click', close);
  el.querySelector('#kai-q').addEventListener('input', (e) => load(e.target.value.trim()));
  el.querySelector('#kai-list').addEventListener('click', (e) => {
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
