/**
 * FluxAppleMotion — iOS / Apple HIG–inspired motion layer (60fps, spring, morph).
 * Builds on Anime.js v4 + existing FluxAnim / FluxAnimeCatalog.
 *
 * Design rules (matched to Apple HIG / iOS 18):
 *   • Transforms + opacity + filter only on hot paths (compositor friendly).
 *   • Press scale 0.97 (subtle), release with bouncy spring (overshoot ~1.5%).
 *   • Sidebar / bottom-nav / segmented controls use morphing pill (FLIP).
 *   • Modal/sheet use damped spring; no linear easing anywhere user-visible.
 *   • Respects prefers-reduced-motion and data-flux-perf="on".
 */
import { animate, stagger, createSpring, createAnimatable } from 'animejs';

const APPLE_SPRING = {
  snappy: { stiffness: 480, damping: 34, mass: 1 },
  smooth: { stiffness: 320, damping: 32, mass: 1 },
  gentle: { stiffness: 240, damping: 28, mass: 1 },
  bouncy: { stiffness: 420, damping: 20, mass: 0.92 },
  release: { stiffness: 360, damping: 24, mass: 0.95 },
};

const APPLE_EASE = {
  standard: 'cubicBezier(0.25, 0.1, 0.25, 1)',
  decel: 'cubicBezier(0.16, 1, 0.3, 1)',
  accel: 'cubicBezier(0.4, 0, 1, 1)',
  emphasized: 'cubicBezier(0.34, 1.15, 0.64, 1)',
};

function prefersReducedMotion() {
  try {
    return (
      window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
      document.documentElement.classList.contains('flux-reduce-motion')
    );
  } catch (_) {
    return false;
  }
}

function perfSnappy() {
  try {
    return document.documentElement.getAttribute('data-flux-perf') === 'on';
  } catch (_) {
    return false;
  }
}

function motionAllowed() {
  return !prefersReducedMotion() && !perfSnappy();
}

function isCoarsePointer() {
  try {
    return window.matchMedia('(pointer: coarse)').matches;
  } catch (_) {
    return false;
  }
}

function spring(name) {
  return createSpring(APPLE_SPRING[name] || APPLE_SPRING.smooth);
}

function motion(fn) {
  if (motionAllowed() && typeof fn === 'function') fn();
}

// Press scale: morph pills already provide nav feedback, so exclude
// .nav-item/.bnav-item from the press list — that compounds with the morph
// animation and reads as jitter on tab switch.
const PRESS_SELECTOR = [
  'button:not(:disabled):not([data-flux-no-press]):not(.nav-item):not(.bnav-item)',
  '.btn',
  '.btn-sec',
  '.fab-btn',
  '.fab-action',
  '.fsdb-widget-btn',
  '.fsdb-quick-card',
  '.sr-pin',
  '.sr-shortcut-btn',
  '.spd-card',
  '.stab',
  '.sph-tab',
  '.tmode-btn',
  '.view-btn',
  '.teacher-action-btn',
  '.edu-action-btn',
  '.sw-action-btn',
  '.sw-quick-btn',
  '.more-sheet-item',
].join(',');

// Surfaces that get hover magnetism (desktop only)
const MAGNET_SELECTOR = [
  '.fsdb-widget-btn',
  '.fsdb-quick-card',
  '.spd-card',
  '.fab-btn',
  '.fab-action',
].join(',');

