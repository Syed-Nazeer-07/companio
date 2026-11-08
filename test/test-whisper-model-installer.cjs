'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto');
const {WhisperModelInstaller}=require('../electron/automation/whisperModelInstaller.cjs');
const content=Buffer.from('tiny verified model test data');
const sha256=crypto.createHash('sha256').update(content).digest('hex');
const fakeManifest={id:'test',file:'ggml-tiny.en-q5_1.bin',url:'https://huggingface.co/test',
 sha256,minBytes:10,maxBytes:100};
const create=fetchImpl=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'companio-model-test-'));
 return {dir,instance:new WhisperModelInstaller({userData:dir,fetchImpl,manifest:fakeManifest})};
};
function response(data=content,extra={}){
 return {url:'https://cdn-lfs.huggingface.co/test',ok:true,status:200,
 headers:{get:()=>String(data.length)},
 body:(async function*(){yield data;})(),...extra};
}
test('model installs only after successful SHA-256 validation and can be safely reused',async()=>{
 let calls=0;const h=create(async()=>{calls++;return response();});
 try{
  const progress=[];
  const first=await h.instance.install(x=>progress.push(x.percent));
  assert.equal(first.success,true);
  assert.equal(first.reused,false);
  assert.equal(first.bytes,content.length);
  assert.equal(progress.at(-1),100);
  assert.equal(fs.readFileSync(first.filePath,'utf8'),content.toString());
  const second=await h.instance.install();
  assert.equal(second.success,true);assert.equal(second.reused,true);assert.equal(calls,1);
 }finally{fs.rmSync(h.dir,{recursive:true,force:true});}
});
test('corrupted, oversized and insecure downloads leave no model or partial file',async()=>{
 for(const fetchImpl of [
  async()=>response(Buffer.from('wrong checksum but long enough')),
  async()=>response(Buffer.alloc(200)),
  async()=>response(content,{url:'http://insecure.example/file'})
 ]){
  const h=create(fetchImpl);
  try{
   const r=await h.instance.install();
   assert.equal(r.success,false);
   assert.deepEqual(fs.readdirSync(path.join(h.dir,'speech-models')),[]);
  }finally{fs.rmSync(h.dir,{recursive:true,force:true});}
 }
});
test('only one model download runs at once and cancellation aborts the request',async()=>{
 let release;
 const h=create(async(_url,{signal})=>{
  await new Promise(resolve=>{release=resolve;});
  if(signal.aborted)throw Error('aborted');
  return response();
 });
 try{
  const pending=h.instance.install();
  assert.equal((await h.instance.install()).success,false);
  assert.equal(h.instance.cancel().cancelled,true);
  release();
  assert.equal((await pending).success,false);
  assert.equal(h.instance.status().downloading,false);
 }finally{fs.rmSync(h.dir,{recursive:true,force:true});}
});
