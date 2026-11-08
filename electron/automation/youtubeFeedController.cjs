'use strict';

// Fast path for a known, explicitly identified creator. YouTube's Atom feed
// reports recent uploads; it is not a proof of video playback or a complete
// guarantee that every private, scheduled or Shorts upload is present.
const VERIFIED_CHANNELS = Object.freeze({
  carryminati: { name:'CarryMinati', channelId:'UCj22tfcQrWG7EMEKS0qLeEg' }
});
const YOUTUBE_FEED_TIMEOUT_MS = 8500;
function decodeEntities(text) {
  return text.replace(/&(?:amp|lt|gt|quot|apos|#39);/g, e=>({
    '&amp;':'&','&lt;':'<','&gt;':'>','&quot;':'"','&apos;':"'",'&#39;':"'"
  })[e] || e);
}
function latestFeedVideo(xml, expectedChannelId, now = Date.now()) {
  if (typeof xml !== 'string' || xml.length > 1_200_000 ||
      !/^UC[A-Za-z0-9_-]{22}$/.test(expectedChannelId)) {
    throw Error('Invalid YouTube channel feed.');
  }
  const rootId = xml.match(/<yt:channelId>([^<]+)<\/yt:channelId>/);
  if (!rootId || rootId[1] !== expectedChannelId) {
    throw Error('YouTube feed does not belong to the requested channel.');
  }
  const entries = [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)].slice(0,30);
  const verified = [];
  for(const m of entries) {
    const e=m[1];
    const videoId=e.match(/<yt:videoId>([A-Za-z0-9_-]{11})<\/yt:videoId>/);
    const title=e.match(/<title>([\s\S]*?)<\/title>/);
    const published=e.match(/<published>([^<]+)<\/published>/);
    if(!videoId || !title || !published)continue;
    const entryChannel=e.match(/<yt:channelId>([^<]+)<\/yt:channelId>/);
    if(entryChannel && entryChannel[1]!==expectedChannelId)continue;
    const date=Date.parse(published[1]);
    if(!Number.isFinite(date) || date > now + 300000 || date < 0)continue;
    verified.push({
      videoId:videoId[1], title:decodeEntities(title[1].trim()).slice(0,180),
      published:published[1], date
    });
  }
  verified.sort((a,b)=>b.date-a.date);
  if(!verified.length)throw Error('No verified recent uploads were returned by this channel feed.');
  const latest=verified[0];
  return {
    title:latest.title,
    videoId:latest.videoId,
    published:latest.published,
    url:'https://www.youtube.com/watch?v='+latest.videoId
  };
}
class YoutubeFeedController {
  constructor({fetchImpl=globalThis.fetch,browser,timeoutMs=YOUTUBE_FEED_TIMEOUT_MS}={}) {
    this.fetchImpl=fetchImpl;this.browser=browser;this.timeoutMs=timeoutMs;
  }
  async openLatest(creator) {
    const alias=typeof creator==='string'?creator.trim().toLowerCase():null;
    const channel=alias && VERIFIED_CHANNELS[alias];
    if(!channel)return {success:false,verified:false,error:'A verified feed is not configured for this creator.'};
    const ctrl=new AbortController();
    const timer=setTimeout(()=>ctrl.abort(),this.timeoutMs);
    try{
      const url='https://www.youtube.com/feeds/videos.xml?channel_id='+channel.channelId;
      const response=await this.fetchImpl(url,{signal:ctrl.signal,redirect:'error',headers:{Accept:'application/atom+xml'}});
      if(!response.ok)throw Error('YouTube channel feed returned HTTP '+response.status);
      const xml=await response.text();
      const video=latestFeedVideo(xml,channel.channelId);
      if(!this.browser || typeof this.browser.open!=='function')throw Error('Default browser handoff unavailable.');
      const result=await this.browser.open(video.url,'latest listed CarryMinati upload');
      if(!result.success)return {...result,creator:channel.name,published:video.published};
      return {
        ...result, creator:channel.name, videoTitle:video.title,
        published:video.published, channelVerified:true,
        source:'youtube-channel-feed',
        handoffOnly:true,
        verificationScope:'windows-handoff',
        message:'Opened the newest public upload listed in '+channel.name+"'s YouTube feed in your default browser. Playback is not verified."
      };
    }catch(error){
      return {success:false,verified:false,error:ctrl.signal.aborted
        ? 'YouTube channel feed timed out. No video was opened.'
        : (error?.message||'Could not verify the creator feed. No video was opened.')};
    }finally{clearTimeout(timer);}
  }
}
module.exports={YoutubeFeedController,latestFeedVideo,VERIFIED_CHANNELS};
