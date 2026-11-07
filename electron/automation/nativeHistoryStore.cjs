'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { validateHistoryBackup } = require('./historyBackupController.cjs');

const emptyBackup = () => ({ conversations: [], automationLogs: [], notes: [] });
function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

class NativeHistoryStore {
  constructor(filePath) {
    if (!path.isAbsolute(filePath)) throw new Error('Native history path must be absolute.');
    this.filePath = filePath;
  }

  load() {
    try {
      if (!fs.existsSync(this.filePath)) {
        return { success: true, exists: false, backup: emptyBackup() };
      }
      const stat = fs.statSync(this.filePath);
      if (!stat.isFile() || stat.size > 8 * 1024 * 1024) {
        throw new Error('On-disk history is not a valid, bounded file.');
      }
      const contents = fs.readFileSync(this.filePath, 'utf8');
      const result = validateHistoryBackup(contents);
      if (!result.success) throw new Error(result.error);
      return { success: true, exists: true, backup: result.backup };
    } catch (error) {
      // Never overwrite a damaged file with an empty history snapshot.
      return { success: false, exists: true, error: error.message || 'Cannot load native history.' };
    }
  }

  mutate(operation) {
    try {
      if (!isRecord(operation) || typeof operation.kind !== 'string' ||
          Object.keys(operation).some(key => !['kind', 'record', 'backup'].includes(key))) {
        throw new Error('Invalid history mutation.');
      }
      const loaded = this.load();
      if (!loaded.success) throw new Error(loaded.error);
      const data = loaded.backup;
      switch (operation.kind) {
        case 'seed':
          // The first of multiple windows to initialize wins. A late-starting
          // window cannot overwrite history already created by another one.
          if (loaded.exists) return { success: true, alreadyExists: true };
          if (!isRecord(operation.backup)) throw new Error('Missing initial local history.');
          data.conversations = operation.backup.conversations;
          data.automationLogs = operation.backup.automationLogs;
          data.notes = operation.backup.notes;
          break;
        case 'add-message':
          if (!isRecord(operation.record)) throw new Error('Invalid message record.');
          data.conversations = [...data.conversations.filter(x => x.id !== operation.record.id), operation.record].slice(-100);
          break;
        case 'add-log':
          if (!isRecord(operation.record)) throw new Error('Invalid log record.');
          data.automationLogs = [operation.record, ...data.automationLogs.filter(x => x.id !== operation.record.id)].slice(0, 150);
          break;
        case 'add-note':
          if (typeof operation.record !== 'string') throw new Error('Invalid note.');
          data.notes = [...data.notes, operation.record].slice(-200);
          break;
        case 'clear-messages':
          data.conversations = [];
          break;
        case 'clear-logs':
          data.automationLogs = [];
          break;
        case 'clear-notes':
          data.notes = [];
          break;
        case 'replace':
          if (!isRecord(operation.backup)) throw new Error('Missing replacement history.');
          data.conversations = operation.backup.conversations;
          data.automationLogs = operation.backup.automationLogs;
          data.notes = operation.backup.notes;
          break;
        default:
          throw new Error('Unsupported history mutation.');
      }

      const serialized = JSON.stringify({
        format: 'companio-local-history',
        schemaVersion: 1,
        exportedAt: new Date().toISOString(),
        conversations: data.conversations,
        automationLogs: data.automationLogs,
        notes: data.notes
      });
      const validated = validateHistoryBackup(serialized);
      if (!validated.success) throw new Error(validated.error);

      fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
      const temporary = this.filePath + '.tmp';
      try {
        fs.writeFileSync(temporary, serialized, { encoding: 'utf8', flag: 'w', mode: 0o600 });
        fs.renameSync(temporary, this.filePath);
      } finally {
        try { if (fs.existsSync(temporary)) fs.unlinkSync(temporary); } catch {}
      }
      return { success: true, counts: validated.counts };
    } catch (error) {
      return { success: false, error: error.message || 'History could not be saved to disk.' };
    }
  }
}

module.exports = { NativeHistoryStore };
