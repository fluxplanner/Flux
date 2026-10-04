import { test, expect } from '@playwright/test';

/*
 * Flux Pixel (pixel.html): drawing and labelled diagrams on their own page.
 * These draw with a real mouse, the way a student would.
 */

const items = (page: import('@playwright/test').Page) =>
  page.evaluate(() => JSON.parse(localStorage.getItem('flux_pixel_docs_v1') || '{"docs":[]}').docs[0]?.items || []);

async function newPage(page: import('@playwright/test').Page) {
  await page.setViewportSize({ width: 1366, height: 860 });
  await page.goto('/pixel.html');
  await page.locator('[data-new="grid"]').click();
  await expect(page.locator('#pxSvg')).toBeVisible();
  return (await page.locator('#pxSvg').boundingBox())!;
}

test.describe('Flux Pixel', () => {
  test('draws with the pen, shapes, a label and a stamp, and saves it', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    const box = await newPage(page);

    await page.locator('[data-tool="pen"]').click();
    await page.mouse.move(box.x + 100, box.y + 300);
    await page.mouse.down();
    for (let i = 1; i <= 10; i++) await page.mouse.move(box.x + 100 + i * 12, box.y + 300 + (i % 2) * 15);
    await page.mouse.up();

    await page.locator('[data-tool="rect"]').click();
    await page.mouse.move(box.x + 200, box.y + 100);
    await page.mouse.down();
    await page.mouse.move(box.x + 320, box.y + 180);
    await page.mouse.up();

    await page.locator('[data-tool="label"]').click();
    await page.mouse.move(box.x + 250, box.y + 140);
    await page.mouse.down();
    await page.mouse.move(box.x + 400, box.y + 90);
    await page.mouse.up();
    await expect(page.locator('#pxText')).toBeFocused();
    await page.keyboard.type('Nucleus');
    await page.keyboard.press('Enter');

    await page.locator('[data-tool="stamp"]').click();
    await page.locator('[data-stamp="resistor"]').click();
    await page.mouse.click(box.x + 500, box.y + 300);

    await page.waitForTimeout(500);
    const saved = await items(page);
    expect(saved.map((i: any) => i.type)).toEqual(['pen', 'rect', 'label', 'stamp']);
    expect(saved[2].text).toBe('Nucleus');
    await expect(page.locator('#pxItems text')).toContainText('Nucleus');
    expect(errors).toEqual([]);
  });

  test('the stamp list stays open while placing stamp after stamp', async ({ page }) => {
    const box = await newPage(page);
    await page.locator('[data-tool="stamp"]').click();
    for (const [i, id] of ['resistor', 'flask', 'beaker', 'resistor'].entries()) {
      await page.locator(`[data-stamp="${id}"]`).click();
      await page.mouse.click(box.x + 150 + i * 140, box.y + 300);
    }
    await expect(page.locator('[data-stamp="beaker"]')).toBeVisible();
    await page.waitForTimeout(500);
    expect((await items(page)).map((i: any) => i.sid)).toEqual(['resistor', 'flask', 'beaker', 'resistor']);
  });

  test('stamps can be searched by name or group', async ({ page }) => {
    await newPage(page);
    await page.locator('[data-tool="stamp"]').click();
    await page.locator('.px-stamp-q').fill('volc');
    await expect(page.locator('.px-stamp:visible')).toHaveCount(1);
    await expect(page.locator('[data-stamp="volcano"]')).toBeVisible();
    await page.locator('.px-stamp-q').fill('circuits');
    await expect(page.locator('.px-stamp:visible')).toHaveCount(16);
    await page.locator('.px-stamp-q').fill('zzz');
    await expect(page.locator('.px-stamp-none')).toBeVisible();
    await page.locator('.px-stamp-q').fill('');
    await expect(page.locator('.px-stamp:visible')).toHaveCount(88);
  });

  test('select, move, resize and undo', async ({ page }) => {
    const box = await newPage(page);
    await page.locator('[data-tool="rect"]').click();
    await page.mouse.move(box.x + 200, box.y + 200);
    await page.mouse.down();
    await page.mouse.move(box.x + 300, box.y + 260);
    await page.mouse.up();
    await page.waitForTimeout(450);
    const before = (await items(page))[0];

    await page.locator('[data-tool="select"]').click();
    await page.mouse.move(box.x + 200, box.y + 230);
    await page.mouse.down();
    await page.mouse.move(box.x + 260, box.y + 280);
    await page.mouse.up();
    await page.waitForTimeout(450);
    const moved = (await items(page))[0];
    expect(moved.x).toBeGreaterThan(before.x + 20);
    expect(moved.w).toBeCloseTo(before.w, 0);

    const handle = (await page.locator('#pxSel [data-handle]').boundingBox())!;
    await page.mouse.move(handle.x + 9, handle.y + 9);
    await page.mouse.down();
    await page.mouse.move(handle.x + 80, handle.y + 60);
    await page.mouse.up();
    await page.waitForTimeout(450);
    expect((await items(page))[0].w).toBeGreaterThan(moved.w * 1.2);

    await page.keyboard.press('Control+z');
    await page.keyboard.press('Control+z');
    await page.waitForTimeout(450);
    expect((await items(page))[0].x).toBeCloseTo(before.x, 0);

    await page.locator('[data-tool="select"]').click();
    await page.mouse.click(box.x + 200, box.y + 230);
    await page.keyboard.press('Delete');
    await page.waitForTimeout(450);
    expect(await items(page)).toHaveLength(0);
  });

  test('the example opens and exports a PNG and an SVG', async ({ page }) => {
    await page.goto('/pixel.html');
    await page.locator('[data-example]').click();
    await expect(page.locator('#pxItems [data-id]')).toHaveCount(10);
    const [png] = await Promise.all([page.waitForEvent('download'), page.locator('[data-act="png"]').click()]);
    expect(png.suggestedFilename()).toBe('Example-heating-water.png');
    const [svg] = await Promise.all([page.waitForEvent('download'), page.locator('[data-act="svg"]').click()]);
    expect(svg.suggestedFilename()).toBe('Example-heating-water.svg');
    await page.goto('/pixel.html#/');
    await expect(page.locator('.px-card')).toHaveCount(1);
  });

  test('fits a phone without sideways scrolling', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 760 });
    await page.goto('/pixel.html');
    await page.locator('[data-example]').click();
    await page.waitForTimeout(300);
    const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(over).toBeLessThanOrEqual(0);
  });
});
