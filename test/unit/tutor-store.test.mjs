import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

/**
 * flux-tutor-store.js — the library of study sets. Node has no IndexedDB, so
 * these tests cover the localStorage fallback, the in-memory last resort,
 * plain errors, the first beta's migration, import and autosave.
 * (e2e/tutor-store.spec.ts runs the IndexedDB path in Chromium.)
 */
const coreSrc = readFileSync(new URL('../../public/js/flux-tutor-core.js', import.meta.url), 'utf8');
const storeSrc = readFileSync(new URL('../../public/js/flux-tutor-store.js', import.meta.url), 'utf8');
const sandbox = { window: {}, URL, setTimeout, clearTimeout };
vm.createContext(sandbox);
vm.runInContext(coreSrc, sandbox);
vm.runInContext(storeSrc, sandbox);
const T = sandbox.window.FluxTutor;
const Store = sandbox.window.FluxTutorStore;
const clone = (x) => (x === undefined ? undefined : JSON.parse(JSON.stringify(x)));
const eq = (a, b, msg) => assert.deepEqual(clone(a), clone(b), msg);

/** A localStorage with a size limit (characters of keys + values), like a browser's. */
function fakeLS(limit = Infinity, opts = {}) {
  const m = new Map();
  const writes = [];
  return {
    get length() { return m.size; },
    key: (i) => Array.from(m.keys())[i] ?? null,
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem(k, v) {
      if (opts.blocked) { const e = new Error('The operation is insecure.'); e.name = 'SecurityError'; throw e; }
      const s = String(v);
      let used = 0;
      m.forEach((vv, kk) => { if (kk !== k) used += kk.length + vv.length; });
      if (used + k.length + s.length > limit) { const e = new Error('Setting the value exceeded the quota.'); e.name = 'QuotaExceededError'; e.code = 22; throw e; }
      writes.push(k);
      m.set(k, s);
    },
    removeItem: (k) => { m.delete(k); },
    map: m,
    writes,
  };
}
const openLS = (ls, extra) => Store.open({ localStorage: ls, indexedDB: null, BroadcastChannel: null, ...extra });
function sampleWithGuide() {
  const set = T.sampleSet();
  set.guide = T.buildGuide(set.sources);
  return set;
}

test('localStorage fallback: save, list, open, rename, duplicate', async () => {
  const ls = fakeLS();
  ls.setItem('flux_tasks', '[{"id":1}]');
  const store = await openLS(ls);
  assert.equal(store.backend, 'localstorage');
  assert.equal(store.persistent, true);
  assert.equal(store.warning, '');
  const set = sampleWithGuide();
  const res = await store.save(set);
  assert.equal(res.ok, true);
  assert.equal(res.meta.title, 'Sample: Cells and energy');
  assert.equal(res.meta.terms, set.guide.terms.length);
  assert.ok(res.set.updatedAt >= set.updatedAt);
  const back = await store.get(set.id);
  assert.equal(back.sources[0].text, set.sources[0].text);
  eq(back.guide.terms.map((t) => t.term), set.guide.terms.map((t) => t.term));
  assert.equal(await store.get('nope'), null);

  const ren = await store.rename(set.id, '  Biology   unit 2 ');
  assert.equal(ren.ok, true);
  assert.equal((await store.get(set.id)).title, 'Biology unit 2');
  const blank = await store.rename(set.id, '   ');
  assert.equal(blank.ok, false);
  assert.equal(blank.error.code, 'title');
  assert.equal((await store.rename('missing-id', 'x')).error.code, 'missing');

  const dup = await store.duplicate(set.id);
  assert.equal(dup.ok, true);
  assert.notEqual(dup.set.id, set.id);
  assert.equal(dup.set.title, 'Biology unit 2 (copy)');
  const l = await store.list();
  assert.equal(l.ok, true);
  eq(l.sets.map((m) => m.title).sort(), ['Biology unit 2', 'Biology unit 2 (copy)']);
  assert.equal(ls.getItem('flux_tasks'), '[{"id":1}]', 'the planner\'s data is not touched');
  // A second "tab" on the same storage sees the same library.
  const other = await openLS(ls);
  assert.equal((await other.list()).sets.length, 2);
});

