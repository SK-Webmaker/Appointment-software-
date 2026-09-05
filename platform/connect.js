// Connecting a salon's email, in one paste.
//
// The business (or the owner, from the queue) creates a free Resend account and
// pastes one full-access key. Everything after that is this file: add the
// sending domain to THEIR account, write the DNS Resend asks for into the
// platform's zone, wait for Resend to confirm it, mint a key that can only send
// and only from that one domain, install that key in their Kairo, prove it by
// sending a real message, and delete the setup key.
//
// The full-access key exists in memory for about a minute and is never written
// to disk. What survives is a sending-only key in the salon's own instance and
// a domain in the salon's own Resend account.
import { db, record, setSetting } from './db.js';
import * as resend from './resend.js';
import * as cf from './cloudflare.js';
import * as shard from './shard.js';

export const REGION = () => String(process.env.RESEND_REGION || 'ap-northeast-1');
const VERIFY_TRIES = Number(process.env.RESEND_VERIFY_TRIES || 20);
const VERIFY_WAIT_MS = Number(process.env.RESEND_VERIFY_WAIT_MS || 3000);

function state(id, s, detail = '') {
  db.prepare('UPDATE businesses SET email_state = ?, email_detail = ? WHERE id = ?').run(s, String(detail).slice(0, 500), id);
  record(id, `email:${s}`, detail);
}

/**
 * @param {number} businessId
 * @param {string} setupKey  a full-access Resend key belonging to the business
 * @param {{domain?: string}} opts  their own domain, if they have one
 */
export async function connectEmail(businessId, setupKey, { domain: ownDomain = '' } = {}) {
  const b = db.prepare('SELECT * FROM businesses WHERE id = ?').get(businessId);
  if (!b) throw Object.assign(new Error('No such business'), { status: 404 });
  if (b.state !== 'ready') throw Object.assign(new Error(`That salon is ${b.state}, so there is nothing to connect email to yet`), { status: 409 });
  if (b.email_state === 'working' || b.email_state === 'verifying') {
    const started = Date.parse(b.email_started_at || '') || 0;
    if (Date.now() - started < 10 * 60 * 1000) throw Object.assign(new Error('That is already in progress. Give it a minute.'), { status: 409 });
  }

  const zone = String(process.env.KAIRO_BASE_DOMAIN || 'kairobookings.com').toLowerCase();
  const domain = (ownDomain || `${b.slug}.${zone}`).trim().toLowerCase();
  const onPlatformZone = domain === `${b.slug}.${zone}` || domain.endsWith(`.${zone}`);

  const key = await resend.checkKey(setupKey);
  if (!key.ok) throw Object.assign(new Error(key.detail), { status: 400 });

  db.prepare("UPDATE businesses SET email_domain = ?, email_started_at = datetime('now') WHERE id = ?").run(domain, businessId);
  state(businessId, 'working', `adding ${domain} to their Resend`);

  try {
    // 1. Their account, their domain.
    const created = await resend.ensureDomain(setupKey, domain, REGION());
    const wanted = resend.recordsFor(created);
    if (!wanted.length) throw new Error('Resend returned no DNS records to add — nothing to do, which cannot be right');

    // 2. The DNS. Only the platform can write it, and only inside its own zone;
    //    a business on its own domain gets the records to add themselves.
    let dns = [];
    if (onPlatformZone) {
      if (!cf.cloudflareConfigured()) throw new Error('No Cloudflare token is configured on the platform, so the DNS cannot be written');
      dns = await cf.ensureRecords(zone, wanted);
      const clash = dns.find((r) => !r.ok);
      if (clash) throw new Error(`${clash.type} ${clash.name} already exists with a different value — someone must look at it`);
      await cf.ensureDmarc(zone);
      record(businessId, 'email:dns', dns.map((r) => `${r.type} ${r.name}: ${r.action}`).join(' · '));
    } else {
      record(businessId, 'email:dns', `their own domain — ${wanted.length} records for them to add`);
    }

    // 3. Ask Resend to look, then wait for it to say yes.
    state(businessId, 'verifying', `waiting for ${domain} to verify`);
    await resend.verifyDomain(setupKey, created.id).catch(() => { /* verify is a nudge; the poll below is the truth */ });
    let status = '';
    for (let i = 0; i < VERIFY_TRIES; i++) {
      // eslint-disable-next-line no-await-in-loop
      status = String((await resend.getDomain(setupKey, created.id)).status || '').toLowerCase();
      if (status === 'verified') break;
      if (status === 'failed') break;
      // eslint-disable-next-line no-await-in-loop
      await new Promise((r) => setTimeout(r, VERIFY_WAIT_MS));
    }
    if (status !== 'verified') {
      const err = onPlatformZone
        ? `Resend has not verified ${domain} yet (it says "${status || 'pending'}"). The records are written; this usually clears within the hour.`
        : `Resend has not verified ${domain} yet. Add these records at your registrar, then try again:\n${wanted.map((r) => `${r.type}  ${r.name}  ${r.content}`).join('\n')}`;
      throw Object.assign(new Error(err), { retryable: true, records: wanted });
    }

    // 4. A key that can only send, and only as them.
    const sending = await resend.createSendingKey(setupKey, `Kairo — ${b.slug}`, created.id);
    if (!sending?.token) throw new Error('Resend did not return a sending key');

    // 5. Into their Kairo, through the control API.
    const owner = db.prepare('SELECT email FROM owners WHERE id = ?').get(b.owner_id);
    await shard.putSettings(b.slug, {
      resend_api_key: sending.token,
      notif_from_email: `hello@${domain}`,
      notif_reply_to: owner.email,
    });

    // 6. Prove it. A green tick nobody earned is the kind that fails on a
    //    Saturday night, so this is a real message to a real inbox.
    const test = await shard.testMessage(b.slug, { channel: 'email', to: owner.email }).catch((e) => ({ ok: false, detail: e.message }));
    record(businessId, 'email:test', test.ok ? `delivered to ${owner.email}` : `test send said: ${test.detail}`);
    if (!test.ok) throw new Error(`The key is in, but the test message did not send: ${test.detail}`);

    // 7. The setup key has done its job.
    try {
      const mine = (await resend.listKeys(setupKey)).find((k) => k.name === 'Kairo setup');
      if (mine) { await resend.deleteKey(setupKey, mine.id); record(businessId, 'email:cleanup', 'setup key deleted from their account'); }
    } catch (e) { record(businessId, 'email:cleanup-failed', e.message); }

    state(businessId, 'done', `sending from hello@${domain}`);
    db.prepare("UPDATE tasks SET state = 'done', done_at = datetime('now'), done_note = 'email connected' WHERE business_id = ? AND kind = 'email_setup' AND state = 'open'").run(businessId);
    return { ok: true, domain, from: `hello@${domain}`, dns };
  } catch (e) {
    state(businessId, 'failed', e.message);
    throw Object.assign(e, { status: e.status || (e.retryable ? 409 : 502) });
  }
}

/** What the connect page and the queue both show. */
export function emailStatus(businessId) {
  const b = db.prepare('SELECT slug, name, email_state, email_detail, email_domain FROM businesses WHERE id = ?').get(businessId);
  if (!b) return null;
  return { slug: b.slug, business_name: b.name, state: b.email_state, detail: b.email_detail, domain: b.email_domain };
}
