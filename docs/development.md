# Development and architecture

[Back to README](../README.md)

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

### Pre-release verification

Before publishing updated installers, CI runs unit tests, a TypeScript build, packaged UI smoke checks, native ARM64 smoke checks, and bounded silent-install tests with setup timing on Windows runners. Real-world microphone accuracy, Defender scanning overhead, and laptop thermals still require real-device validation. Production code signing remains outstanding; a green CI run is not evidence that every Windows machine is supported.

## Release process

Keep application changes and release publication separate. The release workflow verifies that a version tag matches package.json, runs regression tests and dependency checks, packages both architectures, verifies checksums, and publishes preview installers for RC tags. Before updating the website or README download links, confirm the release assets actually exist. Do not delete releases referenced by current links. Preserve historical tags and a known-good rollback build.
