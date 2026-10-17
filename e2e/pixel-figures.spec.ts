import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/*
 * Flux Pixel: the Maths figures panel and the Vector tool.
 *
 * Teachers make printable figures for tests (a triangle by its sides, a
 * coordinate grid with a line on it, a cylinder with its hidden edge
 * dashed) and physics classes add vectors tip to tail for a lab. These go
 * through the page the way a teacher would: the panel, the form, the
 * preview, Insert, and then the figure as an ordinary item on the page.
 */

const docs = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem('flux_pixel_docs_v1') || '{"docs":[]}').docs);
const items = async (page: Page) => (await docs(page))[0]?.items || [];
type Box = { x: number; y: number; width: number; height: number };
const at = (box: Box, x: number, y: number): [number, number] => [box.x + (x * box.width) / 1600, box.y + (y * box.height) / 1000];

async function newPage(page: Page, bg = 'grid') {
  await page.setViewportSize({ width: 1366, height: 860 });
  await page.goto('/pixel.html');
  await page.locator(`[data-new="${bg}"]`).click();
  await expect(page.locator('#pxSvg')).toBeVisible();
  return (await page.locator('#pxSvg').boundingBox())!;
}
const dlg = (page: Page) => page.locator('dialog.px-fig');
async function openPanel(page: Page, kind: string) {
  await page.locator('[data-tool="figure"]').click();
  await expect(dlg(page)).toBeVisible();
  await dlg(page).locator(`input[name="pxFigKind"][value="${kind}"]`).check();
}
async function drag(page: Page, box: Box, from: [number, number], to: [number, number]) {
  await page.mouse.move(...at(box, ...from));
  await page.mouse.down();
  await page.mouse.move(...at(box, ...to), { steps: 10 });
  await page.mouse.up();
}

