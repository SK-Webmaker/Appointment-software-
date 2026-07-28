// Billing: invoice list with filters, invoice editor, payments, print view.
import { api } from '../api.js';
import {
  esc, icon, money, priceLabel, fmtDate, todayStr, openModal, confirmDialog, toast, statusChip, methodLabel,
} from '../ui.js';
import { state } from '../app.js';

let filter = { status: '', q: '' };

export async function renderInvoices(container, params) {
  if (params?.get('open')) {
    // deep link from calendar/client detail
    const id = Number(params.get('open'));
    history.replaceState(null, '', '#/invoices');
    await drawList(container);
    openInvoiceModal({ id, onChanged: () => drawList(container) });
    return;
  }
  await drawList(container);
}

async function drawList(container) {
  const qs = new URLSearchParams();
  if (filter.status) qs.set('status', filter.status);
  if (filter.q) qs.set('q', filter.q);
  const invoices = await api.get(`/api/invoices?${qs}`);

  const outstanding = invoices.filter((i) => i.status === 'sent').reduce((s, i) => s + Math.max(0, i.balance_cents), 0);
  const paidThisMonth = invoices
    .filter((i) => i.status === 'paid' && i.issue_date >= todayStr().slice(0, 8) + '01')
    .reduce((s, i) => s + i.total_cents, 0);
  const drafts = invoices.filter((i) => i.status === 'draft').length;

  container.innerHTML = `
    <div class="page-head">
      <div class="ph-icon">${icon('invoice', 20)}</div>
      <div><h1>Billing</h1><div class="ph-sub">Invoices, payments and checkout</div></div>
      <div class="ph-actions">
        <button class="btn primary" id="inv-new">${icon('plus')} New invoice</button>
      </div>
    </div>

    <div class="stats-row stats-3">
      <div class="card stat-tile">
        <div class="st-top"><span class="st-label">Outstanding</span><span class="st-icon tint-amber">${icon('clock')}</span></div>
        <div class="st-value money">${money(outstanding)}</div><div class="st-foot">Awaiting payment</div>
      </div>
      <div class="card stat-tile">
        <div class="st-top"><span class="st-label">Collected this month</span><span class="st-icon tint-green">${icon('dollar')}</span></div>
        <div class="st-value money">${money(paidThisMonth)}</div><div class="st-foot">Paid invoices</div>
      </div>
      <div class="card stat-tile">
        <div class="st-top"><span class="st-label">Drafts</span><span class="st-icon tint-blue">${icon('edit')}</span></div>
        <div class="st-value">${drafts}</div><div class="st-foot">Not yet sent</div>
      </div>
    </div>

    <div class="toolbar">
      <div class="search-box" style="flex:0 1 300px">${icon('search')}
        <input id="inv-search" placeholder="Search number or client…" value="${esc(filter.q)}"></div>
      <div class="seg" id="inv-filter">
        ${['', 'draft', 'sent', 'paid', 'void'].map((s) =>
          `<button data-status="${s}" class="${filter.status === s ? 'active' : ''}">${s === '' ? 'All' : { draft: 'Drafts', sent: 'Sent', paid: 'Paid', void: 'Void' }[s]}</button>`).join('')}
      </div>
    </div>

    <div class="card" style="padding:0"><div class="table-wrap">
      <table class="data reflow">
        <thead><tr>
          <th>Invoice</th><th>Client</th><th>Issued</th><th>Status</th>
          <th class="num">Total</th><th class="num">Balance</th>
        </tr></thead>
        <tbody id="inv-rows">
          ${invoices.length ? invoices.map((i) => `
            <tr data-id="${i.id}">
              <td class="cell-main rf-head">${esc(i.number)}</td>
              <td data-th="Client">${esc(i.client_name || '—')}</td>
              <td data-th="Issued">${fmtDate(i.issue_date)}</td>
              <td data-th="Status">${statusChip(i.status)}</td>
              <td data-th="Total" class="num money">${money(i.total_cents)}</td>
              <td data-th="Balance" class="num money ${i.balance_cents > 0 && i.status === 'sent' ? 'neg' : ''}">${i.status === 'void' ? '—' : money(Math.max(0, i.balance_cents))}</td>
            </tr>`).join('') : `
            <tr><td colspan="6"><div class="empty">${icon('invoice')}<div>No invoices${filter.q || filter.status ? ' match the filter' : ' yet — bill an appointment from the calendar'}.</div></div></td></tr>`}
        </tbody>
      </table>
    </div></div>`;

  container.querySelector('#inv-new').onclick = () => openInvoiceEditor({ onSaved: () => drawList(container) });
  const search = container.querySelector('#inv-search');
  let deb;
  search.addEventListener('input', () => {
    clearTimeout(deb);
    deb = setTimeout(() => { filter.q = search.value.trim(); drawList(container); }, 250);
  });
  container.querySelector('#inv-filter').addEventListener('click', (e) => {
    const b = e.target.closest('[data-status]');
    if (!b) return;
    filter.status = b.dataset.status;
    drawList(container);
  });
  container.querySelector('#inv-rows').addEventListener('click', (e) => {
    const row = e.target.closest('tr[data-id]');
    if (row) openInvoiceModal({ id: Number(row.dataset.id), onChanged: () => drawList(container) });
  });
}

