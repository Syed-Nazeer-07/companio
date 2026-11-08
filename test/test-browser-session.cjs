'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const os = require('node:os');
const { BrowserController } = require('../electron/automation/browserController.cjs');

function fakeBrowser() {
  const listeners = {};
  const pages = [];
  let created = 0;
  const context = {
    on: (name, listener) => { listeners[name] = listener; },
    pages: () => pages,
    newPage: async () => {
      created++;
      const page = { isClosed: () => false };
      pages.push(page);
      return page;
    }
  };
  return { context, pages, listeners, getCreated: () => created };
}

test('controlled browser starts with its private persistent Edge profile', async () => {
  const fake = fakeBrowser();
  const profile = path.join(os.tmpdir(), 'companio-test-browser');
  const calls = [];
  const chromiumImpl = {
    launchPersistentContext: async (directory, options) => {
      calls.push({ directory, options });
      return fake.context;
    },
    launch: () => { throw Error('ephemeral browser should never launch'); }
  };
  const controller = new BrowserController({ chromiumImpl });
  assert.throws(() => controller.configureProfileDirectory('relative/path'), /absolute/);
  controller.configureProfileDirectory(profile);
  const first = await controller.ensureBrowser();
  const second = await controller.ensureBrowser();
  assert.strictEqual(first, second);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].directory, profile);
  assert.equal(calls[0].options.channel, 'msedge');
  assert.equal(calls[0].options.headless, false);
  assert.equal(fake.getCreated(), 1);
  assert.throws(() => controller.configureProfileDirectory(profile), /running/);
});

test('existing tabs are reused instead of opening a blank tab', async () => {
  const fake = fakeBrowser();
  const existingPage = { isClosed: () => false };
  fake.pages.push(existingPage);
  const controller = new BrowserController({
    chromiumImpl: { launchPersistentContext: async () => fake.context },
    profileDirectory: path.join(os.tmpdir(), 'companio-test-browser')
  });
  assert.strictEqual(await controller.ensureBrowser(), existingPage);
  assert.equal(fake.getCreated(), 0);
});

test('concurrent first commands cannot launch the same profile twice', async () => {
  const fake = fakeBrowser();
  let launches = 0;
  const controller = new BrowserController({
    chromiumImpl: {
      launchPersistentContext: async () => {
        launches++;
        await Promise.resolve();
        return fake.context;
      }
    },
    profileDirectory: path.join(os.tmpdir(), 'companio-test-browser')
  });
  const [first, second] = await Promise.all([controller.ensureBrowser(), controller.ensureBrowser()]);
  assert.strictEqual(first, second);
  assert.equal(launches, 1);
});

test('closing the browser context permits a fresh persistent launch', async () => {
  const fake = fakeBrowser();
  let launches = 0;
  const controller = new BrowserController({
    chromiumImpl: { launchPersistentContext: async () => { launches++; return fake.context; } },
    profileDirectory: path.join(os.tmpdir(), 'companio-test-browser')
  });
  await controller.ensureBrowser();
  fake.listeners.close();
  assert.equal(controller.context, null);
  await controller.ensureBrowser();
  assert.equal(launches, 2);
});

test('Edge errors are returned honestly with remediation', async () => {
  const controller = new BrowserController({
    chromiumImpl: {
      launchPersistentContext: async () => { throw Error('profile already in use'); }
    },
    profileDirectory: path.join(os.tmpdir(), 'companio-test-browser')
  });
  await assert.rejects(() => controller.ensureBrowser(), /close any other window using the Companio browser profile/);
  assert.equal(controller.context, null);
});

test('newly opened tabs become the active page for later commands', async () => {
  const fake = fakeBrowser();
  const controller = new BrowserController({
    chromiumImpl: { launchPersistentContext: async () => fake.context },
    profileDirectory: path.join(os.tmpdir(), 'companio-test-browser')
  });
  const original = await controller.ensureBrowser();
  const newTab = { isClosed: () => false };
  fake.pages.push(newTab);
  fake.listeners.page(newTab);
  assert.notStrictEqual(original, newTab);
  assert.strictEqual(await controller.ensureBrowser(), newTab);
});
