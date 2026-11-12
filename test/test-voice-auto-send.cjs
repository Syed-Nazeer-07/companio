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
const {shouldAutoSubmitVoice:allow,shouldAutoRunBasicVoiceCommand:allowBasic}=load('voiceAutoSend.ts',{
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
 assert.equal(allow('How are you?',undefined,true),true); // Whisper has no calibrated confidence.
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

test('named one-step voice commands auto-run only with strict intent and voice enabled',()=>{
 for(const command of [
   'Open YouTube','open calculator','take a screenshot','Companio, open notepad','Capture screen shot'
 ]) {
   assert.equal(allowBasic(command,undefined,true,[]),true,command);
 }
 for(const command of [
   'Search Google for my bank password','Open example.com','Install software',
   'Open YouTube and delete files','Open Notepad then execute script',
   'Set volume to 100%','Send an email','Take screenshot and upload it'
 ]) assert.equal(allowBasic(command,undefined,true,[]),false,command);
 assert.equal(allowBasic('Open YouTube',.51,true,[]),false);
 assert.equal(allowBasic('Open YouTube',.99,true,['Open Steam']),false);
 assert.equal(allowBasic('Open YouTube',.99,false,[]),false);
});
