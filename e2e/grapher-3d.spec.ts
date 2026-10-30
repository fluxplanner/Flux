import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/**
 * The Grapher's 3D tab — made for a teacher whose CPM lessons use a 3D graph
 * to plot points, graph planes from their intercepts and traces, and solve
 * three equations in three unknowns by seeing where three planes meet.
 *
 * The maths itself is pinned in test/unit/space3d.test.mjs; these check the
 * page: the tab, typing rows, what the rail and the key say, turning and
 * zooming by mouse, keys, buttons and touch, that nearer things cover farther
 * ones, the image, the link, saving (against a stubbed Supabase — no real
 * account is touched), a phone, reduced motion, and that nothing reaches the
 * network on its own.
 */

async function open(page: Page, opts: { mode?: string; hash?: string } = {}) {
  // Seeded once per tab, so a reload shows what the page itself remembered.
  await page.addInitScript(({ mode }) => {
    try {
      if (sessionStorage.getItem('seeded')) return;
      sessionStorage.setItem('seeded', '1');
      localStorage.setItem('flux_grapher_tour', 'done');
      if (mode) localStorage.setItem('flux_grapher_mode', mode);
    } catch (e) {}
  }, { mode: opts.mode === undefined ? '3d' : opts.mode });
  await page.goto('/grapher.html' + (opts.hash || ''));
  await page.waitForTimeout(700);
  // The grapher always opens on Measurements; go to the tab under test.
  const tabId = ({ functions: '#modeFunctions', '3d': '#mode3d' } as Record<string, string>)[(opts.hash ? '' : opts.mode === undefined ? '3d' : opts.mode) || ''];
  if (tabId) { await page.locator(tabId).click(); await page.waitForTimeout(500); }
}

const inst = (page: Page) => page.evaluate(() => (window as any).fluxGrapherPage.instance.kind);
const view = (page: Page) => page.evaluate(() => ({ ...(window as any).fluxGrapherPage.instance.doc.view }));

/** Put rows straight into the graph (the typing itself is tested below). */
async function load(page: Page, rows: Array<string | Record<string, unknown>>) {
  await page.evaluate((rows) => {
    const g = (window as any).fluxGrapherPage.instance;
    g.loadDoc({ items: rows.map((r) => (typeof r === 'string' ? { src: r } : r)) }, null);
  }, rows);
  await page.waitForTimeout(250);
}

/** Type into row i, adding rows as needed. */
async function type(page: Page, i: number, src: string) {
  while (await page.locator('.flg--3d .flg-expr').count() <= i) await page.locator('[data-add]').click();
  await page.locator('.flg--3d .flg-expr').nth(i).fill(src);
  await page.waitForTimeout(150);
}

const key = (page: Page) => page.locator('.fl3-key');

