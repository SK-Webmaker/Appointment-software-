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
