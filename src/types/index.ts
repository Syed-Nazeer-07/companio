export type CharacterId = 'sparky' | 'pixel' | 'mochi' | 'cloudie' | 'kiko' | 'boba' | 'custom';

export type CharacterState = 
  | 'idle' 
  | 'listening' 
  | 'thinking' 
  | 'talking' 
  | 'success' 
  | 'confused' 
  | 'sleeping' 
  | 'waking';

export interface CharacterProfile {
  id: CharacterId;
  name: string;
  tagline: string;
  description: string;
  accentColor: string;
  glowColor: string;
  badge: string;
}

export type AiProvider = 'gemini' | 'openai' | 'anthropic' | 'local' | 'mock';

export interface AiConfig {
  provider: AiProvider;
  apiKey: string;
  model: string;
  temperature: number;
  personality: string;
  systemPrompt: string;
  localEndpoint?: string;
}

export interface VoiceConfig {
  wakePhraseEnabled: boolean;
  wakePhrase: string;
  pushToTalkKey: string;
  sttEngine: 'browser' | 'cloud' | 'push_only';
  ttsVoice: string;
  ttsRate: number;
  ttsPitch: number;
  ttsVolume: number;
  muted: boolean;
  audioReactivity: number;
}

export interface OverlayConfig {
  x: number;
  y: number;
  scale: number;
  alwaysOnTop: boolean;
  snapToEdge: boolean;
  autoHideInFullscreen: boolean;
  soundEffects: boolean;
  transparentClickthrough: boolean;
  companionMode: 'floating' | 'docked';
}

export interface AppSettings {
  firstTimeSetupDone: boolean;
  theme: 'dark' | 'light' | 'system';
  activationShortcut: string;
  characterId: CharacterId;
  characterName: string;
  character: CharacterProfile;
  ai: AiConfig;
  voice: VoiceConfig;
  overlay: OverlayConfig;
}

export interface TaskStep {
  id: string;
  tool: string;
  description: string;
  params: Record<string, any>;
  status: 'pending' | 'running' | 'success' | 'failed' | 'cancelled';
  verification?: string;
  error?: string;
  result?: any;
}

export interface TaskPlan {
  id: string;
  query: string;
  intent: string;
  steps: TaskStep[];
  currentStepIndex: number;
  status: 'planning' | 'executing' | 'verifying' | 'completed' | 'failed' | 'cancelled';
  error?: string;
  finalMessage?: string;
  createdAt: number;
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'companio' | 'aura' | 'system';
  content: string;
  timestamp: number;
  taskPlan?: TaskPlan;
  status?: 'success' | 'error' | 'info';
}
