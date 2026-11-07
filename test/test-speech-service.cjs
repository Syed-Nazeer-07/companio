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

function setup({native = false, listen, browserRecognition = false} = {}) {
  const api = {
    startNativeSpeech: listen || (async () => ({success:true,silence:true})),
    cancelNativeSpeech: async () => ({success:true})
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
  assert.equal(h.spoken[0].pitch,1.55);
  assert.equal(h.spoken[0].rate,1.18);
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
