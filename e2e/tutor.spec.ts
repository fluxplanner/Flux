import { test, expect, Page, Locator } from '@playwright/test';

/*
 * Flux Tutor (teacher.html): the library of study sets and, for one set, the
 * study guide, Learn, the practice test, flashcards, "Ask your notes" and the
 * study plan. The text logic is unit-tested (test/unit/tutor-core.test.mjs)
 * and saving has its own spec (e2e/tutor-store.spec.ts); this is about what
 * the student sees and does, and that it is all still there after a reload.
 */

const APP = '/teacher.html';
const EVIL = '<img src=x onerror=window.__x=1>';

/** The open set as saved, read through the store's own API in the page. */
async function stored(page: Page) {
  return page.evaluate(async () => {
    const m = /#set\/([^/?]+)/.exec(location.hash);
    if (!m) return null;
    const w = window as any;
    const store = await w.FluxTutorStore.open({ purge: false, BroadcastChannel: null });
    const set = await store.get(decodeURIComponent(m[1]));
    store.close();
    return set;
  });
}

async function saved(page: Page) {
  await expect(page.locator('#ftSaveState')).toHaveText('Saved');
}

/** The question on screen (Learn or the quick check), from the saved set. */
async function questionOnScreen(page: Page) {
  await saved(page);
  const qid = await page.locator('form.ft-question[data-qid]').getAttribute('data-qid');
  let q: any = null;
  await expect.poll(async () => {
    const set: any = await stored(page);
    const l = set && set.learn;
    if (!l) return false;
    q = l.check.questions.find((x: any) => x.id === qid) || (l.steps.find((s: any) => s.q.id === qid) || {}).q || null;
    return !!q;
  }).toBe(true);
  return q;
}

/** Answer a question, rightly or wrongly. */
async function answer(scope: Locator, q: any, right: boolean) {
  if (q.type === 'mc' || q.type === 'mcdef') {
    const pick = right ? q.answer : q.options.find((o: string) => o !== q.answer);
    await scope.getByRole('radio', { name: pick, exact: true }).check();
  } else if (q.type === 'tf') {
    const truth = q.answer === 'true';
    await scope.getByRole('radio', { name: (right ? truth : !truth) ? 'True' : 'False', exact: true }).check();
  } else if (q.type === 'cloze' || q.type === 'written') {
    await scope.locator('input[name="answer"]').fill(right ? q.answer : 'qwertyuiop');
  } else if (q.type === 'match') {
    for (const p of q.pairs) {
      const wrong = q.options.find((o: string) => o !== p.term);
      await scope.locator(`select[data-concept="${p.conceptId}"]`).selectOption(right ? p.term : wrong);
    }
  } else throw new Error('unknown question type ' + q.type);
}