// Pill morph groups: [{ host, item, activeCls }]
const PILL_GROUPS = [
  { host: '#sidebar .nav-scroll, #sidebar .sidebar-nav', item: '.nav-item', activeCls: 'active', shape: 'rect' },
  { host: '.bottom-nav', item: '.bnav-item', activeCls: 'active', shape: 'rect' },
  { host: '.stabs', item: '.stab', activeCls: 'active', shape: 'pill' },
  { host: '.tmode-toggle, .tmode-segmented, .dash-toolbar-views, #filterChips, #notes .tmode-row, #timer .tmode-row', item: '.tmode-btn, .view-btn', activeCls: 'active', shape: 'pill' },
  { host: '.sph-tabs', item: '.sph-tab', activeCls: 'active', shape: 'pill' },
  { host: '.view-toggle, .view-switcher', item: '.view-btn', activeCls: 'active', shape: 'pill' },

  /* The rest of the planner's tab strips. Every one of these already looked
     and behaved like the strips above; the highlight jumped rather than slid
     purely because this list is hand-maintained and they were never added to
     it. "tab" is the same idea as "rect" with a smaller radius, which is what
     these strips use — 8 to 10px rather than the sidebar's 14. */
  { host: '.cv-tabs', item: '.cv-tab', activeCls: 'active', shape: 'tab' },
  { host: '.g-hub-tabs', item: '.g-hub-tab', activeCls: 'active', shape: 'tab' },
  { host: '.canvas-tab-bar, .canvas-quick-tabs', item: '.canvas-tab', activeCls: 'active', shape: 'tab' },
  { host: '.class-tabs', item: '.class-tab', activeCls: 'active', shape: 'tab' },
  { host: '.efm-tabs', item: '.efm-tab', activeCls: 'active', shape: 'tab' },
  { host: '.ao-dir-tabs', item: '.ao-dir-tab', activeCls: 'active', shape: 'tab' },
  { host: '.school-work-tabs', item: '.school-work-tab', activeCls: 'active', shape: 'pill' },
  { host: '.ref-tool-tabs', item: '.ref-tool-tab', activeCls: 'active', shape: 'pill' },
];

/* Derived, not hand-written. The click listener below used to carry its own
   copy of these selectors, so adding a group to the list above would leave it
   out of the one path that catches a tab press the nav events do not — and the
   pill would work everywhere except when you actually clicked the tab. */
const PILL_ITEM_SELECTOR = PILL_GROUPS.map((g) => g.item).join(',');

let _pressTarget = null;
let _pillRegistry = new WeakMap();
let _booted = false;

function markPressable(el) {
  if (!el || el.closest('[data-flux-no-press]')) return;
  if (!el.matches(PRESS_SELECTOR)) return;
  el.classList.add('flux-apple-press-target');
}

/* ───────── Press system (replaces existing :active scale conflict) ───────── */

function initPressSystem() {
  document.addEventListener(
    'pointerdown',
    (e) => {
      if (!motionAllowed() || e.button !== 0) return;
      const el = e.target.closest(PRESS_SELECTOR);
      if (!el || el.closest('[data-flux-no-press]')) return;
      _pressTarget = el;
      el.classList.add('is-pressed');
      markPressable(el);
      motion(() => {
        animate(el, {
          scale: 0.972,
          duration: 140,
          ease: spring('snappy'),
        });
      });
    },
    { capture: true },
  );

  const release = () => {
    if (!_pressTarget) return;
    const el = _pressTarget;
    _pressTarget = null;
    el.classList.remove('is-pressed');
    motion(() => {
      animate(el, {
        scale: 1,
        duration: 420,
        ease: spring('bouncy'),
      });
    });
  };

  document.addEventListener('pointerup', release, { capture: true });
  document.addEventListener('pointercancel', release, { capture: true });
  document.addEventListener('pointerleave', release, { capture: true });
}

/* ───────── Magnetic hover (desktop only) ───────── */

