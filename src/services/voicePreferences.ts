/**
 * Older previews defaulted to Windows dictation. Upgrade that implicit default
 * to Automatic, which prefers bundled offline speech, while preserving an
 * explicit voice engine preference selected in newer releases.
 */
export function migrateVoicePreferences<T extends {
  recognitionEngine?: string;
  recognitionEngineExplicit?: boolean;
}>(voice: T): T {
  if (voice.recognitionEngine === 'windows' && voice.recognitionEngineExplicit !== true) {
    return { ...voice, recognitionEngine: 'auto' };
  }
  return voice;
}
