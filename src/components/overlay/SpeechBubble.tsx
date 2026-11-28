import React from 'react';
import { TaskPlan, CharacterState } from '../../types';
import { AudioVisualizer } from './AudioVisualizer';
import { CheckCircle2, AlertCircle, Square, LoaderCircle, Mic2, Moon, HelpCircle, RotateCcw } from 'lucide-react';

interface Props {
  text: string;
  state: CharacterState;
  activePlan?: TaskPlan | null;
  onCancel?: () => void;
  onRetry?: () => void;
  audioLevel?: number;
  isStreaming?: boolean;
  isDark?: boolean;
}

export const SpeechBubble: React.FC<Props> = ({
  text,
  state,
  activePlan,
  onCancel,
  onRetry,
  isStreaming = false,
  isDark = false
}) => {
  if (!text && (!activePlan || activePlan.steps.length === 0) && state === 'idle') return null;

  const isClarification = activePlan?.clarificationNeeded === true;
  const isExecuting = activePlan?.status === 'executing';
  const isStopped = activePlan?.status === 'cancelled';
  const isFailed = !isClarification && (activePlan?.status === 'failed' || state === 'confused');
  const isCompleted = !isClarification && !!(activePlan && activePlan.steps.length > 0 && activePlan.status === 'completed');
  const isHandoff = !!(isCompleted && activePlan?.steps.length && activePlan.steps.some(step => step.result?.handoffOnly === true));
  const isListening = state === 'listening';
  const isThinking = state === 'thinking';

  const cardClass = isDark
    ? 'border-slate-700/90 bg-slate-900/95 text-slate-100 shadow-[0_6px_20px_rgba(2,6,23,0.45)]'
    : 'border-slate-200/90 bg-white/95 text-slate-800 shadow-[0_6px_20px_rgba(15,23,42,0.10)]';

  const bodyText = text || (isExecuting ? activePlan?.steps[activePlan?.currentStepIndex ?? 0]?.description : '');

  return (
    <div
      data-companio-interactive="true"
      className="companio-speech pointer-events-auto relative mb-2.5 w-full max-w-[328px]"
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      <div className={`rounded-xl border px-3.5 py-2.5 ${cardClass}`}>
        <div className="mb-1.5 flex items-center justify-between gap-2 text-[11px] font-semibold tracking-wide">
          <div className="flex items-center gap-1.5">
            {isExecuting ? (
              <><LoaderCircle className="h-3.5 w-3.5 animate-spin text-emerald-600" /><span className={isDark ? 'text-emerald-400' : 'text-emerald-800'}>Working</span></>
            ) : isThinking ? (
              <><LoaderCircle className="h-3.5 w-3.5 animate-spin text-emerald-600" /><span className={isDark ? 'text-emerald-400' : 'text-emerald-800'}>Thinking</span></>
            ) : isClarification ? (
              <><HelpCircle className="h-3.5 w-3.5 text-amber-500" /><span className={isDark ? 'text-amber-300' : 'text-amber-700'}>Clarification</span></>
            ) : isListening ? (
              <><Mic2 className="h-3.5 w-3.5 text-emerald-500" /><span className={isDark ? 'text-emerald-400' : 'text-emerald-700'}>Listening</span></>
            ) : isStopped ? (
              <><Square className="h-3.5 w-3.5 text-slate-400" /><span className={isDark ? 'text-slate-300' : 'text-slate-700'}>Stopped</span></>
            ) : isFailed ? (
              <><AlertCircle className="h-3.5 w-3.5 text-rose-500" /><span className={isDark ? 'text-rose-400' : 'text-rose-700'}>Needs attention</span></>
            ) : isCompleted ? (
              <><CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /><span className={isDark ? 'text-emerald-400' : 'text-emerald-700'}>{isHandoff ? 'Handoff reported' : 'Verified'}</span></>
            ) : state === 'sleeping' ? (
              <><Moon className="h-3.5 w-3.5 text-slate-400" /><span className={isDark ? 'text-slate-300' : 'text-slate-600'}>Resting</span></>
            ) : <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>Companio</span>}
          </div>
          <div className="flex items-center gap-2">
            {(state === 'talking' || isListening) && <AudioVisualizer active={true} color={isListening ? 'bg-emerald-500' : 'bg-emerald-700'} />}
            {isExecuting && onCancel && (
              <button type="button" onClick={onCancel} title="Stop the current task"
                className={`inline-flex items-center gap-1 rounded-lg border px-2 py-0.5 text-[11px] font-semibold transition-colors ${
                  isDark
                    ? 'border-rose-800 bg-rose-950/60 text-rose-300 hover:bg-rose-900/70'
                    : 'border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100'
                }`}>
                <Square className="h-2.5 w-2.5 fill-current" /> Stop
              </button>
            )}
            {isFailed && onRetry && (
              <button type="button" onClick={onRetry} title="Retry this command"
                className={`inline-flex items-center gap-1 rounded-lg border px-2 py-0.5 text-[11px] font-semibold transition-colors ${
                  isDark
                    ? 'border-emerald-800 bg-emerald-950/60 text-emerald-300 hover:bg-emerald-900/70'
                    : 'border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                }`}>
                <RotateCcw className="h-2.5 w-2.5" /> Retry
              </button>
            )}
          </div>
        </div>
        <p className={`max-h-[176px] overflow-y-auto whitespace-pre-wrap break-words text-[13px] font-normal leading-[1.55] select-text ${
          isDark ? 'text-slate-100' : 'text-slate-800'
        }`}>
          {bodyText}
          {isStreaming && <span className="inline-block w-1.5 h-3.5 ml-0.5 align-middle bg-emerald-600 animate-pulse" aria-hidden="true" />}
        </p>
        {isFailed && activePlan?.recoveryHint && (
          <p className={`mt-2 rounded-lg border px-2.5 py-1.5 text-[11px] leading-snug ${
            isDark
              ? 'border-amber-800/80 bg-amber-950/50 text-amber-200'
              : 'border-amber-200 bg-amber-50/70 text-amber-900'
          }`}>
            {activePlan.recoveryHint}
          </p>
        )}
        {activePlan && activePlan.steps.length > 1 && (isExecuting || activePlan.status === 'planning' || activePlan.status === 'failed' || activePlan.status === 'cancelled' || isCompleted) && (
          <div className={`mt-2.5 space-y-1 border-t pt-2 ${isDark ? 'border-slate-800' : 'border-slate-100'}`}>
            {activePlan.steps.map((step, idx) => (
              <div key={step.id} className="flex items-center justify-between gap-3 text-[11px]">
                <span className={`min-w-0 truncate ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{idx + 1}. {step.description}</span>
                <span className={`shrink-0 font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  {step.status === 'success' ? (step.result?.handoffOnly ? 'Sent' : 'Verified') : step.status === 'running' ? 'Working' : step.status === 'failed' ? (step.result?.success ? 'Unverified' : 'Failed') : step.status === 'cancelled' ? 'Not continued' : 'Queued'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