function initMagnetics() {
  if (isCoarsePointer()) return;
  const STRENGTH = 0.18;
  let active = null;
  let raf = null;

  function onMove(e) {
    if (!active) return;
    const r = active.getBoundingClientRect();
    const dx = e.clientX - (r.left + r.width / 2);
    const dy = e.clientY - (r.top + r.height / 2);
    if (raf) cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => {
      if (!active) return;
      active.style.transform = `translate3d(${dx * STRENGTH}px, ${dy * STRENGTH}px, 0)`;
    });
  }

  document.addEventListener(
    'pointerenter',
    (e) => {
      if (!motionAllowed()) return;
      const t = e.target;
      if (!(t instanceof Element)) return;
      const el = t.closest(MAGNET_SELECTOR);
      if (!el || el.closest('[data-flux-no-magnet]')) return;
      active = el;
      el.style.willChange = 'transform';
      el.style.transition = 'transform 220ms cubic-bezier(0.34, 1.15, 0.64, 1)';
    },
    { capture: true },
  );

  document.addEventListener(
    'pointerleave',
    (e) => {
      const t = e.target;
      if (!(t instanceof Element) || !active) return;
      const el = t.closest(MAGNET_SELECTOR);
      if (!el || el !== active) return;
      active.style.transform = '';
      setTimeout(() => {
        if (el.style.transform === '') {
          el.style.willChange = '';
          el.style.transition = '';
        }
      }, 240);
      active = null;
    },
    { capture: true },
  );

  document.addEventListener('pointermove', onMove, { capture: true, passive: true });
}

/* ───────── Generic morphing pill (FLIP) for sidebar/bottom-nav/segmented ───────── */

function ensurePillFor(host, shape) {
  const existing = _pillRegistry.get(host);
  if (existing) return existing;
  const pill = document.createElement('div');
  pill.className = `flux-morph-pill flux-morph-pill--${shape}`;
  pill.setAttribute('aria-hidden', 'true');
  pill.dataset.shape = shape;
  pill.dataset.placed = '0';
  // Insert as first child so other items render above
  if (getComputedStyle(host).position === 'static') {
    host.style.position = 'relative';
  }
  host.prepend(pill);
  // Defer animatable creation until first placement so it picks up real values.
  const entry = { pill, anim: null, lastTarget: null, placed: false };
  _pillRegistry.set(host, entry);
  return entry;
}

const _close = (a, b) => Math.abs(a - b) < 0.5;

function placePill(host, target, shape, opts) {
  if (!host || !target) return;
  const entry = ensurePillFor(host, shape);
  const pill = entry.pill;
  const hostRect = host.getBoundingClientRect();
  const tRect = target.getBoundingClientRect();
  const x = tRect.left - hostRect.left + host.scrollLeft;
  const y = tRect.top - hostRect.top + host.scrollTop;
  const w = tRect.width;
  const h = tRect.height;
  if (!w || !h) return; // host hidden or target collapsed — skip until visible
  entry.lastTarget = target;

  if (!entry.placed) {
    // Snap to first target so subsequent morphs animate from a real value.
    pill.style.transform = `translateX(${x}px) translateY(${y}px)`;
    pill.style.width = `${w}px`;
    pill.style.height = `${h}px`;
    pill.dataset.placed = '1';
    entry.placed = true;
    entry.lastX = x;
    entry.lastY = y;
    entry.lastW = w;
    entry.lastH = h;
    return;
  }
  // Sub-pixel tolerance dedup — avoids re-firing animation on floating-point noise.
  // opts.force skips it: lastX/Y/W/H record where the pill was *sent*, not where
  // it arrived, so a tween interrupted mid-flight (see below) looks "already
  // there" and would never be corrected.
  if (
    !opts?.force &&
    _close(entry.lastX, x) && _close(entry.lastY, y) && _close(entry.lastW, w) && _close(entry.lastH, h)
  ) {
    pill.dataset.placed = '1';
    return;
  }
  // Animate via animate() — anime.js v4 spring + direct property targets.
  // Not while the document is hidden: anime.js drives tweens off
  // requestAnimationFrame, which the browser freezes for background tabs. The
  // tween would be started, never advance, and strand the highlight on the
  // previous tab — the whole point of the phone-lock/app-switch case. Snap
  // instead, so the pill is already correct when the user looks again.
  if (motionAllowed() && !document.hidden) {
    try {
      // Cancel any in-flight animation on this pill so we don't stack tweens.
      if (entry.currentAnim?.pause) entry.currentAnim.pause();
      entry.currentAnim = animate(pill, {
        translateX: x,
        translateY: y,
        width: w,
        height: h,
        duration: 340,
        ease: spring('snappy'),
      });
    } catch (_) {
      pill.style.transform = `translateX(${x}px) translateY(${y}px)`;
      pill.style.width = `${w}px`;
      pill.style.height = `${h}px`;
    }
  } else {
    pill.style.transform = `translateX(${x}px) translateY(${y}px)`;
    pill.style.width = `${w}px`;
    pill.style.height = `${h}px`;
  }
  entry.lastX = x;
  entry.lastY = y;
  entry.lastW = w;
  entry.lastH = h;
  pill.dataset.placed = '1';
}

