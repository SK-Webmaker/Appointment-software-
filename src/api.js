// REST API. All routes live under /api. Handlers may return a value (sent as
// JSON 200), send the response themselves, or throw httpError(status, msg).
import {
  db, getSetting, setSetting, getSettings, nextInvoiceNumber, resetDemo,
} from './db.js';
import {
  readJson, sendJson, sendText, httpError, parseCookies, todayStr, isDateStr, clampInt, toCsv,
} from './util.js';
import {
  hashPassword, verifyPassword, createSession, verifySession,
  sessionCookie, clearSessionCookie, loginRateLimited, COOKIE_NAME,
} from './auth.js';

const APPT_STATUSES = new Set(['booked', 'confirmed', 'completed', 'cancelled', 'no_show']);
const INVOICE_STATUSES = new Set(['draft', 'sent', 'paid', 'void']);
const PAY_METHODS = new Set(['card', 'cash', 'transfer', 'other']);

// ---------------------------------------------------------------------------
// Routing table
// ---------------------------------------------------------------------------

const routes = [];
function route(method, pattern, handler, { auth = true } = {}) {
  const names = [];
  const regex = new RegExp(
    '^' + pattern.replace(/:[a-zA-Z_]+/g, (m) => { names.push(m.slice(1)); return '(\\d+)'; }) + '$'
  );
  routes.push({ method, regex, names, handler, auth });
}

export async function handleApi(req, res, pathname, query) {
  for (const r of routes) {
    if (r.method !== req.method) continue;
    const m = r.regex.exec(pathname);
    if (!m) continue;
    const params = {};
    r.names.forEach((n, i) => { params[n] = Number(m[i + 1]); });

    let user = null;
    if (r.auth) {
      const token = parseCookies(req)[COOKIE_NAME];
      const userId = verifySession(token, getSetting('session_secret'));
      if (userId) user = db.prepare('SELECT id, name, email, role FROM users WHERE id = ?').get(userId);
      if (!user) return sendJson(res, 401, { error: 'Not signed in' });
    }

    try {
      const result = await r.handler({ req, res, params, query, user });
      if (!res.writableEnded) sendJson(res, 200, result ?? { ok: true });
    } catch (err) {
      const status = err.status || 500;
      if (status === 500) console.error(err);
      if (!res.writableEnded) sendJson(res, status, { error: err.message || 'Server error', ...(err.data || {}) });
    }
    return true;
  }
  sendJson(res, 404, { error: 'Not found' });
  return true;
}

const str = (v, max = 500) => (v == null ? '' : String(v).slice(0, max).trim());

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

route('POST', '/api/auth/login', async ({ req, res }) => {
  const ip = req.socket.remoteAddress || 'unknown';
  if (loginRateLimited(ip)) throw httpError(429, 'Too many attempts — try again in a few minutes');
  const { email, password } = await readJson(req);
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(str(email).toLowerCase());
  if (!user || !verifyPassword(String(password || ''), user.salt, user.pass_hash)) {
    throw httpError(401, 'Invalid email or password');
  }
  const token = createSession(user.id, getSetting('session_secret'));
  res.setHeader('Set-Cookie', sessionCookie(token));
  return { user: { id: user.id, name: user.name, email: user.email, role: user.role } };
}, { auth: false });

route('POST', '/api/auth/logout', async ({ res }) => {
  res.setHeader('Set-Cookie', clearSessionCookie());
  return { ok: true };
}, { auth: false });

route('GET', '/api/auth/me', async ({ user }) => ({ user, settings: getSettings() }));

route('PUT', '/api/auth/password', async ({ req, user }) => {
  const { current, next } = await readJson(req);
  const row = db.prepare('SELECT * FROM users WHERE id = ?').get(user.id);
  if (!verifyPassword(String(current || ''), row.salt, row.pass_hash)) {
    throw httpError(400, 'Current password is incorrect');
  }
  if (!next || String(next).length < 8) throw httpError(400, 'New password must be at least 8 characters');
  const { salt, hash } = hashPassword(String(next));
  db.prepare('UPDATE users SET pass_hash = ?, salt = ? WHERE id = ?').run(hash, salt, user.id);
  return { ok: true };
});

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

const EDITABLE_SETTINGS = new Set([
  'business_name', 'business_email', 'business_phone', 'business_address',
  'currency', 'tax_rate', 'open_min', 'close_min', 'slot_interval',
  'booking_enabled', 'invoice_prefix', 'invoice_due_days', 'invoice_footer',
]);

route('GET', '/api/settings', async () => getSettings());

route('PUT', '/api/settings', async ({ req }) => {
  const body = await readJson(req);
  for (const [k, v] of Object.entries(body)) {
    if (EDITABLE_SETTINGS.has(k)) setSetting(k, str(v, 1000));
  }
  return getSettings();
});

route('POST', '/api/settings/reset-demo', async () => {
  resetDemo();
  return { ok: true };
});

// ---------------------------------------------------------------------------
// Staff
// ---------------------------------------------------------------------------

