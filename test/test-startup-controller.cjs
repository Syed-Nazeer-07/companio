'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createStartupController, STARTUP_NAME } = require('../electron/automation/startupController.cjs');

function mockedApp() {
  let registered = false;
  let allowed = true;
  const calls = [];
  const app = {
    isPackaged: true,
    getLoginItemSettings(query) {
      calls.push({ op: 'read', query });
      return {
        openAtLogin: registered,
        executableWillLaunchAtLogin: registered && allowed,
        launchItems: registered ? [{
          name: STARTUP_NAME,
          path: 'C:\\Program Files\\Companio\\Companio.exe',
          enabled: allowed,
          args: [],
          scope: 'user'
        }] : []
      };
    },
    setLoginItemSettings(settings) {
      calls.push({ op: 'write', settings });
      registered = settings.openAtLogin;
      if (registered) allowed = settings.enabled;
    }
  };
  return { app, calls, disableInWindows: () => { allowed = false; } };
}
const executablePath='C:\\Program Files\\Companio\\Companio.exe';

test('startup is off by default and toggles via Windows login item APIs',()=>{
  const {app,calls}=mockedApp();
  const startup=createStartupController(app,{platform:'win32',executablePath});
  assert.deepEqual(startup.read(),{success:true,supported:true,enabled:false,blockedByWindows:false});
  assert.deepEqual(startup.setEnabled(true),{success:true,supported:true,enabled:true,blockedByWindows:false,verified:true});
  assert.deepEqual(startup.setEnabled(false),{success:true,supported:true,enabled:false,blockedByWindows:false,verified:true});
  const writes=calls.filter(x=>x.op==='write');
  assert.equal(writes.length,2);
  assert.equal(writes[0].settings.name,STARTUP_NAME);
  assert.equal(writes[0].settings.path,executablePath);
  assert.deepEqual(writes[0].settings.args,[]);
  assert.equal(writes[1].settings.openAtLogin,false);
  assert.deepEqual(calls.filter(x=>x.op==='read')[0].query,{path:executablePath,args:[]});
});

test('does not register startup from dev builds, smoke tests or other operating systems',()=>{
  for(const [platform,packaged,smoke] of [['linux',true,false],['win32',false,false],['win32',true,true]]) {
    const {app,calls}=mockedApp();
    app.isPackaged=packaged;
    const startup=createStartupController(app,{platform,executablePath,smokeTest:smoke});
    assert.equal(startup.read().supported,false);
    assert.equal(startup.setEnabled(true).success,false);
    assert.equal(calls.length,0);
  }
});

test('malformed IPC setting and permission errors never enable startup',()=>{
  const {app,calls}=mockedApp();
  const startup=createStartupController(app,{platform:'win32',executablePath});
  assert.equal(startup.setEnabled('yes').success,false);
  assert.equal(calls.filter(x=>x.op==='write').length,0);
  app.setLoginItemSettings=()=>{throw Error('Windows denied startup change')};
  const result=startup.setEnabled(true);
  assert.equal(result.success,false);
  assert.match(result.error,/denied/);
  assert.equal(result.enabled,false);
});

test('disabled Windows Startup Apps entry is reported disabled and can be re-enabled',()=>{
  const {app,disableInWindows}=mockedApp();
  const startup=createStartupController(app,{platform:'win32',executablePath});
  assert.equal(startup.setEnabled(true).success,true);
  disableInWindows();
  const disabled=startup.read();
  assert.equal(disabled.enabled,false);
  assert.equal(disabled.blockedByWindows,true);
  assert.equal(startup.setEnabled(true).verified,true);
});

test('failed OS read or unverifiable update never claims success',()=>{
  const {app}=mockedApp();
  const startup=createStartupController(app,{platform:'win32',executablePath});
  app.getLoginItemSettings=()=>{throw Error('Registry unavailable');};
  assert.equal(startup.read().success,false);
  assert.equal(startup.setEnabled(true).success,false);
  const mock=mockedApp().app;
  mock.setLoginItemSettings=()=>{}; // Windows silently declined to register
  const second=createStartupController(mock,{platform:'win32',executablePath});
  const result=second.setEnabled(true);
  assert.equal(result.success,false);
  assert.equal(result.verified,false);
  assert.equal(result.enabled,false);
});
