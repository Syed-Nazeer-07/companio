import React, { useLayoutEffect, useRef, useState } from 'react';
import type { AppSettings, CharacterId } from '../../types';
import { CharacterRenderer } from '../characters/CharacterRenderer';
import { ArrowRight, Check, X } from 'lucide-react';

const characters: Array<{ id: CharacterId; label: string; description: string; background: string }> = [
  { id: 'sparky', label: 'Sparky', description: 'Robot', background: '#e5f0e5' },
  { id: 'pixel', label: 'Pixel', description: 'Fox', background: '#f3e7dc' },
  { id: 'mochi', label: 'Mochi', description: 'Soft mascot', background: '#f6e9dc' },
  { id: 'cloudie', label: 'Cloudie', description: 'Cloud', background: '#e2edf2' },
  { id: 'kiko', label: 'Kiko', description: 'Kitten', background: '#eee7f3' },
  { id: 'boba', label: 'Boba', description: 'Bear', background: '#eee4d6' }
];

interface Props {
  settings: AppSettings;
  onUpdateLive?: (updated: Partial<AppSettings>) => void;
  onComplete: (updated: Partial<AppSettings>) => void;
  onClose: () => void;
}

export const SetupWizardModal: React.FC<Props> = ({ settings, onUpdateLive, onComplete, onClose }) => {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [selected, setSelected] = useState<CharacterId>(settings.characterId);
  const [name, setName] = useState(settings.characterName);

  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);

  const finish = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onComplete({
      characterId: selected,
      characterName: name.trim().slice(0, 32) || 'Companio',
      ai: settings.firstTimeSetupDone ? settings.ai : { ...settings.ai, provider: 'mock' },
      voice: settings.firstTimeSetupDone ? settings.voice : { ...settings.voice, recognitionEngine: 'auto' },
      firstTimeSetupDone: true
    });
  };

  return (
    <dialog ref={dialogRef} aria-labelledby="companio-welcome-heading" className="setup-dialog"
      onCancel={event => { event.preventDefault(); onClose(); }}>
      <header className="setup-header">
        <div>
          <p>Welcome to Companio</p>
          <h2 id="companio-welcome-heading">Choose your companion</h2>
        </div>
        <button type="button" onClick={onClose} aria-label="Close welcome setup" className="setup-close">
          <X size={19} aria-hidden="true" />
        </button>
      </header>

      <form onSubmit={finish} className="setup-form">
        <p className="text-sm text-slate-700">Pick a character and give it a name. You can change both anytime in Character Studio.</p>
        <fieldset aria-label="Companion characters" className="setup-characters">
          {characters.map(character => (
            <div key={character.id} className="setup-choice">
              <div className="setup-thumbnail" style={{ backgroundColor: character.background }} aria-hidden="true">
                <CharacterRenderer characterId={character.id} state="idle" scale={0.45} />
              </div>
              <button type="button" aria-pressed={selected === character.id}
                onClick={() => {
                  setSelected(character.id);
                  onUpdateLive?.({ characterId: character.id });
                }}>
                {selected === character.id && <Check size={16} className="setup-selected" aria-hidden="true" />}
                <strong>{character.label}</strong>
                <small>{character.description}</small>
              </button>
            </div>
          ))}
        </fieldset>
        <div className="setup-name">
          <label htmlFor="companio-welcome-name">Companion name <span>(optional)</span></label>
          <input id="companio-welcome-name" type="text" maxLength={32} value={name}
            onChange={event => setName(event.target.value)} placeholder="Companio" />
        </div>
        <footer className="setup-footer">
          <p>Basic commands work without an AI account. Use Voice Settings to adjust speech.</p>
          <button type="submit" className="workspace-primary">Start Companio <ArrowRight size={16} aria-hidden="true" /></button>
        </footer>
      </form>
    </dialog>
  );
};
