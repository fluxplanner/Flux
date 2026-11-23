import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

/**
 * flux-tutor-ai.js — Flux AI inside Flux Tutor. The network is faked here;
 * what matters is that every reply is checked before a student sees it:
 * marks need a real quote from the answer, questions need real passages,
 * chat citations need real passages, coursework quotes must be in the draft.
 * Also the core's mistakes log and blurt checker (flux-tutor-core.js).
 */
const coreSrc = readFileSync(new URL('../../public/js/flux-tutor-core.js', import.meta.url), 'utf8');
const aiSrc = readFileSync(new URL('../../public/js/flux-tutor-ai.js', import.meta.url), 'utf8');

function load(fetchImpl, storage) {
  const store = storage || new Map();
  const localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => { store.set(k, String(v)); },
    removeItem: (k) => { store.delete(k); },
  };
  const sandbox = { window: {}, URL, URLSearchParams, TextDecoder, setTimeout, localStorage, fetch: fetchImpl || (() => { throw new Error('no network in tests'); }) };
  sandbox.window.FluxSB = { url: 'https://example.supabase.co', anon: 'anon-key' };
  vm.createContext(sandbox);
  vm.runInContext(coreSrc, sandbox);
  vm.runInContext(aiSrc, sandbox);
  return { T: sandbox.window.FluxTutor, AI: sandbox.window.FluxTutorAI, store };
}
const clone = (x) => JSON.parse(JSON.stringify(x));
const { T, AI } = load();

const Q = {
  prompt: 'Outline the role of ribosomes.',
  command: 'Outline',
  marks: 2,
  scheme: [{ text: 'Ribosomes are the site of protein synthesis.' }, { text: 'They translate mRNA into a polypeptide.' }],
};

test('a mark needs the words that earn it', () => {
  const answer = 'Ribosomes are where proteins are made. They read the mRNA.';
  const reply = JSON.stringify({
    points: [
      { n: 1, met: true, evidence: 'where proteins are made', note: 'Correct.' },
      { n: 2, met: true, evidence: 'they build polypeptides from tRNA', note: 'Invented quote.' },
    ],
    wrong: [], comment: 'Good start.', next: 'Say they translate mRNA.', model: 'x', confidence: 'high',
  });
  const r = AI.parseMark(reply, Q, answer);
  assert.equal(r.awarded, 1, 'the point with a made-up quote is not given');
  assert.equal(r.points[0].met, true);
  assert.equal(r.points[1].met, false);
  assert.equal(r.points[1].claimed, true);
  assert.equal(r.confidence, 'low', 'an unbacked award lowers confidence');
});

test('quotes match despite case, curly quotes and spacing', () => {
  assert.equal(AI.quoted('The cell’s  Membrane controls entry.', "the cell's membrane"), true);
  assert.equal(AI.quoted('Short.', 'a'), false, 'one letter is not a quote');
  assert.equal(AI.quoted('Mitochondria release energy.', 'chloroplasts'), false);
});

test('marks never exceed the question and broken replies fail safely', () => {
  const reply = JSON.stringify({ points: [{ n: 1, met: true, evidence: 'protein' }, { n: 2, met: true, evidence: 'protein' }, { n: 3, met: true, evidence: 'protein' }] });
  assert.equal(AI.parseMark(reply, Q, 'protein synthesis').awarded, 2);
  assert.equal(AI.parseMark('not json at all', Q, 'x').failed, true);
  assert.equal(AI.parseMark('```json\n{"points":[]}\n```', Q, 'x').awarded, 0, 'code fences are read');
});

test('generated questions keep only points from real passages', () => {
  const passages = [{ text: 'Osmosis is the passive movement of water across a membrane.', ref: { source: 'Notes' }, sentenceId: 's1' }];
  const reply = JSON.stringify({ questions: [
    { command: 'define', prompt: 'Define osmosis.', scheme: [{ text: 'Passive movement of water', p: 1 }] },
    { command: 'Explain', prompt: 'Explain why cells burst.', scheme: [{ text: 'Water enters', p: 1 }, { text: 'Made up', p: 4 }] },
    { command: 'Ponder', prompt: 'Ponder life.', scheme: [{ text: 'x', p: 1 }] },
  ] });
  const qs = AI.parseQuestions(reply, passages, { programme: 'DP' });
  assert.equal(qs.length, 1);
  assert.equal(qs[0].command, 'Define');
  assert.equal(qs[0].marks, 1);
  assert.equal(qs[0].scheme[0].sentenceId, 's1');
  assert.equal(qs[0].paper, 2);
});

