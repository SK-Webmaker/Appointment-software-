// What a treatment needs before it can happen, and whether this client has it.
//
// Hair colour needs a patch test; PPD allergy can cause anaphylaxis. Lash and
// brow tint, peels and injectables carry consent and contraindication
// requirements. Insurers expect the records. Today most salons keep this in a
// paper book or in a free-text note — prose a computer cannot act on — and if a
// client reacts, "we always do patch tests" is not evidence.
//
// Four rules run through everything here.
//
//   1. KAIRO RECORDS, IT NEVER DECIDES. Nothing in this file judges whether a
//      treatment is safe for anybody. It answers one narrow question — is the
//      record the salon said it needed actually there — and hands the answer to
//      a human. A "pass" is a fact somebody wrote down, not an opinion Kairo
//      formed.
//   2. INERT UNTIL ASKED. A salon that never marks a service as needing
//      anything sees no change anywhere: no gate, no notice, no extra step.
//   3. A FAILED TEST IS NOT A MISSING ONE. Missing means "book a patch test".
//      Failed means a human needs to be involved, and no automatic flow may
//      quietly offer to test them again as though nothing happened.
//   4. THE CLIENT IS NEVER TOLD WHAT WE HOLD ON THEM. Every public-facing
//      answer here is identical for a stranger and for a client with an expired
//      test, so the booking page can never be used to find out whether somebody
//      is a client or what is in their record.
import { db, getSetting } from './db.js';
import { addDaysStr, clampInt, isDateStr, nowParts } from './util.js';

// ---------------------------------------------------------------------------
// Photos: the cap that keeps 1 GB from disappearing
// ---------------------------------------------------------------------------

/**
 * The hard per-photo limit, on the DECODED image rather than the data URI.
 *
 * The persistent disk on the platform is 1 GB and photos are stored as data
 * URIs the way brand logos already are. A full-resolution phone camera photo is
 * 3–6 MB; at that size a busy salon fills the disk in months, and the failure
 * shows up as bookings that stop saving rather than as anything about photos.
 *
 * 400 KB is a 1280px-wide JPEG at good quality — plenty to show a colour result
 * or evidence for a claim, and roughly 2,500 photos per gigabyte with the rest
 * of the business alongside. The browser resizes before it uploads; this is the
 * backstop for anything that arrives another way.
 */
export const PHOTO_MAX_BYTES = 400 * 1024;

/** Per appointment. Before-and-after with a couple of angles, not an album. */
export const PHOTO_MAX_PER_APPOINTMENT = 8;

/** Longest edge the browser resizes to before uploading. */
export const PHOTO_MAX_EDGE = 1280;

/**
 * Decoded size of a data: URI, without materialising the bytes.
 *
 * Base64 is 4 characters per 3 bytes, so the arithmetic is exact once the
 * padding is taken off. Doing it this way means a 10 MB upload is rejected by
 * reading its length rather than by decoding 10 MB first.
 */
