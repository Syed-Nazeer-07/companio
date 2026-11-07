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
    description: 'Finds a specific creator or topic on YouTube, locates the newest video/tutorial, and starts playback.',
    permissionsRequired: ['Browser Control', 'DOM Interaction'],
    parameters: [
      { name: 'creator', type: 'string', required: true, description: 'Creator or channel name (e.g. CarryMinati, Bro Code)' },
      { name: 'topic', type: 'string', required: false, description: 'Specific video topic or tutorial name' }
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
  }
];
