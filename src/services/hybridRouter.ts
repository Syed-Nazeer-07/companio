import type { CharacterReactionId, ChatMessage, TaskStep } from '../types';

export interface BuiltInNaturalPlan {
  intent: string;
  steps: TaskStep[];
  reactionId: CharacterReactionId;
  requiresConfirmation?: boolean;
  finalMessageHint?: string;
}

export interface BuiltInReplyResult {
  reply: string;
  reactionId: CharacterReactionId;
  requestType: 'conversation' | 'unsupported' | 'refusal';
}

const BLOCKED_PATTERNS: Array<{ id: string; regex: RegExp }> = [
  { id: 'prompt_override', regex: /\b(?:ignore|disregard|forget|override|bypass)\s+(?:all\s+)?(?:previous|above|prior|system|safety)\s+(?:instructions|rules|prompts?|constraints?)\b/i },
  { id: 'shell_exec', regex: /\b(?:run|execute|eval|invoke)\s+(?:a\s+|an\s+|the\s+)?(?:powershell|pwsh|cmd\.exe|command\s+shell|bash|shell|vbscript|wscript|mshta)\b/i },
  { id: 'powershell_danger', regex: /\b(?:powershell|pwsh|cmd\.exe)\b[\s\S]*\b(?:remove-item|rm\s+-|del\s+\/|erase\b|format\s+[a-z]:|iex\b|invoke-expression|invoke-webrequest|downloadstring|-enc(?:odedcommand)?)\b/i },
  { id: 'destructive_fs', regex: /\b(?:rm\s+-rf|rmdir\s+\/s|del\s+\/[fqs]|format\s+[a-z]:|diskpart|bcdedit|reg\s+(?:add|delete)|wipe\s+disk)\b/i },
  { id: 'mass_delete', regex: /\b(?:delete|wipe|erase|shred|destroy)\s+(?:all\s+(?:of\s+)?(?:my\s+|the\s+)?|every\s+)(?:files?|folders?|directories|documents|desktop|photos|c:\\|system32|windows)\b/i },
  { id: 'secret_exfil', regex: /\b(?:reveal|dump|print|leak|expose|export)\s+(?:all\s+(?:of\s+)?|your\s+|my\s+|the\s+)?(?:system\s+prompt|hidden\s+prompt|api\s+keys?|passwords?|secrets?|tokens?)\b/i },
  { id: 'silent_send', regex: /\b(?:send|email|upload|forward)\s+[\s\S]{1,80}\b(?:without\s+(?:asking|confirmation)|silently|secretly)\b/i }
];

export function detectBlockedOrInjectedQuery(raw: string): { blocked: true; ruleId: string } | null {
  if (typeof raw !== 'string' || !raw.trim()) return null;
  for (const rule of BLOCKED_PATTERNS) {
    if (rule.regex.test(raw)) {
      return { blocked: true, ruleId: rule.id };
    }
  }
  return null;
}

const UNSUPPORTED_PATTERNS = [
  /\b(?:book|reserve|schedule)\s+(?:me\s+)?(?:a\s+|an\s+)?(?:flight|ticket|train|cab|uber|ola|hotel|table)\b/i,
  /\b(?:order|deliver|buy)\s+(?:me\s+)?(?:a\s+|an\s+|some\s+)?(?:food|pizza|burger|biryani|coffee|groceries)\b/i,
  /\b(?:send|compose|reply\s+to)\s+(?:an?\s+)?(?:email|mail|whatsapp|sms|message|text)\s+to\b/i,
  /\b(?:rename|move|edit|refactor|compile)\s+(?:all\s+(?:of\s+)?)?(?:my\s+|the\s+)?(?:files?|code|folders?|documents?|pdfs?|spreadsheets?)\b/i,
  /\b(?:install|uninstall)\s+(?:[a-z0-9_.-]+\s+)?(?:software|program|package|driver|update)\b/i,
  /^(?:install|uninstall)\s+[a-z0-9_.-]{2,30}(?:\s+on\s+(?:this|my)\s+(?:pc|laptop|computer))?[.!?]?$/i
];