export function dataUriBytes(uri) {
  const s = String(uri || '');
  const i = s.indexOf('base64,');
  if (i < 0) return 0;
  const b64 = s.slice(i + 7).replace(/\s/g, '');
  const pad = b64.endsWith('==') ? 2 : b64.endsWith('=') ? 1 : 0;
  return Math.max(0, Math.floor(b64.length * 3 / 4) - pad);
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

export function safetySettings() {
  return {
    // The service used to book a patch test — usually free and ten minutes.
    // Blank means the salon has not set one up, and the gate then says "call
    // us" instead of offering a booking it cannot make.
    patch_service_id: Number(getSetting('patch_service_id', '')) || 0,
    // How long a patch test must sit before the treatment. 48 hours is the
    // manufacturer instruction on every box of colour sold in Australia.
    patch_lead_hours: clampInt(getSetting('patch_lead_hours', '48'), 0, 720, 48),
    patch_valid_months: clampInt(getSetting('patch_valid_months', '6'), 1, 60, 6),
  };
}

/** The patch-test service itself, if the salon has picked one and it is live. */
export function patchService() {
  const id = safetySettings().patch_service_id;
  if (!id) return null;
  return db.prepare('SELECT id, name, duration_min, price_cents, price_type FROM services WHERE id = ? AND active = 1').get(id) || null;
}

// ---------------------------------------------------------------------------
// Requirements
// ---------------------------------------------------------------------------

export const REQUIREMENT_KINDS = new Set(['patch_test', 'consent']);

/** Every requirement on a set of services, with the service's name attached. */
export function requirementsFor(serviceIds) {
  const ids = [...new Set((serviceIds || []).map(Number).filter(Boolean))];
  if (!ids.length) return [];
  return db.prepare(
    `SELECT r.*, s.name AS service_name
       FROM service_requirements r
       JOIN services s ON s.id = r.service_id
      WHERE r.service_id IN (${ids.map(() => '?').join(',')})
      ORDER BY s.name, r.kind`
  ).all(...ids);
}

/**
 * The public shape: which services need what, with no client in it at all.
 *
 * Safe to hand to anybody, because it is the salon's own policy — the same
 * sentence that is printed on the wall of every colour bar in the country.
 */
export function publicRequirements() {
  const rows = db.prepare(
    `SELECT r.service_id, r.kind, r.valid_months, r.consent_text
       FROM service_requirements r JOIN services s ON s.id = r.service_id
      WHERE s.active = 1`
  ).all();
  const out = {};
  for (const r of rows) {
    const e = out[r.service_id] || (out[r.service_id] = {});
    if (r.kind === 'patch_test') e.patch_test = { valid_months: r.valid_months };
    if (r.kind === 'consent') e.consent = { text: r.consent_text };
  }
  return out;
}

// ---------------------------------------------------------------------------
// Patch tests
// ---------------------------------------------------------------------------

/** Add whole months to a YYYY-MM-DD, clamping 31 Jan + 1 month to 28/29 Feb. */
export function addMonthsStr(dateStr, months) {
  if (!isDateStr(dateStr)) return dateStr;
  const [y, m, d] = dateStr.split('-').map(Number);
  const total = (y * 12) + (m - 1) + Math.round(months);
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  const last = new Date(Date.UTC(ny, nm, 0)).getUTCDate();
  const nd = Math.min(d, last);
  return `${String(ny).padStart(4, '0')}-${String(nm).padStart(2, '0')}-${String(nd).padStart(2, '0')}`;
}

/**
 * Where this client stands on patch tests for one service, as at `on`.
 *
 * Returns one of four states, and the difference between them is the whole
 * feature:
 *   none    — nothing on file. Book a test.
 *   ok      — a pass, still inside its validity on the day of the treatment.
 *   expired — a pass, but it will have lapsed by then. Also book a test.
 *   failed  — a recorded reaction. A human deals with this, never a flow.
 *
 * A fail always wins over any pass, however recent the pass is, until somebody
 * in the salon deliberately records a later one. That is the conservative
 * direction, and it is the direction an insurer would expect.
 */
export function patchStatusFor(clientId, serviceId, { on, validMonths } = {}) {
  const months = validMonths || requirementValidMonths(serviceId);
  const day = isDateStr(on) ? on : null;
  const out = { state: 'none', tested_on: '', expires_on: '', result: '', valid_months: months };
  if (!clientId) return out;

  // Tests recorded against this service, plus the general ones (service_id
  // NULL) that a salon records when it patch-tests the person rather than the
  // product. Newest first.
  const rows = db.prepare(
    `SELECT tested_on, result, product, service_id FROM patch_tests
      WHERE client_id = ? AND (service_id IS NULL OR service_id = ?)
      ORDER BY tested_on DESC, id DESC`
  ).all(clientId, Number(serviceId) || 0);
  if (!rows.length) return out;

  const fail = rows.find((r) => r.result === 'fail');
  const pass = rows.find((r) => r.result === 'pass');
  if (fail && (!pass || pass.tested_on <= fail.tested_on)) {
    return { ...out, state: 'failed', tested_on: fail.tested_on, result: 'fail' };
  }
  if (!pass) return out;

  const expires = addMonthsStr(pass.tested_on, months);
  return {
    ...out,
    state: day && expires < day ? 'expired' : 'ok',
    tested_on: pass.tested_on,
    expires_on: expires,
    result: 'pass',
  };
}

/** The validity a service asks for, or the salon's default. */
export function requirementValidMonths(serviceId) {
  const row = db.prepare(
    "SELECT valid_months FROM service_requirements WHERE service_id = ? AND kind = 'patch_test'"
  ).get(Number(serviceId) || 0);
  return row?.valid_months || safetySettings().patch_valid_months;
}

// ---------------------------------------------------------------------------
// The gate
// ---------------------------------------------------------------------------

/**
 * May this booking go ahead, and what is missing if not.
 *
 * The one function the booking route enforces with, the booking page explains
 * with, and the client's own record displays — so the three can never drift
 * apart and start telling different stories about the same person.
 *
 * `consents` is what the client has just agreed to in this submission, as
 * `[{ service_id, typed_name }]`. Consent already on file for the same service
 * counts too: a salon that took a signature on the first visit should not ask
 * for it again every time.
 */
export function safetyGateFor(clientId, serviceIds, { date, consents = [] } = {}) {
  const reqs = requirementsFor(serviceIds);
  const out = {
    ok: true,
    // Needs a patch test booked before this can happen.
    patch_test_needed: null,
    // Needs a human, and no flow may route around it.
    call_us: false,
    // Wording the client still has to agree to, in their own words.
    consents_needed: [],
    // Wording they have just agreed to in this submission, with the name they
    // typed — everything the caller needs to write the record down.
    //
    // This list is the whole reason the gate returns it rather than leaving the
    // caller to work it out from consents_needed: once somebody agrees, the
    // requirement drops OFF consents_needed, so a caller reading only that list
    // takes the booking and stores nothing. The client agreed, the appointment
    // happened, and there is no record of it — which is the exact failure this
    // feature exists to prevent.
    consents_given: [],
    reason: '',
    client_note: '',
  };
  if (!reqs.length) return out;

  const agreed = new Map((consents || [])
    .filter((c) => c && Number(c.service_id) && String(c.typed_name || '').trim())
    .map((c) => [Number(c.service_id), String(c.typed_name).trim()]));

  for (const r of reqs) {
    if (r.kind === 'consent') {
      if (!String(r.consent_text || '').trim()) continue; // nothing to agree to
      if (agreed.has(r.service_id)) {
        out.consents_given.push({
          service_id: r.service_id, service_name: r.service_name,
          text: r.consent_text, typed_name: agreed.get(r.service_id),
        });
        continue;
      }
      if (hasConsentOnFile(clientId, r.service_id, r.consent_text)) continue;
      out.consents_needed.push({
        service_id: r.service_id, service_name: r.service_name, text: r.consent_text,
      });
      continue;
    }
    if (r.kind !== 'patch_test') continue;
    const st = patchStatusFor(clientId, r.service_id, { on: date, validMonths: r.valid_months });
    if (st.state === 'ok') continue;
    if (st.state === 'failed') {
      out.ok = false;
      out.call_us = true;
      out.reason = `Patch test recorded as a reaction on ${st.tested_on}`;
      // Says nothing about what is on file. Identical to the sentence a blocked
      // client gets, deliberately.
      out.client_note = 'We need a quick word before booking this one in — please give us a call.';
      return out;
    }
    // Missing or expired: the same offer either way, and the same words, so the
    // page cannot be read as a lookup of what we hold.
    if (!out.patch_test_needed) {
      out.ok = false;
      out.patch_test_needed = {
        service_id: r.service_id,
        service_name: r.service_name,
        valid_months: r.valid_months,
        lead_hours: safetySettings().patch_lead_hours,
      };
      out.reason = st.state === 'expired'
        ? `Patch test expired (${st.expires_on})` : 'No patch test on file';
      out.client_note = `${r.service_name} needs a patch test first.`;
    }
  }

  if (out.consents_needed.length) out.ok = false;
  return out;
}

/**
 * Has this client already agreed to this exact wording for this service?
 *
 * Matched on the words, not on the requirement's id. If the owner rewrites the
 * form — adds a sentence about aftercare, say — everybody consents again, which
 * is the correct and slightly annoying answer. A consent that silently carried
 * over to text somebody never read would be worth nothing at the only moment it
 * ever matters.
 */
export function hasConsentOnFile(clientId, serviceId, text) {
  if (!clientId) return false;
  const row = db.prepare(
    'SELECT id FROM consents WHERE client_id = ? AND service_id = ? AND body = ? LIMIT 1'
  ).get(clientId, Number(serviceId) || 0, String(text || ''));
  return Boolean(row);
}

/** Write one consent down, with the wording as it stood at that moment. */
export function recordConsent({ clientId, appointmentId = null, serviceId, serviceName = '', body, typedName, takenBy = 'client' }) {
  return db.prepare(
    `INSERT INTO consents (client_id, appointment_id, service_id, service_name, body, typed_name, taken_by)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(clientId, appointmentId, Number(serviceId) || null, String(serviceName || ''),
    String(body || ''), String(typedName || ''), String(takenBy || ''));
}

// ---------------------------------------------------------------------------
// Expiring ahead of time
// ---------------------------------------------------------------------------

/**
 * Clients whose patch test lapses before an appointment they have already
 * booked — found early enough to do something about it.
 *
 * The whole value is in the timing. "Your patch test has expired" on the
 * morning of a four-hour balayage is a cancelled appointment and a wasted
 * chair; the same sentence three weeks out is a ten-minute visit nobody
 * remembers. Only future appointments, only services that actually require a
 * test, and only where the test will have lapsed by the day.
 */
export function expiringPatchTests({ today, withinDays = 28 } = {}) {
  const from = today;
  const to = addDaysStr(today, Math.max(1, withinDays));
  const rows = db.prepare(
    `SELECT a.id AS appointment_id, a.client_id, a.date, a.start_min,
            s.id AS service_id, s.name AS service_name, r.valid_months
       FROM appointments a
       JOIN appointment_services aps ON aps.appointment_id = a.id
       JOIN services s ON s.id = aps.service_id
       JOIN service_requirements r ON r.service_id = s.id AND r.kind = 'patch_test'
      WHERE a.date >= ? AND a.date <= ?
        AND a.status NOT IN ('cancelled', 'no_show', 'completed')
        AND a.client_id IS NOT NULL
      ORDER BY a.date, a.start_min`
  ).all(from, to);

  const out = [];
  const seen = new Set();
  for (const r of rows) {
    const key = `${r.appointment_id}:${r.service_id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const st = patchStatusFor(r.client_id, r.service_id, { on: r.date, validMonths: r.valid_months });
    // Only the ones that HAVE a test which runs out. Somebody with none at all
    // is a different problem and a different message, and chasing them here
    // would tell a brand-new client their patch test is expiring.
    if (st.state !== 'expired') continue;
    out.push({ ...r, tested_on: st.tested_on, expires_on: st.expires_on });
  }
  return out;
}

/**
 * The whole safety picture for one client, for their record and for the
 * printable export. One query set, so the screen and the document can never
 * disagree about what is on file.
 */
export function safetyRecord(clientId) {
  const id = Number(clientId) || 0;
  const flags = db.prepare('SELECT * FROM client_safety WHERE client_id = ?').get(id)
    || { client_id: id, pregnant: 0, allergies: '', medications: '', conditions: '', notes: '', updated_at: '', updated_by: '' };
  const tests = db.prepare(
    `SELECT p.*, s.name AS service_name FROM patch_tests p
       LEFT JOIN services s ON s.id = p.service_id
      WHERE p.client_id = ? ORDER BY p.tested_on DESC, p.id DESC`
  ).all(id);
  const consents = db.prepare(
    'SELECT * FROM consents WHERE client_id = ? ORDER BY agreed_at DESC, id DESC'
  ).all(id);
  const photos = db.prepare(
    `SELECT id, appointment_id, kind, note, bytes, created_at FROM treatment_photos
      WHERE client_id = ? ORDER BY created_at DESC, id DESC`
  ).all(id);

  // Where they stand right now on every service that asks for a test, whether
  // or not they have one booked — this is what the owner glances at.
  const gated = db.prepare(
    `SELECT s.id, s.name, r.valid_months FROM service_requirements r
       JOIN services s ON s.id = r.service_id
      WHERE r.kind = 'patch_test' AND s.active = 1 ORDER BY s.name`
  ).all();
  const standing = gated.map((g) => ({
    service_id: g.id,
    service_name: g.name,
    ...patchStatusFor(id, g.id, { on: bizToday(), validMonths: g.valid_months }),
  }));

  return { flags, patch_tests: tests, consents, photos, patch_standing: standing };
}

/**
 * Today where the business is, never where the server is.
 *
 * On a hosted box the server clock is UTC, so at 10am in Melbourne it believes
 * it is 11pm yesterday — and a patch test that expires today would read as
 * still valid for the whole morning.
 */
export const bizToday = () => nowParts(getSetting('business_tz', '')).date;
