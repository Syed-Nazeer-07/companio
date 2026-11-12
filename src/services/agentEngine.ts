import { TaskPlan, TaskStep, AiConfig } from '../types';
import { desktopBridge } from './desktopBridge';
import { dbService } from './dbService';
import { isCommandRequest } from './intentSafety';
import { parseWebCommand } from './webCommandParser';
import { evaluateArithmetic } from './arithmetic';

// Never let a slow external process freeze Companio indefinitely. A timed-out
// Windows action may still complete, so the caller must NOT retry it silently.
export async function runWithActionDeadline<T>(
  run: () => Promise<T>,
  timeoutMs: number,
  signal: AbortSignal
): Promise<{kind:'done';value:T}|{kind:'timeout'}|{kind:'cancelled'}|{kind:'error';error:unknown}> {
  if(signal.aborted) return {kind:'cancelled'};
  if(!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 120000) {
    return {kind:'error',error:Error('Invalid action timeout.')};
  }
  let operation:Promise<T>;
  try { operation=Promise.resolve(run()); }
  catch(error) { return {kind:'error',error}; }
  let timer:ReturnType<typeof setTimeout>|undefined;
  let abortListener:(()=>void)|undefined;
  const control=new Promise<{kind:'timeout'}|{kind:'cancelled'}>(resolve=>{
    timer=setTimeout(()=>resolve({kind:'timeout'}),timeoutMs);
    abortListener=()=>resolve({kind:'cancelled'});
    signal.addEventListener('abort',abortListener,{once:true});
    if(signal.aborted) abortListener();
  });
  const settled=operation.then(
    value=>({kind:'done' as const,value}),
    error=>({kind:'error' as const,error})
  );
  try { return await Promise.race([control,settled]); }
  finally {
    if(timer!==undefined)clearTimeout(timer);
    if(abortListener)signal.removeEventListener('abort',abortListener);
  }
}
export function actionTimeoutMs(tool:string):number {
  // Playback verification includes YouTube hydration; no broad 90-second
  // permission for ordinary app launches or default-browser handoffs.
  if(tool==='browser.youtube.search_and_play')return 90000;
  if(tool==='browser.open_tabs')return 60000;
  return 30000;
}

export class AgentEngine {
  private activeAbortController: AbortController | null = null;

  // Emergency Cancel
  cancelActiveTask() {
    if (this.activeAbortController) {
      this.activeAbortController.abort();
      this.activeAbortController = null;
      return true;
    }
    return false;
  }

