/* ============================================================================
   FLUX FIGURES  ·  flux-figures.js
   Maths figures for tests and worksheets, drawn to scale: coordinate grids,
   number lines, triangles, rectangles, parallelograms, trapezoids, kites,
   regular polygons, angles, parallel lines cut by a transversal, 3D solids
   with dashed hidden edges, and vectors.

   PURE: no DOM, no network. A figure is a flat settings object (numbers,
   words and true/false only, so the whole thing fits in a share link). It
   is built into SVG markup and a viewBox; Flux Pixel draws that markup as
   an item on the page. The geometry is tested in
   test/unit/pixel-figures.test.mjs.

   Figures are worked out with y pointing up, the way maths is written, and
   turned over (y → −y) only when the SVG is written.

   Equations on a grid use FluxExpr (flux-expr.js), the parser the grapher
   uses: no eval, a whitelist of functions.
   ========================================================================== */
(function () {
  'use strict';
  var root = typeof window !== 'undefined' ? window : globalThis;

  var DEG = Math.PI / 180;
  var INK = '#111827';
  var FONT = 'Inter, system-ui, -apple-system, Segoe UI, sans-serif';
  var SIZE = 22;
  var PALETTE = ['#2563eb', '#dc2626', '#16a34a', '#7c3aed', '#ea580c', '#0891b2'];
  var DASHES = ['', '12 7', '3 6', '16 6 3 6'];
  var PAPER_LINE = '#cbd5e1';
  var MINUS = '−';

  /* ── Numbers and words ─────────────────────────────────────────────── */

  function num(v, d) {
    if (typeof v === 'number') return isFinite(v) ? v : d;
    var t = String(v == null ? '' : v).trim().replace(/−/g, '-');
    if (!t) return d;
    var f = /^([-+]?\d*\.?\d+)\s*\/\s*(\d*\.?\d+)$/.exec(t);
    var n = f ? parseFloat(f[1]) / parseFloat(f[2]) : Number(t);
    return isFinite(n) ? n : d;
  }
  function round(n, dp) {
    var p = Math.pow(10, dp), v = Math.round(Math.abs(n) * p + 1e-7) / p;
    return n < 0 && v ? -v : v;
  }
  /** A number for a label: at most dp decimals, no trailing zeros, a real minus sign. */
  function fmt(n, dp) {
    if (!isFinite(n)) return '?';
    var v = round(n, dp == null ? 2 : dp);
    return (v < 0 ? MINUS : '') + String(Math.abs(v));
  }
  /** A number to exactly dp decimals (5.0 N), the way a measurement is written. */
  function fixed(n, dp) {
    if (!isFinite(n)) return '?';
    var v = round(n, dp);
    return (v < 0 ? MINUS : '') + Math.abs(v).toFixed(dp);
  }
  function r2(n) { return Math.round(n * 100) / 100; }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function norm360(a) { a = a % 360; if (a < 0) a += 360; return a === 0 || a >= 360 - 1e-12 ? 0 : a; }
  function near(a, b) { return Math.abs(a - b) <= 1e-7 * Math.max(1, Math.abs(a), Math.abs(b)); }
  function unitText(u) { return u ? ' ' + u : ''; }
  /** A label the teacher typed wins; a dash leaves that one blank; otherwise the measurement, if that kind is on. */
  function pick(custom, auto, on) {
    var c = String(custom == null ? '' : custom).trim();
    if (c === '-' || c === MINUS) return '';
    if (c) return c;
    return on ? auto : '';
  }
  function hidden(custom) { var c = String(custom == null ? '' : custom).trim(); return c === '-' || c === MINUS; }
  function andList(xs) { return xs.length < 2 ? xs.join('') : xs.slice(0, -1).join(', ') + ' and ' + xs[xs.length - 1]; }

  /* ── Points (2D, as [x, y]) ─────────────────────────────────────────── */

  function vadd(a, b) { return [a[0] + b[0], a[1] + b[1]]; }
  function vsub(a, b) { return [a[0] - b[0], a[1] - b[1]]; }
  function vmul(a, k) { return [a[0] * k, a[1] * k]; }
  function vlen(a) { return Math.hypot(a[0], a[1]); }
  function vunit(a) { var l = vlen(a) || 1; return [a[0] / l, a[1] / l]; }
  function vdot(a, b) { return a[0] * b[0] + a[1] * b[1]; }
  function vrot(a, ang) { var c = Math.cos(ang), s = Math.sin(ang); return [a[0] * c - a[1] * s, a[0] * s + a[1] * c]; }
  function polar(r, ang) { return [r * Math.cos(ang), r * Math.sin(ang)]; }
  function mid(a, b) { return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]; }
  function dist(a, b) { return Math.hypot(a[0] - b[0], a[1] - b[1]); }
  /** Signed area: more than 0 when the points go round anticlockwise. */
  function area(pts) {
    var s = 0;
    for (var i = 0; i < pts.length; i++) { var p = pts[i], q = pts[(i + 1) % pts.length]; s += p[0] * q[1] - q[0] * p[1]; }
    return s / 2;
  }
  function centroid(pts) {
    var x = 0, y = 0;
    pts.forEach(function (p) { x += p[0]; y += p[1]; });
    return [x / pts.length, y / pts.length];
  }
  function insidePoly(p, poly) {
    var inside = false;
    for (var i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      var a = poly[i], b = poly[j];
      if ((a[1] > p[1]) !== (b[1] > p[1]) && p[0] < (b[0] - a[0]) * (p[1] - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
    }
    return inside;
  }
  /** Centre the shape, mirror it if asked, turn it (degrees, anticlockwise), and size it so its longer side of the box is `size`. */
  function place(pts, rot, flip, size) {
    var c = centroid(pts);
    var out = pts.map(function (p) {
      var q = vsub(p, c);
      if (flip) q = [-q[0], q[1]];
      return vrot(q, (num(rot, 0) || 0) * DEG);
    });
    return fit(out, size || 380).pts;
  }
  function fit(pts, size) {
    var xs = pts.map(function (p) { return p[0]; }), ys = pts.map(function (p) { return p[1]; });
    var w = Math.max.apply(0, xs) - Math.min.apply(0, xs), h = Math.max.apply(0, ys) - Math.min.apply(0, ys);
    var k = size / (Math.max(w, h) || 1);
    return { pts: pts.map(function (p) { return [p[0] * k, p[1] * k]; }), k: k };
  }

  /* ── Text ───────────────────────────────────────────────────────────── */

  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; });
  }
  var GREEK = /[α-ω]/;
  function isLetter(c) { return !!c && /[A-Za-zΑ-ω]/.test(c); }

  /**
   * A label as runs: ordinary text, subscripts (F_1, v_{max}) and
   * superscripts (cm^2, x^{-1}). A letter standing alone (x, θ, the x in 2x)
   * is set in italics the way algebra is printed; a letter after a number
   * and a space is a unit (5 m) and stays upright.
   */
  function runs(str) {
    var s = String(str == null ? '' : str), out = [], i = 0;
    while (i < s.length) {
      var c = s[i];
      if ((c === '_' || c === '^') && i + 1 < s.length && s[i + 1] !== ' ') {
        var k = c === '_' ? 'sub' : 'sup', t;
        if (s[i + 1] === '{') {
          var j = s.indexOf('}', i + 2); if (j < 0) j = s.length;
          t = s.slice(i + 2, j); i = j + 1;
        } else {
          t = /^[-−]?[0-9.]+|^./.exec(s.slice(i + 1))[0]; i += 1 + t.length;
        }
        if (t) out.push({ t: t, k: k });
        continue;
      }
      var last = out[out.length - 1];
      if (last && last.k === 'n') last.t += c; else out.push({ t: c, k: 'n' });
      i++;
    }
    var res = [];
    out.forEach(function (r) {
      var t = r.t, buf = '';
      for (var p = 0; p < t.length; p++) {
        var ch = t[p];
        var lone = (/[a-z]/.test(ch) || GREEK.test(ch)) && !isLetter(t[p - 1]) && !isLetter(t[p + 1]);
        var unit = r.k === 'n' && t[p - 1] === ' ' && /[0-9]/.test(t[p - 2] || '');
        if (lone && !unit) { if (buf) res.push({ t: buf, k: r.k }); res.push({ t: ch, k: r.k, i: true }); buf = ''; }
        else buf += ch;
      }
      if (buf) res.push({ t: buf, k: r.k });
    });
    return res;
  }
  function textMarkup(str, size) {
    var shift = 0, out = '';
    runs(str).forEach(function (r) {
      var want = r.k === 'sub' ? size * 0.32 : r.k === 'sup' ? -size * 0.42 : 0, dy = want - shift;
      shift = want;
      var a = (dy ? ' dy="' + r2(dy) + '"' : '') + (r.k !== 'n' ? ' font-size="' + r2(size * 0.7) + '"' : '') + (r.i ? ' font-style="italic"' : '');
      out += a ? '<tspan' + a + '>' + esc(r.t) + '</tspan>' : esc(r.t);
    });
    return out;
  }
  /** About how wide a label is: there is no font to measure with here, so this is an estimate on the generous side. */
  function textWidth(str, size) {
    var w = 0;
    runs(str).forEach(function (r) {
      var f = r.k === 'n' ? size : size * 0.7;
      for (var i = 0; i < r.t.length; i++) {
        var c = r.t[i];
        w += f * (/[il.,:;'|!()[\] ]/.test(c) ? 0.32 : c === '°' ? 0.4 : /[MWmw@%]/.test(c) ? 0.86 : /[A-Z0-9#$&?=+<>−]/.test(c) ? 0.64 : 0.56);
      }
    });
    return w;
  }
  function textBox(str, size) { return { w: textWidth(str, size), h: size * 1.15 }; }
  /** How far a box reaches along a unit direction from its centre. */
  function reach(dir, box) { return Math.abs(dir[0]) * box.w / 2 + Math.abs(dir[1]) * box.h / 2; }

  /* ── A picture being built ─────────────────────────────────────────── */

  function Pic(ink, lw) {
    this.ink = ink || INK;
    this.lw = lw || 3;
    this.parts = [];
    this.x0 = Infinity; this.y0 = Infinity; this.x1 = -Infinity; this.y1 = -Infinity;
    this.auto = {};   // what each label field would show: the form's placeholders
    this.info = null; // extra facts, like a grid's scale for vectors drawn on it
  }
  Pic.prototype = {
    ext: function (x, y) {
      var sy = -y;
      if (x < this.x0) this.x0 = x; if (x > this.x1) this.x1 = x;
      if (sy < this.y0) this.y0 = sy; if (sy > this.y1) this.y1 = sy;
    },
    attrs: function (o) {
      o = o || {};
      var w = o.w || this.lw, dash = o.dash === true ? r2(w * 3) + ' ' + r2(w * 2.2) : o.dash;
      return ' fill="' + (o.fill || 'none') + '"' + (o.opacity != null ? ' fill-opacity="' + o.opacity + '"' : '') + ' stroke="' + (o.color || this.ink) + '" stroke-width="' + r2(w) + '"'
        + (dash ? ' stroke-dasharray="' + dash + '"' : '') + ' stroke-linecap="round" stroke-linejoin="round"';
    },
    line: function (a, b, o) {
      this.ext(a[0], a[1]); this.ext(b[0], b[1]);
      this.parts.push('<line x1="' + r2(a[0]) + '" y1="' + r2(-a[1]) + '" x2="' + r2(b[0]) + '" y2="' + r2(-b[1]) + '"' + this.attrs(o) + '/>');
    },
    poly: function (pts, o) {
      o = o || {};
      var self = this;
      if (pts.length < 2) return;
      pts.forEach(function (p) { self.ext(p[0], p[1]); });
      this.parts.push('<' + (o.close ? 'polygon' : 'polyline') + ' points="' + pts.map(function (p) { return r2(p[0]) + ',' + r2(-p[1]); }).join(' ') + '"' + this.attrs(o) + '/>');
    },
    /** An SVG path already in SVG coordinates (y down), with the box it covers in maths coordinates. */
    path: function (d, box, o) {
      if (!d) return;
      this.ext(box[0], box[1]); this.ext(box[2], box[3]);
      this.parts.push('<path d="' + d + '"' + this.attrs(o) + '/>');
    },
    circle: function (c, r, o) {
      this.ext(c[0] - r, c[1] - r); this.ext(c[0] + r, c[1] + r);
      this.parts.push('<circle cx="' + r2(c[0]) + '" cy="' + r2(-c[1]) + '" r="' + r2(r) + '"' + this.attrs(o) + '/>');
    },
    dot: function (c, r, o) {
      o = o || {};
      var col = o.color || this.ink;
      this.ext(c[0] - r, c[1] - r); this.ext(c[0] + r, c[1] + r);
      this.parts.push('<circle cx="' + r2(c[0]) + '" cy="' + r2(-c[1]) + '" r="' + r2(r) + '" fill="' + (o.open ? '#ffffff' : col) + '" stroke="' + col + '" stroke-width="' + r2(o.w || 2.5) + '"/>');
    },
    /** Arc round c, radius r, anticlockwise from angle a to angle a + s (radians). */
    arc: function (c, r, a, s, o) {
      var n = Math.max(4, Math.ceil(Math.abs(s) / (Math.PI / 36))), pts = [];
      for (var i = 0; i <= n; i++) pts.push(vadd(c, polar(r, a + s * i / n)));
      this.poly(pts, o);
    },
    /** Part of an ellipse, by its parameter t (radians), anticlockwise from t0 to t1. */
    ellArc: function (c, rx, ry, t0, t1, o) {
      var n = Math.max(6, Math.ceil(Math.abs(t1 - t0) / (Math.PI / 48))), pts = [];
      for (var i = 0; i <= n; i++) { var t = t0 + (t1 - t0) * i / n; pts.push([c[0] + rx * Math.cos(t), c[1] + ry * Math.sin(t)]); }
      this.poly(pts, o);
    },
    /** Text centred on p (or starting / ending there), with an optional white halo so lines under it stay readable. */
    text: function (p, str, o) {
      o = o || {};
      if (str == null || str === '') return null;
      var size = o.size || SIZE, box = textBox(str, size), anchor = o.anchor || 'middle';
      var left = anchor === 'start' ? p[0] : anchor === 'end' ? p[0] - box.w : p[0] - box.w / 2;
      this.ext(left, p[1] - box.h / 2); this.ext(left + box.w, p[1] + box.h / 2);
      this.parts.push('<text x="' + r2(p[0]) + '" y="' + r2(-p[1] + size * 0.35) + '" font-size="' + r2(size) + '" font-family="' + FONT + '" fill="' + (o.color || this.ink) + '"'
        + (anchor !== 'start' ? ' text-anchor="' + anchor + '"' : '') + (o.bold ? ' font-weight="700"' : '')
        + (o.halo ? ' stroke="#ffffff" stroke-width="' + r2(size * 0.28) + '" stroke-linejoin="round" paint-order="stroke"' : '')
        + '>' + textMarkup(str, size) + '</text>');
      return box;
    },
    out: function (pad) {
      if (!isFinite(this.x0)) { this.x0 = this.y0 = 0; this.x1 = this.y1 = 1; }
      var vb = [r2(this.x0 - pad), r2(this.y0 - pad), r2(this.x1 - this.x0 + pad * 2), r2(this.y1 - this.y0 + pad * 2)];
      return { svg: this.parts.join(''), vb: vb, w: vb[2], h: vb[3] };
    },
  };

  /* ── Marks: ticks, arrows, arcs, boxes, labels ─────────────────────── */

  function outward(a, b, ccw) { var u = vunit(vsub(b, a)); return ccw ? [u[1], -u[0]] : [-u[1], u[0]]; }
  /** Where a label goes beside the segment a–b: out along `out`, far enough that its box clears the line. */
  function sideLabelPos(a, b, out, box, gap) {
    return vadd(mid(a, b), vmul(out, (gap == null ? 9 : gap) + reach(out, box)));
  }
  function sideLabel(pic, a, b, out, text, size, gap) {
    if (!text) return null;
    var p = sideLabelPos(a, b, out, textBox(text, size), gap);
    pic.text(p, text, { size: size, halo: true });
    return p;
  }
  /** n short strokes across the middle of a side: sides with the same number are equal. */
  function ticks(pic, a, b, n) {
    var u = vunit(vsub(b, a)), nn = [-u[1], u[0]], m = mid(a, b);
    for (var k = 0; k < n; k++) {
      var c = vadd(m, vmul(u, (k - (n - 1) / 2) * 7));
      pic.line(vadd(c, vmul(nn, 8)), vsub(c, vmul(nn, 8)), { w: pic.lw * 0.7 });
    }
  }
  /** n arrowheads on a side, pointing a → b: sides with the same number are parallel. */
  function chevrons(pic, a, b, n) {
    var u = vunit(vsub(b, a)), nn = [-u[1], u[0]], m = mid(a, b);
    for (var k = 0; k < n; k++) {
      var c = vadd(m, vmul(u, (k - (n - 1) / 2) * 10 + 4));
      pic.poly([vadd(vsub(c, vmul(u, 9)), vmul(nn, 7)), c, vsub(vsub(c, vmul(u, 9)), vmul(nn, 7))], { w: pic.lw * 0.7 });
    }
  }
  function rightBox(pic, v, u1, u2, s) {
    pic.poly([vadd(v, vmul(u1, s)), vadd(vadd(v, vmul(u1, s)), vmul(u2, s)), vadd(v, vmul(u2, s))], { w: pic.lw * 0.6 });
  }
  /** Start angle and anticlockwise sweep of the corner between rays v→p and v→q, the inside way (under 180°). */
  function wedge(v, p, q) {
    var a1 = Math.atan2(p[1] - v[1], p[0] - v[0]), a2 = Math.atan2(q[1] - v[1], q[0] - v[0]);
    var s = a2 - a1;
    while (s <= -Math.PI) s += 2 * Math.PI;
    while (s > Math.PI) s -= 2 * Math.PI;
    return s >= 0 ? { a: a1, s: s } : { a: a2, s: -s };
  }
  /** Where an angle's label sits: on the bisector, past the arc, far enough in that it fits between the arms. */
  function wedgeLabelPos(v, a, s, box, rArc, maxD) {
    var dir = polar(1, a + s / 2), ext = reach(dir, box), half = Math.hypot(box.w, box.h) / 2;
    var d = rArc + 6 + ext;
    if (s < Math.PI) d = Math.max(d, (half * 0.8 + 3) / Math.sin(s / 2));
    if (maxD) d = Math.min(d, Math.max(rArc + 6 + ext, maxD));
    return vadd(v, vmul(dir, d));
  }
  function wedgeLabel(pic, v, a, s, text, rArc, size, maxD) {
    if (!text) return null;
    var p = wedgeLabelPos(v, a, s, textBox(text, size), rArc, maxD);
    pic.text(p, text, { size: size, halo: true });
    return p;
  }
  function arcs(pic, v, a, s, r, n) {
    for (var k = 0; k < n; k++) pic.arc(v, r + k * 6, a, s, { w: pic.lw * 0.6 });
  }
  /** Where a corner's letter goes: outside, along the line that halves the outside of the corner. */
  function vertexNamePos(v, p, q, box) {
    var u = vadd(vunit(vsub(p, v)), vunit(vsub(q, v)));
    var dir = vlen(u) < 1e-6 ? vunit([-(q[1] - v[1]), q[0] - v[0]]) : vmul(vunit(u), -1);
    return vadd(v, vmul(dir, 9 + reach(dir, box)));
  }
  /** Which values are equal: 0 for one on its own, 1, 2, 3 … for each group of equal ones. */
  function groups(vals) {
    var g = vals.map(function () { return 0; }), next = 1;
    for (var i = 0; i < vals.length; i++) {
      if (g[i]) continue;
      var same = [];
      for (var j = i + 1; j < vals.length; j++) if (!g[j] && near(vals[i], vals[j])) same.push(j);
      if (same.length) { g[i] = next; same.forEach(function (j) { g[j] = next; }); next++; }
    }
    return g;
  }

  /**
   * Labels and marks round a convex polygon. o.sides[i] is the side from
   * pts[i] to pts[i+1]: { text, ticks, arrows, rev }. o.angles[i] is the
   * corner at pts[i]: { text, arcs, box }. o.names[i] is that corner's letter.
   */
  function labelPolygon(pic, pts, o) {
    var n = pts.length, ccw = area(pts) > 0, size = o.size || SIZE, i;
    var lens = pts.map(function (p, k) { return dist(p, pts[(k + 1) % n]); });
    var at = { sides: [], angles: [], names: [] };
    for (i = 0; i < n; i++) {
      var a = pts[i], b = pts[(i + 1) % n], sd = (o.sides || [])[i] || {};
      if (sd.ticks) ticks(pic, a, b, sd.ticks);
      if (sd.arrows) chevrons(pic, sd.rev ? b : a, sd.rev ? a : b, sd.arrows);
      at.sides[i] = sideLabel(pic, a, b, outward(a, b, ccw), sd.text, size, sd.ticks || sd.arrows ? 17 : 9);
    }
    for (i = 0; i < n; i++) {
      var v = pts[i], p = pts[(i + n - 1) % n], q = pts[(i + 1) % n], an = (o.angles || [])[i] || {};
      var adj = Math.min(lens[i], lens[(i + n - 1) % n]);
      var w = wedge(v, p, q);
      if (an.box) rightBox(pic, v, vunit(vsub(p, v)), vunit(vsub(q, v)), clamp(adj * 0.12, 10, 18));
      var rArc = clamp(adj * 0.16, 14, 30);
      if (!an.box && an.arcs) arcs(pic, v, w.a, w.s, rArc, an.arcs);
      at.angles[i] = wedgeLabel(pic, v, w.a, w.s, an.text, an.box ? clamp(adj * 0.12, 10, 18) : rArc + (an.arcs > 1 ? (an.arcs - 1) * 6 : 0), size, adj * 0.55);
      if (o.names && o.names[i]) {
        var np = vertexNamePos(v, p, q, textBox(o.names[i], size));
        pic.text(np, o.names[i], { size: size });
        at.names[i] = np;
      }
    }
    return at;
  }
  /**
   * A dashed height from `top` to the line through a and b, with a
   * right-angle box at the foot, and a dashed extension of the base when the
   * foot falls outside it (an obtuse triangle, a slanting parallelogram).
   */
  function heightLine(pic, top, a, b, text, size, toward) {
    var L = dist(a, b), u = vunit(vsub(b, a)), t = vdot(vsub(top, a), u), foot = vadd(a, vmul(u, t)), thin = pic.lw * 0.6;
    pic.line(top, foot, { dash: true, w: thin });
    if (t < 0) pic.line(a, foot, { dash: true, w: thin });
    else if (t > L) pic.line(b, foot, { dash: true, w: thin });
    var up = vunit(vsub(top, foot)), along = vmul(u, t > L / 2 ? -1 : 1), bs = 12;
    if (vlen(vsub(top, foot)) > bs * 2) rightBox(pic, foot, along, up, bs);
    var at = null;
    if (text) {
      // The label goes on the side of the line with more of the shape (toward), else away from the box.
      var side = toward ? vmul(u, vdot(vsub(toward, foot), u) >= 0 ? 1 : -1) : vmul(along, -1);
      at = vadd(mid(top, foot), vmul(side, 8 + reach(side, textBox(text, size))));
      pic.text(at, text, { size: size, halo: true });
    }
    return { foot: foot, at: at };
  }

  /* ── Triangles ─────────────────────────────────────────────────────── */

  var TRI_METHODS = ['sss', 'sas', 'asa', 'aas', 'aaa', 'right'];
  function acosDeg(x) { return Math.acos(clamp(x, -1, 1)) / DEG; }
  function sinD(d) { return Math.sin(d * DEG); }
  function cosD(d) { return Math.cos(d * DEG); }

  /**
   * Solve a triangle from what was given. Sides a, b, c are opposite angles
   * A, B, C: a is BC, b is CA, c is AB.
   *   sss    a, b, c
   *   sas    b, c and the angle A between them
   *   asa    A, B and the side c between them
   *   aas    A, B and the side a, not between them
   *   aaa    A, B, C: the shape only
   *   right  legs a and b, the right angle at C
   * Returns { a, b, c, A, B, C, given, method } or { error, field }.
   */
  function solveTriangle(s) {
    var m = TRI_METHODS.indexOf(s.method) >= 0 ? s.method : 'sss';
    var a = num(s.a, NaN), b = num(s.b, NaN), c = num(s.c, NaN), A = num(s.A, NaN), B = num(s.B, NaN), C = num(s.C, NaN);
    var NAME = { a: 'BC', b: 'CA', c: 'AB' }, e;
    function side(k, v, word) { return v > 0 ? null : { error: (word || 'Side') + ' ' + NAME[k] + ' needs a length more than 0.', field: k }; }
    function angle(k, v) { return v > 0 && v < 180 ? null : { error: 'Angle ' + k + ' needs to be more than 0° and less than 180°.', field: k }; }
    function twoAngles() {
      if (A + B >= 180 - 1e-9) return { error: 'Angles A and B add up to ' + fmt(A + B, 2) + '°. A triangle’s three angles make 180°, so these two must add up to less than 180°.', field: 'B' };
      return null;
    }
    var given;
    if (m === 'sss') {
      if ((e = side('a', a) || side('b', b) || side('c', c))) return e;
      var srt = [['a', a], ['b', b], ['c', c]].sort(function (x, y) { return x[1] - y[1]; });
      if (srt[0][1] + srt[1][1] <= srt[2][1] * (1 + 1e-9)) {
        return { error: "Those three sides can't make a triangle: " + fmt(srt[0][1], 4) + ' + ' + fmt(srt[1][1], 4) + ' is not more than ' + fmt(srt[2][1], 4) + '. The two shorter sides must add up to more than the longest.', field: srt[2][0] };
      }
      A = acosDeg((b * b + c * c - a * a) / (2 * b * c));
      B = acosDeg((a * a + c * c - b * b) / (2 * a * c));
      C = 180 - A - B;
      given = { a: 1, b: 1, c: 1 };
    } else if (m === 'sas') {
      if ((e = side('c', c) || side('b', b) || angle('A', A))) return e;
      a = Math.sqrt(b * b + c * c - 2 * b * c * cosD(A));
      B = acosDeg((a * a + c * c - b * b) / (2 * a * c));
      C = 180 - A - B;
      given = { b: 1, c: 1, A: 1 };
    } else if (m === 'asa') {
      if ((e = angle('A', A) || angle('B', B) || twoAngles() || side('c', c))) return e;
      C = 180 - A - B; a = c * sinD(A) / sinD(C); b = c * sinD(B) / sinD(C);
      given = { A: 1, B: 1, c: 1 };
    } else if (m === 'aas') {
      if ((e = angle('A', A) || angle('B', B) || twoAngles() || side('a', a))) return e;
      C = 180 - A - B; c = a * sinD(C) / sinD(A); b = a * sinD(B) / sinD(A);
      given = { A: 1, B: 1, a: 1 };
    } else if (m === 'aaa') {
      if ((e = angle('A', A) || angle('B', B) || angle('C', C))) return e;
      if (Math.abs(A + B + C - 180) > 0.01) return { error: 'Those angles add up to ' + fmt(A + B + C, 2) + '°. A triangle’s angles always add up to 180°.', field: 'C' };
      c = 1; a = sinD(A) / sinD(C); b = sinD(B) / sinD(C);
      given = { A: 1, B: 1, C: 1 };
    } else {
      if ((e = side('a', a, 'Leg') || side('b', b, 'Leg'))) return e;
      c = Math.hypot(a, b); A = Math.atan2(a, b) / DEG; B = 90 - A; C = 90;
      given = { a: 1, b: 1, C: 1 };
    }
    return { a: a, b: b, c: c, A: A, B: B, C: C, given: given, method: m };
  }
  /** Corners A, B, C, drawn to scale; a right triangle sits on its legs. */
  function trianglePoints(t, s) {
    var pts = t.method === 'right'
      ? [[0, t.b], [t.a, 0], [0, 0]]
      : [[0, 0], [t.c, 0], [t.b * cosD(t.A), t.b * sinD(t.A)]];
    return place(pts, s.rot, s.flip, 380);
  }
  function buildTriangle(s, ink) {
    var t = solveTriangle(s);
    if (t.error) return t;
    var pts = trianglePoints(t, s), pic = new Pic(ink), u = unitText(s.u), dp = clamp(Math.round(num(s.dp, 1)), 0, 4);
    pic.poly(pts, { close: true });
    var lens = [t.c, t.a, t.b], keys = ['sAB', 'sBC', 'sCA'], gk = ['c', 'a', 'b'];
    var tk = s.ticks ? groups(lens) : [0, 0, 0];
    var sides = lens.map(function (L, i) {
      var g = !!t.given[gk[i]], auto = t.method === 'aaa' ? '' : fmt(L, g ? 4 : dp) + u;
      pic.auto[keys[i]] = auto;
      return { text: pick(s[keys[i]], auto, g ? s.giv : s.calc), ticks: tk[i] };
    });
    var angs = [t.A, t.B, t.C], ak = ['gA', 'gB', 'gC'], an = ['A', 'B', 'C'];
    var eq = s.arcs ? groups(angs) : [0, 0, 0];
    var angles = angs.map(function (g, i) {
      var right = s.box && Math.abs(g - 90) < 1e-7, isGiven = !!t.given[an[i]], auto = fmt(g, isGiven ? 4 : dp) + '°';
      pic.auto[ak[i]] = auto;
      var text = pick(s[ak[i]], right ? '' : auto, isGiven ? s.giv : s.calc);
      return { text: text, box: right, arcs: right ? 0 : (eq[i] ? eq[i] + 1 : (text ? 1 : 0)) };
    });
    labelPolygon(pic, pts, { sides: sides, angles: angles, names: s.names ? [s.nA, s.nB, s.nC] : null });
    var ai = { A: 0, B: 1, C: 2 }[s.alt];
    if (ai != null) {
      var area2 = t.b * t.c * sinD(t.A), base = [t.a, t.b, t.c][ai];
      var auto = t.method === 'aaa' ? '' : fmt(area2 / base, dp) + u;
      pic.auto.hLab = auto;
      heightLine(pic, pts[ai], pts[(ai + 1) % 3], pts[(ai + 2) % 3], pick(s.hLab, auto, true), SIZE, centroid(pts));
    }
    pic.facts = t;
    return pic;
  }

  /* ── Quadrilaterals and regular polygons ───────────────────────────── */

  function positive(v, field, what) { return v > 0 ? null : { error: what + ' needs to be more than 0.', field: field }; }
  function names4(s) { return s.names ? [s.nA, s.nB, s.nC, s.nD] : null; }
  function dpOf(s) { return clamp(Math.round(num(s.dp, 1)), 0, 4); }

  function rectPoints(w, h) { return [[0, 0], [w, 0], [w, h], [0, h]]; }
  function buildRect(s, ink) {
    var w = num(s.w, NaN), h = num(s.h, NaN), e;
    if ((e = positive(w, 'w', 'The width') || positive(h, 'h', 'The height'))) return e;
    var pts = place(rectPoints(w, h), s.rot, false, 380), pic = new Pic(ink), u = unitText(s.u);
    pic.poly(pts, { close: true });
    var aw = fmt(w, 4) + u, ah = fmt(h, 4) + u, sq = near(w, h);
    pic.auto.sW = aw; pic.auto.sH = ah;
    var tw = pick(s.sW, aw, s.giv), th = pick(s.sH, ah, s.giv), t1 = s.ticks ? 1 : 0, t2 = s.ticks ? (sq ? 1 : 2) : 0;
    if (s.diag) {
      pic.line(pts[0], pts[2], { w: pic.lw * 0.7 });
      var ad = fmt(Math.hypot(w, h), dpOf(s)) + u, td = pick(s.sD, ad, s.calc);
      pic.auto.sD = ad;
      if (td) {
        var dir = vunit(vsub(pts[2], pts[0])), n = [dir[1], -dir[0]];
        if (vdot(n, vsub(pts[1], pts[0])) < 0) n = vmul(n, -1);
        sideLabel(pic, pts[0], pts[2], n, td, SIZE, 6);
      }
    }
    labelPolygon(pic, pts, {
      sides: [{ text: tw, ticks: t1 }, { text: th, ticks: t2 }, { text: s.all4 ? tw : '', ticks: t1 }, { text: s.all4 ? th : '', ticks: t2 }],
      angles: [0, 1, 2, 3].map(function () { return { box: !!s.boxes }; }),
      names: names4(s),
    });
    return pic;
  }

  function paraPoints(b, side, ang) { var c = cosD(ang) * side, h = sinD(ang) * side; return [[0, 0], [b, 0], [b + c, h], [c, h]]; }
  function buildPara(s, ink) {
    var b = num(s.b, NaN), sd = num(s.s, NaN), ang = num(s.ang, NaN), e;
    if ((e = positive(b, 'b', 'The base') || positive(sd, 's', 'The slanted side'))) return e;
    if (!(ang > 0 && ang < 180)) return { error: 'The angle needs to be more than 0° and less than 180°.', field: 'ang' };
    var pts = place(paraPoints(b, sd, ang), s.rot, s.flip, 380), pic = new Pic(ink), u = unitText(s.u);
    pic.poly(pts, { close: true });
    var ab = fmt(b, 4) + u, as = fmt(sd, 4) + u, aa = fmt(ang, 4) + '°', rh = near(b, sd), right = near(ang, 90);
    pic.auto.sB = ab; pic.auto.sS = as; pic.auto.gA = aa;
    var t1 = s.ticks ? 1 : 0, t2 = s.ticks ? (rh ? 1 : 2) : 0, a1 = s.arrows ? 1 : 0, a2 = s.arrows ? 2 : 0;
    var ta = pick(s.gA, right ? '' : aa, s.giv);
    labelPolygon(pic, pts, {
      sides: [{ text: pick(s.sB, ab, s.giv), ticks: t1, arrows: a1 }, { ticks: t2, arrows: a2 }, { ticks: t1, arrows: a1, rev: true }, { text: pick(s.sS, as, s.giv), ticks: t2, arrows: a2, rev: true }],
      angles: [{ text: ta, arcs: ta ? 1 : 0, box: right }, {}, {}, {}],
      names: names4(s),
    });
    if (s.height && !right) {
      var ah = fmt(sd * sinD(ang), dpOf(s)) + u;
      pic.auto.sH = ah;
      heightLine(pic, pts[3], pts[0], pts[1], pick(s.sH, ah, true), SIZE, centroid(pts));
    }
    return pic;
  }

  function trapOffset(s) {
    var b1 = num(s.b1, NaN), b2 = num(s.b2, NaN);
    return s.type === 'right' ? 0 : s.type === 'free' ? num(s.off, 0) : (b1 - b2) / 2;
  }
  function trapPoints(b1, b2, h, off) { return [[0, 0], [b1, 0], [off + b2, h], [off, h]]; }
  function buildTrap(s, ink) {
    var b1 = num(s.b1, NaN), b2 = num(s.b2, NaN), h = num(s.h, NaN), e;
    if ((e = positive(b1, 'b1', 'The bottom side') || positive(b2, 'b2', 'The top side') || positive(h, 'h', 'The height'))) return e;
    var off = trapOffset(s), raw = trapPoints(b1, b2, h, off);
    var pts = place(raw, s.rot, s.flip, 380), pic = new Pic(ink), u = unitText(s.u), dp = dpOf(s);
    pic.poly(pts, { close: true });
    var a1 = fmt(b1, 4) + u, a2 = fmt(b2, 4) + u, ah = fmt(h, 4) + u, lL = Math.hypot(off, h), lR = Math.hypot(off + b2 - b1, h);
    var aL = fmt(lL, dp) + u, aR = fmt(lR, dp) + u;
    pic.auto.sB1 = a1; pic.auto.sB2 = a2; pic.auto.sH = ah; pic.auto.sL = aL; pic.auto.sR = aR;
    var right = s.type === 'right', iso = s.type === 'iso' || near(lL, lR) && s.type !== 'right';
    var arr = s.arrows ? 1 : 0, tk = s.ticks && iso ? 1 : 0;
    var hText = pick(s.sH, ah, s.giv);
    labelPolygon(pic, pts, {
      sides: [
        { text: pick(s.sB1, a1, s.giv), arrows: arr },
        { text: pick(s.sR, aR, s.calc), ticks: tk },
        { text: pick(s.sB2, a2, s.giv), arrows: arr, rev: true },
        { text: right ? hText : pick(s.sL, aL, s.calc), ticks: tk },
      ],
      angles: right && s.boxes ? [{ box: true }, {}, {}, { box: true }] : [],
      names: names4(s),
    });
    if (!right && s.height) {
      // The height goes where it lands on the bottom side: from D, else from C, else up from A.
      var cc = centroid(pts);
      if (off >= 0 && off <= b1) heightLine(pic, pts[3], pts[0], pts[1], hText, SIZE, cc);
      else if (off + b2 >= 0 && off + b2 <= b1) heightLine(pic, pts[2], pts[0], pts[1], hText, SIZE, cc);
      else heightLine(pic, pts[0], pts[3], pts[2], hText, SIZE, cc);
    }
    return pic;
  }

  function kitePoints(wd, p, q) { return [[0, p], [-wd / 2, 0], [0, -q], [wd / 2, 0]]; }
  function buildKite(s, ink) {
    var wd = num(s.wd, NaN), p = num(s.p, NaN), q = num(s.q, NaN), e;
    if ((e = positive(wd, 'wd', 'The width across') || positive(p, 'p', 'The top part') || positive(q, 'q', 'The bottom part'))) return e;
    var pts = place(kitePoints(wd, p, q), s.rot, false, 380), pic = new Pic(ink), u = unitText(s.u), dp = dpOf(s);
    // Where the diagonals cross, in the placed shape: the same mix of the corners as (0, 0) is of the plain ones.
    var O = vadd(pts[1], vmul(vsub(pts[3], pts[1]), 0.5));
    if (s.diag) {
      pic.line(pts[0], pts[2], { dash: true, w: pic.lw * 0.6 });
      pic.line(pts[1], pts[3], { dash: true, w: pic.lw * 0.6 });
      if (s.box) rightBox(pic, O, vunit(vsub(pts[3], O)), vunit(vsub(pts[0], O)), 12);
      var aw = fmt(wd, 4) + u, ap = fmt(p, 4) + u, aq = fmt(q, 4) + u;
      pic.auto.dW = aw; pic.auto.dP = ap; pic.auto.dQ = aq;
      var tw = pick(s.dW, aw, s.giv), tp = pick(s.dP, ap, s.giv), tq = pick(s.dQ, aq, s.giv);
      var right = vunit(vsub(pts[3], O)), down = vunit(vsub(pts[2], O));
      // Near the crossing, where the kite is widest, so they clear the tick marks.
      var part = function (to) { return vadd(O, vmul(vsub(to, O), 0.7)); };
      if (tw) sideLabel(pic, O, pts[1], down, tw, SIZE * 0.9, 6);
      if (tp) sideLabel(pic, O, part(pts[0]), right, tp, SIZE * 0.9, 6);
      if (tq) sideLabel(pic, O, part(pts[2]), right, tq, SIZE * 0.9, 6);
    }
    pic.poly(pts, { close: true });
    var top = Math.hypot(wd / 2, p), bot = Math.hypot(wd / 2, q), rh = near(p, q);
    var at = fmt(top, dp) + u, ab = fmt(bot, dp) + u;
    pic.auto.sT = at; pic.auto.sB = ab;
    var t1 = s.ticks ? 1 : 0, t2 = s.ticks ? (rh ? 1 : 2) : 0;
    labelPolygon(pic, pts, {
      sides: [{ ticks: t1 }, { ticks: t2 }, { text: pick(s.sB, ab, s.calc), ticks: t2 }, { text: pick(s.sT, at, s.calc), ticks: t1 }],
      names: names4(s),
    });
    return pic;
  }

  var POLY_NAMES = { 3: 'equilateral triangle', 4: 'square', 5: 'pentagon', 6: 'hexagon', 7: 'heptagon', 8: 'octagon', 9: 'nonagon', 10: 'decagon', 11: 'hendecagon', 12: 'dodecagon' };
  function regularPoints(n, side) {
    var R = side / (2 * Math.sin(Math.PI / n)), out = [];
    for (var k = 0; k < n; k++) out.push(polar(R, -Math.PI / 2 - Math.PI / n + 2 * Math.PI * k / n));
    return out;
  }
  function buildReg(s, ink) {
    var n = Math.round(num(s.n, NaN)), side = num(s.s, NaN), e;
    if (!(n >= 3 && n <= 12)) return { error: 'Pick from 3 to 12 sides.', field: 'n' };
    if ((e = positive(side, 's', 'The side length'))) return e;
    var raw = regularPoints(n, side), k = 380 / (2 * side / (2 * Math.sin(Math.PI / n)));
    var rot = (num(s.rot, 0) || 0) * DEG;
    var pts = raw.map(function (p) { return vrot(vmul(p, k), rot); }), C = [0, 0];
    var pic = new Pic(ink), u = unitText(s.u), dp = dpOf(s), size = SIZE;
    pic.poly(pts, { close: true });
    var as = fmt(side, 4) + u, inner = (n - 2) * 180 / n, ai = fmt(inner, dp) + '°';
    pic.auto.sS = as; pic.auto.gI = ai;
    var sides = pts.map(function (_, i) { return { ticks: s.ticks ? 1 : 0, text: i === 0 ? pick(s.sS, as, s.giv) : '' }; });
    var ti = pick(s.gI, ai, s.calc);
    var angles = pts.map(function (_, i) { return i === 1 && ti ? { text: ti, arcs: 1 } : {}; });
    var letters = s.names ? pts.map(function (_, i) { return String.fromCharCode(65 + i); }) : null;
    labelPolygon(pic, pts, { sides: sides, angles: angles, names: letters });
    if (s.centre || s.apo || s.rad) pic.dot(C, 4, {});
    if (s.apo) {
      var m = mid(pts[0], pts[1]), aa = fmt(side / (2 * Math.tan(Math.PI / n)), dp) + u;
      pic.auto.sA = aa;
      pic.line(C, m, { dash: true, w: pic.lw * 0.6 });
      rightBox(pic, m, vunit(vsub(pts[1], m)), vunit(vsub(C, m)), 11);
      var ta = pick(s.sA, aa, true);
      if (ta) { var dir = vunit(vsub(pts[0], m)); pic.text(vadd(mid(C, m), vmul(dir, 8 + reach(dir, textBox(ta, size)))), ta, { size: size, halo: true }); }
    }
    if (s.rad) {
      var vtx = pts[Math.floor(n / 2)], ar = fmt(side / (2 * Math.sin(Math.PI / n)), dp) + u;
      pic.auto.sR = ar;
      pic.line(C, vtx, { dash: true, w: pic.lw * 0.6 });
      var tr = pick(s.sR, ar, true);
      if (tr) { var nn = vunit([-(vtx[1] - C[1]), vtx[0] - C[0]]); pic.text(vadd(mid(C, vtx), vmul(nn, 8 + reach(nn, textBox(tr, size)))), tr, { size: size, halo: true }); }
    }
    return pic;
  }

  /* ── Circles ───────────────────────────────────────────────────────── */

  /*
   * A circle with the parts a circle question names: a radius OA, a
   * diameter, a chord, a shaded sector from OA round to OB, and a tangent
   * at A with its right angle to the radius.
   */
  function buildCircle(s, ink) {
    var r = num(s.r, NaN), e;
    if ((e = positive(r, 'r', 'The radius'))) return e;
    var sec = num(s.sector, 0) || 0;
    if (sec < 0 || sec >= 360) return { error: 'The sector angle needs to be more than 0° and less than 360° (0 for no sector).', field: 'sector' };
    var R = 170, O = [0, 0], pic = new Pic(ink), u = unitText(s.u), dp = dpOf(s), size = SIZE, thin = pic.lw * 0.7;
    var rot = (num(s.rot, 0) || 0) * DEG, aA = rot + 35 * DEG, aB = aA + sec * DEG, A = polar(R, aA), B = polar(R, aB);
    if (sec > 0) {
      var wedgePts = [O];
      for (var i = 0; i <= 60; i++) wedgePts.push(polar(R, aA + sec * DEG * i / 60));
      pic.poly(wedgePts, { close: true, fill: ink, color: 'none', opacity: 0.1 });
    }
    pic.circle(O, R, {});
    var ar = fmt(r, 4) + u, ad = fmt(2 * r, dp) + u, ac = fmt(2 * r * Math.sin(45 * DEG), dp) + u, ag = fmt(sec, dp) + '°';
    pic.auto.sR = ar; pic.auto.sD = ad; pic.auto.sC = ac; pic.auto.gS = ag;
    var showA = s.rad || sec > 0 || s.tangent;
    if (s.rad || sec > 0) {
      pic.line(O, A, { w: thin });
      sideLabel(pic, O, A, polar(1, aA - Math.PI / 2), pick(s.sR, ar, s.giv), size);
    }
    if (sec > 0) {
      pic.line(O, B, { w: thin });
      pic.arc(O, 34, aA, sec * DEG, { w: thin });
      wedgeLabel(pic, O, aA, sec * DEG, pick(s.gS, ag, true), 34, size, R * 0.7);
    }
    if (s.diam) {
      var dA = rot + 160 * DEG, P = polar(R, dA), Q = polar(R, dA + Math.PI);
      pic.line(P, Q, { w: thin });
      sideLabel(pic, O, Q, polar(1, dA + Math.PI - Math.PI / 2), pick(s.sD, ad, s.giv || s.calc), size);
    }
    if (s.chord) {
      var C1 = polar(R, rot + 215 * DEG), C2 = polar(R, rot + 305 * DEG);
      pic.line(C1, C2, { w: thin });
      sideLabel(pic, C1, C2, vunit(mid(C1, C2)), pick(s.sC, ac, s.calc), size);
    }
    if (s.tangent) {
      var t = polar(1, aA + Math.PI / 2);
      pic.line(vsub(A, vmul(t, 150)), vadd(A, vmul(t, 150)), { w: thin });
      rightBox(pic, A, vunit(vsub(O, A)), t, 12);
    }
    if (s.centre || s.rad || sec > 0 || s.diam) pic.dot(O, 4, {});
    if (s.names) {
      var away = vunit(vadd(polar(1, aA + Math.PI), sec > 0 ? polar(1, aB + Math.PI) : [0, 0]));
      if (s.nO) pic.text(vadd(O, vmul(vlen(away) > 0.1 ? away : [0, -1], 22)), s.nO, { size: size, halo: true });
      if (showA && s.nA) pic.text(vadd(A, polar(16 + reach(polar(1, aA), textBox(s.nA, size)), aA)), s.nA, { size: size, halo: true });
      if (sec > 0 && s.nB) pic.text(vadd(B, polar(16 + reach(polar(1, aB), textBox(s.nB, size)), aB)), s.nB, { size: size, halo: true });
    }
    return pic;
  }

  /* ── Angles ────────────────────────────────────────────────────────── */

  var ANGLE_TOTAL = { line: 180, right: 90, point: 360 };
  var ANGLE_WHERE = { line: 'angles on a straight line', right: 'angles that make a right angle', point: 'angles around a point' };
  /** The sizes of the parts: the ones given, then the last one worked out from the total. */
  function angleParts(s) {
    var mode = s.mode;
    if (mode === 'single') {
      var a = num(s.a1, NaN);
      if (!(a > 0 && a < 360)) return { error: 'The angle needs to be more than 0° and less than 360°.', field: 'a1' };
      return { vals: [a], given: 1 };
    }
    if (mode === 'vertical') {
      var v = num(s.a1, NaN);
      if (!(v > 0 && v < 180)) return { error: 'The angle between the lines needs to be more than 0° and less than 180°.', field: 'a1' };
      return { vals: [v, 180 - v, v, 180 - v], given: 1 };
    }
    var T = ANGLE_TOTAL[mode] || 180;
    var n = mode === 'point' ? clamp(Math.round(num(s.parts, 3)), 3, 4) : clamp(Math.round(num(s.parts, 2)), 2, 3);
    var vals = [], sum = 0;
    for (var i = 1; i < n; i++) {
      var x = num(s['a' + i], NaN);
      if (!(x > 0)) return { error: 'Angle ' + i + ' needs to be more than 0°.', field: 'a' + i };
      vals.push(x); sum += x;
    }
    if (sum >= T - 1e-9) return { error: 'Those angles add up to ' + fmt(sum, 2) + '°, but ' + ANGLE_WHERE[mode] + ' make ' + T + '°. Make them smaller so there is room for the last one.', field: 'a' + (n - 1) };
    vals.push(T - sum);
    return { vals: vals, given: n - 1, total: T };
  }
  function buildAngle(s, ink) {
    var P = angleParts(s);
    if (P.error) return P;
    var pic = new Pic(ink), rot = (num(s.rot, 0) || 0) * DEG, R = 250, O = [0, 0], size = SIZE, mode = s.mode;
    var vals = P.vals, starts = [], acc = 0;
    vals.forEach(function (v) { starts.push(acc); acc += v; });
    var ray = function (deg) { return polar(R, rot + deg * DEG); };
    if (mode === 'single') { pic.line(O, ray(0)); pic.line(O, ray(vals[0])); }
    else if (mode === 'line' || mode === 'vertical') {
      pic.line(ray(180), ray(0));
      if (mode === 'vertical') pic.line(ray(vals[0] + 180), ray(vals[0]));
      else for (var i = 1; i < vals.length; i++) pic.line(O, ray(starts[i]));
    } else if (mode === 'right') {
      pic.line(O, ray(0)); pic.line(O, ray(90));
      for (var j = 1; j < vals.length; j++) pic.line(O, ray(starts[j]));
    } else {
      starts.forEach(function (st) { pic.line(O, ray(st)); });
    }
    vals.forEach(function (v, k) {
      var key = 'l' + (k + 1), auto = fmt(v, k < P.given ? 4 : dpOf(s)) + '°';
      pic.auto[key] = auto;
      var right = near(v, 90) && mode !== 'vertical';
      var text = pick(s[key], right && !s[key] ? '' : auto, k < P.given ? s.giv : s.calc);
      var a = rot + starts[k] * DEG, sw = v * DEG, rArc = k % 2 ? 54 : 42;
      if (right) rightBox(pic, O, polar(1, a), polar(1, a + sw), 20);
      else if (text || mode === 'single') pic.arc(O, rArc, a, sw, { w: pic.lw * 0.6 });
      if (text) wedgeLabel(pic, O, a, sw, text, right ? 20 : rArc, size, R * 0.75);
    });
    if (s.names && mode === 'single') {
      var b1 = textBox(s.nA, size), b3 = textBox(s.nC, size), u1 = polar(1, rot), u2 = polar(1, rot + vals[0] * DEG);
      if (s.nA) pic.text(vadd(ray(0), vmul(u1, 10 + reach(u1, b1))), s.nA, { size: size });
      if (s.nC) pic.text(vadd(ray(vals[0]), vmul(u2, 10 + reach(u2, b3))), s.nC, { size: size });
      if (s.nB) {
        var back = polar(-1, rot + vals[0] * DEG / 2);
        if (vals[0] > 180) back = vmul(back, -1);
        pic.text(vadd(O, vmul(back, 10 + reach(back, textBox(s.nB, size)))), s.nB, { size: size });
      }
    }
    return pic;
  }

  /* ── Parallel lines cut by a transversal ───────────────────────────── */

  /**
   * The eight angles, numbered the way most worksheets do: at the top
   * crossing 1 upper left, 2 upper right, 3 lower left, 4 lower right; then
   * 5 to 8 the same at the bottom crossing. th is the angle the transversal
   * makes with the lines (measured anticlockwise from the right).
   */
  function parallelAngles(th) {
    var w = [[th, 180 - th], [0, th], [180, th], [180 + th, 180 - th]];
    var out = [];
    for (var k = 0; k < 8; k++) { var q = w[k % 4]; out.push({ n: k + 1, at: k < 4 ? 0 : 1, start: q[0], size: q[1] }); }
    return out;
  }
  function buildParallel(s, ink) {
    var th = num(s.ang, NaN);
    if (!(th > 0 && th < 180)) return { error: 'The angle needs to be more than 0° and less than 180°.', field: 'ang' };
    var pic = new Pic(ink), g = 180, t = th * DEG, rot = (num(s.rot, 0) || 0) * DEG, size = SIZE;
    var R = function (p) { return vrot(p, rot); };
    var cx = g / 2 * Math.cos(t) / Math.sin(t), I = [[cx, g / 2], [-cx, -g / 2]];
    var xa = Math.min(-cx, cx) - 190, xb = Math.max(-cx, cx) + 190, dir = [Math.cos(t), Math.sin(t)];
    pic.line(R([xa, g / 2]), R([xb, g / 2]));
    pic.line(R([xa, -g / 2]), R([xb, -g / 2]));
    var tEnd = vadd(I[0], vmul(dir, 130)), tStart = vsub(I[1], vmul(dir, 130));
    pic.line(R(tStart), R(tEnd));
    if (s.arrows) {
      [g / 2, -g / 2].forEach(function (y) { chevrons(pic, R([xb - 70, y]), R([xb - 40, y]), 1); });
    }
    if (s.names) {
      var e1 = vunit(R([1, 0]));
      if (s.nL) pic.text(vadd(R([xb, g / 2]), vmul(e1, 10 + reach(e1, textBox(s.nL, size)))), s.nL, { size: size });
      if (s.nM) pic.text(vadd(R([xb, -g / 2]), vmul(e1, 10 + reach(e1, textBox(s.nM, size)))), s.nM, { size: size });
      var e2 = vunit(R(dir));
      if (s.nT) pic.text(vadd(R(tEnd), vmul(e2, 10 + reach(e2, textBox(s.nT, size)))), s.nT, { size: size });
    }
    parallelAngles(th).forEach(function (q) {
      var key = 'c' + q.n, auto = s.mode === 'sizes' ? fmt(q.size, 4) + '°' : s.mode === 'numbers' ? String(q.n) : '';
      pic.auto[key] = s.mode === 'sizes' ? auto : fmt(q.size, 4) + '°';
      var text = pick(s[key], auto, true);
      if (!text) return;
      var v = R(I[q.at]), a = rot + q.start * DEG, sw = q.size * DEG, isNum = /^\d$/.test(text);
      var rArc = 26;
      if (s.arcs && !isNum) pic.arc(v, rArc, a, sw, { w: pic.lw * 0.6 });
      wedgeLabel(pic, v, a, sw, text, s.arcs && !isNum ? rArc : 4, isNum ? size * 0.9 : size * 0.85, 120);
    });
    return pic;
  }

  /* ── Number lines ──────────────────────────────────────────────────── */

  function gcd(a, b) { while (b) { var t = b; b = a % b; a = t; } return a; }
  /** The nearest fraction with a denominator up to 64. */
  function fraction(v) {
    var sg = v < 0 ? -1 : 1, x = Math.abs(v), bn = Math.round(x), bd = 1, err = Math.abs(x - bn);
    for (var d = 2; d <= 64 && err > 1e-9; d++) {
      var n = Math.round(x * d), e = Math.abs(x - n / d);
      if (e < err - 1e-12) { err = e; bn = n; bd = d; }
    }
    var g = gcd(bn, bd) || 1;
    return { n: sg * bn / g, d: bd / g };
  }
  var NUM_RE = '[-+]?(?:\\d+\\.?\\d*|\\.\\d+)(?:\\/\\d+)?';
  function parseNum(t) { return num(String(t).replace(/\s+/g, ''), NaN); }
  /**
   * What to mark on a number line, one per line:
   *   3 · open 3 · P = 3      a dot (open or closed), with a letter if given
   *   x > 2 · x <= -1         a ray, open or closed at its end
   *   -1 <= x < 3             a piece between two numbers
   *   x < -1 or x >= 2        two of them
   */
  function parseMarks(text) {
    var items = [], lines = String(text || '').split('\n');
    for (var li = 0; li < lines.length; li++) {
      var line = lines[li].trim();
      if (!line) continue;
      var parts = line.replace(/≤/g, '<=').replace(/≥/g, '>=').replace(/−/g, '-').split(/\s+or\s+/i);
      for (var pi = 0; pi < parts.length; pi++) {
        var r = parseMark(parts[pi].trim());
        if (r.error) return { error: 'Line ' + (li + 1) + ' of the marks (“' + line + '”): ' + r.error, field: 'marks' };
        items.push(r);
      }
    }
    return { items: items };
  }
  function parseMark(t) {
    var m;
    var dot = new RegExp('^(?:(open|closed|filled)\\s+)?(?:([A-Z][A-Za-z0-9\']*)\\s*[:=]\\s*)?(' + NUM_RE + ')(?:\\s+(open|closed|filled))?$', 'i');
    if ((m = dot.exec(t))) return { t: 'dot', v: parseNum(m[3]), open: /open/i.test((m[1] || '') + (m[4] || '')), label: m[2] || '' };
    if ((m = new RegExp('^[a-z]\\s*=\\s*(' + NUM_RE + ')$').exec(t))) return { t: 'dot', v: parseNum(m[1]), open: false, label: '' };
    var OP = '(<=|>=|<|>)';
    if ((m = new RegExp('^(' + NUM_RE + ')\\s*' + OP + '\\s*[a-z]\\s*' + OP + '\\s*(' + NUM_RE + ')$').exec(t))) {
      var a = parseNum(m[1]), b = parseNum(m[4]), up = m[2][0] === '<';
      if ((m[3][0] === '<') !== up) return { error: 'both signs should point the same way, like −1 < x < 3.' };
      var lo = up ? a : b, hi = up ? b : a, loOpen = (up ? m[2] : m[3]).length === 1, hiOpen = (up ? m[3] : m[2]).length === 1;
      if (!(lo < hi)) return { error: fmt(lo, 4) + ' is not less than ' + fmt(hi, 4) + ', so nothing fits between them.' };
      return { t: 'seg', a: lo, b: hi, oa: loOpen, ob: hiOpen };
    }
    if ((m = new RegExp('^[a-z]\\s*' + OP + '\\s*(' + NUM_RE + ')$').exec(t))) return { t: 'ray', v: parseNum(m[2]), dir: m[1][0] === '>' ? 1 : -1, open: m[1].length === 1 };
    if ((m = new RegExp('^(' + NUM_RE + ')\\s*' + OP + '\\s*[a-z]$').exec(t))) return { t: 'ray', v: parseNum(m[1]), dir: m[2][0] === '<' ? 1 : -1, open: m[2].length === 1 };
    return { error: 'I could not read that. Write a number like 3, open 3, P = 3, or an inequality like x > 2 or −1 ≤ x < 3.' };
  }
  function buildNumline(s, ink) {
    var a = num(s.from, NaN), b = num(s.to, NaN), st = num(s.step, NaN);
    if (!isFinite(a)) return { error: 'Type the number the line starts at.', field: 'from' };
    if (!isFinite(b)) return { error: 'Type the number the line ends at.', field: 'to' };
    if (!(b > a)) return { error: 'The line has to end at a bigger number than it starts at: ' + fmt(a, 4) + ' is not less than ' + fmt(b, 4) + '.', field: 'to' };
    if (!(st > 0)) return { error: 'The step between ticks needs to be more than 0.', field: 'step' };
    var n = (b - a) / st, N = Math.floor(n + 1e-9);
    if (N > 100) return { error: 'That would be ' + N + ' ticks. Make the step bigger or the line shorter: 100 at most.', field: 'step' };
    if (N < 1) return { error: 'The step is longer than the whole line. Make it smaller.', field: 'step' };
    var M = parseMarks(s.marks);
    if (M.error) return M;
    for (var i = 0; i < M.items.length; i++) {
      var it = M.items[i], vs = it.t === 'seg' ? [it.a, it.b] : [it.v];
      for (var j = 0; j < vs.length; j++) if (vs[j] < a - 1e-9 || vs[j] > b + 1e-9) return { error: fmt(vs[j], 4) + ' is off the number line: it runs from ' + fmt(a, 4) + ' to ' + fmt(b, 4) + '.', field: 'marks' };
    }
    var px = clamp(720 / n, 22, 80), X = function (v) { return (v - a) / st * px; }, end = X(b);
    var pic = new Pic(ink, 2.5), size = clamp(px * 0.45, 15, 20), ext = s.arrows ? 30 : 0, lw = 6, blue = ink;
    pic.line([-ext, 0], [end + ext, 0]);
    if (s.arrows) {
      pic.poly([[-ext - 4, 0], [-ext + 12, 7], [-ext + 12, -7]], { close: true, fill: ink, w: 1.5 });
      pic.poly([[end + ext + 4, 0], [end + ext - 12, 7], [end + ext - 12, -7]], { close: true, fill: ink, w: 1.5 });
    }
    var every = Math.max(1, Math.round(num(s.every, 1)) || 1), minor = clamp(Math.round(num(s.minor, 0)) || 0, 0, 19);
    for (var k = 0; k <= N; k++) {
      var x = X(a + k * st);
      pic.line([x, -11], [x, 11], { w: 2 });
      if (minor && k < N) for (var mm = 1; mm <= minor; mm++) { var xm = x + px * mm / (minor + 1); pic.line([xm, -6], [xm, 6], { w: 1.3 }); }
      if (s.nums && k % every === 0) numberLabel(pic, x, -30 - (s.frac ? 6 : 0), a + k * st, size, s.frac);
    }
    M.items.forEach(function (it) {
      if (it.t === 'seg') pic.line([X(it.a), 0], [X(it.b), 0], { w: lw, color: blue });
      if (it.t === 'ray') {
        var tip = it.dir > 0 ? end + ext + 2 : -ext - 2;
        pic.line([X(it.v), 0], [tip - it.dir * 10, 0], { w: lw, color: blue });
        pic.poly([[tip + it.dir * 6, 0], [tip - it.dir * 14, 11], [tip - it.dir * 14, -11]], { close: true, fill: blue, color: blue, w: 1.5 });
      }
    });
    M.items.forEach(function (it) {
      if (it.t === 'seg') { pic.dot([X(it.a), 0], 8, { open: it.oa, color: blue, w: 3 }); pic.dot([X(it.b), 0], 8, { open: it.ob, color: blue, w: 3 }); }
      if (it.t === 'ray') pic.dot([X(it.v), 0], 8, { open: it.open, color: blue, w: 3 });
      if (it.t === 'dot') {
        pic.dot([X(it.v), 0], 8, { open: it.open, color: blue, w: 3 });
        if (it.label) pic.text([X(it.v), 30], it.label, { size: size + 2 });
      }
    });
    return pic;
  }
  function numberLabel(pic, x, y, v, size, frac) {
    if (!frac || near(v, Math.round(v))) { pic.text([x, y], fmt(v, 6), { size: size }); return; }
    var f = fraction(v), neg = f.n < 0, n = Math.abs(f.n), whole = Math.floor(n / f.d), rest = n % f.d;
    var fs = size * 0.85, wd = textWidth(String(Math.max(rest, f.d)), fs);
    var lead = (neg ? MINUS : '') + (whole ? String(whole) : ''), lw = lead ? textWidth(lead, size) + 2 : 0, left = x - (lw + wd) / 2;
    if (lead) pic.text([left + lw / 2 - 1, y], lead, { size: size });
    var fx = left + lw + wd / 2;
    pic.text([fx, y + fs * 0.6], String(rest), { size: fs });
    pic.line([fx - wd / 2 - 1, y], [fx + wd / 2 + 1, y], { w: 1.4 });
    pic.text([fx, y - fs * 0.62], String(f.d), { size: fs });
  }

  /* ── Coordinate grids ──────────────────────────────────────────────── */

  var PT_RE = new RegExp("([A-Za-z][A-Za-z0-9']*)?\\s*\\(\\s*([-+\\u2212]?(?:\\d+\\.?\\d*|\\.\\d+)(?:\\/\\d+)?)\\s*[,;]\\s*([-+\\u2212]?(?:\\d+\\.?\\d*|\\.\\d+)(?:\\/\\d+)?)\\s*\\)", 'g');
  /**
   * Points and shapes on a grid, one per line:
   *   A(2, 3) B(-1, 4)            points
   *   polygon A(0,0) B(4,0) C(4,3) a closed shape (also: triangle, shape)
   *   segment (0,0) (3,4)          a path (also: line, or points joined by -)
   */
  function parsePoints(text) {
    var items = [], lines = String(text || '').split('\n');
    for (var li = 0; li < lines.length; li++) {
      var line = lines[li].trim();
      if (!line) continue;
      var kw = /^(polygon|triangle|quadrilateral|shape|segment|line|path)\b\s*:?\s*/i.exec(line);
      var body = kw ? line.slice(kw[0].length) : line, pts = [], m;
      PT_RE.lastIndex = 0;
      while ((m = PT_RE.exec(body))) pts.push({ name: m[1] || '', x: parseNum(m[2]), y: parseNum(m[3]) });
      if (!pts.length) return { error: 'Line ' + (li + 1) + ' of the points (“' + line + '”): I could not find a point there. Write one like A(2, 3) or (2, 3).', field: 'pts' };
      var kind = kw && /polygon|triangle|quadrilateral|shape/i.test(kw[1]) ? 'poly' : (kw || /\)\s*[-–—]\s*[A-Za-z(]/.test(body)) ? 'path' : 'pts';
      if (kind !== 'pts' && pts.length < 2) return { error: 'Line ' + (li + 1) + ' of the points: a ' + (kind === 'poly' ? 'shape' : 'segment') + ' needs at least two points.', field: 'pts' };
      items.push({ kind: kind, pts: pts });
    }
    return { items: items };
  }
  /* ── Reading maths the way students type it ────────────────────────── */

  var BARE_FNS = ['sinh', 'cosh', 'tanh', 'asin', 'acos', 'atan', 'sqrt', 'cbrt', 'sin', 'cos', 'tan', 'exp', 'abs', 'log', 'ln'];
  /* A function name with no bracket after it, and the short term it applies
     to: "sin 2x", "ln x", "sqrt x", "cos^2 x". */
  var BARE_RE = new RegExp('(^|[^A-Za-z])(' + BARE_FNS.join('|') + ')(\\^\\s*\\d+)?(?!\\s*\\()\\s*'
    + '(-?(?:\\d+\\.?\\d*|\\.\\d+)?\\s*(?:pi|π|[a-z])?(?:\\s*\\^\\s*(?:\\d+\\.?\\d*|[a-z]))?)', 'gi');
  /** |x − 1| into abs(x − 1). A bar opens after an operator, a bracket or another opening bar; otherwise it closes. */
  function absBars(s) {
    if (s.indexOf('|') < 0) return s;
    var out = '', depth = 0, last = '', lastOpen = false;
    for (var i = 0; i < s.length; i++) {
      var c = s[i];
      if (c === '|') {
        if (depth === 0 || lastOpen || last === '' || /[(+\-*/^=<>,≤≥]/.test(last)) { out += 'abs('; depth++; lastOpen = true; last = '('; }
        else { out += ')'; depth--; lastOpen = false; last = ')'; }
        continue;
      }
      out += c;
      if (c !== ' ') { last = c; lastOpen = false; }
    }
    return out;
  }
  /**
   * What a student types, into what FluxExpr reads: a real minus, × and ÷,
   * ² and ³, √, |x|, and the brackets people leave off (sin x, ln 2x).
   */
  function tidyMath(src) {
    var s = String(src == null ? '' : src)
      .replace(/[−–—]/g, '-').replace(/[×·⋅∙]/g, '*').replace(/÷/g, '/')
      .replace(/²/g, '^2').replace(/³/g, '^3').replace(/½/g, '(1/2)')
      .replace(/=</g, '<=').replace(/=>/g, '>=')
      .replace(/\barc(sin|cos|tan)\b/gi, 'a$1')
      .replace(/√\s*\(/g, 'sqrt(').replace(/√\s*(\d*\.?\d*\s*[a-z]?)/gi, 'sqrt($1)')
      .replace(/(^|[^a-z])([xy]{2,})(?![a-z])/gi, function (all, pre, w) { return pre + w.split('').join('*'); });   // 2xy is 2·x·y
    s = absBars(s);
    return s.replace(BARE_RE, function (all, pre, name, pow, term) {
      if (!term || !term.trim()) return all;
      return pre + name + '(' + term.trim() + ')' + (pow ? pow.replace(/\s+/g, '') : '');
    });
  }

  var REL_OPS = ['<=', '>=', '≤', '≥', '<', '>', '='];
  /** The one comparison outside any brackets: { lhs, op, rhs }, { error }, or null when there is none. */
  function splitRelation(s) {
    var found = [], depth = 0;
    for (var i = 0; i < s.length; i++) {
      var c = s[i];
      if (c === '(' || c === '[' || c === '{') depth++;
      else if (c === ')' || c === ']' || c === '}') depth--;
      else if (depth === 0) {
        if ((c === '!' && s[i + 1] === '=') || c === '≠') return { error: '≠ cannot be drawn: use =, < or >.' };
        for (var k = 0; k < REL_OPS.length; k++) {
          if (s.substr(i, REL_OPS[k].length) === REL_OPS[k]) { found.push({ i: i, op: REL_OPS[k] }); i += REL_OPS[k].length - 1; break; }
        }
      }
    }
    if (!found.length) return null;
    if (found.length > 1) return { error: 'Use one =, < or > on a line, like y = 2x + 1 or y > x^2.' };
    var f = found[0];
    return { lhs: s.slice(0, f.i).trim(), op: ({ '≤': '<=', '≥': '>=' })[f.op] || f.op, rhs: s.slice(f.i + f.op.length).trim() };
  }
  /**
   * Where a line limits x: "y = 2x for −3 < x < 4", "y = x^2 {0 ≤ x ≤ 5}",
   * "y = √x, x ≥ 0". { rest, lim: { lo, hi, loIn, hiIn } | null } or { error }.
   */
  function splitDomain(line) {
    var m = /\{([^{}]*)\}\s*$/.exec(line) || /\s(?:for|when|where|if)\s+([^=]+)$/i.exec(line) || /,\s*([^,()]*\bx\b[^,()]*[<>≤≥][^,()]*)$/i.exec(line);
    if (!m) return { rest: line, lim: null };
    var E = root.FluxExpr, lim = { lo: -Infinity, hi: Infinity, loIn: true, hiIn: true };
    var conds = tidyMath(m[1]).split(/\s*(?:,|\band\b|&&)\s*/i).filter(Boolean);
    if (!conds.length) return { error: 'Put a limit on x after it, like “for −3 < x < 4”.' };
    for (var c = 0; c < conds.length; c++) {
      var parts = conds[c].split(/\s*(<=|>=|≤|≥|<|>)\s*/), sawX = false;
      for (var j = 0; j + 2 < parts.length; j += 2) {
        var a = parts[j].trim(), op = parts[j + 1], b = parts[j + 2].trim(), aX = /^x$/i.test(a), bX = /^x$/i.test(b);
        if (aX === bX) return { error: 'A limit compares x with a number, like “for −3 < x < 4”.' };
        var other = E.tryCompile(aX ? b : a, 'x');
        if (other.error || other.usesVar) return { error: 'A limit compares x with a number, like “for −3 < x < 4”.' };
        var v = other.fn(0), less = op === '<' || op === '<=' || op === '≤', incl = op.length > 1 || op === '≤' || op === '≥';
        if ((aX ? less : !less)) { if (v < lim.hi) { lim.hi = v; lim.hiIn = incl; } }
        else if (v > lim.lo) { lim.lo = v; lim.loIn = incl; }
        sawX = true;
      }
      if (!sawX) return { error: 'A limit compares x with a number, like “for −3 < x < 4”.' };
    }
    if (!(lim.hi > lim.lo)) return { error: 'There is no x that fits that limit: ' + fmt(lim.lo, 4) + ' is not less than ' + fmt(lim.hi, 4) + '.' };
    return { rest: line.slice(0, m.index).trim(), lim: lim };
  }
  /** g(t) = c + k·t for every t tried, or null. */
  function affine(g) {
    var ts = [-3.7, 0.6, 2.9, 5.3], vs = ts.map(function (t) { try { return g(t); } catch (e) { return NaN; } });
    if (!vs.every(isFinite)) return null;
    var k = (vs[1] - vs[0]) / (ts[1] - ts[0]);
    for (var i = 2; i < ts.length; i++) if (Math.abs(vs[i] - (vs[0] + k * (ts[i] - ts[0]))) > 1e-7 * (1 + Math.abs(vs[i]))) return null;
    return { c: vs[0] - k * ts[0], k: k };
  }
  /** Whether F(x, y) is a straight function of y at every x tried: 1 or −1 when the slope keeps its sign, 2 when it flips, 0 when it is not straight. */
  function linearInY(F) {
    var xs = [-9.7, -6.1, -3.3, -1.2, -0.4, 0.3, 1.1, 2.6, 4.9, 8.3], pos = 0, neg = 0;
    for (var i = 0; i < xs.length; i++) {
      var x = xs[i], f0 = F(x, 0), f1 = F(x, 1), f3 = F(x, 3), fm = F(x, -2);
      if (![f0, f1, f3, fm].every(isFinite)) continue;
      var k = f1 - f0, tol = 1e-7 * (1 + Math.abs(f0) + Math.abs(f3) + Math.abs(fm));
      if (Math.abs(f3 - f0 - 3 * k) > tol || Math.abs(fm - f0 + 2 * k) > tol) return 0;
      if (k > 1e-12) pos++; else if (k < -1e-12) neg++;
    }
    if (pos + neg < 3) return 0;
    return neg === 0 ? 1 : pos === 0 ? -1 : 2;
  }
  /**
   * One line of the equations box as something to draw:
   *   fn        y as a function of x (y = 2x + 1, 2x + 3y = 6, xy = 1)
   *   vline     x = 3, 2x = 6
   *   implicit  anything else with x and y (x² + y² = 25)
   *   pts       a point or points typed here instead of in the points box
   * With < > ≤ ≥ the item also has op and the side to shade.
   */
  function readRelation(raw, E) {
    if (/^\s*([A-Za-z][A-Za-z0-9']*)?\s*\(\s*[-+−]?(\d|\.\d)/.test(raw)) {
      var P = parsePoints(raw);
      if (!P.error) return { kind: 'pts', items: P.items };
    }
    var dom = splitDomain(raw);
    if (dom.error) return dom;
    var body = tidyMath(dom.rest).replace(/^\s*[fgh]\s*\(\s*x\s*\)\s*=/i, 'y =');
    var rel = splitRelation(body), out;
    if (rel && rel.error) return rel;
    if (!rel) {
      var c = E.tryCompile(body, 'x');
      if (c.error) return { error: c.error };
      out = { kind: 'fn', fn: c.fn, bare: true };
    } else {
      if (!rel.lhs || !rel.rhs) return { error: 'Put something on both sides, like y = 2x + 1 or y > x^2.' };
      var ref = { v: 0 }, o = { var2: 'y', var2Ref: ref };
      var a = E.tryCompile(rel.lhs, 'x', o);
      if (a.error) return { error: a.error };
      var b = E.tryCompile(rel.rhs, 'x', o);
      if (b.error) return { error: b.error };
      if (!a.usesVar && !b.usesVar && !a.usesVar2 && !b.usesVar2) return { error: 'There is no x or y in this to draw.' };
      var fa = a.fn, fb = b.fn, F = function (x, y) { ref.v = y; return fa(x) - fb(x); };
      var want = rel.op === '=' ? 0 : rel.op.charAt(0) === '>' ? 1 : -1;
      if (!a.usesVar2 && !b.usesVar2) {
        var lin = affine(function (t) { return F(t, 0); });
        if (lin && lin.k === 0) return { error: 'There is no x or y in this to draw.' };
        out = lin ? { kind: 'vline', x: -lin.c / lin.k, right: want ? (want > 0) === (lin.k > 0) : null } : { kind: 'implicit', F: F };
      } else {
        var ky = linearInY(F);
        if (ky && (!want || ky !== 2)) {
          out = { kind: 'fn', fn: function (x) { var f0 = F(x, 0); return -f0 / (F(x, 1) - f0); }, above: want ? (want > 0) === (ky > 0) : null };
        } else out = { kind: 'implicit', F: F, want: want };
      }
      out.op = rel.op;
      out.strict = rel.op === '<' || rel.op === '>';
    }
    out.lim = dom.lim;
    out.shown = dom.rest;
    return out;
  }
  /** How a line reads in its label: ≤ and ≥ rather than <= and >=, and y = in front of a bare expression. */
  function eqLabel(raw, bare) {
    var t = String(raw).replace(/<=/g, '≤').replace(/>=/g, '≥');
    return bare ? 'y = ' + t : t;
  }
  /**
   * Lines, curves, regions and points, one per line: y = 2x + 1, y = x^2 − 4,
   * x = 3, 2x + 3y = 6, x^2 + y^2 = 25, y > 2x − 1, y = √x for 0 ≤ x ≤ 9, A(2, 3).
   */
  function parseEquations(text) {
    var E = root.FluxExpr, items = [], lines = String(text || '').split('\n');
    for (var li = 0; li < lines.length; li++) {
      var line = lines[li].trim();
      if (!line) continue;
      var where = 'Line ' + (li + 1) + ' of the equations (“' + line + '”): ';
      if (!E) return { error: where + 'the equation reader did not load. Refresh the page.', field: 'eqs' };
      var r = readRelation(line, E);
      if (r.error) return { error: where + r.error, field: 'eqs' };
      r.text = eqLabel(r.shown || line, r.bare);
      items.push(r);
    }
    return { items: items };
  }
  /**
   * Draw F(x, y) = 0 by marching squares: F is sampled on cells a few pixels
   * across, and wherever it changes sign along an edge the curve crosses
   * there. The crossings are joined cell to cell into whole lines, so a
   * dashed curve dashes evenly. A sign change across a pole (1/x) is not a
   * crossing: at a real one F is near zero there. want: 1 or −1 also fills
   * the cells where F is above or below zero.
   */
  function implicitParts(F, G, want) {
    var nx = Math.max(16, Math.ceil(G.W / 4)), ny = Math.max(16, Math.ceil(G.H / 4)), W1 = nx + 1, i, j;
    var xs = [], ys = [], val = new Float64Array(W1 * (ny + 1));
    for (i = 0; i <= nx; i++) xs.push(G.x0 + (G.x1 - G.x0) * i / nx);
    for (j = 0; j <= ny; j++) ys.push(G.y0 + (G.y1 - G.y0) * j / ny);
    function at(x, y) { var f; try { f = F(x, y); } catch (e) { f = NaN; } return isFinite(f) ? f : NaN; }
    for (j = 0; j <= ny; j++) for (i = 0; i <= nx; i++) val[j * W1 + i] = at(xs[i], ys[j]);
    var hits = {};
    function cross(key, xa, ya, fa, xb, yb, fb) {
      if (key in hits) return hits[key];
      var t = fa / (fa - fb);
      if (!(t >= 0 && t <= 1)) t = 0.5;
      var x = xa + (xb - xa) * t, y = ya + (yb - ya) * t, fc = at(x, y);
      var r = isFinite(fc) && Math.abs(fc) <= Math.max(Math.abs(fa), Math.abs(fb)) * 0.75 + 1e-12 ? [G.X(x), G.Y(y)] : null;
      hits[key] = r;
      return r;
    }
    var segs = [], fill = '';
    for (j = 0; j < ny; j++) {
      var run = -1;
      for (i = 0; i <= nx; i++) {
        var a = val[j * W1 + i], b = val[j * W1 + i + 1], c = val[(j + 1) * W1 + i + 1], d = val[(j + 1) * W1 + i];
        var ok = i < nx && a === a && b === b && c === c && d === d;
        var inside = ok && want && (want > 0 ? a + b + c + d > 0 : a + b + c + d < 0);
        if (inside && run < 0) run = i;
        if (!inside && run >= 0) {
          fill += 'M' + r2(G.X(xs[run])) + ' ' + r2(-G.Y(ys[j])) + 'H' + r2(G.X(xs[i])) + 'V' + r2(-G.Y(ys[j + 1])) + 'H' + r2(G.X(xs[run])) + 'Z';
          run = -1;
        }
        if (!ok) continue;
        var sa = a > 0, sb = b > 0, sc = c > 0, sd = d > 0, e = [];
        if (sa !== sb) e.push(['h' + i + ',' + j, cross('h' + i + ',' + j, xs[i], ys[j], a, xs[i + 1], ys[j], b)]);
        if (sb !== sc) e.push(['v' + (i + 1) + ',' + j, cross('v' + (i + 1) + ',' + j, xs[i + 1], ys[j], b, xs[i + 1], ys[j + 1], c)]);
        if (sd !== sc) e.push(['h' + i + ',' + (j + 1), cross('h' + i + ',' + (j + 1), xs[i], ys[j + 1], d, xs[i + 1], ys[j + 1], c)]);
        if (sa !== sd) e.push(['v' + i + ',' + j, cross('v' + i + ',' + j, xs[i], ys[j], a, xs[i], ys[j + 1], d)]);
        var pairs = e.length === 2 ? [[0, 1]] : e.length === 4 ? ((a + b + c + d > 0) === sa ? [[0, 1], [2, 3]] : [[0, 3], [1, 2]]) : [];
        pairs.forEach(function (p) {
          var u = e[p[0]], w = e[p[1]];
          if (u[1] && w[1]) segs.push([u[0], u[1], w[0], w[1]]);
        });
      }
    }
    // Join the pieces into lines.
    var adj = {}, used = new Uint8Array(segs.length), lines = [];
    segs.forEach(function (s, k) { (adj[s[0]] = adj[s[0]] || []).push(k); (adj[s[2]] = adj[s[2]] || []).push(k); });
    function follow(key, line, atEnd) {
      for (;;) {
        var list = adj[key] || [], nxt = -1;
        for (var q = 0; q < list.length; q++) if (!used[list[q]]) { nxt = list[q]; break; }
        if (nxt < 0) return;
        used[nxt] = 1;
        var s = segs[nxt], far = s[0] === key ? 2 : 0;
        if (atEnd) line.push(s[far + 1]); else line.unshift(s[far + 1]);
        key = s[far];
      }
    }
    segs.forEach(function (s, k) {
      if (used[k]) return;
      used[k] = 1;
      var line = [s[1], s[3]];
      follow(s[2], line, true);
      follow(s[0], line, false);
      lines.push(line);
    });
    return { lines: lines, fill: fill };
  }
  /** The region above (or below) a curve, as polygons closed along the top (or bottom) of the grid. */
  function shadeCurve(pic, fn, xa, xb, G, above, n, col) {
    var runs = [], cur = null, prev = null, H = G.H;
    for (var i = 0; i <= n; i++) {
      var x = xa + (xb - xa) * i / n, y;
      try { y = fn(x); } catch (e) { y = NaN; }
      var py = isFinite(y) ? G.Y(y) : NaN;
      if (!isFinite(py)) { cur = null; prev = null; continue; }
      if (prev != null && ((prev > H * 2 && py < -H) || (prev < -H && py > H * 2))) cur = null;
      if (!cur) { cur = []; runs.push(cur); }
      cur.push([G.X(x), clamp(py, 0, H)]);
      prev = py;
    }
    var edge = above ? H : 0;
    runs.forEach(function (r) {
      if (r.length < 2) return;
      pic.poly(r.concat([[r[r.length - 1][0], edge], [r[0][0], edge]]), { close: true, fill: col, color: 'none', opacity: 0.16 });
    });
  }
  function niceStep(raw) {
    var p = Math.pow(10, Math.floor(Math.log10(raw))), m = raw / p;
    return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 5 ? 5 : 10) * p;
  }
  /**
   * The grid's settings with x and y ranges that show every graph and point:
   * the y range is where the curves spend most of their time over the x
   * range, so y = x^2 + 20 or y = 100x fits without a pole stretching it.
   */
  function fitRange(spec) {
    var s = clean(spec);
    if (!s || s.kind !== 'grid') return s;
    var EQ = parseEquations(s.eqs), PT = parsePoints(s.pts);
    if (EQ.error || PT.error) return s;
    var x0 = num(s.xmin, -10), x1 = num(s.xmax, 10), xs = [], ys = [];
    if (!(x1 > x0)) { x0 = -10; x1 = 10; }
    var pts = [];
    PT.items.forEach(function (it) { pts = pts.concat(it.pts); });
    EQ.items.forEach(function (it) {
      if (it.kind === 'pts') it.items.forEach(function (p) { pts = pts.concat(p.pts); });
      if (it.kind === 'vline') xs.push(it.x);
    });
    pts.forEach(function (p) { xs.push(p.x); ys.push(p.y); });
    if (xs.length) { x0 = Math.min(x0, Math.min.apply(0, xs) - 1); x1 = Math.max(x1, Math.max.apply(0, xs) + 1); }
    var fy = [];
    EQ.items.forEach(function (it) {
      if (it.kind !== 'fn') return;
      var a = it.lim ? Math.max(x0, it.lim.lo) : x0, b = it.lim ? Math.min(x1, it.lim.hi) : x1;
      for (var i = 0; i <= 200; i++) { var y; try { y = it.fn(a + (b - a) * i / 200); } catch (e) { y = NaN; } if (isFinite(y)) fy.push(y); }
    });
    fy.sort(function (p, q) { return p - q; });
    if (fy.length) { ys.push(fy[Math.floor(fy.length * 0.04)]); ys.push(fy[Math.ceil(fy.length * 0.96) - 1]); }
    var y0 = ys.length ? Math.min.apply(0, ys) : -10, y1 = ys.length ? Math.max.apply(0, ys) : 10;
    if (y1 - y0 < 1e-9) { y0 -= 5; y1 += 5; }
    var span = y1 - y0, pad0 = span * 0.06, pad1 = span * 0.06;
    // Close enough to the x axis to show it: start from 0, with no gap below.
    if (y0 > 0 && y0 < span * 0.6) { y0 = 0; pad0 = 0; }
    if (y1 < 0 && -y1 < span * 0.6) { y1 = 0; pad1 = 0; }
    var ystep = niceStep((y1 - y0) / 14), xstep = niceStep((x1 - x0) / 16);
    s.ymin = Math.floor((y0 - pad0) / ystep) * ystep; s.ymax = Math.ceil((y1 + pad1) / ystep) * ystep;
    s.xmin = Math.floor(x0 / xstep) * xstep; s.xmax = Math.ceil(x1 / xstep) * xstep;
    s.xstep = xstep; s.ystep = ystep;
    return s;
  }
  /** Clip the segment p–q to the box [0, W] × [0, H] (Liang–Barsky); null when it misses. */
  function clipSeg(p, q, W, H) {
    var t0 = 0, t1 = 1, dx = q[0] - p[0], dy = q[1] - p[1];
    var P = [-dx, dx, -dy, dy], Q = [p[0], W - p[0], p[1], H - p[1]];
    for (var i = 0; i < 4; i++) {
      if (P[i] === 0) { if (Q[i] < 0) return null; continue; }
      var r = Q[i] / P[i];
      if (P[i] < 0) { if (r > t1) return null; if (r > t0) t0 = r; }
      else { if (r < t0) return null; if (r < t1) t1 = r; }
    }
    return [[p[0] + t0 * dx, p[1] + t0 * dy], [p[0] + t1 * dx, p[1] + t1 * dy]];
  }
  /**
   * A curve as pieces of polyline inside the box. It breaks where the
   * function is undefined and where it leaps across the whole box between
   * two samples (an asymptote, as in 1/x or tan x), instead of drawing a
   * vertical line there.
   */
  function sampleCurve(fn, x0, x1, X, Y, W, H, n) {
    var pieces = [], cur = null, prev = null, span = H;
    for (var i = 0; i <= n; i++) {
      var x = x0 + (x1 - x0) * i / n, y;
      try { y = fn(x); } catch (e) { y = NaN; }
      var p = isFinite(y) ? [X(x), Y(y)] : null;
      if (p && prev && !((prev[1] > H + span && p[1] < -span) || (prev[1] < -span && p[1] > H + span))) {
        var c = clipSeg(prev, p, W, H);
        if (c) {
          var last = cur && cur[cur.length - 1];
          if (last && Math.abs(last[0] - c[0][0]) < 1e-6 && Math.abs(last[1] - c[0][1]) < 1e-6) cur.push(c[1]);
          else { cur = [c[0], c[1]]; pieces.push(cur); }
        } else cur = null;
      } else cur = null;
      prev = p;
    }
    return pieces;
  }
  function gridLayout(s) {
    var x0 = num(s.xmin, NaN), x1 = num(s.xmax, NaN), y0 = num(s.ymin, NaN), y1 = num(s.ymax, NaN), dx = num(s.xstep, NaN), dy = num(s.ystep, NaN);
    var words = { xmin: 'smallest x', xmax: 'largest x', ymin: 'smallest y', ymax: 'largest y' };
    var bad = [['xmin', x0], ['xmax', x1], ['ymin', y0], ['ymax', y1]].filter(function (q) { return !isFinite(q[1]); })[0];
    if (bad) return { error: 'Type the ' + words[bad[0]] + '.', field: bad[0] };
    if (!(x1 > x0)) return { error: 'The largest x has to be bigger than the smallest: ' + fmt(x0, 4) + ' is not less than ' + fmt(x1, 4) + '.', field: 'xmax' };
    if (!(y1 > y0)) return { error: 'The largest y has to be bigger than the smallest: ' + fmt(y0, 4) + ' is not less than ' + fmt(y1, 4) + '.', field: 'ymax' };
    if (!(dx > 0)) return { error: 'The x step needs to be more than 0.', field: 'xstep' };
    if (!(dy > 0)) return { error: 'The y step needs to be more than 0.', field: 'ystep' };
    var nx = (x1 - x0) / dx, ny = (y1 - y0) / dy;
    if (nx > 200) return { error: 'That is ' + Math.round(nx) + ' squares across. Make the x step bigger or the range smaller: 200 at most.', field: 'xstep' };
    if (ny > 200) return { error: 'That is ' + Math.round(ny) + ' squares up. Make the y step bigger or the range smaller: 200 at most.', field: 'ystep' };
    var cell = clamp(Math.floor(640 / Math.max(nx, ny)), 10, 48);
    return { x0: x0, x1: x1, y0: y0, y1: y1, dx: dx, dy: dy, cell: cell, W: nx * cell, H: ny * cell,
      X: function (x) { return (x - x0) / dx * cell; }, Y: function (y) { return (y - y0) / dy * cell; } };
  }
  function buildGrid(s, ink) {
    var G = gridLayout(s);
    if (G.error) return G;
    var EQ = parseEquations(s.eqs);
    if (EQ.error) return EQ;
    var PT = parsePoints(s.pts);
    if (PT.error) return PT;
    // Points typed among the equations are points like any other.
    EQ.items.forEach(function (it) { if (it.kind === 'pts') PT.items = PT.items.concat(it.items); });
    EQ.items = EQ.items.filter(function (it) { return it.kind !== 'pts'; });
    for (var pi = 0; pi < PT.items.length; pi++) {
      var off = PT.items[pi].pts.filter(function (p) { return p.x < G.x0 - 1e-9 || p.x > G.x1 + 1e-9 || p.y < G.y0 - 1e-9 || p.y > G.y1 + 1e-9; })[0];
      if (off) return { error: 'The point ' + off.name + '(' + fmt(off.x, 4) + ', ' + fmt(off.y, 4) + ') is off the grid, which runs from x = ' + fmt(G.x0, 4) + ' to ' + fmt(G.x1, 4) + ' and y = ' + fmt(G.y0, 4) + ' to ' + fmt(G.y1, 4) + '.', field: 'pts' };
    }
    var X = G.X, Y = G.Y, W = G.W, H = G.H, pic = new Pic(ink, 2.2), cell = G.cell, k;
    var size = clamp(cell * 0.46, 12, 17);
    var kx0 = Math.ceil(G.x0 / G.dx - 1e-9), kx1 = Math.floor(G.x1 / G.dx + 1e-9), ky0 = Math.ceil(G.y0 / G.dy - 1e-9), ky1 = Math.floor(G.y1 / G.dy + 1e-9);
    if (s.lines) {
      var d = '';
      for (k = kx0; k <= kx1; k++) d += 'M' + r2(X(k * G.dx)) + ' 0V' + r2(-H);
      for (k = ky0; k <= ky1; k++) d += 'M0 ' + r2(-Y(k * G.dy)) + 'H' + r2(W);
      pic.path(d, [0, 0, W, H], { color: PAPER_LINE, w: 1 });
      pic.poly([[0, 0], [W, 0], [W, H], [0, H]], { close: true, color: PAPER_LINE, w: 1.4 });
    } else pic.ext(0, 0), pic.ext(W, H);
    var xAxis = s.axes && G.y0 <= 0 && G.y1 >= 0, yAxis = s.axes && G.x0 <= 0 && G.x1 >= 0;
    var ax = yAxis ? X(0) : 0, ay = xAxis ? Y(0) : 0, ext = s.arrows ? 22 : 0;
    function head(tip, dir) {
      var n = [-dir[1], dir[0]];
      pic.poly([tip, vadd(vsub(tip, vmul(dir, 13)), vmul(n, 6)), vsub(vsub(tip, vmul(dir, 13)), vmul(n, 6))], { close: true, fill: ink, w: 1 });
    }
    if (xAxis) {
      pic.line([-ext, ay], [W + ext, ay]);
      if (s.arrows) { head([W + ext, ay], [1, 0]); head([-ext, ay], [-1, 0]); }
      if (s.xname) pic.text([W + ext + 8, ay], s.xname, { size: size + 4, anchor: 'start' });
    }
    if (yAxis) {
      pic.line([ax, -ext], [ax, H + ext]);
      if (s.arrows) { head([ax, H + ext], [0, 1]); head([ax, -ext], [0, -1]); }
      if (s.yname) pic.text([ax, H + ext + 8 + size * 0.6], s.yname, { size: size + 4 });
    }
    if (s.nums) {
      var widest = Math.max(textWidth(fmt(G.x0, 4), size), textWidth(fmt(G.x1, 4), size));
      var ex = Math.max(1, Math.round(num(s.every, 0)) || Math.ceil((widest + 8) / cell));
      var ey = Math.max(1, Math.round(num(s.every, 0)) || Math.ceil((size + 6) / cell));
      var both = xAxis && yAxis;
      for (k = kx0; k <= kx1; k++) {
        if (k % ex) continue;
        var vx = k * G.dx;
        if (both && near(vx, 0)) continue;
        pic.text([X(vx), ay - 8 - size * 0.55], fmt(vx, 4), { size: size, halo: true });
      }
      for (k = ky0; k <= ky1; k++) {
        if (k % ey) continue;
        var vy = k * G.dy;
        if (both && near(vy, 0)) continue;
        pic.text([ax - 7, Y(vy)], fmt(vy, 4), { size: size, anchor: 'end', halo: true });
      }
      if (both) pic.text([ax - 7, ay - 8 - size * 0.55], '0', { size: size, anchor: 'end', halo: true });
    }
    if (s.title) pic.text([W / 2, H + (yAxis ? ext + 16 + size * 1.6 : 14) + 14], s.title, { size: 22, bold: true });
    // Lines, curves and regions. A < or > boundary is dashed, the way it is taught.
    var samples = Math.max(240, Math.ceil(W * 1.5)), offgrid = [];
    EQ.items.forEach(function (eq, i) {
      var col = s.mono ? ink : PALETTE[i % PALETTE.length], dash = eq.strict ? '10 7' : s.mono ? DASHES[i % DASHES.length] : '', lastPt = null;
      var shade = s.mono ? '#64748b' : col, lim = eq.lim;
      if (eq.kind === 'vline') {
        if (eq.x < G.x0 || eq.x > G.x1) { offgrid.push(eq.text); return; }
        if (eq.right != null) {
          var xa = eq.right ? X(eq.x) : 0, xb = eq.right ? W : X(eq.x);
          if (xb > xa) pic.poly([[xa, 0], [xb, 0], [xb, H], [xa, H]], { close: true, fill: shade, color: 'none', opacity: 0.16 });
        }
        pic.line([X(eq.x), 0], [X(eq.x), H], { color: col, w: 2.6, dash: dash });
        lastPt = [X(eq.x), H];
      } else if (eq.kind === 'implicit') {
        var F = lim ? function (x, y) { return x < lim.lo || x > lim.hi ? NaN : eq.F(x, y); } : eq.F;
        var parts = implicitParts(F, G, eq.want || 0);
        if (parts.fill) pic.path(parts.fill, [0, 0, W, H], { fill: shade, color: 'none', opacity: 0.16 });
        var longest = null;
        parts.lines.forEach(function (ln) {
          pic.poly(ln, { color: col, w: 2.6, dash: dash });
          if (!longest || ln.length > longest.length) longest = ln;
        });
        if (longest) lastPt = longest[longest.length - 1];
        else if (!parts.fill) offgrid.push(eq.text);
      } else {
        var a = lim ? Math.max(G.x0, lim.lo) : G.x0, b = lim ? Math.min(G.x1, lim.hi) : G.x1;
        if (!(b > a)) { offgrid.push(eq.text); return; }
        if (eq.above != null) shadeCurve(pic, eq.fn, a, b, G, eq.above, samples, shade);
        var pcs = sampleCurve(eq.fn, a, b, X, Y, W, H, samples);
        pcs.forEach(function (pc) {
          pic.poly(pc, { color: col, w: 2.6, dash: dash });
          lastPt = pc[pc.length - 1];
        });
        if (!pcs.length && eq.above == null) offgrid.push(eq.text);
        // Where a limit ends the line: a filled dot when that end is included, an open one when not.
        if (lim) [[lim.lo, lim.loIn], [lim.hi, lim.hiIn]].forEach(function (end) {
          if (!isFinite(end[0]) || end[0] < G.x0 || end[0] > G.x1) return;
          var y; try { y = eq.fn(end[0]); } catch (e) { y = NaN; }
          if (isFinite(y) && y >= G.y0 && y <= G.y1) pic.dot([X(end[0]), Y(y)], 5, { open: !end[1], color: col, w: 2.4 });
        });
      }
      if (s.eqlab && lastPt) {
        var box = textBox(eq.text, size + 1), lx = clamp(lastPt[0] - 4, box.w + 4, W - 2), ly = clamp(lastPt[1] + 4 + box.h / 2, box.h / 2 + 2, H - box.h / 2 - 2);
        pic.text([lx, ly], eq.text, { size: size + 1, anchor: 'end', color: col, halo: true });
      }
    });
    // Points and shapes.
    PT.items.forEach(function (it) {
      var P = it.pts.map(function (p) { return [X(p.x), Y(p.y)]; });
      if (it.kind === 'poly') pic.poly(P, { close: true, w: 2.6 });
      if (it.kind === 'path') pic.poly(P, { w: 2.6 });
      it.pts.forEach(function (p, j) {
        var at = P[j], label = p.name + (s.ptcoord ? '(' + fmt(p.x, 4) + ', ' + fmt(p.y, 4) + ')' : '');
        if (it.kind === 'pts' || p.name) pic.dot(at, it.kind === 'pts' ? 5 : 4, {});
        if (!label) return;
        var box = textBox(label, size + 2), right = at[0] + 8 + box.w < W + 6, up = at[1] + 8 + box.h < H + 6;
        var c = it.kind === 'poly' ? centroid(P) : null;
        if (c) { right = at[0] >= c[0]; up = at[1] >= c[1]; }
        pic.text([at[0] + (right ? 1 : -1) * (7 + box.w / 2), at[1] + (up ? 1 : -1) * (6 + box.h / 2)], label, { size: size + 2, halo: true });
      });
    });
    pic.info = { grid: { x0: G.x0, x1: G.x1, y0: G.y0, y1: G.y1, dx: G.dx, dy: G.dy, cell: cell, W: W, H: H }, offgrid: offgrid };
    return pic;
  }

  /* ── 3D solids ─────────────────────────────────────────────────────── */

  /*
   * Oblique (cabinet) drawing, the way textbooks draw boxes: width across,
   * height up, depth drawn up and to the right at half length. A face is in
   * view when it faces the reader; an edge is hidden only when both of its
   * faces are, and hidden edges are dashed.
   */
  var OBL_A = 35 * DEG, OBL_K = 0.5;
  var VIEW = [-OBL_K * Math.cos(OBL_A), -OBL_K * Math.sin(OBL_A), 1];
  function project(p) { return [p[0] + p[2] * OBL_K * Math.cos(OBL_A), p[1] + p[2] * OBL_K * Math.sin(OBL_A)]; }
  function sub3(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
  function cross3(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
  function dot3(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
  function centroid3(ps) { var c = [0, 0, 0]; ps.forEach(function (p) { c[0] += p[0]; c[1] += p[1]; c[2] += p[2]; }); return [c[0] / ps.length, c[1] / ps.length, c[2] / ps.length]; }
  /** Edges of a convex solid, each marked seen or hidden. */
  function solidEdges(V, F) {
    var cen = centroid3(V);
    var seen = F.map(function (f) {
      var a = V[f[0]], n = cross3(sub3(V[f[1]], a), sub3(V[f[2]], a));
      var fc = centroid3(f.map(function (i) { return V[i]; }));
      if (dot3(n, sub3(fc, cen)) < 0) n = [-n[0], -n[1], -n[2]];
      return dot3(n, VIEW) < 0;
    });
    var E = {}, order = [];
    F.forEach(function (f, fi) {
      for (var i = 0; i < f.length; i++) {
        var a = f[i], b = f[(i + 1) % f.length], key = Math.min(a, b) + '-' + Math.max(a, b);
        if (!E[key]) { E[key] = { a: Math.min(a, b), b: Math.max(a, b), seen: false }; order.push(key); }
        if (seen[fi]) E[key].seen = true;
      }
    });
    return order.map(function (k) { return E[k]; });
  }
  var SOLIDS = {
    cuboid: function (d) {
      var V = [];
      for (var i = 0; i < 8; i++) V.push([i & 1 ? d.l : 0, i & 2 ? d.h : 0, i & 4 ? d.w : 0]);
      return { V: V, F: [[0, 2, 6, 4], [1, 3, 7, 5], [0, 1, 5, 4], [2, 3, 7, 6], [0, 1, 3, 2], [4, 5, 7, 6]] };
    },
    triprism: function (d) {
      var ax = d.tri === 'right' ? 0 : d.w / 2;
      var f = [[0, 0, 0], [d.w, 0, 0], [ax, d.h, 0]], V = f.concat(f.map(function (p) { return [p[0], p[1], d.l]; }));
      return { V: V, F: [[0, 1, 2], [3, 4, 5], [0, 1, 4, 3], [1, 2, 5, 4], [2, 0, 3, 5]] };
    },
    pyramid: function (d) {
      return { V: [[0, 0, 0], [d.l, 0, 0], [d.l, 0, d.w], [0, 0, d.w], [d.l / 2, d.h, d.w / 2]], F: [[0, 1, 2, 3], [0, 1, 4], [1, 2, 4], [2, 3, 4], [3, 0, 4]] };
    },
  };
  function solidDims(s) {
    var shape = s.shape, l = num(s.l, NaN), w = num(s.w, NaN), h = num(s.h, NaN), r = num(s.r, NaN), e;
    var need = {
      cube: [['l', l, 'The edge']], cuboid: [['l', l, 'The length'], ['w', w, 'The width'], ['h', h, 'The height']],
      triprism: [['w', w, 'The base of the triangle'], ['h', h, 'The height of the triangle'], ['l', l, 'The length']],
      pyramid: [['l', l, 'The length of the base'], ['w', w, 'The width of the base'], ['h', h, 'The height']],
      cylinder: [['r', r, 'The radius'], ['h', h, 'The height']], cone: [['r', r, 'The radius'], ['h', h, 'The height']],
      sphere: [['r', r, 'The radius']], hemi: [['r', r, 'The radius']],
    }[shape];
    if (!need) return { error: 'Pick a solid.', field: 'shape' };
    for (var i = 0; i < need.length; i++) if ((e = positive(need[i][1], need[i][0], need[i][2]))) return e;
    if (shape === 'cube') { w = h = l; }
    return { l: l, w: w, h: h, r: r, tri: s.tri };
  }
  function awayLabel(pic, p, q, c, text, size) {
    if (!text) return null;
    var u = vunit(vsub(q, p)), n = [-u[1], u[0]];
    if (vdot(n, vsub(mid(p, q), c)) < 0) n = vmul(n, -1);
    return sideLabel(pic, p, q, n, text, size);
  }
  function buildSolid(s, ink) {
    var d = solidDims(s);
    if (d.error) return d;
    var pic = new Pic(ink), u = unitText(s.u), dp = dpOf(s), size = SIZE, hide = s.hid === 'hide', thin = pic.lw * 0.7, shape = s.shape;
    var lab = function (key, v, on) { var a = fmt(v, 4) + u; pic.auto[key] = a; return pick(s[key], a, on); };
    if (SOLIDS[shape === 'cube' ? 'cuboid' : shape]) {
      var geo = SOLIDS[shape === 'cube' ? 'cuboid' : shape](d);
      var P0 = geo.V.map(project), f = fit(P0, 360), P = f.pts, k = f.k, C = centroid(P);
      var edges = solidEdges(geo.V, geo.F);
      if (!hide) edges.forEach(function (e) { if (!e.seen) pic.line(P[e.a], P[e.b], { dash: true, w: thin }); });
      edges.forEach(function (e) { if (e.seen) pic.line(P[e.a], P[e.b]); });
      var PV = function (p) { var q = project(p); return [q[0] * k, q[1] * k]; };
      if (shape === 'cube') awayLabel(pic, P[0], P[1], C, lab('sL', d.l, s.giv), size);
      if (shape === 'cuboid') {
        awayLabel(pic, P[0], P[1], C, lab('sL', d.l, s.giv), size);
        awayLabel(pic, P[0], P[2], C, lab('sH', d.h, s.giv), size);
        awayLabel(pic, P[1], P[5], C, lab('sW', d.w, s.giv), size);
      }
      if (shape === 'triprism') {
        awayLabel(pic, P[0], P[1], C, lab('sW', d.w, s.giv), size);
        awayLabel(pic, P[1], P[4], C, lab('sL', d.l, s.giv), size);
        var th = lab('sH', d.h, s.giv);
        if (d.tri === 'right') awayLabel(pic, P[0], P[2], C, th, size);
        else heightLine(pic, P[2], P[0], P[1], th, size);
      }
      if (shape === 'pyramid') {
        awayLabel(pic, P[0], P[1], C, lab('sL', d.l, s.giv), size);
        awayLabel(pic, P[1], P[2], C, lab('sW', d.w, s.giv), size);
        var apex = P[4], base = PV([d.l / 2, 0, d.w / 2]);
        pic.line(apex, base, { dash: true, w: thin * 0.85 });
        rightBox(pic, base, [1, 0], [0, 1], 11);
        var hText = lab('sH', d.h, s.giv);
        if (hText) pic.text(vadd(vadd(apex, vmul(vsub(base, apex), 0.62)), [10 + reach([1, 0], textBox(hText, size)), 0]), hText, { size: size, halo: true });
        if (s.slant) {
          var fm = PV([d.l / 2, 0, 0]), sl = fmt(Math.hypot(d.h, d.w / 2), dp) + u;
          pic.auto.sS = sl;
          pic.line(apex, fm, { dash: true, w: thin * 0.85 });
          var ts = pick(s.sS, sl, true);
          if (ts) pic.text(vsub(vadd(apex, vmul(vsub(fm, apex), 0.62)), [12 + reach([1, 0], textBox(ts, size)), 0]), ts, { size: size, halo: true });
        }
      }
      return pic;
    }
    var R, Hh, ry;
    if (shape === 'cylinder') {
      var sc = 340 / Math.max(2 * d.r, d.h + 0.7 * d.r);
      R = d.r * sc; Hh = d.h * sc; ry = R * 0.34;
      if (!hide) pic.ellArc([0, 0], R, ry, 0, Math.PI, { dash: true, w: thin });
      pic.ellArc([0, 0], R, ry, Math.PI, 2 * Math.PI);
      pic.ellArc([0, Hh], R, ry, 0, 2 * Math.PI);
      pic.line([-R, 0], [-R, Hh]); pic.line([R, 0], [R, Hh]);
      pic.dot([0, Hh], 3.5, {});
      pic.line([0, Hh], [R, Hh], { w: thin });
      var tr = lab('sR', d.r, s.giv);
      if (tr) pic.text([R / 2, Hh + 8 + size * 0.6], tr, { size: size, halo: true });
      var thc = lab('sH', d.h, s.giv);
      if (thc) pic.text([R + 10 + textWidth(thc, size) / 2, Hh / 2], thc, { size: size });
      return pic;
    }
    if (shape === 'cone') {
      var sk = 340 / Math.max(2 * d.r, d.h + 0.35 * d.r);
      R = d.r * sk; Hh = d.h * sk; ry = R * 0.34;
      var apexC = [0, Hh];
      if (Hh > ry * 1.05) {
        var yt = ry * ry / Hh, xt = R * Math.sqrt(1 - (yt / ry) * (yt / ry)), t0 = Math.atan2(yt / ry, xt / R);
        if (!hide) pic.ellArc([0, 0], R, ry, t0, Math.PI - t0, { dash: true, w: thin });
        pic.ellArc([0, 0], R, ry, Math.PI - t0, 2 * Math.PI + t0);
        pic.line(apexC, [-xt, yt]); pic.line(apexC, [xt, yt]);
      } else {
        pic.ellArc([0, 0], R, ry, 0, 2 * Math.PI);
        pic.line(apexC, [-R, 0]); pic.line(apexC, [R, 0]);
      }
      pic.line(apexC, [0, 0], { dash: true, w: thin * 0.85 });
      pic.line([0, 0], [R, 0], { dash: true, w: thin * 0.85 });
      pic.dot([0, 0], 3, {});
      rightBox(pic, [0, 0], [1, 0], [0, 1], 11);
      var th2 = lab('sH', d.h, s.giv);
      if (th2) pic.text([-10 - textWidth(th2, size) / 2, Hh / 2], th2, { size: size, halo: true });
      var tr2 = lab('sR', d.r, s.giv);
      if (tr2) pic.text([R / 2, -8 - size * 0.6], tr2, { size: size, halo: true });
      if (s.slant) {
        var sl2 = fmt(Math.hypot(d.r, d.h), dp) + u;
        pic.auto.sS = sl2;
        var ts2 = pick(s.sS, sl2, true);
        if (ts2) awayLabel(pic, apexC, [R, 0], [0, Hh / 3], ts2, size);
      }
      return pic;
    }
    // Sphere and hemisphere.
    R = 170; ry = R * 0.32;
    if (shape === 'sphere') pic.circle([0, 0], R);
    else pic.arc([0, 0], R, 0, Math.PI);
    if (!hide) pic.ellArc([0, 0], R, ry, 0, Math.PI, { dash: true, w: thin });
    pic.ellArc([0, 0], R, ry, Math.PI, 2 * Math.PI);
    pic.dot([0, 0], 3.5, {});
    pic.line([0, 0], [R, 0], { w: thin, dash: shape === 'hemi' && !hide ? true : undefined });
    var tr3 = lab('sR', d.r, s.giv);
    if (tr3) pic.text([R / 2, 8 + size * 0.6], tr3, { size: size, halo: true });
    return pic;
  }

  /* ── Vectors ───────────────────────────────────────────────────────── */

  /*
   * Directions are angles from the +x axis, anticlockwise, from 0° up to
   * (not including) 360°. A bearing is measured clockwise from north and
   * written with three figures (053°). Compass form names the nearer of
   * north or south first: N 53.1° E is 53.1° round from north towards east.
   */
  function fromPolar(mag, deg) {
    var x = mag * Math.cos(deg * DEG), y = mag * Math.sin(deg * DEG), tiny = 1e-12 * Math.abs(mag);
    return { x: Math.abs(x) < tiny ? 0 : x, y: Math.abs(y) < tiny ? 0 : y };
  }
  function magnitude(v) { return Math.hypot(v.x, v.y); }
  function direction(v) {
    if (!v.x && !v.y) return 0;
    return norm360(Math.atan2(v.y, v.x) / DEG);
  }
  function toBearing(deg) { return norm360(90 - deg); }
  function fromBearing(b) { return norm360(90 - b); }
  function fmtBearing(b, dp) {
    dp = dp || 0;
    var v = round(norm360(b), dp);
    if (v >= 360) v -= 360;
    var s = v.toFixed(dp), i = s.indexOf('.'), whole = i < 0 ? s : s.slice(0, i);
    while (whole.length < 3) whole = '0' + whole;
    return whole + (i < 0 ? '' : s.slice(i)) + '°';
  }
  function compass(deg, dp) {
    dp = dp || 0;
    var a = round(norm360(deg), dp);
    if (a >= 360) a -= 360;
    var due = { 0: 'due E', 90: 'due N', 180: 'due W', 270: 'due S' }[a];
    if (due) return due;
    if (a < 90) return 'N ' + fixed(90 - a, dp) + '° E';
    if (a < 180) return 'N ' + fixed(a - 90, dp) + '° W';
    if (a < 270) return 'S ' + fixed(270 - a, dp) + '° W';
    return 'S ' + fixed(a - 270, dp) + '° E';
  }
  function dirText(deg, how, dp) {
    if (how === 'bearing') return 'bearing ' + fmtBearing(toBearing(deg), dp);
    if (how === 'compass') return compass(deg, dp);
    return fixed(norm360(deg), dp) + '°';
  }
  function vsum(list) { return list.reduce(function (s, v) { return { x: s.x + v.x, y: s.y + v.y }; }, { x: 0, y: 0 }); }
  function vdiff(a, b) { return { x: a.x - b.x, y: a.y - b.y }; }
  function vtimes(a, k) { return { x: a.x * k, y: a.y * k }; }
  /** Percent error of a measurement against the worked-out value. */
  function pctError(measured, actual) {
    if (!isFinite(measured) || !isFinite(actual) || actual === 0) return NaN;
    return Math.abs(measured - actual) / Math.abs(actual) * 100;
  }
  /** How far apart two directions are, the short way round (0° to 180°). */
  function angleGap(a, b) { var d = Math.abs(norm360(a) - norm360(b)); return d > 180 ? 360 - d : d; }
  /**
   * The lab check: a measured resultant (length, and direction in the way the
   * vector shows it: an angle from +x, or a bearing) against the worked-out one.
   */
  function labCheck(meas, calc, how) {
    var M = magnitude(calc), deg = direction(calc), ref = how === 'bearing' || how === 'compass' ? toBearing(deg) : deg;
    var gap = isFinite(meas.dir) ? angleGap(meas.dir, ref) : NaN;
    return { mag: M, dir: ref, magErr: pctError(meas.mag, M), dirGap: gap, dirErr: isFinite(gap) && ref ? gap / ref * 100 : NaN };
  }
  /** The vector an item on the page stands for, in its own units (y up). */
  function vectorValue(it) {
    var sx = it.sx || 40, sy = it.sy || sx;
    return { x: (it.x2 - it.x1) / sx, y: (it.y1 - it.y2) / sy };
  }
  /** "A = 5.0 N at 36.9°", from the item's settings. */
  function vectorText(it) {
    var v = vectorValue(it), p = it.prec == null ? 1 : it.prec, unit = it.unit ? ' ' + it.unit : '';
    var mag = it.showMag === false ? '' : fixed(magnitude(v), p) + unit, dir = it.showDir ? dirText(direction(v), it.dirFmt, p) : '';
    var info = mag && dir ? mag + (it.dirFmt === 'bearing' || it.dirFmt === 'compass' ? ', ' : ' at ') + dir : mag || dir;
    var name = String(it.label || '').trim();
    return name ? (info ? name + (mag ? ' = ' : ' ') + info : name) : info;
  }
  /**
   * A vector item drawn in page coordinates (y down): shaft, a filled
   * arrowhead, the label, and, when asked, its x and y components as dashed
   * legs. Returns the markup, its box, and the lines its ink follows (for
   * the eraser).
   */
  function vectorDraw(it) {
    var c = it.color || INK, w = it.width || 3, size = it.size || 24;
    var t = [it.x1, it.y1], h = [it.x2, it.y2], d = vsub(h, t), L = vlen(d);
    var pic = new Pic(c, w), M = function (p) { return [p[0], -p[1]]; };
    if (L < 0.5) {
      pic.dot(M(t), Math.max(2, w), {});
      return { svg: pic.parts.join(''), box: { x: it.x1 - w, y: it.y1 - w, w: w * 2, h: w * 2 }, ink: [[t]] };
    }
    var u = vmul(d, 1 / L), n = [-u[1], u[0]];
    var hl = Math.min(L * 0.5, 12 + w * 3.4), hw = hl * 0.42, base = vsub(h, vmul(u, hl));
    var v = vectorValue(it), p = it.prec == null ? 1 : it.prec, unit = it.unit ? ' ' + it.unit : '', name = String(it.label || '').trim();
    var K = [h[0], t[1]];
    if (it.comps) {
      var thin = Math.max(1.5, w * 0.6), cs = size * 0.82;
      if (Math.abs(v.x) > 1e-9) {
        pic.line(M(t), M(K), { w: thin, dash: r2(thin * 4) + ' ' + r2(thin * 3) });
        var tx = (name ? name + '_x = ' : 'x: ') + fixed(v.x, p) + unit, bx = textBox(tx, cs), below = h[1] < t[1] ? 1 : -1;
        pic.text(M([(t[0] + K[0]) / 2, t[1] + below * (7 + bx.h / 2)]), tx, { size: cs, halo: true });
      }
      if (Math.abs(v.y) > 1e-9) {
        pic.line(M(K), M(h), { w: thin, dash: r2(thin * 4) + ' ' + r2(thin * 3) });
        var ty = (name ? name + '_y = ' : 'y: ') + fixed(v.y, p) + unit, side = h[0] >= t[0] ? 1 : -1;
        pic.text(M([K[0] + side * 9, (K[1] + h[1]) / 2]), ty, { size: cs, anchor: side > 0 ? 'start' : 'end', halo: true });
      }
    }
    var shaftEnd = vadd(base, vmul(u, hl * 0.35));
    pic.line(M(t), M(shaftEnd), { w: w, dash: it.dash ? r2(w * 3.2) + ' ' + r2(w * 2.4) : '' });
    var tri = [h, vadd(base, vmul(n, hw)), vsub(base, vmul(n, hw))];
    pic.poly(tri.map(M), { close: true, fill: c, w: Math.max(1, w * 0.5) });
    var label = vectorText(it);
    if (label) {
      var box = textBox(label, size), nA = [u[1], -u[0]], nB = [-u[1], u[0]], m = mid(t, h), side2;
      if (it.comps) side2 = vdot(vsub(K, m), nA) > 0 ? nB : nA;
      else side2 = nA[1] < -1e-9 ? nA : nB[1] < -1e-9 ? nB : (nA[0] < 0 ? nA : nB);
      pic.text(M(vadd(m, vmul(side2, 8 + w / 2 + reach(side2, box)))), label, { size: size, halo: true });
    }
    var b = { x: pic.x0 - w / 2, y: pic.y0 - w / 2, w: pic.x1 - pic.x0 + w, h: pic.y1 - pic.y0 + w };
    return { svg: pic.parts.join(''), box: b, ink: [[t, base], [tri[0], tri[1], tri[2], tri[0]]] };
  }

  /* ── Settings, building, describing, sharing ───────────────────────── */

  var KINDS = [
    ['grid', 'Coordinate grid'], ['numline', 'Number line'], ['triangle', 'Triangle'], ['rect', 'Rectangle'],
    ['para', 'Parallelogram'], ['trap', 'Trapezoid'], ['kite', 'Kite'], ['reg', 'Regular polygon'],
    ['circle', 'Circle'], ['angle', 'Angles'], ['parallel', 'Parallel lines'], ['solid', '3D solid'],
  ];
  var DEFAULTS = {
    grid: { kind: 'grid', xmin: -10, xmax: 10, ymin: -10, ymax: 10, xstep: 1, ystep: 1, every: 0, axes: true, arrows: true, nums: true, lines: true, xname: 'x', yname: 'y', title: '', eqs: '', pts: '', eqlab: true, ptcoord: false, mono: false },
    numline: { kind: 'numline', from: -5, to: 5, step: 1, every: 1, minor: 0, nums: true, arrows: true, frac: false, marks: '' },
    triangle: { kind: 'triangle', method: 'sss', a: 5, b: 6, c: 7, A: 50, B: 60, C: 70, u: 'cm', dp: 1, giv: true, calc: false, sAB: '', sBC: '', sCA: '', gA: '', gB: '', gC: '', names: true, nA: 'A', nB: 'B', nC: 'C', box: true, ticks: true, arcs: false, alt: 'none', hLab: '', rot: 0, flip: false },
    rect: { kind: 'rect', w: 8, h: 5, u: 'cm', dp: 1, giv: true, calc: false, all4: false, sW: '', sH: '', diag: false, sD: '', boxes: true, ticks: true, names: false, nA: 'A', nB: 'B', nC: 'C', nD: 'D', rot: 0 },
    para: { kind: 'para', b: 8, s: 5, ang: 65, u: 'cm', dp: 1, giv: true, sB: '', sS: '', gA: '', height: false, sH: '', arrows: true, ticks: false, names: false, nA: 'A', nB: 'B', nC: 'C', nD: 'D', rot: 0, flip: false },
    trap: { kind: 'trap', type: 'iso', b1: 10, b2: 6, h: 5, off: 2, u: 'cm', dp: 1, giv: true, calc: false, sB1: '', sB2: '', sH: '', sL: '', sR: '', height: true, arrows: true, ticks: true, boxes: true, names: false, nA: 'A', nB: 'B', nC: 'C', nD: 'D', rot: 0, flip: false },
    kite: { kind: 'kite', wd: 6, p: 3, q: 7, u: 'cm', dp: 1, giv: true, calc: false, sT: '', sB: '', diag: true, dW: '', dP: '', dQ: '', ticks: true, box: true, names: false, nA: 'A', nB: 'B', nC: 'C', nD: 'D', rot: 0 },
    reg: { kind: 'reg', n: 6, s: 4, u: 'cm', dp: 1, giv: true, calc: false, sS: '', gI: '', ticks: true, centre: false, apo: false, sA: '', rad: false, sR: '', names: false, rot: 0 },
    circle: { kind: 'circle', r: 5, u: 'cm', dp: 1, giv: true, calc: false, rad: true, diam: false, chord: false, tangent: false, sector: 0, centre: true, names: true, nO: 'O', nA: 'A', nB: 'B', sR: '', sD: '', sC: '', gS: '', rot: 0 },
    angle: { kind: 'angle', mode: 'single', parts: 2, a1: 40, a2: 60, a3: 50, giv: true, calc: false, l1: '', l2: '', l3: '', l4: '', names: false, nA: 'A', nB: 'B', nC: 'C', rot: 0 },
    parallel: { kind: 'parallel', ang: 60, mode: 'numbers', c1: '', c2: '', c3: '', c4: '', c5: '', c6: '', c7: '', c8: '', arcs: false, arrows: true, names: true, nL: 'l', nM: 'm', nT: 't', rot: 0 },
    solid: { kind: 'solid', shape: 'cuboid', l: 6, w: 4, h: 3, r: 3, tri: 'iso', u: 'cm', dp: 1, giv: true, sL: '', sW: '', sH: '', sR: '', slant: false, sS: '', hid: 'dash' },
  };
  var BUILDERS = { grid: buildGrid, numline: buildNumline, triangle: buildTriangle, rect: buildRect, para: buildPara, trap: buildTrap, kite: buildKite, reg: buildReg, circle: buildCircle, angle: buildAngle, parallel: buildParallel, solid: buildSolid };

  function defaults(kind) { var d = DEFAULTS[kind]; return d ? JSON.parse(JSON.stringify(d)) : null; }
  /** Fill in whatever is missing or of the wrong type from the defaults; drop what does not belong. */
  function clean(spec) {
    if (!spec || !DEFAULTS[spec.kind]) return null;
    var d = DEFAULTS[spec.kind], s = {};
    Object.keys(d).forEach(function (k) {
      var v = spec[k], t = typeof d[k];
      if (t === 'number') s[k] = typeof v === 'number' ? v : (v == null || v === '' ? d[k] : num(v, NaN));
      else if (t === 'boolean') s[k] = typeof v === 'boolean' ? v : v == null ? d[k] : v === 1 || v === '1' || v === 'true';
      else s[k] = v == null ? d[k] : String(v).slice(0, 2000);
    });
    return s;
  }
  /**
   * Build a figure: { svg, vb, w, h, auto, info } with the markup in the
   * viewBox vb, or { error, field } with the problem in plain words.
   */
  function build(spec, opt) {
    opt = opt || {};
    var s = clean(spec);
    if (!s) return { error: 'That is not a figure I know how to draw.' };
    var r;
    try { r = BUILDERS[s.kind](s, opt.ink || INK); }
    catch (e) { return { error: 'That figure could not be drawn (' + (e && e.message ? e.message : e) + ').' }; }
    if (!r || r.error) return r || { error: 'That figure could not be drawn.' };
    var o = r.out(opt.pad == null ? 16 : opt.pad);
    o.auto = r.auto; o.info = r.info; o.facts = r.facts || null;
    return o;
  }
  /** A short description, for the preview's screen-reader text and a page title. */
  function describe(spec) {
    var s = clean(spec);
    if (!s) return 'Maths figure';
    var u = unitText(s.u);
    switch (s.kind) {
      case 'grid': {
        var e = String(s.eqs).split('\n').filter(function (l) { return l.trim(); }).length, p = String(s.pts).split('\n').filter(function (l) { return l.trim(); }).length;
        return (s.axes ? 'Coordinate grid' : 'Graph paper') + ', x from ' + fmt(s.xmin) + ' to ' + fmt(s.xmax) + ', y from ' + fmt(s.ymin) + ' to ' + fmt(s.ymax)
          + (e ? ', ' + e + ' graph' + (e > 1 ? 's' : '') : '') + (p ? ', ' + p + ' point line' + (p > 1 ? 's' : '') : '');
      }
      case 'numline': return 'Number line from ' + fmt(s.from) + ' to ' + fmt(s.to);
      case 'triangle': {
        var t = solveTriangle(s);
        if (t.error) return 'Triangle';
        return (t.method === 'aaa' ? 'Triangle with angles ' + andList([fmt(t.A, 1), fmt(t.B, 1), fmt(t.C, 1)]) + '°'
          : 'Triangle with sides ' + andList([fmt(t.c, 2), fmt(t.a, 2), fmt(t.b, 2)]) + u) + (near(t.C, 90) || near(t.A, 90) || near(t.B, 90) ? ' (right-angled)' : '');
      }
      case 'rect': return (near(s.w, s.h) ? 'Square ' : 'Rectangle ') + fmt(s.w) + u + ' by ' + fmt(s.h) + u;
      case 'para': return 'Parallelogram, base ' + fmt(s.b) + u + ', side ' + fmt(s.s) + u + ', angle ' + fmt(s.ang) + '°';
      case 'trap': return 'Trapezoid with parallel sides ' + fmt(s.b1) + u + ' and ' + fmt(s.b2) + u + ', height ' + fmt(s.h) + u;
      case 'kite': return 'Kite, ' + fmt(s.wd) + u + ' across';
      case 'reg': return 'Regular ' + (POLY_NAMES[Math.round(s.n)] || 'polygon') + ' with sides of ' + fmt(s.s) + u;
      case 'circle': return 'Circle, radius ' + fmt(s.r) + u + (s.sector > 0 ? ', with a sector of ' + fmt(s.sector) + '°' : '');
      case 'angle': {
        var P = angleParts(s);
        if (P.error) return 'Angles';
        return { single: 'An angle of ' + fmt(P.vals[0]) + '°', vertical: 'Two lines crossing at ' + fmt(P.vals[0]) + '°' }[s.mode]
          || ('Angles ' + andList(P.vals.map(function (v) { return fmt(v, 1) + '°'; })) + ' ' + { line: 'on a straight line', right: 'in a right angle', point: 'around a point' }[s.mode]);
      }
      case 'parallel': return 'Parallel lines cut by a transversal at ' + fmt(s.ang) + '°';
      case 'solid': {
        var nm = { cube: 'Cube', cuboid: 'Cuboid', triprism: 'Triangular prism', pyramid: 'Pyramid', cylinder: 'Cylinder', cone: 'Cone', sphere: 'Sphere', hemi: 'Hemisphere' }[s.shape] || 'Solid';
        var dims = { cube: ['edge', s.l], cuboid: ['length', s.l, 'width', s.w, 'height', s.h], triprism: ['base', s.w, 'height', s.h, 'length', s.l], pyramid: ['base', s.l, 'by', s.w, 'height', s.h], cylinder: ['radius', s.r, 'height', s.h], cone: ['radius', s.r, 'height', s.h], sphere: ['radius', s.r], hemi: ['radius', s.r] }[s.shape] || [];
        var bits = [];
        for (var i = 0; i < dims.length; i += 2) bits.push(dims[i] + ' ' + fmt(dims[i + 1]) + u);
        return nm + (bits.length ? ', ' + bits.join(', ') : '');
      }
    }
    return 'Maths figure';
  }
  /** Settings into a short link: only what differs from the defaults. */
  function encode(spec) {
    var s = clean(spec);
    if (!s) return '';
    var d = DEFAULTS[s.kind], parts = [];
    Object.keys(d).forEach(function (k) {
      if (k === 'kind' || s[k] === d[k]) return;
      var v = s[k];
      if (typeof v === 'number' && !isFinite(v)) return;
      parts.push(k + '=' + encodeURIComponent(typeof v === 'boolean' ? (v ? 1 : 0) : v));
    });
    return s.kind + (parts.length ? '?' + parts.join('&') : '');
  }
  function decode(str) {
    var m = /^([a-z]+)(?:\?(.*))?$/.exec(String(str || '').trim());
    if (!m || !DEFAULTS[m[1]]) return null;
    var s = defaults(m[1]);
    (m[2] || '').split('&').forEach(function (kv) {
      var i = kv.indexOf('=');
      if (i < 1) return;
      var k = kv.slice(0, i), v;
      try { v = decodeURIComponent(kv.slice(i + 1).replace(/\+/g, ' ')); } catch (e) { return; }
      if (k === 'kind' || !Object.prototype.hasOwnProperty.call(s, k)) return;
      var t = typeof s[k];
      if (t === 'number') { var n = num(v, NaN); if (isFinite(n)) s[k] = n; }
      else if (t === 'boolean') s[k] = v === '1' || v === 'true';
      else s[k] = String(v).slice(0, 2000);
    });
    return s;
  }

  /* ── A figure from a sentence ──────────────────────────────────────── */

  var NUM = '-?(?:\\d+\\.?\\d*|\\.\\d+)';
  var POLY_WORDS = { pentagon: 5, hexagon: 6, heptagon: 7, septagon: 7, octagon: 8, nonagon: 9, decagon: 10, hendecagon: 11, dodecagon: 12 };
  var SOLID_WORDS = [['hemisphere', 'hemi'], ['sphere', 'sphere'], ['ball', 'sphere'], ['cylinder', 'cylinder'], ['cone', 'cone'], ['pyramid', 'pyramid'],
    ['triangular prism', 'triprism'], ['cuboid', 'cuboid'], ['rectangular prism', 'cuboid'], ['box', 'cuboid'], ['cube', 'cube']];
  var EXAMPLES = 'Try “right triangle 3 4 5”, “y = x^2 − 4”, “cylinder r 3 h 8”, “circle r 5 sector 60” or “number line x > 2”.';

  /**
   * Turn what a student types — “right triangle 3 4 5”, “rectangle 8 by 5”,
   * “hexagon side 4”, “cylinder r 3 h 8”, “y = x^2 − 4”, “number line
   * −5 to 5, x > 2” — into a figure's settings: { spec, said } or { error }.
   */
  function fromText(text) {
    var raw = String(text == null ? '' : text).trim();
    if (!raw) return { error: 'Type what you need. ' + EXAMPLES };
    var t = ' ' + raw.toLowerCase().replace(/[−–—]/g, '-').replace(/,(?=\S)/g, ', ') + ' ';
    var has = function (re) { return re.test(t); };
    function named(words) {
      var m = new RegExp('(?:^|[^a-z])(?:' + words + ')\\s*(?:=|:|of|is)?\\s*(' + NUM + ')').exec(t);
      return m ? parseFloat(m[1]) : NaN;
    }
    var unitM = new RegExp(NUM + '\\s*(mm|cm|km|m|in|ft|yd)\\b').exec(t);
    var unit = unitM ? unitM[1] : null;
    // Plain numbers, and angles (a number with °, deg or degrees after it).
    var nums = [], angs = [], re = new RegExp('(' + NUM + ')\\s*(°|deg(?:rees?)?\\b)?', 'g'), m;
    while ((m = re.exec(t))) {
      var before = t[m.index - 1] || ' ';
      if (/[a-z^_(]/.test(before)) continue;   // x^2, F_1, A(2, 3)
      (m[2] ? angs : nums).push(parseFloat(m[1]));
    }
    function spec(kind, extra) {
      var s = defaults(kind);
      Object.keys(extra).forEach(function (k) { if (extra[k] !== undefined && !(typeof extra[k] === 'number' && !isFinite(extra[k]))) s[k] = extra[k]; });
      if (unit && 'u' in s) s.u = unit;
      return s;
    }
    function done(s) {
      var r = build(s);
      if (r.error) return { error: r.error, spec: s };
      return { spec: s, said: describe(s) };
    }
    var isEq = /[a-z]\s*\(\s*x\s*\)\s*=|\by\s*(=|<|>|≤|≥)|(=|<|>|≤|≥)\s*y\b/.test(t);

    // Number lines.
    if (has(/number\s*line/)) {
      var rng = new RegExp('(' + NUM + ')\\s*(?:to|until|\\.\\.)\\s*(' + NUM + ')').exec(t);
      var marks = [], ineq = new RegExp('(?:' + NUM + '\\s*(?:<=|>=|<|>|≤|≥)\\s*)?x\\s*(?:<=|>=|<|>|≤|≥)\\s*' + NUM + '|' + NUM + '\\s*(?:<=|>=|<|>|≤|≥)\\s*x', 'g'), q;
      while ((q = ineq.exec(t))) marks.push(q[0].trim());
      var dots = /(?:dots?|points?|marks?)\s*(?:at)?\s*((?:-?\d*\.?\d+(?:\s*(?:,|and)\s*)?)+)/.exec(t);
      if (dots) dots[1].split(/\s*(?:,|and)\s*/).filter(Boolean).forEach(function (d) { marks.push(d); });
      var vals = [];
      marks.forEach(function (mk) { (mk.match(new RegExp(NUM, 'g')) || []).forEach(function (v) { vals.push(parseFloat(v)); }); });
      var from = rng ? parseFloat(rng[1]) : vals.length ? Math.min(-5, Math.floor(Math.min.apply(0, vals)) - 2) : -5;
      var to = rng ? parseFloat(rng[2]) : vals.length ? Math.max(5, Math.ceil(Math.max.apply(0, vals)) + 2) : 5;
      return done(spec('numline', { from: Math.min(from, to), to: Math.max(from, to), marks: marks.join('\n') }));
    }

    // Graphs: equations, inequalities and points on a grid.
    if (isEq || has(/\b(graph|plot|axes|coordinate|grid|quadrant)/) || (/^\s*[a-z]?\s*\(\s*-?\d/i.test(raw) && !has(/triangle|circle|rect|square/))) {
      var g = {}, eqs = [], pts = [];
      raw.replace(/[−–—]/g, '-').split(/\s*;\s*|\n|\s+and\s+(?=[a-z]\s*[(=<>]|y\b|x\b)/i).forEach(function (part) {
        var p = part.replace(/^\s*(?:please\s+)?(?:graph|plot|draw|sketch|show)?\s*(?:of\s+|the\s+)?(?:lines?|curves?|graphs?|points?)?\s*:?\s*/i, '').trim();
        p = p.replace(/\s*(?:on|in)\s+(?:a\s+|the\s+)?(?:grid|graph|axes)\b.*$/i, '').replace(/\s*,?\s*[xy]\s+from\s+.*$/i, '').trim();
        if (!p || /^(?:a\s+)?(?:blank\s+)?(?:grid|graph paper|axes|coordinate grid|first quadrant)$/i.test(p)) return;
        if (/^([A-Za-z][A-Za-z0-9']*)?\s*\(\s*-?\d/.test(p) && !/=/.test(p)) pts.push(p);
        else if (/[=<>≤≥]|x/i.test(p)) eqs.push(p);
      });
      g.eqs = eqs.join('\n'); g.pts = pts.join('\n');
      var xr = new RegExp('x\\s*from\\s*(' + NUM + ')\\s*to\\s*(' + NUM + ')').exec(t), yr = new RegExp('y\\s*from\\s*(' + NUM + ')\\s*to\\s*(' + NUM + ')').exec(t);
      if (has(/first quadrant/)) { g.xmin = 0; g.xmax = 10; g.ymin = 0; g.ymax = 10; }
      if (xr) { g.xmin = parseFloat(xr[1]); g.xmax = parseFloat(xr[2]); }
      if (yr) { g.ymin = parseFloat(yr[1]); g.ymax = parseFloat(yr[2]); }
      if (has(/graph paper|blank grid/) && !eqs.length && !pts.length) Object.assign(g, { xmin: 0, xmax: 20, ymin: 0, ymax: 14, axes: false, nums: false });
      var gs = spec('grid', g), first = build(gs);
      // Nothing to see in the usual −10 to 10? Fit the grid to the graphs instead.
      if (!yr && !first.error && first.info && first.info.offgrid && first.info.offgrid.length) gs = fitRange(gs);
      return done(gs);
    }

    // 3D solids.
    for (var si = 0; si < SOLID_WORDS.length; si++) {
      if (t.indexOf(SOLID_WORDS[si][0]) < 0) continue;
      var shape = SOLID_WORDS[si][1], r = named('r|radius'), d = named('d|diameter'), h = named('h|height|tall'), l = named('l|length|long|edge|side'), w = named('w|width|wide|base');
      if (!isFinite(r) && isFinite(d)) r = d / 2;
      var free = nums.filter(function (v) { return [r, d, h, l, w].indexOf(v) < 0; });
      var take = function (v) { return isFinite(v) ? v : free.length ? free.shift() : NaN; };
      var o = { shape: shape };
      if (shape === 'cube') o.l = take(l);
      else if (shape === 'cuboid' || shape === 'pyramid') {
        o.l = take(l); o.w = take(w); o.h = take(h);
        if (shape === 'pyramid' && !isFinite(o.h) && isFinite(o.w)) { o.h = o.w; o.w = o.l; }
      } else if (shape === 'triprism') { o.w = take(w); o.h = take(h); o.l = take(l); o.tri = has(/right/) ? 'right' : 'iso'; }
      else if (shape === 'sphere' || shape === 'hemi') o.r = take(r);
      else { o.r = take(r); o.h = take(h); o.slant = has(/slant/); }
      return done(spec('solid', o));
    }

    // Circles.
    if (has(/circle/)) {
      var cr = named('r|radius'), cd = named('d|diameter');
      var co = { r: isFinite(cr) ? cr : isFinite(cd) ? cd / 2 : nums[0], diam: has(/diameter/), chord: has(/chord/), tangent: has(/tangent/) };
      var sector = named('sector|angle');
      if (has(/sector/)) co.sector = isFinite(sector) ? sector : angs[0] != null ? angs[0] : 60;
      return done(spec('circle', co));
    }

    // Regular polygons.
    var nSides = NaN;
    Object.keys(POLY_WORDS).forEach(function (pw) { if (t.indexOf(pw) >= 0) nSides = POLY_WORDS[pw]; });
    var ngon = /(\d+)\s*-?\s*(?:gon|sided|sides)/.exec(t);
    if (!isFinite(nSides) && ngon && has(/regular|polygon|gon/)) nSides = parseInt(ngon[1], 10);
    if (isFinite(nSides)) {
      var side = named('side|length|s'), rest = nums.filter(function (v) { return v !== nSides; });
      return done(spec('reg', { n: nSides, s: isFinite(side) ? side : rest[0] }));
    }

    // Triangles.
    if (has(/triangle/)) {
      var caps = {};
      raw.replace(/\b(AB|BC|CA|AC|[abcABC])\s*=\s*(-?\d*\.?\d+)/g, function (all, k, v) { caps[k === 'AC' ? 'CA' : k] = parseFloat(v); return all; });
      var sides = [caps.AB != null ? caps.AB : caps.c, caps.BC != null ? caps.BC : caps.a, caps.CA != null ? caps.CA : caps.b];
      var angsN = [caps.A, caps.B, caps.C];
      if (sides.some(isFinite) || angsN.some(isFinite)) {
        var hs = sides.filter(isFinite).length, ha = angsN.filter(isFinite).length;
        var to = { c: sides[0], a: sides[1], b: sides[2], A: angsN[0], B: angsN[1], C: angsN[2] };
        to.method = hs === 3 ? 'sss' : hs === 2 && ha >= 1 ? 'sas' : hs === 1 && ha >= 2 ? (isFinite(sides[0]) ? 'asa' : 'aas') : ha === 3 ? 'aaa' : '';
        if (!to.method) return { error: 'A triangle needs three facts: three sides, two sides and an angle, or two angles and a side.' };
        return done(spec('triangle', to));
      }
      if (has(/equilateral/) && nums.length) return done(spec('triangle', { method: 'sss', a: nums[0], b: nums[0], c: nums[0] }));
      if (has(/isosceles/) && nums.length >= 2) return done(spec('triangle', { method: 'sss', a: nums[0], b: nums[0], c: nums[1] }));
      if (has(/right/) && nums.length >= 2) {
        var legs = nums.length >= 3 ? nums.slice(0, 3).sort(function (p, q2) { return p - q2; }).slice(0, 2) : nums.slice(0, 2);
        return done(spec('triangle', { method: 'right', a: legs[0], b: legs[1] }));
      }
      if (nums.length >= 3) return done(spec('triangle', { method: 'sss', c: nums[0], a: nums[1], b: nums[2] }));
      if (nums.length === 2 && angs.length >= 1) return done(spec('triangle', { method: 'sas', c: nums[0], b: nums[1], A: angs[0] }));
      if (nums.length === 1 && angs.length >= 2) return done(spec('triangle', { method: 'asa', c: nums[0], A: angs[0], B: angs[1] }));
      if (angs.length >= 2) return done(spec('triangle', { method: 'aaa', A: angs[0], B: angs[1], C: angs.length > 2 ? angs[2] : 180 - angs[0] - angs[1] }));
      return { error: 'Give the triangle its sizes, like “triangle 5 6 7”, “right triangle 3 4” or “triangle 7, 40°, 60°”.' };
    }

    // Four-sided shapes.
    var by = new RegExp('(' + NUM + ')\\s*(?:by|x|\\*)\\s*(' + NUM + ')').exec(t.replace(/×/g, 'x'));
    if (has(/\bsquare\b/)) return done(spec('rect', { w: nums[0], h: nums[0] }));
    if (has(/rectangle|oblong/)) {
      var rw = named('w|width|length|base'), rh = named('h|height');
      return done(spec('rect', { w: by ? parseFloat(by[1]) : isFinite(rw) ? rw : nums[0], h: by ? parseFloat(by[2]) : isFinite(rh) ? rh : nums[1] }));
    }
    if (has(/parallelogram|rhombus/)) {
      var pb = named('base|b'), ps = named('side|s');
      return done(spec('para', { b: isFinite(pb) ? pb : nums[0], s: isFinite(ps) ? ps : has(/rhombus/) ? nums[0] : nums[1], ang: angs[0] }));
    }
    if (has(/trapezoid|trapezium/)) {
      return done(spec('trap', { b1: nums[0], b2: nums[1], h: nums[2], type: has(/right/) ? 'right' : has(/isosceles/) ? 'iso' : undefined }));
    }
    if (has(/kite/)) return done(spec('kite', { wd: nums[0], p: nums[1], q: nums[2] }));

    // Angles and parallel lines.
    if (has(/parallel|transversal/)) return done(spec('parallel', { ang: angs[0] != null ? angs[0] : nums[0] }));
    if (has(/angle/)) {
      var av = angs.concat(nums);
      var mode = has(/straight line|on a line/) ? 'line' : has(/around a point|at a point|round a point|full turn/) ? 'point'
        : has(/vertically opposite|crossing|intersecting/) ? 'vertical' : has(/in a right angle|make a right angle|right angle split/) ? 'right' : 'single';
      if (mode === 'single' && !av.length && has(/right angle/)) av = [90];
      var ao = { mode: mode, a1: av[0], a2: av[1], a3: av[2] };
      if (mode === 'line' || mode === 'right') ao.parts = clamp(av.length + 1, 2, 3);
      if (mode === 'point') ao.parts = clamp(av.length + 1, 3, 4);
      return done(spec('angle', ao));
    }

    // A bare equation, like “x^2 − 4”, or nothing recognised.
    if (/x/.test(t) && root.FluxExpr && !parseEquations(raw).error) return done(spec('grid', { eqs: raw }));
    return { error: 'I could not tell which figure that is. ' + EXAMPLES };
  }

  root.FluxFigures = {
    KINDS: KINDS, DEFAULTS: DEFAULTS, POLY_NAMES: POLY_NAMES,
    defaults: defaults, clean: clean, build: build, describe: describe, encode: encode, decode: decode,
    fromText: fromText, fitRange: fitRange, tidyMath: tidyMath, splitDomain: splitDomain, EXAMPLES: EXAMPLES,
    // geometry, for the tests and for Pixel
    solveTriangle: solveTriangle, trianglePoints: trianglePoints, rectPoints: rectPoints, paraPoints: paraPoints,
    trapPoints: trapPoints, trapOffset: trapOffset, kitePoints: kitePoints, regularPoints: regularPoints,
    angleParts: angleParts, parallelAngles: parallelAngles, parseMarks: parseMarks, parsePoints: parsePoints,
    parseEquations: parseEquations, sampleCurve: sampleCurve, clipSeg: clipSeg, gridLayout: gridLayout, fraction: fraction,
    project: project, solidEdges: solidEdges, SOLIDS: SOLIDS, groups: groups, area: area, insidePoly: insidePoly,
    sideLabelPos: sideLabelPos, wedgeLabelPos: wedgeLabelPos, vertexNamePos: vertexNamePos, outward: outward, wedge: wedge,
    textWidth: textWidth, runs: runs, textMarkup: textMarkup, fmt: fmt, fixed: fixed,
    vec: {
      fromPolar: fromPolar, magnitude: magnitude, direction: direction, toBearing: toBearing, fromBearing: fromBearing,
      fmtBearing: fmtBearing, compass: compass, dirText: dirText, sum: vsum, sub: vdiff, scale: vtimes,
      pctError: pctError, angleGap: angleGap, labCheck: labCheck, value: vectorValue, text: vectorText, draw: vectorDraw,
    },
  };
})();
