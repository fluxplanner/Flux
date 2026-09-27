import { test, expect } from '@playwright/test';

/**
 * The Flux Periodic Table on its own page (periodic.html). The chemistry is
 * covered in test/unit/ptable-chem.test.mjs; these check the page a student
 * uses: the link to an element, the tabs of its panel, colouring the table,
 * the tools lighting the table up, and the quiz taking over clicks.
 */

test.describe('Periodic table page', () => {
  test('a link opens an element, and its panel shows the numbers', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 950 });
    await page.goto('/periodic.html#Na');
    const side = page.locator('.fpt-side');
    await expect(side.locator('h2')).toHaveText('Sodium');
    await expect(page.locator('.fpt-el[data-n="11"]')).toHaveClass(/is-sel/);

    await side.locator('.fpt-dtab[data-tab="energy"]').click();
    await expect(side).toContainText('496 kJ/mol');
    // The jump after the first electron puts sodium in group 1.
    await expect(side).toContainText('puts it in group 1');

    await side.locator('.fpt-dtab[data-tab="isotopes"]').click();
    await expect(side).toContainText('23');

    // Arrow keys walk the table and keep the panel in step.
    await page.locator('.fpt-el[data-n="11"]').focus();
    await page.keyboard.press('ArrowRight');
    await expect(side.locator('h2')).toHaveText('Magnesium');
    await expect(page).toHaveURL(/#Mg$/);
  });

  test('colouring by a property writes the values and the trend', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 950 });
    await page.goto('/periodic.html');
    await page.locator('.fpt-sel').selectOption('ie');
    await expect(page.locator('.fpt-el[data-n="2"] .fpt-v')).toHaveText('2372');    // helium, highest
    await expect(page.locator('.fpt-legend')).toContainText(/Across a period/);
    await page.locator('.fpt-sel').selectOption('state');
    await page.locator('.fpt-chip[data-k="373.15"]').click();                        // water boils
    await expect(page.locator('.fpt-el[data-n="35"] .fpt-v')).toHaveText('Gas');   // bromine boils at 59 °C
    await expect(page.locator('.fpt-el[data-n="80"] .fpt-v')).toHaveText('Liquid'); // mercury does not
  });

  test('tools light up the table, and clicking the table types into them', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 950 });
    await page.goto('/periodic.html#tools/molar');
    const inp = page.locator('.fpt-main-in');
    await inp.fill('CaCO3');
    await expect(page.locator('.fpt-out .fpt-big')).toContainText('100.09');
    await expect(page.locator('.fpt-el[data-n="20"]')).toHaveClass(/is-hl/);
    await expect(page.locator('.fpt-el[data-n="11"]')).toHaveClass(/is-dim/);

    await page.locator('.fpt-tbtn[data-tool="balance"]').click();
    await page.locator('.fpt-main-in').fill('Al + O2 -> Al2O3');
    await expect(page.locator('.fpt-eq')).toHaveText('4Al + 3O₂ → 2Al₂O₃');
  });

  test('the quiz takes over clicks on the table', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 950 });
    await page.goto('/periodic.html#quiz');
    const target = await page.evaluate(() => (window as any).FluxPTableQuiz._q.target);
    await page.locator(`.fpt-el[data-n="${target}"]`).click();
    await expect(page.locator('.fpt-qfb')).toContainText('✓');
    // Leaving the quiz gives clicks back to the table.
    await page.locator('.fpt-view[data-view="table"]').click();
    await page.locator('.fpt-el[data-n="8"]').click();
    await expect(page.locator('.fpt-side h2')).toHaveText('Oxygen');
  });

  test('fits a phone without the page scrolling sideways', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/periodic.html#Fe');
    await expect(page.locator('.fpt-side h2')).toHaveText('Iron');
    const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(over, 'the page is wider than the phone').toBeLessThanOrEqual(0);
  });
});
