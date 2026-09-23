// Consultation-first booking, end to end.
//
// The workflow this proves is the one a real salon owner asked for: she talks
// to every client before they get near the diary, so the booking page is off
// and she sends a link instead. See docs/09-consultation-first.md.
//
// The assertions that matter most are the negative ones. An invite that holds
// a slot it should have released, or one that books somebody without being
// paid, or a link that answers a stranger — each of those is worse than the
// feature not existing, because the owner has been told it works.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startKairo, openDateAhead } from './helpers/kairo.js';

let k, cookie;

// Every test takes its own day. A held invite is deliberately not released
// when a test ends, so tests sharing one date would run the salon out of slots
// halfway down the file and fail for a reason that has nothing to do with what
// they were checking.
let dayCursor = 3;
const nextDate = () => openDateAhead((dayCursor += 1));

before(async () => { k = await startKairo(); ({ cookie } = await k.login()); });
after(async () => { await k.stop(); });

/** Send a booking link for the first genuinely free slot on `date`. */
async function sendInvite(date, over = {}) {
  // The owner's own slot feed, not the public one: consultation-first closes
  // the public feed, and the owner still has to be able to see the week.
  const av = await k.api('GET', `/api/invites/slots?date=${date}&staff_id=1&service_ids=9`, { cookie });
  assert.ok(av.json.slots?.length, `no free slots left on ${date}`);
  const slot = over.start_min ?? av.json.slots[0].start_min;
  const r = await k.api('POST', '/api/invites', {
    cookie,
    body: { staff_id: 1, service_ids: [9], date, start_min: slot, ...over },
  });
  return { r, slot };
}

// ── The link itself ─────────────────────────────────────────────────────────

test('sending a link returns an unguessable URL and holds nothing else', async () => {
  const date = nextDate();
  const { r, slot } = await sendInvite(date, { note: 'Balayage, discussed on Instagram' });
  assert.equal(r.status, 200, r.text);
  const inv = r.json.invite;
  assert.equal(inv.status, 'open');
  assert.equal(inv.date, date);
  assert.equal(inv.start_min, slot);
  assert.equal(inv.end_min, slot + 60, 'the slot is as long as the service');
  assert.equal(inv.note, 'Balayage, discussed on Instagram');
  assert.match(inv.url, /\/invite\/[A-Za-z0-9_-]{40,}$/, 'the token is the credential, so it must be long');
  assert.equal(inv.services[0].name, 'Cut & Finish');
  assert.ok(inv.expires_at, 'an unanswered link must expire on its own');
});

test('the price defaults to the menu but the owner can override it', async () => {
  const date = nextDate();
  const menu = (await sendInvite(date)).r.json.invite;
  assert.ok(menu.price_cents > 0, 'the menu price comes across');
  const quoted = (await sendInvite(date, { price_cents: 18500 })).r.json.invite;
  assert.equal(quoted.price_cents, 18500, 'a price agreed in the consultation wins');
});

// ── Holding the slot ────────────────────────────────────────────────────────

test('a live invite takes its slot out of public availability', async () => {
  const date = nextDate();
  const { r, slot } = await sendInvite(date);
  assert.equal(r.status, 200);
  const av = await k.api('GET', `/api/public/availability?date=${date}&staff_id=1&service_ids=9`);
  const offered = av.json.slots.map((s) => s.start_min);
  assert.ok(!offered.includes(slot), 'a slot promised in a consultation must not be sold twice');
});

test('a second link cannot be sent for a slot the first one is holding', async () => {
  const date = nextDate();
  const { r, slot } = await sendInvite(date);
  assert.equal(r.status, 200);
  const again = await k.api('POST', '/api/invites', {
    cookie, body: { staff_id: 1, service_ids: [9], date, start_min: slot },
  });
  assert.equal(again.status, 409, 'two people must not be told the same slot is theirs');
});

test('the owner is warned before booking over a link they sent', async () => {
  const date = nextDate();
  const { r, slot } = await sendInvite(date);
  const inv = r.json.invite;
  const clash = await k.api('POST', '/api/appointments', {
    cookie, body: { client_id: 1, staff_id: 1, service_id: 9, date, start_min: slot },
  });
  assert.equal(clash.status, 409);
  assert.match(clash.json.error, /booking link/i);
  // Overridable, because the owner may be booking the very person it was for.
  const forced = await k.api('POST', '/api/appointments', {
    cookie, body: { client_id: 1, staff_id: 1, service_id: 9, date, start_min: slot, force: true },
  });
  assert.equal(forced.status, 200, 'the owner always wins when they insist');
  await k.api('DELETE', `/api/invites/${inv.id}`, { cookie });
});

