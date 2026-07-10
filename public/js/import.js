// CSV import wizard: drop/choose file → auto-map columns (adjustable) →
// preview → import with a created/skipped/invalid summary.
import { api } from './api.js';
import { esc, icon, openModal, toast } from './ui.js';
import { parseCsvWithHeader, autoMapColumns } from './csv.js';

const KINDS = {
  clients: {
    title: 'Import clients',
    endpoint: '/api/clients/import',
    sampleNote: 'Export from Fresha, Square, Acuity or any spreadsheet — Kairo matches columns by name.',
    fields: [
      { key: 'first_name', label: 'First name', required: true, candidates: ['firstname', 'first', 'givenname', 'name', 'client', 'fullname'] },
      { key: 'last_name', label: 'Last name', candidates: ['lastname', 'last', 'surname', 'familyname'] },
      { key: 'email', label: 'Email', candidates: ['email', 'mail'] },
      { key: 'phone', label: 'Phone', candidates: ['phone', 'mobile', 'cell', 'tel'] },
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
  services: {
    title: 'Import services',
    endpoint: '/api/services/import',
    sampleNote: 'Columns needed: service name, duration in minutes, and price. Category and description are optional.',
    fields: [
      { key: 'name', label: 'Service name', required: true, candidates: ['service', 'name', 'treatment', 'title'] },
      { key: 'category', label: 'Category', candidates: ['category', 'group', 'type'] },
      { key: 'duration_min', label: 'Duration (min)', required: true, candidates: ['duration', 'minutes', 'mins', 'time', 'length'] },
      { key: 'price', label: 'Price', required: true, candidates: ['price', 'cost', 'amount', 'rate', 'fee'] },
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
          <div style="font-weight:600;color:var(--text)">Drop a CSV file here, or click to choose</div>
          <div style="font-size:12px;margin-top:5px">${esc(cfg.sampleNote)}</div>
        </div>
        <input type="file" id="imp-file" accept=".csv,text/csv" style="display:none">
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

  function readFile(file) {
    const reader = new FileReader();
    reader.onload = () => {
      parsed = parseCsvWithHeader(String(reader.result));
      if (!parsed.headers.length || !parsed.records.length) {
        toast('That file looks empty — check it has a header row and data rows', 'err');
        return;
      }
      mapping = autoMapColumns(parsed.headers, Object.fromEntries(cfg.fields.map((f) => [f.key, f.candidates])));
      showMapping();
    };
    reader.readAsText(file);
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
      <div class="preview-table"><table class="data">
        <thead><tr>${parsed.headers.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead>
        <tbody>${parsed.records.slice(0, 5).map((r) => `<tr style="cursor:default">${parsed.headers.map((_, i) => `<td>${esc(r[i] || '')}</td>`).join('')}</tr>`).join('')}</tbody>
      </table></div>`;

    step2.querySelectorAll('[data-map]').forEach((sel) => {
      sel.addEventListener('change', () => { mapping[sel.dataset.map] = Number(sel.value); });
    });
  }

  m.querySelector('#imp-go').onclick = async () => {
    for (const f of cfg.fields) {
      if (f.required && mapping[f.key] === -1) {
        toast(`Match a column to "${f.label}" first`, 'err');
        return;
      }
    }
    const rows = parsed.records.map((rec) => {
      const row = {};
      for (const f of cfg.fields) {
        if (mapping[f.key] !== -1) row[f.key] = (rec[mapping[f.key]] || '').trim();
      }
      return cfg.transform ? cfg.transform(row, mapping) : row;
    }).filter((r) => Object.values(r).some((v) => v));

    const goBtn = m.querySelector('#imp-go');
    goBtn.disabled = true;
    try {
      const res = await api.post(cfg.endpoint, { rows });
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
    } catch (err) {
      toast(err.message, 'err');
      goBtn.disabled = false;
    }
  };
}
