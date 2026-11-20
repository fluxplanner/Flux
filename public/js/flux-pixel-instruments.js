/* ============================================================================
   FLUX PIXEL · INSTRUMENTS  ·  flux-pixel-instruments.js
   A ruler, a protractor and a set square that sit on the page the way the
   real ones sit on paper: drag them, turn them by their round handle, and
   draw along them. The ruler and protractor can be made bigger or smaller,
   and a turn snaps level at 0°. They are tools, not drawing: they are never saved into
   the picture or exported.

   PURE: no DOM. Pixel asks for an instrument's markup, the edges a pen or
   a line should snap to, and the angle a line makes on the protractor.
   1 cm is 40 page units: one big square of Pixel's graph paper.
   ========================================================================== */
(function () {
  'use strict';
  var root = typeof window !== 'undefined' ? window : globalThis;

  var CM = 40, MM = CM / 10;
  var RULER_CM = 15, RULER_H = 66;
  var PRO_R = 220;
  // How big each one can be made. The ruler grows by whole centimetres so
  // its scale stays true; the protractor's radius changes, its degrees do not.
  var SIZE = {
    ruler: { key: 'len', min: 5, max: 30, step: 1, def: RULER_CM, label: 'Ruler length', unit: 'cm' },
    protractor: { key: 'rcm', min: 3, max: 10, step: 0.5, def: PRO_R / CM, label: 'Protractor size', unit: 'cm' },
  };
  /** An instrument's size in its SIZE units (cm), within its limits. */
  function size(name, inst) {
    var z = SIZE[name];
    if (!z) return null;
    var v = Number(inst && inst[z.key]);
    return isFinite(v) && v > 0 ? Math.max(z.min, Math.min(z.max, Math.round(v / z.step) * z.step)) : z.def;
  }
  function rulerCm(inst) { return size('ruler', inst); }
  function proR(inst) { return size('protractor', inst) * CM; }
  /** A turn snaps to 0° (level) when it comes within 4° of it, so it is easy to put straight again. */
  var LEVEL_SNAP = 4;
  function snapRot(deg) {
    var d = ((deg % 360) + 360) % 360;
    return d <= LEVEL_SNAP || d >= 360 - LEVEL_SNAP ? 0 : d;
  }
  var SQ_LEG = 320;
  var DEG = Math.PI / 180;
  var INK = '#0f172a', BODY = 'rgba(219,234,254,.55)', EDGE = '#2563eb';

  function r1(n) { return Math.round(n * 10) / 10; }
  function rot(p, a) { var c = Math.cos(a), s = Math.sin(a); return [p[0] * c - p[1] * s, p[0] * s + p[1] * c]; }
  /** A point on the instrument (its own units, x along it, y down) on the page. */
  function toPage(inst, p) { var q = rot(p, (inst.rot || 0) * DEG); return [inst.x + q[0], inst.y + q[1]]; }
  function toLocal(inst, p) { return rot([p[0] - inst.x, p[1] - inst.y], -(inst.rot || 0) * DEG); }

  function defaults(W, H) {
    // Side by side, clear of each other: the ruler along the bottom left, the
    // protractor to its right, the set square above the ruler.
    return {
      ruler: { on: false, x: W / 2 - 600, y: H / 2 + 230, rot: 0 },
      protractor: { on: false, x: W / 2 + 400, y: H / 2 + 230, rot: 0 },
      square: { on: false, x: W / 2 - 520, y: H / 2 + 150, rot: 0, kind: '45' },
    };
  }
  /** The legs of the set square: 45°, 45°, or 30°, 60°. */
  function squareLegs(inst) { return inst.kind === '30' ? [SQ_LEG, SQ_LEG * Math.tan(30 * DEG)] : [SQ_LEG, SQ_LEG]; }

  /* ── What each one looks like ───────────────────────────────────────── */

  function text(x, y, s, size, anchor) {
    return '<text x="' + r1(x) + '" y="' + r1(y) + '" font-size="' + size + '" font-family="Inter, system-ui, sans-serif" fill="' + INK + '" text-anchor="' + (anchor || 'middle') + '">' + s + '</text>';
  }
  function handle(x, y, k) {
    var r = 13 * k;
    return '<g data-inst-rot="1" style="cursor:grab"><circle cx="' + r1(x) + '" cy="' + r1(y) + '" r="' + r1(r) + '" fill="#fff" stroke="' + EDGE + '" stroke-width="' + r1(2.5 * k) + '"/>'
      + '<path d="M' + r1(x - r * 0.45) + ' ' + r1(y + r * 0.1) + 'a' + r1(r * 0.5) + ' ' + r1(r * 0.5) + ' 0 1 1 ' + r1(r * 0.45) + ' ' + r1(r * 0.42) + '" fill="none" stroke="' + EDGE + '" stroke-width="' + r1(2 * k) + '" stroke-linecap="round"/></g>';
  }
  function ruler(inst, k) {
    var n = rulerCm(inst), L = n * CM, out = '<rect x="-14" y="0" width="' + (L + 28) + '" height="' + RULER_H + '" rx="6" fill="' + BODY + '" stroke="' + EDGE + '" stroke-width="' + r1(1.5 * k) + '"/>';
    var d = '';
    for (var i = 0; i <= n * 10; i++) {
      var x = i * MM, len = i % 10 === 0 ? 22 : i % 5 === 0 ? 15 : 9;
      d += 'M' + r1(x) + ' 0V' + len;
    }
    out += '<path d="' + d + '" stroke="' + INK + '" stroke-width="1.1"/>';
    for (var c = 0; c <= n; c++) out += text(c * CM, 38, String(c), 13);
    out += text(L - 4, 58, 'cm', 11, 'end');
    return out + handle(L + 40, RULER_H / 2, k);
  }
  function protractor(inst, k) {
    var R = proR(inst), out = '<path d="M' + (-R - 12) + ' 0A' + (R + 12) + ' ' + (R + 12) + ' 0 0 1 ' + (R + 12) + ' 0Z" fill="' + BODY + '" stroke="' + EDGE + '" stroke-width="' + r1(1.5 * k) + '"/>';
    var d = '';
    for (var a = 0; a <= 180; a++) {
      var len = a % 10 === 0 ? 20 : a % 5 === 0 ? 13 : 7, c = Math.cos(a * DEG), s = -Math.sin(a * DEG);
      d += 'M' + r1(R * c) + ' ' + r1(R * s) + 'L' + r1((R - len) * c) + ' ' + r1((R - len) * s);
    }
    out += '<path d="' + d + '" stroke="' + INK + '" stroke-width="1"/>';
    // Two scales, as on a real one: outside from the right, inside from the left.
    for (var b = 0; b <= 180; b += 10) {
      var cb = Math.cos(b * DEG), sb = -Math.sin(b * DEG);
      out += text((R - 32) * cb, (R - 32) * sb + 4, String(b), 12);
      out += '<g fill-opacity=".7">' + text((R - 54) * cb, (R - 54) * sb + 4, String(180 - b), 10) + '</g>';
    }
    out += '<path d="M' + (-R) + ' 0H' + R + 'M0 -12V8" stroke="' + INK + '" stroke-width="1.2"/><circle cx="0" cy="0" r="3.5" fill="' + EDGE + '"/>';
    return out + handle(R + 34, -14, k);
  }
  function square(inst, k) {
    var g = squareLegs(inst), a = g[0], b = g[1];
    var out = '<path d="M0 0H' + a + 'L0 ' + r1(-b) + 'Z" fill="' + BODY + '" stroke="' + EDGE + '" stroke-width="' + r1(1.5 * k) + '"/>';
    var d = '';
    for (var i = 0; i * MM <= a - 8; i++) { var len = i % 10 === 0 ? 16 : i % 5 === 0 ? 11 : 6; d += 'M' + r1(i * MM) + ' 0V' + (-len); }
    for (var j = 0; j * MM <= b - 8; j++) { var ln = j % 10 === 0 ? 16 : j % 5 === 0 ? 11 : 6; d += 'M0 ' + r1(-j * MM) + 'H' + ln; }
    out += '<path d="' + d + '" stroke="' + INK + '" stroke-width="1"/>';
    out += '<path d="M14 0V-14H0" fill="none" stroke="' + INK + '" stroke-width="1.2"/>';
    out += text(a - 40, -12, inst.kind === '30' ? '30°' : '45°', 13) + text(16, -b + 46, inst.kind === '30' ? '60°' : '45°', 13, 'start');
    return out + handle(-30, 26, k);
  }
  var DRAW = { ruler: ruler, protractor: protractor, square: square };
  /** One instrument as SVG on the page; k is how many page units make one screen pixel, so lines stay thin at any zoom. */
  function svg(name, inst, k) {
    if (!inst || !inst.on || !DRAW[name]) return '';
    return '<g data-inst="' + name + '" transform="translate(' + r1(inst.x) + ' ' + r1(inst.y) + ') rotate(' + r1(inst.rot || 0) + ')" style="cursor:move">' + DRAW[name](inst, k || 1) + '</g>';
  }

  /* ── Drawing along them ─────────────────────────────────────────────── */

  /** The straight edges a pen or a line follows, on the page. */
  function edges(name, inst) {
    if (!inst || !inst.on) return [];
    var P = function (p) { return toPage(inst, p); };
    if (name === 'ruler') return [[P([-14, 0]), P([rulerCm(inst) * CM + 14, 0])]];
    if (name === 'protractor') { var R = proR(inst); return [[P([-R - 12, 0]), P([R + 12, 0])]]; }
    if (name === 'square') { var g = squareLegs(inst); return [[P([0, 0]), P([g[0], 0])], [P([0, 0]), P([0, -g[1]])], [P([g[0], 0]), P([0, -g[1]])]]; }
    return [];
  }
  function nearestOnSeg(p, a, b) {
    var dx = b[0] - a[0], dy = b[1] - a[1], L = dx * dx + dy * dy;
    var t = L ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L)) : 0;
    var q = [a[0] + t * dx, a[1] + t * dy];
    return { q: q, d: Math.hypot(p[0] - q[0], p[1] - q[1]), seg: [a, b] };
  }
  /** The nearest point on any edge within tol of p, or null. */
  function snapEdge(p, segs, tol) {
    var best = null;
    segs.forEach(function (s) { var n = nearestOnSeg(p, s[0], s[1]); if (n.d <= tol && (!best || n.d < best.d)) best = n; });
    return best;
  }
  /** Keep a point on the line of a segment (not only between its ends), so a line drawn along an edge stays straight past it. */
  function onLine(p, seg) {
    var a = seg[0], b = seg[1], dx = b[0] - a[0], dy = b[1] - a[1], L = dx * dx + dy * dy;
    var t = L ? ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L : 0;
    return [a[0] + t * dx, a[1] + t * dy];
  }
  /**
   * A line from the protractor's centre: its angle from the baseline (0 to
   * 180, anticlockwise as it reads on the outside scale), snapped to whole
   * degrees, and the end point that angle puts at the same distance.
   */
  function protractorLine(inst, start, end) {
    var c = [inst.x, inst.y];
    if (Math.hypot(start[0] - c[0], start[1] - c[1]) > 1e-6) return null;
    var l = toLocal(inst, end), len = Math.hypot(l[0], l[1]);
    if (len < 1) return null;
    var deg = Math.round(Math.atan2(-l[1], l[0]) / DEG);
    var e = toPage(inst, [len * Math.cos(deg * DEG), -len * Math.sin(deg * DEG)]);
    return { deg: ((deg % 360) + 360) % 360, end: e };
  }
  /** A length in centimetres, for the readout while drawing. */
  function cm(a, b) { return Math.hypot(b[0] - a[0], b[1] - a[1]) / CM; }

  root.FluxPixelInstruments = {
    CM: CM, defaults: defaults, svg: svg, edges: edges, snapEdge: snapEdge, onLine: onLine,
    protractorLine: protractorLine, toPage: toPage, toLocal: toLocal, cm: cm, squareLegs: squareLegs,
    SIZE: SIZE, size: size, snapRot: snapRot,
    NAMES: [['ruler', 'Ruler'], ['protractor', 'Protractor'], ['square', 'Set square']],
  };
})();
