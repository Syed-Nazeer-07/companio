import React, { useState, useEffect } from 'react';
import { AppSettings } from '../../types';
import { Cpu, CheckCircle2, AlertCircle, RefreshCw, Zap, Server, Send, ShieldCheck, KeyRound, Trash2 } from 'lucide-react';
import { desktopBridge, isNativeDesktop } from '../../services/desktopBridge';

const DEFAULT_LOCAL_ENDPOINT = 'http://127.0.0.1:11434/v1';
const CLOUD_DEFAULT_MODELS: Record<'openai' | 'gemini' | 'anthropic', string> = {
  openai: 'gpt-4o-mini',
  gemini: 'gemini-2.0-flash',
  anthropic: 'claude-3-5-haiku-latest'
};

interface Props {
  settings: AppSettings;
  onUpdateSettings: (newSettings: Partial<AppSettings>) => void;
}

export const AiConfigPage: React.FC<Props> = ({ settings, onUpdateSettings }) => {
  const [testingConnection, setTestingConnection] = useState<boolean>(false);
  const [detectedLocalModels, setDetectedLocalModels] = useState<string[]>([]);
  const [testResult, setTestResult] = useState<{ success?: boolean; message?: string } | null>(null);

  // Live test chat
  const [testPrompt, setTestPrompt] = useState<string>('Who are you and what can you do?');
  const [testReply, setTestReply] = useState<string | null>(null);
  const [isTestingPrompt, setIsTestingPrompt] = useState<boolean>(false);

  // Cloud DPAPI credentials (write-only; decrypted strictly in Electron main process)
  const [cloudStatus, setCloudStatus] = useState<Awaited<ReturnType<typeof desktopBridge.getCloudAiStatus>> | null>(null);
  const [cloudKeyDraft, setCloudKeyDraft] = useState('');
  const [cloudKeyFeedback, setCloudKeyFeedback] = useState('');
  const [savingCloudKey, setSavingCloudKey] = useState(false);

  const isCloudProvider = ['openai', 'gemini', 'anthropic'].includes(settings.ai.provider);
  const activeCloudProvider = (isCloudProvider ? settings.ai.provider : 'openai') as 'openai' | 'gemini' | 'anthropic';

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
    void refreshCloudStatus();
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
        ai: { ...settings.ai, localEndpoint: result.endpoint, model }
      });
      setTestResult({
        success: result.models.length > 0,
        message: result.models.length > 0
          ? `Found ${result.models.length} available model(s) at ${result.endpoint}. Selected ${model}. Try a prompt to verify inference.`
          : `Found a running local server at ${result.endpoint}, but no models are loaded. Load a model and retry.`
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

  const handleRunLiveTest = async () => {
    if (!testPrompt.trim()) return;
    if (settings.ai.provider === 'local' && (!settings.ai.model || settings.ai.model === 'companio-deterministic-v1')) {
      setTestReply('Choose a loaded local model before testing. Use Find Local AI to discover one.');
      return;
    }
    setIsTestingPrompt(true);
    setTestReply(null);
    try {
      const result = isCloudProvider
        ? await desktopBridge.chatCloudAi({
            provider: activeCloudProvider,
            model: settings.ai.model || CLOUD_DEFAULT_MODELS[activeCloudProvider],
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
        : 'AI provider unavailable: ' + (result.error || 'No reply received.'));
    } catch (error) {
      setTestReply('AI test request failed: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
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
    const res = await desktopBridge.clearCloudAiKey(activeCloudProvider);
    if (res.success) {
      setCloudKeyFeedback('Stored API key removed.');
      await refreshCloudStatus();
    } else {
      setCloudKeyFeedback(res.error || 'Could not remove stored API key.');
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
              : (detectedLocalModels[0] || (settings.ai.model !== 'companio-deterministic-v1' ? settings.ai.model : '')),
            localEndpoint: settings.ai.localEndpoint || DEFAULT_LOCAL_ENDPOINT
          } })}
          className={`p-4 rounded-2xl border cursor-pointer transition-all ${
            settings.ai.provider === 'local'
              ? 'bg-emerald-50/70 border-emerald-700 ring-2 ring-emerald-700/20 shadow-sm'
              : 'bg-white border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Server className="w-4 h-4 text-emerald-700" />
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
              No API Key
            </span>
          </div>
          <p className="text-[11px] text-slate-500 leading-relaxed">
            Fast offline handling for supported commands. Complex requests need a properly configured model.
          </p>
        </div>

        {/* Option 3: Optional Cloud API (DPAPI Protected) */}
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
            Optional OpenAI, Gemini, or Anthropic BYOK mode. Keys are encrypted with Windows DPAPI and never written to plain settings.
          </p>
        </button>
      </div>

      {/* Local LLM Active Status & Live Test */}
      {settings.ai.provider === 'local' && (
        <div className="space-y-4">
          <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className={`w-2.5 h-2.5 rounded-full ${testResult?.success ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                <span className="text-xs font-bold text-slate-900">
                  Selected local model: <span className="font-mono text-emerald-800">{settings.ai.model || 'No model selected'}</span>
                </span>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={handleFindLocalAi}
                  disabled={testingConnection}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold transition-all disabled:opacity-50"
                >
                  <Server className="w-3.5 h-3.5" />
                  <span>{testingConnection ? 'Checking...' : 'Find Local AI'}</span>
                </button>
                <button
                  type="button"
                  onClick={handleManualCheck}
                  disabled={testingConnection}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-all disabled:opacity-50"
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
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-xs font-mono focus:outline-none focus:border-emerald-700"
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
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-xs font-mono focus:outline-none focus:border-emerald-700"
                />
                <datalist id="companio-local-models">
                  {detectedLocalModels.map((model) => <option key={model} value={model} />)}
                </datalist>
              </label>
            </div>
            <p className="text-[11px] text-slate-500">
              Ollama: http://127.0.0.1:11434/v1 · LM Studio: http://127.0.0.1:1234/v1.
              Start the server and load a model first, then use Find Local AI to locate a running server and select its loaded model.
              Only local addresses are accepted. Built-in Windows commands do not need an AI model.
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
                  className="flex-1 px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-xs font-medium focus:outline-none focus:border-emerald-700 focus:bg-white"
                  onKeyDown={(e) => e.key === 'Enter' && handleRunLiveTest()}
                />
                <button
                  onClick={handleRunLiveTest}
                  disabled={isTestingPrompt || !testPrompt.trim()}
                  className="flex items-center gap-1 px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold shadow-sm transition-all disabled:opacity-50"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{isTestingPrompt ? 'Thinking...' : 'Test'}</span>
                </button>
              </div>

              {testReply && (
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-800 animate-in fade-in duration-150">
                  <span className="font-bold text-emerald-800 block mb-1">Companio (via {settings.ai.model}):</span>
                  <p className="leading-relaxed">{testReply}</p>
                </div>
              )}
            </div>
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
                Cloud Provider & Windows DPAPI Credential Vault
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
                  const nextProvider = e.target.value as 'openai' | 'gemini' | 'anthropic';
                  setCloudKeyFeedback('');
                  onUpdateSettings({
                    ai: { ...settings.ai, provider: nextProvider, model: CLOUD_DEFAULT_MODELS[nextProvider], apiKey: '' }
                  });
                }}
                className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-xs font-semibold"
              >
                <option value="openai">OpenAI (api.openai.com)</option>
                <option value="gemini">Google Gemini (generativelanguage.googleapis.com)</option>
                <option value="anthropic">Anthropic Claude (api.anthropic.com)</option>
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
                onKeyDown={(e) => e.key === 'Enter' && handleRunLiveTest()}
              />
              <button
                type="button"
                onClick={handleRunLiveTest}
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

      {/* Conversation continuity & memory toggle */}
      {(settings.ai.provider === 'local' || isCloudProvider) && (
        <section className="acrylic-card rounded-xl p-5 border border-slate-200 space-y-4">
          <label className="flex items-start justify-between gap-4">
            <span><strong className="text-sm text-slate-900">Conversation continuity</strong><span className="block mt-1 text-xs text-slate-600">Opt in to sending up to eight recent chat messages to your configured model. Notes and action results are excluded. Turn off at any time; existing history can be cleared in History.</span></span>
            <input type="checkbox" className="mt-1 h-5 w-5 accent-emerald-700" checked={settings.ai.useConversationContext === true} onChange={e => onUpdateSettings({ai:{...settings.ai,useConversationContext:e.target.checked}})} />
          </label>
          <label className="flex items-start justify-between gap-4 pt-3 border-t border-slate-100">
            <span><strong className="text-sm text-slate-900">Relevant long-term memory</strong><span className="block mt-1 text-xs text-slate-600">Include relevant, non-expired saved memories as background context in AI chat. Manage or clear memories anytime in History & Logs.</span></span>
            <input type="checkbox" className="mt-1 h-5 w-5 accent-emerald-700" checked={settings.ai.useLongTermMemory !== false} onChange={e => onUpdateSettings({ai:{...settings.ai,useLongTermMemory:e.target.checked}})} />
          </label>
        </section>
      )}
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
