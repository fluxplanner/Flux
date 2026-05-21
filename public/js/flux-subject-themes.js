/**
 * P12.6 — Per-subject color themes + icon packs (export/import JSON).
 * Flag: enable_subject_theme_packs (default off).
 */
(function () {
  'use strict';

  const FLAG = 'enable_subject_theme_packs';
  const STORE_KEY = 'flux_subject_theme_pack_v1';
  const PACK_VERSION = 1;

  const ICON_ROTATION = ['📘', '📗', '📙', '📕', '🔬', '🧮', '🌍', '🎨', '💻', '🎵', '⚗️', '📐'];

  const PRESETS = {
    vivid: {
      name: 'Vivid',
      palette: ['#6366f1', '#f43f5e', '#10d9a0', '#fbbf24', '#3b82f6', '#c084fc', '#fb923c', '#e879f9'],
      icons: ICON_ROTATION,
    },
    pastel: {
      name: 'Pastel STEM',
      rules: [
        { match: /bio|life|anat/i, color: '#6ee7b7', icon: '🧬' },
        { match: /chem/i, color: '#fcd34d', icon: '⚗️' },
        { match: /phys|engineer/i, color: '#93c5fd', icon: '⚛️' },
        { match: /math|calc|stat/i, color: '#c4b5fd', icon: '📐' },
        { match: /hist|social/i, color: '#fdba74', icon: '🏛️' },
        { match: /english|lit|lang|span|french/i, color: '#f9a8d4', icon: '📝' },
        { match: /cs|comp|code/i, color: '#67e8f9', icon: '💻' },
        { match: /art|music|drama/i, color: '#f472b6', icon: '🎨' },
      ],
      palette: ['#a5b4fc', '#fda4af', '#86efac', '#fde68a', '#7dd3fc', '#d8b4fe'],
      icons: ICON_ROTATION,
    },
    ocean: {
      name: 'Deep Ocean',
      palette: ['#0ea5e9', '#0284c7', '#0369a1', '#14b8a6', '#0891b2', '#2563eb', '#1d4ed8', '#155e75'],
      icons: ['🌊', '🐚', '⚓', '🧭', '🐟', '🏝️', '⛵', '🦈'],
    },
    mono: {
      name: 'Monochrome',
      palette: ['#94a3b8', '#64748b', '#475569', '#334155', '#78716c', '#57534e'],
      icons: ['◆', '◇', '○', '●', '▪', '▫'],
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

  function classList() {
    return typeof window.classes !== 'undefined' && Array.isArray(window.classes) ? window.classes : load('flux_classes', []);
  }

  function cleanName(name) {
    if (typeof window.cleanClassName === 'function') return window.cleanClassName(name);
    return String(name || '').trim();
  }

  function getStore() {
    const s = load(STORE_KEY, {});
    return s && typeof s === 'object' ? s : {};
  }

  function saveStore(patch) {
    const next = { ...getStore(), ...patch, updatedAt: Date.now() };
    save(STORE_KEY, next);
    try {
      if (typeof window.syncKey === 'function') window.syncKey('subjectThemePack', next);
    } catch (_) {}
    return next;
  }

  function applyFromCloud(data) {
    if (!data || typeof data !== 'object') return;
    save(STORE_KEY, data);
  }

  function getCloudSlice() {
    return getStore();
  }

  function matchRule(name, rule) {
    if (!rule || !name) return false;
    const n = cleanName(name);
    if (rule.match instanceof RegExp) return rule.match.test(n);
    if (typeof rule.match === 'string') return new RegExp(rule.match, 'i').test(n);
    if (typeof rule.name === 'string') return n.toLowerCase() === rule.name.toLowerCase();
    return false;
  }

  function styleForClass(cls, index, preset) {
    const name = cleanName(cls.name);
    let color = null;
    let icon = null;
    if (preset.rules) {
      for (const rule of preset.rules) {
        if (matchRule(name, rule)) {
          color = rule.color;
          icon = rule.icon;
          break;
        }
      }
    }
    if (!color && preset.palette?.length) color = preset.palette[index % preset.palette.length];
    if (!icon && preset.icons?.length) icon = preset.icons[index % preset.icons.length];
    return { color, icon };
  }

  function persistClasses(list) {
    if (typeof window.classes !== 'undefined') window.classes = list;
    save('flux_classes', list);
    try {
      if (typeof window.populateSubjectSelects === 'function') window.populateSubjectSelects();
      if (typeof window.renderSchool === 'function') window.renderSchool();
      if (typeof window.renderTasks === 'function') window.renderTasks();
      if (typeof window.renderCalendar === 'function') window.renderCalendar();
      if (typeof window.syncKey === 'function') window.syncKey('classes', list);
    } catch (_) {}
  }

  function applyPreset(presetId) {
    const preset = PRESETS[presetId];
    if (!preset) return false;
    const list = classList().slice();
    list.forEach((c, i) => {
      if (!c || !c.name) return;
      const st = styleForClass(c, i, preset);
      if (st.color) c.color = st.color;
      if (st.icon) c.icon = st.icon;
    });
    persistClasses(list);
    saveStore({ activePreset: presetId, customPack: null });
    toast(T('theme.applied', { name: preset.name }), 'success');
    renderSettingsCard();
    return true;
  }

  function exportPack(name) {
    const list = classList();
    return {
      version: PACK_VERSION,
      name: name || T('theme.export_default'),
      exportedAt: new Date().toISOString(),
      activePreset: getStore().activePreset || null,
      classes: list.map((c) => ({
        id: c.id,
        name: cleanName(c.name),
        rawName: c.name,
        color: c.color || '',
        icon: c.icon || '',
      })),
    };
  }

  function validatePack(data) {
    if (!data || typeof data !== 'object') return { ok: false, error: T('theme.invalid') };
    if (data.version != null && Number(data.version) !== PACK_VERSION) return { ok: false, error: T('theme.version') };
    if (!Array.isArray(data.classes) || !data.classes.length) return { ok: false, error: T('theme.empty') };
    return { ok: true };
  }

  function importPack(data) {
    const v = validatePack(data);
    if (!v.ok) {
      toast(v.error, 'error');
      return false;
    }
    const list = classList().slice();
    let applied = 0;
    data.classes.forEach((entry) => {
      let cls = null;
      if (entry.id != null) cls = list.find((c) => String(c.id) === String(entry.id));
      if (!cls && entry.name) {
        const n = String(entry.name).toLowerCase();
        cls = list.find((c) => cleanName(c.name).toLowerCase() === n);
      }
      if (!cls && entry.rawName) {
        cls = list.find((c) => String(c.name) === String(entry.rawName));
      }
      if (!cls) return;
      if (entry.color) cls.color = entry.color;
      if (entry.icon != null) cls.icon = entry.icon;
      applied += 1;
    });
    if (!applied) {
      toast(T('theme.no_match'), 'warning');
      return false;
    }
    persistClasses(list);
    saveStore({
      activePreset: null,
      customPack: {
        version: PACK_VERSION,
        name: data.name || T('theme.imported'),
        importedAt: Date.now(),
      },
    });
    toast(T('theme.import_ok', { n: applied }), 'success');
    renderSettingsCard();
    return true;
  }

  function downloadJson() {
    const pack = exportPack();
    const blob = new Blob([JSON.stringify(pack, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'flux-subject-theme.json';
    a.click();
    URL.revokeObjectURL(url);
    toast(T('theme.exported'), 'info');
  }

  function triggerImport() {
    const input = document.getElementById('fluxThemePackFile');
    if (input) input.click();
  }

  function onImportFile(ev) {
    const file = ev.target?.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(String(reader.result || ''));
        importPack(data);
      } catch (_) {
        toast(T('theme.parse_error'), 'error');
      }
      ev.target.value = '';
    };
    reader.readAsText(file);
  }

  function enrich(subjs) {
    if (!enabled() || !subjs) return subjs;
    const list = classList();
    list.forEach((c, i) => {
      if (!c || !c.name) return;
      const key = 'CLS' + (c.id || i);
      if (!subjs[key]) return;
      if (c.icon) subjs[key].icon = c.icon;
    });
    return subjs;
  }

  function renderSettingsCard() {
    const pane = document.getElementById('spane-appearance');
    if (!pane || !enabled()) {
      document.getElementById('fluxSubjectThemesCard')?.remove();
      return;
    }

    let card = document.getElementById('fluxSubjectThemesCard');
    if (!card) {
      card = document.createElement('div');
      card.id = 'fluxSubjectThemesCard';
      card.className = 'card flux-subject-themes-card';
      const themesCard = pane.querySelector('.card h3')?.closest('.card');
      const anchor = Array.from(pane.querySelectorAll('.card')).find((el) => {
        const h = el.querySelector('h3');
        return h && h.textContent.trim() === 'Themes';
      });
      if (anchor) anchor.insertAdjacentElement('beforebegin', card);
      else pane.appendChild(card);

      if (!document.getElementById('fluxThemePackFile')) {
        const input = document.createElement('input');
        input.type = 'file';
        input.id = 'fluxThemePackFile';
        input.accept = 'application/json,.json';
        input.hidden = true;
        input.addEventListener('change', onImportFile);
        document.body.appendChild(input);
      }
    }

    const store = getStore();
    const presetOpts = Object.entries(PRESETS)
      .map(([id, p]) => `<option value="${esc(id)}"${store.activePreset === id ? ' selected' : ''}>${esc(p.name)}</option>`)
      .join('');

    const swatches = classList()
      .slice(0, 8)
      .map((c) => {
        const col = c.color || '#6366f1';
        return `<span class="flux-theme-swatch" style="background:${esc(col)}" title="${esc(cleanName(c.name))}">${c.icon ? esc(c.icon) : ''}</span>`;
      })
      .join('');

    card.innerHTML = `<h3>${esc(T('theme.title'))}</h3>
      <p class="flux-theme-lede">${esc(T('theme.lede'))}</p>
      <div class="flux-theme-swatches" aria-hidden="true">${swatches || `<span class="flux-theme-muted">${esc(T('theme.no_classes'))}</span>`}</div>
      <label class="modal-micro-label" for="fluxThemePresetSelect">${esc(T('theme.preset'))}</label>
      <select id="fluxThemePresetSelect" style="width:100%;margin:0 0 10px">${presetOpts}</select>
      <div class="flux-theme-actions">
        <button type="button" class="btn-sec" id="fluxThemeApplyPreset">${esc(T('theme.apply'))}</button>
        <button type="button" class="btn-sec" id="fluxThemeExportBtn">${esc(T('theme.export'))}</button>
        <button type="button" class="btn-sec" id="fluxThemeImportBtn">${esc(T('theme.import'))}</button>
      </div>
      <p class="flux-theme-meta">${store.customPack?.name ? esc(T('theme.active_custom', { name: store.customPack.name })) : store.activePreset ? esc(T('theme.active_preset', { name: PRESETS[store.activePreset]?.name || store.activePreset })) : esc(T('theme.active_none'))}</p>`;

    card.querySelector('#fluxThemeApplyPreset')?.addEventListener('click', () => {
      const id = card.querySelector('#fluxThemePresetSelect')?.value;
      if (id) applyPreset(id);
    });
    card.querySelector('#fluxThemeExportBtn')?.addEventListener('click', downloadJson);
    card.querySelector('#fluxThemeImportBtn')?.addEventListener('click', triggerImport);
  }

  function install() {
    if (!enabled()) return false;
    renderSettingsCard();
    const origSwitch = window.switchStab;
    if (typeof origSwitch === 'function' && !origSwitch._fluxThemeWrapped) {
      window.switchStab = function (id, btn) {
        origSwitch.apply(this, arguments);
        if (id === 'appearance') setTimeout(renderSettingsCard, 40);
      };
      window.switchStab._fluxThemeWrapped = true;
    }
    return true;
  }

  window.FluxSubjectThemes = {
    FLAG,
    enabled,
    enrich,
    exportPack,
    importPack,
    applyPreset,
    downloadJson,
    renderSettingsCard,
    getCloudSlice,
    applyFromCloud,
    install,
  };
})();
