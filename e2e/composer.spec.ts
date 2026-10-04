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
    for (const tab of ['keyboard', 'scales', 'chords', 'harmony', 'intervals', 'rhythm', 'beats', 'orchestra', 'terms', 'dp', 'keys']) {
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

  test('the beat maker plays, takes clicks, travels as a link and downloads a WAV', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto('/composer.html#beats');
    const steps = page.locator('#btGrid .fc-bt-step');
    await expect(steps).toHaveCount(13 * 16);
    // Boom bap loads first: a kick on step 1.
    await expect(page.locator('[data-r="kick"][data-s="0"]')).toHaveAttribute('aria-pressed', 'true');

    await page.locator('#btClear').click();
    await expect(page.locator('#btGrid [aria-pressed="true"]')).toHaveCount(0);
    await page.locator('[data-r="snare"][data-s="4"]').click();
    await page.locator('[data-r="k0"][data-s="2"]').click();
    await expect(page.locator('#btGrid [aria-pressed="true"]')).toHaveCount(2);

    await page.locator('#btGo').click();
    await expect(page.locator('#btGo')).toHaveText('■ Stop');
    await expect(page.locator('#btGrid .is-now').first()).toBeAttached();
    await page.locator('#btGo').click();
    await expect(page.locator('#btGo')).toHaveText('▶ Play');

    const link = page.url();
    expect(link).toMatch(/#beats\/\d+-\d+-\d+-[mM]-[0-9a-f]{52}$/);
    await page.goto('/composer.html#keys');
    await page.goto(link);
    await expect(page.locator('#btGrid [aria-pressed="true"]')).toHaveCount(2);
    await expect(page.locator('[data-r="snare"][data-s="4"]')).toHaveAttribute('aria-pressed', 'true');

    await page.locator('#btPreset').selectOption('House');
    await expect(page.locator('#btBpmV')).toHaveText('124');
    const [wav] = await Promise.all([page.waitForEvent('download'), page.locator('#btWav').click()]);
    expect(wav.suggestedFilename()).toBe('flux-beat-124bpm.wav');
    expect(errors).toEqual([]);
  });

  test('very high and very low notes stay on the picture, under 8va or 8vb', async ({ page }) => {
    await page.goto('/composer.html#keyboard');
    const fit = await page.evaluate(() => {
      const C = (window as any).FluxComposer;
      return [[96, 98, 100, 103, 105], [12, 14, 16], [60, 64, 67]].map((set) => {
        const host = document.createElement('div');
        host.innerHTML = C.staffSVG({ notes: set.map((m: number) => C.spellMidi(m, false)) });
        document.body.appendChild(host);
        const svg = host.querySelector('svg')!;
        const box = svg.viewBox.baseVal;
        const inside = [...svg.querySelectorAll('ellipse')].every((e) => {
          const cy = +e.getAttribute('cy')!;
          return cy > 4 && cy < box.height - 4;
        });
        const mark = svg.querySelector('.fc-ottava')?.textContent || '';
        host.remove();
        return { inside, mark };
      });
    });
    expect(fit).toEqual([{ inside: true, mark: '15ma' }, { inside: true, mark: '15mb' }, { inside: true, mark: '' }]);
  });

  test('the beat maker fits a phone without sideways scrolling', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 760 });
    await page.goto('/composer.html#beats');
    await expect(page.locator('#btGrid')).toBeVisible();
    const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(over).toBeLessThanOrEqual(0);
  });
});
