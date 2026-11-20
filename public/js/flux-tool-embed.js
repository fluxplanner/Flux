/* ============================================================================
   FLUX TOOLS · flux-tool-embed.js
   The tool pages (balance.html, units.html …) are no longer apps of their own
   in Flux Suite (Azfer, 2026-11-18: "put all the new apps into the
   preexisting apps"). Each now lives inside the app it fits:

     Periodic Table  → Balance          Grapher    → Data, Lab
     Pixel           → Graph Paper      Flashcards → Spell
     Planner › Study tools → Units, Formulae (Science toolkit), Cite (English),
                             Score, Plan, Timetable, Timer (Get organised)

   The pages keep their own files, so their code and tests stay one copy; a
   host shows one in a frame, opened with ?embed=1, which drops the page's own
   header and chrome (flux-tool-embed-mode.js) and reports its height here.

   In a host:
     <button data-flux-tool="balance.html" data-flux-tool-title="Balance">…
       opens the tool in a sheet over the app (any page that loads this file).
     FluxToolEmbed.mount(el, 'units.html')
       draws it inline, growing to its content (the planner's Study tools).
   ========================================================================== */
(function () {
  'use strict';
  if (window.FluxToolEmbed) return;
  var TOOLS = ['paper.html', 'units.html', 'cite.html', 'balance.html', 'formulae.html', 'score.html', 'timer.html', 'plan.html', 'data.html', 'lab.html', 'spell.html', 'timetable.html'];
  var ok = function (page) { return TOOLS.indexOf(page) >= 0; };
  /* The hash as well as the query: a clean-URL server (npx serve, used by the
     tests) redirects page.html → /page and drops the query, never the hash. */
  var src = function (page) { return page + '?embed=1#embed'; };

  function css() {
    if (document.getElementById('fluxToolEmbedCss')) return;
    var s = document.createElement('style');
    s.id = 'fluxToolEmbedCss';
    s.textContent = '.ftx-frame{display:block;width:100%;border:0;background:transparent;min-height:420px}'
      + '.ftx-sheet{position:fixed;inset:0;z-index:2147482000;display:flex;flex-direction:column;background:var(--bg,#070b14)}'
      + '.ftx-bar{display:flex;align-items:center;gap:10px;padding:calc(8px + env(safe-area-inset-top,0px)) 12px 8px;border-bottom:1px solid var(--border,rgba(255,255,255,.1))}'
      + '.ftx-bar h2{margin:0;flex:1;font:800 1rem/1.2 system-ui,-apple-system,"Segoe UI",sans-serif;color:var(--text,#eaf1ff)}'
      + '.ftx-close{min-width:44px;min-height:44px;border-radius:10px;border:1px solid var(--border2,rgba(255,255,255,.14));background:transparent;color:var(--text,#eaf1ff);font-size:1.1rem;cursor:pointer}'
      + '.ftx-close:focus-visible{outline:2px solid var(--accent,#00c2ff);outline-offset:2px}'
      + '.ftx-sheet .ftx-frame{flex:1;height:100%}'
      + '.ftx-btn{display:inline-flex;align-items:center;gap:6px;min-height:36px;padding:0 12px;border-radius:10px;border:1px solid var(--border2,rgba(255,255,255,.14));background:transparent;color:var(--text,#eaf1ff);font:700 .85rem/1 system-ui,-apple-system,"Segoe UI",sans-serif;cursor:pointer;white-space:nowrap}'
      + '.ftx-btn:hover{border-color:var(--accent,#00c2ff)}.ftx-btn:focus-visible{outline:2px solid var(--accent,#00c2ff);outline-offset:2px}'
      + '@media (max-width:560px){.ftx-btn .ftx-lbl{display:none}}';
    (document.head || document.documentElement).appendChild(s);
  }

  function frame(page, title) {
    var f = document.createElement('iframe');
    f.className = 'ftx-frame';
    f.title = title || page;
    f.src = src(page);
    return f;
  }

  /* Inline: the frame grows to the height the page reports. */
  function mount(el, page, title) {
    if (!el || !ok(page)) return null;
    css();
    var f = frame(page, title);
    f.setAttribute('scrolling', 'no');
    el.innerHTML = '';
    el.appendChild(f);
    return f;
  }
  window.addEventListener('message', function (e) {
    if (e.origin !== location.origin || !e.data || typeof e.data.fluxToolHeight !== 'number') return;
    var frames = document.querySelectorAll('iframe.ftx-frame[scrolling="no"]');
    for (var i = 0; i < frames.length; i++) {
      if (frames[i].contentWindow === e.source) frames[i].style.height = Math.max(200, Math.ceil(e.data.fluxToolHeight) + 4) + 'px';
    }
  });

  /* A sheet over the whole app, closed with ✕ or Escape. */
  var sheet = null, opener = null;
  function close() {
    if (!sheet) return;
    sheet.remove(); sheet = null;
    document.documentElement.style.removeProperty('overflow');
    if (opener) { try { opener.focus(); } catch (e) { /* gone */ } }
  }
  function open(page, title, from) {
    if (!ok(page)) return;
    css(); close();
    opener = from || document.activeElement;
    sheet = document.createElement('div');
    sheet.className = 'ftx-sheet';
    sheet.setAttribute('role', 'dialog');
    sheet.setAttribute('aria-modal', 'true');
    sheet.setAttribute('aria-label', title || page);
    var bar = document.createElement('div'); bar.className = 'ftx-bar';
    var h = document.createElement('h2'); h.textContent = title || '';
    var x = document.createElement('button'); x.type = 'button'; x.className = 'ftx-close'; x.textContent = '✕';
    x.setAttribute('aria-label', 'Close ' + (title || 'tool'));
    x.addEventListener('click', close);
    bar.appendChild(h); bar.appendChild(x);
    sheet.appendChild(bar); sheet.appendChild(frame(page, title));
    document.body.appendChild(sheet);
    document.documentElement.style.overflow = 'hidden';
    x.focus();
  }
  document.addEventListener('keydown', function (e) { if (sheet && e.key === 'Escape') { e.preventDefault(); close(); } });
  document.addEventListener('click', function (e) {
    var b = e.target && e.target.closest && e.target.closest('[data-flux-tool]');
    if (!b) return;
    e.preventDefault();
    open(b.getAttribute('data-flux-tool'), b.getAttribute('data-flux-tool-title'), b);
  });

  window.FluxToolEmbed = { open: open, close: close, mount: mount, TOOLS: TOOLS };
})();
