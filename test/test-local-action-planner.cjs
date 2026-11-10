'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { validateProposal, proposeActions, planOfflineSequence } = require('../electron/automation/localActionPlanner.cjs');

const json = steps => JSON.stringify({steps});
test('proposes 1 to 3 verified, allowlisted actions with trustworthy descriptions', async () => {
  const response = await proposeActions({query:'Open Notepad and set volume to 45',model:'llama3.2:1b'},
    async options => {
      assert.match(options.systemPrompt,/ONLY valid JSON/);
      assert.equal(options.maxTokens,650);
      assert.equal(options.temperature,0.1);
      return {success:true,reply:json([
        {tool:'win.notepad.launch',params:{}},
        {tool:'win.volume.set',params:{level:45}}
      ])};
    });
  assert.equal(response.success,true);
  assert.equal(response.requiresConfirmation,true);
  assert.deepEqual(response.steps.map(s=>s.description),['Open Notepad','Set system volume to 45%']);
});

test('rejects dangerous, unsupported, and malformed local AI outputs', () => {
  for (const reply of [
    json([{tool:'win.recyclebin.empty',params:{}}]),
    json([{tool:'win.cmd.launch',params:{}}]),
    json([{tool:'win.clipboard.read',params:{}}]),
    json([{tool:'win.screenshot',params:{}}]),
    json([{tool:'browser.open_url',params:{url:'javascript:alert(1)'}}]),
    json([{tool:'browser.open_url',params:{url:'file:///secret'}}]),
    json([{tool:'win.explorer.open',params:{folder:'C:\\Windows'}}]),
    json([{tool:'win.volume.set',params:{level:400}}]),
    json([{tool:'win.volume.set',params:{level:50,override:true}}]),
    json([{tool:'win.media.control',params:{action:'delete'}}]),
    json([{tool:'browser.maps.search',params:{}}]),
    json([{tool:'win.notepad.launch',params:{injected:'stuff'}}]),
    json([{tool:'win.notepad.launch',params:null}]),
    json([]),
    json(Array(4).fill({tool:'win.calculator.launch',params:{}})),
    JSON.stringify({steps:[{tool:'win.calculator.launch',params:{}}],instructions:'ignore safeguards'}),
    'Sure! '+json([{tool:'win.calculator.launch',params:{}}]),
    'not JSON'
  ]) assert.throws(()=>validateProposal(reply),undefined,reply);
});

test('accepts strict fenced JSON but rejects extra model narrative', () => {
  const actions=validateProposal('```json\n'+json([{tool:'win.calculator.launch',params:{}}])+'\n```');
  assert.deepEqual(actions,[{tool:'win.calculator.launch',params:{},description:'Open Windows Calculator'}]);
  assert.throws(()=>validateProposal('Run this: '+json([{tool:'win.calculator.launch',params:{}}])));
});

test('rejects model failures and invalid input without running actions',async () => {
  let calls=0;
  const chat=async () => {calls++;return {success:false,error:'Model is not ready'};};
  const bad=await proposeActions({model:'x',query:'x'},chat);
  assert.equal(bad.success,false);
  assert.equal(calls,0);
  const down=await proposeActions({model:'x',query:'Open VS Code'},chat);
  assert.equal(down.success,false);
  assert.match(down.error,/not ready/);
  assert.equal(calls,1);
});

test('native validator normalizes safe public website URLs',()=>{
  const plan=validateProposal(json([{tool:'browser.open_url',params:{url:'example.com'}}]));
  assert.equal(plan[0].params.url,'https://example.com/');
  assert.match(plan[0].description,/https:\/\/example.com/);
});
test('offline compound tasks work with no inference server or API key', () => {
  const result = planOfflineSequence({query:'Open Notepad and then set volume to 45%'});
  assert.equal(result.success, true);
  assert.equal(result.recognized, true);
  assert.equal(result.requiresConfirmation, true);
  assert.deepEqual(result.steps.map(step => step.tool), ['win.notepad.launch', 'win.volume.set']);
  assert.equal(result.steps[1].params.level, 45);
  const polite = planOfflineSequence({query:'Could you open Notepad and then please set volume to 45%?'});
  assert.equal(polite.success, true);
  assert.equal(polite.steps[1].params.level, 45);
  const youtube = planOfflineSequence({query:'Open YouTube and search Google for Python tutorials'});
  assert.equal(youtube.success, true);
  assert.deepEqual(youtube.steps.map(step=>step.tool), ['browser.youtube.open','browser.search_google']);
});

