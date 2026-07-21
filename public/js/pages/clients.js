// Clients: searchable list, add/edit, detail drawer, CSV import wizard + export.
import { api } from '../api.js';
import {
  esc, icon, money, fmtDate, fmtTime, openModal, confirmDialog, toast,
  initials, avatarColor, statusChip, downloadText,
} from '../ui.js';
import { runImportWizard } from '../import.js';

// Sort + filter are applied in the browser on the already-fetched list, so
// they're instant and stack on top of the server-side search. Kept module-
// level so the choice survives a search-triggered redraw.
let sortBy = 'name';
let showBy = 'all';

const SORTS = {
  name:   { label: 'Name (A–Z)',   cmp: (a, b) => fullName(a).localeCompare(fullName(b)) },
  visits: { label: 'Most visits',  cmp: (a, b) => b.appointment_count - a.appointment_count || fullName(a).localeCompare(fullName(b)) },
  recent: { label: 'Recent visit', cmp: (a, b) => (b.last_visit || '').localeCompare(a.last_visit || '') || fullName(a).localeCompare(fullName(b)) },
  billed: { label: 'Top billed',   cmp: (a, b) => b.total_paid_cents - a.total_paid_cents || fullName(a).localeCompare(fullName(b)) },
};
const SHOWS = {
  all:      { label: 'All clients',        keep: () => true },
  new:      { label: 'New (no visits)',    keep: (c) => !c.last_visit },
  regulars: { label: 'Regulars (3+)',      keep: (c) => c.appointment_count >= 3 },
  upcoming: { label: 'Has a booking',      keep: (c) => c.appointment_count > 0 },
};

const fullName = (c) => `${c.first_name} ${c.last_name}`.trim().toLowerCase();

export async function renderClients(container, params) {
  const q = params?.get('q') || '';
  await drawList(container, q);
}

async function drawList(container, q = '') {
  const clients = await api.get(`/api/clients${q ? `?q=${encodeURIComponent(q)}` : ''}`);

  const optionsFor = (map, current) => Object.entries(map)
    .map(([k, v]) => `<option value="${k}" ${k === current ? 'selected' : ''}>${v.label}</option>`).join('');

  container.innerHTML = `
    <div class="page-head">
      <div class="ph-icon">${icon('users', 20)}</div>
      <div><h1>Clients</h1><div class="ph-sub" id="cl-count">${clients.length} client${clients.length === 1 ? '' : 's'} in your book</div></div>
      <div class="ph-actions">
        <button class="btn" id="cl-merge">${icon('link')} Merge duplicates</button>
        <button class="btn" id="cl-import">${icon('upload')} Import CSV</button>
        <button class="btn" id="cl-export">${icon('download')} Export</button>
        <button class="btn primary" id="cl-new">${icon('plus')} New client</button>
      </div>
    </div>
    <div class="toolbar" style="gap:10px;flex-wrap:wrap">
      <div class="search-box" style="flex:0 1 320px">${icon('search')}
        <input id="cl-search" placeholder="Search name, email or phone…" value="${esc(q)}"></div>
      <label class="filter-select">${icon('filter', 14)}
        <select id="cl-show">${optionsFor(SHOWS, showBy)}</select></label>
      <label class="filter-select">${icon('sort', 14)}
        <select id="cl-sort">${optionsFor(SORTS, sortBy)}</select></label>
    </div>
    <div class="card" style="padding:0">
      <div class="table-wrap">
        <table class="data reflow">
          <thead><tr>
            <th>Client</th><th>Contact</th><th class="num">Visits</th>
            <th>Last visit</th><th class="num">Total billed</th><th></th>
          </tr></thead>
          <tbody id="cl-rows"></tbody>
        </table>
      </div>
    </div>`;

  const renderRows = () => {
    const view = clients.filter(SHOWS[showBy].keep).sort(SORTS[sortBy].cmp);
    container.querySelector('#cl-rows').innerHTML = view.length
      ? view.map(rowHtml).join('')
      : `<tr><td colspan="6"><div class="empty">${icon('users')}<div>No clients${
          q || showBy !== 'all' ? ' match your search or filter' : ' yet — add one or import a CSV'}.</div></div></td></tr>`;
    container.querySelector('#cl-count').textContent =
      showBy === 'all' && !q
        ? `${clients.length} client${clients.length === 1 ? '' : 's'} in your book`
        : `${view.length} of ${clients.length} shown`;
  };
  renderRows();

  const search = container.querySelector('#cl-search');
  let debounce;
  search.addEventListener('input', () => {
    clearTimeout(debounce);
    debounce = setTimeout(() => drawList(container, search.value.trim()), 250);
  });
  search.focus();
  if (q) search.setSelectionRange(q.length, q.length);

  container.querySelector('#cl-show').addEventListener('change', (e) => { showBy = e.target.value; renderRows(); });
  container.querySelector('#cl-sort').addEventListener('change', (e) => { sortBy = e.target.value; renderRows(); });

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
  container.querySelector('#cl-merge').onclick = () => openMergeDuplicates(() => drawList(container, q));

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
      <td class="rf-head"><div class="row-flex">
        <div class="avatar-sm" style="background:${esc(avatarColor(name))}">${esc(initials(name))}</div>
        <div><div class="cell-main">${esc(name)}</div>
        ${c.notes ? `<div class="cell-sub">${esc(c.notes.slice(0, 48))}${c.notes.length > 48 ? '…' : ''}</div>` : ''}</div>
      </div></td>
      <td data-th="Contact"><div class="rf-val"><div>${esc(c.phone || '—')}</div><div class="cell-sub">${esc(c.email || '')}</div></div></td>
      <td data-th="Visits" class="num">${c.appointment_count}</td>
      <td data-th="Last visit">${c.last_visit ? fmtDate(c.last_visit) : '<span class="text-muted">Never</span>'}</td>
      <td data-th="Total billed" class="num money">${money(c.total_paid_cents)}</td>
      <td class="num rf-action"><button class="icon-btn" data-edit title="Edit">${icon('edit')}</button></td>
    </tr>`;
}

// Find-and-merge duplicates. Each detected group lets the owner pick which
// record to keep; the rest merge into it (history moves over) and are removed.
async function openMergeDuplicates(onDone) {
  let groups = [];
  try { groups = (await api.get('/api/clients/duplicates')).groups || []; }
  catch (err) { toast(err.message, 'err'); return; }

  const m = openModal({
    title: 'Merge duplicate clients',
    wide: true,
    body: `<div id="merge-body">${groupsHtml(groups)}</div>`,
  });

  let changed = false;
  const bodyEl = m.querySelector('#merge-body');

  const wireGroup = (card) => {
    const gi = card.dataset.g;
    card.querySelectorAll(`input[name="keep-${gi}"]`).forEach((r) => {
      r.addEventListener('change', () => {
        card.querySelectorAll('.merge-row').forEach((row) => row.classList.toggle('is-keep', row.querySelector('input').checked));
        const keptName = card.querySelector('input:checked').dataset.name;
        card.querySelector('[data-merge-btn]').textContent = `Merge into ${keptName}`;
      });
    });
    card.querySelector('[data-merge-btn]').addEventListener('click', async (e) => {
      const keepId = Number(card.querySelector(`input[name="keep-${gi}"]:checked`).value);
      const allIds = [...card.querySelectorAll('.merge-row')].map((row) => Number(row.dataset.id));
      const fromIds = allIds.filter((id) => id !== keepId);
      const keptName = card.querySelector('input:checked').dataset.name;
      const ok = await confirmDialog(
        'Merge these clients?',
        `${fromIds.length} record${fromIds.length === 1 ? '' : 's'} will be merged into ${keptName}. Their appointments, invoices and history move over, then the duplicates are removed. This can't be undone.`,
        { okText: 'Merge', danger: true }
      );
      if (!ok) return;
      e.target.disabled = true;
      try {
        await api.post(`/api/clients/${keepId}/merge`, { from_ids: fromIds });
        changed = true;
        card.classList.add('merge-done');
        card.innerHTML = `<div class="merge-ok">${icon('check')} Merged into <b>${esc(keptName)}</b></div>`;
        toast('Duplicates merged');
      } catch (err) { toast(err.message, 'err'); e.target.disabled = false; }
    });
  };
  bodyEl.querySelectorAll('.merge-group').forEach(wireGroup);

  // refresh the underlying list when the modal closes if anything merged
  const origClose = m.close;
  m.close = () => { origClose(); if (changed) onDone?.(); };
  m.querySelector('[data-close]')?.addEventListener('click', () => { if (changed) onDone?.(); });
}

