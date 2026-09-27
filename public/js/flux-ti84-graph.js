/* ════════════════════════════════════════════════════════════════════════
   FLUX · Calculator graphing — flux-ti84-graph.js
   ------------------------------------------------------------------------
   The graph keys of the calculator: GRAPH with a free-moving cursor, TRACE
   (one pixel at a time, ↑/↓ between functions, type a number to jump),
   2nd CALC (value, zero, minimum, maximum, intersect, dy/dx, ∫f(x)dx with
   the calculator's Left Bound?/Right Bound?/Guess? prompts), ZOOM and its
   memory, WINDOW, 2nd FORMAT, 2nd TBLSET and TABLE, the three STAT PLOTs,
   and the DRAW commands (Line(, Circle(, Shade(, ShadeNorm(…).

   Positions follow the CE's 265×165 graph: ΔX = (Xmax−Xmin)/264, so
   ZDecimal traces in steps of 0.05 exactly as a student's handheld does.
   The drawing itself uses the full resolution of the screen.
   ════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (window.FluxTIGraph) return;

  const T = () => window.FluxTI;
  const core = () => window.FluxTI84.core;
  const PX = 264, PY = 164;              // the CE graph's pixel intervals
  const esc = (s) => core().esc(s);
  const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : NaN);

  /* ── Functions to draw ──────────────────────────────────────────────── */

  /** The functions that are on and not empty, compiled. */
  function activeFns(st) {
    const out = [];
    const mode = st.mode.graph;
    if (mode === 'par') {
      for (let k = 1; k <= 6; k++) {
        const xn = 'X' + T().SUB[k] + 'ᴛ', yn = 'Y' + T().SUB[k] + 'ᴛ';
        if (!st.y[xn] || !st.y[yn] || st.ui.yOn[xn] === false) continue;
        try {
          out.push({ name: xn, colour: st.ui.yCol[xn], style: st.ui.yStyle[xn] || 'thick', fx: T().compileFn(st.y[xn], st, ['T']), fy: T().compileFn(st.y[yn], st, ['T']), par: true, code: st.y[xn] });
        } catch (e) { /* a line that does not parse is left off the graph */ }
      }
      return out;
    }
    if (mode === 'pol') {
      for (let k = 1; k <= 6; k++) {
        const n = 'r' + T().SUB[k];
        if (!st.y[n] || st.ui.yOn[n] === false) continue;
        try { out.push({ name: n, colour: st.ui.yCol[n], style: st.ui.yStyle[n] || 'thick', f: T().compileFn(st.y[n], st, ['θ']), pol: true, code: st.y[n] }); } catch (e) { /* left off */ }
      }
      return out;
    }
    T().YNAMES.forEach((n) => {
      if (!st.y[n] || !String(st.y[n]).trim() || st.ui.yOn[n] === false) return;
      try { out.push({ name: n, colour: st.ui.yCol[n], style: st.ui.yStyle[n] || 'thick', f: T().compileFn(st.y[n], st, ['X']), code: st.y[n] }); } catch (e) { /* left off */ }
    });
    return out;
  }

  /* ── Drawing ────────────────────────────────────────────────────────── */

  function frame(st, W, H) {
    const w = st.win;
    return {
      W: W, H: H,
      sx: (x) => (x - w.Xmin) / (w.Xmax - w.Xmin) * W,
      sy: (y) => H - (y - w.Ymin) / (w.Ymax - w.Ymin) * H,
    };
  }

  /**
   * What the drawings were made on. Change the window, Y= or the graph mode
   * and the calculator redraws from scratch, losing Line(, Shade( and the rest.
   */
  function drawSig(st) { return JSON.stringify([st.win, st.y, st.ui.yOn, st.mode.graph]); }
  function markDrawn(st) { st.ui.drawSig = drawSig(st); }

  function draw(canvas, c, extra) {
    const st = c.st, w = st.win, fmt = st.ui.fmt;
    if (st.ui.draw.length && st.ui.drawSig && st.ui.drawSig !== drawSig(st)) st.ui.draw = [];
    const dpr = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
    const W = canvas.clientWidth, H = canvas.clientHeight;
    if (!W || !H) return null;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    const g = canvas.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.fillStyle = '#ffffff';
    g.fillRect(0, 0, W, H);
    if (!(w.Xmin < w.Xmax) || !(w.Ymin < w.Ymax)) return null;
    const F = frame(st, W, H);

    if (fmt.grid !== 'off' && w.Xscl > 0 && w.Yscl > 0 && (w.Xmax - w.Xmin) / w.Xscl < 200 && (w.Ymax - w.Ymin) / w.Yscl < 200) {
      g.fillStyle = '#b9c0cc';
      g.strokeStyle = '#dde2ea';
      g.lineWidth = 1;
      for (let x = Math.ceil(w.Xmin / w.Xscl) * w.Xscl; x <= w.Xmax; x += w.Xscl) {
        if (fmt.grid === 'line') { g.beginPath(); g.moveTo(F.sx(x), 0); g.lineTo(F.sx(x), H); g.stroke(); continue; }
        for (let y = Math.ceil(w.Ymin / w.Yscl) * w.Yscl; y <= w.Ymax; y += w.Yscl) g.fillRect(F.sx(x) - 0.8, F.sy(y) - 0.8, 1.6, 1.6);
      }
      if (fmt.grid === 'line') for (let y = Math.ceil(w.Ymin / w.Yscl) * w.Yscl; y <= w.Ymax; y += w.Yscl) { g.beginPath(); g.moveTo(0, F.sy(y)); g.lineTo(W, F.sy(y)); g.stroke(); }
    }
    if (fmt.axes) {
      g.strokeStyle = '#1b1d22';
      g.lineWidth = 1;
      const X0 = F.sx(0), Y0 = F.sy(0);
      if (Y0 >= 0 && Y0 <= H) { g.beginPath(); g.moveTo(0, Y0 + 0.5); g.lineTo(W, Y0 + 0.5); g.stroke(); }
      if (X0 >= 0 && X0 <= W) { g.beginPath(); g.moveTo(X0 + 0.5, 0); g.lineTo(X0 + 0.5, H); g.stroke(); }
      if (w.Xscl > 0 && (w.Xmax - w.Xmin) / w.Xscl < 300 && Y0 >= 0 && Y0 <= H) {
        for (let x = Math.ceil(w.Xmin / w.Xscl) * w.Xscl; x <= w.Xmax; x += w.Xscl) { g.beginPath(); g.moveTo(F.sx(x) + 0.5, Y0 - 3); g.lineTo(F.sx(x) + 0.5, Y0 + 3); g.stroke(); }
      }
      if (w.Yscl > 0 && (w.Ymax - w.Ymin) / w.Yscl < 300 && X0 >= 0 && X0 <= W) {
        for (let y = Math.ceil(w.Ymin / w.Yscl) * w.Yscl; y <= w.Ymax; y += w.Yscl) { g.beginPath(); g.moveTo(X0 - 3, F.sy(y) + 0.5); g.lineTo(X0 + 3, F.sy(y) + 0.5); g.stroke(); }
      }
      if (fmt.label) {
        g.fillStyle = '#1b1d22';
        g.font = '600 ' + Math.round(H * 0.07) + 'px Inter, system-ui, sans-serif';
        if (Y0 >= 0 && Y0 <= H) g.fillText('x', W - H * 0.06, Y0 - 4);
        if (X0 >= 0 && X0 <= W) g.fillText('y', X0 + 4, H * 0.08);
      }
    }
    // Shaded areas first, so the curves sit on top of them.
    const shades = st.ui.draw.filter((d) => d.k === 'shade');
    if (extra && extra.shade) shades.push(extra.shade);
    shades.forEach((s) => shadeRegion(g, F, s, c));
    const lw = fmt.thick ? 2.4 : 1.3;
    // A test's Draw shows its distribution alone.
    if (!(extra && extra.only)) {
      activeFns(st).forEach((fn) => plotFn(g, F, fn, st, fn.style === 'thin' ? 1.3 : lw, fmt));
      st.ui.plots.forEach((p, i) => { if (p.on) plotStat(g, F, p, st, i); });
    }
    st.ui.draw.forEach((d) => { if (d.k !== 'shade') drawItem(g, F, d, c); });
    // DISTR ▸ DRAW puts its curve over its shading.
    const dist = shades.find((s) => s.dist);
    if (dist) plotCurve(g, F, st, distPdf(dist.dist), '#1b1b1f', 1.6);
    return F;
  }

  function plotCurve(g, F, st, f, colour, lw) {
    const w = st.win;
    g.strokeStyle = colour;
    g.lineWidth = lw;
    g.beginPath();
    let pen = false;
    for (let i = 0; i <= F.W; i++) {
      const x = w.Xmin + (w.Xmax - w.Xmin) * i / F.W;
      let y;
      try { y = f(x); } catch (e) { y = NaN; }
      if (!Number.isFinite(y)) { pen = false; continue; }
      if (!pen) { g.moveTo(F.sx(x), F.sy(y)); pen = true; } else g.lineTo(F.sx(x), F.sy(y));
    }
    g.stroke();
  }

  function plotFn(g, F, fn, st, lw, fmt) {
    g.strokeStyle = fn.colour;
    g.fillStyle = fn.colour;
    g.lineWidth = lw;
    g.lineJoin = 'round';
    g.lineCap = 'round';
    const w = st.win;
    const span = w.Ymax - w.Ymin;
    const pts = [];
    if (fn.par || fn.pol) {
      const lo = fn.par ? w.Tmin : w['θmin'], hi = fn.par ? w.Tmax : w['θmax'], step = fn.par ? w.Tstep : w['θstep'];
      if (!(step > 0) || (hi - lo) / step > 20000) return;
      for (let t = lo; t <= hi + step * 1e-9; t += step) {
        let x, y;
        if (fn.par) { x = num(fn.fx(t)); y = num(fn.fy(t)); } else {
          const r = num(fn.f(t));
          const a = st.mode.angle === 'deg' ? t * Math.PI / 180 : t;
          x = r * Math.cos(a); y = r * Math.sin(a);
        }
        pts.push(Number.isFinite(x) && Number.isFinite(y) ? [F.sx(x), F.sy(y)] : null);
      }
    } else {
      const N = Math.ceil(F.W * 1.5);
      let prev = null;
      for (let i = 0; i <= N; i++) {
        const x = w.Xmin + (w.Xmax - w.Xmin) * i / N;
        const y = num(fn.f(x));
        if (!Number.isFinite(y)) { pts.push(null); prev = null; continue; }
        // A jump across the whole window is an asymptote, not a line to draw.
        if (prev !== null && Math.abs(y - prev) > span * 1.5 && (fmt.detect || Math.abs(y - prev) > span * 3)) pts.push(null);
        prev = y;
        pts.push([F.sx(x), F.sy(Math.max(w.Ymin - span * 4, Math.min(w.Ymax + span * 4, y)))]);
      }
      if (fn.style === 'above' || fn.style === 'below') {
        g.globalAlpha = 0.22;
        pts.forEach((p) => { if (!p) return; if (fn.style === 'above') g.fillRect(p[0] - 1, 0, 2, Math.max(0, p[1])); else g.fillRect(p[0] - 1, p[1], 2, F.H - p[1]); });
        g.globalAlpha = 1;
      }
    }
    if (fn.style === 'dot') {
      pts.forEach((p, i) => { if (p && i % 3 === 0) g.fillRect(p[0] - 1, p[1] - 1, 2, 2); });
      return;
    }
    g.beginPath();
    let pen = false;
    pts.forEach((p) => {
      if (!p) { pen = false; return; }
      if (!pen) { g.moveTo(p[0], p[1]); pen = true; } else g.lineTo(p[0], p[1]);
    });
    g.stroke();
  }

  function listOf(st, name) { const l = st.lists[name]; return Array.isArray(l) ? l.filter((v) => typeof v === 'number') : []; }
  function freqOf(st, p, n) {
    if (!p.f || p.f === '1') return Array.from({ length: n }, () => 1);
    const l = listOf(st, p.f);
    return l.length === n ? l : Array.from({ length: n }, () => 1);
  }
  function plotStat(g, F, p, st, i) {
    const xs = listOf(st, p.x);
    const colour = p.col || core().YCOLOURS[i];
    g.strokeStyle = colour;
    g.fillStyle = colour;
    g.lineWidth = 1.5;
    const mark = (X, Y) => {
      if (p.mark === '+') { g.beginPath(); g.moveTo(X - 3, Y); g.lineTo(X + 3, Y); g.moveTo(X, Y - 3); g.lineTo(X, Y + 3); g.stroke(); }
      else if (p.mark === '·') g.fillRect(X - 1.2, Y - 1.2, 2.4, 2.4);
      else g.strokeRect(X - 2.5, Y - 2.5, 5, 5);
    };
    if (p.type === 'scatter' || p.type === 'xyline') {
      const ys = listOf(st, p.y);
      const n = Math.min(xs.length, ys.length);
      if (p.type === 'xyline') {
        g.beginPath();
        for (let k = 0; k < n; k++) { const X = F.sx(xs[k]), Y = F.sy(ys[k]); if (k) g.lineTo(X, Y); else g.moveTo(X, Y); }
        g.stroke();
      }
      for (let k = 0; k < n; k++) mark(F.sx(xs[k]), F.sy(ys[k]));
      return;
    }
    if (!xs.length) return;
    const fs = freqOf(st, p, xs.length);
    if (p.type === 'hist') {
      const w = st.win;
      if (!(w.Xscl > 0)) return;
      const bins = {};
      xs.forEach((x, k) => { const b = Math.floor((x - w.Xmin) / w.Xscl + 1e-10); bins[b] = (bins[b] || 0) + fs[k]; });
      Object.keys(bins).forEach((b) => {
        const x0 = w.Xmin + b * w.Xscl;
        g.globalAlpha = 0.35;
        g.fillRect(F.sx(x0), F.sy(bins[b]), F.sx(x0 + w.Xscl) - F.sx(x0), F.sy(0) - F.sy(bins[b]));
        g.globalAlpha = 1;
        g.strokeRect(F.sx(x0), F.sy(bins[b]), F.sx(x0 + w.Xscl) - F.sx(x0), F.sy(0) - F.sy(bins[b]));
      });
      return;
    }
    if (p.type === 'box' || p.type === 'modbox') {
      const o = window.FluxTIStats.oneVar(xs, fs);
      const top = F.H * (0.12 + i * 0.28), bot = top + F.H * 0.16, mid = (top + bot) / 2;
      let lo = o.min, hi = o.max;
      const iqr = o.q3 - o.q1;
      const outliers = [];
      if (p.type === 'modbox' && Number.isFinite(iqr)) {
        const lf = o.q1 - 1.5 * iqr, hf = o.q3 + 1.5 * iqr;
        const inside = xs.filter((x) => x >= lf && x <= hf);
        lo = Math.min.apply(null, inside); hi = Math.max.apply(null, inside);
        xs.forEach((x) => { if (x < lf || x > hf) outliers.push(x); });
      }
      g.beginPath();
      g.moveTo(F.sx(lo), mid); g.lineTo(F.sx(o.q1), mid);
      g.moveTo(F.sx(o.q3), mid); g.lineTo(F.sx(hi), mid);
      g.stroke();
      g.strokeRect(F.sx(o.q1), top, F.sx(o.q3) - F.sx(o.q1), bot - top);
      g.beginPath(); g.moveTo(F.sx(o.med), top); g.lineTo(F.sx(o.med), bot); g.stroke();
      outliers.forEach((x) => mark(F.sx(x), mid));
    }
  }

  function evalAt(c, node, x) { return num(T().evalNode(node, c.st, null, { X: x })); }
  function distPdf(dc) {
    const S = window.FluxTIStats, a = dc.a;
    if (dc.name === 'ShadeNorm(') return (x) => S.normalpdf(x, a[2] == null ? 0 : a[2], a[3] == null ? 1 : a[3]);
    if (dc.name === 'Shade_t(') return (x) => S.tpdf(x, a[2]);
    if (dc.name === 'Shadeχ²(') return (x) => S.chi2pdf(x, a[2]);
    return (x) => S.Fpdf(x, a[2], a[3]);
  }
  function shadeRegion(g, F, s, c) {
    const w = c.st.win;
    const upper = s.dist ? distPdf(s.dist) : s.upperFn || (s.upper ? (x) => evalAt(c, s.upper, x) : () => 0);
    const lower = s.dist ? () => 0 : s.lowerFn || (s.lower ? (x) => evalAt(c, s.lower, x) : () => 0);
    g.save();
    g.globalAlpha = 0.28;
    g.fillStyle = s.colour || '#1f6feb';
    const x0 = Math.max(Math.min(s.a, s.b), w.Xmin), x1 = Math.min(Math.max(s.a, s.b), w.Xmax);
    const N = Math.max(2, Math.ceil(F.sx(x1) - F.sx(x0)));
    for (let i = 0; i <= N; i++) {
      const x = x0 + (x1 - x0) * i / N;
      let yl, yh;
      try { yl = lower(x); yh = upper(x); } catch (e) { continue; }
      if (!Number.isFinite(yl) || !Number.isFinite(yh)) continue;
      const a = F.sy(Math.max(yl, yh)), b = F.sy(Math.min(yl, yh));
      g.fillRect(F.sx(x) - 0.6, a, 1.8, b - a);
    }
    g.restore();
  }
  function drawItem(g, F, d, c) {
    g.strokeStyle = d.colour || '#1f6feb';
    g.fillStyle = d.colour || '#1f6feb';
    g.lineWidth = 1.6;
    switch (d.k) {
      case 'line': g.beginPath(); g.moveTo(F.sx(d.x1), F.sy(d.y1)); g.lineTo(F.sx(d.x2), F.sy(d.y2)); g.stroke(); return;
      case 'hor': g.beginPath(); g.moveTo(0, F.sy(d.y)); g.lineTo(F.W, F.sy(d.y)); g.stroke(); return;
      case 'ver': g.beginPath(); g.moveTo(F.sx(d.x), 0); g.lineTo(F.sx(d.x), F.H); g.stroke(); return;
      case 'circle': g.beginPath(); g.ellipse(F.sx(d.x), F.sy(d.y), Math.abs(F.sx(d.x + d.r) - F.sx(d.x)), Math.abs(F.sy(d.y + d.r) - F.sy(d.y)), 0, 0, Math.PI * 2); g.stroke(); return;
      case 'pt': g.fillRect(F.sx(d.x) - 1.5, F.sy(d.y) - 1.5, 3, 3); return;
      case 'text':
        g.fillStyle = '#111317';
        g.font = Math.round(F.H * 0.075) + 'px Inter, system-ui, sans-serif';
        g.fillText(d.text, d.col / 264 * F.W, (d.row + 8) / 164 * F.H);
        return;
      case 'fn': plotCurve(g, F, c.st, (x) => evalAt(c, d.node, x), d.colour || '#1f6feb', 1.6); return;
      case 'tangent': plotCurve(g, F, c.st, (x) => d.m * (x - d.x0) + d.y0, d.colour || '#1f6feb', 1.6); return;
      case 'inv': {
        const w = c.st.win;
        g.beginPath();
        let pen = false;
        for (let i = 0; i <= F.H; i++) {
          const t = w.Xmin + (w.Xmax - w.Xmin) * i / F.H;
          let y;
          try { y = evalAt(c, d.node, t); } catch (e) { y = NaN; }
          if (!Number.isFinite(y)) { pen = false; continue; }
          if (!pen) { g.moveTo(F.sx(y), F.sy(t)); pen = true; } else g.lineTo(F.sx(y), F.sy(t));
        }
        g.stroke();
        return;
      }
      default:
    }
  }

  /* ── Numbers for CALC ───────────────────────────────────────────────── */

  function zeroBetween(f, a, b) {
    let fa = f(a), fb = f(b);
    if (!Number.isFinite(fa) || !Number.isFinite(fb) || ((fa < 0) === (fb < 0) && fa !== 0 && fb !== 0)) {
      // Look inside the bounds for a sign change.
      const N = 200;
      let px = a, pf = f(a), found = false;
      for (let i = 1; i <= N; i++) {
        const x = a + (b - a) * i / N, v = f(x);
        if (Number.isFinite(v) && Number.isFinite(pf) && (v < 0) !== (pf < 0)) { a = px; b = x; fa = pf; fb = v; found = true; break; }
        if (Number.isFinite(v)) { px = x; pf = v; }
      }
      if (!found) T().fail('NO SIGN CHANGE');
    }
    if (fa === 0) return a;
    if (fb === 0) return b;
    for (let k = 0; k < 200; k++) {
      const m = (a + b) / 2, fm = f(m);
      if (fm === 0 || Math.abs(b - a) < 1e-13 * Math.max(1, Math.abs(m))) return m;
      if ((fa < 0) !== (fm < 0)) { b = m; fb = fm; } else { a = m; fa = fm; }
    }
    return (a + b) / 2;
  }

  /* ── The graph screen ───────────────────────────────────────────────── */

  const CALC_STEPS = {
    value: ['X='],
    zero: ['Left Bound?', 'Right Bound?', 'Guess?'],
    min: ['Left Bound?', 'Right Bound?', 'Guess?'],
    max: ['Left Bound?', 'Right Bound?', 'Guess?'],
    isect: ['First curve?', 'Second curve?', 'Guess?'],
    dydx: ['dy/dx: move, then enter'],
    integral: ['Lower Limit?', 'Upper Limit?'],
  };

  function GraphApp(c, opts) {
    this.c = c;
    this.o = opts || {};
    this.mode = 'view';          // view | free | trace | calc | zbox | zin | zout
    this.fnIndex = 0;
    this.cx = null; this.cy = null; this.ct = null;
    this.msg = '';
    this.result = null;
    this.typed = null;           // a number being typed for X=
    if (this.o.trace) this.startTrace();
    if (this.o.calc) this.startCalc(this.o.calc);
    this.pendingCalcMenu = !!this.o.calcMenu;
  }
  GraphApp.prototype.fns = function () { return activeFns(this.c.st); };
  GraphApp.prototype.snapX = function (x) {
    const w = this.c.st.win, dx = (w.Xmax - w.Xmin) / PX;
    return +(w.Xmin + Math.round((x - w.Xmin) / dx) * dx).toPrecision(12);
  };
  GraphApp.prototype.centre = function () {
    const w = this.c.st.win;
    this.cx = this.snapX((w.Xmin + w.Xmax) / 2);
    this.cy = (w.Ymin + w.Ymax) / 2;
  };
  GraphApp.prototype.startTrace = function () {
    this.mode = 'trace';
    this.msg = '';
    if (this.cx == null) this.centre();
    if (this.fnIndex >= this.fns().length) this.fnIndex = 0;
  };
  GraphApp.prototype.yOf = function (fn, x) {
    if (!fn || fn.par || fn.pol) return NaN;
    return num(fn.f(x));
  };
  GraphApp.prototype.pointOf = function (fn, t) {
    if (fn.par) return [num(fn.fx(t)), num(fn.fy(t))];
    const r = num(fn.f(t)), a = this.c.st.mode.angle === 'deg' ? t * Math.PI / 180 : t;
    return [r * Math.cos(a), r * Math.sin(a)];
  };
  GraphApp.prototype.startCalc = function (which) {
    const fns = this.fns();
    this.result = null;
    if (!fns.length || this.c.st.mode.graph !== 'func') { this.mode = 'view'; this.msg = fns.length ? 'CALC needs FUNCTION mode' : 'No functions are on — press y='; return; }
    this.mode = 'calc';
    this.msg = '';
    this.calc = { which: which, step: 0, marks: [] };
    if (this.cx == null) this.centre();
  };
  /** ENTER during a CALC prompt. */
  GraphApp.prototype.calcEnter = function () {
    const k = this.calc, fns = this.fns();
    const fn = fns[this.fnIndex];
    const steps = CALC_STEPS[k.which];
    if (k.which === 'isect' && k.step < 2) {
      k.marks.push(this.fnIndex);
      k.step++;
      if (k.step === 1 && fns.length > 1) this.fnIndex = (this.fnIndex + 1) % fns.length;
      return;
    }
    k.marks.push(this.cx);
    k.step++;
    if (k.step < steps.length) return;
    const f = (x) => this.yOf(fn, x);
    let res;
    try {
      switch (k.which) {
        case 'value': res = { x: this.cx, y: f(this.cx) }; break;
        case 'zero': {
          const a = Math.min(k.marks[0], k.marks[1]), b = Math.max(k.marks[0], k.marks[1]);
          const x = zeroBetween(f, a, b);
          res = { title: 'Zero', x: x, y: 0 };
          break;
        }
        case 'min': case 'max': {
          const a = Math.min(k.marks[0], k.marks[1]), b = Math.max(k.marks[0], k.marks[1]);
          if (!(a < b)) T().fail('INVALID');
          const g = k.which === 'min' ? f : (x) => -f(x);
          const x = T().goldenMin((t) => { const v = g(t); return Number.isFinite(v) ? v : Infinity; }, a, b);
          res = { title: k.which === 'min' ? 'Minimum' : 'Maximum', x: x, y: f(x) };
          break;
        }
        case 'isect': {
          const f1 = fns[k.marks[0]], f2 = fns[k.marks[1]];
          if (f1 === f2) T().fail('INVALID');
          const d = (x) => this.yOf(f1, x) - this.yOf(f2, x);
          const guess = k.marks[2];
          const w = this.c.st.win;
          let span = (w.Xmax - w.Xmin) / 40, x = null;
          for (let t = 0; t < 12 && x == null; t++) {
            try { x = zeroBetween(d, guess - span, guess + span); } catch (e) { span *= 2; }
          }
          if (x == null) T().fail('NO SIGN CHANGE');
          res = { title: 'Intersection', x: x, y: this.yOf(f1, x) };
          break;
        }
        case 'dydx': {
          const x = this.cx, h = 1e-3 * Math.max(1, Math.abs(x));
          res = { label: 'dy/dx=' + T().fmtReal(+((f(x + h) - f(x - h)) / (2 * h)).toPrecision(10)), x: x, y: f(x) };
          break;
        }
        case 'integral': {
          const a = k.marks[0], b = k.marks[1];
          const v = T().integrate((x) => { const y = f(x); if (!Number.isFinite(y)) T().fail('DOMAIN'); return y; }, a, b);
          res = { label: '∫f(x)dx=' + T().fmtReal(+v.toPrecision(10)), x: b, y: f(b), shade: { a: a, b: b, upperFn: f, lowerFn: () => 0, colour: fn.colour } };
          break;
        }
        default:
      }
    } catch (e) {
      this.mode = 'trace';
      this.calc = null;
      if (e && e.ti) { this.c.error(e.ti); return; }
      throw e;
    }
    this.cx = res.x;
    this.result = res;
    this.mode = 'trace';
    this.calc = null;
    // The answers go where the calculator puts them: X and Y (and Ans for the value).
    if (Number.isFinite(res.x)) this.c.st.vars.X = +res.x.toPrecision(14);
    if (Number.isFinite(res.y)) this.c.st.vars.Y = +res.y.toPrecision(14);
  };
  GraphApp.prototype.key = function (k) {
    const c = this.c, st = c.st, w = st.win, fns = this.fns();
    const dx = (w.Xmax - w.Xmin) / PX, dy = (w.Ymax - w.Ymin) / PY;
    // Typing a number moves the trace cursor to that X (and answers X= in CALC value).
    const canType = this.mode === 'trace' || (this.mode === 'calc' && this.calc && this.calc.which !== 'isect');
    if (canType && (/^[0-9]$/.test(k) || k === 'dot' || k === 'neg' || this.typed != null)) {
      if (this.typed == null) this.typed = '';
      if (/^[0-9]$/.test(k)) { this.typed += k; return true; }
      if (k === 'dot') { this.typed += '.'; return true; }
      if (k === 'neg') { this.typed += '⁻'; return true; }
      if (k === 'del' || k === 'bs') { this.typed = this.typed.slice(0, -1); return true; }
      if (k === 'clear') { this.typed = null; return true; }
      if (k === 'enter') {
        const v = T().evaluate(this.typed || '0', st);
        this.typed = null;
        if (typeof v !== 'number') T().fail('DATA TYPE');
        this.cx = v;
        if (v < w.Xmin || v > w.Xmax) { const half = (w.Xmax - w.Xmin) / 2; w.Xmin = v - half; w.Xmax = v + half; }
        this.result = null;
        if (this.mode === 'calc') this.calcEnter();
        return true;
      }
      return true;
    }
    if (k === 'clear' || k === 'quit') {
      if (this.mode === 'view' || k === 'quit') { c.pop(); return true; }
      this.mode = 'view'; this.calc = null; this.result = null; this.msg = '';
      return true;
    }
    if (k === 'trace') { this.startTrace(); this.result = null; return true; }
    if (k === 'graph') { this.mode = 'view'; this.result = null; this.msg = ''; return true; }
    if (k === 'calc') { c.push(new (core().MenuApp)(c, 'CALC', this)); return true; }
    if (k === 'zoom') { c.push(new (core().MenuApp)(c, 'ZOOM', this)); return true; }
    if (this.mode === 'view' && /^(left|right|up|down)$/.test(k)) { this.mode = 'free'; this.centre(); return true; }
    if (this.mode === 'free' || this.mode === 'zbox' || this.mode === 'zin' || this.mode === 'zout') {
      if (k === 'left') { this.cx -= dx; return true; }
      if (k === 'right') { this.cx += dx; return true; }
      if (k === 'up') { this.cy += dy; return true; }
      if (k === 'down') { this.cy -= dy; return true; }
      if (k === 'enter') {
        if (this.mode === 'zin' || this.mode === 'zout') {
          const f = this.mode === 'zin' ? 1 / w.XFact : w.XFact, g = this.mode === 'zin' ? 1 / w.YFact : w.YFact;
          savePrev(st);
          const hx = (w.Xmax - w.Xmin) * f / 2, hy = (w.Ymax - w.Ymin) * g / 2;
          w.Xmin = this.cx - hx; w.Xmax = this.cx + hx; w.Ymin = this.cy - hy; w.Ymax = this.cy + hy;
          return true;
        }
        if (this.mode === 'zbox') {
          if (!this.box) { this.box = [this.cx, this.cy]; return true; }
          const x0 = this.box[0], y0 = this.box[1];
          this.box = null;
          if (x0 === this.cx || y0 === this.cy) return true;
          savePrev(st);
          w.Xmin = Math.min(x0, this.cx); w.Xmax = Math.max(x0, this.cx); w.Ymin = Math.min(y0, this.cy); w.Ymax = Math.max(y0, this.cy);
          this.mode = 'view';
          return true;
        }
        return true;
      }
      return false;
    }
    if (this.mode === 'trace' || this.mode === 'calc') {
      const fn = fns[this.fnIndex];
      if (k === 'left' || k === 'right') {
        const d = k === 'left' ? -1 : 1;
        if (fn && (fn.par || fn.pol)) {
          const step = fn.par ? w.Tstep : w['θstep'];
          this.ct = (this.ct == null ? (fn.par ? w.Tmin : w['θmin']) : this.ct) + d * step;
        } else {
          this.cx = this.snapX(this.cx + d * dx);
          // Tracing off the edge moves the window with it, as on the calculator.
          if (this.cx > w.Xmax || this.cx < w.Xmin) { const half = (w.Xmax - w.Xmin) / 2; w.Xmin = this.cx - half; w.Xmax = this.cx + half; }
        }
        this.result = null;
        return true;
      }
      if (k === 'up' || k === 'down') {
        if (fns.length) this.fnIndex = (this.fnIndex + (k === 'up' ? fns.length - 1 : 1)) % fns.length;
        this.result = null;
        return true;
      }
      if (k === 'enter') {
        if (this.mode === 'calc') { this.calcEnter(); return true; }
        // ENTER while tracing re-centres the window on the cursor.
        const y = this.yOf(fn, this.cx);
        if (Number.isFinite(y)) {
          const hx = (w.Xmax - w.Xmin) / 2, hy = (w.Ymax - w.Ymin) / 2;
          w.Xmin = this.cx - hx; w.Xmax = this.cx + hx; w.Ymin = y - hy; w.Ymax = y + hy;
        }
        return true;
      }
    }
    return false;
  };
  GraphApp.prototype.render = function () {
    return '<div class="t84g"><canvas aria-label="Graph"></canvas><div class="t84g-top"></div><div class="t84g-prompt" hidden></div><div class="t84g-bot"></div></div>';
  };
  GraphApp.prototype.after = function (scr) {
    const canvas = scr.querySelector('canvas');
    if (!canvas) return;
    const st = this.c.st, fmt = st.ui.fmt;
    let F = null;
    try { F = draw(canvas, this.c, { shade: this.result && this.result.shade, only: !!this.o.only }); } catch (e) { F = null; }
    const top = scr.querySelector('.t84g-top'), bot = scr.querySelector('.t84g-bot'), prompt = scr.querySelector('.t84g-prompt');
    if (!F) { top.textContent = st.win.Xmin < st.win.Xmax && st.win.Ymin < st.win.Ymax ? '' : 'ERR:WINDOW RANGE'; return; }
    const g = canvas.getContext('2d');
    const fns = this.fns();
    const fn = fns[this.fnIndex];
    const fx = (v) => esc(T().fmtReal(+v.toPrecision(10)));
    const cross = (X, Y, colour) => {
      g.strokeStyle = colour || '#111317';
      g.lineWidth = 1.2;
      g.beginPath(); g.moveTo(X - 7, Y); g.lineTo(X + 7, Y); g.moveTo(X, Y - 7); g.lineTo(X, Y + 7); g.stroke();
      g.strokeRect(X - 2.5, Y - 2.5, 5, 5);
    };
    let bottom = '', topText = '';
    if (this.mode === 'free' || this.mode === 'zbox' || this.mode === 'zin' || this.mode === 'zout') {
      cross(F.sx(this.cx), F.sy(this.cy));
      if (this.box) { g.setLineDash([4, 3]); g.strokeRect(F.sx(this.box[0]), F.sy(this.box[1]), F.sx(this.cx) - F.sx(this.box[0]), F.sy(this.cy) - F.sy(this.box[1])); g.setLineDash([]); }
      if (fmt.coord) bottom = '<b>X=' + fx(this.cx) + '</b><b>Y=' + fx(this.cy) + '</b>';
      if (this.mode === 'zbox') topText = this.box ? 'ZBox: move to the other corner, enter' : 'ZBox: move to a corner, press enter';
      if (this.mode === 'zin' || this.mode === 'zout') topText = (this.mode === 'zin' ? 'Zoom In' : 'Zoom Out') + ': move to the centre, enter';
    } else if ((this.mode === 'trace' || this.mode === 'calc') && fn) {
      let x = this.cx, y;
      if (fn.par || fn.pol) {
        const t = this.ct == null ? (fn.par ? st.win.Tmin : st.win['θmin']) : this.ct;
        const p = this.pointOf(fn, t);
        x = p[0]; y = p[1];
        bottom = '<b>' + (fn.par ? 'T' : 'θ') + '=' + fx(t) + '</b><b>X=' + (Number.isFinite(x) ? fx(x) : '') + '</b><b>Y=' + (Number.isFinite(y) ? fx(y) : '') + '</b>';
      } else {
        y = this.yOf(fn, x);
        bottom = '<b>X=' + fx(x) + '</b><b>Y=' + (Number.isFinite(y) ? fx(y) : '') + '</b>';
      }
      if (Number.isFinite(x) && Number.isFinite(y)) cross(F.sx(x), F.sy(y), fn.colour);
      if (fmt.expr) {
        const E = window.FluxTIEditor;
        topText = fn.name + '=' + (E ? E.textNodes(st.ui.ynodes[fn.name] || E.nodesFromCode(fn.code)) : fn.code);
      }
      let p = '';
      if (this.calc) {
        const steps = CALC_STEPS[this.calc.which];
        p = steps[this.calc.step] + (this.typed != null ? ' ' + this.typed : '');
        this.calc.marks.forEach((m, i) => {
          if (this.calc.which === 'isect') return;
          const X = F.sx(m);
          g.fillStyle = '#111317';
          g.beginPath();
          const dir = i === 0 ? 1 : -1;
          g.moveTo(X, 2); g.lineTo(X + 7 * dir, 6); g.lineTo(X, 10);
          g.fill();
        });
      } else if (this.typed != null) p = 'X=' + this.typed;
      if (this.result) {
        p = this.result.title || this.result.label || '';
        if (this.result.title) bottom = '<b>X=' + fx(this.result.x) + '</b><b>Y=' + fx(this.result.y) + '</b>';
      }
      if (p) { prompt.hidden = false; prompt.textContent = p; }
    } else if (this.mode === 'trace' || this.mode === 'calc') {
      topText = 'No functions are on — press y= to enter one';
    }
    if (this.msg) topText = this.msg;
    top.textContent = topText;
    bot.innerHTML = bottom;
    if (this.pendingCalcMenu) {
      this.pendingCalcMenu = false;
      this.c.push(new (core().MenuApp)(this.c, 'CALC', this));
      this.c.render();
    }
  };

  /* ── Zoom ───────────────────────────────────────────────────────────── */

  function savePrev(st) { st.ui.zoomPrev = Object.assign({}, st.win); }
  function applyZoom(c, which) {
    const st = c.st, w = st.win;
    const set = (o) => { savePrev(st); Object.assign(w, o); };
    switch (which) {
      case 'ZStandard': set({ Xmin: -10, Xmax: 10, Xscl: 1, Ymin: -10, Ymax: 10, Yscl: 1 }); return true;
      case 'ZDecimal': set({ Xmin: -6.6, Xmax: 6.6, Xscl: 1, Ymin: -4.1, Ymax: 4.1, Yscl: 1 }); return true;
      case 'ZQuadrant1': set({ Xmin: 0, Xmax: 13.2, Xscl: 1, Ymin: 0, Ymax: 8.2, Yscl: 1 }); return true;
      case 'ZTrig': {
        const deg = st.mode.angle === 'deg';
        set({ Xmin: deg ? -352.5 : -6.152285613, Xmax: deg ? 352.5 : 6.152285613, Xscl: deg ? 90 : Math.PI / 2, Ymin: -4, Ymax: 4, Yscl: 1 });
        return true;
      }
      case 'ZInteger': {
        const cx = Math.round((w.Xmin + w.Xmax) / 2), cy = Math.round((w.Ymin + w.Ymax) / 2);
        set({ Xmin: cx - PX / 2, Xmax: cx + PX / 2, Xscl: 10, Ymin: cy - PY / 2, Ymax: cy + PY / 2, Yscl: 10 });
        return true;
      }
      case 'ZSquare': {
        const cx = (w.Xmin + w.Xmax) / 2, hy = (w.Ymax - w.Ymin) / 2;
        set({ Xmin: cx - hy * PX / PY, Xmax: cx + hy * PX / PY });
        return true;
      }
      case 'ZoomFit': {
        let lo = Infinity, hi = -Infinity;
        activeFns(st).forEach((fn) => {
          if (fn.par || fn.pol) return;
          for (let i = 0; i <= PX; i++) {
            const y = num(fn.f(w.Xmin + (w.Xmax - w.Xmin) * i / PX));
            if (Number.isFinite(y)) { lo = Math.min(lo, y); hi = Math.max(hi, y); }
          }
        });
        if (Number.isFinite(lo)) { if (lo === hi) { lo -= 1; hi += 1; } set({ Ymin: lo, Ymax: hi }); }
        return true;
      }
      case 'ZoomStat': {
        let xl = Infinity, xh = -Infinity, yl = Infinity, yh = -Infinity;
        st.ui.plots.forEach((p) => {
          if (!p.on) return;
          listOf(st, p.x).forEach((x) => { xl = Math.min(xl, x); xh = Math.max(xh, x); });
          if (p.type === 'scatter' || p.type === 'xyline') listOf(st, p.y).forEach((y) => { yl = Math.min(yl, y); yh = Math.max(yh, y); });
          else { yl = Math.min(yl, -1); yh = Math.max(yh, 5); }
        });
        if (!Number.isFinite(xl)) return true;
        const mx = (xh - xl) * 0.1 || 1, my = (yh - yl) * 0.1 || 1;
        set({ Xmin: xl - mx, Xmax: xh + mx, Ymin: yl - my, Ymax: yh + my, Xscl: niceScale(xh - xl), Yscl: niceScale(yh - yl) });
        return true;
      }
      case 'ZoomSto': st.ui.zoomSto = Object.assign({}, w); return false;
      case 'ZoomRcl': if (st.ui.zoomSto) set(st.ui.zoomSto); return true;
      case 'prev': if (st.ui.zoomPrev) { const p = st.ui.zoomPrev; st.ui.zoomPrev = Object.assign({}, w); Object.assign(w, p); } return true;
      default: return false;
    }
  }
  function niceScale(span) {
    if (!(span > 0)) return 1;
    const raw = span / 10, p = Math.pow(10, Math.floor(Math.log10(raw)));
    const m = raw / p;
    return (m < 1.5 ? 1 : m < 3.5 ? 2 : m < 7.5 ? 5 : 10) * p;
  }

  /* ── Table ──────────────────────────────────────────────────────────── */

  const TROWS = 8;
  function TableApp(c) {
    this.c = c;
    this.row = 0;
    this.col = 1;
    this.start = c.st.tbl.TblStart;
    this.asked = [];
    this.ed = null;
    this.left0 = 1;
  }
  TableApp.prototype.fns = function () { return activeFns(this.c.st).filter((f) => !f.par && !f.pol); };
  TableApp.prototype.xs = function () {
    const st = this.c.st;
    if (st.tbl.indpnt === 'ask') return Array.from({ length: TROWS }, (_, i) => (this.asked[i] == null ? null : this.asked[i]));
    return Array.from({ length: TROWS }, (_, i) => +(this.start + i * st.tbl['ΔTbl']).toPrecision(12));
  };
  TableApp.prototype.editor = function () {
    if (this.col !== 0 || this.c.st.tbl.indpnt !== 'ask') return null;
    return this.ed || (this.ed = new window.FluxTIEditor({ mathprint: false }));
  };
  TableApp.prototype.commit = function () {
    if (!this.ed) return;
    const code = this.ed.serialize();
    this.ed = null;
    if (!code.trim()) return;
    const v = T().evaluate(code, this.c.st);
    if (typeof v !== 'number') T().fail('DATA TYPE');
    this.asked[this.row] = v;
  };
  TableApp.prototype.key = function (k) {
    const st = this.c.st, fns = this.fns();
    if (k === 'down') {
      this.commit();
      if (this.row < TROWS - 1) this.row++;
      else if (st.tbl.indpnt === 'auto') this.start = +(this.start + st.tbl['ΔTbl']).toPrecision(12);
      return true;
    }
    if (k === 'up') {
      this.commit();
      if (this.row > 0) this.row--;
      else if (st.tbl.indpnt === 'auto') this.start = +(this.start - st.tbl['ΔTbl']).toPrecision(12);
      return true;
    }
    if (k === 'left' && !this.ed) { this.col = Math.max(0, this.col - 1); return true; }
    if (k === 'right' && !this.ed) { this.col = Math.min(Math.max(1, fns.length), this.col + 1); return true; }
    if (k === 'clear' || k === 'quit') { this.c.pop(); return true; }
    if (k === 'enter') { this.commit(); return true; }
    const ed = this.editor();
    if (ed) return this.c.typeInto(ed, k);
    return false;
  };
  TableApp.prototype.render = function () {
    const st = this.c.st, fns = this.fns();
    const xs = this.xs();
    const VISC = 2;
    if (this.col > 0) {
      if (this.col < this.left0) this.left0 = this.col;
      if (this.col >= this.left0 + VISC) this.left0 = this.col - VISC + 1;
    }
    const shown = fns.slice(this.left0 - 1, this.left0 - 1 + VISC);
    const cols = 1 + Math.max(1, shown.length);
    const f = (v) => (Number.isFinite(v) ? T().fmtReal(+v.toPrecision(7), st.mode) : 'ERROR');
    let html = '<div class="t84tb"><div class="t84tb-g" style="grid-template-columns:repeat(' + cols + ',1fr)"><div class="t84tb-h">X</div>';
    if (!shown.length) html += '<div class="t84tb-h">Y₁</div>';
    shown.forEach((fn) => { html += '<div class="t84tb-h" style="color:' + fn.colour + '">' + esc(fn.name) + '</div>'; });
    let selText = '';
    for (let r = 0; r < TROWS; r++) {
      const x = xs[r];
      const selX = this.row === r && this.col === 0;
      html += '<div class="t84tb-c' + (selX ? ' is-sel' : '') + '">' + (selX && this.ed ? this.ed.html(this.c.cursorMark()) : esc(x == null ? '' : f(x))) + '</div>';
      if (selX) selText = 'X=' + (x == null ? '' : T().fmtReal(x));
      if (!shown.length) html += '<div class="t84tb-c"></div>';
      shown.forEach((fn, j) => {
        const y = x == null ? null : num(fn.f(x));
        const sel = this.row === r && this.col === this.left0 + j;
        html += '<div class="t84tb-c' + (sel ? ' is-sel' : '') + '">' + esc(x == null ? '' : f(y)) + '</div>';
        if (sel) selText = fn.name + '=' + (x == null ? '' : Number.isFinite(y) ? T().fmtReal(+y.toPrecision(10), st.mode) : 'ERROR');
      });
    }
    return html + '</div><div class="t84tb-b">' + esc(selText || (fns.length ? '' : 'No functions are on — press y=')) + '</div></div>';
  };

  /* ── WINDOW, TBLSET, FORMAT, STAT PLOT ──────────────────────────────── */

  function windowForm(c) {
    const st = c.st, w = st.win;
    const n = (key) => ({ label: key + '=', type: 'num', get: () => w[key], set: (v) => { w[key] = v; } });
    return new (core().FormApp)(c, () => {
      const rows = [];
      if (st.mode.graph === 'par') rows.push(n('Tmin'), n('Tmax'), n('Tstep'));
      if (st.mode.graph === 'pol') rows.push(n('θmin'), n('θmax'), n('θstep'));
      rows.push(n('Xmin'), n('Xmax'), n('Xscl'), n('Ymin'), n('Ymax'), n('Yscl'));
      if (st.mode.graph === 'func') rows.push(n('Xres'));
      rows.push({ label: 'ΔX=', type: 'num', get: () => +((w.Xmax - w.Xmin) / PX).toPrecision(10), set: (v) => { if (!(v > 0)) T().fail('DOMAIN'); w.Xmax = w.Xmin + v * PX; } });
      return rows;
    }, { title: 'WINDOW' });
  }
  function tblsetForm(c) {
    const st = c.st;
    return new (core().FormApp)(c, [
      { label: 'TblStart=', type: 'num', get: () => st.tbl.TblStart, set: (v) => { st.tbl.TblStart = v; } },
      { label: 'ΔTbl=', type: 'num', get: () => st.tbl['ΔTbl'], set: (v) => { if (v === 0) T().fail('INCREMENT'); st.tbl['ΔTbl'] = v; } },
      { label: 'Indpnt:', type: 'choice', get: () => st.tbl.indpnt, set: (v) => { st.tbl.indpnt = v; }, opts: [['Auto', 'auto'], ['Ask', 'ask']] },
      { label: 'Depend:', type: 'choice', get: () => st.tbl.depend, set: (v) => { st.tbl.depend = v; }, opts: [['Auto', 'auto'], ['Ask', 'ask']] },
    ], { title: 'TABLE SETUP' });
  }
  function formatForm(c) {
    const f = c.st.ui.fmt;
    const ch = (label, key, opts) => ({ label: label, type: 'choice', get: () => f[key], set: (v) => { f[key] = v; }, opts: opts });
    return new (core().FormApp)(c, [
      ch('', 'coord', [['CoordOn', true], ['CoordOff', false]]),
      ch('', 'grid', [['GridOff', 'off'], ['GridDot', 'dot'], ['GridLine', 'line']]),
      ch('Axes:', 'axes', [['On', true], ['Off', false]]),
      ch('', 'label', [['LabelOff', false], ['LabelOn', true]]),
      ch('', 'expr', [['ExprOn', true], ['ExprOff', false]]),
      ch('Detect Asymptotes:', 'detect', [['Off', false], ['On', true]]),
    ], { title: 'FORMAT' });
  }
  const PLOT_TYPES = [['Scatter', 'scatter'], ['xyLine', 'xyline'], ['Histogram', 'hist'], ['ModBox', 'modbox'], ['Box', 'box']];
  function plotForm(c, i) {
    const p = c.st.ui.plots[i];
    return new (core().FormApp)(c, () => {
      const rows = [
        { label: '', type: 'choice', get: () => p.on, set: (v) => { p.on = v; }, opts: [['On', true], ['Off', false]] },
        { label: 'Type:', type: 'choice', get: () => p.type, set: (v) => { p.type = v; }, opts: PLOT_TYPES },
        { label: 'Xlist:', type: 'list', get: () => p.x, set: (v) => { p.x = v; } },
      ];
      if (p.type === 'scatter' || p.type === 'xyline') rows.push({ label: 'Ylist:', type: 'list', get: () => p.y, set: (v) => { p.y = v; } });
      else rows.push({ label: 'Freq:', type: 'list', get: () => (p.f && p.f !== '1' ? p.f : ''), set: (v) => { p.f = v; } });
      rows.push({ label: 'Mark:', type: 'choice', get: () => p.mark, set: (v) => { p.mark = v; }, opts: [['□', '□'], ['+', '+'], ['·', '·']] });
      rows.push({ label: 'Color:', type: 'choice', get: () => p.col, set: (v) => { p.col = v; }, opts: [['BLUE', '#1f6feb'], ['RED', '#e5484d'], ['BLACK', '#1b1b1f'], ['GREEN', '#2da44e'], ['ORANGE', '#f08c24']] });
      return rows;
    }, { title: 'Plot' + (i + 1) });
  }
  function statPlotMenu(c) {
    const st = c.st;
    const summary = (p) => (p.on ? 'On ' : 'Off ') + ((PLOT_TYPES.find((t) => t[1] === p.type) || ['?'])[0]) + ' ' + p.x + (p.type === 'scatter' || p.type === 'xyline' ? ' ' + p.y : '');
    const items = st.ui.plots.map((p, i) => ({ l: 'Plot' + (i + 1) + ' ' + summary(p), act: 'plot:' + i }))
      .concat([{ l: 'PlotsOff', act: 'plots:off' }, { l: 'PlotsOn', act: 'plots:on' }]);
    const M = core().MenuApp;
    const m = new M(c, 'STAT', c.home);
    m.tabs = [{ name: 'STAT PLOTS', items: items }];
    m.key = function (k) {
      if (k === 'enter' || /^[1-5]$/.test(k)) {
        const it = items[k === 'enter' ? this.sel : Number(k) - 1];
        if (!it) return true;
        c.pop();
        if (/^plot:/.test(it.act)) c.push(plotForm(c, Number(it.act.slice(5))));
        else st.ui.plots.forEach((p) => { p.on = it.act === 'plots:on'; });
        return true;
      }
      return M.prototype.key.call(this, k);
    };
    return m;
  }

  /* ── DRAW and other commands from the home screen and programs ─────── */

  function command(c, name, args) {
    const st = c.st;
    const ev = (i) => { const v = T().evalNode(args[i], st); if (typeof v !== 'number') T().fail('DATA TYPE'); return v; };
    const put = (item) => { st.ui.draw.push(item); markDrawn(st); return { show: 'graph' }; };
    const fmtOn = { GridOn: ['grid', 'dot'], GridOff: ['grid', 'off'], AxesOn: ['axes', true], AxesOff: ['axes', false], LabelOn: ['label', true],
      LabelOff: ['label', false], CoordOn: ['coord', true], CoordOff: ['coord', false] };
    if (fmtOn[name]) { st.ui.fmt[fmtOn[name][0]] = fmtOn[name][1]; return { done: true }; }
    if (/^(ZStandard|ZTrig|ZDecimal|ZSquare|ZInteger|ZoomStat|ZoomFit|ZQuadrant1|ZoomRcl|ZoomSto)$/.test(name)) { applyZoom(c, name); return { done: true }; }
    switch (name) {
      case 'DispGraph': return { show: 'graph' };
      case 'DispTable': return { show: 'table' };
      case 'ClrDraw': st.ui.draw = []; return { done: true };
      case 'ClrTable': return { done: true };
      case 'FnOn': case 'FnOff': {
        const on = name === 'FnOn';
        const which = args.length ? args.map((a, i) => ev(i)) : [1, 2, 3, 4, 5, 6, 7, 8, 9, 0];
        which.forEach((n) => { st.ui.yOn['Y' + T().SUB[((n % 10) + 10) % 10]] = on; });
        return { done: true };
      }
      case 'Line(': return put({ k: 'line', x1: ev(0), y1: ev(1), x2: ev(2), y2: ev(3) });
      case 'Horizontal': return put({ k: 'hor', y: ev(0) });
      case 'Vertical': return put({ k: 'ver', x: ev(0) });
      case 'Circle(': return put({ k: 'circle', x: ev(0), y: ev(1), r: ev(2) });
      case 'Pt-On(': case 'Pt-Change(': return put({ k: 'pt', x: ev(0), y: ev(1) });
      case 'Pt-Off(': { const x = ev(0), y = ev(1); st.ui.draw = st.ui.draw.filter((d) => !(d.k === 'pt' && d.x === x && d.y === y)); return { show: 'graph' }; }
      case 'Text(': {
        const row = ev(0), col = ev(1);
        return put({ k: 'text', row: row, col: col, text: T().textOf(T().evalNode(args[2], st), st.mode) });
      }
      case 'DrawF': return put({ k: 'fn', node: args[0] });
      case 'DrawInv': return put({ k: 'inv', node: args[0] });
      case 'Tangent(': {
        const x0 = ev(1);
        const f = (x) => num(T().evalNode(args[0], st, null, { X: x }));
        const h = 1e-4 * Math.max(1, Math.abs(x0));
        return put({ k: 'tangent', x0: x0, y0: f(x0), m: (f(x0 + h) - f(x0 - h)) / (2 * h) });
      }
      case 'Shade(': return put({ k: 'shade', lower: args[0], upper: args[1], a: args[2] ? ev(2) : st.win.Xmin, b: args[3] ? ev(3) : st.win.Xmax, colour: '#1f6feb' });
      case 'ShadeNorm(': case 'Shade_t(': case 'Shadeχ²(': case 'ShadeF(': return shadeDist(c, name, args.map((a, i) => ev(i)));
      case 'Input': case 'Prompt': case 'Output(': case 'Pause': case 'If': case 'Then': case 'Else': case 'End': case 'For(':
      case 'While': case 'Repeat': case 'Return': case 'Stop': case 'Lbl': case 'Goto': case 'IS>(': case 'DS<(': case 'Menu(':
        T().fail('INVALID');
        return null;
      default: return { done: true };
    }
  }
  /** DISTR ▸ DRAW: the curve, its shaded area, and the area written on the graph. */
  function shadeDist(c, name, a) {
    const st = c.st, S = window.FluxTIStats;
    const lo = a[0], hi = a[1];
    let area;
    if (name === 'ShadeNorm(') area = S.normalcdf(lo, hi, a[2] == null ? 0 : a[2], a[3] == null ? 1 : a[3]);
    else if (name === 'Shade_t(') area = S.tcdf(lo, hi, a[2]);
    else if (name === 'Shadeχ²(') area = S.chi2cdf(lo, hi, a[2]);
    else area = S.Fcdf(lo, hi, a[2], a[3]);
    st.ui.draw.push({ k: 'shade', a: lo, b: hi, dist: { name: name, a: a }, colour: '#1f6feb' });
    st.ui.draw.push({ k: 'text', row: 2, col: 4, text: 'Area=' + T().fmtReal(+area.toPrecision(10)) });
    st.ui.draw.push({ k: 'text', row: 12, col: 4, text: 'low=' + T().fmtReal(+Math.max(-1e99, lo).toPrecision(6)) + '  up=' + T().fmtReal(+Math.min(1e99, hi).toPrecision(6)) });
    markDrawn(st);
    return { show: 'graph' };
  }

  /* ── Opening the screens ────────────────────────────────────────────── */

  function showGraph(c, opts) {
    const top = c.top();
    if (top instanceof GraphApp) {
      if (opts && opts.trace) top.startTrace();
      else if (opts && opts.calc) top.startCalc(opts.calc);
      else if (opts && opts.calcMenu) top.pendingCalcMenu = true;
      else { top.mode = 'view'; top.result = null; }
      return;
    }
    c.push(new GraphApp(c, opts));
  }
  function zoom(c, which, pasteCode) {
    // From a program editor the ZOOM menu pastes the command; everywhere else it zooms.
    const top = c.top();
    if (pasteCode && top !== c.home && top.editor && top.editor() && !(top instanceof GraphApp)) { top.editor().insertCode(pasteCode); return; }
    if (which === 'zbox' || which === 'zin' || which === 'zout') {
      showGraph(c);
      const g = c.top();
      g.mode = which;
      g.box = null;
      if (g.cx == null) g.centre();
      return;
    }
    applyZoom(c, which);
    showGraph(c);
  }

  window.FluxTIGraph = {
    graph: showGraph,
    table: (c) => c.push(new TableApp(c)),
    window: (c) => c.push(windowForm(c)),
    tblset: (c) => c.push(tblsetForm(c)),
    format: (c) => c.push(formatForm(c)),
    statplots: (c) => c.push(statPlotMenu(c)),
    zoom: zoom,
    command: command,
    applyZoom: applyZoom,
    activeFns: activeFns,
    markDrawn: markDrawn,
    GraphApp: GraphApp,
    TableApp: TableApp,
  };
})();
