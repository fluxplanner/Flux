import { test, expect, devices, type Page } from '@playwright/test';

/*
 * Printing from Flux saved to an iPhone or iPad home screen (Azfer,
 * 2026-10-01: "on mobile the printing pop up doesnt work"). A home-screen web
 * app on iOS has no printing — window.print() there does nothing — so the
 * grapher and the periodic table hand an image of the printout to the phone's
 * Share sheet instead, which has Print in it.
 *
 * Chromium is not iOS, so the home-screen app is stood in for with
 * navigator.standalone, and the Share sheet with a recording navigator.share.
 */

const { defaultBrowserType, ...iphone } = devices['iPhone 13'];
test.use(iphone);

async function asHomeScreenApp(page: Page, opts: { standalone: boolean }) {
  await page.addInitScript((standalone) => {
    const w = window as any;
    if (standalone) Object.defineProperty(navigator, 'standalone', { get: () => true });
    w.__printed = 0;
    window.print = () => { w.__printed++; };
    w.__shared = [];
    (navigator as any).canShare = () => true;
    (navigator as any).share = async (d: any) => {
      w.__shared.push({ title: d.title, files: d.files.map((f: File) => ({ name: f.name, type: f.type, size: f.size })) });
    };
    try {
      localStorage.setItem('flux_grapher_tour', 'done');
      localStorage.setItem('flux_grapher_mode', 'data');
      localStorage.setItem('flux_grapher_signed_out', '1');
    } catch (e) {}
  }, opts.standalone);
}

test.describe('Printing on a phone', () => {
  test('grapher, home-screen app: Print is on the bar, and sends a PNG to the Share sheet', async ({ page }) => {
    await asHomeScreenApp(page, { standalone: true });
    await page.goto('/grapher.html');
    await page.evaluate(() => {
      const g = (window as any).fluxGrapherPage.instance;
      const t = g.doc.items[0];
      t.rows = [['1', '2'], ['2', '4.1'], ['3', '5.9'], ['', '']];
      g.doc.title = 'Phone print';
      g.renderItems(); g.draw();
    });
    await expect(page.locator('#ghPrint')).toBeVisible();
    await page.locator('#ghPrint').tap();
    await expect(page.locator('.flg-pm-share')).toContainText('Share menu');
    await page.locator('[data-pmono="1"]').tap();
    await page.waitForTimeout(500);
    await page.locator('[data-pgo]').tap();
    await expect.poll(() => page.evaluate(() => (window as any).__shared.length)).toBe(1);
    const shared = await page.evaluate(() => (window as any).__shared[0]);
    expect(shared.title).toBe('Phone print');
    expect(shared.files[0]).toMatchObject({ name: 'phone-print.png', type: 'image/png' });
    expect(shared.files[0].size).toBeGreaterThan(10_000);
    expect(await page.evaluate(() => (window as any).__printed), 'print() does nothing in a home-screen app').toBe(0);
  });

  test('periodic table, home-screen app: Print sends the drawn table to the Share sheet', async ({ page }) => {
    await asHomeScreenApp(page, { standalone: true });
    await page.goto('/periodic.html');
    await page.locator('#ptPrint').tap();
    await expect(page.locator('#ptPrintMenu .pmenu-note')).toContainText('Share menu');
    await page.waitForTimeout(500);
    await page.locator('#ptPrintGo').tap();
    await expect.poll(() => page.evaluate(() => (window as any).__shared.length)).toBe(1);
    const shared = await page.evaluate(() => (window as any).__shared[0]);
    expect(shared.files[0]).toMatchObject({ name: 'periodic-table.png', type: 'image/png' });
    expect(shared.files[0].size).toBeGreaterThan(100_000);
    expect(await page.evaluate(() => (window as any).__printed)).toBe(0);
  });

  test('in the phone\'s browser itself, Print still prints', async ({ page }) => {
    await asHomeScreenApp(page, { standalone: false });
    await page.goto('/periodic.html');
    await page.locator('#ptPrint').tap();
    await expect(page.locator('#ptPrintMenu .pmenu-note')).toHaveCount(0);
    await page.locator('#ptPrintGo').tap();
    await expect.poll(() => page.evaluate(() => (window as any).__printed)).toBe(1);
    expect(await page.evaluate(() => (window as any).__shared.length)).toBe(0);
  });
});
