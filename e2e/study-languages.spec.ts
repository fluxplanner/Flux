import { test, expect } from '@playwright/test';
import { gotoScenario } from './helpers';

/*
 * French, German and Spanish as subjects in their own right.
 *
 * There used to be one "Languages" pill with a Spanish/French toggle inside
 * every tool. Three things had to be true for the split to be an improvement
 * rather than three copies of the same problem, and each one is a test here.
 *
 * 1. FOUR TOOLS EACH, ACTUALLY REGISTERED. A subject needs an entry in
 *    SUBJECTS, a module calling H.register with a *matching* id, and that
 *    module in the bundle manifest. Miss one and the failure is silent — a
 *    pill that renders "didn't load", or a tab that paints nothing.
 *
 * 2. GERMAN HAS TO BE RIGHT. The engine's own header exists because a
 *    six-line trainer once taught "yo podo" and "nous partissons". German has
 *    the same trap in a different shape: a plausible regular rule prints "du
 *    fahrst" and "du gebst". The forms below are the ones that rule gets
 *    wrong, so they are the ones worth asserting.
 *
 * 3. THE REFERENCE SHEET AND THE CONJUGATOR MUST AGREE. The irregular-verbs
 *    list is generated from the same tables, so a divergence would mean the
 *    generation quietly broke and a student is reading two answers.
 */

type Hub = { selectSubject: (id: string) => void };

async function openSubject(page: import('@playwright/test').Page, sid: string) {
  await page.evaluate(async (id: string) => {
    (window as unknown as { fluxStudyHub: Hub }).fluxStudyHub.selectSubject(id);
    await new Promise((r) => setTimeout(r, 400));
  }, sid);
}

async function openTool(page: import('@playwright/test').Page, sid: string, tool: string) {
  await openSubject(page, sid);
  const tab = page.locator(`#fshChemTabs [data-tool="${tool}"]`).first();
  await expect(tab, `no "${tool}" tab under ${sid}`).toBeVisible();
  await tab.click();
  await page.waitForTimeout(300);
  return page.evaluate(() => {
    const b = document.getElementById('fshSubBody');
    return (b?.textContent || '').replace(/\s+/g, ' ').trim();
  });
}

