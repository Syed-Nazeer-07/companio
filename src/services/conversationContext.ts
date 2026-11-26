import { AiConfig, ChatMessage } from '../types';
import { desktopBridge } from './desktopBridge';
import { dbService } from './dbService';
import { evaluateArithmetic } from './arithmetic';
import { isCommandRequest } from './intentSafety';
import { selectRelevantMemories, formatMemoryContext } from './memoryRetrieval';

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

  // Conversational response with local desktop inference and deterministic offline utilities
export async function generateConversationalResponse(query: string, aiConfig?: AiConfig): Promise<string> {
    const q = query.toLowerCase().trim();

    // 1. Math Calculation Solver (Instant 0ms calculation)
    if (q.includes('calculate') || q.includes('what is') || q.includes("what's") || q.includes('solve')) {
      // Percentage check e.g. "what is 15% of 800" or "calculate 20% of 1500"
      const pctMatch = q.match(/(\d+(?:\.\d+)?)\s*%\s*of\s*(\d+(?:\.\d+)?)/);
      if (pctMatch) {
        const pct = parseFloat(pctMatch[1]);
        const val = parseFloat(pctMatch[2]);
        const ans = (pct / 100) * val;
        return `${pct}% of ${val} is ${ans} 🧮`;
      }

      // Square root check
      const sqrtMatch = q.match(/(?:square root of|sqrt of|sqrt)\s*(\d+(?:\.\d+)?)/);
      if (sqrtMatch) {
        const val = parseFloat(sqrtMatch[1]);
        return `The square root of ${val} is ${Math.sqrt(val)} 🧮`;
      }

      // Basic arithmetic expressions
      let expr = q
        .replace(/what is|what's|calculate|solve|\?/g, '')
        .replace(/\bplus\b/g, '+')
        .replace(/\bminus\b/g, '-')
        .replace(/\btimes\b|\bmultiplied by\b/g, '*')
        .replace(/\bdivided by\b/g, '/')
        .trim();

      if (/^[\d\s\+\-\*\/\.\(\)]+$/.test(expr) && /[\+\-\*\/]/.test(expr)) {
        try {
          const result = evaluateArithmetic(expr);
          if (result !== null) return `${expr.trim()} = ${result} 🧮`;
        } catch (e) {}
      }
    }

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

    if (/^what\s+do\s+you\s+remember(?:\s+about\b|\s*$)/i.test(q)) {
      if (aiConfig?.useLongTermMemory === false) {
        return 'Long-term memory retrieval is paused in History & Logs settings.';
      }
      if (relevantMemories.length > 0) {
        return 'Here is what I remember:\n' + relevantMemories.map((m, idx) => `${idx + 1}. [${m.item.category}] ${m.item.content}`).join('\n');
      }
      return 'I do not have any relevant saved memory matching that yet. You can add memories in History & Logs or say "save to memory: ...".';
    }

    if (/^(?:give me |tell me |share )?(?:a )?(?:motivational|inspirational) quote[.!?]?$/i.test(q)) {
      return 'Small, consistent improvements matter more than perfect starts.';
    }

    // Built-in delightful companion personality
    if (q.includes('how are you') || q.includes('how r u') || q.includes('how are you doing')) {
      return "I'm feeling wonderful and super energetic today! Ready to help you with anything on your PC ✨ How are you doing?";
    }
    if (q.includes('who are you') || q.includes('what are you')) {
      return "I'm Companio, your personal AI desktop companion! I live on your Windows desktop to automate tasks, open apps, control sound, and keep you company 💖";
    }
    if (q.includes('joke') || q.includes('make me laugh')) {
      const jokes = [
        "Why do programmers prefer dark mode? Because light attracts bugs! 😄",
        "Why was the computer cold? It left its Windows open! ❄️",
        "There are 10 types of people in the world: those who understand binary, and those who don't! 🤖"
      ];
      return jokes[Math.floor(Math.random() * jokes.length)];
    }
    if (q.includes('good morning')) {
      return "Good morning! ☀️ Wishing you an inspiring, productive, and happy day ahead! What shall we tackle first?";
    }
    if (q.includes('good night') || q.includes('sleep well')) {
      return "Good night! 🌙 Sweet dreams! I'll be right here resting whenever you need me.";
    }
    if (q.includes('thank you') || q.includes('thanks')) {
      return "You're so very welcome! Always happy to help you 🥰";
    }
    if (/\b(?:hello|hi|hey)\b/.test(q)) {
      return "Hello there! ✨ What can I do for you on your computer today?";
    }
    if (q.includes('bored')) {
      return "Want me to play CarryMinati or some good music on Spotify, or maybe open ChatGPT to brainstorm cool projects? Just say the word! 🚀";
    }
    if (q.includes('help') || q.includes('what can you do')) {
      return "I can open ChatGPT, YouTube, Spotify, Chrome, VS Code, and Camera; control system volume; take screenshots; empty recycle bin; show desktop; check battery; and automate computer workflows!";
    }

    return 'The built-in engine cannot answer that yet. Try a supported desktop command, or enable a local language model in AI Intelligence for conversation.';
  }


