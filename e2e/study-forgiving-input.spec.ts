import { test, expect, type Page } from '@playwright/test';
import { gotoScenario } from './helpers';

/*
 * Study tools take what students actually type: a search in any word order
 * with a typo, a verb-drill answer with "¿…?" round it, a verb in English,
 * and reading time as "1h 30". The parsing is unit-tested in
 * test/unit/verb-drill and test/unit/reading-log; this drives the screens.
 */

async function openStudy(page: Page) {
  await gotoScenario(page, 'student-semester');
  await page.evaluate(() => (window as any).nav('toolbox'));
  await expect(page.locator('.fsh-pill').first()).toBeVisible();
}

async function search(page: Page, q: string) {
  await page.locator('#fshSearch').fill(q);
  await expect(page.locator('#fshStage h2')).toHaveText(`Results for "${q}"`);
  return page.locator('#fshStage .fsh-res');
}

test.describe('Study tools: forgiving input', () => {
  test('search finds tools from any word order, other word forms and a typo', async ({ page }) => {
    await openStudy(page);

    // The subject's name counts as part of every tool in it.
    const verbs = await search(page, 'spanish verbs');
    await expect(verbs.filter({ hasText: 'Verb drill' }).filter({ hasText: 'Spanish' })).toHaveCount(1);
    await expect(verbs.filter({ hasText: 'French' })).toHaveCount(0);

    // "conjugate" used to find nothing, because the tool is the "Conjugator".
    await expect((await search(page, 'conjugate')).filter({ hasText: 'Conjugator' })).toHaveCount(3);

    // Words apart in the keywords, and a swapped pair of letters.
    await expect((await search(page, 'molar mass calculator')).filter({ hasText: 'Chem Calculators' })).toHaveCount(1);
    await expect((await search(page, 'periodic tabel')).filter({ hasText: 'Periodic Table' })).toHaveCount(1);

    // Clicking a hit still opens the tool.
    await (await search(page, 'spanish verbs')).filter({ hasText: 'Verb drill' }).click();
    await expect(page.locator('#fvdRoot')).toBeVisible();

    // And nonsense still says so in words.
    await search(page, 'xqzv');
    await expect(page.locator('#fshStage')).toContainText('No matches');
  });

  test('the verb drill ignores punctuation and names a one-letter slip', async ({ page }) => {
    await openStudy(page);
    await page.evaluate(() => (window as any).fluxStudyHub.openTool('spanish', 'verbs'));
    await expect(page.locator('#fvdRoot')).toBeVisible();
    await expect(page.locator('#fvdRoot')).toContainText('Capitals, spaces and punctuation never count');

    // Present of hablar, yo only: every question is "hablo".
    const tenses = page.locator('input[name="fvdPtense"]');
    for (let i = 0; i < await tenses.count(); i++) {
      const t = tenses.nth(i);
      if ((await t.getAttribute('value')) === 'present') await t.check(); else await t.uncheck();
    }
    await page.locator('#fvdPset').selectOption('custom');
    await page.locator('#fvdPcustom').fill('hablar');
    const persons = page.locator('input[name="fvdPperson"]');
    for (let i = 0; i < 6; i++) { if (i === 0) await persons.nth(i).check(); else await persons.nth(i).uncheck(); }
    await page.locator('input[name="fvdPmode"][value="count"]').check();
    await page.locator('#fvdPcount').selectOption('5');
    await page.locator('#fvdStart').click();
    await expect(page.locator('#fvdIn')).toBeFocused();

    await page.locator('#fvdIn').fill('¿Yo, hablo?');
    await page.keyboard.press('Enter');
    await expect(page.locator('#fvdFb')).toHaveClass(/is-ok/);
    await expect(page.locator('#fvdScore')).toHaveText('1 right');

    // A typo is still a mistake, because spelling is what is being drilled, but it is named as one.
    await page.locator('#fvdIn').fill('hablol');
    await page.keyboard.press('Enter');
    await expect(page.locator('#fvdFb')).toHaveClass(/is-no/);
    await expect(page.locator('#fvdFb')).toContainText('So close — one letter off');
    await expect(page.locator('#fvdFb')).toContainText('yo hablo');
    await expect(page.locator('#fvdScore')).toHaveText('1 right');

    // Something far off gets no "so close".
    await page.keyboard.press('Enter');
    await page.locator('#fvdIn').fill('comemos');
    await page.keyboard.press('Enter');
    await expect(page.locator('#fvdFb')).toHaveClass(/is-no/);
    await expect(page.locator('#fvdFb')).not.toContainText('So close');
  });

  test('the conjugator takes stray punctuation and a verb typed in English', async ({ page }) => {
    await openStudy(page);
    await page.evaluate(() => (window as any).fluxStudyHub.openTool('spanish', 'conj'));
    const verb = page.locator('#lgVerb');
    const out = page.locator('#lgOut');
    await expect(verb).toBeVisible();

    await verb.fill('tener?');
    await verb.press('Enter');
    await expect(out).toContainText('tengo');

    await verb.fill('to speak');
    await verb.press('Enter');
    await expect(out).toContainText('“to speak” in Spanish is hablar.');
    await expect(out).toContainText('hablamos');

    // A word it cannot place says what to try, including English.
    await verb.fill('xyz');
    await verb.press('Enter');
    await expect(out.locator('.fsh-err')).toBeVisible();
    await expect(out).toContainText('You can also type it in English');

    await page.evaluate(() => (window as any).fluxStudyHub.openTool('german', 'conj'));
    await page.locator('#lgVerb').fill('to run');
    await page.locator('#lgVerb').press('Enter');
    await expect(page.locator('#lgOut')).toContainText('“to run” in German is laufen.');
    await expect(page.locator('#lgOut')).toContainText('läuft');
  });

  test('the reading log takes minutes as "1h 30" or "1:15", and explains anything else', async ({ page }) => {
    await gotoScenario(page, 'student-dashboard-widgets');
    const card = page.locator('#readingLogCard');
    await expect(card).toBeVisible();
    await card.getByLabel('What are you reading?').fill('Macbeth');
    await card.getByRole('button', { name: 'Add book' }).click();
    await expect(card.getByLabel('Minutes')).toBeFocused();

    await card.getByLabel('Minutes').fill('lots');
    await card.getByRole('button', { name: 'Log today' }).click();
    await expect(card.locator('#frlQuickMsg')).toHaveText(/Type minutes like 25, 1h 30 or 1:30/);

    await card.getByLabel('Minutes').fill('1h 30');
    await card.getByRole('button', { name: 'Log today' }).click();
    await expect(card.locator('#frlQuickMsg')).toHaveText('Logged 1 hour 30 minutes of Macbeth for today.');

    await card.getByLabel('Minutes').fill('0:15');
    await card.getByRole('button', { name: 'Log today' }).click();
    await expect(card.locator('#frlQuickMsg')).toHaveText('Logged 15 minutes of Macbeth for today.');
    await expect(card).toContainText('Today: 1 h 45 min');
  });
});
