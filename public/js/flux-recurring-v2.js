/**
 * P12.5 — Recurring tasks with exceptions (skip once, shift series, end-after-N).
 * Flag: enable_recurring_exceptions (default off).
 * Series rules sync via user_data.recurringSeries in cloud payload.
 */
(function () {
  'use strict';

  const FLAG = 'enable_recurring_exceptions';
  const SERIES_KEY = 'flux_recurring_series_v1';

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

  function taskList() {
    return typeof window.tasks !== 'undefined' && Array.isArray(window.tasks) ? window.tasks : [];
  }

  function getSeriesMap() {
    const m = load(SERIES_KEY, {});
    return m && typeof m === 'object' ? m : {};
  }

  function saveSeriesMap(m) {
    save(SERIES_KEY, m || {});
    try {
      if (typeof window.syncKey === 'function') window.syncKey('recurringSeries', m);
    } catch (_) {}
  }

  function applyFromCloud(map) {
    if (!map || typeof map !== 'object') return;
    save(SERIES_KEY, map);
  }

  function getCloudSlice() {
    return getSeriesMap();
  }

  function recTypeOf(task) {
    if (!task) return null;
    return task.recurringType || (task.recurringWeekly ? 'weekly' : null);
  }

  function newSeriesId() {
    return 'rs_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7);
  }

  function ensureSeries(task) {
    if (!enabled() || !task) return null;
    const type = recTypeOf(task);
    if (!type) return null;
    const map = getSeriesMap();
    if (task.seriesId && map[task.seriesId]) return map[task.seriesId];

    const id = task.seriesId || newSeriesId();
    task.seriesId = id;
    map[id] = {
      type,
      endAfter: task.seriesEndAfter != null ? Number(task.seriesEndAfter) : null,
      shiftDays: 0,
      completedCount: 0,
      createdAt: Date.now(),
    };
    saveSeriesMap(map);
    return map[id];
  }

  function bindTask(task) {
    if (!enabled() || !task) return;
    const type = recTypeOf(task);
    if (!type) {
      if (task.seriesId) delete task.seriesId;
      return;
    }
    ensureSeries(task);
  }

  function nextDate(fromIso, recType, shiftDays) {
    const nd = new Date(String(fromIso).slice(0, 10) + 'T12:00:00');
    if (recType === 'weekly') nd.setDate(nd.getDate() + 7);
    else if (recType === 'biweekly') nd.setDate(nd.getDate() + 14);
    else if (recType === 'monthly') nd.setMonth(nd.getMonth() + 1);
    else nd.setDate(nd.getDate() + 7);
    const extra = Number(shiftDays) || 0;
    if (extra) nd.setDate(nd.getDate() + extra);
    return nd.toISOString().slice(0, 10);
  }

  function spawnInstance(task, date, recType, seriesId) {
    const nt = {
      id: Date.now() + Math.random(),
      name: task.name,
      date,
      subject: task.subject || '',
      priority: task.priority || 'med',
      type: task.type || 'hw',
      estTime: task.estTime || 0,
      difficulty: task.difficulty || 3,
      notes: task.notes || '',
      subtasks: (task.subtasks || []).map((s) => ({ text: s.text, done: false })),
      done: false,
      rescheduled: 0,
      createdAt: Date.now(),
      recurringType: recType,
      recurringWeekly: recType === 'weekly',
      waitingOn: task.waitingOn,
      srsEnabled: false,
      seriesId: seriesId || task.seriesId,
    };
    if (typeof window.calcUrgency === 'function') nt.urgencyScore = window.calcUrgency(nt);
    return nt;
  }

  function labelFor(recType) {
    return (
      { weekly: T('recur.weekly'), biweekly: T('recur.biweekly'), monthly: T('recur.monthly') }[recType] ||
      T('recur.repeat')
    );
  }

  function onComplete(task) {
    if (!enabled() || !task) return { spawn: false };
    if (window._fluxRecurringSkipSpawn === task.id) {
      window._fluxRecurringSkipSpawn = null;
      return { spawn: false, skipped: true, message: T('recur.skipped_toast') };
    }

    const recType = recTypeOf(task);
    if (!recType || !task.date) return { spawn: false };

    const map = getSeriesMap();
    const series = ensureSeries(task);
    if (!series) return { spawn: false };

    series.completedCount = (series.completedCount || 0) + 1;
    series.type = recType;

    if (series.endAfter != null && series.completedCount >= series.endAfter) {
      saveSeriesMap(map);
      return { spawn: false, ended: true, message: T('recur.ended_toast', { n: series.endAfter }) };
    }

    let nd = nextDate(task.date, recType, series.shiftDays || 0);
    let guard = 0;
    while ((series.skipDates || []).includes(nd) && guard < 26) {
      nd = nextDate(nd, recType, 0);
      guard += 1;
    }

    const nt = spawnInstance(task, nd, recType, task.seriesId);
    saveSeriesMap(map);
    return {
      spawn: true,
      task: nt,
      message: T('recur.spawned_toast', { label: labelFor(recType), date: nd }),
    };
  }

  function completeWithoutRepeat(taskId) {
    window._fluxRecurringSkipSpawn = taskId;
    if (typeof window.toggleTask === 'function') window.toggleTask(taskId);
  }

  function shiftSeries(taskId, days) {
    const t = taskList().find((x) => String(x.id) === String(taskId));
    if (!t || !t.seriesId) {
      if (typeof window.showToast === 'function') window.showToast(T('recur.no_series'), 'warning');
      return;
    }
    const delta = Number(days);
    if (!Number.isFinite(delta) || delta === 0) return;
    const map = getSeriesMap();
    const series = map[t.seriesId];
    if (!series) return;
    series.shiftDays = (series.shiftDays || 0) + delta;
    saveSeriesMap(map);

    taskList().forEach((task) => {
      if (!task || task.done || task.seriesId !== t.seriesId || !task.date) return;
      const d = new Date(String(task.date).slice(0, 10) + 'T12:00:00');
      d.setDate(d.getDate() + delta);
      task.date = d.toISOString().slice(0, 10);
      if (typeof window.calcUrgency === 'function') task.urgencyScore = window.calcUrgency(task);
    });
    save('tasks', taskList());
    if (typeof window.syncKey === 'function') window.syncKey('tasks', taskList());
    if (typeof window.renderTasks === 'function') window.renderTasks();
    if (typeof window.renderCalendar === 'function') window.renderCalendar();
    if (typeof window.showToast === 'function')
      window.showToast(T('recur.shift_toast', { n: delta > 0 ? '+' + delta : String(delta) }), 'info');
  }

  function setEndAfter(taskId, n) {
    const t = taskList().find((x) => String(x.id) === String(taskId));
    if (!t) return;
    ensureSeries(t);
    const map = getSeriesMap();
    const series = map[t.seriesId];
    if (!series) return;
    const num = n == null || n === '' ? null : Math.max(1, parseInt(String(n), 10));
    series.endAfter = Number.isFinite(num) ? num : null;
    t.seriesEndAfter = series.endAfter;
    saveSeriesMap(map);
    save('tasks', taskList());
    if (typeof window.syncKey === 'function') window.syncKey('tasks', taskList());
    if (typeof window.showToast === 'function')
      window.showToast(
        series.endAfter ? T('recur.end_after_toast', { n: series.endAfter }) : T('recur.end_cleared'),
        'info'
      );
  }

  function skipNextOccurrence(taskId) {
    const t = taskList().find((x) => String(x.id) === String(taskId));
    if (!t || !t.date) return;
    ensureSeries(t);
    const map = getSeriesMap();
    const series = map[t.seriesId];
    if (!series) return;
    const recType = recTypeOf(t);
    const skipDate = nextDate(t.date, recType, series.shiftDays || 0);
    if (!series.skipDates) series.skipDates = [];
    if (!series.skipDates.includes(skipDate)) series.skipDates.push(skipDate);
    saveSeriesMap(map);
    if (typeof window.showToast === 'function')
      window.showToast(T('recur.skip_next_toast', { date: skipDate }), 'info');
  }

  function closeMenu() {
    document.getElementById('fluxRecurringMenu')?.remove();
  }

  function openMenu(taskId, ev) {
    if (!enabled()) return;
    ev?.stopPropagation?.();
    closeMenu();
    const t = taskList().find((x) => String(x.id) === String(taskId));
    if (!t || !recTypeOf(t)) return;
    ensureSeries(t);
    const series = getSeriesMap()[t.seriesId] || {};
    const endLabel = series.endAfter ? T('recur.menu_end', { n: series.endAfter }) : T('recur.menu_set_end');

    const host = document.createElement('div');
    host.id = 'fluxRecurringMenu';
    host.className = 'flux-recur-menu';
    host.innerHTML = `<div class="flux-recur-menu-inner" role="menu">
      <div class="flux-recur-menu-title">${esc(T('recur.menu_title'))}</div>
      <button type="button" class="flux-recur-menu-item" data-act="skip">${esc(T('recur.menu_skip'))}</button>
      <button type="button" class="flux-recur-menu-item" data-act="skipnext">${esc(T('recur.menu_skip_next'))}</button>
      <button type="button" class="flux-recur-menu-item" data-act="shift7">${esc(T('recur.menu_shift'))}</button>
      <button type="button" class="flux-recur-menu-item" data-act="end">${esc(endLabel)}</button>
    </div>`;

    host.querySelector('[data-act="skip"]')?.addEventListener('click', () => {
      closeMenu();
      completeWithoutRepeat(taskId);
    });
    host.querySelector('[data-act="skipnext"]')?.addEventListener('click', () => {
      closeMenu();
      skipNextOccurrence(taskId);
    });
    host.querySelector('[data-act="shift7"]')?.addEventListener('click', () => {
      closeMenu();
      shiftSeries(taskId, 7);
    });
    host.querySelector('[data-act="end"]')?.addEventListener('click', () => {
      closeMenu();
      const raw = prompt(T('recur.prompt_end'), series.endAfter != null ? String(series.endAfter) : '10');
      if (raw === null) return;
      setEndAfter(taskId, raw.trim() === '' ? null : raw);
    });

    host.addEventListener('click', (e) => {
      if (e.target === host) closeMenu();
    });
    document.body.appendChild(host);
    if (ev?.clientX != null) {
      const inner = host.querySelector('.flux-recur-menu-inner');
      if (inner) {
        inner.style.position = 'fixed';
        inner.style.left = Math.min(ev.clientX, window.innerWidth - 240) + 'px';
        inner.style.top = Math.min(ev.clientY, window.innerHeight - 200) + 'px';
      }
    }
  }

  function chipHtml(task) {
    if (!recTypeOf(task)) return '';
    if (!enabled()) {
      return task.recurringWeekly
        ? `<span class="task-chip task-chip-recurring" title="${esc(T('recur.legacy_weekly'))}">🔁 ${esc(T('recur.weekly'))}</span>`
        : '';
    }
    ensureSeries(task);
    const series = task.seriesId ? getSeriesMap()[task.seriesId] : null;
    const endHint = series?.endAfter ? ` · ${T('recur.end_chip', { n: series.endAfter })}` : '';
    return `<span class="task-chip task-chip-recurring" title="${esc(T('recur.chip_title'))}">🔁 ${esc(labelFor(recTypeOf(task)))}${esc(endHint)}</span>`;
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeMenu();
  });

  window.FluxRecurring = {
    FLAG,
    enabled,
    bindTask,
    onComplete,
    completeWithoutRepeat,
    shiftSeries,
    setEndAfter,
    skipNextOccurrence,
    openMenu,
    chipHtml,
    getCloudSlice,
    applyFromCloud,
  };
})();
