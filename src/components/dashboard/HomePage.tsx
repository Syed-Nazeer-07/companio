import React, { useState } from 'react';
import { 
  Play, 
  Volume2, 
  Camera, 
  Terminal, 
  Globe, 
  CheckCircle2, 
  Activity, 
  Cpu, 
  Sparkles,
  ExternalLink,
  MessageSquare
} from 'lucide-react';
import { AppSettings } from '../../types';
import { CharacterRenderer } from '../characters/CharacterRenderer';
import { desktopBridge } from '../../services/desktopBridge';

interface Props {
  settings: AppSettings;
  onNavigate: (tab: any) => void;
  onLaunchOverlay: () => void;
}

export const HomePage: React.FC<Props> = ({ settings, onNavigate, onLaunchOverlay }) => {
  const [quickActionStatus, setQuickActionStatus] = useState<string | null>(null);

  const runQuickAction = async (tool: string, params: any = {}, label: string) => {
    setQuickActionStatus(`Executing: ${label}...`);
    try {
      const res = await desktopBridge.executeTool(tool, params);
      if (res && res.success !== false) {
        setQuickActionStatus(`✓ ${label} executed successfully! ✨`);
      } else {
        setQuickActionStatus(`Failed: ${res?.error || 'Unknown error'}`);
      }
    } catch (err: any) {
      setQuickActionStatus(`Error: ${err.message}`);
    }
    setTimeout(() => setQuickActionStatus(null), 5000);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-200">
      {/* Hero Welcome Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-sky-50 via-indigo-50/60 to-purple-50 border border-slate-200/90 p-8 shadow-sm">
        <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="space-y-3 max-w-xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-100 border border-sky-200 text-sky-700 text-xs font-bold">
              <Sparkles className="w-3.5 h-3.5" />
              Windows 11 Desktop Companion
            </div>
            <h2 className="text-3xl font-bold tracking-tight text-slate-900">
              Meet {settings.characterName || 'Companio'}
            </h2>
            <p className="text-slate-600 text-sm leading-relaxed">
              Your animated personal assistant living right on your Windows desktop. Speak or type natural requests to control apps, automate browser workflows, play videos, and manage your computer.
            </p>
            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={onLaunchOverlay}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-600 text-white text-sm font-bold shadow-md shadow-sky-500/25 transition-all active:scale-95"
              >
                <Play className="w-4 h-4 fill-current" />
                <span>Show Companion Overlay</span>
              </button>
              <button
                onClick={() => onNavigate('characters')}
                className="px-4 py-2.5 rounded-xl bg-white hover:bg-slate-50 text-slate-700 text-sm font-semibold border border-slate-200 shadow-sm transition-colors"
              >
                Customize Avatar
              </button>
            </div>
          </div>

          {/* Interactive Character Live View */}
          <div className="relative w-44 h-44 flex items-center justify-center shrink-0">
            <CharacterRenderer
              characterId={settings.characterId}
              state="idle"
              scale={1}
            />
          </div>
        </div>
      </div>

      {/* Quick Action Feedback Banner */}
      {quickActionStatus && (
        <div className="p-4 rounded-2xl bg-sky-50 border border-sky-200 text-sky-800 text-sm flex items-center justify-between animate-in fade-in duration-150 shadow-sm">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 animate-spin text-sky-600" />
            <span className="font-medium">{quickActionStatus}</span>
          </div>
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
        </div>
      )}

      {/* Quick Computer Actions Grid */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-slate-900">Quick Computer Actions</h3>
          <button
            onClick={() => onNavigate('automation')}
            className="text-xs text-sky-600 hover:text-sky-700 font-bold flex items-center gap-1"
          >
            <span>View All Tools</span>
            <ExternalLink className="w-3 h-3" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Action 1: Open ChatGPT */}
          <div
            onClick={() => runQuickAction('browser.chatgpt.open', {}, 'Open ChatGPT')}
            className="acrylic-card rounded-2xl p-5 cursor-pointer group hover:border-emerald-300"
          >
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
              <MessageSquare className="w-5 h-5" />
            </div>
            <h4 className="text-sm font-bold text-slate-900 mb-1">Open ChatGPT</h4>
            <p className="text-xs text-slate-500 leading-relaxed">
              Launches ChatGPT ready for AI brainstorming and queries.
            </p>
          </div>

          {/* Action 2: Open YouTube */}
          <div
            onClick={() => runQuickAction('browser.youtube.open', {}, 'Open YouTube')}
            className="acrylic-card rounded-2xl p-5 cursor-pointer group hover:border-red-300"
          >
            <div className="w-10 h-10 rounded-xl bg-red-50 text-red-500 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
              <Globe className="w-5 h-5" />
            </div>
            <h4 className="text-sm font-bold text-slate-900 mb-1">Open YouTube</h4>
            <p className="text-xs text-slate-500 leading-relaxed">
              Launches browser and navigates directly to YouTube.
            </p>
          </div>

          {/* Action 3: CarryMinati Newest Video */}
          <div
            onClick={() => runQuickAction('browser.youtube.search_and_play', { creator: 'CarryMinati' }, 'Play CarryMinati Video')}
            className="acrylic-card rounded-2xl p-5 cursor-pointer group hover:border-amber-300"
          >
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-500 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
              <Play className="w-5 h-5 fill-current" />
            </div>
            <h4 className="text-sm font-bold text-slate-900 mb-1">Play CarryMinati</h4>
            <p className="text-xs text-slate-500 leading-relaxed">
              Finds CarryMinati channel and plays the latest upload.
            </p>
          </div>

          {/* Action 4: Launch Calculator */}
          <div
            onClick={() => runQuickAction('win.calculator.launch', {}, 'Launch Calculator')}
            className="acrylic-card rounded-2xl p-5 cursor-pointer group hover:border-blue-300"
          >
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-500 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
              <Terminal className="w-5 h-5" />
            </div>
            <h4 className="text-sm font-bold text-slate-900 mb-1">Launch Calculator</h4>
            <p className="text-xs text-slate-500 leading-relaxed">
              Opens the native Windows Calculator application.
            </p>
          </div>
        </div>
      </div>

      {/* System Platform & Diagnostics */}
      <div className="acrylic-card rounded-2xl p-6">
        <h3 className="text-base font-bold text-slate-900 mb-4 flex items-center gap-2">
          <Cpu className="w-4 h-4 text-sky-600" />
          <span>System Environment & Hardware Diagnostics</span>
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80">
            <p className="text-slate-500 mb-1 font-medium">Operating System</p>
            <p className="text-slate-900 font-bold">Windows 11</p>
          </div>
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80">
            <p className="text-slate-500 mb-1 font-medium">Processor Architecture</p>
            <p className="text-slate-900 font-bold">Universal (x64 & ARM64)</p>
          </div>
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80">
            <p className="text-slate-500 mb-1 font-medium">Global Hotkey</p>
            <p className="text-sky-700 font-mono font-bold">{settings.activationShortcut}</p>
          </div>
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80">
            <p className="text-slate-500 mb-1 font-medium">Active Companion</p>
            <p className="text-slate-900 font-bold capitalize">{settings.characterId}</p>
          </div>
        </div>
      </div>
    </div>
  );
};
