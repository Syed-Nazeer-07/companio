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

  const selected = navItems.find(item => item.id === currentTab);
  const native = isNativeDesktop();
  const groups = [
    { title: 'Workspace', ids: ['home','history','automation'] },
    { title: 'Personalize', ids: ['characters','voice','ai'] },
    { title: 'System', ids: ['settings','help'] }
  ];
  return (
    <div className="control-center">
      <aside className="control-sidebar">
        <div className="control-brand">
          <img src={`${import.meta.env.BASE_URL}companio-icon.svg`} alt="" width="32" height="32"/>
          <div><h1>Companio</h1><small>Control Center</small></div>
        </div>
        <nav aria-label="Control Center" className="control-nav">
          {groups.map(group => <div key={group.title} className="control-nav-group"><p>{group.title}</p>
            {navItems.filter(item => group.ids.includes(item.id)).map(item => {
              const Icon = item.icon;
              return <button type="button" key={item.id} aria-current={currentTab===item.id?'page':undefined} onClick={()=>onSelectTab(item.id)}><Icon size={17} aria-hidden="true"/><span>{item.label}</span></button>;
            })}
          </div>)}
        </nav>
        <div className="control-footer">
          <button type="button" onClick={onLaunchOverlay}><ExternalLink size={16}/> Show companion</button>
          <p><span className={native?'runtime-dot connected':'runtime-dot'}/>{native?'Windows runtime connected':'Browser preview · limited'}</p>
        </div>
      </aside>
      <main className="control-main">
        <header className="control-header"><span>Workspace / <strong>{selected?.label}</strong></span><span className="control-key"><kbd>{settings.activationShortcut}</kbd> <span>Summon</span></span></header>
        <div className="control-content">{children}</div>
      </main>
    </div>
  );
};
