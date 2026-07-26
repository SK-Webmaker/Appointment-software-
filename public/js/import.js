// CSV import wizard: drop/choose file → auto-map columns (adjustable) →
// preview → import with a created/skipped/invalid summary.
import { api } from './api.js';
import { esc, icon, openModal, toast } from './ui.js';
import { parseCsvWithHeader, autoMapColumns } from './csv.js';

const KINDS = {
  clients: {
    title: 'Import clients',
    endpoint: '/api/clients/import',
    preview: true, // show a dry-run summary before writing anything
    accept: '.csv,.xlsx,text/csv', // Excel accepted directly (no CSV corruption)
    dropNote: 'Drop a CSV or Excel (.xlsx) file here, or click to choose',
    sampleNote: 'Export from Fresha, Square, Acuity or any spreadsheet — Kairo matches columns by name.',
    fields: [
      { key: 'first_name', label: 'First name', required: true, candidates: ['firstname', 'first', 'givenname', 'name', 'client', 'fullname'] },
      { key: 'last_name', label: 'Last name', candidates: ['lastname', 'last', 'surname', 'familyname'] },
      { key: 'email', label: 'Email', candidates: ['email', 'mail'] },
      { key: 'phone', label: 'Phone', candidates: ['phone', 'mobile', 'cell', 'tel', 'number'] },
      { key: 'notes', label: 'Notes', candidates: ['note', 'comment', 'memo'] },
    ],
    // If the mapped "first name" cell contains a full name and there is no
    // separate last-name column, split it.
    transform: (row, mapping) => {
      if (mapping.last_name === -1 && row.first_name && row.first_name.includes(' ')) {
        const parts = row.first_name.split(/\s+/);
        row.first_name = parts.shift();
        row.last_name = parts.join(' ');
      }
      return row;
    },
  },
  // Focused "verify contacts" flow: read an authoritative spreadsheet (ideally
  // the raw .xlsx, so phone numbers aren't mangled by a CSV round-trip) and fill
  // in / correct the phone numbers and emails on clients you ALREADY have.
  contacts: {
    title: 'Update contacts from a spreadsheet',
    endpoint: '/api/clients/import',
    preview: true,
    contacts: true,
    accept: '.xlsx,.csv,text/csv',
    dropNote: 'Drop your Excel (.xlsx) or CSV file here, or click to choose',
    sampleNote: 'Best with the original Excel file — reading it directly keeps every phone number exactly as written (no dropped leading 0, no “4.12E+11”).',
    fields: [
      { key: 'first_name', label: 'First name', required: true, candidates: ['firstname', 'first', 'givenname', 'name', 'client', 'fullname'] },
      { key: 'last_name', label: 'Last name', candidates: ['lastname', 'last', 'surname', 'familyname'] },
      { key: 'phone', label: 'Phone / mobile', required: true, candidates: ['mobile', 'phone', 'cell', 'tel', 'number'] },
      { key: 'email', label: 'Email', candidates: ['email', 'mail'] },
    ],
    transform: (row, mapping) => {
      if (mapping.last_name === -1 && row.first_name && row.first_name.includes(' ')) {
        const parts = row.first_name.split(/\s+/);
        row.first_name = parts.shift();
        row.last_name = parts.join(' ');
      }
      return row;
    },
  },
  services: {
    title: 'Import services',
    endpoint: '/api/services/import',
    sampleNote: 'Columns needed: service name, duration in minutes, and price. Category and description are optional.',
    fields: [
      { key: 'name', label: 'Service name', required: true, candidates: ['service', 'name', 'treatment', 'title'] },
      { key: 'category', label: 'Category', candidates: ['category', 'group', 'type'] },
      { key: 'duration_min', label: 'Duration (min)', required: true, candidates: ['duration', 'minutes', 'mins', 'time', 'length'] },
      { key: 'price', label: 'Price', required: true, candidates: ['price', 'cost', 'amount', 'rate', 'fee'] },
      { key: 'price_type', label: 'Price type (Fixed/From/Free)', candidates: ['pricetype', 'type'] },
      { key: 'description', label: 'Description', candidates: ['description', 'details', 'note'] },
    ],
    transform: (row) => {
      // tolerate "1h 30m", "90 min", "$85.00"
      if (row.duration_min) {
        const s = String(row.duration_min).toLowerCase();
        const h = s.match(/(\d+(?:\.\d+)?)\s*h/);
        const mm = s.match(/(\d+)\s*m/);
        if (h || mm) row.duration_min = Math.round((h ? parseFloat(h[1]) * 60 : 0) + (mm ? parseInt(mm[1], 10) : 0));
        else row.duration_min = parseInt(s.replace(/[^0-9]/g, ''), 10);
      }
      // tolerate "From $85", "from", "free" written straight in the price cell
      const p = String(row.price || '').trim().toLowerCase();
      if (!row.price_type) {
        if (p.startsWith('from')) { row.price_type = 'from'; row.price = p.replace(/from/i, ''); }
        else if (/^(free|0(\.00?)?)?$/.test(p)) row.price_type = p ? 'free' : undefined;
      }
      return row;
    },
  },
};

