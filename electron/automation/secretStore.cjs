'use strict';

const fs = require('node:fs');
const path = require('node:path');

const CLOUD_PROVIDERS = Object.freeze(['openai', 'gemini', 'anthropic', 'groq', 'openrouter', 'custom_openai']);

function isRecord(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value) &&
    (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
}

class SecretStore {
  constructor({ filePath, safeStorageImpl = null } = {}) {
    if (typeof filePath !== 'string' || !path.isAbsolute(filePath)) {
      throw new Error('Secret store path must be absolute.');
    }
    this.filePath = filePath;
    this.safeStorage = safeStorageImpl;
  }

  encryptionAvailable() {
    try {
      return Boolean(this.safeStorage && typeof this.safeStorage.isEncryptionAvailable === 'function' && this.safeStorage.isEncryptionAvailable());
    } catch {
      return false;
    }
  }

  validateProvider(provider) {
    const clean = typeof provider === 'string' ? provider.trim().toLowerCase() : '';
    if (!CLOUD_PROVIDERS.includes(clean)) {
      throw new Error('Unsupported cloud AI provider.');
    }
    return clean;
  }

  readRaw() {
    if (!fs.existsSync(this.filePath)) {
      return { format: 'companio-dpapi-secrets', schemaVersion: 1, secrets: {} };
    }
    const stat = fs.statSync(this.filePath);
    if (!stat.isFile() || stat.size > 256 * 1024) {
      throw new Error('Encrypted secret store file is invalid or too large.');
    }
    const parsed = JSON.parse(fs.readFileSync(this.filePath, 'utf8'));
    if (!isRecord(parsed) || parsed.format !== 'companio-dpapi-secrets' || parsed.schemaVersion !== 1 || !isRecord(parsed.secrets)) {
      throw new Error('Secret store file format is invalid.');
    }
    return parsed;
  }

  writeRaw(store) {
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    const tmp = this.filePath + '.tmp';
    try {
      fs.writeFileSync(tmp, JSON.stringify(store, null, 2), { encoding: 'utf8', flag: 'w', mode: 0o600 });
      fs.renameSync(tmp, this.filePath);
    } finally {
      try { if (fs.existsSync(tmp)) fs.unlinkSync(tmp); } catch {}
    }
  }

  status() {
    const encryptionAvailable = this.encryptionAvailable();
    const providers = Object.fromEntries(CLOUD_PROVIDERS.map(p => [p, { configured: false, hint: null }]));
    try {
      const store = this.readRaw();
      for (const p of CLOUD_PROVIDERS) {
        const entry = store.secrets[p];
        if (isRecord(entry) && typeof entry.cipherBase64 === 'string' && entry.cipherBase64.length > 0) {
          providers[p] = {
            configured: encryptionAvailable,
            hint: typeof entry.hint === 'string' ? entry.hint : '••••'
          };
        }
      }
      return { success: true, encryptionAvailable, providers };
    } catch (error) {
      return { success: false, encryptionAvailable, providers, error: error.message || 'Could not inspect secret store.' };
    }
  }

  setKey(provider, rawKey) {
    try {
      const p = this.validateProvider(provider);
      if (!this.encryptionAvailable()) {
        throw new Error('Windows DPAPI OS encryption is unavailable on this runtime. API key was not saved.');
      }
      if (typeof rawKey !== 'string' || /\s|[\u0000-\u001f\u007f]/.test(rawKey) || rawKey.length < 10 || rawKey.length > 300) {
        throw new Error('Enter a valid API key (10–300 non-whitespace characters).');
      }
      const encrypted = this.safeStorage.encryptString(rawKey);
      const hint = '••••' + rawKey.slice(-4);
      const store = this.readRaw();
      store.secrets[p] = {
        cipherBase64: Buffer.from(encrypted).toString('base64'),
        hint,
        updatedAt: new Date().toISOString()
      };
      this.writeRaw(store);
      return { success: true, provider: p, configured: true, hint };
    } catch (error) {
      return { success: false, error: error.message || 'Could not encrypt and store API key.' };
    }
  }

  getKey(provider) {
    const p = this.validateProvider(provider);
    if (!this.encryptionAvailable()) return null;
    try {
      const store = this.readRaw();
      const entry = store.secrets[p];
      if (!isRecord(entry) || typeof entry.cipherBase64 !== 'string' || !entry.cipherBase64) {
        return null;
      }
      const decrypted = this.safeStorage.decryptString(Buffer.from(entry.cipherBase64, 'base64'));
      return typeof decrypted === 'string' && decrypted.length >= 10 ? decrypted : null;
    } catch {
      return null;
    }
  }

  clearKey(provider) {
    try {
      const p = this.validateProvider(provider);
      if (!fs.existsSync(this.filePath)) {
        return { success: true, provider: p, configured: false };
      }
      const store = this.readRaw();
      delete store.secrets[p];
      this.writeRaw(store);
      return { success: true, provider: p, configured: false };
    } catch (error) {
      return { success: false, error: error.message || 'Could not remove stored API key.' };
    }
  }
}

module.exports = { SecretStore, CLOUD_PROVIDERS };