test('cancelling a link gives the slot straight back', async () => {
  const date = nextDate();
  const { r, slot } = await sendInvite(date);
  const id = r.json.invite.id;
  const held = await k.api('GET', `/api/public/availability?date=${date}&staff_id=1&service_ids=9`);
  assert.ok(!held.json.slots.some((s) => s.start_min === slot));
  assert.equal((await k.api('DELETE', `/api/invites/${id}`, { cookie })).status, 200);
  const freed = await k.api('GET', `/api/public/availability?date=${date}&staff_id=1&service_ids=9`);
  assert.ok(freed.json.slots.some((s) => s.start_min === slot), 'a withdrawn link releases its slot');
});

// ── What the client sees ────────────────────────────────────────────────────

test('the public page shows the appointment and nothing about the salon\'s other clients', async () => {
  const date = nextDate();
  const { r } = await sendInvite(date, { note: 'Root touch-up' });
  const token = r.json.invite.token;
  const pub = await k.api('GET', `/api/public/invite?token=${encodeURIComponent(token)}`);
  assert.equal(pub.status, 200);
  const inv = pub.json.invite;
  assert.equal(inv.services[0].name, 'Cut & Finish');
  assert.equal(inv.staff_name, 'Sha');
  assert.equal(inv.business.name, 'Luxe Hair Studio');
  assert.ok(inv.brand.accent, 'it wears the salon\'s branding, not Kairo\'s');

  const text = JSON.stringify(pub.json);
  assert.doesNotMatch(text, /"id"\s*:\s*\d+\s*,\s*"token"/, 'no internal ids alongside the token');
  assert.doesNotMatch(text, /sk_(live|test)_|_api_key|session_secret/, 'no keys');
  assert.doesNotMatch(text, /example\.com/, 'no other client\'s email');
});

test('a wrong token says the same thing as a dead one', async () => {
  const bogus = await k.api('GET', '/api/public/invite?token=nope-not-a-real-token');
  assert.equal(bogus.status, 404);
  const empty = await k.api('GET', '/api/public/invite?token=');
  assert.equal(empty.status, 404, 'no token is not a different answer');
});

// ── Claiming ────────────────────────────────────────────────────────────────

test('claiming records who they are and still books nothing', async () => {
  const date = nextDate();
  const { r } = await sendInvite(date);
  const token = r.json.invite.token;
  const id = r.json.invite.id;
  const claim = await k.api('POST', '/api/public/invite/claim', {
    body: { token, name: 'Ruby Vance', email: 'ruby.vance@example.net' },
  });
  assert.equal(claim.status, 200, claim.text);
  assert.equal(claim.json.invite.status, 'claimed');
  assert.equal(claim.json.invite.client_name, 'Ruby Vance');

  const appts = await k.api('GET', `/api/appointments?from=${date}&to=${date}`, { cookie });
  assert.ok(!appts.json.some((a) => a.client_name === 'Ruby Vance'),
    'giving a name is not the same as being booked in');
  await k.api('DELETE', `/api/invites/${id}`, { cookie });
});

test('a claim with no way to reach them is refused', async () => {
  const date = nextDate();
  const { r } = await sendInvite(date);
  const token = r.json.invite.token;
  const none = await k.api('POST', '/api/public/invite/claim', { body: { token, name: 'No Contact' } });
  assert.equal(none.status, 400, 'a confirmation and a reminder need somewhere to go');
  const noName = await k.api('POST', '/api/public/invite/claim', { body: { token, name: '', phone: '0400111222' } });
  assert.equal(noName.status, 400);
  const badEmail = await k.api('POST', '/api/public/invite/claim', {
    body: { token, name: 'Typo', email: 'ruby at example dot net' },
  });
  assert.equal(badEmail.status, 400, 'a mistyped address is a confirmation that never arrives');
  await k.api('DELETE', `/api/invites/${r.json.invite.id}`, { cookie });
});

// ── Payment: the honest "I have paid" route ─────────────────────────────────

