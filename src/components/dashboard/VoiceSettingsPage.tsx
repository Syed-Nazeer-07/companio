import React, { useState, useEffect } from 'react';
import { AppSettings } from '../../types';
import { speechService } from '../../services/speechService';
import { desktopBridge, isNativeDesktop } from '../../services/desktopBridge';
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
  const micAudioCtxRef = React.useRef<AudioContext | null>(null);
  const micRequestRef = React.useRef(0);
  const [micError, setMicError] = useState<string | null>(null);
  const [testingRecognition, setTestingRecognition] = useState(false);
  const [recognitionFeedback, setRecognitionFeedback] = useState('');
  const [recognitionAlternatives, setRecognitionAlternatives] = useState<string[]>([]);
  const [whisperStatus, setWhisperStatus] = useState<Awaited<ReturnType<typeof desktopBridge.getWhisperStatus>> | null>(null);
  const [whisperSetupError, setWhisperSetupError] = useState('');
  const [choosingWhisper, setChoosingWhisper] = useState(false);
  const [downloadingWhisper, setDownloadingWhisper] = useState(false);
  const [whisperDownloadPercent, setWhisperDownloadPercent] = useState<number | null>(null);
  const [installingOfflineWhisper, setInstallingOfflineWhisper] = useState(false);
  const [whisperBinaryPercent, setWhisperBinaryPercent] = useState<number | null>(null);
  const [whisperSetupStage, setWhisperSetupStage] = useState('');
  const setupRequestRef = React.useRef(0);

  useEffect(() => desktopBridge.onWhisperModelProgress(progress => {
    setWhisperDownloadPercent(progress.percent);
    setWhisperSetupStage('Downloading and checking English model…');
  }), []);
  useEffect(() => desktopBridge.onWhisperBinaryProgress(progress => {
    setWhisperBinaryPercent(progress.percent);
    setWhisperSetupStage(progress.stage === 'extract'
      ? 'Verifying and unpacking the CPU speech engine…'
      : 'Downloading official whisper.cpp CPU engine…');
  }), []);

  // Opt-in only: no background downloads, admin elevation or automatic native
  // binary execution. Both archives are pinned to verified upstream hashes.
  const installOfflineWhisper = async () => {
    if (installingOfflineWhisper || choosingWhisper || downloadingWhisper || !isNativeDesktop()) return;
    const request = ++setupRequestRef.current;
    setInstallingOfflineWhisper(true);
    setWhisperSetupError('');
    setWhisperBinaryPercent(null);
    setWhisperDownloadPercent(null);
    try {
      let state = await desktopBridge.getWhisperStatus();
      if (!state.executable) {
        setWhisperSetupStage('Downloading official CPU speech engine…');
        const binary = await desktopBridge.installWhisperBinary();
        if (request !== setupRequestRef.current) return;
        if (!binary.success) throw Error(binary.error || 'The speech engine could not be installed.');
        state = await desktopBridge.getWhisperStatus();
      }
      if (request !== setupRequestRef.current) return;
      if (!state.model) {
        setWhisperSetupStage('Downloading and verifying the English speech model…');
        const model = await desktopBridge.downloadWhisperModel();
        if (request !== setupRequestRef.current) return;
        if (!model.success) throw Error(model.error || 'The speech model could not be installed.');
      }
      if (request !== setupRequestRef.current) return;
      const installed = await desktopBridge.getWhisperStatus();
      setWhisperStatus(installed);
      if (!installed.configured) throw Error('Both Whisper components were installed, but local speech is not ready.');
      setWhisperSetupStage('Offline Whisper is ready.');
      onUpdateSettings({voice:{...settings.voice,recognitionEngine:'whisper'}});
    } catch (error) {
      if (request === setupRequestRef.current) {
        setWhisperSetupError(error instanceof Error ? error.message : 'Offline Whisper setup could not be completed.');
        setWhisperStatus(await desktopBridge.getWhisperStatus().catch(() => null));
      }
    } finally {
      if (request === setupRequestRef.current) setInstallingOfflineWhisper(false);
    }
  };

  const cancelOfflineWhisperSetup = async () => {
    ++setupRequestRef.current;
    setWhisperSetupStage('Setup cancelled. Partial downloads will be discarded.');
    await Promise.all([
      desktopBridge.cancelWhisperBinaryInstall(),
      desktopBridge.cancelWhisperModelDownload()
    ]);
    setInstallingOfflineWhisper(false);
    setWhisperStatus(await desktopBridge.getWhisperStatus().catch(() => null));
  };

  const downloadRecommendedSpeechModel = async () => {
    if (downloadingWhisper || installingOfflineWhisper) return;
    setDownloadingWhisper(true);
    setWhisperSetupError('');
    setWhisperDownloadPercent(0);
    try {
      const result = await desktopBridge.downloadWhisperModel();
      if (!result.success) setWhisperSetupError(result.error || 'Speech model could not be downloaded.');
      setWhisperStatus(await desktopBridge.getWhisperStatus());
    } catch(error) {
      setWhisperSetupError(error instanceof Error ? error.message : 'Speech model download failed.');
    } finally {
      setDownloadingWhisper(false);
    }
  };

  const cancelRecommendedSpeechModel = async () => {
    const result=await desktopBridge.cancelWhisperModelDownload();
    if (!result.success) setWhisperSetupError('Could not cancel the speech model download.');
  };

  useEffect(() => {
    let mounted = true;
    void desktopBridge.getWhisperStatus().then(status => {
      if (mounted) setWhisperStatus(status);
    }).catch(() => {});
    return () => { mounted = false; };
  }, []);

  const chooseWhisperFile = async (kind: 'binary' | 'model') => {
    if (choosingWhisper) return;
    setChoosingWhisper(true);
    setWhisperSetupError('');
    try {
      const result = await desktopBridge.chooseWhisperFile(kind);
      if (!result.success && !result.cancelled) setWhisperSetupError(result.error || 'Could not select this speech file.');
      setWhisperStatus(await desktopBridge.getWhisperStatus());
    } catch (error) {
      setWhisperSetupError(error instanceof Error ? error.message : 'Whisper file setup failed.');
    } finally {
      setChoosingWhisper(false);
    }
  };

  useEffect(() => {
    const loadVoices = () => {
      const v = speechService.getAvailableVoices();
      setAvailableVoices(v);
    };
    loadVoices();
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.addEventListener('voiceschanged', loadVoices);
    }

    return () => {
      micRequestRef.current++;
      if (micIntervalRef.current) clearInterval(micIntervalRef.current);
      if (micStreamRef.current) micStreamRef.current.getTracks().forEach((t) => t.stop());
      if (micAudioCtxRef.current) void micAudioCtxRef.current.close().catch(() => {});
      if ('speechSynthesis' in window) {
        window.speechSynthesis.removeEventListener('voiceschanged', loadVoices);
      }
      speechService.stopSpeaking();
      speechService.stopListening();
    };
  }, []);

  const handleToggleTestMic = async () => {
    const request = ++micRequestRef.current;
    if (testingMic) {
      if (micIntervalRef.current) clearInterval(micIntervalRef.current);
      micIntervalRef.current = null;
      micStreamRef.current?.getTracks().forEach(track => track.stop());
      micStreamRef.current = null;
      if (micAudioCtxRef.current) void micAudioCtxRef.current.close().catch(() => {});
      micAudioCtxRef.current = null;
      setTestingMic(false);
      setMicLevel(0);
      return;
    }

    setMicError(null);
    setTestingMic(true); // Permit cancellation while the browser asks permission.
    let stream: MediaStream | null = null;
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('This browser does not provide microphone access.');
      }
      stream = await navigator.mediaDevices.getUserMedia({audio:true});
      if (request !== micRequestRef.current) {
        stream.getTracks().forEach(track => track.stop());
        return;
      }
      micStreamRef.current = stream;
      const Ctx = window.AudioContext || (window as any).webkitAudioContext;
      if (!Ctx) throw new Error('Audio level monitoring is unavailable in this browser.');
      const audioCtx = new Ctx() as AudioContext;
      micAudioCtxRef.current = audioCtx;
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 64;
      source.connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);
      micIntervalRef.current = setInterval(() => {
        if (request !== micRequestRef.current) return;
        analyser.getByteFrequencyData(data);
        const average = data.reduce((sum,value)=>sum+value,0)/data.length;
        setMicLevel(Math.min(100, Math.max(0, Math.round(average * 1.2))));
      },80);
    } catch (error) {
      stream?.getTracks().forEach(track => track.stop());
      if (request === micRequestRef.current) {
        setTestingMic(false);
        setMicLevel(0);
        setMicError(error instanceof Error ? error.message : 'Could not access your microphone.');
      }
      if (micAudioCtxRef.current) void micAudioCtxRef.current.close().catch(() => {});
      micAudioCtxRef.current = null;
      micStreamRef.current = null;
    }
  };

  const handleRecognitionTest = () => {
    if (testingRecognition) {
      speechService.stopListening();
      setTestingRecognition(false);
      setRecognitionFeedback('Recognition test stopped.');
      return;
    }
    setTestingRecognition(true);
    setRecognitionAlternatives([]);
    setRecognitionFeedback('Listening for a short phrase…');
    void speechService.startListening(
      interim => setRecognitionFeedback(interim),
      (text, details) => {
        setTestingRecognition(false);
        const language = details?.language ? ' (' + details.language + ')' : '';
        const confidence = typeof details?.confidence === 'number'
          ? ' · confidence ' + Math.round(details.confidence * 100) + '%'
          : '';
        setRecognitionFeedback('Recognized' + language + ': "' + text + '"' + confidence);
        setRecognitionAlternatives(details?.alternatives?.slice(0, 3) || []);
      },
      error => {
        setTestingRecognition(false);
        setRecognitionFeedback(error);
      },
      undefined,
      () => {
        setTestingRecognition(false);
        setRecognitionFeedback('No words recognized. Check your microphone or Windows speech language pack.');
      },
      settings.voice.recognitionLanguage || 'en-IN',
      settings.overlay.soundEffects,
      settings.voice.recognitionEngine === 'whisper' ? 'whisper' : settings.voice.recognitionEngine === 'windows' ? 'windows' : 'auto'
    );
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
        characterId: settings.characterId,
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
              <p className="text-sm font-bold text-slate-800">Auto-start listening after activation</p>
              <p className="text-xs text-slate-500">Starts the microphone after activating Companio. Continuous wake-word detection is not available.</p>
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

          {/* Hands-free is restricted to exact known reversible commands. */}
          <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3.5">
            <div>
              <label htmlFor="companio-voice-auto-send" className="text-sm font-bold text-slate-800">Hands-free basic commands</label>
              <p className="mt-1 text-xs leading-relaxed text-slate-500">
                Automatically send simple named app launches, local screenshots and conversation.
                Unknown websites, searches and risky actions always require transcript review.
              </p>
            </div>
            <input id="companio-voice-auto-send" type="checkbox"
              checked={settings.voice.autoSendSafeSpeech === true}
              onChange={event => onUpdateSettings({
                voice: { ...settings.voice, autoSendSafeSpeech: event.target.checked }
              })}
              className="h-5 w-5 shrink-0 cursor-pointer accent-sky-600" />
          </div>

          {/* Local Whisper is optional, explicit, private and uses no API credentials. */}
          <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-3.5">
            <label htmlFor="companio-speech-engine" className="block text-xs font-bold uppercase tracking-wider text-slate-700">
              Speech recognition engine
            </label>
            <select
              id="companio-speech-engine"
              value={settings.voice.recognitionEngine || 'auto'}
              onChange={event => onUpdateSettings({
                voice: {...settings.voice,recognitionEngine:event.target.value as 'auto' | 'windows' | 'whisper', recognitionEngineExplicit: true}
              })}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800"
            >
              <option value="auto">Automatic — bundled offline voice when available</option>
              <option value="windows">Windows dictation — no extra download</option>
              <option value="whisper">Local Whisper — optional offline mode</option>
            </select>
            {settings.voice.recognitionEngine === 'whisper' && (
              <div className="space-y-2 text-xs text-slate-600">
                <p>Whisper transcribes speech on your computer without an API key. The optional CPU engine and quantized English base model (~60 MB) use more disk space and CPU than Windows dictation, but can handle natural speech better on some microphones.</p>
                <div className="rounded-xl border border-sky-200 bg-sky-50/70 p-3 space-y-2">
                  <p className="text-xs font-semibold text-slate-800">Offline Whisper setup</p>
                  <p className="text-[11px] leading-relaxed text-slate-600">
                    Click to download the official Windows CPU engine for your processor and the English model. SHA-256 checks are required before either component is installed. Setup does not require administrator access.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" disabled={installingOfflineWhisper || choosingWhisper || downloadingWhisper || !isNativeDesktop() || Boolean(whisperStatus?.configured)}
                      onClick={() => void installOfflineWhisper()}
                      className="rounded-lg bg-sky-600 px-3 py-2 font-semibold text-white hover:bg-sky-700 disabled:opacity-50">
                      {whisperStatus?.configured ? 'Offline Whisper ready' : installingOfflineWhisper ? 'Setting up Whisper…' : 'Set up offline Whisper'}
                    </button>
                    {installingOfflineWhisper && (
                      <button type="button" onClick={() => void cancelOfflineWhisperSetup()}
                        className="rounded-lg border border-slate-300 bg-white px-3 py-2 font-semibold text-slate-700 hover:bg-slate-100">
                        Cancel setup
                      </button>
                    )}
                  </div>
                  {whisperSetupStage && <p role="status" aria-live="polite">{whisperSetupStage}</p>}
                  {installingOfflineWhisper && (
                    <div className="space-y-1" aria-label="Offline Whisper setup progress">
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
                        <div className="h-full bg-sky-600 transition-[width] duration-200"
                          style={{width:((whisperBinaryPercent ?? whisperDownloadPercent) ?? 0) + '%'}} />
                      </div>
                      <span className="text-[11px]">{whisperDownloadPercent !== null ? 'Model' : 'Engine'} download: {whisperDownloadPercent ?? whisperBinaryPercent ?? 0}%</span>
                    </div>
                  )}
                </div>
                <p className="font-semibold text-slate-600">Advanced: use your own whisper.cpp executable or model</p>
                <p>Official sources: <a href="https://github.com/ggml-org/whisper.cpp/releases" target="_blank" rel="noopener noreferrer" className="font-semibold text-sky-700 underline">whisper.cpp releases</a> and <a href="https://huggingface.co/ggerganov/whisper.cpp/tree/main" target="_blank" rel="noopener noreferrer" className="font-semibold text-sky-700 underline">GGML speech models</a>. Select a native Windows ARM64 CPU build on Snapdragon devices.</p>
                <div className="flex flex-wrap gap-2">
                  <button type="button" disabled={downloadingWhisper || installingOfflineWhisper || choosingWhisper || !isNativeDesktop() || Boolean(whisperStatus?.model)}
                    onClick={() => void downloadRecommendedSpeechModel()}
                    className="rounded-lg bg-sky-600 px-3 py-2 font-semibold text-white hover:bg-sky-700 disabled:opacity-50">
                    {whisperStatus?.model ? 'Speech model selected' : downloadingWhisper ? 'Downloading…' : 'Download English base model only (~60 MB)'}
                  </button>
                  {downloadingWhisper && (
                    <button type="button" onClick={() => void cancelRecommendedSpeechModel()}
                      className="rounded-lg border border-slate-200 bg-white px-3 py-2 font-semibold text-slate-700 hover:bg-slate-50">
                      Cancel download
                    </button>
                  )}
                  <button type="button" disabled={choosingWhisper || downloadingWhisper || installingOfflineWhisper || !isNativeDesktop()} onClick={() => void chooseWhisperFile('binary')}
                    className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 font-semibold text-sky-700 hover:bg-sky-100 disabled:opacity-50">
                    Choose whisper-cli.exe
                  </button>
                  <button type="button" disabled={choosingWhisper || downloadingWhisper || installingOfflineWhisper || !isNativeDesktop()} onClick={() => void chooseWhisperFile('model')}
                    className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 font-semibold text-sky-700 hover:bg-sky-100 disabled:opacity-50">
                    Choose speech model
                  </button>
                </div>
                {downloadingWhisper && (
                  <div role="status" className="space-y-1">
                    <div className="h-2 overflow-hidden rounded-full bg-slate-200">
                      <div className="h-full bg-sky-600 transition-[width] duration-200" style={{width:(whisperDownloadPercent || 0)+'%'}} />
                    </div>
                    <p>Downloading and verifying model — {whisperDownloadPercent ?? 0}%</p>
                  </div>
                )}
                <p role="status">{whisperStatus?.configured
                  ? 'Ready: ' + whisperStatus.model + ' — audio remains on this device.'
                  : (whisperStatus?.executable ? 'Executable: ' + whisperStatus.executable + '. ' : '') +
                    (whisperStatus?.model ? 'Model: ' + whisperStatus.model + '. ' : '') +
                    (whisperStatus?.message || 'Whisper setup not completed.')}</p>
                {whisperSetupError && <p role="alert" className="text-rose-700">{whisperSetupError}</p>}
                <p>Whisper does not provide a calibrated speech-confidence value here, so spoken commands always remain editable before Send, even with hands-free messages enabled.</p>
              </div>
            )}
          </div>

          {/* Speech recognition uses installed Windows language packs. */}
          <div className="space-y-2">
            <label htmlFor="companio-recognition-language" className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
              Recognition language
            </label>
            <select
              id="companio-recognition-language"
              value={settings.voice.recognitionLanguage || 'en-IN'}
              onChange={(event) => onUpdateSettings({
                voice: {
                  ...settings.voice,
                  recognitionLanguage: event.target.value as 'en-IN' | 'en-US' | 'en-GB' | 'en-AU'
                }
              })}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800"
            >
              <option value="en-IN">English (India)</option>
              <option value="en-US">English (United States)</option>
              <option value="en-GB">English (United Kingdom)</option>
              <option value="en-AU">English (Australia)</option>
            </select>
            <p className="text-xs leading-relaxed text-slate-500">
              Windows dictation needs an installed recognition language. Whisper is English-only in this version.
              If unavailable, Companio uses an installed English recognizer instead and reports the actual locale.
              Recognition quality still depends on Windows speech support and microphone clarity.
            </p>
          </div>

          {/* Push to Talk Info */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Push-to-Talk Activation
            </label>
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700">
              Press <span className="font-mono font-bold text-sky-700">{settings.activationShortcut}</span> to open the assistant.
              Click its microphone button to speak. Turn on auto-start above if you want the shortcut to start listening immediately.
            </div>
          </div>

          <p className="text-xs text-slate-500 leading-relaxed">
            Desktop dictation uses your chosen recognition engine for one request at a time.
            Its transcript is shown for correction before a command runs. Continuous wake-word detection is not available.
            Speech recognition in browser previews may depend on the browser's online speech service.
          </p>

          <div className="rounded-xl border border-sky-200 bg-sky-50/60 p-3.5 space-y-2">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold text-slate-800">Test Speech Recognition</p>
                <p className="text-[11px] text-slate-600">Shows actual transcript, locale and confidence where supported</p>
              </div>
              <button type="button" onClick={handleRecognitionTest}
                className="shrink-0 rounded-lg bg-sky-600 px-3 py-2 text-xs font-bold text-white hover:bg-sky-700">
                {testingRecognition ? 'Stop' : 'Try Dictation'}
              </button>
            </div>
            <p role="status" aria-live="polite" className="min-h-5 text-xs text-slate-700 break-words">
              {recognitionFeedback || 'Speak a simple command, such as “Open YouTube”. Nothing will run.'}
            </p>
            {recognitionAlternatives.length > 0 && (
              <div className="text-[11px] text-slate-600">
                <span className="font-semibold">Other possible matches: </span>
                {recognitionAlternatives.join(' · ')}
              </div>
            )}
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

            {micError && (
              <p role="alert" className="text-xs text-rose-700">{micError}</p>
            )}
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
              Companio adapts the base pitch and speaking pace to {settings.characterName}'s profile.
              Your voice settings fine-tune that profile.
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
