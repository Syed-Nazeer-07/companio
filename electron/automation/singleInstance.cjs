'use strict';

// Only one tray-owning Companio process should run per Windows login session.
// A second launch activates the first rather than racing the hotkey, history,
// browser profile, microphone and persistent overlay position.
function registerSingleInstance(app, onSecondInstance) {
  if (!app || typeof app.requestSingleInstanceLock !== 'function' ||
      typeof app.quit !== 'function' || typeof app.on !== 'function' ||
      typeof onSecondInstance !== 'function') {
    throw Error('Companio single-instance integration requires a valid Electron app.');
  }
  const primary = app.requestSingleInstanceLock();
  if (!primary) {
    app.quit();
    return false;
  }
  app.on('second-instance', () => {
    if (typeof app.isReady === 'function' && app.isReady()) {
      onSecondInstance();
    }
  });
  return true;
}
module.exports = { registerSingleInstance };
