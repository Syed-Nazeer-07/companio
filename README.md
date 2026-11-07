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
| “Open Notepad and set volume to 45%” | Offline two-step workflow; requires approval |
| “Open YouTube and search Google for Python tutorials” | Offline browser workflow; requires approval |

**Scope matters:** the built-in planner recognizes specific patterns and a small set of two- and three-step workflows, not every possible natural-language request. YouTube search results may not be the creator's newest upload; site layouts and browser state can affect automation.

### 🎛️ Control Center

Companio has eight primary sections: **Home**, **Character Studio**, **Automation & Tools**, **AI Configuration**, **Voice Settings**, **History**, **Settings**, and **Help & Docs**.

## 🧠 Assistant Modes

| Mode | API key required? | Current behavior |
| --- | --- | --- |
| **Built-in Instant Engine** | **No** | Rule-based commands and a limited set of offline multi-step workflows |
| **Local LLM (experimental)** | **No paid cloud key** | Conversations and proposals for up to three allowlisted desktop/browser actions through a separately running Ollama or LM Studio server |
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

### Local AI integration status

This preview adds a **single validated local AI path** for Ollama and LM Studio, local server/model selection, a test prompt, explicit connection failures, and conversation/error history. The app bundles SQLite's WebAssembly asset instead of fetching it from a CDN. The incomplete cloud-provider option is disabled rather than collecting new API keys.

**What this does not provide:** a built-in inference runtime, guaranteed ARM64 model performance, free-form system automation from AI-generated commands, code signing, or real-device acceptance testing.

## 🧰 Technology Stack

| Layer | Technology | Role |
| --- | --- | --- |
| **Desktop** | Electron, Node.js | Windows overlay, tray, global shortcut, and IPC |
| **Frontend** | React 19, TypeScript, Vite | Control Center and companion interface |
| **Design** | Tailwind CSS, Framer Motion, SVG/CSS | Styling, character rendering, animations |
| **Web tools** | Playwright Core, Microsoft Edge | Browser navigation and supported web actions |
| **System tools** | Node.js, PowerShell, Windows APIs | Application launching, system controls, screenshots |
| **Speech** | Windows System.Speech + Web Speech APIs | One-shot native STT, browser fallback in web preview, system text-to-speech |
| **Storage** | Electron user-data JSON, localStorage, sql.js | Atomic native history file, browser cache, and experimental in-memory SQL |
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

