import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { performance } from 'node:perf_hooks';

/**
 * flux-tutor-core.js — everything Flux Tutor does with a student's notes that
 * is not drawing: the study guide, questions, answer checking, mastery, the
 * Learn session, practice tests, "Ask your notes", the study plan and the
 * saved-set model. It runs here in a bare VM, as teacher.html runs it.
 */
const coreSrc = readFileSync(new URL('../../public/js/flux-tutor-core.js', import.meta.url), 'utf8');
const sandbox = { window: {}, URL };
vm.createContext(sandbox);
vm.runInContext(coreSrc, sandbox);
const T = sandbox.window.FluxTutor;
/** VM objects have the VM's prototypes; deepEqual wants plain ones. */
const clone = (x) => (x === undefined ? undefined : JSON.parse(JSON.stringify(x)));
const eq = (actual, expected, msg) => assert.deepEqual(clone(actual), clone(expected), msg);
const NOW = '2026-10-11T10:00:00.000Z';

function build(sources) {
  const corpus = T.buildCorpus(sources);
  const guide = T.buildGuide(sources, { corpus, now: NOW });
  const concepts = T.conceptsFromGuide(corpus, guide);
  return { corpus, guide, concepts, by: (label) => concepts.find((c) => c.label === label) };
}
const sample = T.sampleSet();
const S = build(sample.sources);

const MESSY = [
  'Page 1',
  'WWI causes',
  '• Militarism – the build-up of armed forces and the belief that war is a good way to solve problems.',
  '• Alliances: agreements between countries to defend each other if attacked',
  '- Imperialism = competition for colonies and empire',
  '* Nationalism refers to strong pride in your own country.',
  'The assassination of Archduke Franz Ferdinand in Sarajevo on 28 June 1914 triggered the war. Austria-Hungary declared war on Serbia a month later.',
  '',
  'Page 2',
  'the Triple Entente was formed by Britain, France and Russia. The Triple Alliance',
  'linked Germany, Austria-Hungary and Italy. Because of the alliance system, a local',
  'conflict quickly became a European war.',
  '',
  'Glossary',
  'Trench warfare: fighting from long ditches dug into the ground, used on the Western Front.',
  'Stalemate - a situation where neither side can win.',
  '1. The Schlieffen Plan was Germany\'s plan to defeat France quickly before turning to Russia.',
  '2. Over 9 million soldiers died in the war.',
].join('\n');
const M = build([{ id: 'hist', name: 'history.pdf', kind: 'PDF', text: MESSY }]);

const PLAIN = 'Volcanoes form where tectonic plates meet. Magma is molten rock beneath the surface of the earth. When magma reaches the surface it is called lava. A composite volcano is a tall steep cone built from layers of ash and lava. Shield volcanoes are wide gentle volcanoes made from runny lava. The Ring of Fire is a zone around the Pacific Ocean with many volcanoes. Mount St. Helens erupted in 1980 and killed 57 people.';
const P = build([{ id: 'geo', name: 'Pasted notes', kind: 'Notes', text: PLAIN }]);

const termOf = (B, label) => B.guide.terms.find((t) => t.term === label);
const squash = (s) => String(s).replace(/\s+/g, ' ').trim();

/* ── The study guide ─────────────────────────────────────────────────── */

test('sample: the outline follows the headings and the key terms come with the notes\' own definitions', () => {
  eq(S.guide.outline.map((o) => [o.level, o.title]), [
    [1, 'Cells and energy'], [2, 'Cell structure'], [2, 'The history of cell theory'], [2, 'Photosynthesis'],
    [2, 'Respiration'], [2, 'Moving substances'], [2, 'Glossary'],
  ]);
  const labels = S.guide.terms.map((t) => t.term);
  for (const want of ['Organelles', 'Nucleus', 'Ribosomes', 'Mitochondria', 'Cell membrane', 'Cell wall', 'Chloroplasts', 'Photosynthesis',
    'Chlorophyll', 'Limiting factor', 'Aerobic respiration', 'Anaerobic respiration', 'ATP', 'Diffusion', 'Osmosis', 'Enzyme', 'Glucose', 'Robert Hooke']) {
    assert.ok(labels.includes(want), 'missing term ' + want + ' in ' + labels.join(', '));
  }
  for (const bad of ['Glossary', 'Notes', 'Sample', 'Cells and energy']) assert.ok(!labels.includes(bad), 'not a term: ' + bad);
  assert.equal(termOf(S, 'Enzyme').def, 'A protein that speeds up chemical reactions without being used up.');
  assert.equal(termOf(S, 'Ribosomes').def, 'Tiny structures that build proteins.');
  assert.equal(termOf(S, 'Nucleus').def, 'The organelle that contains the cell\'s DNA and controls its activities.');
  eq(clone(termOf(S, 'ATP').aliases), ['adenosine triphosphate']);
  assert.equal(termOf(S, 'Robert Hooke').kind, 'mention');
  // In the order the notes introduce them.
  assert.ok(labels.indexOf('Nucleus') < labels.indexOf('Photosynthesis') && labels.indexOf('Photosynthesis') < labels.indexOf('Osmosis'));
  const facts = S.guide.facts.map((f) => f.text);
  assert.ok(facts.some((f) => f.startsWith('In 1665, Robert Hooke')));
  eq(clone(S.guide.facts.find((f) => f.text.startsWith('In 1665')).tags), ['date']);
  assert.ok(S.guide.facts.find((f) => /2 ATP per glucose/.test(f.text)).tags.includes('number'));
  // Each section's summary is sentences from that section.
  const photo = S.guide.outline.find((o) => o.title === 'Photosynthesis');
  assert.ok(photo.summary.length >= 1 && photo.summary.every((p) => S.corpus.byId[p.sentenceId].section === 'Photosynthesis'));
});

test('every citation points at real text in the right file, page and paragraph', () => {
  for (const B of [S, M, P]) {
    const sources = B === S ? sample.sources : B === M ? [{ id: 'hist', text: MESSY }] : [{ id: 'geo', text: PLAIN }];
    const whole = squash(sources.map((s) => s.text).join('\n').replace(/^\s*(?:[•*-]|\d+\.)\s+/gm, ''));
    // Sentences are copied from the notes; paragraphs are numbered 1, 2, 3… on each page.
    const seen = new Map();
    B.corpus.paragraphs.forEach((p) => {
      const key = p.ref.sourceId + ':' + p.ref.page;
      assert.equal(p.ref.para, (seen.get(key) || 0) + 1, 'paragraphs numbered in order');
      seen.set(key, p.ref.para);
      p.sentences.forEach((s) => {
        assert.ok(whole.includes(squash(s.text)), 'sentence not in the notes: ' + s.text);
        eq(clone(s.ref), clone(p.ref));
      });
    });
    const check = (item) => {
      const s = B.corpus.byId[item.sentenceId];
      assert.ok(s, 'citation to a missing sentence: ' + item.sentenceId);
      eq(clone(item.ref), clone(s.ref));
      return s;
    };
    B.guide.terms.forEach((t) => {
      const s = check(t);
      if (t.kind === 'definition') {
        const d = t.def.replace(/\.$/, '').toLowerCase();
        assert.ok(s.text.toLowerCase().includes(d.slice(0, Math.min(d.length, 25))), t.term + ': definition not from its sentence');
      } else assert.equal(t.def, s.text);
      assert.ok(T.formatRef(t.ref).startsWith(t.ref.source));
    });
    B.guide.facts.forEach((f) => assert.equal(check(f).text, f.text));
    B.guide.outline.forEach((o) => o.summary.forEach((p) => assert.equal(check(p).text, p.text)));
  }
  // The page numbers come from the PDF's page markers.
  const sentence = (text) => M.corpus.sentences.find((s) => s.text.startsWith(text));
  assert.equal(sentence('Austria-Hungary declared war').ref.page, 1);
  assert.equal(sentence('The Triple Alliance').ref.page, 2);
  assert.equal(T.formatRef(sentence('Stalemate').ref), 'history.pdf · page 2 · paragraph 2');
  assert.equal(T.formatRef(null), 'Your study guide');
  assert.equal(T.formatRef({ edited: true }), 'Your study guide (written by you)');
});

