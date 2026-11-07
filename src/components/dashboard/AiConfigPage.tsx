import React, { useState, useEffect } from 'react';
import { AppSettings, AiProvider } from '../../types';
import { Cpu, Key, CheckCircle2, AlertCircle, RefreshCw, Zap, Server, Download, X, Check, Send } from 'lucide-react';
import { desktopBridge } from '../../services/desktopBridge';

const DEFAULT_LOCAL_ENDPOINT = 'http://127.0.0.1:11434/v1';

interface Props {
  settings: AppSettings;
  onUpdateSettings: (newSettings: Partial<AppSettings>) => void;
}

interface LocalModelStatus {
  id: string;
  name: string;
  sizeDisplay: string;
  installed: boolean;
  fileSize: number;
}

export const AiConfigPage: React.FC<Props> = ({ settings, onUpdateSettings }) => {
  const [testingConnection, setTestingConnection] = useState<boolean>(false);
  const [detectedLocalModels, setDetectedLocalModels] = useState<string[]>([]);
  const [testResult, setTestResult] = useState<{ success?: boolean; message?: string } | null>(null);

  // Live test chat
  const [testPrompt, setTestPrompt] = useState<string>('Who are you and what can you do?');
  const [testReply, setTestReply] = useState<string | null>(null);
  const [isTestingPrompt, setIsTestingPrompt] = useState<boolean>(false);

  // 1-Click built-in model download state
  const [modelsList, setModelsList] = useState<LocalModelStatus[]>([]);
  const [activeDownloadId, setActiveDownloadId] = useState<string | null>(null);
  const [downloadProgress, setDownloadProgress] = useState<{
    percent: number;
    speedMbps: string;
    receivedBytes: number;
    totalBytes: number;
  } | null>(null);

  useEffect(() => {
    loadModelsList();
    autoDetectOllama();

    const unsub = desktopBridge.onModelDownloadProgress((progress) => {
      if (progress.status === 'downloading') {
        setActiveDownloadId(progress.modelId);
        setDownloadProgress({
          percent: progress.percent,
          speedMbps: progress.speedMbps,
          receivedBytes: progress.receivedBytes,
          totalBytes: progress.totalBytes
        });
      } else if (progress.status === 'completed') {
        setActiveDownloadId(null);
        setDownloadProgress(null);
        loadModelsList();
      }
    });

    return () => unsub();
  }, []);

  const autoDetectOllama = async () => {
    const endpoint = settings.ai.localEndpoint || DEFAULT_LOCAL_ENDPOINT;
    const result = await desktopBridge.listLocalAiModels(endpoint);
    setDetectedLocalModels(result.success ? result.models : []);
    if (result.success) {
      setTestResult({
        success: result.models.length > 0,
        message: result.models.length > 0
          ? 'Local server connected. Select a model and try a prompt.'
          : 'Local server is running, but no models are available. Load a model in Ollama or LM Studio.'
      });
    } else {
      setTestResult({ success: false, message: result.error || 'Local server is not available.' });
    }
  };

  const loadModelsList = async () => {
    try {
      const list = await desktopBridge.getModelsStatus();
      if (Array.isArray(list)) {
        setModelsList(list);
      }
    } catch (e) {}
  };

  const handleStartDownload = async (modelId: string) => {
    setActiveDownloadId(modelId);
    setDownloadProgress({ percent: 0, speedMbps: '0', receivedBytes: 0, totalBytes: 0 });

    try {
      const res = await desktopBridge.downloadModel(modelId);
      if (res && res.success) {
        setTestResult({
          success: true,
          message: `Downloaded ${modelId}. This is a model file only; an inference runtime is still required.`
        });
        await loadModelsList();
      } else {
        setTestResult({ success: false, message: res?.error || res?.message || 'Download did not succeed.' });
      }
    } catch (err: any) {
      setTestResult({
        success: false,
        message: `Download error: ${err.message}`
      });
    } finally {
      setActiveDownloadId(null);
      setDownloadProgress(null);
    }
  };

  const handleCancelDownload = async () => {
    try {
      const result = await desktopBridge.cancelModelDownload();
      if (result?.success === false) {
        setTestResult({ success: false, message: result.error || 'Could not cancel the download.' });
        return;
      }
      setActiveDownloadId(null);
      setDownloadProgress(null);
      await loadModelsList();
    } catch (error) {
      setTestResult({ success: false, message: error instanceof Error ? error.message : 'Could not cancel the download.' });
    }
  };

  const handleManualCheck = async () => {
    setTestingConnection(true);
    setTestResult(null);
    try {
      await autoDetectOllama();
    } catch {
      setTestResult({ success: false, message: 'Could not check the local model server.' });
    } finally {
      setTestingConnection(false);
    }
  };

  const handleRunLiveTest = async () => {
    if (!testPrompt.trim()) return;
    setIsTestingPrompt(true);
    setTestReply(null);
    try {
      const result = await desktopBridge.chatLocalAi({
        endpoint: settings.ai.localEndpoint || DEFAULT_LOCAL_ENDPOINT,
        model: settings.ai.model || detectedLocalModels[0] || 'llama3.2:1b',
        prompt: testPrompt,
        temperature: settings.ai.temperature,
        systemPrompt: settings.ai.systemPrompt
      });
      setTestReply(result.success && result.reply
        ? result.reply
        : 'Local AI unavailable: ' + (result.error || 'No reply received.'));
    } catch (error) {
      setTestReply('Local AI request failed: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setIsTestingPrompt(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div>
        <h2 className="text-xl font-bold text-slate-900">AI Intelligence Settings</h2>
        <p className="text-xs text-slate-500 mt-1">
          Configure how Companio understands natural language conversations.
        </p>
      </div>

      {/* 3-Way Mode Selector */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Option 1: Local Offline LLM */}
        <div
          onClick={() => onUpdateSettings({ ai: {
            ...settings.ai,
            provider: 'local',
            model: detectedLocalModels.includes(settings.ai.model)
              ? settings.ai.model
              : (detectedLocalModels[0] || (settings.ai.model !== 'companio-deterministic-v1' ? settings.ai.model : 'llama3.2:1b')),
            localEndpoint: settings.ai.localEndpoint || DEFAULT_LOCAL_ENDPOINT
          } })}
          className={`p-4 rounded-2xl border cursor-pointer transition-all ${
            settings.ai.provider === 'local'
              ? 'bg-sky-50/70 border-sky-500 ring-2 ring-sky-500/20 shadow-sm'
              : 'bg-white border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Server className="w-4 h-4 text-sky-600" />
              <span className="text-xs font-bold text-slate-900">Local Offline LLM</span>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
              {settings.ai.provider === 'local' ? 'Selected' : 'Optional'}
            </span>
          </div>
          <p className="text-[11px] text-slate-500 leading-relaxed">
            Connects to a separately installed local inference server such as Ollama. Downloaded GGUF files are not automatically runnable.
          </p>
        </div>

        {/* Option 2: Built-in Fast Engine */}
        <div
          onClick={() => onUpdateSettings({ ai: { ...settings.ai, provider: 'mock' } })}
          className={`p-4 rounded-2xl border cursor-pointer transition-all ${
            settings.ai.provider === 'mock'
              ? 'bg-sky-50/70 border-sky-500 ring-2 ring-sky-500/20 shadow-sm'
              : 'bg-white border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-500 fill-amber-500" />
              <span className="text-xs font-bold text-slate-900">Built-in Engine</span>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
              No API Key
            </span>
          </div>
          <p className="text-[11px] text-slate-500 leading-relaxed">
            Fast offline handling for supported commands. Complex requests need a properly configured model.
          </p>
        </div>

        {/* Option 3: Cloud LLM */}
        <div
          onClick={() => onUpdateSettings({ ai: { ...settings.ai, provider: 'gemini' } })}
          className={`p-4 rounded-2xl border cursor-pointer transition-all ${
            settings.ai.provider === 'gemini' || settings.ai.provider === 'openai'
              ? 'bg-sky-50/70 border-sky-500 ring-2 ring-sky-500/20 shadow-sm'
              : 'bg-white border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Cpu className="w-4 h-4 text-indigo-500" />
              <span className="text-xs font-bold text-slate-900">Cloud API</span>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
              API Key
            </span>
          </div>
          <p className="text-[11px] text-slate-500 leading-relaxed">
            Experimental setting only. Cloud reasoning is not connected yet; a paid API key is not necessary for built-in or local commands.
          </p>
        </div>
      </div>

      {/* Local LLM Active Status & Live Test */}
      {settings.ai.provider === 'local' && (
        <div className="space-y-4">
          <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className={`w-2.5 h-2.5 rounded-full ${testResult?.success ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                <span className="text-xs font-bold text-slate-900">
                  Selected local model: <span className="font-mono text-sky-700">{settings.ai.model || 'No model selected'}</span>
                </span>
              </div>
              <button
                onClick={handleManualCheck}
                disabled={testingConnection}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-all"
              >
                <RefreshCw className={`w-3 h-3 ${testingConnection ? 'animate-spin' : ''}`} />
                <span>Check Connection</span>
              </button>
            </div>

            {testResult && (
              <div className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${
                testResult.success
                  ? 'bg-emerald-50/70 border-emerald-200 text-emerald-800'
                  : 'bg-amber-50/70 border-amber-200 text-amber-800'
              }`}>
                {testResult.success ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                )}
                <span>{testResult.message}</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-100">
              <label className="text-[11px] font-bold text-slate-600 space-y-1.5">
                <span className="block">Local server URL (Ollama / LM Studio)</span>
                <input
                  type="text"
                  value={settings.ai.localEndpoint || DEFAULT_LOCAL_ENDPOINT}
                  onChange={(e) => onUpdateSettings({ ai: { ...settings.ai, localEndpoint: e.target.value } })}
                  placeholder="http://127.0.0.1:11434/v1"
                  spellCheck={false}
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-xs font-mono focus:outline-none focus:border-sky-500"
                />
              </label>
              <label className="text-[11px] font-bold text-slate-600 space-y-1.5">
                <span className="block">Model name</span>
                <input
                  type="text"
                  list="companio-local-models"
                  value={settings.ai.model || ''}
                  onChange={(e) => onUpdateSettings({ ai: { ...settings.ai, model: e.target.value } })}
                  placeholder="Choose a model or enter its ID"
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-xs font-mono focus:outline-none focus:border-sky-500"
                />
                <datalist id="companio-local-models">
                  {detectedLocalModels.map((model) => <option key={model} value={model} />)}
                </datalist>
              </label>
            </div>
            <p className="text-[11px] text-slate-500">
              Ollama: http://127.0.0.1:11434/v1 · LM Studio: http://127.0.0.1:1234/v1.
              Start the server and load a model first. Only local addresses are accepted.
              Built-in Windows commands do not need an AI model.
            </p>

            {/* Quick Live Test Chat Box */}
            <div className="pt-2 border-t border-slate-100 space-y-2">
              <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                Live Model Test Prompt:
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={testPrompt}
                  onChange={(e) => setTestPrompt(e.target.value)}
                  placeholder="Ask your local LLM anything..."
                  className="flex-1 px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-xs font-medium focus:outline-none focus:border-sky-500 focus:bg-white"
                  onKeyDown={(e) => e.key === 'Enter' && handleRunLiveTest()}
                />
                <button
                  onClick={handleRunLiveTest}
                  disabled={isTestingPrompt || !testPrompt.trim()}
                  className="flex items-center gap-1 px-4 py-2 rounded-xl bg-sky-500 hover:bg-sky-600 text-white text-xs font-bold shadow-sm transition-all disabled:opacity-50"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{isTestingPrompt ? 'Thinking...' : 'Test'}</span>
                </button>
              </div>

              {testReply && (
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-800 animate-in fade-in duration-150">
                  <span className="font-bold text-sky-700 block mb-1">Companio (via {settings.ai.model}):</span>
                  <p className="leading-relaxed">{testReply}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Cloud API Key (only if cloud selected) */}
      {(settings.ai.provider === 'gemini' || settings.ai.provider === 'openai') && (
        <div className="p-4 rounded-2xl bg-white border border-slate-200 space-y-3 shadow-sm">
          <p role="status" className="text-xs text-amber-700">
            Cloud AI is not currently wired to the assistant. Do not enter production API keys; stored settings are not a secure key vault.
          </p>
          <div className="flex items-center gap-2">
            <Key className="w-4 h-4 text-sky-600" />
            <h3 className="text-xs font-bold text-slate-900">
              {settings.ai.provider === 'gemini' ? 'Google Gemini API Key' : 'OpenAI API Key'}
            </h3>
          </div>
          <input
            type="password"
            value={settings.ai.apiKey}
            onChange={(e) => onUpdateSettings({ ai: { ...settings.ai, apiKey: e.target.value } })}
            placeholder="Paste your API key here..."
            className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-xs font-mono focus:outline-none focus:border-sky-500 focus:bg-white"
          />
        </div>
      )}
    </div>
  );
};
