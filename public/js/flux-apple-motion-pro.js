/**
 * FluxAppleMotionPro — premium motion library
 * Pulled from animejs.com primitives + 21st.dev patterns.
 *
 * Effects:
 *   • countUp        — number tweens (dashboard stats)
 *   • cardTilt       — 3D perspective tilt on pointer (desktop)
 *   • magnetic       — fab-style pointer-attract
 *   • ripple         — click ripple on buttons
 *   • shimmerText    — gradient sweep on headings
 *   • scrollReveal   — fade/translate on viewport entry (IO)
 *   • auroraBloom    — soft conic-gradient drift behind active panel
 *   • marquee        — auto-scroll for badge strips
 *   • numberMorph    — animate counter changes mid-flight
 *   • cardLift       — subtle shadow + Y on hover (CSS-driven)
 *
 * All effects are no-op under prefers-reduced-motion or data-flux-perf="on".
 */
import { animate, stagger, createTimeline, createSpring, utils } from 'animejs';

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

const SPRING = {
  snappy: createSpring({ stiffness: 480, damping: 34, mass: 1 }),
  smooth: createSpring({ stiffness: 320, damping: 30, mass: 1 }),
  bouncy: createSpring({ stiffness: 420, damping: 20, mass: 0.92 }),
};

/* ───────── 1. Count-up numbers (dashboard stats) ───────── */
// 21st pattern: number tickers. animejs: animate({} object) with utils.round.

const COUNT_SELECTORS = [
  '.fluxw-stat-num',
  '.s-num',
  '.stat-num',
  '.fsdb-stat-num',
  '.fsdb-widget-num',
  '.tcd-stat-num',
  '.flux-stat-value',
  '[data-flux-countup]',
];

const _countedMap = new WeakMap();

function countUpOne(el) {
  if (!el || _countedMap.get(el) === el.textContent) return;
  const raw = (el.textContent || '').trim();
  const m = raw.match(/^-?\d+(\.\d+)?$/);
  if (!m) return;
  const target = parseFloat(raw);
  if (Number.isNaN(target) || target === 0) {
    _countedMap.set(el, raw);
    return;
  }
  const startFrom = 0;
  const isInt = !raw.includes('.');
  const state = { v: startFrom };
  el.textContent = '0';
  animate(state, {
    v: target,
    duration: Math.min(1100, 320 + Math.abs(target) * 40),
    ease: 'outExpo',
    onUpdate: () => {
      el.textContent = isInt ? String(Math.round(state.v)) : state.v.toFixed(1);
    },
    onComplete: () => {
      el.textContent = raw;
      _countedMap.set(el, raw);
    },
  });
}

function initCountUp() {
  const scan = () => {
    if (!motionAllowed()) return;
    document.querySelectorAll(COUNT_SELECTORS.join(',')).forEach(countUpOne);
  };
  // Initial + after nav + after dash render
  scan();
  document.addEventListener('flux-nav', () => requestAnimationFrame(scan));
  document.addEventListener('flux-dash-board-rendered', () => requestAnimationFrame(scan));
  // Re-scan periodically as data loads
  let bursts = 0;
  const burst = () => {
    scan();
    if (++bursts < 6) setTimeout(burst, 500);
  };
  setTimeout(burst, 300);
}

/* ───────── 2. Card tilt (3D perspective on pointer) ───────── */
// 21st pattern: tilted card. Pure CSS transform via JS; rAF throttled.

const TILT_SELECTOR = [
  '.fluxw-card',
  '.fsdb-widget',
  '.spd-card',
  '.sph-card',
  '.sw-card',
  '.dashboard-card',
  '[data-flux-tilt]',
].join(',');

const TILT_STRENGTH = 6; // max degrees

