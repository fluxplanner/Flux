/**
 * P15.2 — Adaptive plan on sick / lazy rest days.
 * Flag: enable_rest_day_plan (default off).
 */
(function () {
  'use strict';

  const FLAG = 'enable_rest_day_plan';
  const STORE_KEY = 'flux_rest_day_plan_v1';
  const CARD_ID = 'fluxRestDayPlanCard';
  const HEAVY_TYPES = ['project', 'essay', 'lab'];

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

  function getPrefs() {
    const s = load(STORE_KEY, {});
    return {
      autoDeferOnMark: s.autoDeferOnMark !== false,
      maxLazyTasks: Math.max(1, Math.min(5, parseInt(s.maxLazyTasks, 10) || 2)),
    };
  }

  function persistPrefs(patch) {
    const next = { ...getPrefs(), ...patch, updatedAt: Date.now() };
    save(STORE_KEY, next);
    try {
      if (typeof window.syncKey === 'function') window.syncKey('restDayPlan', next);
    } catch (_) {}
    return next;
  }

  function getCloudSlice() {
    return getPrefs();
  }

  function applyFromCloud(data) {
    if (!data || typeof data !== 'object') return;
    persistPrefs(data);
    renderCard();
  }

  function taskList() {
    return typeof window.tasks !== 'undefined' && Array.isArray(window.tasks) ? window.tasks : [];
  }

  function isRestToday() {
    return typeof window.isBreak === 'function' && window.isBreak(todayStr());
  }

  function restKindToday() {
    return typeof window.restDayKind === 'function' ? window.restDayKind(todayStr()) : null;
  }

  function dueTodayOpen() {
    const d = todayStr();
    return taskList().filter((t) => t && !t.done && t.date === d);
  }

  function isHeavy(t) {
    const diff = parseInt(t.difficulty, 10) || 3;
    return diff >= 4 || HEAVY_TYPES.includes(t.type || '');
  }

  function isLight(t) {
    const diff = parseInt(t.difficulty, 10) || 3;
    const est = parseInt(t.estTime, 10) || 30;
    return diff <= 2 && est <= 45;
  }

  function lightWins(limit) {
    return dueTodayOpen()
      .filter(isLight)
      .sort((a, b) => (a.estTime || 30) - (b.estTime || 30))
      .slice(0, limit);
  }

  function heavyDueToday() {
    return dueTodayOpen().filter(isHeavy);
  }

  function markToday(kind) {
    const k = kind === 'sick' ? 'sick' : 'lazy';
    const d = todayStr();
    if (typeof window.loadRestDaysList !== 'function' || typeof window.saveRestDaysList !== 'function') {
      toast(T('rdp.no_rest_api'), 'error');
      return;
    }
    const days = window.loadRestDaysList().filter((x) => x.date !== d);
    days.push({ date: d, kind: k });
    window.saveRestDaysList(days);
    try {
      if (typeof window.syncKey === 'function') window.syncKey('restDays', days);
    } catch (_) {}
    if (getPrefs().autoDeferOnMark && typeof window.flushTasksOffRestDays === 'function') {
      window.flushTasksOffRestDays();
    }
    toast(k === 'sick' ? T('rdp.marked_sick') : T('rdp.marked_lazy'), 'success');
    try {
      if (typeof window.renderDynamicFocus === 'function') window.renderDynamicFocus();
    } catch (_) {}
    try {
      if (typeof window.checkTimePoverty === 'function') window.checkTimePoverty();
    } catch (_) {}
    renderCard();
  }

  function deferHeavyToday() {
    const d = todayStr();
    if (typeof window.nextNonRestForward !== 'function') return 0;
    let n = 0;
    taskList().forEach((t) => {
      if (!t || t.done || t.date !== d || !isHeavy(t)) return;
      t.date = window.nextNonRestForward(d);
      if (typeof window.calcUrgency === 'function') t.urgencyScore = window.calcUrgency(t);
      n += 1;
    });
    if (n) {
      save('tasks', taskList());
      try {
        if (typeof window.syncKey === 'function') window.syncKey('tasks', taskList());
      } catch (_) {}
      try {
        if (typeof window.renderTasks === 'function') window.renderTasks();
      } catch (_) {}
      try {
        if (typeof window.renderCalendar === 'function') window.renderCalendar();
      } catch (_) {}
      toast(T('rdp.deferred_heavy', { n }), 'success');
    } else {
      toast(T('rdp.no_heavy'), 'info');
    }
    renderCard();
    return n;
  }

  function pushAllDueToday() {
    if (typeof window.flushTasksOffRestDays === 'function') {
      const n = window.flushTasksOffRestDays();
      if (!n) toast(T('rdp.nothing_push'), 'info');
    }
    renderCard();
  }

  function renderRestPlan(kind) {
    const due = dueTodayOpen();
    const heavy = heavyDueToday();
    const lazyMax = getPrefs().maxLazyTasks;
    const lights = lightWins(kind === 'lazy' ? lazyMax : 1);

    const title = kind === 'sick' ? T('rdp.sick_title') : T('rdp.lazy_title');
    const lede = kind === 'sick' ? T('rdp.sick_lede') : T('rdp.lazy_lede');

    let actions = '';
    if (kind === 'sick') {
      actions = `<div class="flux-rdp-actions">
  <button type="button" class="btn-sec" data-rdp-push>${esc(T('rdp.push_all'))}</button>
  <button type="button" class="btn-sec" data-rdp-mood>${esc(T('rdp.mood'))}</button>
</div>`;
    } else {
      actions = `<div class="flux-rdp-actions">
  <button type="button" class="btn-sec" data-rdp-defer-heavy>${esc(T('rdp.defer_heavy'))}</button>
  <button type="button" class="btn-sec" data-rdp-push>${esc(T('rdp.push_all'))}</button>
</div>`;
    }

    const statLine = `<p class="flux-rdp-lede">${esc(T('rdp.stats', { due: due.length, heavy: heavy.length }))}</p>`;

    const listLabel = kind === 'sick' ? T('rdp.optional_micro') : T('rdp.lazy_picks');
    const listHtml = lights.length
      ? `<p style="font-size:.72rem;color:var(--muted);margin:8px 0 4px">${esc(listLabel)}</p><ul class="flux-rdp-list">${lights
          .map((t) => `<li>${esc(t.name || T('task.untitled'))} · ${t.estTime || 30}m</li>`)
          .join('')}</ul>`
      : `<p class="flux-rdp-lede" style="margin-top:8px">${esc(T('rdp.no_light'))}</p>`;

    return { title, lede, body: statLine + actions + listHtml, sick: kind === 'sick' };
  }

  function renderMarkToday() {
    return `<p class="flux-rdp-lede">${esc(T('rdp.mark_lede'))}</p>
<div class="flux-rdp-mark">
  <button type="button" class="btn-sec" data-rdp-mark="sick">${esc(T('rdp.mark_sick'))}</button>
  <button type="button" class="btn-sec" data-rdp-mark="lazy">${esc(T('rdp.mark_lazy'))}</button>
</div>`;
  }

  function bindCard(card) {
    card.querySelector('[data-rdp-mark="sick"]')?.addEventListener('click', () => markToday('sick'));
    card.querySelector('[data-rdp-mark="lazy"]')?.addEventListener('click', () => markToday('lazy'));
    card.querySelector('[data-rdp-push]')?.addEventListener('click', pushAllDueToday);
    card.querySelector('[data-rdp-defer-heavy]')?.addEventListener('click', deferHeavyToday);
    card.querySelector('[data-rdp-mood]')?.addEventListener('click', () => {
      if (typeof window.nav === 'function') window.nav('mood');
    });
  }

  function renderCard() {
    if (!enabled()) return;
    const card = document.getElementById(CARD_ID);
    if (!card) return;

    if (isRestToday()) {
      const kind = restKindToday() || 'lazy';
      const plan = renderRestPlan(kind);
      card.className = kind === 'sick' ? 'flux-rdp-card rest-sick' : 'flux-rdp-card';
      card.id = CARD_ID;
      card.innerHTML = `<div class="flux-rdp-title">${esc(plan.title)}</div>
<p class="flux-rdp-lede">${esc(plan.lede)}</p>
${plan.body}`;
      card.style.display = '';
    } else {
      card.className = 'flux-rdp-card';
      card.id = CARD_ID;
      card.innerHTML = `<div class="flux-rdp-title">${esc(T('rdp.off_title'))}</div>${renderMarkToday()}`;
      card.style.display = '';
    }
    bindCard(card);
  }

  function ensureCard() {
    if (!enabled()) {
      document.getElementById(CARD_ID)?.remove();
      return;
    }
    const dash = document.getElementById('dashboard');
    const hero = document.getElementById('dashHero');
    if (!dash || !hero) return;
    let card = document.getElementById(CARD_ID);
    if (!card) {
      card = document.createElement('div');
      card.id = CARD_ID;
      card.setAttribute('role', 'region');
      card.setAttribute('aria-label', T('rdp.aria'));
      const weather = document.getElementById('fluxAmbientWeatherCard');
      if (weather) weather.insertAdjacentElement('afterend', card);
      else hero.insertAdjacentElement('afterend', card);
    }
    renderCard();
  }

  function getPaletteCommands(q) {
    if (!enabled()) return [];
    const needle = (q || '').toLowerCase();
    const label = T('rdp.palette');
    const keys = 'sick lazy rest day recovery';
    if (
      needle &&
      !label.toLowerCase().includes(needle) &&
      !keys.split(' ').some((k) => needle.includes(k))
    ) {
      return [];
    }
    return [
      {
        icon: '🛋',
        label,
        cat: 'Actions',
        action: () => {
          if (typeof window.closeCommandPalette === 'function') window.closeCommandPalette();
          if (typeof window.nav === 'function') window.nav('dashboard');
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
    ensureCard();
    const origStats = window.renderStats;
    if (typeof origStats === 'function' && !origStats._fluxRdpWrapped) {
      window.renderStats = function () {
        const r = origStats.apply(this, arguments);
        try {
          if (enabled()) ensureCard();
        } catch (_) {}
        return r;
      };
      window.renderStats._fluxRdpWrapped = true;
    }
    return true;
  }

  window.FluxRestDayPlan = {
    FLAG,
    enabled,
    markToday,
    deferHeavyToday,
    pushAllDueToday,
    renderCard,
    ensureCard,
    getCloudSlice,
    applyFromCloud,
    getPaletteCommands,
    install,
  };
})();
