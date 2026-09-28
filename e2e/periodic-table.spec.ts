import { test, expect } from '@playwright/test';

/**
 * The Flux Periodic Table on its own page (periodic.html). The chemistry is
 * covered in test/unit/ptable-chem.test.mjs; these check the page a student
 * uses: the tabs along the top — the plain table and what an element says
 * when clicked, the trends and their graph, the temperature, and the tabs
 * that go deeper into one element (electrons, spectra, isotopes, 3D).
 */

test.describe('Periodic table page', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 950 });
  });

  test('the tabs, in order, and the Table tab is just the table', async ({ page }) => {
    await page.goto('/periodic.html');
    await expect(page.locator('.fpt-view')).toHaveText(['Table', 'Trends', 'Temperature', 'Electrons', 'Spectra', 'Isotopes', '3D']);
    await expect(page.locator('.fpt-view[data-view="table"]')).toHaveAttribute('aria-selected', 'true');
    // No trend picker and no graph: those are the Trends tab's.
    await expect(page.locator('.fpt-sel')).toBeHidden();
    await expect(page.locator('.fpt-chart')).toBeHidden();
    await expect(page.locator('.fpt-legend')).toContainText('Alkali metals');
    await page.locator('.fpt-legend [data-act="tcolour"][data-c="block"]').click();
    await expect(page.locator('.fpt-legend')).toContainText('d-block');
  });

  test('a link opens an element, and its panel shows the numbers', async ({ page }) => {
    await page.goto('/periodic.html#Na');
    const side = page.locator('.fpt-side');
    await expect(side.locator('h2')).toHaveText('Sodium');
    await expect(page.locator('.fpt-el[data-n="11"]')).toHaveClass(/is-sel/);
    await expect(side).toContainText('[Ne] 3s¹');
    await expect(side.locator('.fpt-bohr svg')).toBeVisible();

    await side.locator('.fpt-dtab[data-tab="energy"]').click();
    await expect(side).toContainText('496 kJ/mol');
    // The jump after the first electron puts sodium in group 1.
    await expect(side).toContainText('puts it in group 1');

    // Arrow keys walk the table and keep the panel in step.
    await page.locator('.fpt-el[data-n="11"]').focus();
    await page.keyboard.press('ArrowRight');
    await expect(side.locator('h2')).toHaveText('Magnesium');
    await expect(page).toHaveURL(/#Mg$/);

    // The panel leads on to the deeper tabs, keeping the element.
    await side.locator('.fpt-more [data-view="isotopes"]').click();
    await expect(page.locator('.fpt-view[data-view="isotopes"]')).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('.fpx-head h2')).toHaveText('Magnesium');
    await expect(page).toHaveURL(/#isotopes\/Mg$/);
  });

  test('colouring by a property writes the values and the trend', async ({ page }) => {
    await page.goto('/periodic.html');
    await page.locator('.fpt-view[data-view="trends"]').click();
    await page.locator('.fpt-sel').selectOption('ie');
    await expect(page.locator('.fpt-el[data-n="2"] .fpt-v')).toHaveText('2372');    // helium, highest
    await expect(page.locator('.fpt-legend')).toContainText(/Across a period/);
    await page.locator('.fpt-view[data-view="temp"]').click();
    await page.locator('.fpt-chip[data-k="373.15"]').click();                        // water boils
    await expect(page.locator('.fpt-el[data-n="35"] .fpt-v')).toHaveText('Gas');   // bromine boils at 59 °C
    await expect(page.locator('.fpt-el[data-n="80"] .fpt-v')).toHaveText('Liquid'); // mercury does not
    await expect(page.locator('.fpt-events')).toContainText('Next');
  });

  test('every trend has its scale, its direction and a graph against atomic number', async ({ page }) => {
    await page.goto('/periodic.html#trend/ie');
    const ids = await page.locator('.fpt-sel option').evaluateAll((os) => os.map((o) => (o as HTMLOptionElement).value));
    for (const id of ['rc', 'rv', 're', 'vol', 'z', 'zeff', 'shield', 'core', 'unpaired', 'ie', 'ie2', 'ie3', 'ea', 'en', 'enA', 'metal', 'mass', 'neutrons', 'd', 'mp', 'bp', 'liq']) {
      expect(ids, `no "${id}" trend`).toContain(id);
    }
    // Categories, blocks and states have tabs of their own, not a place in the list.
    for (const id of ['cat', 'block', 'state']) expect(ids).not.toContain(id);
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
    // The Table tab has no graph.
    await page.locator('.fpt-view[data-view="table"]').click();
    await expect(chart).toBeHidden();
  });

  test('a trend link opens with that trend', async ({ page }) => {
    await page.goto('/periodic.html#trend/rc/Cl');
    await expect(page.locator('.fpt-sel')).toHaveValue('rc');
    await expect(page.locator('.fpt-side h2')).toHaveText('Chlorine');
    await expect(page.locator('.fpt-el[data-n="17"] .fpt-v')).toHaveText('102');
  });

  test('Electrons: chromium breaks the Aufbau order, and iron loses 4s first', async ({ page }) => {
    await page.goto('/periodic.html#electrons/Cr');
    const x = page.locator('.fpt-explore');
    await expect(x.locator('.fpx-head h2')).toHaveText('Chromium');
    await expect(x.locator('.fpx-warn')).toContainText('[Ar] 3d⁴ 4s²');
    await expect(x.locator('.fpx-warn')).toContainText('[Ar] 3d⁵ 4s¹');
    await expect(x).toContainText('6 — paramagnetic');
    // Pick iron on the small table, then its 3+ ion.
    await page.locator('.fpt-el[data-n="26"]').click();
    await expect(page).toHaveURL(/#electrons\/Fe$/);
    await x.locator('[data-act="xion"][data-q="3"]').click();
    await expect(x.locator('.fpt-config-t')).toHaveText('[Ar] 3d⁵');
    await expect(x.locator('.fpx-note')).toContainText('2 from 4s and 1 from 3d');
  });

  test('Spectra: hydrogen\'s lines, worked out from its energy levels', async ({ page }) => {
    await page.goto('/periodic.html#spectra/H');
    const x = page.locator('.fpt-explore');
    await expect(x.locator('.fpt-spec').first()).toBeVisible();
    // Balmer, n = 3 → 2: the red line.
    await expect(x.locator('.fpx-result')).toContainText('656.5 nm');
    await expect(x.locator('.fpx-result')).toContainText('182 kJ/mol');
    // Lyman's convergence limit is hydrogen's ionization energy.
    await x.locator('[data-act="hseries"][data-lo="1"]').click();
    await x.locator('.fpx-uppers [data-hi="inf"]').click();
    await expect(x.locator('.fpx-result')).toContainText('91.2 nm');
    await expect(x).toContainText('1312 kJ/mol');
  });

  test('Isotopes: chlorine\'s mass spectrum, its Ar, and Cl₂', async ({ page }) => {
    await page.goto('/periodic.html#isotopes/Cl');
    const x = page.locator('.fpt-explore');
    await expect(x.locator('.fpx-bar[data-mz="35"]').first()).toBeVisible();
    await expect(x.locator('.fpx-bar[data-mz="37"]').first()).toBeVisible();
    await expect(x.locator('.fpt-work')).toContainText('35.453');
    for (const mz of ['70', '72', '74']) await expect(x.locator('.fpx-bar[data-mz="' + mz + '"]')).toHaveCount(1);
    await expect(x).toContainText('9 : 6 : 1');
  });

  test('3D: any element, turned round, and its orbitals', async ({ page }) => {
    await page.goto('/periodic.html#3d/Fe');
    const x = page.locator('.fpt-explore');
    await expect(x.locator('.fpx-key')).toContainText('26 protons + 30 neutrons');
    await expect(x.locator('.fpx-key [data-hl]:not([data-hl="nuc"])')).toHaveCount(4);    // shells 2, 8, 14, 2
    // Something is drawn on the canvas.
    const painted = () => page.evaluate(() => {
      const c = document.querySelector('.fpx-canvas') as HTMLCanvasElement;
      const d = c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data;
      let n = 0;
      for (let i = 3; i < d.length; i += 4 * 17) if (d[i] > 0) n++;
      return n;
    });
    await expect.poll(painted).toBeGreaterThan(200);
    // Click carbon on the small table: the model rebuilds.
    await page.locator('.fpt-el[data-n="6"]').click();
    await expect(x.locator('.fpx-head h2')).toHaveText('Carbon');
    await expect(x.locator('.fpx-key')).toContainText('Shell n = 2 · 4 electrons');
    // Dragging turns it without breaking anything.
    const box = (await x.locator('.fpx-canvas').boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 120, box.y + box.height / 2 + 40, { steps: 5 });
    await page.mouse.up();
    // The orbitals: carbon's 2p has two electrons in two of its three orbitals.
    await x.locator('[data-act="a3mode"][data-mode="orbitals"]').first().click();
    await expect(x.locator('.fpx-subs [data-orb="2p"]')).toHaveClass(/is-on/);
    await expect(x.locator('.fpx-krow')).toHaveText([/1 electron/, /1 electron/, /empty/]);
  });

  test('switching tabs slides one highlight to the tab chosen, and the page in after it', async ({ page }) => {
    await page.goto('/periodic.html');
    const glide = () => page.evaluate(() => {
      const g = document.querySelector('.fpt-views-glide')!.getBoundingClientRect();
      const on = document.querySelector('.fpt-view.is-on')!.getBoundingClientRect();
      return { dx: Math.abs(g.left - on.left), dw: Math.abs(g.width - on.width), sliding: document.querySelector('.fpt-body')!.getAnimations().length };
    });
    await expect.poll(async () => (await glide()).dx).toBeLessThan(1);
    await page.locator('.fpt-view[data-view="isotopes"]').click();
    // The page comes in with an animation, and the highlight is on its way.
    const t0 = await glide();
    expect(t0.sliding, 'the page did not slide in').toBeGreaterThan(0);
    expect(t0.dx, 'the highlight jumped instead of sliding').toBeGreaterThan(20);
    // And it arrives, exactly under the tab.
    await expect.poll(async () => { const g = await glide(); return g.dx + g.dw; }).toBeLessThan(1);
  });

  test('with reduced motion, tabs switch without moving', async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 950 }, reducedMotion: 'reduce' });
    const page = await ctx.newPage();
    await page.goto('/periodic.html');
    await page.locator('.fpt-view[data-view="spectra"]').click();
    const r = await page.evaluate(() => ({
      anims: document.querySelector('.fpt-body')!.getAnimations().length,
      dx: Math.abs(document.querySelector('.fpt-views-glide')!.getBoundingClientRect().left - document.querySelector('.fpt-view.is-on')!.getBoundingClientRect().left),
    }));
    expect(r.anims).toBe(0);
    expect(r.dx).toBeLessThan(1);
    await ctx.close();
  });

  test('fits a phone without the page scrolling sideways', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    for (const hash of ['#Fe', '#3d/C', '#spectra/H']) {
      await page.goto('/periodic.html' + hash);
      await page.waitForTimeout(300);
      const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(over, `${hash}: the page is wider than the phone`).toBeLessThanOrEqual(0);
    }
  });

  test('switching Overview and Energy leaves the page where it is', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/periodic.html#Fe');
    // Safari focuses the nearest focusable box when a button is tapped; the
    // whole table being one is what scrolled the page back up.
    expect(await page.locator('.fpt').getAttribute('tabindex')).toBeNull();
    const tabs = page.locator('.fpt-dtabs');
    // Scrolled down, with the tabs in the middle of the screen.
    await tabs.evaluate((el) => window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - 300));
    const before = await tabs.evaluate((el) => el.getBoundingClientRect().top);
    expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(100);
    await page.locator('.fpt-dtab[data-tab="energy"]').click();
    await expect(page.locator('.fpt-dtab[data-tab="energy"]')).toHaveClass(/is-on/);
    expect(Math.abs((await tabs.evaluate((el) => el.getBoundingClientRect().top)) - before)).toBeLessThan(2);
    await page.locator('.fpt-dtab[data-tab="overview"]').click();
    expect(Math.abs((await tabs.evaluate((el) => el.getBoundingClientRect().top)) - before)).toBeLessThan(2);
  });

  test('printing: colour or black and white, a key, the Flux mark, and no name cut short', async ({ page }) => {
    await page.goto('/periodic.html');
    await page.locator('#ptPrint').click();
    const menu = page.locator('#ptPrintMenu');
    await expect(menu).toBeVisible();
    await menu.locator('[data-ink="bw"]').click();
    await expect(page.locator('#ptPrintKey'), 'black and white has no colours for a key to name').toBeDisabled();
    await menu.locator('[data-ink="colour"]').click();
    await page.locator('#ptPrintKey').check();
    expect(JSON.parse((await page.evaluate(() => localStorage.getItem('flux_ptable_print')))!)).toEqual({ ink: 'colour', key: true });
    await page.keyboard.press('Escape');
    await expect(menu).toBeHidden();

    // What the Print button prepares, then the page as the printer lays it out.
    await page.evaluate(() => (window as any).fluxPeriodicPage.instance.setPrint({ ink: 'colour', key: true }));
    await page.emulateMedia({ media: 'print' });
    for (const size of [{ width: 979, height: 739 }, { width: 717, height: 1045 }]) {
      await page.setViewportSize(size);
      await expect(page.locator('.print-mark')).toBeVisible();
      await expect(page.locator('.fpt-printkey')).toBeVisible();
      await expect(page.locator('.fpt-printkey')).toContainText('Alkali metals');
      await expect(page.locator('.fpt-printkey')).toContainText('Noble gases');
      const cut = await page.evaluate(() => [...document.querySelectorAll('.fpt-el')].filter((el) => {
        const r = el.querySelector('.fpt-nm')!.getBoundingClientRect(), c = el.getBoundingClientRect();
        return r.left < c.left || r.right > c.right;
      }).map((el) => el.getAttribute('aria-label')));
      expect(cut, `${size.width}px page: names running out of their cells`).toEqual([]);
    }
    // Colour fills the cells; black and white leaves them white with no strip.
    const fill = () => page.locator('.fpt-el[data-n="26"]').evaluate((el) => getComputedStyle(el).backgroundColor);
    // Polled: the cells fade between colours.
    await expect.poll(fill).not.toBe('rgb(255, 255, 255)');
    await page.evaluate(() => (window as any).fluxPeriodicPage.instance.setPrint({ ink: 'bw', key: true }));
    await expect.poll(fill).toBe('rgb(255, 255, 255)');
    await expect(page.locator('.fpt-printkey'), 'no key in black and white').toBeHidden();
  });
});
