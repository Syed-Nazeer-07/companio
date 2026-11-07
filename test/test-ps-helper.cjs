'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { PassThrough } = require('node:stream');
const { runPowerShell } = require('../electron/automation/psHelper.cjs');

test('PowerShell helper does not open a separate foreground console window', async () => {
  let invoked;
  const script = "Write-Output 'Companio'";
  const fakeSpawn = (command, args, options) => {
    invoked = { command, args, options };
    const child = new EventEmitter();
    child.stdout = new PassThrough();
    child.stderr = new PassThrough();
    child.kill = () => {};
    process.nextTick(() => {
      child.stdout.write('Companio\n');
      child.emit('close', 0);
    });
    return child;
  };
  const output = await runPowerShell(script, 1000, fakeSpawn);
  assert.equal(output.stdout, 'Companio');
  assert.equal(invoked.command, 'powershell.exe');
  assert.equal(invoked.options.windowsHide, true);
  assert.ok(invoked.args.includes('-NoProfile'));
  const encodedIndex = invoked.args.indexOf('-EncodedCommand');
  assert.ok(encodedIndex >= 0);
  assert.equal(Buffer.from(invoked.args[encodedIndex + 1], 'base64').toString('utf16le'), script);
});

test('PowerShell failures are still reported, not converted to success', async () => {
  const fakeSpawn = () => {
    const child = new EventEmitter();
    child.stdout = new PassThrough();
    child.stderr = new PassThrough();
    child.kill = () => {};
    process.nextTick(() => {
      child.stderr.write('Access denied');
      child.emit('close', 1);
    });
    return child;
  };
  await assert.rejects(runPowerShell('invalid', 1000, fakeSpawn), /Access denied/);
});
