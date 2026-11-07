'use strict';
const { spawn } = require('node:child_process');
const path = require('node:path');
const binary = require('electron');
const root = path.resolve(__dirname, '..');
const child = spawn(binary, ['.', '--companio-smoke'], {
  cwd: root,
  env: { ...process.env, NODE_ENV: 'production' },
  windowsHide: true,
  stdio: ['ignore', 'pipe', 'pipe']
});
let text = '';
let settled = false;
const timer = setTimeout(() => {
  if (settled) return;
  settled = true;
  child.kill();
  console.error('Electron smoke test timed out.\n' + text.slice(-6000));
  process.exitCode = 1;
}, 45000);

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
