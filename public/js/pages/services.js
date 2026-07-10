// Services: category-grouped catalogue, add/edit, CSV import/export.
import { api } from '../api.js';
import { esc, icon, money, openModal, confirmDialog, toast, downloadText } from '../ui.js';
import { runImportWizard } from '../import.js';
import { refreshLookups } from '../app.js';

export async function renderServices(container) {
  const services = await api.get('/api/services?all=1');
  const active = services.filter((s) => s.active);
  const inactive = services.filter((s) => !s.active);
  const cats = [...new Set(active.map((s) => s.category))];

  const durLabel = (v) => (v >= 60 ? `${Math.floor(v / 60)}h${v % 60 ? ` ${v % 60}m` : ''}` : `${v} min`);
  const card = (s) => `
    <div class="card svc-card" data-id="${s.id}" style="${s.active ? '' : 'opacity:0.55'}">
      <div class="sc-top">
        <div class="sc-name">${esc(s.name)}</div>
        <div class="sc-price money">${money(s.price_cents)}</div>
      </div>
      ${s.description ? `<div class="cell-sub">${esc(s.description)}</div>` : ''}
      <div class="sc-meta">
        <span>${icon('clock')} ${durLabel(s.duration_min)}</span>
        ${s.active ? '' : '<span class="chip">Archived</span>'}
      </div>
    </div>`;

  container.innerHTML = `
    <div class="page-head">
      <div class="ph-icon">${icon('tag', 20)}</div>
      <div><h1>Services</h1><div class="ph-sub">${active.length} bookable service${active.length === 1 ? '' : 's'} across ${cats.length} categor${cats.length === 1 ? 'y' : 'ies'}</div></div>
      <div class="ph-actions">
        <button class="btn" id="sv-import">${icon('upload')} Import CSV</button>
        <button class="btn" id="sv-export">${icon('download')} Export</button>
        <button class="btn primary" id="sv-new">${icon('plus')} New service</button>
      </div>
    </div>
    ${cats.map((cat) => `
      <div class="svc-cat">
        <h3>${esc(cat)}</h3>
        <div class="svc-grid">${active.filter((s) => s.category === cat).map(card).join('')}</div>
      </div>`).join('')}
    ${inactive.length ? `
      <div class="svc-cat"><h3>Archived</h3>
        <div class="svc-grid">${inactive.map(card).join('')}</div></div>` : ''}
    ${!services.length ? `<div class="card"><div class="empty">${icon('tag')}<div>No services yet — add your menu or import a CSV.</div></div></div>` : ''}`;

  const redraw = async () => { await refreshLookups(); renderServices(container); };

  container.querySelector('#sv-new').onclick = () => openServiceModal({ cats, onSaved: redraw });
  container.querySelector('#sv-export').onclick = async () => {
    const res = await fetch('/api/services/export', { credentials: 'same-origin' });
    downloadText('services.csv', await res.text());
    toast('Service menu exported');
  };
  container.querySelector('#sv-import').onclick = () => runImportWizard({ kind: 'services', onDone: redraw });
  container.querySelectorAll('.svc-card').forEach((el) => {
    el.onclick = () => {
      const s = services.find((x) => x.id === Number(el.dataset.id));
      openServiceModal({ service: s, cats, onSaved: redraw });
    };
  });
}

function openServiceModal({ service = null, cats = [], onSaved } = {}) {
  const s = service;
  const m = openModal({
    title: s ? 'Edit service' : 'New service',
    body: `
      <form id="svc-form" class="form-grid">
        <div class="field span2"><label>Service name *</label>
          <input name="name" required value="${esc(s?.name || '')}" placeholder="e.g. Root Colour + Refresh"></div>
        <div class="field"><label>Category</label>
          <input name="category" list="cat-list" value="${esc(s?.category || '')}" placeholder="Colour">
          <datalist id="cat-list">${cats.map((c) => `<option value="${esc(c)}">`).join('')}</datalist></div>
        <div class="field"><label>Duration (minutes) *</label>
          <input name="duration_min" type="number" min="5" step="5" required value="${s?.duration_min || 60}"></div>
        <div class="field"><label>Price *</label>
          <input name="price" type="number" min="0" step="0.01" required value="${s ? (s.price_cents / 100).toFixed(2) : ''}" placeholder="85.00"></div>
        <div class="field"><label>&nbsp;</label>
          <label style="display:flex;align-items:center;gap:8px;font-weight:500;color:var(--text-2);cursor:pointer">
            <input type="checkbox" name="active" ${!s || s.active ? 'checked' : ''} style="width:15px;height:15px;accent-color:var(--accent)"> Bookable online</label></div>
        <div class="field span2"><label>Description</label>
          <textarea name="description" placeholder="Shown to clients on your booking page">${esc(s?.description || '')}</textarea></div>
      </form>`,
    footer: `
      ${s ? `<button class="btn danger" id="svc-delete">${icon('trash')} ${s.active ? 'Archive' : 'Delete'}</button>` : ''}
      <div class="spacer"></div>
      <button class="btn primary" id="svc-save">${icon('check')} ${s ? 'Save changes' : 'Add service'}</button>`,
  });

  m.querySelector('#svc-save').onclick = async () => {
    const fd = new FormData(m.querySelector('#svc-form'));
    const payload = {
      name: fd.get('name'), category: fd.get('category'),
      duration_min: Number(fd.get('duration_min')), price: fd.get('price'),
      description: fd.get('description'), active: fd.get('active') === 'on',
    };
    if (!payload.name.trim()) { toast('Service name is required', 'err'); return; }
    try {
      if (s) await api.put(`/api/services/${s.id}`, payload);
      else await api.post('/api/services', payload);
      toast(s ? 'Service updated' : 'Service added');
      m.close(); onSaved?.();
    } catch (err) { toast(err.message, 'err'); }
  };
  if (s) {
    m.querySelector('#svc-delete').onclick = async () => {
      const ok = await confirmDialog(s.active ? 'Archive service' : 'Delete service',
        s.active
          ? `Archive <b>${esc(s.name)}</b>? Past appointments keep it; it disappears from booking.`
          : `Permanently delete <b>${esc(s.name)}</b>?`,
        { danger: true, okText: s.active ? 'Archive' : 'Delete' });
      if (!ok) return;
      await api.del(`/api/services/${s.id}`);
      toast(s.active ? 'Service archived' : 'Service deleted');
      m.close(); onSaved?.();
    };
  }
}
