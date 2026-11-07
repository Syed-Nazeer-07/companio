import initSqlJs, { Database } from 'sql.js';
import sqliteWasmUrl from 'sql.js/dist/sql-wasm.wasm?url';
import { AppSettings, ChatMessage } from '../types';
import { desktopBridge, isNativeDesktop } from './desktopBridge';

export interface AutomationLogRecord {
  id: string;
  timestamp: number;
  tool: string;
  params: string;
  result: string;
  verified: boolean;
  durationMs: number;
}

class DbService {
  private db: Database | null = null;
  private initialized: boolean = false;
  private initializationPromise: Promise<void> | null = null;
  private pendingNativeWrite: Promise<void> = Promise.resolve();
  private nativeHistoryError: string | null = null;

  getHistoryPersistenceError(): string | null {
    return this.nativeHistoryError;
  }

  private reportNativeWriteError(message: string): void {
    this.nativeHistoryError = message;
    console.warn('[Companio] Native history storage:', message);
  }

  private enqueueNativeChange(operation: {
    kind: 'add-message' | 'add-log' | 'add-note' | 'clear-messages' | 'clear-logs' | 'clear-notes';
    record?: unknown;
  }): void {
    if (!isNativeDesktop()) return;
    this.pendingNativeWrite = this.pendingNativeWrite.then(async () => {
      const result = await desktopBridge.mutateHistoryStore(operation);
      if (!result.success) {
        // Once a write fails, keep the warning until the *entire* current
        // history is successfully resynchronized. Later successful appends
        // cannot repair an earlier missing record.
        this.reportNativeWriteError(result.error || 'Cannot save history to disk.');
      }
    }).catch((error) => {
      this.reportNativeWriteError(error instanceof Error ? error.message : 'Native history save failed.');
    });
  }

  async retryNativeHistorySave(): Promise<{ success: boolean; error?: string }> {
    if (!isNativeDesktop()) {
      return { success: false, error: 'On-disk history is available only in the desktop app.' };
    }
    await this.pendingNativeWrite;
    try {
      const snapshot = {
        conversations: this.getMessages().slice(-100),
        automationLogs: this.getLogs().slice(0, 150),
        notes: this.getNotes().slice(-200)
      };
      const result = await desktopBridge.mutateHistoryStore({ kind: 'replace', backup: snapshot });
      if (!result.success) {
        this.reportNativeWriteError(result.error || 'Could not resynchronize disk history.');
      } else {
        this.nativeHistoryError = null;
      }
      return { success: result.success, error: result.error };
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'Could not resynchronize disk history.';
      this.reportNativeWriteError(detail);
      return { success: false, error: detail };
    }
  }

  private async hydrateNativeHistory(): Promise<void> {
    if (!isNativeDesktop()) return;
    try {
      let result = await desktopBridge.loadHistoryStore();
      if (!result.success) {
        this.reportNativeWriteError(result.error || 'Cannot load saved native history.');
        return;
      }
      if (!result.exists) {
        // Migrate pre-rc.7 browser history only if the on-disk file is absent.
        // The native seed operation prevents concurrent windows overwriting
        // each other's first successful migration.
        const seed = await desktopBridge.mutateHistoryStore({
          kind: 'seed',
          backup: {
            conversations: this.getMessages().slice(-100),
            automationLogs: this.getLogs().slice(0, 150),
            notes: this.getNotes().slice(-200)
          }
        });
        if (!seed.success) {
          this.reportNativeWriteError(seed.error || 'Existing history could not be migrated to disk.');
          return;
        }
        result = await desktopBridge.loadHistoryStore();
      }
      if (!result.success || !result.backup) {
        this.reportNativeWriteError(result.error || 'Cannot read native history snapshot.');
        return;
      }
      // Only trusted, schema-validated data from the main process reaches
      // localStorage. It remains the synchronous cache for existing views.
      const keys = ['companio_chat_history', 'companio_automation_logs', 'companio_notes'];
      const values = [
        JSON.stringify(result.backup.conversations),
        JSON.stringify(result.backup.automationLogs),
        JSON.stringify(result.backup.notes)
      ];
      keys.forEach((key, index) => localStorage.setItem(key, values[index]));
      this.nativeHistoryError = null;
    } catch (error) {
      this.reportNativeWriteError(error instanceof Error ? error.message : 'Native history hydration failed.');
    }
  }


  async init(): Promise<void> {
    if (this.initialized) return;
    if (!this.initializationPromise) {
      this.initializationPromise = this.initializeOnce();
    }
    return this.initializationPromise;
  }

