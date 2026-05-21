/**
 * P15.1 — Energy-based scheduling: peak hours + heavy-task hints.
 * Flag: enable_energy_scheduling (default off).
 */
(function () {
  'use strict';

  const FLAG = 'enable_energy_scheduling';
  const STORE_KEY = 'flux_energy_scheduling_v1';
  const CARD_ID = 'fluxEnergySchedulingCard';
  const MAX_PER_HOUR = 24;

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

  function getStore() {
    const s = load(STORE_KEY, {});
    return s && typeof s === 'object' && s.samples && typeof s.samples === 'object'
      ? { samples: s.samples }
      : { samples: {} };
  }

  function persistStore(data) {
    save(STORE_KEY, data);
    try {
      if (typeof window.syncKey === 'function') window.syncKey('energyScheduling', data);
    } catch (_) {}
  }

  function getCloudSlice() {
    return getStore();
  }

  function applyFromCloud(data) {
    if (!data || typeof data !== 'object') return;
    persistStore({ samples: data.samples || {} });
    renderCard();
  }

  function recordSample(energy, hour) {
    if (!enabled()) return;
    const e = Math.max(1, Math.min(5, parseInt(energy, 10) || 0));
    if (!e) return;
    const h =
      hour != null
        ? Math.max(0, Math.min(23, parseInt(hour, 10)))
        : new Date().getHours();
    const store = getStore();
    const key = String(h);
    const list = Array.isArray(store.samples[key]) ? store.samples[key].slice() : [];
    list.push(e);
    while (list.length > MAX_PER_HOUR) list.shift();
    store.samples[key] = list;
    persistStore(store);
  }

  function hourLabel(h) {
    const ap = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 || 12;
    return `${h12}${ap}`;
  }

  function formatRange(startHour, endHour) {
    return `${hourLabel(startHour)}–${hourLabel(endHour)}`;
  }

  function computePeakWindows() {
    const store = getStore();
    const avgs = [];
    Object.entries(store.samples).forEach(([hour, vals]) => {
      const list = Array.isArray(vals) ? vals : [];
      if (list.length < 2) return;
      const avg = list.reduce((s, v) => s + v, 0) / list.length;
      avgs.push({ hour: parseInt(hour, 10), avg, count: list.length });
    });
    if (!avgs.length) return [];
    avgs.sort((a, b) => b.avg - a.avg || b.count - a.count);
    const threshold = Math.max(3.5, avgs[0].avg - 0.5);
    const peakHours = avgs.filter((a) => a.avg >= threshold).map((a) => a.hour);
    if (!peakHours.length) {
      const top = avgs.slice(0, 2).map((a) => a.hour);
      peakHours.push(...top);
    }
    peakHours.sort((a, b) => a - b);
    const windows = [];
    let start = peakHours[0];
    let prev = peakHours[0];
    for (let i = 1; i < peakHours.length; i += 1) {
      if (peakHours[i] === prev + 1) {
        prev = peakHours[i];
      } else {
        windows.push({ start, end: prev + 1 });
        start = peakHours[i];
        prev = peakHours[i];
      }
    }
    if (start != null) windows.push({ start, end: prev + 1 });
    return windows.slice(0, 3);
  }

  function heavyTasks() {
    const list = typeof window.tasks !== 'undefined' && Array.isArray(window.tasks) ? window.tasks : [];
    const heavyTypes = ['project', 'essay', 'lab'];
    return list
      .filter((t) => {
        if (!t || t.done) return false;
        const diff = parseInt(t.difficulty, 10) || 3;
        return diff >= 4 || heavyTypes.includes(t.type || '');
      })
      .slice(0, 4);
  }

  function totalSamples() {
    return Object.values(getStore().samples).reduce(
      (s, arr) => s + (Array.isArray(arr) ? arr.length : 0),
      0,
    );
  }

  function renderCard() {
    if (!enabled()) return;
    const card = document.getElementById(CARD_ID);
    if (!card) return;
    const windows = computePeakWindows();
    const heavy = heavyTasks();
    const samples = totalSamples();

    const peakHtml = windows.length
      ? windows.map((w) => `<span class="flux-es-peak-chip">${esc(formatRange(w.start, w.end))}</span>`).join('')
      : `<span class="flux-es-empty">${esc(T('es.no_peak'))}</span>`;

    const tasksHtml = heavy.length
      ? `<ul class="flux-es-tasks">${heavy
          .map(
            (t) =>
              `<li>${esc(T('es.task_hint', { name: t.name || T('task.untitled') }))}</li>`,
          )
          .join('')}</ul>`
      : `<p class="flux-es-empty">${esc(T('es.no_heavy'))}</p>`;

    card.innerHTML = `<h3 style="margin:0 0 6px">${esc(T('es.title'))}</h3>
<p class="flux-es-lede">${esc(samples >= 4 ? T('es.lede') : T('es.lede_collect'))}</p>
<div class="flux-es-peak" aria-label="${esc(T('es.peak_aria'))}">${peakHtml}</div>
${tasksHtml}`;

    card.style.display = samples >= 2 || heavy.length ? '' : 'none';
  }

  function ensureCard() {
    if (!enabled()) {
      document.getElementById(CARD_ID)?.remove();
      return;
    }
    const sections = document.getElementById('fluxDashSections');
    if (!sections) return;
    let card = document.getElementById(CARD_ID);
    if (!card) {
      card = document.createElement('div');
      card.id = CARD_ID;
      card.className = 'card';
      card.setAttribute('data-flux-section', 'energy-scheduling');
      card.setAttribute('role', 'region');
      card.setAttribute('aria-label', T('es.title'));
      const pulse = sections.querySelector('[data-flux-section="pulse"]');
      if (pulse && pulse.nextSibling) sections.insertBefore(card, pulse.nextSibling);
      else sections.prepend(card);
    }
    renderCard();
  }

  function wrapSetEnergy() {
    const orig = window.setEnergy;
    if (typeof orig !== 'function' || orig._fluxEsWrapped) return;
    window.setEnergy = function (v) {
      const r = orig.apply(this, arguments);
      try {
        recordSample(v);
        renderCard();
      } catch (_) {}
      return r;
    };
    window.setEnergy._fluxEsWrapped = true;
  }

  function getPaletteCommands(q) {
    if (!enabled()) return [];
    const needle = (q || '').toLowerCase();
    const label = T('es.palette');
    const keys = 'energy peak hours schedule heavy';
    if (
      needle &&
      !label.toLowerCase().includes(needle) &&
      !keys.split(' ').some((k) => needle.includes(k))
    ) {
      return [];
    }
    return [
      {
        icon: '⚡',
        label,
        cat: 'Navigation',
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
    wrapSetEnergy();
    ensureCard();
    const origStats = window.renderStats;
    if (typeof origStats === 'function' && !origStats._fluxEsWrapped) {
      window.renderStats = function () {
        const r = origStats.apply(this, arguments);
        try {
          if (enabled()) ensureCard();
        } catch (_) {}
        return r;
      };
      window.renderStats._fluxEsWrapped = true;
    }
    return true;
  }

  window.FluxEnergyScheduling = {
    FLAG,
    enabled,
    recordSample,
    computePeakWindows,
    renderCard,
    ensureCard,
    getCloudSlice,
    applyFromCloud,
    getPaletteCommands,
    install,
  };
})();
