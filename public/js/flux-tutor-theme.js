/* Flux Tutor · light / dark switch.
 *
 * Loaded in <head>, after flux-theme-carry.js, so a page opens in the theme
 * that was picked, with no flash of the other one. With nothing picked it
 * keeps what the page did before: the planner's theme when signed in, the
 * device's setting when not. A pick is remembered in this browser
 * (flux_tutor_theme) and wins over both.
 *
 * Light over a carried dark planner theme: flux-theme-carry.js paints the
 * page and header and sets the planner's colours on <html>, all of them
 * drawn for a dark background. Those are switched off while light is on,
 * and put back for dark.
 */
(function () {
  'use strict';
  var KEY = 'flux_tutor_theme';
  var root = document.documentElement;
  var CARRIED = ['--bg', '--bg2', '--card', '--card2', '--border', '--border2', '--text', '--muted2'];
  var carried = null;   // the planner's colours, set aside while light is on

  function saved() {
    try { var v = localStorage.getItem(KEY); return v === 'light' || v === 'dark' ? v : ''; } catch (e) { return ''; }
  }
  /** What the page shows with no pick: as the stylesheet decides it. */
  function natural() {
    var t = root.getAttribute('data-flux-theme');
    if (t) return t === 'light' ? 'light' : 'dark';
    return window.matchMedia && matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  }
  function current() { return root.getAttribute('data-ft-theme') || natural(); }

  function apply(mode) {
    if (mode) root.setAttribute('data-ft-theme', mode); else root.removeAttribute('data-ft-theme');
    var light = (mode || natural()) === 'light';
    var carry = document.getElementById('flux-theme-carry');
    if (carry) carry.media = light ? 'not all' : '';
    if (light && !carried && root.getAttribute('data-flux-theme') && root.getAttribute('data-flux-theme') !== 'light') {
      carried = {};
      CARRIED.forEach(function (p) {
        var v = root.style.getPropertyValue(p);
        if (v) { carried[p] = v; root.style.removeProperty(p); }
      });
    } else if (!light && carried) {
      Object.keys(carried).forEach(function (p) { root.style.setProperty(p, carried[p]); });
      carried = null;
    }
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
      if (!meta.dataset.dark) meta.dataset.dark = meta.getAttribute('content') || '#080d18';
      meta.setAttribute('content', light ? '#ffffff' : meta.dataset.dark);
    }
    paintButton();
  }

  function paintButton() {
    var btn = document.getElementById('ftThemeBtn');
    if (!btn) return;
    var light = current() === 'light';
    var label = light ? 'Switch to dark mode' : 'Switch to light mode';
    btn.setAttribute('aria-label', label);
    btn.title = label;
    btn.setAttribute('data-mode', light ? 'light' : 'dark');
  }

  apply(saved());

  function wire() {
    var btn = document.getElementById('ftThemeBtn');
    if (!btn) return;
    btn.hidden = false;
    btn.addEventListener('click', function () {
      var next = current() === 'light' ? 'dark' : 'light';
      try { localStorage.setItem(KEY, next); } catch (e) {}
      apply(next);
    });
    paintButton();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', wire);
  else wire();

  // Another tab picked a theme: follow it.
  window.addEventListener('storage', function (e) { if (e.key === KEY) apply(saved()); });
  // No pick, and the device switches: the button follows.
  try { matchMedia('(prefers-color-scheme: light)').addEventListener('change', paintButton); } catch (e) {}
})();
