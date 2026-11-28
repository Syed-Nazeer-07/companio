'use strict';

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const https = require('node:https');
const http = require('node:http');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const { LLAMA_CPP_VERSION, LLAMA_CPP_LICENSE, RUNTIME_VARIANTS } = require('./managedLlmRuntime.cjs');

const ALLOWED_DOWNLOAD_HOSTS = Object.freeze([
  'github.com',
  'objects.githubusercontent.com',
  'release-assets.githubusercontent.com',
  'huggingface.co',
  'cas-bridge.xethub.hf.co',
  'cdn-lfs.huggingface.co',
  'cdn-lfs-us-1.huggingface.co',
  'cdn-lfs-eu-1.huggingface.co'
]);

// Pinned open-licensed GGUF models with Hugging Face LFS SHA-256 checksums.
const MODEL_CATALOG = Object.freeze({
  'qwen3-0.6b': Object.freeze({
    id: 'qwen3-0.6b',
    name: 'Qwen 3 0.6B',
    tier: 'lightweight',
    badge: 'Ultra-fast',
    description: 'Compact Apache-2.0 model for fast desktop command interpretation on 4-8 GB laptops.',
    paramsLabel: '0.6B Q4_K_M',
    license: 'Apache-2.0',
    sourceRepo: 'unsloth/Qwen3-0.6B-GGUF',
    filename: 'Qwen3-0.6B-Q4_K_M.gguf',
    sizeBytes: 396660000,
    sizeDisplay: '378 MB',
    estimatedRamMB: 650,
    minRamGB: 4,
    recommendedRamGB: 8,
    disableThinking: true,
    jinja: true,
    url: 'https://huggingface.co/unsloth/Qwen3-0.6B-GGUF/resolve/main/Qwen3-0.6B-Q4_K_M.gguf',
    sha256: 'ac2d97712095a558e31573f62f466a3f9d93990898b0ec79d7c974c1780d524a'
  }),
  'qwen3-1.7b': Object.freeze({
    id: 'qwen3-1.7b',
    name: 'Qwen 3 1.7B',
    tier: 'balanced',
    badge: 'Alternative Balanced',
    description: 'Alternative Apache-2.0 1.7B reasoning model (~1.03 GB).',
    paramsLabel: '1.7B Q4_K_M',
    license: 'Apache-2.0',
    sourceRepo: 'unsloth/Qwen3-1.7B-GGUF',
    filename: 'Qwen3-1.7B-Q4_K_M.gguf',
    sizeBytes: 1107400000,
    sizeDisplay: '1.03 GB',
    estimatedRamMB: 1650,
    minRamGB: 8,
    recommendedRamGB: 16,
    disableThinking: true,
    jinja: true,
    url: 'https://huggingface.co/unsloth/Qwen3-1.7B-GGUF/resolve/main/Qwen3-1.7B-Q4_K_M.gguf',
    sha256: 'b139949c5bd74937ad8ed8c8cf3d9ffb1e99c866c823204dc42c0d91fa181897'
  }),
  'smollm2-1.7b': Object.freeze({
    id: 'smollm2-1.7b',
    name: 'SmolLM2 1.7B Instruct',
    tier: 'balanced',
    badge: 'Compact Balanced',
    description: 'HuggingFace Apache-2.0 1.7B instruction model tuned for lightweight everyday chat.',
    paramsLabel: '1.7B Q4_K_M',
    license: 'Apache-2.0',
    sourceRepo: 'bartowski/SmolLM2-1.7B-Instruct-GGUF',
    filename: 'SmolLM2-1.7B-Instruct-Q4_K_M.gguf',
    sizeBytes: 1055600000,
    sizeDisplay: '1.01 GB',
    estimatedRamMB: 1550,
    minRamGB: 8,
    recommendedRamGB: 16,
    disableThinking: false,
    jinja: true,
    url: 'https://huggingface.co/bartowski/SmolLM2-1.7B-Instruct-GGUF/resolve/main/SmolLM2-1.7B-Instruct-Q4_K_M.gguf',
    sha256: '77665ea4815999596525c636fbeb56ba8b080b46ae85efef4f0d986a139834d7'
  }),
  'qwen2.5-1.5b': Object.freeze({
    id: 'qwen2.5-1.5b',
    name: 'Qwen 2.5 1.5B Instruct',
    tier: 'balanced',
    badge: 'Recommended',
    description: 'Recommended default Apache-2.0 model: fast private offline chat & desktop command understanding verified on Windows ARM64/x64.',
    paramsLabel: '1.5B Q4_K_M',
    license: 'Apache-2.0',
    sourceRepo: 'Qwen/Qwen2.5-1.5B-Instruct-GGUF',
    filename: 'qwen2.5-1.5b-instruct-q4_k_m.gguf',
    sizeBytes: 1117320736,
    sizeDisplay: '1.04 GB',
    estimatedRamMB: 1600,
    minRamGB: 8,
    recommendedRamGB: 16,
    disableThinking: false,
    jinja: true,
    url: 'https://huggingface.co/Qwen/Qwen2.5-1.5B-Instruct-GGUF/resolve/main/qwen2.5-1.5b-instruct-q4_k_m.gguf',
    sha256: '6a1a2eb6d15622bf3c96857206351ba97e1af16c30d7a74ee38970e434e9407e'
  }),
  'qwen3-4b': Object.freeze({
    id: 'qwen3-4b',
    name: 'Qwen 3 4B',
    tier: 'advanced',
    badge: 'Advanced Quality',
    description: 'Higher-capacity 4B model for complex instructions on 16+ GB RAM devices.',
    paramsLabel: '4B Q4_K_M',
    license: 'Apache-2.0',
    sourceRepo: 'Qwen/Qwen3-4B-GGUF',
    filename: 'Qwen3-4B-Q4_K_M.gguf',
    sizeBytes: 2497300000,
    sizeDisplay: '2.33 GB',
    estimatedRamMB: 3400,
    minRamGB: 16,
    recommendedRamGB: 16,
    disableThinking: true,
    jinja: true,
    url: 'https://huggingface.co/Qwen/Qwen3-4B-GGUF/resolve/main/Qwen3-4B-Q4_K_M.gguf',
    sha256: '7485fe6f11af29433bc51cab58009521f205840f5b4ae3a32fa7f92e8534fdf5'
  })
});

