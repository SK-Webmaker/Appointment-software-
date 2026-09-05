// Setting up a salon's own Resend account for them.
//
// Everything here runs with a key the BUSINESS created, for about a minute,
// and is thrown away afterwards. Kairo never stores a full-access Resend key
// and never holds an account of its own that a salon's mail depends on — the
// account, the free tier and the sending reputation are theirs.
//
// The records to add are whatever Resend says they are. They are not hardcoded
// here: Resend has changed the shape of its DKIM records before, and a copy of
// last year's shape produces mail that sends perfectly and fails authentication
// everywhere, with nothing reporting it.
const API = () => process.env.RESEND_API_BASE || 'https://api.resend.com';

async function call(key, method, path, body) {
  const res = await fetch(API() + path, {
    method,
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(20000),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data?.message || data?.error?.message || `Resend HTTP ${res.status}`;
    throw Object.assign(new Error(msg), { status: res.status });
  }
  return data;
}

/** Does this key work, and what can it do? Checked the moment it is pasted. */
export async function checkKey(key) {
  try {
    await call(key, 'GET', '/domains');
    return { ok: true };
  } catch (e) {
    if (e.status === 401 || e.status === 403) {
      return { ok: false, detail: 'Resend did not accept that key. Copy it again — it starts with "re_" and is only shown once.' };
    }
    if (e.status === 422) {
      return { ok: false, detail: 'That key can only send email. Create one with Full access for the setup, and Kairo will make the sending-only key itself.' };
    }
    return { ok: false, detail: `Could not reach Resend: ${e.message}` };
  }
}

export const listDomains = (key) => call(key, 'GET', '/domains').then((d) => d.data || []);

/** Add the domain, or find it if a previous attempt already did. */
export async function ensureDomain(key, name, region = 'ap-northeast-1') {
  const existing = (await listDomains(key)).find((d) => String(d.name).toLowerCase() === name.toLowerCase());
  if (existing) return call(key, 'GET', `/domains/${existing.id}`);
  return call(key, 'POST', '/domains', { name, region });
}

export const getDomain = (key, id) => call(key, 'GET', `/domains/${id}`);
export const verifyDomain = (key, id) => call(key, 'POST', `/domains/${id}/verify`);

/** A key that can only send, and only from this one domain. */
export const createSendingKey = (key, name, domainId) =>
  call(key, 'POST', '/api-keys', { name, permission: 'sending_access', domain_id: domainId });

export const listKeys = (key) => call(key, 'GET', '/api-keys').then((d) => d.data || []);
export const deleteKey = (key, id) => call(key, 'DELETE', `/api-keys/${id}`);

/**
 * The DNS Resend asked for, in the shape Cloudflare wants.
 * `record.name` may come back relative or absolute; make it absolute once here.
 */
export function recordsFor(domain) {
  return (domain.records || []).map((r) => {
    const raw = String(r.name || '').replace(/\.$/, '');
    const name = !raw || raw === '@' ? domain.name
      : raw.toLowerCase().endsWith(domain.name.toLowerCase()) ? raw
        : `${raw}.${domain.name}`;
    return {
      type: String(r.type || '').toUpperCase(),
      name,
      content: String(r.value ?? ''),
      ...(r.priority !== undefined && r.priority !== null ? { priority: Number(r.priority) } : {}),
      comment: `Kairo — Resend ${r.record || ''} for ${domain.name}`.slice(0, 100),
    };
  }).filter((r) => r.type && r.content);
}
