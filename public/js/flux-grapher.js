/* ============================================================================
   FLUX GRAPHER  ·  flux-grapher.js
   One graphing engine, two presets.

     functions     Desmos-style. Type y = …, x = …, or (2, 3). Letters like a
                   and k become sliders. Select a curve to see its zeros,
                   maximums, minimums, y-intercept and where it crosses the
                   other curves. Square grid, axes through the origin.
     data          Everything above, plus tables. A table has as many value
                   columns as you like, and uncertainty columns that belong to
                   one of them; pick which column is x and which is y, choose a
                   fit, and the gradient comes back with its uncertainty. Title
                   and axis names, a framed plot, IB max/min gradient lines.

   Both: drag to pan, scroll or pinch to zoom, and an exact window (axis
   ranges) you can type in. The plot takes the whole stage; the list of
   equations and tables is a rail beside it that folds away.

   SURFACES
   --------
     create(host, { mode, surface: 'standalone' })  grapher.html. Nothing is
         written down unless the reader presses Save — the page is free and
         asks for nothing.
     mount(host, { mode: 'simple' })                Study tools → Grapher in the
         planner. Both presets behind a switch, with the working copy kept the
         way every other study tool keeps its state.

   The fitting maths lives in flux-lab-fit.js and the expression parser in
   flux-expr.js, both unit-tested. Saving lives in flux-grapher-cloud.js. This
   file is the document, the drawing and the interaction.
   ========================================================================== */