// ---------------------------------------------------------------------------
// Invoice detail (view / actions)
// ---------------------------------------------------------------------------

export async function openInvoiceModal({ id, onChanged }) {
  let inv = await api.get(`/api/invoices/${id}`);

  const render = () => `
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:16px">
      <div>
        <div style="font-size:19px;font-weight:700">${esc(inv.number)}</div>
        <div class="cell-sub">Issued ${fmtDate(inv.issue_date)} · Due ${fmtDate(inv.due_date)}</div>
        <div style="margin-top:7px">${statusChip(inv.status)}</div>
      </div>
      <div style="text-align:right">
        <div class="mini-label">Client</div>
        <div class="cell-main">${esc(inv.client_name || '—')}</div>
        <div class="cell-sub">${esc(inv.client_email || inv.client_phone || '')}</div>
      </div>
    </div>
    <table class="data" style="margin-bottom:4px">
      <thead><tr><th>Item</th><th class="num">Qty</th><th class="num">Unit</th><th class="num">Amount</th></tr></thead>
      <tbody>
        ${inv.items.map((it) => `
          <tr style="cursor:default"><td>${esc(it.description)}</td>
          <td class="num">${it.qty}</td>
          <td class="num money">${money(it.unit_cents)}</td>
          <td class="num money">${money(Math.round(it.qty * it.unit_cents))}</td></tr>`).join('')}
        ${!inv.items.length ? '<tr><td colspan="4" class="text-muted">No line items yet — edit the invoice to add some.</td></tr>' : ''}
      </tbody>
    </table>
    <div class="inv-totals">
      <div class="tr"><span>Subtotal</span><span class="money">${money(inv.subtotal_cents)}</span></div>
      ${inv.discount_cents ? `<div class="tr"><span>Discount</span><span class="money">−${money(inv.discount_cents)}</span></div>` : ''}
      <div class="tr"><span>Tax (${inv.tax_rate}%)</span><span class="money">${money(inv.tax_cents)}</span></div>
      <div class="tr grand"><span>Total</span><span class="money">${money(inv.total_cents)}</span></div>
      ${inv.paid_cents ? `<div class="tr"><span>Paid</span><span class="money pos">−${money(inv.paid_cents)}</span></div>` : ''}
      ${inv.status !== 'void' && inv.balance_cents > 0 ? `<div class="tr due"><span>Balance due</span><span class="money">${money(inv.balance_cents)}</span></div>` : ''}
    </div>
    ${inv.payments.length ? `
      <div class="mini-label" style="margin:14px 0 4px">Payments</div>
      ${inv.payments.map((p) => `
        <div class="list-item" style="cursor:default">
          <span class="st-icon tint-green" style="width:26px;height:26px">${icon('card')}</span>
          <div style="flex:1"><span class="cell-main money">${money(p.amount_cents)}</span>
            <span class="cell-sub" style="margin-left:8px">${esc(methodLabel(p.method))} · ${esc(p.paid_at.slice(0, 10))}</span></div>
          <button class="icon-btn" data-del-pay="${p.id}" title="Remove payment">${icon('x')}</button>
        </div>`).join('')}` : ''}
    ${inv.notes ? `<div class="cell-sub" style="margin-top:12px">${esc(inv.notes)}</div>` : ''}`;

  const paidIn = inv.payments.filter((p) => p.amount_cents > 0).reduce((s2, p) => s2 + p.amount_cents, 0);
  const refunded = inv.payments.filter((p) => p.amount_cents < 0).reduce((s2, p) => s2 - p.amount_cents, 0);
  const refundable = paidIn - refunded;

  const m = openModal({
    title: 'Invoice',
    wide: true,
    body: `<div id="inv-view">${render()}</div>`,
    footer: `
      <button class="btn danger" id="iv-void">${inv.status === 'void' ? 'Delete' : 'Void'}</button>
      <button class="btn" id="iv-edit">${icon('edit')} Edit</button>
      ${inv.status !== 'void' && refundable > 0 ? `<button class="btn" id="iv-refund">${icon('reply')} Refund</button>` : ''}
      <div class="spacer"></div>
      <button class="btn" id="iv-print">${icon('print')} Print / PDF</button>
      ${inv.status === 'draft' ? `<button class="btn" id="iv-send">${icon('send')} Mark sent</button>` : ''}
      ${inv.status !== 'void' && inv.balance_cents > 0 ? `<button class="btn primary" id="iv-pay">${icon('dollar')} Record payment</button>` : ''}`,
  });

  const refresh = async () => {
    inv = await api.get(`/api/invoices/${id}`);
    m.close();
    onChanged?.();
    openInvoiceModal({ id, onChanged });
  };

  m.querySelector('#inv-view').addEventListener('click', async (e) => {
    const del = e.target.closest('[data-del-pay]');
    if (del) {
      const ok = await confirmDialog('Remove payment', 'Remove this payment record?', { danger: true, okText: 'Remove' });
      if (ok) { await api.del(`/api/invoices/${id}/payments/${del.dataset.delPay}`); toast('Payment removed'); refresh(); }
    }
  });

  m.querySelector('#iv-edit').onclick = () => { m.close(); openInvoiceEditor({ invoice: inv, onSaved: onChanged }); };
  m.querySelector('#iv-print').onclick = () => printInvoice(inv);
  m.querySelector('#iv-void').onclick = async () => {
    if (inv.status === 'void') {
      const ok = await confirmDialog('Delete invoice', 'Permanently delete this void invoice?', { danger: true, okText: 'Delete' });
      if (ok) { await api.del(`/api/invoices/${id}`); toast('Invoice deleted'); m.close(); onChanged?.(); }
    } else {
      const ok = await confirmDialog('Void invoice', 'Voiding keeps the invoice on record but removes it from your balances.', { danger: true, okText: 'Void invoice' });
      if (ok) { await api.patch(`/api/invoices/${id}/status`, { status: 'void' }); toast('Invoice voided'); refresh(); }
    }
  };
  m.querySelector('#iv-send')?.addEventListener('click', async () => {
    await api.patch(`/api/invoices/${id}/status`, { status: 'sent' });
    toast('Invoice marked as sent');
    refresh();
  });
  m.querySelector('#iv-pay')?.addEventListener('click', () => {
    openPaymentModal(inv, refresh);
  });
  m.querySelector('#iv-refund')?.addEventListener('click', () => {
    m.close();
    openRefundModal(inv, refundable, () => { onChanged?.(); openInvoiceModal({ id, onChanged }); });
  });
}

