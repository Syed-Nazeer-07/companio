const test = require('node:test');
const assert = require('node:assert/strict');
const { validateToolRequest, validateShortcut } = require('../electron/automation/requestValidation.cjs');
test('valid native requests', () => {
  assert.equal(validateToolRequest({toolName:'win.volume.set',params:{level:60}}).success,true);
  assert.equal(validateToolRequest({toolName:'win.calculator.launch',params:{}}).success,true);
  assert.equal(validateToolRequest({toolName:'browser.open_url',params:{url:'example.com'}}).params.url,'https://example.com/');
});
test('reject dangerous native inputs', () => {
  for (const r of [
    {toolName:'win.volume.set',params:{level:'0; calc'}},
    {toolName:'win.brightness.change',params:{delta:'0; Remove-Item'}},
    {toolName:'win.explorer.open',params:{folder:'C:\\Temp\nStart-Process calc'}},
    {toolName:'win.calculator.launch',params:{other:'ignored'}},
    {toolName:'browser.open_url',params:{url:'javascript:alert(1)'}},
    {toolName:'browser.open_url',params:{url:'file:///C:/Windows'}},
    {toolName:'browser.open_tabs',params:{urls:Array(11).fill('example.com')}},
    {toolName:'win.volume.mute',params:{mute:'false'}}
  ]) assert.equal(validateToolRequest(r).success,false,JSON.stringify(r));
});
test('hotkeys require safe chords', () => {
  assert.equal(validateShortcut('Ctrl+Shift+Space').shortcut,'CommandOrControl+Shift+Space');
  assert.equal(validateShortcut('Ctrl+Alt+K').shortcut,'CommandOrControl+Alt+K');
  assert.equal(validateShortcut('Space').success,false);
  assert.equal(validateShortcut('Ctrl+Alt+K+L').success,false);
});
