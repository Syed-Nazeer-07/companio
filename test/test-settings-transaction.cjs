'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { updateShortcutWithRollback, updateOverlayWithRollback } = require('../electron/automation/settingsTransaction.cjs');

test('successful shortcut changes register and persist the same shortcut', () => {
  const changes = [];
  let saved;
  const result = updateShortcutWithRollback('Ctrl+Alt+K', 'Ctrl+Shift+Space',
    value => { changes.push(value); return { success: true, shortcut: value }; },
    value => { saved = value; return true; }
  );
  assert.deepEqual(result, { success: true, shortcut: 'Ctrl+Alt+K' });
  assert.deepEqual(changes, ['Ctrl+Alt+K']);
  assert.equal(saved, 'Ctrl+Alt+K');
});

test('shortcuts roll back when saving fails', () => {
  const changes = [];
  const result = updateShortcutWithRollback('Ctrl+Alt+K', 'Ctrl+Shift+Space',
    value => { changes.push(value); return { success: true, shortcut: value }; },
    () => false
  );
  assert.equal(result.success, false);
  assert.equal(result.shortcut, 'Ctrl+Shift+Space');
  assert.match(result.error, /restored/);
  assert.deepEqual(changes, ['Ctrl+Alt+K', 'Ctrl+Shift+Space']);
});

test('shortcut updates never save a failed registration', () => {
  let writes = 0;
  const result = updateShortcutWithRollback('Ctrl+Alt+K', 'Ctrl+Shift+Space',
    () => ({ success: false, error: 'Shortcut unavailable' }),
    () => { writes++; return true; }
  );
  assert.equal(result.success, false);
  assert.equal(writes, 0);
});

test('failed shortcut rollback reports active state uncertainty', () => {
  const result = updateShortcutWithRollback('Ctrl+Alt+K', 'Ctrl+Shift+Space',
    value => value === 'Ctrl+Alt+K'
      ? { success: true, shortcut: value } : { success: false, error: 'Already taken' },
    () => false
  );
  assert.equal(result.success, false);
  assert.equal(result.shortcut, 'Ctrl+Alt+K');
  assert.match(result.error, /may still be active/i);
});

test('overlay preferences are not applied when persistence fails', () => {
  let calls = 0;
  const result = updateOverlayWithRollback({ alwaysOnTop: false, snapToEdge: false },
    { alwaysOnTop: true, snapToEdge: true },
    () => false,
    () => { calls++; }
  );
  assert.equal(result.success, false);
  assert.equal(calls, 0);
});

test('overlay preferences revert on Windows apply failure', () => {
  const previous = { alwaysOnTop: true, snapToEdge: true };
  const requested = { alwaysOnTop: false, snapToEdge: false };
  const writes = [];
  const applied = [];
  const result = updateOverlayWithRollback(requested, previous,
    value => { writes.push(value); return true; },
    value => {
      applied.push(value);
      if (value === requested) throw new Error('Native window unavailable');
    }
  );
  assert.equal(result.success, false);
  assert.equal(result.verified, false);
  assert.match(result.error, /restored/);
  assert.deepEqual(writes, [requested, previous]);
  assert.deepEqual(applied, [requested, previous]);
});

test('overlay settings apply only after successful persistence', () => {
  const steps = [];
  const result = updateOverlayWithRollback({ alwaysOnTop: false, snapToEdge: true },
    { alwaysOnTop: true, snapToEdge: true },
    () => { steps.push('save'); return true; },
    () => { steps.push('apply'); }
  );
  assert.equal(result.success, true);
  assert.equal(result.verified, true);
  assert.deepEqual(steps, ['save', 'apply']);
});
