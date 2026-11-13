/* Flux look switch — "flat" (default, 2026-11) or "classic" (the old
   gradient/glow look).

   Every Flux page loads this in <head>, before first paint, so the page never
   flashes the wrong look. public/css/flux-look-flat.css only applies while
   <html data-flux-look="flat">.

   To go back to the old look:
     • Settings → Appearance → "Classic look", or
     • open any page with ?look=classic (and ?look=flat to come back).
   The choice is remembered per device in localStorage "flux_look". */
(function () {
  var KEY = 'flux_look';
  var root = document.documentElement;

  function read() {
    try {
      var q = new URLSearchParams(location.search).get('look');
      if (q === 'classic' || q === 'flat') { localStorage.setItem(KEY, q); return q; }
      return localStorage.getItem(KEY) === 'classic' ? 'classic' : 'flat';
    } catch (_) { return 'flat'; }
  }

  function apply(look) { root.setAttribute('data-flux-look', look); }

  apply(read());

  window.FluxLook = {
    get: function () { return root.getAttribute('data-flux-look') || 'flat'; },
    set: function (look) {
      look = look === 'classic' ? 'classic' : 'flat';
      try { localStorage.setItem(KEY, look); } catch (_) {}
      apply(look);
      try { window.dispatchEvent(new CustomEvent('flux:look', { detail: look })); } catch (_) {}
    }
  };

  // Another tab changed it — follow along.
  window.addEventListener('storage', function (e) {
    if (e.key === KEY) apply(e.newValue === 'classic' ? 'classic' : 'flat');
  });
})();

/* Sliding underline for the new look's tab switchers (flux-look-flat.css).
   Keeps one .fx-tab-line in each switcher and slides it under the chosen
   tab whenever the choice changes, so switching still animates. */
(function () {
  var SEL = '#filterChips, .stabs, .ftt-nav, .flg-seg, .dash-toolbar-views, .tmode-toggle, .tmode-segmented, :has(> .tmode-btn), [role="tablist"]:not(.flux-pulse-tier-grid)';
  var ACTIVE = ':scope > :is(.active, [aria-selected="true"], [aria-pressed="true"])';
  var queued = false;

  function place(c) {
    var line = c.querySelector(':scope > .fx-tab-line');
    if (!line) {
      line = document.createElement('span');
      line.className = 'fx-tab-line';
      line.setAttribute('aria-hidden', 'true');
      c.appendChild(line);
    }
    var a = c.querySelector(ACTIVE);
    if (!a || !a.offsetWidth) { line.classList.remove('is-on'); line.style.opacity = '0'; return; }
    line.style.width = a.offsetWidth + 'px';
    line.style.transform = 'translate(' + a.offsetLeft + 'px,' + (a.offsetTop + a.offsetHeight - 2) + 'px)';
    line.style.opacity = '1';
    line.classList.add('is-on');
  }

  function scan() {
    queued = false;
    if (document.documentElement.getAttribute('data-flux-look') !== 'flat') {
      document.querySelectorAll('.fx-tab-line').forEach(function (l) { l.remove(); });
      return;
    }
    var list;
    try { list = document.querySelectorAll(SEL); } catch (_) { return; }
    list.forEach(function (c) { if (!c.closest('#sidebar')) place(c); });
    // Lines left in the sidebar by an earlier version would cover its pill.
    document.querySelectorAll('#sidebar .fx-tab-line').forEach(function (l) { l.remove(); });
  }
  // setTimeout, not requestAnimationFrame: rAF stalls in hidden tabs, and the
  // line must already be right when the tab comes back.
  function queue() { if (!queued) { queued = true; setTimeout(scan, 30); } }

  function start() {
    scan();
    new MutationObserver(function (muts) {
      for (var i = 0; i < muts.length; i++) {
        var t = muts[i].target;
        if (t.classList && t.classList.contains('fx-tab-line')) continue;
        queue(); return;
      }
    }).observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['class', 'aria-selected', 'aria-pressed', 'hidden'] });
    window.addEventListener('resize', queue);
    window.addEventListener('flux:look', queue);
  }
  if (document.body) start(); else document.addEventListener('DOMContentLoaded', start);
})();
