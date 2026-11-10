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
  require(name) {
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
