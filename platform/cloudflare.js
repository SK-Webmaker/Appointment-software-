// Writing the DNS a sending domain needs.
//
// The Cloudflare token lives here and nowhere else — never in a salon's
// process, never in a browser. The salon-serving shard cannot write DNS at
// all, which is the point: a compromised shard cannot re-point anybody's mail.
//
// Everything is additive and idempotent. A record that already exists with the
// right value is left alone; one that exists with a *different* value is
// reported rather than overwritten, because silently replacing somebody's DKIM
// key is how mail starts failing authentication with nothing to show for it.
const API = () => process.env.CLOUDFLARE_API_BASE || 'https://api.cloudflare.com/client/v4';
const TOKEN = () => String(process.env.CLOUDFLARE_API_TOKEN || '').trim();
export const cloudflareConfigured = () => TOKEN().length > 0;

async function cf(method, path, body) {
  const res = await fetch(API() + path, {
    method,
    headers: { Authorization: `Bearer ${TOKEN()}`, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(15000),
  });
  const data = await res.json().catch(() => ({}));
  if (!data.success) {
    throw new Error((data.errors || []).map((e) => `${e.code}: ${e.message}`).join('; ') || `Cloudflare HTTP ${res.status}`);
  }
  return data.result;
}

const zoneCache = new Map();
export async function zoneId(zone) {
  if (zoneCache.has(zone)) return zoneCache.get(zone);
  const found = (await cf('GET', `/zones?name=${encodeURIComponent(zone)}`))[0];
  if (!found) throw new Error(`No Cloudflare zone called "${zone}" is visible to this token`);
  zoneCache.set(zone, found.id);
  return found.id;
}

export const listRecords = async (zone) => cf('GET', `/zones/${await zoneId(zone)}/dns_records?per_page=500`);

/**
 * Make sure each record exists. Returns one line per record saying what
 * happened, so a half-done run reads clearly rather than silently.
 * @param {Array<{type,name,content,priority?,ttl?,comment?}>} wanted
 */
export async function ensureRecords(zone, wanted) {
  const id = await zoneId(zone);
  const existing = await listRecords(zone);
  const out = [];
  for (const rec of wanted) {
    const name = String(rec.name).replace(/\.$/, '').toLowerCase();
    const same = existing.find((r) => r.type === rec.type && String(r.name).toLowerCase() === name);
    if (same) {
      const matches = String(same.content).replace(/^"|"$/g, '') === String(rec.content).replace(/^"|"$/g, '');
      out.push({ name, type: rec.type, action: matches ? 'already there' : 'DIFFERENT VALUE — left alone', ok: matches });
      continue;
    }
    // eslint-disable-next-line no-await-in-loop
    await cf('POST', `/zones/${id}/dns_records`, {
      type: rec.type, name, content: rec.content, ttl: rec.ttl || 300,
      ...(rec.priority !== undefined ? { priority: rec.priority } : {}),
      ...(rec.type === 'CNAME' || rec.type === 'A' ? { proxied: Boolean(rec.proxied) } : {}),
      comment: String(rec.comment || 'Kairo').slice(0, 100),
    });
    out.push({ name, type: rec.type, action: 'created', ok: true });
  }
  return out;
}

/**
 * One DMARC record for the whole platform domain, ever.
 *
 * Two of them is not more protection: receivers see an ambiguous policy and
 * treat the domain as having none at all — for every salon on it. So this
 * checks and leaves well alone, which is the single most damaging mistake
 * available in this file.
 */
export async function ensureDmarc(zone) {
  const name = `_dmarc.${zone}`;
  const existing = (await listRecords(zone)).find((r) => r.type === 'TXT' && String(r.name).toLowerCase() === name);
  if (existing) return { name, action: 'already there — a second record would void DMARC for every salon', ok: true };
  await cf('POST', `/zones/${await zoneId(zone)}/dns_records`, {
    type: 'TXT', name, content: 'v=DMARC1; p=none;', ttl: 300, comment: 'Kairo — domain-wide. One record only.',
  });
  return { name, action: 'created', ok: true };
}
