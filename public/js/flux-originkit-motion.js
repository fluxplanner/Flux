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

  /* Marks the element and nothing else. The pointer tracking is one delegated
     listener on the document (initSpotlightTracking, below) rather than one
     per card as it used to be.

     That change is what makes "everywhere" affordable. A listener per element
     meant the cost grew with the number of cards, which is why the panel list
     further down was an allowlist with the busier screens left off — and why
     the glow appeared on some panels and not others. One listener costs the
     same whether there are four cards on screen or four hundred. */
  function spotlight(el) {
    if (!el || el.dataset.fluxSpotWired) return;
    el.dataset.fluxSpotWired = '1';
    el.classList.add('flux-spotlight');
  }

  function initSpotlightTracking() {
    if (document.documentElement.dataset.fluxSpotTracking) return;
    document.documentElement.dataset.fluxSpotTracking = '1';
    document.addEventListener('pointermove', (e) => {
      if (!active()) return;
      /* Mouse only. On a touchscreen the pointer sits wherever you last
         tapped, so a glow following it just leaves a smudge behind your
         finger rather than tracking anything. */
      if (e.pointerType && e.pointerType !== 'mouse') return;
      const el = e.target && e.target.closest ? e.target.closest('.flux-spotlight') : null;
      if (!el) return;
      const r = el.getBoundingClientRect();
      el.style.setProperty('--spot-x', (e.clientX - r.left) + 'px');
      el.style.setProperty('--spot-y', (e.clientY - r.top) + 'px');
    }, { passive: true, capture: true });
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

  /**
   * Centralized celebration moment (audit's single celebrate() owner).
   * kind: 'unlock' (accent wash + confetti + label card) | 'calm' (soft wash,
   * no confetti — shutdown ritual) | 'win' (confetti only). Full-viewport,
   * pointer-through, self-removing. No-op when motion is off.
   */
  function celebrate(kind, opts) {
    if (!active()) return;
    const o = opts || {};
    const k = kind || 'win';
    const ov = document.createElement('div');
    ov.className = 'flux-celebrate flux-celebrate-' + k;
    if (o.label) {
      const t = document.createElement('div');
      t.className = 'flux-celebrate-label';
      t.textContent = o.label;
      ov.appendChild(t);
    }
    document.body.appendChild(ov);
    requestAnimationFrame(() => ov.classList.add('flux-celebrate-in'));
    if (k !== 'calm' && typeof window.spawnConfetti === 'function') {
      try { window.spawnConfetti(); } catch (_) {}
    }
    setTimeout(() => {
      ov.classList.remove('flux-celebrate-in');
      setTimeout(() => ov.remove(), 420);
    }, o.hold || 1150);
  }

  /**
   * Directional enter for a swapped-in panel (onboarding steps, view swaps).
   * dir: 'fwd' | 'back'. Staggers common child chips/rows inside. No-op when
   * motion is off — the panel just appears (its .active class already shows it).
   */
  function stepTransition(inEl, dir) {
    if (!inEl || !active()) return;
    inEl.style.setProperty('--ob-dir', dir === 'back' ? '-1' : '1');
    inEl.classList.remove('flux-ob-enter');
    void inEl.offsetWidth; // restart the animation on re-entry
    const kids = inEl.querySelectorAll('.ob-chip, .ob-integration-card, .ob-card');
    kids.forEach((k, i) => k.style.setProperty('--stagger-i', String(i)));
    inEl.classList.add('flux-ob-enter');
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

  /* ── per-panel auto-enhance (no markup edits needed) ──
     Async-rendered panels (educator dashboards, AI results) carry no
     data-flux-* attributes; this applies spotlight/stagger by real class
     name when the panel becomes active. Idempotent (each primitive marks
     its element wired), so the double-pass below is safe. */
  const ENHANCE = {
    teacherDashboard: { spotlight: ['.card', '.td-card'], stagger: ['.lh-list'] },
    lessonHub: { spotlight: ['.lh-class-card', '.card'], stagger: ['.lh-list'] },
    counselorDashboard: { spotlight: ['.card', '.cc-card'], stagger: [] },
    counselorWorkspace: { spotlight: ['.card'], stagger: [] },
    adminDashboard: { spotlight: ['.ao-stat', '.card'], stagger: ['.ao-stats'] },
    adminOps: { spotlight: ['.ao-stat', '.card'], stagger: ['.ao-stats'] },
    ai: { spotlight: [], stagger: ['.flux-ai-proposal'] },
    settings: { spotlight: [], stagger: [] },
    mood: { spotlight: [], stagger: [] },
    goals: { spotlight: [], stagger: [] },
    timer: { spotlight: [], stagger: [] },
    toolbox: { spotlight: ['.st-tool', '.study-tool-card'], stagger: [] },
    notes: { spotlight: ['.note-card'], stagger: ['#notesList'] },
    profile: { spotlight: [], stagger: [] },
  };

  /* Every panel gets this, listed or not. The map above is now only for the
     extra card classes a particular screen uses; ".card" is the app's
     universal card and no longer needs repeating in thirteen places.

     This is the inconsistency: the map was an allowlist, so a panel nobody had
     added — the dashboard, School Info, Extracurriculars, Canvas, the owner
     screens — simply had no glow, and moving between them the effect came and
     went for no reason a user could see.

     Note what ".card" does not match: individual task rows, calendar days and
     table cells. Those keep their own hover states rather than gaining a
     spotlight each, which is the distinction the old comment here was reaching
     for when it excluded whole panels instead. */
  const SPOTLIGHT_ALWAYS = ['.card'];

  function autoEnhance(panelId) {
    if (!active()) return;
    const panel = document.getElementById(panelId);
    if (!panel) return;
    const cfg = ENHANCE[panelId] || {};
    SPOTLIGHT_ALWAYS.concat(cfg.spotlight || [])
      .forEach((sel) => panel.querySelectorAll(sel).forEach(spotlight));
    (cfg.stagger || []).forEach((sel) => panel.querySelectorAll(sel).forEach((c) => staggerList(c)));
  }

  /**
   * Educator/AI panels render async (Supabase round-trips) at unpredictable
   * times. Enhance now, then watch the panel for ~2.5s and re-enhance as
   * content lands (primitives are idempotent), then disconnect.
   */
  function autoEnhanceWatched(panelId) {
    // No longer gated on the panel being in ENHANCE — every panel has cards,
    // and gating here was the other half of why the glow was inconsistent.
    if (!active()) return;
    const panel = document.getElementById(panelId);
    if (!panel) return;
    autoEnhance(panelId);
    let t = null;
    let obs;
    try {
      obs = new MutationObserver(() => {
        if (t) return;
        t = setTimeout(() => { t = null; autoEnhance(panelId); }, 80);
      });
      obs.observe(panel, { childList: true, subtree: true });
      setTimeout(() => { try { obs.disconnect(); } catch (_) {} }, 2500);
    } catch (_) {
      setTimeout(() => autoEnhance(panelId), 700);
    }
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
    initSpotlightTracking();
    wire(document);
    document.addEventListener('flux-nav', (e) => {
      const panelId = e && e.detail && e.detail.panel;
      setTimeout(() => wire(document), 60);
      // Educator/AI panels render async — watch + re-enhance as content lands.
      if (panelId) autoEnhanceWatched(panelId);
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  const API = {
    FLAG, active, borderBeam, shimmerText, breathingGlow, tiltCard, spotlight,
    magnet, staggerList, countUp, countUpOnView, stepTransition, celebrate, autoEnhance, wire,
    // pure helpers (exported for tests)
    easeOutCubic, parseTarget, formatCount,
  };
  window.FluxMotion = API;
  // Extend the canonical animation owner when it's present (app context).
  if (window.FluxAnim) Object.assign(window.FluxAnim, {
    borderBeam, shimmerText, breathingGlow, tiltCard, spotlight, magnet, staggerList, countUp, stepTransition, celebrate,
  });
})();
