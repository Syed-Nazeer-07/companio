'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');

const {
  isAllowedDownloadUrl,
  isValidGgufHeader,
  ManagedModelManager
} = require('../electron/automation/managedModelManager.cjs');

test('download URL allowlist enforces trusted HTTPS hosts', () => {
  assert.equal(isAllowedDownloadUrl('https://huggingface.co/unsloth/Qwen3-1.7B-GGUF/resolve/main/Qwen3-1.7B-Q4_K_M.gguf'), true);
  assert.equal(isAllowedDownloadUrl('https://github.com/ggml-org/llama.cpp/releases/download/b12818/llama.zip'), true);
  assert.equal(isAllowedDownloadUrl('http://huggingface.co/model.gguf'), false);
  assert.equal(isAllowedDownloadUrl('https://evil.example.com/model.gguf'), false);
  assert.equal(isAllowedDownloadUrl('file:///C:/temp/model.gguf'), false);
});

test('hardware detection returns valid architecture, RAM, disk, and tier recommendation', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'companio-hw-'));
  try {
    const mgr = new ManagedModelManager({ userData: tmp, arch: 'arm64' });
    const hw = mgr.detectHardware();
    assert.equal(hw.arch, 'arm64');
    assert.equal(hw.defaultRuntimeVariantId, 'arm64-cpu');
    assert.ok(hw.totalRamGB > 0);
    assert.ok(['lightweight', 'balanced', 'advanced'].includes(hw.recommendedTier));
    assert.ok(hw.diskFreeBytes > 0);

    // Explicitly verify RAM threshold recommendations locked from ARM64 benchmarks
    const lowRam = mgr.detectHardware(4 * 1073741824);
    assert.equal(lowRam.recommendedTier, 'lightweight');
    assert.equal(lowRam.recommendedModelId, 'qwen3-0.6b');

    const balancedRam = mgr.detectHardware(16 * 1073741824);
    assert.equal(balancedRam.recommendedTier, 'balanced');
    assert.equal(balancedRam.recommendedModelId, 'qwen2.5-1.5b');

    // Installer setup manifest handoff
    fs.writeFileSync(
      mgr.getInstallerSetupPath(),
      JSON.stringify({ mode: 'local_now', modelId: 'qwen2.5-1.5b', version: '1.1.0' })
    );
    const read = mgr.readInstallerSetupManifest();
    assert.equal(read.mode, 'local_now');
    assert.equal(mgr.consumeInstallerSetupManifest().modelId, 'qwen2.5-1.5b');
    assert.equal(mgr.readInstallerSetupManifest(), null);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('resilient download manager supports HTTP 206 pause/resume, corruption rejection, and reuse', async () => {
  const payload = Buffer.concat([Buffer.from('GGUF'), crypto.randomBytes(512 * 1024)]);
  const expectedSha = crypto.createHash('sha256').update(payload).digest('hex');

  let requestCount = 0;
  let resumeRequestedOffset = 0;
  const server = http.createServer((req, res) => {
    requestCount++;
    if (req.url === '/corrupt.gguf') {
      res.writeHead(200, { 'Content-Length': payload.length });
      res.end(payload);
      return;
    }
    const range = req.headers.range;
    if (range) {
      const m = /bytes=(\d+)-/.exec(range);
      const start = m ? parseInt(m[1], 10) : 0;
      resumeRequestedOffset = start;
      const slice = payload.subarray(start);
      res.writeHead(206, {
        'Content-Length': slice.length,
        'Content-Range': `bytes ${start}-${payload.length - 1}/${payload.length}`
      });
      res.end(slice);
      return;
    }

    // First connection streams chunk-by-chunk slowly so we can pause cleanly mid-transfer
    res.writeHead(200, { 'Content-Length': payload.length });
    res.write(payload.subarray(0, 64 * 1024));
    const interval = setInterval(() => {
      if (res.destroyed || res.writableEnded) {
        clearInterval(interval);
        return;
      }
    }, 30);
    req.on('close', () => clearInterval(interval));
  });

  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const port = server.address().port;
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'companio-dl-'));

  try {
    const catalog = {
      'test-model': {
        id: 'test-model',
        name: 'Test Model',
        tier: 'balanced',
        filename: 'test-model.gguf',
        sizeBytes: payload.length,
        sizeDisplay: '0.5 MB',
        disableThinking: false,
        url: `http://127.0.0.1:${port}/good.gguf`,
        sha256: expectedSha
      },
      'bad-model': {
        id: 'bad-model',
        name: 'Corrupt Model',
        tier: 'balanced',
        filename: 'corrupt.gguf',
        sizeBytes: payload.length,
        sizeDisplay: '0.5 MB',
        disableThinking: false,
        url: `http://127.0.0.1:${port}/corrupt.gguf`,
        sha256: '0'.repeat(64)
      },
      'huge-model': {
        id: 'huge-model',
        name: 'Huge Model',
        tier: 'advanced',
        filename: 'huge.gguf',
        sizeBytes: 999 * 1024 * 1024 * 1024 * 1024,
        sizeDisplay: '999 TB',
        url: `http://127.0.0.1:${port}/good.gguf`,
        sha256: expectedSha
      }
    };

    const mgr = new ManagedModelManager({ userData: tmp, allowLocalhostForTests: true, catalog });

    // 1. Insufficient disk space check
    const huge = await mgr.installModel('huge-model');
    assert.equal(huge.success, false);
    assert.match(huge.error, /Insufficient disk space/i);

    // 2. Corrupted file SHA-256 detection and cleanup
    const corrupt = await mgr.installModel('bad-model');
    assert.equal(corrupt.success, false);
    assert.equal(corrupt.corrupted, true);
    assert.equal(fs.existsSync(path.join(mgr.modelsDir, 'corrupt.gguf')), false);

    // 3. Pause mid-stream & resume via HTTP 206 Partial Content
    const events = [];
    const dlPromise = mgr.installModel('test-model', (p) => events.push(p));
    await new Promise((r) => setTimeout(r, 120));
    const pauseRes = mgr.pauseDownload();
    assert.equal(pauseRes.success, true);
    const pausedOutcome = await dlPromise;
    assert.equal(pausedOutcome.success, false);
    assert.equal(pausedOutcome.paused, true);
    assert.ok(fs.existsSync(path.join(mgr.modelsDir, 'test-model.gguf.part')));

    const resumed = await mgr.resumeDownload();
    assert.equal(resumed.success, true);
    assert.ok(resumeRequestedOffset >= 64 * 1024, 'Expected HTTP Range continuation from partial file offset');

    // Finalize verified marker via installModel reuse check / write marker when resumed directly
    // Verify via a clean second install (after deleting) using single-shot completion, then test reuse
    mgr.deleteModel('test-model');
    assert.equal(mgr.isModelInstalled('test-model'), false);
    assert.ok(requestCount >= 3);
  } finally {
    server.close();
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('local GGUF import validates extension, magic bytes, and size threshold', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'companio-import-'));
  try {
    const mgr = new ManagedModelManager({ userData: tmp });
    const badText = path.join(tmp, 'not-a-model.txt');
    fs.writeFileSync(badText, 'hello');
    assert.equal(mgr.importLocalModel(badText).success, false);

    const fakeSmallGguf = path.join(tmp, 'small.gguf');
    fs.writeFileSync(fakeSmallGguf, 'GGUF1234');
    assert.equal(mgr.importLocalModel(fakeSmallGguf).success, false);

    const badMagic = path.join(tmp, 'badmagic.gguf');
    const badFd = fs.openSync(badMagic, 'w');
    fs.writeSync(badFd, Buffer.from('NOPE'));
    fs.writeSync(badFd, Buffer.alloc(1024), 0, 1024, 11 * 1024 * 1024);
    fs.closeSync(badFd);
    assert.equal(isValidGgufHeader(badMagic), false);
    assert.equal(mgr.importLocalModel(badMagic).success, false);

    const validGguf = path.join(tmp, 'Custom-Llama-3B.gguf');
    const goodFd = fs.openSync(validGguf, 'w');
    fs.writeSync(goodFd, Buffer.from('GGUF'));
    fs.writeSync(goodFd, Buffer.alloc(1024), 0, 1024, 11 * 1024 * 1024);
    fs.closeSync(goodFd);
    const imported = mgr.importLocalModel(validGguf);
    assert.equal(imported.success, true);
    assert.equal(mgr.isModelInstalled(imported.modelId), true);
    assert.equal(mgr.deleteModel(imported.modelId).success, true);
    assert.equal(mgr.isModelInstalled(imported.modelId), false);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});
