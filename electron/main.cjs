const { app, BrowserWindow, globalShortcut, ipcMain, screen, Tray, Menu, nativeImage, session, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { fileURLToPath } = require('url');
const { validateToolRequest, validateShortcut } = require('./automation/requestValidation.cjs');
const { allowPermissionRequest, allowPermissionCheck, validVolume, validPosition } = require('./automation/securityPolicy.cjs');

const browserController = require('./automation/browserController.cjs');
const { DefaultBrowserController } = require('./automation/defaultBrowserController.cjs');
const { YoutubeFeedController } = require('./automation/youtubeFeedController.cjs');
const winAppsController = require('./automation/winAppsController.cjs');
const volumeController = require('./automation/volumeController.cjs');
const modelDownloader = require('./automation/modelDownloader.cjs');
const nativeSpeech = require('./automation/nativeSpeech.cjs');
const { WhisperSpeechController } = require('./automation/whisperSpeech.cjs');
const { WhisperModelInstaller } = require('./automation/whisperModelInstaller.cjs');
const { WhisperBinaryInstaller } = require('./automation/whisperBinaryInstaller.cjs');
const localAiController = require('./automation/localAiController.cjs');
const localActionPlanner = require('./automation/localActionPlanner.cjs');
const historyBackupController = require('./automation/historyBackupController.cjs');
const { NativeHistoryStore } = require('./automation/nativeHistoryStore.cjs');
const { updateShortcutWithRollback, updateOverlayWithRollback } = require('./automation/settingsTransaction.cjs');
const { writeConfigAtomically } = require('./automation/atomicConfigStore.cjs');
const { createStartupController } = require('./automation/startupController.cjs');
const { planCompanionMove } = require('./automation/companionMovement.cjs');
const { registerSingleInstance } = require('./automation/singleInstance.cjs');
const { createDebouncedWork } = require('./automation/debouncedWork.cjs');
const { createActivationGate } = require('./automation/activationGate.cjs');

let overlayWindow = null;
let dashboardWindow = null;
let tray = null;
let currentShortcut = 'CommandOrControl+Shift+Space';
let overlayPreferences = { alwaysOnTop: true, snapToEdge: true };
const overlayActivation = createActivationGate(() => {
  const win = overlayWindow;
  if (win && !win.isDestroyed()) win.webContents.send('shortcut-activated');
});
const SMOKE_TEST = process.env.COMPANIO_SMOKE_TEST === '1' || process.argv.includes('--companio-smoke');
if (SMOKE_TEST) app.disableHardwareAcceleration();

// Position storage file
const CONFIG_PATH = path.join(app.getPath('userData'), 'companio_window_config.json');
const nativeHistoryStore = new NativeHistoryStore(path.join(app.getPath('userData'), 'companio_history_v1.json'));
browserController.configureProfileDirectory(path.join(app.getPath('userData'), 'controlled_edge_profile'));
const defaultBrowser = new DefaultBrowserController(shell);
const youtubeFeed = new YoutubeFeedController({ browser: defaultBrowser });
const startupController = createStartupController(app, { smokeTest: SMOKE_TEST });
const whisperSpeech = new WhisperSpeechController({
  userData: app.getPath('userData'),
  bundledRoot: app.isPackaged ? path.join(process.resourcesPath, 'bundled-voice', process.arch) : null
});
const whisperModelInstaller = new WhisperModelInstaller({ userData: app.getPath('userData') });
const whisperBinaryInstaller = new WhisperBinaryInstaller({ userData: app.getPath('userData') });

function loadSavedPosition() {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      const data = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
      return data;
    }
  } catch (e) {}
  return null;
}

function saveConfig(patch) {
  try {
    writeConfigAtomically(CONFIG_PATH, { ...(loadSavedPosition() || {}), ...patch });
    return true;
  } catch (err) {
    console.error('[Companio] Failed to persist settings:', err.message);
    return false;
  }
}

function savePosition(x, y) { return saveConfig({ x, y }); }

function isTrustedAppURL(raw) {
  try {
    const url = new URL(raw);
    if (url.protocol === 'file:') {
      return path.normalize(fileURLToPath(url)) === path.normalize(path.join(__dirname, '../dist/index.html'));
    }
    return (process.env.NODE_ENV === 'development' || !!process.env.VITE_DEV_SERVER_URL)
      && url.origin === 'http://localhost:5173' && url.pathname === '/';
  } catch { return false; }
}

function isTrustedSender(event) {
  const win = BrowserWindow.fromWebContents(event.sender);
  return !!win && (win === overlayWindow || win === dashboardWindow)
    && event.senderFrame === event.sender.mainFrame
    && isTrustedAppURL(event.sender.getURL());
}

function secureHandle(channel, callback) {
  ipcMain.handle(channel, (event, ...args) => {
    if (!isTrustedSender(event)) throw new Error('Untrusted IPC sender');
    return callback(event, ...args);
  });
}

function protectWindow(win) {
  win.webContents.on('will-navigate', (event, url) => {
    if (!isTrustedAppURL(url)) event.preventDefault();
  });
  win.webContents.setWindowOpenHandler(({ url }) => {
    try {
      const target = new URL(url);
      if (['http:', 'https:'].includes(target.protocol)) {
        shell.openExternal(target.toString()).catch((err) => console.error('[Companio] External link failed:', err.message));
      }
    } catch {}
    return { action: 'deny' };
  });
}

