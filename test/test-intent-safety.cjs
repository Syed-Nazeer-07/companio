'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const original = fs.readFileSync(path.join(__dirname,'../src/services/intentSafety.ts'),'utf8');
const output={};
vm.runInNewContext(
  ts.transpileModule(original,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,
  {exports:output}
);
const {isCommandRequest} = output;

test('natural requests trigger explicit actions',()=>{
  for (const query of [
    'Open YouTube','please open Notepad','Can you open Chrome?',
    'Could you search Google for Python tutorials?',
    'Set volume to 45%', 'volume down','mute system volume',
    'Play the new CarryMinati video','show my notes','what is my battery status?',
    'Where is Chennai?','Take a screenshot','remember that the deadline is Monday',
    'start a 25 minute focus timer'
  ]) assert.equal(isCommandRequest(query),true,query);
});

test('questions and casual mentions never launch desktop actions',()=>{
  for (const query of [
    'What is Notepad?','Who is CarryMinati?','Explain Spotify',
    'Tell me about ChatGPT','How can I use Gemini?',
    'I love watching YouTube','Can you tell me about Google Chrome?',
    'What is the volume of a sphere?','Is my system safe?',
    'Why is my Windows laptop slow?','What is the newest YouTube video?',
    'Should I download VS Code?','Do not open Spotify',
    "Please don't open YouTube",'Never clear my notes',
    'What are the benefits of Python?'
  ]) assert.equal(isCommandRequest(query),false,query);
});

test('only well-bounded requests reach the keyword planner',()=>{
  assert.equal(isCommandRequest(''),false);
  assert.equal(isCommandRequest('x'.repeat(1201)),false);
  assert.equal(isCommandRequest('notepad'),true);
});