test.describe('Flux Pixel: maths figures', () => {
  test('a 3-4-5 triangle: preview, Insert, move, undo, and it exports', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    const box = await newPage(page);
    await openPanel(page, 'triangle');
    await dlg(page).getByLabel('Make it from').selectOption('sss');
    await dlg(page).getByLabel('Side AB', { exact: true }).fill('5');
    await dlg(page).getByLabel('Side BC', { exact: true }).fill('3');
    await dlg(page).getByLabel('Side CA', { exact: true }).fill('4');
    await expect(page.locator('#pxFigPrev')).toHaveAttribute('aria-label', /Triangle with sides 5, 3 and 4 cm \(right-angled\)/);
    await expect(page.locator('#pxFigPrev svg text')).toContainText(['5 cm']);
    // The worked-out angle shows as a placeholder, ready to be replaced.
    await expect(dlg(page).getByLabel('Label in angle A')).toHaveAttribute('placeholder', /36\.9°/);
    await dlg(page).getByLabel('Label on AB').fill('x + 2');
    await dlg(page).getByRole('button', { name: 'Insert' }).click();
    await expect(dlg(page)).toBeHidden();
    await page.waitForTimeout(500);
    let saved = await items(page);
    expect(saved).toHaveLength(1);
    expect(saved[0].type).toBe('figure');
    expect(saved[0].fig).toMatchObject({ kind: 'triangle', method: 'sss', a: 3, b: 4, c: 5, sAB: 'x + 2' });
    await expect(page.locator('#pxItems')).toContainText('+ 2');
    const before = saved[0];

    // It is an item like any other: drag it, and undo puts it back.
    const cx = before.x + before.w / 2, cy = before.y + before.h / 2;
    await drag(page, box, [cx, cy], [cx + 200, cy + 60]);
    await page.waitForTimeout(500);
    saved = await items(page);
    expect(saved[0].x).toBeGreaterThan(before.x + 150);
    expect(saved[0].w).toBeCloseTo(before.w, 3);
    await page.keyboard.press('Control+z');
    await page.waitForTimeout(500);
    expect((await items(page))[0].x).toBeCloseTo(before.x, 3);

    const [svg] = await Promise.all([page.waitForEvent('download'), page.locator('[data-act="svg"]').click()]);
    const text = await (await import('node:fs')).promises.readFile((await svg.path())!, 'utf8');
    expect(text).toContain('4 cm');
    expect(text).toContain('font-style="italic">x</tspan> + 2');
    const [png] = await Promise.all([page.waitForEvent('download'), page.locator('[data-act="png"]').click()]);
    expect(png.suggestedFilename()).toMatch(/\.png$/);
    expect(errors).toEqual([]);
  });

  test('three sides that cannot close are explained, and Insert waits', async ({ page }) => {
    await newPage(page);
    await openPanel(page, 'triangle');
    await dlg(page).getByLabel('Make it from').selectOption('sss');
    await dlg(page).getByLabel('Side AB', { exact: true }).fill('2');
    await dlg(page).getByLabel('Side BC', { exact: true }).fill('3');
    await dlg(page).getByLabel('Side CA', { exact: true }).fill('6');
    await expect(page.locator('#pxFigMsg')).toContainText("Those three sides can't make a triangle: 2 + 3 is not more than 6");
    await expect(dlg(page).getByRole('button', { name: 'Insert' })).toBeDisabled();
    await expect(dlg(page).getByLabel('Side CA', { exact: true })).toHaveAttribute('aria-invalid', 'true');
    await expect(page.locator('#pxFigPrev')).toHaveClass(/is-stale/);
    await dlg(page).getByLabel('Side CA', { exact: true }).fill('4');
    await expect(page.locator('#pxFigMsg')).toHaveText('');
    await expect(dlg(page).getByRole('button', { name: 'Insert' })).toBeEnabled();
  });

  test('an inserted figure opens again for editing, keeps its place, and undo takes the edit back', async ({ page }) => {
    const box = await newPage(page);
    await openPanel(page, 'rect');
    await dlg(page).getByLabel('Width (AB)').fill('8');
    await dlg(page).getByLabel('Height (BC)').fill('5');
    await dlg(page).getByRole('button', { name: 'Insert' }).click();
    await page.waitForTimeout(500);
    const first = (await items(page))[0];
    await page.mouse.dblclick(...at(box, first.x + first.w / 2, first.y + first.h / 2));
    await expect(dlg(page)).toBeVisible();
    await expect(dlg(page).getByRole('button', { name: 'Update figure' })).toBeVisible();
    await expect(dlg(page).getByLabel('Width (AB)')).toHaveValue('8');
    await dlg(page).getByLabel('Height (BC)').fill('8');
    await dlg(page).getByRole('button', { name: 'Update figure' }).click();
    await page.waitForTimeout(500);
    const after = await items(page);
    expect(after).toHaveLength(1);
    expect(after[0].fig.h).toBe(8);
    expect(after[0].x + after[0].w / 2).toBeCloseTo(first.x + first.w / 2, 3);
    expect(after[0].y + after[0].h / 2).toBeCloseTo(first.y + first.h / 2, 3);
    await page.keyboard.press('Control+z');
    await page.waitForTimeout(500);
    expect((await items(page))[0].fig.h).toBe(5);
    // The Edit figure button does the same as the double click.
    await page.locator('[data-tool="select"]').click();
    await page.mouse.click(...at(box, first.x + 4, first.y + first.h / 2));
    await page.locator('[data-act="figedit"]').click();
    await expect(dlg(page).getByLabel('Height (BC)')).toHaveValue('5');
    await page.keyboard.press('Escape');
    await expect(dlg(page)).toBeHidden();
  });

  test('a share link brings the same settings back and puts the figure on a new page', async ({ page, context }) => {
    await newPage(page);
    await openPanel(page, 'triangle');
    await dlg(page).getByLabel('Make it from').selectOption('sas');
    await dlg(page).getByLabel('Side AB', { exact: true }).fill('7');
    await dlg(page).getByLabel('Side CA', { exact: true }).fill('5');
    await dlg(page).getByLabel(/Angle A, between AB and CA/).fill('60');
    await dlg(page).getByRole('button', { name: 'Share link' }).click();
    const link = await page.locator('#pxFigLink').inputValue();
    expect(link).toMatch(/pixel(\.html)?#\/fig\/triangle\?method=sas&b=5&A=60/);

    const other = await context.newPage();
    await other.setViewportSize({ width: 1366, height: 860 });
    await other.goto(link);
    await expect(other.locator('dialog.px-fig')).toBeVisible();
    await expect(other.locator('input[name="pxFigKind"][value="triangle"]')).toBeChecked();
    await expect(other.locator('dialog.px-fig').getByLabel('Make it from')).toHaveValue('sas');
    await expect(other.locator('dialog.px-fig').getByLabel(/Angle A, between/)).toHaveValue('60');
    await other.locator('dialog.px-fig').getByRole('button', { name: 'Insert' }).click();
    await expect(other).toHaveURL(/#\/d\//);
    await expect(other.locator('#pxItems [data-id]')).toHaveCount(1);
    await other.waitForTimeout(500);
    const all = await docs(other);
    const made = all.find((d: any) => d.items.some((i: any) => i.type === 'figure' && i.fig.method === 'sas'));
    expect(made.items[0].fig).toMatchObject({ b: 5, c: 7, A: 60 });
  });

  test('coordinate grid: a line and a point through the shared parser, and mistakes named by line', async ({ page }) => {
    await newPage(page);
    await openPanel(page, 'grid');
    await dlg(page).getByLabel('Lines and curves, one per line').fill('y = 2x + 1');
    await dlg(page).getByLabel('Points and shapes, one per line').fill('A(1, 3)');
    await expect(page.locator('#pxFigPrev polyline[stroke="#2563eb"]')).toHaveCount(1);
    await expect(page.locator('#pxFigPrev svg')).toContainText('y = 2x + 1');
    await expect(page.locator('#pxFigPrev circle')).toHaveCount(1);
    await dlg(page).getByLabel('Lines and curves, one per line').fill('y = 2x + 1\ny = 3x +');
    await expect(page.locator('#pxFigMsg')).toContainText('Line 2 of the equations');
    await dlg(page).getByLabel('Lines and curves, one per line').fill('y = 2x + 1');
    await dlg(page).getByLabel('Start from').selectOption('paper');
    await expect(dlg(page).getByLabel('Axes', { exact: true })).not.toBeChecked();
    await expect(page.locator('#pxFigPrev svg text')).toHaveCount(0);
  });

  test('3D solids draw hidden edges dashed; number lines shade inequalities', async ({ page }) => {
    await newPage(page);
    await openPanel(page, 'solid');
    await dlg(page).getByLabel('Shape').selectOption('cylinder');
    await expect(dlg(page).getByLabel('Radius', { exact: true })).toBeVisible();
    await expect(dlg(page).getByLabel('Length', { exact: true })).toBeHidden();
    await expect(page.locator('#pxFigPrev [stroke-dasharray]')).toHaveCount(1);
    await expect(page.locator('#pxFigPrev')).toHaveAttribute('aria-label', /Cylinder, radius 3 cm, height 3 cm/);
    await dlg(page).getByLabel('Hidden edges').selectOption('hide');
    await expect(page.locator('#pxFigPrev [stroke-dasharray]')).toHaveCount(0);
    await dlg(page).locator('input[name="pxFigKind"][value="numline"]').check();
    await dlg(page).getByLabel('Dots and inequalities, one per line').fill('x > 2');
    await expect(page.locator('#pxFigPrev circle[fill="#ffffff"]')).toHaveCount(1);
    await dlg(page).getByLabel('Dots and inequalities, one per line').fill('x > 9');
    await expect(page.locator('#pxFigMsg')).toContainText('9 is off the number line');
  });

  test('keyboard: M opens the panel, arrows change the figure, Escape closes and focus comes back', async ({ page }) => {
    await newPage(page);
    await page.locator('[data-tool="select"]').focus();
    await page.keyboard.press('m');
    await expect(dlg(page)).toBeVisible();
    const kind = dlg(page).locator('input[name="pxFigKind"]:checked');
    await expect(kind).toBeFocused();
    const was = await kind.getAttribute('value');
    await page.keyboard.press('ArrowRight');
    await expect(dlg(page).locator('input[name="pxFigKind"]:checked')).not.toHaveAttribute('value', was!);
    await page.keyboard.press('Tab');
    await page.keyboard.press('Escape');
    await expect(dlg(page)).toBeHidden();
    await expect(page.locator('[data-tool="select"]')).toBeFocused();
  });

  test('the panel passes axe and fits a 390px phone', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/pixel.html');
    await page.locator('[data-fig-new]').click();
    await expect(dlg(page)).toBeVisible();
    const results = await new AxeBuilder({ page }).include('dialog.px-fig').analyze();
    const bad = results.violations.filter((v) => v.impact === 'critical' || v.impact === 'serious');
    expect(bad, JSON.stringify(bad.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) })), null, 2)).toEqual([]);
    const over = await page.evaluate(() => {
      const d = document.querySelector('dialog.px-fig')!;
      return Math.max(document.documentElement.scrollWidth - document.documentElement.clientWidth, d.getBoundingClientRect().right - window.innerWidth);
    });
    expect(over).toBeLessThanOrEqual(0);
    const insert = dlg(page).getByRole('button', { name: 'Insert' });
    await expect(insert).toBeInViewport();
    const prev = (await page.locator('#pxFigPrev').boundingBox())!;
    expect(prev.height).toBeGreaterThan(150);
    // Insert from the gallery makes a new page with the figure on it.
    await insert.click();
    await expect(page).toHaveURL(/#\/d\//);
    await expect(page.locator('#pxItems [data-id]')).toHaveCount(1);
  });

  test('Copy figure puts a picture on the clipboard', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await newPage(page);
    await openPanel(page, 'reg');
    await dlg(page).getByRole('button', { name: 'Copy figure' }).click();
    await expect(page.locator('.px-toast')).toContainText('Copied');
    const types = await page.evaluate(async () => (await navigator.clipboard.read())[0].types);
    expect(types).toContain('image/png');
  });

  test('the whole-item eraser takes a figure away and undo brings it back', async ({ page }) => {
    const box = await newPage(page);
    await openPanel(page, 'kite');
    await dlg(page).getByRole('button', { name: 'Insert' }).click();
    await page.waitForTimeout(400);
    const k = (await items(page))[0];
    await page.locator('[data-tool="eraser"]').click();
    await page.locator('[data-erase="whole"]').click();
    await page.mouse.click(...at(box, k.x + k.w / 2, k.y + k.h / 2));
    await page.waitForTimeout(500);
    expect(await items(page)).toHaveLength(0);
    await page.keyboard.press('Control+z');
    await page.waitForTimeout(500);
    expect(await items(page)).toHaveLength(1);
  });
});

