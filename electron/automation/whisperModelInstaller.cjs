'use strict';
// Explicit, single-model download. Integrity is checked against the SHA-256
// published by the official model maintainer before moving into place.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const MANIFEST = Object.freeze({
  id:'base.en-q5_1', file:'ggml-base.en-q5_1.bin',
  url:'https://huggingface.co/ggerganov/whisper.cpp/resolve/c521a4b02f422512d734391fdf08bb08c0862f68/ggml-base.en-q5_1.bin',
  sha256:'4baf70dd0d7c4247ba2b81fafd9c01005ac77c2f9ef064e00dcf195d0e2fdd2f',
  minBytes:55_000_000,maxBytes:70_000_000
});
class WhisperModelInstaller {
  constructor({userData,fetchImpl=globalThis.fetch,fileSystem=fs,manifest=MANIFEST,timeoutMs=240000}={}){
    if(typeof userData!=='string'||!path.isAbsolute(userData))throw Error('Missing model storage directory.');
    this.userData=userData;this.fetchImpl=fetchImpl;this.fs=fileSystem;this.manifest=manifest;
    this.timeoutMs=timeoutMs;this.current=null;
  }
  status(){return this.current?{downloading:true,received:this.current.received,total:this.current.total}:{
    downloading:false,received:0,total:0
  };}
  cancel(){if(!this.current)return {success:true,cancelled:false};this.current.abort.abort();return {success:true,cancelled:true};}
  async install(onProgress=()=>{}){
    if(this.current)return {success:false,error:'A Whisper speech model download is already running.'};
    const {file,url,sha256,minBytes,maxBytes}=this.manifest;
    const dir=path.join(this.userData,'speech-models');
    const target=path.join(dir,file);
    const temporary=target+'.partial';
    const abort=new AbortController();
    this.current={abort,received:0,total:maxBytes};
    const timer=setTimeout(()=>abort.abort(),this.timeoutMs);
    let handle=null;
    try{
      this.fs.mkdirSync(dir,{recursive:true});
      // Reuse a previously verified model instead of downloading it again.
      if(this.fs.existsSync(target)){
        const existingSize=this.fs.statSync(target).size;
        if(existingSize<minBytes || existingSize>maxBytes) {
          throw Error('The existing Whisper model size is invalid. Remove it before retrying.');
        }
        const hash=crypto.createHash('sha256');
        const reader=this.fs.createReadStream(target);
        for await(const part of reader)hash.update(part);
        if(hash.digest('hex')===sha256){
          return {success:true,filePath:target,reused:true,bytes:this.fs.statSync(target).size};
        }
        throw Error('An existing Whisper model failed its checksum. Remove the file before downloading again.');
      }
      try{this.fs.unlinkSync(temporary);}catch{}
      const response=await this.fetchImpl(url,{signal:abort.signal,redirect:'follow',
        headers:{Accept:'application/octet-stream'}});
      const redirected=new URL(response.url||url);
      if(redirected.protocol!=='https:')throw Error('Insecure model download redirect rejected.');
      if(!response.ok||!response.body)throw Error('Speech model download returned HTTP '+response.status);
      const announced=Number(response.headers?.get?.('content-length'));
      if(Number.isFinite(announced)&&announced>maxBytes)throw Error('Model download exceeds the allowed size.');
      this.current.total=Number.isFinite(announced)&&announced>=minBytes?announced:maxBytes;
      handle=await this.fs.promises.open(temporary,'wx');
      let received=0;
      let lastPercent=-1;
      const digest=crypto.createHash('sha256');
      for await(const raw of response.body){
        if(abort.signal.aborted)throw Error('Model download cancelled.');
        const chunk=Buffer.from(raw);
        received+=chunk.length;
        if(received>maxBytes)throw Error('Model download exceeded its safe size limit.');
        digest.update(chunk);
        let offset=0;
        while(offset<chunk.length){
          const {bytesWritten}=await handle.write(chunk,offset,chunk.length-offset,null);
          if(bytesWritten<=0)throw Error('Could not write speech model data.');
          offset+=bytesWritten;
        }
        this.current.received=received;
        // Avoid flooding both Electron windows with thousands of events.
        const percent=Math.min(99,Math.round(received/this.current.total*100));
        if(percent!==lastPercent){
          lastPercent=percent;
          onProgress({received,total:this.current.total,percent});
        }
      }
      await handle.sync();await handle.close();handle=null;
      if(abort.signal.aborted)throw Error('Model download cancelled.');
      if(received<minBytes)throw Error('The downloaded Whisper model is incomplete.');
      if(digest.digest('hex')!==sha256)throw Error('Whisper model checksum mismatch. Nothing was installed.');
      this.fs.renameSync(temporary,target);
      onProgress({received,total:received,percent:100});
      return {success:true,filePath:target,reused:false,bytes:received};
    }catch(error){
      return {success:false,error:abort.signal.aborted
        ? 'Speech model download cancelled or timed out.'
        : error?.message||'Could not install the speech model.'};
    }finally{
      clearTimeout(timer);
      if(handle){try{await handle.close();}catch{}}
      try{this.fs.unlinkSync(temporary);}catch{}
      this.current=null;
    }
  }
}
module.exports={WhisperModelInstaller,MANIFEST};
