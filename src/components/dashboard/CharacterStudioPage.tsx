import React, { useState, useEffect } from 'react';
import { AppSettings, CharacterId, CharacterState } from '../../types';
import { CharacterRenderer } from '../characters/CharacterRenderer';
import { characterCollection } from '../characters/characterCollection';
import { Check, Sliders, Volume2 } from 'lucide-react';

interface Props {
  settings: AppSettings;
  onUpdateSettings: (newSettings: Partial<AppSettings>) => void;
}

export const CharacterStudioPage: React.FC<Props> = ({ settings, onUpdateSettings }) => {
  const [previewState, setPreviewState] = useState<CharacterState>('idle');
  const [previewAudioLevel, setPreviewAudioLevel] = useState(0);

  const characters = characterCollection;
  const activeProfile = characters.find((c) => c.id === settings.characterId) || characters[0];

  useEffect(() => {
    if (previewState !== 'talking') {
      setPreviewAudioLevel(0);
      return;
    }
    let phase = 0;
    const timer = window.setInterval(() => {
      phase += 0.45;
      setPreviewAudioLevel(Number((0.35 + Math.abs(Math.sin(phase)) * 0.55).toFixed(2)));
    }, 110);
    return () => window.clearInterval(timer);
  }, [previewState]);

  const handleSelect = (id: CharacterId) => {
    onUpdateSettings({ characterId: id });
  };

  const testStates: CharacterState[] = [
    'idle',
    'waking',
    'listening',
    'thinking',
    'talking',
    'success',
    'confused',
    'sleeping'
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-200">
      <div>
        <h2 className="text-2xl font-bold text-slate-900 mb-1.5">Character Studio</h2>
        <p className="text-sm text-slate-600">
          Choose a distinctive companion and preview its actual interaction states before using it on your desktop.
        </p>
      </div>

      {/* Main Studio Viewport */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Interactive Preview & State Tester */}
        <div className="acrylic-card rounded-2xl p-6 flex flex-col items-center justify-between border border-slate-200 min-h-[380px] shadow-sm">
          <div className="w-full flex items-center justify-between text-xs text-slate-500 pb-3 border-b border-slate-100">
            <span className="font-bold text-slate-800">Live Animation Preview</span>
            <span className="capitalize text-emerald-700 font-semibold">State: {previewState}</span>
          </div>

          <div className="relative w-48 h-56 flex items-center justify-center my-4">
            <CharacterRenderer
              characterId={settings.characterId}
              state={previewState}
              scale={settings.overlay.scale}
              audioLevel={previewAudioLevel}
            />
          </div>

          {/* Animation State Tester Buttons */}
          <div className="w-full space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[11px] text-slate-500 font-bold uppercase tracking-wider">Trigger Expression:</p>
              <button
                type="button"
                onClick={() => setPreviewState((prev) => (prev === 'talking' ? 'idle' : 'talking'))}
                className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold border transition-colors ${
                  previewState === 'talking'
                    ? 'border-emerald-700 bg-emerald-700 text-white'
                    : 'border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                }`}
              >
                <Volume2 className="w-3 h-3" />
                {previewState === 'talking' ? 'Stop speaking' : 'Preview Speaking'}
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {testStates.map((st) => (
                <button
                  key={st}
                  onClick={() => setPreviewState(st)} aria-pressed={previewState === st}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold capitalize transition-all ${
                    previewState === st
                      ? 'bg-emerald-700 text-white shadow-sm'
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
        <div className="lg:col-span-2 acrylic-card rounded-2xl p-6 space-y-6 border border-slate-200 shadow-sm">
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Sliders className="w-4 h-4 text-emerald-700" />
            <span>Companion Customization</span>
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Assistant Name
              </label>
              <input
                type="text"
                value={settings.characterName}
                onChange={(e) => onUpdateSettings({ characterName: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 text-sm font-semibold focus:outline-none focus:border-emerald-700 focus:bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Character Scale: {Math.round(settings.overlay.scale * 100)}%
              </label>
              <input
                type="range"
                min="0.6"
                max="1.4"
                step="0.05"
                value={settings.overlay.scale}
                onChange={(e) => onUpdateSettings({
                  overlay: { ...settings.overlay, scale: parseFloat(e.target.value) }
                })}
                className="w-full accent-emerald-700 h-2 bg-slate-200 rounded-lg cursor-pointer mt-3"
              />
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 space-y-2 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-bold text-slate-900">{activeProfile.name} · {activeProfile.role}</span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-0.5 text-[11px] font-semibold text-slate-700 border border-slate-200">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: activeProfile.accent }} />
                Optic signature
              </span>
            </div>
            <p className="text-slate-600"><strong className="text-slate-800">Personality:</strong> {activeProfile.personality}</p>
            <p className="text-slate-600"><strong className="text-slate-800">Optics:</strong> {activeProfile.opticsStyle}</p>
            <p className="text-slate-600"><strong className="text-slate-800">Voice cadence:</strong> {activeProfile.voiceSummary}</p>
          </div>
        </div>
      </div>

      {/* Character Gallery Grid */}
      <div>
        <h3 className="text-base font-bold text-slate-900 mb-4">Companion collection</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {characters.map((char) => {
            const isSelected = settings.characterId === char.id;
            return (
              <button type="button"
                key={char.id}
                aria-pressed={isSelected}
                onClick={() => handleSelect(char.id)}
                className={`acrylic-card rounded-2xl p-5 cursor-pointer relative border transition-all text-left ${
                  isSelected
                    ? 'border-emerald-700 ring-2 ring-emerald-700/20 bg-emerald-50/60 shadow-md'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                {isSelected && (
                  <div className="absolute top-4 right-4 w-6 h-6 rounded-full bg-emerald-700 text-white flex items-center justify-center shadow-md">
                    <Check className="w-3.5 h-3.5 stroke-[3]" />
                  </div>
                )}

                <div className="h-28 flex items-center justify-center mb-3">
                  <CharacterRenderer characterId={char.id} state="idle" scale={0.7} />
                </div>

                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h4 className="font-bold text-slate-900 text-base">{char.name}</h4>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-semibold border border-slate-200">
                      {char.role}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    {char.desc}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
