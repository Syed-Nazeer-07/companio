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

const navItems = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'characters', label: 'Character Studio', icon: Palette },
  { id: 'automation', label: 'Automation & Tools', icon: Sliders },
  { id: 'ai', label: 'AI Intelligence', icon: Cpu },
  { id: 'voice', label: 'Voice Settings', icon: Mic },
  { id: 'history', label: 'History & Logs', icon: History },
  { id: 'settings', label: 'Settings', icon: SettingsIcon },
  { id: 'help', label: 'Help & Docs', icon: HelpCircle },
] as const;

interface Props {
  currentTab: DashboardTab;
  onSelectTab: (tab: DashboardTab) => void;
  onLaunchOverlay: () => void;
  children: React.ReactNode;
}

export const DashboardLayout: React.FC<Props> = ({
  currentTab,
  onSelectTab,
  onLaunchOverlay,
  children
}) => {
  const mainContent = React.useRef<HTMLDivElement>(null);
  const previousTab = React.useRef(currentTab);
  React.useLayoutEffect(() => {
    if (previousTab.current === currentTab) return;
    previousTab.current = currentTab;
    mainContent.current?.scrollTo({ top: 0 });
    mainContent.current?.focus({ preventScroll: true });
  }, [currentTab]);

  return (
    <div className="flex flex-col md:flex-row h-screen w-screen bg-slate-50 text-slate-800 overflow-hidden font-sans">
      {/* Windows 11 Fluent Light Navigation Sidebar */}
      <aside className="flex shrink-0 flex-col border-b border-slate-200 bg-white p-2.5 md:w-56 md:overflow-y-auto md:border-b-0 md:border-r md:p-4 xl:w-64 select-none">
        <div>
          {/* Brand Header */}
          <div className="flex items-center gap-3 px-2 py-2 md:mb-4">
            <img
              src={`${import.meta.env.BASE_URL}companio-icon.svg`}
              alt=""
              aria-hidden="true"
              className="w-9 h-9 rounded-xl shadow-md shadow-sky-500/20"
            />
            <div>
              <h1 className="font-bold text-base leading-tight tracking-wide text-slate-900">Companio</h1>
              <p className="text-[11px] text-sky-600 font-semibold">Control Center</p>
            </div>
          </div>

          {/* Navigation Links */}
          <nav aria-label="Control Center" className="grid grid-cols-4 gap-1 md:grid-cols-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  aria-current={isActive ? 'page' : undefined}
                  onClick={() => onSelectTab(item.id)}
                  className={`flex min-w-0 flex-col items-center gap-1 rounded-lg border border-transparent px-1 py-2 text-center text-[10px] font-medium leading-tight transition-colors md:flex-row md:gap-3 md:px-3 md:text-left md:text-sm ${
                    isActive
                      ? 'bg-sky-50 text-sky-700 shadow-sm border-sky-200 font-semibold'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80'
                  }`}
                >
                  <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-sky-600' : 'text-slate-500'}`} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Sidebar Footer */}
        <div className="mt-2 md:mt-auto md:pt-4 space-y-2">
          {/* Quick Overlay Summon Button */}
          <button
            onClick={onLaunchOverlay}
            className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-sky-700 hover:bg-sky-800 text-white text-xs font-bold shadow-md shadow-sky-500/20 transition-all active:scale-95"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>Summon Overlay</span>
          </button>

          <div className="hidden px-2 pt-1 items-center justify-between text-[11px] text-slate-600 md:flex">
            <span>{isNativeDesktop() ? 'Windows desktop app' : 'Browser preview'}</span>
            <span className={`flex items-center gap-1 font-medium ${isNativeDesktop() ? 'text-emerald-700' : 'text-slate-500'}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${isNativeDesktop() ? 'bg-emerald-500' : 'bg-slate-400'}`} />
              {isNativeDesktop() ? 'Connected' : 'Limited'}
            </span>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="min-h-0 min-w-0 flex-1 flex flex-col overflow-hidden bg-slate-50">
        <div ref={mainContent} tabIndex={-1} aria-label={navItems.find(item => item.id === currentTab)?.label}
          className="flex-1 overflow-auto p-4 md:p-6 xl:p-8 max-w-6xl w-full mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
};