/** Full or partial refund. Stripe-paid sales refund at Stripe automatically. */
function openRefundModal(inv, refundableCents, onDone) {
  const hasProducts = inv.items.some((it) => it.product_id);
  const viaStripe = inv.payments.some((p) => p.stripe_pi && p.amount_cents > 0);
  const m = openModal({
    title: `Refund — ${inv.number}`,
    body: `
      <div class="cell-sub" style="margin-bottom:14px">
        ${money(refundableCents)} was collected on this sale${viaStripe
          ? ' via Stripe — the refund is sent to Stripe and lands back on the customer\'s card (3–10 business days).'
          : ' in cash/other — record the refund here after handing the money back.'}
      </div>
      <form id="refund-form" style="display:flex;flex-direction:column;gap:13px">
        <div class="field"><label>Refund amount</label>
          <input name="amount" type="number" min="0.01" step="0.01" value="${(refundableCents / 100).toFixed(2)}" required>
          <div class="hint">Up to ${money(refundableCents)}. Lower the amount for a partial refund.</div></div>
        ${hasProducts ? `
        <label style="display:flex;gap:9px;align-items:flex-start;cursor:pointer">
          <input type="checkbox" name="restock" checked class="chk">
          <span>Return products to stock<br><span class="hint" style="margin:0">Applies on full refunds — puts the sold items back in inventory.</span></span>
        </label>` : ''}
        <div class="field"><label>Reason (optional)</label><input name="note" maxlength="300" placeholder="e.g. product returned"></div>
      </form>`,
    footer: `<div class="spacer"></div><button class="btn danger" id="refund-go">${icon('reply')} Refund</button>`,
  });
  m.querySelector('#refund-go').onclick = async (e) => {
    const fd = new FormData(m.querySelector('#refund-form'));
    const cents = Math.round(Number(fd.get('amount')) * 100);
    if (!Number.isFinite(cents) || cents <= 0 || cents > refundableCents) { toast(`Enter an amount up to ${money(refundableCents)}`, 'err'); return; }
    e.target.disabled = true; // double-click guard (server is idempotent too)
    try {
      await api.post(`/api/invoices/${inv.id}/refund`, {
        amount_cents: cents,
        restock: fd.get('restock') === 'on',
        note: fd.get('note') || '',
      });
      toast(viaStripe ? 'Refund sent to Stripe' : 'Refund recorded');
      m.close(); onDone?.();
    } catch (err) { toast(err.message, 'err'); e.target.disabled = false; }
  };
}