test('messy notes: bullets, glossary lines, PDF page markers and wrapped lines', () => {
  const texts = M.corpus.sentences.map((s) => s.text);
  assert.ok(texts.includes('Militarism – the build-up of armed forces and the belief that war is a good way to solve problems.'), 'bullet stripped');
  assert.ok(texts.includes('The Triple Alliance linked Germany, Austria-Hungary and Italy.'), 'a sentence wrapped over two PDF lines is joined');
  assert.ok(!texts.some((t) => /^Page \d/.test(t)), 'page markers are not sentences');
  eq(M.guide.outline.map((o) => o.title), ['WWI causes', 'Glossary']);
  const def = (label) => (termOf(M, label) || {}).def;
  assert.equal(def('Militarism'), 'The build-up of armed forces and the belief that war is a good way to solve problems.');
  assert.equal(def('Alliances'), 'Agreements between countries to defend each other if attacked.');
  assert.equal(def('Imperialism'), 'Competition for colonies and empire.');
  assert.equal(def('Nationalism'), 'Strong pride in your own country.');
  assert.equal(def('Trench warfare'), 'Fighting from long ditches dug into the ground, used on the Western Front.');
  assert.equal(def('Stalemate'), 'A situation where neither side can win.');
  assert.equal(def('Schlieffen Plan'), 'Germany\'s plan to defeat France quickly before turning to Russia.');
  assert.equal(termOf(M, 'Archduke Franz Ferdinand').kind, 'mention');
  assert.ok(termOf(M, 'Triple Alliance'), 'a longer name is its own term beside "Alliances"');
  assert.ok(M.guide.facts.some((f) => f.text.includes('28 June 1914') && f.tags.includes('date')));
  assert.ok(M.guide.facts.some((f) => f.text.startsWith('Over 9 million') && f.tags.includes('number')));
});

test('pasted notes with no headings: one section, definitions, names with "St." in them', () => {
  eq(P.guide.outline.map((o) => o.title), ['Pasted notes']);
  assert.ok(P.guide.outline[0].summary.length >= 1);
  assert.equal(termOf(P, 'Magma').def, 'Molten rock beneath the surface of the earth.');
  assert.equal(termOf(P, 'Lava').def, 'When magma reaches the surface it is called lava.');
  assert.equal(termOf(P, 'Composite volcano').def, 'A tall steep cone built from layers of ash and lava.');
  assert.ok(termOf(P, 'Shield volcanoes'));
  assert.ok(termOf(P, 'Ring of Fire'));
  assert.ok(termOf(P, 'Mount St. Helens'), 'the whole name, not "Mount St"');
  assert.ok(!P.guide.terms.some((t) => t.term === 'Mount St'));
  assert.ok(P.corpus.sentences.some((s) => s.text === 'Mount St. Helens erupted in 1980 and killed 57 people.'), '"St." does not end a sentence');
  // The "Lava" question hides the term but keeps the sentence that explains it.
  const q = T.makeWritten(P.corpus, P.by('Lava'), P.concepts);
  assert.equal(q.stem, 'When magma reaches the surface it is called _____.');
});

test('text clean-up: ligatures, words broken over a line, PDF lines into paragraphs, sentence splits', () => {
  assert.equal(T.normalizeText('The ﬁrst photo-\nsynthesis step\r\n\r\n\r\nNext'), 'The first photosynthesis step\n\nNext');
  const pdf = T.pdfLinesToText([
    'Cells are the basic unit of life and every living thing is made of at least one cell.',
    'Some organisms are made of just one cell.',
    'Others, like people, are made of trillions of cells working together in tissues.',
    'Tissues form organs.',
  ]);
  const paras = pdf.split('\n\n');
  assert.equal(paras.length, 2, 'a short line that ends a sentence ends its paragraph');
  assert.match(paras[0], /just one cell\.$/);
  eq(clone(T.splitSentences('It costs 3.5 dollars, e.g. on Mon. Dr. Who said so. Then it ended!')),
    ['It costs 3.5 dollars, e.g. on Mon.', 'Dr. Who said so.', 'Then it ended!']);
  assert.equal(T.measure(T.buildCorpus([{ text: 'Too short.' }])).enough, false);
  assert.equal(T.measure(S.corpus).enough, true);
});

test('stemming: plurals and verb forms meet', () => {
  assert.equal(T.stem('cells'), T.stem('cell'));
  assert.equal(T.stem('divides'), T.stem('dividing'));
  assert.equal(T.stem('absorbs'), T.stem('absorbing'));
  assert.equal(T.stem('studies'), T.stem('study'));
  assert.notEqual(T.stem('aerobic'), T.stem('anaerobic'));
});

/* ── Questions ───────────────────────────────────────────────────────── */

const stemsOf = (text) => T.words(text).map(T.stem);
const hasSeq = (hay, needle) => {
  for (let i = 0; i + needle.length <= hay.length; i++) if (needle.every((x, j) => hay[i + j] === x)) return true;
  return false;
};
const conceptLists = (c) => [c.stems].concat(c.aliases.map((a) => stemsOf(a).filter((w, i, arr) => !(i === 0 && arr.length > 1 && ['the', 'a', 'an'].includes(w)))));

test('question makers: distractors never equal the answer, cloze hides the term, false statements are false', () => {
  const known = new Set(S.corpus.sentences.map((s) => T.norm(s.text)));
  let made = { mc: 0, mcdef: 0, cloze: 0, written: 0, tfTrue: 0, tfFalse: 0 };
  S.concepts.forEach((c, i) => {
    const rnd = T.seeded('q' + i);
    const mc = T.makeChoice(S.corpus, c, S.concepts, rnd);
    if (mc) {
      made.mc++;
      assert.equal(mc.options.filter((o) => o === mc.answer).length, 1);
      assert.equal(new Set(mc.options.map(T.norm)).size, mc.options.length, 'no two options alike');
      mc.options.filter((o) => o !== mc.answer).forEach((o) => assert.notEqual(T.norm(o), T.norm(c.label)));
      assert.ok(!conceptLists(c).some((l) => hasSeq(stemsOf(mc.stem), l)), 'the clue does not name the answer: ' + mc.stem);
      assert.ok(mc.options.length >= 3 && mc.options.length <= 4);
    }
    const md = T.makeDefChoice(S.corpus, c, S.concepts, rnd);
    if (md) {
      made.mcdef++;
      assert.equal(md.options.filter((o) => o === md.answer).length, 1);
      assert.equal(new Set(md.options.map(T.norm)).size, md.options.length);
    }
    const cz = T.makeCloze(S.corpus, c, S.concepts, rnd);
    if (cz) {
      made.cloze++;
      assert.equal(cz.before + cz.answer + cz.after, cz.source.text, 'the blank is cut from the cited sentence');
      const rest = stemsOf(cz.before + ' ' + cz.after);
      assert.ok(!conceptLists(c).some((l) => hasSeq(rest, l)), 'cloze gives the term away: ' + cz.source.text);
      assert.equal(T.checkAnswer(cz, cz.answer).verdict, 'correct');
    }
    const wr = T.makeWritten(S.corpus, c, S.concepts);
    if (wr) {
      made.written++;
      assert.ok(!conceptLists(c).some((l) => hasSeq(stemsOf(wr.stem), l)), 'written clue names the answer: ' + wr.stem);
      assert.equal(T.checkAnswer(wr, c.label).verdict, 'correct');
    }
    for (const truth of [true, false]) {
      const tf = T.makeTrueFalse(S.corpus, c, S.concepts, rnd, null, truth);
      if (!tf) continue;
      if (tf.answer === 'false') {
        made.tfFalse++;
        assert.notEqual(T.norm(tf.statement), T.norm(tf.source.text));
        assert.ok(!known.has(T.norm(tf.statement)), 'a "false" statement that the notes actually say: ' + tf.statement);
        const other = S.concepts.find((o) => o.id === tf.swapped);
        assert.ok(other && T.norm(tf.statement).includes(T.norm(other.label)), 'the swapped-in term is in the statement');
        assert.ok(tf.note.length > 0);
      } else {
        made.tfTrue++;
        if (tf.source.sentenceId) assert.equal(tf.statement, tf.source.text);
      }
    }
  });
  for (const k of Object.keys(made)) assert.ok(made[k] >= 8, k + ' made only ' + made[k] + ' times');
});

