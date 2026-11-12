'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript');
const code=fs.readFileSync(path.join(__dirname,'../src/services/whisperRecorder.ts'),'utf8');
const js=ts.transpileModule(code,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const activitySource=fs.readFileSync(path.join(__dirname,'../src/services/speechActivity.ts'),'utf8');
const activityJs=ts.transpileModule(activitySource,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const activityModule={};
vm.runInNewContext(activityJs,{exports:activityModule,Math,Number});
const loadDependency=name=>{
 if(name==='./speechActivity')return activityModule;
 throw Error('Unexpected dependency: '+name);
};
const exposed={};vm.runInNewContext(js,{exports:exposed,require:loadDependency,Float32Array,Uint8Array,DataView,Math,Error,Number,MediaRecorder:undefined});
const {encodeMonoPcm16}=exposed;
test('offline speech recorder emits exact 16k mono RIFF PCM and linearly resamples',()=>{
 const source=new Float32Array(48000);
 for(let i=0;i<source.length;i++)source[i]=Math.sin(i*2*Math.PI*440/48000)*0.4;
 const wav=encodeMonoPcm16(source,48000);
 assert.equal(wav.length,32044);
 const view=new DataView(wav.buffer);
 assert.equal(view.getUint32(4,true)+8,wav.length);
 assert.equal(view.getUint16(22,true),1);
 assert.equal(view.getUint32(24,true),16000);
 assert.equal(view.getUint16(34,true),16);
 assert.equal(view.getUint32(40,true),32000);
 assert.notEqual(view.getInt16(44+100*2,true),0);
});
test('WAV encoder clamps samples and rejects malformed or excessively long recordings',()=>{
 const input=new Float32Array(16000);input.fill(3);const wav=encodeMonoPcm16(input,16000);
 const view=new DataView(wav.buffer);
 assert.equal(view.getInt16(44,true),32767);
 assert.throws(()=>encodeMonoPcm16(new Float32Array(1),16000));
 assert.throws(()=>encodeMonoPcm16(new Float32Array(48000),0));
 assert.throws(()=>encodeMonoPcm16(new Float32Array(16000*20),16000));
});

test('cancel resolves a capture even when MediaRecorder never sends its stop event',async()=>{
 const observed={stops:0};
 class Recorder {
   static isTypeSupported(){return true;}
   constructor(){this.state='inactive';}
   start(){this.state='recording';}
   stop(){this.state='inactive'; /* missing onstop intentionally */ }
 }
 class Context {
   createAnalyser(){return {fftSize:2048,getFloatTimeDomainData(){}};}
   createMediaStreamSource(){return {connect(){}};}
   close(){return Promise.resolve();}
 }
 const out={};
 vm.runInNewContext(js,{
   exports:out,require:loadDependency,Float32Array,Uint8Array,DataView,Math,Number,Error,MediaRecorder:Recorder,
   window:{AudioContext:Context},
   navigator:{mediaDevices:{getUserMedia:async()=>({getTracks:()=>[{stop(){observed.stops++;}}]})}},
   setInterval,clearInterval,Promise,Date,Blob
 });
 const recorder=new out.LocalWhisperRecorder();
 const pending=recorder.capture();
 await new Promise(resolve=>setImmediate(resolve));
 recorder.cancel();
 await assert.rejects(pending,/cancelled/);
 assert.ok(observed.stops>=1);
});
