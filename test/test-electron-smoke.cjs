'use strict';
const { spawn } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');
const root = path.resolve(__dirname, '..');
const binary = path.join(root, 'release', 'win-unpacked', 'Companio.exe');
if (!fs.existsSync(binary)) {
  console.error('Packaged Windows executable not found. Run: npx electron-builder --win --x64 --dir --publish never');
  process.exit(1);
}
const child = spawn(binary, ['--companio-smoke'], {
  cwd: root,
  env: { ...process.env, NODE_ENV: 'production', COMPANIO_SMOKE_TEST: '1' },
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
  const okay = code === 0 && text.includes('COMPANIO_SMOKE_OK');
  console.log(text.slice(-8000));
  if (!okay) {
    console.error('Electron UI smoke test failed (exit code: ' + code + ')');
    process.exitCode = 1;
  }
});
