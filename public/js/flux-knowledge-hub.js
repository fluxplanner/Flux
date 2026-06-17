/**
 * flux-knowledge-hub.js — the former "Notes" panel is now purely Knowledge.
 *
 * Notes has been fully replaced by the Knowledge base. The sidebar entry +
 * page title read "Knowledge", the old notes editor UI is hidden, and the
 * knowledge-doc manager (FluxKnowledge.renderInline) fills the panel.
 * (Notebook is its own separate sidebar tab — not here.)
 *
 * The underlying notes data/functions are left intact in app.js so deep links
 * and "Send to Knowledge" keep working; only the Notes *surface* is retired.
 *
 * Self-contained IIFE.
 */
(function () {
  'use strict';

  var PANEL = 'notes';
  var built = false;

  function panel() { return document.getElementById(PANEL); }

  function build() {
    if (built) return;
    var p = panel();
    if (!p) return;
    var stack = p.querySelector('.flux-stack');
    if (!stack) return;
    built = true;

    // Hide the legacy Notes editor surface entirely.
    stack.style.display = 'none';
    stack.setAttribute('aria-hidden', 'true');

    // Knowledge fills the panel.
    var host = document.createElement('div');
    host.id = 'fkhKnowledgeHost';
    host.className = 'fkh-pane fkh-pane--knowledge';
    var header = p.querySelector('.flux-page-header');
    if (header && header.parentNode === p) header.insertAdjacentElement('afterend', host);
    else p.insertBefore(host, stack);

    renderKnowledge(host);
  }

  function renderKnowledge(host) {
    try {
      if (window.FluxKnowledge && FluxKnowledge.renderInline) { FluxKnowledge.renderInline(host); return; }
    } catch (e) {}
    host.innerHTML = '<div class="fkh-fallback">Knowledge isn\'t available right now.</div>';
    var tries = 0;
    var iv = setInterval(function () {
      tries++;
      if (window.FluxKnowledge && FluxKnowledge.renderInline) {
        clearInterval(iv);
        try { FluxKnowledge.renderInline(host); } catch (e) {}
      } else if (tries > 20) clearInterval(iv);
    }, 250);
  }

  /* Relabel the sidebar nav entries "Notes" → "Knowledge". */
  function relabelNav() {
    document.querySelectorAll('.nav-item[data-tab="notes"], [onclick*="nav(\'notes\')"], [onclick*="navMob(\'notes\')"]').forEach(function (el) {
      var nl = el.querySelector('.nl');
      if (nl && /^\s*Notes\s*$/.test(nl.textContent)) nl.textContent = 'Knowledge';
    });
    var sub = panel() && panel().querySelector('.flux-page-sub');
    if (sub) sub.textContent = 'Your knowledge base — class materials, formula sheets, and notes Flux studies from.';
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

  window.FluxKnowledgeHub = { build: build };
})();
