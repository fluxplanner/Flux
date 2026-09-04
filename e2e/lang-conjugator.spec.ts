import { test, expect } from '@playwright/test';
import { gotoScenario } from './helpers';

/*
 * The offline conjugator.
 *
 * This tool's failure mode is not a crash — it is a confident wrong answer,
 * which a student then learns and writes in an exam. The old version returned
 * "nous partissons" and "yo podo" without a flicker of doubt.
 *
 * So these tests are almost entirely a correctness table. Every verb below was
 * picked because it breaks a rule the naive implementation assumed:
 *
 *   partir   two -ir families in French; this is the one without -iss-
 *   ouvrir   ends in -ir, conjugates like an -er verb
 *   poder    Spanish stem change o→ue, absent from the old tables entirely
 *   tener    stem change AND an irregular yo, so both must apply at once
 *   entender two e's in the stem — only the second one shifts
 *   dormir   o→ue in the present, but o→u in the third person preterite
 *   hacer    strong preterite whose third person is spelt hizo, not hico
 *   aller    passé composé with être, where "j'ai allé" is the classic error
 */

const ES: Array<[string, string, string[]]> = [
  ['hablar', 'present', ['hablo', 'hablas', 'habla', 'hablamos', 'habláis', 'hablan']],
  ['poder', 'present', ['puedo', 'puedes', 'puede', 'podemos', 'podéis', 'pueden']],
  ['querer', 'present', ['quiero', 'quieres', 'quiere', 'queremos', 'queréis', 'quieren']],
  ['pedir', 'present', ['pido', 'pides', 'pide', 'pedimos', 'pedís', 'piden']],
  ['jugar', 'present', ['juego', 'juegas', 'juega', 'jugamos', 'jugáis', 'juegan']],
  ['tener', 'present', ['tengo', 'tienes', 'tiene', 'tenemos', 'tenéis', 'tienen']],
  ['venir', 'present', ['vengo', 'vienes', 'viene', 'venimos', 'venís', 'vienen']],
  ['entender', 'present', ['entiendo', 'entiendes', 'entiende', 'entendemos', 'entendéis', 'entienden']],
  ['conocer', 'present', ['conozco', 'conoces', 'conoce', 'conocemos', 'conocéis', 'conocen']],
  ['ser', 'present', ['soy', 'eres', 'es', 'somos', 'sois', 'son']],
  ['dormir', 'preterite', ['dormí', 'dormiste', 'durmió', 'dormimos', 'dormisteis', 'durmieron']],
  ['tener', 'preterite', ['tuve', 'tuviste', 'tuvo', 'tuvimos', 'tuvisteis', 'tuvieron']],
  ['decir', 'preterite', ['dije', 'dijiste', 'dijo', 'dijimos', 'dijisteis', 'dijeron']],
  ['hacer', 'preterite', ['hice', 'hiciste', 'hizo', 'hicimos', 'hicisteis', 'hicieron']],
  ['ser', 'imperfect', ['era', 'eras', 'era', 'éramos', 'erais', 'eran']],
  ['tener', 'future', ['tendré', 'tendrás', 'tendrá', 'tendremos', 'tendréis', 'tendrán']],
  ['hacer', 'conditional', ['haría', 'harías', 'haría', 'haríamos', 'haríais', 'harían']],
];

