'use strict';
// Optional offline speech-to-text using the user-selected whisper.cpp CLI.
// Executables and model files are never downloaded, executed or selected
// silently. Paths are stored only after an explicit native file picker.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawn } = require('node:child_process');

const MAX_WAV_BYTES = 16 * 1024 * 1024;
const MAX_TRANSCRIPT = 1600;
const MAX_INFERENCE_MS = 90000;

function validateWave(input) {
  if (!(input instanceof Uint8Array) || input.byteLength < 46 ||
      input.byteLength > MAX_WAV_BYTES) throw Error('Invalid or oversized microphone recording.');
  const data = Buffer.from(input.buffer, input.byteOffset, input.byteLength);
  if (data.toString('ascii',0,4) !== 'RIFF' || data.toString('ascii',8,12) !== 'WAVE' ||
      data.toString('ascii',12,16) !== 'fmt ' || data.readUInt32LE(16) !== 16 ||
      data.readUInt16LE(20) !== 1 || data.readUInt16LE(22) !== 1 ||
      data.readUInt32LE(24) !== 16000 || data.readUInt16LE(34) !== 16 ||
      data.toString('ascii',36,40) !== 'data' ||
      data.readUInt32LE(40) + 44 !== data.byteLength ||
      data.readUInt32LE(4) + 8 !== data.byteLength) {
    throw Error('Speech recording must be mono 16 kHz 16-bit PCM WAV.');
  }
  if (data.readUInt32LE(40) < 3200) throw Error('Recording is too short to transcribe.');
  return data;
}

function safeSelection(kind, file, fileSystem = fs) {
  if (typeof file !== 'string' || !path.isAbsolute(file) || file.length > 1024 ||
      /[\u0000-\u001f]/.test(file)) throw Error('Select an absolute local file.');
  const name = path.basename(file).toLowerCase();
  if (kind === 'binary' && name !== 'whisper-cli.exe') {
    throw Error('Select the official whisper.cpp whisper-cli.exe executable.');
  }
  if (kind === 'model' && !/^ggml-[a-z0-9_.-]+\.bin$/.test(name)) {
    throw Error('Select a whisper.cpp ggml-*.bin speech model.');
  }
  const stat = fileSystem.statSync(file);
  if (!stat.isFile() || (kind === 'model' && (stat.size < 10_000_000 || stat.size > 5_000_000_000)) ||
      (kind === 'binary' && stat.size > 200_000_000)) throw Error('The selected speech file is invalid.');
  return path.resolve(file);
}

class WhisperSpeechController {
  constructor({userData, spawnProcess = spawn, fileSystem = fs, platform = process.platform,
    timeoutMs = MAX_INFERENCE_MS} = {}) {
    if (typeof userData !== 'string' || !path.isAbsolute(userData)) throw Error('Missing application data directory.');
    this.userData = userData;
    this.spawnProcess = spawnProcess;
    this.fileSystem = fileSystem;
    this.platform = platform;
    this.timeoutMs = timeoutMs;
    this.configPath = path.join(userData, 'whisper-speech.json');
    this.active = null;
  }

  selections() {
    let obj;
    try {obj=JSON.parse(this.fileSystem.readFileSync(this.configPath,'utf8'));}
    catch{return {binary:null,model:null};}
    const valid=kind=>{
      try{return safeSelection(kind,obj[kind],this.fileSystem);}
      catch{return null;}
    };
    return {binary:valid('binary'),model:valid('model')};
  }

  readConfig() {
    const selected=this.selections();
    return selected.binary && selected.model ? selected : null;
  }

  status() {
    const selected=this.selections();
    const configured=!!selected.binary && !!selected.model && this.platform==='win32';
    return {
      supported: this.platform === 'win32',
      configured,
      busy: !!this.active,
      executable: selected.binary ? path.basename(selected.binary) : null,
      model: selected.model ? path.basename(selected.model) : null,
      message: configured ? 'Local whisper.cpp is configured. Audio stays on this computer.'
        : !selected.binary ? 'Select whisper-cli.exe from the official Windows whisper.cpp release.'
        : 'Choose or download an English GGML speech model to finish setup.'
    };
  }

