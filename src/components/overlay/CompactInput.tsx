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
}

export const CompactInput: React.FC<Props> = ({
  onSend,
  onVoiceToggle,
  isListening,
  onOpenDashboard,
  isSleeping,
  onToggleSleep,
  onClose,
  voiceTranscript
}) => {
  const [text, setText] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // A native transcription is only a draft, never authorization to run a
  // Windows command. The user can correct it before pressing Enter.
  useEffect(() => {
    if (voiceTranscript?.trim()) {
      setText(voiceTranscript.trim());
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [voiceTranscript]);

  useEffect(() => {
    inputRef.current?.focus();

    // Close on Escape key
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (text.trim()) {
      onSend(text.trim());
      setText('');
    }
  };

  const suggestions = [
    'Open ChatGPT',
    'Open YouTube',
    'Set volume to 60%',
    'Open Notepad',
    'Take a screenshot'
  ];

  return (
    <div className="w-full max-w-[328px] mx-auto glass-panel rounded-2xl p-2 shadow-[0_16px_40px_rgba(0,0,0,0.12)] border border-slate-200 text-slate-800 animate-in fade-in slide-in-from-bottom-2 duration-200 box-border">
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
          className="min-w-0 flex-1 bg-transparent border-0 text-xs placeholder-slate-400 focus:outline-none text-slate-800 px-1 font-medium"
        />

        {/* Submit Button */}
        <button
          type="submit"
          disabled={!text.trim()}
          title="Send command (Enter)"
          className="shrink-0 p-2 rounded-xl bg-sky-500 hover:bg-sky-600 disabled:opacity-30 disabled:hover:bg-sky-500 text-white transition-all shadow-sm"
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

      {/* Quick Suggestion Chips */}
      <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-slate-100 overflow-x-auto no-scrollbar">
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
      </div>
    </div>
  );
};
