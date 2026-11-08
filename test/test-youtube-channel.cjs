'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const {channelMatches,channelVideosUrl,isYouTubeWatchUrl} = require('../electron/automation/youtubeChannelSafety.cjs');

test('creator name must match the observed channel, not an impersonator',()=>{
  assert.equal(channelMatches('CarryMinati','CarryMinati'),true);
  assert.equal(channelMatches('Bro Code','Bro Code ✓'),true);
  assert.equal(channelMatches('CarryMinati','CarryMinati Official Fan'),false);
  assert.equal(channelMatches('Bro Code','Bro Code Clips'),false);
  assert.equal(channelMatches('AB','AB'),false);
});

test('only safe YouTube channel URLs can become a latest-uploads page',()=>{
  assert.equal(channelVideosUrl('/@CarryMinati'),'https://www.youtube.com/@CarryMinati/videos');
  assert.equal(channelVideosUrl('https://youtube.com/@BroCode/'),'https://www.youtube.com/@BroCode/videos');
  assert.equal(channelVideosUrl('/channel/UCabcdefghijklmnopqrstuv'),'https://www.youtube.com/channel/UCabcdefghijklmnopqrstuv/videos');
  for (const link of [
    'https://evil.example/@CarryMinati','javascript:alert(1)',
    'https://www.youtube.com/watch?v=evil','//evil.example/@CarryMinati',
    '/@CarryMinati/../../watch','https://user:secret@youtube.com/@CarryMinati',
    '/@CarryMinati/videos?sort=p'
  ]) assert.equal(channelVideosUrl(link),null,link);
});

test('YouTube controls only trust exact HTTPS watch pages', () => {
  assert.equal(isYouTubeWatchUrl('https://www.youtube.com/watch?v=abcdefghijk'), true);
  assert.equal(isYouTubeWatchUrl('https://youtube.com/watch?v=abcdefghijk&t=90'), true);
  for (const url of [
    'https://fake.example/?next=youtube.com/watch?v=abcdefghijk',
    'https://youtube.com.evil.example/watch?v=abcdefghijk',
    'http://youtube.com/watch?v=abcdefghijk',
    'https://youtube.com/redirect?next=/watch?v=abcdefghijk',
    'https://youtube.com/watch?v=',
    'https://user:pass@youtube.com/watch?v=abcdefghijk',
    'javascript:alert(1)'
  ]) assert.equal(isYouTubeWatchUrl(url), false, url);
});

test('YouTube controller never controls a spoofed video page', async () => {
  const { BrowserController } = require('../electron/automation/browserController.cjs');
  const controller = new BrowserController();
  let evaluated = false;
  controller.ensureBrowser = async () => ({
    url: () => 'https://fake.example/?next=youtube.com/watch?v=abcdefghijk',
    evaluate: async () => { evaluated = true; return false; },
    keyboard: { press: async () => {} }
  });
  const result = await controller.controlYouTube('pause');
  assert.equal(result.success, false);
  assert.equal(result.verified, false);
  assert.equal(evaluated, false);
});
