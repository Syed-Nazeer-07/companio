import { TaskPlan } from '../types';
import { desktopBridge } from './desktopBridge';
import { dbService } from './dbService';
import { getDelightfulSuccessMessage, verifiedOutcome } from './taskVerification';

// Never let a slow external process freeze Companio indefinitely. A timed-out
// Windows action may still complete, so the caller must NOT retry it silently.
export async function runWithActionDeadline<T>(
  run: () => Promise<T>,
  timeoutMs: number,
  signal: AbortSignal
): Promise<{kind:'done';value:T}|{kind:'timeout'}|{kind:'cancelled'}|{kind:'error';error:unknown}> {
  if(signal.aborted) return {kind:'cancelled'};
  if(!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 120000) {
    return {kind:'error',error:Error('Invalid action timeout.')};
  }
  let operation:Promise<T>;
  try { operation=Promise.resolve(run()); }
  catch(error) { return {kind:'error',error}; }
  let timer:ReturnType<typeof setTimeout>|undefined;
  let abortListener:(()=>void)|undefined;
  const control=new Promise<{kind:'timeout'}|{kind:'cancelled'}>(resolve=>{
    timer=setTimeout(()=>resolve({kind:'timeout'}),timeoutMs);
    abortListener=()=>resolve({kind:'cancelled'});
    signal.addEventListener('abort',abortListener,{once:true});
    if(signal.aborted) abortListener();
  });
  const settled=operation.then(
    value=>({kind:'done' as const,value}),
    error=>({kind:'error' as const,error})
  );
  try { return await Promise.race([control,settled]); }
  finally {
    if(timer!==undefined)clearTimeout(timer);
    if(abortListener)signal.removeEventListener('abort',abortListener);
  }
}
export function actionTimeoutMs(tool:string):number {
  // Playback verification includes YouTube hydration; no broad 90-second
  // permission for ordinary app launches or default-browser handoffs.
  if(tool==='browser.youtube.search_and_play')return 90000;
  if(tool==='browser.open_tabs')return 60000;
  return 30000;
}

export class TaskExecutor {
  private activeAbortController: AbortController | null = null;
  private nativeInFlight: Promise<unknown> | null = null;

  // Emergency Cancel
  cancelActiveTask() {
    if (this.activeAbortController && !this.activeAbortController.signal.aborted) {
      this.activeAbortController.abort();
      return true;
    }
    return false;
  }

