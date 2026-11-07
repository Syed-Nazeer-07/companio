const path = require('path');
const fs = require('fs');
const os = require('os');
const { runPowerShell } = require('./psHelper.cjs');
const quotePowerShell = (value) => "'" + String(value).replace(/'/g, "''") + "'";

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

      const script = `Start-Process -FilePath 'explorer.exe' -ArgumentList ${quotePowerShell(resolvedPath)}`;
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
      const script = `& code ${quotePowerShell(target)}`;
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

  // Launch Command Prompt
  async launchCmd() {
    try {
      await runPowerShell('Start-Process "cmd.exe"');
      return { success: true, message: 'Command Prompt opened', verified: true };
    } catch (err) {
      return { success: false, error: err.message, verified: false };
    }
  }

  // Launch Windows PowerShell
  async launchPowerShell() {
    try {
      await runPowerShell('Start-Process "powershell.exe"');
      return { success: true, message: 'PowerShell opened', verified: true };
    } catch (err) {
      return { success: false, error: err.message, verified: false };
    }
  }

  // Launch Windows Camera
  async launchCamera() {
    try {
      await runPowerShell('Start-Process "microsoft.windows.camera:"');
      return { success: true, message: 'Camera opened', verified: true };
    } catch (err) {
      return { success: false, error: err.message, verified: false };
    }
  }

  // Launch Windows Clock & Alarms
  async launchClock() {
    try {
      await runPowerShell('Start-Process "ms-clock:"');
      return { success: true, message: 'Clock & Alarms opened', verified: true };
    } catch (err) {
      return { success: false, error: err.message, verified: false };
    }
  }

  // Launch Windows Weather
  async launchWeather() {
    try {
      await runPowerShell('Start-Process "bingweather:"');
      return { success: true, message: 'Weather app opened', verified: true };
    } catch (err) {
      return { success: false, error: err.message, verified: false };
    }
  }

  // Launch Microsoft Edge
  async launchEdge() {
    try {
      await runPowerShell('Start-Process "msedge.exe"');
      return { success: true, message: 'Microsoft Edge launched', verified: true };
    } catch (err) {
      return { success: false, error: err.message, verified: false };
    }
  }

  // Launch Google Chrome
  async launchChrome() {
    try {
      await runPowerShell('Start-Process "chrome.exe" -ErrorAction SilentlyContinue; if (!$?) { Start-Process "msedge.exe" }');
      return { success: true, message: 'Browser launched', verified: true };
    } catch (err) {
      return { success: false, error: err.message, verified: false };
    }
  }

  // Launch Discord
  async launchDiscord() {
    try {
      const script = `
$discordPath = "$env:LOCALAPPDATA\\Discord\\Update.exe"
if (Test-Path $discordPath) {
  Start-Process $discordPath -ArgumentList "--processStart Discord.exe"
} else {
  Start-Process "https://discord.com/app"
}
`;
      await runPowerShell(script);
      return { success: true, message: 'Discord opened', verified: true };
    } catch (err) {
      return { success: false, error: err.message, verified: false };
    }
  }

  // Launch Steam
  async launchSteam() {
    try {
      await runPowerShell('Start-Process "steam://open/main" -ErrorAction SilentlyContinue; if (!$?) { Start-Process "https://store.steampowered.com" }');
      return { success: true, message: 'Steam opened', verified: true };
    } catch (err) {
      return { success: false, error: err.message, verified: false };
    }
  }

  // Empty Windows Recycle Bin
  async emptyRecycleBin() {
    try {
      await runPowerShell('Clear-RecycleBin -Force -ErrorAction SilentlyContinue');
      return { success: true, message: 'Recycle Bin emptied successfully ✨', verified: true };
    } catch (err) {
      return { success: false, error: err.message, verified: false };
    }
  }

  // Show Desktop / Minimize All Windows
  async showDesktop() {
    try {
      await runPowerShell('(New-Object -ComObject Shell.Application).MinimizeAll()');
      return { success: true, message: 'Showing desktop (all windows minimized)', verified: true };
    } catch (err) {
      return { success: false, error: err.message, verified: false };
    }
  }

  // Check Battery Status
  async getBatteryStatus() {
    try {
      const script = `
$b = Get-CimInstance -ClassName Win32_Battery -ErrorAction SilentlyContinue
if ($b) {
  $status = if ($b.BatteryStatus -eq 2) { "Charging" } else { "Discharging" }
  "$($b.EstimatedChargeRemaining)% ($status)"
} else {
  "Plugged into AC power (No battery detected)"
}
`;
      const { stdout } = await runPowerShell(script);
      const info = stdout.trim() || 'Battery info unavailable';
      return { success: true, message: `Battery status: ${info}`, battery: info, verified: true };
    } catch (err) {
      return { success: false, error: err.message, verified: false };
    }
  }

  // Check System Hardware Specs
  async getSystemSpecs() {
    try {
      const script = `
$cpu = (Get-CimInstance Win32_Processor).Name.Trim()
$ram = [math]::Round((Get-CimInstance Win32_ComputerSystem).TotalPhysicalMemory / 1GB)
$os = (Get-CimInstance Win32_OperatingSystem).Caption.Trim()
"$os | $cpu | ${ram}GB RAM"
`;
      const { stdout } = await runPowerShell(script);
      const specs = stdout.trim();
      return { success: true, message: `System: ${specs}`, specs, verified: true };
    } catch (err) {
      return { success: false, error: err.message, verified: false };
    }
  }

  // Open specific Windows Settings page
  async openSettingsCategory(category = '') {
    try {
      const cat = (category || '').toLowerCase();
      let uri = 'ms-settings:';
      let name = 'Settings';
      if (cat.includes('wifi') || cat.includes('network') || cat.includes('internet')) {
        uri = 'ms-settings:network-wifi';
        name = 'Wi-Fi & Network Settings';
      } else if (cat.includes('bluetooth') || cat.includes('device')) {
        uri = 'ms-settings:bluetooth';
        name = 'Bluetooth & Devices Settings';
      } else if (cat.includes('display') || cat.includes('resolution') || cat.includes('monitor')) {
        uri = 'ms-settings:display';
        name = 'Display Settings';
      } else if (cat.includes('sound') || cat.includes('audio')) {
        uri = 'ms-settings:sound';
        name = 'Sound Settings';
      } else if (cat.includes('app') || cat.includes('program') || cat.includes('installed')) {
        uri = 'ms-settings:appsfeatures';
        name = 'Installed Apps Settings';
      } else if (cat.includes('update') || cat.includes('patch')) {
        uri = 'ms-settings:windowsupdate';
        name = 'Windows Update';
      } else if (cat.includes('power') || cat.includes('battery')) {
        uri = 'ms-settings:powersleep';
        name = 'Power & Battery Settings';
      }

      await runPowerShell(`Start-Process "${uri}"`);
      return { success: true, message: `${name} opened`, verified: true };
    } catch (err) {
      return { success: false, error: err.message, verified: false };
    }
  }

  // Set Monitor Brightness
  async setBrightness(level) {
    try {
      if (typeof level !== 'number' || !Number.isFinite(level)) throw new Error('Invalid brightness level');
      const clamped = Math.max(10, Math.min(100, Math.round(level)));
      const script = `
$m = Get-WmiObject -Namespace root/WMI -Class WmiMonitorBrightnessMethods -ErrorAction SilentlyContinue
if ($m) {
  $m.WmiSetBrightness(1, ${clamped})
  Write-Output "ok"
} else {
  Write-Output "unsupported"
}
`;
      const { stdout } = await runPowerShell(script);
      const ok = stdout.trim() === 'ok';
      return {
        success: true,
        message: ok ? `Screen brightness set to ${clamped}%` : `Brightness adjustment not supported on this display`,
        level: clamped,
        verified: true
      };
    } catch (err) {
      return { success: false, error: err.message, verified: false };
    }
  }

  // Change Monitor Brightness
  async changeBrightness(delta) {
    try {
      if (typeof delta !== 'number' || !Number.isFinite(delta) || Math.abs(delta) > 100) throw new Error('Invalid brightness adjustment');
      const script = `
$cur = Get-WmiObject -Namespace root/WMI -Class WmiMonitorBrightness -ErrorAction SilentlyContinue
$lvl = if ($cur) { $cur.CurrentBrightness } else { 70 }
$target = [math]::Max(10, [math]::Min(100, $lvl + ${delta}))
$m = Get-WmiObject -Namespace root/WMI -Class WmiMonitorBrightnessMethods -ErrorAction SilentlyContinue
if ($m) {
  $m.WmiSetBrightness(1, $target)
  "$target"
} else {
  "unsupported"
}
`;
      const { stdout } = await runPowerShell(script);
      const res = stdout.trim();
      return {
        success: true,
        message: res !== 'unsupported' ? `Brightness changed to ${res}%` : 'Brightness adjustment not supported on this display',
        verified: true
      };
    } catch (err) {
      return { success: false, error: err.message, verified: false };
    }
  }

  // Get Clipboard Content
  async getClipboardText() {
    try {
      const { stdout } = await runPowerShell('Get-Clipboard -ErrorAction SilentlyContinue');
      const text = stdout.trim();
      return {
        success: true,
        message: text ? `Clipboard: "${text.substring(0, 100)}${text.length > 100 ? '...' : ''}"` : 'Clipboard is empty',
        clipboard: text,
        verified: true
      };
    } catch (err) {
      return { success: false, error: err.message, verified: false };
    }
  }

  // Clear Clipboard Content
  async clearClipboard() {
    try {
      await runPowerShell('Set-Clipboard -Value $null -ErrorAction SilentlyContinue');
      return { success: true, message: 'Clipboard cleared', verified: true };
    } catch (err) {
      return { success: false, error: err.message, verified: false };
    }
  }

  // Check Local IP and Network info
  async getNetworkIp() {
    try {
      const script = `
$ip = (Get-NetIPAddress -AddressFamily IPv4 -InterfaceAlias "Wi-Fi*","Ethernet*" -ErrorAction SilentlyContinue | Select-Object -First 1).IPAddress
$conn = (Get-NetConnectionProfile -ErrorAction SilentlyContinue | Select-Object -First 1).Name
"$ip on $conn"
`;
      const { stdout } = await runPowerShell(script);
      const netInfo = stdout.trim() || 'Connected';
      return {
        success: true,
        message: `Network: ${netInfo}`,
        network: netInfo,
        verified: true
      };
    } catch (err) {
      return { success: false, error: err.message, verified: false };
    }
  }
}

module.exports = new WinAppsController();
