/**
 * P13.5 — Habit chain heatmaps (“don’t break the chain”).
 * Flag: enable_habit_heatmap (default off).
 */
(function () {
  'use strict';

  const FLAG = 'enable_habit_heatmap';
  const DAYS = 84;
  const CARD_ID = 'fluxHabitChainCard';

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

  function habitList() {
    if (typeof window.getFluxHabits === 'function') return window.getFluxHabits();
    return load('flux_habits', []);
  }

  function persistHabits(list) {
    if (typeof window.setFluxHabits === 'function') window.setFluxHabits(list);
    else {
      save('flux_habits', list);
      try {
        if (typeof window.syncKey === 'function') window.syncKey('habits', list);
      } catch (_) {}
    }
  }

  function normalizeHabit(h) {
    const hist = Array.isArray(h.history) ? h.history.filter(Boolean) : [];
    const unique = [...new Set(hist.map(String))].sort();
    const streaks = computeStreaks(unique);
    return {
      id: h.id || Date.now(),
      name: String(h.name || T('habit.untitled')).trim() || T('habit.untitled'),
      icon: h.icon || '🔥',
      history: unique,
      streak: streaks.current,
      bestStreak: Math.max(streaks.best, Number(h.bestStreak) || 0, streaks.current),
    };
  }

  function computeStreaks(sortedDates) {
    if (!sortedDates.length) return { current: 0, best: 0 };
    const set = new Set(sortedDates);
    let best = 0;
    let run = 0;
    let prev = null;
    sortedDates.forEach((ds) => {
      if (!prev) run = 1;
      else {
        const p = new Date(prev + 'T12:00:00');
        const c = new Date(ds + 'T12:00:00');
        p.setDate(p.getDate() + 1);
        run = p.getTime() === c.getTime() ? run + 1 : 1;
      }
      if (run > best) best = run;
      prev = ds;
    });

    let current = 0;
    const today = todayStr();
    const y = new Date(today + 'T12:00:00');
    y.setDate(y.getDate() - 1);
    const yStr = y.toISOString().slice(0, 10);
    let cursor = set.has(today) ? today : set.has(yStr) ? yStr : null;
    if (cursor) {
      current = 1;
      while (true) {
        const d = new Date(cursor + 'T12:00:00');
        d.setDate(d.getDate() - 1);
        const prevDs = d.toISOString().slice(0, 10);
        if (!set.has(prevDs)) break;
        current += 1;
        cursor = prevDs;
      }
    }
    return { current, best: Math.max(best, current) };
  }

  function dateRange(days) {
    const out = [];
    const end = new Date(todayStr() + 'T12:00:00');
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(end);
      d.setDate(end.getDate() - i);
      out.push(d.toISOString().slice(0, 10));
    }
    return out;
  }

  function weekColumns(dates) {
    const weeks = [];
    let col = [];
    dates.forEach((ds, i) => {
      const dow = new Date(ds + 'T12:00:00').getDay();
      if (i === 0) {
        for (let p = 0; p < dow; p++) col.push(null);
      }
      col.push(ds);
      if (dow === 6 || i === dates.length - 1) {
        while (col.length < 7) col.push(null);
        weeks.push(col);
        col = [];
      }
    });
    return weeks;
  }

  function heatmapHtml(habit) {
    const dates = dateRange(DAYS);
    const weeks = weekColumns(dates);
    const set = new Set(habit.history || []);
    const today = todayStr();
    let cells = '';
    weeks.forEach((week) => {
      cells += '<div class="flux-habit-week-col">';
      week.forEach((ds) => {
        if (!ds) {
          cells += '<span class="flux-habit-cell flux-habit-cell--pad"></span>';
          return;
        }
        const done = set.has(ds);
        const isToday = ds === today;
        cells += `<span class="flux-habit-cell${done ? ' flux-habit-cell--done' : ''}${isToday ? ' flux-habit-cell--today' : ''}" title="${esc(ds)}${done ? ' ✓' : ''}"></span>`;
      });
      cells += '</div>';
    });
    return `<div class="flux-habit-grid" aria-hidden="true">${cells}</div>`;
  }

  function renderCard() {
    if (!enabled()) {
      document.getElementById(CARD_ID)?.remove();
      return;
    }

    const anchor = document.getElementById('focusHeatmap')?.closest('.card');
    const stack = anchor?.parentElement;
    if (!stack) return;

    let card = document.getElementById(CARD_ID);
    if (!card) {
      card = document.createElement('div');
      card.id = CARD_ID;
      card.className = 'card flux-habit-chain-card';
      if (anchor.nextElementSibling) anchor.insertAdjacentElement('afterend', card);
      else stack.appendChild(card);
    }

    const list = habitList().map(normalizeHabit);
    const today = todayStr();

    const rows = list.length
      ? list
          .map((h) => {
            const doneToday = (h.history || []).includes(today);
            return `<div class="flux-habit-row" data-habit-id="${h.id}">
          <div class="flux-habit-row-head">
            <button type="button" class="flux-habit-check${doneToday ? ' is-done' : ''}" onclick="FluxHabitHeatmap.toggleToday(${h.id})" aria-pressed="${doneToday ? 'true' : 'false'}" title="${esc(T('habit.toggle'))}">${doneToday ? '✓' : ''}</button>
            <div class="flux-habit-meta">
              <div class="flux-habit-name">${h.icon ? esc(h.icon) + ' ' : ''}${esc(h.name)}</div>
              <div class="flux-habit-streak">${esc(T('habit.streak', { n: h.streak, best: h.bestStreak }))}</div>
            </div>
            <button type="button" class="flux-habit-remove" onclick="FluxHabitHeatmap.removeHabit(${h.id})" aria-label="${esc(T('habit.remove'))}">✕</button>
          </div>
          ${heatmapHtml(h)}
        </div>`;
          })
          .join('')
      : `<div class="flux-habit-empty">${esc(T('habit.empty'))}</div>`;

    card.innerHTML = `<div class="flux-habit-card-head">
      <h3>${esc(T('habit.title'))}</h3>
      <p class="flux-habit-lede">${esc(T('habit.lede'))}</p>
    </div>
    ${rows}
    <div class="flux-habit-add-row">
      <input type="text" id="fluxHabitNameInput" placeholder="${esc(T('habit.placeholder'))}" maxlength="80" />
      <button type="button" class="btn-sec" onclick="FluxHabitHeatmap.addFromInput()">${esc(T('habit.add'))}</button>
    </div>`;

    const input = card.querySelector('#fluxHabitNameInput');
    input?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        addFromInput();
      }
    });
  }

  function addHabit(name) {
    const n = String(name || '').trim();
    if (!n) {
      toast(T('habit.name_required'), 'warning');
      return null;
    }
    const list = habitList().slice();
    const habit = normalizeHabit({ id: Date.now(), name: n, icon: '🔥', history: [] });
    list.push(habit);
    persistHabits(list);
    renderCard();
    toast(T('habit.added', { name: n }), 'success');
    return habit;
  }

  function addFromInput() {
    const input = document.getElementById('fluxHabitNameInput');
    const v = input?.value || '';
    if (addHabit(v) && input) input.value = '';
  }

  function toggleToday(id) {
    const list = habitList().slice();
    const idx = list.findIndex((h) => String(h.id) === String(id));
    if (idx < 0) return;
    const h = normalizeHabit(list[idx]);
    const today = todayStr();
    const set = new Set(h.history);
    if (set.has(today)) set.delete(today);
    else set.add(today);
    h.history = [...set].sort();
    const streaks = computeStreaks(h.history);
    h.streak = streaks.current;
    h.bestStreak = Math.max(h.bestStreak, streaks.best);
    list[idx] = h;
    persistHabits(list);
    renderCard();
    if (h.history.includes(today)) {
      toast(T('habit.logged', { name: h.name }), 'success');
      if (h.streak >= 7) toast(T('habit.chain', { n: h.streak }), 'success');
    }
    try {
      if (typeof window.renderStats === 'function') window.renderStats();
    } catch (_) {}
  }

  function removeHabit(id) {
    const list = habitList().filter((h) => String(h.id) !== String(id));
    persistHabits(list);
    renderCard();
    toast(T('habit.removed'), 'info');
    try {
      if (typeof window.renderStats === 'function') window.renderStats();
    } catch (_) {}
  }

  function install() {
    if (!enabled()) {
      document.getElementById(CARD_ID)?.remove();
      return false;
    }
    renderCard();
    const origNav = window.nav;
    if (typeof origNav === 'function' && !origNav._fluxHabitWrapped) {
      window.nav = function (id, btn, navOpt) {
        const r = origNav.apply(this, arguments);
        if (id === 'timer') setTimeout(renderCard, 60);
        return r;
      };
      window.nav._fluxHabitWrapped = true;
    }
    return true;
  }

  window.FluxHabitHeatmap = {
    FLAG,
    enabled,
    renderCard,
    addHabit,
    addFromInput,
    toggleToday,
    removeHabit,
    install,
  };
})();
