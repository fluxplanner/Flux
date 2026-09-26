/* ════════════════════════════════════════════════════════════════════════
   FLUX · Staff motion (2026) — pairs with flux-staff-2026.css
   ------------------------------------------------------------------------
   Opening a staff page marks it .fx-staff-enter for a moment, so its cards
   rise in once, and counts its headline numbers up from zero.

   Why a class on open rather than an animation on the cards themselves: the
   dashboards redraw from scratch whenever data arrives, and the cloud sync
   pulls every few seconds. An animation on the cards would replay on every
   redraw, so a teacher reading the page would watch it flicker. Keying it to
   the moment the page becomes active means it plays when you arrive and not
   again until you leave and come back.

   Installs itself: it watches the staff panels for the `active` class that
   nav() in app.js puts on the page being shown.
   ════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (window.FluxStaffMotion) return;

  const PANELS = '.flux-edu-panel,[data-educator-work-panel],[data-staff-personal-panel]';
  const NUMBERS = '.tstat-num,.stat-number,.lh-stat-num,.ao-stat-num,.sw-stat-num,.spdx-stat > b';
  const ENTER_MS = 1300;

  function reduced() {
    try {
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return true;
      // The district kill switch for motion (enable_originkit_motion) and the
      // low-end device check both answer through FluxMotion.active().
      if (window.FluxMotion && typeof window.FluxMotion.active === 'function' && !window.FluxMotion.active()) return true;
      return document.documentElement.getAttribute('data-flux-perf') === 'on';
    } catch (_) {
      return false;
    }
  }

  /* Only plain whole numbers are counted: "0/2", "45%" and "–" are left as
     they are, and so is anything under 2, where a count is just a flicker. The
     real text is put back at the end, so nothing is ever left mid-count. */
  function countUp(root) {
    if (reduced()) return;
    root.querySelectorAll(NUMBERS).forEach((el) => {
      if (el.dataset.fxCounted) return;
      const text = el.textContent.trim();
      if (!/^\d{1,4}$/.test(text)) return;
      const end = Number(text);
      if (end < 2) return;
      el.dataset.fxCounted = '1';
      const start = performance.now();
      const dur = Math.min(900, 380 + end * 18);
      const tick = (now) => {
        if (!el.isConnected) return;
        const p = Math.min(1, (now - start) / dur);
        if (p >= 1) { el.textContent = text; return; }
        el.textContent = String(Math.round(end * (1 - Math.pow(1 - p, 3))));
        requestAnimationFrame(tick);
      };
      el.textContent = '0';
      requestAnimationFrame(tick);
    });
  }

  const timers = new WeakMap();
  const watchers = new WeakMap();

  function enter(panel) {
    if (reduced()) return;
    clearTimeout(timers.get(panel));
    watchers.get(panel)?.disconnect();
    panel.classList.remove('fx-staff-enter');
    void panel.offsetWidth;
    panel.classList.add('fx-staff-enter');
    countUp(panel);
    // Most of these pages fill in after a fetch; count what arrives while
    // the page is still opening.
    const mo = new MutationObserver(() => countUp(panel));
    mo.observe(panel, { childList: true, subtree: true });
    watchers.set(panel, mo);
    timers.set(panel, setTimeout(() => {
      panel.classList.remove('fx-staff-enter');
      mo.disconnect();
    }, ENTER_MS));
  }

  function install() {
    const panels = document.querySelectorAll(PANELS);
    if (!panels.length) return false;
    const seen = new WeakMap();
    panels.forEach((p) => seen.set(p, p.classList.contains('active')));
    const mo = new MutationObserver((records) => {
      records.forEach((r) => {
        const p = r.target;
        const now = p.classList.contains('active');
        if (now && !seen.get(p)) enter(p);
        seen.set(p, now);
      });
    });
    panels.forEach((p) => mo.observe(p, { attributes: true, attributeFilter: ['class'] }));
    // A staff page already open at boot gets its entrance too.
    panels.forEach((p) => { if (p.classList.contains('active')) enter(p); });
    return true;
  }

  function boot() {
    if (install()) return;
    let n = 0;
    const iv = setInterval(() => { if (install() || ++n > 40) clearInterval(iv); }, 250);
  }

  /* Escape for the staff pop-ups. These are built by hand (a div on <body>)
     rather than as .modal-overlay, so the planner's global Escape — which
     pops the overlay stack, then closes .modal-overlay — never saw them: New
     meeting note, Log PD, Edit availability, Customize modules and the school
     event forms could only be closed with their own buttons. The global
     handler runs first and marks the event handled when it closed something,
     so this only acts when nothing else did, and closes the newest one. */
  const STAFF_OVERLAYS = '#mnModalRoot,#pdModalRoot,#sfModal,#fluxWidgetConfigureModal,#fluxSchoolEvtFormRoot,.edu-fullscreen-modal';
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || e.defaultPrevented) return;
    const open = [...document.querySelectorAll(STAFF_OVERLAYS)].filter((el) => el.isConnected && el.getClientRects().length);
    const top = open[open.length - 1];
    if (!top) return;
    e.preventDefault();
    top.remove();
  });

  window.FluxStaffMotion = { enter, countUp };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
