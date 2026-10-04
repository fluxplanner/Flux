/* Flux theme carry — the planner's colours, in the other Flux apps.
 *
 * The grapher, calculator, periodic table, composer and hub are standalone
 * pages on the same site, so they can read the theme the planner saved
 * (flux_theme, flux_accent). For someone signed in to the planner this
 * paints the page with their theme and accent before first paint; signed
 * out, every page keeps its own look.
 *
 * The surfaces mirror THEMES in app.js. The light theme carries only its
 * accent: these pages are drawn for a dark background.
 */
(function () {
  'use strict';
  var ls;
  try { ls = window.localStorage; } catch (e) { return; }
  if (!ls) return;

  function signedIn() {
    try {
      for (var i = 0; i < ls.length; i++) {
        var k = ls.key(i);
        if (k && k.indexOf('sb-') === 0 && k.indexOf('-auth-token') > 0 && ls.getItem(k)) return true;
      }
    } catch (e) {}
    return false;
  }
  if (!signedIn()) return;

  function str(k) {
    var v = null;
    try { v = ls.getItem(k); } catch (e) {}
    if (v == null) return '';
    try { var p = JSON.parse(v); if (typeof p === 'string') return p; } catch (e) {}
    return String(v).replace(/^"|"$/g, '');
  }

  // [bg, bg2, card, card2, border, border2, text, muted2]
  var SURFACES = {
    dark:   ['#0d1117', '#10161f', '#161b22', '#1c2128', '#242b33', '#30363d', '#e6edf3', '#8b949e'],
    aurora: ['#060a12', '#080d18', '#08101e', '#0a1424', 'rgba(100,200,255,.09)', 'rgba(100,200,255,.14)', '#e0f0ff', '#7a9aba'],
    ember:  ['#0d0804', '#120a05', '#1c1008', '#221408', 'rgba(255,120,40,.09)', 'rgba(255,120,40,.14)', '#fff4ec', '#b07a5a'],
    forest: ['#060d08', '#080f0a', '#0a140c', '#0d1a0f', 'rgba(80,200,100,.09)', 'rgba(80,200,100,.14)', '#e8f5ea', '#6a9a72'],
    rose:   ['#0d0608', '#120809', '#1c0a0e', '#220c12', 'rgba(255,100,130,.09)', 'rgba(255,100,130,.14)', '#fff0f3', '#b07080'],
    ocean:  ['#020810', '#030a14', '#04101e', '#061424', 'rgba(30,100,200,.11)', 'rgba(30,100,200,.17)', '#dceeff', '#5a80a0'],
    candy:  ['#0e0814', '#120a18', '#14101e', '#1a1428', 'rgba(200,100,255,.09)', 'rgba(200,100,255,.14)', '#f5e8ff', '#a070c0']
  };

  var theme = str('flux_theme') || 'dark';
  if (theme === 'midnight') theme = 'dark';
  var accent = str('flux_accent');
  var rgb = str('flux_accent_rgb');
  var root = document.documentElement;
  var css = '';

  if (/^#[0-9a-f]{3,8}$/i.test(accent)) {
    root.style.setProperty('--accent', accent);
    if (/^\d{1,3},\s*\d{1,3},\s*\d{1,3}$/.test(rgb)) root.style.setProperty('--accent-rgb', rgb);
  }
  var glow = /^\d{1,3},\s*\d{1,3},\s*\d{1,3}$/.test(rgb) ? 'rgba(' + rgb + ',.10)' : 'transparent';

  var s = SURFACES[theme];
  if (s) {
    var names = ['--bg', '--bg2', '--card', '--card2', '--border', '--border2', '--text', '--muted2'];
    for (var i = 0; i < names.length; i++) root.style.setProperty(names[i], s[i]);
    css = '@media screen {'
      + 'html, html body { background-color: ' + s[0] + '; }'
      + 'html body { background: radial-gradient(120% 80% at 50% -10%, ' + glow + ', transparent 55%), ' + s[0] + '; background-attachment: fixed; color: ' + s[6] + '; }'
      + 'html header.top { background: ' + s[1] + '; }'
      + '}';
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', s[1]);
  }
  if (css) {
    var el = document.createElement('style');
    el.id = 'flux-theme-carry';
    el.textContent = css;
    (document.head || root).appendChild(el);
  }
  root.setAttribute('data-flux-theme', theme);
})();
