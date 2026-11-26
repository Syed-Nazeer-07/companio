'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const MAX_MEMORY_BYTES = 2 * 1024 * 1024;
const MAX_MEMORIES = 100;
const CATEGORIES = Object.freeze(['preference', 'fact', 'project', 'workflow']);

function isRecord(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value) &&
    (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
}

function containsSensitiveSecret(text) {
  return /\b(?:sk-[a-z0-9_-]{12,}|AIza[0-9A-Za-z_-]{20,}|ghp_[A-Za-z0-9]{20,}|AKIA[0-9A-Z]{16})\b/i.test(text)
    || /(?:api[_-]?key|password|passphrase|secret|token)\s*[:=]\s*\S{6,}/i.test(text)
    || /-----BEGIN [A-Z ]*PRIVATE KEY-----/i.test(text);
}

function normalizeMemoryText(input) {
  if (typeof input !== 'string' || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(input)) {
    throw new Error('Memory text contains unsupported control characters.');
  }
  const clean = input.replace(/\s+/g, ' ').trim();
  if (clean.length < 2 || clean.length > 300) {
    throw new Error('Memory must contain between 2 and 300 characters.');
  }
  if (containsSensitiveSecret(clean)) {
    throw new Error('Secrets, passwords, tokens, and API keys must never be stored in long-term memory.');
  }
  return clean;
}

function normalizeCategory(category) {
  const value = category == null ? 'fact' : String(category).trim().toLowerCase();
  if (!CATEGORIES.includes(value)) {
    throw new Error('Unsupported memory category.');
  }
  return value;
}

function validateRecord(record, index) {
  if (!isRecord(record)) throw new Error(`Invalid memory record #${index + 1}.`);
  const id = typeof record.id === 'string' && record.id.trim() && record.id.length <= 120
    ? record.id.trim()
    : (() => { throw new Error('Invalid memory ID.'); })();
  const content = normalizeMemoryText(record.content);
  const category = normalizeCategory(record.category);
  const createdAt = Number.isSafeInteger(record.createdAt) ? record.createdAt : Date.now();
  const updatedAt = Number.isSafeInteger(record.updatedAt) ? record.updatedAt : createdAt;
  const lastUsedAt = record.lastUsedAt === null || record.lastUsedAt === undefined
    ? null
    : (Number.isSafeInteger(record.lastUsedAt) ? record.lastUsedAt : null);
  const expiresAt = record.expiresAt === null || record.expiresAt === undefined
    ? null
    : (Number.isSafeInteger(record.expiresAt) ? record.expiresAt : (() => { throw new Error('Invalid memory expiration.'); })());
  return {
    id,
    content,
    category,
    pinned: Boolean(record.pinned),
    enabled: record.enabled !== false,
    createdAt,
    updatedAt,
    lastUsedAt,
    expiresAt
  };
}

class MemoryStore {
  constructor(filePath, { now = () => Date.now() } = {}) {
    if (typeof filePath !== 'string' || !path.isAbsolute(filePath)) {
      throw new Error('Memory store path must be absolute.');
    }
    this.filePath = filePath;
    this.now = now;
  }

  load() {
    try {
      if (!fs.existsSync(this.filePath)) {
        return { success: true, exists: false, items: [] };
      }
      const stat = fs.statSync(this.filePath);
      if (!stat.isFile() || stat.size > MAX_MEMORY_BYTES) {
        throw new Error('On-disk memory file is invalid or exceeds safe size.');
      }
      const raw = JSON.parse(fs.readFileSync(this.filePath, 'utf8'));
      if (!isRecord(raw) || raw.format !== 'companio-local-memory' || raw.schemaVersion !== 1 || !Array.isArray(raw.items)) {
        throw new Error('Unsupported memory file format.');
      }
      const items = raw.items.slice(0, MAX_MEMORIES).map(validateRecord);
      return { success: true, exists: true, items };
    } catch (error) {
      return { success: false, items: [], error: error.message || 'Could not load saved memory.' };
    }
  }

  saveAll(items) {
    const clean = items.slice(0, MAX_MEMORIES).map(validateRecord);
    const payload = JSON.stringify({
      format: 'companio-local-memory',
      schemaVersion: 1,
      updatedAt: new Date(this.now()).toISOString(),
      items: clean
    }, null, 2);
    if (Buffer.byteLength(payload, 'utf8') > MAX_MEMORY_BYTES) {
      throw new Error('Memory storage limit exceeded.');
    }
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    const tmp = this.filePath + '.tmp';
    try {
      fs.writeFileSync(tmp, payload, { encoding: 'utf8', flag: 'w', mode: 0o600 });
      fs.renameSync(tmp, this.filePath);
    } finally {
      try { if (fs.existsSync(tmp)) fs.unlinkSync(tmp); } catch {}
    }
    return clean;
  }

