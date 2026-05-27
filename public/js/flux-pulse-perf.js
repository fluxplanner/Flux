/* ════════════════════════════════════════════════════════════════════════════
 * FLUX PULSE — Performance Tier Controller (May 2026)
 *
 * Picks a Pulse tier (lite | standard | full) for the current device and
 * applies it via the html[data-pulse-tier] attribute. flux-pulse-perf.css
 * does the visual cost-cutting.
 *
 * Preference order:
 *   1. localStorage.flux_pulse_tier_user        (explicit user choice)
 *   2. localStorage.flux_pulse_tier_default     (owner default)
 *   3. Auto-detect (device hints + FPS sampler)
 *
 * AUTO mode also continuously samples FPS for the first ~6 seconds after
 * boot and downgrades the tier if the average drops below 40fps. Once
 * downgraded, it stays downgraded for the session unless the user overrides.
 *
 * Public API on window.FluxPulsePerf:
 *   .getTier()           -> 'lite'|'standard'|'full'|'auto'
 *   .setTier(t)          -> persist + apply
 *   .clearOverride()     -> back to auto
 *   .reportFps()         -> latest sampled fps
 *   .subscribe(fn)       -> notify on tier change
 * ──────────────────────────────────────────────────────────────────────────── */
(function () {
  'use strict';

  var STORAGE_USER = 'flux_pulse_tier_user';
  var STORAGE_DEFAULT = 'flux_pulse_tier_default';
  var TIERS = ['auto', 'lite', 'standard', 'full'];
  var listeners = [];
  var _appliedTier = null;
  var _autoChosenTier = null;
  var _fps = 0;

  function read(key, fallback) {
    try {
      var v = localStorage.getItem(key);
      return v == null ? fallback : v;
    } catch (_) {
      return fallback;
    }
  }
  function write(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch (_) {}
  }

  function isPulse() {
    try {
      return document.documentElement.classList.contains('flux-layout-pulse');
    } catch (_) {
      return false;
    }
  }

  function getStoredTier() {
    var v = read(STORAGE_USER, null);
    if (v && TIERS.indexOf(v) !== -1) return v;
    var d = read(STORAGE_DEFAULT, null);
    if (d && TIERS.indexOf(d) !== -1) return d;
    return 'auto';
  }

  /* ───────── Device capability detection ───────── */

  function detectDeviceTier() {
    var hints = [];
    var weakSignals = 0;
    var strongSignals = 0;

    // Memory hint (Chrome). <= 4 = phone/tablet bracket
    try {
      var mem = navigator.deviceMemory;
      if (typeof mem === 'number') {
        hints.push('mem=' + mem);
        if (mem <= 2) weakSignals += 2;
        else if (mem <= 4) weakSignals += 1;
        else if (mem >= 8) strongSignals += 1;
      }
    } catch (_) {}

    // CPU cores
    try {
      var cores = navigator.hardwareConcurrency;
      if (typeof cores === 'number') {
        hints.push('cores=' + cores);
        if (cores <= 2) weakSignals += 2;
        else if (cores <= 4) weakSignals += 1;
        else if (cores >= 8) strongSignals += 1;
      }
    } catch (_) {}

    // Connection — save-data implies metered/weak
    try {
      var conn = navigator.connection || navigator.webkitConnection;
      if (conn) {
        if (conn.saveData) {
          hints.push('save-data');
          weakSignals += 2;
        }
        if (conn.effectiveType === '2g' || conn.effectiveType === 'slow-2g') {
          hints.push(conn.effectiveType);
          weakSignals += 2;
        } else if (conn.effectiveType === '3g') {
          hints.push('3g');
          weakSignals += 1;
        }
      }
    } catch (_) {}

    // Viewport (coarse pointer + small viewport → likely phone)
    try {
      var isCoarse = window.matchMedia('(pointer: coarse)').matches;
      var narrow = window.innerWidth < 720;
      if (isCoarse) hints.push('coarse');
      if (narrow) hints.push('narrow');
      // Phones on standard plan often look fine, but combine with weak CPU
      // hints they should drop to lite. Don't penalize coarse alone.
    } catch (_) {}

    // Reduced motion forces lite
    try {
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        hints.push('reduce-motion');
        weakSignals += 3;
      }
    } catch (_) {}

    var tier;
    if (weakSignals >= 3) tier = 'lite';
    else if (weakSignals >= 1 && strongSignals === 0) tier = 'standard';
    else if (strongSignals >= 1) tier = 'full';
    else tier = 'standard';

    _autoChosenTier = tier;
    return { tier: tier, hints: hints };
  }

  /* ───────── FPS sampling for dynamic downgrade ───────── */

  var _fpsSamples = [];
  var _fpsLast = 0;
  var _fpsRaf = null;
  var _fpsStartedAt = 0;
  var _fpsHandled = false;

  function startFpsSampler() {
    if (_fpsRaf) return;
    _fpsStartedAt = performance.now();
    _fpsLast = _fpsStartedAt;
    var loop = function (now) {
      var dt = now - _fpsLast;
      if (dt > 0) {
        var instant = 1000 / dt;
        // Clamp to ignore freak >120 readings between throttled frames
        if (instant > 0 && instant < 240) _fpsSamples.push(instant);
        if (_fpsSamples.length > 120) _fpsSamples.shift();
      }
      _fpsLast = now;
      // Sample for 6 seconds total
      if (now - _fpsStartedAt < 6000) {
        _fpsRaf = requestAnimationFrame(loop);
      } else {
        _fpsRaf = null;
        evaluateFpsAndMaybeDowngrade();
      }
    };
    _fpsRaf = requestAnimationFrame(loop);
  }

  function evaluateFpsAndMaybeDowngrade() {
    if (_fpsHandled) return;
    _fpsHandled = true;
    if (!_fpsSamples.length) return;
    // Use the last 90 samples (skip the first ~30 — boot is always janky)
    var samples = _fpsSamples.slice(-90);
    var sum = 0;
    for (var i = 0; i < samples.length; i++) sum += samples[i];
    var avg = sum / samples.length;
    _fps = Math.round(avg);
    // Only act if we're in auto mode
    if (getStoredTier() !== 'auto') return;
    if (_appliedTier === 'lite') return; // already lite, nothing to do
    if (avg < 38) {
      // Big drop — go all the way to lite
      _autoChosenTier = 'lite';
      apply('lite', { reason: 'fps:' + _fps });
    } else if (avg < 50 && _appliedTier === 'full') {
      // Soft downgrade
      _autoChosenTier = 'standard';
      apply('standard', { reason: 'fps:' + _fps });
    }
  }

  function reportFps() {
    return _fps;
  }

  /* ───────── Apply tier ───────── */

  function resolveEffective(t) {
    if (t === 'auto') {
      var d = detectDeviceTier();
      return d.tier;
    }
    return t;
  }

  function apply(t, opts) {
    var html = document.documentElement;
    if (!html) return;
    var stored = t || getStoredTier();
    var effective = resolveEffective(stored);
    if (_appliedTier === effective && !opts) return;
    _appliedTier = effective;
    html.setAttribute('data-pulse-tier', effective);
    html.setAttribute('data-pulse-tier-mode', stored);
    if (stored === 'auto') html.setAttribute('data-pulse-auto-tier', '1');
    else html.removeAttribute('data-pulse-auto-tier');
    notify(effective, stored, opts);
  }

  function setTier(t) {
    if (TIERS.indexOf(t) === -1) return;
    write(STORAGE_USER, t);
    apply(t, { reason: 'user' });
    syncTierUI();
  }

  function clearOverride() {
    try {
      localStorage.removeItem(STORAGE_USER);
    } catch (_) {}
    apply('auto', { reason: 'reset' });
    syncTierUI();
  }

  function getTier() {
    return getStoredTier();
  }

  function getEffectiveTier() {
    return _appliedTier;
  }

  function subscribe(fn) {
    if (typeof fn === 'function') listeners.push(fn);
    return function () {
      var i = listeners.indexOf(fn);
      if (i >= 0) listeners.splice(i, 1);
    };
  }

  function notify(effective, mode, opts) {
    for (var i = 0; i < listeners.length; i++) {
      try {
        listeners[i](effective, mode, opts || {});
      } catch (_) {}
    }
  }

  /* ───────── Pause animations when tab hidden (battery saver) ───────── */

  function bindVisibility() {
    var sync = function () {
      var html = document.documentElement;
      if (!html) return;
      if (document.hidden) html.classList.add('flux-pulse-paused');
      else html.classList.remove('flux-pulse-paused');
    };
    document.addEventListener('visibilitychange', sync);
    sync(); // initial state — pause immediately if hidden at boot
  }

  /* ───────── Settings UI (tier picker card) ───────── */

  function ensureSettingsTierCard() {
    var spane = document.getElementById('spane-appearance');
    if (!spane) return;
    if (document.getElementById('fluxPulseTierCard')) return;
    if (!isPulse()) return; // Only show when Pulse is active

    var card = document.createElement('div');
    card.className = 'card';
    card.id = 'fluxPulseTierCard';
    card.innerHTML =
      '' +
      '<h3>Pulse performance</h3>' +
      '<div class="ssub" style="font-size:.75rem;color:var(--muted2);margin-bottom:12px;line-height:1.55">' +
      'Tune how heavy Pulse looks. Auto picks the best tier for your device; pick Lite manually if Pulse feels laggy.' +
      '</div>' +
      '<div class="flux-pulse-tier-grid" role="tablist" aria-label="Pulse tier">' +
      '<button type="button" role="tab" data-pulse-tier-pick="auto" aria-selected="false">Auto<span class="flux-pulse-tier-sub">detected</span></button>' +
      '<button type="button" role="tab" data-pulse-tier-pick="lite" aria-selected="false">Lite<span class="flux-pulse-tier-sub">fastest</span></button>' +
      '<button type="button" role="tab" data-pulse-tier-pick="standard" aria-selected="false">Standard<span class="flux-pulse-tier-sub">balanced</span></button>' +
      '<button type="button" role="tab" data-pulse-tier-pick="full" aria-selected="false">Full<span class="flux-pulse-tier-sub">richest</span></button>' +
      '</div>' +
      '<div class="flux-pulse-tier-status">' +
      '<span class="pulse-status-dot"></span>' +
      '<span id="fluxPulseTierStatusText">—</span>' +
      '</div>';

    // Insert just after the layout switcher card if it exists; else prepend.
    var anchor = document.getElementById('fluxPulseSwitchCard');
    if (anchor && anchor.nextSibling) spane.insertBefore(card, anchor.nextSibling);
    else if (anchor) spane.appendChild(card);
    else spane.insertBefore(card, spane.firstChild);

    card.querySelectorAll('[data-pulse-tier-pick]').forEach(function (b) {
      b.addEventListener('click', function () {
        var t = b.getAttribute('data-pulse-tier-pick');
        if (t === 'auto') clearOverride();
        else setTier(t);
        try {
          if (window.showToast) {
            var label = t.charAt(0).toUpperCase() + t.slice(1);
            window.showToast('Pulse: ' + label, 'info');
          }
        } catch (_) {}
      });
    });

    syncTierUI();
  }

  function syncTierUI() {
    var card = document.getElementById('fluxPulseTierCard');
    if (!card) return;
    var mode = getStoredTier();
    card.querySelectorAll('[data-pulse-tier-pick]').forEach(function (b) {
      var on = b.getAttribute('data-pulse-tier-pick') === mode;
      b.classList.toggle('active', on);
      b.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    var status = document.getElementById('fluxPulseTierStatusText');
    if (status) {
      var eff = _appliedTier || resolveEffective(mode);
      var fpsStr = _fps ? ' · ~' + _fps + 'fps' : '';
      if (mode === 'auto') {
        status.textContent = 'Auto → ' + eff + fpsStr;
      } else {
        status.textContent = 'Manual: ' + mode + fpsStr;
      }
    }
  }

  /* ───────── Boot ───────── */

  function pollMount() {
    var tries = 0;
    var tick = function () {
      tries++;
      try {
        if (document.getElementById('spane-appearance')) ensureSettingsTierCard();
      } catch (_) {}
      if (tries < 24) setTimeout(tick, 400);
    };
    tick();
  }

  function init() {
    // Apply on boot
    apply(getStoredTier(), { reason: 'boot' });
    bindVisibility();
    startFpsSampler();
    pollMount();

    // Re-evaluate when Pulse layout is toggled on
    try {
      if (window.FluxPulse && typeof window.FluxPulse.subscribe === 'function') {
        window.FluxPulse.subscribe(function () {
          apply(getStoredTier(), { reason: 'layout-toggle' });
          // Card visibility depends on isPulse()
          var existing = document.getElementById('fluxPulseTierCard');
          if (existing && !isPulse()) existing.remove();
          if (!existing && isPulse()) ensureSettingsTierCard();
        });
      }
    } catch (_) {}

    // Reapply on nav (panel switch can mount Settings)
    var navTries = 0;
    var tryWrapNav = function () {
      navTries++;
      if (typeof window.nav === 'function' && !window.nav._fluxPulsePerfWrapped) {
        var orig = window.nav;
        var wrapped = function () {
          var r = orig.apply(this, arguments);
          try {
            setTimeout(function () {
              ensureSettingsTierCard();
              syncTierUI();
            }, 80);
          } catch (_) {}
          return r;
        };
        wrapped._fluxPulsePerfWrapped = true;
        try {
          window.nav = wrapped;
        } catch (_) {}
      } else if (navTries < 20) {
        setTimeout(tryWrapNav, 300);
      }
    };
    tryWrapNav();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }

  window.FluxPulsePerf = {
    getTier: getTier,
    getEffectiveTier: getEffectiveTier,
    setTier: setTier,
    clearOverride: clearOverride,
    reportFps: reportFps,
    subscribe: subscribe,
    detectDeviceTier: detectDeviceTier,
    _applied: function () {
      return _appliedTier;
    },
  };
})();
