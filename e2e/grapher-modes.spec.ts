import { test, expect, type Page } from '@playwright/test';

/**
 * The Flux Grapher: its two halves, the chrome that is meant to be gone, and
 * the features that make it a grapher rather than a chart.
 *
 * Functions is the Desmos half — equations, sliders, and the zeros, turning
 * points and crossings of a selected curve. Measurements is the lab half —
 * tables whose uncertainty columns belong to a value column, error bars, a
 * fit with its uncertainty. Both have an adjustable window.
 *
 * Nothing on grapher.html needs an account. Saving is the one exception, and
 * it is tested against a stubbed Supabase so no real account is touched.
 */

async function open(page: Page, opts: { mode?: 'functions' | 'data'; tour?: boolean } = {}) {
  await page.addInitScript(({ mode, tour }) => {
    try {
      if (!tour) localStorage.setItem('flux_grapher_tour', 'done');
      if (mode) localStorage.setItem('flux_grapher_mode', mode);
    } catch (e) {}
  }, { mode: opts.mode, tour: !!opts.tour });
  await page.goto('/grapher.html');
  await page.waitForTimeout(700);
}

/** A cell in the first table, by row and column index. */
function cell(page: Page, r: number, c: number) {
  return page.locator('.flg-item--table').first().locator(`[data-cell="${r}:${c}"]`);
}

async function fillReadings(page: Page, rows: Array<[string, string]>) {
  for (let i = 0; i < rows.length; i++) {
    await cell(page, i, 0).fill(rows[i][0]);
    await cell(page, i, 1).fill(rows[i][1]);
  }
  await page.waitForTimeout(250);
}

const view = (page: Page) => page.evaluate(() => ({ ...(window as any).fluxGrapherPage.instance._last.v }));

