import { test, expect } from '@playwright/test';
import { gotoScenario } from './helpers';

/**
 * The page must scroll under a finger at phone widths.
 *
 * It did not. syncPanelScrollLayout() wrote the desktop scroll sizing onto the
 * active panel at every width, which on a phone made it a scrollport with
 * nothing inside it to scroll — its height is its own content — and the
 * `overscroll-behavior: contain` that came with it stopped the gesture
 * chaining up to the document. The panel covers the whole screen, so every
 * touch went nowhere.
 *
 * **These tests drive a real touch gesture through CDP on purpose.** The bug
 * was invisible to `window.scrollBy`, `page.mouse.wheel` and `element.scrollTop`
 * — each of those scrolls the viewport directly and never consults the scroll
 * chain, so they all reported a healthy 400px while a finger moved 0. Swapping
 * the gesture here for a programmatic scroll would pass against the broken
 * build.
 */

const PHONE = { width: 390, height: 844 };

/**
 * One flick upward. Returns how far the page actually travelled.
 *
 * Two input methods, because `Input.synthesizeScrollGesture` relies on the
 * gesture synthesiser and returned 0 on the CI runner while working locally —
 * a green-to-red flake that says nothing about the app. An explicit
 * touchStart/touchMove/touchEnd sequence goes through the same input pipeline
 * with fewer moving parts, so it leads.
 *
 * The fallback does not soften the test. Both methods were measured against a
 * deliberately broken build and **both reported 0**, so whichever one runs,
 * a frozen page still fails. The fallback only covers one of them being
 * unsupported in an environment, never a real freeze.
 */
async function touchScroll(page: import('@playwright/test').Page, px = 400) {
  const client = await page.context().newCDPSession(page);
  const reset = () => page.evaluate(() => window.scrollTo(0, 0));
  const read = () => page.evaluate(() => window.scrollY);

  await reset();
  const send = (type: string, y: number) => client.send('Input.dispatchTouchEvent', {
    type, touchPoints: type === 'touchEnd' ? [] : [{ x: 195, y }],
  });
  const from = 300 + px, step = 40;
  await send('touchStart', from);
  for (let y = from; y >= 300; y -= step) { await send('touchMove', y); await page.waitForTimeout(16); }
  await send('touchEnd', 300);
  await page.waitForTimeout(600);
  const viaTouch = await read();
  if (viaTouch > 0) return viaTouch;

  await reset();
  await client.send('Input.synthesizeScrollGesture', {
    x: 195, y: 500, xDistance: 0, yDistance: -px, gestureSourceType: 'touch', speed: 800,
  });
  await page.waitForTimeout(600);
  return read();
}

test.describe('Scrolling at phone width', () => {
  test.use({ viewport: PHONE, hasTouch: true });

  test('every main tab scrolls under a finger', async ({ page }) => {
    await gotoScenario(page, 'student-semester');
    await page.waitForTimeout(2200);

    let checked = 0;
    for (const tab of ['dashboard', 'calendar', 'toolbox', 'settings']) {
      await page.evaluate((t) => (window as unknown as { nav: (x: string) => void }).nav(t), tab);
      await page.waitForTimeout(800);

      // Only meaningful where there is more content than screen.
      const tall = await page.evaluate(() =>
        document.documentElement.scrollHeight > window.innerHeight + 40);
      if (!tall) continue;

      checked++;
      const moved = await touchScroll(page);
      expect(moved, `${tab} did not move under a touch scroll`).toBeGreaterThan(50);
    }
    expect(checked, 'no tab was tall enough to scroll, so nothing was tested').toBeGreaterThan(0);
  });

  test('the active panel is not a dead scrollport', async ({ page }) => {
    await gotoScenario(page, 'student-semester');
    await page.waitForTimeout(2200);
    const panel = await page.evaluate(() => {
      const p = document.querySelector('.main-content > .panel.active') as HTMLElement | null;
      if (!p) return null;
      const s = getComputedStyle(p);
      return {
        overscroll: s.overscrollBehaviorY,
        scrollable: p.scrollHeight > p.clientHeight + 4,
      };
    });
    expect(panel, 'no active panel').not.toBeNull();
    /* A contained scrollport with nothing to scroll is the exact shape of the
       bug: it claims the gesture and passes nothing on. Either it genuinely
       scrolls, or it must not claim the gesture at all. */
    if (panel!.overscroll === 'contain') {
      expect(panel!.scrollable,
        'the panel claims the gesture (overscroll:contain) but has nothing to scroll').toBe(true);
    }
  });

  test('resizing a desktop window down to a phone does not freeze it', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await gotoScenario(page, 'student-semester');
    await page.waitForTimeout(2200);
    // Desktop writes the inline styles; shrinking has to clear them again.
    await page.setViewportSize(PHONE);
    await page.evaluate(() => (window as unknown as { nav: (x: string) => void }).nav('dashboard'));
    await page.waitForTimeout(800);
    const moved = await touchScroll(page);
    expect(moved, 'the page froze after resizing down to a phone').toBeGreaterThan(50);
  });
});

test.describe('Scrolling at desktop width', () => {
  test.use({ viewport: { width: 1280, height: 800 }, hasTouch: true });

  test('the panel still scrolls internally, as it always has', async ({ page }) => {
    await gotoScenario(page, 'student-semester');
    await page.waitForTimeout(2200);
    const r = await page.evaluate(() => {
      const p = document.querySelector('.main-content > .panel.active') as HTMLElement;
      const was = p.scrollTop;
      p.scrollTop = 200;
      const now = p.scrollTop;
      p.scrollTop = was;
      return { overflowY: getComputedStyle(p).overflowY, scrolled: now };
    });
    // The phone fix must not reach desktop, where the shell is viewport-height
    // and the panel is meant to be the scroller.
    expect(r.overflowY).toBe('auto');
    expect(r.scrolled, 'the desktop panel stopped scrolling').toBeGreaterThan(0);
  });
});
