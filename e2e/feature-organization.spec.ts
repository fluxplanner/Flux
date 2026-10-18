import { test, expect } from '@playwright/test';
import { gotoScenario, openSidebarTab } from './helpers';

/* Where the features merged in October 2026 are found: the Hub sorted into
   Planner / Study apps / Partner apps, a "More Flux apps" row in Study tools
   for the apps that open on their own page, and Reading log as a tab of its
   own under Learn. */

test.describe('feature organization', () => {
  test('the Hub is sorted into Planner, Study apps and Partner apps', async ({ page }) => {
    await page.goto('/hub.html');
    await expect(page.locator('#apps .apps-group')).toHaveText(['Planner', 'Study apps', 'Partner apps']);
    await expect(page.locator('#apps .app')).toHaveCount(9);
    const sections = await page.locator('#apps > *').evaluateAll((els) => {
      const out: Record<string, string[]> = {};
      let cur = '';
      els.forEach((el) => {
        if (el.classList.contains('apps-group')) { cur = el.textContent || ''; out[cur] = []; }
        else out[cur].push(el.getAttribute('href') || '');
      });
      return out;
    });
    expect(sections['Planner']).toEqual(['index.html']);
    expect(sections['Partner apps']).toEqual(['synara.html']);
    expect(sections['Study apps']).toEqual(expect.arrayContaining([
      'teacher.html', 'grapher.html', 'calculator.html', 'flashcards.html', 'pixel.html', 'periodic.html', 'composer.html',
    ]));
    // The descriptions name what shipped: 3D, maths figures, the Evo layout.
    await expect(page.locator('#apps a.app--grapher')).toContainText('3D');
    await expect(page.locator('#apps a.app--pixel')).toContainText('maths figures');
    await expect(page.locator('#apps a.app--calculator')).toContainText('Evo');
  });

  test('Study tools opens every study app from a row at the top', async ({ page }) => {
    await gotoScenario(page, 'student-semester');
    await openSidebarTab(page, 'toolbox');
    const shelf = page.getByRole('navigation', { name: 'More Flux apps' });
    await expect(shelf).toBeVisible();
    const links = shelf.locator('a.fsh-app');
    await expect(links).toHaveCount(7);
    const hrefs = await links.evaluateAll((as) => as.map((a) => a.getAttribute('href')));
    expect(hrefs).toEqual(['teacher.html', 'grapher.html', 'calculator.html', 'flashcards.html', 'pixel.html', 'periodic.html', 'composer.html']);
    await expect(links.first()).toHaveAttribute('target', '_blank');
    await expect(links.first()).toContainText('Tutor');
    // The partner app is not a study tool.
    await expect(shelf.locator('a[href="synara.html"]')).toHaveCount(0);
    // It must not push the page sideways on a phone.
    await page.setViewportSize({ width: 390, height: 844 });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });

  test('Reading log has its own tab under Learn', async ({ page }) => {
    await page.setViewportSize({ width: 1400, height: 950 });
    await gotoScenario(page, 'student-semester');
    const item = page.locator('#sidebar .nav-item[data-tab="readingLog"]');
    await expect(item).toHaveText('Reading log');
    await expect(item.locator('.ni svg')).toHaveCount(1);
    const group = await item.evaluate((el) => el.closest('.nav-group')?.querySelector('.nav-group-label')?.textContent);
    expect(group).toBe('Learn');
    await openSidebarTab(page, 'readingLog');
    await expect(page.locator('#frlRoot')).toBeVisible();
    await expect(item).toHaveClass(/active/);
  });

  test('on a phone, Reading log is in the More sheet', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await gotoScenario(page, 'student-semester');
    await page.locator('#moreBtn').click();
    const row = page.locator('.more-sheet-item[data-nav-tab="readingLog"]');
    await expect(row).toBeVisible();
    await expect(row.locator('.more-sheet-icon svg')).toHaveCount(1);
    await row.click();
    await expect(page.locator('#readingLog.panel.active')).toBeVisible();
  });
});