test.describe('Grapher 3D', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
  });

  test('the 3D tab opens the 3D grapher, and a reload goes back to Measurements', async ({ page }) => {
    await open(page, { mode: 'functions' });
    await page.locator('#mode3d').click();
    await expect(page.locator('#mode3d')).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('#modeFunctions')).toHaveAttribute('aria-selected', 'false');
    await expect(page.locator('.flg--3d canvas.fl3-canvas')).toBeVisible();
    const size = await page.locator('.fl3-canvas').evaluate((c: HTMLCanvasElement) => [c.width, c.height]);
    expect(size[0]).toBeGreaterThan(400);
    // It starts with a plane, so there is something to see and turn.
    await expect(page.locator('.fl3-info').first()).toContainText('(6, 0, 0)');
    await page.reload();
    await page.waitForTimeout(700);
    await expect(page.locator('#modeData')).toHaveAttribute('aria-selected', 'true');
    expect(await inst(page)).toBe('data');
    await page.locator('#mode3d').click();
    await page.waitForTimeout(500);
    // The other halves keep working.
    await page.locator('#modeFunctions').click();
    await expect(page.locator('.flg--functions')).toBeVisible();
  });

  test('a plane shows where it crosses the axes, and its traces at the flick of a switch', async ({ page }) => {
    await open(page);
    await type(page, 0, '2x + 3y + 6z = 12');
    const info = page.locator('.flg--3d .fl3-info').first();
    await expect(info).toContainText('(6, 0, 0)');
    await expect(info).toContainText('(0, 4, 0)');
    await expect(info).toContainText('(0, 0, 2)');
    await expect(info).not.toContainText('xy-trace');
    await info.locator('[data-flag="traces"]').click();
    await expect(info.locator('[data-flag="traces"]')).toHaveAttribute('aria-pressed', 'true');
    await expect(info).toContainText('2x + 3y = 12');
    await expect(info).toContainText('2x + 6z = 12');
    await expect(info).toContainText('3y + 6z = 12');
    // Other ways of writing a plane.
    await type(page, 0, 'z = 2x - y + 3');
    await expect(info).toContainText('(−1.5, 0, 0)', { useInnerText: true });
    await type(page, 0, 'x = 4');
    await expect(info).toContainText('never meets the y axis');
  });

  test('two planes show the line they share; three show the point — the CPM way', async ({ page }) => {
    await open(page);
    await type(page, 0, 'x + y + z = 6');
    await type(page, 1, 'x - y + 2z = 4');
    await expect(key(page)).toContainText('1 and 2 meet in the line (x, y, z) =');
    await expect(key(page)).toContainText('t(3, −1, −2)');
    // The textbook system, from the Examples menu: x + y + z = 6,
    // 2x − y + z = 3, x + 2y − z = 2, solved by (1, 2, 3).
    await page.locator('[data-clearall]').click();
    await page.locator('[data-examples]').click();
    await page.getByRole('menuitem', { name: /meet at a point/ }).click();
    await expect(page.locator('.flg--3d .flg-item')).toHaveCount(3);
    await expect(key(page)).toContainText('All three planes meet at (1, 2, 3)');
    await expect(page.locator('.fl3-sr')).toContainText('All three planes meet at (1, 2, 3)');
    // And the point is on the graph, where the pointer can find it.
    const pick = await page.evaluate(() => (window as any).fluxGrapherPage.instance._last.picks.find((p: any) => p.what === 'where the planes meet'));
    expect(pick.text).toBe('(1, 2, 3)');
  });

  test('three planes with no point in common, or infinitely many, say so and why', async ({ page }) => {
    await open(page);
    await load(page, ['x + y + z = 6', 'x + y + z = 2', 'x - y = 0']);
    await expect(key(page)).toContainText('No point is on all three planes: 1 and 2 are parallel');
    await expect(key(page)).toContainText('1 and 2 are parallel — they never meet');
    await load(page, ['x + y = 1', 'x - y = 1', 'x = 3']);
    await expect(key(page)).toContainText('each pair meets, but in parallel lines');
    await load(page, ['z = 0', 'y = 0', 'y = z']);
    await expect(key(page)).toContainText('All three planes share one line');
    await load(page, ['x + y + z = 6', '2x + 2y + 2z = 12', '3x + 3y + 3z = 18']);
    await expect(key(page)).toContainText('are the same plane');
  });

  test('points, lines and surfaces draw; a row that cannot be drawn says why', async ({ page }) => {
    await open(page);
    await type(page, 0, 'A = (2, 3, 4)');
    await type(page, 1, 'line (0, 0, 0), (2, 4, 6)');
    await type(page, 2, '(1, 2, 3) + t(1, -1, 2)');
    await type(page, 3, 'x = 1 + 2t, y = 3t, z = 4 - t');
    await type(page, 4, 'z = x^2 - y^2');
    await expect(page.locator('.flg--3d .flg-err')).toHaveCount(0);
    await expect(page.locator('.flg--3d .fl3-info').nth(1)).toContainText('(x, y, z) = (0, 0, 0) + t(2, 4, 6)');
    await expect(page.locator('.fl3-sr')).toContainText('1 point, 3 lines, 1 surface');
    await expect(key(page)).toContainText('A = (2, 3, 4)');
    await type(page, 5, 'x^2 + y^2 + z^2 = 9');
    await expect(page.locator('.flg--3d .flg-err')).toContainText('Only planes');
    await type(page, 5, '(1, 2)');
    await expect(page.locator('.flg--3d .flg-err')).toContainText('three coordinates');
  });

  test('drag, the arrow keys, the buttons and the wheel turn and zoom it; x, y, z and the cube are preset views', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await open(page);
    const start = await view(page);
    const box = (await page.locator('.fl3-plot').boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 80, box.y + box.height / 2 + 40, { steps: 6 });
    await page.mouse.up();
    let v = await view(page);
    expect(v.yaw, 'dragging right turns it').toBeLessThan(start.yaw - 20);
    expect(v.pitch, 'dragging down tilts it').toBeGreaterThan(start.pitch + 10);

    await page.locator('.fl3-plot').focus();
    const before = await view(page);
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('ArrowUp');
    v = await view(page);
    expect(v.yaw).toBeCloseTo(before.yaw + 5, 6);
    expect(v.pitch).toBeCloseTo(before.pitch - 5, 6);
    await page.keyboard.press('z');
    expect(await view(page)).toMatchObject({ yaw: -90, pitch: 90 });

    await page.locator('[data-preset="x"]').click();
    expect(await view(page)).toMatchObject({ yaw: 0, pitch: 0 });
    await page.locator('[data-preset="y"]').click();
    expect(await view(page)).toMatchObject({ yaw: -90, pitch: 0 });
    await page.locator('[data-turn="right"]').click();
    expect((await view(page)).yaw).toBeCloseTo(-105, 6);
    await page.locator('[data-turn="down"]').click();
    expect((await view(page)).pitch).toBeCloseTo(15, 6);

    const z0 = (await view(page)).zoom;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.wheel(0, -300);
    await page.waitForTimeout(100);
    expect((await view(page)).zoom, 'scrolling up zooms in').toBeGreaterThan(z0);
    await page.locator('[data-tool="out"]').click();
    await page.locator('[data-tool="home"]').click();
    expect(await view(page)).toEqual(start);
    // Turning is not an edit: nothing to save.
    await expect(page.locator('#ghSave')).not.toHaveClass(/is-dirty/);
  });

  test('with reduced motion views jump instead of gliding, and nothing ever spins on its own', async ({ page }) => {
    await open(page);
    // Without the setting, a preset glides there…
    await page.locator('[data-preset="x"]').click();
    const mid = await view(page);
    expect(mid.yaw === 0 && mid.pitch === 0, 'it jumped instead of gliding').toBe(false);
    await expect.poll(() => view(page)).toMatchObject({ yaw: 0, pitch: 0 });
    // …and left alone, it stays exactly where it is.
    const still = await view(page);
    await page.waitForTimeout(1500);
    expect(await view(page)).toEqual(still);

    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.locator('[data-preset="z"]').click();
    expect(await view(page), 'under reduced motion the change is immediate').toMatchObject({ yaw: -90, pitch: 90 });
  });

  test('what is in front hides what is behind: a point under a plane is covered from above and clear from below', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await open(page);
    await load(page, [{ src: '(3, 3, -5)', colour: '#56b4e9', guides: false }, { src: 'z = 0', colour: '#e69f00', icpt: false }]);
    const pixelAtPoint = () => page.evaluate(async () => {
      const g = (window as any).fluxGrapherPage.instance;
      g._drawNow();
      const p = g._last.picks.find((k: any) => k.text === '(3, 3, −5)');
      const cv = document.querySelector('.fl3-canvas') as HTMLCanvasElement;
      const dpr = cv.width / cv.clientWidth;
      return Array.from(cv.getContext('2d')!.getImageData(Math.round(p.x * dpr), Math.round(p.y * dpr), 1, 1).data);
    });
    await page.evaluate(() => (window as any).fluxGrapherPage.instance.setView({ yaw: -90, pitch: 90 }));
    const above = await pixelAtPoint();
    await page.evaluate(() => (window as any).fluxGrapherPage.instance.setView({ yaw: -90, pitch: -90 }));
    const below = await pixelAtPoint();
    // From below, nothing is between you and the point: its own blue (86, 180, 233).
    expect(Math.abs(below[0] - 86) + Math.abs(below[1] - 180) + Math.abs(below[2] - 233), `from below: ${below}`).toBeLessThan(12);
    // From above, the orange plane is in front of it and tints it.
    expect(above[0] - below[0], `from above: ${above}`).toBeGreaterThan(25);
  });

  test('saving an image asks for a title and three checks, then downloads a PNG of the 3D graph', async ({ page }) => {
    await open(page);
    await load(page, ['x + y + z = 6', '2x - y + z = 3', 'x + 2y - z = 2']);
    await page.locator('#ghPng').click();
    const sheet = page.locator('.fgx-sheet');
    await expect(sheet).toBeVisible();
    await expect(sheet.locator('.fgx-preview img')).toHaveAttribute('src', /^blob:/);
    const go = sheet.locator('.fgx-go');
    await expect(go).toBeDisabled();
    await expect(sheet.locator('.fgx-missing')).toContainText('a title');
    await sheet.locator('[name=title]').fill('Three planes');
    for (const k of ['c1', 'c2', 'c3']) await sheet.locator(`[name=${k}]`).check();
    await expect(go).toBeEnabled();
    const [dl] = await Promise.all([page.waitForEvent('download'), go.click()]);
    expect(dl.suggestedFilename()).toBe('three-planes.png');
    const fs = await import('node:fs');
    const bytes = fs.readFileSync((await dl.path())!);
    expect(bytes.subarray(1, 4).toString()).toBe('PNG');
    expect(bytes.length).toBeGreaterThan(20_000);
    // The title typed there is the graph's title now.
    expect(await page.evaluate(() => (window as any).fluxGrapherPage.instance.doc.title)).toBe('Three planes');
  });

  test('printing lays the white drawing of the 3D graph out on its own page', async ({ page }) => {
    await page.addInitScript(() => { (window as any).__printed = 0; window.print = () => { (window as any).__printed++; }; });
    await open(page);
    await load(page, ['x + y + z = 6']);
    await page.locator('#ghPrint').click();
    await page.locator('[data-pmono="1"]').click();
    await page.locator('[data-pgo]').click();
    expect(await page.evaluate(() => (window as any).__printed)).toBe(1);
    const src = await page.locator('#flgPrintSheet img.fl3-print').getAttribute('src');
    expect(src).toMatch(/^data:image\/png;base64,/);
    expect(src!.length).toBeGreaterThan(20_000);
    expect(await page.evaluate(() => localStorage.getItem('flux_grapher_print_mono'))).toBe('true');
  });

  test('a share link rebuilds the rows and the view, through the short /graph/ link too', async ({ page, context }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: (t: string) => { (window as any).__copied = t; return Promise.resolve(); } } });
    });
    await open(page);
    await load(page, ['x + y + z = 6', { src: 'A = (1, 2, 3)', traces: true }, 'z = x^2 / 10']);
    await page.evaluate(() => (window as any).fluxGrapherPage.instance.setView({ yaw: -47, pitch: 61.5, zoom: 1.4 }));
    await page.locator('#ghShare').click();
    const url = await page.evaluate(() => (window as any).__copied as string);
    expect(url).toMatch(/\/graph\/#3d=[A-Za-z0-9_-]+$/);

    const other = await context.newPage();
    await other.setViewportSize({ width: 1280, height: 900 });
    await other.addInitScript(() => { localStorage.setItem('flux_grapher_tour', 'done'); localStorage.setItem('flux_grapher_mode', 'functions'); });
    await other.goto(url.replace(/^https?:\/\/[^/]+/, ''));
    await other.waitForURL(/grapher/);
    await other.waitForTimeout(800);
    await expect(other.locator('#mode3d')).toHaveAttribute('aria-selected', 'true');
    const doc = await other.evaluate(() => (window as any).fluxGrapherPage.instance.doc);
    expect(doc.items.map((i: any) => i.src)).toEqual(['x + y + z = 6', 'A = (1, 2, 3)', 'z = x^2 / 10']);
    expect(doc.items[1].traces).toBe(true);
    expect(doc.view).toEqual({ yaw: -47, pitch: 61.5, zoom: 1.4 });
    // Opened from a link, it is not "unsaved work".
    await expect(other.locator('#ghSave')).not.toHaveClass(/is-dirty/);

    // A link cut short says so instead of failing silently.
    const broken = await context.newPage();
    await broken.goto('/grapher.html#3d=eyJ2Ijox');
    await expect(broken.locator('.flg-toast, [role=status]').first()).toContainText('damaged', { timeout: 3000 });
  });

  test('saved to the Flux account like the other graphs, with a 3D badge, and opened back into 3D', async ({ page }) => {
    const ID = '44444444-4444-4444-8444-444444444444';
    const posted: any[] = [];
    await page.addInitScript(() => {
      localStorage.setItem('flux_grapher_session', JSON.stringify({
        access_token: 'test-token', refresh_token: 'r', expires_at: Math.floor(Date.now() / 1000) + 3600,
        user: { id: '00000000-0000-4000-8000-000000000001', email: 'ada@users.fluxplanner.app', user_metadata: { full_name: 'Ada' } },
      }));
    });
    await page.route('**/rest/v1/flux_graphs**', async (route) => {
      const req = route.request(), m = req.method(), url = req.url();
      if (m === 'POST' || m === 'PATCH') {
        posted.push({ method: m, body: req.postDataJSON() });
        await route.fulfill({ status: m === 'POST' ? 201 : 200, contentType: 'application/json', body: JSON.stringify([{ id: ID, title: req.postDataJSON().title }]) });
        return;
      }
      if (url.includes('id=eq.')) {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([{ id: ID, kind: 'functions', title: 'Planes', payload: posted[0].body.payload, updated_at: new Date().toISOString() }]) });
        return;
      }
      expect(decodeURIComponent(url), 'the list asks for each graph’s own kind').toContain('space:payload->>kind');
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([
        { id: ID, kind: 'functions', title: 'Planes', updated_at: new Date().toISOString(), space: '3d' },
        { id: '55555555-5555-4555-8555-555555555555', kind: 'functions', title: 'Parabola', updated_at: new Date().toISOString(), space: 'functions' },
      ]) });
    });
    await open(page);
    await load(page, ['x + y + z = 6', 'x - y = 0']);
    await page.locator('#ghSave').click();
    const nameSheet = page.locator('.fgc-sheet', { hasText: 'Name this graph' });
    await nameSheet.locator('input').fill('Planes');
    await nameSheet.getByRole('button', { name: 'Save' }).click();
    await expect.poll(() => posted.length).toBe(1);
    // The table only has two kinds; a 3D graph is a function graph whose payload says 3D.
    expect(posted[0].body.kind).toBe('functions');
    expect(posted[0].body.payload.kind).toBe('3d');
    expect(posted[0].body.payload.items.map((i: any) => i.src)).toEqual(['x + y + z = 6', 'x - y = 0']);
    await expect(page.locator('#ghSave')).not.toHaveClass(/is-dirty/);

    await page.locator('#modeData').click();
    await page.locator('#ghOpen').click();
    const sheet = page.locator('.fgc-sheet');
    await expect(sheet.locator('.fgc-kind--3d')).toHaveText('3D');
    await sheet.locator('.fgc-open', { hasText: 'Planes' }).click();
    await expect(page.locator('#mode3d')).toHaveAttribute('aria-selected', 'true');
    await expect(key(page)).toContainText('1 and 2 meet in the line');
    expect(await page.evaluate(() => (window as any).fluxGrapherPage.instance.cloud.id)).toBe(ID);
  });

  test('a 3D graph handed over from the planner opens in the 3D tab', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('flux_grapher_handoff', JSON.stringify({
        kind: '3d', at: Date.now(), cloud: null,
        payload: { kind: '3d', items: [{ src: 'x + 2y + 3z = 6' }] },
      }));
    });
    await open(page, { mode: 'data' });
    await expect(page.locator('#mode3d')).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('.fl3-info').first()).toContainText('(0, 3, 0)');
  });

  test('undo and redo step through edits, as in the other halves', async ({ page }) => {
    await open(page);
    await type(page, 0, 'x = 4');
    await page.waitForTimeout(500);
    await type(page, 1, '(1, 1, 1)');
    await page.waitForTimeout(500);
    await page.locator('[data-hist="undo"]').click();
    await expect(page.locator('.flg--3d .flg-item')).toHaveCount(1);
    await page.locator('[data-hist="redo"]').click();
    await expect(page.locator('.flg--3d .flg-item')).toHaveCount(2);
  });

  test('nothing reaches the network, there is no AI, and nothing is stored without saving', async ({ page }) => {
    const away: string[] = [];
    page.on('request', (r) => {
      const u = new URL(r.url());
      if (u.hostname !== '127.0.0.1' || /ai-proxy|gemini|functions\/v1|supabase/.test(r.url())) away.push(r.url());
    });
    await open(page);
    await page.locator('[data-examples]').click();
    await page.getByRole('menuitem', { name: /share a line/ }).click();
    await type(page, 3, 'z = sin(x) cos(y)');
    await page.locator('[data-preset="z"]').click();
    await page.locator('[data-tool="win"]').click();
    await page.locator('.flg-win [data-wn="zMax"]').fill('20');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);
    expect(away, 'the 3D grapher called out').toEqual([]);
    await expect(page.locator('.flg--3d')).not.toContainText(/\bAI\b/);
    const keys = await page.evaluate(() => Object.keys(localStorage));
    expect(keys.filter((k) => !['flux_grapher_tour', 'flux_grapher_mode'].includes(k)), 'a graph was written to storage').toEqual([]);
    await expect(page.locator('#ghSave')).toHaveClass(/is-dirty/);
  });

  test('the ranges, title and grids can be set exactly', async ({ page }) => {
    await open(page);
    await page.locator('[data-tool="win"]').click();
    await page.locator('.flg-win [data-wd="title"]').fill('Intercepts');
    await page.locator('.flg-win [data-wn="xMin"]').fill('0');
    await page.locator('.flg-win [data-wn="zMax"]').fill('8');
    await page.locator('.flg-win [data-wf="gridXZ"]').check();
    const doc = await page.evaluate(() => (window as any).fluxGrapherPage.instance.doc);
    expect(doc.title).toBe('Intercepts');
    expect(doc.win.xMin).toBe(0);
    expect(doc.win.zMax).toBe(8);
    expect(doc.win.gridXZ).toBe(true);
    // A half-typed range is ignored rather than collapsing the box.
    await page.locator('.flg-win [data-wn="yMax"]').fill('-20');
    expect(await page.evaluate(() => (window as any).fluxGrapherPage.instance.doc.win.yMax)).toBe(10);
  });

  test('no serious accessibility problems in the 3D tab', async ({ page }) => {
    await open(page);
    await load(page, ['x + y + z = 6', 'A = (1, 2, 3)']);
    const results = await new AxeBuilder({ page }).include('#grapherHost').include('#ghModes').analyze();
    const bad = results.violations.filter((v) => v.impact === 'critical' || v.impact === 'serious');
    expect(bad, JSON.stringify(bad.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) })), null, 2)).toEqual([]);
  });
});

