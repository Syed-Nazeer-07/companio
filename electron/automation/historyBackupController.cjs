'use strict';

// Validate backup files in the trusted Electron main process before any
// renderer writes. The schema intentionally does not include preferences,
// provider keys, executable plans, or arbitrary object metadata.
const MAX_BACKUP_BYTES = 2 * 1024 * 1024;
const MAX_MESSAGES = 100;
const MAX_LOGS = 150;
const MAX_NOTES = 200;
const EARLIEST_TIMESTAMP = Date.UTC(2000, 0, 1);
const LATEST_TIMESTAMP = Date.UTC(2100, 0, 1);

function plainObject(x) {
  return !!x && typeof x === 'object' && !Array.isArray(x) &&
    (Object.getPrototypeOf(x) === Object.prototype || Object.getPrototypeOf(x) === null);
}

function fail(detail) {
  throw new Error('Invalid Companio history backup: ' + detail);
}

function requireString(value, label, maxLength, allowEmpty = false) {
  if (typeof value !== 'string' || value.length > maxLength ||
      (!allowEmpty && !value.trim()) || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value)) {
    fail(label + ' must be a valid string (maximum ' + maxLength + ' characters).');
  }
  return value;
}

function requireTimestamp(value, label) {
  if (!Number.isSafeInteger(value) || value < EARLIEST_TIMESTAMP || value > LATEST_TIMESTAMP) {
    fail(label + ' contains an invalid timestamp.');
  }
  return value;
}

function rejectDuplicates(records, section) {
  const ids = new Set();
  for (const record of records) {
    if (ids.has(record.id)) fail(section + ' contains duplicate record IDs.');
    ids.add(record.id);
  }
}

function validateMessage(value, index) {
  if (!plainObject(value)) fail('conversation #' + (index + 1) + ' is not an object.');
  const sender = requireString(value.sender, 'sender', 16);
  if (!['user', 'companio', 'aura', 'system'].includes(sender)) fail('unrecognized message sender.');
  const status = value.status === undefined ? 'info' : requireString(value.status, 'status', 16);
  if (!['success', 'error', 'info'].includes(status)) fail('unsupported message status.');
  // Do not import taskPlan: historical executable JSON is not trusted input.
  return {
    id: requireString(value.id, 'message ID', 160),
    sender,
    content: requireString(value.content, 'message content', 12000, true),
    timestamp: requireTimestamp(value.timestamp, 'message'),
    status
  };
}

function validateLog(value, index) {
  if (!plainObject(value)) fail('automation log #' + (index + 1) + ' is not an object.');
  if (typeof value.verified !== 'boolean') fail('log verified status must be boolean.');
  if (!Number.isFinite(value.durationMs) || value.durationMs < 0 || value.durationMs > 3600000) {
    fail('log duration must be a number from 0 to 3600000.');
  }
  return {
    id: requireString(value.id, 'log ID', 160),
    timestamp: requireTimestamp(value.timestamp, 'log'),
    tool: requireString(value.tool, 'tool name', 128),
    params: requireString(value.params, 'log parameters', 12000, true),
    result: requireString(value.result, 'log result', 20000, true),
    verified: value.verified,
    durationMs: value.durationMs
  };
}

function validateHistoryBackup(input) {
  try {
    if (typeof input !== 'string' || Buffer.byteLength(input, 'utf8') > MAX_BACKUP_BYTES) {
      fail('file must be UTF-8 JSON no larger than 2 MiB.');
    }
    let parsed;
    try { parsed = JSON.parse(input); }
    catch { fail('could not parse JSON.'); }
    if (!plainObject(parsed) || parsed.format !== 'companio-local-history' ||
        parsed.schemaVersion !== 1) {
      fail('unsupported format or schema version.');
    }
    if (Object.keys(parsed).some(key => !['format','schemaVersion','exportedAt','conversations','automationLogs','notes'].includes(key))) {
      fail('the file contains unexpected top-level fields (settings are never imported).');
    }
    if (typeof parsed.exportedAt !== 'string' || !Number.isFinite(Date.parse(parsed.exportedAt))) {
      fail('missing export timestamp.');
    }
    const definitions = [
      [parsed.conversations, 'conversations', MAX_MESSAGES],
      [parsed.automationLogs, 'automation logs', MAX_LOGS],
      [parsed.notes, 'notes', MAX_NOTES]
    ];
    for (const [records, label, limit] of definitions) {
      if (!Array.isArray(records) || records.length > limit) {
        fail(label + ' must be an array with no more than ' + limit + ' records.');
      }
    }

    const conversations = parsed.conversations.map(validateMessage);
    const automationLogs = parsed.automationLogs.map(validateLog);
    const notes = parsed.notes.map((note) => requireString(note, 'note', 4000));
    rejectDuplicates(conversations, 'conversations');
    rejectDuplicates(automationLogs, 'automation logs');

    return {
      success: true,
      backup: { conversations, automationLogs, notes },
      counts: { conversations: conversations.length, automationLogs: automationLogs.length, notes: notes.length }
    };
  } catch (err) {
    return { success: false, error: err.message || 'Could not validate history backup.' };
  }
}

module.exports = { validateHistoryBackup, MAX_BACKUP_BYTES };
