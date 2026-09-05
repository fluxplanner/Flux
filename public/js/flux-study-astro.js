/* ============================================================================
   FLUX STUDY HUB · Astronomy
   Registers under Physics rather than as its own subject: orbits are physics,
   and a pill of its own in a rail that was already too long was never worth
   three tools.

   "Planet facts" is no longer a tab. It was a list of the same eight planets
   the Solar system tab already draws, one click away from the orrery that
   selects them — so the table now sits under the orrery, where the planet you
   just clicked is the row you want to read. One tab fewer and nothing lost.

   Everything below is written out rather than derived. Moon counts are the
   kind of number that looks authoritative and quietly goes stale, so the page
   says they move rather than pretending to be permanent.
   ========================================================================== */
(function () {
  'use strict';
  function boot() {
    const H = window.fluxStudyHub;
    if (!H || !H.register) { return setTimeout(boot, 60); }
    const esc = H.helpers.esc;
    function mkCanvas(host, h) { const wrap = document.createElement('div'); wrap.className = 'fsh-canvas-wrap'; const c = document.createElement('canvas'); wrap.appendChild(c); host.appendChild(wrap); const ctx = c.getContext('2d'); function size() { const w = wrap.clientWidth || 620; const dpr = Math.min(2, window.devicePixelRatio || 1); c.width = w * dpr; c.height = h * dpr; c.style.height = h + 'px'; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); return { w, h }; } return { c, ctx, size, alive: () => document.body.contains(c) }; }

    const card = (title, sub, inner) => `<div class="fsh-card" style="padding:20px">
      <h3 style="margin:0 0 4px;font-size:16px">${title}</h3>
      ${sub ? `<p class="sub" style="color:var(--fsh-mut);font-size:12px;margin:0 0 14px">${sub}</p>` : ''}
      ${inner}</div>`;
    const table = (head, rows, min) => `<div class="fsh-sol-scroll"><table class="fsh-sol" style="min-width:${min || 460}px">
      <thead><tr><th style="text-align:left">${head.map(esc).join('</th><th>')}</th></tr></thead>
      <tbody>${rows.map((r) => `<tr><th style="text-align:left">${esc(r[0])}</th>${r.slice(1).map((c) => `<td style="background:rgba(255,255,255,.05);color:var(--fsh-ink)">${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
    const list = (items) => `<div class="fsh-formula-list">${items.map((x) => `<div class="fsh-formula"><div class="fx" style="font-size:14px;font-family:inherit">${esc(x[0])}</div><div class="nm" style="margin-top:4px;color:var(--fsh-ink-2)">${esc(x[1])}</div></div>`).join('')}</div>`;
    const label = (t, first) => `<div class="fsh-label"${first ? '' : ' style="margin-top:16px"'}><span>${esc(t)}</span></div>`;

    /* n name · c colour · r drawn orbit radius 0..1 · a semi-major axis (AU)
       p orbital period (yr) · d diameter (Earth=1) · mass (Earth=1)
       g surface gravity (m/s²) · moons confirmed · day rotation · temp mean */
    const PLANETS = [
      { n: 'Mercury', c: '#b7a99a', r: 0.13, a: 0.39, p: 0.24, d: 0.383, mass: 0.055, g: 3.7, moons: 0, day: '58.6 days', temp: '167 °C', fact: 'Smallest planet, and no atmosphere to hold heat — it swings from about 430 °C in daylight to −180 °C at night.' },
      { n: 'Venus', c: '#e3b96b', r: 0.22, a: 0.72, p: 0.62, d: 0.949, mass: 0.815, g: 8.87, moons: 0, day: '243 days, backwards', temp: '464 °C', fact: 'Hotter than Mercury despite being further out: a thick CO₂ atmosphere traps the heat. It also spins backwards.' },
      { n: 'Earth', c: '#4f9be3', r: 0.31, a: 1, p: 1, d: 1, mass: 1, g: 9.81, moons: 1, day: '23.93 h', temp: '15 °C', fact: 'The only known world with life and liquid water at the surface.' },
      { n: 'Mars', c: '#e0664b', r: 0.40, a: 1.52, p: 1.88, d: 0.532, mass: 0.107, g: 3.71, moons: 2, day: '24.6 h', temp: '−65 °C', fact: 'Red from iron-oxide dust. Olympus Mons is the tallest volcano in the solar system at about 22 km.' },
      { n: 'Jupiter', c: '#d6a06a', r: 0.56, a: 5.20, p: 11.86, d: 11.21, mass: 317.8, g: 24.79, moons: 95, day: '9.93 h', temp: '−110 °C', fact: 'More massive than every other planet combined. The Great Red Spot is a storm wider than Earth.' },
      { n: 'Saturn', c: '#e6d3a3', r: 0.69, a: 9.58, p: 29.46, d: 9.45, mass: 95.2, g: 10.44, moons: 146, day: '10.7 h', temp: '−140 °C', fact: 'Its rings are mostly water ice and only tens of metres thick. Its mean density is lower than water.' },
      { n: 'Uranus', c: '#9fe0e0', r: 0.82, a: 19.2, p: 84.0, d: 4.01, mass: 14.5, g: 8.87, moons: 28, day: '17.2 h, backwards', temp: '−195 °C', fact: 'Tipped 98° — it rolls around its orbit, so each pole gets 42 years of daylight then 42 of night.' },
      { n: 'Neptune', c: '#5b6bdc', r: 0.95, a: 30.05, p: 164.8, d: 3.88, mass: 17.1, g: 11.15, moons: 16, day: '16.1 h', temp: '−200 °C', fact: 'The windiest planet — storms reach about 2,000 km/h. It was predicted by maths before anyone saw it.' },
    ];

    // ── Solar system (orrery + the full comparison table) ────────────────────
    let astroSel = 2;
    function planetInfoHTML(i) {
      const p = PLANETS[i];
      return `<div class="fsh-keyinfo"><h3 style="margin:0 0 8px;font-size:20px"><span style="display:inline-block;width:14px;height:14px;border-radius:50%;background:${p.c};vertical-align:middle;margin-right:8px"></span>${esc(p.n)}</h3>
        <div class="row"><span>Distance from Sun</span><span>${p.a} AU</span></div>
        <div class="row"><span>Orbital period</span><span>${p.p} yr</span></div>
        <div class="row"><span>Diameter (Earth=1)</span><span>${p.d}×</span></div>
        <div class="row"><span>Mass (Earth=1)</span><span>${p.mass}×</span></div>
        <div class="row"><span>Surface gravity</span><span>${p.g} m/s²</span></div>
        <div class="row"><span>Moons</span><span>${p.moons}</span></div>
        <div class="row"><span>Day length</span><span>${esc(p.day)}</span></div>
        <div class="row"><span>Mean temperature</span><span>${esc(p.temp)}</span></div>
        <p style="margin-top:12px;color:var(--fsh-ink-2);font-size:13.5px;line-height:1.6">${esc(p.fact)}</p></div>`;
    }
    function renderOrrery(body) {
      const rows = PLANETS.map((p) => [p.n, p.a + ' AU', p.p + ' yr', p.d + '×', p.mass + '×', p.g, p.moons, p.temp]);
      body.innerHTML = card('Solar system',
        'Planets orbit at their real relative speeds. Tap a planet — on the map or in the row of chips — and the panel beside it follows.',
        `<div class="fsh-ring-wrap"><div id="orCanvas"></div><div id="orInfo">${planetInfoHTML(astroSel)}</div></div>
        <div class="fsh-chips-row" style="margin-top:14px">${PLANETS.map((p, i) => `<button type="button" class="fsh-cat-chip${i === astroSel ? ' active' : ''}" data-pl="${i}"><span class="dot" style="background:${p.c}"></span>${esc(p.n)}</button>`).join('')}</div>
        ${label('All eight, side by side')}
        ${table(['Planet', 'Distance', 'Year', 'Diameter', 'Mass', 'Gravity m/s²', 'Moons', 'Mean temp'], rows, 660)}
        <div class="fsh-note" style="margin-top:10px">Diameter and mass are relative to Earth. Moon counts are confirmed moons and go up as new ones are found — Saturn and Jupiter trade the lead every few years.</div>`);

      const cv = mkCanvas(document.getElementById('orCanvas'), 340); const t0 = performance.now(); let dots = [];
      function draw(now) {
        if (!cv.alive()) return; const { w, h } = cv.size(), ctx = cv.ctx; const cx = w / 2, cy = h / 2; const maxR = Math.min(w, h) / 2 - 16;
        ctx.clearRect(0, 0, w, h);
        ctx.fillStyle = '#ffd36b'; ctx.shadowColor = '#ffae3b'; ctx.shadowBlur = 24; ctx.beginPath(); ctx.arc(cx, cy, 12, 0, 7); ctx.fill(); ctx.shadowBlur = 0;
        dots = [];
        PLANETS.forEach((p, i) => {
          const R = 26 + p.r * (maxR - 26);
          ctx.strokeStyle = 'rgba(255,255,255,.08)'; ctx.beginPath(); ctx.arc(cx, cy, R, 0, 7); ctx.stroke();
          const ang = (now - t0) / 1000 * (0.5 / p.p) * Math.PI * 2 + i;
          const x = cx + R * Math.cos(ang), y = cy + R * Math.sin(ang);
          dots.push({ x, y, i });
          const rad = i === astroSel ? 8 : 5;
          ctx.fillStyle = p.c; if (i === astroSel) { ctx.shadowColor = p.c; ctx.shadowBlur = 12; } ctx.beginPath(); ctx.arc(x, y, rad, 0, 7); ctx.fill(); ctx.shadowBlur = 0;
        });
        requestAnimationFrame(draw);
      }
      const select = (i) => {
        astroSel = i;
        document.getElementById('orInfo').innerHTML = planetInfoHTML(astroSel);
        body.querySelectorAll('[data-pl]').forEach((b) => b.classList.toggle('active', +b.dataset.pl === astroSel));
      };
      document.getElementById('orCanvas').addEventListener('click', (e) => { const rect = cv.c.getBoundingClientRect(); const mx = e.clientX - rect.left, my = e.clientY - rect.top; let best = -1, bd = 1e9; dots.forEach((d) => { const dd = Math.hypot(d.x - mx, d.y - my); if (dd < bd) { bd = dd; best = d.i; } }); if (best >= 0 && bd < 40) select(best); });
      body.querySelectorAll('[data-pl]').forEach((b) => b.addEventListener('click', () => select(+b.dataset.pl)));
      requestAnimationFrame(draw);
    }

    // ── Moon phases and eclipses ─────────────────────────────────────────────
    const PHASES = [['New Moon', 0], ['Waxing Crescent', 0.125], ['First Quarter', 0.25], ['Waxing Gibbous', 0.375], ['Full Moon', 0.5], ['Waning Gibbous', 0.625], ['Last Quarter', 0.75], ['Waning Crescent', 0.875]];
    function moonSVG(frac) {
      const lit = frac <= 0.5 ? frac * 2 : (1 - frac) * 2; // illuminated fraction 0..1
      const waxing = frac < 0.5; const r = 26, cx = 30, cy = 30;
      const offset = (1 - lit) * r * 2 * (waxing ? 1 : -1);
      const id = 'm' + ((frac * 1000) | 0);
      return `<svg width="60" height="60" viewBox="0 0 60 60"><defs><clipPath id="${id}"><circle cx="${cx}" cy="${cy}" r="${r}"/></clipPath></defs><circle cx="${cx}" cy="${cy}" r="${r}" fill="#2a3144"/><g clip-path="url(#${id})"><circle cx="${cx + offset}" cy="${cy}" r="${r}" fill="#eef2ff"/></g><circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="rgba(255,255,255,.25)"/></svg>`;
    }
    function renderMoon(body) {
      body.innerHTML = card('The Moon', 'One cycle takes 29.5 days — the synodic month. The Moon keeps the same face towards us because it rotates exactly once per orbit.',
        `<div class="fsh-ion-grid" style="grid-template-columns:repeat(auto-fill,minmax(120px,1fr))">${PHASES.map((p) => `<div class="fsh-ion" style="text-align:center">${moonSVG(p[1])}<div class="n" style="margin-top:6px">${esc(p[0])}</div></div>`).join('')}</div>
        ${label('Eclipses')}
        ${table(['Type', 'Geometry', 'Happens at', 'What you see'], [
    ['Solar, total', 'Moon between Sun and Earth; you stand in the umbra', 'New moon', 'Sun fully covered, corona visible, a few minutes at most'],
    ['Solar, annular', 'Same, but the Moon is near apogee and looks too small', 'New moon', 'A ring of Sun around the black Moon'],
    ['Solar, partial', 'You stand in the penumbra', 'New moon', 'A bite taken out of the Sun'],
    ['Lunar, total', 'Earth between Sun and Moon; Moon in Earth’s umbra', 'Full moon', 'Moon turns deep red — sunlight bent through our atmosphere'],
    ['Lunar, partial', 'Moon only partly in the umbra', 'Full moon', 'A dark curved bite out of the Moon'],
  ], 620)}
        <div class="fsh-note" style="margin-top:10px">Why there isn’t one of each every month: the Moon’s orbit is tilted about 5.1° to Earth’s, so most months its shadow misses. Eclipses only happen when a new or full moon lands near a node — where the two orbital planes cross. The same geometry repeats every 18 years 11⅓ days, the Saros cycle.</div>
        <div class="fsh-note" style="margin-top:8px">Tides: two bulges, not one. The near side is pulled towards the Moon and the far side is left behind, which is why most coasts get two high tides a day. Spring tides come when the Sun lines up too, at new and full moon; neap tides at the quarters.</div>`);
    }

    // ── Stars ────────────────────────────────────────────────────────────────
    const SPECTRAL = [
      ['O', 'over 30,000 K', 'Blue', 'Mintaka, Alnitak', 'Rare, huge, and short-lived — a few million years'],
      ['B', '10,000–30,000 K', 'Blue-white', 'Rigel, Spica', 'Still very massive and very bright'],
      ['A', '7,500–10,000 K', 'White', 'Sirius, Vega, Deneb', 'Strong hydrogen absorption lines'],
      ['F', '6,000–7,500 K', 'Yellow-white', 'Procyon, Polaris', 'A little hotter than the Sun'],
      ['G', '5,200–6,000 K', 'Yellow', 'The Sun, Alpha Centauri A', 'Roughly 10 billion years on the main sequence'],
      ['K', '3,700–5,200 K', 'Orange', 'Arcturus, Aldebaran', 'Cooler, long-lived, very common'],
      ['M', '2,400–3,700 K', 'Red', 'Betelgeuse, Proxima Centauri', 'Most stars in the galaxy are red dwarfs'],
    ];
    function renderStars(body) {
      body.innerHTML = card('Stars and the HR diagram',
        'Spectral class is really a temperature scale, hottest first. The order is OBAFGKM — "Oh Be A Fine Guy, Kiss Me" is how everyone remembers it.',
        `${table(['Class', 'Temperature', 'Colour', 'Examples', 'Notes'], SPECTRAL, 680)}
        ${label('Reading an HR diagram')}
        ${list([
    ['The axes', 'Temperature along the bottom, hot on the LEFT — the one thing everyone gets wrong. Luminosity up the side, usually in Suns and on a log scale.'],
    ['Main sequence', 'The diagonal band from hot-and-bright down to cool-and-faint. About 90% of stars sit here, fusing hydrogen into helium in the core. Where a star sits on it is set almost entirely by its mass.'],
    ['Giants and supergiants', 'Top right: cool but enormously bright, because they are enormous. Betelgeuse and Aldebaran live here.'],
    ['White dwarfs', 'Bottom left: hot but very faint, because they are Earth-sized. The exposed core of a dead low-mass star.'],
    ['Mass rules everything', 'A star ten times the Sun’s mass burns thousands of times brighter and dies in a few million years. A red dwarf sips its fuel and lasts trillions.'],
  ])}
        ${label('How a star ends — it depends on mass')}
        ${list([
    ['Under about 8 solar masses', 'Nebula → protostar → main sequence → red giant → planetary nebula → white dwarf. This is the Sun’s future: a red giant in about 5 billion years, then a slowly cooling Earth-sized ember.'],
    ['Over about 8 solar masses', 'Nebula → protostar → main sequence → red supergiant → supernova → neutron star, or a black hole above roughly 25 solar masses.'],
    ['Why the split', 'Fusion stops at iron — past it, fusing costs energy rather than releasing it. A massive core cannot hold itself up once iron builds, collapses in under a second, and the rebound is the supernova.'],
    ['Where your atoms came from', 'Everything heavier than helium was made inside a star, and most of what is heavier than iron was made in supernovae and neutron-star collisions.'],
  ])}`);
    }

    // ── Orbits and Kepler ────────────────────────────────────────────────────
    function renderKepler(body) {
      body.innerHTML = card('Orbits and Kepler’s laws',
        'Three laws that describe every orbit in the solar system, written down before anyone knew why they worked.',
        `${list([
    ['First law — the shape', 'Orbits are ellipses with the Sun at one focus, not at the centre. Perihelion is the closest point, aphelion the farthest. Most planetary orbits are very nearly circular; comets are the dramatic ones.'],
    ['Second law — the speed', 'A line from the Sun to the planet sweeps out equal areas in equal times. In plain terms: a planet moves fastest at perihelion and slowest at aphelion.'],
    ['Third law — the maths', 'P² = a³, with the period P in years and the semi-major axis a in astronomical units. Double the distance and the year gets almost three times longer.'],
    ['Why it works', 'Newton showed all three fall out of gravity obeying an inverse-square law. Kepler found the pattern; Newton found the reason.'],
  ])}
        ${label('Try it')}
        <div class="fsh-field" style="flex-wrap:wrap;margin-top:8px">
          <div class="fsh-seg" id="kepMode"><button type="button" data-m="a" class="active">Distance → year</button><button type="button" data-m="p">Year → distance</button></div>
          <input id="kepIn" class="fsh-input" value="5.2" spellcheck="false" inputmode="decimal">
          <button type="button" class="fsh-btn" id="kepGo">Work it out</button>
        </div>
        <div class="fsh-out" id="kepOut"></div>
        <div class="fsh-note" style="margin-top:10px">This form only works for things orbiting the Sun. The same law applies elsewhere with a different constant — around Earth, or around another star, the mass in the middle changes the numbers.</div>`);

      let mode = 'a';
      const run = () => {
        const out = document.getElementById('kepOut');
        const v = parseFloat(document.getElementById('kepIn').value);
        if (!isFinite(v) || v <= 0) { out.innerHTML = '<span class="fsh-err">Enter a positive number.</span>'; return; }
        if (mode === 'a') {
          const p = Math.pow(v, 1.5);
          out.innerHTML = `<span class="big">${v} AU → ${p.toFixed(3)} years</span>`
            + `<div class="fsh-note">P = a<sup>3/2</sup>. That is about ${(p * 365.25).toFixed(0)} days.</div>`;
        } else {
          const a = Math.pow(v, 2 / 3);
          out.innerHTML = `<span class="big">${v} years → ${a.toFixed(3)} AU</span>`
            + '<div class="fsh-note">a = P<sup>2/3</sup>. For scale, Earth is 1 AU and Neptune is 30.</div>';
        }
      };
      document.getElementById('kepMode').addEventListener('click', (e) => {
        const b = e.target.closest('[data-m]'); if (!b) return;
        mode = b.dataset.m;
        body.querySelectorAll('#kepMode button').forEach((x) => x.classList.toggle('active', x === b));
        document.getElementById('kepIn').value = mode === 'a' ? '5.2' : '11.86';
        run();
      });
      document.getElementById('kepGo').addEventListener('click', run);
      document.getElementById('kepIn').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); run(); } });
      run();
    }

    // ── Distances ────────────────────────────────────────────────────────────
    const UNITS = {
      km: { name: 'kilometres', inKm: 1 },
      au: { name: 'astronomical units', inKm: 1.495978707e8 },
      ly: { name: 'light-years', inKm: 9.4607304725808e12 },
      pc: { name: 'parsecs', inKm: 3.0856775814913673e13 },
    };
    function renderDistance(body) {
      body.innerHTML = card('Cosmic distances',
        'Four units, because no single one works from the Moon out to the edge of the observable universe.',
        `${table(['Unit', 'What it is', 'In kilometres', 'Useful for'], [
    ['Astronomical unit (AU)', 'Mean Earth–Sun distance', '1.496 × 10⁸', 'Inside the solar system'],
    ['Light-year (ly)', 'How far light travels in a year', '9.461 × 10¹²', 'Stars and nearby galaxies'],
    ['Parsec (pc)', 'The distance giving a parallax of one arcsecond', '3.086 × 10¹³', 'What professional astronomers actually use'],
    ['Light-second', 'How far light goes in one second', '299,792', 'The Moon is 1.3 of them away'],
  ], 620)}
        <div class="fsh-note" style="margin-top:8px">1 parsec = 3.262 light-years. Both are distances, not times — a light-year is a length, however much the name fights you on it.</div>
        ${label('Convert')}
        <div class="fsh-field" style="flex-wrap:wrap;margin-top:8px">
          <input id="dstIn" class="fsh-input" value="4.24" spellcheck="false" inputmode="decimal" style="max-width:160px">
          <div class="fsh-seg" id="dstFrom">${Object.keys(UNITS).map((k) => `<button type="button" data-u="${k}" class="${k === 'ly' ? 'active' : ''}">${k.toUpperCase()}</button>`).join('')}</div>
          <button type="button" class="fsh-btn" id="dstGo">Convert</button>
        </div>
        <div class="fsh-out" id="dstOut"></div>
        ${label('The scale ladder')}
        ${table(['From here to…', 'Distance', 'Light travel time'], [
    ['The Moon', '384,400 km', '1.3 seconds'],
    ['The Sun', '1 AU', '8.3 minutes'],
    ['Neptune', '30 AU', '4.2 hours'],
    ['The edge of the Kuiper belt', '50 AU', '6.9 hours'],
    ['Proxima Centauri, the nearest star', '4.24 ly', '4.24 years'],
    ['The centre of the Milky Way', '26,000 ly', '26,000 years'],
    ['The Andromeda galaxy', '2.5 million ly', '2.5 million years'],
    ['The edge of the observable universe', '46.5 billion ly', 'longer than the universe has existed'],
  ], 560)}
        <div class="fsh-note" style="margin-top:10px">That last row is not a typo. The universe is 13.8 billion years old, but space has expanded while the light was in transit, so whatever emitted it is now far further away than the light has travelled.</div>`);

      let from = 'ly';
      const run = () => {
        const out = document.getElementById('dstOut');
        const v = parseFloat(document.getElementById('dstIn').value);
        if (!isFinite(v)) { out.innerHTML = '<span class="fsh-err">Enter a number.</span>'; return; }
        const km = v * UNITS[from].inKm;
        const fmt = (x) => (x >= 1e6 || (x < 1e-3 && x > 0) ? x.toExponential(4) : x.toLocaleString(undefined, { maximumFractionDigits: 4 }));
        out.innerHTML = `<table class="fsh-sol" style="min-width:auto;margin-top:6px"><tbody>${Object.keys(UNITS).map((k) =>
          `<tr><th style="text-align:left">${esc(UNITS[k].name)}</th><td style="background:rgba(255,255,255,.05);color:var(--fsh-ink)">${esc(fmt(km / UNITS[k].inKm))}</td></tr>`).join('')}</tbody></table>`;
      };
      document.getElementById('dstFrom').addEventListener('click', (e) => {
        const b = e.target.closest('[data-u]'); if (!b) return;
        from = b.dataset.u;
        body.querySelectorAll('#dstFrom button').forEach((x) => x.classList.toggle('active', x === b));
        run();
      });
      document.getElementById('dstGo').addEventListener('click', run);
      document.getElementById('dstIn').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); run(); } });
      run();
    }

    // ── Deep sky ─────────────────────────────────────────────────────────────
    function renderDeepSky(body) {
      body.innerHTML = card('Galaxies and deep sky',
        'Everything past the solar system, sorted by what it actually is.',
        `${label('Galaxy types — the Hubble sequence', true)}
        ${table(['Type', 'Shape', 'Stars', 'Example'], [
    ['Elliptical (E0–E7)', 'Featureless ball, round through to flattened', 'Old and red — very little gas left to make new ones', 'M87'],
    ['Spiral (Sa, Sb, Sc)', 'Disc with arms; a → c is tighter → looser', 'Old bulge, young blue arms', 'Andromeda (M31)'],
    ['Barred spiral (SBa–SBc)', 'Arms start from a straight bar across the core', 'Same as spiral', 'The Milky Way'],
    ['Lenticular (S0)', 'A disc, but no arms', 'Mostly old', 'The Spindle Galaxy'],
    ['Irregular', 'No structure at all', 'Often furiously making new ones', 'The Magellanic Clouds'],
  ], 620)}
        ${label('Nebulae — four different things sharing one name')}
        ${list([
    ['Emission nebula', 'Gas made to glow by hot young stars inside it. Red, from hydrogen. The Orion Nebula (M42) is the one you can see with binoculars.'],
    ['Reflection nebula', 'Dust scattering the light of nearby stars. Blue, for the same reason the sky is. The Pleiades sit in one.'],
    ['Dark nebula', 'Cold dust blocking whatever is behind it. The Horsehead is a dark nebula silhouetted against a bright one.'],
    ['Planetary nebula', 'Nothing to do with planets — the shed outer layers of a dying low-mass star, lit by the white dwarf left behind. The Ring Nebula (M57).'],
    ['Supernova remnant', 'The expanding wreckage of an exploded massive star. The Crab Nebula (M1) is from a supernova Chinese astronomers recorded in 1054.'],
  ])}
        ${label('Worth finding with binoculars')}
        ${table(['Object', 'What it is', 'Where to look'], [
    ['M31 Andromeda', 'Spiral galaxy, 2.5 million ly — the farthest thing visible to the naked eye', 'Andromeda'],
    ['M42 Orion Nebula', 'Emission nebula and star nursery', 'Orion’s sword'],
    ['M45 Pleiades', 'Open cluster of hot young stars', 'Taurus'],
    ['M13 Hercules Cluster', 'Globular cluster — several hundred thousand old stars', 'Hercules'],
    ['M51 Whirlpool', 'Face-on spiral, mid-collision with a smaller galaxy', 'Canes Venatici'],
  ], 560)}
        ${label('The big picture')}
        ${list([
    ['The Big Bang', 'Not an explosion in space but an expansion of space itself, 13.8 billion years ago. There is no centre and no edge to point at.'],
    ['Redshift', 'Light from receding galaxies is stretched towards the red. The further away, the faster the recession — Hubble’s law, and the evidence the universe is expanding.'],
    ['The cosmic microwave background', 'The afterglow of the moment the universe cooled enough to become transparent, 380,000 years in. It is now 2.7 K and fills the whole sky.'],
    ['Dark matter and dark energy', 'Galaxies rotate too fast for their visible mass, and the expansion is speeding up. Together these account for about 95% of the universe, and nobody knows what either one is.'],
  ])}`);
    }

    // ── Small bodies ─────────────────────────────────────────────────────────
    function renderSmallBodies(body) {
      body.innerHTML = card('Asteroids, comets and dwarf planets',
        'The rest of the solar system — vastly more objects than there are planets.',
        `${label('Where things live', true)}
        ${table(['Region', 'Distance from Sun', 'What is there'], [
    ['Asteroid belt', '2.1–3.3 AU', 'Rocky leftovers between Mars and Jupiter. Ceres is the largest at 940 km. All of it together weighs less than the Moon.'],
    ['Kuiper belt', '30–50 AU', 'Icy bodies beyond Neptune, including Pluto, Haumea and Makemake. The source of short-period comets.'],
    ['Scattered disc', '30 to over 100 AU', 'Icy bodies on tilted, stretched orbits. Eris lives here.'],
    ['Oort cloud', '2,000–100,000 AU', 'A spherical shell of comet nuclei surrounding the whole system. Never directly observed — inferred from where long-period comets come from.'],
  ], 640)}
        ${label('Dwarf planets')}
        <div class="fsh-note">The IAU definition has three parts: it orbits the Sun, it is round under its own gravity, and it has <em>not</em> cleared its orbital neighbourhood. That third clause is the one that reclassified Pluto in 2006 — it shares the Kuiper belt with thousands of similar objects.</div>
        ${table(['Name', 'Where', 'Diameter', 'Note'], [
    ['Ceres', 'Asteroid belt', '940 km', 'The only one inside Neptune’s orbit'],
    ['Pluto', 'Kuiper belt', '2,377 km', 'Has five moons; Charon is half its size'],
    ['Eris', 'Scattered disc', '2,326 km', 'More massive than Pluto — its discovery forced the redefinition'],
    ['Haumea', 'Kuiper belt', 'about 1,600 km long', 'Spins so fast it is egg-shaped, and it has a ring'],
    ['Makemake', 'Kuiper belt', '1,430 km', 'Named after a Rapa Nui creation god'],
  ], 600)}
        ${label('Comets')}
        ${list([
    ['Nucleus', 'A few kilometres of ice and dust — the "dirty snowball". Far from the Sun, this is the entire comet.'],
    ['Coma', 'The fuzzy atmosphere that forms as the nucleus warms and its ice turns straight to gas. It can end up bigger than a planet.'],
    ['Ion tail', 'Gas swept straight back by the solar wind. It always points directly away from the Sun, whichever way the comet happens to be travelling.'],
    ['Dust tail', 'Heavier dust left behind along the orbit, so it curves. This is why bright comets often show two separate tails.'],
    ['Short vs long period', 'Under 200 years and it came from the Kuiper belt — Halley returns every 76. Longer than that, and it fell in from the Oort cloud.'],
  ])}
        ${label('Meteors')}
        <div class="fsh-note">Three words for three places. A <strong>meteoroid</strong> is the rock while it is in space; a <strong>meteor</strong> is the streak of light as it burns up in the atmosphere; a <strong>meteorite</strong> is what reaches the ground. Showers happen when Earth ploughs through the dust trail left by a comet, which is why they recur on the same dates every year.</div>
        ${table(['Shower', 'Peak', 'Rate per hour', 'Parent body'], [
    ['Quadrantids', '3 January', 'about 110', 'Asteroid 2003 EH1'],
    ['Lyrids', '22 April', 'about 18', 'Comet Thatcher'],
    ['Perseids', '12 August', 'about 100', 'Comet Swift–Tuttle'],
    ['Orionids', '21 October', 'about 20', 'Comet Halley'],
    ['Leonids', '17 November', 'about 15', 'Comet Tempel–Tuttle'],
    ['Geminids', '14 December', 'about 150', 'Asteroid 3200 Phaethon'],
  ], 560)}`);
    }

    H.register('physics', [
      { id: 'orrery', name: 'Solar system', icon: '🪐', desc: 'solar system planets orbit orrery sun planet facts comparison gravity mass moons', render: renderOrrery, ai: { name: 'planetInfo', description: 'Facts about a planet. Arg: planet name.', params: { planet: 'string' }, run: (a) => { const p = PLANETS.find((x) => x.n.toLowerCase() === String(a).trim().toLowerCase()); if (!p) throw new Error('Unknown planet'); return { name: p.n, distanceAU: p.a, orbitYears: p.p, diameterEarths: p.d, massEarths: p.mass, gravity: p.g, moons: p.moons, day: p.day, meanTemp: p.temp, fact: p.fact }; } } },
      { id: 'moon', name: 'Moon & eclipses', icon: '🌙', desc: 'moon phases lunar cycle new full eclipse solar umbra penumbra tides saros', render: renderMoon },
      { id: 'stars', name: 'Stars', icon: '⭐', desc: 'stars spectral class hr diagram main sequence red giant white dwarf supernova obafgkm luminosity', render: renderStars },
      /* ◎ and ✦ are plain text glyphs, not emoji. flux-iconify only has SVGs
         for the emoji in its map and falls back to a featureless dot for
         anything else — a satellite and a comet would both have come out as
         the same grey circle. Text glyphs are also never swapped after paint,
         so these two tabs never change width under the highlight. */
      { id: 'kepler', name: 'Orbits & Kepler', icon: '◎', desc: 'kepler laws orbit ellipse perihelion aphelion period semi-major axis calculator', render: renderKepler },
      { id: 'distance', name: 'Cosmic distances', icon: '📏', desc: 'astronomical unit light year parsec distance converter scale universe', render: renderDistance },
      { id: 'deepsky', name: 'Galaxies & deep sky', icon: '🌌', desc: 'galaxy hubble sequence spiral elliptical nebula messier big bang redshift dark matter cmb', render: renderDeepSky },
      { id: 'smallbodies', name: 'Comets & asteroids', icon: '✦', desc: 'asteroid comet dwarf planet kuiper oort meteor shower ceres pluto eris meteorite', render: renderSmallBodies },
    ]);
  }
  boot();
})();
