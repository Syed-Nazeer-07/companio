'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../src/services/speechActivity.ts'), 'utf8');
const transpiled = ts.transpileModule(source,{
 compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}
}).outputText;
const moduleExports = {};
vm.runInNewContext(transpiled,{exports:moduleExports,Math,Number});
const { createSpeechActivityTracker } = moduleExports;
test('quiet speech is detected without rejecting low-energy microphones',()=>{
 const sample=createSpeechActivityTracker();
 assert.equal(sample(0.0052,250).detected,false);
 assert.equal(sample(0.0051,340).detected,true);
 assert.equal(sample(0.004,1650).stop,false);
 assert.equal(sample(0.004,2150).stop,true);
});
test('short pauses are permitted rather than truncating speech',()=>{
 const sample=createSpeechActivityTracker();
 sample(0.02,100);sample(0.02,200);
 assert.equal(sample(0.001,1300).stop,false);
 assert.equal(sample(0.01,1400).stop,false);
 assert.equal(sample(0.02,1500).detected,true);
 assert.equal(sample(0.001,3300).stop,true);
});
test('silent recordings end and recordings never run indefinitely',()=>{
 const silent=createSpeechActivityTracker();
 assert.equal(silent(0.001,6499).stop,false);
 assert.equal(silent(0.001,6500).stop,true);
 const long=createSpeechActivityTracker();
 long(0.01,100);long(0.01,200);
 assert.equal(long(0.01,14000).stop,true);
 assert.equal(long(Number.NaN,16000).stop,true);
});

test('sparse energetic syllables keep a recognized phrase alive until a real pause', () => {
 const sample = createSpeechActivityTracker();
 assert.equal(sample(0.01, 100).detected, false);
 assert.equal(sample(0.01, 200).detected, true);
 // Each new syllable is just one frame above threshold, separated by quiet.
 // Once speech started, these should refresh the last-voice timestamp even
 // though they do not form a new two-frame detection pair.
 for (const time of [400, 850, 1300, 1750, 2200, 2650]) {
   assert.equal(sample(0.008, time).stop, false, 'speech at ' + time + 'ms');
   assert.equal(sample(0.001, time + 90).stop, false, 'short gap at ' + time + 'ms');
 }
 assert.equal(sample(0.001, 4449).stop, false);
 assert.equal(sample(0.001, 4450).stop, true);
});
