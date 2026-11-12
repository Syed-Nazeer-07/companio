import React, { useState } from 'react';
import { AppSettings, CharacterId } from '../../types';
import { CharacterRenderer } from '../characters/CharacterRenderer';
import { Check, Mic, ShieldCheck } from 'lucide-react';

interface Props {
  isOpen: boolean;
  settings: AppSettings;
  onUpdateLive?: (updated: Partial<AppSettings>) => void;
  onComplete: (updated: Partial<AppSettings>) => void;
  onClose: () => void;
}

/**
 * One-screen first launch: Companio starts with built-in commands and the
 * automatic offline-first voice engine. No API key or Ollama setup required.
 * Advanced integrations are always optional in Control Center.
 */
export const SetupWizardModal: React.FC<Props> = ({
  isOpen, settings, onUpdateLive, onComplete, onClose
}) => {
  const [selected, setSelected] = useState<CharacterId>(settings.characterId);
  const [name, setName] = useState(settings.characterName);
  if (!isOpen) return null;
  const characters: { id: CharacterId; label: string; description: string }[] = [
    { id: 'sparky', label: 'Sparky', description: 'Robot' },
    { id: 'pixel', label: 'Pixel', description: 'Fox' },
    { id: 'mochi', label: 'Mochi', description: 'Squishy' },
    { id: 'cloudie', label: 'Cloudie', description: 'Cloud' },
    { id: 'kiko', label: 'Kiko', description: 'Kitten' },
    { id: 'boba', label: 'Boba', description: 'Bear' }
  ];
  const finish = () => onComplete({
    characterId: selected,
    characterName: name.trim().slice(0, 32) || 'Companio',
    ai: settings.firstTimeSetupDone ? settings.ai : { ...settings.ai, provider: 'mock' },
    voice: settings.firstTimeSetupDone ? settings.voice : { ...settings.voice, recognitionEngine: 'auto' },
    firstTimeSetupDone: true
  });
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/35 backdrop-blur-sm">
      <div role="dialog" aria-modal="true" aria-labelledby="companio-welcome-heading"
        className="w-full max-w-2xl max-h-[95vh] overflow-y-auto rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 text-slate-900 shadow-[0_25px_80px_rgba(0,0,0,0.18)]">
        <div className="flex justify-between items-start gap-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-sky-700">Welcome to Companio</p>
            <h2 id="companio-welcome-heading" className="mt-2 text-2xl font-bold tracking-tight">Pick your little desktop companion.</h2>
            <p className="mt-2 text-sm text-slate-600">That's all you need to start. Basic commands and voice are ready automatically where supported.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close welcome setup"
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-500 hover:bg-slate-50">
            Close
          </button>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {characters.map(character => (
            <button type="button" key={character.id} aria-pressed={selected===character.id}
              onClick={() => {
                setSelected(character.id);
                onUpdateLive?.({ characterId: character.id });
              }}
              className={'relative min-w-0 rounded-2xl border p-3 text-center transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-500 ' +
                (selected===character.id
                  ? 'border-sky-500 bg-sky-50 ring-2 ring-sky-100'
                  : 'border-slate-200 bg-slate-50 hover:bg-white hover:border-slate-300')}>
              {selected===character.id && <Check aria-hidden="true" className="absolute top-2 right-2 h-4 w-4 text-sky-600" />}
              <div className="h-[105px] flex items-center justify-center">
                <CharacterRenderer characterId={character.id} state="idle" scale={0.53} />
              </div>
              <div className="text-sm font-semibold">{character.label}</div>
              <div className="text-xs text-slate-500">{character.description}</div>
            </button>
          ))}
        </div>
        <label htmlFor="companio-welcome-name" className="mt-5 block text-xs font-semibold text-slate-700">Name (optional)</label>
        <input id="companio-welcome-name" type="text" maxLength={32} value={name}
          onChange={event=>setName(event.target.value)}
          className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
          placeholder="Companio" />
        <div className="mt-5 grid gap-2 text-xs text-slate-600 sm:grid-cols-2">
          <p className="flex items-start gap-2"><Mic className="h-4 w-4 flex-none text-sky-700" aria-hidden="true"/>Voice uses the bundled offline recognizer if available, otherwise Windows speech.</p>
          <p className="flex items-start gap-2"><ShieldCheck className="h-4 w-4 flex-none text-sky-700" aria-hidden="true"/>No API key, LLM server or elevated permission needed for basic commands.</p>
        </div>
        <button type="button" onClick={finish}
          className="mt-5 w-full rounded-xl bg-sky-600 px-5 py-3 text-sm font-bold text-white hover:bg-sky-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500">
          Start Companio
        </button>
        <p className="mt-3 text-center text-[11px] text-slate-500">Customize voices, advanced AI and startup behavior later in Control Center.</p>
      </div>
    </div>
  );
};
