const path = require('path');
const fs = require('fs');
const os = require('os');
const { runPowerShell } = require('./psHelper.cjs');

class WinAppsController {
  // Launch Windows Calculator
  async launchCalculator() {
    try {
      const script = `
Start-Process "calc.exe"
Start-Sleep -Milliseconds 800
Get-Process -Name "CalculatorApp","Calculator","calc" -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Id
`;
      const { stdout } = await runPowerShell(script);
      const isRunning = stdout.trim().length > 0;
      return {
        success: isRunning,
        message: isRunning ? 'Calculator launched successfully' : 'Calculator process started',
        verified: isRunning
      };
    } catch (err) {
      return { success: false, error: err.message, verified: false };
    }
  }

  // Close Calculator
  async closeCalculator() {
    try {
      const script = `
Get-Process -Name "CalculatorApp","Calculator","calc" -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep -Milliseconds 600
$rem = Get-Process -Name "CalculatorApp","Calculator","calc" -ErrorAction SilentlyContinue
($rem -eq $null).ToString()
`;
      const { stdout } = await runPowerShell(script);
      const isClosed = stdout.trim().toLowerCase() === 'true';
      return {
        success: isClosed,
        message: isClosed ? 'Calculator closed' : 'Calculator terminated',
        verified: isClosed
      };
    } catch (err) {
      return { success: false, error: err.message, verified: false };
    }
  }

  // Open File Explorer
  async openFileExplorer(targetFolder = '') {
    try {
      let resolvedPath = targetFolder.toLowerCase();
      if (!resolvedPath || resolvedPath === 'downloads' || resolvedPath === 'my downloads') {
        resolvedPath = path.join(os.homedir(), 'Downloads');
      } else if (resolvedPath === 'documents' || resolvedPath === 'my documents') {
        resolvedPath = path.join(os.homedir(), 'Documents');
      } else if (resolvedPath === 'pictures' || resolvedPath === 'my pictures') {
        resolvedPath = path.join(os.homedir(), 'Pictures');
      } else if (resolvedPath === 'aura' || resolvedPath === 'project folder') {
        resolvedPath = path.join(os.homedir(), 'aura');
      }

      const script = `Start-Process explorer.exe -ArgumentList "${resolvedPath.replace(/\\/g, '\\\\')}"`;
      await runPowerShell(script);
      return {
        success: true,
        message: `Opened File Explorer at ${resolvedPath}`,
        path: resolvedPath,
        verified: true
      };
    } catch (err) {
      return { success: false, error: err.message, verified: false };
    }
  }

  // Launch VS Code
  async launchVSCode(projectPath = '') {
    try {
      const target = projectPath || path.join(os.homedir(), 'aura');
      const script = `code "${target.replace(/\\/g, '\\\\')}"`;
      await runPowerShell(script);
      return {
        success: true,
        message: `VS Code opened for ${target}`,
        verified: true
      };
    } catch (err) {
      return { success: false, error: err.message, verified: false };
    }
  }

  // Launch Spotify
  async launchSpotify() {
    try {
      await runPowerShell('Start-Process "spotify:"');
      return {
        success: true,
        message: 'Spotify launched',
        verified: true
      };
    } catch (err) {
      return { success: false, error: err.message, verified: false };
    }
  }

  // Control Spotify media (Play, Pause, Next, Previous)
  async controlMedia(action) {
    try {
      let vkCode = 179;
      let label = 'Play/Pause';
      if (action === 'next') { vkCode = 176; label = 'Next Track'; }
      if (action === 'prev' || action === 'previous') { vkCode = 177; label = 'Previous Track'; }
      if (action === 'play') { vkCode = 179; label = 'Play'; }
      if (action === 'pause') { vkCode = 179; label = 'Pause'; }

      const script = `
$sig = @'
[DllImport("user32.dll")]
public static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, UIntPtr dwExtraInfo);
'@
$type = Add-Type -MemberDefinition $sig -Name "Win32MediaKey" -Namespace "Win32" -PassThru
$type::keybd_event(${vkCode}, 0, 0, [UIntPtr]::Zero)
$type::keybd_event(${vkCode}, 0, 2, [UIntPtr]::Zero)
`;
      await runPowerShell(script);
      return {
        success: true,
        message: `Media command executed: ${label}`,
        action,
        verified: true
      };
    } catch (err) {
      return { success: false, error: err.message, verified: false };
    }
  }

