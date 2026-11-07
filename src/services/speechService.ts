// Speech Recognition & Synthesis Service with Audio Chimes
import { desktopBridge, isNativeDesktop } from './desktopBridge';

export interface CharacterVoiceProfile {
  rate: number;
  pitch: number;
  voiceNameKeywords: string[];
}

export function getCharacterVoiceProfile(characterId: string): CharacterVoiceProfile {
  switch (characterId) {
    case 'sparky':
      return { rate: 1.15, pitch: 0.95, voiceNameKeywords: ['David', 'George', 'Guy', 'Mark'] };
    case 'pixel':
      return { rate: 1.25, pitch: 1.35, voiceNameKeywords: ['Zira', 'Samantha', 'Aria'] };
    case 'mochi':
      return { rate: 1.05, pitch: 1.45, voiceNameKeywords: ['Jenny', 'Zira', 'Aria'] };
    case 'cloudie':
      return { rate: 0.88, pitch: 1.15, voiceNameKeywords: ['Jenny', 'Zira', 'Natural'] };
    case 'kiko':
      return { rate: 1.18, pitch: 1.55, voiceNameKeywords: ['Zira', 'Aria', 'Jenny'] };
    case 'boba':
      return { rate: 0.95, pitch: 0.92, voiceNameKeywords: ['David', 'Guy', 'George'] };
    default:
      return { rate: 1.05, pitch: 1.15, voiceNameKeywords: ['Zira', 'Jenny', 'Aria'] };
  }
}

export class SpeechService {
  private recognition: any = null;
  private isListening: boolean = false;
  private audioCtx: AudioContext | null = null;
  private mouthAnimInterval: any = null;
  private micStream: MediaStream | null = null;
  private micInterval: any = null;
  private micAudioCtx: AudioContext | null = null;
  private listenToken = 0;
  private activeSpeechFinish: (() => void) | null = null;

  constructor() {
    this.initRecognition();
  }

