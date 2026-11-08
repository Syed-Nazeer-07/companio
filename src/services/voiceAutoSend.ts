import { isCommandRequest } from './intentSafety';
import { parseCompanionCommand } from './companionCommands';

/** Never auto-run an arbitrary desktop/browser command from misheard speech.
 * Native Windows recognition supplies an actual confidence score. Browser
 * implementations that omit it remain in transcript-review mode.
 */
export function shouldAutoSubmitVoice(
  transcript: string,
  confidence: number | undefined,
  enabled: boolean
): boolean {
  if (!enabled || typeof transcript !== 'string' || transcript.trim().length < 3 ||
      transcript.length > 500 || !Number.isFinite(confidence) || (confidence ?? 0) < 0.85) {
    return false;
  }
  const command = transcript.trim();
  if (/[\u0000-\u001f]/.test(command)) return false;
  // Only the small, reversible Companio control grammar may run without
  // the manual review needed for Windows apps, websites and system commands.
  if (parseCompanionCommand(command)) return true;
  return !isCommandRequest(command);
}
