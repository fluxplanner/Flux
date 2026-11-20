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
  // These rub out pen strokes; a dead-straight stroke would otherwise be tidied into a line by shape snap.
  test.beforeEach(async ({ page }) => { await page.addInitScript(() => localStorage.setItem('flux_pixel_snap', '0')); });
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

/*
 * "Add ruler, protractor, set square/compass-style tools that sit on the
 * canvas and snap." They sit on the page, move and turn, guide the pen and
 * the line, and are never part of the picture.
 */
test.describe('Flux Pixel: ruler, protractor, set square and compass', () => {
  type Box = { x: number; y: number; width: number; height: number };
  const at = (box: Box, x: number, y: number): [number, number] => [box.x + (x * box.width) / 1600, box.y + (y * box.height) / 1000];
  async function drag(page: import('@playwright/test').Page, box: Box, from: [number, number], to: [number, number]) {
    await page.mouse.move(...at(box, ...from));
    await page.mouse.down();
    await page.mouse.move(...at(box, ...to), { steps: 10 });
    await page.mouse.up();
  }

  test('a line started on the ruler runs along it, with its length in cm while it is drawn', async ({ page }) => {
    const box = await newPage(page);
    await page.locator('[data-inst-toggle="ruler"]').click();
    await expect(page.locator('#pxInst [data-inst="ruler"]')).toHaveCount(1);
    // The ruler's edge starts at (200, 730) on the page.
    await page.locator('[data-tool="line"]').click();
    await page.mouse.move(...at(box, 300, 734));
    await page.mouse.down();
    await page.mouse.move(...at(box, 500, 760), { steps: 8 });
    await expect(page.locator('#pxDraft')).toContainText('cm');
    await page.mouse.move(...at(box, 620, 772), { steps: 4 });
    await page.mouse.up();
    await expect.poll(async () => (await items(page)).length).toBe(1);
    const ln = (await items(page))[0];
    expect(ln.y1).toBeCloseTo(730, 0);
    expect(ln.y2).toBeCloseTo(730, 0);
    expect(ln.x2 - ln.x1).toBeGreaterThan(250);
    expect(await page.evaluate(() => JSON.stringify(JSON.parse(localStorage.getItem('flux_pixel_docs_v1')!).docs[0].items))).not.toContain('ruler');
  });

  test('a line from the protractor centre lands on a whole degree', async ({ page }) => {
    const box = await newPage(page);
    await page.locator('[data-inst-toggle="protractor"]').click();
    await page.locator('[data-tool="line"]').click();
    // Centre at (1200, 730). Aim at about 35°, a little off.
    const a = 35.4 * Math.PI / 180;
    await drag(page, box, [1203, 728], [1200 + 200 * Math.cos(a), 730 - 200 * Math.sin(a)]);
    await expect.poll(async () => (await items(page)).length).toBe(1);
    const ln = (await items(page))[0];
    expect(ln.x1).toBeCloseTo(1200, 0);
    expect(ln.y1).toBeCloseTo(730, 0);
    const deg = Math.atan2(ln.y1 - ln.y2, ln.x2 - ln.x1) * 180 / Math.PI;
    expect(deg).toBeCloseTo(35, 3);
  });

  test('instruments move by their body and turn by their handle, and stay with the drawing', async ({ page }) => {
    const box = await newPage(page);
    await page.locator('[data-inst-toggle="square"]').click();
    await page.locator('[data-tool="select"]').click();
    // Drag the set square by its body.
    await drag(page, box, [380, 600], [480, 560]);
    const inst = () => page.evaluate(() => JSON.parse(localStorage.getItem('flux_pixel_docs_v1')!).docs[0].inst?.square);
    await expect.poll(async () => (await inst())?.x).toBeGreaterThan(300);
    const moved = await inst();
    expect(moved.x).toBeCloseTo(380, -1);
    expect(moved.y).toBeCloseTo(610, -1);
    // Turn it by the round handle.
    const h = (await page.locator('#pxInst [data-inst="square"] [data-inst-rot]').boundingBox())!;
    await page.mouse.move(h.x + h.width / 2, h.y + h.height / 2);
    await page.mouse.down();
    await page.mouse.move(h.x + h.width / 2 + 60, h.y + h.height / 2 + 80, { steps: 8 });
    await page.mouse.up();
    await expect.poll(async () => (await inst())?.rot).not.toBe(0);
    const turned = await inst();
    expect(Number.isInteger(turned.rot)).toBe(true);
    // 30° 60° shape from the options, and it is still there after a reload.
    await page.locator('[data-sqkind="30"]').click();
    await page.reload();
    await expect(page.locator('#pxInst [data-inst="square"]')).toHaveCount(1);
    await expect(page.locator('[data-sqkind="30"]')).toHaveAttribute('aria-pressed', 'true');
    // Never in the picture.
    expect(await items(page)).toHaveLength(0);
  });

  test('the ruler and protractor can be resized, and a turn near level snaps to 0°', async ({ page }) => {
    await newPage(page);
    await page.locator('[data-inst-toggle="ruler"]').click();
    await page.locator('[data-inst-toggle="protractor"]').click();
    await page.locator('[data-tool="select"]').click();
    const doc = () => page.evaluate(() => JSON.parse(localStorage.getItem('flux_pixel_docs_v1')!).docs[0].inst);
    await page.locator('[data-inst-size="ruler"]').fill('25');
    await page.locator('[data-inst-size="protractor"]').fill('8');
    await expect(page.locator('[data-inst-size-out="ruler"]')).toHaveText('25 cm');
    await expect(page.locator('#pxInst [data-inst="ruler"] text', { hasText: /^25$/ })).toHaveCount(1);
    await expect.poll(async () => (await doc())?.ruler?.len).toBe(25);
    expect((await doc()).protractor.rcm).toBe(8);
    // A small turn is put back level; a bigger one stays.
    const h = (await page.locator('#pxInst [data-inst="ruler"] [data-inst-rot]').boundingBox())!;
    const hx = h.x + h.width / 2, hy = h.y + h.height / 2;
    const turn = async (dy: number) => {
      await page.mouse.move(hx, hy);
      await page.mouse.down();
      await page.mouse.move(hx, hy + dy, { steps: 6 });
      await page.mouse.up();
    };
    await turn(12);
    await expect.poll(async () => (await doc())?.ruler?.rot).toBe(0);
    await turn(120);
    await expect.poll(async () => (await doc())?.ruler?.rot).toBeGreaterThan(4);
    await page.reload();
    await expect(page.locator('[data-inst-size="ruler"]')).toHaveValue('25');
  });

  test('the compass draws a circle of a whole number of millimetres, and an arc round the same point', async ({ page }) => {
    const box = await newPage(page);
    await page.keyboard.press('k');
    await expect(page.locator('[data-tool="compass"]')).toHaveAttribute('aria-pressed', 'true');
    await drag(page, box, [800, 400], [921, 401]);
    await expect.poll(async () => (await items(page)).length).toBe(1);
    const c = (await items(page))[0];
    expect(c.type).toBe('ellipse');
    expect(c.w).toBe(c.h);
    expect((c.w / 2) % 4).toBeCloseTo(0, 6);     // whole millimetres: 1 mm is 4 page units
    expect(c.x + c.w / 2).toBeCloseTo(800, 0);
    // Arc: the point lands on the circle's centre (a point nearby), drag the radius, move round, press.
    await page.locator('[data-compass="arc"]').click();
    await drag(page, box, [803, 402], [880, 400]);
    await page.mouse.move(...at(box, 800, 480), { steps: 6 });
    await page.mouse.down(); await page.mouse.up();
    await expect.poll(async () => (await items(page)).length).toBe(2);
    const arc = (await items(page))[1];
    expect(arc.type).toBe('pen');
    const r = (p: number[]) => Math.hypot(p[0] - 800, p[1] - 400);
    expect(r(arc.pts[0])).toBeCloseTo(80, 0);
    expect(r(arc.pts[arc.pts.length - 1])).toBeCloseTo(80, 0);
  });
});
