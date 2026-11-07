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
}

export const CompactInput: React.FC<Props> = ({
  onSend,
  onVoiceToggle,
  isListening,
  onOpenDashboard,
  isSleeping,
  onToggleSleep,
  onClose
}) => {
  const [text, setText] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

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
    <div className="w-full glass-panel rounded-2xl p-2.5 shadow-[0_16px_40px_rgba(0,0,0,0.12)] border border-slate-200 text-slate-800 animate-in fade-in slide-in-from-bottom-2 duration-200">
      <form onSubmit={handleSubmit} className="flex items-center gap-2">
        {/* Push-to-Talk Mic Button */}
        <button
          type="button"
          onClick={onVoiceToggle}
          title={isListening ? 'Stop listening' : 'Push to talk (Microphone)'}
          className={`p-2 rounded-xl transition-all ${
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
          placeholder={isListening ? "Listening to your voice..." : "Ask Companio to do anything..."}
          className="flex-1 bg-transparent border-0 text-sm placeholder-slate-400 focus:outline-none text-slate-800 px-1"
        />

        {/* Submit Button */}
        <button
          type="submit"
          disabled={!text.trim()}
          title="Send command (Enter)"
          className="p-2 rounded-xl bg-sky-500 hover:bg-sky-600 disabled:opacity-30 disabled:hover:bg-sky-500 text-white transition-all shadow-sm"
        >
          <Send className="w-4 h-4" />
        </button>

        {/* Control Center button */}
        <button
          type="button"
          onClick={onOpenDashboard}
          title="Open Control Center Dashboard"
          className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors"
        >
          <Sliders className="w-4 h-4" />
        </button>

        {/* Sleep / Wake toggle */}
        <button
          type="button"
          onClick={onToggleSleep}
          title={isSleeping ? "Wake Up" : "Sleep Mode"}
          className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors"
        >
          {isSleeping ? <Sun className="w-4 h-4 text-amber-500" /> : <Moon className="w-4 h-4 text-sky-500" />}
        </button>

        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          title="Dismiss (Esc or Ctrl+Shift+Space)"
          className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-400 hover:text-slate-600 transition-colors"
        >
          <X className="w-4 h-4" />
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