test('delete with undo, the bin, and emptying it after 30 days', async () => {
  const store = await openLS(fakeLS());
  const a = (await store.save(T.newSet({ title: 'A' }))).set;
  const b = (await store.save(T.newSet({ title: 'B' }))).set;
  const del = await store.remove(a.id);
  assert.equal(del.ok, true);
  eq((await store.list()).sets.map((m) => m.title), ['B']);
  eq((await store.list({ deleted: true })).sets.map((m) => m.title), ['A']);
  assert.equal((await store.restore(a.id)).ok, true);
  eq((await store.list()).sets.map((m) => m.title).sort(), ['A', 'B']);
  await store.remove(b.id);
  assert.equal((await store.purgeDeleted(30, Date.now() + 29 * 86400000)).purged, 0, 'still in the bin after 29 days');
  assert.equal((await store.purgeDeleted(30, Date.now() + 31 * 86400000)).purged, 1);
  assert.equal(await store.get(b.id), null);
  assert.equal((await store.purge(a.id)).ok, true);
  assert.equal((await store.list()).sets.length, 0);
});

test('a full browser storage is reported in plain words and the saved copy stays as it was', async () => {
  const ls = fakeLS(60000);
  const store = await openLS(ls);
  const set = T.newSet({ title: 'Small' });
  set.sources = [T.newSource('Notes', 'Notes', 'Cells are small. '.repeat(100))];
  assert.equal((await store.save(set)).ok, true);
  set.sources[0].text = 'Cells are small. '.repeat(5000);
  const res = await store.save(set);
  assert.equal(res.ok, false);
  assert.equal(res.error.code, 'quota');
  assert.match(res.error.message, /no room left/);
  assert.equal((await store.get(set.id)).sources[0].text.length, 'Cells are small. '.repeat(100).length, 'the last good save is intact');
  assert.equal(Store.classify({ name: 'QuotaExceededError' }), 'quota');
  assert.equal(Store.classify({ name: 'NS_ERROR_DOM_QUOTA_REACHED' }), 'quota');
  assert.equal(Store.classify({ name: 'SecurityError' }), 'blocked');
  assert.equal(Store.classify(new Error('boom')), 'write');
});

test('localStorage fallback keeps to its budget so the planner always has room', async () => {
  const ls = fakeLS();
  const store = await openLS(ls, { lsBudget: 20000 });
  const set = T.newSet({ title: 'Big' });
  set.sources = [T.newSource('Notes', 'Notes', 'x'.repeat(30000))];
  const res = await store.save(set);
  assert.equal(res.ok, false);
  assert.equal(res.error.code, 'quota');
  assert.match(res.error.message, /backup storage/);
  assert.equal(ls.getItem(Store.LS_SET + set.id), null);
});

test('no storage at all: the library runs in memory for this tab and says so', async () => {
  const store = await openLS(fakeLS(Infinity, { blocked: true }));
  assert.equal(store.backend, 'memory');
  assert.equal(store.persistent, false);
  assert.match(store.warning, /gone when you close this tab/);
  const set = T.newSet({ title: 'Kept for now' });
  assert.equal((await store.save(set)).ok, true);
  assert.equal((await store.get(set.id)).title, 'Kept for now');
  const none = await Store.open({ localStorage: null, indexedDB: null, BroadcastChannel: null });
  assert.equal(none.backend, 'memory');
});

/** What the first beta (flux-teacher-app.js) saved under flux_teacher.beta.v1. */
const BETA = {
  draft: { topic: 'Natural selection', subject: 'Biology', sourceTitle: 'Class notes', sourceUrl: '', material: 'Allele frequency is how common an allele is in a population.', question: '', attachments: [] },
  session: {
    topic: 'Natural selection', subject: 'Biology', sourceTitle: 'Class notes', sourceUrl: '', material: 'Allele frequency is how common an allele is in a population.',
    attachments: [], question: '', warmup: 'Survival of the fittest?', teachback: 'Useful traits spread.', explain: { 0: 'How common an allele is.' }, answers: {},
    confidence: 'teach-it', step: 3, noteIndex: 0, questionIndex: 0, showSource: false, completedAt: '',
  },
};

