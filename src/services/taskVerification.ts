import { TaskPlan } from '../types';

  // Formulate warm, human-like companion completion messages
export function getDelightfulSuccessMessage(plan: TaskPlan): string {
    // Windows shell.openExternal verifies handoff, not page rendering. Preserve
    // this distinction instead of saying a site loaded or a video is playing.
    const delegated = plan.steps.filter(step => step.result?.handoffOnly === true);
    if (delegated.length > 0) {
      return delegated.length === plan.steps.length
        ? (delegated.length === 1
          ? delegated[0].result.message || 'Windows accepted the launch request; the destination was not independently verified.'
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

export function verifiedOutcome(result: any): boolean {
  return result?.success === true && result?.verified === true;
}
