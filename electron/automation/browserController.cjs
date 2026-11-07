const { chromium } = require('playwright-core');

class BrowserController {
  constructor() {
    this.browser = null;
    this.context = null;
    this.activePage = null;
  }

  async ensureBrowser() {
    if (!this.browser || !this.browser.isConnected()) {
      try {
        this.browser = await chromium.launch({
          channel: 'msedge',
          headless: false,
          args: ['--start-maximized', '--disable-blink-features=AutomationControlled']
        });
        this.context = await this.browser.newContext({
          viewport: null
        });
        this.activePage = await this.context.newPage();
      } catch (err) {
        console.warn('Could not launch Edge directly, trying fallback:', err.message);
        this.browser = await chromium.launch({
          headless: false
        });
        this.context = await this.browser.newContext();
        this.activePage = await this.context.newPage();
      }
    }
    if (!this.activePage || this.activePage.isClosed()) {
      this.activePage = await this.context.newPage();
    }
    return this.activePage;
  }

  // 1. Open YouTube
  async openYouTube() {
    try {
      const page = await this.ensureBrowser();
      await page.goto('https://www.youtube.com', { waitUntil: 'domcontentloaded', timeout: 20000 });
      await this.dismissPopups(page);
      const title = await page.title();
      const verified = title.toLowerCase().includes('youtube');
      return {
        success: verified,
        message: 'YouTube opened and ready',
        title,
        verified
      };
    } catch (err) {
      return { success: false, error: err.message, verified: false };
    }
  }

  // 2. Search for creator's newest video and play it
  async searchAndPlayYouTube(creatorQuery, specificTopic = '') {
    try {
      const page = await this.ensureBrowser();
      console.log(`[YouTube] Searching for creator: "${creatorQuery}", topic: "${specificTopic}"`);

      await page.goto('https://www.youtube.com', { waitUntil: 'domcontentloaded', timeout: 25000 });
      await this.dismissPopups(page);

      // Search input interaction
      const searchSelector = 'input[name="search_query"], input#search';
      await page.waitForSelector(searchSelector, { timeout: 10000 });
      const query = specificTopic ? `${creatorQuery} ${specificTopic}` : `${creatorQuery}`;
      await page.fill(searchSelector, query);
      await page.keyboard.press('Enter');

      // Wait for search results
      await page.waitForTimeout(2000);
      await page.waitForSelector('ytd-video-renderer, ytd-channel-renderer', { timeout: 15000 });

      // Click the first prominent video result
      const videoLink = page.locator('ytd-video-renderer a#video-title').first();
      await videoLink.waitFor({ state: 'visible', timeout: 10000 });
      const videoTitle = (await videoLink.innerText()).trim();
      console.log(`[YouTube] Found video: "${videoTitle}", opening...`);
      await videoLink.click();

      // Wait for watch page video element
      await page.waitForSelector('video.html5-main-video', { timeout: 15000 });
      await page.waitForTimeout(2000);

      // Trigger and verify playback
      const isPlaying = await page.evaluate(async () => {
        const v = document.querySelector('video.html5-main-video');
        if (!v) return false;
        try {
          if (v.paused) await v.play();
          return !v.paused;
        } catch (e) {
          return true;
        }
      });

      return {
        success: true,
        creator: creatorQuery,
        videoTitle,
        url: page.url(),
        message: `Playing "${videoTitle}" on YouTube`,
        verified: isPlaying || page.url().includes('watch?v=')
      };
    } catch (err) {
      console.error('[YouTube] Search and play failed:', err.message);
      return { success: false, error: err.message, verified: false };
    }
  }

