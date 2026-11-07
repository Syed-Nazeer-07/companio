const { app, BrowserWindow, globalShortcut, ipcMain, screen, Tray, Menu, nativeImage, session } = require('electron');
const path = require('path');
const fs = require('fs');

const browserController = require('./automation/browserController.cjs');
const winAppsController = require('./automation/winAppsController.cjs');
const volumeController = require('./automation/volumeController.cjs');

let overlayWindow = null;
let dashboardWindow = null;
let tray = null;
let currentShortcut = 'CommandOrControl+Shift+Space';

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

function savePosition(x, y) {
  try {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify({ x, y }), 'utf-8');
  } catch (e) {}
}

function createOverlayWindow() {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width, height } = primaryDisplay.workAreaSize;
  const saved = loadSavedPosition();

  const winWidth = 360;
  const winHeight = 440;

  // Default to bottom-right
  const defaultX = width - winWidth - 24;
  const defaultY = height - winHeight - 24;

  const posX = (saved && saved.x != null) ? Math.min(Math.max(0, saved.x), width - winWidth) : defaultX;
  const posY = (saved && saved.y != null) ? Math.min(Math.max(0, saved.y), height - winHeight) : defaultY;

  overlayWindow = new BrowserWindow({
    width: winWidth,
    height: winHeight,
    x: posX,
    y: posY,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    hasShadow: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
    }
  });

  loadWindowContent(overlayWindow, 'overlay');

  overlayWindow.on('moved', () => {
    if (overlayWindow) {
      const [x, y] = overlayWindow.getPosition();
      savePosition(x, y);
    }
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
    }
  });

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

function registerHotkeys() {
  try {
    globalShortcut.unregisterAll();
    const registered = globalShortcut.register(currentShortcut, () => {
      console.log('Global activation hotkey triggered!');
      if (!overlayWindow) {
        createOverlayWindow();
        return;
      }
      if (!overlayWindow.isVisible()) {
        overlayWindow.show();
        overlayWindow.focus();
        overlayWindow.setAlwaysOnTop(true, 'screen-saver');
        overlayWindow.webContents.send('shortcut-activated');
        return;
      }
      // Toggle overlay: if visible, send toggle event to close/dismiss
      overlayWindow.webContents.send('shortcut-toggle');
    });

    if (!registered) {
      console.warn(`Failed to register global hotkey: ${currentShortcut}`);
    } else {
      console.log(`Global hotkey registered: ${currentShortcut}`);
    }
  } catch (err) {
    console.error('Hotkey registration error:', err);
  }
}

// IPC Handlers
ipcMain.handle('execute-tool', async (_, { toolName, params }) => {
  console.log(`[IPC] Executing tool: ${toolName}`, params);

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

    default:
      return { success: false, error: `Unknown tool: ${toolName}`, verified: false };
  }
});

ipcMain.handle('get-volume', async () => await volumeController.getVolume());
ipcMain.handle('set-volume', async (_, level) => await volumeController.setVolume(level));
ipcMain.handle('set-mute', async (_, mute) => await volumeController.setMute(mute));
ipcMain.handle('take-screenshot', async () => await winAppsController.takeScreenshot());

ipcMain.handle('toggle-dashboard', async (_, show) => {
  if (show === false) {
    if (dashboardWindow) dashboardWindow.hide();
  } else {
    createDashboardWindow();
  }
  return true;
});

ipcMain.handle('save-overlay-position', async (_, { x, y }) => {
  savePosition(x, y);
  return true;
});

ipcMain.handle('get-overlay-position', async () => {
  return loadSavedPosition();
});

ipcMain.handle('set-ignore-mouse-events', (event, ignore) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win) {
    win.setIgnoreMouseEvents(ignore, { forward: true });
  }
});

ipcMain.handle('quit-app', () => {
  app.isQuitting = true;
  app.quit();
});

// State synchronization between overlay and dashboard windows
ipcMain.on('sync-state-broadcast', (event, state) => {
  if (overlayWindow && event.sender !== overlayWindow.webContents) {
    overlayWindow.webContents.send('sync-state', state);
  }
  if (dashboardWindow && event.sender !== dashboardWindow.webContents) {
    dashboardWindow.webContents.send('sync-state', state);
  }
});

ipcMain.handle('hide-overlay', () => {
  if (overlayWindow) overlayWindow.hide();
  return true;
});

ipcMain.handle('show-overlay', () => {
  if (overlayWindow) {
    overlayWindow.show();
    overlayWindow.focus();
  }
  return true;
});

app.commandLine.appendSwitch('enable-speech-dispatcher');
app.commandLine.appendSwitch('enable-features', 'WebBluetooth,WebUSB');

app.whenReady().then(() => {
  // Auto-grant microphone and media permissions for Web Speech API
  if (session && session.defaultSession) {
    session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
      const allowed = ['media', 'microphone', 'notifications', 'accessibility-events'];
      callback(allowed.includes(permission));
    });
    session.defaultSession.setPermissionCheckHandler((webContents, permission) => {
      return ['media', 'microphone', 'notifications', 'accessibility-events'].includes(permission);
    });
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
