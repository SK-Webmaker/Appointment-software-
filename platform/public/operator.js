// The queue. Everything a person still has to decide, on one screen, sized for
// a phone — because that is where it will be read.
const app = document.getElementById('app');
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = (c) => `A$${((c || 0) / 100).toFixed(2).replace(/\.00$/, '')}`;

async function call(method, path, body) {
  const res = await fetch(path, { method, headers: body ? { 'content-type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined });
  const text = await res.text();
  let data = null; try { data = JSON.parse(text); } catch { /* not json */ }
  if (res.status === 401) { renderLogin(); throw new Error('signed out'); }
  if (!res.ok) throw new Error(data?.error || `Failed (${res.status})`);
  return data;
}

function renderLogin(error = '') {
  app.innerHTML = `<div class="brand"><span class="mark">K</span><b>Kairo operator</b></div>
    <div class="card"><h2>Sign in</h2>
      <form id="f"><label for="p">Operator password</label>
      <input id="p" type="password" autocomplete="current-password" required>
      ${error ? `<div class="err">${esc(error)}</div>` : ''}
      <button class="primary" type="submit">Sign in</button></form></div>`;
  app.querySelector('#f').addEventListener('submit', async (e) => {
    e.preventDefault();
    try { await call('POST', '/api/operator/login', { password: app.querySelector('#p').value }); render(); }
    catch (err) { if (err.message !== 'signed out') renderLogin(err.message); }
  });
}

const TASK_TITLES = {
  flagged: 'Check this signup',
  email_setup: 'Set up their email',
  provision_failed: 'Setting up failed',
  refund_request: 'Refund requested',
};

function taskCard(t) {
  const flags = (() => { try { return JSON.parse(t.flags || '[]'); } catch { return []; } })();
  return `<div class="card" data-task="${t.id}">
    <div style="display:flex;justify-content:space-between;gap:12px;align-items:start">
      <div>
        <h2>${esc(TASK_TITLES[t.kind] || t.kind)}</h2>
        <p class="hint" style="margin:2px 0 0">${esc(t.business_name || '')} · <span class="mono">${esc(t.slug || '')}</span> · ${esc(t.email || '')}</p>
      </div>
      <span class="tag ${esc(t.state === 'open' ? t.state : '')}">${esc(t.state)}</span>
    </div>
    ${flags.length ? `<ul class="ticks" style="margin-top:12px">${flags.map((f) => `<li style="color:#fcd34d">${esc(f)}</li>`).join('')}</ul>` : ''}
    ${t.detail && !flags.length ? `<p class="hint" style="margin-top:10px">${esc(t.detail)}</p>` : ''}
    ${t.abn ? `<p class="hint">ABN ${esc(t.abn)}${t.abn_name ? ` — registered to ${esc(t.abn_name)}` : ''}</p>` : '<p class="hint">No ABN given</p>'}
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:14px">
      ${t.kind === 'flagged' ? `<button class="btn-sm go" data-act="approve" data-id="${t.business_id}">Approve &amp; set up</button>
        <button class="btn-sm" data-act="refund" data-id="${t.business_id}">Refund ${money(t.price_cents)}</button>` : ''}
      ${t.kind === 'provision_failed' ? `<button class="btn-sm go" data-act="retry" data-id="${t.business_id}">Try again</button>
        <button class="btn-sm" data-act="refund" data-id="${t.business_id}">Refund</button>` : ''}
      ${t.kind === 'refund_request' ? `<button class="btn-sm" data-act="refund" data-id="${t.business_id}">Refund ${money(t.price_cents)}</button>` : ''}
      <button class="btn-sm" data-act="done" data-task="${t.id}">Mark done</button>
    </div>
  </div>`;
}

async function render() {
  const q = await call('GET', '/api/operator/queue');
  const t = q.totals || {};
  app.innerHTML = `<div class="brand"><span class="mark">K</span><b>Kairo operator</b></div>
    <div class="card"><div style="display:flex;gap:26px;flex-wrap:wrap">
      <div><div class="hint">Salons</div><b style="font-size:24px">${t.ready_n || 0}</b></div>
      <div><div class="hint">Signups</div><b style="font-size:24px">${t.all_n || 0}</b></div>
      <div><div class="hint">Waiting on you</div><b style="font-size:24px;color:${q.tasks.length ? 'var(--warn)' : 'var(--good)'}">${q.tasks.length}</b></div>
      <div><div class="hint">Taken</div><b style="font-size:24px">${money((q.recent || []).filter((b) => b.state === 'ready').reduce((s, b) => s + b.price_cents, 0))}</b></div>
    </div></div>
    ${q.tasks.length ? q.tasks.map(taskCard).join('') : '<div class="card"><h2>Nothing waiting</h2><p class="hint">Every signup went through on its own.</p></div>'}
    <div class="card">
      <h2>Recent signups</h2>
      <table><thead><tr><th>Business</th><th>Address</th><th>State</th><th></th></tr></thead><tbody>
      ${(q.recent || []).map((b) => `<tr>
        <td>${esc(b.name)}<div class="hint">${esc(b.email || '')}</div></td>
        <td class="mono">${esc(b.slug)}</td>
        <td><span class="tag ${esc(b.state)}">${esc(b.state)}</span></td>
        <td style="text-align:right">${money(b.price_cents)}</td></tr>`).join('')}
      </tbody></table>
    </div>`;

}

// One delegated listener for the life of the page. Attaching it inside render()
// meant a failed action left the console with no listener at all — every button
// dead until a reload.
app.addEventListener('click', async (e) => {
  const btn = e.target.closest('[data-act]');
  if (!btn) return;
  const act = btn.dataset.act;
  btn.disabled = true;
  try {
    if (act === 'done') await call('POST', `/api/operator/task/${btn.dataset.task}/done`, {});
    else if (act === 'refund') {
      if (!window.confirm('Refund in full, export their data and stop serving their address?')) { btn.disabled = false; return; }
      await call('POST', `/api/operator/business/${btn.dataset.id}/refund`, { reason: 'operator' });
    } else await call('POST', `/api/operator/business/${btn.dataset.id}/${act}`, {});
    await render();
  } catch (err) {
    btn.disabled = false;
    if (err.message !== 'signed out') window.alert(err.message);
  }
});

render().catch(() => renderLogin());
