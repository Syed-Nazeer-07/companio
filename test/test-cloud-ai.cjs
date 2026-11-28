'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { SecretStore } = require('../electron/automation/secretStore.cjs');
const {
  chatCloud,
  proposeCloudActions,
  testCloudConnection,
  validateCustomHttpsEndpoint,
  redactSecret
} = require('../electron/automation/cloudAiController.cjs');

function fakeSafeStorage(available = true) {
  return {
    isEncryptionAvailable: () => available,
    encryptString: text => Buffer.from('ENC:' + text, 'utf8'),
    decryptString: buf => {
      const s = buf.toString('utf8');
      if (!s.startsWith('ENC:')) throw new Error('Invalid cipher');
      return s.slice(4);
    }
  };
}

test('SecretStore encrypts keys via OS encryption, never returns raw keys in status, and fails closed when unavailable', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'companio-sec-'));
  try {
    const file = path.join(dir, 'companio_secrets_v1.json');
    const unavailable = new SecretStore({ filePath: file, safeStorageImpl: fakeSafeStorage(false) });
    assert.equal(unavailable.setKey('openai', 'sk-test-1234567890abcd').success, false);

    const store = new SecretStore({ filePath: file, safeStorageImpl: fakeSafeStorage(true) });
    assert.equal(store.setKey('openai', 'short').success, false);
    const saved = store.setKey('openai', 'sk-test-secret-9876');
    assert.equal(saved.success, true);
    assert.equal(saved.hint, '••••9876');

    const rawFile = fs.readFileSync(file, 'utf8');
    assert.ok(!rawFile.includes('sk-test-secret-9876'));

    const status = store.status();
    assert.equal(status.providers.openai.configured, true);
    assert.equal(status.providers.openai.hint, '••••9876');
    assert.ok(!JSON.stringify(status).includes('sk-test-secret-9876'));
    assert.equal(store.getKey('openai'), 'sk-test-secret-9876');

    assert.equal(store.clearKey('openai').configured, false);
    assert.equal(store.getKey('openai'), null);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('cloudAiController talks only to official endpoints, redacts secrets, and enforces allowlisted action proposals', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'companio-cloud-'));
  try {
    const store = new SecretStore({ filePath: path.join(dir, 's.json'), safeStorageImpl: fakeSafeStorage(true) });
    store.setKey('gemini', 'AIzaSyTestSecretKeyValue12345');

    let calledUrl = '';
    let calledHeaders = null;
    const reply = await chatCloud(
      { provider: 'gemini', prompt: 'Hello' },
      {
        secretStore: store,
        fetchImpl: async (url, opts) => {
          calledUrl = url;
          calledHeaders = opts.headers;
          assert.equal(opts.redirect, 'error');
          return {
            ok: true,
            json: async () => ({ candidates: [{ content: { parts: [{ text: 'Hello from Gemini!' }] } }] })
          };
        }
      }
    );
    assert.equal(reply.success, true);
    assert.match(calledUrl, /^https:\/\/generativelanguage\.googleapis\.com\/v1beta\/models\/gemini-2\.0-flash:generateContent$/);
    assert.equal(calledHeaders['x-goog-api-key'], 'AIzaSyTestSecretKeyValue12345');
    assert.ok(!calledUrl.includes('AIza'));

    const dangerousProposal = await proposeCloudActions(
      { provider: 'gemini', query: 'Check battery' },
      {
        secretStore: store,
        fetchImpl: async () => ({
          ok: true,
          json: async () => ({ candidates: [{ content: { parts: [{ text: '{"steps":[{"tool":"win.cmd.launch","params":{}}]}' }] } }] })
        })
      }
    );
    assert.equal(dangerousProposal.success, false);

    const safeProposal = await proposeCloudActions(
      { provider: 'gemini', query: 'Check my battery status' },
      {
        secretStore: store,
        fetchImpl: async () => ({
          ok: true,
          json: async () => ({ candidates: [{ content: { parts: [{ text: '{"steps":[{"tool":"win.battery.get","params":{}}]}' }] } }] })
        })
      }
    );
    assert.equal(safeProposal.success, true);
    assert.equal(safeProposal.requiresConfirmation, true);
    assert.equal(safeProposal.steps[0].tool, 'win.battery.get');

    assert.equal(redactSecret('Failed using sk-1234567890abcdef', 'sk-1234567890abcdef'), 'Failed using [redacted]');
    assert.equal(redactSecret('Bad gsk_1234567890abcdef', ''), 'Bad [redacted]');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('expanded cloud providers (Groq, OpenRouter, custom HTTPS) block SSRF and report diagnostics safely', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'companio-cloud-ext-'));
  try {
    const store = new SecretStore({ filePath: path.join(dir, 's.json'), safeStorageImpl: fakeSafeStorage(true) });
    assert.throws(() => validateCustomHttpsEndpoint('http://127.0.0.1:8080/v1'), /HTTPS/i);
    assert.throws(() => validateCustomHttpsEndpoint('https://192.168.1.10/v1'), /private network/i);
    assert.equal(validateCustomHttpsEndpoint('https://api.together.xyz/v1'), 'https://api.together.xyz/v1/chat/completions');

    assert.equal(store.setKey('groq', 'gsk_test_groq_key_123456').configured, true);
    assert.equal(store.setKey('openrouter', 'sk-or-test-key-123456').configured, true);
    assert.equal(store.setKey('custom_openai', 'sk-custom-key-1234567').configured, true);
    const allStatus = store.status();
    for (const p of ['openai', 'gemini', 'anthropic', 'groq', 'openrouter', 'custom_openai']) {
      assert.ok(Object.hasOwn(allStatus.providers, p), p);
    }

    const calls = [];
    const diag = await testCloudConnection(
      { provider: 'openrouter', model: 'openai/gpt-4o-mini' },
      {
        secretStore: store,
        fetchImpl: async (url, opts) => {
          calls.push({ url, headers: opts.headers });
          return {
            ok: true,
            json: async () => ({ choices: [{ message: { content: 'OK' } }] })
          };
        }
      }
    );
    assert.equal(diag.success, true);
    assert.equal(diag.reply, 'OK');
    assert.equal(calls[0].url, 'https://openrouter.ai/api/v1/chat/completions');
    assert.equal(calls[0].headers['HTTP-Referer'], 'https://companio7.vercel.app');

    const ssrfAttempt = await chatCloud(
      { provider: 'custom_openai', customEndpoint: 'https://10.0.0.5/v1', prompt: 'Hi' },
      { secretStore: store, fetchImpl: async () => { throw new Error('Should not be fetched'); } }
    );
    assert.equal(ssrfAttempt.success, false);
    assert.match(ssrfAttempt.error, /private network/i);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