function wakeCompanionWindow() {
  if (!app.isReady()) return;
  if (!overlayWindow || overlayWindow.isDestroyed()) createOverlayWindow();
  const win = overlayWindow;
  if (!win) return;
  if (!win.isVisible()) win.show();
  win.focus();
  // Document ready is not React ready: queue the wake until the renderer
  // has registered shortcut listeners and hydrated its saved state.
  overlayActivation.activate();
}

function createOverlayWindow() {
  const winWidth = 360;
  const winHeight = 440;
  const saved = loadSavedPosition();
  // Preserve position on a secondary monitor across restarts. If that
  // monitor is disconnected, Electron selects the nearest available one.
  const display = saved && Number.isFinite(saved.x) && Number.isFinite(saved.y)
    ? screen.getDisplayMatching({ x: saved.x, y: saved.y, width: winWidth, height: winHeight })
    : screen.getPrimaryDisplay();
  const { x: workX, y: workY, width, height } = display.workArea;

  // Default to bottom-right
  const defaultX = workX + width - winWidth - 24;
  const defaultY = workY + height - winHeight - 24;

  const posX = (saved && Number.isFinite(saved.x)) ? Math.min(Math.max(workX, saved.x), workX + width - winWidth) : defaultX;
  const posY = (saved && Number.isFinite(saved.y)) ? Math.min(Math.max(workY, saved.y), workY + height - winHeight) : defaultY;

  overlayActivation.reset();
  overlayWindow = new BrowserWindow({
    width: winWidth,
    height: winHeight,
    x: posX,
    y: posY,
    transparent: true,
    frame: false,
    icon: path.join(__dirname, '../build/icon.ico'),
    alwaysOnTop: overlayPreferences.alwaysOnTop,
    skipTaskbar: true,
    resizable: false,
    hasShadow: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      // CI runs headless: do not suspend timers needed by the smoke probe.
      // Normal desktop sessions retain Electron's power-saving defaults.
      backgroundThrottling: !SMOKE_TEST,
    }
  });
  const win = overlayWindow;
  protectWindow(win);

  loadWindowContent(win, 'overlay');

  // Electron can emit many move notifications while dragging. Previously
  // each one performed a synchronous atomic JSON write (and sometimes snapped
  // the window under the pointer). Wait for the movement to settle instead.
  let snapping = false;
  const persistWindowPlacement = () => {
    if (win.isDestroyed()) return;
    const bounds = win.getBounds();
    let { x, y } = bounds;
    if (overlayPreferences.snapToEdge) {
      const area = screen.getDisplayMatching(bounds).workArea;
      const snap = (value, low, high) =>
        Math.abs(value - low) <= 24 ? low : Math.abs(value - high) <= 24 ? high : value;
      x = snap(x, area.x, area.x + area.width - bounds.width);
      y = snap(y, area.y, area.y + area.height - bounds.height);
      if (x !== bounds.x || y !== bounds.y) {
        snapping = true;
        try { win.setPosition(x, y); } finally { snapping = false; }
      }
    }
    savePosition(x, y);
  };
  const placementSaver = createDebouncedWork(persistWindowPlacement, 180);
  win.on('moved', () => {
    if (!snapping) placementSaver.schedule();
  });
  // Flush before destruction so fast quit/restart still remembers placement.
  win.on('close', () => placementSaver.flush());
  win.on('closed', () => {
    placementSaver.cancel();
    if (overlayWindow === win) overlayWindow = null;
  });
}

async function loadWindowContent(win, viewName) {
  const distHtml = path.join(__dirname, '../dist/index.html');
  const devUrl = `http://localhost:5173/?view=${viewName}`;

  if (process.env.VITE_DEV_SERVER_URL || process.env.NODE_ENV === 'development') {
    try {
      await win.loadURL(devUrl);
      return;
    } catch (e) {
      console.log(`[COMPANIO] Dev server at ${devUrl} not available, falling back to local dist bundle.`);
    }
  }

  // Load from built production bundle if available
  if (fs.existsSync(distHtml)) {
    try {
      await win.loadFile(distHtml, { query: { view: viewName } });
      return;
    } catch (err) {
      console.error(`[COMPANIO] Failed to loadFile: ${distHtml}`, err);
    }
  }

  // Final fallback
  try {
    await win.loadURL(devUrl);
  } catch (err) {
    console.error(`[COMPANIO] Could not connect to dev server or local dist:`, err.message);
  }
}

function createDashboardWindow() {
  if (dashboardWindow) {
    dashboardWindow.show();
    dashboardWindow.focus();
    return;
  }

  dashboardWindow = new BrowserWindow({
    width: 1140,
    height: 760,
    minWidth: 920,
    minHeight: 640,
    title: 'Companio — Control Center',
    icon: path.join(__dirname, '../build/icon.ico'),
    backgroundColor: '#f8fafc',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    }
  });
  protectWindow(dashboardWindow);

  loadWindowContent(dashboardWindow, 'dashboard');

  dashboardWindow.on('closed', () => {
    dashboardWindow = null;
  });
}

