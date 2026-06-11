/**
 * ext-smoke.mjs — loads dist/chrome into Chromium and exercises the side rail
 * for real: fresh page snapshot, streamed text answer, and Live-view vision
 * answer, all against the live ai-proxy.
 *
 *   node scripts/ext-smoke.mjs
 */
import { chromium } from '@playwright/test';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const extPath = resolve(root, 'dist/chrome');

const ok = (label) => console.log('  ✓', label);
const fail = (label, extra) => {
  console.error('  ✗', label, extra || '');
  process.exitCode = 1;
};

const ctx = await chromium.launchPersistentContext('', {
  headless: false,
  args: [
    `--disable-extensions-except=${extPath}`,
    `--load-extension=${extPath}`,
  ],
});

try {
  // Find the extension id via its MV3 service worker.
  let [sw] = ctx.serviceWorkers();
  if (!sw) sw = await ctx.waitForEvent('serviceworker', { timeout: 15000 });
  const extId = new URL(sw.url()).host;
  ok('extension loaded: ' + extId);

  // Content tab (active) — a text-rich page.
  const content = await ctx.newPage();
  await content.goto('https://en.wikipedia.org/wiki/Photosynthesis', { waitUntil: 'domcontentloaded' });

  // Sidebar in a background tab (stands in for the side panel).
  const sidebar = await ctx.newPage();
  await sidebar.goto(`chrome-extension://${extId}/sidebar/sidebar.html`);
  await content.bringToFront();
  await sidebar.waitForTimeout(800); // ctx refresh debounce

  // 1. Context bar sees the active tab.
  const ctxTitle = await sidebar.locator('#ctxTitle').textContent();
  if (/photosynthesis/i.test(ctxTitle || '')) ok('context bar tracks active tab: ' + ctxTitle.trim());
  else fail('context bar shows wrong tab', JSON.stringify(ctxTitle));

  // 2. Streamed text answer (Live off → snapshot text path).
  const liveOn = await sidebar.locator('#liveToggle').evaluate((el) => el.classList.contains('on'));
  if (liveOn) await sidebar.locator('#liveToggle').click();
  await sidebar.locator('#composer').fill('In one short sentence: what is this page about?');
  await sidebar.locator('#sendBtn').click();
  const bot1 = sidebar.locator('.msg.bot').first();
  await sidebar.waitForFunction(
    () => {
      const b = document.querySelectorAll('.msg.bot')[0];
      return b && !b.querySelector('.thinking') && (b.textContent || '').length > 10;
    },
    null,
    { timeout: 60000 },
  );
  const t1 = (await bot1.textContent()) || '';
  if (await bot1.evaluate((el) => el.classList.contains('error'))) fail('text answer errored', t1.slice(0, 200));
  else if (/photosynthesis|plant|light|energy/i.test(t1)) ok('text answer is page-aware: ' + t1.trim().slice(0, 90) + '…');
  else fail('text answer not page-aware', t1.slice(0, 200));

  // 3. Vision answer (Live on → screenshot of the active tab).
  await sidebar.locator('#liveToggle').click(); // back on
  await sidebar.locator('#composer').fill('What do you see on my screen right now? One sentence.');
  await sidebar.locator('#sendBtn').click();
  await sidebar.waitForFunction(
    () => {
      const bots = document.querySelectorAll('.msg.bot');
      const b = bots[bots.length - 1];
      return b && !b.querySelector('.thinking') && (b.textContent || '').length > 10;
    },
    null,
    { timeout: 90000 },
  );
  const bot2 = sidebar.locator('.msg.bot').last();
  const t2 = (await bot2.textContent()) || '';
  const hasNote = (await bot2.locator('.vision-note').count()) > 0;
  if (await bot2.evaluate((el) => el.classList.contains('error'))) fail('vision answer errored', t2.slice(0, 200));
  else if (hasNote) ok('vision (Live view) answer: ' + t2.replace(/^.*?tab/, '').trim().slice(0, 90) + '…');
  else fail('vision note missing on Live-view answer', t2.slice(0, 120));

  // 4. Math answer renders as real fractions (flux-tex), not raw LaTeX.
  await sidebar.locator('#liveToggle').click(); // live off — text path
  await sidebar.locator('#composer').fill('Compute $\\frac{3}{4} + \\frac{1}{8}$ and give the result as a fraction in LaTeX.');
  await sidebar.locator('#sendBtn').click();
  await sidebar.waitForFunction(
    () => {
      const bots = document.querySelectorAll('.msg.bot');
      const b = bots[bots.length - 1];
      return b && !b.querySelector('.thinking') && (b.textContent || '').length > 5;
    },
    null,
    { timeout: 60000 },
  );
  const bot3 = sidebar.locator('.msg.bot').last();
  const mathRendered = (await bot3.locator('.tx').count()) > 0;
  const rawDollars = /\$\\?frac|\\frac\{/.test((await bot3.textContent()) || '');
  if (mathRendered && !rawDollars) ok('LaTeX renders as real math (.tx present, no raw \\frac)');
  else fail('math did not render', 'tx=' + mathRendered + ' raw=' + rawDollars);

  await sidebar.screenshot({ path: 'test-results/ext-sidebar.png', fullPage: true });
  ok('screenshot saved → test-results/ext-sidebar.png');
} catch (e) {
  fail('smoke run crashed', e.message);
} finally {
  await ctx.close();
}
console.log(process.exitCode ? '\nSMOKE: FAILED' : '\nSMOKE: PASSED');
