import { test, expect } from '@playwright/test';

/**
 * The Flux Periodic Table on its own page (periodic.html). The chemistry is
 * covered in test/unit/ptable-chem.test.mjs; these check the page a student
 * uses: the link to an element, the tabs of its panel, colouring the table
 * by each trend, and the graph of a trend against atomic number.
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

  test('every trend has its scale, its direction and a graph against atomic number', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 950 });
    await page.goto('/periodic.html');
    // No tools and no quiz: the table and its trends are the whole app.
    await expect(page.locator('.fpt-view')).toHaveCount(0);
    const ids = await page.locator('.fpt-sel option').evaluateAll((os) => os.map((o) => (o as HTMLOptionElement).value));
    for (const id of ['rc', 'rv', 're', 'vol', 'z', 'zeff', 'shield', 'core', 'unpaired', 'ie', 'ie2', 'ie3', 'ea', 'en', 'enA', 'metal', 'mass', 'neutrons', 'd', 'mp', 'bp', 'liq']) {
      expect(ids, `no "${id}" trend`).toContain(id);
    }
    await page.locator('.fpt-sel').selectOption('shield');
    await expect(page.locator('.fpt-el[data-n="11"] .fpt-v')).toHaveText('8.80');      // sodium: σ = 11 − 2.20
    await expect(page.locator('.fpt-legend')).toContainText(/Down a group/);
    const chart = page.locator('.fpt-chart');
    await expect(chart).toBeVisible();
    await expect(chart.locator('.fpt-pt')).toHaveCount(118);
    // A point on the graph opens its element.
    await chart.locator('.fpt-pt[data-n="26"]').click();
    await expect(page.locator('.fpt-side h2')).toHaveText('Iron');
    await expect(page).toHaveURL(/#trend\/shield\/Fe$/);

    // Metallic character runs the scale the other way: caesium is brightest.
    await page.locator('.fpt-sel').selectOption('metal');
    await expect(page.locator('.fpt-legend')).toContainText('most metallic');
    // Categories have no graph.
    await page.locator('.fpt-sel').selectOption('cat');
    await expect(chart).toBeHidden();
  });

  test('a trend link opens with that trend', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 950 });
    await page.goto('/periodic.html#trend/rc/Cl');
    await expect(page.locator('.fpt-sel')).toHaveValue('rc');
    await expect(page.locator('.fpt-side h2')).toHaveText('Chlorine');
    await expect(page.locator('.fpt-el[data-n="17"] .fpt-v')).toHaveText('102');
  });

  test('fits a phone without the page scrolling sideways', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/periodic.html#Fe');
    await expect(page.locator('.fpt-side h2')).toHaveText('Iron');
    const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(over, 'the page is wider than the phone').toBeLessThanOrEqual(0);
  });
});
