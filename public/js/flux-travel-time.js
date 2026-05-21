/**
 * P14.4 — Travel time between consecutive timed calendar events.
 * Flag: enable_travel_time (default off).
 */
(function () {
  'use strict';

  const FLAG = 'enable_travel_time';
  const STORE_KEY = 'flux_travel_time_v1';
  const CARD_ID = 'fluxTravelTimeCard';
  const DEFAULT_TRAVEL = 15;

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
    const travel = parseInt(s.travelMin, 10);
    return {
      travelMin: Number.isFinite(travel) ? Math.min(120, Math.max(0, travel)) : DEFAULT_TRAVEL,
    };
  }

  function persistSettings(patch) {
    const next = { ...getSettings(), ...patch, updatedAt: Date.now() };
    save(STORE_KEY, next);
    try {
      if (typeof window.syncKey === 'function') window.syncKey('travelTime', next);
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

  function collectBlocks(iso) {
    if (window.FluxEventBuffer?.rawBlocksForDate) {
      return window.FluxEventBuffer.rawBlocksForDate(iso);
    }
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
        title: e.title || T('travel.untitled'),
        startMin: start,
        endMin: Math.min(24 * 60, start + 60),
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
            title: w.title || T('travel.weekly'),
            startMin: start,
            endMin: Math.min(24 * 60, start + 60),
          });
        });
      }
    } catch (_) {}
    return blocks;
  }

  function detectGapsForDate(iso) {
    const { travelMin } = getSettings();
    const blocks = collectBlocks(iso)
      .slice()
      .sort((a, b) => a.startMin - b.startMin || a.endMin - b.endMin);
    const gaps = [];
    for (let i = 0; i < blocks.length - 1; i += 1) {
      const a = blocks[i];
      const b = blocks[i + 1];
      const gap = b.startMin - a.endMin;
      if (gap < 0) continue;
      if (gap < travelMin) {
        gaps.push({
          date: String(iso).slice(0, 10),
          from: a,
          to: b,
          gapMin: gap,
          needMin: travelMin,
        });
      }
    }
    return gaps;
  }

  function detectAllGaps() {
    if (!enabled()) return [];
    const dates = new Set();
    try {
      if (window.FluxGCalBusy?.busyDatesSet) {
        window.FluxGCalBusy.busyDatesSet().forEach((d) => dates.add(d));
      }
    } catch (_) {}
    (load('flux_events', []) || []).forEach((e) => {
      if (e?.date) dates.add(String(e.date).slice(0, 10));
    });
    const tasks = typeof window.tasks !== 'undefined' && Array.isArray(window.tasks) ? window.tasks : [];
    tasks.forEach((t) => {
      if (t?.date && t.time) dates.add(String(t.date).slice(0, 10));
    });
    const today = typeof window.todayStr === 'function' ? window.todayStr() : new Date().toISOString().slice(0, 10);
    dates.add(today);
    const out = [];
    const seen = new Set();
    dates.forEach((date) => {
      detectGapsForDate(date).forEach((g) => {
        const key = `${g.date}|${g.from.id}|${g.to.id}`;
        if (seen.has(key)) return;
        seen.add(key);
        out.push(g);
      });
    });
    return out.sort((a, b) => String(a.date).localeCompare(String(b.date)));
  }

  function gapMessage(g) {
    return T('travel.gap', {
      date: fmtDay(g.date + 'T12:00'),
      from: g.from.title,
      to: g.to.title,
      gap: g.gapMin,
      need: g.needMin,
      fromEnd: formatMin(g.from.endMin),
      toStart: formatMin(g.to.startMin),
    });
  }

  function travelWarnDates() {
    const set = new Set();
    detectAllGaps().forEach((g) => {
      if (g.date) set.add(g.date);
    });
    return set;
  }

  function renderDayHint(iso) {
    if (!enabled() || !iso) return '';
    const gaps = detectGapsForDate(iso);
    if (!gaps.length) return '';
    const items = gaps
      .slice(0, 6)
      .map((g) => `<li>${esc(gapMessage(g))}</li>`)
      .join('');
    return `<div class="cal-travel-hint" role="status">
      <strong>${esc(T('travel.day_title'))}</strong>
      <ul>${items}</ul>
    </div>`;
  }

  function renderBanner() {
    const el = document.getElementById('travelTimeBanner');
    if (!el) return;
    if (!enabled()) {
      el.style.display = 'none';
      el.innerHTML = '';
      return;
    }
    const gaps = detectAllGaps();
    if (!gaps.length) {
      el.style.display = 'none';
      el.innerHTML = '';
      return;
    }
    const items = gaps
      .slice(0, 4)
      .map((g) => `<li>${esc(gapMessage(g))}</li>`)
      .join('');
    const more =
      gaps.length > 4 ? `<li>${esc(T('travel.more', { n: gaps.length - 4 }))}</li>` : '';
    el.style.display = 'block';
    el.innerHTML = `<strong>${esc(T('travel.banner_title'))}</strong>
      <ul class="travel-time-banner-list">${items}${more}</ul>`;
  }

  function decorateCalendarDays() {
    if (!enabled()) return;
    const dates = travelWarnDates();
    document.querySelectorAll('#calGrid .cal-day[data-cal-date]').forEach((cell) => {
      const ds = cell.getAttribute('data-cal-date');
      cell.classList.toggle('cal-day--travel-warn', !!(ds && dates.has(ds)));
    });
  }

  function renderCard() {
    if (!enabled()) return;
    const card = document.getElementById(CARD_ID);
    if (!card) return;
    const { travelMin } = getSettings();
    card.innerHTML = `<h3 style="margin:0 0 8px">${esc(T('travel.title'))}</h3>
<p class="flux-tt-lede">${esc(T('travel.lede'))}</p>
<label for="fluxTtTravel" style="font-size:.72rem;color:var(--muted2)">${esc(T('travel.minutes'))}</label>
<input type="number" id="fluxTtTravel" min="0" max="120" step="5" value="${travelMin}" style="width:100%;margin:6px 0 10px">
<button type="button" class="btn-sec" id="fluxTtSave" style="width:100%">${esc(T('travel.save'))}</button>`;
    card.querySelector('#fluxTtSave')?.addEventListener('click', () => {
      const v = parseInt(document.getElementById('fluxTtTravel')?.value, 10);
      persistSettings({ travelMin: Number.isFinite(v) ? v : DEFAULT_TRAVEL });
      if (typeof window.showToast === 'function') window.showToast(T('travel.saved'), 'success');
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
    if (!scheduleSection) {
      renderCard();
      return;
    }
    let card = document.getElementById(CARD_ID);
    if (!card) {
      card = document.createElement('div');
      card.id = CARD_ID;
      card.className = 'card';
      const bufferCard = document.getElementById('fluxEventBufferCard');
      if (bufferCard && bufferCard.nextSibling) scheduleSection.insertBefore(card, bufferCard.nextSibling);
      else if (bufferCard) bufferCard.insertAdjacentElement('afterend', card);
      else scheduleSection.insertBefore(card, scheduleSection.firstChild);
    }
    renderCard();
  }

  function getPaletteCommands(q) {
    if (!enabled()) return [];
    const needle = (q || '').toLowerCase();
    const label = T('travel.palette');
    const keys = 'travel commute transit gap between events';
    if (
      needle &&
      !label.toLowerCase().includes(needle) &&
      !keys.split(' ').some((k) => needle.includes(k))
    ) {
      return [];
    }
    return [
      {
        icon: '🚶',
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
    if (typeof origNav === 'function' && !origNav._fluxTtWrapped) {
      window.nav = function (tab) {
        const r = origNav.apply(this, arguments);
        if (tab === 'calendar') setTimeout(() => ensureCard(), 80);
        return r;
      };
      window.nav._fluxTtWrapped = true;
    }
    return true;
  }

  window.FluxTravelTime = {
    FLAG,
    enabled,
    getSettings,
    collectBlocks,
    detectGapsForDate,
    detectAllGaps,
    travelWarnDates,
    renderDayHint,
    renderBanner,
    decorateCalendarDays,
    getCloudSlice,
    applyFromCloud,
    getPaletteCommands,
    install,
  };
})();
