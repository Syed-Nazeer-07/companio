'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { VolumeController } = require('../electron/automation/volumeController.cjs');

test('reads the real volume and mute state, not a fabricated 50% fallback', async () => {
  const good = new VolumeController(async () => ({ stdout: '18|False' }));
  assert.deepEqual(await good.getVolume(), { success: true, volume: 18, muted: false, verified: true });

  const down = new VolumeController(async () => { throw Error('no audio endpoint'); });
  const result = await down.getVolume();
  assert.equal(result.success, false);
  assert.equal(result.verified, false);
  assert.equal(result.volume, null);

  const invalid = new VolumeController(async () => ({ stdout: 'not a reading' }));
  assert.equal((await invalid.getVolume()).success, false);
});

test('never guesses a volume from an unavailable Windows endpoint', async () => {
  let calls = 0;
  const win = new VolumeController(async () => { calls++; throw Error('device unavailable'); });
  const result = await win.changeVolume(10);
  assert.equal(result.success, false);
  assert.match(result.error, /could not be read/);
  assert.equal(calls, 1);
});

test('changes volume only after a verified reading and verifies new level', async () => {
  let calls = 0;
  const win = new VolumeController(async () => {
    calls++;
    return { stdout: calls === 1 ? '80|false' : '90' };
  });
  const result = await win.changeVolume(10);
  assert.equal(result.success, true);
  assert.equal(result.volume, 90);
  assert.equal(calls, 2);
});

test('failed writes are not reported as success', async () => {
  const unchanged = new VolumeController(async () => ({ stdout: '12' }));
  const set = await unchanged.setVolume(80);
  assert.equal(set.success, false);
  assert.equal(set.verified, false);
  const mute = await unchanged.setMute(true);
  assert.equal(mute.success, false);
  assert.equal(mute.verified, false);
});

test('mute result reflects the verified Windows state', async () => {
  const muted = new VolumeController(async () => ({ stdout: 'True' }));
  assert.equal((await muted.setMute(true)).success, true);
  assert.equal((await muted.setMute(false)).success, false);
  const bad = new VolumeController(async () => ({ stdout: 'unknown' }));
  assert.equal((await bad.setMute(true)).success, false);
});

test('invalid arguments never reach PowerShell', async () => {
  let calls = 0;
  const win = new VolumeController(async () => { calls++; return { stdout: '50' }; });
  assert.equal((await win.setVolume(Number.NaN)).success, false);
  assert.equal((await win.setMute('yes')).success, false);
  assert.equal((await win.changeVolume(101)).success, false);
  assert.equal(calls, 0);
});