'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
test('all six selectable companion models have quiet backgrounds and distinct states',()=>{
 for(const model of ['SparkyRobot','PixelMascot','Mochi3D','CloudieDream','KikoKitten','BobaBear']){
  const source=fs.readFileSync(path.join(root,'src/components/characters',model+'.tsx'),'utf8');
  assert.doesNotMatch(source,/className=\{\`absolute inset-0 rounded-[^\`]*blur-(?:xl|2xl|3xl)/,model+' aura should be removed');
  for(const state of ['animate-companio-wake','animate-companio-listen','animate-companio-think','animate-companio-idle'])
   assert.ok(source.includes(state),model+' missing '+state);
 }
});
test('sleep toggle, stable native drag handle, and fade-out remain available in overlay',()=>{
 const source=fs.readFileSync(path.join(root,'src/components/overlay/DesktopCompanionOverlay.tsx'),'utf8');
 assert.match(source,/aria-label="Drag to move Companio around your desktop"/);
 assert.match(source,/Put Companio to sleep/);
 assert.match(source,/companio-overlay--closing/);
 assert.match(source,/parseCompanionCommand/);
});
