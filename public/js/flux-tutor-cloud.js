/* ============================================================================
   FLUX TUTOR · CLOUD  ·  flux-tutor-cloud.js
   Keeps Flux Tutor the same on every device the student signs in on: each
   study set and the profile (subjects, XP, streak, Daily 5) is one row of
   public.flux_tutor_sync, readable and writable only by its owner (RLS).

   WHEN A ROW AND THE DEVICE DISAGREE
   ----------------------------------
   What was last synced is remembered per item as a fingerprint
   (localStorage flux_tutor_cloud_state). Changed only here: push it.
   Changed only in the cloud: take it. Changed in both: the copy changed most
   recently wins for a set; the profile is merged (more XP, more answers,
   steps from both), so studying on two devices never loses progress.
   Sets deleted more than 30 days ago are removed from the cloud too.

   Without a sign-in nothing happens: the sets stay in this browser, as before.
   ========================================================================== */
(function () {
  'use strict';
  if (window.FluxTutorCloud) return;

  const STATE_KEY = 'flux_tutor_cloud_state';
  const PROFILE_KEY = 'flux_tutor_profile.v1';
  const TABLE = 'flux_tutor_sync';
  const MAX_BYTES = 1900000;
  const BIN_DAYS = 30;
  let deps = null;          // { store, AI, onPulled }
  let running = null;
  let again = false;
  let timer = 0;
  let status = { state: 'off', at: '', message: '' };
  const listeners = new Set();

  function SB() { return window.FluxSB || {}; }
  function readLs(k, d) { try { const r = localStorage.getItem(k); return r ? JSON.parse(r) : d; } catch (_) { return d; } }
  function writeLs(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (_) { /* full */ } }
  function hash(text) {
    let h = 0x811c9dc5;
    for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
    return ('0000000' + h.toString(16)).slice(-8) + ':' + text.length;
  }
  function setStatus(state, message) {
    status = { state, at: new Date().toISOString(), message: message || '' };
    listeners.forEach((fn) => { try { fn(status); } catch (_) { /* listener */ } });
  }

  async function rest(tok, path, opts) {
    const o = opts || {};
    const headers = { apikey: SB().anon, Authorization: 'Bearer ' + tok, 'Content-Type': 'application/json' };
    if (o.prefer) headers.Prefer = o.prefer;
    const res = await fetch(SB().url + '/rest/v1/' + path, { method: o.method || 'GET', headers, body: o.body ? JSON.stringify(o.body) : undefined });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      const e = new Error((j && (j.message || j.hint)) || ('Sync failed (' + res.status + ')'));
      e.status = res.status;
      e.code = j && j.code;
      throw e;
    }
    return res.status === 204 ? null : res.json().catch(() => null);
  }

  /* ── The profile ────────────────────────────────────────────────────── */

  function maxMap(a, b) {
    const out = Object.assign({}, a || {});
    Object.keys(b || {}).forEach((k) => { out[k] = Math.max(Number(out[k]) || 0, Number(b[k]) || 0); });
    return out;
  }
  /** Two devices' profiles in one: the newer one's choices, the most of every count. */
  function mergeProfile(local, remote) {
    if (!remote) return local;
    if (!local) return remote;
    const newer = (remote.updatedAt || '') > (local.updatedAt || '') ? remote : local;
    const out = Object.assign({}, newer);
    out.xp = Math.max(Number(local.xp) || 0, Number(remote.xp) || 0);
    out.answered = maxMap(local.answered, remote.answered);
    out.right = maxMap(local.right, remote.right);
    out.steps = Object.assign({}, remote.steps || {}, local.steps || {});
    const dl = local.daily;
    const dr = remote.daily;
    out.daily = !dl ? dr : !dr ? dl : dl.day > dr.day ? dl : dr.day > dl.day ? dr : (dl.done ? dl : dr);
    out.updatedAt = newer.updatedAt;
    return out;
  }

  /* ── One sync ───────────────────────────────────────────────────────── */

  async function del(tok, id) {
    return rest(tok, TABLE + '?item_id=eq.' + encodeURIComponent(id), { method: 'DELETE' });
  }
  async function syncOnce() {
    const { store, AI } = deps;
    const sess = AI && AI.signedIn() ? await AI.session() : null;
    if (!sess) { setStatus('off'); return null; }
    const uid = sess.user && sess.user.id;
    const tok = sess.token;
    setStatus('syncing');
    let state = readLs(STATE_KEY, {});
    // The fingerprints belong to one account: another account starts afresh.
    if (uid && state.__owner && state.__owner !== uid) state = {};
    if (uid) state.__owner = uid;
    let rows;
    try {
      rows = (await rest(tok, TABLE + '?select=item_id,kind,data,updated_at&order=updated_at.asc&limit=500')) || [];
    } catch (e) {
      // No table yet, or offline: stay quiet and keep working in this browser.
      setStatus(e.status === 404 || e.code === 'PGRST205' || e.code === '42P01' ? 'unavailable' : 'error', e.message);
      return null;
    }
    let pulled = 0;
    let pushed = 0;
    const now = Date.now();
    const live = await store.list();
    const bin = await store.list({ deleted: true });
    const metas = [].concat(live.ok ? live.sets : [], bin.ok ? bin.sets : []);
    const localIds = new Set(metas.map((m) => m.id));
    const touched = new Set();

    /* Sets from the cloud */
    for (const r of rows) {
      if (r.kind !== 'set' || !r.data || typeof r.data !== 'object') continue;
      const id = r.item_id;
      const deletedAt = Date.parse(r.data.deletedAt || '');
      if (Number.isFinite(deletedAt) && now - deletedAt > BIN_DAYS * 864e5) {
        try { await del(tok, id); delete state[id]; } catch (_) { /* next time */ }
        continue;
      }
      const rh = hash(JSON.stringify(r.data));
      const seen = state[id];
      if (seen && seen.h === rh && seen.at === r.updated_at) continue;
      if (!localIds.has(id) && seen) {
        // Synced before and gone from this device: deleted for good here.
        try { await del(tok, id); delete state[id]; } catch (_) { /* next time */ }
        continue;
      }
      const local = localIds.has(id) ? await store.get(id) : null;
      const lh = local ? hash(JSON.stringify(local)) : '';
      if (local && lh === rh) { state[id] = { h: rh, at: r.updated_at }; continue; }
      const localChanged = local && (!seen || seen.h !== lh);
      if (localChanged) {
        const lt = Math.max(Date.parse(local.updatedAt) || 0, Date.parse(local.deletedAt) || 0);
        const rt = Math.max(Date.parse(r.data.updatedAt) || 0, Date.parse(r.data.deletedAt) || 0);
        if (lt >= rt) continue;           // this device's copy is newer: pushed below
      }
      const res = await store.save(r.data, { touch: false, force: true });
      if (res && res.ok) {
        const now2 = await store.get(id);
        state[id] = { h: now2 ? hash(JSON.stringify(now2)) : rh, at: r.updated_at };
        touched.add(id);
        localIds.add(id);
        pulled++;
      }
    }

    /* Sets changed on this device */
    for (const m of metas) {
      if (touched.has(m.id)) continue;
      const set = await store.get(m.id);
      if (!set) continue;
      const text = JSON.stringify(set);
      const h = hash(text);
      if (state[m.id] && state[m.id].h === h) continue;
      if (text.length > MAX_BYTES) { state[m.id] = { h, at: '', tooBig: true }; continue; }
      try {
        const out = await rest(tok, TABLE + '?on_conflict=user_id,item_id', { method: 'POST', prefer: 'resolution=merge-duplicates,return=representation', body: [{ item_id: m.id, kind: 'set', data: set }] });
        state[m.id] = { h, at: out && out[0] ? out[0].updated_at : '' };
        pushed++;
      } catch (e) { setStatus('error', e.message); }
    }

    /* The profile: merged, so progress from both devices adds up */
    const pr = rows.find((r) => r.item_id === 'profile');
    const lp = readLs(PROFILE_KEY, null);
    const merged = mergeProfile(lp, pr && pr.data);
    if (merged) {
      const mh = hash(JSON.stringify(merged));
      if (!lp || hash(JSON.stringify(lp)) !== mh) { writeLs(PROFILE_KEY, merged); pulled++; }
      if (!pr || hash(JSON.stringify(pr.data)) !== mh) {
        try {
          await rest(tok, TABLE + '?on_conflict=user_id,item_id', { method: 'POST', prefer: 'resolution=merge-duplicates', body: [{ item_id: 'profile', kind: 'profile', data: merged }] });
          pushed++;
        } catch (e) { setStatus('error', e.message); }
      }
    }
    writeLs(STATE_KEY, state);
    if (status.state !== 'error') setStatus('synced');
    if (pulled && typeof deps.onPulled === 'function') deps.onPulled();
    return { pulled, pushed };
  }

  function sync() {
    if (!deps) return Promise.resolve(null);
    if (running) { again = true; return running; }
    running = syncOnce().catch((e) => { setStatus('error', e && e.message); return null; }).finally(() => {
      running = null;
      if (again) { again = false; soon(); }
    });
    return running;
  }
  /** After a change: sync in a few seconds (many quick changes make one sync). */
  function soon(ms) {
    if (!deps) return;
    clearTimeout(timer);
    timer = setTimeout(sync, ms == null ? 4000 : ms);
  }
  /** A set deleted for good on this device: gone from the cloud as well. */
  async function remove(id) {
    const state = readLs(STATE_KEY, {});
    const had = !!state[id];
    delete state[id];
    writeLs(STATE_KEY, state);
    const AI = deps && deps.AI;
    const sess = had && AI && AI.signedIn() ? await AI.session() : null;
    if (!sess) return;
    try { await del(sess.token, id); } catch (_) { /* the next sync tries again */ }
  }
  function start(d) {
    deps = d;
    d.store.onStatus((s) => { if (s === 'saved' || (s && s.state === 'saved')) soon(); });
    window.addEventListener('flux-tutor:profile', () => soon());
    window.addEventListener('flux-tutor:signin', () => soon(0));
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') soon(500); });
    soon(800);
  }

  window.FluxTutorCloud = {
    start, sync, soon, remove, mergeProfile,
    status: () => status,
    onStatus: (fn) => { listeners.add(fn); return () => listeners.delete(fn); },
  };
})();
