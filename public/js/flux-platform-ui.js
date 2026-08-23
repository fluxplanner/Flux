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
    state.inFlight = true;
    return fetch(SB_URL + '/rest/v1/platform_settings?key=eq.ui&select=value', {
      headers: { apikey: SB_ANON, Authorization: 'Bearer ' + SB_ANON },
      cache: 'no-store'
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

  /* ---------- owner control panel ---------- */

  function isOwner() {
    try { return typeof window.isOwner === 'function' && window.isOwner(); } catch (e) { return false; }
  }

  /** The live sidebar is the source of truth for what tabs exist and are called. */
  function knownTabs() {
    var out = [];
    var seen = {};
    document.querySelectorAll('#sidebar .nav-item[data-tab]').forEach(function (el) {
      var id = el.getAttribute('data-tab');
      if (!id || seen[id] || NEVER_HIDE[id]) return;
      seen[id] = 1;
      var label = (el.querySelector('.nl') || {}).textContent || id;
      out.push({ id: id, label: String(label).trim() || id });
    });
    return out;
  }

  function renderOwnerPanel() {
    var card = $('platformUiCard');
    if (!card) return;
    if (!isOwner()) { card.style.display = 'none'; return; }
    card.style.display = '';

    var tabs = knownTabs();
    var list = $('platformUiList');
    if (list) {
      list.innerHTML = tabs.map(function (t) {
        var off = state.hiddenTabs.indexOf(t.id) >= 0;
        return '<label class="flux-pui-row">'
          + '<input type="checkbox" class="flux-pui-check" data-pui-tab="' + esc(t.id) + '"'
          + (off ? '' : ' checked') + '>'
          + '<span class="flux-pui-label">' + esc(t.label) + '</span>'
          + '<span class="flux-pui-state">' + (off ? 'Hidden for everyone' : 'Visible') + '</span>'
          + '</label>';
      }).join('') || '<p class="flux-pui-empty">No tabs found.</p>';
    }
    var st = $('platformUiStatus');
    if (st) {
      st.textContent = state.hiddenTabs.length
        ? state.hiddenTabs.length + ' tab' + (state.hiddenTabs.length === 1 ? '' : 's') + ' hidden for everyone'
        : 'Every tab is visible to everyone';
    }
  }

  function selectedHidden() {
    var out = [];
    document.querySelectorAll('#platformUiList .flux-pui-check').forEach(function (cb) {
      if (!cb.checked) out.push(cb.getAttribute('data-pui-tab'));
    });
    return sanitize(out);
  }

  function save() {
    var btn = $('platformUiSave');
    var st = $('platformUiStatus');
    var hiddenTabs = selectedHidden();
    if (btn) { btn.disabled = true; btn.textContent = 'Saving…'; }

    return Promise.resolve(typeof window.getSB === 'function' ? window.getSB() : null)
      .then(function (sb) { return sb && sb.auth ? sb.auth.getSession() : null; })
      .then(function (s) {
        var token = s && s.data && s.data.session && s.data.session.access_token;
        if (!token) throw new Error('Sign in as the owner first');
        return fetch(SB_URL + '/functions/v1/release-admin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
          body: JSON.stringify({ action: 'set_platform_ui', hiddenTabs: hiddenTabs })
        });
      })
      .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
      .then(function (res) {
        if (!res.ok) throw new Error(res.j && res.j.error ? res.j.error : 'Save failed');
        state.hiddenTabs = sanitize(res.j.value && res.j.value.hiddenTabs);
        writeCache(state.hiddenTabs);
        apply();
        renderOwnerPanel();
        if (st) st.textContent = 'Saved — this applies to every planner.';
        if (window.showToast) window.showToast('Saved for every planner', 'success', 3000);
      })
      .catch(function (e) {
        if (st) st.textContent = String(e.message || e);
        if (window.showToast) window.showToast(String(e.message || e), 'error', 5000);
      })
      .then(function () {
        if (btn) { btn.disabled = false; btn.textContent = 'Save for everyone'; }
      });
  }

  function wireOwnerPanel() {
    var card = $('platformUiCard');
    if (!card || card.__puiWired) return;
    card.__puiWired = true;
    var btn = $('platformUiSave');
    if (btn) btn.addEventListener('click', save);
    var reset = $('platformUiReset');
    if (reset) {
      reset.addEventListener('click', function () {
        document.querySelectorAll('#platformUiList .flux-pui-check').forEach(function (cb) { cb.checked = true; });
        save();
      });
    }
  }

  function renderSettings() {
    wireOwnerPanel();
    refresh(true).then(renderOwnerPanel);
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
    renderSettings: renderSettings,
    hiddenTabs: function () { return state.hiddenTabs.slice(); }
  };
})();
