'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { validateProposal, proposeActions } = require('../electron/automation/localActionPlanner.cjs');

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