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

  /*
   * "Let users add the and beat, like 1 and 2": the grid was sixteen
   * unlabelled squares, so nobody could tell which one was the "and". It is
   * counted now (1 e & a), and can show only the beats and their ands.
   */
  test('the beat maker counts 1 e & a, and can show just 1 & 2 &', async ({ page }) => {
    await page.goto('/composer.html#beats');
    const count = page.locator('#btGrid .fc-bt-count');
    await expect(count).toHaveText(['1', 'e', '&', 'a', '2', 'e', '&', 'a', '3', 'e', '&', 'a', '4', 'e', '&', 'a']);
    await expect(page.locator('[data-r="snare"][data-s="2"]')).toHaveAttribute('aria-label', 'Snare, 1 and');

    await page.locator('#btClear').click();
    await page.locator('#btGridMode [data-v="8"]').click();
    await expect(count).toHaveText(['1', '&', '2', '&', '3', '&', '4', '&']);
    await expect(page.locator('[data-r="kick"] ')).toHaveCount(8);
    // The "and" of 1 is the eighth note after it: step 3 of 16.
    await page.locator('[data-r="hat"][data-s="2"]').click();
    await page.locator('#btGridMode [data-v="16"]').click();
    await expect(page.locator('[data-r="hat"][data-s="2"]')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('[data-r="kick"]')).toHaveCount(16);

    // A hit on an "e" is not lost in the simpler view: it says so.
    await page.locator('[data-r="kick"][data-s="1"]').click();
    await page.locator('#btGridMode [data-v="8"]').click();
    await expect(page.locator('.fc-bt-hidden')).toBeVisible();
  });

  test('each melody and bass row plays the note picked for it, and the link keeps it', async ({ page }) => {
    await page.goto('/composer.html#beats');
    // C minor pentatonic, highest first; the bass on the key note.
    const notes = page.locator('#btGrid [data-note]');
    await expect(notes).toHaveCount(6);
    const picked = () => notes.evaluateAll((els) => els.map((e) => (e as HTMLSelectElement).selectedOptions[0].textContent));
    expect(await picked()).toEqual(['B♭4', 'G4', 'F4', 'E♭4', 'C4', 'C2']);
    // The key's notes come first, and any note is there.
    const groups = await page.locator('[data-note="k0"] optgroup').evaluateAll((g) => g.map((x) => x.getAttribute('label')));
    expect(groups).toEqual(['In C minor', 'Other notes']);

    await page.locator('[data-note="k0"]').selectOption('71');
    await page.locator('[data-note="bass"]').selectOption('31');
    expect(await picked()).toEqual(['B4', 'G4', 'F4', 'E♭4', 'C4', 'G1']);
    await expect(page.locator('[data-note="bass"]')).toBeFocused();
    await expect(page.locator('[data-r="k0"][data-s="0"]')).toHaveAttribute('aria-label', 'B4, beat 1');

    const link = page.url();
    expect(link).toMatch(/#beats\/\d+-\d+-\d+-[mM]-[0-9a-f]{52}-[0-9a-f]{12}$/);
    await page.goto('/composer.html#keys');
    await page.goto(link);
    expect(await picked()).toEqual(['B4', 'G4', 'F4', 'E♭4', 'C4', 'G1']);

    // A new key carries the picked notes with it; the rest follow the scale.
    await page.locator('#btKey').selectOption('D');
    expect(await picked()).toEqual(['C♯5', 'A4', 'G4', 'F4', 'D4', 'A1']);
    // Major or Minor puts every row back on that scale.
    await page.locator('#btMode [data-v="major"]').click();
    expect(await picked()).toEqual(['B4', 'A4', 'F♯4', 'E4', 'D4', 'D2']);
    await expect(page.locator('#btNotesReset')).toHaveCount(0);
  });

  test('the beat maker fits a phone without sideways scrolling', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 760 });
    await page.goto('/composer.html#beats');
    await expect(page.locator('#btGrid')).toBeVisible();
    const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(over).toBeLessThanOrEqual(0);
  });

  /*
   * DP Music: the portfolio ("Exploring music in context") asks for diverse
   * music across four areas of inquiry and personal, local and global
   * contexts. One listening sheet could only ever hold one piece, so a sheet
   * per piece, tagged, with a coverage grid that shows the gaps.
   */
  test('listening sheets: one per piece, tagged, kept, and counted in the coverage grid', async ({ page }) => {
    await page.addInitScript(() => {
      if (!sessionStorage.getItem('seeded')) {
        sessionStorage.setItem('seeded', '1');
        localStorage.setItem('flux_composer_listening', JSON.stringify({ Piece: 'Bolero, Ravel, 1928', Texture: 'one melody over a snare ostinato' }));
      }
    });
    await page.goto('/composer.html');
    await page.locator('.fc-tabs [data-tab="dp"]').click();

    // The old single sheet becomes the first piece, nothing lost.
    await expect(page.locator('[data-ls="piece"]')).toHaveValue('Bolero, Ravel, 1928');
    await expect(page.locator('[data-ls-dim="Texture"]')).toHaveValue('one melody over a snare ostinato');

    await page.selectOption('[data-ls="area"]', '2');
    await page.selectOption('[data-ls="context"]', 'Global');
    await page.locator('#lsNew').click();
    await expect(page.locator('[data-ls="piece"]')).toBeFocused();
    await page.fill('[data-ls="piece"]', 'Wade in the Water');
    await page.selectOption('[data-ls="area"]', '1');
    await page.selectOption('[data-ls="context"]', 'Local');
    await page.fill('[data-ls-dim="Melody"]', 'call and response');

    const cell = (row: number, col: number) => page.locator(`#lsCov tbody tr:nth-child(${row}) td:nth-of-type(${col})`);
    await expect(cell(2, 3)).toHaveClass(/is-on/); // Area 2 · Global
    await expect(cell(1, 2)).toHaveClass(/is-on/); // Area 1 · Local
    await expect(cell(3, 1)).not.toHaveClass(/is-on/);
    await expect(page.locator('#lsPick option')).toHaveText(['Bolero, Ravel, 1928', 'Wade in the Water']);

    await page.reload();
    await page.locator('.fc-tabs [data-tab="dp"]').click();
    await expect(page.locator('[data-ls="piece"]')).toHaveValue('Wade in the Water');
    await expect(page.locator('[data-ls-dim="Melody"]')).toHaveValue('call and response');
    await page.selectOption('#lsPick', { label: 'Bolero, Ravel, 1928' });
    await expect(page.locator('[data-ls="context"]')).toHaveValue('Global');

    page.once('dialog', (d) => d.accept());
    await page.locator('#lsClear').click();
    await expect(page.locator('#lsPick option')).toHaveText(['Wade in the Water']);
    await expect(cell(2, 3)).not.toHaveClass(/is-on/);
  });
});
