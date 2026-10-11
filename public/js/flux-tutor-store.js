/* ============================================================================
   FLUX TUTOR · STORE  ·  flux-tutor-store.js
   The student's library of study sets on this device: list, open, save,
   rename, duplicate, delete (with undo), export and import, and the one-time
   move of the first beta's saved session into the library.

   WHERE SETS LIVE
   ---------------
   IndexedDB first (database "flux-tutor": store "sets" holds each set, store
   "meta" the small summary a library card shows, written in one transaction).
   When IndexedDB is not available (blocked, or an old private window) sets go
   to localStorage under "flux_tutor.v2.set.<id>", kept under a budget so they
   can never crowd out the planner, which shares that storage. When neither
   works the library still runs in memory for this tab and says so.
   Sets saved to localStorage are moved into IndexedDB the next time it works.

   ERRORS
   ------
   Nothing here throws at the page or rejects: every call resolves with
   { ok: true, … } or { ok: false, error: { code, message } } where message is
   a plain sentence to show the student (codes: quota, blocked, write,
   missing, invalid).

   THE FIRST BETA
   --------------
   flux-teacher-app.js kept one draft and one session under
   localStorage["flux_teacher.beta.v1"]. migrateLegacy() turns them into
   study sets (FluxTutor.migrateLegacy keeps every word the student wrote),
   saves them, reads them back, and only then removes the old key. The new
   sets get ids made from the old data, so two tabs migrating at once write
   the same sets instead of doubles, and a set deleted after the move does not
   come back.

   Needs flux-tutor-core.js (window.FluxTutor) loaded first. No DOM.
   ========================================================================== */
