'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto');
const {WhisperBinaryInstaller,MANIFESTS}=require('../electron/automation/whisperBinaryInstaller.cjs');
const content=Buffer.from('fake verified official archive data');
const sha256=crypto.createHash('sha256').update(content).digest('hex');
const manifest={arm64:{file:'whisper-bin-win-cpu-arm64.zip',sha256,minBytes:10,maxBytes:200}};
const mockExtract=async(_archive,destination)=>{
 const folder=path.join(destination,'Release');fs.mkdirSync(folder,{recursive:true});
 fs.writeFileSync(path.join(folder,'whisper-cli.exe'),Buffer.alloc(10001,1));
 fs.writeFileSync(path.join(folder,'ggml.dll'),Buffer.from('native library'));
};
function setup(fetchImpl,extract=mockExtract){
 const userData=fs.mkdtempSync(path.join(os.tmpdir(),'companio-cpu-test-'));
 const instance=new WhisperBinaryInstaller({userData,platform:'win32',arch:'arm64',fetchImpl,extract,manifests:manifest,timeoutMs:3000});
 return {userData,instance};
}
const response=(value=content,extra={})=>({url:'https://release-assets.githubusercontent.com/verified',
 ok:true,status:200,headers:{get:()=>String(value.length)},body:(async function*(){yield value;})(),...extra});
test('official Windows ARM64 and x64 downloads have fixed manifests with distinct hashes',()=>{
 assert.match(MANIFESTS.arm64.file,/cpu-arm64/);
 assert.match(MANIFESTS.x64.file,/x64/);
 for(const m of Object.values(MANIFESTS)) assert.match(m.sha256,/^[a-f0-9]{64}$/);
 assert.notEqual(MANIFESTS.arm64.sha256,MANIFESTS.x64.sha256);
});
test('verifies archive digest before extracting and reuses the verified binary',async()=>{
 let calls=0,extracted=0;
 const h=setup(async()=>{calls++;return response();},async(...args)=>{extracted++;await mockExtract(...args);});
 try {
  const progress=[];
  const first=await h.instance.install(p=>progress.push(p.percent));
  assert.equal(first.success,true);assert.equal(first.reused,false);
  assert.equal(first.filePath.endsWith(path.join('Release','whisper-cli.exe')),true);
  assert.deepEqual(progress.at(-1),100);
  const reused=await h.instance.install();
  assert.equal(reused.success,true);assert.equal(reused.reused,true);
  assert.equal(extracted,1);assert.equal(calls,1);
  fs.appendFileSync(first.filePath,'tampered');
  assert.equal((await h.instance.install()).success,false);
 } finally {fs.rmSync(h.userData,{recursive:true,force:true});}
});
test('failed hash and insecure redirect never install executable files',async()=>{
 for(const provider of [async()=>response(Buffer.alloc(100,3)),
   async()=>response(content,{url:'http://unsafe.example/zip'}),
   async()=>response(content,{headers:{get:()=>String(999999)}})]) {
  const h=setup(provider);let extracted=false;
  h.instance.extract=async()=>{extracted=true;};
  try {
   const result=await h.instance.install();
   assert.equal(result.success,false);
   assert.equal(extracted,false);
   assert.equal(fs.existsSync(path.join(h.userData,'speech-tools','whisper-b5454-arm64')),false);
  }finally{fs.rmSync(h.userData,{recursive:true,force:true});}
 }
});
test('cancellation settles a pending download and removes temporary artifacts',async()=>{
 let release;
 const h=setup(async(_url,{signal})=>{
  await new Promise(resolve=>release=resolve);
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
  assert.deepEqual(fs.readdirSync(path.join(h.userData,'speech-tools')),[]);
 }finally{fs.rmSync(h.userData,{recursive:true,force:true});}
});
test('unsupported operating systems and architectures never download binaries',async()=>{
 let called=false;
 const h=setup(async()=>{called=true;return response();});
 try{
  h.instance.platform='darwin';assert.equal((await h.instance.install()).success,false);
  h.instance.platform='win32';h.instance.arch='ia32';assert.equal((await h.instance.install()).success,false);
  assert.equal(called,false);
 }finally{fs.rmSync(h.userData,{recursive:true,force:true});}
});