  private async initializeOnce(): Promise<void> {
    try {
      const SQL = await initSqlJs({
        locateFile: () => sqliteWasmUrl
      });
      this.db = new SQL.Database();
      this.db.run(`
        CREATE TABLE IF NOT EXISTS conversation_history (
          id TEXT PRIMARY KEY,
          sender TEXT NOT NULL,
          content TEXT NOT NULL,
          timestamp INTEGER NOT NULL,
          status TEXT
        );
        CREATE TABLE IF NOT EXISTS automation_logs (
          id TEXT PRIMARY KEY,
          timestamp INTEGER NOT NULL,
          tool TEXT NOT NULL,
          params TEXT,
          result TEXT,
          verified INTEGER NOT NULL,
          durationMs INTEGER NOT NULL
        );
      `);
      console.log('[SQLite] In-memory SQL cache initialized; native history is hydrated separately.');
    } catch (e) {
      console.warn('[SQLite] Fallback to in-memory/localStorage:', e);
    }
    await this.hydrateNativeHistory();
    this.initialized = true;
  }

  // Settings persistence
  loadSettings(): Partial<AppSettings> {
    try {
      const data = localStorage.getItem('companio_settings') || localStorage.getItem('aura_settings');
      if (data) {
        const parsed: unknown = JSON.parse(data);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          return parsed as Partial<AppSettings>;
        }
      }
    } catch (e) {}
    return {};
  }

  saveSettings(settings: AppSettings) {
    try {
      localStorage.setItem('companio_settings', JSON.stringify(settings));
    } catch (e) {}
  }

  // Conversation logs
  addMessage(msg: ChatMessage) {
    try {
      const history = this.getMessages();
      history.push(msg);
      // Keep last 100 messages
      if (history.length > 100) history.shift();
      localStorage.setItem('companio_chat_history', JSON.stringify(history));
      this.enqueueNativeChange({ kind: 'add-message', record: msg });

      if (this.db) {
        this.db.run(
          'INSERT INTO conversation_history (id, sender, content, timestamp, status) VALUES (?, ?, ?, ?, ?)',
          [msg.id, msg.sender, msg.content, msg.timestamp, msg.status || 'info']
        );
      }
    } catch (e) {}
  }

  getMessages(): ChatMessage[] {
    try {
      const data = localStorage.getItem('companio_chat_history') || localStorage.getItem('aura_chat_history');
      if (data) {
        const parsed: unknown = JSON.parse(data);
        if (Array.isArray(parsed)) {
          return parsed.filter((message): message is ChatMessage =>
            !!message && typeof message === 'object'
            && typeof message.id === 'string'
            && typeof message.sender === 'string'
            && typeof message.content === 'string'
            && Number.isFinite(message.timestamp)
          );
        }
      }
    } catch (e) {}
    return [];
  }

  clearMessages() {
    try {
      localStorage.removeItem('companio_chat_history');
      localStorage.removeItem('aura_chat_history');
      this.enqueueNativeChange({ kind: 'clear-messages' });
      if (this.db) this.db.run('DELETE FROM conversation_history');
    } catch (e) {}
  }

  // Automation Execution logs
  addLog(tool: string, params: any, result: any, verified: boolean, durationMs: number) {
    try {
      const record: AutomationLogRecord = {
        id: 'log_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
        timestamp: Date.now(),
        tool,
        params: JSON.stringify(params),
        result: JSON.stringify(result),
        verified,
        durationMs
      };

      const logs = this.getLogs();
      logs.unshift(record);
      if (logs.length > 150) logs.pop();
      localStorage.setItem('companio_automation_logs', JSON.stringify(logs));
      this.enqueueNativeChange({ kind: 'add-log', record });

      if (this.db) {
        this.db.run(
          'INSERT INTO automation_logs (id, timestamp, tool, params, result, verified, durationMs) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [record.id, record.timestamp, record.tool, record.params, record.result, record.verified ? 1 : 0, record.durationMs]
        );
      }
    } catch (e) {}
  }

  getLogs(): AutomationLogRecord[] {
    try {
      const data = localStorage.getItem('companio_automation_logs') || localStorage.getItem('aura_automation_logs');
      if (data) {
        const parsed: unknown = JSON.parse(data);
        if (Array.isArray(parsed)) {
          return parsed.filter((log): log is AutomationLogRecord =>
            !!log && typeof log === 'object'
            && typeof log.id === 'string'
            && typeof log.tool === 'string'
            && typeof log.params === 'string'
            && typeof log.result === 'string'
            && typeof log.verified === 'boolean'
            && Number.isFinite(log.timestamp)
            && Number.isFinite(log.durationMs)
          );
        }
      }
    } catch (e) {}
    return [];
  }

  clearLogs() {
    try {
      localStorage.removeItem('companio_automation_logs');
      localStorage.removeItem('aura_automation_logs');
      this.enqueueNativeChange({ kind: 'clear-logs' });
      if (this.db) this.db.run('DELETE FROM automation_logs');
    } catch (e) {}
  }

  // Apply an Electron-validated history backup as a complete replacement.
  // Keep existing values and roll back every write if the storage quota or
  // browser permissions prevent any section from being saved.
  async restoreHistory(backup: {
    conversations: ChatMessage[];
    automationLogs: AutomationLogRecord[];
    notes: string[];
  }): Promise<{ success: boolean; error?: string }> {
    if (!backup || !Array.isArray(backup.conversations) ||
        !Array.isArray(backup.automationLogs) || !Array.isArray(backup.notes) ||
        backup.conversations.length > 100 || backup.automationLogs.length > 150 || backup.notes.length > 200) {
      return { success: false, error: 'History backup was not validated.' };
    }
    const keys = ['companio_chat_history', 'companio_automation_logs', 'companio_notes'];
    const payloads = [
      JSON.stringify(backup.conversations),
      JSON.stringify(backup.automationLogs),
      JSON.stringify(backup.notes)
    ];
    const previous: (string | null)[] = [];
    try {
      for (const key of keys) previous.push(localStorage.getItem(key));
    } catch {
      return { success: false, error: 'Cannot read local storage to prepare a safe restore.' };
    }
    try {
      keys.forEach((key, index) => localStorage.setItem(key, payloads[index]));
    } catch {
      let rollbackFailed = false;
      keys.forEach((key, index) => {
        try {
          if (previous[index] === null) localStorage.removeItem(key);
          else localStorage.setItem(key, previous[index] as string);
        } catch {
          rollbackFailed = true;
        }
      });
      return {
        success: false,
        error: rollbackFailed
          ? 'Restore failed and existing history could not be fully recovered. Check local storage before retrying.'
          : 'Restore failed. Previous history has been preserved.'
      };
    }
    if (isNativeDesktop()) {
      // Serialize behind earlier message/log writes so restore never races
      // a still-pending append from this window.
      await this.pendingNativeWrite;
      try {
        const result = await desktopBridge.mutateHistoryStore({ kind: 'replace', backup });
        if (!result.success) throw new Error(result.error || 'Native history file could not be saved.');
        this.nativeHistoryError = null;
      } catch (error) {
        let rollbackFailed = false;
        keys.forEach((key, index) => {
          try {
            if (previous[index] === null) localStorage.removeItem(key);
            else localStorage.setItem(key, previous[index] as string);
          } catch {
            rollbackFailed = true;
          }
        });
        const detail = error instanceof Error ? error.message : 'Native history save failed.';
        this.reportNativeWriteError(detail);
        return {
          success: false,
          error: rollbackFailed
            ? 'Restore failed and local history rollback also failed: ' + detail
            : 'Restore cancelled: the disk copy could not be saved. Existing history was preserved. ' + detail
        };
      }
    }

    // SQL.js is currently an in-memory cache. Local storage is authoritative.
    // Rebuilding this cache is best-effort and never overrides a valid restore.
    if (this.db) {
      try {
        this.db.run('DELETE FROM conversation_history; DELETE FROM automation_logs;');
        for (const msg of backup.conversations) {
          this.db.run(
            'INSERT INTO conversation_history (id, sender, content, timestamp, status) VALUES (?, ?, ?, ?, ?)',
            [msg.id, msg.sender, msg.content, msg.timestamp, msg.status || 'info']
          );
        }
        for (const log of backup.automationLogs) {
          this.db.run(
            'INSERT INTO automation_logs (id, timestamp, tool, params, result, verified, durationMs) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [log.id, log.timestamp, log.tool, log.params, log.result, log.verified ? 1 : 0, log.durationMs]
          );
        }
      } catch (error) {
        console.warn('[Companio] In-memory SQL history cache could not be refreshed:', error);
      }
    }
    return { success: true };
  }

  // Quick Notes persistence
  getNotes(): string[] {
    try {
      const data = localStorage.getItem('companio_notes');
      if (!data) return [];
      const parsed: unknown = JSON.parse(data);
      return Array.isArray(parsed) ? parsed.filter((note): note is string => typeof note === 'string') : [];
    } catch (e) {
      return [];
    }
  }

  async addNote(text: string): Promise<{ success: boolean; count: number; error?: string }> {
    if (typeof text !== 'string' || !text.trim() || text.length > 4000) {
      return { success: false, count: this.getNotes().length, error: 'A note must contain 1–4000 characters.' };
    }
    const notes = [...this.getNotes(), text].slice(-200);
    // Reuse the transactional backup path, rather than claiming success from
    // a failed/quota-exceeded localStorage write or an unverified disk append.
    const outcome = await this.restoreHistory({
      conversations: this.getMessages().slice(-100),
      automationLogs: this.getLogs().slice(0,150),
      notes
    });
    return { success: outcome.success, count: outcome.success ? notes.length : this.getNotes().length, error: outcome.error };
  }

  async clearNotes(): Promise<{ success: boolean; error?: string }> {
    return this.restoreHistory({
      conversations: this.getMessages().slice(-100),
      automationLogs: this.getLogs().slice(0,150),
      notes: []
    });
  }
}

export const dbService = new DbService();
