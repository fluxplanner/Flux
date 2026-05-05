/**
 * Unified planner snapshot for modules + optional `flux_data_v1` blob.
 * Canonical source of truth remains the same keys `app.js` already uses:
 * tasks, flux_events, flux_notes, flux_mood — so cloud sync and legacy
 * flows keep working. We dual-write the blob for portable reads / future migration.
 */

export const STORAGE_KEY = 'flux_data_v1';

const LEGACY = {
  tasks: 'tasks',
  events: 'flux_events',
  notes: 'flux_notes',
  moodHistory: 'flux_mood',
};

function parseJson(key, fallback) {
  try {
    const v = localStorage.getItem(key);
    return v ? JSON.parse(v) : fallback;
  } catch {
    return fallback;
  }
}

function setJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
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
    const blob = localStorage.getItem(STORAGE_KEY);
    if (blob) {
      JSON.parse(blob);
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
