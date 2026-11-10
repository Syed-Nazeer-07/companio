'use strict';
// Optional, explicitly requested whisper.cpp CPU installer.
// These immutable archives and hashes are from the official ggml-org release
// b5454; never accept a download URL, executable path or hash from the renderer.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFile } = require('node:child_process');

const RELEASE = 'b5454';
const MANIFESTS = Object.freeze({
  arm64: Object.freeze({
    file: 'whisper-bin-win-cpu-arm64.zip',
    sha256: '28c37e7b598c3d9bbfef94f3bd67f2ee6f12b7c86f3da5edcf5e4308d615ff6d',
    minBytes: 3000000, maxBytes: 15000000
  }),
  x64: Object.freeze({
    file: 'whisper-bin-x64.zip',
    sha256: '6ba69e3482d7826214f90a6a9c84ca07782aec1e1d0c6a7c30c994fd5d816ccb',
    minBytes: 6000000, maxBytes: 15000000
  })
});

function runTar(args, { signal, timeoutMs = 60000 } = {}) {
  return new Promise((resolve,reject) => {
    execFile('tar.exe', args, { windowsHide: true, timeout: timeoutMs, maxBuffer: 1024 * 1024, signal }, (error, stdout, stderr) => {
      if (error) return reject(Error('Could not unpack the verified whisper.cpp archive: ' + (stderr || error.message).slice(0,240)));
      resolve(stdout);
    });
  });
}
async function extractVerifiedZip(archive, destination, signal) {
  // Explicitly reject dangerous archive paths before unpacking. The archive's
  // official SHA-256 is already pinned and verified before this call.
  const listing = await runTar(['-tf', archive], {signal});
  const entries = listing.split(/\r?\n/).filter(Boolean);
  if (!entries.length || entries.length > 400) throw Error('Unexpected Whisper archive contents.');
  for (const entry of entries) {
    const normalized = entry.replace(/\\/g,'/');
    const segments = normalized.split('/');
    if (normalized.startsWith('/') || /^[A-Za-z]:/.test(normalized) ||
        segments.includes('..') || normalized.includes('\0')) {
      throw Error('Unsafe path inside the Whisper archive.');
    }
  }
  await runTar(['-xf', archive, '-C', destination], {signal});
}
function validateInstalledBinary(root, fileSystem = fs) {
  const candidate=path.join(root,'Release','whisper-cli.exe');
  const actual=fileSystem.realpathSync(candidate);
  const home=fileSystem.realpathSync(root) + path.sep;
  if (!actual.toLowerCase().startsWith(home.toLowerCase())) throw Error('Whisper executable escaped its installation directory.');
  const stat=fileSystem.statSync(candidate);
  if(!stat.isFile() || stat.size < 10000 || stat.size > 100000000) {
    throw Error('The official archive did not contain a valid whisper-cli.exe.');
  }
  return candidate;
}

