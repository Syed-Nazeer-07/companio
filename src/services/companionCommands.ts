// Dedicated, deterministic commands for Companio itself. Never infer
// native side effects from conversational mentions of these words.
export type CompanionCommand =
  | { kind: 'sleep' | 'wake' | 'hide' | 'open' }
  | { kind: 'move'; direction: 'left' | 'right' | 'up' | 'down' };

export function parseCompanionCommand(input: string): CompanionCommand | null {
  if (typeof input !== 'string' || input.length > 160) return null;
  const command = input.trim()
    .replace(/^(?:(?:hey|hi|ok|okay)\s+)?companio(?:\s*[,!:;-]\s*|\s+)(?=\S)/i, '')
    .replace(/[.!?]+$/, '').trim().toLowerCase();
  if (!command || /^(?:don't|do not|never|without|please don't)\b/.test(command)) return null;
  const action = command.replace(/^(?:please\s+)?(?:(?:can|could|would)\s+you\s+)?(?:please\s+)?/, '');

  if (/^(?:go\s+to\s+sleep|sleep(?:\s+mode)?|take\s+a\s+nap|rest(?:\s+now)?|put\s+(?:yourself|companio)\s+to\s+sleep)$/.test(action))
    return { kind: 'sleep' };
  if (/^(?:wake(?:\s+up)?|rise\s+and\s+shine)$/.test(action)) return { kind: 'wake' };
  if (/^(?:(?:close|hide|dismiss|minimize)\s+(?:the\s+)?(?:companion|assistant|companio)|go\s+away|goodbye\s+companio)$/.test(action))
    return { kind: 'hide' };
  if (/^(?:(?:open|show|summon|activate)\s+(?:the\s+)?(?:companion|assistant|companio)|come\s+back)$/.test(action))
    return { kind: 'open' };

  const move = action.match(/^(?:move|slide)\s+(?:(?:companio|yourself|the\s+companion)\s+)?(?:(?:a\s+little|slightly)\s+)?(?:to\s+the\s+)?(left|right|up|down)(?:\s+(?:a\s+little|slightly))?$/);
  if (move) return { kind: 'move', direction: move[1] as 'left' | 'right' | 'up' | 'down' };
  return null;
}
