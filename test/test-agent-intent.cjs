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
const webCommands={};
vm.runInNewContext(transpile('src/services/webCommandParser.ts'),{exports:webCommands});
const arithmetic={};
vm.runInNewContext(transpile('src/services/arithmetic.ts'),{exports:arithmetic});
let offlineCalls=0;
const engineExports={};
vm.runInNewContext(transpile('src/services/agentEngine.ts'),{
  exports:engineExports,
  require: function load(name) {
    if (['./taskPlanner','./taskExecutor','./taskVerification','./conversationContext','./memoryRetrieval','./failureRecovery'].includes(name)) {
      const moduleExports={};
      const moduleSource=fs.readFileSync(path.join(__dirname,'../src/services',name.slice(2)+'.ts'),'utf8');
      const compiled=ts.transpileModule(moduleSource,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
      vm.runInNewContext(compiled,{exports:moduleExports,require:load,Date,Math,Number,Array,Error,AbortController,Promise,setTimeout,clearTimeout,console});
      return moduleExports;
    }
    if(name==='./intentSafety') return safe;
    if(name==='./webCommandParser') return webCommands;
    if(name==='./arithmetic') return arithmetic;
    if(name==='./desktopBridge') return {desktopBridge:{
      planOfflineSequence:async()=>{offlineCalls++;return {success:false,recognized:false,steps:[]};},
      planLocalActions:async()=>({success:false,error:'Model not running'})
    }};
    if(name==='./dbService') return {dbService:{}};
    throw Error('Unexpected import '+name);
  },
  Date,Math,Number,Array,Error,AbortController,setTimeout,clearTimeout
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

test('named Google Home is a deterministic browser request, not an AI chat response',async()=>{
  const plan=await engine.planTask('Open Google');
  assert.equal(plan.steps.length,1);
  assert.equal(plan.steps[0].tool,'browser.open_url');
  assert.equal(plan.steps[0].params.url,'https://www.google.com');
  assert.match(plan.steps[0].verification,/not verified/);
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

test('a latest-video command requests creator-channel verification', async () => {
  const latest=await engine.planTask('Play the latest video from Veritasium');
  assert.equal(latest.steps[0].tool,'browser.youtube.search_and_play');
  assert.equal(latest.steps[0].params.creator,'Veritasium');
  assert.equal(latest.steps[0].params.latest,true);
  const carry=await engine.planTask('Play CarryMinati new video');
  assert.equal(carry.steps[0].tool,'browser.youtube.latest_known');
  assert.equal(Object.keys(carry.steps[0].params).length,0);
});

test('normal site URLs and general web searches plan default browser actions without a model',async()=>{
  for(const [query,url] of [
    ['Open github.com/Syed-Nazeer-07/companio','github.com/Syed-Nazeer-07/companio'],
    ['Visit https://developer.mozilla.org','https://developer.mozilla.org'],
    ['Please open www.wikipedia.org','www.wikipedia.org']
  ]){
    const p=await engine.planTask(query);
    assert.equal(p.steps.length,1,query);
    assert.equal(p.steps[0].tool,'browser.open_url',query);
    assert.equal(p.steps[0].params.url,url,query);
  }
  const search=await engine.planTask('Search for React TypeScript tutorial');
  assert.equal(search.steps[0].tool,'browser.search_google');
  assert.equal(search.steps[0].params.query,'React TypeScript tutorial');
});

test('spoken wake-name commands run only explicit safe browser actions',async()=>{
  const search=await engine.planTask('Hey Companio, search Google for Python DSA');
  assert.equal(search.steps[0].tool,'browser.search_google');
  assert.equal(search.steps[0].params.query,'Python DSA');
  const site=await engine.planTask('Companio, open Khan Academy');
  assert.equal(site.steps[0].tool,'browser.open_url');
  assert.equal(site.steps[0].params.url,'https://www.khanacademy.org');
  for (const query of [
    'Hey Companio, what is Khan Academy?',
    'Hey Companio, do not open YouTube',
    'Companio, should I search for Python?'
  ]) {
    const result=await engine.planTask(query);
    assert.equal(result.steps.length,0,query);
    assert.equal(result.intent,'conversation',query);
  }
});

test('explicit YouTube and GitHub searches plan one default-browser handoff',async()=>{
  const yt=await engine.planTask('Search YouTube for Python DSA');
  assert.equal(yt.steps.length,1);
  assert.equal(yt.steps[0].tool,'browser.open_url');
  assert.equal(yt.steps[0].params.url,'https://www.youtube.com/results?search_query=Python%20DSA');
  const gh=await engine.planTask('Search GitHub for react dashboard');
  assert.equal(gh.steps[0].tool,'browser.open_url');
  assert.equal(gh.steps[0].params.url,'https://github.com/search?q=react%20dashboard&type=repositories');
});

test('official website discovery is explicitly a search, never a fabricated open',async()=>{
  const p=await engine.planTask('Open the official website of SpaceX');
  assert.equal(p.steps.length,1);
  assert.equal(p.steps[0].tool,'browser.search_google');
  assert.equal(p.steps[0].params.query,'SpaceX official website');
});

test('exact creator latest video requests use verified default-browser handoff',async()=>{
 for(const request of [
  'Play CarryMinati new video',
  'Open the latest video from CarryMinati',
  'Watch CarryMinati latest video',
  'Play latest CarryMinati video'
 ]) {
  const plan=await engine.planTask(request);
  assert.equal(plan.steps.length,1,request);
  assert.equal(plan.steps[0].tool,'browser.youtube.latest_known',request);
  assert.match(plan.steps[0].verification,/playback not verified/i);
 }
 const other=await engine.planTask('Play the latest video from Veritasium');
 assert.equal(other.steps[0].tool,'browser.youtube.search_and_play');
});

test('note text is data even when it names a desktop operation', async()=>{
 const p=await engine.planTask('Remember that I should open Notepad and then empty the Recycle Bin');
 assert.equal(p.steps.length,1);assert.equal(p.steps[0].tool,'utility.notes.add');
 assert.match(p.steps[0].params.note,/open Notepad and then empty the Recycle Bin/);
 const q=await engine.planTask('Note: delete my notes later');
 assert.equal(q.steps[0].tool,'utility.notes.add');
});
test('recycle bin inspection does not become deletion',async()=>{
 await assert.rejects(engine.planTask('Open the Recycle Bin'),/explicitly request/);
 await assert.rejects(engine.planTask('Check the Recycle Bin'),/explicitly request/);
 const p=await engine.planTask('Please empty the Recycle Bin');
 assert.equal(p.steps[0].tool,'win.recyclebin.empty');
});
test('compound search requests do not silently drop a second action',async()=>{
 offlineCalls=0;
 await assert.rejects(engine.planTask('Search Google for Python and then open Notepad'),/not fully supported/);
 await assert.rejects(engine.planTask('Hey Companio, open Google and then set volume to 20%'),/not fully supported/);
 assert.equal(offlineCalls,2);
});
test('polite negative requests are conversational',async()=>{
 const p=await engine.planTask('Could you please not open Notepad?');
 assert.equal(p.steps.length,0);
});

test('search terms about the Recycle Bin remain harmless search queries',async()=>{
 const p=await engine.planTask('Search Google for Recycle Bin recovery');
 assert.equal(p.steps[0].tool,'browser.search_google');
});
test('context contains complete chat pairs, not commands or tool outcomes',()=>{
 const exports={};
 vm.runInNewContext(transpile('src/services/conversationContext.ts'),{exports,require(name){
  if(name==='./intentSafety')return safe;
  if(name==='./arithmetic')return arithmetic;
  if(name==='./memoryRetrieval'){const m={};vm.runInNewContext(transpile('src/services/memoryRetrieval.ts'),{exports:m});return m;}
  if(name==='./desktopBridge')return {desktopBridge:{}};
  if(name==='./dbService')return {dbService:{}};
  throw Error(name);
 }});
 const history=exports.recentConversation([
  {sender:'user',content:'I study computer science'},
  {sender:'companio',content:'Understood',status:'info'},
  {sender:'user',content:'Open Notepad'},
  {sender:'companio',content:'Opened',status:'success',taskPlan:{}},
  {sender:'user',content:'Unknown question'},
  {sender:'companio',content:'Unavailable',status:'error'},
  {sender:'user',content:'What did I say?'}
 ],'What did I say?');
 assert.deepEqual(JSON.parse(JSON.stringify(history)),[{role:'user',content:'I study computer science'},{role:'assistant',content:'Understood'}]);
});

test('math calculations stay conversational rather than launching Calculator and polite prefixes preserve creator names', async () => {
  const ctxExports = {};
  vm.runInNewContext(transpile('src/services/conversationContext.ts'), {
    exports: ctxExports,
    require(name) {
      if (name === './intentSafety') return safe;
      if (name === './arithmetic') return arithmetic;
      if (name === './memoryRetrieval') { const m = {}; vm.runInNewContext(transpile('src/services/memoryRetrieval.ts'), { exports: m }); return m; }
      if (name === './desktopBridge') return { desktopBridge: {} };
      if (name === './dbService') return { dbService: {} };
      throw Error(name);
    }
  });

  const mathPlan = await engine.planTask('calculate 25 * 4');
  assert.equal(mathPlan.intent, 'conversation');
  assert.equal(mathPlan.steps.length, 0);
  const barePlan = await engine.planTask('12 * 15');
  assert.equal(barePlan.intent, 'conversation');
  assert.equal(barePlan.steps.length, 0);
  const pctPlan = await engine.planTask('calculate 15% of 800');
  assert.equal(pctPlan.intent, 'conversation');
  assert.equal(pctPlan.steps.length, 0);
  assert.match(await ctxExports.generateConversationalResponse('calculate 25 * 4'), /100/);
  assert.match(await ctxExports.generateConversationalResponse('calculate 15% of 800'), /120/);
  assert.match(await ctxExports.generateConversationalResponse('12 * 15'), /180/);
  assert.match(await ctxExports.generateConversationalResponse('(45 + 15) / 3'), /20/);
  assert.match(await ctxExports.generateConversationalResponse('15% of 800'), /120/);
  assert.match(await ctxExports.generateConversationalResponse('sqrt(144)'), /12/);
  assert.equal(ctxExports.trySolveMathExpression('2026-11-26'), null);

  for (const vague of ['Adjust the computer', 'Open an app', 'Play something']) {
    const clarify = await engine.planTask(vague);
    assert.equal(clarify.intent, 'clarification', vague);
    assert.equal(clarify.clarificationNeeded, true, vague);
    assert.equal(clarify.steps.length, 0, vague);
  }

  const veritasium = await engine.planTask('Can you play the latest video from Veritasium?');
  assert.equal(veritasium.intent, 'browser.youtube.creator_latest');
  assert.equal(veritasium.steps[0].tool, 'browser.youtube.search_and_play');
  assert.deepEqual(JSON.parse(JSON.stringify(veritasium.steps[0].params)), { creator: 'Veritasium', latest: true });

  const carry = await engine.planTask('Hey Companio, play the latest video from CarryMinati');
  assert.equal(carry.intent, 'browser.youtube.latest_known');
  assert.equal(carry.steps[0].tool, 'browser.youtube.latest_known');
});

test('volume, brightness, folders, shell routing, and harmless conjunction searches parse accurately', async () => {
  const turnUp = await engine.planTask('turn up the volume');
  assert.equal(turnUp.steps[0].tool, 'win.volume.change');
  assert.equal(turnUp.steps[0].params.delta, 10);

  const turnDown = await engine.planTask('turn down the volume');
  assert.equal(turnDown.steps[0].tool, 'win.volume.change');
  assert.equal(turnDown.steps[0].params.delta, -10);

  const inc20 = await engine.planTask('increase volume by 20%');
  assert.equal(inc20.steps[0].tool, 'win.volume.change');
  assert.equal(inc20.steps[0].params.delta, 20);

  const dec15 = await engine.planTask('decrease volume by 15%');
  assert.equal(dec15.steps[0].tool, 'win.volume.change');
  assert.equal(dec15.steps[0].params.delta, -15);

  const bright50 = await engine.planTask('set brightness to 50');
  assert.equal(bright50.steps[0].tool, 'win.brightness.set');
  assert.equal(bright50.steps[0].params.level, 50);

  const brightUp20 = await engine.planTask('increase brightness by 20%');
  assert.equal(brightUp20.steps[0].tool, 'win.brightness.change');
  assert.equal(brightUp20.steps[0].params.delta, 20);

  await assert.rejects(engine.planTask('set brightness to 150%'), /0 and 100%/i);

  const docs = await engine.planTask('open my documents folder');
  assert.equal(docs.steps[0].tool, 'win.explorer.open');
  assert.equal(docs.steps[0].params.folder, 'documents');

  const deskFolder = await engine.planTask('open desktop folder');
  assert.equal(deskFolder.steps[0].tool, 'win.explorer.open');
  assert.equal(deskFolder.steps[0].params.folder, 'desktop');

  const pics = await engine.planTask('open pictures folder');
  assert.equal(pics.steps[0].tool, 'win.explorer.open');
  assert.equal(pics.steps[0].params.folder, 'pictures');

  const showDesk = await engine.planTask('show desktop');
  assert.equal(showDesk.steps[0].tool, 'win.desktop.show');

  const cmdPlan = await engine.planTask('open command prompt');
  assert.equal(cmdPlan.steps[0].tool, 'win.cmd.launch');

  const psPlan = await engine.planTask('open powershell');
  assert.equal(psPlan.steps[0].tool, 'win.powershell.launch');

  const termPlan = await engine.planTask('open windows terminal');
  assert.equal(termPlan.steps[0].tool, 'win.terminal.launch');

  const searchBackThen = await engine.planTask('Search Google for back then');
  assert.equal(searchBackThen.steps[0].tool, 'browser.search_google');
  assert.equal(searchBackThen.steps[0].params.query, 'back then');
});