route('GET', '/api/staff', async ({ query }) => {
  const all = query.get('all') === '1';
  return db.prepare(`SELECT * FROM staff ${all ? '' : 'WHERE active = 1'} ORDER BY id`).all();
});

route('POST', '/api/staff', async ({ req }) => {
  const b = await readJson(req);
  if (!str(b.name)) throw httpError(400, 'Name is required');
  const info = db.prepare('INSERT INTO staff (name, title, color) VALUES (?, ?, ?)')
    .run(str(b.name, 100), str(b.title, 100), str(b.color, 20) || '#3987e5');
  return db.prepare('SELECT * FROM staff WHERE id = ?').get(info.lastInsertRowid);
});

route('PUT', '/api/staff/:id', async ({ req, params }) => {
  const b = await readJson(req);
  const existing = db.prepare('SELECT * FROM staff WHERE id = ?').get(params.id);
  if (!existing) throw httpError(404, 'Staff member not found');
  db.prepare('UPDATE staff SET name = ?, title = ?, color = ?, active = ? WHERE id = ?').run(
    str(b.name, 100) || existing.name,
    str(b.title, 100),
    str(b.color, 20) || existing.color,
    b.active === undefined ? existing.active : (b.active ? 1 : 0),
    params.id
  );
  return db.prepare('SELECT * FROM staff WHERE id = ?').get(params.id);
});

route('DELETE', '/api/staff/:id', async ({ params }) => {
  const used = db.prepare('SELECT COUNT(*) AS n FROM appointments WHERE staff_id = ?').get(params.id).n;
  if (used > 0) {
    db.prepare('UPDATE staff SET active = 0 WHERE id = ?').run(params.id);
    return { ok: true, deactivated: true };
  }
  db.prepare('DELETE FROM staff WHERE id = ?').run(params.id);
  return { ok: true };
});

// ---------------------------------------------------------------------------
// Clients
// ---------------------------------------------------------------------------

const CLIENT_LIST_SQL = `
  SELECT c.*,
    (SELECT COUNT(*) FROM appointments a WHERE a.client_id = c.id AND a.status != 'cancelled') AS appointment_count,
    (SELECT MAX(a.date) FROM appointments a WHERE a.client_id = c.id AND a.status = 'completed') AS last_visit,
    COALESCE((SELECT SUM(p.amount_cents) FROM payments p JOIN invoices i ON i.id = p.invoice_id WHERE i.client_id = c.id), 0) AS total_paid_cents
  FROM clients c`;

route('GET', '/api/clients', async ({ query }) => {
  const q = str(query.get('q'), 100);
  if (q) {
    const like = `%${q}%`;
    return db.prepare(
      `${CLIENT_LIST_SQL} WHERE c.first_name || ' ' || c.last_name LIKE ? OR c.email LIKE ? OR c.phone LIKE ?
       ORDER BY c.first_name, c.last_name`
    ).all(like, like, like);
  }
  return db.prepare(`${CLIENT_LIST_SQL} ORDER BY c.first_name, c.last_name`).all();
});

route('GET', '/api/clients/export', async ({ res }) => {
  const rows = db.prepare('SELECT first_name, last_name, email, phone, notes FROM clients ORDER BY first_name').all();
  const csv = toCsv(
    [
      { key: 'first_name', label: 'First Name' }, { key: 'last_name', label: 'Last Name' },
      { key: 'email', label: 'Email' }, { key: 'phone', label: 'Phone' }, { key: 'notes', label: 'Notes' },
    ],
    rows
  );
  sendText(res, 200, csv, 'text/csv; charset=utf-8', { 'Content-Disposition': 'attachment; filename="clients.csv"' });
});

route('GET', '/api/clients/:id', async ({ params }) => {
  const client = db.prepare(`${CLIENT_LIST_SQL} WHERE c.id = ?`).get(params.id);
  if (!client) throw httpError(404, 'Client not found');
  client.appointments = db.prepare(
    `SELECT a.*, s.name AS staff_name, sv.name AS service_name, sv.price_cents
     FROM appointments a
     LEFT JOIN staff s ON s.id = a.staff_id
     LEFT JOIN services sv ON sv.id = a.service_id
     WHERE a.client_id = ? ORDER BY a.date DESC, a.start_min DESC LIMIT 50`
  ).all(params.id);
  client.invoices = db.prepare(
    `SELECT i.*,
       COALESCE((SELECT CAST(ROUND(SUM(qty * unit_cents)) AS INTEGER) FROM invoice_items WHERE invoice_id = i.id), 0) AS subtotal_cents,
       COALESCE((SELECT SUM(amount_cents) FROM payments WHERE invoice_id = i.id), 0) AS paid_cents
     FROM invoices i WHERE i.client_id = ? ORDER BY i.issue_date DESC LIMIT 50`
  ).all(params.id);
  return client;
});

function clientBody(b) {
  const first = str(b.first_name, 100);
  if (!first) throw httpError(400, 'First name is required');
  return [first, str(b.last_name, 100), str(b.email, 200).toLowerCase(), str(b.phone, 50), str(b.notes, 2000)];
}