test.describe('Grapher 3D on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test('every control fits on the bar, the key folds out of the way, and a finger turns it and two pinch to zoom', async ({ page }) => {
    await open(page);
    await load(page, ['x + y + z = 6', '2x - y + z = 3', 'x + 2y - z = 2']);
    const over = await page.evaluate(() => {
      const vw = document.documentElement.clientWidth;
      return ['#modeFunctions', '#modeData', '#mode3d', '#ghSave', '#ghOpen', '#ghPrint', '#ghShare', '#ghAcct', '.fxhub-btn']
        .map((s) => ({ s, r: document.querySelector(s)!.getBoundingClientRect().right }))
        .filter((x) => x.r > vw + 1);
    });
    expect(over, 'these controls are pushed off the right edge').toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    // Folded on a phone, but the answer still shows.
    await expect(key(page)).toHaveClass(/is-folded/);
    await expect(key(page)).toContainText('All three planes meet at (1, 2, 3)');
    await key(page).locator('[data-keytoggle]').tap();
    await expect(key(page)).toContainText('2x - y + z = 3');

    for (const sel of ['[data-preset="z"]', '[data-turn="left"]', '[data-tool="home"]']) await expect(page.locator(sel)).toBeVisible();

    const start = await view(page);
    const touch = (type: string, id: number, x: number, y: number) => page.evaluate(({ type, id, x, y }) => {
      const el = document.querySelector('.fl3-plot')!;
      const r = el.getBoundingClientRect();
      el.dispatchEvent(new PointerEvent(type, { pointerId: id, pointerType: 'touch', isPrimary: id === 1, clientX: r.left + x, clientY: r.top + y, bubbles: true }));
    }, { type, id, x, y });
    await touch('pointerdown', 1, 150, 150);
    for (let i = 1; i <= 5; i++) await touch('pointermove', 1, 150 + i * 12, 150);
    await touch('pointerup', 1, 210, 150);
    expect((await view(page)).yaw, 'a finger dragged right turns it').toBeLessThan(start.yaw - 15);

    const z0 = (await view(page)).zoom;
    await touch('pointerdown', 1, 150, 150);
    await touch('pointerdown', 2, 200, 150);
    for (let i = 1; i <= 5; i++) await touch('pointermove', 2, 200 + i * 12, 150);
    await touch('pointerup', 2, 260, 150);
    await touch('pointerup', 1, 150, 150);
    expect((await view(page)).zoom, 'spreading two fingers zooms in').toBeGreaterThan(z0 * 1.5);
  });
});
