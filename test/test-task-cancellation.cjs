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
    require: function load(name) {
    if (['./taskPlanner','./taskExecutor','./taskVerification','./conversationContext','./memoryRetrieval'].includes(name)) {
      const moduleExports={};
      const moduleSource=fs.readFileSync(path.join(__dirname,'../src/services',name.slice(2)+'.ts'),'utf8');
      const compiled=ts.transpileModule(moduleSource,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
      vm.runInNewContext(compiled,{exports:moduleExports,require:load,Date,Math,Number,Array,Error,AbortController,Promise,setTimeout,clearTimeout,console});
      return moduleExports;
    }
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

test('cancelled native call keeps its lease until the underlying operation settles',async()=>{
 let release,calls=0;
 const {engine,logs}=createEngine(()=>{calls++;return new Promise(resolve=>{release=resolve;});});
 const first=engine.executePlan(plan(),()=>{});
 assert.equal(engine.cancelActiveTask(),true);
 const result=await first;
 assert.equal(result.status,'cancelled');
 assert.equal(result.steps[0].result.outcomeUnknown,true);
 assert.equal(logs.length,1);
 await assert.rejects(engine.executePlan(plan(),()=>{}),/previous Windows action/);
 assert.equal(calls,1);
 release({success:true,verified:true});
 await Promise.resolve();
 const next=engine.executePlan(plan(),()=>{});
 assert.equal(calls,2);
 engine.cancelActiveTask();release({success:true,verified:true});
 await next;
});
test('native exceptions leave a failed audit record',async()=>{
 const {engine,logs}=createEngine(async()=>{throw Error('IPC failure');});
 const result=await engine.executePlan(plan(),()=>{});
 assert.equal(result.status,'failed');
 assert.equal(logs.length,1);
 assert.equal(logs[0][2].error,'IPC failure');
 assert.equal(logs[0][3],false);
});

test('completion report uses actual native result, not inferred values',async()=>{
 const {engine}=createEngine(async()=>({success:true,verified:true,message:'Volume limited to 30% by Windows'}));
 const p=plan();p.steps=[p.steps[1]];
 const result=await engine.executePlan(p,()=>{});
 assert.equal(result.finalMessage,'Volume limited to 30% by Windows');
});
test('mixed verified actions and launch handoffs are distinguished in the report',async()=>{
 const {engine}=createEngine(async(tool)=>tool==='win.notepad.launch'?{success:true,verified:true,handoffOnly:true,message:'Request sent'}:{success:true,verified:true,message:'Volume is 45%'});
 const result=await engine.executePlan(plan(),()=>{});
 assert.equal(result.status,'completed');
 assert.match(result.finalMessage,/1 verified; 1 handed off/);
 assert.match(result.finalMessage,/destination unverified/);
 assert.match(result.finalMessage,/Volume is 45%/);
});

test('pomodoro requests notification permission when default and tracks timer handle safely', async () => {
  const executorSource = fs.readFileSync(path.join(__dirname, '../src/services/taskExecutor.ts'), 'utf8');
  const compiledExecutor = ts.transpileModule(executorSource, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  }).outputText;

  let requestedPermission = false;
  let scheduledMs = null;
  let clearedTimer = false;
  const fakeNotification = function () {};
  fakeNotification.permission = 'default';
  fakeNotification.requestPermission = async () => {
    requestedPermission = true;
    return 'granted';
  };

  const fakeHandle = { id: 'pomodoro-handle' };
  const fakeSetTimeout = (fn, ms) => {
    scheduledMs = ms;
    return fakeHandle;
  };
  const fakeClearTimeout = handle => {
    if (handle === fakeHandle) clearedTimer = true;
  };

  const executorExports = {};
  const verificationSource = fs.readFileSync(path.join(__dirname, '../src/services/taskVerification.ts'), 'utf8');
  const compiledVerification = ts.transpileModule(verificationSource, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  }).outputText;
  const verificationExports = {};
  vm.runInNewContext(compiledVerification, { exports: verificationExports, Date, Math, Array, Number, Error, Promise });

  vm.runInNewContext(compiledExecutor, {
    exports: executorExports,
    Date, Math, Array, Number, Error, AbortController, Promise, Set, console,
    setTimeout: fakeSetTimeout,
    clearTimeout: fakeClearTimeout,
    Notification: fakeNotification,
    require: name => {
      if (name === './desktopBridge') return { desktopBridge: { executeTool: async () => ({}) } };
      if (name === './dbService') return { dbService: { addLog: () => {} } };
      if (name === './taskVerification') return verificationExports;
      throw Error('Unexpected import ' + name);
    }
  });

  const executor = new executorExports.TaskExecutor();
  const pomodoroPlan = {
    id: 'pom-1',
    query: 'start a 10 minute focus session',
    intent: 'utility.pomodoro.start',
    steps: [{ id: '1', tool: 'utility.pomodoro.start', description: 'Focus', params: { minutes: 10 }, status: 'pending' }],
    status: 'planning',
    currentStepIndex: 0,
    createdAt: Date.now()
  };

  const res = await executor.executePlan(pomodoroPlan, () => {});
  assert.equal(requestedPermission, true);
  assert.equal(res.status, 'completed');
  assert.equal(scheduledMs, 10 * 60 * 1000);
  assert.equal(executor.activePomodoroTimers.has(fakeHandle), true);

  for (const h of executor.activePomodoroTimers) fakeClearTimeout(h);
  executor.activePomodoroTimers.clear();
  assert.equal(clearedTimer, true);
});
