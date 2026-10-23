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

    const handle = (await page.locator('#pxSel [data-handle="se"]').boundingBox())!;
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

/*
 * Teachers asked for more than one eraser: "drag and create a box to erase"
 * and a "circle eraser as well as [the] line eraser". Whole item takes away
 * anything it touches (the old eraser); Circle and Box rub out only the part
 * under them, as holes that stay with the item when it moves.
 */
test.describe('Flux Pixel: the eraser', () => {
  type Box = { x: number; y: number; width: number; height: number };
  const at = (box: Box, x: number, y: number): [number, number] => [box.x + (x * box.width) / 1600, box.y + (y * box.height) / 1000];
  async function stroke(page: import('@playwright/test').Page, box: Box, y: number) {
    await page.locator('[data-tool="pen"]').click();
    await page.mouse.move(...at(box, 200, y));
    await page.mouse.down();
    for (let x = 220; x <= 1000; x += 20) await page.mouse.move(...at(box, x, y));
    await page.mouse.up();
  }
  async function drag(page: import('@playwright/test').Page, box: Box, from: [number, number], to: [number, number]) {
    await page.mouse.move(...at(box, ...from));
    await page.mouse.down();
    await page.mouse.move(...at(box, ...to), { steps: 12 });
    await page.mouse.up();
  }
  /** What the page shows at these page points: true where there is ink. */
  const inked = (page: import('@playwright/test').Page, pts: [number, number][]) => page.evaluate(async (pts) => {
    const svg = document.getElementById('pxSvg')!;
    const img = new Image();
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(new XMLSerializer().serializeToString(svg));
    await img.decode();
    const c = document.createElement('canvas'); c.width = 1600; c.height = 1000;
    const g = c.getContext('2d')!; g.drawImage(img, 0, 0, 1600, 1000);
    return pts.map(([x, y]) => g.getImageData(x, y, 1, 1).data[0] < 128);
  }, pts);

  test('Circle rubs out only what it passes over, the gap moves with the line, and undo brings it back', async ({ page }) => {
    const box = await newPage(page);
    await stroke(page, box, 300);
    await page.locator('[data-tool="eraser"]').click();
    await page.locator('[data-erase="circle"]').click();
    await expect(page.locator('[data-erase-size]')).toBeVisible();
    await drag(page, box, [600, 200], [600, 400]);
    await page.waitForTimeout(450);
    expect(await inked(page, [[400, 300], [600, 300], [800, 300]])).toEqual([true, false, true]);
    expect((await items(page)).length, 'the line itself is kept').toBe(1);

    await page.locator('[data-tool="select"]').click();
    await drag(page, box, [800, 300], [800, 450]);
    await page.waitForTimeout(450);
    expect(await inked(page, [[800, 450], [600, 450], [400, 450]]), 'the gap travelled with the line').toEqual([true, false, true]);

    await page.keyboard.press('Control+z');
    await page.keyboard.press('Control+z');
    await page.waitForTimeout(450);
    expect(await inked(page, [[400, 300], [600, 300], [800, 300]])).toEqual([true, true, true]);
    // The SVG export carries the same picture.
    const svg = await page.evaluate(() => (window as any).FluxPixel._docSVG({ bg: 'plain', items: [{ id: 'a', type: 'line', x1: 0, y1: 0, x2: 100, y2: 0, width: 3, color: '#111827', cuts: [{ r: 10, pts: [[50, 0]] }] }] }));
    expect(svg).toContain('<mask');
  });

  test('Box: what lies inside goes, what crosses the edge loses the part inside', async ({ page }) => {
    const box = await newPage(page);
    await stroke(page, box, 300);
    await stroke(page, box, 600);
    await page.locator('[data-tool="eraser"]').click();
    await page.locator('[data-erase="box"]').click();
    await expect(page.locator('[data-erase-size]')).toHaveCount(0);
    await drag(page, box, [150, 250], [450, 350]);
    await page.waitForTimeout(450);
    expect(await inked(page, [[300, 300], [700, 300]])).toEqual([false, true]);
    await drag(page, box, [150, 550], [1050, 650]);
    await page.waitForTimeout(450);
    expect((await items(page)).length, 'the line wholly inside the box is gone').toBe(1);
    expect(await inked(page, [[600, 600]])).toEqual([false]);
  });

  test('Circle across a whole short line removes it; Whole item still takes the lot; the choice is remembered', async ({ page }) => {
    const box = await newPage(page);
    await page.locator('[data-tool="line"]').click();
    await drag(page, box, [500, 500], [540, 500]);
    await stroke(page, box, 300);
    await page.waitForTimeout(450);
    expect((await items(page)).length).toBe(2);
    await page.locator('[data-tool="eraser"]').click();
    await page.locator('[data-erase="circle"]').click();
    await page.locator('[data-erase-size]').fill('40');
    await drag(page, box, [480, 500], [560, 500]);
    await page.waitForTimeout(450);
    expect((await items(page)).map((i: any) => i.type), 'a line with nothing left showing is removed').toEqual(['pen']);

    await page.locator('[data-erase="whole"]').click();
    await page.mouse.click(...at(box, 600, 300));
    await page.waitForTimeout(450);
    expect(await items(page)).toEqual([]);

    await page.locator('[data-erase="box"]').click();
    await page.reload();
    await page.locator('[data-tool="eraser"]').click();
    await expect(page.locator('[data-erase="box"]')).toHaveAttribute('aria-pressed', 'true');
  });
});