  add(input = {}) {
    try {
      if (!isRecord(input)) throw new Error('Invalid memory payload.');
      const loaded = this.load();
      if (!loaded.success) throw new Error(loaded.error);
      const content = normalizeMemoryText(input.content);
      const category = normalizeCategory(input.category);
      const ts = this.now();
      const expiresAt = input.expiresAt === undefined || input.expiresAt === null
        ? null
        : (Number.isSafeInteger(input.expiresAt) && input.expiresAt > ts
          ? input.expiresAt
          : (() => { throw new Error('Expiration time must be in the future.'); })());
      const normalized = content.toLowerCase();
      const existingIndex = loaded.items.findIndex(item => item.content.toLowerCase() === normalized);
      let items;
      let item;
      if (existingIndex >= 0) {
        const prev = loaded.items[existingIndex];
        item = {
          ...prev,
          content,
          category,
          pinned: input.pinned !== undefined ? Boolean(input.pinned) : prev.pinned,
          enabled: true,
          updatedAt: ts,
          expiresAt: input.expiresAt !== undefined ? expiresAt : prev.expiresAt
        };
        items = [item, ...loaded.items.filter((_, idx) => idx !== existingIndex)];
      } else {
        item = {
          id: 'mem_' + crypto.randomUUID(),
          content,
          category,
          pinned: Boolean(input.pinned),
          enabled: true,
          createdAt: ts,
          updatedAt: ts,
          lastUsedAt: null,
          expiresAt
        };
        items = [item, ...loaded.items].slice(0, MAX_MEMORIES);
      }
      const saved = this.saveAll(items);
      return { success: true, item, items: saved };
    } catch (error) {
      return { success: false, error: error.message || 'Could not save memory.' };
    }
  }

  update(id, patch = {}) {
    try {
      if (typeof id !== 'string' || !id.trim() || !isRecord(patch)) throw new Error('Invalid memory update request.');
      const loaded = this.load();
      if (!loaded.success) throw new Error(loaded.error);
      const idx = loaded.items.findIndex(item => item.id === id);
      if (idx < 0) throw new Error('Memory entry was not found.');
      const prev = loaded.items[idx];
      const next = {
        ...prev,
        ...(patch.content !== undefined ? { content: normalizeMemoryText(patch.content) } : {}),
        ...(patch.category !== undefined ? { category: normalizeCategory(patch.category) } : {}),
        ...(patch.pinned !== undefined ? { pinned: Boolean(patch.pinned) } : {}),
        ...(patch.enabled !== undefined ? { enabled: Boolean(patch.enabled) } : {}),
        ...(patch.expiresAt !== undefined ? {
          expiresAt: patch.expiresAt === null ? null : (Number.isSafeInteger(patch.expiresAt) ? patch.expiresAt : (() => { throw new Error('Invalid expiration.'); })())
        } : {}),
        updatedAt: this.now()
      };
      const items = loaded.items.map((item, i) => (i === idx ? next : item));
      const saved = this.saveAll(items);
      return { success: true, item: next, items: saved };
    } catch (error) {
      return { success: false, error: error.message || 'Could not update memory.' };
    }
  }

  remove(id) {
    try {
      if (typeof id !== 'string' || !id.trim()) throw new Error('Missing memory ID.');
      const loaded = this.load();
      if (!loaded.success) throw new Error(loaded.error);
      const next = loaded.items.filter(item => item.id !== id);
      const removed = next.length !== loaded.items.length;
      const saved = this.saveAll(next);
      return { success: true, removed, items: saved };
    } catch (error) {
      return { success: false, error: error.message || 'Could not delete memory.' };
    }
  }

  clear() {
    try {
      const saved = this.saveAll([]);
      return { success: true, items: saved };
    } catch (error) {
      return { success: false, error: error.message || 'Could not clear saved memory.' };
    }
  }

  touch(ids) {
    try {
      if (!Array.isArray(ids) || !ids.length) return { success: true };
      const idSet = new Set(ids.filter(id => typeof id === 'string'));
      const loaded = this.load();
      if (!loaded.success) return loaded;
      const ts = this.now();
      let changed = false;
      const next = loaded.items.map(item => {
        if (!idSet.has(item.id)) return item;
        changed = true;
        return { ...item, lastUsedAt: ts };
      });
      if (changed) this.saveAll(next);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message || 'Could not update memory usage timestamp.' };
    }
  }
}

module.exports = { MemoryStore, MAX_MEMORIES, MAX_MEMORY_BYTES, CATEGORIES, containsSensitiveSecret };
