import { test, expect } from '@playwright/test';

/*
 * Flux Pixel's whiteboard tools: sticky notes, shape snap, zoom round the
 * pointer, the hand tool, the laser pointer and Present. Drawn with a real
 * mouse, the way a student would.
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

async function stroke(page: import('@playwright/test').Page, pts: [number, number][]) {
  await page.mouse.move(pts[0][0], pts[0][1]);
  await page.mouse.down();
  for (const p of pts.slice(1)) await page.mouse.move(p[0], p[1]);
  await page.mouse.up();
}

test.describe('Flux Pixel whiteboard', () => {
  test('a sticky note: placed, written on, recoloured and edited again', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    const box = await newPage(page);
    await page.keyboard.press('n');
    await expect(page.locator('[data-tool="note"]')).toHaveAttribute('aria-pressed', 'true');
    await page.mouse.click(box.x + 300, box.y + 200);
    await expect(page.locator('#pxText')).toBeFocused();
    await page.keyboard.type('Revise osmosis before Friday');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);
    let saved = await items(page);
    expect(saved).toHaveLength(1);
    expect(saved[0]).toMatchObject({ type: 'note', text: 'Revise osmosis before Friday', bg: '#fef08a' });
    await expect(page.locator('#pxItems text')).toContainText('osmosis');

    await page.locator('[data-notebg="#bfdbfe"]').click();
    await page.waitForTimeout(500);
    saved = await items(page);
    expect(saved[0].bg).toBe('#bfdbfe');

    await page.locator('[data-tool="select"]').click();
    await page.mouse.dblclick(box.x + 300, box.y + 200);
    await expect(page.locator('#pxText')).toHaveValue('Revise osmosis before Friday');
    await expect(page.locator('#pxText')).toBeFocused();
    await page.keyboard.press('End');
    await page.keyboard.type('!');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);
    expect((await items(page))[0].text).toBe('Revise osmosis before Friday!');
    expect(errors).toEqual([]);
  });

  test('a long note wraps inside the note and shrinks to fit', async ({ page }) => {
    await newPage(page);
    const fit = await page.evaluate(() => {
      const lines = (window as any).FluxPixel._wrapText('The mitochondria is the powerhouse of the cell and makes ATP', 188, 26);
      return { lines: lines.length, widest: Math.max(...lines.map((l: string) => l.length)) };
    });
    expect(fit.lines).toBeGreaterThan(1);
    expect(fit.widest).toBeLessThan(25);
  });

  test('shape snap tidies a rough circle and a wobbly line; undo keeps the stroke; it can be turned off', async ({ page }) => {
    const box = await newPage(page);
    await page.locator('[data-tool="pen"]').click();
    const cx = box.x + 400, cy = box.y + 260, pts: [number, number][] = [];
    for (let i = 0; i <= 36; i++) {
      const a = (i / 36) * Math.PI * 2, r = 80 + (i % 3) * 3;
      pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
    }
    await stroke(page, pts);
    await page.waitForTimeout(500);
    expect((await items(page)).map((i: any) => i.type)).toEqual(['ellipse']);
    await expect(page.getByRole('status').filter({ hasText: 'Tidied into a circle' })).toBeVisible();

    await page.keyboard.press('Control+z');
    await page.waitForTimeout(500);
    expect((await items(page)).map((i: any) => i.type)).toEqual(['pen']);

    const line: [number, number][] = [];
    for (let i = 0; i <= 20; i++) line.push([box.x + 100 + i * 15, box.y + 500 + (i % 2) * 2]);
    await stroke(page, line);
    await page.waitForTimeout(500);
    expect((await items(page)).map((i: any) => i.type)).toEqual(['pen', 'line']);

    await page.locator('[data-act="snap"]').click();
    await expect(page.locator('[data-act="snap"]')).toHaveAttribute('aria-pressed', 'false');
    await stroke(page, pts.map(([x, y]) => [x + 300, y] as [number, number]));
    await page.waitForTimeout(500);
    expect((await items(page)).map((i: any) => i.type)).toEqual(['pen', 'line', 'pen']);
  });

  test('the recogniser knows a box and a triangle, and leaves a scribble alone', async ({ page }) => {
    await newPage(page);
    const kinds = await page.evaluate(() => {
      const R = (window as any).FluxPixel._recognise;
      const path = (corners: number[][], n = 12) => {
        const out: number[][] = [];
        for (let k = 0; k < corners.length; k++) {
          const a = corners[k], b = corners[(k + 1) % corners.length];
          for (let i = 0; i < n; i++) out.push([a[0] + (b[0] - a[0]) * i / n + (i % 2), a[1] + (b[1] - a[1]) * i / n]);
        }
        out.push([corners[0][0] + 3, corners[0][1] + 2]);
        return out;
      };
      const scribble = [[0, 0], [40, 30], [10, 60], [70, 20], [20, 90], [90, 70], [30, 10], [100, 100]];
      return [R(path([[100, 100], [400, 100], [400, 300], [100, 300]]))?.kind, R(path([[100, 300], [250, 60], [400, 300]]))?.kind, R(scribble)?.kind ?? null];
    });
    expect(kinds).toEqual(['box', 'triangle', null]);
  });

  test('Ctrl+scroll zooms round the pointer, the hand tool and Space move the view', async ({ page }) => {
    const box = await newPage(page);
    const zoomText = page.locator('.px-zoom-v');
    await expect(zoomText).toHaveText('100%');
    await page.mouse.move(box.x + 200, box.y + 150);
    await page.keyboard.down('Control');
    await page.mouse.wheel(0, -400);
    await page.keyboard.up('Control');
    await expect.poll(async () => parseInt((await zoomText.textContent()) || '0', 10)).toBeGreaterThan(150);
    const scroll = () => page.locator('#pxStage').evaluate((el) => [el.scrollLeft, el.scrollTop]);
    // The point under the pointer stayed put, so the view scrolled towards it.
    const [sl0, st0] = await scroll();
    expect(sl0 + st0).toBeGreaterThan(0);

    await page.keyboard.press('g');
    await stroke(page, [[box.x + 600, box.y + 400], [box.x + 500, box.y + 330], [box.x + 400, box.y + 300]]);
    const [sl1, st1] = await scroll();
    expect(sl1).toBeGreaterThan(sl0);
    expect(st1).toBeGreaterThan(st0);
    expect(await items(page)).toEqual([]);

    await page.keyboard.press('p');
    await page.keyboard.down(' ');
    await stroke(page, [[box.x + 400, box.y + 300], [box.x + 500, box.y + 400]]);
    await page.keyboard.up(' ');
    const [sl2] = await scroll();
    expect(sl2).toBeLessThan(sl1);
    expect(await items(page)).toEqual([]);

    await page.keyboard.press('Control+0');
    await expect(zoomText).toHaveText('100%');
  });

  test('the laser leaves a trail that is never saved; Present fills the screen and Esc leaves', async ({ page }) => {
    const box = await newPage(page);
    await page.keyboard.press('x');
    await page.mouse.move(box.x + 200, box.y + 200);
    await page.mouse.down();
    await page.mouse.move(box.x + 260, box.y + 240);
    await page.mouse.move(box.x + 320, box.y + 260);
    await expect(page.locator('#pxLaser line').first()).toBeAttached();
    await page.mouse.up();
    await page.waitForTimeout(500);
    expect(await items(page)).toEqual([]);

    await page.locator('[data-act="present"]').first().click();
    await expect(page.locator('.px-editor')).toHaveClass(/is-present/);
    await expect(page.locator('.px-top')).toBeHidden();
    await expect(page.locator('[data-tool="laser"]')).toHaveAttribute('aria-pressed', 'true');
    await page.locator('.px-present-exit').click();
    await expect(page.locator('.px-editor')).not.toHaveClass(/is-present/);
    await expect(page.locator('.px-top')).toBeVisible();
  });
});
