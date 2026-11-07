const { contextBridge, ipcRenderer } = require('electron');

const desktopAPI = {
  // Tool execution
  executeTool: (toolName, params) => ipcRenderer.invoke('execute-tool', { toolName, params }),

  // System volume
  getVolume: () => ipcRenderer.invoke('get-volume'),
  setVolume: (level) => ipcRenderer.invoke('set-volume', level),
  setMute: (mute) => ipcRenderer.invoke('set-mute', mute),

  // Screenshot
  takeScreenshot: () => ipcRenderer.invoke('take-screenshot'),

  // Window management
  toggleDashboard: (show) => ipcRenderer.invoke('toggle-dashboard', show),
  hideOverlay: () => ipcRenderer.invoke('hide-overlay'),
  showOverlay: () => ipcRenderer.invoke('show-overlay'),
  setIgnoreMouseEvents: (ignore) => ipcRenderer.invoke('set-ignore-mouse-events', ignore),
  saveOverlayPosition: (x, y) => ipcRenderer.invoke('save-overlay-position', { x, y }),
  getOverlayPosition: () => ipcRenderer.invoke('get-overlay-position'),
  setActivationShortcut: (shortcut) => ipcRenderer.invoke('set-activation-shortcut', shortcut),
  setOverlayPreferences: (options) => ipcRenderer.invoke('set-overlay-preferences', options),
  minimizeWindow: () => ipcRenderer.invoke('minimize-window'),
  quitApp: () => ipcRenderer.invoke('quit-app'),

  // Global hotkey events
  onGlobalShortcutTriggered: (callback) => {
    const handler = () => callback();
    ipcRenderer.on('shortcut-activated', handler);
    return () => ipcRenderer.removeListener('shortcut-activated', handler);
  },
  onGlobalShortcutToggle: (callback) => {
    const handler = () => callback();
    ipcRenderer.on('shortcut-toggle', handler);
    return () => ipcRenderer.removeListener('shortcut-toggle', handler);
  },
  onGlobalShortcutDismiss: (callback) => {
    const handler = () => callback();
    ipcRenderer.on('shortcut-dismiss', handler);
    return () => ipcRenderer.removeListener('shortcut-dismiss', handler);
  },

  // Native Speech
  startNativeSpeech: (timeoutSec = 5) => ipcRenderer.invoke('start-native-speech', { timeoutSec }),
  cancelNativeSpeech: () => ipcRenderer.invoke('cancel-native-speech'),

  // Local inference (loopback-only, validated in Electron main process)
  listLocalAiModels: (options) => ipcRenderer.invoke('local-ai-models', options),
  chatLocalAi: (options) => ipcRenderer.invoke('local-ai-chat', options),
  planLocalActions: (options) => ipcRenderer.invoke('local-ai-plan', options),
  planOfflineSequence: (options) => ipcRenderer.invoke('offline-sequence', options),

  // Local history backup import is validated by the trusted main process.
  validateHistoryImport: (content) => ipcRenderer.invoke('history-validate-import', content),

  // Model Downloader
  getModelsStatus: () => ipcRenderer.invoke('get-models-status'),
  downloadModel: (modelId) => ipcRenderer.invoke('download-model', { modelId }),
  cancelModelDownload: () => ipcRenderer.invoke('cancel-model-download'),
  onModelDownloadProgress: (callback) => {
    const handler = (_, progress) => callback(progress);
    ipcRenderer.on('download-model-progress', handler);
    return () => ipcRenderer.removeListener('download-model-progress', handler);
  },

  // State sync between overlay and dashboard
  onStateUpdate: (callback) => {
    const handler = (_, state) => callback(state);
    ipcRenderer.on('sync-state', handler);
    return () => ipcRenderer.removeListener('sync-state', handler);
  },
  sendStateUpdate: (state) => ipcRenderer.send('sync-state-broadcast', state)
};

contextBridge.exposeInMainWorld('companioDesktop', desktopAPI);
contextBridge.exposeInMainWorld('auraDesktop', desktopAPI);
