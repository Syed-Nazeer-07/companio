'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');

const { ManagedLlmRuntime, allocateLoopbackPort, stripThinkingContent } = require('../electron/automation/managedLlmRuntime.cjs');

function createMockLlamaServerScript(dir) {
  const scriptPath = path.join(dir, 'mock-llama-server.cjs');
  const exeShimPath = path.join(dir, 'llama-server.exe');
  fs.writeFileSync(exeShimPath, 'MZ-mock');
  const script = `
    const http = require('node:http');
    const args = process.argv.slice(2);
    const getArg = (flag, fallback) => {
      const idx = args.indexOf(flag);
      return idx >= 0 && args[idx + 1] ? args[idx + 1] : fallback;
    };
    const port = Number(getArg('--port', '0'));
    const apiKey = getArg('--api-key', '');
    const server = http.createServer((req, res) => {
      if (req.headers.authorization !== 'Bearer ' + apiKey) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'unauthorized' }));
        return;
      }
      if (req.url === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok' }));
        return;
      }
      if (req.url === '/v1/chat/completions' && req.method === 'POST') {
        let body = '';
        req.on('data', (c) => { body += c; });
        req.on('end', () => {
          const parsed = JSON.parse(body || '{}');
          const userMsg = parsed.messages?.[parsed.messages.length - 1]?.content || '';
          if (userMsg.includes('__SLOW_ABORT__')) {
            res.writeHead(200, { 'Content-Type': 'text/event-stream' });
            res.write('data: {"choices":[{"delta":{"content":"Working"}}]}\\n\\n');
            setTimeout(() => {
              if (!res.destroyed) res.end('data: [DONE]\\n\\n');
            }, 4000);
            return;
          }
          if (parsed.stream) {
            res.writeHead(200, { 'Content-Type': 'text/event-stream' });
            res.write('data: {"choices":[{"delta":{"content":"Hello "}}]}\\n\\n');
            setTimeout(() => {
              res.write('data: {"choices":[{"delta":{"content":"Companio!"}}],"timings":{"predicted_per_second":42.5}}\\n\\n');
              res.end('data: [DONE]\\n\\n');
            }, 15);
            return;
          }
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            choices: [{ message: { content: 'OK' } }],
            usage: { completion_tokens: 1 },
            timings: { prompt_ms: 12, predicted_per_second: 50.0 }
          }));
        });
        return;
      }
      res.writeHead(404);
      res.end();
    });
    server.listen(port, '127.0.0.1');
    process.on('SIGTERM', () => server.close(() => process.exit(0)));
  `;
  fs.writeFileSync(scriptPath, script);
  return { scriptPath, exeShimPath };
}

test('allocateLoopbackPort returns an available ephemeral loopback port', async () => {
  const port = await allocateLoopbackPort();
  assert.equal(typeof port, 'number');
  assert.ok(port > 1024 && port < 65536);
});

