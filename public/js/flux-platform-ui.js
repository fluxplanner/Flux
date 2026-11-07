/**
 * Flux · Platform UI — owner-controlled, applies to every planner.
 *
 * Reads public.platform_settings (key = 'ui'), which holds a list of sidebar
 * tabs to hide for everyone. That table is world-readable and has no write
 * policy; the owner writes to it through the release-admin Edge Function,
 * which checks FLUX_OWNER_EMAIL and uses the service role.
 *
 * This is distinct from two things that already existed and are NOT global:
 *   - tabConfig / 'flux_tabs'       — each user hiding tabs for themselves
 *   - platformConfig / owner-suite  — owner-local, pushed only to dev rows
 *
 * Applying is cache-first: the last known list is read from localStorage and
 * applied synchronously, then refreshed from the network. Without that a hidden
 * tab flashes on screen every cold load before the fetch resolves.
 *
 * Self-contained IIFE. Exposes window.FluxPlatformUI.
 */
(function () {
  'use strict';

  var SB_URL = 'https://lfigdijuqmbensebnevo.supabase.co';
  // Public anon key — already shipped in the bundle; read-only under RLS.
  var SB_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxmaWdkaWp1cW1iZW5zZWJuZXZvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMzNjEzMDgsImV4cCI6MjA4ODkzNzMwOH0.qG1d9DLKrs0qqLgAp-6UGdaU7xWvlg2sWq-oD-y2kVo';

  var CACHE_KEY = 'flux_platform_ui';
  var REFRESH_MS = 5 * 60 * 1000;
  // Even a forced refresh (opening Settings) asks the server at most this
  // often, and a failed ask waits this long too. Without it, one browser that
  // kept re-rendering Settings sent ~1,700 requests in 90 minutes while
  // Supabase was already struggling.
  var MIN_GAP_MS = 60 * 1000;
  var TRY_KEY = 'flux_platform_ui_try';

  // Hiding Settings would remove the only route back to this control panel.
  var NEVER_HIDE = { settings: 1, dashboard: 1 };

  var state = { hiddenTabs: [], loaded: false, inFlight: false };

  function $(id) { return document.getElementById(id); }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function readCache() {
    try {
      var raw = localStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      var j = JSON.parse(raw);
      return j && Array.isArray(j.hiddenTabs) ? j : null;
    } catch (e) { return null; }
  }

  function writeCache(hiddenTabs) {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({ hiddenTabs: hiddenTabs, cachedAt: Date.now() }));
    } catch (e) { /* private mode / quota — the network value still applies this session */ }
  }

  function sanitize(list) {
    if (!Array.isArray(list)) return [];
    var out = [];
    list.forEach(function (t) {
      var id = String(t || '').trim();
      if (!/^[A-Za-z][A-Za-z0-9_]{0,40}$/.test(id)) return;
      if (NEVER_HIDE[id]) return;
      if (out.indexOf(id) < 0) out.push(id);
    });
    return out;
  }

  /* ---------- apply ---------- */

  /**
   * Nav entries live in several places (desktop sidebar, mobile drawer, bottom
   * bar, the "More" sheet) and are re-rendered by renderSidebars(), so this is
   * written to be safely re-runnable and to cover every surface at once.
   */
  function apply() {
    var hidden = state.hiddenTabs;
    var sel = '#sidebar [data-tab], .mob-drawer [data-tab], .bottom-nav [data-tab],'
      + ' .more-sheet-item[data-nav-tab], [data-tab]';
    document.querySelectorAll(sel).forEach(function (el) {
      var id = el.getAttribute('data-tab') || el.getAttribute('data-nav-tab');
      if (!id) return;
      // Only touch nav affordances — never panels, which share the same id.
      if (el.classList.contains('panel')) return;
      var hide = hidden.indexOf(id) >= 0;
      if (hide) {
        if (el.dataset.fpuHidden !== '1') {
          el.dataset.fpuPrevDisplay = el.style.display || '';
          el.dataset.fpuHidden = '1';
        }
        el.style.setProperty('display', 'none', 'important');
      } else if (el.dataset.fpuHidden === '1') {
        // Restore only what we hid, so role-based hiding still wins.
        el.style.removeProperty('display');
        if (el.dataset.fpuPrevDisplay) el.style.display = el.dataset.fpuPrevDisplay;
        delete el.dataset.fpuHidden;
        delete el.dataset.fpuPrevDisplay;
      }
    });

    // If the user is sitting on a tab that just got hidden, move them home
    // rather than leaving them on a panel with no way back to it.
    try {
      var cur = window.__fluxLastNavPanel;
      if (cur && hidden.indexOf(cur) >= 0 && typeof window.nav === 'function') {
        window.nav('dashboard');
      }
    } catch (e) { /* nav not ready yet */ }
  }

  /* ---------- load ---------- */

  function applyFromCache() {
    var c = readCache();
    if (c) { state.hiddenTabs = sanitize(c.hiddenTabs); apply(); }
  }

  function refresh(force) {
    if (state.inFlight) return Promise.resolve(state.hiddenTabs);
    var c = readCache();
    if (!force && c && c.cachedAt && (Date.now() - c.cachedAt) < REFRESH_MS) {
      return Promise.resolve(state.hiddenTabs);
    }
    var lastTry = 0;
    try { lastTry = +localStorage.getItem(TRY_KEY) || 0; } catch (e) { /* no storage */ }
    if (Date.now() - lastTry < MIN_GAP_MS) return Promise.resolve(state.hiddenTabs);
    try { localStorage.setItem(TRY_KEY, String(Date.now())); } catch (e) { /* no storage */ }
    state.inFlight = true;
    return fetch(SB_URL + '/rest/v1/platform_settings?key=eq.ui&select=value', {
      headers: { apikey: SB_ANON, Authorization: 'Bearer ' + SB_ANON },
      cache: 'no-store',
      // Without a limit, a hung request kept inFlight set and blocked every later refresh.
      signal: (typeof AbortSignal !== 'undefined' && AbortSignal.timeout) ? AbortSignal.timeout(6000) : undefined
    })
      .then(function (r) { return r.ok ? r.json() : Promise.reject(new Error('HTTP ' + r.status)); })
      .then(function (rows) {
        var value = (rows && rows[0] && rows[0].value) || {};
        state.hiddenTabs = sanitize(value.hiddenTabs);
        state.loaded = true;
        writeCache(state.hiddenTabs);
        apply();
        return state.hiddenTabs;
      })
      .catch(function () {
        // Offline or the table is unreachable — the cached list stays in force.
        return state.hiddenTabs;
      })
      .then(function (v) { state.inFlight = false; return v; });
  }

  /* ---------- boot ---------- */

  function init() {
    applyFromCache();   // instant, avoids a flash of a hidden tab
    refresh(false);     // then reconcile with the server
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }

  window.FluxPlatformUI = {
    apply: apply,
    refresh: refresh,
    hiddenTabs: function () { return state.hiddenTabs.slice(); }
  };
})();
