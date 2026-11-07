import React from 'react';
import { 
  Home, 
  Palette, 
  Cpu, 
  Mic, 
  Sliders, 
  History, 
  Settings as SettingsIcon, 
  HelpCircle,
  ExternalLink
} from 'lucide-react';
import { AppSettings } from '../../types';
import { isNativeDesktop } from '../../services/desktopBridge';

export type DashboardTab = 
  | 'home' 
  | 'characters' 
  | 'ai' 
  | 'voice' 
  | 'automation' 
  | 'history' 
  | 'settings' 
  | 'help';

interface Props {
  currentTab: DashboardTab;
  onSelectTab: (tab: DashboardTab) => void;
  settings: AppSettings;
  onLaunchOverlay: () => void;
  children: React.ReactNode;
}

export const DashboardLayout: React.FC<Props> = ({
  currentTab,
  onSelectTab,
  settings,
  onLaunchOverlay,
  children
}) => {
  const navItems = [
    { id: 'home' as DashboardTab, label: 'Home', icon: Home },
    { id: 'characters' as DashboardTab, label: 'Character Studio', icon: Palette },
    { id: 'automation' as DashboardTab, label: 'Automation & Tools', icon: Sliders },
    { id: 'ai' as DashboardTab, label: 'AI Intelligence', icon: Cpu },
    { id: 'voice' as DashboardTab, label: 'Voice Settings', icon: Mic },
    { id: 'history' as DashboardTab, label: 'History & Logs', icon: History },
    { id: 'settings' as DashboardTab, label: 'Settings', icon: SettingsIcon },
    { id: 'help' as DashboardTab, label: 'Help & Docs', icon: HelpCircle },
  ];

  return (
    <div className="flex h-screen w-screen bg-slate-50 text-slate-800 overflow-hidden font-sans">
      {/* Windows 11 Fluent Light Navigation Sidebar */}
      <aside className="w-64 border-r border-slate-200/90 bg-white/80 backdrop-blur-2xl flex flex-col justify-between p-4 shrink-0 select-none">
        <div>
          {/* Brand Header */}
          <div className="flex items-center gap-3 px-2 py-3 mb-4">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-sky-500 to-blue-600 flex items-center justify-center shadow-md shadow-sky-500/20">
              <span className="font-bold text-white text-base tracking-wider">C</span>
            </div>
            <div>
              <h1 className="font-bold text-base leading-tight tracking-wide text-slate-900">Companio</h1>
              <p className="text-[11px] text-sky-600 font-semibold">Personal AI Companion</p>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onSelectTab(item.id)}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${
                    isActive
                      ? 'bg-sky-50 text-sky-700 shadow-sm border border-sky-200 font-semibold'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-sky-600' : 'text-slate-500'}`} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Sidebar Footer */}
        <div className="pt-4 border-t border-slate-200 space-y-2">
          {/* Quick Overlay Summon Button */}
          <button
            onClick={onLaunchOverlay}
            className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-600 text-white text-xs font-bold shadow-md shadow-sky-500/20 transition-all active:scale-95"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>Summon Overlay</span>
          </button>

          <div className="px-2 pt-1 flex items-center justify-between text-[11px] text-slate-400">
            <span>{isNativeDesktop() ? 'Windows desktop app' : 'Browser preview'}</span>
            <span className={`flex items-center gap-1 font-medium ${isNativeDesktop() ? 'text-emerald-700' : 'text-slate-500'}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${isNativeDesktop() ? 'bg-emerald-500' : 'bg-slate-400'}`} />
              {isNativeDesktop() ? 'Connected' : 'Limited'}
            </span>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col overflow-hidden bg-slate-50">
        <div className="flex-1 overflow-y-auto p-8 max-w-6xl w-full mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
};