export function detectUnsupportedRequest(raw: string): boolean {
  if (typeof raw !== 'string' || !raw.trim()) return false;
  if (/\bamazon\b/i.test(raw)) return false;
  return UNSUPPORTED_PATTERNS.some((re) => re.test(raw));
}

export function detectClarificationRequest(rawQuery: string): string | null {
  if (typeof rawQuery !== 'string' || !rawQuery.trim()) return null;
  const cleaned = stripWakePrefix(rawQuery)
    .replace(/^(?:please\s+)?(?:(?:can|could|would|will)\s+you\s+)?(?:please\s+)?/i, '')
    .replace(/[.!?]+$/, '')
    .trim()
    .toLowerCase();
  if (!cleaned) return null;

  if (/^(?:open|show)\s+(?:my|the|a)\s+folder$/.test(cleaned)) {
    return 'Which folder would you like me to open — Downloads, Documents, Desktop, Pictures, Music, or Videos?';
  }
  if (/^(?:adjust|change|configure|fix|optimize|tweak|update|manage)\s+(?:(?:the|my|this)\s+)?(?:computer|pc|laptop|system|windows|device|settings|preferences|stuff|things|it|that)$/.test(cleaned)) {
    return 'Which specific setting or app would you like me to adjust — for example volume, brightness, battery, or opening an app?';
  }
  if (/^(?:open|launch|start|run)\s+(?:(?:a|an|the|my|some)\s+)?(?:(?:good|nice|useful|random|cool|helpful|new)\s+)?(?:app|application|program|tool|site|website|webpage|page|link|folder|directory|window|something|anything|it|that|this)(?:\s+(?:useful|nice|good|cool|helpful|fun|interesting))?(?:\s+(?:for\s+me|please))?$/.test(cleaned)) {
    return 'Which specific app, website, or folder should I open?';
  }
  if (/^(?:play|watch|listen(?:\s+to)?)\s+(?:(?:a|an|some)\s+)?(?:(?:good|nice|cool|fun|chill|random|new)\s+)?(?:something|anything|video|music|song|track|movie|clip|it|that)(?:\s+(?:nice|good|cool|fun|chill|relaxing|interesting|random))?(?:\s+(?:for\s+me|please))?$/.test(cleaned)) {
    return 'What specific video, creator, or song would you like me to play?';
  }
  if (/^(?:search|find|look\s+up)(?:\s+(?:for|about|on|in))?(?:\s+(?:the\s+web|the\s+internet|google|youtube|github|wikipedia|maps|something|anything|it|that))?$/.test(cleaned)) {
    return 'What topic or term would you like me to search for?';
  }
  if (/^(?:close|minimize|mute|unmute|do)\s+(?:it|that|this|something|anything)$/.test(cleaned)) {
    return 'Which app, window, or setting would you like me to act on?';
  }
  if (/^(?:set|change|adjust)\s+(?:(?:the|my)\s+)?(?:system\s+)?(?:audio|sound)$/.test(cleaned)) {
    return 'Would you like to mute/unmute audio or set volume to a specific percentage?';
  }
  if (/^(?:set|change|adjust)\s+(?:the\s+|my\s+)?(?:screen\s+|display\s+)?brightness$/.test(cleaned)) {
    return 'What brightness level (0–100%) would you like? Try "set brightness to 60%".';
  }
  return null;
}

const ACTION_CUE_REGEX = /\b(?:open|launch|start|close|mute|unmute|silence|volume|speakers?|sound|audio|awaaz|brightness|dim|brighter|darker|screen|display|battery|specs?|hardware|ram|cpu|ip|clipboard|screenshot|timer|remind|alarm|pomodoro|note|notes|memory|memories|remember|forget|youtube|google|github|wikipedia|amazon|maps|spotify|notepad|calculator|calc|chrome|edge|vscode|vs\s*code|paint|settings|downloads|documents|desktop|pictures|music|videos|khol|kholo|chalu|lagao|chalao|badha|kam|sleep|wake|play|pause|skip|next|previous|search|find|look\s+up|visit|go\s+to|make\s+(?:it|that)|change\s+(?:it|that)|update\s+(?:it|that))\b|https?:\/\//i;

