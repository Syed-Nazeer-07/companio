'use strict';

const { safeHttpUrl } = require('./requestValidation.cjs');

// The OS chooses the browser; a successful openExternal promise verifies only
// that Windows accepted the request. It does not verify page content or login.
class DefaultBrowserController {
  constructor(shellImpl) {
    this.shell = shellImpl;
  }

  async open(url, description = 'website') {
    try {
      const destination = safeHttpUrl(url);
      if (!this.shell || typeof this.shell.openExternal !== 'function') {
        throw new Error('Windows default-browser handoff is unavailable.');
      }
      await this.shell.openExternal(destination, { activate: true });
      return {
        success: true,
        verified: true,
        handoffOnly: true,
        verificationScope: 'windows-handoff',
        url: destination,
        message: 'Sent ' + description + ' to your default browser. The website itself has not been verified.'
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
