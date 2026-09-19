#!/usr/bin/env node
// The Kairo mark, in one place, rendered to every size the app needs.
//
// WHY THIS EXISTS. The PNGs used to be binaries nobody could regenerate: no
// source, no way to change the colour without an image editor, and three
// different blues across the marketing site, this signup and the app. Any
// recolour meant hand-editing files that could not be diffed. Now the geometry
// and the colours live here and the files are output.
//
// Zero dependencies, like the rest of Kairo: node:zlib deflates the pixels and
// the PNG chunks are written by hand. A 512px icon is ~60 lines of arithmetic
// and one CRC table, which is cheaper than owning an image library.
//
//   node scripts/make-icons.mjs          # write the icons
//   node scripts/make-icons.mjs --check  # fail if they are out of date
import zlib from 'node:zlib';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'public', 'icons');

// ── the brand ──────────────────────────────────────────────────────────────
//
// One gradient, and it is a pure HUE rotation: both stops sit at the same
// lightness and very nearly the same saturation.
//
//   #38bdf8  hsl(199, 93%, 60%)   sky
//   #3b82f6  hsl(217, 91%, 60%)   blue   ← the marketing site's accent
//
// It used to end on #1d4ed8, hsl(226, 76%, 48%). That is twelve points darker
// and seventeen less saturated than where it starts, which is why the old icon
// went vivid in one corner and muddy in the opposite one. Holding lightness
// flat is what "vibrant the whole way across" actually means, and landing the
// far stop on #3b82f6 means the icon, the signup and the marketing site are
// finally the same blue instead of three.
export const BRAND = {
  from: '#38bdf8',
  to: '#3b82f6',
  ink: '#ffffff',
  dot: '#bae6fd',
  radius: 12.5,          // corner radius in the 48-unit grid, for the SVG only
};

const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));

// ── the geometry, in a 48×48 grid ──────────────────────────────────────────
//
// A K whose upper arm is an arc rather than a straight limb — a clock hand
// sweeping up to the dot. The arc is the same one the SVG draws:
//   A 13 13 0 0 1  from (18.5,25.4) to (28.6,15.9)
// resolved here to a centre and two angles, because a rasteriser needs those
// and a browser does not.
const W = 4.6;                     // stroke width
const STEM = { x: 15.6, y1: 13, y2: 35 };
const LEG = { x1: 18.5, y1: 25.4, x2: 31.6, y2: 35 };
const ARC = { x1: 18.5, y1: 25.4, x2: 28.6, y2: 15.9, r: 13 };
const DOT = { x: 33, y: 13.2, r: 3.2 };

/** SVG's endpoint arc parameterisation, turned into a centre and a sweep. */
function arcCentre({ x1, y1, x2, y2, r }, largeArc = 0, sweep = 1) {
  const dx = (x1 - x2) / 2; const dy = (y1 - y2) / 2;
  const num = r * r * r * r - r * r * dy * dy - r * r * dx * dx;
  const den = r * r * dy * dy + r * r * dx * dx;
  const k = (largeArc !== sweep ? 1 : -1) * Math.sqrt(Math.max(0, num / den));
  const cx = k * (r * dy / r) + (x1 + x2) / 2;
  const cy = k * (-r * dx / r) + (y1 + y2) / 2;
  let a1 = Math.atan2(y1 - cy, x1 - cx);
  let a2 = Math.atan2(y2 - cy, x2 - cx);
  if (sweep && a2 < a1) a2 += Math.PI * 2;
  if (!sweep && a2 > a1) a2 -= Math.PI * 2;
  return { cx, cy, a1, a2 };
}
const A = arcCentre(ARC);

const distToSegment = (px, py, x1, y1, x2, y2) => {
  const vx = x2 - x1; const vy = y2 - y1;
  const len2 = vx * vx + vy * vy;
  const t = len2 ? Math.max(0, Math.min(1, ((px - x1) * vx + (py - y1) * vy) / len2)) : 0;
  return Math.hypot(px - (x1 + t * vx), py - (y1 + t * vy));
};

/** Distance to the arc's centre-line, round caps included. */
function distToArc(px, py) {
  const dx = px - A.cx; const dy = py - A.cy;
  let a = Math.atan2(dy, dx);
  while (a < A.a1) a += Math.PI * 2;
  if (a <= A.a2) return Math.abs(Math.hypot(dx, dy) - ARC.r);
  return Math.min(Math.hypot(px - ARC.x1, py - ARC.y1), Math.hypot(px - ARC.x2, py - ARC.y2));
}

/** Coverage of the white mark at a point, 0..1, before supersampling. */
const inMark = (x, y) =>
  distToSegment(x, y, STEM.x, STEM.y1, STEM.x, STEM.y2) <= W / 2
  || distToSegment(x, y, LEG.x1, LEG.y1, LEG.x2, LEG.y2) <= W / 2
  || distToArc(x, y) <= W / 2;

const inDot = (x, y) => Math.hypot(x - DOT.x, y - DOT.y) <= DOT.r;

/** The squircle, only used when an icon is allowed rounded corners. */
function inRounded(x, y, r) {
  const cx = Math.min(Math.max(x, r), 48 - r);
  const cy = Math.min(Math.max(y, r), 48 - r);
  return Math.hypot(x - cx, y - cy) <= r;
}

// ── rasteriser ─────────────────────────────────────────────────────────────
const SS = 4; // supersampling per axis: 16 samples a pixel

