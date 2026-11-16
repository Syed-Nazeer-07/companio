'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {captureScreenshotWithFallback,validPng}=require('../electron/automation/screenshotFallback.cjs');

function png() {
  const b=Buffer.alloc(256);
  Buffer.from('89504e470d0a1a0a','hex').copy(b);
  b.write('IHDR',12,'ascii');
  b.writeUInt32BE(1920,16);
  b.writeUInt32BE(1080,20);
  return b;
}
const screen={getPrimaryDisplay:()=>({id:3,size:{width:1920,height:1080},scaleFactor:1})};

test('already verified native screenshot avoids the fallback entirely',async()=>{
 let invoked=false;
 const original={success:true,verified:true,filePath:'native.png'};
 const result=await captureScreenshotWithFallback({
   platform:'win32',screen,
   winAppsController:{takeScreenshot:async()=>original},
   desktopCapturer:{getSources:async()=>{invoked=true;return []}}
 });
 assert.deepEqual(result,original);
 assert.equal(invoked,false);
});

test('Electron fallback saves the matched screen as a verified file',async()=>{
 const home=fs.mkdtempSync(path.join(os.tmpdir(),'companio-fallback-'));
 let asked=false;
 try{
   const result=await captureScreenshotWithFallback({
     platform:'win32',homeDir:home,screen,
     winAppsController:{
       takeScreenshot:async()=>({success:false,verified:false,error:'GDI capture failed'}),
       runPowerShell:async()=>({stdout:path.join(home,'RedirectedPictures')})
     },
     desktopCapturer:{getSources:async options=>{
       assert.deepEqual(options.types,['screen']);
       assert.ok(options.thumbnailSize.width>=1920);
       asked=true;
       return [
         {display_id:'4',thumbnail:{isEmpty:()=>false,toPNG:()=>Buffer.alloc(3)}},
         {display_id:'3',thumbnail:{isEmpty:()=>false,toPNG:png}}
       ];
     }}
   });
   assert.equal(asked,true);
   assert.equal(result.success,true);
   assert.equal(result.verified,true);
   assert.match(result.filePath,/RedirectedPictures/);
   assert.ok(fs.existsSync(result.filePath));
   assert.ok(validPng(fs.readFileSync(result.filePath)));
 } finally {fs.rmSync(home,{force:true,recursive:true});}
});

test('invalid or unavailable thumbnails never produce a fake success',async()=>{
 const home=fs.mkdtempSync(path.join(os.tmpdir(),'companio-fallback-invalid-'));
 try {
   const result=await captureScreenshotWithFallback({
     platform:'win32',homeDir:home,screen,
     winAppsController:{takeScreenshot:async()=>({success:false,error:'Primary capture failed'})},
     desktopCapturer:{getSources:async()=>[
       {display_id:'3',thumbnail:{isEmpty:()=>false,toPNG:()=>Buffer.from('not an image')}}
     ]}
   });
   assert.equal(result.success,false);
   assert.equal(result.verified,false);
   assert.match(result.error,/Electron screen capture also failed/);
   assert.equal(fs.existsSync(path.join(home,'Pictures','Companio_Captures')),false);
 } finally {fs.rmSync(home,{force:true,recursive:true});}
});

test('fallback is not invoked outside Windows',async()=>{
 let requested=false;
 const native={success:false,verified:false,error:'Not supported'};
 const result=await captureScreenshotWithFallback({
   platform:'linux',screen,winAppsController:{takeScreenshot:async()=>native},
   desktopCapturer:{getSources:async()=>{requested=true;return []}}
 });
 assert.deepEqual(result,native);
 assert.equal(requested,false);
});
