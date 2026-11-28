'use strict';

const fs = require('node:fs');
const path = require('node:path');
const net = require('node:net');
const os = require('node:os');
const crypto = require('node:crypto');
const { spawn, execFileSync } = require('node:child_process');

const LLAMA_CPP_VERSION = 'b12818';
const LLAMA_CPP_LICENSE = 'MIT';

const RUNTIME_VARIANTS = Object.freeze({
  'arm64-cpu': Object.freeze({
    id: 'arm64-cpu',
    arch: 'arm64',
    backend: 'cpu',
    label: 'llama.cpp Windows ARM64 (CPU)',
    version: LLAMA_CPP_VERSION,
    license: LLAMA_CPP_LICENSE,
    file: `llama-${LLAMA_CPP_VERSION}-bin-win-cpu-arm64.zip`,
    sizeBytes: 13441000,
    sizeDisplay: '12.8 MB',
    url: `https://github.com/ggml-org/llama.cpp/releases/download/${LLAMA_CPP_VERSION}/llama-${LLAMA_CPP_VERSION}-bin-win-cpu-arm64.zip`,
    sha256: '780f986ec6b60c35b38971df919f901bb98d622b2c5709fcbbf47c281673f596'
  }),
  'arm64-opencl': Object.freeze({
    id: 'arm64-opencl',
    arch: 'arm64',
    backend: 'opencl',
    label: 'llama.cpp Windows ARM64 (Snapdragon Adreno OpenCL)',
    version: LLAMA_CPP_VERSION,
    license: LLAMA_CPP_LICENSE,
    file: `llama-${LLAMA_CPP_VERSION}-bin-win-opencl-adreno-arm64.zip`,
    sizeBytes: 14470000,
    sizeDisplay: '13.8 MB',
    url: `https://github.com/ggml-org/llama.cpp/releases/download/${LLAMA_CPP_VERSION}/llama-${LLAMA_CPP_VERSION}-bin-win-opencl-adreno-arm64.zip`,
    sha256: '649601ab11065509ef4118e9ae7dd1aab41b08db31d58c18033a6cec12931d37'
  }),
  'x64-cpu': Object.freeze({
    id: 'x64-cpu',
    arch: 'x64',
    backend: 'cpu',
    label: 'llama.cpp Windows x64 (CPU)',
    version: LLAMA_CPP_VERSION,
    license: LLAMA_CPP_LICENSE,
    file: `llama-${LLAMA_CPP_VERSION}-bin-win-cpu-x64.zip`,
    sizeBytes: 25375000,
    sizeDisplay: '24.2 MB',
    url: `https://github.com/ggml-org/llama.cpp/releases/download/${LLAMA_CPP_VERSION}/llama-${LLAMA_CPP_VERSION}-bin-win-cpu-x64.zip`,
    sha256: 'cc1e850be7b46be0e1e425c7c6df7eb2608970748862fd120611a1cd263e9d94'
  }),
  'x64-vulkan': Object.freeze({
    id: 'x64-vulkan',
    arch: 'x64',
    backend: 'vulkan',
    label: 'llama.cpp Windows x64 (Vulkan GPU)',
    version: LLAMA_CPP_VERSION,
    license: LLAMA_CPP_LICENSE,
    file: `llama-${LLAMA_CPP_VERSION}-bin-win-vulkan-x64.zip`,
    sizeBytes: 39321000,
    sizeDisplay: '37.5 MB',
    url: `https://github.com/ggml-org/llama.cpp/releases/download/${LLAMA_CPP_VERSION}/llama-${LLAMA_CPP_VERSION}-bin-win-vulkan-x64.zip`,
    sha256: 'b4ae261e98b2d74a2fa2167175d5f5441a3219fb2592228d207223cb5e961982'
  })
});

function allocateLoopbackPort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      const port = typeof addr === 'object' && addr ? addr.port : 0;
      server.close((err) => {
        if (err) reject(err);
        else resolve(port);
      });
    });
  });
}

