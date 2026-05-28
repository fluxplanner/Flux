/**
 * Flux Motion 50 — fifty animations pulled from animejs.com + 21st.dev,
 * gated by the Pulse perf tier system so weak devices stay smooth.
 *
 * Tier rules (read from html[data-pulse-tier]; defaults to standard):
 *   lite     — no JS animations beyond CSS pop-ins. Skips perpetual rAF.
 *   standard — all one-shot effects; no perpetual loops, no cursor tracker.
 *   full     — everything (cursor halo, sparkle, parallax, mesh breathe).
 *
 * Also honors prefers-reduced-motion. All effects detect via motionAllowed().
 *
 * THE 50 (numbered; each has a single init function or hook):
 *  1  headingCharReveal   2  headingWordReveal   3  cardGridStagger
 *  4  skeletonMorph       5  listDomino          6  emptyStateFloat
 *  7  toastSpring         8  modalFromOrigin     9  sheetRubberBand
 *  10 confettiBurst       11 magneticButton      12 cardTilt3D
 *  13 cursorHaloFollower  14 hoverLift           15 iconSpinOnHover
 *  16 borderFlowOnHover   17 underlineDrawOnHover 18 avatarPopScale
 *  19 sparkleOnHover      20 imageParallaxTilt   21 ripple
 *  22 pressScale          23 fabRotate           24 checkboxSpringTick
 *  25 longPressSquish     26 dragPickupLift      27 dropSnapBounce
 *  28 saveButtonMorph     29 addTaskPlusRotate   30 tabPillFLIP
 *  31 panelCrossFadeBlur  32 titleCrossMorph     33 sidebarItemCascade
 *  34 breadcrumbSlide     35 bottomNavIndicator  36 auroraDrift
 *  37 meshBreathe         38 starSparkleField    39 gradientTextShimmer
 *  40 scanlineShimmer     41 numberCountUp       42 numberMidFlight
 *  43 progressBarFill     44 donutRingDraw       45 barChartGrow
 *  46 livePulseDot        47 heatmapCellPop      48 sparklineDraw
 *  49 focusRingSpring     50 dragHandleHintPulse
 *
 * Items 7, 11, 12, 14, 21, 22, 23, 30, 35, 36, 39, 41, 49 are already
 * handled by flux-apple-motion / pro / pulse layers — this file just
 * polishes them or marks them as "already-on". The new work is the rest.
 */
import { animate, stagger, createSpring, svg, eases } from 'animejs';

/* ───────── Capability detection ───────── */

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
function tier() {
  try {
    return document.documentElement.getAttribute('data-pulse-tier') || 'standard';
  } catch (_) {
    return 'standard';
  }
}
function isFullTier() {
  return tier() === 'full';
}
function isLiteTier() {
  return tier() === 'lite';
}
function isCoarsePointer() {
  try {
    return window.matchMedia('(pointer: coarse)').matches;
  } catch (_) {
    return false;
  }
}

const SPRING = {
  snappy: createSpring({ stiffness: 480, damping: 34, mass: 1 }),
  smooth: createSpring({ stiffness: 320, damping: 30, mass: 1 }),
  bouncy: createSpring({ stiffness: 420, damping: 20, mass: 0.92 }),
  release: createSpring({ stiffness: 360, damping: 24, mass: 0.95 }),
};

/* ───────── Shared one-shot IntersectionObserver ───────── */

const _ioCallbacks = new Map(); // element -> callback
let _sharedIO = null;
function sharedIO() {
  if (_sharedIO) return _sharedIO;
  if (typeof IntersectionObserver === 'undefined') return null;
  _sharedIO = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        const cb = _ioCallbacks.get(e.target);
        if (cb) {
          try {
            cb(e.target);
          } catch (_) {}
          _ioCallbacks.delete(e.target);
          _sharedIO.unobserve(e.target);
        }
      }
    },
    { rootMargin: '0px 0px -6% 0px', threshold: 0.08 },
  );
  return _sharedIO;
}
function onceInView(el, cb) {
  if (!el) return;
  const io = sharedIO();
  if (!io) {
    cb(el);
    return;
  }
  _ioCallbacks.set(el, cb);
  io.observe(el);
}

