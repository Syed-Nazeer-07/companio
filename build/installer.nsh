!macro customHeader
  ; Native Per-Monitor DPI awareness so setup UI text renders crisply on 150%/200% Windows 11 screens
  ManifestDPIAware true
!macroend

!ifndef BUILD_UNINSTALLER
  !include "nsDialogs.nsh"
  !include "LogicLib.nsh"

  Var CompanioAiDialog
  Var CompanioAiRadioLocal
  Var CompanioAiRadioLater
  Var CompanioAiRadioCloud
  Var CompanioAiMode

  !macro customWelcomePage
    !define MUI_WELCOMEPAGE_TITLE "Welcome to Companio Setup"
    !define MUI_WELCOMEPAGE_TEXT "Install Companio, your lightweight, privacy-first Windows 11 desktop companion.$\r$\n$\r$\nBuilt-in desktop commands, math, timers, notes, and offline speech work immediately without internet or accounts. You can also choose optional on-device local AI on the next step."
    !insertmacro MUI_PAGE_WELCOME
  !macroend

  !macro customInit
    ${If} ${Silent}
      StrCpy $CompanioAiMode "later"
    ${Else}
      StrCpy $CompanioAiMode "local_now"
    ${EndIf}
  !macroend

  !macro customPageAfterChangeDir
    Page custom CompanioAiSetupPageCreate CompanioAiSetupPageLeave
    !define MUI_FINISHPAGE_TITLE "Companio is Ready"
    !define MUI_FINISHPAGE_TEXT "Companio has finished installing. Launch Companio from the Start Menu or Desktop shortcut to meet your companion and apply your selected AI configuration."

    Function CompanioAiSetupPageCreate
      ${If} ${Silent}
        Abort
      ${EndIf}

      !insertmacro MUI_HEADER_TEXT "Choose AI Intelligence Mode" "Keep the core installer compact — install private local AI now or anytime later."

      nsDialogs::Create 1018
      Pop $CompanioAiDialog
      ${If} $CompanioAiDialog == error
        Abort
      ${EndIf}

      ${NSD_CreateLabel} 0 0 100% 24u "Companio checks your hardware, verifies SHA-256 checksums, and supports pause/resume recovery automatically. If you are offline, the base app still installs cleanly."
      Pop $0

      ${NSD_CreateRadioButton} 0 28u 100% 14u "Install Local AI Now (Recommended) — ~1.05 GB download (Qwen 2.5 1.5B + runtime, ~1.5 GB disk)"
      Pop $CompanioAiRadioLocal
      ${NSD_CreateLabel} 14u 43u 95% 24u "Enables natural conversations, intelligent command interpretation, dynamic reactions, private on-device offline inference, and zero recurring API cost."
      Pop $0

      ${NSD_CreateRadioButton} 0 70u 100% 14u "Install Base App Now, Download AI Later — Lightweight install only"
      Pop $CompanioAiRadioLater
      ${NSD_CreateLabel} 14u 85u 95% 20u "Built-in offline intelligence handles desktop commands, timers, quick notes, math, and web searches immediately. Add local AI anytime in Settings."
      Pop $0

      ${NSD_CreateRadioButton} 0 108u 100% 14u "Connect Optional Cloud AI Provider — OpenAI, Gemini, Anthropic, Groq, or OpenRouter"
      Pop $CompanioAiRadioCloud
      ${NSD_CreateLabel} 14u 123u 95% 20u "Configure your own API key in Companio Settings later, protected with Windows DPAPI encryption."
      Pop $0

      ${If} $CompanioAiMode == "later"
        ${NSD_Check} $CompanioAiRadioLater
      ${ElseIf} $CompanioAiMode == "cloud"
        ${NSD_Check} $CompanioAiRadioCloud
      ${Else}
        ${NSD_Check} $CompanioAiRadioLocal
      ${EndIf}

      nsDialogs::Show
    FunctionEnd

    Function CompanioAiSetupPageLeave
      ${NSD_GetState} $CompanioAiRadioLater $0
      ${NSD_GetState} $CompanioAiRadioCloud $1
      ${If} $0 == ${BST_CHECKED}
        StrCpy $CompanioAiMode "later"
      ${ElseIf} $1 == ${BST_CHECKED}
        StrCpy $CompanioAiMode "cloud"
      ${Else}
        StrCpy $CompanioAiMode "local_now"
      ${EndIf}
    FunctionEnd
  !macroend

  !macro customInstall
    CreateDirectory "$APPDATA\companio"
    ClearErrors
    FileOpen $0 "$APPDATA\companio\installer-ai-setup.json" w
    ${IfNot} ${Errors}
      FileWrite $0 '{"mode":"$CompanioAiMode","recommendedModelId":"qwen2.5-1.5b","installerVersion":"${VERSION}","createdBy":"nsis-installer"}'
      FileClose $0
    ${EndIf}
  !macroend
!endif
