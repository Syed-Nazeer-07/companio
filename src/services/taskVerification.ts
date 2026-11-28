import type { TaskPlan, TaskStep } from '../types';

export function verifiedOutcome(result: any): boolean {
  return result?.success === true && result?.verified === true;
}

function nativeMessage(step: TaskStep): string | undefined {
  const message = step.result?.message;
  return typeof message === 'string' && message.trim() ? message.trim().slice(0, 1800) : undefined;
}

// Report what the tool actually established, not a promise inferred from its name.
// Windows shell handoffs are not evidence of page load, playback or app state.
export function getDelightfulSuccessMessage(plan: TaskPlan): string {
  const completed = plan.steps.filter(step => step.status === 'success' && verifiedOutcome(step.result));
  const sent = completed.filter(step => step.result?.handoffOnly === true);
  const verified = completed.filter(step => step.result?.handoffOnly !== true);
  if (completed.length !== plan.steps.length || !completed.length) {
    return 'Not all requested actions have a confirmed outcome. Review task history.';
  }
  if (completed.length === 1) {
    const step = completed[0];
    if (sent.length) return 'Windows accepted the launch request. The destination was not independently verified.';
    return nativeMessage(step) || 'Verified: ' + step.description + '.';
  }
  const lines = completed.map((step, index) => {
    if (step.result?.handoffOnly) return (index+1)+'. Sent — '+step.description+' (destination unverified)';
    const detail = nativeMessage(step);
    return (index+1)+'. Verified — '+step.description+(detail?' — '+detail.slice(0,350):'');
  });
  return [verified.length+' verified; '+sent.length+' handed off to Windows.', ...lines].join('\n');
}