function openPaymentModal(inv, onDone) {
  const m = openModal({
    title: `Record payment — ${inv.number}`,
    body: `
      <form id="pay-form" class="form-grid">
        <div class="field"><label>Amount</label>
          <input name="amount" type="number" step="0.01" min="0.01" value="${(inv.balance_cents / 100).toFixed(2)}" required></div>
        <div class="field"><label>Method</label>
          <select name="method">
            <option value="card">Card</option><option value="square">Square</option><option value="cash">Cash</option>
            <option value="transfer">Bank transfer</option><option value="other">Other</option>
          </select></div>
        <div class="field span2"><label>Note</label><input name="note" placeholder="Optional"></div>
      </form>
      <div class="cell-sub" style="margin-top:10px">Balance due: <b class="money" style="color:var(--amber)">${money(inv.balance_cents)}</b></div>`,
    footer: `<div class="spacer"></div><button class="btn primary" id="pay-save">${icon('check')} Record payment</button>`,
  });
  m.querySelector('#pay-save').onclick = async () => {
    const fd = new FormData(m.querySelector('#pay-form'));
    const cents = Math.round(parseFloat(fd.get('amount')) * 100);
    if (!cents || cents <= 0) { toast('Enter a valid amount', 'err'); return; }
    try {
      const updated = await api.post(`/api/invoices/${inv.id}/payments`, {
        amount_cents: cents, method: fd.get('method'), note: fd.get('note'),
      });
      toast(updated.status === 'paid' ? 'Paid in full 🎉' : 'Payment recorded');
      m.close(); onDone?.();
    } catch (err) { toast(err.message, 'err'); }
  };
}

// ---------------------------------------------------------------------------
// Invoice editor (create / edit)
// ---------------------------------------------------------------------------