test('matching: 3–4 different terms, and grading pair by pair', () => {
  const group = ['Diffusion', 'Osmosis', 'Enzyme', 'Glucose'].map(S.by);
  const q = T.makeMatch(S.corpus, group, T.seeded('m'));
  assert.equal(q.pairs.length, 4);
  eq(clone(q.options).sort(), q.pairs.map((p) => p.term).sort());
  assert.equal(q.sources.length, 4);
  const right = Object.fromEntries(q.pairs.map((p) => [p.conceptId, p.term]));
  assert.equal(T.checkAnswer(q, right).verdict, 'correct');
  const twoWrong = { ...right, [q.pairs[0].conceptId]: q.pairs[1].term, [q.pairs[1].conceptId]: q.pairs[0].term };
  const res = T.checkAnswer(q, twoWrong);
  assert.equal(res.verdict, 'partial');
  assert.equal(res.score, 0.5);
  assert.equal(res.perConcept[q.pairs[0].conceptId], false);
  assert.equal(res.perConcept[q.pairs[2].conceptId], true);
  assert.equal(T.checkAnswer(q, {}).verdict, 'empty');
  assert.equal(T.makeMatch(S.corpus, group.slice(0, 2), T.seeded('m')), null, 'two terms is not a matching question');
});

test('questions are repeatable from a seed', () => {
  const c = S.by('Osmosis');
  eq(clone(T.makeChoice(S.corpus, c, S.concepts, T.seeded('x'))), clone(T.makeChoice(S.corpus, c, S.concepts, T.seeded('x'))));
});

/* ── Checking answers ────────────────────────────────────────────────── */

test('checkAnswer forgives case, accents, articles and a small typo, but not a different term', () => {
  const v = (q, a) => T.checkAnswer(q, a).verdict;
  const mito = T.makeWritten(S.corpus, S.by('Mitochondria'), S.concepts);
  assert.equal(v(mito, 'mitochondria'), 'correct');
  assert.equal(v(mito, '  MITOCHONDRIA. '), 'correct');
  assert.equal(v(mito, 'the mitochondria'), 'correct');
  assert.equal(v(mito, 'Mitochondría'), 'correct');
  assert.equal(v(mito, 'mitocondria'), 'close');
  assert.equal(v(mito, 'mitochondira'), 'close', 'two letters swapped is one slip');
  assert.ok(T.isRight('close'));
  assert.match(T.checkAnswer(mito, 'mitocondria').note, /Check the spelling: Mitochondria/);
  assert.equal(v(mito, 'ribosomes'), 'incorrect');
  assert.equal(v(mito, 'mtcndra'), 'incorrect', 'too many slips');
  assert.equal(v(mito, ''), 'empty');

  const aero = T.makeWritten(S.corpus, S.by('Aerobic respiration'), S.concepts);
  eq(clone(aero.others), ['Anaerobic respiration']);
  const wrongTerm = T.checkAnswer(aero, 'anaerobic respiration');
  assert.equal(wrongTerm.verdict, 'incorrect', 'a different term from the notes is not a typo');
  assert.match(wrongTerm.note, /different term/);
  assert.equal(v(aero, 'aerobic respiraton'), 'close');
  assert.equal(v(aero, 'respiration'), 'partial');
  assert.equal(T.checkAnswer(aero, 'respiration').score, 0.5);
  // Even without the other term in the notes, "anaerobic" is not a one-letter slip of "aerobic".
  assert.equal(v({ type: 'written', answer: 'aerobic', accept: [] }, 'anaerobic'), 'incorrect');
  assert.ok(!T.isRight(v({ type: 'written', answer: 'aerobic respiration', accept: [] }, 'anaerobic respiration')), 'two slips spread over a phrase are not one word\'s typo');
  assert.equal(v({ type: 'written', answer: 'hypotonic', accept: [] }, 'hypertonic'), 'incorrect');
  assert.equal(v({ type: 'written', answer: 'mitosis', accept: [] }, 'meiosis'), 'incorrect');

  const atp = T.makeWritten(S.corpus, S.by('ATP'), S.concepts);
  assert.equal(v(atp, 'adenosine triphosphate'), 'correct', 'the other name the notes give');
  assert.equal(v(atp, 'ADP'), 'incorrect', 'short words must be exact');
  assert.equal(v({ type: 'cloze', answer: '1914', accept: ['1914'] }, '1915'), 'incorrect', 'numbers must be exact');
  assert.equal(v({ type: 'cloze', answer: 'cell wall', accept: [] }, 'cellwall'), 'close');

  const mc = T.makeChoice(S.corpus, S.by('Osmosis'), S.concepts, T.seeded('o'));
  assert.equal(v(mc, mc.answer), 'correct');
  assert.equal(v(mc, mc.options.find((o) => o !== mc.answer)), 'incorrect');
  const tf = { type: 'tf', answer: 'false', statement: 'x' };
  assert.equal(v(tf, 'False'), 'correct');
  assert.equal(v(tf, 'f'), 'correct');
  assert.equal(v(tf, 'true'), 'incorrect');
  assert.equal(T.answerText(tf), 'False');
});

/* ── Mastery ─────────────────────────────────────────────────────────── */

test('mastery: right answers climb, a miss after mastering drops two levels, skips change nothing', () => {
  let m = T.newMastery();
  assert.equal(T.statusOf(m), 'new');
  m = T.applyResult(m, 'correct', NOW);
  m = T.applyResult(m, 'close', NOW);
  assert.equal(T.statusOf(m), 'learning');
  m = T.applyResult(m, 'correct', NOW);
  assert.equal(m.level, 3);
  assert.equal(T.statusOf(m), 'mastered');
  m = T.applyResult(m, 'incorrect', NOW);
  assert.equal(m.level, 1);
  assert.equal(m.streak, 0);
  const before = clone(m);
  eq(clone(T.applyResult(m, 'skipped', NOW)), before);
  eq(clone(T.applyResult(m, 'partial', NOW)).level, before.level);
  let weak = T.applyResult(T.applyResult(null, 'incorrect', NOW), 'incorrect', NOW);
  assert.equal(T.statusOf(weak), 'weak');
  assert.ok(T.weakness(weak) > T.weakness(m));
  const sum = T.masterySummary([{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }], { a: { level: 3, seen: 3, right: 3, wrong: 0 }, b: weak, c: { level: 1, seen: 1, right: 1, wrong: 0 } });
  eq(clone(sum), { total: 4, mastered: 1, learning: 1, weak: 1, fresh: 1, percent: 33 });
});

