import React from 'react';
import { TaskPlan, CharacterState } from '../../types';
import { AudioVisualizer } from './AudioVisualizer';
import { CheckCircle2, AlertCircle, Square, LoaderCircle, Mic2, Moon } from 'lucide-react';

interface Props {
  text: string;
  state: CharacterState;
  activePlan?: TaskPlan | null;
  onCancel?: () => void;
  audioLevel?: number;
}

export const SpeechBubble: React.FC<Props> = ({ text, state, activePlan, onCancel }) => {
  if (!text && (!activePlan || activePlan.steps.length === 0) && state === 'idle') return null;

  const isExecuting = activePlan?.status === 'executing';
  const isFailed = activePlan?.status === 'failed' || state === 'confused';
  const isCompleted = !!(activePlan && activePlan.steps.length > 0 && activePlan.status === 'completed');
  const isHandoff = !!(isCompleted && activePlan?.steps.length && activePlan.steps.every(step => step.result?.handoffOnly === true));
  const isListening = state === 'listening';
  const isThinking = state === 'thinking';

  return (
    <div className="companio-speech relative mb-3 w-full max-w-[320px] app-no-drag" role="status" aria-live="polite" aria-atomic="true">
      <div className="rounded-2xl border border-slate-200/90 bg-white/95 px-3.5 py-3 text-slate-800 shadow-[0_6px_24px_rgba(15,23,42,0.10)]">
        <div className="mb-2 flex items-center justify-between gap-2 text-[11px] font-semibold tracking-wide">
          <div className="flex items-center gap-1.5">
            {isExecuting ? (
              <><LoaderCircle className="h-3.5 w-3.5 animate-spin text-sky-600" /><span className="text-sky-700">Working</span></>
            ) : isThinking ? (
              <><LoaderCircle className="h-3.5 w-3.5 animate-spin text-sky-600" /><span className="text-sky-700">Thinking</span></>
            ) : isListening ? (
              <><Mic2 className="h-3.5 w-3.5 text-emerald-600" /><span className="text-emerald-700">Listening</span></>
            ) : isFailed ? (
              <><AlertCircle className="h-3.5 w-3.5 text-rose-600" /><span className="text-rose-700">Needs attention</span></>
            ) : isCompleted ? (
              <><CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /><span className="text-emerald-700">{isHandoff ? 'Request sent' : 'Done'}</span></>
            ) : state === 'sleeping' ? (
              <><Moon className="h-3.5 w-3.5 text-slate-400" /><span className="text-slate-600">Resting</span></>
            ) : <span className="text-slate-500">Companio</span>}
          </div>
          <div className="flex items-center gap-2">
            {(state === 'talking' || isListening) && <AudioVisualizer active={true} color={isListening ? 'bg-emerald-500' : 'bg-sky-500'} />}
            {isExecuting && onCancel && (
              <button type="button" onClick={onCancel} title="Stop the current task"
                className="app-no-drag inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-2 py-1 text-[11px] font-semibold text-rose-700 hover:bg-rose-100">
                <Square className="h-2.5 w-2.5 fill-current" /> Stop
              </button>
            )}
          </div>
        </div>
        <p className="max-h-[150px] overflow-y-auto whitespace-pre-wrap break-words text-[13px] font-normal leading-[1.55] text-slate-800 select-text">
          {text || (isExecuting ? activePlan?.steps[activePlan?.currentStepIndex ?? 0]?.description : '')}
        </p>
        {activePlan && activePlan.steps.length > 1 && (isExecuting || activePlan.status === 'planning') && (
          <div className="mt-2.5 space-y-1 border-t border-slate-100 pt-2">
            {activePlan.steps.map((step, idx) => (
              <div key={step.id} className="flex items-center justify-between gap-3 text-[11px]">
                <span className="min-w-0 truncate text-slate-600">{idx + 1}. {step.description}</span>
                <span className="shrink-0 font-medium text-slate-500">
                  {step.status === 'success' ? 'Done' : step.status === 'running' ? 'Working' : step.status === 'failed' ? 'Failed' : 'Queued'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="absolute -bottom-[5px] right-14 h-2.5 w-2.5 rotate-45 border-b border-r border-slate-200 bg-white/95" aria-hidden="true" />
    </div>
  );
};
