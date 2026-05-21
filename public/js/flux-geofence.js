/**
 * P15.3 — Geofence reminders when arriving at saved campus places.
 * Flag: enable_geofence_reminders (default off).
 */
(function () {
  'use strict';

  const FLAG = 'enable_geofence_reminders';
  const STORE_KEY = 'flux_geofence_v1';
  const CARD_ID = 'fluxGeofenceCard';
  const COOLDOWN_MS = 4 * 60 * 60 * 1000;
  const DEFAULT_RADIUS = 150;

  let _watchId = null;
  let _inside = {};

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
    const places = Array.isArray(s.places) ? s.places : [];
    return {
      watchEnabled: !!s.watchEnabled,
      places: places.filter((p) => p && p.name && Number.isFinite(parseFloat(p.lat)) && Number.isFinite(parseFloat(p.lon))),
    };
  }

  function persistStore(data) {
    save(STORE_KEY, data);
    try {
      if (typeof window.syncKey === 'function') window.syncKey('geofence', getCloudSlice());
    } catch (_) {}
  }

  function getCloudSlice() {
    const s = getStore();
    return {
      places: s.places.map((p) => ({
        id: p.id,
        name: p.name,
        lat: p.lat,
        lon: p.lon,
        radiusM: p.radiusM,
        message: p.message,
        lastTriggered: p.lastTriggered,
      })),
    };
  }

  function applyFromCloud(data) {
    if (!data || typeof data !== 'object') return;
    const local = getStore();
    persistStore({
      watchEnabled: local.watchEnabled,
      places: Array.isArray(data.places) ? data.places : local.places,
    });
    renderCard();
  }

  function distM(a, b) {
    const R = 6371000;
    const toRad = (x) => (x * Math.PI) / 180;
    const dLat = toRad(b.lat - a.lat);
    const dLon = toRad(b.lon - a.lon);
    const lat1 = toRad(a.lat);
    const lat2 = toRad(b.lat);
    const h =
      Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
  }

  function notifyArrival(place) {
    const msg = place.message || T('gf.default_msg', { place: place.name });
    toast(T('gf.arrived', { place: place.name }), 'info');
    try {
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(T('gf.notif_title', { place: place.name }), {
          body: msg,
          tag: 'flux-geofence-' + place.id,
        });
      }
    } catch (_) {}
  }

  function handlePosition(pos) {
    if (!enabled()) return;
    const store = getStore();
    if (!store.watchEnabled || !store.places.length) return;
    const here = { lat: pos.coords.latitude, lon: pos.coords.longitude };
    let changed = false;
    const nextPlaces = store.places.map((p) => ({ ...p }));

    nextPlaces.forEach((place) => {
      const r = parseInt(place.radiusM, 10) || DEFAULT_RADIUS;
      const d = distM(here, { lat: parseFloat(place.lat), lon: parseFloat(place.lon) });
      const inside = d <= r;
      const was = !!_inside[place.id];
      _inside[place.id] = inside;
      if (inside && !was) {
        const last = place.lastTriggered || 0;
        if (Date.now() - last >= COOLDOWN_MS) {
          place.lastTriggered = Date.now();
          changed = true;
          notifyArrival(place);
        }
      }
    });

    if (changed) {
      persistStore({ ...store, places: nextPlaces });
      renderCard();
    }
  }

  function stopWatch() {
    if (_watchId != null && navigator.geolocation) {
      try {
        navigator.geolocation.clearWatch(_watchId);
      } catch (_) {}
      _watchId = null;
    }
    _inside = {};
  }

  function startWatch() {
    if (!enabled() || !navigator.geolocation) return false;
    stopWatch();
    _watchId = navigator.geolocation.watchPosition(
      handlePosition,
      () => {},
      { enableHighAccuracy: false, maximumAge: 60000, timeout: 20000 },
    );
    return true;
  }

  function setWatchEnabled(on) {
    const store = getStore();
    store.watchEnabled = !!on;
    persistStore(store);
    if (store.watchEnabled) {
      if (!startWatch()) toast(T('gf.no_geo'), 'warning');
      else toast(T('gf.watch_on'), 'success');
    } else {
      stopWatch();
      toast(T('gf.watch_off'), 'info');
    }
    renderCard();
  }

  function addPlace(data) {
    const store = getStore();
    const lat = parseFloat(data.lat);
    const lon = parseFloat(data.lon);
    if (!data.name || !Number.isFinite(lat) || !Number.isFinite(lon)) {
      toast(T('gf.invalid_place'), 'warning');
      return;
    }
    store.places.push({
      id: 'gf_' + Date.now(),
      name: String(data.name).trim(),
      lat,
      lon,
      radiusM: parseInt(data.radiusM, 10) || DEFAULT_RADIUS,
      message: String(data.message || '').trim() || T('gf.default_msg_short'),
      lastTriggered: 0,
    });
    persistStore(store);
    toast(T('gf.place_saved'), 'success');
    renderCard();
  }

  function removePlace(id) {
    const store = getStore();
    store.places = store.places.filter((p) => p.id !== id);
    delete _inside[id];
    persistStore(store);
    renderCard();
  }

  function useLocationForForm() {
    if (!navigator.geolocation) {
      toast(T('gf.no_geo'), 'warning');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = document.getElementById('fluxGfLat');
        const lon = document.getElementById('fluxGfLon');
        if (lat) lat.value = String(pos.coords.latitude.toFixed(6));
        if (lon) lon.value = String(pos.coords.longitude.toFixed(6));
        toast(T('gf.coords_set'), 'success');
      },
      () => toast(T('gf.geo_denied'), 'warning'),
      { enableHighAccuracy: true, timeout: 12000 },
    );
  }

  function checkNow() {
    if (!navigator.geolocation) {
      toast(T('gf.no_geo'), 'warning');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        handlePosition(pos);
        const store = getStore();
        const here = { lat: pos.coords.latitude, lon: pos.coords.longitude };
        if (!store.places.length) {
          toast(T('gf.no_places'), 'info');
          return;
        }
        const nearest = store.places
          .map((p) => ({
            p,
            d: distM(here, { lat: parseFloat(p.lat), lon: parseFloat(p.lon) }),
          }))
          .sort((a, b) => a.d - b.d)[0];
        toast(T('gf.nearest', { name: nearest.p.name, m: Math.round(nearest.d) }), 'info');
      },
      () => toast(T('gf.geo_denied'), 'warning'),
    );
  }

  function renderCard() {
    if (!enabled()) return;
    const card = document.getElementById(CARD_ID);
    if (!card) return;
    const store = getStore();
    const placesHtml = store.places.length
      ? store.places
          .map(
            (p) => `<div class="flux-gf-place" data-id="${esc(p.id)}">
  <div class="flux-gf-place-head"><span>${esc(p.name)}</span>
    <button type="button" class="btn-sec flux-gf-del" data-id="${esc(p.id)}" style="padding:4px 8px;font-size:.68rem">${esc(T('gf.delete'))}</button></div>
  <div class="flux-gf-meta">${esc(T('gf.place_meta', { lat: p.lat, lon: p.lon, r: p.radiusM || DEFAULT_RADIUS }))}</div>
  <div class="flux-gf-meta">${esc(p.message || '')}</div>
</div>`,
          )
          .join('')
      : `<p class="flux-gf-status">${esc(T('gf.no_places'))}</p>`;

    card.innerHTML = `<h3>${esc(T('gf.title'))}</h3>
<p class="flux-gf-status">${esc(T('gf.lede'))}</p>
<div class="flux-gf-actions">
  <button type="button" class="btn-sec ${store.watchEnabled ? 'on' : ''}" id="fluxGfWatchToggle">${esc(store.watchEnabled ? T('gf.stop_watch') : T('gf.start_watch'))}</button>
  <button type="button" class="btn-sec" id="fluxGfCheckNow">${esc(T('gf.check_now'))}</button>
</div>
<div style="margin-top:12px">${placesHtml}</div>
<div class="flux-gf-form">
  <input type="text" id="fluxGfName" placeholder="${esc(T('gf.name_ph'))}" maxlength="80" />
  <div class="flux-gf-form-row">
    <input type="text" id="fluxGfLat" placeholder="Latitude" />
    <input type="text" id="fluxGfLon" placeholder="Longitude" />
  </div>
  <div class="flux-gf-form-row">
    <input type="number" id="fluxGfRadius" placeholder="${esc(T('gf.radius_ph'))}" min="50" max="500" value="${DEFAULT_RADIUS}" />
    <input type="text" id="fluxGfMessage" placeholder="${esc(T('gf.msg_ph'))}" maxlength="120" />
  </div>
  <div class="flux-gf-actions">
    <button type="button" class="btn-sec" id="fluxGfUseLoc">${esc(T('gf.use_loc'))}</button>
    <button type="button" id="fluxGfAdd">${esc(T('gf.add_place'))}</button>
  </div>
</div>
<p class="flux-gf-status">${esc(store.watchEnabled ? T('gf.status_watch') : T('gf.status_off'))}</p>`;

    card.querySelector('#fluxGfWatchToggle')?.addEventListener('click', () => setWatchEnabled(!store.watchEnabled));
    card.querySelector('#fluxGfCheckNow')?.addEventListener('click', checkNow);
    card.querySelector('#fluxGfUseLoc')?.addEventListener('click', useLocationForForm);
    card.querySelector('#fluxGfAdd')?.addEventListener('click', () => {
      addPlace({
        name: document.getElementById('fluxGfName')?.value,
        lat: document.getElementById('fluxGfLat')?.value,
        lon: document.getElementById('fluxGfLon')?.value,
        radiusM: document.getElementById('fluxGfRadius')?.value,
        message: document.getElementById('fluxGfMessage')?.value,
      });
    });
    card.querySelectorAll('.flux-gf-del').forEach((btn) => {
      btn.addEventListener('click', () => removePlace(btn.getAttribute('data-id')));
    });
  }

  function ensureCard() {
    if (!enabled()) {
      stopWatch();
      document.getElementById(CARD_ID)?.remove();
      return;
    }
    const pane = document.getElementById('spane-notifications');
    if (!pane || document.getElementById(CARD_ID)) {
      renderCard();
      return;
    }
    const card = document.createElement('div');
    card.id = CARD_ID;
    card.className = 'card';
    const alerts = pane.querySelector('.card');
    if (alerts && alerts.nextSibling) pane.insertBefore(card, alerts.nextSibling);
    else pane.prepend(card);
    renderCard();
    if (getStore().watchEnabled) startWatch();
  }

  function getPaletteCommands(q) {
    if (!enabled()) return [];
    const needle = (q || '').toLowerCase();
    const label = T('gf.palette');
    const keys = 'geofence location campus library arrive';
    if (
      needle &&
      !label.toLowerCase().includes(needle) &&
      !keys.split(' ').some((k) => needle.includes(k))
    ) {
      return [];
    }
    return [
      {
        icon: '📍',
        label,
        cat: 'Navigation',
        action: () => {
          if (typeof window.closeCommandPalette === 'function') window.closeCommandPalette();
          if (typeof window.nav === 'function') window.nav('settings');
          if (typeof window.switchStab === 'function') {
            const btn = document.querySelector('.stab[onclick*="notifications"]');
            window.switchStab('notifications', btn);
          }
          setTimeout(() => ensureCard(), 200);
        },
      },
    ];
  }

  function install() {
    if (!enabled()) {
      stopWatch();
      document.getElementById(CARD_ID)?.remove();
      return false;
    }
    ensureCard();
    const origNav = window.nav;
    if (typeof origNav === 'function' && !origNav._fluxGfWrapped) {
      window.nav = function (tab) {
        const r = origNav.apply(this, arguments);
        if (tab === 'settings') setTimeout(() => ensureCard(), 80);
        return r;
      };
      window.nav._fluxGfWrapped = true;
    }
    return true;
  }

  window.FluxGeofence = {
    FLAG,
    enabled,
    getStore,
    startWatch,
    stopWatch,
    renderCard,
    ensureCard,
    getCloudSlice,
    applyFromCloud,
    getPaletteCommands,
    install,
  };
})();