route('POST', '/api/clients', async ({ req }) => {
  const info = db.prepare(
    'INSERT INTO clients (first_name, last_name, email, phone, notes) VALUES (?, ?, ?, ?, ?)'
  ).run(...clientBody(await readJson(req)));
  return db.prepare('SELECT * FROM clients WHERE id = ?').get(info.lastInsertRowid);
});

route('PUT', '/api/clients/:id', async ({ req, params }) => {
  if (!db.prepare('SELECT id FROM clients WHERE id = ?').get(params.id)) throw httpError(404, 'Client not found');
  db.prepare(
    'UPDATE clients SET first_name = ?, last_name = ?, email = ?, phone = ?, notes = ? WHERE id = ?'
  ).run(...clientBody(await readJson(req)), params.id);
  return db.prepare('SELECT * FROM clients WHERE id = ?').get(params.id);
});

route('DELETE', '/api/clients/:id', async ({ params }) => {
  db.prepare('DELETE FROM clients WHERE id = ?').run(params.id);
  return { ok: true };
});

route('POST', '/api/clients/import', async ({ req }) => {
  const { rows } = await readJson(req);
  if (!Array.isArray(rows)) throw httpError(400, 'Expected { rows: [...] }');
  if (rows.length > 5000) throw httpError(400, 'Import is limited to 5000 rows at a time');
  const byEmail = db.prepare('SELECT id FROM clients WHERE email = ? AND email != ?');
  const byNamePhone = db.prepare("SELECT id FROM clients WHERE first_name = ? AND last_name = ? AND phone = ? AND phone != ''");
  const ins = db.prepare('INSERT INTO clients (first_name, last_name, email, phone, notes) VALUES (?, ?, ?, ?, ?)');
  let imported = 0, skipped = 0, invalid = 0;
  for (const raw of rows) {
    let fields;
    try { fields = clientBody(raw); } catch { invalid++; continue; }
    const [first, last, email, phone] = fields;
    const dupe = (email && byEmail.get(email, '')) || byNamePhone.get(first, last, phone);
    if (dupe) { skipped++; continue; }
    ins.run(...fields);
    imported++;
  }
  return { imported, skipped, invalid };
});

// ---------------------------------------------------------------------------
// Services
// ---------------------------------------------------------------------------

route('GET', '/api/services', async ({ query }) => {
  const all = query.get('all') === '1';
  return db.prepare(`SELECT * FROM services ${all ? '' : 'WHERE active = 1'} ORDER BY category, name`).all();
});

route('GET', '/api/services/export', async ({ res }) => {
  const rows = db.prepare('SELECT name, category, duration_min, price_cents, description FROM services ORDER BY category, name').all()
    .map((r) => ({ ...r, price: (r.price_cents / 100).toFixed(2) }));
  const csv = toCsv(
    [
      { key: 'name', label: 'Service' }, { key: 'category', label: 'Category' },
      { key: 'duration_min', label: 'Duration (min)' }, { key: 'price', label: 'Price' },
      { key: 'description', label: 'Description' },
    ],
    rows
  );
  sendText(res, 200, csv, 'text/csv; charset=utf-8', { 'Content-Disposition': 'attachment; filename="services.csv"' });
});

function serviceBody(b) {
  const name = str(b.name, 200);
  if (!name) throw httpError(400, 'Service name is required');
  const duration = clampInt(b.duration_min, 5, 24 * 60, NaN);
  if (Number.isNaN(duration)) throw httpError(400, 'Duration must be a number of minutes');
  let cents = b.price_cents;
  if (cents == null && b.price != null) cents = Math.round(parseFloat(String(b.price).replace(/[^0-9.\-]/g, '')) * 100);
  cents = Number.isFinite(Number(cents)) ? Math.max(0, Math.round(Number(cents))) : NaN;
  if (Number.isNaN(cents)) throw httpError(400, 'Price must be a number');
  return [name, str(b.category, 100) || 'General', duration, cents, str(b.description, 1000)];
}

route('POST', '/api/services', async ({ req }) => {
  const info = db.prepare(
    'INSERT INTO services (name, category, duration_min, price_cents, description) VALUES (?, ?, ?, ?, ?)'
  ).run(...serviceBody(await readJson(req)));
  return db.prepare('SELECT * FROM services WHERE id = ?').get(info.lastInsertRowid);
});

route('PUT', '/api/services/:id', async ({ req, params }) => {
  const existing = db.prepare('SELECT * FROM services WHERE id = ?').get(params.id);
  if (!existing) throw httpError(404, 'Service not found');
  const b = await readJson(req);
  db.prepare(
    'UPDATE services SET name = ?, category = ?, duration_min = ?, price_cents = ?, description = ?, active = ? WHERE id = ?'
  ).run(...serviceBody(b), b.active === undefined ? existing.active : (b.active ? 1 : 0), params.id);
  return db.prepare('SELECT * FROM services WHERE id = ?').get(params.id);
});

