'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'../website/index.html'),'utf8');
const js=fs.readFileSync(path.join(__dirname,'../website/script.js'),'utf8');
test('website provides discoverable current ARM64/x64 preview without hiding the stable release',()=>{
 assert.match(html,/Download ARM64/);
 assert.match(html,/Download x64/);
 assert.match(html,/Snapdragon\/Windows on ARM laptops/);
 assert.match(html,/Intel\/AMD PCs/);
 assert.match(html,/Other versions/);
 assert.match(html,/no ZIP or GitHub sign-in needed/i);
 assert.match(html,/releases\/tag\/v1\.1\.0-rc\.25/);
 assert.match(html,/releases\/download\/v1\.1\.0-rc\.25\/Companio-Setup-1\.1\.0-rc\.25-arm64\.exe/);
 assert.match(html,/releases\/download\/v1\.1\.0-rc\.25\/Companio-Setup-1\.1\.0-rc\.25-x64\.exe/);
});
test('landing page stays a clearly labeled demonstration and avoids user data collection',()=>{
 assert.match(html,/Interactive illustration/);
 assert.match(html,/Doesn't operate your computer/);
 assert.doesNotMatch(js,/localStorage|sessionStorage|eval\(/);
 assert.match(html,/class="skip-link"/);
 assert.match(html,/rel="noopener noreferrer"/);
 assert.match(html,/id="preview-guide"/);
 assert.match(html,/Verify the published SHA-256 digest/);
 assert.match(html,/Control Center → Voice Settings/);
 assert.match(html,/Companio_Captures/);
});
