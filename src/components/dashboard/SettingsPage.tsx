import React, { useEffect, useState } from 'react';
import { AppSettings } from '../../types';
import { Keyboard, Bell, Monitor, RotateCcw } from 'lucide-react';
import { desktopBridge, isNativeDesktop } from '../../services/desktopBridge';

interface Props {
  settings: AppSettings;
  onUpdateSettings: (newSettings: Partial<AppSettings>) => void;
}

export const SettingsPage: React.FC<Props> = ({ settings, onUpdateSettings }) => {
  const [shortcutDraft, setShortcutDraft] = useState(settings.activationShortcut);
  const [status, setStatus] = useState('');
  const [savingShortcut, setSavingShortcut] = useState(false);
  useEffect(() => setShortcutDraft(settings.activationShortcut), [settings.activationShortcut]);

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

  const handleResetDefaults = async () => {
    if (!confirm('Reset Companio preferences? Your notes and history will be kept.')) return;
    if (isNativeDesktop()) {
      const shortcut = await desktopBridge.setActivationShortcut('Ctrl+Shift+Space');
      const overlay = await desktopBridge.setOverlayPreferences({ alwaysOnTop: true, snapToEdge: true });
      if (!shortcut.success || !overlay.success) {
        setStatus(shortcut.error || overlay.error || 'Could not reset native settings.');
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