function setupTray() {
  // Reuse the real packaged brand icon. The old embedded 16px placeholder
  // rendered as a blank/generic icon on some Windows display scales.
  const imagePath = path.join(__dirname, '../build/icon.png');
  const trayIcon = nativeImage.createFromPath(imagePath);
  if (trayIcon.isEmpty()) {
    console.error('[Companio] Tray icon could not be loaded from', imagePath);
    return;
  }
  tray = new Tray(trayIcon.resize({ width: 20, height: 20, quality: 'best' }));
  tray.setToolTip('Companio — Personal AI Companion');

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Wake Companion',
      click: () => wakeCompanionWindow()
    },
    {
      label: 'Open Control Center',
      click: () => createDashboardWindow()
    },
    { type: 'separator' },
    {
      label: 'Mute / Unmute Audio',
      click: async () => {
        const status = await volumeController.getVolume();
        await volumeController.setMute(!status.muted);
      }
    },
    { type: 'separator' },
    {
      label: 'Quit Companio',
      click: () => {
        app.isQuitting = true;
        app.quit();
      }
    }
  ]);

  tray.setContextMenu(contextMenu);
  tray.on('double-click', () => createDashboardWindow());
}

function registerHotkeys(requested = currentShortcut) {
  try {
    const validated = validateShortcut(requested);
    if (!validated.success) return validated;
    const shortcut = validated.shortcut;
    if (globalShortcut.isRegistered(shortcut)) {
      currentShortcut = shortcut;
      return { success: true, shortcut };
    }
    const registered = globalShortcut.register(shortcut, () => {
      console.log('Global activation hotkey triggered!');
      if (!overlayWindow || !overlayActivation.isReady()) {
        wakeCompanionWindow();
        return;
      }
      if (!overlayWindow.isVisible()) overlayWindow.show();
      overlayWindow.focus();
      overlayWindow.setAlwaysOnTop(overlayPreferences.alwaysOnTop,
        overlayPreferences.alwaysOnTop ? 'screen-saver' : 'normal');
      // React decides whether to open the text box or dismiss the companion.
      overlayWindow.webContents.send('shortcut-toggle');
    });

    if (!registered) return { success: false, error: 'Shortcut unavailable: ' + shortcut };
    if (currentShortcut !== shortcut) globalShortcut.unregister(currentShortcut);
    currentShortcut = shortcut;
    console.log('Global hotkey registered: ' + shortcut);
    return { success: true, shortcut };
  } catch (err) {
    console.error('Hotkey registration error:', err);
    return { success: false, error: err.message };
  }
}

