'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const ts=require('typescript');

const file=fs.readFileSync(path.join(__dirname,'../src/services/webCommandParser.ts'),'utf8');
const compiled=ts.transpileModule(file,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const moduleExports={};
vm.runInNewContext(compiled,{exports:moduleExports});
const {parseWebCommand}=moduleExports;

test('arbitrary public domains and explicit web addresses are recognized',()=>{
  for(const input of [
    'Open example.com',
    'Visit https://developer.mozilla.org/en-US/',
    'Please open www.youtube.com',
    'Go to github.com/Syed-Nazeer-07/companio',
    'Could you open reddit.com/r/programming?'
  ]){
    const result=parseWebCommand(input);
    assert.equal(result?.tool,'browser.open_url',input);
    assert.equal(typeof result.params.url,'string');
  }
});

test('general web searches use the default browser instead of a controlled Edge profile',()=>{
  for(const q of [
    'Search for Python DSA',
    'Search the web for React tutorial',
    'Look up Stanford admission requirements'
  ]){
    const result=parseWebCommand(q);
    assert.equal(result?.tool,'browser.search_google',q);
    assert.ok(result.params.query.length>3);
  }
});

test('conversational and malformed requests are not executable URL commands',()=>{
  for(const q of [
    'What is github.com?', 'Do not open example.com',
    'Open Notepad', 'Open file:///private', 'Open javascript:alert(1)',
    'Open https://user:pass@example.com', 'Search wikipedia for people',
    'Open localhost:8000', 'Visit website.com and delete all files'
  ]) assert.equal(parseWebCommand(q),null,q);
});

test('common site names resolve locally without inventing destinations',()=>{
  for(const [query,expected] of [
    ['Open Instagram','https://www.instagram.com'],
    ['Visit Stack Overflow','https://stackoverflow.com'],
    ['Open LeetCode','https://leetcode.com'],
    ['Open Google Drive','https://drive.google.com'],
    ['Open Python documentation','https://docs.python.org/3/'],
    ['Open Wikipedia','https://www.wikipedia.org']
  ]){
    const result=parseWebCommand(query);
    assert.equal(result?.tool,'browser.open_url',query);
    assert.equal(result.params.url,expected,query);
  }
  assert.equal(parseWebCommand('Open unknown random website'),null);
});