test('under a plain payment link, saying "I have paid" does NOT book it', async () => {
  const date = nextDate();
  const { r } = await sendInvite(date);
  const { token, id } = r.json.invite;
  await k.api('POST', '/api/public/invite/claim', {
    body: { token, name: 'Nina Poole', phone: '0400222333' },
  });
  const said = await k.api('POST', '/api/public/invite/declare-paid', { body: { token } });
  assert.equal(said.status, 200, said.text);
  assert.equal(said.json.awaiting, true, 'the page must say it is waiting, not that it is booked');
  assert.notEqual(said.json.booked, true);
  assert.equal(said.json.invite.status, 'paid');

  const appts = await k.api('GET', `/api/appointments?from=${date}&to=${date}`, { cookie });
  assert.ok(!appts.json.some((a) => a.client_name === 'Nina Poole'),
    'Kairo cannot see a payment-link payment, so it must not pretend it did');

  // The owner looks, and confirms. Only now is it real.
  const ok = await k.api('POST', `/api/invites/${id}/confirm`, { cookie });
  assert.equal(ok.status, 200, ok.text);
  assert.match(ok.json.reference, /^BK-\d{5}$/);
  const after = await k.api('GET', `/api/appointments?from=${date}&to=${date}`, { cookie });
  const made = after.json.find((a) => a.id === ok.json.appointment_id);
  assert.ok(made, 'confirming creates the appointment');
  assert.equal(made.client_name, 'Nina Poole');
  assert.equal(made.start_min, r.json.invite.start_min);
});

test('the confirmed booking gets the same messages as any other', async () => {
  const date = nextDate();
  const { r } = await sendInvite(date);
  const { token, id } = r.json.invite;
  await k.api('POST', '/api/public/invite/claim', {
    body: { token, name: 'Dana List', email: 'dana.list@example.net' },
  });
  await k.api('POST', '/api/public/invite/declare-paid', { body: { token } });
  const ok = await k.api('POST', `/api/invites/${id}/confirm`, { cookie });
  assert.equal(ok.status, 200);
  const d = k.db();
  const kinds = d.prepare('SELECT kind FROM messages WHERE appointment_id = ? ORDER BY kind')
    .all(ok.json.appointment_id).map((m) => m.kind);
  d.close();
  assert.ok(kinds.includes('confirmation'), 'a client who booked must be told they booked');
  assert.ok(kinds.includes('reminder'), 'and reminded, exactly like every other booking');
});

test('an owner cannot confirm a link nobody has opened', async () => {
  const date = nextDate();
  const { r } = await sendInvite(date);
  const id = r.json.invite.id;
  const early = await k.api('POST', `/api/invites/${id}/confirm`, { cookie });
  assert.equal(early.status, 409, 'there is nobody to book yet');
  await k.api('DELETE', `/api/invites/${id}`, { cookie });
});

test('confirming twice books once', async () => {
  const date = nextDate();
  const { r } = await sendInvite(date);
  const { token, id } = r.json.invite;
  await k.api('POST', '/api/public/invite/claim', { body: { token, name: 'Twice Over', phone: '0400999888' } });
  await k.api('POST', '/api/public/invite/declare-paid', { body: { token } });
  const first = await k.api('POST', `/api/invites/${id}/confirm`, { cookie });
  assert.equal(first.status, 200);
  const second = await k.api('POST', `/api/invites/${id}/confirm`, { cookie });
  assert.equal(second.status, 200);
  assert.equal(second.json.already, true, 'a double tap must not make a second appointment');
  const appts = await k.api('GET', `/api/appointments?from=${date}&to=${date}`, { cookie });
  const mine = appts.json.filter((a) => a.client_name === 'Twice Over');
  assert.equal(mine.length, 1);
});

// ── Declining and dead links ────────────────────────────────────────────────

test('declining releases the slot and the link stops working', async () => {
  const date = nextDate();
  const { r, slot } = await sendInvite(date);
  const token = r.json.invite.token;
  assert.equal((await k.api('POST', '/api/public/invite/decline', { body: { token } })).status, 200);
  const av = await k.api('GET', `/api/public/availability?date=${date}&staff_id=1&service_ids=9`);
  assert.ok(av.json.slots.some((s) => s.start_min === slot), 'a declined slot goes back on sale');
  const claim = await k.api('POST', '/api/public/invite/claim', { body: { token, name: 'Too Late', phone: '04001' } });
  assert.equal(claim.status, 409, 'a declined link is finished');
});

