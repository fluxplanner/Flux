/**
 * P14.1 — Mood + energy quick-log tied to completion velocity + privacy toggle.
 * Flag: enable_mood_velocity (default off).
 */
(function () {
  'use strict';

  const FLAG = 'enable_mood_velocity';
  const STORE_KEY = 'flux_mood_velocity_v1';
  const CARD_ID = 'fluxMoodVelocityCard';
  const DAYS = 14;
  const MOOD_EMOJI = ['', '😞', '😕', '😐', '🙂', '😄'];
  const ENERGY_EMOJI = ['', '😴', '😕', '😐', '😊', '🚀'];
  let _draft = { mood: 0, energy: 0 };

  function enabled() {
    try {
      return !!window.FluxFeatureFlags?.isEnabled(FLAG, false);
    } catch (_) {
      return false;
    }
  }

  function load(k, def) {
    if (typeof window.load === 'function') return window.load(k, def);
    try {
      const raw = localStorage.getItem(k);
      return raw ? JSON.parse(raw) : def;
    } catch (_) {
      return def;
    }
  }

  function save(k, v) {
    if (typeof window.save === 'function') window.save(k, v);
    else {
      try {
        localStorage.setItem(k, JSON.stringify(v));
      } catch (_) {}
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

  function toast(msg, kind) {
    if (typeof window.showToast === 'function') window.showToast(msg, kind || 'info');
  }

  function todayStr() {
    return typeof window.todayStr === 'function' ? window.todayStr() : new Date().toISOString().slice(0, 10);
  }

  function getStore() {
    const s = load(STORE_KEY, {});
    return s && typeof s === 'object'
      ? { privateMode: s.privateMode !== false, quickLogs: Array.isArray(s.quickLogs) ? s.quickLogs : [] }
      : { privateMode: true, quickLogs: [] };
  }

  function persistStore(data) {
    save(STORE_KEY, data);
    try {
      if (typeof window.syncKey === 'function') window.syncKey('moodVelocity', getCloudSlice());
    } catch (_) {}
  }

  function getCloudSlice() {
    const s = getStore();
    if (s.privateMode) return { privateMode: true };
    return { privateMode: false, quickLogs: s.quickLogs.slice(-60) };
  }

  function applyFromCloud(data) {
    if (!data || typeof data !== 'object') return;
    const local = getStore();
    const next = {
      privateMode: data.privateMode !== false,
      quickLogs: data.privateMode === false && Array.isArray(data.quickLogs) ? data.quickLogs : local.quickLogs,
    };
    save(STORE_KEY, next);
    renderCard();
  }

  function blocksCounselorShare() {
    return enabled() && getStore().privateMode;
  }

  function isoDaysAgo(n) {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  function tasksForDay(iso) {
    const list = typeof tasks !== 'undefined' && Array.isArray(tasks) ? tasks : [];
    return list.filter((t) => {
      if (!t || !t.done) return false;
      const ca = t.completedAt ? String(t.completedAt).slice(0, 10) : t.date;
      return ca === iso;
    }).length;
  }

  function moodForDay(iso) {
    const mh = typeof moodHistory !== 'undefined' && Array.isArray(moodHistory) ? moodHistory : [];
    const hit = mh.find((m) => m && m.date === iso);
    if (!hit) return null;
    const mood = Math.max(1, Math.min(5, parseInt(hit.mood, 10) || 0));
    const energy = hit.energy != null ? Math.max(1, Math.min(5, parseInt(hit.energy, 10) || 0)) : null;
    return { mood, energy };
  }

  function moodColor(n) {
    const map = ['', '#f87171', '#fb923c', '#94a3b8', '#4ade80', '#34d399'];
    return map[n] || 'var(--muted)';
  }

  function buildSeries() {
    const rows = [];
    for (let i = DAYS - 1; i >= 0; i -= 1) {
      const iso = isoDaysAgo(i);
      const done = tasksForDay(iso);
      const mood = moodForDay(iso);
      rows.push({ iso, done, mood });
    }
    const maxDone = Math.max(1, ...rows.map((r) => r.done));
    return rows.map((r) => ({ ...r, pct: Math.round((r.done / maxDone) * 100) }));
  }

  function computeInsight(series) {
    const withBoth = series.filter((r) => r.done > 0 && r.mood && r.mood.mood);
    if (withBoth.length < 3) return T('mv.insight_need_data');
    const hi = withBoth.filter((r) => r.mood.mood >= 4);
    const lo = withBoth.filter((r) => r.mood.mood <= 2);
    const avg = (arr) =>
      arr.length ? arr.reduce((s, r) => s + r.done, 0) / arr.length : 0;
    const hiAvg = avg(hi);
    const loAvg = avg(lo);
    if (hi.length >= 2 && lo.length >= 2 && hiAvg > loAvg + 0.4) {
      return T('mv.insight_positive');
    }
    if (lo.length >= 2 && hi.length >= 2 && loAvg > hiAvg + 0.4) {
      return T('mv.insight_rest');
    }
    return T('mv.insight_neutral');
  }

  function formatDayLabel(iso) {
    const d = new Date(`${iso}T12:00:00`);
    return d.toLocaleDateString(undefined, { weekday: 'narrow', day: 'numeric' });
  }

  function renderChartHtml(series) {
    const cols = series
      .map((r) => {
        const h = Math.max(4, Math.round((r.pct / 100) * 56));
        const mood = r.mood && r.mood.mood ? r.mood.mood : 0;
        const energy = r.mood && r.mood.energy ? r.mood.energy : 0;
        const dot = mood
          ? `<span class="flux-mv-mood-dot" style="background:${moodColor(mood)}" title="${MOOD_EMOJI[mood]}"></span>`
          : '<span class="flux-mv-mood-dot" style="opacity:0.25;background:var(--border2)"></span>';
        return `<div class="flux-mv-col" title="${esc(r.iso)} · ${r.done} ${T('mv.tasks')}">
  ${dot}
  <div class="flux-mv-bar-wrap">
    <div class="flux-mv-bar ${r.done ? 'has-done' : ''}" style="height:${h}px" ${energy ? `data-energy="${energy}"` : ''}>
      <span class="flux-mv-energy-ring"></span>
    </div>
  </div>
  <span class="flux-mv-day">${esc(formatDayLabel(r.iso))}</span>
</div>`;
      })
      .join('');
    return `<div class="flux-mv-chart" role="img" aria-label="${esc(T('mv.chart_aria'))}">${cols}</div>`;
  }

  function renderQuickLogHtml() {
    const moodBtns = [1, 2, 3, 4, 5]
      .map(
        (n) =>
          `<button type="button" class="flux-mv-chip${_draft.mood === n ? ' is-active' : ''}" data-mv-mood="${n}" aria-label="${esc(MOOD_EMOJI[n])}">${MOOD_EMOJI[n]}</button>`,
      )
      .join('');
    const energyBtns = [1, 2, 3, 4, 5]
      .map(
        (n) =>
          `<button type="button" class="flux-mv-chip${_draft.energy === n ? ' is-active' : ''}" data-mv-energy="${n}" aria-label="${esc(ENERGY_EMOJI[n])}">${ENERGY_EMOJI[n]}</button>`,
      )
      .join('');
    const priv = getStore().privateMode;
    return `<div class="flux-mv-quick">
  <p style="font-size:.78rem;color:var(--muted2);margin:0 0 8px;line-height:1.45">${esc(T('mv.lede'))}</p>
  <div class="flux-mv-row"><span class="flux-mv-row-label">${esc(T('mv.mood'))}</span>${moodBtns}</div>
  <div class="flux-mv-row"><span class="flux-mv-row-label">${esc(T('mv.energy'))}</span>${energyBtns}</div>
  <button type="button" class="flux-mv-save" id="fluxMvSaveBtn">${esc(T('mv.save'))}</button>
  <label class="flux-mv-privacy">
    <input type="checkbox" id="fluxMvPrivate" ${priv ? 'checked' : ''} />
    <span>${esc(T('mv.privacy'))}</span>
  </label>
</div>`;
  }

  function renderCard() {
    if (!enabled()) return;
    const card = document.getElementById(CARD_ID);
    if (!card) return;
    const series = buildSeries();
    const totalDone = series.reduce((s, r) => s + r.done, 0);
    card.innerHTML = `<h3>${esc(T('mv.title'))}</h3>
${renderQuickLogHtml()}
${renderChartHtml(series)}
<div class="flux-mv-legend">
  <span><i class="flux-mv-bar has-done" style="display:inline-block;width:10px;height:10px;border-radius:2px"></i> ${esc(T('mv.legend_done'))}</span>
  <span><span class="flux-mv-mood-dot" style="background:var(--green);display:inline-block"></span> ${esc(T('mv.legend_mood'))}</span>
</div>
<p class="flux-mv-insight">${esc(computeInsight(series))}</p>
<p style="font-size:.68rem;color:var(--muted);margin:8px 0 0">${esc(T('mv.total', { n: totalDone }))}</p>`;
    bindCard(card);
  }

  function bindCard(card) {
    card.querySelectorAll('[data-mv-mood]').forEach((btn) => {
      btn.addEventListener('click', () => {
        _draft.mood = parseInt(btn.getAttribute('data-mv-mood'), 10) || 0;
        renderCard();
      });
    });
    card.querySelectorAll('[data-mv-energy]').forEach((btn) => {
      btn.addEventListener('click', () => {
        _draft.energy = parseInt(btn.getAttribute('data-mv-energy'), 10) || 0;
        renderCard();
      });
    });
    card.querySelector('#fluxMvSaveBtn')?.addEventListener('click', () => saveQuickLog());
    card.querySelector('#fluxMvPrivate')?.addEventListener('change', (e) => {
      const store = getStore();
      store.privateMode = !!e.target.checked;
      persistStore(store);
      toast(store.privateMode ? T('mv.private_on') : T('mv.private_off'), 'info');
    });
  }

  function upsertMoodHistory(mood, energy) {
    if (typeof moodHistory === 'undefined') return;
    const entry = {
      date: todayStr(),
      mood,
      energy,
      stress: parseInt(document.getElementById('stressSlider')?.value || '3', 10) || 3,
      sleep: parseFloat(document.getElementById('sleepHours')?.value || '7') || 7,
      quickLog: true,
    };
    const idx = moodHistory.findIndex((m) => m && m.date === entry.date);
    if (idx >= 0) moodHistory[idx] = { ...moodHistory[idx], ...entry };
    else moodHistory.push(entry);
    save('flux_mood', moodHistory);
    try {
      if (typeof window.syncKey === 'function') window.syncKey('moodHistory', moodHistory);
    } catch (_) {}
    save('flux_mood_today', mood);
    if (typeof window.setEnergy === 'function') window.setEnergy(energy);
    try {
      if (window.FluxMomentumV2?.onMoodSaved) FluxMomentumV2.onMoodSaved();
    } catch (_) {}
    try {
      if (window.FluxCognitiveV2?.tick) FluxCognitiveV2.tick();
    } catch (_) {}
    if (typeof window.renderMoodHistory === 'function') window.renderMoodHistory();
  }

  function saveQuickLog() {
    if (!_draft.mood || !_draft.energy) {
      toast(T('mv.pick_both'), 'warning');
      return;
    }
    upsertMoodHistory(_draft.mood, _draft.energy);
    const store = getStore();
    store.quickLogs = [
      ...(store.quickLogs || []).filter((x) => x && x.date !== todayStr()),
      { date: todayStr(), mood: _draft.mood, energy: _draft.energy, at: Date.now() },
    ].slice(-90);
    persistStore(store);
    toast(T('mv.saved'), 'success');
    _draft = { mood: 0, energy: 0 };
    renderCard();
    if (!blocksCounselorShare()) {
      try {
        const sb = typeof getSB === 'function' ? getSB() : null;
        if (sb && typeof currentUser !== 'undefined' && currentUser && window.FluxCounselorWellnessTimeline?.maybeCaptureSnapshot) {
          void FluxCounselorWellnessTimeline.maybeCaptureSnapshot(sb, currentUser.id);
        }
      } catch (_) {}
    }
  }

  function ensureCard() {
    if (!enabled()) return;
    const moodPanel = document.getElementById('mood');
    if (!moodPanel) return;
    let card = document.getElementById(CARD_ID);
    if (!card) {
      card = document.createElement('div');
      card.id = CARD_ID;
      card.className = 'card';
      const stack = moodPanel.querySelector('.flux-stack');
      const historyCard = moodPanel.querySelector('#moodHistory')?.closest('.card');
      if (stack && historyCard) stack.insertBefore(card, historyCard);
      else if (stack) stack.prepend(card);
    }
    renderCard();
  }

  function install() {
    if (!enabled()) return;
    ensureCard();
    if (window.__fluxMvHooked) return;
    window.__fluxMvHooked = true;
    const origNav = typeof window.nav === 'function' ? window.nav : null;
    if (origNav && !origNav.__mvWrapped) {
      function wrappedNav(tab, el) {
        const r = origNav.apply(this, arguments);
        if (tab === 'mood') requestAnimationFrame(() => ensureCard());
        return r;
      }
      wrappedNav.__mvWrapped = true;
      window.nav = wrappedNav;
    }
  }

  function onTaskCompleted() {
    if (!enabled()) return;
    const card = document.getElementById(CARD_ID);
    if (card && card.isConnected) renderCard();
  }

  function getPaletteCommands(q) {
    if (!enabled()) return [];
    const label = T('mv.palette');
    const keys = 'mood velocity check-in quick log energy';
    if (q && !keys.includes(String(q).toLowerCase()) && !label.toLowerCase().includes(String(q).toLowerCase())) {
      return [];
    }
    return [
      {
        label,
        sub: T('mv.palette_sub'),
        _keys: keys,
        run() {
          if (typeof window.nav === 'function') window.nav('mood');
          requestAnimationFrame(() => ensureCard());
        },
      },
    ];
  }

  window.FluxMoodVelocity = {
    enabled,
    install,
    renderCard,
    ensureCard,
    onTaskCompleted,
    blocksCounselorShare,
    getCloudSlice,
    applyFromCloud,
    getPaletteCommands,
  };
})();