/**
 * Render the mark at `size` px.
 *
 * `rounded` is false for anything a platform masks itself. iOS and Android both
 * apply their own shape, so handing them pre-rounded art with transparent
 * corners gets it rounded twice — visibly clipped on Android, and composited
 * against who-knows-what on iOS. Full-bleed square is the correct input, and it
 * is also what the App Store demands (no alpha at all).
 */
function render(size, { rounded = false } = {}) {
  const from = hex(BRAND.from); const to = hex(BRAND.to);
  const ink = hex(BRAND.ink); const dot = hex(BRAND.dot);
  const px = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0; let g = 0; let b = 0; let a = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const ux = ((x + (sx + 0.5) / SS) / size) * 48;
          const uy = ((y + (sy + 0.5) / SS) / size) * 48;
          if (rounded && !inRounded(ux, uy, BRAND.radius)) continue;
          // The gradient runs corner to corner, as the SVG's does.
          const t = Math.min(1, Math.max(0, (ux + uy) / 96));
          let cr = from[0] + (to[0] - from[0]) * t;
          let cg = from[1] + (to[1] - from[1]) * t;
          let cb = from[2] + (to[2] - from[2]) * t;
          if (inDot(ux, uy)) { [cr, cg, cb] = dot; }
          else if (inMark(ux, uy)) { [cr, cg, cb] = ink; }
          r += cr; g += cg; b += cb; a += 255;
        }
      }
      const n = SS * SS;
      const i = (y * size + x) * 4;
      px[i] = Math.round(r / n); px[i + 1] = Math.round(g / n);
      px[i + 2] = Math.round(b / n); px[i + 3] = Math.round(a / n);
    }
  }
  return px;
}

// ── PNG ────────────────────────────────────────────────────────────────────
const CRC = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();
function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'latin1'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

/** `alpha:false` drops the channel entirely — the App Store rejects any alpha. */
export function png(size, rgba, { alpha = true } = {}) {
  const ch = alpha ? 4 : 3;
  const raw = Buffer.alloc(size * (size * ch + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * ch + 1)] = 0; // filter: none
    for (let x = 0; x < size; x++) {
      const s = (y * size + x) * 4;
      const d = y * (size * ch + 1) + 1 + x * ch;
      raw[d] = rgba[s]; raw[d + 1] = rgba[s + 1]; raw[d + 2] = rgba[s + 2];
      if (alpha) raw[d + 3] = rgba[s + 3];
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = alpha ? 6 : 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/** The same mark as an SVG, so the favicon cannot drift from the PNGs. */
export function svg({ rounded = true } = {}) {
  const shape = rounded
    ? `<rect width='48' height='48' rx='${BRAND.radius}' fill='url(%23t)'/>`
    : `<rect width='48' height='48' fill='url(%23t)'/>`;
  return `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 48 48'>`
    + `<defs><linearGradient id='t' x1='2' y1='2' x2='46' y2='46' gradientUnits='userSpaceOnUse'>`
    + `<stop stop-color='${BRAND.from}'/><stop offset='1' stop-color='${BRAND.to}'/>`
    + `</linearGradient></defs>${shape}`
    + `<path d='M15.6 13V35' stroke='${BRAND.ink}' stroke-width='4.6' stroke-linecap='round'/>`
    + `<path d='M18.5 25.4A13 13 0 0 1 28.6 15.9' stroke='${BRAND.ink}' stroke-width='4.6' stroke-linecap='round' fill='none'/>`
    + `<path d='M18.5 25.4L31.6 35' stroke='${BRAND.ink}' stroke-width='4.6' stroke-linecap='round'/>`
    + `<circle cx='33' cy='13.2' r='3.2' fill='${BRAND.dot}'/></svg>`;
}

// Every file, and why it is shaped the way it is.
export const TARGETS = [
  // iOS masks this itself, so it must be square and opaque.
  { file: 'kairo-180.png', size: 180, rounded: false, alpha: false },
  // Android's "any" slot may be shown unmasked, so this one keeps its corners.
  { file: 'kairo-192.png', size: 192, rounded: true, alpha: true },
  // The manifest's maskable icon. Android crops it; pre-rounding it crops twice.
  { file: 'kairo-512.png', size: 512, rounded: false, alpha: false },
  // App Store Connect: 1024, square, and it rejects an alpha channel outright.
  { file: 'kairo-1024.png', size: 1024, rounded: false, alpha: false },
];

export function build() {
  return TARGETS.map((t) => ({ ...t, bytes: png(t.size, render(t.size, t), t) }));
}

if (process.argv[1] && process.argv[1].endsWith('make-icons.mjs')) {
  const check = process.argv.includes('--check');
  fs.mkdirSync(OUT, { recursive: true });
  let stale = 0;
  for (const t of build()) {
    const p = path.join(OUT, t.file);
    const same = fs.existsSync(p) && Buffer.compare(fs.readFileSync(p), t.bytes) === 0;
    if (check) {
      if (!same) { stale += 1; console.error(`  stale: ${t.file}`); }
      continue;
    }
    if (!same) fs.writeFileSync(p, t.bytes);
    console.log(`  ${same ? 'unchanged' : 'wrote'}  ${t.file.padEnd(16)} ${t.size}px  ${t.rounded ? 'rounded' : 'square '}  ${t.alpha ? 'alpha' : 'opaque'}  ${(t.bytes.length / 1024).toFixed(1)}kB`);
  }
  if (check && stale) { console.error(`\n  ${stale} icon(s) out of date — run: node scripts/make-icons.mjs`); process.exit(1); }
  if (check) console.log('  icons are up to date');
}
