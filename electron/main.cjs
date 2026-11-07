const { app, BrowserWindow, globalShortcut, ipcMain, screen, Tray, Menu, nativeImage, session, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { fileURLToPath } = require('url');
const { validateToolRequest, validateShortcut } = require('./automation/requestValidation.cjs');
const { allowPermissionRequest, allowPermissionCheck, validVolume, validPosition } = require('./automation/securityPolicy.cjs');

const browserController = require('./automation/browserController.cjs');
const winAppsController = require('./automation/winAppsController.cjs');
const volumeController = require('./automation/volumeController.cjs');
const modelDownloader = require('./automation/modelDownloader.cjs');
const nativeSpeech = require('./automation/nativeSpeech.cjs');

let overlayWindow = null;
let dashboardWindow = null;
let tray = null;
let currentShortcut = 'CommandOrControl+Shift+Space';
let overlayPreferences = { alwaysOnTop: true, snapToEdge: true };
const SMOKE_TEST = process.env.COMPANIO_SMOKE_TEST === '1' || process.argv.includes('--companio-smoke');
if (SMOKE_TEST) app.disableHardwareAcceleration();

// Position storage file
const CONFIG_PATH = path.join(app.getPath('userData'), 'companio_window_config.json');

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
    fs.mkdirSync(path.dirname(CONFIG_PATH), { recursive: true });
    fs.writeFileSync(CONFIG_PATH, JSON.stringify({ ...(loadSavedPosition() || {}), ...patch }), 'utf-8');
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

function createOverlayWindow() {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { x: workX, y: workY, width, height } = primaryDisplay.workArea;
  const saved = loadSavedPosition();

  const winWidth = 360;
  const winHeight = 440;

  // Default to bottom-right
  const defaultX = workX + width - winWidth - 24;
  const defaultY = workY + height - winHeight - 24;

  const posX = (saved && Number.isFinite(saved.x)) ? Math.min(Math.max(workX, saved.x), workX + width - winWidth) : defaultX;
  const posY = (saved && Number.isFinite(saved.y)) ? Math.min(Math.max(workY, saved.y), workY + height - winHeight) : defaultY;

  overlayWindow = new BrowserWindow({
    width: winWidth,
    height: winHeight,
    x: posX,
    y: posY,
    transparent: true,
    frame: false,
    alwaysOnTop: overlayPreferences.alwaysOnTop,
    skipTaskbar: true,
    resizable: false,
    hasShadow: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    }
  });
  protectWindow(overlayWindow);

  loadWindowContent(overlayWindow, 'overlay');

  overlayWindow.on('moved', () => {
    if (!overlayWindow) return;
    const bounds = overlayWindow.getBounds();
    if (overlayPreferences.snapToEdge) {
      const area = screen.getDisplayMatching(bounds).workArea;
      const snap = (value, low, high) => Math.abs(value - low) <= 24 ? low : Math.abs(value - high) <= 24 ? high : value;
      const x = snap(bounds.x, area.x, area.x + area.width - bounds.width);
      const y = snap(bounds.y, area.y, area.y + area.height - bounds.height);
      if (x !== bounds.x || y !== bounds.y) {
        overlayWindow.setPosition(x, y);
        savePosition(x, y);
        return;
      }
    }
    savePosition(bounds.x, bounds.y);
  });

  overlayWindow.on('closed', () => {
    overlayWindow = null;
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
  // Create a minimal programmatic 16x16 icon
  const iconBuffer = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAMUlEQVQ4T2NkIBIwEqmOgTpg1IBRA0b9N2DUfwzG//8zMPxnICf8J1IdA3XAqAGjBsADAL4sDgVb4lV+AAAAAElFTkSuQmCC',
    'base64'
  );
  const trayIcon = nativeImage.createFromBuffer(iconBuffer);

  tray = new Tray(trayIcon);
  tray.setToolTip('Companio — Personal AI Companion');

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Wake Companion',
      click: () => {
        if (overlayWindow) {
          overlayWindow.show();
          overlayWindow.focus();
          overlayWindow.webContents.send('shortcut-activated');
        }
      }
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
      if (!overlayWindow) {
        createOverlayWindow();
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
      return await browserController.openYouTube();
    case 'browser.youtube.search_and_play':
      return await browserController.searchAndPlayYouTube(params.creator, params.topic);
    case 'browser.youtube.control':
      return await browserController.controlYouTube(params.action);
    case 'browser.open_url':
      return await browserController.openUrl(params.url);
    case 'browser.search_google':
      return await browserController.searchGoogle(params.query);
    case 'browser.open_tabs':
      return await browserController.openTabs(params.urls);
    case 'browser.close_tab':
      return await browserController.closeCurrentTab();
    case 'browser.wikipedia.search':
      return await browserController.searchWikipedia(params.query);
    case 'browser.amazon.search':
      return await browserController.searchAmazon(params.query);
    case 'browser.maps.search':
      return await browserController.searchGoogleMaps(params.query || params.location);

    // Direct Web Apps
    case 'browser.chatgpt.open':
      return await browserController.openUrl('https://chatgpt.com');
    case 'browser.claude.open':
      return await browserController.openUrl('https://claude.ai');
    case 'browser.gemini.open':
      return await browserController.openUrl('https://gemini.google.com');
    case 'browser.deepseek.open':
      return await browserController.openUrl('https://chat.deepseek.com');
    case 'browser.github.open':
      return await browserController.openUrl('https://github.com');
    case 'browser.gmail.open':
      return await browserController.openUrl('https://mail.google.com');
    case 'browser.whatsapp.open':
      return await browserController.openUrl('https://web.whatsapp.com');
    case 'browser.reddit.open':
      return await browserController.openUrl('https://reddit.com');
    case 'browser.x.open':
      return await browserController.openUrl('https://x.com');
    case 'browser.netflix.open':
      return await browserController.openUrl('https://netflix.com');
    case 'browser.twitch.open':
      return await browserController.openUrl('https://www.twitch.tv');
    case 'browser.linkedin.open':
      return await browserController.openUrl('https://www.linkedin.com');
    case 'browser.translate.open':
      return await browserController.openUrl('https://translate.google.com');

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
  const applied = registerHotkeys(validation.shortcut);
  if (applied.success && !saveConfig({ activationShortcut: applied.shortcut })) {
    return { success: false, error: 'Shortcut changed but could not be saved.' };
  }
  return applied;
});
secureHandle('set-overlay-preferences', async (_, options) => {
  if (!options || typeof options.alwaysOnTop !== 'boolean' || typeof options.snapToEdge !== 'boolean') {
    return { success: false, verified: false, error: 'Invalid overlay preferences' };
  }
  overlayPreferences.alwaysOnTop = options.alwaysOnTop;
  overlayPreferences.snapToEdge = options.snapToEdge;
  if (overlayWindow) overlayWindow.setAlwaysOnTop(options.alwaysOnTop);
  const saved = saveConfig({ alwaysOnTop: options.alwaysOnTop, snapToEdge: options.snapToEdge });
  return { success: saved, verified: saved, error: saved ? undefined : 'Could not save overlay preference' };
});

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

secureHandle('start-native-speech', async (_, { timeoutSec = 5 } = {}) => {
  try {
    return await nativeSpeech.recognizeOnce(timeoutSec);
  } catch (e) {
    return { success: false, error: e.message };
  }
});

secureHandle('cancel-native-speech', () => {
  nativeSpeech.cancel();
  return { success: true };
});

secureHandle('show-overlay', () => {
  if (overlayWindow) {
    overlayWindow.show();
    overlayWindow.focus();
  }
  return true;
});

app.commandLine.appendSwitch('enable-speech-dispatcher');

app.whenReady().then(async () => {
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