function isAllowedDownloadUrl(rawUrl, allowLocalhostForTests = false) {
  let parsed;
  try { parsed = new URL(rawUrl); } catch { return false; }
  if (allowLocalhostForTests && parsed.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(parsed.hostname)) {
    return true;
  }
  if (parsed.protocol !== 'https:') return false;
  const host = parsed.hostname.toLowerCase();
  if (ALLOWED_DOWNLOAD_HOSTS.includes(host)) return true;
  if (host.endsWith('.hf.co') || host.endsWith('.githubusercontent.com')) return true;
  return false;
}

function sha256File(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', reject);
  });
}

function isValidGgufHeader(filePath) {
  let fd = null;
  try {
    fd = fs.openSync(filePath, 'r');
    const buf = Buffer.alloc(4);
    const bytesRead = fs.readSync(fd, buf, 0, 4, 0);
    return bytesRead === 4 && buf.toString('ascii') === 'GGUF';
  } catch {
    return false;
  } finally {
    if (fd !== null) try { fs.closeSync(fd); } catch {}
  }
}

function getDiskFreeBytes(targetDir) {
  try {
    const resolved = path.resolve(targetDir);
    let checkPath = resolved;
    while (!fs.existsSync(checkPath) && path.dirname(checkPath) !== checkPath) {
      checkPath = path.dirname(checkPath);
    }
    const stat = fs.statfsSync(checkPath);
    return Number(stat.bavail) * Number(stat.bsize);
  } catch {
    return null;
  }
}

function dirSizeBytes(dirPath) {
  if (!fs.existsSync(dirPath)) return 0;
  let total = 0;
  const stack = [dirPath];
  while (stack.length > 0) {
    const cur = stack.pop();
    let entries = [];
    try { entries = fs.readdirSync(cur, { withFileTypes: true }); } catch { continue; }
    for (const entry of entries) {
      const full = path.join(cur, entry.name);
      if (entry.isDirectory()) stack.push(full);
      else if (entry.isFile()) {
        try { total += fs.statSync(full).size; } catch {}
      }
    }
  }
  return total;
}

class ManagedModelManager {
  constructor({ userData, arch = process.arch, runtime = null, allowLocalhostForTests = false, catalog = MODEL_CATALOG } = {}) {
    if (!userData) throw new Error('ManagedModelManager requires userData path.');
    this.userData = userData;
    this.arch = arch === 'arm64' ? 'arm64' : 'x64';
    this.runtime = runtime;
    this.allowLocalhostForTests = Boolean(allowLocalhostForTests);
    this.catalog = catalog || MODEL_CATALOG;

    this.baseDir = path.join(userData, 'managed-ai');
    this.runtimeDir = path.join(this.baseDir, 'runtime');
    this.modelsDir = path.join(this.baseDir, 'models');
    this.configPath = path.join(this.baseDir, 'config.json');
    this.logPath = path.join(this.baseDir, 'install.log');

    this.activeTransfer = null;
    this.lastTransferRequest = null;
    this.defaultModelId = 'qwen2.5-1.5b';
  }

  getInstallerSetupPath() {
    return path.join(this.userData, 'installer-ai-setup.json');
  }

  readInstallerSetupManifest() {
    const manifestPath = this.getInstallerSetupPath();
    try {
      if (!fs.existsSync(manifestPath)) return null;
      const parsed = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
      return parsed;
    } catch {
      return null;
    }
  }

  consumeInstallerSetupManifest() {
    const manifestPath = this.getInstallerSetupPath();
    const manifest = this.readInstallerSetupManifest();
    if (manifest) {
      try { fs.unlinkSync(manifestPath); } catch {}
    }
    return manifest;
  }

  ensureDirs() {
    fs.mkdirSync(this.runtimeDir, { recursive: true });
    fs.mkdirSync(this.modelsDir, { recursive: true });
  }

  appendLog(line) {
    try {
      this.ensureDirs();
      const entry = `[${new Date().toISOString()}] ${String(line || '').trim()}\n`;
      fs.appendFileSync(this.logPath, entry, 'utf8');
    } catch {}
  }

