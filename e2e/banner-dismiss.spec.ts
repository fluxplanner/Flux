import { test, expect } from '@playwright/test';
import { gotoScenario } from './helpers';

/**
 * Dismissing a dashboard banner has to stick.
 *
 * checkTimePoverty() paints the "today may not fit your free time" banner, and
 * it runs on every dashboard render *and* on a 60-second setInterval. The
 * dismiss button used to do nothing but strip the `on` class, so the very next
 * run put the banner straight back: you clicked ✕, it vanished, and within the
 * minute it returned. Reported as "dismiss just doesn't work", which is exactly
 * what it looked like from the outside.
 *
 * These tests drive the checker directly rather than waiting on the real timer —
 * a 60-second wait per assertion would be unusable, and calling the function is
 * precisely what the timer does.
 */

// Midday, because the detector measures free time as "now until 23:00". Run
// this at 23:30 and freeMin is 0, the banner never appears, and the whole test
// passes without proving anything. Matches the pinned clock other specs use.
const MIDDAY = new Date('2026-03-10T12:00:00');

const DISMISS_KEY = 'flux_banner_dismissed';

/** Put the app into the state where the workload banner is warranted. */
async function forceOverloadedDay(page: import('@playwright/test').Page) {
  return page.evaluate((key) => {
    const w = window as any;
    const d = new Date();
    const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    // Far more work than hours remaining, so totalEstMin > freeMin holds.
    w.tasks = [{ id: 'e2e-overload', name: 'Overloaded', date: today, estTime: 5000, done: false }];
    // Go through save(), not localStorage directly — Flux namespaces its keys,
    // so a raw removeItem would clear nothing and the reset would be a no-op.
    w.save(key, null);
    w.checkTimePoverty();
    const b = document.getElementById('timePovertyBanner');
    return { on: !!b?.classList.contains('on'), html: b?.innerHTML ?? '', today };
  }, DISMISS_KEY);
}

test('dismissing the workload banner survives the next render', async ({ page }) => {
  await page.clock.setFixedTime(MIDDAY);
  await gotoScenario(page, 'student-semester');
  await page.waitForTimeout(1200);

  const shown = await forceOverloadedDay(page);
  expect(shown.on, 'banner should be showing before we try to dismiss it').toBe(true);
  expect(shown.html).toContain('time-poverty-banner__dismiss');

  await page.click('#timePovertyBanner .time-poverty-banner__dismiss');

  const afterClick = await page.evaluate(() =>
    document.getElementById('timePovertyBanner')?.classList.contains('on'));
  expect(afterClick, 'clicking ✕ should hide the banner').toBe(false);

  // The regression itself: this is what the 60-second timer and every dashboard
  // render do. Before the fix, the banner was back on the first call.
  const afterRerun = await page.evaluate(() => {
    const w = window as any;
    w.checkTimePoverty();
    w.checkTimePoverty();
    return document.getElementById('timePovertyBanner')?.classList.contains('on');
  });
  expect(afterRerun, 'banner reappeared after being dismissed — dismiss does not stick').toBe(false);
});

test('the dismissal is scoped to today, so a new day warns again', async ({ page }) => {
  await page.clock.setFixedTime(MIDDAY);
  await gotoScenario(page, 'student-semester');
  await page.waitForTimeout(1200);

  const shown = await forceOverloadedDay(page);
  expect(shown.on).toBe(true);

  const stored = await page.evaluate((key) => {
    const w = window as any;
    w.tpDismissBanner('crunch');
    return w.load(key, null);
  }, DISMISS_KEY);

  expect(stored, 'dismissal should be written to storage').not.toBeNull();
  expect(stored.date, 'dismissal should be stamped with today').toBe(shown.today);
  expect(stored.kinds).toContain('crunch');

  // Carrying yesterday's dismissal into a new day must not silence a genuinely
  // new warning — the banner is a claim about *today's* workload.
  const afterStaleDate = await page.evaluate((key) => {
    const w = window as any;
    w.save(key, { date: '2020-01-01', kinds: ['crunch'] });
    w.checkTimePoverty();
    return document.getElementById('timePovertyBanner')?.classList.contains('on');
  }, DISMISS_KEY);

  expect(afterStaleDate, 'a stale dismissal should not suppress today\'s banner').toBe(true);
});
