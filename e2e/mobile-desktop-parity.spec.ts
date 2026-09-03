import { test, expect } from '@playwright/test';
import { gotoScenario } from './helpers';

/*
 * "Mobile looks too different from desktop."
 *
 * The complaint turned out not to be about styling tokens — measured at both
 * widths the cards share their radius, border, colour, heading size and
 * weight, and only the padding tightens (18px 20px -> 12px), which is what you
 * want on a phone. The difference was in *what gets shown*.
 *
 * The next-exam countdown sat in a `display:none !important` list for screens
 * under 768px, so the laptop showed a card the phone did not. There was no
 * layout reason: at 390px it lays out 358px wide with nothing overflowing.
 *
 * These pin the parity rather than the pixels, so a future mobile-only hide
 * fails a test instead of being noticed months later.
 */

test.describe('Mobile and desktop show the same dashboard cards', () => {
  test('the next-exam countdown is on the phone too, and fits', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await gotoScenario(page, 'student-semester');

    const card = page.locator('#countdownCard');
    await expect(card).toBeVisible();

    const fits = await page.evaluate(() => {
      const c = document.getElementById('countdownCard')!;
      const overflowing = [...c.querySelectorAll('*')].filter(
        (e) => e.getBoundingClientRect().right > window.innerWidth,
      ).length;
      return {
        width: Math.round(c.getBoundingClientRect().width),
        viewport: window.innerWidth,
        overflowing,
      };
    });
    expect(fits.overflowing).toBe(0);
    expect(fits.width).toBeLessThanOrEqual(fits.viewport);

    // The labels, not the numbers — those move with today's date.
    await expect(card).toContainText(/Days/i);
    await expect(card).toContainText(/Weeks/i);
  });

  test('the same card is on the laptop, so the two agree', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await gotoScenario(page, 'student-semester');
    await expect(page.locator('#countdownCard')).toBeVisible();
  });

  test('the phone can set up A/B days and weekly repeats, not just read them', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await gotoScenario(page, 'student-semester');
    await page.evaluate(() => (window as unknown as { nav: (t: string) => void }).nav('calendar'));

    const setup = page.locator('#calendar .cal-schedule-setup');
    await expect(setup).toBeVisible();

    /* This is the only place in Flux that sets the cycle pattern, so while it
       was hidden under 768px a phone-only student could see the A/B letters on
       their calendar and had no way at all to switch them on. */
    await expect(page.locator('#cycleEnabled')).toBeVisible();
    await expect(page.locator('#cyclePatternInput')).toBeVisible();
    await expect(page.locator('#weeklyTitleInput')).toBeVisible();

    const touch = await page.evaluate(() => {
      const card = document.querySelector('.cal-schedule-setup')!;
      // offsetHeight, not getBoundingClientRect: layout pixels are immune to
      // any page scaling, and a 0.97 scale reads a real 44px control as 42.7.
      const controls = [...card.querySelectorAll('input:not([type=checkbox]),select,button')];
      const labels = [...card.querySelectorAll('label')].filter((l) => l.querySelector('input[type=checkbox]'));
      const small = (els: Element[]) =>
        els.filter((e) => (e as HTMLElement).offsetHeight > 0 && (e as HTMLElement).offsetHeight < 44).length;
      return {
        controls: controls.length,
        controlsUnder44: small(controls),
        labels: labels.length,
        labelsUnder44: small(labels),
        overflowing: [...card.querySelectorAll('*')].filter(
          (e) => e.getBoundingClientRect().width > 0 && e.getBoundingClientRect().right > window.innerWidth + 1,
        ).length,
      };
    });

    expect(touch.controls).toBeGreaterThan(0);
    expect(touch.labels).toBeGreaterThan(0);
    // 17 of these were under the thumb minimum before the card was unhidden.
    expect(touch.controlsUnder44).toBe(0);
    expect(touch.labelsUnder44).toBe(0);
    expect(touch.overflowing).toBe(0);
  });

  test('the phone still gets its own quick-glance layer', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await gotoScenario(page, 'student-semester');

    // Showing the countdown must not have cost the mobile-only stack, which is
    // what puts a task on screen without scrolling.
    await expect(page.locator('.dash-mob-stack')).toBeVisible();
    await expect(page.locator('#dashMobStats')).toBeVisible();
  });
});

