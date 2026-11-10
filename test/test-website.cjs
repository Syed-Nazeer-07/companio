'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'../website/index.html'),'utf8');
const js=fs.readFileSync(path.join(__dirname,'../website/script.js'),'utf8');
test('website provides discoverable current ARM64/x64 preview without hiding the stable release',()=>{
 assert.match(html,/Get Windows preview/);
 assert.match(html,/Companio-arm64/);
 assert.match(html,/Companio-x64/);
 assert.match(html,/Stable releases/);
 assert.match(html,/artifacts expire after 14 days/i);
 assert.match(html,/actions\/workflows\/ci\.yml/);
 assert.match(html,/github\.com\/Syed-Nazeer-07\/companio\/actions\/runs\/42873921913/);
});
test('landing page stays a clearly labeled demonstration and avoids user data collection',()=>{
 assert.match(html,/Interactive illustration/);
 assert.match(html,/Doesn't operate your computer/);
 assert.doesNotMatch(js,/localStorage|sessionStorage|eval\(/);
 assert.match(html,/class="skip-link"/);
 assert.match(html,/rel="noopener noreferrer"/);
});