// IPC Handlers
secureHandle('execute-tool', async (event, payload) => {
  const validated = validateToolRequest(payload);
  if (!validated.success) return { success: false, verified: false, error: validated.error };
  const { toolName, params } = validated;

  if (toolName === 'win.recyclebin.empty' || toolName === 'win.clipboard.clear') {
    const recycle = toolName === 'win.recyclebin.empty';
    const answer = await dialog.showMessageBox(BrowserWindow.fromWebContents(event.sender), {
      type: 'warning',
      buttons: ['Cancel', recycle ? 'Empty Recycle Bin' : 'Clear Clipboard'],
      defaultId: 0,
      cancelId: 0,
      message: recycle ? 'Permanently delete everything in the Recycle Bin?' : 'Erase the current Windows clipboard contents?',
      title: recycle ? 'Confirm permanent deletion' : 'Confirm clipboard reset'
    });
    if (answer.response !== 1) return { success: false, verified: false, error: 'Action cancelled.' };
  }

  switch (toolName) {
    // Browser tools
    case 'browser.youtube.open':
      return await defaultBrowser.open('https://www.youtube.com', 'YouTube');
    case 'browser.youtube.search_and_play':
      return await browserController.searchAndPlayYouTube(params.creator, params.topic, params.latest === true);
    case 'browser.youtube.latest_known':
      return await youtubeFeed.openLatest('CarryMinati');
    case 'browser.youtube.control':
      return await browserController.controlYouTube(params.action);
    case 'browser.open_url':
      return await defaultBrowser.open(params.url);
    case 'browser.search_google':
      return await defaultBrowser.searchGoogle(params.query);
    case 'browser.open_tabs':
      return await browserController.openTabs(params.urls);
    case 'browser.close_tab':
      return await browserController.closeCurrentTab();
    case 'browser.wikipedia.search':
      return await defaultBrowser.searchWikipedia(params.query);
    case 'browser.amazon.search':
      return await defaultBrowser.searchAmazon(params.query);
    case 'browser.maps.search':
      return await defaultBrowser.searchMaps(params.query || params.location);

    // Direct Web Apps
    case 'browser.chatgpt.open':
      return await defaultBrowser.open('https://chatgpt.com', 'ChatGPT');
    case 'browser.claude.open':
      return await defaultBrowser.open('https://claude.ai', 'Claude');
    case 'browser.gemini.open':
      return await defaultBrowser.open('https://gemini.google.com', 'Gemini');
    case 'browser.deepseek.open':
      return await defaultBrowser.open('https://chat.deepseek.com', 'DeepSeek');
    case 'browser.github.open':
      return await defaultBrowser.open('https://github.com', 'GitHub');
    case 'browser.gmail.open':
      return await defaultBrowser.open('https://mail.google.com', 'Gmail');
    case 'browser.whatsapp.open':
      return await defaultBrowser.open('https://web.whatsapp.com', 'WhatsApp Web');
    case 'browser.reddit.open':
      return await defaultBrowser.open('https://reddit.com', 'Reddit');
    case 'browser.x.open':
      return await defaultBrowser.open('https://x.com', 'X');
    case 'browser.netflix.open':
      return await defaultBrowser.open('https://netflix.com', 'Netflix');
    case 'browser.twitch.open':
      return await defaultBrowser.open('https://www.twitch.tv', 'Twitch');
    case 'browser.linkedin.open':
      return await defaultBrowser.open('https://www.linkedin.com', 'LinkedIn');
    case 'browser.translate.open':
      return await defaultBrowser.open('https://translate.google.com', 'Google Translate');

    // Windows App tools
    case 'win.calculator.launch':
      return await winAppsController.launchCalculator();
    case 'win.calculator.close':
      return await winAppsController.closeCalculator();
    case 'win.explorer.open':
      return await winAppsController.openFileExplorer(params.folder);
    case 'win.vscode.launch':
      return await winAppsController.launchVSCode(params.path);
    case 'win.notepad.launch':
      return await winAppsController.launchNotepad();
    case 'win.paint.launch':
      return await winAppsController.launchPaint();
    case 'win.taskmgr.launch':
      return await winAppsController.launchTaskManager();
    case 'win.snipping.launch':
      return await winAppsController.launchSnippingTool();
    case 'win.terminal.launch':
      return await winAppsController.launchTerminal();
    case 'win.cmd.launch':
      return await winAppsController.launchCmd();
    case 'win.powershell.launch':
      return await winAppsController.launchPowerShell();
    case 'win.camera.launch':
      return await winAppsController.launchCamera();
    case 'win.clock.launch':
      return await winAppsController.launchClock();
    case 'win.weather.launch':
      return await winAppsController.launchWeather();
    case 'win.edge.launch':
      return await winAppsController.launchEdge();
    case 'win.chrome.launch':
      return await winAppsController.launchChrome();
    case 'win.discord.launch':
      return await winAppsController.launchDiscord();
    case 'win.steam.launch':
      return await winAppsController.launchSteam();
    case 'win.recyclebin.empty':
      return await winAppsController.emptyRecycleBin();
    case 'win.desktop.show':
      return await winAppsController.showDesktop();
    case 'win.battery.get':
      return await winAppsController.getBatteryStatus();
    case 'win.system.specs':
      return await winAppsController.getSystemSpecs();
    case 'win.settings.category':
      return await winAppsController.openSettingsCategory(params.category);
    case 'win.settings.open':
      return await winAppsController.openSettings();
    case 'win.system.lock':
      return await winAppsController.lockWorkstation();
    case 'win.spotify.launch':
      return await winAppsController.launchSpotify();
    case 'win.media.control':
      return await winAppsController.controlMedia(params.action);
    case 'win.spotify.play_track':
      return await winAppsController.playSpotifyTrack(params.query);
    case 'win.window.minimize':
      return await winAppsController.minimizeActiveWindow();
    case 'win.screenshot':
      return await winAppsController.takeScreenshot();

    // Volume tools
    case 'win.volume.set':
      return await volumeController.setVolume(params.level);
    case 'win.volume.change':
      return await volumeController.changeVolume(params.delta);
    case 'win.volume.get':
      return await volumeController.getVolume();
    case 'win.volume.mute':
      return await volumeController.setMute(params.mute);

    // Brightness tools
    case 'win.brightness.set':
      return await winAppsController.setBrightness(params.level);
    case 'win.brightness.change':
      return await winAppsController.changeBrightness(params.delta);

    // Clipboard tools
    case 'win.clipboard.read':
      return await winAppsController.getClipboardText();
    case 'win.clipboard.clear':
      return await winAppsController.clearClipboard();

    // Network tools
    case 'win.network.ip':
      return await winAppsController.getNetworkIp();

    default:
      return { success: false, error: `Unknown tool: ${toolName}`, verified: false };
  }
});

// Settings are applied by the native window manager, not only by React state.
secureHandle('set-activation-shortcut', async (_, value) => {
  const validation = validateShortcut(value);
  if (!validation.success) return validation;
  return updateShortcutWithRollback(
    validation.shortcut,
    currentShortcut,
    registerHotkeys,
    shortcut => saveConfig({ activationShortcut: shortcut })
  );
});
secureHandle('set-overlay-preferences', async (_, options) => {
  if (!options || typeof options.alwaysOnTop !== 'boolean' || typeof options.snapToEdge !== 'boolean') {
    return { success: false, verified: false, error: 'Invalid overlay preferences' };
  }
  const requested = { alwaysOnTop: options.alwaysOnTop, snapToEdge: options.snapToEdge };
  return updateOverlayWithRollback(
    requested,
    { ...overlayPreferences },
    preferences => saveConfig(preferences),
    preferences => {
      if (overlayWindow) overlayWindow.setAlwaysOnTop(preferences.alwaysOnTop);
      overlayPreferences = { ...preferences };
    }
  );
});

// Startup registration is an explicit opt-in and only available after
// installation. IPC is restricted to the trusted Companio windows.
secureHandle('get-startup-status', () => startupController.read());
secureHandle('set-startup-enabled', (_event, enabled) => startupController.setEnabled(enabled));