function hidePill(host) {
  const entry = _pillRegistry.get(host);
  if (!entry) return;
  entry.pill.dataset.placed = '0';
}

/**
 * `item` may be a selector list ('.tmode-btn, .view-btn'). Appending the active
 * class to the whole string only qualifies the *last* entry, so
 * '.tmode-btn, .view-btn.active' matches the first .tmode-btn regardless of
 * which one is active — that is why the filter-chip highlight sat on "Active"
 * and never moved. Qualify every entry instead.
 */
function activeSelectorFor(group) {
  return group.item
    .split(',')
    .map((sel) => `${sel.trim()}.${group.activeCls}`)
    .join(',');
}

function syncPillGroup(group, opts) {
  const activeSelector = activeSelectorFor(group);
  document.querySelectorAll(group.host).forEach((host) => {
    if (!host || !host.isConnected) return;
    const active = host.querySelector(activeSelector);
    if (active) placePill(host, active, group.shape, opts);
    else hidePill(host);
  });
}

function syncAllPills(opts) {
  PILL_GROUPS.forEach((group) => syncPillGroup(group, opts));
}

let _syncRaf1 = null;
let _syncRaf2 = null;
let _syncTimer = null;
function scheduleSyncAllPills() {
  // Re-arm rather than latch. The old version set a boolean it only cleared
  // inside the rAF callback, so if rAF never ran — which is exactly what
  // happens the moment a phone locks or the user switches apps — the flag
  // stuck at true and every later navigation was silently dropped for the rest
  // of the page's life. The highlight froze on whichever tab was open then.
  if (_syncRaf1) cancelAnimationFrame(_syncRaf1);
  if (_syncRaf2) cancelAnimationFrame(_syncRaf2);
  clearTimeout(_syncTimer);
  // Two rAFs: first lets nav() finish synchronous DOM updates,
  // second ensures browser has reflowed before we read rects.
  _syncRaf1 = requestAnimationFrame(() => {
    _syncRaf2 = requestAnimationFrame(() => {
      _syncRaf1 = _syncRaf2 = null;
      syncAllPills();
    });
  });
  // Timers keep running while rAF is frozen, so this is the only path that
  // fires for a background navigation. placePill dedups, so on the normal
  // foreground path it costs a few rect reads and nothing else.
  _syncTimer = setTimeout(() => { syncAllPills(); }, 150);
}

function initPillMorph() {
  syncAllPills();

  // One coalesced sync per frame, regardless of how many triggers fire.
  document.addEventListener('flux-nav', scheduleSyncAllPills);
  document.addEventListener('flux-dash-board-rendered', scheduleSyncAllPills);

  // Belt-and-suspenders: also schedule on direct nav-item / bnav-item / tab clicks.
  document.addEventListener(
    'click',
    (e) => {
      const t = e.target;
      if (!(t instanceof Element)) return;
      if (t.closest(PILL_ITEM_SELECTOR)) {
        scheduleSyncAllPills();
      }
    },
    { capture: true, passive: true },
  );

  // Recalc on resize / orientation
  let resizeRaf = null;
  window.addEventListener(
    'resize',
    () => {
      if (resizeRaf) cancelAnimationFrame(resizeRaf);
      resizeRaf = requestAnimationFrame(syncAllPills);
    },
    { passive: true },
  );
  window.addEventListener('orientationchange', () => setTimeout(syncAllPills, 100), { passive: true });

  // Coming back from a locked screen or another app. Anything that moved while
  // we were hidden left the pill wherever its last rendered frame put it, and
  // lastX/Y/W/H already claim the destination was reached — so force past the
  // dedup and re-place from scratch.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) return;
    syncAllPills({ force: true });
  });

  // Sync when a registered host scrolls (sidebar nav-scroll only).
  document.addEventListener(
    'scroll',
    (e) => {
      const host = e.target;
      if (!(host instanceof Element)) return;
      const entry = _pillRegistry.get(host);
      if (!entry || !entry.lastTarget) return;
      placePill(host, entry.lastTarget, entry.pill.dataset.shape || 'rect');
    },
    { capture: true, passive: true },
  );
}

