// Keep onboarding feedback honest: a dispatched action is not proof of execution.
export function classifyActionOutcome(result, label = 'Action') {
  const name = typeof label === 'string' && label.trim() ? label.trim() : 'Action';
  if (!result || result.success !== true) {
    const reason = typeof result?.error === 'string' && result.error.trim()
      ? result.error.trim()
      : 'The desktop app did not confirm execution.';
    return { kind: 'error', message: `${name} failed: ${reason}` };
  }
  if (result.verified === true) {
    return { kind: 'verified', message: `${name} verified.` };
  }
  return {
    kind: 'unverified',
    message: `${name} was requested, but completion could not be verified.`
  };
}
