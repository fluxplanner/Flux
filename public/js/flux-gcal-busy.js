/**
 * P12.4 — Google Calendar busy-block overlays + conflict surfacing.
 * Flags: enable_gcal_2way + enable_gcal_busy_overlay (both required).
 */
(function () {
  'use strict';

  const FLAG = 'enable_gcal_busy_overlay';
  const CACHE_KEY = 'flux_gcal_busy_cache_v1';
  const STALE_MS = 30 * 60 * 1000;

  function gcal2wayOn() {
    try {
      return !!window.FluxFeatureFlags?.isEnabled('enable_gcal_2way', false);
    } catch (_) {
      return false;
    }
  }

  function enabled() {
    if (!gcal2wayOn()) return false;
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

  function fmtDay(iso) {
    if (typeof window.fmtFluxDate === 'function') return window.fmtFluxDate(iso, 'short');
    return iso || '';
  }

  function parseIsoMinutes(iso) {
    if (!iso) return 0;
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return 0;
    return d.getHours() * 60 + d.getMinutes();
  }

  function formatMin(m) {
    if (typeof window.formatCalTimeShort === 'function') {
      const h = Math.floor(m / 60);
      const min = m % 60;
      return window.formatCalTimeShort(`${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`);
    }
    const h = Math.floor(m / 60);
    const min = m % 60;
    const ap = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 || 12;
    return `${h12}:${String(min).padStart(2, '0')} ${ap}`;
  }

  function taskTimeMin(t) {
    if (!t?.time) return null;
    if (typeof window.fluxTimeSortMinutes === 'function') return window.fluxTimeSortMinutes(t.time);
    const p = String(t.time).match(/(\d{1,2}):(\d{2})/);
    if (!p) return null;
    return parseInt(p[1], 10) * 60 + parseInt(p[2], 10);
  }

  function getCache() {
    const c = load(CACHE_KEY, null);
    if (!c || !Array.isArray(c.blocks)) return { at: 0, blocks: [] };
    return c;
  }

  function setCache(blocks) {
    save(CACHE_KEY, { at: Date.now(), blocks: blocks || [] });
  }

  function gcalEventDate(ev) {
    const start = ev.start?.dateTime || ev.start?.date || '';
    return start ? String(start).slice(0, 10) : '';
  }

  function ingestItems(items) {
    if (!enabled()) return;
    const blocks = [];
    (items || []).forEach((ev) => {
      const date = gcalEventDate(ev);
      if (!date || !ev.id) return;
      const allDay = !!ev.start?.date && !ev.start?.dateTime;
      let startMin = 0;
      let endMin = 24 * 60;
      if (ev.start?.dateTime) {
        startMin = parseIsoMinutes(ev.start.dateTime);
        endMin = ev.end?.dateTime ? parseIsoMinutes(ev.end.dateTime) : startMin + 60;
        if (endMin <= startMin) endMin = startMin + 60;
      }
      blocks.push({
        id: String(ev.id),
        title: ev.summary || T('gcal.busy_untitled'),
        date,
        startMin,
        endMin,
        allDay: !!allDay,
      });
    });
    setCache(blocks);
  }

  function blocksForDate(iso) {
    const d = String(iso || '').slice(0, 10);
    return getCache().blocks.filter((b) => b.date === d);
  }

  function busyDatesSet() {
    if (!enabled()) return new Set();
    const set = new Set();
    getCache().blocks.forEach((b) => {
      if (b.date) set.add(b.date);
    });
    return set;
  }

  function openTasksByDate() {
    const by = {};
    const list = typeof window.tasks !== 'undefined' && Array.isArray(window.tasks) ? window.tasks : [];
    list.forEach((t) => {
      if (!t || t.done || !t.date) return;
      const d = String(t.date).slice(0, 10);
      if (!by[d]) by[d] = [];
      by[d].push(t);
    });
    return by;
  }

  function detectConflicts() {
    if (!enabled()) return [];
    const byDate = {};
    getCache().blocks.forEach((b) => {
      if (!byDate[b.date]) byDate[b.date] = [];
      byDate[b.date].push(b);
    });
    const tasksBy = openTasksByDate();
    const issues = [];
    const seen = new Set();

    Object.entries(byDate).forEach(([date, evs]) => {
      const dayTasks = tasksBy[date] || [];
      if (!dayTasks.length) return;
      const timed = evs.filter((e) => !e.allDay);
      const key1 = `busy|${date}`;
      if (timed.length >= 2 && !seen.has(key1)) {
        seen.add(key1);
        issues.push({
          kind: 'gcal_busy',
          date,
          message: T('gcal.conflict_busy', {
            date: fmtDay(date + 'T12:00'),
            events: timed.length,
            tasks: dayTasks.length,
          }),
        });
      }
      dayTasks.forEach((t) => {
        const tm = taskTimeMin(t);
        if (tm == null) return;
        timed.forEach((ev) => {
          if (tm >= ev.startMin && tm < ev.endMin) {
            const key = `overlap|${date}|${t.id}|${ev.id}`;
            if (seen.has(key)) return;
            seen.add(key);
            issues.push({
              kind: 'gcal_overlap',
              date,
              message: T('gcal.conflict_overlap', {
                date: fmtDay(date + 'T12:00'),
                task: t.name || T('task.untitled'),
                event: ev.title,
              }),
            });
          }
        });
      });
      const allDay = evs.filter((e) => e.allDay);
      if (allDay.length && dayTasks.length >= 3) {
        const key = `allday|${date}`;
        if (!seen.has(key)) {
          seen.add(key);
          issues.push({
            kind: 'gcal_allday',
            date,
            message: T('gcal.conflict_allday', {
              date: fmtDay(date + 'T12:00'),
              tasks: dayTasks.length,
            }),
          });
        }
      }
    });
    return issues;
  }

  function renderBusyBarsHtml(iso, max) {
    if (!enabled()) return '';
    const blocks = blocksForDate(iso).slice(0, max || 2);
    if (!blocks.length) return '';
    return blocks
      .map((b) => {
        const lab = b.allDay
          ? esc(T('gcal.all_day'))
          : esc(formatMin(b.startMin));
        return `<div class="cal-gcal-busy-bar" title="${esc(b.title)}">${lab}</div>`;
      })
      .join('');
  }

  function renderDayHint(iso) {
    if (!enabled() || !iso) return '';
    const blocks = blocksForDate(iso);
    if (!blocks.length) return '';
    const conflicts = detectConflicts().filter((i) => i.date === String(iso).slice(0, 10));
    const items = blocks
      .slice(0, 6)
      .map((b) => {
        const when = b.allDay ? T('gcal.all_day') : `${formatMin(b.startMin)}–${formatMin(b.endMin)}`;
        return `<li>${esc(when)} · ${esc(b.title)}</li>`;
      })
      .join('');
    const conflictHtml = conflicts.length
      ? `<ul class="gcal-busy-conflict-list">${conflicts.map((c) => `<li>${esc(c.message)}</li>`).join('')}</ul>`
      : '';
    return `<div class="cal-gcal-busy-hint" role="status">
      <strong>${esc(T('gcal.busy_title'))}</strong>
      <ul class="gcal-busy-list">${items}</ul>
      ${conflictHtml}
    </div>`;
  }

  function decorateCalendar() {
    if (!enabled()) return;
    const dates = busyDatesSet();
    if (!dates.size) return;
    document.querySelectorAll('#calGrid .cal-day[data-cal-date]').forEach((cell) => {
      const ds = cell.getAttribute('data-cal-date');
      if (!ds || !dates.has(ds)) return;
      cell.classList.add('cal-day--gcal-busy');
      cell.setAttribute('title', T('gcal.cal_marker'));
      if (!cell.querySelector('.cal-gcal-busy-stack')) {
        const stack = document.createElement('div');
        stack.className = 'cal-gcal-busy-stack';
        stack.innerHTML = renderBusyBarsHtml(ds, 2);
        cell.appendChild(stack);
      }
    });
  }

  function renderBanner() {
    const el = document.getElementById('gcalBusyBanner');
    if (!el) return;
    if (!enabled()) {
      el.style.display = 'none';
      el.innerHTML = '';
      return;
    }
    const issues = detectConflicts();
    if (!issues.length) {
      el.style.display = 'none';
      el.innerHTML = '';
      return;
    }
    const items = issues
      .slice(0, 4)
      .map((i) => `<li>${esc(i.message)}</li>`)
      .join('');
    const more =
      issues.length > 4 ? `<li>${esc(T('gcal.more', { n: issues.length - 4 }))}</li>` : '';
    el.style.display = 'block';
    el.innerHTML = `<strong>${esc(T('gcal.banner_title'))}</strong>
      <ul class="gcal-busy-banner-list">${items}${more}</ul>`;
  }

  async function refreshIfStale() {
    if (!enabled()) return;
    const c = getCache();
    if (c.at && Date.now() - c.at < STALE_MS && c.blocks.length) return;
    if (typeof window.FluxGCal2Way?.fetchGCalEvents === 'function') {
      const fetched = await window.FluxGCal2Way.fetchGCalEvents(42);
      if (fetched?.ok) ingestItems(fetched.items || []);
    }
  }

  function install() {
    if (!enabled()) return false;
    return true;
  }

  window.FluxGCalBusy = {
    FLAG,
    enabled,
    ingestItems,
    blocksForDate,
    busyDatesSet,
    detectConflicts,
    renderBusyBarsHtml,
    renderDayHint,
    decorateCalendar,
    renderBanner,
    refreshIfStale,
    install,
  };
})();