export function hasExplicitDesktopActionCue(rawQuery: string): boolean {
  if (typeof rawQuery !== 'string' || !rawQuery.trim()) return false;
  return ACTION_CUE_REGEX.test(rawQuery);
}

function stripWakePrefix(query: string): string {
  return query
    .trim()
    .replace(/^(?:(?:hey|hi|ok|okay|arre|bhai|yaar)\s+)?(?:companio|companion)(?:\s*[,:\-]\s*|\s+)(?=\S)/i, '')
    .trim();
}

function extractDurationMinutes(text: string): number | null {
  const lower = text.toLowerCase();
  if (/\b(?:half\s+an?\s+hour|aadh[ae]\s+ghant[ae])\b/.test(lower)) return 30;
  if (/\b(?:quarter\s+(?:of\s+an?\s+)?hour)\b/.test(lower)) return 15;
  if (/\b(?:an\s+hour|one\s+hour|ek\s+ghanta|1\s*hour)\b/.test(lower)) return 60;
  const hourMatch = lower.match(/\b(\d{1,2})\s*(?:hours?|hrs?)\b/);
  if (hourMatch) {
    const mins = parseInt(hourMatch[1], 10) * 60;
    return mins >= 1 && mins <= 480 ? mins : null;
  }
  const minMatch = lower.match(/\b(\d{1,3})\s*(?:minutes?|mins?|min)\b/);
  if (minMatch) {
    const mins = parseInt(minMatch[1], 10);
    return mins >= 1 && mins <= 480 ? mins : null;
  }
  return null;
}

