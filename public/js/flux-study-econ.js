/* ============================================================================
   FLUX STUDY HUB · Economics module (Pass 3)
   Bespoke native tools: supply & demand sim, elasticity calculator, compound
   interest / TVM, formula sheet. Registers with fluxStudyHub.
   ========================================================================== */
(function () {
  'use strict';
  function boot() {
    const H = window.fluxStudyHub;
    if (!H || !H.register) { return setTimeout(boot, 60); }
    const esc = H.helpers.esc;
    const accent = () => { const r = document.getElementById('fshRoot'); return (r && getComputedStyle(r).getPropertyValue('--fsh-accent').trim()) || '#f4a13f'; };
    function mkCanvas(host, h) { const wrap = document.createElement('div'); wrap.className = 'fsh-canvas-wrap'; const c = document.createElement('canvas'); wrap.appendChild(c); host.appendChild(wrap); const ctx = c.getContext('2d'); function size() { const w = wrap.clientWidth || 620; const dpr = Math.min(2, window.devicePixelRatio || 1); c.width = w * dpr; c.height = h * dpr; c.style.height = h + 'px'; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); return { w, h }; } return { c, ctx, size, alive: () => document.body.contains(c) }; }
    const slider = (id, label, min, max, val, step, unit) => `<div class="fsh-ws-group"><div class="fsh-label"><span>${label}</span><b id="${id}_v">${val}${unit || ''}</b></div><input id="${id}" class="fsh-range" type="range" min="${min}" max="${max}" step="${step || 1}" value="${val}"></div>`;
    function kv(s) { const o = {}; String(s).split(/[\s,]+/).forEach((t) => { const m = t.split('='); if (m.length === 2) o[m[0].trim().toLowerCase()] = parseFloat(m[1]); }); return o; }

    // ── Supply & demand ──────────────────────────────────────────────────────
    function renderSD(body) {
      body.innerHTML = `<div class="fsh-card" style="padding:20px"><h3 style="margin:0 0 4px;font-size:16px">📉 Supply &amp; demand</h3><p class="sub" style="color:var(--fsh-mut);font-size:12px;margin:0 0 14px">Shift the curves and watch the market equilibrium move.</p>
        <div id="sdCanvas"></div>
        <div class="fsh-sim-controls">${slider('sdD', 'Demand shift', 20, 120, 90, 1, '')}${slider('sdS', 'Supply shift', 0, 80, 10, 1, '')}${slider('sdSl', 'Slope', 1, 6, 3, 0.5, '')}</div>
        <div class="fsh-sim-readout"><div class="fsh-readout-pill">Eq. price<b id="sdP">–</b></div><div class="fsh-readout-pill">Eq. quantity<b id="sdQ">–</b></div></div></div>`;
      const cv = mkCanvas(document.getElementById('sdCanvas'), 280);
      function draw() {
        if (!cv.alive()) return; const { w, h } = cv.size(), ctx = cv.ctx;
        const a = +document.getElementById('sdD').value, c = +document.getElementById('sdS').value, b = +document.getElementById('sdSl').value, d = b;
        document.getElementById('sdD_v').textContent = a; document.getElementById('sdS_v').textContent = c; document.getElementById('sdSl_v').textContent = b;
        const Qstar = (a - c) / (b + d), Pstar = a - b * Qstar;
        document.getElementById('sdP').textContent = Pstar.toFixed(1); document.getElementById('sdQ').textContent = Qstar.toFixed(1);
        const pad = 36, maxQ = 24, maxP = 130; const X = (q) => pad + q / maxQ * (w - pad - 12), Y = (p) => h - pad - p / maxP * (h - pad - 12); const acc = accent();
        ctx.clearRect(0, 0, w, h); ctx.strokeStyle = 'rgba(255,255,255,.14)'; ctx.beginPath(); ctx.moveTo(pad, 8); ctx.lineTo(pad, h - pad); ctx.lineTo(w - 12, h - pad); ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,.5)'; ctx.font = '11px system-ui'; ctx.fillText('P', 12, 18); ctx.fillText('Q', w - 24, h - 16);
        ctx.strokeStyle = '#5b8def'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(X(0), Y(a)); ctx.lineTo(X(maxQ), Y(a - b * maxQ)); ctx.stroke();
        ctx.strokeStyle = acc; ctx.beginPath(); ctx.moveTo(X(0), Y(c)); ctx.lineTo(X(maxQ), Y(c + d * maxQ)); ctx.stroke();
        if (Qstar > 0 && Pstar > 0) { ctx.strokeStyle = 'rgba(255,255,255,.3)'; ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.moveTo(X(Qstar), Y(Pstar)); ctx.lineTo(X(Qstar), h - pad); ctx.moveTo(X(Qstar), Y(Pstar)); ctx.lineTo(pad, Y(Pstar)); ctx.stroke(); ctx.setLineDash([]); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(X(Qstar), Y(Pstar), 6, 0, 7); ctx.fill(); }
        ctx.fillStyle = '#5b8def'; ctx.fillText('D', X(maxQ) - 16, Y(a - b * maxQ) + 4); ctx.fillStyle = acc; ctx.fillText('S', X(maxQ) - 16, Y(c + d * maxQ) - 6);
      }
      ['sdD', 'sdS', 'sdSl'].forEach((id) => document.getElementById(id).addEventListener('input', draw)); requestAnimationFrame(draw);
    }

    // ── Elasticity ───────────────────────────────────────────────────────────
    function elasticity(o) {
      const { p1, q1, p2, q2 } = o; if ([p1, q1, p2, q2].some((x) => x == null || isNaN(x))) throw new Error('Need p1, q1, p2, q2');
      const dQ = (q2 - q1) / ((q1 + q2) / 2), dP = (p2 - p1) / ((p1 + p2) / 2); if (dP === 0) throw new Error('Price change is zero');
      const ped = dQ / dP, abs = Math.abs(ped);
      return { ped: +ped.toFixed(3), kind: abs > 1 ? 'Elastic' : abs < 1 ? 'Inelastic' : 'Unit elastic' };
    }
    function renderElasticity(body) {
      const f = (id, l) => `<div class="fsh-ws-group"><div class="fsh-label"><span>${l}</span></div><input id="el_${id}" class="fsh-input"></div>`;
      body.innerHTML = `<div class="fsh-card" style="padding:20px"><h3 style="margin:0 0 4px;font-size:16px">📊 Price elasticity (PED)</h3><p class="sub" style="color:var(--fsh-mut);font-size:12px;margin:0 0 14px">Midpoint method between two price/quantity points.</p>
        <div class="fsh-ws-controls">${f('p1', 'Price 1')}${f('q1', 'Quantity 1')}${f('p2', 'Price 2')}${f('q2', 'Quantity 2')}</div>
        <div style="margin-top:14px"><button type="button" class="fsh-btn" id="elGo">Compute</button></div><div class="fsh-out" id="elOut"></div></div>`;
      const get = (id) => { const x = document.getElementById('el_' + id).value; return x === '' ? null : parseFloat(x); };
      document.getElementById('elGo').addEventListener('click', () => { const o = document.getElementById('elOut'); try { const r = elasticity({ p1: get('p1'), q1: get('q1'), p2: get('p2'), q2: get('q2') }); o.innerHTML = `<span class="big">PED = ${r.ped}</span> &nbsp;<span class="fsh-shellbar">${esc(r.kind)}</span>`; } catch (e) { o.innerHTML = `<span class="fsh-err">${esc(e.message)}</span>`; } });
    }

    // ── Compound interest ────────────────────────────────────────────────────
    function compound(o) {
      const P = o.p, r = o.r / 100, t = o.t, n = o.n || 1; if ([P, o.r, t].some((x) => x == null || isNaN(x))) throw new Error('Need principal, rate, years');
      const A = P * Math.pow(1 + r / n, n * t);
      return { future: +A.toFixed(2), interest: +(A - P).toFixed(2) };
    }
    function renderCompound(body) {
      body.innerHTML = `<div class="fsh-card" style="padding:20px"><h3 style="margin:0 0 4px;font-size:16px">💰 Compound interest</h3><p class="sub" style="color:var(--fsh-mut);font-size:12px;margin:0 0 14px">A = P(1 + r/n)<sup>nt</sup></p>
        <div class="fsh-ws-controls"><div class="fsh-ws-group"><div class="fsh-label"><span>Principal</span></div><input id="ci_p" class="fsh-input" value="1000"></div>
        <div class="fsh-ws-group"><div class="fsh-label"><span>Rate % / yr</span></div><input id="ci_r" class="fsh-input" value="5"></div>
        <div class="fsh-ws-group"><div class="fsh-label"><span>Years</span></div><input id="ci_t" class="fsh-input" value="10"></div>
        <div class="fsh-ws-group"><div class="fsh-label"><span>Compounds / yr</span></div><input id="ci_n" class="fsh-input" value="12"></div></div>
        <div style="margin-top:14px"><button type="button" class="fsh-btn" id="ciGo">Compute</button></div><div class="fsh-out" id="ciOut"></div></div>`;
      const get = (id) => { const x = document.getElementById('ci_' + id).value; return x === '' ? null : parseFloat(x); };
      document.getElementById('ciGo').addEventListener('click', () => { const o = document.getElementById('ciOut'); try { const r = compound({ p: get('p'), r: get('r'), t: get('t'), n: get('n') }); o.innerHTML = `<span class="big">${r.future.toLocaleString()}</span><div class="fsh-note">Interest earned: ${r.interest.toLocaleString()}</div>`; } catch (e) { o.innerHTML = `<span class="fsh-err">${esc(e.message)}</span>`; } });
    }

    // ── Formula sheet ────────────────────────────────────────────────────────
    const F = [['GDP (expenditure)', 'Y = C + I + G + (X − M)'], ['PED', '%ΔQd / %ΔP'], ['PES', '%ΔQs / %ΔP'], ['YED', '%ΔQd / %ΔY'], ['Inflation (CPI)', '(CPI₂ − CPI₁)/CPI₁ ×100'], ['Marginal cost', 'ΔTC / ΔQ'], ['Profit', 'TR − TC'], ['Multiplier', '1 / (1 − MPC)'], ['Real GDP', 'Nominal / deflator ×100'], ['Unemployment', 'Unemployed / labour force ×100']];
    function renderFormulas(body) { body.innerHTML = `<div class="fsh-card" style="padding:20px"><h3 style="margin:0 0 12px;font-size:16px">Σ Economics formulas</h3><div class="fsh-formula-list">${F.map((x) => `<div class="fsh-formula"><div class="nm">${esc(x[0])}</div><div class="fx" style="font-size:13px">${esc(x[1])}</div></div>`).join('')}</div></div>`; }

    H.register('econ', [
      { id: 'sd', name: 'Supply/Demand', icon: '📉', desc: 'supply demand equilibrium curve market price quantity', render: renderSD },
      { id: 'elasticity', name: 'Elasticity', icon: '📊', desc: 'price elasticity demand ped midpoint', render: renderElasticity, ai: { name: 'elasticity', description: 'PED midpoint. Arg: "p1=10 q1=100 p2=8 q2=140".', params: { p1: '', q1: '', p2: '', q2: '' }, run: (a) => elasticity(typeof a === 'string' ? kv(a) : a) } },
      { id: 'compound', name: 'Compound interest', icon: '💰', desc: 'compound interest future value savings finance', render: renderCompound, ai: { name: 'compoundInterest', description: 'Future value. Arg: "p=1000 r=5 t=10 n=12".', params: { p: '', r: '', t: '', n: '' }, run: (a) => compound(typeof a === 'string' ? kv(a) : a) } },
      { id: 'formulas', name: 'Formulas', icon: 'Σ', desc: 'economics formulas gdp elasticity multiplier', render: renderFormulas },
    ]);
  }
  boot();
})();
