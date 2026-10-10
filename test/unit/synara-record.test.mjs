import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { buildSync } from 'esbuild';

/*
 * Synara's on-device record (public/synara/js/store.js) and its encrypted
 * sync (sync.js): what an update does to a record that already exists.
 * Each test pins something that once went wrong in review:
 *   - the rescue medication was cut at 200 characters, mid-instruction;
 *   - "Do NOT put anything in their mouth" had an exception EF/CDC don't;
 *   - an update's migration looked like an edit to sync, so the second
 *     device asked "which copy to keep?" though nobody had changed a thing;
 *   - "Cell # (555) 014-2007" lost its Call button to extension parsing.
 *
 * The files are browser modules, so esbuild bundles them, and each test
 * imports its own copy (fresh module state) with its own fake storage.
 */

const { outputFiles } = buildSync({
  stdin: {
    contents: `export * as store from './store.js';
               export * as sync from './sync.js';
               export * as util from './util.js';`,
    resolveDir: fileURLToPath(new URL('../../public/synara/js', import.meta.url)),
  },
  bundle: true, format: 'esm', write: false, platform: 'neutral',
});
const source = outputFiles[0].text;
let copies = 0;

/** A fresh store + sync, over `items` as localStorage, with an optional
    fake Flux vault holding `remote`. */
async function load(items = {}, { remote = null, user = { id: 'u1' } } = {}) {
  const data = new Map(Object.entries(items));
  const puts = [];
  globalThis.localStorage = {
    getItem: (k) => (data.has(k) ? data.get(k) : null),
    setItem: (k, v) => { data.set(k, String(v)); },
    removeItem: (k) => { data.delete(k); },
  };
  globalThis.window = globalThis;
  globalThis.addEventListener = () => {};
  globalThis.document = {
    readyState: 'complete',
    documentElement: { dataset: { host: 'flux' } },
    addEventListener: () => {},
  };
  globalThis.FluxSynaraVault = {
    async account() { return user; },
    async get() { return remote; },
    async put(sealed) {
      puts.push(sealed);
      remote = { ...sealed, updated_at: `2026-10-10T12:00:0${puts.length}Z` };
      return remote;
    },
  };
  copies += 1;
  const mod = await import('data:text/javascript;base64,' +
    Buffer.from(`${source}\n// copy ${copies}`).toString('base64'));
  KEY ??= mod.sync.encodeKey(new Uint8Array(16).fill(7));
  return { ...mod, data, puts, remote: () => remote };
}

/* A record as the version before rescue medication saved it: no
   rescueMed, and the first version's standard steps. */
function oldRecord() {
  return {
    v: 3,
    profile: {
      name: 'Riley', pronouns: '', grade: '', school: '', seizureType: '', diagnosed: '',
      neurologist: '', neuroPhone: '', allergies: '', bloodType: '',
    },
    meds: [],
    doses: {},
    seizures: [{
      id: 'sz1', at: '2026-10-01T08:00', duration: 90, type: '', trigger: '', place: '',
      aura: '', injury: false, emsCalled: false, notes: '', logged: '2026-10-01T08:05',
    }],
    checkins: {},
    contacts: [],
    card: {
      looksLike: '',
      during: [
        'Stay with them and start timing the seizure.',
        'Move anything hard or sharp out of the way.',
        'Put something soft under their head.',
        'Loosen anything tight around their neck.',
        'If they are not aware or not awake, gently turn them onto their side.',
        'Stay calm and speak normally — they may be able to hear you.',
      ],
      doNot: [
        'Do NOT put anything in their mouth. They cannot swallow their tongue.',
        'Do NOT hold them down or try to stop the movements.',
        'Do NOT give food, drink, or pills until they are fully awake.',
        'Do NOT crowd them — ask other people to step back.',
      ],
      after: [
        'Stay with them until they are fully alert and know where they are.',
        'Tell them calmly what happened — they may not remember.',
        'Let them rest somewhere quiet.',
        'Call their emergency contact.',
        'Write down the time it started and how long it lasted.',
      ],
      callEms: [
        'The seizure lasts longer than 5 minutes.',
        'A second seizure starts soon after the first.',
        'They do not wake up or return to normal afterwards.',
        'They are having trouble breathing, or their lips stay blue.',
        'They were injured, or it happened in water.',
      ],
      forTeacher: '', forNurse: '', forCoach: '', updated: '',
    },
    settings: {
      theme: 'system', remindersOn: false, reminderLead: 0, quietHours: null,
      seeded: false, fluxLink: false, noMeds: false, setupHidden: false,
    },
  };
}

/** A sync key, as the first device made it (set by the first load()). */
let KEY;

/** What the previous version saved in synara.sync after its last sync. */
async function syncedMeta(sync, rec, remoteAt = '2026-10-09T09:00:00Z') {
  return JSON.stringify({ key: KEY, user: 'u1', hash: await sync.hash(sync.shareable(JSON.stringify(rec))), remoteAt });
}

/* ---------------------------------------------------------------- */

test('a rescue plan of a few sentences is kept whole; only beyond 600 is anything cut', async () => {
  const { store } = await load();
  const plan = 'Valtoco (diazepam nasal spray) 10 mg: one spray in one nostril if a seizure lasts 5 minutes or longer, ' +
    'or 3 or more seizures within 1 hour. Do NOT give a second dose unless at least 4 hours have passed. ' +
    'Call 911 after giving it. Kept in the nurse’s office, top drawer.';
  assert.ok(plan.length > 200);
  const rec = oldRecord();
  rec.profile.rescueMed = plan;
  rec.profile.allergies = 'x'.repeat(300);
  const out = store.migrate(rec);
  assert.equal(out.profile.rescueMed, plan, 'an imported or synced plan is not cut at 200');
  assert.equal(out.profile.allergies.length, 200, 'the short fields keep their limit');
  assert.equal(store.RESCUE_MED_MAX, 600);
  assert.equal(store.migrate({ ...rec, profile: { rescueMed: 'y'.repeat(900) } }).profile.rescueMed.length, 600);

  await store.init();
  await store.updateProfile({ rescueMed: plan });
  assert.equal(store.get().profile.rescueMed, plan, 'saving from the sheet keeps it whole');
});

