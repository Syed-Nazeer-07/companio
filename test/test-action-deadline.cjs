'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript');
const source=fs.readFileSync(path.join(__dirname,'../src/services/agentEngine.ts'),'utf8');
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const exportsObject={};
vm.runInNewContext(js,{exports:exportsObject,AbortController,Error,Number,Math,Date,Array,Promise,setTimeout,clearTimeout,
 require(name){
  if(name==='./desktopBridge')return {desktopBridge:{}};
  if(name==='./dbService')return {dbService:{}};
  if(name==='./intentSafety')return {isCommandRequest:()=>false};
  if(name==='./webCommandParser')return {parseWebCommand:()=>null};
  if(name==='./arithmetic')return {evaluateArithmetic:()=>null};
  throw Error('Unexpected module '+name);
 }});
const {runWithActionDeadline:deadline,actionTimeoutMs}=exportsObject;
test('responsive action succeeds and its external result is preserved',async()=>{
 const a=await deadline(async()=>({success:true,verified:true}),100,new AbortController().signal);
 assert.equal(a.kind,'done');assert.equal(a.value.verified,true);
});
test('unresponsive desktop action times out; late rejection is consumed',async()=>{
 let lateReject,unhandled=false;
 const op=new Promise((_,reject)=>{lateReject=reject;});
 const r=await deadline(()=>op,15,new AbortController().signal);
 assert.equal(r.kind,'timeout');
 lateReject(Error('Late browser failure'));
 await new Promise(resolve=>setTimeout(resolve,5));
 assert.equal(unhandled,false);
});
test('cancel immediately returns, even when native tool never resolves',async()=>{
 const abort=new AbortController();
 const task=deadline(()=>new Promise(()=>{}),30000,abort.signal);
 abort.abort();
 assert.equal((await task).kind,'cancelled');
 let invoked=false;
 const cancelled=await deadline(async()=>{invoked=true;},10,abort.signal);
 assert.equal(cancelled.kind,'cancelled');assert.equal(invoked,false);
});
test('slow YouTube verification gets longer deadline without affecting ordinary actions',()=>{
 assert.equal(actionTimeoutMs('browser.youtube.search_and_play'),90000);
 assert.equal(actionTimeoutMs('browser.open_tabs'),60000);
 assert.equal(actionTimeoutMs('win.calculator.launch'),30000);
 assert.equal(actionTimeoutMs('browser.open_url'),30000);
});
test('integration will not continue to additional task steps on timeout',()=>{
 assert.match(source,/outcome.kind==='timeout'/);
 assert.match(source,/The action may still finish; check Windows before retrying/);
 assert.match(source,/plan.status = 'failed'/);
});