test('chat replies: citations only to real passages, "beyond your notes" kept apart', () => {
  const paras = clone(AI.parseChat('ATP stores energy [1]. It is made in mitochondria [2][7].\n\nBeyond your notes: ATP was discovered in 1929 [1].', 2));
  assert.equal(paras.length, 2);
  assert.equal(paras[0].beyond, false);
  const cites = paras[0].lines[0].parts.filter((p) => p.cite).map((p) => p.cite);
  assert.deepEqual(cites, [1, 2], 'passage 7 does not exist');
  assert.equal(paras[1].beyond, true);
  assert.equal(paras[1].lines[0].parts.some((p) => p.cite), false, 'no citations inside beyond-your-notes');
  const bullets = clone(AI.parseChat('- one\n- two', 0));
  assert.equal(bullets[0].lines.every((l) => l.bullet), true);
});

test('coursework: marks clamp, quotes must be in the draft, custom criteria parse', () => {
  const comp = AI.COMPONENTS.find((c) => c.id === 'sci-ia');
  const draft = 'My research question is how temperature affects enzyme activity. The uncertainty was ±0.1 s.';
  const reply = JSON.stringify({ criteria: [
    { id: 'RD', mark: 9, working: ['Clear question'], fixes: [{ quote: 'how temperature affects enzyme activity', advice: 'Give the range.' }, { quote: 'not in the draft', advice: 'x' }] },
    { id: 'DA', mark: 3 },
  ], priorities: ['a', 'b', 'c', 'd'], summary: 'ok' });
  const r = AI.parseCourse(reply, comp.criteria, draft);
  assert.equal(r.rows[0].mark, 6, 'clamped to the maximum');
  assert.equal(r.rows[0].fixes[0].quote, 'how temperature affects enzyme activity');
  assert.equal(r.rows[0].fixes[1].quote, '', 'a quote not in the draft is dropped');
  assert.equal(r.rows[2].mark, 0, 'a criterion the reply skipped scores 0');
  assert.equal(r.max, 24);
  assert.equal(r.priorities.length, 3);
  const custom = clone(AI.customCriteria('A. Research design (6)\nCriterion B: Data analysis 4 marks\nrubbish line'));
  assert.deepEqual(custom.map((c) => [c.id, c.name, c.max]), [['A', 'Research design', 6], ['B', 'Data analysis', 4]]);
  const checks = AI.courseChecks(comp, draft).map((c) => c.text).join(' ');
  assert.match(checks, /evaluation/i, 'a missing evaluation is flagged without AI');
});

test('every component has criteria that add up', () => {
  AI.COMPONENTS.filter((c) => c.id !== 'custom').forEach((c) => {
    assert.ok(c.criteria.length, c.id);
    c.criteria.forEach((k) => assert.ok(k.max > 0 && k.id && k.name, c.id + ' ' + k.id));
  });
  assert.equal(AI.COMPONENTS.find((c) => c.id === 'sci-ia').criteria.reduce((n, k) => n + k.max, 0), 24);
  assert.equal(AI.COMPONENTS.find((c) => c.id === 'math-ia').criteria.reduce((n, k) => n + k.max, 0), 20);
  assert.equal(AI.COMPONENTS.find((c) => c.id === 'ee').criteria.reduce((n, k) => n + k.max, 0), 30);
});

test('teach-back and blurt checks drop quotes that are not the student\'s', () => {
  const t = AI.parseTeach(JSON.stringify({ score: 9, right: ['x'], missing: ['y'], wrong: [{ quote: 'cells are alive', fix: 'z', p: 1 }, { quote: 'never said', fix: 'q' }], question: 'Why?' }), 'Cells are alive and tiny.', 2);
  assert.equal(t.score, 5);
  assert.equal(t.wrong.length, 1);
  const b = AI.parseBlurt(JSON.stringify({ wrong: [{ quote: 'ATP is a protein', fix: 'It is a nucleotide' }] }), 'I think ATP is a protein.', 1);
  assert.equal(b.wrong.length, 1);
});