async function openInvoiceEditor({ invoice = null, onSaved } = {}) {
  const inv = invoice;
  const clients = await api.get('/api/clients');
  let items = inv ? inv.items.map((i) => ({ ...i })) : [{ description: '', qty: 1, unit_cents: 0 }];

  const m = openModal({
    title: inv ? `Edit ${inv.number}` : 'New invoice',
    wide: true,
    body: `
      <div class="form-grid" style="margin-bottom:16px">
        <div class="field"><label>Client</label>
          <select id="ie-client">
            <option value="">— No client —</option>
            ${clients.map((c) => `<option value="${c.id}" ${inv?.client_id === c.id ? 'selected' : ''}>${esc(c.first_name)} ${esc(c.last_name)}</option>`).join('')}
          </select></div>
        <div class="form-grid">
          <div class="field"><label>Issue date</label>
            <input type="date" id="ie-issue" value="${inv?.issue_date || todayStr()}" style="color-scheme:dark"></div>
          <div class="field"><label>Due date</label>
            <input type="date" id="ie-due" value="${inv?.due_date || ''}" style="color-scheme:dark"></div>
        </div>
      </div>
      <div class="mini-label" style="margin-bottom:8px">Line items</div>
      <div class="inv-items-grid inv-items-head"><div>Description</div><div>Qty</div><div>Unit price</div><div style="text-align:right">Amount</div><div></div></div>
      <div id="ie-items"></div>
      <button class="btn small" id="ie-add-item">${icon('plus')} Add line</button>
      <button class="btn small" id="ie-add-service">${icon('tag')} Add service…</button>
      <div class="form-grid" style="margin-top:16px">
        <div class="field"><label>Tax rate %</label>
          <input id="ie-tax" type="number" step="0.1" min="0" value="${inv ? inv.tax_rate : (state.settings.tax_rate || 0)}"></div>
        <div class="field"><label>Discount</label>
          <input id="ie-discount" type="number" step="0.01" min="0" value="${inv ? (inv.discount_cents / 100).toFixed(2) : '0.00'}"></div>
        <div class="field span2"><label>Notes</label>
          <input id="ie-notes" value="${esc(inv?.notes || '')}" placeholder="Shown on the printed invoice"></div>
      </div>
      <div class="inv-totals"><div class="tr grand"><span>Total</span><span class="money" id="ie-total">—</span></div></div>`,
    footer: `<div class="spacer"></div><button class="btn primary" id="ie-save">${icon('check')} ${inv ? 'Save invoice' : 'Create invoice'}</button>`,
  });

  const itemsEl = m.querySelector('#ie-items');
  const totalEl = m.querySelector('#ie-total');

  const recalc = () => {
    const subtotal = items.reduce((s, it) => s + Math.round((Number(it.qty) || 0) * (Number(it.unit_cents) || 0)), 0);
    const discount = Math.round(parseFloat(m.querySelector('#ie-discount').value || 0) * 100);
    const tax = Math.round(Math.max(0, subtotal - discount) * (parseFloat(m.querySelector('#ie-tax').value || 0) / 100));
    totalEl.textContent = money(Math.max(0, subtotal - discount) + tax);
  };

  const drawItems = () => {
    itemsEl.innerHTML = items.map((it, i) => `
      <div class="inv-items-grid">
        <input data-f="description" data-i="${i}" value="${esc(it.description)}" placeholder="Service or product" aria-label="Description">
        <label class="ii-field"><span>Qty</span>
          <input data-f="qty" data-i="${i}" type="number" step="0.5" min="0" value="${it.qty}" aria-label="Quantity"></label>
        <label class="ii-field"><span>Unit price</span>
          <input data-f="unit" data-i="${i}" type="number" step="0.01" min="0" value="${(it.unit_cents / 100).toFixed(2)}" aria-label="Unit price"></label>
        <div class="money" style="text-align:right">${money(Math.round((Number(it.qty) || 0) * (Number(it.unit_cents) || 0)))}</div>
        <button class="icon-btn" data-rm="${i}" aria-label="Remove line">${icon('x')}</button>
      </div>`).join('');
    itemsEl.querySelectorAll('input').forEach((inp) => {
      inp.style.cssText += ';background:var(--bg-raise);border:1px solid var(--border);border-radius:8px;padding:7px 10px';
      inp.addEventListener('input', () => {
        const i = Number(inp.dataset.i);
        if (inp.dataset.f === 'description') items[i].description = inp.value;
        if (inp.dataset.f === 'qty') items[i].qty = parseFloat(inp.value) || 0;
        if (inp.dataset.f === 'unit') items[i].unit_cents = Math.round(parseFloat(inp.value || 0) * 100);
        // Update this line's amount as it's typed. Re-rendering the whole list
        // here would steal focus mid-entry, so just refresh the figure.
        const amt = inp.closest('.inv-items-grid')?.querySelector('.money');
        if (amt) amt.textContent = money(Math.round((Number(items[i].qty) || 0) * (Number(items[i].unit_cents) || 0)));
        recalc();
      });
      // Tidy the figure when the field is left — but never re-render the whole
      // list here: replacing the rows mid-entry drops focus and can discard the
      // value being typed into the next field.
      inp.addEventListener('change', () => {
        const i = Number(inp.dataset.i);
        if (!items[i]) return;
        if (inp.dataset.f === 'unit') inp.value = ((items[i].unit_cents || 0) / 100).toFixed(2);
        if (inp.dataset.f === 'qty') inp.value = String(items[i].qty || 0);
      });
    });
    itemsEl.querySelectorAll('[data-rm]').forEach((b) => {
      b.onclick = () => { items.splice(Number(b.dataset.rm), 1); if (!items.length) items.push({ description: '', qty: 1, unit_cents: 0 }); drawItems(); recalc(); };
    });
    recalc();
  };
  drawItems();

  m.querySelector('#ie-tax').addEventListener('input', recalc);
  m.querySelector('#ie-discount').addEventListener('input', recalc);
  m.querySelector('#ie-add-item').onclick = () => { items.push({ description: '', qty: 1, unit_cents: 0 }); drawItems(); };
  m.querySelector('#ie-add-service').onclick = () => {
    const picker = openModal({
      title: 'Add a service',
      body: state.services.map((s) => `
        <button class="list-item" data-svc="${s.id}" style="width:100%;text-align:left">
          <div style="flex:1"><div class="cell-main">${esc(s.name)}</div><div class="cell-sub">${esc(s.category)}</div></div>
          <div class="money" style="font-weight:600">${priceLabel(s)}</div>
        </button>`).join('') || '<div class="empty">No services defined.</div>',
    });
    picker.addEventListener('click', (e) => {
      const b = e.target.closest('[data-svc]');
      if (!b) return;
      const s = state.services.find((x) => x.id === Number(b.dataset.svc));
      if (items.length === 1 && !items[0].description && !items[0].unit_cents) items = [];
      items.push({ description: s.name, qty: 1, unit_cents: s.price_cents });
      picker.close();
      drawItems();
    });
  };

  m.querySelector('#ie-save').onclick = async () => {
    const payload = {
      client_id: Number(m.querySelector('#ie-client').value) || null,
      issue_date: m.querySelector('#ie-issue').value,
      due_date: m.querySelector('#ie-due').value || undefined,
      tax_rate: parseFloat(m.querySelector('#ie-tax').value || 0),
      discount_cents: Math.round(parseFloat(m.querySelector('#ie-discount').value || 0) * 100),
      notes: m.querySelector('#ie-notes').value,
      items: items.filter((it) => it.description.trim()),
    };
    try {
      const saved = inv ? await api.put(`/api/invoices/${inv.id}`, payload) : await api.post('/api/invoices', payload);
      toast(inv ? 'Invoice updated' : `Invoice ${saved.number} created`);
      m.close();
      onSaved?.();
      openInvoiceModal({ id: saved.id, onChanged: onSaved });
    } catch (err) { toast(err.message, 'err'); }
  };
}

