import React, { useState, useEffect } from 'react';
import { AppSettings, CharacterId } from './types';
import { dbService } from './services/dbService';
import { desktopBridge } from './services/desktopBridge';
import { DesktopCompanionOverlay } from './components/overlay/DesktopCompanionOverlay';
import { DashboardLayout, DashboardTab } from './components/dashboard/DashboardLayout';
import { HomePage } from './components/dashboard/HomePage';
import { CharacterStudioPage } from './components/dashboard/CharacterStudioPage';
import { AutomationPage } from './components/dashboard/AutomationPage';
import { AiConfigPage } from './components/dashboard/AiConfigPage';
import { VoiceSettingsPage } from './components/dashboard/VoiceSettingsPage';
import { HistoryPage } from './components/dashboard/HistoryPage';
import { SettingsPage } from './components/dashboard/SettingsPage';
import { HelpPage } from './components/dashboard/HelpPage';
import { SetupWizardModal } from './components/onboarding/SetupWizardModal';

const DEFAULT_SETTINGS: AppSettings = {
  firstTimeSetupDone: false,
  theme: 'light',
  activationShortcut: 'Ctrl+Shift+Space',
  characterId: 'sparky',
  characterName: 'Companio',
  character: {
    id: 'sparky',
    name: 'Sparky',
    tagline: 'Cute Animated Robot',
    description: 'Cybernetic animated assistant',
    accentColor: '#0ea5e9',
    glowColor: 'rgba(14, 165, 233, 0.3)',
    badge: 'Popular'
  },
  ai: {
    provider: 'mock',
    apiKey: '',
    model: 'companio-deterministic-v1',
    temperature: 0.7,
    personality: 'friendly',
    systemPrompt: 'You are Companio, an intelligent personal AI desktop companion for Windows 11.'
  },
  voice: {
    wakePhraseEnabled: false,
    wakePhrase: 'Hey Companio',
    pushToTalkKey: 'Space',
    sttEngine: 'browser',
    ttsVoice: '',
    ttsRate: 1.0,
    ttsPitch: 1.05,
    ttsVolume: 1.0,
    muted: false,
    audioReactivity: 1.0
  },
  overlay: {
    x: 0,
    y: 0,
    scale: 1.0,
    alwaysOnTop: true,
    snapToEdge: true,
    autoHideInFullscreen: true,
    soundEffects: true,
    transparentClickthrough: false,
    companionMode: 'floating'
  }
};

export const App: React.FC = () => {
  const [settings, setSettings] = useState<AppSettings>(() => {
    const saved = dbService.loadSettings();
    return { ...DEFAULT_SETTINGS, ...saved };
  });

  const [currentTab, setCurrentTab] = useState<DashboardTab>('home');
  const [viewMode, setViewMode] = useState<'overlay' | 'dashboard'>('overlay');
  const [isOnboardingOpen, setIsOnboardingOpen] = useState<boolean>(false);

  useEffect(() => {
    dbService.init();

    // Check query params for initial view
    const urlParams = new URLSearchParams(window.location.search);
    const view = urlParams.get('view');
    if (view === 'dashboard') {
      setViewMode('dashboard');
      if (!settings.firstTimeSetupDone) {
        setIsOnboardingOpen(true);
      }
    } else {
      setViewMode('overlay');
      // On first launch from overlay, pop open the centered Control Center for roomy setup
      if (!settings.firstTimeSetupDone) {
        desktopBridge.toggleDashboard(true);
      }
    }
  }, []);

  const handleUpdateSettings = (newSettings: Partial<AppSettings>) => {
    setSettings((prev) => {
      const updated = { ...prev, ...newSettings };
      dbService.saveSettings(updated);
      return updated;
    });
  };

  const handleLaunchOverlay = () => {
    desktopBridge.toggleDashboard(false);
  };

  const handleOpenDashboard = () => {
    desktopBridge.toggleDashboard(true);
  };

  // If in overlay view mode (transparent desktop companion)
  if (viewMode === 'overlay') {
    return (
      <div className="w-screen h-screen bg-transparent overflow-hidden">
        <DesktopCompanionOverlay
          settings={settings}
          onOpenDashboard={handleOpenDashboard}
          onUpdateSettings={handleUpdateSettings}
        />
      </div>
    );
  }

  // Main Dashboard / Control Center (roomy 1140x760 centered window)
  return (
    <DashboardLayout
      currentTab={currentTab}
      onSelectTab={setCurrentTab}
      settings={settings}
      onLaunchOverlay={handleLaunchOverlay}
    >
      {currentTab === 'home' && (
        <HomePage
          settings={settings}
          onNavigate={(tab) => setCurrentTab(tab)}
          onLaunchOverlay={handleLaunchOverlay}
        />
      )}
      {currentTab === 'characters' && (
        <CharacterStudioPage
          settings={settings}
          onUpdateSettings={handleUpdateSettings}
        />
      )}
      {currentTab === 'automation' && <AutomationPage />}
      {currentTab === 'ai' && (
        <AiConfigPage
          settings={settings}
          onUpdateSettings={handleUpdateSettings}
        />
      )}
      {currentTab === 'voice' && (
        <VoiceSettingsPage
          settings={settings}
          onUpdateSettings={handleUpdateSettings}
        />
      )}
      {currentTab === 'history' && <HistoryPage />}
      {currentTab === 'settings' && (
        <SettingsPage
          settings={settings}
          onUpdateSettings={handleUpdateSettings}
        />
      )}
      {currentTab === 'help' && (
        <HelpPage
          onStartOnboarding={() => setIsOnboardingOpen(true)}
        />
      )}

      {/* Setup Wizard is rendered centered and roomy inside the Control Center */}
      <SetupWizardModal
        isOpen={isOnboardingOpen}
        settings={settings}
        onComplete={(upd) => {
          handleUpdateSettings(upd);
          setIsOnboardingOpen(false);
        }}
        onClose={() => setIsOnboardingOpen(false)}
      />
    </DashboardLayout>
  );
};

export default App;
