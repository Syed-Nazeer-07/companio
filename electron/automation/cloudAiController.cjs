'use strict';

const { CLOUD_PROVIDERS } = require('./secretStore.cjs');
const { proposeActions } = require('./localActionPlanner.cjs');

const DEFAULT_MODELS = Object.freeze({
  openai: 'gpt-4o-mini',
  gemini: 'gemini-2.0-flash',
  anthropic: 'claude-3-5-haiku-latest',
  groq: 'llama-3.3-70b-versatile',
  openrouter: 'openai/gpt-4o-mini',
  custom_openai: 'gpt-4o-mini'
});

const OPENAI_COMPAT_ENDPOINTS = Object.freeze({
  openai: 'https://api.openai.com/v1/chat/completions',
  groq: 'https://api.groq.com/openai/v1/chat/completions',
  openrouter: 'https://openrouter.ai/api/v1/chat/completions'
});

function isPrivateOrLoopbackHost(hostname) {
  const host = String(hostname || '').toLowerCase().replace(/^\[|\]$/g, '');
  if (!host) return true;
  if (host === 'localhost' || host === '::1' || host === '0.0.0.0' || host.endsWith('.local') || host.endsWith('.internal')) {
    return true;
  }
  const m = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (m) {
    const [a, b] = [Number(m[1]), Number(m[2])];
    if (a === 127 || a === 10 || a === 0) return true;
    if (a === 169 && b === 254) return true;
    if (a === 192 && b === 168) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
  }
  if (/^(?:fc|fd|fe80):/i.test(host)) return true;
  return false;
}

/** Validates an HTTPS OpenAI-compatible base/endpoint URL and blocks local/private SSRF targets. */
function validateCustomHttpsEndpoint(raw) {
  const value = validateText(raw, 'custom endpoint URL', 300);
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error('Custom endpoint must be a valid HTTPS URL.');
  }
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password) {
    throw new Error('Custom endpoint must use HTTPS without embedded credentials.');
  }
  if (isPrivateOrLoopbackHost(parsed.hostname)) {
    throw new Error('Custom cloud endpoint cannot target localhost or private network addresses.');
  }
  const cleanPath = parsed.pathname.replace(/\/+$/, '');
  const fullPath = cleanPath.endsWith('/chat/completions')
    ? cleanPath
    : `${cleanPath || '/v1'}/chat/completions`;
  return `${parsed.origin}${fullPath}`;
}

function validateText(value, name, maxLength) {
  if (typeof value !== 'string' || !value.trim() || value.length > maxLength ||
      /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value)) {
    throw new Error('Invalid ' + name + '.');
  }
  return value.trim();
}

function redactSecret(message, apiKey) {
  let out = String(message || 'Cloud AI request failed.');
  if (apiKey && typeof apiKey === 'string') {
    out = out.split(apiKey).join('[redacted]');
  }
  return out.replace(/\b(?:gsk_[A-Za-z0-9_-]{8,}|sk-or-[A-Za-z0-9_-]{8,}|sk-[A-Za-z0-9_-]{8,}|AIza[A-Za-z0-9_-]{12,})\b/g, '[redacted]');
}

function validateHistory(history) {
  const arr = history ?? [];
  if (!Array.isArray(arr) || arr.length > 8) throw new Error('Invalid conversation history.');
  let total = 0;
  return arr.map(turn => {
    if (!turn || !['user', 'assistant'].includes(turn.role)) throw new Error('Invalid conversation role.');
    const content = validateText(turn.content, 'history message', 600);
    total += content.length;
    if (total > 2400) throw new Error('Conversation history exceeds limit.');
    return { role: turn.role, content };
  });
}

async function fetchCloudJson(url, options, timeoutMs, fetchImpl, apiKey) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(url, { ...options, signal: controller.signal, redirect: 'error' });
    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        throw new Error(`Cloud AI rejected authentication (HTTP ${response.status}). Check your stored API key.`);
      }
      if (response.status === 429) {
        throw new Error('Cloud AI rate limit reached (HTTP 429). Wait briefly or switch to Built-in/Local AI.');
      }
      throw new Error(`Cloud AI service returned HTTP ${response.status}.`);
    }
    return await response.json();
  } catch (error) {
    if (controller.signal.aborted || error?.name === 'AbortError') {
      throw new Error('Cloud AI request timed out after 45 seconds.');
    }
    if (error instanceof SyntaxError) throw new Error('Cloud AI returned invalid JSON.');
    if (error instanceof TypeError) throw new Error('Cannot reach cloud AI service. Check internet access or switch to offline mode.');
    throw new Error(redactSecret(error.message, apiKey));
  } finally {
    clearTimeout(timer);
  }
}