The repository includes [`release.yml`](.github/workflows/release.yml), which is configured to build Windows x64/ARM64 artifacts when a `v*` tag is pushed, then publish a GitHub Release. The existing [v1.0.0 release](https://github.com/Syed-Nazeer-07/companio/releases/tag/v1.0.0) was built **before Phase 1**. The **v1.1.0-rc.7** candidate produces separate unsigned x64 and ARM64 CI artifacts only after its Windows checks pass; these are not public signed releases. View [Actions](https://github.com/Syed-Nazeer-07/companio/actions/workflows/ci.yml), open the matching successful release-candidate workflow run, and download your architecture's artifact. Artifacts expire after 14 days. They contain installers, portable executables, and SHA-256 checksums. Tagged releases also require a matching package version and passing x64 desktop smoke test. Workflow presence does **not** guarantee that a particular release build has passed or that an installer has been published.

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
- **Local history:** in the installed Electron app, conversations, automation logs, and notes are kept in an **atomic JSON file inside the Windows application-data directory**, with localStorage as the synchronous UI cache. Older browser-stored history is migrated once when no native file exists. Browser-only preview uses localStorage. The bundled `sql.js` database remains **in memory**; this is *not* durable SQLite.
- **Backup/restore:** the History page can export a JSON copy and, in the installed desktop app, validate and restore exported history backups up to 8 MiB. Restore previews counts and requires confirmation because it **replaces** current conversations, logs, and notes. Only the backup history sections are accepted; app settings and API keys are never imported. Imported executable task plans are discarded. Both the native history file and exported backups are **unencrypted** and may contain personal information; protect them like any other private document.
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

### Approval-first desktop workflows

This candidate adds strict model-generated 1–3 action proposals, **offline multi-step phrases without an LLM**, trusted Electron validation, and confirmation with the exact command parameters before execution. A packaged smoke test verifies a benign plan and rejection of a destructive plan without triggering either action. Quick Controls no longer equate attempted actions with verified success, and the Control Center can restore a previously hidden overlay.

**Preview caveat:** supported tool launchers still require verification on an interactive Windows device. An AI plan is not autonomous unrestricted PC control; a separate Ollama/LM Studio runtime is needed for model-guided planning.

## 🎙️ Voice reliability, safer commands and local action approval

Companio now handles speech and automation more conservatively:

- **Windows voice:** one spoken request at a time, with bounded recognition duration, cancellation, hidden PowerShell process and explicit missing-microphone/engine errors. Cancelling or dismissing the overlay discards any late transcript. This still depends on the **installed Windows speech engine** and its available language support; it is **not** an always-on wake-word system.
- **Browser preview:** speech input can use browser recognition, which may use the browser vendor's network service. Companio does not claim this mode is fully offline.
- **Spoken replies:** selecting a companion changes the base voice profile; user settings fine-tune the pitch and speed. Muting and stopping speaking settle the UI instead of simulating a successful audio start.
- **Command intent:** casual remarks and informational questions about apps no longer launch them just because their names are mentioned. Relative volume requests use measured changes instead of silently guessing a fixed number; unclear volume amounts fail safely.
- **Review before actions:** local model proposals and supported multi-step commands display each validated tool and argument in a compact dialog. Run is a separate button; Escape, Close or Cancel execute **zero** actions.
- **YouTube latest:** a newest-video request attempts to match the actual creator channel and select YouTube's Latest uploads tab. If identity/sort/playback cannot be verified, it reports a failure rather than playing an unrelated search result. Real YouTube DOM and account-specific behavior still need testing.
- **Settings → Device diagnostics:** read-only reports for Windows architecture, shortcut registration, native history availability and system audio state. It never records audio or sends desktop commands.

### Windows ARM64 acceptance checklist

These are **manual tests required on a real Windows ARM64 machine**, not claims about CI:

1. Install the latest unsigned ARM64 preview. Open **Settings → Device diagnostics**, verify `arm64`, the global shortcut and the history snapshot.
2. Open **Voice Settings → Test Mic**, stop it, and confirm Windows no longer indicates recording. Test spoken replies; try the voice button and confirm silence/cancellation exits listening state.
3. Say or type `Open Notepad`; confirm the intended app opens. Ask `What is Notepad?` and confirm it does **not** launch an app.
4. Request `Open Notepad and set volume to 45%`; inspect the proposed tools, press **Cancel**, and confirm no action is executed. Repeat with **Run** only if you want those changes.
5. Add notes and messages, restart Companio, and confirm history persists. Export history, restore it, and confirm settings are unaffected.
6. Try `Play the latest video from CarryMinati`. If channel lookup or playback fails, report the actual error; do not interpret a first search hit as a newest upload.
7. Configure a running Ollama or LM Studio model, select it in AI Settings, and test a conversational question plus a supported AI-planned action.
8. Repeat the essential tests on Windows x64. Check startup time, crashes, memory usage and microphone behavior across several launches.

**Production blockers:** an easy bundled local inference runtime, sustained ARM64 speech/browser reliability, signed installers, updates and actual unattended/crash-recovery testing are still pending. Passing CI is not a production readiness certification.

## 🧩 Phase 3: Bounded, approval-first workflows

Two styles of multi-step planning are available in the **installed desktop app**:

1. **Offline built-in chaining:** fixed, familiar phrases such as `Open Notepad and set volume to 45%` are parsed without a local AI runtime or cloud key.
2. **Local AI action proposals:** when local inference is configured, unrecognized explicitly requested actions can be proposed by the model. The Electron main process rejects malformed steps, unsupported tools, unexpected parameters, and dangerous capabilities.

Both paths support **at most three actions**, require an explicit user confirmation that displays each tool and its arguments, and execute steps through the existing native validation layer. If a step fails or its outcome cannot be verified, subsequent steps do not execute. Canceling a proposal runs **zero actions**.

**Not supported:** autonomous screen-reading agents, arbitrary shell commands, unrestricted filesystem access, sending messages, automatic interaction with unrelated apps, or assurance that every Windows/media action is independently verifiable. The model is not allowed to invent executable tools. Desktop commands still require real-machine acceptance testing.

The Phase 3 baseline is protected by [`rollback/pre-phase3-2026-11-08`](https://github.com/Syed-Nazeer-07/companio/tree/rollback/pre-phase3-2026-11-08).

### Windows action verification

This Windows preview addresses false-success reporting in volume/mute controls, process launches, File Explorer folders, clipboard clear, screenshot PNG creation, network/system checks, and browser navigation. It also runs the PowerShell command helper without displaying a separate foreground console. New regression tests cover unavailable system services, unsupported actions, and wrong website destinations.

**Known constraints:** a running process does not prove a window gained focus; HTTP navigation verification does not prove the requested content was displayed or interacted with; and some operating-system URI handlers remain unverified. The current media control and active-window minimize limitations are described below. Windows ARM64 builds are CI-packaged but not hardware acceptance tested.

### Native history recovery

This candidate introduces on-disk Windows history snapshots, one-time migration from older browser storage, schema-validated backup import, and rollback when restore cannot be completed. The bundled SQL.js database remains in-memory; the new persistent history format is **JSON, not SQLite**. Secure import and disk hydration are covered by unit tests and packaged Electron smoke checks.

**Hardware limitations:** the unsigned ARM64/x64 preview is CI-tested, but persistent file permissions, recovery from interrupted writes, multi-window behavior, and startup on a real ARM64 PC still require acceptance testing.

## 💾 History persistence and recovery

Companio's installed Windows app mirrors recent history to `companio_history_v1.json` in Electron's user-data directory, using a temporary file and rename to avoid partially written snapshots. Each native write is validated before it replaces the last stored version. Invalid or corrupted history is **not** silently overwritten.

To keep a manual copy, open **Control Center → History → Export History**. To recover it, use **Restore History**, select the exported JSON, review the displayed counts, and confirm. The application restores the conversations, automation logs, and notes only; it doesn't overwrite your character, hotkeys, AI settings, or provider keys. A failed restore attempts to roll back browser-storage writes, and a native disk failure is shown rather than reported as a successful restore.

If native persistence fails, History shows a warning and a **Retry disk sync** option. Export your current history before restarting if you see that warning. Native file persistence, encryption, multi-window conflict handling, and interrupted-write recovery still need device-level acceptance testing.

Rollback before this work: [`rollback/pre-history-restore-2026-11-08`](https://github.com/Syed-Nazeer-07/companio/tree/rollback/pre-history-restore-2026-11-08).

## 🛡️ Native outcome verification

Companio distinguishes **command attempted**, **process/page observed**, and **verified result**. A successful PowerShell launch or Playwright navigation is not treated as proof that the requested app or page is ready.

- **Windows audio:** readback verifies volume and mute; an unavailable audio endpoint is reported as an error, never as an invented 50% reading.
- **Apps:** Notepad, Paint, Task Manager, Command Prompt, PowerShell, Edge, and Chrome are checked for the expected running process. VS Code and Spotify include separate process checks. A running process is **not** proof that a window gained focus.
- **File Explorer:** named folders must exist, and Companio attempts to confirm the actual Explorer window location. Opening Explorer without a specified folder no longer silently opens Downloads.
- **System tools:** screenshot output must exist and have a PNG signature; clipboard-clear uses a readback; network status requires a reported IPv4 address; missing battery information is not interpreted as charging.
- **Browser:** navigation requires a successful HTTP response and an expected destination; redirects and wrong-page outcomes are reported instead of hidden.
- **Background execution:** the native PowerShell helper hides its console window, reducing interruption to the active app.

**Deliberate limitations:** generic Windows media play/pause buttons are toggles, so Companio refuses to claim they can force a specific state without readable media-session state. A media-key press does not prove playback changed. The old Alt+N minimize shortcut was disabled because it could send keys to the wrong application. Some Windows protocol launches and UI state changes still cannot be independently verified. These require actual interactive Windows testing before a production claim.

Rollback point: [`rollback/pre-native-verification-2026-11-08`](https://github.com/Syed-Nazeer-07/companio/tree/rollback/pre-native-verification-2026-11-08).

## 🛠️ Phase 1 Hardening

The `main` branch now includes trusted-window IPC guards, validated tool inputs, safer PowerShell handling, narrower Electron permissions, and confirmation before Recycle Bin deletion. Browser preview no longer fabricates native successes; YouTube and tab actions have stricter verification.

Shortcut changes are applied to the native global hotkey, always-on-top and edge snapping are wired to Electron, and resetting preferences keeps saved notes and history. Unsupported fullscreen-game auto-hide is labeled accordingly.

The prior state is preserved in [`rollback/pre-phase1-2026-11-07`](https://github.com/Syed-Nazeer-07/companio/tree/rollback/pre-phase1-2026-11-07). The pre-local-AI baseline is additionally saved as [`rollback/pre-local-ai-2026-11-08`](https://github.com/Syed-Nazeer-07/companio/tree/rollback/pre-local-ai-2026-11-08).

**Not yet verified:** real-device microphone permission behavior, YouTube site changes, interactive Windows automation, model downloads, and ARM64 installer runtime compatibility.

## ⚠️ Known Limitations

- Supported commands include limited offline sequences and local AI proposals (up to three actions, always approved). Arbitrary multi-application computer use is not supported.
- YouTube and other browser workflows depend on external page structures and may break.
- Several native app protocols and global media/window controls still lack reliable end-state verification; unsupported play/pause and active-window minimization fail rather than falsely reporting success.
- Browser-only preview cannot verify Windows tools or YouTube playback and no longer claims simulated success.
- Voice input and speech output depend on runtime/device support; there is no true always-listening hotword service.
- Ollama/LM Studio connection and conversation are integrated, but a separate local server and loaded model are required. Downloaded GGUF files are not integrated with a bundled inference engine.
- OpenAI/Gemini provider activation is disabled until end-to-end cloud reasoning and safe key storage are implemented.
- History is stored in a native JSON file and can be exported/restored in the desktop app, but the optional SQL.js cache is still in memory, and there is no encrypted storage or durable SQLite database yet.
- Installer targets and a release workflow exist, but code signing, auto-updates, and device-wide acceptance testing are outstanding.

## 🗺️ Roadmap

- [x] Add verified Windows audio, app-process, File Explorer, screenshot, clipboard and browser checks
- [ ] Continue validating unverified native actions and improve failure feedback on real devices
- [x] Add allowlisted, confirmation-first local AI proposals and basic offline command chains
- [ ] Expand natural-language coverage and independently verify additional native actions on Windows devices
- [x] Integrate validated local chat/model discovery for Ollama and LM Studio
- [ ] Bundle an inference runtime and activate downloaded GGUF files safely
- [ ] Finish optional cloud-provider integrations with secure key handling
- [x] Add explicit multi-action approval UI and a command-versus-question safety guard
- [ ] Expand browser automation coverage and validate YouTube latest-creator behavior on real sites
- [x] Add native JSON history persistence, localStorage migration, and validated export/restore
- [ ] Evaluate durable SQLite and optional encrypted history storage; test crash recovery on real devices
- [x] Fix cancellable one-shot native speech, mic cleanup and animated TTS completion
- [ ] Validate microphone recognition on real ARM64 hardware and improve voice activation
- [x] Add packaged Electron smoke coverage and a read-only Device Diagnostics panel
- [ ] Test Windows x64 and ARM64 installers on physical devices; add code signing and updates
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