const FR: Array<[string, string, string[]]> = [
  ['parler', 'present', ['parle', 'parles', 'parle', 'parlons', 'parlez', 'parlent']],
  ['finir', 'present', ['finis', 'finis', 'finit', 'finissons', 'finissez', 'finissent']],
  ['partir', 'present', ['pars', 'pars', 'part', 'partons', 'partez', 'partent']],
  ['dormir', 'present', ['dors', 'dors', 'dort', 'dormons', 'dormez', 'dorment']],
  ['ouvrir', 'present', ['ouvre', 'ouvres', 'ouvre', 'ouvrons', 'ouvrez', 'ouvrent']],
  ['vendre', 'present', ['vends', 'vends', 'vend', 'vendons', 'vendez', 'vendent']],
  ['être', 'present', ['suis', 'es', 'est', 'sommes', 'êtes', 'sont']],
  ['prendre', 'present', ['prends', 'prends', 'prend', 'prenons', 'prenez', 'prennent']],
  ['finir', 'imperfect', ['finissais', 'finissais', 'finissait', 'finissions', 'finissiez', 'finissaient']],
  ['être', 'imperfect', ['étais', 'étais', 'était', 'étions', 'étiez', 'étaient']],
  ['aller', 'future', ['irai', 'iras', 'ira', 'irons', 'irez', 'iront']],
  ['vendre', 'future', ['vendrai', 'vendras', 'vendra', 'vendrons', 'vendrez', 'vendront']],
  ['avoir', 'conditional', ['aurais', 'aurais', 'aurait', 'aurions', 'auriez', 'auraient']],
  ['parler', 'passeCompose', ['ai parlé', 'as parlé', 'a parlé', 'avons parlé', 'avez parlé', 'ont parlé']],
  ['aller', 'passeCompose', ['suis allé', 'es allé', 'est allé', 'sommes allés', 'êtes allés', 'sont allés']],
];

