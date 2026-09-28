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

test('count down to a day from the calendar, see it in the top bar, and stop it', async ({ page }) => {
  await gotoScenario(page, 'student-semester');
  const iso = await selectDayAhead(page, 20);

  await page.locator('#calCountdownBtn').click();
  await page.fill('#calCountdownName', 'SAT');
  await page.locator('#calCountdownName').press('Enter');

  await expect(page.locator(`#calGrid .cal-day[data-cal-date="${iso}"]`)).toHaveClass(/cal-day--countdown/);
  await expect(page.locator('#calCountdownBtn')).toHaveAttribute('aria-pressed', 'true');

  // It shows in the top bar, on every tab.
  await expect(page.locator('#topbarCountdown')).toContainText('SAT');
  await expect(page.locator('#topbarCountdown')).toContainText('20');

  // The same button stops it, and the dashboard goes back to the next test.
  await selectDayAhead(page, 20);
  await page.locator('#calCountdownBtn').click();
  await expect(page.locator('#calGrid .cal-day--countdown')).toHaveCount(0);
  await expect(page.locator('#topbarCountdown')).not.toContainText('SAT');
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

/*
 * The countdown moved into the top bar, and on a laptop screen it slid over
 * "New task": the right-hand group could not shrink and the left one could
 * shrink narrower than its own buttons. Nothing in the top bar may overlap,
 * at any laptop width, with a long countdown name.
 */
test('the top bar never overlaps at laptop widths', async ({ page }) => {
  await gotoScenario(page, 'student-semester');
  await page.evaluate(() => {
    const w = window as any;
    const d = new Date();
    d.setDate(d.getDate() + 257);
    w.fluxSetCountdown('Last Day of School', w.fluxLocalYMD(d));
    w.nav('calendar');
  });
  for (const width of [1440, 1200, 1100, 1000, 900, 800]) {
    await page.setViewportSize({ width, height: 800 });
    await page.waitForTimeout(250);
    const r = await page.evaluate(() => {
      const els = [...document.querySelectorAll('.topbar .topbar-left-cluster > *, .topbar .topbar-right > *, #topbarTaskPill')]
        .filter((e) => (e as HTMLElement).offsetParent && e.getBoundingClientRect().width > 0)
        .map((e) => ({ id: e.id || (e as HTMLElement).className.split(' ')[0], b: e.getBoundingClientRect() }))
        .sort((a, b) => a.b.left - b.b.left);
      const bad: string[] = [];
      for (let i = 1; i < els.length; i++) if (els[i].b.left < els[i - 1].b.right - 1) bad.push(els[i - 1].id + ' × ' + els[i].id);
      const off = els.filter((e) => e.b.right > innerWidth + 1).map((e) => e.id);
      return { bad, off };
    });
    expect(r.bad, `overlap at ${width}px`).toEqual([]);
    expect(r.off, `pushed off-screen at ${width}px`).toEqual([]);
  }
  await expect(page.locator('#topbarCountdown')).toHaveAttribute('title', /Last Day of School/);
});

/* A countdown set on a Mac never reached the iPad: flux_countdown was saved and
   syncKey('countdown') fired, but the value was never in getCloudPayload(). It
   travels now, and the newest change wins — including a cleared one. */
test('the countdown goes to every device, and the newest change wins', async ({ page }) => {
  await gotoScenario(page, 'student-semester');
  const r = await page.evaluate(() => {
    const w = window as any;
    const ymd = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); return w.fluxLocalYMD(d); };
    const out: Record<string, unknown> = {};
    w.fluxSetCountdown('Trip', ymd(30), '');
    const sent = w.getCloudPayload().countdown;
    out.sentLabel = sent?.v?.label;
    out.sentStamped = sent?.at > 0;
    // Another device changed it later: this one follows.
    out.took = w.fluxApplyCountdownFromCloud({ v: { label: 'Results day', date: ymd(12), time: '09:00' }, at: sent.at + 5000 });
    out.nowLabel = w.fluxGetCountdown()?.label;
    out.pill = document.getElementById('topbarCountdown')?.textContent || '';
    // An older copy never overwrites a newer one.
    out.oldTook = w.fluxApplyCountdownFromCloud({ v: { label: 'Stale', date: ymd(3), time: '' }, at: 1 });
    out.afterOld = w.fluxGetCountdown()?.label;
    // Junk from the cloud is ignored: not shown, and not allowed to wipe a good one.
    out.junkTook = w.fluxApplyCountdownFromCloud({ v: { label: '<b>x</b>', date: 'soon' }, at: Date.now() + 60000 });
    out.afterJunk = w.fluxGetCountdown()?.label;
    // Cleared on another device: cleared here too.
    w.fluxSetCountdown('Trip', ymd(30), '');
    w.fluxApplyCountdownFromCloud({ v: null, at: Date.now() + 120000 });
    out.afterClear = w.fluxGetCountdown();
    return out;
  });
  expect(r.sentLabel, 'the countdown is not in what gets uploaded').toBe('Trip');
  expect(r.sentStamped).toBe(true);
  expect(r.took).toBe(true);
  expect(r.nowLabel).toBe('Results day');
  expect(r.pill).toContain('Results day');
  expect(r.oldTook).toBe(false);
  expect(r.afterOld).toBe('Results day');
  expect(r.junkTook).toBe(false);
  expect(r.afterJunk, 'a malformed countdown from the cloud replaced a good one').toBe('Results day');
  expect(r.afterClear, 'clearing on another device did not clear it here').toBeNull();
});