test.describe('Flux Pixel: vectors', () => {
  test('draw two vectors that snap to the squares, add them tip to tail, and check a measurement', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    const box = await newPage(page);
    await page.locator('[data-tool="vector"]').click();
    await page.getByLabel('Unit', { exact: true }).fill('N');
    await page.getByLabel('Label for the next one').fill('A');
    await drag(page, box, [402, 603], [558, 482]); // snaps to (400, 600) → (560, 480): 4 across, 3 up
    await drag(page, box, [798, 602], [880, 438]); // (800, 600) → (880, 440): 2 across, 4 up
    await page.waitForTimeout(500);
    let saved = await items(page);
    expect(saved.map((i: any) => [i.label, i.x1, i.y1, i.x2, i.y2])).toEqual([['A', 400, 600, 560, 480], ['B', 800, 600, 880, 440]]);
    await expect(page.locator('#pxItems')).toContainText('A = 5.0 N at 36.9°');

    await page.getByRole('button', { name: 'Tip to tail' }).click();
    await page.waitForTimeout(500);
    saved = await items(page);
    const R = saved.find((i: any) => i.role === 'resultant');
    const copy = saved.find((i: any) => i.role === 'copy');
    expect([copy.x1, copy.y1, copy.dash]).toEqual([560, 480, true]);
    expect([R.label, R.x1, R.y1, R.x2, R.y2]).toEqual(['R', 400, 600, 640, 320]);
    await expect(page.locator('#pxItems')).toContainText('R = 9.2 N at 49.4°');

    // The resultant is selected, with its lab check.
    await page.getByLabel('Measured length').fill('9.5');
    await page.getByLabel(/Measured angle/).fill('50');
    await expect(page.locator('#pxLabOut')).toContainText('worked out 9.2 N, you measured 9.5 N, so 3.0% error');
    await expect(page.locator('#pxLabOut')).toContainText('0.6° off (1.2% error)');

    await page.locator('[data-act="undo"]').click();
    await page.waitForTimeout(500);
    expect((await items(page)).length, 'one undo takes the whole addition back').toBe(2);
    expect(errors).toEqual([]);
  });

  test('parallelogram, subtraction and a multiple', async ({ page }) => {
    const box = await newPage(page);
    await page.locator('[data-tool="vector"]').click();
    await page.getByLabel('Label for the next one').fill('A');
    await drag(page, box, [400, 600], [560, 600]); // 4, 0
    await drag(page, box, [400, 600], [400, 480]); // 0, 3
    await page.getByRole('button', { name: 'Parallelogram' }).click();
    await page.waitForTimeout(500);
    let saved = await items(page);
    let R = saved.find((i: any) => i.role === 'resultant');
    expect([R.x2, R.y2]).toEqual([560, 480]);
    expect(saved.filter((i: any) => i.role === 'copy')).toHaveLength(2);
    await page.keyboard.press('Control+z');

    await page.locator('[data-tool="vector"]').click();
    await page.getByRole('button', { name: 'First − second' }).click();
    await page.waitForTimeout(500);
    saved = await items(page);
    R = saved.find((i: any) => i.role === 'resultant');
    expect([R.x1, R.y1, R.x2, R.y2], 'A − B = (4, −3)').toEqual([400, 600, 560, 720]);
    expect(saved.find((i: any) => i.role === 'copy').label).toBe('−B');
    await page.keyboard.press('Control+z');

    await page.locator('[data-tool="vector"]').click();
    await page.locator('[data-vpick]').nth(1).uncheck();
    await page.getByLabel('Multiply by').fill('-2');
    await page.getByRole('button', { name: '× k' }).click();
    await page.waitForTimeout(500);
    const k = (await items(page)).at(-1);
    expect(k.label).toBe('−2A');
    expect(k.x2 - k.x1).toBe(-320);
  });

  test('type a vector exactly; components and a bearing; the eraser and export see it', async ({ page }) => {
    const box = await newPage(page);
    await page.locator('[data-tool="vector"]').click();
    await page.getByLabel('Direction as').selectOption('bearing');
    await page.getByLabel('Length', { exact: true }).fill('5');
    await page.getByLabel('Bearing (°)').fill('053.13');
    await page.getByRole('button', { name: /Add vector/ }).click();
    await page.waitForTimeout(500);
    const v = (await items(page))[0];
    expect((v.x2 - v.x1) / 40).toBeCloseTo(4, 3);
    expect((v.y1 - v.y2) / 40).toBeCloseTo(3, 3);
    await expect(page.locator('#pxItems')).toContainText('bearing 053.1°');

    await page.locator('[data-tool="select"]').click();
    await page.mouse.click(...at(box, (v.x1 + v.x2) / 2, (v.y1 + v.y2) / 2));
    await page.locator('[data-vtog="comps"]').click();
    await expect(page.locator('#pxItems [stroke-dasharray]')).toHaveCount(2);
    await expect(page.locator('#pxItems')).toContainText('= 4.0');
    await page.getByLabel('x component').fill('6');
    await page.getByLabel('x component').press('Enter');
    await page.waitForTimeout(500);
    expect(((await items(page))[0].x2 - v.x1) / 40).toBeCloseTo(6, 6);

    const [svg] = await Promise.all([page.waitForEvent('download'), page.locator('[data-act="svg"]').click()]);
    const text = await (await import('node:fs')).promises.readFile((await svg.path())!, 'utf8');
    expect(text).toContain('<polygon');

    await page.locator('[data-tool="eraser"]').click();
    await page.locator('[data-erase="whole"]').click();
    const now = (await items(page))[0];
    await page.mouse.click(...at(box, (now.x1 * 3 + now.x2) / 4, (now.y1 * 3 + now.y2) / 4));
    await page.waitForTimeout(500);
    expect(await items(page)).toHaveLength(0);
  });

  test('on a coordinate grid a vector snaps to the grid and reads its numbers', async ({ page }) => {
    const box = await newPage(page, 'plain');
    await openPanel(page, 'grid');
    await dlg(page).getByLabel('Start from').selectOption('small');
    await dlg(page).getByRole('button', { name: 'Insert' }).click();
    await page.waitForTimeout(400);
    const g = (await items(page))[0];
    // where (0, 0) and (3, 2) are on the page, from the grid's own layout
    const map = await page.evaluate((g) => {
      const b = (window as any).FluxFigures.build(g.fig), vb = b.vb, k = Math.min(g.w / vb[2], g.h / vb[3]);
      const ox = g.x + (g.w - vb[2] * k) / 2, oy = g.y + (g.h - vb[3] * k) / 2, G = b.info.grid;
      const pg = (x: number, y: number) => [ox + ((x - G.x0) / G.dx * G.cell - vb[0]) * k, oy + (-(y - G.y0) / G.dy * G.cell - vb[1]) * k];
      return { o: pg(0, 0), p: pg(3, 2), unit: G.cell * k };
    }, g);
    await page.locator('[data-tool="vector"]').click();
    await drag(page, box, [map.o[0] + 4, map.o[1] - 3], [map.p[0] - 5, map.p[1] + 4]);
    await page.waitForTimeout(500);
    const v = (await items(page))[1];
    expect(v.type).toBe('vector');
    expect(v.x1).toBeCloseTo(map.o[0], 3);
    expect(v.sx).toBeCloseTo(map.unit, 3);
    expect((v.x2 - v.x1) / v.sx).toBeCloseTo(3, 6);
    expect((v.y1 - v.y2) / v.sy).toBeCloseTo(2, 6);
  });
});
