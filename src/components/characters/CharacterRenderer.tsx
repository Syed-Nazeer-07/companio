import React from 'react';
import { CharacterId, CharacterState } from '../../types';
import { SparkyRobot } from './SparkyRobot';
import { PixelMascot } from './PixelMascot';
import { Mochi3D } from './Mochi3D';
import { CloudieDream } from './CloudieDream';
import { KikoKitten } from './KikoKitten';
import { BobaBear } from './BobaBear';

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
            state === 'thinking' ? 'animate-pulse' : 
            state === 'sleeping' ? 'opacity-70' : 'animate-companio-idle'
          }`}
        />
      </div>
    );
  }

  switch (characterId) {
    case 'sparky':
      return <SparkyRobot state={state} scale={scale} audioLevel={audioLevel} />;
    case 'pixel':
      return <PixelMascot state={state} scale={scale} audioLevel={audioLevel} />;
    case 'mochi':
      return <Mochi3D state={state} scale={scale} audioLevel={audioLevel} />;
    case 'cloudie':
      return <CloudieDream state={state} scale={scale} audioLevel={audioLevel} />;
    case 'kiko':
      return <KikoKitten state={state} scale={scale} audioLevel={audioLevel} />;
    case 'boba':
      return <BobaBear state={state} scale={scale} audioLevel={audioLevel} />;
    default:
      return <SparkyRobot state={state} scale={scale} audioLevel={audioLevel} />;
  }
};
