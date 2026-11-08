'use strict';

const { spawn } = require('node:child_process');

const MAX_OUTPUT = 32 * 1024;
const SUPPORTED_LANGUAGES = Object.freeze(['en-IN', 'en-US', 'en-GB', 'en-AU']);

// Only a numeric timeout enters the script; no renderer text is interpolated.
function buildRecognitionScript(timeoutSec, requestedLanguage = 'en-US') {
  return [
    "$ErrorActionPreference = 'Stop'",
    '$engine = $null',
    'try {',
    '  Add-Type -AssemblyName System.Speech',
    '  $requested = [System.Globalization.CultureInfo]::GetCultureInfo("' + requestedLanguage + '")',
    '  $installed = [System.Speech.Recognition.SpeechRecognitionEngine]::InstalledRecognizers()',
    '  $selected = $installed | Where-Object { $_.Culture.Name -eq $requested.Name } | Select-Object -First 1',
    '  if (-not $selected) { $selected = $installed | Where-Object { $_.Culture.Name -eq "en-US" } | Select-Object -First 1 }',
    '  if (-not $selected) { $selected = $installed | Where-Object { $_.Culture.TwoLetterISOLanguageName -eq "en" } | Select-Object -First 1 }',
    '  if (-not $selected) { throw "No installed English Windows speech recognition engine. Install an English speech language pack or use text input." }',
    '  $engine = [System.Speech.Recognition.SpeechRecognitionEngine]::new($selected)',
    '  Write-Output ("SPEECH_LOCALE:" + $selected.Culture.Name)',
    '  $engine.LoadGrammar((New-Object System.Speech.Recognition.DictationGrammar))',
    '  $engine.SetInputToDefaultAudioDevice()',
    '  $result = $engine.Recognize([TimeSpan]::FromSeconds(' + timeoutSec + '))',
    '  if ($result -and $result.Text) {',
    '    $encoded = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($result.Text))',
    '    Write-Output ("SPEECH_RESULT_B64:" + $encoded)',
    '    Write-Output ("SPEECH_CONFIDENCE:" + $result.Confidence.ToString("0.000", [System.Globalization.CultureInfo]::InvariantCulture))',
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
    const locale = text.match(/(?:^|\r?\n)SPEECH_LOCALE:([a-z]{2}-[A-Z]{2})(?:\r?\n|$)/);
    const confidence = text.match(/(?:^|\r?\n)SPEECH_CONFIDENCE:(0(?:\.\d+)?|1(?:\.0+)?)(?:\r?\n|$)/);
    return words
      ? {
          success: true, text: words,
          ...(locale ? { language: locale[1] } : {}),
          ...(confidence ? { confidence: Number(confidence[1]) } : {})
        }
      : { success: true, silence: true, text: '' };
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

  recognizeOnce(timeoutSec = 6, requestedLanguage = 'en-US') {
    if (!Number.isInteger(timeoutSec) || timeoutSec < 1 || timeoutSec > 15) {
      return Promise.resolve({ success: false, error: 'Speech timeout must be between 1 and 15 seconds.' });
    }
    if (!SUPPORTED_LANGUAGES.includes(requestedLanguage)) {
      return Promise.resolve({ success: false, error: 'Unsupported recognition language.' });
    }
    if (this.activeRequest) {
      return Promise.resolve({ success: false, error: 'Voice recognition is already listening.' });
    }

    return new Promise(resolve => {
      const script = buildRecognitionScript(timeoutSec, requestedLanguage);
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
module.exports.SUPPORTED_LANGUAGES = SUPPORTED_LANGUAGES;
