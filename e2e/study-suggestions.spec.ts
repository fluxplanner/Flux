import { test, expect, type Page } from '@playwright/test';
import { gotoScenario } from './helpers';

/**
 * Classmates' suggestions, subject by subject: music theory that spells notes
 * properly, the Literature unit in English, the working pad on the formula
 * sheets, and the lab report in Science toolkit.
 */
async function openTool(page: Page, subject: string, tool: string, unit?: string) {
  await gotoScenario(page, 'student-semester');
  await page.evaluate(() => (window as any).nav('toolbox'));
  await page.waitForTimeout(600);
  await page.evaluate((s) => (window as any).fluxStudyHub.selectSubject(s), subject);
  if (unit) await page.locator(`#fshUnits .fsh-unit[data-unit="${unit}"]`).click();
  await page.locator(`#fshChemTabs [data-tool="${tool}"]`).click();
}

test.describe('Music theory', () => {
  test.beforeEach(async ({ page }) => { await page.setViewportSize({ width: 1280, height: 950 }); });

  test('the circle names enharmonic keys and switches to them', async ({ page }) => {
    await openTool(page, 'music', 'circle');
    await page.locator('[data-ring="major"][data-i="6"]').click();
    const info = page.locator('#cofInfo');
    await expect(info.locator('h3')).toHaveText('F♯ major');
    await expect(info).toContainText('6♯ · F♯ C♯ G♯ D♯ A♯ E♯');
    await info.locator('[data-act="alt"]').click();
    await expect(page.locator('#cofInfo h3')).toHaveText('G♭ major');
    await expect(page.locator('#cofInfo')).toContainText('G♭ A♭ B♭ C♭ D♭ E♭ F');
  });

  test('a minor key has its own numerals, and the same chord is renumbered', async ({ page }) => {
    await openTool(page, 'music', 'numerals');
    await page.locator('#numMode [data-mode="minor"]').click();
    await expect(page.locator('.fsh-out')).toContainText('A minor');
    const rows = await page.locator('.fsh-numtable--key tbody tr').evaluateAll((trs) => trs.map((tr) => tr.children[0].firstChild!.textContent!.trim() + ' ' + tr.children[1].textContent!.trim()));
    expect(rows).toEqual(['i Am', 'ii° B°', 'III C', 'iv Dm', 'v Em', 'VI F', 'VII G']);
    await expect(page.locator('.fsh-numcompare')).toContainText('C major and A minor share a key signature');
  });

  test('a theoretical key is written the way musicians write it', async ({ page }) => {
    await openTool(page, 'music', 'explorer');
    await page.locator('#scRoot').selectOption('A♯');
    await expect(page.locator('.fsh-out .big')).toHaveText('B♭ · C · D · E♭ · F · G · A');
    await expect(page.locator('.fsh-respelled')).toContainText('so it is written as B♭ major');
  });

  test('inversions name the bass and the figured bass', async ({ page }) => {
    await openTool(page, 'music', 'inversions');
    await page.locator('#invRoot').selectOption('G');
    await page.locator('#invType').selectOption('Dominant 7');
    await expect(page.locator('.fsh-inv-sym')).toHaveText(['G7', 'G7/B', 'G7/D', 'G7/F']);
    await expect(page.locator('.fsh-inv').nth(1)).toContainText('6/5');
    await expect(page.locator('.fsh-inv').nth(3)).toContainText('4/2');
  });
});

test.describe('English · Literature', () => {
  test('poetry terms, the commentary guide, graphic novel terms and the medium comparison', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 950 });
    await openTool(page, 'english', 'lit-poetry', 'literature');
    await page.locator('.fsh-gloss-q').fill('volta');
    await expect(page.locator('.fsh-gloss .fsh-formula')).toHaveCount(1);
    await expect(page.locator('.fsh-gloss')).toContainText('The "turn" in a sonnet');
    await page.locator('#fshChemTabs [data-tool="lit-commentary"]').click();
    await expect(page.locator('.fsh-steps li')).toHaveCount(8);
    await page.locator('[data-k="thesis"]').fill('The speaker presents power as fleeting.');
    await page.locator('#fshChemTabs [data-tool="lit-graphic"]').click();
    await expect(page.locator('.fsh-gloss')).toContainText('Gutter');
    await page.locator('#fshChemTabs [data-tool="lit-mediums"]').click();
    await expect(page.locator('.fsh-mediums')).toContainText('mise-en-scène');
    // The commentary plan survives switching tools.
    await page.locator('#fshChemTabs [data-tool="lit-commentary"]').click();
    await expect(page.locator('[data-k="thesis"]')).toHaveValue('The speaker presents power as fleeting.');
  });
});

