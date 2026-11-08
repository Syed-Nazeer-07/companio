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
  voiceAlternatives = []
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
    <div className="companio-input w-full max-w-[328px] mx-auto rounded-2xl border border-slate-200 bg-white/95 p-2.5 text-slate-800 shadow-[0_8px_28px_rgba(15,23,42,0.12)] box-border">
      <form onSubmit={handleSubmit} className="flex items-center gap-1.5">
        {/* Push-to-Talk Mic Button */}
        <button
          type="button"
          onClick={onVoiceToggle}
          title={isListening ? 'Stop listening' : 'Push to talk (Microphone)'}
          className={`shrink-0 p-2 rounded-xl transition-all ${
            isListening 
              ? 'bg-rose-500 text-white animate-pulse shadow-[0_0_12px_rgba(244,63,94,0.5)]' 
              : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
          }`}
        >
          {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
        </button>

        {/* Text Input */}
        <input
          ref={inputRef}
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={isListening ? "Listening..." : "Ask Companio..."}
          className="min-w-0 flex-1 bg-transparent border-0 text-[13px] placeholder-slate-400 focus:outline-none text-slate-800 px-1 font-medium"
        />

        {/* Submit Button */}
        <button
          type="submit"
          disabled={!text.trim() || isListening}
          title="Send command (Enter)"
          className="shrink-0 p-2 rounded-xl bg-sky-600 hover:bg-sky-700 disabled:opacity-30 disabled:hover:bg-sky-600 text-white transition-colors shadow-sm"
        >
          <Send className="w-3.5 h-3.5" />
        </button>

        {/* Control Center button */}
        <button
          type="button"
          onClick={onOpenDashboard}
          title="Open Settings Dashboard"
          className="shrink-0 p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors"
        >
          <Sliders className="w-3.5 h-3.5" />
        </button>

        {/* Sleep / Wake toggle */}
        <button
          type="button"
          onClick={onToggleSleep}
          title={isSleeping ? "Wake Up" : "Sleep Mode"}
          className="shrink-0 p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors"
        >
          {isSleeping ? <Sun className="w-3.5 h-3.5 text-amber-500" /> : <Moon className="w-3.5 h-3.5 text-sky-500" />}
        </button>

        {/* Close Button on Right Side (Clearly Visible Circle) */}
        <button
          type="button"
          onClick={onClose}
          title="Hide Companio (Esc or Ctrl+Shift+Space)"
          className="shrink-0 p-1.5 rounded-full bg-slate-100 hover:bg-rose-50 text-slate-500 hover:text-rose-600 transition-colors border border-slate-200 shadow-sm"
        >
          <X className="w-3.5 h-3.5 stroke-[2.5]" />
        </button>
      </form>

      {/* Alternative hypotheses are local to this recognized audio, not AI guesses. */}
      {showAlternatives && voiceAlternatives.length > 0 && !isListening && (
        <div className="mt-2 border-t border-slate-100 pt-2">
          <p className="mb-1.5 text-[11px] text-slate-500">Other possible matches — select to correct</p>
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
                className="app-no-drag max-w-full truncate rounded-lg border border-sky-200 bg-sky-50 px-2 py-1 text-[11px] text-sky-800 hover:bg-sky-100"
                title={alternative}
              >
                {alternative}
              </button>
            ))}
          </div>
        </div>
      )}
      {/* Suggestions are quiet while composing or dictating. */}
      {!text.trim() && !isListening && <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-slate-100 overflow-x-auto no-scrollbar">
        {suggestions.map((s, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => onSend(s)}
            className="text-[11px] whitespace-nowrap px-2.5 py-1 rounded-lg bg-slate-100/90 hover:bg-sky-50 hover:text-sky-700 text-slate-600 border border-slate-200/80 transition-all font-medium"
          >
            {s}
          </button>
        ))}
      </div>}
    </div>
  );
};
