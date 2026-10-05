import { test, expect } from '@playwright/test';
import { gotoScenario } from './helpers';

/**
 * The calculator, on its own page and inside Study tools → Maths.
 *
 * The maths is covered in test/unit/ti84-calculator.test.mjs. These check what
 * a unit test can't: that a real keyboard and real clicks reach it, that the
 * graph actually paints, and that the planner's 150-odd stylesheets — some
 * forcing sizes onto every button with !important — leave the keypad alone.
 */

const lastOut = (page: import('@playwright/test').Page) =>
  page.locator('.t84h-out').last();

test.describe('Calculator', () => {
  test('typing on a keyboard works like the handheld', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/calculator.html');
    await page.locator('.t84-scr').click();
    await page.keyboard.type('1/3');
    await page.keyboard.press('Enter');
    await expect(lastOut(page)).toHaveText('.3333333333');
    // ^ opens an exponent, as MathPrint does; the answer follows on.
    await page.keyboard.type('2^10');
    await page.keyboard.press('Enter');
    await expect(lastOut(page)).toHaveText('1024');
    await page.keyboard.type('-24');
    await page.keyboard.press('Enter');
    await expect(lastOut(page), 'a leading minus subtracts from Ans').toHaveText('1000');
    await expect(page.locator('.fxhub-btn:visible')).toBeVisible();
  });

  test('the keys, 2nd, and the graph', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/calculator.html');
    const key = (k: string) => page.locator(`.t84 [data-k="${k}"]`).click();
    for (const k of ['2', 'add', '3', 'enter']) await key(k);
    await expect(lastOut(page)).toHaveText('5');
    // 2nd then ^ is π.
    for (const k of ['2nd', 'pow', 'enter']) await key(k);
    await expect(lastOut(page)).toHaveText('3.141592654');

    for (const k of ['yequ', 'xt', 'sq', 'sub', '4', 'graph']) await key(k);
    const canvas = page.locator('.t84g canvas');
    await expect(canvas).toBeVisible();
    // Something other than white was drawn: the axes and the parabola.
    await expect.poll(() => canvas.evaluate((c: HTMLCanvasElement) => {
      const g = c.getContext('2d')!;
      const d = g.getImageData(0, 0, c.width, c.height).data;
      let ink = 0;
      for (let i = 0; i < d.length; i += 4) if (d[i] < 200 || d[i + 2] < 200) ink++;
      return ink;
    })).toBeGreaterThan(500);
    // 2nd QUIT goes all the way home.
    for (const k of ['2nd', 'mode']) await key(k);
    await expect(page.locator('.t84-home')).toBeVisible();
  });

  test('nCr from the PROB menu gives two boxes to fill, or follows a number', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/calculator.html');
    const keys = async (...ks: string[]) => { for (const k of ks) await page.locator(`.t84 [data-k="${k}"]`).click(); };
    const nCr = ['math', 'right', 'right', 'right', '3'];
    await keys(...nCr, '5', 'right', '2', 'enter');
    await expect(lastOut(page)).toHaveText('10');
    await keys('6', ...nCr, '3', 'enter');
    await expect(lastOut(page)).toHaveText('20');
  });

  test('2nd OFF switches it off, and only ON switches it back on', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/calculator.html');
    const key = (k: string) => page.locator(`.t84 [data-k="${k}"]`).click();
    for (const k of ['6', 'mul', '7', 'enter']) await key(k);
    await expect(lastOut(page)).toHaveText('42');
    for (const k of ['2nd', 'on']) await key(k);
    await expect(page.locator('.t84')).toHaveClass(/is-off/);
    await expect(page.locator('.t84-scr')).toBeHidden();
    // Switched off, the other keys do nothing — typing or tapping.
    await key('5');
    await page.keyboard.type('9');
    await key('on');
    await expect(page.locator('.t84')).not.toHaveClass(/is-off/);
    await expect(lastOut(page), 'the screen comes back as it was').toHaveText('42');
    await expect(page.locator('.t84-entry'), 'nothing typed while it was off').not.toContainText(/[59]/);
  });

  test('no white shows around the standalone pages on a phone', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    for (const url of ['/calculator.html', '/grapher.html', '/periodic.html']) {
      await page.goto(url);
      const bg = await page.evaluate(() => getComputedStyle(document.documentElement).backgroundColor);
      expect(bg, `${url} has no page colour of its own`).toBe('rgb(7, 11, 20)');
      await expect(page.locator('meta[name="apple-mobile-web-app-status-bar-style"]')).toHaveAttribute('content', 'black-translucent');
      await expect(page.locator('.fxhub-btn:visible')).toBeVisible();
    }
  });

  test('the switcher stays on screen down to 320 wide, headers are solid, and the grapher reaches the bottom', async ({ page }) => {
    for (const width of [320, 360, 390]) {
      await page.setViewportSize({ width, height: 700 });
      for (const url of ['/calculator.html', '/grapher.html', '/periodic.html']) {
        await page.goto(url);
        const r = await page.evaluate(() => {
          const b = [...document.querySelectorAll('.fxhub-btn')].find((e) => (e as HTMLElement).offsetParent)!.getBoundingClientRect();
          const h = getComputedStyle(document.querySelector('header.top')!);
          return { left: b.left, right: b.right, vw: innerWidth, bg: h.backgroundColor, blur: h.backdropFilter };
        });
        expect(r.right, `${url} at ${width}: the Flux button runs off the side`).toBeLessThanOrEqual(r.vw);
        expect(r.left).toBeGreaterThanOrEqual(0);
        // A see-through header is what iPhone Safari blurs behind the clock.
        expect(r.bg, `${url}: header is see-through`).toBe('rgb(8, 12, 22)');
        expect(r.blur === 'none' || r.blur === '').toBe(true);
      }
    }
    await page.goto('/grapher.html');
    const gap = await page.evaluate(() => innerHeight - document.querySelector('.wrap')!.getBoundingClientRect().bottom);
    expect(gap, 'an empty strip under the grapher').toBe(0);
  });

  test('on a home-screen app, Open full screen stays in the app', async ({ page, context }) => {
    // What iOS reports when Flux was added to the home screen.
    await page.addInitScript(() => Object.defineProperty(navigator, 'standalone', { value: true }));
    await page.setViewportSize({ width: 390, height: 844 });
    await gotoScenario(page, 'student-semester');
    await page.evaluate(() => (window as any).nav('toolbox'));
    await page.waitForTimeout(600);
    await page.evaluate(() => (window as any).fluxStudyHub.selectSubject('math'));
    await page.locator('#fshUnits .fsh-unit[data-unit="algebra"]').click();
    await page.locator('#fshChemTabs [data-tool="calc"]').click();
    const pages = context.pages().length;
    await page.locator('.fsh-calc-full').click();
    await page.waitForURL(/calculator(\.html)?$/);
    expect(context.pages().length, 'no second window, which iOS shows as a Safari sheet').toBe(pages);
    await expect(page.locator('.fxhub-btn:visible')).toBeVisible();
  });

  test('Study tools → Maths has it, and the planner leaves its keys alone', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 950 });
    await gotoScenario(page, 'student-semester');
    await page.evaluate(() => (window as any).nav('toolbox'));
    await page.waitForTimeout(600);
    await page.evaluate(() => (window as any).fluxStudyHub.selectSubject('math'));
    await page.locator('#fshUnits .fsh-unit[data-unit="algebra"]').click();
    await page.locator('#fshChemTabs [data-tool="calc"]').click();
    await expect(page.locator('.fsh-calc .t84')).toBeVisible();
    const k = page.locator('.fsh-calc .t84 [data-k="7"]');
    const h = await k.evaluate((e) => (e as HTMLElement).offsetHeight);
    expect(h, `a key is ${h}px tall — a planner button rule is reaching in`).toBeLessThan(48);
    expect(await k.evaluate((e) => getComputedStyle(e).backgroundImage)).toMatch(/gradient/);
    for (const id of ['6', 'mul', '7', 'enter']) await page.locator(`.fsh-calc .t84 [data-k="${id}"]`).click();
    await expect(page.locator('.fsh-calc .t84h-out').last()).toHaveText('42');
  });

  test('an iPad held sideways gets the keys beside the screen, all on view', async ({ page }) => {
    await page.setViewportSize({ width: 1180, height: 740 });
    await page.goto('/calculator.html');
    const box = await page.evaluate(() => {
      const r = (s: string) => document.querySelector(s)!.getBoundingClientRect();
      return { calcBottom: r('.t84').bottom, vh: innerHeight, screenRight: r('.t84-bezel').right, keysLeft: r('.t84-keys').left };
    });
    expect(box.keysLeft, 'the keys should sit beside the screen').toBeGreaterThan(box.screenRight);
    expect(box.calcBottom, 'the keys run off the bottom of the screen').toBeLessThanOrEqual(box.vh);
  });
});
