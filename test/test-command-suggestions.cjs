'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

function loadTs(relPath) {
  const fullPath = path.join(__dirname, '..', relPath);
  const source = fs.readFileSync(fullPath, 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  }).outputText;
  const mod = { exports: {} };
  const fn = new Function('exports', 'require', 'module', compiled);
  fn(mod.exports, require, mod);
  return mod.exports;
}

const { deriveHistorySuggestions } = loadTs('src/services/commandSuggestions.ts');

test('returns empty list when history has no qualifying commands (no generic defaults)', () => {
  assert.deepEqual(deriveHistorySuggestions([]), []);
  assert.deepEqual(
    deriveHistorySuggestions([
      { id: '1', sender: 'user', content: 'hi', timestamp: 1000 },
      { id: '2', sender: 'companio', content: 'Hello!', timestamp: 1001, status: 'info' }
    ]),
    []
  );
});

test('derives deduplicated recency-ordered suggestions and filters sensitive/failed items', () => {
  const now = 1_700_000_000_000;
  const messages = [
    { id: 'm1', sender: 'user', content: 'Open Notepad', timestamp: now + 100 },
    { id: 'm2', sender: 'companio', content: 'Opened.', timestamp: now + 120, status: 'success' },
    { id: 'm3', sender: 'user', content: 'Empty the recycle bin', timestamp: now + 200 },
    { id: 'm4', sender: 'user', content: 'open notepad', timestamp: now + 300 },
    { id: 'm5', sender: 'user', content: 'Set volume to 35%', timestamp: now + 400 },
    { id: 'm6', sender: 'companio', content: 'Failed', timestamp: now + 410, status: 'error' },
    { id: 'm7', sender: 'user', content: 'Save apiKey sk-secret123456', timestamp: now + 500 },
    { id: 'm8', sender: 'user', content: 'Check battery status', timestamp: now + 600 },
    { id: 'm9', sender: 'companio', content: 'Battery 82%', timestamp: now + 610, status: 'success' },
    { id: 'm10', sender: 'user', content: 'Open Spotify', timestamp: now + 700 },
    { id: 'm11', sender: 'companio', content: 'Done', timestamp: now + 710, status: 'success' }
  ];
  assert.deepEqual(deriveHistorySuggestions(messages, 3), [
    'Open Spotify',
    'Check battery status',
    'open notepad'
  ]);
});
