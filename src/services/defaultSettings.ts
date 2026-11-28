import { AppSettings } from '../types';

export const DEFAULT_SETTINGS: AppSettings = {
  firstTimeSetupDone: false,
  theme: 'light',
  activationShortcut: 'Ctrl+Shift+Space',
  characterId: 'sparky',
  characterName: 'Companio',
  character: {
    id: 'sparky',
    name: 'Sparky',
    tagline: 'Studio Astral Sprite',
    description: 'Porcelain studio sprite in an emerald mantle crowned by a warm brass star.',
    accentColor: '#146a59',
    glowColor: 'rgba(20, 106, 89, 0.25)',
    badge: 'Featured'
  },
  ai: {
    provider: 'auto',
    apiKey: '',
    model: 'qwen2.5-1.5b',
    managedModelId: 'qwen2.5-1.5b',
    performanceMode: 'balanced',
    temperature: 0.7,
    personality: 'friendly',
    systemPrompt: 'You are Companio, an intelligent personal AI desktop companion for Windows 11.',
    useLongTermMemory: true
  },
  voice: {
    wakePhraseEnabled: false,
    autoSendSafeSpeech: true,
    wakePhrase: 'Hey Companio',
    pushToTalkKey: 'Space',
    sttEngine: 'browser',
    recognitionLanguage: 'en-IN',
    recognitionEngine: 'auto',
    ttsVoice: '',
    ttsRate: 1.0,
    ttsPitch: 1.05,
    ttsVolume: 1.0,
    muted: false,
    audioReactivity: 1.0
  },
  overlay: {
    x: 0,
    y: 0,
    scale: 1.0,
    alwaysOnTop: true,
    snapToEdge: true,
    autoHideInFullscreen: true,
    soundEffects: true,
    transparentClickthrough: true,
    companionMode: 'floating',
    showHistorySuggestions: true
  }
};
