/* ============================================================================
   FLUX GRAPHER · 3D  ·  flux-grapher-3d.js
   The Grapher's third mode: points, planes, lines and surfaces in space.

   Made for the CPM lessons that use technology.cpm.org's 3D graph — plotting
   (x, y, z) points, graphing planes like ax + by + cz = d from their
   intercepts and traces, and solving three equations in three unknowns by
   seeing where three planes meet. So a plane shows where it crosses the axes
   (labelled points), its traces on the coordinate planes at the flick of a
   switch, the line where it meets any other plane, and, with three planes,
   the point they share — or a sentence saying why there is none, or
   infinitely many.

   It works like the other two halves: one row per thing in the rail, the
   graph beside it, undo and redo, Save to a Flux account, a PNG for a report,
   a print, and a share link that rebuilds the graph and the view. Drag to
   turn it, scroll or pinch to zoom; the arrow keys and the buttons at the
   bottom left turn it too, and x, y and z look straight down an axis.

   Drawn on a canvas. flux-space3d.js does the maths — what a row means,
   where planes meet, the camera and the order to paint in so that what is in
   front hides what is behind; this file is the rows, the drawing and the
   interaction. Nothing here talks to the network: saving goes through
   flux-grapher-cloud.js like the 2D graphs, and only when Save is pressed.
   ========================================================================== */
