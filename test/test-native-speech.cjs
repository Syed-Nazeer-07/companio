'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { PassThrough } = require('node:stream');
const { NativeSpeechRecognizer } = require('../electron/automation/nativeSpeech.cjs');

function fakeChild() {
  const child = new EventEmitter();
  child.stdout = new PassThrough();
  child.stderr = new PassThrough();
  child.kill = () => { child.killed = true; };
  return child;
}
const encoded = s => Buffer.from(s, 'utf8').toString('base64');

test('native recognizer uses hidden encoded PowerShell, and returns an actual transcript', async () => {
  let spawnArgs;
  const child = fakeChild();
  const recognizer = new NativeSpeechRecognizer((command, args, options) => {
    spawnArgs = {command, args, options};
    return child;
  });
  const pending = recognizer.recognizeOnce(6);
  assert.equal(spawnArgs.command, 'powershell.exe');
  assert.equal(spawnArgs.options.windowsHide, true);
  const index = spawnArgs.args.indexOf('-EncodedCommand');
  assert.ok(index >= 0);
  const script = Buffer.from(spawnArgs.args[index + 1], 'base64').toString('utf16le');
  assert.match(script, /System\.Speech\.Recognition/);
  assert.match(script, /FromSeconds\(6\)/);
  process.nextTick(() => {
    child.stdout.write('SPEECH_RESULT_B64:' + encoded('Open Notepad') + '\n');
    child.emit('close', 0);
  });
  assert.deepEqual(await pending, {success:true,text:'Open Notepad'});
  assert.equal(recognizer.activeRequest, null);
});

test('concurrent recognition is refused, and cancellation prevents late transcripts', async () => {
  const child = fakeChild();
  let spawns=0;
  const recognizer = new NativeSpeechRecognizer(() => {spawns++;return child;});
  const first = recognizer.recognizeOnce();
  const second = await recognizer.recognizeOnce();
  assert.equal(second.success, false);
  assert.equal(spawns, 1);
  assert.equal(recognizer.cancel().cancelled,true);
  child.stdout.write('SPEECH_RESULT_B64:' + encoded('Delete everything') + '\n');
  child.emit('close', 0);
  assert.deepEqual(await first,{success:false,cancelled:true,error:'Listening cancelled.'});
  assert.equal(recognizer.cancel().cancelled,false);
});

test('recognition errors, silence, and invalid input are distinct from success', async () => {
  for (const output of [
    ['SPEECH_SILENCE',{success:true,silence:true,text:''}],
    ['SPEECH_ERROR_B64:' + encoded('No speech recognizer installed'),null],
    ['',null]
  ]) {
    const child=fakeChild();
    const recognizer=new NativeSpeechRecognizer(() => child);
    const pending=recognizer.recognizeOnce(5);
    process.nextTick(() => {child.stdout.write(output[0]+'\n');child.emit('close',0);});
    const result=await pending;
    if (output[1]) assert.deepEqual(result,output[1]);
    else assert.equal(result.success,false);
  }
  const recognizer=new NativeSpeechRecognizer(() => {throw Error('must not spawn');});
  for (const timeout of [0,16,1.5,NaN,'6']) {
    assert.equal((await recognizer.recognizeOnce(timeout)).success,false);
  }
});

test('a failed or missing PowerShell executable gives a useful error', async () => {
  const recognizer = new NativeSpeechRecognizer(() => {throw Error('ENOENT');});
  const result = await recognizer.recognizeOnce();
  assert.equal(result.success,false);
  assert.match(result.error,/ENOENT/);
});

test('child process failures settle a single time', async () => {
  const child=fakeChild();
  const recognizer=new NativeSpeechRecognizer(() => child);
  const pending=recognizer.recognizeOnce();
  process.nextTick(() => {
    child.emit('error',new Error('microphone unavailable'));
    child.emit('close',1);
  });
  const result=await pending;
  assert.equal(result.success,false);
  assert.match(result.error,/microphone unavailable/);
});

test('native recognizer chooses installed English locale and exposes confidence when Windows reports it', async () => {
  let script;
  const child=fakeChild();
  const recognizer=new NativeSpeechRecognizer((_command,args)=>{
    script=Buffer.from(args[args.indexOf('-EncodedCommand')+1],'base64').toString('utf16le');
    return child;
  });
  const pending=recognizer.recognizeOnce(6,'en-IN');
  assert.match(script,/InstalledRecognizers/);
  assert.match(script,/GetCultureInfo\("en-IN"\)/);
  assert.match(script,/SPEECH_CONFIDENCE/);
  process.nextTick(()=>{
    child.stdout.write('SPEECH_LOCALE:en-US\nSPEECH_RESULT_B64:'+encoded('Open YouTube')+'\nSPEECH_CONFIDENCE:0.480\n');
    child.emit('close',0);
  });
  assert.deepEqual(await pending,{success:true,text:'Open YouTube',language:'en-US',confidence:0.48});
});

test('native speech rejects untrusted locale before creating PowerShell', async () => {
  let spawned=false;
  const recognizer=new NativeSpeechRecognizer(()=>{spawned=true;throw Error('unexpected')});
  const result=await recognizer.recognizeOnce(6,'en-US"; Remove-Item C:\\');
  assert.equal(result.success,false);
  assert.match(result.error,/Unsupported recognition language/);
  assert.equal(spawned,false);
});

test('Windows speech returns bounded, distinct alternatives without changing primary text', async () => {
  const child=fakeChild();
  let script;
  const recognizer=new NativeSpeechRecognizer((_cmd,args)=>{
    script=Buffer.from(args[args.indexOf('-EncodedCommand')+1], 'base64').toString('utf16le');
    return child;
  });
  const pending=recognizer.recognizeOnce(6,'en-IN');
  assert.match(script,/EndSilenceTimeout = \[TimeSpan\]::FromMilliseconds\(500\)/);
  assert.match(script,/MaxAlternates = 5/);
  assert.match(script,/SPEECH_ALTERNATE_B64/);
  process.nextTick(()=>{
    child.stdout.write([
      'SPEECH_LOCALE:en-US',
      'SPEECH_RESULT_B64:'+encoded('Open Notepad'),
      'SPEECH_CONFIDENCE:0.430',
      'SPEECH_ALTERNATE_B64:'+encoded('Open note pad'),
      'SPEECH_ALTERNATE_B64:'+encoded('Open Notepad'),
      'SPEECH_ALTERNATE_B64:'+encoded('Open note pads'),
      'SPEECH_ALTERNATE_B64:'+encoded('Open notes'),
      'SPEECH_ALTERNATE_B64:'+encoded('Open note page')
    ].join('\n')+'\n');
    child.emit('close',0);
  });
  assert.deepEqual(await pending,{
    success:true,text:'Open Notepad',language:'en-US',confidence:0.43,
    alternatives:['Open note pad','Open note pads','Open notes']
  });
});

test('malformed or empty alternate suggestions are ignored',async()=>{
  const child=fakeChild();
  const recognizer=new NativeSpeechRecognizer(()=>child);
  const pending=recognizer.recognizeOnce();
  process.nextTick(()=>{
    child.stdout.write('SPEECH_RESULT_B64:'+encoded('Hello')+'\nSPEECH_ALTERNATE_B64:'+encoded('  ')+'\nSPEECH_ALTERNATE_B64:'+encoded('hello')+'\n');
    child.emit('close',0);
  });
  assert.deepEqual(await pending,{success:true,text:'Hello'});
});
