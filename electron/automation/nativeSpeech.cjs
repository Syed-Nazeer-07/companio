const { spawn } = require('child_process');

class NativeSpeechRecognizer {
  constructor() {
    this.activeProcess = null;
  }

  // Recognize a single spoken utterance using Windows Speech Recognition Engine
  recognizeOnce(timeoutSec = 5) {
    return new Promise((resolve) => {
      const script = `
Add-Type -AssemblyName System.Speech
try {
    $engine = New-Object System.Speech.Recognition.SpeechRecognitionEngine([System.Globalization.CultureInfo]::GetCultureInfo("en-US"))
    $dictationGrammar = New-Object System.Speech.Recognition.DictationGrammar
    $engine.LoadGrammar($dictationGrammar)
    $engine.SetInputToDefaultAudioDevice()
    $result = $engine.Recognize([TimeSpan]::FromSeconds(${timeoutSec}))
    if ($result -and $result.Text) {
        Write-Output "SPEECH_RESULT:$($result.Text)"
    } else {
        Write-Output "SPEECH_SILENCE"
    }
    $engine.Dispose()
} catch {
    Write-Output "SPEECH_ERROR:$($_.Exception.Message)"
}
`;

      const ps = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', script]);
      this.activeProcess = ps;

      let output = '';
      ps.stdout.on('data', (data) => {
        output += data.toString();
      });

      ps.stderr.on('data', () => {});

      ps.on('close', () => {
        this.activeProcess = null;
        const text = output.trim();
        if (text.includes('SPEECH_RESULT:')) {
          const match = text.match(/SPEECH_RESULT:(.*)/);
          const recognized = match ? match[1].trim() : '';
          resolve({ success: true, text: recognized });
        } else if (text.includes('SPEECH_SILENCE')) {
          resolve({ success: true, text: '', silence: true });
        } else if (text.includes('SPEECH_ERROR:')) {
          const match = text.match(/SPEECH_ERROR:(.*)/);
          resolve({ success: false, error: match ? match[1] : 'Speech error' });
        } else {
          resolve({ success: false, error: 'No output from recognizer' });
        }
      });

      ps.on('error', (err) => {
        this.activeProcess = null;
        resolve({ success: false, error: err.message });
      });
    });
  }

  cancel() {
    if (this.activeProcess) {
      try {
        this.activeProcess.kill();
      } catch (e) {}
      this.activeProcess = null;
    }
  }
}

module.exports = new NativeSpeechRecognizer();