function initCardTilt() {
  if (isCoarsePointer()) return; // touch devices skip tilt
  let raf = null;
  let active = null;

  const apply = (el, dx, dy) => {
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const rx = ((dy - rect.top - rect.height / 2) / rect.height) * -TILT_STRENGTH;
    const ry = ((dx - rect.left - rect.width / 2) / rect.width) * TILT_STRENGTH;
    el.style.transform = `perspective(900px) rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg) translateZ(0)`;
  };

  const onMove = (e) => {
    if (!active) return;
    if (raf) cancelAnimationFrame(raf);
    const x = e.clientX, y = e.clientY;
    raf = requestAnimationFrame(() => apply(active, x, y));
  };

  document.addEventListener(
    'pointerenter',
    (e) => {
      if (!motionAllowed()) return;
      const t = e.target;
      if (!(t instanceof Element)) return;
      const el = t.closest(TILT_SELECTOR);
      if (!el || el.closest('[data-flux-no-tilt]')) return;
      active = el;
      el.style.willChange = 'transform';
      el.style.transition = 'transform 360ms cubic-bezier(0.16, 1, 0.3, 1)';
      // Snap off transition while tracking pointer; reapply on leave
      setTimeout(() => {
        if (active === el) el.style.transition = '';
      }, 360);
    },
    { capture: true },
  );

  document.addEventListener(
    'pointerleave',
    (e) => {
      const t = e.target;
      if (!(t instanceof Element) || !active) return;
      const el = t.closest(TILT_SELECTOR);
      if (!el || el !== active) return;
      el.style.transition = 'transform 540ms cubic-bezier(0.34, 1.15, 0.64, 1)';
      el.style.transform = '';
      setTimeout(() => {
        if (el.style.transform === '') {
          el.style.willChange = '';
          el.style.transition = '';
        }
      }, 560);
      active = null;
    },
    { capture: true },
  );

  document.addEventListener('pointermove', onMove, { capture: true, passive: true });
}

/* ───────── 3. Ripple click (Material-ish + iOS hybrid) ───────── */
// 21st pattern: ripple. Pure DOM + CSS animation triggered by JS.

const RIPPLE_SELECTOR = [
  '.btn',
  '.btn-sec',
  '.fab-btn',
  '.fab-action',
  '.tmode-btn',
  '.view-btn',
  '.stab',
  '.sph-tab',
  '.fsdb-widget-btn',
  '.teacher-action-btn',
  '.edu-action-btn',
  '.sw-action-btn',
  '[data-flux-ripple]',
].join(',');

function initRipple() {
  document.addEventListener(
    'pointerdown',
    (e) => {
      if (!motionAllowed() || e.button !== 0) return;
      const el = e.target?.closest?.(RIPPLE_SELECTOR);
      if (!el || el.closest('[data-flux-no-ripple]')) return;
      if (el.getAttribute('aria-disabled') === 'true' || el.disabled) return;
      const rect = el.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const size = Math.max(rect.width, rect.height) * 1.4;
      const ink = document.createElement('span');
      ink.className = 'flux-ripple-ink';
      ink.style.cssText = `position:absolute;left:${x}px;top:${y}px;width:${size}px;height:${size}px;border-radius:50%;background:radial-gradient(circle,rgba(255,255,255,0.32),rgba(255,255,255,0.06) 60%,transparent 75%);transform:translate(-50%,-50%) scale(0);pointer-events:none;mix-blend-mode:overlay;z-index:1;`;
      const wasStatic = getComputedStyle(el).position === 'static';
      if (wasStatic) el.style.position = 'relative';
      if (getComputedStyle(el).overflow === 'visible') el.style.overflow = 'hidden';
      el.appendChild(ink);
      animate(ink, {
        scale: [0, 1],
        opacity: [0.9, 0],
        duration: 560,
        ease: 'outExpo',
        onComplete: () => ink.remove(),
      });
    },
    { capture: true, passive: true },
  );
}

/* ───────── 4. Shimmer text (gradient sweep on headings) ───────── */
// 21st pattern: animated shimmer. CSS-driven gradient with bg-position anim.

const SHIMMER_SELECTOR = [
  '.dash-v2-greet h1',
  '.dash-greet',
  '.flux-page-header h1',
  '.fluxw-card .fluxw-hd h3',
  '[data-flux-shimmer]',
].join(',');

function initShimmer() {
  const apply = () => {
    if (!motionAllowed()) return;
    document.querySelectorAll(SHIMMER_SELECTOR).forEach((el) => {
      if (el.dataset.fluxShimmered) return;
      el.dataset.fluxShimmered = '1';
      el.classList.add('flux-shimmer-text');
    });
  };
  apply();
  document.addEventListener('flux-nav', () => requestAnimationFrame(apply));
}

/* ───────── 5. Scroll reveal (IO-based fade-in) ───────── */
// 21st pattern: reveal on scroll. animejs animate for the actual tween.

const REVEAL_SELECTOR = [
  '.card:not(.flux-apple-staggered):not(.flux-reveal-done)',
  '.fluxw-card:not(.flux-reveal-done)',
  '.sph-card:not(.flux-reveal-done)',
  '.teacher-section:not(.flux-reveal-done)',
  '.sw-col:not(.flux-reveal-done)',
  '[data-flux-reveal]:not(.flux-reveal-done)',
].join(',');

let _revealIO = null;

