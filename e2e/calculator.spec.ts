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
});
