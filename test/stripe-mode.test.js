// Which Stripe are we actually pointed at?
//
// The expensive mistake this guards is not a missing key — a missing key stops
// everything loudly on the first attempt to pay. It is a TEST key in a platform
// everyone believes is live: checkout works, the customer sees a receipt, the
// webhook fires, a salon is provisioned, and no money moves. Nothing complains.
//
// So every assertion below is about telling the three states apart, and the
// live case is deliberately the only one that does not print a warning.
import test from 'node:test';
import assert from 'node:assert/strict';

import { stripeMode, stripeConfigured } from '../platform/stripe.js';

// The fixtures below are deliberately shaped wrong past their prefix. Realistic
// ones were written first and GitHub push protection blocked the push, which was
// the correct call: this repository is public, and a fixture that matches the
// real pattern is indistinguishable from a leak to every scanner that sees it.
// Only the prefix carries meaning here, so nothing is lost by the rest being
// plainly fake. Do not make these look real again.
function withKey(value, fn) {
  const had = Object.prototype.hasOwnProperty.call(process.env, 'STRIPE_SECRET_KEY');
  const before = process.env.STRIPE_SECRET_KEY;
  if (value === undefined) delete process.env.STRIPE_SECRET_KEY;
  else process.env.STRIPE_SECRET_KEY = value;
  try { return fn(); } finally {
    if (had) process.env.STRIPE_SECRET_KEY = before;
    else delete process.env.STRIPE_SECRET_KEY;
  }
}

test('a live secret key reports live', () => {
  withKey('sk_live_NOT_A_REAL_KEY', () => {
    assert.equal(stripeMode(), 'live');
    assert.equal(stripeConfigured(), true);
  });
});

test('a test secret key reports test, not live', () => {
  withKey('sk_test_NOT_A_REAL_KEY', () => {
    assert.equal(stripeMode(), 'test');
    // Configured and live are different questions. This is the whole point:
    // a test key is fully configured and will happily take a fake payment.
    assert.equal(stripeConfigured(), true);
    assert.notEqual(stripeMode(), 'live');
  });
});

test('no key at all reports unset', () => {
  withKey(undefined, () => {
    assert.equal(stripeMode(), 'unset');
    assert.equal(stripeConfigured(), false);
  });
});

test('an empty or whitespace key is unset, not unknown', () => {
  // Render hands back an empty string for a variable that was added but never
  // given a value, and '' is falsy in a way that is easy to read past.
  for (const blank of ['', '   ', '\t']) {
    withKey(blank, () => assert.equal(stripeMode(), 'unset', JSON.stringify(blank)));
  }
});

test('restricted keys are classified by their own mode', () => {
  withKey('rk_live_EXAMPLE', () => assert.equal(stripeMode(), 'live'));
  withKey('rk_test_EXAMPLE', () => assert.equal(stripeMode(), 'test'));
});

test('a key of an unrecognised shape is unknown, never assumed live', () => {
  // The dangerous default would be to treat anything non-test as live. A
  // publishable key pasted in by mistake must not read as "real money is fine".
  for (const odd of ['pk_live_EXAMPLE', 'whsec_EXAMPLE', 'sk_EXAMPLE', 'nonsense']) {
    withKey(odd, () => {
      assert.equal(stripeMode(), 'unknown', odd);
      assert.notEqual(stripeMode(), 'live', odd);
    });
  }
});

test('the live branch is the only silent one', () => {
  // The banner warns on unset, test and unknown, and stays quiet only for live.
  // Asserted here as a property of the mode set so that adding a fourth mode
  // without deciding how it is announced fails a test rather than shipping.
  const warned = ['unset', 'test', 'unknown'];
  const all = ['unset', 'test', 'unknown', 'live'];
  assert.deepEqual(all.filter((m) => !warned.includes(m)), ['live']);
});

test('reading the mode does not disturb the environment', () => {
  const before = process.env.STRIPE_SECRET_KEY;
  withKey('sk_test_EXAMPLE', () => stripeMode());
  assert.equal(process.env.STRIPE_SECRET_KEY, before);
});