test('a cancelled link cannot be claimed, paid or accepted', async () => {
  const date = nextDate();
  const { r } = await sendInvite(date);
  const { token, id } = r.json.invite;
  await k.api('DELETE', `/api/invites/${id}`, { cookie });
  for (const [path, body] of [
    ['/api/public/invite/claim', { token, name: 'X', phone: '04002' }],
    ['/api/public/invite/declare-paid', { token }],
    ['/api/public/invite/accept', { token }],
  ]) {
    const res = await k.api('POST', path, { body });
    assert.equal(res.status, 409, `${path} must refuse a withdrawn link`);
  }
});

// ── Refusals at the edges ───────────────────────────────────────────────────

test('a link cannot be sent into the past, a closed day, or past the horizon', async () => {
  const date = nextDate();
  const past = await k.api('POST', '/api/invites', {
    cookie, body: { staff_id: 1, service_ids: [9], date: '2020-01-02', start_min: 600 },
  });
  assert.equal(past.status, 400);
  const far = await k.api('POST', '/api/invites', {
    cookie, body: { staff_id: 1, service_ids: [9], date: openDateAhead(400), start_min: 600 },
  });
  assert.equal(far.status, 400, 'the booking horizon applies to links too');
  const noService = await k.api('POST', '/api/invites', {
    cookie, body: { staff_id: 1, service_ids: [], date, start_min: 600 },
  });
  assert.equal(noService.status, 400);
  const noStaff = await k.api('POST', '/api/invites', {
    cookie, body: { staff_id: 9999, service_ids: [9], date, start_min: 600 },
  });
  assert.equal(noStaff.status, 400);
});

test('the owner routes need a login; the client routes must not', async () => {
  const date = nextDate();
  const anon = await k.api('GET', '/api/invites');
  assert.equal(anon.status, 401, 'a stranger must not be able to list who has been invited');
  const anonSend = await k.api('POST', '/api/invites', {
    body: { staff_id: 1, service_ids: [9], date, start_min: 600 },
  });
  assert.equal(anonSend.status, 401, 'a stranger must not be able to hold slots');
});

// ── Consultation mode itself ────────────────────────────────────────────────

test('consult_mode is off by default and changes nothing', async () => {
  const s = await k.api('GET', '/api/settings', { cookie });
  assert.equal(s.json.consult_mode, '0');
  assert.equal(s.json.invite_pay, 'link');
  assert.equal(s.json.invite_expiry_hours, '48');
});

test('with consult_mode on, self-serve booking is refused at the server', async () => {
  const date = nextDate();
  await k.api('PUT', '/api/settings', {
    cookie, body: { consult_mode: '1', consult_channel: 'instagram', consult_handle: '@luxehair' },
  });
  const own = await k.api('GET', `/api/invites/slots?date=${date}&staff_id=1&service_ids=9`, { cookie });
  const slot = own.json.slots?.[0]?.start_min ?? 600;
  const selfServe = await k.api('POST', '/api/public/book', {
    body: {
      service_ids: [9], staff_id: 1, date, start_min: slot,
      client: { first_name: 'Walk', last_name: 'In', email: 'walkin@example.net' },
    },
  });
  assert.equal(selfServe.status, 404,
    'hiding the picker is not enough — a saved link or a replayed request must be refused too');

  const info = await k.api('GET', '/api/public/info');
  assert.equal(info.json.consult.mode, true, 'the page needs to know to draw the other screen');
  assert.equal(info.json.consult.channel, 'instagram');
  assert.equal(info.json.consult.handle, '@luxehair');

  // Links still work — that is the whole point of the mode.
  const { r } = await sendInvite(date);
  assert.equal(r.status, 200, 'consultation mode is how invites are meant to be used');
  const token = r.json.invite.token;
  assert.equal((await k.api('GET', `/api/public/invite?token=${encodeURIComponent(token)}`)).status, 200);
  await k.api('PUT', '/api/settings', { cookie, body: { consult_mode: '0' } });
});

