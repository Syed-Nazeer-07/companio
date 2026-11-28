# Companio user guide

[Back to README](../README.md)

## Getting started

### Install a Windows preview

Download [Companio ARM64](https://github.com/Syed-Nazeer-07/companio/releases/download/v1.1.0-rc.27/Companio-Setup-1.1.0-rc.27-arm64.exe) for Snapdragon/Windows on ARM or [Companio x64](https://github.com/Syed-Nazeer-07/companio/releases/download/v1.1.0-rc.27/Companio-Setup-1.1.0-rc.27-x64.exe) for Intel/AMD Windows. Both are direct GitHub Release installer files. For integrity, check the SHA-256 values on the [rc.27 release page](https://github.com/Syed-Nazeer-07/companio/releases/tag/v1.1.0-rc.27). These are **unsigned preview builds** and Windows may show a publisher-reputation warning.

Choose the setup executable for your processor:

- **x64:** standard Windows Intel/AMD systems.
- **ARM64:** supported Windows-on-ARM systems, including Snapdragon-based laptops.

Preview installers are **unsigned**, and Windows SmartScreen may show an unrecognized-app warning. Do not disable Windows security protections to install Companio. Source builds are also available below.

> [!NOTE]
> The browser-only Vite preview displays the interface but **cannot perform native Windows actions**. Use the Electron desktop app when testing automation.

## Voice and local AI

**v1.1.0-rc.27 Windows preview:** The Windows ARM64 and x64 installer builds bundle an English offline Whisper speech engine and quantized model. Official archive and model SHA-256 hashes are checked before packaging. On first launch, choose a character and activate the microphone; **no Ollama, LM Studio, API key, or manual speech-model download** is needed for supported desktop commands. For source-only `npm start` runs without packaged assets, Automatic voice falls back to installed Windows dictation. Existing installations using the old default Windows recognizer migrate to Automatic unless the user explicitly selected a newer preference.

- **Push to talk:** activate Companio, tap the microphone, and speak. New packaged builds use offline Whisper by default when its bundled engine is present. Audio is processed locally; it is not recorded in the background.
- **Low-risk hands-free commands:** supported, exact one-step commands such as **Open YouTube**, **Open Calculator** and **Take a screenshot** can be sent directly after recognition. Unknown websites, searches, multi-step actions, and sensitive operations still show an editable transcript and may require approval.
- **Accurate feedback:** screenshot success requires a verified saved PNG, while opening a website only verifies that Windows received the browser request.
- **Voice settings:** Control Center → Voice Settings includes a microphone test, recognition-language setting, a Windows dictation override, optional manual Whisper file selection, and individually tuned character voices.
- **Advanced AI remains optional:** the Built-in Engine handles supported commands without third-party servers. Choose local AI only when Ollama or LM Studio is already running.

**Earlier rc.22 installers** used the prior Windows dictation default and optional Whisper download. The rc.26 release introduced the bundled offline recognizer and one-screen first launch. rc.27 adds safer voice recognition handling and screenshot capture fallback. Microphone permission from Windows and on-device performance testing remain applicable. No continuous always-on wake-word recording is enabled.

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

## Privacy, security, and limitations

Companio can interact with apps, web pages, audio settings, and local information. **Use it on a computer you own or are authorized to control.**

- **Local history is not encrypted.** Desktop history is persisted in a JSON file under Electron's user-data directory; exported backups may contain sensitive text. Keep backups private. `sql.js` is currently an in-memory prototype, not a persistent encrypted database.
- **Supported commands only.** Electron IPC validates tools and inputs; higher-risk or multi-step proposals are reviewed before execution. This is not an unrestricted desktop agent.
- **Verification has limits.** Launching a process, pressing a media key, or handing off a URL is not always proof that the requested visual result occurred.
- **Voice and browser integrations are environment-dependent.** Recognition, controlled Edge sessions, and third-party website interfaces may fail or change.
- **Local AI must be installed separately.** CPU and ARM64 model performance are not guaranteed; downloaded GGUF files are not automatically runnable.
- **Production readiness is pending.** Signed installers, automatic updates, extensive real-device testing, and additional security hardening remain to be completed.

For voice or desktop problems, include your Windows version, processor architecture, the exact action attempted, and any visible error when [opening an issue](https://github.com/Syed-Nazeer-07/companio/issues). Avoid publishing personal history exports or logs containing private information.

## Installation and troubleshooting

This repository contains development improvements that may not yet be present in the downloadable preview. Check the release tag and its checksums before testing a specific build.

- **Installer uses too much CPU or appears frozen:** the source includes an experimental ZIP-based NSIS packaging option and disables launching Companio at the installer finish screen. This changes extraction behavior but still needs before/after ARM64 measurement; it does not guarantee that Windows Defender scanning or disk contention will be faster. Keep Windows protections enabled and check Task Manager for the process consuming CPU or disk.
- **Windows says “protected your PC”:** the publicly distributed Windows preview is unsigned. SmartScreen is based on publisher and file reputation, not a missing checkbox in Electron. Verify the SHA-256 listed on the official release before choosing whether to trust the download. Signing with a verified publisher or distributing through the Microsoft Store requires separate publisher setup; never disable security checks to make an installer appear trusted.
- **Voice recognition is inaccurate or hears nothing:** in **Control Center → Voice Settings**, use the microphone test and check Windows microphone access. New packaged installers select bundled offline Whisper automatically; source-only runs fall back to Windows dictation. On ARM64, transcription speed and accuracy still depend on the microphone and CPU. Use the editable transcript before sending unfamiliar actions.
- **Local model server unavailable:** Ollama and LM Studio are optional. If you selected local AI but it is not running, start the chosen server or change **AI Settings** to Built-in. Local commands like opening approved websites do not require an LLM.
- **Screenshots:** say or type **Take a screenshot** and check **Pictures/Companio_Captures**. The app reports the saved file path only after verifying a PNG was created. In browser-only previews, native Windows screenshots are unavailable.
- **“Website not verified” messages:** opening a site in the Windows default browser confirms only the handoff to the OS, not that the external page finished loading or was independently security-scanned. Confirm in your browser; this is not a security verdict on that website.
