// Speech Recognition & Synthesis Service with Audio Chimes

export class SpeechService {
  private recognition: any = null;
  private isListening: boolean = false;
  private audioCtx: AudioContext | null = null;
  private mouthAnimInterval: any = null;
  private micStream: MediaStream | null = null;
  private micInterval: any = null;

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

  // Push-to-Talk / Voice Start
  startListening(
    onInterim: (text: string) => void,
    onFinal: (text: string) => void,
    onError: (err: string) => void,
    onAudioLevel?: (level: number) => void
  ) {
    if (!this.recognition) {
      onError('Speech recognition not supported in this environment. Use text input.');
      return;
    }

    if (this.isListening) {
      this.stopListening();
    }

    this.playChime('activate');

    // Live microphone volume reactivity
    if (onAudioLevel && navigator.mediaDevices?.getUserMedia) {
      navigator.mediaDevices.getUserMedia({ audio: true }).then((stream) => {
        this.micStream = stream;
        try {
          const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
          const source = audioCtx.createMediaStreamSource(stream);
          const analyser = audioCtx.createAnalyser();
          analyser.fftSize = 64;
          source.connect(analyser);
          const data = new Uint8Array(analyser.frequencyBinCount);
          this.micInterval = setInterval(() => {
            analyser.getByteFrequencyData(data);
            let sum = 0;
            for (let i = 0; i < data.length; i++) sum += data[i];
            const avg = sum / data.length;
            const norm = Math.min(1, Math.max(0, (avg - 10) / 70));
            onAudioLevel(norm);
          }, 50);
        } catch (e) {}
      }).catch(() => {});
    }

    this.recognition.onresult = (event: any) => {
      let interim = '';
      let final = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          final += event.results[i][0].transcript;
        } else {
          interim += event.results[i][0].transcript;
        }
      }
      if (interim) onInterim(interim);
      if (final) {
        this.stopListening();
        onFinal(final.trim());
      }
    };

    this.recognition.onerror = (event: any) => {
      this.stopListening();
      if (event.error === 'no-speech' || event.error === 'aborted') {
        return; // Normal silence or user cancellation
      }
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        onError('Mic permission needed in Windows settings. Speak or type below!');
        return;
      }
      onError('Listening paused. Click mic to speak or type your request.');
    };

    this.recognition.onend = () => {
      this.stopListening();
    };

    try {
      this.recognition.start();
      this.isListening = true;
    } catch (e: any) {
      this.stopListening();
      // If already active, restart cleanly
      if (e.name === 'InvalidStateError') {
        try {
          this.recognition.stop();
          setTimeout(() => {
            try { this.recognition.start(); this.isListening = true; } catch {}
          }, 200);
        } catch {}
      } else {
        onError('Click mic to speak or type your request below.');
      }
    }
  }

  stopListening() {
    if (this.micInterval) {
      clearInterval(this.micInterval);
      this.micInterval = null;
    }
    if (this.micStream) {
      this.micStream.getTracks().forEach((t) => t.stop());
      this.micStream = null;
    }
    if (this.recognition && this.isListening) {
      try {
        this.recognition.stop();
      } catch (e) {}
      this.isListening = false;
    }
  }

  // Text-To-Speech
  speak(
    text: string,
    options: {
      voiceName?: string;
      rate?: number;
      pitch?: number;
      volume?: number;
      muted?: boolean;
      onStart?: () => void;
      onEnd?: () => void;
      onAudioLevel?: (level: number) => void;
    } = {}
  ) {
    if (options.muted || !('speechSynthesis' in window)) {
      if (options.onStart) options.onStart();
      if (options.onEnd) setTimeout(options.onEnd, 1000);
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = options.rate ?? 1.0;
    utterance.pitch = options.pitch ?? 1.0;
    utterance.volume = options.volume ?? 1.0;

    const voices = window.speechSynthesis.getVoices();
    if (options.voiceName) {
      const selectedVoice = voices.find(v => v.name === options.voiceName);
      if (selectedVoice) utterance.voice = selectedVoice;
    } else {
      // Prefer friendly, sweet natural English voices
      const preferred = voices.find(v => 
        v.lang.startsWith('en') && 
        (v.name.includes('Jenny') || v.name.includes('Aria') || v.name.includes('Zira') || v.name.includes('Samantha') || v.name.includes('Natural'))
      ) || voices.find(v => v.lang.startsWith('en'));
      if (preferred) utterance.voice = preferred;
    }

    if (options.pitch === undefined) {
      utterance.pitch = 1.08;
    }

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

    utterance.onend = () => {
      clearInterval(this.mouthAnimInterval);
      if (options.onAudioLevel) options.onAudioLevel(0);
      if (options.onEnd) options.onEnd();
    };

    utterance.onerror = () => {
      clearInterval(this.mouthAnimInterval);
      if (options.onAudioLevel) options.onAudioLevel(0);
      if (options.onEnd) options.onEnd();
    };

    window.speechSynthesis.speak(utterance);
  }

  stopSpeaking() {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    clearInterval(this.mouthAnimInterval);
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