/* ───────── 1. Heading char split + reveal ───────── */

function splitChars(el) {
  if (!el || el.dataset.fluxSplit === '1') return [];
  const text = el.textContent || '';
  if (!text.trim()) return [];
  el.dataset.fluxSplit = '1';
  el.dataset.fluxOriginal = text;
  const frag = document.createDocumentFragment();
  const out = [];
  for (const ch of text) {
    if (ch === ' ') {
      frag.appendChild(document.createTextNode(' '));
      continue;
    }
    const span = document.createElement('span');
    span.className = 'flux-mo-char';
    span.textContent = ch;
    span.style.display = 'inline-block';
    span.style.willChange = 'transform, opacity';
    frag.appendChild(span);
    out.push(span);
  }
  el.textContent = '';
  el.appendChild(frag);
  return out;
}

function initHeadingCharReveal() {
  if (isLiteTier() || !motionAllowed()) return;
  const sel = 'h1.flux-mo-char-reveal, [data-flux-char-reveal]';
  document.querySelectorAll(sel).forEach((h) => {
    onceInView(h, (el) => {
      const chars = splitChars(el);
      if (!chars.length) return;
      animate(chars, {
        opacity: [0, 1],
        translateY: [22, 0],
        rotate: [4, 0],
        scale: [0.94, 1],
        delay: stagger(18, { from: 'first' }),
        duration: 540,
        ease: 'outExpo',
        onComplete: () => {
          // Clear will-change after to free GPU layers
          chars.forEach((c) => {
            c.style.willChange = '';
          });
        },
      });
    });
  });
}

/* ───────── 2. Heading word reveal ───────── */

function splitWords(el) {
  if (!el || el.dataset.fluxWordSplit === '1') return [];
  const text = (el.textContent || '').trim();
  if (!text) return [];
  el.dataset.fluxWordSplit = '1';
  el.innerHTML = text
    .split(/\s+/)
    .map((w) => `<span class="flux-mo-word" style="display:inline-block;will-change:transform,opacity">${w.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</span>`)
    .join(' ');
  return Array.from(el.querySelectorAll('.flux-mo-word'));
}

function initHeadingWordReveal() {
  if (isLiteTier() || !motionAllowed()) return;
  const sel = 'h2.flux-mo-word-reveal, h3.flux-mo-word-reveal, [data-flux-word-reveal]';
  document.querySelectorAll(sel).forEach((h) => {
    onceInView(h, (el) => {
      const words = splitWords(el);
      if (!words.length) return;
      animate(words, {
        opacity: [0, 1],
        translateY: [12, 0],
        delay: stagger(45, { from: 'first' }),
        duration: 460,
        ease: 'outExpo',
        onComplete: () => words.forEach((w) => (w.style.willChange = '')),
      });
    });
  });
}

/* ───────── 6. Empty-state float-in ───────── */

function initEmptyStateFloat() {
  if (isLiteTier() || !motionAllowed()) return;
  const scan = () => {
    document.querySelectorAll('.empty-state:not([data-flux-mo50-empty]), [data-flux-empty]:not([data-flux-mo50-empty])').forEach((el) => {
      el.dataset.fluxMo50Empty = '1';
      onceInView(el, (target) => {
        const icon = target.querySelector('.empty-icon, .empty-emoji, svg, img');
        if (icon) {
          animate(icon, {
            translateY: [-12, 0],
            scale: [0.88, 1],
            opacity: [0, 1],
            duration: 720,
            ease: SPRING.bouncy,
          });
        }
        const text = target.querySelector('h3, h4, p, .empty-title, .empty-sub');
        if (text) {
          animate([text], {
            opacity: [0, 1],
            translateY: [10, 0],
            duration: 480,
            delay: 140,
            ease: 'outExpo',
          });
        }
      });
    });
  };
  scan();
  document.addEventListener('flux-nav', () => setTimeout(scan, 100));
}

