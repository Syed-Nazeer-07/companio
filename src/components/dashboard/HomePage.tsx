import React, { useRef, useState } from 'react';
import {
  ArrowRight,
  Volume2,
  Volume1,
  Camera,
  CheckCircle2,
  AlertCircle,
  Info,
  Activity,
  Cpu,
  Mic,
  Keyboard,
  Sun,
  Monitor,
  Clipboard,
  X
} from 'lucide-react';
import type { DashboardTab } from './DashboardLayout';
import { classifyActionOutcome } from '../../services/actionOutcome.mjs';
import { AppSettings } from '../../types';
import { CharacterRenderer } from '../characters/CharacterRenderer';
import { desktopBridge, isNativeDesktop } from '../../services/desktopBridge';

const quickActions: Array<{
  id: string;
  params: Record<string, number>;
  label: string;
  description: string;
  icon: typeof Camera;
}> = [
  { id: 'win.screenshot', params: {}, label: 'Screenshot', description: 'Capture the screen', icon: Camera },
  { id: 'win.volume.change', params: { delta: 10 }, label: 'Volume up', description: '+10 percentage points', icon: Volume2 },
  { id: 'win.volume.change', params: { delta: -10 }, label: 'Volume down', description: '−10 percentage points', icon: Volume1 },
  { id: 'win.brightness.change', params: { delta: -15 }, label: 'Dim screen', description: '−15% brightness', icon: Sun },
  { id: 'win.clipboard.read', params: {}, label: 'Clipboard', description: 'Read copied text', icon: Clipboard },
  { id: 'win.desktop.show', params: {}, label: 'Show desktop', description: 'Minimize windows', icon: Monitor }
];

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
    <div className="space-y-7">
      <header className="workspace-heading">
        <h1>Overview</h1>
        <p>Manage your companion and access everyday Windows controls.</p>
      </header>

      <section className="companion-card" aria-labelledby="companion-card-title">
        <div className="companion-card-copy">
          <p>Your companion</p>
          <h2 id="companion-card-title">{settings.characterName || 'Companio'}</h2>
          <div className="companion-card-shortcut">
            <Keyboard size={16} aria-hidden="true" />
            <kbd>{settings.activationShortcut.split('+').join(' + ')}</kbd>
          </div>
          <div className="companion-card-actions">
            <button type="button" className="workspace-primary" onClick={onLaunchOverlay}>
              Show Companion <ArrowRight size={15} aria-hidden="true" />
            </button>
            <button type="button" className="workspace-secondary" onClick={() => onNavigate('characters')}>Change character</button>
          </div>
        </div>
        <div className="companion-card-stage" aria-hidden="true">
          <CharacterRenderer characterId={settings.characterId} state="idle" scale={1.03} />
        </div>
      </section>

      <section aria-labelledby="quick-controls-title">
        <div className="workspace-section-heading">
          <h2 id="quick-controls-title">Quick PC controls</h2>
          <button type="button" onClick={() => onNavigate('automation')}>Browse tools <ArrowRight size={15} aria-hidden="true" /></button>
        </div>
        {!nativeDesktop && (
          <p className="mb-3 text-sm text-slate-600">Quick controls are available in the Windows app.</p>
        )}
        <fieldset aria-label="Quick PC controls" disabled={!nativeDesktop} className="quick-control-grid">
          {quickActions.map(({ id, params, label, description, icon: Icon }) => (
            <button key={label} type="button" aria-disabled={isRunning} className="quick-control"
              onClick={() => runQuickAction(id, params, label)}>
              <span className="quick-control-icon"><Icon size={18} aria-hidden="true" /></span>
              <span className="min-w-0">
                <strong>{label}</strong>
                <small>{description}</small>
              </span>
            </button>
          ))}
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
      </section>

      <section aria-labelledby="personalize-title">
        <div className="workspace-section-heading"><h2 id="personalize-title">Preferences</h2></div>
        <div className="grid gap-3 sm:grid-cols-2">
          <button type="button" className="quick-control" onClick={() => onNavigate('ai')}>
            <span className="quick-control-icon"><Cpu size={18} aria-hidden="true" /></span>
            <span className="min-w-0"><strong>Command engine</strong><small>{
              settings.ai.provider === 'local' ? settings.ai.model || 'Local AI' : 'Built-in commands'
            }</small></span>
            <ArrowRight size={16} className="ml-auto shrink-0" aria-hidden="true" />
          </button>
          <button type="button" className="quick-control" onClick={() => onNavigate('voice')}>
            <span className="quick-control-icon"><Mic size={18} aria-hidden="true" /></span>
            <span><strong>Voice settings</strong><small>Microphone and spoken replies</small></span>
            <ArrowRight size={16} className="ml-auto shrink-0" aria-hidden="true" />
          </button>
        </div>
      </section>
    </div>
  );
};
