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

/* ── Precise coursework marking ─────────────────────────────────────── */

const SESSION_STORE = () => new Map([['flux_tutor_session', JSON.stringify({ access_token: 'tok', refresh_token: 'r', expires_at: Math.floor(Date.now() / 1000) + 3600 })]]);
const reply = (obj) => ({ ok: true, status: 200, headers: { get: () => 'application/json' }, json: async () => ({ content: [{ text: typeof obj === 'string' ? obj : JSON.stringify(obj) }] }) });

test('every written component has level descriptors that cover its marks, and economics is out of 14', () => {
  AI.COMPONENTS.filter((c) => c.kind === 'written' && c.id !== 'custom').forEach((c) => {
    assert.ok(c.rules, c.id + ' has rules');
    c.criteria.forEach((k) => {
      assert.ok(Array.isArray(k.levels) && k.levels.length, c.id + ' ' + k.id + ' has levels');
      const ranges = k.levels.map((l) => AI.levelRange(l[0]));
      ranges.forEach((r, i) => assert.ok(r, c.id + ' ' + k.id + ' level ' + k.levels[i][0]));
      assert.equal(ranges[0][1], k.max, c.id + ' ' + k.id + ': the top level ends at the maximum');
      assert.equal(ranges[ranges.length - 1][0], 1, c.id + ' ' + k.id + ': the bottom level starts at 1');
      for (let i = 1; i < ranges.length; i++) assert.equal(ranges[i][1] + 1, ranges[i - 1][0], c.id + ' ' + k.id + ': levels leave no gap');
    });
  });
  const econ = AI.COMPONENTS.find((c) => c.id === 'econ-ia');
  assert.deepEqual(clone(econ.criteria.map((k) => k.id + k.max)), ['A3', 'B2', 'C3', 'D3', 'E3']);
  assert.equal(AI.COMPONENTS.find((c) => c.id === 'tok-essay').criteria[0].max, 10);
});

test('a criterion mark is held inside the level the examiner chose, and quotes must be in the draft', () => {
  const k = AI.COMPONENTS.find((c) => c.id === 'sci-ia').criteria[0];
  const draft = 'My research question is how temperature affects catalase activity between 20 and 60 °C.';
  const r = AI.parseCriterion(JSON.stringify({ level: '3–4', mark: 6, met: ['States the question'], missing: ['No context'], evidence: ['how temperature affects catalase activity', 'a quote I made up'], fixes: [{ quote: 'between 20 and 60', advice: 'Say why this range.' }], confidence: 'high' }), k, draft);
  assert.equal(r.mark, 4, 'a 6 in the 3-4 level becomes 4');
  assert.equal(r.level, '3–4');
  assert.equal(r.next.name, '5–6');
  assert.deepEqual(clone(r.evidence), ['how temperature affects catalase activity']);
  assert.equal(r.fixes[0].quote, 'between 20 and 60');
  const noLevel = AI.parseCriterion(JSON.stringify({ mark: 2, evidence: [] , confidence: 'high' }), k, draft);
  assert.equal(noLevel.level, '1–2', 'the level is found from the mark');
  assert.equal(noLevel.confidence, 'medium', 'no backing quote: not "high"');
  assert.equal(AI.parseCriterion('not json', k, draft), null);
});

test('a long draft is split at paragraphs, and part notes keep only real quotes', () => {
  const para = (i) => 'Paragraph ' + i + ' ' + 'word '.repeat(300).trim() + '.';
  const draft = Array.from({ length: 8 }, (_, i) => para(i + 1)).join('\n\n');
  const parts = AI.splitDraft(draft, 7000);
  assert.ok(parts.length >= 2);
  parts.forEach((p) => assert.ok(p.length <= 7000));
  assert.equal(parts.join('\n\n'), draft, 'nothing is lost or reordered');
  const comp = AI.COMPONENTS.find((c) => c.id === 'ee');
  const got = AI.parsePart(JSON.stringify({ notes: [{ c: 'A', kind: 'strength', quote: 'Paragraph 1 word word', note: 'x' }, { c: 'A', quote: 'invented words here' }, { c: 'Z', quote: 'Paragraph 1' }] }), comp.criteria, parts[0]);
  assert.equal(got.notes.length, 1);
});

test('the whole EE is read: long drafts go part by part, then one call per criterion with the opening kept', async () => {
  const sent = [];
  const fetchImpl = async (url, init) => {
    const body = JSON.parse(init.body);
    sent.push(body);
    const sys = body.messages[0].content;
    if (/ONE part of a longer/.test(sys)) return reply({ notes: [] });
    return reply({ level: '3-4', mark: 4, met: ['ok'], missing: ['more'], evidence: [], fixes: [], confidence: 'medium' });
  };
  const { AI: A } = load(fetchImpl, SESSION_STORE());
  const comp = A.COMPONENTS.find((c) => c.id === 'ee');
  const draft = 'Research question: To what extent did X cause Y?\n\n' + Array.from({ length: 30 }, (_, i) => 'Section ' + i + ' ' + 'evidence and analysis '.repeat(40)).join('\n\n');
  const progress = [];
  const r = await A.courseFeedback(comp, draft, '', { onProgress: (t) => progress.push(t) });
  const partCalls = sent.filter((b) => /ONE part of a longer/.test(b.messages[0].content)).length;
  const critCalls = sent.length - partCalls;
  assert.ok(partCalls >= 3, 'read in parts');
  assert.equal(critCalls, 5, 'one call per criterion');
  sent.filter((b) => !/ONE part/.test(b.messages[0].content)).forEach((b) => {
    assert.match(b.messages[1].content, /Research question: To what extent/, 'every criterion sees the research question');
    assert.ok(b.messages[1].content.length < 14000, 'small enough that ai-proxy never cuts it');
  });
  assert.equal(r.total, 4 * 4 + 4, 'D is out of 8, so its 3-4 level keeps 4; E tops out at 4');
  assert.equal(r.max, 30);
  assert.equal(r.whole, false);
  assert.ok(progress.some((t) => /Reading part 1/.test(t)) && progress.some((t) => /criterion D/.test(t)));
  assert.equal(r.priorities.length, 3);
});

