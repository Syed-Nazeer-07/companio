const { chromium } = require('playwright-core');
const { verifyNavigation } = require('./browserNavigationVerifier.cjs');

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
      const response = await page.goto('https://www.youtube.com', { waitUntil: 'domcontentloaded', timeout: 20000 });
      await this.dismissPopups(page);
      const title = await page.title();
      const navigation = verifyNavigation('https://www.youtube.com', page.url(), response?.status());
      const verified = navigation.verified && title.toLowerCase().includes('youtube');
      return {
        success: verified,
        message: verified ? 'YouTube homepage loaded.' : 'YouTube homepage could not be verified.',
        error: verified ? undefined : (navigation.error || 'The page title did not indicate YouTube.'),
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
      const query = specificTopic ? `${creatorQuery} ${specificTopic}` : `${creatorQuery}`;
      console.log(`[YouTube] Searching for creator: "${creatorQuery}", topic: "${specificTopic}"`);

      // Navigate directly to YouTube search results to avoid search bar rendering delays
      await page.goto(`https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`, { waitUntil: 'domcontentloaded', timeout: 25000 });
      await this.dismissPopups(page);

      // Wait for search results
      await page.waitForTimeout(1500);
      await page.waitForSelector('ytd-video-renderer, ytd-channel-renderer, a#video-title', { timeout: 15000 });

      // Click the first prominent video result
      const videoLink = page.locator('ytd-video-renderer a#video-title, a#video-title').first();
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
          return false;
        }
      });
      await page.waitForTimeout(1000);
      const confirmedPlaying = isPlaying && await page.evaluate(() => {
        const v = document.querySelector('video.html5-main-video');
        return !!v && !v.paused && !v.ended && v.readyState >= 2 && v.currentTime > 0;
      });
      const verified = confirmedPlaying && page.url().includes('/watch?v=');

      return {
        success: verified,
        creator: creatorQuery,
        videoTitle,
        url: page.url(),
        message: verified ? `Playing "${videoTitle}" on YouTube` : 'Video opened, but playback could not be verified.',
        error: verified ? undefined : 'YouTube playback was not confirmed.',
        verified
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
        const before = await page.evaluate(() => {
          const video = document.querySelector('video.html5-main-video');
          return video ? video.paused : null;
        });
        if (before === null) return { success: false, verified: false, error: 'No video player found' };
        const shouldToggle = action === 'toggle' || (action === 'pause' && !before) || (action === 'play' && before);
        if (shouldToggle) await page.keyboard.press('k');
        await page.waitForTimeout(500);
        const isPaused = await page.evaluate(() => {
          const video = document.querySelector('video.html5-main-video');
          return video ? video.paused : null;
        });
        const verified = isPaused !== null && (action === 'toggle' ? isPaused !== before
          : action === 'pause' ? isPaused === true : isPaused === false);
        return { success: verified, action, isPaused, verified,
          message: verified ? (isPaused ? 'YouTube video paused' : 'YouTube video playing') : 'Playback action could not be confirmed' };
      }
      if (action === 'fullscreen') {
        const before = await page.evaluate(() => !!document.fullscreenElement);
        await page.keyboard.press('f');
        await page.waitForTimeout(450);
        const after = await page.evaluate(() => !!document.fullscreenElement);
        const verified = before !== after;
        return { success: verified, verified, message: verified ? 'YouTube fullscreen toggled' : 'Fullscreen not confirmed' };
      }
      if (action === 'mute') {
        const before = await page.evaluate(() => document.querySelector('video.html5-main-video')?.muted);
        if (typeof before !== 'boolean') return { success: false, verified: false, error: 'No video player found' };
        await page.keyboard.press('m');
        await page.waitForTimeout(350);
        const after = await page.evaluate(() => document.querySelector('video.html5-main-video')?.muted);
        const verified = typeof after === 'boolean' && after !== before;
        return { success: verified, verified, message: verified ? 'YouTube mute toggled' : 'Mute toggle not confirmed' };
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
      const response = await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
      const title = await page.title();
      const navigation = verifyNavigation(targetUrl, page.url(), response?.status(), true);
      return {
        ...navigation,
        title,
        message: navigation.verified ? `Opened ${title || page.url()}` : 'The requested website could not be verified.'
      };
    } catch (err) {
      return { success: false, error: err.message, verified: false };
    }
  }

  // 5. Google Search
  async searchGoogle(query) {
    try {
      const page = await this.ensureBrowser();
      const requestedUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
      const response = await page.goto(requestedUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
      await this.dismissPopups(page);
      const navigation = verifyNavigation(requestedUrl, page.url(), response?.status(), true);
      return {
        ...navigation,
        message: navigation.verified ? `Google search page loaded for "${query}"` : 'Google search page could not be verified.'
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
      const failed = [];
      for (const url of urls) {
        const page = await this.context.newPage();
        try {
          const targetUrl = url.startsWith('http') ? url : `https://${url}`;
          const response = await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
          const navigation = verifyNavigation(targetUrl, page.url(), response?.status(), true);
          if (!navigation.success) throw new Error(navigation.error || 'Navigation was not verified');
          opened.push(navigation.url);
          this.activePage = page;
        } catch (err) {
          failed.push({ url, reason: err.message });
          await page.close().catch(() => {});
        }
      }
      const verified = failed.length === 0 && opened.length === urls.length;
      return {
        success: verified,
        message: verified ? `Opened ${opened.length} tabs` : `Opened ${opened.length} of ${urls.length} tabs; ${failed.length} failed`,
        tabs: opened,
        failed,
        verified
      };
    } catch (err) {
      return { success: false, error: err.message, verified: false };
    }
  }

  // 7. Close Current Tab
  async closeCurrentTab() {
    try {
      if (this.activePage && !this.activePage.isClosed()) {
        const closedPage = this.activePage;
        await closedPage.close();
        const verified = closedPage.isClosed();
        const pages = this.context.pages();
        this.activePage = pages.length > 0 ? pages[pages.length - 1] : null;
        return {
          success: verified,
          verified,
          message: verified ? 'Browser tab closed.' : 'Tab close could not be verified.',
          error: verified ? undefined : 'The browser did not confirm that the tab closed.'
        };
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
      const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
      const navigation = verifyNavigation(url, page.url(), response?.status());
      return {
        ...navigation,
        message: navigation.verified ? `${label} page loaded.` : `${label} could not be verified.`
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
