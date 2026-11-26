import React from 'react';
import { CharacterId, CharacterState } from '../../types';
import { characterCollection } from './characterCollection';

export function StudioCharacter({characterId,state,scale=1,audioLevel=0}:{characterId:CharacterId;state:CharacterState;scale?:number;audioLevel?:number}) {
 const model=characterCollection.find(c=>c.id===characterId) || characterCollection[0];
 const speaking=state==='talking';
 const eyeHeight=state==='sleeping'?3:state==='thinking'?6:state==='listening'?20:14;
 const mouth=speaking? Math.max(3,Math.min(14,3+(Number.isFinite(audioLevel)?audioLevel:0)*11)):2.5;
 const animation=state==='waking'?'animate-companio-wake':state==='listening'?'animate-companio-listen':state==='thinking'?'animate-companio-think':state==='success'?'animate-companio-celebrate':state==='sleeping'?'':'animate-companio-idle';
 return <div className="pointer-events-none select-none flex items-center justify-center" style={{transform:`scale(${scale})`}}>
  <svg width="160" height="180" viewBox="0 0 160 180" aria-hidden="true" data-character={model.id} data-state={state} className={`studio-character ${animation}`}>
    <image href={`${import.meta.env.BASE_URL}characters/${model.id}.svg`} width="160" height="180"/>
    <g fill={model.accent} stroke={model.accent} strokeLinecap="round">
      {state==='success'?<g fill="none" strokeWidth="3"><path d="M53 78Q59 65 66 78"/><path d="M94 78Q101 65 107 78"/></g>:state==='confused'?<><rect x="53" y="66" width="13" height="16" rx="5"/><path d="M94 77L107 72" strokeWidth="3"/></>:<>
        <rect x="53" y={76-eyeHeight/2} width="13" height={eyeHeight} rx={Math.min(5,eyeHeight/2)}/>
        <rect x="94" y={76-eyeHeight/2} width="13" height={eyeHeight} rx={Math.min(5,eyeHeight/2)}/>
      </>}
      {state==='success'?<path d="M73 87 Q80 94 87 87" fill="none" strokeWidth="2"/>:<rect x="74" y={89-mouth/2} width="12" height={mouth} rx={mouth/2}/>}
    </g>
  </svg>
 </div>;
}
