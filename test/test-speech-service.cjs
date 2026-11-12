'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const source = fs.readFileSync(path.join(__dirname, '../src/services/speechService.ts'), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
}).outputText;

function setup({native = false, listen, browserRecognition = false, recorderClass} = {}) {
  const api = {
    cancels: 0,
    startNativeSpeech: listen || (async () => ({success:true,silence:true})),
    cancelNativeSpeech: async () => { api.cancels++; return {success:true}; },
    transcribeWithWhisper: async () => ({success:true,text:'Open Notepad',language:'en'}),
    getWhisperStatus: async () => ({supported:true,configured:true,message:'Ready'})
  };
  let recognition;
  class BrowserRecognizer {
    constructor() {recognition=this;}
    start() {this.started=true;}
    stop() {this.stopped=true;}
  }
  const spoken=[];
  const speechSynthesis = {
    cancelCount:0,
    cancel() {this.cancelCount++;},
    speak(utterance) {spoken.push(utterance);},
    getVoices() {return [];}
  };
  class Utterance {
    constructor(value) {this.text=value;this.rate=1;this.pitch=1;this.volume=1;}
  }
  const window = {speechSynthesis};
  if (browserRecognition) window.SpeechRecognition = BrowserRecognizer;
  const result={};
  vm.runInNewContext(compiled,{
    exports:result,
    require(name) {
      if (name==='./desktopBridge') return {desktopBridge:api,isNativeDesktop:()=>native};
      if (name==='./whisperRecorder') return {LocalWhisperRecorder:recorderClass || class {
        async capture(){return new Uint8Array(32044);}
        cancel(){api.captureCancelled=(api.captureCancelled||0)+1;}
      }};
      throw Error('Unexpected import '+name);
    },
    window,navigator:{},SpeechSynthesisUtterance:Utterance,
    setInterval,clearInterval,setTimeout,clearTimeout,
    Uint8Array,Math,Error,Array,console
  },{filename:'speechService.compiled.cjs'});
  result.speechService.playChime=()=>{};
  return {service:result.speechService,api,spoken,speechSynthesis,getRecognition:()=>recognition};
}

test('native speech stops cleanly after silence and does not leave the mic UI active', async () => {
  const h=setup({native:true});
  const signals=[];
  await h.service.startListening(()=>{},()=>signals.push('final'),()=>signals.push('error'),undefined,()=>signals.push('stopped'));
  assert.deepEqual(signals,['stopped']);
});

test('user cancellation discards late recognized native text', async () => {
  let answer;
  const h=setup({native:true,listen:()=>new Promise(resolve=>{answer=resolve;})});
  const seen=[];
  const running=h.service.startListening(()=>{},text=>seen.push(text),error=>seen.push('ERROR '+error));
  h.service.stopListening();
  answer({success:true,text:'Open a destructive command'});
  await running;
  assert.deepEqual(seen,[]);
});

test('native speech failures expose their real reason and only complete once', async () => {
  const h=setup({native:true,listen:async()=>({success:false,error:'No default input device'})});
  const errors=[];
  await h.service.startListening(()=>{},()=>{},error=>errors.push(error));
  assert.deepEqual(errors,['No default input device']);
});

test('browser recognition completes exactly once on no-speech or abort', async () => {
  const h=setup({browserRecognition:true});
  let stops=0;
  await h.service.startListening(()=>{},()=>{},()=>{},undefined,()=>stops++);
  const rec=h.getRecognition();
  assert.equal(rec.started,true);
  rec.onerror({error:'no-speech'});
  rec.onend();
  assert.equal(stops,1);
  assert.equal(rec.stopped,true);
});

test('stale browser result cannot fire after speech was stopped', async () => {
  const h=setup({browserRecognition:true});
  let count=0;
  await h.service.startListening(()=>{},()=>count++,()=>{});
  const rec=h.getRecognition();
  h.service.stopListening();
  rec.onresult({resultIndex:0,results:[{isFinal:true,0:{transcript:'late speech'}}]});
  assert.equal(count,0);
});

test('character TTS actually retains profile pitch/rate and settles once', () => {
  const h=setup();
  let started=0,ended=0;
  h.service.speak('Hello!',{
    characterId:'kiko',rate:1,pitch:1,
    onStart:()=>started++,onEnd:()=>ended++
  });
  assert.equal(h.spoken.length,1);
  assert.equal(h.spoken[0].pitch,1.1);
  assert.equal(h.spoken[0].rate,1.08);
  h.spoken[0].onstart();
  assert.equal(started,1);
  h.service.stopSpeaking();
  h.spoken[0].onend();
  assert.equal(ended,1);
});

test('muted speech never pretends audio started and ends the UI synchronously', () => {
  const h=setup();
  const events=[];
  h.service.speak('Text',{muted:true,onStart:()=>events.push('start'),onEnd:()=>events.push('end')});
  assert.deepEqual(events,['end']);
  assert.equal(h.spoken.length,0);
});

test('Web Speech synthesis errors complete the animation exactly once', () => {
  const h=setup();
  let ended=0;
  h.service.speak('Testing',{onEnd:()=>ended++});
  h.spoken[0].onerror();
  h.spoken[0].onend();
  assert.equal(ended,1);
});