// Local inference uses the Node main process to avoid file:// CORS issues.
// All requests are validated by localAiController and restricted to loopback.
secureHandle('local-ai-models', async (_, options) => localAiController.listModels(options));
secureHandle('local-ai-discover', async (_, options) => localAiController.discoverLocalAi(options));
secureHandle('local-ai-chat', async (_, options) => localAiController.chat(options));
secureHandle('local-ai-plan', async (_, options) => localActionPlanner.proposeActions(options));
secureHandle('offline-sequence', async (_, options) => localActionPlanner.planOfflineSequence(options));
secureHandle('history-validate-import', async (_, content) => historyBackupController.validateHistoryBackup(content));
secureHandle('history-store-load', async () => nativeHistoryStore.load());
secureHandle('desktop-diagnostics', async () => {
  // Read-only diagnostics: no microphone capture, no filesystem paths, no keys.
  const history = nativeHistoryStore.load();
  const audio = await volumeController.getVolume();
  return {
    success: true,
    platform: process.platform,
    architecture: process.arch,
    appVersion: app.getVersion(),
    shortcut: currentShortcut,
    shortcutRegistered: globalShortcut.isRegistered(currentShortcut),
    history: {
      available: history.success && history.exists === true,
      error: history.success ? (history.exists ? undefined : 'No history snapshot exists yet.') : history.error
    },
    audio: {
      available: audio.success === true && audio.verified === true,
      error: audio.success && audio.verified ? undefined : (audio.error || 'System audio could not be read.')
    }
  };
});
secureHandle('history-store-mutate', async (_, operation) => nativeHistoryStore.mutate(operation));

// Model Downloader IPC handlers
secureHandle('get-models-status', async () => {
  try {
    return modelDownloader.listModels();
  } catch (err) {
    return [];
  }
});

secureHandle('download-model', async (event, { modelId }) => {
  try {
    return await modelDownloader.downloadModel(modelId, (progress) => {
      try {
        event.sender.send('download-model-progress', progress);
      } catch (e) {}
    });
  } catch (err) {
    return { success: false, error: err.message };
  }
});

secureHandle('cancel-model-download', async () => {
  return modelDownloader.cancelDownload();
});

secureHandle('get-volume', async () => await volumeController.getVolume());
secureHandle('set-volume', async (_, level) => validVolume(level)
  ? volumeController.setVolume(level)
  : { success: false, verified: false, error: 'Volume must be a number between 0 and 100.' });
secureHandle('set-mute', async (_, mute) => typeof mute === 'boolean'
  ? volumeController.setMute(mute)
  : { success: false, verified: false, error: 'Mute must be true or false.' });
secureHandle('take-screenshot', async () => await winAppsController.takeScreenshot());

secureHandle('toggle-dashboard', async (_, show) => {
  // The packaged smoke test intentionally verifies only the overlay.
  // Avoid launching first-run setup in a second window during its shortcut probe.
  if (SMOKE_TEST) return false;
  if (show === false) {
    if (dashboardWindow) dashboardWindow.hide();
  } else {
    createDashboardWindow();
  }
  return true;
});

secureHandle('save-overlay-position', async (event, position) => {
  if (event.sender !== overlayWindow?.webContents || !validPosition(position)) return false;
  return savePosition(position.x, position.y);
});

secureHandle('get-overlay-position', async () => {
  return loadSavedPosition();
});

secureHandle('move-companion', (event, direction) => {
  // Only Companio's own overlay can move. A spoken command cannot specify
  // pixels, coordinates, target windows or shell commands.
  if (event.sender !== overlayWindow?.webContents) {
    return { success: false, verified: false, error: 'Only the companion overlay can move.' };
  }
  try {
    const before = overlayWindow.getBounds();
    const area = screen.getDisplayMatching(before).workArea;
    const next = planCompanionMove(before, area, direction);
    if (!next) return { success: false, verified: false, error: 'Invalid movement direction.' };
    if (!next.moved) {
      return { success: true, verified: true, moved: false, message: 'Already at the edge of this screen.' };
    }
    overlayWindow.setPosition(next.x, next.y);
    const actual = overlayWindow.getBounds();
    const verified = actual.x === next.x && actual.y === next.y;
    if (verified) savePosition(actual.x, actual.y);
    return verified
      ? { success: true, verified: true, moved: true, message: 'Moved Companio ' + direction + '.' }
      : { success: false, verified: false, moved: false, error: 'Windows did not confirm the new companion position.' };
  } catch (error) {
    return { success: false, verified: false, error: error?.message || 'Could not move companion.' };
  }
});

secureHandle('set-ignore-mouse-events', (event, ignore) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win !== overlayWindow || typeof ignore !== 'boolean') return false;
  win.setIgnoreMouseEvents(ignore, { forward: true });
  return true;
});

secureHandle('quit-app', () => {
  app.isQuitting = true;
  app.quit();
});

// State synchronization between overlay and dashboard windows
ipcMain.on('sync-state-broadcast', (event, state) => {
  if (!isTrustedSender(event) || !state || typeof state !== 'object' || Array.isArray(state)) return;
  if (JSON.stringify(state).length > 65536) return;
  if (overlayWindow && event.sender !== overlayWindow.webContents) {
    overlayWindow.webContents.send('sync-state', state);
  }
  if (dashboardWindow && event.sender !== dashboardWindow.webContents) {
    dashboardWindow.webContents.send('sync-state', state);
  }
});

secureHandle('hide-overlay', () => {
  if (overlayWindow) overlayWindow.hide();
  return true;
});

secureHandle('start-native-speech', async (_, { timeoutSec = 5, language = 'en-IN' } = {}) => {
  try {
    return await nativeSpeech.recognizeOnce(timeoutSec, language);
  } catch (e) {
    return { success: false, error: e.message };
  }
});

secureHandle('cancel-native-speech', () => {
  nativeSpeech.cancel();
  whisperSpeech.cancel();
  return { success: true };
});

