// Clients: searchable list, add/edit, detail drawer, CSV import wizard + export.
import { api } from '../api.js';
import {
  esc, icon, money, fmtDate, fmtTime, openModal, confirmDialog, toast,
  initials, avatarColor, statusChip, downloadText,
} from '../ui.js';
import { runImportWizard } from '../import.js';

export async function renderClients(container, params) {
  const q = params?.get('q') || '';
  await drawList(container, q);
}

async function drawList(container, q = '') {
  const clients = await api.get(`/api/clients${q ? `?q=${encodeURIComponent(q)}` : ''}`);

  container.innerHTML = `
    <div class="page-head">
      <div class="ph-icon">${icon('users', 20)}</div>
      <div><h1>Clients</h1><div class="ph-sub">${clients.length} client${clients.length === 1 ? '' : 's'} in your book</div></div>
      <div class="ph-actions">
        <button class="btn" id="cl-import">${icon('upload')} Import CSV</button>
        <button class="btn" id="cl-export">${icon('download')} Export</button>
        <button class="btn primary" id="cl-new">${icon('plus')} New client</button>
      </div>
    </div>
    <div class="toolbar">
      <div class="search-box" style="flex:0 1 340px">${icon('search')}
        <input id="cl-search" placeholder="Search name, email or phone…" value="${esc(q)}"></div>
    </div>
    <div class="card" style="padding:0">
      <div class="table-wrap">
        <table class="data">
          <thead><tr>
            <th>Client</th><th>Contact</th><th class="num">Visits</th>
            <th>Last visit</th><th class="num">Total billed</th><th></th>
          </tr></thead>
          <tbody id="cl-rows">
            ${clients.length ? clients.map(rowHtml).join('') : `
              <tr><td colspan="6"><div class="empty">${icon('users')}<div>No clients${q ? ' match your search' : ' yet — add one or import a CSV'}.</div></div></td></tr>`}
          </tbody>
        </table>
      </div>
    </div>`;

  const search = container.querySelector('#cl-search');
  let debounce;
  search.addEventListener('input', () => {
    clearTimeout(debounce);
    debounce = setTimeout(() => drawList(container, search.value.trim()), 250);
  });
  search.focus();
  if (q) search.setSelectionRange(q.length, q.length);

  container.querySelector('#cl-new').onclick = () => openClientModal({ onSaved: () => drawList(container, q) });
  container.querySelector('#cl-export').onclick = async () => {
    const res = await fetch('/api/clients/export', { credentials: 'same-origin' });
    downloadText('clients.csv', await res.text());
    toast('Client list exported');
  };
  container.querySelector('#cl-import').onclick = () => runImportWizard({
    kind: 'clients',
    onDone: () => drawList(container, q),
  });

  container.querySelector('#cl-rows').addEventListener('click', (e) => {
    const row = e.target.closest('tr[data-id]');
    if (!row) return;
    if (e.target.closest('[data-edit]')) {
      const id = Number(row.dataset.id);
      api.get(`/api/clients/${id}`).then((c) => openClientModal({ client: c, onSaved: () => drawList(container, q) }));
      return;
    }
    openClientDetail(Number(row.dataset.id), () => drawList(container, q));
  });
}

function rowHtml(c) {
  const name = `${c.first_name} ${c.last_name}`.trim();
  return `
    <tr data-id="${c.id}">
      <td><div class="row-flex">
        <div class="avatar-sm" style="background:${esc(avatarColor(name))}">${esc(initials(name))}</div>
        <div><div class="cell-main">${esc(name)}</div>
        ${c.notes ? `<div class="cell-sub">${esc(c.notes.slice(0, 48))}${c.notes.length > 48 ? '…' : ''}</div>` : ''}</div>
      </div></td>
      <td><div>${esc(c.phone || '—')}</div><div class="cell-sub">${esc(c.email || '')}</div></td>
      <td class="num">${c.appointment_count}</td>
      <td>${c.last_visit ? fmtDate(c.last_visit) : '<span class="text-muted">Never</span>'}</td>
      <td class="num money">${money(c.total_paid_cents)}</td>
      <td class="num"><button class="icon-btn" data-edit title="Edit">${icon('edit')}</button></td>
    </tr>`;
}