// ── The pages themselves ────────────────────────────────────────────────────
//
// Server-side tests cannot see a browser, but they can prove the wiring: that
// the link the owner pastes into a DM actually serves a page, and that the page
// loads the code meant to drive it. Both have exactly one chance to work — the
// client opens the link once.

test('the invite link serves the invite page, not the workspace shell', async () => {
  const date = nextDate();
  const { r } = await sendInvite(date);
  const token = r.json.invite.token;
  const page = await k.api('GET', `/invite/${encodeURIComponent(token)}`);
  assert.equal(page.status, 200);
  assert.match(page.text, /<title>Confirm your booking<\/title>/);
  assert.match(page.text, /\/js\/invite\.js/, 'the page must load the script that drives it');
  assert.match(page.text, /id="invite"/, 'and the element that script renders into');
  // The SPA fallback would serve index.html for an unknown path, which would
  // look like a working page and then render nothing.
  assert.doesNotMatch(page.text, /boot-splash/, 'this must not fall through to the workspace shell');
});

test('an unknown invite token still serves the page, which then says the link is dead', async () => {
  // Deliberate: the token is checked by the API, not by the router. A 404 here
  // would show a browser error page instead of the salon's own "this link has
  // expired, message us" card.
  const page = await k.api('GET', '/invite/not-a-real-token');
  assert.equal(page.status, 200);
  assert.match(page.text, /\/js\/invite\.js/);
  const api = await k.api('GET', '/api/public/invite?token=not-a-real-token');
  assert.equal(api.status, 404, 'the API is where the token is judged');
});

// ── Expiry ──────────────────────────────────────────────────────────────────
//
// The claim the whole design rests on: a link nobody answers gives its slot
// back on its own. Without this, one forgotten conversation sits on a Saturday
// afternoon until somebody notices — which is exactly the failure a salon owner
// would never forgive, because they would not know it had happened.

test('an expired link releases its slot and stops working', async () => {
  const date = nextDate();
  const { r, slot } = await sendInvite(date);
  const id = r.json.invite.id;
  const token = r.json.invite.token;

  const held = await k.api('GET', `/api/public/availability?date=${date}&staff_id=1&service_ids=9`);
  assert.ok(!held.json.slots.some((s) => s.start_min === slot), 'held while it is live');

  // Reach into the database and put the expiry in the past. Faster and more
  // honest than waiting 48 hours, and it exercises the real expiry path rather
  // than a test-only shortcut in the code.
  const d = k.db();
  d.prepare("UPDATE booking_invites SET expires_at = '2020-01-01 00:00:00' WHERE id = ?").run(id);
  d.close();

  const freed = await k.api('GET', `/api/public/availability?date=${date}&staff_id=1&service_ids=9`);
  assert.ok(freed.json.slots.some((s) => s.start_min === slot),
    'a link nobody answered must give the time back without anybody intervening');

  const pub = await k.api('GET', `/api/public/invite?token=${encodeURIComponent(token)}`);
  assert.equal(pub.json.invite.status, 'expired', 'and the client is told it expired, not left guessing');
  const claim = await k.api('POST', '/api/public/invite/claim', {
    body: { token, name: 'Too Slow', phone: '0400777666' },
  });
  assert.equal(claim.status, 409);
});

test('an expired link cannot be confirmed into a booking by the owner either', async () => {
  const date = nextDate();
  const { r } = await sendInvite(date);
  const { id, token } = r.json.invite;
  await k.api('POST', '/api/public/invite/claim', { body: { token, name: 'Lapsed Lee', phone: '0400555444' } });
  await k.api('POST', '/api/public/invite/declare-paid', { body: { token } });
  const d = k.db();
  d.prepare("UPDATE booking_invites SET expires_at = '2020-01-01 00:00:00' WHERE id = ?").run(id);
  d.close();
  const late = await k.api('POST', `/api/invites/${id}/confirm`, { cookie });
  assert.equal(late.status, 409, 'the slot is back on sale — booking it now could double-book somebody');
});

test('the setup checklist stops asking for a test booking that cannot be made', async () => {
  const before = await k.api('GET', '/api/checklist', { cookie });
  const ids = (list) => list.items.map((i) => i.id);
  assert.ok(ids(before.json).includes('test_booking'));
  assert.ok(!ids(before.json).includes('test_invite'));

  await k.api('PUT', '/api/settings', { cookie, body: { consult_mode: '1' } });
  const after = await k.api('GET', '/api/checklist', { cookie });
  assert.ok(!ids(after.json).includes('test_booking'),
    'self-serve booking is refused in this mode, so asking them to try one is a dead end');
  assert.ok(ids(after.json).includes('test_invite'), 'the equivalent step is sending a link');
  await k.api('PUT', '/api/settings', { cookie, body: { consult_mode: '0' } });
});

