// Products: retail inventory sold at the POS counter — searchable list with
// stock levels, low-stock warnings, and an add/edit modal (image, SKU,
// barcode, retail/cost price, supplier, GST, stock).
import { api } from '../api.js';
import { esc, icon, money, openModal, confirmDialog, toast } from '../ui.js';

let showBy = 'all'; // all | low | archived

export async function renderProducts(container, params) {
  await drawList(container, params?.get('q') || '');
}

function readImage(file, maxKb) {
  return new Promise((resolve, reject) => {
    if (file.size > maxKb * 1024) { reject(new Error(`Image too large — keep it under ${maxKb} KB`)); return; }
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(new Error('Could not read that file'));
    r.readAsDataURL(file);
  });
}

async function drawList(container, q = '') {
  const products = await api.get(`/api/products?all=1${q ? `&q=${encodeURIComponent(q)}` : ''}`);
  const active = products.filter((p) => p.active);
  const lowCount = active.filter((p) => p.stock_qty <= p.low_stock_at).length;

  const view = showBy === 'low' ? active.filter((p) => p.stock_qty <= p.low_stock_at)
    : showBy === 'archived' ? products.filter((p) => !p.active)
    : active;

  container.innerHTML = `
    <div class="page-head">
      <div class="ph-icon">${icon('tag', 20)}</div>
      <div><h1>Products</h1><div class="ph-sub">${active.length} product${active.length === 1 ? '' : 's'} in stock${lowCount ? ` · <span style="color:var(--amber)">${lowCount} running low</span>` : ''}</div></div>
      <div class="ph-actions">
        <button class="btn primary" id="pr-new">${icon('plus')} New product</button>
      </div>
    </div>
    <div class="toolbar" style="gap:10px;flex-wrap:wrap">
      <div class="search-box" style="flex:0 1 320px">${icon('search')}
        <input id="pr-search" placeholder="Search name, SKU, barcode…" value="${esc(q)}"></div>
      <label class="filter-select">${icon('filter', 14)}
        <select id="pr-show">
          <option value="all" ${showBy === 'all' ? 'selected' : ''}>All products</option>
          <option value="low" ${showBy === 'low' ? 'selected' : ''}>Low stock</option>
          <option value="archived" ${showBy === 'archived' ? 'selected' : ''}>Archived</option>
        </select></label>
    </div>
    <div class="card" style="padding:0"><div class="table-wrap">
      <table class="data reflow">
        <thead><tr><th>Product</th><th>SKU</th><th class="num">Retail</th><th class="num">Cost</th><th class="num">Stock</th><th></th></tr></thead>
        <tbody id="pr-rows">
          ${view.length ? view.map(rowHtml).join('') : `
            <tr><td colspan="6"><div class="empty">${icon('tag')}<div>No products${q || showBy !== 'all' ? ' match' : ' yet — add your retail shelf'}.</div></div></td></tr>`}
        </tbody>
      </table>
    </div></div>`;

  const search = container.querySelector('#pr-search');
  let deb;
  search.addEventListener('input', () => { clearTimeout(deb); deb = setTimeout(() => drawList(container, search.value.trim()), 250); });
  container.querySelector('#pr-show').addEventListener('change', (e) => { showBy = e.target.value; drawList(container, q); });
  container.querySelector('#pr-new').onclick = () => openProductModal({ onSaved: () => drawList(container, q) });
  container.querySelector('#pr-rows').addEventListener('click', (e) => {
    const row = e.target.closest('tr[data-id]');
    if (!row) return;
    const p = products.find((x) => x.id === Number(row.dataset.id));
    if (p) openProductModal({ product: p, onSaved: () => drawList(container, q) });
  });
}

function rowHtml(p) {
  const low = p.active && p.stock_qty <= p.low_stock_at;
  return `
    <tr data-id="${p.id}">
      <td class="rf-head"><div class="row-flex">
        ${p.image ? `<img src="${esc(p.image)}" alt="" style="width:34px;height:34px;object-fit:cover;border-radius:8px;border:1px solid var(--border)">`
          : `<span class="st-icon tint-cyan" style="width:34px;height:34px">${icon('tag', 15)}</span>`}
        <div><div class="cell-main">${esc(p.name)}${p.active ? '' : ' <span class="cell-sub">(archived)</span>'}</div>
          <div class="cell-sub">${esc(p.category)}${p.supplier ? ` · ${esc(p.supplier)}` : ''}</div></div>
      </div></td>
      <td data-th="SKU" class="cell-sub">${esc(p.sku || p.barcode || '—')}</td>
      <td data-th="Retail" class="num money">${money(p.retail_cents)}</td>
      <td data-th="Cost" class="num money" style="color:var(--muted)">${money(p.cost_cents)}</td>
      <td data-th="Stock" class="num">${low ? `<span class="chip s-sent" title="At or below the low-stock level of ${p.low_stock_at}">${p.stock_qty} · LOW</span>` : p.stock_qty}</td>
      <td class="num rf-action"><button class="icon-btn" title="Edit">${icon('edit')}</button></td>
    </tr>`;
}

