/**
 * Flux · Focus timer motion — Anime.js v4 on the Pomodoro ring (Time → Focus).
 *
 *   createMotionPath   a small "car" drives the ring as the session runs; it
 *                      sits at the tip of the remaining-time arc.
 *   createDrawable     the circuit under it draws itself in each time the
 *                      Focus view comes on screen.
 *   morphTo            focus keeps a round circuit; a break softens it into
 *                      a gentle wave, and it morphs back for the next session.
 *   createTimeline     on Start, the twelve bezel ticks hop outward in a wave
 *                      while the bezel makes one full turn.
 *   createDraggable    the floating Pomodoro pill (desktop) can be dragged out
 *                      of the way; it settles with a spring and stays there.
 *
 * app.js calls window.FluxFocusMotion.update / start / mode; everything here is
 * optional decoration and fails quietly. Reduced motion and the low-end "snappy"
 * mode keep the car and shapes in place without animating them.
 */
import {
  animate,
  createTimeline,
  createDraggable,
  spring,
  createMotionPath,
  createDrawable,
  morphTo,
  stagger,
} from 'animejs';

const NS = 'http://www.w3.org/2000/svg';
const R = 88; // the ring's radius in its 200×200 viewBox
const TICKS = 12;
const PILL_KEY = 'flux_pomo_pill_offset';

const reduced = () => {
  try {
    return (
      window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
      document.documentElement.classList.contains('flux-reduce-motion') ||
      document.documentElement.getAttribute('data-flux-perf') === 'on'
    );
  } catch (_) {
    return false;
  }
};

/** A closed loop round the ring, starting at 12 o'clock and running anticlockwise (the way the arc shrinks). */
function loopPath(wave) {
  const n = 96;
  let d = '';
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2;
    const r = wave ? R + 3.5 * Math.sin(a * 8) : R;
    const x = 100 - r * Math.sin(a);
    const y = 100 - r * Math.cos(a);
    d += (i ? 'L' : 'M') + x.toFixed(2) + ' ' + y.toFixed(2);
  }
  return d + 'Z';
}

const state = {
  svg: null,
  circuit: null,
  car: null,
  carAnim: null,
  carTween: null,
  morph: null,
  shape: 'focus',
  pos: { p: 0 },
  drawn: false,
  visible: false,
};

function el(tag, attrs, parent) {
  const n = document.createElementNS(NS, tag);
  Object.keys(attrs).forEach((k) => n.setAttribute(k, attrs[k]));
  if (parent) parent.appendChild(n);
  return n;
}

function buildOrbit() {
  if (state.svg) return true;
  const ring = document.getElementById('timerRing');
  const host = ring && ring.ownerSVGElement && ring.ownerSVGElement.parentElement;
  if (!host) return false;

  const svg = el('svg', { class: 'ffm-orbit', viewBox: '0 0 200 200', 'aria-hidden': 'true', focusable: 'false' });
  const ticker = el('g', { class: 'ffm-ticker' }, svg);
  for (let i = 0; i < TICKS; i++) {
    const g = el('g', { transform: 'rotate(' + i * (360 / TICKS) + ' 100 100)' }, ticker);
    el('line', { class: 'ffm-tick' + (i % 3 === 0 ? ' ffm-tick--major' : ''), x1: '100', y1: '1', x2: '100', y2: '5.5' }, g);
  }
  // Morph targets (never drawn) and the circuit itself.
  el('path', { class: 'ffm-shape ffm-shape--focus', d: loopPath(false) }, svg);
  el('path', { class: 'ffm-shape ffm-shape--break', d: loopPath(true) }, svg);
  state.circuit = el('path', { class: 'ffm-circuit', d: loopPath(false) }, svg);
  state.car = el('rect', { class: 'ffm-car', x: '-6', y: '-3', width: '12', height: '6', rx: '3' }, svg);

  // Above the ring, below the time read-out.
  host.insertBefore(svg, ring.ownerSVGElement.nextSibling);
  state.svg = svg;
  buildCar();
  watchVisibility();
  return true;
}

/** The car's whole lap as one paused animation; progress is set with seek(). */
function buildCar() {
  try {
    if (state.carAnim) state.carAnim.revert();
    state.carAnim = animate(state.car, {
      ...createMotionPath(state.circuit),
      duration: 1000,
      ease: 'linear',
      autoplay: false,
    });
    state.carAnim.seek(state.pos.p * 1000);
  } catch (_) {
    state.carAnim = null;
  }
}

