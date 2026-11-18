import { test, expect } from '@playwright/test';
import { toolPageBasics } from './tool-page';

toolPageBasics('units.html', /Flux Units/);

test('converts with the working and keeps significant figures', async ({ page }) => {
  await page.goto('/units.html');
  await page.selectOption('#unCat', 'length');
  await page.fill('#unVal', '2.50');
  await page.selectOption('#unFrom', 'km');
  await page.selectOption('#unTo', 'm');
  await expect(page.locator('#unOut .ft-big')).toHaveText('2.50 km = 2500 m');
  await expect(page.locator('#unOut .ft-work')).toContainText('× (1000 m / 1 km)');
  await page.selectOption('#unCat', 'temperature');
  await page.fill('#unVal', '100');
  await page.selectOption('#unFrom', 'C'); await page.selectOption('#unTo', 'F');
  // 100 has one significant figure, so the kept-figures answer is 200 °F.
  await expect(page.locator('#unOut .ft-big')).toHaveText('100 °C = 200 °F');
  await page.uncheck('#unKeepSf');
  await expect(page.locator('#unOut .ft-big')).toHaveText('100 °C = 212 °F');
});

test('counts significant figures', async ({ page }) => {
  await page.goto('/units.html');
  await page.click('#tab-sigfig');
  await page.fill('#sfNum', '0.004560');
  await expect(page.locator('#sfOut .ft-big')).toHaveText('0.004560 has 4 significant figures');
});

test('the quiz marks an answer', async ({ page }) => {
  await page.goto('/units.html');
  await page.click('#tab-quiz');
  const ans = await page.evaluate(() => {
    const m = document.getElementById('qzQ')!.textContent!.match(/Convert ([\d.]+) (\S+) to (\S+)\./)!;
    const cats = (window as any).FluxUnitConverter.CATEGORIES;
    const c = Object.keys(cats).find((k) => cats[k].units[m[2]] && cats[k].units[m[3]])!;
    return (window as any).FluxUnitConverter.convert(c, +m[1], m[2], m[3]);
  });
  await page.fill('#qzA', String(ans));
  await page.click('#qzForm button[type=submit]');
  await expect(page.locator('#qzOut')).toContainText('Right');
});
