import React, { useState, useEffect } from 'react';
import { AppSettings, AiProvider } from '../../types';
import { Cpu, Key, CheckCircle2, AlertCircle, Sparkles, RefreshCw, Zap, Server, Download, HardDrive, X, Check } from 'lucide-react';
import { desktopBridge } from '../../services/desktopBridge';

interface Props {
  settings: AppSettings;
  onUpdateSettings: (newSettings: Partial<AppSettings>) => void;
}

interface LocalModelStatus {
  id: string;
  name: string;
  desc?: string;
  sizeDisplay: string;
  installed: boolean;
  fileSize: number;
  filePath?: string;
  isDownloading?: boolean;
}

export const AiConfigPage: React.FC<Props> = ({ settings, onUpdateSettings }) => {
  const [testingConnection, setTestingConnection] = useState<boolean>(false);
  const [detectedLocalModels, setDetectedLocalModels] = useState<string[]>([]);
  const [testResult, setTestResult] = useState<{ success?: boolean; message?: string } | null>(null);

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

    return () => {
      unsub();
    };
  }, []);

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
          message: `Model downloaded successfully! Activated ${modelId}.`
        });
        await loadModelsList();
        onUpdateSettings({
          ai: { ...settings.ai, provider: 'local', model: modelId }
        });
      } else if (res && res.error) {
        setTestResult({
          success: false,
          message: `Download failed: ${res.error}`
        });
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
      await desktopBridge.cancelModelDownload();
      setActiveDownloadId(null);
      setDownloadProgress(null);
      await loadModelsList();
    } catch (e) {}
  };

  const providers: { id: AiProvider; name: string; description: string; badge: string }[] = [
    {
      id: 'mock',
      name: 'Built-in Instant Engine',
      description: 'Zero setup, 0ms latency, zero API limits. Works 100% offline and controls apps & browsers immediately.',
      badge: 'Fast & Instant'
    },
    {
      id: 'local',
      name: 'Local Offline LLM',
      description: '1-click in-app model download or Ollama / LM Studio. Run smart Llama & SmolLM models 100% offline and private.',
      badge: 'Private & Offline'
    },
    {
      id: 'gemini',
      name: 'Google Gemini',
      description: 'Cloud multimodal reasoning powered by Gemini 1.5 Flash or Pro (requires Gemini API Key).',
      badge: 'Cloud'
    },
    {
      id: 'openai',
      name: 'OpenAI (GPT-4o)',
      description: 'Cloud reasoning powered by OpenAI GPT-4o / GPT-4o-mini (requires OpenAI API Key).',
      badge: 'Cloud'
    }
  ];

  const handleProviderChange = (providerId: AiProvider) => {
    onUpdateSettings({
      ai: {
        ...settings.ai,
        provider: providerId
      }
    });
  };

  const handleCheckLocalLLM = async () => {
    setTestingConnection(true);
    setTestResult(null);

    // Try detecting Ollama on localhost:11434
    try {
      const res = await fetch('http://localhost:11434/api/tags');
      if (res.ok) {
        const data = await res.json();
        const models = (data.models || []).map((m: any) => m.name);
        setDetectedLocalModels(models);
        setTestingConnection(false);
        setTestResult({
          success: true,
          message: `Connected to Ollama! Found ${models.length} model(s): ${models.join(', ') || 'None downloaded yet'}`
        });
        if (models.length > 0) {
          onUpdateSettings({
            ai: { ...settings.ai, provider: 'local', model: models[0] }
          });
        }
        return;
      }
    } catch (e) {
      // Ollama not reachable, try LM Studio on localhost:1234
    }

    try {
      const res = await fetch('http://localhost:1234/v1/models');
      if (res.ok) {
        const data = await res.json();
        const models = (data.data || []).map((m: any) => m.id);
        setDetectedLocalModels(models);
        setTestingConnection(false);
        setTestResult({
          success: true,
          message: `Connected to LM Studio! Found ${models.length} model(s): ${models.join(', ')}`
        });
        if (models.length > 0) {
          onUpdateSettings({
            ai: { ...settings.ai, provider: 'local', model: models[0] }
          });
        }
        return;
      }
    } catch (e) {}

    setTestingConnection(false);
    setTestResult({
      success: false,
      message: 'Could not connect to Ollama (port 11434) or LM Studio (port 1234). Use the 1-Click Built-in Downloader below to get a model directly!'
    });
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-200">
      <div>
        <h2 className="text-2xl font-bold text-slate-900 mb-1.5">AI Intelligence & Local LLMs</h2>
        <p className="text-sm text-slate-600">
          Choose between Companio's zero-latency built-in engine, offline local LLMs via Ollama/LM Studio, or cloud providers.
        </p>
      </div>

      {/* Provider Selector Cards */}
      <div>
        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-3">
          Select AI Provider
        </label>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {providers.map((p) => {
            const isSelected = settings.ai.provider === p.id;
            return (
              <div
                key={p.id}
                onClick={() => handleProviderChange(p.id)}
                className={`acrylic-card rounded-2xl p-5 cursor-pointer relative border transition-all ${
                  isSelected
                    ? 'border-sky-500 ring-2 ring-sky-500/20 bg-sky-50/60 shadow-md'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                    {p.id === 'mock' && <Zap className="w-4 h-4 text-amber-500 fill-amber-500" />}
                    {p.id === 'local' && <Server className="w-4 h-4 text-sky-600" />}
                    {p.id !== 'mock' && p.id !== 'local' && <Cpu className="w-4 h-4 text-indigo-500" />}
                    <span>{p.name}</span>
                  </h4>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    isSelected ? 'bg-sky-500 text-white' : 'bg-slate-100 text-slate-600 border border-slate-200'
                  }`}>
                    {p.badge}
                  </span>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">
                  {p.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Local LLM Setup Panel */}
      {settings.ai.provider === 'local' && (
        <div className="space-y-6">
          {/* 1-Click In-App Model Downloader */}
          <div className="acrylic-card rounded-2xl p-6 border border-sky-200 bg-sky-50/40 space-y-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Download className="w-4 h-4 text-sky-600" />
                  <span>1-Click Built-in Offline Models (No Terminal or Ollama Needed)</span>
                </h3>
                <p className="text-xs text-slate-600 mt-1">
                  Download lightweight AI models directly inside Companio. Runs 100% locally and privately on your Windows PC.
                </p>
              </div>
              <button
                onClick={loadModelsList}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-semibold shadow-sm transition-all"
              >
                <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
                <span>Refresh</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {modelsList.map((m) => {
                const isDownloadingThis = activeDownloadId === m.id;
                const isCurrentModel = settings.ai.model === m.id || (m.id === 'llama3.2-1b' && (!settings.ai.model || settings.ai.model.includes('llama3.2')));

                return (
                  <div
                    key={m.id}
                    className={`p-4 rounded-xl border flex flex-col justify-between transition-all ${
                      isCurrentModel
                        ? 'bg-white border-sky-500 ring-2 ring-sky-500/20 shadow-md'
                        : 'bg-white/80 border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-bold text-slate-900 line-clamp-1">{m.name}</span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 shrink-0">
                          {m.sizeDisplay}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 leading-tight mb-3">
                        {m.id === 'llama3.2-1b' && 'Smartest meta model for intent & natural speech.'}
                        {m.id === 'smollm2-360m' && 'Ultra-lightweight. Near zero RAM footprint.'}
                        {m.id === 'qwen2.5-0.5b' && 'Excellent reasoning and quick command accuracy.'}
                      </p>
                    </div>

                    <div className="pt-2 border-t border-slate-100">
                      {isDownloadingThis && downloadProgress ? (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-[10px] font-semibold text-sky-800">
                            <span>Downloading... {downloadProgress.percent}%</span>
                            <span>{downloadProgress.speedMbps} MB/s</span>
                          </div>
                          <div className="w-full bg-sky-100 rounded-full h-2 overflow-hidden">
                            <div
                              className="bg-sky-500 h-full rounded-full transition-all duration-200"
                              style={{ width: `${downloadProgress.percent}%` }}
                            />
                          </div>
                          <button
                            onClick={handleCancelDownload}
                            className="w-full flex items-center justify-center gap-1 py-1 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100 text-[10px] font-bold"
                          >
                            <X className="w-3 h-3" />
                            <span>Cancel</span>
                          </button>
                        </div>
                      ) : m.installed ? (
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[10px] font-bold text-emerald-600 flex items-center gap-1">
                            <Check className="w-3.5 h-3.5" />
                            <span>Installed</span>
                          </span>
                          <button
                            onClick={() => onUpdateSettings({ ai: { ...settings.ai, provider: 'local', model: m.id } })}
                            className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                              isCurrentModel
                                ? 'bg-emerald-500 text-white shadow-sm'
                                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                            }`}
                          >
                            {isCurrentModel ? 'Active' : 'Select'}
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleStartDownload(m.id)}
                          disabled={activeDownloadId !== null}
                          className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-xl bg-sky-500 hover:bg-sky-600 text-white text-xs font-bold shadow-sm transition-all disabled:opacity-50"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>1-Click Download</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* External Ollama / LM Studio (For Advanced Users) */}
          <div className="acrylic-card rounded-2xl p-6 border border-slate-200 bg-white/60 space-y-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Server className="w-4 h-4 text-indigo-600" />
                  <span>External Server (Ollama / LM Studio)</span>
                </h3>
                <p className="text-xs text-slate-600 mt-1">
                  Already have Ollama or LM Studio installed? Connect directly via localhost.
                </p>
              </div>
              <button
                onClick={handleCheckLocalLLM}
                disabled={testingConnection}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white text-xs font-bold shadow-md shadow-indigo-500/20 transition-all disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${testingConnection ? 'animate-spin' : ''}`} />
                <span>Detect Local Models</span>
              </button>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Local Model Tag (e.g. llama3.2:1b, qwen2.5:1.5b):
              </label>
              <input
                type="text"
                value={settings.ai.model || 'llama3.2:1b'}
                onChange={(e) => onUpdateSettings({ ai: { ...settings.ai, model: e.target.value } })}
                placeholder="e.g. llama3.2:1b, qwen2.5:1.5b"
                className="w-full px-3.5 py-2 rounded-xl bg-white border border-slate-300 text-slate-900 text-xs font-mono font-bold focus:outline-none focus:border-indigo-500 shadow-sm"
              />
            </div>

            {detectedLocalModels.length > 0 && (
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Detected Models:
                </label>
                <select
                  value={settings.ai.model}
                  onChange={(e) => onUpdateSettings({ ai: { ...settings.ai, model: e.target.value } })}
                  className="w-full px-3.5 py-2 rounded-xl bg-white border border-slate-300 text-slate-900 text-xs font-bold focus:outline-none focus:border-indigo-500"
                >
                  {detectedLocalModels.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Cloud API Key (only if cloud provider selected) */}
      {(settings.ai.provider === 'gemini' || settings.ai.provider === 'openai') && (
        <div className="acrylic-card rounded-2xl p-6 border border-slate-200 space-y-4 shadow-sm">
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Key className="w-4 h-4 text-sky-600" />
            <span>API Key Configuration</span>
          </h3>
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              {settings.ai.provider === 'gemini' ? 'Google Gemini API Key' : 'OpenAI API Key'}
            </label>
            <input
              type="password"
              value={settings.ai.apiKey}
              onChange={(e) => onUpdateSettings({ ai: { ...settings.ai, apiKey: e.target.value } })}
              placeholder="sk-..."
              className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 text-xs font-mono focus:outline-none focus:border-sky-500 focus:bg-white"
            />
          </div>
        </div>
      )}

      {/* Connection Test Banner */}
      {testResult && (
        <div className={`p-4 rounded-2xl border text-xs flex items-center gap-2.5 shadow-sm ${
          testResult.success
            ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
            : 'bg-amber-50 border-amber-200 text-amber-800'
        }`}>
          {testResult.success ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
          )}
          <span className="font-medium">{testResult.message}</span>
        </div>
      )}
    </div>
  );
};
