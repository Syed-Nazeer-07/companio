export interface FailureRecoveryAdvice {
  hint: string;
  retryable: boolean;
}

export function classifyFailureRecovery(tool: string, error: string): FailureRecoveryAdvice {
  const msg = String(error || '').toLowerCase();

  if (msg.includes('within') && msg.includes('seconds') || msg.includes('timed out')) {
    return {
      hint: 'Check whether the Windows app or browser already responded before trying again.',
      retryable: false
    };
  }
  if (msg.includes('stopped by user') || msg.includes('cancelled')) {
    return {
      hint: 'Execution was stopped. Edit or resend when ready.',
      retryable: false
    };
  }
  if (tool === 'win.screenshot' || msg.includes('screen capture') || msg.includes('screenshot failed')) {
    return {
      hint: 'Screen capture requires an unlocked, active Windows desktop session.',
      retryable: true
    };
  }
  if (tool.startsWith('win.brightness') || msg.includes('brightness')) {
    return {
      hint: 'Windows WMI brightness only controls built-in laptop panels, not most external HDMI/DisplayPort monitors.',
      retryable: false
    };
  }
  if (tool.startsWith('win.volume') || msg.includes('audio endpoint') || msg.includes('audio')) {
    return {
      hint: 'Verify a default Windows playback device is connected and enabled in Sound settings.',
      retryable: true
    };
  }
  if (msg.includes('edge') || msg.includes('controlled browser') || msg.includes('youtube')) {
    return {
      hint: 'Close conflicting Companio Edge windows or verify your internet connection, then try again.',
      retryable: true
    };
  }
  if (msg.includes('process') || msg.includes('not installed') || msg.includes('could not find')) {
    return {
      hint: 'Confirm the app is installed for your Windows account and wait a moment if it is still starting.',
      retryable: true
    };
  }
  if (msg.includes('ollama') || msg.includes('local model') || msg.includes('api key') || msg.includes('cloud ai')) {
    return {
      hint: 'Check AI Intelligence settings (start Ollama / LM Studio, select a loaded model, or verify your DPAPI cloud key).',
      retryable: false
    };
  }
  return {
    hint: 'Review the error details in History & Logs or try rephrasing the command.',
    retryable: true
  };
}
