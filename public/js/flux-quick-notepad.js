/**
 * flux-quick-notepad.js — always-accessible scratchpad for educators.
 *
 * Teachers/staff wanted a place to jot things down fast without hunting for a
 * panel. This adds a small floating button (bottom-right) that opens a
 * lightweight notepad. Content autosaves (debounced) to a per-user localStorage
 * key and, when the app exposes cloud sync, mirrors there too. Available in BOTH
 * work and personal mode for any educator; hidden for students and on login.
 * Self-contained IIFE.
 */
(function () {
  'use strict';

  var BTN_ID = 'fluxQuickNoteFab';
  var PANEL_ID = 'fluxQuickNotePanel';
  var BASE_KEY = 'flux_quick_notepad';
  var saveTimer = null;

  function uid() {
    try { return (window.currentUser && window.currentUser.id) || 'local'; } catch (e) { return 'local'; }
  }
  function storeKey() { return BASE_KEY + '_' + uid(); }

  function loadNote() {
    try { return localStorage.getItem(storeKey()) || ''; } catch (e) { return ''; }
  }
  function saveNote(val) {
    try { localStorage.setItem(storeKey(), val); } catch (e) {}
    // Best-effort cloud mirror when the app provides it (no-op otherwise).
    try { if (typeof window.syncKey === 'function') window.syncKey(BASE_KEY, val); } catch (e) {}
  }

  function isEducator() {
    try { return !!(window.FluxRole && window.FluxRole.isEducator && window.FluxRole.isEducator()); } catch (e) { return false; }
  }
  function loggedOutOrSplash() {
    var login = document.getElementById('loginScreen');
    if (login && getComputedStyle(login).display !== 'none' && !login.classList.contains('hidden')) return true;
    var splash = document.getElementById('splash');
    if (splash && getComputedStyle(splash).display !== 'none') return true;
    return false;
  }

  function buildPanel() {
    if (document.getElementById(PANEL_ID)) return;
    var p = document.createElement('div');
    p.id = PANEL_ID;
    p.className = 'flux-qnote-panel';
    p.setAttribute('role', 'dialog');
    p.setAttribute('aria-label', 'Quick notepad');
    p.hidden = true;
    p.innerHTML =
      '<div class="flux-qnote-head">' +
        '<span class="flux-qnote-title">Quick notes</span>' +
        '<span class="flux-qnote-status" id="fluxQnoteStatus"></span>' +
        '<button type="button" class="flux-qnote-x" id="fluxQnoteClose" aria-label="Close">✕</button>' +
      '</div>' +
      '<textarea id="fluxQnoteText" class="flux-qnote-text" placeholder="Jot anything — a reminder, a name, a to-do… saves automatically."></textarea>' +
      '<div class="flux-qnote-foot"><span id="fluxQnoteCount">0 chars</span><span>Saved on this device' + (typeof window.syncKey === 'function' ? ' · synced' : '') + '</span></div>';
    document.body.appendChild(p);

    var ta = p.querySelector('#fluxQnoteText');
    ta.addEventListener('input', function () {
      flashStatus('Saving…');
      updateCount();
      clearTimeout(saveTimer);
      saveTimer = setTimeout(function () { saveNote(ta.value); flashStatus('Saved'); }, 400);
    });
    p.querySelector('#fluxQnoteClose').addEventListener('click', closePanel);
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !p.hidden) closePanel();
    });
  }

  function flashStatus(txt) {
    var s = document.getElementById('fluxQnoteStatus');
    if (s) s.textContent = txt;
  }
  function updateCount() {
    var ta = document.getElementById('fluxQnoteText');
    var c = document.getElementById('fluxQnoteCount');
    if (ta && c) c.textContent = (ta.value.length) + ' chars';
  }

  function openPanel() {
    buildPanel();
    var p = document.getElementById(PANEL_ID);
    var ta = document.getElementById('fluxQnoteText');
    if (ta) { ta.value = loadNote(); }
    updateCount();
    flashStatus('');
    p.hidden = false;
    p.classList.add('open');
    if (ta) setTimeout(function () { ta.focus(); }, 30);
  }
  function closePanel() {
    var p = document.getElementById(PANEL_ID);
    if (!p) return;
    p.classList.remove('open');
    setTimeout(function () { p.hidden = true; }, 180);
  }
  function togglePanel() {
    var p = document.getElementById(PANEL_ID);
    if (p && !p.hidden) closePanel(); else openPanel();
  }

  function build() {
    if (document.getElementById(BTN_ID)) return;
    var b = document.createElement('button');
    b.id = BTN_ID;
    b.type = 'button';
    b.className = 'flux-qnote-fab';
    b.title = 'Quick notes';
    b.setAttribute('aria-label', 'Open quick notepad');
    b.innerHTML =
      '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>' +
      '<span class="flux-qnote-fab__label">Notes</span>';
    b.addEventListener('click', togglePanel);
    document.body.appendChild(b);
  }

  function sync() {
    var b = document.getElementById(BTN_ID);
    if (!b) return;
    var show = isEducator() && !loggedOutOrSplash();
    b.style.display = show ? '' : 'none';
    if (!show) closePanel();
  }

  function boot() {
    build();
    sync();
    if (window.MutationObserver) {
      var login = document.getElementById('loginScreen');
      if (login) { try { new MutationObserver(sync).observe(login, { attributes: true, attributeFilter: ['style', 'class'] }); } catch (e) {} }
    }
    document.addEventListener('flux-auth-changed', sync);
    document.addEventListener('flux-role-changed', sync);
    document.addEventListener('flux-mode-changed', sync);
    setInterval(sync, 4000); // safety net for role/mode changes we don't observe
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  window.FluxQuickNotepad = { sync: sync, open: openPanel };
})();
