// Safe bridge to native desktop capabilities via Electron IPC or web fallback

interface CompanioDesktopAPI {
  executeTool: (toolName: string, params: Record<string, any>) => Promise<any>;
  getVolume: () => Promise<any>;
  setVolume: (level: number) => Promise<any>;
  setMute: (mute: boolean) => Promise<any>;
  takeScreenshot: () => Promise<any>;
  toggleDashboard: (show?: boolean) => Promise<boolean>;
  setIgnoreMouseEvents: (ignore: boolean) => Promise<boolean> | void;
  setOverlayInteractiveRects?: (rects: Array<{ x: number; y: number; width: number; height: number }>) => Promise<boolean>;
  getOverlayBounds?: () => Promise<{ x: number; y: number; width: number; height: number } | null>;
  startOverlayDrag?: () => Promise<{ success: boolean; bounds?: { x: number; y: number; width: number; height: number } }>;
  moveOverlayDrag?: () => Promise<{ success: boolean; bounds?: { x: number; y: number; width: number; height: number } }>;
  endOverlayDrag?: () => Promise<{ success: boolean; bounds?: { x: number; y: number; width: number; height: number } }>;
  showOverlayPassive?: () => Promise<boolean>;
  saveOverlayPosition: (x: number, y: number) => Promise<boolean>;
  getOverlayPosition: () => Promise<{ x: number; y: number } | null>;
  moveCompanion?: (direction: 'left' | 'right' | 'up' | 'down') => Promise<{ success: boolean; verified: boolean; moved?: boolean; message?: string; error?: string }>; 
  setActivationShortcut: (shortcut: string) => Promise<{ success: boolean; shortcut?: string; error?: string }>;
  setOverlayPreferences: (options: { alwaysOnTop: boolean; snapToEdge: boolean }) => Promise<{ success: boolean; error?: string }>;
  getStartupStatus?: () => Promise<{ success: boolean; supported: boolean; enabled: boolean; blockedByWindows?: boolean; verified?: boolean; reason?: string; error?: string }>;
  setStartupEnabled?: (enabled: boolean) => Promise<{ success: boolean; supported: boolean; enabled: boolean; blockedByWindows?: boolean; verified?: boolean; reason?: string; error?: string }>;
  minimizeWindow: () => Promise<void>;
  quitApp: () => Promise<void>;
  hideOverlay: () => Promise<boolean>;
  showOverlay: () => Promise<boolean>;
  notifyOverlayReady?: () => Promise<boolean>;
  onGlobalShortcutTriggered: (callback: () => void) => () => void;
  onGlobalShortcutToggle?: (callback: () => void) => () => void;
  onGlobalShortcutDismiss?: (callback: () => void) => () => void;
  startNativeSpeech?: (timeoutSec?: number, language?: string) => Promise<{ success: boolean; text?: string; confidence?: number; language?: string; alternatives?: string[]; silence?: boolean; cancelled?: boolean; error?: string }>;
  cancelNativeSpeech?: () => Promise<any>;
  getWhisperStatus?: () => Promise<{supported:boolean; arch?:string; configured:boolean; busy:boolean; executable:string|null; model:string|null; message:string; binaryDownload?:{downloading:boolean;received:number;total:number};download?:{downloading:boolean;received:number;total:number}}>;
  chooseWhisperFile?: (kind:'binary'|'model') => Promise<{success:boolean; cancelled?:boolean; configured?:boolean; error?:string}>;
  transcribeWithWhisper?: (wav:Uint8Array) => Promise<{success:boolean; text?:string; silence?:boolean; cancelled?:boolean; language?:string; error?:string}>;
  cancelWhisper?: () => Promise<{success:boolean;cancelled:boolean}>;
  downloadWhisperModel?: (options?: {forceReinstall?:boolean}) => Promise<{success:boolean;configured?:boolean;reused?:boolean;corrupted?:boolean;error?:string}>;
  cancelWhisperModelDownload?: () => Promise<{success:boolean;cancelled:boolean}>;
  installWhisperBinary?: (options?: {forceReinstall?:boolean}) => Promise<{success:boolean;reused?:boolean;configured?:boolean;corrupted?:boolean;error?:string}>;
  cancelWhisperBinaryInstall?: () => Promise<{success:boolean;cancelled:boolean}>;
  verifyWhisperRuntime?: () => Promise<{success:boolean;verified:boolean;arch?:string;executable?:string;model?:string;output?:string;error?:string}>;
  onWhisperBinaryProgress?: (callback:(progress:{stage:string;received:number;total:number;percent:number})=>void) => () => void;
  onWhisperModelProgress?: (callback:(progress:{received:number;total:number;percent:number})=>void) => () => void;
  onStateUpdate: (callback: (state: any) => void) => () => void;
  sendStateUpdate: (state: any) => void;
  listLocalAiModels?: (options: { endpoint?: string }) => Promise<{ success: boolean; models: string[]; error?: string }>;
  getManagedAiStatus?: () => Promise<any>;
  listManagedAiModels?: () => Promise<any>;
  installManagedAiBundle?: (options?: { modelId?: string; variantId?: string; forceReinstall?: boolean; skipHealthCheck?: boolean }) => Promise<any>;
  installManagedAiModel?: (modelId: string, options?: { forceReinstall?: boolean }) => Promise<any>;
  pauseManagedAiDownload?: () => Promise<any>;
  resumeManagedAiDownload?: () => Promise<any>;
  cancelManagedAiDownload?: (options?: { discardPartial?: boolean }) => Promise<any>;
  repairManagedAiModel?: (modelId: string) => Promise<any>;
  deleteManagedAiModel?: (modelId: string) => Promise<any>;
  setActiveManagedAiModel?: (modelId: string) => Promise<any>;
  importManagedAiModel?: (filePath?: string) => Promise<any>;
  startManagedAi?: () => Promise<any>;
  stopManagedAi?: () => Promise<any>;
  verifyManagedAiHealth?: () => Promise<any>;
  setManagedAiPerformanceMode?: (mode: 'battery_saver' | 'balanced' | 'performance') => Promise<any>;
  consumeInstallerAiSetup?: () => Promise<any>;
  chatManagedAi?: (options: {
    prompt: string;
    history?: Array<{ role: 'user' | 'assistant'; content: string }>;
    systemPrompt?: string;
    temperature?: number;
    maxTokens?: number;
    stream?: boolean;
    requestId?: string;
  }) => Promise<{ success: boolean; reply?: string; ttftMs?: number; totalMs?: number; tokensPerSec?: number; modelId?: string; cancelled?: boolean; error?: string }>;
  cancelManagedAiChat?: () => Promise<{ success: boolean; cancelled: boolean }>;
  planManagedAiStructured?: (options: {
    prompt: string;
    history?: Array<{ role: 'user' | 'assistant'; content: string }>;
    characterId?: string;
    characterName?: string;
    characterPersonality?: string;
    memoryBlock?: string;
  }) => Promise<{
    success: boolean;
    blocked?: boolean;
    requestType?: 'conversation' | 'action' | 'multi_action' | 'clarification' | 'unsupported' | 'refusal';
    reactionId?: string;
    conversationResponse?: string;
    clarification?: string | null;
    actions?: Array<{ tool: string; params: Record<string, any>; description: string; permission: string }>;
    requiresConfirmation?: boolean;
    modelId?: string;
    ttftMs?: number;
    totalMs?: number;
    tokensPerSec?: number;
    error?: string;
  }>;
  onManagedAiProgress?: (callback: (progress: any) => void) => () => void;
  onManagedAiToken?: (callback: (chunk: { requestId?: string | null; delta: string; full: string }) => void) => () => void;
  discoverLocalAi?: (options: { endpoint?: string }) => Promise<{
    success: boolean; endpoint?: string; models: string[]; checkedEndpoints: number; error?: string;
  }>;
  chatLocalAi?: (options: { endpoint?: string; model: string; prompt: string; history?: Array<{ role: 'user' | 'assistant'; content: string }>; systemPrompt?: string; temperature?: number }) => Promise<{ success: boolean; reply?: string; error?: string }>;
  planLocalActions?: (options: { endpoint?: string; model: string; query: string }) => Promise<{ success: boolean; needsClarification?: boolean; clarification?: string; steps?: Array<{tool: string; params: Record<string, any>; description: string}>; requiresConfirmation?: boolean; error?: string }>;
  getCloudAiStatus?: () => Promise<{ success: boolean; encryptionAvailable: boolean; providers: Record<'openai' | 'gemini' | 'anthropic' | 'groq' | 'openrouter' | 'custom_openai', { configured: boolean; hint: string | null }>; error?: string }>;
  setCloudAiKey?: (provider: 'openai' | 'gemini' | 'anthropic' | 'groq' | 'openrouter' | 'custom_openai', apiKey: string) => Promise<{ success: boolean; configured?: boolean; hint?: string; error?: string }>;
  clearCloudAiKey?: (provider: 'openai' | 'gemini' | 'anthropic' | 'groq' | 'openrouter' | 'custom_openai') => Promise<{ success: boolean; configured?: boolean; error?: string }>;
  testCloudAi?: (options: { provider: 'openai' | 'gemini' | 'anthropic' | 'groq' | 'openrouter' | 'custom_openai'; model?: string; customEndpoint?: string }) => Promise<{ success: boolean; provider?: string; model?: string; latencyMs?: number; reply?: string; error?: string }>;
  chatCloudAi?: (options: { provider: 'openai' | 'gemini' | 'anthropic' | 'groq' | 'openrouter' | 'custom_openai'; model?: string; customEndpoint?: string; prompt: string; history?: Array<{ role: 'user' | 'assistant'; content: string }>; systemPrompt?: string; temperature?: number }) => Promise<{ success: boolean; reply?: string; model?: string; error?: string }>;
  planCloudActions?: (options: { provider: 'openai' | 'gemini' | 'anthropic' | 'groq' | 'openrouter' | 'custom_openai'; model?: string; customEndpoint?: string; query: string }) => Promise<{ success: boolean; needsClarification?: boolean; clarification?: string; steps?: Array<{tool: string; params: Record<string, any>; description: string}>; requiresConfirmation?: boolean; error?: string }>;
  planOfflineSequence?: (options: {query: string}) => Promise<{success: boolean; recognized: boolean; steps?: Array<{tool: string; params: Record<string, any>; description: string}>; requiresConfirmation?: boolean; error?: string}>;
  validateHistoryImport?: (content: string) => Promise<{
    success: boolean;
    error?: string;
    counts?: { conversations: number; automationLogs: number; notes: number };
    backup?: {
      conversations: Array<{id: string; sender: string; content: string; timestamp: number; status: string}>;
      automationLogs: Array<{id: string; timestamp: number; tool: string; params: string; result: string; verified: boolean; durationMs: number}>;
      notes: string[];
    };
  }>;
  loadHistoryStore?: () => Promise<{
    success: boolean;
    exists?: boolean;
    error?: string;
    backup?: {
      conversations: Array<{id: string; sender: string; content: string; timestamp: number; status?: string}>;
      automationLogs: Array<{id: string; timestamp: number; tool: string; params: string; result: string; verified: boolean; durationMs: number}>;
      notes: string[];
    };
  }>;
  mutateHistoryStore?: (operation: {
    kind: 'add-message' | 'add-log' | 'add-note' | 'clear-messages' | 'clear-logs' | 'clear-notes' | 'replace' | 'seed';
    record?: unknown;
    backup?: unknown;
  }) => Promise<{success: boolean; error?: string}>;
  listMemories?: () => Promise<{ success: boolean; exists?: boolean; items: any[]; error?: string }>;
  addMemory?: (input: { content: string; category?: string; pinned?: boolean; expiresAt?: number | null }) => Promise<{ success: boolean; item?: any; items?: any[]; error?: string }>;
  updateMemory?: (id: string, patch: { content?: string; category?: string; pinned?: boolean; enabled?: boolean; expiresAt?: number | null }) => Promise<{ success: boolean; item?: any; items?: any[]; error?: string }>;
  deleteMemory?: (id: string) => Promise<{ success: boolean; removed?: boolean; items?: any[]; error?: string }>;
  clearMemories?: () => Promise<{ success: boolean; items?: any[]; error?: string }>;
  getDesktopDiagnostics?: () => Promise<{
    success: boolean;
    platform?: string;
    architecture?: string;
    appVersion?: string;
    shortcut?: string;
    shortcutRegistered?: boolean;
    history?: { available: boolean; error?: string };
    audio?: { available: boolean; error?: string };
    error?: string;
  }>;
  getModelsStatus?: () => Promise<any[]>;
  downloadModel?: (modelId: string) => Promise<any>;
  cancelModelDownload?: () => Promise<any>;
  onModelDownloadProgress?: (callback: (progress: any) => void) => () => void;
}

