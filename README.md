<div align="center">

# ✨ Companio

### Your desktop, with a personality.

**A customizable, animated desktop companion that listens, responds, and helps you control Windows applications and the web.**

Built for Windows 11 with a floating character overlay, voice and text commands, and a dedicated control center.

[![Electron](https://img.shields.io/badge/Electron-47848F?style=for-the-badge&logo=electron&logoColor=white)](https://www.electronjs.org/)
[![React](https://img.shields.io/badge/React_19-149ECA?style=for-the-badge&logo=react&logoColor=white)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![Windows](https://img.shields.io/badge/Windows_11-0078D4?style=for-the-badge&logo=windows11&logoColor=white)](https://www.microsoft.com/windows)

[Overview](#-overview) · [Features](#-features) · [Tech Stack](#-technology-stack) · [Getting Started](#-getting-started) · [Architecture](#-architecture) · [Roadmap](#-roadmap)

</div>

---

> **🚧 Project status — local developer build.** Companio has an Electron desktop shell, a character interface, and native automation handlers. It is **not yet a packaged, broadly verified Windows release**. Native computer control requires running the Electron app on Windows; the ordinary web preview uses simulated fallbacks for some commands. Features that depend on external apps, browser layouts, microphone support, or hardware need testing on the target machine.

## 📌 Overview

Companio is a personal desktop companion designed to make everyday computer interactions feel more natural. Instead of switching between application windows for every small task, you can summon an animated character, type or speak a supported command, and let Companio attempt the action through its desktop integration.

The experience combines three ideas: **an expressive on-screen character**, **practical Windows and browser shortcuts**, and **a simple control center** for preferences, commands, and activity history.

Companio is a **Windows desktop project**, not just a chatbot webpage. A working application installer and unrestricted autonomous computer-use agent are not part of the current release.

## 🎯 The Idea

Traditional assistants often live inside a separate tab or chat window. Companio explores what happens when the assistant is part of the desktop itself: visible when you need it, quiet when you do not, and able to carry out a defined set of computer actions.

The goal is an assistant that feels personal **without making routine actions complicated**. Character customization and animation make the interface approachable; an explicit command-to-tool pipeline makes its capabilities understandable.

## ✨ Features

### 🧸 Six Animated Companions

Choose a character in **Character Studio**, adjust its presentation, and preview different expressions.

| Character | Personality and design |
| --- | --- |
| **Sparky** | Expressive, futuristic robot |
| **Pixel** | Retro pixel-art fox |
| **Mochi** | Soft, squishy 3D-style mascot |
| **Cloudie** | Dreamy pastel cloud |
| **Kiko** | Playful chibi kitten |
| **Boba** | Bubble-tea-inspired bear |

The character interface includes states such as idle, listening, thinking, talking, success, and sleep. The studio also provides a local SVG/PNG image import option; custom-image handling should be treated as an experimental feature.

### 🖥️ Floating Desktop Companion

- Transparent, frameless Electron overlay that stays above regular windows
- Default global activation shortcut: **Ctrl + Shift + Space**
- Character interaction, compact command input, and speech bubbles
- Movable overlay with saved window position
- Separate control center and system-tray access

### ⚡ Windows and Browser Actions

Companio maps recognized commands to a catalog of specific tools.

| Category | Examples |
| --- | --- |
| **Windows apps** | Open Calculator, File Explorer, VS Code, or supported system utilities |
| **Browser** | Open websites, search Google, manage tabs |
| **YouTube** | Search for videos, open a result, and attempt playback controls |
| **Media** | Launch Spotify and send basic media commands |
| **System** | Adjust master volume, mute or unmute audio, capture screenshots |
| **Workflow** | Execute recognized multi-step requests and allow cancellation |

Browser automation uses Playwright with Microsoft Edge when available. **YouTube result selection follows the implemented search logic; it does not guarantee the latest upload from a specific creator.** App- and site-specific behavior can change.

### 🎙️ Voice and Text Interaction

- Type a command or use the microphone control
- Speech recognition through the browser/Electron Web Speech interface, where supported
- Spoken responses through speech synthesis
- Adjustable voice, rate, pitch, and output volume
- Sound effects and reactive character animations

**Voice support depends on the runtime and available speech services.** The current “wake phrase” setting is not a continuously listening, system-wide hotword detector. Mouth animation uses an approximate activity signal rather than true phoneme-level lip synchronization.

### 🧠 Flexible Assistant Modes

Companio supports a **built-in command engine without requiring a paid API key**. It interprets predefined phrases and responds to common conversational prompts.

There is also an experimental **local-LLM conversational path** using an Ollama-compatible endpoint. Settings include detection for Ollama and LM Studio, but the current response implementation sends requests to an Ollama-style endpoint on **localhost:11434**; LM Studio compatibility is not fully wired end to end.

The interface exposes Gemini and OpenAI provider settings, **but cloud-provider selection is not yet a complete cloud reasoning integration**. The built-in engine is rule-based, not a general-purpose LLM.

### 🛠️ Eight-Section Control Center

| Section | Purpose |
| --- | --- |
| **Home** | Companion overview and quick actions |
| **Character Studio** | Select, customize, and preview characters |
| **Automation** | Explore supported tools and test actions |
| **AI Configuration** | Choose built-in or experimental model options |
| **Voice Settings** | Configure microphone and spoken output |
| **History** | Review conversations and automation activity |
| **Settings** | Personalize desktop behavior and preferences |
| **Help & Docs** | Explore setup guidance and commands |

## 💬 Example Commands

Try supported requests such as:

> “Open YouTube.”

> “Search Google for Python tutorials.”

> “Open Calculator.”

> “Open my Downloads folder.”

> “Set the volume to 60%.”

> “Take a screenshot.”

> “Play a video from CarryMinati on YouTube.”

These examples illustrate the **implemented command patterns**. They do not imply Companio can control every Windows app or understand arbitrary natural-language instructions.

## 🧰 Technology Stack

| Layer | Technologies | Purpose |
| --- | --- | --- |
| **Desktop shell** | Electron | Overlay, system tray, shortcuts, native IPC |
| **Interface** | React 19, TypeScript, Vite | Character UI and control center |
| **Styling and animation** | Tailwind CSS, Framer Motion, CSS/SVG | Companion visuals and transitions |
| **Browser automation** | Playwright Core, Microsoft Edge | Supported web actions |
| **Windows integration** | Node.js, PowerShell, Windows APIs | Applications, audio, and screenshots |
| **Voice** | Web Speech APIs | Speech recognition and synthesis |
| **Local data** | localStorage, sql.js | Settings, history, and in-memory SQL structures |
| **Alternative shell experiment** | Tauri 2 / Rust source | Optional prototype, not the main documented runtime |

## 🏗️ Architecture

```text
                     User
                      │
            Voice or text input
                      │
                      ▼
          React companion overlay
                      │
                      ▼
          Rule-based task planner ───► Optional local LLM conversation
                      │
                      ▼
             Desktop bridge
                      │
                      ▼
             Electron IPC
               ┌──────┼────────┐
               ▼      ▼        ▼
            Browser  Windows   System
           Playwright  apps     audio
               │      │        │
               └──────┼────────┘
                      ▼
             Result / feedback
                      │
                      ▼
          History and preferences
              (localStorage)
```

**Important distinction:** In a regular browser preview, the desktop bridge cannot access native Electron functionality and can return simulated success results. For meaningful automation testing, run the **Electron desktop application** on Windows.

## 🚀 Getting Started

### Prerequisites

- **Windows 11** (Electron is the primary supported path)
- Recent supported **Node.js LTS** and npm
- **Microsoft Edge** for the preferred Playwright browser path
- Git for cloning the repository
- A microphone if you want voice input

The project targets Windows x64 and Windows on ARM64, including Snapdragon-based laptops. Device-specific compatibility and performance have not been fully certified.

### 1. Clone the Repository

```powershell
git clone https://github.com/Syed-Nazeer-07/companio.git
cd companio
```

### 2. Install Dependencies

```powershell
npm install
```

### 3. Build and Launch the Desktop App

```powershell
npm run build
npm start
```

The production frontend is generated in `dist/`, and Electron runs the transparent overlay and tray integration. On first launch, use the control center to select your character and configure preferences.

### 4. Package Windows Installers (.exe)

You can build standalone NSIS installers and portable `.exe` binaries locally with:

```powershell
# Build for your current architecture
npm run dist

# Or target specific architectures
npm run dist:x64       # Standard Intel/AMD 64-bit Windows
npm run dist:arm64     # Snapdragon X Elite / Copilot+ ARM64 Windows
npm run dist:portable  # Standalone single-file executable (no installation required)
```

The output executables are packaged into the `release/` directory:
- `Companio Setup 1.0.0.exe` (Full NSIS Windows installer with Desktop & Start Menu shortcuts)
- `Companio 1.0.0.exe` (Portable executable)

### 5. Automated GitHub Releases

Companio includes a GitHub Actions CI/CD workflow (`.github/workflows/release.yml`). Pushing a git tag automatically builds both `x64` and `arm64` Windows installers and attaches them to a GitHub Release:

```powershell
git tag v1.0.0
git push origin v1.0.0
```

### 6. Development Mode

The Vite interface can be previewed with:

```powershell
npm run dev
```

For desktop development, start Vite in one terminal and Electron in another:

```powershell
npm start
```

Alternatively, `npm run dev:all` starts both processes. **Web-only preview is not equivalent to native desktop automation.**

### 5. Optional Local LLM

Install and start [Ollama](https://ollama.com/), download a compatible model, and choose **Local LLM** in the AI settings. For example:

```powershell
ollama run llama3.2
```

The app currently sends local conversational requests to `http://localhost:11434/v1/chat/completions`. No API key is necessary for the built-in command engine. Local-model use is optional and may require substantial RAM or processing power.

## 📁 Project Structure

```text
companio/
├── electron/
│   ├── main.cjs                    # Desktop windows, tray, shortcuts and IPC
│   ├── preload.cjs                 # Scoped renderer-to-desktop bridge
│   └── automation/                 # Browser, Windows app and audio handlers
├── src/
│   ├── components/
│   │   ├── characters/             # Animated companion visuals
│   │   ├── dashboard/              # Control center sections
│   │   ├── onboarding/             # Initial setup experience
│   │   └── overlay/                # Floating character and input UI
│   ├── services/                   # Planner, bridge, speech and local data
│   ├── types/
│   └── App.tsx
├── src-tauri/                      # Experimental alternative desktop shell
├── test/
│   └── test-automation.cjs         # Native automation scenarios
├── package.json
└── README.md
```

## 🔒 Privacy, Permissions & Safety

Companio works with desktop applications, so **review commands before relying on them**.

- **No paid API key is needed** to use the built-in command parser.
- Settings, recent conversations, and automation logs are currently stored in the local web storage for the app. Although `sql.js` tables are initialized, **the SQL database is not currently exported to a durable SQLite file**.
- AI provider API key fields are exposed by the interface. **Do not treat their current local settings storage as a secure credential vault.**
- Browser automation may open websites and interact with content in a separate browser context.
- Desktop execution and permissions are controlled by the local application; this is **not a hardened security sandbox**.
- The Electron runtime includes permissive media permission handling. Review it before distributing the software to others.

Do not submit sensitive credentials, confidential files, or irreversible requests unless you understand how the relevant tool behaves.

## 🧪 Testing & Verification

Build the frontend:

```powershell
npm run build
```

Run the included native automation scenarios:

```powershell
npm run test:tools
```

**Before running the automation suite:** it can open Microsoft Edge, YouTube, Calculator, File Explorer, and other apps; change/mute your system volume; and create a screenshot. Run it interactively on a Windows test machine.

The test suite contains checks for several native automation paths; **its presence is not proof that all functions passed on every device**. Browser DOM changes, operating system settings, dependencies, and microphone support may affect behavior. The source repository does not currently establish an independently verified public release.

## ⚠️ Current Limitations

- The built-in command engine recognizes predefined patterns rather than arbitrary open-ended computer tasks.
- Cloud AI provider options appear in the interface, but full cloud-model response integration remains unfinished.
- Local model conversations use a fixed Ollama-compatible endpoint, despite broader model options in settings.
- Browser preview includes simulated desktop actions and should not be used to verify native features.
- Voice availability depends on the system and Web Speech support; continuous hotword detection is not implemented.
- YouTube interactions rely on changing site selectors and do not reliably identify a creator's newest published upload.
- Local history uses browser storage with finite capacity and is not yet a durable, portable database.
- No signed Windows installer or verified automatic-update workflow is provided.

## 🗺️ Roadmap

- [ ] Strengthen tool-result verification, error reporting, and permission controls
- [ ] Expand natural-language command coverage without false success messages
- [ ] Finish Ollama / LM Studio configuration and optional cloud-provider integrations
- [ ] Persist the local database reliably, with export and import
- [ ] Improve speech recognition, wake-word handling, and expression synchronization
- [ ] Harden Windows application integrations and browser automation
- [ ] Package and test Windows x64 / ARM64 installers
- [ ] Add repeatable CI tests, accessibility checks, and broader device validation

## 💡 Design Principles

**Simple on the surface. Capable underneath.** The character should be delightful without distracting from the task.

**Local-first where possible.** Basic command execution should not require recurring API payments.

**Visible execution.** A useful assistant should explain what it attempted and be transparent about failures and uncertainty.

**Personal by design.** Characters, voices, appearance, and desktop behavior should be customizable.

## 👨‍💻 Author

**Syed Nazeer S**

- GitHub: [@Syed-Nazeer-07](https://github.com/Syed-Nazeer-07)
- Repository: [Companio](https://github.com/Syed-Nazeer-07/companio)

---

<div align="center">

**✨ A little personality for your desktop.**

*Built with curiosity, code, and a love for making everyday computing more intuitive.*

</div>
