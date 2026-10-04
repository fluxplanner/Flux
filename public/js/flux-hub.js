/* ============================================================================
   FLUX HUB  ·  flux-hub.js
   The switcher between Flux products.

   Flux is the company; the planner and the grapher are two things it makes,
   with more to come. Until now the only link between them was one hardcoded
   anchor in the grapher's header pointing at the planner — which made the
   grapher feel like a page that had wandered off, rather than a product
   sitting beside its sibling.

   SELF-CONTAINED ON PURPOSE
   -------------------------
   grapher.html loads no bundles, no Supabase and no app CSS — that is the
   whole point of it: open it on a school computer, plot a practical, leave.
   So this file depends on nothing. It is a plain script in the grapher and a
   bundled one in the planner, and behaves identically in both.

   It mounts itself into any element carrying [data-flux-hub], whose value
   names the product currently open, so each app marks its own entry instead of
   linking the reader to where they already are.
   ========================================================================== */
(function () {
  'use strict';

  /* One list, used by both apps. Adding a product here puts it in the switcher
     everywhere at once — the reason this is data rather than markup repeated
     across two HTML files that would drift apart. */
  var PRODUCTS = [
    {
      id: 'planner',
      name: 'Flux Planner',
      tagline: 'Tasks, timetable, revision',
      href: 'index.html',
      mark: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>',
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
      tagline: 'Keys, chords, ear training and DP Music',
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
      id: 'calculator',
      name: 'Flux Calculator',
      tagline: 'Works like a TI-84 Plus CE',
      href: 'calculator.html',
      free: true,
      mark: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="2" width="14" height="20" rx="2.5"/><rect x="8" y="5" width="8" height="4" rx=".8"/><path d="M8.5 13h.01M12 13h.01M15.5 13h.01M8.5 16.5h.01M12 16.5h.01M15.5 16.5h.01"/></svg>',
    },
  ];

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  /* The grapher sits at the site root beside index.html, so plain relative
     hrefs work from both. Kept as a function so a future product living in a
     subfolder only has to change here. */
  function hrefFor(p) { return p.href; }

  function panelHTML(currentId, panelId) {
    var items = PRODUCTS.map(function (p) {
      var here = p.id === currentId;
      return '<a class="fxhub-item' + (here ? ' is-here' : '') + '"'
        + (here ? ' aria-current="page"' : '')
        + ' href="' + esc(hrefFor(p)) + '">'
        + '<span class="fxhub-item-mark" aria-hidden="true">' + p.mark + '</span>'
        + '<span class="fxhub-item-text">'
        + '<span class="fxhub-item-name">' + esc(p.name)
        + '</span>'
        + '<span class="fxhub-item-tag">' + esc(p.tagline) + '</span>'
        + '</span>'
        + (here ? '<span class="fxhub-here">Open</span>' : '')
        + '</a>';
    }).join('');

    return '<div class="fxhub-panel" id="' + panelId + '" role="menu" hidden>'
      + '<div class="fxhub-panel-h">Flux</div>'
      + items
      + '<a class="fxhub-all" href="hub.html">All Flux apps →</a>'
      + '<div class="fxhub-foot">More coming. What is free stays free.</div>'
      + '</div>';
  }

  /* The planner mounts the hub twice — once in the desktop top bar, once in
     the phone header, only one of which is ever shown — so each mount gets
     its own ids. The first keeps the plain ones. */
  var mounted = 0;

  function mount(host) {
    if (!host || host.getAttribute('data-flux-hub-ready') === '1') return;
    var current = host.getAttribute('data-flux-hub') || '';
    host.setAttribute('data-flux-hub-ready', '1');
    host.classList.add('fxhub');
    var n = mounted++;
    var btnId = n ? 'fxhubBtn' + n : 'fxhubBtn';
    var panelId = n ? 'fxhubPanel' + n : 'fxhubPanel';

    host.innerHTML =
      '<button type="button" class="fxhub-btn" id="' + btnId + '" aria-haspopup="menu" aria-expanded="false" aria-controls="' + panelId + '" aria-label="Switch Flux app">'
      + '<span class="fxhub-btn-mark" aria-hidden="true">'
      + '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">'
      + '<circle cx="5" cy="5" r="2"/><circle cx="12" cy="5" r="2"/><circle cx="19" cy="5" r="2"/>'
      + '<circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/>'
      + '<circle cx="5" cy="19" r="2"/><circle cx="12" cy="19" r="2"/><circle cx="19" cy="19" r="2"/>'
      + '</svg></span>'
      + '<span class="fxhub-btn-label">Flux</span>'
      + '</button>'
      + panelHTML(current, panelId);

    var btn = host.querySelector('.fxhub-btn');
    var panel = host.querySelector('.fxhub-panel');

    function close() {
      panel.hidden = true;
      btn.setAttribute('aria-expanded', 'false');
      document.removeEventListener('click', onOutside, true);
      document.removeEventListener('keydown', onKey, true);
    }
    function open() {
      panel.hidden = false;
      btn.setAttribute('aria-expanded', 'true');
      /* Anchor left normally, but flip to the right edge when that would hang
         the panel off screen. The grapher puts this button at the right of its
         header, where a left-anchored 268px panel overflowed by 139px on a
         1280 viewport — measured, not guessed. Reset first so a resize between
         openings cannot leave it stuck on the wrong side. */
      panel.style.left = '';
      panel.style.right = '';
      var box = panel.getBoundingClientRect();
      if (box.right > document.documentElement.clientWidth - 8) {
        panel.style.left = 'auto';
        panel.style.right = '0';
      }
      /* Capture phase: the planner stops propagation on several of its own
         containers, and a bubble-phase listener would never hear the click
         that should dismiss this. */
      document.addEventListener('click', onOutside, true);
      document.addEventListener('keydown', onKey, true);
    }
    function onOutside(e) { if (!host.contains(e.target)) close(); }
    function onKey(e) { if (e.key === 'Escape') { close(); btn.focus(); } }

    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      if (panel.hidden) open(); else close();
    });
    // Following a link should not leave the menu hanging open behind the page.
    panel.addEventListener('click', function (e) {
      if (e.target.closest('a')) close();
    });
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