type AuraDesktopAPI = CompanioDesktopAPI;

declare global {
  interface Window {
    companioDesktop?: CompanioDesktopAPI;
    auraDesktop?: AuraDesktopAPI;
  }
}

function getDesktopAPI(): CompanioDesktopAPI | undefined {
  if (typeof window === 'undefined') return undefined;
  return window.companioDesktop || window.auraDesktop;
}

export const isNativeDesktop = (): boolean => {
  return typeof window !== 'undefined' && !!getDesktopAPI();
};

export const desktopBridge = {
  async setActivationShortcut(shortcut: string): Promise<{ success: boolean; shortcut?: string; error?: string }> {
    const api = getDesktopAPI();
    return api ? api.setActivationShortcut(shortcut)
      : { success: false, error: 'Global shortcuts require the installed desktop app.' };
  },
  async setOverlayPreferences(options: { alwaysOnTop: boolean; snapToEdge: boolean }) {
    const api = getDesktopAPI();
    return api ? api.setOverlayPreferences(options)
      : { success: false, error: 'Desktop window settings require the installed app.' };
  },
  async notifyOverlayReady(): Promise<boolean> {
    const api = getDesktopAPI();
    return api?.notifyOverlayReady ? await api.notifyOverlayReady() : false;
  },
  async moveCompanion(direction: 'left' | 'right' | 'up' | 'down') {
    const api = getDesktopAPI();
    return api?.moveCompanion
      ? await api.moveCompanion(direction)
      : { success: false, verified: false, error: 'Movement commands require the installed Windows desktop app.' };
  },
  async getStartupStatus(): Promise<{ success: boolean; supported: boolean; enabled: boolean; blockedByWindows?: boolean; verified?: boolean; reason?: string; error?: string }> {
    const api = getDesktopAPI();
    return api?.getStartupStatus
      ? await api.getStartupStatus()
      : { success: true, supported: false, enabled: false, reason: 'Windows startup settings require the installed desktop app.' };
  },
  async setStartupEnabled(enabled: boolean): Promise<{ success: boolean; supported: boolean; enabled: boolean; blockedByWindows?: boolean; verified?: boolean; reason?: string; error?: string }> {
    const api = getDesktopAPI();
    return api?.setStartupEnabled
      ? await api.setStartupEnabled(enabled)
      : { success: false, supported: false, enabled: false, error: 'Windows startup settings require the installed desktop app.' };
  },
  async executeTool(toolName: string, params: Record<string, any> = {}) {
    const api = getDesktopAPI();
    if (api) return await api.executeTool(toolName, params);

    // Web preview may open a browser page, but cannot verify navigation, playback, or native actions.
    const destinations: Record<string, string> = {
      'browser.youtube.open': 'https://www.youtube.com'
    };
    if (toolName === 'browser.open_url') destinations[toolName] = params.url;
    if (toolName === 'browser.search_google') {
      destinations[toolName] = 'https://www.google.com/search?q=' + encodeURIComponent(params.query || '');
    }
    if (toolName === 'browser.youtube.search_and_play') {
      destinations[toolName] = 'https://www.youtube.com/results?search_query='
        + encodeURIComponent((params.creator || '') + ' ' + (params.topic || ''));
    }
    if (destinations[toolName]) {
      try {
        const address = new URL(destinations[toolName]);
        if (!['http:', 'https:'].includes(address.protocol)) throw Error('Invalid URL');
        const opened = window.open(address.href, '_blank', 'noopener,noreferrer');
        return {
          success: false,
          verified: false,
          error: opened ? 'Page opened, but the action cannot be verified in web preview.'
            : 'Browser preview cannot confirm this action (popup may be blocked). Use the desktop app.'
        };
      } catch {
        return { success: false, verified: false, error: 'Invalid website address' };
      }
    }
    return { success: false, verified: false, error: 'Native automation requires the installed Companio desktop app.' };
  },

  async getVolume() {
    const api = getDesktopAPI();
    return api ? api.getVolume() : { success: false, verified: false, error: 'Volume status unavailable in web preview.' };
  },

  async setVolume(percentage: number) {
    const api = getDesktopAPI();
    return api ? api.setVolume(percentage) : { success: false, verified: false, error: 'Volume control requires the desktop app.' };
  },

  async setMute(mute: boolean) {
    const api = getDesktopAPI();
    return api ? api.setMute(mute) : { success: false, verified: false, error: 'Mute control requires the desktop app.' };
  },

  async takeScreenshot() {
    const api = getDesktopAPI();
    return api ? api.takeScreenshot() : { success: false, verified: false, error: 'Screenshot capture requires the desktop app.' };
  },

  async toggleDashboard(show?: boolean) {
    const api = getDesktopAPI();
    if (api) {
      return await api.toggleDashboard(show);
    }
    // Web fallback: navigate query param
    const url = new URL(window.location.href);
    url.searchParams.set('view', show === false ? 'overlay' : 'dashboard');
    window.location.href = url.toString();
    return true;
  },

  async hideOverlay() {
    const api = getDesktopAPI();
    if (api?.hideOverlay) {
      return await api.hideOverlay();
    }
    return false;
  },

  async showOverlay() {
    const api = getDesktopAPI();
    if (api?.showOverlay) {
      return await api.showOverlay();
    }
    return false;
  },

  async showOverlayPassive() {
    const api = getDesktopAPI();
    if (api?.showOverlayPassive) {
      return await api.showOverlayPassive();
    }
    return false;
  },

  async setIgnoreMouseEvents(ignore: boolean) {
    const api = getDesktopAPI();
    if (api?.setIgnoreMouseEvents) {
      return await api.setIgnoreMouseEvents(ignore);
    }
    return false;
  },

  async setOverlayInteractiveRects(rects: Array<{ x: number; y: number; width: number; height: number }>) {
    const api = getDesktopAPI();
    if (api?.setOverlayInteractiveRects) {
      return await api.setOverlayInteractiveRects(rects);
    }
    return false;
  },

  async getOverlayBounds() {
    const api = getDesktopAPI();
    if (api?.getOverlayBounds) {
      return await api.getOverlayBounds();
    }
    return null;
  },

  async startOverlayDrag() {
    const api = getDesktopAPI();
    if (api?.startOverlayDrag) {
      return await api.startOverlayDrag();
    }
    return { success: false };
  },

  async moveOverlayDrag() {
    const api = getDesktopAPI();
    if (api?.moveOverlayDrag) {
      return await api.moveOverlayDrag();
    }
    return { success: false };
  },

  async endOverlayDrag() {
    const api = getDesktopAPI();
    if (api?.endOverlayDrag) {
      return await api.endOverlayDrag();
    }
    return { success: false };
  },

  onShortcut(callback: () => void) {
    const api = getDesktopAPI();
    if (api) {
      return api.onGlobalShortcutTriggered(callback);
    }
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.code === 'Space') {
        e.preventDefault();
        callback();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  },

  onShortcutToggle(callback: () => void) {
    const api = getDesktopAPI();
    if (api?.onGlobalShortcutToggle) {
      return api.onGlobalShortcutToggle(callback);
    }
    return this.onShortcut(callback);
  },

  onShortcutDismiss(callback: () => void) {
    const api = getDesktopAPI();
    if (api?.onGlobalShortcutDismiss) {
      return api.onGlobalShortcutDismiss(callback);
    }
    return () => {};
  },

  async startNativeSpeech(timeoutSec: number = 6, language: string = 'en-IN') {
    const api = getDesktopAPI();
    if (api?.startNativeSpeech) {
      return await api.startNativeSpeech(timeoutSec, language);
    }
    return { success: false, error: 'Native speech only available in desktop Electron mode.' };
  },

  async cancelNativeSpeech() {
    const api = getDesktopAPI();
    if (api?.cancelNativeSpeech) return await api.cancelNativeSpeech();
    return { success: false, error: 'Native speech cancellation requires the desktop app.' };
  },
  async getWhisperStatus() {
    const api = getDesktopAPI();
    return api?.getWhisperStatus ? await api.getWhisperStatus() :
      { supported:false, configured:false, busy:false, executable:null, model:null, message:'Local Whisper requires the Windows desktop app.' };
  },
  async chooseWhisperFile(kind: 'binary' | 'model') {
    const api = getDesktopAPI();
    return api?.chooseWhisperFile ? await api.chooseWhisperFile(kind) :
      {success:false,error:'Local Whisper setup requires the Windows desktop app.'};
  },
  async transcribeWithWhisper(wav:Uint8Array) {
    const api = getDesktopAPI();
    return api?.transcribeWithWhisper ? await api.transcribeWithWhisper(wav) :
      {success:false,error:'Local Whisper requires the Windows desktop app.'};
  },
  async cancelWhisper() {
    const api = getDesktopAPI();
    return api?.cancelWhisper ? await api.cancelWhisper() : {success:false,cancelled:false};
  },
  async installWhisperBinary(options?: {forceReinstall?:boolean}) {
    const api=getDesktopAPI();
    return api?.installWhisperBinary ? await (options?.forceReinstall ? api.installWhisperBinary({forceReinstall:true}) : api.installWhisperBinary()) :
      {success:false,error:'Offline speech engine setup requires the installed Windows desktop app.'};
  },
  async cancelWhisperBinaryInstall() {
    const api=getDesktopAPI();
    return api?.cancelWhisperBinaryInstall ? await api.cancelWhisperBinaryInstall() :
      {success:false,cancelled:false};
  },
  onWhisperBinaryProgress(callback:(progress:{stage:string;received:number;total:number;percent:number})=>void) {
    const api=getDesktopAPI();
    return api?.onWhisperBinaryProgress ? api.onWhisperBinaryProgress(callback) : () => {};
  },
  async downloadWhisperModel(options?: {forceReinstall?:boolean}) {
    const api=getDesktopAPI();
    return api?.downloadWhisperModel ? await (options?.forceReinstall ? api.downloadWhisperModel({forceReinstall:true}) : api.downloadWhisperModel())
      : {success:false,error:'Model download requires the Windows desktop app.'};
  },
  async verifyWhisperRuntime() {
    const api=getDesktopAPI();
    return api?.verifyWhisperRuntime ? await api.verifyWhisperRuntime()
      : {success:false,verified:false,error:'Whisper runtime verification requires the Windows desktop app.'};
  },
  async cancelWhisperModelDownload() {
    const api=getDesktopAPI();
    return api?.cancelWhisperModelDownload ? await api.cancelWhisperModelDownload()
      : {success:false,cancelled:false};
  },
  onWhisperModelProgress(callback:(progress:{received:number;total:number;percent:number})=>void) {
    const api=getDesktopAPI();
    return api?.onWhisperModelProgress ? api.onWhisperModelProgress(callback) : () => {};
  },

  sendStateUpdate(state: any) {
    const api = getDesktopAPI();
    if (api?.sendStateUpdate) {
      api.sendStateUpdate(state);
    }
  },

  onStateUpdate(callback: (state: any) => void) {
    const api = getDesktopAPI();
    if (api?.onStateUpdate) {
      return api.onStateUpdate(callback);
    }
    return () => {};
  },

  async getManagedAiStatus() {
    const api = getDesktopAPI();
    return api?.getManagedAiStatus
      ? api.getManagedAiStatus()
      : { success: false, ready: false, runtimeInstalled: false, anyModelInstalled: false, models: [] };
  },

  async listManagedAiModels() {
    const api = getDesktopAPI();
    return api?.listManagedAiModels
      ? api.listManagedAiModels()
      : { success: false, models: [] };
  },

  async installManagedAiBundle(options?: { modelId?: string; variantId?: string; forceReinstall?: boolean; skipHealthCheck?: boolean }) {
    const api = getDesktopAPI();
    return api?.installManagedAiBundle
      ? api.installManagedAiBundle(options)
      : { success: false, error: 'Installing managed local AI requires the Windows desktop app.' };
  },

  async installManagedAiModel(modelId: string, options?: { forceReinstall?: boolean }) {
    const api = getDesktopAPI();
    return api?.installManagedAiModel
      ? api.installManagedAiModel(modelId, options)
      : { success: false, error: 'Model installation requires the Windows desktop app.' };
  },

  async pauseManagedAiDownload() {
    const api = getDesktopAPI();
    return api?.pauseManagedAiDownload ? api.pauseManagedAiDownload() : { success: false, error: 'Not in desktop mode.' };
  },

  async resumeManagedAiDownload() {
    const api = getDesktopAPI();
    return api?.resumeManagedAiDownload ? api.resumeManagedAiDownload() : { success: false, error: 'Not in desktop mode.' };
  },

  async cancelManagedAiDownload(options?: { discardPartial?: boolean }) {
    const api = getDesktopAPI();
    return api?.cancelManagedAiDownload ? api.cancelManagedAiDownload(options) : { success: false, cancelled: false };
  },

  async repairManagedAiModel(modelId: string) {
    const api = getDesktopAPI();
    return api?.repairManagedAiModel ? api.repairManagedAiModel(modelId) : { success: false, error: 'Repair requires the desktop app.' };
  },

  async deleteManagedAiModel(modelId: string) {
    const api = getDesktopAPI();
    return api?.deleteManagedAiModel ? api.deleteManagedAiModel(modelId) : { success: false, error: 'Requires desktop app.' };
  },

  async setActiveManagedAiModel(modelId: string) {
    const api = getDesktopAPI();
    return api?.setActiveManagedAiModel ? api.setActiveManagedAiModel(modelId) : { success: false, error: 'Requires desktop app.' };
  },

  async importManagedAiModel(filePath?: string) {
    const api = getDesktopAPI();
    return api?.importManagedAiModel ? api.importManagedAiModel(filePath) : { success: false, error: 'Requires desktop app.' };
  },

  async startManagedAi() {
    const api = getDesktopAPI();
    return api?.startManagedAi ? api.startManagedAi() : { success: false, error: 'Requires desktop app.' };
  },

  async stopManagedAi() {
    const api = getDesktopAPI();
    return api?.stopManagedAi ? api.stopManagedAi() : { success: false };
  },

  async verifyManagedAiHealth() {
    const api = getDesktopAPI();
    return api?.verifyManagedAiHealth ? api.verifyManagedAiHealth() : { ok: false, verified: false, error: 'Requires desktop app.' };
  },

  async setManagedAiPerformanceMode(mode: 'battery_saver' | 'balanced' | 'performance') {
    const api = getDesktopAPI();
    return api?.setManagedAiPerformanceMode ? api.setManagedAiPerformanceMode(mode) : { success: false };
  },

  async consumeInstallerAiSetup() {
    const api = getDesktopAPI();
    return api?.consumeInstallerAiSetup ? api.consumeInstallerAiSetup() : null;
  },

  async chatManagedAi(options: {
    prompt: string;
    history?: Array<{ role: 'user' | 'assistant'; content: string }>;
    systemPrompt?: string;
    temperature?: number;
    maxTokens?: number;
    stream?: boolean;
    requestId?: string;
  }): ReturnType<NonNullable<CompanioDesktopAPI['chatManagedAi']>> {
    const api = getDesktopAPI();
    return api?.chatManagedAi
      ? api.chatManagedAi(options)
      : { success: false, error: 'Managed local inference requires the Companio desktop app.' };
  },

  async cancelManagedAiChat() {
    const api = getDesktopAPI();
    return api?.cancelManagedAiChat ? api.cancelManagedAiChat() : { success: false, cancelled: false };
  },

  async planManagedAiStructured(options: {
    prompt: string;
    history?: Array<{ role: 'user' | 'assistant'; content: string }>;
    characterId?: string;
    characterName?: string;
    characterPersonality?: string;
    memoryBlock?: string;
  }): ReturnType<NonNullable<CompanioDesktopAPI['planManagedAiStructured']>> {
    const api = getDesktopAPI();
    return api?.planManagedAiStructured
      ? api.planManagedAiStructured(options)
      : { success: false, error: 'Managed structured planning requires the desktop app.' };
  },

  onManagedAiProgress(callback: (progress: any) => void): () => void {
    const api = getDesktopAPI();
    return api?.onManagedAiProgress ? api.onManagedAiProgress(callback) : () => {};
  },

  onManagedAiToken(callback: (chunk: { requestId?: string | null; delta: string; full: string }) => void): () => void {
    const api = getDesktopAPI();
    return api?.onManagedAiToken ? api.onManagedAiToken(callback) : () => {};
  },

  async listLocalAiModels(endpoint?: string): Promise<{ success: boolean; models: string[]; error?: string }> {
    const api = getDesktopAPI();
    return api?.listLocalAiModels
      ? api.listLocalAiModels({ endpoint })
      : { success: false, models: [], error: 'Local inference requires the Companio desktop app.' };
  },

  async discoverLocalAi(endpoint?: string): Promise<{
    success: boolean; endpoint?: string; models: string[]; checkedEndpoints: number; error?: string;
  }> {
    const api = getDesktopAPI();
    return api?.discoverLocalAi
      ? api.discoverLocalAi({ endpoint })
      : { success: false, models: [], checkedEndpoints: 0, error: 'Model discovery requires the Companio desktop app.' };
  },

  async chatLocalAi(options: { endpoint?: string; model: string; prompt: string; history?: Array<{ role: 'user' | 'assistant'; content: string }>; systemPrompt?: string; temperature?: number }): Promise<{ success: boolean; reply?: string; error?: string }> {
    const api = getDesktopAPI();
    return api?.chatLocalAi
      ? api.chatLocalAi(options)
      : { success: false, error: 'Local inference requires the Companio desktop app.' };
  },

  async planLocalActions(options: { endpoint?: string; model: string; query: string }): Promise<{
    success: boolean;
    needsClarification?: boolean;
    clarification?: string;
    steps?: Array<{ tool: string; params: Record<string, any>; description: string }>;
    requiresConfirmation?: boolean;
    error?: string;
  }> {
    const api = getDesktopAPI();
    return api?.planLocalActions
      ? api.planLocalActions(options)
      : { success: false, steps: [], error: 'AI action planning requires the Companio desktop app.' };
  },

  async getCloudAiStatus(): Promise<{
    success: boolean;
    encryptionAvailable: boolean;
    providers: Record<'openai' | 'gemini' | 'anthropic' | 'groq' | 'openrouter' | 'custom_openai', { configured: boolean; hint: string | null }>;
    error?: string;
  }> {
    const api = getDesktopAPI();
    return api?.getCloudAiStatus
      ? api.getCloudAiStatus()
      : {
        success: false,
        encryptionAvailable: false,
        providers: {
          openai: { configured: false, hint: null },
          gemini: { configured: false, hint: null },
          anthropic: { configured: false, hint: null },
          groq: { configured: false, hint: null },
          openrouter: { configured: false, hint: null },
          custom_openai: { configured: false, hint: null }
        },
        error: 'Encrypted API key storage requires the Windows desktop app.'
      };
  },

  async setCloudAiKey(provider: 'openai' | 'gemini' | 'anthropic' | 'groq' | 'openrouter' | 'custom_openai', apiKey: string): Promise<{ success: boolean; configured?: boolean; hint?: string; error?: string }> {
    const api = getDesktopAPI();
    return api?.setCloudAiKey
      ? api.setCloudAiKey(provider, apiKey)
      : { success: false, error: 'Encrypted API key storage requires the Windows desktop app.' };
  },

  async clearCloudAiKey(provider: 'openai' | 'gemini' | 'anthropic' | 'groq' | 'openrouter' | 'custom_openai'): Promise<{ success: boolean; configured?: boolean; error?: string }> {
    const api = getDesktopAPI();
    return api?.clearCloudAiKey
      ? api.clearCloudAiKey(provider)
      : { success: false, error: 'Encrypted API key storage requires the Windows desktop app.' };
  },

  async testCloudAi(options: { provider: 'openai' | 'gemini' | 'anthropic' | 'groq' | 'openrouter' | 'custom_openai'; model?: string; customEndpoint?: string }): Promise<{
    success: boolean;
    provider?: string;
    model?: string;
    latencyMs?: number;
    reply?: string;
    error?: string;
  }> {
    const api = getDesktopAPI();
    return api?.testCloudAi
      ? api.testCloudAi(options)
      : { success: false, error: 'Cloud diagnostics require the Companio desktop app.' };
  },

  async chatCloudAi(options: { provider: 'openai' | 'gemini' | 'anthropic' | 'groq' | 'openrouter' | 'custom_openai'; model?: string; customEndpoint?: string; prompt: string; history?: Array<{ role: 'user' | 'assistant'; content: string }>; systemPrompt?: string; temperature?: number }): Promise<{ success: boolean; reply?: string; model?: string; error?: string }> {
    const api = getDesktopAPI();
    return api?.chatCloudAi
      ? api.chatCloudAi(options)
      : { success: false, error: 'Cloud AI requires the Companio desktop app.' };
  },

  async planCloudActions(options: { provider: 'openai' | 'gemini' | 'anthropic' | 'groq' | 'openrouter' | 'custom_openai'; model?: string; customEndpoint?: string; query: string }): Promise<{
    success: boolean;
    needsClarification?: boolean;
    clarification?: string;
    steps?: Array<{ tool: string; params: Record<string, any>; description: string }>;
    requiresConfirmation?: boolean;
    error?: string;
  }> {
    const api = getDesktopAPI();
    return api?.planCloudActions
      ? api.planCloudActions(options)
      : { success: false, steps: [], error: 'Cloud AI action planning requires the Companio desktop app.' };
  },

  async planOfflineSequence(options: { query: string }): Promise<{
    success: boolean;
    recognized: boolean;
    steps?: Array<{ tool: string; params: Record<string, any>; description: string }>;
    requiresConfirmation?: boolean;
    error?: string;
  }> {
    const api = getDesktopAPI();
    return api?.planOfflineSequence
      ? api.planOfflineSequence(options)
      : { success: false, recognized: true, steps: [], error: 'Multi-step automation requires the installed Companio desktop app.' };
  },

  async validateHistoryImport(content: string): Promise<{
    success: boolean;
    error?: string;
    counts?: { conversations: number; automationLogs: number; notes: number };
    backup?: {
      conversations: Array<{id: string; sender: string; content: string; timestamp: number; status: string}>;
      automationLogs: Array<{id: string; timestamp: number; tool: string; params: string; result: string; verified: boolean; durationMs: number}>;
      notes: string[];
    };
  }> {
    const api = getDesktopAPI();
    return api?.validateHistoryImport
      ? api.validateHistoryImport(content)
      : { success: false, error: 'Secure backup import requires the installed desktop application.' };
  },

  async loadHistoryStore(): Promise<{
    success: boolean;
    exists?: boolean;
    error?: string;
    backup?: {
      conversations: Array<{id: string; sender: string; content: string; timestamp: number; status?: string}>;
      automationLogs: Array<{id: string; timestamp: number; tool: string; params: string; result: string; verified: boolean; durationMs: number}>;
      notes: string[];
    };
  }> {
    const api = getDesktopAPI();
    return api?.loadHistoryStore
      ? api.loadHistoryStore()
      : { success: false, error: 'Native disk history is unavailable in web preview.' };
  },

  async mutateHistoryStore(operation: {
    kind: 'add-message' | 'add-log' | 'add-note' | 'clear-messages' | 'clear-logs' | 'clear-notes' | 'replace' | 'seed';
    record?: unknown;
    backup?: unknown;
  }): Promise<{ success: boolean; error?: string }> {
    const api = getDesktopAPI();
    return api?.mutateHistoryStore
      ? api.mutateHistoryStore(operation)
      : { success: false, error: 'Native disk history requires the installed desktop app.' };
  },

  async listMemories(): Promise<{ success: boolean; exists?: boolean; items: any[]; error?: string }> {
    const api = getDesktopAPI();
    if (api?.listMemories) return api.listMemories();
    try {
      const raw = typeof localStorage !== 'undefined' ? localStorage.getItem('companio_memory_v1') : null;
      const items = raw ? JSON.parse(raw) : [];
      return { success: true, exists: Array.isArray(items) && items.length > 0, items: Array.isArray(items) ? items : [] };
    } catch {
      return { success: false, items: [], error: 'Could not read saved memory.' };
    }
  },

  async addMemory(input: { content: string; category?: string; pinned?: boolean; expiresAt?: number | null }) {
    const api = getDesktopAPI();
    if (api?.addMemory) return api.addMemory(input);
    const content = typeof input?.content === 'string' ? input.content.replace(/\s+/g, ' ').trim() : '';
    if (content.length < 2 || content.length > 300) {
      return { success: false, error: 'Memory must contain between 2 and 300 characters.' };
    }
    const existing = (await this.listMemories()).items;
    const now = Date.now();
    const item = {
      id: 'mem_' + now + '_' + Math.random().toString(36).slice(2, 7),
      content,
      category: input.category || 'fact',
      pinned: Boolean(input.pinned),
      enabled: true,
      createdAt: now,
      updatedAt: now,
      lastUsedAt: null,
      expiresAt: input.expiresAt ?? null
    };
    const next = [item, ...existing.filter((x: any) => String(x?.content || '').toLowerCase() !== content.toLowerCase())].slice(0, 100);
    try { localStorage.setItem('companio_memory_v1', JSON.stringify(next)); } catch {}
    return { success: true, item, items: next };
  },

  async updateMemory(id: string, patch: { content?: string; category?: string; pinned?: boolean; enabled?: boolean; expiresAt?: number | null }) {
    const api = getDesktopAPI();
    if (api?.updateMemory) return api.updateMemory(id, patch);
    const existing = (await this.listMemories()).items;
    let updatedItem: any = null;
    const next = existing.map((item: any) => {
      if (item.id !== id) return item;
      updatedItem = { ...item, ...patch, updatedAt: Date.now() };
      return updatedItem;
    });
    if (!updatedItem) return { success: false, error: 'Memory entry was not found.' };
    try { localStorage.setItem('companio_memory_v1', JSON.stringify(next)); } catch {}
    return { success: true, item: updatedItem, items: next };
  },

  async deleteMemory(id: string) {
    const api = getDesktopAPI();
    if (api?.deleteMemory) return api.deleteMemory(id);
    const existing = (await this.listMemories()).items;
    const next = existing.filter((item: any) => item.id !== id);
    try { localStorage.setItem('companio_memory_v1', JSON.stringify(next)); } catch {}
    return { success: true, removed: next.length !== existing.length, items: next };
  },

  async clearMemories() {
    const api = getDesktopAPI();
    if (api?.clearMemories) return api.clearMemories();
    try { localStorage.setItem('companio_memory_v1', '[]'); } catch {}
    return { success: true, items: [] };
  },

  async getDesktopDiagnostics(): Promise<{
    success: boolean;
    platform?: string;
    architecture?: string;
    appVersion?: string;
    shortcut?: string;
    shortcutRegistered?: boolean;
    history?: { available: boolean; error?: string };
    audio?: { available: boolean; error?: string };
    error?: string;
  }> {
    const api = getDesktopAPI();
    return api?.getDesktopDiagnostics
      ? api.getDesktopDiagnostics()
      : { success: false, error: 'Device diagnostics require the installed desktop app.' };
  },

  async getModelsStatus(): Promise<any[]> {
    const api = getDesktopAPI();
    if (api?.getModelsStatus) {
      return await api.getModelsStatus();
    }
    return [
      {
        id: 'llama3.2-1b',
        name: 'Llama 3.2 1B Instruct (Recommended)',
        sizeDisplay: '808 MB',
        installed: false,
        fileSize: 0,
        isDownloading: false
      },
      {
        id: 'smollm2-360m',
        name: 'SmolLM2 360M Instruct (Instant Download)',
        sizeDisplay: '229 MB',
        installed: false,
        fileSize: 0,
        isDownloading: false
      },
      {
        id: 'qwen2.5-0.5b',
        name: 'Qwen 2.5 0.5B Instruct (Fast & Sharp)',
        sizeDisplay: '398 MB',
        installed: false,
        fileSize: 0,
        isDownloading: false
      }
    ];
  },

  async downloadModel(modelId: string): Promise<any> {
    const api = getDesktopAPI();
    if (api?.downloadModel) {
      return await api.downloadModel(modelId);
    }
    return { success: false, message: 'Model downloading requires desktop Electron mode.' };
  },

  async cancelModelDownload(): Promise<any> {
    const api = getDesktopAPI();
    if (api?.cancelModelDownload) {
      return await api.cancelModelDownload();
    }
    return { success: false, error: 'Model cancellation requires the desktop app.' };
  },

  onModelDownloadProgress(callback: (progress: any) => void): () => void {
    const api = getDesktopAPI();
    if (api?.onModelDownloadProgress) {
      return api.onModelDownloadProgress(callback);
    }
    return () => {};
  }
};
