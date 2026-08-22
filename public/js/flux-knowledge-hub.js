/**
 * flux-knowledge-hub.js — RETIRED. Stands down; see below.
 *
 * This module implemented an earlier design in which the "Notes" panel became
 * purely Knowledge: it hid the notes editor (`#notes .flux-stack`), injected the
 * knowledge-doc manager in its place, and relabelled the sidebar Notes →
 * Knowledge.
 *
 * That design was superseded by `ensureNbkSubtabs()` (app.js), where one
 * "Notebook" sidebar entry holds two sub-views — the Notes list (panel `notes`,
 * the default) and Knowledge (panel `notebook`, the NotebookLM workspace).
 *
 * Both shipped at once and fought over panel `notes`: the subtab strip
 * advertised a "Notes" destination that this file had permanently blanked, so
 * clicking Notes showed the Knowledge base and the notes list/editor was
 * unreachable from anywhere in the app.
 *
 * The newer design wins, so the takeover is disabled. The Knowledge manager is
 * unaffected and still reachable via `FluxKnowledge.openManager()` from the
 * Notes toolbar and the Flux AI topbar (index.html:1598 and :2085), and the
 * NotebookLM workspace remains on panel `notebook`.
 *
 * Kept as a no-op rather than deleted so `window.FluxKnowledgeHub` stays defined
 * and the bundle manifest needs no change.
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

  // Disabled: booting this would hide `#notes .flux-stack` and make the Notes
  // list unreachable. `build`, `renderKnowledge` and `relabelNav` are retained
  // above only as the record of the retired design.
  void build; void relabelNav;

  window.FluxKnowledgeHub = { build: function () {} };
})();
