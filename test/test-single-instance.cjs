'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {EventEmitter}=require('node:events');
const fs=require('node:fs'),path=require('node:path');
const {registerSingleInstance}=require('../electron/automation/singleInstance.cjs');
function stub(lock){
 const app=new EventEmitter(); app.isReady=()=>true;
 app.requestSingleInstanceLock=()=>lock;
 app.quit=()=>{app.quitCount++;};app.quitCount=0;
 return app;
}
test('primary instance owns the tray and responds to second launches',()=>{
 const app=stub(true);let count=0;
 assert.equal(registerSingleInstance(app,()=>{count++;}),true);
 app.emit('second-instance');
 assert.equal(count,1);assert.equal(app.quitCount,0);
});
test('secondary instance exits without registering another activation handler',()=>{
 const app=stub(false);let count=0;
 assert.equal(registerSingleInstance(app,()=>{count++;}),false);
 app.emit('second-instance');assert.equal(count,0);assert.equal(app.quitCount,1);
});
test('activation is deferred until Electron app ready',()=>{
 const app=stub(true);let ready=false,calls=0;
 app.isReady=()=>ready;
 registerSingleInstance(app,()=>{calls++;});
 app.emit('second-instance');assert.equal(calls,0);
 ready=true;app.emit('second-instance');assert.equal(calls,1);
});
test('native integration guards startup and can recover missing overlay windows',()=>{
 const main=fs.readFileSync(path.join(__dirname,'../electron/main.cjs'),'utf8');
 assert.match(main,/registerSingleInstance\(app,/);
 assert.match(main,/if \(!primaryInstance\) return;/);
 assert.match(main,/function wakeCompanionWindow\(/);
 assert.match(main,/createOverlayWindow\(\)/);
});
