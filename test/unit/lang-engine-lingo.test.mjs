import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

/**
 * The study-hub engine (flux-lang-engine.js) takes Spanish and French forms
 * from Flux Lingo's conjugator (flux-conj.js) when both are loaded, as they are
 * in the planner bundle. Before, any verb outside its own tables was
 * conjugated by the regular rule: "hervo", "absolvo", "je convenis".
 */
const sandbox = { window: {}, Math, Date, JSON };
sandbox.globalThis = sandbox.window;
vm.createContext(sandbox);
for (const f of ['flux-conj.js', 'flux-conj-lexicon.js', 'flux-lang-engine.js']) {
  vm.runInContext(readFileSync(new URL('../../public/js/' + f, import.meta.url), 'utf8'), sandbox);
}
const E = sandbox.window.FluxLangEngine;
const C = sandbox.window.FluxConj;
const forms = (l, v, t) => [...E.conjugate(l, v, t).forms];

test('verbs outside the engine tables come out irregular where they are', () => {
  assert.deepEqual(forms('es', 'hervir', 'present').slice(0, 3), ['hiervo', 'hierves', 'hierve']);
  assert.equal(forms('es', 'absolver', 'present')[0], 'absuelvo');
  assert.equal(forms('es', 'cocer', 'present')[0], 'cuezo');
  assert.equal(forms('es', 'gruñir', 'preterite')[2], 'gruñó');
  assert.equal(forms('es', 'satisfacer', 'preterite')[2], 'satisfizo');
  assert.equal(forms('fr', 'convenir', 'present')[0], 'conviens');
  assert.equal(forms('fr', 'vêtir', 'passeCompose')[0], 'ai vêtu');
  assert.equal(forms('fr', 'bouillir', 'present')[0], 'bous');
});

test('être verbs drill the masculine and flag agreement', () => {
  const r = E.conjugate('fr', 'aller', 'passeCompose');
  assert.deepEqual([...r.forms], ['suis allé', 'es allé', 'est allé', 'sommes allés', 'êtes allés', 'sont allés']);
  assert.equal(r.agree, true);
});

test('the engine and Flux Lingo agree on every lexicon verb, every shared tense', () => {
  const map = { subjunctive: 'subjPresent' };
  const plain = (f) => String(f).replace(/\(e\)/g, '').replace(/\(s\)/g, 's');
  const bad = [];
  for (const lang of ['es', 'fr']) {
    for (const v of Object.keys(C.lexicon(lang))) {
      if (/se$|^(se |s')/.test(v)) continue;
      const ref = C.conjugate(lang, v);
      for (const t of E.tenses(lang)) {
        const want = ref.tenses[map[t.id] || t.id];
        if (!want) continue;
        const got = E.conjugate(lang, v, t.id).forms;
        want.forEach((w, i) => { if (w != null && plain(w) !== got[i]) bad.push(`${lang} ${v} ${t.id}.${i}: ${got[i]} ≠ ${w}`); });
      }
    }
  }
  assert.deepEqual(bad.slice(0, 10), []);
});

test('German is untouched', () => {
  assert.equal(forms('de', 'fahren', 'present')[2], 'fährt');
});
