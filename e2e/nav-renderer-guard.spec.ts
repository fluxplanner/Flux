import { expect, test } from '@playwright/test';
import { gotoScenario } from './helpers';

/**
 * nav() swaps the panel first and then calls that panel's renderer. A renderer
 * that threw used to abort nav() there, skipping everything after it — split
 * layout, recents, the after-nav hooks and the panel animation — and leaving
 * the user on a half-drawn tab with nothing in the console, because the
 * deferred caller swallowed the exception.
 */
test('a panel renderer that throws does not abort the rest of nav()', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

  await gotoScenario(page, 'student-semester');
  await page.evaluate(() => {
    const w = window as any;
    w.__navAfter = [];
    const orig = w.fluxAnimeNavAfter;
    w.fluxAnimeNavAfter = (id: string) => { w.__navAfter.push(id); if (typeof orig === 'function') orig(id); };
    // The toolbox renderer reaches through window, so this is the one it calls.
    w.renderToolbox = () => { throw new Error('renderer boom'); };
    try { w.nav('toolbox'); } catch (_) { /* the deferred path swallows it too */ }
  });

  // The swap is deferred a few frames; the after-nav hook is the last step.
  await expect.poll(() => page.evaluate(() => (window as any).__navAfter)).toContain('toolbox');
  expect(errors.some((e) => e.includes('[Flux:nav] panel renderer failed')),
    'the failure must still be reported, not silently caught').toBe(true);
});
