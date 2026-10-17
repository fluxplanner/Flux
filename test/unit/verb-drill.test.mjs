import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

/**
 * flux-verb-drill-core.js: the Study tools verb drill's questions, marking,
 * rounds, history, assignment links and score codes — run against the real
 * conjugation engine, so every answer checked here is one a student is asked.
 */
const sandbox = { window: {}, TextEncoder, TextDecoder, btoa, atob, Math, Date, JSON };
vm.createContext(sandbox);
for (const f of ['flux-lang-engine.js', 'flux-verb-drill-core.js']) {
  vm.runInContext(readFileSync(new URL('../../public/js/' + f, import.meta.url), 'utf8'), sandbox);
}
const E = sandbox.window.FluxLangEngine;
const C = sandbox.window.FluxVerbCore;
/** Values made inside the VM belong to another realm; compare their contents. */
const plain = (x) => JSON.parse(JSON.stringify(x));
/** A repeatable random number source. */
function seeded(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

test('every verb in every set conjugates in every tense, six usable forms each', () => {
  const broken = [];
  let combos = 0;
  for (const lang of ['es', 'fr', 'de']) {
    const tenses = E.tenses(lang).map((t) => t.id);
    for (const s of C.sets(lang)) {
      assert.ok(s.count >= 10, `${lang} ${s.id} has only ${s.count} verbs`);
      for (const verb of C.setVerbs(lang, s.id)) {
        assert.ok(C.gloss(E, lang, verb), `${lang} ${verb} has no English`);
        for (const t of tenses) {
          combos++;
          try {
            const r = E.conjugate(lang, verb, t);
            if (r.verb !== verb) broken.push(`${lang} ${verb}: engine spells it ${r.verb}`);
            if (r.forms.length !== 6 || r.forms.some((f) => !f || f === '—')) broken.push(`${lang} ${verb} ${t}: ${r.forms.join(',')}`);
          } catch (e) { broken.push(`${lang} ${verb} ${t}: THREW ${e.message}`); }
        }
      }
    }
  }
  assert.ok(combos > 1500, `only ${combos} swept`);
  assert.deepEqual(broken, []);
});

test('regular sets hold only verbs that are regular in every tense the drill asks', () => {
  /* "Regular" is a promise to a student. A set may not hold a verb the engine
     itself calls irregular in any tense. */
  const bad = [];
  for (const [lang, ids] of [['es', ['regular', 'ar', 'er', 'ir']], ['fr', ['er', 'ir', 're']]]) {
    for (const id of ids) {
      for (const verb of C.setVerbs(lang, id)) {
        for (const t of E.tenses(lang).map((x) => x.id)) {
          const note = E.conjugate(lang, verb, t).note;
          if (/^(irregular|strong)|irregular (stem|participle|yo)|stem change|respell|, but /.test(note)) bad.push(`${lang} ${id} ${verb} ${t}: ${note}`);
        }
      }
    }
  }
  assert.deepEqual(bad, []);
});

test('the pool covers verbs × tenses × chosen persons, and skips what cannot be asked', () => {
  const cfg = C.sanitizeConfig({ lang: 'es', tenses: ['present', 'preterite'], set: 'custom', custom: ['hablar', 'ser'], persons: [0, 1, 2, 3, 5] }, E);
  const pool = C.buildPool(E, cfg);
  assert.equal(pool.length, 2 * 2 * 5);
  assert.ok(!pool.some((p) => p.person === 4), 'vosotros was switched off');
  // An impersonal verb offers only its one person.
  const fr = C.buildPool(E, C.sanitizeConfig({ lang: 'fr', tenses: ['present'], set: 'custom', custom: ['falloir'], persons: [0, 1, 2, 3, 4, 5] }, E));
  assert.deepEqual(plain(fr), [{ verb: 'falloir', tense: 'present', person: 2 }]);
});

test('a queue is the requested length and never asks the same thing twice running', () => {
  const pool = C.buildPool(E, C.sanitizeConfig({ lang: 'de', tenses: ['present'], set: 'custom', custom: ['gehen', 'sein'], persons: [0, 1] }, E));
  const q = C.makeQueue(pool, 50, seeded(7));
  assert.equal(q.length, 50);
  for (let i = 1; i < q.length; i++) {
    assert.ok(!(q[i].verb === q[i - 1].verb && q[i].person === q[i - 1].person), `repeat at ${i}`);
  }
  // Seeded: the same seed gives the same round (so tests and bug reports reproduce).
  assert.deepEqual(plain(C.makeQueue(pool, 8, seeded(3))), plain(C.makeQueue(pool, 8, seeded(3))));
});

test('marking: exact, missing accents with and without the exact-accents option, and typed pronouns', () => {
  const q = C.makeQuestion(E, { verb: 'hablar', tense: 'preterite', person: 0 }, 'es', () => 0);
  assert.equal(q.answers[0], 'hablé');
  assert.equal(q.pronoun, 'yo');
  assert.equal(C.check('hablé', q, { lang: 'es' }).ok, true);
  assert.equal(C.check('  Hablé ', q, { lang: 'es' }).ok, true, 'case and spaces do not matter');
  const loose = C.check('hable', q, { lang: 'es' });
  assert.equal(loose.ok, true);
  assert.equal(loose.accents, true, 'accepted, but the missing accent is flagged');
  const strict = C.check('hable', q, { lang: 'es', exact: true });
  assert.equal(strict.ok, false);
  assert.equal(strict.accents, true);
  assert.equal(C.check('yo hablé', q, { lang: 'es' }).ok, true, 'typing the pronoun is not wrong');
  assert.equal(C.check('hablo', q, { lang: 'es' }).ok, false);
  assert.equal(C.check('', q, { lang: 'es' }).empty, true);
  // German: ß typed as ss, umlaut left off — accents-only differences.
  const de = C.makeQuestion(E, { verb: 'fahren', tense: 'present', person: 1 }, 'de', () => 0);
  assert.equal(C.check('fahrst', de, { lang: 'de' }).accents, true);
  assert.equal(C.check('fahrst', de, { lang: 'de', exact: true }).ok, false);
  const heissen = C.makeQuestion(E, { verb: 'heißen', tense: 'present', person: 1 }, 'de', () => 0);
  assert.equal(C.check('heisst', heissen, { lang: 'de' }).ok, true);
});

test("French: j' elision, être agreement follows the pronoun shown, and both spellings of paie", () => {
  const pc = C.makeQuestion(E, { verb: 'parler', tense: 'passeCompose', person: 0 }, 'fr', () => 0);
  assert.equal(pc.pronoun, "j'");
  assert.equal(C.check('ai parlé', pc, { lang: 'fr' }).ok, true);
  assert.equal(C.check("j'ai parlé", pc, { lang: 'fr' }).ok, true);
  assert.equal(C.check('j’ai parlé', pc, { lang: 'fr' }).ok, true, 'a curly apostrophe is still an apostrophe');
  assert.equal(C.phrase(pc), "j'ai parlé");

  const pick = (i) => () => i / 3 + 0.01;
  const il = C.makeQuestion(E, { verb: 'aller', tense: 'passeCompose', person: 2 }, 'fr', pick(0));
  const elle = C.makeQuestion(E, { verb: 'aller', tense: 'passeCompose', person: 2 }, 'fr', pick(1));
  const on = C.makeQuestion(E, { verb: 'aller', tense: 'passeCompose', person: 2 }, 'fr', pick(2));
  assert.deepEqual([il.pronoun, elle.pronoun, on.pronoun], ['il', 'elle', 'on']);
  assert.equal(C.check('est allé', il, { lang: 'fr' }).ok, true);
  assert.equal(C.check('est allée', il, { lang: 'fr' }).ok, false, 'il cannot take a feminine participle');
  assert.equal(elle.answers[0], 'est allée');
  assert.equal(C.check('est allé', elle, { lang: 'fr' }).ok, false);
  assert.equal(C.check('est allés', on, { lang: 'fr' }).ok, true);
  const je = C.makeQuestion(E, { verb: 'partir', tense: 'passeCompose', person: 0 }, 'fr', () => 0);
  assert.deepEqual(plain(je.answers), ['suis parti', 'suis partie']);
  const vous = C.makeQuestion(E, { verb: 'venir', tense: 'passeCompose', person: 4 }, 'fr', () => 0);
  assert.deepEqual(plain(vous.answers), ['êtes venu', 'êtes venue', 'êtes venus', 'êtes venues']);
  const elles = C.makeQuestion(E, { verb: 'naître', tense: 'passeCompose', person: 5 }, 'fr', () => 0.6);
  assert.deepEqual(plain(elles.answers), ['sont nées']);

  const pay = C.makeQuestion(E, { verb: 'payer', tense: 'present', person: 0 }, 'fr', () => 0);
  assert.equal(C.check('paie', pay, { lang: 'fr' }).ok, true);
  assert.equal(C.check('paye', pay, { lang: 'fr', exact: true }).ok, true);
  const aime = C.makeQuestion(E, { verb: 'aimer', tense: 'present', person: 0 }, 'fr', () => 0);
  assert.equal(C.phrase(aime), "j'aime");
});

test('summary and mistakes', () => {
  const results = [
    { verb: 'ser', tense: 'present', person: 0, ok: true },
    { verb: 'ir', tense: 'present', person: 1, ok: false, given: 'vas', expected: 'vas' },
    { verb: 'ir', tense: 'present', person: 1, ok: false },
    { verb: 'dar', tense: 'present', person: 0, ok: false },
  ];
  const s = C.summarize(results, 61.4);
  assert.deepEqual([s.correct, s.answered, s.accuracy, s.secs, s.missed.length], [1, 4, 25, 61, 3]);
  assert.deepEqual(plain(C.mistakeItems(results)), [
    { verb: 'ir', tense: 'present', person: 1 }, { verb: 'dar', tense: 'present', person: 0 }]);
  assert.equal(C.summarize([], 0).accuracy, 0);
});

test('custom lists: accents restored, nonsense refused, unlisted verbs named', () => {
  const r = C.parseCustom(E, 'fr', 'parler, ecouter;preferer\nconclure  xyz parler');
  assert.deepEqual(plain(r.verbs), ['parler', 'écouter', 'préférer']);
  assert.deepEqual(plain(r.refused.map((x) => x.verb)), ['conclure', 'xyz']);
  assert.deepEqual(plain(r.unlisted), [], 'écouter is a set verb, préférer an engine one');
  const es = C.parseCustom(E, 'es', 'obtener saltar hablar');
  // obtener is in the engine tables and hablar in a set; saltar is in neither.
  assert.deepEqual(plain(es.unlisted), ['saltar']);
});

test('assignment links round-trip, survive odd titles, and refuse damage', () => {
  const a = C.newAssignment({ lang: 'fr', tenses: ['present', 'passeCompose'], set: 'irregular', persons: [0, 1, 2, 3, 4, 5], mode: 'count', count: 15, exact: true },
    { title: 'Semaine 5 — « être » <b>', goal: 12, id: 'abc123', made: 20261016 }, E);
  assert.equal(a.title, 'Semaine 5 — « être » b', 'angle brackets are dropped from a title');
  assert.ok(a.verbs.includes('être') && a.verbs.length > 20, 'the verb list travels in full');
  const url = C.assignmentUrl('https://fluxplanner.github.io/Flux/index.html#old', a);
  assert.match(url, /^https:\/\/fluxplanner\.github\.io\/Flux\/index\.html#verbs=[A-Za-z0-9_-]+$/);
  const back = C.decodeAssignment(url.split('#verbs=')[1], E);
  assert.deepEqual(plain(back), plain(a));
  assert.equal(C.fingerprint(back), C.fingerprint(a));
  assert.equal(C.assignmentConfig(back).count, 15);
  // Editing any setting changes the fingerprint.
  assert.notEqual(C.fingerprint({ ...plain(a), n: 5 }), C.fingerprint(a));
  assert.notEqual(C.fingerprint({ ...plain(a), verbs: a.verbs.slice(1) }), C.fingerprint(a));
  assert.throws(() => C.decodeAssignment('not-a-link', E), /incomplete or was changed/);
  assert.throws(() => C.decodeAssignment(btoa('{"v":1,"l":"xx"}'), E), /language/);
  // A goal can never exceed the questions in a count round.
  assert.equal(C.newAssignment({ lang: 'es', mode: 'count', count: 10 }, { goal: 99 }, E).goal, 10);
});

test('score codes: read back, catch edits, mix-ups, duplicates and impossible numbers', () => {
  const a = C.newAssignment({ lang: 'es', tenses: ['preterite'], set: 'irregular', mode: 'count', count: 20 }, { id: 'k3x9q2', goal: 15, made: 20261010 }, E);
  const fp = C.fingerprint(a);
  const code = C.makeCode({ name: 'Ana Pérez', fp, correct: 18, answered: 20, secs: 140, date: 20261016 });
  assert.match(code, /^FV1\.[0-9a-z]{6}\.18\.20\.140\.20261016\.[A-Za-z0-9_-]+\.[0-9a-z]{7}$/);
  const r = C.readCode(code);
  assert.equal(r.ok, true);
  assert.equal(r.name, 'Ana Pérez');

  const other = C.newAssignment({ lang: 'es', tenses: ['present'] }, { id: 'zzz111', made: 20261010 }, E);
  const otherCode = C.makeCode({ name: 'Ben', fp: C.fingerprint(other), correct: 30, answered: 31, secs: 120, date: 20261016 });
  const tampered = code.replace('.18.20.', '.20.20.');
  const cut = code.slice(0, -2);
  const early = C.makeCode({ name: 'Cy', fp, correct: 5, answered: 20, secs: 99, date: 20261001 });
  const pasted = `Ana: ${code}\nBen said ${otherCode} (done!)\nCarl ${tampered}\nDee ${cut}\n${code}\nCy ${early}`;
  const rows = C.checkCodes(pasted, a);
  assert.deepEqual(plain(rows.map((x) => x.status)), ['ok', 'other', 'edited', 'edited', 'duplicate', 'early']);
  assert.equal(rows[0].goalMet, true);
  assert.equal(rows[0].accuracy, 90);
  assert.equal(rows[5].goalMet, false);
  // Without an assignment the checker still reads codes and still catches edits.
  assert.deepEqual(plain(C.checkCodes(`${code} ${tampered}`, null).map((x) => x.status)), ['ok', 'edited']);
  // A forged code with impossible numbers is flagged even if its check holds.
  const odd = C.makeCode({ name: 'Ed', fp, correct: 25, answered: 25, secs: 60, date: 20261016 });
  assert.equal(C.checkCodes(odd, a)[0].status, 'odd');
  assert.deepEqual(plain(C.checkCodes('nothing here', a)), []);
});

test('the store: rounds and bests recorded, garbage ignored, two devices merged without loss', () => {
  let s = C.emptyStore();
  const e1 = { id: 'r1', at: 1000, lang: 'es', key: 'k', label: 'x', correct: 10, answered: 12, secs: 120 };
  let out = C.recordRound(s, e1);
  assert.equal(out.best, true);
  s = out.store;
  out = C.recordRound(s, { ...e1, id: 'r2', at: 2000, correct: 8, answered: 8 });
  assert.equal(out.best, false, 'fewer right is not a better score, even at 100%');
  s = out.store;
  assert.equal(s.history.length, 2);
  assert.equal(s.best.k.correct, 10);
  // Assignment rounds go to history but not to practice bests.
  s = C.recordRound(s, { ...e1, id: 'r3', at: 3000, correct: 50, fp: 'abcdef' }).store;
  assert.equal(s.best.k.correct, 10);
  s = C.recordAssignment(s, { fp: 'abcdef', title: 'T', lang: 'es', link: 'L', at: 5 }, { correct: 7, answered: 9, secs: 60, at: 6, code: 'FV1.x' });
  s = C.recordAssignment(s, { fp: 'abcdef', title: 'T', lang: 'es', link: 'L' }, { correct: 6, answered: 6, secs: 60, at: 7, code: 'FV1.y' });
  assert.equal(s.assignments[0].best.code, 'FV1.x', 'the better attempt is kept');

  const clean = C.sanitizeStore({ history: [null, 4, { id: 'ok', correct: 'x' }], best: { k: 'nope' }, assignments: 'no', name: 42 });
  assert.equal(clean.history.length, 1);
  assert.deepEqual(plain(clean.best), {});
  assert.deepEqual(plain(clean.assignments), []);

  const phone = C.recordRound(C.emptyStore(), { id: 'p1', at: 9000, lang: 'es', key: 'k', correct: 14, answered: 15, secs: 120 }).store;
  phone.name = 'Ana';
  const merged = C.mergeStore(s, phone);
  assert.deepEqual(plain(merged.history.map((h) => h.id)), ['p1', 'r3', 'r2', 'r1']);
  assert.equal(merged.best.k.correct, 14);
  assert.equal(merged.name, 'Ana');
  assert.equal(C.mergeStore(merged, null).history.length, 4, 'a missing remote changes nothing');
});

test('config: sanitised, keyed and described in plain words', () => {
  const c = C.sanitizeConfig({ lang: 'de', tenses: ['past', 'nope', 'past'], persons: [9, 0, 0, 2], mode: 'count', count: 1000, set: 'nope' }, E);
  assert.deepEqual(plain(c.tenses), ['past']);
  assert.deepEqual(plain(c.persons), [0, 2]);
  assert.equal(c.count, 100);
  assert.equal(c.set, 'regular');
  assert.equal(C.configKey(c), C.configKey(C.sanitizeConfig(plain(c), E)));
  assert.equal(C.describe(c, E), 'Präteritum · Common regular (weak) verbs · 100 questions');
  assert.equal(C.fmtDate(20261016), '16 Oct 2026');
  assert.equal(C.fmtSecs(125), '2:05');
});
