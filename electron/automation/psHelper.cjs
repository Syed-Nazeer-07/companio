const { spawn } = require('child_process');

function runPowerShell(script) {
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

    ps.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    ps.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    ps.on('close', (code) => {
      if (code !== 0 && !stdout) {
        reject(new Error(stderr || `PowerShell exited with code ${code}`));
      } else {
        resolve({ stdout: stdout.trim(), stderr: stderr.trim() });
      }
    });

    ps.on('error', (err) => {
      reject(err);
    });
  });
}

module.exports = { runPowerShell };