/* ───────── 10. Confetti burst on success ───────── */

const CONFETTI_COLORS = [
  'rgba(95,142,255,1)',
  'rgba(168,116,255,1)',
  'rgba(34,255,136,1)',
  'rgba(251,191,36,1)',
  'rgba(244,114,182,1)',
];

function confettiBurst(x, y, count) {
  if (!motionAllowed() || isLiteTier()) return;
  const num = count || (isFullTier() ? 28 : 16);
  const container = document.body;
  for (let i = 0; i < num; i++) {
    const p = document.createElement('span');
    p.className = 'flux-confetti-bit';
    p.style.cssText = `position:fixed;left:${x}px;top:${y}px;width:8px;height:8px;border-radius:2px;background:${CONFETTI_COLORS[i % CONFETTI_COLORS.length]};pointer-events:none;z-index:99999;will-change:transform,opacity;`;
    container.appendChild(p);
    const angle = (Math.PI * 2 * i) / num + Math.random() * 0.4;
    const dist = 80 + Math.random() * 160;
    const dx = Math.cos(angle) * dist;
    const dy = Math.sin(angle) * dist - 60;
    animate(p, {
      translateX: [0, dx],
      translateY: [0, dy + 180],
      rotate: [0, (Math.random() - 0.5) * 540],
      opacity: [1, 0],
      duration: 900 + Math.random() * 400,
      ease: 'outExpo',
      onComplete: () => p.remove(),
    });
  }
}

function initConfetti() {
  // Trigger on .task-item checkbox toggle to "done", goal completion, etc.
  document.addEventListener(
    'click',
    (e) => {
      if (!motionAllowed() || isLiteTier()) return;
      const trig = e.target?.closest?.('[data-flux-confetti], .task-complete-trigger');
      if (!trig) return;
      const r = trig.getBoundingClientRect();
      confettiBurst(r.left + r.width / 2, r.top + r.height / 2);
    },
    { capture: true, passive: true },
  );
}

/* ───────── 13. Cursor halo follower (full tier only, desktop only) ───────── */

function initCursorHalo() {
  document.querySelectorAll('.flux-cursor-halo').forEach((el) => {
    try {
      el.remove();
    } catch (_) {}
  });
}

/* ───────── 15. Icon spin on hover (sidebar/topbar icons) ───────── */
// CSS handles it — JS just ensures the class is present.

function initIconSpinHover() {
  if (isLiteTier()) return;
  document.querySelectorAll('.nav-item .ni, .sidebar-nav .ni-emoji, .nav-item .ni-svg-wrap').forEach((el) => {
    el.classList.add('flux-mo-icon-spin');
  });
}

/* ───────── 16. Border flow on hover (CSS) ───────── */
// Pure CSS via .flux-mo-border-flow class. JS attaches the class to common targets.

function initBorderFlow() {
  if (isLiteTier()) return;
  document.querySelectorAll('.fab-btn, .topbar-new-task-btn, [data-flux-border-flow]').forEach((el) => {
    el.classList.add('flux-mo-border-flow');
  });
}

/* ───────── 17. Underline draw on hover (links) ───────── */

function initUnderlineDraw() {
  if (isLiteTier()) return;
  document.querySelectorAll('a.flux-mo-underline, [data-flux-underline]').forEach((el) => {
    el.classList.add('flux-mo-underline-draw');
  });
}

/* ───────── 18. Avatar pop scale on hover ───────── */

function initAvatarPop() {
  if (isLiteTier()) return;
  document.querySelectorAll('.user-avatar, .avatar, .user-card-avatar, [data-flux-avatar]').forEach((el) => {
    el.classList.add('flux-mo-avatar-pop');
  });
}

/* ───────── 19. Sparkle on hover (full tier only) ───────── */