  choose(kind, selectedPath) {
    if (!['binary','model'].includes(kind)) return {success:false,error:'Unknown speech file type.'};
    try {
      if (this.active) throw Error('Stop listening before changing speech files.');
      if (this.platform !== 'win32') throw Error('Local Whisper setup is available in Windows desktop builds.');
      const file = safeSelection(kind, selectedPath,this.fileSystem);
      const existing = (()=>{try{return JSON.parse(this.fileSystem.readFileSync(this.configPath,'utf8'));}catch{return {};}})();
      const next={...existing,[kind]:file};
      this.fileSystem.mkdirSync(this.userData,{recursive:true});
      const temporary=this.configPath+'.tmp';
      try {
        this.fileSystem.writeFileSync(temporary,JSON.stringify(next),{mode:0o600});
        this.fileSystem.renameSync(temporary,this.configPath);
      } finally {
        try{this.fileSystem.unlinkSync(temporary);}catch{}
      }
      return {success:true,...this.status()};
    } catch(error) {return {success:false,error:error.message||'Could not configure local Whisper.'};}
  }

  async transcribe(wav, language='en') {
    if (this.platform !== 'win32') return {success:false,error:'Local Whisper is supported on Windows only.'};
    if (this.active) return {success:false,error:'Whisper transcription is already running.'};
    const config=this.readConfig();
    if(!config) return {success:false,error:'Set up the whisper.cpp executable and model in Voice Settings first.'};
    if(language!=='en') return {success:false,error:'This speech mode currently supports English only.'};
    let data;
    try {data=validateWave(wav);}catch(error){return {success:false,error:error.message};}
    const folder=this.fileSystem.mkdtempSync(path.join(os.tmpdir(),'companio-whisper-'));
    const audio=path.join(folder,'recording.wav');
    const output=path.join(folder,'transcript');
    try {
      this.fileSystem.writeFileSync(audio,data,{flag:'wx'});
      return await new Promise(resolve=>{
        let child, timer, settled=false, stderr='';
        const finish=(answer)=>{
          if(settled)return;
          settled=true;clearTimeout(timer);
          if(this.active?.child===child)this.active=null;
          try{this.fileSystem.rmSync(folder,{recursive:true,force:true});}catch{}
          resolve(answer);
        };
        try {
          child=this.spawnProcess(config.binary,[
            '-m',config.model,'-f',audio,'-l',language,'-ng','-nt','-otxt','-of',output,'-t','4'
          ],{windowsHide:true,stdio:['ignore','pipe','pipe'],shell:false,cwd:path.dirname(config.binary)});
        } catch(error){finish({success:false,error:'Could not start whisper.cpp: '+error.message});return;}
        this.active={child,cancel:()=>{
          try{child.kill();}catch{}
          finish({success:false,cancelled:true,error:'Whisper listening cancelled.'});
        }};
        child.stdout.on('data',()=>{}); // Printed text is not authoritative: read the output file.
        child.stderr.on('data',bytes=>{stderr=(stderr+bytes.toString()).slice(-600);});
        child.once('error',error=>finish({success:false,error:'whisper.cpp could not start: '+error.message}));
        child.once('close',code=>{
          if(settled)return;
          if(code!==0){finish({success:false,error:'whisper.cpp exited with code '+code+'. '+stderr.slice(0,160)});return;}
          try {
            const value=this.fileSystem.readFileSync(output+'.txt','utf8').trim();
            const transcript=value.replace(/\s+/g,' ').trim();
            if(!transcript || /^\[(?:blank_audio|silence|music|noise)\]$/i.test(transcript)){
              finish({success:true,silence:true,text:''});return;
            }
            if(transcript.length>MAX_TRANSCRIPT) throw Error('Whisper returned an unexpectedly long transcript.');
            // Whisper CPP does not report a comparable calibrated confidence.
            // Never invent one to activate hands-free execution.
            finish({success:true,text:transcript,language:'en'});
          }catch(error){finish({success:false,error:'Could not verify Whisper transcript: '+error.message});}
        });
        timer=setTimeout(()=>{
          try{child.kill();}catch{}
          finish({success:false,error:'Whisper transcription timed out. Try a smaller model or Windows dictation.'});
        },this.timeoutMs);
      });
    } catch(error) {
      try{this.fileSystem.rmSync(folder,{recursive:true,force:true});}catch{}
      return {success:false,error:error.message||'Whisper speech recording failed.'};
    }
  }

  cancel() {
    if (!this.active) return {success:true,cancelled:false};
    this.active.cancel();
    return {success:true,cancelled:true};
  }
}
module.exports={WhisperSpeechController,validateWave,safeSelection,MAX_WAV_BYTES};