/* ───────── Panel entry + content stagger ───────── */

let _staggerScheduled = false;
let _lastPanelId = null;

function staggerPanelContent(panel) {
  if (!panel) return;
  // Sweep up any previously-staggered card left at partial opacity from an
  // interrupted prior tween (user navigated panels mid-reveal). Without this
  // they'd stay hidden forever because the selector below excludes them.
  // Sweep document-wide, not just this panel: switching tabs faster than the
  // reveal finishes strands cards in the panel you *left*, and returning to it
  // is not guaranteed. Also check transform, not only opacity — an interrupted
  // tween often leaves scale(0.97) with opacity already cleared, which the old
  // opacity-only test walked straight past and left the card invisible.
  document.querySelectorAll('.flux-apple-staggered').forEach((el) => {
    const partialOpacity = el.style.opacity !== '' && parseFloat(el.style.opacity) < 1;
    const leftoverTransform = !!el.style.transform && el.style.transform !== 'none';
    if (partialOpacity || leftoverTransform) {
      el.style.removeProperty('opacity');
      el.style.removeProperty('transform');
    }
  });
  const els = panel.querySelectorAll(
    [
      '.card:not(.flux-apple-staggered)',
      '.fsdb-widget:not(.flux-apple-staggered)',
      '.teacher-section:not(.flux-apple-staggered)',
      '.sw-col:not(.flux-apple-staggered)',
      '.sr-section:not(.flux-apple-staggered)',
      '.staff-personal-dash .spd-card:not(.flux-apple-staggered)',
    ].join(','),
  );
  if (!els.length) return;
  // Mark everything so nothing is re-animated later, but only reveal the first
  // few. Beyond roughly a screenful the stagger is invisible anyway — the cards
  // are below the fold — while still adding delay to the tail of the animation.
  const all = Array.prototype.slice.call(els);
  all.forEach((el) => el.classList.add('flux-apple-staggered'));
  const els2 = all.slice(0, 6);
  all.slice(6).forEach((el) => {
    el.style.removeProperty('opacity');
    el.style.removeProperty('transform');
  });
  if (!els2.length) return;
  motion(() => {
    animate(els2, {
      opacity: [0, 1],
      translateY: [18, 0],
      scale: [0.97, 1],
      // 28ms x 42 cards (Settings) meant the last card landed ~1.6s after the
      // click, which reads as lag rather than polish. Halved once, then tuned
      // again: 6 cards x 10ms + 200ms lands the last one at ~250ms, in the same
      // band as the login screen the owner points to as the target feel. The
      // element list is capped above so a long panel cannot stretch the reveal.
      delay: stagger(10, { from: 'first' }),
      duration: 200,
      ease: spring('smooth'),
      // Clear inline styles so an interrupted tween can't leave the card
      // stuck. Without this, switching panels mid-animation freezes the card
      // at e.g. opacity 0.44, translateY 18px.
      onComplete: () => {
        els2.forEach((el) => {
          el.style.removeProperty('opacity');
          el.style.removeProperty('transform');
        });
      },
    });
  });
}

