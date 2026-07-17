// Point of Sale — the "Bill customer" screen, designed phone-first with large
// one-hand targets. Flow: pick today's appointment (or walk-in) → line items
// (services + products + custom, qty, discount) → GST + total → charge:
//   Cash/other → recorded instantly.
//   Card → Stripe Checkout: customer pays on this phone or via a shared link
//   on their own phone (Apple Pay / Google Pay appear automatically there).
// The screen polls the server, which verifies payment with Stripe directly —
// success flips the moment the money is confirmed. No refresh, no duplicates.
import { api } from '../api.js';
import { esc, icon, money, fmtTime, todayStr, openModal, confirmDialog, toast } from '../ui.js';
import { state } from '../app.js';

const pos = {
  step: 'start',        // start | cart | await | done
  items: [],            // {type, id, description, qty, unit_cents, product_id?}
  clientId: null, clientName: '',
  apptId: null,
  discount: 0,          // cents
  invoiceId: null, checkoutUrl: '', totalCents: 0,
  products: [],
};
let pollTimer = null;
const stopPolling = () => { if (pollTimer) { clearInterval(pollTimer); pollTimer = null; } };

export async function renderPos(container) {
  stopPolling();
  pos.products = await api.get('/api/products');
  if (pos.step === 'await' && pos.invoiceId) { draw(container); startPolling(container); return; }
  if (pos.step !== 'done') pos.step = pos.items.length ? 'cart' : 'start';
  draw(container);
}

const taxRate = () => Number(state.settings.tax_rate || 0) || 0;
const subtotal = () => pos.items.reduce((s, it) => s + it.qty * it.unit_cents, 0);
const taxCents = () => Math.round((subtotal() - pos.discount) * (taxRate() / 100));
const totalCents = () => Math.max(0, subtotal() - pos.discount + taxCents());

function resetSale() {
  stopPolling();
  Object.assign(pos, { step: 'start', items: [], clientId: null, clientName: '', apptId: null, discount: 0, invoiceId: null, checkoutUrl: '', totalCents: 0 });
}

function draw(container) {
  const step = pos.step;
  container.innerHTML = `
    <div class="pos">
      ${step === 'start' ? startHtml() : step === 'cart' ? cartHtml() : step === 'await' ? awaitHtml() : doneHtml()}
    </div>`;
  wire(container);
}

// ---------------------------------------------------------------------------
// Step 1 — start: Bill customer (today's appointments) or walk-in
// ---------------------------------------------------------------------------

let todayAppts = [];
function startHtml() {
  return `
    <div class="page-head">
      <div class="ph-icon">${icon('card', 20)}</div>
      <div><h1>Point of Sale</h1><div class="ph-sub">Bill a customer in a few taps</div></div>
    </div>
    <button class="pos-hero" id="pos-walkin">${icon('plus', 22)} New sale · walk-in</button>
    <div class="mini-label" style="margin:20px 0 8px">Or bill one of today's appointments</div>
    <div id="pos-today"><div class="empty">Loading today…</div></div>`;
}

async function loadToday(container) {
  const today = todayStr();
  const appts = await api.get(`/api/appointments?from=${today}&to=${today}`);
  todayAppts = appts.filter((a) => !['cancelled', 'no_show'].includes(a.status) && !a.invoice_id);
  const el = container.querySelector('#pos-today');
  if (!el) return;
  el.innerHTML = todayAppts.length ? todayAppts.map((a) => `
    <button class="pos-appt" data-appt="${a.id}">
      <div style="flex:1;text-align:left">
        <div class="cell-main">${esc(a.client_name || 'Walk-in')}</div>
        <div class="cell-sub">${esc(a.services_summary || a.service_name || 'No service')} · ${fmtTime(a.start_min)} · ${esc(a.staff_name || '')}</div>
      </div>
      ${icon('chevR', 16)}
    </button>`).join('')
    : '<div class="empty" style="padding:20px 0">Nothing unbilled today — start a walk-in sale above.</div>';
}

