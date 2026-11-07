'use strict';
// Validates all renderer-supplied data before invoking native Windows commands.
const texts = {
  'browser.youtube.search_and_play': ['creator', 'topic'],
  'browser.search_google': ['query'],
  'browser.wikipedia.search': ['query'],
  'browser.amazon.search': ['query'],
  'browser.maps.search': ['query', 'location'],
  'win.explorer.open': ['folder'],
  'win.vscode.launch': ['path'],
  'win.spotify.play_track': ['query'],
  'win.settings.category': ['category']
};
const numbers = {
  'win.volume.set': { level: [0, 100] },
  'win.volume.change': { delta: [-100, 100] },
  'win.brightness.set': { level: [0, 100] },
  'win.brightness.change': { delta: [-100, 100] }
};
const choices = {
  'browser.youtube.control': { action: ['pause','play','toggle','fullscreen','mute'] },
  'win.media.control': { action: ['play','pause','toggle','next','previous'] }
};
const required = {
  'browser.youtube.search_and_play':['creator'], 'browser.search_google':['query'],
  'browser.wikipedia.search':['query'], 'browser.amazon.search':['query'],
  'win.spotify.play_track':['query'], 'browser.youtube.control':['action'],
  'win.media.control':['action'], 'browser.open_url':['url'], 'browser.open_tabs':['urls'],
  'win.volume.set':['level'], 'win.volume.change':['delta'], 'win.volume.mute':['mute'],
  'win.brightness.set':['level'], 'win.brightness.change':['delta']
};
const error = (message) => ({ success: false, error: message });

function safeHttpUrl(input) {
  if (typeof input !== 'string' || !input.trim() || input.length > 2048 || /[\u0000-\u001f\u007f]/.test(input)) throw Error('Invalid URL');
  const value = input.trim();
  if (/^[a-zA-Z][\w+.-]*:/.test(value) && !/^https?:\/\//i.test(value)) throw Error('Only HTTP and HTTPS URLs are supported');
  const parsed = new URL(/^https?:\/\//i.test(value) ? value : 'https://' + value);
  if (!['http:', 'https:'].includes(parsed.protocol) || !parsed.hostname || parsed.username || parsed.password) throw Error('Invalid website address');
  return parsed.href;
}

function validateToolRequest(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload) || typeof payload.toolName !== 'string' || !/^(browser|win)\.[a-z0-9_.]+$/.test(payload.toolName)) return error('Invalid tool request');
  const toolName = payload.toolName;
  const input = payload.params == null ? {} : payload.params;
  if (!input || typeof input !== 'object' || Array.isArray(input)) return error('Invalid tool parameters');
  const allowed = new Set([...(texts[toolName] || []), ...Object.keys(numbers[toolName] || {}), ...Object.keys(choices[toolName] || {})]);
  if (toolName === 'browser.open_url') allowed.add('url');
  if (toolName === 'browser.open_tabs') allowed.add('urls');
  if (toolName === 'win.volume.mute') allowed.add('mute');
  if (toolName === 'browser.youtube.search_and_play') allowed.add('latest');
  const params = {};
  try {
    for (const [key, value] of Object.entries(input)) {
      if (!allowed.has(key)) return error('Unexpected parameter: ' + key);
      if ((texts[toolName] || []).includes(key)) {
        if (typeof value !== 'string' || value.length > 1024 || /[\u0000-\u001f\u007f]/.test(value)) return error('Invalid text parameter: ' + key);
        params[key] = value.trim();
      } else if (Object.hasOwn(numbers[toolName] || {}, key)) {
        const [lo, hi] = numbers[toolName][key];
        if (typeof value !== 'number' || !Number.isFinite(value) || value < lo || value > hi) return error('Invalid numeric parameter: ' + key);
        params[key] = value;
      } else if (Object.hasOwn(choices[toolName] || {}, key)) {
        if (!choices[toolName][key].includes(value)) return error('Invalid action: ' + key);
        params[key] = value;
      } else if (key === 'latest') {
        if (typeof value !== 'boolean') return error('Latest must be true or false');
        params.latest = value;
      } else if (key === 'mute') {
        if (typeof value !== 'boolean') return error('Mute must be true or false');
        params[key] = value;
      } else if (key === 'url') params[key] = safeHttpUrl(value);
      else if (key === 'urls') {
        if (!Array.isArray(value) || value.length < 1 || value.length > 10) return error('Only 1–10 URLs may be opened');
        params[key] = value.map(safeHttpUrl);
      }
    }
    for (const key of required[toolName] || []) if (!Object.hasOwn(params, key) || params[key] === '') return error('Missing parameter: ' + key);
    if (toolName === 'browser.maps.search' && !params.query && !params.location) return error('Missing location');
    return { success: true, toolName, params };
  } catch (err) { return error(err.message); }
}

function validateShortcut(value) {
  if (typeof value !== 'string' || value.length > 50) return error('Invalid shortcut');
  const parts = value.replace(/\s/g, '').split('+');
  const modifiers = new Set();
  let key = null;
  for (const part of parts) {
    const token = part.toLowerCase();
    if (['ctrl', 'control', 'commandorcontrol'].includes(token)) modifiers.add('CommandOrControl');
    else if (token === 'alt') modifiers.add('Alt');
    else if (token === 'shift') modifiers.add('Shift');
    else if (/^(?:[a-z]|space|f(?:[1-9]|1[0-2]))$/.test(token) && key === null) key = token === 'space' ? 'Space' : token.toUpperCase();
    else return error('Shortcut must contain modifiers and one letter, F1–F12 or Space');
  }
  if (modifiers.size === 0 || !key) return error('Shortcut needs a modifier and a key');
  return { success: true, shortcut: [...['CommandOrControl', 'Alt', 'Shift'].filter((x) => modifiers.has(x)), key].join('+') };
}
module.exports = { safeHttpUrl, validateToolRequest, validateShortcut };