// Whisper.cpp is optional, offline and user-selected; no executable path is
// accepted from an untrusted renderer transcription request.
secureHandle('whisper-status', () => ({
  ...whisperSpeech.status(),
  download: whisperModelInstaller.status(),
  binaryDownload: whisperBinaryInstaller.status()
}));
secureHandle('whisper-install-binary', async event => {
  // The verified release URL and archive checksum live exclusively in the
  // privileged process. Renderer code never supplies executable URLs or paths.
  const result = await whisperBinaryInstaller.install(progress => {
    if (!event.sender.isDestroyed()) event.sender.send('whisper-binary-progress', progress);
  });
  if (!result.success) return result;
  const configured = whisperSpeech.choose('binary', result.filePath);
  return configured.success
    ? {success:true,reused:result.reused,...whisperSpeech.status()}
    : {success:false,error:configured.error || 'Downloaded speech engine could not be activated.'};
});
secureHandle('whisper-cancel-binary-install', () => whisperBinaryInstaller.cancel());
secureHandle('whisper-download-model', async (event) => {
  const result = await whisperModelInstaller.install(progress => {
    if (!event.sender.isDestroyed()) event.sender.send('whisper-model-progress', progress);
  });
  if (!result.success) return result;
  const configured = whisperSpeech.choose('model', result.filePath);
  if (!configured.success) return {success:false,error:configured.error || 'Could not activate downloaded Whisper model.'};
  return {success:true,reused:result.reused,...whisperSpeech.status()};
});
secureHandle('whisper-cancel-download', () => whisperModelInstaller.cancel());
secureHandle('whisper-choose-file', async (event, kind) => {
  if (!['binary', 'model'].includes(kind)) return { success: false, error: 'Unknown file selection.' };
  const win = BrowserWindow.fromWebContents(event.sender);
  const result = await dialog.showOpenDialog(win, {
    title: kind === 'binary' ? 'Choose whisper-cli.exe (official whisper.cpp build)' : 'Choose a ggml Whisper speech model',
    properties: ['openFile'],
    filters: kind === 'binary'
      ? [{ name: 'whisper.cpp CLI', extensions: ['exe'] }]
      : [{ name: 'Whisper GGML model', extensions: ['bin'] }]
  });
  if (result.canceled || !result.filePaths?.length) return { success: false, cancelled: true };
  return whisperSpeech.choose(kind, result.filePaths[0]);
});
secureHandle('whisper-transcribe', (_event, wav) => whisperSpeech.transcribe(wav, 'en'));
secureHandle('whisper-cancel', () => whisperSpeech.cancel());

secureHandle('overlay-ready', (event) => {
  if (event.sender !== overlayWindow?.webContents) return false;
  overlayActivation.markReady();
  return true;
});

secureHandle('show-overlay', () => {
  if (overlayWindow) {
    overlayWindow.show();
    overlayWindow.focus();
  }
  return true;
});

// A second Windows shortcut/installer invocation reopens the existing
// companion instead of creating another tray, profile lock or history writer.
const primaryInstance = registerSingleInstance(app, () => {
  if (!SMOKE_TEST) wakeCompanionWindow();
});
app.commandLine.appendSwitch('enable-speech-dispatcher');

