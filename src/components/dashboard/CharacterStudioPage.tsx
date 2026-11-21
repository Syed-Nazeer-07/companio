import React, { useState } from 'react';
import { AppSettings, CharacterId, CharacterState } from '../../types';
import { CharacterRenderer } from '../characters/CharacterRenderer';
import { Check, Sliders } from 'lucide-react';

interface Props {
  settings: AppSettings;
  onUpdateSettings: (newSettings: Partial<AppSettings>) => void;
}

export const CharacterStudioPage: React.FC<Props> = ({ settings, onUpdateSettings }) => {
  const [previewState, setPreviewState] = useState<CharacterState>('idle');

  const characters = [
    {
      id: 'sparky' as CharacterId,
      name: 'Sparky',
      role: 'Cute Animated Robot',
      desc: 'Friendly cybernetic companion with digital visor, thruster flames, and mechanical gestures.',
      color: 'from-teal-500 to-blue-600'
    },
    {
      id: 'pixel' as CharacterId,
      name: 'Pixel',
      role: '16-bit Retro Fox',
      desc: 'Authentic 16-bit retro arcade cyber-fox with pixel-perfect animations and nostalgic charm.',
      color: 'from-orange-500 to-amber-600'
    },
    {
      id: 'mochi' as CharacterId,
      name: 'Mochi',
      role: 'Squishy 3D Mascot',
      desc: 'Soft, squishy creature with 3D gradient shading, glossy reflections, and happy bouncing.',
      color: 'from-rose-400 to-orange-500'
    },
    {
      id: 'cloudie' as CharacterId,
      name: 'Cloudie',
      role: 'Dream Cloud & Star',
      desc: 'Pastel dream cloud with glowing blush cheeks, floating star companion, and rainbow sparkle.',
      color: 'from-pink-400 to-teal-400'
    },
    {
      id: 'kiko' as CharacterId,
      name: 'Kiko',
      role: 'Chibi Kitten',
      desc: 'Ultra-cute anime kitten with twitching ears, swishing tail, heart sparkles, and soft purring.',
      color: 'from-amber-400 to-rose-400'
    },
    {
      id: 'boba' as CharacterId,
      name: 'Boba',
      role: 'Boba Milk Tea Bear',
      desc: 'Smiling boba cup with bear ears on the lid, floating tapioca pearls, and bubbly sweet movements.',
      color: 'from-orange-400 to-yellow-500'
    }
  ];

  const handleSelect = (id: CharacterId) => {
    onUpdateSettings({ characterId: id });
  };

  const testStates: CharacterState[] = [
    'idle',
    'listening',
    'thinking',
    'talking',
    'success',
    'confused',
    'sleeping'
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-200">
      <header className="workspace-heading">
        <h1>Character Studio</h1>
        <p>Choose your companion, give it a name, and preview how it reacts.</p>
      </header>

      {/* Main Studio Viewport */}
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(270px,1fr)_minmax(0,1.25fr)] gap-5">
        {/* Left: Interactive Preview & State Tester */}
        <div className="workspace-panel rounded-2xl p-4 sm:p-6 flex flex-col items-center justify-between min-h-[300px]">
          <div className="w-full flex items-center justify-between text-xs text-slate-500 pb-3 border-b border-slate-100">
            <span className="font-bold text-slate-800">Live preview</span>
            <span className="capitalize text-teal-600 font-semibold">State: {previewState}</span>
          </div>

          <div className="relative w-full max-w-72 h-44 flex items-center justify-center my-4 rounded-xl bg-[#eaf1e6]">
            <CharacterRenderer
              characterId={settings.characterId}
              state={previewState}
              scale={settings.overlay.scale}
            />
          </div>

          {/* Animation State Tester Buttons */}
          <div className="w-full space-y-2">
            <p className="text-[11px] text-slate-500 font-bold uppercase tracking-wider">Preview an expression</p>
            <div className="flex flex-wrap gap-1.5">
              {testStates.map((st) => (
                <button
                  key={st}
                  type="button"
                  aria-pressed={previewState === st}
                  onClick={() => setPreviewState(st)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold capitalize transition-all ${
                    previewState === st
                      ? 'bg-teal-700 text-white shadow-sm'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right: Customization Controls */}
        <div className="workspace-panel rounded-2xl p-4 sm:p-6 space-y-6">
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Sliders className="w-4 h-4 text-teal-600" />
            <span>Customize companion</span>
          </h3>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <div>
              <label htmlFor="studio-name" className="block text-sm font-semibold text-slate-700 mb-1.5">
                Companion name
              </label>
              <input
                id="studio-name"
                type="text"
                value={settings.characterName}
                onChange={(e) => onUpdateSettings({ characterName: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 text-sm font-semibold focus:outline-none focus:border-teal-500 focus:bg-white"
              />
            </div>

            <div>
              <label htmlFor="studio-scale" className="block text-sm font-semibold text-slate-700 mb-1.5">
                Character size: {Math.round(settings.overlay.scale * 100)}%
              </label>
              <input
                id="studio-scale"
                type="range"
                min="0.6"
                max="1.4"
                step="0.05"
                value={settings.overlay.scale}
                onChange={(e) => onUpdateSettings({
                  overlay: { ...settings.overlay, scale: parseFloat(e.target.value) }
                })}
                className="w-full accent-teal-500 h-2 bg-slate-200 rounded-lg cursor-pointer mt-3"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Character Gallery Grid */}
      <div>
        <h3 className="text-base font-bold text-slate-900 mb-4">Choose a character</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {characters.map((char) => {
            const isSelected = settings.characterId === char.id;
            return (
              <button
                key={char.id}
                type="button"
                aria-pressed={isSelected}
                onClick={() => handleSelect(char.id)}
                className="workspace-panel relative min-w-0 rounded-xl p-3 text-left"
              >
                {isSelected && (
                  <span className="absolute right-3 top-3 z-10 grid h-6 w-6 place-items-center rounded-full bg-teal-700 text-white">
                    <Check size={14} aria-hidden="true" />
                  </span>
                )}
                <span className="mb-3 flex h-28 items-center justify-center rounded-lg bg-slate-100" aria-hidden="true">
                  <CharacterRenderer characterId={char.id} state="idle" scale={0.67} />
                </span>
                <span className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                  <strong className="text-base text-slate-900">{char.name}</strong>
                  <span className="text-[11px] font-semibold text-slate-600">{char.role}</span>
                </span>
                <span className="mt-1 block text-xs leading-relaxed text-slate-600">{char.desc}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