/*
 * School Info on a phone. Found by measuring every control on every tab at
 * 390px against the 44px thumb minimum, which is also how the Settings switch
 * fault was found.
 *
 * All sizes below use offsetHeight/offsetWidth rather than
 * getBoundingClientRect, because layout pixels are immune to page scaling.
 */
test.describe('School Info is usable on a phone', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await gotoScenario(page, 'student-semester');
    await page.evaluate(() => (window as unknown as { nav: (t: string) => void }).nav('school'));
    await expect(page.locator('#school.panel.active')).toBeVisible();
  });

  test('edit and delete on a class row are thumb-sized and named', async ({ page }) => {
    const rows = await page.evaluate(() =>
      [...document.querySelectorAll('#school .class-row button')]
        .filter((b) => (b as HTMLElement).offsetHeight > 0)
        .map((b) => ({
          w: (b as HTMLElement).offsetWidth,
          h: (b as HTMLElement).offsetHeight,
          name: b.getAttribute('aria-label') || b.getAttribute('title') || '',
        })),
    );

    expect(rows.length).toBeGreaterThan(0);
    // Were 18x24 (edit) and 20x28 (delete) — under a quarter and under a third
    // of the target area, sitting side by side with the destructive one on the
    // outside. The realistic mistake was deleting a class while aiming for edit.
    for (const b of rows) {
      expect(b.w).toBeGreaterThanOrEqual(44);
      expect(b.h).toBeGreaterThanOrEqual(44);
      expect(b.name).not.toBe('');
    }
  });

  test('you can actually fill in the add-a-class form', async ({ page }) => {
    const widths = await page.evaluate(() =>
      ['classPeriod', 'className', 'classTeacher', 'classDays'].map((id) => ({
        id,
        w: (document.getElementById(id) as HTMLElement).offsetWidth,
      })),
    );
    // Class Name and Teacher were 46px and Days 45px — narrower than their own
    // placeholders, so you could not read what you had typed.
    for (const f of widths) expect(f.w).toBeGreaterThan(200);

    // And the form still works end to end from the stacked layout.
    await page.fill('#className', 'E2E Chemistry');
    await page.fill('#classPeriod', 'B4');
    await page.click('#school .sch-add-class-row > button');

    const added = await page.evaluate(() =>
      ((window as unknown as { load: (k: string, d: unknown) => Array<Record<string, unknown>> })
        .load('flux_classes', []) || []).find((c) => c.name === 'E2E Chemistry'),
    );
    expect(added).toBeTruthy();
    // The A/B period parsing survives the relayout.
    expect(added!.periodLabel).toBe('B4');
    expect(added!.days).toBe('B Day');
  });

  /*
   * A stylesheet contradicting itself. flux-touch-targets.css:70 lists
   * .tmode-btn among the buttons that must clear 44px, but flux-mobile-app.css
   * pinned `#timer .tmode-btn { min-height: 38px !important }` — (1,1,0) plus
   * !important against (0,1,0) — so the accessibility rule had been dead on
   * that tab since it was written and all eight mode buttons sat at 38.
   */
  test('the timer mode buttons honour the size the stylesheet asks for', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await gotoScenario(page, 'student-semester');
    await page.evaluate(() => (window as unknown as { nav: (t: string) => void }).nav('timer'));
    await expect(page.locator('#timer.panel.active')).toBeVisible();

    const heights = await page.evaluate(() =>
      [...document.querySelectorAll('#timer .tmode-btn')]
        .map((b) => (b as HTMLElement).offsetHeight)
        .filter((h) => h > 0),
    );
    expect(heights.length).toBeGreaterThan(0);
    expect(heights.filter((h) => h < 44)).toEqual([]);
  });

  test('the desktop layout is left alone', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    const cols = await page.evaluate(
      () => getComputedStyle(document.querySelector('#school .sch-add-class-row')!).gridTemplateColumns,
    );
    // Four tracks on a laptop, not the phone's single column.
    expect(cols.split(' ').length).toBe(4);
  });
});
