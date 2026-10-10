// The copy a salon leaves with.
//
// A refund switches the salon off and, a week later, deletes it. Before any of
// that, the owner is emailed their book in a form they can open: spreadsheets
// of their clients, appointments, invoices and services, plus the complete
// database for anyone who ever wants it restored. The refund screen promises
// this, so it is sent, not just read — the first version fetched the data,
// counted its bytes, and threw it away.
import { db, getSetting } from './db.js';
import { toCsv } from './util.js';
import { snapshot } from './backup.js';
import { sendEmail, looksLikeEmail } from './notify.js';
import { INVOICE_SELECT, invoiceTotals } from './api.js';

const MAX_EMAIL_BYTES = 20 * 1024 * 1024;

// A cell a spreadsheet would run as a formula is shown as text instead. The
// names and notes in here were typed by the public on the booking page.
const cell = (v) => (typeof v === 'string' && /^([=+@\t\r]|-\D)/.test(v) ? `'${v}` : v);
const csv = (columns, rows) => Buffer.from(`﻿${toCsv(columns, rows.map((r) => Object.fromEntries(
  Object.entries(r).map(([k, v]) => [k, cell(v)]),
)))}`, 'utf8');
const money = (c) => (Number(c || 0) / 100).toFixed(2);
const hhmm = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
const fullName = "c.first_name || CASE WHEN c.last_name != '' THEN ' ' || c.last_name ELSE '' END";

/** The spreadsheets, as attachments. Runs inside the salon (withTenant). */
export function partingFiles() {
  const clients = db.prepare('SELECT first_name, last_name, email, phone, notes, created_at FROM clients ORDER BY first_name, last_name').all();
  const appts = db.prepare(`
    SELECT a.date, a.start_min, a.end_min, a.status, a.source, a.notes,
      ${fullName} AS client, c.phone AS client_phone, c.email AS client_email,
      s.name AS staff,
      COALESCE((SELECT GROUP_CONCAT(sv.name, ' + ' ORDER BY x.sort_order) FROM appointment_services x
        JOIN services sv ON sv.id = x.service_id WHERE x.appointment_id = a.id), sv1.name, '') AS services
    FROM appointments a
    LEFT JOIN clients c ON c.id = a.client_id
    LEFT JOIN staff s ON s.id = a.staff_id
    LEFT JOIN services sv1 ON sv1.id = a.service_id
    ORDER BY a.date, a.start_min`).all()
    .map((r) => ({ ...r, start: hhmm(r.start_min), end: hhmm(r.end_min), source: r.source === 'online' ? 'Online' : 'In salon' }));
  const invoices = db.prepare(`${INVOICE_SELECT} ORDER BY i.issue_date, i.id`).all()
    .map((r) => invoiceTotals(r))
    .map((r) => ({ ...r, total: money(r.total_cents), paid: money(r.paid_cents), owing: money(r.balance_cents), discount: money(r.discount_cents) }));
  const payments = db.prepare(`
    SELECT p.paid_at, p.amount_cents, p.method, p.note, i.number, ${fullName} AS client
    FROM payments p JOIN invoices i ON i.id = p.invoice_id LEFT JOIN clients c ON c.id = i.client_id
    ORDER BY p.paid_at, p.id`).all().map((r) => ({ ...r, amount: money(r.amount_cents) }));
  const services = db.prepare('SELECT name, category, duration_min, price_cents, description, active FROM services ORDER BY category, name').all()
    .map((r) => ({ ...r, price: money(r.price_cents), active: r.active ? 'Yes' : 'No' }));

  return {
    counts: { clients: clients.length, appointments: appts.length, invoices: invoices.length },
    files: [
      { filename: 'clients.csv', content: csv([
        { key: 'first_name', label: 'First name' }, { key: 'last_name', label: 'Last name' },
        { key: 'email', label: 'Email' }, { key: 'phone', label: 'Phone' }, { key: 'notes', label: 'Notes' },
        { key: 'created_at', label: 'Added' },
      ], clients) },
      { filename: 'appointments.csv', content: csv([
        { key: 'date', label: 'Date' }, { key: 'start', label: 'Start' }, { key: 'end', label: 'End' },
        { key: 'client', label: 'Client' }, { key: 'client_phone', label: 'Client phone' }, { key: 'client_email', label: 'Client email' },
        { key: 'services', label: 'Services' }, { key: 'staff', label: 'With' }, { key: 'status', label: 'Status' },
        { key: 'source', label: 'Booked' }, { key: 'notes', label: 'Notes' },
      ], appts) },
      { filename: 'invoices.csv', content: csv([
        { key: 'number', label: 'Invoice' }, { key: 'issue_date', label: 'Date' }, { key: 'client_name', label: 'Client' },
        { key: 'status', label: 'Status' }, { key: 'discount', label: 'Discount' }, { key: 'total', label: 'Total' },
        { key: 'paid', label: 'Paid' }, { key: 'owing', label: 'Owing' },
      ], invoices) },
      { filename: 'payments.csv', content: csv([
        { key: 'paid_at', label: 'Paid' }, { key: 'number', label: 'Invoice' }, { key: 'client', label: 'Client' },
        { key: 'amount', label: 'Amount' }, { key: 'method', label: 'Method' }, { key: 'note', label: 'Note' },
      ], payments) },
      { filename: 'services.csv', content: csv([
        { key: 'name', label: 'Service' }, { key: 'category', label: 'Category' }, { key: 'duration_min', label: 'Minutes' },
        { key: 'price', label: 'Price' }, { key: 'active', label: 'On the menu' }, { key: 'description', label: 'Description' },
      ], services) },
    ],
  };
}

