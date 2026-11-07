const test = require('node:test');
const assert = require('node:assert/strict');
const { allowPermissionRequest, allowPermissionCheck, validVolume, validPosition } = require('../electron/automation/securityPolicy.cjs');

test('media permissions are audio-only and origin-restricted', () => {
  assert.equal(allowPermissionRequest('media', { mediaTypes: ['audio'] }, true), true);
  assert.equal(allowPermissionRequest('media', { mediaTypes: ['video'] }, true), false);
  assert.equal(allowPermissionRequest('media', { mediaTypes: ['audio', 'video'] }, true), false);
  assert.equal(allowPermissionRequest('media', { mediaTypes: ['audio'] }, false), false);
  assert.equal(allowPermissionRequest('display-capture', {}, true), false);
  assert.equal(allowPermissionRequest('notifications', {}, true), true);
});
test('permission checks only accept trusted main-frame audio', () => {
  assert.equal(allowPermissionCheck('media', { mediaType: 'audio', isMainFrame: true }, true), true);
  assert.equal(allowPermissionCheck('media', { mediaType: 'video', isMainFrame: true }, true), false);
  assert.equal(allowPermissionCheck('media', { mediaType: 'audio', isMainFrame: false }, true), false);
  assert.equal(allowPermissionCheck('media', { mediaTypes: ['audio'], isMainFrame: true }, true), false);
  assert.equal(allowPermissionCheck('notifications', { isMainFrame: true }, false), false);
});
test('standalone volume and saved overlay coordinates are bounded', () => {
  assert.equal(validVolume(60), true);
  assert.equal(validVolume(Infinity), false);
  assert.equal(validVolume('60'), false);
  assert.equal(validVolume(-1), false);
  assert.equal(validPosition({x: -100, y: 500}), true);
  assert.equal(validPosition({x: NaN, y: 500}), false);
  assert.equal(validPosition({x: 2 ** 60, y: 500}), false);
});
