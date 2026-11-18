/* FLUX TOOLS · flux-tool-embed-mode.js
   Loaded in the <head> of every tool page, before anything paints. Opened as
   page.html?embed=1 inside another Flux app (flux-tool-embed.js), the page
   drops its own header, skip link, notices and timer pill — the host app has
   its own — and tells the host how tall it is so the frame can fit it. */
(function () {
  'use strict';
  var embedded = false;
  try { embedded = (/[?&]embed=1\b/.test(location.search) || location.hash === '#embed') && window.parent !== window; } catch (e) { embedded = true; }
  if (!embedded) return;
  var root = document.documentElement;
  root.classList.add('ft-embedded');
  var st = document.createElement('style');
  st.textContent = 'html.ft-embedded header.top,html.ft-embedded .skip-link,html.ft-embedded #fluxSiteNotices,'
    + 'html.ft-embedded .fst-pill,html.ft-embedded .fxpd{display:none!important}'
    + 'html.ft-embedded body::after{display:none}html.ft-embedded main{padding-top:8px}'
    // The frame is sized to the page: a page sized to the frame (100dvh) would grow forever.
    + 'html.ft-embedded,html.ft-embedded body{min-height:0!important;height:auto!important}';
  (document.head || root).appendChild(st);
  var last = 0;
  function report() {
    var h = document.body ? document.body.scrollHeight : 0;
    if (Math.abs(h - last) < 2) return;
    last = h;
    try { window.parent.postMessage({ fluxToolHeight: h }, location.origin); } catch (e) { /* no parent to tell */ }
  }
  function start() {
    report();
    try { new ResizeObserver(report).observe(document.body); } catch (e) { setInterval(report, 500); }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
