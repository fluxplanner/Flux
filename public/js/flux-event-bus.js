/**
 * Flux product event bus — extends FluxBus with optional server persistence.
 * Calendar events remain in localStorage key `flux_events` (unrelated).
 * Requires migration 20260524140000_flux_product_events_skeleton.sql
 * Flag: enable_event_bus (default off — no server writes until enabled).
 */
(function () {
  'use strict';

  function persistAllowlist() {
    if (window.FluxTelemetry && typeof FluxTelemetry.persistAllowlist === 'function') {
      return FluxTelemetry.persistAllowlist();
    }
    return new Set(['task_completed', 'session_ended', 'momentum_update', 'school_joined', 'class_joined', 'sign_in']);
  }
  const FLUSH_MS = 2000;
  const MAX_QUEUE = 25;

  let _queue = [];
  let _flushTimer = null;
  let _installed = false;
  let _origEmit = null;

  function enabled() {
    try {
      return !!window.FluxFeatureFlags?.isEnabled('enable_event_bus', false);
    } catch (_) {
      return false;
    }
  }

  function enqueue(eventName, payload, source) {
    if (!enabled()) return;
    const allow = persistAllowlist();
    const norm =
      window.FluxTelemetry && typeof FluxTelemetry.normalize === 'function'
        ? FluxTelemetry.normalize(eventName, payload)
        : null;
    if (!norm || !allow.has(norm.event_name)) return;
    if (_queue.length >= MAX_QUEUE) _queue.shift();
    _queue.push({
      event_name: norm.event_name,
      payload: norm.payload,
      source: source || 'client',
    });
    if (!_flushTimer) {
      _flushTimer = setTimeout(() => {
        _flushTimer = null;
        flush().catch(() => {});
      }, FLUSH_MS);
    }
  }

  async function flush() {
    if (!enabled() || !_queue.length) return { ok: true, skipped: true };
    const batch = _queue.splice(0, MAX_QUEUE);
    const sb = typeof window.getSB === 'function' ? window.getSB() : null;
    const u = typeof currentUser !== 'undefined' ? currentUser : window.currentUser;
    if (!sb || !u?.id) {
      _queue = batch.concat(_queue).slice(-MAX_QUEUE);
      return { ok: false, error: 'no_session' };
    }
    try {
      const { data, error } = await sb.rpc('flux_record_product_events', { p_events: batch });
      if (error) throw error;
      return data || { ok: true };
    } catch (e) {
      console.warn('[FluxEventBus] flush', e);
      _queue = batch.concat(_queue).slice(-MAX_QUEUE);
      return { ok: false, error: String(e.message || e) };
    }
  }

  function record(eventName, payload, opts) {
    enqueue(eventName, payload, opts && opts.source);
  }

  function install() {
    if (_installed || !window.FluxBus || typeof FluxBus.emit !== 'function') return false;
    _origEmit = FluxBus.emit.bind(FluxBus);
    FluxBus.emit = function (e, d) {
      _origEmit(e, d);
      enqueue(e, d, 'bus');
    };
    FluxBus.record = record;
    FluxBus.flushEvents = flush;
    FluxBus.persistAllowlist = persistAllowlist();
    _installed = true;
    if (enabled()) record('sign_in', { via: 'install' });
    return true;
  }

  function uninstall() {
    if (!_installed || !_origEmit) return;
    FluxBus.emit = _origEmit;
    delete FluxBus.record;
    delete FluxBus.flushEvents;
    delete FluxBus.persistAllowlist;
    _installed = false;
    _origEmit = null;
  }

  window.FluxEventBus = {
    persistAllowlist,
    enabled,
    install,
    uninstall,
    record,
    flush,
  };
})();
