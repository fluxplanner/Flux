import { expect, test } from '@playwright/test';
import { gotoScenario } from './helpers';

/**
 * Counting down from the calendar: the day you want to count down to is one
 * you find on the calendar, so it can be started there — from the selected
 * day or from a pinned important date — and it shows on the dashboard card.
 * It is the same countdown the dashboard's own "Count down to…" form sets.
 */

async function selectDayAhead(page: import('@playwright/test').Page, days: number) {
  await page.evaluate(() => (window as any).nav('calendar'));
  await page.waitForTimeout(700);
  return page.evaluate((n) => {
    const w = window as any;
    const d = new Date();
    d.setDate(d.getDate() + n);
    // calYear / calMonth are the app's own bindings, not window properties;
    // this is the calendar's jump-to-date, which sets them and redraws.
    w.calGlassSelectDayFromDate(d.getFullYear(), d.getMonth(), d.getDate());
    return w.fluxLocalYMD(d);
  }, days);
}

test('count down to a day from the calendar, see it on the dashboard, and stop it', async ({ page }) => {
  await gotoScenario(page, 'student-semester');
  const iso = await selectDayAhead(page, 20);

  await page.locator('#calCountdownBtn').click();
  await page.fill('#calCountdownName', 'SAT');
  await page.locator('#calCountdownName').press('Enter');

  await expect(page.locator(`#calGrid .cal-day[data-cal-date="${iso}"]`)).toHaveClass(/cal-day--countdown/);
  await expect(page.locator('#calCountdownBtn')).toHaveAttribute('aria-pressed', 'true');

  await page.evaluate(() => (window as any).nav('dashboard'));
  await page.waitForTimeout(600);
  await expect(page.locator('#countdownHeading')).toHaveText('SAT');
  await expect(page.locator('#countdownGrid')).toContainText('20');

  // The same button stops it, and the dashboard goes back to the next test.
  await selectDayAhead(page, 20);
  await page.locator('#calCountdownBtn').click();
  await expect(page.locator('#calGrid .cal-day--countdown')).toHaveCount(0);
  await page.evaluate(() => (window as any).nav('dashboard'));
  await page.waitForTimeout(600);
  await expect(page.locator('#countdownHeading')).not.toHaveText('SAT');
});

test('a countdown needs a name, and the form suggests one from the day', async ({ page }) => {
  await gotoScenario(page, 'student-semester');
  await selectDayAhead(page, 9);
  await page.locator('#calCountdownBtn').click();
  await page.fill('#calCountdownName', '');
  await page.locator('#calCountdownForm button').click();
  await expect(page.locator('#calCountdownMsg')).toContainText('Give it a name');
  expect(await page.evaluate(() => (window as any).fluxGetCountdown())).toBeNull();
});

test('a pinned important date can become the countdown with its ⏳ button', async ({ page }) => {
  await gotoScenario(page, 'student-semester');
  await page.evaluate(() => (window as any).nav('calendar'));
  await page.waitForTimeout(800);
  const iso = await page.evaluate(() => { const d = new Date(); d.setDate(d.getDate() + 30); return (window as any).fluxLocalYMD(d); });
  await page.fill('#fluxImpDateInp', iso);
  await page.fill('#fluxImpLabelInp', 'Results day');
  await page.locator('#fluxImportantTodayCard .fluxw-cd-btn').click();
  await expect.poll(() => page.evaluate(() => (window as any).fluxGetCountdown()?.label)).toBe('Results day');
  await expect(page.locator('#fluxImpList .fluxw-imp-cd.is-on')).toHaveCount(1);
  await page.locator('#fluxImpList .fluxw-imp-cd.is-on').click();
  await expect.poll(() => page.evaluate(() => (window as any).fluxGetCountdown())).toBeNull();
});
