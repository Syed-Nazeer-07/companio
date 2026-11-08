'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript');
function load(file,stubs={}){
 const src=fs.readFileSync(path.join(__dirname,'../src/services',file),'utf8');
 const js=ts.transpileModule(src,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const out={};
 vm.runInNewContext(js,{exports:out,require:p=>stubs[p],Number,Error,RegExp});
 return out;
}
const safety=load('intentSafety.ts');
const commands=load('companionCommands.ts');
const {shouldAutoSubmitVoice:allow}=load('voiceAutoSend.ts',{
 './intentSafety':safety,'./companionCommands':commands
});
test('opt-in with genuinely high confidence supports conversation and reversible Companio controls',()=>{
 assert.equal(allow('How are you doing?',.95,true),true);
 assert.equal(allow('Go to sleep',.9,true),true);
 assert.equal(allow('Companio, move left',.9,true),true);
 assert.equal(allow('Hide Companio',.91,true),true);
});
test('never auto-send when turned off, uncertain, empty or unknown',()=>{
 assert.equal(allow('Go to sleep',.99,false),false);
 assert.equal(allow('How are you?',undefined,true),false);
 assert.equal(allow('How are you?',.71,true),false);
 assert.equal(allow('',.97,true),false);
 assert.equal(allow('hello\nopen notepad',.98,true),false);
});
test('native side effects, websites and multi-actions always need visible review',()=>{
 for(const query of [
  'Open YouTube', 'Search for Python tutorials', 'Open Notepad',
  'Move the cursor left','Set volume to 80%', 'Close Calculator',
  'Open Google and then delete files'
 ]) {
  assert.equal(allow(query,.99,true),false,query);
 }
});
