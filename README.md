<div align="center">

# Companio

### A little personality. A lot more possibility.

**An animated desktop companion for Windows that turns voice and text into useful, controlled actions.**

Summon a character, ask for help, and get back to what you were doing—without opening another assistant dashboard.

[![CI](https://github.com/Syed-Nazeer-07/companio/actions/workflows/ci.yml/badge.svg)](https://github.com/Syed-Nazeer-07/companio/actions/workflows/ci.yml)
![Platform](https://img.shields.io/badge/Windows-11%20%7C%20x64%20%7C%20ARM64-0078D4?logo=windows11&logoColor=white)
![Electron](https://img.shields.io/badge/Electron-Desktop-47848F?logo=electron&logoColor=white)
![React](https://img.shields.io/badge/React-19-149ECA?logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)

[**Features**](#features) · [**Get started**](#getting-started) · [**How it works**](#how-it-works) · [**Development**](#development) · [**Roadmap**](#roadmap)

[**Visit official website**](https://companio7.vercel.app) · [Website source](website/) · [Releases](https://github.com/Syed-Nazeer-07/companio/releases) · [Preview builds](https://github.com/Syed-Nazeer-07/companio/actions/workflows/release.yml) · [Report an issue](https://github.com/Syed-Nazeer-07/companio/issues)

</div>

---

> [!IMPORTANT]
> **Status: active preview.** Companio is a working Electron desktop project with Windows automation, character interactions, optional local AI integration, tests, and installer workflows. It is **not yet a signed, production-validated Windows release**. Downloadable releases may lag behind the source code; see the [preview-build workflow](https://github.com/Syed-Nazeer-07/companio/actions/workflows/release.yml) for newer build artifacts when available.

## Marketing website

The repository now includes a **separate, responsive public landing page** in [`website/`](website/). It introduces Companio with a custom logo and favicon, illustrated companion characters, an interactive example-command preview, feature explanations, and official GitHub download links. The demo is illustrative only—it **does not control your computer**.

**Preview the website locally** (from the repository root):

```powershell
cd website
python -m http.server 4173
```

Visit **http://localhost:4173**. The website is plain HTML, CSS, JavaScript, and SVG—there is no npm install or build step for it.

**Live landing page:** [https://companio7.vercel.app](https://companio7.vercel.app) — hosted on Vercel, connected to the `main` branch, with the Vercel root directory set to `website`. This public marketing site is separate from the Electron app and automatically deploys site changes pushed to `main`. Download calls-to-action take visitors to [GitHub Releases](https://github.com/Syed-Nazeer-07/companio/releases) to select a published Windows installer.

> The marketing site is intentionally independent of the Electron/Vite desktop UI. Existing desktop commands (`npm run build`, `npm start`) and installer packaging continue to use the root app; this change does not replace its floating overlay or Control Center.

## Overview

Companio brings an expressive, customizable assistant directly to the Windows desktop. A lightweight, always-on-top character can help launch applications, open websites, perform supported system tasks, and respond to typed or spoken requests.

Its core philosophy is simple: **an assistant should feel present when you need it—and disappear when you do not.**

- **Character-first:** six companion styles with expressive states, subtle motion, and a movable desktop overlay.
- **Action-oriented:** a curated command system for Windows, web searches, browser navigation, and system controls.
- **Local-first:** everyday predefined commands work without a paid AI API key.
- **Approval-aware:** supported multi-step plans require review, and uncertain outcomes are reported as such.

## Features

| Experience | What is implemented |
| --- | --- |
| **Floating companion** | Transparent, always-on-top Electron overlay; drag-to-move handle, position persistence, and smooth show/hide interactions |
| **Six characters** | Sparky, Pixel, Mochi, Cloudie, Kiko, and Boba; animated idle, listening, thinking, speaking, success, and sleep states |
| **Global access** | Default **Ctrl + Shift + Space** shortcut, Windows system tray, and configurable activation shortcut |
| **Windows integration** | Supported application and folder launches, audio controls, screenshots, and selected device utilities |
| **Browser actions** | Website opening and searches in the **default Windows browser**; a separate Edge automation profile for supported interactive tasks |
| **Voice and text** | Typed commands, one-shot Windows speech recognition, spoken responses, transcript review, and optional SHA-256-verified local Whisper setup |
| **Optional local AI** | Ollama or LM Studio connection for conversations and bounded, reviewed action proposals |
| **Personal settings** | Character customization, voice settings, native startup toggle, automation preferences, and Control Center |
| **History and recovery** | Local activity/conversation history, native JSON snapshots, export, and validated restore |

### A companion that feels alive

Choose from **Sparky** (robot), **Pixel** (pixel fox), **Mochi** (soft mascot), **Cloudie** (pastel cloud), **Kiko** (kitten), or **Boba** (bear). Characters respond to interaction states instead of looping through distracting effects.

The companion can be moved around the desktop, sent to sleep, awakened, and dismissed with a transition while the tray application remains available. Motion is reduced when Windows requests reduced-motion behavior.

### Designed for the desktop

Press **Ctrl + Shift + Space** to summon Companio, or click the character to open its compact command bar. The **Control Center** provides Character Studio, Automation & Tools, AI Configuration, Voice Settings, History, Settings, and Help.

**Launch at sign-in is optional and off by default.** In an installed build, enable it under **Control Center → Settings → Windows Startup**. Development and browser-preview sessions cannot install a Windows startup entry.

## What can I ask it to do?

| Example request | Expected behavior |
| --- | --- |
| `Open Calculator` | Launch Windows Calculator |
| `Open my Downloads folder` | Open the Downloads directory |
| `Open YouTube` | Open YouTube in the default browser |
| `Search YouTube for Python DSA` | Open a YouTube search |
| `Open VS Code` | Launch Visual Studio Code when installed |
| `Set the volume to 60%` | Change the Windows master volume and attempt readback |
| `Take a screenshot` | Capture a screenshot using the supported native tool |
| `Move Companio a little right` | Reposition the character within screen bounds |
| `Go to sleep` | Put the companion into a resting state |
| `Open Notepad and set volume to 45%` | Show a review dialog for a supported two-step workflow |

Requests are handled through **recognized intents and allowlisted tools**, not unrestricted access to Windows. Browser and application behavior can vary with installed software, Windows configuration, and external websites. Some operations can be dispatched successfully without proof of their final visible state; Companio distinguishes these outcomes where supported.

## Getting started

### Install a Windows preview

Visit [Releases](https://github.com/Syed-Nazeer-07/companio/releases) or download an artifact from a **successful** [preview-build workflow run](https://github.com/Syed-Nazeer-07/companio/actions/workflows/release.yml).

Choose the setup executable for your processor:

- **x64:** standard Windows Intel/AMD systems.
- **ARM64:** supported Windows-on-ARM systems, including Snapdragon-based laptops.

Preview installers are **unsigned**, and Windows SmartScreen may show an unrecognized-app warning. Do not disable Windows security protections to install Companio. Source builds are also available below.

> [!NOTE]
> The browser-only Vite preview displays the interface but **cannot perform native Windows actions**. Use the Electron desktop app when testing automation.

### Build from source

**Prerequisites:** Windows 11, Git, Node.js 22 with npm (the version used in CI). Microsoft Edge is needed for managed-browser automation. A microphone and local AI runtime are optional.

```powershell
git clone https://github.com/Syed-Nazeer-07/companio.git
cd companio
npm ci
npm run build
npm start
```

The first launch opens the Electron experience; configure your character and preferences in Control Center.

## Voice and local AI

**Preview rc.22 reliability improvements:** Local Whisper can now be set up from Voice Settings with one explicit click; the app downloads an official architecture-matched CPU executable and a better English base quantized model (~60 MB), verifies their published SHA-256 hashes, and keeps everything in per-user storage. Cancellation and manual file selection remain available. Normal desktop actions now have bounded waits: an unresponsive action reports an uncertain outcome and does not continue to later steps. Windows protocol/application launch requests are identified as handoffs, not falsely claimed as observed open windows.


**Offline Whisper setup:** Voice Settings offers a user-triggered install of the official CPU whisper.cpp executable for the current Windows architecture (ARM64 or x64) and a checksum-pinned English base quantized model (~60 MB). Neither is silently downloaded or executed. Automatic setup uses a version-pinned archive and checks its SHA-256 before extraction; the advanced file-pickers remain available for users who prefer manual installation. Voice commands remain editable before execution because local Whisper does not supply a calibrated confidence score. The larger base model may transcribe more accurately than tiny on some speech, but takes more disk and CPU time; real-device accuracy is not yet benchmarked.


Companio supports **text commands without a microphone or AI subscription**. For voice input, the desktop build uses available Windows speech recognition for one-shot dictation. Spoken replies use supported speech synthesis.

- **Push to talk:** review or correct the transcript before sending an action.
- **Optional hands-free safe messages:** when enabled, high-confidence conversational messages and a narrow set of reversible companion controls can send automatically; browser, app, and system commands still require review.
- **Optional offline Whisper:** configure a compatible `whisper.cpp` executable and a GGML speech model in **Voice Settings → Local Whisper**. The compact English model is downloaded only when requested; the executable must be supplied separately.

**There is no continuous system-wide wake-word listener.** Speech accuracy, language support, processing speed, and microphone permission behavior depend on the device and runtime.

### Use a local language model (optional)

Companio's **Built-in Instant Engine** handles its supported commands without a paid API key. To enable a separate, experimental conversational model:

1. Install and run [Ollama](https://ollama.com/) or [LM Studio](https://lmstudio.ai/) with a loaded model.
2. In **Control Center → AI Configuration → Local Offline LLM**, use **Find Local AI** or provide a loopback endpoint.
3. Run **Check Connection** and **Test** to verify the service and model response.

Example Ollama setup:

```powershell
ollama run llama3.2
```

Typical local endpoints are `http://127.0.0.1:11434/v1` (Ollama) and `http://127.0.0.1:1234/v1` (LM Studio).

Local AI is **not a bundled model runtime** and does **not** provide free-form autonomous computer control. Model-proposed actions are limited to a small validated tool set (up to three actions), require explicit approval, and stop on failure. An in-app GGUF download alone does not make a model executable. Unfinished cloud-provider integrations are disabled.

## How it works

```text
                User
             Voice / text
                  |
                  v
        Companion overlay (React)
                  |
                  v
       Intent + safety validation
                  |
                  v
          Electron IPC bridge
                  |
        +---------+---------+
        |         |         |
        v         v         v
   Windows tools  Browser   Local AI*
        |         |         |
        +---------+---------+
                  |
                  v
         Outcome + local history

* Optional: separately running Ollama / LM Studio
```

**Native execution lives in Electron.** Standard links and searches are handed to the Windows default browser. Interactive managed-browser tasks use a **separate Microsoft Edge profile**, not arbitrary tabs in the user's daily browser.

### Tech stack

| Layer | Technologies |
| --- | --- |
| Desktop shell | Electron, Node.js, Windows APIs, PowerShell |
| Interface | React 19, TypeScript, Vite |
| Styling and motion | Tailwind CSS, Framer Motion, SVG |
| Browser automation | Playwright Core, Microsoft Edge |
| Speech | Windows System.Speech, Web Speech APIs, optional whisper.cpp |
| Data | Electron user-data JSON, browser localStorage, experimental in-memory sql.js |
| Packaging | Electron Builder, NSIS, GitHub Actions |

## Development

Start the UI preview:

```powershell
npm run dev
```

For an Electron development session, run `npm run dev` in one PowerShell terminal and the following in another:

```powershell
$env:NODE_ENV = "development"
npm start
```

Useful scripts:

| Command | Purpose |
| --- | --- |
| `npm run build` | TypeScript validation and production UI build |
| `npm run test:unit` | Unit and regression suite |
| `npm run test:desktop-smoke` | Electron startup/IPC smoke tests (Windows) |
| `npm run test:tools` | Interactive native automation tests; **can affect Windows state** |
| `npm run dist:x64` | Package an x64 Windows installer |
| `npm run dist:arm64` | Package an ARM64 Windows installer |
| `npm run dist:portable` | Build an optional portable package |

Windows installer output is written under `release/`. The GitHub Actions [CI workflow](.github/workflows/ci.yml) runs the automated build/security checks; the [release workflow](.github/workflows/release.yml) prepares architecture-specific installers. Passing CI does not guarantee that voice recognition, browser automation, or startup has been verified on every physical device.

### Project structure

```text
companio/
├── website/                 # Static product website, logo, favicon and illustrations
├── electron/
│   ├── main.cjs            # Desktop lifecycle, tray, windows, IPC
│   ├── preload.cjs         # Restricted renderer-to-native bridge
│   └── automation/         # Windows, browser, speech, and AI handlers
├── src/
│   ├── components/
│   │   ├── characters/     # Companion designs and animations
│   │   ├── dashboard/      # Control Center pages
│   │   ├── onboarding/     # First-run experience
│   │   └── overlay/        # Floating companion
│   └── services/           # Planning, safety, speech, state
├── test/                   # Automated and interactive checks
├── .github/workflows/      # CI and Windows release pipelines
└── package.json
```

## Privacy, security, and limitations

Companio can interact with apps, web pages, audio settings, and local information. **Use it on a computer you own or are authorized to control.**

- **Local history is not encrypted.** Desktop history is persisted in a JSON file under Electron's user-data directory; exported backups may contain sensitive text. Keep backups private. `sql.js` is currently an in-memory prototype, not a persistent encrypted database.
- **Supported commands only.** Electron IPC validates tools and inputs; higher-risk or multi-step proposals are reviewed before execution. This is not an unrestricted desktop agent.
- **Verification has limits.** Launching a process, pressing a media key, or handing off a URL is not always proof that the requested visual result occurred.
- **Voice and browser integrations are environment-dependent.** Recognition, controlled Edge sessions, and third-party website interfaces may fail or change.
- **Local AI must be installed separately.** CPU and ARM64 model performance are not guaranteed; downloaded GGUF files are not automatically runnable.
- **Production readiness is pending.** Signed installers, automatic updates, extensive real-device testing, and additional security hardening remain to be completed.

For voice or desktop problems, include your Windows version, processor architecture, the exact action attempted, and any visible error when [opening an issue](https://github.com/Syed-Nazeer-07/companio/issues). Avoid publishing personal history exports or logs containing private information.

## Roadmap

- [x] Interactive character overlay, Control Center, tray, and global shortcut
- [x] Basic local commands, Windows tools, and default-browser searches
- [x] Bounded, approval-first workflows and optional local-model connection
- [x] Native history export/restore and optional Windows startup
- [ ] Broader real-device testing on Windows x64 and ARM64
- [ ] Better speech accuracy, responsiveness, and accessibility
- [ ] More reliable verified web interactions without expanding unsafe permissions
- [ ] Code signing, update delivery, and a production-quality installer experience

## Maintainer

Built by **[Syed Nazeer S](https://github.com/Syed-Nazeer-07)**.

Feedback, reproducible bug reports, and thoughtful contributions are welcome through [GitHub Issues](https://github.com/Syed-Nazeer-07/companio/issues).

---

<div align="center">

**Companio** — a desktop assistant with a little character.

</div>