(function () {
  'use strict';

  const PALETTE = ['#00c2ff', '#f472b6', '#34d399', '#fbbf24', '#a78bfa', '#fb923c', '#f87171', '#22d3ee'];
  const WORK_KEYS = { data: 'flux_lab_graph', functions: 'flux_grapher_fns' };
  const MODE_KEY = 'flux_grapher_mode';
  const HANDOFF_KEY = 'flux_grapher_handoff';
  const HEX = /^#[0-9a-f]{6}$/i;
  const STEEP = '#f59e0b';
  const SHALLOW = '#a78bfa';

  /* ── Small helpers ──────────────────────────────────────────────────── */

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function svgIcon(body, size) {
    const s = size || 16;
    return '<svg viewBox="0 0 24 24" width="' + s + '" height="' + s + '" fill="none" stroke="currentColor"'
      + ' stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + body + '</svg>';
  }
  const ICON = {
    plus: svgIcon('<path d="M12 5v14M5 12h14"/>'),
    minus: svgIcon('<path d="M5 12h14"/>'),
    x: svgIcon('<path d="M18 6 6 18M6 6l12 12"/>', 14),
    home: svgIcon('<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>'),
    window: svgIcon('<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M8 4v5"/>'),
    rail: svgIcon('<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16"/>'),
    more: svgIcon('<circle cx="5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="19" cy="12" r="1.3"/>'),
    chev: svgIcon('<path d="m7 10 5 5 5-5"/>', 12),
    play: svgIcon('<path d="M7 5v14l11-7z" fill="currentColor"/>', 12),
    pause: svgIcon('<path d="M8 5v14M16 5v14"/>', 12),
    copy: svgIcon('<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 0 1 2-2h9"/>', 14),
    fn: '<span class="flg-glyph" aria-hidden="true"><i>ƒ</i>x</span>',
    table: svgIcon('<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M3 15h18M10 4v16"/>'),
    eye: svgIcon('<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>', 14),
    eyeOff: svgIcon('<path d="M3 3l18 18M10.6 5.1A10.4 10.4 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3.1 4M6.6 6.6C3.9 8.4 2 12 2 12s3.5 7 10 7a9.7 9.7 0 0 0 5.4-1.6"/>', 14),
    image: svgIcon('<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-5-5L5 21"/>'),
    cloud: svgIcon('<path d="M17.5 19a4.5 4.5 0 1 0-1.4-8.8A6 6 0 0 0 4.3 12 3.5 3.5 0 0 0 6.5 19z"/><path d="M12 12v6M9.5 14.5 12 12l2.5 2.5"/>'),
    folder: svgIcon('<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>'),
    expand: svgIcon('<path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/>'),
    undo: svgIcon('<path d="M9 14 4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 0 10h-3"/>', 15),
    redo: svgIcon('<path d="m15 14 5-5-5-5"/><path d="M20 9H9a5 5 0 0 0 0 10h3"/>', 15),
  };

  function readJSON(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) { return fallback; }
  }
  function writeJSON(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch (e) { return false; }
  }

  function str(v, max) {
    if (v == null) return '';
    return String(v).slice(0, max || 200);
  }
  function finite(v, d) {
    const n = typeof v === 'number' ? v : parseFloat(v);
    return Number.isFinite(n) ? n : d;
  }
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  /** A table cell as a number. Blank is "no reading", never zero. */
  function num(s) {
    if (typeof s === 'number') return s;
    const t = String(s == null ? '' : s).trim().replace(/^−/, '-');
    if (!t) return NaN;
    return Number(t);
  }

  /** Readable, without pretending to precision the readings do not have. */
  function fmt(v) {
    if (!Number.isFinite(v)) return '—';
    const a = Math.abs(v);
    if (a !== 0 && (a < 1e-3 || a >= 1e5)) return v.toExponential(3);
    return String(Math.round(v * 1e6) / 1e6);
  }

  /* A value and its uncertainty have to agree on decimal places, the way they
     get written up: 9.81 ± 0.03, never 9.8134829 ± 0.03. */
  function fmtWithU(v, u) {
    if (!Number.isFinite(u) || u === 0) return fmt(v);
    const places = Math.max(0, Math.ceil(-Math.log10(Math.abs(u))) + 1);
    if (!Number.isFinite(places) || places > 12) return fmt(v) + ' ± ' + fmt(u);
    return v.toFixed(places) + ' ± ' + u.toFixed(places);
  }

  /** A coordinate on the plot: six significant figures, and a true zero. */
  function fmtCoord(v, span) {
    if (!Number.isFinite(v)) return '—';
    if (Math.abs(v) < Math.abs(span || 1) * 1e-9) return '0';
    const a = Math.abs(v);
    if (a >= 1e6 || a < 1e-4) return v.toExponential(3).replace(/\.?0+e/, 'e');
    return String(Number(v.toPrecision(6))).replace(/^-/, '−');
  }

  function niceStep(span, target) {
    const raw = span / Math.max(1, target);
    const mag = Math.pow(10, Math.floor(Math.log10(raw)));
    const n = raw / mag;
    /* Steps of 1, 2 or 5 times a power of ten. Anything else gives labels like
       0.037 and makes a graph look like a spreadsheet accident. */
    return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * mag;
  }
  function tickValues(lo, hi, step) {
    const out = [];
    if (!(hi > lo) || !(step > 0)) return out;
    const a = Math.ceil(lo / step), b = Math.floor(hi / step);
    if (b - a > 500) return out;
    for (let k = a; k <= b; k++) out.push(k * step);
    return out;
  }
  function fmtTick(v, step) {
    if (Math.abs(v) < step * 1e-6) return '0';
    const a = Math.abs(v);
    if (a >= 1e6 || step < 1e-5) return v.toExponential(2).replace(/\.?0+e/, 'e').replace(/^-/, '−');
    const dp = clamp(-Math.floor(Math.log10(step) + 1e-9), 0, 10);
    return v.toFixed(dp).replace(/^-/, '−');
  }

  function axisTitle(label, unit) {
    const l = String(label || '').trim(), u = String(unit || '').trim();
    if (!l && !u) return '';
    return u ? (l ? l + ' / ' + u : u) : l;
  }

  function newId() { return 'i' + Math.random().toString(36).slice(2, 10); }

  function fitKinds() {
    const F = window.FluxLabFit;
    return [{ id: 'none', name: 'No fit' }].concat(F && F.KINDS ? F.KINDS : []);
  }

  /* ── The document ────────────────────────────────────────────────────
     Everything a graph is, and nothing about the screen showing it. This is
     what gets saved, so it is plain JSON and every load goes through
     normaliseDoc — a saved row or an old working copy is untrusted input. */

  function blankExpr(n, src) {
    return { id: newId(), type: 'expr', src: src || '', colour: PALETTE[n % PALETTE.length], hidden: false, dash: false };
  }
  function blankTable(n) {
    const cx = { id: newId(), name: 'x', unit: '', role: 'value' };
    const cy = { id: newId(), name: 'y', unit: '', role: 'value' };
    const rows = [];
    for (let i = 0; i < 6; i++) rows.push(['', '']);
    return {
      id: newId(), type: 'table', name: 'Data ' + (n + 1), colour: PALETTE[n % PALETTE.length],
      hidden: false, cols: [cx, cy], rows: rows, xCol: cx.id, yCol: cy.id, fit: 'linear', minmax: false,
    };
  }
  function blankDoc(kind) {
    if (kind === 'functions') {
      return {
        v: 3, kind: 'functions', title: '', xLabel: '', xUnit: '', yLabel: '', yUnit: '',
        win: { auto: false, square: true, grid: true, xMin: -10, xMax: 10, yMin: -7, yMax: 7 },
        params: {}, items: [blankExpr(0, 'x^2')],
      };
    }
    return {
      v: 3, kind: 'data', title: '', xLabel: '', xUnit: '', yLabel: '', yUnit: '',
      win: { auto: true, square: false, grid: true, xMin: 0, xMax: 10, yMin: 0, yMax: 10 },
      params: {}, items: [blankTable(0)],
    };
  }

  /* The first grapher stored one table as { rows:[{x,y}], ux, uy, … } and the
     first function half as { exprs:[…], view }. Both still open. */
  function fromV1Data(o) {
    const F = window.FluxLabFit;
    const cx = { id: newId(), name: str(o.xLabel, 40) || 'x', unit: str(o.xUnit, 20), role: 'value' };
    const cy = { id: newId(), name: str(o.yLabel, 40) || 'y', unit: str(o.yUnit, 20), role: 'value' };
    const cols = [cx, cy];
    const ux = o.ux && o.ux.mode && o.ux.mode !== 'none' ? o.ux : null;
    const uy = o.uy && o.uy.mode && o.uy.mode !== 'none' ? o.uy : null;
    const cux = ux ? { id: newId(), name: '', unit: '', role: 'unc', of: cx.id } : null;
    const cuy = uy ? { id: newId(), name: '', unit: '', role: 'unc', of: cy.id } : null;
    if (cux) cols.push(cux);
    if (cuy) cols.push(cuy);
    const unc = (v, rule) => {
      const n = num(v);
      if (!Number.isFinite(n) || !F) return '';
      return String(Number(F.resolveUncertainty(n, rule).toPrecision(6)));
    };
    const rows = (o.rows || []).map((r) => {
      const row = [str(r && r.x, 40), str(r && r.y, 40)];
      if (cux) row.push(unc(r && r.x, ux));
      if (cuy) row.push(unc(r && r.y, uy));
      return row;
    });
    return {
      title: o.title, win: { auto: true },
      items: [{
        id: newId(), type: 'table', name: 'Data 1', colour: PALETTE[0], cols: cols, rows: rows,
        xCol: cx.id, yCol: cy.id, fit: o.fitKind || 'linear', minmax: !!o.showMinMax,
      }],
    };
  }
  function fromV1Fns(o) {
    const view = o.view || {};
    return {
      win: { square: true, xMin: view.xLo, xMax: view.xHi, yMin: -7, yMax: 7 },
      items: (o.exprs || []).map((e) => ({ type: 'expr', src: e && e.src, colour: e && e.colour })),
    };
  }

  function normTable(it, colour, n) {
    const cols = [];
    const seen = {};
    (Array.isArray(it.cols) ? it.cols : []).slice(0, 12).forEach((c) => {
      if (!c || typeof c !== 'object') return;
      let id = str(c.id, 24) || newId();
      if (seen[id]) id = newId();
      seen[id] = 1;
      const role = c.role === 'unc' || c.role === 'calc' ? c.role : 'value';
      const col = { id: id, name: str(c.name, 40), unit: str(c.unit, 20), role: role };
      if (role === 'unc') col.of = str(c.of, 24);
      if (role === 'calc') col.expr = str(c.expr, 200);
      cols.push(col);
    });
    if (!cols.some((c) => c.role === 'value')) return null;
    // Anything that can be plotted: typed-in columns and calculated ones.
    const values = cols.filter((c) => c.role !== 'unc');
    cols.forEach((c) => {
      if (c.role === 'unc' && !values.some((v) => v.id === c.of)) c.of = values[values.length - 1].id;
    });
    const rows = [];
    (Array.isArray(it.rows) ? it.rows : []).slice(0, 2000).forEach((r) => {
      const a = Array.isArray(r) ? r : [];
      rows.push(cols.map((_, i) => str(a[i], 40)));
    });
    if (!rows.length) rows.push(cols.map(() => ''));
    const has = (id) => values.some((v) => v.id === id);
    const fits = fitKinds().map((k) => k.id);
    return {
      id: str(it.id, 24) || newId(), type: 'table', name: str(it.name, 60) || 'Data ' + (n + 1),
      colour: colour, hidden: !!it.hidden, cols: cols, rows: rows,
      xCol: has(it.xCol) ? it.xCol : values[0].id,
      yCol: has(it.yCol) ? it.yCol : (values[1] || values[0]).id,
      fit: fits.indexOf(it.fit) >= 0 ? it.fit : 'none',
      minmax: !!it.minmax,
    };
  }

  function normaliseDoc(raw, kind) {
    const k = kind === 'functions' ? 'functions' : 'data';
    const d = blankDoc(k);
    if (!raw || typeof raw !== 'object') return d;
    let src = raw;
    if (!Array.isArray(src.items)) {
      if (Array.isArray(src.rows)) src = fromV1Data(src);
      else if (Array.isArray(src.exprs)) src = fromV1Fns(src);
      else return d;
    }
    ['title', 'xLabel', 'xUnit', 'yLabel', 'yUnit'].forEach((f) => { d[f] = str(src[f], 120); });

    const w = src.win || {};
    d.win.auto = k === 'data' ? w.auto !== false : false;
    d.win.square = k === 'functions' ? w.square !== false : !!w.square;
    d.win.grid = w.grid !== false;
    const x0 = finite(w.xMin, d.win.xMin), x1 = finite(w.xMax, d.win.xMax);
    const y0 = finite(w.yMin, d.win.yMin), y1 = finite(w.yMax, d.win.yMax);
    if (x1 > x0) { d.win.xMin = x0; d.win.xMax = x1; }
    if (y1 > y0) { d.win.yMin = y0; d.win.yMax = y1; }

    if (src.params && typeof src.params === 'object') {
      Object.keys(src.params).slice(0, 26).forEach((p) => {
        if (!/^[a-zA-Z]$/.test(p)) return;
        const q = src.params[p] || {};
        let lo = finite(q.min, -10), hi = finite(q.max, 10);
        if (!(hi > lo)) { lo = -10; hi = 10; }
        const step = finite(q.step, 0.1);
        d.params[p] = { v: finite(q.v, 1), min: lo, max: hi, step: step > 0 ? step : 0.1 };
      });
    }

    const items = [];
    const ids = {};
    (Array.isArray(src.items) ? src.items : []).slice(0, 40).forEach((it, n) => {
      if (!it || typeof it !== 'object') return;
      const colour = HEX.test(it.colour) ? it.colour : PALETTE[n % PALETTE.length];
      let out = null;
      if (it.type === 'expr') {
        out = { id: str(it.id, 24) || newId(), type: 'expr', src: str(it.src, 500), colour: colour, hidden: !!it.hidden, dash: !!it.dash };
      } else if (it.type === 'table' && k === 'data') {
        out = normTable(it, colour, n);
      }
      if (!out) return;
      if (ids[out.id]) out.id = newId();
      ids[out.id] = 1;
      items.push(out);
    });
    if (items.length) d.items = items;
    return d;
  }

  /* ── Reading a table ─────────────────────────────────────────────────── */

  /** An uncertainty cell: a number, or a percentage of its reading ("2%"). */
  function uncOf(cell, reading) {
    const s = String(cell == null ? '' : cell).trim();
    if (!s) return 0;
    const pct = /^([0-9.eE+-]+)\s*%$/.exec(s);
    if (pct) {
      const p = Number(pct[1]);
      return Number.isFinite(p) ? Math.abs(reading * p / 100) : 0;
    }
    const n = num(s);
    return Number.isFinite(n) ? Math.abs(n) : 0;
  }

  /* A column name a formula can refer to: a word, no spaces. */
  const NAME_OK = /^[A-Za-zα-ωΑ-Ω][A-Za-z0-9α-ωΑ-Ω_]*$/;

  /**
   * Every row's numbers, with calculated columns filled in.
   *
   * A calculated column is a formula over the other columns by name — T^2
   * from a column called T, or L / T^2 — the way a pendulum or a spring gets
   * straightened into a line. Its uncertainty is carried through from the
   * columns it is made of, by the standard propagation rule
   *     u(f)² = Σ (∂f/∂xᵢ · u(xᵢ))²
   * with each partial derivative taken numerically. So T = 2.0 ± 0.1 gives
   * T² = 4.0 ± 0.4, and nobody has to remember to double the percentage.
   * A ± column pointed at a calculated column overrides the propagated value.
   *
   * Columns are worked out left to right, so a formula can use any typed
   * column and any calculated column to its left.
   */
  function computeTable(t) {
    const E = window.FluxExpr;
    const names = {};
    t.cols.forEach((c) => {
      if (c.role !== 'unc' && c.name && NAME_OK.test(c.name) && !names[c.name]) names[c.name] = c.id;
    });
    const scope = {};
    const calc = {};
    t.cols.forEach((c) => {
      if (c.role !== 'calc') return;
      if (!String(c.expr || '').trim()) { calc[c.id] = { empty: true }; return; }
      if (!E) { calc[c.id] = { error: 'The maths engine has not loaded.' }; return; }
      // '\u0001' as "the variable": in a formula, x means a column called x, never a free variable.
      calc[c.id] = E.tryCompile(c.expr, '\u0001', { names: names, scope: scope });
    });
    const uncIdx = {};
    t.cols.forEach((c, i) => { if (c.role === 'unc' && uncIdx[c.of] == null) uncIdx[c.of] = i; });

    const rows = t.rows.map((r) => {
      const v = {}, u = {};
      t.cols.forEach((c, i) => {
        if (c.role !== 'value') return;
        v[c.id] = num(r[i]);
        u[c.id] = uncIdx[c.id] != null ? uncOf(r[uncIdx[c.id]], v[c.id]) : 0;
      });
      t.cols.forEach((c) => {
        if (c.role !== 'calc') return;
        const k = calc[c.id];
        v[c.id] = NaN;
        u[c.id] = 0;
        if (!k || !k.fn) return;
        Object.keys(names).forEach((nm) => { scope[nm] = v[names[nm]]; });
        const val = k.fn(0);
        if (!Number.isFinite(val)) return;
        v[c.id] = val;
        let s2 = 0;
        (k.params || []).forEach((nm) => {
          const id = names[nm];
          const ui = u[id];
          if (!(ui > 0)) return;
          const xi = v[id];
          const h = Math.max(Math.abs(xi) * 1e-6, 1e-9);
          scope[nm] = xi + h;
          const up = k.fn(0);
          scope[nm] = xi - h;
          const dn = k.fn(0);
          scope[nm] = xi;
          const dfdx = (up - dn) / (2 * h);
          if (Number.isFinite(dfdx)) s2 += (dfdx * ui) * (dfdx * ui);
        });
        u[c.id] = Math.sqrt(s2);
        if (uncIdx[c.id] != null) u[c.id] = uncOf(r[uncIdx[c.id]], val);
      });
      return { v: v, u: u };
    });
    return { rows: rows, calc: calc, names: names };
  }

  /* tablePoints is called on every draw and every mouse move, so the last
     answer per table is kept until its columns or rows actually change. */
  const POINTS_CACHE = new WeakMap();

  /** Rows with numbers in both plotted columns, carrying their error bars. */
  function tablePoints(t) {
    const plottable = (id) => t.cols.some((c) => c.id === id && c.role !== 'unc');
    if (!plottable(t.xCol) || !plottable(t.yCol)) return [];
    const sig = JSON.stringify([t.cols, t.rows, t.xCol, t.yCol]);
    const hit = POINTS_CACHE.get(t);
    if (hit && hit.sig === sig) return hit.pts;
    const ct = computeTable(t);
    const out = [];
    ct.rows.forEach((row, ri) => {
      const x = row.v[t.xCol], y = row.v[t.yCol];
      if (!Number.isFinite(x) || !Number.isFinite(y)) return;
      out.push({ x: x, y: y, dx: row.u[t.xCol] || 0, dy: row.u[t.yCol] || 0, row: ri });
    });
    POINTS_CACHE.set(t, { sig: sig, pts: out });
    return out;
  }

  function calcText(v) { return Number.isFinite(v) ? String(Number(v.toPrecision(6))) : ''; }

  /* ── Reading an equation ─────────────────────────────────────────────
     y = f(x) is the common case; x = 3 draws a vertical line; (2, 5) or a
     list of them draws points. Unknown letters are sliders. */
  /**
   * Desmos-style limits: "x^2 {0 < x < 3}" draws only between 0 and 3.
   * Accepts <, >, ≤, ≥ (and <=, >=), chained or separated by commas; the
   * bounds may use sliders. Returns { test, params } or { error }.
   */
  function parseDomain(text, opts) {
    const E = window.FluxExpr;
    const lows = [], highs = [], params = [];
    const conds = String(text).split(',').map((c) => c.trim()).filter(Boolean);
    if (!conds.length) return { error: 'Put a limit inside the braces, like {0 < x < 3}.' };
    for (let k = 0; k < conds.length; k++) {
      const parts = conds[k].split(/\s*(<=|>=|≤|≥|<|>)\s*/);
      if (parts.length < 3) return { error: 'A limit compares x with a number, like {x > 0}.' };
      let sawX = false;
      for (let j = 0; j + 2 < parts.length; j += 2) {
        const a = parts[j].trim(), op = parts[j + 1], b = parts[j + 2].trim();
        const aX = /^x$/i.test(a), bX = /^x$/i.test(b);
        if (aX === bX) return { error: 'Each limit needs x on exactly one side, like {0 < x < 3}.' };
        const other = E.tryCompile(aX ? b : a, '\u0001', opts);
        if (other.error) return { error: other.error };
        other.params.forEach((p) => { if (params.indexOf(p) < 0) params.push(p); });
        const less = op === '<' || op === '<=' || op === '≤';
        // "x < b" and "b > x" both put b above x.
        ((aX ? less : !less) ? highs : lows).push(other.fn);
        sawX = true;
      }
      if (!sawX) return { error: 'A limit needs x in it.' };
    }
    const test = (x) => lows.every((f) => x >= f(0)) && highs.every((f) => x <= f(0));
    return { test: test, params: params };
  }

  function parseExpr(src, scope) {
    const E = window.FluxExpr;
    let s = String(src || '').trim();
    if (!s) return { kind: 'empty', params: [] };
    if (!E) return { error: 'The maths engine has not loaded.' };
    const opts = { params: true, scope: scope };

    let domain = null;
    const dm = /\{([^{}]*)\}\s*$/.exec(s);
    if (dm) {
      domain = parseDomain(dm[1], opts);
      if (domain.error) return { error: domain.error };
      s = s.slice(0, dm.index).trim();
      if (!s) return { kind: 'empty', params: [] };
    }

    if (s[0] === '(' && /^\(\s*[^()]+,[^()]+\)(\s*,?\s*\([^()]+,[^()]+\))*$/.test(s)) {
      const pts = [], params = [];
      const re = /\(([^(),]+),([^(),]+)\)/g;
      let m;
      while ((m = re.exec(s))) {
        const a = E.tryCompile(m[1], 'x', opts), b = E.tryCompile(m[2], 'x', opts);
        if (a.error) return { error: a.error };
        if (b.error) return { error: b.error };
        a.params.concat(b.params).forEach((p) => { if (params.indexOf(p) < 0) params.push(p); });
        pts.push({ fx: a.fn, fy: b.fn });
      }
      return { kind: 'points', pts: pts, params: params };
    }

    const vx = /^x\s*=\s*(.+)$/i.exec(s);
    if (vx && domain) return { error: 'Limits in { } work on y = … curves.' };
    if (vx) {
      const r = E.tryCompile(vx[1], 'x', opts);
      if (r.error) return { error: r.error };
      const a = r.fn(0.37), b = r.fn(1.91);
      if (Number.isFinite(a) && Math.abs(a - b) > 1e-12) {
        return { error: 'x = … draws a vertical line, so the right side needs to be a number.' };
      }
      return { kind: 'vline', fx: r.fn, params: r.params };
    }

    s = s.replace(/^y\s*=\s*/i, '').replace(/^[a-z]\s*\(\s*x\s*\)\s*=\s*/i, '');
    if (!s) return { kind: 'empty', params: [] };
    if (/[<>≤≥]/.test(s)) return { error: 'Inequalities are not supported yet — write y = … instead.' };
    if (s.indexOf('=') >= 0) return { error: 'Write it as y = … with y on its own on the left.' };
    const r = E.tryCompile(s, 'x', opts);
    if (r.error) return { error: r.error };
    if (!domain) return { kind: 'fn', fn: r.fn, params: r.params };
    const base = r.fn, inside = domain.test;
    const params = r.params.slice();
    domain.params.forEach((p) => { if (params.indexOf(p) < 0) params.push(p); });
    return { kind: 'fn', fn: (x) => (inside(x) ? base(x) : NaN), params: params };
  }

  /* ── Points of interest ──────────────────────────────────────────────
     What Desmos shows when you click a curve. Sampled across the visible x
     range, then refined: bisection for zeros and crossings, golden-section
     search for turning points. A sign change across a pole (tan x, 1/x) is
     not a zero, so every candidate is checked against the function itself. */

  function refineRoot(f, a, b, fa) {
    for (let k = 0; k < 64; k++) {
      const m = (a + b) / 2, fm = f(m);
      if (!Number.isFinite(fm)) return null;
      if (fm === 0) return m;
      if ((fa < 0) === (fm < 0)) { a = m; fa = fm; } else b = m;
    }
    return (a + b) / 2;
  }

  function refineTurn(f, a, b, isMax) {
    const g = (Math.sqrt(5) - 1) / 2;
    let c = b - g * (b - a), d = a + g * (b - a);
    let fc = f(c), fd = f(d);
    for (let k = 0; k < 90; k++) {
      if (isMax ? fc > fd : fc < fd) { b = d; d = c; fd = fc; c = b - g * (b - a); fc = f(c); }
      else { a = c; c = d; fc = fd; d = a + g * (b - a); fd = f(d); }
    }
    return (a + b) / 2;
  }

  function dedupe(list, eps) {
    list.sort((p, q) => p.x - q.x);
    const out = [];
    list.forEach((p) => {
      const twin = out.find((q) => Math.abs(q.x - p.x) <= eps && Math.abs(q.y - p.y) <= Math.max(eps, 1e-9));
      if (!twin) { out.push({ x: p.x, y: p.y, types: [p.type] }); return; }
      if (twin.types.indexOf(p.type) < 0) twin.types.push(p.type);
    });
    return out;
  }

  function keyPoints(f, xLo, xHi, span, samples) {
    const N = samples || 1200;
    const xs = new Array(N + 1), ys = new Array(N + 1);
    for (let i = 0; i <= N; i++) { xs[i] = xLo + (xHi - xLo) * i / N; ys[i] = f(xs[i]); }
    const big = Math.max(1, span) * 1e4;
    const ok = (y) => Number.isFinite(y) && Math.abs(y) < big;
    const tol = 1e-7 * Math.max(1, span);
    const out = [];

    for (let i = 1; i <= N; i++) {
      const y0 = ys[i - 1], y1 = ys[i];
      if (!ok(y0) || !ok(y1)) continue;
      if (y0 === 0) { out.push({ x: xs[i - 1], y: 0, type: 'zero' }); continue; }
      if (y1 !== 0 && (y0 < 0) !== (y1 < 0)) {
        const r = refineRoot(f, xs[i - 1], xs[i], y0);
        if (r != null && Math.abs(f(r)) < tol) out.push({ x: r, y: 0, type: 'zero' });
      }
    }
    if (ys[N] === 0) out.push({ x: xs[N], y: 0, type: 'zero' });

    for (let i = 1; i < N; i++) {
      const a = ys[i - 1], b = ys[i], c = ys[i + 1];
      if (!ok(a) || !ok(b) || !ok(c)) continue;
      const d1 = b - a, d2 = c - b;
      let isMax = null;
      if (d1 > 0 && d2 <= 0) isMax = true;
      else if (d1 < 0 && d2 >= 0) isMax = false;
      if (isMax === null) continue;
      const x = refineTurn(f, xs[i - 1], xs[i + 1], isMax);
      const y = f(x);
      if (!ok(y)) continue;
      // A jump dressed up as a turn: the refined point must be at least as extreme.
      if (isMax ? y < b - tol : y > b + tol) continue;
      out.push({ x: x, y: y, type: isMax ? 'max' : 'min' });
      // A curve that touches zero without crossing (x²) has a zero there too.
      if (Math.abs(y) < tol) out.push({ x: x, y: 0, type: 'zero' });
    }

    if (xLo < 0 && xHi > 0) {
      const y = f(0);
      if (ok(y)) out.push({ x: 0, y: y, type: 'yint' });
    }
    return dedupe(out, (xHi - xLo) / N * 2).slice(0, 120);
  }

  function intersections(f, g, xLo, xHi, span, samples) {
    const N = samples || 900;
    const big = Math.max(1, span) * 1e4;
    const tol = 1e-7 * Math.max(1, span);
    const h = (x) => f(x) - g(x);
    const out = [];
    let px = xLo, ph = h(px), pf = f(px), pg = g(px);
    for (let i = 1; i <= N; i++) {
      const x = xLo + (xHi - xLo) * i / N;
      const fx = f(x), gx = g(x), hx = fx - gx;
      const okNow = Number.isFinite(hx) && Math.abs(fx) < big && Math.abs(gx) < big;
      const okPrev = Number.isFinite(ph) && Math.abs(pf) < big && Math.abs(pg) < big;
      if (okNow && okPrev) {
        if (ph === 0) out.push({ x: px, y: pf, type: 'cross' });
        else if (hx !== 0 && (ph < 0) !== (hx < 0)) {
          const r = refineRoot(h, px, x, ph);
          if (r != null && Math.abs(h(r)) < tol && Number.isFinite(f(r))) out.push({ x: r, y: f(r), type: 'cross' });
        }
      }
      px = x; ph = hx; pf = fx; pg = gx;
    }
    return out;
  }

  const KP_NAMES = { zero: 'zero', max: 'maximum', min: 'minimum', yint: 'y-intercept', cross: 'intersection' };

  /* ── View geometry ───────────────────────────────────────────────────── */

  function mapper(v, fr) {
    const kx = fr.pw / (v.xHi - v.xLo), ky = fr.ph / (v.yHi - v.yLo);
    return {
      kx: kx, ky: ky,
      sx: (x) => fr.L + (x - v.xLo) * kx,
      sy: (y) => fr.T + (v.yHi - y) * ky,
      ix: (px) => v.xLo + (px - fr.L) / kx,
      iy: (py) => v.yHi - (py - fr.T) / ky,
    };
  }

  /* Colours for the exported image. On screen the stylesheet decides; a PNG
     going into a report is dark ink on white whatever theme made it. */
  const PRINT = {
    'flg-bgall': 'fill:#ffffff',
    'flg-plotbg': 'fill:#ffffff',
    'flg-gmin': 'stroke:#f1f4f8;stroke-width:1',
    'flg-gmaj': 'stroke:#dde3ec;stroke-width:1',
    'flg-axis': 'stroke:#334155;stroke-width:1.5',
    'flg-zero': 'stroke:#94a3b8;stroke-width:1',
    'flg-frame': 'stroke:#334155;stroke-width:1.2;fill:none',
    'flg-tick': 'fill:#334155;font-size:13px;font-family:Helvetica,Arial,sans-serif',
    'flg-tick flg-halo': 'fill:#334155;font-size:13px;font-family:Helvetica,Arial,sans-serif;paint-order:stroke;stroke:#fff;stroke-width:3px',
    'flg-axlabel': 'fill:#0f172a;font-size:15px;font-weight:600;font-family:Helvetica,Arial,sans-serif',
    'flg-axlabel flg-halo': 'fill:#0f172a;font-size:15px;font-weight:600;font-family:Helvetica,Arial,sans-serif;paint-order:stroke;stroke:#fff;stroke-width:4px',
    'flg-title': 'fill:#0f172a;font-size:19px;font-weight:700;font-family:Helvetica,Arial,sans-serif',
    'flg-leg': 'fill:#ffffff;fill-opacity:.94;stroke:#cbd5e1;stroke-width:1',
    'flg-legt': 'fill:#0f172a;font-size:13px;font-family:Helvetica,Arial,sans-serif',
    'flg-pinbox': 'fill:#ffffff;stroke:#cbd5e1;stroke-width:1',
    'flg-pint': 'fill:#0f172a;font-size:12px;font-family:Helvetica,Arial,sans-serif',
  };
  function cls(name, print) {
    return 'class="' + name + '"' + (print && PRINT[name] ? ' style="' + PRINT[name] + '"' : '');
  }

  /* ── Popovers and menus ──────────────────────────────────────────────
     One at a time, anchored to the button that opened it, and closed by a
     click anywhere else or Escape. Appended to <body> so a rail that scrolls
     or clips cannot crop them. */
  let POP = null;
  function closePop() {
    if (!POP) return;
    const p = POP;
    POP = null;
    document.removeEventListener('pointerdown', p.off, true);
    document.removeEventListener('keydown', p.key, true);
    if (p.el.parentNode) p.el.parentNode.removeChild(p.el);
    if (p.onClose) p.onClose();
  }
  function openPop(anchor, html, onMount, onClose) {
    closePop();
    const el = document.createElement('div');
    el.className = 'flg-pop';
    el.setAttribute('role', 'dialog');
    el.innerHTML = html;
    document.body.appendChild(el);
    const r = anchor.getBoundingClientRect();
    const vw = document.documentElement.clientWidth, vh = window.innerHeight;
    const w = el.offsetWidth, h = el.offsetHeight;
    const left = clamp(r.left, 8, Math.max(8, vw - w - 8));
    let top = r.bottom + 6;
    if (top + h > vh - 8) top = Math.max(8, r.top - h - 6);
    el.style.left = left + 'px';
    el.style.top = top + 'px';
    const off = (e) => { if (!el.contains(e.target) && !anchor.contains(e.target)) closePop(); };
    const key = (e) => { if (e.key === 'Escape') { e.stopPropagation(); closePop(); if (anchor.focus) anchor.focus(); } };
    POP = { el: el, off: off, key: key, onClose: onClose };
    setTimeout(() => {
      if (POP && POP.el === el) {
        document.addEventListener('pointerdown', off, true);
        document.addEventListener('keydown', key, true);
      }
    }, 0);
    if (onMount) onMount(el);
    return el;
  }
  function openMenu(anchor, entries) {
    const html = '<div class="flg-menu" role="menu">' + entries.map((e, i) =>
      '<button type="button" role="menuitem" class="flg-menu-i' + (e.danger ? ' is-danger' : '') + '" data-mi="' + i + '">'
      + (e.icon || '') + '<span>' + esc(e.label) + '</span></button>').join('') + '</div>';
    openPop(anchor, html, (el) => {
      el.addEventListener('click', (ev) => {
        const b = ev.target.closest('[data-mi]');
        if (!b) return;
        const e = entries[+b.dataset.mi];
        closePop();
        if (e && e.run) e.run();
      });
      const first = el.querySelector('button');
      if (first) first.focus();
    });
  }

  function toast(msg, kind) {
    try {
      if (typeof window.showToast === 'function') { window.showToast(msg, kind || 'info'); return; }
    } catch (e) {}
    const n = document.createElement('div');
    n.className = 'flg-toast' + (kind ? ' flg-toast--' + kind : '');
    n.setAttribute('role', 'status');
    n.textContent = msg;
    document.body.appendChild(n);
    setTimeout(() => { n.classList.add('flg-toast--out'); }, 2600);
    setTimeout(() => { if (n.parentNode) n.parentNode.removeChild(n); }, 3200);
  }

  /* ══ The grapher ═══════════════════════════════════════════════════════ */

  function Grapher(host, opts) {
    const o = opts || {};
    this.host = host;
    this.kind = o.mode === 'functions' ? 'functions' : 'data';
    this.surface = o.surface === 'planner' ? 'planner' : 'standalone';
    this.uid = 'flg' + Math.random().toString(36).slice(2, 8);
    this.scope = {};
    this.cache = new Map();         // item id → { src, res }
    this.active = null;             // the expression whose key points show
    this.pins = [];                 // key-point labels clicked to stay
    this.cloud = null;              // { id, title } once saved
    this.dirty = false;
    this.listeners = {};
    this.railHidden = false;
    this.resPos = null;
    this.undoStack = [];
    this.redoStack = [];
    this.doc = blankDoc(this.kind);
    if (this.surface === 'planner') {
      this.doc = normaliseDoc(readJSON(WORK_KEYS[this.kind], null), this.kind);
      const c = readJSON(WORK_KEYS[this.kind] + '_cloud', null);
      if (c && typeof c.id === 'string') this.cloud = { id: c.id, title: str(c.title, 120) };
    }
    this.syncScope();
    this.syncParams();
    this.build();
  }

  Grapher.prototype.on = function (ev, fn) {
    (this.listeners[ev] = this.listeners[ev] || []).push(fn);
  };
  Grapher.prototype.emit = function (ev, arg) {
    (this.listeners[ev] || []).forEach((fn) => { try { fn(arg); } catch (e) {} });
  };
  Grapher.prototype.$ = function (suffix) { return document.getElementById(this.uid + suffix); };

  /** Something about the graph itself changed (not merely where you are looking). */
  Grapher.prototype.touch = function () {
    this.dirty = true;
    clearTimeout(this._histT);
    this._histT = setTimeout(() => this.commitHistory(), 400);
    this.emit('change');
    if (this.surface !== 'planner') return;
    clearTimeout(this._saveT);
    this._saveT = setTimeout(() => this.persistLocal(), 350);
  };
  Grapher.prototype.persistLocal = function () {
    if (this.surface !== 'planner') return;
    writeJSON(WORK_KEYS[this.kind], this.doc);
    writeJSON(WORK_KEYS[this.kind] + '_cloud', this.cloud);
  };

  /* ── Undo and redo ──────────────────────────────────────────────────
     Edits settle for 400ms before they become one step, so typing "9.81"
     is one undo, not four. Where you are looking (pan and zoom) is not an
     edit and is not recorded. Inside a text box the browser's own undo
     still handles the letters; this is for everything else — a deleted
     row, a removed column, a colour. */
  Grapher.prototype.commitHistory = function () {
    const now = JSON.stringify(this.doc);
    if (this._snap != null && now !== this._snap) {
      this.undoStack.push(this._snap);
      if (this.undoStack.length > 100) this.undoStack.shift();
      this.redoStack = [];
    }
    this._snap = now;
    this.paintHistory();
  };
  Grapher.prototype.stepHistory = function (back) {
    clearTimeout(this._histT);
    this.commitHistory();
    const from = back ? this.undoStack : this.redoStack;
    const to = back ? this.redoStack : this.undoStack;
    if (!from.length) return false;
    to.push(this._snap);
    const json = from.pop();
    this.stopPlay();
    closePop();
    this.doc = normaliseDoc(JSON.parse(json), this.kind);
    this._snap = json;
    this.cache.clear();
    this.pins = [];
    this.syncScope();
    this.syncParams();
    this.renderItems();
    this.renderParams();
    this._resHTML = null;
    this.dirty = true;
    this.persistLocal();
    this.draw();
    this.paintHistory();
    this.emit('change');
    return true;
  };
  Grapher.prototype.paintHistory = function () {
    const u = this.root && this.root.querySelector('[data-hist="undo"]');
    const r = this.root && this.root.querySelector('[data-hist="redo"]');
    if (u) u.disabled = !this.undoStack.length;
    if (r) r.disabled = !this.redoStack.length;
  };

  /* ── Parsing, cached per item ───────────────────────────────────────── */

  Grapher.prototype.parsed = function (it) {
    const c = this.cache.get(it.id);
    if (c && c.src === it.src) return c.res;
    const res = parseExpr(it.src, this.scope);
    this.cache.set(it.id, { src: it.src, res: res });
    return res;
  };

  Grapher.prototype.syncScope = function () {
    Object.keys(this.scope).forEach((k) => { delete this.scope[k]; });
    Object.keys(this.doc.params).forEach((k) => { this.scope[k] = this.doc.params[k].v; });
  };

  /** Make sure every letter in use has a slider and no slider outlives its letter.
      Returns true when the set of sliders changed. */
  Grapher.prototype.syncParams = function () {
    const used = [];
    this.doc.items.forEach((it) => {
      if (it.type !== 'expr') return;
      const p = this.parsed(it);
      if (p && p.params) p.params.forEach((q) => { if (used.indexOf(q) < 0) used.push(q); });
    });
    let changed = false;
    used.forEach((q) => {
      if (!this.doc.params[q]) {
        this.doc.params[q] = { v: 1, min: -10, max: 10, step: 0.1 };
        this.scope[q] = 1;
        changed = true;
      }
    });
    Object.keys(this.doc.params).forEach((q) => {
      if (used.indexOf(q) < 0) { delete this.doc.params[q]; delete this.scope[q]; changed = true; }
    });
    return changed;
  };

  /* ── Layout ─────────────────────────────────────────────────────────── */

  Grapher.prototype.build = function () {
    const u = this.uid, data = this.kind === 'data';
    this.host.innerHTML = '<div class="flg flg--' + this.kind + ' flg--' + this.surface + '" id="' + u + 'Root">'
      + '<aside class="flg-rail" id="' + u + 'Rail" aria-label="' + (data ? 'Tables and equations' : 'Equations') + '">'
      +   '<div class="flg-items" id="' + u + 'Items"></div>'
      +   '<div class="flg-params" id="' + u + 'Params"></div>'
      +   '<div class="flg-addbar">'
      +     '<button type="button" class="flg-add" data-add="expr" title="Add an equation" aria-label="Add an equation">'
      +       ICON.plus + ICON.fn + '</button>'
      +     (data ? '<button type="button" class="flg-add" data-add="table" title="Add a table" aria-label="Add a table">'
      +       ICON.plus + ICON.table + '</button>' : '')
      +     '<span class="flg-hist">'
      +       '<button type="button" data-hist="undo" title="Undo (Ctrl+Z)" aria-label="Undo" disabled>' + ICON.undo + '</button>'
      +       '<button type="button" data-hist="redo" title="Redo (Ctrl+Shift+Z)" aria-label="Redo" disabled>' + ICON.redo + '</button>'
      +     '</span>'
      +   '</div>'
      + '</aside>'
      + '<section class="flg-stage" id="' + u + 'Stage" aria-label="Graph">'
      +   '<div class="flg-plot" id="' + u + 'Plot"></div>'
      +   '<div class="flg-trace" id="' + u + 'Trace" hidden><i></i><span></span></div>'
      +   (data ? '<div class="flg-results" id="' + u + 'Res" hidden></div>' : '')
      +   '<button type="button" class="flg-railbtn" data-tool="rail" title="Show or hide the list" aria-label="Show or hide the list">' + ICON.rail + '</button>'
      +   '<div class="flg-tools" role="toolbar" aria-label="View">'
      +     '<button type="button" data-tool="in" title="Zoom in" aria-label="Zoom in">' + ICON.plus + '</button>'
      +     '<button type="button" data-tool="out" title="Zoom out" aria-label="Zoom out">' + ICON.minus + '</button>'
      +     '<button type="button" data-tool="home" title="' + (data ? 'Fit to the data' : 'Back to the start') + '" aria-label="Reset the view">' + ICON.home + '</button>'
      +     '<button type="button" data-tool="win" class="flg-tool-window" title="Window, title and axes" aria-label="Window, title and axes">' + ICON.window + '</button>'
      +   '</div>'
      + '</section>'
      + '</div>';

    this.root = this.$('Root');
    this.renderItems();
    this.renderParams();
    this.wire();
    this.attachStage();
    this._snap = JSON.stringify(this.doc);
    const self = this;
    this._onKey = function (e) {
      if (!(e.metaKey || e.ctrlKey) || e.altKey) return;
      const k = (e.key || '').toLowerCase();
      if (k !== 'z' && k !== 'y') return;
      const a = document.activeElement;
      // A text box keeps its own undo for the letters being typed.
      if (a && (a.tagName === 'TEXTAREA' || (a.tagName === 'INPUT' && !a.readOnly && /^(text|search|)$/.test(a.type || '')))) return;
      // In the planner, only while you are working in the grapher.
      if (self.surface === 'planner' && !(a && self.root.contains(a))) return;
      if (document.querySelector('.fgc-back, .fgt-layer')) return;
      const back = k === 'z' && !e.shiftKey;
      if (self.stepHistory(back)) e.preventDefault();
    };
    document.addEventListener('keydown', this._onKey);
    if (this.kind === 'functions') {
      const first = this.doc.items.find((i) => i.type === 'expr' && !i.hidden);
      this.active = first ? first.id : null;
      this.root.querySelectorAll('.flg-item--expr').forEach((el) => el.classList.toggle('is-active', el.dataset.id === this.active));
    }
    this.draw();
  };

  /* ── The rail ───────────────────────────────────────────────────────── */

  Grapher.prototype.exprHTML = function (it, n) {
    const p = this.parsed(it);
    const err = p && p.error ? '<div class="flg-err" role="alert">' + esc(p.error) + '</div>' : '';
    return '<div class="flg-item flg-item--expr' + (it.hidden ? ' is-hidden' : '') + (this.active === it.id ? ' is-active' : '')
      + '" data-id="' + esc(it.id) + '">'
      + '<span class="flg-idx">' + (n + 1) + '</span>'
      + '<button type="button" class="flg-swatch" data-swatch="' + esc(it.id) + '" style="--c:' + it.colour + '"'
      + ' aria-label="Colour and visibility" title="Colour and visibility"></button>'
      + '<input type="text" class="flg-expr" data-expr="' + esc(it.id) + '" value="' + esc(it.src) + '"'
      + ' placeholder="y = …" spellcheck="false" autocomplete="off" autocapitalize="off" aria-label="Equation ' + (n + 1) + '">'
      + '<button type="button" class="flg-x" data-del="' + esc(it.id) + '" aria-label="Remove equation ' + (n + 1) + '">' + ICON.x + '</button>'
      + err
      + '</div>';
  };

  Grapher.prototype.valueCols = function (t) { return t.cols.filter((c) => c.role === 'value'); };
  /** Columns that can go on an axis or carry a ± column: typed and calculated. */
  Grapher.prototype.plotCols = function (t) { return t.cols.filter((c) => c.role !== 'unc'); };

  Grapher.prototype.colLabel = function (t, c) {
    if (c.role !== 'unc') return c.name || 'column';
    const of = t.cols.find((v) => v.id === c.of);
    return '± ' + (of ? (of.name || 'column') : '');
  };

  Grapher.prototype.rowHTML = function (t, r, ct) {
    const row = t.rows[r];
    const calc = ct && ct.rows[r];
    return '<tr data-r="' + r + '"><td class="flg-rn">' + (r + 1) + '</td>'
      + t.cols.map((c, ci) => {
        if (c.role === 'calc') {
          // Worked out, not typed: read-only, and skipped by Tab.
          const v = calc ? calc.v[c.id] : NaN, u = calc ? calc.u[c.id] : 0;
          return '<td class="is-calc"><input type="text" class="flg-cell is-calc" data-cell="' + r + ':' + ci + '" readonly tabindex="-1"'
            + ' value="' + esc(calcText(v)) + '" title="' + (u > 0 ? '± ' + esc(fmtCoord(u, 1)) : '') + '"'
            + ' aria-label="' + esc(this.colLabel(t, c)) + ', row ' + (r + 1) + ', calculated"></td>';
        }
        return '<td' + (c.role === 'unc' ? ' class="is-unc"' : '') + '>'
          + '<input type="text" inputmode="decimal" class="flg-cell" data-cell="' + r + ':' + ci + '" value="' + esc(row[ci]) + '"'
          + (c.role === 'unc' ? ' placeholder="±"' : '')
          + ' aria-label="' + esc(this.colLabel(t, c)) + ', row ' + (r + 1) + '"></td>';
      }).join('')
      + '<td class="flg-rdel"><button type="button" data-rdel="' + r + '" aria-label="Delete row ' + (r + 1) + '">' + ICON.x + '</button></td></tr>';
  };

  Grapher.prototype.tableHTML = function (t) {
    const values = this.plotCols(t);
    const ct = computeTable(t);
    const head = t.cols.map((c) => {
      const role = c.id === t.xCol ? 'x' : c.id === t.yCol ? 'y' : '';
      if (c.role === 'unc') {
        return '<th class="flg-col is-unc" data-col="' + esc(c.id) + '"><div class="flg-colh">'
          + '<span class="flg-pm" aria-hidden="true">±</span>'
          + '<select class="flg-cof" data-cof="' + esc(c.id) + '" aria-label="Uncertainty for which column">'
          + values.map((v) => '<option value="' + esc(v.id) + '"' + (v.id === c.of ? ' selected' : '') + '>' + esc(v.name || 'column') + '</option>').join('')
          + '</select>'
          + '<button type="button" class="flg-cmenu" data-cmenu="' + esc(c.id) + '" aria-label="Column options">' + ICON.chev + '</button>'
          + '</div><div class="flg-colsub">value or %</div></th>';
      }
      const k = c.role === 'calc' ? ct.calc[c.id] : null;
      return '<th class="flg-col' + (role ? ' is-' + role : '') + (c.role === 'calc' ? ' is-calc' : '') + '" data-col="' + esc(c.id) + '"><div class="flg-colh">'
        + (role ? '<span class="flg-axtag" aria-hidden="true">' + role + '</span>' : '')
        + '<input type="text" class="flg-cname" data-cname="' + esc(c.id) + '" value="' + esc(c.name) + '" placeholder="name" spellcheck="false" aria-label="Column name">'
        + '<button type="button" class="flg-cmenu" data-cmenu="' + esc(c.id) + '" aria-label="Column options">' + ICON.chev + '</button>'
        + '</div><input type="text" class="flg-cunit" data-cunit="' + esc(c.id) + '" value="' + esc(c.unit) + '" placeholder="unit" spellcheck="false" aria-label="Unit">'
        + (c.role === 'calc'
          ? '<div class="flg-calcrow"><span aria-hidden="true">=</span><input type="text" class="flg-cexpr' + (k && k.error ? ' is-bad' : '') + '" data-cexpr="' + esc(c.id) + '"'
            + ' value="' + esc(c.expr) + '" placeholder="' + esc(this.formulaHint(t)) + '" spellcheck="false" autocomplete="off"'
            + ' title="' + esc(k && k.error ? k.error : 'A formula using other columns by name') + '" aria-label="Formula for ' + esc(c.name || 'this column') + '"></div>'
          : '')
        + '</th>';
    }).join('');

    const opt = (sel) => values.map((v) => '<option value="' + esc(v.id) + '"' + (v.id === sel ? ' selected' : '') + '>'
      + esc(v.name || 'column') + '</option>').join('');

    return '<div class="flg-item flg-item--table' + (t.hidden ? ' is-hidden' : '') + '" data-id="' + esc(t.id) + '">'
      + '<div class="flg-tbar">'
      +   '<button type="button" class="flg-swatch" data-swatch="' + esc(t.id) + '" style="--c:' + t.colour + '" aria-label="Colour and visibility" title="Colour and visibility"></button>'
      +   '<input type="text" class="flg-tname" data-tname="' + esc(t.id) + '" value="' + esc(t.name) + '" spellcheck="false" aria-label="Table name">'
      +   '<button type="button" class="flg-ibtn" data-tmenu="' + esc(t.id) + '" aria-label="Table options" title="Table options">' + ICON.more + '</button>'
      +   '<button type="button" class="flg-x" data-del="' + esc(t.id) + '" aria-label="Remove table">' + ICON.x + '</button>'
      + '</div>'
      + '<div class="flg-twrap"><table class="flg-table"><thead><tr><th class="flg-rn"></th>' + head
      +   '<th class="flg-addcol"><button type="button" data-addcol="' + esc(t.id) + '" title="Add a column" aria-label="Add a column">' + ICON.plus + '</button></th>'
      + '</tr></thead><tbody>' + t.rows.map((_, r) => this.rowHTML(t, r, ct)).join('') + '</tbody></table></div>'
      + '<div class="flg-tfoot">'
      +   '<label class="flg-axsel"><span>x</span><select data-xcol="' + esc(t.id) + '" aria-label="Column on the x axis">' + opt(t.xCol) + '</select></label>'
      +   '<label class="flg-axsel"><span>y</span><select data-ycol="' + esc(t.id) + '" aria-label="Column on the y axis">' + opt(t.yCol) + '</select></label>'
      +   '<select class="flg-fitsel" data-fit="' + esc(t.id) + '" aria-label="Line of best fit">'
      +     fitKinds().map((k) => '<option value="' + k.id + '"' + (t.fit === k.id ? ' selected' : '') + '>' + esc(k.name) + '</option>').join('')
      +   '</select>'
      +   '<button type="button" class="flg-chip' + (t.minmax ? ' is-on' : '') + '" data-minmax="' + esc(t.id) + '" aria-pressed="' + t.minmax + '"'
      +     ' title="Steepest and shallowest lines through the error bars">max/min</button>'
      + '</div>'
      + '</div>';
  };

  Grapher.prototype.itemHTML = function (it, n) {
    return it.type === 'table' ? this.tableHTML(it) : this.exprHTML(it, n);
  };

  Grapher.prototype.renderItems = function () {
    const box = this.$('Items');
    if (!box) return;
    let e = 0;
    box.innerHTML = this.doc.items.map((it) => this.itemHTML(it, it.type === 'expr' ? e++ : 0)).join('');
  };

  Grapher.prototype.rerenderItem = function (id) {
    const el = this.root.querySelector('.flg-item[data-id="' + CSS.escape(id) + '"]');
    const it = this.item(id);
    if (!el || !it) { this.renderItems(); return; }
    const n = this.doc.items.filter((i) => i.type === 'expr').indexOf(it);
    el.outerHTML = this.itemHTML(it, Math.max(0, n));
  };

  Grapher.prototype.renderParams = function () {
    const box = this.$('Params');
    if (!box) return;
    const keys = Object.keys(this.doc.params).sort();
    box.innerHTML = keys.map((k) => {
      const p = this.doc.params[k];
      return '<div class="flg-param" data-p="' + k + '">'
        + '<span class="flg-pname">' + k + '</span>'
        + '<input type="range" class="flg-prange" data-prange="' + k + '" min="' + p.min + '" max="' + p.max + '" step="' + p.step + '" value="' + p.v + '" aria-label="Slider ' + k + '">'
        + '<input type="text" inputmode="decimal" class="flg-pval" data-pval="' + k + '" value="' + fmtCoord(p.v, 1).replace('−', '-') + '" aria-label="Value of ' + k + '">'
        + '<button type="button" class="flg-pplay" data-pplay="' + k + '" aria-label="Animate ' + k + '" title="Animate">'
        + (this._play && this._play.k === k ? ICON.pause : ICON.play) + '</button>'
        + '</div>';
    }).join('');
    box.hidden = !keys.length;
  };

  Grapher.prototype.showExprError = function (id) {
    const el = this.root.querySelector('.flg-item[data-id="' + CSS.escape(id) + '"]');
    const it = this.item(id);
    if (!el || !it) return;
    const old = el.querySelector('.flg-err');
    if (old) old.remove();
    const p = this.parsed(it);
    if (p && p.error && it.src.trim()) {
      const d = document.createElement('div');
      d.className = 'flg-err';
      d.setAttribute('role', 'alert');
      d.textContent = p.error;
      el.appendChild(d);
    }
  };

  Grapher.prototype.setActive = function (id) {
    if (this.active === id) return;
    this.active = id;
    this.root.querySelectorAll('.flg-item--expr').forEach((el) => {
      el.classList.toggle('is-active', el.dataset.id === id);
    });
    this.draw();
  };

  /* ── Editing ────────────────────────────────────────────────────────── */

  Grapher.prototype.item = function (id) { return this.doc.items.find((i) => i.id === id) || null; };
  Grapher.prototype.itemOf = function (el) {
    const box = el && el.closest ? el.closest('.flg-item') : null;
    return box ? this.item(box.dataset.id) : null;
  };

  Grapher.prototype.addItem = function (type) {
    const n = this.doc.items.filter((i) => i.type === type).length;
    const colourIdx = this.doc.items.length;
    const it = type === 'table' ? blankTable(n) : blankExpr(colourIdx, '');
    if (type === 'table') it.colour = PALETTE[colourIdx % PALETTE.length];
    this.doc.items.push(it);
    this.touch();
    this.renderItems();
    this.draw();
    const sel = type === 'table' ? '.flg-item[data-id="' + CSS.escape(it.id) + '"] .flg-cell' : '[data-expr="' + CSS.escape(it.id) + '"]';
    const f = this.root.querySelector(sel);
    if (f) { f.focus(); f.scrollIntoView({ block: 'nearest' }); }
  };

  Grapher.prototype.removeItem = function (id) {
    const i = this.doc.items.findIndex((x) => x.id === id);
    if (i < 0) return;
    const it = this.doc.items[i];
    if (it.type === 'table' && it.rows.some((r) => r.some((c) => String(c).trim() !== ''))
      && !window.confirm('Remove "' + (it.name || 'this table') + '" and its readings?')) return;
    this.doc.items.splice(i, 1);
    this.cache.delete(id);
    if (this.active === id) this.active = null;
    this.pins = this.pins.filter((p) => p.item !== id);
    if (!this.doc.items.length) this.doc.items.push(this.kind === 'data' ? blankTable(0) : blankExpr(0, ''));
    if (this.syncParams()) this.renderParams();
    this.touch();
    this.renderItems();
    this.draw();
  };

  /** A name no other column has, and that a formula can refer to (no spaces). */
  Grapher.prototype.freshName = function (t, stem) {
    let n = 1;
    while (t.cols.some((c) => c.name === stem + n)) n++;
    return stem + n;
  };

  /** Placeholder for a formula box, built from this table's own column names. */
  Grapher.prototype.formulaHint = function (t) {
    const named = this.valueCols(t).map((c) => c.name).filter((n) => NAME_OK.test(n));
    if (named.length >= 2) return named[1] + ' / ' + named[0];
    return named.length ? named[0] + '^2' : 'x^2';
  };

  Grapher.prototype.addColumn = function (t, role, ofId) {
    if (t.cols.length >= 12) { toast('A table can have up to 12 columns.', 'warning'); return; }
    const values = this.plotCols(t);
    const col = { id: newId(), name: '', unit: '', role: role };
    if (role === 'unc') {
      const bare = [t.yCol, t.xCol].concat(values.map((v) => v.id))
        .find((id) => !t.cols.some((c) => c.role === 'unc' && c.of === id));
      col.of = ofId || bare || t.yCol;
      // Beside the column it belongs to, the way it is written in a lab book.
      const at = t.cols.findIndex((c) => c.id === col.of);
      t.cols.splice(at + 1, 0, col);
      t.rows.forEach((r) => r.splice(at + 1, 0, ''));
    } else {
      // Named so a formula can use it straight away: c3, not "col 3".
      col.name = this.freshName(t, role === 'calc' ? 'f' : 'c');
      if (role === 'calc') col.expr = '';
      t.cols.push(col);
      t.rows.forEach((r) => r.push(''));
    }
    this.touch();
    this.rerenderItem(t.id);
    this.draw();
    const idx = t.cols.indexOf(col);
    const target = role === 'unc'
      ? this.root.querySelector('.flg-item[data-id="' + CSS.escape(t.id) + '"] [data-cell="0:' + idx + '"]')
      : role === 'calc'
        ? this.root.querySelector('[data-cexpr="' + CSS.escape(col.id) + '"]')
        : this.root.querySelector('[data-cname="' + CSS.escape(col.id) + '"]');
    if (target) { target.focus(); if (target.select) target.select(); }
  };

  Grapher.prototype.removeColumn = function (t, colId) {
    const idx = t.cols.findIndex((c) => c.id === colId);
    if (idx < 0) return;
    const col = t.cols[idx];
    if (col.role === 'value' && this.valueCols(t).length <= 1) { toast('A table needs at least one value column.', 'warning'); return; }
    const doomed = [idx];
    if (col.role !== 'unc') {
      t.cols.forEach((c, i) => { if (c.role === 'unc' && c.of === colId) doomed.push(i); });
    }
    doomed.sort((a, b) => b - a).forEach((i) => {
      t.cols.splice(i, 1);
      t.rows.forEach((r) => r.splice(i, 1));
    });
    const values = this.plotCols(t);
    if (!values.some((v) => v.id === t.xCol)) t.xCol = values[0].id;
    if (!values.some((v) => v.id === t.yCol)) t.yCol = (values[1] || values[0]).id;
    this.touch();
    this.rerenderItem(t.id);
    this.draw();
  };

  /** Fill an uncertainty column: one number for every row, or a percentage. */
  Grapher.prototype.fillColumn = function (t, colId, anchor) {
    const self = this;
    openPop(anchor, '<form class="flg-fill"><label>Same ± for every row'
      + '<input type="text" inputmode="decimal" placeholder="0.5 or 2%" aria-label="Uncertainty for every row"></label>'
      + '<button type="submit" class="flg-btn">Fill</button></form>', (el) => {
      const inp = el.querySelector('input');
      inp.focus();
      el.querySelector('form').addEventListener('submit', (e) => {
        e.preventDefault();
        const v = inp.value.trim();
        if (!v || (!/%\s*$/.test(v) && !Number.isFinite(num(v)))) { inp.focus(); return; }
        const idx = t.cols.findIndex((c) => c.id === colId);
        t.rows.forEach((r) => { r[idx] = v; });
        closePop();
        self.touch();
        self.rerenderItem(t.id);
        self.draw();
      });
    });
  };

  /** A pasted block lands across columns and rows, adding either as needed. */
  Grapher.prototype.pasteBlock = function (t, text, r0, c0) {
    const lines = String(text).replace(/\r/g, '').split('\n').filter((l) => l.trim() !== '');
    const grid = [];
    lines.forEach((line) => {
      const cells = line.split(/\t|,|;|\s+/).map((c) => c.trim()).filter((c) => c !== '');
      if (!cells.length) return;
      // A header row pasted with the data would otherwise become blank readings.
      if (!cells.some((c) => Number.isFinite(num(c.replace(/%$/, ''))))) return;
      grid.push(cells);
    });
    if (!grid.length) return false;
    const width = Math.max.apply(null, grid.map((g) => g.length));
    /* Pasted values go into typed columns only — a calculated column is
       stepped over, not overwritten — adding columns at the end as needed. */
    const slots = () => t.cols.map((c, i) => (i >= c0 && c.role !== 'calc' ? i : -1)).filter((i) => i >= 0);
    while (slots().length < width && t.cols.length < 12) {
      t.cols.push({ id: newId(), name: this.freshName(t, 'c'), unit: '', role: 'value' });
      t.rows.forEach((r) => r.push(''));
    }
    const target = slots();
    grid.forEach((cells, i) => {
      const r = r0 + i;
      while (t.rows.length <= r) t.rows.push(t.cols.map(() => ''));
      cells.forEach((v, j) => { if (j < target.length) t.rows[r][target[j]] = v.slice(0, 40); });
    });
    const last = t.rows[t.rows.length - 1];
    if (last.some((c) => String(c).trim() !== '')) t.rows.push(t.cols.map(() => ''));
    this.touch();
    this.rerenderItem(t.id);
    this.draw();
    return true;
  };

  /** Refill a table's calculated cells in place, without disturbing focus. */
  Grapher.prototype.refreshCalc = function (t) {
    if (!t.cols.some((c) => c.role === 'calc')) return;
    const box = this.root.querySelector('.flg-item[data-id="' + CSS.escape(t.id) + '"]');
    if (!box) return;
    const ct = computeTable(t);
    t.cols.forEach((c, ci) => {
      if (c.role !== 'calc') return;
      const k = ct.calc[c.id];
      const ex = box.querySelector('[data-cexpr="' + CSS.escape(c.id) + '"]');
      if (ex) {
        ex.classList.toggle('is-bad', !!(k && k.error));
        ex.title = k && k.error ? k.error : 'A formula using other columns by name';
      }
      ct.rows.forEach((row, r) => {
        const inp = box.querySelector('[data-cell="' + r + ':' + ci + '"]');
        if (!inp) return;
        inp.value = calcText(row.v[c.id]);
        inp.title = row.u[c.id] > 0 ? '± ' + fmtCoord(row.u[c.id], 1) : '';
      });
    });
  };

  Grapher.prototype.swatchPop = function (it, anchor) {
    const self = this;
    const html = '<div class="flg-swpop">'
      + '<div class="flg-swrow">' + PALETTE.map((c) => '<button type="button" class="flg-swdot' + (c === it.colour ? ' is-on' : '')
        + '" data-c="' + c + '" style="--c:' + c + '" aria-label="Colour ' + c + '"></button>').join('')
      + '<label class="flg-swcustom" title="Any colour"><input type="color" value="' + it.colour + '" aria-label="Any colour"></label></div>'
      + '<div class="flg-swopts">'
      + '<button type="button" class="flg-swopt" data-vis>' + (it.hidden ? ICON.eyeOff : ICON.eye) + '<span>' + (it.hidden ? 'Hidden' : 'Shown') + '</span></button>'
      + (it.type === 'expr' ? '<button type="button" class="flg-swopt" data-dash><span class="flg-dashprev' + (it.dash ? ' is-dash' : '') + '" style="--c:' + it.colour + '"></span><span>' + (it.dash ? 'Dashed' : 'Solid') + '</span></button>' : '')
      + '</div></div>';
    const apply = () => {
      self.touch();
      self.rerenderItem(it.id);
      self.draw();
    };
    openPop(anchor, html, (el) => {
      el.addEventListener('click', (e) => {
        const dot = e.target.closest('[data-c]');
        if (dot) { it.colour = dot.dataset.c; closePop(); apply(); return; }
        if (e.target.closest('[data-vis]')) { it.hidden = !it.hidden; closePop(); apply(); return; }
        if (e.target.closest('[data-dash]')) { it.dash = !it.dash; closePop(); apply(); }
      });
      el.querySelector('input[type=color]').addEventListener('input', (e) => {
        if (HEX.test(e.target.value)) {
          it.colour = e.target.value;
          const sw = self.root.querySelector('[data-swatch="' + CSS.escape(it.id) + '"]');
          if (sw) sw.style.setProperty('--c', it.colour);
          self.touch();
          self.draw();
        }
      });
    });
  };

  Grapher.prototype.wire = function () {
    const self = this, root = this.root;

    root.addEventListener('input', (e) => {
      const t = e.target, d = t.dataset || {};
      if (d.expr) {
        const it = self.item(d.expr);
        if (!it) return;
        it.src = t.value;
        self.pins = self.pins.filter((p) => p.item !== it.id);
        if (self.syncParams()) self.renderParams();
        self.showExprError(it.id);
        self.touch();
        self.draw();
      } else if (d.cell) {
        const tb = self.itemOf(t);
        if (!tb) return;
        const parts = d.cell.split(':');
        const r = +parts[0], c = +parts[1];
        if (!tb.rows[r]) return;
        if (tb.cols[c] && tb.cols[c].role === 'calc') return;
        tb.rows[r][c] = t.value;
        // Always a spare row at the bottom, so the next reading has somewhere to go.
        if (r === tb.rows.length - 1 && t.value.trim() !== '' && tb.rows.length < 2000) {
          tb.rows.push(tb.cols.map(() => ''));
          const body = t.closest('tbody');
          if (body) body.insertAdjacentHTML('beforeend', self.rowHTML(tb, tb.rows.length - 1));
        }
        self.refreshCalc(tb);
        self.touch();
        self.draw();
      } else if (d.cexpr) {
        const tb = self.itemOf(t);
        const col = tb && tb.cols.find((c) => c.id === d.cexpr);
        if (!col) return;
        col.expr = t.value.slice(0, 200);
        self.refreshCalc(tb);
        self.touch();
        self.draw();
      } else if (d.tname) {
        const tb = self.item(d.tname);
        if (tb) { tb.name = t.value.slice(0, 60); self.touch(); self.draw(); }
      } else if (d.cname || d.cunit) {
        const tb = self.itemOf(t);
        const col = tb && tb.cols.find((c) => c.id === (d.cname || d.cunit));
        if (!col) return;
        if (d.cname) {
          col.name = t.value.slice(0, 40);
          // The x / y pickers and the ± headers name this column too.
          const box = t.closest('.flg-item');
          box.querySelectorAll('option[value="' + CSS.escape(col.id) + '"]').forEach((o) => { o.textContent = col.name || 'column'; });
        } else {
          col.unit = t.value.slice(0, 20);
        }
        // Renaming a column changes what the formulas that use it can see.
        if (d.cname) self.refreshCalc(tb);
        self.touch();
        self.draw();
      } else if (d.prange || d.pval) {
        const k = d.prange || d.pval;
        const p = self.doc.params[k];
        if (!p) return;
        const v = d.prange ? parseFloat(t.value) : num(t.value);
        if (!Number.isFinite(v)) return;
        if (d.pval && (v < p.min || v > p.max)) {
          const reach = Math.pow(10, Math.ceil(Math.log10(Math.abs(v) + 1e-9)));
          p.min = Math.min(p.min, -reach); p.max = Math.max(p.max, reach);
          const range = root.querySelector('[data-prange="' + k + '"]');
          if (range) { range.min = p.min; range.max = p.max; }
        }
        p.v = v;
        self.scope[k] = v;
        const other = d.prange ? root.querySelector('[data-pval="' + k + '"]') : root.querySelector('[data-prange="' + k + '"]');
        if (other && other !== document.activeElement) other.value = d.prange ? fmtCoord(v, 1).replace('−', '-') : v;
        self.touch();
        self.draw();
      }
    });

    root.addEventListener('change', (e) => {
      const t = e.target, d = t.dataset || {};
      const tb = self.itemOf(t);
      if (!tb) return;
      if (d.xcol) tb.xCol = t.value;
      else if (d.ycol) tb.yCol = t.value;
      else if (d.fit) tb.fit = t.value;
      else if (d.cof) {
        const col = tb.cols.find((c) => c.id === d.cof);
        if (col) col.of = t.value;
      } else return;
      self.touch();
      if (d.xcol || d.ycol || d.cof) self.rerenderItem(tb.id);
      self.draw();
    });

    root.addEventListener('focusin', (e) => {
      const d = e.target.dataset || {};
      if (d.expr) self.setActive(d.expr);
    });

    root.addEventListener('keydown', (e) => {
      const t = e.target, d = t.dataset || {};
      if (d.cell && (e.key === 'Enter' || e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
        const tb = self.itemOf(t);
        if (!tb) return;
        const parts = d.cell.split(':');
        const r = +parts[0] + (e.key === 'ArrowUp' ? -1 : 1);
        const c = +parts[1];
        if (r < 0) return;
        e.preventDefault();
        if (r >= tb.rows.length) {
          tb.rows.push(tb.cols.map(() => ''));
          const body = t.closest('tbody');
          if (body) body.insertAdjacentHTML('beforeend', self.rowHTML(tb, r));
        }
        const box = t.closest('.flg-item');
        const next = box && box.querySelector('[data-cell="' + r + ':' + c + '"]');
        if (next) { next.focus(); next.select(); }
      } else if (d.expr && e.key === 'Enter') {
        e.preventDefault();
        const i = self.doc.items.findIndex((x) => x.id === d.expr);
        const nxt = self.doc.items.slice(i + 1).find((x) => x.type === 'expr');
        if (nxt) {
          const inp = root.querySelector('[data-expr="' + CSS.escape(nxt.id) + '"]');
          if (inp) inp.focus();
        } else self.addItem('expr');
      }
    });

    root.addEventListener('paste', (e) => {
      const t = e.target, d = t.dataset || {};
      if (!d.cell) return;
      const text = (e.clipboardData || window.clipboardData).getData('text') || '';
      if (!/[\n\t,;]|\s/.test(text.trim())) return;       // one value — let it through
      const tb = self.itemOf(t);
      if (!tb) return;
      const parts = d.cell.split(':');
      e.preventDefault();
      self.pasteBlock(tb, text, +parts[0], +parts[1]);
    });

    root.addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b || !root.contains(b)) return;
      const d = b.dataset;
      if (d.add) { self.addItem(d.add); return; }
      if (d.del) { self.removeItem(d.del); return; }
      if (d.swatch) { const it = self.item(d.swatch); if (it) self.swatchPop(it, b); return; }
      if (d.tool) { self.tool(d.tool, b); return; }
      if (d.pplay) { self.togglePlay(d.pplay); return; }
      if (d.hist) { self.stepHistory(d.hist === 'undo'); return; }
      const tb = self.itemOf(b);
      if (!tb) return;
      if (d.rdel != null && d.rdel !== '') {
        tb.rows.splice(+d.rdel, 1);
        if (!tb.rows.length) tb.rows.push(tb.cols.map(() => ''));
        self.touch();
        self.rerenderItem(tb.id);
        self.draw();
      } else if (d.minmax) {
        tb.minmax = !tb.minmax;
        b.classList.toggle('is-on', tb.minmax);
        b.setAttribute('aria-pressed', String(tb.minmax));
        self.touch();
        self.draw();
      } else if (d.addcol) {
        openMenu(b, [
          { label: 'Value column', icon: ICON.plus, run: () => self.addColumn(tb, 'value') },
          { label: 'Uncertainty (±) column', icon: '<span class="flg-pm">±</span>', run: () => self.addColumn(tb, 'unc') },
          { label: 'Calculated column (formula)', icon: '<span class="flg-pm flg-pm--calc">=</span>', run: () => self.addColumn(tb, 'calc') },
        ]);
      } else if (d.cmenu) {
        const col = tb.cols.find((c) => c.id === d.cmenu);
        if (!col) return;
        const entries = [];
        if (col.role !== 'unc') {
          entries.push({ label: 'Plot on the x axis', run: () => { tb.xCol = col.id; self.touch(); self.rerenderItem(tb.id); self.draw(); } });
          entries.push({ label: 'Plot on the y axis', run: () => { tb.yCol = col.id; self.touch(); self.rerenderItem(tb.id); self.draw(); } });
          entries.push({ label: 'Add a ± column for it', icon: '<span class="flg-pm">±</span>', run: () => self.addColumn(tb, 'unc', col.id) });
        } else {
          entries.push({ label: 'Same ± for every row…', run: () => {
            const th = self.root.querySelector('[data-col="' + CSS.escape(col.id) + '"]');
            self.fillColumn(tb, col.id, th || b);
          } });
        }
        entries.push({ label: 'Delete column', danger: true, run: () => self.removeColumn(tb, col.id) });
        openMenu(b, entries);
      } else if (d.tmenu) {
        openMenu(b, [
          { label: 'Paste data…', run: () => self.pastePrompt(tb, b) },
          { label: 'Clear the readings', run: () => {
            if (!window.confirm('Clear every reading in "' + tb.name + '"?')) return;
            tb.rows = [];
            for (let i = 0; i < 6; i++) tb.rows.push(tb.cols.map(() => ''));
            self.touch(); self.rerenderItem(tb.id); self.draw();
          } },
          { label: 'Delete table', danger: true, run: () => self.removeItem(tb.id) },
        ]);
      }
    });
  };

  Grapher.prototype.pastePrompt = function (t, anchor) {
    const self = this;
    openPop(anchor, '<form class="flg-fill flg-fill--paste"><label>Paste columns from a spreadsheet'
      + '<textarea rows="6" placeholder="1.0&#9;2.1&#10;2.0&#9;3.9" aria-label="Data to paste"></textarea></label>'
      + '<button type="submit" class="flg-btn">Add to table</button></form>', (el) => {
      const ta = el.querySelector('textarea');
      ta.focus();
      el.querySelector('form').addEventListener('submit', (e) => {
        e.preventDefault();
        // Start after the last row that has anything in it.
        let r0 = 0;
        t.rows.forEach((r, i) => { if (r.some((c) => String(c).trim() !== '')) r0 = i + 1; });
        closePop();
        if (!self.pasteBlock(t, ta.value, r0, 0)) toast('No numbers found in that.', 'warning');
      });
    });
  };

  /* ── Sliders that play ──────────────────────────────────────────────── */

  Grapher.prototype.togglePlay = function (k) {
    if (this._play && this._play.k === k) { this.stopPlay(); this.renderParams(); return; }
    this.stopPlay();
    const p = this.doc.params[k];
    if (!p) return;
    this._play = { k: k, dir: 1 };
    const self = this;
    let last = performance.now();
    const step = (now) => {
      if (!self._play || self._play.k !== k || !self.doc.params[k]) return;
      const dt = Math.min(64, now - last);
      last = now;
      const q = self.doc.params[k];
      let v = q.v + self._play.dir * (q.max - q.min) * dt / 4000;
      if (v > q.max) { v = q.max; self._play.dir = -1; }
      if (v < q.min) { v = q.min; self._play.dir = 1; }
      q.v = v;
      self.scope[k] = v;
      const range = self.root.querySelector('[data-prange="' + k + '"]');
      const val = self.root.querySelector('[data-pval="' + k + '"]');
      if (range) range.value = v;
      if (val && val !== document.activeElement) val.value = fmtCoord(Math.round(v / q.step) * q.step, 1).replace('−', '-');
      self._drawNow();
      self._play.raf = requestAnimationFrame(step);
    };
    this._play.raf = requestAnimationFrame(step);
    this.renderParams();
  };
  Grapher.prototype.stopPlay = function () {
    if (this._play && this._play.raf) cancelAnimationFrame(this._play.raf);
    this._play = null;
  };

  /* ── The view ───────────────────────────────────────────────────────── */

  Grapher.prototype.autoView = function () {
    let xLo = Infinity, xHi = -Infinity, yLo = Infinity, yHi = -Infinity;
    this.doc.items.forEach((it) => {
      if (it.type !== 'table' || it.hidden) return;
      tablePoints(it).forEach((p) => {
        xLo = Math.min(xLo, p.x - p.dx); xHi = Math.max(xHi, p.x + p.dx);
        yLo = Math.min(yLo, p.y - p.dy); yHi = Math.max(yHi, p.y + p.dy);
      });
    });
    if (!Number.isFinite(xLo)) return { xLo: 0, xHi: 10, yLo: 0, yHi: 10 };
    /* Keep the origin in frame when the data is not far from it — the
       intercept is usually the question — but not when it would squash
       readings of 100…110 into a sliver at the top. */
    if (xLo > 0 && xLo < 0.35 * xHi) xLo = 0;
    if (xHi < 0 && xHi > 0.35 * xLo) xHi = 0;
    if (yLo > 0 && yLo < 0.35 * yHi) yLo = 0;
    if (yHi < 0 && yHi > 0.35 * yLo) yHi = 0;
    if (xLo === xHi) { xLo -= 1; xHi += 1; }
    if (yLo === yHi) { yLo -= 1; yHi += 1; }
    const px = (xHi - xLo) * 0.07, py = (yHi - yLo) * 0.09;
    return {
      xLo: xLo === 0 ? 0 : xLo - px, xHi: xHi === 0 ? 0 : xHi + px,
      yLo: yLo === 0 ? 0 : yLo - py, yHi: yHi === 0 ? 0 : yHi + py,
    };
  };

  Grapher.prototype.axisTitles = function () {
    const d = this.doc;
    let xn = d.xLabel, xu = d.xUnit, yn = d.yLabel, yu = d.yUnit;
    if (d.kind === 'data' && (!xn || !yn)) {
      // Unnamed axes take their names from the columns being plotted.
      const t = d.items.find((i) => i.type === 'table' && !i.hidden);
      if (t) {
        const cx = t.cols.find((c) => c.id === t.xCol), cy = t.cols.find((c) => c.id === t.yCol);
        if (!xn && cx) { xn = cx.name; if (!xu) xu = cx.unit; }
        if (!yn && cy) { yn = cy.name; if (!yu) yu = cy.unit; }
      }
    }
    return { x: axisTitle(xn, xu), y: axisTitle(yn, yu) };
  };

  Grapher.prototype.frame = function (W, H) {
    if (this.kind === 'functions') return { L: 0, T: 0, R: W, B: H, pw: W, ph: H, box: false };
    const at = this.axisTitles();
    /* The left margin follows the widest y label, so "−0.00125" is never
       clipped and "5" does not waste 60px of plot. */
    const pre = this.viewFor({ L: 0, T: 0, pw: Math.max(1, W - 80), ph: Math.max(1, H - 80) });
    const step = pre.yHi > pre.yLo ? niceStep(pre.yHi - pre.yLo, Math.max(2, (H - 80) / 64)) : 1;
    const widest = tickValues(pre.yLo, pre.yHi, step).reduce((m, t) => Math.max(m, fmtTick(t, step).length), 1);
    const L = Math.round(widest * 7.2 + 18 + (at.y ? 22 : 0));
    const T = this.doc.title ? 44 : 16;
    const B = 30 + (at.x ? 26 : 0);
    const R = 18;
    return { L: L, T: T, R: W - R, B: H - B, pw: Math.max(10, W - R - L), ph: Math.max(10, H - B - T), box: true };
  };

  Grapher.prototype.viewFor = function (fr) {
    const w = this.doc.win;
    let v = (this.kind === 'data' && w.auto) ? this.autoView()
      : { xLo: w.xMin, xHi: w.xMax, yLo: w.yMin, yHi: w.yMax };
    if (w.square && fr.pw > 0 && fr.ph > 0) {
      const cy = (v.yLo + v.yHi) / 2, half = (v.xHi - v.xLo) * fr.ph / fr.pw / 2;
      v = { xLo: v.xLo, xHi: v.xHi, yLo: cy - half, yHi: cy + half };
    }
    return v;
  };

  Grapher.prototype.setView = function (v) {
    const sx = v.xHi - v.xLo, sy = v.yHi - v.yLo;
    // Past these the arithmetic, not the graph, is what you would be looking at.
    if (!(sx > 1e-10 && sx < 1e12 && sy > 1e-10 && sy < 1e12)) return;
    const w = this.doc.win;
    w.auto = false;
    w.xMin = v.xLo; w.xMax = v.xHi; w.yMin = v.yLo; w.yMax = v.yHi;
    this.viewChanged();
  };

  Grapher.prototype.viewChanged = function () {
    if (this.surface === 'planner') {
      clearTimeout(this._saveT);
      this._saveT = setTimeout(() => this.persistLocal(), 500);
    }
    this.draw();
    this.syncWindowForm();
  };

  Grapher.prototype.zoomAt = function (px, py, f) {
    const L = this._last;
    if (!L) return;
    const v = L.v, m = L.m;
    const x = m.ix(px), y = m.iy(py);
    this.setView({
      xLo: x - (x - v.xLo) * f, xHi: x + (v.xHi - x) * f,
      yLo: y - (y - v.yLo) * f, yHi: y + (v.yHi - y) * f,
    });
  };

  Grapher.prototype.panBy = function (dx, dy) {
    const L = this._last;
    if (!L) return;
    const v = L.v, m = L.m;
    this.setView({ xLo: v.xLo - dx / m.kx, xHi: v.xHi - dx / m.kx, yLo: v.yLo + dy / m.ky, yHi: v.yHi + dy / m.ky });
  };

  Grapher.prototype.resetView = function () {
    const w = this.doc.win;
    if (this.kind === 'data') w.auto = true;
    else { w.xMin = -10; w.xMax = 10; w.yMin = -7; w.yMax = 7; w.square = true; }
    this.viewChanged();
  };

  Grapher.prototype.tool = function (name, btn) {
    const L = this._last;
    if (name === 'rail') {
      this.railHidden = !this.railHidden;
      this.root.classList.toggle('is-railless', this.railHidden);
      this.draw();
      return;
    }
    if (name === 'home') { this.resetView(); return; }
    if (name === 'win') { this.windowPop(btn); return; }
    if (!L) return;
    const cx = L.fr.L + L.fr.pw / 2, cy = L.fr.T + L.fr.ph / 2;
    this.zoomAt(cx, cy, name === 'in' ? 0.7 : 1 / 0.7);
  };

  /* ── Window, title and axes ─────────────────────────────────────────── */

  Grapher.prototype.windowPop = function (anchor) {
    const self = this, d = this.doc, data = this.kind === 'data';
    const v = this._last ? this._last.v : this.viewFor({ pw: 1, ph: 1 });
    const span = Math.max(v.xHi - v.xLo, v.yHi - v.yLo);
    const r = (n) => fmtCoord(n, span).replace('−', '-');
    const at = this.axisTitles();
    const row = (ax) => '<div class="flg-wrow"><span class="flg-wax">' + ax + '</span>'
      + '<input type="text" inputmode="decimal" data-wn="' + ax + 'Min" value="' + r(ax === 'x' ? v.xLo : v.yLo) + '" aria-label="' + ax + ' minimum">'
      + '<span class="flg-wto">to</span>'
      + '<input type="text" inputmode="decimal" data-wn="' + ax + 'Max" value="' + r(ax === 'x' ? v.xHi : v.yHi) + '" aria-label="' + ax + ' maximum">'
      + '</div>'
      + '<div class="flg-wrow flg-wrow--lab"><span class="flg-wax"></span>'
      + '<input type="text" data-wd="' + ax + 'Label" value="' + esc(d[ax + 'Label']) + '" placeholder="'
      + esc(((ax === 'x' ? at.x : at.y) || '').split(' / ')[0] || ax + ' axis name') + '" aria-label="' + ax + ' axis name">'
      + '<input type="text" class="flg-wunit" data-wd="' + ax + 'Unit" value="' + esc(d[ax + 'Unit']) + '" placeholder="unit" aria-label="' + ax + ' axis unit">'
      + '</div>';
    const html = '<div class="flg-win">'
      + '<input type="text" class="flg-wtitle" data-wd="title" value="' + esc(d.title) + '" placeholder="' + (data ? 'Graph title' : 'Title (optional)') + '" aria-label="Graph title">'
      + row('x') + row('y')
      + '<div class="flg-wflags">'
      + (data ? '<label><input type="checkbox" data-wf="auto"' + (d.win.auto ? ' checked' : '') + '> Fit to data</label>' : '')
      + '<label><input type="checkbox" data-wf="square"' + (d.win.square ? ' checked' : '') + '> Square grid</label>'
      + '<label><input type="checkbox" data-wf="grid"' + (d.win.grid ? ' checked' : '') + '> Gridlines</label>'
      + '</div></div>';
    openPop(anchor, html, (el) => {
      self._winEl = el;
      el.addEventListener('input', (e) => {
        const t = e.target, ds = t.dataset;
        if (ds.wd) {
          d[ds.wd] = t.value.slice(0, 120);
          self.touch();
          self.draw();
          return;
        }
        if (ds.wn) {
          const ax = ds.wn[0];
          const lo = num(el.querySelector('[data-wn="' + ax + 'Min"]').value);
          const hi = num(el.querySelector('[data-wn="' + ax + 'Max"]').value);
          // Ignore a half-typed range rather than collapsing the axis to nothing.
          if (!Number.isFinite(lo) || !Number.isFinite(hi) || !(hi > lo)) return;
          const cur = self._last ? self._last.v : v;
          const next = { xLo: cur.xLo, xHi: cur.xHi, yLo: cur.yLo, yHi: cur.yHi };
          if (ax === 'x') { next.xLo = lo; next.xHi = hi; } else { next.yLo = lo; next.yHi = hi; }
          // Typing a y range is asking for exactly that range.
          if (ax === 'y' && d.win.square) {
            d.win.square = false;
            const sq = el.querySelector('[data-wf="square"]');
            if (sq) sq.checked = false;
          }
          const auto = el.querySelector('[data-wf="auto"]');
          if (auto) auto.checked = false;
          self._winTyping = true;
          self.setView(next);
          self._winTyping = false;
        }
      });
      el.addEventListener('change', (e) => {
        const f = e.target.dataset.wf;
        if (!f) return;
        d.win[f] = e.target.checked;
        self.touch();
        self.viewChanged();
      });
    }, () => { self._winEl = null; });
  };

  /** Keep the typed-in window numbers honest while the graph is dragged. */
  Grapher.prototype.syncWindowForm = function () {
    const el = this._winEl;
    if (!el || this._winTyping || !this._last) return;
    const self = this;
    // After the redraw, so the numbers are the ones now on screen.
    setTimeout(() => {
      if (!self._last || self._winEl !== el) return;
      const v = self._last.v;
      const span = Math.max(v.xHi - v.xLo, v.yHi - v.yLo);
      const set = (k, n) => {
        const inp = el.querySelector('[data-wn="' + k + '"]');
        if (inp && inp !== document.activeElement) inp.value = fmtCoord(n, span).replace('−', '-');
      };
      set('xMin', v.xLo); set('xMax', v.xHi); set('yMin', v.yLo); set('yMax', v.yHi);
      const auto = el.querySelector('[data-wf="auto"]');
      if (auto) auto.checked = !!self.doc.win.auto;
    }, 140);
  };

  /* ── Drawing ────────────────────────────────────────────────────────── */

  Grapher.prototype.draw = function () {
    if (this._raf) return;
    this._raf = requestAnimationFrame(() => { this._raf = 0; clearTimeout(this._drawT); this._drawNow(); });
    // A hidden document never runs rAF; the timer makes sure the plot still appears.
    clearTimeout(this._drawT);
    this._drawT = setTimeout(() => {
      if (this._raf) { cancelAnimationFrame(this._raf); this._raf = 0; this._drawNow(); }
    }, 120);
  };

  Grapher.prototype._drawNow = function () {
    const plot = this.$('Plot');
    if (!plot) return;
    const W = Math.round(plot.clientWidth), H = Math.round(plot.clientHeight);
    if (W < 20 || H < 20) return;
    plot.innerHTML = this.svg(W, H, false);
    this.renderResults();
  };

  /** Sample f across the view as polylines, broken at gaps and poles. */
  function curvePaths(f, m, v, fr, attrs) {
    const N = Math.max(240, Math.min(2400, Math.round(fr.pw * 1.4)));
    const span = v.yHi - v.yLo, lim = span * 6;
    let out = '', run = [], prev = null;
    const flush = () => {
      if (run.length > 1) out += '<polyline points="' + run.join(' ') + '" fill="none" ' + attrs + '/>';
      run = [];
    };
    for (let i = 0; i <= N; i++) {
      const x = v.xLo + (v.xHi - v.xLo) * i / N;
      const y = f(x);
      if (!Number.isFinite(y)) { flush(); prev = null; continue; }
      /* tan x and 1/x jump from far above to far below between two samples.
         Joining them draws a vertical streak that is not part of the curve. */
      if (prev !== null && Math.abs(y - prev) > span
        && ((y > v.yHi && prev < v.yLo) || (y < v.yLo && prev > v.yHi) || Math.abs(y - prev) > span * 4)) flush();
      prev = y;
      run.push(m.sx(x).toFixed(1) + ',' + m.sy(clamp(y, v.yLo - lim, v.yHi + lim)).toFixed(1));
    }
    flush();
    return out;
  }

  Grapher.prototype.fitFor = function (t, pts) {
    const F = window.FluxLabFit;
    if (!F || t.fit === 'none' || pts.length < 2) return null;
    return F.fit(t.fit, pts);
  };

  Grapher.prototype.keyPointsFor = function (v) {
    const it = this.active ? this.item(this.active) : null;
    if (!it || it.type !== 'expr' || it.hidden) return [];
    const p = this.parsed(it);
    if (!p || p.kind !== 'fn') return [];
    const span = v.yHi - v.yLo;
    const key = it.id + '|' + it.src + '|' + v.xLo + '|' + v.xHi + '|' + v.yLo + '|' + v.yHi + '|'
      + JSON.stringify(this.scope) + '|' + this.doc.items.map((i) => (i.type === 'expr' && !i.hidden ? i.src : '')).join('¦');
    if (this._kpKey === key) return this._kp;
    let pts = keyPoints(p.fn, v.xLo, v.xHi, span);
    this.doc.items.forEach((o) => {
      if (o === it || o.hidden || o.type !== 'expr') return;
      const q = this.parsed(o);
      if (q && q.kind === 'fn') {
        intersections(p.fn, q.fn, v.xLo, v.xHi, span).forEach((c) => pts.push({ x: c.x, y: c.y, types: ['cross'] }));
      }
    });
    pts = pts.filter((q) => q.y >= v.yLo && q.y <= v.yHi).slice(0, 160);
    this._kpKey = key;
    this._kp = pts;
    return pts;
  };

  function kpLabel(p, span) {
    return '(' + fmtCoord(p.x, span) + ', ' + fmtCoord(p.y, span) + ')';
  }
  function kpKind(p) {
    return (p.types || []).map((t) => KP_NAMES[t] || t).join(' · ');
  }

  Grapher.prototype.svg = function (W, H, print) {
    const d = this.doc;
    const fr = this.frame(W, H);
    const v = this.viewFor(fr);
    const m = mapper(v, fr);
    if (!print) this._last = { fr: fr, v: v, m: m, W: W, H: H };
    const c = (n) => cls(n, print);
    const clip = this.uid + (print ? 'P' : 'C');
    const at = this.axisTitles();
    const P = [];
    const spanY = v.yHi - v.yLo;

    P.push('<svg xmlns="http://www.w3.org/2000/svg" class="flg-svg" viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H
      + '" role="img" aria-label="' + esc(this.ariaLabel()) + '">');
    if (print) P.push('<rect x="0" y="0" width="' + W + '" height="' + H + '" ' + c('flg-bgall') + '/>');
    P.push('<defs><clipPath id="' + clip + '"><rect x="' + fr.L + '" y="' + fr.T + '" width="' + fr.pw + '" height="' + fr.ph + '"/></clipPath></defs>');
    P.push('<rect x="' + fr.L + '" y="' + fr.T + '" width="' + fr.pw + '" height="' + fr.ph + '" ' + c('flg-plotbg') + '/>');

    const xStep = niceStep(v.xHi - v.xLo, Math.max(2, fr.pw / (print ? 110 : 96)));
    const yStep = d.win.square ? xStep : niceStep(spanY, Math.max(2, fr.ph / (print ? 80 : 64)));
    const xs = tickValues(v.xLo, v.xHi, xStep), ys = tickValues(v.yLo, v.yHi, yStep);

    if (d.win.grid) {
      if (!fr.box) {
        // Minor lines between the labelled ones, only while they are far enough apart to read.
        const sub = (s) => (Math.round(s / Math.pow(10, Math.floor(Math.log10(s)))) === 2 ? 4 : 5);
        const mx = xStep / sub(xStep), my = yStep / sub(yStep);
        if (mx * m.kx >= 9) tickValues(v.xLo, v.xHi, mx).forEach((t) => {
          const X = m.sx(t).toFixed(1);
          P.push('<line x1="' + X + '" y1="' + fr.T + '" x2="' + X + '" y2="' + fr.B + '" ' + c('flg-gmin') + '/>');
        });
        if (my * m.ky >= 9) tickValues(v.yLo, v.yHi, my).forEach((t) => {
          const Y = m.sy(t).toFixed(1);
          P.push('<line x1="' + fr.L + '" y1="' + Y + '" x2="' + fr.R + '" y2="' + Y + '" ' + c('flg-gmin') + '/>');
        });
      }
      xs.forEach((t) => {
        const X = m.sx(t).toFixed(1);
        P.push('<line x1="' + X + '" y1="' + fr.T + '" x2="' + X + '" y2="' + fr.B + '" ' + c('flg-gmaj') + '/>');
      });
      ys.forEach((t) => {
        const Y = m.sy(t).toFixed(1);
        P.push('<line x1="' + fr.L + '" y1="' + Y + '" x2="' + fr.R + '" y2="' + Y + '" ' + c('flg-gmaj') + '/>');
      });
    }

    if (fr.box) {
      if (v.yLo < 0 && v.yHi > 0) P.push('<line x1="' + fr.L + '" y1="' + m.sy(0) + '" x2="' + fr.R + '" y2="' + m.sy(0) + '" ' + c('flg-zero') + '/>');
      if (v.xLo < 0 && v.xHi > 0) P.push('<line x1="' + m.sx(0) + '" y1="' + fr.T + '" x2="' + m.sx(0) + '" y2="' + fr.B + '" ' + c('flg-zero') + '/>');
      P.push('<rect x="' + fr.L + '" y="' + fr.T + '" width="' + fr.pw + '" height="' + fr.ph + '" ' + c('flg-frame') + '/>');
      xs.forEach((t) => {
        const X = m.sx(t);
        P.push('<line x1="' + X + '" y1="' + fr.B + '" x2="' + X + '" y2="' + (fr.B + 5) + '" ' + c('flg-axis') + '/>');
        P.push('<text x="' + X + '" y="' + (fr.B + 19) + '" text-anchor="middle" ' + c('flg-tick') + '>' + fmtTick(t, xStep) + '</text>');
      });
      ys.forEach((t) => {
        const Y = m.sy(t);
        P.push('<line x1="' + (fr.L - 5) + '" y1="' + Y + '" x2="' + fr.L + '" y2="' + Y + '" ' + c('flg-axis') + '/>');
        P.push('<text x="' + (fr.L - 9) + '" y="' + (Y + 4) + '" text-anchor="end" ' + c('flg-tick') + '>' + fmtTick(t, yStep) + '</text>');
      });
    } else {
      /* Desmos-style: the axes run through the origin and the numbers ride
         along them, sliding to the edge when the origin is off screen. */
      const X0 = m.sx(0), Y0 = m.sy(0);
      if (v.yLo <= 0 && v.yHi >= 0) P.push('<line x1="' + fr.L + '" y1="' + Y0 + '" x2="' + fr.R + '" y2="' + Y0 + '" ' + c('flg-axis') + '/>');
      if (v.xLo <= 0 && v.xHi >= 0) P.push('<line x1="' + X0 + '" y1="' + fr.T + '" x2="' + X0 + '" y2="' + fr.B + '" ' + c('flg-axis') + '/>');
      const ly = clamp(Y0 + 17, fr.T + 16, fr.B - 7);
      xs.forEach((t) => {
        if (Math.abs(t) < xStep * 1e-6) return;
        const X = m.sx(t);
        if (X < fr.L + 14 || X > fr.R - 14) return;
        P.push('<text x="' + X.toFixed(1) + '" y="' + ly.toFixed(1) + '" text-anchor="middle" ' + c('flg-tick flg-halo') + '>' + fmtTick(t, xStep) + '</text>');
      });
      const right = X0 - 8 < fr.L + 34;
      const lx = right ? Math.max(X0 + 7, fr.L + 6) : Math.min(X0 - 7, fr.R - 6);
      ys.forEach((t) => {
        if (Math.abs(t) < yStep * 1e-6) return;
        const Y = m.sy(t);
        if (Y < fr.T + 12 || Y > fr.B - 10) return;
        P.push('<text x="' + lx.toFixed(1) + '" y="' + (Y + 4).toFixed(1) + '" text-anchor="' + (right ? 'start' : 'end') + '" '
          + c('flg-tick flg-halo') + '>' + fmtTick(t, yStep) + '</text>');
      });
      if (v.xLo < 0 && v.xHi > 0 && v.yLo < 0 && v.yHi > 0) {
        P.push('<text x="' + (X0 - 7) + '" y="' + (Y0 + 17) + '" text-anchor="end" ' + c('flg-tick flg-halo') + '>0</text>');
      }
      if (at.x) P.push('<text x="' + (fr.R - 10) + '" y="' + clamp(Y0 - 10, fr.T + 18, fr.B - 26) + '" text-anchor="end" ' + c('flg-axlabel flg-halo') + '>' + esc(at.x) + '</text>');
      if (at.y) P.push('<text x="' + clamp(X0 + 10, fr.L + 10, fr.R - 60) + '" y="' + (fr.T + (d.title ? 52 : 22)) + '" text-anchor="start" ' + c('flg-axlabel flg-halo') + '>' + esc(at.y) + '</text>');
    }

    P.push('<g clip-path="url(#' + clip + ')">');
    d.items.forEach((it) => {
      if (it.hidden) return;
      P.push(it.type === 'table' ? this.drawTable(it, m, v, fr) : this.drawExpr(it, m, v, fr));
    });
    if (!print) {
      this.keyPointsFor(v).forEach((p) => {
        P.push('<circle cx="' + m.sx(p.x).toFixed(1) + '" cy="' + m.sy(p.y).toFixed(1) + '" r="4.5" class="flg-kp"/>');
      });
    }
    this.pins.forEach((p) => {
      const X = m.sx(p.x), Y = m.sy(p.y);
      if (X < fr.L || X > fr.R || Y < fr.T || Y > fr.B) return;
      const text = kpLabel(p, spanY);
      const w = text.length * 6.9 + 14;
      const bx = clamp(X + 8, fr.L + 2, fr.R - w - 2), by = clamp(Y - 30, fr.T + 2, fr.B - 24);
      P.push('<circle cx="' + X.toFixed(1) + '" cy="' + Y.toFixed(1) + '" r="4.5" fill="' + (p.colour || '#64748b') + '" stroke="#fff" stroke-width="1.5"/>');
      P.push('<rect x="' + bx.toFixed(1) + '" y="' + by.toFixed(1) + '" width="' + w.toFixed(1) + '" height="22" rx="6" ' + c('flg-pinbox') + '/>');
      P.push('<text x="' + (bx + 7).toFixed(1) + '" y="' + (by + 15).toFixed(1) + '" ' + c('flg-pint') + '>' + esc(text) + '</text>');
    });
    P.push('</g>');

    if (fr.box) {
      if (at.x) P.push('<text x="' + (fr.L + fr.pw / 2) + '" y="' + (H - 10) + '" text-anchor="middle" ' + c('flg-axlabel') + '>' + esc(at.x) + '</text>');
      if (at.y) {
        const yy = fr.T + fr.ph / 2;
        P.push('<text x="16" y="' + yy + '" text-anchor="middle" transform="rotate(-90 16 ' + yy + ')" ' + c('flg-axlabel') + '>' + esc(at.y) + '</text>');
      }
    }
    if (d.title) {
      P.push('<text x="' + (fr.box ? fr.L + fr.pw / 2 : W / 2) + '" y="' + (fr.box ? 28 : 30) + '" text-anchor="middle" '
        + c(fr.box ? 'flg-title' : 'flg-title') + (fr.box ? '' : ' paint-order="stroke"') + '>' + esc(d.title) + '</text>');
    }
    if (print) P.push(this.legendSVG(fr));
    P.push('</svg>');
    return P.join('');
  };

  Grapher.prototype.drawExpr = function (it, m, v, fr) {
    const p = this.parsed(it);
    if (!p || p.error || p.kind === 'empty') return '';
    const on = this.active === it.id;
    const attrs = 'stroke="' + it.colour + '" stroke-width="' + (on ? 3.1 : 2.5) + '" stroke-linejoin="round" stroke-linecap="round"'
      + (it.dash ? ' stroke-dasharray="8 6"' : '');
    if (p.kind === 'vline') {
      const x = p.fx(0);
      if (!Number.isFinite(x)) return '';
      const X = m.sx(x).toFixed(1);
      return '<line x1="' + X + '" y1="' + fr.T + '" x2="' + X + '" y2="' + fr.B + '" ' + attrs + '/>';
    }
    if (p.kind === 'points') {
      return p.pts.map((q) => {
        const x = q.fx(0), y = q.fy(0);
        if (!Number.isFinite(x) || !Number.isFinite(y)) return '';
        return '<circle cx="' + m.sx(x).toFixed(1) + '" cy="' + m.sy(y).toFixed(1) + '" r="5" fill="' + it.colour + '" stroke="rgba(0,0,0,.35)" stroke-width="1"/>';
      }).join('');
    }
    return curvePaths(p.fn, m, v, fr, attrs);
  };

  Grapher.prototype.drawTable = function (t, m, v, fr) {
    const pts = tablePoints(t);
    let s = '';
    const res = this.fitFor(t, pts);
    if (res && res.fit && typeof res.fit.predict === 'function') {
      s += curvePaths(res.fit.predict, m, v, fr, 'stroke="' + t.colour + '" stroke-width="2.2" stroke-opacity=".92" stroke-linecap="round"');
    }
    if (this.kind === 'data' && t.minmax && window.FluxLabFit) {
      const mm = window.FluxLabFit.minMaxGradient(pts);
      if (mm) {
        const xLo = Math.min.apply(null, pts.map((p) => p.x - p.dx));
        const xHi = Math.max.apply(null, pts.map((p) => p.x + p.dx));
        [[mm.steep, STEEP], [mm.shallow, SHALLOW]].forEach((pair) => {
          const Ln = pair[0];
          const g = (Ln.y2 - Ln.y1) / (Ln.x2 - Ln.x1);
          const ya = Ln.y1 + g * (xLo - Ln.x1), yb = Ln.y1 + g * (xHi - Ln.x1);
          s += '<line x1="' + m.sx(xLo) + '" y1="' + m.sy(ya) + '" x2="' + m.sx(xHi) + '" y2="' + m.sy(yb)
            + '" stroke="' + pair[1] + '" stroke-width="1.6" stroke-dasharray="7 5"/>';
        });
      }
    }
    pts.forEach((p) => {
      const X = m.sx(p.x), Y = m.sy(p.y);
      const bar = 'stroke="' + t.colour + '" stroke-opacity=".8" stroke-width="1.4" fill="none"';
      if (p.dy > 0) {
        const y1 = m.sy(p.y - p.dy), y2 = m.sy(p.y + p.dy);
        s += '<path class="flg-ebar" d="M' + X + ' ' + y1 + 'V' + y2 + 'M' + (X - 4) + ' ' + y1 + 'h8M' + (X - 4) + ' ' + y2 + 'h8" ' + bar + '/>';
      }
      if (p.dx > 0) {
        const x1 = m.sx(p.x - p.dx), x2 = m.sx(p.x + p.dx);
        s += '<path class="flg-ebar" d="M' + x1 + ' ' + Y + 'H' + x2 + 'M' + x1 + ' ' + (Y - 4) + 'v8M' + x2 + ' ' + (Y - 4) + 'v8" ' + bar + '/>';
      }
      s += '<circle class="flg-pt" cx="' + X.toFixed(1) + '" cy="' + Y.toFixed(1) + '" r="4.2" fill="' + t.colour + '" stroke="rgba(0,0,0,.35)" stroke-width="1"/>';
    });
    return s;
  };

  /** The key for an exported image — a PNG has no rail beside it. */
  Grapher.prototype.legendSVG = function (fr) {
    const lines = [];
    this.doc.items.forEach((it) => {
      if (it.hidden) return;
      if (it.type === 'expr') {
        const p = this.parsed(it);
        if (!p || p.error || p.kind === 'empty') return;
        const t = it.src.trim();
        lines.push({ colour: it.colour, text: /^[xy]\s*=|^\(/i.test(t) ? t : 'y = ' + t, dash: it.dash });
      } else {
        const pts = tablePoints(it);
        if (!pts.length) return;
        const res = this.fitFor(it, pts);
        let text = it.name;
        if (res && res.fit) {
          text += ':  ' + res.fit.equation(fmt);
          if (res.fit.um != null && res.fit.m != null) text += '   (m = ' + fmtWithU(res.fit.m, res.fit.um) + ')';
        }
        lines.push({ colour: it.colour, text: text, dot: true });
      }
    });
    // A slider's value is part of the equation — without it "a sin(x)" is not reproducible.
    const ps = Object.keys(this.doc.params).sort();
    if (ps.length) lines.push({ text: ps.map((k) => k + ' = ' + fmtCoord(this.doc.params[k].v, 1)).join(',   '), bare: true });
    if (!lines.length) return '';
    const w = Math.min(fr.pw - 20, Math.max.apply(null, lines.map((l) => l.text.length)) * 7.4 + 44);
    const h = lines.length * 22 + 12;
    const x = fr.L + 12, y = fr.T + 12;
    let s = '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="6" ' + cls('flg-leg', true) + '/>';
    lines.forEach((l, i) => {
      const cy = y + 18 + i * 22;
      if (l.bare) s += '';
      else if (l.dot) s += '<circle cx="' + (x + 18) + '" cy="' + (cy - 4) + '" r="4.5" fill="' + l.colour + '"/>';
      else s += '<line x1="' + (x + 8) + '" y1="' + (cy - 4) + '" x2="' + (x + 28) + '" y2="' + (cy - 4) + '" stroke="' + l.colour + '" stroke-width="2.5"' + (l.dash ? ' stroke-dasharray="5 3"' : '') + '/>';
      s += '<text x="' + (x + 36) + '" y="' + cy + '" ' + cls('flg-legt', true) + '>' + esc(l.text) + '</text>';
    });
    return s;
  };

  Grapher.prototype.ariaLabel = function () {
    const at = this.axisTitles();
    if (this.kind === 'functions') {
      const n = this.doc.items.filter((i) => i.type === 'expr' && i.src.trim()).length;
      return (this.doc.title ? this.doc.title + ': ' : '') + n + ' equation' + (n === 1 ? '' : 's');
    }
    return (this.doc.title || 'Graph') + ': ' + (at.y || 'y') + ' against ' + (at.x || 'x');
  };

  /* ── Results card (the numbers that go in the write-up) ─────────────── */

  Grapher.prototype.resultsHTML = function () {
    const cards = [];
    this.doc.items.forEach((t) => {
      if (t.type !== 'table' || t.hidden || t.fit === 'none') return;
      const pts = tablePoints(t);
      if (pts.length < 2) return;
      const res = this.fitFor(t, pts);
      if (!res) return;
      const head = '<div class="flg-rc-h"><i style="background:' + t.colour + '"></i><span>' + esc(t.name) + '</span></div>';
      if (res.error) { cards.push('<div class="flg-rc">' + head + '<div class="flg-rc-err">' + esc(res.error) + '</div></div>'); return; }
      const f = res.fit;
      const rows = [];
      if (f.kind === 'linear' || f.kind === 'proportional') {
        rows.push(['m', f.um != null ? fmtWithU(f.m, f.um) : fmt(f.m)]);
        if (f.kind === 'linear') rows.push(['c', f.uc != null ? fmtWithU(f.c, f.uc) : fmt(f.c)]);
      } else if (f.kind === 'quadratic') {
        rows.push(['a', fmt(f.a)], ['b', fmt(f.b)], ['c', fmt(f.c)]);
      } else {
        rows.push(['a', fmt(f.a)], ['b', fmt(f.b)]);
      }
      rows.push(['R²', fmt(f.r2)]);
      if (t.minmax && window.FluxLabFit) {
        const mm = window.FluxLabFit.minMaxGradient(pts);
        if (mm) {
          rows.push(['m max', fmt(mm.mMax)], ['m min', fmt(mm.mMin)]);
          rows.push(['m (bars)', fmtWithU((mm.mMax + mm.mMin) / 2, mm.uncertainty)]);
        } else rows.push(['max/min', 'needs x bars that do not overlap']);
      }
      cards.push('<div class="flg-rc">' + head
        + '<div class="flg-rc-eq">' + esc(f.equation(fmt)) + '</div>'
        + '<table>' + rows.map((r) => '<tr><th>' + esc(r[0]) + '</th><td>' + esc(r[1]) + '</td></tr>').join('') + '</table>'
        + '</div>');
    });
    if (!cards.length) return '';
    return '<div class="flg-rc-bar"><button type="button" class="flg-rc-btn" data-rescopy title="Copy the numbers" aria-label="Copy the numbers">' + ICON.copy + '</button>'
      + '<button type="button" class="flg-rc-btn" data-restoggle title="' + (this.resCollapsed ? 'Show' : 'Hide') + ' the results" aria-label="Show or hide the results">'
      + (this.resCollapsed ? ICON.plus : ICON.minus) + '</button></div>'
      + (this.resCollapsed ? '' : cards.join(''));
  };

  Grapher.prototype.renderResults = function () {
    const box = this.$('Res');
    if (!box) return;
    const html = this.resultsHTML();
    if (html !== this._resHTML) {
      this._resHTML = html;
      box.innerHTML = html;
      box.hidden = !html;
    }
    const L = this._last;
    if (L && !this.resPos) { box.style.left = (L.fr.L + 12) + 'px'; box.style.top = (L.fr.T + 12) + 'px'; }
  };

  /* ── Pointer interaction on the plot ─────────────────────────────────── */

  Grapher.prototype.attachStage = function () {
    const self = this, stage = this.$('Stage'), plot = this.$('Plot');
    const pts = new Map();
    let moved = 0, downAt = null;

    const pos = (e) => {
      const r = plot.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };

    plot.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      try { plot.setPointerCapture(e.pointerId); } catch (err) {}
      pts.set(e.pointerId, pos(e));
      moved = 0;
      downAt = pos(e);
      stage.classList.add('is-grabbing');
      self.hideTrace();
    });

    plot.addEventListener('pointermove', (e) => {
      const p = pos(e);
      if (!pts.has(e.pointerId)) { self.hover(p); return; }
      const prev = pts.get(e.pointerId);
      if (pts.size === 1) {
        const dx = p.x - prev.x, dy = p.y - prev.y;
        moved += Math.abs(dx) + Math.abs(dy);
        pts.set(e.pointerId, p);
        if (moved > 3) self.panBy(dx, dy);
      } else if (pts.size === 2) {
        const other = Array.from(pts.entries()).find((kv) => kv[0] !== e.pointerId)[1];
        const before = Math.hypot(prev.x - other.x, prev.y - other.y);
        const after = Math.hypot(p.x - other.x, p.y - other.y);
        pts.set(e.pointerId, p);
        moved += 10;
        if (before > 4 && after > 4) {
          self.zoomAt((p.x + other.x) / 2, (p.y + other.y) / 2, before / after);
        }
      }
    });

    const end = (e) => {
      if (!pts.has(e.pointerId)) return;
      pts.delete(e.pointerId);
      if (!pts.size) {
        stage.classList.remove('is-grabbing');
        if (moved <= 3 && downAt && e.type === 'pointerup') self.clickAt(downAt);
        downAt = null;
      }
    };
    plot.addEventListener('pointerup', end);
    plot.addEventListener('pointercancel', end);
    plot.addEventListener('pointerleave', () => { if (!pts.size) self.hideTrace(); });

    plot.addEventListener('wheel', (e) => {
      e.preventDefault();
      const p = pos(e);
      const dy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
      self.zoomAt(p.x, p.y, Math.exp(clamp(dy, -120, 120) * 0.0022));
    }, { passive: false });

    // The results card: dragged by its body, with copy and collapse buttons.
    const res = this.$('Res');
    if (res) {
      res.addEventListener('click', (e) => {
        if (e.target.closest('[data-rescopy]')) self.copyNumbers();
        else if (e.target.closest('[data-restoggle]')) { self.resCollapsed = !self.resCollapsed; self._resHTML = null; self.renderResults(); }
      });
      let drag = null;
      res.addEventListener('pointerdown', (e) => {
        if (e.target.closest('button')) return;
        drag = { x: e.clientX, y: e.clientY, l: res.offsetLeft, t: res.offsetTop };
        try { res.setPointerCapture(e.pointerId); } catch (err) {}
        res.classList.add('is-dragging');
      });
      res.addEventListener('pointermove', (e) => {
        if (!drag) return;
        const l = clamp(drag.l + e.clientX - drag.x, 0, Math.max(0, stage.clientWidth - res.offsetWidth));
        const t = clamp(drag.t + e.clientY - drag.y, 0, Math.max(0, stage.clientHeight - res.offsetHeight));
        res.style.left = l + 'px';
        res.style.top = t + 'px';
        self.resPos = { l: l, t: t };
      });
      const stop = () => { drag = null; res.classList.remove('is-dragging'); };
      res.addEventListener('pointerup', stop);
      res.addEventListener('pointercancel', stop);
    }

    if (typeof ResizeObserver === 'function') {
      this._ro = new ResizeObserver(() => self.draw());
      this._ro.observe(plot);
    } else {
      this._onResize = () => self.draw();
      window.addEventListener('resize', this._onResize);
    }
  };

  /** What is under the pointer: a key point, a curve, or a reading. */
  Grapher.prototype.pick = function (p) {
    const L = this._last;
    if (!L) return null;
    const m = L.m, v = L.v, span = v.yHi - v.yLo;
    const x = m.ix(p.x);
    let best = null;
    const consider = (cand) => { if (!best || cand.d < best.d) best = cand; };

    this.keyPointsFor(v).forEach((k) => {
      const d = Math.hypot(m.sx(k.x) - p.x, m.sy(k.y) - p.y);
      if (d <= 11) consider({ d: d - 6, kind: 'kp', x: k.x, y: k.y, types: k.types, item: this.active });
    });
    this.doc.items.forEach((it) => {
      if (it.hidden) return;
      if (it.type === 'table') {
        const tp = tablePoints(it);
        tp.forEach((q) => {
          const d = Math.hypot(m.sx(q.x) - p.x, m.sy(q.y) - p.y);
          if (d <= 10) consider({ d: d - 3, kind: 'reading', x: q.x, y: q.y, dx: q.dx, dy: q.dy, item: it.id, colour: it.colour });
        });
        const res = this.fitFor(it, tp);
        if (res && res.fit && res.fit.predict) {
          const y = res.fit.predict(x);
          if (Number.isFinite(y)) {
            const d = Math.abs(m.sy(y) - p.y);
            if (d <= 12) consider({ d: d, kind: 'curve', x: x, y: y, item: it.id, colour: it.colour, fn: res.fit.predict });
          }
        }
        return;
      }
      const q = this.parsed(it);
      if (!q || q.error) return;
      if (q.kind === 'fn') {
        const y = q.fn(x);
        if (!Number.isFinite(y)) return;
        const d = Math.abs(m.sy(y) - p.y);
        if (d <= 14) consider({ d: d, kind: 'curve', x: x, y: y, item: it.id, colour: it.colour, fn: q.fn });
      } else if (q.kind === 'points') {
        q.pts.forEach((pp) => {
          const px = pp.fx(0), py = pp.fy(0);
          const d = Math.hypot(m.sx(px) - p.x, m.sy(py) - p.y);
          if (d <= 10) consider({ d: d, kind: 'reading', x: px, y: py, dx: 0, dy: 0, item: it.id, colour: it.colour });
        });
      } else if (q.kind === 'vline') {
        const vx = q.fx(0);
        const d = Math.abs(m.sx(vx) - p.x);
        if (d <= 10) consider({ d: d, kind: 'curve', x: vx, y: m.iy(p.y), item: it.id, colour: it.colour });
      }
    });
    if (best) best.span = span;
    return best;
  };

  Grapher.prototype.hover = function (p) {
    const hit = this.pick(p);
    if (!hit) { this.hideTrace(); return; }
    const L = this._last, trace = this.$('Trace');
    if (!trace || !L) return;
    let text;
    if (hit.kind === 'reading' && (hit.dx || hit.dy)) {
      text = '(' + (hit.dx ? fmtWithU(hit.x, hit.dx) : fmtCoord(hit.x, hit.span)) + ', '
        + (hit.dy ? fmtWithU(hit.y, hit.dy) : fmtCoord(hit.y, hit.span)) + ')';
    } else text = kpLabel(hit, hit.span);
    let kind = hit.kind === 'kp' ? kpKind(hit) : '';
    /* The gradient under the cursor — the tangent Graphical Analysis draws,
       as a number. A rate of change is often the thing a practical is after. */
    if (hit.kind === 'curve' && hit.fn) {
      const h = (L.v.xHi - L.v.xLo) * 1e-6;
      const g = (hit.fn(hit.x + h) - hit.fn(hit.x - h)) / (2 * h);
      if (Number.isFinite(g)) kind = 'slope ' + fmtCoord(g, 1e-3);
    }
    const X = L.m.sx(hit.x), Y = L.m.sy(hit.y);
    trace.hidden = false;
    trace.style.left = X + 'px';
    trace.style.top = Y + 'px';
    trace.style.setProperty('--c', hit.kind === 'kp' ? '#94a3b8' : (hit.colour || '#00c2ff'));
    trace.querySelector('span').innerHTML = esc(text) + (kind ? '<em>' + esc(kind) + '</em>' : '');
    trace.classList.toggle('is-flip', X > L.fr.R - 180);
    trace.classList.toggle('is-below', Y < L.fr.T + 50);
  };
  Grapher.prototype.hideTrace = function () {
    const t = this.$('Trace');
    if (t) t.hidden = true;
  };

  /** A click that did not drag: pin a key point, or pick a curve to inspect. */
  Grapher.prototype.clickAt = function (p) {
    const hit = this.pick(p);
    if (hit && hit.kind === 'kp') {
      const i = this.pins.findIndex((q) => Math.abs(q.x - hit.x) < 1e-12 && Math.abs(q.y - hit.y) < 1e-12);
      if (i >= 0) this.pins.splice(i, 1);
      else {
        const it = this.item(hit.item);
        this.pins.push({ x: hit.x, y: hit.y, item: hit.item, colour: it ? it.colour : null });
      }
      this.draw();
      return;
    }
    if (hit && hit.kind === 'curve') {
      const it = this.item(hit.item);
      if (it && it.type === 'expr') { this.setActive(it.id); return; }
    }
    if (!hit && this.active) this.setActive(null);
  };

  /* ── Output ─────────────────────────────────────────────────────────── */

  Grapher.prototype.exportPNG = function () {
    const W = 1600, H = 1000;
    const svg = this.svg(W, H, true);
    const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }));
    const img = new Image();
    const name = (this.doc.title || (this.kind === 'data' ? 'graph' : 'functions'))
      .replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'graph';
    img.onload = function () {
      const cv = document.createElement('canvas');
      cv.width = W; cv.height = H;
      const ctx = cv.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, W, H);
      ctx.drawImage(img, 0, 0, W, H);
      URL.revokeObjectURL(url);
      cv.toBlob(function (b) {
        if (!b) { toast('Could not turn the graph into an image.', 'error'); return; }
        const a = document.createElement('a');
        a.href = URL.createObjectURL(b);
        a.download = name + '.png';
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(function () { URL.revokeObjectURL(a.href); }, 1500);
      }, 'image/png');
    };
    img.onerror = function () {
      URL.revokeObjectURL(url);
      toast('Could not turn the graph into an image.', 'error');
    };
    img.src = url;
    return svg;
  };

  Grapher.prototype.copyNumbers = function () {
    const lines = [];
    const at = this.axisTitles();
    if (this.doc.title) lines.push(this.doc.title);
    if (at.x || at.y) lines.push((at.y || 'y') + ' against ' + (at.x || 'x'));
    let fits = 0;
    this.doc.items.forEach((t) => {
      if (t.type !== 'table' || t.hidden) return;
      const pts = tablePoints(t);
      const res = this.fitFor(t, pts);
      if (!res || !res.fit) return;
      fits++;
      const f = res.fit;
      lines.push('', t.name + ' — ' + f.equation(fmt));
      if (f.m != null) lines.push('Gradient: ' + (f.um != null ? fmtWithU(f.m, f.um) : fmt(f.m)));
      if (f.kind === 'linear') lines.push('Intercept: ' + (f.uc != null ? fmtWithU(f.c, f.uc) : fmt(f.c)));
      lines.push('R²: ' + fmt(f.r2));
      if (t.minmax && window.FluxLabFit) {
        const mm = window.FluxLabFit.minMaxGradient(pts);
        if (mm) lines.push('Gradient from the error bars: ' + fmtWithU((mm.mMax + mm.mMin) / 2, mm.uncertainty));
      }
    });
    if (!fits) { toast('Add readings and a fit first.', 'warning'); return; }
    const text = lines.join('\n').trim();
    const ok = () => toast('Copied — paste it into your report.', 'success');
    const bad = () => toast('Could not reach the clipboard.', 'error');
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(ok, bad);
      else bad();
    } catch (e) { bad(); }
  };

  /* ── Saving and loading (flux-grapher-cloud.js calls these) ─────────── */

  Grapher.prototype.suggestedTitle = function () {
    if (this.doc.title.trim()) return this.doc.title.trim().slice(0, 120);
    if (this.kind === 'functions') {
      const first = this.doc.items.find((i) => i.type === 'expr' && i.src.trim());
      return first ? ('y = ' + first.src.trim().replace(/^y\s*=\s*/i, '')).slice(0, 120) : 'Untitled graph';
    }
    const at = this.axisTitles();
    if (at.x && at.y && at.x !== 'x' && at.y !== 'y') return (at.y + ' against ' + at.x).slice(0, 120);
    const t = this.doc.items.find((i) => i.type === 'table');
    return t ? t.name : 'Untitled graph';
  };

  Grapher.prototype.getDoc = function () {
    return { kind: this.kind, title: this.suggestedTitle(), payload: JSON.parse(JSON.stringify(this.doc)) };
  };

  Grapher.prototype.loadDoc = function (payload, cloud) {
    this.stopPlay();
    closePop();
    this.doc = normaliseDoc(payload, this.kind);
    this.cache.clear();
    this.pins = [];
    this.cloud = cloud && cloud.id ? { id: cloud.id, title: str(cloud.title, 120) } : null;
    this.syncScope();
    this.syncParams();
    const first = this.doc.items.find((i) => i.type === 'expr' && !i.hidden);
    this.active = this.kind === 'functions' && first ? first.id : null;
    this.renderItems();
    this.renderParams();
    this._resHTML = null;
    this._kpKey = null;
    this.dirty = false;
    clearTimeout(this._histT);
    this.undoStack = [];
    this.redoStack = [];
    this._snap = JSON.stringify(this.doc);
    this.paintHistory();
    this.persistLocal();
    this.draw();
  };

  Grapher.prototype.markSaved = function (cloud) {
    if (cloud && cloud.id) this.cloud = { id: cloud.id, title: str(cloud.title, 120) };
    this.dirty = false;
    this.persistLocal();
    this.emit('saved');
  };

  Grapher.prototype.isDirty = function () { return this.dirty; };

  Grapher.prototype.snapshot = function () {
    return { doc: JSON.parse(JSON.stringify(this.doc)), cloud: this.cloud, dirty: this.dirty };
  };
  Grapher.prototype.restore = function (s) {
    if (!s) return;
    this.loadDoc(s.doc, s.cloud);
    this.dirty = !!s.dirty;
  };

  Grapher.prototype.destroy = function () {
    this.stopPlay();
    closePop();
    clearTimeout(this._saveT);
    clearTimeout(this._histT);
    if (this._onKey) document.removeEventListener('keydown', this._onKey);
    if (this.surface === 'planner') this.persistLocal();
    if (this._ro) this._ro.disconnect();
    if (this._onResize) window.removeEventListener('resize', this._onResize);
    if (this._raf) cancelAnimationFrame(this._raf);
    clearTimeout(this._drawT);
    this.host.innerHTML = '';
  };

  function create(host, opts) {
    if (!host) return null;
    return new Grapher(host, opts || {});
  }

  /* ══ The planner's Study tools surface ════════════════════════════════
     Both halves behind a switch, the working copy kept locally the way the
     other study tools keep theirs, and the account the planner is already
     signed in to used for saving. */
  function readMode() {
    try { return localStorage.getItem(MODE_KEY) === 'functions' ? 'functions' : 'data'; } catch (e) { return 'data'; }
  }

  function mountPlanner(host) {
    host.innerHTML = '<div class="flg-shell flg-shell--planner">'
      + '<div class="flg-pbar">'
      +   '<div class="flg-seg" role="tablist" aria-label="Which grapher">'
      +     '<button type="button" role="tab" data-pmode="functions">Functions</button>'
      +     '<button type="button" role="tab" data-pmode="data">Measurements</button>'
      +   '</div>'
      +   '<span class="flg-grow"></span>'
      +   '<button type="button" class="flg-ibtn" data-pact="save" title="Save to your account" aria-label="Save to your account">' + ICON.cloud + '</button>'
      +   '<button type="button" class="flg-ibtn" data-pact="open" title="Your saved graphs" aria-label="Your saved graphs">' + ICON.folder + '</button>'
      +   '<button type="button" class="flg-ibtn" data-pact="png" title="Download as an image" aria-label="Download as an image">' + ICON.image + '</button>'
      +   '<button type="button" class="flg-ibtn" data-pact="full" title="Open the full-screen grapher" aria-label="Open the full-screen grapher">' + ICON.expand + '</button>'
      + '</div>'
      + '<div class="flg-pbody"></div>'
      + '</div>';
    const body = host.querySelector('.flg-pbody');
    const bar = host.querySelector('.flg-pbar');
    let inst = null;

    function show(mode) {
      if (inst) inst.destroy();
      inst = create(body, { mode: mode, surface: 'planner' });
      bar.querySelectorAll('[data-pmode]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.pmode === mode)));
      try { localStorage.setItem(MODE_KEY, mode); } catch (e) {}
    }

    bar.addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      if (b.dataset.pmode) { if (!inst || inst.kind !== b.dataset.pmode) show(b.dataset.pmode); return; }
      const act = b.dataset.pact;
      const C = window.FluxGraphCloud;
      if (act === 'png') inst.exportPNG();
      else if (act === 'save') { if (C) C.save(inst); else toast('Saving has not loaded yet.', 'warning'); }
      else if (act === 'open') {
        if (!C) { toast('Saving has not loaded yet.', 'warning'); return; }
        C.open(function (row) {
          if (row.kind !== inst.kind) show(row.kind);
          inst.loadDoc(row.payload, { id: row.id, title: row.title });
          toast('Opened "' + row.title + '".', 'success');
        });
      } else if (act === 'full') {
        inst.persistLocal();
        writeJSON(HANDOFF_KEY, { kind: inst.kind, payload: inst.doc, cloud: inst.cloud, at: Date.now() });
        window.open('grapher.html', '_blank', 'noopener');
      }
    });

    show(readMode());
    return { get instance() { return inst; } };
  }

  /** Study tools → Grapher calls mount(el, { mode: 'simple' }). */
  function mount(host, opts) {
    if (!host) return null;
    const mode = opts && opts.mode;
    if (mode === 'functions' || mode === 'data' || mode === 'full') {
      return create(host, { mode: mode === 'functions' ? 'functions' : 'data', surface: (opts && opts.surface) || 'standalone' });
    }
    return mountPlanner(host);
  }

  function mountFunctions(host) { return create(host, { mode: 'functions', surface: 'standalone' }); }

  window.FluxGrapher = {
    create: create,
    mount: mount,
    mountFunctions: mountFunctions,
    toast: toast,
    ICON: ICON,
    esc: esc,
    openPop: openPop,
    closePop: closePop,
    HANDOFF_KEY: HANDOFF_KEY,
    MODE_KEY: MODE_KEY,
    WORKING_KEY: WORK_KEYS.data,
    PALETTE: PALETTE,
    // For the unit tests: pure functions, no DOM.
    _test: {
      keyPoints: keyPoints, intersections: intersections, parseExpr: parseExpr,
      normaliseDoc: normaliseDoc, tablePoints: tablePoints, uncOf: uncOf, fmtTick: fmtTick,
      computeTable: computeTable, parseDomain: parseDomain,
    },
  };
})();
