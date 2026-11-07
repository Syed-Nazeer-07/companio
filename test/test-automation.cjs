const path = require('path');
const fs = require('fs');
const os = require('os');

const volumeController = require('../electron/automation/volumeController.cjs');
const winAppsController = require('../electron/automation/winAppsController.cjs');
const browserController = require('../electron/automation/browserController.cjs');

async function runAcceptanceTests() {
  console.log('====================================================');
  console.log('       COMPANIO - AUTOMATED ACCEPTANCE TEST SUITE    ');
  console.log('   Target: Windows 11 (x64 & ARM64 Snapdragon)       ');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  async function test(name, fn) {
    process.stdout.write(`[TEST] ${name.padEnd(52)} `);
    try {
      const result = await fn();
      if (result !== false) {
        console.log('\x1b[32m[PASS ✓]\x1b[0m');
        passed++;
      } else {
        console.log('\x1b[31m[FAIL ✗]\x1b[0m');
        failed++;
      }
    } catch (err) {
      console.log(`\x1b[31m[ERROR: ${err.message}]\x1b[0m`);
      failed++;
    }
  }

  // 1. Architecture check (Windows x64 & ARM64)
  await test('Windows Platform Compatibility Check (x64 / ARM64)', async () => {
    const arch = os.arch();
    console.log(`(Arch: ${arch})`);
    return ['x64', 'arm64', 'ia32'].includes(arch) || ['x64', 'arm64'].includes(process.arch);
  });

  // 2. Volume control test
  let initialVol = 50;
  await test('Windows Audio: Read Current Volume', async () => {
    const res = await volumeController.getVolume();
    initialVol = res.volume;
    return typeof res.volume === 'number' && res.verified;
  });

  await test('Windows Audio: Set Master Volume to 60%', async () => {
    const res = await volumeController.setVolume(60);
    return res.success && res.volume === 60 && res.verified;
  });

  await test('Windows Audio: Mute and Unmute Toggle', async () => {
    const muteRes = await volumeController.setMute(true);
    const unmuteRes = await volumeController.setMute(false);
    // Restore original volume
    await volumeController.setVolume(initialVol);
    return muteRes.success && unmuteRes.success;
  });

  // 3. Native Windows Calculator Launch & Close
  await test('Windows Apps: Launch Calculator and Verify Process', async () => {
    const res = await winAppsController.launchCalculator();
    return res.success && res.verified;
  });

  await test('Windows Apps: Close Calculator Application', async () => {
    const res = await winAppsController.closeCalculator();
    return res.success && res.verified;
  });

  // 4. File Explorer Folder Navigation
  await test('Windows Apps: Open Downloads in File Explorer', async () => {
    const res = await winAppsController.openFileExplorer('downloads');
    return res.success && res.verified;
  });

  // 5. Screenshot capture
  await test('System: Capture Screenshot to Disk', async () => {
    const res = await winAppsController.takeScreenshot();
    if (!res.success || !res.filePath) return false;
    const exists = fs.existsSync(res.filePath);
    const size = exists ? fs.statSync(res.filePath).size : 0;
    return exists && size > 1000;
  });

  // 6. Real Browser Automation with Microsoft Edge
  await test('Browser: Launch Native Edge & Open YouTube', async () => {
    const res = await browserController.openYouTube();
    return res.success && res.verified;
  });

  await test('Browser: YouTube Search & Video Verification', async () => {
    const res = await browserController.searchAndPlayYouTube('CarryMinati');
    return res.success && res.verified && res.videoTitle.length > 0;
  });

  await test('Browser: Control Playback (Pause Active Video)', async () => {
    const res = await browserController.controlYouTube('pause');
    return res.success && res.verified;
  });

  await test('Browser: Google Search for AI Developments', async () => {
    const res = await browserController.searchGoogle('latest AI developments');
    return res.success && res.verified;
  });

  // 7. Accurate Failure Reporting (no false successes)
  await test('Safety & Truthfulness: Reject Fake / Unverified Tool', async () => {
    // Calling an invalid tool should fail and report failure honestly
    try {
      const res = await browserController.controlYouTube('non_existent_action');
      return res.success === false && res.verified === false;
    } catch {
      return true;
    }
  });

  // Clean up browser
  try {
    if (browserController.browser) {
      await browserController.browser.close();
    }
  } catch {}

  console.log('\n====================================================');
  console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runAcceptanceTests().catch((e) => {
  console.error('Fatal test error:', e);
  process.exit(1);
});
