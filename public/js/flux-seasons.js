/**
 * C9 — Seasons & Streak Cosmetics (flag enable_seasons).
 *
 * Anti-burnout gamification: HEALTHY BEHAVIORS earn seasonal cosmetics —
 * accents, a confetti pack, a theme unlock. Sources (FluxBus, existing
 * events — no new signals invented):
 *   - session_ended        → focus sessions (max 3 count per day)
 *   - shutdown_completed   → shutdown ritual (once per day)
 *   - quiet-hours honor    → yesterday had sessions and NONE inside the
 *                            DND window (once per day, evaluated lazily)
 *   - group_focus          → granted by Study Rooms v2 (C8)
 *
 * Streaks NEVER punish rest: gap days that are rest days (REST_DAYS_KEY,
 * incl. C2 closures via isBreak) or weekends auto-freeze the streak.
 * No grades-based rewards anywhere — grades never touch this module.
 *
 * Pure core computeEarn() is unit-tested via source extraction.
 * Store: flux_seasons_v1 (registered in FluxStorageKeys).
 */
(function () {
  'use strict';
  if (window.FluxSeasons) return;

  const FLAG = 'enable_seasons';
  const KEY = 'flux_seasons_v1';

  const XP = { focus_session: 10, shutdown_ritual: 15, quiet_hours: 10, group_focus: 20 };
  const DAILY_CAP = { focus_session: 3, shutdown_ritual: 1, quiet_hours: 1, group_focus: 2 };

  // Seasonal cosmetics: id, XP threshold, kind, payload. Calm names, no ranks.
  const SEASONS = {
    summer: [
      { id: 'accent_tidepool', at: 25, kind: 'accent', hex: '#22d3ee', label: 'Tidepool accent' },
      { id: 'accent_meadow', at: 60, kind: 'accent', hex: '#4ade80', label: 'Meadow accent' },
      { id: 'confetti_fireflies', at: 100, kind: 'confetti', label: 'Fireflies confetti' },
      { id: 'accent_dusk', at: 150, kind: 'accent', hex: '#c084fc', label: 'Dusk accent' },
    ],
    autumn: [
      { id: 'accent_maple', at: 25, kind: 'accent', hex: '#fb923c', label: 'Maple accent' },
      { id: 'accent_harvest', at: 60, kind: 'accent', hex: '#fbbf24', label: 'Harvest accent' },
      { id: 'confetti_leaves', at: 100, kind: 'confetti', label: 'Falling leaves confetti' },
      { id: 'accent_ember', at: 150, kind: 'accent', hex: '#f43f5e', label: 'Ember accent' },
    ],
    winter: [
      { id: 'accent_frost', at: 25, kind: 'accent', hex: '#38bdf8', label: 'Frost accent' },
      { id: 'accent_evergreen', at: 60, kind: 'accent', hex: '#10d9a0', label: 'Evergreen accent' },
      { id: 'confetti_snow', at: 100, kind: 'confetti', label: 'Snowfall confetti' },
      { id: 'accent_aurora', at: 150, kind: 'accent', hex: '#a78bfa', label: 'Aurora accent' },
    ],
    spring: [
      { id: 'accent_blossom', at: 25, kind: 'accent', hex: '#f472b6', label: 'Blossom accent' },
      { id: 'accent_sprout', at: 60, kind: 'accent', hex: '#22c55e', label: 'Sprout accent' },
      { id: 'confetti_petals', at: 100, kind: 'confetti', label: 'Petals confetti' },
      { id: 'accent_sky', at: 150, kind: 'accent', hex: '#3b82f6', label: 'Clear-sky accent' },
    ],
  };

  function seasonOf(dateStr) {
    const m = parseInt(String(dateStr).slice(5, 7), 10);
    return m >= 3 && m <= 5 ? 'spring' : m >= 6 && m <= 8 ? 'summer' : m >= 9 && m <= 11 ? 'autumn' : 'winter';
  }

  /**
   * Pure earn step. state: {xp, streak, lastDay, earnedToday:{kind:n}, unlocks:[]}
   * isFreeDay(dateStr) → true for rest days/weekends (streak auto-freeze).
   * Returns { state, gained, newUnlocks } — never mutates the input.
   */
  function computeEarn(state, kind, today, isFreeDay) {
    const s = {
      xp: state.xp || 0,
      streak: state.streak || 0,
      lastDay: state.lastDay || '',
      earnedToday: { ...(state.earnedToday || {}) },
      unlocks: [...(state.unlocks || [])],
    };
    if (!XP[kind]) return { state: s, gained: 0, newUnlocks: [] };

    if (s.lastDay !== today) {
      // Streak: walk the gap. Rest days/weekends freeze (never punish rest);
      // any other missed day resets.
      if (s.lastDay) {
        let broken = false;
        const d = new Date(s.lastDay + 'T12:00:00');
        for (;;) {
          d.setDate(d.getDate() + 1);
          const ds = d.toISOString().slice(0, 10);
          if (ds >= today) break;
          if (!isFreeDay(ds)) { broken = true; break; }
        }
        s.streak = broken ? 1 : s.streak + 1;
      } else {
        s.streak = 1;
      }
      s.lastDay = today;
      s.earnedToday = {};
    }

    const used = s.earnedToday[kind] || 0;
    if (used >= (DAILY_CAP[kind] || 1)) return { state: s, gained: 0, newUnlocks: [] };
    s.earnedToday[kind] = used + 1;
    s.xp += XP[kind];

    const newUnlocks = [];
    for (const c of SEASONS[seasonOf(today)]) {
      if (s.xp >= c.at && !s.unlocks.includes(c.id)) {
        s.unlocks.push(c.id);
        newUnlocks.push(c);
      }
    }
    return { state: s, gained: XP[kind], newUnlocks };
  }

  /* ── app wiring ── */

  function enabled() {
    try { return !!window.FluxFeatureFlags?.isEnabled(FLAG, false); } catch (_) { return false; }
  }
  function ls(k, d) { return typeof window.load === 'function' ? window.load(k, d) : d; }
  function lsSave(k, v) { if (typeof window.save === 'function') window.save(k, v); }
  function todayISO() { return typeof todayStr === 'function' ? todayStr() : new Date().toISOString().slice(0, 10); }

  function freeDay(ds) {
    const dow = new Date(ds + 'T12:00:00').getDay();
    if (dow === 0 || dow === 6) return true;
    try { return typeof isBreak === 'function' && isBreak(ds); } catch (_) { return false; }
  }

  function stateNow() {
    const s = ls(KEY, null);
    return s && typeof s === 'object' ? s : { xp: 0, streak: 0, lastDay: '', earnedToday: {}, unlocks: [] };
  }

  function earn(kind) {
    if (!enabled()) return null;
    const today = todayISO();
    maybeQuietHoursBonus(today);
    const r = computeEarn(stateNow(), kind, today, freeDay);
    lsSave(KEY, r.state);
    if (r.newUnlocks.length) {
      const names = r.newUnlocks.map((c) => c.label).join(', ');
      showToast?.(`Unlocked: ${names} — Settings → Appearance. 🎁`, 'success', 7000, { kind: 'achievement' });
      try { window.FluxTelemetry?.track?.('season_cosmetic_unlocked', {}); } catch (_) {}
    }
    return r;
  }

  /** Honoring quiet hours: yesterday had focus sessions, none inside DND. */
  function maybeQuietHoursBonus(today) {
    const s = stateNow();
    if (s._qhChecked === today) return;
    s._qhChecked = today;
    lsSave(KEY, s);
    try {
      const st = ls('flux_settings', {});
      if (!st.quiet || !st.dndStart || !st.dndEnd) return;
      const y = new Date(today + 'T12:00:00');
      y.setDate(y.getDate() - 1);
      const yd = y.toISOString().slice(0, 10);
      const log = ls('flux_session_log', []).filter((x) => x && x.date === yd);
      if (!log.length) return;
      const startH = parseInt(st.dndStart.slice(0, 2), 10);
      const endH = parseInt(st.dndEnd.slice(0, 2), 10);
      const honored = log.every((x) => typeof x.hour !== 'number' || x.hour < startH || x.hour > endH);
      if (honored) {
        const r = computeEarn(stateNow(), 'quiet_hours', today, freeDay);
        lsSave(KEY, { ...r.state, _qhChecked: today });
      }
    } catch (_) {}
  }

  /* ── Settings → Appearance: unlocked cosmetics row ── */

  function cosmeticById(id) {
    for (const list of Object.values(SEASONS)) {
      const hit = list.find((c) => c.id === id);
      if (hit) return hit;
    }
    return null;
  }

  function applyCosmetic(id) {
    const c = cosmeticById(id);
    if (!c || !stateNow().unlocks.includes(id)) return false;
    if (c.kind === 'accent' && c.hex) {
      try {
        document.documentElement.style.setProperty('--accent', c.hex);
        const rgb = [parseInt(c.hex.slice(1, 3), 16), parseInt(c.hex.slice(3, 5), 16), parseInt(c.hex.slice(5, 7), 16)].join(',');
        document.documentElement.style.setProperty('--accent-rgb', rgb);
        if (typeof fluxSaveStoredString === 'function') {
          fluxSaveStoredString('flux_accent', c.hex);
          fluxSaveStoredString('flux_accent_rgb', rgb);
        }
        showToast?.(c.label + ' applied', 'success');
        return true;
      } catch (_) { return false; }
    }
    if (c.kind === 'confetti') {
      lsSave(KEY, { ...stateNow(), confettiPack: id });
      showToast?.(c.label + ' will play on your next win', 'success');
      return true;
    }
    return false;
  }

  function injectSettingsCard() {
    if (!enabled()) { document.getElementById('fluxSeasonsCard')?.remove(); return; }
    const panel = document.getElementById('settings');
    if (!panel || document.getElementById('fluxSeasonsCard')) return;
    const s = stateNow();
    const season = seasonOf(todayISO());
    const host = document.createElement('div');
    host.id = 'fluxSeasonsCard';
    host.className = 'card';
    host.style.cssText = 'margin-top:14px;padding:16px';
    host.innerHTML = `<div style="font-weight:800;margin-bottom:2px">Season cosmetics</div>
      <div style="font-size:.72rem;color:var(--muted2);margin-bottom:10px">Earned by healthy habits — focus sessions, the shutdown ritual, honoring quiet hours. Rest days never break your streak. Never tied to grades.</div>
      <div style="font-size:.78rem;margin-bottom:8px">Streak: <strong>${s.streak || 0} day${s.streak === 1 ? '' : 's'}</strong> · ${s.xp || 0} sparks this ${season}</div>
      <div style="display:flex;flex-wrap:wrap;gap:6px">
        ${SEASONS[season].map((c) => {
          const owned = (s.unlocks || []).includes(c.id);
          return owned
            ? `<button type="button" class="btn-sec" data-season-apply="${c.id}" style="padding:5px 12px;font-size:.74rem">${c.kind === 'accent' ? `<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${c.hex};margin-right:5px"></span>` : '🎊 '}${c.label}</button>`
            : `<span style="padding:5px 12px;font-size:.74rem;border:1px dashed var(--border2);border-radius:10px;color:var(--muted)">🔒 ${c.label} · ${c.at}</span>`;
        }).join('')}
      </div>`;
    panel.appendChild(host);
    host.querySelectorAll('[data-season-apply]').forEach((b) =>
      b.addEventListener('click', () => applyCosmetic(b.dataset.seasonApply)));
  }

  /* ── boot: subscribe to the existing healthy-behavior events ── */

  function boot() {
    try {
      if (typeof FluxBus !== 'undefined' && FluxBus.on) {
        FluxBus.on('session_ended', () => { if (enabled()) earn('focus_session'); });
        FluxBus.on('shutdown_completed', () => { if (enabled()) earn('shutdown_ritual'); });
      }
    } catch (_) {}
    document.addEventListener('flux-nav', (e) => {
      if (e?.detail?.panel === 'settings' && enabled()) setTimeout(injectSettingsCard, 400);
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  window.FluxSeasons = {
    FLAG, enabled, earn, computeEarn, seasonOf, applyCosmetic,
    injectSettingsCard, SEASONS, _key: KEY,
  };
})();
