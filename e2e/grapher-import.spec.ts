import { test, expect, type Page } from '@playwright/test';

/**
 * Getting a table into the grapher without typing it (flux-grapher-import.js):
 * a CSV file, and a photo read by Flux AI. The parsing is unit-tested in
 * test/unit/grapher-import.test.mjs; these check what a student sees — the
 * offer under an empty table, the sheet where the table is checked, and the
 * table that lands in the graph.
 *
 * ai-proxy is stubbed: no real account is used and no AI call is made.
 */

async function open(page: Page, opts: { signedIn?: boolean } = {}) {
  await page.addInitScript(({ signedIn }) => {
    try {
      localStorage.setItem('flux_grapher_tour', 'done');
      localStorage.setItem('flux_grapher_mode', 'data');
      if (signedIn) {
        localStorage.setItem('flux_grapher_session', JSON.stringify({
          access_token: 'test-token', refresh_token: 'r', expires_at: Math.floor(Date.now() / 1000) + 3600,
          user: { id: '00000000-0000-4000-8000-000000000001', email: 'ada@users.fluxplanner.app', user_metadata: { full_name: 'Ada' } },
        }));
      } else {
        localStorage.setItem('flux_grapher_signed_out', '1');
      }
    } catch (e) {}
  }, { signedIn: !!opts.signedIn });
  await page.goto('/grapher.html');
  await page.waitForTimeout(700);
}

const doc = (page: Page) => page.evaluate(() => {
  const t = (window as any).fluxGrapherPage.instance.doc.items[0];
  return {
    name: t.name,
    cols: t.cols.map((c: any) => [c.name, c.unit, c.role]),
    rows: t.rows.filter((r: string[]) => r.some((c) => c !== '')),
    x: t.cols.findIndex((c: any) => c.id === t.xCol),
    y: t.cols.findIndex((c: any) => c.id === t.yCol),
  };
});

// A 1×1 PNG: the stubbed proxy never looks at it.
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');

test.describe('Importing a table into the grapher', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
  });

  test('a CSV file: headings become names and units, ± becomes uncertainty, and the mean row stays out', async ({ page }) => {
    await open(page);
    const offer = page.locator('.flg-timport');
    await expect(offer).toBeVisible();
    const chooser = page.waitForEvent('filechooser');
    await offer.locator('[data-imp="file"]').click();
    await (await chooser).setFiles({
      name: 'pendulum.csv', mimeType: 'text/csv',
      buffer: Buffer.from('Length / cm ± 0.1,Period (s),Δ Period\n20.0,0.90,0.02\n40.0,1.27,0.02\n60.0,1.55,0.03\nMean,40,1.24,\n'),
    });
    const sheet = page.locator('#fgiSheet');
    await expect(sheet.locator('.fgc-h')).toHaveText('Check the table');
    await expect(sheet.locator('.fgi-name')).toHaveCount(2);
    await expect(sheet.locator('.fgi-add')).toHaveText('Add 3 rows to the graph');
    await sheet.locator('.fgi-add').click();

    const d = await doc(page);
    expect(d.name).toBe('pendulum');
    expect(d.cols).toEqual([['Length', 'cm', 'value'], ['', '', 'unc'], ['Period', 's', 'value'], ['', '', 'unc']]);
    expect(d.rows).toEqual([['20.0', '0.1', '0.90', '0.02'], ['40.0', '0.1', '1.27', '0.02'], ['60.0', '0.1', '1.55', '0.03']]);
    expect([d.x, d.y]).toEqual([0, 2]);
    // The offer is for empty tables only, and the axes take the column names.
    await expect(page.locator('.flg-timport')).toHaveCount(0);
    await expect(page.locator('.flg-plot')).toContainText('Period / s');
  });

  test('a photo: read by Flux AI, checked against the photo, fixed, then graphed', async ({ page }) => {
    let sent: any = null;
    await page.route('**/functions/v1/ai-proxy', async (route) => {
      sent = route.request().postDataJSON();
      await route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({
          content: [{ type: 'text', text: '{"columns":[{"name":"Time","unit":"s"},{"name":"Temperature ± 0.5","unit":"°C"}],"rows":[["0","21.0"],["30","24.5"],["9O","28.0"]]}' }],
          scans_left: 9, daily_limit: 10,
        }),
      });
    });
    await open(page, { signedIn: true });
    const chooser = page.waitForEvent('filechooser');
    await page.locator('[data-import]').click();
    await page.locator('.flg-menu-i', { hasText: 'Scan a photo of a table' }).click();
    await (await chooser).setFiles({ name: 'table.png', mimeType: 'image/png', buffer: PNG });

    const sheet = page.locator('#fgiSheet:not(.is-out)');
    await expect(sheet.locator('.fgc-h')).toHaveText('Check the table');
    expect(sent.task).toBe('table_scan');
    expect(sent.mimeType).toBe('image/jpeg');
    expect(sent.imageBase64.length).toBeGreaterThan(20);
    await expect(sheet.locator('.fgi-photo img')).toBeVisible();
    await expect(sheet.locator('.fgi-left')).toHaveText('9 of 10 free scans left today');
    await expect(sheet.locator('.fgi-warn')).toBeVisible();
    // The misread "9O" is flagged; fixing it clears the flag.
    const bad = sheet.locator('.fgi-cell.is-odd');
    await expect(bad).toHaveCount(1);
    await bad.fill('60');
    await expect(sheet.locator('.fgi-cell.is-odd')).toHaveCount(0);
    await sheet.locator('.fgi-add').click();

    const d = await doc(page);
    expect(d.cols).toEqual([['Time', 's', 'value'], ['Temperature', '°C', 'value'], ['', '', 'unc']]);
    expect(d.rows).toEqual([['0', '21.0', '0.5'], ['30', '24.5', '0.5'], ['60', '28.0', '0.5']]);
    // The menu remembers how many scans are left today.
    await page.locator('[data-import]').click();
    await expect(page.locator('.flg-menu-i', { hasText: 'Scan a photo' })).toContainText('9 left today');
  });

  test('scanning asks a signed-out student to sign in, and sends nothing', async ({ page }) => {
    let calls = 0;
    await page.route('**/functions/v1/ai-proxy', async (route) => { calls++; await route.abort(); });
    await open(page);
    let picked = false;
    page.on('filechooser', () => { picked = true; });
    await page.locator('.flg-timport [data-imp="image"]').click();
    // Asked first — before a photo is chosen, not after.
    await expect(page.locator('.fgc-sheet .fgc-h')).toHaveText('Sign in to scan photos of tables');
    expect(picked).toBe(false);
    await expect(page.locator('.fgc-sheet .fgc-sub')).toContainText('needs no account');
    expect(calls).toBe(0);
  });

  test('when today\'s scans are used up it says so, and when they come back', async ({ page }) => {
    await page.route('**/functions/v1/ai-proxy', (route) => route.fulfill({
      status: 429, contentType: 'application/json',
      body: JSON.stringify({ error: 'scan_daily_limit', daily_limit: 10, scans_left: 0 }),
    }));
    await open(page, { signedIn: true });
    const chooser = page.waitForEvent('filechooser');
    await page.locator('.flg-timport [data-imp="image"]').click();
    await (await chooser).setFiles({ name: 'table.png', mimeType: 'image/png', buffer: PNG });
    await expect(page.locator('.flg-toast')).toContainText('used today\'s 10 free photo scans');
    await expect(page.locator('#fgiSheet:not(.is-out)')).toHaveCount(0);
  });
});