(function () {
  'use strict';
  const root = typeof window !== 'undefined' ? window : globalThis;
  if (root.FluxTutorStore) return;

  const DB_NAME = 'flux-tutor';
  const DB_VERSION = 1;
  const SETS = 'sets';
  const META = 'meta';
  const LS_SET = 'flux_tutor.v2.set.';
  const LEGACY_KEY = 'flux_teacher.beta.v1';
  const MIGRATED_KEY = 'flux_tutor.v2.migrated';
  /** localStorage is shared with the planner: Tutor never uses more than this many characters of it. */
  const LS_BUDGET = 2500000;
  const BIN_DAYS = 30;
  const OPEN_TIMEOUT = 8000;
  const CHANNEL = 'flux-tutor-library';
  const DAY = 86400000;

  const MESSAGES = {
    quota: 'There is no room left in this browser to save Flux Tutor sets, so your latest change is not saved yet. Export a set you no longer need and delete it, then try again.',
    budget: 'This browser is keeping Flux Tutor sets in its small backup storage, and they have filled it, so your latest change is not saved yet. Export a set you no longer need and delete it, or remove a big file from this set, then try again.',
    blocked: 'This browser is not letting Flux save anything (a private window or a privacy setting), so your study sets will be gone when you close this tab. Use Export to keep a copy.',
    write: 'Flux Tutor could not save that change. Try again, and if it keeps failing use Export to keep a copy.',
    missing: 'That study set is no longer on this device.',
    title: 'Give the study set a name.',
  };

  function plainError(code, detail, message) {
    const out = { code, message: message || MESSAGES[code] || MESSAGES.write };
    if (detail) out.detail = String(detail).slice(0, 200);
    return { ok: false, error: out };
  }
  /** Turn what a browser threw into one of our codes. */
  function classify(err) {
    const name = String((err && err.name) || '');
    const msg = String((err && err.message) || '');
    const code = err && err.code;
    if (name === 'QuotaExceededError' || name === 'NS_ERROR_DOM_QUOTA_REACHED' || code === 22 || code === 1014 || /quota|exceeded|no space|disk is full|storage is full/i.test(msg)) return 'quota';
    if (name === 'SecurityError' || name === 'NotAllowedError' || /denied|not allowed|private|insecure/i.test(msg)) return 'blocked';
    return 'write';
  }
  function fail(err) {
    return plainError(classify(err), (err && (err.name || err.message)) || String(err || ''));
  }
  function nowIso() { return new Date().toISOString(); }
  function copy(x) { return x == null ? x : JSON.parse(JSON.stringify(x)); }
  function slug(text) {
    const s = String(text || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^A-Za-z0-9]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase().slice(0, 60);
    return s || 'study-set';
  }

  /* ── Backends ───────────────────────────────────────────────────────── */
  // Each: { name, persistent, allMeta(), get(id), put(set, meta), del(id), close() }, all promise-based.

  function idbBackend(idb) {
    let dbp = null;
    function openDb() {
      if (dbp) return dbp;
      dbp = new Promise((resolve, reject) => {
        let req;
        try { req = idb.open(DB_NAME, DB_VERSION); } catch (e) { reject(e); return; }
        req.onupgradeneeded = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains(SETS)) db.createObjectStore(SETS, { keyPath: 'id' });
          if (!db.objectStoreNames.contains(META)) db.createObjectStore(META, { keyPath: 'id' });
        };
        req.onsuccess = () => {
          const db = req.result;
          // Another tab upgrading the database: let it, and reopen on the next call.
          db.onversionchange = () => { try { db.close(); } catch (_) {} dbp = null; };
          resolve(db);
        };
        req.onerror = () => reject(req.error || new Error('IndexedDB did not open'));
      });
      dbp.catch(() => { dbp = null; });
      return dbp;
    }
    /** Run fn(tx) in one transaction; resolves with what fn set as the result once it commits. */
    function run(stores, mode, fn) {
      return openDb().then((db) => new Promise((resolve, reject) => {
        let tx;
        try { tx = db.transaction(stores, mode); } catch (e) { reject(e); return; }
        const box = { result: undefined };
        tx.oncomplete = () => resolve(box.result);
        tx.onabort = () => reject(tx.error || new Error('The save was cancelled'));
        tx.onerror = (ev) => { if (ev && typeof ev.preventDefault === 'function') ev.preventDefault(); };
        try { fn(tx, box); } catch (e) { try { tx.abort(); } catch (_) {} reject(e); }
      }));
    }
    return {
      name: 'indexeddb',
      persistent: true,
      ready: () => openDb().then(() => true),
      allMeta: () => run([META], 'readonly', (tx, box) => {
        const store = tx.objectStore(META);
        if (typeof store.getAll === 'function') {
          const r = store.getAll();
          r.onsuccess = () => { box.result = r.result || []; };
        } else {
          const out = [];
          const c = store.openCursor();
          c.onsuccess = () => { const cur = c.result; if (cur) { out.push(cur.value); cur.continue(); } else box.result = out; };
        }
      }),
      get: (id) => run([SETS], 'readonly', (tx, box) => {
        const r = tx.objectStore(SETS).get(id);
        r.onsuccess = () => { box.result = r.result || null; };
      }),
      put: (set, meta) => run([SETS, META], 'readwrite', (tx) => {
        tx.objectStore(SETS).put(set);
        tx.objectStore(META).put(meta);
      }),
      del: (id) => run([SETS, META], 'readwrite', (tx) => {
        tx.objectStore(SETS).delete(id);
        tx.objectStore(META).delete(id);
      }),
      close: () => {
        if (!dbp) return;
        dbp.then((db) => { try { db.close(); } catch (_) {} }).catch(() => {});
        dbp = null;
      },
    };
  }

  /** Every Tutor key in localStorage, with its text. */
  function lsEntries(ls) {
    const out = [];
    let n = 0;
    try { n = ls.length; } catch (_) { return out; }
    const keys = [];
    for (let i = 0; i < n; i++) {
      let k = null;
      try { k = ls.key(i); } catch (_) {}
      if (typeof k === 'string' && k.indexOf(LS_SET) === 0) keys.push(k);
    }
    keys.forEach((k) => {
      let v = null;
      try { v = ls.getItem(k); } catch (_) {}
      if (typeof v === 'string') out.push({ key: k, id: k.slice(LS_SET.length), text: v });
    });
    return out;
  }

  function lsBackend(ls, core, budget) {
    const parse = (text) => {
      try { return core.normalizeSet(JSON.parse(text)); } catch (_) { return null; }
    };
    return {
      name: 'localstorage',
      persistent: true,
      ready: () => Promise.resolve(true),
      // No separate index to fall out of step: the summaries are read from the sets themselves.
      allMeta: () => Promise.resolve(lsEntries(ls).map((e) => {
        const set = parse(e.text);
        return set && set.id === e.id ? metaOf(core, set) : null;
      }).filter(Boolean)),
      get: (id) => {
        try {
          const v = ls.getItem(LS_SET + id);
          return Promise.resolve(v ? parse(v) : null);
        } catch (e) { return Promise.reject(e); }
      },
      put: (set) => {
        try {
          const text = JSON.stringify(set);
          const used = lsEntries(ls).reduce((n, e) => n + (e.id === set.id ? 0 : e.text.length), 0);
          if (used + text.length > budget) {
            const err = new Error('Flux Tutor budget reached');
            err.name = 'FluxTutorBudget';
            return Promise.reject(err);
          }
          ls.setItem(LS_SET + set.id, text);
          return Promise.resolve();
        } catch (e) { return Promise.reject(e); }
      },
      del: (id) => {
        try { ls.removeItem(LS_SET + id); return Promise.resolve(); } catch (e) { return Promise.reject(e); }
      },
      close: () => {},
    };
  }

  function memoryBackend(core) {
    const sets = new Map();
    return {
      name: 'memory',
      persistent: false,
      ready: () => Promise.resolve(true),
      allMeta: () => Promise.resolve(Array.from(sets.values()).map((t) => metaOf(core, JSON.parse(t)))),
      get: (id) => Promise.resolve(sets.has(id) ? JSON.parse(sets.get(id)) : null),
      put: (set) => { sets.set(set.id, JSON.stringify(set)); return Promise.resolve(); },
      del: (id) => { sets.delete(id); return Promise.resolve(); },
      close: () => {},
    };
  }

  function metaOf(core, set) {
    const m = core.summarizeSet(set);
    m.deletedAt = set.deletedAt || '';
    return m;
  }

  /* ── Picking where to save ──────────────────────────────────────────── */

  function safeLocalStorage(o) {
    if (o && 'localStorage' in o) return o.localStorage || null;
    try { return root.localStorage || null; } catch (_) { return null; }
  }
  /** Can we write and read back a small value? */
  function lsWorks(ls) {
    if (!ls) return false;
    const k = 'flux_tutor.v2.probe';
    try {
      ls.setItem(k, '1');
      const ok = ls.getItem(k) === '1';
      ls.removeItem(k);
      return ok;
    } catch (_) { return false; }
  }
  function withTimeout(p, ms) {
    return new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error('IndexedDB took too long to open')), ms);
      p.then((v) => { clearTimeout(t); resolve(v); }, (e) => { clearTimeout(t); reject(e); });
    });
  }

  /**
   * Open the library. opts (all optional, for tests): { core, indexedDB,
   * localStorage, backend: 'indexeddb'|'localstorage'|'memory', lsBudget,
   * BroadcastChannel, autosaveDelay }.
   * Resolves with the store; store.backend says where sets are going and
   * store.warning is a plain sentence to show when they are not safe
   * (memory only), or ''.
   */
  async function open(opts) {
    const o = opts || {};
    const core = o.core || root.FluxTutor;
    if (!core || typeof core.normalizeSet !== 'function') throw new Error('flux-tutor-core.js must load before flux-tutor-store.js');
    const ls = safeLocalStorage(o);
    const lsOk = lsWorks(ls);
    let idb = null;
    if ('indexedDB' in o) idb = o.indexedDB;
    else { try { idb = root.indexedDB || null; } catch (_) { idb = null; } }
    const want = o.backend || '';
    let backend = null;
    let note = '';
    if (idb && (!want || want === 'indexeddb')) {
      const b = idbBackend(idb);
      try {
        await withTimeout(b.ready(), o.openTimeout || OPEN_TIMEOUT);
        backend = b;
      } catch (e) {
        b.close();
        note = 'IndexedDB unavailable: ' + ((e && (e.name || e.message)) || e);
      }
    }
    if (!backend && lsOk && (!want || want === 'localstorage' || want === 'indexeddb')) backend = lsBackend(ls, core, o.lsBudget || LS_BUDGET);
    if (!backend) backend = memoryBackend(core);
    const store = makeStore(core, backend, ls, lsOk, o);
    store.note = note;
    if (backend.name === 'indexeddb' && lsOk) await store.adoptLocalSets();
    if (o.purge !== false) await store.purgeDeleted();
    return store;
  }

  /* ── The library ────────────────────────────────────────────────────── */

  function makeStore(core, backend, ls, lsOk, o) {
    const statusListeners = new Set();
    const changeListeners = new Set();
    const pending = new Map();
    const delay = Number.isFinite(o.autosaveDelay) ? o.autosaveDelay : 600;
    let channel = null;
    const BC = 'BroadcastChannel' in o ? o.BroadcastChannel : (typeof root.BroadcastChannel === 'function' ? root.BroadcastChannel : null);
    if (BC) {
      try {
        channel = new BC(CHANNEL);
        channel.onmessage = (ev) => {
          const d = ev && ev.data;
          if (d && typeof d.id === 'string') changeListeners.forEach((fn) => { try { fn({ id: d.id, type: String(d.type || 'saved'), fromOtherTab: true }); } catch (_) {} });
        };
      } catch (_) { channel = null; }
    }
    function announce(id, type) {
      if (channel) { try { channel.postMessage({ id, type }); } catch (_) {} }
    }
    function status(s) {
      statusListeners.forEach((fn) => { try { fn(s); } catch (_) {} });
    }

    async function write(set) {
      const meta = metaOf(core, set);
      try {
        await backend.put(set, meta);
      } catch (e) {
        if (e && e.name === 'FluxTutorBudget') return plainError('quota', 'localStorage budget', MESSAGES.budget);
        return fail(e);
      }
      return { ok: true, set, meta };
    }

    /**
     * Save a set (normalized first, so only known fields are kept).
     * opts.touch === false keeps updatedAt as it is.
     */
    async function save(set, opts) {
      const touch = !opts || opts.touch !== false;
      let clean;
      try { clean = core.normalizeSet(copy(set)); } catch (e) { clean = null; }
      if (!clean) return plainError('invalid', 'not a set', 'That is not a study set Flux Tutor can save.');
      if (touch) clean.updatedAt = nowIso();
      const res = await write(clean);
      if (res.ok) announce(clean.id, 'saved');
      return res;
    }

    async function get(id) {
      if (typeof id !== 'string' || !id) return null;
      try {
        const raw = await backend.get(id);
        return raw ? core.normalizeSet(raw) : null;
      } catch (_) { return null; }
    }

    /**
     * The library's cards: { ok, sets: [meta], error? }, newest change first.
     * opts.deleted: true lists the bin (sets deleted in the last 30 days) instead.
     */
    async function list(opts) {
      let metas;
      try { metas = await backend.allMeta(); } catch (e) { return Object.assign(fail(e), { sets: [] }); }
      const bin = !!(opts && opts.deleted);
      const out = (metas || []).filter((m) => m && typeof m.id === 'string' && (!!m.deletedAt === bin));
      out.sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')) || String(a.title).localeCompare(String(b.title)));
      return { ok: true, sets: out };
    }

    async function change(id, fn, opts) {
      // An autosave waiting for this set goes first, so it cannot undo this change a moment later.
      await runPending(id);
      const set = await get(id);
      if (!set) return plainError('missing');
      const bad = fn(set);
      if (bad) return bad;
      return save(set, opts);
    }
    function rename(id, title) {
      const t = String(title == null ? '' : title).replace(/\s+/g, ' ').trim().slice(0, core.LIMITS.title);
      if (!t) return Promise.resolve(plainError('title'));
      return change(id, (set) => { set.title = t; });
    }
    async function duplicate(id, title) {
      await runPending(id);
      const set = await get(id);
      if (!set) return plainError('missing');
      return save(core.cloneSet(set, title), { touch: false });
    }
    /** Delete with undo: the set goes to the bin; restore(id) brings it back. */
    async function remove(id) {
      const res = await change(id, (set) => { set.deletedAt = nowIso(); }, { touch: false });
      if (res.ok) announce(id, 'deleted');
      return res;
    }
    async function restore(id) {
      const res = await change(id, (set) => { set.deletedAt = ''; }, { touch: false });
      if (res.ok) announce(id, 'restored');
      return res;
    }
    /** Gone for good. */
    async function purge(id) {
      cancelPending(id);
      try { await backend.del(id); } catch (e) { return fail(e); }
      announce(id, 'purged');
      return { ok: true, id };
    }
    /** Empty the bin of sets deleted more than `days` (30) days ago. */
    async function purgeDeleted(days, nowMs) {
      const limit = (Number.isFinite(nowMs) ? nowMs : Date.now()) - (Number.isFinite(days) ? days : BIN_DAYS) * DAY;
      const bin = await list({ deleted: true });
      let purged = 0;
      for (const m of bin.sets) {
        const t = Date.parse(m.deletedAt);
        if (Number.isFinite(t) && t < limit) { const r = await purge(m.id); if (r.ok) purged++; }
      }
      return { ok: true, purged };
    }

    /* Autosave: call autosave(set) after every edit; the last version is saved
       after a short pause. Status listeners hear 'pending' → 'saving' →
       'saved' (or 'error' with a plain message). flush() saves now. */
    function cancelPending(id) {
      const p = pending.get(id);
      if (!p) return;
      clearTimeout(p.timer);
      pending.delete(id);
      p.resolvers.forEach((r) => r({ ok: false, error: { code: 'cancelled', message: '' } }));
    }
    function runPending(id) {
      const p = pending.get(id);
      if (!p) return Promise.resolve(null);
      pending.delete(id);
      clearTimeout(p.timer);
      status({ state: 'saving', id });
      return save(p.set, p.opts).then((res) => {
        status(res.ok ? { state: 'saved', id, at: res.set.updatedAt } : { state: 'error', id, error: res.error });
        p.resolvers.forEach((r) => r(res));
        return res;
      });
    }
    function autosave(set, opts) {
      if (!set || typeof set.id !== 'string') return Promise.resolve(plainError('invalid', 'no id', 'That is not a study set Flux Tutor can save.'));
      let snapshot;
      try { snapshot = copy(set); } catch (e) { return Promise.resolve(plainError('invalid', String(e))); }
      const prev = pending.get(set.id);
      const entry = prev || { resolvers: [] };
      if (prev) clearTimeout(prev.timer);
      entry.set = snapshot;
      entry.opts = opts || null;
      pending.set(set.id, entry);
      status({ state: 'pending', id: set.id });
      return new Promise((resolve) => {
        entry.resolvers.push(resolve);
        entry.timer = setTimeout(() => { runPending(set.id); }, delay);
      });
    }
    function flush() {
      return Promise.all(Array.from(pending.keys()).map(runPending));
    }
    function hasPending() { return pending.size > 0; }

    /* Export and import. */
    async function exportSet(id) {
      await runPending(id);
      const set = await get(id);
      if (!set) return plainError('missing');
      return { ok: true, filename: slug(set.title) + '.flux-tutor.json', text: JSON.stringify(core.exportSet(set)) };
    }
    async function exportAll() {
      await flush();
      const l = await list();
      if (!l.ok) return l;
      const sets = [];
      for (const m of l.sets) { const s = await get(m.id); if (s) sets.push(s); }
      return { ok: true, count: sets.length, filename: 'flux-tutor-library-' + new Date().toISOString().slice(0, 10) + '.json', text: JSON.stringify(core.exportLibrary(sets)) };
    }
    /**
     * Add the sets in an export file (or the first beta's data). Nothing on
     * this device is overwritten: a set whose id is already here comes in as
     * a new set. Resolves { ok, sets: [meta], skipped, error? }.
     */
    async function importText(text) {
      const parsed = core.parseImport(text);
      if (parsed.error) return Object.assign(plainError('invalid', 'import', parsed.error), { sets: [], skipped: parsed.skipped || 0 });
      const added = [];
      for (const set of parsed.sets) {
        if (await get(set.id)) set.id = core.uid('set-');
        const res = await save(set, { touch: false });
        if (!res.ok) return Object.assign(res, { sets: added, skipped: parsed.skipped });
        added.push(res.meta);
      }
      return { ok: true, sets: added, skipped: parsed.skipped };
    }

    /** The one-time move of the first beta's saved work. Resolves { ok, migrated, ids, error? }. */
    async function migrateLegacy() {
      if (!ls || !lsOk) return { ok: true, migrated: 0, ids: [] };
      let raw = null;
      try { raw = ls.getItem(LEGACY_KEY); } catch (_) { raw = null; }
      if (!raw) return { ok: true, migrated: 0, ids: [] };
      const hash = core.hashText(raw);
      let marker = null;
      try { marker = JSON.parse(ls.getItem(MIGRATED_KEY) || 'null'); } catch (_) { marker = null; }
      if (marker && marker.hash === hash && backend.persistent) {
        // Moved already (the old key just was not removed): do not bring back sets deleted since.
        try { ls.removeItem(LEGACY_KEY); } catch (_) {}
        return { ok: true, migrated: 0, ids: Array.isArray(marker.ids) ? marker.ids : [] };
      }
      let data;
      try { data = JSON.parse(raw); } catch (_) {
        return Object.assign(plainError('invalid', 'legacy json', 'The session saved by the first Flux Tutor beta could not be read, so it was left where it is.'), { migrated: 0, ids: [] });
      }
      const sets = core.migrateLegacy(data);
      if (!sets.length) return { ok: true, migrated: 0, ids: [] };
      const ids = [];
      let migrated = 0;
      for (let i = 0; i < sets.length; i++) {
        const set = sets[i];
        set.id = 'set-beta-' + hash + '-' + i;
        ids.push(set.id);
        if (await get(set.id)) continue;
        const res = await save(set, { touch: false });
        if (!res.ok) return Object.assign(res, { migrated, ids });
        migrated++;
      }
      // Read every copy back before the old key goes.
      for (const id of ids) {
        if (!(await get(id))) return Object.assign(plainError('write', 'read-back failed'), { migrated, ids });
      }
      if (backend.persistent) {
        try { ls.setItem(MIGRATED_KEY, JSON.stringify({ hash, ids, at: nowIso() })); } catch (_) {}
        try { ls.removeItem(LEGACY_KEY); } catch (_) {}
      }
      return { ok: true, migrated, ids };
    }

    /** Sets saved to localStorage while IndexedDB was unavailable move into IndexedDB. */
    async function adoptLocalSets() {
      if (backend.name !== 'indexeddb' || !ls) return { ok: true, moved: 0 };
      let moved = 0;
      for (const e of lsEntries(ls)) {
        let set = null;
        try { set = core.normalizeSet(JSON.parse(e.text)); } catch (_) { set = null; }
        if (!set || set.id !== e.id) continue;
        const here = await get(set.id);
        if (!here || String(here.updatedAt) < String(set.updatedAt)) {
          const res = await write(set);
          if (!res.ok) continue;
        }
        if (await get(set.id)) {
          try { ls.removeItem(e.key); moved++; } catch (_) {}
        }
      }
      return { ok: true, moved };
    }

    /** Ask the browser to keep this site's storage (fewer evictions). Resolves true/false. */
    async function requestPersist() {
      try {
        const nav = root.navigator;
        if (nav && nav.storage && typeof nav.storage.persist === 'function') return !!(await nav.storage.persist());
      } catch (_) {}
      return false;
    }

    if (typeof root.addEventListener === 'function' && typeof root.document !== 'undefined') {
      root.addEventListener('pagehide', () => { flush(); });
      root.document.addEventListener('visibilitychange', () => { if (root.document.visibilityState === 'hidden') flush(); });
    }

    return {
      backend: backend.name,
      persistent: backend.persistent,
      warning: backend.persistent ? '' : MESSAGES.blocked,
      note: '',
      list, get, save, autosave, flush, hasPending,
      rename, duplicate, remove, restore, purge, purgeDeleted,
      exportSet, exportAll, importText,
      migrateLegacy, adoptLocalSets, requestPersist,
      onStatus(fn) { statusListeners.add(fn); return () => statusListeners.delete(fn); },
      onChange(fn) { changeListeners.add(fn); return () => changeListeners.delete(fn); },
      close() {
        Array.from(pending.keys()).forEach(cancelPending);
        if (channel) { try { channel.close(); } catch (_) {} }
        backend.close();
      },
    };
  }

  root.FluxTutorStore = {
    open, classify, MESSAGES, LEGACY_KEY, MIGRATED_KEY, LS_SET, LS_BUDGET, DB_NAME, BIN_DAYS,
  };
})();
