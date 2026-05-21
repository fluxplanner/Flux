/**
 * P16.2 — Syllabus week auto-scaffold from detected week numbers.
 * Flag: enable_syllabus_week_scaffold (default off).
 */
(function () {
  'use strict';

  const FLAG = 'enable_syllabus_week_scaffold';
  const STORE_KEY = 'flux_syllabus_week_scaffold_v1';
  const CARD_ID = 'fluxSyllabusWeekCard';
  const WEEK_RE = /\b(?:week|wk)\.?\s*#?\s*(\d{1,2})\b|\bW(\d{1,2})\b/gi;

  const SCAFFOLD_SLOTS = [
    { offset: 0, nameKey: 'sws.task_preview', type: 'reading', est: 30, priority: 'med' },
    { offset: 2, nameKey: 'sws.task_hw', type: 'hw', est: 45, priority: 'med' },
    { offset: 4, nameKey: 'sws.task_review', type: 'study', est: 30, priority: 'med' },
    { offset: 6, nameKey: 'sws.task_catchup', type: 'hw', est: 25, priority: 'low' },
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

  function mondayOnOrBefore(d) {
    const copy = new Date(d);
    const day = copy.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    copy.setDate(copy.getDate() + diff);
    return copy.toISOString().slice(0, 10);
  }

  function defaultTermStart() {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();
    const anchor = m >= 7 ? new Date(y, 7, 15) : new Date(y, 0, 8);
    return mondayOnOrBefore(anchor);
  }

  function addDays(iso, n) {
    const d = new Date(iso + 'T00:00:00');
    d.setDate(d.getDate() + n);
    return d.toISOString().slice(0, 10);
  }

  function getPrefs() {
    const s = load(STORE_KEY, {});
    const scaffoldedWeeks = Array.isArray(s.scaffoldedWeeks)
      ? s.scaffoldedWeeks.map((w) => parseInt(w, 10)).filter((w) => w >= 1 && w <= 52)
      : [];
    return {
      termStart: s.termStart || defaultTermStart(),
      defaultSubject: typeof s.defaultSubject === 'string' ? s.defaultSubject : '',
      scaffoldedWeeks,
    };
  }

  function persistPrefs(patch) {
    const next = { ...getPrefs(), ...patch, updatedAt: Date.now() };
    save(STORE_KEY, next);
    try {
      if (typeof window.syncKey === 'function') window.syncKey('syllabusWeekScaffold', next);
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

  function extractWeeksFromText(text, out) {
    if (!text) return;
    WEEK_RE.lastIndex = 0;
    let m;
    while ((m = WEEK_RE.exec(text))) {
      const n = parseInt(m[1] || m[2], 10);
      if (n >= 1 && n <= 52) out.set(n, (out.get(n) || 0) + 1);
    }
  }

  function detectWeeks() {
    const counts = new Map();
    taskList().forEach((t) => {
      if (!t) return;
      extractWeeksFromText(t.name, counts);
      extractWeeksFromText(t.notes, counts);
      if (Number.isFinite(parseInt(t.syllabusWeek, 10))) {
        const w = parseInt(t.syllabusWeek, 10);
        counts.set(w, (counts.get(w) || 0) + 1);
      }
    });
    return [...counts.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([week, count]) => ({ week, count }));
  }

  function weekStartDate(weekNum) {
    const prefs = getPrefs();
    const base = prefs.termStart || defaultTermStart();
    return addDays(base, (weekNum - 1) * 7);
  }

  function isWeekScaffolded(weekNum) {
    const prefs = getPrefs();
    if (prefs.scaffoldedWeeks.includes(weekNum)) return true;
    return taskList().some((t) => t && !t.done && parseInt(t.syllabusWeek, 10) === weekNum);
  }

  function subjectOptions(selected) {
    const subjs = typeof window.getSubjects === 'function' ? window.getSubjects() : {};
    const keys = Object.keys(subjs);
    if (!keys.length) {
      return `<option value="">${esc(T('sws.no_subject'))}</option>`;
    }
    return keys
      .map((k) => {
        const s = subjs[k];
        const label = s?.name || k;
        return `<option value="${esc(k)}"${k === selected ? ' selected' : ''}>${esc(label)}</option>`;
      })
      .join('');
  }

  function pushTask(task) {
    if (typeof window.calcUrgency === 'function') task.urgencyScore = window.calcUrgency(task);
    taskList().unshift(task);
  }

  function refreshPlanner() {
    save('tasks', taskList());
    try {
      if (typeof window.syncKey === 'function') window.syncKey('tasks', taskList());
    } catch (_) {}
    try {
      if (typeof window.renderStats === 'function') window.renderStats();
    } catch (_) {}
    try {
      if (typeof window.renderTasks === 'function') window.renderTasks();
    } catch (_) {}
    try {
      if (typeof window.renderCalendar === 'function') window.renderCalendar();
    } catch (_) {}
    try {
      if (typeof window.renderCountdown === 'function') window.renderCountdown();
    } catch (_) {}
    try {
      if (typeof window.checkAllPanic === 'function') window.checkAllPanic();
    } catch (_) {}
  }

  function scaffoldWeek(weekNum, subjectOverride) {
    const w = parseInt(weekNum, 10);
    if (!Number.isFinite(w) || w < 1 || w > 52) {
      toast(T('sws.invalid_week'), 'warning');
      return 0;
    }
    if (isWeekScaffolded(w)) {
      toast(T('sws.already', { n: w }), 'info');
      return 0;
    }

    const prefs = getPrefs();
    const subject =
      typeof subjectOverride === 'string' && subjectOverride
        ? subjectOverride
        : prefs.defaultSubject || '';
    const weekStart = weekStartDate(w);
    const baseId = Date.now();
    let n = 0;

    SCAFFOLD_SLOTS.forEach((slot, i) => {
      const task = {
        id: baseId + i + 1,
        name: T(slot.nameKey, { n: w }),
        date: addDays(weekStart, slot.offset),
        subject,
        priority: slot.priority,
        type: slot.type,
        estTime: slot.est,
        difficulty: 3,
        notes: T('sws.task_note', { n: w }),
        subtasks: [],
        done: false,
        rescheduled: 0,
        createdAt: Date.now(),
        syllabusWeek: w,
      };
      pushTask(task);
      n += 1;
    });

    const weeks = [...new Set([...prefs.scaffoldedWeeks, w])].sort((a, b) => a - b);
    persistPrefs({ scaffoldedWeeks: weeks });
    refreshPlanner();
    toast(T('sws.toast_ok', { n, w }), 'success');
    renderCard();
    return n;
  }

  function bindCard(card) {
    card.querySelector('#fluxSwsTermStart')?.addEventListener('change', (e) => {
      persistPrefs({ termStart: e.target.value || defaultTermStart() });
      renderCard();
    });
    card.querySelector('#fluxSwsSubject')?.addEventListener('change', (e) => {
      persistPrefs({ defaultSubject: e.target.value || '' });
    });
    card.querySelectorAll('[data-sws-scaffold]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const w = parseInt(btn.getAttribute('data-sws-scaffold'), 10);
        scaffoldWeek(w);
      });
    });
    card.querySelector('#fluxSwsManualBtn')?.addEventListener('click', () => {
      const w = parseInt(document.getElementById('fluxSwsManualWeek')?.value, 10);
      scaffoldWeek(w);
    });
  }

  function renderCard() {
    if (!enabled()) return;
    const card = document.getElementById(CARD_ID);
    if (!card) return;

    const prefs = getPrefs();
    const detected = detectWeeks();
    const weeksHtml = detected.length
      ? detected
          .map(({ week, count }) => {
            const done = isWeekScaffolded(week);
            const range = `${weekStartDate(week)} → ${addDays(weekStartDate(week), 6)}`;
            return `<div class="flux-sws-week-row${done ? ' done' : ''}">
  <div>
    <div class="flux-sws-week-meta">${esc(T('sws.week_row', { n: week, count }))}</div>
    <div class="flux-sws-week-sub">${esc(range)}</div>
  </div>
  ${
    done
      ? `<span style="font-size:.68rem;color:var(--muted)">${esc(T('sws.scaffolded'))}</span>`
      : `<button type="button" class="btn-sec" data-sws-scaffold="${week}">${esc(T('sws.scaffold_btn', { n: week }))}</button>`
  }
</div>`;
          })
          .join('')
      : `<p class="flux-sws-lede">${esc(T('sws.no_weeks'))}</p>`;

    card.innerHTML = `<div class="flux-sws-title">${esc(T('sws.title'))}</div>
<p class="flux-sws-lede">${esc(T('sws.lede'))}</p>
<div class="flux-sws-form-row">
  <label for="fluxSwsTermStart">${esc(T('sws.term_start'))}</label>
  <input type="date" id="fluxSwsTermStart" value="${esc(prefs.termStart)}" />
  <label for="fluxSwsSubject">${esc(T('sws.default_subject'))}</label>
  <select id="fluxSwsSubject">${subjectOptions(prefs.defaultSubject)}</select>
</div>
<p class="flux-sws-lede" style="margin-bottom:4px">${esc(T('sws.term_hint'))}</p>
<div class="flux-sws-weeks">${weeksHtml}</div>
<div class="flux-sws-manual">
  <input type="number" id="fluxSwsManualWeek" min="1" max="52" placeholder="${esc(T('sws.manual_week'))}" />
  <button type="button" class="btn-sec" id="fluxSwsManualBtn">${esc(T('sws.scaffold_manual'))}</button>
</div>`;

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
      card.className = 'flux-sws-card';
      card.setAttribute('role', 'region');
      card.setAttribute('aria-label', T('sws.aria'));
      const rest = document.getElementById('fluxRestDayPlanCard');
      const weather = document.getElementById('fluxAmbientWeatherCard');
      if (rest) rest.insertAdjacentElement('afterend', card);
      else if (weather) weather.insertAdjacentElement('afterend', card);
      else hero.insertAdjacentElement('afterend', card);
    }
    renderCard();
  }

  function getPaletteCommands(q) {
    if (!enabled()) return [];
    const needle = (q || '').toLowerCase();
    const label = T('sws.palette');
    const keys = 'syllabus week scaffold placeholder template';
    if (
      needle &&
      !label.toLowerCase().includes(needle) &&
      !keys.split(' ').some((k) => needle.includes(k))
    ) {
      return [];
    }
    return [
      {
        icon: '📅',
        label,
        cat: 'Actions',
        action: () => {
          if (typeof window.closeCommandPalette === 'function') window.closeCommandPalette();
          if (typeof window.nav === 'function') window.nav('dashboard');
          setTimeout(() => {
            ensureCard();
            document.getElementById(CARD_ID)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          }, 150);
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
    if (typeof origStats === 'function' && !origStats._fluxSwsWrapped) {
      window.renderStats = function () {
        const r = origStats.apply(this, arguments);
        try {
          if (enabled()) ensureCard();
        } catch (_) {}
        return r;
      };
      window.renderStats._fluxSwsWrapped = true;
    }
    return true;
  }

  window.FluxSyllabusWeekScaffold = {
    FLAG,
    enabled,
    detectWeeks,
    weekStartDate,
    scaffoldWeek,
    isWeekScaffolded,
    renderCard,
    ensureCard,
    getCloudSlice,
    applyFromCloud,
    getPaletteCommands,
    install,
  };
})();