async function chatCloud(options = {}, { secretStore, fetchImpl = globalThis.fetch } = {}) {
  let apiKey = null;
  try {
    if (!options || typeof options !== 'object' || Array.isArray(options)) {
      throw new Error('Invalid cloud chat request.');
    }
    const provider = typeof options.provider === 'string' ? options.provider.trim().toLowerCase() : '';
    if (!CLOUD_PROVIDERS.includes(provider)) {
      throw new Error('Unsupported cloud AI provider.');
    }
    if (!secretStore || typeof secretStore.getKey !== 'function') {
      throw new Error('Encrypted credential store is unavailable.');
    }
    apiKey = secretStore.getKey(provider);
    if (!apiKey) {
      throw new Error(`No encrypted ${provider} API key configured. Save a key in AI Intelligence settings first.`);
    }
    const model = options.model && typeof options.model === 'string' && options.model.trim()
      ? validateText(options.model, 'model name', 120)
      : DEFAULT_MODELS[provider];
    const prompt = validateText(options.prompt, 'message', 4000);
    const systemPrompt = options.systemPrompt == null
      ? 'You are Companio, a helpful Windows desktop companion. Be concise and accurate. Do not claim to have performed a computer action.'
      : validateText(options.systemPrompt, 'system prompt', 2400);
    const turns = validateHistory(options.history);
    const temperature = options.temperature == null ? 0.7 : options.temperature;
    if (typeof temperature !== 'number' || !Number.isFinite(temperature) || temperature < 0 || temperature > 2) {
      throw new Error('Temperature must be between 0 and 2.');
    }
    const maxTokens = options.maxTokens == null ? 320 : options.maxTokens;
    if (!Number.isInteger(maxTokens) || maxTokens < 16 || maxTokens > 900) {
      throw new Error('maxTokens must be between 16 and 900.');
    }

    let reply = '';
    if (provider === 'openai' || provider === 'groq' || provider === 'openrouter' || provider === 'custom_openai') {
      const endpoint = provider === 'custom_openai'
        ? validateCustomHttpsEndpoint(options.customEndpoint || '')
        : OPENAI_COMPAT_ENDPOINTS[provider];
      const headers = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        ...(provider === 'openrouter'
          ? { 'HTTP-Referer': 'https://companio7.vercel.app', 'X-Title': 'Companio' }
          : {})
      };
      const body = {
        model,
        messages: [{ role: 'system', content: systemPrompt }, ...turns, { role: 'user', content: prompt }],
        temperature: Math.min(2, temperature),
        max_tokens: maxTokens,
        ...(options.jsonMode === true ? { response_format: { type: 'json_object' } } : {})
      };
      const data = await fetchCloudJson(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(body)
      }, 45000, fetchImpl, apiKey);
      reply = data?.choices?.[0]?.message?.content;
    } else if (provider === 'gemini') {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
      const contents = [
        ...turns.map(t => ({ role: t.role === 'assistant' ? 'model' : 'user', parts: [{ text: t.content }] })),
        { role: 'user', parts: [{ text: prompt }] }
      ];
      const data = await fetchCloudJson(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents,
          generationConfig: {
            temperature: Math.min(2, temperature),
            maxOutputTokens: maxTokens,
            ...(options.jsonMode === true ? { responseMimeType: 'application/json' } : {})
          }
        })
      }, 45000, fetchImpl, apiKey);
      reply = data?.candidates?.[0]?.content?.parts?.map(p => p?.text || '').join('');
    } else if (provider === 'anthropic') {
      const data = await fetchCloudJson('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model,
          system: systemPrompt,
          messages: [...turns, { role: 'user', content: prompt }],
          temperature: Math.min(1, temperature),
          max_tokens: maxTokens
        })
      }, 45000, fetchImpl, apiKey);
      reply = data?.content?.find(b => b?.type === 'text')?.text;
    }

    if (typeof reply !== 'string' || !reply.trim()) {
      throw new Error('Cloud AI returned an empty response.');
    }
    return { success: true, model, reply: reply.trim() };
  } catch (error) {
    return { success: false, error: redactSecret(error.message || 'Cloud AI failed.', apiKey) };
  }
}

async function proposeCloudActions(options = {}, { secretStore, fetchImpl = globalThis.fetch } = {}) {
  const provider = typeof options?.provider === 'string' ? options.provider.trim().toLowerCase() : '';
  if (!CLOUD_PROVIDERS.includes(provider)) {
    return { success: false, steps: [], error: 'Unsupported cloud AI provider.' };
  }
  return proposeActions(
    { ...options, allowRepair: options.allowRepair !== false, jsonMode: options.jsonMode !== false },
    chatOpts => chatCloud({ ...chatOpts, provider, customEndpoint: options.customEndpoint }, { secretStore, fetchImpl })
  );
}

/** Runs a lightweight live connectivity check against the configured cloud provider and measures latency. */
async function testCloudConnection(options = {}, deps = {}) {
  const provider = typeof options?.provider === 'string' ? options.provider.trim().toLowerCase() : '';
  const started = Date.now();
  const res = await chatCloud(
    {
      provider,
      model: options.model,
      customEndpoint: options.customEndpoint,
      prompt: 'Reply with OK.',
      systemPrompt: 'Respond with OK only.',
      temperature: 0,
      maxTokens: 16
    },
    deps
  );
  return {
    success: res.success,
    provider,
    model: res.model || options.model || DEFAULT_MODELS[provider] || '',
    latencyMs: Date.now() - started,
    ...(res.reply ? { reply: res.reply } : {}),
    ...(res.error ? { error: res.error } : {})
  };
}

module.exports = {
  DEFAULT_MODELS,
  redactSecret,
  validateCustomHttpsEndpoint,
  chatCloud,
  proposeCloudActions,
  testCloudConnection
};
