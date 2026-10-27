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
    await expect(page.locator('#lgRScore')).toHaveText('1 ✓ · 0 ✗');
    await page.locator('#lgQIn').press('Enter');
    await page.locator('#lgQIn').fill('zzz');
    await page.keyboard.press('Enter');
    await expect(page.locator('#lgFb')).toContainText('Answer:');
    await expect(page.locator('#lgRScore')).toHaveText('1 ✓ · 1 ✗');
    await page.locator('#lgREnd').click();
    await expect(page.locator('.lg-big')).toContainText('1 / 2');
    await expect(page.locator('.lg-missed li')).toHaveCount(1);
    await expect(page.locator('#lgRetry')).toBeVisible();
  });

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
