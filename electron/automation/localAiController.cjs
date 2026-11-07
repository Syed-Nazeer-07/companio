'use strict';

// One restricted, shared local inference path for Companio. No credentials or
// requests to public/non-loopback hosts are accepted.
const DEFAULT_ENDPOINT = 'http://127.0.0.1:11434/v1';

function normalizeEndpoint(input = DEFAULT_ENDPOINT) {
  const value = input == null || input === '' ? DEFAULT_ENDPOINT : input;
  if (typeof value !== 'string' || value.length > 200 || /[\u0000-\u0020\u007f]/.test(value)) {
    throw new Error('Invalid local AI endpoint.');
  }
  let url;
  try { url = new URL(value); }
  catch { throw new Error('Enter a valid local AI address, such as http://127.0.0.1:11434/v1.'); }
  const hostname = url.hostname.toLowerCase();
  if (url.protocol !== 'http:' || !['localhost', '127.0.0.1', '[::1]'].includes(hostname) ||
      url.username || url.password || url.search || url.hash ||
      !['/', '/v1', '/v1/'].includes(url.pathname)) {
    throw new Error('Only HTTP loopback endpoints (localhost or 127.0.0.1) ending in /v1 are allowed.');
  }
  return url.origin + '/v1';
}

function validateText(value, name, maxLength) {
  if (typeof value !== 'string' || !value.trim() || value.length > maxLength ||
      /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value)) {
    throw new Error('Invalid ' + name + '.');
  }
  return value.trim();
}

async function requestJson(url, options, timeoutMs, fetchImpl) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(url, {
      ...options, signal: controller.signal, redirect: 'error'
    });
    if (!response.ok) {
      throw new Error('Local model server returned HTTP ' + response.status +
        '. Check that the selected model is loaded.');
    }
    return await response.json();
  } catch (error) {
    if (controller.signal.aborted || error?.name === 'AbortError') {
      throw new Error('Local model server timed out. It may still be loading the model.');
    }
    if (error instanceof SyntaxError) throw new Error('Local model server returned invalid JSON.');
    if (error instanceof TypeError) throw new Error('Cannot connect to the local model server. Start Ollama or LM Studio.');
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

async function listModels(options = {}, fetchImpl = globalThis.fetch) {
  try {
    if (!options || typeof options !== 'object' || Array.isArray(options)) {
      throw new Error('Invalid local model request.');
    }
    const endpoint = normalizeEndpoint(options.endpoint);
    const data = await requestJson(endpoint + '/models', { method: 'GET' }, 8000, fetchImpl);
    if (!Array.isArray(data?.data)) throw new Error('Local server did not return a model list.');
    const models = [...new Set(data.data
      .map(item => item?.id)
      .filter(id => typeof id === 'string' && id.length > 0 && id.length <= 160))].slice(0, 100);
    return { success: true, endpoint, models };
  } catch (error) {
    return { success: false, models: [], error: error.message || 'Local model discovery failed.' };
  }
}

async function chat(options = {}, fetchImpl = globalThis.fetch) {
  try {
    if (!options || typeof options !== 'object' || Array.isArray(options)) {
      throw new Error('Invalid local chat request.');
    }
    const endpoint = normalizeEndpoint(options.endpoint);
    const model = validateText(options.model, 'model name', 160);
    const prompt = validateText(options.prompt, 'message', 4000);
    const systemPrompt = options.systemPrompt == null
      ? 'You are Companio, a helpful Windows desktop companion. Be concise and accurate. Do not claim to have performed a computer action.'
      : validateText(options.systemPrompt, 'system prompt', 2400);
    const temperature = options.temperature == null ? 0.7 : options.temperature;
    if (typeof temperature !== 'number' || !Number.isFinite(temperature) || temperature < 0 || temperature > 2) {
      throw new Error('Temperature must be a number between 0 and 2.');
    }
    const maxTokens = options.maxTokens == null ? 220 : options.maxTokens;
    if (!Number.isInteger(maxTokens) || maxTokens < 32 || maxTokens > 900) {
      throw new Error('maxTokens must be an integer between 32 and 900.');
    }
    const data = await requestJson(endpoint + '/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: prompt }],
        temperature,
        max_tokens: maxTokens,
        stream: false
      })
    }, 45000, fetchImpl);
    const reply = data?.choices?.[0]?.message?.content;
    if (typeof reply !== 'string' || !reply.trim()) {
      throw new Error('The local model returned no text. Confirm the model is loaded.');
    }
    return { success: true, model, reply: reply.trim() };
  } catch (error) {
    return { success: false, error: error.message || 'Local AI response failed.' };
  }
}

// Search only the explicitly configured loopback endpoint and the two common
// local model servers. This is discovery, not an automatic download or launch.
const KNOWN_LOCAL_ENDPOINTS = Object.freeze([
  DEFAULT_ENDPOINT,
  'http://127.0.0.1:1234/v1'
]);

async function discoverLocalAi(options = {}, fetchImpl = globalThis.fetch) {
  try {
    if (!options || typeof options !== 'object' || Array.isArray(options)) {
      throw new Error('Invalid local AI discovery request.');
    }
    const preferred = normalizeEndpoint(options.endpoint);
    const endpoints = [...new Set([preferred, ...KNOWN_LOCAL_ENDPOINTS])];
    const results = await Promise.all(endpoints.map(endpoint => listModels({ endpoint }, fetchImpl)));
    // Prefer a usable server with a loaded model to a running but empty server.
    // Keep the caller's configured server first when it is usable.
    const selected = results.find(result => result.success && result.models.length > 0)
      || results.find(result => result.success);
    if (!selected) {
      return {
        success: false, models: [], checkedEndpoints: endpoints.length,
        error: 'No local AI server responded. Start Ollama or LM Studio and load a model, then try again.'
      };
    }
    return {
      success: true,
      endpoint: selected.endpoint,
      models: selected.models,
      checkedEndpoints: endpoints.length
    };
  } catch (error) {
    return {
      success: false, models: [], checkedEndpoints: 0,
      error: error.message || 'Local AI discovery failed.'
    };
  }
}

module.exports = { DEFAULT_ENDPOINT, normalizeEndpoint, listModels, chat, discoverLocalAi };