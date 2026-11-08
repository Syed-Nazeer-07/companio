'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const source = fs.readFileSync(path.join(__dirname,'../src/services/companionCommands.ts'),'utf8');
const compiled = ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const exported={};
vm.runInNewContext(compiled,{exports:exported});
const parse=exported.parseCompanionCommand;

test('sleep, wake, hide and show are exact deliberate companion commands',()=>{
 for(const [query,kind] of [
  ['Go to sleep','sleep'],['Hey Companio, take a nap','sleep'],
  ['Companio, wake up','wake'],['Please wake up','wake'],
  ['Close Companio','hide'],['Hey Companio, hide the assistant','hide'],
  ['Open Companio','open'],['Summon the companion','open']
 ]) assert.equal(parse(query)?.kind,kind,query);
});

test('small directional commands are supported without arbitrary coordinates',()=>{
 for(const [query,dir] of [
  ['Move left','left'],['Move yourself a little right','right'],
  ['Companio, slide to the up','up'],['Please move the companion down slightly','down'],
 ]) {
  const parsed=parse(query); assert.equal(parsed?.kind,'move',query);
  assert.equal(parsed.direction,dir,query);
 }
});

test('questions, negatives, Windows commands and incidental phrases have no side effects',()=>{
 for(const query of [
  'Should I go to sleep?', 'I need to sleep soon','What does sleep mean?',
  'Do not go to sleep','Please do not close Companio','Close Notepad',
  'Open YouTube','How do I move Companio?','Move the cursor left',
  'Can you explain how to wake up early?','Where is the companion?'
 ]) assert.equal(parse(query),null,query);
});
