import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/*
 * Flux Lingo (translate.html): the conjugator and practice. The forms
 * themselves are checked in test/unit/conj.test.mjs; this drives the page.
 */

async function open(page: Page, hash = '') {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/translate.html' + hash);
  return errors;
}

test.describe('Flux Lingo', () => {
  test('is called Flux Lingo, and Conjugate is the first tab', async ({ page }) => {
    await open(page);
    await expect(page).toHaveTitle(/Flux Lingo/);
    await expect(page.locator('.title')).toContainText('Flux Lingo');
    await expect(page.locator('.lg-tab[data-tab="conjugate"]')).toHaveAttribute('aria-selected', 'true');
  });

  test('an English phrase finds the Spanish and French form it means', async ({ page }) => {
    const errors = await open(page, '#es');
    await page.locator('#lgQ').fill('we will speak');
    await expect(page.locator('.lg-opt').first()).toContainText('hablar');
    await expect(page.locator('.lg-opt').first()).toContainText('hablaremos');
    await page.keyboard.press('Enter');
    await expect(page.locator('.lg-inf')).toHaveText('hablar');
    await expect(page.locator('[data-cell="future-3"]')).toHaveClass(/is-flash/);
    await open(page, '#fr');
    await page.locator('#lgQ').fill('I ate');
    await expect(page.locator('.lg-opt').first()).toContainText('manger');
    await page.keyboard.press('Enter');
    await expect(page.locator('.lg-inf')).toHaveText('manger');
    await expect(page.locator('[data-cell="passeCompose-0"]')).toHaveClass(/is-flash/);
    expect(errors).toEqual([]);
  });

  test('Find the form you need: pick who and the tense, see the form and what the tense is for', async ({ page }) => {
    const errors = await open(page, '#es/tener');
    await page.locator('#lgFindTense').selectOption('subjImperfect');
    await page.locator('#lgFindWho').selectOption('3');
    await expect(page.locator('#lgFindOut .lg-find-form')).toHaveText('tuviéramos');
    await expect(page.locator('#lgFindOut')).toContainText('si clauses');
    // A tense the Essentials view hides is shown when asked for.
    await page.locator('#lgFindTense').selectOption('subjFuture');
    await expect(page.locator('[data-cell="subjFuture-3"]')).toHaveClass(/is-flash/);
    await open(page, '#fr/aller');
    await page.locator('#lgFindTense').selectOption('passeCompose');
    await page.locator('#lgFindWho').selectOption('3');
    await expect(page.locator('#lgFindOut .lg-find-form')).toHaveText('sommes allé(e)s');
    expect(errors).toEqual([]);
  });

  test('Print: tick the tenses, and one portrait page holds only those', async ({ page }) => {
    await open(page, '#es/hablar');
    await page.evaluate(() => { (window as any).print = () => {}; });
    await page.locator('[data-act="print"]').click();
    await page.locator('[data-act="print-set"][data-v="none"]').click();
    await page.locator('[data-ptense="present"]').check();
    await page.locator('[data-ptense="subjPresent"]').check();
    await page.locator('[data-act="print-go"]').click();
    const sheet = page.locator('#lgPrintSheet');
    await expect(sheet.locator('.lg-card')).toHaveCount(2);
    await expect(sheet.locator('.lg-th').nth(1)).toContainText('Subjunctive');
    await page.emulateMedia({ media: 'print' });
    await expect(sheet).toBeVisible();
    await expect(page.locator('#lgConj')).toBeHidden();
  });

  test('a form finds its verb, and the table shows every tense with irregulars marked', async ({ page }) => {
    const errors = await open(page);
    await page.locator('#lgQ').fill('tuvimos');
    await expect(page.locator('.lg-opt').first()).toContainText('tener');
    await expect(page.locator('.lg-opt').first()).toContainText('nosotros');
    await page.keyboard.press('Enter');
    await expect(page.locator('.lg-inf')).toHaveText('tener');
    await expect(page.locator('.lg-gloss')).toHaveText('to have');
    await expect(page).toHaveURL(/#es\/tener$/);
    // The form searched for is pointed out.
    await expect(page.locator('[data-cell="preterite-3"]')).toHaveClass(/is-flash/);
    // Every Spanish tense is on the page by default.
    for (const id of ['present', 'preterite', 'subjImperfectSe', 'subjFuture', 'pastAnterior', 'impNegative']) {
      await expect(page.locator(`[data-cell="${id}-1"]`)).toHaveCount(1);
    }
    await expect(page.locator('[data-cell="preterite-0"] .lg-form')).toHaveClass(/is-irr/);
    await expect(page.locator('[data-cell="imperfect-0"] .lg-form')).not.toHaveClass(/is-irr/);
    // Essentials hides the literary tenses; vosotros can be hidden.
    await page.locator('[data-act="view"][data-v="essential"]').click();
    await expect(page.locator('[data-cell="subjFuture-0"]')).toHaveCount(0);
    await page.locator('[data-act="vosotros"]').click();
    await expect(page.locator('[data-cell="present-4"]')).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test('French: être verbs agree, reflexives stay reflexive, and the language switch follows the link', async ({ page }) => {
    await open(page, '#fr/aller');
    await expect(page.locator('.lg-lang[data-lang="fr"]')).toHaveAttribute('aria-checked', 'true');
    await expect(page.locator('[data-cell="passeCompose-3"] .lg-form')).toHaveText('sommes allé(e)s');
    await expect(page.locator('.lg-nf')).toContainText('être');
    await page.locator('#lgQ').fill('se lever');
    await expect(page.locator('.lg-opt').first()).toContainText('lever');
    await page.keyboard.press('Enter');
    await expect(page.locator('.lg-inf')).toHaveText('se lever');
    await expect(page.locator('[data-cell="present-0"] .lg-form')).toHaveText('me lève');
    await expect(page.locator('[data-cell="imperative-1"] .lg-form')).toHaveText('lève-toi');
  });

  test('saved and recent verbs come back after a reload', async ({ page }) => {
    await open(page, '#es/hablar');
    await page.locator('[data-act="save"]').click();
    await page.reload();
    await expect(page.locator('.lg-chip.is-saved')).toHaveText('hablar');
  });

  test('practice: right, accent-only and wrong answers, then a summary with what to review', async ({ page }) => {
    await open(page, '#es/ser');
    await page.locator('[data-act="practice"]').click();
    await expect(page.locator('#lgPVerbs')).toHaveValue('ser');
    await page.locator('#lgPMode [data-mode="endless"]').click();
    await page.locator('#lgPStart').click();
    const answer = () => page.evaluate(() => {
      const verb = document.getElementById('lgQVerb')!.textContent!;
      const tense = document.getElementById('lgQTense')!.textContent!;
      const pron = document.getElementById('lgQPron')!.textContent!;
      const C = (window as any).FluxConj;
      const r = C.conjugate('es', verb);
      const persons = C.persons('es');
      const ids: Record<string, string> = { 'Indicative present': 'present', 'Indicative preterite': 'preterite' };
      const i = persons.indexOf(pron.replace(/^que /, ''));
      return r.tenses[ids[tense]][i];
    });
    const right = await answer();
    await page.locator('#lgQIn').fill(right);
    await page.keyboard.press('Enter');
    await expect(page.locator('#lgFb')).toContainText('Right');
    await expect(page.locator('#lgRRight')).toHaveText('1 ✓');
    await expect(page.locator('#lgRWrong')).toHaveText('0 ✗');
    await page.locator('#lgQIn').press('Enter');
    await page.locator('#lgQIn').fill('zzz');
    await page.keyboard.press('Enter');
    await expect(page.locator('#lgFb')).toContainText('Answer:');
    await expect(page.locator('#lgRWrong')).toHaveText('1 ✗');
    await page.locator('#lgREnd').click();
    await expect(page.locator('.lg-big')).toContainText('1 / 2');
    await expect(page.locator('.lg-missed li')).toHaveCount(1);
    await expect(page.locator('#lgRetry')).toBeVisible();
  });

  for (const [kind, lang] of [['to', 'fr'], ['from', 'fr'], ['to', 'es'], ['from', 'es']] as const) {
    test(`vocabulary practice, ${kind === 'to' ? 'English → ' + lang : lang + ' → English'}`, async ({ page }) => {
      await open(page, '#practice');
      await page.locator(`[data-plang="${lang}"]`).click();
      await page.locator(`[data-kind="${kind}"]`).click();
      await page.locator('#lgPMode [data-mode="endless"]').click();
      await page.locator('#lgPStart').click();
      const col = lang === 'fr' ? 2 : 1;
      // The right answer, looked up from the deck the prompt came from.
      const right = await page.evaluate(([kind, col]) => {
        const prompt = document.getElementById('lgQVerb')!.textContent!;
        const V = (window as any).FluxLangPractice;
        for (const t of V.themes()) for (const w of V.words(t.id)) {
          if (kind === 'to' && w[0] === prompt) return w[col];
          if (kind === 'from' && w[col] === prompt) return w[0].replace(/\s*\([^)]*\)/g, '').split('/')[0].trim();
        }
        return null;
      }, [kind, col] as const);
      expect(right).toBeTruthy();
      await page.locator('#lgQIn').fill(right!);
      await page.keyboard.press('Enter');
      await expect(page.locator('#lgFb')).toContainText('Right');
      await expect(page.locator('#lgRRight')).toHaveText('1 ✓');
      // The accent keys belong to answers typed in French or Spanish.
      await expect(page.locator('#lgAcc')).toBeVisible({ visible: kind === 'to' });
    });
  }

  test('the Translate tab still translates', async ({ page }) => {
    await page.addInitScript(() => { delete (window as any).Translator; });
    await page.route('https://api.mymemory.translated.net/**', (route) => route.fulfill({
      contentType: 'application/json', headers: { 'access-control-allow-origin': '*' },
      body: JSON.stringify({ responseStatus: 200, responseData: { translatedText: 'Hola' } }),
    }));
    await open(page);
    await page.locator('.lg-tab[data-tab="translate"]').click();
    await page.locator('#ftIn').fill('Hello');
    await page.locator('#ftGo').click();
    await expect(page.locator('#ftOut')).toHaveText('Hola');
    await expect(page).toHaveURL(/#translate$/);
  });

  test('fits a 390px phone with no sideways scroll, and has no serious accessibility problems', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await open(page, '#es/tener');
    await expect(page.locator('.lg-inf')).toHaveText('tener');
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    const results = await new AxeBuilder({ page }).include('#ftHost').analyze();
    const serious = results.violations.filter((v) => v.impact === 'critical' || v.impact === 'serious');
    expect(serious, JSON.stringify(serious.map((v) => ({ id: v.id, n: v.nodes.length, t: v.nodes[0]?.target })), null, 2)).toEqual([]);
  });
});
