// The mark is one mark, in one colour, everywhere it appears.
//
// This exists because it was not. The gradient ended on a different blue in
// five separate files, the PNGs were unregenerable binaries, and a recolour
// missed public/book.html — the page customers actually see — because it was
// done by grep and memory. The last test here is the one that catches that.
//
// The colour claim is arithmetic, not taste: both gradient stops must sit at
// the same lightness. That is what stops one corner going muddy, and it is
// checkable, so it is checked.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

import { BRAND, TARGETS, build, svg } from '../scripts/make-icons.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Rendering 1024px at sixteen samples a pixel is seventeen million evaluations.
// Correct, but not something to repeat once per assertion — build once here and
// let every test read the same output.
const ICONS = build();

/** HSL lightness and saturation of a #rrggbb, 0..1. */
function hsl(hexStr) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hexStr.slice(i, i + 2), 16) / 255);
  const max = Math.max(r, g, b); const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  return { l, s };
}

/** Decode our own PNG far enough to read its header and pixels back. */
function readPng(buf) {
  assert.deepEqual([...buf.subarray(0, 8)], [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 'PNG magic');
  let off = 8; const chunks = {};
  const idat = [];
  while (off < buf.length) {
    const len = buf.readUInt32BE(off);
    const type = buf.subarray(off + 4, off + 8).toString('latin1');
    const data = buf.subarray(off + 8, off + 8 + len);
    if (type === 'IDAT') idat.push(data); else chunks[type] = data;
    off += 12 + len;
  }
  const ihdr = chunks.IHDR;
  const width = ihdr.readUInt32BE(0);
  const colorType = ihdr[9];
  const ch = colorType === 6 ? 4 : 3;
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const at = (x, y) => {
    const row = y * (width * ch + 1);
    assert.equal(raw[row], 0, 'filter byte should be none');
    const i = row + 1 + x * ch;
    return [raw[i], raw[i + 1], raw[i + 2], ch === 4 ? raw[i + 3] : 255];
  };
  return { width, height: ihdr.readUInt32BE(4), colorType, ch, at };
}

test('the two gradient stops sit at the same lightness', () => {
  const a = hsl(BRAND.from); const b = hsl(BRAND.to);
  assert.ok(Math.abs(a.l - b.l) < 0.015,
    `a gradient that changes lightness goes dull at one end: ${BRAND.from}=${(a.l * 100).toFixed(1)}% vs ${BRAND.to}=${(b.l * 100).toFixed(1)}%`);
  assert.ok(Math.abs(a.s - b.s) < 0.06, 'and it must not lose saturation either');
  // Both ends genuinely vivid, not merely equal to each other.
  for (const [name, c] of [[BRAND.from, a], [BRAND.to, b]]) {
    assert.ok(c.s > 0.8, `${name} is not vibrant: saturation ${(c.s * 100).toFixed(0)}%`);
    assert.ok(c.l > 0.5 && c.l < 0.72, `${name} lightness ${(c.l * 100).toFixed(0)}% is outside the vivid band`);
  }
});

test('the far stop is the marketing blue, so the three surfaces agree', () => {
  // The signup's stylesheet is the published source of the brand accent.
  const css = fs.readFileSync(path.join(ROOT, 'platform/public/style.css'), 'utf8');
  const m = css.match(/--accent:\s*(#[0-9a-fA-F]{6})/);
  assert.ok(m, 'platform style.css should declare --accent');
  assert.equal(BRAND.to.toLowerCase(), m[1].toLowerCase(),
    'the icon gradient should land on the same blue the signup and marketing site use');
});

test('every icon is the size and channel count its platform demands', () => {
  for (const t of ICONS) {
    const p = readPng(t.bytes);
    assert.equal(p.width, t.size, `${t.file} width`);
    assert.equal(p.height, t.size, `${t.file} height`);
    assert.equal(p.ch, t.alpha ? 4 : 3, `${t.file} channels`);
  }
});

test('the masked icons are full-bleed and carry no alpha channel', () => {
  // iOS and Android apply their own shape. Pre-rounded art with transparent
  // corners gets rounded twice; the App Store rejects an alpha channel outright.
  for (const t of ICONS.filter((x) => !x.rounded)) {
    const p = readPng(t.bytes);
    assert.equal(p.colorType, 2, `${t.file} must be RGB with no alpha`);
    for (const [x, y] of [[0, 0], [t.size - 1, 0], [0, t.size - 1], [t.size - 1, t.size - 1]]) {
      const [r, g, b, a] = p.at(x, y);
      assert.equal(a, 255, `${t.file} corner ${x},${y} must be opaque`);
      assert.ok(r + g + b > 120, `${t.file} corner ${x},${y} should be brand colour, got ${r},${g},${b}`);
    }
  }
});

test('the rounded icon really does have transparent corners', () => {
  // The inverse of the test above: if this passed for the masked icons too,
  // neither test would be measuring anything.
  const t = ICONS.find((x) => x.rounded);
  const p = readPng(t.bytes);
  assert.equal(p.at(0, 0)[3], 0, `${t.file} corner should be transparent`);
  assert.equal(p.at(Math.floor(t.size / 2), Math.floor(t.size / 2))[3], 255, 'but its middle must not be');
});

test('no corner of the gradient is duller than the stops it runs between', () => {
  // The actual complaint, measured: the old icon ran to hsl(226,76%,48%) and
  // went visibly muddy bottom-right. Sample the far corner of the biggest icon.
  const t = ICONS.find((x) => x.size === 1024);
  const p = readPng(t.bytes);
  const [r, g, b] = p.at(1010, 1010);
  const { l, s } = hsl(`#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`);
  assert.ok(l > 0.5, `the far corner has gone dark: lightness ${(l * 100).toFixed(0)}%`);
  assert.ok(s > 0.8, `the far corner has gone dull: saturation ${(s * 100).toFixed(0)}%`);
});

test('the mark is drawn, not just a coloured square', () => {
  // White ink somewhere in the middle, or the geometry silently broke.
  const t = ICONS.find((x) => x.size === 512);
  const p = readPng(t.bytes);
  let white = 0;
  for (let y = 100; y < 420; y += 4) {
    for (let x = 100; x < 420; x += 4) {
      const [r, g, b] = p.at(x, y);
      if (r > 240 && g > 240 && b > 240) white += 1;
    }
  }
  assert.ok(white > 400, `the K should cover a real share of the tile, saw ${white} white samples`);
});

test('the icon files on disk match what the generator produces', () => {
  for (const t of ICONS) {
    const p = path.join(ROOT, 'public/icons', t.file);
    assert.ok(fs.existsSync(p), `${t.file} is missing — run node scripts/make-icons.mjs`);
    assert.equal(Buffer.compare(fs.readFileSync(p), t.bytes), 0,
      `${t.file} is stale — run node scripts/make-icons.mjs`);
  }
});

test('every page that draws the mark draws the current one', () => {
  // The test that would have caught public/book.html. Any file containing the
  // K's stem path must also carry both current stops and neither old one.
  const roots = ['public', 'platform/public'];
  const found = [];
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) { walk(full); continue; }
      if (!/\.(html|js|css)$/.test(e.name)) continue;
      const text = fs.readFileSync(full, 'utf8');
      if (!text.includes('M15.6 13V35')) continue;
      const rel = path.relative(ROOT, full);
      found.push(rel);
      // The rule is about stale colour, not about spelling the stops out. A
      // mark drawn in currentColor takes the brand from CSS, which is better
      // than hard-coding it — the signup's drifting field does exactly that.
      // What none of them may do is carry the old end-stop.
      assert.ok(!/1d4ed8/i.test(text), `${rel} still has the old muddy end-stop`);
      const inherits = /stroke="currentColor"|stroke='currentColor'/.test(text);
      if (inherits) continue;
      const from = BRAND.from.slice(1).toLowerCase();
      const to = BRAND.to.slice(1).toLowerCase();
      const lower = text.toLowerCase();
      assert.ok(lower.includes(from), `${rel} hard-codes the mark's colour but not ${BRAND.from}`);
      assert.ok(lower.includes(to), `${rel} hard-codes the mark's colour but not ${BRAND.to}`);
    }
  };
  roots.forEach((r) => walk(path.join(ROOT, r)));
  assert.ok(found.length >= 5, `expected to find the mark in several pages, found ${found.length}: ${found}`);
});

test('the generated SVG carries the same colours as the PNGs', () => {
  const s = svg();
  assert.ok(s.includes(BRAND.from) && s.includes(BRAND.to), 'SVG stops');
  assert.ok(svg({ rounded: false }).includes('<rect width=\'48\' height=\'48\' fill='), 'square variant has no rx');
  assert.ok(s.includes(`rx='${BRAND.radius}'`), 'rounded variant keeps its corner radius');
});
