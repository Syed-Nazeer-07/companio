'use strict';

function normalizedHost(value) {
  return value.hostname.toLowerCase().replace(/^www\./, '');
}

// A successful Playwright goto means a response was received, not that the
// intended destination loaded. Verify response status and destination.
function verifyNavigation(requestedUrl, finalUrl, httpStatus, strictPath = false) {
  try {
    const expected = new URL(requestedUrl);
    const actual = new URL(finalUrl);
    if (!['http:', 'https:'].includes(expected.protocol) || !['http:', 'https:'].includes(actual.protocol)) {
      throw new Error('Browser navigation did not return an HTTP(S) page.');
    }
    if (!Number.isInteger(httpStatus) || httpStatus < 200 || httpStatus >= 400) {
      throw new Error('The destination returned HTTP ' + (httpStatus ?? 'unknown') + '.');
    }
    if (expected.protocol === 'https:' && actual.protocol !== 'https:') {
      throw new Error('Navigation was redirected to an insecure HTTP page.');
    }
    if (normalizedHost(expected) !== normalizedHost(actual)) {
      throw new Error('Navigation redirected to a different website: ' + actual.hostname + '.');
    }
    if (strictPath) {
      const canonical = value => value.pathname.replace(/\/+$/, '') || '/';
      if (canonical(expected) !== canonical(actual)) {
        throw new Error('The browser did not reach the requested page path.');
      }
      for (const [key, value] of expected.searchParams) {
        if (!actual.searchParams.getAll(key).includes(value)) {
          throw new Error('The destination changed or removed requested URL parameters.');
        }
      }
    }
    return { success: true, verified: true, url: actual.href };
  } catch (error) {
    return { success: false, verified: false, error: error.message || 'Navigation could not be verified.' };
  }
}

module.exports = { verifyNavigation };
