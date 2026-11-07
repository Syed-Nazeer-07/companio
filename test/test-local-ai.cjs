'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeEndpoint, listModels, chat, discoverLocalAi } = require('../electron/automation/localAiController.cjs');

test('local endpoints only accept loopback HTTP and a fixed /v1 route', () => {
  assert.equal(normalizeEndpoint(), 'http://127.0.0.1:11434/v1');
  assert.equal(normalizeEndpoint('http://localhost:1234/'), 'http://localhost:1234/v1');
  assert.equal(normalizeEndpoint('http://[::1]:11434/v1'), 'http://[::1]:11434/v1');
  for (const address of [
    'https://127.0.0.1:11434/v1',
    'http://example.com:11434/v1',
    'http://127.0.0.2:11434/v1',
    'http://user:pass@localhost:1234/v1',
    'http://localhost:1234/v1?token=secret',
    'http://localhost:1234/admin',
    'file:///etc/passwd',
    'http://localhost:1234/v1#fragment'
  ]) {
    assert.throws(() => normalizeEndpoint(address), undefined, address);
  }
});

test('model discovery calls selected local server, without contacting remote hosts', async () => {
  let requested;
  const result = await listModels({ endpoint: 'http://localhost:1234/v1' }, async (url, options) => {
    requested = { url, options };
    return { ok: true, json: async () => ({ data: [{ id: 'qwen-local' }, { id: 'qwen-local' }, { id: 'tiny' }] }) };
  });
  assert.deepEqual(result.models, ['qwen-local', 'tiny']);
  assert.equal(result.success, true);
  assert.equal(requested.url, 'http://localhost:1234/v1/models');
  assert.equal(requested.options.redirect, 'error');
});

test('chat sends a validated OpenAI-compatible request', async () => {
  let request;
  const result = await chat({
    endpoint: 'http://127.0.0.1:11434/v1',
    model: 'llama3.2:1b', prompt: 'Hello', temperature: 0.3
  }, async (url, options) => {
    request = { url, options };
    return { ok: true, json: async () => ({ choices: [{ message: { content: 'Hello from local AI' } }] }) };
  });
  assert.equal(result.success, true);
  assert.equal(result.reply, 'Hello from local AI');
  assert.equal(request.url, 'http://127.0.0.1:11434/v1/chat/completions');
  assert.equal(JSON.parse(request.options.body).messages[1].content, 'Hello');
  assert.equal(JSON.parse(request.options.body).stream, false);
});

test('chat rejects invalid payloads before any network call', async () => {
  let calls = 0;
  const fetchImpl = async () => { calls++; throw new Error('should not connect'); };
  for (const payload of [
    { endpoint: 'http://evil.example/v1', model: 'x', prompt: 'hello' },
    { endpoint: 'http://127.0.0.1:11434/v1', model: '', prompt: 'hello' },
    { endpoint: 'http://127.0.0.1:11434/v1', model: 'x', prompt: '' },
    { endpoint: 'http://127.0.0.1:11434/v1', model: 'x', prompt: 'hey', temperature: 99 },
    { endpoint: 'http://127.0.0.1:11434/v1', model: 'x', prompt: 'hey', systemPrompt: 'a'.repeat(2401) }
  ]) assert.equal((await chat(payload, fetchImpl)).success, false);
  assert.equal(calls, 0);
});

test('failed model calls return errors, never fabricated success', async () => {
  const unavailable = await chat({model: 'abc', prompt: 'hello'}, async () => { throw new TypeError('fetch failed'); });
  assert.equal(unavailable.success, false);
  assert.match(unavailable.error, /Cannot connect/);
  const missing = await chat({model: 'abc', prompt: 'hello'}, async () => ({
    ok: true, json: async () => ({ choices: [] })
  }));
  assert.equal(missing.success, false);
  assert.match(missing.error, /no text/);
  const invalid = await listModels({}, async () => ({ok: true, json: async () => ({})}));
  assert.equal(invalid.success, false);
});

test('discovery finds a running LM Studio model when Ollama is unavailable', async () => {
  const visited = [];
  const found = await discoverLocalAi({}, async (url, options) => {
    visited.push(url);
    assert.equal(options.redirect, 'error');
    if (url === 'http://127.0.0.1:1234/v1/models') {
      return { ok: true, json: async () => ({ data: [{ id: 'qwen2.5-1.5b' }] }) };
    }
    throw new TypeError('connection refused');
  });
  assert.equal(found.success, true);
  assert.equal(found.endpoint, 'http://127.0.0.1:1234/v1');
  assert.deepEqual(found.models, ['qwen2.5-1.5b']);
  assert.deepEqual(visited.sort(), [
    'http://127.0.0.1:11434/v1/models',
    'http://127.0.0.1:1234/v1/models'
  ]);
});

test('discovery prefers a model-ready server over a running but empty one', async () => {
  const result = await discoverLocalAi({}, async url => ({
    ok: true,
    json: async () => ({
      data: url.includes(':1234/') ? [{ id: 'local-ready' }] : []
    })
  }));
  assert.equal(result.success, true);
  assert.equal(result.endpoint, 'http://127.0.0.1:1234/v1');
  assert.deepEqual(result.models, ['local-ready']);
});

test('discovery never probes a non-loopback host or reports a fake connection', async () => {
  let calls = 0;
  const fetchImpl = async () => { calls++; throw new TypeError('connection refused'); };
  const invalid = await discoverLocalAi({ endpoint: 'http://remote.example/v1' }, fetchImpl);
  assert.equal(invalid.success, false);
  assert.equal(calls, 0);
  const absent = await discoverLocalAi({}, fetchImpl);
  assert.equal(absent.success, false);
  assert.deepEqual(absent.models, []);
  assert.equal(calls, 2);
});

test('discovery honors a custom safe loopback address before standard servers', async () => {
  const result = await discoverLocalAi({ endpoint: 'http://localhost:9876/v1' }, async url => {
    if (url.startsWith('http://localhost:9876/')) {
      return { ok: true, json: async () => ({ data: [{ id: 'custom-model' }] }) };
    }
    throw new TypeError('connection refused');
  });
  assert.equal(result.success, true);
  assert.equal(result.endpoint, 'http://localhost:9876/v1');
  assert.equal(result.checkedEndpoints, 3);
});
