// Every action an owner can take in Kairo, read from src/api.js itself.
//
// Kai the agent does not have its own list of what it can do. It has the
// owner's: the same routes the screens call, with the same validation, the
// same permission checks and the same side effects (a booking made by Kai
// sends the same confirmation a booking made by hand does). This file turns
// the route table into a compact reference the model can read — one line per
// action, with the fields it takes — by reading the source, so a route added
// next month is in Kai's reference the moment it exists, with nobody having to
// remember to add it.
//
// What is left out, and why, is the list below. What needs the owner to press
// Confirm before it runs is the list after that.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));

/**
 * Never offered to Kai.
 *
 * Signing in and out, passwords, account email, closing or refunding the
 * account: decisions about the account itself belong to the person holding
 * it, on a screen that asks for the password. The public routes are the
 * booking page's, not the owner's. Kai's own routes would let it talk to
 * itself. File uploads and downloads need a file, which a sentence is not. The
 * edge/backup controls protect the server and are not a conversation. Card and
 * text-message provider keys are typed into Settings, never into a chat log.
 */
const NEVER = [
  /^\/api\/auth\//, /^\/api\/public\//, /^\/api\/ask/, /^\/api\/kai/, /^\/api\/app\//,
  /^\/api\/account\/(delete|refund|profile)/, /^\/api\/settings\/reset-demo/, /^\/api\/demo\//,
  /^\/api\/setup\//, /^\/api\/edge\//, /^\/api\/backup\/download/, /^\/api\/platform/,
  /\/export$/, /^\/api\/clients\/(import|parse-sheet)/, /^\/api\/services\/import/,
  /^\/api\/photos\/:id$/, /\/photos$/, /^\/api\/sms\/(connect|own-number|login)/, /^\/api\/version/,
];

/**
 * Runs only after the owner presses Confirm in the chat.
 *
 * Everything that deletes, that reaches a client's phone or inbox on its own,
 * or that moves money. Kai can prepare these — it fills in the details and
 * says what it is about to do — but the button is the owner's. Everything
 * else (adding, editing, booking, noting) just happens, and is listed in the
 * chat as it happens.
 */
const CONFIRM = [
  { method: 'DELETE' },
  { method: 'POST', path: /^\/api\/campaigns\/send$/ },
  { method: 'POST', path: /^\/api\/automations\/[^/]+\/run$/ },
  { method: 'POST', path: /^\/api\/invoices\/\d+\/refund$/ },
  { method: 'POST', path: /^\/api\/clients\/\d+\/merge$/ },
  { method: 'POST', path: /^\/api\/messages\/\d+\/retry$/ },
  { method: 'POST', path: /^\/api\/appointments\/\d+\/cancel$/ },
  { method: 'POST', path: /^\/api\/invites(\/\d+\/confirm)?$/ },
  { method: 'POST', path: /^\/api\/pos\/sale$/ },
  { method: 'POST', path: /^\/api\/backup\/email$/ },
  { method: 'PATCH', path: /^\/api\/appointments\/\d+\/status$/, when: (b) => ['cancelled', 'no_show'].includes(b?.status) },
];

export function needsConfirm(method, pathname, body) {
  return CONFIRM.some((c) => c.method === method && (!c.path || c.path.test(pathname)) && (!c.when || c.when(body)));
}

const isPatternNever = (p) => NEVER.some((re) => re.test(p));

/** A concrete path ("/api/clients/12") → the route pattern it belongs to, or null. */
export function matchPattern(method, pathname) {
  for (const a of catalogue()) {
    if (a.method !== method) continue;
    if (a.regex.test(pathname)) return a;
  }
  return null;
}

// ── Reading the source ───────────────────────────────────────────────────────

/** The first sentence or two of the comment directly above a route. */
function commentAbove(lines, i) {
  const out = [];
  let j = i - 1;
  while (j >= 0 && lines[j].trim() === '') j--;
  if (j >= 0 && lines[j].trim().endsWith('*/')) {
    while (j >= 0 && !lines[j].includes('/**') && !lines[j].includes('/*')) { out.unshift(lines[j]); j--; }
    if (j >= 0) out.unshift(lines[j]);
  } else {
    while (j >= 0 && lines[j].trim().startsWith('//')) { out.unshift(lines[j]); j--; }
  }
  const text = out.join(' ')
    .replace(/\/\*\*?|\*\/|^\s*\*|\s\*\s/g, ' ')
    .replace(/\s*\/\/\s*/g, ' ')
    .replace(/[-─—=]{3,}/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!text) return '';
  const sentences = text.match(/[^.!?]+[.!?]+(\s|$)/g) || [text];
  let s = '';
  for (const sen of sentences) { if ((s + sen).length > 220) break; s += sen; }
  return (s || text.slice(0, 200)).trim();
}

