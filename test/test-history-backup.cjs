'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { validateHistoryBackup, MAX_BACKUP_BYTES } = require('../electron/automation/historyBackupController.cjs');

const valid = () => ({
  format: 'companio-local-history',
  schemaVersion: 1,
  exportedAt: '2026-11-08T00:00:00.000Z',
  conversations: [{
    id: 'msg_1', sender: 'user', content: 'Open Notepad',
    timestamp: Date.UTC(2026, 10, 8), status: 'info'
  }],
  automationLogs: [{
    id: 'log_1', timestamp: Date.UTC(2026, 10, 8),
    tool: 'win.notepad.launch', params: '{}', result: '{"success":true}',
    verified: true, durationMs: 125
  }],
  notes: ['Remember the project deadline']
});

test('valid backup imports the history sections and exact counts', () => {
  const result = validateHistoryBackup(JSON.stringify(valid()));
  assert.equal(result.success, true);
  assert.deepEqual(result.counts, {conversations:1, automationLogs:1, notes:1});
  assert.equal(result.backup.conversations[0].sender, 'user');
});

test('backup import strips untrusted executable task plans from messages', () => {
  const payload = valid();
  payload.conversations[0].taskPlan = {steps:[{tool:'win.recyclebin.empty'}]};
  const result = validateHistoryBackup(JSON.stringify(payload));
  assert.equal(result.success, true);
  assert.equal('taskPlan' in result.backup.conversations[0], false);
});

test('never accepts settings, API keys, or unknown top-level fields', () => {
  for (const extra of [
    {settings:{ai:{apiKey:'secret'}}},
    {apiKey:'secret'},
    {metadata:{extra:true}}
  ]) {
    const payload = {...valid(),...extra};
    assert.equal(validateHistoryBackup(JSON.stringify(payload)).success, false);
  }
});

test('rejects invalid schemas and oversized imports', () => {
  const malformed = valid(); malformed.schemaVersion = 99;
  assert.equal(validateHistoryBackup(JSON.stringify(malformed)).success, false);
  const tooLarge = '{'+'x'.repeat(MAX_BACKUP_BYTES)+'}';
  assert.equal(validateHistoryBackup(tooLarge).success, false);
  assert.equal(validateHistoryBackup('not JSON').success, false);
});

test('rejects malformed records without partial success', () => {
  const payloads = [
    (()=>{const p=valid();p.conversations[0].sender='unknown';return p;})(),
    (()=>{const p=valid();p.conversations[0].timestamp='yesterday';return p;})(),
    (()=>{const p=valid();p.automationLogs[0].verified='yes';return p;})(),
    (()=>{const p=valid();p.automationLogs[0].durationMs=-100;return p;})(),
    (()=>{const p=valid();p.notes=[null];return p;})(),
    (()=>{const p=valid();p.conversations.push({...p.conversations[0]});return p;})()
  ];
  for (const payload of payloads) {
    const result=validateHistoryBackup(JSON.stringify(payload));
    assert.equal(result.success,false,JSON.stringify(payload));
    assert.equal('backup' in result,false);
  }
});

test('enforces per-section record limits', () => {
  const p = valid();
  p.conversations = Array.from({length:101}, (_,i)=>({
    id:'m'+i,sender:'user',content:'hello',timestamp:Date.UTC(2026,10,8)
  }));
  assert.equal(validateHistoryBackup(JSON.stringify(p)).success,false);
});
