import React from 'react';
import { HelpCircle, Terminal, Globe, Volume2, Sparkles, BookOpen } from 'lucide-react';

interface Props {
  onStartOnboarding: () => void;
}

export const HelpPage: React.FC<Props> = ({ onStartOnboarding }) => {
  const commandSections = [
    {
      title: 'Web & Browser Automation',
      icon: Globe,
      examples: [
        '"Open ChatGPT."',
        '"Open Claude." / "Open Gemini."',
        '"Open YouTube."',
        '"Search for CarryMinati\'s newest video and play it."',
        '"Find a Python tutorial by Bro Code and open it."',
        '"Open GitHub and go to my repositories."',
        '"Search Google for the latest AI developments."',
        '"Open five tabs about machine learning."',
        '"Pause the current YouTube video."',
        '"Go fullscreen."'
      ]
    },
    {
      title: 'Windows Desktop Applications',
      icon: Terminal,
      examples: [
        '"Open Calculator." / "Close Calculator."',
        '"Open File Explorer." / "Open my Downloads folder."',
        '"Open VS Code." / "Open my project folder."',
        '"Open Notepad." / "Open Paint."',
        '"Open Task Manager." / "Open Snipping Tool."',
        '"Open Terminal." / "Open Windows Settings."',
        '"Lock my computer."',
        '"Take a screenshot."'
      ]
    },
    {
      title: 'Audio & Spotify Controls',
      icon: Volume2,
      examples: [
        '"Increase the volume to 60%."',
        '"Mute the audio." / "Unmute the sound."',
        '"Play Graffitia by Green Day on Spotify."',
        '"Play my liked songs."',
        '"Skip this song."',
        '"Pause the music." / "Resume playback."'
      ]
    },
    {
      title: 'Multi-Step Workflows',
      icon: Sparkles,
      examples: [
        '"Open Chrome, search for the latest Python release, and open the official documentation."',
        '"Open Spotify, play my favorite playlist, and lower the system volume to 30%."',
        '"Open VS Code and open my project folder."'
      ]
    }
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-200">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 mb-1">Help & Command Reference</h2>
          <p className="text-sm text-slate-600">
            A guide to speaking or typing natural commands to control your Windows computer.
          </p>
        </div>

        <button
          onClick={onStartOnboarding}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-sky-500 hover:bg-sky-600 text-white text-xs font-bold shadow-md shadow-sky-500/20 transition-all active:scale-95"
        >
          <BookOpen className="w-3.5 h-3.5" />
          <span>Rerun Setup Wizard</span>
        </button>
      </div>

      {/* Command Cheat Sheets */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {commandSections.map((sec, i) => {
          const Icon = sec.icon;
          return (
            <div key={i} className="acrylic-card rounded-2xl p-6 border border-slate-200 shadow-sm space-y-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Icon className="w-4 h-4 text-sky-600" />
                <span>{sec.title}</span>
              </h3>
              <ul className="space-y-2">
                {sec.examples.map((ex, idx) => (
                  <li
                    key={idx}
                    className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 font-mono text-xs text-sky-800 font-medium"
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