/** Keys of an object literal starting at `{` in `src` from index `at`, with their rule text. */
function literalKeys(src, at) {
  if (src[at] !== '{') return [];
  let depth = 0, end = at;
  for (let k = at; k < src.length; k++) {
    if (src[k] === '{' || src[k] === '[' || src[k] === '(') depth++;
    else if (src[k] === '}' || src[k] === ']' || src[k] === ')') { depth--; if (depth === 0) { end = k; break; } }
  }
  const body = src.slice(at + 1, end);
  // Top-level entries only: walk the text keeping a depth count.
  const fields = [];
  let d = 0, start = 0;
  const parts = [];
  for (let k = 0; k < body.length; k++) {
    const ch = body[k];
    if ('{[('.includes(ch)) d++;
    else if ('}])'.includes(ch)) d--;
    else if (ch === ',' && d === 0) { parts.push(body.slice(start, k)); start = k + 1; }
  }
  parts.push(body.slice(start));
  for (const raw of parts) {
    const p = raw.replace(/\/\/[^\n]*/g, '').trim();
    const m = p.match(/^([a-z_][a-z0-9_]*)\s*:\s*([\s\S]*)$/i);
    if (!m) continue;
    fields.push({ name: m[1], rule: m[2].trim() });
  }
  return fields;
}