test('normal voice completion does not send stale cancellation to the next request',async()=>{
  const h=setup({native:true,listen:async()=>({success:true,text:'Open YouTube',language:'en-IN',confidence:0.82})});
  const transcripts=[];
  await h.service.startListening(()=>{},(value,meta)=>transcripts.push({value,meta}),()=>{});
  assert.equal(h.api.cancels,0);
  assert.equal(transcripts[0].value,'Open YouTube');
  assert.equal(transcripts[0].meta.language,'en-IN');
  assert.equal(transcripts[0].meta.confidence,0.82);
  await h.service.startListening(()=>{},()=>{},()=>{});
  assert.equal(h.api.cancels,0);
});

test('explicit user microphone cancellation still aborts one active native session',async()=>{
  let resolve;
  const h=setup({native:true,listen:()=>new Promise(r=>{resolve=r;})});
  const active=h.service.startListening(()=>{},()=>{},()=>{});
  h.service.stopListening();
  assert.equal(h.api.cancels,1);
  resolve({success:true,text:'late'});
  await active;
  assert.equal(h.api.cancels,1);
});

test('browser dictation exposes real confidence where the engine supplies it',async()=>{
  const h=setup({browserRecognition:true});
  const received=[];
  await h.service.startListening(()=>{},(text,metadata)=>received.push({text,metadata}),()=>{},undefined,undefined,'en-IN');
  const recognition=h.getRecognition();
  recognition.onresult({
    resultIndex:0,
    results:[{isFinal:true,0:{transcript:'Good morning',confidence:0.92}}]
  });
  assert.equal(received[0].text,'Good morning');
  assert.equal(received[0].metadata.confidence,0.92);
  assert.equal(received[0].metadata.language,'en-IN');
});

test('native voice alternatives are forwarded as editable hypotheses',async()=>{
  const h=setup({native:true,listen:async()=>({
    success:true,text:'Open note pad',language:'en-US',confidence:0.49,
    alternatives:['Open Notepad','Open notes']
  })});
  let details;
  await h.service.startListening(()=>{},(_text,meta)=>{details=meta;},()=>{});
  assert.equal(details.confidence,0.49);
  assert.deepEqual(details.alternatives,['Open Notepad','Open notes']);
  assert.equal(h.api.cancels,0);
});

test('optional offline Whisper returns transcript without inventing recognition confidence',async()=>{
 const h=setup({native:true});
 let received;
 await h.service.startListening(()=>{},(text,meta)=>{received={text,meta};},()=>{},undefined,undefined,'en-IN',false,'whisper');
 assert.equal(received.text,'Open Notepad');
 assert.equal(received.meta.language,'en');
 assert.equal(received.meta.confidence,undefined);
 assert.equal(h.api.cancels,0);
});

test('unconfigured Whisper rejects before microphone capture or native transcription',async()=>{
  const h=setup({native:true});
  h.api.getWhisperStatus=async()=>({supported:true,configured:false,message:'Choose Whisper model first'});
  h.api.transcribeWithWhisper=async()=>{throw Error('must not transcribe');};
  const errors=[];
  await h.service.startListening(()=>{},()=>{},e=>errors.push(e),undefined,undefined,'en-IN',false,'whisper');
  assert.deepEqual(errors,['Choose Whisper model first']);
  assert.equal(h.api.cancels,0);
});


test('automatic voice uses packaged Whisper, falling back to Windows when unavailable',async()=>{
 const ready=setup({native:true});
 let transcript;
 await ready.service.startListening(()=>{},text=>{transcript=text;},()=>{},undefined,undefined,'en-IN',false,'auto');
 assert.equal(transcript,'Open Notepad');
 assert.equal(ready.api.cancels,0);
 const fallback=setup({native:true,listen:async()=>({success:true,text:'Open YouTube',language:'en-IN'})});
 fallback.api.getWhisperStatus=async()=>({supported:true,configured:false});
 let heard;
 await fallback.service.startListening(()=>{},text=>{heard=text;},()=>{},undefined,undefined,'en-IN',false,'auto');
 assert.equal(heard,'Open YouTube');
});

test('cancelled Whisper session cannot clear the next active capture', async()=>{
 const instances=[];
 class Recorder {
   constructor(){this.resolve=null;this.cancelled=false;instances.push(this);}
   capture(){return new Promise(resolve=>{this.resolve=resolve;});}
   cancel(){this.cancelled=true;}
 }
 const h=setup({native:true,recorderClass:Recorder});
 const first=h.service.startListening(()=>{},()=>{},()=>{},undefined,undefined,'en-IN',false,'whisper');
 // Allow the async readiness check to reach the first capture.
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(instances.length,1);
 const second=h.service.startListening(()=>{},()=>{},()=>{},undefined,undefined,'en-IN',false,'whisper');
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(instances.length,2);
 assert.equal(instances[0].cancelled,true);
 // Old request completes late while the newer one must remain cancellable.
 instances[0].resolve(new Uint8Array(32044));
 await first;
 h.service.stopListening();
 assert.equal(instances[1].cancelled,true);
 instances[1].resolve(new Uint8Array(32044));
 await second;
});