// ---------------------------------------------------------------------------
// Step 2 — cart: items, qty, discount, totals, charge
// ---------------------------------------------------------------------------

function cartHtml() {
  const sub = subtotal(), tax = taxCents(), total = totalCents();
  return `
    <div class="page-head">
      <div class="ph-icon">${icon('card', 20)}</div>
      <div><h1>New sale</h1><div class="ph-sub">${pos.clientName ? `Billing ${esc(pos.clientName)}` : 'Walk-in customer'}</div></div>
      <div class="ph-actions"><button class="btn ghost" id="pos-abandon">${icon('x')} Discard</button></div>
    </div>

    <div class="pos-lines" id="pos-lines">
      ${pos.items.length ? pos.items.map((it, i) => `
        <div class="pos-line">
          <div style="flex:1;min-width:0">
            <div class="cell-main" style="white-space:normal">${esc(it.description)}</div>
            <div class="cell-sub">${money(it.unit_cents)} each${it.type === 'product' ? ' · product' : it.type === 'custom' ? ' · custom' : ''}</div>
          </div>
          <div class="pos-qty">
            <button class="pq-btn" data-dec="${i}" aria-label="Less">−</button>
            <span>${it.qty}</span>
            <button class="pq-btn" data-inc="${i}" aria-label="More">+</button>
          </div>
          <div class="money pos-line-amt">${money(it.qty * it.unit_cents)}</div>
          <button class="icon-btn" data-rm="${i}" title="Remove">${icon('x', 14)}</button>
        </div>`).join('')
      : `<div class="empty" style="padding:22px 0">${icon('card')}<div>No items yet — add a service or product below.</div></div>`}
    </div>

    <div class="pos-adders">
      <button class="btn" id="add-service">${icon('tag')} Service</button>
      <button class="btn" id="add-product">${icon('plus')} Product</button>
      <button class="btn" id="add-custom">${icon('edit')} Custom</button>
      <button class="btn" id="add-discount">${icon('dollar')} Discount</button>
    </div>

    <div class="pos-totals card">
      <div class="tr"><span>Subtotal</span><span class="money">${money(sub)}</span></div>
      ${pos.discount ? `<div class="tr"><span>Discount</span><span class="money">−${money(pos.discount)}</span></div>` : ''}
      ${taxRate() > 0 ? `<div class="tr"><span>GST (${taxRate()}%)</span><span class="money">${money(tax)}</span></div>` : ''}
      <div class="tr grand"><span>Total</span><span class="money">${money(total)}</span></div>
    </div>

    <div class="pos-paybar">
      <button class="pos-charge" id="pos-charge" ${total <= 0 ? 'disabled' : ''}>Charge ${money(total)}</button>
    </div>`;
}

function pickerModal(title, rows, onPick) {
  const m = openModal({
    title,
    body: `
      <div class="search-box" style="margin-bottom:12px">${icon('search')}<input id="pk-q" placeholder="Search…"></div>
      <div id="pk-rows" style="max-height:46vh;overflow-y:auto"></div>`,
    footer: '<div class="spacer"></div>',
  });
  const rowsEl = m.querySelector('#pk-rows');
  const paint = (q = '') => {
    const list = rows.filter((r) => r.label.toLowerCase().includes(q.toLowerCase()));
    rowsEl.innerHTML = list.length ? list.map((r, i) => `
      <button class="pos-appt" data-pick="${i}" ${r.disabled ? 'disabled style="opacity:.45"' : ''}>
        <div style="flex:1;text-align:left">
          <div class="cell-main">${esc(r.label)}</div>
          ${r.sub ? `<div class="cell-sub">${esc(r.sub)}</div>` : ''}
        </div>
        <span class="money" style="font-weight:700">${r.price}</span>
      </button>`).join('') : '<div class="empty" style="padding:18px 0">No matches.</div>';
    rowsEl.querySelectorAll('[data-pick]').forEach((b) => {
      b.onclick = () => { const r = list[Number(b.dataset.pick)]; if (!r.disabled) { m.close(); onPick(r); } };
    });
  };
  paint();
  m.querySelector('#pk-q').addEventListener('input', (e) => paint(e.target.value.trim()));
  m.querySelector('#pk-q').focus();
}

