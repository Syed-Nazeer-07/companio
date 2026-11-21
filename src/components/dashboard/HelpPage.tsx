import React from 'react';
import { HelpCircle, Terminal, Globe, Volume2, Sparkles, BookOpen } from 'lucide-react';

interface Props {
  onStartOnboarding: () => void;
}

export const HelpPage: React.FC<Props> = ({ onStartOnboarding }) => {
  const commandSections = [
    {
      title: 'Browser & YouTube',
      icon: Globe,
      examples: [
        '"Open YouTube." (your default browser)',
        '"Open github.com/Syed-Nazeer-07/companio."',
        '"Search for Python DSA tutorials."',
        '"Search Google for React examples."',
        '"Pause the current YouTube video." (Companio-controlled Edge only)'
      ]
    },
    {
      title: 'Windows Desktop',
      icon: Terminal,
      examples: [
        '"Open Calculator." / "Open Notepad."',
        '"Open File Explorer."',
        '"Open my Downloads folder."',
        '"Open VS Code."',
        '"Open Paint." / "Open Task Manager."',
        '"Take a screenshot."'
      ]
    },
    {
      title: 'Volume & Notes',
      icon: Volume2,
      examples: [
        '"Set volume to 60%."',
        '"Volume up." / "Lower volume."',
        '"Mute the audio." / "Unmute the sound."',
        '"Remember that my exam is Monday."',
        '"Show my notes."',
        '"Clear notes." (requires confirmation)'
      ]
    },
    {
      title: 'Approval-first Workflows',
      icon: Sparkles,
      examples: [
        '"Open Notepad and set volume to 45%."',
        '"Open YouTube and search Google for Python tutorials."',
        'Up to three supported steps with explicit approval.',
        'A local model can suggest other allowlisted steps when configured.'
      ]
    }
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-200">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <header className="workspace-heading">
          <h1>Help &amp; commands</h1>
          <p>Find examples for built-in commands and learn how Companio runs them.</p>
        </header>

        <button
          onClick={onStartOnboarding}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-teal-700 hover:bg-teal-800 text-white text-xs font-bold shadow-md shadow-teal-500/20 transition-all active:scale-95"
        >
          <BookOpen className="w-3.5 h-3.5" />
          <span>Rerun Setup Wizard</span>
        </button>
      </div>

      <div className="rounded-xl border border-teal-200 bg-teal-50/60 px-4 py-3 text-xs leading-relaxed text-slate-700">
        <strong className="text-slate-900">How commands work:</strong> Use clear action words such as
        {' '}<code>open</code>, <code>set</code>, <code>search</code> or <code>save</code>.
        Single, clearly requested low-risk app and website launches run directly.
        Multi-step and higher-risk proposed actions still need confirmation. Websites and
        searches open in your default browser; verified YouTube playback uses Companio's
        separate controlled Edge session. Review dictated text before sending, or enable hands-free basic commands in Voice Settings.
      </div>

      {/* Command Cheat Sheets */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {commandSections.map((sec, i) => {
          const Icon = sec.icon;
          return (
            <div key={i} className="workspace-panel rounded-2xl p-4 sm:p-6 space-y-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Icon className="w-4 h-4 text-teal-600" />
                <span>{sec.title}</span>
              </h3>
              <ul className="space-y-2">
                {sec.examples.map((ex, idx) => (
                  <li
                    key={idx}
                    className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 font-mono text-xs text-teal-800 font-medium"
                  >
                    {ex}
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
};
