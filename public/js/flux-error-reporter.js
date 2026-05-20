/**
 * P8-ERRORS — privacy-scrubbed client error capture.
 * Flag: enable_client_error_reporting (default off).
 * Server persist: client_error via FluxEventBus when enable_event_bus is also on.
 */
(function () {
  'use strict';

  const RING_KEY = 'flux_error_ring_v1';
  const RING_MAX = 20;
  const SERVER_CAP = 5;
  const SERVER_WINDOW_MS = 60_000;

  let _installed = false;
  let _serverSent = 0;
  let _serverWindowStart = 0;

  function enabled() {
    try {
      return !!window.FluxFeatureFlags?.isEnabled('enable_client_error_reporting', false);
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

  function trunc(s, n) {
    const t = String(s || '');
    return t.length > n ? t.slice(0, n) : t;
  }

  function scrubMessage(msg) {
    return trunc(
      String(msg || 'unknown')
        .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[email]')
        .replace(/\bBearer\s+\S+/gi, '[token]')
        .replace(/\bsk-[a-zA-Z0-9_-]{8,}\b/gi, '[secret]'),
      240,
    );
  }

  function basename(url) {
    try {
      const p = new URL(String(url), window.location.origin).pathname;
      const parts = p.split('/').filter(Boolean);
      return parts.length ? parts[parts.length - 1] : p || 'inline';
    } catch (_) {
      return trunc(url, 80);
    }
  }

  function pushRing(entry) {
    const ring = Array.isArray(load(RING_KEY, [])) ? load(RING_KEY, []) : [];
    ring.unshift(entry);
    save(RING_KEY, ring.slice(0, RING_MAX));
  }

  function canSendServer() {
    const now = Date.now();
    if (now - _serverWindowStart > SERVER_WINDOW_MS) {
      _serverWindowStart = now;
      _serverSent = 0;
    }
    if (_serverSent >= SERVER_CAP) return false;
    _serverSent += 1;
    return true;
  }

  function persistServer(payload) {
    try {
      if (!window.FluxFeatureFlags?.isEnabled('enable_event_bus', false)) return;
      if (!canSendServer()) return;
      if (window.FluxEventBus && typeof FluxEventBus.record === 'function') {
        FluxEventBus.record('client_error', payload, { source: 'error_reporter' });
      }
    } catch (_) {}
  }

  function capture(kind, detail) {
    if (!enabled()) return;
    const entry = {
      at: Date.now(),
      kind: trunc(kind, 32),
      message: scrubMessage(detail.message),
      source: trunc(basename(detail.source), 96),
      line: detail.line != null ? Number(detail.line) : null,
      col: detail.col != null ? Number(detail.col) : null,
    };
    pushRing(entry);
    persistServer(entry);
    try {
      if (window.FluxDebug?.on?.('ERR') || window.FluxDebug?.on?.()) {
        console.warn('[FluxErrorReporter]', entry);
      }
    } catch (_) {}
  }

  function onError(msg, source, line, col) {
    capture('error', { message: msg, source, line, col });
  }

  function onRejection(ev) {
    const reason = ev && ev.reason;
    const message =
      reason && typeof reason === 'object' && reason.message
        ? reason.message
        : String(reason || 'unhandledrejection');
    capture('unhandledrejection', { message, source: 'promise', line: null, col: null });
  }

  function install() {
    if (_installed || !enabled()) return false;
    window.addEventListener('error', (ev) => {
      if (ev.defaultPrevented) return;
      onError(ev.message, ev.filename, ev.lineno, ev.colno);
    });
    window.addEventListener('unhandledrejection', onRejection);
    _installed = true;
    return true;
  }

  function ring() {
    return load(RING_KEY, []);
  }

  function clearRing() {
    save(RING_KEY, []);
  }

  window.FluxErrorReporter = {
    enabled,
    install,
    ring,
    clearRing,
    capture,
  };
})();
