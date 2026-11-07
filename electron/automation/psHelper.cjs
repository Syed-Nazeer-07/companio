const { spawn } = require('child_process');

function runPowerShell(script, timeoutMs = 30000) {
  return new Promise((resolve, reject) => {
    // UTF-16LE encoding for PowerShell -EncodedCommand
    const buffer = Buffer.from(script, 'utf16le');
    const base64Script = buffer.toString('base64');

    const ps = spawn('powershell.exe', [
      '-NoProfile',
      '-NonInteractive',
      '-ExecutionPolicy', 'Bypass',
      '-EncodedCommand', base64Script
    ]);

    let stdout = '';
    let stderr = '';
    let finished = false;
    const timer = setTimeout(() => {
      if (!finished) {
        finished = true;
        ps.kill();
        reject(new Error('PowerShell command timed out'));
      }
    }, timeoutMs);

    ps.stdout.on('data', (data) => {
      stdout += data.toString();
      if (stdout.length > 1024 * 1024) ps.kill();
    });

    ps.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    ps.on('close', (code) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      if (stdout.length > 1024 * 1024) return reject(new Error('PowerShell output exceeded safe limit'));
      if (code !== 0) return reject(new Error(stderr || `PowerShell exited with code ${code}`));
      resolve({ stdout: stdout.trim(), stderr: stderr.trim() });
    });

    ps.on('error', (err) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      reject(err);
    });
  });
}

module.exports = { runPowerShell };