test.describe('Flux Grapher', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
  });

  test('the prose is gone and the plot gets the screen', async ({ page }) => {
    await open(page);
    const body = await page.evaluate(() => document.body.innerText);
    for (const phrase of ['Plot your practical', 'Free forever', 'Built because', 'Part of']) {
      expect(body, `"${phrase}" is still on the page`).not.toContain(phrase);
    }
    const geo = await page.evaluate(() => {
      const host = document.getElementById('grapherHost')!;
      const plot = document.querySelector('.flg-plot') as HTMLElement;
      return {
        hostH: host.getBoundingClientRect().height,
        plotW: plot.getBoundingClientRect().width,
        vw: window.innerWidth,
        vh: window.innerHeight,
        pageScrolls: document.documentElement.scrollHeight > window.innerHeight + 2,
      };
    });
    expect(geo.hostH / geo.vh, 'the tool is not getting most of the screen').toBeGreaterThan(0.9);
    expect(geo.plotW / geo.vw, 'the plot is not getting most of the width').toBeGreaterThan(0.65);
    expect(geo.pageScrolls, 'the page scrolls, so the plot can be pushed off').toBe(false);
    await expect(page.locator('.brand-mark')).toBeVisible();
  });

  test('measurements: readings become points, a fit, and its gradient with an uncertainty', async ({ page }) => {
    await open(page, { mode: 'data' });
    await expect(page.locator('#modeData')).toHaveAttribute('aria-selected', 'true');
    await fillReadings(page, [['1', '2.1'], ['2', '3.9'], ['3', '6.2'], ['4', '7.8'], ['5', '10.1']]);
    expect(await page.locator('.flg-plot circle.flg-pt').count(), 'the readings were not plotted').toBe(5);
    await expect(page.locator('.flg-results')).toBeVisible();
    // m = 1.99 ± 0.06 for these readings — it goes in a lab report, so check the number.
    await expect(page.locator('.flg-rc')).toContainText('1.990 ± 0.060');
    await expect(page.locator('.flg-rc-eq')).toContainText('y = 1.99x');
  });

  test('an uncertainty column belongs to one value column and draws its bars', async ({ page }) => {
    await open(page, { mode: 'data' });
    await fillReadings(page, [['1', '2'], ['2', '4'], ['3', '6']]);
    expect(await page.locator('.flg-ebar').count()).toBe(0);

    await page.locator('[data-addcol]').first().click();
    await page.getByRole('menuitem', { name: /Uncertainty/ }).click();
    const uncHeader = page.locator('th.flg-col.is-unc');
    await expect(uncHeader, 'no ± column was added').toHaveCount(1);
    // It attaches to y by default, and says so in its header.
    await expect(uncHeader.locator('select.flg-cof option:checked')).toHaveText('y');

    const idx = await page.evaluate(() => {
      const ths = Array.from(document.querySelectorAll('.flg-table thead th.flg-col'));
      return ths.findIndex((t) => t.classList.contains('is-unc'));
    });
    await cell(page, 0, idx).fill('0.5');
    await cell(page, 1, idx).fill('10%');
    await page.waitForTimeout(250);
    expect(await page.locator('.flg-ebar').count(), 'two rows have a ± so two bars should draw').toBe(2);

    // Reassign it to x: the bars turn horizontal.
    await page.locator('th.flg-col.is-unc select.flg-cof').selectOption({ label: 'x' });
    await page.waitForTimeout(250);
    const d = await page.locator('.flg-ebar').first().getAttribute('d');
    expect(d, 'after reassigning to x the bar should run horizontally (H)').toContain('H');
  });

  test('a table can have more value columns, and any of them can be plotted', async ({ page }) => {
    await open(page, { mode: 'data' });
    await page.locator('[data-addcol]').first().click();
    await page.getByRole('menuitem', { name: /Value column/ }).click();
    expect(await page.locator('th.flg-col:not(.is-unc)').count()).toBe(3);
    await fillReadings(page, [['1', '5'], ['2', '6']]);
    await cell(page, 0, 2).fill('100');
    await cell(page, 1, 2).fill('200');
    await page.locator('[data-ycol]').first().selectOption({ index: 2 });
    await page.waitForTimeout(250);
    expect((await view(page)).yHi, 'the y axis should now reach the third column').toBeGreaterThan(150);
  });

  test('a calculated column works out T² from T, and carries T\'s uncertainty into its error bars', async ({ page }) => {
    await open(page, { mode: 'data' });
    const names = page.locator('.flg-cname');
    await names.nth(0).fill('L');
    await names.nth(1).fill('T');
    await fillReadings(page, [['0.4', '1.27'], ['1.0', '2.00']]);

    await page.locator('[data-addcol]').first().click();
    await page.getByRole('menuitem', { name: /Uncertainty/ }).click();
    await cell(page, 0, 2).fill('0.05');
    await cell(page, 1, 2).fill('0.05');

    await page.locator('[data-addcol]').first().click();
    await page.getByRole('menuitem', { name: /Calculated/ }).click();
    await page.locator('.flg-cexpr').fill('T^2');
    await page.waitForTimeout(250);

    // 2.00² = 4, and u(T²) = 2·T·u(T) = 0.2.
    const calc = page.locator('.flg-cell.is-calc');
    await expect(calc.nth(1)).toHaveValue('4');
    await expect(calc.nth(1)).toHaveAttribute('title', '± 0.2');
    await expect(calc.nth(0), 'a calculated cell cannot be typed into').toHaveAttribute('readonly', '');

    await page.locator('[data-ycol]').first().selectOption({ label: 'f1' });
    await page.waitForTimeout(250);
    expect(await page.locator('.flg-ebar').count(), 'the propagated uncertainty should draw a bar on each point').toBe(2);

    // A formula naming a column that does not exist is flagged, not silently blank.
    await page.locator('.flg-cexpr').fill('Q^2');
    await page.waitForTimeout(200);
    await expect(page.locator('.flg-cexpr')).toHaveClass(/is-bad/);
  });

  test('undo brings back a deleted row, and redo takes it away again', async ({ page }) => {
    await open(page, { mode: 'data' });
    await fillReadings(page, [['1', '2'], ['2', '4'], ['3', '6']]);
    await page.waitForTimeout(500);
    await page.locator('.flg-table tbody tr').nth(1).hover();
    await page.locator('[data-rdel="1"]').click();
    await page.waitForTimeout(500);
    await expect(cell(page, 1, 0)).toHaveValue('3');
    await page.locator('[data-hist="undo"]').click();
    await expect(cell(page, 1, 0), 'undo did not restore the deleted row').toHaveValue('2');
    await page.locator('[data-hist="redo"]').click();
    await expect(cell(page, 1, 0)).toHaveValue('3');
  });

  test('the window, title and axis names can be set exactly', async ({ page }) => {
    await open(page, { mode: 'data' });
    await page.locator('.flg-tool-window').click();
    await page.locator('.flg-win [data-wd="title"]').fill('Hooke\'s law');
    await page.locator('.flg-win [data-wd="xLabel"]').fill('Load');
    await page.locator('.flg-win [data-wd="xUnit"]').fill('N');
    await page.locator('.flg-win [data-wn="xMin"]').fill('-2');
    await page.locator('.flg-win [data-wn="xMax"]').fill('12');
    await page.waitForTimeout(300);
    const v = await view(page);
    expect(v.xLo).toBeCloseTo(-2, 6);
    expect(v.xHi).toBeCloseTo(12, 6);
    const text = await page.locator('.flg-plot svg').textContent();
    expect(text).toContain('Hooke\'s law');
    expect(text).toContain('Load / N');
  });

  test('functions: what you type is drawn, and a half-typed line explains itself', async ({ page }) => {
    await open(page, { mode: 'functions' });
    await expect(page.locator('#modeFunctions')).toHaveAttribute('aria-selected', 'true');
    expect(await page.locator('.flg-plot polyline').count(), 'x² was not drawn').toBeGreaterThan(0);
    const box = page.locator('.flg-expr').first();
    await box.fill('sin(x)*3');
    await page.waitForTimeout(250);
    expect(await page.locator('.flg-plot polyline').count()).toBeGreaterThan(0);
    await box.fill('sin(');
    await page.waitForTimeout(250);
    await expect(page.locator('.flg-err')).toBeVisible();
  });

  test('functions: a selected curve shows its zeros, turning point and y-intercept', async ({ page }) => {
    await open(page, { mode: 'functions' });
    const box = page.locator('.flg-expr').first();
    await box.fill('x^2 - 4');
    await box.focus();
    await page.waitForTimeout(300);
    const kp = await page.evaluate(() => {
      const i = (window as any).fluxGrapherPage.instance;
      return i.keyPointsFor(i._last.v).map((p: any) => ({ x: +p.x.toFixed(6), y: +p.y.toFixed(6), t: p.types.join(',') }));
    });
    expect(kp).toContainEqual({ x: -2, y: 0, t: 'zero' });
    expect(kp).toContainEqual({ x: 2, y: 0, t: 'zero' });
    expect(kp.find((p: any) => p.x === 0)?.t, 'the minimum and the y-intercept are the same point').toMatch(/min/);
    expect(await page.locator('.flg-plot .flg-kp').count(), 'the grey dots were not drawn').toBe(kp.length);

    // Clicking a dot pins its coordinates on the graph.
    const b = (await page.locator('.flg-plot .flg-kp').first().boundingBox())!;
    await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
    await page.waitForTimeout(250);
    await expect(page.locator('.flg-plot svg')).toContainText('(−2, 0)');
  });

  test('functions: a letter becomes a slider, and moving it redraws the curve', async ({ page }) => {
    await open(page, { mode: 'functions' });
    // "a sin(x)" — the space matters: it once read as asin(x), the arcsine.
    await page.locator('.flg-expr').first().fill('a sin(x)');
    await page.waitForTimeout(250);
    await expect(page.locator('.flg-param[data-p="a"]')).toBeVisible();
    const before = await page.locator('.flg-plot polyline').first().getAttribute('points');
    await page.locator('[data-pval="a"]').fill('3');
    await page.waitForTimeout(250);
    const after = await page.locator('.flg-plot polyline').first().getAttribute('points');
    expect(after, 'the curve did not change when the slider moved').not.toBe(before);
    await page.locator('.flg-expr').first().focus();
    await page.waitForTimeout(250);
    const top = await page.evaluate(() => {
      const i = (window as any).fluxGrapherPage.instance;
      return Math.max(...i.keyPointsFor(i._last.v).map((p: any) => p.y));
    });
    expect(top, 'with a = 3 the maximum of a·sin(x) is 3').toBeCloseTo(3, 5);
  });

  test('dragging pans and the reset button brings it home', async ({ page }) => {
    await open(page, { mode: 'functions' });
    const v0 = await view(page);
    const plot = (await page.locator('.flg-plot').boundingBox())!;
    await page.mouse.move(plot.x + plot.width / 2, plot.y + plot.height / 2);
    await page.mouse.down();
    await page.mouse.move(plot.x + plot.width / 2 - 200, plot.y + plot.height / 2, { steps: 6 });
    await page.mouse.up();
    await page.waitForTimeout(250);
    expect((await view(page)).xLo, 'dragging left should move the view right').toBeGreaterThan(v0.xLo + 1);
    await page.locator('[data-tool="home"]').click();
    await page.waitForTimeout(250);
    expect((await view(page)).xLo).toBeCloseTo(-10, 6);
  });

  test('switching halves keeps each one\'s work, and nothing is stored without saving', async ({ page }) => {
    await open(page, { mode: 'data' });
    await fillReadings(page, [['1', '1'], ['2', '2']]);
    await page.locator('#modeFunctions').click();
    await page.locator('.flg-expr').first().fill('3x');
    await page.locator('#modeData').click();
    await page.waitForTimeout(250);
    await expect(cell(page, 1, 1)).toHaveValue('2');
    const keys = await page.evaluate(() => Object.keys(localStorage));
    expect(keys, 'the free grapher wrote a graph to storage without being asked').not.toContain('flux_lab_graph');
    expect(keys).not.toContain('flux_grapher_fns');
    // Unsaved work is flagged on the save button instead.
    await expect(page.locator('#ghSave')).toHaveClass(/is-dirty/);
  });

  test('the maths keyboard types into the equation, functions and all', async ({ page }) => {
    await open(page, { mode: 'functions' });
    await page.locator('[data-add="expr"]').click();
    await page.locator('.flg-kbbtn').click();
    await expect(page.locator('.flg-kb')).toBeVisible();
    const box = page.locator('.flg-expr').nth(1);
    for (const k of ['3', 'x', '+', '1']) await page.locator(`.flg-key[data-key="${k}"]`).click();
    await expect(box).toHaveValue('3x+1');
    await page.locator('.flg-key[data-key="+"]').click();
    // The functions page: sin leaves the cursor inside its brackets.
    await page.locator('.flg-key[data-key="@fn"]').click();
    await page.locator('.flg-key[aria-label="sin"]').click();
    await page.locator('.flg-key[data-key="x"]').first().click();
    await expect(box).toHaveValue('3x+1+sin(x)');
    // Backspace into "sin(" takes the whole name, not one letter at a time.
    await page.locator('.flg-key[data-key="@back"]').click();     // the x
    await page.locator('.flg-key[data-key="@back"]').click();     // sin( and its )
    await expect(box).toHaveValue('3x+1+');
    await page.waitForTimeout(250);
    expect(await page.locator('.flg-plot polyline').count()).toBeGreaterThan(0);
  });

  test('definitions work like Desmos: a = 4, f(x) = …, f′(x), and sums that just answer', async ({ page }) => {
    await open(page, { mode: 'functions' });
    await page.evaluate(() => {
      const i = (window as any).fluxGrapherPage.instance;
      const d = JSON.parse(JSON.stringify(i.doc));
      d.items = [
        { type: 'expr', src: 'a=4' }, { type: 'expr', src: '3x+a' },
        { type: 'expr', src: 'f(x)=x^2-2' }, { type: 'expr', src: "f'(x)" }, { type: 'expr', src: 'f(3)+1' },
      ];
      i.loadDoc(d);
    });
    await page.waitForTimeout(300);
    const r = await page.evaluate(() => {
      const i = (window as any).fluxGrapherPage.instance;
      const it = i.doc.items;
      return {
        line0: i.parsed(it[1]).fn(0), deriv3: i.parsed(it[3]).fn(3),
        sliders: Object.keys(i.doc.params), rows: it.map((x: any) => i.parsed(x).kind),
      };
    });
    expect(r.rows).toEqual(['def', 'fn', 'fn', 'fn', 'value']);
    expect(r.line0, '3x + a at x = 0 should use a = 4').toBe(4);
    expect(r.deriv3, "f'(3) for f = x² − 2").toBeCloseTo(6, 5);
    expect(r.sliders, 'a is defined, so it must not also get a loose slider').toEqual([]);
    await expect(page.locator('.flg-item').nth(4).locator('.flg-eqv')).toHaveText('= 8');
    // The row that defines a carries its own slider; moving it rewrites the row.
    const slider = page.locator('[data-defslider]');
    await expect(slider).toHaveCount(1);
    await slider.evaluate((el: HTMLInputElement) => { el.value = '7'; el.dispatchEvent(new Event('input', { bubbles: true })); });
    await expect(page.locator('.flg-expr').first()).toHaveValue('a=7');
    const moved = await page.evaluate(() => { const i = (window as any).fluxGrapherPage.instance; i._drawNow(); return i.parsed(i.doc.items[1]).fn(0); });
    expect(moved).toBe(7);
  });

  test('a regression row fits a table, like y1 ~ m x1 + b in Desmos', async ({ page }) => {
    await open(page, { mode: 'functions' });
    await page.locator('[data-add="table"]').click();
    const t = page.locator('.flg-item--table').first();
    await expect(t.locator('.flg-cname').first()).toHaveValue('x1');
    const rows = [['0', '1'], ['1', '3'], ['2', '5'], ['3', '7']];
    for (let r = 0; r < rows.length; r++) {
      await t.locator(`[data-cell="${r}:0"]`).fill(rows[r][0]);
      await t.locator(`[data-cell="${r}:1"]`).fill(rows[r][1]);
    }
    await page.locator('[data-add="expr"]').click();
    await page.locator('.flg-expr').last().fill('y1 ~ m x1 + b');
    await page.waitForTimeout(400);
    const info = page.locator('.flg-item--expr').last().locator('.flg-info');
    await expect(info).toContainText('m = 2');
    await expect(info).toContainText('b = 1');
    await expect(info).toContainText('R² = 1');
    // The fitted letters are numbers now, usable anywhere, not sliders.
    const params = await page.evaluate(() => Object.keys((window as any).fluxGrapherPage.instance.doc.params));
    expect(params).toEqual([]);
  });

  test('several fits at once, the automatic best fit, and each one removable', async ({ page }) => {
    await open(page, { mode: 'data' });
    await fillReadings(page, [['0', '3'], ['1', '2.6'], ['2', '3.1'], ['3', '4.4'], ['4', '7.1'], ['5', '10.4'], ['6', '15.2']]);
    await page.locator('[data-fits]').click();
    await page.locator('.flg-fitpop [data-fk="quadratic"]').check();
    await page.locator('.flg-fitpop [data-fk="auto"]').check();
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
    await expect(page.locator('.flg-fchip')).toHaveCount(3);
    await expect(page.locator('.flg-rc-fit')).toHaveCount(3);
    await expect(page.locator('.flg-results'), 'the automatic fit should pick the quadratic for curved data').toContainText('Best fit: Quadratic');
    const dashed = await page.locator('.flg-plot polyline[stroke-dasharray]').count();
    expect(dashed, 'the second and third fits should be dashed so they can be told apart').toBeGreaterThanOrEqual(2);
    await page.locator('.flg-fchip').first().locator('[data-unfit]').click();
    await expect(page.locator('.flg-fchip')).toHaveCount(2);
  });

  test('a manual line is dragged into place by its handles', async ({ page }) => {
    await open(page, { mode: 'data' });
    await fillReadings(page, [['1', '2'], ['2', '4'], ['3', '6'], ['4', '8']]);
    await page.locator('[data-manual]').click();
    await page.waitForTimeout(300);
    await expect(page.locator('.flg-plot .flg-mhandle')).toHaveCount(2);
    const line = (i: number) => page.evaluate((k) => ({ ...(window as any).fluxGrapherPage.instance.doc.items[0].manuals[k] }), i);
    const before = await line(0);
    const h = (await page.locator('.flg-plot .flg-mhandle').nth(1).boundingBox())!;
    await page.mouse.move(h.x + h.width / 2, h.y + h.height / 2);
    await page.mouse.down();
    await page.mouse.move(h.x + h.width / 2, h.y + h.height / 2 + 80, { steps: 5 });
    await page.mouse.up();
    await page.waitForTimeout(300);
    const after = await line(0);
    expect(after.y2, 'dragging the handle down should lower its end of the line').toBeLessThan(before.y2);
    expect(after.x1).toBe(before.x1);
    await expect(page.locator('.flg-results')).toContainText('Manual line');
    await expect(page.locator('.flg-results')).toContainText('RMSE');
  });

  test('several manual lines: each drags on its own, and together they give m ± Δm', async ({ page }) => {
    await open(page, { mode: 'data' });
    await fillReadings(page, [['1', '2'], ['2', '4'], ['3', '6'], ['4', '8']]);
    await page.locator('[data-manual]').click();
    await page.waitForTimeout(200);
    await page.locator('[data-manual]').click();
    await page.waitForTimeout(300);
    await expect(page.locator('.flg-plot .flg-mhandle')).toHaveCount(4);
    await expect(page.locator('.flg-plot .flg-mlabel'), 'with two lines, each is numbered on the graph').toHaveCount(2);
    await expect(page.locator('.flg-fchip--manual')).toHaveCount(2);
    const lines = () => page.evaluate(() => (window as any).fluxGrapherPage.instance.doc.items[0].manuals.map((m: any) => ({ ...m })));
    const start = await lines();
    const slope = (m: any) => (m.y2 - m.y1) / (m.x2 - m.x1);
    expect(slope(start[1]), 'the second line starts at a different gradient, not on top of the first').not.toBeCloseTo(slope(start[0]), 3);

    // Drag the second line's right handle: only that line moves.
    const h = (await page.locator('.flg-plot .flg-mhandle').nth(3).boundingBox())!;
    await page.mouse.move(h.x + h.width / 2, h.y + h.height / 2);
    await page.mouse.down();
    await page.mouse.move(h.x + h.width / 2, h.y + h.height / 2 - 60, { steps: 5 });
    await page.mouse.up();
    await page.waitForTimeout(300);
    const moved = await lines();
    expect(moved[0], 'the first line must not move').toEqual(start[0]);
    expect(moved[1].y2).toBeGreaterThan(start[1].y2);

    const res = page.locator('.flg-results');
    await expect(res).toContainText('Manual line 1');
    await expect(res).toContainText('Manual line 2');
    await expect(res).toContainText('From your manual lines');
    await expect(res).toContainText('±');

    await page.locator('.flg-fchip--manual').first().locator('[data-unmanual]').click();
    await page.waitForTimeout(200);
    await expect(page.locator('.flg-plot .flg-mhandle')).toHaveCount(2);
    await expect(res).not.toContainText('From your manual lines');
    expect((await lines())[0], 'removing line 1 leaves line 2').toEqual(moved[1]);
  });

  test('Clear all empties the measurements graph, and Undo brings everything back', async ({ page }) => {
    await open(page, { mode: 'data' });
    await fillReadings(page, [['1', '2'], ['2', '4'], ['3', '6']]);
    await page.locator('[data-manual]').click();
    await page.evaluate(() => { const g = (window as any).fluxGrapherPage.instance; g.doc.title = 'Spring'; g.touch(); });
    await page.waitForTimeout(500);
    const cells = () => page.locator('.flg-cell').evaluateAll((els) => els.map((e) => (e as HTMLInputElement).value).join(''));
    expect(await cells()).toContain('122436');

    await page.locator('[data-clearall]').click();
    await page.waitForTimeout(300);
    expect(await cells(), 'every reading should be gone').toBe('');
    const doc = await page.evaluate(() => (window as any).fluxGrapherPage.instance.doc);
    expect(doc.title).toBe('');
    expect(doc.items).toHaveLength(1);
    expect(doc.items[0].manuals).toEqual([]);
    await expect(page.locator('.flg-results')).toBeHidden();

    await page.locator('[data-hist="undo"]').click();
    await page.waitForTimeout(300);
    expect(await cells(), 'Undo should restore the readings').toContain('122436');
    expect(await page.evaluate(() => (window as any).fluxGrapherPage.instance.doc.title)).toBe('Spring');
    expect(await page.evaluate(() => (window as any).fluxGrapherPage.instance.doc.items[0].manuals.length)).toBe(1);
  });

  test('Clear all is only on the measurements side', async ({ page }) => {
    await open(page);
    await page.locator('#modeFunctions').click();
    await page.waitForTimeout(300);
    await expect(page.locator('[data-clearall]')).toHaveCount(0);
  });

  test('every line can take its own colour, max/min runs edge to edge, and a saved image carries the key only when the results are open', async ({ page }) => {
    await open(page, { mode: 'data' });
    await page.evaluate(() => {
      (window as any).fluxGrapherPage.instance.loadDoc({ v: 3, items: [{ type: 'table', name: 'Density',
        cols: [{ id: 'v', name: 'V', role: 'value' }, { id: 'dv', name: 'dV', role: 'unc', of: 'v' }, { id: 'm', name: 'm', role: 'value' }],
        rows: [['69', '9', '65.7'], ['75', '15', '80.4'], ['83', '11', '82.5'], ['104', '12', '98.5']],
        xCol: 'v', yCol: 'm', fits: ['linear'], minmax: true, manuals: [{ x1: 60, y1: 60, x2: 110, y2: 100 }] }] });
    });
    await page.waitForTimeout(400);

    await page.locator('[data-lcol="mm:steep"]').click();
    await page.locator('.flg-swpop [data-c="#34d399"]').click();
    await page.locator('[data-lcol="man:0"]').click();
    await page.locator('.flg-swpop [data-c="#f472b6"]').click();
    await page.waitForTimeout(300);
    const doc = await page.evaluate(() => (window as any).fluxGrapherPage.instance.doc.items[0]);
    expect(doc.lineColours['mm:steep']).toBe('#34d399');
    expect(doc.manuals[0].colour).toBe('#f472b6');
    await expect(page.locator('.flg-plot line[stroke="#34d399"]'), 'the steepest line is drawn in its new colour').toHaveCount(1);
    await expect(page.locator('.flg-plot line.flg-manual[stroke="#f472b6"]')).toHaveCount(1);

    // Max/min lines reach both sides of the plot, not just the outermost error bars.
    const span = await page.evaluate(() => {
      const l = document.querySelector('.flg-plot line[stroke="#34d399"]') as SVGLineElement;
      const g = (window as any).fluxGrapherPage.instance._last;
      return { x1: +l.getAttribute('x1')!, x2: +l.getAttribute('x2')!, L: g.m.sx(g.v.xLo), R: g.m.sx(g.v.xHi) };
    });
    expect(Math.abs(span.x1 - span.L)).toBeLessThan(1);
    expect(Math.abs(span.x2 - span.R)).toBeLessThan(1);

    const image = () => page.evaluate(() => (window as any).fluxGrapherPage.instance.svg(1200, 800, true));
    expect(await image(), 'the saved image names the max/min lines in its key').toContain('Steepest line');
    await page.locator('[data-restoggle]').click();
    expect(await image(), 'collapsed results leave the key out of the image').not.toContain('Steepest line');
  });

  test('one click writes a regression, with letters that do not clash, and it reports r, RMSE and n', async ({ page }) => {
    await open(page, { mode: 'functions' });
    await page.locator('[data-add="table"]').click();
    const t = page.locator('.flg-item--table').first();
    const rows = [['0', '1'], ['1', '3'], ['2', '5'], ['3', '7'], ['4', '9.2']];
    for (let r = 0; r < rows.length; r++) {
      await t.locator(`[data-cell="${r}:0"]`).fill(rows[r][0]);
      await t.locator(`[data-cell="${r}:1"]`).fill(rows[r][1]);
    }
    await t.locator('[data-regadd]').click();
    await page.locator('.flg-regpop [data-reg="linear"]').click();
    await expect(page.locator('.flg-expr').last()).toHaveValue('y1 ~ m x1 + b');
    const info = page.locator('.flg-item--expr').last().locator('.flg-info');
    await expect(info).toContainText('y1 = ');
    await expect(info).toContainText('R² =');
    await expect(info).toContainText('r =');
    await expect(info).toContainText('RMSE');
    await expect(info).toContainText('n = 5');

    // A second regression may not reuse m or b.
    await t.locator('[data-regadd]').click();
    await page.locator('.flg-regpop [data-reg="quadratic"]').click();
    const quad = await page.locator('.flg-expr').nth(1).inputValue();
    expect(quad).toMatch(/^y1 ~ a x1\^2 \+ \w x1 \+ c$/);
    expect(quad, 'b is taken by the linear fit').not.toContain(' b x1');
  });

  test('lists and list literals regress like columns, and residuals and log mode switch on', async ({ page }) => {
    await open(page, { mode: 'functions' });
    const rows = ['x1 = [1, 2, 3, 4, 5]', 'y1 = [2.7, 7.4, 20.1, 54.6, 148.4]', 'y1 ~ a e^(k x1)', '[2.1, 3.9, 6.2, 7.8, 10.1] ~ p[1, 2, 3, 4, 5] + q'];
    await page.locator('.flg-expr').first().fill(rows[0]);
    for (const src of rows.slice(1)) {
      await page.locator('[data-add="expr"]').click();
      await page.locator('.flg-expr').last().fill(src);
    }
    await page.waitForTimeout(500);
    const exp = page.locator('.flg-item--expr').nth(2).locator('.flg-info');
    // Made from y = e^x, rounded: a and k both come out within a thousandth of 1.
    await expect(exp).toContainText(/a = (1\.00|0\.99)/);
    await expect(exp).toContainText(/k = (1\.00|0\.99)/);
    await expect(page.locator('.flg-item--expr').nth(3).locator('.flg-info')).toContainText('p = 1.99');

    await exp.locator('[data-rres]').click();
    await expect(page.locator('.flg-plot .flg-resid')).toHaveCount(5);
    await exp.locator('[data-rlog]').click();
    await expect(exp).toContainText('in log space');
  });

  test('the keypad has ~ and [ ] for regressions and lists', async ({ page }) => {
    await open(page, { mode: 'functions' });
    await page.locator('[data-kb]').click();
    await expect(page.locator('.flg-kb [data-key]').filter({ hasText: '~' })).toHaveCount(1);
    await expect(page.locator('.flg-kb [data-key]').filter({ hasText: '[ ]' })).toHaveCount(1);
  });

  test('the chosen half survives a reload', async ({ page }) => {
    await open(page);
    await page.locator('#modeFunctions').click();
    await page.waitForTimeout(200);
    await page.reload();
    await page.waitForTimeout(700);
    await expect(page.locator('#modeFunctions')).toHaveAttribute('aria-selected', 'true');
  });

  test('first visit offers a tour, once', async ({ page }) => {
    await open(page, { tour: true });
    await page.waitForTimeout(600);
    const offer = page.locator('.fgt-offer');
    await expect(offer, 'no tour was offered on the first visit').toBeVisible();
    await offer.getByRole('button', { name: 'Show me' }).click();
    await expect(page.locator('.fgt-card')).toBeVisible();
    await expect(page.locator('.fgt-title')).toHaveText('Two graphers');
    await page.locator('.fgt-next').click();
    await expect(page.locator('.fgt-count')).toContainText('2 of');
    await page.keyboard.press('Escape');
    await expect(page.locator('.fgt-card')).toHaveCount(0);

    await page.reload();
    await page.waitForTimeout(1500);
    await expect(page.locator('.fgt-offer'), 'the tour was offered again after being seen').toHaveCount(0);
    // It can always be replayed from the ? button.
    await page.locator('#ghHelp').click();
    await expect(page.locator('.fgt-card')).toBeVisible();
  });

  test('saving asks to sign in, then saves the graph to the account', async ({ page }) => {
    const posted: any[] = [];
    await page.route('**/auth/v1/token?grant_type=password', async (route) => {
      const body = route.request().postDataJSON();
      if (body.password !== 'right-password') {
        await route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ error_code: 'invalid_credentials' }) });
        return;
      }
      expect(body.email, 'the name must fold to the address the planner uses').toBe('ada.lovelace@users.fluxplanner.app');
      await route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({
          access_token: 'test-token', refresh_token: 'r', expires_in: 3600,
          user: { id: '00000000-0000-4000-8000-000000000001', email: 'ada.lovelace@users.fluxplanner.app', user_metadata: { full_name: 'Ada Lovelace' } },
        }),
      });
    });
    await page.route('**/rest/v1/flux_graphs**', async (route) => {
      const req = route.request();
      expect(req.headers()['authorization']).toBe('Bearer test-token');
      posted.push({ method: req.method(), url: req.url(), body: req.postDataJSON() });
      await route.fulfill({
        status: req.method() === 'POST' ? 201 : 200, contentType: 'application/json',
        body: JSON.stringify([{ id: '11111111-1111-4111-8111-111111111111', title: req.postDataJSON().title }]),
      });
    });

    await open(page, { mode: 'data' });
    await fillReadings(page, [['1', '2'], ['2', '4']]);
    await page.locator('#ghSave').click();
    const sheet = page.locator('.fgc-sheet');
    await expect(sheet).toContainText('Sign in to save');
    await sheet.locator('input[name="n"]').fill('Ada Lovelace');
    await sheet.locator('input[name="p"]').fill('wrong');
    await sheet.getByRole('button', { name: 'Sign in' }).click();
    await expect(sheet.locator('.fgc-err')).toContainText('do not match');

    await sheet.locator('input[name="p"]').fill('right-password');
    await sheet.getByRole('button', { name: 'Sign in' }).click();
    const nameSheet = page.locator('.fgc-sheet', { hasText: 'Name this graph' });
    await expect(nameSheet).toBeVisible();
    await nameSheet.locator('input').fill('Spring constant');
    await nameSheet.getByRole('button', { name: 'Save' }).click();
    await page.waitForTimeout(500);

    expect(posted.length, 'nothing reached the saved-graphs table').toBe(1);
    expect(posted[0].method).toBe('POST');
    expect(posted[0].body.kind).toBe('data');
    expect(posted[0].body.title).toBe('Spring constant');
    expect(posted[0].body.payload.items[0].rows[1].slice(0, 2)).toEqual(['2', '4']);
    await expect(page.locator('#ghSave')).not.toHaveClass(/is-dirty/);

    // The second save updates the same row instead of making a copy.
    await cell(page, 2, 0).fill('3');
    await cell(page, 2, 1).fill('6');
    await page.locator('#ghSave').click();
    await page.waitForTimeout(500);
    expect(posted.length).toBe(2);
    expect(posted[1].method).toBe('PATCH');
    expect(posted[1].url).toContain('id=eq.11111111-1111-4111-8111-111111111111');
    // Signed in now, and the header shows whose account it is.
    await expect(page.locator('#ghAcct .acct-av')).toHaveText('A');
  });

  test('on a phone every control and the hub fit on the bar', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await open(page);
    const over = await page.evaluate(() => {
      const vw = document.documentElement.clientWidth;
      return ['#modeFunctions', '#modeData', '#ghSave', '#ghOpen', '#ghAcct', '.fxhub-btn']
        .map((s) => ({ s, r: document.querySelector(s)!.getBoundingClientRect().right }))
        .filter((x) => x.r > vw + 1);
    });
    expect(over, 'these controls are pushed off the right edge').toEqual([]);
  });
});

