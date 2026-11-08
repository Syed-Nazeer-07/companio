import React, { useEffect, useState } from 'react';
import { AppSettings } from '../../types';
import { Keyboard, Bell, Monitor, RotateCcw, Activity, RefreshCw, Power } from 'lucide-react';
import { desktopBridge, isNativeDesktop } from '../../services/desktopBridge';

interface Props {
  settings: AppSettings;
  onUpdateSettings: (newSettings: Partial<AppSettings>) => void;
}

export const SettingsPage: React.FC<Props> = ({ settings, onUpdateSettings }) => {
  const [shortcutDraft, setShortcutDraft] = useState(settings.activationShortcut);
  const [status, setStatus] = useState('');
  const [savingShortcut, setSavingShortcut] = useState(false);
  const [checkingDevice, setCheckingDevice] = useState(false);
  const [startupStatus, setStartupStatus] = useState<Awaited<ReturnType<typeof desktopBridge.getStartupStatus>> | null>(null);
  const [loadingStartup, setLoadingStartup] = useState(true);
  const [savingStartup, setSavingStartup] = useState(false);
  const [startupError, setStartupError] = useState('');
  const [diagnostics, setDiagnostics] = useState<
    Awaited<ReturnType<typeof desktopBridge.getDesktopDiagnostics>> | null
  >(null);
  useEffect(() => setShortcutDraft(settings.activationShortcut), [settings.activationShortcut]);
  useEffect(() => {
    let alive = true;
    void desktopBridge.getStartupStatus()
      .then(result => {
        if (!alive) return;
        setStartupStatus(result);
        if (!result.success) setStartupError(result.error || 'Could not read Windows startup settings.');
      })
      .catch(error => {
        if (alive) setStartupError(error instanceof Error ? error.message : 'Could not read Windows startup settings.');
      })
      .finally(() => { if (alive) setLoadingStartup(false); });
    return () => { alive = false; };
  }, []);

  const handleStartupToggle = async (enabled: boolean) => {
    if (!startupStatus?.supported || savingStartup) return;
    setSavingStartup(true);
    setStartupError('');
    try {
      const result = await desktopBridge.setStartupEnabled(enabled);
      setStartupStatus(result);
      if (!result.success) setStartupError(result.error || 'Windows startup setting could not be changed.');
    } catch (error) {
      setStartupError(error instanceof Error ? error.message : 'Could not update startup setting.');
      try { setStartupStatus(await desktopBridge.getStartupStatus()); } catch {}
    } finally {
      setSavingStartup(false);
    }
  };

  const handleSaveShortcut = async () => {
    setSavingShortcut(true);
    try {
      const result = await desktopBridge.setActivationShortcut(shortcutDraft);
      if (result.success && result.shortcut) {
        onUpdateSettings({ activationShortcut: result.shortcut.replace('CommandOrControl', 'Ctrl') });
        setStatus('Global shortcut updated.');
      } else setStatus(result.error || 'Shortcut could not be registered.');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Shortcut update failed.');
    } finally { setSavingShortcut(false); }
  };

  const handleOverlayOption = async (key: 'alwaysOnTop' | 'snapToEdge', enabled: boolean) => {
    const options = { alwaysOnTop: settings.overlay.alwaysOnTop, snapToEdge: settings.overlay.snapToEdge, [key]: enabled };
    try {
      const result = await desktopBridge.setOverlayPreferences(options);
      if (result.success) {
        onUpdateSettings({ overlay: { ...settings.overlay, ...options } });
        setStatus('Desktop behavior updated.');
      } else setStatus(result.error || 'Could not apply the native setting.');
    } catch (error) { setStatus(error instanceof Error ? error.message : 'Could not change desktop setting.'); }
  };

  const handleCheckDevice = async () => {
    setCheckingDevice(true);
    setDiagnostics(null);
    try {
      setDiagnostics(await desktopBridge.getDesktopDiagnostics());
    } catch (error) {
      setDiagnostics({
        success: false,
        error: error instanceof Error ? error.message : 'Device check failed.'
      });
    } finally {
      setCheckingDevice(false);
    }
  };

  const handleResetDefaults = async () => {
    if (!confirm('Reset Companio preferences? Your notes and history will be kept.')) return;
    if (isNativeDesktop()) {
      const shortcut = await desktopBridge.setActivationShortcut('Ctrl+Shift+Space');
      const overlay = await desktopBridge.setOverlayPreferences({ alwaysOnTop: true, snapToEdge: true });
      const startup = await desktopBridge.setStartupEnabled(false);
      if (!shortcut.success || !overlay.success || !startup.success) {
        setStatus(shortcut.error || overlay.error || startup.error || 'Could not reset native settings.');
        return;
      }
    }
    localStorage.removeItem('companio_settings');
    localStorage.removeItem('aura_settings');
    window.location.reload();
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200 max-w-4xl">
      <div>
        <h2 className="text-2xl font-bold text-slate-900 mb-1.5">Settings</h2>
        <p className="text-sm text-slate-600">
          Simple, essential preferences for your Companio desktop companion.
        </p>
      </div>

      <div className="acrylic-card rounded-2xl p-6 border border-slate-200 shadow-sm space-y-6">
        {/* Global Activation Shortcut */}
        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Keyboard className="w-4 h-4 text-sky-600" />
            <span>Global Activation Shortcut</span>
          </label>
          <div className="flex items-center gap-3">
            <input
              type="text"
              value={shortcutDraft}
              onChange={(e) => setShortcutDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void handleSaveShortcut(); } }}
              className="px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-sky-700 font-mono font-bold text-sm focus:outline-none focus:border-sky-500 focus:bg-white w-64 shadow-sm"
            />
            <button type="button" onClick={handleSaveShortcut} disabled={savingShortcut}
              className="rounded-lg bg-sky-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">
              {savingShortcut ? 'Saving...' : 'Save shortcut'}
            </button>
            <span className="text-xs text-slate-500">Example: Ctrl+Shift+Space</span>
          </div>
          {status && <p role="status" className="mt-2 text-xs text-slate-600">{status}</p>}
        </div>

        <div className="border-t border-slate-100 pt-5 space-y-4">
          <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
            <Power className="w-4 h-4 text-sky-600" />
            <span>Windows Startup</span>
          </h3>
          <div className="flex items-center justify-between gap-4 p-3.5 rounded-xl bg-slate-50 border border-slate-200">
            <div>
              <label htmlFor="companio-launch-at-login" className="text-sm font-bold text-slate-800">Launch Companio when I sign in</label>
              <p className="text-xs text-slate-500 mt-1">Optional. Starts your floating companion and tray icon after Windows sign-in. Off until you enable it.</p>
            </div>
            <input
              id="companio-launch-at-login"
              type="checkbox"
              checked={startupStatus?.enabled === true}
              disabled={loadingStartup || savingStartup || !startupStatus?.success || !startupStatus.supported}
              onChange={event => void handleStartupToggle(event.target.checked)}
              className="w-5 h-5 shrink-0 accent-sky-600 rounded cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>
          {loadingStartup && <p className="text-xs text-slate-500" role="status">Reading Windows startup preference…</p>}
          {!loadingStartup && startupStatus?.supported === false && (
            <p className="text-xs text-slate-500">Available in the installed Windows app, not browser or development previews.</p>
          )}
          {!loadingStartup && startupStatus?.blockedByWindows && (
            <p className="text-xs text-amber-700">Windows Startup Apps has disabled this entry. Re-enable it here or in Windows Settings.</p>
          )}
          {savingStartup && <p className="text-xs text-slate-500" role="status">Applying startup preference…</p>}
          {startupError && <p className="text-xs text-rose-700" role="alert">{startupError}</p>}
        </div>

        <div className="border-t border-slate-100 pt-5 space-y-4">
          <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
            <Monitor className="w-4 h-4 text-sky-600" />
            <span>Desktop Behavior</span>
          </h3>

          {/* Always on Top */}
          <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 border border-slate-200">
            <div>
              <p className="text-sm font-bold text-slate-800">Always On Top</p>
              <p className="text-xs text-slate-500">Keep companion character visible over other open windows</p>
            </div>
            <input
              type="checkbox"
              checked={settings.overlay.alwaysOnTop}
              onChange={(e) => void handleOverlayOption('alwaysOnTop', e.target.checked)}
              className="w-5 h-5 accent-sky-600 rounded cursor-pointer"
            />
          </div>

          {/* Snap to Screen Edges */}
          <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 border border-slate-200">
            <div>
              <p className="text-sm font-bold text-slate-800">Snap to Screen Edges</p>
              <p className="text-xs text-slate-500">Automatically stick character near screen borders when dragged</p>
            </div>
            <input
              type="checkbox"
              checked={settings.overlay.snapToEdge}
              onChange={(e) => void handleOverlayOption('snapToEdge', e.target.checked)}
              className="w-5 h-5 accent-sky-600 rounded cursor-pointer"
            />
          </div>

          {/* Sound Effects & Chimes */}
          <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 border border-slate-200">
            <div>
              <p className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                <Bell className="w-3.5 h-3.5 text-sky-600" />
                <span>Audio Chimes & Cues</span>
              </p>
              <p className="text-xs text-slate-500">Play pleasant audio tones on task completion and activation</p>
            </div>
            <input
              type="checkbox"
              checked={settings.overlay.soundEffects}
              onChange={(e) => onUpdateSettings({
                overlay: { ...settings.overlay, soundEffects: e.target.checked }
              })}
              className="w-5 h-5 accent-sky-600 rounded cursor-pointer"
            />
          </div>

          {/* Hide in Fullscreen Games */}
          <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 border border-slate-200">
            <div>
              <p className="text-sm font-bold text-slate-800">Hide in Exclusive Fullscreen Games</p>
              <p className="text-xs text-slate-500">Not yet supported. Fullscreen detection is planned for a future update.</p>
            </div>
            <input
              type="checkbox"
              checked={false}
              disabled
              aria-label="Fullscreen detection is not yet available"
              className="w-5 h-5 accent-sky-600 rounded cursor-pointer"
            />
          </div>
        </div>
      </div>

      {/* Honest, read-only diagnostics for actual Windows installation. */}
      <section className="acrylic-card rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900">
              <Activity className="h-4 w-4 text-sky-600" />
              Device diagnostics
            </h3>
            <p className="mt-1 text-xs text-slate-500">Read-only checks for your installed Windows app. No microphone recording or commands.</p>
          </div>
          <button
            type="button"
            disabled={checkingDevice || !isNativeDesktop()}
            onClick={() => void handleCheckDevice()}
            className="inline-flex items-center gap-2 rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-xs font-bold text-sky-700 hover:bg-sky-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${checkingDevice ? 'animate-spin' : ''}`} />
            {checkingDevice ? 'Checking…' : 'Run diagnostics'}
          </button>
        </div>
        {!isNativeDesktop() && <p className="text-xs text-amber-700">Use the installed Companio desktop app to check Windows integration.</p>}
        {diagnostics && !diagnostics.success && <p role="alert" className="text-xs text-rose-700">{diagnostics.error}</p>}
        {diagnostics?.success && (
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2" role="status">
            {[
              {
                label: 'Desktop runtime',
                ok: diagnostics.platform === 'win32',
                detail: `Windows ${diagnostics.architecture || 'unknown'} · v${diagnostics.appVersion || '?'}`
              },
              {
                label: 'Global shortcut',
                ok: diagnostics.shortcutRegistered === true,
                detail: diagnostics.shortcutRegistered ? diagnostics.shortcut || 'Registered' : 'Not registered'
              },
              {
                label: 'History on disk',
                ok: diagnostics.history?.available === true,
                detail: diagnostics.history?.available ? 'Native snapshot readable' : diagnostics.history?.error || 'Not available'
              },
              {
                label: 'Windows audio',
                ok: diagnostics.audio?.available === true,
                detail: diagnostics.audio?.available ? 'Volume state readable' : diagnostics.audio?.error || 'Not available'
              }
            ].map(item => (
              <div key={item.label} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <div className="flex items-center gap-1.5">
                  <span aria-hidden="true" className={`h-2 w-2 rounded-full ${item.ok ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                  <span className="text-xs font-bold text-slate-800">{item.label}</span>
                </div>
                <p className="mt-1 text-[11px] leading-snug text-slate-600 break-words">{item.detail}</p>
              </div>
            ))}
          </div>
        )}
        <p className="text-[11px] text-slate-500">
          A passed check does not prove speech recognition, browser playback or every Windows action works.
          Test the microphone separately in Voice Settings.
        </p>
      </section>

      {/* Reset */}
      <div className="pt-2 flex items-center justify-between">
        <div>
          <p className="text-xs font-bold text-slate-700">Restore Factory Defaults</p>
          <p className="text-[11px] text-slate-500">Resets local settings and character choices</p>
        </div>
        <button
          onClick={handleResetDefaults}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 text-xs font-bold transition-colors"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Reset All Defaults</span>
        </button>
      </div>
    </div>
  );
};
