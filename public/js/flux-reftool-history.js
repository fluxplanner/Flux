/* World history map — Leaflet + theme-aware CARTO raster basemaps (dark_all / light_all), year range, regions, JSON events, Flux AI + geocode */
(function(){
  'use strict';
  const esc = window.fluxEsc || (s => String(s==null?'':s).replace(/[&<>"']/g, ch=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[ch])));

  const EPOCH_MIN = -5000;
  const EPOCH_MAX = 2030;
  /* The package's own files, not jsDelivr's on-the-fly ".min" copies: only a
     file that never changes can carry an integrity hash. leaflet.js ships minified. */
  const LEAFLET_CSS = 'https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.css';
  const LEAFLET_JS = 'https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.js';
  /* Integrity hash: the browser refuses the file if the CDN ever serves different bytes. Update it whenever the version in the URL changes. */
  const LEAFLET_SRI = { [LEAFLET_CSS]: 'sha384-sHL9NAb7lN7rfvG5lfHpm643Xkcjzp4jFvuavGOndn6pjVqS6ny56CAt3nsEVT4H', [LEAFLET_JS]: 'sha384-cxOPjt7s7Iz04uaHJceBmS+qpjv2JkIHNVcuOrM+YHwZOmJGBXI00mdUXEq65HTH' };
  const ICON_PNG = 'https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/images/marker-icon.png';
  const ICON2X = 'https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/images/marker-icon-2x.png';
  const SHADOW = 'https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/images/marker-shadow.png';

  const CONTINENTS = [
    { id: 'all', name: 'All' },
    { id: 'europe', name: 'Europe' },
    { id: 'middle_east', name: 'M. East' },
    { id: 'africa', name: 'Africa' },
    { id: 'asia', name: 'Asia' },
    { id: 'north_america', name: 'N. Am.' },
    { id: 'south_america', name: 'S. Am.' },
    { id: 'oceania', name: 'Oceania' },
    { id: 'world', name: 'Global' },
  ];

  const BOUNDS = {
    europe: { sw: [35, -25], ne: [72, 45] },
    middle_east: { sw: [10, 25], ne: [45, 65] },
    africa: { sw: [-36, -20], ne: [38, 55] },
    asia: { sw: [5, 60], ne: [55, 150] },
    north_america: { sw: [7, -170], ne: [72, -50] },
    south_america: { sw: [-56, -82], ne: [14, -34] },
    oceania: { sw: [-50, 110], ne: [0, 180] },
    world: { sw: [-60, -180], ne: [75, 180] },
  };

  const COL = {
    europe: '#4da3ff', middle_east: '#e6b84d', africa: '#6fdc8c', asia: '#ff6b6b',
    north_america: '#a78bfa', south_america: '#f472b6', oceania: '#2dd4bf', world: '#a3a3a3',
  };

  /** CARTO/OSM tiles — dark basemap matches Flux dark themes; Positron for Cloud (light). */
  function historyMapTileLayerSpec(){
    const theme = (typeof document !== 'undefined' && document.body && document.body.getAttribute('data-theme')) || 'dark';
    const light = theme === 'light';
    if (light){
      return {
        url: 'https://{s}.basemaps.cartocdn.com/rastertiles/light_all/{z}/{x}/{y}.png',
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
        maxZoom: 20,
      };
    }
    return {
      url: 'https://{s}.basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}.png',
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
      maxZoom: 19,
    };
  }

  /** Fallback if JSON fetch fails (offline) */
  const HIST_SEED = [
    { y: 1776, t: 'U.S. Declaration of Independence', s: 'Thirteen colonies assert independence from Britain.', lat: 39.95, lon: -75.15, c: 'north_america' },
    { y: 1789, t: 'French Revolution', s: 'Revolution in France with global ripple effects in politics and rights.', lat: 48.86, lon: 2.35, c: 'europe' },
    { y: 1945, t: 'End of World War II in Europe', s: 'Nazi defeat; start of a new international order and UN era.', lat: 52.52, lon: 13.41, c: 'europe' },
  ];

  function yLabel(y){
    if (y < 0) return `${Math.abs(y)} BCE`;
    if (y === 0) return '0 (BCE/CE bridge)';
    return `${y} CE`;
  }

  function loadCss(href){
    return new Promise((resolve) => {
      if (document.querySelector(`link[href="${href}"]`)) return resolve();
      const l = document.createElement('link');
      l.rel = 'stylesheet';
      l.href = href;
      if (LEAFLET_SRI[href]) { l.integrity = LEAFLET_SRI[href]; l.crossOrigin = 'anonymous'; }
      l.onload = () => resolve();
      l.onerror = () => resolve();
      document.head.appendChild(l);
    });
  }
  function loadScript(src){
    return new Promise((resolve, reject) => {
      if (window.L) return resolve(window.L);
      const s = document.createElement('script');
      s.src = src;
      s.async = true;
      if (LEAFLET_SRI[src]) { s.integrity = LEAFLET_SRI[src]; s.crossOrigin = 'anonymous'; }
      s.onload = () => resolve(window.L);
      s.onerror = () => reject(new Error('Could not load map library'));
      document.body.appendChild(s);
    });
  }

  function fixDefaultIcons(L){
    delete L.Icon.Default.prototype._getIconUrl;
    L.Icon.Default.mergeOptions({ iconUrl: ICON_PNG, iconRetinaUrl: ICON2X, shadowUrl: SHADOW });
  }

  function eventsPath(){
    try{
      return new URL('public/data/flux-history-events.json', document.baseURI).href;
    }catch(e){
      return 'public/data/flux-history-events.json';
    }
  }

  async function loadAllEvents(){
    const merged = HIST_SEED.map(e => Object.assign({}, e));
    try{
      const r = await fetch(eventsPath(), { cache: 'no-store' });
      if (r.ok){
        const j = await r.json();
        if (Array.isArray(j) && j.length){
          for (const e of j){
            if (e && typeof e.y === 'number' && e.t) merged.push(e);
          }
        }
      }
    }catch(e){ /* keep seed */ }
    const seen = new Set();
    const out = [];
    for (const e of merged){
      const k = e.y + '|' + e.t;
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(e);
    }
    return out.sort((a, b) => a.y - b.y);
  }

  function matchesContinent(e, continent){
    if (continent === 'all') return true;
    if (e.c === continent) return true;
    if (continent === 'europe' && (e.c === 'middle_east')) return false;
    return false;
  }

  function yearInRange(e, y0, y1){
    return e.y >= y0 && e.y <= y1;
  }

  function filterList(events, continent, y0, y1){
    return events.filter(e => matchesContinent(e, continent) && yearInRange(e, y0, y1));
  }

  function fitMap(L, map, continent){
    if (continent === 'all' || !BOUNDS[continent]){
      map.setView([20, 0], 2);
      return;
    }
    const b = BOUNDS[continent];
    map.fitBounds(L.latLngBounds(b.sw, b.ne), { padding: [18, 18], maxZoom: 5 });
  }

  /** Approximate map pin when AI has no coords and browser geocode fails (Nominatim CORS, etc.). */
  function centroidForRegionTag(tag){
    const b = BOUNDS[tag];
    if (!b) return null;
    return { lat: (b.sw[0] + b.ne[0]) / 2, lon: (b.sw[1] + b.ne[1]) / 2 };
  }

  /** First balanced `{ ... }` in s, respecting strings (so `}` inside summary does not truncate). */
  function sliceFirstJsonObject(s){
    const start = s.indexOf('{');
    if (start === -1) return null;
    let depth = 0;
    let inStr = false;
    let esc = false;
    for (let i = start; i < s.length; i++){
      const ch = s[i];
      if (inStr){
        if (esc){ esc = false; continue; }
        if (ch === '\\'){ esc = true; continue; }
        if (ch === '"') inStr = false;
        continue;
      }
      if (ch === '"'){ inStr = true; continue; }
      if (ch === '{') depth++;
      else if (ch === '}'){
        depth--;
        if (depth === 0) return s.slice(start, i + 1);
      }
    }
    return null;
  }

  function extractJsonObject(text){
    if (!text) return null;
    const t = String(text).replace(/\uFEFF/g, '').replace(/```(?:json)?/gi, '').replace(/```/g, '').trim();
    if (!t) return null;
    if (t.startsWith('{')){
      try{ return JSON.parse(t); }catch(e){ /* try slice */ }
    }
    const slice = sliceFirstJsonObject(t);
    if (!slice) return null;
    try{ return JSON.parse(slice); }catch(e){ return null; }
  }

  function normalizeHistoryAiObj(raw){
    if (!raw || typeof raw !== 'object') return null;
    const title = raw.title != null ? raw.title : raw.Title;
    if (title == null || String(title).trim() === '') return null;
    const o = Object.assign({}, raw);
    o.title = String(title).trim();
    if (typeof o.year === 'string' && /^-?\d+$/.test(o.year)) o.year = parseInt(o.year, 10);
    if (typeof o.lat === 'string' && o.lat.trim() !== '' && !Number.isNaN(+o.lat)) o.lat = +o.lat;
    if (typeof o.lon === 'string' && o.lon.trim() !== '' && !Number.isNaN(+o.lon)) o.lon = +o.lon;
    return o;
  }

  async function geocodePlace(name, countryHint){
    if (!name || !name.trim()) return null;
    const q = [name, countryHint].filter(Boolean).join(', ');
    const u = 'https://nominatim.openstreetmap.org/search?format=json&limit=1&' +
      new URLSearchParams({ q, 'accept-language': 'en' });
    try{
      // Nominatim often blocks browser CORS; failures are non-fatal (AI may still return lat/lon).
      const r = await fetch(u, {
        method: 'GET',
        mode: 'cors',
        headers: { Accept: 'application/json' },
      });
      if (!r.ok) return null;
      const arr = await r.json();
      if (!arr[0]) return null;
      return { lat: parseFloat(arr[0].lat), lon: parseFloat(arr[0].lon) };
    }catch(e){
      return null;
    }
  }

  const AI_SYS = 'You are a world history assistant. The user asks about a person, battle, treaty, empire, or event. Respond with one JSON object only (no markdown, no prose before or after). Keys: "title" (short), "summary" (2–4 clear sentences; use only straight double quotes inside strings or avoid inner quotes), "year" (integer; negative = BCE), "placeName" (specific place for a map pin), "countryHint" (optional string), "lat" (number or null), "lon" (number or null), "regionTag" (one of: europe, middle_east, africa, asia, north_america, south_america, oceania, world). If unsure of coordinates use null for lat and lon. The word json appears here because the API requires it.';

  async function runFluxQuery(query, state){
    if (typeof window.fluxAiSimple !== 'function') throw new Error('AI is not available. Open Flux while signed in.');
    const text = await window.fluxAiSimple(AI_SYS, 'Student question: ' + query, { responseFormat: 'json_object' });
    const obj = normalizeHistoryAiObj(extractJsonObject(text));
    if (!obj) throw new Error('Could not read AI response. Try rephrasing, or ask for one specific event or person.');
    let lat = typeof obj.lat === 'number' && isFinite(obj.lat) ? obj.lat : null;
    let lon = typeof obj.lon === 'number' && isFinite(obj.lon) ? obj.lon : null;
    const y = typeof obj.year === 'number' ? obj.year : 0;
    const tag = (obj.regionTag && COL[obj.regionTag]) ? obj.regionTag : 'world';
    if (lat == null || lon == null){
      const g = await geocodePlace(String(obj.placeName || ''), String(obj.countryHint || ''));
      if (g){ lat = g.lat; lon = g.lon; }
    }
    if (lat == null || lon == null){
      const c = centroidForRegionTag(tag);
      if (c){ lat = c.lat; lon = c.lon; }
    }
    if (lat == null || lon == null) throw new Error('Could not place this on the map. Try adding a more specific place name in your question.');
    state.aiEvent = { y, t: String(obj.title), s: String(obj.summary || ''), lat, lon, c: tag, ai: true, place: String(obj.placeName || ''), _id: -1 };
    if (typeof state._render === 'function') state._render();
    if (state.map && state.aiEvent){
      const z = Math.max(5, state.map.getZoom() < 4 ? 5 : state.map.getZoom());
      state.map.flyTo([state.aiEvent.lat, state.aiEvent.lon], z, { duration: 0.45, easeLinearity: 0.25 });
      setTimeout(() => { try{ state.aiMarker && state.aiMarker.openPopup && state.aiMarker.openPopup(); }catch(e){} }, 500);
    }
  }

  function renderHistoryMap(body, events, state, refreshList){
    const continent = state.continent;
    const y0 = state.y0;
    const y1 = state.y1;
    const list = filterList(events, continent, y0, y1);
    if (refreshList && state.listHost){
      const n = list.length;
      state.listCountEl.textContent = n + (n === 0 ? ' — widen the year range or pick All regions' : ' in range');
      state.listHost.innerHTML = list.slice().reverse().map((e) => {
        const id = e._id;
        return `<button type="button" class="hist-card${id === state.selId ? ' hist-card--on' : ''}" data-hid="${id}">
  <div class="hist-card-y">${esc(yLabel(e.y))} · ${esc(e.c || '')}</div>
  <div class="hist-card-t">${esc(e.t)}</div>
  <div class="hist-card-s">${esc(e.s || '')}</div>
</button>`;
      }).join('') || '<div class="hist-ai-err">No events in this year window for this region. Adjust sliders or type a place in Ask Flux.</div>';
      state.listHost.querySelectorAll('.hist-card').forEach(btn => {
        btn.addEventListener('click', () => {
          const hid = +btn.dataset.hid;
          const ev = list.find(x => x._id === hid);
          if (!ev || (ev.lat === 0 && ev.lon === 0)) return;
          state.selId = hid;
          if (state.map) state.map.flyTo([ev.lat, ev.lon], state.map.getZoom() < 5 ? 5 : state.map.getZoom(), { duration: 0.45 });
          state.listHost.querySelectorAll('.hist-card').forEach(c => c.classList.toggle('hist-card--on', +c.dataset.hid === state.selId));
        });
      });
    }
    if (!state.L || !state.group || !state.map) return;
    state.group.clearLayers();
    for (const e of list){
      if (e.lat === 0 && e.lon === 0) continue;
      const L = state.L;
      const col = COL[e.c] || '#888';
      const cm = L.circleMarker([e.lat, e.lon], { radius: 7, color: col, weight: 2, fillColor: col, fillOpacity: 0.45 });
      const html = `<div class="hist-pin-ai"><strong>${esc(e.t)}</strong><br><span style="color:var(--accent)">${esc(yLabel(e.y))}</span><p style="margin:6px 0 0;font-size:12px;color:var(--muted2)">${esc(e.s)}</p></div>`;
      cm.bindPopup(html);
      cm.addTo(state.group);
    }
    if (state.aiEvent){
      const e = state.aiEvent;
      const m = state.L.marker([e.lat, e.lon], { zIndexOffset: 800 });
      m.bindPopup(`<div class="hist-pin-ai"><strong>${esc(e.t)} (Flux)</strong><br><span class="hist-card-y">${esc(yLabel(e.y))}</span><p style="margin:6px 0 0;font-size:12px">${esc(e.s)}</p></div>`);
      m.addTo(state.group);
      state.aiMarker = m;
    } else {
      state.aiMarker = null;
    }
  }

  function setup(body){
    const state = {
      L: null, map: null, group: null, aiMarker: null, aiEvent: null,
      continent: 'all', y0: -3000, y1: 2026, allEvents: [], listHost: null, listCountEl: null, selId: -1, mapEl: null,
    };

    body.innerHTML = `
<div class="hist-wrap">
  <p style="margin:0;font-size:.8rem;color:var(--muted2);line-height:1.4">Pan, zoom, and pick a region. Filter by <strong>year</strong> with the inputs and slider, then use <strong>Ask Flux</strong> to place a person or event the dataset might not include.</p>
  <div class="hist-topbar">
    <div class="hist-continent-btns" id="histContBtns" role="group" aria-label="Region"></div>
  </div>
  <div class="hist-year-block">
    <div class="hist-year-row">
      <label>From (year) <input type="number" id="histY0" step="1" min="${EPOCH_MIN}" max="${EPOCH_MAX}" value="${state.y0}"/> <span class="hist-hint">negative = BCE</span></label>
      <label>To (year) <input type="number" id="histY1" step="1" min="${EPOCH_MIN}" max="${EPOCH_MAX}" value="${state.y1}"/></label>
    </div>
    <div class="hist-range-row">
      <span>Scrub start year (fast, BCE = negative)</span>
      <input type="range" class="hist-year-range" id="histRangeStart" min="${EPOCH_MIN}" max="${EPOCH_MAX}" value="${state.y0}"/>
    </div>
    <div class="hist-range-row">
      <span>Scrub end year (fast)</span>
      <input type="range" class="hist-year-range" id="histRangeEnd" min="${EPOCH_MIN}" max="${EPOCH_MAX}" value="${state.y1}"/>
    </div>
  </div>
  <div class="hist-layout">
    <div class="hist-map-wrap">
      <div class="hist-map" id="histMapEl" aria-label="Map"></div>
      <div class="hist-map--loading" id="histMapLoad">Loading map…</div>
      <div class="hist-map-attr" aria-hidden="true">© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a></div>
    </div>
    <div class="hist-side">
      <div class="hist-list-head" id="histListCount">0 events</div>
      <div class="hist-list" id="histList"></div>
      <div class="hist-ai">
        <h4>Ask Flux about an event or person</h4>
        <p style="margin:0;font-size:.75rem;color:var(--muted2)">Places a pin and explains. Example: "Battle of Cannae" or "life of Hatshepsut".</p>
        <div class="hist-ai-row">
          <input type="text" id="histAiQ" placeholder="e.g. Treaty of Tordesillas" autocomplete="off"/>
          <button type="button" id="histAiBtn">Ask Flux</button>
        </div>
        <div class="hist-ai-out" id="histAiOut" hidden></div>
        <div class="hist-ai-err" id="histAiErr" hidden></div>
      </div>
    </div>
  </div>
</div>`;

    state.mapEl = body.querySelector('#histMapEl');
    const loadEl = body.querySelector('#histMapLoad');
    state.listHost = body.querySelector('#histList');
    state.listCountEl = body.querySelector('#histListCount');
    const contHost = body.querySelector('#histContBtns');
    contHost.innerHTML = CONTINENTS.map(c => `<button type="button" data-c="${c.id}" class="${c.id === state.continent ? 'hist--on' : ''}">${esc(c.name)}</button>`).join('');

    const y0i = body.querySelector('#histY0');
    const y1i = body.querySelector('#histY1');
    const rStart = body.querySelector('#histRangeStart');
    const rEnd = body.querySelector('#histRangeEnd');
    const aiQ = body.querySelector('#histAiQ');
    const aiBtn = body.querySelector('#histAiBtn');
    const aiOut = body.querySelector('#histAiOut');
    const aiErr = body.querySelector('#histAiErr');

    function readYears(){
      let a = parseInt(y0i.value, 10);
      let b = parseInt(y1i.value, 10);
      if (!Number.isFinite(a)) a = EPOCH_MIN;
      if (!Number.isFinite(b)) b = EPOCH_MAX;
      if (a > b) [a, b] = [b, a];
      state.y0 = Math.max(EPOCH_MIN, Math.min(EPOCH_MAX, a));
      state.y1 = Math.max(EPOCH_MIN, Math.min(EPOCH_MAX, b));
      y0i.value = state.y0;
      y1i.value = state.y1;
      rStart.value = String(state.y0);
      rEnd.value = String(state.y1);
    }
    state._render = () => renderHistoryMap(body, state.allEvents, state, true);
    rStart.addEventListener('input', () => {
      y0i.value = rStart.value;
      readYears();
      state._render();
    });
    rEnd.addEventListener('input', () => {
      y1i.value = rEnd.value;
      readYears();
      state._render();
    });
    y0i.addEventListener('change', () => { readYears(); state._render(); });
    y1i.addEventListener('change', () => { readYears(); state._render(); });

    contHost.addEventListener('click', (e) => {
      const b = e.target.closest('button[data-c]');
      if (!b) return;
      state.continent = b.dataset.c;
      contHost.querySelectorAll('button').forEach(x => x.classList.toggle('hist--on', x.dataset.c === state.continent));
      state._render();
      if (state.L && state.map) fitMap(state.L, state.map, state.continent);
    });

    async function onAi(){
      aiErr.hidden = true;
      aiOut.hidden = true;
      const q = (aiQ.value || '').trim();
      if (!q) return;
      aiBtn.disabled = true;
      try{
        await runFluxQuery(q, state);
        aiOut.innerHTML = `<p><strong>${esc(state.aiEvent.t)}</strong> (${esc(yLabel(state.aiEvent.y))})</p><p>${esc(state.aiEvent.s)}</p>${state.aiEvent.place ? `<p style="color:var(--muted2)">Place: ${esc(state.aiEvent.place)}</p>` : ''}`;
        aiOut.hidden = false;
      }catch(err){
        aiErr.textContent = err.message || String(err);
        aiErr.hidden = false;
      }finally{
        aiBtn.disabled = false;
      }
    }
    aiBtn.addEventListener('click', onAi);
    aiQ.addEventListener('keydown', (e) => { if (e.key === 'Enter'){ e.preventDefault(); onAi(); } });

    (async() => {
      try{
        const ev = await loadAllEvents();
        ev.forEach((e, i) => { e._id = i; });
        state.allEvents = ev;
        state._render();
        await loadCss(LEAFLET_CSS);
        const L = await loadScript(LEAFLET_JS);
        fixDefaultIcons(L);
        if (!body.isConnected) return;
        state.L = L;
        loadEl.style.display = 'none';
        const map = L.map(state.mapEl, { worldCopyJump: true, scrollWheelZoom: true, zoomControl: true });
        state.map = map;
        const basemap = historyMapTileLayerSpec();
        L.tileLayer(basemap.url, {
          maxZoom: basemap.maxZoom,
          attribution: basemap.attribution,
          subdomains: 'abcd',
        }).addTo(map);
        map.setView([20, 0], 2);
        state.group = L.layerGroup().addTo(map);
        state._render();
        setTimeout(() => { map.invalidateSize(); }, 220);
        window._histResize = () => map.invalidateSize();
        window.addEventListener('resize', window._histResize);
      }catch(err){
        if (loadEl) loadEl.textContent = 'Could not load the map. Check your network and reload.';
        console.error(err);
      }
    })();

    window.fluxHistoryMapCleanup = function(){
      try{
        if (window._histResize) window.removeEventListener('resize', window._histResize);
        window._histResize = null;
      }catch(e){}
      try{ if (state.map) state.map.remove(); }catch(e){}
      state.map = null;
      state.L = null;
      state.group = null;
    };
  }

  function openHistoryMap(){
    if (typeof window.fluxOpenToolModal !== 'function') return;
    window.fluxOpenToolModal({
      id: 'history-map',
      emoji: '🗺️',
      title: 'World history map',
      wide: true,
      renderBody: (body) => { setup(body); },
    });
  }

  function renderWorldHistoryMap(tbBody){
    if (typeof window.openHistoryMap === 'function') requestAnimationFrame(() => window.openHistoryMap());
    tbBody.innerHTML = `
      <div class="tb-card tb-hist-stub">
        <div class="tb-card-h"><h3>World history map</h3></div>
        <p class="tb-muted">A full-screen map with real geography, a year filter, regional shortcuts, a large event set, and <strong>Ask Flux</strong> to find and place any person or event.</p>
        <p style="margin:12px 0 0"><button type="button" class="tb-seg" style="padding:8px 14px;border-radius:10px;border:1px solid var(--line);background:rgba(255,255,255,.06);color:var(--text);font-weight:700;cursor:pointer" id="tbHistOpen">Open world history map</button></p>
      </div>`;
    document.getElementById('tbHistOpen')?.addEventListener('click', () => {
      if (window.openHistoryMap) window.openHistoryMap();
    });
  }

  try{ window.openHistoryMap = openHistoryMap; }catch(e){}
  try{ window.renderWorldHistoryMap = renderWorldHistoryMap; }catch(e){}
})();
