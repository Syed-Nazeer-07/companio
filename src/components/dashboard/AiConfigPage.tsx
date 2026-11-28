import React, { useState, useEffect, useRef } from 'react';
import { AppSettings } from '../../types';
import {
  Cpu,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Zap,
  Server,
  Send,
  ShieldCheck,
  KeyRound,
  Trash2,
  Download,
  Pause,
  Play,
  Square,
  HardDrive,
  FolderOpen,
  BatteryCharging,
  Sparkles,
  Wrench
} from 'lucide-react';
import { desktopBridge, isNativeDesktop } from '../../services/desktopBridge';

const DEFAULT_LOCAL_ENDPOINT = 'http://127.0.0.1:11434/v1';

type CloudProviderId = 'openai' | 'gemini' | 'anthropic' | 'groq' | 'openrouter' | 'custom_openai';

const CLOUD_PROVIDER_LIST: CloudProviderId[] = [
  'openai',
  'gemini',
  'anthropic',
  'groq',
  'openrouter',
  'custom_openai'
];

const CLOUD_DEFAULT_MODELS: Record<CloudProviderId, string> = {
  openai: 'gpt-4o-mini',
  gemini: 'gemini-2.0-flash',
  anthropic: 'claude-3-5-haiku-latest',
  groq: 'llama-3.3-70b-versatile',
  openrouter: 'openai/gpt-4o-mini',
  custom_openai: 'gpt-4o-mini'
};

interface Props {
  settings: AppSettings;
  onUpdateSettings: (newSettings: Partial<AppSettings>) => void;
}

