import { AiConfig, ChatMessage } from '../types';
import { desktopBridge } from './desktopBridge';
import { dbService } from './dbService';
import { evaluateArithmetic } from './arithmetic';
import { isCommandRequest } from './intentSafety';
import { selectRelevantMemories, formatMemoryContext } from './memoryRetrieval';
import { generateBuiltInCharacterReply } from './hybridRouter';

// Only recent plain conversation is eligible; never feed action logs or notes into planning.
export function recentConversation(messages: ChatMessage[], currentQuery: string) {
  // Keep only complete recent conversational pairs. A command, failed reply,
  // cancelled action or unrelated system entry must never become model context.
  const turns = messages.slice(-24);
  if (turns.at(-1)?.sender === 'user' && turns.at(-1)?.content === currentQuery) turns.pop();
  const history: { role: 'user' | 'assistant'; content: string }[] = [];
  let budget = 2400;
  for (let index = turns.length - 1; index >= 1 && history.length < 8; index--) {
    const answer = turns[index];
    const question = turns[index - 1];
    if (!['companio', 'aura'].includes(answer.sender) || question.sender !== 'user'
      || answer.taskPlan || question.taskPlan || answer.taskReceipt || question.taskReceipt || answer.status !== 'info'
      || isCommandRequest(question.content)) continue;
    const userText = question.content.trim().slice(0, 600);
    const assistantText = answer.content.trim().slice(0, 600);
    if (!userText || !assistantText || userText.length + assistantText.length > budget) continue;
    if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(userText + assistantText)) continue;
    history.unshift({role:'user',content:userText},{role:'assistant',content:assistantText});
    budget -= userText.length + assistantText.length;
    index--;
  }
  return history;
}

