import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

/**
 * flux-flash-core.js: the scheduler, answer checking, import parsing, tests
 * and share links behind Flux Flashcards.
 */
const store = new Map();
const localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};
const sandbox = { window: { localStorage }, TextEncoder, TextDecoder, btoa, atob, Math, Date, JSON };
vm.createContext(sandbox);
vm.runInContext(readFileSync(new URL('../../public/js/flux-flash-core.js', import.meta.url), 'utf8'), sandbox);
const F = sandbox.window.FluxFlash;
const DAY = F.DAY, MIN = F.MIN;
const T0 = Date.UTC(2026, 9, 4, 12);
/** Arrays made inside the VM belong to another realm; compare their contents. */
const plain = (x) => JSON.parse(JSON.stringify(x));

test('a new card steps through minutes before it is given days', () => {
  const p = F.preview({ id: 'a' }, T0);
  assert.equal(p[F.AGAIN].due - T0, 1 * MIN);
  assert.equal(p[F.HARD].due - T0, 5 * MIN);
  assert.equal(p[F.GOOD].due - T0, 10 * MIN);
  assert.equal(p[F.EASY].state, 'review');
  assert.ok(p[F.EASY].ivl >= 10 && p[F.EASY].ivl <= 16, 'Easy on a new card is about two weeks with FSRS-4.5 defaults');

  const c = { id: 'a' };
  F.review(c, F.GOOD, T0);
  assert.equal(c.s.state, 'learning');
  F.review(c, F.GOOD, T0 + 10 * MIN);
  assert.equal(c.s.state, 'review');
  assert.equal(c.s.ivl, 4, 'Good, Good graduates to the FSRS-4.5 Good stability, about 4 days');
});

test('intervals grow with each success and shrink after a lapse', () => {
  const c = { id: 'b' };
  let t = T0;
  F.review(c, F.GOOD, t); t += 10 * MIN;
  F.review(c, F.GOOD, t);
  const ivls = [c.s.ivl];
  for (let i = 0; i < 4; i++) {
    t = c.s.due;
    F.review(c, F.GOOD, t);
    ivls.push(c.s.ivl);
  }
  for (let i = 1; i < ivls.length; i++) assert.ok(ivls[i] > ivls[i - 1], 'growing: ' + ivls.join(', '));
  const before = c.s.S;
  t = c.s.due;
  F.review(c, F.AGAIN, t);
  assert.equal(c.s.state, 'relearning');
  assert.equal(c.s.lapses, 1);
  assert.ok(c.s.S < before);
  assert.equal(c.s.due - t, 10 * MIN);
});

test('the four buttons are always in order, and an exam date caps them', () => {
  const c = { id: 'c', s: { state: 'review', S: 30, D: 5, last: T0 - 30 * DAY, due: T0, reps: 5, lapses: 0 } };
  const p = F.preview(c, T0);
  assert.ok(p[F.HARD].ivl < p[F.GOOD].ivl && p[F.GOOD].ivl < p[F.EASY].ivl);
  const capped = F.preview(c, T0, { examAt: T0 + 7 * DAY });
  [F.HARD, F.GOOD, F.EASY].forEach((g) => assert.ok(capped[g].ivl <= 7, 'never scheduled past the exam'));
  const strict = F.preview(c, T0, { retention: 0.95 });
  assert.ok(strict[F.GOOD].ivl < p[F.GOOD].ivl, 'a higher target means sooner reviews');
});

test('wait labels read like a person would say them', () => {
  assert.equal(F.fmtWait(1 * MIN), '1m');
  assert.equal(F.fmtWait(10 * MIN), '10m');
  assert.equal(F.fmtWait(3 * DAY), '3d');
  assert.equal(F.fmtWait(60 * DAY), '2mo');
});

test('the queue puts overdue cards first, then a limited number of new ones', () => {
  const deck = { cards: [
    { id: 'n1' }, { id: 'n2' }, { id: 'n3' },
    { id: 'd1', s: { state: 'review', due: T0 - DAY, S: 3, D: 5 } },
    { id: 'd2', s: { state: 'review', due: T0 - 3 * DAY, S: 3, D: 5 } },
    { id: 'later', s: { state: 'review', due: T0 + DAY, S: 3, D: 5 } },
  ] };
  assert.deepEqual(Array.from(F.queue(deck, T0, 2), (c) => c.id), ['d2', 'd1', 'n1', 'n2']);
  assert.equal(F.dueCount(deck, T0), 2);
});

