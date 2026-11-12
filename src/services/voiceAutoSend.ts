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
 * Convert explicitly named, low-risk spoken commands into the deterministic
 * command wording already supported by Companio. This prevents "the YouTube"
 * or extra politeness words from reaching the general-purpose planner.
 *
 * This function NEVER accepts URLs, arbitrary programs, searches, combined
 * instructions, or destructive commands. Unknown/untrusted speech is displayed
 * for review instead of automatically submitted.
 */
export function canonicalBasicVoiceCommand(
  transcript: string,
  confidence: number | undefined,
  enabled: boolean,
  alternatives: string[] = []
): string | null {
  if (!enabled || typeof transcript !== 'string' || alternatives.length ||
      transcript.length > 160 || !transcript.trim() ||
      /[\u0000-\u001f\u007f]/.test(transcript) ||
      (confidence !== undefined && (!Number.isFinite(confidence) || confidence < 0.85 || confidence > 1))) {
    return null;
  }
  const request = transcript.trim().toLowerCase()
    .replace(/^(?:(?:hey|hi|ok|okay)\s+)?(?:companio|companion)[,!:]?\s+/, '')
    .replace(/^(?:please\s+)?(?:(?:can|could|would)\s+you\s+)?(?:please\s+)?/, '')
    .replace(/[.!?]+$/, '')
    .trim();

  // Exact destinations only. Canonical values are the literal actions already
  // implemented by the built-in planner, not arbitrary transcribed input.
  const app = request.match(/^(?:open|launch|start)\s+(?:(?:the|windows)\s+)?(youtube|google|github|calculator|notepad|chatgpt|spotify|file explorer|vs code|vscode|visual studio code)$/);
  if (app) {
    const names: Record<string, string> = {
      youtube: 'YouTube', google: 'Google', github: 'GitHub',
      calculator: 'Calculator', notepad: 'Notepad', chatgpt: 'ChatGPT',
      spotify: 'Spotify', 'file explorer': 'File Explorer',
      'vs code': 'VS Code', vscode: 'VS Code', 'visual studio code': 'VS Code'
    };
    return 'Open ' + names[app[1]];
  }
  // Speech often ends a simple screenshot request with "please", "now"
  // or "for me". Trim only these fixed polite suffixes and still require
  // the entire request to match a local screenshot command exactly.
  const screenshotRequest = request.replace(/\s+(?:please|now|for me)$/, '').trim();
  if (/^(?:take|capture|save|grab)\s+(?:(?:a|the|my)\s+)?(?:screenshot|screen shot|screen|ss)$/.test(screenshotRequest) ||
      /^(?:screenshot|screen shot)$/.test(screenshotRequest))
    return 'Take a screenshot';
  return null;
}

/** Compatibility wrapper for callers that need only an allow/deny decision. */
export function shouldAutoRunBasicVoiceCommand(
  transcript: string,
  confidence: number | undefined,
  enabled: boolean,
  alternatives: string[] = []
): boolean {
  return canonicalBasicVoiceCommand(transcript, confidence, enabled, alternatives) !== null;
}
