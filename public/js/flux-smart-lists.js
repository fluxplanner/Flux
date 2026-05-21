/**
 * P13.2 — Smart task lists (preset filters + pin favorites).
 * Flag: enable_smart_lists (default off).
 */
(function () {
  'use strict';

  const FLAG = 'enable_smart_lists';
  const STORE_KEY = 'flux_smart_lists_v1';

  const PRESETS = {
    overdue_stem: {
      label: 'Overdue STEM',
      icon: '🧬',
      keys: ['stem', 'science', 'overdue', 'late'],
      match(t) {
        if (t.done) return false;
        if (typeof window.isTaskOverdueDay === 'function' && !window.isTaskOverdueDay(t)) return false;
        return isStemTask(t);
      },
      empty: 'No overdue STEM tasks — nice work',
    },
    no_estimate: {
      label: 'No estimate',
      icon: '⏱',
      keys: ['estimate', 'time', 'duration', 'missing'],
      match(t) {
        if (t.done) return false;
        return !t.estTime || Number(t.estTime) <= 0;
      },
      empty: 'Every open task has a time estimate',
    },
    exam_prep: {
      label: 'Exam prep',
      icon: '📝',
      keys: ['exam', 'test', 'quiz', 'study'],
      match(t) {
        if (t.done) return false;
        const type = String(t.type || '').toLowerCase();
        if (type !== 'test' && type !== 'quiz') return false;
        if (!t.date) return true;
        const due = new Date(t.date + 'T12:00:00');
        const today = new Date((typeof window.todayStr === 'function' ? window.todayStr() : '') + 'T00:00:00');
        const horizon = new Date(today);
        horizon.setDate(horizon.getDate() + 14);
        return due <= horizon;
      },
      empty: 'No tests or quizzes in the next 2 weeks',
    },
    due_week: {
      label: 'Due this week',
      icon: '📅',
      keys: ['week', 'soon', 'upcoming'],
      match(t) {
        if (t.done || !t.date) return false;
        const due = new Date(t.date + 'T00:00:00');
        const today = new Date((typeof window.todayStr === 'function' ? window.todayStr() : '') + 'T00:00:00');
        const end = new Date(today);
        end.setDate(end.getDate() + 7);
        return due >= today && due <= end;
      },
      empty: 'Nothing due in the next 7 days',
    },
  };

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

  function getStore() {
    const s = load(STORE_KEY, {});
    return s && typeof s === 'object' ? s : {};
  }

  function saveStore(patch) {
    const next = { ...getStore(), ...patch, updatedAt: Date.now() };
    save(STORE_KEY, next);
    try {
      if (typeof window.syncKey === 'function') window.syncKey('smartLists', next);
    } catch (_) {}
    return next;
  }

  function applyFromCloud(data) {
    if (!data || typeof data !== 'object') return;
    save(STORE_KEY, data);
    renderChips();
  }

  function getCloudSlice() {
    return getStore();
  }

  function pinnedIds() {
    const store = getStore();
    const pinned = Array.isArray(store.pinned) ? store.pinned : null;
    if (pinned && pinned.length) return pinned.filter((id) => PRESETS[id]);
    return ['overdue_stem', 'no_estimate', 'exam_prep'];
  }

  function isStemTask(t) {
    const subjs = typeof window.getSubjects === 'function' ? window.getSubjects() : {};
    const sub = t.subject ? subjs[t.subject] : null;
    const name = sub ? sub.name : String(t.subject || '');
    return /bio|chem|phys|math|calc|stat|engineer|cs|comp|code|science|stem|anat|geo/i.test(name);
  }

  function smartIdFromFilter(filter) {
    if (!filter || !String(filter).startsWith('smart:')) return null;
    return String(filter).slice(6);
  }

  function isSmartFilter(filter) {
    return !!smartIdFromFilter(filter);
  }

  function applyFilter(list, filter) {
    const id = smartIdFromFilter(filter);
    if (!id || !enabled()) return list;
    const preset = PRESETS[id];
    if (!preset) return list;
    return list.filter((t) => {
      try {
        return preset.match(t);
      } catch (_) {
        return false;
      }
    });
  }

  function countFor(id) {
    const preset = PRESETS[id];
    if (!preset || typeof window.tasks === 'undefined') return 0;
    const src = Array.isArray(window.tasks) ? window.tasks : [];
    try {
      return src.filter((t) => preset.match(t)).length;
    } catch (_) {
      return 0;
    }
  }

  function getEmptyMeta(filter) {
    const id = smartIdFromFilter(filter);
    const preset = id ? PRESETS[id] : null;
    if (!preset) return null;
    return { icon: preset.icon, title: preset.empty || T('smart.empty') };
  }

  function clearActive() {
    document.querySelectorAll('#smartListChips .tmode-btn')?.forEach((b) => b.classList.remove('active'));
  }

  function setSmartList(id, el) {
    if (!enabled() || !PRESETS[id]) return false;
    if (typeof window.taskFilter !== 'undefined') window.taskFilter = 'smart:' + id;
    document.querySelectorAll('#filterChips .tmode-btn')?.forEach((b) => b.classList.remove('active'));
    clearActive();
    if (el) el.classList.add('active');
    if (typeof window.renderTasks === 'function') window.renderTasks();
    saveStore({ lastActive: id });
    return true;
  }

  window.setSmartList = setSmartList;

  function renderChips() {
    const row = document.getElementById('smartListRow');
    if (!row || !enabled()) {
      document.getElementById('smartListRow')?.remove();
      return;
    }

    let chips = document.getElementById('smartListChips');
    if (!chips) {
      chips = document.createElement('div');
      chips.id = 'smartListChips';
      chips.className = 'dash-filters flux-smart-list-chips';
      chips.setAttribute('role', 'toolbar');
      chips.setAttribute('aria-label', T('smart.toolbar'));
      row.appendChild(chips);
    }

    const activeId = smartIdFromFilter(typeof window.taskFilter !== 'undefined' ? window.taskFilter : '');
    chips.innerHTML = pinnedIds()
      .map((id) => {
        const p = PRESETS[id];
        if (!p) return '';
        const n = countFor(id);
        const on = activeId === id ? ' active' : '';
        return `<button type="button" class="tmode-btn flux-smart-chip${on}" data-smart-id="${id}" onclick="setSmartList('${id}',this)" title="${esc(p.label)}">${p.icon} ${esc(p.label)}${n ? `<span class="flux-smart-count">${n}</span>` : ''}</button>`;
      })
      .join('');
  }

  function ensureRow() {
    const filtersRow = document.querySelector('.dash-filters-row');
    if (!filtersRow || !enabled()) return;
    let row = document.getElementById('smartListRow');
    if (!row) {
      row = document.createElement('div');
      row.id = 'smartListRow';
      row.className = 'dash-smart-list-row';
      filtersRow.insertAdjacentElement('afterend', row);
    }
    renderChips();
  }

  function getPaletteCommands(q) {
    if (!enabled()) return [];
    const needle = (q || '').toLowerCase().trim();
    return pinnedIds()
      .map((id) => {
        const p = PRESETS[id];
        if (!p) return null;
        const label = T('smart.palette', { name: p.label });
        if (needle) {
          const blob = (label + ' ' + (p.keys || []).join(' ')).toLowerCase();
          if (!blob.includes(needle) && !(window.FluxCmdPaletteV2?.matchesQuery?.(needle, label, '', p.keys))) return null;
        }
        return {
          id: 'smart:' + id,
          icon: p.icon,
          label,
          cat: 'Smart lists',
          _keys: ['smart', 'list', ...(p.keys || [])],
          action: () => {
            if (typeof window.nav === 'function') window.nav('dashboard');
            setSmartList(id);
            if (typeof window.closeCommandPalette === 'function') window.closeCommandPalette();
          },
        };
      })
      .filter(Boolean);
  }

  function install() {
    if (!enabled()) return false;
    ensureRow();
    const origRender = window.renderTasks;
    if (typeof origRender === 'function' && !origRender._fluxSmartWrapped) {
      window.renderTasks = function () {
        const r = origRender.apply(this, arguments);
        try {
          renderChips();
        } catch (_) {}
        return r;
      };
      window.renderTasks._fluxSmartWrapped = true;
    }
    return true;
  }

  window.FluxSmartLists = {
    FLAG,
    enabled,
    PRESETS,
    applyFilter,
    isSmartFilter,
    smartIdFromFilter,
    getEmptyMeta,
    clearActive,
    setSmartList,
    renderChips,
    getPaletteCommands,
    getCloudSlice,
    applyFromCloud,
    countFor,
    install,
  };
})();
