/**
 * Neuro-adaptive dashboard — density modes from cognitive load + momentum.
 * Flag: enable_neuro_dashboard (default off).
 */
(function () {
  'use strict';

  const MODES = ['recovery', 'focus', 'flow', 'balanced'];
  const MODE_LABELS = {
    recovery: { icon: '🛟', label: 'Recovery' },
    focus: { icon: '🎯', label: 'Focus' },
    flow: { icon: '⚡', label: 'Flow' },
    balanced: { icon: '◉', label: 'Balanced' },
  };

  let _lastMode = null;
  let _wired = false;

  function enabled() {
    try {
      return !!window.FluxFeatureFlags?.isEnabled('enable_neuro_dashboard', false);
    } catch (_) {
      return false;
    }
  }

  function levelFromScore(score) {
    const s = Number(score) || 0;
    if (s >= 85) return 'overload';
    if (s >= 60) return 'elevated';
    if (s >= 40) return 'balanced';
    return 'calm';
  }

  function cognitiveSignals() {
    try {
      if (window.FluxCognitiveV2?.enabled?.()) {
        const s =
          (typeof FluxCognitiveV2.get === 'function' && FluxCognitiveV2.get()) ||
          (typeof FluxCognitiveV2.compute === 'function' && FluxCognitiveV2.compute());
        if (s) return { score: s.score, level: s.level, inRecovery: !!s.inRecovery };
      }
    } catch (_) {}
    let score = 50;
    if (typeof calcCognitiveLoad === 'function') {
      const r = calcCognitiveLoad();
      score = typeof r === 'object' && r != null ? Number(r.score) || 50 : Number(r) || 50;
    }
    return { score, level: levelFromScore(score), inRecovery: score >= 85 };
  }

  function momentumSignals() {
    try {
      if (window.FluxMomentumV2?.enabled?.()) {
        const m =
          typeof FluxMomentumV2.get === 'function' ? FluxMomentumV2.get() : null;
        if (m) return { composite: m.composite, zone: m.zone || 'idle' };
      }
    } catch (_) {}
    const streak = typeof _momentum !== 'undefined' ? Number(_momentum) || 0 : 0;
    let zone = 'idle';
    if (streak >= 5) zone = 'fire';
    else if (streak >= 3) zone = 'flow';
    else if (streak >= 1) zone = 'warm';
    return { composite: Math.min(100, streak * 14), zone };
  }

  function resolveMode(cog, mom) {
    if (cog.inRecovery || cog.level === 'overload' || cog.score >= 85) return 'recovery';
    if (cog.level === 'elevated' || cog.score >= 60) return 'focus';
    if (mom.composite >= 52 || mom.zone === 'flow' || mom.zone === 'fire') return 'flow';
    return 'balanced';
  }

  function densityForMode(mode) {
    if (mode === 'recovery') return 'minimal';
    if (mode === 'focus') return 'compact';
    if (mode === 'flow') return 'expanded';
    return 'comfortable';
  }

  function compute() {
    const cog = cognitiveSignals();
    const mom = momentumSignals();
    const mode = resolveMode(cog, mom);
    return {
      mode,
      density: densityForMode(mode),
      cog,
      mom,
      hint:
        mode === 'recovery'
          ? 'Non-essential dashboard sections are hidden while load is high.'
          : mode === 'focus'
            ? 'Secondary panels are tucked away so you can work the task list.'
            : mode === 'flow'
              ? 'Momentum is up — workspace gets a little more breathing room.'
              : 'Standard dashboard layout.',
    };
  }

  function ensureChip() {
    let chip = document.getElementById('fluxNeuroDashChip');
    if (chip) return chip;
    const host =
      document.querySelector('.dash-v2-work-head') || document.getElementById('dashHero');
    if (!host) return null;
    chip = document.createElement('span');
    chip.id = 'fluxNeuroDashChip';
    chip.className = 'flux-neuro-dash-chip';
    chip.setAttribute('role', 'status');
    host.appendChild(chip);
    return chip;
  }

  function renderChip(state) {
    const chip = ensureChip();
    if (!chip) return;
    const meta = MODE_LABELS[state.mode] || MODE_LABELS.balanced;
    chip.hidden = false;
    chip.className = `flux-neuro-dash-chip flux-neuro-dash-chip--${state.mode}`;
    chip.title = state.hint;
    chip.textContent = `${meta.icon} ${meta.label}`;
  }

  function hideChip() {
    const chip = document.getElementById('fluxNeuroDashChip');
    if (chip) chip.hidden = true;
  }

  function apply(state) {
    const body = document.body;
    const dash = document.getElementById('dashboard');
    if (!body) return;

    body.dataset.neuroDash = 'on';
    body.dataset.neuroDashMode = state.mode;
    body.dataset.neuroDashDensity = state.density;
    body.dataset.neuroDashScore = String(state.cog.score);
    if (dash) {
      dash.dataset.neuroDashMode = state.mode;
      dash.dataset.neuroDashDensity = state.density;
    }

    const banner = document.getElementById('recoveryBanner');
    if (banner) {
      if (state.mode === 'recovery') banner.style.display = 'flex';
    }

    renderChip(state);
  }

  function clear() {
    const body = document.body;
    const dash = document.getElementById('dashboard');
    if (body) {
      delete body.dataset.neuroDash;
      delete body.dataset.neuroDashMode;
      delete body.dataset.neuroDashDensity;
      delete body.dataset.neuroDashScore;
    }
    if (dash) {
      delete dash.dataset.neuroDashMode;
      delete dash.dataset.neuroDashDensity;
    }
    hideChip();
    _lastMode = null;
  }

  function tick() {
    if (!enabled()) {
      clear();
      return null;
    }
    const state = compute();
    const prev = _lastMode;
    _lastMode = state.mode;
    apply(state);

    if (prev && prev !== state.mode && typeof FluxBus !== 'undefined') {
      try {
        FluxBus.emit('neuro_dashboard_mode_changed', {
          mode: state.mode,
          density: state.density,
          prev,
          cogScore: state.cog.score,
          momentum: state.mom.composite,
        });
      } catch (_) {}
    }

    return state;
  }

  function wireBus() {
    if (_wired || typeof FluxBus === 'undefined' || !FluxBus.on) return;
    _wired = true;
    const refresh = () => {
      if (enabled()) tick();
    };
    FluxBus.on('cognitive_level_changed', refresh);
    FluxBus.on('momentum_v2_updated', refresh);
    FluxBus.on('task_completed', refresh);
    FluxBus.on('session_ended', refresh);
  }

  function install() {
    if (!enabled()) return false;
    wireBus();
    tick();
    return true;
  }

  window.FluxNeuroDashboard = {
    MODES,
    enabled,
    compute,
    tick,
    install,
    clear,
    resolveMode,
    densityForMode,
  };
})();
