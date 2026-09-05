// Services: category-grouped catalogue, add/edit, CSV import/export.
import { api } from '../api.js';
import { esc, icon, money, priceLabel, openModal, confirmDialog, toast, downloadText } from '../ui.js';
import { runImportWizard } from '../import.js';
import { refreshLookups } from '../app.js';

export async function renderServices(container) {
  const services = await api.get('/api/services?all=1');
  // Which services gate something. Its own call so the service list stays the
  // plain catalogue it has always been for every other screen that reads it.
  let gated = new Map();
  try {
    const ov = await api.get('/api/safety/overview');
    for (const r of (ov?.requirements || [])) {
      const e = gated.get(r.service_id) || [];
      e.push(r.kind);
      gated.set(r.service_id, e);
    }
  } catch { gated = new Map(); }
  const active = services.filter((s) => s.active);
  const inactive = services.filter((s) => !s.active);
  const cats = [...new Set(active.map((s) => s.category))];

  const durLabel = (v) => (v >= 60 ? `${Math.floor(v / 60)}h${v % 60 ? ` ${v % 60}m` : ''}` : `${v} min`);
  const card = (s) => `
    <div class="card svc-card" data-id="${s.id}" style="${s.active ? '' : 'opacity:0.55'}">
      <div class="sc-top">
        <div class="sc-name">${esc(s.name)}</div>
        <div class="sc-price money">${priceLabel(s)}</div>
      </div>
      ${s.description ? `<div class="cell-sub">${esc(s.description)}</div>` : ''}
      <div class="sc-meta">
        <span>${icon('clock')} ${durLabel(s.duration_min)}</span>
        ${(gated.get(s.id) || []).includes('patch_test') ? '<span class="chip">Patch test</span>' : ''}
        ${(gated.get(s.id) || []).includes('consent') ? '<span class="chip">Consent</span>' : ''}
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

async function openServiceModal({ service = null, cats = [], onSaved } = {}) {
  const s = service;
  // What this service already asks for. Fetched rather than carried on the
  // service row: requirements are health policy, and they have no business
  // being in the list every other screen loads.
  let reqs = [];
  if (s) {
    try { reqs = (await api.get(`/api/services/${s.id}/requirements`)).requirements || []; } catch { reqs = []; }
  }
  const patchReq = reqs.find((r) => r.kind === 'patch_test') || null;
  const consentReq = reqs.find((r) => r.kind === 'consent') || null;

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
        <div class="field span2"><label>Pricing</label>
          <div class="seg" id="svc-price-type" style="width:fit-content">
            <button type="button" data-pt="fixed" class="${(!s || s.price_type === 'fixed' || !s.price_type) ? 'active' : ''}">Fixed price</button>
            <button type="button" data-pt="from" class="${s?.price_type === 'from' ? 'active' : ''}">From</button>
            <button type="button" data-pt="free" class="${s?.price_type === 'free' ? 'active' : ''}">Free</button>
          </div>
          <input type="hidden" name="price_type" value="${esc(s?.price_type || 'fixed')}">
          <div class="hint" id="svc-price-hint">"From" is for services whose real price depends on length, thickness or complexity — clients see a starting price, and you set the exact amount at checkout.</div></div>
        <div class="field" id="svc-price-field" style="${s?.price_type === 'free' ? 'display:none' : ''}">
          <label id="svc-price-label">${s?.price_type === 'from' ? 'Starting price *' : 'Price *'}</label>
          <input name="price" type="number" min="0" step="0.01" ${s?.price_type === 'free' ? '' : 'required'} value="${s ? (s.price_cents / 100).toFixed(2) : ''}" placeholder="85.00"></div>
        <div class="field"><label>&nbsp;</label>
          <label style="display:flex;align-items:center;gap:8px;font-weight:500;color:var(--text-2);cursor:pointer">
            <input type="checkbox" name="active" ${!s || s.active ? 'checked' : ''} class="chk"> Bookable online</label></div>
        <div class="field span2"><label>Description</label>
          <textarea name="description" placeholder="Shown to clients on your booking page">${esc(s?.description || '')}</textarea></div>

        <div class="field span2" style="border-top:1px solid var(--border);padding-top:14px;margin-top:2px">
          <label>Before this can be booked</label>
          <div class="hint">Leave both off and nothing changes. Switch one on and online booking will
            ask for it — Kairo keeps the record; it never decides whether a treatment is safe.</div>
        </div>
        <div class="field span2">
          <label style="display:flex;align-items:center;gap:8px;font-weight:500;color:var(--text-2);cursor:pointer">
            <input type="checkbox" name="req_patch" class="chk" ${patchReq ? 'checked' : ''}>
            Needs a valid patch test</label>
        </div>
        <div class="field" id="req-months-field" style="${patchReq ? '' : 'display:none'}">
          <label>Valid for (months)</label>
          <input name="req_months" type="number" min="1" max="60" value="${patchReq?.valid_months || 6}">
        </div>
        <div class="field span2">
          <label style="display:flex;align-items:center;gap:8px;font-weight:500;color:var(--text-2);cursor:pointer">
            <input type="checkbox" name="req_consent" class="chk" ${consentReq ? 'checked' : ''}>
            Needs the client to agree to something in writing</label>
        </div>
        <div class="field span2" id="req-consent-field" style="${consentReq ? '' : 'display:none'}">
          <label>The exact wording they agree to</label>
          <textarea name="req_consent_text" rows="4"
            placeholder="I confirm I have no known allergy to the products used and have told the salon about any medication or skin condition.">${esc(consentReq?.consent_text || '')}</textarea>
          <div class="hint">Stored word-for-word with the name they type and the time they agreed.
            Change this later and everyone is asked again — a tick against wording that has since been
            edited is not a record of what anybody agreed to. A typed name is a record of consent,
            not a witnessed signature.</div>
        </div>
      </form>`,
    footer: `
      ${s ? `<button class="btn danger" id="svc-delete">${icon('trash')} ${s.active ? 'Archive' : 'Delete'}</button>` : ''}
      <div class="spacer"></div>
      <button class="btn primary" id="svc-save">${icon('check')} ${s ? 'Save changes' : 'Add service'}</button>`,
  });

  m.querySelector('#svc-price-type').addEventListener('click', (e) => {
    const b = e.target.closest('[data-pt]');
    if (!b) return;
    m.querySelectorAll('#svc-price-type button').forEach((x) => x.classList.toggle('active', x === b));
    m.querySelector('[name=price_type]').value = b.dataset.pt;
    const isFree = b.dataset.pt === 'free';
    m.querySelector('#svc-price-field').style.display = isFree ? 'none' : '';
    m.querySelector('#svc-price-label').textContent = b.dataset.pt === 'from' ? 'Starting price *' : 'Price *';
    m.querySelector('[name=price]').required = !isFree;
  });

  const toggleReq = (name, field) => {
    const box = m.querySelector(`[name=${name}]`);
    box.addEventListener('change', () => { m.querySelector(field).style.display = box.checked ? '' : 'none'; });
  };
  toggleReq('req_patch', '#req-months-field');
  toggleReq('req_consent', '#req-consent-field');

  m.querySelector('#svc-save').onclick = async () => {
    const fd = new FormData(m.querySelector('#svc-form'));
    const priceType = fd.get('price_type') || 'fixed';
    const payload = {
      name: fd.get('name'), category: fd.get('category'),
      duration_min: Number(fd.get('duration_min')),
      price: priceType === 'free' ? 0 : fd.get('price'), price_type: priceType,
      description: fd.get('description'), active: fd.get('active') === 'on',
    };
    if (!payload.name.trim()) { toast('Service name is required', 'err'); return; }
    if (priceType !== 'free' && payload.price === '') { toast('Enter a price, or switch to Free', 'err'); return; }
    const wantsConsent = fd.get('req_consent') === 'on';
    const consentText = String(fd.get('req_consent_text') || '').trim();
    // Caught here as well as on the server, because a tick with no words behind
    // it looks like a record and is not one — and finding that out at the
    // moment a client is trying to book is the wrong time.
    if (wantsConsent && !consentText) { toast('Write the wording clients are agreeing to', 'err'); return; }
    try {
      const saved = s
        ? await api.put(`/api/services/${s.id}`, payload)
        : await api.post('/api/services', payload);
      await api.put(`/api/services/${saved.id}/requirements`, {
        patch_test: fd.get('req_patch') === 'on',
        valid_months: Number(fd.get('req_months')) || 6,
        consent: wantsConsent,
        consent_text: consentText,
      });
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