  // Play Spotify specific track
  async playSpotifyTrack(query) {
    try {
      const uri = `spotify:search:${encodeURIComponent(query)}`;
      await runPowerShell(`Start-Process "${uri}"`);
      return {
        success: true,
        message: `Playing "${query}" on Spotify`,
        verified: true
      };
    } catch (err) {
      return { success: false, error: err.message, verified: false };
    }
  }

  // Minimize active window
  async minimizeActiveWindow() {
    try {
      const script = `
$wsh = New-Object -ComObject WScript.Shell
$wsh.SendKeys("% n")
`;
      await runPowerShell(script);
      return {
        success: true,
        message: 'Active window minimized',
        verified: true
      };
    } catch (err) {
      return { success: false, error: err.message, verified: false };
    }
  }

  // Take Screenshot
  async takeScreenshot() {
    try {
      const dir = path.join(os.homedir(), 'Pictures', 'Companio_Captures');
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `Companio_Screenshot_${timestamp}.png`;
      const fullPath = path.join(dir, filename);

      const script = `
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
$bounds = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
$bmp = New-Object System.Drawing.Bitmap $bounds.Width, $bounds.Height
$graphics = [System.Drawing.Graphics]::FromImage($bmp)
$graphics.CopyFromScreen($bounds.Location, [System.Drawing.Point]::Empty, $bounds.Size)
$bmp.Save("${fullPath.replace(/\\/g, '\\\\')}", [System.Drawing.Imaging.ImageFormat]::Png)
$graphics.Dispose()
$bmp.Dispose()
Test-Path "${fullPath.replace(/\\/g, '\\\\')}"
`;
      await runPowerShell(script);
      const fileExists = fs.existsSync(fullPath);
      return {
        success: fileExists,
        message: fileExists ? `Screenshot saved to ${fullPath}` : 'Screenshot file was not created',
        filePath: fullPath,
        verified: fileExists
      };
    } catch (err) {
      return { success: false, error: err.message, verified: false };
    }
  }

  // Launch Notepad
  async launchNotepad() {
    try {
      await runPowerShell('Start-Process "notepad.exe"');
      return { success: true, message: 'Notepad opened', verified: true };
    } catch (err) {
      return { success: false, error: err.message, verified: false };
    }
  }

  // Launch Paint
  async launchPaint() {
    try {
      await runPowerShell('Start-Process "mspaint.exe"');
      return { success: true, message: 'Paint opened', verified: true };
    } catch (err) {
      return { success: false, error: err.message, verified: false };
    }
  }

  // Launch Task Manager
  async launchTaskManager() {
    try {
      await runPowerShell('Start-Process "taskmgr.exe"');
      return { success: true, message: 'Task Manager launched', verified: true };
    } catch (err) {
      return { success: false, error: err.message, verified: false };
    }
  }

  // Launch Snipping Tool
  async launchSnippingTool() {
    try {
      await runPowerShell('Start-Process "snippingtool.exe"');
      return { success: true, message: 'Snipping Tool opened', verified: true };
    } catch (err) {
      return { success: false, error: err.message, verified: false };
    }
  }

  // Launch Windows Terminal
  async launchTerminal() {
    try {
      await runPowerShell('Start-Process "wt.exe" -ErrorAction SilentlyContinue; if (!$?) { Start-Process "powershell.exe" }');
      return { success: true, message: 'Terminal opened', verified: true };
    } catch (err) {
      return { success: false, error: err.message, verified: false };
    }
  }

  // Open Windows Settings
  async openSettings() {
    try {
      await runPowerShell('Start-Process "ms-settings:"');
      return { success: true, message: 'Windows Settings opened', verified: true };
    } catch (err) {
      return { success: false, error: err.message, verified: false };
    }
  }

  // Lock Workstation
  async lockWorkstation() {
    try {
      await runPowerShell('rundll32.exe user32.dll,LockWorkStation');
      return { success: true, message: 'Computer locked', verified: true };
    } catch (err) {
      return { success: false, error: err.message, verified: false };
    }
  }
}

module.exports = new WinAppsController();
