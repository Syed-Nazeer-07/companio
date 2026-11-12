'use strict';
// Build-time only. Retrieve pinned official Whisper CPU assets into an
// architecture-specific bundle so ordinary users do not configure speech.
// Never fetch an unverified executable at application startup.
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const crypto = require('node:crypto');
const { WhisperBinaryInstaller } = require('../electron/automation/whisperBinaryInstaller.cjs');
const { WhisperModelInstaller, MANIFEST } = require('../electron/automation/whisperModelInstaller.cjs');

async function sha256(file) {
  const hash=crypto.createHash('sha256');
  for await (const chunk of fs.createReadStream(file)) hash.update(chunk);
  return hash.digest('hex');
}

async function main() {
  const arch=process.argv[2];
  if (process.platform!=='win32' || !['arm64','x64'].includes(arch)) {
    throw Error('Usage on Windows: node scripts/prepare-bundled-voice.cjs arm64|x64');
  }
  const temporary=fs.mkdtempSync(path.join(os.tmpdir(),'companio-voice-build-'));
  const destination=path.join(__dirname,'..','build','bundled-voice',arch);
  try {
    const binary=await new WhisperBinaryInstaller({userData:temporary,arch}).install();
    if (!binary.success || !binary.filePath) throw Error(binary.error || 'Pinned whisper.cpp CPU download failed.');
    const model=await new WhisperModelInstaller({userData:temporary}).install();
    if (!model.success || !model.filePath) throw Error(model.error || 'Pinned offline English model download failed.');
    fs.rmSync(destination,{recursive:true,force:true});
    fs.mkdirSync(destination,{recursive:true});
    // Preserve whisper.cpp dependent DLLs from the verified official archive.
    fs.cpSync(path.dirname(binary.filePath),path.join(destination,'Release'),{recursive:true});
    const copied=path.join(destination,MANIFEST.file);
    fs.copyFileSync(model.filePath,copied);
    if ((await sha256(copied))!==MANIFEST.sha256) throw Error('Copied offline model checksum mismatch.');
    if (!fs.statSync(path.join(destination,'Release','whisper-cli.exe')).isFile()) {
      throw Error('Packaged voice binary is missing.');
    }
    fs.writeFileSync(path.join(destination,'SOURCE.txt'),[
      'whisper.cpp official release b5454',
      'Offline English model '+MANIFEST.id,
      'SHA-256 verified before inclusion in the installer.',
      'https://github.com/ggml-org/whisper.cpp',
      'https://huggingface.co/ggerganov/whisper.cpp',
      'Upstream licenses and notices apply.'
    ].join('\n')+'\n');
    console.log('Prepared verified '+arch+' offline speech assets for Windows packaging.');
  } finally {
    fs.rmSync(temporary,{recursive:true,force:true});
  }
}
main().catch(err=>{console.error(err.message);process.exitCode=1;});
