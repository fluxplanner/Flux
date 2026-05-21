/**
 * P13.6 — Pomodoro presets saved per subject (work + short break minutes).
 * Flag: enable_pomodoro_subject_presets (default off).
 */
(function () {
  'use strict';

  const FLAG = 'enable_pomodoro_subject_presets';
  const STORE_KEY = 'flux_pomodoro_presets_v1';
  const BAR_ID = 'fluxPomoPresetBar';

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
    return s && typeof s === 'object' ? s : { bySubject: {} };
  }

  function persistStore(data) {
    save(STORE_KEY, data);
    try {
      if (typeof window.syncKey === 'function') window.syncKey('pomodoroPresets', data);
    } catch (_) {}
  }

  function applyFromCloud(data) {
    if (!data || typeof data !== 'object') return;
    save(STORE_KEY, data);
    renderBar();
  }

  function getCloudSlice() {
    return getStore();
  }

  function subjectLabel(key) {
    if (!key) return T('pomo.no_subject');
    const subjs = typeof window.getSubjects === 'function' ? window.getSubjects() : {};
    const s = subjs[key];
    return s ? s.name || s.short || key : key;
  }

  function readInputs() {
    const work = parseInt(document.getElementById('customWork')?.value, 10);
    const short = parseInt(document.getElementById('customShort')?.value, 10);
    return {
      work: Number.isFinite(work) ? Math.min(90, Math.max(1, work)) : 25,
      short: Number.isFinite(short) ? Math.min(30, Math.max(1, short)) : 5,
    };
  }

  function applyMinutes(work, short) {
    const workEl = document.getElementById('customWork');
    const shortEl = document.getElementById('customShort');
    if (workEl) workEl.value = String(work);
    if (shortEl) shortEl.value = String(short);
    if (typeof window.updateTLengths === 'function') window.updateTLengths();
  }

  function applyPreset(subjectKey, quiet) {
    if (!enabled() || !subjectKey) return false;
    const preset = getStore().bySubject?.[subjectKey];
    if (!preset) return false;
    applyMinutes(preset.work || 25, preset.short || 5);
    if (!quiet) toast(T('pomo.applied', { name: subjectLabel(subjectKey), work: preset.work }), 'info');
    return true;
  }

  function savePresetForSubject(subjectKey) {
    if (!subjectKey) {
      toast(T('pomo.pick_subject'), 'warning');
      return false;
    }
    const mins = readInputs();
    const store = getStore();
    const bySubject = { ...(store.bySubject || {}) };
    bySubject[subjectKey] = { ...mins, updatedAt: Date.now() };
    persistStore({ ...store, bySubject });
    renderBar();
    toast(T('pomo.saved', { name: subjectLabel(subjectKey), work: mins.work }), 'success');
    return true;
  }

  function removePreset(subjectKey) {
    const store = getStore();
    const bySubject = { ...(store.bySubject || {}) };
    delete bySubject[subjectKey];
    persistStore({ ...store, bySubject });
    renderBar();
    toast(T('pomo.removed'), 'info');
  }

  function renderBar() {
    const sel = document.getElementById('timerSubject');
    const anchor = sel?.closest('div');
    if (!anchor || !enabled()) {
      document.getElementById(BAR_ID)?.remove();
      return;
    }

    let bar = document.getElementById(BAR_ID);
    if (!bar) {
      bar = document.createElement('div');
      bar.id = BAR_ID;
      bar.className = 'flux-pomo-preset-bar';
      anchor.insertAdjacentElement('afterend', bar);
    }

    const store = getStore();
    const bySubject = store.bySubject || {};
    const entries = Object.entries(bySubject);
    const active = sel.value || '';

    const chips = entries.length
      ? entries
          .map(([key, p]) => {
            const on = key === active ? ' flux-pomo-chip--active' : '';
            return `<button type="button" class="flux-pomo-chip${on}" onclick="FluxPomodoroPresets.selectSubject(${JSON.stringify(key)})" title="${esc(subjectLabel(key))} · ${p.work}/${p.short}m">
            <span class="flux-pomo-chip-label">${esc(subjectLabel(key).slice(0, 14))}</span>
            <span class="flux-pomo-chip-mins">${p.work}m</span>
            <span class="flux-pomo-chip-x" onclick="event.stopPropagation();FluxPomodoroPresets.removePreset(${JSON.stringify(key)})" aria-label="${esc(T('pomo.remove'))}">×</span>
          </button>`;
          })
          .join('')
      : `<span class="flux-pomo-muted">${esc(T('pomo.none'))}</span>`;

    const activePreset = active && bySubject[active];

    bar.innerHTML = `<div class="flux-pomo-preset-head">
      <span class="flux-pomo-preset-title">${esc(T('pomo.title'))}</span>
      <button type="button" class="btn-sec flux-pomo-save-btn" onclick="FluxPomodoroPresets.saveCurrent()">${esc(T('pomo.save'))}</button>
    </div>
    <p class="flux-pomo-lede">${esc(T('pomo.lede'))}</p>
    <div class="flux-pomo-chip-row">${chips}</div>
    ${active ? `<p class="flux-pomo-active-meta">${activePreset ? esc(T('pomo.active_saved', { work: activePreset.work, short: activePreset.short })) : esc(T('pomo.active_unsaved'))}</p>` : ''}`;
  }

  function selectSubject(key) {
    const sel = document.getElementById('timerSubject');
    if (sel) sel.value = key;
    applyPreset(key);
    renderBar();
  }

  function saveCurrent() {
    const key = document.getElementById('timerSubject')?.value || '';
    savePresetForSubject(key);
  }

  function bindSubjectSelect() {
    const sel = document.getElementById('timerSubject');
    if (!sel || sel._fluxPomoBound) return;
    sel.addEventListener('change', () => {
      if (enabled()) {
        applyPreset(sel.value, true);
        renderBar();
      }
    });
    sel._fluxPomoBound = true;
  }

  function wrapTaskTimer() {
    const orig = window.startTimerFromTask;
    if (typeof orig !== 'function' || orig._fluxPomoWrapped) return;
    window.startTimerFromTask = function (id) {
      const tasks = typeof window.tasks !== 'undefined' ? window.tasks : [];
      const t = tasks.find((x) => String(x.id) === String(id));
      const r = orig.apply(this, arguments);
      if (enabled() && t) {
        setTimeout(() => {
          if (t.subject && applyPreset(t.subject, true)) return;
          if (t.estTime) {
            const m = Math.min(90, Math.max(5, Math.round(t.estTime / 5) * 5));
            applyMinutes(m, readInputs().short);
          }
        }, 260);
      }
      return r;
    };
    window.startTimerFromTask._fluxPomoWrapped = true;
  }

  function install() {
    if (!enabled()) {
      document.getElementById(BAR_ID)?.remove();
      return false;
    }
    bindSubjectSelect();
    wrapTaskTimer();
    renderBar();
    const origPop = window.populateSubjectSelects;
    if (typeof origPop === 'function' && !origPop._fluxPomoWrapped) {
      window.populateSubjectSelects = function () {
        const r = origPop.apply(this, arguments);
        try {
          renderBar();
        } catch (_) {}
        return r;
      };
      window.populateSubjectSelects._fluxPomoWrapped = true;
    }
    const origNav = window.nav;
    if (typeof origNav === 'function' && !origNav._fluxPomoPresetWrapped) {
      window.nav = function (id) {
        const r = origNav.apply(this, arguments);
        if (id === 'timer') setTimeout(() => {
          bindSubjectSelect();
          renderBar();
        }, 50);
        return r;
      };
      window.nav._fluxPomoPresetWrapped = true;
    }
    return true;
  }

  window.FluxPomodoroPresets = {
    FLAG,
    enabled,
    applyPreset,
    savePresetForSubject,
    saveCurrent,
    removePreset,
    selectSubject,
    renderBar,
    getCloudSlice,
    applyFromCloud,
    install,
  };
})();
