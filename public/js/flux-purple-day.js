/* ============================================================================
   FLUX PURPLE DAY  ·  flux-purple-day.js
   March 26 is Purple Day, the world's day for epilepsy awareness. On it, Flux
   goes purple everywhere it runs — the planner, the hub, the landing page and
   every tool — and points people to Synara, the epilepsy app Flux builds and
   hosts with its partner Synara.

   - <html> gets data-purple-day and the class flux-purple-day. The accent
     override is !important so it beats the inline --accent the planner's
     theme engine sets; the class (not just the attribute) is what makes the
     planner's fluxOnAccent watcher recompute --on-accent for the new colour.
   - A banner: inline where a page has a [data-purple-day-slot], otherwise a
     small card in the corner. Dismissing it hides it everywhere for the year.
   - Nothing moves, fades or flashes. Some people with epilepsy are
     photosensitive; on this of all days the page stays still.
   - Preview it any day with ?purpleday in the address (kept for the tab);
     ?purpleday=0 ends the preview.

   Self-contained like flux-hub.js: a plain script on the standalone pages, and
   bundled into the planner.
   ========================================================================== */
(function () {
  'use strict';

  function isPurpleDay(d) { return d.getMonth() === 2 && d.getDate() === 26; }

  function previewing() {
    try {
      var q = new URLSearchParams(location.search);
      if (q.has('purpleday')) {
        if (q.get('purpleday') === '0') sessionStorage.removeItem('flux_purple_day_preview');
        else sessionStorage.setItem('flux_purple_day_preview', '1');
      }
      return sessionStorage.getItem('flux_purple_day_preview') === '1';
    } catch (e) { return false; }
  }

  var now = new Date();
  var on = isPurpleDay(now) || previewing();
  window.FluxPurpleDay = { active: on, isPurpleDay: isPurpleDay };
  if (!on) return;

  var root = document.documentElement;
  root.setAttribute('data-purple-day', '');
  root.classList.add('flux-purple-day');

  var css = ''
    // Lavender on dark themes, a deeper violet where the planner is light.
    + 'html.flux-purple-day{--accent:#a78bfa!important;--accent-rgb:167,139,250!important;'
    // landing.html draws with its own names.
    + '--cy:#c4b5fd!important;--vi:#7c4dff!important}'
    + 'html.flux-purple-day:has(body[data-theme="light"]){--accent:#7c3aed!important;--accent-rgb:124,58,237!important}'
    + '.fxpd{position:relative;display:flex;align-items:flex-start;gap:14px;padding:16px 18px;border-radius:18px;'
    + 'color:#f3edff;background:linear-gradient(155deg,rgba(156,122,255,.22),rgba(89,38,212,.10) 60%),#151026;'
    + 'border:1px solid rgba(167,139,250,.45);box-shadow:0 18px 44px -26px rgba(124,77,255,.9);'
    + "font-family:'Plus Jakarta Sans',system-ui,-apple-system,'Segoe UI',sans-serif;line-height:1.5;text-align:left}"
    + '.fxpd-ico{flex:none;display:grid;place-items:center;width:40px;height:40px;border-radius:12px;color:#fff;'
    + 'background:linear-gradient(135deg,#9c7aff,#5926d4)}'
    + '.fxpd-ico svg{width:22px;height:22px}'
    + '.fxpd-body{flex:1;min-width:0}'
    + '.fxpd-t{font-weight:800;font-size:1rem;letter-spacing:-.01em;margin:0 0 2px}'
    + '.fxpd-s{margin:0;font-size:.88rem;color:#d9ccff}'
    + '.fxpd-a{display:inline-block;margin-top:8px;font-weight:800;font-size:.88rem;color:#c4b5fd;text-decoration:none}'
    + '.fxpd-a:hover{text-decoration:underline}'
    + '.fxpd-x{flex:none;width:32px;height:32px;margin:-6px -8px 0 0;border:0;border-radius:10px;background:none;'
    + 'color:#c9b8f5;font-size:1.1rem;line-height:1;cursor:pointer}'
    + '.fxpd-x:hover{background:rgba(255,255,255,.08);color:#fff}'
    + '.fxpd-x:focus-visible,.fxpd-a:focus-visible{outline:2px solid #c4b5fd;outline-offset:2px}'
    + '.fxpd--float{position:fixed;z-index:900;right:16px;bottom:calc(84px + env(safe-area-inset-bottom,0px));'
    + 'width:min(380px,calc(100vw - 32px))}'
    + '@media (min-width:900px){.fxpd--float{bottom:20px}}'
    + '@media print{.fxpd{display:none!important}}';
  var style = document.createElement('style');
  style.id = 'flux-purple-day';
  style.textContent = css;
  (document.head || root).appendChild(style);

  var KEY = 'flux_purple_day_dismissed';
  var year = String(now.getFullYear());
  function dismissed() { try { return localStorage.getItem(KEY) === year; } catch (e) { return false; } }

  var RIBBON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
    + '<path d="M12 13.5c-2.6-3-4-5.4-4-7.2a4 4 0 0 1 8 0c0 1.8-1.4 4.2-4 7.2Z"/>'
    + '<path d="M12 13.5 7.5 21l-2-1.2 4.4-7.3"/><path d="M12 13.5l4.5 7.5 2-1.2-4.4-7.3"/></svg>';

  function banner(floating) {
    var el = document.createElement('section');
    el.className = 'fxpd' + (floating ? ' fxpd--float' : '');
    el.setAttribute('aria-label', 'Purple Day');
    el.innerHTML = '<span class="fxpd-ico">' + RIBBON + '</span>'
      + '<div class="fxpd-body">'
      + '<p class="fxpd-t">It’s Purple Day — epilepsy awareness</p>'
      + '<p class="fxpd-s">Around 50 million people live with epilepsy. If someone has a seizure: stay with them, '
      + 'keep them safe, turn them on their side, and time it. Call 911 if it lasts more than 5 minutes.</p>'
      + '<a class="fxpd-a" href="synara.html">Learn seizure first aid with Synara →</a>'
      + '</div>'
      + '<button type="button" class="fxpd-x" aria-label="Hide the Purple Day message">✕</button>';
    el.querySelector('.fxpd-x').addEventListener('click', function () {
      try { localStorage.setItem(KEY, year); } catch (e) { /* storage blocked: hide for now */ }
      el.remove();
    });
    return el;
  }

  function show() {
    if (dismissed() || document.querySelector('.fxpd')) return;
    var slot = document.querySelector('[data-purple-day-slot]');
    if (slot) slot.appendChild(banner(false));
    else if (document.body) document.body.appendChild(banner(true));
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', show);
  else show();
})();