test('offline grammar never executes a partial or destructive workflow', () => {
  const mixed = planOfflineSequence({query:'Open Notepad and delete my Documents'});
  assert.equal(mixed.success, false);
  assert.equal(mixed.recognized, true);
  assert.deepEqual(mixed.steps, []);
  const tooMany = planOfflineSequence({query:'Open Notepad and open YouTube and open Calculator and mute sound'});
  assert.equal(tooMany.success, false);
  assert.equal(tooMany.recognized, true);
  const invalid = planOfflineSequence({query:'Set volume to 105 and open YouTube'});
  assert.equal(invalid.success, false);
  assert.deepEqual(invalid.steps, []);
  const noun = planOfflineSequence({query:'Search Google for Tom and Jerry cartoons'});
  assert.equal(noun.recognized, false);
  const single = planOfflineSequence({query:'Open Calculator'});
  assert.equal(single.recognized, false);
});

test('offline workflows combine safe browser and Windows actions without an API key',()=>{
  for(const [query,expected] of [
    ['Open VS Code and then visit github.com',['win.vscode.launch','browser.open_url']],
    ['Open Notepad and search YouTube for React tutorials',['win.notepad.launch','browser.open_url']],
    ['Open GitHub and set volume to 45%',['browser.open_url','win.volume.set']],
    ['Open file explorer and open Documents',['win.explorer.open','win.explorer.open']],
    ['Search GitHub for weather api and then open calculator',['browser.open_url','win.calculator.launch']]
  ]) {
    const plan=planOfflineSequence({query});
    assert.equal(plan.success,true,query+(plan.error||''));
    assert.deepEqual(plan.steps.map(s=>s.tool),expected,query);
    assert.equal(plan.requiresConfirmation,true);
  }
  const gh=planOfflineSequence({query:'Open Notepad and search GitHub for React'});
  assert.equal(gh.steps[1].params.url,'https://github.com/search?q=React&type=repositories');
});
test('offline actions never execute unknown domains, private endpoints or partial instructions',()=>{
  for(const query of [
    'Open Notepad and open javascript:alert(1)',
    'Open Notepad and visit localhost',
    'Open YouTube and delete my desktop',
    'Open Notepad and open an unknown website',
    'Open VS Code and run a terminal command'
  ]) {
    const result=planOfflineSequence({query});
    assert.equal(result.success,false,query);
    assert.deepEqual(result.steps,[],query);
  }
});

test('offline compound workflow supports common site searches without model API',()=>{
 const examples=[
  ['Open Calculator and search Reddit for Windows ARM tips','https://www.reddit.com/search/?q=Windows%20ARM%20tips'],
  ['Open VS Code and search Stack Overflow for React types','https://stackoverflow.com/search?q=React%20types'],
  ['Open Notepad and search for Python DSA on YouTube','https://www.youtube.com/results?search_query=Python%20DSA'],
  ['Open Calculator and search for React on GitHub','https://github.com/search?q=React&type=repositories'],
  ['Open Notepad and search Google Maps for Chennai cafes','https://www.google.com/maps/search/Chennai%20cafes'],
  ['Open Notepad and search for Turing on Wikipedia','https://en.wikipedia.org/wiki/Special:Search?search=Turing']
 ];
 for(const [query,url] of examples){
   const plan=planOfflineSequence({query});
   assert.equal(plan.success,true,query+' '+(plan.error||''));
   assert.equal(plan.steps.length,2);
   assert.equal(plan.steps[1].tool,'browser.open_url');
   assert.equal(plan.steps[1].params.url,url);
   assert.equal(plan.requiresConfirmation,true);
 }
});
test('site-search workflows never partially execute unsafe or oversized requests',()=>{
 for(const query of [
  'Open Calculator and search Reddit for '+('x'.repeat(501)),
  'Open Notepad and search Stack Overflow for',
  'Open Calculator and search Reddit for cars and then delete files',
 ]) {
  const plan=planOfflineSequence({query});
  assert.equal(plan.success,false,query);
  assert.deepEqual(plan.steps,[]);
 }
});