export function runImportWizard({ kind, onDone }) {
  const cfg = KINDS[kind];

  const m = openModal({
    title: cfg.title,
    wide: true,
    body: `
      <div id="imp-step1">
        <div class="dropzone" id="imp-drop">
          ${icon('upload', 26)}
          <div style="font-weight:600;color:var(--text)">${esc(cfg.dropNote || 'Drop a CSV file here, or click to choose')}</div>
          <div style="font-size:12px;margin-top:5px">${esc(cfg.sampleNote)}</div>
        </div>
        <input type="file" id="imp-file" accept="${esc(cfg.accept || '.csv,text/csv')}" style="display:none">
      </div>
      <div id="imp-step2" style="display:none"></div>
      <div id="imp-step3" style="display:none"></div>`,
    footer: `
      <div class="spacer"></div>
      <button class="btn" data-close2>Cancel</button>
      <button class="btn primary" id="imp-go" style="display:none">${icon('check')} Import</button>`,
  });
  m.querySelector('[data-close2]').onclick = () => m.close();

  const drop = m.querySelector('#imp-drop');
  const fileInput = m.querySelector('#imp-file');
  drop.onclick = () => fileInput.click();
  drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('over'); });
  drop.addEventListener('dragleave', () => drop.classList.remove('over'));
  drop.addEventListener('drop', (e) => {
    e.preventDefault(); drop.classList.remove('over');
    if (e.dataTransfer.files[0]) readFile(e.dataTransfer.files[0]);
  });
  fileInput.addEventListener('change', () => { if (fileInput.files[0]) readFile(fileInput.files[0]); });

  let parsed = null;
  let mapping = {};

  // ArrayBuffer -> base64 in chunks (btoa can't take a huge argument at once).
  function toBase64(buf) {
    const bytes = new Uint8Array(buf);
    let bin = '';
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(bin);
  }

  async function readFile(file) {
    const isXlsx = /\.xlsx$/i.test(file.name) || (file.type || '').includes('spreadsheetml');
    if (/\.xls$/i.test(file.name)) { toast('Old .xls files aren’t supported — in Excel choose “Save As → .xlsx” (or export CSV)', 'err'); return; }
    try {
      if (isXlsx) {
        drop.classList.add('over');
        const res = await api.post('/api/clients/parse-sheet', { dataBase64: toBase64(await file.arrayBuffer()) });
        parsed = { headers: res.headers, records: res.records };
      } else {
        parsed = parseCsvWithHeader(await file.text());
      }
    } catch (err) {
      drop.classList.remove('over');
      toast(err.message || 'Could not read that file', 'err');
      return;
    }
    if (!parsed.headers.length || !parsed.records.length) {
      toast('That file looks empty — check it has a header row and data rows', 'err');
      return;
    }
    mapping = autoMapColumns(parsed.headers, Object.fromEntries(cfg.fields.map((f) => [f.key, f.candidates])));
    showMapping();
  }

  function showMapping() {
    m.querySelector('#imp-step1').style.display = 'none';
    const step2 = m.querySelector('#imp-step2');
    step2.style.display = 'block';
    m.querySelector('#imp-go').style.display = '';

    step2.innerHTML = `
      <div style="margin-bottom:14px;color:var(--text-2);font-size:13px">
        Found <b style="color:var(--text)">${parsed.records.length}</b> rows and
        <b style="color:var(--text)">${parsed.headers.length}</b> columns.
        Check the column matching below, then import.
      </div>
      ${cfg.fields.map((f) => `
        <div class="map-row">
          <div style="font-weight:600;font-size:13px">${esc(f.label)}${f.required ? ' <span style="color:var(--red)">*</span>' : ''}</div>
          <div class="arrow">←</div>
          <select data-map="${f.key}" style="background:var(--bg-raise);border:1px solid var(--border);border-radius:8px;padding:7px 10px">
            <option value="-1">— skip —</option>
            ${parsed.headers.map((h, i) => `<option value="${i}" ${mapping[f.key] === i ? 'selected' : ''}>${esc(h)}</option>`).join('')}
          </select>
        </div>`).join('')}
      ${cfg.contacts ? `
      <label class="imp-enrich">
        <input type="checkbox" id="imp-addnew">
        <span><b>Also add people who aren't in my book yet</b> — off by default, so this only
        updates the phone numbers and emails of clients you already have. Turn on to also add anyone new from the file.</span>
      </label>` : cfg.preview ? `
      <label class="imp-enrich">
        <input type="checkbox" id="imp-enrich" checked>
        <span><b>Update existing clients with any new details</b> — fills in missing phone numbers
        and emails from this file instead of skipping people you already have. Turn off to only add brand-new clients.</span>
      </label>` : ''}
      <div class="preview-table"><table class="data">
        <thead><tr>${parsed.headers.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead>
        <tbody>${parsed.records.slice(0, 5).map((r) => `<tr style="cursor:default">${parsed.headers.map((_, i) => `<td>${esc(r[i] || '')}</td>`).join('')}</tr>`).join('')}</tbody>
      </table></div>`;

    step2.querySelectorAll('[data-map]').forEach((sel) => {
      sel.addEventListener('change', () => { mapping[sel.dataset.map] = Number(sel.value); });
    });
    m.querySelector('#imp-go').innerHTML = cfg.preview ? `${icon('search')} Preview` : `${icon('check')} Import`;
  }

  // Turn the mapped columns into row objects to send to the server.
  function buildRows() {
    return parsed.records.map((rec) => {
      const row = {};
      for (const f of cfg.fields) {
        if (mapping[f.key] !== -1) row[f.key] = (rec[mapping[f.key]] || '').trim();
      }
      return cfg.transform ? cfg.transform(row, mapping) : row;
    }).filter((r) => Object.values(r).some((v) => v));
  }

  const plural = (nv, one, many = one + 's') => `${nv} ${nv === 1 ? one : many}`;

  // Rich summary for the smart client import / contact sync, used for both the
  // dry-run preview and the final result. Adapts to whichever counts are present.
  function clientSummaryHtml(res, done) {
    const bits = [];
    if (res.phonesAdded) bits.push(`${plural(res.phonesAdded, 'phone number')} added`);
    if (res.phonesUpdated) bits.push(`${plural(res.phonesUpdated, 'phone number')} corrected`);
    if (res.emailsAdded) bits.push(`${plural(res.emailsAdded, 'email')} added`);
    if (res.emailsUpdated) bits.push(`${plural(res.emailsUpdated, 'email')} corrected`);
    const fill = bits.length ? ` — ${bits.join(', ')}` : '';
    const showNew = res.created > 0 || res.addNew || !cfg.contacts;
    return `
      <div class="imp-summary">
        ${showNew ? `<div class="imp-stat imp-new"><span class="imp-num">${Number(res.created)}</span>
          <span>${plural(Number(res.created), 'new client')} ${done ? 'added' : 'to add'}</span></div>` : ''}
        <div class="imp-stat imp-upd"><span class="imp-num">${Number(res.updated)}</span>
          <span>${plural(Number(res.updated), 'existing client')} ${done ? 'updated' : 'to update'}${fill}</span></div>
        <div class="imp-stat imp-same"><span class="imp-num">${Number(res.matchedNoChange)}</span>
          <span>Already up to date</span></div>
        ${res.unmatched ? `<div class="imp-stat imp-bad"><span class="imp-num">${Number(res.unmatched)}</span>
          <span>In the file but not in your book${res.addNew ? '' : ' — not changed'}${res.unmatchedSample?.length
            ? `<br><span class="cell-sub">${esc(res.unmatchedSample.slice(0, 6).join(', '))}${res.unmatched > 6 ? '…' : ''}</span>` : ''}</span></div>` : ''}
        ${res.invalid ? `<div class="imp-stat imp-bad"><span class="imp-num">${Number(res.invalid)}</span>
          <span>Blank / missing name — skipped</span></div>` : ''}
      </div>
      ${res.ambiguous ? `<div class="hint" style="margin-top:10px">${icon('alert')} ${plural(Number(res.ambiguous), 'row')}
        shared a name with more than one client, so ${res.ambiguous === 1 ? 'it was' : 'they were'} left for you to check by hand
        (use <b>Merge duplicates</b> if needed).</div>` : ''}
      <div class="cell-sub" style="text-align:center;margin-top:12px">Your client book ${done ? 'now has' : 'will have'}
        <b style="color:var(--text)">${Number(res.totalAfter)}</b> clients total.</div>`;
  }

  const goBtn = m.querySelector('#imp-go');

  // Per-kind flags for the import call.
  function importFlags() {
    if (cfg.contacts) {
      return { updateContacts: true, addNew: m.querySelector('#imp-addnew')?.checked || false };
    }
    if (cfg.preview) {
      const el = m.querySelector('#imp-enrich');
      return { enrich: el ? el.checked : true };
    }
    return {};
  }

  // Run the import (or a dry-run preview) and return the server's summary.
  async function runImport(dryRun) {
    const rows = buildRows();
    return api.post(cfg.endpoint, { rows, ...(cfg.preview ? { dryRun } : {}), ...importFlags() });
  }

  // Non-preview kinds (services): one click imports and shows a simple result.
  async function importSimple() {
    goBtn.disabled = true;
    try {
      const res = await runImport(false);
      m.querySelector('#imp-step2').style.display = 'none';
      goBtn.style.display = 'none';
      const step3 = m.querySelector('#imp-step3');
      step3.style.display = 'block';
      step3.innerHTML = `
        <div class="import-result">
          <div class="ir"><b style="color:var(--green)">${res.imported}</b>Imported</div>
          <div class="ir"><b style="color:var(--amber)">${res.skipped}</b>Duplicates skipped</div>
          <div class="ir"><b style="color:var(--red)">${res.invalid}</b>Invalid rows</div>
        </div>
        <div style="text-align:center;margin-top:16px">
          <button class="btn primary" id="imp-done">${icon('check')} Done</button>
        </div>`;
      step3.querySelector('#imp-done').onclick = () => { m.close(); onDone?.(); };
      toast(`Imported ${res.imported} ${kind}`);
    } catch (err) { toast(err.message, 'err'); goBtn.disabled = false; }
  }

  // Preview kinds (clients): dry-run first, show what will change, then apply.
  async function previewThenApply() {
    goBtn.disabled = true;
    let res;
    try { res = await runImport(true); }
    catch (err) { toast(err.message, 'err'); goBtn.disabled = false; return; }

    m.querySelector('#imp-step2').style.display = 'none';
    goBtn.style.display = 'none';
    const step3 = m.querySelector('#imp-step3');
    step3.style.display = 'block';
    const verb = cfg.contacts ? 'update' : 'import';
    const nothing = !res.created && !res.updated;
    step3.innerHTML = `
      <div style="margin-bottom:10px;font-weight:600">${icon('search')} Here's what this will ${verb}:</div>
      ${clientSummaryHtml(res, false)}
      <div class="imp-actions">
        <button class="btn" id="imp-back">Back</button>
        <button class="btn primary" id="imp-apply" ${nothing ? 'disabled' : ''}>${icon('check')} ${cfg.contacts ? 'Apply updates' : 'Apply import'}</button>
      </div>
      ${nothing ? `<div class="cell-sub" style="text-align:center;margin-top:8px">Nothing to ${verb} — everyone in this file is already in your client book with the same details.</div>` : ''}`;

    step3.querySelector('#imp-back').onclick = () => {
      step3.style.display = 'none';
      m.querySelector('#imp-step2').style.display = 'block';
      goBtn.style.display = '';
      goBtn.disabled = false;
    };
    const applyBtn = step3.querySelector('#imp-apply');
    if (applyBtn && !nothing) applyBtn.onclick = async () => {
      applyBtn.disabled = true;
      applyBtn.innerHTML = 'Working…';
      try {
        const done = await runImport(false);
        const numbers = (done.phonesAdded || 0) + (done.phonesUpdated || 0);
        step3.innerHTML = `
          <div style="margin-bottom:10px;font-weight:600;color:var(--green)">${icon('check')} Client book updated</div>
          ${clientSummaryHtml(done, true)}
          <div style="text-align:center;margin-top:16px">
            <button class="btn primary" id="imp-done">${icon('check')} Done</button>
          </div>`;
        step3.querySelector('#imp-done').onclick = () => { m.close(); onDone?.(); };
        toast(cfg.contacts ? `${plural(done.updated, 'client')} updated${numbers ? ` · ${plural(numbers, 'number')}` : ''}` : `${done.created} added · ${done.updated} updated`);
      } catch (err) { toast(err.message, 'err'); applyBtn.disabled = false; applyBtn.innerHTML = `${icon('check')} ${cfg.contacts ? 'Apply updates' : 'Apply import'}`; }
    };
  }

  goBtn.onclick = () => {
    for (const f of cfg.fields) {
      if (f.required && mapping[f.key] === -1) {
        toast(`Match a column to "${f.label}" first`, 'err');
        return;
      }
    }
    if (cfg.preview) previewThenApply(); else importSimple();
  };
}