test('answers are checked the way a teacher would mark them', () => {
  assert.equal(F.check('Mitochondria', 'mitochondria').verdict, 'correct');
  assert.equal(F.check('the powerhouse of the cell', 'Powerhouse of the cell!').verdict, 'correct');
  assert.equal(F.check('to run', 'run').verdict, 'correct');
  assert.equal(F.check('el perro', 'perro').verdict, 'correct');
  assert.equal(F.check('mitocondria', 'mitochondria').verdict, 'typo');
  assert.equal(F.check('cafe', 'café').verdict, 'accent');
  assert.ok(F.check('cafe', 'café').ok);
  assert.equal(F.check('big', 'large / big').verdict, 'correct');
  assert.equal(F.check('huge', 'big or large').verdict, 'wrong');
  assert.equal(F.check('cat', 'dog').verdict, 'wrong');
  assert.equal(F.check('', 'dog').verdict, 'wrong');
  assert.equal(F.check('car', 'cat').verdict, 'wrong', 'short words get no typo allowance');
  assert.equal(F.check('photosynthesis', 'Photosynthesis (in plants)').verdict, 'correct', 'brackets are optional');
});

test('imports what students actually paste', () => {
  const quizlet = 'perro\tdog\ngato\tcat\ncasa\thouse';
  assert.deepEqual(plain(F.parseImport(quizlet).map((c) => [c.term, c.def])), [['perro', 'dog'], ['gato', 'cat'], ['casa', 'house']]);

  const dashes = '- Mitochondria - makes ATP\n- Ribosome – makes proteins\n- Nucleus — holds DNA';
  assert.deepEqual(plain(F.parseImport(dashes).map((c) => c.term)), ['Mitochondria', 'Ribosome', 'Nucleus']);

  const colons = 'Define: give the precise meaning\nExplain: give a detailed account including reasons';
  assert.equal(F.parseImport(colons)[1].def, 'give a detailed account including reasons');

  const csv = 'term,definition\n"H2O","water, the compound"\nNaCl,salt';
  const rows = F.parseImport(csv);
  assert.equal(rows[1].def, 'water, the compound');

  const alternating = 'Paris\nFrance\nRome\nItaly';
  assert.deepEqual(plain(F.parseImport(alternating).map((c) => c.def)), ['France', 'Italy']);

  const custom = F.parseImport('a=1;b=2;c=3', { between: 'equals', cards: 'semicolon' });
  assert.equal(custom.length, 3);
  assert.equal(F.parseImport('').length, 0);
});

test('a practice test mixes question types and marks itself', () => {
  const cards = 'abcdef'.split('').map((x, i) => ({ id: x, term: 'term ' + x, def: 'definition ' + i }));
  let seed = 1;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const qs = F.buildTest(cards, { count: 6, random: rnd });
  assert.equal(qs.length, 6);
  assert.deepEqual(plain([...new Set(qs.map((q) => q.type))].sort()), ['mc', 'tf', 'written']);
  qs.filter((q) => q.type === 'mc').forEach((q) => {
    assert.equal(q.options.length, 4);
    assert.ok(q.options.includes(q.answer));
    assert.equal(new Set(q.options).size, 4);
  });
  const perfect = qs.map((q) => (q.type === 'tf' ? q.truth : q.answer));
  assert.equal(F.gradeTest(qs, perfect).pct, 100);
  assert.equal(F.gradeTest(qs, qs.map(() => null)).right, 0);
});

test('match tiles come in pairs', () => {
  const cards = 'abcdefgh'.split('').map((x) => ({ id: x, term: x, def: x.toUpperCase() }));
  const tiles = F.matchTiles(cards, 6);
  assert.equal(tiles.length, 12);
  const keys = {};
  tiles.forEach((t) => { keys[t.key] = (keys[t.key] || 0) + 1; });
  Object.values(keys).forEach((n) => assert.equal(n, 2));
});