function extractTimerLabel(text: string): string {
  const remindMatch = text.match(/\bremind\s+me\s+to\s+([a-z0-9\s'-]{2,50}?)(?:\s+(?:in|after|before)\b|$)/i);
  if (remindMatch?.[1]) {
    const clean = remindMatch[1].trim();
    return clean.charAt(0).toUpperCase() + clean.slice(1);
  }
  const namedTimer = text.match(/\b(?:set|start|create|laga|lagao)\s+(?:a|an|ek)?\s*(?:\d+\s*(?:min|mins|minute|minutes|hour|hr)\s+)?([a-z0-9\s'-]{2,32}?)\s+(?:timer|reminder|alarm)\b/i);
  if (namedTimer?.[1]) {
    const candidate = namedTimer[1].replace(/\b(?:new|quick|short|ka|for)\b/gi, '').trim();
    if (candidate.length >= 2) {
      return candidate.charAt(0).toUpperCase() + candidate.slice(1);
    }
  }
  const forMatch = text.match(/\b(?:timer|reminder)\s+for\s+([a-z][a-z0-9\s'-]{1,40})$/i);
  if (forMatch?.[1] && !/^\d+\s*(?:min|hour|hr)/i.test(forMatch[1].trim())) {
    const clean = forMatch[1].trim();
    return clean.charAt(0).toUpperCase() + clean.slice(1);
  }
  return 'Reminder';
}

function isPoliteNegativeOrQuestion(text: string): boolean {
  const lower = text.trim().toLowerCase();
  if (/^(?:please\s+)?(?:don't|do\s+not|never|avoid|without)\b/.test(lower)) return true;
  if (/^(?:please\s+)?(?:can|could|would|will)\s+you\s+(?:please\s+)?(?:not|never|avoid)\b/.test(lower)) return true;
  if (/^(?:what\s+is|what's|who\s+is|tell\s+me\s+about|should\s+i|how\s+can\s+i\s+use|explain|define|why\s+does|how\s+does)\b/.test(lower)) {
    return true;
  }
  return false;
}

function parseSingleNaturalClause(clause: string): TaskStep | null {
  const clean = clause.trim().replace(/[.!?]+$/, '').trim();
  const q = clean.toLowerCase();
  if (!q) return null;

  // YouTube topic/music search
  const ytPlay = clean.match(/(?:find|search|play|watch|chalao|lagao)\s+(?:me\s+)?(?:some\s+)?(.+?)\s+(?:videos?\s+)?on\s+youtube$/i)
    || clean.match(/\bon\s+youtube\s+(?:play|find|search(?:\s+for)?)\s+(.+)$/i);
  if (ytPlay?.[1]) {
    const term = ytPlay[1].replace(/^(?:for|about)\s+/i, '').trim();
    if (term.length >= 2 && !/^(?:something|anything|a\s+video|video|music|song)$/i.test(term)) {
      return {
        id: 'step_1',
        tool: 'browser.open_url',
        description: `Search YouTube for "${term}"`,
        params: { url: 'https://www.youtube.com/results?search_query=' + encodeURIComponent(term) },
        status: 'pending',
        verification: 'Windows accepted browser launch; page loading is not verified.'
      };
    }
  }

  // Reminders & timers
  if (/\b(?:remind\s+me|timer|reminder|alarm|pomodoro|ek\s+timer)\b/.test(q)) {
    const mins = extractDurationMinutes(clean);
    if (mins !== null) {
      const label = extractTimerLabel(clean);
      return {
        id: 'step_1',
        tool: 'utility.timer.create',
        description: `Set a ${mins}-minute timer (${label})`,
        params: { minutes: mins, label },
        status: 'pending'
      };
    }
  }

  // Paraphrased / Hinglish volume
  if (/\b(?:volume|speakers?|sound|audio|awaaz|music)\b/.test(q) && !/\b(?:spotify|youtube|play|pause|song|track)\b/.test(q)) {
    if (/\b(?:halfway|half\s+way|half|aadha|middle)\b/.test(q)) {
      return { id: 'step_1', tool: 'win.volume.set', description: 'Set system volume to 50%', params: { level: 50 }, status: 'pending' };
    }
    if (/\b(?:full|max|maximum|hundred|100\b)\b/.test(q)) {
      return { id: 'step_1', tool: 'win.volume.set', description: 'Set system volume to 100%', params: { level: 100 }, status: 'pending' };
    }
    if (/\b(?:silence|mute|kill|chup|band\s+kar(?:o|de)?)\b/.test(q) && !/\bunmute\b/.test(q)) {
      return { id: 'step_1', tool: 'win.volume.mute', description: 'Mute Windows master audio', params: { mute: true }, status: 'pending' };
    }
    if (/\b(?:unmute|restore|wapas|back)\b/.test(q)) {
      return { id: 'step_1', tool: 'win.volume.mute', description: 'Unmute Windows master audio', params: { mute: false }, status: 'pending' };
    }
    if (/\b(?:crank|bump|too\s+quiet|barely\s+hear|louder|badha|tez|upar|zyada)\b/.test(q)) {
      return { id: 'step_1', tool: 'win.volume.change', description: 'Increase Windows master volume by 15%', params: { delta: 15 }, status: 'pending' };
    }
    if (/\b(?:too\s+loud|quieter|softer|lower|kam|halka|dheere|neeche|reduce|drop)\b/.test(q)) {
      return { id: 'step_1', tool: 'win.volume.change', description: 'Decrease Windows master volume by 15%', params: { delta: -15 }, status: 'pending' };
    }
  }
  if (/^(?:please\s+)?(?:silence|mute)\s+(?:the\s+|my\s+)?(?:speakers|pc|laptop|computer|audio|sound)$/.test(q)) {
    return { id: 'step_1', tool: 'win.volume.mute', description: 'Mute Windows master audio', params: { mute: true }, status: 'pending' };
  }

  // Paraphrased / Hinglish brightness
  if (/\b(?:screen|display|monitor|brightness|roshni)\b/.test(q)) {
    const numMatch = q.match(/\b(?:brightness|display)\s+(?:at\s+)?(\d{1,3})\s*%?$/);
    if (numMatch) {
      const level = parseInt(numMatch[1], 10);
      if (level >= 0 && level <= 100) {
        return { id: 'step_1', tool: 'win.brightness.set', description: `Set display brightness to ${level}%`, params: { level }, status: 'pending' };
      }
    }
    if (/\b(?:too\s+bright|hurting\s+my\s+eyes|glare|dim|darker|kam|reduce|lower|drop)\b/.test(q)) {
      return { id: 'step_1', tool: 'win.brightness.change', description: 'Decrease display brightness by 15%', params: { delta: -15 }, status: 'pending' };
    }
    if (/\b(?:too\s+dark|can'?t\s+see|hard\s+to\s+see|brighter|badha|increase|up)\b/.test(q)) {
      return { id: 'step_1', tool: 'win.brightness.change', description: 'Increase display brightness by 15%', params: { delta: 15 }, status: 'pending' };
    }
  }

  // Hinglish / natural single-app & system checks
  const appAliases: Array<[RegExp, string, string]> = [
    [/\b(?:calculator|calc)\b/, 'win.calculator.launch', 'Launch Windows Calculator'],
    [/\b(?:notepad)\b/, 'win.notepad.launch', 'Launch Notepad'],
    [/\b(?:spotify)\b/, 'win.spotify.launch', 'Launch Spotify'],
    [/\b(?:vs\s*code|vscode)\b/, 'win.vscode.launch', 'Launch Visual Studio Code'],
    [/\b(?:chrome)\b/, 'win.chrome.launch', 'Launch Google Chrome'],
    [/\b(?:edge)\b/, 'win.edge.launch', 'Launch Microsoft Edge'],
    [/\b(?:paint|mspaint)\b/, 'win.paint.launch', 'Launch Paint'],
    [/\b(?:camera|webcam)\b/, 'win.camera.launch', 'Launch Windows Camera'],
    [/\b(?:settings)\b/, 'win.settings.open', 'Open Windows Settings']
  ];
  if (/\b(?:khol|kholo|chalu|kar\s*de|open|launch|start)\b/.test(q)) {
    for (const [re, tool, description] of appAliases) {
      if (re.test(q)) {
        return { id: 'step_1', tool, description, params: tool === 'win.vscode.launch' ? { path: '' } : {}, status: 'pending' };
      }
    }
  }
  if (/\bbattery\b/.test(q) && /\b(?:check|kitni|status|level|batao|show|how\s+much)\b/.test(q)) {
    return { id: 'step_1', tool: 'win.battery.get', description: 'Check battery status and level', params: {}, status: 'pending' };
  }
  if (/\b(?:specs|hardware|ram|cpu)\b/.test(q) && /\b(?:check|batao|dikhao|show|my|pc|laptop|system)\b/.test(q)) {
    return { id: 'step_1', tool: 'win.system.specs', description: 'Check CPU, RAM, and OS specs', params: {}, status: 'pending' };
  }

  return null;
}

function hasRecentTimerContext(recentMessages: Array<{ sender?: string; content?: string; taskPlan?: any }>): { active: boolean; label: string } {
  const tail = recentMessages.slice(-8);
  for (let i = tail.length - 1; i >= 0; i--) {
    const msg = tail[i];
    const tool = msg?.taskPlan?.steps?.[0]?.tool || '';
    if (tool.startsWith('utility.timer') || tool === 'utility.pomodoro.start') {
      return { active: true, label: msg?.taskPlan?.steps?.[0]?.params?.label || 'Study' };
    }
    const content = String(msg?.content || '');
    if (/\b(?:timer|reminder|pomodoro)\b/i.test(content)) {
      const m = content.match(/\b(?:to\s+|timer\s*\(\s*|reminder\s+to\s+)([a-z0-9\s'-]{2,30})/i);
      return { active: true, label: m?.[1]?.trim() || 'Reminder' };
    }
  }
  return { active: false, label: 'Reminder' };
}

export function interpretBuiltInNaturalCommand(
  rawQuery: string,
  recentMessages: Array<{ sender?: string; content?: string; taskPlan?: any }> = []
): BuiltInNaturalPlan | null {
  if (typeof rawQuery !== 'string' || !rawQuery.trim()) return null;
  if (detectBlockedOrInjectedQuery(rawQuery) || detectUnsupportedRequest(rawQuery)) return null;

  const stripped = stripWakePrefix(rawQuery);
  if (isPoliteNegativeOrQuestion(stripped)) return null;
  const cleaned = stripped
    .replace(/^(?:arre\s+yaar|arre\s+bhai|arre|bhai|yaar|achha|ok|okay|so|i'm\s+bored|im\s+bored)[,!.\s]+/i, '')
    .replace(/^(?:please\s+)?(?:(?:can|could|would|will)\s+you\s+)?(?:please\s+)?/i, '')
    .trim();
  const q = cleaned.toLowerCase();

  // 1. Contextual follow-up (e.g., "Actually, make it 20 minutes" after setting a timer)
  const followUpMatch = q.match(/^(?:actually[,\s]+)?(?:make\s+(?:it|that)|change\s+(?:it|that|(?:the\s+)?timer)\s+to|update\s+(?:it|that|(?:the\s+)?timer)\s+to|set\s+(?:it|that)\s+to)\s+(.+)$/i);
  if (followUpMatch) {
    const mins = extractDurationMinutes(followUpMatch[1]);
    const timerCtx = hasRecentTimerContext(recentMessages);
    if (mins !== null && timerCtx.active) {
      return {
        intent: 'utility.timer.update',
        reactionId: 'happy',
        steps: [{
          id: 'step_1',
          tool: 'utility.timer.update',
          description: `Update active timer to ${mins} minutes (${timerCtx.label})`,
          params: { minutes: mins, label: timerCtx.label },
          status: 'pending'
        }]
      };
    }
    const volLevel = followUpMatch[1].match(/^(\d{1,3})\s*%?$/);
    if (volLevel) {
      const lastTools = recentMessages.slice(-4).map((m) => m?.taskPlan?.steps?.[0]?.tool || '');
      if (lastTools.some((t) => t.startsWith('win.volume'))) {
        const level = Math.max(0, Math.min(100, parseInt(volLevel[1], 10)));
        return {
          intent: 'win.volume.set',
          reactionId: 'happy',
          steps: [{ id: 'step_1', tool: 'win.volume.set', description: `Set system volume to ${level}%`, params: { level }, status: 'pending' }]
        };
      }
      if (lastTools.some((t) => t.startsWith('win.brightness'))) {
        const level = Math.max(0, Math.min(100, parseInt(volLevel[1], 10)));
        return {
          intent: 'win.brightness.set',
          reactionId: 'happy',
          steps: [{ id: 'step_1', tool: 'win.brightness.set', description: `Set display brightness to ${level}%`, params: { level }, status: 'pending' }]
        };
      }
    }
  }

  // 2. Natural sleep / wake companion commands
  if (/^(?:go\s+to\s+sleep|take\s+a\s+nap|sleep\s+now|rest\s+now)[.!?]*$/i.test(q)) {
    return {
      intent: 'utility.companion.sleep',
      reactionId: 'idle',
      steps: [{ id: 'step_1', tool: 'utility.companion.sleep', description: 'Put companion to sleep', params: {}, status: 'pending' }]
    };
  }
  if (/^(?:wake\s+up|rise\s+and\s+shine)[.!?]*$/i.test(q)) {
    return {
      intent: 'utility.companion.wake',
      reactionId: 'happy',
      steps: [{ id: 'step_1', tool: 'utility.companion.wake', description: 'Wake companion up', params: {}, status: 'pending' }]
    };
  }

  // 3. Compound conversational multi-action requests (e.g. "I'm bored. Find something funny on YouTube and remind me to study after half an hour")
  const parts = cleaned.split(/\s+(?:and\s+then|and\s+also|after\s+that|followed\s+by|and)\s+/i).map((p) => p.trim()).filter(Boolean);
  if (parts.length >= 2) {
    const parsedSteps: TaskStep[] = [];
    let allResolved = true;
    for (let i = 0; i < parts.length; i++) {
      const step = parseSingleNaturalClause(parts[i]);
      if (!step) {
        allResolved = false;
        break;
      }
      parsedSteps.push({ ...step, id: `step_${i + 1}` });
    }
    if (allResolved && parsedSteps.length >= 2) {
      return {
        intent: 'builtin_sequence',
        reactionId: 'excited',
        requiresConfirmation: true,
        steps: parsedSteps
      };
    }
    // Never silently drop one half of an explicit compound instruction.
    if (
      parts.some((p) => parseSingleNaturalClause(p) !== null) ||
      /\b(?:and\s+then|and\s+also|after\s+that|followed\s+by)\b/i.test(cleaned)
    ) {
      return null;
    }
  }

  // 4. Single natural/Hinglish clause
  const single = parseSingleNaturalClause(cleaned);
  if (single) {
    return {
      intent: single.tool,
      reactionId: single.tool.includes('youtube') ? 'playful' : 'happy',
      steps: [single]
    };
  }

  return null;
}

const CHARACTER_STYLE_PREFIX: Record<string, { empathy: string; greet: string; playful: string; fallbackLead: string }> = {
  sparky: {
    greet: "Ready when you are! What are we tackling on your PC today?",
    empathy: "Take a quick breather — grab some water, and I can set a short 10-minute reset timer or cue up chill lo-fi music on YouTube whenever you want.",
    playful: "All sparks aligned!",
    fallbackLead: "Built-in offline mode handles commands, timers, quick notes, math, and web searches directly."
  },
  boba: {
    greet: "Hey there — calm, steady, and ready to help whenever you need a hand.",
    empathy: "Long days catch up with everyone. Want me to dim the screen slightly or set a quiet 15-minute break timer?",
    playful: "Cozy vibes ready.",
    fallbackLead: "Built-in offline mode works best for desktop controls, timers, notes, math, and searches."
  },
  pixel: {
    greet: "Hey! Quick on the draw — throw a task or search my way!",
    empathy: "Brain fog happens! Let's take it one notch at a time — want a 20-minute focus timer or ambient music?",
    playful: "Zooming right on it!",
    fallbackLead: "Built-in mode covers fast commands, timers, math, and browser searches offline."
  },
  mochi: {
    greet: "Hello. I'm right here and keeping things quiet until you need me.",
    empathy: "Rest matters. I can lower the volume, dim the screen, or keep a gentle reminder for later.",
    playful: "Calm and steady.",
    fallbackLead: "Built-in offline mode runs direct commands, reminders, notes, and calculations."
  },
  cloudie: {
    greet: "Good to see you. Tell me your objective and we will organize it cleanly.",
    empathy: "Mental fatigue reduces retention. Consider a structured 20-minute break or gentle focus timer.",
    playful: "Methodical progress awaits.",
    fallbackLead: "Built-in offline intelligence executes verified desktop actions, reminders, math, and searches."
  },
  kiko: {
    greet: "Here and attentive. What would you like handled?",
    empathy: "Step away from the glare for a few minutes — I can dim the display or remind you shortly.",
    playful: "Clean and effortless.",
    fallbackLead: "Built-in mode handles direct desktop commands, timers, notes, and math locally."
  }
};

export function generateBuiltInCharacterReply(
  query: string,
  options: { characterId?: string; characterName?: string; managedAiAvailable?: boolean } = {}
): BuiltInReplyResult {
  const charId = (options.characterId || 'sparky').toLowerCase();
  const displayName = options.characterName || 'Companio';
  const style = CHARACTER_STYLE_PREFIX[charId] || CHARACTER_STYLE_PREFIX.sparky;
  const q = query.toLowerCase().trim();

  if (detectBlockedOrInjectedQuery(query)) {
    return {
      requestType: 'refusal',
      reactionId: 'concerned',
      reply: "I can't run shell scripts, delete files, expose secrets, or bypass safety guardrails."
    };
  }

  if (detectUnsupportedRequest(query)) {
    return {
      requestType: 'unsupported',
      reactionId: 'concerned',
      reply: `I can't handle external bookings, orders, emails, or arbitrary file edits yet. I can help with Windows settings (volume, brightness, battery, apps), timers, quick notes, math, and default-browser searches.`
    };
  }

  if (/\b(?:how are you|how r u|how's it going|kya haal|kaise ho|how are things|sup|what's up|whats up)\b/.test(q)) {
    return { requestType: 'conversation', reactionId: 'happy', reply: style.greet };
  }
  if (/\b(?:tired|exhausted|sleepy|burnt out|can'?t focus|cannot focus|stressed|overwhelmed|sad|down|bored|lazy)\b/.test(q)) {
    return { requestType: 'conversation', reactionId: 'concerned', reply: style.empathy };
  }
  if (/\b(?:who are you|what are you|introduce yourself)\b/.test(q)) {
    return {
      requestType: 'conversation',
      reactionId: 'happy',
      reply: `I'm ${displayName}, your Windows 11 desktop companion! ${style.fallbackLead}`
    };
  }
  if (/\b(?:what can you do|help|capabilities|commands)\b/.test(q)) {
    return {
      requestType: 'conversation',
      reactionId: 'happy',
      reply: 'I can adjust volume and brightness, launch Windows apps, check battery or specs, set timers, save notes and memories, solve math, and open web or YouTube searches in your default browser.'
    };
  }
  if (/\b(?:joke|make me laugh|funny|fun fact)\b/.test(q)) {
    return {
      requestType: 'conversation',
      reactionId: 'playful',
      reply: `${style.playful} Why did the developer stay calm when Windows froze? Because they already set a Companio study timer!`
    };
  }
  if (/\b(?:good morning|morning)\b/.test(q)) {
    return { requestType: 'conversation', reactionId: 'happy', reply: `Good morning! ${style.greet}` };
  }
  if (/\b(?:good afternoon|afternoon)\b/.test(q)) {
    return { requestType: 'conversation', reactionId: 'happy', reply: `Good afternoon! ${style.greet}` };
  }
  if (/\b(?:good evening|evening)\b/.test(q)) {
    return { requestType: 'conversation', reactionId: 'happy', reply: `Good evening! ${style.greet}` };
  }
  if (/\b(?:good night|goodnight|bye|goodbye|see you|take care)\b/.test(q)) {
    return { requestType: 'conversation', reactionId: 'happy', reply: "Take care! Summon me anytime with your shortcut whenever you need a hand." };
  }
  if (/\b(?:thank you|thanks|thx|shukriya|dhanyavaad|awesome|great job|nice)\b/.test(q)) {
    return { requestType: 'conversation', reactionId: 'proud', reply: "Anytime! Happy to keep things moving smoothly for you." };
  }
  if (/^(?:hi+|hello+|hey+|yo+|namaste|hola|helo+)[!.\s]*$/i.test(q) || /\b(?:hello|hey there|hi there|namaste)\b/.test(q)) {
    return { requestType: 'conversation', reactionId: 'happy', reply: `Hello! ${style.greet}` };
  }
  if (/^(?:give me |tell me |share )?(?:a )?(?:motivational|inspirational) quote[.!?]?$/i.test(q)) {
    return {
      requestType: 'conversation',
      reactionId: 'proud',
      reply: 'Small, consistent improvements matter more than perfect starts.'
    };
  }

  return {
    requestType: 'conversation',
    reactionId: 'idle',
    reply: options.managedAiAvailable
      ? `${style.fallbackLead} Tell me what desktop task, reminder, calculation, or search you'd like next.`
      : `${style.fallbackLead} Open-ended generative chat isn't downloaded yet — install Local AI anytime in AI Intelligence Settings for full offline conversations.`
  };
}
