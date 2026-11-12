'use strict';

const { safeHttpUrl } = require('./requestValidation.cjs');

// The OS chooses the browser; a successful openExternal promise verifies only
// that Windows accepted the request. It does not verify page content or login.
class DefaultBrowserController {
  constructor(shellImpl, { handoffTimeoutMs = 8000 } = {}) {
    this.shell = shellImpl;
    this.handoffTimeoutMs = handoffTimeoutMs;
  }

  async open(url, description = 'website') {
    try {
      const destination = safeHttpUrl(url);
      if (!this.shell || typeof this.shell.openExternal !== 'function') {
        throw new Error('Windows default-browser handoff is unavailable.');
      }
      // Windows shell.openExternal normally settles quickly, but a stalled
      // browser association or shell must not leave Companio thinking forever.
      // Timing out is NOT proof that a browser did not eventually open.
      let timer;
      try {
        await Promise.race([
          Promise.resolve().then(() => this.shell.openExternal(destination, { activate: true })),
          new Promise((_, reject) => {
            timer = setTimeout(() => reject(new Error(
              'Windows did not acknowledge the browser request in time. The website may still open; check your browser before trying again.'
            )), this.handoffTimeoutMs);
          })
        ]);
      } finally {
        clearTimeout(timer);
      }
      return {
        success: true,
        verified: true,
        handoffOnly: true,
        verificationScope: 'windows-handoff',
        url: destination,
        message: 'Asked Windows to open ' + description + ' in your default browser. Check the browser tab to confirm it loaded.'
      };
    } catch (error) {
      return {
        success: false, verified: false, handoffOnly: false,
        error: error?.message || 'Could not open the default browser.'
      };
    }
  }

  searchGoogle(query) {
    return this.open('https://www.google.com/search?q=' + encodeURIComponent(query), 'Google search');
  }

  searchWikipedia(query) {
    return this.open('https://en.wikipedia.org/wiki/Special:Search?search=' + encodeURIComponent(query), 'Wikipedia search');
  }

  searchAmazon(query) {
    return this.open('https://www.amazon.com/s?k=' + encodeURIComponent(query), 'Amazon search');
  }

  searchMaps(query) {
    return this.open('https://www.google.com/maps/search/' + encodeURIComponent(query), 'Google Maps search');
  }
}

module.exports = { DefaultBrowserController };
