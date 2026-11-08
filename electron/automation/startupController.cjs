'use strict';

// Windows-only startup management. Never automatically opt users in or create
// a login entry from a dev build, browser preview, or CI smoke process.
const STARTUP_NAME = 'com.companio.desktop';

function createStartupController(electronApp, options = {}) {
  const platform = options.platform ?? process.platform;
  const executablePath = options.executablePath ?? process.execPath;
  const supported = () => platform === 'win32' && electronApp.isPackaged === true && options.smokeTest !== true;
  const lookup = { path: executablePath, args: [] };

  function read() {
    if (!supported()) {
      return {
        success: true, supported: false, enabled: false,
        reason: 'Launch at sign-in is available only in the installed Windows app.'
      };
    }
    try {
      const state = electronApp.getLoginItemSettings(lookup);
      // Windows may have disabled the entry from Task Manager / Startup Apps
      // even when the registry still contains openAtLogin=true.
      const item = Array.isArray(state.launchItems)
        ? state.launchItems.find(entry =>
            typeof entry.path === 'string' &&
            entry.path.toLowerCase() === executablePath.toLowerCase() &&
            entry.name === STARTUP_NAME
          )
        : null;
      const enabled = state.openAtLogin === true &&
        state.executableWillLaunchAtLogin !== false &&
        (!item || item.enabled !== false);
      return {
        success: true, supported: true, enabled,
        blockedByWindows: state.openAtLogin === true && !enabled
      };
    } catch (error) {
      return {
        success: false, supported: true, enabled: false,
        error: error?.message || 'Could not read Windows startup settings.'
      };
    }
  }

  function setEnabled(enabled) {
    if (typeof enabled !== 'boolean') {
      return { success: false, supported: supported(), enabled: false, error: 'Startup setting must be true or false.' };
    }
    const previous = read();
    if (!previous.success) return previous;
    if (!previous.supported) {
      return { ...previous, success: false, error: previous.reason };
    }
    if (previous.enabled === enabled && !previous.blockedByWindows) {
      return { ...previous, verified: true };
    }
    try {
      electronApp.setLoginItemSettings({
        openAtLogin: enabled, enabled: true,
        path: executablePath, args: [], name: STARTUP_NAME
      });
      const actual = read();
      if (!actual.success) return actual;
      if (actual.enabled !== enabled) {
        return {
          ...actual, success: false, verified: false,
          error: enabled
            ? 'Windows did not enable Companio at sign-in. Check Settings > Apps > Startup.'
            : 'Windows did not remove Companio from startup. Try again.'
        };
      }
      return { ...actual, verified: true };
    } catch (error) {
      const actual = read();
      return {
        ...actual, success: false, verified: false,
        error: error?.message || 'Could not update Windows startup settings.'
      };
    }
  }

  return { read, setEnabled };
}

module.exports = { createStartupController, STARTUP_NAME };
