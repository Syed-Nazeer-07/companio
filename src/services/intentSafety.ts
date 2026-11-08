// Conservative intent guard for the built-in keyword command planner.
// Conversational messages must not trigger desktop side effects just because
// they mention an application, device, media service or feature name.
export function isCommandRequest(input: string): boolean {
  if (typeof input !== 'string') return false;
  // A spoken request can address the companion by name. Strip only that
  // explicit prefix, then apply the same safety guard to the actual command.
  const utterance = input.trim().replace(/^(?:(?:hey|hi|ok|okay)\s+)?(?:companio|companion)(?:\s*[,:\-]\s*|\s+)(?=\S)/i, '').trim();
  const request = utterance.replace(/[?.!]+$/, '').trim().toLowerCase();
  if (!request || request.length > 1200) return false;

  if (/^(?:please\s+)?(?:don't|do not|never|avoid|without)\b/.test(request)) return false;
  if (/^note:\s*\S/.test(request)) return true;

  // Explicit, intentional action verbs. The polite forms are still commands.
  const actionable = request.replace(/^(?:please\s+)?(?:(?:can|could|would|will)\s+you\s+)?(?:please\s+)?/, '');
  if (/^(?:open|launch|start|browse|search|find|look\s+up|play|pause|resume|mute|unmute|set|change|go\s+to|visit|show|take|capture|save|add|remember|note:|read|check|get|clear|delete|empty|close|quit|lock|skip|next|stop|turn\s+up|turn\s+down|increase|decrease|raise|lower|dim|calculate)\b/.test(actionable)) {
    return true;
  }

  // A small set of direct, read-only status queries.
  if (/^(?:(?:what(?:'s| is)|how much|tell me|give me)\s+)?(?:my|the|current)\s+(?:battery(?:\s+(?:level|percentage|status))?|ip\s+address|network\s+status|system\s+specs|pc\s+specs)(?:\s+.*)?$/.test(request)) {
    return true;
  }
  if (/^(?:where is|directions to)\s+\S/.test(request)) return true;

  // Short command labels are supported, but incidental mentions are not.
  if (/^(?:youtube|spotify|calculator|calc|notepad|paint|task\s+manager|file\s+explorer|downloads|downloads\s+folder|vs\s+code|vscode|chatgpt|chat\s+gpt|claude|gemini|gmail|whatsapp|weather|clock|battery|screenshot|my notes|read notes|show notes|volume\s+(?:up|down)|brighter|dimmer)$/.test(request)) {
    return true;
  }
  return false;
}
