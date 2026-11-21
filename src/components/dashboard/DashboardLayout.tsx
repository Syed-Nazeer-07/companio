import React, { useLayoutEffect, useRef } from 'react';
import {
  House, Palette, Cpu, Mic, SlidersHorizontal, History, Settings, CircleHelp
} from 'lucide-react';
import { isNativeDesktop } from '../../services/desktopBridge';

const navGroups = [
  {
    name: 'Workspace',
    items: [
      { id: 'home', label: 'Overview', icon: House },
      { id: 'characters', label: 'Characters', icon: Palette },
      { id: 'automation', label: 'Tools', icon: SlidersHorizontal },
      { id: 'history', label: 'History', icon: History }
    ]
  },
  {
    name: 'Preferences',
    items: [
      { id: 'ai', label: 'Local AI', icon: Cpu },
      { id: 'voice', label: 'Voice Settings', icon: Mic },
      { id: 'settings', label: 'Settings', icon: Settings },
      { id: 'help', label: 'Help', icon: CircleHelp }
    ]
  }
] as const;

export type DashboardTab = typeof navGroups[number]['items'][number]['id'];

interface Props {
  currentTab: DashboardTab;
  onSelectTab: (tab: DashboardTab) => void;
  onLaunchOverlay: () => void;
  children: React.ReactNode;
}

export const DashboardLayout: React.FC<Props> = ({ currentTab, onSelectTab, onLaunchOverlay, children }) => {
  const mainContent = useRef<HTMLElement>(null);
  const previousTab = useRef(currentTab);
  const nativeDesktop = isNativeDesktop();
  const activeLabel = navGroups.flatMap(group => [...group.items]).find(item => item.id === currentTab)?.label;

  useLayoutEffect(() => {
    if (previousTab.current === currentTab) return;
    previousTab.current = currentTab;
    mainContent.current?.scrollTo({ top: 0 });
    mainContent.current?.focus({ preventScroll: true });
  }, [currentTab]);

  return (
    <div className="workspace">
      <aside className="workspace-sidebar">
        <div className="workspace-brand">
          <img src={`${import.meta.env.BASE_URL}companio-icon.svg`} alt="" width={33} height={33} />
          <div>
            <p>Companio</p>
            <span>Control Center</span>
          </div>
        </div>

        <nav aria-label="Control Center" className="workspace-nav">
          {navGroups.map(group => (
            <div key={group.name} className="workspace-nav-group">
              <p className="workspace-nav-caption">{group.name}</p>
              {group.items.map(({ id, label, icon: Icon }) => (
                <button key={id} type="button" aria-current={currentTab === id ? 'page' : undefined}
                  onClick={() => onSelectTab(id)}>
                  <Icon size={17} aria-hidden="true" />
                  <span>{label}</span>
                </button>
              ))}
            </div>
          ))}
        </nav>

        <button type="button" className="workspace-summon" onClick={onLaunchOverlay}>Show Companion</button>
      </aside>

      <div className="workspace-body">
        <header className="workspace-bar">
          <span>Control Center</span>
          <span className="workspace-connection">
            <i className={nativeDesktop ? 'is-connected' : undefined} aria-hidden="true" />
            {nativeDesktop ? 'Windows desktop app' : 'Browser preview'}
          </span>
        </header>
        <main ref={mainContent} tabIndex={-1} aria-label={activeLabel} className="workspace-main">
          <div className="workspace-content">{children}</div>
        </main>
      </div>
    </div>
  );
};