/* ── Learn ───────────────────────────────────────────────────────────── */

function rightAnswer(q) {
  if (q.type === 'match') return Object.fromEntries(q.pairs.map((p) => [p.conceptId, p.term]));
  return T.answerText(q);
}
function wrongAnswer(q) {
  if (q.type === 'match') return Object.fromEntries(q.pairs.map((p, i) => [p.conceptId, q.pairs[(i + 1) % q.pairs.length].term]));
  if (q.type === 'tf') return q.answer === 'true' ? 'false' : 'true';
  if (q.type === 'mc' || q.type === 'mcdef') return q.options.find((o) => o !== q.answer);
  return 'zzzz';
}

test('learn: a short quick check first, then one small step at a time', () => {
  const topics = ['Diffusion', 'Osmosis', 'Enzyme', 'Glucose'].map((l) => S.by(l).id);
  const mastery = {};
  const s = T.startLearn(S.corpus, S.concepts, topics, mastery, { seed: 'L1', now: NOW });
  assert.equal(s.phase, 'check');
  assert.ok(s.check.questions.length >= 3 && s.check.questions.length <= 5);
  assert.ok(s.check.questions.every((q) => topics.includes(q.conceptId) && q.source && q.source.text));
  // Get Osmosis wrong, the rest right: Osmosis comes first.
  const osmosis = S.by('Osmosis').id;
  s.check.questions.forEach((q) => T.answerCheck(s, mastery, q.id, q.conceptId === osmosis ? wrongAnswer(q) : rightAnswer(q), NOW));
  T.finishCheck(s, mastery);
  assert.equal(s.phase, 'learn');
  eq(clone(s.queue).sort(), topics.slice().sort());
  assert.ok(s.check.questions.some((q) => q.conceptId === osmosis), 'every chosen term is in the quick check');
  assert.equal(s.queue[0], osmosis, 'the term missed in the quick check comes first');
  const step = T.nextStep(s, S.corpus, S.concepts, mastery, NOW);
  assert.equal(step.teach, true, 'the first step on a term teaches it from the notes');
  assert.ok(step.explain.length >= 1 && step.explain.every((p) => p.ref && p.text));
  const c = S.concepts.find((x) => x.id === step.conceptIds[0]);
  assert.equal(step.explain[0].sentenceId, c.definition.sentenceId, 'the explanation is the notes\' own definition');
  assert.ok(step.q && step.q.source);
});

test('learn: next, back, skip and repeat; nothing is lost when you move on without answering', () => {
  const topics = ['Nucleus', 'Ribosomes', 'Chlorophyll', 'Osmosis', 'Diffusion'].map((l) => S.by(l).id);
  const mastery = {};
  const s = T.startLearn(S.corpus, S.concepts, topics, mastery, { seed: 'L2', now: NOW, skipCheck: true });
  assert.equal(s.phase, 'learn');
  const a = T.nextStep(s, S.corpus, S.concepts, mastery, NOW);
  T.answerStep(s, mastery, rightAnswer(a.q), NOW);
  const b = T.nextStep(s, S.corpus, S.concepts, mastery, NOW);
  assert.notEqual(a.id, b.id);
  // Back shows the answered step as it was; next returns to b without making a new step.
  assert.equal(T.backStep(s).id, a.id);
  assert.equal(T.atLatest(s), false);
  assert.equal(T.answerStep(s, mastery, wrongAnswer(a.q), NOW).verdict, 'correct', 'an answered step cannot be answered again');
  assert.equal(T.nextStep(s, S.corpus, S.concepts, mastery, NOW).id, b.id);
  assert.equal(s.steps.length, 2);
  // Moving on from b without answering skips it: b's term goes to the back of the line.
  const bTerm = b.conceptIds[0];
  const c = T.nextStep(s, S.corpus, S.concepts, mastery, NOW);
  assert.equal(b.rec.verdict, 'skipped');
  assert.equal(s.queue[s.queue.length - 1], bTerm);
  assert.ok(!mastery[bTerm] || mastery[bTerm].seen === 0, 'a skip is not marked');
  // Skip on purpose.
  T.skipStep(s, NOW);
  assert.equal(c.rec.verdict, 'skipped');
  assert.equal(s.queue[s.queue.length - 1], c.conceptIds[0]);
  // Repeat: another question on the same term, straight away.
  const d = T.nextStep(s, S.corpus, S.concepts, mastery, NOW);
  T.answerStep(s, mastery, rightAnswer(d.q), NOW);
  assert.equal(T.repeatStep(s, NOW), true);
  const e = T.nextStep(s, S.corpus, S.concepts, mastery, NOW);
  eq(clone(e.conceptIds), clone(d.conceptIds));
  assert.equal(e.teach, false, 'only the first step on a term teaches it');
  assert.equal(T.currentStep(s).id, e.id);
});

test('learn: weak terms come back more often, mastered ones leave, and the session ends', () => {
  const labels = ['Nucleus', 'Ribosomes', 'Chlorophyll', 'Osmosis', 'Diffusion', 'Enzyme'];
  const topics = labels.map((l) => S.by(l).id);
  const hard = S.by('Osmosis').id;
  const mastery = {};
  const s = T.startLearn(S.corpus, S.concepts, topics, mastery, { seed: 'L3', now: NOW, skipCheck: true });
  const seen = {};
  let step;
  let guard = 0;
  while ((step = T.nextStep(s, S.corpus, S.concepts, mastery, NOW)) && guard++ < 140) {
    step.conceptIds.forEach((id) => { seen[id] = (seen[id] || 0) + 1; });
    const missIt = step.conceptIds.includes(hard) && (seen[hard] || 0) <= 4;
    T.answerStep(s, mastery, missIt ? wrongAnswer(step.q) : rightAnswer(step.q), NOW);
  }
  assert.equal(s.phase, 'done', 'the session ends once every term is mastered');
  assert.ok(s.doneAt);
  for (const id of topics) {
    assert.equal(T.statusOf(mastery[id]), 'mastered', S.concepts.find((c) => c.id === id).label + ' mastered');
    if (id !== hard) assert.ok(seen[hard] > seen[id], 'the missed term came back more than ' + S.concepts.find((c) => c.id === id).label);
  }
  // Right after a miss, the term returns within three steps.
  const steps = s.steps;
  const missIdx = steps.findIndex((x) => x.conceptIds.length === 1 && x.conceptIds[0] === hard && x.rec.verdict === 'incorrect');
  const back = steps.slice(missIdx + 1).findIndex((x) => x.conceptIds.includes(hard));
  assert.ok(back >= 0 && back <= 2, 'came back after ' + (back + 1) + ' steps');
  const sum = T.learnSummary(s, S.concepts, mastery);
  assert.equal(sum.mastered, topics.length);
  assert.equal(sum.shaky.length, 0);
  assert.ok(sum.answered > 0 && sum.right <= sum.answered);
  assert.equal(T.nextStep(s, S.corpus, S.concepts, mastery, NOW), null);
});