  readInstallLog(maxLines = 80) {
    try {
      if (!fs.existsSync(this.logPath)) return [];
      const lines = fs.readFileSync(this.logPath, 'utf8').trim().split(/\r?\n/);
      return lines.slice(-maxLines);
    } catch {
      return [];
    }
  }

  readConfig() {
    try {
      if (fs.existsSync(this.configPath)) {
        const parsed = JSON.parse(fs.readFileSync(this.configPath, 'utf8'));
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed;
      }
    } catch {}
    return {
      activeModelId: null,
      preferredBackend: 'cpu',
      customModels: {},
      verifiedRuntimeVariant: null,
      lastHealthCheck: null
    };
  }

  writeConfig(patch) {
    this.ensureDirs();
    const next = { ...this.readConfig(), ...patch, updatedAt: new Date().toISOString() };
    const tmp = this.configPath + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(next, null, 2), 'utf8');
    fs.renameSync(tmp, this.configPath);
    return next;
  }

  setDefaultModelId(modelId) {
    if (this.catalog[modelId]) {
      this.defaultModelId = modelId;
    }
  }

  detectHardware(totalRamBytesOverride = null) {
    const cpus = os.cpus() || [];
    const cpuModel = cpus[0]?.model || 'Unknown CPU';
    const cpuCores = cpus.length || 1;
    const totalRamBytes = typeof totalRamBytesOverride === 'number' && Number.isFinite(totalRamBytesOverride) && totalRamBytesOverride > 0
      ? totalRamBytesOverride
      : os.totalmem();
    const freeRamBytes = os.freemem();
    const totalRamGB = Number((totalRamBytes / 1073741824).toFixed(1));
    const freeRamGB = Number((freeRamBytes / 1073741824).toFixed(1));
    const diskFreeBytes = getDiskFreeBytes(this.userData);
    const diskFreeGB = diskFreeBytes !== null ? Number((diskFreeBytes / 1073741824).toFixed(1)) : null;

    let recommendedTier = 'balanced';
    let recommendedModelId = this.defaultModelId;
    const notes = [];

    if (totalRamGB < 8) {
      recommendedTier = 'lightweight';
      recommendedModelId = 'qwen3-0.6b';
      notes.push(`Device has ${totalRamGB} GB RAM; Lightweight 0.6B recommended to keep desktop responsive.`);
    } else if (totalRamGB >= 16) {
      recommendedTier = 'balanced';
      recommendedModelId = this.defaultModelId;
      notes.push(`Device has ${totalRamGB} GB RAM; ${this.defaultModelId} recommended for fast desktop response with Advanced 4B (qwen3-4b) optional.`);
    } else {
      recommendedTier = 'balanced';
      recommendedModelId = this.defaultModelId;
      notes.push(`Device has ${totalRamGB} GB RAM; ${this.defaultModelId} balanced model fits comfortably in memory.`);
    }

    const defaultRuntimeVariantId = this.arch === 'arm64' ? 'arm64-cpu' : 'x64-cpu';
    if (this.arch === 'arm64') {
      notes.push('Native Windows ARM64 (Snapdragon / WoA) CPU runtime selected.');
    }

    return {
      arch: this.arch,
      cpuModel,
      cpuCores,
      totalRamBytes,
      freeRamBytes,
      totalRamGB,
      freeRamGB,
      diskFreeBytes,
      diskFreeGB,
      defaultRuntimeVariantId,
      recommendedTier,
      recommendedModelId,
      notes
    };
  }

  runtimeVariantFor(variantId) {
    const fallback = this.arch === 'arm64' ? 'arm64-cpu' : 'x64-cpu';
    return RUNTIME_VARIANTS[variantId] || RUNTIME_VARIANTS[fallback];
  }

  getRuntimeExecutablePath(variantId) {
    const variant = this.runtimeVariantFor(variantId);
    const variantDir = path.join(this.runtimeDir, variant.id);
    const candidate = path.join(variantDir, 'llama-server.exe');
    if (fs.existsSync(candidate)) return candidate;
    // Check one level deep in case archive had a subfolder
    if (fs.existsSync(variantDir)) {
      for (const entry of fs.readdirSync(variantDir, { withFileTypes: true })) {
        if (entry.isDirectory()) {
          const nested = path.join(variantDir, entry.name, 'llama-server.exe');
          if (fs.existsSync(nested)) return nested;
        }
      }
    }
    return null;
  }

  isRuntimeInstalled(variantId) {
    const variant = this.runtimeVariantFor(variantId);
    const exe = this.getRuntimeExecutablePath(variant.id);
    if (!exe) return false;
    const markerPath = path.join(this.runtimeDir, variant.id, '.verified.json');
    try {
      const marker = JSON.parse(fs.readFileSync(markerPath, 'utf8'));
      return marker.version === variant.version && marker.sha256 === variant.sha256;
    } catch {
      return false;
    }
  }

  getModelPath(modelId) {
    const catalog = this.catalog[modelId];
    if (catalog) return path.join(this.modelsDir, catalog.filename);
    const cfg = this.readConfig();
    const custom = cfg.customModels?.[modelId];
    return custom?.filePath || null;
  }

  isModelInstalled(modelId) {
    const catalog = this.catalog[modelId];
    if (catalog) {
      const filePath = path.join(this.modelsDir, catalog.filename);
      if (!fs.existsSync(filePath)) return false;
      try {
        const marker = JSON.parse(fs.readFileSync(filePath + '.verified.json', 'utf8'));
        const stat = fs.statSync(filePath);
        return (
          marker.sha256 === catalog.sha256 &&
          marker.fileSize === stat.size &&
          isValidGgufHeader(filePath)
        );
      } catch {
        return false;
      }
    }
    const cfg = this.readConfig();
    const custom = cfg.customModels?.[modelId];
    return Boolean(custom?.filePath && fs.existsSync(custom.filePath) && isValidGgufHeader(custom.filePath));
  }

  listModels() {
    const cfg = this.readConfig();
    const builtIn = Object.values(this.catalog).map((m) => {
      const filePath = path.join(this.modelsDir, m.filename);
      const partialPath = filePath + '.part';
      const installed = this.isModelInstalled(m.id);
      const partialBytes = fs.existsSync(partialPath) ? fs.statSync(partialPath).size : 0;
      return {
        ...m,
        custom: false,
        filePath,
        installed,
        partialBytes,
        active: cfg.activeModelId === m.id,
        recommended: m.id === this.defaultModelId
      };
    });

    const customList = Object.entries(cfg.customModels || {}).map(([id, item]) => ({
      id,
      name: item.name || id,
      tier: 'custom',
      badge: 'Imported',
      description: 'User-imported local GGUF model file.',
      paramsLabel: 'Local GGUF',
      license: 'User-supplied',
      filename: path.basename(item.filePath || ''),
      sizeBytes: item.sizeBytes || 0,
      sizeDisplay: item.sizeBytes ? `${(item.sizeBytes / 1048576).toFixed(0)} MB` : 'Unknown',
      disableThinking: Boolean(item.disableThinking),
      jinja: true,
      custom: true,
      filePath: item.filePath,
      installed: Boolean(item.filePath && fs.existsSync(item.filePath)),
      partialBytes: 0,
      active: cfg.activeModelId === id,
      recommended: false
    }));

    return [...builtIn, ...customList];
  }

  getStorageUsage() {
    this.ensureDirs();
    return {
      baseDir: this.baseDir,
      runtimeBytes: dirSizeBytes(this.runtimeDir),
      modelsBytes: dirSizeBytes(this.modelsDir),
      totalBytes: dirSizeBytes(this.baseDir),
      diskFreeBytes: getDiskFreeBytes(this.userData)
    };
  }

  getStatus() {
    const hardware = this.detectHardware();
    const cfg = this.readConfig();
    const defaultVariant = this.runtimeVariantFor(cfg.preferredBackend === 'opencl' && this.arch === 'arm64' ? 'arm64-opencl' : hardware.defaultRuntimeVariantId);
    const runtimeInstalled = this.isRuntimeInstalled(defaultVariant.id);
    const runtimeExecutable = this.getRuntimeExecutablePath(defaultVariant.id);
    const models = this.listModels();
    const activeModel = models.find((m) => m.id === cfg.activeModelId && m.installed) || null;
    const anyModelInstalled = models.some((m) => m.installed);

    return {
      ready: Boolean(runtimeInstalled && activeModel),
      runtimeInstalled,
      runtimeVersion: LLAMA_CPP_VERSION,
      runtimeLicense: LLAMA_CPP_LICENSE,
      runtimeVariant: defaultVariant,
      runtimeExecutable,
      activeModelId: activeModel ? activeModel.id : null,
      activeModel,
      anyModelInstalled,
      models,
      hardware,
      storage: this.getStorageUsage(),
      activeDownload: this.activeTransfer
        ? {
            id: this.activeTransfer.id,
            kind: this.activeTransfer.kind,
            paused: this.activeTransfer.paused,
            receivedBytes: this.activeTransfer.receivedBytes,
            totalBytes: this.activeTransfer.totalBytes
          }
        : null,
      lastHealthCheck: cfg.lastHealthCheck || null,
      installerSetup: this.readInstallerSetupManifest()
    };
  }

  getActiveRuntimeConfig() {
    const cfg = this.readConfig();
    const hardware = this.detectHardware();
    const variantId =
      cfg.preferredBackend === 'opencl' && this.arch === 'arm64' && this.isRuntimeInstalled('arm64-opencl')
        ? 'arm64-opencl'
        : hardware.defaultRuntimeVariantId;
    const executablePath = this.getRuntimeExecutablePath(variantId);
    const models = this.listModels();
    const active = models.find((m) => m.id === cfg.activeModelId && m.installed) || models.find((m) => m.installed);
    if (!executablePath || !active) return null;
    const variant = this.runtimeVariantFor(variantId);
    return {
      modelId: active.id,
      modelPath: active.filePath,
      executablePath,
      backend: variant.backend,
      disableThinking: Boolean(active.disableThinking),
      jinja: active.jinja !== false
    };
  }

  setActiveModel(modelId) {
    if (!this.isModelInstalled(modelId)) {
      return { success: false, error: `Model "${modelId}" is not installed or failed integrity check.` };
    }
    this.writeConfig({ activeModelId: modelId });
    this.appendLog(`Activated local model: ${modelId}`);
    return { success: true, activeModelId: modelId };
  }

  async #downloadFileResilient({ id, kind, url, targetPath, expectedSha256, expectedSizeBytes, onProgress }) {
    if (this.activeTransfer && !this.activeTransfer.paused) {
      throw new Error('Another AI component download is already in progress.');
    }
    if (!isAllowedDownloadUrl(url, this.allowLocalhostForTests)) {
      throw new Error(`Rejected untrusted download URL: ${url}`);
    }

    this.ensureDirs();
    const partPath = targetPath + '.part';
    const existingPartSize = fs.existsSync(partPath) ? fs.statSync(partPath).size : 0;

    // Check available disk space before starting or continuing a large download
    const freeBytes = getDiskFreeBytes(path.dirname(targetPath));
    const neededBytes = Math.max(0, (expectedSizeBytes || 0) - existingPartSize) + 256 * 1024 * 1024;
    if (freeBytes !== null && expectedSizeBytes && freeBytes < neededBytes) {
      const freeMB = (freeBytes / 1048576).toFixed(0);
      const needMB = (neededBytes / 1048576).toFixed(0);
      throw new Error(`Insufficient disk space: ${freeMB} MB free, need at least ${needMB} MB including headroom.`);
    }

    const transfer = {
      id,
      kind,
      url,
      targetPath,
      partPath,
      expectedSha256,
      expectedSizeBytes,
      onProgress,
      receivedBytes: existingPartSize,
      totalBytes: expectedSizeBytes || 0,
      paused: false,
      cancelled: false,
      discardOnCancel: false,
      req: null,
      stream: null
    };
    this.activeTransfer = transfer;
    this.lastTransferRequest = { id, kind, url, targetPath, expectedSha256, expectedSizeBytes, onProgress };

    const emit = (stage, extra = {}) => {
      if (typeof onProgress !== 'function') return;
      const total = transfer.totalBytes || expectedSizeBytes || 0;
      const percent = total > 0 ? Math.min(100, Math.round((transfer.receivedBytes / total) * 100)) : 0;
      try {
        onProgress({
          id,
          kind,
          stage,
          percent,
          receivedBytes: transfer.receivedBytes,
          totalBytes: total,
          paused: transfer.paused,
          ...extra
        });
      } catch {}
    };

    try {
      await new Promise((resolve, reject) => {
        const startedAt = Date.now();
        let bytesThisSession = 0;

        const cleanupStreams = () => {
          if (transfer.stream) {
            try { transfer.stream.end(); } catch {}
            transfer.stream = null;
          }
          transfer.req = null;
        };

        const fetchUrl = (currentUrl, redirects = 0) => {
          if (transfer.paused || transfer.cancelled) {
            cleanupStreams();
            const err = new Error(transfer.paused ? 'Download paused.' : 'Download cancelled.');
            err.paused = transfer.paused;
            err.cancelled = transfer.cancelled;
            return reject(err);
          }
          if (!isAllowedDownloadUrl(currentUrl, this.allowLocalhostForTests) || redirects > 8) {
            cleanupStreams();
            return reject(new Error('Download redirect rejected (untrusted host or too many redirects).'));
          }

          const parsed = new URL(currentUrl);
          const client = parsed.protocol === 'http:' ? http : https;
          const headers = { 'User-Agent': 'Companio-Desktop/1.1' };
          const resumeOffset = fs.existsSync(partPath) ? fs.statSync(partPath).size : 0;
          if (resumeOffset > 0) {
            headers.Range = `bytes=${resumeOffset}-`;
          }

          const req = client.get(parsed, { headers }, (res) => {
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
              res.resume();
              return fetchUrl(new URL(res.headers.location, parsed).toString(), redirects + 1);
            }

            if (res.statusCode === 416 && resumeOffset > 0 && expectedSizeBytes && resumeOffset >= expectedSizeBytes) {
              res.resume();
              return resolve();
            }

            if (res.statusCode !== 200 && res.statusCode !== 206) {
              res.resume();
              cleanupStreams();
              return reject(new Error(`Download failed with HTTP ${res.statusCode} ${res.statusMessage || ''}`.trim()));
            }

            const appending = res.statusCode === 206 && resumeOffset > 0;
            if (!appending && resumeOffset > 0) {
              // Server ignored Range; restart cleanly from byte 0
              transfer.receivedBytes = 0;
            } else {
              transfer.receivedBytes = appending ? resumeOffset : 0;
            }

            const contentLength = parseInt(res.headers['content-length'] || '', 10);
            if (Number.isFinite(contentLength) && contentLength > 0) {
              transfer.totalBytes = appending ? resumeOffset + contentLength : contentLength;
            }

            const stream = fs.createWriteStream(partPath, { flags: appending ? 'a' : 'w' });
            transfer.stream = stream;

            stream.on('error', (err) => {
              res.destroy();
              cleanupStreams();
              reject(err);
            });

            let lastEmitAt = 0;
            res.on('data', (chunk) => {
              if (transfer.paused || transfer.cancelled) {
                res.destroy();
                return;
              }
              transfer.receivedBytes += chunk.length;
              bytesThisSession += chunk.length;
              if (!stream.write(chunk)) {
                res.pause();
                stream.once('drain', () => res.resume());
              }
              const now = Date.now();
              if (now - lastEmitAt >= 180 || transfer.receivedBytes === transfer.totalBytes) {
                lastEmitAt = now;
                const elapsedSec = Math.max(0.1, (now - startedAt) / 1000);
                const speedBps = Math.round(bytesThisSession / elapsedSec);
                const remainingBytes = Math.max(0, (transfer.totalBytes || 0) - transfer.receivedBytes);
                const etaSeconds = speedBps > 0 ? Math.ceil(remainingBytes / speedBps) : null;
                emit('downloading', { speedBytesPerSec: speedBps, etaSeconds });
              }
            });

            res.on('end', () => {
              if (transfer.paused || transfer.cancelled) {
                stream.end(() => {
                  transfer.stream = null;
                  const err = new Error(transfer.paused ? 'Download paused.' : 'Download cancelled.');
                  err.paused = transfer.paused;
                  err.cancelled = transfer.cancelled;
                  reject(err);
                });
                return;
              }
              stream.end(() => {
                transfer.stream = null;
                if (transfer.totalBytes > 0 && transfer.receivedBytes < transfer.totalBytes) {
                  return reject(new Error('Connection interrupted before download completed.'));
                }
                resolve();
              });
            });

            res.on('error', (err) => {
              stream.end(() => {
                transfer.stream = null;
                if (transfer.paused) {
                  const pErr = new Error('Download paused.');
                  pErr.paused = true;
                  return reject(pErr);
                }
                if (transfer.cancelled) {
                  const cErr = new Error('Download cancelled.');
                  cErr.cancelled = true;
                  return reject(cErr);
                }
                reject(err);
              });
            });
          });

          req.setTimeout(35000, () => {
            req.destroy(new Error('Network connection timed out while downloading.'));
          });

          req.on('error', (err) => {
            cleanupStreams();
            if (transfer.paused) {
              const pErr = new Error('Download paused.');
              pErr.paused = true;
              return reject(pErr);
            }
            if (transfer.cancelled) {
              const cErr = new Error('Download cancelled.');
              cErr.cancelled = true;
              return reject(cErr);
            }
            reject(err);
          });

          transfer.req = req;
        };

        fetchUrl(url);
      });

      emit('verifying');
      const actualHash = await sha256File(partPath);
      if (expectedSha256 && actualHash.toLowerCase() !== expectedSha256.toLowerCase()) {
        try { fs.unlinkSync(partPath); } catch {}
        this.appendLog(`Checksum mismatch for ${id}: expected ${expectedSha256}, got ${actualHash}`);
        const err = new Error(`Integrity check failed for ${id} (SHA-256 mismatch). Corrupted file was removed.`);
        err.corrupted = true;
        throw err;
      }

      const finalSize = fs.statSync(partPath).size;
      if (fs.existsSync(targetPath)) fs.unlinkSync(targetPath);
      fs.renameSync(partPath, targetPath);
      this.appendLog(`Downloaded and SHA-256 verified ${id} (${finalSize} bytes)`);
      emit('verified', { receivedBytes: finalSize, totalBytes: finalSize });
      return { success: true, filePath: targetPath, fileSize: finalSize, sha256: actualHash };
    } catch (err) {
      if (err.cancelled && transfer.discardOnCancel) {
        try { fs.unlinkSync(partPath); } catch {}
      }
      throw err;
    } finally {
      if (this.activeTransfer === transfer && !transfer.paused) {
        this.activeTransfer = null;
      }
    }
  }

  pauseDownload() {
    if (!this.activeTransfer || this.activeTransfer.paused) {
      return { success: false, error: 'No active download to pause.' };
    }
    this.activeTransfer.paused = true;
    try { this.activeTransfer.req?.destroy(); } catch {}
    this.appendLog(`Paused download: ${this.activeTransfer.id}`);
    return {
      success: true,
      paused: true,
      id: this.activeTransfer.id,
      receivedBytes: this.activeTransfer.receivedBytes
    };
  }

  async resumeDownload() {
    const req = this.lastTransferRequest;
    if (!req) {
      return { success: false, error: 'Nothing to resume.' };
    }
    if (this.activeTransfer && !this.activeTransfer.paused) {
      return { success: false, error: 'Download is already running.' };
    }
    this.activeTransfer = null;
    this.appendLog(`Resuming download: ${req.id}`);
    return this.#downloadFileResilient(req);
  }

  cancelDownload({ discardPartial = false } = {}) {
    if (!this.activeTransfer) {
      return { success: false, cancelled: false, error: 'No download in progress.' };
    }
    const target = this.activeTransfer;
    target.paused = false;
    target.cancelled = true;
    target.discardOnCancel = discardPartial;
    try { target.req?.destroy(); } catch {}
    if (discardPartial) {
      try { fs.unlinkSync(target.partPath); } catch {}
    }
    this.activeTransfer = null;
    this.appendLog(`Cancelled download: ${target.id} (discardPartial=${discardPartial})`);
    return { success: true, cancelled: true, id: target.id };
  }

  async installRuntime(variantId, onProgress, { forceReinstall = false } = {}) {
    const hw = this.detectHardware();
    const targetVariant = this.runtimeVariantFor(variantId || hw.defaultRuntimeVariantId);
    const variantDir = path.join(this.runtimeDir, targetVariant.id);

    if (!forceReinstall && this.isRuntimeInstalled(targetVariant.id)) {
      const exe = this.getRuntimeExecutablePath(targetVariant.id);
      if (exe) {
        return { success: true, reused: true, variant: targetVariant, executablePath: exe };
      }
    }

    fs.mkdirSync(variantDir, { recursive: true });
    const zipPath = path.join(this.runtimeDir, targetVariant.file);

    try {
      await this.#downloadFileResilient({
        id: targetVariant.id,
        kind: 'runtime',
        url: targetVariant.url,
        targetPath: zipPath,
        expectedSha256: targetVariant.sha256,
        expectedSizeBytes: targetVariant.sizeBytes,
        onProgress
      });
    } catch (err) {
      return {
        success: false,
        paused: Boolean(err.paused),
        cancelled: Boolean(err.cancelled),
        corrupted: Boolean(err.corrupted),
        error: err.message || 'Runtime download failed.'
      };
    }

    if (typeof onProgress === 'function') {
      try {
        onProgress({
          id: targetVariant.id,
          kind: 'runtime',
          stage: 'extracting',
          percent: 100,
          receivedBytes: targetVariant.sizeBytes,
          totalBytes: targetVariant.sizeBytes
        });
      } catch {}
    }

    // Safely inspect & unpack archive via built-in Windows tar.exe
    const extractStage = variantDir + '.staging';
    try {
      fs.rmSync(extractStage, { recursive: true, force: true });
      fs.mkdirSync(extractStage, { recursive: true });
      const listing = execFileSync('tar.exe', ['-tf', zipPath], { encoding: 'utf8', windowsHide: true });
      for (const line of listing.split(/\r?\n/)) {
        const entry = line.trim();
        if (!entry) continue;
        if (entry.startsWith('/') || entry.startsWith('\\') || /^[a-zA-Z]:/.test(entry) || entry.split(/[\\/]/).includes('..')) {
          throw new Error(`Unsafe archive path rejected: ${entry}`);
        }
      }
      execFileSync('tar.exe', ['-xf', zipPath, '-C', extractStage], { windowsHide: true });
      fs.rmSync(variantDir, { recursive: true, force: true });
      fs.renameSync(extractStage, variantDir);
      try { fs.unlinkSync(zipPath); } catch {}

      const exe = this.getRuntimeExecutablePath(targetVariant.id);
      if (!exe) {
        throw new Error('Runtime archive did not contain llama-server.exe.');
      }
      fs.writeFileSync(
        path.join(variantDir, '.verified.json'),
        JSON.stringify({
          variantId: targetVariant.id,
          version: targetVariant.version,
          sha256: targetVariant.sha256,
          installedAt: new Date().toISOString()
        }, null, 2)
      );
      this.appendLog(`Installed runtime ${targetVariant.id} (${targetVariant.version})`);
      return { success: true, reused: false, variant: targetVariant, executablePath: exe };
    } catch (err) {
      fs.rmSync(extractStage, { recursive: true, force: true });
      this.appendLog(`Runtime extraction failed: ${err.message}`);
      return { success: false, error: err.message || 'Could not unpack local AI runtime.' };
    }
  }

  async installModel(modelId, onProgress, { forceReinstall = false } = {}) {
    const meta = this.catalog[modelId];
    if (!meta) {
      return { success: false, error: `Unknown managed model: ${modelId}` };
    }

    const targetPath = path.join(this.modelsDir, meta.filename);
    if (!forceReinstall && this.isModelInstalled(modelId)) {
      this.setActiveModel(modelId);
      return { success: true, reused: true, model: meta, filePath: targetPath };
    }

    try {
      const dl = await this.#downloadFileResilient({
        id: meta.id,
        kind: 'model',
        url: meta.url,
        targetPath,
        expectedSha256: meta.sha256,
        expectedSizeBytes: meta.sizeBytes,
        onProgress
      });

      if (!isValidGgufHeader(targetPath)) {
        try { fs.unlinkSync(targetPath); } catch {}
        return {
          success: false,
          corrupted: true,
          error: 'Downloaded file does not have a valid GGUF header.'
        };
      }

      fs.writeFileSync(
        targetPath + '.verified.json',
        JSON.stringify({
          modelId: meta.id,
          sha256: meta.sha256,
          fileSize: dl.fileSize,
          installedAt: new Date().toISOString()
        }, null, 2)
      );

      this.setActiveModel(meta.id);
      return { success: true, reused: false, model: meta, filePath: targetPath, fileSize: dl.fileSize };
    } catch (err) {
      return {
        success: false,
        paused: Boolean(err.paused),
        cancelled: Boolean(err.cancelled),
        corrupted: Boolean(err.corrupted),
        error: err.message || 'Model download failed.'
      };
    }
  }

  async installLocalAiBundle(options = {}, onProgress = null) {
    const hw = this.detectHardware();
    const modelId = options.modelId || hw.recommendedModelId || this.defaultModelId;
    const variantId = options.variantId || hw.defaultRuntimeVariantId;
    const forceReinstall = Boolean(options.forceReinstall);

    const runtimeResult = await this.installRuntime(variantId, onProgress, { forceReinstall });
    if (!runtimeResult.success) {
      return { success: false, stage: 'runtime', ...runtimeResult };
    }

    const modelResult = await this.installModel(modelId, onProgress, { forceReinstall });
    if (!modelResult.success) {
      return { success: false, stage: 'model', runtimeInstalled: true, ...modelResult };
    }

    let health = null;
    if (this.runtime && options.skipHealthCheck !== true) {
      if (typeof onProgress === 'function') {
        try {
          onProgress({ id: modelId, kind: 'health', stage: 'verifying_inference', percent: 100 });
        } catch {}
      }
      const runtimeCfg = this.getActiveRuntimeConfig();
      health = await this.runtime.verifyHealth(runtimeCfg);
      this.writeConfig({
        verifiedRuntimeVariant: runtimeResult.variant.id,
        lastHealthCheck: { ...health, checkedAt: new Date().toISOString() }
      });
      if (!health.ok) {
        this.appendLog(`Inference health check failed for ${modelId}: ${health.error}`);
        return {
          success: false,
          stage: 'health',
          runtimeInstalled: true,
          modelInstalled: true,
          health,
          error: health.error || 'Local AI installed but failed real inference health check.'
        };
      }
      this.appendLog(`Inference health check passed for ${modelId} (${health.latencyMs}ms)`);
    }

    return {
      success: true,
      reused: Boolean(runtimeResult.reused && modelResult.reused),
      variant: runtimeResult.variant,
      model: modelResult.model,
      health,
      status: this.getStatus()
    };
  }

  async repairModel(modelId, onProgress) {
    return this.installModel(modelId, onProgress, { forceReinstall: true });
  }

  deleteModel(modelId) {
    const cfg = this.readConfig();
    const catalog = this.catalog[modelId];
    if (catalog) {
      const targetPath = path.join(this.modelsDir, catalog.filename);
      try { fs.unlinkSync(targetPath); } catch {}
      try { fs.unlinkSync(targetPath + '.verified.json'); } catch {}
      try { fs.unlinkSync(targetPath + '.part'); } catch {}
      const patch = {};
      if (cfg.activeModelId === modelId) {
        const remaining = this.listModels().find((m) => m.id !== modelId && m.installed);
        patch.activeModelId = remaining ? remaining.id : null;
      }
      this.writeConfig(patch);
      this.appendLog(`Deleted model: ${modelId}`);
      return { success: true, activeModelId: patch.activeModelId ?? cfg.activeModelId };
    }

    if (cfg.customModels?.[modelId]) {
      const nextCustom = { ...cfg.customModels };
      delete nextCustom[modelId];
      const patch = { customModels: nextCustom };
      if (cfg.activeModelId === modelId) {
        const remaining = this.listModels().find((m) => m.id !== modelId && m.installed);
        patch.activeModelId = remaining ? remaining.id : null;
      }
      this.writeConfig(patch);
      this.appendLog(`Removed custom model registration: ${modelId}`);
      return { success: true, activeModelId: patch.activeModelId ?? cfg.activeModelId };
    }

    return { success: false, error: 'Model not found.' };
  }

  importLocalModel(sourcePath) {
    if (typeof sourcePath !== 'string' || !path.isAbsolute(sourcePath) || !fs.existsSync(sourcePath)) {
      return { success: false, error: 'Selected model file does not exist.' };
    }
    if (!sourcePath.toLowerCase().endsWith('.gguf')) {
      return { success: false, error: 'Only .gguf model files are supported.' };
    }
    const stat = fs.statSync(sourcePath);
    if (!stat.isFile() || stat.size < 10 * 1024 * 1024) {
      return { success: false, error: 'Selected GGUF file appears incomplete or too small.' };
    }
    if (!isValidGgufHeader(sourcePath)) {
      return { success: false, error: 'File is not a valid GGUF binary (header mismatch).' };
    }

    const base = path.basename(sourcePath, path.extname(sourcePath));
    const id = 'custom-' + base.toLowerCase().replace(/[^a-z0-9._-]+/g, '-').slice(0, 48);
    const cfg = this.readConfig();
    const customModels = {
      ...(cfg.customModels || {}),
      [id]: {
        name: base,
        filePath: sourcePath,
        sizeBytes: stat.size,
        disableThinking: /qwen3/i.test(base),
        importedAt: new Date().toISOString()
      }
    };
    this.writeConfig({ customModels, activeModelId: id });
    this.appendLog(`Imported local GGUF model ${base} (${sourcePath})`);
    return { success: true, modelId: id, activeModelId: id };
  }

  restoreRecommendedDefaults() {
    const hw = this.detectHardware();
    const models = this.listModels();
    const targetId = models.find((m) => m.id === hw.recommendedModelId && m.installed)?.id
      || models.find((m) => m.installed)?.id
      || null;
    this.writeConfig({
      preferredBackend: 'cpu',
      activeModelId: targetId
    });
    return { success: true, activeModelId: targetId, recommendedModelId: hw.recommendedModelId };
  }

  cleanupAllModels({ includeRuntime = true } = {}) {
    fs.rmSync(this.modelsDir, { recursive: true, force: true });
    if (includeRuntime) {
      fs.rmSync(this.runtimeDir, { recursive: true, force: true });
    }
    this.writeConfig({ activeModelId: null, customModels: {}, lastHealthCheck: null });
    return { success: true };
  }
}

module.exports = {
  MODEL_CATALOG,
  isAllowedDownloadUrl,
  isValidGgufHeader,
  sha256File,
  getDiskFreeBytes,
  ManagedModelManager
};