function moveCar(p) {
  p = Math.max(0, Math.min(1, p));
  if (!state.carAnim) return;
  if (state.carTween) state.carTween.pause();
  // A reset (or a big jump) moves at once; a normal tick glides for the second.
  // Off screen it just jumps, so the animation engine is not kept running for a hidden ring.
  if (reduced() || !state.visible || Math.abs(p - state.pos.p) > 0.08) {
    state.pos.p = p;
    state.carAnim.seek(p * 1000);
    return;
  }
  state.carTween = animate(state.pos, {
    p,
    duration: 950,
    ease: 'linear',
    onUpdate: () => state.carAnim && state.carAnim.seek(state.pos.p * 1000),
  });
}

function drawIn() {
  if (reduced() || !state.circuit) return;
  try {
    animate(createDrawable(state.circuit), {
      draw: ['0 0', '0 1'],
      duration: 1100,
      ease: 'inOut(3)',
    });
  } catch (_) { /* decoration only */ }
}

/** Draw the circuit in whenever the Focus view comes on screen. */
function watchVisibility() {
  if (typeof IntersectionObserver !== 'function') return;
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      state.visible = e.isIntersecting;
      if (e.isIntersecting && !state.drawn) { state.drawn = true; drawIn(); }
      else if (!e.isIntersecting) state.drawn = false;
    });
  });
  io.observe(state.svg);
}

function setShape(shape) {
  if (!state.circuit || shape === state.shape) return;
  state.shape = shape;
  const target = state.svg.querySelector('.ffm-shape--' + shape);
  if (!target) return;
  if (state.morph) state.morph.pause();
  if (reduced()) {
    state.circuit.setAttribute('d', target.getAttribute('d'));
    buildCar();
    return;
  }
  try {
    state.morph = animate(state.circuit, {
      d: morphTo(target),
      duration: 900,
      ease: 'inOut(3)',
      onUpdate: () => state.carAnim && state.carAnim.seek(state.pos.p * 1000),
      // The car's path length is read when its lap is built, so rebuild it on the new shape.
      onComplete: buildCar,
    });
  } catch (_) {
    state.circuit.setAttribute('d', target.getAttribute('d'));
    buildCar();
  }
}

/** Start: the bezel ticks hop outward in a wave while the bezel turns once. */
function startFlourish() {
  if (reduced() || !state.svg) return;
  const ticks = state.svg.querySelectorAll('.ffm-tick');
  const ticker = state.svg.querySelector('.ffm-ticker');
  try {
    createTimeline()
      .add(ticks, {
        y: '-=6',
        duration: 50,
      }, stagger(10))
      .add(ticker, {
        rotate: 360,
        duration: 1920,
      }, '<')
      .add(ticks, {
        y: 0,
        duration: 420,
        ease: 'out(3)',
      }, stagger(10, { start: 260 }))
      .add(ticker, { rotate: 0, duration: 0 });
  } catch (_) { /* decoration only */ }
}

/* ── The floating Pomodoro pill: drag it anywhere (desktop) ─────────────── */

const pill = { el: null, drag: null, foldRaf: 0, moved: false, firedAt: 0 };

function readOffset() {
  try {
    const o = JSON.parse(localStorage.getItem(PILL_KEY) || 'null');
    return o && isFinite(o.x) && isFinite(o.y) ? o : { x: 0, y: 0 };
  } catch (_) {
    return { x: 0, y: 0 };
  }
}
function writeOffset(o) {
  try { localStorage.setItem(PILL_KEY, JSON.stringify(o)); } catch (_) { /* private mode */ }
}
/** The drop is kept in the CSS `translate` property, so the pill's own appear/disappear transforms still work. */
function applyOffset(o) {
  if (!pill.el) return;
  pill.el.style.translate = o.x || o.y ? o.x + 'px ' + o.y + 'px' : '';
}
const isDesktop = () => window.matchMedia('(min-width: 769px)').matches;
const isShown = (p) => !p.hidden && p.style.display !== 'none' && p.getBoundingClientRect().width > 0;

/** Pull the pill back on screen if a smaller window left it outside. */
function keepOnScreen() {
  const p = pill.el;
  if (!p || !isDesktop() || !isShown(p)) return;
  const r = p.getBoundingClientRect();
  const o = readOffset();
  const dx = r.left < 8 ? 8 - r.left : r.right > innerWidth - 8 ? innerWidth - 8 - r.right : 0;
  const dy = r.top < 8 ? 8 - r.top : r.bottom > innerHeight - 8 ? innerHeight - 8 - r.bottom : 0;
  if (dx || dy) {
    const n = { x: Math.round(o.x + dx), y: Math.round(o.y + dy) };
    writeOffset(n);
    applyOffset(n);
  }
}