test.describe('Offline conjugator', () => {
  test.beforeEach(async ({ page }) => {
    await gotoScenario(page, 'student-semester');
    await page.waitForFunction(() => !!(window as any).FluxLangEngine, null, { timeout: 15000 });
  });

  test('Spanish: stem changes, irregular yo forms and strong preterites', async ({ page }) => {
    const wrong = await page.evaluate((cases) => {
      const E = (window as any).FluxLangEngine;
      const bad: string[] = [];
      for (const [verb, tense, expected] of cases as Array<[string, string, string[]]>) {
        const got = E.conjugate('es', verb, tense).forms;
        if (got.join(' ') !== expected.join(' ')) {
          bad.push(`${verb} ${tense}: got "${got.join(' ')}" want "${expected.join(' ')}"`);
        }
      }
      return bad;
    }, ES);
    expect(wrong).toEqual([]);
  });

  test('French: both -ir families, irregulars and the passé composé auxiliary', async ({ page }) => {
    const wrong = await page.evaluate((cases) => {
      const E = (window as any).FluxLangEngine;
      const bad: string[] = [];
      for (const [verb, tense, expected] of cases as Array<[string, string, string[]]>) {
        const got = E.conjugate('fr', verb, tense).forms;
        if (got.join(' ') !== expected.join(' ')) {
          bad.push(`${verb} ${tense}: got "${got.join(' ')}" want "${expected.join(' ')}"`);
        }
      }
      return bad;
    }, FR);
    expect(wrong).toEqual([]);
  });

  test('the specific answers the old trainer got wrong', async ({ page }) => {
    const res = await page.evaluate(() => {
      const E = (window as any).FluxLangEngine;
      return {
        partirNous: E.conjugate('fr', 'partir', 'present').forms[3],
        poderYo: E.conjugate('es', 'poder', 'present').forms[0],
        quererYo: E.conjugate('es', 'querer', 'present').forms[0],
        pedirYo: E.conjugate('es', 'pedir', 'present').forms[0],
        // The boot: nosotros never takes the stem change.
        poderNosotros: E.conjugate('es', 'poder', 'present').forms[3],
      };
    });
    expect(res.partirNous).toBe('partons');
    expect(res.poderYo).toBe('puedo');
    expect(res.quererYo).toBe('quiero');
    expect(res.pedirYo).toBe('pido');
    expect(res.poderNosotros).toBe('podemos');
  });

  test("j'ai elides in the pronoun column, and être verbs keep theirs", async ({ page }) => {
    const res = await page.evaluate(() => {
      const E = (window as any).FluxLangEngine;
      const avoir = E.conjugate('fr', 'parler', 'passeCompose');
      const etre = E.conjugate('fr', 'aller', 'passeCompose');
      return {
        avoirPronoun: avoir.pronouns[0],
        avoirForm: avoir.forms[0],
        etrePronoun: etre.pronouns[0],
        etreNote: etre.note,
      };
    });
    // "je" + "ai parlé" would print "je ai parlé"; the elision belongs here.
    expect(res.avoirPronoun).toBe("j'");
    expect(res.avoirForm).toBe('ai parlé');
    // "je suis allé" needs no elision, so the pronoun stays whole.
    expect(res.etrePronoun).toBe('je');
    expect(res.etreNote).toContain('être');
  });

  test('bad input is refused with a usable message, never a wrong answer', async ({ page }) => {
    const res = await page.evaluate(() => {
      const E = (window as any).FluxLangEngine;
      const err = (fn: () => unknown) => { try { fn(); return null; } catch (e: any) { return e.message; } };
      return {
        empty: err(() => E.conjugate('es', '')),
        notAVerb: err(() => E.conjugate('es', 'casa')),
        injection: err(() => E.conjugate('es', '<img src=x onerror=alert(1)>')),
        // Leading "to" is what an English speaker types.
        toStripped: E.conjugate('es', 'to hablar', 'present').forms[0],
        // An unknown tense falls back rather than throwing.
        unknownTense: E.conjugate('es', 'hablar', 'pluperfect').tense,
      };
    });
    expect(res.empty).toContain('Type a verb');
    expect(res.notAVerb).toContain('-ar');
    expect(res.injection).toContain('Letters only');
    expect(res.toStripped).toBe('hablo');
    expect(res.unknownTense).toBe('present');
  });

  test('the trainer renders, keeps the verb across a tense switch, and escapes output', async ({ page }) => {
    await page.evaluate(() => (window as any).nav?.('toolbox'));
    await page.waitForTimeout(900);

    const res = await page.evaluate(async () => {
      /* Spanish, not the old shared "languages" subject — and the tab has to be
         clicked. selectSubject's second argument only hints which tool to
         restore, and Spanish now opens on Dictionary, so reading lgTenseSeg
         straight afterwards would find nothing and the tenses would come back
         as an empty array rather than as a failure anyone could read. */
      (window as any).fluxStudyHub.selectSubject('spanish');
      await new Promise((r) => setTimeout(r, 600));
      document.querySelector<HTMLElement>('[data-tool="conj"]')?.click();
      await new Promise((r) => setTimeout(r, 400));
      const seg = document.getElementById('lgTenseSeg');
      const tenses = seg ? [...seg.querySelectorAll('[data-t]')].map((b) => b.getAttribute('data-t')) : [];
      const input = document.getElementById('lgVerb') as HTMLInputElement | null;
      if (input) input.value = 'poder';
      (document.getElementById('lgGo') as HTMLElement | null)?.click();
      await new Promise((r) => setTimeout(r, 250));
      const present = document.getElementById('lgOut')?.textContent || '';
      (seg?.querySelector('[data-t="future"]') as HTMLElement | null)?.click();
      await new Promise((r) => setTimeout(r, 300));
      const future = document.getElementById('lgOut')?.textContent || '';

      // A hostile "verb" must never become markup.
      const inp2 = document.getElementById('lgVerb') as HTMLInputElement | null;
      if (inp2) inp2.value = '<img src=x onerror="window.__pwned=1">';
      (document.getElementById('lgGo') as HTMLElement | null)?.click();
      await new Promise((r) => setTimeout(r, 250));
      return {
        tenses,
        present,
        future,
        injectedImg: !!document.querySelector('#lgOut img'),
        pwned: !!(window as any).__pwned,
      };
    });

    expect(res.tenses).toEqual([
      'present', 'preterite', 'imperfect', 'future', 'conditional', 'subjunctive', 'perfect',
    ]);
    expect(res.present).toContain('puedo');
    // Carried the verb across the tense switch instead of resetting to hablar.
    expect(res.future).toContain('podré');
    expect(res.injectedImg).toBe(false);
    expect(res.pwned).toBe(false);
  });
});
