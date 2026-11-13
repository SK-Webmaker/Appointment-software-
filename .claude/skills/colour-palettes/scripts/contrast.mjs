#!/usr/bin/env node
// WCAG contrast checker for a palette.
//   node contrast.mjs "#f4efe6" "#0a0812"            -> one pair
//   node contrast.mjs --css path/to/styles.css      -> every --color-* token against every other
// Pass marks: body text 4.5, large text (24px+, or 19px bold) and UI parts 3.0.
import fs from "node:fs";

const hex = (h) => {
  h = h.replace("#", "");
  if (h.length === 3) h = [...h].map((c) => c + c).join("");
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
};
const lum = (h) => {
  const [r, g, b] = hex(h).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
export const ratio = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};
const grade = (r) => (r >= 7 ? "AAA" : r >= 4.5 ? "AA" : r >= 3 ? "large/UI only" : "FAIL");

const args = process.argv.slice(2);
if (args[0] === "--css") {
  const css = fs.readFileSync(args[1], "utf8");
  const tokens = [...css.matchAll(/--color-([\w-]+):\s*(#[0-9a-fA-F]{3,6})\b/g)].map((m) => [m[1], m[2]]);
  const rows = [];
  for (const [n1, c1] of tokens) for (const [n2, c2] of tokens) if (n1 < n2) rows.push([ratio(c1, c2), n1, n2]);
  rows.sort((a, b) => b[0] - a[0]);
  for (const [r, a, b] of rows) console.log(`${r.toFixed(2).padStart(6)}  ${grade(r).padEnd(13)} ${a} / ${b}`);
} else if (args.length === 2) {
  const r = ratio(args[0], args[1]);
  console.log(`${r.toFixed(2)}:1  ${grade(r)}`);
} else {
  console.log('usage: contrast.mjs "#fg" "#bg"  |  contrast.mjs --css styles.css');
}
