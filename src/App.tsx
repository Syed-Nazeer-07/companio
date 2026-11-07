import React, { useState, useEffect } from 'react';
import { AppSettings, CharacterId } from './types';
import { dbService } from './services/dbService';
import { desktopBridge, isNativeDesktop } from './services/desktopBridge';
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

// Merge nested preferences so older, partial, or malformed saved settings
// cannot replace an entire settings section with null or missing fields.
const mergeSettings = (saved: Partial<AppSettings> = {}): AppSettings => {
  const validSection = (value: unknown): Record<string, unknown> =>
    value !== null && typeof value === 'object' && !Array.isArray(value)
      ? value as Record<string, unknown> : {};

  return {
    ...DEFAULT_SETTINGS,
    ...saved,
    character: { ...DEFAULT_SETTINGS.character, ...validSection(saved.character) },
    ai: { ...DEFAULT_SETTINGS.ai, ...validSection(saved.ai) },
    voice: { ...DEFAULT_SETTINGS.voice, ...validSection(saved.voice) },
    overlay: { ...DEFAULT_SETTINGS.overlay, ...validSection(saved.overlay) }
  };
};

export const App: React.FC = () => {
  const [settings, setSettings] = useState<AppSettings>(() => mergeSettings(dbService.loadSettings()));
  const [historyReady, setHistoryReady] = useState(false);

  const [currentTab, setCurrentTab] = useState<DashboardTab>('home');
  const [viewMode, setViewMode] = useState<'overlay' | 'dashboard'>('overlay');
  const [isOnboardingOpen, setIsOnboardingOpen] = useState<boolean>(false);

  useEffect(() => {
    let active = true;
    void dbService.init().then(() => {
      if (active) {
        setSettings(mergeSettings(dbService.loadSettings()));
        setHistoryReady(true);
      }
    }).catch((error) => {
      console.error('[Companio] History initialization failed:', error);
      if (active) setHistoryReady(true);
    });

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
    // Listen for live cross-window state updates (e.g. character selection from Control Center to Overlay)
    const unbind = desktopBridge.onStateUpdate((updatedSettings) => {
      if (updatedSettings) {
        setSettings((prev) => mergeSettings({ ...prev, ...updatedSettings }));
      }
    });

    const handleStorage = (e: StorageEvent) => {
      if ((e.key === 'companio_settings' || e.key === 'aura_settings') && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
            setSettings((prev) => mergeSettings({ ...prev, ...parsed }));
          }
        } catch {}
      }
    };
    window.addEventListener('storage', handleStorage);

    return () => {
      active = false;
      unbind();
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  const handleUpdateSettings = (newSettings: Partial<AppSettings>) => {
    setSettings((prev) => {
      const updated = mergeSettings({ ...prev, ...newSettings });
      dbService.saveSettings(updated);
      desktopBridge.sendStateUpdate(updated);
      return updated;
    });
  };

  const handleLaunchOverlay = () => {
    // The overlay may have been completely hidden by the dismissal shortcut.
    // Bring it back before closing the Control Center.
    void (async () => {
      try {
        if (isNativeDesktop()) {
          const shown = await desktopBridge.showOverlay();
          if (!shown) return;
        }
        await desktopBridge.toggleDashboard(false);
      } catch (error) {
        console.error('[Companio] Could not show companion overlay:', error);
      }
    })();
  };

  const handleOpenDashboard = () => {
    desktopBridge.toggleDashboard(true);
  };

  // Wait for the native history snapshot to hydrate before accepting new
  // chat/log writes. This prevents two windows from racing old cached data.
  if (!historyReady) {
    return <div className="w-screen h-screen bg-transparent" aria-label="Preparing Companio history" />;
  }

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
        onUpdateLive={handleUpdateSettings}
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
