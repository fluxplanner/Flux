import { expect, test } from '@playwright/test';
import { gotoScenario } from './helpers';

/**
 * The planner must be quiet when nobody is touching it.
 *
 * Lag in Flux has come back several times the same way: a decoration that
 * never stops (a pulsing glow, a looping redraw) gets attached to something
 * there are many of — task rows — so the browser redoes work on every frame
 * for every row. Each one looks harmless alone and the page is slow for good.
 *
 * These checks count work rather than time it, so they give the same answer
 * on a fast laptop and a slow CI runner.
 */
test.describe('Dashboard stays quiet at rest', () => {
  test('a long task list costs nothing while the page sits idle', async ({ page }) => {
    await gotoScenario(page, 'student-semester');

    await page.evaluate(() => {
      const w = window as any;
      for (let i = 0; i < 60; i++) {
        w.tasks.push({
          id: 9_000_000 + i,
          name: 'Seed task ' + i,
          date: '2026-03-' + String(9 + (i % 10)).padStart(2, '0'),
          subject: '',
          priority: i % 3 === 0 ? 'high' : 'med',
          type: 'hw',
          done: false,
          estTime: 30,
        });
      }
      w.save('tasks', w.tasks);
      w.renderTasks();
    });
    await expect(page.locator('.task-item[data-priority="high"]').first()).toBeVisible();

    // Boot helpers poll for ~12s after the app appears; measure after they stop.
    await page.waitForTimeout(13_000);

    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Performance.enable');
    const layoutCount = async () =>
      (await cdp.send('Performance.getMetrics')).metrics.find((m) => m.name === 'LayoutCount')!.value;

    await page.evaluate(() => {
      const w = window as any;
      w.__idleRewrites = 0;
      w.__idleObserver = new MutationObserver((records) => {
        for (const r of records) {
          const el = r.target.nodeType === 1 ? (r.target as Element) : r.target.parentElement;
          // The clock ticking is expected; everything else is a redraw.
          if (el && el.closest('#topbarClock')) continue;
          w.__idleRewrites++;
        }
      });
      w.__idleObserver.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['class'] });
    });

    const before = await layoutCount();
    await page.waitForTimeout(3_000);
    const layouts = (await layoutCount()) - before;

    const { rewrites, rowAnimations } = await page.evaluate(() => {
      const w = window as any;
      w.__idleObserver.disconnect();
      const rowAnimations = document
        .getAnimations()
        .filter((a) => {
          const effect = a.effect as KeyframeEffect | null;
          const target = effect?.target;
          return (
            a.playState === 'running' &&
            effect?.getComputedTiming().iterations === Infinity &&
            !!target?.closest('.task-item')
          );
        })
        .map((a) => (a as CSSAnimation).animationName || 'script animation');
      return { rewrites: w.__idleRewrites as number, rowAnimations: [...new Set(rowAnimations)] };
    });

    expect(rowAnimations, 'never-ending animations on task rows — one runs per row, forever').toEqual([]);
    // The pulsing glow alone caused ~180 here (one per frame).
    expect(layouts, 'page layouts in 3 idle seconds').toBeLessThanOrEqual(20);
    expect(rewrites, 'parts of the page redrawn in 3 idle seconds').toBeLessThanOrEqual(40);
  });
});
