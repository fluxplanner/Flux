/**
 * flux-knowledge-hub.js — unifies Notes + Knowledge + Notebook into one tab.
 *
 * The sidebar "Notes" entry is relabelled "Knowledge" and its panel (#notes)
 * becomes a 3-tab hub:
 *   • Notes     — the existing rich notes editor (untouched, just shown/hidden)
 *   • Knowledge — the knowledge-doc manager, rendered inline (FluxKnowledge.renderInline)
 *   • Notebook  — the NotebookLM workspace, rendered inline (FluxNotebook.open(mount))
 *
 * Lazy: Knowledge/Notebook only render the first time their tab is opened.
 * Self-contained IIFE; no app edits required beyond loading this file.
 */
(function () {
  'use strict';

  var PANEL = 'notes';
  var built = false;
  var rendered = { knowledge: false, notebook: false };

  function panel() { return document.getElementById(PANEL); }

  function build() {
    if (built) return;
    var p = panel();
    if (!p) return;
    var stack = p.querySelector('.flux-stack');
    if (!stack) return;
    built = true;

    // Tab bar inserted right after the panel header.
    var bar = document.createElement('div');
    bar.className = 'fkh-tabs';
    bar.innerHTML =
      '<button class="fkh-tab active" data-fkh="notes">Notes</button>' +
      '<button class="fkh-tab" data-fkh="knowledge">Knowledge</button>' +
      '<button class="fkh-tab" data-fkh="notebook">Notebook</button>';
    var header = p.querySelector('.flux-page-header');
    if (header && header.parentNode === p) header.insertAdjacentElement('afterend', bar);
    else p.insertBefore(bar, p.firstChild);

    // Notes pane = the existing stack (tagged so we can show/hide it).
    stack.classList.add('fkh-pane', 'fkh-pane--notes');
    stack.setAttribute('data-fkh-pane', 'notes');

    // Mounts for the other two tabs.
    var kHost = document.createElement('div');
    kHost.className = 'fkh-pane fkh-pane--knowledge';
    kHost.setAttribute('data-fkh-pane', 'knowledge');
    kHost.hidden = true;
    var nHost = document.createElement('div');
    nHost.className = 'fkh-pane fkh-pane--notebook';
    nHost.setAttribute('data-fkh-pane', 'notebook');
    nHost.hidden = true;
    stack.insertAdjacentElement('afterend', kHost);
    kHost.insertAdjacentElement('afterend', nHost);

    bar.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-fkh]');
      if (btn) show(btn.getAttribute('data-fkh'));
    });
  }

  function show(which) {
    var p = panel();
    if (!p) return;
    p.querySelectorAll('.fkh-tab').forEach(function (b) { b.classList.toggle('active', b.getAttribute('data-fkh') === which); });
    p.querySelectorAll('[data-fkh-pane]').forEach(function (pane) { pane.hidden = pane.getAttribute('data-fkh-pane') !== which; });

    if (which === 'knowledge' && !rendered.knowledge) {
      var kh = p.querySelector('[data-fkh-pane="knowledge"]');
      try { if (window.FluxKnowledge && FluxKnowledge.renderInline) { FluxKnowledge.renderInline(kh); rendered.knowledge = true; } }
      catch (e) { kh.innerHTML = '<div class="fkh-fallback">Knowledge isn\'t available right now.</div>'; }
    }
    if (which === 'notebook' && !rendered.notebook) {
      var nh = p.querySelector('[data-fkh-pane="notebook"]');
      try { if (window.FluxNotebook && FluxNotebook.open) { FluxNotebook.open(nh); rendered.notebook = true; } }
      catch (e) { nh.innerHTML = '<div class="fkh-fallback">Notebook isn\'t available right now.</div>'; }
    }
  }

  /* Relabel the sidebar nav entries "Notes" → "Knowledge". */
  function relabelNav() {
    document.querySelectorAll('.nav-item[data-tab="notes"], [onclick*="nav(\'notes\')"], [onclick*="navMob(\'notes\')"]').forEach(function (el) {
      var nl = el.querySelector('.nl');
      if (nl && /^\s*Notes\s*$/.test(nl.textContent)) nl.textContent = 'Knowledge';
    });
    var sub = panel() && panel().querySelector('.flux-page-sub');
    if (sub) sub.textContent = 'Notes, your knowledge base, and Notebook — all in one place.';
  }

  function boot() {
    relabelNav();
    var p = panel();
    if (p && window.MutationObserver) {
      var mo = new MutationObserver(function () { if (!built) build(); });
      mo.observe(p, { childList: true, subtree: true });
    }
    build();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  window.FluxKnowledgeHub = { show: show };
})();
