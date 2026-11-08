import React, { useState, useLayoutEffect, useRef } from 'react';
import confetti from 'canvas-confetti';
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
import { GripHorizontal, MessageSquare, Mic, X } from 'lucide-react';

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
  const [audioLevel, setAudioLevel] = useState<number>(0);
  const [isSleeping, setIsSleeping] = useState<boolean>(false);
  const [isPetted, setIsPetted] = useState<boolean>(false);

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

  const handleDismiss = () => {
    if (approvalResolverRef.current) {
      resolveApproval(false);
      return;
    }
    setIsInputOpen(false);
    setCharacterState('idle');
    setBubbleText('');
    setAudioLevel(0);
    if (isListeningVoice) {
      speechService.stopListening();
      setIsListeningVoice(false);
    }
    // Fully hide the overlay window so it doesn't linger on screen
    desktopBridge.hideOverlay();
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
      if (approvalResolverRef.current) {
        approvalResolverRef.current(false);
        approvalResolverRef.current = null;
      }
      speechService.stopListening();
      speechService.stopSpeaking();
    };
  }, []);

  const handleWakeAndActivate = () => {
    if (isSleeping) setIsSleeping(false);
    // Keep character state idle or talking, NOT listening (mic is off by default)
    setCharacterState('idle');
    setBubbleText("Hi! What can I help you with today? ✨");
    setIsInputOpen(true);
    speechService.playChime('activate');

    if (settings.voice.wakePhraseEnabled && !isListeningVoice) {
      handleVoiceToggle();
    }
  };

  // Playful Touch & Pet Interaction
  const handleCharacterTouch = () => {
    if (isSleeping) {
      setIsSleeping(false);
      setCharacterState('idle');
      setBubbleText("I'm awake and ready! ✨");
      speechService.playChime('activate');
      return;
    }

    // Trigger bounce animation & sparkle confetti
    setIsPetted(true);
    setTimeout(() => setIsPetted(false), 500);

    speechService.playChime('activate');
    confetti({
      particleCount: 18,
      spread: 50,
      origin: { y: 0.8 },
      colors: ['#0ea5e9', '#ec4899', '#f59e0b', '#10b981']
    });

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
    setTimeout(() => setCharacterState('idle'), 2500);
  };

  const handleVoiceToggle = () => {
    if (isListeningVoice) {
      speechService.stopListening();
      setIsListeningVoice(false);
      setCharacterState('idle');
      setAudioLevel(0);
      setBubbleText('Listening paused.');
    } else {
      setIsListeningVoice(true);
      // ONLY set state to 'listening' when mic is actively turned on!
      setCharacterState('listening');
      setBubbleText('Listening to your voice... Speak now!');
      speechService.startListening(
        (interim) => {
          setBubbleText(interim);
        },
        (final) => {
          setIsListeningVoice(false);
          setAudioLevel(0);
          handleExecuteQuery(final);
        },
        (err) => {
          setIsListeningVoice(false);
          setAudioLevel(0);
          setCharacterState('idle');
          setBubbleText(err);
        },
        (lvl) => {
          setAudioLevel(lvl);
        },
        () => {
          setIsListeningVoice(false);
          setAudioLevel(0);
          setCharacterState('idle');
          setBubbleText('No speech detected. Try again or type your request.');
        }
      );
    }
  };

  const handleExecuteQuery = async (query: string) => {
    clearTimeout(resetTimerRef.current);
    setCharacterState('thinking');
    setBubbleText(`On it! Planning: "${query}" ✨`);
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
        setCharacterState('success');
        speechService.playChime('success');
        confetti({
          particleCount: 35,
          spread: 60,
          origin: { y: 0.85 }
        });

        const successMsg = finalPlan.finalMessage || 'Done! Verified successfully ✨';
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
          setCharacterState('idle');
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
        speechService.playChime('error');
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
      onStart: () => setCharacterState('talking'),
      onEnd: () => setCharacterState('idle'),
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
    if (!isSleeping) {
      setIsSleeping(true);
      setCharacterState('sleeping');
      setBubbleText('Zzz...');
      setIsInputOpen(false);
      speechService.stopListening();
      setIsListeningVoice(false);
      setAudioLevel(0);
    } else {
      setIsSleeping(false);
      setCharacterState('idle');
      setBubbleText("I'm awake and ready!");
    }
  };

  shortcutActionsRef.current = {
    toggle: () => { if (approvalResolverRef.current || isInputOpen) handleDismiss(); else handleWakeAndActivate(); },
    dismiss: handleDismiss,
    wake: () => { if (approvalResolverRef.current) handleDismiss(); else handleWakeAndActivate(); }
  };

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-end p-4 select-none overflow-hidden box-border">
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
            onOpenDashboard={onOpenDashboard}
            isSleeping={isSleeping}
            onToggleSleep={handleToggleSleep}
            onClose={handleDismiss}
          />
        </div>
      )}

      {/* Floating Interactive Character Area */}
      <div className="relative flex items-center justify-center">
        {/* The Companion Character */}
        <div 
          onClick={handleCharacterTouch}
          className={`relative group cursor-pointer transition-all duration-300 app-no-drag ${
            isPetted ? 'scale-110 -rotate-3' : 'hover:scale-105'
          }`}
          title="Click to interact with Companio!"
        >
          <CharacterRenderer
            characterId={settings.characterId}
            state={isSleeping ? 'sleeping' : characterState}
            scale={settings.overlay.scale}
            audioLevel={audioLevel}
          />

          {/* Drag Handle on Hover */}
          <div 
            className="absolute -top-3 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-white/95 backdrop-blur px-2.5 py-0.5 rounded-full border border-slate-200 shadow-sm flex items-center gap-1 text-[10px] text-slate-600 font-medium app-drag-region cursor-grab"
            title="Drag to reposition character"
          >
            <GripHorizontal className="w-3 h-3 text-slate-400" />
            <span>Move</span>
          </div>
        </div>

        {/* Visible Floating Circle Action Button on the Right Side */}
        <button
          type="button"
          onClick={() => {
            const next = !isInputOpen;
            setIsInputOpen(next);
            if (next) {
              setCharacterState('idle');
              setBubbleText("What can I do for you?");
            }
          }}
          title={isInputOpen ? "Close command bar" : `Ask Companio (${settings.activationShortcut})`}
          className="absolute -right-4 bottom-8 w-9 h-9 rounded-full bg-white hover:bg-sky-50 text-sky-600 shadow-[0_8px_20px_rgba(14,165,233,0.35)] border border-sky-200 flex items-center justify-center transition-all hover:scale-115 active:scale-95 app-no-drag z-20 cursor-pointer"
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