export function openClientModal({ client = null, onSaved } = {}) {
  const c = client;
  const m = openModal({
    title: c ? 'Edit client' : 'New client',
    body: `
      <form id="client-form" class="form-grid">
        <div class="field"><label>First name *</label><input name="first_name" required value="${esc(c?.first_name || '')}"></div>
        <div class="field"><label>Last name</label><input name="last_name" value="${esc(c?.last_name || '')}"></div>
        <div class="field"><label>Phone</label><input name="phone" value="${esc(c?.phone || '')}"></div>
        <div class="field"><label>Email</label><input name="email" type="email" value="${esc(c?.email || '')}"></div>
        <div class="field span2"><label>Notes</label><textarea name="notes" placeholder="Preferences, allergies, colour formulas…">${esc(c?.notes || '')}</textarea></div>
      </form>`,
    footer: `
      ${c ? `<button class="btn danger" id="client-delete">${icon('trash')} Delete</button>` : ''}
      <div class="spacer"></div>
      <button class="btn primary" id="client-save">${icon('check')} ${c ? 'Save changes' : 'Add client'}</button>`,
  });

  m.querySelector('#client-save').onclick = async () => {
    const fd = new FormData(m.querySelector('#client-form'));
    const payload = Object.fromEntries(fd.entries());
    if (!payload.first_name.trim()) { toast('First name is required', 'err'); return; }
    try {
      if (c) await api.put(`/api/clients/${c.id}`, payload);
      else await api.post('/api/clients', payload);
      toast(c ? 'Client updated' : 'Client added');
      m.close(); onSaved?.();
    } catch (err) { toast(err.message, 'err'); }
  };
  if (c) {
    m.querySelector('#client-delete').onclick = async () => {
      const ok = await confirmDialog('Delete client', `Remove <b>${esc(c.first_name)} ${esc(c.last_name)}</b>? Their appointments stay on the calendar without a client attached.`, { danger: true, okText: 'Delete client' });
      if (!ok) return;
      await api.del(`/api/clients/${c.id}`);
      toast('Client deleted');
      m.close(); onSaved?.();
    };
  }
}

async function openClientDetail(id, onChanged) {
  const c = await api.get(`/api/clients/${id}`);
  const name = `${c.first_name} ${c.last_name}`.trim();
  const upcoming = c.appointments.filter((a) => ['booked', 'confirmed'].includes(a.status));
  const past = c.appointments.filter((a) => !['booked', 'confirmed'].includes(a.status)).slice(0, 8);

  const m = openModal({
    title: name,
    wide: true,
    body: `
      <div class="row-flex" style="gap:14px;margin-bottom:18px">
        <div class="avatar-sm" style="width:46px;height:46px;font-size:17px;background:${esc(avatarColor(name))}">${esc(initials(name))}</div>
        <div style="flex:1">
          <div style="display:flex;gap:14px;color:var(--text-2);font-size:13px;flex-wrap:wrap">
            ${c.phone ? `<span>${icon('phone', 13)} ${esc(c.phone)}</span>` : ''}
            ${c.email ? `<span>${icon('mail', 13)} ${esc(c.email)}</span>` : ''}
          </div>
          ${c.notes ? `<div class="cell-sub" style="margin-top:5px">${esc(c.notes)}</div>` : ''}
        </div>
        <div style="text-align:right">
          <div class="mini-label">Lifetime billed</div>
          <div style="font-size:20px;font-weight:700" class="money">${money(c.total_paid_cents)}</div>
        </div>
      </div>
      <div class="mini-label" style="margin-bottom:6px">Upcoming</div>
      ${upcoming.length ? upcoming.map(apptLine).join('') : '<div class="cell-sub" style="padding:6px 0 2px">No upcoming appointments.</div>'}
      <div class="mini-label" style="margin:16px 0 6px">History</div>
      ${past.length ? past.map(apptLine).join('') : '<div class="cell-sub" style="padding:6px 0 2px">No past visits.</div>'}
      ${c.invoices.length ? `
        <div class="mini-label" style="margin:16px 0 6px">Invoices</div>
        ${c.invoices.slice(0, 6).map((i) => `
          <a class="list-item" href="#/invoices?open=${i.id}" style="color:inherit" data-nav-away>
            <div style="flex:1"><span class="cell-main">${esc(i.number)}</span>
              <span class="cell-sub" style="margin-left:8px">${fmtDate(i.issue_date)}</span></div>
            ${statusChip(i.status)}
            <div class="money" style="width:90px;text-align:right;font-weight:600">${money(Math.round((i.subtotal_cents - i.discount_cents) * (1 + i.tax_rate / 100)))}</div>
          </a>`).join('')}` : ''}`,
    footer: `
      <div class="spacer"></div>
      <button class="btn" id="cd-edit">${icon('edit')} Edit</button>
      <button class="btn primary" id="cd-book">${icon('plus')} Book appointment</button>`,
  });

  m.querySelectorAll('[data-nav-away]').forEach((el) => el.addEventListener('click', () => m.close()));
  m.querySelector('#cd-edit').onclick = () => { m.close(); openClientModal({ client: c, onSaved: onChanged }); };
  m.querySelector('#cd-book').onclick = async () => {
    m.close();
    const { openAppointmentModal } = await import('./calendar.js');
    openAppointmentModal({ onSaved: onChanged });
  };
}

function apptLine(a) {
  return `
    <div class="list-item" style="cursor:default">
      <div style="flex:1">
        <div class="cell-main">${esc(a.service_name || 'Appointment')}</div>
        <div class="cell-sub">${fmtDate(a.date)} · ${fmtTime(a.start_min)} · ${esc(a.staff_name || '')}</div>
      </div>
      ${statusChip(a.status)}
    </div>`;
}
