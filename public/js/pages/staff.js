// Team: manage staff members whose columns appear on the calendar.
import { api } from '../api.js';
import { esc, icon, openModal, confirmDialog, toast, initials } from '../ui.js';
import { refreshLookups, state } from '../app.js';

const COLORS = ['#3987e5', '#199e70', '#9085e9', '#e5a039', '#d55181', '#2dd4bf', '#60a5fa'];

export async function renderStaff(container) {
  const staff = await api.get('/api/staff?all=1');

  container.innerHTML = `
    <div class="page-head">
      <div class="ph-icon">${icon('user', 20)}</div>
      <div><h1>Team</h1><div class="ph-sub">Everyone who takes bookings — each gets a calendar column</div></div>
      <div class="ph-actions"><button class="btn primary" id="st-new">${icon('plus')} Add team member</button></div>
    </div>
    <div class="svc-grid">
      ${staff.map((s) => `
        <div class="card svc-card" data-id="${s.id}" style="${s.active ? '' : 'opacity:0.55'}">
          <div class="row-flex">
            <div class="avatar-sm" style="width:38px;height:38px;background:${esc(s.color)}">${esc(initials(s.name))}</div>
            <div style="flex:1">
              <div class="sc-name">${esc(s.name)}</div>
              <div class="cell-sub">${esc(s.title || 'Team member')}${s.location_name && state.locations.length > 1 ? ` · ${esc(s.location_name)}` : ''}</div>
            </div>
            ${s.active ? '' : '<span class="chip">Inactive</span>'}
          </div>
        </div>`).join('')}
    </div>`;

  const redraw = async () => { await refreshLookups(); renderStaff(container); };
  container.querySelector('#st-new').onclick = () => openStaffModal({ onSaved: redraw });
  container.querySelectorAll('[data-id]').forEach((el) => {
    el.onclick = () => openStaffModal({ staff: staff.find((s) => s.id === Number(el.dataset.id)), onSaved: redraw });
  });
}

function openStaffModal({ staff = null, onSaved } = {}) {
  const s = staff;
  let color = s?.color || COLORS[0];
  const m = openModal({
    title: s ? 'Edit team member' : 'Add team member',
    body: `
      <form id="st-form" class="form-grid">
        <div class="field"><label>Name *</label><input name="name" required value="${esc(s?.name || '')}"></div>
        <div class="field"><label>Title</label><input name="title" value="${esc(s?.title || '')}" placeholder="Stylist"></div>
        ${state.locations.length > 1 ? `
        <div class="field span2"><label>Location</label>
          <select name="location_id">
            ${state.locations.map((l) => `<option value="${l.id}" ${s?.location_id === l.id ? 'selected' : ''}>${esc(l.name)}</option>`).join('')}
          </select></div>` : ''}
        <div class="field span2"><label>Calendar colour</label>
          <div id="st-colors" style="display:flex;gap:9px;padding:4px 0">
            ${COLORS.map((c) => `<button type="button" data-c="${c}" style="width:28px;height:28px;border-radius:50%;background:${c};border:2px solid ${c === color ? '#fff' : 'transparent'}"></button>`).join('')}
          </div></div>
        ${s ? `<div class="field span2">
          <label style="display:flex;align-items:center;gap:8px;font-weight:500;color:var(--text-2);cursor:pointer">
            <input type="checkbox" name="active" ${s.active ? 'checked' : ''} style="width:15px;height:15px;accent-color:var(--accent)"> Active (shown on calendar &amp; booking page)</label></div>` : ''}
      </form>`,
    footer: `
      ${s ? `<button class="btn danger" id="st-delete">${icon('trash')} Remove</button>` : ''}
      <div class="spacer"></div>
      <button class="btn primary" id="st-save">${icon('check')} ${s ? 'Save' : 'Add'}</button>`,
  });

  m.querySelector('#st-colors').addEventListener('click', (e) => {
    const b = e.target.closest('[data-c]');
    if (!b) return;
    color = b.dataset.c;
    m.querySelectorAll('[data-c]').forEach((x) => (x.style.borderColor = x.dataset.c === color ? '#fff' : 'transparent'));
  });

  m.querySelector('#st-save').onclick = async () => {
    const fd = new FormData(m.querySelector('#st-form'));
    if (!String(fd.get('name') || '').trim()) { toast('Name is required', 'err'); return; }
    const payload = {
      name: fd.get('name'), title: fd.get('title'), color,
      active: s ? fd.get('active') === 'on' : true,
      location_id: fd.get('location_id') ? Number(fd.get('location_id')) : (s?.location_id ?? state.locations[0]?.id),
    };
    try {
      if (s) await api.put(`/api/staff/${s.id}`, payload);
      else await api.post('/api/staff', payload);
      toast(s ? 'Team member updated' : 'Team member added');
      m.close(); onSaved?.();
    } catch (err) { toast(err.message, 'err'); }
  };
  if (s) {
    m.querySelector('#st-delete').onclick = async () => {
      const ok = await confirmDialog('Remove team member', `Remove <b>${esc(s.name)}</b>? If they have appointment history they are deactivated instead of deleted.`, { danger: true, okText: 'Remove' });
      if (!ok) return;
      const res = await api.del(`/api/staff/${s.id}`);
      toast(res.deactivated ? 'Deactivated (has appointment history)' : 'Removed');
      m.close(); onSaved?.();
    };
  }
}