function addItem(item) {
  // merge with an identical existing line (same type+id+price) by bumping qty
  const twin = pos.items.find((it) => it.type === item.type && it.id === item.id && it.unit_cents === item.unit_cents && item.type !== 'custom');
  if (twin) twin.qty = Math.min(999, twin.qty + item.qty);
  else pos.items.push(item);
}

// ---------------------------------------------------------------------------
// Step 3 — await card payment (Stripe Checkout) with live status polling
// ---------------------------------------------------------------------------

function awaitHtml() {
  return `
    <div class="pos-center">
      <div class="pos-bigtotal">${money(pos.totalCents)}</div>
      <div class="pos-pulse"><i></i><span>Waiting for payment…</span></div>
      <div class="cell-sub" style="max-width:340px;text-align:center;margin:14px auto 22px;line-height:1.6">
        Take payment on <b>this phone</b> (card details or wallet), or share the secure
        payment link to the customer's phone — Apple Pay and Google Pay appear automatically there.
      </div>
      <div style="display:flex;flex-direction:column;gap:10px;width:min(340px,100%)">
        <button class="btn primary" id="pay-open" style="justify-content:center;padding:13px">${icon('card')} Open payment page</button>
        <button class="btn" id="pay-share" style="justify-content:center;padding:13px">${icon('send')} Share payment link</button>
        <button class="btn ghost" id="pay-cancel" style="justify-content:center">Cancel sale</button>
      </div>
    </div>`;
}

function startPolling(container) {
  stopPolling();
  pollTimer = setInterval(async () => {
    if (!document.body.contains(container)) { stopPolling(); return; }
    try {
      const res = await api.get(`/api/pos/status/${pos.invoiceId}`);
      if (res.paid) {
        stopPolling();
        pos.step = 'done';
        pos.totalCents = res.invoice?.total_cents ?? pos.totalCents;
        draw(container);
      } else if (res.void) {
        stopPolling();
        toast('Sale was cancelled', 'err');
        resetSale(); draw(container); loadToday(container);
      }
    } catch { /* transient — keep polling */ }
  }, 2500);
}

// ---------------------------------------------------------------------------
// Step 4 — success
// ---------------------------------------------------------------------------

function doneHtml() {
  return `
    <div class="pos-center">
      <div class="pos-check">${icon('check', 30)}</div>
      <div style="font-size:21px;font-weight:800;margin-top:14px">Payment received</div>
      <div class="pos-bigtotal" style="font-size:34px;margin-top:6px">${money(pos.totalCents)}</div>
      <div class="cell-sub" style="margin-top:10px">Invoice marked paid · receipt emailed if the client has an email on file.</div>
      <div style="display:flex;flex-direction:column;gap:10px;width:min(340px,100%);margin-top:24px">
        <button class="btn primary" id="pos-again" style="justify-content:center;padding:13px">${icon('plus')} New sale</button>
        <a class="btn" href="#/invoices" style="justify-content:center;padding:13px">${icon('invoice')} View in Billing</a>
      </div>
    </div>`;
}

// ---------------------------------------------------------------------------
// Wiring
// ---------------------------------------------------------------------------

