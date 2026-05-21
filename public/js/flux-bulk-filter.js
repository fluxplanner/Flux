/**
 * P13.3 — Bulk edit by current task filter / smart list.
 * Flag: enable_bulk_filter (default off).
 */
(function () {
  'use strict';

  const FLAG = 'enable_bulk_filter';
  let _wrapped = false;

  function enabled() {
    try {
      return !!window.FluxFeatureFlags?.isEnabled(FLAG, false);
    } catch (_) {
      return false;
    }
  }

  function T(key, vars) {
    if (typeof window.fluxT === 'function') return window.fluxT(key, vars);
    return key;
  }

  function toast(msg, kind) {
    if (typeof window.showToast === 'function') window.showToast(msg, kind || 'info');
  }

  function esc(s) {
    if (typeof window.esc === 'function') return window.esc(s);
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function ctxTasks() {
    return typeof window.tasks !== 'undefined' && Array.isArray(window.tasks) ? window.tasks : [];
  }

  function currentFilter() {
    return typeof window.taskFilter !== 'undefined' ? window.taskFilter : 'active';
  }

  function filterLabel(filter) {
    if (window.FluxSmartLists?.isSmartFilter?.(filter)) {
      const id = window.FluxSmartLists.smartIdFromFilter(filter);
      const p = window.FluxSmartLists.PRESETS?.[id];
      return p ? p.label : T('bulk.filter');
    }
    const labels = {
      active: T('bulk.filter_active'),
      all: T('bulk.filter_all'),
      today: T('bulk.filter_today'),
      overdue: T('bulk.filter_overdue'),
      high: T('bulk.filter_high'),
      done: T('bulk.filter_done'),
    };
    return labels[filter] || filter;
  }

  /** Tasks visible in the current dashboard filter (matches renderTasks). */
  function getVisibleTasks(includeDone) {
    const filter = currentFilter();
    let list = ctxTasks().slice();

    if (window.FluxSmartLists?.isSmartFilter?.(filter)) {
      list = window.FluxSmartLists.applyFilter(list, filter);
      if (!includeDone) list = list.filter((t) => !t.done);
      return list;
    }

    if (filter === 'active') return list.filter((t) => !t.done);
    if (filter === 'done') return list.filter((t) => t.done);
    if (filter === 'overdue') {
      return list.filter(
        (t) => typeof window.isTaskOverdueDay === 'function' && window.isTaskOverdueDay(t)
      );
    }
    if (filter === 'today') {
      const ts = typeof window.todayStr === 'function' ? window.todayStr() : '';
      return list.filter((t) => t.date && t.date === ts);
    }
    if (filter === 'high') return list.filter((t) => !t.done && t.priority === 'high');
    if (filter === 'all') return includeDone ? list : list.filter((t) => !t.done);
    return list.filter((t) => !t.done);
  }

  function bulkIds() {
    return window._fluxBulkIds || null;
  }

  function updateBulkUi() {
    const visible = getVisibleTasks(false);
    const hint = document.getElementById('bulkFilterHint');
    if (hint && enabled()) {
      const label = filterLabel(currentFilter());
      hint.textContent = T('bulk.hint', { label, n: visible.length });
      hint.style.display = visible.length ? '' : 'none';
    } else if (hint) {
      hint.style.display = 'none';
    }
    const btn = document.getElementById('fluxBulkFilterBtn');
    if (btn && enabled()) {
      const n = visible.length;
      btn.disabled = n === 0;
      btn.title = T('bulk.btn_title', { label: filterLabel(currentFilter()), n });
    }
    refreshBulkBar();
  }

  function refreshBulkBar() {
    const bar = document.getElementById('taskBulkBar');
    if (!bar || !enabled()) return;
    bar.querySelectorAll('.flux-bulk-extra').forEach((el) => {
      el.style.display = '';
    });
  }

  function selectFiltered() {
    const visible = getVisibleTasks(false);
    const ids = bulkIds();
    if (!ids) return 0;
    if (visible.length && visible.every((t) => ids.has(t.id))) {
      ids.clear();
    } else {
      ids.clear();
      visible.forEach((t) => ids.add(t.id));
    }
    const el = document.getElementById('bulkCount');
    if (el) el.textContent = ids.size + ' selected';
    if (typeof window.renderTasks === 'function') window.renderTasks();
    return ids.size;
  }

  function enterBulkFiltered() {
    const visible = getVisibleTasks(false);
    if (!visible.length) {
      toast(T('bulk.none'), 'info');
      return false;
    }
    if (typeof window.fluxEnterBulkMode === 'function') window.fluxEnterBulkMode();
    const ids = bulkIds();
    if (ids) {
      ids.clear();
      visible.forEach((t) => ids.add(t.id));
    }
    const el = document.getElementById('bulkCount');
    if (el) el.textContent = (ids ? ids.size : 0) + ' selected';
    updateBulkUi();
    if (typeof window.renderTasks === 'function') window.renderTasks();
    toast(T('bulk.started', { n: visible.length, label: filterLabel(currentFilter()) }), 'info');
    return true;
  }

  window.fluxBulkSelectFiltered = selectFiltered;
  window.fluxBulkEditFilter = enterBulkFiltered;

  function bulkSetPriority() {
    const ids = bulkIds();
    if (!ids || !ids.size) {
      toast(T('bulk.nothing_selected'), 'info');
      return;
    }
    const p = prompt(T('bulk.priority_prompt'), 'high');
    if (!p) return;
    const pri = String(p).toLowerCase();
    if (!['high', 'med', 'low'].includes(pri)) {
      toast(T('bulk.priority_invalid'), 'error');
      return;
    }
    ctxTasks().forEach((t) => {
      if (ids.has(t.id) && !t.done) {
        t.priority = pri;
        if (typeof window.calcUrgency === 'function') t.urgencyScore = window.calcUrgency(t);
      }
    });
    flushTasks(T('bulk.priority_done', { p: pri }));
  }

  function bulkSetEstimate() {
    const ids = bulkIds();
    if (!ids || !ids.size) {
      toast(T('bulk.nothing_selected'), 'info');
      return;
    }
    const raw = prompt(T('bulk.estimate_prompt'), '30');
    if (raw == null || raw === '') return;
    const mins = parseInt(raw, 10);
    if (!Number.isFinite(mins) || mins < 0) {
      toast(T('bulk.estimate_invalid'), 'error');
      return;
    }
    ctxTasks().forEach((t) => {
      if (ids.has(t.id) && !t.done) t.estTime = mins;
    });
    flushTasks(T('bulk.estimate_done', { n: mins }));
  }

  function flushTasks(msg) {
    if (typeof window.save === 'function') window.save('tasks', ctxTasks());
    if (typeof window.syncKey === 'function') window.syncKey('tasks', ctxTasks());
    toast(msg, 'success');
    if (typeof window.renderStats === 'function') window.renderStats();
    if (typeof window.renderTasks === 'function') window.renderTasks();
    if (typeof window.renderCalendar === 'function') window.renderCalendar();
    if (typeof window.renderCountdown === 'function') window.renderCountdown();
    if (typeof window.checkAllPanic === 'function') window.checkAllPanic();
    try {
      if (window.FluxSmartLists?.renderChips) window.FluxSmartLists.renderChips();
    } catch (_) {}
  }

  function injectBulkBarExtras() {
    const bar = document.getElementById('taskBulkBar');
    if (!bar || document.getElementById('bulkFilterHint')) return;

    const hint = document.createElement('div');
    hint.id = 'bulkFilterHint';
    hint.className = 'bulk-filter-hint flux-bulk-extra';
    hint.style.display = 'none';

    const selBtn = bar.querySelector('[onclick="fluxBulkSelectAll()"]');
    if (selBtn) selBtn.textContent = T('bulk.select_filtered');

    const countEl = document.getElementById('bulkCount');
    if (countEl) countEl.insertAdjacentElement('afterend', hint);

    const rescheduleBtn = bar.querySelector('[onclick="fluxBulkReschedule()"]');
    const anchor = rescheduleBtn || bar.lastElementChild;

    const priBtn = document.createElement('button');
    priBtn.type = 'button';
    priBtn.className = 'bulk-btn flux-bulk-extra';
    priBtn.textContent = T('bulk.set_priority');
    priBtn.addEventListener('click', bulkSetPriority);

    const estBtn = document.createElement('button');
    estBtn.type = 'button';
    estBtn.className = 'bulk-btn flux-bulk-extra';
    estBtn.textContent = T('bulk.set_estimate');
    estBtn.addEventListener('click', bulkSetEstimate);

    if (anchor) {
      anchor.insertAdjacentElement('beforebegin', estBtn);
      anchor.insertAdjacentElement('beforebegin', priBtn);
    }
  }

  function injectFilterButton() {
    const row = document.querySelector('.dash-filters-row') || document.getElementById('smartListRow');
    if (!row || document.getElementById('fluxBulkFilterBtn')) return;

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.id = 'fluxBulkFilterBtn';
    btn.className = 'dash-pill-btn flux-bulk-filter-btn';
    btn.textContent = T('bulk.btn');
    btn.addEventListener('click', enterBulkFiltered);
    row.appendChild(btn);
  }

  function getPaletteCommands(q) {
    if (!enabled()) return [];
    const needle = (q || '').toLowerCase().trim();
    const label = T('bulk.palette');
    if (needle && !label.toLowerCase().includes(needle) && !['bulk', 'filter', 'select'].some((k) => k.includes(needle) || needle.includes(k))) {
      if (window.FluxCmdPaletteV2?.matchesQuery && !window.FluxCmdPaletteV2.matchesQuery(needle, label, '', ['bulk', 'filter'])) return [];
    }
    const n = getVisibleTasks(false).length;
    return [
      {
        id: 'bulk:filter',
        icon: '☑',
        label,
        sub: n ? T('bulk.palette_sub', { n }) : T('bulk.none'),
        cat: 'Tasks',
        _keys: ['bulk', 'filter', 'select', 'edit'],
        action: () => {
          if (typeof window.nav === 'function') window.nav('dashboard');
          enterBulkFiltered();
          if (typeof window.closeCommandPalette === 'function') window.closeCommandPalette();
        },
      },
    ];
  }

  function wrapBulkSelectAll() {
    const orig = window.fluxBulkSelectAll;
    if (typeof orig !== 'function' || orig._fluxBulkFilterWrapped) return;
    window.fluxBulkSelectAll = function () {
      if (enabled()) return selectFiltered();
      return orig();
    };
    window.fluxBulkSelectAll._fluxBulkFilterWrapped = true;
  }

  function install() {
    if (!enabled()) {
      document.getElementById('fluxBulkFilterBtn')?.remove();
      document.querySelectorAll('#taskBulkBar .flux-bulk-extra').forEach((el) => el.remove());
      return false;
    }
    injectFilterButton();
    injectBulkBarExtras();
    wrapBulkSelectAll();
    updateBulkUi();

    if (!_wrapped && typeof window.renderTasks === 'function') {
      const orig = window.renderTasks;
      window.renderTasks = function () {
        const r = orig.apply(this, arguments);
        try {
          updateBulkUi();
        } catch (_) {}
        return r;
      };
      _wrapped = true;
    }
    return true;
  }

  window.FluxBulkFilter = {
    FLAG,
    enabled,
    getVisibleTasks,
    filterLabel,
    selectFiltered,
    enterBulkFiltered,
    getPaletteCommands,
    install,
  };
})();