  async executePlan(
    plan: TaskPlan, 
    onProgress: (updatedPlan: TaskPlan) => void
  ): Promise<TaskPlan> {
    if (this.nativeInFlight && !this.activeAbortController) throw new Error('A previous Windows action has not returned. Check its outcome before starting another command.');
    if (this.activeAbortController) throw new Error('Another task is still settling. Wait before starting a new action.');
    if (plan.steps.length > 0 && (plan.status !== 'planning' || plan.steps.some(step => step.status !== 'pending'))) {
      throw new Error('This task was already started. Request a fresh plan rather than replaying it.');
    }
    if (plan.steps.length === 0) {
      plan.status = 'completed';
      onProgress({ ...plan });
      return plan;
    }

    const controller = new AbortController();
    this.activeAbortController = controller;
    const { signal } = controller;
    const publish = () => onProgress({ ...plan, steps: plan.steps.map(step => ({ ...step })) });
    const stopRemaining = (index: number) => {
      for (const step of plan.steps.slice(index)) if (step.status === 'pending') step.status = 'cancelled';
    };
    const fail = (index: number, reason: string) => {
      stopRemaining(index + 1);
      plan.status = 'failed';
      const verified = plan.steps.slice(0, index).filter(step => step.status === 'success' && !step.result?.handoffOnly).length;
      const handedOff = plan.steps.slice(0, index).filter(step => step.status === 'success' && step.result?.handoffOnly).length;
      const remaining = plan.steps.length - index - 1;
      plan.error = `${reason}${verified ? ` ${verified} earlier step(s) verified.` : ''}${handedOff ? ` ${handedOff} earlier request(s) handed off to Windows.` : ''}${remaining ? ` ${remaining} remaining step(s) were not run.` : ''}`;
    };

    // Release the active controller on every outcome, including early failure
    // and cancellation; otherwise old requests look live after completion.
    try {
    plan.status = 'executing';
    publish();

    for (let i = 0; i < plan.steps.length; i++) {
      if (signal.aborted) {
        plan.status = 'cancelled';
        plan.error = 'Task was cancelled by the user.';
        for (let j = i; j < plan.steps.length; j++) {
          plan.steps[j].status = 'cancelled';
        }
        publish();
        return plan;
      }

      const step = plan.steps[i];
      plan.currentStepIndex = i;
      step.status = 'running';
      publish();

      const startTime = Date.now();
      try {
        let result: any;
        if (step.tool === 'utility.pomodoro.start') {
          const mins = step.params?.minutes ?? 25;
          if (!Number.isInteger(mins) || mins < 1 || mins > 180) {
            throw new Error('Choose a focus duration of 1–180 minutes.');
          }
          if (typeof Notification === 'undefined' || Notification.permission !== 'granted') {
            throw new Error('Focus reminder requires notification permission. Enable notifications and try again.');
          }
          {
            setTimeout(() => {
              new Notification('Companio Focus Mode Completed! 🍅', {
                body: `Great job! Your ${mins}-minute focus session has ended. Time for a well-deserved stretch break!`
              });
            }, mins * 60 * 1000);
          }
          result = {
            success: true,
            message: `Focus session started for ${mins} minutes! Time to shine 🍅`,
            verified: true
          };
        } else if (step.tool === 'utility.notes.add') {
          const note = step.params?.note || '';
          const saved = await dbService.addNote(note);
          result = {
            success: saved.success,
            message: saved.success ? `Saved note: "${note}" (${saved.count} total note${saved.count === 1 ? '' : 's'}) 📝`
              : 'The note was not saved.',
            error: saved.error,
            verified: saved.success
          };
        } else if (step.tool === 'utility.notes.read') {
          const notes = dbService.getNotes();
          const msg = notes.length > 0
            ? `Here are your notes:\n` + notes.map((n, idx) => `${idx + 1}. ${n}`).join('\n')
            : `Your notes are currently empty! Tell me "take a note: ..." to save one anytime 📝`;
          result = {
            success: true,
            message: msg,
            verified: true
          };
        } else if (step.tool === 'utility.notes.clear') {
          if (!window.confirm('Delete all saved Companio notes? This cannot be undone.')) {
            result = { success: false, verified: false, error: 'Note deletion cancelled.' };
          } else {
            const cleared = await dbService.clearNotes();
            result = {
              success: cleared.success,
              message: cleared.success ? 'All notes cleared! 🧹' : 'Notes could not be cleared.',
              error: cleared.error,
              verified: cleared.success
            };
          }
        } else {
          const timeout=actionTimeoutMs(step.tool);
          const outcome=await runWithActionDeadline(
            () => {
              // A UI timeout/cancel cannot interrupt a native IPC call. Hold the
              // native lease until the real operation settles, not just the race.
              const pending = Promise.resolve(desktopBridge.executeTool(step.tool, step.params));
              this.nativeInFlight = pending;
              const release = () => { if (this.nativeInFlight === pending) this.nativeInFlight = null; };
              void pending.then(release, release);
              return pending;
            },
            timeout,
            signal
          );
          if(outcome.kind==='done') result=outcome.value;
          else if(outcome.kind==='cancelled'){
            step.status='cancelled';
            step.result={success:false,verified:false,cancelled:true,outcomeUnknown:true};
            dbService.addLog(step.tool,step.params,step.result,false,Date.now()-startTime);
            plan.status='cancelled';
            plan.error='Stopped by user. An already-started Windows action may still finish.';
            for(let j=i+1;j<plan.steps.length;j++)plan.steps[j].status='cancelled';
            publish();
            return plan;
          } else if(outcome.kind==='timeout') {
            result={success:false,verified:false,error:
              'No confirmation within '+Math.round(timeout/1000)+
              ' seconds. The action may still finish; check Windows before retrying.'};
          } else {
            throw outcome.error instanceof Error ? outcome.error : Error(String(outcome.error));
          }
        }

        const duration = Date.now() - startTime;

        if (signal.aborted) {
          step.status = 'cancelled';
          step.result = {success:false,verified:false,cancelled:true,outcomeUnknown:true};
          dbService.addLog(step.tool,step.params,step.result,false,duration);
          plan.status = 'cancelled';
          plan.error = 'Stopped by user. An already-started Windows action may still finish.';
          for(let j=i+1;j<plan.steps.length;j++)plan.steps[j].status='cancelled';
          publish();
          return plan;
        }

        if (verifiedOutcome(result)) {
          step.status = 'success';
          step.result = result;
          // Log to local SQLite database
          dbService.addLog(step.tool, step.params, result, result.verified !== false, duration);
        } else {
          step.status = 'failed';
          step.result = result;
          step.error = result?.error || (result?.success ? 'Action attempted but outcome not verified.' : 'Execution failed.');
          fail(i, `Step stopped: ${step.description}. ${step.error}`);
          dbService.addLog(step.tool, step.params, result, false, duration);
          publish();
          return plan;
        }
      } catch (err: any) {
        step.status = 'failed';
        step.error = err instanceof Error ? err.message : String(err);
        step.result = {success:false,verified:false,error:step.error};
        dbService.addLog(step.tool,step.params,step.result,false,Date.now()-startTime);
        fail(i, `Error executing ${step.tool}: ${step.error}`);
        publish();
        return plan;
      }

      publish();
    }

    plan.status = 'completed';
    plan.finalMessage = getDelightfulSuccessMessage(plan);
    publish();
    return plan;
    } finally {
      if (this.activeAbortController === controller) this.activeAbortController = null;
    }
  }
}
