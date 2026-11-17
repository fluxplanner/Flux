/* ============================================================================
   FLUX SUITE  ·  flux-suite.js   (moved out of suite.html's inline script, so
   the page's CSP needs no 'unsafe-inline' for scripts)
   The directory is already in the page: scripts/build-suite.mjs wrote it from
   public/data/products.json. This script only wires the tabs, and redraws
   (with the same renderer, flux-suite-render.js) when the apps this viewer
   may see are not the ones the build drew.
   ========================================================================== */
(function () {
  'use strict';
  var host = document.getElementById('apps');
  var hub = window.FluxHub;
  var R = window.FluxSuiteRender;
  if (!host || !hub || !R) return;
  var groups = hub.GROUPS;
  /* Held from the start: a redraw replaces #apps, and the strip must survive it. */
  var strip = document.getElementById('partnersStrip');
  /* The build stamped the ids it drew; while they match there is nothing to do. */
  var lastSig = host.getAttribute('data-sig') || '';

  /* Only the owner, and people given a role that shows it, can see an app
     that is hidden, so only they get this label. */
  var hiddenLabel = function (p) {
    var v = window.FluxAppVisibility;
    return !!(v && (v.isOwner() || v.hasGrant(p.id)) && v.hiddenIds().indexOf(p.id) >= 0);
  };
  var labelSig = function (list) { return list.filter(hiddenLabel).map(function (p) { return p.id; }).join(); };

  /* suite.html#partners (or any group id) opens on that tab. */
  var wanted = function () {
    var want = (location.hash || '').replace(/^#/, '');
    return want === 'partners' ? 'partner' : want;
  };

  /* Into the Partners tab when there is one. Otherwise it sits under the grid:
     the strip lives outside #apps so a redraw cannot take it with it. */
  var placeStrip = function () {
    if (!strip) return;
    var partnerPanel = document.getElementById('apps-partner');
    if (partnerPanel) partnerPanel.appendChild(strip);
    else host.parentNode.insertBefore(strip, host.nextSibling);
  };

  var wire = function () {
    var tabs = [].slice.call(host.querySelectorAll('.hub-tab'));
    var firstId = tabs[0] ? tabs[0].id.replace(/^tab-/, '') : '';
    var select = function (tab, focus, quiet) {
      tabs.forEach(function (t) {
        var on = t === tab;
        t.setAttribute('aria-selected', String(on));
        t.tabIndex = on ? 0 : -1;
        document.getElementById(t.getAttribute('aria-controls')).hidden = !on;
      });
      if (focus) tab.focus();
      if (quiet) return;
      var id = tab.id.replace(/^tab-/, '');
      try { history.replaceState(null, '', id === firstId ? location.pathname + location.search : '#' + (id === 'partner' ? 'partners' : id)); } catch (e) {}
    };
    tabs.forEach(function (t, i) {
      t.addEventListener('click', function () { select(t, false); });
      t.addEventListener('keydown', function (e) {
        var n = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
        if (e.key === 'Home') { e.preventDefault(); select(tabs[0], true); }
        else if (e.key === 'End') { e.preventDefault(); select(tabs[tabs.length - 1], true); }
        else if (n) { e.preventDefault(); select(tabs[(i + n + tabs.length) % tabs.length], true); }
      });
    });
    /* The build opens the first tab; a #hash asks for another. */
    var want = tabs.filter(function (t) { return t.id === 'tab-' + wanted(); })[0];
    if (want && want.getAttribute('aria-selected') !== 'true') select(want, false, true);
  };

  var render = function () {
    var list = hub.visibleProducts();
    var sig = R.signature(list) + '|' + labelSig(list);
    /* Redraw only when the visible set changed: every redraw replays the
       rise-in animation on every card. */
    if (sig === lastSig) return;
    lastSig = sig;
    var cur = host.querySelector('.hub-tab[aria-selected="true"]');
    var out = R.render({
      list: list, groups: groups, esc: hub.esc, hiddenLabel: hiddenLabel,
      active: wanted() || (cur && cur.id.replace(/^tab-/, '')),
    });
    if (strip && strip.parentNode) strip.parentNode.removeChild(strip);
    host.innerHTML = list.length ? out.html
      : '<p style="color:#fbbf24">The app list could not load. <a href="index.html" style="color:#7fe3ff">Open the Flux Planner</a>.</p>';
    placeStrip();
    wire();
  };

  placeStrip();
  wire();
  render();
  /* A fresher hidden list arrived after the first draw. */
  window.addEventListener('flux-app-visibility', render);
})();
