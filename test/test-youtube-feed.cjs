'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {YoutubeFeedController,latestFeedVideo,VERIFIED_CHANNELS}=require('../electron/automation/youtubeFeedController.cjs');
const cid=VERIFIED_CHANNELS.carryminati.channelId;
const entry=(id,published,title='Video &amp; more')=>
 '<entry><yt:videoId>'+id+'</yt:videoId><yt:channelId>'+cid+'</yt:channelId><title>'+title+'</title><published>'+published+'</published></entry>';
const feed=entries=>'<feed xmlns:yt="http://www.youtube.com/xml/schemas/2015"><yt:channelId>'+cid+'</yt:channelId>'+entries+'</feed>';
test('verified channel feed returns newest valid upload by publication time',()=>{
 const xml=feed(entry('aaaaaaaaaaa','2026-01-04T10:00:00Z')+entry('bbbbbbbbbbb','2026-11-08T10:00:00Z','Latest &amp; greatest'));
 const video=latestFeedVideo(xml,cid,Date.parse('2026-11-09T00:00:00Z'));
 assert.equal(video.videoId,'bbbbbbbbbbb');
 assert.equal(video.title,'Latest & greatest');
 assert.equal(video.url,'https://www.youtube.com/watch?v=bbbbbbbbbbb');
});
test('wrong channels and malformed feeds never open untrusted results',()=>{
 assert.throws(()=>latestFeedVideo(feed(entry('aaaaaaaaaaa','2026-11-08T10:00:00Z')),'UCzzzzzzzzzzzzzzzzzzzzzz'));
 assert.throws(()=>latestFeedVideo('<feed/>',cid));
 assert.throws(()=>latestFeedVideo(feed(entry('aaaa','2026-11-08T10:00:00Z')),cid));
});
test('known creator opens only a verified watch URL in the default browser',async()=>{
 const requested=[],opened=[];
 const browser={open:async url=>{opened.push(url);return {success:true,verified:true,handoffOnly:true,url};}};
 const action=new YoutubeFeedController({browser,fetchImpl:async(url,options)=>{
   requested.push({url,options});
   return {ok:true,text:async()=>feed(entry('abcdefg1234','2026-11-08T10:00:00Z'))};
 }});
 const out=await action.openLatest('CarryMinati');
 assert.equal(out.success,true);
 assert.equal(out.handoffOnly,true);
 assert.equal(out.source,'youtube-channel-feed');
 assert.equal(out.channelVerified,true);
 assert.match(out.message,/Playback is not verified/);
 assert.equal(opened[0],'https://www.youtube.com/watch?v=abcdefg1234');
 assert.equal(requested[0].options.redirect,'error');
});
test('unrecognized creators, malformed feeds and fetch errors never open a website',async()=>{
 const opened=[];
 const browser={open:async url=>{opened.push(url);return {success:true};}};
 const action=new YoutubeFeedController({browser,fetchImpl:async()=>({ok:true,text:async()=>'<html>not a feed</html>'})});
 assert.equal((await action.openLatest('random impersonator')).success,false);
 assert.equal((await action.openLatest('CarryMinati')).success,false);
 assert.deepEqual(opened,[]);
});
