// The field behind the purchase.
//
// Decoration on the one page where somebody types a card number, so it is held
// to two rules and both are checked here rather than admired in a screenshot:
//
//   1. It must never compete with the form. Everything in it stays far below
//      the contrast of anything a person has to read.
//   2. It must animate free. Only transform and opacity, because anything that
//      moves layout or triggers paint will stutter under a keyboard on a
//      mid-range phone — and this thing runs for the whole four minutes.
//
// The reduced-motion case is the subtle one and is why this file exists. The
// obvious fix — animation: none — is wrong here, because these keyframes open
// DIMMER than they close. Killing the animation strands every mark at its
// opening frame: visible, and fainter than intended. Freezing at the end state
// is the correct behaviour, and measuring it in a browser confirmed each mark
// lands on exactly its --o value.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const css = fs.readFileSync(path.join(ROOT, 'platform/public/style.css'), 'utf8');
const html = fs.readFileSync(path.join(ROOT, 'platform/public/start.html'), 'utf8');
const appjs = fs.readFileSync(path.join(ROOT, 'platform/public/app.js'), 'utf8');

/** The `@media (prefers-reduced-motion: reduce)` block, with its body. */
function reducedBlock() {
  const i = css.indexOf('@media (prefers-reduced-motion: reduce)');
  assert.ok(i > -1, 'the signup stylesheet must answer prefers-reduced-motion at all');
  let depth = 0; let j = css.indexOf('{', i);
  const start = j;
  for (; j < css.length; j++) {
    if (css[j] === '{') depth += 1;
    else if (css[j] === '}') { depth -= 1; if (!depth) break; }
  }
  return css.slice(start, j + 1);
}

test('the field is decorative and cannot be reached', () => {
  assert.match(html, /<svg class="field" aria-hidden="true"/, 'hidden from screen readers');
  assert.match(css, /\.field\s*\{[^}]*pointer-events:\s*none/s, 'never intercepts a tap');
  // It sits behind the form, not over it.
  const z = css.match(/\.field\s*\{[^}]*z-index:\s*(\d+)/s);
  assert.ok(z && Number(z[1]) === 0, 'the field must sit at z-index 0, under .wrap');
});

test('every mark is far too faint to compete with the form', () => {
  const os = [...css.matchAll(/--o:\s*\.(\d+);/g)].map((m) => Number(`0.${m[1]}`));
  assert.ok(os.length >= 6, `expected an opacity for each mark, found ${os.length}`);
  for (const o of os) {
    assert.ok(o > 0, 'an invisible mark is just wasted work');
    assert.ok(o <= 0.08, `${o} is too strong to sit behind a card field`);
  }
});

test('only the compositor-friendly properties animate', () => {
  // transform and opacity do not touch layout or paint. Animating width, top,
  // margin, filter or box-shadow here would cost frames on every keystroke.
  const frames = css.slice(css.indexOf('@keyframes k-float'));
  const body = frames.slice(0, frames.indexOf('}\n\n') + 1);
  for (const banned of ['width:', 'height:', 'top:', 'left:', 'margin', 'filter:', 'box-shadow']) {
    assert.ok(!body.includes(banned), `k-float animates ${banned}, which is not free`);
  }
  assert.match(body, /transform:\s*translate3d/, 'should move on the GPU');
});

test('reduced motion freezes the marks at full strength, never at their dim start', () => {
  const block = reducedBlock();
  assert.match(block, /\.field \.k\s*\{[^}]*animation-fill-mode:\s*forwards/s,
    'the marks must hold their final frame');
  assert.match(block, /\.field \.k\s*\{[^}]*animation-direction:\s*normal/s,
    'alternate would land them back on the dim opening frame');
  // The trap, stated as a test: a blanket animation:none on .field .k would
  // strand every mark at `from`, which is 55% of its intended opacity.
  assert.ok(!/\.field \.k\s*\{[^}]*animation:\s*none/s.test(block),
    'animation:none on the marks strands them at their opening frame — freeze them instead');
});

test('the marks all drift on different clocks', () => {
  const durs = [...css.matchAll(/\.field \.k\d \{ animation-duration: (\d+)s/g)].map((m) => Number(m[1]));
  assert.equal(durs.length, 6, 'six marks, six durations');
  assert.equal(new Set(durs).size, 6, 'shared durations make the loop visible');
});

test('the field draws the real mark, from one definition', () => {
  assert.equal((html.match(/<symbol id="kmark"/g) || []).length, 1, 'defined once');
  assert.equal((html.match(/href="#kmark"/g) || []).length, 6, 'used six times');
  assert.match(html, /M15\.6 13V35/, 'and it is the actual Kairo K, not a letter');
});

test('the masthead shows the mark, not a typed letter K', () => {
  // It was <span class="mark">K</span> — a letter in a gradient box, on the
  // one page that takes the money.
  assert.ok(!/<span class="mark">K<\/span>/.test(appjs), 'the typed-letter mark is back');
  assert.match(appjs, /<svg class="mark"[\s\S]*M15\.6 13V35/, 'the masthead should draw the real mark');
  assert.match(appjs, /#38bdf8[\s\S]{0,200}#3b82f6/, 'and in the current brand gradient');
});

test('CSS owns the tile radius so it holds at any size', () => {
  // The SVG draws a square and CSS rounds it. If the SVG re-grew its own rx,
  // the two radii would fight and the corners would shave.
  const mark = appjs.slice(appjs.indexOf('<svg class="mark"'));
  assert.ok(!/<rect width="48" height="48" rx=/.test(mark.slice(0, 600)),
    'the masthead tile should be square in SVG and rounded in CSS');
  assert.match(css, /\.mark\s*\{[^}]*border-radius:\s*10px/s);
  assert.match(css, /\.mark\s*\{[^}]*overflow:\s*hidden/s, 'without this the radius does nothing');
});