test.describe('Formula sheet · your working', () => {
  test('add a formula, plug in values, and the working writes itself', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 950 });
    await openTool(page, 'physics', 'formula-sheet', 'formula-sheet');
    await page.locator('.ffs-item[data-f="v = u + at"] .ffs-add').click();
    await page.locator('.ffw-line').first().locator('[data-ffw="plug"]').click();
    await page.locator('.ffw-val[data-sym="u"]').fill('3.0');
    await page.locator('.ffw-val[data-sym="a"]').fill('9.81');
    await page.locator('.ffw-val[data-sym="t"]').fill('2.0');
    await page.locator('[data-ffw="write"]').click();
    await expect.poll(() => page.locator('.ffw-in').evaluateAll((els) => els.map((e) => (e as HTMLInputElement).value)))
      .toEqual(['v = u + at', 'v = 3.0 + (9.81)(2.0)', 'v = 22.6']);
    // Dragging works too.
    await page.locator('.ffs-item[data-f="KE = ½mv²"]').dragTo(page.locator('.ffw'));
    await expect(page.locator('.ffw-line')).toHaveCount(4);
    // It is still there after leaving and coming back.
    await page.locator('#fshUnits .fsh-unit[data-unit="mechanics"]').click();
    await page.locator('#fshUnits .fsh-unit[data-unit="formula-sheet"]').click();
    await expect(page.locator('.ffw-line')).toHaveCount(4);
  });
});

test.describe('Science toolkit · Lab report', () => {
  test('structure, a saved plan, and uncertainty working', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openTool(page, 'labgraph', 'lab-report');
    await expect(page.locator('.fsh-lab-sec')).toHaveCount(11);
    await page.locator('#labTabs [data-tab="unc"]').click();
    await page.locator('[data-c="A"]').fill('2.0');
    await page.locator('[data-c="dA"]').fill('0.1');
    await page.locator('[data-c="B"]').fill('3.0');
    await page.locator('[data-c="dB"]').fill('0.3');
    await expect(page.locator('#labOut .big')).toHaveText('6.0 ± 0.9');
    await page.locator('#labTabs [data-tab="plan"]').click();
    await page.locator('[data-k="rq"]').fill('How does length affect period?');
    await page.locator('#labTabs [data-tab="criteria"]').click();
    await page.locator('#labTabs [data-tab="plan"]').click();
    await expect(page.locator('[data-k="rq"]')).toHaveValue('How does length affect period?');
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);
  });
});

test.describe('Measurements grapher', () => {
  test('fits can be weighted by the error bars', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/grapher.html');
    await page.evaluate(() => (window as any).fluxGrapherPage.show('data'));
    await page.locator('[data-addcol]').first().click();
    await page.getByText('Uncertainty (±) column').click();
    await page.evaluate(() => {
      const g = (window as any).fluxGrapherPage.instance;
      const t = g.doc.items.find((i: any) => i.type === 'table');
      t.rows = [['0', '0', '0.1'], ['1', '1', '0.1'], ['2', '2', '0.1'], ['3', '5', '2']];
      g.render ? g.render() : g.draw();
    });
    await expect(page.locator('.flg-rc')).toContainText('m1.60 ± 0.35');
    await page.locator('[data-weighted]').first().click();
    await expect(page.locator('.flg-rc')).toContainText('Straight line (weighted)');
    await expect(page.locator('.flg-rc')).toContainText('m1.005 ± 0.071');
    await expect(page.locator('.flg-rc')).toContainText('χ²/ν');
  });

  test('fitting to the data with equal scales keeps every reading in view', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/grapher.html');
    await page.evaluate(() => (window as any).fluxGrapherPage.show('data'));
    const v = await page.evaluate(async () => {
      const g = (window as any).fluxGrapherPage.instance;
      const t = g.doc.items.find((i: any) => i.type === 'table');
      t.rows = [['1', '12'], ['2', '25'], ['3', '36'], ['4', '51'], ['5', '62']];
      g.doc.win.square = true;
      g.doc.win.auto = true;
      g.viewChanged();
      await new Promise((r) => setTimeout(r, 300));
      return g._last.v;
    });
    expect(v.yLo).toBeLessThanOrEqual(12);
    expect(v.yHi).toBeGreaterThanOrEqual(62);
    expect(v.xLo).toBeLessThanOrEqual(1);
    expect(v.xHi).toBeGreaterThanOrEqual(5);
  });
});
