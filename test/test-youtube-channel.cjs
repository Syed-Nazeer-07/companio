'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const {channelMatches,channelVideosUrl} = require('../electron/automation/youtubeChannelSafety.cjs');

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
