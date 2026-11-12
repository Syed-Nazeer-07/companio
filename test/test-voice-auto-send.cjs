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
const {shouldAutoSubmitVoice:allow,shouldAutoRunBasicVoiceCommand:allowBasic,canonicalBasicVoiceCommand:canonical}=load('voiceAutoSend.ts',{
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

test('natural voice variations are mapped to exact safe planner commands',()=>{
 const examples = [
  ['Please open YouTube','Open YouTube'],
  ['Can you open the YouTube?','Open YouTube'],
  ['Hey Companio, please launch the calculator','Open Calculator'],
  ['Could you start Windows Notepad?','Open Notepad'],
  ['Companion open the file explorer','Open File Explorer'],
  ['Please take a screenshot','Take a screenshot'],
  ['Capture my screen','Take a screenshot'],
  ['take ss','Take a screenshot'],
  ['Please grab a screenshot now','Take a screenshot'],
  ['Could you take a screenshot for me','Take a screenshot'],
  ['Screenshot please','Take a screenshot'],
  ['Open VS Code','Open VS Code'],
  ['Launch Visual Studio Code','Open VS Code']
 ];
 for(const [input,expected] of examples) {
   assert.equal(canonical(input,undefined,true,[]),expected,input);
 }
});
test('voice never auto-executes uncertain or compound instructions',()=>{
 for(const text of [
  'Open YouTube and uninstall Windows',
  'Please open an arbitrary website',
  'Launch calculator then delete my files',
  'Start the malware installer',
  'Save my screen and upload it',
  'Open GitHub\nDelete repository',
  'Can you open Google and search for personal data',
  'Grab a screenshot and upload it',
  'Please open VS Code and execute a script'
 ]) assert.equal(canonical(text,undefined,true,[]),null,text);
 assert.equal(canonical('Open YouTube',NaN,true,[]),null);
 assert.equal(canonical('Open YouTube',1.5,true,[]),null);
 assert.equal(canonical('Open YouTube',.6,true,[]),null);
 assert.equal(canonical('Open YouTube',undefined,false,[]),null);
 assert.equal(canonical('Open YouTube',.9,true,['Open Notepad']),null);
});
