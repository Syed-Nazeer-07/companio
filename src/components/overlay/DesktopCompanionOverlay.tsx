import React, { useState, useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';
import { AppSettings, CharacterState, TaskPlan } from '../../types';
import { CharacterRenderer } from '../characters/CharacterRenderer';
import { SpeechBubble } from './SpeechBubble';
import { CompactInput } from './CompactInput';
import { agentEngine } from '../../services/agentEngine';
import { speechService } from '../../services/speechService';
import { desktopBridge } from '../../services/desktopBridge';
import { dbService } from '../../services/dbService';
import { GripHorizontal } from 'lucide-react';

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
  const [bubbleText, setBubbleText] = useState<string>('Hello! Click me or press Ctrl+Shift+Space ✨');
  const [activePlan, setActivePlan] = useState<TaskPlan | null>(null);
  const [isInputOpen, setIsInputOpen] = useState<boolean>(false);
  const [isListeningVoice, setIsListeningVoice] = useState<boolean>(false);
  const [audioLevel, setAudioLevel] = useState<number>(0);
  const [isSleeping, setIsSleeping] = useState<boolean>(false);

  const resetTimerRef = useRef<any>(null);

  const handleDismiss = () => {
    setIsInputOpen(false);
    setCharacterState('idle');
    setBubbleText('');
    setAudioLevel(0);
    if (isListeningVoice) {
      speechService.stopListening();
      setIsListeningVoice(false);
    }
  };

  // Global hotkey toggle listener: press once to open/wake, press again to dismiss/close!
  useEffect(() => {
    const unbind = desktopBridge.onShortcutToggle(() => {
      if (isInputOpen || bubbleText) {
        handleDismiss();
      } else {
        handleWakeAndActivate();
      }
    });

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleDismiss();
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      unbind();
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isInputOpen, bubbleText, isListeningVoice, isSleeping]);

  const handleWakeAndActivate = () => {
    if (isSleeping) setIsSleeping(false);
    setCharacterState('listening');
    setBubbleText("I'm listening! What can I do for you?");
    setIsInputOpen(true);
    speechService.playChime('activate');

    if (settings.voice.wakePhraseEnabled) {
      handleVoiceToggle();
    }
  };

  const handleCharacterClick = () => {
    if (isSleeping) {
      setIsSleeping(false);
      setCharacterState('idle');
      setBubbleText("I'm awake and ready!");
      speechService.playChime('activate');
      return;
    }
    const nextInputState = !isInputOpen;
    setIsInputOpen(nextInputState);
    if (nextInputState) {
      setCharacterState('listening');
      setBubbleText("What can I do for you?");
    } else {
      handleDismiss();
    }
  };

  const handleVoiceToggle = () => {
    if (isListeningVoice) {
      speechService.stopListening();
      setIsListeningVoice(false);
      setCharacterState('idle');
      setAudioLevel(0);
    } else {
      setIsListeningVoice(true);
      setCharacterState('listening');
      setBubbleText('Listening to your voice...');
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
      id: 'msg_' + Date.now(),
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
        return;
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
          id: 'msg_' + Date.now(),
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
          id: 'msg_' + Date.now(),
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
    } catch (err: any) {
      setCharacterState('confused');
      setBubbleText(`Error: ${err.message}`);
      speakReply(`Error: ${err.message}`);
    }
  };

  const speakReply = (text: string) => {
    if (settings.voice.muted) return;
    speechService.speak(text, {
      voiceName: settings.voice.ttsVoice,
      rate: settings.voice.ttsRate,
      pitch: settings.voice.ttsPitch,
      volume: settings.voice.ttsVolume,
      onStart: () => setCharacterState('talking'),
      onEnd: () => setCharacterState('idle'),
      onAudioLevel: (lvl) => setAudioLevel(lvl)
    });
  };

  const handleCancelTask = () => {
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
    } else {
      setIsSleeping(false);
      setCharacterState('idle');
      setBubbleText("I'm awake and ready!");
    }
  };

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-end p-4 select-none overflow-hidden">
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
        <div className="w-full max-w-[340px] mb-3">
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

      {/* Floating Interactive Character */}
      <div 
        onClick={handleCharacterClick}
        className="relative group cursor-pointer transition-transform duration-200 active:scale-95 app-no-drag"
        title="Click to interact with Companio"
      >
        <CharacterRenderer
          characterId={settings.characterId}
          state={isSleeping ? 'sleeping' : characterState}
          scale={settings.overlay.scale}
          audioLevel={audioLevel}
        />

        {/* Subtle Drag Handle on Hover */}
        <div 
          className="absolute -top-2 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-white/95 backdrop-blur px-2.5 py-0.5 rounded-full border border-slate-200 shadow-sm flex items-center gap-1 text-[10px] text-slate-600 font-medium app-drag-region"
          title="Drag to reposition character"
        >
          <GripHorizontal className="w-3 h-3 text-slate-400" />
          <span>Move</span>
        </div>
      </div>
    </div>
  );
};
