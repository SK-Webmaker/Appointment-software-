// Stand-ins for the three outside services the platform talks to, so the whole
// signup can run in CI without money moving or a government API being hit.
//
// They are deliberately *thin and strict*: the mock Stripe verifies nothing it
// would not verify in life, and the webhook the test posts is signed exactly as
// Stripe signs one. A mock that is easier to satisfy than the real thing tests
// nothing.
import http from 'node:http';
import crypto from 'node:crypto';

function listen(handler) {
  return new Promise((resolve) => {
    const server = http.createServer(handler);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      resolve({ server, port, base: `http://127.0.0.1:${port}`, close: () => new Promise((r) => server.close(r)) });
    });
  });
}

const readBody = (req) => new Promise((resolve) => {
  const chunks = [];
  req.on('data', (c) => chunks.push(c));
  req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
});

/** A Stripe that creates sessions, can be told one was paid, and refunds. */
export async function mockStripe({ webhookSecret = 'whsec_test' } = {}) {
  const sessions = new Map();
  const refunds = [];
  let n = 0;
  const m = await listen(async (req, res) => {
    const url = new URL(req.url, 'http://x');
    const send = (code, obj) => { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(obj)); };
    if (!/^Bearer sk_/.test(String(req.headers.authorization || ''))) return send(401, { error: { message: 'no key' } });

    if (req.method === 'POST' && url.pathname === '/v1/checkout/sessions') {
      const params = new URLSearchParams(await readBody(req));
      const id = `cs_test_${++n}_${crypto.randomBytes(4).toString('hex')}`;
      const session = {
        id,
        object: 'checkout.session',
        payment_status: 'unpaid',
        amount_total: Number(params.get('line_items[0][price_data][unit_amount]')) || 0,
        currency: params.get('line_items[0][price_data][currency]'),
        customer_email: params.get('customer_email'),
        success_url: params.get('success_url'),
        metadata: { business_id: params.get('metadata[business_id]'), slug: params.get('metadata[slug]') },
        payment_intent: null,
        url: `${m.base}/pay/${id}`,
      };
      sessions.set(id, session);
      return send(200, session);
    }
    const get = /^\/v1\/checkout\/sessions\/(.+)$/.exec(url.pathname);
    if (req.method === 'GET' && get) {
      const s = sessions.get(decodeURIComponent(get[1]));
      return s ? send(200, s) : send(404, { error: { message: 'No such session' } });
    }
    if (req.method === 'POST' && url.pathname === '/v1/refunds') {
      const params = new URLSearchParams(await readBody(req));
      const r = { id: `re_${crypto.randomBytes(6).toString('hex')}`, object: 'refund', payment_intent: params.get('payment_intent'), status: 'succeeded' };
      refunds.push(r);
      return send(200, r);
    }
    return send(404, { error: { message: 'not mocked' } });
  });

  return {
    ...m,
    sessions,
    refunds,
    /** Mark a session paid and return the event body Stripe would send. */
    pay(id) {
      const s = sessions.get(id);
      if (!s) throw new Error(`no such session ${id}`);
      s.payment_status = 'paid';
      s.payment_intent = `pi_${crypto.randomBytes(6).toString('hex')}`;
      return { id: `evt_${crypto.randomBytes(6).toString('hex')}`, type: 'checkout.session.completed', data: { object: s } };
    },
    dispute(paymentIntent) {
      return { id: `evt_${crypto.randomBytes(6).toString('hex')}`, type: 'charge.dispute.created', data: { object: { payment_intent: paymentIntent } } };
    },
    /** Sign a body the way Stripe signs one, so the platform's check is real. */
    sign(body, { secret = webhookSecret, at = Math.floor(Date.now() / 1000) } = {}) {
      const raw = typeof body === 'string' ? body : JSON.stringify(body);
      const v1 = crypto.createHmac('sha256', secret).update(`${at}.${raw}`).digest('hex');
      return { raw, header: `t=${at},v1=${v1}` };
    },
    webhookSecret,
  };
}

/** The Australian Business Register, as much of it as an ABN check needs. */
export async function mockAbr(entries = {}) {
  const known = new Map(Object.entries(entries));
  const m = await listen((req, res) => {
    const url = new URL(req.url, 'http://x');
    const abn = url.searchParams.get('abn');
    const found = known.get(abn);
    const payload = found
      ? { Abn: abn, AbnStatus: found.status || 'Active', EntityName: found.name || '', EntityTypeName: 'Australian Private Company' }
      : { Message: 'No records found' };
    res.writeHead(200, { 'content-type': 'application/javascript' });
    res.end(`callback(${JSON.stringify(payload)})`);
  });
  return { ...m, known };
}

