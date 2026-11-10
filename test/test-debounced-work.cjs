'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {createDebouncedWork}=require('../electron/automation/debouncedWork.cjs');
function fakeTimers(){
 const timers=new Map();let current=0;
 return {
   timers,
   setTimeout(callback,ms){const id=++current;timers.set(id,{callback,ms});return id;},
   clearTimeout(id){timers.delete(id);},
   fire(){for(const [id,task] of [...timers]){timers.delete(id);task.callback();}}
 };
}
test('repeated drag events coalesce to a single disk write',()=>{
 const timers=fakeTimers();let writes=0;
 const d=createDebouncedWork(()=>{writes++;},180,timers);
 for(let i=0;i<140;i++)d.schedule();
 assert.equal(writes,0);assert.equal(timers.timers.size,1);
 timers.fire();assert.equal(writes,1);
 assert.equal(timers.timers.size,0);
});
test('flush saves immediately, cancellation never writes stale positions',()=>{
 const timers=fakeTimers();let writes=0;
 const d=createDebouncedWork(()=>{writes++;},180,timers);
 d.schedule();d.flush();timers.fire();assert.equal(writes,1);
 d.schedule();d.cancel();timers.fire();assert.equal(writes,1);
});
test('input errors are rejected before timers are registered',()=>{
 assert.throws(()=>createDebouncedWork(null),/Invalid/);
 assert.throws(()=>createDebouncedWork(()=>{},5000),/Invalid/);
});
test('native window saves movement after debounce and flushes on close',()=>{
 const main=fs.readFileSync(path.join(__dirname,'../electron/main.cjs'),'utf8');
 assert.match(main,/placementSaver\.schedule\(\)/);
 assert.match(main,/placementSaver\.flush\(\)/);
 assert.match(main,/placementSaver\.cancel\(\)/);
 assert.match(main,/savePosition\(x, y\)/);
});