function panelEnter(panel) {
  if (!panel) return;
  motion(() => {
    // Cancel any CSS animation collision — JS takes over
    panel.style.animation = 'none';
    animate(panel, {
      // No `filter` here. Animating blur meant writing style.filter on the
      // panel every frame for 460ms, and each write re-rasterizes the whole
      // panel subtree — Settings alone is ~1,100 nodes. That was the stutter on
      // every tab click. opacity/translateY/scale are composited, so the motion
      // reads the same but costs the GPU almost nothing.
      opacity: [0, 1],
      translateY: [14, 0],
      scale: [0.99, 1],
      // 460ms was long enough to read as waiting. Study Tools feels instant
      // because its subject swap is ~320ms on one small element; this brings the
      // panel closer to that without losing the movement.
      duration: 300,
      ease: spring('smooth'),
      onComplete: () => {
        panel.style.animation = '';
      },
    });
    staggerPanelContent(panel);
  });
}

function hideDashboardChromeForTransition(nextPanelId) {
  if (nextPanelId === 'dashboard') return;
  try {
    if (typeof window.fluxSyncDashboardPanelVisibility === 'function') {
      window.fluxSyncDashboardPanelVisibility(nextPanelId);
    }
  } catch (_) {}
  const dash = document.getElementById('dashboard');
  if (dash) dash.classList.add('flux-dash-vt-hide');
}

function transitionPanels(applyDom, ctx = {}) {
  const panelId = ctx.panelId || '';
  const runAfter = () => {
    _lastPanelId = panelId;
    try {
      if (typeof window.fluxSyncDashboardPanelVisibility === 'function') {
        window.fluxSyncDashboardPanelVisibility(panelId);
      }
    } catch (_) {}
    document.getElementById('dashboard')?.classList.remove('flux-dash-vt-hide');
    requestAnimationFrame(syncAllPills);
  };
  hideDashboardChromeForTransition(panelId);
  // The View Transitions API snapshots the whole page and crossfades it. That
  // snapshot is a full-viewport rasterize on every tab click, and it is the
  // cost — not the animation layered on top of it. This was already bypassed
  // under 768px as "the main cause of tab-switch lag on mobile"; desktop kept
  // paying it, and desktop is where the owner reported the lag, twice.
  //
  // Skipping it does not mean losing the motion: the panel still animates in
  // via fluxApplePanelEnter (opacity + transform, composited, at the 0.18s
  // snap duration the login screen uses). Same look, none of the per-click
  // snapshot cost.
  applyDom();
  runAfter();
}

function scheduleStaggerScan() {
  if (_staggerScheduled) return;
  _staggerScheduled = true;
  requestAnimationFrame(() => {
    _staggerScheduled = false;
    const panel = document.querySelector('.main-content > .panel.active');
    if (panel) staggerPanelContent(panel);
    requestAnimationFrame(syncAllPills);
  });
}

/* ───────── Modal / Sheet / FAB / Toast upgrade hooks ───────── */

function springModalOpen(overlay, card) {
  motion(() => {
    if (overlay) {
      animate(overlay, {
        opacity: [0, 1],
        backdropFilter: ['blur(0px)', 'blur(18px)'],
        duration: 260,
        ease: APPLE_EASE.decel,
      });
    }
    if (card) {
      card.style.transformOrigin = '50% 100%';
      animate(card, {
        opacity: [0, 1],
        translateY: [40, 0],
        scale: [0.94, 1],
        duration: 520,
        ease: spring('bouncy'),
      });
    }
  });
}

function springModalClose(overlay, card, done) {
  if (!motionAllowed()) {
    done?.();
    return;
  }
  let pending = 0;
  const finish = () => {
    pending--;
    if (pending <= 0) done?.();
  };
  if (overlay) {
    pending++;
    animate(overlay, {
      opacity: [1, 0],
      duration: 200,
      ease: APPLE_EASE.accel,
      onComplete: finish,
    });
  }
  if (card) {
    pending++;
    animate(card, {
      opacity: [1, 0],
      translateY: [0, 24],
      scale: [1, 0.96],
      duration: 220,
      ease: APPLE_EASE.accel,
      onComplete: finish,
    });
  }
  if (pending === 0) done?.();
}