function describeRule(rule, schemas = {}) {
  const req = /required:\s*true/.test(rule);
  let type = '';
  let m;
  // The shape inside a list or an object, so "items" says what an item is.
  const inner = (text) => {
    const named = text.match(/^s\.obj\(([A-Z_]+SCHEMA)/);
    const keys = named ? (schemas[named[1]] || [])
      : text.startsWith('s.obj({') ? literalKeys(text, text.indexOf('{')) : [];
    const shown = keys.filter((k) => !['id', 'invoice_id'].includes(k.name))
      .map((k) => `${k.name}${/required:\s*true/.test(k.rule) ? '*' : ''}`);
    return shown.length ? `{${shown.join(', ')}}` : '';
  };
  if ((m = rule.match(/^s\.oneOf\(\[([^\]]*)\]/))) type = m[1].replace(/['"\s]/g, '').split(',').join('|');
  else if (/^s\.num/.test(rule)) type = 'number';
  else if (/^s\.bool/.test(rule)) type = 'true|false';
  else if ((m = rule.match(/^s\.arr\(([\s\S]*)/))) {
    const of = m[1].trim();
    type = /^s\.num/.test(of) ? 'list of numbers' : (inner(of) ? `list of ${inner(of)}` : 'list');
  } else if (/^s\.obj/.test(rule)) type = inner(rule) ? `object ${inner(rule)}` : 'object';
  else if (/^s\.str/.test(rule)) type = '';
  return { req, type };
}

let cached = null;

/**
 * The catalogue, built once per process: [{ method, path, regex, desc, fields, query }].
 */
export function catalogue() {
  if (cached) return cached;
  const src = fs.readFileSync(path.join(HERE, 'api.js'), 'utf8');
  const lines = src.split('\n');

  // Named schemas: `const CLIENT_SCHEMA = { ... };`
  const schemas = {};
  for (const m of src.matchAll(/^const ([A-Z_]+SCHEMA) = (\{)/gm)) {
    schemas[m[1]] = literalKeys(src, m.index + m[0].length - 1);
  }
  // Helpers that read a body field by field — `function clientBody(b)`,
  // `async function apptBody(req)`, `function saveAutomation(kind, b)` — and
  // what they read: `b.x` references and any named schema they check against.
  const helpers = {};
  for (const m of src.matchAll(/^(?:async )?function ([a-zA-Z]+)\(([^)]*)\)\s*\{/gm)) {
    const endAt = src.indexOf('\n}\n', m.index);
    const text = src.slice(m.index, endAt);
    const found = new Map();
    for (const x of text.matchAll(/\b(?:b|body)\.([a-z_][a-z0-9_]*)/g)) found.set(x[1], {});
    for (const x of text.matchAll(/checkBody\([^,]+,\s*([A-Z_]+SCHEMA)/g)) {
      for (const f of schemas[x[1]] || []) found.set(f.name, describeRule(f.rule, schemas));
    }
    for (const x of text.matchAll(/checkBody\([^,]+,\s*\{/g)) {
      for (const f of literalKeys(text, x.index + x[0].length - 1)) found.set(f.name, describeRule(f.rule, schemas));
    }
    if (found.size) helpers[m[1]] = found;
  }

  const routeLines = [];
  lines.forEach((l, i) => {
    const m = l.match(/^route\('([A-Z]+)', '([^']+)'/);
    if (m) routeLines.push({ i, method: m[1], path: m[2] });
  });

  const out = [];
  routeLines.forEach((r, n) => {
    if (isPatternNever(r.path)) return;
    // The handler ends at the first line that closes it at column 0 — `});`
    // or `}, { auth: false });` — never at the next route, because helpers and
    // schemas defined in between belong to whatever follows them.
    let end = r.i + 1;
    while (end < lines.length && !/^\}/.test(lines[end])) end++;
    const block = lines.slice(r.i, end + 1).join('\n');
    if (/^\},\s*\{\s*auth:\s*false/m.test(block)) return;

    const fields = new Map();
    const add = (name, info = {}) => { if (!fields.has(name)) fields.set(name, info); };
    for (const m of block.matchAll(/checkBody\([^,]+,\s*(\{|[A-Z_]+SCHEMA)/g)) {
      const list = m[1] === '{' ? literalKeys(block, m.index + m[0].length - 1) : (schemas[m[1]] || []);
      for (const f of list) add(f.name, describeRule(f.rule, schemas));
    }
    // A helper handed the request or its body reads the fields for it.
    for (const m of block.matchAll(/\b([a-zA-Z]+)\((?:await readJson\(req\)|req|b|body)[,)]/g)) {
      for (const [name, info] of helpers[m[1]] || []) add(name, info);
    }
    if (/readJson\(req\)/.test(block)) {
      for (const m of block.matchAll(/\b(?:b|body)\.([a-z_][a-z0-9_]*)/g)) add(m[1], {});
    }
    const query = [...new Set([...block.matchAll(/query\.get\('([a-z_]+)'\)/g)].map((m) => m[1]))];

    const regex = new RegExp('^' + r.path.replace(/:([a-zA-Z_]+)/g, (_, name) => ({
      date: '\\d{4}-\\d{2}-\\d{2}', kind: '[a-z][a-z0-9_]{0,40}', step: '[a-z][a-z0-9-]{0,40}',
    }[name] || '\\d+')) + '$');
    out.push({
      method: r.method, path: r.path, regex,
      desc: commentAbove(lines, r.i),
      fields: r.path === '/api/settings' && r.method === 'PUT'
        ? [{ name: '<any setting key below>', req: false, type: '' }]
        : [...fields].map(([name, info]) => ({ name, ...info })),
      query,
    });
  });
  cached = out;
  return out;
}

/**
 * Settings that are credentials. Kai never reads or writes these: a key typed
 * into a chat ends up in a chat log, and a key read out of one ends up on a
 * screen somebody else is looking at.
 */
export const isSecretSetting = (k) => /(key|secret|password|token|_pass)$/i.test(k) || /^clicksend_(username|login)/.test(k)
  || k === 'session_secret';

/** One line per action, for the model's reference. */
export function catalogueText(settingKeys = []) {
  const lines = catalogue().map((a) => {
    const f = a.fields.map((x) => `${x.name}${x.req ? '*' : ''}${x.type ? `:${x.type}` : ''}`).join(', ');
    const q = a.query.length ? ` ?${a.query.join('&')}` : '';
    const body = f ? ` {${f}}` : '';
    const concrete = a.path.replace(/:([a-z_]+)/g, '1');
    const gate = needsConfirm(a.method, concrete, {}) ? ' [asks owner to confirm]'
      : needsConfirm(a.method, concrete, { status: 'cancelled' }) ? ' [asks owner to confirm when cancelling or marking a no-show]' : '';
    return `${a.method} ${a.path}${q}${body}${gate}${a.desc ? ` — ${a.desc}` : ''}`;
  });
  return `${lines.join('\n')}\n\nSettings keys PUT /api/settings accepts: ${settingKeys.filter((k) => !isSecretSetting(k)).join(', ')}`;
}
