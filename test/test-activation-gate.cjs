'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {createActivationGate}=require('../electron/automation/activationGate.cjs');
test('shortcut requests before renderer ready are delivered once after hydration',()=>{
 let count=0;const gate=createActivationGate(()=>{count++;});
 gate.activate();gate.activate();gate.activate();
 assert.equal(count,0);assert.equal(gate.isReady(),false);
 gate.markReady();assert.equal(count,1);assert.equal(gate.isReady(),true);
 gate.activate();assert.equal(count,2);
});
test('recreating the overlay discards wake requests from its old renderer',()=>{
 let count=0;const gate=createActivationGate(()=>{count++;});
 gate.activate();gate.reset();gate.markReady();assert.equal(count,0);
 gate.reset();gate.activate();gate.markReady();assert.equal(count,1);
 gate.markReady();assert.equal(count,1);
});
test('preload, React readiness and native IPC are integrated',()=>{
 const root=path.join(__dirname,'..');
 const app=fs.readFileSync(path.join(root,'src/App.tsx'),'utf8');
 const bridge=fs.readFileSync(path.join(root,'src/services/desktopBridge.ts'),'utf8');
 const preload=fs.readFileSync(path.join(root,'electron/preload.cjs'),'utf8');
 const main=fs.readFileSync(path.join(root,'electron/main.cjs'),'utf8');
 assert.match(app,/desktopBridge\.notifyOverlayReady\(\)/);
 assert.match(preload,/ipcRenderer\.invoke\('overlay-ready'\)/);
 assert.match(bridge,/notifyOverlayReady/);
 assert.match(main,/secureHandle\('overlay-ready'/);
 assert.match(main,/overlayActivation\.activate\(\)/);
});