// ── The forwarded link ──────────────────────────────────────────────────────
//
// The token is unguessable but a link travels: forwarded, screenshotted,
// pasted into a group chat. So the page must never hand out contact details
// the salon holds about somebody — only the ones the person in front of it
// typed there themselves.

test('a link composed against an existing client does not leak their details', async () => {
  const date = nextDate();
  const clients = await k.api('GET', '/api/clients', { cookie });
  const known = (clients.json.clients || clients.json).find((c) => c.email);
  assert.ok(known, 'the demo salon has clients with contact details');

  const av = await k.api('GET', `/api/invites/slots?date=${date}&staff_id=1&service_ids=9`, { cookie });
  const r = await k.api('POST', '/api/invites', {
    cookie,
    body: {
      staff_id: 1, service_ids: [9], date, start_min: av.json.slots[0].start_min,
      client_id: known.id,
    },
  });
  assert.equal(r.status, 200, r.text);
  // The owner sees the whole record — it is their client.
  assert.equal(r.json.invite.client_email, known.email);

  // Anybody holding the link does not.
  const pub = await k.api('GET', `/api/public/invite?token=${encodeURIComponent(r.json.invite.token)}`);
  assert.equal(pub.status, 200);
  assert.equal(pub.json.invite.client_email, '', 'a forwarded link must not disclose an email');
  assert.equal(pub.json.invite.client_phone, '', 'nor a mobile number');
  assert.equal(pub.json.invite.client_name, '', 'nor who the salon thinks it is for');
  assert.doesNotMatch(JSON.stringify(pub.json), new RegExp(known.email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'));

  // Once they type their own details, those come back — they are theirs.
  const claim = await k.api('POST', '/api/public/invite/claim', {
    body: { token: r.json.invite.token, name: 'Self Typed', email: 'self.typed@example.net' },
  });
  assert.equal(claim.json.invite.client_email, 'self.typed@example.net');
  await k.api('DELETE', `/api/invites/${r.json.invite.id}`, { cookie });
});

// ── The money, once it is confirmed ─────────────────────────────────────────
//
// The salon has already been paid by the time the client walks in. If Kairo
// doesn't know that, the till asks for the full amount a second time with the
// client standing there — which is worse than not taking the payment up front
// at all.

test('a confirmed payment lands on the booking and then on the invoice', async () => {
  const date = nextDate();
  const { r } = await sendInvite(date, { price_cents: 14500 });
  const { token, id } = r.json.invite;
  await k.api('POST', '/api/public/invite/claim', {
    body: { token, name: 'Paid Upfront', email: 'paid.upfront@example.net' },
  });
  await k.api('POST', '/api/public/invite/declare-paid', { body: { token } });
  const ok = await k.api('POST', `/api/invites/${id}/confirm`, { cookie });
  assert.equal(ok.status, 200, ok.text);

  const d = k.db();
  const appt = d.prepare('SELECT deposit_cents, deposit_status, pay_provider FROM appointments WHERE id = ?')
    .get(ok.json.appointment_id);
  d.close();
  assert.equal(appt.deposit_status, 'paid');
  assert.equal(appt.deposit_cents, 14500, 'the amount agreed in the consultation');
  assert.equal(appt.pay_provider, 'manual',
    'recorded as the owner\'s word, because no processor confirmed it');

  // And it carries through to the bill, so nobody is charged twice.
  const invoice = await k.api('POST', '/api/invoices/from-appointment', {
    cookie, body: { appointment_id: ok.json.appointment_id },
  });
  assert.equal(invoice.status, 200, invoice.text);
  const paid = (invoice.json.payments || []).reduce((sum, p) => sum + p.amount_cents, 0);
  assert.equal(paid, 14500, 'the money already taken shows as a payment on the invoice');
  assert.match((invoice.json.payments || [])[0].note, /booking link/i,
    'and says where it came from, rather than claiming Stripe confirmed it');
});