/**
 * Switching halves used to swap in one frame. Now the highlight slides to the
 * chosen tab and the new grapher comes in from that tab's side — Functions
 * from the left, Measurements from the right.
 */
test('switching tabs slides the highlight and brings the grapher in from that side', async ({ page }) => {
  await open(page, { mode: 'data' });
  const glide = page.locator('#ghModes .flg-glide');
  await expect(glide).toHaveCount(1);
  const x = () => glide.evaluate((g) => (g as HTMLElement).style.transform);
  const onData = await x();
  await page.locator('#modeFunctions').click();
  await expect(page.locator('#grapherHost > .flg')).toHaveClass(/flg-in-l/);
  expect(await x(), 'the highlight did not move to Functions').not.toBe(onData);
  // The entrance is a moment, not a state.
  await expect(page.locator('#grapherHost > .flg')).not.toHaveClass(/flg-in-l/, { timeout: 2000 });
  await page.locator('#modeData').click();
  await expect(page.locator('#grapherHost > .flg')).toHaveClass(/flg-in-r/);
  expect(await x()).toBe(onData);
});

test('with reduced motion the switch is instant', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await open(page, { mode: 'data' });
  await page.locator('#modeFunctions').click();
  await expect(page.locator('#grapherHost > .flg')).not.toHaveClass(/flg-in-/);
  await expect(page.locator('#modeFunctions')).toHaveAttribute('aria-selected', 'true');
});