export function openProductModal({ product = null, onSaved } = {}) {
  const p = product;
  let image = p?.image || '';
  const m = openModal({
    title: p ? 'Edit product' : 'New product',
    wide: true,
    body: `
      <form id="product-form" class="form-grid">
        <div class="field span2"><label>Product name *</label><input name="name" required value="${esc(p?.name || '')}" placeholder="e.g. Olaplex No.3 Hair Perfector"></div>
        <div class="field"><label>Category</label><input name="category" value="${esc(p?.category || '')}" placeholder="Hair care"></div>
        <div class="field"><label>Supplier</label><input name="supplier" value="${esc(p?.supplier || '')}" placeholder="Who you buy it from"></div>
        <div class="field"><label>SKU</label><input name="sku" value="${esc(p?.sku || '')}" placeholder="OLA-N3"></div>
        <div class="field"><label>Barcode</label><input name="barcode" value="${esc(p?.barcode || '')}" placeholder="EAN/UPC"></div>
        <div class="field"><label>Retail price *</label><input name="retail" type="number" min="0" step="0.01" required value="${p ? (p.retail_cents / 100).toFixed(2) : ''}"></div>
        <div class="field"><label>Cost price</label><input name="cost" type="number" min="0" step="0.01" value="${p ? (p.cost_cents / 100).toFixed(2) : ''}">
          <div class="hint">What it costs you — used for margin, never shown to clients.</div></div>
        <div class="field"><label>Stock on hand</label><input name="stock" type="number" min="0" step="1" value="${p?.stock_qty ?? 0}"></div>
        <div class="field"><label>Warn when stock at or below</label><input name="low" type="number" min="0" step="1" value="${p?.low_stock_at ?? 3}"></div>
        <div class="field span2"><label>Photo (optional)</label>
          <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
            <img id="pr-img-preview" src="${image && image.startsWith('data:image/') ? esc(image) : ''}" alt=""
              style="height:52px;width:52px;object-fit:cover;border-radius:8px;border:1px solid var(--border);${image ? '' : 'display:none'}">
            <button type="button" class="btn small" id="pr-img-pick">${icon('upload')} Upload photo</button>
            <button type="button" class="btn small danger" id="pr-img-clear" style="${image ? '' : 'display:none'}">Remove</button>
            <input type="file" id="pr-img-file" accept="image/png,image/jpeg,image/webp" style="display:none">
          </div></div>
        <label class="span2" style="display:flex;gap:9px;align-items:center;cursor:pointer">
          <input type="checkbox" name="taxable" ${!p || p.taxable ? 'checked' : ''} class="chk">
          <span>GST/tax applies to this product</span>
        </label>
      </form>`,
    footer: `
      ${p ? `<button class="btn danger" id="pr-delete">${icon('trash')} ${p.active ? 'Delete' : 'Archived'}</button>` : ''}
      <div class="spacer"></div>
      <button class="btn primary" id="pr-save">${icon('check')} ${p ? 'Save changes' : 'Add product'}</button>`,
  });

  const file = m.querySelector('#pr-img-file');
  m.querySelector('#pr-img-pick').onclick = () => file.click();
  file.addEventListener('change', async () => {
    if (!file.files[0]) return;
    try {
      image = await readImage(file.files[0], 400);
      const prev = m.querySelector('#pr-img-preview');
      prev.src = image; prev.style.display = '';
      m.querySelector('#pr-img-clear').style.display = '';
    } catch (err) { toast(err.message, 'err'); }
  });
  m.querySelector('#pr-img-clear').onclick = (e) => {
    image = '';
    m.querySelector('#pr-img-preview').style.display = 'none';
    e.target.style.display = 'none';
  };

  m.querySelector('#pr-save').onclick = async () => {
    const fd = new FormData(m.querySelector('#product-form'));
    if (!String(fd.get('name') || '').trim()) { toast('Product name is required', 'err'); return; }
    const payload = {
      name: fd.get('name'), category: fd.get('category'), supplier: fd.get('supplier'),
      sku: fd.get('sku'), barcode: fd.get('barcode'),
      retail_cents: Math.round(Number(fd.get('retail') || 0) * 100),
      cost_cents: Math.round(Number(fd.get('cost') || 0) * 100),
      stock_qty: Math.max(0, Math.round(Number(fd.get('stock') || 0))),
      low_stock_at: Math.max(0, Math.round(Number(fd.get('low') || 0))),
      image, taxable: fd.get('taxable') === 'on', active: true,
    };
    try {
      if (p) await api.put(`/api/products/${p.id}`, payload);
      else await api.post('/api/products', payload);
      toast(p ? 'Product updated' : 'Product added');
      m.close(); onSaved?.();
    } catch (err) { toast(err.message, 'err'); }
  };

  if (p) {
    m.querySelector('#pr-delete').onclick = async () => {
      const ok = await confirmDialog('Delete product',
        `Remove <b>${esc(p.name)}</b>? If it has ever been sold it is archived instead, so past receipts keep their history.`,
        { danger: true, okText: 'Delete' });
      if (!ok) return;
      const res = await api.del(`/api/products/${p.id}`);
      toast(res.archived ? 'Product archived (kept for sales history)' : 'Product deleted');
      m.close(); onSaved?.();
    };
  }
}
