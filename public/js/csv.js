// RFC-4180-ish CSV parser: quoted fields, embedded commas/quotes/newlines, CRLF.

export function parseCsv(text) {
  const rows = [];
  let row = [], field = '', inQuotes = false;
  const src = String(text || '');
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (inQuotes) {
      if (c === '"') {
        if (src[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      row.push(field); field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.length > 1 || row[0] !== '') rows.push(row);
      row = [];
    } else field += c;
  }
  row.push(field);
  if (row.length > 1 || row[0] !== '') rows.push(row);
  return rows;
}

/**
 * Parse a CSV file into { headers, records } where records are arrays aligned
 * to headers. The first row is treated as the header row.
 */
export function parseCsvWithHeader(text) {
  const rows = parseCsv(text);
  if (rows.length === 0) return { headers: [], records: [] };
  const headers = rows[0].map((h) => h.trim());
  return { headers, records: rows.slice(1) };
}

/**
 * Guess which CSV column maps to each target field by header name.
 * targets: { fieldKey: [candidate substrings...] }
 * Returns { fieldKey: columnIndex | -1 }
 */
export function autoMapColumns(headers, targets) {
  const norm = headers.map((h) => h.toLowerCase().replace(/[^a-z0-9]/g, ''));
  const mapping = {};
  const used = new Set();
  for (const [field, candidates] of Object.entries(targets)) {
    mapping[field] = -1;
    for (const cand of candidates) {
      const idx = norm.findIndex((h, i) => !used.has(i) && h.includes(cand));
      if (idx !== -1) { mapping[field] = idx; used.add(idx); break; }
    }
  }
  return mapping;
}
