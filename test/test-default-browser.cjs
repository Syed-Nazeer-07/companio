'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {DefaultBrowserController}=require('../electron/automation/defaultBrowserController.cjs');

test('opens in Windows default browser and verifies only the OS handoff',async()=>{
  const calls=[];
  const browser=new DefaultBrowserController({openExternal: async (...args)=>calls.push(args)});
  const url=await browser.open('example.com');
  assert.equal(url.success,true);
  assert.equal(url.verified,true);
  assert.equal(url.handoffOnly,true);
  assert.equal(url.verificationScope,'windows-handoff');
  assert.match(url.message,/not been verified/);
  assert.equal(calls[0][0],'https://example.com/');
  assert.deepEqual(calls[0][1],{activate:true});
});

test('arbitrary website addresses and default-browser search URLs are encoded safely',async()=>{
  const opened=[];
  const browser=new DefaultBrowserController({openExternal:async url=>opened.push(url)});
  await browser.open('https://example.org/path?q=hello');
  await browser.searchGoogle('react & C++ tutorials');
  await browser.searchWikipedia('Ada Lovelace');
  await browser.searchMaps('Chennai central');
  assert.equal(opened[0],'https://example.org/path?q=hello');
  assert.ok(opened[1].includes('react%20%26%20C%2B%2B%20tutorials'));
  assert.ok(opened[2].includes('Ada%20Lovelace'));
  assert.ok(opened[3].includes('Chennai%20central'));
});

test('invalid URLs and failed shell calls cannot report success',async()=>{
  let calls=0;
  const browser=new DefaultBrowserController({openExternal:async()=>{calls++;throw Error('No browser registered')}});
  const bad=await browser.open('javascript:alert(1)');
  assert.equal(bad.success,false);
  assert.equal(calls,0);
  for(const url of ['file:///etc/passwd','https://user:pass@example.com']) {
    assert.equal((await browser.open(url)).verified,false);
  }
  const unavailable=await browser.open('https://example.com');
  assert.equal(unavailable.success,false);
  assert.match(unavailable.error,/No browser registered/);
  assert.equal(calls,1);
});