test('the first beta\'s session moves into the library, and the old key goes only after the copy is saved', async () => {
  const ls = fakeLS();
  ls.setItem(Store.LEGACY_KEY, JSON.stringify(BETA));
  const store = await openLS(ls);
  const res = await store.migrateLegacy();
  assert.equal(res.ok, true);
  assert.equal(res.migrated, 1);
  const set = await store.get(res.ids[0]);
  assert.equal(set.title, 'Natural selection');
  assert.ok(set.legacy.notes.some((n) => n.text === 'Useful traits spread.'));
  assert.ok(set.legacy.notes.some((n) => n.text === 'How common an allele is.'));
  assert.equal(ls.getItem(Store.LEGACY_KEY), null, 'old key removed after the copy was read back');
  assert.ok(JSON.parse(ls.getItem(Store.MIGRATED_KEY)).ids.includes(set.id));
  assert.equal((await store.migrateLegacy()).migrated, 0, 'once only');
  assert.equal((await store.list()).sets.length, 1);

  // The old beta tab, still open, writes the same data back; the set was deleted since. It stays deleted.
  await store.remove(set.id);
  ls.setItem(Store.LEGACY_KEY, JSON.stringify(BETA));
  const again = await store.migrateLegacy();
  assert.equal(again.migrated, 0);
  assert.equal((await store.list()).sets.length, 0);
  assert.equal(ls.getItem(Store.LEGACY_KEY), null);
});

test('migration: two tabs at once make one set; a failed save keeps the old key; memory mode keeps it too', async () => {
  const ls = fakeLS();
  ls.setItem(Store.LEGACY_KEY, JSON.stringify(BETA));
  const [a, b] = [await openLS(ls), await openLS(ls)];
  await Promise.all([a.migrateLegacy(), b.migrateLegacy()]);
  assert.equal((await a.list()).sets.length, 1);

  const full = fakeLS();
  full.setItem(Store.LEGACY_KEY, JSON.stringify(BETA));
  const tight = await openLS(full, { lsBudget: 50 });
  const failed = await tight.migrateLegacy();
  assert.equal(failed.ok, false);
  assert.equal(failed.error.code, 'quota');
  assert.ok(full.getItem(Store.LEGACY_KEY), 'nothing saved, so the beta data stays where it was');

  const mem = fakeLS();
  mem.setItem(Store.LEGACY_KEY, JSON.stringify(BETA));
  const memStore = await openLS(mem, { backend: 'memory' });
  assert.equal((await memStore.migrateLegacy()).migrated, 1);
  assert.ok(mem.getItem(Store.LEGACY_KEY), 'a copy that only lives in this tab is not a reason to delete the original');

  const broken = fakeLS();
  broken.setItem(Store.LEGACY_KEY, '{not json');
  const r = await (await openLS(broken)).migrateLegacy();
  assert.equal(r.ok, false);
  assert.match(r.error.message, /left where it is/);
  assert.equal(broken.getItem(Store.LEGACY_KEY), '{not json');
  assert.equal((await (await openLS(fakeLS())).migrateLegacy()).migrated, 0, 'nothing to move');
});

