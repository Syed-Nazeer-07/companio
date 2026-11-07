'use strict';

const { spawn } = require('node:child_process');

const MAX_OUTPUT = 32 * 1024;

// Only a numeric timeout enters the script; no renderer text is interpolated.
function buildRecognitionScript(timeoutSec) {
  return [
    "$ErrorActionPreference = 'Stop'",
    '$engine = $null',
    'try {',
    '  Add-Type -AssemblyName System.Speech',
    '  $culture = [System.Globalization.CultureInfo]::GetCultureInfo("en-US")',
    '  $engine = New-Object System.Speech.Recognition.SpeechRecognitionEngine($culture)',
    '  $engine.LoadGrammar((New-Object System.Speech.Recognition.DictationGrammar))',
    '  $engine.SetInputToDefaultAudioDevice()',
    '  $result = $engine.Recognize([TimeSpan]::FromSeconds(' + timeoutSec + '))',
    '  if ($result -and $result.Text) {',
    '    $encoded = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($result.Text))',
    '    Write-Output ("SPEECH_RESULT_B64:" + $encoded)',
    '  } else { Write-Output "SPEECH_SILENCE" }',
    '} catch {',
    '  $reason = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($_.Exception.Message))',
    '  Write-Output ("SPEECH_ERROR_B64:" + $reason)',
    '} finally {',
    '  if ($null -ne $engine) { $engine.Dispose() }',
    '}'
  ].join('\n');
}

function decodeResult(output) {
  const text = output.trim();
  const result = text.match(/(?:^|\r?\n)SPEECH_RESULT_B64:([A-Za-z0-9+/=]+)(?:\r?\n|$)/);
  if (result) {
    const words = Buffer.from(result[1], 'base64').toString('utf8').trim();
    return words ? { success: true, text: words } : { success: true, silence: true, text: '' };
  }
  if (/(?:^|\r?\n)SPEECH_SILENCE(?:\r?\n|$)/.test(text)) {
    return { success: true, silence: true, text: '' };
  }
  const error = text.match(/(?:^|\r?\n)SPEECH_ERROR_B64:([A-Za-z0-9+/=]+)(?:\r?\n|$)/);
  if (error) {
    const detail = Buffer.from(error[1], 'base64').toString('utf8').slice(0, 350);
    return { success: false, error: 'Windows speech recognition unavailable: ' + detail };
  }
  return { success: false, error: 'Windows speech recognition returned no usable result.' };
}

class NativeSpeechRecognizer {
  constructor(spawnProcess = spawn) {
    this.spawnProcess = spawnProcess;
    this.activeRequest = null;
  }

  recognizeOnce(timeoutSec = 6) {
    if (!Number.isInteger(timeoutSec) || timeoutSec < 1 || timeoutSec > 15) {
      return Promise.resolve({ success: false, error: 'Speech timeout must be between 1 and 15 seconds.' });
    }
    if (this.activeRequest) {
      return Promise.resolve({ success: false, error: 'Voice recognition is already listening.' });
    }

    return new Promise(resolve => {
      const script = buildRecognitionScript(timeoutSec);
      const encoded = Buffer.from(script, 'utf16le').toString('base64');
      let child;
      try {
        child = this.spawnProcess('powershell.exe', [
          '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass',
          '-EncodedCommand', encoded
        ], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
      } catch (error) {
        resolve({ success: false, error: 'Could not start Windows voice recognition: ' + error.message });
        return;
      }

      let settled = false;
      let stdout = '';
      let stderr = '';
      let timer;
      const finish = result => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        if (this.activeRequest?.child === child) this.activeRequest = null;
        resolve(result);
      };
      const terminate = () => {
        try { child.kill(); } catch {}
      };
      this.activeRequest = { child, finish, terminate };

      child.stdout.on('data', data => {
        stdout += data.toString();
        if (stdout.length > MAX_OUTPUT) {
          terminate();
          finish({ success: false, error: 'Windows recognizer output was unexpectedly large.' });
        }
      });
      child.stderr.on('data', data => {
        stderr = (stderr + data.toString()).slice(-1500);
      });
      child.once('error', error => finish({
        success: false,
        error: 'Windows recognizer could not start: ' + error.message
      }));
      child.once('close', code => {
        const parsed = decodeResult(stdout);
        if (parsed.success || /unavailable/.test(parsed.error || '')) finish(parsed);
        else finish({
          success: false,
          error: code !== 0
            ? 'Windows recognizer exited with code ' + code + (stderr ? ': ' + stderr.slice(0, 200) : '.')
            : parsed.error
        });
      });

      // System.Speech can hang during engine initialization or device errors.
      timer = setTimeout(() => {
        terminate();
        finish({ success: false, error: 'Microphone recognition timed out. Check the default recording device.' });
      }, timeoutSec * 1000 + 8000);
    });
  }

  cancel() {
    const active = this.activeRequest;
    if (!active) return { success: true, cancelled: false };
    active.terminate();
    active.finish({ success: false, cancelled: true, error: 'Listening cancelled.' });
    return { success: true, cancelled: true };
  }
}

module.exports = new NativeSpeechRecognizer();
module.exports.NativeSpeechRecognizer = NativeSpeechRecognizer;
module.exports.buildRecognitionScript = buildRecognitionScript;
