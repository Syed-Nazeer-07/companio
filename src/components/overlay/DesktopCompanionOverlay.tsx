import React, { useState, useLayoutEffect, useEffect, useRef, useCallback } from 'react';
import { AppSettings, CharacterReactionId, CharacterState, TaskPlan } from '../../types';
import { CharacterRenderer } from '../characters/CharacterRenderer';
import { SpeechBubble } from './SpeechBubble';
import { CompactInput } from './CompactInput';
import { ActionApprovalDialog } from './ActionApprovalDialog';
import { agentEngine } from '../../services/agentEngine';
import { speechService } from '../../services/speechService';
import { desktopBridge, isNativeDesktop } from '../../services/desktopBridge';
import { dbService } from '../../services/dbService';
import { requiresActionReview } from '../../services/actionApprovalPolicy';
import { deriveHistorySuggestions } from '../../services/commandSuggestions';
import { GripHorizontal, MessageSquare, Moon, Sun, X } from 'lucide-react';
import { parseCompanionCommand } from '../../services/companionCommands';
import { shouldAutoSubmitVoice, canonicalBasicVoiceCommand } from '../../services/voiceAutoSend';

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
  const [reactionId, setReactionId] = useState<CharacterReactionId>('idle');
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
  const [isDragging, setIsDragging] = useState(false);
  const [isCharHovered, setIsCharHovered] = useState(false);
  const [historySuggestions, setHistorySuggestions] = useState<string[]>([]);
  const [isHiddenDoc, setIsHiddenDoc] = useState<boolean>(
    () => typeof document !== 'undefined' && document.visibilityState === 'hidden'
  );

  const overlayRootRef = useRef<HTMLDivElement>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reactionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const petTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resetTimerRef = useRef<any>(null);
  const requestIdRef = useRef(0);

  // Native hit-test click-through & pointer drag refs
  const lastRectsSigRef = useRef<string>('');
  const draggingRef = useRef<boolean>(false);
  const pendingApprovalRef = useRef<boolean>(false);
  const suppressNextClickRef = useRef<boolean>(false);
  const dragSessionRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    started: boolean;
  } | null>(null);

  const shortcutActionsRef = useRef({
    toggle: () => {},
    dismiss: () => {},
    wake: () => {}
  });

  const isDark = settings.theme === 'dark';

  const refreshSuggestions = useCallback(() => {
    if (settings.overlay.showHistorySuggestions === false) {
      setHistorySuggestions([]);
      return;
    }
    setHistorySuggestions(deriveHistorySuggestions(dbService.getMessages(), 3));
  }, [settings.overlay.showHistorySuggestions]);

  useEffect(() => {
    refreshSuggestions();
  }, [refreshSuggestions, isInputOpen]);

  const reportInteractiveRects = useCallback(() => {
    if (!isNativeDesktop()) return;
    let rects: Array<{ x: number; y: number; width: number; height: number }> = [];
    if (pendingApprovalRef.current || draggingRef.current) {
      rects = [{
        x: 0,
        y: 0,
        width: Math.max(1, window.innerWidth),
        height: Math.max(1, window.innerHeight)
      }];
    } else if (overlayRootRef.current) {
      const nodes = overlayRootRef.current.querySelectorAll<HTMLElement>('[data-companio-interactive="true"]');
      rects = Array.from(nodes)
        .map((node) => {
          const r = node.getBoundingClientRect();
          return {
            x: Math.floor(r.left),
            y: Math.floor(r.top),
            width: Math.ceil(r.width),
            height: Math.ceil(r.height)
          };
        })
        .filter((r) => r.width > 0 && r.height > 0);
    }
    const sig = JSON.stringify(rects);
    if (sig !== lastRectsSigRef.current) {
      lastRectsSigRef.current = sig;
      void desktopBridge.setOverlayInteractiveRects(rects);
    }
  }, []);

  useEffect(() => {
    pendingApprovalRef.current = Boolean(pendingApproval);
    const raf = requestAnimationFrame(() => reportInteractiveRects());
    return () => cancelAnimationFrame(raf);
  }, [
    isInputOpen,
    bubbleText,
    activePlan,
    pendingApproval,
    isSleeping,
    isClosing,
    characterState,
    settings.overlay.scale,
    isCharHovered,
    isDragging,
    historySuggestions,
    reportInteractiveRects
  ]);

  useEffect(() => {
    if (!isNativeDesktop() || !overlayRootRef.current) return;
    const root = overlayRootRef.current;
    let rafId = 0;
    const schedule = () => {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => reportInteractiveRects());
    };
    schedule();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(schedule) : null;
    if (ro) ro.observe(root);
    const mo = typeof MutationObserver !== 'undefined' ? new MutationObserver(schedule) : null;
    if (mo) mo.observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-companio-interactive', 'style', 'class'] });
    window.addEventListener('resize', schedule);
    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      ro?.disconnect();
      mo?.disconnect();
      window.removeEventListener('resize', schedule);
    };
  }, [reportInteractiveRects]);

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

  const closeChatPanel = () => {
    setIsInputOpen(false);
    if (!isListeningVoice && !pendingApprovalRef.current) {
      setVoiceTranscript(null);
      setVoiceAlternatives([]);
      if (bubbleText && characterState === 'idle') {
        setBubbleText('');
      }
    }
  };

  const handleDismiss = () => {
    if (approvalResolverRef.current) {
      resolveApproval(false);
      return;
    }
    requestIdRef.current++;
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
    setReactionId('idle');
    setBubbleText('');
    setAudioLevel(0);
    if (isNativeDesktop()) void desktopBridge.setIgnoreMouseEvents(true);
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    if (!isNativeDesktop()) return;
    setIsClosing(true);
    hideTimerRef.current = setTimeout(() => {
      hideTimerRef.current = null;
      void desktopBridge.hideOverlay();
      setIsClosing(false);
    }, 170);
  };

  useLayoutEffect(() => {
    const unbindToggle = desktopBridge.onShortcutToggle(() => shortcutActionsRef.current.toggle());
    const unbindDismiss = desktopBridge.onShortcutDismiss?.(() => shortcutActionsRef.current.dismiss());
    const unbindWake = isNativeDesktop()
      ? desktopBridge.onShortcut(() => shortcutActionsRef.current.wake())
      : () => {};
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') shortcutActionsRef.current.dismiss();
    };
    const handleVisibilityChange = () => {
      setIsHiddenDoc(document.visibilityState === 'hidden');
    };
    window.addEventListener('keydown', handleKeyDown);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      unbindToggle();
      unbindWake();
      if (unbindDismiss) unbindDismiss();
      window.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
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
    refreshSuggestions();
    if (settings.overlay.soundEffects && !settings.voice.wakePhraseEnabled) speechService.playChime('activate');
    if (settings.voice.wakePhraseEnabled && !isListeningVoice) handleVoiceToggle(true);
  };

  const handleCharacterTouch = () => {
    if (suppressNextClickRef.current) {
      suppressNextClickRef.current = false;
      return;
    }
    if (isSleeping || !isInputOpen) {
      handleWakeAndActivate();
      return;
    }
    if (reactionTimerRef.current) clearTimeout(reactionTimerRef.current);
    setIsPetted(true);
    if (petTimerRef.current) clearTimeout(petTimerRef.current);
    petTimerRef.current = setTimeout(() => setIsPetted(false), 450);
    if (settings.overlay.soundEffects) speechService.playChime('activate');

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

  // Native pointer-driven overlay drag (works on character silhouette or move handle without DPI drift)
  const beginDragPointer = (e: React.PointerEvent<HTMLElement>, immediate = false) => {
    if (e.button !== 0 || pendingApprovalRef.current) return;
    dragSessionRef.current = {
      pointerId: e.pointerId,
      startX: e.screenX,
      startY: e.screenY,
      started: false
    };
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch {}
    if (immediate) {
      dragSessionRef.current.started = true;
      draggingRef.current = true;
      setIsDragging(true);
      reportInteractiveRects();
      void desktopBridge.startOverlayDrag();
    }
  };

  const moveDragPointer = (e: React.PointerEvent<HTMLElement>) => {
    const session = dragSessionRef.current;
    if (!session || session.pointerId !== e.pointerId) return;
    if (!session.started) {
      const dist = Math.hypot(e.screenX - session.startX, e.screenY - session.startY);
      if (dist < 5) return;
      session.started = true;
      suppressNextClickRef.current = true;
      draggingRef.current = true;
      setIsDragging(true);
      reportInteractiveRects();
      void desktopBridge.startOverlayDrag();
    } else {
      void desktopBridge.moveOverlayDrag();
    }
  };

  const endDragPointer = (e: React.PointerEvent<HTMLElement>) => {
    const session = dragSessionRef.current;
    if (!session || session.pointerId !== e.pointerId) return;
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch {}
    dragSessionRef.current = null;
    if (session.started) {
      draggingRef.current = false;
      setIsDragging(false);
      void desktopBridge.endOverlayDrag().finally(() => {
        reportInteractiveRects();
      });
    }
  };

  const handleMoveKeyDown = (e: React.KeyboardEvent<HTMLElement>) => {
    const map: Record<string, 'left' | 'right' | 'up' | 'down'> = {
      ArrowLeft: 'left',
      ArrowRight: 'right',
      ArrowUp: 'up',
      ArrowDown: 'down'
    };
    const dir = map[e.key];
    if (!dir) return;
    e.preventDefault();
    void desktopBridge.moveCompanion(dir);
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
          const confirmedBasic = canonicalBasicVoiceCommand(
            final, details?.confidence, settings.voice.autoSendSafeSpeech === true,
            details?.alternatives || []
          );
          if (confirmedBasic || (
            !details?.alternatives?.length &&
            shouldAutoSubmitVoice(final, details?.confidence, settings.voice.autoSendSafeSpeech === true)
          )) {
            setVoiceTranscript(null);
            void handleExecuteQuery(confirmedBasic || final);
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
    agentEngine.cancelActiveTask();
    if (approvalResolverRef.current) resolveApproval(false);
    speechService.stopSpeaking();
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

    dbService.addMessage({
      id: 'msg_' + crypto.randomUUID(),
      sender: 'user',
      content: query,
      timestamp: Date.now()
    });
    refreshSuggestions();

    try {
      const plan = await agentEngine.planTask(query, settings.ai);
      if (requestId !== requestIdRef.current) return;
      setActivePlan(plan);
      if (plan.reactionId) setReactionId(plan.reactionId);

      if (plan.steps.length === 0) {
        const reply = plan.finalMessage || 'Understood!';
        setBubbleText(reply);
        if (plan.clarificationNeeded) {
          setIsInputOpen(true);
        }
        const canSpeak = !settings.voice.muted && typeof window !== 'undefined' && 'speechSynthesis' in window;
        if (canSpeak) {
          setCharacterState('talking');
          speakReply(reply, 8000);
        } else {
          setCharacterState('idle');
          resetTimerRef.current = setTimeout(() => {
            setReactionId('idle');
            setBubbleText('');
          }, 10000);
        }
        dbService.addMessage({
          id: 'msg_' + crypto.randomUUID(),
          sender: 'companio',
          content: reply,
          timestamp: Date.now(),
          status: 'info'
        });
        return;
      }

      if (requiresActionReview(plan)) {
        const approved = await requestApproval(plan);
        if (requestId !== requestIdRef.current) return;
        if (!approved) {
          plan.status = 'cancelled';
          plan.steps.forEach((step) => { step.status = 'cancelled'; });
          setActivePlan({ ...plan });
          setCharacterState('idle');
          setReactionId('idle');
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

      const finalPlan = await agentEngine.executePlan(plan, (updated) => {
        if (requestId !== requestIdRef.current) return;
        setActivePlan({ ...updated });
        if (updated.status === 'executing') {
          const currentStep = updated.steps[updated.currentStepIndex];
          setBubbleText(currentStep ? currentStep.description : 'Executing...');
        }
      });

      if (finalPlan.status === 'cancelled') {
        dbService.addMessage({
          id: 'msg_' + crypto.randomUUID(),
          sender: 'companio',
          content: finalPlan.error || 'Task stopped.',
          timestamp: Date.now(),
          taskPlan: finalPlan,
          status: 'info'
        });
      }
      if (requestId !== requestIdRef.current) return;
      if (finalPlan.status === 'completed') {
        const sleepStep = finalPlan.steps.find(step => step.result?.companionState === 'sleeping');
        const wakeStep = finalPlan.steps.find(step => step.result?.companionState === 'idle');
        if (sleepStep) {
          setIsSleeping(true);
          setCharacterState('sleeping');
          setReactionId('idle');
        } else if (wakeStep) {
          setIsSleeping(false);
          setCharacterState('waking');
          setReactionId('happy');
        } else {
          const browserHandoffOnly = finalPlan.steps.length > 0 &&
            finalPlan.steps.every(step => step.result?.handoffOnly === true);
          setCharacterState(browserHandoffOnly ? 'idle' : 'success');
          setReactionId(finalPlan.reactionId || (browserHandoffOnly ? 'happy' : 'proud'));
          if (!browserHandoffOnly && settings.overlay.soundEffects) {
            speechService.playChime('success');
          }
        }

        const successMsg = finalPlan.finalMessage || 'Task completed.';
        setBubbleText(successMsg);
        speakReply(successMsg);

        dbService.addMessage({
          id: 'msg_' + crypto.randomUUID(),
          sender: 'companio',
          content: successMsg,
          timestamp: Date.now(),
          taskPlan: finalPlan,
          status: 'success'
        });
        refreshSuggestions();

        resetTimerRef.current = setTimeout(() => {
          setCharacterState(previous => previous === 'sleeping' ? previous : 'idle');
          setReactionId('idle');
          setActivePlan(null);
          setBubbleText('');
        }, 8000);
      } else if (finalPlan.status === 'cancelled') {
        setCharacterState('confused');
        setReactionId('confused');
        setBubbleText('Task cancelled.');
        speakReply('Task cancelled.');
        resetTimerRef.current = setTimeout(() => {
          setCharacterState(previous => previous === 'sleeping' ? previous : 'idle');
          setReactionId('idle');
          setActivePlan(null);
          setBubbleText('');
        }, 4000);
      } else {
        setCharacterState('confused');
        setReactionId('concerned');
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
          setReactionId('idle');
          setActivePlan(null);
          setBubbleText('');
        }, 10000);
      }
    } catch (err: unknown) {
      if (requestId !== requestIdRef.current) return;
      const message = err instanceof Error ? err.message : 'Could not process this request.';
      const text = 'Error: ' + message;
      setCharacterState('confused');
      setReactionId('concerned');
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
        setReactionId('idle');
        setActivePlan(null);
        setBubbleText('');
      }, 10000);
    }
  };

  const speakReply = (text: string, autoClearBubbleMs?: number) => {
    if (settings.voice.muted) return;
    speechService.speak(text, {
      voiceName: settings.voice.ttsVoice,
      rate: settings.voice.ttsRate,
      pitch: settings.voice.ttsPitch,
      volume: settings.voice.ttsVolume,
      characterId: settings.characterId,
      onStart: () => setCharacterState(previous => previous === 'sleeping' ? previous : 'talking'),
      onEnd: () => {
        setCharacterState(previous => previous === 'sleeping' ? previous : 'idle');
        if (typeof autoClearBubbleMs === 'number' && autoClearBubbleMs > 0) {
          clearTimeout(resetTimerRef.current);
          resetTimerRef.current = setTimeout(() => {
            setReactionId('idle');
            setBubbleText('');
          }, autoClearBubbleMs);
        }
      },
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
    setActivePlan(previous => previous
      ? {
          ...previous,
          status: 'cancelled',
          steps: previous.steps.map(step =>
            step.status === 'pending' || step.status === 'running' ? { ...step, status: 'cancelled' } : step
          )
        }
      : null
    );
    setCharacterState('idle');
    setReactionId('idle');
    setBubbleText('Stopped. Remaining steps will not run; an already-started Windows action may still finish.');
  };

  const handleToggleSleep = () => {
    clearTimeout(resetTimerRef.current);
    if (reactionTimerRef.current) clearTimeout(reactionTimerRef.current);
    if (isSleeping) {
      handleWakeAndActivate();
      return;
    }
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
    setReactionId('idle');
    setBubbleText('Resting. Tap me or press the shortcut to wake.');
  };

  shortcutActionsRef.current = {
    toggle: () => {
      if (approvalResolverRef.current || (isInputOpen && !isClosing)) handleDismiss();
      else handleWakeAndActivate();
    },
    dismiss: handleDismiss,
    wake: () => {
      if (approvalResolverRef.current) handleDismiss();
      else handleWakeAndActivate();
    }
  };

  const overlayScale = (isInputOpen && bubbleText)
    ? Math.min(settings.overlay.scale, 0.82)
    : (isInputOpen || bubbleText)
      ? Math.min(settings.overlay.scale, 0.96)
      : Math.min(settings.overlay.scale, 1.25);

  const sideBtnBase = isDark
    ? 'border-slate-700 bg-slate-900/95 text-slate-200 hover:bg-slate-800 shadow-[0_3px_10px_rgba(2,6,23,0.4)]'
    : 'border-slate-200/90 bg-white/95 text-slate-600 hover:bg-slate-100 shadow-[0_3px_10px_rgba(15,23,42,0.10)]';

  return (
    <div
      ref={overlayRootRef}
      className={`companio-overlay pointer-events-none relative w-full h-full flex flex-col items-center justify-end p-4 select-none overflow-hidden box-border ${
        isClosing ? 'companio-overlay--closing' : ''
      } ${isHiddenDoc || isSleeping ? 'companio-paused' : ''}`}
    >
      {/* Speech Bubble (self-tags pointer-events-auto & data-companio-interactive="true" only when visible) */}
      <SpeechBubble
        text={bubbleText}
        state={characterState}
        activePlan={activePlan}
        onCancel={handleCancelTask}
        onRetry={activePlan?.status === 'failed' && activePlan.retryable && activePlan.steps.length === 1
          ? () => { void handleExecuteQuery(activePlan.query); }
          : undefined}
        audioLevel={audioLevel}
        isDark={isDark}
      />

      {/* Compact Text/Voice Input (shown only while open; closing immediately frees desktop clicks behind it) */}
      {isInputOpen && (
        <div className="w-full max-w-[328px] mb-2.5 z-30 pointer-events-none">
          <CompactInput
            onSend={handleExecuteQuery}
            onVoiceToggle={() => handleVoiceToggle()}
            isListening={isListeningVoice}
            voiceTranscript={voiceTranscript}
            voiceAlternatives={voiceAlternatives}
            activationShortcut={settings.activationShortcut}
            onOpenDashboard={onOpenDashboard}
            onClose={closeChatPanel}
            suggestions={historySuggestions}
            isDark={isDark}
          />
        </div>
      )}

      {/* Compact Character Dock: only interactive controls capture pointer events */}
      <div
        onMouseEnter={() => setIsCharHovered(true)}
        onMouseLeave={() => setIsCharHovered(false)}
        className="group relative flex flex-col items-center justify-center pointer-events-none"
      >
        {/* Hover / focus move handle (does not clutter idle desktop or intercept clicks when hidden) */}
        <button
          type="button"
          tabIndex={0}
          aria-label="Drag to move Companio around your desktop"
          title="Drag or use arrow keys to reposition Companio"
          onPointerDown={(e) => beginDragPointer(e, true)}
          onPointerMove={moveDragPointer}
          onPointerUp={endDragPointer}
          onPointerCancel={endDragPointer}
          onKeyDown={handleMoveKeyDown}
          className={`mb-1 flex h-6 items-center justify-center gap-1 rounded-full border px-2.5 text-[10px] font-medium transition-opacity duration-150 select-none ${
            isDragging
              ? 'opacity-100 pointer-events-auto cursor-grabbing'
              : 'opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto focus-visible:opacity-100 focus-visible:pointer-events-auto cursor-grab'
          } ${
            isDark
              ? 'border-slate-700 bg-slate-900/95 text-slate-300'
              : 'border-slate-200 bg-white/95 text-slate-500 shadow-sm'
          }`}
          data-companio-interactive={isCharHovered || isDragging ? 'true' : undefined}
        >
          <GripHorizontal className="w-3 h-3 pointer-events-none" />
          <span className="pointer-events-none">Move</span>
        </button>

        {/* The Companion Character (direct drag >5px moves window; click toggles chat) */}
        <div
          data-companio-interactive="true"
          onPointerDown={(e) => beginDragPointer(e, false)}
          onPointerMove={moveDragPointer}
          onPointerUp={endDragPointer}
          onPointerCancel={endDragPointer}
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
          className={`companio-character pointer-events-auto relative focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-emerald-700 rounded-full ${
            isDragging ? 'cursor-grabbing' : 'cursor-pointer'
          } ${isPetted ? 'scale-[1.035]' : ''}`}
          data-state={isSleeping ? 'sleeping' : characterState}
          title={isSleeping ? 'Wake Companio (or drag to move)' : 'Click to talk · Drag to move'}
        >
          <CharacterRenderer
            characterId={settings.characterId}
            state={isSleeping ? 'sleeping' : characterState}
            reactionId={reactionId}
            scale={overlayScale}
            audioLevel={audioLevel}
          />
        </div>

        {/* Single unified Sleep / Wake control */}
        <button
          type="button"
          data-companio-interactive="true"
          onClick={handleToggleSleep}
          aria-label={isSleeping ? 'Wake Companio' : 'Put Companio to sleep'}
          title={isSleeping ? 'Wake Companio' : 'Sleep mode'}
          className={`pointer-events-auto absolute -left-8 bottom-7 z-20 flex h-8 w-8 items-center justify-center rounded-full border transition-colors focus-visible:ring-2 focus-visible:ring-emerald-700 ${sideBtnBase}`}
        >
          {isSleeping ? <Sun className="h-3.5 w-3.5 text-amber-500" /> : <Moon className="h-3.5 w-3.5" />}
        </button>

        {/* Single Chat open / close toggle */}
        <button
          type="button"
          data-companio-interactive="true"
          onClick={() => {
            if (isSleeping || !isInputOpen) handleWakeAndActivate();
            else closeChatPanel();
          }}
          aria-label={isInputOpen ? 'Close command bar' : 'Ask Companio'}
          title={isInputOpen ? 'Close command bar' : `Ask Companio (${settings.activationShortcut})`}
          className={`pointer-events-auto absolute -right-8 bottom-7 z-20 flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border transition-colors focus-visible:ring-2 focus-visible:ring-emerald-700 ${
            isDark
              ? 'border-emerald-800 bg-slate-900/95 text-emerald-400 hover:bg-slate-800 shadow-[0_3px_10px_rgba(2,6,23,0.4)]'
              : 'border-emerald-200 bg-white/95 text-emerald-700 hover:bg-emerald-50 shadow-[0_3px_10px_rgba(15,23,42,0.10)]'
          }`}
        >
          {isInputOpen ? (
            <X className="w-3.5 h-3.5 stroke-[2.25]" />
          ) : (
            <MessageSquare className="w-3.5 h-3.5" />
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
