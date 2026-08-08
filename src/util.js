// Small shared helpers for the HTTP layer.

// Generous cap: a full branding save (logo + cover + 4 gallery photos as
// base64 data URIs) can approach ~6 MB. On overflow we drain the rest of the
// stream (rather than destroying the socket) so a clean 413 can still be sent.
const MAX_BODY_BYTES = 8 * 1024 * 1024;

/** Read the request body (up to MAX_BODY_BYTES) and return it as a string. */
export function readBody(req, maxBytes = MAX_BODY_BYTES) {
  return new Promise((resolve, reject) => {
    let size = 0;
    let settled = false;
    const chunks = [];
    req.on('data', (chunk) => {
      if (settled) return;
      size += chunk.length;
      if (size > maxBytes) {
        settled = true;
        req.resume(); // discard the remainder so the socket stays healthy for the response
        reject(Object.assign(new Error('Payload too large'), { status: 413 }));
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => { if (!settled) { settled = true; resolve(Buffer.concat(chunks).toString('utf8')); } });
    req.on('error', (err) => { if (!settled) { settled = true; reject(err); } });
  });
}

/** Read and JSON-parse the request body. Throws a 400 on invalid JSON. */
export async function readJson(req) {
  const raw = await readBody(req);
  if (!raw) return {};
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw Object.assign(new Error('Invalid JSON body'), { status: 400 });
  }
  // Every handler here reads named fields off the body, so anything that isn't
  // an object has to be refused right here. `JSON.parse('null')` is valid JSON
  // and yields null, which then blows up in the handler's destructuring and
  // surfaces to the caller as a 500 — an internal error for what is really just
  // a bad request.
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw Object.assign(new Error('Expected a JSON object'), { status: 400 });
  }
  return parsed;
}

export function sendJson(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

export function sendText(res, status, text, contentType = 'text/plain; charset=utf-8', headers = {}) {
  res.writeHead(status, {
    'Content-Type': contentType,
    'Content-Length': Buffer.byteLength(text),
    ...headers,
  });
  res.end(text);
}

/** Error with an HTTP status attached; api handlers throw these. */
export function httpError(status, message) {
  return Object.assign(new Error(message), { status });
}

export function parseCookies(req) {
  const header = req.headers.cookie || '';
  const out = {};
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    const raw = part.slice(idx + 1).trim();
    // A malformed percent-escape (e.g. "%" or "%ZZ") makes decodeURIComponent
    // throw; never let a bad cookie header crash request handling.
    try {
      out[key] = decodeURIComponent(raw);
    } catch {
      out[key] = raw;
    }
  }
  return out;
}

/** Local date as YYYY-MM-DD (the app is single-timezone by design). */
export function todayStr(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return dateStr(d);
}

/** N days after a YYYY-MM-DD string, computed in UTC so DST can't shift it. */
export function addDaysStr(dateStr_, days) {
  const [y, m, d] = String(dateStr_).split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/**
 * "Now" expressed in a specific IANA time zone (e.g. 'Australia/Melbourne'):
 * { date: 'YYYY-MM-DD', min: minutes-since-midnight }. This is what makes the
 * booking page's past-slot filter correct even when the server runs in UTC.
 * Falls back to the server's own local time when tz is empty/invalid.
 */
/** Does the runtime actually know this IANA zone? "Australia/Melbourn" does not count. */
export function isValidTimeZone(tz) {
  if (!tz || typeof tz !== 'string') return false;
  try {
    new Intl.DateTimeFormat('en-CA', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export function nowParts(tz) {
  const d = new Date();
  const local = () => ({ date: dateStr(d), min: d.getHours() * 60 + d.getMinutes() });
  if (!tz) return local();
  try {
    const parts = Object.fromEntries(
      new Intl.DateTimeFormat('en-CA', {
        timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', hour12: false,
      }).formatToParts(d).map((p) => [p.type, p.value])
    );
    const hour = Number(parts.hour) % 24; // hour12:false can report '24' at midnight
    return { date: `${parts.year}-${parts.month}-${parts.day}`, min: hour * 60 + Number(parts.minute) };
  } catch {
    return local();
  }
}

export function dateStr(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function isDateStr(s) {
  return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

export function clampInt(v, min, max, fallback) {
  const n = Number.parseInt(v, 10);
  if (Number.isNaN(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

/** Serialize rows to CSV with proper quoting. columns: [{key, label}] */
export function toCsv(columns, rows) {
  const escape = (v) => {
    const s = v == null ? '' : String(v);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [columns.map((c) => escape(c.label)).join(',')];
  for (const row of rows) {
    lines.push(columns.map((c) => escape(row[c.key])).join(','));
  }
  return lines.join('\r\n') + '\r\n';
}
