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
    tagline: 'Cute Animated Robot',
    description: 'Cybernetic animated assistant',
    accentColor: '#0ea5e9',
    glowColor: 'rgba(14, 165, 233, 0.3)',
    badge: 'Popular'
  },
  ai: {
    provider: 'mock',
    apiKey: '',
    model: 'companio-deterministic-v1',
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
    transparentClickthrough: false,
    companionMode: 'floating'
  }
};
