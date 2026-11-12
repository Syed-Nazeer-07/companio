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
const exports = {};
vm.runInNewContext(transpiled,{exports,Math,Number});
const { createSpeechActivityTracker } = exports;
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
