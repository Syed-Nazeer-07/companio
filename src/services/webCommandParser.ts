// Strict, fast grammar for user-requested website navigation. URLs never run
// through a model or get interpreted as shell commands.
export type WebCommand = {
  tool: 'browser.open_url' | 'browser.search_google';
  params: { url: string } | { query: string };
  description: string;
};

const WELL_KNOWN_SITES: Record<string, string> = {
  'wikipedia': 'https://www.wikipedia.org',
  'amazon': 'https://www.amazon.com',
  'instagram': 'https://www.instagram.com',
  'facebook': 'https://www.facebook.com',
  'stack overflow': 'https://stackoverflow.com',
  'leetcode': 'https://leetcode.com',
  'neetcode': 'https://neetcode.io',
  'codeforces': 'https://codeforces.com',
  'coursera': 'https://www.coursera.org',
  'geeksforgeeks': 'https://www.geeksforgeeks.org',
  'google': 'https://www.google.com',
  'google maps': 'https://www.google.com/maps',
  'google drive': 'https://drive.google.com',
  'google docs': 'https://docs.google.com',
  'google classroom': 'https://classroom.google.com',
  'hacker news': 'https://news.ycombinator.com',
  'quora': 'https://www.quora.com',
  'python documentation': 'https://docs.python.org/3/',
  'microsoft learn': 'https://learn.microsoft.com',
  'khan academy': 'https://www.khanacademy.org',
  'google sheets': 'https://sheets.google.com',
  'google calendar': 'https://calendar.google.com',
  'perplexity': 'https://www.perplexity.ai',
  'freecodecamp': 'https://www.freecodecamp.org',
  'free code camp': 'https://www.freecodecamp.org',
  'mdn': 'https://developer.mozilla.org',
  'hugging face': 'https://huggingface.co',
  'arxiv': 'https://arxiv.org',
  'figma': 'https://www.figma.com',
  'canva': 'https://www.canva.com',
  'npm': 'https://www.npmjs.com',
  'pypi': 'https://pypi.org',
  'twitter': 'https://x.com'
};

export function parseWebCommand(input: string): WebCommand | null {
  if (typeof input !== 'string' || input.length > 2048) return null;
  const trimmed = input.trim();
  if (!trimmed) return null;
  // Spoken push-to-talk often starts with the character's name; remove only
  // that exact wake prefix. The action guard separately checks the remainder.
  const normalized = trimmed.replace(/^(?:(?:hey|hi|ok|okay)\s+)?companio(?:\s*[,:\-]\s*|\s+)(?=\S)/i, '').trim();

  // Direct searches on popular sites use the user's real default browser,
  // without opening an isolated Edge automation profile or using an LLM.
  const destinations: Record<string, (query: string) => string> = {
    youtube: q => 'https://www.youtube.com/results?search_query=' + encodeURIComponent(q),
    wikipedia: q => 'https://en.wikipedia.org/wiki/Special:Search?search=' + encodeURIComponent(q),
    github: q => 'https://github.com/search?q=' + encodeURIComponent(q) + '&type=repositories',
    reddit: q => 'https://www.reddit.com/search/?q=' + encodeURIComponent(q),
    'google maps': q => 'https://www.google.com/maps/search/' + encodeURIComponent(q),
    'stack overflow': q => 'https://stackoverflow.com/search?q=' + encodeURIComponent(q)
  };
  const lead = normalized.replace(/^(?:please\s+)?(?:(?:can|could|would)\s+you\s+)?(?:please\s+)?/i, '');
  const siteFirst = lead.match(/^search\s+(?:(?:on|in)\s+)?(youtube|wikipedia|github|reddit|google maps|stack overflow)\s+(?:for|about)\s+(.+?)\s*[.!?]?$/i);
  const termFirst = lead.match(/^(?:search\s+for|look\s+up|find)\s+(.+?)\s+(?:on|in)\s+(youtube|wikipedia|github|reddit|google maps|stack overflow)\s*[.!?]?$/i);
  const videoSearch = lead.match(/^find\s+(?:videos?|tutorials?)\s+(?:about|for|on)\s+(.+?)\s+on\s+youtube\s*[.!?]?$/i);
  const provider = siteFirst?.[1] || (videoSearch ? 'youtube' : termFirst?.[2]);
  const term = siteFirst?.[2] || videoSearch?.[1] || termFirst?.[1];
  if (provider && term) {
    const query = term.trim().replace(/[!?]+$/, '').trim();
    const site = provider.toLowerCase();
    if (!query || query.length > 500) return null;
    const destination = destinations[site];
    if (!destination) return null;
    return {
      tool: 'browser.open_url',
      params: { url: destination(query) },
      description: 'Search ' + provider + ' for ' + query
    };
  }

  const search = normalized.match(/^(?:please\s+)?(?:(?:can|could|would)\s+you\s+)?(?:search\s+(?:(?:the\s+)?web|(?:the\s+)?internet|google|on\s+google|(?:in\s+)?(?:my\s+)?default\s+browser)\s+for|search\s+for|look\s+up)\s+(.+?)\s*[.!?]?$/i);
  if (search) {
    const query = search[1].trim();
    if (query && query.length <= 1024) {
      return { tool: 'browser.search_google', params: { query }, description: 'Search the web for ' + query };
    }
    return null;
  }

  const requested = normalized.match(/^(?:please\s+)?(?:(?:can|could|would)\s+you\s+)?(?:open|visit|go\s+to|browse|launch)\s+(?:(?:the|website|site)\s+)?(.+?)\s*[.!?]?$/i);
  if (!requested) return null;
  const address = requested[1].trim().replace(/[.!]$/, '');
  const known = WELL_KNOWN_SITES[address.toLowerCase()];
  if (known) return { tool: 'browser.open_url', params: { url: known }, description: 'Open ' + address };
  const isAddress = /^(?:(?:https?:\/\/)?(?:www\.)?)(?:[a-z\d](?:[a-z\d-]{0,61}[a-z\d])?\.)+[a-z]{2,63}(?::\d{2,5})?(?:[/?#][^\s]*)?$/i.test(address);
  if (!isAddress || address.length > 2048) return null;
  // The native process validates the complete URI again before handing it to
  // Windows. Frontend matching is only intent detection, not a trust boundary.
  return { tool: 'browser.open_url', params: { url: address }, description: 'Open website ' + address };
}
