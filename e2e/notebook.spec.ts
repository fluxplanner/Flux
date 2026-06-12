import { test, expect } from '@playwright/test';
import { gotoScenario } from './helpers';

test.describe('Flux Notebook', () => {
  test('opens from AI topbar, manages sources, viewer works', async ({ page }) => {
    await gotoScenario(page, 'student-semester');

    // clean slate
    await page.evaluate(() => {
      const N = (window as any).FluxNotebook;
      if (!N) return;
      (window as any).save?.('flux_notebook_sources', []);
    });

    await page.evaluate(() => (window as any).FluxNotebook.open());
    await expect(page.locator('#fnbOverlay')).toHaveCount(1);
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

    // generators demand at least one CHECKED source — uncheck and verify guard
    await page.locator('.fnb-src-chk').uncheck();
    const before = await page.locator('.fnb-msg').count();
    await page.click('.fnb-gen[data-gen="quiz"]');
    await page.waitForTimeout(300);
    expect(await page.locator('.fnb-msg').count()).toBe(before); // no quiz started

    // re-check, delete works
    await page.locator('.fnb-src-chk').check();
    await page.hover('.fnb-src');
    await page.click('.fnb-src-del');
    await expect(page.locator('.fnb-src')).toHaveCount(0);

    await page.screenshot({ path: 'test-results/notebook.png' });
    await page.keyboard.press('Escape');
    await expect(page.locator('#fnbOverlay')).toHaveCount(0);
  });

  test('wikipedia search tab renders and topbar button exists', async ({ page }) => {
    await gotoScenario(page, 'student-semester');
    await expect(page.locator('.ai-topbar-btn[aria-label="Open Flux Notebook"]')).toHaveCount(1);
    await page.evaluate(() => (window as any).FluxNotebook.open());
    await page.click('#fnbAddSrc');
    await expect(page.locator('.fnb-tab[data-t="search"]')).toHaveClass(/active/);
    await expect(page.locator('#fnbQ')).toBeVisible();
    await expect(page.locator('.fnb-tab[data-t="url"]')).toBeVisible();
    await expect(page.locator('.fnb-tab[data-t="kb"]')).toBeVisible();
  });
});
