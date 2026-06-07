/* ============================================================================
   FLUX STUDY HUB · Astronomy module (Pass 4)
   Bespoke native tools: animated solar-system orrery, moon phases, planet facts.
   Registers with fluxStudyHub.
   ========================================================================== */
(function () {
  'use strict';
  function boot() {
    const H = window.fluxStudyHub;
    if (!H || !H.register) { return setTimeout(boot, 60); }
    const esc = H.helpers.esc;
    const accent = () => { const r = document.getElementById('fshRoot'); return (r && getComputedStyle(r).getPropertyValue('--fsh-accent').trim()) || '#a06eff'; };
    function mkCanvas(host, h) { const wrap = document.createElement('div'); wrap.className = 'fsh-canvas-wrap'; const c = document.createElement('canvas'); wrap.appendChild(c); host.appendChild(wrap); const ctx = c.getContext('2d'); function size() { const w = wrap.clientWidth || 620; const dpr = Math.min(2, window.devicePixelRatio || 1); c.width = w * dpr; c.height = h * dpr; c.style.height = h + 'px'; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); return { w, h }; } return { c, ctx, size, alive: () => document.body.contains(c) }; }

    // name, colour, displayRadius(0..1), period(yr), diameter(Earth=1), moons, day, fact
    const PLANETS = [
      { n: 'Mercury', c: '#b7a99a', r: 0.13, p: 0.24, d: 0.38, moons: 0, day: '59 days', fact: 'Smallest planet; huge temperature swings.' },
      { n: 'Venus', c: '#e3b96b', r: 0.22, p: 0.62, d: 0.95, moons: 0, day: '243 days', fact: 'Hottest planet — thick CO₂ atmosphere; spins backwards.' },
      { n: 'Earth', c: '#4f9be3', r: 0.31, p: 1, d: 1, moons: 1, day: '24 h', fact: 'The only known world with life and liquid surface water.' },
      { n: 'Mars', c: '#e0664b', r: 0.40, p: 1.88, d: 0.53, moons: 2, day: '24.6 h', fact: 'The "Red Planet" — iron-oxide dust; tallest volcano in the system.' },
      { n: 'Jupiter', c: '#d6a06a', r: 0.56, p: 11.86, d: 11.2, moons: 95, day: '9.9 h', fact: 'Largest planet; the Great Red Spot is a centuries-old storm.' },
      { n: 'Saturn', c: '#e6d3a3', r: 0.69, p: 29.5, d: 9.4, moons: 146, day: '10.7 h', fact: 'Famous icy rings; low enough density to float on water.' },
      { n: 'Uranus', c: '#9fe0e0', r: 0.82, p: 84, d: 4, moons: 28, day: '17 h', fact: 'Tipped on its side — rolls around the Sun.' },
      { n: 'Neptune', c: '#5b6bdc', r: 0.95, p: 165, d: 3.9, moons: 16, day: '16 h', fact: 'Windiest planet — supersonic storms; farthest major planet.' },
    ];
    let astroSel = 2;
    function planetInfoHTML(i) { const p = PLANETS[i]; return `<div class="fsh-keyinfo"><h3 style="margin:0 0 8px;font-size:20px"><span style="display:inline-block;width:14px;height:14px;border-radius:50%;background:${p.c};vertical-align:middle;margin-right:8px"></span>${esc(p.n)}</h3>
      <div class="row"><span>Orbital period</span><span>${p.p} yr</span></div><div class="row"><span>Diameter (Earth=1)</span><span>${p.d}×</span></div>
      <div class="row"><span>Moons</span><span>${p.moons}</span></div><div class="row"><span>Day length</span><span>${esc(p.day)}</span></div>
      <p style="margin-top:12px;color:var(--fsh-ink-2);font-size:13.5px;line-height:1.6">${esc(p.fact)}</p></div>`; }
    function renderOrrery(body) {
      body.innerHTML = `<div class="fsh-card" style="padding:20px"><h3 style="margin:0 0 4px;font-size:16px">🪐 Solar system</h3><p class="sub" style="color:var(--fsh-mut);font-size:12px;margin:0 0 14px">Planets orbit at their real relative speeds. Tap a planet (or chip) for facts.</p>
        <div class="fsh-ring-wrap"><div id="orCanvas"></div><div id="orInfo">${planetInfoHTML(astroSel)}</div></div>
        <div class="fsh-chips-row" style="margin-top:14px">${PLANETS.map((p, i) => `<button type="button" class="fsh-cat-chip" data-pl="${i}"><span class="dot" style="background:${p.c}"></span>${esc(p.n)}</button>`).join('')}</div></div>`;
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
      document.getElementById('orCanvas').addEventListener('click', (e) => { const rect = cv.c.getBoundingClientRect(); const mx = e.clientX - rect.left, my = e.clientY - rect.top; let best = -1, bd = 1e9; dots.forEach((d) => { const dd = Math.hypot(d.x - mx, d.y - my); if (dd < bd) { bd = dd; best = d.i; } }); if (best >= 0 && bd < 40) { astroSel = best; document.getElementById('orInfo').innerHTML = planetInfoHTML(astroSel); } });
      body.querySelectorAll('[data-pl]').forEach((b) => b.addEventListener('click', () => { astroSel = +b.dataset.pl; document.getElementById('orInfo').innerHTML = planetInfoHTML(astroSel); }));
      requestAnimationFrame(draw);
    }

    // ── Moon phases ──────────────────────────────────────────────────────────
    const PHASES = [['New Moon', 0], ['Waxing Crescent', 0.125], ['First Quarter', 0.25], ['Waxing Gibbous', 0.375], ['Full Moon', 0.5], ['Waning Gibbous', 0.625], ['Last Quarter', 0.75], ['Waning Crescent', 0.875]];
    function moonSVG(frac) {
      const lit = frac <= 0.5 ? frac * 2 : (1 - frac) * 2; // illuminated fraction 0..1
      const waxing = frac < 0.5; const r = 26, cx = 30, cy = 30;
      const offset = (1 - lit) * r * 2 * (waxing ? 1 : -1);
      const id = 'm' + ((frac * 1000) | 0);
      return `<svg width="60" height="60" viewBox="0 0 60 60"><defs><clipPath id="${id}"><circle cx="${cx}" cy="${cy}" r="${r}"/></clipPath></defs><circle cx="${cx}" cy="${cy}" r="${r}" fill="#2a3144"/><g clip-path="url(#${id})"><circle cx="${cx + offset}" cy="${cy}" r="${r}" fill="#eef2ff"/></g><circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="rgba(255,255,255,.25)"/></svg>`;
    }
    function renderMoon(body) {
      body.innerHTML = `<div class="fsh-card" style="padding:20px"><h3 style="margin:0 0 12px;font-size:16px">🌙 Moon phases</h3><div class="fsh-ion-grid" style="grid-template-columns:repeat(auto-fill,minmax(120px,1fr))">${PHASES.map((p) => `<div class="fsh-ion" style="text-align:center">${moonSVG(p[1])}<div class="n" style="margin-top:6px">${esc(p[0])}</div></div>`).join('')}</div></div>`;
    }

    // ── Planet facts grid ────────────────────────────────────────────────────
    function renderFacts(body) {
      body.innerHTML = `<div class="fsh-card" style="padding:20px"><h3 style="margin:0 0 12px;font-size:16px">✨ Planet facts</h3><div class="fsh-formula-list">${PLANETS.map((p) => `<div class="fsh-formula"><div class="fx" style="font-size:14px;font-family:inherit"><span style="display:inline-block;width:11px;height:11px;border-radius:50%;background:${p.c};margin-right:6px"></span>${esc(p.n)}</div><div class="nm" style="margin-top:4px">${p.p} yr orbit · ${p.moons} moons · ${p.d}× Earth</div><div class="nm" style="color:var(--fsh-ink-2)">${esc(p.fact)}</div></div>`).join('')}</div></div>`;
    }

    H.register('astronomy', [
      { id: 'orrery', name: 'Solar system', icon: '🪐', desc: 'solar system planets orbit orrery sun', render: renderOrrery, ai: { name: 'planetInfo', description: 'Facts about a planet. Arg: planet name.', params: { planet: 'string' }, run: (a) => { const p = PLANETS.find((x) => x.n.toLowerCase() === String(a).trim().toLowerCase()); if (!p) throw new Error('Unknown planet'); return { name: p.n, orbitYears: p.p, diameterEarths: p.d, moons: p.moons, day: p.day, fact: p.fact }; } } },
      { id: 'moon', name: 'Moon phases', icon: '🌙', desc: 'moon phases lunar cycle new full', render: renderMoon },
      { id: 'facts', name: 'Planet facts', icon: '✨', desc: 'planet facts reference astronomy', render: renderFacts },
    ]);
  }
  boot();
})();