  // Interpret natural user request and generate structured task plan
  async planTask(query: string, aiConfig?: AiConfig): Promise<TaskPlan> {
    const q = query.trim().toLowerCase();
    const planId = 'plan_' + Date.now();
    const steps: TaskStep[] = [];
    let intent = 'conversation';

    // Safety boundary: questions and incidental app names are conversation,
    // not permission to operate a computer. Only explicit requests reach
    // legacy keyword matching or any model-based action planning.
    if (!isCommandRequest(query)) {
      return {
        id: planId, query, intent: 'conversation', steps: [],
        currentStepIndex: 0, status: 'completed', createdAt: Date.now(),
        finalMessage: await this.generateConversationalResponse(query, aiConfig)
      };
    }

    // Direct navigation needs no model, no guesswork, and no separate
    // controlled Edge profile: Windows opens the site in the user's default
    // browser. This handles explicit domains as well as general web searches.
    const webCommand = parseWebCommand(query);
    if (webCommand) {
      return {
        id: planId, query, intent: webCommand.tool,
        steps: [{
          id: 'step_1', tool: webCommand.tool, params: webCommand.params,
          description: webCommand.description, status: 'pending',
          verification: 'Windows accepted browser launch; page loading is not verified.'
        }],
        currentStepIndex: 0, status: 'planning', createdAt: Date.now()
      };
    }

    // Check explicit multi-action requests before the old single-command
    // matcher; otherwise a request can silently execute only its first part.
    // The built-in grammar works with no LLM; supported plans still need approval.
    const explicitAction = /^(?:please\s+)?(?:(?:can|could|would)\s+you\s+)?(?:open|launch|start|search|find|look\s+up|play|pause|mute|unmute|set|change|go\s+to|visit|show)\b/i.test(query.trim());
    // "Tom and Jerry" is not a two-step instruction, but "open YouTube
    // and play ..." is. Never run only the first half of an unsupported chain.
    const multiAction = /\b(?:and\s+then|then|and\s+also|after\s+that|followed\s+by|and\s+(?=(?:please\s+)?(?:open|launch|start|search|find|look\s+up|play|pause|mute|unmute|set|change|go\s+to|visit|show|ask|send|write|type|click|navigate|delete|clear)\b))/i.test(query);
    if (explicitAction && multiAction) {
      const offline = await desktopBridge.planOfflineSequence({ query });
      if (offline.success && offline.steps?.length && offline.requiresConfirmation === true) {
        return this.buildApprovedActionPlan(query, planId, 'builtin_sequence', offline.steps);
      }
      if (aiConfig?.provider === 'local') {
        return this.planSafeLocalActions(query, aiConfig, planId);
      }
      // A compound command is all-or-nothing, even when the fixed grammar
      // cannot split it into actions. Partial execution is misleading.
      throw new Error(offline.error || 'This multi-step command is not fully supported. No actions were executed.');
    }

    // 1. Direct Web Apps (ChatGPT, Claude, Gemini, WhatsApp, Gmail, Reddit, Netflix, X)
    if (q.includes('chatgpt') || q.includes('chat gpt')) {
      intent = 'browser.chatgpt.open';
      steps.push({
        id: 'step_1',
        tool: 'browser.chatgpt.open',
        description: 'Open ChatGPT in browser',
        params: {},
        status: 'pending',
        verification: 'ChatGPT page opened'
      });
    } else if (q.includes('claude')) {
      intent = 'browser.claude.open';
      steps.push({
        id: 'step_1',
        tool: 'browser.claude.open',
        description: 'Open Anthropic Claude in browser',
        params: {},
        status: 'pending',
        verification: 'Claude page opened'
      });
    } else if (q.includes('gemini')) {
      intent = 'browser.gemini.open';
      steps.push({
        id: 'step_1',
        tool: 'browser.gemini.open',
        description: 'Open Google Gemini in browser',
        params: {},
        status: 'pending',
        verification: 'Gemini page opened'
      });
    } else if (q.includes('whatsapp')) {
      intent = 'browser.whatsapp.open';
      steps.push({
        id: 'step_1',
        tool: 'browser.whatsapp.open',
        description: 'Open WhatsApp Web in browser',
        params: {},
        status: 'pending',
        verification: 'WhatsApp Web page opened'
      });
    } else if (q.includes('gmail') || q.includes('check my email') || q.includes('open email')) {
      intent = 'browser.gmail.open';
      steps.push({
        id: 'step_1',
        tool: 'browser.gmail.open',
        description: 'Open Gmail in browser',
        params: {},
        status: 'pending',
        verification: 'Gmail page opened'
      });
    } else if (q.includes('reddit')) {
      intent = 'browser.reddit.open';
      steps.push({
        id: 'step_1',
        tool: 'browser.reddit.open',
        description: 'Open Reddit in browser',
        params: {},
        status: 'pending',
        verification: 'Reddit page opened'
      });
    } else if (q.includes('netflix')) {
      intent = 'browser.netflix.open';
      steps.push({
        id: 'step_1',
        tool: 'browser.netflix.open',
        description: 'Open Netflix in browser',
        params: {},
        status: 'pending',
        verification: 'Netflix page opened'
      });
    } else if (q.includes('twitter') || q === 'open x' || q.includes('open x ')) {
      intent = 'browser.x.open';
      steps.push({
        id: 'step_1',
        tool: 'browser.x.open',
        description: 'Open X (Twitter) in browser',
        params: {},
        status: 'pending',
        verification: 'X page opened'
      });
    }

    // 2. YouTube specific commands. Exact CarryMinati "latest" requests
    // use a verified channel feed and open in the user's default browser.
    // This is a handoff only: do not claim that playback has started.
    else if (/^(?:please\s+)?(?:play|watch|find|open)\s+(?:(?:the\s+)?(?:latest|newest|new)\s+(?:youtube\s+)?video\s+(?:from|by|of)\s+carryminati|carryminati(?:'s)?\s+(?:latest|newest|new)\s+(?:youtube\s+)?video|(?:the\s+)?(?:latest|newest|new)\s+carryminati\s+(?:youtube\s+)?video)[.!?]*$/i.test(query.trim())) {
      intent = 'browser.youtube.latest_known';
      steps.push({
        id:'step_1',tool:'browser.youtube.latest_known',
        description:'Open the newest public CarryMinati upload listed by the verified channel feed in the default browser',
        params:{},status:'pending',
        verification:'YouTube channel feed identity and Windows handoff only; playback not verified'
      });
    }
    else if (/^(?:please\s+)?(?:play|watch|find|open)\s+(?:the\s+)?(?:latest|newest|new)\s+(?:youtube\s+)?video\s+(?:from|by|of)\s+.{2,100}$/i.test(query.trim())) {
      const creator = query.trim().replace(/^(?:please\s+)?(?:play|watch|find|open)\s+(?:the\s+)?(?:latest|newest|new)\s+(?:youtube\s+)?video\s+(?:from|by|of)\s+/i, '').trim();
      intent = 'browser.youtube.creator_latest';
      steps.push({
        id: 'step_1',
        tool: 'browser.youtube.search_and_play',
        description: `Find the latest upload on ${creator}'s verified YouTube channel and play it`,
        params: { creator, latest: true },
        status: 'pending',
        verification: 'Exact creator matched, newest channel video and playback checked'
      });
    } else if (q.includes('carryminati')) {
      intent = 'browser.youtube.carryminati';
      const newest = /\b(?:latest|newest|new video|most recent)\b/.test(q);
      steps.push({
        id: 'step_1',
        tool: 'browser.youtube.search_and_play',
        description: newest ? "Find CarryMinati's latest channel upload and play it" : 'Search and play a CarryMinati video',
        params: { creator: 'CarryMinati', latest: newest },
        status: 'pending',
        verification: 'Video element playing and URL contains watch?v='
      });
      if (q.includes('fullscreen')) {
        steps.push({
          id: 'step_2',
          tool: 'browser.youtube.control',
          description: 'Toggle fullscreen video playback',
          params: { action: 'fullscreen' },
          status: 'pending'
        });
      }
    } else if (q.includes('bro code') || (q.includes('python tutorial') && q.includes('youtube'))) {
      intent = 'browser.youtube.bro_code';
      steps.push({
        id: 'step_1',
        tool: 'browser.youtube.search_and_play',
        description: 'Find a Python tutorial by Bro Code and open it',
        params: { creator: 'Bro Code', topic: 'Python tutorial' },
        status: 'pending',
        verification: 'Video playing on YouTube'
      });
    } else if (q.includes('pause') && (q.includes('video') || q.includes('youtube'))) {
      intent = 'browser.youtube.pause';
      steps.push({
        id: 'step_1',
        tool: 'browser.youtube.control',
        description: 'Pause current YouTube video',
        params: { action: 'pause' },
        status: 'pending'
      });
    } else if (q.includes('fullscreen') && (q.includes('video') || q.includes('youtube') || q.includes('go fullscreen'))) {
      intent = 'browser.youtube.fullscreen';
      steps.push({
        id: 'step_1',
        tool: 'browser.youtube.control',
        description: 'Set YouTube video to fullscreen',
        params: { action: 'fullscreen' },
        status: 'pending'
      });
    } else if (q.includes('open youtube') || q.includes('launch youtube') || q === 'youtube') {
      intent = 'browser.youtube.open';
      steps.push({
        id: 'step_1',
        tool: 'browser.youtube.open',
        description: 'Open YouTube in browser',
        params: {},
        status: 'pending',
        verification: 'YouTube homepage title verified'
      });
    }

    // 3. Multi-step requests
    else if (q.includes('open chrome') && q.includes('python') && q.includes('documentation')) {
      intent = 'multi_step.python_docs';
      steps.push({
        id: 'step_1',
        tool: 'browser.search_google',
        description: 'Search Google for the latest Python release',
        params: { query: 'latest Python release' },
        status: 'pending'
      });
      steps.push({
        id: 'step_2',
        tool: 'browser.open_url',
        description: 'Navigate to official Python documentation',
        params: { url: 'https://docs.python.org/3/' },
        status: 'pending',
        verification: 'Python docs page title loaded'
      });
    } else if (q.includes('open spotify') && q.includes('volume to 30')) {
      intent = 'multi_step.spotify_volume';
      steps.push({
        id: 'step_1',
        tool: 'win.spotify.launch',
        description: 'Launch Spotify desktop client',
        params: {},
        status: 'pending'
      });
      steps.push({
        id: 'step_2',
        tool: 'win.media.control',
        description: 'Start playback of favorite playlist',
        params: { action: 'play' },
        status: 'pending'
      });
      steps.push({
        id: 'step_3',
        tool: 'win.volume.set',
        description: 'Lower system master volume to 30%',
        params: { level: 30 },
        status: 'pending',
        verification: 'System audio endpoint volume verified at 30%'
      });
    } else if (q.includes('open vs code') && q.includes('project folder')) {
      intent = 'multi_step.vscode_project';
      steps.push({
        id: 'step_1',
        tool: 'win.vscode.launch',
        description: 'Launch VS Code with project folder',
        params: { path: '' },
        status: 'pending',
        verification: 'Code.exe process running'
      });
    }

    // 4. Spotify & Media commands
    else if (q.includes('graffitia') || (q.includes('green day') && q.includes('spotify'))) {
      intent = 'win.spotify.graffitia';
      steps.push({
        id: 'step_1',
        tool: 'win.spotify.play_track',
        description: 'Play Graffitia by Green Day on Spotify',
        params: { query: 'Graffitia Green Day' },
        status: 'pending',
        verification: 'Spotify track query triggered'
      });
    } else if (q.includes('liked songs') || (q.includes('play') && q.includes('music'))) {
      intent = 'win.media.play';
      steps.push({
        id: 'step_1',
        tool: 'win.media.control',
        description: 'Play music on media player',
        params: { action: 'play' },
        status: 'pending'
      });
    } else if (q.includes('pause') && q.includes('music')) {
      intent = 'win.media.pause';
      steps.push({
        id: 'step_1',
        tool: 'win.media.control',
        description: 'Pause music playback',
        params: { action: 'pause' },
        status: 'pending'
      });
    } else if (q.includes('resume playback') || q.includes('resume music')) {
      intent = 'win.media.resume';
      steps.push({
        id: 'step_1',
        tool: 'win.media.control',
        description: 'Resume music playback',
        params: { action: 'play' },
        status: 'pending'
      });
    } else if (q.includes('skip') && (q.includes('song') || q.includes('track'))) {
      intent = 'win.media.skip';
      steps.push({
        id: 'step_1',
        tool: 'win.media.control',
        description: 'Skip to next track',
        params: { action: 'next' },
        status: 'pending'
      });
    } else if (q.includes('open spotify') || q.includes('launch spotify') || q === 'spotify') {
      intent = 'win.spotify.launch';
      steps.push({
        id: 'step_1',
        tool: 'win.spotify.launch',
        description: 'Launch Spotify application',
        params: {},
        status: 'pending'
      });
    }

    // 5. Volume & Audio Control
    else if (/\b(?:volume\s+up|increase\s+(?:the\s+)?volume|raise\s+(?:the\s+)?volume|louder)\b/.test(q)) {
      intent = 'win.volume.change';
      steps.push({
        id: 'step_1', tool: 'win.volume.change',
        description: 'Increase Windows master volume by 10%',
        params: { delta: 10 }, status: 'pending'
      });
    } else if (/\b(?:volume\s+down|decrease\s+(?:the\s+)?volume|lower\s+(?:the\s+)?volume|softer)\b/.test(q)) {
      intent = 'win.volume.change';
      steps.push({
        id: 'step_1', tool: 'win.volume.change',
        description: 'Decrease Windows master volume by 10%',
        params: { delta: -10 }, status: 'pending'
      });
    } else if (q.includes('mute') && !q.includes('unmute')) {
      intent = 'win.volume.mute';
      steps.push({
        id: 'step_1',
        tool: 'win.volume.mute',
        description: 'Mute Windows master audio',
        params: { mute: true },
        status: 'pending',
        verification: 'Audio mute scalar verified true'
      });
    } else if (q.includes('unmute')) {
      intent = 'win.volume.unmute';
      steps.push({
        id: 'step_1',
        tool: 'win.volume.mute',
        description: 'Unmute Windows master audio',
        params: { mute: false },
        status: 'pending',
        verification: 'Audio mute scalar verified false'
      });
    } else if (q.includes('volume')) {
      const match = q.match(/\b(?:to|at)\s*(\d{1,3})\s*%?\b|\b(\d{1,3})\s*%/);
      if (!match) throw new Error('Specify a volume level, for example "set volume to 40%". No change was made.');
      const level = Number(match[1] || match[2]);
      if (!Number.isFinite(level) || level < 0 || level > 100) {
        throw new Error('Volume must be between 0 and 100%. No change was made.');
      }
      intent = 'win.volume.set';
      steps.push({
        id: 'step_1',
        tool: 'win.volume.set',
        description: `Set system volume to ${level}%`,
        params: { level },
        status: 'pending',
        verification: `Audio endpoint scalar verified within tolerance of ${level}%`
      });
    }

    // 6. Native Windows Applications
    else if (q.includes('close calculator') || q.includes('quit calculator')) {
      intent = 'win.calculator.close';
      steps.push({
        id: 'step_1',
        tool: 'win.calculator.close',
        description: 'Close Windows Calculator',
        params: {},
        status: 'pending',
        verification: 'Calculator process terminated'
      });
    } else if (q.includes('calculator') || q.includes('calc')) {
      intent = 'win.calculator.launch';
      steps.push({
        id: 'step_1',
        tool: 'win.calculator.launch',
        description: 'Launch Windows Calculator',
        params: {},
        status: 'pending',
        verification: 'CalculatorApp process running'
      });
    } else if (q.includes('notepad')) {
      intent = 'win.notepad.launch';
      steps.push({
        id: 'step_1',
        tool: 'win.notepad.launch',
        description: 'Launch Notepad',
        params: {},
        status: 'pending',
        verification: 'Notepad process running'
      });
    } else if (q.includes('paint') || q.includes('mspaint')) {
      intent = 'win.paint.launch';
      steps.push({
        id: 'step_1',
        tool: 'win.paint.launch',
        description: 'Launch Paint',
        params: {},
        status: 'pending',
        verification: 'Paint process running'
      });
    } else if (q.includes('task manager') || q.includes('taskmgr')) {
      intent = 'win.taskmgr.launch';
      steps.push({
        id: 'step_1',
        tool: 'win.taskmgr.launch',
        description: 'Launch Task Manager',
        params: {},
        status: 'pending',
        verification: 'Task Manager process running'
      });
    } else if (q.includes('snipping tool') || q.includes('snipping')) {
      intent = 'win.snipping.launch';
      steps.push({
        id: 'step_1',
        tool: 'win.snipping.launch',
        description: 'Launch Snipping Tool',
        params: {},
        status: 'pending',
        verification: 'Snipping Tool process running'
      });
    } else if (q.includes('terminal') || q.includes('powershell') || q.includes('command prompt')) {
      intent = 'win.terminal.launch';
      steps.push({
        id: 'step_1',
        tool: 'win.terminal.launch',
        description: 'Launch Windows Terminal',
        params: {},
        status: 'pending',
        verification: 'Terminal process running'
      });
    } else if (q.includes('windows settings') || (q.includes('open') && q.includes('settings'))) {
      intent = 'win.settings.open';
      steps.push({
        id: 'step_1',
        tool: 'win.settings.open',
        description: 'Open Windows Settings',
        params: {},
        status: 'pending',
        verification: 'Settings app launched'
      });
    } else if (q.includes('lock my pc') || q.includes('lock computer') || q.includes('lock workstation')) {
      intent = 'win.system.lock';
      steps.push({
        id: 'step_1',
        tool: 'win.system.lock',
        description: 'Lock Windows workstation',
        params: {},
        status: 'pending',
        verification: 'Lock command dispatched'
      });
    } else if (q.includes('file explorer') || q.includes('downloads folder') || q.includes('downloads')) {
      intent = 'win.explorer.open';
      const folder = q.includes('downloads') ? 'downloads' : q.includes('documents') ? 'documents' : '';
      steps.push({
        id: 'step_1',
        tool: 'win.explorer.open',
        description: `Open File Explorer at ${folder || 'Home'}`,
        params: { folder },
        status: 'pending'
      });
    } else if (q.includes('vs code') || q.includes('vscode') || q.includes('visual studio code')) {
      intent = 'win.vscode.launch';
      steps.push({
        id: 'step_1',
        tool: 'win.vscode.launch',
        description: 'Launch Visual Studio Code',
        params: { path: '' },
        status: 'pending'
      });
    } else if (q.includes('screenshot') || q.includes('screen shot') || /\b(?:capture|take|save)\s+(?:(?:a|the|my)\s+)?(?:screen|ss)\b/.test(q)) {
      intent = 'win.screenshot';
      steps.push({
        id: 'step_1',
        tool: 'win.screenshot',
        description: 'Take high-resolution monitor screenshot',
        params: {},
        status: 'pending',
        verification: 'PNG file saved to Pictures/Companio_Captures'
      });
    } else if (q.includes('minimize') && (q.includes('window') || q.includes('current'))) {
      intent = 'win.window.minimize';
      steps.push({
        id: 'step_1',
        tool: 'win.window.minimize',
        description: 'Minimize active foreground window',
        params: {},
        status: 'pending'
      });
    }

    // 6.5 Expanded Native Windows Tools
    else if (q.includes('volume up') || q.includes('louder') || q.includes('increase volume') || q.includes('raise volume')) {
      intent = 'win.volume.change';
      steps.push({
        id: 'step_1',
        tool: 'win.volume.change',
        description: 'Increase system volume by +10%',
        params: { delta: 10 },
        status: 'pending'
      });
    } else if (q.includes('volume down') || q.includes('softer') || q.includes('decrease volume') || q.includes('lower volume')) {
      intent = 'win.volume.change';
      steps.push({
        id: 'step_1',
        tool: 'win.volume.change',
        description: 'Decrease system volume by -10%',
        params: { delta: -10 },
        status: 'pending'
      });
    } else if (q.includes('recycle bin') || q.includes('empty trash') || q.includes('clear trash')) {
      intent = 'win.recyclebin.empty';
      steps.push({
        id: 'step_1',
        tool: 'win.recyclebin.empty',
        description: 'Empty Windows Recycle Bin',
        params: {},
        status: 'pending'
      });
    } else if (q.includes('show desktop') || q.includes('minimize all') || q.includes('go to desktop')) {
      intent = 'win.desktop.show';
      steps.push({
        id: 'step_1',
        tool: 'win.desktop.show',
        description: 'Show Desktop and minimize all windows',
        params: {},
        status: 'pending'
      });
    } else if (q.includes('battery') || q.includes('power level') || q.includes('battery percentage')) {
      intent = 'win.battery.get';
      steps.push({
        id: 'step_1',
        tool: 'win.battery.get',
        description: 'Check battery status and level',
        params: {},
        status: 'pending'
      });
    } else if (q.includes('system specs') || q.includes('pc specs') || q.includes('hardware') || q.includes('computer specs')) {
      intent = 'win.system.specs';
      steps.push({
        id: 'step_1',
        tool: 'win.system.specs',
        description: 'Check CPU, RAM, and OS system specs',
        params: {},
        status: 'pending'
      });
    } else if (q.includes('command prompt') || q.includes('open cmd')) {
      intent = 'win.cmd.launch';
      steps.push({
        id: 'step_1',
        tool: 'win.cmd.launch',
        description: 'Launch Command Prompt',
        params: {},
        status: 'pending'
      });
    } else if (q.includes('camera') || q.includes('take a photo') || q.includes('webcam')) {
      intent = 'win.camera.launch';
      steps.push({
        id: 'step_1',
        tool: 'win.camera.launch',
        description: 'Launch Windows Camera',
        params: {},
        status: 'pending'
      });
    } else if (q.includes('clock') || q.includes('timer') || q.includes('alarm') || q.includes('stopwatch')) {
      intent = 'win.clock.launch';
      steps.push({
        id: 'step_1',
        tool: 'win.clock.launch',
        description: 'Launch Clock & Alarms app',
        params: {},
        status: 'pending'
      });
    } else if (q.includes('weather') || q.includes('forecast')) {
      intent = 'win.weather.launch';
      steps.push({
        id: 'step_1',
        tool: 'win.weather.launch',
        description: 'Launch Windows Weather',
        params: {},
        status: 'pending'
      });
    } else if (q.includes('open edge') || q.includes('microsoft edge')) {
      intent = 'win.edge.launch';
      steps.push({
        id: 'step_1',
        tool: 'win.edge.launch',
        description: 'Launch Microsoft Edge browser',
        params: {},
        status: 'pending'
      });
    } else if (q.includes('open chrome') || q.includes('google chrome')) {
      intent = 'win.chrome.launch';
      steps.push({
        id: 'step_1',
        tool: 'win.chrome.launch',
        description: 'Launch Google Chrome browser',
        params: {},
        status: 'pending'
      });
    } else if (q.includes('discord')) {
      intent = 'win.discord.launch';
      steps.push({
        id: 'step_1',
        tool: 'win.discord.launch',
        description: 'Launch Discord',
        params: {},
        status: 'pending'
      });
    } else if (q.includes('steam')) {
      intent = 'win.steam.launch';
      steps.push({
        id: 'step_1',
        tool: 'win.steam.launch',
        description: 'Launch Steam',
        params: {},
        status: 'pending'
      });
    } else if (q.includes('wifi') || q.includes('wi-fi') || q.includes('bluetooth') || q.includes('display settings') || q.includes('windows update')) {
      intent = 'win.settings.category';
      const cat = q.includes('wifi') || q.includes('wi-fi') ? 'wifi'
        : q.includes('bluetooth') ? 'bluetooth'
        : q.includes('display') ? 'display'
        : q.includes('update') ? 'update' : 'settings';
      steps.push({
        id: 'step_1',
        tool: 'win.settings.category',
        description: `Open Windows ${cat.toUpperCase()} Settings`,
        params: { category: cat },
        status: 'pending'
      });
    }

    // 6.6 Brightness, Clipboard, Network & Productivity Tools
    else if (q.includes('brightness') || q.includes('dim screen') || q.includes('screen dimmer') || q.includes('screen brighter')) {
      const pctMatch = q.match(/(\d{1,3})\s*%/);
      if (pctMatch) {
        const level = parseInt(pctMatch[1], 10);
        intent = 'win.brightness.set';
        steps.push({
          id: 'step_1',
          tool: 'win.brightness.set',
          description: `Set display brightness to ${level}%`,
          params: { level },
          status: 'pending'
        });
      } else if (q.includes('dim') || q.includes('darker') || q.includes('decrease') || q.includes('lower') || q.includes('down')) {
        intent = 'win.brightness.change';
        steps.push({
          id: 'step_1',
          tool: 'win.brightness.change',
          description: 'Decrease display brightness by 15%',
          params: { delta: -15 },
          status: 'pending'
        });
      } else {
        intent = 'win.brightness.change';
        steps.push({
          id: 'step_1',
          tool: 'win.brightness.change',
          description: 'Increase display brightness by +15%',
          params: { delta: 15 },
          status: 'pending'
        });
      }
    } else if (q.includes('clipboard')) {
      if (q.includes('clear') || q.includes('empty')) {
        intent = 'win.clipboard.clear';
        steps.push({
          id: 'step_1',
          tool: 'win.clipboard.clear',
          description: 'Clear Windows clipboard content',
          params: {},
          status: 'pending'
        });
      } else {
        intent = 'win.clipboard.read';
        steps.push({
          id: 'step_1',
          tool: 'win.clipboard.read',
          description: 'Read current clipboard content',
          params: {},
          status: 'pending'
        });
      }
    } else if (q.includes('my ip') || q.includes('ip address') || q.includes('network status') || q.includes('wifi status')) {
      intent = 'win.network.ip';
      steps.push({
        id: 'step_1',
        tool: 'win.network.ip',
        description: 'Get local IP address and network status',
        params: {},
        status: 'pending'
      });
    } else if (q.includes('pomodoro') || q.includes('focus mode') || q.includes('study timer')) {
      intent = 'utility.pomodoro.start';
      const minsMatch = q.match(/(\d+)\s*(?:min|minute)/);
      const minutes = minsMatch ? parseInt(minsMatch[1], 10) : 25;
      steps.push({
        id: 'step_1',
        tool: 'utility.pomodoro.start',
        description: `Start ${minutes}-minute Pomodoro focus session`,
        params: { minutes },
        status: 'pending'
      });
    } else if (q.includes('take a note') || q.includes('add note') || q.includes('remember that') || q.startsWith('note:') || q.includes('save note')) {
      intent = 'utility.notes.add';
      const noteContent = query.replace(/^take a note:?|^add note:?|^remember that:?|^note:?|^save note:?/i, '').trim();
      steps.push({
        id: 'step_1',
        tool: 'utility.notes.add',
        description: `Save note: "${noteContent || 'Quick note'}"`,
        params: { note: noteContent || 'Quick note' },
        status: 'pending'
      });
    } else if (q.includes('my notes') || q.includes('read notes') || q.includes('show notes') || q.includes('get notes')) {
      intent = 'utility.notes.read';
      steps.push({
        id: 'step_1',
        tool: 'utility.notes.read',
        description: 'Retrieve saved quick notes',
        params: {},
        status: 'pending'
      });
    } else if (q.includes('clear notes') || q.includes('delete notes') || q.includes('empty notes')) {
      intent = 'utility.notes.clear';
      steps.push({
        id: 'step_1',
        tool: 'utility.notes.clear',
        description: 'Clear all saved quick notes',
        params: {},
        status: 'pending'
      });
    }

    // 7. Browser & Web Search
    else if (q.includes('wikipedia') || (q.includes('who is') && q.includes('on wiki'))) {
      intent = 'browser.wikipedia.search';
      const searchTopic = query.replace(/search wikipedia for/i, '').replace(/wikipedia/i, '').replace(/on wiki/i, '').trim();
      steps.push({
        id: 'step_1',
        tool: 'browser.wikipedia.search',
        description: `Search Wikipedia for "${searchTopic}"`,
        params: { query: searchTopic },
        status: 'pending'
      });
    } else if (q.includes('amazon') || (q.includes('buy') && q.includes('online'))) {
      intent = 'browser.amazon.search';
      const item = query.replace(/search amazon for/i, '').replace(/amazon/i, '').replace(/buy/i, '').trim();
      steps.push({
        id: 'step_1',
        tool: 'browser.amazon.search',
        description: `Search Amazon for "${item}"`,
        params: { query: item },
        status: 'pending'
      });
    } else if (q.includes('maps') || q.includes('directions to') || (q.includes('where is') && !q.includes('who is'))) {
      intent = 'browser.maps.search';
      const loc = query.replace(/search maps for/i, '').replace(/maps/i, '').replace(/directions to/i, '').replace(/where is/i, '').trim();
      steps.push({
        id: 'step_1',
        tool: 'browser.maps.search',
        description: `Search Google Maps for "${loc}"`,
        params: { query: loc },
        status: 'pending'
      });
    } else if (q.includes('deepseek')) {
      intent = 'browser.deepseek.open';
      steps.push({
        id: 'step_1',
        tool: 'browser.open_url',
        description: 'Open DeepSeek AI Chat',
        params: { url: 'https://chat.deepseek.com' },
        status: 'pending'
      });
    } else if (q.includes('twitch')) {
      intent = 'browser.twitch.open';
      steps.push({
        id: 'step_1',
        tool: 'browser.open_url',
        description: 'Open Twitch live streaming',
        params: { url: 'https://www.twitch.tv' },
        status: 'pending'
      });
    } else if (q.includes('linkedin')) {
      intent = 'browser.linkedin.open';
      steps.push({
        id: 'step_1',
        tool: 'browser.open_url',
        description: 'Open LinkedIn',
        params: { url: 'https://www.linkedin.com' },
        status: 'pending'
      });
    } else if (q.includes('translate') || q.includes('google translate')) {
      intent = 'browser.translate.open';
      steps.push({
        id: 'step_1',
        tool: 'browser.open_url',
        description: 'Open Google Translate',
        params: { url: 'https://translate.google.com' },
        status: 'pending'
      });
    } else if (q.includes('open github') || q.includes('go to my repositories')) {
      intent = 'browser.github';
      steps.push({
        id: 'step_1',
        tool: 'browser.open_url',
        description: 'Open GitHub in the browser',
        params: { url: 'https://github.com' },
        status: 'pending',
        verification: 'GitHub page loaded'
      });
    } else if (q.includes('search google') || (q.includes('search for') && q.includes('on google'))) {
      intent = 'browser.search_google';
      const cleanQuery = query.replace(/search google for/i, '').replace(/search for/i, '').replace(/on google/i, '').trim();
      steps.push({
        id: 'step_1',
        tool: 'browser.search_google',
        description: `Search Google for "${cleanQuery}"`,
        params: { query: cleanQuery },
        status: 'pending'
      });
    } else if (q.includes('five tabs') || q.includes('5 tabs')) {
      intent = 'browser.open_tabs';
      steps.push({
        id: 'step_1',
        tool: 'browser.open_tabs',
        description: 'Open five machine learning research tabs',
        params: {
          urls: [
            'https://arxiv.org/list/cs.LG/recent',
            'https://huggingface.co/models',
            'https://github.com/trending/python',
            'https://paperswithcode.com',
            'https://distill.pub'
          ]
        },
        status: 'pending'
      });
    } else if (q.includes('close') && (q.includes('current tab') || q.includes('this tab'))) {
      intent = 'browser.close_tab';
      steps.push({
        id: 'step_1',
        tool: 'browser.close_tab',
        description: 'Close active browser tab',
        params: {},
        status: 'pending'
      });
    }

    if (aiConfig?.provider === 'local' && explicitAction && steps.length === 0) {
      return this.planSafeLocalActions(query, aiConfig, planId);
    }

    const conversationalReply = steps.length === 0
      ? await this.generateConversationalResponse(query, aiConfig)
      : undefined;

    return {
      id: planId,
      query,
      intent,
      steps,
      currentStepIndex: 0,
      status: steps.length > 0 ? 'planning' : 'completed',
      createdAt: Date.now(),
      finalMessage: conversationalReply
    };
  }

  // Centralize the proposal-to-plan conversion: the UI always obtains
  // explicit user consent before any locally suggested actions execute.
  private buildApprovedActionPlan(
    query: string,
    planId: string,
    intent: 'builtin_sequence' | 'local_ai_actions',
    actions: Array<{ tool: string; params: Record<string, any>; description: string }>
  ): TaskPlan {
    return {
      id: planId,
      query,
      intent,
      steps: actions.map((step, index) => ({
        id: 'step_' + (index + 1),
        tool: step.tool,
        params: step.params,
        description: step.description,
        verification: 'Native action outcome must be verified before continuing.',
        status: 'pending' as const
      })),
      currentStepIndex: 0,
      status: 'planning',
      createdAt: Date.now()
    };
  }

  // Model suggestions are validated in Electron main and cannot bypass the
  // native tool allowlist. Validation is not execution or user approval.
  private async planSafeLocalActions(query: string, aiConfig: AiConfig, planId: string): Promise<TaskPlan> {
    const proposal = await desktopBridge.planLocalActions({
      endpoint: aiConfig.localEndpoint,
      model: aiConfig.model || 'llama3.2:1b',
      query
    });
    if (!proposal.success || !proposal.steps?.length || proposal.requiresConfirmation !== true) {
      throw new Error(proposal.error || 'No safe actions could be planned. Try a simpler request.');
    }
    return this.buildApprovedActionPlan(query, planId, 'local_ai_actions', proposal.steps);
  }

  // Conversational response with local desktop inference and deterministic offline utilities
  private async generateConversationalResponse(query: string, aiConfig?: AiConfig): Promise<string> {
    const q = query.toLowerCase().trim();

    // 1. Math Calculation Solver (Instant 0ms calculation)
    if (q.includes('calculate') || q.includes('what is') || q.includes("what's") || q.includes('solve')) {
      // Percentage check e.g. "what is 15% of 800" or "calculate 20% of 1500"
      const pctMatch = q.match(/(\d+(?:\.\d+)?)\s*%\s*of\s*(\d+(?:\.\d+)?)/);
      if (pctMatch) {
        const pct = parseFloat(pctMatch[1]);
        const val = parseFloat(pctMatch[2]);
        const ans = (pct / 100) * val;
        return `${pct}% of ${val} is ${ans} 🧮`;
      }

      // Square root check
      const sqrtMatch = q.match(/(?:square root of|sqrt of|sqrt)\s*(\d+(?:\.\d+)?)/);
      if (sqrtMatch) {
        const val = parseFloat(sqrtMatch[1]);
        return `The square root of ${val} is ${Math.sqrt(val)} 🧮`;
      }

      // Basic arithmetic expressions
      let expr = q
        .replace(/what is|what's|calculate|solve|\?/g, '')
        .replace(/\bplus\b/g, '+')
        .replace(/\bminus\b/g, '-')
        .replace(/\btimes\b|\bmultiplied by\b/g, '*')
        .replace(/\bdivided by\b/g, '/')
        .trim();

      if (/^[\d\s\+\-\*\/\.\(\)]+$/.test(expr) && /[\+\-\*\/]/.test(expr)) {
        try {
          const result = evaluateArithmetic(expr);
          if (result !== null) return `${expr.trim()} = ${result} 🧮`;
        } catch (e) {}
      }
    }

    // 2. Coin Flip & Dice Roll
    if (q.includes('flip a coin') || q.includes('toss a coin')) {
      const outcome = Math.random() > 0.5 ? 'Heads' : 'Tails';
      return `🪙 It's ${outcome}!`;
    }
    if (q.includes('roll a dice') || q.includes('roll a die') || q.includes('roll dice')) {
      const val = Math.floor(Math.random() * 6) + 1;
      return `🎲 You rolled a ${val}!`;
    }

    // 3. Time & Date direct queries
    if (q.includes('what time') || q.includes('current time') || q.includes('tell me the time')) {
      const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      return `The current time is ${timeStr}! ⏰ Anything else you need?`;
    }
    if (q.includes('what date') || q.includes('what is the date') || q.includes("today's date") || q.includes('what day is it')) {
      const dateStr = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
      return `Today is ${dateStr}! 📅 Ready for an awesome day!`;
    }

    // 2. Motivational Quotes
    if (q.includes('quote') || q.includes('inspire') || q.includes('motivation')) {
      const quotes = [
        "\"The only way to do great work is to love what you do.\" — Steve Jobs ✨",
        "\"Success is not final, failure is not fatal: it is the courage to continue that counts.\" — Winston Churchill 🚀",
        "\"Believe you can and you're halfway there.\" — Theodore Roosevelt 🌟",
        "\"Small daily improvements over time lead to stunning results.\" — Robin Sharma 💡",
        "\"Your time is limited, don't waste it living someone else's life.\" — Steve Jobs 💖"
      ];
      return quotes[Math.floor(Math.random() * quotes.length)];
    }

    // Local mode must use the selected model or report a real error.
    // Never silently fall back to a canned reply when the server is offline.
    if (aiConfig?.provider === 'local') {
      const result = await desktopBridge.chatLocalAi({
        endpoint: aiConfig.localEndpoint,
        model: aiConfig.model || 'llama3.2:1b',
        prompt: query,
        systemPrompt: aiConfig.systemPrompt,
        temperature: aiConfig.temperature
      });
      if (!result.success || !result.reply) {
        throw new Error((result.error || 'The local model did not reply.') + ' Local AI is optional. Start Ollama / LM Studio or switch AI Settings to Built-in for offline commands.');
      }
      return result.reply;
    }

    // Built-in delightful companion personality
    if (q.includes('how are you') || q.includes('how r u') || q.includes('how are you doing')) {
      return "I'm feeling wonderful and super energetic today! Ready to help you with anything on your PC ✨ How are you doing?";
    }
    if (q.includes('who are you') || q.includes('what are you')) {
      return "I'm Companio, your personal AI desktop companion! I live on your Windows desktop to automate tasks, open apps, control sound, and keep you company 💖";
    }
    if (q.includes('joke') || q.includes('make me laugh')) {
      const jokes = [
        "Why do programmers prefer dark mode? Because light attracts bugs! 😄",
        "Why was the computer cold? It left its Windows open! ❄️",
        "There are 10 types of people in the world: those who understand binary, and those who don't! 🤖"
      ];
      return jokes[Math.floor(Math.random() * jokes.length)];
    }
    if (q.includes('good morning')) {
      return "Good morning! ☀️ Wishing you an inspiring, productive, and happy day ahead! What shall we tackle first?";
    }
    if (q.includes('good night') || q.includes('sleep well')) {
      return "Good night! 🌙 Sweet dreams! I'll be right here resting whenever you need me.";
    }
    if (q.includes('thank you') || q.includes('thanks')) {
      return "You're so very welcome! Always happy to help you 🥰";
    }
    if (/\b(?:hello|hi|hey)\b/.test(q)) {
      return "Hello there! ✨ What can I do for you on your computer today?";
    }
    if (q.includes('bored')) {
      return "Want me to play CarryMinati or some good music on Spotify, or maybe open ChatGPT to brainstorm cool projects? Just say the word! 🚀";
    }
    if (q.includes('help') || q.includes('what can you do')) {
      return "I can open ChatGPT, YouTube, Spotify, Chrome, VS Code, and Camera; control system volume; take screenshots; empty recycle bin; show desktop; check battery; and automate computer workflows!";
    }

    return `Got it! I'm here and ready to help. You can ask me to open ChatGPT, control volume, search YouTube, or launch any Windows app anytime ✨`;
  }

  // Formulate warm, human-like companion completion messages
  private getDelightfulSuccessMessage(plan: TaskPlan): string {
    // Windows shell.openExternal verifies handoff, not page rendering. Preserve
    // this distinction instead of saying a site loaded or a video is playing.
    const delegated = plan.steps.filter(step => step.result?.handoffOnly === true);
    if (delegated.length > 0) {
      return delegated.length === plan.steps.length
        ? (delegated.length === 1
          ? delegated[0].result.message
          : `Windows accepted ${delegated.length} launch requests. Application/page opening was not independently verified.`)
        : `Completed the verified actions and sent ${delegated.length} further Windows launch request(s); those destinations were not independently verified.`;
    }
    if (plan.steps.length === 1) {
      const step = plan.steps[0];
      const p = step.params || {};

      switch (step.tool) {
        case 'browser.chatgpt.open':
          return "ChatGPT is open! What are we working on today? 💡";
        case 'browser.claude.open':
          return "Claude is ready! Time for some deep thinking and code 🧠";
        case 'browser.gemini.open':
          return "Google Gemini is open! What would you like to explore? 🌟";
        case 'browser.deepseek.open':
          return "DeepSeek AI is ready! Let's solve something great 🧠";
        case 'browser.whatsapp.open':
          return "WhatsApp Web is open! Catch up on your messages 💬";
        case 'browser.gmail.open':
          return "Gmail is open! Check your inbox ✉️";
        case 'browser.reddit.open':
          return "Reddit is open! Enjoy browsing 🚀";
        case 'browser.netflix.open':
          return "Netflix is loaded! Grab your popcorn and enjoy 🍿";
        case 'browser.x.open':
          return "X is open! Let's see what's trending 🐦";
        case 'browser.twitch.open':
          return "Twitch is open! Enjoy the live streams 🎮";
        case 'browser.linkedin.open':
          return "LinkedIn is open! 💼";
        case 'browser.translate.open':
          return "Google Translate is open! 🌐";
        case 'browser.wikipedia.search':
          return `Here is Wikipedia for "${p.query}"! 📚`;
        case 'browser.amazon.search':
          return `Here are the Amazon results for "${p.query}"! 🛍️`;
        case 'browser.maps.search':
          return `Here is Google Maps for "${p.query}"! 🗺️`;
        case 'browser.youtube.search_and_play':
          if (p.creator === 'CarryMinati') {
            return "Playing CarryMinati's newest video for you! Enjoy the laughs ✨";
          }
          if (p.creator === 'Bro Code') {
            return "Here's the Python tutorial by Bro Code! Happy coding 💻";
          }
          return `Playing ${p.creator || 'your video'} on YouTube! 🎬`;
        case 'browser.youtube.open':
          return "YouTube is open! Ready for great videos 🎬";
        case 'browser.youtube.control':
          return p.action === 'pause' 
            ? "Paused the video! Let me know when you want to resume ⏸️" 
            : "Switched to fullscreen mode! Looks great 📺";
        case 'win.calculator.launch':
          return "Calculator is open! Ready for math 🧮";
        case 'win.calculator.close':
          return "Calculator is closed! 🧹";
        case 'win.explorer.open':
          return "File Explorer is open! Found your files 📂";
        case 'win.vscode.launch':
          return "VS Code is open! Happy coding ✨";
        case 'win.notepad.launch':
          return "Notepad is open! Ready for quick notes 📝";
        case 'win.paint.launch':
          return "Paint is open! Time to create art 🎨";
        case 'win.taskmgr.launch':
          return "Task Manager is open! Checking system performance 📊";
        case 'win.snipping.launch':
          return "Snipping Tool is open! Capture away ✂️";
        case 'win.terminal.launch':
          return "Terminal is open and ready for commands! ⚡";
        case 'win.cmd.launch':
          return "Command Prompt is open! ⚡";
        case 'win.powershell.launch':
          return "PowerShell console is ready! ⚡";
        case 'win.camera.launch':
          return "Camera is open! Say cheese 📸";
        case 'win.clock.launch':
          return "Clock & Timer app is open! ⏰";
        case 'win.weather.launch':
          return "Weather forecast opened! ☀️";
        case 'win.edge.launch':
          return "Microsoft Edge opened! 🌐";
        case 'win.chrome.launch':
          return "Google Chrome opened! 🌐";
        case 'win.discord.launch':
          return "Discord is open! Have fun chatting 🎮";
        case 'win.steam.launch':
          return "Steam is open! Game on 🕹️";
        case 'win.recyclebin.empty':
          return "Emptied the Recycle Bin! Your disk is clean ✨";
        case 'win.desktop.show':
          return "Showing desktop! All windows minimized 🪟";
        case 'win.battery.get':
          return `${step.result?.message || 'Battery checked!'} 🔋`;
        case 'win.system.specs':
          return `${step.result?.message || 'System specs checked!'} 💻`;
        case 'win.settings.category':
        case 'win.settings.open':
          return "Windows Settings opened! ⚙️";
        case 'win.system.lock':
          return "Locking your computer. See you soon! 🔒";
        case 'win.volume.set':
          return `Set the volume to ${p.level}%! Sounds just right 🎵`;
        case 'win.volume.change':
          return `Volume adjusted by ${p.delta > 0 ? '+' : ''}${p.delta}%! 🔊`;
        case 'win.volume.mute':
          return p.mute ? "Muted system audio! Shh... 🤫" : "Sound unmuted! Audio is back 🎶";
        case 'win.screenshot':
          return step.result?.message || 'Screenshot saved to Pictures/Companio_Captures.';
        case 'win.spotify.play_track':
          return `Playing "${p.query}" on Spotify! 🎧`;
        case 'win.media.control':
          return "Music playback updated! 🎧";
        case 'browser.search_google':
          return `Here are the Google search results for "${p.query}"! 🔍`;
        case 'browser.open_tabs':
          return "Opened your research tabs in the browser! 📑";
        case 'browser.close_tab':
          return "Closed the tab for you! ✨";
        case 'win.window.minimize':
          return "Minimized active window! 🪟";
        case 'win.brightness.set':
          return `Display brightness set to ${p.level}%! ☀️`;
        case 'win.brightness.change':
          return `${step.result?.message || 'Display brightness adjusted!'} ☀️`;
        case 'win.clipboard.read':
          return `${step.result?.message || 'Read clipboard!'} 📋`;
        case 'win.clipboard.clear':
          return "Clipboard cleared! 📋🧹";
        case 'win.network.ip':
          return `${step.result?.message || 'Network status retrieved!'} 🌐`;
        case 'utility.pomodoro.start':
          return `${step.result?.message || 'Pomodoro started!'} 🍅`;
        case 'utility.notes.add':
          return `${step.result?.message || 'Note saved!'} 📝`;
        case 'utility.notes.read':
          return `${step.result?.message || 'Notes retrieved!'} 📝`;
        case 'utility.notes.clear':
          return "All notes cleared! 🧹";
        default:
          return `${step.description} finished successfully! ✨`;
      }
    }

    return "All done! I've executed all your actions and adjusted everything for you ✨";
  }

  // Execute the structured plan step-by-step with real verification
  async executePlan(
    plan: TaskPlan, 
    onProgress: (updatedPlan: TaskPlan) => void
  ): Promise<TaskPlan> {
    if (plan.steps.length === 0) {
      plan.status = 'completed';
      onProgress({ ...plan });
      return plan;
    }

    const controller = new AbortController();
    this.activeAbortController = controller;
    const { signal } = controller;

    // Release the active controller on every outcome, including early failure
    // and cancellation; otherwise old requests look live after completion.
    try {
    plan.status = 'executing';
    onProgress({ ...plan });

    for (let i = 0; i < plan.steps.length; i++) {
      if (signal.aborted) {
        plan.status = 'cancelled';
        plan.error = 'Task was cancelled by the user.';
        for (let j = i; j < plan.steps.length; j++) {
          plan.steps[j].status = 'cancelled';
        }
        onProgress({ ...plan });
        return plan;
      }

      const step = plan.steps[i];
      plan.currentStepIndex = i;
      step.status = 'running';
      onProgress({ ...plan });

      const startTime = Date.now();
      try {
        let result: any;
        if (step.tool === 'utility.pomodoro.start') {
          const mins = step.params?.minutes || 25;
          if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
            setTimeout(() => {
              new Notification('Companio Focus Mode Completed! 🍅', {
                body: `Great job! Your ${mins}-minute focus session has ended. Time for a well-deserved stretch break!`
              });
            }, mins * 60 * 1000);
          }
          result = {
            success: true,
            message: `Focus session started for ${mins} minutes! Time to shine 🍅`,
            verified: true
          };
        } else if (step.tool === 'utility.notes.add') {
          const note = step.params?.note || '';
          const saved = await dbService.addNote(note);
          result = {
            success: saved.success,
            message: saved.success ? `Saved note: "${note}" (${saved.count} total note${saved.count === 1 ? '' : 's'}) 📝`
              : 'The note was not saved.',
            error: saved.error,
            verified: saved.success
          };
        } else if (step.tool === 'utility.notes.read') {
          const notes = dbService.getNotes();
          const msg = notes.length > 0
            ? `Here are your notes:\n` + notes.map((n, idx) => `${idx + 1}. ${n}`).join('\n')
            : `Your notes are currently empty! Tell me "take a note: ..." to save one anytime 📝`;
          result = {
            success: true,
            message: msg,
            verified: true
          };
        } else if (step.tool === 'utility.notes.clear') {
          if (!window.confirm('Delete all saved Companio notes? This cannot be undone.')) {
            result = { success: false, verified: false, error: 'Note deletion cancelled.' };
          } else {
            const cleared = await dbService.clearNotes();
            result = {
              success: cleared.success,
              message: cleared.success ? 'All notes cleared! 🧹' : 'Notes could not be cleared.',
              error: cleared.error,
              verified: cleared.success
            };
          }
        } else {
          const timeout=actionTimeoutMs(step.tool);
          const outcome=await runWithActionDeadline(
            () => desktopBridge.executeTool(step.tool, step.params),
            timeout,
            signal
          );
          if(outcome.kind==='done') result=outcome.value;
          else if(outcome.kind==='cancelled'){
            step.status='cancelled';
            plan.status='cancelled';
            plan.error='Stopped by user. An already-started Windows action may still finish.';
            for(let j=i+1;j<plan.steps.length;j++)plan.steps[j].status='cancelled';
            onProgress({...plan});
            return plan;
          } else if(outcome.kind==='timeout') {
            result={success:false,verified:false,error:
              'No confirmation within '+Math.round(timeout/1000)+
              ' seconds. The action may still finish; check Windows before retrying.'};
          } else {
            throw outcome.error instanceof Error ? outcome.error : Error(String(outcome.error));
          }
        }

        const duration = Date.now() - startTime;

        if (signal.aborted) {
          step.status = 'cancelled';
          plan.status = 'cancelled';
          plan.error = 'Stopped by user. An already-started Windows action may still finish.';
          for(let j=i+1;j<plan.steps.length;j++)plan.steps[j].status='cancelled';
          onProgress({ ...plan });
          return plan;
        }

        if (result && result.success === true && result.verified === true) {
          step.status = 'success';
          step.result = result;
          // Log to local SQLite database
          dbService.addLog(step.tool, step.params, result, result.verified !== false, duration);
        } else {
          step.status = 'failed';
          step.error = result?.error || (result?.success ? 'Action attempted but outcome not verified.' : 'Execution failed.');
          plan.status = 'failed';
          plan.error = `Step failed: ${step.description}. ${step.error}`;
          dbService.addLog(step.tool, step.params, result, false, duration);
          onProgress({ ...plan });
          return plan;
        }
      } catch (err: any) {
        step.status = 'failed';
        step.error = err.message;
        plan.status = 'failed';
        plan.error = `Error executing ${step.tool}: ${err.message}`;
        onProgress({ ...plan });
        return plan;
      }

      onProgress({ ...plan });
    }

    plan.status = 'completed';
    plan.finalMessage = this.getDelightfulSuccessMessage(plan);
    onProgress({ ...plan });
    return plan;
    } finally {
      if (this.activeAbortController === controller) this.activeAbortController = null;
    }
  }
}

export const agentEngine = new AgentEngine();
