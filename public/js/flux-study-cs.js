/* ============================================================================
   FLUX STUDY HUB · Computer Science module (Pass 2)
   Bespoke native tools: sorting visualizer, base converter, Big-O chart,
   ASCII table, logic gates / truth tables. Registers with fluxStudyHub.
   ========================================================================== */
(function () {
  'use strict';
  function boot() {
    const H = window.fluxStudyHub;
    if (!H || !H.register) { return setTimeout(boot, 60); }
    const esc = H.helpers.esc;
    const accent = () => { const r = document.getElementById('fshRoot'); return (r && getComputedStyle(r).getPropertyValue('--fsh-accent').trim()) || '#4fb6c9'; };
    function mkCanvas(host, h) { const wrap = document.createElement('div'); wrap.className = 'fsh-canvas-wrap'; const c = document.createElement('canvas'); wrap.appendChild(c); host.appendChild(wrap); const ctx = c.getContext('2d'); function size() { const w = wrap.clientWidth || 620; const dpr = Math.min(2, window.devicePixelRatio || 1); c.width = w * dpr; c.height = h * dpr; c.style.height = h + 'px'; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); return { w, h }; } return { c, ctx, size, alive: () => document.body.contains(c) }; }

    // ── Sorting visualizer ───────────────────────────────────────────────────
    function genFrames(src, algo) {
      const a = src.slice(), frames = []; const snap = (hi, sorted) => frames.push({ arr: a.slice(), hi: hi || [], sorted: sorted || [] });
      if (algo === 'bubble') { for (let i = 0; i < a.length; i++) for (let j = 0; j < a.length - 1 - i; j++) { snap([j, j + 1]); if (a[j] > a[j + 1]) { [a[j], a[j + 1]] = [a[j + 1], a[j]]; snap([j, j + 1]); } } }
      else if (algo === 'selection') { for (let i = 0; i < a.length; i++) { let m = i; for (let j = i + 1; j < a.length; j++) { snap([m, j]); if (a[j] < a[m]) m = j; } [a[i], a[m]] = [a[m], a[i]]; snap([i, m]); } }
      else if (algo === 'insertion') { for (let i = 1; i < a.length; i++) { let j = i; while (j > 0 && a[j - 1] > a[j]) { snap([j - 1, j]); [a[j - 1], a[j]] = [a[j], a[j - 1]]; j--; } } }
      else if (algo === 'quick') { const qs = (lo, hi) => { if (lo >= hi) return; const p = a[hi]; let i = lo; for (let j = lo; j < hi; j++) { snap([j, hi]); if (a[j] < p) { [a[i], a[j]] = [a[j], a[i]]; i++; } } [a[i], a[hi]] = [a[hi], a[i]]; snap([i, hi]); qs(lo, i - 1); qs(i + 1, hi); }; qs(0, a.length - 1); }
      snap([], a.map((_, i) => i)); return frames;
    }
    const COMPLEXITY = { bubble: 'O(n²)', selection: 'O(n²)', insertion: 'O(n²)', quick: 'O(n log n) avg' };
    function renderSort(body) {
      body.innerHTML = `<div class="fsh-card" style="padding:20px"><h3 style="margin:0 0 4px;font-size:16px">📊 Sorting visualizer</h3><p class="sub" style="color:var(--fsh-mut);font-size:12px;margin:0 0 14px">Watch each algorithm compare &amp; swap, step by step.</p>
        <div class="fsh-field" style="flex-wrap:wrap;align-items:center"><div class="fsh-seg" id="soAlgo">${[['bubble', 'Bubble'], ['insertion', 'Insertion'], ['selection', 'Selection'], ['quick', 'Quick']].map(([v, l], i) => `<button type="button" data-algo="${v}" class="${i === 0 ? 'active' : ''}">${l}</button>`).join('')}</div>
        <button type="button" class="fsh-btn" id="soPlay">▶ Play</button><button type="button" class="fsh-btn ghost" id="soShuf">⤮ Shuffle</button><span style="font-size:12px;color:var(--fsh-mut)">Speed</span><input id="soSpeed" class="fsh-range" type="range" min="1" max="60" value="28" style="max-width:140px"></div>
        <div id="soCanvas" style="margin-top:12px"></div><div class="fsh-out" id="soInfo"></div></div>`;
      const cv = mkCanvas(document.getElementById('soCanvas'), 240);
      let data = Array.from({ length: 28 }, () => 5 + Math.floor(Math.random() * 95));
      let algo = 'bubble', frames = [], fi = 0, timer = null;
      function draw(frame) { const { w, h } = cv.size(), ctx = cv.ctx; ctx.clearRect(0, 0, w, h); const n = frame.arr.length, bw = w / n, mx = Math.max.apply(null, frame.arr); const acc = accent(); for (let i = 0; i < n; i++) { const bh = frame.arr[i] / mx * (h - 8); ctx.fillStyle = frame.sorted.indexOf(i) !== -1 ? '#37c98a' : frame.hi.indexOf(i) !== -1 ? '#ff7a59' : acc; ctx.fillRect(i * bw + 1, h - bh, bw - 2, bh); } }
      function stop() { if (timer) { clearInterval(timer); timer = null; } }
      function play() { stop(); frames = genFrames(data, algo); fi = 0; document.getElementById('soInfo').innerHTML = `<span class="fsh-note">${algo} · ${COMPLEXITY[algo]} · ${frames.length} steps</span>`; const spd = +document.getElementById('soSpeed').value; timer = setInterval(() => { if (fi >= frames.length || !cv.alive()) { stop(); if (frames.length) { draw(frames[frames.length - 1]); data = frames[frames.length - 1].arr.slice(); } return; } draw(frames[fi]); fi++; }, 1000 / spd); }
      document.getElementById('soAlgo').addEventListener('click', (e) => { const b = e.target.closest('[data-algo]'); if (!b) return; algo = b.dataset.algo; document.querySelectorAll('#soAlgo button').forEach((x) => x.classList.toggle('active', x === b)); draw({ arr: data, hi: [], sorted: [] }); });
      document.getElementById('soPlay').addEventListener('click', play);
      document.getElementById('soShuf').addEventListener('click', () => { stop(); data = Array.from({ length: 28 }, () => 5 + Math.floor(Math.random() * 95)); draw({ arr: data, hi: [], sorted: [] }); });
      requestAnimationFrame(() => draw({ arr: data, hi: [], sorted: [] }));
    }

    // ── Base converter ───────────────────────────────────────────────────────
    function convertBase(val, base) {
      const n = parseInt(String(val).trim(), base); if (isNaN(n)) throw new Error('Invalid for base ' + base);
      return { dec: n.toString(10), bin: n.toString(2), oct: n.toString(8), hex: n.toString(16).toUpperCase() };
    }
    let cbBase = 10;
    function renderBase(body) {
      body.innerHTML = `<div class="fsh-card" style="padding:20px"><h3 style="margin:0 0 4px;font-size:16px">🔢 Number base converter</h3><p class="sub" style="color:var(--fsh-mut);font-size:12px;margin:0 0 14px">Convert between binary, octal, decimal and hex.</p>
        <div class="fsh-field"><div class="fsh-seg" id="cbBase">${[['2', 'Bin'], ['8', 'Oct'], ['10', 'Dec'], ['16', 'Hex']].map(([v, l]) => `<button type="button" data-b="${v}" class="${+v === cbBase ? 'active' : ''}">${l}</button>`).join('')}</div><input id="cbIn" class="fsh-input" value="255" spellcheck="false"></div>
        <div class="fsh-out" id="cbOut"></div></div>`;
      const run = () => { const o = document.getElementById('cbOut'); try { const r = convertBase(document.getElementById('cbIn').value, cbBase); o.innerHTML = `<div class="fsh-sim-readout"><div class="fsh-readout-pill">DEC<b>${r.dec}</b></div><div class="fsh-readout-pill">BIN<b>${r.bin}</b></div><div class="fsh-readout-pill">OCT<b>${r.oct}</b></div><div class="fsh-readout-pill">HEX<b>${r.hex}</b></div></div>`; } catch (e) { o.innerHTML = `<span class="fsh-err">${esc(e.message)}</span>`; } };
      document.getElementById('cbBase').addEventListener('click', (e) => { const b = e.target.closest('[data-b]'); if (!b) return; cbBase = +b.dataset.b; document.querySelectorAll('#cbBase button').forEach((x) => x.classList.toggle('active', x === b)); run(); });
      document.getElementById('cbIn').addEventListener('input', run); run();
    }

    // ── Big-O chart ──────────────────────────────────────────────────────────
    const BIGO = [['O(1)', (n) => 1, '#37c98a'], ['O(log n)', (n) => Math.log2(n + 1), '#34d0ff'], ['O(n)', (n) => n, '#5b8def'], ['O(n log n)', (n) => n * Math.log2(n + 1), '#f4a13f'], ['O(n²)', (n) => n * n, '#ff7a59'], ['O(2ⁿ)', (n) => Math.pow(2, n), '#e23e57']];
    function renderBigO(body) {
      body.innerHTML = `<div class="fsh-card" style="padding:20px"><h3 style="margin:0 0 4px;font-size:16px">📈 Big-O complexity</h3><p class="sub" style="color:var(--fsh-mut);font-size:12px;margin:0 0 14px">How operations grow as input size n increases.</p>
        <div id="boCanvas"></div><div class="fsh-chips-row" style="margin-top:12px">${BIGO.map((c) => `<span class="fsh-shellbar" style="border-color:${c[2]}"><b style="color:${c[2]}">${esc(c[0])}</b></span>`).join('')}</div></div>`;
      const cv = mkCanvas(document.getElementById('boCanvas'), 280);
      const { w, h } = cv.size(), ctx = cv.ctx; const N = 24, maxY = 120; const X = (n) => 36 + n / N * (w - 48), Y = (y) => h - 28 - Math.min(y, maxY) / maxY * (h - 44);
      ctx.clearRect(0, 0, w, h); ctx.strokeStyle = 'rgba(255,255,255,.12)'; ctx.beginPath(); ctx.moveTo(36, 8); ctx.lineTo(36, h - 28); ctx.lineTo(w - 12, h - 28); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,.5)'; ctx.font = '11px system-ui'; ctx.fillText('ops', 6, 16); ctx.fillText('n →', w - 34, h - 10);
      BIGO.forEach((c) => { ctx.strokeStyle = c[2]; ctx.lineWidth = 2.5; ctx.beginPath(); for (let n = 1; n <= N; n++) { const px = X(n), py = Y(c[1](n)); n === 1 ? ctx.moveTo(px, py) : ctx.lineTo(px, py); } ctx.stroke(); });
    }

    // ── ASCII table ──────────────────────────────────────────────────────────
    function renderAscii(body) {
      let cells = ''; for (let i = 32; i <= 126; i++) cells += `<div class="fsh-ion"><span class="f">${i === 32 ? '␠' : esc(String.fromCharCode(i))}</span><div class="n">${i} · 0x${i.toString(16).toUpperCase()}</div></div>`;
      body.innerHTML = `<div class="fsh-card" style="padding:20px"><h3 style="margin:0 0 4px;font-size:16px">🔤 ASCII table</h3><p class="sub" style="color:var(--fsh-mut);font-size:12px;margin:0 0 14px">Printable characters 32–126 with decimal &amp; hex codes.</p><div class="fsh-ion-grid" style="grid-template-columns:repeat(auto-fill,minmax(90px,1fr))">${cells}</div></div>`;
    }

    // ── Logic gates / truth tables ───────────────────────────────────────────
    const GATES = { AND: (a, b) => a & b, OR: (a, b) => a | b, NAND: (a, b) => a & b ? 0 : 1, NOR: (a, b) => a | b ? 0 : 1, XOR: (a, b) => a ^ b, XNOR: (a, b) => (a ^ b) ? 0 : 1, NOT: (a) => a ? 0 : 1 };
    let gate = 'AND';
    function renderGates(body) {
      const unary = gate === 'NOT';
      const rows = unary ? [[0], [1]] : [[0, 0], [0, 1], [1, 0], [1, 1]];
      const tbl = `<table class="fsh-sol" style="min-width:auto"><thead><tr>${unary ? '<th>A</th>' : '<th>A</th><th>B</th>'}<th>${esc(gate)}</th></tr></thead><tbody>${rows.map((r) => { const out = unary ? GATES.NOT(r[0]) : GATES[gate](r[0], r[1]); return `<tr>${r.map((x) => `<td>${x}</td>`).join('')}<td data-s="${out ? 'S' : 'I'}">${out}</td></tr>`; }).join('')}</tbody></table>`;
      body.innerHTML = `<div class="fsh-card" style="padding:20px"><h3 style="margin:0 0 4px;font-size:16px">🔌 Logic gates</h3><p class="sub" style="color:var(--fsh-mut);font-size:12px;margin:0 0 14px">Pick a gate to see its truth table.</p>
        <div class="fsh-seg" id="lgSeg" style="flex-wrap:wrap">${Object.keys(GATES).map((g) => `<button type="button" data-g="${g}" class="${g === gate ? 'active' : ''}">${g}</button>`).join('')}</div>
        <div style="margin-top:14px">${tbl}</div></div>`;
      document.getElementById('lgSeg').addEventListener('click', (e) => { const b = e.target.closest('[data-g]'); if (!b) return; gate = b.dataset.g; renderGates(body); });
    }

    H.register('cs', [
      { id: 'sort', name: 'Sorting', icon: '📊', desc: 'sorting visualizer algorithm bubble quick insertion selection', render: renderSort },
      { id: 'base', name: 'Base converter', icon: '🔢', desc: 'number base binary hex octal decimal convert', render: renderBase, ai: { name: 'convertBase', description: 'Convert a number. Arg: "255 base10" or "FF base16".', params: { value: 'string', base: 'number' }, run: (a) => { const m = String(a).match(/(\S+)\s*(?:base)?\s*(\d+)?/i); return convertBase(m[1], m[2] ? +m[2] : 10); } } },
      { id: 'bigo', name: 'Big-O', icon: '📈', desc: 'big o notation complexity time space', render: renderBigO },
      { id: 'ascii', name: 'ASCII', icon: '🔤', desc: 'ascii table character codes', render: renderAscii, ai: { name: 'asciiLookup', description: 'ASCII code of a character or char of a code. Arg: "A" or "65".', params: { value: 'string' }, run: (a) => { const v = String(a).trim(); return /^\d+$/.test(v) ? String.fromCharCode(+v) : { dec: v.charCodeAt(0), hex: v.charCodeAt(0).toString(16).toUpperCase() }; } } },
      { id: 'gates', name: 'Logic gates', icon: '🔌', desc: 'logic gates truth table and or xor nand', render: renderGates },
    ]);
  }
  boot();
})();