test.describe('French, German and Spanish are their own subjects', () => {
  test.beforeEach(async ({ page }) => {
    await gotoScenario(page, 'student-semester');
    await page.evaluate(() => (window as unknown as { nav: (t: string) => void }).nav('toolbox'));
    await expect(page.locator('.fsh-pill').first()).toBeVisible();
  });

  test('the umbrella is called Languages and holds four pills', async ({ page }) => {
    const res = await page.evaluate(() => {
      const g = document.querySelector('#fshGroups .fsh-group[data-group="languages-arts"]') as HTMLElement;
      const name = (g.textContent || '').trim();
      g.click();
      return {
        name,
        pills: [...document.querySelectorAll('#fshRail .fsh-pill')].map(
          (p) => (p as HTMLElement).dataset.sub || ''),
      };
    });
    // "English & Languages" read as though English were the odd one out.
    expect(res.name).toMatch(/Languages/);
    expect(res.name).not.toMatch(/English &/);
    expect(res.pills.slice().sort()).toEqual(['english', 'french', 'german', 'spanish']);
  });

  test('each language has a dictionary, conjugator, irregular verbs and phrases', async ({ page }) => {
    for (const sid of ['french', 'german', 'spanish']) {
      await openSubject(page, sid);
      const tools = await page.evaluate(() =>
        [...document.querySelectorAll('#fshChemTabs .fsh-chem-tab')].map(
          (t) => (t as HTMLElement).dataset.tool || ''));
      expect(tools, `${sid} is missing one of the four tools`)
        .toEqual(expect.arrayContaining(['dict', 'conj', 'irreg', 'phrases']));
      // The shared practice card should have followed the split too.
      expect(tools, `${sid} lost the practice card`).toContain('practice');
    }
  });

  test('every tool paints real content in all three languages', async ({ page }) => {
    for (const sid of ['french', 'german', 'spanish']) {
      for (const tool of ['dict', 'conj', 'irreg', 'phrases']) {
        const text = await openTool(page, sid, tool);
        /* Length alone is the wrong assertion here: a correct French
           conjugation table is 260 characters because French words are short,
           so a threshold generous enough for German fails on French for no
           reason. What actually needs guarding is the panel not being one of
           the three ways a tool fails while still looking like a tool —
           an engine that hasn't loaded, a thrown render, or the "module isn't
           available" fallback. */
        expect(text, `${sid}/${tool} did not render`)
          .not.toMatch(/still loading|Tool error|didn.t load/i);
        expect(text.length, `${sid}/${tool} rendered almost nothing`).toBeGreaterThan(150);
      }
    }
  });

  test('the German conjugator gets the forms a regular rule would get wrong', async ({ page }) => {
    const res = await page.evaluate(() => {
      const E = (window as unknown as { FluxLangEngine: any }).FluxLangEngine;
      const f = (v: string, t: string) => E.conjugate('de', v, t).forms;
      return {
        // Vowel change in du and er only — "du fahrst" is the classic wrong one.
        fahren: f('fahren', 'present'),
        sprechen: f('sprechen', 'present'),
        // Stem already ends in t: er hält, not "er hältet".
        halten: f('halten', 'present'),
        // Linking -e-, because "du arbeitst" cannot be said.
        arbeiten: f('arbeiten', 'present'),
        // Stem ends in an s-sound, so du takes -t not -st.
        heissen: f('heißen', 'present'),
        // sein vs haben in the Perfekt: "ich habe gefahren" is the common error.
        fahrenPerf: f('fahren', 'perfect'),
        machenPerf: f('machen', 'perfect'),
        // -ieren and inseparable prefixes take no ge-.
        studierenPerf: f('studieren', 'perfect')[0],
        besuchenPerf: f('besuchen', 'perfect')[0],
        // Separable prefix goes to the end of the clause, and joins the
        // participle in the Perfekt.
        aufstehen: f('aufstehen', 'present')[0],
        aufstehenPerf: f('aufstehen', 'perfect')[0],
        // Strong Präteritum: no ending at all on ich and er.
        gehenPast: f('gehen', 'past'),
        tenses: E.tenses('de').map((t: { id: string }) => t.id),
      };
    });

    expect(res.fahren).toEqual(['fahre', 'fährst', 'fährt', 'fahren', 'fahrt', 'fahren']);
    expect(res.sprechen).toEqual(['spreche', 'sprichst', 'spricht', 'sprechen', 'sprecht', 'sprechen']);
    expect(res.halten).toEqual(['halte', 'hältst', 'hält', 'halten', 'haltet', 'halten']);
    expect(res.arbeiten).toEqual(['arbeite', 'arbeitest', 'arbeitet', 'arbeiten', 'arbeitet', 'arbeiten']);
    expect(res.heissen).toEqual(['heiße', 'heißt', 'heißt', 'heißen', 'heißt', 'heißen']);
    expect(res.fahrenPerf[0]).toBe('bin gefahren');
    expect(res.machenPerf[0]).toBe('habe gemacht');
    expect(res.studierenPerf).toBe('habe studiert');
    expect(res.besuchenPerf).toBe('habe besucht');
    expect(res.aufstehen).toBe('stehe auf');
    expect(res.aufstehenPerf).toBe('bin aufgestanden');
    expect(res.gehenPast).toEqual(['ging', 'gingst', 'ging', 'gingen', 'gingt', 'gingen']);
    expect(res.tenses).toEqual(['present', 'past', 'perfect', 'future']);
  });

  test('a verb it cannot handle is refused, never guessed at', async ({ page }) => {
    const res = await page.evaluate(() => {
      const E = (window as unknown as { FluxLangEngine: any }).FluxLangEngine;
      const err = (fn: () => unknown) => { try { fn(); return null; } catch (e: any) { return e.message; } };
      return {
        notAVerb: err(() => E.conjugate('de', 'haus')),
        empty: err(() => E.conjugate('de', '')),
        // ß and the umlauts must not be mistaken for punctuation.
        umlautOk: E.conjugate('de', 'heißen', 'present').forms[0],
      };
    });
    expect(res.notAVerb).toContain('-en');
    expect(res.empty).toContain('Type a verb');
    expect(res.umlautOk).toBe('heiße');
  });

  test('the irregular-verbs sheet never disagrees with the conjugator', async ({ page }) => {
    const res = await page.evaluate(() => {
      const E = (window as unknown as { FluxLangEngine: any }).FluxLangEngine;
      const bad: string[] = [];
      const counts: Record<string, number> = {};
      (['es', 'fr', 'de'] as const).forEach((l) => {
        const list = E.irregulars(l);
        counts[l] = list.length;
        list.forEach((entry: [string, string]) => {
          E.tenses(l).forEach((t: { id: string }) => {
            try {
              const r = E.conjugate(l, entry[0], t.id);
              if (r.forms.length !== 6 || r.forms.some((x: string) => !x)) bad.push(`${l} ${entry[0]} ${t.id}`);
            } catch (e: any) { bad.push(`${l} ${entry[0]} ${t.id}: ${e.message}`); }
          });
        });
      });
      return { bad, counts };
    });
    // Any verb on the sheet the conjugator refuses is a row a student would
    // look up and find nothing behind.
    expect(res.bad).toEqual([]);
    expect(res.counts.de).toBeGreaterThan(60);
    expect(res.counts.es).toBeGreaterThan(30);
    expect(res.counts.fr).toBeGreaterThan(30);
  });

  test('the dictionary searches both languages and ignores accents', async ({ page }) => {
    await openTool(page, 'german', 'dict');
    const box = page.locator('#lgDictQ');
    await expect(box).toBeVisible();

    // English in, German out.
    await box.fill('homework');
    await page.waitForTimeout(250);
    await expect(page.locator('#fshSubBody')).toContainText('die Hausaufgaben');

    // German in, English out — and without the umlaut.
    await page.locator('#lgDictQ').fill('prufung');
    await page.waitForTimeout(250);
    await expect(page.locator('#fshSubBody')).toContainText('the exam');

    // A miss says so rather than showing an empty table.
    await page.locator('#lgDictQ').fill('zzzzz');
    await page.waitForTimeout(250);
    await expect(page.locator('#fshSubBody')).toContainText('Nothing matched');
  });

  test('phrases show the subject’s language, not all three', async ({ page }) => {
    const de = await openTool(page, 'german', 'phrases');
    expect(de).toContain('Ich verstehe nicht');
    expect(de).not.toContain('No entiendo');

    const fr = await openTool(page, 'french', 'phrases');
    expect(fr).toContain('Je ne comprends pas');
    expect(fr).not.toContain('Ich verstehe nicht');

    const es = await openTool(page, 'spanish', 'phrases');
    expect(es).toContain('No entiendo');
    expect(es).not.toContain('Je ne comprends pas');
  });

  test('the IPA chart moved to English rather than being dropped', async ({ page }) => {
    const text = await openTool(page, 'english', 'ipa');
    expect(text).toContain('Consonants');
    expect(text).toContain('vision');
  });

  test('none of the three throws on the way in', async ({ page }) => {
    const errs: string[] = [];
    page.on('pageerror', (e) => errs.push(String(e)));
    for (const sid of ['french', 'german', 'spanish']) {
      for (const tool of ['dict', 'conj', 'irreg', 'phrases', 'practice']) {
        await openTool(page, sid, tool);
      }
    }
    expect(errs).toEqual([]);
  });
});
