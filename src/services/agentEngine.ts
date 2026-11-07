import { TaskPlan, TaskStep, AiConfig } from '../types';
import { desktopBridge } from './desktopBridge';
import { dbService } from './dbService';

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

    // 2. YouTube specific commands
    else if (q.includes('carryminati')) {
      intent = 'browser.youtube.carryminati';
      steps.push({
        id: 'step_1',
        tool: 'browser.youtube.search_and_play',
        description: "Search for CarryMinati's channel and start the newest uploaded video",
        params: { creator: 'CarryMinati' },
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
    else if (q.includes('mute') && !q.includes('unmute')) {
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
      const match = q.match(/(\d+)\s*%/);
      const level = match ? parseInt(match[1], 10) : (q.includes('up') ? 75 : 50);
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
    } else if (q.includes('screenshot') || q.includes('take a screenshot')) {
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

    // 7. Browser & Web Search
    else if (q.includes('open github') || q.includes('go to my repositories')) {
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

  // Conversational response with Local LLM (Ollama/LM Studio) support & natural fallback
  private async generateConversationalResponse(query: string, aiConfig?: AiConfig): Promise<string> {
    const q = query.toLowerCase().trim();

    // Try Local LLM (Ollama / LM Studio) if configured
    if (aiConfig?.provider === 'local') {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 3500);

        const res = await fetch('http://localhost:11434/v1/chat/completions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: aiConfig.model || 'llama3.2',
            messages: [
              {
                role: 'system',
                content: 'You are Companio, an adorable, friendly, helpful personal AI desktop companion for Windows 11. Keep replies concise (1-2 sentences), sweet, and warm.'
              },
              { role: 'user', content: query }
            ],
            max_tokens: 100,
            temperature: 0.7
          }),
          signal: controller.signal
        });

        clearTimeout(timeout);
        if (res.ok) {
          const data = await res.json();
          const reply = data.choices?.[0]?.message?.content?.trim();
          if (reply) return reply;
        }
      } catch (err) {
        // Fall back gracefully to built-in companion personality
      }
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
    if (q.includes('hello') || q.includes('hi') || q.includes('hey')) {
      return "Hello there! ✨ What can I do for you on your computer today?";
    }
    if (q.includes('bored')) {
      return "Want me to play CarryMinati or some good music on Spotify, or maybe open ChatGPT to brainstorm cool projects? Just say the word! 🚀";
    }
    if (q.includes('help') || q.includes('what can you do')) {
      return "I can open ChatGPT, YouTube, Spotify, VS Code, and Calculator; control system volume; take screenshots; manage tabs; and automate computer workflows!";
    }

    return `Got it! I'm here and ready to help. You can ask me to open ChatGPT, control volume, search YouTube, or launch any Windows app anytime ✨`;
  }

  // Formulate warm, human-like companion completion messages
  private getDelightfulSuccessMessage(plan: TaskPlan): string {
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
        case 'win.settings.open':
          return "Windows Settings opened! ⚙️";
        case 'win.system.lock':
          return "Locking your computer. See you soon! 🔒";
        case 'win.volume.set':
          return `Set the volume to ${p.level}%! Sounds just right 🎵`;
        case 'win.volume.mute':
          return p.mute ? "Muted system audio! Shh... 🤫" : "Sound unmuted! Audio is back 🎶";
        case 'win.screenshot':
          return "Screenshot captured and saved to your Pictures folder! 📸";
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

    this.activeAbortController = new AbortController();
    const { signal } = this.activeAbortController;

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
        const result = await desktopBridge.executeTool(step.tool, step.params);
        const duration = Date.now() - startTime;

        if (signal.aborted) {
          step.status = 'cancelled';
          plan.status = 'cancelled';
          onProgress({ ...plan });
          return plan;
        }

        if (result && result.success !== false) {
          step.status = 'success';
          step.result = result;
          // Log to local SQLite database
          dbService.addLog(step.tool, step.params, result, result.verified !== false, duration);
        } else {
          step.status = 'failed';
          step.error = result?.error || 'Execution verification failed';
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
    this.activeAbortController = null;
    onProgress({ ...plan });
    return plan;
  }
}

export const agentEngine = new AgentEngine();
