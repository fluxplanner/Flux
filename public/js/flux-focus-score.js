/**
 * P18.1 — Focus score heuristic (session length vs interruptions).
 * Flag: enable_focus_score (default off).
 */
(function () {
  'use strict';

  const FLAG = 'enable_focus_score';
  const CARD_ID = 'fluxFocusScoreCard';

  function enabled() {
    try {
      return !!window.FluxFeatureFlags?.isEnabled(FLAG, false);
    } catch (_) {
      return false;
    }
  }

  function esc(s) {
    if (typeof window.esc === 'function') return window.esc(s);
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function T(key, vars) {
    if (typeof window.fluxT === 'function') return window.fluxT(key, vars);
    return key;
  }

  function todayStr() {
    return typeof window.todayStr === 'function' ? window.todayStr() : new Date().toISOString().slice(0, 10);
  }

  function addDays(iso, n) {
    const d = new Date(iso + 'T00:00:00');
    d.setDate(d.getDate() + n);
    return d.toISOString().slice(0, 10);
  }

  function sessionLog() {
    return typeof window.sessionLog !== 'undefined' && Array.isArray(window.sessionLog)
      ? window.sessionLog
      : typeof window.load === 'function'
        ? window.load('flux_session_log', [])
        : [];
  }

  function saveSessionLog(log) {
    if (typeof window.sessionLog !== 'undefined') window.sessionLog = log;
    if (typeof window.save === 'function') window.save('flux_session_log', log);
    try {
      if (typeof window.syncKey === 'function') window.syncKey('sessionLog', log);
    } catch (_) {}
  }

  function scoreSession(mins, distractions) {
    const m = Math.max(0, parseInt(mins, 10) || 0);
    const d = Math.max(0, parseInt(distractions, 10) || 0);
    if (m < 1) return 0;
    const lengthPts = Math.min(52, m * 1.2);
    const interruptPenalty = Math.min(48, d * 16);
    return Math.round(Math.max(5, Math.min(100, lengthPts + (48 - interruptPenalty))));
  }

  function bandForScore(score) {
    if (score >= 85) return { key: 'fs.band_deep', color: 'var(--green)' };
    if (score >= 70) return { key: 'fs.band_solid', color: 'var(--accent)' };
    if (score >= 50) return { key: 'fs.band_frag', color: 'var(--gold)' };
    return { key: 'fs.band_interrupt', color: 'var(--red)' };
  }

  function sessionScore(entry) {
    if (!entry) return 0;
    if (Number.isFinite(parseInt(entry.focusScore, 10))) return parseInt(entry.focusScore, 10);
    return scoreSession(entry.mins, entry.distractions || 0);
  }

  function sessionsSince(isoFrom) {
    return sessionLog().filter((s) => s && s.date && s.date >= isoFrom && (parseInt(s.mins, 10) || 0) > 0);
  }

  function averageScore(list) {
    if (!list.length) return 0;
    const sum = list.reduce((acc, s) => acc + sessionScore(s), 0);
    return Math.round(sum / list.length);
  }

  function annotateLastSession(distractions) {
    const log = sessionLog().slice();
    if (!log.length) return;
    const last = log[log.length - 1];
    const d = Math.max(0, parseInt(distractions, 10) || 0);
    last.distractions = d;
    last.focusScore = scoreSession(last.mins, d);
    saveSessionLog(log);
  }

  function wrapTimerDone() {
    const orig = window.timerDone;
    if (typeof orig !== 'function' || orig._fluxFsWrapped) return;
    window.timerDone = function () {
      const dist =
        typeof window.getPomDistractionCount === 'function' ? window.getPomDistractionCount() : 0;
      orig.apply(this, arguments);
      try {
        if (enabled()) annotateLastSession(dist);
      } catch (_) {}
      try {
        if (enabled()) renderCard();
      } catch (_) {}
    };
    window.timerDone._fluxFsWrapped = true;
  }

  function wrapSessionRecap() {
    const orig = window.showSessionRecap;
    if (typeof orig !== 'function' || orig._fluxFsWrapped) return;
    window.showSessionRecap = function (subject, mins) {
      orig.apply(this, arguments);
      if (!enabled()) return;
      const recap = document.getElementById('sessionRecap');
      if (!recap) return;
      const log = sessionLog();
      const last = log[log.length - 1];
      const score = sessionScore(last);
      const band = bandForScore(score);
      const row = document.createElement('div');
      row.className = 'flux-fs-recap-score';
      row.textContent = T('fs.recap', { score, band: T(band.key) });
      recap.querySelector('div[style*="font-weight:700"]')?.insertAdjacentElement('afterend', row);
    };
    window.showSessionRecap._fluxFsWrapped = true;
  }

  function wrapFocusHeatmap() {
    const orig = window.renderFocusHeatmap;
    if (typeof orig !== 'function' || orig._fluxFsWrapped) return;
    window.renderFocusHeatmap = function () {
      const r = orig.apply(this, arguments);
      try {
        if (enabled()) renderCard();
      } catch (_) {}
      return r;
    };
    window.renderFocusHeatmap._fluxFsWrapped = true;
  }

  function renderCard() {
    if (!enabled()) return;
    const card = document.getElementById(CARD_ID);
    if (!card) return;

    const today = todayStr();
    const weekFrom = addDays(today, -6);
    const todaySessions = sessionsSince(today);
    const weekSessions = sessionsSince(weekFrom);
    const todayAvg = averageScore(todaySessions);
    const weekAvg = averageScore(weekSessions);
    const displayScore = todaySessions.length ? todayAvg : weekAvg;
    const band = bandForScore(displayScore);
    const ringBorder = band.color;

    card.innerHTML = `<div class="flux-fs-head">
  <div class="flux-fs-score-ring" style="border-color:${esc(ringBorder)}">
    <div class="flux-fs-score-num" style="color:${esc(ringBorder)}">${displayScore || '—'}</div>
    <div class="flux-fs-score-label">${esc(T('fs.score'))}</div>
  </div>
  <div class="flux-fs-meta">
    <div class="flux-fs-title">${esc(T('fs.title'))}</div>
    <div class="flux-fs-band" style="color:${esc(ringBorder)}">${esc(T(band.key))}</div>
    <p class="flux-fs-lede">${esc(T('fs.lede'))}</p>
  </div>
</div>
<div class="flux-fs-stats">
  <div class="flux-fs-stat">
    <div class="flux-fs-stat-val">${todaySessions.length ? todayAvg : '—'}</div>
    <div class="flux-fs-stat-lbl">${esc(T('fs.today'))}</div>
  </div>
  <div class="flux-fs-stat">
    <div class="flux-fs-stat-val">${weekSessions.length ? weekAvg : '—'}</div>
    <div class="flux-fs-stat-lbl">${esc(T('fs.week'))}</div>
  </div>
</div>`;
  }

  function ensureCard() {
    if (!enabled()) {
      document.getElementById(CARD_ID)?.remove();
      return;
    }
    const heatCard = document.getElementById('focusHeatmap')?.closest('.card');
    const stack = heatCard?.parentElement;
    if (!stack) return;

    let card = document.getElementById(CARD_ID);
    if (!card) {
      card = document.createElement('div');
      card.id = CARD_ID;
      card.className = 'card flux-fs-card';
      card.setAttribute('role', 'region');
      card.setAttribute('aria-label', T('fs.aria'));
      heatCard.insertAdjacentElement('beforebegin', card);
    }
    renderCard();
  }

  function getPaletteCommands(q) {
    if (!enabled()) return [];
    const needle = (q || '').toLowerCase();
    const label = T('fs.palette');
    const keys = 'focus score interruption distraction quality session';
    if (
      needle &&
      !label.toLowerCase().includes(needle) &&
      !keys.split(' ').some((k) => needle.includes(k))
    ) {
      return [];
    }
    return [
      {
        icon: '🎯',
        label,
        cat: 'Navigation',
        action: () => {
          if (typeof window.closeCommandPalette === 'function') window.closeCommandPalette();
          if (typeof window.nav === 'function') {
            const tab = document.querySelector('[data-tab="timer"]');
            window.nav('timer', tab);
          }
          setTimeout(() => ensureCard(), 150);
        },
      },
    ];
  }

  function install() {
    if (!enabled()) {
      document.getElementById(CARD_ID)?.remove();
      return false;
    }
    wrapTimerDone();
    wrapSessionRecap();
    wrapFocusHeatmap();
    ensureCard();
    const origNav = window.nav;
    if (typeof origNav === 'function' && !origNav._fluxFsWrapped) {
      window.nav = function (id) {
        const r = origNav.apply(this, arguments);
        if (id === 'timer') setTimeout(() => ensureCard(), 60);
        return r;
      };
      window.nav._fluxFsWrapped = true;
    }
    return true;
  }

  window.FluxFocusScore = {
    FLAG,
    enabled,
    scoreSession,
    sessionScore,
    averageScore,
    renderCard,
    ensureCard,
    getPaletteCommands,
    install,
  };
})();
