import { TaskPlan, TaskStep, AiConfig } from '../types';
import { desktopBridge } from './desktopBridge';
import { isCommandRequest } from './intentSafety';
import { parseWebCommand } from './webCommandParser';
import { generateConversationalResponse } from './conversationContext';

export class TaskPlanner {
  protected generateConversationalResponse = generateConversationalResponse;
  // Interpret natural user request and generate structured task plan
  async planTask(query: string, aiConfig?: AiConfig): Promise<TaskPlan> {
    const command = query.trim().replace(/^(?:(?:hey|hi|ok|okay)\s+)?(?:companio|companion)(?:\s*[,:\-]\s*|\s+)(?=\S)/i, '').replace(/^(?:please\s+)?(?:(?:can|could|would|will)\s+you\s+)?(?:please\s+)?/i, '').trim();
    const q = command.toLowerCase();
    const planId = 'plan_' + Date.now() + '_' + Math.random().toString(36).slice(2);
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

    // Note contents are data, never commands: handle before keyword matching.
    const note = command.match(/^(?:take a note|add (?:a )?note|remember that|save (?:a )?note|note:)(?:\s*:\s*|\s+|$)([\s\S]*)$/i) || command.match(/^note:\s*([\s\S]*)$/i);
    const noteTool = note ? 'utility.notes.add'
      : /^(?:(?:read|show|get)\s+(?:my\s+|all\s+)?notes|my notes)[.!?]?$/i.test(command) ? 'utility.notes.read'
      : /^(?:clear|delete|empty)\s+(?:all\s+|my\s+)?notes[.!?]?$/i.test(command) ? 'utility.notes.clear' : null;
    if (noteTool) {
      const content = note?.[1]?.trim() || '';
      if (note && !content) throw new Error('What would you like me to save in the note?');
      const description = noteTool === 'utility.notes.add' ? 'Save a quick note' : noteTool === 'utility.notes.read' ? 'Retrieve saved quick notes' : 'Clear all saved quick notes';
      return {id:planId,query,intent:noteTool,steps:[{id:'step_1',tool:noteTool,params:note?{note:content}:{},description,status:'pending'}],currentStepIndex:0,status:'planning',createdAt:Date.now()};
    }

    // Never let a destructive phrase be inferred from a mere mention of a bin.
    if (/^(?:open|show|check|inspect|read|view)\s+(?:(?:the|my|windows)\s+)*(?:recycle bin|trash)[.!?]?$/i.test(command)) {
      throw new Error('Companio will not empty the Recycle Bin unless you explicitly request it. Opening or inspecting the bin is not supported by this command.');
    }

    // Explicit chains must be recognized before a search parser can absorb the
    // second operation into a search term. Plain conjunctions remain valid text.
    const explicitAction = /^(?:please\s+)?(?:(?:can|could|would)\s+you\s+)?(?:open|launch|start|search|find|look\s+up|play|pause|mute|unmute|set|change|go\s+to|visit|show|take|capture|save|add|read|check|get|clear|delete|empty|close|quit|lock|skip|stop|increase|decrease|raise|lower|dim)\b/i.test(command);
    // "Tom and Jerry" is not a two-step instruction, but "open YouTube
    // and play ..." is. Never run only the first half of an unsupported chain.
    const multiAction = /\b(?:and\s+then|then|and\s+also|after\s+that|followed\s+by|and\s+(?=(?:please\s+)?(?:open|launch|start|search|find|look\s+up|play|pause|mute|unmute|set|change|go\s+to|visit|show|ask|send|write|type|click|navigate|delete|clear)\b))/i.test(command);
    if (explicitAction && multiAction) {
      const offline = await desktopBridge.planOfflineSequence({ query: command });
      if (offline.success && offline.steps?.length && offline.requiresConfirmation === true) {
        return this.buildApprovedActionPlan(query, planId, 'builtin_sequence', offline.steps);
      }
      if (aiConfig?.provider === 'local') return this.planSafeLocalActions(query, aiConfig, planId);
      throw new Error(offline.error || 'This multi-step command is not fully supported. No actions were executed.');
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

    // 1. Named websites. Exact Google Home intent is handled here so an
    // allowed spoken "Open Google" never silently falls through as conversation.
    if (q === 'open google') {
      intent = 'browser.google.open';
      steps.push({
        id: 'step_1',
        tool: 'browser.open_url',
        description: 'Open Google in the default browser',
        params: { url: 'https://www.google.com' },
        status: 'pending',
        verification: 'Windows browser handoff only; page loading is unverified'
      });
    } else if (q.includes('chatgpt') || q.includes('chat gpt')) {
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
    } else if (/^(?:empty|clear)\s+(?:(?:the|my|windows)\s+)*(?:recycle bin|trash)[.!?]?$/i.test(command)) {
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


}