/**
 * Email the copy to `to`. Never throws: the answer says whether it went, and
 * the platform holds the deletion back if it did not.
 */
export async function emailPartingCopy(to) {
  if (!looksLikeEmail(to)) return { ok: false, detail: 'No valid address to send the copy to' };
  let built;
  let snap;
  try {
    built = partingFiles();
    snap = snapshot();
  } catch (err) {
    return { ok: false, detail: `Could not read the salon: ${String(err.message).slice(0, 160)}` };
  }
  const attachments = [...built.files];
  const sheetBytes = attachments.reduce((n, a) => n + a.content.length, 0);
  // The whole database rides along when it fits. The spreadsheets always do.
  const withDb = sheetBytes + snap.buffer.length <= MAX_EMAIL_BYTES;
  if (withDb) attachments.push({ filename: snap.filename, content: snap.buffer });
  if (sheetBytes > MAX_EMAIL_BYTES) return { ok: false, detail: 'Too large to email' };

  const biz = getSetting('business_name', 'your business');
  const { clients, appointments, invoices } = built.counts;
  const text = `Here is everything ${biz} had in Kairo, as you asked before your refund.\n\n`
    + `Attached:\n`
    + `- clients.csv — ${clients} client${clients === 1 ? '' : 's'}\n`
    + `- appointments.csv — ${appointments} appointment${appointments === 1 ? '' : 's'}, past and booked\n`
    + `- invoices.csv and payments.csv — ${invoices} invoice${invoices === 1 ? '' : 's'} and the payments against them\n`
    + `- services.csv — your menu\n`
    + (withDb ? `- ${snap.filename} — the complete database, if you ever want it restored\n` : '')
    + `\nThe .csv files open in Excel, Numbers or Google Sheets.\n\n`
    + `Keep this email. Your Kairo is switched off now, and its data is deleted for good 7 days from today.\n\n`
    + `Kairo · support@kairobookings.com`;
  const r = await sendEmail(to, `Your ${biz} data from Kairo`, text, '', { attachments });
  return { ok: r.ok, detail: r.ok ? `Emailed to ${to}` : r.detail, with_database: withDb, ...built.counts };
}
