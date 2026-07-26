// Minimal, dependency-free .xlsx reader.
//
// An .xlsx file is a ZIP archive of XML parts. We read it without any external
// library: unzip the entries we need with node:zlib, then pull the cell values
// out of the first worksheet (resolving the shared-string table). This exists so
// owners can upload the real Excel file their client list came from — reading
// the spreadsheet directly avoids the phone-number corruption a CSV round-trip
// causes (Excel dropping a leading 0 or turning "0412…" into 4.12E+11).
import zlib from 'node:zlib';

// ---- tiny ZIP reader (central-directory based) -----------------------------

function findEOCD(buf) {
  // End-of-central-directory signature: 0x06054b50. Scan back from the end
  // (there may be up to 65 535 bytes of trailing comment, but normally none).
  const sig = 0x06054b50;
  const min = Math.max(0, buf.length - 65557);
  for (let i = buf.length - 22; i >= min; i--) {
    if (buf.readUInt32LE(i) === sig) return i;
  }
  return -1;
}

// Return a map of { filename -> { method, compSize, localOffset } }.
function readCentralDirectory(buf) {
  const eocd = findEOCD(buf);
  if (eocd < 0) throw Object.assign(new Error('Not a valid .xlsx file (no ZIP directory found)'), { status: 400 });
  const count = buf.readUInt16LE(eocd + 10);
  let ptr = buf.readUInt32LE(eocd + 16);
  const entries = new Map();
  for (let i = 0; i < count; i++) {
    if (buf.readUInt32LE(ptr) !== 0x02014b50) break; // central-file-header signature
    const method = buf.readUInt16LE(ptr + 10);
    const compSize = buf.readUInt32LE(ptr + 20);
    const nameLen = buf.readUInt16LE(ptr + 28);
    const extraLen = buf.readUInt16LE(ptr + 30);
    const commentLen = buf.readUInt16LE(ptr + 32);
    const localOffset = buf.readUInt32LE(ptr + 42);
    const name = buf.toString('utf8', ptr + 46, ptr + 46 + nameLen);
    entries.set(name, { method, compSize, localOffset });
    ptr += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

function readEntry(buf, entry) {
  if (!entry) return null;
  const off = entry.localOffset;
  if (buf.readUInt32LE(off) !== 0x04034b50) return null; // local-file-header signature
  const nameLen = buf.readUInt16LE(off + 26);
  const extraLen = buf.readUInt16LE(off + 28);
  const start = off + 30 + nameLen + extraLen;
  const raw = buf.subarray(start, start + entry.compSize);
  if (entry.method === 0) return raw;              // stored
  if (entry.method === 8) return zlib.inflateRawSync(raw); // deflate
  throw Object.assign(new Error('Unsupported compression in .xlsx'), { status: 400 });
}

// ---- XML helpers -----------------------------------------------------------

function decodeEntities(s) {
  return String(s)
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

// All <t>…</t> text inside a chunk, concatenated (handles rich-text runs).
function textOf(chunk) {
  let out = '';
  const re = /<t\b[^>]*>([\s\S]*?)<\/t>/g;
  let m;
  while ((m = re.exec(chunk))) out += decodeEntities(m[1]);
  return out;
}

function parseSharedStrings(xml) {
  if (!xml) return [];
  const strings = [];
  const re = /<si\b[^>]*>([\s\S]*?)<\/si>/g;
  let m;
  while ((m = re.exec(xml))) strings.push(textOf(m[1]));
  return strings;
}

// "B12" -> column index 1 (0-based).
function colIndex(ref) {
  const letters = String(ref).replace(/[0-9]/g, '');
  let n = 0;
  for (let i = 0; i < letters.length; i++) n = n * 26 + (letters.charCodeAt(i) - 64);
  return n - 1;
}

function parseSheet(xml, shared) {
  const rows = [];
  const rowRe = /<row\b[^>]*>([\s\S]*?)<\/row>/g;
  let rm;
  while ((rm = rowRe.exec(xml))) {
    const cells = [];
    let auto = 0;
    const cellRe = /<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g;
    let cm;
    while ((cm = cellRe.exec(rm[1]))) {
      const attrs = cm[1] || '';
      const inner = cm[2] || '';
      const refM = attrs.match(/\br="([A-Z]+)\d+"/);
      const ci = refM ? colIndex(refM[1]) : auto;
      auto = ci + 1;
      const tM = attrs.match(/\bt="([^"]+)"/);
      const type = tM ? tM[1] : 'n';
      let val = '';
      if (type === 's') {
        const v = inner.match(/<v\b[^>]*>([\s\S]*?)<\/v>/);
        val = v ? (shared[parseInt(v[1], 10)] ?? '') : '';
      } else if (type === 'inlineStr') {
        val = textOf(inner);
      } else if (type === 'str') {
        const v = inner.match(/<v\b[^>]*>([\s\S]*?)<\/v>/);
        val = v ? decodeEntities(v[1]) : '';
      } else { // number / boolean / date serial — keep the raw text
        const v = inner.match(/<v\b[^>]*>([\s\S]*?)<\/v>/);
        val = v ? decodeEntities(v[1]) : '';
      }
      cells[ci] = val;
    }
    // Normalise gaps (missing cells) to '' so columns stay aligned.
    for (let i = 0; i < cells.length; i++) if (cells[i] == null) cells[i] = '';
    rows.push(cells);
  }
  return rows;
}

// Pick the workbook's first worksheet part, following workbook.xml -> rels.
function firstSheetPath(entries, readText) {
  try {
    const wb = readText('xl/workbook.xml');
    const rels = readText('xl/_rels/workbook.xml.rels');
    if (wb && rels) {
      const sheet = wb.match(/<sheet\b[^>]*\br:id="([^"]+)"[^>]*\/?>/) || wb.match(/<sheet\b[^>]*\/?>/);
      const rid = sheet && sheet[1];
      if (rid) {
        const rel = rels.match(new RegExp(`<Relationship\\b[^>]*\\bId="${rid}"[^>]*\\bTarget="([^"]+)"`));
        if (rel) {
          let target = rel[1].replace(/^\//, '');
          if (!target.startsWith('xl/')) target = 'xl/' + target.replace(/^\.\//, '');
          if (entries.has(target)) return target;
        }
      }
    }
  } catch { /* fall through to defaults */ }
  if (entries.has('xl/worksheets/sheet1.xml')) return 'xl/worksheets/sheet1.xml';
  for (const name of entries.keys()) if (/^xl\/worksheets\/.*\.xml$/.test(name)) return name;
  return null;
}

/**
 * Parse the first worksheet of an .xlsx Buffer into { headers, records }.
 * `headers` is the first row (trimmed); `records` are the remaining rows as
 * arrays of strings aligned to the header columns — the same shape the CSV
 * import wizard already understands.
 */
export function parseXlsx(buf) {
  if (!Buffer.isBuffer(buf)) buf = Buffer.from(buf);
  const entries = readCentralDirectory(buf);
  const readText = (name) => { const d = readEntry(buf, entries.get(name)); return d ? d.toString('utf8') : ''; };

  const shared = parseSharedStrings(readText('xl/sharedStrings.xml'));
  const sheetPath = firstSheetPath(entries, readText);
  if (!sheetPath) throw Object.assign(new Error('No worksheet found in the .xlsx file'), { status: 400 });
  const rows = parseSheet(readText(sheetPath), shared);

  // Drop fully-empty leading rows, then split header / records.
  const nonEmpty = rows.filter((r) => r.some((c) => String(c).trim() !== ''));
  if (!nonEmpty.length) return { headers: [], records: [] };
  const width = nonEmpty.reduce((w, r) => Math.max(w, r.length), 0);
  const pad = (r) => { const a = r.slice(); for (let i = 0; i < width; i++) if (a[i] == null) a[i] = ''; return a; };
  const headers = pad(nonEmpty[0]).map((h) => String(h).trim());
  const records = nonEmpty.slice(1).map(pad);
  return { headers, records };
}