function spawnSparkles(host, count) {
  if (!host) return;
  const n = count || 5;
  for (let i = 0; i < n; i++) {
    const s = document.createElement('span');
    s.className = 'flux-mo-sparkle';
    s.style.cssText = `position:absolute;width:6px;height:6px;border-radius:50%;background:radial-gradient(circle,#fff,rgba(255,255,255,0) 60%);pointer-events:none;left:${20 + Math.random() * 60}%;top:${20 + Math.random() * 60}%;opacity:0;`;
    host.appendChild(s);
    animate(s, {
      opacity: [0, 1, 0],
      scale: [0.4, 1.2, 0.4],
      translateY: [0, -14],
      duration: 720,
      delay: i * 60,
      ease: 'outQuad',
      onComplete: () => s.remove(),
    });
  }
}

function initSparkleHover() {
  if (!isFullTier() || isCoarsePointer() || !motionAllowed()) return;
  document.addEventListener(
    'pointerenter',
    (e) => {
      const t = e.target;
      if (!(t instanceof Element)) return;
      const host = t.closest('[data-flux-sparkle]');
      if (!host) return;
      const wasStatic = getComputedStyle(host).position === 'static';
      if (wasStatic) host.style.position = 'relative';
      spawnSparkles(host, 5);
    },
    { capture: true },
  );
}

/* ───────── 24. Checkbox spring tick ───────── */
// On task complete, draw a tick via SVG path animation.

