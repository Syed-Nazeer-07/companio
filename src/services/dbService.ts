import initSqlJs, { Database } from 'sql.js';
import { AppSettings, ChatMessage } from '../types';

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

  async init() {
    if (this.initialized) return;
    try {
      const SQL = await initSqlJs({
        locateFile: (file) => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.12.0/${file}`
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
      this.initialized = true;
      console.log('[SQLite] In-memory database initialized; persisted records use localStorage.');
    } catch (e) {
      console.warn('[SQLite] Fallback to in-memory/localStorage:', e);
      this.initialized = true;
    }
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
      if (this.db) this.db.run('DELETE FROM automation_logs');
    } catch (e) {}
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

  addNote(text: string): string[] {
    const notes = this.getNotes();
    notes.push(text);
    try {
      localStorage.setItem('companio_notes', JSON.stringify(notes));
    } catch (e) {}
    return notes;
  }

  clearNotes(): void {
    try {
      localStorage.removeItem('companio_notes');
    } catch (e) {}
  }
}

export const dbService = new DbService();
