'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');

test('onboarding treats only explicitly verified actions as verified', async () => {
  const { classifyActionOutcome } = await import('../src/services/actionOutcome.mjs');
  assert.deepEqual(classifyActionOutcome({ success: true, verified: true }, 'Calculator'),
    { kind: 'verified', message: 'Calculator verified.' });
  for (const response of [
    { success: true, verified: false },
    { success: true },
    { success: true, verified: 'yes' }
  ]) {
    assert.equal(classifyActionOutcome(response, 'Calculator').kind, 'unverified');
  }
});

test('onboarding never reports missing or failed native results as success', async () => {
  const { classifyActionOutcome } = await import('../src/services/actionOutcome.mjs');
  assert.equal(classifyActionOutcome(null).kind, 'error');
  assert.equal(classifyActionOutcome({}).kind, 'error');
  assert.deepEqual(classifyActionOutcome({ success: false, error: 'Access denied' }, 'Calculator'),
    { kind: 'error', message: 'Calculator failed: Access denied' });
});