  private initRecognition() {
    const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRec) {
      this.recognition = new SpeechRec();
      this.recognition.continuous = false;
      this.recognition.interimResults = true;
      this.recognition.lang = 'en-US';
    }
  }

  // One listening session at a time, even when a recognizer returns late.
  // Native Windows speech is explicitly one-shot and does not provide a
  // continuous offline wake-word detector.
  async startListening(
    onInterim: (text: string) => void,
    onFinal: (text: string) => void,
    onError: (err: string) => void,
    onAudioLevel?: (level: number) => void,
    onStop?: () => void
  ): Promise<void> {
    this.stopListening();
    const token = ++this.listenToken;
    this.isListening = true;
    const active = () => this.isListening && token === this.listenToken;
    const complete = (kind: 'result' | 'silence' | 'error', detail?: string) => {
      if (!active()) return;
      this.stopListening();
      if (kind === 'result' && detail?.trim()) onFinal(detail.trim());
      else if (kind === 'error') onError(detail || 'Speech recognition did not start.');
      else onStop?.();
    };

    this.playChime('activate');
    onInterim('Listening…');

    if (isNativeDesktop()) {
      try {
        const res = await desktopBridge.startNativeSpeech(6);
        if (!active()) return; // Discard transcripts from cancelled sessions.
        if (res.success && res.text?.trim()) complete('result', res.text);
        else if (res.silence || res.cancelled) complete('silence');
        else complete('error', res.error || 'Windows speech recognition was unavailable. Use text input.');
      } catch (error) {
        complete('error', error instanceof Error ? error.message : 'Windows microphone recognition failed.');
      }
      return;
    }

    if (!this.recognition) {
      complete('error', 'Voice recognition is unavailable in this browser. You can type your command.');
      return;
    }

    // An audio meter is optional. Never allow a late mic permission response
    // to keep recording after the user has stopped the speech session.
    if (onAudioLevel && navigator.mediaDevices?.getUserMedia) {
      navigator.mediaDevices.getUserMedia({ audio: true }).then((stream) => {
        if (!active()) {
          stream.getTracks().forEach(track => track.stop());
          return;
        }
        this.micStream = stream;
        try {
          const Ctx = window.AudioContext || (window as any).webkitAudioContext;
          if (!Ctx) return;
          this.micAudioCtx = new Ctx();
          const source = this.micAudioCtx!.createMediaStreamSource(stream);
          const analyser = this.micAudioCtx!.createAnalyser();
          analyser.fftSize = 64;
          source.connect(analyser);
          const data = new Uint8Array(analyser.frequencyBinCount);
          this.micInterval = setInterval(() => {
            if (!active()) return;
            analyser.getByteFrequencyData(data);
            const average = data.reduce((total, value) => total + value, 0) / data.length;
            onAudioLevel(Math.min(1, Math.max(0, (average - 10) / 70)));
          }, 80);
        } catch {
          // Browser speech recognition remains usable without a meter.
        }
      }).catch(() => {});
    }

    this.recognition.onresult = (event: any) => {
      if (!active()) return;
      let interim = '';
      let final = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) final += result[0].transcript;
        else interim += result[0].transcript;
      }
      if (interim) onInterim(interim);
      if (final.trim()) complete('result', final);
    };
    this.recognition.onerror = (event: any) => {
      if (!active()) return;
      if (['no-speech', 'aborted'].includes(event.error)) complete('silence');
      else complete('error', 'Microphone recognition failed (' + (event.error || 'unknown') + ').');
    };
    this.recognition.onend = () => complete('silence');
    try {
      this.recognition.start();
    } catch (error) {
      complete('error', error instanceof Error ? error.message : 'Speech recognition could not start.');
    }
  }

  stopListening(): void {
    this.listenToken++;
    this.isListening = false;
    if (isNativeDesktop()) {
      void desktopBridge.cancelNativeSpeech().catch(() => {});
    }
    if (this.micInterval) {
      clearInterval(this.micInterval);
      this.micInterval = null;
    }
    if (this.micStream) {
      this.micStream.getTracks().forEach(track => track.stop());
      this.micStream = null;
    }
    if (this.micAudioCtx) {
      void this.micAudioCtx.close().catch(() => {});
      this.micAudioCtx = null;
    }
    if (this.recognition) {
      try { this.recognition.stop(); } catch {}
    }
  }

  // Text-To-Speech with Character Profiles
  speak(
    text: string,
    options: {
      voiceName?: string;
      rate?: number;
      pitch?: number;
      volume?: number;
      characterId?: string;
      muted?: boolean;
      onStart?: () => void;
      onEnd?: () => void;
      onAudioLevel?: (level: number) => void;
    } = {}
  ) {
    this.stopSpeaking();
    if (options.muted || !('speechSynthesis' in window) || !text.trim()) {
      options.onAudioLevel?.(0);
      options.onEnd?.();
      return;
    }

    const profile = options.characterId ? getCharacterVoiceProfile(options.characterId) : null;
    // User sliders are relative modifiers. The voice profiles remain effective
    // even when preferences have their ordinary default values.
    const finalRate = Math.min(10, Math.max(0.1, (profile?.rate ?? 1) * (options.rate ?? 1)));
    const finalPitch = Math.min(2, Math.max(0, (profile?.pitch ?? 1) * (options.pitch ?? 1)));

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = finalRate;
    utterance.pitch = finalPitch;
    utterance.volume = options.volume ?? 1.0;

    const voices = window.speechSynthesis.getVoices();
    if (options.voiceName) {
      const selectedVoice = voices.find(v => v.name === options.voiceName);
      if (selectedVoice) utterance.voice = selectedVoice;
    } else if (profile) {
      const preferred = voices.find(v =>
        v.lang.startsWith('en') && profile.voiceNameKeywords.some(k => v.name.includes(k))
      ) || voices.find(v => v.lang.startsWith('en'));
      if (preferred) utterance.voice = preferred;
    } else {
      const preferred = voices.find(v =>
        v.lang.startsWith('en') &&
        (v.name.includes('Jenny') || v.name.includes('Aria') || v.name.includes('Zira') || v.name.includes('Samantha'))
      ) || voices.find(v => v.lang.startsWith('en'));
      if (preferred) utterance.voice = preferred;
    }

    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      if (this.activeSpeechFinish === finish) this.activeSpeechFinish = null;
      clearInterval(this.mouthAnimInterval);
      this.mouthAnimInterval = null;
      options.onAudioLevel?.(0);
      options.onEnd?.();
    };
    this.activeSpeechFinish = finish;

    utterance.onstart = () => {
      if (options.onStart) options.onStart();
      // Simulate audio waveform levels for mouth animation
      if (options.onAudioLevel) {
        clearInterval(this.mouthAnimInterval);
        this.mouthAnimInterval = setInterval(() => {
          const simulatedLevel = 0.2 + Math.random() * 0.7;
          options.onAudioLevel!(simulatedLevel);
        }, 80);
      }
    };

    utterance.onend = finish;
    utterance.onerror = finish;

    try {
      window.speechSynthesis.speak(utterance);
    } catch {
      finish();
    }
  }

  stopSpeaking() {
    if (this.activeSpeechFinish) this.activeSpeechFinish();
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    clearInterval(this.mouthAnimInterval);
    this.mouthAnimInterval = null;
  }

  getAvailableVoices(): SpeechSynthesisVoice[] {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      return window.speechSynthesis.getVoices();
    }
    return [];
  }

  // Web Audio Tone Synthesis
  playChime(type: 'activate' | 'success' | 'error') {
    try {
      if (!this.audioCtx) {
        const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
        if (!AudioCtxClass) return;
        this.audioCtx = new AudioCtxClass();
      }
      if (this.audioCtx.state === 'suspended') {
        this.audioCtx.resume();
      }

      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();
      osc.connect(gain);
      gain.connect(this.audioCtx.destination);

      const now = this.audioCtx.currentTime;

      if (type === 'activate') {
        // High gentle ascending chime
        osc.type = 'sine';
        osc.frequency.setValueAtTime(440, now);
        osc.frequency.exponentialRampToValueAtTime(880, now + 0.15);
        gain.gain.setValueAtTime(0.12, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
        osc.start(now);
        osc.stop(now + 0.25);
      } else if (type === 'success') {
        // Cheerful major chord arpeggio
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(523.25, now); // C5
        osc.frequency.setValueAtTime(659.25, now + 0.08); // E5
        osc.frequency.setValueAtTime(783.99, now + 0.16); // G5
        osc.frequency.setValueAtTime(1046.50, now + 0.24); // C6
        gain.gain.setValueAtTime(0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
        osc.start(now);
        osc.stop(now + 0.4);
      } else if (type === 'error') {
        // Soft error buzz
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(220, now);
        osc.frequency.exponentialRampToValueAtTime(140, now + 0.2);
        gain.gain.setValueAtTime(0.1, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
        osc.start(now);
        osc.stop(now + 0.25);
      }
    } catch (e) {}
  }
}

export const speechService = new SpeechService();