class WhisperBinaryInstaller {
  constructor({ userData, arch = process.arch, platform = process.platform,
    fetchImpl = globalThis.fetch, fileSystem = fs, extract = extractVerifiedZip,
    timeoutMs = 180000, manifests = MANIFESTS } = {}) {
    if(typeof userData !== 'string' || !path.isAbsolute(userData)) throw Error('Missing Whisper executable storage directory.');
    this.userData=userData;this.arch=arch;this.platform=platform;
    this.fetchImpl=fetchImpl;this.fs=fileSystem;this.extract=extract;this.timeoutMs=timeoutMs;
    this.manifests=manifests;this.current=null;
  }
  status() {return this.current ? {downloading:true,received:this.current.received,total:this.current.total}
    : {downloading:false,received:0,total:0};}
  cancel() {if(!this.current) return {success:true,cancelled:false};this.current.abort.abort();return {success:true,cancelled:true};}
  async install(onProgress=()=>{}) {
    if(this.platform!=='win32' || !this.manifests[this.arch]) {
      return {success:false,error:'Automatic Whisper CPU setup supports Windows x64 and ARM64 only.'};
    }
    if(this.current)return {success:false,error:'Whisper CPU setup is already running.'};
    const manifest=this.manifests[this.arch];
    const root=path.join(this.userData,'speech-tools');
    const target=path.join(root,'whisper-'+RELEASE+'-'+this.arch);
    const temporary=path.join(root,manifest.file+'.partial');
    const staging=path.join(root,'.whisper-'+RELEASE+'-'+this.arch+'.partial');
    const url='https://github.com/ggml-org/whisper.cpp/releases/download/'+RELEASE+'/'+manifest.file;
    const abort=new AbortController();
    this.current={abort,received:0,total:manifest.maxBytes};
    const timer=setTimeout(()=>abort.abort(),this.timeoutMs);
    let handle=null;
    try {
      this.fs.mkdirSync(root,{recursive:true});
      if(this.fs.existsSync(target)) {
        const binary=validateInstalledBinary(target,this.fs);
        const stamp=JSON.parse(this.fs.readFileSync(path.join(target,'companio-source.json'),'utf8'));
        const digest=crypto.createHash('sha256');
        for await (const chunk of this.fs.createReadStream(binary)) digest.update(chunk);
        if(stamp.archiveSha256===manifest.sha256 && stamp.binarySha256===digest.digest('hex') &&
            stamp.arch===this.arch && stamp.release===RELEASE) {
          return {success:true,filePath:binary,reused:true};
        }
        throw Error('Existing Whisper installation could not be verified. Remove it manually before reinstalling.');
      }
      try{this.fs.unlinkSync(temporary);}catch{}
      this.fs.rmSync(staging,{recursive:true,force:true});
      const response=await this.fetchImpl(url,{signal:abort.signal,redirect:'follow',headers:{Accept:'application/octet-stream'}});
      if(!response?.ok || !response.body) throw Error('Could not download the official whisper.cpp Windows archive (HTTP '+response?.status+').');
      if(new URL(response.url || url).protocol!=='https:') throw Error('Insecure Whisper download redirect rejected.');
      const length=Number(response.headers?.get?.('content-length'));
      if(Number.isFinite(length) && length>manifest.maxBytes)throw Error('Whisper archive exceeded its expected size.');
      this.current.total=Number.isFinite(length)&&length>=manifest.minBytes?length:manifest.maxBytes;
      handle=await this.fs.promises.open(temporary,'wx');
      let received=0,lastPercent=-1;
      const digest=crypto.createHash('sha256');
      for await (const chunk of response.body) {
        if(abort.signal.aborted) throw Error('Whisper download cancelled.');
        const data=Buffer.from(chunk);
        received+=data.byteLength;
        if(received>manifest.maxBytes)throw Error('Whisper archive is too large.');
        digest.update(data);
        let offset=0;
        while(offset<data.length){
          const n=(await handle.write(data,offset,data.length-offset,null)).bytesWritten;
          if(n<1)throw Error('Whisper archive could not be saved.');offset+=n;
        }
        this.current.received=received;
        const percent=Math.min(95,Math.round(received/this.current.total*95));
        if(percent!==lastPercent){lastPercent=percent;onProgress({stage:'download',received,total:this.current.total,percent});}
      }
      await handle.sync();await handle.close();handle=null;
      if(received<manifest.minBytes || received>manifest.maxBytes || digest.digest('hex')!==manifest.sha256) {
        throw Error('Official whisper.cpp archive failed SHA-256 or size verification. Nothing was installed.');
      }
      if(abort.signal.aborted)throw Error('Whisper setup cancelled.');
      this.fs.mkdirSync(staging,{recursive:true});
      onProgress({stage:'extract',received,total:received,percent:96});
      await this.extract(temporary,staging,abort.signal);
      if(abort.signal.aborted)throw Error('Whisper setup cancelled.');
      const binary=validateInstalledBinary(staging,this.fs);
      const exeDigest=crypto.createHash('sha256');
      for await(const chunk of this.fs.createReadStream(binary))exeDigest.update(chunk);
      this.fs.writeFileSync(path.join(staging,'companio-source.json'),JSON.stringify({
        release:RELEASE,arch:this.arch,archiveSha256:manifest.sha256,
        binarySha256:exeDigest.digest('hex')
      }),{mode:0o600});
      this.fs.renameSync(staging,target);
      onProgress({stage:'done',received,total:received,percent:100});
      return {success:true,filePath:path.join(target,'Release','whisper-cli.exe'),reused:false};
    } catch(error) {
      return {success:false,error:abort.signal.aborted?'Whisper CPU setup cancelled or timed out.':error?.message||'Whisper CPU setup failed.'};
    } finally {
      clearTimeout(timer);
      if(handle){try{await handle.close();}catch{}}
      try{this.fs.unlinkSync(temporary);}catch{}
      try{this.fs.rmSync(staging,{recursive:true,force:true});}catch{}
      this.current=null;
    }
  }
}
module.exports={WhisperBinaryInstaller,MANIFESTS,RELEASE,validateInstalledBinary,extractVerifiedZip};
