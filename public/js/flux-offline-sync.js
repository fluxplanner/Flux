/**
 * P7-OFFLINE — offline-first sync: outbox, LWW merge, conflict rules.
 * Flag: enable_offline_sync (default off).
 * Migration: 20260525420000_offline_sync.sql
 */
(function () {
  'use strict';

  const OUTBOX_KEY = 'flux_offline_outbox_v1';
  const CONFLICTS_KEY = 'flux_sync_conflicts_v1';
  const DEVICE_KEY = 'flux_sync_device_id_v1';
  const MERGE_SKEW_MS = 2000;

  function enabled() {
    try {
      return !!window.FluxFeatureFlags?.isEnabled('enable_offline_sync', false);
    } catch (_) {
      return false;
    }
  }

  function load(k, def) {
    if (typeof window.load === 'function') return window.load(k, def);
    try {
      const raw = localStorage.getItem(k);
      return raw ? JSON.parse(raw) : def;
    } catch (_) {
      return def;
    }
  }

  function save(k, v) {
    if (typeof window.save === 'function') window.save(k, v);
    else {
      try {
        localStorage.setItem(k, JSON.stringify(v));
      } catch (_) {}
    }
  }

  function esc(s) {
    if (typeof window.esc === 'function') return window.esc(s);
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function deviceId() {
    let id = load(DEVICE_KEY, null);
    if (id && typeof id === 'string') return id;
    id = 'd_' + Math.random().toString(36).slice(2, 10) + '_' + Date.now().toString(36);
    save(DEVICE_KEY, id);
    return id;
  }

  function stamp(item) {
    if (!item || typeof item !== 'object') return item;
    const ts = Date.now();
    item._fluxTs = ts;
    item._fluxDevice = deviceId();
    item._fluxV = (Number(item._fluxV) || 0) + 1;
    return item;
  }

  function itemTs(item) {
    if (!item) return 0;
    return Number(item._fluxTs) || Number(item.createdAt) || 0;
  }

  function taskFingerprint(t) {
    if (!t) return '';
    return [
      t.name,
      t.date,
      t.done ? 1 : 0,
      t.priority,
      t.subject,
      t.type,
      t.notes,
      t.estTime,
      (t.subtasks || []).length,
    ].join('|');
  }

  function noteFingerprint(n) {
    if (!n) return '';
    return [n.title, (n.body || '').slice(0, 200), n.subject].join('|');
  }

  function eventFingerprint(e) {
    if (!e) return '';
    return [e.title, e.date, e.time, e.notes].join('|');
  }

  function fingerprint(type, item) {
    if (type === 'task') return taskFingerprint(item);
    if (type === 'note') return noteFingerprint(item);
    if (type === 'event') return eventFingerprint(item);
    return JSON.stringify(item);
  }

  function mergeById(localArr, remoteArr, type) {
    const local = Array.isArray(localArr) ? localArr : [];
    const remote = Array.isArray(remoteArr) ? remoteArr : [];
    const map = new Map();
    const fp = (item) => fingerprint(type, item);

    remote.forEach((r) => {
      if (r == null || r.id == null) return;
      map.set(String(r.id), { remote: r });
    });
    local.forEach((l) => {
      if (l == null || l.id == null) return;
      const k = String(l.id);
      const row = map.get(k) || {};
      row.local = l;
      map.set(k, row);
    });

    const merged = [];
    const conflicts = [];

    map.forEach((row, id) => {
      if (row.local && row.local._fluxDeleted && !row.remote) return;
      if (!row.local && row.remote) {
        merged.push(stamp(Object.assign({}, row.remote)));
        return;
      }
      if (row.local && !row.remote) {
        merged.push(stamp(Object.assign({}, row.local)));
        return;
      }
      const lt = itemTs(row.local);
      const rt = itemTs(row.remote);
      if (fp(row.local) === fp(row.remote)) {
        merged.push(stamp(Object.assign({}, row.remote, row.local, { _fluxTs: Math.max(lt, rt) })));
        return;
      }
      if (Math.abs(lt - rt) <= MERGE_SKEW_MS) {
        merged.push(stamp(Object.assign({}, row.remote, row.local, { _fluxTs: Math.max(lt, rt) })));
        return;
      }
      if (lt > rt) {
        merged.push(stamp(Object.assign({}, row.local)));
        return;
      }
      if (rt > lt) {
        merged.push(stamp(Object.assign({}, row.remote)));
        return;
      }
      conflicts.push({
        id: 'c_' + type + '_' + id,
        entityType: type,
        entityId: id,
        local: row.local,
        remote: row.remote,
        at: Date.now(),
      });
      merged.push(stamp(Object.assign({}, row.local)));
    });

    return { merged, conflicts };
  }

  function getConflicts() {
    const c = load(CONFLICTS_KEY, []);
    return Array.isArray(c) ? c : [];
  }

  function setConflicts(list) {
    save(CONFLICTS_KEY, list.slice(-50));
    updateConflictUi();
  }

  function appendConflicts(newOnes) {
    if (!newOnes.length) return;
    const cur = getConflicts();
    const ids = new Set(cur.map((c) => c.id));
    newOnes.forEach((c) => {
      if (!ids.has(c.id)) {
        cur.push(c);
        ids.add(c.id);
      }
    });
    setConflicts(cur);
    persistConflictsServer(newOnes).catch(() => {});
  }

  async function persistConflictsServer(rows) {
    const sb = typeof window.getSB === 'function' ? window.getSB() : null;
    const u = typeof currentUser !== 'undefined' ? currentUser : window.currentUser;
    if (!sb || !u?.id || !rows.length) return;
    try {
      await sb.rpc('flux_record_sync_conflicts', {
        p_rows: rows.map((c) => ({
          entity_type: c.entityType,
          entity_id: String(c.entityId),
        })),
      });
    } catch (e) {
      console.warn('[FluxOfflineSync] conflict log', e);
    }
  }

  function getOutbox() {
    const o = load(OUTBOX_KEY, []);
    return Array.isArray(o) ? o : [];
  }

  function setOutbox(o) {
    save(OUTBOX_KEY, o.slice(-80));
    updateOutboxUi();
  }

  function enqueueOutbox(key) {
    const o = getOutbox();
    const entry = { key, at: Date.now(), device: deviceId() };
    const filtered = o.filter((x) => x.key !== key);
    filtered.push(entry);
    setOutbox(filtered);
  }

  function clearOutboxKey(key) {
    setOutbox(getOutbox().filter((x) => x.key !== key));
  }

  function clearOutbox() {
    setOutbox([]);
  }

  function touchTasks() {
    if (typeof window.tasks === 'undefined' || !Array.isArray(window.tasks)) return;
    window.tasks.forEach((t) => {
      if (t && !t.done) stamp(t);
    });
  }

  function onLocalMutation(key) {
    if (!enabled()) return;
    if (key === 'tasks') touchTasks();
    if (!navigator.onLine || window._fluxSyncFailed) enqueueOutbox(key);
  }

  function beforePush(payload) {
    if (!enabled() || !payload) return payload;
    if (Array.isArray(payload.tasks)) {
      payload.tasks = payload.tasks.map((t) => stamp(Object.assign({}, t)));
    }
    if (Array.isArray(payload.notes)) {
      payload.notes = payload.notes.map((n) => stamp(Object.assign({}, n)));
    }
    if (Array.isArray(payload.events)) {
      payload.events = payload.events.map((e) => stamp(Object.assign({}, e)));
    }
    payload._fluxSyncMeta = {
      device: deviceId(),
      schema: 1,
      at: Date.now(),
    };
    return payload;
  }

  function mergeTasksFromCloud(remoteTasks) {
    const local = typeof window.tasks !== 'undefined' && Array.isArray(window.tasks) ? window.tasks : [];
    const { merged, conflicts } = mergeById(local, remoteTasks, 'task');
    window.tasks = merged;
    save('tasks', merged);
    if (typeof window.migrateCompletedAtBackfill === 'function') window.migrateCompletedAtBackfill();
    appendConflicts(conflicts);
    return { merged, conflicts };
  }

  function mergeNotesFromCloud(remoteNotes) {
    const local = load('flux_notes', []);
    const { merged, conflicts } = mergeById(local, remoteNotes, 'note');
    save('flux_notes', merged);
    if (typeof window.notes !== 'undefined') window.notes = merged;
    appendConflicts(conflicts);
    return { merged, conflicts };
  }

  function mergeEventsFromCloud(remoteEvents) {
    const local = load('flux_events', []);
    const { merged, conflicts } = mergeById(local, remoteEvents, 'event');
    save('flux_events', merged);
    appendConflicts(conflicts);
    return { merged, conflicts };
  }

  /**
   * Merge-aware apply for high-churn keys; returns true if caller should skip legacy overwrite for these keys.
   */
  function applyCloudPayload(d) {
    if (!enabled() || !d) return { applied: false, conflicts: [] };
    const allConflicts = [];
    if (d.tasks) {
      const r = mergeTasksFromCloud(d.tasks);
      allConflicts.push.apply(allConflicts, r.conflicts || []);
    }
    if (d.notes) {
      const r = mergeNotesFromCloud(d.notes);
      allConflicts.push.apply(allConflicts, r.conflicts || []);
    }
    if (d.events) {
      const r = mergeEventsFromCloud(d.events);
      allConflicts.push.apply(allConflicts, r.conflicts || []);
    }
    clearOutbox();
    if (window.FluxBus && typeof FluxBus.emit === 'function') {
      FluxBus.emit('offline_sync_merged', {
        conflicts: allConflicts.length,
        keys: ['tasks', 'notes', 'events'].filter((k) => (k === 'tasks' ? d.tasks : k === 'notes' ? d.notes : d.events)),
      });
    }
    return { applied: true, conflicts: allConflicts };
  }

  function shouldSkipCloudOverwrite(key) {
    return enabled() && (key === 'tasks' || key === 'notes' || key === 'events');
  }

  function resolveConflict(conflictId, choice) {
    const list = getConflicts();
    const idx = list.findIndex((c) => c.id === conflictId);
    if (idx < 0) return false;
    const c = list[idx];
    const pick = choice === 'remote' ? c.remote : c.local;
    if (!pick) return false;

    if (c.entityType === 'task' && typeof window.tasks !== 'undefined') {
      const id = c.entityId;
      window.tasks = window.tasks.filter((t) => String(t.id) !== String(id));
      window.tasks.push(stamp(Object.assign({}, pick)));
      save('tasks', window.tasks);
      if (typeof window.syncKey === 'function') window.syncKey('tasks', window.tasks);
    } else if (c.entityType === 'note') {
      const notes = load('flux_notes', []).filter((n) => String(n.id) !== String(c.entityId));
      notes.push(stamp(Object.assign({}, pick)));
      save('flux_notes', notes);
      if (typeof window.notes !== 'undefined') window.notes = notes;
      if (typeof window.syncKey === 'function') window.syncKey('notes', notes);
    } else if (c.entityType === 'event') {
      const events = load('flux_events', []).filter((e) => String(e.id) !== String(c.entityId));
      events.push(stamp(Object.assign({}, pick)));
      save('flux_events', events);
      if (typeof window.syncKey === 'function') window.syncKey('events', 1);
    }

    list.splice(idx, 1);
    setConflicts(list);
    if (typeof window.renderTasks === 'function') window.renderTasks();
    if (typeof window.renderCalendar === 'function') window.renderCalendar();
    if (typeof window.renderNotesList === 'function') window.renderNotesList();
    return true;
  }

  function renderConflictModal() {
    const list = getConflicts();
    if (!list.length) {
      if (typeof window.showToast === 'function') window.showToast('No sync conflicts', 'info');
      return;
    }
    let host = document.getElementById('fluxOfflineConflictModal');
    if (!host) {
      host = document.createElement('div');
      host.id = 'fluxOfflineConflictModal';
      host.className = 'flux-offline-modal';
      host.setAttribute('role', 'dialog');
      host.setAttribute('aria-modal', 'true');
      document.body.appendChild(host);
    }
    const rows = list
      .map((c) => {
        const label =
          c.entityType === 'task'
            ? esc(c.local?.name || c.remote?.name || 'Task')
            : esc(c.local?.title || c.remote?.title || c.entityType);
        return `<div class="flux-offline-conflict-row" data-id="${esc(c.id)}">
          <div class="flux-offline-conflict-title">${label} <span class="flux-offline-conflict-type">${esc(c.entityType)}</span></div>
          <div class="flux-offline-conflict-actions">
            <button type="button" class="btn sm" data-resolve="local" data-id="${esc(c.id)}">Keep mine</button>
            <button type="button" class="btn sm ghost" data-resolve="remote" data-id="${esc(c.id)}">Keep cloud</button>
          </div>
        </div>`;
      })
      .join('');

    host.innerHTML = `<div class="flux-offline-modal-inner">
      <div class="flux-offline-modal-head"><h3>Sync conflicts</h3>
        <button type="button" class="btn sm ghost" id="fluxOfflineConflictClose">✕</button>
      </div>
      <p class="flux-offline-modal-lede">Same item changed on two devices. Pick a version.</p>
      ${rows}
    </div>`;

    host.style.display = 'flex';
    host.querySelector('#fluxOfflineConflictClose')?.addEventListener('click', () => {
      host.style.display = 'none';
    });
    host.querySelectorAll('[data-resolve]').forEach((btn) => {
      btn.addEventListener('click', () => {
        resolveConflict(btn.getAttribute('data-id'), btn.getAttribute('data-resolve'));
        if (!getConflicts().length) host.style.display = 'none';
        else renderConflictModal();
      });
    });
  }

  function updateConflictUi() {
    const n = getConflicts().length;
    const pill = document.getElementById('fluxOfflineConflictPill');
    if (pill) {
      pill.style.display = n ? 'inline-flex' : 'none';
      pill.textContent = n ? `${n} conflict${n > 1 ? 's' : ''}` : '';
    }
    const banner = document.getElementById('connectivityBanner');
    if (banner && n && navigator.onLine) {
      banner.style.display = 'block';
      banner.dataset.state = 'conflict';
      banner.innerHTML = `${n} sync conflict${n > 1 ? 's' : ''} — <button type="button" class="flux-offline-inline-btn" id="fluxOfflineResolveBtn">Resolve</button>`;
      document.getElementById('fluxOfflineResolveBtn')?.addEventListener('click', renderConflictModal);
    } else if (typeof window.updateConnectivityBanner === 'function') {
      window.updateConnectivityBanner();
    }
  }

  function updateOutboxUi() {
    const n = getOutbox().length;
    const el = document.getElementById('fluxOfflineOutboxPill');
    if (el) {
      el.style.display = n ? 'inline-flex' : 'none';
      el.textContent = n ? `${n} pending` : '';
    }
  }

  function ensureUiChrome() {
    const syncEl = document.getElementById('syncIndicator');
    if (!syncEl || document.getElementById('fluxOfflineConflictPill')) return;
    const pill = document.createElement('span');
    pill.id = 'fluxOfflineConflictPill';
    pill.className = 'flux-offline-pill';
    pill.title = 'Sync conflicts';
    pill.addEventListener('click', renderConflictModal);
    syncEl.parentNode?.insertBefore(pill, syncEl.nextSibling);
    const out = document.createElement('span');
    out.id = 'fluxOfflineOutboxPill';
    out.className = 'flux-offline-pill flux-offline-pill--outbox';
    out.title = 'Pending offline changes';
    pill.parentNode?.insertBefore(out, pill.nextSibling);
    updateConflictUi();
    updateOutboxUi();
  }

  function flushOutbox() {
    if (!enabled() || !navigator.onLine) return;
    const o = getOutbox();
    if (!o.length) return;
    if (typeof window.flushPendingSyncToCloud === 'function') window.flushPendingSyncToCloud();
    else if (typeof window.syncToCloud === 'function') void window.syncToCloud();
  }

  function install() {
    if (!enabled()) return false;
    ensureUiChrome();
    if (!window._fluxOfflineOnlineHook) {
      window._fluxOfflineOnlineHook = true;
      window.addEventListener('online', () => {
        flushOutbox();
      });
    }
    return true;
  }

  window.FluxOfflineSync = {
    enabled,
    install,
    deviceId,
    stamp,
    onLocalMutation,
    beforePush,
    applyCloudPayload,
    shouldSkipCloudOverwrite,
    mergeTasksFromCloud,
    getConflicts,
    resolveConflict,
    renderConflictModal,
    flushOutbox,
    getOutbox,
  };
})();
