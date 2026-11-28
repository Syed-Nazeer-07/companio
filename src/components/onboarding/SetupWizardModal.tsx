import React, { useEffect, useRef, useState } from 'react';
import { AppSettings, CharacterId } from '../../types';
import { CharacterRenderer } from '../characters/CharacterRenderer';
import { characterCollection } from '../characters/characterCollection';
import { desktopBridge, isNativeDesktop } from '../../services/desktopBridge';
interface Props {
  isOpen: boolean; settings: AppSettings;
  onUpdateLive?: (updated: Partial<AppSettings>) => void;
  onComplete: (updated: Partial<AppSettings>) => void;
  onClose: () => void;
}
export const SetupWizardModal: React.FC<Props> = ({isOpen, settings, onUpdateLive, onComplete, onClose}) => {
 const dialogRef = useRef<HTMLElement>(null);
 const [step,setStep]=useState(0);
 const [selected,setSelected]=useState<CharacterId>(settings.characterId);
 const [name,setName]=useState(settings.characterName);
 const [muted,setMuted]=useState(settings.voice.muted);
 const [aiChoice,setAiChoice]=useState<'auto'|'managed_local'|'cloud'>('auto');
 const [managedStatus,setManagedStatus]=useState<any>(null);
 const [installProgress,setInstallProgress]=useState<any>(null);
 const [installingAi,setInstallingAi]=useState(false);
 const [startup,setStartup]=useState<Awaited<ReturnType<typeof desktopBridge.getStartupStatus>> | null>(null);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 useEffect(()=>{
   if(!isOpen)return;
   setStep(0);setSelected(settings.characterId);setName(settings.characterName);setMuted(settings.voice.muted);setError('');setStartup(null);
   let active=true;
   void desktopBridge.getStartupStatus().then(result=>{if(active)setStartup(result);}).catch(()=>{if(active)setError('Could not read startup settings.');});
   requestAnimationFrame(()=>{dialogRef.current?.focus();});
   return ()=>{active=false;};
 },[isOpen]);
 useEffect(()=>{
   if(!isOpen)return;
   let active=true;
   void desktopBridge.getManagedAiStatus().then(st=>{
     if(!active||!st)return;
     setManagedStatus(st);
     if(st?.installerSetup?.mode==='local_now') setAiChoice('managed_local');
     else if(st?.installerSetup?.mode==='cloud') setAiChoice('cloud');
     else setAiChoice('auto');
   }).catch(()=>{});
   const unbind = desktopBridge.onManagedAiProgress((p)=>setInstallProgress(p));
   return ()=>{active=false;unbind();};
 },[isOpen]);
 useEffect(()=>{
   if(!isOpen)return;
   const onKeyDown=(e:KeyboardEvent)=>{
     if(e.key==='Escape'&&!busy){e.preventDefault();onClose();return;}
     if(e.key==='Tab'&&dialogRef.current){
       const items=Array.from(dialogRef.current.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'));
       if(items.length===0){e.preventDefault();return;}
       const first=items[0];
       const last=items[items.length-1];
       if(e.shiftKey&&(document.activeElement===first||document.activeElement===dialogRef.current)){e.preventDefault();last.focus();}
       else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
     }
   };
   window.addEventListener('keydown',onKeyDown);
   return ()=>{window.removeEventListener('keydown',onKeyDown);};
 },[isOpen,busy,onClose]);
 if(!isOpen)return null;
 const finish=()=>{
   void desktopBridge.consumeInstallerAiSetup?.();
   const nextProvider = settings.firstTimeSetupDone
     ? settings.ai.provider
     : (aiChoice === 'cloud' ? 'openai' : 'auto');
   onComplete({
     characterId:selected,
     characterName:name.trim().slice(0,32)||'Companio',
     ai:{...settings.ai,provider:nextProvider,managedModelId:settings.ai.managedModelId||'qwen2.5-1.5b'},
     voice:{...settings.voice,muted,recognitionEngine:settings.firstTimeSetupDone?settings.voice.recognitionEngine:'auto'},
     firstTimeSetupDone:true
   });
 };
 const installRecommendedNow=async()=>{
   if(installingAi)return;
   setInstallingAi(true);setError('');
   try{
     const res=await desktopBridge.installManagedAiBundle({modelId:managedStatus?.recommendedModelId||'qwen2.5-1.5b'});
     setInstallProgress(null);
     const updated=await desktopBridge.getManagedAiStatus();
     setManagedStatus(updated);
     if(!res?.success) setError(res?.error||'Local AI download did not finish. Built-in mode still works offline.');
   }catch(e){setError(e instanceof Error?e.message:'Could not download local AI.');}
   finally{setInstallingAi(false);}
 };
 const changeStartup=async(enabled:boolean)=>{
   setBusy(true);setError('');
   try{const result=await desktopBridge.setStartupEnabled(enabled);setStartup(result);if(!result.success)setError(result.error||'Windows did not confirm the change.');}
   catch(e){setError(e instanceof Error?e.message:'Startup update failed.');}finally{setBusy(false);}
 };
 return <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60">
  <section ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="companio-welcome-heading" className="w-full max-w-2xl max-h-[95vh] overflow-auto bg-white text-slate-900 rounded-xl border border-slate-200 p-7 shadow-2xl outline-none">
   <header className="flex justify-between items-center gap-4 pb-4 border-b border-slate-200">
    <div><p className="text-xs font-semibold text-slate-500 uppercase tracking-widest">Companio / Setup · {step+1} of 3</p><h2 id="companio-welcome-heading" className="text-2xl font-semibold mt-2">{['Meet your companion','AI, voice and privacy','Make it yours'][step]}</h2></div>
    <button type="button" onClick={onClose} disabled={busy||installingAi} className="text-sm text-slate-500">Skip setup</button>
   </header>
   <div className="flex gap-1 mt-4" aria-hidden="true">{[0,1,2].map(n=><div key={n} className={'h-1 flex-1 rounded '+(n<=step?'bg-emerald-700':'bg-slate-200')}/>)}</div>
   {step===0&&<><p className="text-sm text-slate-600 mt-5">Choose your companion. You can change this later.</p><div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-3">{characterCollection.map(c=><button type="button" key={c.id} aria-pressed={selected===c.id} onClick={()=>{setSelected(c.id);onUpdateLive?.({characterId:c.id});}} className={'border p-2 rounded-lg text-center '+(selected===c.id?'border-emerald-700 bg-emerald-50':'border-slate-200 bg-slate-50')}><div className="h-24 flex items-center justify-center"><CharacterRenderer characterId={c.id} state={selected===c.id?'listening':'idle'} scale={.52}/></div><strong className="block text-sm">{c.name}</strong><span className="text-xs text-slate-600">{c.role}</span></button>)}</div></>}
   {step===1&&<div className="space-y-4 mt-5">
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-2">
     <div className="flex items-center justify-between gap-2">
      <strong className="text-sm text-slate-900">Private On-Device Local AI</strong>
      <span className="text-[11px] font-semibold text-emerald-800">{managedStatus?.ready?'Installed & Ready':'Optional · ~1.05 GB'}</span>
     </div>
     <p className="text-xs text-slate-600">Built-in desktop commands, math, timers, notes, and searches work offline now without Ollama or API keys. Optionally install Managed Local AI (Qwen 2.5 1.5B) for full conversations.</p>
     {!managedStatus?.ready&&isNativeDesktop()&&<div className="flex flex-wrap items-center gap-2 pt-1">
      <button type="button" disabled={installingAi} onClick={()=>void installRecommendedNow()} className="rounded-lg bg-emerald-700 hover:bg-emerald-800 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50">{installingAi?(installProgress?.percent!=null?`Downloading ${installProgress.percent}%...`:'Installing Local AI...'):'Install Local AI Now (~1.05 GB)'}</button>
      {installingAi&&<button type="button" onClick={()=>void desktopBridge.cancelManagedAiDownload({discardPartial:false})} className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700">Pause / Later</button>}
     </div>}
    </div>
    <p className="text-sm text-slate-700">Voice input uses offline Whisper when bundled, otherwise Windows speech. Companio listens only when activated. You can test recognition in Voice Settings after setup.</p>
    <label className="flex items-center gap-3 rounded-lg border border-slate-200 p-4"><input type="checkbox" checked={!muted} onChange={e=>setMuted(!e.target.checked)}/><span><strong className="block text-sm">Enable spoken responses</strong><span className="text-xs text-slate-600">Controls text-to-speech, not microphone access.</span></span></label>
    {error&&<p role="alert" className="text-xs text-rose-700">{error}</p>}
   </div>}
   {step===2&&<div className="space-y-4 mt-5"><label className="block text-sm font-medium">Companion name<input value={name} maxLength={32} onChange={e=>setName(e.target.value)} className="block w-full mt-2 border border-slate-300 p-3 rounded-lg"/></label><p className="text-sm text-slate-600">Summon your companion using <kbd className="font-mono text-xs">{settings.activationShortcut}</kbd>.</p><label className="flex gap-3 items-center border border-slate-200 rounded-lg p-4"><input type="checkbox" checked={startup?.enabled===true} disabled={busy||!startup?.success||!startup.supported} onChange={e=>void changeStartup(e.target.checked)}/><span><strong className="block text-sm">Launch at Windows sign-in</strong><span className="text-xs text-slate-600">{startup?.supported?'Applies immediately to Windows startup.':'Available in the installed Windows app.'}</span></span></label>{error&&<p role="alert" className="text-sm text-rose-700">{error}</p>}</div>}
   <footer className="flex justify-between gap-4 border-t border-slate-200 mt-6 pt-4"><button type="button" disabled={!step||busy||installingAi} onClick={()=>setStep(s=>s-1)} className="px-4 py-2 text-sm disabled:opacity-30">Back</button><button type="button" disabled={busy||installingAi} onClick={()=>step===2?finish():setStep(s=>s+1)} className="rounded-lg bg-emerald-800 text-white px-6 py-2 text-sm font-semibold">{step===2?'Start Companio':'Continue'}</button></footer>
  </section>
 </div>;
};
