// The two things a salon's own Kairo deliberately cannot do for itself:
// connect its email (which needs DNS only the platform can write) and cancel
// (which needs the card payment only the platform can refund).
//
// Reached by a link that only appears inside a signed-in workspace.
const app = document.getElementById('app');
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = (c) => `A$${((c || 0) / 100).toFixed(2).replace(/\.00$/, '')}`;
const t = new URLSearchParams(location.search).get('t') || '';

async function call(method, path, body) {
  const res = await fetch(path, { method, headers: body ? { 'content-type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined });
  const text = await res.text();
  let data = null; try { data = JSON.parse(text); } catch { /* not json */ }
  if (!res.ok) throw new Error(data?.error || `Something went wrong (${res.status})`);
  return data;
}

const head = (s) => `<div class="brand"><span class="mark">K</span><b>Kairo</b></div>
  <h1>${esc(s.business_name)}</h1>
  <p class="lede"><span class="mono">${esc(s.url.replace(/^https?:\/\//, ''))}</span></p>`;

function emailCard(s, { error = '', busy = false, own = false } = {}) {
  const e = s.email || { state: 'none' };
  if (e.state === 'done') {
    return `<div class="card">
      <h2>✓ Your emails are on</h2>
      <p class="hint">Confirmations, reminders and receipts send from <span class="mono">hello@${esc(e.domain)}</span>, through your own Resend account. We sent you a test — check your inbox.</p>
    </div>`;
  }
  if (busy) {
    return `<div class="card"><h2><span class="spin"></span>Setting your email up</h2>
      <p class="hint">Adding the domain, writing the DNS and waiting for Resend to confirm it. This can take a minute or two — leave this page open.</p></div>`;
  }
  return `<div class="card">
    <h2>Turn on your emails</h2>
    <p class="hint">Until this is done, confirmations and reminders can't send. It takes about two minutes and costs nothing — Resend's free tier covers a salon several times over.</p>
    ${e.state === 'failed' && e.detail ? `<div class="err" style="white-space:pre-wrap">${esc(e.detail)}</div>` : ''}
    <ol style="color:var(--dim);line-height:1.9;padding-left:20px;margin:16px 0">
      <li><a href="https://resend.com/signup" target="_blank" rel="noopener">Create a free Resend account</a> — use your own email address. The account stays yours.</li>
      <li>In Resend, open <b>API Keys → Create API Key</b>. Name it <span class="mono">Kairo setup</span> and choose <b>Full access</b>.</li>
      <li>Paste it here. We do the rest and then delete that key.</li>
    </ol>
    <form id="ef">
      <label for="key">Your Resend API key</label>
      <input id="key" type="password" autocomplete="off" spellcheck="false" placeholder="re_…" required>
      ${own ? `<label for="dom">Your own sending domain</label>
        <input id="dom" type="text" spellcheck="false" autocapitalize="none" placeholder="mail.yoursalon.com.au">
        <div class="hint">We'll show you the records to add at your registrar.</div>`
    : `<div class="hint" style="margin-top:10px">We'll send from <span class="mono">hello@${esc(s.suggested_domain)}</span>.
        <button class="link" id="ownbtn" type="button">Use my own domain instead</button></div>`}
      ${error ? `<div class="err" style="white-space:pre-wrap">${esc(error)}</div>` : ''}
      <button class="primary" type="submit">Set up my email</button>
    </form>
    <p class="hint" style="text-align:center;margin-top:12px">Your key is used once and never stored.</p>
  </div>`;
}

function cancelCard(s) {
  if (s.refunded) return `<div class="card"><h2>Refunded</h2><p class="hint">This Kairo has been refunded and switched off. Your data was emailed to you.</p></div>`;
  const left = s.refund_days_left;
  return `<div class="card">
    <h2>Cancel and refund</h2>
    ${left > 0
    ? `<p class="hint">You have <b>${left} day${left === 1 ? '' : 's'}</b> left of the 14-day window. Inside it we refund ${money(s.price_cents)} in full, no reason needed. We email you a complete copy of your data first, then switch your Kairo off.</p>`
    : `<p class="hint">The 14-day no-reason window has passed. If Kairo has a fault we can't fix, the Australian Consumer Law still applies — tell us what's wrong and we'll look at it.</p>`}
    <details style="margin-top:12px"><summary style="cursor:pointer;color:var(--dim)">I want to cancel</summary>
      <form id="rf" style="margin-top:12px">
        <label for="reason">Anything you'd like to tell us? (optional)</label>
        <input id="reason" type="text" maxlength="300">
        <button class="primary" type="submit" style="background:var(--bad);color:#fff">${left > 0 ? `Refund ${money(s.price_cents)} and close my Kairo` : 'Ask for a refund'}</button>
      </form>
    </details>
  </div>`;
}

async function render({ error = '', busy = false, own = false, note = '' } = {}) {
  const s = await call('GET', `/api/connect/status?t=${encodeURIComponent(t)}`);
  app.innerHTML = head(s)
    + (note ? `<div class="card" style="border-color:var(--good)"><p class="hint" style="color:var(--good);margin:0">${esc(note)}</p></div>` : '')
    + emailCard(s, { error, busy, own })
    + cancelCard(s)
    + `<div class="foot"><a href="/terms.html">Terms</a> · <a href="/refunds.html">Refunds</a> · <a href="/privacy.html">Privacy</a></div>`;

  app.querySelector('#ownbtn')?.addEventListener('click', () => render({ own: true }));

  app.querySelector('#ef')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const key = app.querySelector('#key').value.trim();
    const domain = app.querySelector('#dom')?.value.trim() || '';
    await render({ busy: true, own });
    try {
      const out = await call('POST', '/api/connect/email', { t, resend_key: key, domain });
      await render({ note: `Done — your emails now send from ${out.from}.` });
    } catch (err) {
      await render({ error: err.message, own });
    }
  });

  app.querySelector('#rf')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!window.confirm('Refund and close this Kairo? We will email you a copy of everything first.')) return;
    try {
      const out = await call('POST', '/api/connect/refund', { t, reason: app.querySelector('#reason').value });
      await render({ note: out.queued ? "Thanks — we've got your request and will be in touch." : 'Refunded. Your data is on its way to your inbox.' });
    } catch (err) { await render({ error: err.message }); }
  });
}

if (!t) {
  app.innerHTML = `<div class="brand"><span class="mark">K</span><b>Kairo</b></div>
    <div class="card"><h2>This link is incomplete</h2><p class="hint">Open it from the setup card inside your own Kairo.</p></div>`;
} else {
  render().catch((err) => {
    app.innerHTML = `<div class="brand"><span class="mark">K</span><b>Kairo</b></div>
      <div class="card"><h2>This link is no longer valid</h2><p class="hint">${esc(err.message)}</p></div>`;
  });
}