test('a short draft is sent whole to each criterion; trying again after an error reuses the criteria already marked', async () => {
  let calls = 0;
  let failed = false;
  const fetchImpl = async (url, init) => {
    calls++;
    const user = JSON.parse(init.body).messages[1].content;
    assert.match(user, /The draft:\n"""/, 'sent whole');
    if (calls === 2 && !failed) { failed = true; return { ok: false, status: 429, headers: { get: () => 'application/json' }, json: async () => ({ error: 'daily_limit_reached' }) }; }
    return reply({ level: '5-6', mark: 5, evidence: ['temperature affects catalase'], confidence: 'high' });
  };
  const { AI: A } = load(fetchImpl, SESSION_STORE());
  const comp = A.COMPONENTS.find((c) => c.id === 'sci-ia');
  const draft = 'My question is how temperature affects catalase activity. '.repeat(60);
  await assert.rejects(() => A.courseFeedback(comp, draft, ''), (e) => e.code === 'limit');
  assert.equal(calls, 2);
  const r = await A.courseFeedback(comp, draft, '');
  assert.equal(calls, 5, 'criterion RD came from memory; only the other three were asked');
  assert.equal(r.total, 20);
  assert.equal(r.whole, true);
  assert.match(r.summary, /Predicted 20 of 24/);
});

/* ── Lesson transcripts ─────────────────────────────────────────────── */

test('caption files become plain lines: no timings, cue numbers or repeats', () => {
  const vtt = 'WEBVTT\n\n1\n00:00:01.000 --> 00:00:04.000\n<v Ms Rao>Photosynthesis happens in the chloroplast.\n\n2\n00:00:04.000 --> 00:00:06.000\n<v Ms Rao>Photosynthesis happens in the chloroplast.\n\n3\n00:00:06.000 --> 00:00:09.000\nIt needs light energy.';
  assert.equal(AI.cleanTranscript(vtt), 'Ms Rao: Photosynthesis happens in the chloroplast.\nIt needs light energy.');
  assert.equal(AI.cleanTranscript('Speaker 1  0:03\nHello class\n0:10\nOpen your books'), 'Hello class\nOpen your books');
});

test('a transcript with no punctuation is still cut into numbered pieces', () => {
  const words = Array.from({ length: 200 }, (_, i) => 'w' + i).join(' ');
  const segs = AI.lessonSegments(words, 45);
  assert.ok(segs.length >= 5);
  segs.forEach((s, i) => { assert.equal(s.n, i + 1); assert.ok(s.text.split(' ').length <= 45); });
  assert.equal(segs.map((s) => s.text).join(' '), words);
});

test('lesson notes keep only items that cite lines of their own part', () => {
  const p = AI.parseLessonPart(JSON.stringify({
    title: 'Light reactions',
    points: [{ text: 'Light reactions happen in the thylakoid.', s: [3, 4] }, { text: 'Made up.', s: [99] }, { text: 'No source.' }],
    terms: [{ term: 'Photolysis', def: 'Splitting water using light.', s: [5] }, { term: 'X', def: 'y', s: [] }],
    exam: [{ text: 'Learn the Z-scheme diagram.', s: [6] }],
    tasks: [{ text: 'Finish worksheet 3 by Friday.', s: [2, 50] }],
  }), 1, 10);
  assert.equal(p.points.length, 1);
  assert.equal(p.terms.length, 1);
  assert.deepEqual(clone(p.tasks[0].s), [2]);
  const text = AI.lessonNotesText({ parts: [p] }, 'Biology lesson');
  assert.match(text, /^Biology lesson/);
  assert.match(text, /Photolysis: Splitting water using light\./, 'terms become "Term: definition" lines for flashcards');
});

test('a long lesson is turned into notes part by part', async () => {
  let calls = 0;
  const fetchImpl = async (url, init) => {
    calls++;
    const user = JSON.parse(init.body).messages[1].content;
    const first = Number((user.match(/\[(\d+)\]/) || [])[1]);
    return reply({ title: 'Part', points: [{ text: 'A point.', s: [first] }] });
  };
  const { AI: A } = load(fetchImpl, SESSION_STORE());
  const text = Array.from({ length: 2000 }, (_, i) => 'word' + i).join(' ');
  const n = await A.lessonNotes(text, { subject: 'Biology' });
  assert.ok(calls >= 2);
  assert.equal(n.parts.length, calls);
  assert.equal(n.missed, 0);
});