export function trySolveMathExpression(query: string): string | null {
  const trimmed = query.trim();
  if (!trimmed || trimmed.length > 180) return null;
  // Avoid treating ISO dates, phone numbers, or semantic versions as arithmetic.
  if (/^\d{4}[-/]\d{1,2}[-/]\d{1,2}$/.test(trimmed) || /^\d{3}-\d{3}-\d{4}$/.test(trimmed)) {
    return null;
  }

  const normalized = trimmed
    .toLowerCase()
    .replace(/[?=]+$/g, '')
    .replace(/^(?:(?:can|could|would)\s+you\s+)?(?:please\s+)?(?:calculate|compute|evaluate|solve|what(?:'s| is))\s+/i, '')
    .trim();

  if (!normalized) return null;

  const pctMatch = normalized.match(/^(\d+(?:\.\d+)?)\s*%\s*of\s*(\d+(?:\.\d+)?)$/);
  if (pctMatch) {
    const pct = parseFloat(pctMatch[1]);
    const val = parseFloat(pctMatch[2]);
    const ans = Number(((pct / 100) * val).toPrecision(12));
    return `${pct}% of ${val} is ${ans} 🧮`;
  }

  const sqrtMatch = normalized.match(/^(?:the\s+)?(?:square\s+root\s+of|sqrt(?:\s+of)?)\s*\(?\s*(\d+(?:\.\d+)?)\s*\)?$/);
  if (sqrtMatch) {
    const val = parseFloat(sqrtMatch[1]);
    const ans = Number(Math.sqrt(val).toPrecision(12));
    return `The square root of ${val} is ${ans} 🧮`;
  }

  const expr = normalized
    .replace(/\bplus\b/g, '+')
    .replace(/\bminus\b/g, '-')
    .replace(/\btimes\b|\bmultiplied\s+by\b/g, '*')
    .replace(/\bdivided\s+by\b/g, '/')
    .trim();

  // Bare single literals like "42" or versions like "1.2.3" are not math expressions unless an operator exists.
  if (/^[\d\s+\-*/().]+$/.test(expr) && /[+\-*/]/.test(expr) && !/^[+-]?\d+(?:\.\d+)?$/.test(expr.replace(/\s+/g, ''))) {
    const result = evaluateArithmetic(expr);
    if (result !== null) {
      const cleanResult = Number.isInteger(result) ? result : Number(result.toPrecision(12));
      return `${expr} = ${cleanResult} 🧮`;
    }
  }
  return null;
}

  // Conversational response with local desktop inference and deterministic offline utilities
export async function generateConversationalResponse(query: string, aiConfig?: AiConfig): Promise<string> {
    const q = query.toLowerCase().trim();

    // 1. Math Calculation Solver (prefixed or bare expressions — instant 0ms evaluation)
    const mathAnswer = trySolveMathExpression(query);
    if (mathAnswer) return mathAnswer;

    // 2. Coin Flip & Dice Roll
    if (q.includes('flip a coin') || q.includes('toss a coin')) {
      const outcome = Math.random() > 0.5 ? 'Heads' : 'Tails';
      return `🪙 It's ${outcome}!`;
    }
    if (q.includes('roll a dice') || q.includes('roll a die') || q.includes('roll dice')) {
      const val = Math.floor(Math.random() * 6) + 1;
      return `🎲 You rolled a ${val}!`;
    }

    // 3. Time & Date direct queries
    if (/^(?:what time is it|what is the current time|current time|tell me the time)[.!?]*$/.test(q)) {
      const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      return `The current time is ${timeStr}! ⏰ Anything else you need?`;
    }
    if (/^(?:what date is it|what is the date|today's date|what day is it)[.!?]*$/.test(q)) {
      const dateStr = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
      return `Today is ${dateStr}! 📅 Ready for an awesome day!`;
    }

    // Memory recall & contextual injection (conversational path only — never triggers automation).
    const cachedMemories = aiConfig?.useLongTermMemory === false || typeof dbService?.getCachedMemories !== 'function'
      ? []
      : dbService.getCachedMemories();
    const relevantMemories = selectRelevantMemories(cachedMemories, query);
    const memoryBlock = formatMemoryContext(relevantMemories);
    const systemWithMemory = memoryBlock
      ? [aiConfig?.systemPrompt || 'You are Companio, a helpful Windows desktop companion.', memoryBlock].join('\n\n').slice(0, 2400)
      : aiConfig?.systemPrompt;

    // Local mode must use the selected model or report a real error.
    // Never silently fall back to a canned reply when the server is offline.
    if (aiConfig?.provider === 'local') {
      const result = await desktopBridge.chatLocalAi({
        endpoint: aiConfig.localEndpoint,
        model: aiConfig.model || 'llama3.2:1b',
        prompt: query,
        history: aiConfig.useConversationContext === true ? recentConversation(dbService.getMessages(), query) : undefined,
        systemPrompt: systemWithMemory,
        temperature: aiConfig.temperature
      });
      if (!result.success || !result.reply) {
        throw new Error((result.error || 'The local model did not reply.') + ' Local AI is optional. Start Ollama / LM Studio or switch AI Settings to Built-in for offline commands.');
      }
      return result.reply;
    }

    if (aiConfig?.provider && ['openai', 'gemini', 'anthropic', 'groq', 'openrouter', 'custom_openai'].includes(aiConfig.provider)) {
      const result = await desktopBridge.chatCloudAi({
        provider: aiConfig.provider as 'openai' | 'gemini' | 'anthropic' | 'groq' | 'openrouter' | 'custom_openai',
        model: aiConfig.model,
        customEndpoint: aiConfig.cloudCustomEndpoint,
        prompt: query,
        history: aiConfig.useConversationContext === true ? recentConversation(dbService.getMessages(), query) : undefined,
        systemPrompt: systemWithMemory,
        temperature: aiConfig.temperature
      });
      if (!result.success || !result.reply) {
        throw new Error((result.error || 'The cloud AI provider did not reply.') + ' Check your encrypted API key in AI Intelligence or switch to Built-in mode.');
      }
      return result.reply;
    }

    if (aiConfig?.provider === 'auto' || aiConfig?.provider === 'managed_local') {
      const managedStatus = typeof desktopBridge.getManagedAiStatus === 'function'
        ? await desktopBridge.getManagedAiStatus().catch(() => null)
        : null;
      if (managedStatus?.ready && typeof desktopBridge.chatManagedAi === 'function') {
        const res = await desktopBridge.chatManagedAi({
          prompt: query,
          history: recentConversation(typeof dbService?.getMessages === 'function' ? dbService.getMessages() : [], query),
          systemPrompt: systemWithMemory,
          temperature: aiConfig.temperature
        }).catch(() => null);
        if (res?.success && res.reply) {
          return res.reply;
        }
      }
    }

    if (/^what\s+do\s+you\s+remember(?:\s+about\b|\s*$)/i.test(q)) {
      if (aiConfig?.useLongTermMemory === false) {
        return 'Long-term memory retrieval is paused in History & Logs settings.';
      }
      if (relevantMemories.length > 0) {
        return 'Here is what I remember:\n' + relevantMemories.map((m, idx) => `${idx + 1}. [${m.item.category}] ${m.item.content}`).join('\n');
      }
      return 'I do not have any relevant saved memory matching that yet. You can add memories in History & Logs or say "save to memory: ...".';
    }

    // Built-in Level 1 character conversation & truthful fallback (zero Ollama/LM Studio errors).
    const builtIn = generateBuiltInCharacterReply(query, {
      characterId: aiConfig?.personality,
      managedAiAvailable: false
    });
    return builtIn.reply;
  }


