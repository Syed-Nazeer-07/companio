import React, { useState, useEffect } from 'react';
import { dbService, AutomationLogRecord } from '../../services/dbService';
import { ChatMessage } from '../../types';
import { Search, Trash2, Download, CheckCircle2, AlertCircle, Clock } from 'lucide-react';

export const HistoryPage: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [logs, setLogs] = useState<AutomationLogRecord[]>([]);
  const [viewMode, setViewMode] = useState<'conversations' | 'automations'>('automations');
  const [filterQuery, setFilterQuery] = useState<string>('');
  const [exportStatus, setExportStatus] = useState<string>('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = () => {
    setMessages(dbService.getMessages());
    setLogs(dbService.getLogs());
  };

  const handleClearAll = () => {
    if (confirm('Clear all conversation history and automation logs?')) {
      dbService.clearMessages();
      dbService.clearLogs();
      loadData();
    }
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
            Search your conversations and command results, stored locally on this device.
          </p>
        </div>

        <div className="flex items-center gap-2">
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
            <span>Clear Logs</span>
          </button>
        </div>
      </div>

      {exportStatus && <p role="status" className="text-xs text-slate-600">{exportStatus}</p>}

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
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
            placeholder="Search records..."
            className="w-full pl-9 pr-3.5 py-2 rounded-xl bg-white border border-slate-200 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-sky-500 shadow-sm"
          />
        </div>
      </div>

      {/* Content View */}
      {viewMode === 'automations' ? (
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
                <p className="text-slate-800 text-sm leading-relaxed">{msg.content}</p>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};