test('the same answer is marked once: the second time comes from memory', async () => {
  let calls = 0;
  const fetchImpl = async (url) => {
    calls++;
    assert.match(String(url), /functions\/v1\/ai-proxy$/);
    return { ok: true, status: 200, headers: { get: () => 'application/json' }, json: async () => ({ content: [{ text: JSON.stringify({ points: [{ n: 1, met: true, evidence: 'site of protein synthesis' }, { n: 2, met: false }] }) }] }) };
  };
  const store = new Map([['flux_tutor_session', JSON.stringify({ access_token: 'tok', refresh_token: 'r', expires_at: Math.floor(Date.now() / 1000) + 3600 })]]);
  const { AI: ai } = load(fetchImpl, store);
  const a = await ai.markAnswer(Q, 'Ribosomes are the site of protein synthesis.');
  const b = await ai.markAnswer(Q, 'Ribosomes are the site of protein synthesis.');
  assert.equal(calls, 1);
  assert.equal(a.awarded, 1);
  assert.equal(b.awarded, 1);
  assert.equal(b.fromCache, true);
});

test('signed out, or out of daily Flux AI, says so plainly', async () => {
  const { AI: out } = load(async () => { throw new Error('should not be called'); });
  await assert.rejects(out.call({ system: 's', messages: [] }), (e) => e.code === 'signin');
  const store = new Map([['flux_tutor_session', JSON.stringify({ access_token: 'tok', refresh_token: 'r', expires_at: Math.floor(Date.now() / 1000) + 3600 })]]);
  const { AI: lim } = load(async () => ({ ok: false, status: 429, json: async () => ({ error: 'daily_limit_reached' }) }), store);
  await assert.rejects(lim.call({ system: 's', messages: [] }), (e) => e.code === 'limit' && /tomorrow/.test(e.message));
});

test('an expired session refreshes once and is saved', async () => {
  let refreshes = 0;
  const fetchImpl = async (url) => {
    if (/grant_type=refresh_token/.test(url)) { refreshes++; return { ok: true, json: async () => ({ access_token: 'new', refresh_token: 'r2', expires_in: 3600 }) }; }
    return { ok: true, status: 200, headers: { get: () => 'application/json' }, json: async () => ({ content: [{ text: 'hi' }] }) };
  };
  const store = new Map([['flux_tutor_session', JSON.stringify({ access_token: 'old', refresh_token: 'r1', expires_at: 1 })]]);
  const { AI: ai } = load(fetchImpl, store);
  assert.equal(await ai.call({ system: 's', messages: [] }), 'hi');
  assert.equal(refreshes, 1);
  assert.equal(JSON.parse(store.get('flux_tutor_session')).refresh_token, 'r2');
});

/* ── Core: mistakes log and blurting ───────────────────────────────────── */

test('mistakes: one entry per question, counted, fixed, kept through a save', () => {
  const set = T.newSet({ title: 'x' });
  T.logMistake(set, { kind: 'test', prompt: 'What is ATP?', given: 'a sugar', answer: 'An energy carrier' });
  T.logMistake(set, { kind: 'learn', prompt: 'what is  ATP?', given: 'a fat', answer: 'An energy carrier' });
  T.logMistake(set, { kind: 'ib', prompt: 'Define osmosis.', given: '', answer: '' });
  assert.equal(set.mistakes.length, 2, 'the same prompt bumps its count');
  assert.equal(set.mistakes[0].count, 2);
  assert.equal(T.openMistakes(set)[0].prompt, 'What is ATP?', 'most-missed first');
  T.fixMistake(set, set.mistakes[1].id);
  assert.equal(T.openMistakes(set).length, 1);
  const back = T.normalizeSet(clone(set));
  assert.equal(back.mistakes.length, 2);
  assert.equal(T.summarizeSet(back).mistakes, 1);
  assert.equal(T.logMistake(set, { prompt: '  ' }), null, 'an empty prompt is ignored');
});

test('blurting finds the terms recalled, explained and missed', () => {
  const set = T.sampleSet();
  const corpus = T.buildCorpus(set.sources);
  const guide = T.buildGuide(set.sources, { corpus });
  const concepts = T.conceptsFromGuide(corpus, guide);
  const first = concepts[0];
  const r = T.blurtCheck(corpus, concepts, guide, first.label + ' ' + first.def, {});
  const row = r.terms.find((x) => x.id === first.id);
  assert.equal(row.named, true);
  assert.equal(row.explained, true);
  assert.ok(r.terms.some((x) => !x.named), 'others are missed');
  assert.ok(r.pct > 0 && r.pct < 100);
  assert.equal(T.blurtCheck(corpus, concepts, guide, '', {}).got, 0);
});
