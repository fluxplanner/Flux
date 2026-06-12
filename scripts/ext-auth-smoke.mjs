/**
 * ext-auth-smoke.mjs — verifies the planner→extension handoff end to end:
 *   • a tab opened with ?ext_auth=1 posts the session → extension stores it
 *     and CLOSES the tab
 *   • BYOK routing config rides along and lands in storage
 *   • a non-planner origin is rejected
 *
 * Simulates the page side with postMessage on the real planner origin, so the
 * content-script relay + background origin check + tab close run for real.
 *
 *   node scripts/ext-auth-smoke.mjs
 */
import { chromium } from '@playwright/test';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const extPath = resolve(root, 'dist/chrome');

const ok = (label) => console.log('  ✓', label);
const fail = (label, extra) => { console.error('  ✗', label, extra || ''); process.exitCode = 1; };

const ctx = await chromium.launchPersistentContext('', {
  headless: false,
  args: [`--disable-extensions-except=${extPath}`, `--load-extension=${extPath}`],
});

try {
  let [sw] = ctx.serviceWorkers();
  if (!sw) sw = await ctx.waitForEvent('serviceworker', { timeout: 15000 });
  ok('extension loaded');

  const page = await ctx.newPage();
  await page.goto('https://fluxplanner.github.io/Flux/?ext_auth=1', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500); // content script injects at document_idle

  const closed = new Promise((res) => page.once('close', () => res(true)));

  await page.evaluate(() => {
    window.postMessage({
      type: 'FLUX_EXT_AUTH_TOKEN',
      closeTab: true,
      routing: {
        mode: 'openai_compatible',
        openaiCompatible: { apiKey: 'sk-smoke-fake', baseUrl: 'https://api.example.com/v1', model: 'smoke-model' },
      },
      session: {
        access_token: 'smoke-test-token',
        refresh_token: '',
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        email: 'smoke@test.local',
      },
    }, location.origin);
  });

  const didClose = await Promise.race([closed, new Promise((res) => setTimeout(() => res(false), 8000))]);
  if (didClose) ok('auth tab closed itself after handoff');
  else fail('auth tab did NOT close');

  const stored = await sw.evaluate(() => chrome.storage.local.get(['flux_auth_session', 'flux_ai_routing']));
  if (stored.flux_auth_session?.email === 'smoke@test.local') ok('session stored: ' + stored.flux_auth_session.email);
  else fail('session not stored', JSON.stringify(stored.flux_auth_session));
  if (stored.flux_ai_routing?.openaiCompatible?.model === 'smoke-model') ok('BYOK routing stored: ' + stored.flux_ai_routing.openaiCompatible.model);
  else fail('routing not stored', JSON.stringify(stored.flux_ai_routing));

  // Origin check: a non-planner page must be rejected.
  const evil = await ctx.newPage();
  await evil.goto('https://example.com/', { waitUntil: 'domcontentloaded' });
  await evil.waitForTimeout(2000);
  await evil.evaluate(() => {
    window.postMessage({
      type: 'FLUX_EXT_AUTH_TOKEN',
      closeTab: false,
      session: { access_token: 'evil-token', email: 'evil@test.local' },
    }, location.origin);
  });
  await evil.waitForTimeout(1500);
  const after = await sw.evaluate(() => chrome.storage.local.get('flux_auth_session'));
  if (after.flux_auth_session?.email === 'smoke@test.local') ok('non-planner origin rejected');
  else fail('origin check failed — token overwritten', JSON.stringify(after));

  await sw.evaluate(() => chrome.storage.local.remove(['flux_auth_session', 'flux_ai_routing']));
  ok('cleaned up');
} catch (e) {
  fail('auth smoke crashed', e.message);
} finally {
  await ctx.close();
}
console.log(process.exitCode ? '\nAUTH SMOKE: FAILED' : '\nAUTH SMOKE: PASSED');
