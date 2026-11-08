// Strict, fast grammar for user-requested website navigation. URLs never run
// through a model or get interpreted as shell commands.
export type WebCommand = {
  tool: 'browser.open_url' | 'browser.search_google';
  params: { url: string } | { query: string };
  description: string;
};

export function parseWebCommand(input: string): WebCommand | null {
  if (typeof input !== 'string' || input.length > 2048) return null;
  const trimmed = input.trim();
  if (!trimmed) return null;

  const search = trimmed.match(/^(?:please\s+)?(?:search\s+(?:the\s+)?web\s+for|search\s+for|look\s+up)\s+(.+?)[.!]?$/i);
  if (search) {
    const query = search[1].trim();
    if (query && query.length <= 1024) {
      return { tool: 'browser.search_google', params: { query }, description: 'Search the web for ' + query };
    }
    return null;
  }

  const requested = trimmed.match(/^(?:please\s+)?(?:(?:can|could|would)\s+you\s+)?(?:open|visit|go\s+to|browse|launch)\s+(?:(?:the|website|site)\s+)?(\S+)\s*[.!]?$/i);
  if (!requested) return null;
  const address = requested[1].replace(/[.!]$/, '');
  const isAddress = /^(?:(?:https?:\/\/)?(?:www\.)?)(?:[a-z\d](?:[a-z\d-]{0,61}[a-z\d])?\.)+[a-z]{2,63}(?::\d{2,5})?(?:[/?#][^\s]*)?$/i.test(address);
  if (!isAddress || address.length > 2048) return null;
  // The native process validates the complete URI again before handing it to
  // Windows. Frontend matching is only intent detection, not a trust boundary.
  return { tool: 'browser.open_url', params: { url: address }, description: 'Open website ' + address };
}