route('DELETE', '/api/services/:id', async ({ params }) => {
  const used = db.prepare('SELECT COUNT(*) AS n FROM appointments WHERE service_id = ?').get(params.id).n;
  if (used > 0) {
    db.prepare('UPDATE services SET active = 0 WHERE id = ?').run(params.id);
    return { ok: true, deactivated: true };
  }
  db.prepare('DELETE FROM services WHERE id = ?').run(params.id);
  return { ok: true };
});

route('POST', '/api/services/import', async ({ req }) => {
  const { rows } = await readJson(req);
  if (!Array.isArray(rows)) throw httpError(400, 'Expected { rows: [...] }');
  if (rows.length > 2000) throw httpError(400, 'Import is limited to 2000 rows at a time');
  const dupe = db.prepare('SELECT id FROM services WHERE name = ? AND category = ?');
  const ins = db.prepare('INSERT INTO services (name, category, duration_min, price_cents, description) VALUES (?, ?, ?, ?, ?)');
  let imported = 0, skipped = 0, invalid = 0;
  for (const raw of rows) {
    let fields;
    try { fields = serviceBody(raw); } catch { invalid++; continue; }
    if (dupe.get(fields[0], fields[1])) { skipped++; continue; }
    ins.run(...fields);
    imported++;
  }
  return { imported, skipped, invalid };
});

// ---------------------------------------------------------------------------
// Appointments
// ---------------------------------------------------------------------------

const APPT_SELECT = `
  SELECT a.*,
    c.first_name || CASE WHEN c.last_name != '' THEN ' ' || c.last_name ELSE '' END AS client_name,
    c.phone AS client_phone, c.email AS client_email,
    s.name AS staff_name, s.color AS staff_color,
    sv.name AS service_name, sv.price_cents AS service_price_cents,
    (SELECT i.id FROM invoices i WHERE i.appointment_id = a.id AND i.status != 'void' LIMIT 1) AS invoice_id
  FROM appointments a
  LEFT JOIN clients c ON c.id = a.client_id
  LEFT JOIN staff s ON s.id = a.staff_id
  LEFT JOIN services sv ON sv.id = a.service_id`;

route('GET', '/api/appointments', async ({ query }) => {
  const from = query.get('from'), to = query.get('to');
  const conds = [], args = [];
  if (isDateStr(from)) { conds.push('a.date >= ?'); args.push(from); }
  if (isDateStr(to)) { conds.push('a.date <= ?'); args.push(to); }
  const staffId = Number(query.get('staff_id'));
  if (staffId) { conds.push('a.staff_id = ?'); args.push(staffId); }
  const status = query.get('status');
  if (status && APPT_STATUSES.has(status)) { conds.push('a.status = ?'); args.push(status); }
  const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
  return db.prepare(`${APPT_SELECT} ${where} ORDER BY a.date, a.start_min LIMIT 2000`).all(...args);
});

function findConflict(staffId, date, startMin, endMin, excludeId = 0) {
  return db.prepare(
    `${APPT_SELECT}
     WHERE a.staff_id = ? AND a.date = ? AND a.id != ?
       AND a.status NOT IN ('cancelled', 'no_show')
       AND a.start_min < ? AND a.end_min > ?
     LIMIT 1`
  ).get(staffId, date, excludeId, endMin, startMin);
}

async function apptBody(req) {
  const b = await readJson(req);
  const staffId = Number(b.staff_id);
  if (!db.prepare('SELECT id FROM staff WHERE id = ?').get(staffId)) throw httpError(400, 'Choose a staff member');
  if (!isDateStr(b.date)) throw httpError(400, 'Date must be YYYY-MM-DD');
  const start = clampInt(b.start_min, 0, 1439, NaN);
  if (Number.isNaN(start)) throw httpError(400, 'Start time is required');

  const serviceId = Number(b.service_id) || null;
  const service = serviceId ? db.prepare('SELECT * FROM services WHERE id = ?').get(serviceId) : null;
  let end = clampInt(b.end_min, start + 5, 1440, NaN);
  if (Number.isNaN(end)) end = start + (service ? service.duration_min : 30);

  let clientId = Number(b.client_id) || null;
  if (!clientId && b.new_client && str(b.new_client.first_name)) {
    const info = db.prepare('INSERT INTO clients (first_name, last_name, email, phone) VALUES (?, ?, ?, ?)')
      .run(str(b.new_client.first_name, 100), str(b.new_client.last_name, 100),
           str(b.new_client.email, 200).toLowerCase(), str(b.new_client.phone, 50));
    clientId = Number(info.lastInsertRowid);
  }

  const status = APPT_STATUSES.has(b.status) ? b.status : 'booked';
  return { b, staffId, date: b.date, start, end, serviceId, clientId, status, notes: str(b.notes, 2000) };
}

