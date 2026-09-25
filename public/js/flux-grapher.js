/* ============================================================================
   FLUX GRAPHER  ·  flux-grapher.js
   Readings in, a fitted line and error bars out — in a state you can put
   straight into a lab report.

   TWO SURFACES, ONE IMPLEMENTATION
   --------------------------------
     mount(el, { mode: 'simple' })   Study tools → Grapher. Replaced the Desmos
                                     embed. Table, fit, chart, and it keeps its
                                     working state the way every other tool in
                                     the app does.
     mount(el, { mode: 'full' })     grapher.html — the standalone tool. Adds
                                     uncertainties, error bars and the max/min
                                     gradient method. No account, no sign-in,
                                     and nothing is written down until the Save
                                     button is actually pressed.

   Desmos is function-first: type an equation, see a curve. A practical is the
   other way round — you have a column of measurements, each with an
   uncertainty, and you want the gradient and how sure you can be of it. That is
   the gap this fills, and it is the thing the paid tools charge for.

   The arithmetic lives in flux-lab-fit.js, unit-tested against hand-worked
   numbers. This file only turns it into pixels.
   ========================================================================== */
(function () {
  'use strict';

  /* Where an explicit save lands. Deliberately NOT the app's per-user
     namespaced key: the standalone page has no idea who you are, and asking
     would defeat the point of it. It drops the graph in this shared inbox and
     the planner files it under the right account next time it opens. */
  const INBOX_KEY = 'flux_graph_inbox';
  const WORKING_KEY = 'flux_lab_graph';

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
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

  const BLANK = () => ({
    title: '', xLabel: 'x', yLabel: 'y', xUnit: '', yUnit: '',
    rows: [{ x: '', y: '' }, { x: '', y: '' }, { x: '', y: '' }, { x: '', y: '' }, { x: '', y: '' }],
    ux: { mode: 'none', value: '' },
    uy: { mode: 'none', value: '' },
    fitKind: 'linear',
    showMinMax: false,
  });

  function readJSON(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) { return fallback; }
  }
  function writeJSON(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; }
    catch (e) { return false; }
  }

  function niceTicks(lo, hi, target) {
    if (!(hi > lo)) return [lo];
    const raw = (hi - lo) / Math.max(1, target);
    const mag = Math.pow(10, Math.floor(Math.log10(raw)));
    const norm = raw / mag;
    /* Steps of 1, 2 or 5 times a power of ten. Anything else gives labels like
       0.037 and makes a chart look like a spreadsheet accident. */
    const step = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10) * mag;
    const out = [];
    for (let t = Math.ceil(lo / step) * step; t <= hi + step * 1e-9; t += step) {
      out.push(Math.round(t / step) * step);
    }
    return out;
  }

  function axisTitle(label, unit) {
    const l = String(label || '').trim();
    const u = String(unit || '').trim();
    if (!l && !u) return '';
    return u ? l + ' / ' + u : l;
  }

  /** One grapher instance. Everything it owns hangs off `this`, so two on one
      page cannot tread on each other's element ids. */
  function Grapher(host, opts) {
    this.host = host;
    this.mode = (opts && opts.mode) === 'full' ? 'full' : 'simple';
    // The standalone tool must not remember anything you did not ask it to.
    this.autosave = this.mode === 'simple';
    this.uid = 'flg' + Math.random().toString(36).slice(2, 8);
    this.state = this.autosave
      ? Object.assign(BLANK(), readJSON(WORKING_KEY, null) || {})
      : BLANK();
    if (!Array.isArray(this.state.rows) || !this.state.rows.length) this.state.rows = BLANK().rows;
  }

  Grapher.prototype.el = function (suffix) {
    return document.getElementById(this.uid + suffix);
  };

  /** Rows with numbers in both columns, carrying their resolved error bars. */
  Grapher.prototype.points = function () {
    const F = window.FluxLabFit;
    const withBars = this.mode === 'full';
    const out = [];
    this.state.rows.forEach((r) => {
      const x = parseFloat(r.x), y = parseFloat(r.y);
      if (!Number.isFinite(x) || !Number.isFinite(y)) return;
      out.push({
        x: x, y: y,
        dx: withBars && F ? F.resolveUncertainty(x, this.state.ux) : 0,
        dy: withBars && F ? F.resolveUncertainty(y, this.state.uy) : 0,
      });
    });
    return out;
  };

  /* ── The chart ──────────────────────────────────────────────────────────
     SVG rather than canvas: sharp on any display, scales with the card, and
     can be handed straight to the export button. */
  Grapher.prototype.chartSVG = function (pts, fitResult, minMax) {
    const W = 680, H = 460;
    const padL = 78, padR = 22, padT = 26, padB = 64;
    const plotW = W - padL - padR, plotH = H - padT - padB;
    const s = this.state;

    if (!pts.length) {
      return '<svg class="flg-svg" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Empty graph">'
        + '<rect x="' + padL + '" y="' + padT + '" width="' + plotW + '" height="' + plotH + '" class="flg-plotbg"/>'
        + '<text x="' + (W / 2) + '" y="' + (H / 2) + '" class="flg-empty" text-anchor="middle">'
        + 'Type readings into the table — the graph draws itself</text></svg>';
    }

    // Bounds include the error bars, or a bar hangs off the edge of the frame.
    let xLo = Infinity, xHi = -Infinity, yLo = Infinity, yHi = -Infinity;
    pts.forEach((p) => {
      xLo = Math.min(xLo, p.x - p.dx); xHi = Math.max(xHi, p.x + p.dx);
      yLo = Math.min(yLo, p.y - p.dy); yHi = Math.max(yHi, p.y + p.dy);
    });
    if (xLo === xHi) { xLo -= 1; xHi += 1; }
    if (yLo === yHi) { yLo -= 1; yHi += 1; }
    const padX = (xHi - xLo) * 0.08, padY = (yHi - yLo) * 0.08;
    xLo -= padX; xHi += padX; yLo -= padY; yHi += padY;

    const sx = (x) => padL + ((x - xLo) / (xHi - xLo)) * plotW;
    const sy = (y) => padT + plotH - ((y - yLo) / (yHi - yLo)) * plotH;

    let g = '';
    niceTicks(xLo, xHi, 6).forEach((t) => {
      const X = sx(t);
      g += '<line x1="' + X + '" y1="' + padT + '" x2="' + X + '" y2="' + (padT + plotH) + '" class="flg-grid"/>'
        + '<text x="' + X + '" y="' + (padT + plotH + 18) + '" class="flg-tick" text-anchor="middle">' + fmt(t) + '</text>';
    });
    niceTicks(yLo, yHi, 6).forEach((t) => {
      const Y = sy(t);
      g += '<line x1="' + padL + '" y1="' + Y + '" x2="' + (padL + plotW) + '" y2="' + Y + '" class="flg-grid"/>'
        + '<text x="' + (padL - 8) + '" y="' + (Y + 4) + '" class="flg-tick" text-anchor="end">' + fmt(t) + '</text>';
    });

    // The fitted curve, sampled across the plot so curves come out smooth.
    let fitPath = '';
    if (fitResult && typeof fitResult.predict === 'function') {
      const steps = 120;
      let run = [];
      for (let i = 0; i <= steps; i++) {
        const x = xLo + ((xHi - xLo) * i) / steps;
        const y = fitResult.predict(x);
        // Break the line rather than let a steep curve escape the frame.
        if (!Number.isFinite(y) || y < yLo - (yHi - yLo) || y > yHi + (yHi - yLo)) {
          if (run.length > 1) fitPath += '<polyline points="' + run.join(' ') + '" class="flg-fit"/>';
          run = [];
          continue;
        }
        run.push(sx(x).toFixed(2) + ',' + sy(y).toFixed(2));
      }
      if (run.length > 1) fitPath += '<polyline points="' + run.join(' ') + '" class="flg-fit"/>';
    }

    let mm = '';
    if (minMax) {
      [['steep', minMax.steep], ['shallow', minMax.shallow]].forEach((pair) => {
        const L = pair[1];
        mm += '<line x1="' + sx(L.x1) + '" y1="' + sy(L.y1) + '" x2="' + sx(L.x2) + '" y2="' + sy(L.y2)
          + '" class="flg-mm flg-mm--' + pair[0] + '"/>';
      });
    }

    let marks = '';
    pts.forEach((p) => {
      const X = sx(p.x), Y = sy(p.y);
      if (p.dy > 0) {
        const y1 = sy(p.y - p.dy), y2 = sy(p.y + p.dy);
        marks += '<line x1="' + X + '" y1="' + y1 + '" x2="' + X + '" y2="' + y2 + '" class="flg-bar"/>'
          + '<line x1="' + (X - 4) + '" y1="' + y1 + '" x2="' + (X + 4) + '" y2="' + y1 + '" class="flg-bar"/>'
          + '<line x1="' + (X - 4) + '" y1="' + y2 + '" x2="' + (X + 4) + '" y2="' + y2 + '" class="flg-bar"/>';
      }
      if (p.dx > 0) {
        const x1 = sx(p.x - p.dx), x2 = sx(p.x + p.dx);
        marks += '<line x1="' + x1 + '" y1="' + Y + '" x2="' + x2 + '" y2="' + Y + '" class="flg-bar"/>'
          + '<line x1="' + x1 + '" y1="' + (Y - 4) + '" x2="' + x1 + '" y2="' + (Y + 4) + '" class="flg-bar"/>'
          + '<line x1="' + x2 + '" y1="' + (Y - 4) + '" x2="' + x2 + '" y2="' + (Y + 4) + '" class="flg-bar"/>';
      }
      marks += '<circle cx="' + X + '" cy="' + Y + '" r="4" class="flg-pt"><title>('
        + fmt(p.x) + ', ' + fmt(p.y) + ')</title></circle>';
    });

    const xt = axisTitle(s.xLabel, s.xUnit), yt = axisTitle(s.yLabel, s.yUnit);
    return '<svg class="flg-svg" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="'
      + esc(s.title || 'Graph') + ': ' + esc(yt) + ' against ' + esc(xt) + ', ' + pts.length + ' points">'
      + '<rect x="' + padL + '" y="' + padT + '" width="' + plotW + '" height="' + plotH + '" class="flg-plotbg"/>'
      + g
      + '<line x1="' + padL + '" y1="' + (padT + plotH) + '" x2="' + (padL + plotW) + '" y2="' + (padT + plotH) + '" class="flg-axis"/>'
      + '<line x1="' + padL + '" y1="' + padT + '" x2="' + padL + '" y2="' + (padT + plotH) + '" class="flg-axis"/>'
      + mm + fitPath + marks
      + '<text x="' + (padL + plotW / 2) + '" y="' + (H - 16) + '" class="flg-axlabel" text-anchor="middle">' + esc(xt) + '</text>'
      + '<text x="18" y="' + (padT + plotH / 2) + '" class="flg-axlabel" text-anchor="middle" transform="rotate(-90 18 '
      + (padT + plotH / 2) + ')">' + esc(yt) + '</text>'
      + (s.title ? '<text x="' + (padL + plotW / 2) + '" y="16" class="flg-title" text-anchor="middle">' + esc(s.title) + '</text>' : '')
      + '</svg>';
  };

  /** The numbers panel — what actually gets copied into a write-up. */
  Grapher.prototype.resultsHTML = function (pts, res, minMax) {
    if (!pts.length) return '<div class="flg-hint">Nothing plotted yet.</div>';
    if (res && res.error) return '<div class="flg-warn">' + esc(res.error) + '</div>';
    const f = res && res.fit;
    if (!f) return '<div class="flg-hint">Add a second reading to fit a line.</div>';

    const rows = [];
    if (f.kind === 'linear' || f.kind === 'proportional') {
      rows.push(['Gradient m', f.um != null ? fmtWithU(f.m, f.um) : fmt(f.m)]);
      if (f.kind === 'linear') rows.push(['Intercept c', f.uc != null ? fmtWithU(f.c, f.uc) : fmt(f.c)]);
    } else if (f.kind === 'quadratic') {
      rows.push(['a', fmt(f.a)], ['b', fmt(f.b)], ['c', fmt(f.c)]);
    } else {
      rows.push(['a', fmt(f.a)], ['b', fmt(f.b)]);
    }
    rows.push(['R²', fmt(f.r2)]);
    if (minMax) {
      rows.push(['Steepest / shallowest', fmt(minMax.mMax) + ' / ' + fmt(minMax.mMin)]);
      rows.push(['m from the error bars', fmtWithU((minMax.mMax + minMax.mMin) / 2, minMax.uncertainty)]);
    }

    return '<div class="flg-eq">' + esc(f.equation(fmt)) + '</div>'
      + '<table class="flg-res">'
      + rows.map((r) => '<tr><th>' + esc(r[0]) + '</th><td>' + esc(r[1]) + '</td></tr>').join('')
      + '</table>'
      + (f.r2Transformed != null
        ? '<div class="flg-note">R² is measured against your readings. On the straightened (log) data it is '
          + fmt(f.r2Transformed) + ' — higher, which is exactly why that is not the headline figure.</div>'
        : '')
      + (this.state.showMinMax && !minMax
        ? '<div class="flg-note">The steepest and shallowest lines need error bars on the first and last '
          + 'points, and their horizontal bars must not overlap.</div>'
        : '');
  };

  Grapher.prototype.tableHTML = function () {
    const s = this.state;
    const rows = s.rows.map((r, i) =>
      '<tr><td class="flg-rown">' + (i + 1) + '</td>'
      + '<td><input type="text" inputmode="decimal" class="flg-cell" data-row="' + i + '" data-col="x" value="'
      + esc(r.x) + '" aria-label="x, row ' + (i + 1) + '"></td>'
      + '<td><input type="text" inputmode="decimal" class="flg-cell" data-row="' + i + '" data-col="y" value="'
      + esc(r.y) + '" aria-label="y, row ' + (i + 1) + '"></td>'
      + '<td><button type="button" class="flg-rowdel" data-del="' + i + '" aria-label="Delete row ' + (i + 1) + '">✕</button></td></tr>',
    ).join('');
    return '<table class="flg-table"><thead><tr><th></th><th>' + esc(s.xLabel || 'x')
      + '</th><th>' + esc(s.yLabel || 'y') + '</th><th></th></tr></thead><tbody>' + rows + '</tbody></table>';
  };

  Grapher.prototype.uncertaintyRow = function (axis) {
    const s = this.state;
    const u = axis === 'x' ? s.ux : s.uy;
    const label = axis === 'x' ? (s.xLabel || 'x') : (s.yLabel || 'y');
    return '<div class="flg-urow"><span class="flg-ulabel">± on ' + esc(label) + '</span>'
      + '<select class="flg-usel" data-u="' + axis + '" aria-label="Uncertainty type for ' + esc(label) + '">'
      + '<option value="none"' + (u.mode === 'none' ? ' selected' : '') + '>none</option>'
      + '<option value="absolute"' + (u.mode === 'absolute' ? ' selected' : '') + '>± value</option>'
      + '<option value="percent"' + (u.mode === 'percent' ? ' selected' : '') + '>± %</option></select>'
      + '<input type="text" inputmode="decimal" class="flg-uval" data-u="' + axis + '" value="' + esc(u.value) + '"'
      + (u.mode === 'none' ? ' disabled' : '') + ' aria-label="Uncertainty size for ' + esc(label) + '"></div>';
  };

  Grapher.prototype.render = function () {
    const F = window.FluxLabFit;
    if (!F) {
      this.host.innerHTML = '<div class="flg-warn">The graphing engine has not loaded. Refresh the page.</div>';
      return;
    }
    const s = this.state, u = this.uid, full = this.mode === 'full';
    const pts = this.points();
    const res = pts.length >= 2 ? F.fit(s.fitKind, pts) : null;
    const minMax = full && s.showMinMax ? F.minMaxGradient(pts) : null;

    this.host.innerHTML = '<div class="flg" id="' + u + 'Root">'
      + '<div class="flg-side">'
        + '<div class="flg-block"><div class="flg-block-h">Readings</div>'
          + '<div class="flg-tablewrap">' + this.tableHTML() + '</div>'
          + '<div class="flg-tbtns">'
            + '<button type="button" class="flg-btn" id="' + u + 'Add">+ Row</button>'
            + '<button type="button" class="flg-btn ghost" id="' + u + 'Paste">Paste data</button>'
            + '<button type="button" class="flg-btn ghost" id="' + u + 'Clear">Clear</button>'
          + '</div></div>'
        + (full
          ? '<div class="flg-block"><div class="flg-block-h">Uncertainties</div>'
            + this.uncertaintyRow('x') + this.uncertaintyRow('y') + '</div>'
          : '')
        + '<div class="flg-block"><div class="flg-block-h">Line of best fit</div>'
          + '<select class="flg-fitsel" id="' + u + 'Fit" aria-label="Type of fit">'
          + F.KINDS.map((k) => '<option value="' + k.id + '"' + (s.fitKind === k.id ? ' selected' : '') + '>'
            + esc(k.name) + ' — ' + esc(k.hint) + '</option>').join('')
          + '</select>'
          + (full
            ? '<label class="flg-check"><input type="checkbox" id="' + u + 'MinMax"'
              + (s.showMinMax ? ' checked' : '') + '><span>Steepest &amp; shallowest lines'
              + '<small>gradient uncertainty from the error bars</small></span></label>'
            : '')
        + '</div>'
        + '<div class="flg-block"><div class="flg-block-h">Labels</div>'
          + '<input type="text" class="flg-lab" data-lab="title" placeholder="Graph title" value="' + esc(s.title) + '" aria-label="Graph title">'
          + '<div class="flg-lab2"><input type="text" class="flg-lab" data-lab="xLabel" placeholder="x quantity" value="' + esc(s.xLabel) + '" aria-label="x axis quantity">'
          + '<input type="text" class="flg-lab" data-lab="xUnit" placeholder="unit" value="' + esc(s.xUnit) + '" aria-label="x axis unit"></div>'
          + '<div class="flg-lab2"><input type="text" class="flg-lab" data-lab="yLabel" placeholder="y quantity" value="' + esc(s.yLabel) + '" aria-label="y axis quantity">'
          + '<input type="text" class="flg-lab" data-lab="yUnit" placeholder="unit" value="' + esc(s.yUnit) + '" aria-label="y axis unit"></div>'
        + '</div>'
      + '</div>'
      + '<div class="flg-main">'
        + '<div class="flg-chart" id="' + u + 'Chart">' + this.chartSVG(pts, res && res.fit, minMax) + '</div>'
        + '<div class="flg-results" id="' + u + 'Results">' + this.resultsHTML(pts, res, minMax) + '</div>'
        + '<div class="flg-export">'
          + '<button type="button" class="flg-btn" id="' + u + 'Png">Save as image</button>'
          + '<button type="button" class="flg-btn ghost" id="' + u + 'Copy">Copy the numbers</button>'
          + (full ? '<button type="button" class="flg-btn ghost" id="' + u + 'ToFlux">Save to my planner</button>' : '')
        + '</div>'
      + '</div></div>';

    this.wire();
  };

  /** Redraw only the chart and results. Rebuilding the whole panel would take
      focus out of the cell being typed into after every keystroke. */
  Grapher.prototype.refresh = function () {
    const F = window.FluxLabFit;
    const pts = this.points();
    const res = pts.length >= 2 ? F.fit(this.state.fitKind, pts) : null;
    const minMax = this.mode === 'full' && this.state.showMinMax ? F.minMaxGradient(pts) : null;
    const c = this.el('Chart'), r = this.el('Results');
    if (c) c.innerHTML = this.chartSVG(pts, res && res.fit, minMax);
    if (r) r.innerHTML = this.resultsHTML(pts, res, minMax);
    if (this.autosave) writeJSON(WORKING_KEY, this.state);
  };

  Grapher.prototype.wire = function () {
    const self = this, root = this.el('Root');
    if (!root) return;

    root.addEventListener('input', (e) => {
      const t = e.target;
      if (t.classList.contains('flg-cell')) {
        self.state.rows[+t.dataset.row][t.dataset.col] = t.value;
        self.refresh();
      } else if (t.classList.contains('flg-uval')) {
        (t.dataset.u === 'x' ? self.state.ux : self.state.uy).value = t.value;
        self.refresh();
      } else if (t.dataset && t.dataset.lab) {
        self.state[t.dataset.lab] = t.value;
        // Column headings follow the axis names, so relabel them in place.
        if (t.dataset.lab === 'xLabel' || t.dataset.lab === 'yLabel') {
          const th = root.querySelectorAll('.flg-table thead th');
          if (th[1]) th[1].textContent = self.state.xLabel || 'x';
          if (th[2]) th[2].textContent = self.state.yLabel || 'y';
          root.querySelectorAll('.flg-ulabel').forEach((el, i) => {
            el.textContent = '± on ' + ((i === 0 ? self.state.xLabel : self.state.yLabel) || (i === 0 ? 'x' : 'y'));
          });
        }
        self.refresh();
      }
    });

    root.addEventListener('change', (e) => {
      const t = e.target;
      if (t.classList.contains('flg-usel')) {
        const u = t.dataset.u === 'x' ? self.state.ux : self.state.uy;
        u.mode = t.value;
        const box = root.querySelector('.flg-uval[data-u="' + t.dataset.u + '"]');
        if (box) box.disabled = u.mode === 'none';
        self.refresh();
      } else if (t.id === self.uid + 'Fit') { self.state.fitKind = t.value; self.refresh(); }
      else if (t.id === self.uid + 'MinMax') { self.state.showMinMax = t.checked; self.refresh(); }
    });

    root.addEventListener('click', (e) => {
      const del = e.target.closest('[data-del]');
      if (del) {
        self.state.rows.splice(+del.dataset.del, 1);
        if (!self.state.rows.length) self.state.rows.push({ x: '', y: '' });
        self.render();
        return;
      }
      const id = e.target.id;
      if (id === self.uid + 'Add') { self.state.rows.push({ x: '', y: '' }); self.render(); }
      else if (id === self.uid + 'Clear') {
        if (window.confirm('Clear every reading in the table?')) { self.state = BLANK(); self.render(); }
      } else if (id === self.uid + 'Paste') { self.promptPaste(); }
      else if (id === self.uid + 'Png') { self.exportPNG(); }
      else if (id === self.uid + 'Copy') { self.copyNumbers(); }
      else if (id === self.uid + 'ToFlux') { self.saveToPlanner(); }
    });

    /* Pasting a block straight into a cell is what people do with a spreadsheet
       open beside them, so handle it rather than letting forty rows land in a
       single box. */
    root.addEventListener('paste', (e) => {
      const t = e.target;
      if (!t.classList || !t.classList.contains('flg-cell')) return;
      const text = (e.clipboardData || window.clipboardData).getData('text') || '';
      if (!/[\n\t,]/.test(text)) return;          // a single value — let it through
      e.preventDefault();
      self.applyPasted(text, +t.dataset.row);
      self.render();
    });
  };

  /** Split a pasted block into rows, accepting tabs, commas or runs of spaces. */
  Grapher.prototype.applyPasted = function (text, startRow) {
    const parsed = [];
    String(text).trim().split(/\r?\n/).forEach((line) => {
      if (!line.trim()) return;
      const cells = line.trim().split(/[\t,;]+|\s{2,}|\s+/).filter((c) => c !== '');
      if (!cells.length) return;
      // A header row pasted along with the data must not become NaN readings.
      if (!cells.some((c) => Number.isFinite(parseFloat(c)))) return;
      parsed.push({ x: cells[0] != null ? cells[0] : '', y: cells[1] != null ? cells[1] : '' });
    });
    if (!parsed.length) return;
    const at = Number.isFinite(startRow) ? startRow : 0;
    this.state.rows.splice(at, parsed.length, ...parsed);
  };

  Grapher.prototype.promptPaste = function () {
    const text = window.prompt('Paste two columns — x then y. Tabs, commas or spaces all work:');
    if (!text) return;
    this.applyPasted(text, 0);
    this.render();
  };

  /** Rasterise the SVG so it can go straight into a report. */
  Grapher.prototype.exportPNG = function () {
    const chart = this.el('Chart');
    const svg = chart && chart.querySelector('svg');
    if (!svg) return;
    const self = this;
    const clone = svg.cloneNode(true);
    /* Inline the computed colours. The SVG refers to CSS variables, which do
       not travel with a serialised copy — an exported file would otherwise
       come out black on black. */
    const inline = (sel, props) => {
      const src = svg.querySelector(sel);
      if (!src) return;
      const cs = getComputedStyle(src);
      clone.querySelectorAll(sel).forEach((el) => {
        props.forEach((p) => el.style.setProperty(p, cs.getPropertyValue(p)));
      });
    };
    inline('.flg-plotbg', ['fill']);
    inline('.flg-grid', ['stroke']);
    inline('.flg-axis', ['stroke']);
    inline('.flg-fit', ['stroke']);
    inline('.flg-bar', ['stroke']);
    inline('.flg-pt', ['fill', 'stroke']);
    inline('.flg-mm--steep', ['stroke']);
    inline('.flg-mm--shallow', ['stroke']);
    ['.flg-tick', '.flg-axlabel', '.flg-title'].forEach((s) => inline(s, ['fill', 'font-size']));

    const xml = new XMLSerializer().serializeToString(clone);
    const url = URL.createObjectURL(new Blob([xml], { type: 'image/svg+xml;charset=utf-8' }));
    const img = new Image();
    const name = (this.state.title || 'graph').replace(/[^a-z0-9]+/gi, '-').toLowerCase();
    img.onload = function () {
      const scale = 2;                    // legible once pasted into a document
      const cv = document.createElement('canvas');
      cv.width = 680 * scale; cv.height = 460 * scale;
      const ctx = cv.getContext('2d');
      // White, because it is going into a report, not back onto a dark screen.
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, cv.width, cv.height);
      ctx.drawImage(img, 0, 0, cv.width, cv.height);
      URL.revokeObjectURL(url);
      cv.toBlob(function (b) {
        if (!b) return;
        const a = document.createElement('a');
        a.href = URL.createObjectURL(b);
        a.download = name + '.png';
        a.click();
        setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
      }, 'image/png');
    };
    img.onerror = function () {
      URL.revokeObjectURL(url);
      self.toast('Could not turn the graph into an image.', 'error');
    };
    img.src = url;
  };

  Grapher.prototype.copyNumbers = function () {
    const F = window.FluxLabFit;
    const pts = this.points();
    const res = pts.length >= 2 ? F.fit(this.state.fitKind, pts) : null;
    if (!res || !res.fit) { this.toast('Nothing to copy yet.', 'warning'); return; }
    const f = res.fit, s = this.state, self = this;
    const minMax = this.mode === 'full' && s.showMinMax ? F.minMaxGradient(pts) : null;
    const lines = [
      s.title || 'Graph',
      axisTitle(s.yLabel, s.yUnit) + ' against ' + axisTitle(s.xLabel, s.xUnit),
      'Fit: ' + f.equation(fmt),
    ];
    if (f.m != null) lines.push('Gradient: ' + (f.um != null ? fmtWithU(f.m, f.um) : fmt(f.m)));
    if (f.kind === 'linear') lines.push('Intercept: ' + (f.uc != null ? fmtWithU(f.c, f.uc) : fmt(f.c)));
    lines.push('R²: ' + fmt(f.r2));
    if (minMax) lines.push('Gradient from the error bars: ' + fmtWithU((minMax.mMax + minMax.mMin) / 2, minMax.uncertainty));
    const text = lines.join('\n');
    const ok = function () { self.toast('Copied — paste it into your report.', 'success'); };
    const bad = function () { self.toast('Could not reach the clipboard.', 'error'); };
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(ok, bad);
      else bad();
    } catch (e) { bad(); }
  };

  /* The only thing on the standalone page that writes anything down, and only
     when the button is pressed. It drops the graph into a shared inbox rather
     than a signed-in user's own key, because this page has no idea who you are
     — the planner files it correctly the next time it opens. */
  Grapher.prototype.saveToPlanner = function () {
    const list = readJSON(INBOX_KEY, []);
    const saved = Array.isArray(list) ? list : [];
    saved.push({
      id: 'g' + Date.now(),
      savedAt: new Date().toISOString(),
      title: this.state.title || 'Untitled graph',
      xLabel: this.state.xLabel, yLabel: this.state.yLabel,
      xUnit: this.state.xUnit, yUnit: this.state.yUnit,
      rows: this.state.rows.filter((r) => String(r.x).trim() !== '' || String(r.y).trim() !== ''),
      ux: this.state.ux, uy: this.state.uy,
      fitKind: this.state.fitKind,
    });
    if (writeJSON(INBOX_KEY, saved)) {
      this.toast('Saved. It will be waiting in your planner under Study tools → Grapher.', 'success');
    } else {
      this.toast('Could not save — this browser is blocking storage for the page.', 'error');
    }
  };

  Grapher.prototype.toast = function (msg, kind) {
    try {
      if (typeof window.showToast === 'function') { window.showToast(msg, kind || 'info'); return; }
    } catch (e) {}
    // The standalone page has no toast system of its own.
    const n = document.createElement('div');
    n.className = 'flg-toast' + (kind ? ' flg-toast--' + kind : '');
    n.textContent = msg;
    document.body.appendChild(n);
    setTimeout(function () { n.classList.add('flg-toast--out'); }, 2600);
    setTimeout(function () { if (n.parentNode) n.parentNode.removeChild(n); }, 3200);
  };

  function mount(host, opts) {
    if (!host) return null;
    const g = new Grapher(host, opts || {});
    g.render();
    return g;
  }

  /* ══════════════════════════════════════════════════════════════════════
     FUNCTION MODE — the other half of the grapher.

     Typing y = x² to see its shape and plotting eleven readings with error
     bars are different jobs, and one screen serving both is worse at each.
     This half has no table, no uncertainties and no fits: an expression, a
     colour, a curve.

     Deliberately outside the Grapher class. That class is about a dataset, and
     bolting a second meaning onto its state would make both harder to follow.
     ══════════════════════════════════════════════════════════════════════ */
  const FN_KEY = 'flux_grapher_fns';
  const FN_COLOURS = ['#00c2ff', '#7c5cff', '#10d9a0', '#fbbf24', '#f43f5e', '#e879f9'];

  function mountFunctions(host) {
    if (!host) return null;
    let st = readJSON(FN_KEY, null);
    if (!st || !Array.isArray(st.exprs) || !st.exprs.length) {
      st = { exprs: [{ src: 'x^2', colour: FN_COLOURS[0] }], view: { xLo: -10, xHi: 10 } };
    }
    if (!st.view) st.view = { xLo: -10, xHi: 10 };
    function save() { writeJSON(FN_KEY, st); }

    function draw() {
      const W = 900, H = 560, padL = 46, padR = 18, padT = 18, padB = 34;
      const plotW = W - padL - padR, plotH = H - padT - padB;
      const xLo = st.view.xLo, xHi = st.view.xHi;

      const compiled = st.exprs.map(function (ex) {
        if (!ex.src || !ex.src.trim()) return null;
        const r = window.FluxExpr ? window.FluxExpr.tryCompile(ex.src) : { error: 'Parser missing' };
        return r.error ? { error: r.error } : { fn: r.fn };
      });

      /* The y range follows what the curves actually do across the visible x,
         so a parabola frames itself instead of the reader hunting for it.
         Trimmed at the 2nd and 98th percentile rather than min/max: one pole
         would otherwise squash everything else into a flat line. */
      const samples = [];
      compiled.forEach(function (c) {
        if (!c || c.error) return;
        for (let k = 0; k <= 240; k++) {
          const y = c.fn(xLo + ((xHi - xLo) * k) / 240);
          if (Number.isFinite(y)) samples.push(y);
        }
      });
      let yLo = -10, yHi = 10;
      if (samples.length > 4) {
        samples.sort(function (a, b) { return a - b; });
        const lo = samples[Math.floor(samples.length * 0.02)];
        const hi = samples[Math.floor(samples.length * 0.98)];
        if (Number.isFinite(lo) && Number.isFinite(hi) && hi > lo) {
          const pad = (hi - lo) * 0.12;
          yLo = lo - pad; yHi = hi + pad;
        }
      }

      const sx = function (x) { return padL + ((x - xLo) / (xHi - xLo)) * plotW; };
      const sy = function (y) { return padT + plotH - ((y - yLo) / (yHi - yLo)) * plotH; };

      let g = '';
      niceTicks(xLo, xHi, 8).forEach(function (t) {
        const X = sx(t);
        g += '<line x1="' + X + '" y1="' + padT + '" x2="' + X + '" y2="' + (padT + plotH) + '" class="flg-grid"/>'
          + '<text x="' + X + '" y="' + (padT + plotH + 16) + '" class="flg-tick" text-anchor="middle">' + fmt(t) + '</text>';
      });
      niceTicks(yLo, yHi, 7).forEach(function (t) {
        const Y = sy(t);
        g += '<line x1="' + padL + '" y1="' + Y + '" x2="' + (padL + plotW) + '" y2="' + Y + '" class="flg-grid"/>'
          + '<text x="' + (padL - 7) + '" y="' + (Y + 4) + '" class="flg-tick" text-anchor="end">' + fmt(t) + '</text>';
      });
      // The axes proper, drawn at zero whenever zero is on screen.
      if (yLo < 0 && yHi > 0) g += '<line x1="' + padL + '" y1="' + sy(0) + '" x2="' + (padL + plotW) + '" y2="' + sy(0) + '" class="flg-axis"/>';
      if (xLo < 0 && xHi > 0) g += '<line x1="' + sx(0) + '" y1="' + padT + '" x2="' + sx(0) + '" y2="' + (padT + plotH) + '" class="flg-axis"/>';

      let curves = '';
      compiled.forEach(function (c, idx) {
        if (!c || c.error) return;
        const colour = st.exprs[idx].colour || FN_COLOURS[idx % FN_COLOURS.length];
        let run = [];
        const flush = function () {
          if (run.length > 1) {
            curves += '<polyline points="' + run.join(' ') + '" fill="none" stroke="' + colour
              + '" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"/>';
          }
          run = [];
        };
        let prevY = null;
        for (let k = 0; k <= 900; k++) {
          const x = xLo + ((xHi - xLo) * k) / 900;
          const y = c.fn(x);
          if (!Number.isFinite(y)) { flush(); prevY = null; continue; }
          /* Break the line at a pole rather than drawing a vertical streak
             across the plot — tan(x) and 1/x look absurd otherwise. */
          if (prevY !== null && Math.abs(y - prevY) > (yHi - yLo) * 1.6) flush();
          prevY = y;
          if (y < yLo - (yHi - yLo) * 2 || y > yHi + (yHi - yLo) * 2) { flush(); continue; }
          run.push(sx(x).toFixed(1) + ',' + sy(y).toFixed(1));
        }
        flush();
      });

      return '<svg class="flg-svg" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Function graph">'
        + '<rect x="' + padL + '" y="' + padT + '" width="' + plotW + '" height="' + plotH + '" class="flg-plotbg"/>'
        + g + curves + '</svg>';
    }

    function rowsHTML() {
      return st.exprs.map(function (ex, i) {
        const r = ex.src && ex.src.trim() && window.FluxExpr
          ? window.FluxExpr.tryCompile(ex.src) : {};
        return '<div class="flg-fnrow">'
          + '<input type="color" class="flg-fncol" data-i="' + i + '" value="'
          + esc(ex.colour || FN_COLOURS[i % FN_COLOURS.length]) + '" aria-label="Colour for function ' + (i + 1) + '">'
          + '<span class="flg-fnpre" aria-hidden="true">y =</span>'
          + '<input type="text" class="flg-fnsrc" data-i="' + i + '" value="' + esc(ex.src)
          + '" spellcheck="false" autocapitalize="off" autocomplete="off" aria-label="Function ' + (i + 1) + '">'
          + '<button type="button" class="flg-fndel" data-del="' + i + '" aria-label="Remove function ' + (i + 1) + '">✕</button>'
          + (r.error ? '<div class="flg-fnerr">' + esc(r.error) + '</div>' : '')
          + '</div>';
      }).join('');
    }

    function paint() {
      const c = host.querySelector('.flg-fnchart');
      if (c) c.innerHTML = draw();
    }

    function render() {
      host.innerHTML = '<div class="flg flg--fn">'
        + '<div class="flg-fnside">'
        + '<div class="flg-fnrows">' + rowsHTML() + '</div>'
        + '<button type="button" class="flg-btn ghost" id="flgFnAdd">+ Another</button>'
        + '<div class="flg-fnrange">'
        + '<label>x from <input type="text" inputmode="decimal" id="flgFnLo" value="' + esc(st.view.xLo) + '" aria-label="x axis minimum"></label>'
        + '<label>to <input type="text" inputmode="decimal" id="flgFnHi" value="' + esc(st.view.xHi) + '" aria-label="x axis maximum"></label>'
        + '</div>'
        + '</div>'
        + '<div class="flg-fnchart"></div>'
        + '</div>';
      paint();
    }

    /* Bound to the host once rather than inside render(), so replacing the
       rows cannot leave a second set of listeners behind firing twice. */
    host.addEventListener('input', function (e) {
      const t = e.target;
      if (t.classList && t.classList.contains('flg-fnsrc')) {
        st.exprs[+t.dataset.i].src = t.value;
        save();
        // Repaint only — re-rendering the rows would steal focus mid-keystroke.
        paint();
        const row = t.closest('.flg-fnrow');
        const old = row.querySelector('.flg-fnerr');
        if (old) old.remove();
        const r = window.FluxExpr.tryCompile(t.value);
        if (r.error && t.value.trim()) {
          const d = document.createElement('div');
          d.className = 'flg-fnerr';
          d.textContent = r.error;
          row.appendChild(d);
        }
      } else if (t.classList && t.classList.contains('flg-fncol')) {
        st.exprs[+t.dataset.i].colour = t.value; save(); paint();
      } else if (t.id === 'flgFnLo' || t.id === 'flgFnHi') {
        const lo = parseFloat(host.querySelector('#flgFnLo').value);
        const hi = parseFloat(host.querySelector('#flgFnHi').value);
        // Ignore a half-typed range instead of collapsing the axis to nothing.
        if (Number.isFinite(lo) && Number.isFinite(hi) && hi > lo) {
          st.view.xLo = lo; st.view.xHi = hi; save(); paint();
        }
      }
    });

    host.addEventListener('click', function (e) {
      const del = e.target.closest ? e.target.closest('[data-del]') : null;
      if (del) {
        st.exprs.splice(+del.dataset.del, 1);
        if (!st.exprs.length) st.exprs.push({ src: '', colour: FN_COLOURS[0] });
        save(); render(); return;
      }
      if (e.target.id === 'flgFnAdd') {
        st.exprs.push({ src: '', colour: FN_COLOURS[st.exprs.length % FN_COLOURS.length] });
        save(); render();
        const boxes = host.querySelectorAll('.flg-fnsrc');
        if (boxes.length) boxes[boxes.length - 1].focus();
      }
    });

    render();
    return { render: render };
  }

  window.FluxGrapher = {
    mount: mount,
    mountFunctions: mountFunctions,
    INBOX_KEY: INBOX_KEY,
    WORKING_KEY: WORKING_KEY,
  };
})();
