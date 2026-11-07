'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { WinAppsController } = require('../electron/automation/winAppsController.cjs');

test('empty network response is not misreported as connected', async () => {
  const win = new WinAppsController(async () => ({stdout: ' on '}));
  const result = await win.getNetworkIp();
  assert.equal(result.success, false);
  assert.equal(result.verified, false);
  assert.match(result.error, /IPv4/);
});

test('network info is confirmed only when Windows supplied a real IPv4 address', async () => {
  const win = new WinAppsController(async () => ({stdout: '192.168.0.5 on Wi-Fi'}));
  const result = await win.getNetworkIp();
  assert.equal(result.success, true);
  assert.equal(result.verified, true);
});

test('a failed clipboard clear cannot report success', async () => {
  const win = new WinAppsController(async () => ({stdout: 'COMPANIO_CLIPBOARD_NOT_EMPTY'}));
  const result = await win.clearClipboard();
  assert.equal(result.success, false);
  assert.equal(result.verified, false);
});

test('clipboard is cleared only when a post-write readback confirms it', async () => {
  let script;
  const win = new WinAppsController(async value => {
    script = value;
    return {stdout: 'COMPANIO_CLIPBOARD_EMPTY'};
  });
  const result = await win.clearClipboard();
  assert.equal(result.success, true);
  assert.equal(result.verified, true);
  assert.match(script, /Get-Clipboard/);
});

test('incomplete hardware info is rejected', async () => {
  const win = new WinAppsController(async () => ({stdout: ' |  | 0GB RAM'}));
  const result = await win.getSystemSpecs();
  assert.equal(result.success, false);
  assert.equal(result.verified, false);
});

test('no detected battery does not assert AC power or charging', async () => {
  const win = new WinAppsController(async () => ({stdout: 'No battery was reported by Windows; charging state is unknown'}));
  const result = await win.getBatteryStatus();
  assert.equal(result.success, true);
  assert.doesNotMatch(result.message, /plugged into AC/i);
  assert.match(result.message, /unknown/);
});

test('media play and pause are rejected rather than blindly toggling playback', async () => {
  let calls = 0;
  const win = new WinAppsController(async () => { calls++; return {stdout: ''}; });
  const play = await win.controlMedia('play');
  const pause = await win.controlMedia('pause');
  assert.equal(play.success, false);
  assert.equal(pause.success, false);
  assert.equal(calls, 0);
});

test('sent media keys and Show Desktop requests remain explicitly unverified', async () => {
  const win = new WinAppsController(async () => ({stdout: ''}));
  const next = await win.controlMedia('next');
  assert.equal(next.success, true);
  assert.equal(next.verified, false);
  const desktop = await win.showDesktop();
  assert.equal(desktop.success, true);
  assert.equal(desktop.verified, false);
});

test('the unsafe Alt+N minimization shortcut is disabled', async () => {
  let calls = 0;
  const win = new WinAppsController(async () => { calls++; return {stdout: ''}; });
  const result = await win.minimizeActiveWindow();
  assert.equal(result.success, false);
  assert.equal(result.verified, false);
  assert.equal(calls, 0);
});
