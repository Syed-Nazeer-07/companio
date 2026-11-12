/**
 * Local-only voice activity tracker. It controls recording duration; Whisper
 * still determines the actual words and can reject non-speech.
 * Low energy microphones should not be cut off after an 850ms gap.
 */
export interface SpeechActivitySample {
  detected: boolean;
  stop: boolean;
}
export function createSpeechActivityTracker() {
  let sustainedFrames = 0;
  let detected = false;
  let lastVoiceMs = 0;
  return (rms: number, elapsedMs: number): SpeechActivitySample => {
    const energy = Number.isFinite(rms) ? Math.max(0, rms) : 0;
    const elapsed = Number.isFinite(elapsedMs) ? Math.max(0, elapsedMs) : 0;
    if (energy >= 0.005) {
      sustainedFrames++;
      if (sustainedFrames >= 2) {
        detected = true;
        lastVoiceMs = elapsed;
      }
    } else {
      sustainedFrames = 0;
    }
    // Allow up to 6.5s to begin, 1.8s of pause after speaking, 14s maximum.
    // The old 850ms cutoff routinely truncated natural speech.
    const stop = elapsed >= 14000
      || (!detected && elapsed >= 6500)
      || (detected && elapsed >= 1000 && elapsed - lastVoiceMs >= 1800);
    return { detected, stop };
  };
}
