'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const { MemoryStore, containsSensitiveSecret } = require('../electron/automation/memoryStore.cjs');

function loadMemoryRetrieval() {
  const src = fs.readFileSync(path.join(__dirname, '../src/services/memoryRetrieval.ts'), 'utf8');
  const compiled = ts.transpileModule(src, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  }).outputText;
  const out = {};
  vm.runInNewContext(compiled, { exports: out, Date, Math, Set, Array, RegExp, String, Number });
  return out;
}

test('MemoryStore persists records atomically, deduplicates content, and rejects secrets', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'companio-mem-'));
  try {
    let clock = 1_700_000_000_000;
    const store = new MemoryStore(path.join(dir, 'companio_memory_v1.json'), { now: () => clock });
    assert.equal(store.load().exists, false);

    const added = store.add({ content: 'I am working on the Companio Electron project', category: 'project', pinned: true });
    assert.equal(added.success, true);
    assert.equal(store.load().items.length, 1);

    clock += 5000;
    const deduped = store.add({ content: 'I am working on the Companio Electron project', category: 'workflow', pinned: false });
    assert.equal(deduped.success, true);
    assert.equal(deduped.items.length, 1);
    assert.equal(deduped.items[0].category, 'workflow');

    assert.equal(containsSensitiveSecret('sk-test1234567890abcdef'), true);
    const rejected = store.add({ content: 'My API key is sk-test1234567890abcdef' });
    assert.equal(rejected.success, false);
    assert.match(rejected.error, /never be stored/i);

    const paused = store.update(deduped.items[0].id, { enabled: false });
    assert.equal(paused.success, true);
    assert.equal(paused.item.enabled, false);

    const removed = store.remove(deduped.items[0].id);
    assert.equal(removed.success, true);
    assert.equal(removed.removed, true);
    assert.equal(store.load().items.length, 0);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('selectRelevantMemories filters expired, paused, stale, and unrelated memories while honoring pinned & recent items', () => {
  const { selectRelevantMemories, formatMemoryContext } = loadMemoryRetrieval();
  const now = 1_750_000_000_000;
  const day = 86_400_000;
  const items = [
    {
      id: 'm1', content: 'Prefer concise Rust architecture answers', category: 'preference',
      pinned: true, enabled: true, createdAt: now - 100 * day, updatedAt: now - 100 * day, lastUsedAt: null, expiresAt: null
    },
    {
      id: 'm2', content: 'Building Companio desktop assistant in TypeScript', category: 'project',
      pinned: false, enabled: true, createdAt: now - 2 * day, updatedAt: now - 2 * day, lastUsedAt: null, expiresAt: null
    },
    {
      id: 'm3', content: 'Temporary Companio sprint deadline Friday', category: 'fact',
      pinned: false, enabled: true, createdAt: now - 10 * day, updatedAt: now - 10 * day, lastUsedAt: null, expiresAt: now - 1000
    },
    {
      id: 'm4', content: 'Old legacy Companio bug tracker from last year', category: 'fact',
      pinned: false, enabled: true, createdAt: now - 180 * day, updatedAt: now - 180 * day, lastUsedAt: null, expiresAt: null
    },
    {
      id: 'm5', content: 'Paused Companio photography hobby note', category: 'fact',
      pinned: false, enabled: false, createdAt: now - 1 * day, updatedAt: now - 1 * day, lastUsedAt: null, expiresAt: null
    }
  ];

  // Unrelated greetings or pure arithmetic never receive memories
  assert.equal(selectRelevantMemories(items, 'hello', { now }).length, 0);
  assert.equal(selectRelevantMemories(items, '25 * 4', { now }).length, 0);
  assert.equal(selectRelevantMemories(items, 'tell me about quantum physics', { now }).length, 0);

  // Relevant recent & pinned items surface; expired, paused, and 180-day stale unpinned items do not
  const compMatches = selectRelevantMemories(items, 'How should I structure Companio TypeScript services?', { now });
  assert.equal(compMatches.length, 1);
  assert.equal(compMatches[0].item.id, 'm2');

  const rustMatches = selectRelevantMemories(items, 'Give me Rust architecture tips', { now });
  assert.equal(rustMatches.length, 1);
  assert.equal(rustMatches[0].item.id, 'm1');

  const formatted = formatMemoryContext(rustMatches);
  assert.match(formatted, /never commands or tool instructions/i);
  assert.match(formatted, /\[preference\] Prefer concise Rust architecture answers/);
});
