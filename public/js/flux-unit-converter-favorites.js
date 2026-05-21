/**
 * P25.1 — Unit converter favorites pinned near quick-add.
 * Flag: enable_unit_converter_favorites (default off).
 */
(function () {
  'use strict';

  const FLAG = 'enable_unit_converter_favorites';
  const STORE_KEY = 'flux_unit_converter_favorites_v1';
  const STRIP_ID = 'fluxUnitFavStrip';

  const STARTER = [
    { id: 's_in_cm', cat: 'length', from: 'in', to: 'cm', value: 1 },
    { id: 's_ft_m', cat: 'length', from: 'ft', to: 'm', value: 1 },
    { id: 's_lb_kg', cat: 'mass', from: 'lb', to: 'kg', value: 1 },
    { id: 's_c_f', cat: 'temperature', from: 'C', to: 'F', value: 25 },
    { id: 's_mph_kmh', cat: 'speed', from: 'mph', to: 'km/h', value: 60 },
    { id: 's_cup_ml', cat: 'volume', from: 'cup', to: 'mL', value: 1 },
  ];

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

  function uc() {
    return window.FluxUnitConverter || null;
  }

  function getStore() {
    const s = load(STORE_KEY, {});
    let favorites = Array.isArray(s.favorites) ? s.favorites.filter((f) => f && f.id) : [];
    if (!favorites.length && !s.seeded) {
      favorites = STARTER.map((x) => ({ ...x }));
      persistStore({ favorites, seeded: true });
    }
    return { favorites, seeded: !!s.seeded };
  }

  function persistStore(data) {
    save(STORE_KEY, data);
    try {
      if (typeof window.syncKey === 'function') window.syncKey('unitConverterFavorites', getCloudSlice());
    } catch (_) {}
  }

  function getCloudSlice() {
    return getStore();
  }

  function applyFromCloud(data) {
    if (!data || typeof data !== 'object') return;
    persistStore({
      favorites: Array.isArray(data.favorites) ? data.favorites : [],
      seeded: data.seeded !== false,
    });
    renderStrip();
  }

  function convertFavorite(fav) {
    const api = uc();
    if (!api?.convert || !api?.fmt) return null;
    const out = api.convert(fav.cat, fav.value, fav.from, fav.to);
    if (!isFinite(out)) return null;
    return api.fmt(out);
  }

  function chipLabel(fav) {
    const out = convertFavorite(fav);
    if (out == null) return `${fav.value} ${fav.from} → ${fav.to}`;
    return `${fav.value} ${fav.from} → ${out} ${fav.to}`;
  }

  function resultText(fav) {
    const out = convertFavorite(fav);
    if (out == null) return '';
    return `${fav.value} ${fav.from} = ${out} ${fav.to}`;
  }

  function applyToQuickAdd(text) {
    const inp = document.getElementById('quickAddInput');
    if (inp) {
      inp.value = inp.value ? `${inp.value} · ${text}` : text;
      inp.focus();
      if (typeof window.updateQuickAddPreview === 'function') window.updateQuickAddPreview(inp.value);
    }
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).catch(() => {});
    }
    toast(T('ucf.applied', { text }), 'success');
  }

  function removeFavorite(id) {
    const store = getStore();
    store.favorites = store.favorites.filter((f) => f.id !== id);
    persistStore(store);
    renderStrip();
  }

  function addFavorite(spec) {
    const api = uc();
    if (!api?.CATEGORIES?.[spec.cat]) {
      toast(T('ucf.invalid'), 'warning');
      return;
    }
    const store = getStore();
    const id = 'fav_' + Date.now();
    store.favorites.push({
      id,
      cat: spec.cat,
      from: spec.from,
      to: spec.to,
      value: parseFloat(spec.value) || 1,
    });
    persistStore(store);
    renderStrip();
    toast(T('ucf.added'), 'success');
  }

  function closePop() {
    document.getElementById('fluxUcfPop')?.remove();
  }

  function openAddPop(anchor) {
    closePop();
    const api = uc();
    if (!api?.CATEGORIES) {
      toast(T('ucf.need_converter'), 'warning');
      return;
    }
    const cats = Object.keys(api.CATEGORIES);
    const cat = cats[0];
    const units = Object.keys(api.CATEGORIES[cat].units);

    const pop = document.createElement('div');
    pop.id = 'fluxUcfPop';
    pop.className = 'flux-ucf-pop';
    pop.innerHTML = `<div style="font-size:.78rem;font-weight:800;margin-bottom:8px">${esc(T('ucf.add_title'))}</div>
<label>${esc(T('ucf.category'))}</label>
<select id="ucfPopCat">${cats.map((c) => `<option value="${esc(c)}">${esc(api.CATEGORIES[c].label)}</option>`).join('')}</select>
<label>${esc(T('ucf.from'))}</label>
<select id="ucfPopFrom">${units.map((u) => `<option value="${esc(u)}">${esc(u)}</option>`).join('')}</select>
<label>${esc(T('ucf.to'))}</label>
<select id="ucfPopTo">${units.map((u) => `<option value="${esc(u)}">${esc(u)}</option>`).join('')}</select>
<label>${esc(T('ucf.value'))}</label>
<input type="number" id="ucfPopVal" value="1" step="any" />
<div class="flux-ucf-pop-actions">
  <button type="button" class="btn-sec" id="ucfPopSave">${esc(T('ucf.save'))}</button>
  <button type="button" class="btn-sec" id="ucfPopCancel">${esc(T('ucf.cancel'))}</button>
</div>`;

    document.body.appendChild(pop);
    const rect = anchor?.getBoundingClientRect?.();
    if (rect) {
      pop.style.left = Math.min(rect.left, window.innerWidth - 260) + 'px';
      pop.style.top = rect.bottom + 8 + 'px';
    } else {
      pop.style.left = '50%';
      pop.style.top = '40%';
      pop.style.transform = 'translateX(-50%)';
    }

    function refreshUnits() {
      const c = pop.querySelector('#ucfPopCat')?.value;
      const u = Object.keys(api.CATEGORIES[c]?.units || {});
      const fromSel = pop.querySelector('#ucfPopFrom');
      const toSel = pop.querySelector('#ucfPopTo');
      if (!fromSel || !toSel) return;
      fromSel.innerHTML = u.map((x) => `<option value="${esc(x)}">${esc(x)}</option>`).join('');
      toSel.innerHTML = u.map((x) => `<option value="${esc(x)}">${esc(x)}</option>`).join('');
      if (u.length > 1) toSel.selectedIndex = 1;
    }

    pop.querySelector('#ucfPopCat')?.addEventListener('change', refreshUnits);
    pop.querySelector('#ucfPopSave')?.addEventListener('click', () => {
      addFavorite({
        cat: pop.querySelector('#ucfPopCat')?.value,
        from: pop.querySelector('#ucfPopFrom')?.value,
        to: pop.querySelector('#ucfPopTo')?.value,
        value: pop.querySelector('#ucfPopVal')?.value,
      });
      closePop();
    });
    pop.querySelector('#ucfPopCancel')?.addEventListener('click', closePop);
    setTimeout(() => {
      document.addEventListener(
        'click',
        function onOut(e) {
          if (!pop.contains(e.target)) {
            closePop();
            document.removeEventListener('click', onOut);
          }
        },
        { once: true },
      );
    }, 0);
  }

  function openManagePop() {
    closePop();
    const store = getStore();
    const pop = document.createElement('div');
    pop.id = 'fluxUcfPop';
    pop.className = 'flux-ucf-pop';
    pop.style.maxWidth = '320px';
    pop.innerHTML = `<div style="font-size:.78rem;font-weight:800;margin-bottom:8px">${esc(T('ucf.manage_title'))}</div>
<div style="max-height:200px;overflow-y:auto">${store.favorites
      .map(
        (f) => `<div style="display:flex;justify-content:space-between;gap:8px;align-items:center;padding:6px 0;border-bottom:1px solid var(--border2)">
  <span style="font-size:.68rem;font-family:'JetBrains Mono',monospace">${esc(chipLabel(f))}</span>
  <button type="button" class="btn-sec" data-ucf-del="${esc(f.id)}" style="padding:2px 8px;font-size:.62rem">${esc(T('ucf.remove'))}</button>
</div>`,
      )
      .join('')}</div>
<button type="button" class="btn-sec" id="ucfPopClose" style="margin-top:10px;width:100%">${esc(T('ucf.close'))}</button>`;
    document.body.appendChild(pop);
    pop.style.left = '50%';
    pop.style.top = '35%';
    pop.style.transform = 'translateX(-50%)';
    pop.querySelectorAll('[data-ucf-del]').forEach((btn) => {
      btn.addEventListener('click', () => {
        removeFavorite(btn.getAttribute('data-ucf-del'));
        closePop();
        openManagePop();
      });
    });
    pop.querySelector('#ucfPopClose')?.addEventListener('click', closePop);
  }

  function renderStrip() {
    if (!enabled()) {
      document.getElementById(STRIP_ID)?.remove();
      return;
    }
    const panel = document.getElementById('quickAddPanel');
    if (!panel) return;

    let strip = document.getElementById(STRIP_ID);
    if (!strip) {
      strip = document.createElement('div');
      strip.id = STRIP_ID;
      strip.className = 'flux-ucf-strip';
      strip.setAttribute('role', 'region');
      strip.setAttribute('aria-label', T('ucf.aria'));
      const hint = panel.querySelector('.quick-add-hint');
      if (hint) hint.insertAdjacentElement('beforebegin', strip);
      else panel.appendChild(strip);
    }

    const { favorites } = getStore();
    const chips = favorites
      .map(
        (f) =>
          `<button type="button" class="flux-ucf-chip" data-ucf-id="${esc(f.id)}" title="${esc(resultText(f))}">${esc(chipLabel(f))}</button>`,
      )
      .join('');

    strip.innerHTML = `${chips}
<button type="button" class="flux-ucf-add" id="fluxUcfAdd">+ ${esc(T('ucf.add'))}</button>
<button type="button" class="flux-ucf-manage" id="fluxUcfManage">${esc(T('ucf.manage'))}</button>`;

    strip.querySelectorAll('[data-ucf-id]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const fav = getStore().favorites.find((f) => f.id === btn.getAttribute('data-ucf-id'));
        if (fav) applyToQuickAdd(resultText(fav));
      });
    });
    strip.querySelector('#fluxUcfAdd')?.addEventListener('click', (e) => {
      e.stopPropagation();
      openAddPop(e.currentTarget);
    });
    strip.querySelector('#fluxUcfManage')?.addEventListener('click', (e) => {
      e.stopPropagation();
      openManagePop();
    });
  }

  function wrapQuickAdd() {
    const origOpen = window.openQuickAdd;
    if (typeof origOpen !== 'function' || origOpen._fluxUcfWrapped) return;
    window.openQuickAdd = function () {
      const r = origOpen.apply(this, arguments);
      try {
        if (enabled()) renderStrip();
      } catch (_) {}
      return r;
    };
    window.openQuickAdd._fluxUcfWrapped = true;
  }

  function getPaletteCommands(q) {
    if (!enabled()) return [];
    const needle = (q || '').toLowerCase();
    const label = T('ucf.palette');
    const keys = 'unit convert favorite conversion metric imperial';
    if (
      needle &&
      !label.toLowerCase().includes(needle) &&
      !keys.split(' ').some((k) => needle.includes(k))
    ) {
      return [];
    }
    return [
      {
        icon: '🔁',
        label,
        cat: 'Actions',
        action: () => {
          if (typeof window.closeCommandPalette === 'function') window.closeCommandPalette();
          if (typeof window.openQuickAdd === 'function') window.openQuickAdd();
          setTimeout(() => renderStrip(), 100);
        },
      },
    ];
  }

  function install() {
    if (!enabled()) {
      document.getElementById(STRIP_ID)?.remove();
      return false;
    }
    wrapQuickAdd();
    renderStrip();
    return true;
  }

  window.FluxUnitConverterFavorites = {
    FLAG,
    enabled,
    getStore,
    chipLabel,
    resultText,
    addFavorite,
    removeFavorite,
    renderStrip,
    getCloudSlice,
    applyFromCloud,
    getPaletteCommands,
    install,
  };
})();