function wire(container) {
  const redraw = () => draw(container);

  if (pos.step === 'start') {
    container.querySelector('#pos-walkin').onclick = () => { pos.step = 'cart'; redraw(); };
    loadToday(container);
    container.querySelector('#pos-today').addEventListener('click', (e) => {
      const b = e.target.closest('[data-appt]');
      if (!b) return;
      const a = todayAppts.find((x) => x.id === Number(b.dataset.appt));
      if (!a) return;
      pos.apptId = a.id; pos.clientId = a.client_id; pos.clientName = a.client_name || '';
      const ids = a.service_ids_csv ? String(a.service_ids_csv).split(',').map(Number) : (a.service_id ? [a.service_id] : []);
      pos.items = ids.map((sid) => {
        const svc = state.services.find((s) => s.id === sid);
        return svc ? { type: 'service', id: svc.id, description: svc.name, qty: 1, unit_cents: svc.price_cents } : null;
      }).filter(Boolean);
      pos.step = 'cart';
      redraw();
    });
    return;
  }

  if (pos.step === 'cart') {
    container.querySelector('#pos-abandon').onclick = () => { resetSale(); redraw(); };
    container.querySelector('#pos-lines').addEventListener('click', (e) => {
      const inc = e.target.closest('[data-inc]'); const dec = e.target.closest('[data-dec]'); const rm = e.target.closest('[data-rm]');
      if (inc) { pos.items[Number(inc.dataset.inc)].qty = Math.min(999, pos.items[Number(inc.dataset.inc)].qty + 1); redraw(); }
      else if (dec) { const it = pos.items[Number(dec.dataset.dec)]; it.qty > 1 ? it.qty-- : pos.items.splice(Number(dec.dataset.dec), 1); redraw(); }
      else if (rm) { pos.items.splice(Number(rm.dataset.rm), 1); redraw(); }
    });

    container.querySelector('#add-service').onclick = () => pickerModal('Add a service',
      state.services.map((s) => ({
        label: s.name, sub: s.category, price: s.price_type === 'free' ? 'Free' : (s.price_type === 'from' ? 'From ' : '') + money(s.price_cents), svc: s,
      })),
      (r) => {
        const s = r.svc;
        if (s.price_type === 'from') {
          askAmount(`Final price for ${s.name}`, s.price_cents, (cents) => {
            addItem({ type: 'service', id: s.id, description: s.name, qty: 1, unit_cents: Math.max(s.price_cents, cents) });
            redraw();
          });
        } else {
          addItem({ type: 'service', id: s.id, description: s.name, qty: 1, unit_cents: s.price_cents });
          redraw();
        }
      });

    container.querySelector('#add-product').onclick = () => pickerModal('Add a product',
      pos.products.map((p) => ({
        label: p.name, sub: `${p.category} · ${p.stock_qty} in stock`, price: money(p.retail_cents),
        disabled: p.stock_qty <= 0, prod: p,
      })),
      (r) => { addItem({ type: 'product', id: r.prod.id, description: r.prod.name, qty: 1, unit_cents: r.prod.retail_cents }); redraw(); });

    container.querySelector('#add-custom').onclick = () => {
      const m = openModal({
        title: 'Custom item',
        body: `<form id="cu-form" class="form-grid">
          <div class="field span2"><label>Description *</label><input name="desc" required maxlength="150" placeholder="e.g. Fringe trim"></div>
          <div class="field span2"><label>Amount *</label><input name="amt" type="number" min="0.01" step="0.01" required placeholder="0.00"></div>
        </form>`,
        footer: `<div class="spacer"></div><button class="btn primary" id="cu-add">${icon('check')} Add</button>`,
      });
      m.querySelector('#cu-add').onclick = () => {
        const fd = new FormData(m.querySelector('#cu-form'));
        const desc = String(fd.get('desc') || '').trim();
        const cents = Math.round(Number(fd.get('amt')) * 100);
        if (!desc || !Number.isFinite(cents) || cents <= 0) { toast('Enter a description and amount', 'err'); return; }
        pos.items.push({ type: 'custom', description: desc, qty: 1, unit_cents: cents });
        m.close(); redraw();
      };
    };

    container.querySelector('#add-discount').onclick = () =>
      askAmount('Discount amount', pos.discount || 0, (cents) => {
        if (cents > subtotal()) { toast('Discount cannot exceed the subtotal', 'err'); return; }
        pos.discount = cents; redraw();
      }, { allowZero: true });

    const charge = container.querySelector('#pos-charge');
    charge.onclick = () => {
      const total = totalCents();
      const m = openModal({
        title: `Take ${money(total)}`,
        body: `<div style="display:flex;flex-direction:column;gap:10px">
          <button class="pos-paychoice" id="pc-card">${icon('card', 18)} <span><b>Card / wallet</b><br><span class="cell-sub">Customer pays securely via Stripe — this phone or theirs</span></span></button>
          <button class="pos-paychoice" id="pc-cash">${icon('dollar', 18)} <span><b>Cash</b><br><span class="cell-sub">Record the sale as paid now</span></span></button>
          <button class="pos-paychoice" id="pc-other">${icon('invoice', 18)} <span><b>Other</b><br><span class="cell-sub">Bank transfer, voucher, etc.</span></span></button>
        </div>`,
        footer: '<div class="spacer"></div>',
      });
      const submit = async (method, btn) => {
        btn.disabled = true; // double-tap guard
        try {
          const res = await api.post('/api/pos/sale', {
            client_id: pos.clientId || undefined,
            appointment_id: pos.apptId || undefined,
            items: pos.items.map((it) => ({ type: it.type, id: it.id, description: it.description, qty: it.qty, unit_cents: it.unit_cents })),
            discount_cents: pos.discount,
            method,
            origin: location.origin,
          });
          m.close();
          pos.invoiceId = res.invoice_id;
          pos.totalCents = res.total_cents;
          if (res.paid) { pos.step = 'done'; redraw(); }
          else { pos.checkoutUrl = res.checkout_url; pos.step = 'await'; redraw(); startPolling(container); }
        } catch (err) { toast(err.message, 'err'); btn.disabled = false; }
      };
      m.querySelector('#pc-card').onclick = (e) => submit('stripe', e.currentTarget);
      m.querySelector('#pc-cash').onclick = (e) => submit('cash', e.currentTarget);
      m.querySelector('#pc-other').onclick = (e) => submit('other', e.currentTarget);
    };
    return;
  }

  if (pos.step === 'await') {
    container.querySelector('#pay-open').onclick = () => window.open(pos.checkoutUrl, '_blank');
    container.querySelector('#pay-share').onclick = async () => {
      if (navigator.share) {
        try { await navigator.share({ title: 'Pay for your visit', url: pos.checkoutUrl }); } catch { /* user closed the sheet */ }
      } else {
        try { await navigator.clipboard.writeText(pos.checkoutUrl); toast('Payment link copied — send it to the customer'); }
        catch { toast('Could not copy — use Open payment page instead', 'err'); }
      }
    };
    container.querySelector('#pay-cancel').onclick = async () => {
      const ok = await confirmDialog('Cancel sale', 'No charge will be made and the sale is voided.', { danger: true, okText: 'Cancel sale' });
      if (!ok) return;
      stopPolling();
      await api.patch(`/api/invoices/${pos.invoiceId}/status`, { status: 'void' }).catch(() => {});
      resetSale(); draw(container);
    };
    return;
  }

  if (pos.step === 'done') {
    container.querySelector('#pos-again').onclick = () => { resetSale(); draw(container); };
  }
}

/** Small amount-entry modal (dollars in, cents out). */
function askAmount(title, presetCents, onOk, { allowZero = false } = {}) {
  const m = openModal({
    title,
    body: `<div class="field"><label>Amount</label>
      <input id="ask-amt" type="number" min="0" step="0.01" value="${presetCents ? (presetCents / 100).toFixed(2) : ''}" placeholder="0.00"></div>`,
    footer: `<div class="spacer"></div><button class="btn primary" id="ask-ok">${icon('check')} OK</button>`,
  });
  const input = m.querySelector('#ask-amt');
  input.focus(); input.select();
  m.querySelector('#ask-ok').onclick = () => {
    const cents = Math.round(Number(input.value || 0) * 100);
    if (!Number.isFinite(cents) || cents < 0 || (!allowZero && cents <= 0)) { toast('Enter a valid amount', 'err'); return; }
    m.close(); onOk(cents);
  };
}
