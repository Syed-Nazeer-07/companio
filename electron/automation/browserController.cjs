const { chromium } = require('playwright-core');
const { verifyNavigation } = require('./browserNavigationVerifier.cjs');
const { channelMatches, channelVideosUrl, isYouTubeWatchUrl } = require('./youtubeChannelSafety.cjs');

class BrowserController {
  constructor({ chromiumImpl = chromium, profileDirectory = null } = {}) {
    this.chromium = chromiumImpl;
    this.profileDirectory = profileDirectory;
    this.context = null;
    this.activePage = null;
    this.launchPromise = null;
  }

  configureProfileDirectory(directory) {
    const path = require('node:path');
    if (typeof directory !== 'string' || !path.isAbsolute(directory)) {
      throw new Error('The controlled-browser profile must be in an absolute local directory.');
    }
    if (this.context || this.launchPromise) {
      throw new Error('Cannot switch the browser profile while the controlled browser is running.');
    }
    this.profileDirectory = directory;
  }

  async launchControlledBrowser() {
    if (!this.profileDirectory) {
      throw new Error('Companio controlled-browser profile has not been configured.');
    }
    let context;
    try {
      context = await this.chromium.launchPersistentContext(this.profileDirectory, {
        channel: 'msedge',
        headless: false,
        viewport: null,
        args: ['--start-maximized']
      });
    } catch (error) {
      throw new Error(
        'Could not launch the Companio-controlled Microsoft Edge session. ' +
        'Check that Edge is installed and close any other window using the Companio browser profile. ' +
        (error?.message || '')
      );
    }
    this.context = context;
    context.on('close', () => {
      if (this.context === context) {
        this.context = null;
        this.activePage = null;
      }
    });
    context.on('page', page => {
      // Follow tabs opened manually or by a site inside this dedicated profile.
      // Closed profiles must not overwrite a newer browser session.
      if (this.context === context) this.activePage = page;
    });
    // A persistent context may already contain a restored page; do not open
    // needless blank tabs or discard existing profile cookies/local storage.
    const existing = context.pages().filter(page => !page.isClosed());
    this.activePage = existing[existing.length - 1] || await context.newPage();
    return this.activePage;
  }

