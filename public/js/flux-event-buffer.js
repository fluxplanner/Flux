/**
 * P14.3 — Buffer time before/after imported calendar events.
 * Flag: enable_event_buffer (default off).
 */
(function () {
  'use strict';

  const FLAG = 'enable_event_buffer';
  const STORE_KEY = 'flux_event_buffer_v1';
  const CARD_ID = 'fluxEventBufferCard';
  const DEFAULT_BEFORE = 15;
  const DEFAULT_AFTER = 15;

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

  function fmtDay(iso) {
    if (typeof window.fmtFluxDate === 'function') return window.fmtFluxDate(iso, 'short');
    return iso || '';
  }

  function timeMin(t) {
    if (typeof window.fluxTimeSortMinutes === 'function') return window.fluxTimeSortMinutes(t);
    const m = String(t || '').match(/(\d{1,2}):(\d{2})/);
    return m ? parseInt(m[1], 10) * 60 + parseInt(m[2], 10) : null;
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

  function getSettings() {
    const s = load(STORE_KEY, {});
    const before = parseInt(s.beforeMin, 10);
    const after = parseInt(s.afterMin, 10);
    return {
      beforeMin: Number.isFinite(before) ? Math.min(120, Math.max(0, before)) : DEFAULT_BEFORE,
      afterMin: Number.isFinite(after) ? Math.min(120, Math.max(0, after)) : DEFAULT_AFTER,
    };
  }

  function persistSettings(patch) {
    const next = { ...getSettings(), ...patch, updatedAt: Date.now() };
    save(STORE_KEY, next);
    try {
      if (typeof window.syncKey === 'function') window.syncKey('eventBuffer', next);
    } catch (_) {}
    return next;
  }

  function getCloudSlice() {
    return getSettings();
  }

  function applyFromCloud(data) {
    if (!data || typeof data !== 'object') return;
    save(STORE_KEY, { ...getSettings(), ...data });
    renderCard();
  }

  function rawBlocksForDate(iso) {
    const d = String(iso || '').slice(0, 10);
    if (!d) return [];
    const blocks = [];

    try {
      if (window.FluxGCalBusy?.blocksForDate) {
        window.FluxGCalBusy.blocksForDate(d)
          .filter((b) => b && !b.allDay)
          .forEach((b) => {
            blocks.push({
              id: `g_${b.id}`,
              title: b.title,
              startMin: b.startMin,
              endMin: b.endMin,
              source: 'gcal',
            });
          });
      }
    } catch (_) {}

    (load('flux_events', []) || []).forEach((e) => {
      if (!e || String(e.date).slice(0, 10) !== d || !e.time) return;
      const start = timeMin(e.time);
      if (start == null || start >= 24 * 60) return;
      blocks.push({
        id: `e_${e.id}`,
        title: e.title || T('buffer.untitled_event'),
        startMin: start,
        endMin: Math.min(24 * 60, start + 60),
        source: 'event',
      });
    });

    try {
      if (typeof window.weeklyVirtualEventsForDate === 'function') {
        window.weeklyVirtualEventsForDate(d).forEach((w) => {
          if (!w?.time) return;
          const start = timeMin(w.time);
          if (start == null || start >= 24 * 60) return;
          blocks.push({
            id: `w_${w.ruleId}`,
            title: w.title || T('buffer.weekly'),
            startMin: start,
            endMin: Math.min(24 * 60, start + 60),
            source: 'weekly',
          });
        });
      }
    } catch (_) {}

    return blocks;
  }

  function bufferedBlocks(iso) {
    const { beforeMin, afterMin } = getSettings();
    return rawBlocksForDate(iso).map((b) => ({
      ...b,
      bufferBeforeStart: Math.max(0, b.startMin - beforeMin),
      bufferBeforeEnd: b.startMin,
      bufferAfterStart: b.endMin,
      bufferAfterEnd: Math.min(24 * 60, b.endMin + afterMin),
    }));
  }

  function taskInBuffer(task, block) {
    const tm = timeMin(task?.time);
    if (tm == null) return null;
    if (tm >= block.startMin && tm < block.endMin) return null;
    if (tm >= block.bufferBeforeStart && tm < block.bufferBeforeEnd) return 'before';
    if (tm >= block.bufferAfterStart && tm < block.bufferAfterEnd) return 'after';
    return null;
  }

  function detectConflicts() {
    if (!enabled()) return [];
    const tasks =
      typeof window.tasks !== 'undefined' && Array.isArray(window.tasks) ? window.tasks : [];
    const byDate = {};
    tasks.forEach((t) => {
      if (!t || t.done || !t.date || !t.time) return;
      const d = String(t.date).slice(0, 10);
      if (!byDate[d]) byDate[d] = [];
      byDate[d].push(t);
    });

    const issues = [];
    const seen = new Set();
    Object.keys(byDate).forEach((date) => {
      const blocks = bufferedBlocks(date);
      if (!blocks.length) return;
      byDate[date].forEach((task) => {
        blocks.forEach((block) => {
          const zone = taskInBuffer(task, block);
          if (!zone) return;
          const key = `${date}|${task.id}|${block.id}|${zone}`;
          if (seen.has(key)) return;
          seen.add(key);
          const when =
            zone === 'before'
              ? `${formatMin(block.bufferBeforeStart)}–${formatMin(block.bufferBeforeEnd)}`
              : `${formatMin(block.bufferAfterStart)}–${formatMin(block.bufferAfterEnd)}`;
          issues.push({
            date,
            message: T('buffer.conflict', {
              date: fmtDay(date + 'T12:00'),
              task: task.name || T('task.untitled'),
              event: block.title,
              when,
            }),
          });
        });
      });
    });
    return issues;
  }

  function bufferWarnDates() {
    const set = new Set();
    detectConflicts().forEach((i) => {
      if (i.date) set.add(i.date);
    });
    return set;
  }

  function renderDayHint(iso) {
    if (!enabled() || !iso) return '';
    const blocks = bufferedBlocks(iso);
    if (!blocks.length) return '';
    const { beforeMin, afterMin } = getSettings();
    const items = blocks
      .slice(0, 8)
      .map((b) => {
        const core = `${formatMin(b.startMin)}–${formatMin(b.endMin)} · ${esc(b.title)}`;
        const pad = T('buffer.pad_line', {
          before: beforeMin,
          after: afterMin,
          beforeRange: `${formatMin(b.bufferBeforeStart)}–${formatMin(b.bufferBeforeEnd)}`,
          afterRange: `${formatMin(b.bufferAfterStart)}–${formatMin(b.bufferAfterEnd)}`,
        });
        return `<li><strong>${core}</strong><br /><span style="opacity:.85">${pad}</span></li>`;
      })
      .join('');
    const dayIssues = detectConflicts().filter((i) => i.date === String(iso).slice(0, 10));
    const conflictHtml = dayIssues.length
      ? `<ul style="color:var(--gold);margin-top:8px">${dayIssues.map((c) => `<li>${esc(c.message)}</li>`).join('')}</ul>`
      : '';
    return `<div class="cal-event-buffer-hint" role="status">
      <strong>${esc(T('buffer.day_title'))}</strong>
      <ul>${items}</ul>
      ${conflictHtml}
    </div>`;
  }

  function renderBanner() {
    const el = document.getElementById('eventBufferBanner');
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
      issues.length > 4 ? `<li>${esc(T('buffer.more', { n: issues.length - 4 }))}</li>` : '';
    el.style.display = 'block';
    el.innerHTML = `<strong>${esc(T('buffer.banner_title'))}</strong>
      <ul class="event-buffer-banner-list">${items}${more}</ul>`;
  }

  function decorateCalendarDays() {
    if (!enabled()) return;
    const dates = bufferWarnDates();
    document.querySelectorAll('#calGrid .cal-day[data-cal-date]').forEach((cell) => {
      const ds = cell.getAttribute('data-cal-date');
      cell.classList.toggle('cal-day--buffer-warn', !!(ds && dates.has(ds)));
    });
  }

  function renderCard() {
    if (!enabled()) return;
    const card = document.getElementById(CARD_ID);
    if (!card) return;
    const { beforeMin, afterMin } = getSettings();
    card.innerHTML = `<h3 style="margin:0 0 8px">${esc(T('buffer.title'))}</h3>
<p class="flux-eb-lede">${esc(T('buffer.lede'))}</p>
<div class="flux-eb-grid">
  <div><label for="fluxEbBefore">${esc(T('buffer.before'))}</label><input type="number" id="fluxEbBefore" min="0" max="120" step="5" value="${beforeMin}"></div>
  <div><label for="fluxEbAfter">${esc(T('buffer.after'))}</label><input type="number" id="fluxEbAfter" min="0" max="120" step="5" value="${afterMin}"></div>
</div>
<button type="button" class="btn-sec" id="fluxEbSave" style="width:100%">${esc(T('buffer.save'))}</button>`;
    card.querySelector('#fluxEbSave')?.addEventListener('click', () => {
      const b = parseInt(document.getElementById('fluxEbBefore')?.value, 10);
      const a = parseInt(document.getElementById('fluxEbAfter')?.value, 10);
      persistSettings({
        beforeMin: Number.isFinite(b) ? b : DEFAULT_BEFORE,
        afterMin: Number.isFinite(a) ? a : DEFAULT_AFTER,
      });
      if (typeof window.showToast === 'function') window.showToast(T('buffer.saved'), 'success');
      try {
        if (typeof window.renderCalendar === 'function') window.renderCalendar();
      } catch (_) {}
      try {
        if (typeof window.renderScheduleConflictNotices === 'function') {
          window.renderScheduleConflictNotices();
        }
      } catch (_) {}
      renderCard();
    });
  }

  function ensureCard() {
    if (!enabled()) {
      document.getElementById(CARD_ID)?.remove();
      return;
    }
    const cal = document.getElementById('calendar');
    const scheduleSection = cal?.querySelector('[data-flux-cal-section="schedule"]');
    if (!scheduleSection || document.getElementById(CARD_ID)) {
      renderCard();
      return;
    }
    const card = document.createElement('div');
    card.id = CARD_ID;
    card.className = 'card';
    scheduleSection.insertBefore(card, scheduleSection.firstChild);
    renderCard();
  }

  function getPaletteCommands(q) {
    if (!enabled()) return [];
    const needle = (q || '').toLowerCase();
    const label = T('buffer.palette');
    const keys = 'buffer padding event calendar transition';
    if (
      needle &&
      !label.toLowerCase().includes(needle) &&
      !keys.split(' ').some((k) => needle.includes(k))
    ) {
      return [];
    }
    return [
      {
        icon: '⏳',
        label,
        cat: 'Navigation',
        action: () => {
          if (typeof window.closeCommandPalette === 'function') window.closeCommandPalette();
          if (typeof window.nav === 'function') window.nav('calendar');
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
    ensureCard();
    const origNav = window.nav;
    if (typeof origNav === 'function' && !origNav._fluxEbWrapped) {
      window.nav = function (tab) {
        const r = origNav.apply(this, arguments);
        if (tab === 'calendar') setTimeout(() => ensureCard(), 80);
        return r;
      };
      window.nav._fluxEbWrapped = true;
    }
    return true;
  }

  window.FluxEventBuffer = {
    FLAG,
    enabled,
    getSettings,
    rawBlocksForDate,
    bufferedBlocks,
    detectConflicts,
    bufferWarnDates,
    renderDayHint,
    renderBanner,
    decorateCalendarDays,
    getCloudSlice,
    applyFromCloud,
    getPaletteCommands,
    install,
  };
})();
