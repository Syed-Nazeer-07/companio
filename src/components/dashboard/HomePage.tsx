import React, { useRef, useState } from 'react';
import { 
  Play, 
  Volume2, 
  Camera, 
  CheckCircle2, 
  AlertCircle,
  Info,
  Activity, 
  Cpu, 
  ExternalLink,
  Sun,
  Shield,
  Clipboard,
  X
} from 'lucide-react';
import type { DashboardTab } from './DashboardLayout';
import { classifyActionOutcome } from '../../services/actionOutcome.mjs';
import { AppSettings } from '../../types';
import { CharacterRenderer } from '../characters/CharacterRenderer';
import { desktopBridge, isNativeDesktop } from '../../services/desktopBridge';

interface Props {
  settings: AppSettings;
  onNavigate: (tab: DashboardTab) => void;
  onLaunchOverlay: () => void;
}

export const HomePage: React.FC<Props> = ({ settings, onNavigate, onLaunchOverlay }) => {
  const nativeDesktop = isNativeDesktop();
  const actionInFlight = useRef(false);
  const [actionStatus, setActionStatus] = useState<{
    message: string;
    kind: 'running' | 'verified' | 'unverified' | 'error';
    detail?: string;
  } | null>(null);

  const isRunning = actionStatus?.kind === 'running';

  const runQuickAction = async (tool: string, params: Record<string, number>, label: string) => {
    if (!nativeDesktop || actionInFlight.current) return;
    actionInFlight.current = true;
    setActionStatus({ message: `Running ${label}…`, kind: 'running' });

    try {
      const result = await desktopBridge.executeTool(tool, params);
      const outcome = classifyActionOutcome(result, label);
      if (outcome.kind === 'verified' && tool === 'win.clipboard.read' && typeof result.clipboard === 'string') {
        setActionStatus({
          kind: 'verified',
          message: result.clipboard ? 'Clipboard text' : 'Clipboard is empty',
          detail: result.clipboard
        });
      } else {
        setActionStatus({
          ...outcome,
          message: outcome.kind === 'verified' ? result.message || outcome.message : outcome.message,
          detail: outcome.kind === 'unverified' ? result.error || result.message : undefined
        });
      }
    } catch (error: unknown) {
      setActionStatus(classifyActionOutcome({
        error: error instanceof Error ? error.message : undefined
      }, label));
    } finally {
      actionInFlight.current = false;
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Quick Desktop Status Card */}
      <div className="rounded-2xl p-4 sm:p-6 border border-slate-200 bg-white/90 shadow-sm flex flex-col xl:flex-row items-start xl:items-center justify-between gap-5">
        <div className="flex min-w-0 items-center gap-3 sm:gap-5">
          <div className="w-16 h-16 sm:w-24 sm:h-24 flex items-center justify-center shrink-0 p-1 bg-slate-50 rounded-2xl border border-slate-100 shadow-inner">
            <CharacterRenderer
              characterId={settings.characterId}
              state="idle"
              scale={0.8}
            />
          </div>
          <div className="min-w-0 space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="break-words text-xl font-bold text-slate-900">{settings.characterName || 'Companio'}</h2>
              <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${nativeDesktop ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${nativeDesktop ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                {nativeDesktop ? 'Desktop connected' : 'Web preview'}
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

        <div className="flex items-center flex-wrap gap-3 w-full xl:w-auto">
          <button
            onClick={onLaunchOverlay}
            className="flex-1 md:flex-initial flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-sky-700 hover:bg-sky-800 text-white text-xs font-bold shadow-md shadow-sky-500/20 transition-all active:scale-95"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>Show Companion</span>
          </button>
          <button
            onClick={() => onNavigate('characters')}
            className="flex-1 md:flex-initial px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors"
          >
            Change Character
          </button>
        </div>
      </div>

      {/* Quick Controls Grid */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Quick PC Controls</h3>
          <button
            onClick={() => onNavigate('automation')}
            className="text-xs text-sky-600 hover:text-sky-700 font-bold flex items-center gap-1"
          >
            <span>Browse tools</span>
            <ExternalLink className="w-3 h-3" />
          </button>
        </div>

        {!nativeDesktop && (
          <p className="mb-3 text-sm text-slate-600">Quick controls are available in the Windows app.</p>
        )}
        <fieldset
          aria-label="Quick PC controls"
          disabled={!nativeDesktop}
          className="grid min-w-0 grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6 disabled:opacity-60"
        >
          <button
            type="button"
            aria-disabled={isRunning}
            onClick={() => runQuickAction('win.screenshot', {}, 'Take Screenshot')}
            className="p-3.5 rounded-xl border border-slate-200 bg-white enabled:hover:border-slate-400 aria-disabled:cursor-wait aria-disabled:opacity-60 text-left transition-colors"
          >
            <Camera className="w-5 h-5 text-sky-600 mb-2" />
            <div className="text-xs font-bold text-slate-900">Screenshot</div>
            <div className="text-[10px] text-slate-500">Capture monitor</div>
          </button>

          <button
            type="button"
            aria-disabled={isRunning}
            onClick={() => runQuickAction('win.volume.change', { delta: 10 }, 'Volume Up')}
            className="p-3.5 rounded-xl border border-slate-200 bg-white enabled:hover:border-slate-400 aria-disabled:cursor-wait aria-disabled:opacity-60 text-left transition-colors"
          >
            <Volume2 className="w-5 h-5 text-emerald-600 mb-2" />
            <div className="text-xs font-bold text-slate-900">Volume up</div>
            <div className="text-[10px] text-slate-500">+10 percentage points</div>
          </button>

          <button
            type="button"
            aria-disabled={isRunning}
            onClick={() => runQuickAction('win.volume.change', { delta: -10 }, 'Volume Down')}
            className="p-3.5 rounded-xl border border-slate-200 bg-white enabled:hover:border-slate-400 aria-disabled:cursor-wait aria-disabled:opacity-60 text-left transition-colors"
          >
            <Volume2 className="w-5 h-5 text-amber-600 mb-2" />
            <div className="text-xs font-bold text-slate-900">Volume down</div>
            <div className="text-[10px] text-slate-500">−10 percentage points</div>
          </button>

          <button
            type="button"
            aria-disabled={isRunning}
            onClick={() => runQuickAction('win.brightness.change', { delta: -15 }, 'Screen Dimmer')}
            className="p-3.5 rounded-xl border border-slate-200 bg-white enabled:hover:border-slate-400 aria-disabled:cursor-wait aria-disabled:opacity-60 text-left transition-colors"
          >
            <Sun className="w-5 h-5 text-indigo-600 mb-2" />
            <div className="text-xs font-bold text-slate-900">Dim Screen</div>
            <div className="text-[10px] text-slate-500">-15% brightness</div>
          </button>

          <button
            type="button"
            aria-disabled={isRunning}
            onClick={() => runQuickAction('win.clipboard.read', {}, 'Read Clipboard')}
            className="p-3.5 rounded-xl border border-slate-200 bg-white enabled:hover:border-slate-400 aria-disabled:cursor-wait aria-disabled:opacity-60 text-left transition-colors"
          >
            <Clipboard className="w-5 h-5 text-purple-600 mb-2" />
            <div className="text-xs font-bold text-slate-900">Clipboard</div>
            <div className="text-[10px] text-slate-500">Read copied text</div>
          </button>

          <button
            type="button"
            aria-disabled={isRunning}
            onClick={() => runQuickAction('win.desktop.show', {}, 'Show Desktop')}
            className="p-3.5 rounded-xl border border-slate-200 bg-white enabled:hover:border-slate-400 aria-disabled:cursor-wait aria-disabled:opacity-60 text-left transition-colors"
          >
            <Shield className="w-5 h-5 text-rose-600 mb-2" />
            <div className="text-xs font-bold text-slate-900">Show Desktop</div>
            <div className="text-[10px] text-slate-500">Minimize windows</div>
          </button>
        </fieldset>
        <div className={actionStatus ? 'mt-3' : undefined}>
          <span role="status" className="sr-only">{actionStatus?.message}</span>
          {actionStatus && (
            <div className={`flex items-start gap-3 rounded-xl border p-3.5 text-sm ${
              actionStatus.kind === 'verified' ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                : actionStatus.kind === 'error' ? 'border-rose-200 bg-rose-50 text-rose-900'
                : actionStatus.kind === 'unverified' ? 'border-amber-200 bg-amber-50 text-amber-900'
                : 'border-sky-200 bg-sky-50 text-sky-900'
            }`}>
              {actionStatus.kind === 'running' ? <Activity className="mt-0.5 h-4 w-4 shrink-0" />
                : actionStatus.kind === 'verified' ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                : actionStatus.kind === 'unverified' ? <Info className="mt-0.5 h-4 w-4 shrink-0" />
                : <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />}
              <div className="min-w-0 flex-1">
                <p className="select-text break-words font-semibold">{actionStatus.message}</p>
                {actionStatus.detail && (
                  <div tabIndex={0} className="mt-2 max-h-32 overflow-auto select-text whitespace-pre-wrap break-words rounded-md bg-white/70 p-2 text-xs">
                    {actionStatus.detail}
                  </div>
                )}
              </div>
              {actionStatus.kind !== 'running' && (
                <button type="button" onClick={() => setActionStatus(null)} aria-label="Dismiss action result"
                  className="shrink-0 rounded-md p-1 hover:bg-black/5">
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
