import type { TaskPlan } from '../types';

// A requested, single, benign launch should work immediately. Do not treat a
// local model's guess as permission for arbitrary sites, volume changes, or
// multiple commands. Those still require review.
const SIMPLE_COMMANDS: Record<string, RegExp> = {
  'browser.youtube.open': /^(?:(?:please\s+)?(?:(?:can|could|would)\s+you\s+)?)?(?:open|launch|start|visit|go\s+to)\s+(?:the\s+)?youtube[.!?]?$/i,
  'win.calculator.launch': /^(?:(?:please\s+)?(?:(?:can|could|would)\s+you\s+)?)?(?:open|launch|start)\s+(?:(?:the|windows)\s+)?calculator[.!?]?$/i,
  'win.notepad.launch': /^(?:(?:please\s+)?(?:(?:can|could|would)\s+you\s+)?)?(?:open|launch|start)\s+(?:the\s+)?notepad[.!?]?$/i,
  'win.spotify.launch': /^(?:(?:please\s+)?(?:(?:can|could|would)\s+you\s+)?)?(?:open|launch|start)\s+(?:the\s+)?spotify[.!?]?$/i
};

export function requiresActionReview(plan: Pick<TaskPlan, 'intent' | 'query' | 'steps'>): boolean {
  if (plan.intent !== 'local_ai_actions' && plan.intent !== 'builtin_sequence') return false;
  if (plan.steps.length !== 1) return true;
  const action = plan.steps[0];
  const expectedRequest = SIMPLE_COMMANDS[action.tool];
  if (!expectedRequest || !expectedRequest.test(plan.query.trim())) return true;
  // No hidden parameters are allowed on an auto-run launch, even if a local
  // model returns an unexpected argument.
  return !action.params || Object.keys(action.params).length !== 0;
}