/**
 * Fold a finished drag into the saved offset. onSettle can fire in the middle of
 * anime's release handler (and more than once), so this waits a frame and only
 * folds once nothing is still moving.
 */
function fold(d) {
  pill.foldRaf = 0;
  if (!d || d !== pill.drag || d.grabbed) return;
  const anims = (d.animate && d.animate.animations) || {};
  for (const k in anims) {
    if (anims[k] && !anims[k].paused) { pill.foldRaf = requestAnimationFrame(() => fold(d)); return; }
  }
  if (!d.x && !d.y) return;
  const o = readOffset();
  const n = { x: Math.round(o.x + d.x), y: Math.round(o.y + d.y) };
  writeOffset(n);
  applyOffset(n);
  d.setX(0, true);
  d.setY(0, true);
  keepOnScreen();
}

function dropDrag() {
  cancelAnimationFrame(pill.foldRaf);
  pill.foldRaf = 0;
  if (pill.drag) { try { pill.drag.revert(); } catch (_) { /* already gone */ } pill.drag = null; }
}

/** The draggable only exists while the pill is on screen, so its bounds are always measured from a real box. */
function syncDrag() {
  const p = pill.el;
  if (!p) return;
  if (!isDesktop()) {
    dropDrag();
    p.style.translate = '';
    p.classList.remove('ffm-draggable');
    return;
  }
  applyOffset(readOffset());
  p.classList.add('ffm-draggable');
  if (!isShown(p)) { dropDrag(); return; }
  if (pill.drag) return;
  try {
    pill.drag = createDraggable(p, {
      // Kept inside the window (the pill is position: fixed, so the body means the viewport).
      container: document.body,
      containerPadding: 8,
      // A springy settle after a throw; reduced motion settles without the bounce.
      ...(reduced() ? {} : {
        releaseEase: spring({
          stiffness: 120,
          damping: 6,
        }),
      }),
      onGrab: () => { pill.moved = false; },
      onDrag: () => { pill.moved = true; },
      // anime turns pointer events off on the slightest move, which can swallow the click;
      // a press that never became a drag still opens the timer.
      onRelease: () => {
        if (pill.moved) return;
        pill.firedAt = performance.now();
        try { if (typeof window.fluxFocusPomoPill === 'function') window.fluxFocusPomoPill(); } catch (_) { /* nav not ready */ }
      },
      onSettle: (d) => {
        cancelAnimationFrame(pill.foldRaf);
        pill.foldRaf = requestAnimationFrame(() => fold(d));
      },
    });
  } catch (_) {
    pill.drag = null;
  }
}

function initPill() {
  const p = document.getElementById('fluxPomoPill');
  if (!p || pill.el) return;
  pill.el = p;
  // onRelease already opened the timer for that press; skip the native click that may follow it.
  p.addEventListener('click', (e) => {
    if (e.detail && performance.now() - pill.firedAt < 400) {
      e.stopImmediatePropagation();
      e.preventDefault();
    }
  }, true);
  const later = () => requestAnimationFrame(() => { syncDrag(); keepOnScreen(); });
  try { window.matchMedia('(min-width: 769px)').addEventListener('change', later); } catch (_) { /* old Safari */ }
  window.addEventListener('resize', later);
  // Shown and hidden by app.js; build the drag once its appear animation has settled.
  new MutationObserver(() => {
    if (p.hidden) { dropDrag(); return; }
    setTimeout(() => { syncDrag(); keepOnScreen(); }, 700);
  }).observe(p, { attributes: true, attributeFilter: ['hidden'] });
  syncDrag();
}

/* ── Hooks for app.js ───────────────────────────────────────────────────── */

window.FluxFocusMotion = {
  /** Every timer tick and redraw: secs left, total secs, mode. */
  update(secs, total, mode) {
    if (!buildOrbit()) return;
    setShape(mode === 'pomodoro' ? 'focus' : 'break');
    moveCar(total > 0 ? 1 - secs / total : 0);
  },
  start() {
    if (buildOrbit()) startFlourish();
  },
  mode(mode) {
    if (buildOrbit()) setShape(mode === 'pomodoro' ? 'focus' : 'break');
  },
};

function init() {
  buildOrbit();
  initPill();
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
else init();
