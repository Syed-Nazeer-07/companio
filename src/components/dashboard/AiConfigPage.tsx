import React, { useState } from 'react';
import { AppSettings, AiProvider } from '../../types';
import { Cpu, Key, CheckCircle2, AlertCircle, Sparkles, RefreshCw, Zap, Server } from 'lucide-react';

interface Props {
  settings: AppSettings;
  onUpdateSettings: (newSettings: Partial<AppSettings>) => void;
}

export const AiConfigPage: React.FC<Props> = ({ settings, onUpdateSettings }) => {
  const [testingConnection, setTestingConnection] = useState<boolean>(false);
  const [detectedLocalModels, setDetectedLocalModels] = useState<string[]>([]);
  const [testResult, setTestResult] = useState<{ success?: boolean; message?: string } | null>(null);

  const providers: { id: AiProvider; name: string; description: string; badge: string }[] = [
    {
      id: 'mock',
      name: 'Built-in Instant Engine',
      description: 'Zero setup, 0ms latency, zero API limits. Works 100% offline and controls apps & browsers immediately.',
      badge: 'Recommended'
    },
    {
      id: 'local',
      name: 'Local LLM (Ollama / LM Studio)',
      description: 'Run small local models (Llama 3.2, Qwen 2.5, Phi-3) on your Snapdragon X Elite PC without any API keys or internet.',
      badge: 'Private & Local'
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
      message: 'Could not connect to Ollama (port 11434) or LM Studio (port 1234). Make sure Ollama or LM Studio is running on your PC, or use the Built-in Instant Engine.'
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
        <div className="acrylic-card rounded-2xl p-6 border border-sky-200 bg-sky-50/30 space-y-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Server className="w-4 h-4 text-sky-600" />
                <span>Local LLM Setup (Ollama / LM Studio)</span>
              </h3>
              <p className="text-xs text-slate-600 mt-1">
                Zero API keys, 100% private. Run small fast models like Llama 3.2 3B or Qwen 2.5 3B locally on your Snapdragon X Elite.
              </p>
            </div>
            <button
              onClick={handleCheckLocalLLM}
              disabled={testingConnection}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-sky-500 hover:bg-sky-600 text-white text-xs font-bold shadow-md shadow-sky-500/20 transition-all disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${testingConnection ? 'animate-spin' : ''}`} />
              <span>Detect Local Models</span>
            </button>
          </div>

          <div className="p-3.5 rounded-xl bg-white border border-slate-200 text-xs text-slate-700 space-y-1.5">
            <p className="font-bold text-slate-800">Quick start with Ollama:</p>
            <p className="font-mono bg-slate-100 p-2 rounded-lg text-slate-800">
              ollama run llama3.2
            </p>
            <p className="text-slate-500 text-[11px]">
              Ollama serves on <span className="font-mono text-sky-700">http://localhost:11434</span>. Once running, Companio talks to it automatically!
            </p>
          </div>

          {detectedLocalModels.length > 0 && (
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Active Local Model:
              </label>
              <select
                value={settings.ai.model}
                onChange={(e) => onUpdateSettings({ ai: { ...settings.ai, model: e.target.value } })}
                className="w-full px-3.5 py-2 rounded-xl bg-white border border-slate-300 text-slate-900 text-xs font-bold focus:outline-none focus:border-sky-500"
              >
                {detectedLocalModels.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
          )}
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
