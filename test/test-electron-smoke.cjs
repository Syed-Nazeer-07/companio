'use strict';
const { spawn } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const root = path.resolve(__dirname, '..');
const binary = path.join(root, 'release', 'win-unpacked', 'Companio.exe');
if (!fs.existsSync(binary)) {
  console.error('Packaged Windows executable missing. Build with: npx electron-builder --win --x64 --dir --publish never');
  process.exit(1);
}
const resultFile = path.join(os.tmpdir(), 'companio-smoke-' + process.pid + '.json');
try { fs.unlinkSync(resultFile); } catch {}
const child = spawn(binary, ['--companio-smoke'], {
  cwd: root,
  env: { ...process.env, NODE_ENV: 'production', COMPANIO_SMOKE_TEST: '1', COMPANIO_SMOKE_RESULT_PATH: resultFile },
  windowsHide: true,
  stdio: ['ignore', 'pipe', 'pipe']
});
let output = '';
let settled = false;
let lastStage = 'not-started';
function reportResult() {
  try { return JSON.parse(fs.readFileSync(resultFile, 'utf8')); }
  catch { return null; }
}
function finish(ok, message) {
  if (settled) return;
  settled = true;
  clearInterval(poll);
  clearTimeout(timeout);
  try { child.kill(); } catch {}
  try { fs.unlinkSync(resultFile); } catch {}
  console.log('Desktop smoke stage:', lastStage);
  console.log(output.slice(-5000));
  console.log(message);
  process.exit(ok ? 0 : 1);
}
for (const stream of [child.stdout, child.stderr]) {
  stream.on('data', chunk => {
    output = (output + chunk.toString('utf8')).slice(-12000);
  });
}
const poll = setInterval(() => {
  const result = reportResult();
  if (!result) return;
  if (result.stage && result.stage !== lastStage) {
    lastStage = result.stage;
    console.log('Desktop smoke progress:', lastStage);
  }
  if (result.ok === true) {
    const verified = result.rendered === true && result.bridge === true && result.inputVisible === true;
    finish(verified, 'Packaged Electron UI and shortcut: ' + (verified ? 'PASS' : 'INCOMPLETE'));
  } else if (result.ok === false) {
    finish(false, 'Packaged Electron smoke failed: ' + (result.error || JSON.stringify(result)));
  }
}, 350);
const timeout = setTimeout(() => finish(false, 'Packaged Electron smoke timed out after 60 seconds.'), 60000);
child.on('error', err => finish(false, 'Unable to launch packaged Electron: ' + err.message));
child.on('exit', code => {
  if (settled) return;
  const result = reportResult();
  if (result?.ok === true) {
    finish(result.rendered === true && result.bridge === true && result.inputVisible === true, 'Packaged Electron smoke completed.');
  } else {
    finish(false, 'Packaged Electron exited unexpectedly with code ' + code + ': ' + JSON.stringify(result));
  }
});
