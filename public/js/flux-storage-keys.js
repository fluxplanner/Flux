/**
 * Flux storage key registry + planner read/write helpers (P1-STORAGE).
 * Canonical persistence: load() / save() from app.js (namespacing + impersonation).
 */
(function () {
  'use strict';

  /** Keys that stay unprefixed (device / auth / owner). Mirrors app.js denylist. */
  const GLOBAL_EXACT = new Set([
    'flux_owner_impersonate',
    'flux_data_version',
    'flux_splash_shown',
    'flux_last_user_id',
    'flux_last_user_email',
    'flux_feature_flags_cache_v1',
  ]);

  /** Logical key prefixes that stay unprefixed (may include dynamic suffixes). */
  const GLOBAL_PREFIXES = [
    'flux_staff_mode_',
    'flux_feature_flags_cache_v1_',
    'flux_canvas_',
    'flux_extension_',
    'flux_ai_connections_',
    'flux_ai_model_route_',
    'sb-',
  ];

  /** Phase 1+ platform keys — must use load/save, not raw localStorage. */
  const PLATFORM = {
    featureFlagsCache: 'flux_feature_flags_cache_v1',
    staffModePrefix: 'flux_staff_mode_',
    momentumV2: 'flux_momentum_v2_v1',
    cognitiveV2Last: 'flux_cognitive_v2_last_v1',
    featureFlagsCacheMs: 5 * 60 * 1000,
  };

  function currentUserId() {
    const u = typeof currentUser !== 'undefined' ? currentUser : window.currentUser;
    return u && u.id ? String(u.id) : '';
  }

  function userKey(base, userId) {
    const uid = userId || currentUserId();
    if (!uid) return String(base);
    return `${String(base)}_${uid}`;
  }

  function isGlobalLogicalKey(key) {
    const k = String(key || '');
    if (!k) return false;
    if (GLOBAL_EXACT.has(k)) return true;
    for (let i = 0; i < GLOBAL_PREFIXES.length; i++) {
      if (k.indexOf(GLOBAL_PREFIXES[i]) === 0) return true;
    }
    try {
      if (typeof window.fluxNamespacedKey === 'function') {
        return window.fluxNamespacedKey(k) === k;
      }
    } catch (_) {}
    return false;
  }

  function plannerLoad(key, fallback) {
    try {
      if (typeof window.load === 'function') return window.load(key, fallback);
    } catch (_) {}
    return fallback;
  }

  function plannerSave(key, value) {
    try {
      if (typeof window.save === 'function') window.save(key, value);
    } catch (_) {}
  }

  function featureFlagsCacheKey(userId) {
    return userKey(PLATFORM.featureFlagsCache, userId);
  }

  /** Matches FluxRole: `flux_staff_mode_<userId>` */
  function staffModeKeyFor(userId) {
    const uid = userId || currentUserId();
    return uid ? `${PLATFORM.staffModePrefix}${uid}` : 'flux_staff_mode';
  }

  /** Dev: list physical keys not matching known patterns (for audits). */
  function auditStragglers() {
    const rows = [];
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (!k) continue;
        if (k.startsWith('sb-') || k.includes('supabase')) continue;
        if (k === 'flux_debug' || k.indexOf('FLUX_DEBUG') === 0) continue;
        const logical = k.includes('imp:') ? k.split(':').slice(2).join(':') : k;
        const known =
          GLOBAL_EXACT.has(logical) ||
          GLOBAL_PREFIXES.some((p) => logical.indexOf(p) === 0) ||
          logical === 'tasks' ||
          logical.indexOf('flux_') === 0;
        if (!known) rows.push({ key: k, logical });
      }
    } catch (e) {
      return { error: String(e.message || e), rows: [] };
    }
    if (rows.length) console.warn('[FluxStorageKeys] possible stragglers', rows);
    else console.log('[FluxStorageKeys] audit: no unknown keys');
    return rows;
  }

  window.FluxStorageKeys = {
    PLATFORM,
    GLOBAL_EXACT,
    GLOBAL_PREFIXES,
    userKey,
    isGlobalLogicalKey,
    plannerLoad,
    plannerSave,
    featureFlagsCacheKey,
    staffModeKeyFor,
    auditStragglers,
  };
})();
