import { test, expect } from '@playwright/test';

/*
 * Flux Lingo, Translate tab (translate.html#translate). Stands alone — no bundles, no sign-in.
 * The browser's on-device Translator is removed so every run takes the
 * MyMemory path, which is stubbed: tests never reach translated.net.
 */

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => { delete (window as any).Translator; });
  await page.route('https://api.mymemory.translated.net/**', (route) => {
    const q = new URL(route.request().url()).searchParams.get('q') || '';
    route.fulfill({
      contentType: 'application/json',
      headers: { 'access-control-allow-origin': '*' },
      body: JSON.stringify({ responseStatus: 200, quotaFinished: false, responseData: { translatedText: '[es] ' + q } }),
    });
  });
});

test.describe('Flux Lingo: Translate', () => {
  test('translates, says where the text went, and remembers it', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto('/translate.html#translate');
    await expect(page.locator('#ftFrom')).toHaveValue('en');
    await expect(page.locator('#ftTo')).toHaveValue('es');
    await page.locator('#ftIn').fill('Good morning.');
    await page.locator('#ftGo').click();
    await expect(page.locator('#ftOut')).toHaveText('[es] Good morning.');
    await expect(page.locator('#ftHow')).toContainText('translated.net');
    await expect(page.locator('#ftCopy')).toBeEnabled();
    await expect(page.locator('.ft-item')).toHaveCount(1);

    await page.reload();
    await page.locator('.ft-item').first().click();
    await expect(page.locator('#ftIn')).toHaveValue('Good morning.');
    await expect(page.locator('#ftOut')).toHaveText('[es] Good morning.');
    expect(errors).toEqual([]);
  });

  test('swap flips the languages and moves the result into the box', async ({ page }) => {
    await page.goto('/translate.html#translate');
    await page.locator('#ftIn').fill('Hello');
    await page.keyboard.press('Control+Enter');
    await expect(page.locator('#ftOut')).toHaveText('[es] Hello');
    await page.locator('#ftSwap').click();
    await expect(page.locator('#ftFrom')).toHaveValue('es');
    await expect(page.locator('#ftTo')).toHaveValue('en');
    await expect(page.locator('#ftIn')).toHaveValue('[es] Hello');
  });

  test('long text is sent in pieces under the 500-byte limit', async ({ page }) => {
    await page.goto('/translate.html#translate');
    const sizes = await page.evaluate(() => {
      const text = 'This is one sentence that goes on for a while. '.repeat(40);
      const parts = (window as any).FluxTranslator.chunks(text);
      return { joined: parts.join('') === text, max: Math.max(...parts.map((p: string) => p.length)) };
    });
    expect(sizes.joined).toBe(true);
    expect(sizes.max).toBeLessThanOrEqual(450);
  });

  test('is listed in Flux Suite', async ({ page }) => {
    await page.goto('/suite.html');
    await expect(page.locator('#apps a.app--translate')).toHaveAttribute('href', 'translate.html');
  });
});
