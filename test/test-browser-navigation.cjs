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
  assert.deepEqual(
    verifyNavigation('https://www.google.com/maps/search/Paris', 'https://www.google.com/maps/place/Paris', 200),
    { success: true, verified: true, url: 'https://www.google.com/maps/place/Paris' }
  );
});

test('malformed or non-web addresses are never verified', () => {
  assert.equal(verifyNavigation('file:///secrets.txt', 'file:///secrets.txt', 200).success, false);
  assert.equal(verifyNavigation('not a URL', 'https://example.com', 200).success, false);
});

test('opening a site verifies the response immediately without waiting for DOM hydration', async () => {
  const { BrowserController } = require('../electron/automation/browserController.cjs');
  const controller = new BrowserController();
  let observedUrl = 'about:blank';
  const calls = [];
  controller.ensureBrowser = async () => ({
    goto: async (target, options) => {
      calls.push({target,options});
      observedUrl = target;
      return {status: () => 200};
    },
    url: () => observedUrl,
    title: async () => { throw Error('Full page hydration should not be required'); }
  });
  const youtube = await controller.openYouTube();
  assert.equal(youtube.success,true);
  assert.equal(youtube.verified,true);
  assert.match(youtube.message,/may still be loading/);
  const site = await controller.openUrl('https://github.com');
  assert.equal(site.success,true);
  assert.ok(calls.every(c=>c.options.waitUntil==='commit'));
  assert.ok(calls.every(c=>c.options.timeout===15000));
});

test('fast site navigation still refuses HTTP errors and untrusted redirects', async () => {
  const { BrowserController } = require('../electron/automation/browserController.cjs');
  const controller = new BrowserController();
  controller.ensureBrowser = async () => ({
    goto: async () => ({status:()=>503}),
    url: () => 'https://www.youtube.com/'
  });
  assert.equal((await controller.openYouTube()).success,false);
  controller.ensureBrowser = async () => ({
    goto: async () => ({status:()=>200}),
    url: () => 'https://youtube.com.evil.example/watch'
  });
  assert.equal((await controller.openYouTube()).verified,false);
});
