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
/** Shared storage for tabs: JSON in, JSON out, like localStorage (an unreadable value reads as null). */
function memStore(init = {}) {
  const m = new Map(Object.entries(init).map(([k, v]) => [k, typeof v === 'string' ? v : JSON.stringify(v)]));
  return {
    get: (k) => { if (!m.has(k)) return null; try { return JSON.parse(m.get(k)); } catch (_) { return null; } },
    set: (k, v) => { m.set(k, JSON.stringify(v)); },
  };
}

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

test('a task the row lost without a tombstone, unchanged here, was deleted elsewhere (the Claude connector deletes that way)', () => {
  // supabase/functions/mcp delete_task filters the task out of the row and
  // writes no tombstone. A device whose base has it used to push it back.
  const agreed = [T(1), T(2)];
  const r = M.merge(plain(agreed), [T(1)], { base: M.hashes(agreed) });
  assert.deepEqual(plain(r.list.map((t) => t.id)), [1]);
  assert.equal(r.differsFromCloud, false, 'nothing to push back');
});

test('a task the row lost, but edited here since, stays and goes back up', () => {
  const agreed = [T(1), T(2)];
  const local = [T(1), T(2, { name: 'Still need this', updatedAt: 8000 })];
  const r = M.merge(local, [T(1)], { base: M.hashes(agreed) });
  assert.deepEqual(plain(r.list.map((t) => t.id)), [1, 2]);
  assert.equal(r.differsFromCloud, true);
});

test('an edit made after another device deleted the task keeps it', () => {
  const agreed = [T(1)];
  const r = M.merge([T(1, { name: 'Still need this', updatedAt: 8000 })], [], { base: M.hashes(agreed), cloudTomb: { 1: 5000 } });
  assert.equal(r.list.length, 1);
});

test('the local list failed to load (corrupt storage → []): nothing is taken for deleted, nothing is pushed', () => {
  const cloud = [T(1), T(2), T(3, { done: true })];
  const r = M.merge([], plain(cloud), { base: M.hashes(cloud) });
  assert.deepEqual(plain(r.list.map((t) => t.id)), [1, 2, 3]);
  assert.equal(r.differsFromCloud, false, 'an empty list would have been pushed over the cloud');
});

test('the corrupt-storage case end to end: a tab that read [] keeps every task and writes them back', () => {
  const cloud = [T(1), T(2)];
  const store = memStore({ tasks: '{not json', flux_sync_base_v1: { tasks: M.hashes(cloud) } });
  const tab = M.createListSync(store);
  tab.loadBase();
  tab.startSession({ tasks: [] });       // load('tasks', []) fell back to []
  tab.noteEdits('tasks', []);            // and it was saved like that
  assert.deepEqual(plain(store.get('flux_list_tombstones_v1') || {}), {}, 'a list that never loaded left tombstones');
  const r = tab.pull('tasks', [], plain(cloud), {});
  assert.deepEqual(plain(r.list.map((t) => t.id)), [1, 2]);
  assert.equal(r.differsFromCloud, false);
  assert.deepEqual(plain(store.get('tasks').map((t) => t.id)), [1, 2]);
});

test('no base (a new device, a guest signing in): the cloud list as it is', () => {
  const cloud = [T(1, { name: 'Cloud' }), T(2, { name: 'Cloud 2', updatedAt: 100 })];
  const guest = [T(1, { name: 'Guest copy', updatedAt: 900 }), T(3, { name: 'Made as a guest', createdAt: 5000, updatedAt: 5000 })];
  const r = M.merge(guest, plain(cloud), { base: null });
  assert.deepEqual(plain(r.list), plain(cloud));
  assert.equal(r.differsFromCloud, false, 'guest tasks were uploaded into the account');
});

