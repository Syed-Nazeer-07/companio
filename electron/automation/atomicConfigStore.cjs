'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');

// Write a complete replacement beside the existing config and rename it into
// place only after writing finishes. If the rename fails, preserve the old file.
function writeConfigAtomically(filePath, config, fsImpl = fs) {
  if (typeof filePath !== 'string' || !filePath.trim()) {
    throw new Error('Invalid config path.');
  }
  if (!config || typeof config !== 'object' || Array.isArray(config)) {
    throw new Error('Invalid native config.');
  }
  const directory = path.dirname(filePath);
  fsImpl.mkdirSync(directory, { recursive: true });
  const temporary = path.join(directory, `.${path.basename(filePath)}.${process.pid}.${randomUUID()}.tmp`);
  try {
    fsImpl.writeFileSync(temporary, JSON.stringify(config), 'utf8');
    fsImpl.renameSync(temporary, filePath);
  } catch (error) {
    try { fsImpl.unlinkSync(temporary); } catch {}
    throw error;
  }
}

module.exports = { writeConfigAtomically };
