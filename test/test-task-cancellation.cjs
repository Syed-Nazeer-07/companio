'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const ts=require('typescript');
const source=fs.readFileSync(path.join(__dirname,'../src/services/agentEngine.ts'),'utf8');
const output=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;

function createEngine(executeTool) {
  const exports={};
  const logs=[];
  vm.runInNewContext(output,{
    exports,Date,Math,Array,Number,Error,AbortController,console,setTimeout,clearTimeout,
    require(name) {
      if(name==='./desktopBridge') return {desktopBridge:{executeTool}};
      if(name==='./dbService') return {dbService:{addLog:(...args)=>logs.push(args)}};
      if(name==='./intentSafety') return {isCommandRequest:()=>true};
      if(name==='./webCommandParser') return {parseWebCommand:()=>null};
      if(name==='./arithmetic') return {evaluateArithmetic:()=>null};
      throw Error('Unexpected import '+name);
    }
  },{filename:'agentEngine.compiled.cjs'});
  return {engine:new exports.AgentEngine(),logs};
}
function plan() {
  return {
    id:'test-plan',query:'Open Notepad and set volume',intent:'test',
    steps:[{id:'1',tool:'win.notepad.launch',description:'Notepad',params:{},status:'pending'},
      {id:'2',tool:'win.volume.set',description:'Volume',params:{level:45},status:'pending'}],
    status:'planning',currentStepIndex:0,createdAt:Date.now()
  };
}
test('cancelling a running request suppresses future desktop steps',async()=>{
  let resolveFirst;
  const calls=[];
  const {engine}=createEngine((tool)=>{
    calls.push(tool);
    return new Promise(resolve=>{ resolveFirst=resolve; });
  });
  const p=plan();
  const pending=engine.executePlan(p,()=>{});
  assert.equal(calls.length,1);
  assert.equal(engine.cancelActiveTask(),true);
  resolveFirst({success:true,verified:true});
  const result=await pending;
  assert.equal(result.status,'cancelled');
  assert.equal(calls.length,1);
  assert.equal(engine.cancelActiveTask(),false);
});

test('failure or normal completion releases the request controller',async()=>{
  const failed=createEngine(async()=>({success:false,verified:false,error:'No app'}));
  assert.equal((await failed.engine.executePlan(plan(),()=>{})).status,'failed');
  assert.equal(failed.engine.cancelActiveTask(),false);
  const ok=createEngine(async()=>({success:true,verified:true}));
  assert.equal((await ok.engine.executePlan(plan(),()=>{})).status,'completed');
  assert.equal(ok.engine.cancelActiveTask(),false);
});

test('overlapping execution is rejected and cannot replace the active controller',async()=>{
  let release;
  const calls=[];
  const {engine}=createEngine(tool=>{calls.push(tool);return new Promise(resolve=>{release=resolve;});});
  const first=engine.executePlan(plan(),()=>{});
  await assert.rejects(engine.executePlan(plan(),()=>{}),/Another task/);
  assert.equal(engine.cancelActiveTask(),true);
  release({success:true,verified:true});
  assert.equal((await first).status,'cancelled');
  assert.equal(calls.length,1);
});
test('an unverified action stops later steps and retains its actual outcome',async()=>{
  const {engine}=createEngine(async()=>({success:true,verified:false,message:'Requested'}));
  const snapshots=[];
  const result=await engine.executePlan(plan(),p=>snapshots.push(p));
  assert.equal(result.status,'failed');
  assert.equal(result.steps[0].result.verified,false);
  assert.equal(result.steps[1].status,'cancelled');
  assert.match(result.error,/1 remaining step/);
  assert.equal(snapshots[0].steps[0].status,'pending');
});
test('a completed plan cannot be replayed',async()=>{
  let calls=0;
  const {engine}=createEngine(async()=>{calls++;return {success:true,verified:true};});
  const p=await engine.executePlan(plan(),()=>{});
  await assert.rejects(engine.executePlan(p,()=>{}),/already started/);
  assert.equal(calls,2);
});
test('partial completion reports verified steps before a later failure',async()=>{
  let calls=0;
  const {engine}=createEngine(async()=>++calls===1?{success:true,verified:true}:{success:false,error:'Unavailable'});
  const result=await engine.executePlan(plan(),()=>{});
  assert.equal(result.status,'failed');
  assert.match(result.error,/1 earlier step\(s\) verified/);
});