/**
 * Resend, as much of it as connecting a salon's email needs.
 *
 * The important part: a domain only becomes `verified` once the records it
 * asked for are actually resolvable — the mock consults the mock Cloudflare.
 * A mock that verifies unconditionally would let a broken DNS step pass.
 */
export async function mockResend({ dns = null } = {}) {
  const domains = new Map();
  const keys = new Map();
  const sent = [];
  let n = 0;
  const m = await listen(async (req, res) => {
    const url = new URL(req.url, 'http://x');
    const send = (code, obj) => { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(obj)); };
    const auth = String(req.headers.authorization || '');
    const token = auth.replace(/^Bearer\s+/, '');
    if (!/^re_/.test(token)) return send(401, { message: 'API key is invalid' });
    const full = token.startsWith('re_full_');
    const body = req.method === 'GET' || req.method === 'DELETE' ? {} : JSON.parse((await readBody(req)) || '{}');

    if (url.pathname === '/domains' && req.method === 'GET') {
      if (!full) return send(401, { message: 'This API key can only send emails' });
      return send(200, { data: [...domains.values()].map(({ records, ...d }) => d) });
    }
    if (url.pathname === '/domains' && req.method === 'POST') {
      if (!full) return send(401, { message: 'This API key can only send emails' });
      const id = `d_${++n}`;
      const name = String(body.name);
      const d = {
        id, name, status: 'pending', region: body.region,
        records: [
          { record: 'DKIM', name: `resend._domainkey.${name}`, type: 'TXT', ttl: 'Auto', status: 'not_started', value: `p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQ${'A'.repeat(200)}` },
          { record: 'SPF', name: `send.${name}`, type: 'TXT', ttl: 'Auto', status: 'not_started', value: 'v=spf1 include:amazonses.com ~all' },
          { record: 'SPF', name: `send.${name}`, type: 'MX', ttl: 'Auto', status: 'not_started', value: 'feedback-smtp.ap-northeast-1.amazonses.com', priority: 10 },
        ],
      };
      domains.set(id, d);
      return send(200, d);
    }
    const dom = /^\/domains\/([^/]+)$/.exec(url.pathname);
    if (dom && req.method === 'GET') {
      const d = domains.get(dom[1]);
      if (!d) return send(404, { message: 'Domain not found' });
      // Verified only if every record it asked for is really in DNS.
      if (d.status !== 'verified' && dns) {
        const allThere = d.records.every((r) => dns.has(r.type, r.name, r.value));
        if (allThere && d.checked) d.status = 'verified';
      }
      return send(200, d);
    }
    const ver = /^\/domains\/([^/]+)\/verify$/.exec(url.pathname);
    if (ver && req.method === 'POST') {
      const d = domains.get(ver[1]);
      if (!d) return send(404, { message: 'Domain not found' });
      d.checked = true;
      return send(200, { object: 'domain', id: d.id });
    }
    if (url.pathname === '/api-keys' && req.method === 'POST') {
      if (!full) return send(401, { message: 'This API key can only send emails' });
      const id = `k_${++n}`;
      const key = { id, name: body.name, permission: body.permission, domain_id: body.domain_id, token: `re_send_${id}` };
      keys.set(id, key);
      return send(200, { id, token: key.token });
    }
    if (url.pathname === '/api-keys' && req.method === 'GET') {
      if (!full) return send(401, { message: 'This API key can only send emails' });
      return send(200, { data: [{ id: 'k_setup', name: 'Kairo setup' }, ...[...keys.values()].map((k) => ({ id: k.id, name: k.name }))] });
    }
    const del = /^\/api-keys\/([^/]+)$/.exec(url.pathname);
    if (del && req.method === 'DELETE') { keys.delete(del[1]); m.deletedKeys.push(del[1]); return send(200, {}); }
    if (url.pathname === '/emails' && req.method === 'POST') {
      const k = [...keys.values()].find((x) => x.token === token);
      if (!k && !full) return send(401, { message: 'API key is invalid' });
      sent.push({ from: body.from, to: body.to, subject: body.subject, key: token });
      return send(200, { id: `e_${++n}` });
    }
    return send(404, { message: `not mocked: ${req.method} ${url.pathname}` });
  });
  m.domains = domains; m.keys = keys; m.sent = sent; m.deletedKeys = [];
  m.fullKey = 're_full_test_key';
  return m;
}

