import React from 'react';
import { CharacterId, CharacterState } from '../../types';
import { StudioCharacter } from './StudioCharacter';

interface Props {
  characterId: CharacterId;
  state: CharacterState;
  scale?: number;
  audioLevel?: number;
  customAssetUrl?: string;
}

export const CharacterRenderer: React.FC<Props> = ({
  characterId,
  state,
  scale = 1,
  audioLevel = 0,
  customAssetUrl
}) => {
  if (characterId === 'custom' && customAssetUrl) {
    return (
      <div 
        className="relative flex items-center justify-center transition-transform duration-300 pointer-events-none select-none"
        style={{ transform: `scale(${scale})` }}
      >
        <img 
          src={customAssetUrl} 
          alt="Custom Character" 
          className={`w-36 h-36 object-contain drop-shadow-[0_8px_16px_rgba(0,0,0,0.2)] ${
            state === 'success' ? 'animate-companio-celebrate' :
            state === 'waking' ? 'animate-companio-wake' :
            state === 'listening' ? 'animate-companio-listen' :
            state === 'thinking' ? 'animate-companio-think' :
            state === 'sleeping' ? 'opacity-70' : 'animate-companio-idle'
          }`}
        />
      </div>
    );
  }

  return <StudioCharacter characterId={characterId} state={state} scale={scale} audioLevel={audioLevel} />;
};