export const AiConfigPage: React.FC<Props> = ({ settings, onUpdateSettings }) => {
  const [testingConnection, setTestingConnection] = useState<boolean>(false);
  const [detectedLocalModels, setDetectedLocalModels] = useState<string[]>([]);
  const [testResult, setTestResult] = useState<{ success?: boolean; message?: string } | null>(null);

  // Managed Local AI state
  const [managedStatus, setManagedStatus] = useState<any>(null);
  const [managedProgress, setManagedProgress] = useState<any>(null);
  const [managedFeedback, setManagedFeedback] = useState<{ kind: 'info' | 'success' | 'error'; text: string } | null>(null);
  const [managedBusy, setManagedBusy] = useState<boolean>(false);

  // Live test chat
  const [testPrompt, setTestPrompt] = useState<string>('Give me one short productivity tip.');
  const [testReply, setTestReply] = useState<string | null>(null);
  const [isTestingPrompt, setIsTestingPrompt] = useState<boolean>(false);
  const activeStreamIdRef = useRef<string | null>(null);

  // Cloud DPAPI credentials (write-only; decrypted strictly in Electron main process)
  const [cloudStatus, setCloudStatus] = useState<Awaited<ReturnType<typeof desktopBridge.getCloudAiStatus>> | null>(null);
  const [cloudKeyDraft, setCloudKeyDraft] = useState('');
  const [cloudKeyFeedback, setCloudKeyFeedback] = useState('');
  const [cloudDiagFeedback, setCloudDiagFeedback] = useState<{ ok: boolean; text: string } | null>(null);
  const [savingCloudKey, setSavingCloudKey] = useState(false);
  const [testingCloudConn, setTestingCloudConn] = useState(false);

  const isCloudProvider = CLOUD_PROVIDER_LIST.includes(settings.ai.provider as CloudProviderId);
  const activeCloudProvider: CloudProviderId = isCloudProvider
    ? (settings.ai.provider as CloudProviderId)
    : 'openai';

  const isManagedMode = settings.ai.provider === 'auto' || settings.ai.provider === 'managed_local';

  const refreshManagedStatus = async () => {
    try {
      const res = await desktopBridge.getManagedAiStatus();
      if (res && typeof res === 'object') {
        setManagedStatus(res);
      }
    } catch {}
  };

  const refreshCloudStatus = async () => {
    try {
      const status = await desktopBridge.getCloudAiStatus();
      setCloudStatus(status);
    } catch {}
  };

  useEffect(() => {
    if (settings.ai.provider === 'local') {
      void autoDetectOllama();
    }
    void refreshManagedStatus();
    void refreshCloudStatus();

    const unbindProgress = desktopBridge.onManagedAiProgress((progress) => {
      setManagedProgress(progress);
      if (progress?.phase === 'done' || progress?.status === 'completed') {
        void refreshManagedStatus();
      }
    });
    const unbindToken = desktopBridge.onManagedAiToken((chunk) => {
      if (activeStreamIdRef.current && chunk?.requestId === activeStreamIdRef.current && chunk.full) {
        setTestReply(chunk.full);
      }
    });
    return () => {
      unbindProgress();
      unbindToken();
    };
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

  const handleFindLocalAi = async () => {
    setTestingConnection(true);
    setTestResult(null);
    setTestReply(null);
    try {
      const result = await desktopBridge.discoverLocalAi(settings.ai.localEndpoint || DEFAULT_LOCAL_ENDPOINT);
      if (!result.success || !result.endpoint) {
        setDetectedLocalModels([]);
        setTestResult({ success: false, message: result.error || 'No local AI server was found.' });
        return;
      }
      setDetectedLocalModels(result.models);
      const model = result.models.includes(settings.ai.model)
        ? settings.ai.model
        : (result.models[0] || '');
      onUpdateSettings({
        ai: { ...settings.ai, provider: 'local', localEndpoint: result.endpoint, model }
      });
      setTestResult({
        success: result.models.length > 0,
        message: result.models.length > 0
          ? `Found ${result.models.length} available model(s) at ${result.endpoint}. Selected ${model}.`
          : `Found a running local server at ${result.endpoint}, but no models are loaded.`
      });
    } catch (error) {
      setTestResult({
        success: false,
        message: error instanceof Error ? error.message : 'Could not discover local model servers.'
      });
    } finally {
      setTestingConnection(false);
    }
  };

  const handleInstallBundle = async (modelId?: string) => {
    if (managedBusy) return;
    setManagedBusy(true);
    setManagedFeedback({ kind: 'info', text: 'Downloading and verifying private Local AI runtime & model...' });
    try {
      const targetId = modelId || managedStatus?.recommendedModelId || 'qwen2.5-1.5b';
      const res = await desktopBridge.installManagedAiBundle({ modelId: targetId });
      setManagedProgress(null);
      await refreshManagedStatus();
      if (res?.success) {
        onUpdateSettings({ ai: { ...settings.ai, managedModelId: targetId } });
        setManagedFeedback({ kind: 'success', text: `Local AI ready (${targetId}). Inference works completely offline.` });
      } else if (res?.paused) {
        setManagedFeedback({ kind: 'info', text: 'Download paused safely. Click Resume anytime to continue.' });
      } else {
        setManagedFeedback({ kind: 'error', text: res?.error || 'Could not install Local AI bundle.' });
      }
    } catch (err) {
      setManagedFeedback({ kind: 'error', text: err instanceof Error ? err.message : 'Installation failed.' });
    } finally {
      setManagedBusy(false);
    }
  };

  const handleInstallModelOnly = async (modelId: string) => {
    if (managedBusy) return;
    setManagedBusy(true);
    setManagedFeedback({ kind: 'info', text: `Installing model ${modelId}...` });
    try {
      const res = !managedStatus?.runtimeInstalled
        ? await desktopBridge.installManagedAiBundle({ modelId })
        : await desktopBridge.installManagedAiModel(modelId);
      setManagedProgress(null);
      await refreshManagedStatus();
      if (res?.success) {
        setManagedFeedback({ kind: 'success', text: `Model ${modelId} verified and ready.` });
      } else if (res?.paused) {
        setManagedFeedback({ kind: 'info', text: 'Download paused safely.' });
      } else {
        setManagedFeedback({ kind: 'error', text: res?.error || `Failed to install ${modelId}.` });
      }
    } finally {
      setManagedBusy(false);
    }
  };

  const handleSelectActiveModel = async (modelId: string) => {
    const res = await desktopBridge.setActiveManagedAiModel(modelId);
    await refreshManagedStatus();
    if (res?.success) {
      onUpdateSettings({ ai: { ...settings.ai, managedModelId: modelId } });
      setManagedFeedback({ kind: 'success', text: `Switched active local model to ${modelId}.` });
    } else {
      setManagedFeedback({ kind: 'error', text: res?.error || 'Could not switch active model.' });
    }
  };

  const handleRepairModel = async (modelId: string) => {
    setManagedBusy(true);
    setManagedFeedback({ kind: 'info', text: `Verifying and repairing ${modelId}...` });
    try {
      const res = await desktopBridge.repairManagedAiModel(modelId);
      setManagedProgress(null);
      await refreshManagedStatus();
      setManagedFeedback(res?.success
        ? { kind: 'success', text: `${modelId} checksum verified cleanly.` }
        : { kind: 'error', text: res?.error || `Could not repair ${modelId}.` });
    } finally {
      setManagedBusy(false);
    }
  };

  const handleDeleteModel = async (modelId: string) => {
    const res = await desktopBridge.deleteManagedAiModel(modelId);
    await refreshManagedStatus();
    setManagedFeedback(res?.success
      ? { kind: 'info', text: `Removed local weights for ${modelId}.` }
      : { kind: 'error', text: res?.error || `Could not remove ${modelId}.` });
  };

  const handleImportGguf = async () => {
    const res = await desktopBridge.importManagedAiModel();
    await refreshManagedStatus();
    if (res?.cancelled) return;
    setManagedFeedback(res?.success
      ? { kind: 'success', text: 'Imported custom local GGUF model.' }
      : { kind: 'error', text: res?.error || 'Could not import GGUF file.' });
  };

  const handleToggleRuntime = async () => {
    setManagedBusy(true);
    try {
      const isRunning = Boolean(managedStatus?.runtimeProcess?.running);
      const res = isRunning ? await desktopBridge.stopManagedAi() : await desktopBridge.startManagedAi();
      await refreshManagedStatus();
      setManagedFeedback(res?.success
        ? { kind: 'success', text: isRunning ? 'Local AI worker unloaded from RAM.' : 'Local AI runtime started and warm.' }
        : { kind: 'error', text: res?.error || 'Could not change Local AI runtime state.' });
    } finally {
      setManagedBusy(false);
    }
  };

  const handleHealthCheck = async () => {
    setManagedBusy(true);
    try {
      const res = await desktopBridge.verifyManagedAiHealth();
      await refreshManagedStatus();
      setManagedFeedback(res?.ok && res?.verified
        ? { kind: 'success', text: `Health check verified cleanly (${res.latencyMs ?? '?'} ms).` }
        : { kind: 'error', text: res?.error || 'Local AI health check did not complete.' });
    } finally {
      setManagedBusy(false);
    }
  };

  const handlePerformanceMode = async (mode: 'battery_saver' | 'balanced' | 'performance') => {
    onUpdateSettings({ ai: { ...settings.ai, performanceMode: mode } });
    await desktopBridge.setManagedAiPerformanceMode(mode);
    await refreshManagedStatus();
  };

  const handleRunLiveTest = async () => {
    if (!testPrompt.trim() || isTestingPrompt) return;
    if (settings.ai.provider === 'local' && (!settings.ai.model || settings.ai.model === 'companio-deterministic-v1')) {
      setTestReply('Choose a loaded external local model before testing.');
      return;
    }
    setIsTestingPrompt(true);
    setTestReply(null);
    const reqId = 'test_' + Date.now();
    activeStreamIdRef.current = reqId;
    try {
      const result = isManagedMode
        ? await desktopBridge.chatManagedAi({
            prompt: testPrompt,
            temperature: settings.ai.temperature,
            systemPrompt: settings.ai.systemPrompt,
            stream: true,
            requestId: reqId
          })
        : isCloudProvider
          ? await desktopBridge.chatCloudAi({
              provider: activeCloudProvider,
              model: settings.ai.model || CLOUD_DEFAULT_MODELS[activeCloudProvider],
              customEndpoint: settings.ai.cloudCustomEndpoint,
              prompt: testPrompt,
              temperature: settings.ai.temperature,
              systemPrompt: settings.ai.systemPrompt
            })
          : await desktopBridge.chatLocalAi({
              endpoint: settings.ai.localEndpoint || DEFAULT_LOCAL_ENDPOINT,
              model: settings.ai.model || detectedLocalModels[0] || 'llama3.2:1b',
              prompt: testPrompt,
              temperature: settings.ai.temperature,
              systemPrompt: settings.ai.systemPrompt
            });
      setTestReply(result.success && result.reply
        ? result.reply
        : 'AI status: ' + (result.error || 'No reply received.'));
    } catch (error) {
      setTestReply('AI test request failed: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      activeStreamIdRef.current = null;
      setIsTestingPrompt(false);
    }
  };

  const handleSaveCloudKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cloudKeyDraft.trim() || savingCloudKey) return;
    setSavingCloudKey(true);
    setCloudKeyFeedback('');
    try {
      const res = await desktopBridge.setCloudAiKey(activeCloudProvider, cloudKeyDraft.trim());
      if (res.success) {
        setCloudKeyDraft('');
        setCloudKeyFeedback(`API key encrypted and stored via Windows DPAPI (${res.hint || '••••'}).`);
        await refreshCloudStatus();
      } else {
        setCloudKeyFeedback(res.error || 'Could not save encrypted API key.');
      }
    } finally {
      setSavingCloudKey(false);
    }
  };

  const handleClearCloudKey = async () => {
    setCloudKeyFeedback('');
    setCloudDiagFeedback(null);
    const res = await desktopBridge.clearCloudAiKey(activeCloudProvider);
    if (res.success) {
      setCloudKeyFeedback('Stored API key removed.');
      await refreshCloudStatus();
    } else {
      setCloudKeyFeedback(res.error || 'Could not remove stored API key.');
    }
  };

  const handleTestCloudConnection = async () => {
    if (testingCloudConn) return;
    setTestingCloudConn(true);
    setCloudDiagFeedback(null);
    try {
      const res = await desktopBridge.testCloudAi({
        provider: activeCloudProvider,
        model: settings.ai.model || CLOUD_DEFAULT_MODELS[activeCloudProvider],
        customEndpoint: settings.ai.cloudCustomEndpoint
      });
      setCloudDiagFeedback(res.success
        ? { ok: true, text: `Connected to ${activeCloudProvider} (${res.model}) in ${res.latencyMs ?? '?'} ms.` }
        : { ok: false, text: res.error || 'Could not verify cloud provider connection.' });
    } finally {
      setTestingCloudConn(false);
    }
  };

  const catalogModels: any[] = Array.isArray(managedStatus?.models) && managedStatus.models.length > 0
    ? managedStatus.models
    : [
        { id: 'qwen3-0.6b', name: 'Qwen 3 0.6B', sizeDisplay: '378 MB', minRamGB: 4, tier: 'Fast & Ultra-Light', recommended: false, installed: false, license: 'Apache-2.0' },
        { id: 'qwen2.5-1.5b', name: 'Qwen 2.5 1.5B Instruct', sizeDisplay: '1.04 GB', minRamGB: 8, tier: 'Balanced Everyday Default', recommended: true, installed: false, license: 'Apache-2.0' },
        { id: 'qwen3-1.7b', name: 'Qwen 3 1.7B', sizeDisplay: '1.03 GB', minRamGB: 8, tier: 'Rich Reasoning', recommended: false, installed: false, license: 'Apache-2.0' },
        { id: 'qwen3-4b', name: 'Qwen 3 4B', sizeDisplay: '2.33 GB', minRamGB: 16, tier: 'High Capability', recommended: false, installed: false, license: 'Apache-2.0' }
      ];

  const hw = managedStatus?.hardware || {};
  const isDownloading = Boolean(managedStatus?.activeDownload || (managedProgress && !['done', 'cancelled'].includes(managedProgress.phase)));
  const isPaused = Boolean(managedStatus?.activeDownload?.paused || managedProgress?.paused);

  return (
    <div className="space-y-6 animate-in fade-in duration-200 max-w-5xl">
      <div>
        <h2 className="text-xl font-bold text-slate-900">AI Intelligence Hub</h2>
        <p className="text-xs text-slate-500 mt-1">
          Built-in offline intelligence works immediately. Optionally enable Companio&apos;s private on-device LLM runtime or connect a cloud API key.
        </p>
      </div>

      {/* 4-Way Intelligence Mode Selector */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        <button
          type="button"
          onClick={() => onUpdateSettings({ ai: { ...settings.ai, provider: 'auto' } })}
          className={`p-4 rounded-2xl border cursor-pointer transition-all text-left ${
            settings.ai.provider === 'auto'
              ? 'bg-emerald-50/70 border-emerald-700 ring-2 ring-emerald-700/20 shadow-sm'
              : 'bg-white border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-emerald-700" />
              <span className="text-xs font-bold text-slate-900">Smart Hybrid Auto</span>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
              Recommended
            </span>
          </div>
          <p className="text-[11px] text-slate-500 leading-relaxed">
            Instant built-in offline commands + private Managed Local AI automatically when installed.
          </p>
        </button>

        <button
          type="button"
          onClick={() => onUpdateSettings({ ai: { ...settings.ai, provider: 'managed_local' } })}
          className={`p-4 rounded-2xl border cursor-pointer transition-all text-left ${
            settings.ai.provider === 'managed_local'
              ? 'bg-emerald-50/70 border-emerald-700 ring-2 ring-emerald-700/20 shadow-sm'
              : 'bg-white border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <HardDrive className="w-4 h-4 text-emerald-700" />
              <span className="text-xs font-bold text-slate-900">Managed Local AI</span>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
              On-Device
            </span>
          </div>
          <p className="text-[11px] text-slate-500 leading-relaxed">
            Companio-managed GGUF models with zero Ollama setup and zero recurring API fees.
          </p>
        </button>

        <button
          type="button"
          onClick={() => onUpdateSettings({ ai: { ...settings.ai, provider: 'mock' } })}
          className={`p-4 rounded-2xl border cursor-pointer transition-all text-left ${
            settings.ai.provider === 'mock'
              ? 'bg-emerald-50/70 border-emerald-700 ring-2 ring-emerald-700/20 shadow-sm'
              : 'bg-white border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-500 fill-amber-500" />
              <span className="text-xs font-bold text-slate-900">Built-in Engine</span>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
              No Download
            </span>
          </div>
          <p className="text-[11px] text-slate-500 leading-relaxed">
            Lightweight deterministic desktop commands, math, timers, notes, and character replies.
          </p>
        </button>

        <button
          type="button"
          onClick={() => onUpdateSettings({
            ai: {
              ...settings.ai,
              provider: isCloudProvider ? activeCloudProvider : 'openai',
              model: isCloudProvider ? settings.ai.model : CLOUD_DEFAULT_MODELS.openai,
              apiKey: ''
            }
          })}
          className={`p-4 rounded-2xl border cursor-pointer transition-all text-left ${
            isCloudProvider
              ? 'bg-emerald-50/70 border-emerald-700 ring-2 ring-emerald-700/20 shadow-sm'
              : 'bg-white border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Cpu className="w-4 h-4 text-emerald-700" />
              <span className="text-xs font-bold text-slate-900">Cloud API</span>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
              {isCloudProvider ? 'Selected' : 'DPAPI Vault'}
            </span>
          </div>
          <p className="text-[11px] text-slate-500 leading-relaxed">
            Optional OpenAI, Gemini, Claude, Groq, OpenRouter, or custom HTTPS endpoint (DPAPI-encrypted).
          </p>
        </button>
      </div>

      {/* Managed Local AI Hub & Model Manager */}
      {isManagedMode && (
        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-5">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <span className={`w-2.5 h-2.5 rounded-full ${managedStatus?.ready ? 'bg-emerald-500' : 'bg-amber-400'}`} />
                <span>Companio Local AI Runtime &amp; Model Manager</span>
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                {hw.arch ? `${String(hw.arch).toUpperCase()} · ${hw.totalRamGB || '?'} GB RAM · Runtime: ${hw.defaultRuntimeVariantId || 'cpu'}` : 'Detects hardware architecture, RAM, and disk space automatically.'}
                {typeof hw.diskFreeGB === 'number' ? ` · ${hw.diskFreeGB} GB free` : ''}
                {managedStatus?.onBatteryPower ? ' · On Battery (Eco)' : ''}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {!managedStatus?.ready ? (
                <button
                  type="button"
                  disabled={managedBusy || !isNativeDesktop()}
                  onClick={() => void handleInstallBundle()}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold disabled:opacity-50"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Install Recommended AI (~1.05 GB)</span>
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    disabled={managedBusy}
                    onClick={() => void handleToggleRuntime()}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold disabled:opacity-50"
                  >
                    {managedStatus?.runtimeProcess?.running ? <Square className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                    <span>{managedStatus?.runtimeProcess?.running ? 'Unload Worker' : 'Warm Up Engine'}</span>
                  </button>
                  <button
                    type="button"
                    disabled={managedBusy}
                    onClick={() => void handleHealthCheck()}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3 h-3 ${managedBusy ? 'animate-spin' : ''}`} />
                    <span>Verify Health</span>
                  </button>
                </>
              )}
              <button
                type="button"
                disabled={!isNativeDesktop() || managedBusy}
                onClick={() => void handleImportGguf()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold disabled:opacity-50"
              >
                <FolderOpen className="w-3.5 h-3.5" />
                <span>Import .gguf</span>
              </button>
            </div>
          </div>

          {/* Live Download Progress + Pause/Resume/Cancel */}
          {(isDownloading || managedProgress) && (
            <div className="p-3.5 rounded-xl bg-emerald-50/70 border border-emerald-200 space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold text-emerald-900">
                <span>
                  {managedProgress?.message || `Downloading ${managedProgress?.phase || 'Local AI'}...`}
                </span>
                <span>{managedProgress?.percent != null ? `${managedProgress.percent}%` : ''}</span>
              </div>
              <div className="w-full h-2 rounded-full bg-emerald-100 overflow-hidden">
                <div
                  className="h-full bg-emerald-700 transition-all duration-200"
                  style={{ width: `${Math.max(4, Math.min(100, Number(managedProgress?.percent || 0)))}%` }}
                />
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-emerald-800">
                <span>
                  {managedProgress?.receivedBytes != null
                    ? `${Math.round(managedProgress.receivedBytes / 1048576)} / ${Math.round((managedProgress.totalBytes || 0) / 1048576)} MB`
                    : 'Preparing download...'}
                  {managedProgress?.speedMbps ? ` · ${managedProgress.speedMbps} MB/s` : ''}
                </span>
                <div className="flex items-center gap-2">
                  {isPaused ? (
                    <button
                      type="button"
                      onClick={() => void desktopBridge.resumeManagedAiDownload()}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-700 text-white font-semibold"
                    >
                      <Play className="w-3 h-3" /> Resume
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => void desktopBridge.pauseManagedAiDownload()}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white border border-emerald-300 text-emerald-900 font-semibold"
                    >
                      <Pause className="w-3 h-3" /> Pause
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => void desktopBridge.cancelManagedAiDownload({ discardPartial: false })}
                    className="px-2.5 py-1 rounded-lg bg-white border border-rose-200 text-rose-700 font-semibold"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          {managedFeedback && (
            <div role="status" className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${
              managedFeedback.kind === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : managedFeedback.kind === 'error'
                  ? 'bg-rose-50 border-rose-200 text-rose-800'
                  : 'bg-slate-50 border-slate-200 text-slate-700'
            }`}>
              {managedFeedback.kind === 'success'
                ? <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                : <AlertCircle className="w-4 h-4 shrink-0" />}
              <span>{managedFeedback.text}</span>
            </div>
          )}

          {/* Supported GGUF Model Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {catalogModels.map((model: any) => {
              const isActive = (managedStatus?.activeModelId || settings.ai.managedModelId) === model.id;
              return (
                <div
                  key={model.id}
                  className={`p-3.5 rounded-xl border flex flex-col justify-between gap-2.5 ${
                    isActive && model.installed
                      ? 'border-emerald-700 bg-emerald-50/40'
                      : 'border-slate-200 bg-slate-50/60'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-slate-900">{model.name}</span>
                      <div className="flex items-center gap-1">
                        {model.recommended && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                            Recommended
                          </span>
                        )}
                        {model.installed && isActive && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-700 text-white">
                            Active
                          </span>
                        )}
                      </div>
                    </div>
                    <p className="text-[11px] text-slate-600 mt-1">
                      {model.tier || 'Verified GGUF'} · {model.sizeDisplay} · Min {model.minRamGB || 4} GB RAM · {model.license || 'Apache-2.0'}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    {!model.installed ? (
                      <button
                        type="button"
                        disabled={managedBusy || !isNativeDesktop()}
                        onClick={() => void handleInstallModelOnly(model.id)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-[11px] font-semibold disabled:opacity-50"
                      >
                        <Download className="w-3 h-3" /> Install
                      </button>
                    ) : (
                      <>
                        {!isActive && (
                          <button
                            type="button"
                            disabled={managedBusy}
                            onClick={() => void handleSelectActiveModel(model.id)}
                            className="px-2.5 py-1 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-[11px] font-semibold"
                          >
                            Use Active
                          </button>
                        )}
                        <button
                          type="button"
                          disabled={managedBusy}
                          onClick={() => void handleRepairModel(model.id)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white border border-slate-200 hover:border-slate-300 text-slate-700 text-[11px] font-semibold"
                        >
                          <Wrench className="w-3 h-3" /> Repair
                        </button>
                        <button
                          type="button"
                          disabled={managedBusy}
                          onClick={() => void handleDeleteModel(model.id)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white border border-rose-200 text-rose-700 text-[11px] font-semibold"
                        >
                          <Trash2 className="w-3 h-3" /> Remove
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Battery & CPU Performance Mode */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-slate-100">
            <div className="flex items-center gap-2">
              <BatteryCharging className="w-4 h-4 text-emerald-700" />
              <div>
                <span className="text-xs font-bold text-slate-800 block">Performance &amp; Battery Profile</span>
                <span className="text-[11px] text-slate-500">Controls CPU thread budget and idle worker unload timer.</span>
              </div>
            </div>
            <div className="flex items-center gap-1.5" role="group" aria-label="Local AI performance mode">
              {([
                { id: 'battery_saver', label: 'Battery Saver' },
                { id: 'balanced', label: 'Balanced' },
                { id: 'performance', label: 'Performance' }
              ] as const).map((item) => {
                const active = (settings.ai.performanceMode || 'balanced') === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => void handlePerformanceMode(item.id)}
                    className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold border transition-colors ${
                      active
                        ? 'bg-emerald-700 text-white border-emerald-700'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Live Managed Local AI Test Chat */}
          <div className="pt-3 border-t border-slate-100 space-y-2">
            <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider">
              Live Offline Local AI Test:
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={testPrompt}
                onChange={(e) => setTestPrompt(e.target.value)}
                placeholder="Try asking your on-device model anything..."
                className="flex-1 px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-xs font-medium focus:outline-none focus:border-emerald-700"
                onKeyDown={(e) => e.key === 'Enter' && void handleRunLiveTest()}
              />
              <button
                type="button"
                onClick={() => void handleRunLiveTest()}
                disabled={isTestingPrompt || !testPrompt.trim()}
                className="flex items-center gap-1 px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold disabled:opacity-50"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{isTestingPrompt ? 'Generating...' : 'Test'}</span>
              </button>
              {isTestingPrompt && (
                <button
                  type="button"
                  onClick={() => void desktopBridge.cancelManagedAiChat()}
                  className="px-3 py-2 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold"
                >
                  Stop
                </button>
              )}
            </div>
            {testReply && (
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-800">
                <span className="font-bold text-emerald-800 block mb-1">
                  Companio ({managedStatus?.activeModelId || settings.ai.managedModelId || 'Local AI'}):
                </span>
                <p className="leading-relaxed whitespace-pre-wrap">{testReply}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Cloud API Config + DPAPI Vault */}
      {isCloudProvider && (
        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span className="text-xs font-bold text-slate-900">
                Cloud Provider &amp; Windows DPAPI Credential Vault
              </span>
            </div>
            <span className="text-[11px] font-semibold text-slate-600">
              {cloudStatus?.encryptionAvailable
                ? 'OS DPAPI encryption active'
                : isNativeDesktop()
                  ? 'DPAPI unavailable'
                  : 'Requires installed Windows app'}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="text-[11px] font-bold text-slate-600 space-y-1.5">
              <span className="block">Provider</span>
              <select
                aria-label="Cloud AI provider"
                value={activeCloudProvider}
                onChange={(e) => {
                  const nextProvider = e.target.value as CloudProviderId;
                  setCloudKeyFeedback('');
                  setCloudDiagFeedback(null);
                  onUpdateSettings({
                    ai: { ...settings.ai, provider: nextProvider, model: CLOUD_DEFAULT_MODELS[nextProvider], apiKey: '' }
                  });
                }}
                className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-xs font-semibold"
              >
                <option value="openai">OpenAI (api.openai.com)</option>
                <option value="gemini">Google Gemini (generativelanguage.googleapis.com)</option>
                <option value="anthropic">Anthropic Claude (api.anthropic.com)</option>
                <option value="groq">Groq (api.groq.com)</option>
                <option value="openrouter">OpenRouter (openrouter.ai)</option>
                <option value="custom_openai">Custom OpenAI-Compatible (HTTPS)</option>
              </select>
            </label>
            <label className="text-[11px] font-bold text-slate-600 space-y-1.5">
              <span className="block">Cloud model ID</span>
              <input
                type="text"
                aria-label="Cloud model ID"
                value={settings.ai.model || CLOUD_DEFAULT_MODELS[activeCloudProvider]}
                onChange={(e) => onUpdateSettings({ ai: { ...settings.ai, model: e.target.value } })}
                className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-xs font-mono"
              />
            </label>
          </div>

          {activeCloudProvider === 'custom_openai' && (
            <label className="block text-[11px] font-bold text-slate-600 space-y-1.5">
              <span className="block">Custom HTTPS Base URL (e.g. https://api.together.xyz/v1)</span>
              <input
                type="url"
                aria-label="Custom cloud endpoint"
                value={settings.ai.cloudCustomEndpoint || ''}
                onChange={(e) => onUpdateSettings({ ai: { ...settings.ai, cloudCustomEndpoint: e.target.value } })}
                placeholder="https://api.together.xyz/v1"
                className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-xs font-mono"
              />
            </label>
          )}

          <form onSubmit={(e) => void handleSaveCloudKey(e)} className="space-y-2 pt-2 border-t border-slate-100">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="font-semibold text-slate-700 flex items-center gap-1.5">
                <KeyRound className="w-3.5 h-3.5 text-emerald-700" />
                <span>
                  {cloudStatus?.providers?.[activeCloudProvider]?.configured
                    ? `Encrypted key stored (${cloudStatus.providers[activeCloudProvider].hint || '••••'})`
                    : `No encrypted ${activeCloudProvider} key stored`}
                </span>
              </span>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  disabled={testingCloudConn || !isNativeDesktop()}
                  onClick={() => void handleTestCloudConnection()}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-800 hover:underline disabled:opacity-50"
                >
                  <RefreshCw className={`w-3 h-3 ${testingCloudConn ? 'animate-spin' : ''}`} />
                  <span>{testingCloudConn ? 'Testing...' : 'Test Connection'}</span>
                </button>
                {cloudStatus?.providers?.[activeCloudProvider]?.configured && (
                  <button
                    type="button"
                    onClick={() => void handleClearCloudKey()}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-rose-700 hover:underline"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>Clear stored key</span>
                  </button>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="password"
                value={cloudKeyDraft}
                onChange={(e) => setCloudKeyDraft(e.target.value)}
                placeholder={`Paste ${activeCloudProvider} API key (write-only DPAPI storage)...`}
                aria-label="Cloud API key"
                autoComplete="off"
                className="flex-1 px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-xs font-mono"
              />
              <button
                type="submit"
                disabled={savingCloudKey || !cloudKeyDraft.trim() || !isNativeDesktop()}
                className="px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold disabled:opacity-50"
              >
                {savingCloudKey ? 'Encrypting...' : 'Save Key'}
              </button>
            </div>
            {cloudKeyFeedback && <p role="status" className="text-xs text-slate-700">{cloudKeyFeedback}</p>}
            {cloudDiagFeedback && (
              <p role="status" className={`text-xs font-medium ${cloudDiagFeedback.ok ? 'text-emerald-700' : 'text-rose-700'}`}>
                {cloudDiagFeedback.text}
              </p>
            )}
          </form>

          <div className="pt-2 border-t border-slate-100 space-y-2">
            <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider">
              Live Cloud Model Test Prompt:
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={testPrompt}
                onChange={(e) => setTestPrompt(e.target.value)}
                placeholder="Ask your configured cloud model..."
                className="flex-1 px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-xs font-medium"
                onKeyDown={(e) => e.key === 'Enter' && void handleRunLiveTest()}
              />
              <button
                type="button"
                onClick={() => void handleRunLiveTest()}
                disabled={isTestingPrompt || !testPrompt.trim()}
                className="flex items-center gap-1 px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold disabled:opacity-50"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{isTestingPrompt ? 'Thinking...' : 'Test'}</span>
              </button>
            </div>
            {testReply && (
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-800">
                <span className="font-bold text-emerald-800 block mb-1">Companio ({activeCloudProvider}):</span>
                <p className="leading-relaxed">{testReply}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Privacy & Context Controls */}
      {settings.ai.provider !== 'mock' && (
        <section className="acrylic-card rounded-xl p-5 border border-slate-200 space-y-4">
          <label className="flex items-start justify-between gap-4">
            <span><strong className="text-sm text-slate-900">Conversation continuity</strong><span className="block mt-1 text-xs text-slate-600">Opt in to sending up to eight recent chat messages to your configured model. Notes and action results are excluded.</span></span>
            <input type="checkbox" className="mt-1 h-5 w-5 accent-emerald-700" checked={settings.ai.useConversationContext === true} onChange={e => onUpdateSettings({ ai: { ...settings.ai, useConversationContext: e.target.checked } })} />
          </label>
          <label className="flex items-start justify-between gap-4 pt-3 border-t border-slate-100">
            <span><strong className="text-sm text-slate-900">Relevant long-term memory</strong><span className="block mt-1 text-xs text-slate-600">Include relevant, non-expired saved memories as background context in AI chat. Manage or clear memories anytime in History &amp; Logs.</span></span>
            <input type="checkbox" className="mt-1 h-5 w-5 accent-emerald-700" checked={settings.ai.useLongTermMemory !== false} onChange={e => onUpdateSettings({ ai: { ...settings.ai, useLongTermMemory: e.target.checked } })} />
          </label>
        </section>
      )}

      {/* Advanced External Local Server (Ollama / LM Studio) */}
      <details open={settings.ai.provider === 'local'} className="rounded-2xl bg-white border border-slate-200 shadow-sm p-4 space-y-3">
        <summary className="cursor-pointer text-xs font-bold text-slate-700 flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Server className="w-4 h-4 text-slate-600" />
            <span>Advanced: External Local Model Server (Ollama / LM Studio)</span>
          </span>
          <span className="text-[11px] font-normal text-slate-500">Optional developer mode</span>
        </summary>
        <div className="pt-3 border-t border-slate-100 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs text-slate-600">
              {settings.ai.provider === 'local'
                ? `Active external model: ${settings.ai.model || 'none'}`
                : 'Normal users should keep Smart Hybrid Auto above. Enable this only to target an existing Ollama or LM Studio endpoint.'}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => void handleFindLocalAi()}
                disabled={testingConnection}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold disabled:opacity-50"
              >
                <Server className="w-3.5 h-3.5" />
                <span>{testingConnection ? 'Checking...' : 'Find Local AI'}</span>
              </button>
              <button
                type="button"
                onClick={() => void handleManualCheck()}
                disabled={testingConnection}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold disabled:opacity-50"
              >
                <RefreshCw className={`w-3 h-3 ${testingConnection ? 'animate-spin' : ''}`} />
                <span>Check Connection</span>
              </button>
            </div>
          </div>

          {testResult && (
            <div className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${
              testResult.success
                ? 'bg-emerald-50/70 border-emerald-200 text-emerald-800'
                : 'bg-amber-50/70 border-amber-200 text-amber-800'
            }`}>
              {testResult.success ? <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" /> : <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />}
              <span>{testResult.message}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="text-[11px] font-bold text-slate-600 space-y-1.5">
              <span className="block">Local server URL</span>
              <input
                type="text"
                value={settings.ai.localEndpoint || DEFAULT_LOCAL_ENDPOINT}
                onChange={(e) => onUpdateSettings({ ai: { ...settings.ai, localEndpoint: e.target.value } })}
                placeholder="http://127.0.0.1:11434/v1"
                spellCheck={false}
                className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-xs font-mono"
              />
            </label>
            <label className="text-[11px] font-bold text-slate-600 space-y-1.5">
              <span className="block">Model name</span>
              <input
                type="text"
                list="companio-local-models"
                value={settings.ai.model || ''}
                onChange={(e) => onUpdateSettings({ ai: { ...settings.ai, provider: 'local', model: e.target.value } })}
                placeholder="Choose a model or enter its ID"
                className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-xs font-mono"
              />
              <datalist id="companio-local-models">
                {detectedLocalModels.map((model) => <option key={model} value={model} />)}
              </datalist>
            </label>
          </div>
        </div>
      </details>

      {!!settings.ai.apiKey && (
        <div className="p-4 rounded-2xl bg-amber-50/60 border border-amber-200 space-y-2">
          <p className="text-xs text-amber-800">
            A legacy plaintext API key was found in local browser settings. Remove it and use the encrypted DPAPI vault above instead.
          </p>
          <button
            type="button"
            onClick={() => onUpdateSettings({ ai: { ...settings.ai, apiKey: '' } })}
            className="text-xs font-semibold text-rose-700 underline underline-offset-2"
          >
            Remove legacy plaintext key from settings
          </button>
        </div>
      )}
    </div>
  );
};
