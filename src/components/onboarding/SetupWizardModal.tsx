import React, { useState } from 'react';
import { AppSettings, CharacterId } from '../../types';
import { CharacterRenderer } from '../characters/CharacterRenderer';
import { 
  Check, 
  ArrowRight, 
  ArrowLeft, 
  Sparkles, 
  Keyboard, 
  Play, 
  CheckCircle2,
  Cpu
} from 'lucide-react';
import { desktopBridge } from '../../services/desktopBridge';
import { speechService } from '../../services/speechService';

interface Props {
  isOpen: boolean;
  settings: AppSettings;
  onUpdateLive?: (updated: Partial<AppSettings>) => void;
  onComplete: (updated: Partial<AppSettings>) => void;
  onClose: () => void;
}

export const SetupWizardModal: React.FC<Props> = ({
  isOpen,
  settings,
  onUpdateLive,
  onComplete,
  onClose
}) => {
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [localSettings, setLocalSettings] = useState<AppSettings>(settings);
  const [testCmdStatus, setTestCmdStatus] = useState<string | null>(null);

  // Sync localSettings if settings prop changes from live updates
  React.useEffect(() => {
    setLocalSettings((prev) => ({ ...prev, characterId: settings.characterId }));
  }, [settings.characterId]);

  if (!isOpen) return null;

  const cuteCharacters: { id: CharacterId; name: string; desc: string }[] = [
    { id: 'sparky', name: 'Sparky', desc: 'Cute Robot' },
    { id: 'pixel', name: 'Pixel', desc: '16-bit Fox' },
    { id: 'mochi', name: 'Mochi', desc: 'Squishy 3D' },
    { id: 'cloudie', name: 'Cloudie', desc: 'Dream Cloud' },
    { id: 'kiko', name: 'Kiko', desc: 'Chibi Kitten' },
    { id: 'boba', name: 'Boba', desc: 'Boba Bear' }
  ];

  const handleSelectCharacter = (charId: CharacterId) => {
    setLocalSettings((prev) => ({ ...prev, characterId: charId }));
    onUpdateLive?.({ characterId: charId });
    speechService.playChime('activate');
  };

  const handleNext = () => {
    if (currentStep < 4) {
      setCurrentStep(currentStep + 1);
    } else {
      onComplete({ ...localSettings, firstTimeSetupDone: true });
    }
  };

  const handlePrev = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleTestRealCommand = async (tool: string, params: any, label: string) => {
    setTestCmdStatus(`Testing: ${label}...`);
    try {
      const res = await desktopBridge.executeTool(tool, params);
      if (res && res.success !== false) {
        setTestCmdStatus(`✓ ${label} succeeded!`);
        speechService.playChime('success');
      } else {
        setTestCmdStatus(`Failed: ${res?.error || 'Execution issue'}`);
      }
    } catch (e: any) {
      setTestCmdStatus(`Error: ${e.message}`);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-slate-900/40 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-2xl bg-white/95 rounded-3xl p-8 border border-slate-200/80 shadow-[0_24px_64px_rgba(0,0,0,0.18)] text-slate-800 flex flex-col justify-between min-h-[520px]">
        
        {/* Top Step Indicator Bar */}
        <div>
          <div className="flex items-center justify-between pb-4 border-b border-slate-200 mb-6">
            <div className="flex items-center gap-3">
              <span className="w-8 h-8 rounded-xl bg-sky-500 text-white flex items-center justify-center text-sm font-bold shadow-md shadow-sky-500/20">
                {currentStep}
              </span>
              <div>
                <h3 className="text-base font-bold text-slate-900 leading-tight">
                  {currentStep === 1 && 'Choose Your Cute Companion'}
                  {currentStep === 2 && 'Assistant Name & AI Engine'}
                  {currentStep === 3 && 'Activation Shortcut & Voice'}
                  {currentStep === 4 && 'Test Your Assistant & Get Started!'}
                </h3>
                <p className="text-xs text-slate-500">
                  Step {currentStep} of 4 • Windows 11 Desktop Setup
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              {[1, 2, 3, 4].map((step) => (
                <div
                  key={step}
                  className={`w-6 h-1.5 rounded-full transition-all ${
                    currentStep >= step ? 'bg-sky-500' : 'bg-slate-200'
                  }`}
                />
              ))}
            </div>
          </div>

          {/* Step 1: Pick Cute Character */}
          {currentStep === 1 && (
            <div className="space-y-4">
              <p className="text-sm text-slate-600">
                Select your living desktop companion. Each avatar features smooth animations, expressive reactions, and transparent desktop placement:
              </p>
              <div className="grid grid-cols-3 gap-3.5">
                {cuteCharacters.map((char) => {
                  const isSel = localSettings.characterId === char.id;
                  return (
                    <div
                      key={char.id}
                      onClick={() => handleSelectCharacter(char.id)}
                      className={`p-3.5 rounded-2xl cursor-pointer border text-center transition-all ${
                        isSel 
                          ? 'border-sky-500 bg-sky-50 shadow-md ring-2 ring-sky-500/20' 
                          : 'border-slate-200 hover:border-slate-300 bg-slate-50/50 hover:bg-slate-100/50'
                      }`}
                    >
                      <div className="h-20 flex items-center justify-center mb-1">
                        <CharacterRenderer characterId={char.id} state="idle" scale={0.55} />
                      </div>
                      <p className="text-sm font-bold text-slate-800">{char.name}</p>
                      <p className="text-xs text-slate-500">{char.desc}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Step 2: Name & AI Engine */}
          {currentStep === 2 && (
            <div className="space-y-5 py-2">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Companion Name
                </label>
                <input
                  type="text"
                  value={localSettings.characterName}
                  onChange={(e) => setLocalSettings({ ...localSettings, characterName: e.target.value })}
                  placeholder="e.g. Companio, Sparky, Kiko"
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 text-sm font-medium focus:outline-none focus:border-sky-500 focus:bg-white transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  AI Intelligence Engine
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div
                    onClick={() => setLocalSettings({
                      ...localSettings,
                      ai: { ...localSettings.ai, provider: 'mock' }
                    })}
                    className={`p-4 rounded-2xl cursor-pointer border transition-all ${
                      localSettings.ai.provider === 'mock'
                        ? 'border-sky-500 bg-sky-50 ring-2 ring-sky-500/20'
                        : 'border-slate-200 bg-slate-50 hover:bg-slate-100'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-bold text-slate-900">Instant Native Engine</span>
                      {localSettings.ai.provider === 'mock' && <Check className="w-4 h-4 text-sky-600 stroke-[3]" />}
                    </div>
                    <p className="text-xs text-slate-500 leading-relaxed">
                      Runs supported commands offline without API keys. General computer control is still experimental.
                    </p>
                  </div>

                  <div
                    onClick={() => setLocalSettings({
                      ...localSettings,
                      ai: { ...localSettings.ai, provider: 'local' }
                    })}
                    className={`p-4 rounded-2xl cursor-pointer border transition-all ${
                      localSettings.ai.provider === 'local'
                        ? 'border-sky-500 bg-sky-50 ring-2 ring-sky-500/20'
                        : 'border-slate-200 bg-slate-50 hover:bg-slate-100'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                        <Cpu className="w-4 h-4 text-sky-600" />
                        Local LLM (Ollama)
                      </span>
                      {localSettings.ai.provider === 'local' && <Check className="w-4 h-4 text-sky-600 stroke-[3]" />}
                    </div>
                    <p className="text-xs text-slate-500 leading-relaxed">
                      Connect to small local models (Llama 3.2, Qwen, Phi-3) via Ollama/LM Studio on your PC!
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Activation & Voice */}
          {currentStep === 3 && (
            <div className="space-y-5 py-2">
              <div className="p-4 rounded-2xl bg-sky-50 border border-sky-200 flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-sky-500 text-white flex items-center justify-center shrink-0 shadow-md">
                  <Keyboard className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900">Global Activation Shortcut</h4>
                  <p className="text-xs text-slate-600 mt-0.5">
                    Press <span className="font-mono font-bold text-sky-700 bg-white px-2 py-0.5 rounded border border-sky-200">Ctrl + Shift + Space</span> anywhere to summon or toggle Companio!
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Audible Voice Responses
                </label>
                <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                  <div>
                    <p className="text-sm font-semibold text-slate-800">Spoken Voice Output</p>
                    <p className="text-xs text-slate-500">Companio speaks responses using a friendly, sweet natural voice</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={!localSettings.voice.muted}
                    onChange={(e) => setLocalSettings({
                      ...localSettings,
                      voice: { ...localSettings.voice, muted: !e.target.checked }
                    })}
                    className="w-5 h-5 accent-sky-600 rounded cursor-pointer"
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={() => speechService.speak(`Hi there! I'm ${localSettings.characterName}. I am ready to be your desktop companion!`, { muted: false })}
                className="w-full py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition-colors flex items-center justify-center gap-2"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Hear Sample Voice</span>
              </button>
            </div>
          )}

          {/* Step 4: Quick Real Command Test */}
          {currentStep === 4 && (
            <div className="space-y-4 text-center py-2">
              <div className="w-14 h-14 rounded-2xl bg-emerald-500/15 text-emerald-600 mx-auto flex items-center justify-center">
                <Sparkles className="w-7 h-7" />
              </div>
              <div>
                <h4 className="text-lg font-bold text-slate-900">Try a Real Action Now</h4>
                <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
                  Click a test action to see Companio interact with your Windows computer right away:
                </p>
              </div>

              <div className="grid grid-cols-3 gap-3 max-w-lg mx-auto">
                <button
                  type="button"
                  onClick={() => handleTestRealCommand('win.calculator.launch', {}, 'Open Calculator')}
                  className="p-3 rounded-xl bg-slate-100 hover:bg-sky-50 text-slate-800 text-xs font-bold border border-slate-200 hover:border-sky-300 transition-colors"
                >
                  🧮 Calculator
                </button>
                <button
                  type="button"
                  onClick={() => handleTestRealCommand('browser.chatgpt.open', {}, 'Open ChatGPT')}
                  className="p-3 rounded-xl bg-slate-100 hover:bg-sky-50 text-slate-800 text-xs font-bold border border-slate-200 hover:border-sky-300 transition-colors"
                >
                  💬 ChatGPT
                </button>
                <button
                  type="button"
                  onClick={() => handleTestRealCommand('win.volume.set', { level: 60 }, 'Set Volume 60%')}
                  className="p-3 rounded-xl bg-slate-100 hover:bg-sky-50 text-slate-800 text-xs font-bold border border-slate-200 hover:border-sky-300 transition-colors"
                >
                  🔊 Volume 60%
                </button>
              </div>

              {testCmdStatus && (
                <p className="text-xs font-bold text-emerald-600 animate-in fade-in duration-150">
                  {testCmdStatus}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Footer Navigation Buttons */}
        <div className="pt-6 border-t border-slate-200 flex items-center justify-between">
          <button
            type="button"
            onClick={handlePrev}
            disabled={currentStep === 1}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-700 disabled:opacity-30 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back</span>
          </button>

          <button
            type="button"
            onClick={handleNext}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-600 text-white text-xs font-bold shadow-lg shadow-sky-500/25 transition-all active:scale-95"
          >
            <span>{currentStep === 4 ? 'Finish & Launch Companion' : 'Continue'}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
