import { test, expect } from '@playwright/test';

/*
 * Flux Flashcards (flashcards.html): decks, spaced repetition and five study
 * modes on their own page. Stands alone — no bundles, no sign-in. The
 * scheduler, marking and parsing are unit-tested in test/unit/flash-core;
 * these drive the page the way a student would.
 */

const store = (page: import('@playwright/test').Page) =>
  page.evaluate(() => JSON.parse(localStorage.getItem('flux_flash_decks_v1') || '{"decks":[]}').decks.filter((d: any) => !d.deleted));

async function addSample(page: import('@playwright/test').Page, id: string) {
  await page.goto('/flashcards.html');
  await page.locator(`[data-sample="${id}"]`).click();
  await expect(page.locator('.ff-deck-head h1')).toBeVisible();
  return page.url();
}

test.describe('Flux Flashcards', () => {
  test('a ready-made deck opens with every study mode', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await addSample(page, 'chem-first-20');
    await expect(page.locator('.ff-deck-head h1')).toHaveText('Chemistry: the first 20 elements');
    await expect(page.locator('.ff-row')).toHaveCount(20);
    await expect(page.locator('.ff-mode')).toHaveCount(5);
    for (const mode of ['learn', 'cards', 'write', 'test', 'match']) {
      await page.locator(`.ff-mode[href$="/${mode}"]`).click();
      await expect(page.locator('#ffStage')).not.toBeEmpty();
      await page.goBack();
      await expect(page.locator('.ff-deck-head h1')).toBeVisible();
    }
    expect(errors).toEqual([]);
  });

  test('Learn reveals, schedules and comes back to a missed card', async ({ page }) => {
    const deckUrl = await addSample(page, 'capitals');
    await page.goto(deckUrl + '/learn');
    await expect(page.locator('.ff-learn-q')).toHaveText('Australia');
    await page.keyboard.press('Space');
    await expect(page.locator('.ff-learn-a-text')).toHaveText('Canberra');
    await expect(page.locator('.ff-grade')).toHaveCount(4);
    await expect(page.locator('.ff-grade--again span')).toHaveText('1m');
    await page.keyboard.press('1');
    // The missed card is still in this session; the next card is new.
    await expect(page.locator('.ff-scount')).toHaveText('15 to go');
    await expect(page.locator('.ff-learn-q')).toHaveText('Canada');

    const decks = await store(page);
    const aus = decks[0].cards.find((c: any) => c.term === 'Australia');
    expect(aus.s.state).toBe('learning');
    expect(aus.s.due - aus.s.last).toBe(60_000);

    // Undo puts it back exactly.
    await page.locator('[data-undo]').click();
    await expect(page.locator('.ff-learn-q')).toHaveText('Australia');
    expect((await store(page))[0].cards.find((c: any) => c.term === 'Australia').s).toBeUndefined();
  });

  test('typing an answer in Learn marks it and suggests a grade', async ({ page }) => {
    const deckUrl = await addSample(page, 'capitals');
    await page.goto(deckUrl + '/learn');
    await page.locator('.ff-reveal input').fill('canbera');
    await page.locator('.ff-reveal input').press('Enter');
    await expect(page.locator('.ff-verdict--ok')).toContainText('Nearly');
    await expect(page.locator('.ff-grade--good')).toHaveClass(/is-suggested/);
  });

  test('a new deck is typed in, blank rows are dropped, and it saves', async ({ page }) => {
    await page.goto('/flashcards.html#/new');
    await page.locator('[name="title"]').fill('Verbs');
    const term = page.locator('textarea[data-f="term"]').first();
    await term.fill('hablar');
    await term.press('Enter');
    await page.keyboard.type('to speak');
    await page.keyboard.press('Enter');
    await page.keyboard.type('comer');
    await page.keyboard.press('Enter');
    await page.keyboard.type('to eat');
    await page.locator('[data-done]').click();
    await expect(page.locator('.ff-deck-head h1')).toHaveText('Verbs');
    await expect(page.locator('.ff-row')).toHaveCount(2);
    await expect(page.locator('.ff-row-def').nth(1)).toHaveText('to eat');
    const decks = await store(page);
    expect(decks).toHaveLength(1);
    expect(decks[0].cards).toHaveLength(2);
  });

  test('pasting a Quizlet export makes a deck', async ({ page }) => {
    await page.goto('/flashcards.html#/import');
    await page.locator('[data-tab="paste"]').click();
    await page.locator('.ff-paste').fill('perro\tdog\ngato\tcat\ncasa\thouse');
    await expect(page.locator('.ff-prev-head b')).toHaveText('3 cards found');
    await page.locator('#ffNewTitle').fill('Animals');
    await page.locator('[data-create]').click();
    await expect(page.locator('.ff-deck-head h1')).toHaveText('Animals');
    await expect(page.locator('.ff-row-term')).toHaveText(['perro', 'gato', 'casa']);
  });

  test('a share link opens on another device and copies the deck', async ({ page, browser }) => {
    await addSample(page, 'physics-si');
    await page.locator('[data-act="share"]').click();
    const url = await page.locator('.ff-modal input').inputValue();
    expect(url).toMatch(/#share=[zj][A-Za-z0-9_-]+$/);

    const other = await browser.newContext();
    const p2 = await other.newPage();
    await p2.goto(url);
    await expect(p2.locator('.ff-deck-head h1')).toHaveText('Physics: SI units');
    await expect(p2.locator('.ff-row')).toHaveCount(12);
    await p2.locator('[data-save]').click();
    await expect(p2).toHaveURL(/#\/deck\//);
    expect(await store(p2)).toHaveLength(1);
    await other.close();
  });

  test('Write accepts a typo, and Match can be won', async ({ page }) => {
    const deckUrl = await addSample(page, 'capitals');
    await page.goto(deckUrl + '/write');
    const prompt = (await page.locator('.ff-learn-q').textContent())!.trim();
    const answer = await page.evaluate((t) => {
      const d = JSON.parse(localStorage.getItem('flux_flash_decks_v1')!).decks[0];
      return d.cards.find((c: any) => c.term === t).def as string;
    }, prompt);
    await page.locator('[name="ans"]').fill(answer.toLowerCase());
    await page.locator('[name="ans"]').press('Enter');
    await expect(page.locator('.ff-verdict--ok')).toBeVisible();

    await page.goto(deckUrl + '/match');
    await page.locator('[data-go]').click();
    const tiles = page.locator('.ff-tile');
    await expect(tiles).toHaveCount(12);
    const pairs = await page.evaluate(() => {
      const d = JSON.parse(localStorage.getItem('flux_flash_decks_v1')!).decks[0];
      const byText: Record<string, string> = {};
      d.cards.forEach((c: any) => { byText[c.term] = c.id; byText[c.def] = c.id; });
      const groups: Record<string, number[]> = {};
      document.querySelectorAll<HTMLElement>('.ff-tile').forEach((t, i) => {
        const k = byText[t.textContent!.trim()];
        (groups[k] = groups[k] || []).push(i);
      });
      return Object.values(groups);
    });
    for (const [a, b] of pairs) {
      await tiles.nth(a).click();
      await tiles.nth(b).click();
    }
    await expect(page.locator('.ff-finish h2')).toContainText('seconds');
    expect((await store(page))[0].bestMatch).toBeGreaterThan(0);
  });

  test('a practice test marks itself', async ({ page }) => {
    const deckUrl = await addSample(page, 'chem-first-20');
    await page.goto(deckUrl + '/test');
    await page.locator('[name="count"]').fill('6');
    await page.locator('.ff-test-setup [type="submit"]').click();
    await expect(page.locator('.ff-q')).toHaveCount(6);
    await page.locator('.ff-test [type="submit"]').click();
    await expect(page.locator('.ff-score h2')).toHaveText('0 of 6 right');
    await expect(page.locator('.ff-q.is-wrong')).toHaveCount(6);
  });

  test('fits a phone without sideways scrolling', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 760 });
    const deckUrl = await addSample(page, 'ib-command-terms');
    for (const route of ['', '/learn', '/cards', '/edit', '/match']) {
      await page.goto(deckUrl + route);
      await page.waitForTimeout(200);
      const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(over, `${route || 'deck'} scrolls sideways`).toBeLessThanOrEqual(0);
    }
  });

  test('the planner carries decks in its cloud payload', async ({ page }) => {
    await page.goto('/?e2e=1&scenario=student-semester');
    await page.waitForFunction(() => !!(window as any).FluxFlash);
    const ok = await page.evaluate(() => {
      const F = (window as any).FluxFlash;
      F.putDeck(F.newDeck({ title: 'From the planner', cards: [{ term: 'a', def: 'b' }] }));
      const slice = F.getCloudSlice();
      return slice.decks.some((d: any) => d.title === 'From the planner');
    });
    expect(ok).toBe(true);
  });
});
