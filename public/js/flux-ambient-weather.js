/**
 * P14.5 — Ambient dashboard: weather, sunset, outdoor study hint.
 * Flag: enable_ambient_weather (default off). Data: Open-Meteo (no API key).
 */
(function () {
  'use strict';

  const FLAG = 'enable_ambient_weather';
  const STORE_KEY = 'flux_ambient_weather_v1';
  const CACHE_KEY = 'flux_ambient_weather_cache_v1';
  const CARD_ID = 'fluxAmbientWeatherCard';
  const STALE_MS = 30 * 60 * 1000;
  const DEFAULT_LAT = 40.7128;
  const DEFAULT_LON = -74.006;
  let _fetching = false;

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

  function getPrefs() {
    const s = load(STORE_KEY, {});
    const lat = parseFloat(s.lat);
    const lon = parseFloat(s.lon);
    return {
      lat: Number.isFinite(lat) ? lat : DEFAULT_LAT,
      lon: Number.isFinite(lon) ? lon : DEFAULT_LON,
      label: s.label || T('weather.default_loc'),
    };
  }

  function persistPrefs(patch) {
    const next = { ...getPrefs(), ...patch, updatedAt: Date.now() };
    save(STORE_KEY, next);
    try {
      if (typeof window.syncKey === 'function') window.syncKey('ambientWeather', getCloudSlice());
    } catch (_) {}
    return next;
  }

  function getCloudSlice() {
    const p = getPrefs();
    return { lat: p.lat, lon: p.lon, label: p.label };
  }

  function applyFromCloud(data) {
    if (!data || typeof data !== 'object') return;
    persistPrefs(data);
    renderCard();
    void refresh(true);
  }

  function getCache() {
    const c = load(CACHE_KEY, null);
    return c && typeof c === 'object' ? c : null;
  }

  function setCache(data) {
    save(CACHE_KEY, { ...data, fetchedAt: Date.now() });
  }

  function wmoInfo(code) {
    const n = Number(code);
    if (n === 0) return { icon: '☀️', label: T('weather.clear') };
    if (n === 1) return { icon: '🌤️', label: T('weather.mainly_clear') };
    if (n === 2) return { icon: '⛅', label: T('weather.partly_cloudy') };
    if (n === 3) return { icon: '☁️', label: T('weather.overcast') };
    if (n === 45 || n === 48) return { icon: '🌫️', label: T('weather.fog') };
    if (n >= 51 && n <= 57) return { icon: '🌦️', label: T('weather.drizzle') };
    if (n >= 61 && n <= 67) return { icon: '🌧️', label: T('weather.rain') };
    if (n >= 71 && n <= 77) return { icon: '❄️', label: T('weather.snow') };
    if (n >= 80 && n <= 82) return { icon: '🌧️', label: T('weather.showers') };
    if (n >= 95) return { icon: '⛈️', label: T('weather.storm') };
    return { icon: '🌡️', label: T('weather.unknown') };
  }

  function isRainy(code) {
    const n = Number(code);
    return (n >= 51 && n <= 67) || (n >= 80 && n <= 99);
  }

  function formatSunset(iso) {
    if (!iso) return '';
    try {
      return new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
    } catch (_) {
      return '';
    }
  }

  function outdoorHint(payload) {
    const temp = payload?.current?.temperature_2m;
    const code = payload?.current?.weather_code;
    const sunsetIso = payload?.daily?.sunset?.[0];
    if (temp == null) return T('weather.hint_loading');
    if (isRainy(code)) return T('weather.hint_rain');
    if (temp < 45 || temp > 90) return T('weather.hint_temp');
    if (sunsetIso) {
      const minsLeft = (new Date(sunsetIso).getTime() - Date.now()) / 60000;
      if (minsLeft < 45) return T('weather.hint_dark');
      const clearish = [0, 1, 2].includes(Number(code));
      if (clearish && minsLeft >= 90) {
        return T('weather.hint_outdoor', { until: formatSunset(sunsetIso) });
      }
    }
    return T('weather.hint_mixed');
  }

  async function fetchWeather(lat, lon) {
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${encodeURIComponent(lat)}` +
      `&longitude=${encodeURIComponent(lon)}` +
      '&current=temperature_2m,weather_code&daily=sunset&timezone=auto&temperature_unit=fahrenheit&forecast_days=1';
    const res = await fetch(url, { credentials: 'omit' });
    if (!res.ok) throw new Error('weather_fetch_failed');
    return res.json();
  }

  async function refresh(force) {
    if (!enabled() || _fetching) return getCache();
    const cached = getCache();
    if (!force && cached?.fetchedAt && Date.now() - cached.fetchedAt < STALE_MS) {
      return cached;
    }
    _fetching = true;
    renderCard(true);
    try {
      const { lat, lon } = getPrefs();
      const data = await fetchWeather(lat, lon);
      const entry = { payload: data, lat, lon };
      setCache(entry);
      renderCard(false);
      return entry;
    } catch (_) {
      toast(T('weather.fetch_failed'), 'error');
      renderCard(false);
      return cached;
    } finally {
      _fetching = false;
    }
  }

  async function refreshIfStale() {
    if (!enabled()) return;
    await refresh(false);
  }

  function useGeolocation() {
    if (!navigator.geolocation) {
      toast(T('weather.no_geo'), 'warning');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        persistPrefs({
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
          label: T('weather.my_location'),
        });
        toast(T('weather.loc_saved'), 'success');
        void refresh(true);
      },
      () => toast(T('weather.geo_denied'), 'warning'),
      { enableHighAccuracy: false, timeout: 12000, maximumAge: 600000 },
    );
  }

  function renderCard(loading) {
    if (!enabled()) return;
    const card = document.getElementById(CARD_ID);
    if (!card) return;
    const prefs = getPrefs();
    const cached = getCache();
    const payload = cached?.payload;
    const code = payload?.current?.weather_code;
    const temp = payload?.current?.temperature_2m;
    const wmo = wmoInfo(code);
    const sunset = formatSunset(payload?.daily?.sunset?.[0]);
    const hint = payload ? outdoorHint(payload) : T('weather.hint_loading');

    card.classList.toggle('flux-aw-loading', !!loading);
    card.innerHTML = `<div class="flux-aw-row">
  <span class="flux-aw-icon" aria-hidden="true">${wmo.icon}</span>
  <div class="flux-aw-main">
    <div class="flux-aw-temp">${temp != null ? `${Math.round(temp)}°F` : '—'}</div>
    <div class="flux-aw-label">${esc(wmo.label)} · ${esc(prefs.label)}</div>
    <div class="flux-aw-meta">${sunset ? esc(T('weather.sunset', { time: sunset })) : esc(T('weather.sunset_unknown'))}</div>
    <div class="flux-aw-hint">${esc(hint)}</div>
    <div class="flux-aw-actions">
      <button type="button" class="btn-sec" id="fluxAwRefresh">${esc(T('weather.refresh'))}</button>
      <button type="button" class="btn-sec" id="fluxAwGeo">${esc(T('weather.use_geo'))}</button>
      <button type="button" class="btn-sec" id="fluxAwEditLoc">${esc(T('weather.edit_loc'))}</button>
    </div>
    <div class="flux-aw-loc-form" id="fluxAwLocForm">
      <input type="text" id="fluxAwLat" placeholder="Lat" value="${prefs.lat}" />
      <input type="text" id="fluxAwLon" placeholder="Lon" value="${prefs.lon}" />
      <button type="button" class="btn-sec" id="fluxAwSaveLoc">${esc(T('weather.save_loc'))}</button>
    </div>
  </div>
</div>`;

    card.querySelector('#fluxAwRefresh')?.addEventListener('click', () => void refresh(true));
    card.querySelector('#fluxAwGeo')?.addEventListener('click', useGeolocation);
    card.querySelector('#fluxAwEditLoc')?.addEventListener('click', () => {
      card.querySelector('#fluxAwLocForm')?.classList.toggle('is-open');
    });
    card.querySelector('#fluxAwSaveLoc')?.addEventListener('click', () => {
      const lat = parseFloat(document.getElementById('fluxAwLat')?.value);
      const lon = parseFloat(document.getElementById('fluxAwLon')?.value);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
        toast(T('weather.invalid_loc'), 'warning');
        return;
      }
      persistPrefs({ lat, lon, label: T('weather.custom_loc') });
      toast(T('weather.loc_saved'), 'success');
      void refresh(true);
    });
  }

  function ensureCard() {
    if (!enabled()) {
      document.getElementById(CARD_ID)?.remove();
      return;
    }
    const dash = document.getElementById('dashboard');
    const hero = document.getElementById('dashHero');
    if (!dash || !hero) return;
    let card = document.getElementById(CARD_ID);
    if (!card) {
      card = document.createElement('div');
      card.id = CARD_ID;
      card.className = 'flux-ambient-weather-card';
      card.setAttribute('role', 'region');
      card.setAttribute('aria-label', T('weather.aria'));
      hero.insertAdjacentElement('afterend', card);
    }
    renderCard(false);
  }

  function getPaletteCommands(q) {
    if (!enabled()) return [];
    const needle = (q || '').toLowerCase();
    const label = T('weather.palette');
    const keys = 'weather ambient outdoor sunset forecast';
    if (
      needle &&
      !label.toLowerCase().includes(needle) &&
      !keys.split(' ').some((k) => needle.includes(k))
    ) {
      return [];
    }
    return [
      {
        icon: '🌤️',
        label,
        cat: 'Navigation',
        action: () => {
          if (typeof window.closeCommandPalette === 'function') window.closeCommandPalette();
          if (typeof window.nav === 'function') window.nav('dashboard');
          setTimeout(() => {
            ensureCard();
            void refresh(true);
          }, 150);
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
    void refreshIfStale();
    const origStats = window.renderStats;
    if (typeof origStats === 'function' && !origStats._fluxAwWrapped) {
      window.renderStats = function () {
        const r = origStats.apply(this, arguments);
        try {
          if (enabled()) {
            ensureCard();
            void refreshIfStale();
          }
        } catch (_) {}
        return r;
      };
      window.renderStats._fluxAwWrapped = true;
    }
    return true;
  }

  window.FluxAmbientWeather = {
    FLAG,
    enabled,
    getPrefs,
    refresh,
    refreshIfStale,
    renderCard,
    ensureCard,
    getCloudSlice,
    applyFromCloud,
    getPaletteCommands,
    install,
  };
})();
