import { ChatMessage } from '../types';

const SENSITIVE_OR_NOISY_RE = /\b(?:recycle\s+bin|trash|empty|clear\s+(?:notes|memor|history|clipboard)|forget|delete|remove|lock\s+(?:pc|computer|workstation)|shutdown|restart|api\s*key|password|secret|token)\b/i;

/**
 * Derives quick-command suggestions strictly from actual past user commands.
 * Never returns fabricated defaults or sensitive operations.
 */
export function deriveHistorySuggestions(
  messages: ChatMessage[],
  limit = 3
): string[] {
  if (!Array.isArray(messages) || messages.length === 0 || limit <= 0) {
    return [];
  }

  const byKey = new Map<string, { label: string; count: number; lastSeen: number }>();

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    if (!msg || msg.sender !== 'user' || typeof msg.content !== 'string') continue;

    // Exclude conversational prompts paired with plain failed errors
    const next = messages[i + 1];
    if (next && next.sender !== 'user' && next.status === 'error') continue;

    const clean = msg.content.replace(/\s+/g, ' ').trim();
    if (clean.length < 3 || clean.length > 48) continue;
    if (SENSITIVE_OR_NOISY_RE.test(clean)) continue;

    // Prefer genuine action/command entries or recorded task receipts
    const hadTaskExecution =
      next && next.sender !== 'user' && Boolean(next.taskReceipt || next.taskPlan);
    const looksLikeCommand =
      /^(?:open|launch|start|set|change|increase|decrease|mute|unmute|play|pause|resume|skip|search|find|check|show|take|minimize|remind|timer)\b/i.test(
        clean
      );
    if (!hadTaskExecution && !looksLikeCommand) continue;

    const key = clean.toLowerCase();
    const ts = Number.isFinite(msg.timestamp) ? msg.timestamp : i;
    const prev = byKey.get(key);
    if (prev) {
      prev.count += 1;
      if (ts >= prev.lastSeen) {
        prev.lastSeen = ts;
        prev.label = clean;
      }
    } else {
      byKey.set(key, { label: clean, count: 1, lastSeen: ts });
    }
  }

  if (byKey.size === 0) return [];

  const sorted = Array.from(byKey.values()).sort((a, b) => {
    if (b.lastSeen !== a.lastSeen) return b.lastSeen - a.lastSeen;
    return b.count - a.count;
  });

  return sorted.slice(0, limit).map((entry) => entry.label);
}
