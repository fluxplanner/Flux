import { test, expect } from '@playwright/test';
import { gotoScenario } from './helpers';

/*
 * Vocabulary and conjugation practice.
 *
 * Three things here are worth guarding, and none of them is "does it render".
 *
 * 1. THE DECK IS THE PRODUCT. 221 rows, each [English, Spanish, French]. A
 *    half-filled row means a question with no answer, and it would only show
 *    up when a student happened to be dealt that word. Checked in bulk.
 *
 * 2. MARKING HAS TO BE FAIR BOTH WAYS. Accept a missing accent, but say so —
 *    rejecting it is hostile, silently accepting it teaches a spelling that
 *    loses marks later.
 *
 * 3. SYNC MUST NOT ERASE REVISION. Two devices in one day should add up. The
 *    slice merges on the higher Leitner box rather than overwriting, and that
 *    is exactly the kind of rule that quietly regresses to last-write-wins.
 */

async function openPractice(page: import('@playwright/test').Page) {
  await gotoScenario(page, 'student-semester');
  await page.waitForFunction(() => !!(window as any).FluxLangPractice, null, { timeout: 15000 });
  await page.evaluate(() => (window as any).nav?.('toolbox'));
  await page.waitForTimeout(800);
  await page.evaluate(() => (window as any).fluxStudyHub.selectSubject('languages'));
  await page.waitForTimeout(600);
  /* selectSubject's second argument does not switch the tool tab — it only
     hints which one to restore. Clicking the tab is what a student does and
     what actually mounts the card. */
  await page.evaluate(() => document.querySelector<HTMLElement>('[data-tool="practice"]')?.click());
  await page.waitForFunction(() => !!document.getElementById('fluxLangPractice'), null, { timeout: 8000 });
}

