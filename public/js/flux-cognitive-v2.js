/**
 * Cognitive load v2 — enriched signals + UI tokens (calm / balanced / elevated / overload).
 * Flag: enable_cognitive_ui (default off). Legacy updateCognitiveLoadMeter when off.
 */
(function () {
  'use strict';

  const LEVELS = ['calm', 'balanced', 'elevated', 'overload'];
  const STORE_KEY = 'flux_cognitive_v2_last_v1';

  let _last = null;

  function enabled() {
    try {
      return !!window.FluxFeatureFlags?.isEnabled('enable_cognitive_ui', false);
    } catch (_) {
      return false;
    }
  }

  function clamp(n, lo, hi) {
    return Math.max(lo, Math.min(hi, n));
  }

  function levelFromScore(score) {
    const s = Number(score) || 0;
    if (s >= 85) return 'overload';
    if (s >= 60) return 'elevated';
    if (s >= 40) return 'balanced';
    return 'calm';
  }

  function baseLoad() {
    if (window.FluxBehavior && typeof window.FluxBehavior.calcCognitiveLoad === 'function') {
      try {
        const taskList = typeof tasks !== 'undefined' ? tasks : [];
        const cls = typeof classes !== 'undefined' ? classes : [];
        return window.FluxBehavior.calcCognitiveLoad({
          tasks: taskList,
          classes: cls,
          now: new Date(),
        });
      } catch (_) {}
    }
    const score =
      typeof calcCognitiveLoad === 'function' ? calcCognitiveLoad() : 50;
    return {
      score,
      level: levelFromScore(score),
      breakdown: {},
    };
  }

  function moodSignals() {
    const moods =
      typeof moodHistory !== 'undefined' && Array.isArray(moodHistory)
        ? moodHistory
        : [];
    const m = moods.slice(-1)[0];
    if (!m) return { stressBoost: 0, sleepBoost: 0 };
    let stressBoost = 0;
    let sleepBoost = 0;
    const stress = Number(m.stress);
    if (stress >= 8) stressBoost = 10;
    else if (stress >= 6) stressBoost = 5;
    const sleep = Number(m.sleep);
    if (sleep > 0 && sleep < 6) sleepBoost = 8;
    else if (sleep >= 8) sleepBoost = -4;
    return { stressBoost, sleepBoost };
  }

  function compute() {
    const base = baseLoad();
    const mood = moodSignals();
    const score = clamp(
      Math.round(base.score + mood.stressBoost + mood.sleepBoost),
      0,
      100,
    );
    const level = levelFromScore(score);
    const inRecovery = score >= 85;
    return {
      score,
      level,
      inRecovery,
      breakdown: {
        ...(base.breakdown || {}),
        stressBoost: mood.stressBoost,
        sleepBoost: mood.sleepBoost,
        baseScore: base.score,
      },
      label:
        level === 'overload'
          ? 'Overload'
          : level === 'elevated'
            ? 'Elevated'
            : level === 'balanced'
              ? 'Balanced'
              : 'Calm',
    };
  }

  function applyTokens(state) {
    const body = document.body;
    if (!body) return;
    body.dataset.cognitiveV2 = 'on';
    body.dataset.cognitiveLevel = state.level;
    body.dataset.cognitiveScore = String(state.score);
    body.dataset.recovery = state.inRecovery ? 'true' : 'false';
    body.classList.toggle('flux-cog-density-compact', state.level === 'elevated');
    body.classList.toggle('flux-cog-density-minimal', state.level === 'overload');

    const root = document.documentElement;
    const tokens = {
      calm: { accent: '#10d9a0', glow: 'rgba(16,217,160,.12)' },
      balanced: { accent: '#3b82f6', glow: 'rgba(59,130,246,.1)' },
      elevated: { accent: '#fbbf24', glow: 'rgba(251,191,36,.14)' },
      overload: { accent: '#f43f5e', glow: 'rgba(244,63,94,.16)' },
    };
    const t = tokens[state.level] || tokens.balanced;
    root.style.setProperty('--flux-cog-accent', t.accent);
    root.style.setProperty('--flux-cog-glow', t.glow);
    root.style.setProperty('--flux-cog-score', String(state.score));
  }

  function renderMeter(state) {
    const el = document.getElementById('fluxCognitiveMeter');
    if (!el) return;
    el.style.display = 'flex';
    el.setAttribute('aria-valuenow', String(state.score));
    el.setAttribute('aria-valuemin', '0');
    el.setAttribute('aria-valuemax', '100');
    el.dataset.level = state.level;
    const label = el.querySelector('.flux-cog-label');
    const fill = el.querySelector('.flux-cog-fill');
    if (label) label.textContent = `${state.label} · ${state.score}%`;
    if (fill) fill.style.width = `${state.score}%`;
  }

  function hideMeter() {
    const el = document.getElementById('fluxCognitiveMeter');
    if (el) el.style.display = 'none';
  }

  function tick() {
    if (!enabled()) return null;
    const state = compute();
    const prev = _last;
    _last = state;

    applyTokens(state);
    renderMeter(state);

    try {
      const fs = window.FluxStorage;
      if (fs && typeof fs.save === 'function') {
        fs.save(STORE_KEY, { score: state.score, level: state.level, at: Date.now() });
      }
    } catch (_) {}

    if (state.inRecovery && !window._fluxRecoveryToastShown) {
      window._fluxRecoveryToastShown = true;
      if (typeof showToast === 'function') {
        showToast(
          `Cognitive load ${state.score}% — recovery mode hides non-essential tasks.`,
          'warning',
        );
      }
    } else if (!state.inRecovery && window._fluxRecoveryToastShown) {
      window._fluxRecoveryToastShown = false;
    }

    if (prev && prev.level !== state.level && typeof FluxBus !== 'undefined') {
      try {
        FluxBus.emit('cognitive_level_changed', {
          level: state.level,
          score: state.score,
          prev: prev.level,
        });
      } catch (_) {}
    }

    return state;
  }

  function install() {
    if (!enabled()) return false;
    tick();
    return true;
  }

  function clearTokens() {
    const body = document.body;
    if (!body) return;
    delete body.dataset.cognitiveV2;
    delete body.dataset.cognitiveLevel;
    delete body.dataset.cognitiveScore;
    body.classList.remove('flux-cog-density-compact', 'flux-cog-density-minimal');
    hideMeter();
  }

  function get() {
    return _last || (enabled() ? compute() : null);
  }

  window.FluxCognitiveV2 = {
    LEVELS,
    enabled,
    compute,
    tick,
    install,
    clearTokens,
    get,
    levelFromScore,
  };
})();
