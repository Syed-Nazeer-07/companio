<div align="center">

# ✨ Companio

### Your desktop. Your companion.

**Meet an animated desktop assistant that brings character, voice, and practical automation to Windows.**

Choose your companion, summon it with a shortcut, and ask it to open apps, navigate the web, control media, or handle supported everyday tasks — without needing a paid AI API key for the built-in commands.

[![Electron](https://img.shields.io/badge/Electron-47848F?style=for-the-badge&logo=electron&logoColor=white)](https://www.electronjs.org/)
[![React](https://img.shields.io/badge/React_19-149ECA?style=for-the-badge&logo=react&logoColor=white)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![Windows 11](https://img.shields.io/badge/Windows_11-0078D4?style=for-the-badge&logo=windows11&logoColor=white)](https://www.microsoft.com/windows)

[Features](#-features) · [How It Works](#-how-it-works) · [Quick Start](#-quick-start) · [AI Modes](#-assistant-modes) · [Architecture](#-architecture) · [Roadmap](#-roadmap)

</div>

---

> **Project status: active desktop prototype.** Companio includes an Electron app, native Windows automation handlers, packaging scripts, and a GitHub Actions release workflow. These are **implemented in source**, but a signed, thoroughly tested public release and reliable operation across Windows devices are **not yet verified**. Native automation requires the Electron app; the web-only preview is not a substitute.

## 📌 Overview

**Companio** is a Windows desktop companion that combines a playful, customizable character with useful computer controls. Instead of opening a separate assistant website to perform a simple action, you can summon Companio over your desktop, type or speak a supported request, and see it attempt the task.

The goal is simple: **make desktop interaction feel more natural while keeping the interface lightweight.**

Companio is built around three ideas:

- **A companion, not another dashboard:** expressive characters and a compact, always-on-top overlay.
- **Actions, not just answers:** commands routed to browser and Windows automation tools.
- **Choice without mandatory API costs:** a built-in rule-based engine, plus experimental local-model options.

## ✨ Features

| Capability | What Companio provides |
| --- | --- |
| **Floating desktop companion** | A transparent, frameless, movable Electron overlay with an always-on-top character |
| **Global shortcut** | Press **Ctrl + Shift + Space** by default, or save a different supported shortcut in Settings |
| **Character Studio** | Select from six companions, customize their presentation, and preview expressions |
| **Voice and text** | Enter commands by keyboard or use supported speech recognition and spoken replies |
| **Windows actions** | Open supported desktop apps, folders, and utilities; control master volume; take screenshots |
| **Browser automation** | Open websites, perform searches, manage supported tabs, and attempt YouTube playback actions |
| **Control Center** | Manage characters, commands, AI configuration, voice, settings, and local activity history |
| **Local-first commands** | Execute predefined commands without signing up for a cloud AI service or purchasing an API key |

### 🧸 Choose your companion

| Character | Style |
| --- | --- |
| **Sparky** | Expressive futuristic robot |
| **Pixel** | Playful pixel-art fox |
| **Mochi** | Soft, squishy mascot |
| **Cloudie** | Dreamy pastel cloud |
| **Kiko** | Chibi kitten |
| **Boba** | Bubble-tea-inspired bear |

Characters react with visual states such as **idle, listening, thinking, talking, success, and sleep**. Character Studio also includes experimental SVG/PNG import.

### 🖥️ Desktop presence

Companio starts with a floating character overlay and can open a separate **Control Center**. You can move the overlay, retain its position, summon it with the keyboard shortcut, and access controls from the Windows system tray.

### 🎙️ Voice interaction

Companio uses available **Web Speech APIs** for speech recognition and synthesis, with controls for voice, speaking rate, pitch, and volume. Microphone support varies by Windows configuration and Electron runtime. The wake-phrase setting is **not** a continuously listening system-wide hotword detector, and lip movement is approximate rather than phoneme-accurate.

## 🧭 How It Works

1. **Launch Companio** on Windows and complete the initial character/setup flow.
2. **Press Ctrl + Shift + Space** to activate the floating companion.
3. **Speak or type** a supported request.
4. **Review the result:** the command planner chooses a known tool, the Electron bridge sends it to a Windows/browser handler, and the interface displays feedback.
5. **Adjust preferences** in the Control Center or review activity in History.

### 💬 Example commands

| Try saying | Intended action |
| --- | --- |
| “Open Calculator” | Launch Windows Calculator |
| “Open my Downloads folder” | Open File Explorer at Downloads |
| “Search Google for Python tutorials” | Search in the browser |
| “Open YouTube” | Open YouTube in the controlled browser |
| “Play a video from CarryMinati” | Search YouTube and attempt to open/play a matching result |
| “Set the volume to 60%” | Change Windows master volume |
| “Take a screenshot” | Capture a desktop screenshot |
| “Open VS Code” | Launch Visual Studio Code, if installed |

**Scope matters:** the built-in planner recognizes specific patterns, not every possible natural-language request. YouTube search results may not be the creator's newest upload; site layouts and browser state can affect automation.

### 🎛️ Control Center

Companio has eight primary sections: **Home**, **Character Studio**, **Automation & Tools**, **AI Configuration**, **Voice Settings**, **History**, **Settings**, and **Help & Docs**.

## 🧠 Assistant Modes

| Mode | API key required? | Current behavior |
| --- | --- | --- |
| **Built-in Instant Engine** | **No** | Rule-based command recognition and supported automation tools |
| **Local LLM (experimental)** | **No paid cloud key** | Conversations through a locally running Ollama or LM Studio server, with an explicit connection check and error reporting |
| **OpenAI / Gemini options** | Not applicable yet | Unfinished and disabled in the UI; previously saved keys can be removed from AI Settings |

**Built-in does not mean a general-purpose LLM.** Basic local commands do not need an AI subscription, although web searches and browser interactions still require connectivity.

For optional local conversations, run [Ollama](https://ollama.com/) and install a compatible model, for example:

```powershell
ollama run llama3.2
```

Then open **AI Configuration → Local Offline LLM**, enter the local server URL and model name, select **Check Connection**, and try the live prompt. Companio uses the same connection for the test and for ordinary assistant conversations:

- **Ollama:** `http://127.0.0.1:11434/v1` (default).
- **LM Studio:** `http://127.0.0.1:1234/v1` (start its local server and load a model first).

The local requests run through validated Electron IPC, not browser CORS, and only HTTP loopback endpoints are allowed. A failed connection produces a visible error rather than a fake reply. **This adds conversational reasoning, not free-form Windows computer control:** desktop actions still use the predefined, validated command planner. The local server and model must be installed and running independently. When selected, local inference does not require a cloud API key.

The SQLite WebAssembly runtime is now bundled with the desktop assets rather than fetched from a CDN. Conversation history remains stored in local storage; SQLite is still an in-memory prototype.

The app also includes an **in-app GGUF model downloader**. Downloaded files are **not activated** without a separate inference runtime. New downloads check expected byte counts and write a completion marker; models downloaded with older builds may need downloading again to be recognized. Cryptographic signature validation is not yet available.

## 🧰 Technology Stack

| Layer | Technology | Role |
| --- | --- | --- |
| **Desktop** | Electron, Node.js | Windows overlay, tray, global shortcut, and IPC |
| **Frontend** | React 19, TypeScript, Vite | Control Center and companion interface |
| **Design** | Tailwind CSS, Framer Motion, SVG/CSS | Styling, character rendering, animations |
| **Web tools** | Playwright Core, Microsoft Edge | Browser navigation and supported web actions |
| **System tools** | Node.js, PowerShell, Windows APIs | Application launching, system controls, screenshots |
| **Speech** | Web Speech APIs | Voice input and spoken output |
| **Storage** | localStorage, sql.js | Local preferences/history and experimental in-memory SQL |
| **Alternative prototype** | Tauri / Rust source | Experimental shell, not the main release path |

## 🏗️ Architecture

```text
                 USER
              Voice / text
                   │
                   ▼
        React companion overlay
                   │
                   ▼
          Command / intent planner
                   │
         Desktop bridge + IPC
                   │
         ┌─────────┼──────────┐
         ▼         ▼          ▼
     Browser    Windows     System
    automation   apps       controls
         └─────────┼──────────┘
                   ▼
           Feedback + history
                   │
             localStorage

Optional local LLM: conversational path via Ollama-compatible API
```

**Desktop versus web preview:** the normal browser preview cannot invoke Electron's native Windows handlers. The browser preview does **not** mark simulated native actions as successful or verified. Use the **Electron desktop application** for meaningful automation tests.

## 🚀 Quick Start

### Prerequisites

- **Windows 11**
- **Node.js LTS** and npm (Node.js 22 is used in the release workflow)
- Git
- **Microsoft Edge** for the preferred Playwright automation path
- Optional: microphone for voice commands; Ollama for local-model conversations

Companio has packaging targets for **Windows x64** and **Windows ARM64**. Both CPU architectures pass CI packaging checks, but real-device functionality still needs verification, especially on Windows on ARM.

### 1. Clone and install

```powershell
git clone https://github.com/Syed-Nazeer-07/companio.git
cd companio
npm ci
```

### 2. Build and launch the desktop app

```powershell
npm run build
npm start
```

This builds the Vite frontend into `dist/` and launches the Electron desktop app. Complete the first-run setup from the Control Center.

### 3. Develop locally

For a fast **UI-only preview**:

```powershell
npm run dev
```

To work on the actual desktop app with the Vite development server, open **two PowerShell terminals** in the project directory.

**Terminal 1:**

```powershell
npm run dev
```

**Terminal 2:**

```powershell
$env:NODE_ENV = "development"
npm start
```

You can also try `npm run dev:all`, but separate terminals make startup and debugging easier. The UI-only preview may simulate native commands.

### 4. Package Windows executables

```powershell
npm run dist          # Windows installer + portable target
npm run dist:x64      # x64 Windows build
npm run dist:arm64    # ARM64 Windows build
npm run dist:portable # Portable Windows target
```

Electron Builder writes the output under `release/`. Generated filenames depend on the chosen target, architecture, and package version. **A generated executable is not the same as a signed or independently validated release.**

### 5. GitHub Releases

The repository includes [`release.yml`](.github/workflows/release.yml), which is configured to build Windows x64/ARM64 artifacts when a `v*` tag is pushed, then publish a GitHub Release. The existing [v1.0.0 release](https://github.com/Syed-Nazeer-07/companio/releases/tag/v1.0.0) was built **before Phase 1**. The **v1.1.0-rc.3** candidate produces separate unsigned x64 and ARM64 CI artifacts only after its Windows checks pass; these are not public signed releases. View [Actions](https://github.com/Syed-Nazeer-07/companio/actions/workflows/ci.yml), open the matching successful release-candidate workflow run, and download your architecture's artifact. Artifacts expire after 14 days. They contain installers, portable executables, and SHA-256 checksums. Tagged releases also require a matching package version and passing x64 desktop smoke test. Workflow presence does **not** guarantee that a particular release build has passed or that an installer has been published.

## 📁 Project Structure

```text
companio/
├── electron/
│   ├── main.cjs                # Electron windows, shortcuts, tray, IPC
│   ├── preload.cjs             # Renderer-to-native bridge
│   └── automation/             # Browser, Windows, volume and model tools
├── src/
│   ├── components/
│   │   ├── characters/         # Companion visuals
│   │   ├── dashboard/          # Eight Control Center sections
│   │   ├── onboarding/         # First-run setup
│   │   └── overlay/            # Floating assistant
│   ├── services/               # Planner, speech, bridge and local data
│   ├── types/
│   └── App.tsx
├── src-tauri/                  # Experimental alternate shell
├── test/
│   └── test-automation.cjs     # Native automation scenarios
├── .github/workflows/
│   ├── ci.yml                  # Windows build and unit checks
│   └── release.yml             # Windows packaging workflow
├── package.json
└── README.md
```

## 🔒 Privacy & Security

Companio runs locally for its built-in command processing, but it can interact with your desktop, browser, microphone, and local files. Treat automation as **powerful software with real permissions**.

- **No mandatory paid AI API key:** the predefined command planner does not require one.
- **Local history:** preferences, conversation messages, notes, and tool logs are stored using browser/Electron local storage. The bundled `sql.js` database is initialized in memory, **not saved as a durable SQLite file**. The History page can export conversations, automation logs, and notes to JSON without including the API-key settings; import is not yet supported. Exported logs may still contain personal information.
- **API key caution:** cloud providers are disabled until genuinely implemented. Older provider keys may still exist in legacy local settings; remove them in AI Settings. Local application preferences are **not a secure secrets vault**.
- **Permissions:** IPC is restricted to trusted app windows; microphone requests are audio-only, while camera/USB/accessibility permissions are not auto-granted. Real-device permission testing is still required.
- **Tool effects:** commands can change system settings, open websites, capture screenshots, or act on existing windows. Run them only on a device you control.

There is currently no claim of a hardened security sandbox, independent security audit, or production-grade credential protection.

## 🧪 Testing

Run native-input security regression tests and build TypeScript/UI:

```powershell
npm run test:unit
npm run build
```

The [CI workflow](.github/workflows/ci.yml) runs security regression tests, a high-severity dependency audit, the TypeScript/Vite build, packages a Windows x64 app, and executes an app-startup smoke test that checks React, Electron preload, invalid native IPC rejection, and shortcut input activation. Packaging both architectures is verified on release-candidate pushes. These checks do **not** demonstrate real voice recognition, web playback, or native automation on consumer devices.

Run native automation scenarios on a **Windows test machine**:

```powershell
npm run test:tools
```

**Note:** the automation test script may open browsers and applications, change/mute system audio, and create screenshots. Run it interactively, where those side effects are acceptable.

Automated Windows CI covers TypeScript compilation, native-input and permission validation, and packaged Electron startup/input. Full desktop automation integration tests require an interactive Windows test machine and have not been verified across x64 and ARM64.

## 🛡️ Security & release-candidate status

- **Electron:** upgraded to 45.2.3. The latest tested dependency audit has **0 high/critical advisories** and **6 moderate** advisories in the packaging dependency chain.
- **Tested:** security and shortcut unit suites, TypeScript build, and packaged Windows x64 app smoke checks. Windows x64 and ARM64 packages build successfully in CI.
- **Not tested:** real user desktop sessions, sustained voice input, arbitrary app control, actual browser/media playback, or code signing. Avoid entering production cloud API keys.

## 🛠️ Phase 1 Hardening

The `main` branch now includes trusted-window IPC guards, validated tool inputs, safer PowerShell handling, narrower Electron permissions, and confirmation before Recycle Bin deletion. Browser preview no longer fabricates native successes; YouTube and tab actions have stricter verification.

Shortcut changes are applied to the native global hotkey, always-on-top and edge snapping are wired to Electron, and resetting preferences keeps saved notes and history. Unsupported fullscreen-game auto-hide is labeled accordingly.

The prior state is preserved in [`rollback/pre-phase1-2026-11-07`](https://github.com/Syed-Nazeer-07/companio/tree/rollback/pre-phase1-2026-11-07). The pre-local-AI baseline is additionally saved as [`rollback/pre-local-ai-2026-11-08`](https://github.com/Syed-Nazeer-07/companio/tree/rollback/pre-local-ai-2026-11-08).

**Not yet verified:** real-device microphone permission behavior, YouTube site changes, interactive Windows automation, model downloads, and ARM64 installer runtime compatibility.

## ⚠️ Known Limitations

- Commands are pattern-matched; arbitrary multi-application computer use is not supported.
- YouTube and other browser workflows depend on external page structures and may break.
- Browser-only preview cannot verify Windows tools or YouTube playback and no longer claims simulated success.
- Voice input and speech output depend on runtime/device support; there is no true always-listening hotword service.
- Ollama/LM Studio connection and conversation are integrated, but a separate local server and loaded model are required. Downloaded GGUF files are not integrated with a bundled inference engine.
- OpenAI/Gemini provider activation is disabled until end-to-end cloud reasoning and safe key storage are implemented.
- History can be exported as local JSON, but import/restore and a durable SQLite database are not yet supported.
- Installer targets and a release workflow exist, but code signing, auto-updates, and device-wide acceptance testing are outstanding.

## 🗺️ Roadmap

- [ ] Verify actual tool outcomes and improve failure feedback
- [ ] Expand robust, natural-language command handling and multi-step execution
- [x] Integrate validated local chat/model discovery for Ollama and LM Studio
- [ ] Bundle an inference runtime and activate downloaded GGUF files safely
- [ ] Finish optional cloud-provider integrations with secure key handling
- [ ] Strengthen browser automation, permissions, and sensitive-action safeguards
- [ ] Add durable SQLite storage and JSON import/restore (history export is available)
- [ ] Improve speech recognition, activation, and character synchronization
- [ ] Test Windows x64 and ARM64 installers; add code signing and update support
- [ ] Introduce CI quality gates, automated UI coverage, and accessibility checks

## 🎯 Design Philosophy

**Personal, not intrusive.** A character should be pleasant when present and easy to dismiss.

**Simple on the surface.** Keep the desktop experience focused, with richer controls available in the Control Center.

**Useful without subscriptions.** Everyday actions should work without requiring a paid API key.

**Trust through clarity.** Show what an action attempted, what succeeded, and what still needs attention.

## 👨‍💻 Author

**Syed Nazeer S**

- GitHub: [@Syed-Nazeer-07](https://github.com/Syed-Nazeer-07)
- Project: [Companio](https://github.com/Syed-Nazeer-07/companio)

---

<div align="center">

### ✨ A little personality for your desktop.

<sub>Built to make everyday computing more expressive, approachable, and practical.</sub>

</div>
