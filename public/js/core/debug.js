/**
 * FluxDebug — canonical dev diagnostics for Flux Planner.
 * Load BEFORE public/js/app.js (see index.html).
 *
 * Enable (any):
 *   localStorage.setItem('flux_debug','on')   // master quiet-friendly switch
 *   localStorage.setItem('FLUX_DEBUG','1')    // legacy master
 *   window.FLUX_DEBUG = true                    // session-only master
 *
 * Scoped (localStorage value '1'):
 *   FLUX_DEBUG_NAV, FLUX_DEBUG_ROLE, FLUX_DEBUG_IMP, FLUX_DEBUG_BUS,
 *   FLUX_DEBUG_STORAGE, FLUX_DEBUG_AI, FLUX_DEBUG_PANEL, FLUX_DEBUG_SYNC, FLUX_DEBUG_PERF
 *
 * No console spam unless one of the above is set.
 */
(function () {
  /** Debug flags use unprefixed keys (device-global; not per-impersonation bubble). */
  function lsGet(k) {
    try {
      return localStorage.getItem(k);
    } catch (e) {
      return null;
    }
  }

  function masterOn() {
    try {
      if (typeof window !== 'undefined' && window.FLUX_DEBUG === true) return true;
      if (lsGet('flux_debug') === 'on') return true;
      if (lsGet('FLUX_DEBUG') === '1') return true;
    } catch (e) {}
    return false;
  }

  function onFlag(sub) {
    if (masterOn()) return true;
    if (!sub) return false;
    try {
      if (lsGet('FLUX_DEBUG_' + String(sub).toUpperCase()) === '1') return true;
    } catch (e) {}
    return false;
  }

  var _throttle = Object.create(null);
  function throttle(key, ms) {
    var t = Date.now();
    var last = _throttle[key] || 0;
    if (t - last < ms) return false;
    _throttle[key] = t;
    return true;
  }

  function nsKey(k) {
    try {
      if (typeof fluxNamespacedKey === 'function') return fluxNamespacedKey(k);
    } catch (e) {}
    return String(k);
  }

  function impPre() {
    try {
      if (typeof fluxImpersonationPrefix === 'function') return fluxImpersonationPrefix();
    } catch (e) {}
    return '';
  }

  window.FluxDebug = {
    __fromCoreModule: true,

    on: onFlag,

    /** Namespaced log: category mirrors FLUX_DEBUG_<CATEGORY> keys (uppercase). */
    log: function (category, msg, payload) {
      if (!masterOn() && !onFlag(category)) return;
      var line = '[Flux:' + String(category || 'log') + '] ' + String(msg || '');
      if (payload !== undefined) console.log(line, payload);
      else console.log(line);
    },

    timeStart: function (label) {
      if (!onFlag('PERF')) return;
      FluxDebug._marks = FluxDebug._marks || Object.create(null);
      FluxDebug._marks[label] = performance.now();
    },

    timeEnd: function (label) {
      if (!onFlag('PERF')) return;
      var m = FluxDebug._marks || {};
      var t0 = m[label];
      if (t0 == null) return;
      var ms = Math.round(performance.now() - t0);
      console.log('[FluxPerf]', { label: label, ms: ms });
    },

    traceStorage: function (op, key) {
      if (!onFlag('STORAGE')) return;
      if (!throttle('s:' + op + ':' + String(key), 900)) return;
      var pre = '';
      var nk = '';
      try {
        pre = impPre() || '';
      } catch (e) {}
      try {
        nk = nsKey(key);
      } catch (e) {
        nk = String(key);
      }
      console.log('[FluxStorage]', { op: op, key: key, impPrefix: pre || '(none)', namespacedKey: nk });
    },

    navStart: function (payload) {
      if (!onFlag('NAV')) return;
      console.log('[FluxNav:start]', payload);
    },

    navEnd: function (payload) {
      if (!onFlag('NAV')) return;
      console.log('[FluxNav:end]', payload);
    },

    tracePanels: function (detail) {
      if (!onFlag('PANEL') && !masterOn()) return;
      if (!throttle('panel:' + String(detail && detail.finalId), 120)) return;
      console.log('[FluxPanel]', detail);
    },

    traceRoute: function (msg, detail) {
      if (!onFlag('ROUTE')) return;
      console.log('[FluxRoute]', msg, detail || '');
    },

    traceRole: function (msg, detail) {
      if (!onFlag('ROLE')) return;
      console.log('[FluxRoleTrace]', msg, detail || '');
    },

    traceSync: function (msg, detail) {
      if (!onFlag('SYNC')) return;
      if (!throttle('sync:' + String(msg), 500)) return;
      console.log('[FluxSync]', msg, detail || '');
    },

    traceBusEmit: function (e, d) {
      if (!onFlag('BUS')) return;
      if (!throttle('bus:' + e, 1400)) return;
      var n = 0;
      try {
        n = window.FluxBus && FluxBus._h && FluxBus._h[e] ? FluxBus._h[e].length : 0;
      } catch (err) {}
      var hint = d && typeof d === 'object' && 'id' in d ? { id: d.id } : undefined;
      console.log('[FluxBus:emit]', { e: e, listeners: n, extra: hint });
    },

    ai: function (ev, payload) {
      if (!onFlag('AI')) return;
      if (!throttle('ai:' + ev, 400)) return;
      console.log('[FluxAI:' + ev + ']', payload);
    },
  };

  /** Safe experiment toggles — mutate in devtools, e.g. FLUX_EXPERIMENTS.routingAssertDupPanel = true */
  window.FLUX_EXPERIMENTS = window.FLUX_EXPERIMENTS || {
    routingAssertDupPanel: false,
    storageWarnRawAccess: false,
    aiSingleStreamController: false,
  };
})();
