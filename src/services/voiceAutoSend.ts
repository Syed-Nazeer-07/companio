import { isCommandRequest } from './intentSafety';
import { parseCompanionCommand } from './companionCommands';

/** Voice is push-to-talk. Auto-execution is limited to explicitly named,
 * reversible destinations and local screenshots. Ambiguous search, unknown
 * applications, data-changing operations and multi-step plans need review.
 */
export function shouldAutoSubmitVoice(
  transcript: string,
  confidence: number | undefined,
  enabled: boolean
): boolean {
  if (!enabled || typeof transcript !== 'string' || transcript.trim().length < 3 ||
      transcript.length > 500 || (Number.isFinite(confidence) && (confidence ?? 0) < 0.85)) {
    return false;
  }
  const command = transcript.trim();
  if (/[\u0000-\u001f]/.test(command)) return false;
  // When Whisper supplies no calibrated score, non-action conversation and
  // Companio-only commands remain safe to submit without a second click.
  if (parseCompanionCommand(command)) return true;
  // Stay conservative even if the current deterministic desktop planner
  // does not recognize an imperative verb yet.
  if (/^(?:(?:hey|ok|okay)\s+(?:companio|companion)[,!:]?\s*)?(?:please\s+)?(?:move|send|type|click|delete|erase|install|download|run|execute|restart|shutdown|open|close|launch|play|pause|search|find|navigate|visit|browse|mute|unmute|set|change)\b/i.test(command)) return false;
  return !isCommandRequest(command);
}

/**
 * Only exact, known, low-risk one-step actions may run from a finished voice
 * transcript. No arbitrary URLs or search text are sent to external services.
 * The mic was explicitly activated and multi-step plans remain approval-gated.
 */
export function shouldAutoRunBasicVoiceCommand(
  transcript: string,
  confidence: number | undefined,
  enabled: boolean,
  alternatives: string[] = []
): boolean {
  if (!enabled || typeof transcript !== 'string' || alternatives.length ||
      transcript.length > 160 || (Number.isFinite(confidence) && (confidence ?? 0) < 0.85)) return false;
  const request=transcript.trim().toLowerCase()
    .replace(/^(?:(?:hey|hi|ok|okay)\s+)?companio[,!:]?\s+/,'')
    .replace(/^please\s+/,'')
    .replace(/[.!?]+$/,'')
    .trim();
  // Strictly literal destinations; even a single extra spoken word makes
  // this fail closed and opens the editable transcript instead.
  return /^(?:open|launch)\s+(?:youtube|google|github|calculator|notepad|chatgpt|spotify|file explorer)$/.test(request)
    || /^(?:take|capture)\s+(?:(?:a|the)\s+)?(?:screenshot|screen shot)$/.test(request);
}