test('learn: the next session starts with the weakest terms; "I\'m not sure" counts as not yet', () => {
  const topics = ['Nucleus', 'Ribosomes', 'Chlorophyll'].map((l) => S.by(l).id);
  const mastery = { [topics[0]]: { level: 3, seen: 3, right: 3, wrong: 0, streak: 3, lastAt: NOW }, [topics[2]]: { level: 0, seen: 3, right: 0, wrong: 3, streak: 0, lastAt: NOW } };
  const s = T.startLearn(S.corpus, S.concepts, topics, mastery, { seed: 'L4', now: NOW, skipCheck: true });
  eq(clone(s.queue), [topics[2], topics[1], topics[0]]);
  T.nextStep(s, S.corpus, S.concepts, mastery, NOW);
  const rec = T.dontKnow(s, mastery, NOW);
  assert.equal(rec.verdict, 'incorrect');
  assert.equal(rec.unsure, true);
  assert.equal(mastery[topics[2]].wrong, 4);
});

test('learn: "Simpler" and "Another example" only use the notes', () => {
  const B = build([{ id: 'phys', name: 'Physics', kind: 'Notes', text: [
    '## Forces',
    'Inertia is the tendency of an object to resist any change in its motion. Objects with more mass have more inertia.',
    '',
    'For example, a passenger lurches forward when a moving bus brakes suddenly, because of inertia.',
    '',
    'A seatbelt protects you because your inertia would otherwise carry you forward in a crash.',
    '',
    'Friction is a force that opposes motion between two surfaces in contact.',
  ].join('\n') }]);
  const c = B.by('Inertia');
  const ex = T.examplesFor(B.corpus, c, [c.definition.sentenceId]);
  assert.ok(ex.length >= 2);
  assert.equal(ex[0].example, true, 'a "for example" passage comes first');
  ex.forEach((e) => e.sentences.forEach((p) => {
    assert.equal(B.corpus.byId[p.sentenceId].text, p.text);
    assert.notEqual(p.sentenceId, c.definition.sentenceId, 'not the passage already shown');
  }));
  const simple = T.simplerFor(B.corpus, c, B.concepts, [c.definition.sentenceId]);
  assert.ok(simple.sentences.length >= 1);
  simple.sentences.forEach((p) => assert.equal(B.corpus.byId[p.sentenceId].text, p.text));
  assert.equal(typeof simple.plainer, 'boolean');
  if (!simple.plainer) assert.match(simple.note, /plainest way your notes put/);
  eq(clone(T.examplesFor(B.corpus, B.by('Friction'), B.by('Friction').mentions)), [], 'no more examples: an empty list, nothing made up');
});

/* ── Practice test ───────────────────────────────────────────────────── */

test('practice test: mixed questions, graded, wrong answers reviewable with their source', () => {
  const qs = T.buildPracticeTest(S.corpus, S.concepts, {}, { count: 12, seed: 'P1' });
  assert.equal(qs.length, 12);
  assert.equal(new Set(qs.map((q) => q.id)).size, 12);
  const types = new Set(qs.map((q) => q.type));
  assert.ok(types.has('match') && types.has('tf') && (types.has('mc') || types.has('mcdef')) && (types.has('written') || types.has('cloze')), [...types].join(','));
  assert.ok(qs.every((q) => q.type === 'match' ? q.sources.length >= 3 : q.source && q.source.text));
  eq(clone(T.buildPracticeTest(S.corpus, S.concepts, {}, { count: 12, seed: 'P1' })), clone(qs), 'same seed, same test');

  const all = T.gradePracticeTest(qs, Object.fromEntries(qs.map((q) => [q.id, rightAnswer(q)])));
  eq([all.right, all.total, all.pct], [12, 12, 100]);
  const none = T.gradePracticeTest(qs, {});
  eq([none.right, none.pct], [0, 0]);
  assert.ok(none.results.every((r) => r.blank && r.verdict === 'incorrect'));
  const half = T.gradePracticeTest(qs, Object.fromEntries(qs.map((q, i) => [q.id, i % 2 ? rightAnswer(q) : wrongAnswer(q)])));
  assert.equal(half.right, 6);
  assert.equal(half.pct, 50);
  const missed = half.results.filter((r) => !T.isRight(r.verdict)).map((r) => qs.find((q) => q.id === r.qid));
  assert.ok(missed.every((q) => q.type === 'match' ? q.sources.length : q.source.text), 'every missed question carries its source');
});

test('practice test: "weak only" asks about terms not yet mastered; matching only still fills the test', () => {
  const mastery = {};
  S.concepts.forEach((c, i) => { if (i >= 3) mastery[c.id] = { level: 3, seen: 3, right: 3, wrong: 0, streak: 3, lastAt: NOW }; });
  const weakIds = new Set(S.concepts.slice(0, 3).map((c) => c.id));
  const qs = T.buildPracticeTest(S.corpus, S.concepts, mastery, { count: 6, focus: 'weak', types: ['mc', 'tf', 'written'], seed: 'P2' });
  assert.ok(qs.length >= 3);
  assert.ok(qs.every((q) => weakIds.has(q.conceptId)));
  const match = T.buildPracticeTest(S.corpus, S.concepts, {}, { count: 3, types: ['match'], seed: 'P3' });
  assert.equal(match.length, 3);
  assert.ok(match.every((q) => q.type === 'match'));
});

/* ── Ask your notes ──────────────────────────────────────────────────── */

test('ask your notes: BM25 with stemming ranks the right paragraph and highlights the words', () => {
  const idx = T.buildSearchIndex(S.corpus);
  const r = T.searchNotes(S.corpus, idx, 'What does chlorophyll absorb?', S.concepts);
  assert.equal(r.covered, true);
  eq(clone(r.words), ['chlorophyll', 'absorb']);
  assert.ok(r.results[0].sentences.some((p) => p.text.startsWith('Chlorophyll is the green pigment that absorbs light energy')));
  assert.equal(r.results[0].ref.source, 'Sample biology notes');
  assert.ok(r.terms.some((t) => t.term === 'Chlorophyll'));
  const segs = T.highlightSegments('Chlorophyll is the green pigment that absorbs light energy.', r.stems);
  assert.equal(segs.map((x) => x.text).join(''), 'Chlorophyll is the green pigment that absorbs light energy.');
  eq(segs.filter((x) => x.hit).map((x) => x.text), ['Chlorophyll', 'absorbs']);

  const resp = T.searchNotes(S.corpus, idx, 'energy released without oxygen during exercise');
  assert.equal(resp.covered, true);
  assert.equal(resp.results[0].section, 'Respiration');
  for (let i = 1; i < resp.results.length; i++) assert.ok(resp.results[i - 1].score >= resp.results[i].score, 'ranked by score');
});

test('ask your notes: says so honestly when nothing covers the question', () => {
  const r = T.searchNotes(S.corpus, null, 'What caused the French Revolution?');
  assert.equal(r.covered, false);
  eq(clone(r.results), []);
  assert.ok(r.missing.includes('french') && r.missing.includes('revolution'));
  // One shared word is not enough for a three-word question; the near misses are labelled "related".
  const near = T.searchNotes(S.corpus, null, 'photosynthesis in deep ocean trenches');
  assert.equal(near.covered, false);
  assert.ok(near.related.length >= 1);
  assert.equal(T.searchNotes(S.corpus, null, 'what is the?').empty, true);
});

/* ── Study plan ──────────────────────────────────────────────────────── */

