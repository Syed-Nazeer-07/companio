'use strict';

function normalName(name) {
  return String(name || '').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
}

// "Official" or "Fan" lookalikes do not count as a match. Results come from
// live YouTube pages; trust neither a search ranking nor a claimed author.
function channelMatches(requested, observed) {
  const expected = normalName(requested);
  const actual = normalName(observed);
  return expected.length >= 3 && expected === actual;
}

function channelVideosUrl(link) {
  try {
    const parsed = new URL(link, 'https://www.youtube.com');
    if (parsed.protocol !== 'https:' || !['www.youtube.com','youtube.com'].includes(parsed.hostname) ||
        parsed.username || parsed.password) return null;
    const channel = parsed.pathname.replace(/\/+$/, '');
    if (!/^\/(?:@[\w.-]{2,100}|channel\/UC[\w-]{12,}|c\/[\w.-]{2,100})$/.test(channel)) return null;
    return 'https://www.youtube.com' + channel + '/videos';
  } catch {
    return null;
  }
}

module.exports = { channelMatches, channelVideosUrl };
