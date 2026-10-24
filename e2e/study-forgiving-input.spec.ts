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
    // German draws once its engine is in; typing before that went into the
    // Spanish box, and German then showed its sample verb.
    await expect(page.locator('#lgOut').locator('xpath=..').locator('h3')).toContainText('German conjugator');
    await page.locator('#lgVerb').fill('to run');
    await page.locator('#lgVerb').press('Enter');
    await expect(page.locator('#lgOut')).toContainText('“to run” in German is laufen.');
    await expect(page.locator('#lgOut')).toContainText('läuft');
  });

  test('the reading log takes minutes as "1h 30" or "0:15", and explains anything else', async ({ page }) => {
    await gotoScenario(page, 'student-dashboard-widgets');
    await page.evaluate(() => (window as any).FluxReadingLog.open('books'));
    await expect(page.locator('#readingLog.panel.active')).toBeVisible();
    await page.locator('#frlBookTitle').fill('Macbeth');
    await page.getByRole('button', { name: 'Save book' }).click();
    await expect(page.locator('#frlBookMsg')).toHaveText('Added Macbeth.');
    await page.locator('#frlTab-log').click();
    const today = await page.evaluate(() => (window as any).FluxReadingLogCore.ymd(new Date()));
    const minutes = page.locator('#frlEntryMin');
    await expect(minutes).toHaveAttribute('placeholder', '25 or 1h 30');

    await page.locator('#frlEntryDate').fill(today);
    await minutes.fill('lots');
    await page.getByRole('button', { name: 'Save entry' }).click();
    await expect(page.locator('#frlEntryMsg')).toHaveText('Type minutes like 25, 1h 30 or 1:30, up to 24 hours.');
    await expect(minutes).toBeFocused();

    await minutes.fill('1h 30');
    await page.getByRole('button', { name: 'Save entry' }).click();
    await expect(page.locator('#frlEntryMsg')).toHaveText('Saved: Macbeth, today.');
    await expect(page.locator('#frlEntries')).toContainText('1 h 30 min');

    await page.locator('#frlEntryDate').fill(today);
    await minutes.fill('0:15');
    await page.getByRole('button', { name: 'Save entry' }).click();
    await expect(page.locator('#frlEntryMsg')).toHaveText('Saved: Macbeth, today.');
    await expect(page.locator('#frlEntries')).toContainText('15 min');
  });
});
