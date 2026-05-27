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
];

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

function placePill(host, target, shape) {
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
  if (_close(entry.lastX, x) && _close(entry.lastY, y) && _close(entry.lastW, w) && _close(entry.lastH, h)) {
    pill.dataset.placed = '1';
    return;
  }
  // Animate via animate() — anime.js v4 spring + direct property targets.
  if (motionAllowed()) {
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

function syncPillGroup(group) {
  document.querySelectorAll(group.host).forEach((host) => {
    if (!host || !host.isConnected) return;
    const active = host.querySelector(`${group.item}.${group.activeCls}`);
    if (active) placePill(host, active, group.shape);
    else hidePill(host);
  });
}

function syncAllPills() {
  PILL_GROUPS.forEach(syncPillGroup);
}

let _syncScheduled = false;
function scheduleSyncAllPills() {
  if (_syncScheduled) return;
  _syncScheduled = true;
  // Two rAFs: first lets nav() finish synchronous DOM updates,
  // second ensures browser has reflowed before we read rects.
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      _syncScheduled = false;
      syncAllPills();
    });
  });
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
      if (
        t.closest('.nav-item, .bnav-item, .stab, .sph-tab, .tmode-btn, .view-btn')
      ) {
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
  els.forEach((el) => el.classList.add('flux-apple-staggered'));
  motion(() => {
    animate(els, {
      opacity: [0, 1],
      translateY: [18, 0],
      scale: [0.97, 1],
      delay: stagger(28, { from: 'first' }),
      duration: 460,
      ease: spring('smooth'),
    });
  });
}

function panelEnter(panel) {
  if (!panel) return;
  motion(() => {
    // Cancel any CSS animation collision — JS takes over
    panel.style.animation = 'none';
    animate(panel, {
      opacity: [0, 1],
      translateY: [14, 0],
      scale: [0.99, 1],
      filter: ['blur(6px)', 'blur(0px)'],
      duration: 460,
      ease: spring('smooth'),
      onComplete: () => {
        panel.style.animation = '';
      },
    });
    staggerPanelContent(panel);
  });
}

function transitionPanels(applyDom, ctx = {}) {
  const panelId = ctx.panelId || '';
  const runAfter = () => {
    _lastPanelId = panelId;
    requestAnimationFrame(syncAllPills);
  };
  if (!motionAllowed() || typeof document.startViewTransition !== 'function') {
    applyDom();
    runAfter();
    return;
  }
  try {
    const vt = document.startViewTransition(() => applyDom());
    Promise.resolve(vt?.finished).then(runAfter).catch(runAfter);
  } catch (_) {
    applyDom();
    runAfter();
  }
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
    if (overlay) {
      animate(overlay, {
        opacity: [0, 1],
        duration: 200,
        ease: APPLE_EASE.decel,
      });
    }
    if (sheet) {
      animate(sheet, {
        translateY: ['100%', '0%'],
        duration: 560,
        ease: spring('release'),
      });
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
  const obs = new MutationObserver(() => {
    if (document.getElementById('app')?.classList.contains('visible')) {
      obs.disconnect();
      boot();
      if (typeof window.initFluxAnimeApp === 'function') {
        try {
          window.initFluxAnimeApp();
        } catch (_) {}
      }
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
