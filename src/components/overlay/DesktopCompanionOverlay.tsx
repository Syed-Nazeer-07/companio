import React, { useState, useLayoutEffect, useRef } from 'react';
import { AppSettings, CharacterState, TaskPlan } from '../../types';
import { CharacterRenderer } from '../characters/CharacterRenderer';
import { SpeechBubble } from './SpeechBubble';
import { CompactInput } from './CompactInput';
import { ActionApprovalDialog } from './ActionApprovalDialog';
import { agentEngine } from '../../services/agentEngine';
import { speechService } from '../../services/speechService';
import { desktopBridge, isNativeDesktop } from '../../services/desktopBridge';
import { dbService } from '../../services/dbService';
import { requiresActionReview } from '../../services/actionApprovalPolicy';
import { GripHorizontal, MessageSquare, Moon, Sun, X } from 'lucide-react';
import { parseCompanionCommand } from '../../services/companionCommands';
import { shouldAutoSubmitVoice, shouldAutoRunBasicVoiceCommand } from '../../services/voiceAutoSend';

interface Props {
  settings: AppSettings;
  onOpenDashboard: () => void;
  onUpdateSettings: (newSettings: Partial<AppSettings>) => void;
}

export const DesktopCompanionOverlay: React.FC<Props> = ({
  settings,
  onOpenDashboard,
  onUpdateSettings
}) => {
  const [characterState, setCharacterState] = useState<CharacterState>('idle');
  const [bubbleText, setBubbleText] = useState<string>('');
  const [activePlan, setActivePlan] = useState<TaskPlan | null>(null);
  const [pendingApproval, setPendingApproval] = useState<TaskPlan | null>(null);
  const approvalResolverRef = useRef<((approved: boolean) => void) | null>(null);
  const [isInputOpen, setIsInputOpen] = useState<boolean>(false);
  const [isListeningVoice, setIsListeningVoice] = useState<boolean>(false);
  const [voiceTranscript, setVoiceTranscript] = useState<string | null>(null);
  const [voiceAlternatives, setVoiceAlternatives] = useState<string[]>([]);
  const [audioLevel, setAudioLevel] = useState<number>(0);
  const [isSleeping, setIsSleeping] = useState<boolean>(false);
  const [isPetted, setIsPetted] = useState<boolean>(false);
  const [isClosing, setIsClosing] = useState(false);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reactionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const petTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestIdRef = useRef(0);

  const resetTimerRef = useRef<any>(null);
  // Keep native shortcut handlers registered once. Ref callbacks always use the
  // latest component state, without dropping key events during React re-renders.
  const shortcutActionsRef = useRef({
    toggle: () => {},
    dismiss: () => {},
    wake: () => {}
  });

  const resolveApproval = (approved: boolean) => {
    const resolver = approvalResolverRef.current;
    approvalResolverRef.current = null;
    setPendingApproval(null);
    resolver?.(approved);
  };

  const requestApproval = (plan: TaskPlan): Promise<boolean> => {
    if (approvalResolverRef.current) return Promise.resolve(false);
    return new Promise<boolean>((resolve) => {
      approvalResolverRef.current = resolve;
      setPendingApproval(plan);
    });
  };

  const cancelPendingHide = () => {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
    setIsClosing(false);
  };

  const handleDismiss = () => {
    if (approvalResolverRef.current) {
      resolveApproval(false);
      return;
    }
    requestIdRef.current++;
    // Hiding the companion must also stop follow-up steps and suppress any
    // stale result from an action which Windows has already started.
    agentEngine.cancelActiveTask();
    clearTimeout(resetTimerRef.current);
    if (reactionTimerRef.current) clearTimeout(reactionTimerRef.current);
    if (petTimerRef.current) clearTimeout(petTimerRef.current);
    setIsPetted(false);
    speechService.stopListening();
    speechService.stopSpeaking();
    setIsListeningVoice(false);
    setIsInputOpen(false);
    setVoiceTranscript(null);
    setVoiceAlternatives([]);
    setCharacterState(isSleeping ? 'sleeping' : 'idle');
    setBubbleText('');
    setAudioLevel(0);
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    if (!isNativeDesktop()) return;
    setIsClosing(true);
    // Animate within the frameless window, then hide the real Electron
    // window. Reopening during the exit animation cancels this timer.
    hideTimerRef.current = setTimeout(() => {
      hideTimerRef.current = null;
      void desktopBridge.hideOverlay();
      setIsClosing(false);
    }, 170);
  };

  // Bind only once: a global key must not get lost during state transitions.
  useLayoutEffect(() => {
    const unbindToggle = desktopBridge.onShortcutToggle(() => shortcutActionsRef.current.toggle());
    const unbindDismiss = desktopBridge.onShortcutDismiss?.(() => shortcutActionsRef.current.dismiss());
    const unbindWake = isNativeDesktop()
      ? desktopBridge.onShortcut(() => shortcutActionsRef.current.wake())
      : () => {};
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') shortcutActionsRef.current.dismiss();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      unbindToggle();
      unbindWake();
      if (unbindDismiss) unbindDismiss();
      window.removeEventListener('keydown', handleKeyDown);
      clearTimeout(resetTimerRef.current);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
      if (reactionTimerRef.current) clearTimeout(reactionTimerRef.current);
      if (petTimerRef.current) clearTimeout(petTimerRef.current);
      if (approvalResolverRef.current) {
        approvalResolverRef.current(false);
        approvalResolverRef.current = null;
      }
      speechService.stopListening();
      speechService.stopSpeaking();
    };
  }, []);

  const handleWakeAndActivate = () => {
    cancelPendingHide();
    clearTimeout(resetTimerRef.current);
    const wasSleeping = isSleeping;
    if (wasSleeping) setIsSleeping(false);
    setCharacterState(wasSleeping ? 'waking' : 'idle');
    if (wasSleeping) {
      if (reactionTimerRef.current) clearTimeout(reactionTimerRef.current);
      reactionTimerRef.current = setTimeout(() => {
        setCharacterState(previous => previous === 'waking' ? 'idle' : previous);
      }, 520);
    }
    setActivePlan(null);
    setBubbleText(wasSleeping ? "I'm awake. What shall we do?" : 'What can I help with?');
    setIsInputOpen(true);
    // Auto-start voice already plays its own single activation cue.
    if (settings.overlay.soundEffects && !settings.voice.wakePhraseEnabled) speechService.playChime('activate');
    if (settings.voice.wakePhraseEnabled && !isListeningVoice) handleVoiceToggle(true);
  };

  // Click to open the input. A second click while open gives a gentle
  // character reaction, without spraying particles across the desktop.
  const handleCharacterTouch = () => {
    if (isSleeping || !isInputOpen) {
      handleWakeAndActivate();
      return;
    }
    if (reactionTimerRef.current) clearTimeout(reactionTimerRef.current);
    setIsPetted(true);
    if (petTimerRef.current) clearTimeout(petTimerRef.current);
    petTimerRef.current = setTimeout(() => setIsPetted(false), 450);
    if (settings.overlay.soundEffects) speechService.playChime('activate');

    // Character-specific playful dialog reactions
    const dialogues: Record<string, string[]> = {
      sparky: ['Systems ready.', 'Ready when you are.', 'What shall we work on?'],
      pixel: ['Ready for the next level.', 'Nice to see you.', 'What is our next move?'],
      mochi: ['That tickles!', 'Hello again!', 'A little break is nice.'],
      cloudie: ['Floating along.', 'A calm moment.', 'Here whenever you need me.'],
      kiko: ['Purr… hello.', 'A friendly little nudge.', 'All ears.'],
      boba: ['A little boba break?', 'Glad you are here.', 'What is the plan?']
    };
    const pool = dialogues[settings.characterId] || ['Hello again.', 'Ready to help.'];
    const reaction = pool[Math.floor(Math.random() * pool.length)];
    setBubbleText(reaction);
    setCharacterState('talking');
    reactionTimerRef.current = setTimeout(() => {
      setCharacterState(previous => previous === 'sleeping' ? previous : 'idle');
      setIsPetted(false);
    }, 1800);
  };

  const handleVoiceToggle = (allowFromSleeping = false) => {
    if (isSleeping && !allowFromSleeping) {
      setBubbleText('Wake me first to use the microphone.');
      return;
    }
    if (isListeningVoice) {
      speechService.stopListening();
      setIsListeningVoice(false);
      setCharacterState('idle');
      setAudioLevel(0);
      setBubbleText('Listening paused.');
    } else {
      setVoiceTranscript(null);
      setVoiceAlternatives([]);
      speechService.stopSpeaking();
      setIsListeningVoice(true);
      // ONLY set state to 'listening' when mic is actively turned on!
      setCharacterState('listening');
      setBubbleText('Listening to your voice... Speak now!');
      speechService.startListening(
        (interim) => {
          setBubbleText(interim);
        },
        (final, details) => {
          setIsListeningVoice(false);
          setAudioLevel(0);
          setCharacterState('idle');
          // Only precise named apps, local screenshots, conversation and
          // reversible companion commands can auto-send. Unfamiliar or risky
          // automation still shows an editable transcript for confirmation.
          if (!details?.alternatives?.length && (
            shouldAutoRunBasicVoiceCommand(final, details?.confidence, settings.voice.autoSendSafeSpeech === true)
            || shouldAutoSubmitVoice(final, details?.confidence, settings.voice.autoSendSafeSpeech === true)
          )) {
            setVoiceTranscript(null);
            void handleExecuteQuery(final);
            return;
          }
          setVoiceTranscript(final);
          setVoiceAlternatives(details?.alternatives?.slice(0, 3) || []);
          setIsInputOpen(true);
          const source = details?.language ? ' (' + details.language + ')' : '';
          const uncertain = typeof details?.confidence === 'number' && details.confidence < 0.65
            ? ' Low recognition confidence; please correct any mistakes.'
            : '';
          setBubbleText('Heard' + source + ': "' + final + '". Review or choose another match below, then Send.' + uncertain);
        },
        (err) => {
          setIsListeningVoice(false);
          setAudioLevel(0);
          setCharacterState('idle');
          setIsInputOpen(true);
          setBubbleText(err);
        },
        (lvl) => {
          setAudioLevel(lvl);
        },
        () => {
          setIsListeningVoice(false);
          setAudioLevel(0);
          setCharacterState('idle');
          setBubbleText('No speech recognized. Test your mic in Control Center → Voice Settings, and try offline Whisper for better accuracy.');
        },
        settings.voice.recognitionLanguage || 'en-IN',
        settings.overlay.soundEffects,
        settings.voice.recognitionEngine === 'whisper' ? 'whisper' : settings.voice.recognitionEngine === 'windows' ? 'windows' : 'auto'
      );
    }
  };

  const handleExecuteQuery = async (query: string) => {
    // Only one automation may be active in this overlay at a time.
    agentEngine.cancelActiveTask();
    setVoiceTranscript(null);
    setVoiceAlternatives([]);
    clearTimeout(resetTimerRef.current);
    const companion = parseCompanionCommand(query);
    if (companion) {
      if (companion.kind === 'hide') { handleDismiss(); return; }
      if (companion.kind === 'sleep') { handleToggleSleep(); return; }
      if (companion.kind === 'wake' || companion.kind === 'open') { handleWakeAndActivate(); return; }
      if (companion.kind === 'move') {
        const result = await desktopBridge.moveCompanion(companion.direction);
        setActivePlan(null);
        setCharacterState(result.success ? 'idle' : 'confused');
        setBubbleText(result.success ? (result.message || 'Moved Companio.') : (result.error || 'Could not move the companion.'));
      }
      return;
    }
    const requestId = ++requestIdRef.current;
    setActivePlan(null);
    setCharacterState('thinking');
    setBubbleText('Working on your request…');
    setIsInputOpen(false);

    // Record user message in DB
    dbService.addMessage({
      id: 'msg_' + crypto.randomUUID(),
      sender: 'user',
      content: query,
      timestamp: Date.now()
    });

    try {
      // 1. Plan task
      const plan = await agentEngine.planTask(query, settings.ai);
      if (requestId !== requestIdRef.current) return;
      setActivePlan(plan);

      // If purely conversational
      if (plan.steps.length === 0) {
        setCharacterState('talking');
        const reply = plan.finalMessage || 'Understood!';
        setBubbleText(reply);
        speakReply(reply);
        dbService.addMessage({
          id: 'msg_' + crypto.randomUUID(),
          sender: 'companio',
          content: reply,
          timestamp: Date.now(),
          status: 'info'
        });
        return;
      }

      // Routine, explicitly requested single app/site launches need no second
      // click. Multiple actions and model-suggested nontrivial actions still
      // require review, even after native allowlist validation.
      if (requiresActionReview(plan)) {
        const approved = await requestApproval(plan);
        if (requestId !== requestIdRef.current) return;
        if (!approved) {
          plan.status = 'cancelled';
          plan.steps.forEach((step) => { step.status = 'cancelled'; });
          setActivePlan({ ...plan });
          setCharacterState('idle');
          setBubbleText('Action plan cancelled. Nothing was executed.');
          dbService.addMessage({
            id: 'msg_' + crypto.randomUUID(),
            sender: 'companio',
            content: 'Action plan cancelled by user; no actions executed.',
            timestamp: Date.now(),
            taskPlan: plan,
            status: 'info'
          });
          return;
        }
      }

      // 2. Execute plan
      const finalPlan = await agentEngine.executePlan(plan, (updated) => {
        if (requestId !== requestIdRef.current) return;
        setActivePlan({ ...updated });
        if (updated.status === 'executing') {
          const currentStep = updated.steps[updated.currentStepIndex];
          setBubbleText(currentStep ? currentStep.description : 'Executing...');
        }
      });

      if (requestId !== requestIdRef.current) return;
      if (finalPlan.status === 'completed') {
        const browserHandoffOnly = finalPlan.steps.length > 0 &&
          finalPlan.steps.every(step => step.result?.handoffOnly === true);
        setCharacterState(browserHandoffOnly ? 'idle' : 'success');
        if (!browserHandoffOnly) {
          if (settings.overlay.soundEffects) speechService.playChime('success');
        }

        const successMsg = finalPlan.finalMessage || 'Task completed.';
        setBubbleText(successMsg);
        speakReply(successMsg);

        // Record assistant response in DB
        dbService.addMessage({
          id: 'msg_' + crypto.randomUUID(),
          sender: 'companio',
          content: successMsg,
          timestamp: Date.now(),
          taskPlan: finalPlan,
          status: 'success'
        });

        // Revert to idle after celebration
        resetTimerRef.current = setTimeout(() => {
          setCharacterState(previous => previous === 'sleeping' ? previous : 'idle');
          setActivePlan(null);
          setBubbleText('');
        }, 8000);
      } else if (finalPlan.status === 'cancelled') {
        setCharacterState('confused');
        setBubbleText('Task cancelled.');
        speakReply('Task cancelled.');
        resetTimerRef.current = setTimeout(() => {
          setCharacterState(previous => previous === 'sleeping' ? previous : 'idle');
          setActivePlan(null);
          setBubbleText('');
        }, 4000);
      } else {
        setCharacterState('confused');
        if (settings.overlay.soundEffects) speechService.playChime('error');
        const errorMsg = finalPlan.error || 'Execution encountered an issue.';
        setBubbleText(errorMsg);
        speakReply(errorMsg);

        dbService.addMessage({
          id: 'msg_' + crypto.randomUUID(),
          sender: 'companio',
          content: errorMsg,
          timestamp: Date.now(),
          taskPlan: finalPlan,
          status: 'error'
        });

        resetTimerRef.current = setTimeout(() => {
          setCharacterState(previous => previous === 'sleeping' ? previous : 'idle');
          setActivePlan(null);
          setBubbleText('');
        }, 10000);
      }
    } catch (err: unknown) {
      if (requestId !== requestIdRef.current) return;
      const message = err instanceof Error ? err.message : 'Could not process this request.';
      const text = 'Error: ' + message;
      setCharacterState('confused');
      setBubbleText(text);
      speakReply(text);
      dbService.addMessage({
        id: 'msg_' + crypto.randomUUID(),
        sender: 'companio',
        content: text,
        timestamp: Date.now(),
        status: 'error'
      });
      resetTimerRef.current = setTimeout(() => {
        setCharacterState(previous => previous === 'sleeping' ? previous : 'idle');
        setActivePlan(null);
        setBubbleText('');
      }, 10000);
    }
  };

  const speakReply = (text: string) => {
    if (settings.voice.muted) return;
    speechService.speak(text, {
      voiceName: settings.voice.ttsVoice,
      rate: settings.voice.ttsRate,
      pitch: settings.voice.ttsPitch,
      volume: settings.voice.ttsVolume,
      characterId: settings.characterId, // Passes character profile for matching voice!
      onStart: () => setCharacterState(previous => previous === 'sleeping' ? previous : 'talking'),
      onEnd: () => setCharacterState(previous => previous === 'sleeping' ? previous : 'idle'),
      onAudioLevel: (lvl) => setAudioLevel(lvl)
    });
  };

  const handleCancelTask = () => {
    if (approvalResolverRef.current) {
      resolveApproval(false);
      return;
    }
    requestIdRef.current++;
    agentEngine.cancelActiveTask();
    speechService.stopSpeaking();
    setActivePlan(previous => previous ? { ...previous, status: 'cancelled' } : null);
    setCharacterState('idle');
    setBubbleText('Stopped. Remaining steps will not run; an already-started Windows action may still finish.');
  };

  const handleToggleSleep = () => {
    clearTimeout(resetTimerRef.current);
    if (reactionTimerRef.current) clearTimeout(reactionTimerRef.current);
    if (isSleeping) {
      handleWakeAndActivate();
      return;
    }
    // Sleep is explicit: microphone and spoken replies stop immediately.
    // It does not register a background wake-word listener.
    speechService.stopListening();
    speechService.stopSpeaking();
    requestIdRef.current++;
    agentEngine.cancelActiveTask();
    if (approvalResolverRef.current) resolveApproval(false);
    setIsListeningVoice(false);
    setAudioLevel(0);
    setActivePlan(null);
    setVoiceTranscript(null);
    setVoiceAlternatives([]);
    setIsInputOpen(false);
    setIsSleeping(true);
    setCharacterState('sleeping');
    setBubbleText('Resting. Tap me or press the shortcut to wake.');
  };

  shortcutActionsRef.current = {
    toggle: () => { if (approvalResolverRef.current || (isInputOpen && !isClosing)) handleDismiss(); else handleWakeAndActivate(); },
    dismiss: handleDismiss,
    wake: () => { if (approvalResolverRef.current) handleDismiss(); else handleWakeAndActivate(); }
  };

  return (
    <div className={`companio-overlay relative w-full h-full flex flex-col items-center justify-end p-4 select-none overflow-hidden box-border ${isClosing ? 'companio-overlay--closing' : ''}`}>
      {/* Speech Bubble */}
      <SpeechBubble
        text={bubbleText}
        state={characterState}
        activePlan={activePlan}
        onCancel={handleCancelTask}
        audioLevel={audioLevel}
      />

      {/* Compact Text/Voice Input */}
      {isInputOpen && (
        <div className="w-full max-w-[328px] mb-3 z-30">
          <CompactInput
            onSend={handleExecuteQuery}
            onVoiceToggle={() => handleVoiceToggle()}
            isListening={isListeningVoice}
            voiceTranscript={voiceTranscript}
            voiceAlternatives={voiceAlternatives}
            activationShortcut={settings.activationShortcut}
            onOpenDashboard={onOpenDashboard}
            isSleeping={isSleeping}
            onToggleSleep={handleToggleSleep}
            onClose={handleDismiss}
          />
        </div>
      )}

      {/* Persistent drag handle: never hide it on hover, and keep it in
          normal document flow so the pointer cannot fall through a gap. */}
      <div className="relative flex flex-col items-center justify-center">
        <div
          className="app-drag-region mb-2 flex h-8 min-w-[125px] items-center justify-center gap-1.5 rounded-full border border-slate-200 bg-white/95 px-3 text-[11px] font-semibold text-slate-600 shadow-[0_3px_12px_rgba(15,23,42,0.09)] cursor-grab select-none"
          title="Hold and drag to move Companio"
          aria-label="Drag to move Companio around your desktop"
        >
          <GripHorizontal className="w-3.5 h-3.5 pointer-events-none" />
          <span className="pointer-events-none">Move Companio</span>
        </div>
        {/* The Companion Character */}
        <div
          onClick={handleCharacterTouch}
          onKeyDown={event => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              handleCharacterTouch();
            }
          }}
          role="button"
          tabIndex={0}
          aria-label={isSleeping ? 'Wake Companio' : 'Open Companio command bar'}
          key={settings.characterId}
          className={`companio-character relative cursor-pointer app-no-drag focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-sky-500 rounded-full ${
            isPetted ? 'scale-[1.035]' : ''
          }`}
          data-state={isSleeping ? 'sleeping' : characterState}
          title={isSleeping ? 'Wake Companio' : 'Click to talk to Companio'}
        >
          <CharacterRenderer
            characterId={settings.characterId}
            state={isSleeping ? 'sleeping' : characterState}
            scale={settings.overlay.scale}
            audioLevel={audioLevel}
          />


        </div>

        {/* Sleep control remains visible even when the command input is closed. */}
        {!isInputOpen && <button type="button" onClick={handleToggleSleep}
          aria-label={isSleeping ? 'Wake Companio' : 'Put Companio to sleep'}
          title={isSleeping ? 'Wake Companio' : 'Sleep mode'}
          className="app-no-drag absolute -left-9 bottom-8 z-20 flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white/95 text-slate-500 shadow-[0_4px_14px_rgba(15,23,42,0.12)] transition-colors hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-sky-400">
          {isSleeping ? <Sun className="h-4 w-4 text-amber-500" /> : <Moon className="h-4 w-4" />}
        </button>}
        {/* Visible Floating Circle Action Button on the Right Side */}
        <button
          type="button"
          onClick={() => {
            if (isSleeping || !isInputOpen) handleWakeAndActivate();
            else setIsInputOpen(false);
          }}
          title={isInputOpen ? "Close command bar" : `Ask Companio (${settings.activationShortcut})`}
          className="app-no-drag absolute -right-9 bottom-8 z-20 flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-sky-200 bg-white/95 text-sky-600 shadow-[0_4px_14px_rgba(15,23,42,0.12)] transition-colors hover:bg-sky-50 focus-visible:ring-2 focus-visible:ring-sky-400"
        >
          {isInputOpen ? (
            <X className="w-4 h-4 stroke-[2.5]" />
          ) : (
            <MessageSquare className="w-4 h-4" />
          )}
        </button>
      </div>
      {pendingApproval && (
        <ActionApprovalDialog
          plan={pendingApproval}
          onApprove={() => resolveApproval(true)}
          onCancel={() => resolveApproval(false)}
        />
      )}
    </div>
  );
};