test('a share link carries the cards and nothing private', () => {
  const deck = F.newDeck({ title: 'Español — días', termLang: 'es-ES', cards: [{ term: 'lunes', def: 'Monday' }, { term: 'martes', def: 'Tuesday' }] });
  deck.cards[0].s = { state: 'review', S: 10 };
  const code = F.encodeShare(deck);
  assert.match(code, /^j[A-Za-z0-9_-]+$/);
  const back = F.decodeShare(code);
  assert.equal(back.title, 'Español — días');
  assert.equal(back.termLang, 'es-ES');
  assert.deepEqual(plain(back.cards.map((c) => c.term)), ['lunes', 'martes']);
  assert.equal(back.cards[0].s, undefined, 'progress stays with its owner');
  assert.notEqual(back.id, deck.id);
});

test('decks sync deck by deck, newest wins, and deletions travel', () => {
  store.clear();
  const a = F.newDeck({ id: 'A', title: 'old title' }); a.updated = 100;
  const b = F.newDeck({ id: 'B', title: 'only here' }); b.updated = 200;
  F.writeStore({ v: 1, decks: [a, b] });
  const remoteA = { ...a, title: 'new title', updated: 300 };
  const remoteC = { id: 'C', deleted: true, updated: 50 };
  const needsPush = F.applyFromCloud({ decks: [remoteA, remoteC], stats: { days: { '2026-10-01': 5 } } });
  assert.equal(needsPush, true, 'B exists only on this device');
  assert.equal(F.getDeck('A').title, 'new title');
  assert.equal(F.getDeck('B').title, 'only here');
  assert.equal(F.getDeck('C'), null);
  assert.equal(F.readStats().days['2026-10-01'], 5);
  assert.equal(F.applyFromCloud(F.getCloudSlice()), false, 'nothing newer the second time');

  F.removeDeck('B');
  assert.equal(F.getDeck('B'), null);
  assert.ok(F.readStore().decks.some((d) => d.id === 'B' && d.deleted), 'kept as a tombstone');
});

test('the streak counts consecutive study days', () => {
  const day = (offset) => F.ymd(T0 - offset * DAY);
  assert.equal(F.streak({ days: { [day(0)]: 3, [day(1)]: 1, [day(2)]: 9, [day(4)]: 1 } }, T0), 3);
  assert.equal(F.streak({ days: { [day(1)]: 1, [day(2)]: 1 } }, T0), 2, 'not yet today is not a break');
  assert.equal(F.streak({ days: {} }, T0), 0);
});

test('a re-shared copy keeps its creator, and its changes merge back', () => {
  const mine = F.newDeck({ title: 'Verbs', author: 'Ms Rivera', cards: [{ term: 'hablar', def: 'to speak' }, { term: 'comer', def: 'to eat' }] });
  mine.cards[0].s = { state: 'review', S: 12 };
  // A student opens the teacher's link, edits their copy, and shares it on.
  const copy = F.decodeShare(F.encodeShare(mine, 'Ms Rivera'));
  assert.equal(F.creator(copy), 'Ms Rivera');
  copy.cards.push(F.newCard({ term: 'vivir', def: 'to live' }));
  copy.cards[1].def = 'to eat (a meal)';
  const back = F.decodeShare(F.encodeShare(copy, 'Sam'));
  assert.equal(F.creator(back), 'Ms Rivera', 'still the original creator');
  assert.equal(back.sharedBy, 'Sam');
  assert.equal(F.relatedDeck(back, [mine]), mine, 'recognised as a version of my deck');

  const dif = F.diffDecks(mine, back);
  assert.equal(dif.added.length, 1);
  assert.equal(dif.changed.length, 1);
  const res = F.mergeInto(mine, back, { takeChanges: true });
  assert.deepEqual(plain(res), { added: 1, changed: 1 });
  assert.equal(mine.cards.length, 3);
  assert.equal(mine.cards[1].def, 'to eat (a meal)');
  assert.equal(mine.cards[0].s.S, 12, 'progress kept');
  assert.equal(F.relatedDeck(F.newDeck({ title: 'x' }), [mine]), null);
});
