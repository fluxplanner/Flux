import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import vm from 'node:vm';

/**
 * Flux Teach: every kind of question in every skill, made many times over with
 * different seeds. A problem must build, its answer must be well formed, the
 * answer as the page shows it must be marked right, and the working must say
 * something. This is what lets the lessons claim "right by construction".
 */
const dir = new URL('../../public/js/', import.meta.url);
const store = {};
const sandbox = {
  Math, Date, JSON, console,
  localStorage: { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } },
};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
sandbox.document = { addEventListener() {} };
sandbox.setTimeout = () => 0;
vm.createContext(sandbox);
const files = ['flux-ib-syllabus.js', 'flux-conj.js', 'flux-conj-lexicon.js', 'flux-lang-practice.js', 'flux-teach-core.js']
  .concat(readdirSync(dir).filter((f) => /^flux-teach-(?!core|ui)[\w-]+\.js$/.test(f)).sort());
for (const f of files) vm.runInContext(readFileSync(new URL(f, dir), 'utf8'), sandbox, { filename: f });
const T = sandbox.FluxTeach;
const IB = sandbox.FluxIbSyllabus;
const RUNS = Number(process.env.TEACH_RUNS || 60);

test('lessons are registered for every subject in the syllabus', () => {
  const missing = IB.subjects().filter((s) => s.programme !== 'MYP' && !T.forSubject(s.id).length).map((s) => s.id);
  assert.equal(missing.join(', '), '');
});

test('every skill names real units and has a method', () => {
  for (const s of T.skills()) {
    assert.ok(s.units.length, s.id + ': no units');
    for (const u of s.units) assert.ok(IB.unit(u), s.id + ': unknown unit ' + u);
    assert.ok(s.method.length >= 2, s.id + ': method too short');
    const ids = s.variants.map((v) => v.id);
    assert.equal(new Set(ids).size, ids.length, s.id + ': duplicate variant ids');
  }
});

test('every variant builds, and its own answer is marked right', () => {
  const bad = [];
  let made = 0;
  for (const s of T.skills()) {
    for (const v of s.variants) {
      for (let i = 0; i < RUNS; i++) {
        let p;
        try { p = T.make(s, v, 1000 + i * 7919); } catch (e) { bad.push(`${s.id}/${v.id}#${i}: ${e.message}`); break; }
        made++;
        const where = `${s.id}/${v.id}#${i}`;
        if (!p.q || typeof p.q !== 'string') bad.push(where + ': no question');
        if (!Array.isArray(p.steps) || !p.steps.length || p.steps.some((x) => typeof x !== 'string' || !x.trim())) bad.push(where + ': empty working');
        if (/undefined|\bNaN\b|\bInfinity\b|\[object/.test(p.q + p.steps.join(' ') + (p.options || []).join(' '))) bad.push(where + ': undefined/NaN in text: ' + p.q + ' | ' + p.steps.join(' | '));
        if (p.type === 'num') {
          if (!Number.isFinite(p.answer)) { bad.push(where + ': answer not finite'); continue; }
          if (!T.check(p, String(p.answer)).ok) bad.push(where + ': exact answer marked wrong: ' + p.answer);
          // What the page prints as the answer must itself be marked right.
          const shown = T.answerText(p).replace(/×10\^\{(-?\d+)\}/, '×10^$1').replace(/−/g, '-');
          if (!T.check(p, shown).ok) bad.push(where + ': shown answer ' + shown + ' marked wrong (answer ' + p.answer + ')');
        } else if (p.type === 'choice') {
          if (p.options.length < 2) bad.push(where + ': fewer than 2 options');
          if (new Set(p.options).size !== p.options.length) bad.push(where + ': duplicate options');
          if (!T.check(p, p.options.indexOf(p.answer)).ok) bad.push(where + ': right option marked wrong');
        } else if (!p.answer || typeof p.answer !== 'string') bad.push(where + ': no text answer');
        else if (!T.check(p, p.answer).ok) bad.push(where + ': text answer marked wrong');
      }
    }
  }
  assert.ok(made > 1000, 'too few problems made: ' + made);
  assert.deepEqual(bad.slice(0, 25), []);
});

test('marking: rounding near-misses and sign slips are called close', () => {
  const p = { type: 'num', answer: 12.345, tol: 0.001, steps: ['x'] };
  assert.equal(T.check(p, '12.35').ok, true);
  assert.equal(T.check(p, '12.9').close, true);
  assert.equal(T.check(p, '-12.345').close, true);
  assert.equal(T.check(p, '3/4').ok, false);
  assert.equal(T.parseNum('2.5×10^3'), 2500);
  assert.equal(T.parseNum('2.5e-3'), 0.0025);
  assert.equal(T.parseNum('−3/4'), -0.75);
  assert.equal(T.check({ type: 'num', answer: 0.000123, sf: 3, steps: ['x'] }, '1.23 x 10^-4').ok, true);
});

test('next kind of question: every kind comes up before any repeats', () => {
  const s = T.skills().find((k) => k.variants.length >= 3);
  T.reset(s.id);
  const seen = new Set();
  let last = null;
  for (let i = 0; i < s.variants.length; i++) {
    const v = T.nextVariant(s.id, last);
    seen.add(v.id);
    T.record(s.id, v.id, true);
    last = v.id;
  }
  assert.equal(seen.size, s.variants.length);
  assert.equal(T.mastery(s.id).mastered, true);
  T.record(s.id, last, false);
  assert.equal(T.mastery(s.id).mastered, false, 'a wrong answer breaks the streak');
});