test('ManagedLlmRuntime secures loopback server with Bearer token, streams tokens, cancels requests, and cleans up cleanly', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'companio-rt-'));
  const modelFile = path.join(tmp, 'dummy.gguf');
  fs.writeFileSync(modelFile, 'GGUF');
  const { scriptPath, exeShimPath } = createMockLlamaServerScript(tmp);

  const runtime = new ManagedLlmRuntime({
    startupTimeoutMs: 10000,
    inactivityUnloadMs: 60000,
    spawnImpl: (_exe, args, opts) => spawn(process.execPath, [scriptPath, ...args], opts)
  });

  try {
    const config = {
      modelId: 'test-model',
      modelPath: modelFile,
      executablePath: exeShimPath,
      backend: 'cpu'
    };

    const health = await runtime.verifyHealth(config);
    assert.equal(health.ok, true, `verifyHealth failed: ${health.error}`);
    assert.equal(health.verified, true);
    assert.equal(health.sample, 'OK');

    const status = runtime.getStatus();
    assert.equal(status.running, true);
    assert.ok(status.port > 1024);
    assert.equal(status.pid > 0, true);

    // Verify unauthenticated access to loopback port is rejected with HTTP 401
    const unauth = await fetch(`http://127.0.0.1:${status.port}/health`);
    assert.equal(unauth.status, 401);

    // Streaming token delivery + metrics
    const tokens = [];
    const streamed = await runtime.chat({ prompt: 'Say hello', stream: true }, (tok) => tokens.push(tok));
    assert.equal(streamed.success, true);
    assert.equal(streamed.reply, 'Hello Companio!');
    assert.deepEqual(tokens, ['Hello ', 'Companio!']);
    assert.equal(streamed.tokensPerSec, 42.5);

    // Request cancellation aborts in-flight stream cleanly
    const slowPromise = runtime.chat({ prompt: '__SLOW_ABORT__', stream: true });
    await new Promise((r) => setTimeout(r, 80));
    assert.equal(runtime.cancelActiveRequest(), true);
    const cancelledRes = await slowPromise;
    assert.equal(cancelledRes.success, false);
    assert.equal(cancelledRes.cancelled, true);

    // Dispose stops child process cleanly
    await runtime.dispose();
    assert.equal(runtime.getStatus().running, false);
  } finally {
    await runtime.dispose().catch(() => {});
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('stripThinkingContent removes <think> blocks cleanly and streaming suppresses partial tags', () => {
  assert.equal(stripThinkingContent('<think>\ninternal thoughts\n</think>\n\nHello there!'), 'Hello there!');
  assert.equal(stripThinkingContent('Hi! <think>unclosed reasoning'), 'Hi!');
  assert.equal(stripThinkingContent('<think>hidden</think>Vis', { streaming: true }), 'Vis');
  assert.equal(stripThinkingContent('<think>hidden</think>Hello <thi', { streaming: true }), 'Hello ');
});

test('disableThinking config passes chat_template_kwargs.enable_thinking=false and strips <think> SSE chunks', async () => {
  let capturedBody = null;
  const fakeChild = {
    pid: 424242,
    exitCode: null,
    killed: false,
    stdout: { on() {} },
    stderr: { on() {} },
    on() {},
    once(ev, cb) { if (ev === 'exit') setTimeout(cb, 5); },
    kill() { this.exitCode = 0; }
  };
  const sseChunks = [
    'data: {"choices":[{"delta":{"content":"<thi"}}]}\n\n',
    'data: {"choices":[{"delta":{"content":"nk>secret reasoning"}}]}\n\n',
    'data: {"choices":[{"delta":{"content":"</think>Clean answer!"}}],"timings":{"predicted_per_second":80}}\n\n',
    'data: [DONE]\n\n'
  ];
  let idx = 0;
  const runtime = new ManagedLlmRuntime({
    portAllocator: async () => 54321,
    spawnImpl: () => fakeChild,
    fetchImpl: async (url, init) => {
      if (url.endsWith('/health')) return { ok: true, status: 200, json: async () => ({ status: 'ok' }) };
      capturedBody = JSON.parse(init.body);
      return {
        ok: true,
        status: 200,
        body: {
          getReader: () => ({
            read: async () => {
              if (idx >= sseChunks.length) return { done: true, value: undefined };
              return { done: false, value: new TextEncoder().encode(sseChunks[idx++]) };
            }
          })
        }
      };
    }
  });
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'companio-think-'));
  const exe = path.join(tmp, 'llama-server.exe');
  const mod = path.join(tmp, 'model.gguf');
  fs.writeFileSync(exe, 'MZ');
  fs.writeFileSync(mod, 'GGUF');
  try {
    await runtime.ensureStarted({
      modelId: 'qwen3-0.6b',
      executablePath: exe,
      modelPath: mod,
      backend: 'cpu',
      disableThinking: true,
      jinja: true
    });
    const tokens = [];
    const res = await runtime.chat({ prompt: 'Hello', stream: true }, (tok) => tokens.push(tok));
    assert.equal(res.success, true);
    assert.equal(capturedBody.chat_template_kwargs?.enable_thinking, false);
    assert.equal(res.reply, 'Clean answer!');
    assert.equal(tokens.join(''), 'Clean answer!');
  } finally {
    await runtime.dispose().catch(() => {});
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('explicit stream: false disables SSE streaming even when an onToken callback is provided', async () => {
  let capturedBody = null;
  const fakeChild = {
    pid: 424243,
    exitCode: null,
    killed: false,
    stdout: { on() {} },
    stderr: { on() {} },
    on() {},
    once(ev, cb) { if (ev === 'exit') setTimeout(cb, 5); },
    kill() { this.exitCode = 0; }
  };
  const runtime = new ManagedLlmRuntime({
    portAllocator: async () => 54322,
    spawnImpl: () => fakeChild,
    fetchImpl: async (url, init) => {
      if (url.endsWith('/health')) return { ok: true, status: 200, json: async () => ({ status: 'ok' }) };
      capturedBody = JSON.parse(init.body);
      return {
        ok: true,
        status: 200,
        json: async () => ({
          choices: [{ message: { content: 'Non-stream reply' } }],
          timings: { predicted_per_second: 60 }
        })
      };
    }
  });
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'companio-nostream-'));
  const exe = path.join(tmp, 'llama-server.exe');
  const mod = path.join(tmp, 'model.gguf');
  fs.writeFileSync(exe, 'MZ');
  fs.writeFileSync(mod, 'GGUF');
  try {
    await runtime.ensureStarted({
      modelId: 'qwen2.5-1.5b',
      executablePath: exe,
      modelPath: mod,
      backend: 'cpu'
    });
    const tokens = [];
    const res = await runtime.chat({ prompt: 'Hello', stream: false }, (tok) => tokens.push(tok));
    assert.equal(res.success, true);
    assert.equal(capturedBody.stream, false);
    assert.equal(res.reply, 'Non-stream reply');
  } finally {
    await runtime.dispose().catch(() => {});
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('request timeout stops hung slot and transparently recycles server on next chat without manual stop override', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'companio-recycle-'));
  const exe = path.join(tmp, 'llama-server.exe');
  const mod = path.join(tmp, 'model.gguf');
  fs.writeFileSync(exe, 'MZ');
  fs.writeFileSync(mod, 'GGUF');
  let spawns = 0;
  let kills = 0;
  let portSeed = 55320;
  const runtime = new ManagedLlmRuntime({
    portAllocator: async () => ++portSeed,
    requestTimeoutMs: 60,
    spawnImpl: () => {
      spawns += 1;
      const proc = {
        pid: 515100 + spawns,
        exitCode: null,
        killed: false,
        stdout: { on() {} },
        stderr: { on() {} },
        exitCb: null,
        on(ev, cb) { if (ev === 'exit') this.onExit = cb; },
        once(ev, cb) { if (ev === 'exit') this.exitCb = cb; },
        kill() {
          kills += 1;
          this.exitCode = 0;
          if (this.exitCb) this.exitCb();
          if (this.onExit) this.onExit();
        }
      };
      return proc;
    },
    fetchImpl: async (url, init) => {
      if (url.endsWith('/health')) return { ok: true, status: 200, json: async () => ({ status: 'ok' }) };
      const body = JSON.parse(init.body || '{}');
      const prompt = body.messages?.[body.messages.length - 1]?.content || '';
      if (prompt === 'hang') {
        return new Promise((_resolve, reject) => {
          init.signal?.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
        });
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({
          choices: [{ message: { content: 'Recovered ok' } }],
          timings: { predicted_per_second: 55 }
        })
      };
    }
  });

  try {
    await runtime.ensureStarted({
      modelId: 'qwen2.5-1.5b',
      executablePath: exe,
      modelPath: mod,
      backend: 'cpu'
    });
    assert.equal(spawns, 1);

    const timedOut = await runtime.chat({ prompt: 'hang', stream: false });
    assert.equal(timedOut.success, false);
    assert.match(timedOut.error, /timed out/i);
    assert.equal(kills, 1);
    assert.equal(runtime.getStatus().running, false);

    // Next chat automatically respawns server cleanly even without runtimeConfig passed
    const recovered = await runtime.chat({ prompt: 'Hello again', stream: false });
    assert.equal(recovered.success, true);
    assert.equal(recovered.reply, 'Recovered ok');
    assert.equal(spawns, 2);

    // Explicit manual stop disables auto-restart without runtimeConfig
    await runtime.stop();
    const afterManualStop = await runtime.chat({ prompt: 'After stop', stream: false });
    assert.equal(afterManualStop.success, false);
    assert.match(afterManualStop.error, /not running/i);
  } finally {
    await runtime.dispose().catch(() => {});
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});
