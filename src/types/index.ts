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

export type CharacterReactionId =
  | 'idle'
  | 'happy'
  | 'excited'
  | 'thinking'
  | 'confused'
  | 'playful'
  | 'concerned'
  | 'proud';

export interface CharacterProfile {
  id: CharacterId;
  name: string;
  tagline: string;
  description: string;
  accentColor: string;
  glowColor: string;
  badge: string;
}

export type AiProvider =
  | 'auto'
  | 'managed_local'
  | 'gemini'
  | 'openai'
  | 'anthropic'
  | 'openrouter'
  | 'groq'
  | 'custom_openai'
  | 'local'
  | 'mock';

export interface AiConfig {
  provider: AiProvider;
  apiKey: string;
  model: string;
  managedModelId?: string;
  performanceMode?: 'battery_saver' | 'balanced' | 'performance';
  cloudCustomEndpoint?: string;
  temperature: number;
  personality: string;
  systemPrompt: string;
  localEndpoint?: string;
  /** Explicit opt-in to sending recent local conversation to the loopback model. */
  useConversationContext?: boolean;
  /** Controls whether curated long-term memories are retrieved for conversational context. */
  useLongTermMemory?: boolean;
}

export type MemoryCategory = 'preference' | 'fact' | 'project' | 'workflow';

export interface MemoryItem {
  id: string;
  content: string;
  category: MemoryCategory;
  pinned: boolean;
  enabled: boolean;
  createdAt: number;
  updatedAt: number;
  lastUsedAt: number | null;
  expiresAt: number | null;
}

export interface VoiceConfig {
  wakePhraseEnabled: boolean;
  wakePhrase: string;
  /** Opt-in: only high-confidence non-automation dictation can auto-send. */
  autoSendSafeSpeech?: boolean;
  pushToTalkKey: string;
  sttEngine: 'browser' | 'cloud' | 'push_only';
  recognitionLanguage?: 'en-IN' | 'en-US' | 'en-GB' | 'en-AU';
  /** Installed Windows dictation is the default. Whisper needs user-selected local files. */
  recognitionEngine?: 'auto' | 'windows' | 'whisper';
  /** True when the user deliberately chose a recognition engine after rc.22. */
  recognitionEngineExplicit?: boolean;
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
  showHistorySuggestions?: boolean;
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
  clarificationNeeded?: boolean;
  recoveryHint?: string;
  retryable?: boolean;
  reactionId?: CharacterReactionId;
  source?: 'builtin' | 'managed_local' | 'cloud' | 'external_local';
  createdAt: number;
}

// Display-only receipt; cannot be executed and carries no tool parameters.
export interface TaskReceipt {
  status: 'completed' | 'failed' | 'cancelled';
  steps: { description: string; outcome: 'verified' | 'sent' | 'failed' | 'unverified' | 'stopped' }[];
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'companio' | 'aura' | 'system';
  content: string;
  timestamp: number;
  taskPlan?: TaskPlan;
  taskReceipt?: TaskReceipt;
  status?: 'success' | 'error' | 'info';
}