test('study plan: every term spread over the days left, weak ones reviewed more, a test at the end', () => {
  const concepts = S.concepts.slice(0, 12).map((c) => ({ id: c.id, label: c.label }));
  const weak = new Set(concepts.slice(0, 3).map((c) => c.id));
  const mastery = {};
  concepts.forEach((c) => { mastery[c.id] = weak.has(c.id) ? { level: 0, seen: 2, right: 0, wrong: 2 } : { level: 1, seen: 1, right: 1, wrong: 0 }; });
  const plan = T.buildStudyPlan({ concepts, mastery, examDate: '2026-10-21', today: '2026-10-11' });
  assert.equal(plan.ok, true);
  assert.equal(plan.daysLeft, 10);
  const dates = plan.days.map((d) => d.date);
  assert.equal(dates[0], '2026-10-11');
  assert.ok(dates.every((d, i) => d >= '2026-10-11' && d < '2026-10-21' && (!i || d > dates[i - 1])));
  const items = plan.days.flatMap((d) => d.items);
  assert.equal(new Set(items.map((x) => x.id)).size, items.length, 'ids are unique (they key the checklist)');
  const learned = items.filter((x) => x.type === 'learn').flatMap((x) => x.conceptIds);
  eq(learned.slice().sort(), concepts.map((c) => c.id).sort(), 'each term is learned once');
  assert.ok(weak.has(learned[0]), 'weakest first');
  const reviews = (id) => items.filter((x) => x.type === 'review' && x.conceptIds.includes(id)).length;
  const strongIds = concepts.map((c) => c.id).filter((id) => !weak.has(id));
  const avg = (ids) => ids.reduce((n, id) => n + reviews(id), 0) / ids.length;
  assert.ok(avg([...weak]) > avg(strongIds), 'weak terms are reviewed more');
  const last = plan.days[plan.days.length - 1];
  assert.ok(last.items.some((x) => x.type === 'test'));
  assert.ok(items.every((x) => x.label));
  assert.match(items.find((x) => x.type === 'learn').label, /^Learn: /);
  eq(clone(T.buildStudyPlan({ concepts, mastery, examDate: '2026-10-21', today: '2026-10-11' })), clone(plan), 'the same plan twice');
});

test('study plan: exam today, tomorrow, far away, past or missing', () => {
  const concepts = S.concepts.slice(0, 5).map((c) => ({ id: c.id, label: c.label }));
  const today = T.buildStudyPlan({ concepts, examDate: '2026-10-11', today: '2026-10-11' });
  assert.equal(today.days.length, 1);
  eq(today.days[0].items.map((x) => x.type), ['review', 'cards', 'test']);
  const tomorrow = T.buildStudyPlan({ concepts, examDate: '2026-10-12', today: '2026-10-11' });
  assert.equal(tomorrow.days.length, 1);
  assert.ok(tomorrow.days[0].items.some((x) => x.type === 'learn'));
  const far = T.buildStudyPlan({ concepts, examDate: '2027-03-01', today: '2026-10-11' });
  assert.equal(far.truncated, true);
  assert.ok(far.days.length <= T.LIMITS.planDays);
  eq(clone(T.buildStudyPlan({ concepts, examDate: '2026-10-01', today: '2026-10-11' })).reason, 'past');
  eq(clone(T.buildStudyPlan({ concepts, examDate: '', today: '2026-10-11' })).reason, 'no-date');
  eq(clone(T.buildStudyPlan({ concepts, examDate: '2026-02-30', today: '2026-10-11' })).reason, 'no-date');
});

/* ── Editing the guide ───────────────────────────────────────────────── */

test('study guide edits: fix, delete with undo, add; a rebuild keeps them', () => {
  const guide = T.buildGuide(sample.sources, { now: NOW });
  const osm = guide.terms.find((t) => t.term === 'Osmosis');
  const before = T.editItem(guide, 'terms', osm.id, { def: 'Water moving across a membrane.' });
  assert.equal(before.def, 'The diffusion of water across a partially permeable membrane.');
  assert.equal(osm.edited, true);
  const removed = T.removeItem(guide, 'terms', guide.terms.find((t) => t.term === 'Glucose').id);
  assert.ok(guide.removed.includes(removed.item.id));
  const mine = T.addTerm(guide, 'Turgor', 'Pressure of water pushing the cell membrane against the cell wall.');
  assert.equal(mine.kind, 'user');
  assert.equal(T.addTerm(guide, 'No definition', '  '), null);
  const fact = T.addFact(guide, 'Plants lose water through stomata in 2 ways.');
  eq(clone(fact.tags), ['number']);
  // Rebuilding from the same notes keeps the edit, the deletion and the added term.
  const merged = T.mergeGuide(guide, T.buildGuide(sample.sources, { now: NOW }));
  assert.equal(merged.terms.find((t) => t.id === osm.id).def, 'Water moving across a membrane.');
  assert.ok(!merged.terms.some((t) => t.term === 'Glucose'));
  assert.ok(merged.terms.some((t) => t.term === 'Turgor'));
  assert.ok(merged.facts.some((f) => f.id === fact.id));
  // Undo the deletion.
  T.restoreItem(guide, 'terms', removed);
  assert.equal(guide.terms[removed.index].term, 'Glucose');
  assert.ok(!guide.removed.includes(removed.item.id));
  // An edited definition is what Learn teaches, credited to the student.
  const c = T.conceptsFromGuide(S.corpus, guide).find((x) => x.id === osm.id);
  assert.equal(c.definition.full, 'Water moving across a membrane.');
  assert.equal(c.definition.ref.edited, true);
  // Topics for "pick topics": the notes' sections, then the student's own terms.
  const topics = T.topicsFor(S.corpus, T.conceptsFromGuide(S.corpus, guide));
  assert.equal(topics[topics.length - 1].title, 'Terms you added');
  assert.ok(topics.find((t) => t.title === 'Respiration').conceptIds.includes(S.by('ATP').id));
});

/* ── The saved study set ─────────────────────────────────────────────── */

test('sets: normalize keeps a good set, drops junk and caps sizes', () => {
  const set = T.sampleSet();
  set.examDate = '2026-11-02';
  set.guide = T.buildGuide(set.sources, { now: NOW });
  set.mastery = { [set.guide.terms[0].id]: { level: 2, seen: 2, right: 2, wrong: 0, streak: 2, lastAt: NOW } };
  const n = T.normalizeSet(clone(set));
  assert.equal(n.id, set.id);
  assert.equal(n.title, 'Sample: Cells and energy');
  assert.equal(n.examDate, '2026-11-02');
  assert.equal(n.sources[0].text, set.sources[0].text);
  assert.equal(n.guide.terms.length, set.guide.terms.length);
  eq(clone(n.guide.outline.map((o) => o.sectionId)), clone(set.guide.outline.map((o) => o.sectionId)));
  eq(clone(n.mastery), clone(set.mastery));
  assert.equal(T.guideStale(n), false);
  n.sources[0].text += '\nMore.';
  assert.equal(T.guideStale(n), true);

  assert.equal(T.normalizeSet(null), null);
  assert.equal(T.normalizeSet([1, 2]), null);
  assert.equal(T.normalizeSet('set'), null);
  const junk = T.normalizeSet({ id: 'bad id with spaces', title: 42, examDate: '2026-13-40', link: 'javascript:alert(1)', extra: 'x',
    sources: [{ name: 'a', kind: 'Virus', text: 'x'.repeat(T.LIMITS.sourceText + 50) }, 'not a source'],
    mastery: { t1: { level: 99, seen: -5 } }, tests: 'nope', cards: { c1: { state: 'review', due: 'soon' } } });
  assert.notEqual(junk.id, 'bad id with spaces');
  assert.equal(junk.title, '');
  assert.equal(junk.examDate, '');
  assert.equal(junk.link, '');
  assert.equal(junk.extra, undefined);
  assert.equal(junk.sources.length, 1);
  assert.equal(junk.sources[0].kind, 'Notes');
  assert.equal(junk.sources[0].text.length, T.LIMITS.sourceText);
  eq(clone(junk.mastery.t1), { level: T.MAX_LEVEL, seen: 0, right: 0, wrong: 0, streak: 0, lastAt: '' });
  eq(clone(junk.cards), {});
  assert.equal(T.normalizeSet({ link: 'https://example.com/notes' }).link, 'https://example.com/notes');
});