test('export and import: a set and a whole library; nothing on the device is overwritten; bad files refused plainly', async () => {
  const a = await openLS(fakeLS());
  const set = sampleWithGuide();
  await a.save(set);
  await a.save(T.newSet({ title: 'Second' }));
  const one = await a.exportSet(set.id);
  assert.equal(one.ok, true);
  assert.equal(one.filename, 'sample-cells-and-energy.flux-tutor.json');
  const all = await a.exportAll();
  assert.equal(all.count, 2);
  assert.equal(JSON.parse(all.text).format, 'flux-tutor-library');

  const b = await openLS(fakeLS());
  const imp = await b.importText(all.text);
  assert.equal(imp.ok, true);
  assert.equal(imp.sets.length, 2);
  assert.ok(await b.get(set.id), 'a set new to this device keeps its id');
  const twice = await b.importText(one.text);
  assert.equal(twice.ok, true);
  assert.notEqual(twice.sets[0].id, set.id, 'the same set again comes in as a copy');
  assert.equal((await b.list()).sets.length, 3);

  const bad = await b.importText('{"hello": "world"}');
  assert.equal(bad.ok, false);
  assert.equal(bad.error.code, 'invalid');
  assert.match(bad.error.message, /not a Flux Tutor export/);
  const evil = await b.importText('{"format":"flux-tutor-set","version":2,"set":{"title":"Evil","__proto__":{"polluted":1},"mastery":{"__proto__":{"level":3}}}}');
  assert.equal(evil.ok, true);
  assert.equal(({}).polluted, undefined);
  assert.equal((await b.get(evil.sets[0].id)).polluted, undefined);
  const beta = await b.importText(JSON.stringify(BETA));
  assert.equal(beta.ok, true);
  assert.equal(beta.sets[0].title, 'Natural selection');
  assert.equal((await a.exportSet('missing')).error.code, 'missing');
});

test('autosave: quick edits make one write, with pending → saving → saved; actions wait for it', async () => {
  const ls = fakeLS();
  const store = await openLS(ls, { autosaveDelay: 15 });
  const set = T.newSet({ title: 'Draft' });
  const states = [];
  store.onStatus((s) => states.push(s.state));
  const key = Store.LS_SET + set.id;
  const before = ls.writes.filter((k) => k === key).length;
  set.title = 'Draft 1'; const p1 = store.autosave(set);
  set.title = 'Draft 2'; const p2 = store.autosave(set);
  set.title = 'Draft 3'; const p3 = store.autosave(set);
  assert.equal(store.hasPending(), true);
  const [r1, r2, r3] = await Promise.all([p1, p2, p3]);
  assert.ok(r1.ok && r2.ok && r3.ok);
  assert.equal(ls.writes.filter((k) => k === key).length - before, 1, 'one write for three quick edits');
  assert.equal((await store.get(set.id)).title, 'Draft 3');
  eq(states, ['pending', 'pending', 'pending', 'saving', 'saved']);
  // flush() saves straight away.
  set.title = 'Now';
  const p = store.autosave(set);
  await store.flush();
  assert.equal((await store.get(set.id)).title, 'Now');
  assert.equal((await p).ok, true);
  // A rename from the library waits for the pending autosave, so it is not undone by it.
  set.subject = 'Biology';
  store.autosave(set);
  await store.rename(set.id, 'Renamed');
  await new Promise((r) => setTimeout(r, 30));
  const final = await store.get(set.id);
  assert.equal(final.title, 'Renamed');
  assert.equal(final.subject, 'Biology');
  // A failed autosave reports an error state.
  const tight = await openLS(fakeLS(), { autosaveDelay: 1, lsBudget: 10 });
  const errs = [];
  tight.onStatus((s) => { if (s.state === 'error') errs.push(s.error.code); });
  const bad = await tight.autosave(T.newSet({ title: 'Too big for 10 characters' }));
  assert.equal(bad.ok, false);
  eq(errs, ['quota']);
});

test('save refuses things that are not sets, and keeps only known fields', async () => {
  const store = await openLS(fakeLS());
  assert.equal((await store.save(null)).error.code, 'invalid');
  assert.equal((await store.save('set')).error.code, 'invalid');
  const set = T.newSet({ title: 'Clean' });
  set.secret = 'dropped';
  const res = await store.save(set);
  assert.equal(res.ok, true);
  assert.equal((await store.get(set.id)).secret, undefined);
  const kept = await store.save(Object.assign(T.newSet({ title: 'Untouched time' }), { updatedAt: '2026-01-01T00:00:00.000Z' }), { touch: false });
  assert.equal(kept.set.updatedAt, '2026-01-01T00:00:00.000Z');
});
