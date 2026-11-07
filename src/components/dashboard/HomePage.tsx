import React, { useState } from 'react';
import { 
  Play, 
  Volume2, 
  Camera, 
  Terminal, 
  CheckCircle2, 
  AlertCircle,
  Info,
  Activity, 
  Cpu, 
  ExternalLink,
  MessageSquare,
  Keyboard,
  Sun,
  Shield,
  Clipboard
} from 'lucide-react';
import { AppSettings } from '../../types';
import { CharacterRenderer } from '../characters/CharacterRenderer';
import { desktopBridge, isNativeDesktop } from '../../services/desktopBridge';

interface Props {
  settings: AppSettings;
  onNavigate: (tab: any) => void;
  onLaunchOverlay: () => void;
}

export const HomePage: React.FC<Props> = ({ settings, onNavigate, onLaunchOverlay }) => {
  const [actionStatus, setActionStatus] = useState<{
    message: string;
    kind: 'running' | 'success' | 'unverified' | 'error';
  } | null>(null);

  const runQuickAction = async (tool: string, params: any = {}, label: string) => {
    setActionStatus({ message: `Executing: ${label}...`, kind: 'running' });
    try {
      const res = await desktopBridge.executeTool(tool, params);
      if (res?.success === true && res?.verified === true) {
        setActionStatus({ message: `${label}: confirmed.`, kind: 'success' });
      } else if (res?.success === true) {
        setActionStatus({
          message: `${label}: attempted, but not verified. ${res?.error || ''}`.trim(),
          kind: 'unverified'
        });
      } else {
        setActionStatus({
          message: `${label}: ${res?.error || 'The action did not complete.'}`,
          kind: 'error'
        });
      }
    } catch (err: unknown) {
      setActionStatus({
        message: `${label}: ${err instanceof Error ? err.message : 'An unexpected error occurred.'}`,
        kind: 'error'
      });
    }
    setTimeout(() => setActionStatus(null), 5000);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Quick Desktop Status Card */}
      <div className="acrylic-card rounded-2xl p-6 border border-slate-200 bg-white/90 shadow-sm flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-5">
          <div className="w-24 h-24 flex items-center justify-center shrink-0 p-1 bg-slate-50 rounded-2xl border border-slate-100 shadow-inner">
            <CharacterRenderer
              characterId={settings.characterId}
              state="idle"
              scale={0.8}
            />
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-slate-900">{settings.characterName || 'Companio'}</h2>
              <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${isNativeDesktop() ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${isNativeDesktop() ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                {isNativeDesktop() ? 'Desktop connected' : 'Web preview'}
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium">
              Hotkey: <kbd className="px-2 py-0.5 rounded bg-slate-100 border border-slate-200 text-slate-700 font-mono text-[11px] font-bold">{settings.activationShortcut}</kbd> to toggle or hide anytime.
            </p>
            <p className="text-xs text-slate-500 font-medium flex items-center gap-1.5 pt-0.5">
              <Cpu className="w-3.5 h-3.5 text-sky-600" />
              <span>AI Brain: <strong className="text-slate-800">{settings.ai.provider === 'local' ? `Local model selected (${settings.ai.model || 'llama3.2:1b'})` : 'Built-in Engine'}</strong></span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <button
            onClick={onLaunchOverlay}
            className="flex-1 md:flex-initial flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-600 text-white text-xs font-bold shadow-md shadow-sky-500/20 transition-all active:scale-95"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>Show / Focus Companion</span>
          </button>
          <button
            onClick={() => onNavigate('characters')}
            className="flex-1 md:flex-initial px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors"
          >
            Change Character
          </button>
        </div>
      </div>

      {/* Action Notification */}
      {actionStatus && (
        <div role="status" className={`p-3.5 rounded-xl border text-xs font-semibold flex items-center gap-2 shadow-sm animate-in fade-in duration-150 ${
          actionStatus.kind === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
            : actionStatus.kind === 'error' ? 'bg-rose-50 border-rose-200 text-rose-800'
            : actionStatus.kind === 'unverified' ? 'bg-amber-50 border-amber-200 text-amber-800'
            : 'bg-sky-50 border-sky-200 text-sky-800'
        }`}>
          {actionStatus.kind === 'running' ? <Activity className="w-4 h-4 shrink-0 animate-spin" />
            : actionStatus.kind === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" />
            : actionStatus.kind === 'unverified' ? <Info className="w-4 h-4 shrink-0" />
            : <AlertCircle className="w-4 h-4 shrink-0" />}
          <span>{actionStatus.message}</span>
        </div>
      )}

      {/* Quick Controls Grid */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Quick PC Controls</h3>
          <button
            onClick={() => onNavigate('automation')}
            className="text-xs text-sky-600 hover:text-sky-700 font-bold flex items-center gap-1"
          >
            <span>All 25+ Tools</span>
            <ExternalLink className="w-3 h-3" />
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <button
            onClick={() => runQuickAction('win.screenshot', {}, 'Take Screenshot')}
            className="p-3.5 rounded-xl border border-slate-200 bg-white hover:border-slate-300 text-left transition-all group"
          >
            <Camera className="w-5 h-5 text-sky-600 mb-2 group-hover:scale-110 transition-transform" />
            <div className="text-xs font-bold text-slate-900">Screenshot</div>
            <div className="text-[10px] text-slate-500">Capture monitor</div>
          </button>

          <button
            onClick={() => runQuickAction('win.volume.change', { delta: 10 }, 'Volume Up')}
            className="p-3.5 rounded-xl border border-slate-200 bg-white hover:border-slate-300 text-left transition-all group"
          >
            <Volume2 className="w-5 h-5 text-emerald-600 mb-2 group-hover:scale-110 transition-transform" />
            <div className="text-xs font-bold text-slate-900">Volume +10%</div>
            <div className="text-[10px] text-slate-500">Louder audio</div>
          </button>

          <button
            onClick={() => runQuickAction('win.volume.change', { delta: -10 }, 'Volume Down')}
            className="p-3.5 rounded-xl border border-slate-200 bg-white hover:border-slate-300 text-left transition-all group"
          >
            <Volume2 className="w-5 h-5 text-amber-600 mb-2 group-hover:scale-110 transition-transform" />
            <div className="text-xs font-bold text-slate-900">Volume -10%</div>
            <div className="text-[10px] text-slate-500">Softer audio</div>
          </button>

          <button
            onClick={() => runQuickAction('win.brightness.change', { delta: -15 }, 'Screen Dimmer')}
            className="p-3.5 rounded-xl border border-slate-200 bg-white hover:border-slate-300 text-left transition-all group"
          >
            <Sun className="w-5 h-5 text-indigo-600 mb-2 group-hover:scale-110 transition-transform" />
            <div className="text-xs font-bold text-slate-900">Dim Screen</div>
            <div className="text-[10px] text-slate-500">-15% brightness</div>
          </button>

          <button
            onClick={() => runQuickAction('win.clipboard.read', {}, 'Read Clipboard')}
            className="p-3.5 rounded-xl border border-slate-200 bg-white hover:border-slate-300 text-left transition-all group"
          >
            <Clipboard className="w-5 h-5 text-purple-600 mb-2 group-hover:scale-110 transition-transform" />
            <div className="text-xs font-bold text-slate-900">Clipboard</div>
            <div className="text-[10px] text-slate-500">Read copied text</div>
          </button>

          <button
            onClick={() => runQuickAction('win.desktop.show', {}, 'Show Desktop')}
            className="p-3.5 rounded-xl border border-slate-200 bg-white hover:border-slate-300 text-left transition-all group"
          >
            <Shield className="w-5 h-5 text-rose-600 mb-2 group-hover:scale-110 transition-transform" />
            <div className="text-xs font-bold text-slate-900">Show Desktop</div>
            <div className="text-[10px] text-slate-500">Minimize windows</div>
          </button>
        </div>
      </div>
    </div>
  );
};
