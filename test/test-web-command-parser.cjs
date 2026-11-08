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
    'Browse https://www.python.org',
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
    'Open https://user:pass@example.com',
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

test('spoken Companio wake prefixes and natural default-browser searches are parsed',()=>{
  const searches=[
    'Hey Companio, search Google for Python DSA',
    'Companio search on Google for Python DSA',
    'Okay Companio, search in my default browser for Python DSA',
    'Could you search the internet for Python DSA?'
  ];
  for (const command of searches) {
    const result=parseWebCommand(command);
    assert.equal(result?.tool,'browser.search_google',command);
    assert.equal(result.params.query,'Python DSA',command);
  }
  for (const [command,url] of [
    ['Companio, open Khan Academy','https://www.khanacademy.org'],
    ['Hey Companio, open Perplexity','https://www.perplexity.ai'],
    ['Visit MDN','https://developer.mozilla.org'],
    ['Open Google Calendar','https://calendar.google.com'],
    ['Open Figma','https://www.figma.com'],
    ['Open pypi','https://pypi.org']
  ]) {
    const result=parseWebCommand(command);
    assert.equal(result?.tool,'browser.open_url',command);
    assert.equal(result.params.url,url,command);
  }
  assert.equal(parseWebCommand('Hey Companio, do not open github.com'),null);
  assert.equal(parseWebCommand('Companio what is Khan Academy?'),null);
});

test('search specific sites immediately in the default browser',()=>{
  const expected=[
    ['Hey Companio, search YouTube for CarryMinati latest video','https://www.youtube.com/results?search_query=CarryMinati%20latest%20video'],
    ['Search on YouTube for Python DSA','https://www.youtube.com/results?search_query=Python%20DSA'],
    ['Search for React tutorials on YouTube','https://www.youtube.com/results?search_query=React%20tutorials'],
    ['Search Wikipedia for Alan Turing','https://en.wikipedia.org/wiki/Special:Search?search=Alan%20Turing'],
    ['Search on GitHub for project templates','https://github.com/search?q=project%20templates&type=repositories'],
    ['Search Reddit for ARM laptop reviews','https://www.reddit.com/search/?q=ARM%20laptop%20reviews'],
    ['Search Google Maps for Chennai cafes','https://www.google.com/maps/search/Chennai%20cafes'],
    ['Search Stack Overflow for Python async','https://stackoverflow.com/search?q=Python%20async'],
    ['Find videos about Windows 11 on YouTube','https://www.youtube.com/results?search_query=Windows%2011']
  ];
  for(const [query,url] of expected) {
    const result=parseWebCommand(query);
    assert.equal(result?.tool,'browser.open_url',query);
    assert.equal(result.params.url,url,query);
  }
});
test('site-specific navigation is never inferred from conversational mentions',()=>{
  for (const query of ['What videos are on YouTube?', 'Do not search YouTube for kittens','Should I search GitHub?','Where do I find tutorials?', 'Search GitHub for']) {
    assert.equal(parseWebCommand(query),null,query);
  }
});

test('common speech transcription of companion name works for direct website searches',()=>{
  const p=parseWebCommand('Hey companion, search on YouTube for CarryMinati');
  assert.equal(p?.tool,'browser.open_url');
  assert.equal(p.params.url,'https://www.youtube.com/results?search_query=CarryMinati');
  assert.equal(parseWebCommand('Hey companion, do not search YouTube for music'),null);
});
