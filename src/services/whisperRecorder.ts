// One-shot microphone capture for opt-in offline whisper.cpp inference.
// Audio is buffered only in memory, converted to 16kHz PCM and handed to the
// trusted Electron process. No browser speech service receives the recording.
export function encodeMonoPcm16(samples: Float32Array, sampleRate: number): Uint8Array {
  if (!(samples instanceof Float32Array) || !Number.isFinite(sampleRate) ||
      sampleRate < 8000 || sampleRate > 192000 || samples.length > sampleRate * 18 ||
      samples.length < sampleRate * 0.1) {
    throw Error('Invalid audio samples for local speech recognition.');
  }
  const outputRate=16000;
  const count=Math.min(16_000 * 18, Math.floor(samples.length * outputRate / sampleRate));
  const bytes=new Uint8Array(44+count*2);
  const view=new DataView(bytes.buffer);
  const str=(offset:number,value:string)=>{for(let i=0;i<value.length;i++)view.setUint8(offset+i,value.charCodeAt(i));};
  str(0,'RIFF'); view.setUint32(4,bytes.length-8,true);str(8,'WAVE');
  str(12,'fmt ');view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,1,true);
  view.setUint32(24,outputRate,true);view.setUint32(28,32000,true);
  view.setUint16(32,2,true);view.setUint16(34,16,true);
  str(36,'data');view.setUint32(40,count*2,true);
  for(let i=0;i<count;i++){
    const index=i*sampleRate/outputRate;
    const a=Math.floor(index);
    const fraction=index-a;
    const current=samples[Math.min(a,samples.length-1)]||0;
    const next=samples[Math.min(a+1,samples.length-1)]||0;
    const value=Math.max(-1,Math.min(1,current+(next-current)*fraction));
    view.setInt16(44+i*2,value<0?Math.round(value*32768):Math.round(value*32767),true);
  }
  return bytes;
}

export class LocalWhisperRecorder {
  private stream: MediaStream | null = null;
  private recorder: MediaRecorder | null = null;
  private context: AudioContext | null = null;
  private monitor: ReturnType<typeof setInterval> | null = null;
  private stopping = false;
  private cancelled = false;
  private request = 0;
  private pendingCancellation: ((error: Error) => void) | null = null;

  cancel() {
    this.cancelled = true;
    ++this.request;
    if(this.monitor){clearInterval(this.monitor);this.monitor=null;}
    if(this.recorder?.state === 'recording') {
      try{this.recorder.stop();}catch{}
    }
    this.stream?.getTracks().forEach(track=>track.stop());
    this.stream=null;
    if(this.context){void this.context.close().catch(()=>{});this.context=null;}
    // Some Windows audio drivers never deliver MediaRecorder.onstop.
    // An explicit cancellation must still settle the pending capture.
    this.pendingCancellation?.(Error('Recording cancelled.'));
    this.pendingCancellation = null;
  }

  async capture(onLevel?: (value:number)=>void):Promise<Uint8Array>{
    this.cancel();
    this.cancelled = false;
    this.stopping = false;
    const request=++this.request;
    if(!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined')
      throw Error('Local Whisper needs a working microphone and MediaRecorder in the desktop app.');
    const stream=await navigator.mediaDevices.getUserMedia({
      audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true}
    });
    if(this.cancelled || request!==this.request){
      stream.getTracks().forEach(track=>track.stop());
      throw Error('Recording cancelled.');
    }
    this.stream=stream;
    try{
      const Context=window.AudioContext || (window as any).webkitAudioContext;
      if(!Context)throw Error('Audio decoding is unavailable in this Electron build.');
      const context=new Context() as AudioContext;
      this.context=context;
      const analyser=context.createAnalyser();
      analyser.fftSize=2048;
      context.createMediaStreamSource(stream).connect(analyser);
      const meter=new Float32Array(analyser.fftSize);
      const chunks:Blob[]=[];
      const mediaType=MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : '';
      const recorder=mediaType ? new MediaRecorder(stream,{mimeType:mediaType}) : new MediaRecorder(stream);
      this.recorder=recorder;
      const started=Date.now();
      let heardSpeech=false, lastVoice=started;
      const finishRecording=()=>{if(recorder.state==='recording'&&!this.stopping){
        this.stopping=true;recorder.stop();
      }};
      return await new Promise<Uint8Array>((resolve,reject)=>{
        let finished=false;
        const settle=async(error?:Error)=>{
          if(finished)return;finished=true;
          if (this.pendingCancellation === cancelPending) this.pendingCancellation = null;
          if(this.monitor)clearInterval(this.monitor);
          this.monitor=null;
          stream.getTracks().forEach(track=>track.stop());
          this.stream=null;
          onLevel?.(0);
          try{
            if(error||this.cancelled||request!==this.request)throw error || Error('Recording cancelled.');
            if(!heardSpeech)throw Error('No clear speech detected. Try speaking closer to your microphone.');
            const payload=new Blob(chunks,{type:mediaType||recorder.mimeType});
            if(payload.size<100)throw Error('Microphone recording was empty.');
            const decoded=await context.decodeAudioData(await payload.arrayBuffer());
            if(this.cancelled||request!==this.request)throw Error('Recording cancelled.');
            const combined=new Float32Array(decoded.length);
            for(let channel=0;channel<decoded.numberOfChannels;channel++){
              const samples=decoded.getChannelData(channel);
              for(let i=0;i<combined.length;i++)combined[i]+=samples[i]/decoded.numberOfChannels;
            }
            resolve(encodeMonoPcm16(combined,decoded.sampleRate));
          }catch(err){reject(err instanceof Error?err:Error('Could not prepare local Whisper audio.'));}
          finally{
            try{await context.close();}catch{}
            if(this.context===context)this.context=null;
            if(this.recorder===recorder)this.recorder=null;
          }
        };
        const cancelPending = (error: Error) => { void settle(error); };
        this.pendingCancellation = cancelPending;
        recorder.ondataavailable=event=>{if(event.data.size)chunks.push(event.data);};
        recorder.onerror=()=>{finishRecording();void settle(Error('Microphone recorder encountered an error.'));};
        recorder.onstop=()=>{void settle();};
        try{recorder.start(250);}catch(error){
          void settle(error instanceof Error?error:Error('Could not start local microphone recording.'));return;
        }
        this.monitor=setInterval(()=>{
          if(this.cancelled||request!==this.request){cancelPending(Error('Recording cancelled.'));return;}
          analyser.getFloatTimeDomainData(meter);
          let energy=0;
          for(const sample of meter)energy+=sample*sample;
          const rms=Math.sqrt(energy/meter.length);
          const level=Math.min(1,rms*16);
          onLevel?.(level);
          const now=Date.now();
          if(rms>=0.016){heardSpeech=true;lastVoice=now;}
          if(now-started>=11000 || (!heardSpeech&&now-started>=5200) ||
             (heardSpeech&&now-lastVoice>=1100&&now-started>=850))finishRecording();
        },90);
      });
    }catch(error){
      this.cancel();
      throw error;
    }
  }
}
