/**
 * P23.1 — Sport practice planner packs (drills, hydration, recovery).
 * Flag: enable_sport_practice_pack (default off).
 */
(function () {
  'use strict';

  const FLAG = 'enable_sport_practice_pack';
  const STORE_KEY = 'flux_sport_practice_pack_v1';
  const CARD_ID = 'fluxSportPracticeCard';

  const PACKS = [
    {
      id: 'sport_practice_day',
      nameKey: 'sport.pack_practice',
      descKey: 'sport.pack_practice_desc',
      icon: '🏃',
      category: 'sport',
      tasks: [
        { nameKey: 'sport.task_warmup', type: 'other', estTime: 15, difficulty: 2, priority: 'med', dayOffset: 0 },
        { nameKey: 'sport.task_drills', type: 'study', estTime: 45, difficulty: 3, priority: 'high', dayOffset: 0 },
        { nameKey: 'sport.task_hydration', type: 'other', estTime: 5, difficulty: 1, priority: 'med', dayOffset: 0 },
        { nameKey: 'sport.task_cooldown', type: 'other', estTime: 15, difficulty: 2, priority: 'med', dayOffset: 0 },
      ],
    },
    {
      id: 'sport_game_day',
      nameKey: 'sport.pack_game',
      descKey: 'sport.pack_game_desc',
      icon: '🏆',
      category: 'sport',
      tasks: [
        { nameKey: 'sport.task_pregame_meal', type: 'other', estTime: 20, difficulty: 1, priority: 'high', dayOffset: 0 },
        { nameKey: 'sport.task_equipment', type: 'hw', estTime: 10, difficulty: 1, priority: 'high', dayOffset: 0 },
        { nameKey: 'sport.task_match', type: 'other', estTime: 120, difficulty: 4, priority: 'high', dayOffset: 0 },
        { nameKey: 'sport.task_recovery', type: 'other', estTime: 25, difficulty: 2, priority: 'med', dayOffset: 0 },
      ],
    },
    {
      id: 'sport_recovery_week',
      nameKey: 'sport.pack_recovery',
      descKey: 'sport.pack_recovery_desc',
      icon: '🧊',
      category: 'sport',
      tasks: [
        { nameKey: 'sport.task_rest', type: 'other', estTime: 30, difficulty: 1, priority: 'med', dayOffset: 0 },
        { nameKey: 'sport.task_mobility', type: 'other', estTime: 20, difficulty: 2, priority: 'med', dayOffset: 1 },
        { nameKey: 'sport.task_sleep', type: 'other', estTime: 0, difficulty: 1, priority: 'high', dayOffset: 2 },
        { nameKey: 'sport.task_hydration_reset', type: 'other', estTime: 5, difficulty: 1, priority: 'med', dayOffset: 3 },
      ],
    },
  ];

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

  function addDays(iso, n) {
    const d = new Date(iso + 'T00:00:00');
    d.setDate(d.getDate() + n);
    return d.toISOString().slice(0, 10);
  }

  function getPrefs() {
    const s = load(STORE_KEY, {});
    return {
      sportName: typeof s.sportName === 'string' ? s.sportName : '',
      practiceTime: typeof s.practiceTime === 'string' ? s.practiceTime : '16:00',
      practiceWeekdays: Array.isArray(s.practiceWeekdays)
        ? s.practiceWeekdays.filter((d) => d >= 0 && d <= 6)
        : [1, 3, 5],
      linkedExtraId: s.linkedExtraId || '',
      lastPackId: s.lastPackId || '',
    };
  }

  function persistPrefs(patch) {
    const next = { ...getPrefs(), ...patch };
    save(STORE_KEY, next);
    try {
      if (typeof window.syncKey === 'function') window.syncKey('sportPracticePack', getCloudSlice());
    } catch (_) {}
    return next;
  }

  function getCloudSlice() {
    const p = getPrefs();
    return {
      sportName: p.sportName,
      practiceTime: p.practiceTime,
      practiceWeekdays: p.practiceWeekdays,
      linkedExtraId: p.linkedExtraId,
      lastPackId: p.lastPackId,
    };
  }

  function applyFromCloud(data) {
    if (!data || typeof data !== 'object') return;
    persistPrefs(data);
    renderCard();
  }

  function taskList() {
    return typeof window.tasks !== 'undefined' && Array.isArray(window.tasks) ? window.tasks : [];
  }

  function extrasList() {
    return typeof window.extras !== 'undefined' && Array.isArray(window.extras) ? window.extras : [];
  }

  function sportExtras() {
    return extrasList().filter(
      (e) =>
        e &&
        (e.type === 'sport' ||
          (Array.isArray(e.types) && e.types.includes('sport')) ||
          /sport|soccer|basketball|football|tennis|swim|track|volleyball|baseball|hockey|lacrosse/i.test(
            e.name || '',
          )),
    );
  }

  function resolvePack(pack) {
    const prefix = getPrefs().sportName ? getPrefs().sportName + ': ' : '';
    return {
      id: pack.id,
      name: T(pack.nameKey),
      icon: pack.icon,
      category: pack.category,
      descKey: pack.descKey,
      tasks: pack.tasks.map((t) => ({
        name: prefix + T(t.nameKey),
        type: t.type,
        estTime: t.estTime,
        difficulty: t.difficulty,
        priority: t.priority,
        dayOffset: t.dayOffset,
        subject: getPrefs().sportName || '',
      })),
    };
  }

  function getMarketplacePacks() {
    if (!enabled()) return [];
    return PACKS.map((p) => {
      const resolved = resolvePack(p);
      return {
        id: resolved.id,
        name: resolved.name,
        icon: resolved.icon,
        category: resolved.category,
        descKey: p.descKey,
        tasks: resolved.tasks,
      };
    });
  }

  function refreshPlanner() {
    save('tasks', taskList());
    try {
      if (typeof window.syncKey === 'function') window.syncKey('tasks', taskList());
    } catch (_) {}
    ['renderStats', 'renderTasks', 'renderCalendar', 'renderCountdown', 'checkAllPanic'].forEach((fn) => {
      try {
        if (typeof window[fn] === 'function') window[fn]();
      } catch (_) {}
    });
  }

  function applyPack(packId) {
    const pack = PACKS.find((p) => p.id === packId);
    if (!pack) {
      toast(T('sport.pack_missing'), 'warning');
      return 0;
    }

    const resolved = resolvePack(pack);
    const t0 = todayStr();
    const baseId = Date.now();

    resolved.tasks.forEach((spec, i) => {
      const dayOffset = Number.isFinite(parseInt(spec.dayOffset, 10)) ? parseInt(spec.dayOffset, 10) : null;
      const task = {
        id: baseId + i + 1,
        name: spec.name,
        date: dayOffset === null ? '' : addDays(t0, dayOffset),
        subject: spec.subject || '',
        priority: spec.priority || 'med',
        type: spec.type || 'other',
        estTime: parseInt(spec.estTime, 10) || 30,
        difficulty: parseInt(spec.difficulty, 10) || 3,
        notes: '',
        subtasks: [],
        done: false,
        rescheduled: 0,
        createdAt: Date.now(),
        templatePackId: pack.id,
        scope: 'outside',
      };
      if (typeof window.calcUrgency === 'function') task.urgencyScore = window.calcUrgency(task);
      taskList().unshift(task);
    });

    persistPrefs({ lastPackId: pack.id });
    refreshPlanner();
    toast(T('sport.applied', { name: resolved.name, n: resolved.tasks.length }), 'success');
    return resolved.tasks.length;
  }

  function addWeeklyPractice() {
    const prefs = getPrefs();
    const name = prefs.sportName.trim() || T('sport.default_name');
    const weekdays = prefs.practiceWeekdays.length ? prefs.practiceWeekdays : [1, 3, 5];
    const time = prefs.practiceTime || '16:00';

    const rules =
      typeof window.getWeeklyRules === 'function' ? window.getWeeklyRules() : load('flux_weekly_events', []);

    let extraId = prefs.linkedExtraId ? parseInt(prefs.linkedExtraId, 10) : null;
    const ex = extraId && typeof window.getExtraById === 'function' ? window.getExtraById(extraId) : null;
    const title = ex ? ex.name : name + ' ' + T('sport.practice_label');

    rules.push({
      id: String(Date.now()),
      title,
      time,
      weekdays: [...weekdays].sort((a, b) => a - b),
      enabled: true,
      scope: 'outside',
      kind: ex ? 'ec' : undefined,
      extraId: ex ? ex.id : undefined,
      _sportPractice: true,
    });

    save('flux_weekly_events', rules);
    try {
      if (typeof window.syncKey === 'function') window.syncKey('weekly', rules);
    } catch (_) {}
    try {
      if (typeof window.renderWeeklyRulesList === 'function') window.renderWeeklyRulesList();
    } catch (_) {}
    try {
      if (typeof window.renderCalendar === 'function') window.renderCalendar();
    } catch (_) {}

    toast(T('sport.weekly_added', { name: title }), 'success');
  }

  function bindCard(card) {
    card.querySelectorAll('[data-sport-pack]').forEach((btn) => {
      btn.addEventListener('click', () => applyPack(btn.getAttribute('data-sport-pack')));
    });

    card.querySelector('#fluxSportName')?.addEventListener('change', (e) => {
      persistPrefs({ sportName: e.target.value.trim() });
    });

    card.querySelector('#fluxSportExtra')?.addEventListener('change', (e) => {
      const val = e.target.value;
      persistPrefs({ linkedExtraId: val });
      if (val) {
        const ex = typeof window.getExtraById === 'function' ? window.getExtraById(parseInt(val, 10)) : null;
        if (ex?.name) {
          const inp = card.querySelector('#fluxSportName');
          if (inp && !inp.value.trim()) {
            inp.value = ex.name;
            persistPrefs({ sportName: ex.name, linkedExtraId: val });
          }
        }
      }
    });

    card.querySelector('#fluxSportTime')?.addEventListener('change', (e) => {
      persistPrefs({ practiceTime: e.target.value || '16:00' });
    });

    card.querySelectorAll('[name="sportWd"]').forEach((cb) => {
      cb.addEventListener('change', () => {
        const wds = [...card.querySelectorAll('[name="sportWd"]:checked')].map((c) =>
          parseInt(c.value, 10),
        );
        persistPrefs({ practiceWeekdays: wds });
      });
    });

    card.querySelector('#fluxSportWeeklyBtn')?.addEventListener('click', addWeeklyPractice);
  }

  function renderCard() {
    if (!enabled()) return;
    const card = document.getElementById(CARD_ID);
    if (!card) return;

    const prefs = getPrefs();
    const sports = sportExtras();
    const extraOpts = sports.length
      ? sports
          .map(
            (e) =>
              `<option value="${esc(String(e.id))}"${String(prefs.linkedExtraId) === String(e.id) ? ' selected' : ''}>${esc(e.name)}</option>`,
          )
          .join('')
      : '';

    const wdLabels = [
      ['0', 'Su'],
      ['1', 'Mo'],
      ['2', 'Tu'],
      ['3', 'We'],
      ['4', 'Th'],
      ['5', 'Fr'],
      ['6', 'Sa'],
    ];
    const wdHtml = wdLabels
      .map(
        ([val, lbl]) => `<label><input type="checkbox" name="sportWd" value="${val}"${
          prefs.practiceWeekdays.includes(parseInt(val, 10)) ? ' checked' : ''
        } /> ${lbl}</label>`,
      )
      .join('');

    const packsHtml = PACKS.map(
      (p) => `<button type="button" class="flux-sport-pack" data-sport-pack="${esc(p.id)}">
  <div class="flux-sport-pack-icon">${esc(p.icon)}</div>
  <div class="flux-sport-pack-name">${esc(T(p.nameKey))}</div>
  <div class="flux-sport-pack-meta">${esc(T('sport.task_count', { n: p.tasks.length }))}</div>
</button>`,
    ).join('');

    card.innerHTML = `<h3>${esc(T('sport.title'))}</h3>
<p class="flux-sport-lede">${esc(T('sport.lede'))}</p>
<div style="margin-bottom:10px">
  <label style="font-size:.7rem;color:var(--muted)">${esc(T('sport.sport_name'))}</label>
  <input type="text" id="fluxSportName" value="${esc(prefs.sportName)}" placeholder="${esc(T('sport.sport_placeholder'))}" style="margin:4px 0 0;width:100%;box-sizing:border-box" />
</div>
${
  sports.length
    ? `<div style="margin-bottom:10px">
  <label style="font-size:.7rem;color:var(--muted)">${esc(T('sport.link_extra'))}</label>
  <select id="fluxSportExtra" style="margin:4px 0 0;width:100%">
    <option value="">${esc(T('sport.no_extra'))}</option>
    ${extraOpts}
  </select>
</div>`
    : ''
}
<div class="flux-sport-grid">${packsHtml}</div>
<div class="flux-sport-weekly">
  <div style="font-size:.65rem;text-transform:uppercase;letter-spacing:2px;color:var(--muted);font-family:'JetBrains Mono',monospace">${esc(T('sport.weekly_title'))}</div>
  <p class="flux-sport-lede" style="margin:6px 0 0">${esc(T('sport.weekly_lede'))}</p>
  <div class="flux-sport-weekly-row">
    <div><label>${esc(T('sport.time'))}</label><input type="time" id="fluxSportTime" value="${esc(prefs.practiceTime)}" /></div>
    <div><label>${esc(T('sport.days'))}</label><div class="flux-sport-wd">${wdHtml}</div></div>
  </div>
  <button type="button" class="btn-sec" id="fluxSportWeeklyBtn" style="margin-top:10px">${esc(T('sport.add_weekly'))}</button>
</div>`;

    bindCard(card);
  }

  function ensureCard() {
    if (!enabled()) {
      document.getElementById(CARD_ID)?.remove();
      return;
    }
    const anchor = document.getElementById('extrasList')?.closest('.card');
    if (!anchor) return;
    let card = document.getElementById(CARD_ID);
    if (!card) {
      card = document.createElement('div');
      card.id = CARD_ID;
      card.className = 'card flux-sport-card';
      card.setAttribute('role', 'region');
      card.setAttribute('aria-label', T('sport.aria'));
      anchor.insertAdjacentElement('afterend', card);
    }
    renderCard();
  }

  function wrapExtrasRender() {
    const orig = window.renderExtrasList;
    if (typeof orig !== 'function' || orig._fluxSportWrapped) return;
    window.renderExtrasList = function () {
      const r = orig.apply(this, arguments);
      try {
        if (enabled()) ensureCard();
      } catch (_) {}
      return r;
    };
    window.renderExtrasList._fluxSportWrapped = true;
  }

  function getPaletteCommands(q) {
    if (!enabled()) return [];
    const needle = (q || '').toLowerCase();
    const label = T('sport.palette');
    const keys = 'sport practice drills hydration recovery athletic';
    if (
      needle &&
      !label.toLowerCase().includes(needle) &&
      !keys.split(' ').some((k) => needle.includes(k))
    ) {
      return [];
    }
    return [
      {
        icon: '⚽',
        label,
        cat: 'Actions',
        action: () => {
          if (typeof window.closeCommandPalette === 'function') window.closeCommandPalette();
          if (typeof window.nav === 'function') {
            const tab = document.querySelector('[data-tab="goals"]');
            window.nav('goals', tab);
          }
          setTimeout(() => ensureCard(), 200);
        },
      },
    ];
  }

  function install() {
    if (!enabled()) {
      document.getElementById(CARD_ID)?.remove();
      return false;
    }
    wrapExtrasRender();
    ensureCard();
    const origNav = window.nav;
    if (typeof origNav === 'function' && !origNav._fluxSportWrapped) {
      window.nav = function (id) {
        const r = origNav.apply(this, arguments);
        if (id === 'goals') setTimeout(() => ensureCard(), 80);
        return r;
      };
      window.nav._fluxSportWrapped = true;
    }
    return true;
  }

  window.FluxSportPracticePack = {
    FLAG,
    enabled,
    PACKS,
    getMarketplacePacks,
    applyPack,
    addWeeklyPractice,
    getCloudSlice,
    applyFromCloud,
    getPaletteCommands,
    install,
  };
})();
