'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const source = fs.readFileSync(path.join(__dirname, '../src/services/dbService.ts'), 'utf8');
const transpiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
}).outputText;

const timestamp = Date.UTC(2026,10,8);
const backup = () => ({
  conversations: [{id:'m1',sender:'user',content:'Remember this',timestamp,status:'info'}],
  automationLogs: [{id:'l1',tool:'win.notepad.launch',timestamp,params:'{}',result:'{}',verified:true,durationMs:23}],
  notes:['A note']
});

function harness({native = false, load = async () => ({success:true,exists:false,backup:null}),
                  mutate = async () => ({success:true}), throwOnWrite = null} = {}) {
  const data=new Map([
    ['companio_chat_history',JSON.stringify([{id:'old',sender:'user',content:'Existing',timestamp}])],
    ['companio_automation_logs','[]'],
    ['companio_notes','["Keep old notes"]']
  ]);
  let writes=0;
  const storage = {
    getItem(key) {return data.has(key)?data.get(key):null;},
    setItem(key,value) {
      writes++;
      if(throwOnWrite && throwOnWrite(writes)) throw Error('Storage quota');
      data.set(key,String(value));
    },
    removeItem(key) {data.delete(key);}
  };
  const output={};
  const sqlMock = {
    Database: class {
      run() {}
    }
  };
  const env = {
    exports: output,
    require(name) {
      if(name==='sql.js') return {__esModule:true,default:async () => sqlMock};
      if(name.includes('sql-wasm.wasm')) return {__esModule:true,default:'bundled.wasm'};
      if(name==='./desktopBridge') return {
        desktopBridge: {loadHistoryStore:load,mutateHistoryStore:mutate},
        isNativeDesktop:() => native
      };
      throw Error('Unexpected module '+name);
    },
    localStorage: storage,
    console: {log() {},warn() {},error() {}},
    Date,
    JSON,
    Math,
    String,
    Number
  };
  vm.runInNewContext(transpiled,env,{filename:'dbService.compiled.cjs'});
  return {service:output.dbService,data};
}

test('successful restore replaces only history and notes, not settings', async () => {
  const h=harness();
  h.data.set('companio_settings',JSON.stringify({ai:{apiKey:'do not change'}}));
  const result=await h.service.restoreHistory(backup());
  assert.equal(result.success,true);
  assert.equal(JSON.parse(h.data.get('companio_chat_history'))[0].id,'m1');
  assert.equal(JSON.parse(h.data.get('companio_notes'))[0],'A note');
  assert.match(h.data.get('companio_settings'),/do not change/);
});

test('local storage quota failure rolls back every previous history value', async () => {
  const h=harness({throwOnWrite:write=>write===2});
  const before=new Map(h.data);
  const result=await h.service.restoreHistory(backup());
  assert.equal(result.success,false);
  for(const [key,value] of before) assert.equal(h.data.get(key),value);
});

test('native disk failure prevents reporting a successful restore and rolls back browser history', async () => {
  let called=false;
  const h=harness({native:true,mutate:async op=>{
    called=true;
    assert.equal(op.kind,'replace');
    return {success:false,error:'Disk is full'};
  }});
  const before=new Map(h.data);
  const result=await h.service.restoreHistory(backup());
  assert.equal(called,true);
  assert.equal(result.success,false);
  assert.match(result.error,/Disk is full/);
  for(const [key,value] of before) assert.equal(h.data.get(key),value);
});

test('startup loads the validated native disk copy instead of stale browser cache', async () => {
  let seeded=false;
  const h=harness({
    native:true,
    load: async () => ({success:true,exists:true,backup:backup()}),
    mutate: async () => {seeded=true;return {success:true};}
  });
  await h.service.init();
  assert.equal(seeded,false);
  assert.equal(h.service.getMessages()[0].id,'m1');
  assert.equal(h.service.getNotes()[0],'A note');
});

test('missing disk file is seeded once from existing browser storage', async () => {
  let seed;
  const h=harness({
    native:true,
    load:async () => seed
      ? {success:true,exists:true,backup:{conversations:seed.backup.conversations,automationLogs:[],notes:seed.backup.notes}}
      : {success:true,exists:false,backup:null},
    mutate:async operation => {seed=operation;return {success:true};}
  });
  await h.service.init();
  assert.equal(seed.kind,'seed');
  assert.equal(seed.backup.conversations[0].id,'old');
  assert.equal(h.service.getMessages()[0].id,'old');
});

test('concurrent initialization hydrates the native disk copy only once', async () => {
  let loads=0;
  const h=harness({
    native:true,
    load:async () => {
      loads++;
      await new Promise(resolve => setTimeout(resolve,20));
      return {success:true,exists:true,backup:backup()};
    }
  });
  await Promise.all([h.service.init(),h.service.init(),h.service.init()]);
  assert.equal(loads,1);
  assert.equal(h.service.getMessages()[0].id,'m1');
});

test('quick notes are reported saved only after the storage transaction succeeds',async()=>{
  const h=harness();
  const saved=await h.service.addNote('Review the ARM64 build');
  assert.equal(saved.success,true);
  assert.equal(saved.count,2);
  assert.deepEqual(h.service.getNotes(),['Keep old notes','Review the ARM64 build']);
  const clear=await h.service.clearNotes();
  assert.equal(clear.success,true);
  assert.deepEqual(h.service.getNotes(),[]);
});

test('a storage quota error does not claim a quick note was saved',async()=>{
  const h=harness({throwOnWrite:write=>write===2});
  const before=h.data.get('companio_notes');
  const result=await h.service.addNote('Important reminder');
  assert.equal(result.success,false);
  assert.equal(h.data.get('companio_notes'),before);
});

test('native disk failure prevents successful note creation and deletion',async()=>{
  const h=harness({
    native:true,
    mutate:async()=>({success:false,error:'Native disk unavailable'})
  });
  const before=h.data.get('companio_notes');
  const add=await h.service.addNote('Do not lose this');
  assert.equal(add.success,false);
  assert.match(add.error,/Native disk unavailable/);
  assert.equal(h.data.get('companio_notes'),before);
  const clear=await h.service.clearNotes();
  assert.equal(clear.success,false);
  assert.equal(h.data.get('companio_notes'),before);
});

test('quick notes reject empty and excessive content',async()=>{
  const h=harness();
  assert.equal((await h.service.addNote('  ')).success,false);
  assert.equal((await h.service.addNote('n'.repeat(4001))).success,false);
  assert.equal(h.service.getNotes().length,1);
});
