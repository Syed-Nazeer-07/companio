import React, { useState, useEffect, useRef } from 'react';
import { dbService, AutomationLogRecord } from '../../services/dbService';
import { desktopBridge, isNativeDesktop } from '../../services/desktopBridge';
import { AppSettings, ChatMessage, MemoryCategory, MemoryItem } from '../../types';
import { Search, Trash2, Download, Upload, CheckCircle2, AlertCircle, Clock, Pin, Brain, Plus, Pause, Play } from 'lucide-react';

interface HistoryPageProps {
  settings?: AppSettings;
  onUpdateSettings?: (newSettings: Partial<AppSettings>) => void;
}

export const HistoryPage: React.FC<HistoryPageProps> = ({ settings, onUpdateSettings }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [logs, setLogs] = useState<AutomationLogRecord[]>([]);
  const [memories, setMemories] = useState<MemoryItem[]>([]);
  const [viewMode, setViewMode] = useState<'conversations' | 'automations' | 'memory'>('conversations');
  const [filterQuery, setFilterQuery] = useState<string>('');
  const [exportStatus, setExportStatus] = useState<string>('');
  const [importing, setImporting] = useState(false);
  const [memoryDraft, setMemoryDraft] = useState('');
  const [memoryCategory, setMemoryCategory] = useState<MemoryCategory>('fact');
  const [memoryExpiryDays, setMemoryExpiryDays] = useState<'never' | '7' | '30'>('never');
  const [memoryPinned, setMemoryPinned] = useState(false);
  const [memoryStatus, setMemoryStatus] = useState('');
  const nativeStorageWarning = dbService.getHistoryPersistenceError();
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = () => {
    setMessages(dbService.getMessages());
    setLogs(dbService.getLogs());
    void dbService.getMemories().then(setMemories).catch(() => {});
  };

  const handleAddMemory = async (e: React.FormEvent) => {
    e.preventDefault();
    setMemoryStatus('');
    const expiresAt = memoryExpiryDays === 'never'
      ? null
      : Date.now() + Number(memoryExpiryDays) * 86_400_000;
    const res = await dbService.addMemory({
      content: memoryDraft,
      category: memoryCategory,
      pinned: memoryPinned,
      expiresAt
    });
    if (!res.success) {
      setMemoryStatus(res.error || 'Could not save memory.');
      return;
    }
    setMemoryDraft('');
    setMemoryPinned(false);
    setMemories(await dbService.getMemories());
    setMemoryStatus('Memory saved locally.');
  };

  const handleToggleMemoryFlag = async (item: MemoryItem, patch: { enabled?: boolean; pinned?: boolean }) => {
    setMemoryStatus('');
    const res = await dbService.updateMemory(item.id, patch);
    if (!res.success) {
      setMemoryStatus(res.error || 'Could not update memory.');
      return;
    }
    setMemories(await dbService.getMemories());
  };

  const handleDeleteMemory = async (id: string) => {
    setMemoryStatus('');
    const res = await dbService.deleteMemory(id);
    if (!res.success) {
      setMemoryStatus(res.error || 'Could not delete memory.');
      return;
    }
    setMemories(await dbService.getMemories());
  };

  const handleClearMemories = async () => {
    if (!confirm('Permanently delete all saved long-term memories?')) return;
    const res = await dbService.clearMemories();
    if (!res.success) {
      setMemoryStatus(res.error || 'Could not clear memories.');
      return;
    }
    setMemories([]);
    setMemoryStatus('All saved memories cleared.');
  };

  const handleClearAll = async () => {
    if (!confirm('Permanently clear conversation history and automation logs? Quick notes are kept. Export history first if needed.')) return;
    const result = await dbService.restoreHistory({
      conversations: [],
      automationLogs: [],
      notes: dbService.getNotes()
    });
    if (!result.success) {
      setExportStatus(result.error || 'History was not cleared because storage could not be updated.');
      return;
    }
    loadData();
    setExportStatus('Conversation history and automation logs cleared. Quick notes were preserved.');
  };

  const handleExport = () => {
    try {
      // Keep API keys and other application preferences out of history exports.
      const backup = {
        format: 'companio-local-history',
        schemaVersion: 1,
        exportedAt: new Date().toISOString(),
        conversations: dbService.getMessages(),
        automationLogs: dbService.getLogs(),
        notes: dbService.getNotes()
      };
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = 'companio-history-' + new Date().toISOString().slice(0, 10) + '.json';
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setExportStatus('History export requested. Check your Downloads folder and store the file securely.');
    } catch {
      setExportStatus('Could not create a history export on this device.');
    }
  };

  const handleImportFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = '';
    if (!file) return;
    setImporting(true);
    setExportStatus('');
    try {
      if (file.size > 8 * 1024 * 1024) {
        setExportStatus('Import refused: history backup must be smaller than 8 MiB.');
        return;
      }
      const validated = await desktopBridge.validateHistoryImport(await file.text());
      if (!validated.success || !validated.backup || !validated.counts) {
        setExportStatus(validated.error || 'The selected file is not a valid Companio history backup.');
        return;
      }
      const counts = validated.counts;
      const accepted = window.confirm(
        'Restore this Companio history backup?\n\n' +
        'Conversations: ' + counts.conversations +
        '\nAutomation logs: ' + counts.automationLogs +
        '\nNotes: ' + counts.notes +
        '\n\nThis REPLACES your current conversations, logs and notes. ' +
        'Settings and AI keys will not be changed. Export your current history first if needed.'
      );
      if (!accepted) {
        setExportStatus('Restore cancelled. Existing history was not changed.');
        return;
      }
      // Contents are sanitized in the trusted Electron main process.
      const outcome = await dbService.restoreHistory(validated.backup as {
        conversations: ChatMessage[];
        automationLogs: AutomationLogRecord[];
        notes: string[];
      });
      if (!outcome.success) {
        setExportStatus(outcome.error || 'History could not be restored.');
        return;
      }
      loadData();
      setExportStatus(
        'History restored: ' + counts.conversations + ' conversations, ' +
        counts.automationLogs + ' automation logs, ' + counts.notes +
        ' notes. Settings were not changed.'
      );
    } catch (error) {
      setExportStatus('Could not restore history: ' +
        (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setImporting(false);
    }
  };

  const taskMessages = messages.filter(message => message.taskReceipt && Array.isArray(message.taskReceipt.steps) && message.taskReceipt.steps.length > 0);
  const completedTasks = taskMessages.filter(message => message.taskReceipt?.status === 'completed').length;
  const failedTasks = taskMessages.filter(message => message.taskReceipt?.status === 'failed').length;
  const stoppedTasks = taskMessages.filter(message => message.taskReceipt?.status === 'cancelled').length;
  const filteredLogs = logs.filter(
    (l) =>
      l.tool.toLowerCase().includes(filterQuery.toLowerCase()) ||
      l.params.toLowerCase().includes(filterQuery.toLowerCase()) ||
      l.result.toLowerCase().includes(filterQuery.toLowerCase())
  );

  const filteredMessages = messages.filter((m) =>
    m.content.toLowerCase().includes(filterQuery.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 mb-1">Execution History & Logs</h2>
          <p className="text-sm text-slate-600">
            Search your conversations and command results, stored locally on this device. Export a backup before clearing or restoring.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            className="hidden"
            aria-label="Select Companio history backup"
            onChange={handleImportFile}
          />
          <button
            type="button"
            disabled={importing || !isNativeDesktop()}
            title={isNativeDesktop() ? 'Restore a Companio JSON history backup' : 'History restore requires the installed desktop app'}
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-white hover:bg-sky-50 text-sky-700 border border-sky-200 text-xs font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>{importing ? 'Validating...' : 'Restore History'}</span>
          </button>
          <button
            type="button"
            onClick={handleExport}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-white hover:bg-sky-50 text-sky-700 border border-sky-200 text-xs font-bold transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export History</span>
          </button>
          <button
            type="button"
            onClick={handleClearAll}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 text-xs font-bold transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear History</span>
          </button>
        </div>
      </div>

      {exportStatus && <p role="status" className="text-xs text-slate-600">{exportStatus}</p>}
      {nativeStorageWarning && (
        <p role="alert" className="text-xs text-amber-700">
          Windows history disk storage needs attention: {nativeStorageWarning}
          {' '}Export your current history before restarting Companio.
          <button
            type="button"
            className="ml-2 underline underline-offset-2 font-semibold"
            onClick={async () => {
              const result = await dbService.retryNativeHistorySave();
              setExportStatus(result.success
                ? 'The full history cache was resynchronized to the Windows app-data file.'
                : 'Disk resync failed: ' + (result.error || 'Unable to save history.'));
            }}
          >
            Retry disk sync
          </button>
        </p>
      )}

      <section aria-label="Retained task history summary" className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {([{label:'Recorded tasks',value:taskMessages.length},{label:'Completed / sent',value:completedTasks},{label:'Needs attention',value:failedTasks},{label:'Stopped',value:stoppedTasks}]).map(item=><div key={item.label} className="acrylic-card p-4"><p className="text-xs text-slate-600">{item.label}</p><strong className="block text-2xl font-semibold mt-1 text-slate-900">{item.value}</strong></div>)}
      </section>
      {/* Controls Bar */}
      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
        {/* View Mode Toggle */}
        <div className="flex p-1 rounded-xl bg-slate-100 border border-slate-200">
          <button
            onClick={() => setViewMode('automations')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
              viewMode === 'automations'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Automation Logs ({logs.length})
          </button>
          <button
            onClick={() => setViewMode('conversations')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
              viewMode === 'conversations'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Chat History ({messages.length})
          </button>
          <button
            onClick={() => setViewMode('memory')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
              viewMode === 'memory'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Saved Memory ({memories.length})
          </button>
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
            placeholder="Search records..." aria-label="Search history"
            className="w-full pl-9 pr-3.5 py-2 rounded-xl bg-white border border-slate-200 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-sky-500 shadow-sm"
          />
        </div>
      </div>

      {/* Content View */}
      {viewMode === 'memory' ? (
        <div className="space-y-4">
          <div className="acrylic-card rounded-2xl p-5 border border-slate-200 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Brain className="w-4 h-4 text-sky-600" />
                  <span>User-Controlled Long-Term Memory</span>
                </h3>
                <p className="text-xs text-slate-600 mt-1">
                  Saved memory only provides background context for AI chat — it never triggers desktop actions, and stale unpinned items decay automatically.
                </p>
              </div>
              {settings && onUpdateSettings && (
                <label className="flex items-center gap-2 text-xs font-semibold text-slate-800 shrink-0 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.ai.useLongTermMemory !== false}
                    onChange={(e) => onUpdateSettings({ ai: { ...settings.ai, useLongTermMemory: e.target.checked } })}
                    className="h-4 w-4 accent-sky-600 rounded"
                  />
                  <span>Use saved memory in AI chat</span>
                </label>
              )}
            </div>

            <form onSubmit={(e) => void handleAddMemory(e)} className="grid grid-cols-1 md:grid-cols-12 gap-2.5 pt-3 border-t border-slate-100">
              <input
                type="text"
                maxLength={300}
                value={memoryDraft}
                onChange={(e) => setMemoryDraft(e.target.value)}
                placeholder="Add a preference, project context, or fact (no API keys or passwords)..."
                aria-label="New memory content"
                className="md:col-span-6 px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-sky-500"
              />
              <select
                value={memoryCategory}
                onChange={(e) => setMemoryCategory(e.target.value as MemoryCategory)}
                aria-label="Memory category"
                className="md:col-span-2 px-2.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-800"
              >
                <option value="fact">Fact</option>
                <option value="preference">Preference</option>
                <option value="project">Project</option>
                <option value="workflow">Workflow</option>
              </select>
              <select
                value={memoryExpiryDays}
                onChange={(e) => setMemoryExpiryDays(e.target.value as 'never' | '7' | '30')}
                aria-label="Memory expiration"
                className="md:col-span-2 px-2.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-800"
              >
                <option value="never">No expiry</option>
                <option value="7">7 days</option>
                <option value="30">30 days</option>
              </select>
              <div className="md:col-span-2 flex items-center justify-between gap-2">
                <label className="flex items-center gap-1 text-[11px] font-semibold text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={memoryPinned}
                    onChange={(e) => setMemoryPinned(e.target.checked)}
                    className="h-3.5 w-3.5 accent-sky-600 rounded"
                  />
                  <span>Pin</span>
                </label>
                <button
                  type="submit"
                  disabled={!memoryDraft.trim()}
                  className="inline-flex items-center gap-1 px-3 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold disabled:opacity-50"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Save</span>
                </button>
              </div>
            </form>

            {memoryStatus && (
              <p role="status" className="text-xs text-slate-700 font-medium">{memoryStatus}</p>
            )}
          </div>

          {memories.filter(m => m.content.toLowerCase().includes(filterQuery.toLowerCase())).length === 0 ? (
            <div className="acrylic-card rounded-2xl p-8 text-center text-slate-500 text-sm border border-slate-200">
              No saved memories yet. Add one above or say "save to memory: ...".
            </div>
          ) : (
            <div className="space-y-2.5">
              {memories.length > 0 && (
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => void handleClearMemories()}
                    className="text-xs font-semibold text-rose-600 hover:underline"
                  >
                    Clear all memories
                  </button>
                </div>
              )}
              {memories
                .filter(m => m.content.toLowerCase().includes(filterQuery.toLowerCase()))
                .map((item) => (
                  <div
                    key={item.id}
                    className={`acrylic-card rounded-xl p-4 border text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                      item.enabled ? 'border-slate-200' : 'border-slate-200 bg-slate-50 opacity-75'
                    }`}
                  >
                    <div className="space-y-1.5 min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="px-2 py-0.5 rounded-full bg-sky-50 border border-sky-200 text-sky-700 font-bold uppercase text-[10px]">
                          {item.category}
                        </span>
                        {item.pinned && (
                          <span className="px-2 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-800 font-semibold text-[10px]">
                            Pinned
                          </span>
                        )}
                        <span className={`px-2 py-0.5 rounded-full font-semibold text-[10px] ${
                          item.enabled ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-600 border border-slate-200'
                        }`}>
                          {item.enabled ? 'Active' : 'Paused'}
                        </span>
                        {item.expiresAt && (
                          <span className="text-[10px] text-slate-500">
                            Expires {new Date(item.expiresAt).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-slate-900 break-words">{item.content}</p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => void handleToggleMemoryFlag(item, { pinned: !item.pinned })}
                        title={item.pinned ? 'Unpin memory' : 'Pin memory'}
                        className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold inline-flex items-center gap-1"
                      >
                        <Pin className="w-3 h-3" />
                        <span>{item.pinned ? 'Unpin' : 'Pin'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleToggleMemoryFlag(item, { enabled: !item.enabled })}
                        className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold inline-flex items-center gap-1"
                      >
                        {item.enabled ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                        <span>{item.enabled ? 'Pause' : 'Resume'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDeleteMemory(item.id)}
                        aria-label="Delete memory"
                        className="px-2.5 py-1.5 rounded-lg border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 font-semibold inline-flex items-center gap-1"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>Delete</span>
                      </button>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      ) : viewMode === 'automations' ? (
        <div className="space-y-3">
          {filteredLogs.length === 0 ? (
            <div className="acrylic-card rounded-2xl p-8 text-center text-slate-500 text-sm border border-slate-200">
              No automation logs recorded yet. Run commands from the companion overlay to see results here.
            </div>
          ) : (
            filteredLogs.map((log) => (
              <div
                key={log.id}
                className="acrylic-card rounded-xl p-4 border border-slate-200 text-xs space-y-2 shadow-sm"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900 font-mono text-sm">{log.tool}</span>
                    {log.verified ? (
                      <span className="flex items-center gap-1 text-[10px] text-emerald-700 font-bold px-2 py-0.5 rounded bg-emerald-50 border border-emerald-200">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        Verified
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-[10px] text-rose-700 font-bold px-2 py-0.5 rounded bg-rose-50 border border-rose-200">
                        <AlertCircle className="w-3 h-3 text-rose-600" />
                        Unverified
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-slate-500 text-[11px]">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {log.durationMs}ms
                    </span>
                    <span>•</span>
                    <span>{new Date(log.timestamp).toLocaleString()}</span>
                  </div>
                </div>

                <div className="p-2.5 rounded-lg bg-slate-50 font-mono text-[11px] text-slate-700 break-all border border-slate-200">
                  <span className="text-sky-700 font-bold">params:</span> {log.params}
                </div>
                <div className="p-2.5 rounded-lg bg-slate-50 font-mono text-[11px] text-slate-700 break-all border border-slate-200">
                  <span className="text-emerald-700 font-bold">output:</span> {log.result}
                </div>
              </div>
            ))
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredMessages.length === 0 ? (
            <div className="acrylic-card rounded-2xl p-8 text-center text-slate-500 text-sm border border-slate-200">
              No chat messages recorded yet.
            </div>
          ) : (
            filteredMessages.map((msg) => (
              <div
                key={msg.id}
                className={`p-4 rounded-xl text-xs space-y-1.5 border shadow-sm ${
                  msg.sender === 'user'
                    ? 'bg-sky-50/60 border-sky-200 ml-8'
                    : 'bg-white border-slate-200 mr-8'
                }`}
              >
                <div className="flex items-center justify-between text-slate-500 text-[10px]">
                  <span className="font-bold uppercase tracking-wider text-slate-700">
                    {msg.sender === 'user' ? 'You' : 'Companio'}
                  </span>
                  <span>{new Date(msg.timestamp).toLocaleString()}</span>
                </div>
                <p className="text-slate-800 text-sm leading-relaxed whitespace-pre-wrap break-words">{msg.content}</p>
                {Array.isArray(msg.taskReceipt?.steps) && msg.taskReceipt.steps.length ? <details className="mt-3 border-t border-slate-200 pt-3"><summary className="cursor-pointer font-semibold text-slate-700">{msg.taskReceipt.steps.length} action(s) · {msg.taskReceipt.status}</summary><ol className="mt-2 space-y-2">{msg.taskReceipt.steps.map((step,index)=><li key={index} className="flex justify-between gap-3"><span className="break-words min-w-0">{step.description}</span><span className="shrink-0 font-semibold capitalize">{step.outcome}</span></li>)}</ol></details>:null}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};
