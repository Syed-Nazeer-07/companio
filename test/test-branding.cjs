'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root=path.join(__dirname,'..');
const read = file=>fs.readFileSync(path.join(root,file),'utf8');

test('web favicon points to a real packaged static asset',()=>{
  const html=read('index.html');
  assert.match(html,/href="\.\/companio-icon\.svg"/);
  const svg=read('public/companio-icon.svg');
  assert.match(svg,/<svg\s/);
  assert.match(svg,/viewBox="0 0 128 128"/);
});

test('native windows, tray and installers refer to actual branded assets',()=>{
  const main=read('electron/main.cjs');
  assert.match(main,/icon\.ico/);
  assert.match(main,/nativeImage\.createFromPath\(imagePath\)/);
  assert.doesNotMatch(main,/iVBORw0KGgoAAAANSUhEUgAAABAAAAAQC/);
  const pkg=JSON.parse(read('package.json'));
  assert.equal(pkg.build.win.icon,'build/icon.ico');
  assert.equal(pkg.build.win.target[0],'nsis');
  assert.equal(pkg.build.win.target.length,1);
  const resources=pkg.build.extraResources || [];
  assert.ok(resources.some(item => item.from === 'build/bundled-voice' && item.to === 'bundled-voice'));
  for(const license of ['LICENSE-whisper.cpp.txt','LICENSE-whisper-model.txt']) {
    const notice=read('build/bundled-voice/'+license);
    assert.match(notice,/MIT License/);
    assert.match(notice,/Copyright \(c\)/);
  }
  assert.equal(pkg.build.nsis.useZip,true);
  assert.equal(pkg.build.nsis.differentialPackage,false);
  assert.equal(pkg.build.nsis.runAfterFinish,false);
  assert.ok(fs.statSync(path.join(root,'build/icon.png')).size>1000);
  assert.ok(fs.statSync(path.join(root,'build/icon.ico')).size>1000);
});

test('icon generator works from repository build folder, not one PC user profile',()=>{
  const generator=read('scripts/generate-icon.ps1');
  assert.match(generator,/PSScriptRoot/);
  assert.match(generator,/16, 24, 32, 48, 64, 128, 256/);
  assert.doesNotMatch(generator,/C:\\Users\\Nazeer/i);
});

test('unused Tauri scaffolding is removed from this Electron-only repository',()=>{
  assert.equal(fs.existsSync(path.join(root,'src-tauri')),false);
});
