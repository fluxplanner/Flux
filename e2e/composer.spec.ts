import { test, expect } from '@playwright/test';

/*
 * Flux Composer (composer.html): the music tools on their own page, the way
 * periodic.html is chemistry. Stands alone — no bundles, no sign-in.
 */
test.describe('Flux Composer', () => {
  test('every tab renders without a page error', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto('/composer.html');
    await expect(page.locator('.fc-tile')).toHaveCount(30);
    for (const tab of ['keyboard', 'scales', 'chords', 'harmony', 'intervals', 'rhythm', 'orchestra', 'terms', 'dp', 'keys']) {
      await page.locator(`.fc-tabs [data-tab="${tab}"]`).click();
      await expect(page.locator(`.fc-tabs [data-tab="${tab}"]`)).toHaveAttribute('aria-selected', 'true');
      await expect(page.locator('#fcBody .fc-card').first()).toBeVisible();
    }
    expect(errors).toEqual([]);
  });

  test('a key on the table opens with its signature, relative and chords, spelled by letter', async ({ page }) => {
    await page.goto('/composer.html');
    await page.locator('.fc-tile[data-key="B♭"][data-mode="major"]').click();
    const detail = page.locator('.fc-card--detail');
    await expect(detail).toContainText('B♭ major');
    await expect(detail).toContainText('2♭ · B♭ E♭');
    await expect(detail).toContainText('G minor');
    await expect(detail).toContainText('B♭ C D E♭ F G A');
    expect(decodeURIComponent(new URL(page.url()).hash)).toBe('#keys/B♭-major');
  });

  test('a link straight to a key and a tab', async ({ page }) => {
    await page.goto('/composer.html#keys/F%E2%99%AF-minor');
    await expect(page.locator('.fc-card--detail')).toContainText('F♯ minor');
    await page.goto('/composer.html#harmony');
    await expect(page.locator('.fc-tabs [data-tab="harmony"]')).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('#fcBody')).toContainText('Perfect');
  });

  test('the glossary filters as you type', async ({ page }) => {
    await page.goto('/composer.html#terms');
    await page.locator('#tmQ').fill('pizzicato');
    await expect(page.locator('.fc-term')).toHaveCount(1);
    await expect(page.locator('.fc-term')).toContainText('Plucked');
  });

  test('the ear trainer scores an answer', async ({ page }) => {
    await page.goto('/composer.html#intervals');
    await page.locator('#ivNew').click();
    await page.locator('[data-ans]').first().click();
    await expect(page.locator('.fc-pill', { hasText: 'Score' })).toContainText('/ 1');
  });
});
