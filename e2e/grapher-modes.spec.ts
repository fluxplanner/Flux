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
