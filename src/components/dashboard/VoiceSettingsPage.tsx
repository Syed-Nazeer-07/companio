import React, { useState, useEffect } from 'react';
import { AppSettings } from '../../types';
import { speechService } from '../../services/speechService';
import { Mic, Volume2, Play, VolumeX, Sparkles } from 'lucide-react';

interface Props {
  settings: AppSettings;
  onUpdateSettings: (newSettings: Partial<AppSettings>) => void;
}

export const VoiceSettingsPage: React.FC<Props> = ({ settings, onUpdateSettings }) => {
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [testingVoice, setTestingVoice] = useState<boolean>(false);
  const [testingMic, setTestingMic] = useState<boolean>(false);
  const [micLevel, setMicLevel] = useState<number>(0);
  const micIntervalRef = React.useRef<any>(null);
  const micStreamRef = React.useRef<MediaStream | null>(null);

  useEffect(() => {
    const loadVoices = () => {
      const v = speechService.getAvailableVoices();
      setAvailableVoices(v);
    };
    loadVoices();
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }

    return () => {
      if (micIntervalRef.current) clearInterval(micIntervalRef.current);
      if (micStreamRef.current) micStreamRef.current.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const handleToggleTestMic = async () => {
    if (testingMic) {
      if (micIntervalRef.current) clearInterval(micIntervalRef.current);
      if (micStreamRef.current) micStreamRef.current.getTracks().forEach((t) => t.stop());
      setTestingMic(false);
      setMicLevel(0);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStreamRef.current = stream;
      setTestingMic(true);
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 64;
      source.connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);
      micIntervalRef.current = setInterval(() => {
        analyser.getByteFrequencyData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i++) sum += data[i];
        const avg = sum / data.length;
        const norm = Math.min(100, Math.round(avg * 1.2));
        setMicLevel(norm);
      }, 50);
    } catch (e: any) {
      alert(`Could not access microphone: ${e.message}`);
    }
  };

  const handleTestVoice = () => {
    setTestingVoice(true);
    speechService.speak(
      `Hello! I am ${settings.characterName}, your personal Windows 11 AI desktop companion. My voice is ready and sounding great!`,
      {
        voiceName: settings.voice.ttsVoice,
        rate: settings.voice.ttsRate,
        pitch: settings.voice.ttsPitch,
        volume: settings.voice.ttsVolume,
        muted: false,
        onEnd: () => setTestingVoice(false)
      }
    );
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-200">
      <div>
        <h2 className="text-2xl font-bold text-slate-900 mb-1.5">Voice & Speech Interaction</h2>
        <p className="text-sm text-slate-600">
          Configure speech recognition, push-to-talk, and text-to-speech companion voices.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Input: Microphone & Wake Word */}
        <div className="acrylic-card rounded-2xl p-6 space-y-5 border border-slate-200 shadow-sm">
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Mic className="w-4 h-4 text-sky-600" />
            <span>Voice Input (Speech-to-Text)</span>
          </h3>

          {/* Wake Word Toggle */}
          <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 border border-slate-200">
            <div>
              <p className="text-sm font-bold text-slate-800">Wake Phrase ("Hey Companio")</p>
              <p className="text-xs text-slate-500">Allows hands-free voice activation when overlay is running</p>
            </div>
            <input
              type="checkbox"
              checked={settings.voice.wakePhraseEnabled}
              onChange={(e) => onUpdateSettings({
                voice: { ...settings.voice, wakePhraseEnabled: e.target.checked }
              })}
              className="w-5 h-5 accent-sky-600 rounded cursor-pointer"
            />
          </div>

          {/* Push to Talk Info */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Push-to-Talk Activation
            </label>
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700">
              Click the microphone button on the companion or press <span className="font-mono font-bold text-sky-700">Ctrl + Shift + Space</span> to talk!
            </div>
          </div>

          {/* Test Live Microphone Meter */}
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800">Test Live Microphone</span>
              <button
                type="button"
                onClick={handleToggleTestMic}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                  testingMic
                    ? 'bg-rose-500 text-white shadow-sm'
                    : 'bg-sky-500 text-white shadow-sm hover:bg-sky-600'
                }`}
              >
                {testingMic ? 'Stop Mic Test' : 'Test Mic'}
              </button>
            </div>

            {testingMic && (
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[11px] text-slate-600 font-mono">
                  <span>Speak into mic:</span>
                  <span className="font-bold text-emerald-600">{micLevel}%</span>
                </div>
                <div className="w-full h-3 bg-slate-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 transition-all duration-75 rounded-full"
                    style={{ width: `${micLevel}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Output: Text-To-Speech Synthesis */}
        <div className="acrylic-card rounded-2xl p-6 space-y-5 border border-slate-200 shadow-sm">
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Volume2 className="w-4 h-4 text-sky-600" />
            <span>Spoken Replies (Text-to-Speech)</span>
          </h3>

          {/* Mute Toggle */}
          <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 border border-slate-200">
            <div>
              <p className="text-sm font-bold text-slate-800">Enable Audible Spoken Replies</p>
              <p className="text-xs text-slate-500">Speaks replies aloud when completing tasks</p>
            </div>
            <input
              type="checkbox"
              checked={!settings.voice.muted}
              onChange={(e) => onUpdateSettings({
                voice: { ...settings.voice, muted: !e.target.checked }
              })}
              className="w-5 h-5 accent-sky-600 rounded cursor-pointer"
            />
          </div>

          {/* Character Voice Profile Preview */}
          <div className="p-3.5 rounded-xl bg-sky-50/60 border border-sky-200 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-sky-600" />
                <span>Auto-Matched for {settings.characterName || 'Companion'}</span>
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-sky-100 text-sky-700">
                {settings.characterId} profile
              </span>
            </div>
            <p className="text-[11px] text-slate-600 leading-relaxed">
              Companio automatically customizes pitch and rate to match {settings.characterName}'s personality.
            </p>
          </div>

          {/* Voice Selector */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Specific Windows System Voice (Optional Override)
            </label>
            <select
              value={settings.voice.ttsVoice}
              onChange={(e) => onUpdateSettings({
                voice: { ...settings.voice, ttsVoice: e.target.value }
              })}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 text-xs font-semibold focus:outline-none focus:border-sky-500"
            >
              <option value="">Auto-Match Character Profile (Recommended)</option>
              {availableVoices
                .filter((v) => v.lang.startsWith('en'))
                .map((v) => (
                  <option key={v.name} value={v.name}>
                    {v.name} ({v.lang})
                  </option>
                ))}
            </select>
          </div>

          {/* Test Voice Button */}
          <button
            onClick={handleTestVoice}
            disabled={testingVoice}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 text-xs font-bold transition-all disabled:opacity-50"
          >
            <Play className={`w-3.5 h-3.5 fill-current ${testingVoice ? 'animate-spin' : ''}`} />
            <span>{testingVoice ? 'Speaking...' : 'Test Voice Audio'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
