// The setup journey's small promises, checked without a browser.
//
// The journey itself is walked in a real browser before release (laptop,
// phone, reduced motion); these pin the words it puts in front of the owner.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { daysPhrase } from '../public/js/wizard.js';

test('open days read the way a sign on the door says them', () => {
  assert.equal(daysPhrase([2, 3, 4, 5, 6]), 'Tue–Sat');
  assert.equal(daysPhrase([1, 2, 3, 4, 5]), 'Mon–Fri');
  assert.equal(daysPhrase([1, 3, 5]), 'Mon, Wed & Fri');
  assert.equal(daysPhrase([0, 1, 2, 3, 4, 5, 6]), 'Every day');
  assert.equal(daysPhrase([6, 0]), 'Sat, Sun', 'the weekend runs Saturday into Sunday');
  assert.equal(daysPhrase([1, 2, 3, 4, 5, 0]), 'Mon–Fri & Sun');
  assert.equal(daysPhrase([]), 'Closed');
  assert.equal(daysPhrase([3, 3, 9, -1]), 'Wed', 'repeats and nonsense are ignored');
});