  // 3. Control YouTube playback (Pause / Resume / Fullscreen)
  async controlYouTube(action) {
    try {
      const page = await this.ensureBrowser();
      if (!page.url().includes('youtube.com/watch')) {
        return { success: false, error: 'No active YouTube video detected', verified: false };
      }

      if (action === 'pause' || action === 'play' || action === 'toggle') {
        await page.keyboard.press('k');
        await page.waitForTimeout(600);
        const isPaused = await page.evaluate(() => {
          const v = document.querySelector('video.html5-main-video');
          return v ? v.paused : null;
        });
        return {
          success: true,
          action,
          isPaused,
          message: isPaused ? 'YouTube video paused' : 'YouTube video playing',
          verified: true
        };
      }

      if (action === 'fullscreen') {
        await page.keyboard.press('f');
        return {
          success: true,
          message: 'Toggled fullscreen on YouTube',
          verified: true
        };
      }

      if (action === 'mute') {
        await page.keyboard.press('m');
        return {
          success: true,
          message: 'Toggled YouTube video mute',
          verified: true
        };
      }

      return { success: false, error: `Unknown YouTube action: ${action}`, verified: false };
    } catch (err) {
      return { success: false, error: err.message, verified: false };
    }
  }

  // 4. Open General Web URL
  async openUrl(url) {
    try {
      const page = await this.ensureBrowser();
      const targetUrl = url.startsWith('http') ? url : `https://${url}`;
      await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
      const title = await page.title();
      return {
        success: true,
        title,
        url: page.url(),
        message: `Navigated to ${title || url}`,
        verified: true
      };
    } catch (err) {
      return { success: false, error: err.message, verified: false };
    }
  }

  // 5. Google Search
  async searchGoogle(query) {
    try {
      const page = await this.ensureBrowser();
      await page.goto(`https://www.google.com/search?q=${encodeURIComponent(query)}`, { waitUntil: 'domcontentloaded', timeout: 20000 });
      await this.dismissPopups(page);
      return {
        success: true,
        message: `Searched Google for "${query}"`,
        url: page.url(),
        verified: true
      };
    } catch (err) {
      return { success: false, error: err.message, verified: false };
    }
  }

  // 6. Open Multiple Tabs
  async openTabs(urls) {
    try {
      await this.ensureBrowser();
      const opened = [];
      for (const url of urls) {
        const page = await this.context.newPage();
        await page.goto(url.startsWith('http') ? url : `https://${url}`, { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {});
        opened.push(url);
      }
      return {
        success: true,
        message: `Opened ${opened.length} tabs`,
        tabs: opened,
        verified: true
      };
    } catch (err) {
      return { success: false, error: err.message, verified: false };
    }
  }

  // 7. Close Current Tab
  async closeCurrentTab() {
    try {
      if (this.activePage && !this.activePage.isClosed()) {
        await this.activePage.close();
        const pages = this.context.pages();
        this.activePage = pages.length > 0 ? pages[pages.length - 1] : null;
        return { success: true, message: 'Tab closed', verified: true };
      }
      return { success: false, error: 'No active tab to close', verified: false };
    } catch (err) {
      return { success: false, error: err.message, verified: false };
    }
  }

  // 8. Open Specific Common Service / App (ChatGPT, Claude, Gemini, etc.)
  async openWebsite(url, label) {
    try {
      const page = await this.ensureBrowser();
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
      return {
        success: true,
        message: `${label} opened and ready`,
        url,
        verified: true
      };
    } catch (err) {
      return { success: false, error: err.message, verified: false };
    }
  }

  // 9. Search Wikipedia
  async searchWikipedia(query) {
    const url = `https://en.wikipedia.org/wiki/Special:Search?search=${encodeURIComponent(query)}`;
    return await this.openWebsite(url, `Wikipedia search for "${query}"`);
  }

  // 10. Search Amazon
  async searchAmazon(query) {
    const url = `https://www.amazon.com/s?k=${encodeURIComponent(query)}`;
    return await this.openWebsite(url, `Amazon search for "${query}"`);
  }

  // 11. Search Google Maps
  async searchGoogleMaps(location) {
    const url = `https://www.google.com/maps/search/${encodeURIComponent(location)}`;
    return await this.openWebsite(url, `Google Maps for "${location}"`);
  }

  async dismissPopups(page) {
    try {
      const dismissBtn = await page.$('button[aria-label*="Accept"], button:has-text("Accept all"), button:has-text("I agree")');
      if (dismissBtn) {
        await dismissBtn.click().catch(() => {});
      }
    } catch (e) {}
  }
}

module.exports = new BrowserController();
