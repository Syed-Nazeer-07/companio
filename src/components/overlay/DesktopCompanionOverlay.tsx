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
  const [bubbleText, setBubbleText] = useState<string>(`Hello! Click me or press ${settings.activationShortcut} ✨`);
  const [activePlan, setActivePlan] = useState<TaskPlan | null>(null);
  const [pendingApproval, setPendingApproval] = useState<TaskPlan | null>(null);
  const approvalResolverRef = useRef<((approved: boolean) => void) | null>(null);
  const [isInputOpen, setIsInputOpen] = useState<boolean>(false);
  const [isListeningVoice, setIsListeningVoice] = useState<boolean>(false);
  const [voiceTranscript, setVoiceTranscript] = useState<string | null>(null);
  const [audioLevel, setAudioLevel] = useState<number>(0);
  const [isSleeping, setIsSleeping] = useState<boolean>(false);
  const [isPetted, setIsPetted] = useState<boolean>(false);
  const [isClosing, setIsClosing] = useState(false);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reactionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    clearTimeout(resetTimerRef.current);
    if (reactionTimerRef.current) clearTimeout(reactionTimerRef.current);
    speechService.stopListening();
    speechService.stopSpeaking();
    setIsListeningVoice(false);
    setIsInputOpen(false);
    setVoiceTranscript(null);
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
      if (reactionTimerRef.current) if (reactionTimerRef.current) clearTimeout(reactionTimerRef.current);
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
    setActivePlan(null);
    setBubbleText(wasSleeping ? "I'm awake. What shall we do?" : 'What can I help with?');
    setIsInputOpen(true);
    if (settings.overlay.soundEffects) speechService.playChime('activate');
    if (settings.voice.wakePhraseEnabled && !isListeningVoice) handleVoiceToggle();
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
    reactionTimerRef.current = setTimeout(() => setIsPetted(false), 450);
    if (settings.overlay.soundEffects) speechService.playChime('activate');

    // Character-specific playful dialog reactions
    const dialogues: Record<string, string[]> = {
      sparky: [
        "Beep boop! Systems at 100%! 🤖",
        "Charging up! Ready to automate ✨",
        "Power level over 9000! ⚡",
        "Boop! At your service! 🚀"
      ],
      pixel: [
        "1-UP! Ready for the next quest! 🦊",
        "Press Start to continue! 🎮",
        "Pixel power activated! 🌟",
        "High score unlocked! 🏆"
      ],
      mochi: [
        "Squish! Hehe, that tickles! 🥰",
        "Bouncing with joy! 💖",
        "So soft and happy to see you! 🌸",
        "Yay! Best friends forever! ✨"
      ],
      cloudie: [
        "Floaty and relaxed! Sending soft starry vibes~ ☁️✨",
        "Warm rainbow sparkles for you! 🌈",
        "Floating along happily~ 💫",
        "Dream big today! 🌟"
      ],
      kiko: [
        "Purrrr~ boop received! 🐾💖",
        "Meow! You're my favorite human! 🐱✨",
        "Happy kitten paws! 🥰",
        "Nya~ ready to help you! 🌸"
      ],
      boba: [
        "Sweet as boba tea! 🧋",
        "Bubbly and smiling! What's our plan? 🐻",
        "Tapioca pearl high five! ✨",
        "Cozy bear hugs for you! 🍯"
      ]
    };

    const pool = dialogues[settings.characterId] || [
      "Hehe, that tickles! 🥰",
      "Boop! Ready for action! ✨",
      "Always here for you! 💖"
    ];
    const reaction = pool[Math.floor(Math.random() * pool.length)];
    setBubbleText(reaction);
    setCharacterState('talking');
    reactionTimerRef.current = setTimeout(() => {
      setCharacterState(previous => previous === 'sleeping' ? previous : 'idle');
      setIsPetted(false);
    }, 1800);
  };

  const handleVoiceToggle = () => {
    if (isSleeping) {
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
          // Never silently execute a possibly misheard native transcript.
          setVoiceTranscript(final);
          setIsInputOpen(true);
          const source = details?.language ? ' (' + details.language + ')' : '';
          const uncertain = typeof details?.confidence === 'number' && details.confidence < 0.65
            ? ' Low recognition confidence; please correct any mistakes.'
            : '';
          setBubbleText('Heard' + source + ': "' + final + '". Review and press Send.' + uncertain);
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
          setBubbleText('No speech detected. Check microphone and speech language, then retry.');
        },
        settings.voice.recognitionLanguage || 'en-IN'
      );
    }
  };

  const handleExecuteQuery = async (query: string) => {
    setVoiceTranscript(null);
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
        setActivePlan({ ...updated });
        if (updated.status === 'executing') {
          const currentStep = updated.steps[updated.currentStepIndex];
          setBubbleText(currentStep ? currentStep.description : 'Executing...');
        }
      });

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
          setCharacterState('idle');
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
          setCharacterState('idle');
          setBubbleText('');
        }, 10000);
      }
    } catch (err: unknown) {
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
        setCharacterState('idle');
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
    agentEngine.cancelActiveTask();
    speechService.stopSpeaking();
    setCharacterState('confused');
    setBubbleText('Aborting active task...');
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
    agentEngine.cancelActiveTask();
    if (approvalResolverRef.current) resolveApproval(false);
    setIsListeningVoice(false);
    setAudioLevel(0);
    setActivePlan(null);
    setVoiceTranscript(null);
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
            onVoiceToggle={handleVoiceToggle}
            isListening={isListeningVoice}
            voiceTranscript={voiceTranscript}
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
          className={`companio-character relative cursor-pointer app-no-drag ${
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
        <button type="button" onClick={handleToggleSleep}
          aria-label={isSleeping ? 'Wake Companio' : 'Put Companio to sleep'}
          title={isSleeping ? 'Wake Companio' : 'Sleep mode'}
          className="app-no-drag absolute -left-9 bottom-8 z-20 flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white/95 text-slate-500 shadow-[0_4px_14px_rgba(15,23,42,0.12)] transition-colors hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-sky-400">
          {isSleeping ? <Sun className="h-4 w-4 text-amber-500" /> : <Moon className="h-4 w-4" />}
        </button>
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
