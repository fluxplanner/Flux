import { test, expect } from '@playwright/test';
import { gotoScenario, openSidebarTab } from './helpers';

/**
 * Square icon buttons in Study Tools must actually centre their glyph.
 *
 * The timeline builder's delete ✕ sat visibly off-centre, and the cause was
 * not the glyph: a global `button` rule applied `padding: 10px 18px`, and with
 * `box-sizing: border-box` that is 36px of horizontal padding plus 2px of
 * border. The button asks for 30px, so the content box collapsed to *zero*
 * width and the element could not shrink below 38px. `place-items: center`
 * then centred the ✕ on a zero-width box sitting 18px in from the left edge —
 * it landed at x≈24.3 inside a 38px button whose centre is 19.
 *
 * Measuring is the whole point of this spec. "Looks centred" is what let the
 * original through, and the numbers are unambiguous: before the fix the glyph
 * was 5.3px right of centre and the button was 8px wider than it asked for.
 *
 * A Range over the text node is used rather than the button box, because the
 * button box is exactly what was lying — it kept the right outer shape while
 * its content box was degenerate.
 */

test('study icon buttons centre their glyph and keep their declared size', async ({ page }) => {
  await gotoScenario(page, 'student-semester');
  await openSidebarTab(page, 'toolbox');
  await page.waitForTimeout(1200);

  // Humanities → History & Geo → Timeline is where the delete buttons live.
  await page.evaluate(() => {
    (document.querySelector('#fshRoot [data-group="humanities"]') as HTMLElement | null)?.click();
  });
  await page.waitForTimeout(500);
  await page.evaluate(() => {
    (document.querySelector('#fshRoot [data-sub="history"]') as HTMLElement | null)?.click();
  });
  await page.waitForTimeout(900);
  await page.evaluate(() => {
    (document.querySelector('#fshRoot [data-tool="timeline"]') as HTMLElement | null)?.click();
  });
  await page.waitForTimeout(900);

  const info = await page.evaluate(() => {
    const btn = document.querySelector('.fsh-iconbtn[data-del]') as HTMLElement | null;
    if (!btn) return null;
    const box = btn.getBoundingClientRect();
    const range = document.createRange();
    range.selectNodeContents(btn);
    const ink = range.getBoundingClientRect();
    return {
      w: +box.width.toFixed(2),
      h: +box.height.toFixed(2),
      dx: +(ink.left + ink.width / 2 - box.left - box.width / 2).toFixed(2),
      dy: +(ink.top + ink.height / 2 - box.top - box.height / 2).toFixed(2),
      padding: getComputedStyle(btn).padding,
    };
  });

  expect(info, 'no timeline delete button found — did the tool move?').not.toBeNull();
  const r = info!;

  // The inline width must survive. It only does with the inherited padding
  // cleared; before that the button was forced out to 38px.
  expect(r.w, `button is ${r.w}px wide, not the 30px it asks for`).toBeCloseTo(30, 0);
  expect(r.h, `button is ${r.h}px tall, not 30px`).toBeCloseTo(30, 0);

  // Sub-pixel is fine; 5px is what the bug looked like.
  expect(Math.abs(r.dx), `glyph is ${r.dx}px off-centre horizontally`).toBeLessThan(1);
  expect(Math.abs(r.dy), `glyph is ${r.dy}px off-centre vertically`).toBeLessThan(1);

  // The direct cause, pinned so a future global button rule cannot re-break it
  // silently: any padding at all re-collapses the content box at this size.
  expect(r.padding, 'inherited button padding is back').toBe('0px');
});
