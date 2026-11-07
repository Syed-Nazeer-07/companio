'use strict';
const { spawn } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const root = path.resolve(__dirname, '..');
const binary = path.join(root, 'release', 'win-unpacked', 'Companio.exe');
if (!fs.existsSync(binary)) {
  console.error('Packaged Windows executable not found. Run: npx electron-builder --win --x64 --dir --publish never');
  process.exit(1);
}
const resultFile = path.join(os.tmpdir(), 'companio-smoke-' + process.pid + '.json');
try { fs.unlinkSync(resultFile); } catch {}
const child = spawn(binary, ['--companio-smoke'], {
  cwd: root,
  env: {
    ...process.env,
    NODE_ENV: 'production',
    COMPANIO_SMOKE_TEST: '1',
    COMPANIO_SMOKE_RESULT_PATH: resultFile
  },
  windowsHide: true,
  stdio: ['ignore', 'pipe', 'pipe']
});
let text = '';
let settled = false;
const timer = setTimeout(() => {
  if (settled) return;
  settled = true;
  child.kill();
  console.error('Packaged Electron smoke test exceeded 150 seconds.\n' + text.slice(-6000));
  process.exitCode = 1;
}, 150000);

for (const stream of [child.stdout, child.stderr]) {
  stream.on('data', (chunk) => {
    text += chunk.toString('utf8');
    if (text.length > 128000) text = text.slice(-64000);
  });
}
child.on('error', (err) => {
  if (settled) return;
  settled = true;
  clearTimeout(timer);
  console.error('Failed to launch Electron:', err);
  process.exitCode = 1;
});
child.on('exit', (code) => {
  if (settled) return;
  settled = true;
  clearTimeout(timer);
  let result = null;
  try { result = JSON.parse(fs.readFileSync(resultFile, 'utf8')); } catch {}
  try { fs.unlinkSync(resultFile); } catch {}
  const okay = code === 0 && result?.ok === true
    && result.rendered === true && result.bridge === true && result.inputVisible === true;
  console.log(text.slice(-8000));
  console.log('Packaged desktop smoke result:', JSON.stringify(result));
  if (!okay) {
    console.error('Electron UI smoke test failed (exit code: ' + code + ')');
    process.exitCode = 1;
  }
});
