import React, { useState, useRef, useEffect } from 'react';
import { Mic, MicOff, Send, Sliders, Moon, Sun, X } from 'lucide-react';

interface Props {
  onSend: (text: string) => void;
  onVoiceToggle: () => void;
  isListening: boolean;
  onOpenDashboard: () => void;
  isSleeping: boolean;
  onToggleSleep: () => void;
  onClose: () => void;
  voiceTranscript?: string | null;
  voiceAlternatives?: string[];
  activationShortcut?: string;
}

export const CompactInput: React.FC<Props> = ({
  onSend,
  onVoiceToggle,
  isListening,
  onOpenDashboard,
  isSleeping,
  onToggleSleep,
  onClose,
  voiceTranscript,
  voiceAlternatives = [],
  activationShortcut = 'Ctrl+Shift+Space'
}) => {
  const [text, setText] = useState('');
  const [showAlternatives, setShowAlternatives] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);

  // A native transcription is only a draft, never authorization to run a
  // Windows command. The user can correct it before pressing Enter.
  useEffect(() => {
    if (voiceTranscript?.trim()) {
      setShowAlternatives(true);
      setText(voiceTranscript.trim());
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [voiceTranscript]);

  // The overlay owns Escape once. Duplicate key handlers previously
  // dismissed both an approval and the entire companion on one keypress.
  useEffect(() => { inputRef.current?.focus(); }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (text.trim() && !isListening) {
      onSend(text.trim());
      setText('');
    }
  };

  const suggestions = ['Open YouTube', 'Search for Python tutorials', 'Open Notepad'];

  return (
    <div className="companio-input overlay-panel w-full rounded-2xl p-2.5">
      <form onSubmit={handleSubmit} className="flex items-center gap-2">
        <button type="button" onClick={onVoiceToggle}
          title={isListening ? 'Stop listening' : 'Start voice input'}
          aria-label={isListening ? 'Stop listening' : 'Start voice input'}
          aria-pressed={isListening}
          className={`overlay-icon ${isListening ? 'overlay-icon-listening' : ''}`}>
          {isListening ? <MicOff size={16} aria-hidden="true" /> : <Mic size={16} aria-hidden="true" />}
        </button>
        <input
          ref={inputRef}
          type="text"
          value={text}
          onChange={(event) => { setText(event.target.value); setShowAlternatives(false); }}
          aria-label="Companio command"
          autoComplete="off"
          placeholder={isListening ? 'Listening…' : 'Ask Companio…'}
          className="min-w-0 flex-1 rounded-md bg-[#f2f6ef] px-2.5 py-2 text-[13px] font-medium text-slate-800 placeholder-slate-600"
        />
        <button type="submit" disabled={!text.trim() || isListening} aria-label="Send command"
          title="Send command (Enter)" className="overlay-icon overlay-icon-primary">
          <Send size={15} aria-hidden="true" />
        </button>
      </form>

      <div className="mt-2 flex items-center justify-between gap-2 border-t border-[#e3ebe3] pt-2">
        <button type="button" onClick={onOpenDashboard} className="overlay-tool-link">
          <Sliders size={14} aria-hidden="true" /> Control Center
        </button>
        <div className="flex gap-1.5">
          <button type="button" onClick={onToggleSleep}
            aria-label={isSleeping ? 'Wake Companio' : 'Put Companio to sleep'}
            title={isSleeping ? 'Wake Companio' : 'Sleep mode'}
            className="overlay-icon overlay-icon-small">
            {isSleeping ? <Sun size={15} aria-hidden="true" /> : <Moon size={15} aria-hidden="true" />}
          </button>
          <button type="button" onClick={onClose} title={`Hide Companio (Esc or ${activationShortcut})`}
            aria-label="Hide Companio" className="overlay-icon overlay-icon-small hover:text-rose-700">
            <X size={16} aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Alternative hypotheses are local to this recognized audio, not AI guesses. */}
      {showAlternatives && voiceAlternatives.length > 0 && !isListening && (
        <div className="mt-2 border-t border-[#e3ebe3] pt-2">
          <p className="mb-1.5 text-[11px] text-slate-600">Choose a different transcription</p>
          <div className="flex max-h-20 flex-wrap gap-1.5 overflow-y-auto">
            {voiceAlternatives.slice(0, 3).map((alternative, index) => (
              <button
                key={index}
                type="button"
                onClick={() => {
                  setText(alternative);
                  setShowAlternatives(false);
                  inputRef.current?.focus();
                  inputRef.current?.select();
                }}
                className="app-no-drag max-w-full truncate rounded-lg border border-teal-200 bg-teal-50 px-2 py-1 text-[11px] text-teal-800 hover:bg-teal-100"
                title={alternative}
              >
                {alternative}
              </button>
            ))}
          </div>
        </div>
      )}
      {/* Suggestions are quiet while composing or dictating. */}
      {!text.trim() && !isListening && <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-slate-100 overflow-x-auto px-0.5 pb-1">
        {suggestions.map((s, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => onSend(s)}
            className="min-h-7 text-[11px] whitespace-nowrap px-2 py-1 rounded-lg bg-slate-100/90 hover:bg-teal-50 hover:text-teal-800 text-slate-600 border border-slate-200/80 transition-all font-medium"
          >
            {s}
          </button>
        ))}
      </div>}
    </div>
  );
};
