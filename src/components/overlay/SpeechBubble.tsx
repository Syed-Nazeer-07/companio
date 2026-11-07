import React from 'react';
import { TaskPlan, CharacterState } from '../../types';
import { AudioVisualizer } from './AudioVisualizer';
import { CheckCircle2, AlertCircle, Square, Sparkles } from 'lucide-react';

interface Props {
  text: string;
  state: CharacterState;
  activePlan?: TaskPlan | null;
  onCancel?: () => void;
  audioLevel?: number;
}

export const SpeechBubble: React.FC<Props> = ({
  text,
  state,
  activePlan,
  onCancel,
  audioLevel = 0
}) => {
  if (!text && !activePlan && state === 'idle') {
    return null;
  }

  const isExecuting = activePlan && activePlan.status === 'executing';
  const isFailed = activePlan && activePlan.status === 'failed';
  const isCompleted = activePlan && activePlan.status === 'completed';

  return (
    <div className="relative mb-3 max-w-[320px] transition-all duration-300 animate-in fade-in zoom-in-95">
      <div className="glass-panel rounded-2xl p-3.5 shadow-[0_12px_32px_rgba(0,0,0,0.12)] border border-slate-200/90 text-slate-800">
        {/* Status header badge */}
        <div className="flex items-center justify-between gap-2 mb-2 pb-1.5 border-b border-slate-200/70 text-xs font-medium">
          <div className="flex items-center gap-1.5">
            {state === 'listening' ? (
              <span className="flex items-center gap-1 text-emerald-600 font-semibold">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                Listening...
              </span>
            ) : state === 'thinking' ? (
              <span className="flex items-center gap-1 text-sky-600 font-semibold">
                <Sparkles className="w-3.5 h-3.5 animate-spin" />
                Planning actions...
              </span>
            ) : isExecuting ? (
              <span className="flex items-center gap-1 text-sky-600 font-semibold">
                <span className="w-2 h-2 rounded-full bg-sky-500 animate-pulse" />
                Executing Action
              </span>
            ) : isCompleted ? (
              <span className="flex items-center gap-1 text-emerald-600 font-semibold">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                Verified & Complete ✨
              </span>
            ) : isFailed ? (
              <span className="flex items-center gap-1 text-rose-600 font-semibold">
                <AlertCircle className="w-3.5 h-3.5 text-rose-500" />
                Task Issue
              </span>
            ) : (
              <span className="text-slate-500 font-medium">Companio</span>
            )}
          </div>

          {/* Audio reactive bars or cancel button */}
          <div className="flex items-center gap-1">
            {(state === 'talking' || state === 'listening') && (
              <AudioVisualizer active={true} color={state === 'listening' ? 'bg-emerald-500' : 'bg-sky-500'} />
            )}
            {isExecuting && onCancel && (
              <button
                onClick={onCancel}
                title="Cancel Task (Esc)"
                className="flex items-center gap-1 px-2 py-0.5 rounded bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 text-[10px] font-medium transition-colors"
              >
                <Square className="w-2.5 h-2.5 fill-current" />
                Stop
              </button>
            )}
          </div>
        </div>

        {/* Main message text */}
        <p className="text-sm font-normal leading-relaxed text-slate-800 select-text">
          {text || (activePlan?.status === 'executing' ? activePlan.steps[activePlan.currentStepIndex]?.description : 'Listening...')}
        </p>

        {/* Multi-step progress list */}
        {activePlan && activePlan.steps.length > 1 && (
          <div className="mt-2.5 pt-2 border-t border-slate-200/70 space-y-1.5">
            {activePlan.steps.map((step, idx) => (
              <div key={step.id} className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5 truncate text-slate-700">
                  <span className="text-[10px] text-slate-400 font-mono">{idx + 1}.</span>
                  <span className="truncate">{step.description}</span>
                </span>
                <span className="text-[10px] shrink-0 font-medium">
                  {step.status === 'success' ? (
                    <span className="text-emerald-600 font-semibold">✓ Done</span>
                  ) : step.status === 'running' ? (
                    <span className="text-sky-600 font-semibold animate-pulse">Running...</span>
                  ) : step.status === 'failed' ? (
                    <span className="text-rose-600 font-semibold">Failed</span>
                  ) : (
                    <span className="text-slate-400">Queued</span>
                  )}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Speech bubble tail pointing towards character */}
      <div className="absolute -bottom-2 right-12 w-4 h-4 glass-panel rotate-45 border-t-0 border-l-0" />
    </div>
  );
};