app.whenReady().then(async () => {
  if (!primaryInstance) return;
  if (process.platform === 'win32') app.setAppUserModelId('com.companio.desktop');
  // Never grant camera, accessibility, Bluetooth or USB permissions automatically.
  if (session && session.defaultSession) {
    const trusted = (wc) => {
      const win = BrowserWindow.fromWebContents(wc);
      return !!win && (win === overlayWindow || win === dashboardWindow) && isTrustedAppURL(wc.getURL());
    };
    session.defaultSession.setPermissionRequestHandler((wc, permission, callback, details) => {
      const sameTrustedDocument = trusted(wc) && !!details?.requestingUrl && isTrustedAppURL(details.requestingUrl);
      callback(allowPermissionRequest(permission, details, sameTrustedDocument));
    });
    session.defaultSession.setPermissionCheckHandler((wc, permission, requestingOrigin, details) => {
      const sameTrustedDocument = trusted(wc) && !!details?.requestingUrl && isTrustedAppURL(details.requestingUrl);
      return allowPermissionCheck(permission, details, sameTrustedDocument);
    });
  }

  const saved = loadSavedPosition() || {};
  const shortcut = validateShortcut(saved.activationShortcut);
  if (shortcut.success) currentShortcut = shortcut.shortcut;
  if (typeof saved.alwaysOnTop === 'boolean') overlayPreferences.alwaysOnTop = saved.alwaysOnTop;
  if (typeof saved.snapToEdge === 'boolean') overlayPreferences.snapToEdge = saved.snapToEdge;
  if (SMOKE_TEST) {
    console.log('COMPANIO_SMOKE_START: loading packaged Windows app');
    const smokeReport = (details) => {
      // Console output is retained when the main process stalls before the next
      // JSON-file polling interval, so the last completed stage remains visible.
      console.log('COMPANIO_SMOKE_STAGE:', details.stage || (details.ok === true ? 'passed' : details.ok === false ? 'failed' : 'unknown'));
      try {
        if (process.env.COMPANIO_SMOKE_RESULT_PATH) {
          fs.writeFileSync(process.env.COMPANIO_SMOKE_RESULT_PATH, JSON.stringify(details));
        }
      } catch (error) {
        console.error('Smoke result file unavailable:', error.message);
      }
    };
    smokeReport({ stage: 'app-ready' });
    const timer = setTimeout(() => {
      smokeReport({ ok: false, stage: 'timed-out', error: 'UI verification did not finish within 30 seconds.' });
      console.error('COMPANIO_SMOKE_FAIL: App did not load within 30 seconds.');
      app.exit(1);
    }, 30000);
    try {
      createOverlayWindow();
      const win = overlayWindow;
      if (!win) throw new Error('Overlay window not constructed');
      smokeReport({ stage: 'overlay-created' });
      await new Promise((resolve, reject) => {
        win.webContents.once('did-finish-load', resolve);
        win.webContents.once('did-fail-load', (_event, code, message) => reject(new Error(`Load failed ${code}: ${message}`)));
      });
      smokeReport({ stage: 'document-loaded' });
      const details = await win.webContents.executeJavaScript(
        "({ rendered: !!document.querySelector('#root > *'), bridge: typeof window.companioDesktop?.executeTool === 'function' })"
      );
      if (!details.rendered || !details.bridge) throw new Error('React UI or native preload bridge was not available');
      smokeReport({ stage: 'react-and-preload-verified' });
      const negative = await win.webContents.executeJavaScript(
        "window.companioDesktop.executeTool('win.volume.set', { level: 'invalid' })"
      );
      if (negative.success !== false || negative.verified !== false) {
        throw new Error('Native tool validation did not reject the malformed request');
      }
      smokeReport({ stage: 'negative-ipc-verified' });
      // The app now hydrates native history before mounting the overlay.
      // Wait for the actual overlay React subtree, not the loading placeholder,
      // or early shortcut events would be lost before its listener attaches.
      const overlayReady = await Promise.race([
        win.webContents.executeJavaScript(
          "new Promise(resolve => { let attempts = 0; const check = () => { if (document.querySelector('[data-companio-ready=\"true\"]')) return resolve(true); if (++attempts >= 100) return resolve(false); setTimeout(check, 100); }; check(); })"
        ),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Overlay failed to hydrate history within 12 seconds')), 12000))
      ]);
      if (!overlayReady) throw new Error('The companion overlay did not finish its storage initialization');
      const dragHandleVisible = await win.webContents.executeJavaScript(
        "(() => { const el = document.querySelector('[aria-label=\"Drag to move Companio around your desktop\"]'); if (!el) return false; const rect = el.getBoundingClientRect(); const style = getComputedStyle(el); return rect.width >= 100 && rect.height >= 24 && style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity) > 0.95; })()"
      );
      if (!dragHandleVisible) throw new Error('The draggable Companio handle must be visible without hovering');
      smokeReport({ stage: 'drag-handle-visible' });
      smokeReport({ stage: 'history-hydrated' });
      // On headless Windows runners, the main-process timer occasionally stops
      // progressing after IPC. Dispatch immediately and let the renderer itself
      // wait for React to show the shortcut input.
      smokeReport({ stage: 'before-shortcut' });
      win.webContents.send('shortcut-toggle');
      smokeReport({ stage: 'shortcut-sent' });
      smokeReport({ stage: 'checking-shortcut-input' });
      const awakened = await Promise.race([
        win.webContents.executeJavaScript(
          "new Promise(resolve => { let attempts = 0; const check = () => { if (document.querySelector('input[placeholder=\"Ask Companio...\"]')) return resolve(true); if (++attempts >= 40) return resolve(false); setTimeout(check, 100); }; check(); })"
        ),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Renderer did not answer shortcut input check within 10 seconds')), 10000))
      ]);
      if (!awakened) throw new Error('Global shortcut did not open the companion text input');
      smokeReport({ stage: 'shortcut-input-visible' });

      // Exercise the actual packaged preload -> trusted IPC -> pure planner
      // path without executing any Windows actions.
      const safePlan = await win.webContents.executeJavaScript(
        "window.companioDesktop.planOfflineSequence({query:'Open Notepad and set volume to 45%'})"
      );
      if (!safePlan?.success || safePlan.requiresConfirmation !== true ||
          safePlan.steps?.length !== 2 || safePlan.steps[1].params.level !== 45) {
        throw new Error('Offline compound planning was not available through packaged IPC');
      }
      const unsafePlan = await win.webContents.executeJavaScript(
        "window.companioDesktop.planOfflineSequence({query:'Open Notepad and delete all files'})"
      );
      if (unsafePlan?.success !== false || unsafePlan?.recognized !== true) {
        throw new Error('Offline planning incorrectly accepted a destructive request');
      }
      smokeReport({ stage: 'offline-planner-verified' });

      // Verify the installed preload can actually load the validated on-disk
      // history created by startup migration. Never change the user's history
      // from this smoke probe.
      const diskHistory = await win.webContents.executeJavaScript(
        "window.companioDesktop.loadHistoryStore()"
      );
      if (!diskHistory?.success || !diskHistory.exists ||
          !Array.isArray(diskHistory.backup?.conversations) ||
          !Array.isArray(diskHistory.backup?.automationLogs)) {
        throw new Error('Native history file was not created or available through packaged IPC');
      }
      const rejectedImport = await win.webContents.executeJavaScript(
        "window.companioDesktop.validateHistoryImport(JSON.stringify({format:'companio-local-history',schemaVersion:1,exportedAt:new Date().toISOString(),conversations:[],automationLogs:[],notes:[],settings:{ai:{apiKey:'secret'}}}))"
      );
      if (rejectedImport?.success !== false) {
        throw new Error('History import validator did not reject a settings/API-key injection');
      }
      smokeReport({ stage: 'native-history-verified' });

      // Verify startup IPC is wired without changing the runner's Windows
      // login preferences. Malformed requests must always fail closed.
      const startupState = await win.webContents.executeJavaScript(
        "window.companioDesktop.getStartupStatus()"
      );
      if (!startupState?.success || startupState.supported !== false || startupState.enabled !== false) {
        throw new Error('Smoke test incorrectly exposed Windows login startup controls.');
      }
      const startupRejected = await win.webContents.executeJavaScript(
        "window.companioDesktop.setStartupEnabled('yes')"
      );
      if (startupRejected?.success !== false) {
        throw new Error('Startup IPC accepted a non-boolean state.');
      }
      smokeReport({ stage: 'startup-ipc-verified' });

      // The optional offline speech bridge must be available without
      // downloading a model, recording audio or launching an executable.
      const whisperState = await win.webContents.executeJavaScript(
        "window.companioDesktop.getWhisperStatus()"
      );
      if (!whisperState?.supported || typeof whisperState.configured !== 'boolean' ||
          !whisperState.download || whisperState.download.downloading !== false) {
        throw new Error('Packaged Whisper setup status IPC is unavailable.');
      }
      const invalidWhisper = await win.webContents.executeJavaScript(
        "window.companioDesktop.transcribeWithWhisper(new Uint8Array([1, 2, 3]))"
      );
      if (invalidWhisper?.success !== false) {
        throw new Error('Unconfigured or malformed Whisper IPC accepted invalid audio.');
      }
      smokeReport({ stage: 'offline-speech-ipc-verified' });

      const deviceCheck = await win.webContents.executeJavaScript(
        "window.companioDesktop.getDesktopDiagnostics()"
      );
      if (!deviceCheck?.success || deviceCheck.platform !== 'win32' ||
          deviceCheck.architecture !== process.arch ||
          deviceCheck.history?.available !== true ||
          typeof deviceCheck.shortcutRegistered !== 'boolean' ||
          typeof deviceCheck.audio?.available !== 'boolean') {
        throw new Error('Read-only Windows diagnostics were not available through the packaged IPC bridge.');
      }
      // CI need not have an audio device or an interactive registered shortcut:
      // diagnostics report actual capabilities rather than inventing success.
      smokeReport({ stage: 'device-diagnostics-verified' });

      // End-to-end safety: send a harmless *proposal*, inspect the UI, and
      // cancel. No Windows action is approved or executed in the CI runner.
      const approvalFound = await win.webContents.executeJavaScript(
        `(async () => {
          const input = document.querySelector('input[placeholder="Ask Companio..."]');
          if (!input) return false;
          const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
          setter.call(input, 'Open Notepad and set volume to 45%');
          input.dispatchEvent(new Event('input', { bubbles: true }));
          await new Promise(resolve => setTimeout(resolve, 80));
          input.closest('form')?.requestSubmit();
          for (let attempts = 0; attempts < 70; attempts++) {
            const dialog = document.querySelector('[role="dialog"][aria-labelledby="companio-approval-title"]');
            if (dialog) return dialog.textContent.includes('win.notepad.launch')
              && dialog.textContent.includes('win.volume.set');
            await new Promise(resolve => setTimeout(resolve, 100));
          }
          return false;
        })()`
      );
      if (!approvalFound) throw new Error('The safe two-step action review dialog did not appear');
      smokeReport({ stage: 'approval-dialog-visible' });
      const cancelledDialog = await win.webContents.executeJavaScript(
        `(() => {
          const dialog = document.querySelector('[role="dialog"][aria-labelledby="companio-approval-title"]');
          const cancelButton = [...dialog.querySelectorAll('button')].find(button => button.textContent.trim() === 'Cancel');
          if (!cancelButton) return false;
          cancelButton.click();
          return true;
        })()`
      );
      if (!cancelledDialog) throw new Error('The approval dialog did not offer a working Cancel action');
      const historyAfterCancel = await win.webContents.executeJavaScript(
        "window.companioDesktop.loadHistoryStore()"
      );
      if (!historyAfterCancel?.success ||
          historyAfterCancel.backup?.automationLogs?.some(log =>
            ['win.notepad.launch','win.volume.set'].includes(log.tool))) {
        throw new Error('A native action executed even though the user cancelled the approval.');
      }
      smokeReport({ stage: 'approval-cancelled-safely' });
      clearTimeout(timer);
      smokeReport({ ok: true, rendered: details.rendered, bridge: details.bridge, inputVisible: awakened });
      console.log('COMPANIO_SMOKE_OK: React, Electron preload, hotkey UI and negative IPC verified');
      app.exit(0);
    } catch (err) {
      clearTimeout(timer);
      console.error('COMPANIO_SMOKE_FAIL:', err);
      smokeReport({ ok: false, error: String(err && err.message ? err.message : err) });
      app.exit(1);
    }
    return;
  }

  createOverlayWindow();
  setupTray();
  registerHotkeys();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createOverlayWindow();
    }
  });
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

app.on('window-all-closed', () => {
  // Keep app active in system tray unless explicitly quitting
  if (process.platform !== 'darwin' && app.isQuitting) {
    app.quit();
  }
});
