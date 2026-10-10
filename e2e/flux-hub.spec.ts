import { test, expect } from '@playwright/test';
import { gotoScenario } from './helpers';

test.describe('Flux Hub link', () => {
  test('the standalone grapher opens the Hub directly', async ({ page }) => {
    await page.goto('/grapher.html');
    const link = page.locator('.fxhub-btn:visible');
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute('href', 'hub.html');
    await expect(link).toHaveAttribute('aria-label', 'Open the Flux Hub');
    await expect(page.locator('.fxhub-panel')).toHaveCount(0);

    await link.click();
    await expect(page).toHaveURL(/\/hub\.html$/);
    await expect(page.locator('#apps .app')).toHaveCount(9);
  });

  test('the planner link opens the Hub on desktop', async ({ page }) => {
    await page.setViewportSize({ width: 1400, height: 950 });
    await gotoScenario(page, 'student-semester');
    await page.waitForTimeout(2200);

    const link = page.locator('.fxhub-btn:visible');
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute('href', 'hub.html');
    await link.click();
    await expect(page).toHaveURL(/\/hub\.html$/);
  });

  test('the planner phone header also links directly to the Hub', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await gotoScenario(page, 'student-semester');
    await page.waitForTimeout(2200);

    const link = page.locator('.fxhub-btn:visible');
    await expect(link).toHaveCount(1);
    await expect(link).toHaveAttribute('href', 'hub.html');
    await link.click();
    await expect(page).toHaveURL(/\/hub\.html$/);
    await expect(page.locator('#apps a.app--grapher')).toBeVisible();
  });

  test('the Hub directory contains every product', async ({ page }) => {
    await page.goto('/hub.html');
    const paths = await page.locator('#apps .app').evaluateAll((apps) =>
      apps.map((app) => app.getAttribute('href')));
    expect(paths).toEqual(expect.arrayContaining([
      'index.html', 'synara.html', 'teacher.html', 'grapher.html',
      'periodic.html', 'composer.html', 'flashcards.html', 'pixel.html',
      'calculator.html',
    ]));
  });

  test('other apps wear the planner theme only when signed in', async ({ page }) => {
    await page.goto('/hub.html');
    const accent = () => page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue('--accent').trim());
    await page.evaluate(() => {
      localStorage.setItem('flux_theme', '"ember"');
      localStorage.setItem('flux_accent', '"#f97316"');
      localStorage.setItem('flux_accent_rgb', '"249,115,22"');
    });
    await page.goto('/calculator.html');
    expect(await accent()).toBe('#00c2ff');

    await page.evaluate(() => localStorage.setItem('sb-test-auth-token', '{"x":1}'));
    await page.goto('/calculator.html');
    expect(await accent()).toBe('#f97316');
    await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(13, 8, 4)');
  });
});