function springSheetOpen(sheet, overlay) {
  motion(() => {
    // The open/closed STATE lives in CSS classes (.open) — these inline
    // animation styles must not outlive the animation, or a later
    // class-based close can't take effect (wedged-sheet bug). Clear them
    // when the spring settles, with a timeout fallback in case the
    // animation is interrupted and never completes.
    const clearInline = () => {
      try {
        if (sheet) sheet.style.transform = '';
        if (overlay) overlay.style.opacity = '';
      } catch (_) {}
    };
    setTimeout(clearInline, 700);
    if (overlay) {
      animate(overlay, {
        opacity: [0, 1],
        duration: 200,
        ease: APPLE_EASE.decel,
      });
    }
    if (sheet) {
      const anim = animate(sheet, {
        translateY: ['100%', '0%'],
        duration: 560,
        ease: spring('release'),
        onComplete: clearInline,
      });
      // Let the owner (closeMobileSheet) kill a mid-flight open spring so a
      // close during the 560ms window can't be overwritten by later frames.
      sheet._fluxSheetOpenCancel = () => {
        try { anim.cancel ? anim.cancel() : anim.pause?.(); } catch (_) {}
        clearInline();
        delete sheet._fluxSheetOpenCancel;
      };
      const items = sheet.querySelectorAll('.more-sheet-item');
      if (items.length) {
        animate(items, {
          opacity: [0, 1],
          translateY: [12, 0],
          delay: stagger(28, { start: 120 }),
          duration: 380,
          ease: spring('smooth'),
        });
      }
    }
  });
}

function fabPress(el) {
  if (!el || !motionAllowed()) return;
  animate(el, {
    rotate: [0, 90, 0],
    scale: [1, 0.94, 1],
    duration: 520,
    ease: spring('bouncy'),
  });
}

function toastIn(el) {
  if (!el || !motionAllowed()) return;
  animate(el, {
    opacity: [0, 1],
    translateY: [-24, 0],
    scale: [0.94, 1],
    duration: 460,
    ease: spring('bouncy'),
  });
}

function toastOut(el, done) {
  if (!el) {
    done?.();
    return;
  }
  if (!motionAllowed()) {
    done?.();
    return;
  }
  animate(el, {
    opacity: [1, 0],
    translateY: [0, -16],
    scale: [1, 0.96],
    duration: 220,
    ease: APPLE_EASE.accel,
    onComplete: () => done?.(),
  });
}

/* ───────── Focus ring spring on inputs ───────── */

function initFocusRing() {
  document.addEventListener(
    'focusin',
    (e) => {
      if (!motionAllowed()) return;
      const el = e.target;
      if (!(el instanceof HTMLElement)) return;
      if (!el.matches('input, textarea, select, [contenteditable="true"]')) return;
      if (el.closest('[data-flux-no-focus-ring]')) return;
      el.classList.add('flux-apple-focus');
      motion(() => {
        animate(el, {
          scale: [1, 1.012, 1],
          duration: 420,
          ease: spring('release'),
        });
      });
    },
    { capture: true },
  );
  document.addEventListener(
    'focusout',
    (e) => {
      const el = e.target;
      if (el instanceof HTMLElement) el.classList.remove('flux-apple-focus');
    },
    { capture: true },
  );
}

/* ───────── Hook into existing FluxAnim ───────── */

