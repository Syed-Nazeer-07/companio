'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');

test('Phase 4 small bootstrapper installer architecture includes HiDPI NSIS setup options A/B/C without bundled LLM weights', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  assert.equal(pkg.build?.win?.signtoolOptions?.publisherName, 'Companio Team');
  assert.equal(pkg.build?.nsis?.include, 'build/installer.nsh');
  assert.equal(pkg.build?.nsis?.oneClick, false);
  assert.equal(pkg.build?.nsis?.deleteAppDataOnUninstall, false);

  // Never bundle multi-GB GGUF model files inside the base installer
  const pkgText = JSON.stringify(pkg.build);
  assert.doesNotMatch(pkgText, /\.gguf/i);

  const nshPath = path.join(root, 'build/installer.nsh');
  assert.equal(fs.existsSync(nshPath), true);
  const nsh = fs.readFileSync(nshPath, 'utf8');

  // Crisp HiDPI rendering on 150%/200% Windows 11 displays
  assert.match(nsh, /ManifestDPIAware\s+true/);
  assert.match(nsh, /!include\s+["']nsDialogs\.nsh["']/);

  // Option A (local_now), Option B (later), Option C (cloud)
  assert.match(nsh, /Install Local AI Now/i);
  assert.match(nsh, /Download AI Later/i);
  assert.match(nsh, /Cloud AI/i);
  assert.match(nsh, /local_now/);
  assert.match(nsh, /"later"/);
  assert.match(nsh, /"cloud"/);
  assert.match(nsh, /qwen2\.5-1\.5b/);
  assert.match(nsh, /installer-ai-setup\.json/);

  // Must remain completely non-blocking during silent /S automated CI installs
  assert.match(nsh, /\$\{If\}\s+\$\{Silent\}|IfSilent/);
});

test('prepare-bundled-voice copies only runtime binaries and DLLs without whisper test/bench tools', () => {
  const prep = fs.readFileSync(path.join(root, 'scripts/prepare-bundled-voice.cjs'), 'utf8');
  assert.match(prep, /whisper-cli\.exe/);
  assert.match(prep, /\.endsWith\(['"]\.dll['"]\)/);
  assert.doesNotMatch(prep, /fs\.cpSync\(/);
});
