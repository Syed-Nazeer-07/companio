'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const source = fs.readFileSync(path.join(__dirname, '../src/services/actionApprovalPolicy.ts'), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
}).outputText;
const exportsObject = {};
vm.runInNewContext(compiled, { exports: exportsObject, Object });
const { requiresActionReview } = exportsObject;
const plan = (query, tool, intent='local_ai_actions', params={}) => ({
  query, intent, steps:[{tool,params}]
});

test('a simple explicitly requested app or YouTube launch does not prompt twice', () => {
  for (const [query, tool] of [
    ['Open YouTube', 'browser.youtube.open'],
    ['Please open YouTube', 'browser.youtube.open'],
    ['Could you open YouTube?', 'browser.youtube.open'],
    ['Open Notepad', 'win.notepad.launch'],
    ['Launch Calculator', 'win.calculator.launch'],
    ['Start Spotify', 'win.spotify.launch']
  ]) {
    assert.equal(requiresActionReview(plan(query,tool)), false, query);
  }
});

test('model suggestions cannot silently run an unrelated or parameterized action', () => {
  for (const [query,tool,params] of [
    ['Open YouTube','win.notepad.launch',{}],
    ['Open Notepad','browser.youtube.open',{}],
    ['Open YouTube','browser.open_url',{url:'https://evil.example'}],
    ['Open YouTube','browser.youtube.open',{latest:true}],
    ['Open Calculator','win.volume.set',{level:100}],
    ['Open Calculator','win.calculator.launch',{cmd:'unexpected'}],
    ['Open YouTube and set volume to 90','browser.youtube.open',{}]
  ]) assert.equal(requiresActionReview(plan(query,tool,'local_ai_actions',params)), true, query);
});

test('multi-step plans always require review, even for benign operations', () => {
  const candidate=plan('Open YouTube and then open Notepad','browser.youtube.open','builtin_sequence');
  candidate.steps.push({tool:'win.notepad.launch',params:{}});
  assert.equal(requiresActionReview(candidate),true);
  const empty={query:'Open YouTube',intent:'local_ai_actions',steps:[]};
  assert.equal(requiresActionReview(empty),true);
});

test('ordinary deterministic commands retain their existing direct execution behavior', () => {
  assert.equal(requiresActionReview(plan('Open YouTube','browser.youtube.open','browser.youtube.open')),false);
});
