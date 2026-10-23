/* ============================================================================
   FLUX PIXEL  ·  flux-pixel.js
   A drawing and diagram page: pen and highlighter, lines and arrows, boxes
   and circles, text, labels with leader lines, a library of lab, circuit,
   science, maths and geography stamps, and pictures. Everything is an object
   on an SVG page, so it can be picked up, moved, resized, recoloured and
   undone, and exported as a sharp PNG or SVG.

   ROUTES
     #/          your drawings
     #/d/<id>    the editor

   Drawings live in this browser (localStorage). Pictures are scaled down
   before they are stored so a page full of them still fits.
   ========================================================================== */
(function () {
  'use strict';
  if (window.FluxPixel) return;

  var STORE = 'flux_pixel_docs_v1';
  var W = 1600, H = 1000;
  var NS = 'http://www.w3.org/2000/svg';
  var COLORS = ['#111827', '#dc2626', '#ea580c', '#ca8a04', '#16a34a', '#0891b2', '#2563eb', '#7c3aed', '#db2777', '#6b7280', '#ffffff'];
  var BGS = [['plain', 'Blank'], ['grid', 'Graph paper'], ['dots', 'Dot grid'], ['lines', 'Lined']];

  /* ── Little things ──────────────────────────────────────────────────── */

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function $(sel, el) { return (el || document).querySelector(sel); }
  function $$(sel, el) { return Array.prototype.slice.call((el || document).querySelectorAll(sel)); }
  function r1(n) { return Math.round(n * 10) / 10; }
  function toast(text, kind) {
    var t = document.createElement('div');
    t.className = 'px-toast' + (kind ? ' px-toast--' + kind : '');
    t.setAttribute('role', 'status');
    t.textContent = text;
    document.body.appendChild(t);
    requestAnimationFrame(function () { t.classList.add('is-in'); });
    setTimeout(function () { t.classList.remove('is-in'); setTimeout(function () { t.remove(); }, 300); }, 2400);
  }
  /** A message with one button in it, like “Deleted · Undo”. */
  function toastAct(text, label, fn) {
    var t = document.createElement('div');
    t.className = 'px-toast px-toast--act';
    t.setAttribute('role', 'status');
    t.innerHTML = '<span>' + esc(text) + '</span><button type="button" class="px-toast-b">' + esc(label) + '</button>';
    t.querySelector('button').addEventListener('click', function () { fn(); t.remove(); });
    document.body.appendChild(t);
    requestAnimationFrame(function () { t.classList.add('is-in'); });
    setTimeout(function () { t.classList.remove('is-in'); setTimeout(function () { t.remove(); }, 300); }, 5000);
  }
  function svgIcon(d, extra) {
    return '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"' + (extra || '') + '>' + d + '</svg>';
  }
  var ICON = {
    select: svgIcon('<path d="M4 3l7 17 2.5-7.5L21 10z"/>'),
    pen: svgIcon('<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>'),
    hl: svgIcon('<path d="m9 11-6 6v3h9l3-3"/><path d="m22 12-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4"/>'),
    eraser: svgIcon('<path d="m7 21-4.3-4.3a1 1 0 0 1 0-1.4l10-10a1 1 0 0 1 1.4 0l5.6 5.6a1 1 0 0 1 0 1.4L13 19"/><path d="M22 21H7M5 11l9 9"/>'),
    line: svgIcon('<path d="M5 19 19 5"/>'),
    arrow: svgIcon('<path d="M5 19 19 5M10 5h9v9"/>'),
    rect: svgIcon('<rect x="4" y="5" width="16" height="14" rx="1.5"/>'),
    ellipse: svgIcon('<ellipse cx="12" cy="12" rx="9" ry="7"/>'),
    text: svgIcon('<path d="M5 6V4h14v2M12 4v16M9 20h6"/>'),
    label: svgIcon('<circle cx="5" cy="18" r="2"/><path d="m6.5 16.5 6-6M13 10h8"/>'),
    stamp: svgIcon('<path d="M9 3h6v4l-3 2-3-2z"/><path d="M5 13h14v4H5zM7 21h10"/><path d="M12 9v4"/>'),
    image: svgIcon('<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-5-5L5 21"/>'),
    undo: svgIcon('<path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-15-6.7L3 13"/>'),
    redo: svgIcon('<path d="M21 7v6h-6"/><path d="M3 17a9 9 0 0 1 15-6.7L21 13"/>'),
    trash: svgIcon('<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/>'),
    copy: svgIcon('<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/>'),
    download: svgIcon('<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>'),
    back: svgIcon('<path d="m15 18-6-6 6-6"/>'),
    plus: svgIcon('<path d="M12 5v14M5 12h14"/>'),
    front: svgIcon('<rect x="8" y="8" width="12" height="12" rx="1.5"/><path d="M4 16V5a1 1 0 0 1 1-1h11"/>'),
    vector: svgIcon('<path d="M4 20 18 6"/><path d="M19 5l-1.2 6.2L12.8 6.2z" fill="currentColor"/><path d="M4 20h7" stroke-dasharray="2 2.5"/>'),
    figure: svgIcon('<path d="M3 20h12L3 6z"/><path d="M3 16h4v4"/><circle cx="17.5" cy="7.5" r="3.5"/>'),
    panel: svgIcon('<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M15 4v16"/>'),
    link: svgIcon('<path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/>'),
  };
  /* Flux Figures mode: one button per kind of figure down the left. */
  var KIND_ICON = {
    grid: svgIcon('<path d="M4 20V4M4 20h16"/><path d="M6 17c3-9 6-9 12-12"/>'),
    numline: svgIcon('<path d="M2 12h20M5 9v6M9 10v4M12 9v6M15 10v4M19 9v6"/>'),
    triangle: svgIcon('<path d="M4 19h16L9 5z"/>'),
    rect: svgIcon('<rect x="3" y="6" width="18" height="12" rx="1"/>'),
    para: svgIcon('<path d="M7 6h14l-4 12H3z"/>'),
    trap: svgIcon('<path d="M8 6h8l5 12H3z"/>'),
    kite: svgIcon('<path d="M12 3l6 7-6 11-6-11z"/>'),
    reg: svgIcon('<path d="M7 4h10l5 8-5 8H7l-5-8z"/>'),
    circle: svgIcon('<circle cx="12" cy="12" r="9"/><path d="M12 12l7-5"/>'),
    angle: svgIcon('<path d="M20 19H4l12-12"/><path d="M10 19a6 6 0 0 0-2-4.5"/>'),
    parallel: svgIcon('<path d="M2 8h20M2 16h20M8 3l8 18"/>'),
    solid: svgIcon('<path d="M4 8l8-4 8 4v9l-8 4-8-4z"/><path d="M4 8l8 4 8-4M12 12v9"/>'),
  };
  var ERASE_PREF = 'flux_pixel_eraser';
  var ERASE_MODES = [
    ['whole', 'Whole item', 'Takes away anything it touches'],
    ['circle', 'Circle', 'Rubs out only what it passes over'],
    ['box', 'Box', 'Drag a box: everything inside it is rubbed out'],
  ];
  var TOOLS = [
    ['select', 'Select and move', 'V'], ['pen', 'Pen', 'P'], ['hl', 'Highlighter', 'H'], ['eraser', 'Eraser', 'E'],
    ['line', 'Line', 'L'], ['arrow', 'Arrow', 'A'], ['vector', 'Vector', 'W'], ['rect', 'Box', 'R'], ['ellipse', 'Circle', 'O'],
    ['text', 'Text', 'T'], ['label', 'Label with a line', 'B'], ['stamp', 'Stamps', 'S'], ['image', 'Picture', 'I'],
    ['figure', 'Flux Figures panel', 'M'],
  ];
  var VEC_PREF = 'flux_pixel_vector';
  var VEC_DIRS = [['angle', 'Angle from +x'], ['bearing', 'Bearing'], ['compass', 'Compass (N 30\u00b0 E)']];
  var RESULTANT = '#dc2626';

  /* ── Store ──────────────────────────────────────────────────────────── */

  function readStore() {
    try { var v = JSON.parse(localStorage.getItem(STORE) || 'null'); if (v && Array.isArray(v.docs)) return v; } catch (e) {}
    return { v: 1, docs: [] };
  }
  function writeStore(st) {
    try { localStorage.setItem(STORE, JSON.stringify(st)); return true; }
    catch (e) { toast('This browser is out of space for drawings. Export and delete some old ones.', 'warn'); return false; }
  }
  function docs() { return readStore().docs; }
  function getDoc(id) { return docs().filter(function (d) { return d.id === id; })[0] || null; }
  function putDoc(doc) {
    var st = readStore();
    doc.updated = Date.now();
    var i = st.docs.findIndex(function (d) { return d.id === doc.id; });
    if (i >= 0) st.docs[i] = doc; else st.docs.unshift(doc);
    return writeStore(st);
  }
  function removeDoc(id) {
    var st = readStore();
    st.docs = st.docs.filter(function (d) { return d.id !== id; });
    writeStore(st);
  }
  function newDoc(opts) {
    opts = opts || {};
    return { id: uid(), title: opts.title || 'Untitled drawing', bg: opts.bg || 'plain', items: opts.items || [], created: Date.now(), updated: Date.now() };
  }

  /* ── Geometry ───────────────────────────────────────────────────────── */

  function stampById(id) {
    var out = null;
    (window.FluxPixelStamps || []).some(function (g) { return g.items.some(function (s) { if (s.id === id) { out = s; return true; } return false; }); });
    return out;
  }
  /* Maths figures and vectors are drawn by flux-figures.js (window.FluxFigures).
     A figure item keeps its settings (it.fig), so it can be opened and changed
     again; the drawing is rebuilt from them, cached by settings and colour. */
  var figCache = {}, figKeys = [];
  function figureBuilt(it) {
    if (!window.FluxFigures || !it.fig) return null;
    var key = JSON.stringify(it.fig) + '|' + (it.color || '');
    if (!figCache[key]) {
      figCache[key] = window.FluxFigures.build(it.fig, { ink: it.color || '#111827' });
      figKeys.push(key);
      if (figKeys.length > 80) delete figCache[figKeys.shift()];
    }
    return figCache[key];
  }
  /** A new figure item, centred on c (page units), at a size that suits the page. */
  function figureItem(spec, c) {
    var b = window.FluxFigures.build(spec);
    if (b.error) return null;
    var k = Math.min(1.3, (W * 0.8) / b.w, (H * 0.8) / b.h), w = b.w * k, h = b.h * k;
    c = c || [W / 2, H / 2];
    return { type: 'figure', fig: window.FluxFigures.clean(spec), color: '#111827',
      x: Math.max(0, Math.min(W - w, c[0] - w / 2)), y: Math.max(0, Math.min(H - h, c[1] - h / 2)), w: w, h: h };
  }
  function vecDrawn(it) { return window.FluxFigures ? window.FluxFigures.vec.draw(it) : null; }
  function textLines(t) { return String(t || '').split('\n'); }
  function textSize(it) {
    var lines = textLines(it.text);
    var longest = lines.reduce(function (m, l) { return Math.max(m, l.length); }, 1);
    return { w: Math.max(it.size * 0.6, longest * it.size * 0.56), h: lines.length * it.size * 1.25 };
  }
  function bbox(it) {
    var xs, ys, pad = (it.width || 0) / 2;
    switch (it.type) {
      case 'pen': case 'hl':
        xs = it.pts.map(function (p) { return p[0]; }); ys = it.pts.map(function (p) { return p[1]; });
        return { x: Math.min.apply(0, xs) - pad, y: Math.min.apply(0, ys) - pad, w: Math.max.apply(0, xs) - Math.min.apply(0, xs) + pad * 2, h: Math.max.apply(0, ys) - Math.min.apply(0, ys) + pad * 2 };
      case 'vector': {
        var vd = vecDrawn(it);
        if (vd) return vd.box;
        return { x: Math.min(it.x1, it.x2) - pad, y: Math.min(it.y1, it.y2) - pad, w: Math.abs(it.x2 - it.x1) + pad * 2, h: Math.abs(it.y2 - it.y1) + pad * 2 };
      }
      case 'line': case 'arrow':
        return { x: Math.min(it.x1, it.x2) - pad, y: Math.min(it.y1, it.y2) - pad, w: Math.abs(it.x2 - it.x1) + pad * 2, h: Math.abs(it.y2 - it.y1) + pad * 2 };
      case 'text': {
        var s = textSize(it);
        return { x: it.x, y: it.y, w: s.w, h: s.h };
      }
      case 'label': {
        var t = textSize(it), left = it.x2 >= it.x1;
        var tx = left ? it.x2 + 8 : it.x2 - 8 - t.w, ty = it.y2 - t.h / 2;
        var x0 = Math.min(it.x1, tx), y0 = Math.min(it.y1, ty);
        return { x: x0 - 6, y: y0 - 6, w: Math.max(it.x1, tx + t.w) - x0 + 12, h: Math.max(it.y1, ty + t.h) - y0 + 12 };
      }
      default:
        return { x: it.x, y: it.y, w: it.w, h: it.h };
    }
  }
  function moveItem(it, dx, dy) {
    if (it.pts) it.pts = it.pts.map(function (p) { return [p[0] + dx, p[1] + dy]; });
    ['x', 'x1', 'x2'].forEach(function (k) { if (k in it) it[k] += dx; });
    ['y', 'y1', 'y2'].forEach(function (k) { if (k in it) it[k] += dy; });
    // What the eraser rubbed out goes where the item goes.
    (it.cuts || []).forEach(function (c) {
      if (c.pts) c.pts = c.pts.map(function (p) { return [p[0] + dx, p[1] + dy]; });
      else { c.x += dx; c.y += dy; }
    });
  }
  function scaleCuts(it, sx, sy, ox, oy) {
    var f = function (v, o, s) { return o + (v - o) * s; };
    (it.cuts || []).forEach(function (c) {
      if (c.pts) { c.pts = c.pts.map(function (p) { return [f(p[0], ox, sx), f(p[1], oy, sy)]; }); c.r = Math.max(1, c.r * Math.sqrt(sx * sy)); }
      else { c.x = f(c.x, ox, sx); c.y = f(c.y, oy, sy); c.w *= sx; c.h *= sy; }
    });
  }
  /** Scale about (ox, oy). Text keeps its shape: it scales by one factor. */
  function scaleItem(it, sx, sy, ox, oy) {
    var f = function (v, o, s) { return o + (v - o) * s; };
    if (it.type === 'text' || it.type === 'label') {
      var s = Math.max(0.2, (sx + sy) / 2);
      ['x', 'x1', 'x2'].forEach(function (k) { if (k in it) it[k] = f(it[k], ox, s); });
      ['y', 'y1', 'y2'].forEach(function (k) { if (k in it) it[k] = f(it[k], oy, s); });
      it.size = Math.max(8, it.size * s);
      scaleCuts(it, s, s, ox, oy);
      return;
    }
    if (it.pts) it.pts = it.pts.map(function (p) { return [f(p[0], ox, sx), f(p[1], oy, sy)]; });
    ['x1', 'x2'].forEach(function (k) { if (k in it) it[k] = f(it[k], ox, sx); });
    ['y1', 'y2'].forEach(function (k) { if (k in it) it[k] = f(it[k], oy, sy); });
    if ('w' in it) { it.x = f(it.x, ox, sx); it.y = f(it.y, oy, sy); it.w = Math.max(4, it.w * sx); it.h = Math.max(4, it.h * sy); }
    scaleCuts(it, sx, sy, ox, oy);
  }

  /* ── The eraser ─────────────────────────────────────────────────────────
     Three ways to rub out. Whole item takes away anything it touches. Circle
     and Box rub out only the part under them: each touched item keeps a list
     of cuts (a swept circle, or a box) that are drawn as holes in a mask, so
     the item keeps its shape, its gaps move and resize with it, and undo,
     PNG and SVG all see the same picture. A line, arrow or pen stroke rubbed
     out from end to end is removed outright. */

  function distPtSeg(p, a, b) {
    var dx = b[0] - a[0], dy = b[1] - a[1], L = dx * dx + dy * dy;
    var t = L ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L)) : 0;
    return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
  }
  function cross(o, a, b) { return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]); }
  function distSegSeg(a, b, c, d) {
    var d1 = cross(c, d, a), d2 = cross(c, d, b), d3 = cross(a, b, c), d4 = cross(a, b, d);
    if (((d1 > 0) !== (d2 > 0)) && ((d3 > 0) !== (d4 > 0)) && d1 && d2 && d3 && d4) return 0;
    return Math.min(distPtSeg(a, c, d), distPtSeg(b, c, d), distPtSeg(c, a, b), distPtSeg(d, a, b));
  }
  function arrowHeadPts(x1, y1, x2, y2, w) {
    var a = Math.atan2(y2 - y1, x2 - x1), len = 10 + w * 3, spread = 0.45;
    return [[x2, y2], [x2 - len * Math.cos(a - spread), y2 - len * Math.sin(a - spread)], [x2 - len * Math.cos(a + spread), y2 - len * Math.sin(a + spread)], [x2, y2]];
  }
  /** The lines an item's ink follows; null where its box is the best guess (text, stamps, pictures, filled shapes). */
  function inkLines(it) {
    switch (it.type) {
      case 'pen': case 'hl': return [it.pts];
      case 'line': return [[[it.x1, it.y1], [it.x2, it.y2]]];
      case 'arrow': return [[[it.x1, it.y1], [it.x2, it.y2]], arrowHeadPts(it.x1, it.y1, it.x2, it.y2, it.width || 3)];
      case 'vector': { var vi = vecDrawn(it); return vi ? vi.ink : [[[it.x1, it.y1], [it.x2, it.y2]]]; }
      case 'rect': return it.fill ? null : [[[it.x, it.y], [it.x + it.w, it.y], [it.x + it.w, it.y + it.h], [it.x, it.y + it.h], [it.x, it.y]]];
      case 'ellipse': {
        if (it.fill) return null;
        var cx = it.x + it.w / 2, cy = it.y + it.h / 2, pts = [];
        for (var i = 0; i <= 48; i++) { var t = i / 48 * Math.PI * 2; pts.push([cx + it.w / 2 * Math.cos(t), cy + it.h / 2 * Math.sin(t)]); }
        return [pts];
      }
      default: return null;
    }
  }
  /** Does a circle of radius r swept from a to b touch the item's ink? */
  function sweepTouches(it, a, b, r) {
    var bb = bbox(it), pad = r + (it.width || 3) * 3 + 2;
    if (bb.x > Math.max(a[0], b[0]) + pad || bb.x + bb.w < Math.min(a[0], b[0]) - pad
      || bb.y > Math.max(a[1], b[1]) + pad || bb.y + bb.h < Math.min(a[1], b[1]) - pad) return false;
    var lines = inkLines(it);
    if (!lines) return true;
    var reach = r + (it.width || 3) / 2;
    return lines.some(function (pts) {
      if (pts.length === 1) return distPtSeg(pts[0], a, b) <= reach;
      for (var i = 1; i < pts.length; i++) if (distSegSeg(a, b, pts[i - 1], pts[i]) <= reach) return true;
      return false;
    });
  }
  /** Does the box (page units) touch the item's ink? */
  function boxTouches(it, bx) {
    var bb = bbox(it);
    if (bb.x > bx.x + bx.w || bb.x + bb.w < bx.x || bb.y > bx.y + bx.h || bb.y + bb.h < bx.y) return false;
    var lines = inkLines(it);
    if (!lines) return true;
    var m = (it.width || 3) / 2, x0 = bx.x - m, y0 = bx.y - m, x1 = bx.x + bx.w + m, y1 = bx.y + bx.h + m;
    var inside = function (p) { return p[0] >= x0 && p[0] <= x1 && p[1] >= y0 && p[1] <= y1; };
    var edges = [[[x0, y0], [x1, y0]], [[x1, y0], [x1, y1]], [[x1, y1], [x0, y1]], [[x0, y1], [x0, y0]]];
    return lines.some(function (pts) {
      if (pts.some(inside)) return true;
      for (var i = 1; i < pts.length; i++) for (var k = 0; k < 4; k++) if (distSegSeg(pts[i - 1], pts[i], edges[k][0], edges[k][1]) === 0) return true;
      return false;
    });
  }
  function underCut(p, cuts, margin) {
    return cuts.some(function (c) {
      if (!c.pts) return p[0] >= c.x + margin && p[0] <= c.x + c.w - margin && p[1] >= c.y + margin && p[1] <= c.y + c.h - margin;
      if (c.pts.length === 1) return Math.hypot(p[0] - c.pts[0][0], p[1] - c.pts[0][1]) <= c.r - margin;
      for (var i = 1; i < c.pts.length; i++) if (distPtSeg(p, c.pts[i - 1], c.pts[i]) <= c.r - margin) return true;
      return false;
    });
  }
  /** A line, arrow or pen stroke with nothing left showing: every bit of its ink lies under a cut. */
  function rubbedOut(it) {
    if (!it.cuts || !it.cuts.length || !/^(pen|hl|line|arrow|vector)$/.test(it.type)) return false;
    var margin = (it.width || 3) / 2;
    return inkLines(it).every(function (pts) {
      if (!underCut(pts[0], it.cuts, margin)) return false;
      for (var i = 1; i < pts.length; i++) {
        var a = pts[i - 1], b = pts[i], n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 3));
        for (var k = 1; k <= n; k++) if (!underCut([a[0] + (b[0] - a[0]) * k / n, a[1] + (b[1] - a[1]) * k / n], it.cuts, margin)) return false;
      }
      return true;
    });
  }

  /* ── Drawing items as SVG ───────────────────────────────────────────── */

  /** A smooth path through the points: quadratic curves via the midpoints. */
  function smoothPath(pts) {
    if (!pts.length) return '';
    if (pts.length < 3) return 'M' + pts.map(function (p) { return r1(p[0]) + ' ' + r1(p[1]); }).join(' L');
    var d = 'M' + r1(pts[0][0]) + ' ' + r1(pts[0][1]);
    for (var i = 1; i < pts.length - 1; i++) {
      var mx = (pts[i][0] + pts[i + 1][0]) / 2, my = (pts[i][1] + pts[i + 1][1]) / 2;
      d += ' Q' + r1(pts[i][0]) + ' ' + r1(pts[i][1]) + ' ' + r1(mx) + ' ' + r1(my);
    }
    var last = pts[pts.length - 1];
    return d + ' L' + r1(last[0]) + ' ' + r1(last[1]);
  }
  function arrowHead(x1, y1, x2, y2, w) {
    var a = Math.atan2(y2 - y1, x2 - x1), len = 10 + w * 3, spread = 0.45;
    var p1 = [x2 - len * Math.cos(a - spread), y2 - len * Math.sin(a - spread)];
    var p2 = [x2 - len * Math.cos(a + spread), y2 - len * Math.sin(a + spread)];
    return r1(x2) + ',' + r1(y2) + ' ' + r1(p1[0]) + ',' + r1(p1[1]) + ' ' + r1(p2[0]) + ',' + r1(p2[1]);
  }
  function dashAttr(it) { return it.dash ? ' stroke-dasharray="' + (it.width * 3) + ' ' + (it.width * 2.5) + '"' : ''; }
  function textSVG(lines, x, y, size, color, anchor, bold) {
    return '<text x="' + r1(x) + '" y="' + r1(y) + '" font-size="' + r1(size) + '" fill="' + color + '" font-family="Inter, system-ui, -apple-system, Segoe UI, sans-serif"' + (bold ? ' font-weight="700"' : '') + (anchor === 'end' ? ' text-anchor="end"' : '') + '>'
      + lines.map(function (l, i) { return '<tspan x="' + r1(x) + '" dy="' + (i ? r1(size * 1.25) : r1(size * 0.92)) + '">' + (esc(l) || ' ') + '</tspan>'; }).join('') + '</text>';
  }
  /** One item. `hit` adds the invisible wide strokes the select tool clicks on. */
  function itemSVG(it, hit) {
    var c = it.color || '#111827', w = it.width || 3, out = '', fat = 'stroke="transparent" fill="none" stroke-width="' + (w + 16) + '" pointer-events="stroke" stroke-linecap="round"';
    switch (it.type) {
      case 'pen': case 'hl': {
        var d = smoothPath(it.pts);
        out = '<path d="' + d + '" fill="none" stroke="' + c + '" stroke-width="' + w + '" stroke-linecap="round" stroke-linejoin="round"' + (it.type === 'hl' ? ' opacity=".38"' : '') + '/>';
        if (it.pts.length === 1) out = '<circle cx="' + r1(it.pts[0][0]) + '" cy="' + r1(it.pts[0][1]) + '" r="' + w / 2 + '" fill="' + c + '"' + (it.type === 'hl' ? ' opacity=".38"' : '') + '/>';
        if (hit) out += '<path d="' + d + '" ' + fat + '/>';
        break;
      }
      case 'line': case 'arrow': {
        out = '<line x1="' + r1(it.x1) + '" y1="' + r1(it.y1) + '" x2="' + r1(it.x2) + '" y2="' + r1(it.y2) + '" stroke="' + c + '" stroke-width="' + w + '" stroke-linecap="round"' + dashAttr(it) + '/>';
        if (it.type === 'arrow') out += '<polygon points="' + arrowHead(it.x1, it.y1, it.x2, it.y2, w) + '" fill="' + c + '" stroke="' + c + '" stroke-width="' + w / 2 + '" stroke-linejoin="round"/>';
        if (hit) out += '<line x1="' + r1(it.x1) + '" y1="' + r1(it.y1) + '" x2="' + r1(it.x2) + '" y2="' + r1(it.y2) + '" ' + fat + '/>';
        break;
      }
      case 'rect': case 'ellipse': {
        var fill = it.fill ? c : 'none';
        var shape = it.type === 'rect'
          ? '<rect x="' + r1(it.x) + '" y="' + r1(it.y) + '" width="' + r1(it.w) + '" height="' + r1(it.h) + '" rx="' + Math.min(10, it.w / 8, it.h / 8) + '"'
          : '<ellipse cx="' + r1(it.x + it.w / 2) + '" cy="' + r1(it.y + it.h / 2) + '" rx="' + r1(it.w / 2) + '" ry="' + r1(it.h / 2) + '"';
        out = shape + ' fill="' + fill + '"' + (it.fill ? ' fill-opacity=".18"' : '') + ' stroke="' + c + '" stroke-width="' + w + '"' + dashAttr(it) + '/>';
        if (hit) out += shape + ' ' + fat.replace('fill="none"', it.fill ? 'fill="transparent"' : 'fill="none"').replace('pointer-events="stroke"', it.fill ? 'pointer-events="all"' : 'pointer-events="stroke"') + '/>';
        break;
      }
      case 'text': {
        out = textSVG(textLines(it.text), it.x, it.y, it.size, c, 'start', it.bold);
        if (hit) { var b = bbox(it); out += '<rect x="' + r1(b.x) + '" y="' + r1(b.y) + '" width="' + r1(b.w) + '" height="' + r1(b.h) + '" fill="transparent"/>'; }
        break;
      }
      case 'label': {
        var lines = textLines(it.text), sz = textSize(it), right = it.x2 >= it.x1;
        out = '<line x1="' + r1(it.x1) + '" y1="' + r1(it.y1) + '" x2="' + r1(it.x2) + '" y2="' + r1(it.y2) + '" stroke="' + c + '" stroke-width="' + Math.max(1.5, w * 0.7) + '" stroke-linecap="round"/>'
          + '<circle cx="' + r1(it.x1) + '" cy="' + r1(it.y1) + '" r="' + (3 + w * 0.6) + '" fill="' + c + '"/>'
          + textSVG(lines, right ? it.x2 + 8 : it.x2 - 8, it.y2 - sz.h / 2, it.size, c, right ? 'start' : 'end', it.bold);
        if (hit) { var lb = bbox(it); out += '<rect x="' + r1(lb.x) + '" y="' + r1(lb.y) + '" width="' + r1(lb.w) + '" height="' + r1(lb.h) + '" fill="transparent"/>'; }
        break;
      }
      case 'stamp': {
        var st = stampById(it.sid);
        var sw = (it.width || 3) * 100 / Math.max(20, Math.min(it.w, it.h));
        out = '<svg x="' + r1(it.x) + '" y="' + r1(it.y) + '" width="' + r1(it.w) + '" height="' + r1(it.h) + '" viewBox="0 0 100 100" preserveAspectRatio="none" overflow="visible"><g fill="none" stroke="' + c + '" stroke-width="' + r1(sw) + '" stroke-linecap="round" stroke-linejoin="round">' + (st ? st.svg : '') + '</g></svg>';
        if (hit) out += '<rect x="' + r1(it.x) + '" y="' + r1(it.y) + '" width="' + r1(it.w) + '" height="' + r1(it.h) + '" fill="transparent"/>';
        break;
      }
      case 'figure': {
        var fb = figureBuilt(it);
        out = fb && !fb.error
          ? '<svg x="' + r1(it.x) + '" y="' + r1(it.y) + '" width="' + r1(it.w) + '" height="' + r1(it.h) + '" viewBox="' + fb.vb.join(' ') + '" preserveAspectRatio="xMidYMid meet" overflow="visible">' + fb.svg + '</svg>'
          : '<rect x="' + r1(it.x) + '" y="' + r1(it.y) + '" width="' + r1(it.w) + '" height="' + r1(it.h) + '" fill="none" stroke="#9ca3af" stroke-width="2" stroke-dasharray="10 8"/>'
            + '<text x="' + r1(it.x + 12) + '" y="' + r1(it.y + 30) + '" font-size="20" fill="#6b7280" font-family="Inter, system-ui, sans-serif">This figure could not be drawn</text>';
        if (hit) out += '<rect x="' + r1(it.x) + '" y="' + r1(it.y) + '" width="' + r1(it.w) + '" height="' + r1(it.h) + '" fill="transparent"/>';
        break;
      }
      case 'vector': {
        var vv = vecDrawn(it);
        out = vv ? vv.svg : '';
        if (hit) out += '<line x1="' + r1(it.x1) + '" y1="' + r1(it.y1) + '" x2="' + r1(it.x2) + '" y2="' + r1(it.y2) + '" ' + fat + '/>';
        break;
      }
      case 'image':
        out = '<image href="' + esc(it.href) + '" x="' + r1(it.x) + '" y="' + r1(it.y) + '" width="' + r1(it.w) + '" height="' + r1(it.h) + '" preserveAspectRatio="none"/>';
        break;
    }
    return '<g data-id="' + esc(it.id) + '">' + withCuts(it, out) + '</g>';
  }
  var cutSeq = 0;
  /** The eraser's cuts as holes in a mask over the item (see "The eraser"). */
  function withCuts(it, out) {
    if (!it.cuts || !it.cuts.length) return out;
    var b = bbox(it), m = (it.width || 3) * 3 + 40;
    var x = r1(b.x - m), y = r1(b.y - m), w = r1(b.w + m * 2), h = r1(b.h + m * 2);
    var id = 'pxCut' + (++cutSeq);
    var holes = it.cuts.map(function (c) {
      if (!c.pts) return '<rect x="' + r1(c.x) + '" y="' + r1(c.y) + '" width="' + r1(c.w) + '" height="' + r1(c.h) + '" fill="#000"/>';
      if (c.pts.length === 1) return '<circle cx="' + r1(c.pts[0][0]) + '" cy="' + r1(c.pts[0][1]) + '" r="' + r1(c.r) + '" fill="#000"/>';
      return '<path d="M' + c.pts.map(function (p) { return r1(p[0]) + ' ' + r1(p[1]); }).join(' L') + '" fill="none" stroke="#000" stroke-width="' + r1(c.r * 2) + '" stroke-linecap="round" stroke-linejoin="round"/>';
    }).join('');
    return '<mask id="' + id + '" maskUnits="userSpaceOnUse" x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '">'
      + '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" fill="#fff"/>' + holes + '</mask>'
      + '<g mask="url(#' + id + ')">' + out + '</g>';
  }
  function bgDefs(bg) {
    if (bg === 'grid') return '<pattern id="pxBg" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M40 0H0V40" fill="none" stroke="#c7d2fe" stroke-width="1"/><path d="M8 0V40M16 0V40M24 0V40M32 0V40M0 8H40M0 16H40M0 24H40M0 32H40" stroke="#e0e7ff" stroke-width=".6"/></pattern>';
    if (bg === 'dots') return '<pattern id="pxBg" width="32" height="32" patternUnits="userSpaceOnUse"><circle cx="16" cy="16" r="1.6" fill="#a5b4fc"/></pattern>';
    if (bg === 'lines') return '<pattern id="pxBg" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M0 39.5H40" stroke="#bfdbfe" stroke-width="1"/></pattern>';
    return '';
  }
  /** The whole page as a standalone SVG, for export and thumbnails. */
  function docSVG(doc, opts) {
    opts = opts || {};
    var defs = bgDefs(doc.bg);
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + W + ' ' + H + '"' + (opts.size ? ' width="' + opts.size[0] + '" height="' + opts.size[1] + '"' : '') + '>'
      + (defs ? '<defs>' + defs + '</defs>' : '')
      + '<rect width="' + W + '" height="' + H + '" fill="#ffffff"/>'
      + (defs ? '<rect width="' + W + '" height="' + H + '" fill="url(#pxBg)"/>' : '')
      + doc.items.map(function (it) { return itemSVG(it, false); }).join('')
      + '</svg>';
  }

  /* ── Export ─────────────────────────────────────────────────────────── */

  function download(name, blob) {
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  function safeName(s) { return String(s || 'drawing').replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-').slice(0, 60) || 'drawing'; }
  /** The page as a PNG blob, twice the page size for crisp printing. */
  function pngBlob(doc) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(new Blob([docSVG(doc, { size: [W, H] })], { type: 'image/svg+xml' }));
      var img = new Image();
      img.onload = function () {
        var cv = document.createElement('canvas');
        cv.width = W * 2; cv.height = H * 2;
        var g = cv.getContext('2d');
        g.drawImage(img, 0, 0, cv.width, cv.height);
        URL.revokeObjectURL(url);
        cv.toBlob(function (b) { b ? resolve(b) : reject(new Error('Could not make the picture')); }, 'image/png');
      };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error('Could not make the picture')); };
      img.src = url;
    });
  }
  /** Pictures go in scaled to at most 1200px, as JPEG unless they need transparency. */
  function readImage(file) {
    return new Promise(function (resolve, reject) {
      var fr = new FileReader();
      fr.onload = function () {
        var img = new Image();
        img.onload = function () {
          var s = Math.min(1, 1200 / Math.max(img.width, img.height));
          var cv = document.createElement('canvas');
          cv.width = Math.round(img.width * s); cv.height = Math.round(img.height * s);
          cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
          var png = /png|gif|svg/.test(file.type);
          resolve({ href: cv.toDataURL(png ? 'image/png' : 'image/jpeg', 0.85), w: cv.width, h: cv.height });
        };
        img.onerror = reject;
        img.src = fr.result;
      };
      fr.onerror = reject;
      fr.readAsDataURL(file);
    });
  }

  /* ── The example drawing ────────────────────────────────────────────── */

  function exampleDoc() {
    var c = '#111827';
    return newDoc({
      title: 'Example: heating water',
      bg: 'grid',
      items: [
        { id: uid(), type: 'text', x: 80, y: 60, text: 'Heating water with a Bunsen burner', size: 44, color: c, bold: true },
        { id: uid(), type: 'stamp', sid: 'flask', x: 640, y: 250, w: 260, h: 300, color: '#2563eb', width: 4 },
        { id: uid(), type: 'stamp', sid: 'burner', x: 680, y: 600, w: 180, h: 240, color: c, width: 4 },
        { id: uid(), type: 'label', x1: 770, y1: 470, x2: 1050, y2: 420, text: 'Water', size: 30, color: c, width: 3 },
        { id: uid(), type: 'label', x1: 770, y1: 640, x2: 1050, y2: 640, text: 'Flame', size: 30, color: '#ea580c', width: 3 },
        { id: uid(), type: 'label', x1: 715, y1: 285, x2: 420, y2: 230, text: 'Conical flask', size: 30, color: c, width: 3 },
        { id: uid(), type: 'arrow', x1: 1080, y1: 260, x2: 1080, y2: 140, color: '#dc2626', width: 5 },
        { id: uid(), type: 'text', x: 1110, y: 170, text: 'Steam rises', size: 28, color: '#dc2626' },
        { id: uid(), type: 'hl', pts: [[400, 905], [700, 905]], color: '#ca8a04', width: 26 },
        { id: uid(), type: 'text', x: 400, y: 880, text: 'Wear goggles!', size: 32, color: c, bold: true },
      ],
    });
  }

  /* ── The app ────────────────────────────────────────────────────────── */

  function mount(host) {
    var cleanup = null;

    function render() {
      if (cleanup) { try { cleanup(); } catch (e) {} cleanup = null; }
      // The editor takes the whole window; the gallery keeps the page's own header.
      document.body.classList.toggle('px-full', /^#\/d\//.test(location.hash || ''));
      var fl = (location.hash || '').match(/^#\/fig\/(.+)$/);
      if (fl) {
        // A share link: the gallery behind, the figure's settings in the panel.
        gallery();
        var spec = window.FluxFigures && window.FluxFigures.decode(fl[1]);
        if (!spec) { toast('That link does not hold a figure Flux Pixel knows.', 'warn'); return; }
        figureToNewPage(spec, true);
        return;
      }
      var m = (location.hash || '').match(/^#\/d\/([^/]+)$/);
      if (m) {
        var d = getDoc(decodeURIComponent(m[1]));
        if (d) return editor(d);
        host.innerHTML = '<div class="px-empty"><h2>That drawing is not here</h2><p>It may have been deleted, or it was made on another device.</p><a class="px-btn px-btn--primary" href="#/">My drawings</a></div>';
        return;
      }
      gallery();
    }

    /** Open the Maths figures panel; Insert puts the figure on a new page. */
    function figureToNewPage(spec, fromLink) {
      if (!window.FluxPixelFigures) { toast('Flux Figures could not load. Try refreshing.', 'warn'); return; }
      window.FluxPixelFigures.open({
        spec: spec,
        onDone: function (sp) {
          var it = figureItem(sp);
          if (!it) return;
          it.id = uid();
          var d = newDoc({ title: window.FluxFigures.describe(sp).slice(0, 80), bg: 'plain', items: [it] });
          putDoc(d);
          location.hash = '#/d/' + encodeURIComponent(d.id);
        },
        onCancel: function () { if (fromLink) location.hash = '#/'; },
      });
    }

    /* ── Gallery ─────────────────────────────────────────────────────── */

    function gallery() {
      var list = docs();
      host.innerHTML = '<section class="px-hero"><div><h1>Draw it, label it, export it</h1>'
        + '<p>Diagrams for science, maps for geography, sketches for anything. Stamps for lab equipment and circuits, labels with leader lines, Flux Figures, its maths figures mode, for tests and worksheets drawn to scale (type “right triangle 3 4 5” or “y > 2x − 1” and it draws it), a ruler, protractor and compass, vectors you can add tip to tail, and a crisp PNG for your notes or lab report. Free, no account, no ads.</p></div>'
        + '<div class="px-new"><span class="px-new-h">Start a new page</span><div class="px-new-row">'
        + BGS.map(function (b) {
          return '<button type="button" class="px-new-btn" data-new="' + b[0] + '"><span class="px-paper px-paper--' + b[0] + '"></span>' + esc(b[1]) + '</button>';
        }).join('') + '<button type="button" class="px-new-btn" data-fig-new><span class="px-paper px-paper--fig">' + ICON.figure + '</span>Flux Figures</button>'
        + '</div></div></section>'
        + (list.length ? '<h2 class="px-h2">Your drawings</h2><div class="px-grid">' + list.map(function (d) {
          return '<div class="px-card"><a class="px-thumb" href="#/d/' + encodeURIComponent(d.id) + '" aria-label="Open ' + esc(d.title) + '">' + docSVG(d) + '</a>'
            + '<div class="px-card-foot"><div><b>' + esc(d.title) + '</b><span>' + new Date(d.updated).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) + ' · ' + d.items.length + ' item' + (d.items.length === 1 ? '' : 's') + '</span></div>'
            + '<button type="button" class="px-icon" data-del="' + esc(d.id) + '" aria-label="Delete ' + esc(d.title) + '" title="Delete">' + ICON.trash + '</button></div></div>';
        }).join('') + '</div>' : '<div class="px-empty"><h2>No drawings yet</h2><p>Pick a page above to start, or open the example to see what Flux Pixel can do.</p></div>')
        + '<div class="px-foot"><button type="button" class="px-link" data-example>Open the example drawing</button></div>'
        + '<p class="px-note">Drawings are saved in this browser. Export a PNG or SVG to keep a copy anywhere.</p>';
      host.onclick = function (e) {
        var t = e.target.closest('[data-new],[data-del],[data-example],[data-fig-new]');
        if (!t) return;
        if (t.hasAttribute('data-fig-new')) { var fd = newDoc({ title: 'Flux Figures', bg: 'plain' }); fd.mode = 'figures'; putDoc(fd); location.hash = '#/d/' + encodeURIComponent(fd.id); return; }
        if (t.dataset.new) { var d = newDoc({ bg: t.dataset.new }); putDoc(d); location.hash = '#/d/' + encodeURIComponent(d.id); return; }
        if (t.hasAttribute('data-example')) { var ex = exampleDoc(); putDoc(ex); location.hash = '#/d/' + encodeURIComponent(ex.id); return; }
        if (t.dataset.del) {
          var doc = getDoc(t.dataset.del);
          if (doc && window.confirm('Delete “' + doc.title + '”? This cannot be undone.')) { removeDoc(doc.id); render(); }
        }
      };
      cleanup = function () { host.onclick = null; };
    }

    /* ── Editor ──────────────────────────────────────────────────────── */

    function editor(doc) {
      var st = {
        tool: 'pen', color: '#111827', width: 4, fill: false, dash: false,
        sel: null, zoom: 1, stamp: null, drag: null, draft: null,
        hist: [JSON.stringify(doc.items)], hi: 0,
        eraseMode: 'whole', eraseR: 18,
      };
      try {
        var ep = JSON.parse(localStorage.getItem(ERASE_PREF) || 'null');
        if (ep && ERASE_MODES.some(function (m) { return m[0] === ep.mode; })) st.eraseMode = ep.mode;
        if (ep && ep.r >= 4 && ep.r <= 80) st.eraseR = ep.r;
      } catch (e) {}
      function saveErasePref() { try { localStorage.setItem(ERASE_PREF, JSON.stringify({ mode: st.eraseMode, r: st.eraseR })); } catch (e) {} }

      /* ── Vectors ─────────────────────────────────────────────────────
         The Vector tool draws an arrow from tail to head. Each vector keeps
         its scale (page units per unit, sx and sy), so its length and
         direction read in squares of the paper, or in a coordinate grid's
         own numbers when it is drawn on one. Adding vectors makes new
         items (dashed copies placed tip to tail, and a resultant R), so
         undo takes the whole step back. */
      st.vec = { snap: true, showMag: true, showDir: true, comps: false, dirFmt: 'angle', prec: 1, per: 1, unit: '', label: 'A', entry: 'polar', m: '5', a: '30', cx: '3', cy: '4', k: '2' };
      try { var vp = JSON.parse(localStorage.getItem(VEC_PREF) || 'null'); if (vp) Object.keys(st.vec).forEach(function (k) { if (vp[k] != null && typeof vp[k] === typeof st.vec[k]) st.vec[k] = vp[k]; }); } catch (e) {}
      st.vpick = {};
      function saveVecPref() { try { localStorage.setItem(VEC_PREF, JSON.stringify(st.vec)); } catch (e) {} }
      var FV = window.FluxFigures ? window.FluxFigures.vec : null;
      function fx(n, p) { return window.FluxFigures ? window.FluxFigures.fixed(n, p) : String(n); }
      function numIn(v) { var n = parseFloat(String(v == null ? '' : v).replace(/−/g, '-').replace(',', '.')); return isFinite(n) ? n : NaN; }
      function nextLabel(l) {
        if (/^[A-Z]$/.test(l)) { var c = l.charCodeAt(0) + 1; if (c === 82) c++; return c <= 90 ? String.fromCharCode(c) : 'A'; }
        var m = /^(.*?)(\d+)$/.exec(l || '');
        return m ? m[1] + (+m[2] + 1) : (l || '');
      }
      function vecItems() { return doc.items.filter(function (i) { return i.type === 'vector'; }); }
      /** A coordinate grid figure under page point p: its scale and origin in page units. */
      function gridAt(p) {
        for (var i = doc.items.length - 1; i >= 0; i--) {
          var it = doc.items[i];
          if (it.type !== 'figure' || !it.fig || it.fig.kind !== 'grid') continue;
          var fb = figureBuilt(it);
          if (!fb || fb.error || !fb.info || !fb.info.grid) continue;
          var g = fb.info.grid, vb = fb.vb, k = Math.min(it.w / vb[2], it.h / vb[3]);
          var ox = it.x + (it.w - vb[2] * k) / 2, oy = it.y + (it.h - vb[3] * k) / 2;
          var pg = function (vx, vy) { return [ox + (vx - vb[0]) * k, oy + (vy - vb[1]) * k]; };
          var a = pg(0, -g.H), b = pg(g.W, 0);
          if (p[0] < a[0] - 2 || p[0] > b[0] + 2 || p[1] < a[1] - 2 || p[1] > b[1] + 2) continue;
          var o = pg(-g.x0 / g.dx * g.cell, g.y0 / g.dy * g.cell);
          return { sx: g.cell / g.dx * k, sy: g.cell / g.dy * k, ox: o[0], oy: o[1], dx: g.dx, dy: g.dy };
        }
        return null;
      }
      function snapV(p, g) {
        if (!st.vec.snap) return p;
        if (g) {
          var ux = Math.round((p[0] - g.ox) / g.sx / g.dx) * g.dx, uy = Math.round((g.oy - p[1]) / g.sy / g.dy) * g.dy;
          return [g.ox + ux * g.sx, g.oy - uy * g.sy];
        }
        var sq = 40;
        return [Math.round(p[0] / sq) * sq, Math.round(p[1] / sq) * sq];
      }
      function paperScale() { var per = numIn(st.vec.per); return 40 / (per > 0 ? per : 1); }
      function vecStyle(g) {
        var sc = g ? g.sx : paperScale();
        return { type: 'vector', color: st.color, width: Math.max(2, Math.min(8, st.width)), size: 24, label: st.vec.label, sx: sc, sy: g ? g.sy : sc,
          unit: st.vec.unit, prec: st.vec.prec, showMag: st.vec.showMag, showDir: st.vec.showDir, dirFmt: st.vec.dirFmt, comps: st.vec.comps };
      }
      /** A new vector like `base`, tail at t (page), value v (units). */
      function vecFrom(base, t, v, extra) {
        var sx = base.sx || 40, sy = base.sy || sx;
        var o = { type: 'vector', x1: t[0], y1: t[1], x2: t[0] + v.x * sx, y2: t[1] - v.y * sy, color: base.color, width: base.width, size: base.size || 24,
          label: base.label, sx: sx, sy: sy, unit: base.unit, prec: base.prec, showMag: base.showMag, showDir: base.showDir, dirFmt: base.dirFmt, comps: false };
        return Object.assign(o, extra || {});
      }
      function headOf(it) { return [it.x2, it.y2]; }
      function addMany(list) {
        list.forEach(function (it) { it.id = uid(); doc.items.push(it); });
        drawItems(); commit();
        return list;
      }
      function picked() {
        return vecItems().filter(function (v) { return st.vpick[v.id] != null ? st.vpick[v.id] : !v.role; });
      }
      function afterOp(sel) {
        st.tool = 'select'; svg.setAttribute('data-mode', 'select');
        st.sel = sel.id; drawTools(); drawSel(); drawProps();
        toast((sel.label ? sel.label + ' = ' : '') + FV.text(Object.assign({}, sel, { label: '', showMag: true, showDir: true })));
      }
      function vecOp(kind) {
        var list = picked();
        var need = { tip: [2, 'Tick two or more vectors to add them tip to tail.'], para: [2, 'Tick exactly two vectors for the parallelogram method.'], sub: [2, 'Tick exactly two vectors to subtract the second from the first.'], mul: [1, 'Tick one vector to multiply.'] }[kind];
        if (kind === 'tip' ? list.length < 2 : list.length !== need[0]) { toast(need[1], 'warn'); return; }
        var A = list[0], vals = list.map(FV.value), out = [], start = [A.x1, A.y1], sc = { x: A.sx || 40, y: A.sy || A.sx || 40 };
        var step = function (p, v) { return [p[0] + v.x * sc.x, p[1] - v.y * sc.y]; };
        var R = null;
        if (kind === 'tip') {
          var P = step(start, vals[0]);
          for (var i = 1; i < list.length; i++) {
            if (Math.hypot(list[i].x1 - P[0], list[i].y1 - P[1]) > 1) out.push(vecFrom(Object.assign({}, list[i], { sx: sc.x, sy: sc.y }), P, vals[i], { dash: true, role: 'copy', showMag: false, showDir: false }));
            P = step(P, vals[i]);
          }
          R = vecFrom(A, start, FV.sum(vals), { label: 'R', role: 'resultant', color: RESULTANT, width: (A.width || 3) + 1.5, showMag: true, showDir: true, dash: false });
        } else if (kind === 'para') {
          var B = list[1], BB = Object.assign({}, B, { sx: sc.x, sy: sc.y });
          if (Math.hypot(B.x1 - start[0], B.y1 - start[1]) > 1) out.push(vecFrom(BB, start, vals[1], { dash: true, role: 'copy', showMag: false, showDir: false }));
          out.push(vecFrom(Object.assign({}, A), step(start, vals[1]), vals[0], { dash: true, role: 'copy', showMag: false, showDir: false }));
          out.push(vecFrom(BB, step(start, vals[0]), vals[1], { dash: true, role: 'copy', showMag: false, showDir: false }));
          R = vecFrom(A, start, FV.sum(vals), { label: 'R', role: 'resultant', color: RESULTANT, width: (A.width || 3) + 1.5, showMag: true, showDir: true, dash: false });
        } else if (kind === 'sub') {
          var nb = FV.scale(vals[1], -1), nl = list[1].label ? '−' + list[1].label : '';
          out.push(vecFrom(Object.assign({}, list[1], { sx: sc.x, sy: sc.y }), step(start, vals[0]), nb, { dash: true, role: 'copy', label: nl, showMag: false, showDir: false }));
          R = vecFrom(A, start, FV.sum([vals[0], nb]), { label: 'R', role: 'resultant', color: RESULTANT, width: (A.width || 3) + 1.5, showMag: true, showDir: true, dash: false });
        } else {
          var k = numIn(st.vec.k);
          if (!isFinite(k) || k === 0) { toast('Type a number to multiply by (not 0).', 'warn'); return; }
          var kl = k === -1 ? '−' : window.FluxFigures.fmt(k, 3);
          var off = A.y1 + 60 < H ? 60 : -60;
          R = vecFrom(A, [A.x1, A.y1 + off], FV.scale(vals[0], k), { label: A.label ? kl + A.label : '', dash: false });
        }
        out.push(R);
        addMany(out);
        afterOp(R);
      }
      /** Where on the page to put something new: the middle of what is on screen. */
      function visibleCentre() {
        var r = stage.getBoundingClientRect(), pt = svg.createSVGPoint();
        pt.x = r.left + r.width / 2;
        pt.y = r.top + Math.max(40, Math.min(r.height, window.innerHeight - r.top)) / 2;
        var q = pt.matrixTransform(svg.getScreenCTM().inverse());
        return [Math.max(0, Math.min(W, q.x)), Math.max(0, Math.min(H, q.y))];
      }
      function typedVector() {
        var v;
        if (st.vec.entry === 'comp') {
          var x = numIn(st.vec.cx), y = numIn(st.vec.cy);
          if (!isFinite(x) || !isFinite(y)) return { error: 'Type both components, like x = 3 and y = 4.' };
          v = { x: x, y: y };
        } else {
          var m = numIn(st.vec.m), a = numIn(st.vec.a);
          if (!(m > 0)) return { error: 'Type a length more than 0.' };
          if (!isFinite(a)) return { error: 'Type a direction in degrees.' };
          v = FV.fromPolar(m, st.vec.dirFmt === 'angle' ? a : FV.fromBearing(a));
        }
        if (!v.x && !v.y) return { error: 'A vector of length 0 has no arrow to draw.' };
        return v;
      }
      function addTypedVector() {
        var v = typedVector();
        if (v.error) { toast(v.error, 'warn'); return; }
        var base = vecStyle(null), c = visibleCentre();
        var it = vecFrom(base, [c[0] - v.x * base.sx / 2, c[1] + v.y * base.sy / 2], v);
        addItem(it);
        st.vec.label = nextLabel(st.vec.label); saveVecPref();
        drawProps();
        var b = props.querySelector('[data-act="vadd"]'); if (b) b.focus();
      }
      function dirLabel(fmt) { return fmt === 'angle' ? 'Angle from +x (°)' : 'Bearing (°)'; }
      function opt(list, cur) { return list.map(function (o) { return '<option value="' + o[0] + '"' + (String(o[0]) === String(cur) ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; }).join(''); }
      var PRECS = [[0, 'Whole numbers'], [1, '1 decimal place'], [2, '2 decimal places'], [3, '3 decimal places']];
      function chip(attr, key, on, text) { return '<button type="button" class="px-chip' + (on ? ' is-on' : '') + '" ' + attr + '="' + key + '" aria-pressed="' + !!on + '">' + esc(text) + '</button>'; }
      function field(id, label, attr, val, extra) {
        return '<div class="px-vf"><label class="px-vlab" for="' + id + '">' + esc(label) + '</label><input class="px-vin" id="' + id + '" ' + attr + ' value="' + esc(val) + '" autocomplete="off"' + (extra || '') + '></div>';
      }
      function vecToolHTML() {
        var V = st.vec;
        return '<div class="px-sec px-vsec"><span class="px-sec-h">Vector</span>'
          + '<p class="px-hint">Drag from the tail to the head. On a coordinate grid it snaps to the grid and reads the grid’s numbers.</p>'
          + field('pxVLabel', 'Label for the next one', 'data-vset="label" maxlength="12"', V.label)
          + '<div class="px-row" role="group" aria-label="Vector options">' + chip('data-vtog', 'snap', V.snap, 'Snap to grid') + chip('data-vtog', 'showMag', V.showMag, 'Length') + chip('data-vtog', 'showDir', V.showDir, 'Direction') + chip('data-vtog', 'comps', V.comps, 'Components') + '</div>'
          + '<div class="px-vf"><label class="px-vlab" for="pxVDir">Direction as</label><select class="px-vin" id="pxVDir" data-vset="dirFmt">' + opt(VEC_DIRS, V.dirFmt) + '</select></div>'
          + '<div class="px-vf"><label class="px-vlab" for="pxVPrec">Round to</label><select class="px-vin" id="pxVPrec" data-vset="prec">' + opt(PRECS, V.prec) + '</select></div>'
          + '<div class="px-vpair">' + field('pxVPer', 'One square is', 'data-vset="per" inputmode="decimal"', V.per) + field('pxVUnit', 'Unit', 'data-vset="unit" maxlength="8" placeholder="N, m/s"', V.unit) + '</div>'
          + '</div>'
          + '<div class="px-sec px-vsec"><span class="px-sec-h" id="pxVTypeH">Type a vector</span>'
          + '<div class="px-row" role="group" aria-labelledby="pxVTypeH">' + chip('data-ventry', 'polar', V.entry !== 'comp', 'Length and direction') + chip('data-ventry', 'comp', V.entry === 'comp', 'Components') + '</div>'
          + (V.entry === 'comp'
            ? '<div class="px-vpair">' + field('pxVCx', 'x', 'data-vset="cx" inputmode="decimal"', V.cx) + field('pxVCy', 'y', 'data-vset="cy" inputmode="decimal"', V.cy) + '</div>'
            : '<div class="px-vpair">' + field('pxVM', 'Length', 'data-vset="m" inputmode="decimal"', V.m) + field('pxVA', dirLabel(V.dirFmt), 'data-vset="a" inputmode="decimal"', V.a) + '</div>')
          + '<button type="button" class="px-btn px-btn--small" data-act="vadd">Add vector ' + esc(V.label) + '</button></div>';
      }
      function vecOpsHTML() {
        var list = vecItems();
        if (!list.length) return '';
        return '<div class="px-sec px-vsec"><span class="px-sec-h" id="pxVOpsH">Add vectors</span>'
          + '<div class="px-vlist" role="group" aria-labelledby="pxVOpsH">' + list.map(function (v, i) {
            var on = st.vpick[v.id] != null ? st.vpick[v.id] : !v.role;
            return '<label class="px-vpick"><input type="checkbox" data-vpick="' + esc(v.id) + '"' + (on ? ' checked' : '') + '><span>' + esc(FV.text(Object.assign({}, v, { label: v.label || 'Vector ' + (i + 1), showMag: true, showDir: true })).replace(/_/g, '')) + '</span></label>';
          }).join('') + '</div>'
          + '<div class="px-row"><button type="button" class="px-btn px-btn--small" data-act="vtip">Tip to tail</button><button type="button" class="px-btn px-btn--small" data-act="vpara">Parallelogram</button><button type="button" class="px-btn px-btn--small" data-act="vsub">First − second</button></div>'
          + '<div class="px-vpair px-vpair--k">' + field('pxVK', 'Multiply by', 'data-vset="k" inputmode="decimal"', st.vec.k) + '<button type="button" class="px-btn px-btn--small" data-act="vmul">× k</button></div>'
          + '<p class="px-hint">Tick the vectors in the order to add them. The resultant R is drawn in red with its length and direction.</p></div>';
      }
      function vecSelHTML(it) {
        var v = FV.value(it), p = it.prec == null ? 1 : it.prec, mag = FV.magnitude(v), deg = FV.direction(v), dir = it.dirFmt === 'angle' || !it.dirFmt ? deg : FV.toBearing(deg);
        return '<div class="px-sec px-vsec"><span class="px-sec-h">' + (it.role === 'resultant' ? 'Resultant' : 'Vector') + '</span>'
          + field('pxVeLabel', 'Label', 'data-vedit="label" maxlength="12"', it.label || '')
          + '<div class="px-vpair">' + field('pxVeM', 'Length' + (it.unit ? ' (' + it.unit + ')' : ''), 'data-vedit="mag" inputmode="decimal"', fx(mag, Math.max(p, 2)).replace('−', '-'))
          + field('pxVeA', dirLabel(it.dirFmt || 'angle'), 'data-vedit="dir" inputmode="decimal"', fx(dir, Math.max(p, 1))) + '</div>'
          + '<div class="px-vpair">' + field('pxVeX', 'x component', 'data-vedit="x" inputmode="decimal"', fx(v.x, Math.max(p, 2)).replace('−', '-'))
          + field('pxVeY', 'y component', 'data-vedit="y" inputmode="decimal"', fx(v.y, Math.max(p, 2)).replace('−', '-')) + '</div>'
          + '<div class="px-row" role="group" aria-label="Show on the page">' + chip('data-vtog', 'showMag', it.showMag !== false, 'Length') + chip('data-vtog', 'showDir', it.showDir, 'Direction') + chip('data-vtog', 'comps', it.comps, 'Components') + '</div>'
          + '<div class="px-vpair"><div class="px-vf"><label class="px-vlab" for="pxVeDir">Direction as</label><select class="px-vin" id="pxVeDir" data-vedit="dirFmt">' + opt(VEC_DIRS, it.dirFmt || 'angle') + '</select></div>'
          + '<div class="px-vf"><label class="px-vlab" for="pxVePrec">Round to</label><select class="px-vin" id="pxVePrec" data-vedit="prec">' + opt(PRECS, p) + '</select></div></div>'
          + field('pxVeUnit', 'Unit', 'data-vedit="unit" maxlength="8"', it.unit || '')
          + '</div>'
          + '<div class="px-sec px-vsec"><span class="px-sec-h">Lab check</span>'
          + '<p class="px-hint">Type what you measured for this ' + (it.role === 'resultant' ? 'resultant' : 'vector') + ' to see the percent error.</p>'
          + '<div class="px-vpair">' + field('pxLabM', 'Measured length', 'data-labm inputmode="decimal"', st.labM || '') + field('pxLabA', 'Measured ' + (it.dirFmt === 'angle' || !it.dirFmt ? 'angle (°)' : 'bearing (°)'), 'data-laba inputmode="decimal"', st.labA || '') + '</div>'
          + '<p class="px-labout" id="pxLabOut" aria-live="polite"></p></div>';
      }
      function labCheck() {
        var it = selected(), out = $('#pxLabOut', host);
        if (!it || it.type !== 'vector' || !out) return;
        var m = numIn(st.labM), a = numIn(st.labA), p = it.prec == null ? 1 : it.prec;
        if (!isFinite(m) && !isFinite(a)) { out.textContent = ''; return; }
        var r = FV.labCheck({ mag: m, dir: a }, FV.value(it), it.dirFmt), u = it.unit ? ' ' + it.unit : '', bits = [];
        if (isFinite(m)) bits.push('Length: worked out ' + fx(r.mag, p) + u + ', you measured ' + fx(m, p) + u + ', so ' + fx(r.magErr, 1) + '% error.');
        if (isFinite(a)) bits.push('Direction: worked out ' + fx(r.dir, p) + '°, ' + fx(r.dirGap, p) + '° off' + (isFinite(r.dirErr) ? ' (' + fx(r.dirErr, 1) + '% error).' : '.'));
        out.textContent = bits.join(' ');
      }
      /** Change a selected vector from the panel; the tail stays put. */
      function editVector(it, key, val) {
        var v = FV.value(it), sx = it.sx || 40, sy = it.sy || sx, n;
        if (key === 'label' || key === 'unit') { it[key] = String(val).slice(0, 12); }
        else if (key === 'dirFmt') it.dirFmt = val;
        else if (key === 'prec') it.prec = +val;
        else {
          n = numIn(val);
          if (!isFinite(n)) { toast('Type a number.', 'warn'); drawProps(); return; }
          if (key === 'x') v.x = n;
          else if (key === 'y') v.y = n;
          else {
            var mag = FV.magnitude(v), deg = FV.direction(v);
            if (key === 'mag') { if (!(n > 0)) { toast('The length has to be more than 0.', 'warn'); drawProps(); return; } mag = n; }
            else deg = it.dirFmt === 'bearing' || it.dirFmt === 'compass' ? FV.fromBearing(n) : n;
            v = FV.fromPolar(mag, deg);
          }
          if (!v.x && !v.y) { toast('A vector of length 0 has no arrow to draw.', 'warn'); drawProps(); return; }
          it.x2 = it.x1 + v.x * sx; it.y2 = it.y1 - v.y * sy;
        }
        drawItems(); commit(); drawProps();
        var again = props.querySelector('[data-vedit="' + key + '"]'); if (again) again.focus();
      }

      /* ── Maths figures ──────────────────────────────────────────────── */
      function openFigures(existing) {
        if (!window.FluxPixelFigures) { toast('Flux Figures could not load. Try refreshing.', 'warn'); return; }
        var id = existing && existing.id;
        window.FluxPixelFigures.open({
          spec: existing ? existing.fig : null,
          mode: existing ? 'edit' : 'insert',
          color: existing ? existing.color : '#111827',
          onDone: function (spec) {
            var cur = id && doc.items.filter(function (i) { return i.id === id; })[0];
            if (cur) updateFigure(cur, spec); else insertFigure(spec);
          },
        });
      }
      function insertFigure(spec) {
        var it = freeSpot(spec);
        if (!it) return;
        addItem(it);
        st.tool = 'select'; svg.setAttribute('data-mode', 'select');
        st.sel = it.id; drawTools(); drawSel(); drawProps();
      }
      /** New settings for a figure on the page: same middle, same scale. */
      function updateFigure(it, spec) {
        var old = figureBuilt(it), nb = window.FluxFigures.build(spec);
        if (nb.error) return;
        var k = old && !old.error ? Math.min(it.w / old.w, it.h / old.h) : Math.min(1, (W * 0.8) / nb.w, (H * 0.8) / nb.h);
        var cx = it.x + it.w / 2, cy = it.y + it.h / 2;
        it.fig = window.FluxFigures.clean(spec);
        it.w = nb.w * k; it.h = nb.h * k; it.x = cx - it.w / 2; it.y = cy - it.h / 2;
        st.sel = it.id;
        drawItems(); drawProps(); commit();
      }
      /** One item as a PNG on white: what is drawn, eraser holes and all. */
      function itemPng(it) {
        var b = bbox(it), m = 12, x = b.x - m, y = b.y - m, w = b.w + m * 2, h = b.h + m * 2;
        var text = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="' + [x, y, w, h].map(r1).join(' ') + '" width="' + Math.round(w * 2) + '" height="' + Math.round(h * 2) + '"><rect x="' + r1(x) + '" y="' + r1(y) + '" width="' + r1(w) + '" height="' + r1(h) + '" fill="#ffffff"/>' + itemSVG(it, false) + '</svg>';
        return window.FluxPixelFigures.svgToPng(text, w * 2, h * 2);
      }
      function figSelHTML(it) {
        return '<div class="px-sec px-fi" id="pxFigInline"><span class="px-sec-h">Change this figure</span><div data-fi-box></div></div>'
          + '<div class="px-sec"><div class="px-row">'
          + '<button type="button" class="px-btn px-btn--small" data-act="itemcopy">' + ICON.copy + 'Copy figure</button>'
          + '<button type="button" class="px-btn px-btn--small" data-act="figlink">' + ICON.link + 'Share link</button></div></div>';
      }
      /* The figure follows the side panel as it is typed into: same middle, same
         scale. One undo step for a burst of typing, not one per key. */
      var figCommitTimer = 0;
      function liveFigure(id, spec) {
        var it = doc.items.filter(function (i) { return i.id === id; })[0];
        if (!it) return;
        var old = figureBuilt(it), nb = window.FluxFigures.build(spec);
        if (nb.error) return;
        var k = old && !old.error ? Math.min(it.w / old.w, it.h / old.h) : Math.min(1, (W * 0.8) / nb.w, (H * 0.8) / nb.h);
        var cx = it.x + it.w / 2, cy = it.y + it.h / 2;
        it.fig = spec; it.w = nb.w * k; it.h = nb.h * k; it.x = cx - it.w / 2; it.y = cy - it.h / 2;
        drawItems();
        clearTimeout(figCommitTimer);
        figCommitTimer = setTimeout(function () { commit('Changed the figure'); }, 500);
      }
      function mountFigInline(it) {
        var box = props.querySelector('[data-fi-box]');
        if (!box || !window.FluxPixelFigures || !window.FluxPixelFigures.inline) return;
        var id = it.id;
        window.FluxPixelFigures.inline(box, it.fig, {
          onChange: function (spec) { liveFigure(id, spec); },
          onMore: function () { var cur = doc.items.filter(function (i) { return i.id === id; })[0]; if (cur) openFigures(cur); },
        });
      }
      var saveTimer = null;

      host.innerHTML = '<div class="px-editor">'
        + '<div class="px-top">'
        + '<a class="px-icon" href="#/" aria-label="All drawings" title="All drawings">' + ICON.back + '</a>'
        + '<input class="px-title" value="' + esc(doc.title) + '" aria-label="Drawing name" maxlength="80">'
        + '<span class="px-saved" aria-live="polite"></span><span class="px-grow"></span>'
        + '<button type="button" class="px-icon" data-act="undo" aria-label="Undo" title="Undo (Ctrl+Z)">' + ICON.undo + '</button>'
        + '<button type="button" class="px-icon" data-act="redo" aria-label="Redo" title="Redo (Ctrl+Shift+Z)">' + ICON.redo + '</button>'
        + '<span class="px-zoom"><button type="button" class="px-icon" data-act="zoomout" aria-label="Zoom out">−</button><button type="button" class="px-zoom-v" data-act="zoomfit" title="Fit to screen">100%</button><button type="button" class="px-icon" data-act="zoomin" aria-label="Zoom in">+</button></span>'
        + '<div class="px-modes" role="group" aria-label="Mode">'
        + '<button type="button" class="px-mode" data-mode-set="draw">' + ICON.pen + '<span>Draw</span></button>'
        + '<button type="button" class="px-mode" data-mode-set="figures">' + ICON.figure + '<span>Flux Figures</span></button></div>'
        + '<button type="button" class="px-btn px-btn--small" data-act="copy">' + ICON.copy + '<span>Copy</span></button>'
        + '<button type="button" class="px-btn px-btn--small px-btn--primary" data-act="png">' + ICON.download + '<span>PNG</span></button>'
        + '<button type="button" class="px-btn px-btn--small" data-act="svg"><span>SVG</span></button>'
        + '<button type="button" class="px-icon px-panel-t" data-act="panel" aria-label="Options" title="Show or hide the options" aria-controls="pxProps">' + ICON.panel + '</button>'
        + '<div class="px-hub" data-flux-hub="pixel"></div>'
        + '</div>'
        + '<div class="px-body">'
        + '<div class="px-tools" role="toolbar" aria-label="Tools"></div>'
        + '<div class="px-stage" id="pxStage"><div class="px-wrap" id="pxWrap">'
        + '<svg class="px-svg" id="pxSvg" viewBox="0 0 ' + W + ' ' + H + '" xmlns="' + NS + '"><defs id="pxDefs"></defs>'
        + '<rect width="' + W + '" height="' + H + '" fill="#fff"/><rect id="pxBgRect" width="' + W + '" height="' + H + '" fill="none"/>'
        + '<g id="pxItems"></g><g id="pxDraft"></g><g id="pxSel"></g></svg>'
        + '<textarea class="px-textin" id="pxText" hidden rows="1" aria-label="Text"></textarea>'
        + '<div class="px-float" id="pxFloat" role="toolbar" aria-label="Selected" hidden></div></div></div>'
        + '<div class="px-props" id="pxProps"></div>'
        + '</div>'
        + '<input type="file" accept="image/*" id="pxFile" hidden>'
        + '</div>';

      var svg = $('#pxSvg', host), itemsG = $('#pxItems', host), draftG = $('#pxDraft', host), selG = $('#pxSel', host);
      var wrap = $('#pxWrap', host), stage = $('#pxStage', host), props = $('#pxProps', host), textIn = $('#pxText', host);

      /* Rendering */
      function drawBg() {
        $('#pxDefs', host).innerHTML = bgDefs(doc.bg);
        $('#pxBgRect', host).setAttribute('fill', doc.bg === 'plain' ? 'none' : 'url(#pxBg)');
      }
      function drawItems() { itemsG.innerHTML = doc.items.map(function (it) { return itemSVG(it, true); }).join(''); drawSel(); }
      function selected() { return st.sel ? doc.items.filter(function (i) { return i.id === st.sel; })[0] || null : null; }
      function drawSel() {
        var it = selected();
        if (!it) { selG.innerHTML = ''; drawFloat(null); return; }
        var b = bbox(it), p = 8, k = 1 / (pageScale() || 1), hs = Math.max(18, 14 * k);
        // A grab corner at each corner, big enough for a finger at any zoom.
        var corners = [['nw', b.x - p, b.y - p, 'nwse'], ['ne', b.x + b.w + p, b.y - p, 'nesw'], ['sw', b.x - p, b.y + b.h + p, 'nesw'], ['se', b.x + b.w + p, b.y + b.h + p, 'nwse']];
        selG.innerHTML = '<rect x="' + r1(b.x - p) + '" y="' + r1(b.y - p) + '" width="' + r1(b.w + p * 2) + '" height="' + r1(b.h + p * 2) + '" fill="none" stroke="#2563eb" stroke-width="' + r1(2 * k) + '" stroke-dasharray="' + r1(6 * k) + ' ' + r1(5 * k) + '" pointer-events="none"/>'
          + corners.map(function (c) {
            return '<rect data-handle="' + c[0] + '" x="' + r1(c[1] - hs / 2) + '" y="' + r1(c[2] - hs / 2) + '" width="' + r1(hs) + '" height="' + r1(hs) + '" rx="' + r1(hs / 4) + '" fill="#fff" stroke="#2563eb" stroke-width="' + r1(2.5 * k) + '" style="cursor:' + c[3] + '-resize"/>';
          }).join('');
        drawFloat(it, b);
      }
      /** A small bar of the obvious things to do, just above what is selected. */
      function drawFloat(it, b) {
        var bar = $('#pxFloat', host);
        if (!bar) return;
        if (!it || st.drag) { bar.hidden = true; return; }
        var s = pageScale(), edit = it.type === 'figure' ? 'Change' : (it.type === 'text' || it.type === 'label') ? 'Edit text' : '';
        bar.innerHTML = (edit ? '<button type="button" class="px-fl-b px-fl-b--main" data-act="' + (it.type === 'figure' ? 'figfocus' : 'edittext') + '">' + (it.type === 'figure' ? ICON.figure : ICON.text) + '<span>' + edit + '</span></button>' : '')
          + '<button type="button" class="px-fl-b" data-act="dup" aria-label="Duplicate" title="Duplicate (Ctrl+D)">' + ICON.copy + '</button>'
          + '<button type="button" class="px-fl-b" data-act="front" aria-label="To front" title="To front">' + ICON.front + '</button>'
          + '<button type="button" class="px-fl-b px-fl-b--danger" data-act="delete" aria-label="Delete" title="Delete (Del)">' + ICON.trash + '</button>';
        bar.hidden = false;
        var w = bar.offsetWidth || 160, x = (b.x + b.w / 2) * s - w / 2, y = (b.y - 8) * s - 48;
        if (y < 4) y = (b.y + b.h + 8) * s + 10;
        bar.style.left = Math.max(4, Math.min(wrap.clientWidth - w - 4, x)) + 'px';
        bar.style.top = Math.max(4, y) + 'px';
      }
      function drawProps() {
        var it = selected();
        var color = it ? (it.color || st.color) : st.color;
        var width = it ? (it.width || st.width) : st.width;
        var showFill = it ? (it.type === 'rect' || it.type === 'ellipse') : (st.tool === 'rect' || st.tool === 'ellipse');
        var showDash = it ? /^(line|arrow|rect|ellipse|vector)$/.test(it.type) : /^(line|arrow|rect|ellipse)$/.test(st.tool);
        var erasing = st.tool === 'eraser' && !it;
        if (st.mode === 'figures' && !it) {
          props.innerHTML = figStartHTML() + '<div class="px-sec"><span class="px-sec-h">Paper</span><div class="px-row">' + BGS.map(function (b) {
            return '<button type="button" class="px-chip' + (doc.bg === b[0] ? ' is-on' : '') + '" data-bg="' + b[0] + '">' + esc(b[1]) + '</button>';
          }).join('') + '</div></div>';
          return;
        }
        var html = erasing ? eraserHTML() : '<div class="px-sec"><span class="px-sec-h">Colour</span><div class="px-colors">' + COLORS.map(function (c) {
          return '<button type="button" class="px-color' + (c === color ? ' is-on' : '') + '" data-color="' + c + '" style="--c:' + c + '" aria-label="Colour ' + c + '"></button>';
        }).join('') + '<label class="px-color px-color--pick" title="Any colour"><input type="color" value="' + color + '" data-pick aria-label="Pick any colour"></label></div></div>';
        if (!erasing && (!it || (it.type !== 'image' && it.type !== 'figure'))) {
          html += '<div class="px-sec"><span class="px-sec-h">' + (it && (it.type === 'text' || it.type === 'label') ? 'Text size' : 'Thickness') + '</span>'
            + (it && (it.type === 'text' || it.type === 'label')
              ? '<input type="range" min="12" max="120" value="' + Math.round(it.size) + '" data-size aria-label="Text size">'
              : '<input type="range" min="1" max="' + (st.tool === 'hl' || (it && it.type === 'hl') ? 60 : 24) + '" value="' + width + '" data-width aria-label="Thickness">') + '</div>';
        }
        if (showFill || showDash) {
          html += '<div class="px-sec px-toggles">'
            + (showFill ? '<button type="button" class="px-chip' + ((it ? it.fill : st.fill) ? ' is-on' : '') + '" data-toggle="fill">Filled</button>' : '')
            + (showDash ? '<button type="button" class="px-chip' + ((it ? it.dash : st.dash) ? ' is-on' : '') + '" data-toggle="dash">Dashed</button>' : '')
            + '</div>';
        }
        if (it && (it.type === 'text' || it.type === 'label')) html += '<div class="px-sec px-toggles"><button type="button" class="px-chip' + (it.bold ? ' is-on' : '') + '" data-toggle="bold">Bold</button><button type="button" class="px-chip" data-act="edittext">Edit text</button></div>';
        if (st.tool === 'stamp') {
          html += '<div class="px-sec px-stamps"><span class="px-sec-h">Stamps — pick one, then tap the page</span>'
            + '<input type="search" class="px-stamp-q" placeholder="Search stamps" aria-label="Search stamps" value="' + esc(st.stampQ || '') + '">'
            + '<p class="px-stamp-none" hidden>No stamp by that name.</p>' + (window.FluxPixelStamps || []).map(function (g) {
            return '<div class="px-stamp-g" data-group="' + esc(g.group.toLowerCase()) + '"><b>' + esc(g.group) + '</b><div class="px-stamp-row">' + g.items.map(function (s) {
              return '<button type="button" class="px-stamp' + (st.stamp === s.id ? ' is-on' : '') + '" data-stamp="' + s.id + '" data-name="' + esc(s.name.toLowerCase()) + '" title="' + esc(s.name) + '" aria-label="' + esc(s.name) + '"><svg viewBox="-6 -6 112 112"><g fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round" stroke-linejoin="round">' + s.svg + '</g></svg></button>';
            }).join('') + '</div></div>';
          }).join('') + '</div>';
        }
        if (it && it.type === 'figure') html += figSelHTML(it);
        if (FV && it && it.type === 'vector') html += vecSelHTML(it);
        if (FV && !it && st.tool === 'vector') html += vecToolHTML();
        if (FV && ((it && it.type === 'vector') || (!it && st.tool === 'vector'))) html += vecOpsHTML();
        if (it) {
          html += '<div class="px-sec px-sel-acts"><span class="px-sec-h">Selected</span><div class="px-row">'
            + '<button type="button" class="px-btn px-btn--small" data-act="dup">' + ICON.copy + 'Duplicate</button>'
            + '<button type="button" class="px-btn px-btn--small" data-act="front">' + ICON.front + 'To front</button>'
            + '<button type="button" class="px-btn px-btn--small px-btn--danger" data-act="delete">' + ICON.trash + 'Delete</button></div></div>';
        }
        html += '<div class="px-sec"><span class="px-sec-h">Paper</span><div class="px-row">' + BGS.map(function (b) {
          return '<button type="button" class="px-chip' + (doc.bg === b[0] ? ' is-on' : '') + '" data-bg="' + b[0] + '">' + esc(b[1]) + '</button>';
        }).join('') + '</div></div>'
          + '<div class="px-sec"><button type="button" class="px-link px-danger" data-act="clear">Clear the page</button></div>'
          + '<p class="px-keys">V select · P pen · H highlight · E erase · L line · A arrow · W vector · R box · O circle · T text · B label · S stamps · M Flux Figures panel · Del delete · Ctrl+Z undo</p>';
        props.innerHTML = html;
        if (it && it.type === 'figure') mountFigInline(it);
        if (st.stampQ) filterStamps();
        if (it && it.type === 'vector') labCheck();
      }
      function eraserHTML() {
        var cur = ERASE_MODES.filter(function (m) { return m[0] === st.eraseMode; })[0] || ERASE_MODES[0];
        return '<div class="px-sec"><span class="px-sec-h" id="pxEraseH">Eraser</span><div class="px-row" role="group" aria-labelledby="pxEraseH">' + ERASE_MODES.map(function (m) {
          return '<button type="button" class="px-chip' + (m[0] === cur[0] ? ' is-on' : '') + '" data-erase="' + m[0] + '" aria-pressed="' + (m[0] === cur[0]) + '">' + esc(m[1]) + '</button>';
        }).join('') + '</div><p class="px-hint">' + esc(cur[2]) + '.</p></div>'
          + (cur[0] === 'circle' ? '<div class="px-sec"><label class="px-sec-h" for="pxEraseSize">Eraser size</label><input type="range" id="pxEraseSize" min="4" max="80" value="' + st.eraseR + '" data-erase-size></div>' : '');
      }
      /* The left rail: drawing tools, or in Flux Figures mode the kinds of figure. */
      function drawRail() {
        var rail = $('.px-tools', host);
        if (st.mode === 'figures') {
          rail.setAttribute('aria-label', 'Add a figure');
          rail.innerHTML = '<button type="button" class="px-tool" data-tool="select" aria-label="Select and move" title="Select and move (V)">' + ICON.select + '</button><span class="px-tools-sep" role="separator"></span>'
            + (window.FluxFigures ? window.FluxFigures.KINDS : []).map(function (k) {
              return '<button type="button" class="px-tool px-tool--fig" data-figkind="' + k[0] + '" aria-label="Add a ' + esc(k[1].toLowerCase()) + '" title="Add a ' + esc(k[1].toLowerCase()) + '">' + (KIND_ICON[k[0]] || ICON.figure) + '<span>' + esc(k[1].replace('Coordinate grid', 'Graph').replace('Regular polygon', 'Polygon').replace('Parallel lines', 'Parallels')) + '</span></button>';
            }).join('');
        } else {
          rail.setAttribute('aria-label', 'Tools');
          rail.innerHTML = TOOLS.map(function (t) {
            return '<button type="button" class="px-tool" data-tool="' + t[0] + '" aria-label="' + esc(t[1]) + '" title="' + esc(t[1]) + ' (' + t[2] + ')">' + ICON[t[0]] + '</button>';
          }).join('');
        }
        drawTools();
      }
      function drawTools() { $$('[data-tool]', host).forEach(function (b) { b.classList.toggle('is-on', b.dataset.tool === st.tool); b.setAttribute('aria-pressed', b.dataset.tool === st.tool); }); }
      function setMode(m) {
        st.mode = m === 'figures' ? 'figures' : 'draw';
        if (doc.mode !== st.mode) { doc.mode = st.mode; save(); }
        $$('[data-mode-set]', host).forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.modeSet === st.mode)); });
        host.querySelector('.px-editor').classList.toggle('is-figures', st.mode === 'figures');
        if (st.mode === 'figures') { st.tool = 'select'; svg.setAttribute('data-mode', 'select'); setPanel(true); }
        drawRail(); drawProps();
      }
      /** A new figure in the middle of what is on screen, selected, with its settings beside it. */
      /** Where a new figure goes: the middle of the screen, or the nearest spot clear of what is already there. */
      function freeSpot(spec) {
        var c = visibleCentre(), first = figureItem(spec, c);
        if (!first) return null;
        var boxes = doc.items.map(bbox), gap = 24;
        var clear = function (it) {
          return it.x >= 0 && it.y >= 0 && it.x + it.w <= W && it.y + it.h <= H && boxes.every(function (b) {
            return it.x + it.w + gap <= b.x || b.x + b.w + gap <= it.x || it.y + it.h + gap <= b.y || b.y + b.h + gap <= it.y;
          });
        };
        if (clear(first)) return first;
        var dx = first.w + gap, dy = first.h + gap, tries = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1], [2, 0], [-2, 0]];
        for (var i = 0; i < tries.length; i++) {
          var cand = figureItem(spec, [c[0] + tries[i][0] * dx, c[1] + tries[i][1] * dy]);
          if (cand && clear(cand)) return cand;
        }
        // A full page: a little down and to the right of the last one, so it can still be seen and grabbed.
        var last = boxes[boxes.length - 1];
        return figureItem(spec, last ? [last.x + last.w / 2 + 40, last.y + last.h / 2 + 40] : c);
      }
      function addFigure(spec, focus) {
        var it = freeSpot(spec);
        if (!it) return null;
        addItem(it, 'Added a figure');
        st.tool = 'select'; svg.setAttribute('data-mode', 'select');
        st.sel = it.id; drawTools(); drawSel(); drawProps();
        if (focus) {
          setPanel(true);
          var first = props.querySelector('#pxFigInline .px-fi-form .px-f-in');
          if (first) first.focus();
        }
        return it;
      }
      /* Flux Figures mode with nothing selected: say what to do, in words or by picking. */
      var FIG_TRY = ['right triangle 3 4 5', 'y = x^2 − 4', 'circle r 5 sector 60', 'cylinder r 3 h 8', 'number line x ≥ −2', 'angles on a straight line 40 70'];
      function figStartHTML() {
        return '<div class="px-sec px-fstart"><span class="px-sec-h">Flux Figures</span>'
          + '<p class="px-hint">Maths figures drawn to scale. Pick one on the left, or type it:</p>'
          + '<form class="px-fi-ask" id="pxNewFig" autocomplete="off"><label class="px-f-lab" for="pxNewFigIn">Describe it</label><div class="px-fig-ask-row">'
          + '<input class="px-f-in" id="pxNewFigIn" type="text" spellcheck="false" enterkeyhint="go" placeholder="right triangle 3 4 5" aria-describedby="pxNewFigHint">'
          + '<button type="submit" class="px-btn px-btn--small px-btn--primary">Add</button></div>'
          + '<p class="px-hint" id="pxNewFigHint" aria-live="polite"></p></form>'
          + '<div class="px-fig-try" role="group" aria-label="Examples">' + FIG_TRY.map(function (x) { return '<button type="button" class="px-fig-try-b" data-newfig="' + esc(x) + '">' + esc(x) + '</button>'; }).join('') + '</div>'
          + '<p class="px-hint">Then change it beside the page, drag it, or pull a corner to resize it. Ctrl+Z undoes.</p></div>';
      }
      function newFigFromText(text) {
        var hint = $('#pxNewFigHint', host), r = window.FluxFigures.fromText(text);
        if (r.error && !r.spec) { if (hint) { hint.textContent = r.error; hint.classList.add('is-err'); } return; }
        addFigure(r.spec, false);
        toast('Added: ' + (r.said || window.FluxFigures.describe(r.spec)));
      }
      /** The page's width at 100%: as big as fits the space it has, whole. */
      function fitWidth() {
        var r = stage.getBoundingClientRect(), pad = r.width < 500 ? 8 : 20;
        return Math.max(160, Math.min(r.width - pad * 2, (r.height - pad * 2) * W / H));
      }
      function applyZoom() {
        wrap.style.width = Math.round(fitWidth() * st.zoom) + 'px';
        $('.px-zoom-v', host).textContent = Math.round(st.zoom * 100) + '%';
      }
      /** Options on the right (a sheet from the bottom on a phone), shown or hidden. */
      function setPanel(open) {
        st.panel = open;
        host.querySelector('.px-editor').classList.toggle('is-panel', open);
        var b = $('[data-act="panel"]', host);
        if (b) b.setAttribute('aria-expanded', String(open));
        applyZoom();
      }

      /* Saving and history */
      function save() {
        clearTimeout(saveTimer);
        saveTimer = setTimeout(function () {
          if (putDoc(doc)) { var s = $('.px-saved', host); if (s) { s.textContent = 'Saved'; clearTimeout(s._t); s._t = setTimeout(function () { s.textContent = ''; }, 1200); } }
        }, 350);
      }
      /* Every step remembers what it was, so undo can say what it took back. */
      st.what = [''];
      function commit(what) {
        var snap = JSON.stringify(doc.items);
        if (snap === st.hist[st.hi]) return;
        st.hist = st.hist.slice(0, st.hi + 1);
        st.what = st.what.slice(0, st.hi + 1);
        st.hist.push(snap);
        st.what.push(what || 'Change');
        if (st.hist.length > 80) { st.hist.shift(); st.what.shift(); }
        st.hi = st.hist.length - 1;
        save();
        drawUndo();
      }
      function drawUndo() {
        var u = $('[data-act="undo"]', host), r = $('[data-act="redo"]', host);
        if (u) { u.disabled = st.hi <= 0; u.title = st.hi > 0 ? 'Undo: ' + st.what[st.hi] + ' (Ctrl+Z)' : 'Nothing to undo'; }
        if (r) { r.disabled = st.hi >= st.hist.length - 1; r.title = st.hi < st.hist.length - 1 ? 'Redo: ' + st.what[st.hi + 1] + ' (Ctrl+Shift+Z)' : 'Nothing to redo'; }
      }
      function restore(sel) {
        doc.items = JSON.parse(st.hist[st.hi]);
        st.sel = sel && doc.items.some(function (i) { return i.id === sel; }) ? sel : null;
        drawItems(); drawProps(); save(); drawUndo();
      }
      function undo() {
        if (st.hi <= 0) return;
        clearTimeout(figCommitTimer);
        var what = st.what[st.hi], keep = st.sel;
        st.hi--; restore(keep);
        toast('Undone: ' + what.toLowerCase());
      }
      function redo() {
        if (st.hi >= st.hist.length - 1) return;
        var keep = st.sel;
        st.hi++; restore(keep);
        toast('Redone: ' + st.what[st.hi].toLowerCase());
      }

      /* Coordinates */
      function toPage(e) {
        var pt = svg.createSVGPoint();
        pt.x = e.clientX; pt.y = e.clientY;
        var p = pt.matrixTransform(svg.getScreenCTM().inverse());
        return [Math.max(0, Math.min(W, p.x)), Math.max(0, Math.min(H, p.y))];
      }
      function pageScale() { var r = svg.getBoundingClientRect(); return r.width / W; }

      /* Tools */
      function setTool(t) {
        if (t === 'image') { $('#pxFile', host).click(); return; }
        if (t === 'figure') { openFigures(null); return; }
        if (st.mode === 'figures' && t !== 'select') { st.mode = 'draw'; doc.mode = 'draw'; save(); host.querySelector('.px-editor').classList.remove('is-figures'); $$('[data-mode-set]', host).forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.modeSet === 'draw')); }); drawRail(); }
        st.tool = t;
        if (t !== 'select') st.sel = null;
        if (t === 'stamp' && !st.stamp) st.stamp = 'beaker';
        svg.setAttribute('data-mode', t);
        svg.setAttribute('data-eraser', st.eraseMode);
        draftG.innerHTML = '';
        drawTools(); drawSel(); drawProps();
      }
      var ADDED = { pen: 'Drew a line', hl: 'Highlighted', line: 'Added a line', arrow: 'Added an arrow', vector: 'Added a vector', rect: 'Added a box', ellipse: 'Added a circle', text: 'Added text', label: 'Added a label', stamp: 'Added a stamp', image: 'Added a picture', figure: 'Added a figure' };
      function addItem(it, what) { it.id = uid(); doc.items.push(it); drawItems(); commit(what || ADDED[it.type] || 'Added'); return it; }

      /* Text entry, for text and labels */
      var editing = null;
      function openText(at, existing, onDone) {
        var s = pageScale();
        var size = existing ? existing.size : 32;
        var wr = wrap.getBoundingClientRect(), sr = svg.getBoundingClientRect();
        textIn.hidden = false;
        textIn.value = existing ? existing.text : '';
        textIn.style.left = (sr.left - wr.left + at[0] * s) + 'px';
        textIn.style.top = (sr.top - wr.top + at[1] * s) + 'px';
        textIn.style.fontSize = Math.max(12, size * s) + 'px';
        textIn.style.color = existing ? existing.color : st.color;
        editing = { onDone: onDone };
        setTimeout(function () { textIn.focus(); autosize(); }, 0);
      }
      function autosize() { textIn.style.height = 'auto'; textIn.style.height = textIn.scrollHeight + 'px'; textIn.style.width = 'auto'; textIn.style.width = Math.max(140, textIn.scrollWidth + 20) + 'px'; }
      function closeText(keep) {
        if (!editing) return;
        var ed = editing; editing = null;
        var v = textIn.value.replace(/\s+$/, '');
        textIn.hidden = true;
        ed.onDone(keep ? v : null);
      }
      textIn.addEventListener('input', autosize);
      textIn.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); closeText(true); }
        else if (e.key === 'Escape') { e.preventDefault(); closeText(false); }
        e.stopPropagation();
      });
      textIn.addEventListener('blur', function () { closeText(true); });

      function editTextOf(it) {
        var at = it.type === 'label' ? [it.x2 + (it.x2 >= it.x1 ? 8 : -160), it.y2 - it.size * 0.6] : [it.x, it.y];
        var before = it.text;
        it.text = '';
        drawItems();
        openText(at, { size: it.size, color: it.color, text: before }, function (v) {
          if (v == null) it.text = before;
          else if (!v) { doc.items = doc.items.filter(function (x) { return x !== it; }); st.sel = null; }
          else it.text = v;
          drawItems(); drawProps(); commit();
        });
      }

      /* Pointer */
      function eraseAt(e) {
        var el = document.elementFromPoint(e.clientX, e.clientY);
        var g = el && el.closest && el.closest('#pxItems [data-id]');
        if (!g) return;
        var id = g.getAttribute('data-id');
        doc.items = doc.items.filter(function (i) { return i.id !== id; });
        drawItems();
      }
      /* Circle: every item the circle passes over gets a cut that follows it, until it leaves. */
      function cutAlong(a, b) {
        var r = st.eraseR, open = st.drag.cuts, hit = false;
        doc.items.forEach(function (it) {
          if (!sweepTouches(it, a, b, r)) { delete open[it.id]; return; }
          var c = open[it.id], q = [r1(b[0]), r1(b[1])];
          if (c) { var l = c.pts[c.pts.length - 1]; if (Math.hypot(q[0] - l[0], q[1] - l[1]) >= 1) c.pts.push(q); }
          else {
            c = { r: r, pts: a[0] === b[0] && a[1] === b[1] ? [q] : [[r1(a[0]), r1(a[1])], q] };
            (it.cuts = it.cuts || []).push(c);
            open[it.id] = c;
          }
          st.drag.touched[it.id] = true;
          hit = true;
        });
        if (hit) drawItems();
      }
      function ring(p) {
        var k = 1 / pageScale();
        draftG.innerHTML = '<circle cx="' + r1(p[0]) + '" cy="' + r1(p[1]) + '" r="' + st.eraseR + '" fill="rgba(37,99,235,.07)" stroke="#2563eb" stroke-width="' + r1(1.5 * k) + '" pointer-events="none"/>';
      }
      function eraseBox(drag) {
        var a = drag.start, b = drag.end;
        return { x: Math.min(a[0], b[0]), y: Math.min(a[1], b[1]), w: Math.abs(b[0] - a[0]), h: Math.abs(b[1] - a[1]) };
      }
      function drawEraseBox() {
        var bx = eraseBox(st.drag), k = 1 / pageScale();
        draftG.innerHTML = '<rect x="' + r1(bx.x) + '" y="' + r1(bx.y) + '" width="' + r1(bx.w) + '" height="' + r1(bx.h) + '" fill="rgba(220,38,38,.08)" stroke="#dc2626" stroke-width="' + r1(1.5 * k) + '" stroke-dasharray="' + r1(8 * k) + ' ' + r1(6 * k) + '" pointer-events="none"/>';
      }
      /* Box: what lies wholly inside goes; what crosses the edge loses the part inside. */
      function applyEraseBox(drag) {
        var bx = eraseBox(drag);
        if (bx.w < 3 || bx.h < 3) return false;
        var changed = false;
        doc.items = doc.items.filter(function (it) {
          var b = bbox(it);
          if (b.x >= bx.x && b.y >= bx.y && b.x + b.w <= bx.x + bx.w && b.y + b.h <= bx.y + bx.h) { changed = true; return false; }
          if (!boxTouches(it, bx)) return true;
          (it.cuts = it.cuts || []).push({ x: r1(bx.x), y: r1(bx.y), w: r1(bx.w), h: r1(bx.h) });
          changed = true;
          return !rubbedOut(it);
        });
        return changed;
      }
      svg.addEventListener('pointerdown', function (e) {
        if (e.button && e.button !== 0) return;
        if (editing) { closeText(true); return; }
        var p = toPage(e);
        try { svg.setPointerCapture(e.pointerId); } catch (er) {}
        var t = st.tool;
        if (t === 'select') {
          var hd = e.target.getAttribute('data-handle');
          if (hd) {
            var it0 = selected(); var b0 = bbox(it0);
            st.drag = { mode: 'resize', start: p, box: b0, orig: JSON.parse(JSON.stringify(it0)), cx: hd.indexOf('w') >= 0 ? -1 : 1, cy: hd.indexOf('n') >= 0 ? -1 : 1 };
            drawFloat(null);
            return;
          }
          var g = e.target.closest('#pxItems [data-id]');
          st.sel = g ? g.getAttribute('data-id') : null;
          drawSel(); drawProps();
          if (st.sel) { st.drag = { mode: 'move', last: p, moved: false }; drawFloat(null); }
          return;
        }
        if (t === 'eraser') {
          if (st.eraseMode === 'circle') { st.drag = { mode: 'cut', last: p, cuts: {}, touched: {} }; cutAlong(p, p); ring(p); return; }
          if (st.eraseMode === 'box') { st.drag = { mode: 'boxerase', start: p, end: p }; drawEraseBox(); return; }
          st.drag = { mode: 'erase' }; eraseAt(e); return;
        }
        if (t === 'text') {
          var hitText = e.target.closest('#pxItems [data-id]');
          var hitItem = hitText && doc.items.filter(function (i) { return i.id === hitText.getAttribute('data-id'); })[0];
          if (hitItem && (hitItem.type === 'text' || hitItem.type === 'label')) { editTextOf(hitItem); return; }
          var color = st.color;
          openText(p, null, function (v) { if (v) { var it = addItem({ type: 'text', x: p[0], y: p[1], text: v, size: 32, color: color }); st.sel = it.id; drawSel(); } });
          return;
        }
        if (t === 'stamp') {
          var size = 160;
          var it2 = addItem({ type: 'stamp', sid: st.stamp || 'beaker', x: p[0] - size / 2, y: p[1] - size / 2, w: size, h: size, color: st.color, width: Math.max(2, st.width) });
          st.sel = it2.id; drawSel();
          return;
        }
        if (t === 'vector') {
          var g = gridAt(p), q = snapV(p, g);
          st.draft = Object.assign(vecStyle(g), { x1: q[0], y1: q[1], x2: q[0], y2: q[1] });
          st.drag = { mode: 'draw', grid: g };
          drawDraft();
          return;
        }
        var base = { color: st.color, width: st.width };
        if (t === 'pen' || t === 'hl') st.draft = Object.assign(base, { type: t, pts: [p], width: t === 'hl' ? Math.max(st.width * 4, 18) : st.width });
        else if (t === 'line' || t === 'arrow' || t === 'label') st.draft = Object.assign(base, { type: t === 'label' ? 'line' : t, x1: p[0], y1: p[1], x2: p[0], y2: p[1], dash: t === 'label' ? false : st.dash, _label: t === 'label' });
        else if (t === 'rect' || t === 'ellipse') st.draft = Object.assign(base, { type: t, x: p[0], y: p[1], w: 0, h: 0, fill: st.fill, dash: st.dash, _ox: p[0], _oy: p[1] });
        st.drag = { mode: 'draw' };
        drawDraft();
      });
      svg.addEventListener('pointermove', function (e) {
        if (!st.drag) { if (st.tool === 'eraser' && st.eraseMode === 'circle') ring(toPage(e)); return; }
        var p = toPage(e);
        if (st.drag.mode === 'erase') { eraseAt(e); return; }
        if (st.drag.mode === 'cut') { cutAlong(st.drag.last, p); st.drag.last = p; ring(p); return; }
        if (st.drag.mode === 'boxerase') { st.drag.end = p; drawEraseBox(); return; }
        if (st.drag.mode === 'move') {
          var it = selected(); if (!it) return;
          moveItem(it, p[0] - st.drag.last[0], p[1] - st.drag.last[1]);
          st.drag.last = p; st.drag.moved = true;
          drawItems();
          return;
        }
        if (st.drag.mode === 'resize') {
          var b = st.drag.box, it2 = selected(), dr = st.drag;
          var sx = Math.max(0.05, (b.w + dr.cx * (p[0] - dr.start[0])) / Math.max(1, b.w));
          var sy = Math.max(0.05, (b.h + dr.cy * (p[1] - dr.start[1])) / Math.max(1, b.h));
          if (e.shiftKey || it2.type === 'stamp' || it2.type === 'image' || it2.type === 'figure') { var s = Math.max(sx, sy); sx = sy = s; }
          var fresh = JSON.parse(JSON.stringify(st.drag.orig));
          // The opposite corner stays where it is.
          scaleItem(fresh, sx, sy, dr.cx > 0 ? b.x : b.x + b.w, dr.cy > 0 ? b.y : b.y + b.h);
          Object.assign(it2, fresh);
          drawItems();
          return;
        }
        var d = st.draft; if (!d) return;
        if (d.pts) {
          var last = d.pts[d.pts.length - 1];
          if (Math.hypot(p[0] - last[0], p[1] - last[1]) >= 1.5) d.pts.push(p);
        } else if (d.type === 'vector') {
          var qv = snapV(p, st.drag.grid);
          d.x2 = qv[0]; d.y2 = qv[1];
        } else if ('x1' in d) {
          var x2 = p[0], y2 = p[1];
          if (e.shiftKey) {
            var ang = Math.round(Math.atan2(y2 - d.y1, x2 - d.x1) / (Math.PI / 4)) * (Math.PI / 4), len = Math.hypot(x2 - d.x1, y2 - d.y1);
            x2 = d.x1 + len * Math.cos(ang); y2 = d.y1 + len * Math.sin(ang);
          }
          d.x2 = x2; d.y2 = y2;
        } else {
          var w = p[0] - d._ox, h = p[1] - d._oy;
          if (e.shiftKey) { var m = Math.max(Math.abs(w), Math.abs(h)); w = Math.sign(w || 1) * m; h = Math.sign(h || 1) * m; }
          d.x = Math.min(d._ox, d._ox + w); d.y = Math.min(d._oy, d._oy + h); d.w = Math.abs(w); d.h = Math.abs(h);
        }
        drawDraft();
      });
      function endPointer() {
        var drag = st.drag; st.drag = null;
        if (!drag) return;
        if (drag.mode === 'cut') {
          doc.items = doc.items.filter(function (it) { return !(drag.touched[it.id] && rubbedOut(it)); });
          drawItems(); commit(); return;
        }
        if (drag.mode === 'boxerase') {
          draftG.innerHTML = '';
          if (applyEraseBox(drag)) { drawItems(); commit(); }
          return;
        }
        if (drag.mode === 'erase' || (drag.mode === 'move' && drag.moved) || drag.mode === 'resize') {
          commit(drag.mode === 'erase' ? 'Rubbed out' : drag.mode === 'move' ? 'Moved' : 'Resized');
          drawProps(); drawSel(); return;
        }
        if (drag.mode === 'move') { drawSel(); return; }
        if (drag.mode !== 'draw') return;
        var d = st.draft; st.draft = null; draftG.innerHTML = '';
        if (!d) return;
        if (d.type === 'vector') {
          if (Math.hypot(d.x2 - d.x1, d.y2 - d.y1) > 4) {
            addItem(clean(d));
            st.vec.label = nextLabel(st.vec.label); saveVecPref();
            drawProps();
          }
          return;
        }
        if (d._label) {
          var len = Math.hypot(d.x2 - d.x1, d.y2 - d.y1);
          if (len < 12) { d.x2 = d.x1 + 120; d.y2 = d.y1 - 40; }
          var lab = { type: 'label', x1: d.x1, y1: d.y1, x2: d.x2, y2: d.y2, text: '', size: 30, color: d.color, width: Math.min(6, d.width) };
          draftG.innerHTML = itemSVG(Object.assign({ id: 'draft' }, lab, { text: ' ' }), false);
          var right = lab.x2 >= lab.x1;
          openText([right ? lab.x2 + 8 : lab.x2 - 168, lab.y2 - 18], { size: 30, color: lab.color, text: '' }, function (v) {
            draftG.innerHTML = '';
            if (v) { lab.text = v; var it = addItem(lab); st.sel = null; drawSel(); }
          });
          return;
        }
        if (d.pts && d.pts.length) { addItem(clean(d)); return; }
        if ('x1' in d && Math.hypot(d.x2 - d.x1, d.y2 - d.y1) > 4) { addItem(clean(d)); return; }
        if ('w' in d && d.w > 4 && d.h > 4) { addItem(clean(d)); }
      }
      function clean(d) { var o = {}; Object.keys(d).forEach(function (k) { if (k[0] !== '_') o[k] = d[k]; }); return o; }
      svg.addEventListener('pointerup', endPointer);
      svg.addEventListener('pointercancel', endPointer);
      svg.addEventListener('pointerleave', function () { if (!st.drag && st.tool === 'eraser') draftG.innerHTML = ''; });
      svg.addEventListener('dblclick', function (e) {
        // Pointer capture makes the svg itself the target, so look under the pointer.
        var under = document.elementFromPoint(e.clientX, e.clientY);
        var g = (under && under.closest && under.closest('#pxItems [data-id]')) || e.target.closest('#pxItems [data-id]');
        var it = g && doc.items.filter(function (i) { return i.id === g.getAttribute('data-id'); })[0];
        if (it && (it.type === 'text' || it.type === 'label')) { st.sel = it.id; editTextOf(it); }
        if (it && it.type === 'figure') { st.sel = it.id; drawSel(); drawProps(); openFigures(it); }
      });
      function drawDraft() { draftG.innerHTML = st.draft ? itemSVG(Object.assign({ id: 'draft' }, st.draft, { type: st.draft.type }), false) : ''; }

      /* Pictures */
      $('#pxFile', host).addEventListener('change', function (e) {
        var f = e.target.files && e.target.files[0];
        e.target.value = '';
        if (f) placeImage(f);
      });
      function placeImage(file) {
        readImage(file).then(function (im) {
          var s = Math.min(1, (W * 0.6) / im.w, (H * 0.6) / im.h);
          var w = im.w * s, h = im.h * s;
          var it = addItem({ type: 'image', href: im.href, x: (W - w) / 2, y: (H - h) / 2, w: w, h: h });
          st.tool = 'select'; st.sel = it.id; svg.setAttribute('data-mode', 'select');
          drawTools(); drawSel(); drawProps();
        }).catch(function () { toast('That picture could not be opened', 'warn'); });
      }
      function onPaste(e) {
        if (editing || (window.FluxPixelFigures && window.FluxPixelFigures.isOpen())) return;
        var items = (e.clipboardData && e.clipboardData.items) || [];
        for (var i = 0; i < items.length; i++) {
          if (items[i].type.indexOf('image') === 0) { e.preventDefault(); placeImage(items[i].getAsFile()); return; }
        }
      }
      stage.addEventListener('dragover', function (e) { e.preventDefault(); });
      stage.addEventListener('drop', function (e) {
        e.preventDefault();
        var f = e.dataTransfer.files && e.dataTransfer.files[0];
        if (f && f.type.indexOf('image') === 0) placeImage(f);
      });

      /* Buttons */
      host.onclick = function (e) {
        var t = e.target.closest('[data-tool],[data-act],[data-color],[data-toggle],[data-bg],[data-stamp],[data-erase],[data-vtog],[data-ventry],[data-mode-set],[data-figkind],[data-newfig]');
        if (!t) return;
        var it = selected();
        if (t.dataset.modeSet) { setMode(t.dataset.modeSet); return; }
        if (t.dataset.figkind) {
          var ks = window.FluxPixelFigures ? window.FluxPixelFigures.lastSpec(t.dataset.figkind) : window.FluxFigures.defaults(t.dataset.figkind);
          addFigure(ks, true);
          return;
        }
        if (t.dataset.newfig) { var ni = $('#pxNewFigIn', host); if (ni) ni.value = t.dataset.newfig; newFigFromText(t.dataset.newfig); return; }
        if (t.dataset.tool) return setTool(t.dataset.tool);
        if (t.dataset.erase) {
          st.eraseMode = t.dataset.erase; saveErasePref();
          svg.setAttribute('data-eraser', st.eraseMode); draftG.innerHTML = '';
          drawProps();
          var on = props.querySelector('[data-erase="' + st.eraseMode + '"]'); if (on) on.focus();
          return;
        }
        if (t.dataset.stamp) { st.stamp = t.dataset.stamp; drawProps(); return; }
        if (t.dataset.vtog) {
          var vk = t.dataset.vtog;
          if (it && it.type === 'vector') { it[vk] = vk === 'showMag' ? it[vk] === false : !it[vk]; drawItems(); commit(); }
          else { st.vec[vk] = !st.vec[vk]; saveVecPref(); }
          drawProps();
          var vb = props.querySelector('[data-vtog="' + vk + '"]'); if (vb) vb.focus();
          return;
        }
        if (t.dataset.ventry) {
          st.vec.entry = t.dataset.ventry; saveVecPref(); drawProps();
          var eb = props.querySelector('[data-ventry="' + st.vec.entry + '"]'); if (eb) eb.focus();
          return;
        }
        if (t.dataset.color) {
          if (it) { it.color = t.dataset.color; drawItems(); commit(); } else st.color = t.dataset.color;
          drawProps(); return;
        }
        if (t.dataset.toggle) {
          var k = t.dataset.toggle;
          if (it) { it[k] = !it[k]; drawItems(); commit(); } else st[k] = !st[k];
          drawProps(); return;
        }
        if (t.dataset.bg) { doc.bg = t.dataset.bg; drawBg(); drawProps(); save(); return; }
        var a = t.dataset.act;
        if (a === 'undo') undo();
        else if (a === 'redo') redo();
        else if (a === 'zoomin') { st.zoom = Math.min(4, st.zoom + 0.25); applyZoom(); }
        else if (a === 'zoomout') { st.zoom = Math.max(0.5, st.zoom - 0.25); applyZoom(); }
        else if (a === 'zoomfit') { st.zoom = 1; applyZoom(); }
        else if (a === 'panel') setPanel(!st.panel);
        else if (a === 'delete' && it) {
          doc.items = doc.items.filter(function (x) { return x !== it; }); st.sel = null; drawItems(); drawProps(); commit('Deleted');
          toastAct('Deleted', 'Undo', undo);
        }
        else if (a === 'dup' && it) { var copy = JSON.parse(JSON.stringify(it)); moveItem(copy, 30, 30); var n = addItem(copy, 'Duplicated'); st.sel = n.id; drawSel(); drawProps(); }
        else if (a === 'front' && it) { doc.items = doc.items.filter(function (x) { return x !== it; }).concat([it]); drawItems(); commit('Moved to the front'); }
        else if (a === 'figfocus' && it) {
          setPanel(true);
          var first = props.querySelector('#pxFigInline .px-fi-form .px-f-in, #pxFigInline #pxiAsk');
          if (first) first.focus();
        }
        else if (a === 'edittext' && it) editTextOf(it);
        else if (a === 'figures') openFigures(null);
        else if (a === 'figedit' && it && it.type === 'figure') openFigures(it);
        else if (a === 'itemcopy' && it) window.FluxPixelFigures.copyPng(itemPng(it));
        else if (a === 'figlink' && it && it.fig) {
          var url = window.FluxPixelFigures.shareURL(it.fig);
          if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(function () { toast('Link copied. It opens this figure\u2019s settings.'); }, function () { window.prompt('Copy this link', url); });
          else window.prompt('Copy this link', url);
        }
        else if (a === 'vadd') addTypedVector();
        else if (a === 'vtip') vecOp('tip');
        else if (a === 'vpara') vecOp('para');
        else if (a === 'vsub') vecOp('sub');
        else if (a === 'vmul') vecOp('mul');
        else if (a === 'clear') { if (doc.items.length && window.confirm('Clear everything on this page? You can undo it.')) { doc.items = []; st.sel = null; drawItems(); drawProps(); commit(); } }
        else if (a === 'png') pngBlob(doc).then(function (b) { download(safeName(doc.title) + '.png', b); }).catch(function (er) { toast(er.message, 'warn'); });
        else if (a === 'svg') download(safeName(doc.title) + '.svg', new Blob([docSVG(doc)], { type: 'image/svg+xml' }));
        else if (a === 'copy') {
          if (!navigator.clipboard || typeof ClipboardItem === 'undefined') { toast('This browser cannot copy pictures — use PNG instead', 'warn'); return; }
          navigator.clipboard.write([new ClipboardItem({ 'image/png': pngBlob(doc) })])
            .then(function () { toast('Copied — paste it into your notes, a doc or a slide'); }, function () { toast('Could not copy — use PNG instead', 'warn'); });
        }
      };
      /** Show only the stamps whose name or group matches the search. */
      function filterStamps() {
        var q = (st.stampQ || '').trim().toLowerCase(), any = false;
        $$('.px-stamp-g', host).forEach(function (g) {
          var shown = 0, groupHit = g.getAttribute('data-group').indexOf(q) >= 0;
          $$('.px-stamp', g).forEach(function (b) {
            var on = !q || groupHit || b.getAttribute('data-name').indexOf(q) >= 0;
            b.hidden = !on;
            if (on) shown++;
          });
          g.hidden = !shown;
          if (shown) any = true;
        });
        var none = $('.px-stamp-none', host);
        if (none) none.hidden = any;
      }
      host.onsubmit = function (e) {
        if (e.target.id !== 'pxNewFig') return;
        e.preventDefault();
        newFigFromText($('#pxNewFigIn', host).value);
      };
      host.oninput = function (e) {
        if (e.target.matches('.px-stamp-q')) { st.stampQ = e.target.value; filterStamps(); return; }
        if (e.target.matches('[data-vset]') && e.target.tagName === 'INPUT') {
          st.vec[e.target.getAttribute('data-vset')] = e.target.value; saveVecPref();
          if (e.target.getAttribute('data-vset') === 'label') { var ab = props.querySelector('[data-act="vadd"]'); if (ab) ab.textContent = 'Add vector ' + e.target.value; }
          return;
        }
        if (e.target.matches('[data-labm]')) { st.labM = e.target.value; labCheck(); return; }
        if (e.target.matches('[data-laba]')) { st.labA = e.target.value; labCheck(); return; }
        if (e.target.matches('[data-vedit]')) return;
        var it = selected();
        if (e.target.matches('.px-title')) { doc.title = e.target.value.trim() || 'Untitled drawing'; save(); return; }
        if (e.target.matches('[data-erase-size]')) { st.eraseR = +e.target.value; saveErasePref(); return; }
        if (e.target.matches('[data-width]')) { var v = +e.target.value; if (it) { it.width = v; drawItems(); } else st.width = v; return; }
        if (e.target.matches('[data-size]')) { if (it) { it.size = +e.target.value; drawItems(); } return; }
        if (e.target.matches('[data-pick]')) { var c = e.target.value; if (it) { it.color = c; drawItems(); } else st.color = c; }
      };
      host.onchange = function (e) {
        if (e.target.matches('select[data-vset]')) {
          var sk = e.target.getAttribute('data-vset');
          st.vec[sk] = sk === 'prec' ? +e.target.value : e.target.value; saveVecPref(); drawProps();
          var sel2 = props.querySelector('[data-vset="' + sk + '"]'); if (sel2) sel2.focus();
          return;
        }
        if (e.target.matches('[data-vedit]')) { var vi = selected(); if (vi && vi.type === 'vector') editVector(vi, e.target.getAttribute('data-vedit'), e.target.value); return; }
        if (e.target.matches('[data-vpick]')) { st.vpick[e.target.getAttribute('data-vpick')] = e.target.checked; return; }
        if (e.target.matches('[data-width],[data-size],[data-pick]')) { if (selected()) commit(); drawProps(); }
      };

      /* Keys */
      var KEYS = {}; TOOLS.forEach(function (t) { KEYS[t[2].toLowerCase()] = t[0]; });
      function onKey(e) {
        if (e.target && e.target.closest && e.target.closest('dialog')) return;
        // Escape in a field beside the page leaves the field, so the keys work on the page again.
        if (e.key === 'Escape' && !editing && e.target && e.target.closest && e.target.closest('#pxProps') && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) { e.target.blur(); return; }
        if (editing || /INPUT|TEXTAREA|SELECT/.test((e.target && e.target.tagName) || '')) return;
        var mod = e.metaKey || e.ctrlKey;
        if (mod && e.key.toLowerCase() === 'z') { e.preventDefault(); if (e.shiftKey) redo(); else undo(); return; }
        if (mod && e.key.toLowerCase() === 'y') { e.preventDefault(); redo(); return; }
        if (mod && e.key.toLowerCase() === 'd' && selected()) { e.preventDefault(); host.querySelector('[data-act="dup"]').click(); return; }
        if ((e.key === 'Delete' || e.key === 'Backspace') && selected()) { e.preventDefault(); host.querySelector('[data-act="delete"]').click(); return; }
        if (e.key === 'Escape') { st.sel = null; drawSel(); drawProps(); return; }
        var nudge = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
        if (nudge && selected()) {
          e.preventDefault();
          var step = e.shiftKey ? 20 : 2;
          moveItem(selected(), nudge[0] * step, nudge[1] * step); drawItems();
          clearTimeout(st.nudgeT); st.nudgeT = setTimeout(function () { commit('Moved'); }, 400);
          return;
        }
        if (mod || e.altKey) return;
        var tool = KEYS[e.key.toLowerCase()];
        if (tool) { e.preventDefault(); setTool(tool); }
      }
      document.addEventListener('keydown', onKey);
      document.addEventListener('paste', onPaste);

      st.mode = doc.mode === 'figures' ? 'figures' : 'draw';
      drawRail();
      drawBg(); drawItems(); setTool(doc.items.length || st.mode === 'figures' ? 'select' : 'pen');
      setPanel(window.innerWidth > 760);
      setMode(st.mode);
      drawUndo();
      if (window.FluxHub) window.FluxHub.mountAll();
      var ro = typeof ResizeObserver === 'function' ? new ResizeObserver(function () { applyZoom(); }) : null;
      if (ro) ro.observe(stage); else window.addEventListener('resize', applyZoom);
      cleanup = function () {
        if (ro) ro.disconnect(); else window.removeEventListener('resize', applyZoom);
        if (editing) closeText(true);
        clearTimeout(saveTimer); putDoc(doc);
        document.removeEventListener('keydown', onKey);
        document.removeEventListener('paste', onPaste);
        host.onclick = host.oninput = host.onchange = host.onsubmit = null;
      };
    }

    window.addEventListener('hashchange', render);
    render();
    return { render: render };
  }

  window.FluxPixel = {
    mount: mount,
    _bbox: bbox, _scaleItem: scaleItem, _moveItem: moveItem, _smoothPath: smoothPath, _docSVG: docSVG,
  };
})();