  async ensureBrowser() {
    // Multiple commands arriving together must not launch Edge twice with
    // the same profile directory (Chromium would reject the second lock).
    if (this.launchPromise) return this.launchPromise;
    if (!this.context) {
      this.launchPromise = this.launchControlledBrowser();
      try {
        return await this.launchPromise;
      } finally {
        this.launchPromise = null;
      }
    }
    if (!this.activePage || this.activePage.isClosed()) {
      const pages = this.context.pages().filter(page => !page.isClosed());
      this.activePage = pages[pages.length - 1] || await this.context.newPage();
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

  // 2. Locate a matching creator and verify actual playback.
  // Latest mode is intentionally conservative: it never silently plays a
  // highly-ranked search result instead of the creator's latest upload.
  async searchAndPlayYouTube(creatorQuery, specificTopic = '', latest = false) {
    try {
      if (typeof creatorQuery !== 'string' || creatorQuery.trim().length < 3 ||
          typeof specificTopic !== 'string' || typeof latest !== 'boolean') {
        throw new Error('YouTube needs a valid creator, optional topic and latest flag.');
      }
      if (latest && specificTopic.trim()) {
        throw new Error('Cannot guarantee the latest upload for a specific topic. Try the creator alone.');
      }

      const page = await this.ensureBrowser();
      const query = specificTopic ? creatorQuery + ' ' + specificTopic : creatorQuery;
      const url = 'https://www.youtube.com/results?search_query=' + encodeURIComponent(query);
      const searchResponse = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 25000 });
      const searchNavigation = verifyNavigation(url, page.url(), searchResponse?.status(), true);
      if (!searchNavigation.success) throw new Error(searchNavigation.error || 'YouTube search did not load.');
      await this.dismissPopups(page);

      let videoLink;
      let creatorConfirmed = false;
      if (latest) {
        await page.waitForSelector('ytd-channel-renderer', { timeout: 14000 });
        const candidates = page.locator('ytd-channel-renderer');
        const count = Math.min(await candidates.count(), 8);
        let videosUrl = null;
        for (let i = 0; i < count; i++) {
          const channelLink = candidates.nth(i).locator('a#main-link').first();
          const observed = (await channelLink.innerText().catch(() => '')).trim();
          const href = await channelLink.getAttribute('href').catch(() => null);
          if (channelMatches(creatorQuery, observed) && href) {
            videosUrl = channelVideosUrl(href);
            if (videosUrl) {
              creatorConfirmed = true;
              break;
            }
          }
        }
        if (!videosUrl) {
          throw new Error('Cannot confirm an exact YouTube channel matching "' + creatorQuery + '". No video was played.');
        }

        const channelResponse = await page.goto(videosUrl, { waitUntil: 'domcontentloaded', timeout: 25000 });
        const channelNavigation = verifyNavigation(videosUrl, page.url(), channelResponse?.status());
        if (!channelNavigation.success) throw new Error(channelNavigation.error || 'YouTube channel videos did not load.');

        // Explicitly select "Latest" rather than assuming the default tab is
        // chronologically sorted. If YouTube changes its UI, fail safely.
        const latestChip = page.getByText('Latest', { exact: true }).first();
        try {
          await latestChip.waitFor({ state: 'visible', timeout: 7000 });
        } catch {
          throw new Error('YouTube did not expose the Latest upload filter. Cannot guarantee newest-video selection.');
        }
        await latestChip.click();
        await page.waitForSelector('ytd-rich-grid-media a#video-title-link, ytd-grid-video-renderer a#video-title', { timeout: 15000 });
        videoLink = page.locator('ytd-rich-grid-media a#video-title-link, ytd-grid-video-renderer a#video-title').first();
      } else {
        await page.waitForSelector('ytd-video-renderer', { timeout: 15000 });
        const videos = page.locator('ytd-video-renderer');
        const count = Math.min(await videos.count(), 12);
        for (let i = 0; i < count; i++) {
          const candidate = videos.nth(i);
          const observed = (await candidate.locator('ytd-channel-name a').first().innerText().catch(() => '')).trim();
          if (channelMatches(creatorQuery, observed)) {
            creatorConfirmed = true;
            videoLink = candidate.locator('a#video-title').first();
            break;
          }
        }
        if (!videoLink) {
          throw new Error('No search result was confirmed as a video from "' + creatorQuery + '". No unrelated result was played.');
        }
      }

      await videoLink.waitFor({ state: 'visible', timeout: 10000 });
      const videoTitle = (await videoLink.innerText()).trim();
      await videoLink.click();
      await page.waitForSelector('video.html5-main-video', { timeout: 15000 });
      const requestedPlay = await page.evaluate(async () => {
        const video = document.querySelector('video.html5-main-video');
        if (!video) return false;
        try {
          if (video.paused) await video.play();
          return !video.paused;
        } catch {
          return false;
        }
      });
      await page.waitForTimeout(1200);
      const confirmedPlaying = requestedPlay && await page.evaluate(() => {
        const video = document.querySelector('video.html5-main-video');
        return !!video && !video.paused && !video.ended && video.readyState >= 2 && video.currentTime > 0;
      });
      const final = new URL(page.url());
      const verified = !!confirmedPlaying && ['youtube.com','www.youtube.com'].includes(final.hostname) &&
        final.pathname === '/watch' && !!final.searchParams.get('v') && creatorConfirmed;
      return {
        success: verified,
        verified,
        creator: creatorQuery,
        creatorConfirmed,
        latestRequested: latest,
        videoTitle,
        url: page.url(),
        message: verified
          ? (latest ? 'Playing the first video in the Latest tab of ' + creatorQuery + ': "' + videoTitle + '"' : 'Playing "' + videoTitle + '" on YouTube.')
          : 'A matching video opened, but its playback could not be verified.',
        error: verified ? undefined : 'YouTube playback or creator identity was not confirmed.'
      };
    } catch (error) {
      return {
        success: false,
        verified: false,
        error: error.message || 'Cannot verify the requested YouTube video.'
      };
    }
  }

  // 3. Control YouTube playback (Pause / Resume / Fullscreen)
  async controlYouTube(action) {
    try {
      const page = await this.ensureBrowser();
      if (!isYouTubeWatchUrl(page.url())) {
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
        const verified = isYouTubeWatchUrl(page.url()) && isPaused !== null && (action === 'toggle' ? isPaused !== before
          : action === 'pause' ? isPaused === true : isPaused === false);
        return { success: verified, action, isPaused, verified,
          message: verified ? (isPaused ? 'YouTube video paused' : 'YouTube video playing') : 'Playback action could not be confirmed' };
      }
      if (action === 'fullscreen') {
        const before = await page.evaluate(() => !!document.fullscreenElement);
        await page.keyboard.press('f');
        await page.waitForTimeout(450);
        const after = await page.evaluate(() => !!document.fullscreenElement);
        const verified = isYouTubeWatchUrl(page.url()) && before !== after;
        return { success: verified, verified, message: verified ? 'YouTube fullscreen toggled' : 'Fullscreen not confirmed' };
      }
      if (action === 'mute') {
        const before = await page.evaluate(() => document.querySelector('video.html5-main-video')?.muted);
        if (typeof before !== 'boolean') return { success: false, verified: false, error: 'No video player found' };
        await page.keyboard.press('m');
        await page.waitForTimeout(350);
        const after = await page.evaluate(() => document.querySelector('video.html5-main-video')?.muted);
        const verified = isYouTubeWatchUrl(page.url()) && typeof after === 'boolean' && after !== before;
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
module.exports.BrowserController = BrowserController;
