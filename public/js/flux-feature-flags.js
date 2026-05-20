/**
 * Flux feature flags — server-resolved overrides + local experiments.
 * Requires migration 20260524120000_feature_flags_foundation.sql
 */
(function () {
  'use strict';

  const CACHE_KEY = 'flux_feature_flags_cache_v1';
  const CACHE_MS = 5 * 60 * 1000;

  let _flags = null;
  let _fetchedAt = 0;

  function defaults() {
    return {
      enable_momentum_v2: false,
      enable_cognitive_ui: false,
      enable_teacher_ai: false,
      enable_live_class_mode: false,
      enable_cognitive_predictions: false,
      enable_counselor_insights: false,
      enable_school_command: false,
      enable_parent_portal: false,
      enable_staff_google_hub: true,
      enable_classroom_sync: false,
      enable_event_bus: false,
    };
  }

  function fromCache() {
    try {
      const raw = typeof load === 'function' ? load(CACHE_KEY, null) : null;
      if (!raw || typeof raw !== 'object') return null;
      if (!raw.fetchedAt || Date.now() - raw.fetchedAt > CACHE_MS) return null;
      return raw.flags && typeof raw.flags === 'object' ? raw.flags : null;
    } catch (_) {
      return null;
    }
  }

  function saveCache(flags) {
    try {
      if (typeof save === 'function') save(CACHE_KEY, { fetchedAt: Date.now(), flags });
    } catch (_) {}
  }

  function experimentOverrides() {
    const ex = window.FLUX_EXPERIMENTS || {};
    const o = {};
    Object.keys(ex).forEach((k) => {
      if (k.startsWith('enable_') && typeof ex[k] === 'boolean') o[k] = ex[k];
    });
    return o;
  }

  async function load(opts) {
    const force = !!(opts && opts.force);
    if (!force && _flags && Date.now() - _fetchedAt < CACHE_MS) return _flags;

    const cached = !force ? fromCache() : null;
    if (cached) {
      _flags = { ...defaults(), ...cached, ...experimentOverrides() };
      _fetchedAt = Date.now();
      return _flags;
    }

    let merged = { ...defaults() };
    const sb = typeof window.getSB === 'function' ? window.getSB() : null;
    const u = typeof currentUser !== 'undefined' ? currentUser : window.currentUser;

    if (sb && u?.id) {
      try {
        const { data, error } = await sb.rpc('flux_resolve_feature_flags');
        if (!error && data && typeof data === 'object') {
          merged = { ...merged, ...data };
        }
      } catch (e) {
        console.warn('[FluxFeatureFlags] load', e);
      }
    }

    merged = { ...merged, ...experimentOverrides() };
    _flags = merged;
    _fetchedAt = Date.now();
    saveCache(merged);
    window.FLUX_FEATURE_FLAGS = merged;
    return merged;
  }

  function isEnabled(key, fallback) {
    const k = String(key || '');
    if (_flags && Object.prototype.hasOwnProperty.call(_flags, k)) return !!_flags[k];
    if (typeof fallback === 'boolean') return fallback;
    const d = defaults();
    return !!d[k];
  }

  function all() {
    return _flags ? { ..._flags } : { ...defaults() };
  }

  function clear() {
    _flags = null;
    _fetchedAt = 0;
    try {
      if (typeof save === 'function') save(CACHE_KEY, null);
    } catch (_) {}
  }

  window.FluxFeatureFlags = {
    defaults,
    load,
    isEnabled,
    all,
    clear,
  };
})();
