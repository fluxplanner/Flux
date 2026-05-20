/**
 * Momentum v2 — task / academic / emotional / recovery domains.
 * Flag: enable_momentum_v2 (default off). Legacy _momentum unchanged when off.
 */
(function () {
  'use strict';

  const STORE_KEY = 'flux_momentum_v2_v1';
  const DOMAINS = ['task', 'academic', 'emotional', 'recovery'];

  const WEIGHTS = { task: 0.35, academic: 0.25, emotional: 0.2, recovery: 0.2 };

  let _state = null;
  let _wired = false;

  function enabled() {
    try {
      return !!window.FluxFeatureFlags?.isEnabled('enable_momentum_v2', false);
    } catch (_) {
      return false;
    }
  }

  function store() {
    return window.FluxStorage || null;
  }

  function readStore(def) {
    const fs = store();
    if (fs && typeof fs.load === 'function') return fs.load(STORE_KEY, def);
    try {
      if (typeof load === 'function') return load(STORE_KEY, def);
    } catch (_) {}
    return def;
  }

  function writeStore(val) {
    const fs = store();
    if (fs && typeof fs.save === 'function') fs.save(STORE_KEY, val);
    else if (typeof save === 'function') save(STORE_KEY, val);
  }

  function defaults() {
    return {
      task: 0,
      academic: 0,
      emotional: 50,
      recovery: 50,
      sessionStreak: 0,
      updatedAt: null,
    };
  }

  function clamp(n, lo, hi) {
    return Math.max(lo, Math.min(hi, n));
  }

  function todayStr() {
    if (typeof window.todayStr === 'function') return window.todayStr();
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  function gatherContext() {
    const ts = todayStr();
    const taskList = typeof tasks !== 'undefined' && Array.isArray(tasks) ? tasks : [];
    const moods =
      typeof moodHistory !== 'undefined' && Array.isArray(moodHistory)
        ? moodHistory
        : [];
    const sessions =
      typeof sessionLog !== 'undefined' && Array.isArray(sessionLog) ? sessionLog : [];
    let loadScore = 50;
    try {
      if (typeof calcCognitiveLoad === 'function') {
        const r = calcCognitiveLoad();
        if (r && typeof r.score === 'number') loadScore = r.score;
      }
    } catch (_) {}
    let restToday = false;
    try {
      if (typeof loadRestDaysList === 'function') {
        const rd = loadRestDaysList();
        restToday = Array.isArray(rd) && rd.includes(ts);
      }
    } catch (_) {}
    return { ts, taskList, moods, sessions, loadScore, restToday };
  }

  /**
   * Pure domain scores 0–100.
   */
  function computeDomains(ctx, prev) {
    const p = prev || defaults();
    const streak = Number(p.sessionStreak) || 0;
    const taskFromStreak = clamp(streak * 18, 0, 90);
    const doneToday = (ctx.taskList || []).filter(
      (t) => t && t.done && t.date === ctx.ts,
    ).length;
    const task = clamp(Math.round(taskFromStreak + Math.min(30, doneToday * 6)), 0, 100);

    const sessionsToday = (ctx.sessions || []).filter((s) => s && s.date === ctx.ts).length;
    const academicTasks = (ctx.taskList || []).filter(
      (t) => t && t.done && t.date === ctx.ts && (t.subject || t.class),
    ).length;
    const academic = clamp(
      Math.round(Math.min(55, sessionsToday * 14) + Math.min(45, academicTasks * 9)),
      0,
      100,
    );

    const lastMood = (ctx.moods || []).slice(-1)[0];
    let emotional = 50;
    if (lastMood) {
      const moodN = clamp(Number(lastMood.mood) || 3, 1, 5);
      const stressN = clamp(Number(lastMood.stress) || 5, 1, 10);
      emotional = clamp(
        Math.round(((moodN - 1) / 4) * 70 + ((10 - stressN) / 9) * 30),
        0,
        100,
      );
    }

    let recovery = clamp(100 - (Number(ctx.loadScore) || 50), 0, 100);
    if (ctx.restToday) recovery = clamp(recovery + 25, 0, 100);
    if (lastMood && lastMood.sleep != null) {
      recovery = clamp(
        Math.round(recovery * 0.7 + clamp(Number(lastMood.sleep) / 8, 0, 1) * 30),
        0,
        100,
      );
    }

    return { task, academic, emotional, recovery, sessionStreak: streak };
  }

  function composite(dom) {
    return clamp(
      Math.round(
        dom.task * WEIGHTS.task +
          dom.academic * WEIGHTS.academic +
          dom.emotional * WEIGHTS.emotional +
          dom.recovery * WEIGHTS.recovery,
      ),
      0,
      100,
    );
  }

  function zoneFromComposite(score) {
    if (score >= 80) return 'fire';
    if (score >= 58) return 'flow';
    if (score >= 32) return 'warm';
    return 'idle';
  }

  function refresh() {
    if (!enabled()) return null;
    const prev = _state || readStore(null) || defaults();
    const ctx = gatherContext();
    const dom = computeDomains(ctx, prev);
    const comp = composite(dom);
    _state = {
      ...dom,
      composite: comp,
      zone: zoneFromComposite(comp),
      updatedAt: new Date().toISOString(),
    };
    writeStore(_state);
    return _state;
  }

  function get() {
    if (!enabled()) return null;
    if (!_state) refresh();
    return _state;
  }

  function onSessionPulse(streak) {
    if (!enabled()) return;
    const prev = _state || readStore(null) || defaults();
    prev.sessionStreak = Number(streak) || 0;
    _state = prev;
    refresh();
    render();
  }

  function onTaskComplete() {
    if (!enabled()) return;
    refresh();
    render();
  }

  function onSessionEnded() {
    if (!enabled()) return;
    refresh();
    render();
  }

  function onMoodSaved() {
    if (!enabled()) return;
    refresh();
    render();
  }

  function applyZone(zone) {
    const root = document.documentElement;
    const z = zone || 'idle';
    root.setAttribute('data-zone', z);
    const zoneStyles = {
      idle: { glow: 'none', border: 'var(--border)' },
      warm: {
        glow: '0 0 40px rgba(var(--accent-rgb),.04)',
        border: 'rgba(var(--accent-rgb),.08)',
      },
      flow: {
        glow: '0 0 60px rgba(var(--accent-rgb),.07)',
        border: 'rgba(var(--accent-rgb),.12)',
      },
      fire: {
        glow: '0 0 80px rgba(255,77,109,.06)',
        border: 'rgba(255,77,109,.1)',
      },
    };
    const s = zoneStyles[z] || zoneStyles.idle;
    root.style.setProperty('--zone-glow', s.glow);
    root.style.setProperty('--zone-border', s.border);
  }

  function render() {
    if (!enabled()) return;
    const s = get();
    if (!s) return;
    const el = document.getElementById('momentumPill');
    if (el) {
      el.classList.add('flux-momentum-v2-pill');
      el.style.display = s.composite >= 28 ? 'flex' : 'none';
      const tip = DOMAINS.map((d) => `${d[0].toUpperCase()}:${Math.round(s[d])}`).join(' ');
      el.title = `Momentum ${s.composite}/100 — ${tip}`;
      el.innerHTML = `<span class="flux-mv2-score">🔥 ${s.composite}</span><span class="flux-mv2-domains" aria-hidden="true">${DOMAINS.map(
        (d) =>
          `<span class="flux-mv2-bar flux-mv2-${d}" style="--mv2-p:${s[d]}%" title="${d}"></span>`,
      ).join('')}</span>`;
    }
    applyZone(s.zone);
    try {
      if (typeof FluxBus !== 'undefined') {
        FluxBus.emit('momentum_v2_updated', {
          composite: s.composite,
          zone: s.zone,
          task: s.task,
          academic: s.academic,
          emotional: s.emotional,
          recovery: s.recovery,
        });
      }
    } catch (_) {}
  }

  function install() {
    if (_wired || !enabled()) return false;
    if (typeof FluxBus !== 'undefined' && FluxBus.on) {
      FluxBus.on('task_completed', onTaskComplete);
      FluxBus.on('session_ended', onSessionEnded);
    }
    _wired = true;
    refresh();
    render();
    return true;
  }

  function uninstall() {
    _wired = false;
    _state = null;
    const el = document.getElementById('momentumPill');
    if (el) el.classList.remove('flux-momentum-v2-pill');
  }

  window.FluxMomentumV2 = {
    DOMAINS,
    STORE_KEY,
    enabled,
    refresh,
    get,
    composite,
    zoneFromComposite,
    onSessionPulse,
    onTaskComplete,
    onSessionEnded,
    onMoodSaved,
    render,
    install,
    uninstall,
    computeDomains,
  };
})();