function upgradeFluxAnim() {
  const FA = window.FluxAnim;
  if (!FA || FA._fluxApplePatched) return;

  FA.panelFlash = (el) => {
    if (el) panelEnter(el);
  };

  const origTasksEnter = FA.tasksEnter;
  FA.tasksEnter = (els) => {
    if (!els?.length) {
      if (typeof origTasksEnter === 'function') origTasksEnter(els);
      return;
    }
    motion(() => {
      animate(els, {
        opacity: [0, 1],
        translateY: [14, 0],
        scale: [0.98, 1],
        delay: stagger(26, { from: 'first' }),
        duration: 400,
        ease: spring('snappy'),
      });
    });
  };

  FA.taskEnterSingle = (el) => {
    if (!el) return;
    motion(() => {
      animate(el, {
        opacity: [0, 1],
        translateY: [16, 0],
        scale: [0.97, 1],
        duration: 460,
        ease: spring('bouncy'),
      });
    });
  };

  FA.modalOpen = (overlay, card) => springModalOpen(overlay, card);
  FA.modalClose = (overlay, card, done) => springModalClose(overlay, card, done);
  FA.sheetOpen = (sheet, overlay) => springSheetOpen(sheet, overlay);

  const origToastIn = FA.toastIn;
  FA.toastIn = (el) => {
    if (motionAllowed()) toastIn(el);
    else if (typeof origToastIn === 'function') origToastIn(el);
  };

  const origToastOut = FA.toastOut;
  FA.toastOut = (el, done) => {
    if (motionAllowed()) toastOut(el, done);
    else if (typeof origToastOut === 'function') origToastOut(el, done);
    else done?.();
  };

  FA._fluxApplePatched = true;
}

/* ───────── Dynamic content observer (throttled) ───────── */

function observeDynamicContent() {
  const main = document.getElementById('flux-main');
  if (!main) return;
  let pending = false;
  const mo = new MutationObserver((mutations) => {
    if (pending) return;
    let hit = false;
    for (const m of mutations) {
      if (m.addedNodes?.length) {
        for (const n of m.addedNodes) {
          if (n.nodeType === 1 && n.matches?.('.card, .fsdb-widget, .teacher-section, .sw-col, .sr-section, .spd-card')) {
            hit = true;
            break;
          }
        }
        if (hit) break;
      }
    }
    if (!hit) return;
    pending = true;
    requestAnimationFrame(() => {
      pending = false;
      scheduleStaggerScan();
    });
  });
  mo.observe(main, { childList: true, subtree: true });

  // FAB tap hook
  document.addEventListener(
    'click',
    (e) => {
      const el = e.target.closest('.fab-btn');
      if (!el) return;
      fabPress(el);
    },
    { capture: true },
  );
}

/* ───────── Boot ───────── */

function boot() {
  if (_booted || !motionAllowed()) return;
  _booted = true;
  document.documentElement.classList.add('flux-apple-motion');
  initPressSystem();
  initMagnetics();
  initPillMorph();
  initFocusRing();
  upgradeFluxAnim();
  observeDynamicContent();
  document.querySelectorAll(PRESS_SELECTOR).forEach(markPressable);
}

function tryBootWhenAppVisible() {
  const app = document.getElementById('app');
  if (app?.classList.contains('visible')) {
    boot();
    return;
  }
  const onVisible = () => {
    boot();
    if (typeof window.initFluxAnimeApp === 'function') {
      try {
        window.initFluxAnimeApp();
      } catch (_) {}
    }
  };
  // B5.2: shared narrow #app watcher instead of a subtree-wide class observer.
  if (window.FluxDomWalker?.onAppVisible) {
    FluxDomWalker.onAppVisible(onVisible);
    return;
  }
  const obs = new MutationObserver(() => {
    if (document.getElementById('app')?.classList.contains('visible')) {
      obs.disconnect();
      onVisible();
    }
  });
  obs.observe(document.documentElement, { attributes: true, subtree: true, attributeFilter: ['class'] });
}

window.FluxAppleMotion = {
  spring,
  springPreset: (n) => APPLE_SPRING[n],
  transitionPanels,
  panelEnter,
  staggerPanelContent,
  syncAllPills,
  springModalOpen,
  springModalClose,
  springSheetOpen,
  fabPress,
  toastIn,
  toastOut,
  boot,
  motionAllowed,
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', tryBootWhenAppVisible, { once: true });
} else {
  tryBootWhenAppVisible();
}
