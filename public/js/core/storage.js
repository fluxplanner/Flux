/**
 * Unified planner snapshot for modules + optional `flux_data_v1` blob.
 * Canonical source of truth remains the same keys `app.js` already uses:
 * tasks, flux_events, flux_notes, flux_mood — so cloud sync and legacy
 * flows keep working. We dual-write the blob for portable reads / future migration.
 *
 * When `window.FluxStorage` from `app.js` is present, reads/writes delegate to
 * `load`/`save` (impersonation + `fluxNamespacedKey`). Otherwise fall back to
 * `localStorage` + `fluxNamespacedKey` when that global exists.
 */

export const STORAGE_KEY = 'flux_data_v1';

const LEGACY = {
  tasks: 'tasks',
  events: 'flux_events',
  notes: 'flux_notes',
  moodHistory: 'flux_mood',
};

function nsKey(k) {
  try {
    if (typeof window !== 'undefined' && typeof window.fluxNamespacedKey === 'function') {
      return window.fluxNamespacedKey(k);
    }
  } catch {
    /* ignore */
  }
  return k;
}

function parseJson(key, fallback) {
  try {
    const fs = typeof window !== 'undefined' ? window.FluxStorage : null;
    if (fs && typeof fs.load === 'function') {
      return fs.load(key, fallback);
    }
    const v = localStorage.getItem(nsKey(key));
    if (!v) return fallback;
    try {
      return JSON.parse(v);
    } catch {
      return fallback;
    }
  } catch {
    return fallback;
  }
}

function setJson(key, value) {
  try {
    const fs = typeof window !== 'undefined' ? window.FluxStorage : null;
    if (fs && typeof fs.save === 'function') {
      fs.save(key, value);
      return;
    }
    localStorage.setItem(nsKey(key), JSON.stringify(value));
  } catch (e) {
    console.warn('Storage full', e);
  }
}

function normalizeData(d) {
  return {
    tasks: Array.isArray(d.tasks) ? d.tasks : [],
    events: Array.isArray(d.events) ? d.events : [],
    notes: Array.isArray(d.notes) ? d.notes : [],
    moodHistory: Array.isArray(d.moodHistory) ? d.moodHistory : [],
  };
}

/** Read planner slices from legacy keys (always fresh vs. app memory). */
export function loadData() {
  const fromLegacy = normalizeData({
    tasks: parseJson(LEGACY.tasks, []),
    events: parseJson(LEGACY.events, []),
    notes: parseJson(LEGACY.notes, []),
    moodHistory: parseJson(LEGACY.moodHistory, []),
  });
  try {
    const fs = typeof window !== 'undefined' ? window.FluxStorage : null;
    if (fs && typeof fs.load === 'function') {
      fs.load(STORAGE_KEY, null);
    } else {
      const blob = localStorage.getItem(nsKey(STORAGE_KEY));
      if (blob) JSON.parse(blob);
    }
  } catch {
    /* ignore corrupt blob */
  }
  return fromLegacy;
}

function mirrorToLegacy(data) {
  const n = normalizeData(data);
  setJson(STORAGE_KEY, n);
  setJson(LEGACY.tasks, n.tasks);
  setJson(LEGACY.events, n.events);
  setJson(LEGACY.notes, n.notes);
  setJson(LEGACY.moodHistory, n.moodHistory);
}

export function saveData(data) {
  mirrorToLegacy(data);
  notifyCloudSync(normalizeData(data));
}

export function updateData(updater) {
  const current = loadData();
  const updated = normalizeData(updater({ ...current }));
  mirrorToLegacy(updated);
  notifyCloudSync(updated);
  return updated;
}

function notifyCloudSync(n) {
  try {
    const sync = typeof window !== 'undefined' ? window.__fluxSyncKey : null;
    if (typeof sync !== 'function') return;
    sync('tasks', n.tasks);
    sync('notes', n.notes);
    sync('events', 1);
    sync('moodHistory', n.moodHistory);
  } catch {
    /* ignore */
  }
}