// ---------------------------------------------------------------------------
// Print
// ---------------------------------------------------------------------------

function printInvoice(inv) {
  const s = state.settings;
  const w = window.open('', '_blank', 'width=720,height=900');
  w.document.write(`<!doctype html><html><head><title>${esc(inv.number)}</title>
    <style>
      body { font-family: -apple-system, 'Segoe UI', sans-serif; color: #111; margin: 48px; font-size: 14px; }
      .head { display: flex; justify-content: space-between; margin-bottom: 40px; }
      h1 { font-size: 26px; margin: 0 0 4px; letter-spacing: -0.02em; }
      .muted { color: #666; font-size: 13px; line-height: 1.5; }
      table { width: 100%; border-collapse: collapse; margin-top: 24px; }
      th { text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; color: #888; padding: 8px 10px; border-bottom: 2px solid #222; }
      td { padding: 10px; border-bottom: 1px solid #e5e5e5; }
      .num { text-align: right; font-variant-numeric: tabular-nums; }
      .totals { margin-left: auto; width: 260px; margin-top: 18px; }
      .totals div { display: flex; justify-content: space-between; padding: 4px 0; }
      .grand { border-top: 2px solid #222; margin-top: 8px; padding-top: 10px !important; font-weight: 700; font-size: 17px; }
      .badge { display: inline-block; padding: 3px 12px; border-radius: 99px; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em;
        ${inv.status === 'paid' ? 'background:#d1fae5;color:#065f46' : 'background:#fef3c7;color:#92400e'} }
      .foot { margin-top: 48px; color: #888; font-size: 12px; text-align: center; }
    </style></head><body>
    <div class="head">
      <div>
        <h1>${esc(s.business_name || '')}</h1>
        <div class="muted">${esc(s.business_address || '')}<br>${esc(s.business_phone || '')} · ${esc(s.business_email || '')}</div>
      </div>
      <div style="text-align:right">
        <h1>Invoice</h1>
        <div class="muted">${esc(inv.number)}<br>Issued ${esc(inv.issue_date)}<br>Due ${esc(inv.due_date)}</div>
        <div style="margin-top:8px"><span class="badge">${esc(inv.status)}</span></div>
      </div>
    </div>
    <div class="muted" style="margin-bottom:4px">Billed to</div>
    <div style="font-weight:600;font-size:16px">${esc(inv.client_name || 'Walk-in client')}</div>
    <div class="muted">${esc(inv.client_email || '')} ${esc(inv.client_phone || '')}</div>
    <table>
      <thead><tr><th>Description</th><th class="num">Qty</th><th class="num">Unit</th><th class="num">Amount</th></tr></thead>
      <tbody>${inv.items.map((it) => `<tr><td>${esc(it.description)}</td><td class="num">${it.qty}</td>
        <td class="num">${money(it.unit_cents)}</td><td class="num">${money(Math.round(it.qty * it.unit_cents))}</td></tr>`).join('')}</tbody>
    </table>
    <div class="totals">
      <div><span>Subtotal</span><span>${money(inv.subtotal_cents)}</span></div>
      ${inv.discount_cents ? `<div><span>Discount</span><span>−${money(inv.discount_cents)}</span></div>` : ''}
      <div><span>Tax (${inv.tax_rate}%)</span><span>${money(inv.tax_cents)}</span></div>
      <div class="grand"><span>Total</span><span>${money(inv.total_cents)}</span></div>
      ${inv.paid_cents ? `<div><span>Paid</span><span>−${money(inv.paid_cents)}</span></div>` : ''}
      ${inv.balance_cents > 0 && inv.status !== 'void' ? `<div style="font-weight:700"><span>Balance due</span><span>${money(inv.balance_cents)}</span></div>` : ''}
    </div>
    ${inv.notes ? `<p class="muted">${esc(inv.notes)}</p>` : ''}
    <div class="foot">${esc(s.invoice_footer || '')}</div>
    <script>window.onload = () => window.print()</${'script'}>
    </body></html>`);
  w.document.close();
}