test('sets: "__proto__" and "constructor" keys never reach an object prototype', () => {
  const raw = JSON.parse('{"id":"set-1","title":"T","__proto__":{"polluted":"yes"},'
    + '"mastery":{"__proto__":{"level":3,"seen":3},"constructor":{"level":1,"seen":1},"t1":{"level":1,"seen":1}},'
    + '"cards":{"__proto__":{"state":"review","due":1}},"planDone":{"__proto__":true,"a:b":true},'
    + '"guide":{"terms":[{"id":"__proto__","term":"X","def":"Y y y"}],"removed":["__proto__","t2"]}}');
  const n = T.normalizeSet(raw);
  eq(Object.keys(n.mastery), ['t1']);
  eq(Object.keys(n.cards), []);
  eq(Object.keys(n.planDone), ['a:b']);
  assert.notEqual(n.guide.terms[0].id, '__proto__');
  eq(clone(n.guide.removed), ['t2']);
  assert.equal(({}).polluted, undefined);
  assert.equal(Object.getPrototypeOf(n.mastery), Object.getPrototypeOf(vm.runInContext('({})', sandbox)));
  assert.equal(n.polluted, undefined);
  const imp = T.parseImport(JSON.stringify({ format: 'flux-tutor-set', version: 2, set: raw }).replace('"title":"T",', '"title":"T","__proto__":{"polluted":"yes"},'));
  assert.equal(imp.error, '');
  assert.equal(imp.sets[0].polluted, undefined);
  assert.equal(({}).polluted, undefined);
});

/** The first beta's saved data, in the shape flux-teacher-app.js wrote under flux_teacher.beta.v1. */
function betaData() {
  const material = 'Natural selection changes populations.\n\nVariation exists in every population. Why do some survive?\n\n[slides.pdf]\nPage 1\nAllele frequency is how common an allele is in a population.\n\n[board.jpg]\nOrganisms with useful traits survive and reproduce more.';
  return {
    draft: { topic: 'Natural selection', subject: 'Biology', sourceTitle: 'Class notes', sourceUrl: 'https://example.com/unit4', material, question: 'How does the environment change allele frequency?', attachments: [{ name: 'slides.pdf', kind: 'PDF' }, { name: 'board.jpg', kind: 'Photo' }] },
    session: {
      topic: 'Natural selection', subject: 'Biology', sourceTitle: 'Class notes', sourceUrl: 'https://example.com/unit4', material,
      attachments: [{ name: 'slides.pdf', kind: 'PDF' }, { name: 'board.jpg', kind: 'Photo' }],
      question: 'How does the environment change allele frequency?',
      warmup: 'Something about survival of the fittest.',
      teachback: 'Populations change because useful traits get passed on more.',
      explain: { 0: 'Selection changes groups over time.', 2: 'Allele frequency = how common.' },
      answers: { 0: 'The environment favours some alleles.', 3: 'The slides example about moths.' },
      confidence: 'getting-there', step: 3, noteIndex: 2, questionIndex: 1, showSource: true, completedAt: '2026-09-30T18:00:00.000Z',
    },
  };
}

test('migrating the first beta (flux_teacher.beta.v1) keeps every word the student wrote', () => {
  const beta = betaData();
  const sets = T.migrateLegacy(clone(beta));
  assert.equal(sets.length, 1, 'the draft that matches the session is not a second set');
  const set = sets[0];
  assert.equal(set.title, 'Natural selection');
  assert.equal(set.subject, 'Biology');
  assert.equal(set.link, 'https://example.com/unit4');
  assert.equal(set.studiedAt, '2026-09-30T18:00:00.000Z');
  eq(set.sources.map((s) => [s.name, s.kind]), [['Class notes', 'Notes'], ['slides.pdf', 'PDF'], ['board.jpg', 'Photo']]);
  assert.equal(set.sources.map((s) => s.text).join('\n\n'), beta.session.material.replace(/\n?\[(slides\.pdf|board\.jpg)\]\n/g, '\n').trim().replace(/\n{3,}/g, '\n\n'));
  const written = set.legacy.notes.map((n) => n.text);
  for (const w of [beta.session.warmup, beta.session.teachback, beta.session.explain[0], beta.session.explain[2], beta.session.answers[0], beta.session.answers[3], beta.session.question]) {
    assert.ok(written.includes(w), 'lost: ' + w);
  }
  assert.ok(written.includes('I am getting there'));
  // Each answer is shown beside what it answered.
  const ex2 = set.legacy.notes.find((n) => n.text === beta.session.explain[2]);
  assert.match(ex2.prompt, /^\[slides\.pdf\]/);
  const ans0 = set.legacy.notes.find((n) => n.text === beta.session.answers[0]);
  assert.equal(ans0.prompt, 'How does the environment change allele frequency?');
  assert.equal(set.legacy.from, 'flux_teacher.beta.v1');
  // A different draft becomes its own set.
  beta.draft.topic = 'Genetic drift';
  beta.draft.material = 'Genetic drift is random change in allele frequency.';
  const two = T.migrateLegacy(beta);
  assert.equal(two.length, 2);
  assert.equal(two[1].title, 'Genetic drift');
  assert.equal(two[1].sources[0].text, 'Genetic drift is random change in allele frequency.');
  // An empty beta (a fresh draft, no session) has nothing to move.
  eq(clone(T.migrateLegacy({ draft: { topic: '', subject: '', sourceTitle: '', sourceUrl: '', material: '', question: '', attachments: [] }, session: null })), []);
  eq(clone(T.migrateLegacy(null)), []);
  eq(clone(T.migrateLegacy('junk')), []);
  // The migrated set builds a guide like any other.
  assert.ok(T.buildGuide(set.sources).terms.some((t) => t.term === 'Allele frequency'));
});

test('export and import: round trip, library backups, the beta\'s data, and plain refusals', () => {
  const set = T.sampleSet();
  set.guide = T.buildGuide(set.sources, { now: NOW });
  const one = T.parseImport(JSON.stringify(T.exportSet(set)));
  assert.equal(one.error, '');
  assert.equal(one.sets.length, 1);
  assert.equal(one.sets[0].title, set.title);
  assert.equal(one.sets[0].guide.terms.length, set.guide.terms.length);
  const lib = T.parseImport(JSON.stringify(T.exportLibrary([set, T.newSet({ title: 'Empty one' })])));
  assert.equal(lib.sets.length, 2);
  const deleted = T.normalizeSet(clone(set));
  deleted.deletedAt = NOW;
  assert.equal(T.parseImport(JSON.stringify(T.exportSet(deleted))).sets[0].deletedAt, '', 'an imported set is never in the bin');
  const beta = T.parseImport(JSON.stringify(betaData()));
  assert.equal(beta.error, '');
  assert.equal(beta.sets[0].title, 'Natural selection');

  const refuse = (text) => { const r = T.parseImport(text); assert.ok(r.error, 'should refuse: ' + String(text).slice(0, 60)); assert.equal(r.sets.length, 0); return r.error; };
  assert.match(refuse('not json at all'), /not a Flux Tutor export/);
  refuse('[1,2,3]');
  refuse('null');
  refuse(JSON.stringify({ format: 'something-else', sets: [] }));
  refuse(JSON.stringify({ format: 'flux-tutor-library', version: 2, sets: [null, 'x', 5] }));
  assert.match(refuse(JSON.stringify({ format: 'flux-tutor-set', version: 99, set: { title: 'From the future' } })), /newer version/);
  assert.match(refuse('x'.repeat(40 * 1024 * 1024 + 1)), /too big/);
  const mixed = T.parseImport(JSON.stringify({ format: 'flux-tutor-library', version: 2, sets: [{ title: 'Good' }, 'bad', {}] }));
  assert.equal(mixed.sets.length, 1);
  assert.equal(mixed.skipped, 2);
});

