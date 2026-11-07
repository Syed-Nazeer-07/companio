export interface ToolSchema {
  id: string;
  name: string;
  category: 'Browser' | 'Windows Apps' | 'Audio & Media' | 'System';
  description: string;
  permissionsRequired: string[];
  parameters: {
    name: string;
    type: 'string' | 'number' | 'boolean' | 'array';
    required: boolean;
    description: string;
    default?: any;
  }[];
  samplePrompts: string[];
}

export const TOOL_CATALOG: ToolSchema[] = [
  {
    id: 'browser.youtube.open',
    name: 'Open YouTube',
    category: 'Browser',
    description: 'Launches or switches to the browser and navigates directly to YouTube homepage.',
    permissionsRequired: ['Browser Control'],
    parameters: [],
    samplePrompts: ['Open YouTube', 'Go to YouTube', 'Launch YouTube']
  },
  {
    id: 'browser.youtube.search_and_play',
    name: 'YouTube Search & Play',
    category: 'Browser',
    description: 'Searches for a creator or topic and checks playback; latest mode verifies an exact creator-channel match before selecting an upload.',
    permissionsRequired: ['Browser Control', 'DOM Interaction'],
    parameters: [
      { name: 'creator', type: 'string', required: true, description: 'Creator or channel name (e.g. CarryMinati, Bro Code)' },
      { name: 'topic', type: 'string', required: false, description: 'Specific video topic or tutorial name' },
      { name: 'latest', type: 'boolean', required: false, description: 'Use verified creator channel and latest uploads instead of search ranking' }
    ],
    samplePrompts: [
      "Search for CarryMinati's newest video and play it",
      "Find a Python tutorial by Bro Code and open it",
      "Play latest video from Veritasium"
    ]
  },
  {
    id: 'browser.youtube.control',
    name: 'YouTube Playback Control',
    category: 'Browser',
    description: 'Controls active YouTube playback (pause, resume, fullscreen, mute).',
    permissionsRequired: ['Browser Control'],
    parameters: [
      { name: 'action', type: 'string', required: true, description: 'Action: pause, play, fullscreen, mute' }
    ],
    samplePrompts: ['Pause the current YouTube video', 'Resume playback', 'Go fullscreen', 'Mute video']
  },
  {
    id: 'browser.search_google',
    name: 'Google Search',
    category: 'Browser',
    description: 'Performs a live Google search and displays verified search results.',
    permissionsRequired: ['Browser Control'],
    parameters: [
      { name: 'query', type: 'string', required: true, description: 'Search term or question' }
    ],
    samplePrompts: [
      'Search Google for the latest AI developments',
      'Search for Windows 11 ARM64 features'
    ]
  },
  {
    id: 'browser.open_url',
    name: 'Open URL / GitHub',
    category: 'Browser',
    description: 'Opens a specific website URL, documentation page, or GitHub repository.',
    permissionsRequired: ['Browser Control'],
    parameters: [
      { name: 'url', type: 'string', required: true, description: 'Full website URL or domain' }
    ],
    samplePrompts: [
      'Open GitHub and go to my repositories',
      'Open the official Python documentation'
    ]
  },
  {
    id: 'browser.open_tabs',
    name: 'Open Multiple Tabs',
    category: 'Browser',
    description: 'Opens multiple browser tabs simultaneously for research or study topics.',
    permissionsRequired: ['Browser Control'],
    parameters: [
      { name: 'urls', type: 'array', required: true, description: 'List of URLs to open' }
    ],
    samplePrompts: ['Open five tabs about machine learning']
  },
  {
    id: 'browser.close_tab',
    name: 'Close Active Tab',
    category: 'Browser',
    description: 'Safely closes the current browser tab.',
    permissionsRequired: ['Browser Control'],
    parameters: [],
    samplePrompts: ['Close the current tab', 'Close this tab']
  },
  {
    id: 'win.calculator.launch',
    name: 'Launch Calculator',
    category: 'Windows Apps',
    description: 'Opens the native Windows Calculator application.',
    permissionsRequired: ['App Execution'],
    parameters: [],
    samplePrompts: ['Open Calculator', 'Launch Calculator', 'Start Calculator']
  },
  {
    id: 'win.calculator.close',
    name: 'Close Calculator',
    category: 'Windows Apps',
    description: 'Closes the Windows Calculator application process.',
    permissionsRequired: ['App Execution'],
    parameters: [],
    samplePrompts: ['Close Calculator', 'Quit Calculator']
  },
  {
    id: 'win.explorer.open',
    name: 'Open File Explorer',
    category: 'Windows Apps',
    description: 'Opens Windows File Explorer at a specific directory (Downloads, Documents, Projects).',
    permissionsRequired: ['File System'],
    parameters: [
      { name: 'folder', type: 'string', required: false, description: 'Target folder name or absolute path' }
    ],
    samplePrompts: ['Open File Explorer', 'Open my Downloads folder', 'Open my Documents']
  },
  {
    id: 'win.vscode.launch',
    name: 'Launch VS Code',
    category: 'Windows Apps',
    description: 'Launches Visual Studio Code and optionally opens a project directory.',
    permissionsRequired: ['App Execution'],
    parameters: [
      { name: 'path', type: 'string', required: false, description: 'Project directory path' }
    ],
    samplePrompts: ['Open VS Code', 'Launch VS Code', 'Open my project folder']
  },
  {
    id: 'win.volume.set',
    name: 'Set System Volume',
    category: 'Audio & Media',
    description: 'Sets Windows master audio volume scalar to exact percentage (0-100%).',
    permissionsRequired: ['Audio Control'],
    parameters: [
      { name: 'level', type: 'number', required: true, description: 'Volume level percentage from 0 to 100' }
    ],
    samplePrompts: ['Increase the volume to 60%', 'Set volume to 30%', 'Turn volume up to 80%']
  },
  {
    id: 'win.volume.mute',
    name: 'Mute / Unmute Audio',
    category: 'Audio & Media',
    description: 'Toggles or sets the system audio mute state.',
    permissionsRequired: ['Audio Control'],
    parameters: [
      { name: 'mute', type: 'boolean', required: true, description: 'True to mute, False to unmute' }
    ],
    samplePrompts: ['Mute the audio', 'Unmute the sound', 'Mute system sound']
  },
  {
    id: 'win.screenshot',
    name: 'Take Screenshot',
    category: 'System',
    description: 'Captures the primary monitor screen and saves directly to Pictures/Companio_Captures.',
    permissionsRequired: ['Screen Capture'],
    parameters: [],
    samplePrompts: ['Take a screenshot', 'Capture screen']
  },
  {
    id: 'win.spotify.launch',
    name: 'Launch Spotify',
    category: 'Audio & Media',
    description: 'Launches or switches to the desktop Spotify application.',
    permissionsRequired: ['App Execution'],
    parameters: [],
    samplePrompts: ['Open Spotify', 'Launch Spotify']
  },
  {
    id: 'win.spotify.play_track',
    name: 'Play Spotify Track / Artist',
    category: 'Audio & Media',
    description: 'Searches and plays a specific song, artist, or album on Spotify.',
    permissionsRequired: ['App Execution', 'Media Control'],
    parameters: [
      { name: 'query', type: 'string', required: true, description: 'Song title and artist name' }
    ],
    samplePrompts: [
      'Play Graffitia by Green Day on Spotify',
      'Play Bohemian Rhapsody on Spotify'
    ]
  },
  {
    id: 'win.media.control',
    name: 'Media Playback Controls',
    category: 'Audio & Media',
    description: 'Controls desktop media playback (play, pause, next track, previous track).',
    permissionsRequired: ['Media Control'],
    parameters: [
      { name: 'action', type: 'string', required: true, description: 'Action: play, pause, next, prev' }
    ],
    samplePrompts: ['Play my liked songs', 'Pause the music', 'Resume playback', 'Skip this song']
  },
  {
    id: 'win.window.minimize',
    name: 'Minimize Window',
    category: 'System',
    description: 'Minimizes the currently active foreground window.',
    permissionsRequired: ['Window Management'],
    parameters: [],
    samplePrompts: ['Minimize the current window', 'Minimize this window']
  },
  {
    id: 'browser.chatgpt.open',
    name: 'Open ChatGPT',
    category: 'Browser',
    description: 'Opens ChatGPT in the browser ready for prompts and AI brainstorming.',
    permissionsRequired: ['Browser Control'],
    parameters: [],
    samplePrompts: ['Open ChatGPT', 'Launch ChatGPT', 'Go to ChatGPT']
  },
  {
    id: 'browser.claude.open',
    name: 'Open Claude',
    category: 'Browser',
    description: 'Opens Anthropic Claude in the browser for coding and deep thinking.',
    permissionsRequired: ['Browser Control'],
    parameters: [],
    samplePrompts: ['Open Claude', 'Launch Claude']
  },
  {
    id: 'browser.gemini.open',
    name: 'Open Gemini',
    category: 'Browser',
    description: 'Opens Google Gemini in the browser.',
    permissionsRequired: ['Browser Control'],
    parameters: [],
    samplePrompts: ['Open Gemini', 'Launch Gemini']
  },
  {
    id: 'browser.whatsapp.open',
    name: 'Open WhatsApp',
    category: 'Browser',
    description: 'Opens WhatsApp Web for messaging.',
    permissionsRequired: ['Browser Control'],
    parameters: [],
    samplePrompts: ['Open WhatsApp', 'Launch WhatsApp']
  },
  {
    id: 'browser.gmail.open',
    name: 'Open Gmail',
    category: 'Browser',
    description: 'Navigates directly to Gmail inbox.',
    permissionsRequired: ['Browser Control'],
    parameters: [],
    samplePrompts: ['Open Gmail', 'Check my email']
  },
  {
    id: 'browser.reddit.open',
    name: 'Open Reddit',
    category: 'Browser',
    description: 'Opens Reddit in the browser.',
    permissionsRequired: ['Browser Control'],
    parameters: [],
    samplePrompts: ['Open Reddit', 'Go to Reddit']
  },
  {
    id: 'browser.netflix.open',
    name: 'Open Netflix',
    category: 'Browser',
    description: 'Opens Netflix for streaming movies and series.',
    permissionsRequired: ['Browser Control'],
    parameters: [],
    samplePrompts: ['Open Netflix', 'Launch Netflix']
  },
  {
    id: 'browser.x.open',
    name: 'Open X (Twitter)',
    category: 'Browser',
    description: 'Opens X / Twitter in the browser.',
    permissionsRequired: ['Browser Control'],
    parameters: [],
    samplePrompts: ['Open Twitter', 'Open X']
  },
  {
    id: 'win.notepad.launch',
    name: 'Launch Notepad',
    category: 'Windows Apps',
    description: 'Launches native Windows Notepad for fast text editing.',
    permissionsRequired: ['App Execution'],
    parameters: [],
    samplePrompts: ['Open Notepad', 'Launch Notepad']
  },
  {
    id: 'win.paint.launch',
    name: 'Launch Paint',
    category: 'Windows Apps',
    description: 'Opens Microsoft Paint for drawing and image creation.',
    permissionsRequired: ['App Execution'],
    parameters: [],
    samplePrompts: ['Open Paint', 'Launch Paint']
  },
  {
    id: 'win.taskmgr.launch',
    name: 'Launch Task Manager',
    category: 'Windows Apps',
    description: 'Opens Windows Task Manager to monitor CPU, memory, and running tasks.',
    permissionsRequired: ['App Execution'],
    parameters: [],
    samplePrompts: ['Open Task Manager', 'Launch Task Manager']
  },
  {
    id: 'win.snipping.launch',
    name: 'Launch Snipping Tool',
    category: 'Windows Apps',
    description: 'Opens Windows Snipping Tool for custom area screenshots and recordings.',
    permissionsRequired: ['App Execution'],
    parameters: [],
    samplePrompts: ['Open Snipping Tool', 'Capture snippet']
  },
  {
    id: 'win.terminal.launch',
    name: 'Launch Windows Terminal',
    category: 'Windows Apps',
    description: 'Opens Windows Terminal / PowerShell.',
    permissionsRequired: ['App Execution'],
    parameters: [],
    samplePrompts: ['Open Terminal', 'Open PowerShell']
  },
  {
    id: 'win.settings.open',
    name: 'Open Windows Settings',
    category: 'System',
    description: 'Opens Windows 11 system Settings application.',
    permissionsRequired: ['System Settings'],
    parameters: [],
    samplePrompts: ['Open Settings', 'Open Windows Settings']
  },
  {
    id: 'win.system.lock',
    name: 'Lock Workstation',
    category: 'System',
    description: 'Secures and locks the Windows workstation immediately.',
    permissionsRequired: ['System Lock'],
    parameters: [],
    samplePrompts: ['Lock my PC', 'Lock computer', 'Lock workstation']
  },
  {
    id: 'win.cmd.launch',
    name: 'Command Prompt',
    category: 'Windows Apps',
    description: 'Launches Windows Command Prompt (cmd.exe).',
    permissionsRequired: ['App Execution'],
    parameters: [],
    samplePrompts: ['Open Command Prompt', 'Launch cmd']
  },
  {
    id: 'win.powershell.launch',
    name: 'PowerShell',
    category: 'Windows Apps',
    description: 'Launches Windows PowerShell terminal.',
    permissionsRequired: ['App Execution'],
    parameters: [],
    samplePrompts: ['Open PowerShell', 'Launch PowerShell console']
  },
  {
    id: 'win.camera.launch',
    name: 'Windows Camera',
    category: 'Windows Apps',
    description: 'Opens native Windows Camera application.',
    permissionsRequired: ['App Execution'],
    parameters: [],
    samplePrompts: ['Open camera', 'Launch camera', 'Take a photo']
  },
  {
    id: 'win.clock.launch',
    name: 'Alarms & Clock',
    category: 'Windows Apps',
    description: 'Opens Windows Clock for timers, stopwatches, and alarms.',
    permissionsRequired: ['App Execution'],
    parameters: [],
    samplePrompts: ['Open clock', 'Set a timer', 'Open alarms']
  },
  {
    id: 'win.weather.launch',
    name: 'Windows Weather',
    category: 'Windows Apps',
    description: 'Opens Windows Weather forecast app.',
    permissionsRequired: ['App Execution'],
    parameters: [],
    samplePrompts: ['Open weather', 'Check weather forecast']
  },
  {
    id: 'win.edge.launch',
    name: 'Microsoft Edge',
    category: 'Browser',
    description: 'Launches Microsoft Edge browser.',
    permissionsRequired: ['App Execution'],
    parameters: [],
    samplePrompts: ['Open Edge', 'Launch Microsoft Edge']
  },
  {
    id: 'win.chrome.launch',
    name: 'Google Chrome',
    category: 'Browser',
    description: 'Launches Google Chrome browser.',
    permissionsRequired: ['App Execution'],
    parameters: [],
    samplePrompts: ['Open Chrome', 'Launch Google Chrome']
  },
  {
    id: 'win.discord.launch',
    name: 'Discord',
    category: 'Windows Apps',
    description: 'Opens Discord desktop or web application.',
    permissionsRequired: ['App Execution'],
    parameters: [],
    samplePrompts: ['Open Discord', 'Launch Discord']
  },
  {
    id: 'win.steam.launch',
    name: 'Steam',
    category: 'Windows Apps',
    description: 'Opens Steam gaming client or store.',
    permissionsRequired: ['App Execution'],
    parameters: [],
    samplePrompts: ['Open Steam', 'Launch Steam games']
  },
  {
    id: 'win.recyclebin.empty',
    name: 'Empty Recycle Bin',
    category: 'System',
    description: 'Safely empties the Windows Recycle Bin to free disk storage.',
    permissionsRequired: ['File Operations'],
    parameters: [],
    samplePrompts: ['Empty Recycle Bin', 'Clear trash', 'Clean recycle bin']
  },
  {
    id: 'win.desktop.show',
    name: 'Show Desktop',
    category: 'System',
    description: 'Minimizes all open windows to reveal the clean desktop.',
    permissionsRequired: ['Window Management'],
    parameters: [],
    samplePrompts: ['Show desktop', 'Minimize all windows', 'Go to desktop']
  },
  {
    id: 'win.battery.get',
    name: 'Battery Status',
    category: 'System',
    description: 'Checks current battery percentage and AC charging status.',
    permissionsRequired: ['System Status'],
    parameters: [],
    samplePrompts: ['Check battery', 'What is my battery percentage', 'Battery level']
  },
  {
    id: 'win.system.specs',
    name: 'System Specs',
    category: 'System',
    description: 'Displays current CPU processor, RAM, and Windows 11 OS specifications.',
    permissionsRequired: ['System Status'],
    parameters: [],
    samplePrompts: ['System specs', 'Show PC hardware', 'What are my computer specs']
  },
  {
    id: 'win.settings.category',
    name: 'Open Settings Section',
    category: 'System',
    description: 'Jumps directly to Wi-Fi, Bluetooth, Display, Sound, or Updates in Windows Settings.',
    permissionsRequired: ['System Settings'],
    parameters: [
      { name: 'category', type: 'string', required: true, description: 'wifi, bluetooth, display, sound, apps, update, power' }
    ],
    samplePrompts: ['Open Wi-Fi settings', 'Open Bluetooth settings', 'Open Display settings', 'Check Windows updates']
  },
  {
    id: 'win.volume.change',
    name: 'Volume Up / Down',
    category: 'Audio & Media',
    description: 'Relatively increases or decreases master volume by step delta (e.g. +10%, -10%).',
    permissionsRequired: ['Audio Control'],
    parameters: [
      { name: 'delta', type: 'number', required: true, description: 'Percentage change, e.g. +10 or -10' }
    ],
    samplePrompts: ['Volume up', 'Make it louder', 'Volume down', 'Softer']
  },
  {
    id: 'browser.wikipedia.search',
    name: 'Wikipedia Search',
    category: 'Browser',
    description: 'Searches encyclopedia articles directly on Wikipedia.',
    permissionsRequired: ['Browser Control'],
    parameters: [
      { name: 'query', type: 'string', required: true, description: 'Search term or topic' }
    ],
    samplePrompts: ['Search Wikipedia for Quantum Computing', 'Who is Alan Turing on Wikipedia']
  },
  {
    id: 'browser.amazon.search',
    name: 'Amazon Search',
    category: 'Browser',
    description: 'Searches for products and shopping items on Amazon.',
    permissionsRequired: ['Browser Control'],
    parameters: [
      { name: 'query', type: 'string', required: true, description: 'Product or item search' }
    ],
    samplePrompts: ['Search Amazon for mechanical keyboards', 'Find wireless earbuds on Amazon']
  },
  {
    id: 'browser.maps.search',
    name: 'Google Maps Search',
    category: 'Browser',
    description: 'Finds locations, restaurants, or directions on Google Maps.',
    permissionsRequired: ['Browser Control'],
    parameters: [
      { name: 'query', type: 'string', required: true, description: 'Location, address, or landmark' }
    ],
    samplePrompts: ['Search maps for nearest coffee shop', 'Show Paris on Google Maps']
  },
  {
    id: 'browser.deepseek.open',
    name: 'Open DeepSeek AI',
    category: 'Browser',
    description: 'Opens DeepSeek reasoning chat.',
    permissionsRequired: ['Browser Control'],
    parameters: [],
    samplePrompts: ['Open DeepSeek', 'Go to DeepSeek']
  },
  {
    id: 'browser.github.open',
    name: 'Open GitHub',
    category: 'Browser',
    description: 'Opens GitHub dashboard and repositories.',
    permissionsRequired: ['Browser Control'],
    parameters: [],
    samplePrompts: ['Open GitHub', 'Go to my repositories']
  },
  {
    id: 'browser.twitch.open',
    name: 'Open Twitch',
    category: 'Browser',
    description: 'Opens Twitch live streaming homepage.',
    permissionsRequired: ['Browser Control'],
    parameters: [],
    samplePrompts: ['Open Twitch', 'Go to Twitch']
  },
  {
    id: 'browser.linkedin.open',
    name: 'Open LinkedIn',
    category: 'Browser',
    description: 'Opens professional feed on LinkedIn.',
    permissionsRequired: ['Browser Control'],
    parameters: [],
    samplePrompts: ['Open LinkedIn']
  },
  {
    id: 'browser.translate.open',
    name: 'Google Translate',
    category: 'Browser',
    description: 'Opens Google Translate tool.',
    permissionsRequired: ['Browser Control'],
    parameters: [],
    samplePrompts: ['Open Google Translate', 'Translate text']
  },
  {
    id: 'win.brightness.set',
    name: 'Set Brightness',
    category: 'System',
    description: 'Adjusts monitor display brightness percentage directly (10% to 100%).',
    permissionsRequired: ['System Settings'],
    parameters: [
      { name: 'level', type: 'number', required: true, description: 'Brightness level from 10 to 100' }
    ],
    samplePrompts: ['Set brightness to 80%', 'Screen brightness 50%', 'Dim brightness to 30%']
  },
  {
    id: 'win.brightness.change',
    name: 'Adjust Brightness Relative',
    category: 'System',
    description: 'Increases or decreases display brightness by a relative delta (e.g. +15%, -15%).',
    permissionsRequired: ['System Settings'],
    parameters: [
      { name: 'delta', type: 'number', required: true, description: 'Relative delta percentage e.g. +15 or -15' }
    ],
    samplePrompts: ['Make screen brighter', 'Make screen darker', 'Dim display', 'Increase brightness']
  },
  {
    id: 'win.clipboard.read',
    name: 'Read Clipboard',
    category: 'System',
    description: 'Reads current text from the Windows system clipboard.',
    permissionsRequired: ['Clipboard'],
    parameters: [],
    samplePrompts: ['What is on my clipboard', 'Read clipboard', 'Show clipboard text']
  },
  {
    id: 'win.clipboard.clear',
    name: 'Clear Clipboard',
    category: 'System',
    description: 'Empties the Windows system clipboard.',
    permissionsRequired: ['Clipboard'],
    parameters: [],
    samplePrompts: ['Clear clipboard', 'Empty clipboard']
  },
  {
    id: 'win.network.ip',
    name: 'Network Status & IP',
    category: 'System',
    description: 'Retrieves current local IP address and Wi-Fi/Ethernet network name.',
    permissionsRequired: ['Network Info'],
    parameters: [],
    samplePrompts: ['What is my IP address', 'Check network connection', 'Wi-Fi status']
  },
  {
    id: 'utility.pomodoro.start',
    name: 'Start Focus / Pomodoro Mode',
    category: 'System',
    description: 'Starts a 25-minute Pomodoro focus session with timer alerts.',
    permissionsRequired: [],
    parameters: [
      { name: 'minutes', type: 'number', required: false, description: 'Duration in minutes (default 25)' }
    ],
    samplePrompts: ['Start pomodoro', 'Start focus mode', 'Set study timer for 25 minutes']
  },
  {
    id: 'utility.notes.add',
    name: 'Quick Note',
    category: 'System',
    description: 'Saves a quick note or reminder to Companio scratchpad.',
    permissionsRequired: [],
    parameters: [
      { name: 'note', type: 'string', required: true, description: 'The text content to save' }
    ],
    samplePrompts: ['Take a note: Buy groceries', 'Remember to email Sarah tomorrow']
  },
  {
    id: 'utility.notes.read',
    name: 'Read Notes',
    category: 'System',
    description: 'Retrieves all saved scratchpad notes.',
    permissionsRequired: [],
    parameters: [],
    samplePrompts: ['Read my notes', 'Show my notes', 'What are my notes']
  },
  {
    id: 'utility.notes.clear',
    name: 'Clear Notes',
    category: 'System',
    description: 'Clears all saved scratchpad notes.',
    permissionsRequired: [],
    parameters: [],
    samplePrompts: ['Clear notes', 'Delete all notes']
  }
];
