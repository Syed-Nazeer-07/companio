const path = require('path');
const fs = require('fs');
const os = require('os');
const { runPowerShell } = require('./psHelper.cjs');
const { launchVerifiedApp } = require('./appLaunchController.cjs');
const quotePowerShell = (value) => "'" + String(value).replace(/'/g, "''") + "'";

class WinAppsController {
  constructor(run = runPowerShell) {
    this.runPowerShell = run;
  }

  // Launch Windows Calculator
  async launchCalculator() {
    try {
      const script = `
Start-Process "calc.exe"
Start-Sleep -Milliseconds 800
Get-Process -Name "CalculatorApp","Calculator","calc" -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Id
`;
      const { stdout } = await this.runPowerShell(script);
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
      const { stdout } = await this.runPowerShell(script);
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
      if (typeof targetFolder !== 'string' || targetFolder.length > 1024 || /[\u0000-\u001f]/.test(targetFolder)) {
        throw new Error('Invalid File Explorer folder.');
      }
      const request = targetFolder.trim();
      const key = request.toLowerCase().replace(/^my\s+/, '');
      const knownFolders = {
        desktop: 'Desktop', downloads: 'Downloads', documents: 'Documents',
        pictures: 'Pictures', music: 'Music', videos: 'Videos'
      };
      const resolvedPath = request
        ? (Object.hasOwn(knownFolders, key) ? path.join(os.homedir(), knownFolders[key]) : request)
        : '';
      if (resolvedPath && !path.isAbsolute(resolvedPath) && !path.win32.isAbsolute(resolvedPath)) {
        throw new Error('Choose a standard Windows folder or an absolute directory path.');
      }
      if (resolvedPath && (!fs.existsSync(resolvedPath) || !fs.statSync(resolvedPath).isDirectory())) {
        return {
          success: false, verified: false,
          error: 'The requested File Explorer directory does not exist.'
        };
      }

      // On Windows 11 an Explorer process may already be running. Its mere
      // existence does not prove we opened the intended folder, so inspect
      // the actual Explorer shell window locations after the launch.
      const script = [
        "$ErrorActionPreference = 'Stop'",
        '$shell = New-Object -ComObject Shell.Application',
        '$target = ' + quotePowerShell(resolvedPath),
        "$windowsBefore = @($shell.Windows() | Where-Object { $_.FullName -like '*explorer.exe' }).Count",
        "if ($target) { Start-Process -FilePath 'explorer.exe' -ArgumentList ('\"' + $target + '\"') -ErrorAction Stop }",
        "else { Start-Process -FilePath 'explorer.exe' -ErrorAction Stop }",
        '$confirmed = $false',
        'for ($i = 0; $i -lt 16; $i++) {',
        '  Start-Sleep -Milliseconds 250',
        "  $wins = @($shell.Windows() | Where-Object { $_.FullName -like '*explorer.exe' })",
        '  if (!$target) {',
        '    if ($wins.Count -gt $windowsBefore) { $confirmed = $true; break }',
        '    continue',
        '  }',
        '  foreach ($w in $wins) {',
        '    try {',
        '      $url = [string]$w.LocationURL',
        "      if ($url -like 'file:*') {",
        '        $localPath = ([Uri]$url).LocalPath',
        "        if ([string]::Equals($localPath.TrimEnd('\\'), $target.TrimEnd('\\'), [StringComparison]::OrdinalIgnoreCase)) {",
        '          $confirmed = $true; break',
        '        }',
        '      }',
        '    } catch {}',
        '  }',
        '  if ($confirmed) { break }',
        '}',
        "if ($confirmed) { 'COMPANIO_EXPLORER_OPENED' } else { 'COMPANIO_EXPLORER_UNVERIFIED' }"
      ].join('\n');
      const { stdout } = await this.runPowerShell(script);
      const verified = stdout.trim() === 'COMPANIO_EXPLORER_OPENED';
      return {
        success: verified, verified,
        path: resolvedPath || undefined,
        message: verified ? 'File Explorer window confirmed.' : 'File Explorer launch was sent but could not be verified.',
        error: verified ? undefined : 'No matching File Explorer window was detected after the launch.'
      };
    } catch (err) {
      return { success: false, verified: false, error: err.message };
    }
  }

  // Launch VS Code
  async launchVSCode(projectPath = '') {
    try {
      if (typeof projectPath !== 'string') throw new Error('Invalid VS Code project path');
      const target = projectPath.trim();
      if (target && (!fs.existsSync(target) || !fs.statSync(target).isDirectory())) {
        return { success: false, verified: false, error: 'VS Code project folder does not exist.' };
      }
      const script = [
        "$ErrorActionPreference = 'Stop'",
        '& code' + (target ? ' ' + quotePowerShell(target) : ''),
        '$found = $false',
        'for ($i = 0; $i -lt 16; $i++) {',
        '  Start-Sleep -Milliseconds 250',
        "  if (Get-Process -Name 'Code' -ErrorAction SilentlyContinue | Select-Object -First 1) { $found = $true; break }",
        '}',
        "if ($found) { 'COMPANIO_CODE_RUNNING' } else { 'COMPANIO_CODE_NOT_FOUND' }"
      ].join('\n');
      const { stdout } = await this.runPowerShell(script);
      const verified = stdout.trim() === 'COMPANIO_CODE_RUNNING';
      return {
        success: verified,
        verified,
        message: verified ? 'Visual Studio Code process is running.' : 'VS Code launch attempted, but no running process was confirmed.',
        error: verified ? undefined : 'Could not verify VS Code started.'
      };
    } catch (err) {
      return { success: false, verified: false, error: err.message };
    }
  }

  // Launch Spotify
  async launchSpotify() {
    try {
      const script = [
        "$ErrorActionPreference = 'Stop'",
        'Start-Process -FilePath "spotify:" -ErrorAction Stop',
        '$found = $false',
        'for ($i = 0; $i -lt 16; $i++) {',
        '  Start-Sleep -Milliseconds 250',
        "  if (Get-Process -Name 'Spotify' -ErrorAction SilentlyContinue | Select-Object -First 1) { $found = $true; break }",
        '}',
        "if ($found) { 'COMPANIO_SPOTIFY_RUNNING' } else { 'COMPANIO_SPOTIFY_NOT_FOUND' }"
      ].join('\n');
      const { stdout } = await this.runPowerShell(script);
      const verified = stdout.trim() === 'COMPANIO_SPOTIFY_RUNNING';
      return {
        success: verified,
        verified,
        message: verified ? 'Spotify process is running.' : 'Spotify launch requested, but its process was not found.',
        error: verified ? undefined : 'Spotify could not be verified. Confirm that it is installed.'
      };
    } catch (err) {
      return { success: false, verified: false, error: err.message };
    }
  }

  // Control Spotify media (Play, Pause, Next, Previous)
  async controlMedia(action) {
    try {
      // VK_MEDIA_PLAY_PAUSE is a toggle, NOT an idempotent play/pause
      // operation. Never send it for a requested explicit media state.
      if (action === 'play' || action === 'pause') {
        return {
          success: false, verified: false,
          error: 'Windows global media control is a toggle. Cannot guarantee play or pause without a readable media session.'
        };
      }
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
      await this.runPowerShell(script);
      return {
        success: true,
        message: `Media key sent: ${label}; playback state is not independently verified.`,
        error: 'Media key was sent, but Windows did not confirm a change in the active media session.',
        action,
        verified: false
      };
    } catch (err) {
      return { success: false, error: err.message, verified: false };
    }
  }

  // Play Spotify specific track
  async playSpotifyTrack(query) {
    try {
      if (typeof query !== 'string' || !query.trim()) {
        throw new Error('Spotify search needs a song or artist.');
      }
      const uri = 'spotify:search:' + encodeURIComponent(query);
      await this.runPowerShell('Start-Process -FilePath ' + quotePowerShell(uri) + ' -ErrorAction Stop');
      return {
        success: true,
        verified: false,
        message: 'Opened a Spotify search for "' + query + '"; actual playback has not been confirmed.',
        error: 'Spotify search was opened, but playback cannot be verified or started automatically.'
      };
    } catch (err) {
      return { success: false, verified: false, error: err.message };
    }
  }

  // Minimize active window
  async minimizeActiveWindow() {
    // The previous Alt+N SendKeys shortcut was context-dependent and could
    // type into the user's active application or act on the wrong window.
    return {
      success: false,
      verified: false,
      error: 'Reliable active-window minimization is not yet available; no keyboard shortcut was sent.'
    };
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
 $bmp.Save(${quotePowerShell(fullPath)}, [System.Drawing.Imaging.ImageFormat]::Png)
$graphics.Dispose()
$bmp.Dispose()
 Test-Path -LiteralPath ${quotePowerShell(fullPath)}
`;
      await this.runPowerShell(script);
      const fileExists = fs.existsSync(fullPath) && fs.statSync(fullPath).size > 128;
      let verified = false;
      if (fileExists) {
        const fd = fs.openSync(fullPath, 'r');
        try {
          const signature = Buffer.alloc(8);
          const bytes = fs.readSync(fd, signature, 0, 8, 0);
          verified = bytes === 8 && signature.equals(Buffer.from('89504e470d0a1a0a', 'hex'));
        } finally {
          fs.closeSync(fd);
        }
      }
      return {
        success: verified,
        message: verified ? `Screenshot saved to ${fullPath}` : 'Screenshot PNG could not be verified.',
        error: verified ? undefined : 'Screenshot file is missing, empty, or not a valid PNG.',
        filePath: fullPath,
        verified
      };
    } catch (err) {
      return { success: false, error: err.message, verified: false };
    }
  }

  // Launch Notepad
  async launchNotepad() {
    return launchVerifiedApp('notepad');
  }

  // Launch Paint
  async launchPaint() {
    return launchVerifiedApp('paint');
  }

  // Launch Task Manager
  async launchTaskManager() {
    return launchVerifiedApp('taskmgr');
  }

  // Launch Snipping Tool
  async launchSnippingTool() {
    try {
      await this.runPowerShell('Start-Process "snippingtool.exe"');
      return { success: true, message: 'Snipping Tool opened', verified: true };
    } catch (err) {
      return { success: false, error: err.message, verified: false };
    }
  }

  // Launch Windows Terminal
  async launchTerminal() {
    try {
      await this.runPowerShell('Start-Process "wt.exe" -ErrorAction SilentlyContinue; if (!$?) { Start-Process "powershell.exe" }');
      return { success: true, message: 'Terminal opened', verified: true };
    } catch (err) {
      return { success: false, error: err.message, verified: false };
    }
  }

  // Open Windows Settings
  async openSettings() {
    try {
      await this.runPowerShell('Start-Process "ms-settings:"');
      return { success: true, message: 'Windows Settings opened', verified: true };
    } catch (err) {
      return { success: false, error: err.message, verified: false };
    }
  }

  // Lock Workstation
  async lockWorkstation() {
    try {
      await this.runPowerShell('rundll32.exe user32.dll,LockWorkStation');
      return {
        success: true, verified: false,
        message: 'Windows lock request was issued; the locked state was not observed.',
        error: 'Lock request sent, but Windows did not return confirmation of the locked state.'
      };
    } catch (err) {
      return { success: false, error: err.message, verified: false };
    }
  }

  // Launch Command Prompt
  async launchCmd() {
    return launchVerifiedApp('cmd');
  }

  // Launch Windows PowerShell
  async launchPowerShell() {
    return launchVerifiedApp('powershell');
  }

  // Launch Windows Camera
  async launchCamera() {
    try {
      await this.runPowerShell('Start-Process "microsoft.windows.camera:"');
      return { success: true, message: 'Camera opened', verified: true };
    } catch (err) {
      return { success: false, error: err.message, verified: false };
    }
  }

  // Launch Windows Clock & Alarms
  async launchClock() {
    try {
      await this.runPowerShell('Start-Process "ms-clock:"');
      return { success: true, message: 'Clock & Alarms opened', verified: true };
    } catch (err) {
      return { success: false, error: err.message, verified: false };
    }
  }

  // Launch Windows Weather
  async launchWeather() {
    try {
      await this.runPowerShell('Start-Process "bingweather:"');
      return { success: true, message: 'Weather app opened', verified: true };
    } catch (err) {
      return { success: false, error: err.message, verified: false };
    }
  }

  // Launch Microsoft Edge
  async launchEdge() {
    return launchVerifiedApp('edge');
  }

  // Launch Google Chrome
  async launchChrome() {
    return launchVerifiedApp('chrome');
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
      await this.runPowerShell(script);
      return { success: true, message: 'Discord opened', verified: true };
    } catch (err) {
      return { success: false, error: err.message, verified: false };
    }
  }

  // Launch Steam
  async launchSteam() {
    try {
      await this.runPowerShell('Start-Process "steam://open/main" -ErrorAction SilentlyContinue; if (!$?) { Start-Process "https://store.steampowered.com" }');
      return { success: true, message: 'Steam opened', verified: true };
    } catch (err) {
      return { success: false, error: err.message, verified: false };
    }
  }

  // Empty Windows Recycle Bin
  async emptyRecycleBin() {
    try {
      await this.runPowerShell('Clear-RecycleBin -Force -ErrorAction Stop');
      return { success: true, message: 'Recycle Bin clear command completed; contents not independently verified.', verified: false };
    } catch (err) {
      return { success: false, error: err.message, verified: false };
    }
  }

  // Show Desktop / Minimize All Windows
  async showDesktop() {
    try {
      await this.runPowerShell('(New-Object -ComObject Shell.Application).MinimizeAll()');
      return {
        success: true, verified: false,
        message: 'Windows was asked to minimize open windows; resulting desktop visibility is not verified.',
        error: 'Show Desktop was requested, but window state could not be independently checked.'
      };
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
  "No battery was reported by Windows; charging state is unknown"
}
`;
      const { stdout } = await this.runPowerShell(script);
      const info = stdout.trim();
      if (!info) return { success: false, verified: false, error: 'Windows did not return battery status.' };
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
      const { stdout } = await this.runPowerShell(script);
      const specs = stdout.trim();
      const fields = specs.split('|').map(part => part.trim());
      if (fields.length !== 3 || fields.some(part => !part) || !/\b\d+GB RAM\b/i.test(fields[2])) {
        return { success: false, verified: false, error: 'Windows returned incomplete hardware specifications.' };
      }
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

      await this.runPowerShell(`Start-Process "${uri}"`);
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
  $m.WmiSetBrightness(1, ${clamped}) | Out-Null
  $after = Get-WmiObject -Namespace root/WMI -Class WmiMonitorBrightness -ErrorAction SilentlyContinue
  if ($after -and [int]$after.CurrentBrightness -eq ${clamped}) { Write-Output "ok" }
  else { Write-Output "unverified" }
} else {
  Write-Output "unsupported"
}
`;
      const { stdout } = await this.runPowerShell(script);
      const ok = stdout.trim() === 'ok';
      return {
        success: ok,
        message: ok ? `Screen brightness set to ${clamped}%` : 'Brightness could not be verified or is unsupported on this display',
        level: clamped,
        verified: ok
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
  $m.WmiSetBrightness(1, $target) | Out-Null
  $after = Get-WmiObject -Namespace root/WMI -Class WmiMonitorBrightness -ErrorAction SilentlyContinue
  if ($after -and [int]$after.CurrentBrightness -eq [int]$target) { "$target" } else { "unverified" }
} else {
  "unsupported"
}
`;
      const { stdout } = await this.runPowerShell(script);
      const res = stdout.trim();
      const ok = /^\d+$/.test(res);
      return {
        success: ok,
        message: ok ? `Brightness changed to ${res}%` : 'Brightness could not be verified or is unsupported on this display',
        verified: ok
      };
    } catch (err) {
      return { success: false, error: err.message, verified: false };
    }
  }

  // Get Clipboard Content
  async getClipboardText() {
    try {
      const { stdout } = await this.runPowerShell('Get-Clipboard -ErrorAction SilentlyContinue');
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
      const { stdout } = await this.runPowerShell([
        'Set-Clipboard -Value $null -ErrorAction Stop',
        '$remaining = Get-Clipboard -Raw -ErrorAction SilentlyContinue',
        "if ([string]::IsNullOrEmpty($remaining)) { 'COMPANIO_CLIPBOARD_EMPTY' } else { 'COMPANIO_CLIPBOARD_NOT_EMPTY' }"
      ].join('\n'));
      const verified = stdout.trim() === 'COMPANIO_CLIPBOARD_EMPTY';
      return {
        success: verified,
        verified,
        message: verified ? 'Clipboard is empty.' : 'Clipboard clear could not be verified.',
        error: verified ? undefined : 'Clipboard content remained or Windows did not confirm it was cleared.'
      };
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
      const { stdout } = await this.runPowerShell(script);
      const netInfo = stdout.trim();
      if (!/\b(?:\d{1,3}\.){3}\d{1,3}\b/.test(netInfo)) {
        return { success: false, verified: false, error: 'Windows did not return a valid local IPv4 address.' };
      }
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
module.exports.WinAppsController = WinAppsController;
