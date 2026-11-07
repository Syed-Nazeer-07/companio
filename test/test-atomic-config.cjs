'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { writeConfigAtomically } = require('../electron/automation/atomicConfigStore.cjs');

test('atomic native settings replacement preserves valid JSON', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'companio-config-'));
  try {
    const file = path.join(dir, 'window_config.json');
    writeConfigAtomically(file, { activationShortcut: 'Ctrl+Shift+Space', alwaysOnTop: true });
    assert.deepEqual(JSON.parse(fs.readFileSync(file, 'utf8')), {
      activationShortcut: 'Ctrl+Shift+Space', alwaysOnTop: true
    });
    writeConfigAtomically(file, { activationShortcut: 'Ctrl+Alt+K', alwaysOnTop: false });
    assert.deepEqual(JSON.parse(fs.readFileSync(file, 'utf8')), {
      activationShortcut: 'Ctrl+Alt+K', alwaysOnTop: false
    });
    assert.deepEqual(fs.readdirSync(dir), ['window_config.json']);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('failed replace leaves previous settings readable and cleans temporary file', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'companio-config-'));
  try {
    const file = path.join(dir, 'window_config.json');
    fs.writeFileSync(file, JSON.stringify({ activationShortcut: 'Ctrl+Shift+Space' }));
    const failingFs = {
      mkdirSync: (...args) => fs.mkdirSync(...args),
      writeFileSync: (...args) => fs.writeFileSync(...args),
      renameSync: () => { throw new Error('simulated rename failure'); },
      unlinkSync: (...args) => fs.unlinkSync(...args)
    };
    assert.throws(
      () => writeConfigAtomically(file, { activationShortcut: 'Ctrl+Alt+K' }, failingFs),
      /simulated rename failure/
    );
    assert.deepEqual(JSON.parse(fs.readFileSync(file, 'utf8')), {
      activationShortcut: 'Ctrl+Shift+Space'
    });
    assert.deepEqual(fs.readdirSync(dir), ['window_config.json']);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('atomic settings refuse malformed output and config paths', () => {
  assert.throws(() => writeConfigAtomically('', {}), /path/);
  assert.throws(() => writeConfigAtomically('config.json', null), /config/);
});