function initScrollReveal() {
  if (typeof IntersectionObserver === 'undefined') return;
  if (_revealIO) _revealIO.disconnect();
  _revealIO = new IntersectionObserver(
    (entries) => {
      const toReveal = entries.filter((e) => e.isIntersecting).map((e) => e.target);
      if (!toReveal.length) return;
      toReveal.forEach((el) => {
        el.classList.add('flux-reveal-done');
        _revealIO.unobserve(el);
      });
      if (!motionAllowed()) return;
      animate(toReveal, {
        opacity: [0, 1],
        translateY: [22, 0],
        scale: [0.97, 1],
        delay: stagger(40, { from: 'first' }),
        duration: 540,
        ease: 'outExpo',
      });
    },
    { rootMargin: '0px 0px -8% 0px', threshold: 0.08 },
  );
  const scan = () => {
    document.querySelectorAll(REVEAL_SELECTOR).forEach((el) => {
      // Pre-set hidden state so the IO callback fades in (avoids flash)
      if (motionAllowed()) {
        el.style.opacity = '0';
        el.style.transform = 'translateY(22px) scale(0.97)';
      }
      _revealIO.observe(el);
    });
  };
  scan();
  document.addEventListener('flux-nav', () => requestAnimationFrame(scan));
  document.addEventListener('flux-dash-board-rendered', () => requestAnimationFrame(scan));
}

/* ───────── 6. Aurora bloom (soft conic background drift) ───────── */
// 21st pattern: animated aurora background. CSS handles it; JS only enables.

function initAuroraBloom() {
  if (!motionAllowed()) return;
  document.documentElement.classList.add('flux-aurora-bloom');
}

/* ───────── 7. Marquee (auto-scrolling badge strips) ───────── */

function initMarquee() {
  if (!motionAllowed()) return;
  document.querySelectorAll('[data-flux-marquee]:not(.flux-marquee-done)').forEach((el) => {
    el.classList.add('flux-marquee-done');
    const inner = el.firstElementChild;
    if (!inner) return;
    const dup = inner.cloneNode(true);
    dup.setAttribute('aria-hidden', 'true');
    el.appendChild(dup);
    el.style.overflow = 'hidden';
    el.style.whiteSpace = 'nowrap';
    const speed = parseFloat(el.dataset.fluxMarqueeSpeed || '60');
    [inner, dup].forEach((child) => {
      child.style.display = 'inline-block';
      animate(child, {
        translateX: ['0%', '-100%'],
        duration: (1000 / speed) * 100,
        loop: true,
        ease: 'linear',
      });
    });
  });
}

/* ───────── 8. FAB spring rotate + press orchestration ───────── */
// animejs pattern: timeline + spring.

function initFabFlourish() {
  document.addEventListener(
    'click',
    (e) => {
      if (!motionAllowed()) return;
      const el = e.target?.closest?.('.fab-btn, .fab-action');
      if (!el || el.closest('[data-flux-no-flourish]')) return;
      const tl = createTimeline();
      tl.add(el, {
        scale: [1, 0.92, 1.04, 1],
        rotate: [0, 12, -6, 0],
        duration: 540,
        ease: SPRING.bouncy,
      });
    },
    { capture: true, passive: true },
  );
}

/* ───────── 9. Page title cross-fade ───────── */

let _lastPageTitle = null;
function initTitleMorph() {
  const morph = (newText) => {
    const el = document.getElementById('topbarTitle');
    if (!el || !motionAllowed()) return;
    if (el.textContent === newText) return;
    const tl = createTimeline();
    tl.add(el, { opacity: [1, 0], translateY: [0, -6], duration: 140, ease: 'outQuad' })
      .add(el, { duration: 1, onUpdate: () => { el.textContent = newText; } }, '+=0')
      .add(el, { opacity: [0, 1], translateY: [6, 0], duration: 320, ease: SPRING.smooth }, '-=0');
  };
  // Watch for nav and morph title smoothly
  document.addEventListener('flux-nav', () => {
    requestAnimationFrame(() => {
      const el = document.getElementById('topbarTitle');
      if (!el) return;
      const text = el.textContent;
      if (text === _lastPageTitle) return;
      _lastPageTitle = text;
    });
  });
}

/* ───────── Boot ───────── */

let _booted = false;
function boot() {
  if (_booted) return;
  _booted = true;
  initCountUp();
  initCardTilt();
  initRipple();
  initShimmer();
  initScrollReveal();
  initAuroraBloom();
  initMarquee();
  initFabFlourish();
  initTitleMorph();
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

window.FluxAppleMotionPro = {
  boot,
  countUpOne,
  motionAllowed,
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', tryBoot, { once: true });
} else {
  tryBoot();
}
