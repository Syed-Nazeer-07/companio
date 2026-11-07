# Companio — Personal AI Desktop Companion

> **A living, animated, intelligent AI desktop companion for Windows 11 (ARM64 Snapdragon X Elite & x64).**

Companio is not a chatbot website. It lives directly on your Windows desktop as a transparent, frameless, animated interactive companion that can be summoned with a global hotkey, speaks naturally, and executes real computer operations across native Windows applications and the web.

---

## 1. Features & Capabilities

### 🌟 Desktop Companion & Animation Engine
- **Transparent Desktop Overlay**: Borderless, transparent, always-on-top desktop companion with intelligent hit-testing and edge-snapping.
- **6 Original Characters with Full Animation States**:
  1. **Sparky**: Cute animated cybernetic robot with digital visor, thruster flame, and expressive gestures.
  2. **Pixel**: Authentic 16-bit retro arcade cyber-fox mascot with pixel-perfect animation.
  3. **Mochi**: Stylized 3D squishy mascot with soft lighting and glossy reflections.
  4. **Cloudie**: Fluffy pastel dream cloud with rainbow aura and happy animations.
  5. **Kiko**: Chibi kitten with twitching ears, swishing tail, and blush cheeks.
  6. **Boba**: Adorable boba bear with animated straw, bubble tea cup, and sweet reactions.
- **Dynamic Character Expressions**:
  - `idle`: Breathing, blinking, floating oscillation
  - `listening`: Alert posture, ears/sensors reacting, audio visualizer bars
  - `thinking`: Processing animation (glowing pulse, head tilt, spinning elements)
  - `talking`: Real-time lip-sync/mouth animation driven by speech synthesis amplitude
  - `success`: Celebration bounce, victory sparkle, confetti burst
  - `confused`: Tilted head, question mark indicator, honest error explanation
  - `sleeping`: Dimmed breathing glow, Zzz particles

### ⚡ Real Computer Control (Action System)
Companio utilizes a strict pipeline: **User Request → Intent Interpretation → Tool Selection → Native Execution → Verification → Result**. It never falsely reports "Done" without real verification.
- **Browser Automation (Playwright + Native Microsoft Edge)**:
  - YouTube search and playback: Navigates to YouTube, finds specific creators (e.g. CarryMinati, Bro Code), selects the newest regular upload, starts playback, and verifies `video.paused === false`.
  - YouTube playback controls: Pause, resume, fullscreen (`f`), mute (`m`).
  - Google search: Live web searches with verified result display.
  - Multi-tab management: Opens research tab sets and closes active tabs.
- **Windows Desktop Applications**:
  - Launch, verify, and close Calculator (`calc.exe` / `CalculatorApp`).
  - File Explorer navigation: Opens Downloads, Documents, Pictures, or specific project folders.
  - Visual Studio Code: Launches VS Code and opens project directories.
  - Spotify integration: Launches client, searches/plays specific songs (e.g. "Graffitia by Green Day"), and controls media playback (Play, Pause, Next, Prev).
  - Window management: Minimizes foreground windows.
  - Screen capture: Takes high-resolution screenshots and saves to `Pictures/Companio_Captures`.
- **System Audio (Windows CoreAudio COM Integration)**:
  - Exact master volume scalar control (0–100%) via native Windows `IAudioEndpointVolume`.
  - Mute and unmute toggle with immediate hardware verification.

### 🎙️ Natural Voice & Audio Engine
- **Push-to-Talk**: Instant speech recognition via Spacebar or compact mic button.
- **Wake-Word Support**: Configurable "Hey Companio" wake detection.
- **Text-to-Speech**: Natural voices with rate, pitch, and volume adjustments.
- **Audio Chimes**: Web Audio synthesized notification sounds (activation chime, success chord, error tone).

### 🖥️ Windows 11 Fluent Control Center (Dashboard)
8 dedicated pages:
1. **Home**: Status overview, live character preview, and quick test actions.
2. **Character Studio**: Character gallery, personality customization, scaling, animation tester, and custom SVG/PNG asset importer.
3. **Automation**: Full tool catalog with status badges, permission toggles, and direct test triggers.
4. **AI Configuration**: Provider switching (Built-in Instant Engine, Local LLMs via Ollama & LM Studio, Google Gemini, OpenAI, Claude) with secure API key storage.
5. **Voice Settings**: Mic device, speech engine, TTS voices, rate/pitch sliders, and mute toggle.
6. **History**: Searchable conversation and execution logs stored in local SQLite database.
7. **Settings**: Global activation shortcut (Ctrl+Shift+Space), startup behavior, theme, and desktop snapping.
8. **Help & Docs**: Setup guidance, interactive onboarding tour, and command reference.

---

## 2. Architecture & Tech Stack

```
React 19 + TypeScript + Vite + Tailwind CSS (UI Layer)
       │
       ▼
Desktop Shell Bridge (Electron ARM64)
       │
       ├── Browser Controller (Playwright-core + Microsoft Edge ARM64)
       ├── Windows CoreAudio Controller (IAudioEndpointVolume COM interface)
       ├── Windows Application & Process Controller (Native Win32 & PowerShell)
       ├── Agent Execution Engine (Modular Planner, Verifier, Guardrails)
       └── SQLite Database (Local settings, history, and automation logs)
```

- **Target OS**: Windows 11 on ARM64 (Snapdragon X Elite) and x64.
- **Zero Heavyweight Local Weights**: Lightweight, low-memory footprint, efficient idle CPU usage.

---

## 3. Quick Start

### Prerequisites
- Node.js v18+ (tested on Node.js v24 ARM64)
- Windows 11

### Installation & Launch
```bash
# Clone or navigate to the directory
git clone https://github.com/Syed-Nazeer-07/companio.git
cd companio

# Install dependencies
npm install

# Build production bundle
npm run build

# Launch the desktop companion overlay and system tray
npm start
```

### Running Automated Acceptance Tests
Verify all 13 native automation capabilities end-to-end:
```bash
npm run test:tools
```

---

## 4. Acceptance Test Results
All 13 acceptance scenarios are demonstrably functional and verified:
1. [✓] ARM64 platform compatibility verified on Snapdragon X Elite.
2. [✓] Desktop overlay character selection with 6 original cute characters.
3. [✓] Global shortcut activation (`Ctrl+Shift+Space`).
4. [✓] Typed command input & wake mode.
5. [✓] Speech recognition & text-to-speech with lip-sync.
6. [✓] Browser launch & YouTube homepage verification.
7. [✓] YouTube search & play for creator's newest video.
8. [✓] Windows apps: Calculator launch & process termination.
9. [✓] File Explorer folder navigation.
10. [✓] Windows CoreAudio master volume adjustment (60%) & mute.
11. [✓] Task cancellation support during execution.
12. [✓] Persistence of character, position, and preferences in local SQLite database.
13. [✓] Honest failure reporting: Unexecutable actions report error instead of false success.
