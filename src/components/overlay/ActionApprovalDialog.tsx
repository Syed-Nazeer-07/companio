import React from 'react';
import { ShieldCheck, X, Play } from 'lucide-react';
import type { TaskPlan } from '../../types';

interface ActionApprovalDialogProps {
  plan: TaskPlan;
  onApprove: () => void;
  onCancel: () => void;
}

// Approval is a separate user interaction. Model text cannot trigger Run.
export const ActionApprovalDialog: React.FC<ActionApprovalDialogProps> = ({
  plan, onApprove, onCancel
}) => (
  <div className="absolute inset-0 z-[100] flex items-center justify-center bg-slate-950/45 p-3 backdrop-blur-[3px] app-no-drag">
    <section
      role="dialog"
      aria-modal="true"
      aria-labelledby="companio-approval-title"
      aria-describedby="companio-approval-description"
      className="flex max-h-[95%] w-full max-w-[330px] flex-col overflow-hidden rounded-[20px] border border-slate-200 bg-white text-slate-900 shadow-2xl"
    >
      <header className="flex items-start gap-3 border-b border-slate-100 px-4 py-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-sky-100 text-sky-700">
          <ShieldCheck size={19} aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 id="companio-approval-title" className="text-sm font-bold">Approve desktop actions</h2>
          <p id="companio-approval-description" className="mt-0.5 text-[11px] leading-relaxed text-slate-600">
            Nothing has run yet. Review every step before proceeding.
          </p>
        </div>
        <button type="button" onClick={onCancel} aria-label="Cancel actions"
          className="rounded-lg p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-900">
          <X size={16} aria-hidden="true" />
        </button>
      </header>
      <ol className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3" aria-label="Actions requiring approval">
        {plan.steps.map((step, index) => (
          <li key={step.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <div className="flex items-start gap-2">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-sky-100 text-[10px] font-bold text-sky-800">
                {index + 1}
              </span>
              <p className="text-xs font-semibold leading-snug">{step.description}</p>
            </div>
            <div className="mt-2 rounded-lg border border-slate-100 bg-white px-2.5 py-2">
              <code className="block break-all text-[10px] font-semibold text-sky-800">{step.tool}</code>
              <pre className="mt-1 whitespace-pre-wrap break-all text-[10px] leading-snug text-slate-600">
                {JSON.stringify(step.params, null, 2)}
              </pre>
            </div>
          </li>
        ))}
      </ol>
      <footer className="flex gap-2 border-t border-slate-100 bg-white p-3">
        <button type="button" autoFocus onClick={onCancel}
          className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-100">
          Cancel
        </button>
        <button type="button" onClick={onApprove}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-sky-600 px-3 py-2.5 text-xs font-bold text-white hover:bg-sky-700">
          <Play size={13} aria-hidden="true" />
          Run {plan.steps.length} {plan.steps.length === 1 ? 'action' : 'actions'}
        </button>
      </footer>
    </section>
  </div>
);
