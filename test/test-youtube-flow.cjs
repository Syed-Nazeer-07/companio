'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { BrowserController } = require('../electron/automation/browserController.cjs');

function fakeYoutube({channelName = 'CarryMinati', showLatest = true, status = 200, searchName = 'CarryMinati'} = {}) {
  let url = '';
  let clicks = 0;
  let sorted = false;
  const videoLink = {
    waitFor:async()=>{},
    innerText:async()=> 'Newest creator video',
    click:async()=>{clicks++;url='https://www.youtube.com/watch?v=verified123';}
  };
  const channelLink = {
    innerText:async()=>channelName,
    getAttribute:async()=>'/@CarryMinati'
  };
  const page = {
    goto:async destination=>{url=destination;return {status:()=>status};},
    url:()=>url,
    waitForTimeout:async()=>{},
    waitForSelector:async()=>{},
    evaluate:async()=>true,
    getByText:()=>({first:()=>({
      waitFor:async()=>{if(!showLatest)throw Error('Not visible');},
      click:async()=>{sorted=true;}
    })}),
    locator:selector=>{
      if(selector==='ytd-channel-renderer')return {
        count:async()=>1,
        nth:()=>({locator:()=>({first:()=>channelLink})})
      };
      if(selector.includes('video-title-link'))return {first:()=>videoLink};
      if(selector==='ytd-video-renderer')return {
        count:async()=>1,
        nth:()=>({locator:which=>({first:()=> which==='ytd-channel-name a'
          ? {innerText:async()=>searchName}
          : videoLink})})
      };
      throw Error('Unexpected selector: '+selector);
    }
  };
  const instance = new BrowserController();
  instance.ensureBrowser=async()=>page;
  instance.dismissPopups=async()=>{};
  return {instance, getState:()=>({url,clicks,sorted})};
}

test('latest mode selects exact creator channel, Latest tab and verifies playback',async()=>{
  const h=fakeYoutube();
  const result=await h.instance.searchAndPlayYouTube('CarryMinati','',true);
  assert.equal(result.success,true,result.error);
  assert.equal(result.verified,true);
  assert.equal(result.creatorConfirmed,true);
  assert.equal(result.latestRequested,true);
  assert.equal(h.getState().sorted,true);
  assert.equal(h.getState().clicks,1);
});

test('lookalike creator names are rejected instead of playing unrelated videos',async()=>{
  const h=fakeYoutube({channelName:'CarryMinati Fan Club'});
  const result=await h.instance.searchAndPlayYouTube('CarryMinati','',true);
  assert.equal(result.success,false);
  assert.match(result.error,/Cannot confirm an exact YouTube channel/);
  assert.equal(h.getState().clicks,0);
});

test('latest is never claimed when YouTube no longer exposes sort controls',async()=>{
  const h=fakeYoutube({showLatest:false});
  const result=await h.instance.searchAndPlayYouTube('CarryMinati','',true);
  assert.equal(result.success,false);
  assert.match(result.error,/Latest upload filter/);
  assert.equal(h.getState().clicks,0);
});

test('normal search requires matching channel author before video selection',async()=>{
  const wrong=fakeYoutube({searchName:'Unrelated creator'});
  assert.equal((await wrong.instance.searchAndPlayYouTube('CarryMinati')).success,false);
  assert.equal(wrong.getState().clicks,0);
  const good=fakeYoutube();
  assert.equal((await good.instance.searchAndPlayYouTube('CarryMinati')).success,true);
});

test('HTTP failures and ambiguous latest topic requests do not play videos',async()=>{
  const bad=fakeYoutube({status:404});
  assert.equal((await bad.instance.searchAndPlayYouTube('CarryMinati','',true)).success,false);
  assert.equal(bad.getState().clicks,0);
  const mixed=fakeYoutube();
  const result=await mixed.instance.searchAndPlayYouTube('CarryMinati','gaming',true);
  assert.equal(result.success,false);
  assert.equal(mixed.getState().clicks,0);
});
