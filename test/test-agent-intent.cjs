'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function transpile(relative) {
  return ts.transpileModule(fs.readFileSync(path.join(__dirname,'..',relative),'utf8'),{
    compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}
  }).outputText;
}
const safe={};
vm.runInNewContext(transpile('src/services/intentSafety.ts'),{exports:safe});
let offlineCalls=0;
const engineExports={};
vm.runInNewContext(transpile('src/services/agentEngine.ts'),{
  exports:engineExports,
  require(name) {
    if(name==='./intentSafety') return safe;
    if(name==='./desktopBridge') return {desktopBridge:{
      planOfflineSequence:async()=>{offlineCalls++;return {success:false,recognized:false,steps:[]};},
      planLocalActions:async()=>({success:false,error:'Model not running'})
    }};
    if(name==='./dbService') return {dbService:{}};
    throw Error('Unexpected import '+name);
  },
  Date,Math,Number,Array,Error,AbortController
});
const engine=new engineExports.AgentEngine();
engine.generateConversationalResponse=async()=>'I can explain that.';

test('informational questions never trigger a Windows or browser action',async()=>{
  for(const query of ['What is Notepad?','Tell me about ChatGPT','Who is CarryMinati?',
    'What is the volume of a sphere?','How can I use VS Code?',
    'Do not open YouTube','Should I mute system sound?']) {
    const result=await engine.planTask(query);
    assert.equal(result.steps.length,0,query);
    assert.equal(result.intent,'conversation',query);
  }
});

test('explicit single actions still produce a legitimate plan',async()=>{
  const notepad=await engine.planTask('Open Notepad');
  assert.equal(notepad.steps[0].tool,'win.notepad.launch');
  const browser=await engine.planTask('Please open YouTube');
  assert.equal(browser.steps[0].tool,'browser.youtube.open');
  const louder=await engine.planTask('Volume up');
  assert.equal(louder.steps[0].tool,'win.volume.change');
  assert.equal(louder.steps[0].params.delta,10);
  const quieter=await engine.planTask('Lower volume');
  assert.equal(quieter.steps[0].params.delta,-10);
});

test('volume changes require an explicit safe level instead of guessing 50%',async()=>{
  const level=await engine.planTask('Set volume to 45%');
  assert.equal(level.steps[0].params.level,45);
  await assert.rejects(engine.planTask('Set volume'),/Specify a volume level/);
  await assert.rejects(engine.planTask('Set volume to 150%'),/between 0 and 100/);
});

test('unsupported two-step commands never execute just the first instruction',async()=>{
  offlineCalls=0;
  await assert.rejects(
    engine.planTask('Open YouTube and ask it to summarize my email'),
    /not fully supported/
  );
  assert.equal(offlineCalls,1);
});

test('conjunctions inside a search term are not mistaken for multi-step commands',async()=>{
  offlineCalls=0;
  await engine.planTask('Search Google for Tom and Jerry');
  assert.equal(offlineCalls,0);
});
