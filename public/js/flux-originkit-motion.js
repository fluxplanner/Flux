/**
 * OriginKit motion primitives — ported into Flux's vanilla stack.
 * Flag: enable_originkit_motion (default on; hard-disabled by reduced-motion /
 * data-flux-perf=on / data-flux-lowend regardless of the flag).
 *
 * OriginKit ships React/Framer components; Flux is a vanilla PWA. Rather than
 * add React islands, this ports the *interaction patterns* — border beam,
 * tilt card, shimmer text, stagger list, breathing glow, spotlight, magnet
 * hover, spring count-up — as reusable, CSS-first primitives that extend the
 * canonical FluxAnim owner (window.FluxAnim) and also stand alone on the
 * marketing page (landing.html loads no bundle/flag system).
 *
 * Everything is one-shot or pointer-driven (no perpetual rAF) to stay
 * Chromebook-safe, and auto-wires from data attributes on load + flux-nav:
 *   data-flux-beam · data-flux-tilt · data-flux-shimmer · data-flux-stagger
 *   data-flux-spotlight · data-flux-magnet · data-flux-countup
 */
(function () {
  'use strict';
  if (window.FluxMotion) return;

  const FLAG = 'enable_originkit_motion';

  function reduced() {
    try {
      return window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
        document.documentElement.classList.contains('flux-reduce-motion');
    } catch (_) { return false; }
  }
  function perfOff() {
    try {
      const de = document.documentElement;
      return de.getAttribute('data-flux-perf') === 'on' ||
        de.hasAttribute('data-flux-lowend');
    } catch (_) { return false; }
  }
  function flagOff() {
    // Flag system is absent on landing.html → treat as enabled there.
    try {
      if (!window.FluxFeatureFlags || typeof window.FluxFeatureFlags.isEnabled !== 'function') return false;
      return !window.FluxFeatureFlags.isEnabled(FLAG, true);
    } catch (_) { return false; }
  }
  /** Motion is allowed only when nothing overrides it. */
  function active() { return !reduced() && !perfOff() && !flagOff(); }

  /* ── pure helpers (unit-tested via source extraction) ── */

  function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }

  /** Split "57+" → { value: 57, suffix: "+" }; "4" → { value: 4, suffix: "" }. */
  function parseTarget(text) {
    const m = String(text == null ? '' : text).match(/^(\D*?)(-?\d[\d,]*(?:\.\d+)?)(\D*)$/);
    if (!m) return { prefix: '', value: 0, suffix: '', decimals: 0 };
    const numRaw = m[2].replace(/,/g, '');
    const dot = numRaw.indexOf('.');
    return {
      prefix: m[1] || '',
      value: parseFloat(numRaw),
      suffix: m[3] || '',
      decimals: dot >= 0 ? numRaw.length - dot - 1 : 0,
    };
  }

  function formatCount(value, opts) {
    const o = opts || {};
    const dec = o.decimals || 0;
    const n = dec > 0 ? value.toFixed(dec) : String(Math.round(value));
    return (o.prefix || '') + n + (o.suffix || '');
  }

  /* ── primitives ── */

  function borderBeam(el, opts) {
    if (!el) return;
    const o = opts || {};
    el.classList.add('flux-beam');
    if (o.color) el.style.setProperty('--beam-color', o.color);
    if (o.duration) el.style.setProperty('--beam-dur', o.duration + 'ms');
    // The animated conic border is CSS-only; when motion is off it degrades
    // to a static accent ring (see .flux-beam rule).
    el.classList.toggle('flux-beam-live', active());
  }

  function shimmerText(el) {
    if (!el) return;
    el.classList.add('flux-shimmer-text');
    el.classList.toggle('flux-shimmer-live', active());
  }

  function breathingGlow(el, on) {
    if (!el) return;
    el.classList.toggle('flux-breathe', on !== false && active());
  }

  function tiltCard(el, opts) {
    if (!el || el.dataset.fluxTiltWired) return;
    el.dataset.fluxTiltWired = '1';
    el.classList.add('flux-tilt');
    const max = (opts && opts.max) || 8;
    const onMove = (e) => {
      if (!active()) return;
      const r = el.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width - 0.5;
      const py = (e.clientY - r.top) / r.height - 0.5;
      el.style.setProperty('--tilt-x', (-py * max).toFixed(2) + 'deg');
      el.style.setProperty('--tilt-y', (px * max).toFixed(2) + 'deg');
      el.style.setProperty('--glare-x', ((px + 0.5) * 100).toFixed(1) + '%');
      el.style.setProperty('--glare-y', ((py + 0.5) * 100).toFixed(1) + '%');
      el.classList.add('flux-tilt-active');
    };
    const reset = () => {
      el.style.setProperty('--tilt-x', '0deg');
      el.style.setProperty('--tilt-y', '0deg');
      el.classList.remove('flux-tilt-active');
    };
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerleave', reset);
  }

  function spotlight(el) {
    if (!el || el.dataset.fluxSpotWired) return;
    el.dataset.fluxSpotWired = '1';
    el.classList.add('flux-spotlight');
    el.addEventListener('pointermove', (e) => {
      if (!active()) return;
      const r = el.getBoundingClientRect();
      el.style.setProperty('--spot-x', (e.clientX - r.left) + 'px');
      el.style.setProperty('--spot-y', (e.clientY - r.top) + 'px');
    });
  }

  function magnet(el, opts) {
    if (!el || el.dataset.fluxMagWired) return;
    el.dataset.fluxMagWired = '1';
    el.classList.add('flux-magnet');
    const strength = (opts && opts.strength) || 0.3;
    el.addEventListener('pointermove', (e) => {
      if (!active()) return;
      const r = el.getBoundingClientRect();
      const dx = (e.clientX - (r.left + r.width / 2)) * strength;
      const dy = (e.clientY - (r.top + r.height / 2)) * strength;
      el.style.setProperty('--mag-x', dx.toFixed(1) + 'px');
      el.style.setProperty('--mag-y', dy.toFixed(1) + 'px');
    });
    el.addEventListener('pointerleave', () => {
      el.style.setProperty('--mag-x', '0px');
      el.style.setProperty('--mag-y', '0px');
    });
  }

  /** Reveal children with a domino stagger when the container scrolls in. */
  function staggerList(container, opts) {
    if (!container || container.dataset.fluxStaggerWired) return;
    container.dataset.fluxStaggerWired = '1';
    const sel = (opts && opts.sel) || ':scope > *';
    const kids = Array.from(container.querySelectorAll(sel));
    if (!kids.length) return;
    kids.forEach((k, i) => k.style.setProperty('--stagger-i', String(i)));
    container.classList.add('flux-stagger');
    if (!active()) { container.classList.add('flux-stagger-in'); return; }
    try {
      const io = new IntersectionObserver((entries, obs) => {
        entries.forEach((en) => {
          if (en.isIntersecting) { container.classList.add('flux-stagger-in'); obs.unobserve(en.target); }
        });
      }, { threshold: 0.15 });
      io.observe(container);
    } catch (_) { container.classList.add('flux-stagger-in'); }
  }

  function countUp(el, to, opts) {
    if (!el) return;
    const o = opts || {};
    const target = typeof to === 'number' ? to : parseTarget(el.textContent).value;
    const meta = typeof to === 'number'
      ? { prefix: o.prefix || '', suffix: o.suffix || '', decimals: o.decimals || 0 }
      : parseTarget(el.textContent);
    if (!active()) { el.textContent = formatCount(target, meta); return; }
    const dur = o.duration || 1100;
    const start = performance.now();
    const step = (now) => {
      const t = Math.min(1, (now - start) / dur);
      el.textContent = formatCount(target * easeOutCubic(t), meta);
      if (t < 1) requestAnimationFrame(step);
      else el.textContent = formatCount(target, meta);
    };
    requestAnimationFrame(step);
  }

  /** Fire count-up when the element first scrolls into view. */
  function countUpOnView(el) {
    if (!el || el.dataset.fluxCountWired) return;
    el.dataset.fluxCountWired = '1';
    const run = () => countUp(el);
    if (!active()) { run(); return; }
    try {
      const io = new IntersectionObserver((entries, obs) => {
        entries.forEach((en) => { if (en.isIntersecting) { run(); obs.unobserve(en.target); } });
      }, { threshold: 0.4 });
      io.observe(el);
    } catch (_) { run(); }
  }

  /* ── auto-wiring from data attributes (idempotent) ── */

  function wire(root) {
    const scope = root && root.querySelectorAll ? root : document;
    scope.querySelectorAll('[data-flux-beam]').forEach((el) => borderBeam(el, { color: el.dataset.fluxBeam || undefined }));
    scope.querySelectorAll('[data-flux-shimmer]').forEach((el) => shimmerText(el));
    scope.querySelectorAll('[data-flux-tilt]').forEach((el) => tiltCard(el, { max: parseFloat(el.dataset.fluxTilt) || undefined }));
    scope.querySelectorAll('[data-flux-spotlight]').forEach((el) => spotlight(el));
    scope.querySelectorAll('[data-flux-magnet]').forEach((el) => magnet(el, { strength: parseFloat(el.dataset.fluxMagnet) || undefined }));
    scope.querySelectorAll('[data-flux-stagger]').forEach((el) => staggerList(el, { sel: el.dataset.fluxStagger || undefined }));
    scope.querySelectorAll('[data-flux-countup]').forEach((el) => countUpOnView(el));
  }

  function boot() {
    wire(document);
    document.addEventListener('flux-nav', () => setTimeout(() => wire(document), 60));
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  const API = {
    FLAG, active, borderBeam, shimmerText, breathingGlow, tiltCard, spotlight,
    magnet, staggerList, countUp, countUpOnView, wire,
    // pure helpers (exported for tests)
    easeOutCubic, parseTarget, formatCount,
  };
  window.FluxMotion = API;
  // Extend the canonical animation owner when it's present (app context).
  if (window.FluxAnim) Object.assign(window.FluxAnim, {
    borderBeam, shimmerText, breathingGlow, tiltCard, spotlight, magnet, staggerList, countUp,
  });
})();
