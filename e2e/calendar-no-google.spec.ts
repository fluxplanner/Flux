import { test, expect } from '@playwright/test';
import { gotoScenario } from './helpers';

test('calendar has no dead Google card, and still works', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

  await page.setViewportSize({ width: 1400, height: 950 });
  await gotoScenario(page, 'student-semester');
  await page.evaluate(() => (window as any).nav('calendar'));
  await page.waitForTimeout(1500);

  const r = await page.evaluate(() => ({
    gcalCard: !!document.querySelector('.cal-gcal-inline'),
    gcalStatus: !!document.getElementById('gcalStatus'),
    gcalEvents: !!document.getElementById('gcalEvents'),
    grid: !!document.querySelector('.cal-day[data-cal-date]'),
    days: document.querySelectorAll('.cal-day[data-cal-date]').length,
    text: (document.getElementById('calendar')?.innerText || ''),
  }));
  expect(r.gcalCard, 'the dead Google card is still there').toBe(false);
  expect(r.gcalStatus).toBe(false);
  expect(r.gcalEvents).toBe(false);
  // The tab still works — removing the card must not take the grid with it.
  expect(r.grid, 'the calendar grid did not render').toBe(true);
  expect(r.days).toBeGreaterThan(27);
  expect(r.text, 'the calendar still tells people to sign in with Google')
    .not.toMatch(/sign in with google/i);
  const real = errors.filter((e) => !/favicon|manifest|404/i.test(e));
  expect(real, `console errors: ${real.join(' | ')}`).toEqual([]);
  console.log(`grid ok: ${r.days} days, no Google card, no console errors`);
});