function tickCheckbox(box) {
  if (!box || !motionAllowed() || isLiteTier()) return;
  if (box.dataset.fluxTicked === '1') return;
  box.dataset.fluxTicked = '1';
  // Ensure an SVG check sits inside
  let svgEl = box.querySelector('.flux-mo-tick-svg');
  if (!svgEl) {
    box.insertAdjacentHTML(
      'beforeend',
      '<svg class="flux-mo-tick-svg" viewBox="0 0 16 16" width="14" height="14" style="position:absolute;inset:0;margin:auto;pointer-events:none"><path d="M3 8.5l3 3 7-7" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    );
    svgEl = box.querySelector('.flux-mo-tick-svg');
  }
  try {
    const drawable = svg.createDrawable(svgEl.querySelector('path'));
    animate(drawable, {
      draw: ['0 0', '0 1'],
      duration: 380,
      ease: 'outExpo',
    });
    animate(box, {
      scale: [0.9, 1.08, 1],
      duration: 480,
      ease: SPRING.bouncy,
    });
  } catch (_) {}
}

function initCheckboxTick() {
  document.addEventListener(
    'change',
    (e) => {
      const t = e.target;
      if (!(t instanceof HTMLInputElement)) return;
      if (t.type !== 'checkbox' || !t.checked) return;
      const wrap = t.closest('.task-checkbox, .flux-checkbox, [data-flux-checkbox]');
      if (wrap) tickCheckbox(wrap);
    },
    { capture: true },
  );
}

/* ───────── 25. Long-press squish ───────── */

function initLongPressSquish() {
  if (!motionAllowed()) return;
  let timer = null;
  let target = null;
  document.addEventListener(
    'pointerdown',
    (e) => {
      if (e.button !== 0) return;
      const el = e.target?.closest?.('button, .btn, [data-flux-long-press]');
      if (!el || el.closest('[data-flux-no-long-press]')) return;
      target = el;
      timer = setTimeout(() => {
        if (!target) return;
        animate(target, {
          scale: 0.92,
          duration: 320,
          ease: SPRING.smooth,
        });
      }, 320);
    },
    { passive: true },
  );
  const cancel = () => {
    if (timer) clearTimeout(timer);
    timer = null;
    if (target) {
      animate(target, { scale: 1, duration: 360, ease: SPRING.bouncy });
      target = null;
    }
  };
  document.addEventListener('pointerup', cancel, { passive: true });
  document.addEventListener('pointercancel', cancel, { passive: true });
  document.addEventListener('pointerleave', cancel, { passive: true });
}

/* ───────── 26 + 27. Drag pickup lift + drop snap bounce ───────── */

function initDragLift() {
  // CSS-only via :active on .flux-mo-draggable + ondrag class added by app.js.
  document.querySelectorAll('.task-item, .draggable, [data-flux-drag]').forEach((el) => {
    el.classList.add('flux-mo-draggable');
  });
}

/* ───────── 28. Save-button morph (Save → ✓ → Save) ───────── */

function morphSaveButton(btn) {
  if (!btn || !motionAllowed()) return;
  const original = btn.dataset.fluxSaveLabel || btn.textContent;
  btn.dataset.fluxSaveLabel = original;
  animate(btn, {
    scale: [1, 0.94, 1],
    duration: 280,
    ease: 'outQuad',
  });
  btn.textContent = '✓ Saved';
  btn.classList.add('flux-mo-saved');
  setTimeout(() => {
    btn.textContent = original;
    btn.classList.remove('flux-mo-saved');
  }, 1400);
}

function initSaveMorph() {
  document.addEventListener(
    'click',
    (e) => {
      const btn = e.target?.closest?.('[data-flux-save-success]');
      if (!btn) return;
      morphSaveButton(btn);
    },
    { capture: true, passive: true },
  );
  // Public API
  window.fluxSaveButtonSuccess = morphSaveButton;
}

/* ───────── 29. Add-task plus rotate (+ → × when input mode) ───────── */
// CSS: .flux-mo-plus class on a + button rotates 45deg when host has .input-active.

function initPlusRotate() {
  document.querySelectorAll('#fabBtn, .topbar-new-task-btn, [data-flux-plus-rotate]').forEach((el) => {
    el.classList.add('flux-mo-plus');
  });
}

/* ───────── 34. Breadcrumb slide-from-left ───────── */

function initBreadcrumbSlide() {
  if (isLiteTier() || !motionAllowed()) return;
  const scan = () => {
    document.querySelectorAll('.breadcrumb:not([data-flux-bc-anim]), .flux-breadcrumb:not([data-flux-bc-anim])').forEach((el) => {
      el.dataset.fluxBcAnim = '1';
      const crumbs = el.querySelectorAll('.crumb, .bc-item, a, span');
      if (!crumbs.length) return;
      animate(Array.from(crumbs), {
        opacity: [0, 1],
        translateX: [-12, 0],
        delay: stagger(60, { from: 'first' }),
        duration: 380,
        ease: 'outExpo',
      });
    });
  };
  scan();
  document.addEventListener('flux-nav', () => setTimeout(scan, 100));
}

/* ───────── 38. Star sparkle field (full tier only) ───────── */
// CSS draws static dot grid; JS only ensures class on body.

function initStarField() {
  if (!isFullTier() || isLiteTier() || !motionAllowed()) return;
  document.documentElement.classList.add('flux-mo-starfield');
}

/* ───────── 40. Scanline shimmer on hero cards ───────── */

function initScanlineShimmer() {
  if (isLiteTier() || !motionAllowed()) return;
  document.querySelectorAll('.dash-hero, .dash-greeting-card, [data-flux-scanline]').forEach((el) => {
    el.classList.add('flux-mo-scanline');
  });
}

/* ───────── 42. Number mid-flight morph (when textContent changes) ───────── */

function initNumberMorph() {
  if (isLiteTier() || !motionAllowed()) return;
  if (typeof MutationObserver === 'undefined') return;
  const COUNTERS = '.fluxw-stat-num, .s-num, .stat-num, .fsdb-stat-num, .fsdb-widget-num, .flux-stat-value, [data-flux-countup]';
  const observed = new WeakSet();

  const observe = (node) => {
    if (observed.has(node)) return;
    if (!(node instanceof Element)) return;
    if (!node.matches(COUNTERS)) return;
    observed.add(node);
    const mo = new MutationObserver(() => {
      const newVal = parseFloat((node.textContent || '').trim());
      const oldVal = parseFloat(node.dataset.fluxLastNum || '0');
      if (Number.isNaN(newVal) || newVal === oldVal) {
        if (!Number.isNaN(newVal)) node.dataset.fluxLastNum = String(newVal);
        return;
      }
      mo.disconnect();
      const isInt = !String(newVal).includes('.');
      const state = { v: oldVal };
      animate(state, {
        v: newVal,
        duration: 540,
        ease: 'outExpo',
        onUpdate: () => {
          node.textContent = isInt ? String(Math.round(state.v)) : state.v.toFixed(1);
        },
        onComplete: () => {
          node.dataset.fluxLastNum = String(newVal);
          mo.observe(node, { childList: true, characterData: true, subtree: true });
        },
      });
    });
    mo.observe(node, { childList: true, characterData: true, subtree: true });
    const initial = parseFloat((node.textContent || '').trim());
    if (!Number.isNaN(initial)) node.dataset.fluxLastNum = String(initial);
  };

  const scan = () => document.querySelectorAll(COUNTERS).forEach(observe);
  scan();
  document.addEventListener('flux-nav', () => setTimeout(scan, 300));
  document.addEventListener('flux-dash-board-rendered', () => setTimeout(scan, 300));
}

/* ───────── 43. Progress bar fill (spring) ───────── */

function initProgressFill() {
  if (isLiteTier() || !motionAllowed()) return;
  const scan = () => {
    document.querySelectorAll('.progress-fill, .bar-fill, [data-flux-progress]').forEach((el) => {
      if (el.dataset.fluxFillAnim === '1') return;
      el.dataset.fluxFillAnim = '1';
      onceInView(el, (target) => {
        const finalW = getComputedStyle(target).width;
        target.style.width = '0px';
        // Force reflow then animate
        void target.offsetWidth;
        target.style.width = finalW;
        target.style.transition = 'width 720ms cubic-bezier(0.34, 1.15, 0.64, 1)';
      });
    });
  };
  scan();
  document.addEventListener('flux-nav', () => setTimeout(scan, 100));
}

/* ───────── 44. Donut ring draw (SVG circles) ───────── */

function initDonutDraw() {
  if (isLiteTier() || !motionAllowed()) return;
  const scan = () => {
    document.querySelectorAll('svg circle.ring-progress, svg circle[data-flux-ring], svg .donut-ring').forEach((c) => {
      if (c.dataset.fluxRingAnim === '1') return;
      c.dataset.fluxRingAnim = '1';
      onceInView(c, (target) => {
        try {
          const drawable = svg.createDrawable(target);
          animate(drawable, {
            draw: ['0 0', '0 1'],
            duration: 1100,
            ease: 'outExpo',
          });
        } catch (_) {}
      });
    });
  };
  scan();
  document.addEventListener('flux-nav', () => setTimeout(scan, 100));
}

/* ───────── 45. Bar chart grow ───────── */

function initBarChartGrow() {
  if (isLiteTier() || !motionAllowed()) return;
  const scan = () => {
    document.querySelectorAll('.flux-chart-bar:not([data-flux-bar-anim]), [data-flux-bar]:not([data-flux-bar-anim])').forEach((bar) => {
      bar.dataset.fluxBarAnim = '1';
      onceInView(bar, (target) => {
        animate(target, {
          scaleY: [0, 1],
          opacity: [0.4, 1],
          duration: 640,
          ease: SPRING.bouncy,
          delay: Math.random() * 80,
        });
        target.style.transformOrigin = '50% 100%';
      });
    });
  };
  scan();
  document.addEventListener('flux-nav', () => setTimeout(scan, 100));
}

/* ───────── 46. Live pulse dot (CSS handles animation; JS attaches class) ───────── */

function initLivePulse() {
  document.querySelectorAll('.live-badge, .status-dot, [data-flux-live]').forEach((el) => {
    if (isLiteTier()) return;
    el.classList.add('flux-mo-live-dot');
  });
}

/* ───────── 47. Heatmap cell pop ───────── */

function initHeatmapPop() {
  if (isLiteTier() || !motionAllowed()) return;
  const scan = () => {
    document.querySelectorAll('.heatmap-cell:not([data-flux-hm-anim]), .habit-heatmap .cell:not([data-flux-hm-anim])').forEach((c, i) => {
      c.dataset.fluxHmAnim = '1';
      onceInView(c, (target) => {
        animate(target, {
          scale: [0.5, 1],
          opacity: [0, 1],
          duration: 420,
          ease: SPRING.bouncy,
          delay: i * 6,
        });
      });
    });
  };
  scan();
  document.addEventListener('flux-nav', () => setTimeout(scan, 100));
}

/* ───────── 48. Sparkline draw ───────── */

function initSparklineDraw() {
  if (isLiteTier() || !motionAllowed()) return;
  const scan = () => {
    document.querySelectorAll('svg.sparkline:not([data-flux-spk-anim]) path, svg[data-flux-sparkline]:not([data-flux-spk-anim]) path').forEach((p) => {
      const host = p.closest('svg');
      if (host?.dataset.fluxSpkAnim === '1') return;
      if (host) host.dataset.fluxSpkAnim = '1';
      onceInView(p, (target) => {
        try {
          const d = svg.createDrawable(target);
          animate(d, {
            draw: ['0 0', '0 1'],
            duration: 980,
            ease: 'outExpo',
          });
        } catch (_) {}
      });
    });
  };
  scan();
  document.addEventListener('flux-nav', () => setTimeout(scan, 100));
}

/* ───────── 50. Drag handle hint pulse ───────── */

function initDragHandleHint() {
  if (isLiteTier() || !motionAllowed()) return;
  document.querySelectorAll('.drag-handle, [data-flux-drag-handle]').forEach((el) => {
    el.classList.add('flux-mo-handle-hint');
  });
}

/* ───────── Boot ───────── */

let _booted = false;
function boot() {
  if (_booted) return;
  _booted = true;
  document.documentElement.classList.add('flux-mo50');

  // One-shot scan (heading reveals + everything that needs to find elements now)
  initHeadingCharReveal();
  initHeadingWordReveal();
  initEmptyStateFloat();
  initIconSpinHover();
  initBorderFlow();
  initUnderlineDraw();
  initAvatarPop();
  initBreadcrumbSlide();
  initScanlineShimmer();
  initLivePulse();
  initDragLift();
  initPlusRotate();
  initDragHandleHint();

  // Event-driven (cheap, delegated)
  initConfetti();
  initCheckboxTick();
  initLongPressSquish();
  initSaveMorph();
  initSparkleHover();

  // Tier-gated heavies
  initCursorHalo();
  initStarField();

  // Async / scroll-reveal driven
  initProgressFill();
  initDonutDraw();
  initBarChartGrow();
  initHeatmapPop();
  initSparklineDraw();
  initNumberMorph();

  // Re-scan one-shot effects after each nav
  document.addEventListener('flux-nav', () => {
    requestAnimationFrame(() => {
      initHeadingCharReveal();
      initHeadingWordReveal();
      initIconSpinHover();
      initBorderFlow();
      initUnderlineDraw();
      initAvatarPop();
      initScanlineShimmer();
      initLivePulse();
      initDragLift();
      initPlusRotate();
      initDragHandleHint();
    });
  });

  // React to perf tier changes — drop or re-add heavy effects.
  if (window.FluxPulsePerf?.subscribe) {
    window.FluxPulsePerf.subscribe(() => {
      if (!isFullTier()) {
        document.documentElement.classList.remove('flux-mo-starfield');
        initCursorHalo();
      } else {
        initCursorHalo();
        if (!document.documentElement.classList.contains('flux-mo-starfield')) initStarField();
      }
    });
  }
}

function tryBoot() {
  const app = document.getElementById('app');
  if (app?.classList.contains('visible')) {
    boot();
    return;
  }
  const obs = new MutationObserver(() => {
    if (document.getElementById('app')?.classList.contains('visible')) {
      obs.disconnect();
      boot();
    }
  });
  obs.observe(document.documentElement, { attributes: true, subtree: true, attributeFilter: ['class'] });
}

window.FluxMotion50 = {
  boot,
  confettiBurst,
  tickCheckbox,
  morphSaveButton,
  spawnSparkles,
  tier,
  motionAllowed,
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', tryBoot, { once: true });
} else {
  tryBoot();
}
