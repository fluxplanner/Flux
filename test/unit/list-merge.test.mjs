import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

/**
 * flux-list-merge.js — how a cloud pull and local edits meet, item by item.
 * The bug it replaces: the pull assigned the whole cloud list over the local
 * one, so a tick made while the pull was in flight was undone.
 */
const sandbox = { window: {} };
vm.createContext(sandbox);
vm.runInContext(readFileSync(new URL('../../public/js/flux-list-merge.js', import.meta.url), 'utf8'), sandbox);
const M = sandbox.window.FluxListMerge;
const plain = (v) => JSON.parse(JSON.stringify(v));
const T = (id, extra = {}) => ({ id, name: 'Task ' + id, done: false, ...extra });

test('a tick made before the pull landed survives it', () => {
  const agreed = [T(1), T(2), T(3)];
  const base = M.hashes(agreed);
  const local = plain(agreed); local[1].done = true; local[1].updatedAt = 2000;
  const cloud = plain(agreed); // the row as it was when the pull left
  const r = M.merge(local, cloud, { base });
  assert.equal(r.list.find((t) => t.id === 2).done, true);
  assert.equal(r.differsFromCloud, true, 'the tick has to be pushed back up');
});

test('a change made on another device still arrives', () => {
  const agreed = [T(1), T(2)];
  const base = M.hashes(agreed);
  const cloud = plain(agreed); cloud[0].name = 'Renamed on my phone'; cloud[0].updatedAt = 3000;
  const r = M.merge(plain(agreed), cloud, { base });
  assert.equal(r.list.find((t) => t.id === 1).name, 'Renamed on my phone');
  assert.equal(r.differsFromCloud, false);
});

test('both sides changed the same task: the newer edit wins', () => {
  const agreed = [T(1)];
  const base = M.hashes(agreed);
  const local = [T(1, { name: 'Local', updatedAt: 5000 })];
  const cloud = [T(1, { name: 'Cloud', updatedAt: 4000 })];
  assert.equal(M.merge(local, cloud, { base }).list[0].name, 'Local');
  const cloudNewer = [T(1, { name: 'Cloud', updatedAt: 6000 })];
  assert.equal(M.merge(local, cloudNewer, { base }).list[0].name, 'Cloud');
});

test('an older copy pushed by a device that had not refreshed does not undo a newer edit', () => {
  const mine = [T(1, { done: true, updatedAt: 9000 })];
  const base = M.hashes(mine);                         // we pushed this
  const stale = [T(1, { done: false, updatedAt: 1000 })]; // someone pushed their old copy over it
  const r = M.merge(plain(mine), stale, { base });
  assert.equal(r.list[0].done, true);
  assert.equal(r.differsFromCloud, true);
});

test('a task added here and not yet pushed is kept', () => {
  const agreed = [T(1)];
  const r = M.merge([T(99, { createdAt: 5000 }), T(1)], plain(agreed), { base: M.hashes(agreed) });
  assert.deepEqual(plain(r.list.map((t) => t.id)), [99, 1]);
});

test('a task added on another device lands at the top', () => {
  const agreed = [T(1)];
  const r = M.merge(plain(agreed), [T(7), T(1)], { base: M.hashes(agreed) });
  assert.deepEqual(plain(r.list.map((t) => t.id)), [7, 1]);
});

test('a deletion made here is not brought back by the pull', () => {
  const agreed = [T(1), T(2)];
  const r = M.merge([T(1)], plain(agreed), { base: M.hashes(agreed), localTomb: { 2: 5000 } });
  assert.deepEqual(plain(r.list.map((t) => t.id)), [1]);
  assert.equal(r.differsFromCloud, true);
});

test('a deletion made on another device removes the task here', () => {
  const agreed = [T(1), T(2)];
  const r = M.merge(plain(agreed), [T(1)], { base: M.hashes(agreed), cloudTomb: { 2: 5000 } });
  assert.deepEqual(plain(r.list.map((t) => t.id)), [1]);
});

test('a task missing from the row without a tombstone is kept: that is a stale push, not a delete', () => {
  const agreed = [T(1), T(2)];
  const r = M.merge(plain(agreed), [T(1)], { base: M.hashes(agreed) });
  assert.deepEqual(plain(r.list.map((t) => t.id)), [1, 2]);
  assert.equal(r.differsFromCloud, true);
});

test('an edit made after another device deleted the task keeps it', () => {
  const agreed = [T(1)];
  const r = M.merge([T(1, { name: 'Still need this', updatedAt: 8000 })], [], { base: M.hashes(agreed), cloudTomb: { 1: 5000 } });
  assert.equal(r.list.length, 1);
});

test('no base yet (first sync on this device): cloud wins unless the local copy is newer', () => {
  const cloud = [T(1, { name: 'Cloud' }), T(2, { name: 'Cloud 2', updatedAt: 100 })];
  const local = [T(1, { name: 'Old local' }), T(2, { name: 'Edited just now', updatedAt: 900 }), T(3, { createdAt: 50 }), T(4, { createdAt: 5000 })];
  const r = M.merge(local, cloud, { base: null, lastSyncAt: 1000 });
  const byId = Object.fromEntries(r.list.map((t) => [t.id, t]));
  assert.equal(byId[1].name, 'Cloud');
  assert.equal(byId[2].name, 'Edited just now');
  assert.equal(byId[3], undefined, 'an old local-only task from before the last sync is a remote delete');
  assert.ok(byId[4], 'a task created since the last sync is kept');
});

test('identical lists merge to themselves', () => {
  const list = [T(1), T(2, { done: true })];
  const r = M.merge(plain(list), plain(list), { base: M.hashes(list) });
  assert.equal(r.differsFromCloud, false);
  assert.equal(r.differsFromLocal, false);
});

test('the hash ignores key order and the updatedAt stamp', () => {
  assert.equal(M.itemHash({ a: 1, b: 2 }), M.itemHash({ b: 2, a: 1 }));
  assert.equal(M.itemHash({ id: 1, x: 1, updatedAt: 5 }), M.itemHash({ id: 1, x: 1 }));
  assert.notEqual(M.itemHash({ id: 1, x: 1 }), M.itemHash({ id: 1, x: 2 }));
});

test('tombstones union to the later time and old ones expire', () => {
  const now = 100 * 864e5;
  const t = M.mergeTombs({ 1: now - 10, 2: now - 50 * 864e5 }, { 1: now - 5, 3: now - 1 }, now, 45 * 864e5);
  assert.deepEqual(plain(t), { 1: now - 5, 3: now - 1 });
});
