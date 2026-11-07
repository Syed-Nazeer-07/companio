'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { verifyNavigation } = require('../electron/automation/browserNavigationVerifier.cjs');

test('successful HTTP navigation is verified only on the requested host', () => {
  assert.equal(verifyNavigation('https://youtube.com/', 'https://www.youtube.com/', 200).success, true);
  assert.equal(verifyNavigation('http://example.com', 'https://example.com/', 301).success, true);
  assert.equal(verifyNavigation('https://example.com', 'http://example.com', 200).success, false);
});

test('HTTP failures and login-domain redirects do not fabricate page success', () => {
  assert.equal(verifyNavigation('https://example.com', 'https://example.com', 404).success, false);
  assert.equal(verifyNavigation('https://example.com', 'https://example.com', 503).success, false);
  assert.equal(verifyNavigation('https://gmail.com', 'https://accounts.google.com/signin', 200).success, false);
  assert.equal(verifyNavigation('https://example.com', 'https://example.com', null).success, false);
});

test('strict navigation verifies requested page path and query', () => {
  assert.equal(verifyNavigation('https://github.com/example/repo', 'https://github.com/', 200, true).success, false);
  assert.equal(verifyNavigation('https://google.com/search?q=python', 'https://www.google.com/search?q=python&source=hp', 200, true).success, true);
  assert.equal(verifyNavigation('https://google.com/search?q=python', 'https://google.com/search?q=javascript', 200, true).success, false);
});

test('non-strict navigation allows search result page redirects within the same website', () => {
  assert.equal(
    verifyNavigation('https://www.google.com/maps/search/Paris', 'https://www.google.com/maps/place/Paris', 200),
    { success: true, verified: true, url: 'https://www.google.com/maps/place/Paris' }
  );
});

test('malformed or non-web addresses are never verified', () => {
  assert.equal(verifyNavigation('file:///secrets.txt', 'file:///secrets.txt', 200).success, false);
  assert.equal(verifyNavigation('not a URL', 'https://example.com', 200).success, false);
});
