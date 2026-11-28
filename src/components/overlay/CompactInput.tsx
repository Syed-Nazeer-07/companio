import React, { useState, useRef, useEffect } from 'react';
import { Mic, MicOff, Send, Sliders, X } from 'lucide-react';

interface Props {
  onSend: (text: string) => void;
  onVoiceToggle: () => void;
  isListening: boolean;
  onOpenDashboard: () => void;
  onClose: () => void;
  suggestions?: string[];
  voiceTranscript?: string | null;
  voiceAlternatives?: string[];
  activationShortcut?: string;
  isDark?: boolean;
}

export const CompactInput: React.FC<Props> = ({
  onSend,
  onVoiceToggle,
  isListening,
  onOpenDashboard,
  onClose,
  suggestions = [],
  voiceTranscript,
  voiceAlternatives = [],
  activationShortcut = 'Ctrl+Shift+Space',
  isDark = false
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

  // The overlay owns Escape once.
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (text.trim() && !isListening) {
      onSend(text.trim());
      setText('');
    }
  };

  const surfaceClass = isDark
    ? 'border-slate-700/90 bg-slate-900/95 text-slate-100 shadow-[0_6px_20px_rgba(2,6,23,0.45)]'
    : 'border-slate-200/90 bg-white/95 text-slate-800 shadow-[0_6px_20px_rgba(15,23,42,0.10)]';

  const subtleBtnClass = isDark
    ? 'bg-slate-800 hover:bg-slate-700 text-slate-200'
    : 'bg-slate-100 hover:bg-slate-200 text-slate-600';

  return (
    <div
      data-companio-interactive="true"
      className={`companio-input pointer-events-auto w-full max-w-[328px] mx-auto rounded-xl border p-2 box-border ${surfaceClass}`}
    >
      <form onSubmit={handleSubmit} className="flex items-center gap-1.5">
        {/* Push-to-Talk Mic Button */}
        <button
          type="button"
          onClick={onVoiceToggle}
          title={isListening ? 'Stop listening' : 'Push to talk (Microphone)'}
          aria-label={isListening ? 'Stop listening' : 'Start voice input'}
          aria-pressed={isListening}
          className={`shrink-0 p-2 rounded-lg transition-colors ${
            isListening
              ? 'bg-rose-600 text-white'
              : subtleBtnClass
          }`}
        >
          {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
        </button>

        {/* Text Input */}
        <input
          ref={inputRef}
          type="text"
          value={text}
          onChange={(e) => { setText(e.target.value); setShowAlternatives(false); }}
          aria-label="Companio command"
          autoComplete="off"
          placeholder={isListening ? 'Listening...' : 'Ask Companio...'}
          className={`min-w-0 flex-1 bg-transparent border-0 text-[13px] focus:outline-none px-1.5 font-normal ${
            isDark ? 'placeholder-slate-400 text-slate-100' : 'placeholder-slate-400 text-slate-800'
          }`}
        />

        {/* Submit Button */}
        <button
          type="submit"
          disabled={!text.trim() || isListening}
          title="Send command (Enter)"
          aria-label="Send command"
          className="shrink-0 p-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 disabled:opacity-30 disabled:hover:bg-emerald-700 text-white transition-colors"
        >
          <Send className="w-3.5 h-3.5" />
        </button>

        {/* Control Center button */}
        <button
          type="button"
          onClick={onOpenDashboard}
          title="Open Settings Dashboard"
          aria-label="Open Settings Dashboard"
          className={`shrink-0 p-2 rounded-lg transition-colors ${subtleBtnClass}`}
        >
          <Sliders className="w-3.5 h-3.5" />
        </button>

        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          title={`Hide Companio (Esc or ${activationShortcut})`}
          aria-label="Hide Companio"
          className={`shrink-0 p-2 rounded-lg transition-colors ${
            isDark
              ? 'bg-slate-800 hover:bg-rose-950/60 text-slate-300 hover:text-rose-300'
              : 'bg-slate-100 hover:bg-rose-50 text-slate-500 hover:text-rose-600'
          }`}
        >
          <X className="w-3.5 h-3.5 stroke-[2.25]" />
        </button>
      </form>

      {/* Alternative speech matches */}
      {showAlternatives && voiceAlternatives.length > 0 && !isListening && (
        <div className={`mt-2 border-t pt-2 ${isDark ? 'border-slate-800' : 'border-slate-100'}`}>
          <p className={`mb-1.5 text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            Other possible matches — select to correct
          </p>
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
                className={`max-w-full truncate rounded-lg border px-2 py-1 text-[11px] transition-colors ${
                  isDark
                    ? 'border-emerald-800 bg-emerald-950/60 text-emerald-300 hover:bg-emerald-900/60'
                    : 'border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                }`}
                title={alternative}
              >
                {alternative}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* History-derived suggestions only: completely hidden when empty */}
      {suggestions.length > 0 && !text.trim() && !isListening && (
        <div
          aria-label="Recent command suggestions"
          className={`flex flex-wrap items-center gap-1.5 mt-2 pt-2 border-t ${isDark ? 'border-slate-800' : 'border-slate-100'}`}
        >
          {suggestions.slice(0, 3).map((s, idx) => (
            <button
              key={`${idx}-${s}`}
              type="button"
              onClick={() => onSend(s)}
              title={s}
              className={`max-w-[290px] truncate text-[11px] px-2.5 py-1 rounded-lg border transition-colors font-medium ${
                isDark
                  ? 'bg-slate-800/90 hover:bg-emerald-950/70 text-slate-200 hover:text-emerald-300 border-slate-700'
                  : 'bg-slate-50 hover:bg-emerald-50 text-slate-600 hover:text-emerald-800 border-slate-200/90'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
