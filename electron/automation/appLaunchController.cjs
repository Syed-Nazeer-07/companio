'use strict';

const { runPowerShell } = require('./psHelper.cjs');

// All executable and process names are fixed; no model text can become script.
const PRESETS = Object.freeze({
  notepad: Object.freeze({ executable: 'notepad.exe', process: 'notepad', label: 'Notepad' }),
  paint: Object.freeze({ executable: 'mspaint.exe', process: 'mspaint', label: 'Paint' }),
  taskmgr: Object.freeze({ executable: 'taskmgr.exe', process: 'Taskmgr', label: 'Task Manager' }),
  cmd: Object.freeze({ executable: 'cmd.exe', process: 'cmd', label: 'Command Prompt' }),
  powershell: Object.freeze({ executable: 'powershell.exe', process: 'powershell', label: 'PowerShell' }),
  edge: Object.freeze({ executable: 'msedge.exe', process: 'msedge', label: 'Microsoft Edge' }),
  chrome: Object.freeze({ executable: 'chrome.exe', process: 'chrome', label: 'Google Chrome' })
});

async function launchVerifiedApp(key, execute = runPowerShell) {
  const spec = Object.hasOwn(PRESETS, key) ? PRESETS[key] : null;
  if (!spec) {
    return { success: false, verified: false, error: 'Unsupported application launch request.' };
  }

  // A successful Start-Process only proves that Windows accepted a request.
  // Confirm the actual process is running before reporting verified success.
  const script = [
    "$ErrorActionPreference = 'Stop'",
    "Start-Process -FilePath '" + spec.executable + "' -ErrorAction Stop",
    '$found = $false',
    'for ($i = 0; $i -lt 12; $i++) {',
    '  Start-Sleep -Milliseconds 250',
    "  if (Get-Process -Name '" + spec.process + "' -ErrorAction SilentlyContinue | Select-Object -First 1) {",
    '    $found = $true',
    '    break',
    '  }',
    '}',
    "if ($found) { Write-Output 'COMPANIO_PROCESS_RUNNING' } else { Write-Output 'COMPANIO_PROCESS_NOT_FOUND' }"
  ].join('\n');
  try {
    const result = await execute(script);
    const verified = result?.stdout?.trim() === 'COMPANIO_PROCESS_RUNNING';
    return verified
      ? { success: true, verified: true, message: spec.label + ' process is running.' }
      : {
          success: false, verified: false,
          error: spec.label + ' launch was attempted, but its process could not be confirmed.'
        };
  } catch (error) {
    return {
      success: false, verified: false,
      error: 'Could not launch ' + spec.label + ': ' + (error?.message || 'Windows rejected the request.')
    };
  }
}

module.exports = { launchVerifiedApp };
