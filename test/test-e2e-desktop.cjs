'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const net = require('node:net');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { chromium } = require('playwright-core');

const root = path.resolve(__dirname, '..');
const unpackedDirectories = process.arch === 'arm64'
  ? ['win-arm64-unpacked', 'win-unpacked']
  : ['win-unpacked'];
const binary = unpackedDirectories
  .map((dir) => path.join(root, 'release', dir, 'Companio.exe'))
  .find((candidate) => fs.existsSync(candidate));

function getFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      const port = typeof addr === 'object' && addr ? addr.port : 0;
      server.close(() => resolve(port));
    });
  });
}

function httpGetJson(url) {
  return new Promise((resolve, reject) => {
    const req = http.get(url, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}`));
        try { resolve(JSON.parse(body)); } catch (err) { reject(err); }
      });
    });
    req.on('error', reject);
    req.setTimeout(1500, () => req.destroy(new Error('timeout')));
  });
}

async function waitForCdp(port, timeoutMs = 25000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const info = await httpGetJson(`http://127.0.0.1:${port}/json/version`);
      if (info?.webSocketDebuggerUrl) return info;
    } catch {}
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error('Timed out waiting for Electron CDP endpoint');
}

async function findPageByView(browser, viewName, timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    for (const ctx of browser.contexts()) {
      for (const page of ctx.pages()) {
        if (page.url().includes(`view=${viewName}`)) return page;
      }
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`Timed out waiting for view=${viewName} window`);
}

async function run() {
  if (!binary) {
    throw new Error(
      `Packaged ${process.arch} Companio.exe missing. Build with: npx electron-builder --win --${process.arch} --dir --publish never`
    );
  }

  const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'companio-e2e-'));
  const port = await getFreePort();
  const child = spawn(binary, [`--user-data-dir=${profileDir}`, `--remote-debugging-port=${port}`], {
    cwd: root,
    env: { ...process.env, NODE_ENV: 'production' },
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe']
  });

  let stdout = '';
  let stderr = '';
  child.stdout.on('data', (d) => { stdout = (stdout + d.toString()).slice(-8000); });
  child.stderr.on('data', (d) => { stderr = (stderr + d.toString()).slice(-8000); });

  let browser = null;
  const startedAt = Date.now();
  const report = { binary, profileDir, port, steps: [] };

  try {
    await waitForCdp(port, 25000);
    browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`);

    const overlay = await findPageByView(browser, 'overlay', 15000);
    await overlay.waitForSelector('[data-companio-ready="true"]', { timeout: 15000 });
    const dashboard = await findPageByView(browser, 'dashboard', 15000);
    await dashboard.waitForLoadState('domcontentloaded');
    report.startupMs = Date.now() - startedAt;
    report.steps.push('startup_ready');

    // 1. Security boundary verification on both isolated renderers
    for (const [label, page] of [['overlay', overlay], ['dashboard', dashboard]]) {
      const sec = await page.evaluate(() => ({
        hasRequire: typeof window.require !== 'undefined',
        hasProcess: typeof window.process !== 'undefined',
        hasExecuteTool: typeof window.companioDesktop?.executeTool === 'function',
        hasLegacyGlobal: typeof window.auraDesktop !== 'undefined'
      }));
      assert.equal(sec.hasRequire, false, `${label}: window.require must not exist`);
      assert.equal(sec.hasProcess, false, `${label}: window.process must not exist`);
      assert.equal(sec.hasExecuteTool, true, `${label}: preload executeTool missing`);
    }
    const invalidIpc = await overlay.evaluate(() =>
      window.companioDesktop.executeTool('win.volume.set', { level: 'invalid' })
    );
    assert.equal(invalidIpc.success, false);
    assert.equal(invalidIpc.verified, false);
    report.steps.push('security_boundaries_verified');

    // 2. Onboarding wizard: live character preview, multi-step flow & completion
    const wizardHeading = dashboard.locator('#companio-welcome-heading');
    await wizardHeading.waitFor({ state: 'visible', timeout: 10000 });
    await dashboard.getByRole('button', { name: /Pixel/i }).click();
    await overlay.waitForFunction(
      () => document.querySelector('[data-character]')?.getAttribute('data-character') === 'pixel',
      { timeout: 8000 }
    );
    await dashboard.getByRole('button', { name: 'Continue' }).click();
    await dashboard.locator('text=Enable spoken responses').waitFor({ state: 'visible', timeout: 5000 });
    await dashboard.getByRole('button', { name: 'Continue' }).click();
    const wizardNameInput = dashboard.getByLabel('Companion name');
    await wizardNameInput.fill('Companio E2E');
    await dashboard.getByRole('button', { name: 'Start Companio' }).click();
    await wizardHeading.waitFor({ state: 'hidden', timeout: 5000 });
    report.steps.push('onboarding_completed');

    // 3. Character Studio: bespoke optics, waking state, speaking preview, overlay sync
    await dashboard.getByRole('button', { name: 'Character Studio' }).click();
    await dashboard.getByRole('button', { name: /Kiko/i }).click();
    await dashboard.getByRole('button', { name: 'waking' }).click();
    await dashboard.getByRole('button', { name: 'Preview Speaking' }).click();
    await overlay.waitForFunction(
      () => document.querySelector('[data-character]')?.getAttribute('data-character') === 'kiko',
      { timeout: 8000 }
    );
    await dashboard.getByRole('button', { name: 'Stop speaking' }).click();
    report.steps.push('character_studio_verified');

    // 4. Long-term memory: add, pin, verify atomic disk store, pause/resume, delete
    await dashboard.getByRole('button', { name: 'History & Logs' }).click();
    await dashboard.getByRole('button', { name: /Saved Memory/i }).click();
    const memInput = dashboard.getByLabel('New memory content');
    await memInput.fill('Prefers concise engineering summaries without filler');
    const memForm = dashboard.locator('form').filter({ has: dashboard.getByLabel('New memory content') });
    await memForm.locator('input[type="checkbox"]').check();
    await dashboard.getByRole('button', { name: 'Save', exact: true }).click();
    await dashboard.locator('text=Prefers concise engineering summaries without filler').waitFor({ state: 'visible', timeout: 5000 });
    const memFile = path.join(profileDir, 'companio_memory_v1.json');
    assert.equal(fs.existsSync(memFile), true, 'companio_memory_v1.json must be persisted to disk');
    const savedMemJson = JSON.parse(fs.readFileSync(memFile, 'utf8'));
    assert.equal(savedMemJson.items.some((m) => m.content.includes('concise engineering summaries') && m.pinned === true), true);
    await dashboard.getByRole('button', { name: 'Pause' }).click();
    await dashboard.locator('text=Paused').first().waitFor({ state: 'visible', timeout: 5000 });
    await dashboard.getByRole('button', { name: 'Delete memory' }).click();
    await dashboard.locator('text=Prefers concise engineering summaries without filler').waitFor({ state: 'hidden', timeout: 5000 });
    await memInput.fill('Workspace OS is Windows 11 ARM64');
    await dashboard.getByRole('button', { name: 'Save', exact: true }).click();
    await dashboard.locator('text=Workspace OS is Windows 11 ARM64').waitFor({ state: 'visible', timeout: 5000 });
    report.steps.push('memory_persistence_verified');

    // 5. Voice Settings: Offline Whisper ARM64 setup card & engine switching
    await dashboard.getByRole('button', { name: 'Voice Settings' }).click();
    await dashboard.locator('text=/Offline Whisper setup/i').waitFor({ state: 'visible', timeout: 5000 });
    await dashboard.getByRole('button', { name: /Set up offline Whisper|Offline Whisper ready/i }).waitFor({ state: 'visible', timeout: 5000 });
    await dashboard.locator('#companio-speech-engine').selectOption('whisper');
    await dashboard.getByRole('button', { name: 'Choose whisper-cli.exe' }).waitFor({ state: 'visible', timeout: 5000 });
    await dashboard.locator('#companio-speech-engine').selectOption('auto');
    report.steps.push('voice_settings_verified');

    // 6. AI Intelligence: Local + Cloud DPAPI vault visibility & zero plaintext secret leakage
    await dashboard.getByRole('button', { name: 'AI Intelligence' }).click();
    await dashboard.getByRole('button', { name: /Cloud API/i }).click();
    await dashboard.getByLabel('Cloud API key').waitFor({ state: 'visible', timeout: 5000 });
    const storageCheck = await dashboard.evaluate(() => localStorage.getItem('companio_settings') || '');
    assert.doesNotMatch(storageCheck, /"apiKey":"[^"]/);
    await dashboard.locator('text=Built-in Engine').first().click();
    report.steps.push('ai_settings_verified');

    // 7. Settings & Diagnostics
    await dashboard.getByRole('button', { name: 'Settings', exact: true }).click();
    await dashboard.getByRole('button', { name: 'Run diagnostics' }).click();
    await dashboard.locator('[role="status"]').filter({ hasText: 'Desktop runtime' }).waitFor({ state: 'visible', timeout: 8000 });
    report.steps.push('diagnostics_verified');

    // 7b. Control Center teardown releases window & preserves state on reopen
    await dashboard.getByRole('button', { name: 'Show companion' }).click();
    const waitClosedDeadline = Date.now() + 8000;
    while (Date.now() < waitClosedDeadline) {
      const stillOpen = browser.contexts().some((ctx) => ctx.pages().some((p) => p.url().includes('view=dashboard')));
      if (!stillOpen) break;
      await new Promise((r) => setTimeout(r, 150));
    }
    assert.equal(
      browser.contexts().some((ctx) => ctx.pages().some((p) => p.url().includes('view=dashboard'))),
      false,
      'Control Center window must close on Show companion instead of remaining hidden'
    );
    await overlay.evaluate(() => window.companioDesktop.toggleDashboard(true));
    const dashboardReopened = await findPageByView(browser, 'dashboard', 10000);
    await dashboardReopened.waitForLoadState('domcontentloaded');
    await dashboardReopened.getByRole('button', { name: 'Character Studio' }).click();
    const kikoBtn = dashboardReopened.getByRole('button', { name: /Kiko/i });
    await kikoBtn.waitFor({ state: 'visible', timeout: 5000 });
    assert.equal(await kikoBtn.getAttribute('aria-pressed'), 'true');
    await dashboardReopened.getByRole('button', { name: 'History & Logs' }).click();
    await dashboardReopened.getByRole('button', { name: /Saved Memory/i }).click();
    await dashboardReopened.locator('text=Workspace OS is Windows 11 ARM64').waitFor({ state: 'visible', timeout: 5000 });
    await dashboardReopened.getByRole('button', { name: 'Show companion' }).click();
    report.steps.push('dashboard_teardown_and_restore_verified');

    // 8. Overlay interactive commands: bare math, model-independent clarification, cancellation & multi-step approval
    const ensureInputOpen = async () => {
      const input = overlay.locator('input[placeholder="Ask Companio..."]');
      if (await input.isVisible().catch(() => false)) return input;
      const askBtn = overlay.locator('button[title^="Ask Companio"]');
      if (await askBtn.count()) {
        await askBtn.click();
      } else {
        await overlay.locator('.companio-character').click();
      }
      await input.waitFor({ state: 'visible', timeout: 5000 });
      return input;
    };

    // (a) Bare arithmetic expression stays conversational and evaluates without prefix
    let cmdInput = await ensureInputOpen();
    await cmdInput.fill('12 * 15');
    await cmdInput.press('Enter');
    await overlay.locator('.companio-speech').filter({ hasText: '180' }).waitFor({ state: 'visible', timeout: 8000 });

    // (b) Ambiguous command enforces clarification and keeps input open
    cmdInput = await ensureInputOpen();
    await cmdInput.fill('Adjust the computer');
    await cmdInput.press('Enter');
    await overlay.locator('.companio-speech').filter({ hasText: 'Clarification' }).waitFor({ state: 'visible', timeout: 8000 });
    assert.equal(await cmdInput.isVisible(), true);

    // (c) Destructive request requires review & Cancel prevents execution
    await cmdInput.fill('empty recycle bin');
    await cmdInput.press('Enter');
    const approvalDialog = overlay.locator('[role="dialog"][aria-labelledby="companio-approval-title"]');
    await approvalDialog.waitFor({ state: 'visible', timeout: 8000 });
    await approvalDialog.getByRole('button', { name: 'Cancel', exact: true }).click();
    await approvalDialog.waitFor({ state: 'hidden', timeout: 5000 });
    const afterCancel = await overlay.evaluate(() => window.companioDesktop.loadHistoryStore());
    assert.equal(afterCancel.backup.automationLogs.some((l) => l.tool === 'win.recyclebin.empty'), false);

    // (d) Multi-step safe read-only execution requires review -> Approve -> Verified
    cmdInput = await ensureInputOpen();
    await cmdInput.fill('Check battery and get system specs');
    await cmdInput.press('Enter');
    await approvalDialog.waitFor({ state: 'visible', timeout: 8000 });
    const dialogText = await approvalDialog.textContent();
    assert.match(dialogText || '', /win\.battery\.get/);
    assert.match(dialogText || '', /win\.system\.specs/);
    await approvalDialog.getByRole('button', { name: /Run 2 actions/i }).click();
    await approvalDialog.waitFor({ state: 'hidden', timeout: 5000 });
    await overlay.waitForFunction(
      () => {
        const bubble = document.querySelector('.companio-speech');
        if (!bubble) return false;
        const text = bubble.textContent || '';
        return !text.includes('Working') && !text.includes('Queued') && text.includes('Verified');
      },
      { timeout: 45000 }
    );
    await overlay.waitForFunction(
      async () => {
        const store = await window.companioDesktop.loadHistoryStore();
        const tools = (store?.backup?.automationLogs || []).map((l) => l.tool);
        return tools.includes('win.battery.get') && tools.includes('win.system.specs');
      },
      { timeout: 10000 }
    );
    const afterMulti = await overlay.evaluate(() => window.companioDesktop.loadHistoryStore());
    const executedTools = afterMulti.backup.automationLogs.map((l) => l.tool);
    assert.equal(executedTools.includes('win.battery.get'), true);
    assert.equal(executedTools.includes('win.system.specs'), true);
    report.steps.push('overlay_commands_and_multistep_verified');

    console.log('COMPANIO_E2E_OK:', JSON.stringify(report));
  } finally {
    try {
      if (browser) {
        const anyPage = browser.contexts()[0]?.pages()?.[0];
        if (anyPage) {
          await Promise.race([
            anyPage.evaluate(() => window.companioDesktop?.quitApp?.()).catch(() => {}),
            new Promise((r) => setTimeout(r, 800))
          ]);
        }
        await browser.close().catch(() => {});
      }
    } catch {}
    await new Promise((r) => setTimeout(r, 500));
    if (child.exitCode === null) {
      try { child.kill('SIGKILL'); } catch {}
    }
    await new Promise((r) => setTimeout(r, 300));
    try { fs.rmSync(profileDir, { recursive: true, force: true }); } catch {}
    if (stdout || stderr) {
      // Keep quiet on success unless debugging needed
    }
  }
}

run().catch((err) => {
  console.error('COMPANIO_E2E_FAIL:', err);
  process.exit(1);
});