(function () {
  'use strict';

  function S() { return window.FluxSpace3D; }
  function G() { return window.FluxGrapher || {}; }
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function toast(m, k) { if (G().toast) G().toast(m, k); }
  function readJSON(key, fallback) {
    try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; } catch (e) { return fallback; }
  }
  function writeJSON(key, v) { try { localStorage.setItem(key, JSON.stringify(v)); } catch (e) {} }
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function reducedMotion() {
    try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; }
  }

  const IMG_BG_KEY = 'flux_grapher_img_bg';      // shared with the 2D halves
  const PRINT_KEY = 'flux_grapher_print_mono';
  const HEX = /^#[0-9a-f]{6}$/i;
  const MESH = 28;                                // surface patches per side

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
    left: svgIcon('<path d="m15 6-6 6 6 6"/>'),
    right: svgIcon('<path d="m9 6 6 6-6 6"/>'),
    up: svgIcon('<path d="m6 15 6-6 6 6"/>'),
    down: svgIcon('<path d="m6 9 6 6 6-6"/>'),
    undo: svgIcon('<path d="M9 14 4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 0 10h-3"/>', 15),
    redo: svgIcon('<path d="m15 14 5-5-5-5"/><path d="M20 9H9a5 5 0 0 0 0 10h3"/>', 15),
    trash: svgIcon('<path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3"/>', 15),
    eye: svgIcon('<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>', 14),
    eyeOff: svgIcon('<path d="M3 3l18 18M10.6 5.1A10.4 10.4 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3.1 4M6.6 6.6C3.9 8.4 2 12 2 12s3.5 7 10 7a9.7 9.7 0 0 0 5.4-1.6"/>', 14),
    copy: svgIcon('<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 0 1 2-2h9"/>', 14),
    cube: svgIcon('<path d="M12 3 4 7.5v9L12 21l8-4.5v-9z"/><path d="M4 7.5 12 12l8-4.5M12 12v9"/>'),
    book: svgIcon('<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M4 19V5M9 7h6"/>', 15),
  };

  /* Colours for each background. On screen the page is the dark blue of the
     other halves; a saved image or a print can be white, the planner's own
     blue, or black, chosen in the same place as for the 2D graphs. */
  const INKS = {
    screen: { bg: null, halo: '#0a0f1c', text: '#eaf1ff', mut: '#9fb0cc', axis: 'rgba(226,236,255,.78)', grid: 'rgba(255,255,255,.09)',
      box: 'rgba(255,255,255,.17)', meet: '#ffffff', planeA: 0.3, surfA: 0.82, keyBg: 'rgba(10,14,26,.9)', keyLine: 'rgba(255,255,255,.14)', paper: false },
    white: { bg: '#ffffff', halo: '#ffffff', text: '#0f172a', mut: '#334155', axis: '#0f172a', grid: 'rgba(15,23,42,.16)',
      box: 'rgba(15,23,42,.28)', meet: '#000000', planeA: 0.3, surfA: 0.85, keyBg: '#ffffff', keyLine: '#94a3b8', paper: true },
    planner: { bg: '#0B0F1A', halo: '#0B0F1A', text: '#f1f5f9', mut: '#cbd5e1', axis: '#cbd5e1', grid: 'rgba(255,255,255,.12)',
      box: 'rgba(255,255,255,.2)', meet: '#ffffff', planeA: 0.32, surfA: 0.82, keyBg: '#121826', keyLine: 'rgba(255,255,255,.18)', paper: false },
    black: { bg: '#000000', halo: '#000000', text: '#ffffff', mut: '#e5e5e5', axis: '#e5e5e5', grid: '#262626',
      box: '#404040', meet: '#ffffff', planeA: 0.32, surfA: 0.82, keyBg: '#0a0a0a', keyLine: '#404040', paper: false },
  };

  function rgbOf(hex) { const n = parseInt(String(hex).slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; }
  function rgba(hex, a, k) {
    const c = rgbOf(hex).map((v) => Math.round(clamp(v * (k == null ? 1 : k), 0, 255)));
    return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')';
  }
  /** Pale colours darkened enough to print — the 2D grapher's rule. */
  function forPaper(hex) {
    const rgb = rgbOf(hex);
    const lin = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    const L = 0.2126 * lin(rgb[0]) + 0.7152 * lin(rgb[1]) + 0.0722 * lin(rgb[2]);
    if (L <= 0.22) return hex;
    const k = Math.sqrt(0.22 / L);
    return '#' + rgb.map((v) => Math.round(v * k).toString(16).padStart(2, '0')).join('');
  }

  /** Whether white text reads better than black on this colour. */
  function isDark(hex) {
    const c = rgbOf(hex);
    return 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2] < 140;
  }

  const FONT = "'Plus Jakarta Sans', system-ui, -apple-system, 'Segoe UI', sans-serif";
  const MONO = "'JetBrains Mono', ui-monospace, 'SF Mono', Menlo, monospace";
  const SERIF = "'Times New Roman', Georgia, serif";

  const EXAMPLES = [
    { label: 'A point', rows: ['A = (2, 3, 4)'] },
    { label: 'A plane', rows: ['2x + 3y + 6z = 12'] },
    { label: 'A line through two points', rows: ['line (0, 0, 0), (2, 4, 6)'] },
    { label: 'A line from a point, in a direction', rows: ['(1, 2, 3) + t(1, -1, 2)'] },
    { label: 'A surface', rows: ['z = x^2 - y^2'] },
    { label: 'Three planes that meet at a point', rows: ['x + y + z = 6', '2x - y + z = 3', 'x + 2y - z = 2'] },
    { label: 'Three planes with no point in common', rows: ['x + y = 1', 'x - y = 1', 'x = 3'] },
    { label: 'Three planes that share a line', rows: ['z = 0', 'y = 0', 'y = z'] },
  ];

  /* ══ The 3D grapher ════════════════════════════════════════════════════ */

  function Grapher3D(host, opts) {
    const o = opts || {};
    this.host = host;
    this.kind = '3d';
    this.surface = o.surface === 'planner' ? 'planner' : 'standalone';
    this.uid = 'fl3' + Math.random().toString(36).slice(2, 8);
    this.doc = S().blankDoc();
    this.cloud = null;
    this.dirty = false;
    this.listeners = {};
    this.cache = new Map();          // item id → { src, res }
    this.undoStack = [];
    this.redoStack = [];
    this.railHidden = false;
    this._scene = null;
    this.build();
  }
  const P = Grapher3D.prototype;

  P.on = function (ev, fn) { (this.listeners[ev] = this.listeners[ev] || []).push(fn); };
  P.emit = function (ev, arg) { (this.listeners[ev] || []).forEach((fn) => { try { fn(arg); } catch (e) {} }); };
  P.$ = function (suffix) { return document.getElementById(this.uid + suffix); };
  P.item = function (id) { return this.doc.items.find((i) => i.id === id) || null; };
  P.itemOf = function (el) {
    const box = el && el.closest ? el.closest('.flg-item') : null;
    return box ? this.item(box.dataset.id) : null;
  };
  P.parsed = function (it) {
    const c = this.cache.get(it.id);
    if (c && c.src === it.src) return c.res;
    let res;
    try { res = S().parseRow(it.src); } catch (e) { res = { error: 'That could not be read.' }; }
    this.cache.set(it.id, { src: it.src, res: res });
    return res;
  };

  /** Something about the graph changed (not merely where you are looking). */
  P.touch = function () {
    this.dirty = true;
    this._scene = null;
    clearTimeout(this._histT);
    this._histT = setTimeout(() => this.commitHistory(), 400);
    this.emit('change');
  };

  /* ── Undo and redo, as in the 2D halves ───────────────────────────────
     Turning and zooming are not edits, so the view is left out of history. */
  P.histJSON = function () {
    const d = Object.assign({}, this.doc);
    delete d.view;
    return JSON.stringify(d);
  };
  P.commitHistory = function () {
    const now = this.histJSON();
    if (this._snap != null && now !== this._snap) {
      this.undoStack.push(this._snap);
      if (this.undoStack.length > 100) this.undoStack.shift();
      this.redoStack = [];
    }
    this._snap = now;
    this.paintHistory();
  };
  P.stepHistory = function (back) {
    clearTimeout(this._histT);
    this.commitHistory();
    const from = back ? this.undoStack : this.redoStack;
    const to = back ? this.redoStack : this.undoStack;
    if (!from.length) return false;
    to.push(this._snap);
    const view = this.doc.view;
    const d = S().normaliseDoc(JSON.parse(from.pop()));
    d.view = view;
    this.doc = d;
    this._snap = this.histJSON();
    this.closePop();
    this.cache.clear();
    this._scene = null;
    this.renderItems();
    this.dirty = true;
    this.draw();
    this.paintHistory();
    this.emit('change');
    return true;
  };
  P.paintHistory = function () {
    const u = this.root && this.root.querySelector('[data-hist="undo"]');
    const r = this.root && this.root.querySelector('[data-hist="redo"]');
    if (u) u.disabled = !this.undoStack.length;
    if (r) r.disabled = !this.redoStack.length;
  };
  P.clearAll = function () {
    const blank = this.doc.items.every((i) => !String(i.src || '').trim()) && !this.doc.title;
    if (blank) { toast('Nothing to clear — the graph is already empty.'); return; }
    clearTimeout(this._histT);
    this.commitHistory();
    this.closePop();
    const view = this.doc.view;
    this.doc = S().blankDoc();
    this.doc.items = [S().blankItem(0, '')];
    this.doc.view = view;
    this.cloud = null;
    this.cache.clear();
    this._scene = null;
    this.renderItems();
    this.commitHistory();
    this.dirty = false;
    this.draw();
    this.emit('change');
    toast('Cleared. Undo brings it all back.');
  };

  P.closePop = function () { if (G().closePop) G().closePop(); };

  /* ── Layout ─────────────────────────────────────────────────────────── */

  P.build = function () {
    const u = this.uid;
    this.host.innerHTML = '<div class="flg flg--3d flg--' + this.surface + '" id="' + u + 'Root">'
      + '<aside class="flg-rail" id="' + u + 'Rail" aria-label="Points, planes, lines and surfaces">'
      +   '<div class="flg-items" id="' + u + 'Items"></div>'
      +   '<p class="fl3-hint">Type a point <b>(1, 2, 3)</b>, a plane <b>x + y + z = 6</b>, a line <b>line (0, 0, 0), (1, 2, 3)</b> or a surface <b>z = x^2 − y^2</b>.</p>'
      +   '<div class="flg-addbar">'
      +     '<button type="button" class="flg-add" data-add title="Add a row" aria-label="Add a row">' + ICON.plus + '<span class="fl3-glyph" aria-hidden="true">xyz</span></button>'
      +     '<button type="button" class="flg-add fl3-exbtn" data-examples title="Examples to start from" aria-label="Examples" aria-haspopup="menu">' + ICON.book + '<span>Examples</span></button>'
      +     '<span class="flg-hist">'
      +       '<button type="button" data-hist="undo" title="Undo (Ctrl+Z)" aria-label="Undo" disabled>' + ICON.undo + '</button>'
      +       '<button type="button" data-hist="redo" title="Redo (Ctrl+Shift+Z)" aria-label="Redo" disabled>' + ICON.redo + '</button>'
      +     '</span>'
      +     '<button type="button" class="flg-clear" data-clearall title="Clear everything and start again (Undo brings it back)" aria-label="Clear all">' + ICON.trash + '</button>'
      +   '</div>'
      + '</aside>'
      + '<section class="flg-stage" id="' + u + 'Stage" aria-label="3D graph">'
      +   '<div class="flg-plot fl3-plot" id="' + u + 'Plot" tabindex="0" role="application" aria-roledescription="3D graph"'
      +     ' aria-label="3D graph. Arrow keys turn it, plus and minus zoom, 0 resets the view, and x, y or z looks along that axis."'
      +     ' aria-describedby="' + u + 'Sum">'
      +     '<canvas class="fl3-canvas" id="' + u + 'Cv" aria-hidden="true"></canvas>'
      +   '</div>'
      +   '<p class="fl3-sr" id="' + u + 'Sum"></p>'
      +   '<div class="flg-trace" id="' + u + 'Trace" hidden><i></i><span></span></div>'
      +   '<div class="flg-results fl3-key" id="' + u + 'Key" hidden></div>'
      +   '<button type="button" class="flg-railbtn" data-tool="rail" title="Show or hide the list" aria-label="Show or hide the list">' + ICON.rail + '</button>'
      +   '<div class="fl3-viewpad" role="toolbar" aria-label="Turn the graph">'
      +     '<div class="fl3-presets" role="group" aria-label="Look along an axis">'
      +       '<button type="button" data-preset="x" title="Look along the x axis — the yz-plane" aria-label="Look along the x axis">x</button>'
      +       '<button type="button" data-preset="y" title="Look along the y axis — the xz-plane" aria-label="Look along the y axis">y</button>'
      +       '<button type="button" data-preset="z" title="Look down the z axis — the xy-plane" aria-label="Look down the z axis">z</button>'
      +       '<button type="button" data-preset="std" class="fl3-std" title="The standard 3D view" aria-label="Standard 3D view">' + ICON.cube + '</button>'
      +     '</div>'
      +     '<div class="fl3-turn" role="group" aria-label="Turn">'
      +       '<button type="button" data-turn="left" title="Turn left (←)" aria-label="Turn left">' + ICON.left + '</button>'
      +       '<button type="button" data-turn="up" title="Tilt up (↑)" aria-label="Tilt up">' + ICON.up + '</button>'
      +       '<button type="button" data-turn="down" title="Tilt down (↓)" aria-label="Tilt down">' + ICON.down + '</button>'
      +       '<button type="button" data-turn="right" title="Turn right (→)" aria-label="Turn right">' + ICON.right + '</button>'
      +     '</div>'
      +   '</div>'
      +   '<div class="flg-tools" role="toolbar" aria-label="View">'
      +     '<button type="button" data-tool="in" title="Zoom in" aria-label="Zoom in">' + ICON.plus + '</button>'
      +     '<button type="button" data-tool="out" title="Zoom out" aria-label="Zoom out">' + ICON.minus + '</button>'
      +     '<button type="button" data-tool="home" title="Reset the view" aria-label="Reset the view">' + ICON.home + '</button>'
      +     '<button type="button" data-tool="win" class="flg-tool-window" title="Ranges, title and grids" aria-label="Ranges, title and grids">' + ICON.window + '</button>'
      +   '</div>'
      + '</section>'
      + '</div>';
    this.root = this.$('Root');
    this.canvas = this.$('Cv');
    this.renderItems();
    this.wire();
    this.attachStage();
    this._snap = this.histJSON();
    const self = this;
    this._onKey = function (e) {
      if (!(e.metaKey || e.ctrlKey) || e.altKey) return;
      const k = (e.key || '').toLowerCase();
      if (k !== 'z' && k !== 'y') return;
      const a = document.activeElement;
      const inMath = !!(a && a.closest && a.closest('.flg-mq'));
      if (a && !inMath && (a.tagName === 'TEXTAREA' || (a.tagName === 'INPUT' && !a.readOnly && /^(text|search|)$/.test(a.type || '')))) return;
      if (self.surface === 'planner' && !(a && self.root.contains(a))) return;
      if (document.querySelector('.fgc-back, .fgt-layer')) return;
      if (self.stepHistory(k === 'z' && !e.shiftKey)) e.preventDefault();
    };
    document.addEventListener('keydown', this._onKey);
    this.draw();
  };

  /* ── The rail ───────────────────────────────────────────────────────── */

  P.rowHTML = function (it, n) {
    const p = this.parsed(it);
    const err = p && p.error && String(it.src || '').trim() ? '<div class="flg-err" role="alert">' + esc(p.error) + '</div>' : '';
    const T = G()._shared && G()._shared.typesetExpr;
    const h = T ? T(it.src) : '';
    return '<div class="flg-item flg-item--expr' + (it.hidden ? ' is-hidden' : '') + '" data-id="' + esc(it.id) + '">'
      + '<span class="flg-idx">' + (n + 1) + '</span>'
      + '<button type="button" class="flg-swatch" data-swatch="' + esc(it.id) + '" style="--c:' + it.colour + '"'
      + ' aria-label="Colour and visibility of row ' + (n + 1) + '" title="Colour and visibility"></button>'
      + '<input type="text" class="flg-expr" data-expr="' + esc(it.id) + '" value="' + esc(it.src) + '"'
      + ' placeholder="(1, 2, 3)  or  x + y + z = 6" spellcheck="false" autocomplete="off" autocapitalize="off"'
      + ' aria-label="Row ' + (n + 1) + '">'
      + '<span class="flg-math" aria-hidden="true">' + h + '</span>'
      + '<button type="button" class="flg-x" data-del="' + esc(it.id) + '" aria-label="Remove row ' + (n + 1) + '">' + ICON.x + '</button>'
      + err
      + '<div class="flg-info fl3-info">' + this.infoHTML(it, p) + '</div>'
      + '</div>';
  };

  /** Under a row: a plane's intercepts and traces, a line's equation, and
      the switches that go with them. */
  P.infoHTML = function (it, p) {
    if (!p || p.error || p.kind === 'empty') return '';
    const s = S(), box = this.doc.win;
    const chip = (key, on, label, title) => '<button type="button" class="flg-chip' + (on ? ' is-on' : '') + '" data-flag="' + key + '" aria-pressed="' + !!on + '" title="' + esc(title) + '">' + label + '</button>';
    let html = '';
    if (p.kind === 'plane') {
      const parts = s.intercepts(p).map((k) => (k.kind === 'point' ? '<span>' + k.axis + ': <b>' + esc(s.fmtPoint(k.p)) + '</b></span>'
        : k.kind === 'none' ? '<span>never meets the ' + k.axis + ' axis</span>' : '<span>contains the ' + k.axis + ' axis</span>'));
      html += '<div class="fl3-line"><span class="fl3-k">Intercepts</span> ' + parts.join(' ') + '</div>';
      if (it.traces) {
        html += s.traces(p).map((t) => '<div class="fl3-line"><span class="fl3-k">' + t.plane + '-trace</span> '
          + (t.kind === 'line' ? '<b>' + esc(t.text) + '</b>' : t.kind === 'same' ? 'it is the ' + t.plane + '-plane' : 'none — parallel to the ' + t.plane + '-plane')
          + '</div>').join('');
      }
      if (!s.planeInBox(p, box)) html += '<div class="fl3-line fl3-out">Outside the box — widen the ranges to see it.</div>';
      html += '<div class="flg-rtog">' + chip('icpt', it.icpt, 'intercepts', 'Show where the plane crosses the axes')
        + chip('traces', it.traces, 'traces', 'Show where the plane meets the xy-, xz- and yz-planes') + '</div>';
    } else if (p.kind === 'points') {
      const out = p.pts.filter((q) => !s.inBox(q.p, box)).length;
      if (p.pts.some((q, i) => !/^\s*[A-Za-z]*\s*[=:]?\s*\(\s*-?[\d.]+\s*,\s*-?[\d.]+\s*,\s*-?[\d.]+\s*\)/.test(i === 0 ? it.src : ''))) {
        html += '<div class="fl3-line">' + p.pts.slice(0, 6).map((q) => '<b>' + esc((q.label || '') + s.fmtPoint(q.p)) + '</b>').join(' ') + (p.pts.length > 6 ? ' …' : '') + '</div>';
      }
      if (out) html += '<div class="fl3-line fl3-out">' + (out === p.pts.length ? 'Outside the box' : out + ' outside the box') + ' — widen the ranges to see ' + (out === 1 ? 'it' : 'them') + '.</div>';
      html += '<div class="flg-rtog">' + chip('guides', it.guides, 'guides', 'Dashed lines showing how to reach the point: along x, then y, then up z') + '</div>';
    } else if (p.kind === 'line') {
      html += '<div class="fl3-line"><b>' + esc(s.lineText(p.p0, p.dir, p.param)) + '</b></div>';
      if (!s.lineInBox(p.p0, p.dir, box)) html += '<div class="fl3-line fl3-out">Outside the box — widen the ranges to see it.</div>';
    } else if (p.kind === 'surface') {
      html += '<div class="fl3-line fl3-mut">A surface: ' + p.axis + ' worked out from ' + (p.axis === 'z' ? 'x and y' : p.axis === 'y' ? 'x and z' : 'y and z') + '.</div>';
    }
    return html;
  };

  P.renderItems = function () {
    const box = this.$('Items');
    if (!box) return;
    box.innerHTML = this.doc.items.map((it, n) => this.rowHTML(it, n)).join('');
    this.mountMath();
    this.paintHint();
  };
  P.rerenderRowInfo = function (it) {
    const el = this.root.querySelector('.flg-item[data-id="' + CSS.escape(it.id) + '"]');
    if (!el) return;
    const p = this.parsed(it);
    const old = el.querySelector('.flg-err');
    if (old) old.remove();
    if (p && p.error && String(it.src || '').trim()) {
      const d = document.createElement('div');
      d.className = 'flg-err';
      d.setAttribute('role', 'alert');
      d.textContent = p.error;
      el.insertBefore(d, el.querySelector('.fl3-info'));
    }
    const info = el.querySelector('.fl3-info');
    const html = this.infoHTML(it, p);
    if (info && info.dataset.html !== html) { info.dataset.html = html; info.innerHTML = html; }
  };
  P.paintHint = function () {
    const h = this.root && this.root.querySelector('.fl3-hint');
    if (h) h.hidden = this.doc.items.filter((i) => String(i.src || '').trim()).length > 1;
  };

  /* The maths field (flux-mathfield.js), as in the Functions half: the text
     box stays as the source of truth, hidden, and every edit goes through it. */
  P.mountMath = function () {
    const MF = window.FluxMathField;
    if (!MF || !this.root) return;
    if (!MF.ready()) {
      if (!this._mathWait) {
        this._mathWait = MF.load().then((ok) => {
          this._mathWait = null;
          if (ok && this.root && this.root.isConnected) this.mountMath();
        });
      }
      return;
    }
    this.root.querySelectorAll('.flg-item--expr:not(.has-mq)').forEach((row) => {
      const id = row.dataset.id;
      const input = row.querySelector('.flg-expr');
      const it = this.item(id);
      if (!input || !it) return;
      const host = document.createElement('span');
      host.className = 'flg-mq';
      input.after(host);
      const self = this;
      const mf = MF.create(host, {
        edit: (latex) => self.mathEdited(id, latex),
        enter: () => self.rowEnter(id),
        up: () => self.focusStep(id, -1),
        down: () => self.focusStep(id, 1),
        deleteOut: () => self.deleteEmpty(id),
      });
      if (!mf) { host.remove(); return; }
      MF.set(mf, it.tex && MF.toPlain(it.tex) === it.src ? it.tex : MF.toLatex(it.src));
      input._mf = mf;
      input.tabIndex = -1;
      input.setAttribute('aria-hidden', 'true');
      const ta = host.querySelector('textarea');
      if (ta) ta.setAttribute('aria-label', input.getAttribute('aria-label') || 'Row');
      row.classList.add('has-mq');
      if (document.activeElement === input) { mf.focus(); mf.moveToRightEnd(); }
    });
  };
  P.mathEdited = function (id, latex) {
    const it = this.item(id);
    const input = this.root && this.root.querySelector('[data-expr="' + CSS.escape(id) + '"]');
    if (!it || !input) return;
    const plain = window.FluxMathField.toPlain(latex);
    if (input.value === plain) return;
    it.tex = latex;
    input.value = plain;
    input._fromMath = true;
    try { input.dispatchEvent(new Event('input', { bubbles: true })); } finally { input._fromMath = false; }
  };
  P.focusRow = function (id) {
    const inp = this.root && this.root.querySelector('[data-expr="' + CSS.escape(id) + '"]');
    if (!inp) return false;
    if (inp._mf) { inp._mf.focus(); inp._mf.moveToRightEnd(); } else inp.focus();
    return true;
  };
  P.rowEnter = function (id) {
    const i = this.doc.items.findIndex((x) => x.id === id);
    const nxt = this.doc.items[i + 1];
    if (nxt) this.focusRow(nxt.id); else this.addItem('');
  };
  P.focusStep = function (id, dir) {
    const i = this.doc.items.findIndex((x) => x.id === id);
    const to = this.doc.items[i + dir];
    if (to) this.focusRow(to.id);
  };
  P.deleteEmpty = function (id) {
    const it = this.item(id);
    if (!it || String(it.src || '').trim() || this.doc.items.length < 2) return;
    const k = this.doc.items.indexOf(it);
    const back = this.doc.items[k - 1] || this.doc.items[k + 1];
    this.removeItem(id);
    if (back) this.focusRow(back.id);
  };

  P.addItem = function (src, focus) {
    if (this.doc.items.length >= 40) { toast('A 3D graph can have up to 40 rows.', 'warning'); return null; }
    const it = S().blankItem(this.doc.items.length, src || '');
    this.doc.items.push(it);
    this.touch();
    this.renderItems();
    this.draw();
    if (focus !== false) {
      this.focusRow(it.id);
      const row = this.root.querySelector('.flg-item[data-id="' + CSS.escape(it.id) + '"]');
      if (row) row.scrollIntoView({ block: 'nearest' });
    }
    return it;
  };
  P.removeItem = function (id) {
    const i = this.doc.items.findIndex((x) => x.id === id);
    if (i < 0) return;
    this.doc.items.splice(i, 1);
    this.cache.delete(id);
    if (!this.doc.items.length) this.doc.items.push(S().blankItem(0, ''));
    this.touch();
    this.renderItems();
    this.draw();
  };
  P.addExample = function (ex) {
    // An empty first row is replaced rather than left above the example.
    if (this.doc.items.length === 1 && !String(this.doc.items[0].src || '').trim()) this.doc.items = [];
    const room = 40 - this.doc.items.length;
    ex.rows.slice(0, room).forEach((src) => this.doc.items.push(S().blankItem(this.doc.items.length, src)));
    this.touch();
    this.renderItems();
    this.draw();
  };

  P.swatchPop = function (it, anchor) {
    const self = this;
    const pal = S().PALETTE;
    const html = '<div class="flg-swpop">'
      + '<div class="flg-swrow">' + pal.map((c) => '<button type="button" class="flg-swdot' + (c === it.colour ? ' is-on' : '')
        + '" data-c="' + c + '" style="--c:' + c + '" aria-label="Colour ' + c + '"></button>').join('')
      + '<label class="flg-swcustom" title="Any colour"><input type="color" value="' + it.colour + '" aria-label="Any colour"></label></div>'
      + '<div class="flg-swopts"><button type="button" class="flg-swopt" data-vis>' + (it.hidden ? ICON.eyeOff : ICON.eye)
      + '<span>' + (it.hidden ? 'Hidden' : 'Shown') + '</span></button></div></div>';
    const apply = () => { self.touch(); self.renderItems(); self.draw(); };
    G().openPop(anchor, html, (el) => {
      el.addEventListener('click', (e) => {
        const dot = e.target.closest('[data-c]');
        if (dot) { it.colour = dot.dataset.c; self.closePop(); apply(); return; }
        if (e.target.closest('[data-vis]')) { it.hidden = !it.hidden; self.closePop(); apply(); }
      });
      el.querySelector('input[type=color]').addEventListener('input', (e) => {
        if (!HEX.test(e.target.value)) return;
        it.colour = e.target.value.toLowerCase();
        const sw = self.root.querySelector('[data-swatch="' + CSS.escape(it.id) + '"]');
        if (sw) sw.style.setProperty('--c', it.colour);
        self.touch();
        self.draw();
      });
    });
  };

  P.examplesMenu = function (anchor) {
    const self = this;
    const html = '<div class="flg-menu" role="menu">' + EXAMPLES.map((ex, i) => '<button type="button" role="menuitem" class="flg-menu-i" data-ex="' + i + '">'
      + '<span>' + esc(ex.label) + '<small class="fl3-exsrc">' + esc(ex.rows.join('   ')) + '</small></span></button>').join('') + '</div>';
    G().openPop(anchor, html, (el) => {
      el.classList.add('fl3-expop');
      el.addEventListener('click', (e) => {
        const b = e.target.closest('[data-ex]');
        if (!b) return;
        self.closePop();
        self.addExample(EXAMPLES[+b.dataset.ex]);
      });
      const first = el.querySelector('button');
      if (first) first.focus();
    });
  };

  P.wire = function () {
    const self = this, root = this.root;
    root.addEventListener('input', (e) => {
      const t = e.target, d = t.dataset || {};
      if (!d.expr) return;
      const it = self.item(d.expr);
      if (!it) return;
      it.src = t.value.slice(0, 600);
      if (!t._fromMath) {
        delete it.tex;
        if (t._mf) window.FluxMathField.set(t._mf, window.FluxMathField.toLatex(it.src));
      }
      const row = t.closest('.flg-item');
      if (row && !row.classList.contains('has-mq')) {
        const T = G()._shared && G()._shared.typesetExpr;
        const m = row.querySelector('.flg-math');
        if (m && T) m.innerHTML = T(t.value);
      }
      self.rerenderRowInfo(it);
      self.paintHint();
      self.touch();
      self.draw();
    });
    root.addEventListener('keydown', (e) => {
      const d = e.target.dataset || {};
      if (d.expr && e.key === 'Enter') { e.preventDefault(); self.rowEnter(d.expr); }
    });
    root.addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b || !root.contains(b)) return;
      const d = b.dataset;
      if (b.hasAttribute('data-add')) { self.addItem(''); return; }
      if (b.hasAttribute('data-examples')) { self.examplesMenu(b); return; }
      if (d.del) { self.removeItem(d.del); return; }
      if (d.swatch) { const it = self.item(d.swatch); if (it) self.swatchPop(it, b); return; }
      if (d.hist) { self.stepHistory(d.hist === 'undo'); return; }
      if (b.hasAttribute('data-clearall')) { self.clearAll(); return; }
      if (d.tool) { self.tool(d.tool, b); return; }
      if (d.turn) { self.turn(d.turn, 15); return; }
      if (d.preset) { self.preset(d.preset); return; }
      if (d.keytoggle != null) {
        if (self._autoFold) { self._autoFold = false; self.doc.win.key = true; } else self.doc.win.key = !self.doc.win.key;
        self._keyHTML = null;
        self.renderKey();
        return;
      }
      if (d.keycopy != null) { self.copyKey(); return; }
      if (d.flag) {
        const it = self.itemOf(b);
        if (!it) return;
        it[d.flag] = !it[d.flag];
        self.touch();
        self.rerenderRowInfo(it);
        self.draw();
      }
    });
  };

  /* ── The view ───────────────────────────────────────────────────────── */

  P.setView = function (v, animate) {
    const s = S();
    const to = {
      yaw: s.wrapYaw(v.yaw != null ? v.yaw : this.doc.view.yaw),
      pitch: clamp(v.pitch != null ? v.pitch : this.doc.view.pitch, -90, 90),
      zoom: clamp(v.zoom != null ? v.zoom : this.doc.view.zoom, 0.2, 20),
    };
    if (this._anim) { cancelAnimationFrame(this._anim); this._anim = 0; }
    /* A short glide to a preset, so you can see which way the graph turned —
       instant when the system asks for less motion. Nothing ever moves on
       its own. */
    if (!animate || reducedMotion()) { this.doc.view = to; this.draw(); return; }
    const from = Object.assign({}, this.doc.view);
    let dy = to.yaw - from.yaw;
    if (dy > 180) dy -= 360;
    if (dy < -180) dy += 360;
    const t0 = performance.now(), dur = 320;
    const step = (now) => {
      const k = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - k, 3);
      this.doc.view = {
        yaw: s.wrapYaw(from.yaw + dy * e), pitch: from.pitch + (to.pitch - from.pitch) * e,
        zoom: from.zoom + (to.zoom - from.zoom) * e,
      };
      this._drawNow();
      this._anim = k < 1 ? requestAnimationFrame(step) : 0;
      if (k >= 1) this.doc.view = to;
    };
    this._anim = requestAnimationFrame(step);
  };
  P.turn = function (dir, deg) {
    const v = this.doc.view, d = deg || 5;
    if (dir === 'left') this.setView({ yaw: v.yaw + d });
    else if (dir === 'right') this.setView({ yaw: v.yaw - d });
    else if (dir === 'up') this.setView({ pitch: v.pitch - d });
    else if (dir === 'down') this.setView({ pitch: v.pitch + d });
  };
  P.preset = function (name) {
    const p = S().PRESETS[name];
    if (p) this.setView({ yaw: p.yaw, pitch: p.pitch }, true);
  };
  P.resetView = function () { this.setView(Object.assign({}, S().DEFAULT_VIEW), true); };
  P.tool = function (name, btn) {
    if (name === 'rail') {
      this.railHidden = !this.railHidden;
      this.root.classList.toggle('is-railless', this.railHidden);
      this.draw();
      return;
    }
    if (name === 'home') { this.resetView(); return; }
    if (name === 'win') { this.windowPop(btn); return; }
    if (name === 'in' || name === 'out') this.setView({ zoom: this.doc.view.zoom * (name === 'in' ? 1.25 : 0.8) });
  };

  /* ── Ranges, title and grids ────────────────────────────────────────── */

  P.windowPop = function (anchor) {
    const self = this, d = this.doc, w = d.win;
    const r = (n) => String(Number(n.toPrecision(6)));
    const row = (ax) => '<div class="flg-wrow"><span class="flg-wax">' + ax + '</span>'
      + '<input type="text" inputmode="decimal" data-wn="' + ax + 'Min" value="' + r(w[ax + 'Min']) + '" aria-label="' + ax + ' minimum">'
      + '<span class="flg-wto">to</span>'
      + '<input type="text" inputmode="decimal" data-wn="' + ax + 'Max" value="' + r(w[ax + 'Max']) + '" aria-label="' + ax + ' maximum"></div>';
    const flag = (k, label) => '<label><input type="checkbox" data-wf="' + k + '"' + (w[k] ? ' checked' : '') + '> ' + label + '</label>';
    const html = '<div class="flg-win">'
      + '<input type="text" class="flg-wtitle" data-wd="title" value="' + esc(d.title) + '" placeholder="Graph title" aria-label="Graph title">'
      + row('x') + row('y') + row('z')
      + '<div class="flg-wflags">'
      + flag('gridXY', 'Grid on the xy-plane') + flag('gridXZ', 'xz-plane') + flag('gridYZ', 'yz-plane')
      + flag('box', 'Box') + flag('equal', 'Same scale on every axis')
      + '</div></div>';
    G().openPop(anchor, html, (el) => {
      el.addEventListener('input', (e) => {
        const t = e.target, ds = t.dataset;
        if (ds.wd) { d.title = t.value.slice(0, 120); self.touch(); self.draw(); return; }
        if (!ds.wn) return;
        const ax = ds.wn[0];
        const num = (s) => { const x = Number(String(s).trim().replace(/^−/, '-')); return Number.isFinite(x) ? x : NaN; };
        const lo = num(el.querySelector('[data-wn="' + ax + 'Min"]').value);
        const hi = num(el.querySelector('[data-wn="' + ax + 'Max"]').value);
        // A half-typed range is ignored rather than collapsing the box.
        if (!(hi > lo) || hi - lo < 1e-6 || hi - lo > 1e7 || Math.abs(lo) > 1e7 || Math.abs(hi) > 1e7) return;
        w[ax + 'Min'] = lo;
        w[ax + 'Max'] = hi;
        self.touch();
        self.renderItems();
        self.draw();
      });
      el.addEventListener('change', (e) => {
        const f = e.target.dataset.wf;
        if (!f) return;
        w[f] = e.target.checked;
        self.touch();
        self.draw();
      });
    });
  };

  /* ── The scene: everything there is to draw, in the graph's own units ──
     Rebuilt only when the graph changes; turning it just repaints. */

  P.scene = function () {
    if (this._scene) return this._scene;
    const s = S(), d = this.doc, box = d.win;
    const size = s.boxSize(box);
    const items = [], labels = [], planes = [], tags = [], picks = [];
    const lo = [box.xMin, box.yMin, box.zMin], hi = [box.xMax, box.yMax, box.zMax];
    const o = [0, 1, 2].map((i) => clamp(0, lo[i], hi[i]));
    const AX = ['x', 'y', 'z'];

    // Grids, the box and the axes.
    const step = [0, 1, 2].map((i) => s.niceStep(hi[i] - lo[i], 10));
    const grid = (k, a, b) => {
      // Lines across the coordinate plane where coordinate k is fixed.
      s.ticks(lo[a], hi[a], step[a]).forEach((v) => {
        const p = o.slice(), q = o.slice();
        p[a] = v; q[a] = v; p[b] = lo[b]; q[b] = hi[b]; p[k] = o[k]; q[k] = o[k];
        s.pieces(p, q, 10, { role: 'grid' }).forEach((x) => items.push(x));
      });
      s.ticks(lo[b], hi[b], step[b]).forEach((v) => {
        const p = o.slice(), q = o.slice();
        p[b] = v; q[b] = v; p[a] = lo[a]; q[a] = hi[a];
        s.pieces(p, q, 10, { role: 'grid' }).forEach((x) => items.push(x));
      });
    };
    if (box.gridXY) grid(2, 0, 1);
    if (box.gridXZ) grid(1, 0, 2);
    if (box.gridYZ) grid(0, 1, 2);
    if (box.box) {
      for (let i = 0; i < 3; i++) {
        const j = (i + 1) % 3, k = (i + 2) % 3;
        [[lo, lo], [hi, lo], [lo, hi], [hi, hi]].forEach((c) => {
          const p = [0, 0, 0], q = [0, 0, 0];
          p[i] = lo[i]; q[i] = hi[i]; p[j] = q[j] = c[0][j]; p[k] = q[k] = c[1][k];
          s.pieces(p, q, 8, { role: 'box' }).forEach((x) => items.push(x));
        });
      }
    }
    const axisTicks = [];
    for (let i = 0; i < 3; i++) {
      const p = o.slice(), q = o.slice();
      p[i] = lo[i]; q[i] = hi[i];
      s.pieces(p, q, 24, { role: 'axis' }).forEach((x) => items.push(x));
      const end = o.slice();
      end[i] = hi[i];
      labels.push({ kind: 'axisname', p: end, text: AX[i], axis: i });
      const ts = s.ticks(lo[i], hi[i], step[i]).filter((v) => Math.abs(v - o[i]) > step[i] * 1e-6 && Math.abs(v - hi[i]) > step[i] * 1e-6);
      axisTicks.push({ axis: i, at: ts.map((v) => { const t = o.slice(); t[i] = v; return { p: t, text: s.fmtNum(v), k: Math.round(v / step[i]) }; }) });
    }

    // The rows.
    const rows = d.items.map((it, n) => ({ it: it, n: n + 1, p: this.parsed(it) }));
    rows.forEach((r) => {
      const it = r.it, p = r.p;
      if (it.hidden || !p || p.error || p.kind === 'empty') return;
      const colour = it.colour;
      if (p.kind === 'plane') {
        const poly = s.planeInBox(p, box);
        planes.push({ n: r.n, colour: colour, pl: p, poly: poly });
        if (poly) {
          items.push({ t: 'poly', role: 'plane', pts: poly.pts, edges: poly.edges, plane: p, colour: colour });
          tags.push({ kind: 'plane', n: r.n, colour: colour, pts: poly.pts });
        }
        if (it.icpt) {
          s.intercepts(p).forEach((k) => {
            if (k.kind !== 'point' || !s.inBox(k.p, box, 1e-6)) return;
            items.push({ t: 'dot', role: 'icpt', p: k.p, colour: colour, r: 4.2 });
            labels.push({ kind: 'icpt', p: k.p, text: s.fmtPoint(k.p), colour: colour });
            picks.push({ p: k.p, text: s.fmtPoint(k.p), what: k.axis + '-intercept of ' + r.n, colour: colour });
          });
        }
        if (it.traces) {
          s.traces(p).forEach((t) => {
            if (t.kind !== 'line') return;
            const seg = s.lineInBox(t.p, t.dir, box);
            if (seg) s.pieces(seg[0], seg[1], 16, { role: 'trace', colour: colour, a0: seg[0] }).forEach((x) => items.push(x));
          });
        }
      } else if (p.kind === 'points') {
        p.pts.forEach((q) => {
          if (!s.inBox(q.p, box, 1e-6)) return;
          items.push({ t: 'dot', role: 'point', p: q.p, colour: colour, r: 5.5 });
          const text = (q.label ? q.label : '') + s.fmtPoint(q.p);
          labels.push({ kind: 'point', p: q.p, text: text, colour: colour });
          picks.push({ p: q.p, text: s.fmtPoint(q.p), what: q.label ? 'point ' + q.label : 'point in row ' + r.n, colour: colour });
          if (it.guides) {
            const foot = [q.p[0], q.p[1], o[2]];
            const gx = [q.p[0], o[1], o[2]], gy = [o[0], q.p[1], o[2]];
            [[foot, q.p], [gx, foot], [gy, foot]].forEach((sg) => {
              if (s.len(s.sub(sg[1], sg[0])) > size * 1e-6) s.pieces(sg[0], sg[1], 6, { role: 'guide', colour: colour, a0: sg[0] }).forEach((x) => items.push(x));
            });
          }
        });
      } else if (p.kind === 'line') {
        const seg = s.lineInBox(p.p0, p.dir, box);
        if (seg) {
          s.pieces(seg[0], seg[1], 24, { role: 'line', colour: colour }).forEach((x) => items.push(x));
          tags.push({ kind: 'line', n: r.n, colour: colour, pts: seg });
        }
        (p.through || []).forEach((q) => {
          if (!s.inBox(q, box, 1e-6)) return;
          items.push({ t: 'dot', role: 'point', p: q, colour: colour, r: 4.5 });
          picks.push({ p: q, text: s.fmtPoint(q), what: 'on the line in row ' + r.n, colour: colour });
        });
      } else if (p.kind === 'surface') {
        const mesh = s.surfaceMesh(p, box, MESH);
        mesh.forEach((m) => items.push({ t: 'poly', role: 'surf', pts: m.pts, edges: m.edges, colour: colour }));
        if (mesh.length) {
          const pts = [];
          mesh.forEach((m) => { pts.push(m.pts[0]); });
          tags.push({ kind: 'surf', n: r.n, colour: colour, pts: pts });
        }
      }
    });

    // Where the planes meet.
    const meet = { pairs: [], all: null, planes: planes };
    for (let i = 0; i < planes.length; i++) {
      for (let j = i + 1; j < planes.length; j++) {
        const m = s.meet2(planes[i].pl, planes[j].pl);
        meet.pairs.push({ a: planes[i], b: planes[j], m: m });
        if (m.kind === 'line') {
          const seg = s.lineInBox(m.p, m.dir, box);
          if (seg) {
            s.pieces(seg[0], seg[1], 24, { role: 'meet' }).forEach((x) => items.push(x));
            tags.push({ kind: 'meet', text: planes[i].n + '∩' + planes[j].n, pts: seg });
          }
        }
      }
    }
    if (planes.length >= 3) {
      meet.all = s.meetAll(planes.map((q) => q.pl));
      if (meet.all && meet.all.kind === 'point' && s.inBox(meet.all.p, box, 1e-6)) {
        items.push({ t: 'dot', role: 'meetpt', p: meet.all.p, r: 6.5 });
        labels.push({ kind: 'meetpt', p: meet.all.p, text: s.fmtPoint(meet.all.p) });
        picks.push({ p: meet.all.p, text: s.fmtPoint(meet.all.p), what: 'where the planes meet', colour: '#ffffff' });
      }
    }

    const tree = s.planeTree(items.filter((x) => x.role === 'plane'), box);
    this._scene = {
      box: box, tree: tree, items: items.filter((x) => x.role !== 'plane'),
      labels: labels, tags: tags, ticks: axisTicks, picks: picks, meet: meet, rows: rows, planes: planes,
    };
    return this._scene;
  };

  /* ── Painting ───────────────────────────────────────────────────────── */

  P.draw = function () {
    if (this._raf) return;
    this._raf = requestAnimationFrame(() => { this._raf = 0; clearTimeout(this._drawT); this._drawNow(); });
    clearTimeout(this._drawT);
    // A hidden tab never runs rAF; the timer makes sure the graph still appears.
    this._drawT = setTimeout(() => {
      if (this._raf) { cancelAnimationFrame(this._raf); this._raf = 0; this._drawNow(); }
    }, 120);
  };

  P._drawNow = function () {
    const plot = this.$('Plot'), cv = this.canvas;
    if (!plot || !cv) return;
    const W = Math.round(plot.clientWidth), H = Math.round(plot.clientHeight);
    if (W < 20 || H < 20) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    // Resized and repainted in the same frame, so it never shows blank.
    if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) {
      cv.width = Math.round(W * dpr);
      cv.height = Math.round(H * dpr);
    }
    const ctx = cv.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    this._last = this.paint(ctx, W, H, INKS.screen, { screen: true });
    this.renderKey();
    this.paintSummary();
  };

  /**
   * Paint the graph onto a 2D context W × H. ink is one of INKS; opts:
   *   screen   true on the page (the key is an HTML card there)
   *   mono     every colour as black, for a black-and-white printer
   *   scale    text and line size, for big images
   * Returns what the pointer needs: the camera and the points it can hover.
   */
  P.paint = function (ctx, W, H, ink, opts) {
    const o = opts || {};
    const s = S(), sc = this.scene(), d = this.doc;
    const f = o.scale || 1;
    const titleH = !o.screen && d.title ? 44 * f : 0;
    const keyLines = !o.screen && d.win.key ? this.keyLines() : [];
    if (ink.bg) { ctx.fillStyle = ink.bg; ctx.fillRect(0, 0, W, H); }
    ctx.save();
    ctx.translate(0, titleH);
    const cam = s.camera(sc.box, d.view, W, H - titleH, d.win.equal);
    const P2 = (p) => cam.project(p);
    const col = (c) => (o.mono ? (ink.paper ? '#000000' : '#ffffff') : ink.paper ? forPaper(c) : c);
    const fill = (c) => (o.mono ? (ink.paper ? '#000000' : '#ffffff') : c);
    const lightDir = s.unit(s.add(s.mul(cam.e, 0.75), s.add(s.mul(cam.u, 0.55), s.mul(cam.r, -0.3))));

    const order = s.sceneOrder(sc.tree, sc.items, cam.g, sc.box);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    order.forEach((it) => {
      if (it.t === 'poly') {
        const pts = it.pts.map(P2);
        ctx.beginPath();
        pts.forEach((q, i) => (i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1])));
        ctx.closePath();
        if (it.role === 'plane') {
          ctx.fillStyle = o.mono ? 'rgba(' + (ink.paper ? '0,0,0' : '255,255,255') + ',.1)' : rgba(it.colour, ink.planeA);
          ctx.fill();
          ctx.strokeStyle = col(it.colour);
          ctx.lineWidth = 1.6 * f;
          ctx.beginPath();
          it.edges.forEach((e, i) => {
            if (!e) return;
            const a = pts[i], b = pts[(i + 1) % pts.length];
            ctx.moveTo(a[0], a[1]);
            ctx.lineTo(b[0], b[1]);
          });
          ctx.stroke();
        } else {
          const n = s.unit(s.cross(s.sub(it.pts[1], it.pts[0]), s.sub(it.pts[2], it.pts[0])));
          const lit = 0.5 + 0.55 * Math.abs(s.dot(n, lightDir));
          ctx.fillStyle = o.mono ? 'rgba(128,128,128,' + (0.25 + 0.5 * lit).toFixed(3) + ')' : rgba(it.colour, ink.surfA, lit);
          ctx.fill();
          ctx.strokeStyle = o.mono ? 'rgba(0,0,0,.35)' : rgba(it.colour, 0.55, 0.55);
          ctx.lineWidth = 0.6 * f;
          ctx.stroke();
        }
      } else if (it.t === 'seg') {
        const a = P2(it.a), b = P2(it.b);
        const st = this.segStyle(it, ink, col, f);
        ctx.strokeStyle = st.c;
        ctx.lineWidth = st.w;
        if (st.dash) {
          ctx.setLineDash(st.dash);
          ctx.lineDashOffset = it.a0 ? -Math.hypot(a[0] - P2(it.a0)[0], a[1] - P2(it.a0)[1]) : 0;
        }
        ctx.beginPath();
        ctx.moveTo(a[0], a[1]);
        ctx.lineTo(b[0], b[1]);
        ctx.stroke();
        if (st.dash) ctx.setLineDash([]);
      } else if (it.t === 'dot') {
        const q = P2(it.p);
        ctx.beginPath();
        ctx.arc(q[0], q[1], it.r * f, 0, Math.PI * 2);
        if (it.role === 'meetpt') {
          ctx.fillStyle = ink.meet;
          ctx.fill();
          ctx.lineWidth = 2.5 * f;
          ctx.strokeStyle = ink.halo;
          ctx.stroke();
          ctx.beginPath();
          ctx.arc(q[0], q[1], (it.r + 4.5) * f, 0, Math.PI * 2);
          ctx.lineWidth = 2 * f;
          ctx.strokeStyle = ink.meet;
          ctx.stroke();
        } else {
          ctx.fillStyle = fill(it.colour);
          ctx.fill();
          ctx.lineWidth = 1.6 * f;
          ctx.strokeStyle = ink.halo;
          ctx.stroke();
        }
      }
    });

    /* Words go on top of everything, so a label behind a plane can still
       be read — the dot it belongs to is where the depth shows. */
    const text = (str, x, y, font, colour, align, base) => {
      ctx.font = font;
      ctx.textAlign = align || 'left';
      ctx.textBaseline = base || 'alphabetic';
      ctx.lineWidth = 3.5 * f;
      ctx.strokeStyle = ink.halo;
      ctx.strokeText(str, x, y);
      ctx.fillStyle = colour;
      ctx.fillText(str, x, y);
    };
    const origin = P2([clamp(0, sc.box.xMin, sc.box.xMax), clamp(0, sc.box.yMin, sc.box.yMax), clamp(0, sc.box.zMin, sc.box.zMax)]);
    /* Labels that would overlap are left out rather than piled up: the
       point where the planes meet first, then points, then intercepts, then
       the axis numbers. Every one left out still shows on hover. */
    const placed = [];
    const place = (str, x, y, font, colour, align, base) => {
      ctx.font = font;
      const w = ctx.measureText(str).width, h = parseFloat(/(\d+(?:\.\d+)?)px/.exec(font)[1]);
      const left = align === 'center' ? x - w / 2 : x;
      const top = base === 'middle' ? y - h / 2 : y - h * 0.8;
      const r = [left - 2, top - 1, left + w + 2, top + h + 1];
      if (placed.some((q) => r[0] < q[2] && r[2] > q[0] && r[1] < q[3] && r[3] > q[1])) return false;
      placed.push(r);
      text(str, x, y, font, colour, align, base);
      return true;
    };
    // Each plane, line and surface wears its row number, so nothing depends on colour alone.
    sc.tags.forEach((t) => {
      const pts = t.pts.map(P2);
      let at;
      if (t.kind === 'plane') {
        const cx = pts.reduce((a, p) => a + p[0], 0) / pts.length, cy = pts.reduce((a, p) => a + p[1], 0) / pts.length;
        const top = pts.reduce((a, p) => (p[1] < a[1] ? p : a));
        at = [top[0] + (cx - top[0]) * 0.22, top[1] + (cy - top[1]) * 0.22];
      } else if (t.kind === 'surf') {
        at = pts.reduce((a, p) => (p[1] < a[1] ? p : a));
      } else {
        const end = pts[0][0] > pts[1][0] ? pts[0] : pts[1], other = end === pts[0] ? pts[1] : pts[0];
        const L = Math.hypot(end[0] - other[0], end[1] - other[1]) || 1;
        at = [end[0] - (end[0] - other[0]) / L * 22 * f, end[1] - (end[1] - other[1]) / L * 22 * f];
      }
      const label = t.text || String(t.n);
      ctx.font = '800 ' + (11 * f) + 'px ' + FONT;
      const w = ctx.measureText(label).width + 10 * f, h = 17 * f;
      const x = clamp(at[0] - w / 2, 2, W - w - 2), y = clamp(at[1] - h / 2, 2, H - titleH - h - 2);
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(x, y, w, h, 5 * f); else ctx.rect(x, y, w, h);
      const bgc = t.kind === 'meet' ? ink.meet : o.mono ? (ink.paper ? '#000000' : '#ffffff') : col(t.colour);
      ctx.fillStyle = bgc;
      ctx.fill();
      ctx.fillStyle = isDark(bgc) ? '#ffffff' : '#0b0d12';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, x + w / 2, y + h / 2 + 0.5 * f);
      placed.push([x - 2, y - 2, x + w + 2, y + h + 2]);
    });
    const rank = { meetpt: 0, point: 1, icpt: 2 };
    sc.labels.filter((l) => l.kind !== 'axisname').sort((a, b) => rank[a.kind] - rank[b.kind]).forEach((l) => {
      const q = P2(l.p);
      if (l.kind === 'meetpt') place(l.text, q[0] + 12 * f, q[1] - 12 * f, '800 ' + (14 * f) + 'px ' + MONO, ink.meet);
      else if (l.kind === 'point') place(l.text, q[0] + 9 * f, q[1] - 9 * f, '700 ' + (13 * f) + 'px ' + MONO, o.mono ? ink.text : col(l.colour));
      else place(l.text, q[0] + 7 * f, q[1] - 7 * f, '600 ' + (11 * f) + 'px ' + MONO, o.mono ? ink.text : col(l.colour));
    });
    // Ticks: a short mark across the axis and its number, spaced so they never crowd.
    sc.ticks.forEach((tk) => {
      if (!tk.at.length) return;
      const dir = cam.dir2d([tk.axis === 0 ? 1 : 0, tk.axis === 1 ? 1 : 0, tk.axis === 2 ? 1 : 0]);
      const a = P2(tk.at[0].p), b = P2(tk.at[tk.at.length > 1 ? 1 : 0].p);
      const gap = tk.at.length > 1 ? Math.hypot(b[0] - a[0], b[1] - a[1]) : 999;
      if (gap < 3) return;                     // looking straight down this axis
      const every = gap >= 30 * f ? 1 : gap >= 15 * f ? 2 : gap >= 7 * f ? 5 : 10;
      let nx = -dir[1], ny = dir[0];
      if (ny < 0 || (Math.abs(ny) < 1e-6 && nx < 0)) { nx = -nx; ny = -ny; }   // numbers below or right of the axis
      tk.at.forEach((t) => {
        const q = P2(t.p);
        ctx.strokeStyle = o.mono ? (ink.paper ? '#000' : '#fff') : ink.axis;
        ctx.lineWidth = 1.2 * f;
        ctx.beginPath();
        ctx.moveTo(q[0] - nx * 3.5 * f, q[1] - ny * 3.5 * f);
        ctx.lineTo(q[0] + nx * 3.5 * f, q[1] + ny * 3.5 * f);
        ctx.stroke();
        if (t.k % every !== 0) return;
        const off = 13 * f;
        place(t.text, q[0] + nx * off, q[1] + ny * off + 4 * f, '600 ' + (11.5 * f) + 'px ' + MONO, ink.mut, 'center');
      });
    });
    sc.labels.forEach((l) => {
      if (l.kind !== 'axisname') return;
      const q = P2(l.p);
      const dir = cam.dir2d([l.axis === 0 ? 1 : 0, l.axis === 1 ? 1 : 0, l.axis === 2 ? 1 : 0]);
      if (Math.hypot(dir[0], dir[1]) < 0.15) {
        // Pointing at you: the letter sits beside the origin instead.
        text(l.text, origin[0] + 10 * f, origin[1] - 10 * f, 'italic 700 ' + (17 * f) + 'px ' + SERIF, ink.text);
        return;
      }
      const tip = [q[0] + dir[0] * 4 * f, q[1] + dir[1] * 4 * f];
      // An arrowhead, then the letter just past it.
      ctx.fillStyle = o.mono ? (ink.paper ? '#000' : '#fff') : ink.axis;
      ctx.beginPath();
      ctx.moveTo(tip[0] + dir[0] * 6 * f, tip[1] + dir[1] * 6 * f);
      ctx.lineTo(tip[0] - dir[1] * 4 * f, tip[1] + dir[0] * 4 * f);
      ctx.lineTo(tip[0] + dir[1] * 4 * f, tip[1] - dir[0] * 4 * f);
      ctx.closePath();
      ctx.fill();
      text(l.text, tip[0] + dir[0] * 18 * f, tip[1] + dir[1] * 18 * f, 'italic 700 ' + (18 * f) + 'px ' + SERIF, ink.text, 'center', 'middle');
    });
    ctx.restore();

    if (titleH) {
      ctx.font = '700 ' + (22 * f / 1.15) + 'px ' + FONT;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = ink.text;
      ctx.fillText(d.title, W / 2, titleH / 2 + 4 * f);
    }
    if (keyLines.length) this.paintKey(ctx, keyLines, 12 * f, titleH + 12 * f, f, ink, o.mono, col, W);

    const picks = sc.picks.map((pk) => { const q = P2(pk.p); return Object.assign({ x: q[0], y: q[1] + titleH }, pk); });
    return { cam: cam, picks: picks, W: W, H: H };
  };

  P.segStyle = function (it, ink, col, f) {
    switch (it.role) {
      case 'grid': return { c: ink.grid, w: 1 * f };
      case 'box': return { c: ink.box, w: 1 * f };
      case 'axis': return { c: ink.axis, w: 1.7 * f };
      case 'trace': return { c: col(it.colour), w: 2.2 * f, dash: [7 * f, 5 * f] };
      case 'guide': return { c: col(it.colour), w: 1.3 * f, dash: [3 * f, 4 * f] };
      case 'line': return { c: col(it.colour), w: 2.8 * f };
      case 'meet': return { c: ink.meet, w: 2.8 * f };
      default: return { c: ink.axis, w: 1 * f };
    }
  };

  /* ── The key: what each colour is, and where the planes meet ──────────
     On screen an HTML card over the graph (it can be folded away); in a
     saved image or a print, the same lines drawn into the picture — shown
     when the card is open, left out when it is folded. */

  P.meetLines = function () {
    const sc = this.scene(), s = S(), out = [];
    const pairs = sc.meet.pairs;
    pairs.slice(0, 10).forEach((pr) => {
      const a = pr.a.n, b = pr.b.n;
      if (pr.m.kind === 'line') out.push({ text: a + ' and ' + b + ' meet in the line ' + s.lineText(pr.m.p, pr.m.dir), kind: 'line' });
      else if (pr.m.kind === 'parallel') out.push({ text: a + ' and ' + b + ' are parallel — they never meet', kind: 'none' });
      else out.push({ text: a + ' and ' + b + ' are the same plane', kind: 'same' });
    });
    if (pairs.length > 10) out.push({ text: '… and ' + (pairs.length - 10) + ' more pairs', kind: 'more' });
    const all = sc.meet.all, k = sc.meet.planes.length;
    if (all) {
      const names = k === 3 ? 'all three planes' : 'all ' + k + ' planes';
      const cap = names.charAt(0).toUpperCase() + names.slice(1);
      if (all.kind === 'point') out.push({ text: cap + ' meet at ' + s.fmtPoint(all.p) + (s.inBox(all.p, sc.box, 1e-6) ? '' : ' (outside the box)'), kind: 'answer' });
      else if (all.kind === 'line') out.push({ text: cap + ' share one line, ' + s.lineText(all.p, all.dir) + ' — infinitely many points in common', kind: 'answer' });
      else if (all.kind === 'plane') out.push({ text: cap + ' are the same plane — infinitely many points in common', kind: 'answer' });
      else if (all.parallel) {
        out.push({ text: 'No point is on ' + names + ': ' + sc.meet.planes[all.parallel[0]].n + ' and ' + sc.meet.planes[all.parallel[1]].n + ' are parallel', kind: 'answer' });
      } else out.push({ text: 'No point is on ' + names + ': each pair meets, but in parallel lines, like the sides of a prism', kind: 'answer' });
    }
    return out;
  };

  /** Every line of the key: a swatch and text per row, then where they meet. */
  P.keyLines = function () {
    const sc = this.scene(), lines = [];
    sc.rows.forEach((r) => {
      if (r.it.hidden || !r.p || r.p.error || r.p.kind === 'empty') return;
      lines.push({ n: r.n, colour: r.it.colour, kind: r.p.kind, text: String(r.it.src).trim() });
    });
    this.meetLines().forEach((m) => lines.push({ text: m.text, bare: true, answer: m.kind === 'answer' }));
    return lines;
  };

  P.paintKey = function (ctx, lines, x, y, f, ink, mono, col, W) {
    const lh = 22 * f;
    ctx.font = (13.5 * f) + 'px ' + FONT;
    const wide = Math.min(W - x - 12 * f, Math.max.apply(null, lines.map((l) => ctx.measureText(l.text).width + (l.bare ? 16 : 52) * f)));
    const h = lines.length * lh + 12 * f;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x, y, wide, h, 6 * f); else ctx.rect(x, y, wide, h);
    ctx.fillStyle = ink.keyBg;
    ctx.globalAlpha = 0.95;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = ink.keyLine;
    ctx.lineWidth = 1;
    ctx.stroke();
    lines.forEach((l, i) => {
      const cy = y + 18 * f + i * lh;
      let tx = x + 10 * f;
      if (!l.bare) {
        const c = mono ? (ink.paper ? '#000000' : '#ffffff') : col(l.colour);
        ctx.fillStyle = c;
        ctx.beginPath();
        if (l.kind === 'points') ctx.arc(x + 15 * f, cy - 4 * f, 4.5 * f, 0, Math.PI * 2);
        else if (l.kind === 'line') ctx.rect(x + 8 * f, cy - 5.5 * f, 16 * f, 3 * f);
        else ctx.rect(x + 8 * f, cy - 10 * f, 14 * f, 12 * f);
        ctx.fill();
        ctx.font = '800 ' + (11 * f) + 'px ' + FONT;
        ctx.fillStyle = ink.mut;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';
        ctx.fillText(String(l.n), x + 28 * f, cy);
        tx = x + 44 * f;
      }
      ctx.font = (l.answer ? '700 ' : '') + (13.5 * f) + 'px ' + FONT;
      ctx.fillStyle = ink.text;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
      let t = l.text;
      while (t.length > 4 && ctx.measureText(t).width > wide - (tx - x) - 8 * f) t = t.slice(0, -2);
      ctx.fillText(t === l.text ? t : t.slice(0, -1) + '…', tx, cy);
    });
  };

  P.renderKey = function () {
    const box = this.$('Key');
    if (!box) return;
    const lines = this.keyLines();
    /* On a phone the open key would cover most of the graph, so it starts
       folded there, showing just the answer; it still goes into a saved
       image unless it is folded on purpose. */
    if (this._autoFold == null) {
      const st = this.$('Stage');
      if (st && st.clientWidth) this._autoFold = st.clientWidth < 560;
    }
    const open = !!this.doc.win.key && !this._autoFold;
    const answer = lines.filter((l) => l.answer).map((l) => l.text)[0];
    const html = !lines.length ? '' : '<div class="flg-rc-bar"><span class="fl3-keyh">Key</span>'
      + '<button type="button" class="flg-rc-btn" data-keycopy title="Copy the key as text" aria-label="Copy the key as text">' + ICON.copy + '</button>'
      + '<button type="button" class="flg-rc-btn" data-keytoggle aria-expanded="' + open + '" title="' + (open ? 'Fold the key away — saved images leave it out too' : 'Show the key — saved images include it') + '" aria-label="Show or hide the key">'
      + (open ? ICON.minus : ICON.plus) + '</button></div>'
      + (open ? '<ul class="fl3-keylist">' + lines.map((l) => (l.bare
        ? '<li class="fl3-meet' + (l.answer ? ' is-answer' : '') + '">' + esc(l.text) + '</li>'
        : '<li><i class="fl3-sw fl3-sw--' + l.kind + '" style="--c:' + l.colour + '"></i><span class="fl3-n">' + l.n + '</span><span class="fl3-src">' + esc(l.text) + '</span></li>')).join('') + '</ul>'
        : answer ? '<p class="fl3-keyans">' + esc(answer) + '</p>' : '');
    if (html !== this._keyHTML) {
      this._keyHTML = html;
      box.innerHTML = html;
      box.hidden = !html;
      box.classList.toggle('is-folded', !open);
    }
  };

  P.copyKey = function () {
    const lines = this.keyLines().map((l) => (l.bare ? l.text : l.n + '.  ' + l.text));
    if (this.doc.title) lines.unshift(this.doc.title);
    const text = lines.join('\n');
    const ok = () => toast('Copied.', 'success');
    const bad = () => toast('Could not reach the clipboard.', 'error');
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(ok, bad); else bad();
    } catch (e) { bad(); }
  };

  /** What a screen reader hears about the graph. */
  P.summary = function () {
    const sc = this.scene();
    const count = { points: 0, plane: 0, line: 0, surface: 0 };
    sc.rows.forEach((r) => {
      if (r.it.hidden || !r.p || r.p.error || !count.hasOwnProperty(r.p.kind)) return;
      count[r.p.kind] += r.p.kind === 'points' ? r.p.pts.length : 1;
    });
    const parts = [];
    const say = (n, one, many) => { if (n) parts.push(n + ' ' + (n === 1 ? one : many)); };
    say(count.plane, 'plane', 'planes'); say(count.points, 'point', 'points'); say(count.line, 'line', 'lines'); say(count.surface, 'surface', 'surfaces');
    const meet = this.meetLines().filter((m) => m.kind === 'answer').map((m) => m.text);
    return (this.doc.title ? this.doc.title + '. ' : '') + '3D graph' + (parts.length ? ' with ' + parts.join(', ') : ', empty') + '.' + (meet.length ? ' ' + meet[0] + '.' : '');
  };
  P.paintSummary = function () {
    const el = this.$('Sum');
    if (!el) return;
    const t = this.summary();
    if (el.textContent !== t) el.textContent = t;
  };

  /* ── The pointer, the wheel and the keys ──────────────────────────────
     One finger or the mouse turns the graph, two fingers pinch to zoom, the
     wheel zooms, and with the graph focused the arrow keys turn it. */
  P.attachStage = function () {
    const self = this, stage = this.$('Stage'), plot = this.$('Plot');
    const pts = new Map();
    let moved = 0;
    const pos = (e) => { const r = plot.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
    plot.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      try { plot.setPointerCapture(e.pointerId); } catch (err) {}
      pts.set(e.pointerId, pos(e));
      moved = 0;
      stage.classList.add('is-grabbing');
      self.hideTrace();
    });
    plot.addEventListener('pointermove', (e) => {
      const p = pos(e);
      if (!pts.has(e.pointerId)) { self.hover(p); return; }
      const prev = pts.get(e.pointerId);
      pts.set(e.pointerId, p);
      if (pts.size === 1) {
        const dx = p.x - prev.x, dy = p.y - prev.y;
        moved += Math.abs(dx) + Math.abs(dy);
        if (moved > 2) {
          const v = self.doc.view;
          self.setView({ yaw: v.yaw - dx * 0.45, pitch: v.pitch + dy * 0.45 });
        }
      } else if (pts.size === 2) {
        const other = Array.from(pts.entries()).find((kv) => kv[0] !== e.pointerId)[1];
        const before = Math.hypot(prev.x - other.x, prev.y - other.y), after = Math.hypot(p.x - other.x, p.y - other.y);
        moved += 10;
        if (before > 4 && after > 4) self.setView({ zoom: self.doc.view.zoom * after / before });
      }
    });
    const end = (e) => {
      if (!pts.has(e.pointerId)) return;
      pts.delete(e.pointerId);
      if (!pts.size) stage.classList.remove('is-grabbing');
    };
    plot.addEventListener('pointerup', end);
    plot.addEventListener('pointercancel', end);
    plot.addEventListener('pointerleave', () => { if (!pts.size) self.hideTrace(); });
    plot.addEventListener('wheel', (e) => {
      e.preventDefault();
      const dy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
      self.setView({ zoom: self.doc.view.zoom * Math.exp(-clamp(dy, -120, 120) * 0.0022) });
    }, { passive: false });
    plot.addEventListener('keydown', (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const big = e.shiftKey ? 15 : 5;
      const k = e.key;
      if (k === 'ArrowLeft') self.turn('left', big);
      else if (k === 'ArrowRight') self.turn('right', big);
      else if (k === 'ArrowUp') self.turn('up', big);
      else if (k === 'ArrowDown') self.turn('down', big);
      else if (k === '+' || k === '=') self.tool('in');
      else if (k === '-' || k === '_') self.tool('out');
      else if (k === '0' || k === 'Home') self.resetView();
      else if (k === 'x' || k === 'y' || k === 'z') self.preset(k);
      else return;
      e.preventDefault();
    });
    if (typeof ResizeObserver === 'function') {
      this._ro = new ResizeObserver(() => self.draw());
      this._ro.observe(plot);
    } else {
      this._onResize = () => self.draw();
      window.addEventListener('resize', this._onResize);
    }
  };

  /** Over a point: its coordinates, the way the 2D halves show a reading. */
  P.hover = function (p) {
    const L = this._last, trace = this.$('Trace');
    if (!L || !trace) return;
    let best = null;
    L.picks.forEach((k) => {
      const d = Math.hypot(k.x - p.x, k.y - p.y);
      if (d <= 12 && (!best || d < best.d)) best = { d: d, k: k };
    });
    if (!best) { this.hideTrace(); return; }
    const k = best.k;
    trace.hidden = false;
    trace.style.left = k.x + 'px';
    trace.style.top = k.y + 'px';
    trace.style.setProperty('--c', k.colour || '#00c2ff');
    trace.querySelector('span').innerHTML = esc(k.text) + '<em>' + esc(k.what) + '</em>';
    trace.classList.toggle('is-flip', k.x > L.W - 180);
    trace.classList.toggle('is-below', k.y < 50);
  };
  P.hideTrace = function () { const t = this.$('Trace'); if (t) t.hidden = true; };

  /* ── Images and printing ────────────────────────────────────────────── */

  P.renderCanvas = function (W, H, bg, mono) {
    const cv = document.createElement('canvas');
    cv.width = W;
    cv.height = H;
    const ctx = cv.getContext('2d');
    this.paint(ctx, W, H, INKS[bg] || INKS.white, { mono: !!mono, scale: Math.max(1, Math.min(W, H) / 640) });
    return cv;
  };
  P.fileName = function () {
    return (this.doc.title || '3d-graph').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || '3d-graph';
  };
  P.pngBlob = function (W, H, ink) {
    const cv = this.renderCanvas(W, H, ink && ink.bg, ink && ink.mono);
    return new Promise((resolve, reject) => cv.toBlob((b) => (b ? resolve(b) : reject(new Error('png'))), 'image/png'));
  };

  /** Saving an image: a preview, a title, the background, and three checks —
      the same sheet, and the same reasons, as the 2D halves. */
  P.exportPNG = function () {
    if (document.querySelector('.fgx-back')) return null;
    const self = this, d = this.doc;
    const was = d.title;
    const bgNow = (() => { const v = readJSON(IMG_BG_KEY, 'white'); return INKS[v] && v !== 'screen' ? v : 'white'; })();
    const check = (k, text) => '<label class="fgx-check"><input type="checkbox" name="' + k + '"><span>' + text + '</span></label>';
    const back = document.createElement('div');
    back.className = 'fgc-back fgx-back';
    back.innerHTML = '<div class="fgc-sheet fgx-sheet" role="dialog" aria-modal="true" aria-labelledby="fgxHead">'
      + '<button type="button" class="fgc-x" data-close aria-label="Close">' + ICON.x + '</button>'
      + '<h2 class="fgc-h" id="fgxHead">Before you save the image</h2>'
      + '<p class="fgx-sub">Check it now so you don’t have to redo it later. Turn the graph first so the planes are easy to see — the image shows it exactly as it is on screen.</p>'
      + '<div class="fgx-preview"><img alt="Preview of the image that will be saved"></div>'
      + '<form class="fgx-form" novalidate>'
      +   '<label class="fgc-f fgx-f"><span>Title <b class="fgx-req">required</b></span><input name="title" maxlength="120" value="' + esc(d.title) + '" placeholder="e.g. Three planes meeting at a point" required></label>'
      +   '<fieldset class="fgx-bg"><legend>Background</legend><div class="fgx-seg" role="radiogroup" aria-label="Background">'
      +     [['white', 'White'], ['planner', 'Planner'], ['black', 'Black']].map((b) => '<label class="fgx-bgopt"><input type="radio" name="bg" value="' + b[0] + '"'
      +       (b[0] === bgNow ? ' checked' : '') + '><span><i class="fgx-sw fgx-sw--' + b[0] + '" aria-hidden="true"></i>' + b[1] + '</span></label>').join('')
      +   '</div></fieldset>'
      +   '<fieldset class="fgx-checks"><legend>Double-check</legend>'
      +     check('c1', 'The title is right')
      +     check('c2', 'Every point, plane and line I need is on the graph')
      +     check('c3', 'The view shows it clearly, and the key is showing or hidden the way I want')
      +   '</fieldset>'
      +   '<p class="fgx-missing" aria-live="polite"></p>'
      +   '<button type="submit" class="fgc-btn fgx-go" disabled>Save image</button>'
      + '</form></div>';
    document.body.appendChild(back);
    const box = back.firstChild, form = box.querySelector('form');
    const img = box.querySelector('.fgx-preview img');
    const go = box.querySelector('.fgx-go'), missing = box.querySelector('.fgx-missing');
    const prevFocus = document.activeElement;
    let url = null, previewT = 0, saved = false, closed = false;
    const chosenBg = () => { const r = form.querySelector('input[name="bg"]:checked'); return r ? r.value : 'white'; };
    const preview = () => {
      clearTimeout(previewT);
      previewT = setTimeout(() => {
        const keep = d.title;
        d.title = form.elements.title.value.trim().slice(0, 120);
        const cv = self.renderCanvas(800, 500, chosenBg(), false);
        d.title = keep;
        cv.toBlob((b) => {
          if (closed || !b) return;
          if (url) URL.revokeObjectURL(url);
          url = URL.createObjectURL(b);
          img.src = url;
        }, 'image/png');
      }, 120);
    };
    const validate = () => {
      const need = [];
      if (!form.elements.title.value.trim()) need.push('a title');
      const unticked = ['c1', 'c2', 'c3'].filter((k) => !form.elements[k].checked).length;
      if (unticked) need.push(unticked === 3 ? 'the three checks' : unticked === 1 ? 'one more check' : unticked + ' more checks');
      go.disabled = need.length > 0;
      missing.textContent = need.length ? 'Still needed: ' + need.join(', ') + '.' : '';
      form.elements.title.classList.toggle('is-empty', !form.elements.title.value.trim());
    };
    function close() {
      if (closed) return;
      closed = true;
      clearTimeout(previewT);
      document.removeEventListener('keydown', onKey, true);
      back.classList.add('is-out');
      setTimeout(() => { if (back.parentNode) back.parentNode.removeChild(back); if (url) URL.revokeObjectURL(url); }, 160);
      if (!saved) d.title = was;
      if (prevFocus && prevFocus.focus) { try { prevFocus.focus(); } catch (e) {} }
    }
    function onKey(e) { if (e.key === 'Escape') { e.stopPropagation(); close(); } }
    document.addEventListener('keydown', onKey, true);
    back.addEventListener('pointerdown', (e) => { if (e.target === back) close(); });
    box.addEventListener('click', (e) => { if (e.target.closest('[data-close]')) close(); });
    form.addEventListener('input', () => { validate(); preview(); });
    form.addEventListener('change', (e) => { if (e.target.name === 'bg') { writeJSON(IMG_BG_KEY, e.target.value); preview(); } validate(); });
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      validate();
      if (go.disabled) return;
      const t = form.elements.title.value.trim().slice(0, 120);
      if (t !== d.title) { d.title = t; self.touch(); }
      saved = true;
      self._downloadPNG(chosenBg());
      close();
    });
    validate();
    preview();
    (form.elements.title.value.trim() ? form.elements.c1 : form.elements.title).focus();
    return back;
  };
  P._downloadPNG = function (bg) {
    const name = this.fileName();
    this.pngBlob(1600, 1000, { bg: bg }).then((b) => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(b);
      a.download = name + '.png';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 1500);
      toast('Image saved.', 'success');
    }, () => toast('Could not turn the graph into an image.', 'error'));
  };

  P.printMenu = function (anchor) {
    const mono = readJSON(PRINT_KEY, false) === true;
    const H = window.FluxHub;
    const viaShare = !!(H && H.canPrint && !H.canPrint());
    let ready = null, making = null;
    const prepare = () => {
      ready = null;
      making = this.pngBlob(2400, 1600, { bg: 'white', mono: readJSON(PRINT_KEY, false) === true }).then((b) => { ready = b; return b; }, () => null);
    };
    if (viaShare) prepare();
    const html = '<div class="flg-printmenu"><div class="flg-pm-h">Print</div>'
      + '<p class="flg-pm-q">Does your printer only print in black and white?</p>'
      + '<div class="flg-pm-seg" role="radiogroup" aria-label="Printer">'
      + '<button type="button" role="radio" data-pmono="0" aria-checked="' + !mono + '">No, colour</button>'
      + '<button type="button" role="radio" data-pmono="1" aria-checked="' + mono + '">Yes, black &amp; white</button></div>'
      + '<p class="flg-pm-note">Black &amp; white prints everything in black, with each plane, line and surface marked by its row number.</p>'
      + (viaShare ? '<p class="flg-pm-note flg-pm-share">On your phone this opens the Share menu: choose <b>Print</b> there.</p>' : '')
      + '<button type="button" class="flg-pm-go" data-pgo>Print</button></div>';
    G().openPop(anchor, html, (el) => {
      el.addEventListener('click', (e) => {
        const b = e.target.closest('[data-pmono]');
        if (b) {
          writeJSON(PRINT_KEY, b.dataset.pmono === '1');
          el.querySelectorAll('[data-pmono]').forEach((x) => x.setAttribute('aria-checked', String(x === b)));
          if (viaShare) prepare();
          return;
        }
        if (!e.target.closest('[data-pgo]')) return;
        this.closePop();
        if (!viaShare) { this.printGraph(readJSON(PRINT_KEY, false) === true); return; }
        const name = this.fileName() + '.png', title = this.doc.title || '3D graph';
        const done = (r) => { if (r === 'saved') toast('Saved as an image. Open it and use Share, then Print.', 'success'); };
        if (ready) H.printImage(ready, name, title).then(done);
        else making.then((blob) => { if (blob) H.printImage(blob, name, title).then(done); else toast('Could not make the page to print.', 'error'); });
      });
    });
  };
  P.preparePrint = function (mono) {
    let sheet = document.getElementById('flgPrintSheet');
    if (!sheet) { sheet = document.createElement('div'); sheet.id = 'flgPrintSheet'; document.body.appendChild(sheet); }
    const src = this.renderCanvas(1500, 1000, 'white', !!mono).toDataURL('image/png');
    sheet.innerHTML = '<div class="flg-print-mark"><img src="public/flux-planner-logo.png" alt="" width="18" height="18"><span>Flux Grapher</span></div>'
      + '<img class="fl3-print" alt="' + esc(this.summary()) + '" src="' + src + '">';
    document.documentElement.classList.add('flg-printing');
  };
  P.printGraph = function (mono) {
    this.preparePrint(mono);
    const done = () => {
      window.removeEventListener('afterprint', done);
      document.documentElement.classList.remove('flg-printing');
      const sheet = document.getElementById('flgPrintSheet');
      if (sheet) sheet.innerHTML = '';
    };
    window.addEventListener('afterprint', done);
    try { window.print(); } catch (e) { done(); }
  };

  /* ── Saving, links and the mode switch (grapher.html calls these) ───── */

  P.suggestedTitle = function () {
    if (this.doc.title.trim()) return this.doc.title.trim().slice(0, 120);
    const first = this.doc.items.find((i) => String(i.src || '').trim());
    return first ? ('3D: ' + first.src.trim()).slice(0, 120) : 'Untitled 3D graph';
  };
  /* The saved-graphs table only knows two kinds, so a 3D graph is saved as a
     function graph whose payload says kind: '3d' — FluxGrapher.kindOf reads
     it back. No change to the database was needed. */
  P.getDoc = function () {
    return { kind: 'functions', title: this.suggestedTitle(), payload: JSON.parse(JSON.stringify(this.doc)) };
  };
  P.loadDoc = function (payload, cloud) {
    this.closePop();
    if (this._anim) { cancelAnimationFrame(this._anim); this._anim = 0; }
    this.doc = S().normaliseDoc(payload);
    this.cloud = cloud && cloud.id ? { id: cloud.id, title: String(cloud.title || '').slice(0, 120) } : null;
    this.cache.clear();
    this._scene = null;
    this._keyHTML = null;
    this.renderItems();
    this.dirty = false;
    clearTimeout(this._histT);
    this.undoStack = [];
    this.redoStack = [];
    this._snap = this.histJSON();
    this.paintHistory();
    this.draw();
  };
  P.markSaved = function (cloud) {
    if (cloud && cloud.id) this.cloud = { id: cloud.id, title: String(cloud.title || '').slice(0, 120) };
    this.dirty = false;
    this.emit('saved');
  };
  P.forgetCloud = function (id, title) {
    if (!this.cloud || this.cloud.id !== id) return false;
    const name = title || this.cloud.title;
    this.cloud = null;
    toast('"' + name + '" was deleted, so what is on screen is no longer saved. Save makes a new copy.', 'info');
    return true;
  };
  P.isDirty = function () { return this.dirty; };
  P.persistLocal = function () {};
  P.snapshot = function () { return { doc: JSON.parse(JSON.stringify(this.doc)), cloud: this.cloud, dirty: this.dirty }; };
  P.restore = function (s) {
    if (!s) return;
    this.loadDoc(s.doc, s.cloud);
    this.dirty = !!s.dirty;
  };
  /** The # part of a link that rebuilds this graph and this view. */
  P.shareHash = function () { return '#3d=' + S().encodeShare(this.doc); };
  P.destroy = function () {
    this.closePop();
    clearTimeout(this._histT);
    clearTimeout(this._drawT);
    if (this._raf) cancelAnimationFrame(this._raf);
    if (this._anim) cancelAnimationFrame(this._anim);
    if (this._onKey) document.removeEventListener('keydown', this._onKey);
    if (this._ro) this._ro.disconnect();
    if (this._onResize) window.removeEventListener('resize', this._onResize);
    this.host.innerHTML = '';
  };

  function create(host, opts) {
    if (!host || !S()) return null;
    return new Grapher3D(host, opts || {});
  }

  window.FluxGrapher3D = { create: create, INKS: INKS, EXAMPLES: EXAMPLES };
})();