test('"Do NOT put anything in their mouth" has no exception, and an untouched card with one loses it', async () => {
  const { store } = await load();
  const fresh = store.emptyState().card.doNot[0];
  assert.equal(fresh, 'Do NOT put anything in their mouth. They cannot swallow their tongue.');
  assert.ok(!store.emptyState().card.doNot.some((l) => /exception/i.test(l)));

  const rec = oldRecord();
  rec.card.doNot = [
    'Do NOT put anything in their mouth — they cannot swallow their tongue. Rescue medicine from their seizure plan is the only exception.',
    'Do NOT hold them down or try to stop the movements.',
    'Do NOT give food, drink, or pills until they are fully awake.',
    'Do NOT crowd them — ask other people to step back.',
  ];
  assert.deepEqual(store.migrate(rec).card.doNot, store.emptyState().card.doNot);

  // The student's own list is theirs, whatever it says.
  rec.card.doNot = ['Do NOT leave her alone.', ...rec.card.doNot];
  assert.equal(store.migrate(rec).card.doNot[0], 'Do NOT leave her alone.');
});

test('an update’s migration is not an edit: nothing to upload and nothing to choose between', async () => {
  const rec = oldRecord();
  const probe = await load();
  const meta = await syncedMeta(probe.sync, rec);
  const remote = { ciphertext: 'unchanged', iv: 'x', updated_at: '2026-10-09T09:00:00Z' };

  const dev = await load({ 'synara.v2': JSON.stringify(rec), 'synara.sync': meta }, { remote });
  const { firstRun } = await dev.store.init();
  assert.equal(firstRun, false);
  assert.ok(dev.store.premigrated(), 'loading changed the record (rescueMed, new steps)');
  assert.ok('rescueMed' in dev.store.get().profile);

  await dev.sync.start();
  assert.equal(await dev.sync.syncNow(), 'none');
  assert.equal(dev.puts.length, 0, 'nothing was uploaded');
  assert.equal(dev.sync.getStatus().phase, 'idle');
});

test('a real unsynced change still counts after the update, and still goes up', async () => {
  const rec = oldRecord();
  const probe = await load();
  const meta = await syncedMeta(probe.sync, rec);
  const remote = { ciphertext: 'unchanged', iv: 'x', updated_at: '2026-10-09T09:00:00Z' };
  const edited = oldRecord();
  edited.seizures.unshift({ ...edited.seizures[0], id: 'sz2', at: '2026-10-08T10:00' });

  const dev = await load({ 'synara.v2': JSON.stringify(edited), 'synara.sync': meta }, { remote });
  await dev.store.init();
  await dev.sync.start();
  assert.equal(await dev.sync.syncNow(), 'push');
  assert.equal(dev.puts.length, 1);
});

test('when the other device already uploaded the same record, migrated, there is no conflict', async () => {
  // Device A updated first and (before this fix) uploaded its migrated copy.
  const rec = oldRecord();
  const a = await load();
  const migrated = a.sync.shareable(JSON.stringify(a.store.migrate(rec)));
  const raw = a.sync.decodeKey(KEY);
  const sealed = await a.sync.encrypt(migrated, raw);
  const remote = { ...sealed, updated_at: '2026-10-10T08:00:00Z' };

  // Device B: same record, but its saved hash is from before the update
  // and was never adopted (say the tab closed mid-boot last time).
  const metaB = JSON.stringify({ key: KEY, user: 'u1', hash: 'stale', remoteAt: '2026-10-09T09:00:00Z' });
  const b = await load({ 'synara.v2': JSON.stringify(a.store.migrate(rec)), 'synara.sync': metaB }, { remote });
  await b.store.init();
  await b.sync.start();
  assert.equal(await b.sync.syncNow(), 'none');
  assert.equal(b.sync.getStatus().phase, 'idle');
  assert.equal(b.puts.length, 0);

  // A real difference is still a conflict to ask about.
  const metaC = JSON.stringify({ key: KEY, user: 'u1', hash: 'stale', remoteAt: '2026-10-09T09:00:00Z' });
  const other = a.store.migrate(rec);
  other.seizures = [];
  const c = await load({ 'synara.v2': JSON.stringify(other), 'synara.sync': metaC }, { remote });
  await c.store.init();
  await c.sync.start();
  assert.equal(await c.sync.syncNow(), 'conflict');
});

test('an extension is only an extension after the number: "Cell #" and "Text or call" still dial', async () => {
  const { util } = await load();
  const cases = [
    ['(555) 018-8300 ext. 214', 'tel:5550188300,214', true],
    ['(555) 018-8300 extension 214', 'tel:5550188300,214', true],
    ['555-0100 x12', 'tel:5550100,12', true],
    ['(555) 010-2244#3', 'tel:5550102244,3', true],
    ['Cell # (555) 014-2007', 'tel:5550142007', true],
    ['Text or call (555) 014-2007', 'tel:5550142007', true],
    ['+44 20 7946 0958', 'tel:+442079460958', true],
    ['ext. 214', 'tel:,214', false],
    ['x12', 'tel:,12', false],
    ['', 'tel:', false],
  ];
  for (const [typed, href, ok] of cases) {
    assert.equal(util.telHref(typed), href, typed);
    assert.equal(util.dialable(typed), ok, typed);
  }
});
