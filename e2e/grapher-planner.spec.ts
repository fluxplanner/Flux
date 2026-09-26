import { test, expect } from '@playwright/test';
import { gotoScenario } from './helpers';

/**
 * The grapher inside the planner. Its two halves live in two places now:
 * Maths → Grapher is the Functions grapher, and Science → Lab graphs is the
 * Measurements grapher, each without the switch between them.
 *
 * Same engine as grapher.html, but it lives among 150-odd planner stylesheets,
 * one of which forces padding, margins and font size onto every text field
 * with !important. That turned each table cell into a 40px form box. These
 * pin the cells at spreadsheet size, and that the planner's copy keeps its
 * working state the way the other study tools do.
 */

async function openStudy(page: import('@playwright/test').Page, subject: 'math' | 'labgraph') {
  await page.setViewportSize({ width: 1440, height: 950 });
  await gotoScenario(page, 'student-semester');
  await page.evaluate(() => (window as any).nav('toolbox'));
  await page.waitForTimeout(600);
  await page.evaluate((s) => (window as any).fluxStudyHub.selectSubject(s), subject);
  await page.locator(`#fshChemTabs [data-tool="${subject === 'math' ? 'graph' : 'lab'}"]`).click();
  await expect(page.locator('.flg-shell--planner')).toBeVisible();
}

test.describe('Grapher in the planner', () => {
  test('Maths holds the Functions grapher and Lab graphs the Measurements one, with no switch', async ({ page }) => {
    await openStudy(page, 'math');
    await expect(page.locator('.flg-shell--planner [data-pmode]')).toHaveCount(0);
    await expect(page.locator('.flg-ptitle')).toContainText('Functions');
    await expect(page.locator('.flg--planner.flg--functions .flg-expr').first()).toBeVisible();
    // Drawn on the next frame, so poll rather than count once.
    await expect.poll(() => page.locator('.flg--planner .flg-plot polyline').count()).toBeGreaterThan(0);

    await page.evaluate(() => (window as any).fluxStudyHub.selectSubject('labgraph'));
    await page.locator('#fshChemTabs [data-tool="lab"]').click();
    await expect(page.locator('.flg-ptitle')).toContainText('Measurements');
    await expect(page.locator('.flg--planner.flg--data .flg-table')).toBeVisible();
    const h = await page.locator('.flg-cell').first().evaluate((el) => (el as HTMLElement).offsetHeight);
    expect(h, `a cell is ${h}px tall — the planner's !important input rule is winning`).toBeLessThan(36);
  });

  test('Lab graphs is a science subject in its own right', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 950 });
    await gotoScenario(page, 'student-semester');
    await page.evaluate(() => (window as any).nav('toolbox'));
    await page.locator('#fshGroups .fsh-group[data-group="science"]').click();
    await expect(page.locator('#fshRail .fsh-pill[data-sub="labgraph"]')).toContainText('Lab graphs');
  });

  test('the grapher\'s own buttons are not painted like planner buttons', async ({ page }) => {
    await openStudy(page, 'labgraph');
    const bg = (sel: string) => page.locator(sel).first().evaluate((e) => getComputedStyle(e).backgroundImage);
    expect(await bg('.flg--planner [data-hist="undo"]'), 'undo is a plain icon button').toBe('none');
    expect(await bg('.flg--planner [data-tool="in"]'), 'zoom is a plain icon button').not.toContain('gradient');
  });

  test('the planner keeps its working graph, like every other study tool', async ({ page }) => {
    await openStudy(page, 'labgraph');
    const t = page.locator('.flg--planner .flg-item--table').first();
    await t.locator('[data-cell="0:0"]').fill('4');
    await t.locator('[data-cell="0:1"]').fill('9');
    await page.waitForTimeout(700);
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('flux_lab_graph') || 'null'));
    expect(stored?.items?.[0]?.rows?.[0]?.slice(0, 2)).toEqual(['4', '9']);

    // Leave and come back: the reading is still there.
    await page.evaluate(() => (window as any).fluxStudyHub.selectSubject('math'));
    await page.evaluate(() => (window as any).fluxStudyHub.selectSubject('labgraph'));
    await page.locator('#fshChemTabs [data-tool="lab"]').click();
    await expect(page.locator('.flg--planner [data-cell="0:1"]').first()).toHaveValue('9');
  });
});