async function openSample(page: Page) {
  await page.goto(APP);
  await expect(page.getByRole('heading', { name: 'Your study sets' })).toBeVisible();
  await page.getByRole('button', { name: 'Try it with a sample' }).click();
  await expect(page).toHaveURL(/#set\/[^/]+\/guide$/);
  await expect(page.getByRole('heading', { name: 'Study guide' })).toBeVisible();
}

function tab(page: Page, name: string) {
  return page.getByRole('navigation', { name: 'Study set' }).getByRole('link', { name, exact: true });
}

test.describe('Flux Tutor', () => {
  test('a sample set: guide, Learn, practice test, flashcards, ask, plan, and all of it after a reload', async ({ page }) => {
    test.setTimeout(150_000);
    const errors: string[] = [];
    const external: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('request', (r) => { if (!/^(http:\/\/127\.0\.0\.1|blob:|data:)/.test(r.url())) external.push(r.url()); });

    await page.goto(APP);
    await expect(page.getByText('Flux Tutor works only from your notes — it doesn\'t make things up.')).toBeVisible();
    await page.getByRole('button', { name: 'Try it with a sample' }).click();

    // ── Study guide: every item cites the notes; the student fixes a term.
    await expect(page).toHaveURL(/#set\/[^/]+\/guide$/);
    await expect(page.getByRole('heading', { name: 'Study guide' })).toBeFocused();
    await expect(page.getByRole('heading', { name: 'Outline' })).toBeVisible();
    await expect(page.locator('.ft-outline')).toContainText('Photosynthesis');
    const cell = page.locator('.ft-item').filter({ has: page.locator('dfn', { hasText: /^Cell$/ }) });
    await expect(cell).toContainText('The basic unit of life.');
    await expect(cell.locator('cite')).toHaveText('Sample biology notes · paragraph 1');
    await expect(page.locator('.ft-item').filter({ hasText: 'In 1665, Robert Hooke' }).first().locator('cite')).toHaveText('Sample biology notes · paragraph 4');
    await page.getByRole('button', { name: 'Edit Cell', exact: true }).click();
    await expect(page.locator('#ftEditTerm')).toBeFocused();
    await page.locator('#ftEditDef').fill('The smallest unit of life (in my words).');
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(cell).toContainText('The smallest unit of life (in my words).');
    await expect(cell.locator('cite')).toHaveText('Sample biology notes · paragraph 1 · edited by you');
    await expect(page.getByRole('button', { name: 'Edit Cell', exact: true })).toBeFocused();
    // Escape cancels an edit.
    await page.getByRole('button', { name: 'Edit Glucose', exact: true }).click();
    await page.locator('#ftEditDef').fill('changed my mind');
    await page.keyboard.press('Escape');
    await expect(page.locator('#ftEditDef')).toHaveCount(0);
    await expect(page.locator('.ft-item').filter({ has: page.locator('dfn', { hasText: /^Glucose$/ }) })).toContainText('A sugar that cells use');
    // Delete, then undo.
    await page.getByRole('button', { name: 'Delete Glucose', exact: true }).click();
    await expect(page.locator('dfn', { hasText: /^Glucose$/ })).toHaveCount(0);
    await expect(page.locator('.ft-toast')).toContainText('Deleted “Glucose” from the study guide.');
    await expect(page.locator('.ft-toast').getByRole('button', { name: 'Undo' })).toBeFocused();
    await page.locator('.ft-toast').getByRole('button', { name: 'Undo' }).click();
    await expect(page.locator('dfn', { hasText: /^Glucose$/ })).toHaveCount(1);
    // Add a term of your own.
    await page.locator('#ftNewTerm').fill('Stomata');
    await page.locator('#ftNewDef').fill('Tiny holes in a leaf that let gases in and out.');
    await page.getByRole('button', { name: 'Add term' }).click();
    await expect(page.locator('.ft-item').filter({ has: page.locator('dfn', { hasText: /^Stomata$/ }) }).locator('cite')).toHaveText('Added by you');
    await saved(page);

    // ── Learn: pick topics, a quick check, then small steps.
    await tab(page, 'Learn').click();
    await expect(page).toHaveURL(/\/learn$/);
    await expect(page.getByRole('heading', { name: 'Learn', exact: true })).toBeFocused();
    await page.getByRole('checkbox', { name: 'Photosynthesis' }).check();
    await page.getByRole('button', { name: 'Start learning' }).click();
    await expect(page.locator('#ftStepTitle')).toHaveText(/^Question 1 of [345]$/);
    await expect(page.locator('#ftStepTitle')).toBeFocused();
    const checks = Number(/of (\d)/.exec((await page.locator('#ftStepTitle').textContent()) || '')![1]);
    let fromNotes = 0;
    for (let i = 0; i < checks; i++) {
      const q = await questionOnScreen(page);
      const form = page.locator('form.ft-question');
      if (i < 2) {
        await answer(form, q, i === 0);
        await form.getByRole('button', { name: 'Check' }).click();
      } else await page.getByRole('button', { name: 'I’m not sure' }).click();
      const fb = page.locator('#ftFeedback');
      await expect(fb).toContainText(i === 0 ? 'Right.' : i === 1 ? 'Not quite.' : 'Here is the answer.');
      // The feedback quotes the notes (or, for the term edited above, the student's own words), with where it is.
      await expect(fb.locator('.ft-quote-label').first()).toHaveText(/^From your (notes|study guide)$/);
      await expect(fb.locator('.ft-quote cite').first()).toHaveText(/^(Sample biology notes · paragraph \d+|Your study guide \(written by you\))$/);
      fromNotes += await fb.locator('.ft-quote-label', { hasText: 'From your notes' }).count();
      if (i > 0) await expect(fb).toContainText(q.type === 'match' ? '' : 'Answer:');
      await expect(page.locator('#ftNextBtn')).toBeFocused();
      await page.locator('#ftNextBtn').click();
    }
    expect(fromNotes).toBeGreaterThan(0);
    await expect(page.locator('.ft-notice')).toContainText('Quick check: 1 of ' + checks + ' right.');
    await expect(page.locator('#ftStepTitle')).toBeFocused();
    await expect(page.locator('.ft-kicker').first()).toHaveText('Step 1');

    // Step 1 teaches first: what the notes say, then a question.
    await expect(page.locator('.ft-explain')).toContainText('What your notes say');
    await expect(page.locator('.ft-explain cite').first()).toHaveText(/^Sample biology notes · paragraph \d+$/);
    let q = await questionOnScreen(page);
    await answer(page.locator('form.ft-question'), q, true);
    await page.locator('form.ft-question').getByRole('button', { name: 'Check' }).click();
    await expect(page.locator('#ftFeedback')).toContainText('Right.');
    await expect(page.locator('.ft-mastery')).toBeVisible();
    await expect(page.locator('#ftLive')).not.toHaveText('');
    // Simpler, and another example (until the notes run out, which it says).
    await page.getByRole('button', { name: 'Simpler' }).click();
    await expect(page.getByRole('heading', { name: 'Simpler' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Hide simpler' })).toBeFocused();
    const label = ((await page.locator('#ftStepTitle').textContent()) || '').replace(/^New: /, '');
    for (let n = 0; n < 12 && await page.getByRole('button', { name: 'Another example' }).count(); n++) {
      await page.getByRole('button', { name: 'Another example' }).click();
      await expect(page.locator('#ftExampleTitle')).toBeVisible();
    }
    await expect(page.locator('#ftNoMore')).toHaveText(`Your notes have no more examples of “${label}”.`);
    await saved(page);

    // Next, Skip, Back (the skipped step, read-only), forward again, Repeat.
    await page.getByRole('button', { name: 'Next', exact: true }).click();
    await expect(page.locator('.ft-kicker').first()).toHaveText('Step 2');
    await expect(page.locator('#ftStepTitle')).toBeFocused();
    const step2 = await page.locator('#ftStepTitle').textContent();
    await page.getByRole('button', { name: 'Skip' }).click();
    await expect(page.locator('.ft-kicker').first()).toHaveText('Step 3');
    await page.getByRole('button', { name: 'Back' }).click();
    await expect(page.locator('.ft-kicker').first()).toHaveText('Step 2 · looking back');
    await expect(page.locator('#ftStepTitle')).toHaveText(step2!);
    await expect(page.locator('#ftFeedback')).toContainText('Skipped.');
    await expect(page.locator('form.ft-question').getByRole('button', { name: 'Check' })).toHaveCount(0);
    await page.getByRole('button', { name: 'Next', exact: true }).click();
    await expect(page.locator('.ft-kicker').first()).toHaveText('Step 3');
    q = await questionOnScreen(page);
    await answer(page.locator('form.ft-question'), q, false);
    await page.locator('form.ft-question').getByRole('button', { name: 'Check' }).click();
    await expect(page.locator('#ftFeedback')).toContainText(/Not quite\.|Partly right\./);
    const step3 = ((await page.locator('#ftStepTitle').textContent()) || '').replace(/^New: /, '');
    await page.getByRole('button', { name: 'Repeat' }).click();
    await expect(page.locator('.ft-kicker').first()).toHaveText('Step 4');
    await expect(page.locator('#ftStepTitle')).toHaveText(step3);
    await saved(page);
    const learnSaved: any = await stored(page);
    expect(learnSaved.learn.steps.length).toBe(4);
    expect(learnSaved.learn.steps[1].rec.verdict).toBe('skipped');

    // ── Practice test: answer one, leave the rest, review what was missed.
    await tab(page, 'Practice test').click();
    await page.getByLabel('Questions').selectOption('5');
    await page.getByRole('button', { name: 'Start the test' }).click();
    await expect(page.locator('.ft-test-q')).toHaveCount(5);
    const qs = await page.evaluate(() => {
      const k = Object.keys(sessionStorage).find((x) => x.startsWith('flux_tutor.v2.test.'));
      return JSON.parse(sessionStorage.getItem(k!)!).qs;
    });
    await answer(page.locator(`.ft-test-q[data-qid="${qs[0].id}"]`), qs[0], true);
    await page.getByRole('button', { name: 'Finish and mark' }).click();
    await expect(page.getByRole('heading', { name: 'Your result' })).toBeFocused();
    await expect(page.locator('.ft-score')).toContainText('1 of 5');
    const missed = page.locator('.ft-review > .ft-review-item.is-wrong');
    await expect(missed).toHaveCount(4);
    await expect(missed.first()).toContainText('You left this blank.');
    await expect(missed.first()).toContainText('Answer:');
    await expect(missed.first().locator('.ft-quote cite').first()).toHaveText(/^(Sample biology notes · paragraph \d+|Your study guide.*)$/);
    await page.getByRole('button', { name: 'Take another test' }).click();
    await expect(page.getByRole('heading', { name: 'Your past tests' })).toBeVisible();
    await expect(page.locator('.ft-history > li')).toHaveCount(1);
    await expect(page.locator('.ft-history')).toContainText('1 of 5 right');
    // A timed test shows its clock and is marked when the time runs out (also after a reload).
    await page.getByLabel('Questions').selectOption('5');
    await page.getByLabel('Timer').selectOption('5');
    await page.getByRole('button', { name: 'Start the test' }).click();
    await expect(page.locator('#ftTimerText')).toHaveText(/^[45]:\d\d$/);
    await page.evaluate(() => {
      const k = Object.keys(sessionStorage).find((x) => x.startsWith('flux_tutor.v2.test.'))!;
      const t = JSON.parse(sessionStorage.getItem(k)!);
      t.deadline = Date.now() - 1000;
      sessionStorage.setItem(k, JSON.stringify(t));
    });
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Your result' })).toBeVisible();
    await expect(page.getByText('Time ran out, so the test was marked as it was.')).toBeVisible();
    await saved(page);

    // ── Flashcards: rate cards; send them to Flux Flashcards.
    await tab(page, 'Flashcards').click();
    await expect(page.locator('#ftCardCounts')).toHaveText(/^0 due · 23 new · 0 later$/);
    await page.getByRole('button', { name: 'Show answer' }).click();
    await expect(page.locator('#ftFlashDef')).toBeVisible();
    await expect(page.getByRole('button', { name: /^Good, see it again in/ })).toBeFocused();
    await page.getByRole('button', { name: /^Good, see it again in/ }).click();
    await expect(page.locator('#ftCardCounts')).toHaveText('0 due · 22 new · 1 later');
    await expect(page.locator('#ftFlipBtn')).toBeFocused();
    await page.keyboard.press('Space');
    await expect(page.locator('#ftFlashDef')).toBeVisible();
    await page.keyboard.press('4');
    await expect(page.locator('#ftCardCounts')).toHaveText('0 due · 21 new · 2 later');
    await page.getByRole('button', { name: 'Send to Flux Flashcards' }).click();
    await expect(page.locator('.ft-toast')).toContainText('Sent 23 cards to Flux Flashcards.');
    const deck = await page.evaluate(() => JSON.parse(localStorage.getItem('flux_flash_decks_v1') || '{}').decks[0]);
    expect(deck.cards.length).toBe(23);
    expect(deck.title).toBe('Sample: Cells and energy');
    await page.getByRole('button', { name: 'Send to Flux Flashcards' }).click();
    await expect(page.locator('.ft-toast')).toContainText('Updated your Flux Flashcards deck: 0 new cards, 0 cards changed.');
    await expect(page.getByRole('link', { name: 'Open the deck' })).toHaveAttribute('href', `flashcards.html#/deck/${deck.id}`);

    // ── Ask your notes: a match with highlights and its source, then an honest miss.
    await tab(page, 'Ask your notes').click();
    await page.getByLabel('Your question').fill('What does the cell wall do?');
    await page.getByRole('button', { name: 'Search' }).click();
    const first = page.locator('.ft-result').first();
    await expect(first).toContainText('rigid layer made of cellulose');
    await expect(first.locator('mark').first()).toBeVisible();
    await expect(first.locator('cite')).toHaveText('Sample biology notes · paragraph 3');
    await expect(page).toHaveURL(/\/ask\?q=What%20does%20the%20cell%20wall%20do%3F$/);
    await page.getByLabel('Your question').fill('volcano eruption');
    await page.getByRole('button', { name: 'Search' }).click();
    await expect(page.locator('.ft-none')).toContainText('Nothing in your notes covers that.');
    await expect(page.locator('.ft-none')).toContainText('Your notes never use: volcano, eruption.');
    await expect(page.locator('.ft-result')).toHaveCount(0);

    // ── Study plan with an exam date; tick the first item.
    await tab(page, 'Study plan').click();
    const exam = await page.evaluate(() => { const T = (window as any).FluxTutor; return T.addDays(T.ymd(), 7); });
    await page.getByLabel('Exam date').fill(exam);
    await page.getByRole('button', { name: 'Make my plan' }).click();
    await expect(page.locator('.ft-lead').first()).toContainText('7 days until your exam');
    await expect(page.locator('.ft-plan-date').first()).toHaveText('Today');
    await expect(page.locator('.ft-plan-item').first()).toContainText('Learn:');
    await page.locator('.ft-plan-item input[type="checkbox"]').first().check();
    await expect(page.locator('#ftPlanCount')).toContainText(/^1 of \d+ done\.$/);
    await expect(page.locator('#ftSetSub')).toContainText('Exam in 7 days');
    await saved(page);

    // ── Reload: the same screen, with everything kept.
    await page.reload();
    await expect(page).toHaveURL(/\/plan$/);
    await expect(page.locator('.ft-plan-item input[type="checkbox"]').first()).toBeChecked();
    await tab(page, 'Study guide').click();
    await expect(cell).toContainText('The smallest unit of life (in my words).');
    await expect(page.locator('dfn', { hasText: /^Stomata$/ })).toHaveCount(1);
    await tab(page, 'Learn').click();
    await expect(page.locator('.ft-kicker').first()).toHaveText('Step 4');
    await tab(page, 'Practice test').click();
    await expect(page.getByRole('heading', { name: 'Your result' })).toBeVisible();
    await page.getByRole('button', { name: 'Take another test' }).click();
    await expect(page.locator('.ft-history > li')).toHaveCount(2);
    await tab(page, 'Flashcards').click();
    await expect(page.locator('#ftCardCounts')).toHaveText('0 due · 21 new · 2 later');
    await page.goto(page.url().replace(/\/flashcards$|\/cards$/, '/ask?q=chlorophyll'));
    await expect(page.locator('.ft-result').first()).toContainText('Chlorophyll is the green pigment');
    await page.getByRole('link', { name: 'All study sets' }).click();
    const card = page.locator('.ft-set-card');
    await expect(card).toContainText('Last studied today');
    await expect(card).toContainText('Exam in 7 days');
    await expect(card).toContainText(/\d+ of 23 terms mastered/);

    expect(errors).toEqual([]);
    expect(external).toEqual([]);
  });

  test('library: rename, duplicate, delete with undo, export and import', async ({ page }) => {
    await openSample(page);
    await page.getByRole('link', { name: 'All study sets' }).click();
    await expect(page.getByRole('heading', { name: 'Your study sets' })).toBeFocused();
    await expect(page.locator('.ft-set-card')).toHaveCount(1);
    await expect(page.locator('.ft-set-card')).toContainText('0 of 22 terms mastered');

    // Rename: a blank name is refused, Escape closes the dialog and focus comes back.
    const rename = page.getByRole('button', { name: 'Rename Sample: Cells and energy' });
    await rename.click();
    const dialog = page.getByRole('dialog', { name: 'Rename study set' });
    await expect(dialog.getByLabel('Name')).toBeFocused();
    await dialog.getByLabel('Name').fill('  ');
    await dialog.getByRole('button', { name: 'Save' }).click();
    await expect(dialog.getByRole('alert')).toHaveText('Give the study set a name.');
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(rename).toBeFocused();
    await rename.click();
    await dialog.getByLabel('Name').fill('Biology unit 2');
    await dialog.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByRole('link', { name: 'Biology unit 2', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Rename Biology unit 2', exact: true })).toBeFocused();

    // Duplicate.
    await page.getByRole('button', { name: 'Duplicate Biology unit 2', exact: true }).click();
    await expect(page.getByRole('link', { name: 'Biology unit 2 (copy)', exact: true })).toBeVisible();
    await expect(page.locator('.ft-set-card')).toHaveCount(2);

    // Delete, then Undo from the toast.
    await page.getByRole('button', { name: 'Delete Biology unit 2 (copy)', exact: true }).click();
    await expect(page.getByRole('link', { name: 'Biology unit 2 (copy)', exact: true })).toHaveCount(0);
    const toast = page.locator('.ft-toast');
    await expect(toast).toContainText('Deleted “Biology unit 2 (copy)”.');
    await expect(toast.getByRole('button', { name: 'Undo' })).toBeFocused();
    await toast.getByRole('button', { name: 'Undo' }).click();
    await expect(page.getByRole('link', { name: 'Biology unit 2 (copy)', exact: true })).toBeVisible();

    // Deleted again, it waits in Recently deleted.
    await page.getByRole('button', { name: 'Delete Biology unit 2 (copy)', exact: true }).click();
    await page.getByText('Recently deleted (1)').click();
    await expect(page.getByRole('button', { name: 'Restore Biology unit 2 (copy)', exact: true })).toBeVisible();

    // Export, then import the file: it comes back as a new set beside the first.
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'Export Biology unit 2', exact: true }).click(),
    ]);
    expect(download.suggestedFilename()).toBe('biology-unit-2.flux-tutor.json');
    const file = await download.path();
    await page.locator('#ftImportFile').setInputFiles(file!);
    await expect(page.locator('.ft-toast')).toContainText('Imported 1 study set.');
    await expect(page.getByRole('link', { name: 'Biology unit 2', exact: true })).toHaveCount(2);
    // A file that is not an export is refused in plain words.
    await page.locator('#ftImportFile').setInputFiles({ name: 'notes.json', mimeType: 'application/json', buffer: Buffer.from('{"hello":1}') });
    await expect(page.locator('#ftLibAlert')).toHaveText('This file is not a Flux Tutor export.');

    await page.reload();
    await expect(page.getByRole('link', { name: 'Biology unit 2', exact: true })).toHaveCount(2);
    await expect(page.getByText('Recently deleted (1)')).toBeVisible();
    // The imported copy opens with its guide.
    await page.getByRole('link', { name: 'Biology unit 2', exact: true }).first().click();
    await expect(page.getByRole('heading', { name: 'Study guide' })).toBeFocused();
    await expect(page.locator('.ft-item dfn').first()).toHaveText('Cell');
  });

  test('the first beta\'s saved session becomes a study set, with what the student wrote', async ({ page }) => {
    const material = 'Natural selection is the process by which organisms with useful traits survive and reproduce more often. '
      + 'A mutation is a change in the DNA of an organism. Allele frequency is how common an allele is in a population. '
      + 'Over many generations, natural selection changes allele frequency because individuals with helpful alleles leave more offspring.';
    const session = {
      topic: 'Natural selection', subject: 'Biology', sourceTitle: 'Class notes', sourceUrl: '', material, attachments: [], question: '',
      warmup: 'Survival of the fittest?', teachback: 'Useful traits spread through a population.', explain: { 0: 'How common an allele is.' }, answers: {},
      confidence: 'teach-it', step: 3, noteIndex: 0, questionIndex: 0, showSource: false, completedAt: '',
    };
    const beta = { draft: { topic: 'Natural selection', subject: 'Biology', sourceTitle: 'Class notes', sourceUrl: '', material, question: '', attachments: [] }, session };
    await page.goto(APP);
    await expect(page.getByRole('heading', { name: 'Your study sets' })).toBeVisible();
    await page.evaluate((b) => localStorage.setItem('flux_teacher.beta.v1', JSON.stringify(b)), beta);
    await page.reload();
    await expect(page.locator('.ft-notice')).toContainText('Your session from the first Flux Tutor beta is now a study set below');
    await expect(page.locator('.ft-set-card')).toHaveCount(1);
    await page.getByRole('link', { name: 'Natural selection', exact: true }).click();
    await expect(page).toHaveURL(/\/guide$/);
    await expect(page.getByRole('heading', { name: 'From the first Flux Tutor beta' })).toBeVisible();
    await expect(page.locator('.ft-legacy')).toContainText('Useful traits spread through a population.');
    await expect(page.locator('.ft-legacy')).toContainText('Survival of the fittest?');
    // The guide is built from the beta's notes when the set is first opened.
    await expect(page.locator('dfn', { hasText: /^Mutation$/ })).toHaveCount(1);
    await expect(page.locator('.ft-item').filter({ has: page.locator('dfn', { hasText: /^Mutation$/ }) }).locator('cite')).toHaveText('Class notes · paragraph 1');
    expect(await page.evaluate(() => localStorage.getItem('flux_teacher.beta.v1'))).toBeNull();
    await page.reload();
    await expect(page.locator('.ft-legacy')).toContainText('Useful traits spread through a population.');
    await page.getByRole('link', { name: 'All study sets' }).click();
    await expect(page.locator('.ft-set-card')).toHaveCount(1);
  });

  test('notes, titles and file names are shown as text, never run', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(APP);
    await page.getByRole('link', { name: 'New study set' }).click();
    await expect(page).toHaveURL(/#new$/);
    await expect(page.getByLabel('Title')).toBeFocused();
    await page.getByLabel('Title').fill(EVIL);
    await expect(page).toHaveURL(/#set\/[^/]+\/notes$/);
    await page.locator('textarea[data-src-text]').first().fill(`# Cells ${EVIL}\n\nThe cell is the basic unit of life ${EVIL}. `
      + 'Osmosis is the diffusion of water across a membrane. Diffusion is the movement of particles from high to low concentration. '
      + `Enzymes are proteins that speed up reactions. ${EVIL} Ribosomes are tiny structures that build proteins.`);
    await page.locator('#ftMaterialFiles').setInputFiles({ name: `${EVIL}.txt`, mimeType: 'text/plain', buffer: Buffer.from(`Mitochondria are the organelles where respiration happens. ${EVIL}`) });
    await expect(page.locator('.ft-source-name').nth(1)).toHaveText(`${EVIL}.txt`);
    await expect(page.locator('#ftUploadStatus')).toContainText('1 file added below');
    await page.getByRole('button', { name: 'Build my study guide' }).click();
    await expect(page).toHaveURL(/\/guide$/);
    await expect(page.locator('#ftSetName')).toHaveText(EVIL);
    // (The notes' markdown underscores are tidied away, so the outline shows "window.x".)
    await expect(page.locator('.ft-outline')).toContainText('Cells <img src=x onerror=window.x=1>');
    await expect(page.locator('main')).toContainText(EVIL);
    await tab(page, 'Ask your notes').click();
    await page.getByLabel('Your question').fill('onerror img');
    await page.getByRole('button', { name: 'Search' }).click();
    await expect(page.locator('.ft-result').first()).toContainText(EVIL);
    await page.getByRole('link', { name: 'All study sets' }).click();
    await expect(page.locator('.ft-set-title')).toHaveText(EVIL);
    await page.waitForTimeout(300);
    expect(await page.locator('main img, .ft-toasts img').count()).toBe(0);
    expect(await page.evaluate(() => [typeof (window as any).__x, typeof (window as any).x])).toEqual(['undefined', 'undefined']);
    expect(errors).toEqual([]);
  });

  test('when the browser will not save, the student is told plainly', async ({ page }) => {
    await openSample(page);
    await saved(page);
    // The disk fills up: the next save fails, and the screen says so.
    await page.evaluate(() => {
      IDBObjectStore.prototype.put = function () { throw new DOMException('The disk is full.', 'QuotaExceededError'); };
    });
    await page.getByRole('button', { name: 'Edit Cell', exact: true }).click();
    await page.locator('#ftEditDef').fill('A change that cannot be saved.');
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.locator('#ftSaveState')).toHaveText('Not saved');
    await expect(page.locator('#ftStoreAlert')).toHaveText(/^There is no room left in this browser to save Flux Tutor sets/);
  });

  test('a private window that blocks storage still works, and says nothing is kept', async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(window, 'indexedDB', { get() { return undefined; } });
      Storage.prototype.setItem = function () { const e = new Error('The operation is insecure.'); e.name = 'SecurityError'; throw e; };
    });
    await openSample(page);
    await expect(page.locator('.ft-warn')).toContainText('This browser is not letting Flux save anything');
    await expect(page.locator('#ftSaveState')).toHaveText('Only kept in this tab');
  });

  test('fits a 390px phone with no sideways scroll, dark and light', async ({ page }) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ width: 390, height: 844 });
    const wide = () => page.evaluate(() => document.documentElement.scrollWidth);
    for (const scheme of ['dark', 'light'] as const) {
      await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' });
      await openSample(page);
      expect(await wide()).toBeLessThanOrEqual(390);
      const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
      expect(bg).toBe(scheme === 'dark' ? 'rgb(8, 13, 24)' : 'rgb(243, 246, 251)');
      await tab(page, 'Notes').click();
      expect(await wide()).toBeLessThanOrEqual(390);
      await tab(page, 'Learn').click();
      await page.getByRole('button', { name: 'Start learning' }).click();
      await expect(page.locator('#ftStepTitle')).toBeVisible();
      expect(await wide()).toBeLessThanOrEqual(390);
      await page.getByRole('button', { name: 'I’m not sure' }).click();
      await expect(page.locator('#ftFeedback')).toBeVisible();
      expect(await wide()).toBeLessThanOrEqual(390);
      await tab(page, 'Practice test').click();
      await page.getByLabel('Timer').selectOption('10');
      await page.getByRole('button', { name: 'Start the test' }).click();
      await expect(page.locator('.ft-test-q').first()).toBeVisible();
      expect(await wide()).toBeLessThanOrEqual(390);
      await page.getByRole('button', { name: 'Finish and mark' }).click();
      await expect(page.getByRole('heading', { name: 'Your result' })).toBeVisible();
      expect(await wide()).toBeLessThanOrEqual(390);
      await tab(page, 'Flashcards').click();
      await page.getByRole('button', { name: 'Show answer' }).click();
      expect(await wide()).toBeLessThanOrEqual(390);
      await tab(page, 'Ask your notes').click();
      await page.getByLabel('Your question').fill('energy from glucose');
      await page.getByRole('button', { name: 'Search' }).click();
      await expect(page.locator('.ft-result').first()).toBeVisible();
      expect(await wide()).toBeLessThanOrEqual(390);
      await tab(page, 'Study plan').click();
      const exam = await page.evaluate(() => { const T = (window as any).FluxTutor; return T.addDays(T.ymd(), 10); });
      await page.getByLabel('Exam date').fill(exam);
      await page.getByRole('button', { name: 'Make my plan' }).click();
      await expect(page.locator('.ft-plan-day').first()).toBeVisible();
      expect(await wide()).toBeLessThanOrEqual(390);
      await page.getByRole('link', { name: 'All study sets' }).click();
      await expect(page.locator('.ft-set-card').first()).toBeVisible();
      expect(await wide()).toBeLessThanOrEqual(390);
      await page.getByRole('link', { name: 'New study set' }).click();
      expect(await wide()).toBeLessThanOrEqual(390);
    }
  });
});