test.describe('Language practice', () => {
  test('every deck row carries English, Spanish and French', async ({ page }) => {
    await gotoScenario(page, 'student-semester');
    await page.waitForFunction(() => !!(window as any).FluxLangPractice, null, { timeout: 15000 });

    const res = await page.evaluate(() => {
      const P = (window as any).FluxLangPractice;
      const themes = P.themes();
      const holes: string[] = [];
      const dupes: string[] = [];
      let total = 0;
      themes.forEach((t: any) => {
        const seen = new Set<string>();
        P.words(t.id).forEach((w: string[], i: number) => {
          total++;
          if (w.length !== 3 || !w[0] || !w[1] || !w[2]) holes.push(`${t.id}[${i}]`);
          // A repeated English prompt inside one theme makes multiple choice
          // unanswerable: two options would both be right.
          if (seen.has(w[0])) dupes.push(`${t.id}: ${w[0]}`);
          seen.add(w[0]);
        });
      });
      return { themeCount: themes.length, total, holes, dupes };
    });

    expect(res.holes).toEqual([]);
    expect(res.dupes).toEqual([]);
    expect(res.themeCount).toBe(12);
    expect(res.total).toBeGreaterThan(200);
  });

  test('marking accepts a missing accent but names it', async ({ page }) => {
    await gotoScenario(page, 'student-semester');
    await page.waitForFunction(() => !!(window as any).FluxLangPractice, null, { timeout: 15000 });

    const res = await page.evaluate(() => {
      const J = (window as any).FluxLangPractice.judge;
      return {
        exact: J('el bolígrafo', 'el bolígrafo'),
        noAccent: J('el boligrafo', 'el bolígrafo'),
        noArticle: J('mesa', 'la mesa'),
        wrongWord: J('la silla', 'la mesa'),
        empty: J('   ', 'la mesa'),
        caseOnly: J('LA MESA', 'la mesa'),
      };
    });

    expect(res.exact.ok).toBe(true);
    expect(res.exact.note).toBe('');
    // Accepted, and the correct spelling is shown rather than just "right".
    expect(res.noAccent.ok).toBe(true);
    expect(res.noAccent.note).toContain('bolígrafo');
    expect(res.noArticle.ok).toBe(true);
    expect(res.noArticle.note).toContain('la mesa');
    expect(res.wrongWord.ok).toBe(false);
    expect(res.empty.ok).toBe(false);
    expect(res.caseOnly.ok).toBe(true);
  });

  test('multiple choice offers four options with exactly one right answer', async ({ page }) => {
    await openPractice(page);

    const res = await page.evaluate(() => {
      const P = (window as any).FluxLangPractice;
      const out: Array<{ n: number; unique: number; hasAnswer: boolean }> = [];
      for (let i = 0; i < 25; i++) {
        const q = P._next();
        const answer = q.row[1]; // Spanish is the default language.
        out.push({
          n: q.options.length,
          unique: new Set(q.options).size,
          hasAnswer: q.options[q.correct] === answer,
        });
      }
      return out;
    });

    // Four distinct options every time, and the flagged index really is right.
    expect(res.every((r) => r.n === 4)).toBe(true);
    expect(res.every((r) => r.unique === 4)).toBe(true);
    expect(res.every((r) => r.hasAnswer)).toBe(true);
  });

  test('a right answer promotes the word up its Leitner box', async ({ page }) => {
    await openPractice(page);

    const res = await page.evaluate(async () => {
      const P = (window as any).FluxLangPractice;
      (window as any).save('flux_lang_practice_v1', {
        lang: 'es', mode: 'choice', theme: 'school', box: {}, stats: { seen: 0, right: 0, streak: 0, best: 0 },
      });
      const q = P._next();
      const k = `es:school:${q.index}`;
      document.querySelector<HTMLElement>(`#fluxLangPractice .flp-opt[data-o="${q.correct}"]`)!.click();
      await new Promise((r) => setTimeout(r, 900));
      const s = P._state();
      return { box: s.box[k], streak: s.stats.streak, right: s.stats.right };
    });

    expect(res.box).toBe(1);
    expect(res.streak).toBe(1);
    expect(res.right).toBe(1);
  });

  test('the verb drill asks a real conjugation and marks it', async ({ page }) => {
    await openPractice(page);

    const res = await page.evaluate(async () => {
      const P = (window as any).FluxLangPractice;
      const E = (window as any).FluxLangEngine;
      (window as any).save('flux_lang_practice_v1', {
        lang: 'es', mode: 'drill', theme: 'school', box: {}, stats: { seen: 0, right: 0, streak: 0, best: 0 },
      });
      const q = P._next();
      // The question must agree with the engine, not with a second copy of the
      // tables — that divergence is the whole reason the engine exists.
      const truth = E.conjugate('es', q.verb, q.tense.id).forms[q.person];
      const input = document.getElementById('flpIn') as HTMLInputElement | null;
      if (input) input.value = q.answer;
      (document.getElementById('flpGo') as HTMLElement | null)?.click();
      await new Promise((r) => setTimeout(r, 250));
      const fb = document.getElementById('flpFb');
      return {
        agrees: truth === q.answer,
        hasPronoun: !!q.pronoun,
        marked: fb ? fb.className : '',
        streak: P._state().stats.streak,
      };
    });

    expect(res.agrees).toBe(true);
    expect(res.hasPronoun).toBe(true);
    expect(res.marked).toContain('is-ok');
    expect(res.streak).toBe(1);
  });

  test('a slice from another device adds to your revision instead of replacing it', async ({ page }) => {
    await openPractice(page);

    const res = await page.evaluate(() => {
      const P = (window as any).FluxLangPractice;
      (window as any).save('flux_lang_practice_v1', {
        lang: 'es', mode: 'choice', theme: 'school',
        box: { 'es:school:0': 4, 'es:school:1': 1 },
        stats: { seen: 40, right: 30, streak: 3, best: 9 },
      });
      P.applyFromCloud({
        lang: 'fr',
        box: { 'es:school:0': 2, 'es:school:1': 3, 'fr:food:5': 4 },
        stats: { seen: 10, right: 8, streak: 1, best: 12 },
      });
      return P._state();
    });

    // Higher box wins in both directions — neither device's work is thrown away.
    expect(res.box['es:school:0']).toBe(4);
    expect(res.box['es:school:1']).toBe(3);
    expect(res.box['fr:food:5']).toBe(4);
    // Counters take the larger, so a stale device cannot shrink your record.
    expect(res.stats.seen).toBe(40);
    expect(res.stats.best).toBe(12);
    expect(res.lang).toBe('fr');
  });

  test('a corrupt slice is ignored rather than wiping the deck', async ({ page }) => {
    await openPractice(page);

    const res = await page.evaluate(() => {
      const P = (window as any).FluxLangPractice;
      (window as any).save('flux_lang_practice_v1', {
        lang: 'es', mode: 'choice', theme: 'school',
        box: { 'es:school:0': 4 }, stats: { seen: 40, right: 30, streak: 3, best: 9 },
      });
      P.applyFromCloud(null);
      P.applyFromCloud({ box: 'not an object', stats: 42 });
      P.applyFromCloud({ box: { 'es:school:0': 'three' } });
      return P._state();
    });

    expect(res.box['es:school:0']).toBe(4);
    expect(res.stats.seen).toBe(40);
  });

  test('switching language and mode survives a reload', async ({ page }) => {
    await openPractice(page);

    await page.evaluate(() => {
      document.querySelector<HTMLElement>('#fluxLangPractice [data-l="fr"]')!.click();
    });
    await page.waitForTimeout(300);
    await page.evaluate(() => {
      document.querySelector<HTMLElement>('#fluxLangPractice [data-m="type"]')!.click();
    });
    await page.waitForTimeout(300);

    const before = await page.evaluate(() => {
      const s = (window as any).FluxLangPractice._state();
      return { lang: s.lang, mode: s.mode, hint: document.querySelector('.flp-hint')?.textContent };
    });
    expect(before.lang).toBe('fr');
    expect(before.mode).toBe('type');
    expect(before.hint).toContain('French');

    await openPractice(page);
    const after = await page.evaluate(() => (window as any).FluxLangPractice._state());
    expect(after.lang).toBe('fr');
    expect(after.mode).toBe('type');
  });

  test('a hostile answer is never executed', async ({ page }) => {
    await openPractice(page);

    const res = await page.evaluate(async () => {
      (window as any).save('flux_lang_practice_v1', {
        lang: 'es', mode: 'type', theme: 'school', box: {}, stats: { seen: 0, right: 0, streak: 0, best: 0 },
      });
      (window as any).FluxLangPractice._next();
      const input = document.getElementById('flpIn') as HTMLInputElement | null;
      if (input) input.value = '<img src=x onerror="window.__pwned=1">';
      (document.getElementById('flpGo') as HTMLElement | null)?.click();
      await new Promise((r) => setTimeout(r, 300));
      return {
        img: !!document.querySelector('#fluxLangPractice img'),
        pwned: !!(window as any).__pwned,
      };
    });

    expect(res.img).toBe(false);
    expect(res.pwned).toBe(false);
  });
});