route('POST', '/api/appointments', async ({ req }) => {
  const a = await apptBody(req);
  const conflict = findConflict(a.staffId, a.date, a.start, a.end);
  if (conflict && !a.b.force) {
    throw Object.assign(httpError(409, 'This time overlaps another appointment'), { data: { conflict } });
  }
  const info = db.prepare(
    `INSERT INTO appointments (client_id, staff_id, service_id, date, start_min, end_min, status, notes, source)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'staff')`
  ).run(a.clientId, a.staffId, a.serviceId, a.date, a.start, a.end, a.status, a.notes);
  return db.prepare(`${APPT_SELECT} WHERE a.id = ?`).get(info.lastInsertRowid);
});

route('PUT', '/api/appointments/:id', async ({ req, params }) => {
  if (!db.prepare('SELECT id FROM appointments WHERE id = ?').get(params.id)) throw httpError(404, 'Appointment not found');
  const a = await apptBody(req);
  const conflict = findConflict(a.staffId, a.date, a.start, a.end, params.id);
  if (conflict && !a.b.force) {
    throw Object.assign(httpError(409, 'This time overlaps another appointment'), { data: { conflict } });
  }
  db.prepare(
    `UPDATE appointments SET client_id = ?, staff_id = ?, service_id = ?, date = ?, start_min = ?, end_min = ?, status = ?, notes = ?
     WHERE id = ?`
  ).run(a.clientId, a.staffId, a.serviceId, a.date, a.start, a.end, a.status, a.notes, params.id);
  return db.prepare(`${APPT_SELECT} WHERE a.id = ?`).get(params.id);
});

route('PATCH', '/api/appointments/:id/status', async ({ req, params }) => {
  const { status } = await readJson(req);
  if (!APPT_STATUSES.has(status)) throw httpError(400, 'Invalid status');
  db.prepare('UPDATE appointments SET status = ? WHERE id = ?').run(status, params.id);
  return db.prepare(`${APPT_SELECT} WHERE a.id = ?`).get(params.id);
});

route('DELETE', '/api/appointments/:id', async ({ params }) => {
  db.prepare('DELETE FROM appointments WHERE id = ?').run(params.id);
  return { ok: true };
});

// ---------------------------------------------------------------------------
// Invoices & payments
// ---------------------------------------------------------------------------

const INVOICE_SELECT = `
  SELECT i.*,
    c.first_name || CASE WHEN c.last_name != '' THEN ' ' || c.last_name ELSE '' END AS client_name,
    c.email AS client_email, c.phone AS client_phone,
    COALESCE((SELECT CAST(ROUND(SUM(qty * unit_cents)) AS INTEGER) FROM invoice_items WHERE invoice_id = i.id), 0) AS subtotal_cents,
    COALESCE((SELECT SUM(amount_cents) FROM payments WHERE invoice_id = i.id), 0) AS paid_cents
  FROM invoices i
  LEFT JOIN clients c ON c.id = i.client_id`;

function invoiceTotals(inv) {
  const taxable = Math.max(0, inv.subtotal_cents - inv.discount_cents);
  inv.tax_cents = Math.round(taxable * (inv.tax_rate / 100));
  inv.total_cents = taxable + inv.tax_cents;
  inv.balance_cents = inv.total_cents - inv.paid_cents;
  return inv;
}

function getInvoice(id) {
  const inv = db.prepare(`${INVOICE_SELECT} WHERE i.id = ?`).get(id);
  if (!inv) throw httpError(404, 'Invoice not found');
  inv.items = db.prepare('SELECT * FROM invoice_items WHERE invoice_id = ? ORDER BY id').all(id);
  inv.payments = db.prepare('SELECT * FROM payments WHERE invoice_id = ? ORDER BY paid_at, id').all(id);
  return invoiceTotals(inv);
}

/** Flip a non-void invoice to `paid` when fully covered, back to `sent` otherwise. */
function refreshPaidStatus(id) {
  const inv = db.prepare(`${INVOICE_SELECT} WHERE i.id = ?`).get(id);
  if (!inv || inv.status === 'void' || inv.status === 'draft') return;
  invoiceTotals(inv);
  const next = inv.paid_cents >= inv.total_cents && inv.total_cents > 0 ? 'paid' : 'sent';
  if (next !== inv.status) db.prepare('UPDATE invoices SET status = ? WHERE id = ?').run(next, id);
}

route('GET', '/api/invoices', async ({ query }) => {
  const conds = [], args = [];
  const status = query.get('status');
  if (status && INVOICE_STATUSES.has(status)) { conds.push('i.status = ?'); args.push(status); }
  const q = str(query.get('q'), 100);
  if (q) {
    conds.push("(i.number LIKE ? OR c.first_name || ' ' || c.last_name LIKE ?)");
    args.push(`%${q}%`, `%${q}%`);
  }
  const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
  const rows = db.prepare(`${INVOICE_SELECT} ${where} ORDER BY i.id DESC LIMIT 500`).all(...args);
  return rows.map(invoiceTotals);
});

route('GET', '/api/invoices/:id', async ({ params }) => getInvoice(params.id));