/** Cloudflare DNS, enough of it to write and read records back. */
export async function mockCloudflare({ zone = 'kairobookings.test' } = {}) {
  const records = [];
  let n = 0;
  const m = await listen(async (req, res) => {
    const url = new URL(req.url, 'http://x');
    const send = (obj) => { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify(obj)); };
    if (!/^Bearer .+/.test(String(req.headers.authorization || ''))) {
      return send({ success: false, errors: [{ code: 9103, message: 'Unknown X-Auth-Key or X-Auth-Email' }] });
    }
    if (url.pathname === '/zones') {
      const name = url.searchParams.get('name');
      return send({ success: true, result: name === zone ? [{ id: 'zone_1', name: zone, plan: { name: 'Free' } }] : [] });
    }
    if (url.pathname === '/zones/zone_1/dns_records' && req.method === 'GET') {
      return send({ success: true, result: records });
    }
    if (url.pathname === '/zones/zone_1/dns_records' && req.method === 'POST') {
      const body = JSON.parse((await readBody(req)) || '{}');
      const rec = { id: `r_${++n}`, ...body };
      records.push(rec);
      return send({ success: true, result: rec });
    }
    return send({ success: false, errors: [{ code: 1000, message: `not mocked: ${req.method} ${url.pathname}` }] });
  });
  m.records = records;
  m.zone = zone;
  /** Is this record actually in DNS? What the mock Resend asks before verifying. */
  m.has = (type, name, value) => records.some((r) => r.type === type
    && String(r.name).toLowerCase() === String(name).toLowerCase().replace(/\.$/, '')
    && String(r.content).replace(/^"|"$/g, '') === String(value).replace(/^"|"$/g, ''));
  return m;
}

/** ClickSend: the balance, the own-number code, and sending a text. */
export async function mockClickSend({ balance = 25.5 } = {}) {
  const texts = [];
  const verifications = new Map();
  let n = 0;
  const m = await listen(async (req, res) => {
    const url = new URL(req.url, 'http://x');
    const send = (code, obj) => { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(obj)); };
    const auth = String(req.headers.authorization || '');
    const creds = Buffer.from(auth.replace(/^Basic\s+/, ''), 'base64').toString('utf8');
    if (creds !== `${m.username}:${m.apiKey}`) return send(401, { response_code: 'UNAUTHORISED', response_msg: 'Invalid credentials' });

    if (url.pathname === '/account' && req.method === 'GET') {
      return send(200, { response_code: 'SUCCESS', data: { balance, account_name: 'Test Salon', currency: { currency_name_short: 'AUD', currency_prefix_d: '$' } } });
    }
    if (url.pathname === '/own-numbers/verifications' && req.method === 'POST') {
      const body = JSON.parse((await readBody(req)) || '{}');
      const id = String(++n);
      verifications.set(id, { number: body.phone_number, code: '778899' });
      return send(200, { response_code: 'SUCCESS', data: { id, phone_number: body.phone_number } });
    }
    const ver = /^\/own-numbers\/verifications\/([^/]+)\/verify$/.exec(url.pathname);
    if (ver && req.method === 'PUT') {
      const body = JSON.parse((await readBody(req)) || '{}');
      const v = verifications.get(ver[1]);
      if (!v) return send(404, { response_msg: 'No such verification' });
      if (String(body.verification_code) !== v.code) return send(400, { response_msg: 'The code you entered is not correct' });
      m.verified.push(v.number);
      return send(200, { response_code: 'SUCCESS', data: { phone_number: v.number, verified: true } });
    }
    if (url.pathname === '/sms/send' && req.method === 'POST') {
      const body = JSON.parse((await readBody(req)) || '{}');
      texts.push(body.messages[0]);
      return send(200, { response_code: 'SUCCESS', data: { total_price: 0.077, messages: [{ status: 'SUCCESS' }] } });
    }
    return send(404, { response_msg: `not mocked: ${req.method} ${url.pathname}` });
  });
  m.texts = texts; m.verifications = verifications; m.verified = [];
  m.username = 'salon@example.com'; m.apiKey = 'CS-TEST-KEY';
  m.code = '778899';
  return m;
}
