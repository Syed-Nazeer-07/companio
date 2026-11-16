'use strict';
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');

const MAX_PNG_BYTES = 50 * 1024 * 1024;
const PNG_SIGNATURE = Buffer.from('89504e470d0a1a0a', 'hex');

function validPng(data) {
  return Buffer.isBuffer(data) && data.length > 128 && data.length <= MAX_PNG_BYTES &&
    data.subarray(0, 8).equals(PNG_SIGNATURE) &&
    data.toString('ascii', 12, 16) === 'IHDR' &&
    data.readUInt32BE(16) > 0 && data.readUInt32BE(20) > 0;
}

/**
 * Use the verified native Windows capture first. When Graphics.CopyFromScreen
 * fails on a particular device, fall back to Electron's primary display
 * thumbnail. This is invoked ONLY for an explicit screenshot command via
 * the trusted IPC/tool allowlist, never on startup or in the background.
 */
async function captureScreenshotWithFallback({
  winAppsController, desktopCapturer, screen,
  fileSystem = fs, homeDir = os.homedir(), platform = process.platform
}) {
  let native;
  try {
    native = await winAppsController.takeScreenshot();
  } catch (error) {
    native = { success: false, verified: false, error: error?.message || 'Windows screenshot failed.' };
  }
  if (native?.success === true && native.verified === true) return native;
  if (platform !== 'win32') return native || {success:false,verified:false,error:'Screenshots require Windows.'};

  let destination;
  try {
    const display = screen.getPrimaryDisplay();
    if (!display?.size?.width || !display?.size?.height) throw Error('No primary display is available.');
    const scale = Number.isFinite(display.scaleFactor) ? display.scaleFactor : 1;
    const thumbnailSize = {
      width: Math.min(8192, Math.max(64, Math.round(display.size.width * scale))),
      height: Math.min(8192, Math.max(64, Math.round(display.size.height * scale)))
    };
    const sources = await desktopCapturer.getSources({types:['screen'], thumbnailSize});
    const selected = sources.find(source => String(source.display_id) === String(display.id)) || sources[0];
    if (!selected?.thumbnail || selected.thumbnail.isEmpty()) {
      throw Error('No screen image was returned.');
    }
    const png = selected.thumbnail.toPNG();
    if (!validPng(png)) throw Error('The screen capture was not a valid PNG.');

    let picturesDir = path.join(homeDir, 'Pictures');
    try {
      const response = await winAppsController.runPowerShell("[Environment]::GetFolderPath('MyPictures')");
      const redirected = typeof response?.stdout === 'string' ? response.stdout.trim() : '';
      if (redirected && redirected.length <= 1024 &&
          !/[\u0000-\u001f]/.test(redirected) && path.isAbsolute(redirected)) {
        picturesDir = redirected;
      }
    } catch { /* Keep the default Pictures directory if Windows cannot report it. */ }

    const dir = path.join(picturesDir, 'Companio_Captures');
    fileSystem.mkdirSync(dir, {recursive:true});
    const date = new Date().toISOString().replace(/[:.]/g, '-');
    destination = path.join(dir, 'Companio_Screenshot_' + date + '_' + crypto.randomBytes(3).toString('hex') + '.png');
    fileSystem.writeFileSync(destination, png, {flag:'wx',mode:0o600});
    const result = fileSystem.statSync(destination);
    if (!result.isFile() || result.size !== png.length) throw Error('Saved capture did not match the image.');
    return {
      success:true,verified:true,filePath:destination,
      verificationScope:'saved-png',
      message:'Screenshot saved to ' + destination + ' (Electron capture fallback).'
    };
  } catch (error) {
    if (destination) {
      try { fileSystem.unlinkSync(destination); } catch {}
    }
    const reason = error?.message || 'Screen capture was unavailable.';
    return {
      success:false,verified:false,
      error:'Windows screenshot failed (' + (native?.error || 'unverified') +
        '); Electron screen capture also failed (' + reason + ').'
    };
  }
}
module.exports = {captureScreenshotWithFallback,validPng};