function writeItems(invoiceId, items) {
  db.prepare('DELETE FROM invoice_items WHERE invoice_id = ?').run(invoiceId);
  const ins = db.prepare('INSERT INTO invoice_items (invoice_id, description, qty, unit_cents) VALUES (?, ?, ?, ?)');
  for (const it of items || []) {
    const desc = str(it.description, 300);
    if (!desc) continue;
    const qty = Math.max(0, Number(it.qty) || 1);
    const cents = Math.max(0, Math.round(Number(it.unit_cents) || 0));
    ins.run(invoiceId, desc, qty, cents);
  }
}

route('POST', '/api/invoices', async ({ req }) => {
  const b = await readJson(req);
  const clientId = Number(b.client_id) || null;
  const issue = isDateStr(b.issue_date) ? b.issue_date : todayStr();
  const dueDays = clampInt(getSetting('invoice_due_days', '7'), 0, 365, 7);
  const due = isDateStr(b.due_date) ? b.due_date : addDays(issue, dueDays);
  const taxRate = Number.isFinite(Number(b.tax_rate)) ? Number(b.tax_rate) : Number(getSetting('tax_rate', '0'));
  const status = INVOICE_STATUSES.has(b.status) ? b.status : 'draft';
  const info = db.prepare(
    `INSERT INTO invoices (number, client_id, appointment_id, issue_date, due_date, status, tax_rate, discount_cents, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(nextInvoiceNumber(), clientId, Number(b.appointment_id) || null, issue, due, status, taxRate,
        Math.max(0, Math.round(Number(b.discount_cents) || 0)), str(b.notes, 2000));
  writeItems(Number(info.lastInsertRowid), b.items);
  return getInvoice(Number(info.lastInsertRowid));
});

route('POST', '/api/invoices/from-appointment', async ({ req }) => {
  const { appointment_id } = await readJson(req);
  const appt = db.prepare(`${APPT_SELECT} WHERE a.id = ?`).get(Number(appointment_id));
  if (!appt) throw httpError(404, 'Appointment not found');
  if (appt.invoice_id) return getInvoice(appt.invoice_id);
  const issue = todayStr();
  const dueDays = clampInt(getSetting('invoice_due_days', '7'), 0, 365, 7);
  const info = db.prepare(
    `INSERT INTO invoices (number, client_id, appointment_id, issue_date, due_date, status, tax_rate)
     VALUES (?, ?, ?, ?, ?, 'draft', ?)`
  ).run(nextInvoiceNumber(), appt.client_id, appt.id, issue, addDays(issue, dueDays), Number(getSetting('tax_rate', '0')));
  const invId = Number(info.lastInsertRowid);
  if (appt.service_id) {
    db.prepare('INSERT INTO invoice_items (invoice_id, description, qty, unit_cents) VALUES (?, ?, 1, ?)')
      .run(invId, appt.service_name, appt.service_price_cents || 0);
  }
  return getInvoice(invId);
});

route('PUT', '/api/invoices/:id', async ({ req, params }) => {
  const existing = db.prepare('SELECT * FROM invoices WHERE id = ?').get(params.id);
  if (!existing) throw httpError(404, 'Invoice not found');
  const b = await readJson(req);
  db.prepare(
    'UPDATE invoices SET client_id = ?, issue_date = ?, due_date = ?, tax_rate = ?, discount_cents = ?, notes = ? WHERE id = ?'
  ).run(
    Number(b.client_id) || existing.client_id,
    isDateStr(b.issue_date) ? b.issue_date : existing.issue_date,
    isDateStr(b.due_date) ? b.due_date : existing.due_date,
    Number.isFinite(Number(b.tax_rate)) ? Number(b.tax_rate) : existing.tax_rate,
    Math.max(0, Math.round(Number(b.discount_cents) || 0)),
    str(b.notes, 2000),
    params.id
  );
  if (b.items) writeItems(params.id, b.items);
  refreshPaidStatus(params.id);
  return getInvoice(params.id);
});

route('PATCH', '/api/invoices/:id/status', async ({ req, params }) => {
  const { status } = await readJson(req);
  if (!INVOICE_STATUSES.has(status)) throw httpError(400, 'Invalid status');
  if (!db.prepare('SELECT id FROM invoices WHERE id = ?').get(params.id)) throw httpError(404, 'Invoice not found');
  db.prepare('UPDATE invoices SET status = ? WHERE id = ?').run(status, params.id);
  if (status === 'sent') refreshPaidStatus(params.id);
  return getInvoice(params.id);
});

route('DELETE', '/api/invoices/:id', async ({ params }) => {
  db.prepare('DELETE FROM invoices WHERE id = ?').run(params.id);
  return { ok: true };
});

route('POST', '/api/invoices/:id/payments', async ({ req, params }) => {
  const inv = db.prepare('SELECT * FROM invoices WHERE id = ?').get(params.id);
  if (!inv) throw httpError(404, 'Invoice not found');
  if (inv.status === 'void') throw httpError(400, 'Cannot record a payment on a void invoice');
  const b = await readJson(req);
  const amount = Math.round(Number(b.amount_cents));
  if (!Number.isFinite(amount) || amount <= 0) throw httpError(400, 'Payment amount must be positive');
  const method = PAY_METHODS.has(b.method) ? b.method : 'card';
  db.prepare('INSERT INTO payments (invoice_id, amount_cents, method, paid_at, note) VALUES (?, ?, ?, ?, ?)')
    .run(params.id, amount, method, `${todayStr()} ${new Date().toTimeString().slice(0, 8)}`, str(b.note, 500));
  if (inv.status === 'draft') db.prepare("UPDATE invoices SET status = 'sent' WHERE id = ?").run(params.id);
  refreshPaidStatus(params.id);
  return getInvoice(params.id);
});

route('DELETE', '/api/invoices/:id/payments/:pid', async ({ params }) => {
  db.prepare('DELETE FROM payments WHERE id = ? AND invoice_id = ?').run(params.pid, params.id);
  refreshPaidStatus(params.id);
  return getInvoice(params.id);
});

function addDays(date, days) {
  const d = new Date(`${date}T12:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

route('GET', '/api/dashboard', async () => {
  const today = todayStr();
  const weekAgo = addDays(today, -6);
  const monthAgo = addDays(today, -29);

  const todayRow = db.prepare(
    `SELECT COUNT(*) AS n, COALESCE(SUM(sv.price_cents), 0) AS expected
     FROM appointments a LEFT JOIN services sv ON sv.id = a.service_id
     WHERE a.date = ? AND a.status NOT IN ('cancelled', 'no_show')`
  ).get(today);

  const weekRevenue = db.prepare(
    'SELECT COALESCE(SUM(amount_cents), 0) AS v FROM payments WHERE substr(paid_at, 1, 10) >= ?'
  ).get(weekAgo).v;

  const outstanding = db.prepare(
    `SELECT COALESCE(SUM(t.balance), 0) AS v FROM (
       SELECT CAST(ROUND((COALESCE((SELECT SUM(qty * unit_cents) FROM invoice_items WHERE invoice_id = i.id), 0) - i.discount_cents)
              * (1 + i.tax_rate / 100)) AS INTEGER)
              - COALESCE((SELECT SUM(amount_cents) FROM payments WHERE invoice_id = i.id), 0) AS balance
       FROM invoices i WHERE i.status = 'sent'
     ) t WHERE t.balance > 0`
  ).get().v;

  const clientsTotal = db.prepare('SELECT COUNT(*) AS n FROM clients').get().n;
  const clientsNew = db.prepare("SELECT COUNT(*) AS n FROM clients WHERE substr(created_at, 1, 10) >= ?").get(monthAgo).n;

  const upcoming = db.prepare(
    `${APPT_SELECT}
     WHERE a.date >= ? AND a.status IN ('booked', 'confirmed')
     ORDER BY a.date, a.start_min LIMIT 8`
  ).all(today);

  const revenueByDay = [];
  for (let i = 6; i >= 0; i--) {
    const d = addDays(today, -i);
    const v = db.prepare('SELECT COALESCE(SUM(amount_cents), 0) AS v FROM payments WHERE substr(paid_at, 1, 10) = ?').get(d).v;
    revenueByDay.push({ date: d, cents: v });
  }

  const rhythmRows = db.prepare(
    `SELECT (start_min / 60) AS hour, COUNT(*) AS n FROM appointments
     WHERE date >= ? AND date <= ? AND status NOT IN ('cancelled') GROUP BY hour ORDER BY hour`
  ).all(monthAgo, today);
  const bookingsByHour = rhythmRows.map((r) => ({ hour: r.hour, count: r.n }));

  const topServices = db.prepare(
    `SELECT sv.name, COUNT(*) AS n, COALESCE(SUM(sv.price_cents), 0) AS revenue_cents
     FROM appointments a JOIN services sv ON sv.id = a.service_id
     WHERE a.date >= ? AND a.status NOT IN ('cancelled', 'no_show')
     GROUP BY sv.id ORDER BY n DESC LIMIT 5`
  ).all(monthAgo);

  return {
    today: { count: todayRow.n, expected_cents: todayRow.expected },
    week_revenue_cents: weekRevenue,
    outstanding_cents: outstanding,
    clients: { total: clientsTotal, new_30d: clientsNew },
    upcoming,
    revenue_by_day: revenueByDay,
    bookings_by_hour: bookingsByHour,
    top_services: topServices,
  };
});

// ---------------------------------------------------------------------------
// Public booking (no auth) — powers /book
// ---------------------------------------------------------------------------

route('GET', '/api/public/info', async () => {
  if (getSetting('booking_enabled', '1') !== '1') throw httpError(404, 'Online booking is disabled');
  return {
    business_name: getSetting('business_name'),
    business_phone: getSetting('business_phone'),
    business_address: getSetting('business_address'),
    currency: getSetting('currency', '$'),
    open_min: Number(getSetting('open_min', '480')),
    close_min: Number(getSetting('close_min', '1200')),
    services: db.prepare('SELECT id, name, category, duration_min, price_cents, description FROM services WHERE active = 1 ORDER BY category, name').all(),
    staff: db.prepare('SELECT id, name, title FROM staff WHERE active = 1 ORDER BY id').all(),
  };
}, { auth: false });

function freeSlotsFor(staffId, date, durationMin) {
  const open = Number(getSetting('open_min', '480'));
  const close = Number(getSetting('close_min', '1200'));
  const step = Math.max(5, Number(getSetting('slot_interval', '15')));
  const busy = db.prepare(
    "SELECT start_min, end_min FROM appointments WHERE staff_id = ? AND date = ? AND status NOT IN ('cancelled', 'no_show')"
  ).all(staffId, date);

  const now = new Date();
  const isToday = date === todayStr();
  const nowMin = now.getHours() * 60 + now.getMinutes();

  const slots = [];
  for (let t = open; t + durationMin <= close; t += step) {
    if (isToday && t <= nowMin) continue;
    if (!busy.some((b) => t < b.end_min && t + durationMin > b.start_min)) slots.push(t);
  }
  return slots;
}

route('GET', '/api/public/availability', async ({ query }) => {
  if (getSetting('booking_enabled', '1') !== '1') throw httpError(404, 'Online booking is disabled');
  const date = query.get('date');
  if (!isDateStr(date) || date < todayStr()) throw httpError(400, 'Choose an upcoming date');
  const service = db.prepare('SELECT * FROM services WHERE id = ? AND active = 1').get(Number(query.get('service_id')));
  if (!service) throw httpError(400, 'Choose a service');

  const staffParam = query.get('staff_id');
  const staffList = staffParam && staffParam !== 'any'
    ? db.prepare('SELECT id, name FROM staff WHERE id = ? AND active = 1').all(Number(staffParam))
    : db.prepare('SELECT id, name FROM staff WHERE active = 1 ORDER BY id').all();

  // slot -> first staff free at that time (keeps "Any available" simple and fair)
  const slotMap = new Map();
  for (const s of staffList) {
    for (const t of freeSlotsFor(s.id, date, service.duration_min)) {
      if (!slotMap.has(t)) slotMap.set(t, s.id);
    }
  }
  return {
    duration_min: service.duration_min,
    slots: [...slotMap.entries()].sort((a, b) => a[0] - b[0]).map(([start_min, staff_id]) => ({ start_min, staff_id })),
  };
}, { auth: false });

route('POST', '/api/public/book', async ({ req }) => {
  if (getSetting('booking_enabled', '1') !== '1') throw httpError(404, 'Online booking is disabled');
  const b = await readJson(req);
  const service = db.prepare('SELECT * FROM services WHERE id = ? AND active = 1').get(Number(b.service_id));
  if (!service) throw httpError(400, 'Choose a service');
  if (!isDateStr(b.date) || b.date < todayStr()) throw httpError(400, 'Choose an upcoming date');
  const start = clampInt(b.start_min, 0, 1439, NaN);
  if (Number.isNaN(start)) throw httpError(400, 'Choose a time');

  const first = str(b.client?.first_name, 100);
  const phone = str(b.client?.phone, 50);
  if (!first) throw httpError(400, 'Your first name is required');
  if (!phone && !str(b.client?.email)) throw httpError(400, 'A phone number or email is required');

  let staffId = Number(b.staff_id) || 0;
  const duration = service.duration_min;
  if (staffId) {
    if (!freeSlotsFor(staffId, b.date, duration).includes(start)) {
      throw httpError(409, 'That time was just taken — please pick another slot');
    }
  } else {
    const staffList = db.prepare('SELECT id FROM staff WHERE active = 1 ORDER BY id').all();
    staffId = staffList.find((s) => freeSlotsFor(s.id, b.date, duration).includes(start))?.id;
    if (!staffId) throw httpError(409, 'That time was just taken — please pick another slot');
  }

  const email = str(b.client?.email, 200).toLowerCase();
  let client = email ? db.prepare('SELECT * FROM clients WHERE email = ?').get(email) : null;
  if (!client && phone) client = db.prepare('SELECT * FROM clients WHERE phone = ? AND first_name = ?').get(phone, first);
  if (!client) {
    const info = db.prepare('INSERT INTO clients (first_name, last_name, email, phone) VALUES (?, ?, ?, ?)')
      .run(first, str(b.client?.last_name, 100), email, phone);
    client = { id: Number(info.lastInsertRowid) };
  }

  const info = db.prepare(
    `INSERT INTO appointments (client_id, staff_id, service_id, date, start_min, end_min, status, notes, source)
     VALUES (?, ?, ?, ?, ?, ?, 'booked', ?, 'online')`
  ).run(client.id, staffId, service.id, b.date, start, start + duration, str(b.notes, 1000));

  const appt = db.prepare(`${APPT_SELECT} WHERE a.id = ?`).get(info.lastInsertRowid);
  return {
    reference: `BK-${String(appt.id).padStart(5, '0')}`,
    date: appt.date, start_min: appt.start_min, end_min: appt.end_min,
    service: appt.service_name, staff: appt.staff_name,
    business_name: getSetting('business_name'),
  };
}, { auth: false });