function defaultThreadCount(performanceMode = 'balanced') {
  const totalCores = Array.isArray(os.cpus()) && os.cpus().length > 0 ? os.cpus().length : 4;
  if (performanceMode === 'battery_saver') return Math.max(2, Math.min(4, Math.floor(totalCores / 2)));
  if (performanceMode === 'performance') return Math.max(4, totalCores - 1);
  return Math.max(4, Math.min(8, Math.max(4, totalCores - 2)));
}

function defaultInactivityMs(performanceMode = 'balanced') {
  if (performanceMode === 'battery_saver') return 5 * 60 * 1000;
  if (performanceMode === 'performance') return 20 * 60 * 1000;
  return 10 * 60 * 1000;
}

/**
 * Removes Qwen3/reasoning `<think>...</think>` blocks (and any unclosed `<think>` tail)
 * from local inference output. When `streaming: true`, holds back any trailing partial
 * `<think...` tag prefix until complete so raw tags never flash in the UI.
 */
function stripThinkingContent(text, { streaming = false } = {}) {
  if (typeof text !== 'string' || !text) return '';
  let out = text.replace(/<think\b[^>]*>[\s\S]*?<\/think>/gi, '');
  const openMatch = /<think\b[^>]*>/i.exec(out);
  if (openMatch) {
    out = out.slice(0, openMatch.index);
  } else if (streaming) {
    const partialIdx = out.lastIndexOf('<');
    if (partialIdx !== -1 && partialIdx >= out.length - 8) {
      const tail = out.slice(partialIdx).toLowerCase();
      if ('<think>'.startsWith(tail) || '</think>'.startsWith(tail)) {
        out = out.slice(0, partialIdx);
      }
    }
  }
  return streaming ? out.replace(/^\s+/, '') : out.trim();
}

class ManagedLlmRuntime {
  constructor(options = {}) {
    this.fetchImpl = options.fetchImpl || globalThis.fetch;
    this.spawnImpl = options.spawnImpl || spawn;
    this.portAllocator = options.portAllocator || allocateLoopbackPort;
    this.startupTimeoutMs = options.startupTimeoutMs || 45000;
    this.requestTimeoutMs = options.requestTimeoutMs || 60000;
    this.performanceMode = options.performanceMode || 'balanced';
    this.inactivityUnloadMs =
      typeof options.inactivityUnloadMs === 'number'
        ? options.inactivityUnloadMs
        : defaultInactivityMs(this.performanceMode);

    this.child = null;
    this.port = null;
    this.token = null;
    this.activeConfig = null;
    this.startingPromise = null;
    this.stoppingPromise = null;
    this.activeRequestAbort = null;
    this.inactivityTimer = null;
    this.stderrTail = '';
    this.lastUsedAt = null;
    this.crashCount = 0;
    this.disposed = false;
  }

  getStatus() {
    const running = Boolean(this.child && this.child.exitCode === null && !this.child.killed);
    return {
      running,
      starting: Boolean(this.startingPromise),
      pid: running ? this.child.pid : null,
      port: running ? this.port : null,
      modelId: this.activeConfig?.modelId || null,
      modelPath: this.activeConfig?.modelPath || null,
      backend: this.activeConfig?.backend || null,
      performanceMode: this.performanceMode,
      lastUsedAt: this.lastUsedAt,
      inactivityUnloadMs: this.inactivityUnloadMs
    };
  }

  setPerformanceMode(mode) {
    if (!['battery_saver', 'balanced', 'performance'].includes(mode)) return;
    this.performanceMode = mode;
    this.inactivityUnloadMs = defaultInactivityMs(mode);
    this.#resetInactivityTimer();
  }

