import { test, expect } from '@playwright/test';
import { gotoScenario } from './helpers';

test.describe('Flux Notebook', () => {
  test('manages sources, viewer works (overlay API)', async ({ page }) => {
    await gotoScenario(page, 'student-semester');

    // clean slate
    await page.evaluate(() => { (window as any).save?.('flux_notebook_sources', []); });

    await page.evaluate(() => (window as any).FluxNotebook.open());
    await expect(page.locator('#fnbOverlay')).toHaveCount(1);
    // Sources live under the Sources view tab (default view is Chat).
    await page.click('#fnbOverlay .fnb-viewtab[data-view="sources"]');
    await expect(page.locator('.fnb-empty')).toContainText('No sources yet');

    // add a source through the paste tab
    await page.click('#fnbAddSrc');
    await page.click('.fnb-tab[data-t="paste"]');
    await page.fill('#fnbPT', 'Cell respiration notes');
    await page.fill('#fnbPC', 'Glycolysis happens in the cytoplasm and produces 2 ATP. The Krebs cycle runs in the mitochondrial matrix.');
    await page.click('#fnbPGo');
    await expect(page.locator('.fnb-src')).toHaveCount(1);
    await expect(page.locator('.fnb-src-title')).toContainText('Cell respiration');

    // source viewer opens with content
    await page.click('.fnb-src-open');
    await expect(page.locator('.fnb-viewer-body')).toContainText('Glycolysis');
    await page.click('#fnbModalClose');

    // generators need a CHECKED source — uncheck and verify the guard
    await page.locator('.fnb-src-chk').uncheck();
    await page.click('#fnbOverlay .fnb-viewtab[data-view="studio"]');
    const before = await page.locator('.fnb-msg').count();
    await page.click('.fnb-gen[data-gen="quiz"]');
    await page.waitForTimeout(300);
    expect(await page.locator('.fnb-msg').count()).toBe(before); // no quiz started

    // re-check, delete works
    await page.click('#fnbOverlay .fnb-viewtab[data-view="sources"]');
    await page.locator('.fnb-src-chk').check();
    await page.hover('.fnb-src');
    await page.click('.fnb-src-del');
    await expect(page.locator('.fnb-src')).toHaveCount(0);

    await page.keyboard.press('Escape');
    await expect(page.locator('#fnbOverlay')).toHaveCount(0);
  });

  /* Was 'opens as its own sidebar tab; add-source tabs render'. The Notebook
     tab is paused — FLUX_NOTEBOOK_ENABLED in app.js — because NotebookLM does
     the job better. The module itself is untouched, which the overlay test
     above still proves; what changed is that nothing in the UI leads to it.
     Inverted rather than deleted, so un-pausing has a test to answer to. */
  test('is paused: no sidebar tab, and its panels are unreachable', async ({ page }) => {
    await gotoScenario(page, 'student-semester');

    // Gone from the sidebar, and from the Settings tab customiser with it, so
    // nobody can switch a paused feature back on from the UI.
    await expect(page.locator('#sidebar .nav-item[data-tab="notes"]')).toHaveCount(0);
    await expect(page.locator('#sidebar .nav-item[data-tab="notebook"]')).toHaveCount(0);
    await expect(page.locator('.ai-topbar-btn[aria-label="Open Flux Notebook"]')).toHaveCount(0);

    // Old deep links and a saved last-tab must land somewhere real rather than
    // on a blank panel with no way back.
    for (const target of ['notebook', 'notes']) {
      await page.evaluate((t) => (window as any).nav?.(t), target);
      await page.waitForTimeout(400);
      await expect(page.locator('#dashboard.panel.active')).toBeVisible();
    }
  });
});