/**
 * An image goes into a report, so it is only made once the graph has a title
 * and both axes are named, after a preview and three checks — every time.
 */
test('saving an image asks for a title and axis names, and a double-check, every time', async ({ page }) => {
  await open(page, { mode: 'data' });
  await fillReadings(page, [['1', '2.1'], ['2', '3.9'], ['3', '6.2']]);
  await page.locator('#ghPng').click();
  const sheet = page.locator('.fgx-sheet');
  await expect(sheet).toBeVisible();
  await expect(sheet.locator('.fgx-preview img')).toHaveAttribute('src', /^blob:/);
  const go = sheet.locator('.fgx-go');
  await expect(go).toBeDisabled();
  await expect(sheet.locator('.fgx-missing')).toContainText('a title');

  await sheet.locator('[name=title]').fill('Extension of a spring');
  await sheet.locator('[name=xLabel]').fill('Load');
  await sheet.locator('[name=xUnit]').fill('N');
  await sheet.locator('[name=yLabel]').fill('Extension');
  await expect(go, 'the checks were skipped').toBeDisabled();
  for (const k of ['c1', 'c2', 'c3']) await sheet.locator(`[name=${k}]`).check();
  await expect(go).toBeEnabled();
  const [dl] = await Promise.all([page.waitForEvent('download'), go.click()]);
  expect(dl.suggestedFilename()).toBe('extension-of-a-spring.png');
  // What was typed is now the graph's own title and axis names.
  const d = await page.evaluate(() => { const x = (window as any).fluxGrapherPage.instance.doc; return [x.title, x.xLabel, x.xUnit, x.yLabel]; });
  expect(d).toEqual(['Extension of a spring', 'Load', 'N', 'Extension']);

  // Next time: the names are there, but the checks start unticked again.
  await page.locator('#ghPng').click();
  await expect(sheet.locator('[name=title]')).toHaveValue('Extension of a spring');
  await expect(sheet.locator('[name=c1]')).not.toBeChecked();
  await expect(sheet.locator('.fgx-go')).toBeDisabled();
  // Closing without saving changes nothing.
  await sheet.locator('[name=title]').fill('Something else');
  await page.keyboard.press('Escape');
  await expect(page.locator('.fgx-back')).toHaveCount(0);
  expect(await page.evaluate(() => (window as any).fluxGrapherPage.instance.doc.title)).toBe('Extension of a spring');
});

