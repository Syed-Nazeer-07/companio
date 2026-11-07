import React, { useState } from 'react';
import { AppSettings, CharacterId, CharacterState } from '../../types';
import { CharacterRenderer } from '../characters/CharacterRenderer';
import { Check, Upload, Sliders } from 'lucide-react';

interface Props {
  settings: AppSettings;
  onUpdateSettings: (newSettings: Partial<AppSettings>) => void;
}

export const CharacterStudioPage: React.FC<Props> = ({ settings, onUpdateSettings }) => {
  const [previewState, setPreviewState] = useState<CharacterState>('idle');
  const [customAssetUrl, setCustomAssetUrl] = useState<string>('');
  const [importError, setImportError] = useState<string | null>(null);

  const characters = [
    {
      id: 'sparky' as CharacterId,
      name: 'Sparky',
      role: 'Cute Animated Robot',
      desc: 'Friendly cybernetic companion with digital visor, thruster flames, and mechanical gestures.',
      color: 'from-sky-500 to-blue-600'
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
      color: 'from-pink-400 to-sky-400'
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

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    setImportError(null);
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.includes('image/svg') && !file.type.includes('image/png')) {
      setImportError('Invalid format. Please upload an SVG or PNG asset.');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setImportError('File exceeds 2MB limit.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const url = event.target?.result as string;
      setCustomAssetUrl(url);
      onUpdateSettings({ characterId: 'custom' });
    };
    reader.readAsDataURL(file);
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
      <div>
        <h2 className="text-2xl font-bold text-slate-900 mb-1.5">Character Studio</h2>
        <p className="text-sm text-slate-600">
          Select, preview, and customize your desktop assistant companion. Each character features fluid high framerate animations and reactive expressions.
        </p>
      </div>

      {/* Main Studio Viewport */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Interactive Preview & State Tester */}
        <div className="acrylic-card rounded-2xl p-6 flex flex-col items-center justify-between border border-slate-200 min-h-[380px] shadow-sm">
          <div className="w-full flex items-center justify-between text-xs text-slate-500 pb-3 border-b border-slate-100">
            <span className="font-bold text-slate-800">Live Animation Preview</span>
            <span className="capitalize text-sky-600 font-semibold">State: {previewState}</span>
          </div>

          <div className="relative w-48 h-56 flex items-center justify-center my-4">
            <CharacterRenderer
              characterId={settings.characterId}
              state={previewState}
              scale={settings.overlay.scale}
              customAssetUrl={customAssetUrl}
            />
          </div>

          {/* Animation State Tester Buttons */}
          <div className="w-full space-y-2">
            <p className="text-[11px] text-slate-500 font-bold uppercase tracking-wider">Trigger Expression:</p>
            <div className="flex flex-wrap gap-1.5">
              {testStates.map((st) => (
                <button
                  key={st}
                  onClick={() => setPreviewState(st)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold capitalize transition-all ${
                    previewState === st
                      ? 'bg-sky-500 text-white shadow-sm'
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
            <Sliders className="w-4 h-4 text-sky-600" />
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
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 text-sm font-semibold focus:outline-none focus:border-sky-500 focus:bg-white"
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
                className="w-full accent-sky-500 h-2 bg-slate-200 rounded-lg cursor-pointer mt-3"
              />
            </div>
          </div>

          {/* Custom Asset Import Section */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Upload className="w-3.5 h-3.5 text-sky-600" />
                Import Custom Asset
              </span>
              <span className="text-[10px] text-slate-400">Supported: SVG, PNG (up to 2MB)</span>
            </div>
            <p className="text-xs text-slate-500 mb-3">
              Upload custom character art. Companio will automatically validate format and apply breathing and floating idle animations.
            </p>
            <input
              type="file"
              accept=".svg,.png"
              onChange={handleFileUpload}
              className="text-xs text-slate-600 file:mr-3 file:py-1.5 file:px-3.5 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-sky-500 file:text-white hover:file:bg-sky-600 cursor-pointer"
            />
            {importError && (
              <p className="text-xs text-rose-600 font-semibold mt-2">{importError}</p>
            )}
          </div>
        </div>
      </div>

      {/* Character Gallery Grid */}
      <div>
        <h3 className="text-base font-bold text-slate-900 mb-4">Cute Character Gallery</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {characters.map((char) => {
            const isSelected = settings.characterId === char.id;
            return (
              <div
                key={char.id}
                onClick={() => handleSelect(char.id)}
                className={`acrylic-card rounded-2xl p-5 cursor-pointer relative border transition-all ${
                  isSelected
                    ? 'border-sky-500 ring-2 ring-sky-500/20 bg-sky-50/60 shadow-md'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                {isSelected && (
                  <div className="absolute top-4 right-4 w-6 h-6 rounded-full bg-sky-500 text-white flex items-center justify-center shadow-md">
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
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
