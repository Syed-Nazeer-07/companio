'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
test('all six selectable character assets are used by a stateful renderer',()=>{
 const renderer=fs.readFileSync(path.join(root,'src/components/characters/CharacterRenderer.tsx'),'utf8');
 assert.match(renderer,/StudioCharacter characterId=/);
 const studio=fs.readFileSync(path.join(root,'src/components/characters/StudioCharacter.tsx'),'utf8');
 for(const state of ['waking','listening','thinking','talking','success','confused','sleeping']) assert.ok(studio.includes(state),state);
 for(const id of ['sparky','pixel','mochi','cloudie','kiko','boba']){
  const asset=fs.readFileSync(path.join(root,'public/characters',id+'.svg'),'utf8');
  assert.match(asset,/<svg /);assert.match(asset,/viewBox="0 0 160 180"/);
 }
});
test('sleep toggle, stable native drag handle, and fade-out remain available in overlay',()=>{
 const source=fs.readFileSync(path.join(root,'src/components/overlay/DesktopCompanionOverlay.tsx'),'utf8');
 assert.match(source,/aria-label="Drag to move Companio around your desktop"/);
 assert.match(source,/Put Companio to sleep/);
 assert.match(source,/companio-overlay--closing/);
 assert.match(source,/parseCompanionCommand/);
});

test('overlay character supports keyboard, and shortcut hints use configured value',()=>{
 const overlay=fs.readFileSync(path.join(root,'src/components/overlay/DesktopCompanionOverlay.tsx'),'utf8');
 const input=fs.readFileSync(path.join(root,'src/components/overlay/CompactInput.tsx'),'utf8');
 assert.match(overlay,/role="button"/);
 assert.match(overlay,/tabIndex=\{0\}/);
 assert.match(overlay,/event\.key === 'Enter' \|\| event\.key === ' '/);
 assert.match(overlay,/activationShortcut=\{settings\.activationShortcut\}/);
 assert.match(input,/Hide Companio \(Esc or \$\{activationShortcut\}\)/);
 assert.match(input,/aria-pressed=\{isListening\}/);
});
test('settings writes and broadcasts occur outside a replayable React state updater',()=>{
 const source=fs.readFileSync(path.join(root,'src/App.tsx'),'utf8');
 const segment=source.slice(source.indexOf('const handleUpdateSettings ='),source.indexOf('const handleLaunchOverlay ='));
 assert.ok(!segment.includes('setSettings((prev) =>'));
 assert.match(segment,/settingsRef\.current = updated/);
 assert.match(segment,/dbService\.saveSettings\(updated\)/);
 assert.match(segment,/desktopBridge\.sendStateUpdate\(updated\)/);
});

test('muted conversational reply resets character state, SVGs scale proportionally, wizard syncs live/Escape, and production CSP is configured',()=>{
 const overlay=fs.readFileSync(path.join(root,'src/components/overlay/DesktopCompanionOverlay.tsx'),'utf8');
 assert.match(overlay,/canSpeak\s*=\s*!settings\.voice\.muted/);
 assert.match(overlay,/setCharacterState\('idle'\)/);
 assert.match(overlay,/const overlayScale\s*=/);

 const studio=fs.readFileSync(path.join(root,'src/components/characters/StudioCharacter.tsx'),'utf8');
 assert.match(studio,/width\s*=\s*Math\.round\(160\s*\*\s*safeScale\)/);
 assert.match(studio,/height\s*=\s*Math\.round\(180\s*\*\s*safeScale\)/);
 assert.match(studio,/width=\{width\} height=\{height\}/);
 assert.doesNotMatch(studio,/transform:\s*`scale\(/);

 const wizard=fs.readFileSync(path.join(root,'src/components/onboarding/SetupWizardModal.tsx'),'utf8');
 assert.match(wizard,/onUpdateLive\?\.\(\{characterId:c\.id\}\)/);
 assert.match(wizard,/e\.key==='Escape'/);
 const resetEffect=wizard.slice(wizard.indexOf('setStep(0)'),wizard.indexOf('setStep(0)')+450);
 assert.match(resetEffect,/\},\[isOpen\]\);/);

 const overlayGuard=fs.readFileSync(path.join(root,'src/components/overlay/DesktopCompanionOverlay.tsx'),'utf8');
 assert.match(overlayGuard,/speakReply\(reply,\s*8000\)/);
 assert.match(overlayGuard,/typeof autoClearBubbleMs === 'number' && autoClearBubbleMs > 0/);

 const settingsSrc=fs.readFileSync(path.join(root,'src/components/dashboard/SettingsPage.tsx'),'utf8');
 assert.match(settingsSrc,/import \{ DEFAULT_SETTINGS \} from '\.\.\/\.\.\/services\/defaultSettings'/);
 assert.match(settingsSrc,/desktopBridge\.sendStateUpdate\(DEFAULT_SETTINGS\)/);

 const viteConfig=fs.readFileSync(path.join(root,'vite.config.ts'),'utf8');
 assert.match(viteConfig,/companio-csp/);
 assert.match(viteConfig,/Content-Security-Policy/);
 assert.match(viteConfig,/if \(!ctx\.bundle\) return html/);
});
