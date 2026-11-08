'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { EventEmitter } = require('node:events');
const { PassThrough } = require('node:stream');
const { WhisperSpeechController, validateWave, safeSelection } = require('../electron/automation/whisperSpeech.cjs');

function wav(seconds = 1) {
  const n=seconds*16000*2;
  const b=Buffer.alloc(44+n);
  b.write('RIFF',0);b.writeUInt32LE(b.length-8,4);b.write('WAVEfmt ',8);
  b.writeUInt32LE(16,16);b.writeUInt16LE(1,20);b.writeUInt16LE(1,22);
  b.writeUInt32LE(16000,24);b.writeUInt32LE(32000,28);b.writeUInt16LE(2,32);b.writeUInt16LE(16,34);
  b.write('data',36);b.writeUInt32LE(n,40);return b;
}
function fixture(spawnProcess){
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'companio-whisper-test-'));
  const executable=path.join(dir,'whisper-cli.exe');
  const model=path.join(dir,'ggml-tiny.en.bin');
  fs.writeFileSync(executable,'stub');
  fs.writeFileSync(model,Buffer.alloc(10_000_001));
  const controller=new WhisperSpeechController({userData:dir,platform:'win32',spawnProcess});
  assert.equal(controller.choose('binary',executable).success,true);
  assert.equal(controller.choose('model',model).success,true);
  return {controller,dir};
}
function fakeChild(){
 const child=new EventEmitter();
 child.stdout=new PassThrough();child.stderr=new PassThrough();
 child.kill=()=>{child.killed=true;}; return child;
}
test('PCM recordings reject malformed headers, huge bytes, stereo, and truncation',()=>{
 assert.equal(validateWave(wav(1)).length,32044);
 for(const b of [Buffer.from('bad'),Buffer.alloc(16*1024*1024+1),(()=>{
  const x=wav();x.writeUInt16LE(2,22);return x;
 })(),(()=>{const x=wav();x.writeUInt32LE(500,40);return x;})()]) {
  assert.throws(()=>validateWave(b));
 }
});
test('only explicitly selected whisper-cli.exe and GGML model files are accepted',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'companio-whisper-select-'));
 try{
  const wrong=path.join(dir,'cmd.exe');fs.writeFileSync(wrong,'stub');
  assert.throws(()=>safeSelection('binary',wrong),/whisper-cli/);
  assert.throws(()=>safeSelection('model',wrong),/ggml/);
 } finally {fs.rmSync(dir,{recursive:true,force:true});}
});
test('unconfigured local model never spawns a process',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'companio-whisper-empty-'));
 try {
  const c=new WhisperSpeechController({userData:dir,platform:'win32',spawnProcess:()=>{throw Error('spawned');}});
  assert.equal(c.status().configured,false);
  const r=await c.transcribe(wav());
  assert.equal(r.success,false);assert.match(r.error,/Set up/);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('correct local inference reads verified output and deletes the temporary recording',async()=>{
 let args, options, child;
 const h=fixture((_command,a,o)=>{args=a;options=o;child=fakeChild();return child;});
 try{
  assert.equal(h.controller.status().configured,true);
  const running=h.controller.transcribe(wav(1));
  assert.equal(args[0],'-m');
  assert.ok(args.includes('-ng'));
  assert.ok(args.includes('-otxt'));
  assert.equal(options.shell,false);
  const prefix=args[args.indexOf('-of')+1];
  assert.equal(fs.existsSync(args[args.indexOf('-f')+1]),true);
  fs.writeFileSync(prefix+'.txt',' Open Notepad \n');
  child.emit('close',0);
  assert.deepEqual(await running,{success:true,text:'Open Notepad',language:'en'});
  assert.equal(fs.existsSync(prefix+'.txt'),false);
  assert.equal(h.controller.status().busy,false);
 }finally{fs.rmSync(h.dir,{recursive:true,force:true});}
});
test('cancellation suppresses late results and removes the captured microphone audio',async()=>{
 let child,recording;
 const h=fixture((_binary,args)=>{recording=args[args.indexOf('-f')+1];child=fakeChild();return child;});
 try{
  const running=h.controller.transcribe(wav());
  assert.equal(h.controller.cancel().cancelled,true);
  child.emit('close',0);
  const result=await running;
  assert.equal(result.success,false);assert.equal(result.cancelled,true);
  assert.equal(fs.existsSync(recording),false);
 }finally{fs.rmSync(h.dir,{recursive:true,force:true});}
});
