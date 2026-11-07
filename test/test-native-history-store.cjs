'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { NativeHistoryStore } = require('../electron/automation/nativeHistoryStore.cjs');

function withStore(callback) {
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'companio-native-history-'));
  try { return callback(new NativeHistoryStore(path.join(dir,'history.json'))); }
  finally { fs.rmSync(dir,{recursive:true,force:true}); }
}

test('native history retains messages, notes and logs after reopening the file', () => withStore(store => {
  assert.equal(store.load().exists,false);
  const timestamp=Date.UTC(2026,10,8);
  assert.equal(store.mutate({kind:'add-message',record:{id:'m1',sender:'user',content:'Hello',timestamp,status:'info'}}).success,true);
  assert.equal(store.mutate({kind:'add-note',record:'Check GitHub CI'}).success,true);
  assert.equal(store.mutate({kind:'add-log',record:{
    id:'l1',timestamp,tool:'win.notepad.launch',params:'{}',result:'{"success":true}',verified:true,durationMs:50
  }}).success,true);
  const reopened = new NativeHistoryStore(store.filePath).load();
  assert.equal(reopened.success,true);
  assert.equal(reopened.backup.conversations[0].content,'Hello');
  assert.deepEqual(reopened.backup.notes,['Check GitHub CI']);
  assert.equal(reopened.backup.automationLogs[0].tool,'win.notepad.launch');
}));

test('native history clear and replace have explicit bounded outcomes', () => withStore(store => {
  const timestamp=Date.UTC(2026,10,8);
  store.mutate({kind:'add-message',record:{id:'m1',sender:'user',content:'Hello',timestamp,status:'info'}});
  assert.equal(store.mutate({kind:'clear-messages'}).success,true);
  assert.equal(store.load().backup.conversations.length,0);
  const fresh={conversations:[],automationLogs:[],notes:['One']};
  assert.equal(store.mutate({kind:'replace',backup:fresh}).success,true);
  assert.deepEqual(store.load().backup.notes,['One']);
}));

test('corrupted files are never overwritten automatically', () => withStore(store => {
  fs.writeFileSync(store.filePath,'{corrupt data','utf8');
  assert.equal(store.load().success,false);
  assert.equal(store.mutate({kind:'add-note',record:'Hello'}).success,false);
  assert.equal(fs.readFileSync(store.filePath,'utf8'),'{corrupt data');
}));

test('invalid history mutations cannot touch the native file', () => withStore(store => {
  for(const operation of [
    {kind:'erase-drive'},
    {kind:'add-message',record:{sender:'bad',timestamp:'yesterday'}},
    {kind:'add-note',record:{text:'No'}},
    {kind:'replace',backup:{settings:{apiKey:'secret'}}},
    {kind:'add-note',record:'abc',unexpected:'unsafe'}
  ]) assert.equal(store.mutate(operation).success,false);
  assert.equal(fs.existsSync(store.filePath),false);
}));

test('all history data is capped before writing', () => withStore(store => {
  const timestamp=Date.UTC(2026,10,8);
  for(let i=0;i<105;i++){
    assert.equal(store.mutate({kind:'add-message',record:{id:'m'+i,sender:'user',content:'hey',timestamp,status:'info'}}).success,true);
  }
  const all=store.load().backup.conversations;
  assert.equal(all.length,100);
  assert.equal(all[0].id,'m5');
}));
