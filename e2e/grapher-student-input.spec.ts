import { test, expect, type Page } from '@playwright/test';

/**
 * The grapher reads maths the way students write it: |x|, sin x, √x, x²,
 * 2x + 3y = 6, limits written in words, and lab tables pasted from a
 * spreadsheet with a reading missing. Each of these used to be an error, or
 * worse, a silently wrong graph.
 */

async function open(page: Page, mode: 'functions' | 'data') {
  await page.addInitScript((m) => {
    try {
      localStorage.setItem('flux_grapher_tour', 'done');
      localStorage.setItem('flux_grapher_mode', m);
    } catch (e) {}
  }, mode);
  await page.goto('/grapher.html');
  await page.waitForTimeout(700);
  // The grapher always opens on Measurements; go to the tab under test.
  const tabId = ({ functions: '#modeFunctions', '3d': '#mode3d' } as Record<string, string>)[mode || ''];
  if (tabId) { await page.locator(tabId).click(); await page.waitForTimeout(500); }
}

/** The first equation's parsed curve, evaluated at x. */
const valueAt = (page: Page, x: number) => page.evaluate((x) => {
  const g = (window as any).fluxGrapherPage.instance;
  const it = g.doc.items.find((i: any) => i.type === 'expr');
  const p = (window as any).FluxGrapher._test.parseExpr(it.src, g.scope, {});
  return p.kind === 'fn' ? p.fn(x) : p.error || p.kind;
}, x);

test.describe('the grapher reads maths as students write it', () => {
  test('typed in the maths field: |x|, sin x and ln x draw without brackets', async ({ page }) => {
    await open(page, 'functions');
    const row = page.locator('.flg-item--expr').first();
    await expect(row).toHaveClass(/has-mq/);
    for (const [typed, x, want] of [['y=|x-2|', -1, 3], ['y=sin x', Math.PI / 2, 1], ['y=ln x', Math.E, 1]] as const) {
      await row.locator('.flg-mq').click();
      await page.keyboard.press('ControlOrMeta+a');
      await page.keyboard.press('Backspace');
      await page.keyboard.type(typed);
      await expect(row.locator('.flg-err'), typed).toHaveCount(0);
      expect(await valueAt(page, x), typed).toBeCloseTo(want, 9);
    }
  });

  test('pasted text: x², √x, a real minus and limits in words', async ({ page }) => {
    await open(page, 'functions');
    const box = page.locator('.flg-expr').first();
    for (const [src, x, want] of [['y = x² − 4', 3, 5], ['y = 2√x', 9, 6], ['y = 2πx', 1, 2 * Math.PI]] as const) {
      await box.fill(src);
      await page.waitForTimeout(200);
      await expect(page.locator('.flg-err'), src).toHaveCount(0);
      expect(await valueAt(page, x), src).toBeCloseTo(want, 9);
    }
    await box.fill('y = x^2 for 0 < x < 3');
    await page.waitForTimeout(200);
    await expect(page.locator('.flg-err')).toHaveCount(0);
    expect(await valueAt(page, 2)).toBe(4);
    expect(await valueAt(page, -1)).toBeNaN();
  });

  test('2x + 3y = 6 is a line with intercepts, not just an outline', async ({ page }) => {
    await open(page, 'functions');
    const box = page.locator('.flg-expr').first();
    await box.fill('2x + 3y = 6');
    await box.focus();
    await page.waitForTimeout(300);
    await expect(page.locator('.flg-err')).toHaveCount(0);
    const kp = await page.evaluate(() => {
      const i = (window as any).fluxGrapherPage.instance;
      return i.keyPointsFor(i._last.v).map((p: any) => [+p.x.toFixed(6), +p.y.toFixed(6)]);
    });
    expect(kp).toContainEqual([3, 0]);
    expect(kp).toContainEqual([0, 2]);
  });

  test('a lab table pasted with headings and a missing reading keeps every reading in its column', async ({ page }) => {
    await open(page, 'data');
    const first = page.locator('.flg-item--table').first().locator('[data-cell="0:0"]');
    await first.focus();
    await first.evaluate((el) => {
      const dt = new DataTransfer();
      dt.setData('text/plain', 'Time (s)\tDistance (m)\n1\t2,1\n2\t\n3\t6.2\n');
      el.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
    });
    await page.waitForTimeout(250);
    const t = await page.evaluate(() => {
      const g = (window as any).fluxGrapherPage.instance;
      const tb = g.doc.items.find((i: any) => i.type === 'table');
      return { names: tb.cols.map((c: any) => [c.name, c.unit]), rows: tb.rows.slice(0, 3) };
    });
    expect(t.names).toEqual([['Time', 's'], ['Distance', 'm']]);
    expect(t.rows).toEqual([['1', '2.1'], ['2', ''], ['3', '6.2']]);
  });
});