test('no base: what was changed here since signing in still survives the first pull', () => {
  const cloud = [T(1), T(2), T(3)];
  const local = [T(9, { createdAt: 5000, updatedAt: 5000 }), T(1, { done: true, updatedAt: 5000 }), T(2)];
  const r = M.merge(local, plain(cloud), { base: null, edited: { 9: true, 1: true, 3: true }, localTomb: { 3: 5000 } });
  assert.deepEqual(plain(r.list.map((t) => t.id)), [9, 1, 2]);
  assert.equal(r.list.find((t) => t.id === 1).done, true);
  assert.equal(r.differsFromCloud, true);
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

// ── No resurrections, no duplicates ──────────────────────────────────────────

test('a task deleted here stays deleted when another device pushes its older copy back', () => {
  const agreed = [T(1), T(2, { updatedAt: 1000 })];
  const base = M.hashes([T(1)]);                       // our push after the delete
  const stalePush = plain(agreed);                     // a device that had not pulled yet
  const r = M.merge([T(1)], stalePush, { base, localTomb: { 2: 5000 } });
  assert.deepEqual(plain(r.list.map((t) => t.id)), [1]);
  assert.equal(r.differsFromCloud, true, 'the delete has to go back up');
});

test('a task deleted on another device is not pushed back from here', () => {
  const agreed = [T(1), T(2)];
  const r = M.merge(plain(agreed), [T(1)], { base: M.hashes(agreed), cloudTomb: { 2: 5000 } });
  assert.deepEqual(plain(r.list.map((t) => t.id)), [1]);
  assert.equal(r.differsFromCloud, false);
});

test('a task either side holds twice comes out once', () => {
  const agreed = [T(1), T(2)];
  const r = M.merge([T(1), T(2), T(2)], [T(1), T(3), T(3), T(2)], { base: M.hashes(agreed) });
  assert.deepEqual(plain(r.list.map((t) => t.id)).sort(), [1, 2, 3]);
});

test('the same Canvas assignment imported on two devices is one task, under the id the cloud has', () => {
  const agreed = [T(1)];
  const mine = T(111, { name: 'Lab report', canvasCourseId: 5, canvasAssignmentId: 9, updatedAt: 2000 });
  const theirs = T(222, { name: 'Lab report', canvasCourseId: 5, canvasAssignmentId: 9, updatedAt: 1900 });
  const r = M.merge([mine, T(1)], [theirs, T(1)], { base: M.hashes(agreed) });
  const lab = r.list.filter((t) => t.canvasAssignmentId === 9);
  assert.equal(lab.length, 1);
  assert.equal(lab[0].id, 222);
  assert.equal(r.list.length, 2);
});

test('ticking your copy before the other device\'s copy arrived keeps the tick', () => {
  const agreed = [T(1)];
  const mine = T(111, { canvasCourseId: 5, canvasAssignmentId: 9, done: true, updatedAt: 3000 });
  const theirs = T(222, { canvasCourseId: 5, canvasAssignmentId: 9, updatedAt: 1000 });
  const r = M.merge([mine, T(1)], [theirs, T(1)], { base: M.hashes(agreed) });
  const lab = r.list.filter((t) => t.canvasAssignmentId === 9);
  assert.equal(lab.length, 1);
  assert.equal(lab[0].id, 222);
  assert.equal(lab[0].done, true);
  assert.equal(r.differsFromCloud, true);
});

test('two different assignments, or one already shared, are left alone', () => {
  const shared = T(222, { canvasCourseId: 5, canvasAssignmentId: 9 });
  const base = M.hashes([shared]);
  const other = T(333, { canvasCourseId: 5, canvasAssignmentId: 10 });
  const r = M.merge([shared, other], [shared], { base });
  assert.deepEqual(plain(r.list.map((t) => t.id)).sort(), [222, 333]);
  assert.equal(M.sourceKey(T(1)), '');
  assert.notEqual(M.sourceKey(shared), M.sourceKey(T(2, { canvasCourseId: 6, canvasAssignmentId: 9 })));
});

test('a repeat ticked on two devices spawns one next step', () => {
  const agreed = [T(1, { seriesId: 's1', date: '2026-10-05' })];
  const base = M.hashes(agreed);
  const doneHere = [T(1, { seriesId: 's1', date: '2026-10-05', done: true, updatedAt: 5000 }), T(50, { seriesId: 's1', date: '2026-10-12', updatedAt: 5000 })];
  const doneThere = [T(1, { seriesId: 's1', date: '2026-10-05', done: true, updatedAt: 4000 }), T(60, { seriesId: 's1', date: '2026-10-12', updatedAt: 4000 })];
  const r = M.merge(doneHere, doneThere, { base });
  assert.equal(r.list.filter((t) => t.date === '2026-10-12').length, 1);
});

test('a note without an id, edited on another device, is not kept beside the edited copy', () => {
  const old = { title: 'Notes', body: 'v1' };
  const base = M.hashes([old]);
  const r = M.merge([plain(old)], [{ title: 'Notes', body: 'v2' }], { base });
  assert.deepEqual(plain(r.list), [{ title: 'Notes', body: 'v2' }]);
});

// ── Tabs, sign-in and storage: createListSync ────────────────────────────────

/** A tab: its own list in memory, its own sync bookkeeping, shared storage. */
function openTab(store, clock) {
  const sync = M.createListSync(store, clock);
  const tab = { sync, tasks: plain(store.get('tasks') || []) };
  sync.loadBase();
  sync.startSession({ tasks: tab.tasks });
  tab.save = () => { sync.noteEdits('tasks', tab.tasks); store.set('tasks', tab.tasks); };
  tab.push = (cloud) => { cloud.tasks = plain(tab.tasks); sync.recordBase('tasks', cloud.tasks); };
  tab.pull = (cloud) => { const r = sync.pull('tasks', tab.tasks, plain(cloud.tasks), cloud.listTombstones); tab.tasks = r.list; return r; };
  return tab;
}

test('two tabs: one open from earlier neither drops the other\'s new task nor undoes its rename', () => {
  // The base used to live only in shared storage, so tab A's push moved tab
  // B's base too: B then took A's new task for one B had deleted, and its own
  // older copy of the renamed one for a newer edit — and pushed both back.
  const agreed = [T(1)];
  const cloud = { tasks: plain(agreed) };
  const store = memStore({ tasks: agreed, flux_sync_base_v1: { tasks: M.hashes(agreed) } });
  const B = openTab(store);
  const A = openTab(store);
  A.tasks.unshift(T(2, { name: 'Added in tab A' }));
  A.tasks.find((t) => t.id === 1).name = 'Renamed in tab A';
  A.save();
  A.push(cloud);                       // and tab A is closed
  const r = B.pull(cloud);
  assert.deepEqual(plain(r.list.map((t) => t.id)), [2, 1], 'tab A\'s new task was dropped');
  assert.equal(r.list.find((t) => t.id === 1).name, 'Renamed in tab A', 'tab B kept its stale copy');
  assert.equal(r.differsFromCloud, false, 'tab B would push its stale list back');
});

test('two tabs: a tab that saved before pulling leaves its own base with its list, for the next tab to open', () => {
  const agreed = [T(1), T(3)];
  const cloud = { tasks: plain(agreed) };
  const store = memStore({ tasks: agreed, flux_sync_base_v1: { tasks: M.hashes(agreed) } });
  const B = openTab(store);
  const A = openTab(store);
  A.tasks.find((t) => t.id === 1).name = 'Renamed in tab A';
  A.save();
  A.push(cloud);
  B.tasks.find((t) => t.id === 3).done = true;   // B, not pulled yet, ticks another task
  B.save();                                      // storage now holds B's list (old #1)
  const C = openTab(store);                      // B closes; a new tab opens
  const r = C.pull(cloud);
  assert.equal(r.list.find((t) => t.id === 1).name, 'Renamed in tab A', 'the new tab read B\'s list against A\'s base');
  assert.equal(r.list.find((t) => t.id === 3).done, true, 'B\'s tick was lost');
});

test('a tab that still has a task does not clear the tombstone another tab left for it', () => {
  const agreed = [T(1), T(3)];
  const cloud = { tasks: plain(agreed) };
  const store = memStore({ tasks: agreed, flux_sync_base_v1: { tasks: M.hashes(agreed) } });
  const B = openTab(store);
  const A = openTab(store);
  A.tasks = A.tasks.filter((t) => t.id !== 3);
  A.save();
  B.tasks.find((t) => t.id === 1).done = true;
  B.save();
  cloud.listTombstones = store.get('flux_list_tombstones_v1');
  A.push(cloud);
  assert.ok(cloud.listTombstones.tasks['3'], 'tab B\'s save cleared tab A\'s delete');
  const r = B.pull(cloud);
  assert.deepEqual(plain(r.list.map((t) => t.id)), [1]);
  assert.equal(r.list[0].done, true);
});

test('trimming stored notes keeps the newest and deletes nothing anywhere', () => {
  // Notes are stored newest first. slice(-240) through save() kept the oldest
  // and left a tombstone for every newer one, deleting them on every device.
  const notes = Array.from({ length: 300 }, (_, i) => ({ id: 1e12 + 300 - i, title: 'Note ' + i, createdAt: 1e12 + 300 - i }));
  const store = memStore({ flux_notes: notes });
  const sync = M.createListSync(store);
  const kept = sync.compact('flux_notes', 240);
  assert.equal(kept.length, 240);
  assert.deepEqual(plain(kept.map((n) => n.title)), notes.slice(0, 240).map((n) => n.title), 'the newest notes were trimmed');
  assert.deepEqual(plain(store.get('flux_notes')), plain(kept));
  assert.equal(store.get('flux_list_tombstones_v1'), null, 'the trim left tombstones');
  // And the trimmed ones are not deleted from the cloud by the next pull either.
  const r = sync.pull('notes', plain(kept), plain(notes), {});
  assert.equal(r.list.length, 300);
  assert.deepEqual(M.newest([{ id: 1, createdAt: 5 }, { id: 2, createdAt: 9 }, { id: 3, createdAt: 7 }], 2).map((n) => n.id), [2, 3]);
});

test('a note without an id edited here: the old version does not come back beside it', () => {
  const old = { title: 'Notes', body: 'v1' };
  const store = memStore({ flux_notes: [old], flux_sync_base_v1: { notes: M.hashes([old]) } });
  const sync = M.createListSync(store, () => 7000);
  sync.loadBase();
  sync.startSession({ flux_notes: [old] });
  const edited = [{ title: 'Notes', body: 'v2' }];
  sync.noteEdits('flux_notes', edited);
  const r = sync.pull('notes', edited, [plain(old)], {});
  assert.deepEqual(plain(r.list.map((n) => n.body)), ['v2']);
});

test('signing in after using Flux as a guest: the account\'s tasks, not the guest\'s', () => {
  // Sign-out clears the base and the last sync time but keeps the last user
  // id, so signing back in to the same account wiped nothing — and the empty
  // base made every guest task look new, to be merged in and uploaded.
  const account = [T(1, { name: 'Account task' })];
  const store = memStore({ flux_last_user_id: 'u1' });
  const tab = openTab(store);              // the page after sign-out: a guest
  tab.tasks.unshift(T(50, { name: 'Guest task', createdAt: 5000 }));
  tab.save();
  tab.sync.startSession({ tasks: tab.tasks });   // handleSignedIn: a new session
  const r = tab.pull({ tasks: plain(account) });
  assert.deepEqual(plain(r.list), plain(account));
  assert.equal(r.differsFromCloud, false, 'guest tasks would be pushed into the account');
});

test('signing in: a tick made while the first pull is out survives it, even with no base yet', () => {
  const cloud = { tasks: [T(1), T(2)] };
  const store = memStore({ tasks: [T(1), T(2)] });  // a device upgraded from before bases existed
  const tab = openTab(store);
  tab.sync.startSession({ tasks: tab.tasks });
  tab.tasks[1].done = true;
  tab.save();
  const r = tab.pull(cloud);
  assert.equal(r.list.find((t) => t.id === 2).done, true);
  assert.equal(r.differsFromCloud, true);
});

test('"keep my guest data": pushed before the first pull, it is the base, and the pull keeps it', () => {
  const guest = [T(50, { name: 'Guest task' }), T(51)];
  const store = memStore({ tasks: guest });
  const tab = openTab(store);
  tab.sync.startSession({ tasks: tab.tasks });
  const cloud = { tasks: [] };
  tab.push(cloud);                          // syncToCloud({beforePull:true})
  const r = tab.pull(cloud);
  assert.deepEqual(plain(r.list.map((t) => t.id)), [50, 51]);
  assert.equal(r.differsFromCloud, false);
});

test('an account switch forgets the other account\'s base', () => {
  const store = memStore({ tasks: [T(1)], flux_sync_base_v1: { tasks: M.hashes([T(1)]) } });
  const tab = openTab(store);
  assert.ok(tab.sync.base('tasks'));
  store.set('flux_sync_base_v1', null);     // the wipe
  tab.sync.loadBase();
  assert.equal(tab.sync.base('tasks'), null);
});
