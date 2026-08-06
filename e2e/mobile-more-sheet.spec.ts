import { test, expect, type Page } from '@playwright/test';
import { gotoScenario } from './helpers';

/*
 * P0 A2 — mobile "More" sheet lifecycle.
 *
 * Live bug: after opening the More sheet and tapping an item, the sheet stayed
 * permanently visible. Root cause: the anime.js open spring left an inline
 * `transform: translateY(0%)` that outlived the animation, so removing the
 * `.open` class never moved the sheet, and the Escape handler's
 * `classList.contains('open')` guard short-circuited every later attempt.
 *
 * The fix makes closeMobileSheet() idempotent and animation-independent and
 * judges Escape by geometry. These tests drive the real UI at a phone
 * viewport and assert the sheet actually leaves the screen every time.
 */

test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

/** Sheet is closed when it sits below the viewport (geometry, not class state). */
async function expectSheetClosed(page: Page) {
  await page.waitForFunction(() => {
    const sh = document.getElementById('moreSheet');
    if (!sh) return false;
    const r = sh.getBoundingClientRect();
    return r.top >= window.innerHeight - 1 && sh.getAttribute('aria-hidden') === 'true';
  }, undefined, { timeout: 5_000 });
}

async function expectSheetOpen(page: Page) {
  await page.waitForFunction(() => {
    const sh = document.getElementById('moreSheet');
    if (!sh) return false;
    const r = sh.getBoundingClientRect();
    return r.top < window.innerHeight && sh.classList.contains('open');
  }, undefined, { timeout: 5_000 });
}

test.describe('Mobile More sheet lifecycle', () => {
  test.beforeEach(async ({ page }) => {
    await gotoScenario(page, 'guest');
    await expect(page.locator('#moreBtn')).toBeVisible();
  });

  test('open → X closes', async ({ page }) => {
    await page.locator('#moreBtn').click();
    await expectSheetOpen(page);
    await page.locator('.more-sheet-close').click();
    await expectSheetClosed(page);
  });

  test('open → tapping an item navigates AND closes', async ({ page }) => {
    await page.locator('#moreBtn').click();
    await expectSheetOpen(page);
    await page.locator('.more-sheet-item[data-nav-tab="timer"]').click();
    await expect(page.locator('#timer.panel.active')).toBeVisible();
    await expectSheetClosed(page);
  });

  test('open → Escape closes', async ({ page }) => {
    await page.locator('#moreBtn').click();
    await expectSheetOpen(page);
    await page.keyboard.press('Escape');
    await expectSheetClosed(page);
  });

  test('B2: Report item lives in the sheet and the floating fab is hidden at phone width', async ({ page }) => {
    // The bottom-left Report fab overlapped the date header and stats row at
    // 390px — it collapses into the More sheet on <768px.
    await expect(page.locator('#fluxReportFab')).toBeHidden();
    await page.locator('#moreBtn').click();
    await expectSheetOpen(page);
    await expect(page.locator('.more-sheet-item[data-action="report"]')).toBeVisible();
    await page.keyboard.press('Escape');
    await expectSheetClosed(page);
  });

  test('B2: pomo pill docks into the top bar and clears the bottom nav', async ({ page }) => {
    const geom = await page.evaluate(() => {
      const pill = document.getElementById('fluxPomoPill')!;
      pill.hidden = false;
      (pill as HTMLElement).style.display = 'flex';
      const r = pill.getBoundingClientRect();
      const bnav = document.querySelector('.bottom-nav')?.getBoundingClientRect();
      const topbar = document.querySelector('.topbar')?.getBoundingClientRect();
      return {
        inTopbar: !!topbar && r.top >= topbar.top && r.bottom <= topbar.bottom + 6,
        clearsBnav: !bnav || r.bottom < bnav.top,
      };
    });
    expect(geom.inTopbar).toBe(true);
    expect(geom.clearsBnav).toBe(true);
  });

  test('open → overlay tap closes', async ({ page }) => {
    await page.locator('#moreBtn').click();
    await expectSheetOpen(page);
    // Tap well above the sheet so the hit lands on the overlay.
    await page.locator('#moreSheetOverlay').click({ position: { x: 20, y: 40 } });
    await expectSheetClosed(page);
  });

  test('Escape closes even when the sheet is wedged visible without .open', async ({ page }) => {
    await page.locator('#moreBtn').click();
    await expectSheetOpen(page);
    // Recreate the historical stuck state: inline transform pinning the sheet
    // on screen while the .open class is already gone.
    await page.evaluate(() => {
      const sh = document.getElementById('moreSheet')!;
      sh.classList.remove('open');
      sh.style.transform = 'translateY(0px)';
    });
    await page.keyboard.press('Escape');
    await expectSheetClosed(page);
  });

  test('rapid open/close ×10 never wedges', async ({ page }) => {
    for (let i = 0; i < 10; i++) {
      await page.locator('#moreBtn').click();
      // Close mid-animation to chase the wedge: wait only until the sheet
      // edge enters the viewport (spring still running), then Escape —
      // keyboard input has no actionability wait, unlike clicking the X.
      await page.waitForFunction(() => {
        const sh = document.getElementById('moreSheet');
        return !!sh && sh.getBoundingClientRect().top < window.innerHeight;
      });
      await page.keyboard.press('Escape');
    }
    await expectSheetClosed(page);
    // Still fully functional afterwards.
    await page.locator('#moreBtn').click();
    await expectSheetOpen(page);
    await page.locator('.more-sheet-item[data-nav-tab="school"]').click();
    await expect(page.locator('#school.panel.active')).toBeVisible();
    await expectSheetClosed(page);
  });
});
