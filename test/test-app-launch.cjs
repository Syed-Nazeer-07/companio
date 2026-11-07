'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { launchVerifiedApp } = require('../electron/automation/appLaunchController.cjs');

test('desktop app launch succeeds only after the named process is found', async () => {
  let script;
  const result = await launchVerifiedApp('notepad', async value => {
    script = value;
    return { stdout: 'COMPANIO_PROCESS_RUNNING' };
  });
  assert.equal(result.success, true);
  assert.equal(result.verified, true);
  assert.match(script, /Start-Process -FilePath 'notepad.exe'/);
  assert.match(script, /Get-Process -Name 'notepad'/);
});

test('missing process and failed process checks never claim success', async () => {
  const notFound = await launchVerifiedApp('chrome', async () => ({ stdout: 'COMPANIO_PROCESS_NOT_FOUND' }));
  assert.equal(notFound.success, false);
  assert.equal(notFound.verified, false);
  assert.match(notFound.error, /process could not be confirmed/);
  const error = await launchVerifiedApp('edge', async () => { throw Error('not installed'); });
  assert.equal(error.success, false);
  assert.match(error.error, /not installed/);
});

test('arbitrary commands cannot become process names or launch arguments', async () => {
  let runs = 0;
  const malicious = await launchVerifiedApp('notepad; Remove-Item -Recurse C:\\', async () => {
    runs++;
    return { stdout: 'COMPANIO_PROCESS_RUNNING' };
  });
  assert.equal(malicious.success, false);
  assert.equal(runs, 0);
});

test('Chrome remains Chrome (no silent switch to another browser)', async () => {
  let script;
  await launchVerifiedApp('chrome', async s => { script = s; return {stdout: 'COMPANIO_PROCESS_NOT_FOUND'}; });
  assert.match(script, /'chrome.exe'/);
  assert.doesNotMatch(script, /msedge|edge.exe/i);
});
