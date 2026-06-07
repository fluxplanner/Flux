/* ============================================================================
   FLUX STUDY HUB · Physics module (Pass 1)
   Bespoke native tools: projectile sim, SUVAT solver, Ohm's law, wave
   visualizer, formula sheet. Registers with window.fluxStudyHub.
   ========================================================================== */
(function () {
  'use strict';
  function boot() {
    const H = window.fluxStudyHub;
    if (!H || !H.register) { return setTimeout(boot, 60); }
    const esc = H.helpers.esc;

    function mkCanvas(body, h) {
      const wrap = document.createElement('div'); wrap.className = 'fsh-canvas-wrap';
      const c = document.createElement('canvas'); wrap.appendChild(c); body.appendChild(wrap);
      const ctx = c.getContext('2d');
      function size() { const w = wrap.clientWidth || 620; const dpr = Math.min(2, window.devicePixelRatio || 1); c.width = w * dpr; c.height = h * dpr; c.style.height = h + 'px'; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); return { w, h }; }
      return { c, ctx, size, alive: () => document.body.contains(c) };
    }
    const slider = (id, label, min, max, val, step, unit) => `<div class="fsh-ws-group"><div class="fsh-label"><span>${label}</span><b id="${id}_v">${val}${unit || ''}</b></div><input id="${id}" class="fsh-range" type="range" min="${min}" max="${max}" step="${step || 1}" value="${val}"></div>`;
    const accent = () => { const r = document.getElementById('fshRoot'); return (r && getComputedStyle(r).getPropertyValue('--fsh-accent').trim()) || '#34d0ff'; };
    const $out = (id) => document.getElementById(id);
    function kv(s) { const o = {}; String(s).split(/[\s,]+/).forEach((t) => { const m = t.split('='); if (m.length === 2) o[m[0].trim()] = parseFloat(m[1]); }); return o; }

    // ── Projectile motion ──────────────────────────────────────────────────
    function renderProjectile(body) {
      body.innerHTML = `<div class="fsh-card" style="padding:20px"><h3 style="margin:0 0 4px;font-size:16px">🎯 Projectile motion</h3><p class="sub" style="color:var(--fsh-mut);font-size:12px;margin:0 0 14px">Launch angle &amp; speed → live trajectory, range, peak height and flight time.</p>
        <div id="pjCanvas"></div>
        <div class="fsh-sim-controls">${slider('pjAng', 'Angle', 5, 85, 45, 1, '°')}${slider('pjVel', 'Speed', 5, 60, 30, 1, ' m/s')}${slider('pjG', 'Gravity', 1, 25, 9.8, 0.1, ' m/s²')}</div>
        <div class="fsh-sim-readout"><div class="fsh-readout-pill">Range<b id="pjR">–</b></div><div class="fsh-readout-pill">Peak height<b id="pjH">–</b></div><div class="fsh-readout-pill">Flight time<b id="pjT">–</b></div></div></div>`;
      const cv = mkCanvas(document.getElementById('pjCanvas'), 280); let t0 = performance.now();
      const params = () => ({ ang: +document.getElementById('pjAng').value, v: +document.getElementById('pjVel').value, g: +document.getElementById('pjG').value });
      function draw(now) {
        if (!cv.alive()) return;
        const { w, h } = cv.size(), ctx = cv.ctx; const { ang, v, g } = params();
        const rad = ang * Math.PI / 180, T = 2 * v * Math.sin(rad) / g, R = v * v * Math.sin(2 * rad) / g, Hm = v * v * Math.sin(rad) * Math.sin(rad) / (2 * g);
        document.getElementById('pjAng_v').textContent = ang + '°'; document.getElementById('pjVel_v').textContent = v + ' m/s'; document.getElementById('pjG_v').textContent = g + ' m/s²';
        document.getElementById('pjR').textContent = R.toFixed(1) + ' m'; document.getElementById('pjH').textContent = Hm.toFixed(1) + ' m'; document.getElementById('pjT').textContent = T.toFixed(2) + ' s';
        const pad = 34, s = Math.min((w - pad * 2) / Math.max(R, 1), (h - pad * 2) / Math.max(Hm, 1));
        const X = (x) => pad + x * s, Y = (y) => h - pad - y * s; const acc = accent();
        ctx.clearRect(0, 0, w, h); ctx.strokeStyle = 'rgba(255,255,255,.12)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(pad, h - pad); ctx.lineTo(w - pad, h - pad); ctx.stroke();
        ctx.strokeStyle = acc; ctx.lineWidth = 2.5; ctx.beginPath();
        for (let x = 0; x <= R; x += R / 120) { const y = x * Math.tan(rad) - g * x * x / (2 * v * v * Math.cos(rad) * Math.cos(rad)); x === 0 ? ctx.moveTo(X(x), Y(y)) : ctx.lineTo(X(x), Y(Math.max(0, y))); }
        ctx.stroke();
        const tt = ((now - t0) / 1000) % (T * 1.25); if (tt <= T) { const x = v * Math.cos(rad) * tt, y = v * Math.sin(rad) * tt - 0.5 * g * tt * tt; ctx.fillStyle = '#fff'; ctx.shadowColor = acc; ctx.shadowBlur = 14; ctx.beginPath(); ctx.arc(X(x), Y(Math.max(0, y)), 6, 0, 7); ctx.fill(); ctx.shadowBlur = 0; }
        requestAnimationFrame(draw);
      }
      body.addEventListener('input', (e) => { if (/^pj/.test(e.target.id)) t0 = performance.now(); });
      requestAnimationFrame(draw);
    }

    // ── SUVAT solver ───────────────────────────────────────────────────────
    function suvatSolve(o) {
      const k = ['u', 'v', 'a', 't', 's'].filter((x) => o[x] != null && !isNaN(o[x])); if (k.length < 3) throw new Error('Give 3 of u, v, a, t, s');
      let { u, v, a, t, s } = o; const has = (set) => set.every((x) => k.indexOf(x) !== -1);
      if (has(['u', 'v', 'a'])) { t = (v - u) / a; s = (v * v - u * u) / (2 * a); }
      else if (has(['u', 'v', 't'])) { a = (v - u) / t; s = (u + v) / 2 * t; }
      else if (has(['u', 'v', 's'])) { a = (v * v - u * u) / (2 * s); t = 2 * s / (u + v); }
      else if (has(['u', 'a', 't'])) { v = u + a * t; s = u * t + 0.5 * a * t * t; }
      else if (has(['u', 'a', 's'])) { v = Math.sqrt(u * u + 2 * a * s); t = (v - u) / a; }
      else if (has(['u', 't', 's'])) { a = 2 * (s - u * t) / (t * t); v = u + a * t; }
      else if (has(['v', 'a', 't'])) { u = v - a * t; s = v * t - 0.5 * a * t * t; }
      else if (has(['v', 'a', 's'])) { u = Math.sqrt(v * v - 2 * a * s); t = (v - u) / a; }
      else if (has(['v', 't', 's'])) { a = 2 * (v * t - s) / (t * t); u = v - a * t; }
      else if (has(['a', 't', 's'])) { u = (s - 0.5 * a * t * t) / t; v = u + a * t; }
      const r = { u, v, a, t, s }; Object.keys(r).forEach((x) => { r[x] = Math.round(r[x] * 1000) / 1000; }); return r;
    }
    function renderSuvat(body) {
      const f = (id, l, u) => `<div class="fsh-ws-group"><div class="fsh-label"><span>${l}</span></div><input id="sv_${id}" class="fsh-input" placeholder="${u}"></div>`;
      body.innerHTML = `<div class="fsh-card" style="padding:20px"><h3 style="margin:0 0 4px;font-size:16px">📏 Kinematics (SUVAT)</h3><p class="sub" style="color:var(--fsh-mut);font-size:12px;margin:0 0 14px">Enter any three; leave the rest blank to solve for them.</p>
        <div class="fsh-ws-controls">${f('u', 'u — initial velocity', 'm/s')}${f('v', 'v — final velocity', 'm/s')}${f('a', 'a — acceleration', 'm/s²')}${f('t', 't — time', 's')}${f('s', 's — displacement', 'm')}</div>
        <div style="margin-top:14px"><button type="button" class="fsh-btn" id="svGo">Solve</button></div><div class="fsh-out" id="svOut"></div></div>`;
      const get = (id) => { const x = document.getElementById('sv_' + id).value; return x === '' ? null : parseFloat(x); };
      document.getElementById('svGo').addEventListener('click', () => { const o = $out('svOut'); try { const r = suvatSolve({ u: get('u'), v: get('v'), a: get('a'), t: get('t'), s: get('s') }); o.innerHTML = `<div class="fsh-sim-readout"><div class="fsh-readout-pill">u<b>${r.u} m/s</b></div><div class="fsh-readout-pill">v<b>${r.v} m/s</b></div><div class="fsh-readout-pill">a<b>${r.a} m/s²</b></div><div class="fsh-readout-pill">t<b>${r.t} s</b></div><div class="fsh-readout-pill">s<b>${r.s} m</b></div></div>`; } catch (e) { o.innerHTML = `<span class="fsh-err">${esc(e.message)}</span>`; } });
    }

    // ── Ohm's law ──────────────────────────────────────────────────────────
    function ohms(o) {
      const k = ['V', 'I', 'R', 'P'].filter((x) => o[x] != null && !isNaN(o[x])); if (k.length < 2) throw new Error('Give any two of V, I, R, P');
      let { V, I, R, P } = o;
      if (V != null && I != null) { R = V / I; P = V * I; }
      else if (V != null && R != null) { I = V / R; P = V * V / R; }
      else if (I != null && R != null) { V = I * R; P = I * I * R; }
      else if (V != null && P != null) { I = P / V; R = V * V / P; }
      else if (I != null && P != null) { V = P / I; R = P / (I * I); }
      else if (R != null && P != null) { I = Math.sqrt(P / R); V = Math.sqrt(P * R); }
      const r = { V, I, R, P }; Object.keys(r).forEach((x) => r[x] = Math.round(r[x] * 1000) / 1000); return r;
    }
    function renderOhms(body) {
      const f = (id, l) => `<div class="fsh-ws-group"><div class="fsh-label"><span>${l}</span></div><input id="oh_${id}" class="fsh-input"></div>`;
      body.innerHTML = `<div class="fsh-card" style="padding:20px"><h3 style="margin:0 0 4px;font-size:16px">⚡ Ohm's law &amp; power</h3><p class="sub" style="color:var(--fsh-mut);font-size:12px;margin:0 0 14px">V = IR, P = VI. Enter any two.</p>
        <div class="fsh-ws-controls">${f('V', 'V — voltage (V)')}${f('I', 'I — current (A)')}${f('R', 'R — resistance (Ω)')}${f('P', 'P — power (W)')}</div>
        <div style="margin-top:14px"><button type="button" class="fsh-btn" id="ohGo">Solve</button></div><div class="fsh-out" id="ohOut"></div></div>`;
      const get = (id) => { const x = document.getElementById('oh_' + id).value; return x === '' ? null : parseFloat(x); };
      document.getElementById('ohGo').addEventListener('click', () => { const o = $out('ohOut'); try { const r = ohms({ V: get('V'), I: get('I'), R: get('R'), P: get('P') }); o.innerHTML = `<div class="fsh-sim-readout"><div class="fsh-readout-pill">V<b>${r.V} V</b></div><div class="fsh-readout-pill">I<b>${r.I} A</b></div><div class="fsh-readout-pill">R<b>${r.R} Ω</b></div><div class="fsh-readout-pill">P<b>${r.P} W</b></div></div>`; } catch (e) { o.innerHTML = `<span class="fsh-err">${esc(e.message)}</span>`; } });
    }

    // ── Wave visualizer ────────────────────────────────────────────────────
    function renderWave(body) {
      body.innerHTML = `<div class="fsh-card" style="padding:20px"><h3 style="margin:0 0 4px;font-size:16px">〜 Wave visualizer</h3><p class="sub" style="color:var(--fsh-mut);font-size:12px;margin:0 0 14px">v = fλ. Adjust amplitude, frequency &amp; wavelength.</p>
        <div id="wvCanvas"></div><div class="fsh-sim-controls">${slider('wvA', 'Amplitude', 10, 90, 50, 1, '')}${slider('wvF', 'Frequency', 1, 8, 2, 0.1, ' Hz')}${slider('wvL', 'Wavelength', 60, 400, 180, 5, ' px')}</div>
        <div class="fsh-sim-readout"><div class="fsh-readout-pill">Wave speed<b id="wvV">–</b></div></div></div>`;
      const cv = mkCanvas(document.getElementById('wvCanvas'), 220); let t0 = performance.now();
      function draw(now) {
        if (!cv.alive()) return; const { w, h } = cv.size(), ctx = cv.ctx;
        const A = +document.getElementById('wvA').value, F = +document.getElementById('wvF').value, L = +document.getElementById('wvL').value;
        document.getElementById('wvA_v').textContent = A; document.getElementById('wvF_v').textContent = F + ' Hz'; document.getElementById('wvL_v').textContent = L + ' px';
        document.getElementById('wvV').textContent = (F * L).toFixed(0) + ' px/s';
        const acc = accent(); ctx.clearRect(0, 0, w, h); ctx.strokeStyle = 'rgba(255,255,255,.1)'; ctx.beginPath(); ctx.moveTo(0, h / 2); ctx.lineTo(w, h / 2); ctx.stroke();
        const ph = (now - t0) / 1000 * F * 2 * Math.PI; ctx.strokeStyle = acc; ctx.lineWidth = 2.5; ctx.beginPath();
        for (let x = 0; x <= w; x++) { const y = h / 2 - A * Math.sin((x / L) * 2 * Math.PI - ph); x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); } ctx.stroke();
        requestAnimationFrame(draw);
      }
      requestAnimationFrame(draw);
    }

    // ── Formula sheet ──────────────────────────────────────────────────────
    const FORMULAS = [['Kinematics', 'v = u + at'], ['', 's = ut + ½at²'], ['', 'v² = u² + 2as'], ['Force', 'F = ma'], ['Momentum', 'p = mv'], ['Work', 'W = Fd cosθ'], ['Kinetic E', 'Eₖ = ½mv²'], ['Potential E', 'Eₚ = mgh'], ["Ohm's law", 'V = IR'], ['Power', 'P = VI = I²R'], ['Wave', 'v = fλ'], ['Frequency', 'f = 1/T'], ['Gravitation', 'F = Gm₁m₂/r²'], ['Pressure', 'P = F/A'], ['Density', 'ρ = m/V'], ['Hooke', 'F = kx']];
    function renderFormulas(body) { body.innerHTML = `<div class="fsh-card" style="padding:20px"><h3 style="margin:0 0 12px;font-size:16px">📚 Formula sheet</h3><div class="fsh-formula-list">${FORMULAS.map((f) => `<div class="fsh-formula"><div class="nm">${esc(f[0] || '·')}</div><div class="fx">${esc(f[1])}</div></div>`).join('')}</div></div>`; }

    H.register('physics', [
      { id: 'projectile', name: 'Projectile', icon: '🎯', desc: 'projectile motion launch trajectory range height', render: renderProjectile, ai: { name: 'projectile', description: 'Projectile range/height/time. Arg: "angle=45 v=30 g=9.8".', params: { angle: 'deg', v: 'm/s', g: 'm/s2' }, run: (a) => { const o = typeof a === 'string' ? kv(a) : a; const ang = (o.angle || 45) * Math.PI / 180, v = o.v || 30, g = o.g || 9.8; return { range: +(v * v * Math.sin(2 * ang) / g).toFixed(2), peak: +((v * v * Math.sin(ang) * Math.sin(ang)) / (2 * g)).toFixed(2), time: +(2 * v * Math.sin(ang) / g).toFixed(2) }; } } },
      { id: 'suvat', name: 'Kinematics', icon: '📏', desc: 'suvat kinematics velocity acceleration', render: renderSuvat, ai: { name: 'suvat', description: 'Solve SUVAT. Arg: "u=0 a=9.8 t=3".', params: { u: '', v: '', a: '', t: '', s: '' }, run: (a) => suvatSolve(typeof a === 'string' ? kv(a) : a) } },
      { id: 'ohms', name: "Ohm's law", icon: '⚡', desc: 'ohms law voltage current resistance power circuit', render: renderOhms, ai: { name: 'ohmsLaw', description: "Ohm's law. Arg: \"V=12 R=4\".", params: { V: '', I: '', R: '', P: '' }, run: (a) => ohms(typeof a === 'string' ? kv(a) : a) } },
      { id: 'wave', name: 'Waves', icon: '〜', desc: 'wave amplitude frequency wavelength', render: renderWave },
      { id: 'formulas', name: 'Formulas', icon: '📚', desc: 'physics formula sheet equations', render: renderFormulas },
    ]);
  }
  boot();
})();
