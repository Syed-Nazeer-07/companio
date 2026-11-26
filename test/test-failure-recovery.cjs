'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const src = fs.readFileSync(path.join(__dirname, '../src/services/failureRecovery.ts'), 'utf8');
const compiled = ts.transpileModule(src, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
}).outputText;
const exportsObj = {};
vm.runInNewContext(compiled, { exports: exportsObj, String });
const { classifyFailureRecovery } = exportsObj;

test('classifyFailureRecovery provides non-retryable warning on timeouts/brightness and actionable hints on transient errors', () => {
  const timeout = classifyFailureRecovery('win.calculator.launch', 'No confirmation within 30 seconds. The action may still finish.');
  assert.equal(timeout.retryable, false);
  assert.match(timeout.hint, /already responded/i);

  const brightness = classifyFailureRecovery('win.brightness.set', 'Display brightness controls are unsupported.');
  assert.equal(brightness.retryable, false);
  assert.match(brightness.hint, /built-in laptop panels/i);

  const audio = classifyFailureRecovery('win.volume.set', 'No audio endpoint available');
  assert.equal(audio.retryable, true);
  assert.match(audio.hint, /playback device/i);

  const screenshot = classifyFailureRecovery('win.screenshot', 'Windows screenshot failed');
  assert.equal(screenshot.retryable, true);
  assert.match(screenshot.hint, /unlocked/i);
});
