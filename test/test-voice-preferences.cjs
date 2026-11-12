'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript');
const source=fs.readFileSync(path.join(__dirname,'../src/services/voicePreferences.ts'),'utf8');
const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const exports={};
vm.runInNewContext(compiled,{exports});
const migrate=exports.migrateVoicePreferences;
test('old Windows default switches to auto for zero-config offline voice',()=>{
 const input={recognitionEngine:'windows',ttsRate:0.95};
 const result=migrate(input);
 assert.equal(result.recognitionEngine,'auto');
 assert.equal(result.ttsRate,0.95);
 assert.equal(input.recognitionEngine,'windows');
});
test('explicit Windows or Whisper preference is preserved',()=>{
 assert.equal(migrate({recognitionEngine:'windows',recognitionEngineExplicit:true}).recognitionEngine,'windows');
 assert.equal(migrate({recognitionEngine:'whisper'}).recognitionEngine,'whisper');
 assert.equal(migrate({recognitionEngine:'auto'}).recognitionEngine,'auto');
});
