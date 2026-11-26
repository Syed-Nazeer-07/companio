import { AiConfig, ChatMessage } from '../types';
import { desktopBridge } from './desktopBridge';
import { dbService } from './dbService';
import { evaluateArithmetic } from './arithmetic';

// Only recent plain conversation is eligible; never feed action logs or notes into planning.
export function recentConversation(messages: ChatMessage[], currentQuery: string) {
  const turns = messages.slice(-24);
  if (turns.at(-1)?.sender === 'user' && turns.at(-1)?.content === currentQuery) turns.pop();
  const history: { role: 'user' | 'assistant'; content: string }[] = [];
  let budget = 2400;
  for (const message of turns.reverse()) {
    if (history.length >= 8 || budget <= 0) break;
    if (message.taskPlan || message.status === 'error' || !['user', 'companio', 'aura'].includes(message.sender)) continue;
    const content = message.content.trim().slice(0, Math.min(600, budget));
    if (!content) continue;
    history.unshift({ role: message.sender === 'user' ? 'user' : 'assistant', content });
    budget -= content.length;
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
    if (q.includes('what time') || q.includes('current time') || q.includes('tell me the time')) {
      const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      return `The current time is ${timeStr}! ⏰ Anything else you need?`;
    }
    if (q.includes('what date') || q.includes('what is the date') || q.includes("today's date") || q.includes('what day is it')) {
      const dateStr = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
      return `Today is ${dateStr}! 📅 Ready for an awesome day!`;
    }

    // 2. Motivational Quotes
    if (q.includes('quote') || q.includes('inspire') || q.includes('motivation')) {
      const quotes = [
        "\"The only way to do great work is to love what you do.\" — Steve Jobs ✨",
        "\"Success is not final, failure is not fatal: it is the courage to continue that counts.\" — Winston Churchill 🚀",
        "\"Believe you can and you're halfway there.\" — Theodore Roosevelt 🌟",
        "\"Small daily improvements over time lead to stunning results.\" — Robin Sharma 💡",
        "\"Your time is limited, don't waste it living someone else's life.\" — Steve Jobs 💖"
      ];
      return quotes[Math.floor(Math.random() * quotes.length)];
    }

    // Local mode must use the selected model or report a real error.
    // Never silently fall back to a canned reply when the server is offline.
    if (aiConfig?.provider === 'local') {
      const result = await desktopBridge.chatLocalAi({
        endpoint: aiConfig.localEndpoint,
        model: aiConfig.model || 'llama3.2:1b',
        prompt: query,
        history: aiConfig.useConversationContext === true ? recentConversation(dbService.getMessages(), query) : undefined,
        systemPrompt: aiConfig.systemPrompt,
        temperature: aiConfig.temperature
      });
      if (!result.success || !result.reply) {
        throw new Error((result.error || 'The local model did not reply.') + ' Local AI is optional. Start Ollama / LM Studio or switch AI Settings to Built-in for offline commands.');
      }
      return result.reply;
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


