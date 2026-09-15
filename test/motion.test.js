// The app's motion, checked rather than admired.
//
// Kairo animates a lot — 28 keyframe sequences, a launch animation, a voice
// orb. None of that is a problem until somebody switches Reduce Motion on,
// which people do because movement genuinely makes them unwell. Six components
// honoured that setting and twenty-two did not.
//
// These tests exist because the obvious fix is the broken one, and a future
// tidy-up will reach for it. Nothing here needs a browser: the stylesheet is
// the artefact, so the stylesheet is what is read.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const css = fs.readFileSync(path.join(ROOT, 'public/css/app.css'), 'utf8');

/** The last `@media (prefers-reduced-motion: reduce)` block, with its body. */
function globalReducedMotionBlock() {
  // Several of these media queries are written on one line, so a lazy match to
  // the next `\n}` runs past them into unrelated rules. Identify the app-wide
  // guard by what only it contains — a universal pseudo-element selector AND an
  // animation-duration — rather than by loose punctuation that a CSS comment
  // full of asterisks also satisfies.
  const re = /@media \(prefers-reduced-motion: reduce\)\s*\{([\s\S]*?)\n\}/g;
  const universal = [...css.matchAll(re)]
    .map((m) => m[1])
    .filter((body) => /\*::before/.test(body) && /animation-duration/.test(body));
  return universal.length ? universal[universal.length - 1] : null;
}

test('Reduce Motion is honoured app-wide, not component by component', () => {
  const block = globalReducedMotionBlock();
  assert.ok(block, 'no universal prefers-reduced-motion block — only some components would honour the setting');
  assert.match(block, /\*::before/, 'pseudo-elements animate too and must be covered');
});

test('the guard lands elements on their FINAL frame, never removes the animation', () => {
  // This is the whole point of the file. Most keyframes here define only a
  // `to` state, so the resting appearance IS the animation's end. Removing the
  // animation leaves the element at its starting frame — invisible — and the
  // app reads as broken rather than calm.
  const block = globalReducedMotionBlock();
  assert.match(block, /animation-duration:\s*0\.01ms\s*!important/,
    'run the animation instantly instead of not at all');
  assert.match(block, /animation-iteration-count:\s*1\s*!important/,
    'without this an infinite animation still loops, just imperceptibly fast');
  assert.doesNotMatch(block, /animation:\s*none/,
    'animation: none in the universal block would strand every to-only keyframe at its hidden start');
});

test('the animations that only define an end state are the reason why', () => {
  // Evidence for the rule above, read from the stylesheet rather than trusted.
  // If these ever stop being `to`-only, the rule can be revisited on purpose.
  const toOnly = [...css.matchAll(/@keyframes\s+([a-zA-Z-]+)\s*\{([\s\S]*?)\n\}/g)]
    .filter(([, , body]) => /\bto\s*\{/.test(body) && !/\bfrom\s*\{|0%\s*\{/.test(body))
    .map(([, name]) => name);
  assert.ok(toOnly.length > 0,
    'if no keyframe is to-only any more, the jump-to-end rule deserves a second look');
});

test('every animation names a keyframe that actually exists', () => {
  // An animation referencing a keyframe that is not defined does nothing at
  // all, silently — it looks like a styling bug and reads like a dead app.
  const defined = new Set([...css.matchAll(/@keyframes\s+([a-zA-Z-]+)/g)].map((m) => m[1]));
  const used = new Set(
    [...css.matchAll(/animation:\s*([a-zA-Z][a-zA-Z0-9-]*)/g)]
      .map((m) => m[1])
      .filter((n) => n !== 'none'),
  );
  const missing = [...used].filter((n) => !defined.has(n));
  assert.deepEqual(missing, [], `animations with no keyframes behind them: ${missing.join(', ')}`);
});

test('motion runs on one scale, so it reads as one product', () => {
  // Five ad-hoc easing curves read as five people. The tokens exist so new
  // work inherits a curve instead of inventing a sixth.
  for (const token of ['--ease-out', '--ease-in-out', '--ease-spring', '--dur-state', '--dur-enter']) {
    assert.match(css, new RegExp(`${token}:`), `${token} should be defined once, in :root`);
  }
  // And the controls a person touches most must actually use them.
  assert.match(css, /transition: border-color var\(--dur-state\)/, 'buttons are on the scale');
  assert.match(css, /transition: background var\(--dur-state\)/, 'navigation is on the scale');
});

test('the controls a person uses all day have a keyboard focus ring', () => {
  // Three niche components had one and the two most-used controls did not.
  // :focus-visible matters as much as the ring: a ring drawn on every mouse
  // click looks like a bug, which is how the blanket `outline: none` that
  // caused this in the first place keeps getting written.
  assert.match(css, /\.btn:focus-visible/, 'buttons');
  assert.match(css, /\.nav-item:focus-visible/, 'the navigation');
  assert.doesNotMatch(css, /\.btn:focus\s*\{[^}]*outline:\s*none/,
    'never remove the ring outright — that is the bug this replaces');
});