function groupsHtml(groups) {
  if (!groups.length) {
    return `<div class="empty" style="padding:30px 10px">${icon('check')}
      <div>No duplicates found — your client book is clean.</div></div>`;
  }
  return `
    <div class="cell-sub" style="margin-bottom:14px">We found ${groups.length} possible duplicate ${groups.length === 1 ? 'set' : 'sets'}
      (clients sharing an email, phone or name). Pick the record to keep in each; the rest merge into it.</div>
    ${groups.map((g, gi) => {
      const keepId = g[0].id; // richest record suggested
      return `<div class="card merge-group" data-g="${gi}" style="margin-bottom:12px">
        ${g.map((c) => {
          const name = `${c.first_name} ${c.last_name}`.trim() || '—';
          return `<label class="merge-row${c.id === keepId ? ' is-keep' : ''}" data-id="${c.id}">
            <input type="radio" name="keep-${gi}" value="${c.id}" data-name="${esc(name)}" ${c.id === keepId ? 'checked' : ''}>
            <div class="avatar-sm" style="background:${esc(avatarColor(name))}">${esc(initials(name))}</div>
            <div class="merge-info">
              <div class="cell-main">${esc(name)}</div>
              <div class="cell-sub">${esc(c.email || 'no email')} · ${esc(c.phone || 'no phone')}</div>
              <div class="cell-sub">${c.appointment_count} visit${c.appointment_count === 1 ? '' : 's'} · ${money(c.total_paid_cents)} billed</div>
            </div>
            <span class="merge-keep-tag">Keep</span>
          </label>`;
        }).join('')}
        <button class="btn primary" data-merge-btn style="margin-top:12px;width:100%;justify-content:center">Merge into ${esc(`${g[0].first_name} ${g[0].last_name}`.trim() || '—')}</button>
      </div>`;
    }).join('')}`;
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
