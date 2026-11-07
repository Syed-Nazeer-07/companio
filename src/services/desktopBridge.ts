// Safe bridge to native desktop capabilities via Electron IPC or web fallback

interface CompanioDesktopAPI {
  executeTool: (toolName: string, params: Record<string, any>) => Promise<any>;
  getVolume: () => Promise<any>;
  setVolume: (level: number) => Promise<any>;
  setMute: (mute: boolean) => Promise<any>;
  takeScreenshot: () => Promise<any>;
  toggleDashboard: (show?: boolean) => Promise<boolean>;
  setIgnoreMouseEvents: (ignore: boolean) => void;
  saveOverlayPosition: (x: number, y: number) => Promise<boolean>;
  getOverlayPosition: () => Promise<{ x: number; y: number } | null>;
  setActivationShortcut: (shortcut: string) => Promise<{ success: boolean; shortcut?: string; error?: string }>;
  setOverlayPreferences: (options: { alwaysOnTop: boolean; snapToEdge: boolean }) => Promise<{ success: boolean; error?: string }>;
  minimizeWindow: () => Promise<void>;
  quitApp: () => Promise<void>;
  hideOverlay: () => Promise<boolean>;
  showOverlay: () => Promise<boolean>;
  onGlobalShortcutTriggered: (callback: () => void) => () => void;
  onGlobalShortcutToggle?: (callback: () => void) => () => void;
  onGlobalShortcutDismiss?: (callback: () => void) => () => void;
  startNativeSpeech?: (timeoutSec?: number) => Promise<{ success: boolean; text?: string; silence?: boolean; error?: string }>;
  cancelNativeSpeech?: () => Promise<any>;
  onStateUpdate: (callback: (state: any) => void) => () => void;
  sendStateUpdate: (state: any) => void;
  listLocalAiModels?: (options: { endpoint?: string }) => Promise<{ success: boolean; models: string[]; error?: string }>;
  chatLocalAi?: (options: { endpoint?: string; model: string; prompt: string; systemPrompt?: string; temperature?: number }) => Promise<{ success: boolean; reply?: string; error?: string }>;
  planLocalActions?: (options: { endpoint?: string; model: string; query: string }) => Promise<{ success: boolean; steps?: Array<{tool: string; params: Record<string, any>; description: string}>; requiresConfirmation?: boolean; error?: string }>;
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

  async startNativeSpeech(timeoutSec: number = 6) {
    const api = getDesktopAPI();
    if (api?.startNativeSpeech) {
      return await api.startNativeSpeech(timeoutSec);
    }
    return { success: false, error: 'Native speech only available in desktop Electron mode.' };
  },

  async cancelNativeSpeech() {
    const api = getDesktopAPI();
    if (api?.cancelNativeSpeech) {
      return await api.cancelNativeSpeech();
    }
    return { success: false, error: 'Native speech cancellation requires the desktop app.' };
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

  async listLocalAiModels(endpoint?: string): Promise<{ success: boolean; models: string[]; error?: string }> {
    const api = getDesktopAPI();
    return api?.listLocalAiModels
      ? api.listLocalAiModels({ endpoint })
      : { success: false, models: [], error: 'Local inference requires the Companio desktop app.' };
  },

  async chatLocalAi(options: { endpoint?: string; model: string; prompt: string; systemPrompt?: string; temperature?: number }): Promise<{ success: boolean; reply?: string; error?: string }> {
    const api = getDesktopAPI();
    return api?.chatLocalAi
      ? api.chatLocalAi(options)
      : { success: false, error: 'Local inference requires the Companio desktop app.' };
  },

  async planLocalActions(options: { endpoint?: string; model: string; query: string }) {
    const api = getDesktopAPI();
    return api?.planLocalActions
      ? api.planLocalActions(options)
      : { success: false, steps: [], error: 'AI action planning requires the Companio desktop app.' };
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