test('duplicate, markdown and the library card summary', () => {
  const set = T.sampleSet();
  set.guide = T.buildGuide(set.sources, { now: NOW });
  set.examDate = '2026-10-21';
  set.mastery = { [set.guide.terms[0].id]: { level: 3, seen: 3, right: 3, wrong: 0 } };
  const copy = T.cloneSet(set);
  assert.notEqual(copy.id, set.id);
  assert.equal(copy.title, 'Sample: Cells and energy (copy)');
  assert.equal(copy.guide.terms.length, set.guide.terms.length);
  assert.equal(T.cloneSet(set, 'Mine').title, 'Mine');
  const md = T.toMarkdown(set);
  assert.match(md, /^# Sample: Cells and energy/);
  assert.match(md, /## Key terms/);
  assert.match(md, /- \*\*Osmosis\*\*: The diffusion of water across a partially permeable membrane\. _\(Sample biology notes · paragraph \d+\)_/);
  const sum = T.summarizeSet(set, '2026-10-11');
  assert.equal(sum.terms, set.guide.terms.length);
  assert.equal(sum.mastered, 1);
  assert.equal(sum.daysLeft, 10);
  assert.equal(sum.sample, true);
  assert.ok(sum.words > 300);
  assert.equal(T.summarizeSet(T.newSet({ title: 'x' })).terms, 0);
});

/* ── Cards, and "Send to Flux Flashcards" ────────────────────────────── */

test('cards: Tutor\'s own spaced repetition uses the Flashcards scheduler, and a deck can be sent to Flux Flashcards', () => {
  // flux-flash-core.js in its own VM with a localStorage, as flashcards.html has.
  const store = new Map();
  const fsb = { window: {}, localStorage: { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) } };
  fsb.window.localStorage = fsb.localStorage;
  vm.createContext(fsb);
  vm.runInContext(readFileSync(new URL('../../public/js/flux-flash-core.js', import.meta.url), 'utf8'), fsb);
  const F = fsb.window.FluxFlash;

  const set = T.sampleSet();
  set.guide = T.buildGuide(set.sources, { now: NOW });
  set.examDate = '2026-10-21';
  const now = Date.parse(NOW);
  const list = T.cardList(set);
  assert.equal(list.length, set.guide.terms.length);
  assert.equal(T.cardQueue(set, now, 5).length, 5, 'new cards up to the limit');
  // Review the first card with the Flashcards scheduler and keep its state in the set.
  const card = { s: list[0].s };
  F.review(card, F.GOOD, now);
  set.cards[list[0].id] = card.s;
  const back = T.normalizeSet(clone(set));
  eq(clone(back.cards[list[0].id]), clone(card.s), 'the memory state survives saving');
  assert.equal(T.cardCounts(back, now).later, 1);
  assert.equal(T.cardQueue(back, now + 11 * 60000, 0)[0].id, list[0].id, 'due again after its step');

  // Send to Flux Flashcards.
  const first = T.flashDeckFrom(set, null);
  assert.equal(first.added, list.length);
  const deck = F.newDeck(first.deck);
  assert.ok(F.putDeck(deck));
  assert.equal(F.decks().length, 1);
  assert.equal(F.getDeck(deck.id).cards.length, list.length);
  assert.equal(F.getDeck(deck.id).examAt, new Date('2026-10-21T09:00:00').getTime());
  // Studied and changed in Flashcards, then sent again: progress, stars and extra cards stay.
  const saved = F.getDeck(deck.id);
  saved.title = 'My renamed deck';
  F.review(saved.cards[0], F.GOOD, now);
  saved.cards[0].star = true;
  saved.cards.push(F.newCard({ term: 'My own card', def: 'Added in Flashcards' }));
  F.putDeck(saved);
  set.guide.terms[0].def = 'An edited definition.';
  T.addTerm(set.guide, 'Turgor', 'Water pressure inside a plant cell.');
  const again = T.flashDeckFrom(set, F.getDeck(deck.id));
  eq([again.added, again.updated], [1, 1]);
  F.putDeck(again.deck);
  const final = F.getDeck(deck.id);
  assert.equal(final.title, 'My renamed deck');
  assert.equal(final.cards[0].def, 'An edited definition.');
  assert.equal(final.cards[0].star, true);
  assert.ok(final.cards[0].s && final.cards[0].s.state);
  assert.ok(final.cards.some((c) => c.term === 'My own card'));
  assert.ok(final.cards.some((c) => c.term === 'Turgor'));
  assert.equal(F.decks().length, 1);
});

/* ── Speed ───────────────────────────────────────────────────────────── */

function syntheticNotes(pages) {
  const topics = ['Cells', 'Energy', 'Genetics', 'Ecology', 'Evolution', 'Plants', 'Animals', 'Chemistry', 'Physics', 'History'];
  const words = 'river mountain signal pattern current balance pressure layer surface membrane carbon nitrogen protein crystal velocity momentum charge field orbit empire treaty colony market labour capital'.split(' ');
  const out = [];
  let n = 0;
  for (let p = 1; p <= pages; p++) {
    out.push('Page ' + p, '## ' + topics[p % topics.length] + ' part ' + p);
    for (let para = 0; para < 6; para++) {
      const lines = [];
      for (let k = 0; k < 5; k++) {
        n++;
        const a = words[n % words.length];
        const b = words[(n * 7) % words.length];
        const c = words[(n * 13) % words.length];
        if (k === 0) lines.push('Term' + n + ' ' + a + ' is the ' + b + ' of the ' + c + ' that changes the ' + a + ' system over time.');
        else if (k === 2) lines.push('In ' + (1800 + (n % 200)) + ', the ' + a + ' grew by ' + (n % 90) + ' percent because the ' + b + ' increased.');
        else lines.push('The ' + a + ' and the ' + b + ' depend on the ' + c + ' in many ways, and students often compare them with the ' + words[(n * 3) % words.length] + '.');
      }
      out.push(lines.join(' '), '');
    }
  }
  return out.join('\n');
}

test('speed: a 20-page set builds its guide and search index in well under a second', () => {
  const text = syntheticNotes(20);
  assert.ok(text.split(/\s+/).length > 10000, 'about 20 pages of notes');
  const sources = [{ id: 'big', name: 'Big notes.pdf', kind: 'PDF', text }];
  T.buildGuide([{ text: 'Warm up is a short run of the code before timing it.' }]);
  const t0 = performance.now();
  const corpus = T.buildCorpus(sources);
  const guide = T.buildGuide(sources, { corpus });
  const idx = T.buildSearchIndex(corpus);
  const ms = performance.now() - t0;
  assert.ok(guide.terms.length >= 50, 'terms: ' + guide.terms.length);
  assert.ok(idx.N >= 100);
  assert.ok(ms < 300, 'buildGuide + buildSearchIndex took ' + Math.round(ms) + ' ms');
  const t1 = performance.now();
  const concepts = T.conceptsFromGuide(corpus, guide);
  T.buildPracticeTest(corpus, concepts, {}, { count: 30, seed: 'speed' });
  T.searchNotes(corpus, idx, 'why did the pressure increase in 1850');
  assert.ok(performance.now() - t1 < 300, 'concepts + a 30-question test + a search took ' + Math.round(performance.now() - t1) + ' ms');
});