  #resetInactivityTimer() {
    if (this.inactivityTimer) {
      clearTimeout(this.inactivityTimer);
      this.inactivityTimer = null;
    }
    if (!this.child || this.inactivityUnloadMs <= 0) return;
    this.inactivityTimer = setTimeout(() => {
      if (!this.activeRequestAbort) {
        void this.stop('inactivity');
      } else {
        this.#resetInactivityTimer();
      }
    }, this.inactivityUnloadMs);
    if (typeof this.inactivityTimer.unref === 'function') {
      this.inactivityTimer.unref();
    }
  }

  async ensureStarted(config) {
    if (this.disposed) {
      throw new Error('Local inference runtime has been shut down.');
    }
    if (!config || typeof config.executablePath !== 'string' || typeof config.modelPath !== 'string') {
      throw new Error('Executable path and model path are required.');
    }
    if (!fs.existsSync(config.executablePath)) {
      throw new Error(`Managed inference binary not found: ${config.executablePath}`);
    }
    if (!fs.existsSync(config.modelPath)) {
      throw new Error(`Managed model file not found: ${config.modelPath}`);
    }

    if (
      this.child &&
      this.child.exitCode === null &&
      this.activeConfig &&
      this.activeConfig.modelPath === config.modelPath &&
      this.activeConfig.executablePath === config.executablePath &&
      (this.activeConfig.backend || 'cpu') === (config.backend || 'cpu') &&
      Boolean(this.activeConfig.disableThinking) === Boolean(config.disableThinking)
    ) {
      this.#resetInactivityTimer();
      return this.getStatus();
    }

    if (this.startingPromise) {
      await this.startingPromise;
      return this.ensureStarted(config);
    }

    this.startingPromise = (async () => {
      await this.stop('reconfigure');
      await this.#startProcess(config);
    })();

    try {
      await this.startingPromise;
      return this.getStatus();
    } finally {
      this.startingPromise = null;
    }
  }

  async #startProcess(config) {
    const port = await this.portAllocator();
    const token = crypto.randomBytes(32).toString('hex');
    const backend = config.backend || 'cpu';
    const threads = Number.isInteger(config.threads)
      ? config.threads
      : defaultThreadCount(this.performanceMode);
    const ctxSize = Number.isInteger(config.ctxSize)
      ? config.ctxSize
      : this.performanceMode === 'battery_saver'
        ? 1536
        : 2048;
    const gpuLayers = backend === 'cpu' ? 0 : (Number.isInteger(config.gpuLayers) ? config.gpuLayers : 99);

    const args = [
      '--host', '127.0.0.1',
      '--port', String(port),
      '--api-key', token,
      '--model', config.modelPath,
      '--ctx-size', String(ctxSize),
      '--threads', String(threads),
      '--parallel', '1',
      '--batch-size', '512',
      '--n-gpu-layers', String(gpuLayers),
      '--no-webui'
    ];
    if (config.disableThinking) {
      args.push('--reasoning-budget', '0');
    }
    if (config.jinja === true) {
      args.push('--jinja');
    }

    this.stderrTail = '';
    const child = this.spawnImpl(config.executablePath, args, {
      cwd: path.dirname(config.executablePath),
      windowsHide: true,
      shell: false,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    this.child = child;
    this.port = port;
    this.token = token;
    this.activeConfig = {
      modelId: config.modelId || path.basename(config.modelPath),
      modelPath: config.modelPath,
      executablePath: config.executablePath,
      backend,
      ctxSize,
      threads,
      gpuLayers,
      disableThinking: Boolean(config.disableThinking),
      jinja: config.jinja === true
    };
    this.recoverableConfig = { ...this.activeConfig };

    const appendTail = (chunk) => {
      const text = String(chunk || '').split(token).join('[redacted]');
      this.stderrTail = (this.stderrTail + text).slice(-2500);
    };
    child.stdout?.on('data', appendTail);
    child.stderr?.on('data', appendTail);

    child.on('exit', () => {
      if (this.child === child) {
        this.child = null;
        this.port = null;
        this.token = null;
        if (this.inactivityTimer) {
          clearTimeout(this.inactivityTimer);
          this.inactivityTimer = null;
        }
      }
    });

    const deadline = Date.now() + this.startupTimeoutMs;
    let lastHealthErr = null;
    while (Date.now() < deadline) {
      if (this.child !== child || child.exitCode !== null) {
        throw new Error(
          `Managed llama-server exited early (code ${child.exitCode}): ${this.stderrTail.slice(-400).trim() || 'no output'}`
        );
      }
      try {
        const res = await this.fetchImpl(`http://127.0.0.1:${port}/health`, {
          method: 'GET',
          headers: { Authorization: `Bearer ${token}` },
          redirect: 'error'
        });
        if (res.ok) {
          const data = await res.json().catch(() => ({}));
          if (!data || data.status === 'ok' || res.status === 200) {
            this.lastUsedAt = Date.now();
            this.#resetInactivityTimer();
            return;
          }
        }
      } catch (err) {
        lastHealthErr = err;
      }
      await new Promise((r) => setTimeout(r, 200));
    }

    await this.stop('startup-timeout');
    throw new Error(
      `Managed local AI runtime failed to become ready within ${Math.round(this.startupTimeoutMs / 1000)}s.` +
      (lastHealthErr ? ` (${lastHealthErr.message})` : '') +
      (this.stderrTail ? ` Details: ${this.stderrTail.slice(-260).trim()}` : '')
    );
  }

  async verifyHealth(config) {
    const start = Date.now();
    try {
      await this.ensureStarted(config);
      const res = await this.chat({
        prompt: 'Reply with the single word OK.',
        systemPrompt: 'Respond tersely with OK.',
        maxTokens: 16,
        temperature: 0
      });
      if (!res.success || !res.reply) {
        return {
          ok: false,
          verified: false,
          error: res.error || 'Real inference health check returned empty output.',
          latencyMs: Date.now() - start
        };
      }
      return {
        ok: true,
        verified: true,
        modelId: this.activeConfig?.modelId,
        backend: this.activeConfig?.backend,
        latencyMs: Date.now() - start,
        ttftMs: res.ttftMs,
        tokensPerSec: res.tokensPerSec,
        sample: res.reply.slice(0, 60)
      };
    } catch (error) {
      return {
        ok: false,
        verified: false,
        error: error.message || 'Inference health check failed.',
        latencyMs: Date.now() - start
      };
    }
  }

  cancelActiveRequest() {
    if (this.activeRequestAbort && !this.activeRequestAbort.signal.aborted) {
      this.activeRequestAbort.abort();
      return true;
    }
    return false;
  }

  async chat(options = {}, onToken = null) {
    const attemptChat = async () => {
      if (!this.child || this.child.exitCode !== null || !this.port || !this.token) {
        const startConfig = options.runtimeConfig || (!this.disposed ? this.recoverableConfig : null);
        if (startConfig) {
          await this.ensureStarted(startConfig);
        } else {
          throw new Error('Local AI engine is not running.');
        }
      }

      this.#resetInactivityTimer();
      this.lastUsedAt = Date.now();

      const prompt = typeof options.prompt === 'string' ? options.prompt.trim() : '';
      if (!prompt || prompt.length > 6000) {
        throw new Error('Invalid prompt length for local inference.');
      }

      const systemPrompt =
        typeof options.systemPrompt === 'string' && options.systemPrompt.trim()
          ? options.systemPrompt.trim().slice(0, 3200)
          : 'You are Companio, a concise and helpful Windows desktop companion.';

      const history = Array.isArray(options.history) ? options.history.slice(-10) : [];
      const messages = [
        { role: 'system', content: systemPrompt },
        ...history
          .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
          .map((m) => ({ role: m.role, content: m.content.slice(0, 1200) })),
        { role: 'user', content: prompt }
      ];

      const temperature =
        typeof options.temperature === 'number' && Number.isFinite(options.temperature)
          ? Math.max(0, Math.min(2, options.temperature))
          : 0.4;
      const maxTokens =
        Number.isInteger(options.maxTokens) && options.maxTokens >= 8 && options.maxTokens <= 1024
          ? options.maxTokens
          : 256;
      const wantStream = options.stream === false ? false : Boolean(options.stream === true || typeof onToken === 'function');

      const body = {
        messages,
        temperature,
        max_tokens: maxTokens,
        stream: wantStream
      };
      if (this.activeConfig?.disableThinking) {
        body.chat_template_kwargs = { enable_thinking: false };
      }
      if (options.responseFormat && typeof options.responseFormat === 'object') {
        body.response_format = options.responseFormat;
      } else if (options.jsonMode === true) {
        body.response_format = { type: 'json_object' };
      }

      const timeoutMs = Number.isInteger(options.timeoutMs) ? options.timeoutMs : this.requestTimeoutMs;
      const controller = new AbortController();
      this.activeRequestAbort = controller;
      let timedOut = false;
      const timer = setTimeout(() => {
        timedOut = true;
        controller.abort();
      }, timeoutMs);

      const t0 = Date.now();
      let ttftMs = null;
      let completionTokens = 0;

      try {
        const res = await this.fetchImpl(`http://127.0.0.1:${this.port}/v1/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.token}`
          },
          body: JSON.stringify(body),
          signal: controller.signal,
          redirect: 'error'
        });

        if (!res.ok) {
          const errText = await res.text().catch(() => '');
          throw new Error(`Managed local AI returned HTTP ${res.status}${errText ? ': ' + errText.slice(0, 160) : ''}`);
        }

        if (!wantStream) {
          const data = await res.json();
          const totalMs = Date.now() - t0;
          const raw = data?.choices?.[0]?.message?.content;
          const reply = typeof raw === 'string' ? stripThinkingContent(raw) : '';
          if (!reply) {
            throw new Error('Local AI returned an empty response.');
          }
          completionTokens = Number(data?.usage?.completion_tokens) || Math.max(1, Math.round(reply.length / 4));
          const serverPredMs = data?.timings?.predicted_ms;
          const serverPredPerSec = data?.timings?.predicted_per_second;
          const serverPromptMs = data?.timings?.prompt_ms;
          ttftMs = typeof serverPromptMs === 'number' ? Math.round(serverPromptMs) : totalMs;
          const tokensPerSec =
            typeof serverPredPerSec === 'number' && serverPredPerSec > 0
              ? Number(serverPredPerSec.toFixed(1))
              : Number(((completionTokens / Math.max(1, serverPredMs || totalMs)) * 1000).toFixed(1));
          return {
            success: true,
            reply,
            modelId: this.activeConfig?.modelId,
            backend: this.activeConfig?.backend,
            ttftMs,
            totalMs,
            completionTokens,
            tokensPerSec
          };
        }

        // Streaming SSE mode
        const reader = res.body?.getReader?.();
        if (!reader) {
          throw new Error('Streaming response body was unavailable.');
        }
        const decoder = new TextDecoder('utf-8');
        let buffer = '';
        let fullText = '';
        let emittedLen = 0;
        let genStart = null;
        let finalTimings = null;

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split(/\r?\n/);
          buffer = lines.pop() || '';
          for (const rawLine of lines) {
            const line = rawLine.trim();
            if (!line || !line.startsWith('data:')) continue;
            const payload = line.slice(5).trim();
            if (payload === '[DONE]') continue;
            let parsed;
            try { parsed = JSON.parse(payload); } catch { continue; }
            if (parsed?.timings) finalTimings = parsed.timings;
            const delta = parsed?.choices?.[0]?.delta?.content;
            if (typeof delta === 'string' && delta.length > 0) {
              completionTokens += 1;
              fullText += delta;
              const visible = stripThinkingContent(fullText, { streaming: true });
              if (visible.length > emittedLen) {
                if (ttftMs === null) {
                  ttftMs = Date.now() - t0;
                  genStart = Date.now();
                }
                const chunk = visible.slice(emittedLen);
                emittedLen = visible.length;
                if (typeof onToken === 'function') {
                  try { onToken(chunk, visible); } catch {}
                }
              }
            }
          }
        }

        const totalMs = Date.now() - t0;
        const clean = stripThinkingContent(fullText);
        if (!clean) {
          throw new Error('Local AI stream completed without output.');
        }
        const genElapsedMs = Math.max(1, genStart ? Date.now() - genStart : totalMs);
        const tokensPerSec =
          typeof finalTimings?.predicted_per_second === 'number' && finalTimings.predicted_per_second > 0
            ? Number(finalTimings.predicted_per_second.toFixed(1))
            : Number(((completionTokens / genElapsedMs) * 1000).toFixed(1));
        return {
          success: true,
          reply: clean,
          modelId: this.activeConfig?.modelId,
          backend: this.activeConfig?.backend,
          ttftMs: ttftMs ?? totalMs,
          totalMs,
          completionTokens,
          tokensPerSec
        };
      } catch (err) {
        if (controller.signal.aborted) {
          if (timedOut) {
            await this.stop('request-timeout').catch(() => {});
            const timeoutErr = new Error(`Local AI request timed out after ${Math.round(timeoutMs / 1000)}s.`);
            timeoutErr.timedOut = true;
            throw timeoutErr;
          }
          const cancelErr = new Error('Local AI generation cancelled.');
          cancelErr.cancelled = true;
          throw cancelErr;
        }
        throw err;
      } finally {
        clearTimeout(timer);
        if (this.activeRequestAbort === controller) {
          this.activeRequestAbort = null;
        }
        this.#resetInactivityTimer();
      }
    };

    try {
      return await attemptChat();
    } catch (error) {
      // One clean crash-recovery restart if llama-server died unexpectedly mid-session
      const recoveryConfig = options.runtimeConfig || (!this.disposed ? this.recoverableConfig : null);
      if (
        !error.cancelled &&
        !error.timedOut &&
        recoveryConfig &&
        !this.disposed &&
        (!this.child || this.child.exitCode !== null) &&
        this.crashCount < 2
      ) {
        this.crashCount += 1;
        try {
          await this.ensureStarted(recoveryConfig);
          return await attemptChat();
        } catch (retryErr) {
          return {
            success: false,
            cancelled: Boolean(retryErr.cancelled),
            error: retryErr.message || 'Local AI crash recovery failed.'
          };
        }
      }
      return {
        success: false,
        cancelled: Boolean(error.cancelled),
        error: error.message || 'Local AI inference failed.'
      };
    }
  }

  async stop(reason = 'manual') {
    const keepRecovery = reason === 'request-timeout' || reason === 'crash' || reason === 'reconfigure' || reason === 'inactivity';
    if (!keepRecovery) {
      this.recoverableConfig = null;
    }
    if (this.stoppingPromise) return this.stoppingPromise;
    this.stoppingPromise = (async () => {
      this.cancelActiveRequest();
      if (this.inactivityTimer) {
        clearTimeout(this.inactivityTimer);
        this.inactivityTimer = null;
      }
      const proc = this.child;
      this.child = null;
      this.port = null;
      this.token = null;
      this.activeConfig = null;

      if (!proc || proc.exitCode !== null) return true;

      await new Promise((resolve) => {
        let done = false;
        const finish = () => {
          if (done) return;
          done = true;
          resolve();
        };
        proc.once('exit', finish);
        try { proc.kill(); } catch {}
        setTimeout(() => {
          if (proc.exitCode === null && process.platform === 'win32' && proc.pid) {
            try {
              execFileSync('taskkill.exe', ['/PID', String(proc.pid), '/T', '/F'], {
                windowsHide: true,
                stdio: 'ignore'
              });
            } catch {}
          }
          finish();
        }, 1200);
      });
      return true;
    })();

    try {
      return await this.stoppingPromise;
    } finally {
      this.stoppingPromise = null;
    }
  }

  async dispose() {
    this.disposed = true;
    await this.stop('dispose');
  }
}

module.exports = {
  LLAMA_CPP_VERSION,
  LLAMA_CPP_LICENSE,
  RUNTIME_VARIANTS,
  allocateLoopbackPort,
  defaultThreadCount,
  defaultInactivityMs,
  stripThinkingContent,
  ManagedLlmRuntime
};
