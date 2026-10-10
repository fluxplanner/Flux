/* ============================================================================
   FLUX HUB  ·  flux-hub.js
   The shared product directory and one-tap link to it.

   The nine-dot control in each product links straight to hub.html, where the
   full directory lives. PRODUCTS is shared with that page so every app is
   listed in one place.

   SELF-CONTAINED ON PURPOSE
   -------------------------
   grapher.html loads no bundles, no Supabase and no app CSS — that is the
   whole point of it: open it on a school computer, plot a practical, leave.
   So this file depends on nothing. It is a plain script in the grapher and a
   bundled one in the planner, and behaves identically in both.

   It mounts itself into any element carrying [data-flux-hub]. The attribute
   identifies the current app for the page chrome; the Hub link stays the same
   everywhere.
   ========================================================================== */
(function () {
  'use strict';

  /* One list, used by the Hub directory. Adding a product here puts it on the
     Hub page without duplicating product data in its markup. */
  var PRODUCTS = [
    {
      id: 'planner',
      name: 'Flux Planner',
      tagline: 'Tasks, timetable, revision',
      href: 'index.html',
      mark: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>',
    },
    {
      // Beside the planner, first of the apps after it. Its own brand rather
      // than "Flux …": Synara keeps its name and violet look.
      id: 'synara',
      name: 'Synara',
      tagline: 'Epilepsy meds, seizures, safety card',
      href: 'synara.html',
      free: true,
      // A Flux Partner: built and hosted by Flux for another organization (partners.html).
      partner: true,
      mark: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 13.5h3.75l2.25-6 3.75 10.5 2.6-6.75H21"/></svg>',
      /* Its real logo, drawn in place of the mark: the white pulse from
         public/synara/icons/icon.svg, filling a tile painted with the Hub
         directory's violet gradient (.app-icon--logo). */
      logo: '<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 19h4l2.5-6.5L16.5 23l2.8-7H26"/></svg>',
    },
    {
      id: 'teacher',
      name: 'Flux Tutor',
      tagline: 'Learn from your class materials',
      href: 'teacher.html',
      free: true,
      mark: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3 2.5 8 12 13l9.5-5L12 3Z"/><path d="M6.5 11v5.2c3.1 2.4 7.9 2.4 11 0V11M21.5 8v6"/></svg>',
    },
    {
      id: 'grapher',
      name: 'Flux Grapher',
      tagline: 'Equations and lab data',
      href: 'grapher.html',
      free: true,
      mark: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 3v18h18"/><path d="m7 14 4-4 3 3 5-6"/></svg>',
    },
    {
      id: 'periodic',
      name: 'Flux Periodic Table',
      tagline: 'Every trend, spectrum and atom in 3D',
      href: 'periodic.html',
      free: true,
      mark: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="5" height="5" rx="1"/><rect x="16" y="3" width="5" height="5" rx="1"/><rect x="3" y="10" width="5" height="5" rx="1"/><rect x="9.5" y="10" width="5" height="5" rx="1"/><rect x="16" y="10" width="5" height="5" rx="1"/><path d="M5 19h14"/></svg>',
    },
    {
      id: 'composer',
      name: 'Flux Composer',
      tagline: 'Keys, chords, beats and DP Music',
      href: 'composer.html',
      free: true,
      mark: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>',
    },
    {
      id: 'flashcards',
      name: 'Flux Flashcards',
      tagline: 'Spaced repetition, tests and games',
      href: 'flashcards.html',
      free: true,
      mark: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="6" width="15" height="14" rx="2"/><path d="M7 2h13a2 2 0 0 1 2 2v12"/></svg>',
    },
    {
      id: 'pixel',
      name: 'Flux Pixel',
      tagline: 'Draw and label diagrams',
      href: 'pixel.html',
      free: true,
      mark: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>',
    },
    {
      id: 'calculator',
      name: 'Flux Calculator',
      tagline: 'Works like a TI-84 Plus CE',
      href: 'calculator.html',
      free: true,
      mark: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="2" width="14" height="20" rx="2.5"/><rect x="8" y="5" width="8" height="4" rx=".8"/><path d="M8.5 13h.01M12 13h.01M15.5 13h.01M8.5 16.5h.01M12 16.5h.01M15.5 16.5h.01"/></svg>',
    },
  ];

  function mount(host) {
    if (!host || host.getAttribute('data-flux-hub-ready') === '1') return;
    host.setAttribute('data-flux-hub-ready', '1');
    host.classList.add('fxhub');

    host.innerHTML =
      '<a class="fxhub-btn" href="hub.html" aria-label="Open the Flux Hub" title="Open Flux Hub">'
      + '<span class="fxhub-btn-mark" aria-hidden="true">'
      + '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">'
      + '<circle cx="5" cy="5" r="2"/><circle cx="12" cy="5" r="2"/><circle cx="19" cy="5" r="2"/>'
      + '<circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/>'
      + '<circle cx="5" cy="19" r="2"/><circle cx="12" cy="19" r="2"/><circle cx="19" cy="19" r="2"/>'
      + '</svg></span>'
      + '<span class="fxhub-btn-label">Flux</span>'
      + '</a>';
  }

  function mountAll() {
    var hosts = document.querySelectorAll('[data-flux-hub]');
    for (var i = 0; i < hosts.length; i++) mount(hosts[i]);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mountAll);
  } else {
    mountAll();
  }
  /* The planner rebuilds its chrome after boot, so the mount point can appear
     later than this script runs. One retry pass costs nothing and saves the
     hub silently never showing up there. */
  setTimeout(mountAll, 1200);

  /* Added to a phone's home screen, Flux runs as an app, and a link that opens
     a new window leaves it for Safari's pop-up sheet: a white bar across the
     top and no way back to the planner but closing it. Between Flux's own
     pages it stays in the app instead — every one of them has this switcher
     to come back by. In a normal browser tab, new windows are left alone. */
  function installed() {
    try {
      return (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches)
        || window.navigator.standalone === true;
    } catch (e) { return false; }
  }
  function isFluxPage(href) {
    try {
      var u = new URL(href, location.href);
      if (u.origin !== location.origin) return false;
      var path = u.pathname.replace(/\.html$/, '');
      return PRODUCTS.some(function (p) { var n = '/' + p.href.replace(/\.html$/, ''); return path.slice(-n.length) === n; });
    } catch (e) { return false; }
  }
  function openPage(href) {
    if (installed() && isFluxPage(href)) location.href = href;
    else window.open(href, '_blank', 'noopener');
  }
  // Capture phase, for the same reason as the menu: the planner stops clicks bubbling.
  document.addEventListener('click', function (e) {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    var a = e.target && e.target.closest && e.target.closest('a[target="_blank"][href]');
    if (!a || !installed() || !isFluxPage(a.href)) return;
    e.preventDefault();
    location.href = a.href;
  }, true);

  /* ── Printing where the browser cannot ───────────────────────────────
     A web app saved to an iPhone or iPad home screen has no printing at all:
     window.print() there simply does nothing, so the grapher's and the
     periodic table's Print buttons failed without a word on Azfer's phone
     (2026-10-01). There, the page hands an image of what would have printed
     to the phone's Share sheet, which has Print in it. Everywhere else the
     browser prints as before. */
  function canPrint() {
    var ua = navigator.userAgent || '';
    var apple = /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
    return typeof window.print === 'function' && !(apple && installed());
  }
  /** Give a PNG to the Share sheet (Print is in it), or save it where sharing
      files is not possible. Resolves 'shared', 'saved' or 'cancelled'. Call it
      straight from the tap: Safari only opens the sheet for a fresh one. */
  function printImage(blob, fileName, title) {
    function save() {
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
      return 'saved';
    }
    var file = null;
    try { file = new File([blob], fileName, { type: blob.type || 'image/png' }); } catch (e) { /* very old browser */ }
    if (file && navigator.canShare && navigator.share && navigator.canShare({ files: [file] })) {
      return navigator.share({ files: [file], title: title || fileName })
        .then(function () { return 'shared'; }, function (e) { return e && e.name === 'AbortError' ? 'cancelled' : save(); });
    }
    return Promise.resolve(save());
  }

  window.FluxHub = { mount: mount, mountAll: mountAll, openPage: openPage, PRODUCTS: PRODUCTS, canPrint: canPrint, printImage: printImage };
})();
