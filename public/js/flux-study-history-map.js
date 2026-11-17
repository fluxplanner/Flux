/* ============================================================================
   FLUX STUDY HUB · History — World map through time
   A world map with a timeline slider. Dragging the slider snaps to the
   nearest year we have borders for, redraws the map, and lists key events
   from that era.

   Borders: the open historical-basemaps project (github.com/aourednik/
   historical-basemaps, GPL-3.0). The files are fetched at runtime from a
   commit-pinned jsDelivr URL rather than bundled — they are ~1 MB each and
   GPL-licensed, so they are not copied into this repo. Each year is kept in
   the Cache API after its first load, so a year you have looked at once
   works offline afterwards.

   No map library: the data is plain GeoJSON in lon/lat, and an
   equirectangular projection is one multiply per point, drawn as SVG.
   Registers with fluxStudyHub under History.
   ========================================================================== */
(function () {
  'use strict';

  const DATA_SHA = '4b5039e50d8d2464b065bd76ad6086cd4597108d';
  const DATA_BASE = 'https://cdn.jsdelivr.net/gh/aourednik/historical-basemaps@' + DATA_SHA + '/geojson/';
  const CACHE = 'flux-history-maps-v1';

  /* Snapshot years the dataset has, chosen to cover each era without
     making the slider so fine that neighbouring stops look identical.
     Negative = BCE. `file` is the dataset's own name for that year. */
  const YEARS = [
    [-3000, 'bc3000'], [-2000, 'bc2000'], [-1000, 'bc1000'], [-500, 'bc500'],
    [-323, 'bc323'], [-200, 'bc200'], [-1, 'bc1'], [200, '200'], [400, '400'],
    [600, '600'], [800, '800'], [1000, '1000'], [1200, '1200'], [1279, '1279'],
    [1400, '1400'], [1492, '1492'], [1530, '1530'], [1650, '1650'], [1715, '1715'],
    [1783, '1783'], [1815, '1815'], [1880, '1880'], [1914, '1914'], [1920, '1920'],
    [1938, '1938'], [1945, '1945'], [1960, '1960'], [1994, '1994'], [2010, '2010'],
  ];

  // Key events. Shown when they fall in the era around the selected stop.
  const EVENTS = [
    [-3100, 'Upper and Lower Egypt unified; writing develops in Mesopotamia'],
    [-2560, 'Great Pyramid of Giza completed'],
    [-2334, 'Sargon of Akkad founds the first known empire'],
    [-1754, "Hammurabi's law code in Babylon"],
    [-1600, 'Shang dynasty rises in China'],
    [-1200, 'Late Bronze Age collapse across the eastern Mediterranean'],
    [-776, 'First recorded Olympic Games'],
    [-753, 'Traditional founding of Rome'],
    [-550, 'Cyrus the Great founds the Persian (Achaemenid) Empire'],
    [-509, 'Roman Republic established'],
    [-431, 'Peloponnesian War between Athens and Sparta'],
    [-334, 'Alexander the Great invades Persia'],
    [-323, "Alexander dies; his empire splits among his generals"],
    [-268, 'Ashoka rules the Maurya Empire in India'],
    [-221, 'Qin Shi Huang unifies China'],
    [-146, 'Rome destroys Carthage'],
    [-27, 'Augustus becomes the first Roman emperor'],
    [117, 'Roman Empire reaches its greatest extent'],
    [220, 'Han dynasty ends in China'],
    [330, 'Constantinople becomes the Roman capital'],
    [476, 'Western Roman Empire falls'],
    [527, 'Justinian rules the Byzantine Empire'],
    [622, "Muhammad's migration to Medina (the Hijra)"],
    [661, 'Umayyad Caliphate founded'],
    [750, 'Abbasid Caliphate founded; Baghdad becomes a centre of learning'],
    [800, 'Charlemagne crowned emperor'],
    [960, 'Song dynasty begins in China'],
    [1066, 'Norman conquest of England'],
    [1096, 'First Crusade begins'],
    [1206, 'Genghis Khan unites the Mongols'],
    [1215, 'Magna Carta sealed in England'],
    [1279, 'Mongol Yuan dynasty completes the conquest of China'],
    [1347, 'Black Death reaches Europe'],
    [1405, "Zheng He's treasure fleets sail the Indian Ocean"],
    [1453, 'Ottomans capture Constantinople'],
    [1492, 'Columbus reaches the Americas'],
    [1517, 'Protestant Reformation begins'],
    [1521, 'Spanish conquest of the Aztec Empire'],
    [1526, 'Mughal Empire founded in India'],
    [1533, 'Spanish conquest of the Inca Empire'],
    [1618, "Thirty Years' War begins"],
    [1648, 'Peace of Westphalia'],
    [1688, 'Glorious Revolution in England'],
    [1756, "Seven Years' War, the first global war"],
    [1776, 'American Declaration of Independence'],
    [1789, 'French Revolution begins'],
    [1804, 'Napoleon crowned emperor; Haiti wins independence'],
    [1815, 'Napoleon defeated at Waterloo; Congress of Vienna'],
    [1821, 'Wave of independence across Latin America'],
    [1848, 'Revolutions sweep Europe'],
    [1861, 'American Civil War begins; Italy unified'],
    [1868, 'Meiji Restoration in Japan'],
    [1871, 'German Empire proclaimed'],
    [1884, 'Berlin Conference: "Scramble for Africa"'],
    [1914, 'World War I begins'],
    [1917, 'Russian Revolution'],
    [1919, 'Treaty of Versailles; League of Nations formed'],
    [1929, 'Wall Street Crash; Great Depression'],
    [1939, 'World War II begins'],
    [1945, 'World War II ends; United Nations founded'],
    [1947, 'India and Pakistan independent; Cold War begins'],
    [1949, "People's Republic of China founded"],
    [1957, 'Ghana leads decolonisation in Africa'],
    [1962, 'Cuban Missile Crisis'],
    [1969, 'Apollo 11 Moon landing'],
    [1989, 'Berlin Wall falls'],
    [1991, 'Soviet Union dissolves'],
    [1994, 'End of apartheid in South Africa'],
    [2001, 'September 11 attacks'],
    [2008, 'Global financial crisis'],
  ];

  // [west lon, north lat, width, height]
  const VIEWS = {
    world: [-180, 85, 360, 145],
    europe: [-15, 72, 65, 38],
    asia: [25, 60, 125, 60],
    africa: [-25, 40, 80, 78],
    americas: [-170, 75, 140, 135],
  };

  const yrLabel = (y) => (y < 0 ? Math.abs(y) + ' BCE' : y + ' CE');

  async function loadYear(file) {
    const url = DATA_BASE + 'world_' + file + '.geojson';
    let cache = null;
    try { cache = await caches.open(CACHE); } catch (e) { /* no Cache API (private mode) */ }
    if (cache) {
      const hit = await cache.match(url);
      if (hit) return hit.json();
    }
    const res = await fetch(url);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    if (cache) { try { await cache.put(url, res.clone()); } catch (e) { /* quota */ } }
    return res.json();
  }

  // Equirectangular: x = lon, y = -lat. One decimal is plenty at screen size.
  function ringPath(ring) {
    let d = '';
    for (let i = 0; i < ring.length; i++) {
      d += (i ? 'L' : 'M') + ring[i][0].toFixed(1) + ' ' + (-ring[i][1]).toFixed(1);
    }
    return d + 'Z';
  }
  const polysOf = (g) => (g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : []);
  const geomPath = (g) => polysOf(g).map((p) => p.map(ringPath).join('')).join('');
  // Rough area + label point from the largest outer ring's bounding box.
  function labelInfo(g) {
    let best = null, total = 0;
    polysOf(g).forEach((p) => {
      let x0 = 999, x1 = -999, y0 = 999, y1 = -999;
      p[0].forEach((c) => { if (c[0] < x0) x0 = c[0]; if (c[0] > x1) x1 = c[0]; if (c[1] < y0) y0 = c[1]; if (c[1] > y1) y1 = c[1]; });
      const a = (x1 - x0) * (y1 - y0); total += a;
      if (!best || a > best.a) best = { a, x: (x0 + x1) / 2, y: (y0 + y1) / 2 };
    });
    return best ? { area: total, x: best.x, y: best.y } : null;
  }
  function colourFor(name) {
    let h = 0;
    for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0;
    return 'hsl(' + (Math.abs(h) % 360) + ',48%,58%)';
  }

  function boot() {
    const H = window.fluxStudyHub;
    if (!H || !H.register) { return setTimeout(boot, 60); }
    const esc = H.helpers.esc;

    let idx = YEARS.findIndex((y) => y[0] === 1492);
    let view = 'world';
    let reqId = 0;

    function eventsFor(i) {
      const lo = i === 0 ? -Infinity : (YEARS[i - 1][0] + YEARS[i][0]) / 2;
      const hi = i === YEARS.length - 1 ? Infinity : (YEARS[i][0] + YEARS[i + 1][0]) / 2;
      return EVENTS.filter((e) => e[0] >= lo && e[0] < hi);
    }

    function render(body) {
      body.innerHTML = `<div class="fsh-card fhm" style="padding:16px">
        <style>
          .fhm svg{width:100%;height:auto;display:block;border-radius:12px;background:rgba(80,140,200,.14);touch-action:pan-y}
          .fhm path.r{stroke:rgba(20,20,30,.55);stroke-width:.4;vector-effect:non-scaling-stroke;cursor:pointer}
          .fhm path.r.on{stroke:#fff;stroke-width:2}
          .fhm text{font-family:system-ui,sans-serif;font-weight:600;fill:#111;paint-order:stroke;stroke:rgba(255,255,255,.75);pointer-events:none}
          .fhm .yr{font-size:28px;font-weight:800;line-height:1}
          .fhm input[type=range]{width:100%;margin:10px 0 2px;accent-color:#d8a657;min-height:32px}
          .fhm .views{display:flex;flex-wrap:wrap;gap:6px;margin:10px 0}
          .fhm .views button{padding:6px 12px;font-size:13px}
          .fhm .views button.sel{outline:2px solid #d8a657}
          .fhm .ticks{display:flex;justify-content:space-between;font-size:11px;color:var(--fsh-mut)}
          .fhm ul{margin:6px 0 0;padding-left:0;list-style:none}
          .fhm li{display:flex;gap:10px;padding:6px 0;border-bottom:1px solid rgba(127,127,127,.15);font-size:14px}
          .fhm li b{min-width:76px;color:#d8a657}
        </style>
        <h3 style="margin:0 0 4px;font-size:16px">World map through time</h3>
        <p class="sub" style="color:var(--fsh-mut);font-size:12px;margin:0 0 10px">Drag the slider to watch borders and empires change. Tap a region to name it.</p>
        <div style="display:flex;align-items:baseline;gap:12px;flex-wrap:wrap"><span class="yr" id="fhmYear"></span><span id="fhmPicked" style="font-size:14px;color:var(--fsh-ink-2)"></span></div>
        <input type="range" id="fhmSlider" min="0" max="${YEARS.length - 1}" step="1" value="${idx}" aria-label="Year">
        <div class="ticks"><span>3000 BCE</span><span>1 CE</span><span>1500</span><span>2010</span></div>
        <div class="views" id="fhmViews">${Object.keys(VIEWS).map((v) => `<button type="button" class="fsh-btn ghost" data-view="${v}">${v[0].toUpperCase() + v.slice(1)}</button>`).join('')}</div>
        <div style="position:relative"><svg id="fhmMap" role="img" aria-label="Historical world map"></svg>
          <div id="fhmStatus" style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:14px;color:var(--fsh-mut);pointer-events:none"></div></div>
        <h4 style="margin:16px 0 0;font-size:14px">Key events in this era</h4>
        <ul id="fhmEvents"></ul>
        <p style="font-size:11px;color:var(--fsh-mut);margin:12px 0 0">Borders: <a href="https://github.com/aourednik/historical-basemaps" target="_blank" rel="noopener">historical-basemaps</a> (GPL-3.0). Borders before 1500 are approximate. Years you have viewed work offline.</p>
      </div>`;

      const svg = body.querySelector('#fhmMap');
      const slider = body.querySelector('#fhmSlider');
      const status = body.querySelector('#fhmStatus');
      const picked = body.querySelector('#fhmPicked');
      let feats = [];

      function setView(v) {
        view = v;
        const b = VIEWS[v];
        svg.setAttribute('viewBox', b[0] + ' ' + (-b[1]) + ' ' + b[2] + ' ' + b[3]);
        body.querySelectorAll('#fhmViews [data-view]').forEach((x) => x.classList.toggle('sel', x.dataset.view === v));
      }

      function drawHeader() {
        body.querySelector('#fhmYear').textContent = yrLabel(YEARS[idx][0]);
        const evs = eventsFor(idx);
        body.querySelector('#fhmEvents').innerHTML = evs.length
          ? evs.map((e) => `<li><b>${esc(yrLabel(e[0]))}</b><span>${esc(e[1])}</span></li>`).join('')
          : '<li style="color:var(--fsh-mut)">No headline events listed for this era.</li>';
      }

      async function drawMap() {
        const my = ++reqId;
        drawHeader();
        picked.textContent = '';
        status.textContent = 'Loading ' + yrLabel(YEARS[idx][0]) + '…';
        let data;
        try { data = await loadYear(YEARS[idx][1]); } catch (e) {
          if (my === reqId) status.textContent = "Couldn't load this year's map. Check your connection.";
          return;
        }
        if (my !== reqId) return; // a newer drag won
        status.textContent = '';
        feats = (data.features || []).filter((f) => f.geometry && f.properties && f.properties.NAME);
        const labels = [];
        const paths = feats.map((f, i) => {
          const pr = f.properties;
          const li = labelInfo(f.geometry);
          if (li) labels.push({ name: pr.NAME, area: li.area, x: li.x, y: li.y });
          return `<path class="r" data-i="${i}" fill="${colourFor(pr.SUBJECTO || pr.NAME)}" d="${geomPath(f.geometry)}"><title>${esc(pr.NAME)}</title></path>`;
        }).join('');
        // Labels scale with the view, so only the biggest regions get one.
        const minArea = view === 'world' ? 300 : 60;
        const fs = view === 'world' ? 3.2 : 1.6;
        const text = labels.filter((l) => l.area >= minArea).sort((a, b) => b.area - a.area).slice(0, 40)
          .map((l) => `<text x="${l.x.toFixed(1)}" y="${(-l.y).toFixed(1)}" text-anchor="middle" style="font-size:${fs}px;stroke-width:${fs / 4}px">${esc(l.name)}</text>`).join('');
        svg.innerHTML = paths + text;
      }

      svg.addEventListener('click', (e) => {
        const p = e.target.closest('path.r');
        svg.querySelectorAll('path.r.on').forEach((x) => x.classList.remove('on'));
        if (!p) { picked.textContent = ''; return; }
        p.classList.add('on');
        const pr = feats[+p.dataset.i].properties;
        picked.textContent = pr.NAME + (pr.SUBJECTO && pr.SUBJECTO !== pr.NAME ? ' (part of ' + pr.SUBJECTO + ')' : '');
      });

      let t = 0;
      slider.addEventListener('input', () => {
        idx = +slider.value;
        drawHeader();
        clearTimeout(t); t = setTimeout(drawMap, 120);
      });
      body.querySelector('#fhmViews').addEventListener('click', (e) => {
        const b = e.target.closest('[data-view]');
        if (b) { setView(b.dataset.view); drawMap(); }
      });

      setView(view);
      drawMap();
    }

    H.register('history', [
      { id: 'worldmap', name: 'Map through time', icon: '🌍', desc: 'world map history borders empires timeline slider events geography', render },
    ]);
  }
  boot();
})();
