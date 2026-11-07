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