/**
 * A graph deleted in the planner came back the next time the grapher tab
 * that still had it open was saved: an update that found nothing quietly
 * made a new copy. Now it asks, and a deletion tells every open grapher.
 */
test.describe('a deleted saved graph stays deleted', () => {
  const G1 = '22222222-2222-4222-8222-222222222222';
  async function signedIn(page: Page) {
    await page.addInitScript(() => {
      localStorage.setItem('flux_grapher_session', JSON.stringify({
        access_token: 'test-token', refresh_token: 'r', expires_at: Math.floor(Date.now() / 1000) + 3600,
        user: { id: '00000000-0000-4000-8000-000000000001', email: 'ada@users.fluxplanner.app', user_metadata: { full_name: 'Ada' } },
      }));
    });
  }

  test('saving a graph that was deleted elsewhere asks before making it again', async ({ page }) => {
    const calls: string[] = [];
    await signedIn(page);
    await page.route('**/rest/v1/flux_graphs**', async (route) => {
      const m = route.request().method();
      calls.push(m);
      const body = m === 'PATCH' ? '[]' : JSON.stringify([{ id: '33333333-3333-4333-8333-333333333333', title: 'Spring' }]);
      await route.fulfill({ status: m === 'POST' ? 201 : 200, contentType: 'application/json', body });
    });
    await open(page, { mode: 'data' });
    await page.evaluate((id) => {
      const inst = (window as any).fluxGrapherPage.instance;
      inst.loadDoc(inst.doc, { id, title: 'Spring' });
    }, G1);
    await fillReadings(page, [['1', '2']]);
    const asked: string[] = [];
    page.once('dialog', (d) => { asked.push(d.message()); d.dismiss(); });
    await page.locator('#ghSave').click();
    await expect.poll(() => asked.length).toBe(1);
    expect(asked[0]).toContain('was deleted');
    await page.waitForTimeout(300);
    expect(calls, 'it was made again without asking').toEqual(['PATCH']);
    expect(await page.evaluate(() => (window as any).fluxGrapherPage.instance.cloud)).toBeNull();
  });

  test('deleting it from the list lets go of the copy on screen', async ({ page }) => {
    let rows = [{ id: G1, kind: 'data', title: 'Spring', updated_at: new Date().toISOString() }];
    await signedIn(page);
    await page.route('**/rest/v1/flux_graphs**', async (route) => {
      const m = route.request().method();
      if (m === 'DELETE') {
        const gone = rows;
        rows = [];
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(gone.map((r) => ({ id: r.id }))) });
        return;
      }
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(rows) });
    });
    await open(page, { mode: 'data' });
    await page.evaluate((id) => {
      const inst = (window as any).fluxGrapherPage.instance;
      inst.loadDoc(inst.doc, { id, title: 'Spring' });
    }, G1);
    await page.locator('#ghOpen').click();
    const sheet = page.locator('.fgc-sheet');
    await expect(sheet.locator('.fgc-row')).toHaveCount(1);
    page.once('dialog', (d) => d.accept());
    await sheet.locator('[data-delrow]').click();
    await expect(sheet.locator('.fgc-row')).toHaveCount(0);
    expect(await page.evaluate(() => (window as any).fluxGrapherPage.instance.cloud)).toBeNull();
  });
});
