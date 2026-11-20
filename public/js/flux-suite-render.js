/* ============================================================================
   FLUX SUITE  ·  flux-suite-render.js
   The Suite's cards as HTML, from a list of products. One renderer for two
   callers, so the page cannot drift from what the build wrote:
   - scripts/build-suite.mjs runs it at build time and writes the result into
     suite.html between the FLUX_SUITE_STATIC markers, so the directory paints
     with the HTML, before any script runs, and without JavaScript at all.
   - public/js/flux-suite.js runs it again in the browser only when the set of
     apps this viewer may see differs from that build (an app hidden or shown
     by Owner Controls, or the owner's own tile).
   Escaping is FluxHub.esc (flux-hub.js), passed in, so the switcher and the
   Suite escape the same way.
   ========================================================================== */
(function (root) {
  'use strict';

  /** opts: { list, groups, esc, active, hiddenLabel(p) } → { html, tabbed, active } */
  function render(opts) {
    var esc = opts.esc;
    var list = opts.list;
    var groups = opts.groups;
    var hiddenLabel = opts.hiddenLabel || function () { return false; };
    var kindOf = {};
    groups.forEach(function (g) { kindOf[g.id] = g.kind || 'tab'; });
    var firstTab = groups.filter(function (g) { return kindOf[g.id] === 'tab'; })[0];
    var groupOf = function (p) { return kindOf[p.group] ? p.group : (firstTab && firstTab.id); };
    var inGroup = function (id) { return list.filter(function (p) { return groupOf(p) === id; }); };
    var blurb = function (p) { return esc(p.blurb || p.tagline); };

    var icon = function (p) {
      return p.logo
        ? '<span class="app-icon app-icon--logo" aria-hidden="true">' + p.logo + '</span>'
        : '<span class="app-icon" aria-hidden="true">' + p.mark + '</span>';
    };
    var title = function (p) {
      return '<h3 class="app-name">' + esc(p.name) + (p.partner ? '<span class="app-partner">Partner</span>' : '')
        + (hiddenLabel(p) ? '<span class="app-partner">Hidden</span>' : '') + '</h3>'
        + '<div class="app-tag">' + esc(p.tagline) + '</div>';
    };
    var card = function (p) {
      return '<a class="app app--' + esc(p.slug || p.id) + '" href="' + esc(p.href) + '">'
        + '<div class="app-top">' + icon(p) + '<div>' + title(p) + '</div></div>'
        + '<p class="app-desc">' + blurb(p) + '</p>'
        + '<div class="app-foot"><span class="go">Open →</span></div>'
        + '</a>';
    };
    /* The planner: one wide bar across the top, above the tabs. */
    var bar = function (p) {
      return '<a class="app app--feature app--' + esc(p.slug || p.id) + '" href="' + esc(p.href) + '">'
        + '<div class="app-head">' + icon(p) + '<div class="app-head-t">' + title(p) + '</div></div>'
        + '<div class="app-main"><p class="app-desc">' + blurb(p) + '</p></div>'
        + '<span class="go">Open the planner →</span>'
        + '</a>';
    };

    var bars = groups.filter(function (g) { return g.kind === 'bar'; })
      .map(function (g) { return inGroup(g.id).map(bar).join(''); }).join('');
    var tabbed = groups.filter(function (g) { return g.kind !== 'bar' && inGroup(g.id).length; });

    /* Nothing to tab between: one plain grid instead of an empty tablist. */
    if (!tabbed.length) {
      var rest = list.filter(function (p) { return kindOf[groupOf(p)] !== 'bar'; });
      return { html: bars + (rest.length ? '<div class="apps-grid">' + rest.map(card).join('') + '</div>' : ''), tabbed: [], active: '' };
    }

    var active = tabbed.some(function (g) { return g.id === opts.active; }) ? opts.active : tabbed[0].id;
    var html = bars
      + '<div class="hub-tabs" role="tablist" aria-label="Apps">'
      + tabbed.map(function (g) {
        var on = g.id === active;
        return '<button type="button" role="tab" class="hub-tab hub-tab--' + esc(g.id) + '" id="tab-' + esc(g.id) + '" aria-controls="apps-' + esc(g.id) + '" aria-selected="' + on + '" tabindex="' + (on ? 0 : -1) + '">'
          + esc(g.name) + '<span class="hub-tab-n">' + inGroup(g.id).length + '</span></button>';
      }).join('')
      + '</div>'
      + tabbed.map(function (g) {
        return '<div class="apps-grid" role="tabpanel" id="apps-' + esc(g.id) + '" aria-labelledby="tab-' + esc(g.id) + '"' + (g.id === active ? '' : ' hidden') + '>'
          + inGroup(g.id).map(card).join('') + '</div>';
      }).join('');
    return { html: html, tabbed: tabbed, active: active };
  }

  /** The ids drawn, in order: the Suite redraws only when this changes. */
  function signature(list) { return list.map(function (p) { return p.id; }).join(); }

  root.FluxSuiteRender = { render: render, signature: signature };
})(typeof window !== 'undefined' ? window : globalThis);
