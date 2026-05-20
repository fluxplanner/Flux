/**
 * P10-STORAGE-REPAIR — detect and fix corrupt JSON in planner localStorage keys.
 * Flag: enable_storage_repair (default off).
 */
(function () {
  'use strict';

  const FLAG = 'enable_storage_repair';
  const LOG_KEY = 'flux_storage_repair_log_v1';
  const SESSION_KEY = 'flux_storage_repair_scanned_v1';

  const TARGETS = [
    { key: 'tasks', def: [], type: 'array' },
    { key: 'flux_notes', def: [], type: 'array' },
    { key: 'flux_events', def: [], type: 'array' },
    { key: 'flux_classes', def: [], type: 'array' },
    { key: 'flux_settings', def: {}, type: 'object' },
    { key: 'flux_journal_lines', def: {}, type: 'object' },
    { key: 'flux_dashboard_hidden_sections_v1', def: [], type: 'array' },
    { key: 'flux_layout_dashboard_v1', def: [], type: 'array' },
    { key: 'flux_quick_add_history', def: [], type: 'array' },
    { key: 'flux_dna', def: [], type: 'array' },
  ];

  function enabled() {
    try {
      return !!window.FluxFeatureFlags?.isEnabled(FLAG, false);
    } catch (_) {
      return false;
    }
  }

  function namespacedKey(logical) {
    try {
      if (typeof window.fluxNamespacedKey === 'function') return window.fluxNamespacedKey(logical);
    } catch (_) {}
    return logical;
  }

  function T(key, vars) {
    if (typeof window.fluxT === 'function') return window.fluxT(key, vars);
    return key;
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function loadLog() {
    try {
      const raw = localStorage.getItem(LOG_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (_) {
      return [];
    }
  }

  function saveLog(entries) {
    try {
      localStorage.setItem(LOG_KEY, JSON.stringify((entries || []).slice(-30)));
    } catch (_) {}
  }

  function salvageJson(raw, type) {
    if (!raw || typeof raw !== 'string') return null;
    const t = raw.trim();
    if (!t) return null;
    try {
      return JSON.parse(t);
    } catch (_) {}
    const close = type === 'array' ? ']' : '}';
    const open = type === 'array' ? '[' : '{';
    if (!t.startsWith(open)) return null;
    const idx = t.lastIndexOf(close);
    if (idx > 0) {
      try {
        return JSON.parse(t.slice(0, idx + 1));
      } catch (_) {}
    }
    return null;
  }

  function validateValue(val, type) {
    if (type === 'array') return Array.isArray(val);
    if (type === 'object') return val && typeof val === 'object' && !Array.isArray(val);
    return false;
  }

  function repairKey(target) {
    const nk = namespacedKey(target.key);
    let raw = null;
    try {
      raw = localStorage.getItem(nk);
    } catch (_) {
      return { key: target.key, status: 'skip', detail: 'storage blocked' };
    }
    if (raw == null || raw === '') return { key: target.key, status: 'ok', detail: 'empty' };

    try {
      const parsed = JSON.parse(raw);
      if (validateValue(parsed, target.type)) return { key: target.key, status: 'ok', detail: 'valid' };
    } catch (_) {
      /* fall through to salvage / reset */
    }

    const salvaged = salvageJson(raw, target.type);
    if (salvaged != null && validateValue(salvaged, target.type)) {
      try {
        localStorage.setItem(nk, JSON.stringify(salvaged));
        if (typeof window.save === 'function' && nk === namespacedKey(target.key)) {
          window.save(target.key, salvaged);
        }
        return { key: target.key, status: 'repaired', detail: 'salvaged partial JSON' };
      } catch (e) {
        return { key: target.key, status: 'failed', detail: String(e.message || e) };
      }
    }

    try {
      localStorage.setItem(nk, JSON.stringify(target.def));
      if (typeof window.save === 'function') window.save(target.key, target.def);
      return { key: target.key, status: 'reset', detail: 'restored default' };
    } catch (e) {
      try {
        localStorage.removeItem(nk);
      } catch (_) {}
      return { key: target.key, status: 'removed', detail: 'cleared corrupt key' };
    }
  }

  function scanAll() {
    const results = TARGETS.map(repairKey);
    const issues = results.filter((r) => r.status !== 'ok');
    const entry = { at: Date.now(), results, issues: issues.length };
    const log = loadLog();
    log.push(entry);
    saveLog(log);
    return { results, issues: issues.length, entry };
  }

  function reloadPlannerState() {
    try {
      if (typeof window.tasks !== 'undefined' && typeof window.load === 'function') {
        window.tasks = window.load('tasks', []);
      }
      if (typeof window.renderTasks === 'function') window.renderTasks();
      if (typeof window.renderCalendar === 'function') window.renderCalendar();
      if (typeof window.renderStats === 'function') window.renderStats();
      if (typeof window.FluxPersonal?.applyAll === 'function') window.FluxPersonal.applyAll();
    } catch (_) {}
  }

  function renderSettingsCard() {
    if (!enabled()) return;
    const mount = document.getElementById('fluxStorageRepairMount');
    if (!mount) return;
    const log = loadLog();
    const last = log.length ? log[log.length - 1] : null;
    const lastDetail = last
      ? `${last.issues ? last.issues + ' issue(s)' : 'all OK'} · ${new Date(last.at).toLocaleString()}`
      : T('storage.not_scanned');
    const lastLine = T('storage.last', { detail: lastDetail });
    mount.innerHTML = `<div class="card flux-storage-repair-card">
      <h3>${esc(T('storage.title'))}</h3>
      <p style="font-size:.78rem;color:var(--muted2);margin:0 0 10px;line-height:1.55">
        ${esc(T('storage.body'))}
      </p>
      <p style="font-size:.72rem;color:var(--muted);margin:0 0 12px">${esc(lastLine)}</p>
      <button type="button" class="btn-sec" id="fluxStorageRepairBtn" style="padding:8px 14px;font-size:.82rem">${esc(T('storage.scan'))}</button>
    </div>`;
    mount.querySelector('#fluxStorageRepairBtn')?.addEventListener('click', () => {
      const { results, issues } = scanAll();
      reloadPlannerState();
      if (typeof window.renderStorageMeter === 'function') window.renderStorageMeter();
      renderSettingsCard();
      const msg = issues ? T('storage.toast_fixed', { n: issues }) : T('storage.toast_ok');
      if (typeof window.showToast === 'function') window.showToast(msg, issues ? 'warning' : 'success', 5000);
      if (issues) console.info('[FluxStorageRepair]', results);
    });
  }

  function maybeAutoScan() {
    if (!enabled()) return;
    try {
      if (sessionStorage.getItem(SESSION_KEY) === '1') return;
      sessionStorage.setItem(SESSION_KEY, '1');
    } catch (_) {
      return;
    }
    const { issues } = scanAll();
    if (issues > 0) {
      reloadPlannerState();
      if (typeof window.showToast === 'function') {
        window.showToast(
          'Flux repaired ' + issues + ' corrupt storage key' + (issues > 1 ? 's' : '') + ' on this device',
          'warning',
          6000
        );
      }
    }
  }

  function install() {
    if (!enabled()) {
      const mount = document.getElementById('fluxStorageRepairMount');
      if (mount) mount.innerHTML = '';
      return false;
    }
    renderSettingsCard();
    maybeAutoScan();
    document.addEventListener('flux-nav', (ev) => {
      if (ev.detail?.panel === 'settings') renderSettingsCard();
    });
    return true;
  }

  window.FluxStorageRepair = {
    FLAG,
    enabled,
    scanAll,
    repairKey,
    renderSettingsCard,
    install,
  };
})();
