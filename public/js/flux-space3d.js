/* ============================================================================
   FLUX SPACE  ·  flux-space3d.js
   The maths of the Grapher's 3D mode, and nothing that touches the page.

     What a row says        parseRow('x + y + z = 6') is a plane, '(1, 2, 3)'
                            a point, 'line (0, 0, 0), (1, 2, 3)' a line and
                            'z = x^2 − y^2' a surface. Equations are read by
                            flux-expr.js, the same parser the 2D grapher uses.
     What planes do         a plane's intercepts with the axes and its traces
                            on the coordinate planes; where two planes meet (a
                            line) and where three meet (a point — or why there
                            is none, or infinitely many). These are what the
                            CPM lessons on systems of three equations ask for.
     Where things go        a camera you can turn, tilt and zoom; the box that
                            every plane, line and surface is cut to; and the
                            order to paint them in so that what is in front
                            hides what is behind (a BSP tree of the planes —
                            see sceneOrder).
     What a link carries    a whole 3D graph packed into the # of a URL.

   Plain arrays — [x, y, z] — and plain functions, so test/unit/space3d.test.mjs
   checks every piece in node without a browser.
   ========================================================================== */
(function () {
  'use strict';

  /* ── Vectors ────────────────────────────────────────────────────────── */

  function add(a, b) { return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; }
  function sub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
  function mul(a, k) { return [a[0] * k, a[1] * k, a[2] * k]; }
  function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
  function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
  function len(a) { return Math.sqrt(dot(a, a)); }
  function unit(a) { const l = len(a); return l > 0 ? mul(a, 1 / l) : [0, 0, 0]; }
  /** −0 and float dust are 0, so nothing prints as "−0". */
  function tidy(v) { return Math.abs(v) < 1e-12 ? 0 : v; }
  function lerp(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }

  const AXES = ['x', 'y', 'z'];

  /* ── Numbers the way they are written on paper ────────────────────────
     Planes from a textbook have whole-number coefficients, so the answers
     are usually whole numbers or simple fractions. 10/3 should read 10/3,
     not 3.3333333; 2.5 should read 2.5; and 0.1 + 0.2 should read 0.3. */
  const MINUS = '−';
  function near(v, w) { return Math.abs(v - w) <= 1e-9 * Math.max(1, Math.abs(v), Math.abs(w)); }
  function fmtNum(v) {
    if (!Number.isFinite(v)) return '—';
    if (Math.abs(v) < 1e-10) return '0';
    const sign = v < 0 ? MINUS : '';
    const a = Math.abs(v);
    if (near(a, Math.round(a))) return sign + String(Math.round(a));
    // A decimal that stops within three places reads best as a decimal.
    for (let dp = 1; dp <= 3; dp++) {
      const s = a * Math.pow(10, dp);
      if (near(s, Math.round(s))) return sign + a.toFixed(dp).replace(/0+$/, '').replace(/\.$/, '');
    }
    // Thirds, sevenths, ninths: a fraction, as it would be written by hand.
    for (let q = 2; q <= 16; q++) {
      const p = a * q;
      if (near(p, Math.round(p))) return sign + Math.round(p) + '/' + q;
    }
    if (a >= 1e5 || a < 1e-3) return sign + a.toExponential(3).replace(/\.?0+e/, 'e');
    return sign + String(Number(a.toPrecision(5)));
  }
  function fmtPoint(p) { return '(' + p.map(fmtNum).join(', ') + ')'; }

  /** ax + by + cz with zero terms dropped and 1s left unwritten: "2x − y + z". */
  function linearText(coefs, names) {
    let s = '';
    coefs.forEach((c, i) => {
      if (Math.abs(c) < 1e-12) return;
      const neg = c < 0, a = Math.abs(c);
      let k = near(a, 1) ? '' : fmtNum(a);
      if (k.indexOf('/') >= 0) k = '(' + k + ')';      // (1/3)y, never 1/3y
      if (!s) s = (neg ? MINUS : '') + k + names[i];
      else s += (neg ? ' ' + MINUS + ' ' : ' + ') + k + names[i];
    });
    return s || '0';
  }

  /** A plane as ax + by + cz = d. Mostly-negative coefficients are flipped,
      so −x − y − z = −6 reads x + y + z = 6. */
  function planeText(pl) {
    let n = pl.n, d = pl.d;
    const nz = n.filter((c) => Math.abs(c) > 1e-12);
    const negs = nz.filter((c) => c < 0).length;
    if (negs * 2 > nz.length || (negs * 2 === nz.length && nz[0] < 0)) { n = mul(n, -1); d = -d; }
    return linearText(n, AXES) + ' = ' + fmtNum(d);
  }

  /** "(x, y, z) = (5, 1, 0) + t(3, −1, −2)" */
  function lineText(p, dir, param) {
    return '(x, y, z) = ' + fmtPoint(p) + ' + ' + (param || 't') + fmtPoint(dir);
  }

  /* ── Reading what was typed ───────────────────────────────────────────
     One row is one thing, and the shape of the text says which:
       (1, 2, 3)   A = (1, 2, 3)   A(1, 2, 3), B(4, 5, 6)      points
       x + y + z = 6   z = 2x − y + 3   x = 4                   a plane
       line (1, 2, 3), (4, 5, 6)                                a line through two points
       (1, 2, 3) + t(4, 5, 6)   (x, y, z) = (1, 2, 3) + t<4, 5, 6>
       x = 1 + 4t, y = 2 + 5t, z = 3 + 6t                       a line, point and direction
       z = x^2 − y^2   x^2 + y^2 − z = 0   sin(x)cos(y)         a surface
     Anything else gets a sentence saying what would work. */

  const MAX_POINTS = 100;
  const PAIRS = { '(': ')', '[': ']', '{': '}', '<': '>' };

  function clean(src) {
    return String(src == null ? '' : src)
      .replace(/[−–—]/g, '-')
      .replace(/[×·⋅]/g, '*')
      .replace(/÷/g, '/')
      .replace(/[⟨〈]/g, '<').replace(/[⟩〉]/g, '>')
      .replace(/≤/g, '<=').replace(/≥/g, '>=')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /** Where the bracket at i closes, or −1. Round, square and curly brackets
      nest inside it; an angle bracket only counts as the outer one. */
  function closer(s, i) {
    const close = PAIRS[s[i]];
    if (!close) return -1;
    const stack = [close];
    for (let k = i + 1; k < s.length; k++) {
      const c = s[k];
      if (c === stack[stack.length - 1]) { stack.pop(); if (!stack.length) return k; continue; }
      if (c === '(' || c === '[' || c === '{') stack.push(PAIRS[c]);
      else if (c === ')' || c === ']' || c === '}') return -1;
    }
    return -1;
  }

  /** Split at the given characters, but only outside brackets. */
  function splitTop(s, seps) {
    const out = [];
    let depth = 0, last = 0;
    for (let k = 0; k < s.length; k++) {
      const c = s[k];
      if (c === '(' || c === '[' || c === '{') depth++;
      else if (c === ')' || c === ']' || c === '}') depth--;
      else if (depth === 0 && seps.indexOf(c) >= 0) { out.push(s.slice(last, k)); last = k + 1; }
    }
    out.push(s.slice(last));
    return out.map((p) => p.trim());
  }
  function skip(s, i) { while (s[i] === ' ') i++; return i; }

  /** A bracketed list at i: { parts, end } with end just past the bracket. */
  function readTuple(s, i) {
    if (s[i] !== '(' && s[i] !== '[' && s[i] !== '<') return null;
    const j = closer(s, i);
    if (j < 0) return null;
    return { parts: splitTop(s.slice(i + 1, j), ','), end: j + 1 };
  }

  function expr() { return window.FluxExpr; }
  function isFn(name) {
    const E = expr();
    return !!(E && E.FNS && Object.prototype.hasOwnProperty.call(E.FNS, String(name).toLowerCase()));
  }

  /** A coordinate: any sum that works out to a number — 1/2, sqrt(2), −3. */
  function numberOf(text) {
    const t = String(text == null ? '' : text).trim();
    if (!t) return { error: 'A coordinate is missing — a point has three, like (1, 2, 3).' };
    const r = expr().tryCompile(t.toLowerCase(), 'x', { params: true, scope: {}, var2: 'y', var2Ref: { v: 0 } });
    if (r.error) return { error: r.error };
    if (r.usesVar || r.usesVar2 || r.params.length) return { error: 'A point’s coordinates are numbers, like (1, 2, 3) — “' + t + '” is not a number.' };
    const v = r.fn(0);
    if (!Number.isFinite(v)) return { error: '“' + t + '” does not work out to a number.' };
    return { value: v };
  }

  function lettersError(extra, where) {
    const list = extra.map((p) => '“' + p + '”').join(' and ');
    if (extra.indexOf('t') >= 0 || extra.indexOf('s') >= 0) {
      return 'Only x, y and z can be letters in an equation. A t belongs in a line, like (1, 2, 3) + t(4, 5, 6).';
    }
    return 'Only x, y and z can be letters ' + (where || 'here') + ' — ' + list + (extra.length > 1 ? ' are not.' : ' is not one of them.')
      + ' Use numbers, like 2x + 3y − z = 6.';
  }

  /** An expression in x, y and z, as f(x, y, z). */
  function compile3(text) {
    const ref = { v: 0 }, scope = { z: 0 };
    const r = expr().tryCompile(String(text).toLowerCase(), 'x', { params: true, scope: scope, var2: 'y', var2Ref: ref });
    if (r.error) return { error: r.error };
    const extra = r.params.filter((p) => p !== 'z');
    if (extra.length) return { error: lettersError(extra, 'in an equation') };
    const fn = r.fn;
    return {
      f: (x, y, z) => { ref.v = y; scope.z = z; return fn(x); },
      uses: { x: !!r.usesVar, y: !!r.usesVar2, z: r.params.indexOf('z') >= 0 },
    };
  }

  /* Points ---------------------------------------------------------------- */

  const LABEL_RE = /^([A-Za-zͰ-Ͽ][A-Za-z0-9_'′Ͱ-Ͽ]{0,11})\s*(=|:)?\s*(?=\()/;

  /** null when the row is not a list of points at all. */
  function parsePoints(s) {
    const items = [];
    let i = 0;
    while (i < s.length) {
      i = skip(s, i);
      let label = null;
      const m = LABEL_RE.exec(s.slice(i));
      if (m) {
        if (isFn(m[1])) return null;          // sqrt(2) is a sum, not a point called sqrt
        label = m[1];
        i += m[0].length;
      }
      if (s[i] !== '(') return null;
      const j = closer(s, i);
      if (j < 0) return { error: 'Missing a closing bracket.' };
      items.push({ label: label, parts: splitTop(s.slice(i + 1, j), ',') });
      i = skip(s, j + 1);
      if (i >= s.length) break;
      if (s[i] !== ',') return null;          // (x − 1) + y = 2 is an equation
      i++;
    }
    if (!items.length) return null;
    const first = items[0];
    // One bracket with one thing in it is a sum in brackets, not a point.
    if (items.length === 1 && first.parts.length === 1 && !first.label) return null;
    for (let k = 0; k < items.length; k++) {
      const it = items[k];
      if (it.label && /^[xyz]$/i.test(it.label)) {
        if (it.parts.length !== 3) return null;   // y = (x) is the plane y = x
        return { error: 'Call the point something other than ' + it.label + ', like A = (1, 2, 3).' };
      }
    }
    const pts = [];
    for (let k = 0; k < items.length; k++) {
      const it = items[k];
      if (it.parts.length !== 3) {
        return { error: it.parts.length === 2
          ? 'A point in 3D has three coordinates — x, y and z — like (1, 2, 3).'
          : 'A point has three coordinates, like (1, 2, 3).' };
      }
      const xyz = [];
      for (let c = 0; c < 3; c++) {
        const r = numberOf(it.parts[c]);
        if (r.error) return { error: r.error };
        xyz.push(r.value);
      }
      pts.push({ p: xyz, label: it.label });
    }
    if (pts.length > MAX_POINTS) return { error: 'One row can hold up to ' + MAX_POINTS + ' points.' };
    return { kind: 'points', pts: pts };
  }

  /* Lines ----------------------------------------------------------------- */

  const LINE_PREFIX = /^(?:\(\s*x\s*,\s*y\s*,\s*z\s*\)|<\s*x\s*,\s*y\s*,\s*z\s*>|\[\s*x\s*,\s*y\s*,\s*z\s*\]|r)\s*=\s*/i;
  const NAME_PREFIX = /^([A-Za-z][A-Za-z0-9_']{0,11})\s*(?:=|:)\s*(?=[(<[]|line\b)/i;
  const PARAMS = ['t', 's', 'λ'];

  function vector3(parts, what) {
    if (parts.length !== 3) return { error: 'The ' + what + ' needs three numbers, like (4, 5, 6).' };
    const v = [];
    for (let k = 0; k < 3; k++) {
      const r = numberOf(parts[k]);
      if (r.error) return { error: r.error };
      v.push(r.value);
    }
    return { v: v };
  }

  /** (1, 2, 3) + t(4, 5, 6), (1, 2, 3) − s<1, 0, 0>, (1, 2, 3) + (4, 5, 6)t */
  function vectorForm(s) {
    const P = readTuple(s, 0);
    if (!P) return null;
    let i = skip(s, P.end);
    const sign = s[i];
    if (sign !== '+' && sign !== '-') return null;
    i = skip(s, i + 1);
    let param = null, D = null;
    const pm = /^(t|s|λ)\s*\*?\s*/.exec(s.slice(i));
    if (pm && /[(<[]/.test(s[i + pm[0].length] || '')) {
      param = pm[1];
      D = readTuple(s, i + pm[0].length);
    } else if (/[(<[]/.test(s[i] || '')) {
      D = readTuple(s, i);
      if (D) {
        const after = /^\s*\*?\s*(t|s|λ)\b/.exec(s.slice(D.end));
        if (after) { param = after[1]; D = { parts: D.parts, end: D.end + after[0].length }; } else D = null;
      }
    }
    if (!D || !param || skip(s, D.end) < s.length) return null;
    return { P: P.parts, D: D.parts, neg: sign === '-', param: param };
  }

  function lineFrom(p0, dir, extra) {
    if (len(dir) < 1e-12) return { error: 'The direction is (0, 0, 0), so that is a single point, not a line.' };
    return Object.assign({ kind: 'line', p0: p0.map(tidy), dir: dir.map(tidy), param: 't' }, extra || {});
  }

  /** null when the row is not trying to be a line. */
  function parseLine(src) {
    let s = src, name = null;
    const pre = LINE_PREFIX.exec(s);
    if (pre) s = s.slice(pre[0].length);
    else {
      const nm = NAME_PREFIX.exec(s);
      if (nm && !/^[xyz]$/i.test(nm[1]) && !/^line$/i.test(nm[1])) { name = nm[1]; s = s.slice(nm[0].length); }
    }
    const kw = /^line\b\s*(?:through\s+)?/i.exec(s);
    if (kw) s = s.slice(kw[0].length);

    const vf = vectorForm(s);
    if (vf) {
      const P = vector3(vf.P, 'point');
      if (P.error) return P;
      const D = vector3(vf.D, 'direction');
      if (D.error) return D;
      return lineFrom(P.v, vf.neg ? mul(D.v, -1) : D.v, { param: vf.param, name: name });
    }
    if (!kw) return pre ? { error: 'Write the line as (x, y, z) = (1, 2, 3) + t(4, 5, 6).' } : null;

    // line (1, 2, 3), (4, 5, 6) — or line((1, 2, 3), (4, 5, 6)), or "and", or "to".
    let t = s.trim();
    if (t[0] === '(' && closer(t, 0) === t.length - 1) {
      const inner = splitTop(t.slice(1, -1), ',');
      if (inner.length === 2 && /^[(<[]/.test(inner[0]) && /^[(<[]/.test(inner[1])) t = inner[0] + ', ' + inner[1];
    }
    const how = 'Write a line through two points as line (1, 2, 3), (4, 5, 6), or through a point in a direction as (1, 2, 3) + t(4, 5, 6).';
    const A = readTuple(t, 0);
    if (!A) return { error: how };
    let i = skip(t, A.end);
    const sep = /^(,|and\b|to\b|&)\s*/i.exec(t.slice(i));
    if (!sep) return { error: how };
    i += sep[0].length;
    const B = readTuple(t, i);
    if (!B || skip(t, B.end) < t.length) return { error: how };
    const P = vector3(A.parts, 'first point');
    if (P.error) return P;
    const Q = vector3(B.parts, 'second point');
    if (Q.error) return Q;
    if (len(sub(Q.v, P.v)) < 1e-12) return { error: 'Those are the same point twice — a line needs two different points.' };
    return lineFrom(P.v, sub(Q.v, P.v), { through: [P.v, Q.v], name: name });
  }

  /** x = 1 + 4t, y = 2 + 5t, z = 3 + 6t — each part a number plus a number times t. */
  function parseComponents(s) {
    const parts = splitTop(s, ',;');
    if (parts.length !== 3) return null;
    const rhs = {};
    for (let k = 0; k < 3; k++) {
      const m = /^([xyz])\s*=\s*(.+)$/i.exec(parts[k]);
      if (!m) return null;
      const ax = m[1].toLowerCase();
      if (rhs[ax]) return null;
      rhs[ax] = m[2].toLowerCase();
    }
    if (!(rhs.x && rhs.y && rhs.z)) return null;
    let firstErr = null;
    for (let pi = 0; pi < PARAMS.length; pi++) {
      const param = PARAMS[pi];
      const fs = [];
      let bad = null;
      for (let k = 0; k < 3; k++) {
        const r = expr().tryCompile(rhs[AXES[k]], param, { params: true, scope: {} });
        if (r.error) { bad = r.error; break; }
        if (r.params.length) { bad = 'Only t can be a letter in a line written x = …, y = …, z = … — like x = 1 + 2t.'; break; }
        fs.push(r.fn);
      }
      if (bad) { if (!firstErr) firstErr = bad; continue; }
      const at = (t) => fs.map((f) => f(t));
      const p0 = at(0), p1 = at(1);
      if (!p0.concat(p1).every(Number.isFinite)) return { error: 'At t = 0 or t = 1 that is not a point — check each part.' };
      const dir = sub(p1, p0);
      const straight = [2, -1.5, 3.7].every((t) => {
        const want = add(p0, mul(dir, t)), got = at(t);
        return got.every((g, k) => Number.isFinite(g) && Math.abs(g - want[k]) <= 1e-9 * (1 + Math.abs(want[k]) + Math.abs(dir[k]) * Math.abs(t)));
      });
      if (!straight) return { error: 'That is a curve, not a straight line: each of x, y and z must be a number plus a number times ' + param + ', like x = 1 + 2' + param + '.' };
      if (len(dir) < 1e-12) return { error: 'None of x, y and z changes with ' + param + ', so that is one point. Write it as (x, y, z) instead.' };
      return { kind: 'line', p0: p0.map(tidy), dir: dir.map(tidy), param: param };
    }
    return { error: firstErr || 'Write a line as x = 1 + 2t, y = 3t, z = 4 − t.' };
  }

  /* Equations: planes and surfaces --------------------------------------- */

  /** The plane f(x, y, z) = 0 when f is linear: { n, d } with n·p = d, else null. */
  function linearOf(f) {
    const d0 = f(0, 0, 0);
    const a = f(1, 0, 0) - d0, b = f(0, 1, 0) - d0, c = f(0, 0, 1) - d0;
    if (![d0, a, b, c].every(Number.isFinite)) return null;
    const probes = [[1.7, -2.3, 0.9], [-3.1, 0.4, 2.6], [0.37, 5.2, -1.9], [7.5, -6.25, 3.125]];
    const scale = 1 + Math.abs(d0) + Math.abs(a) + Math.abs(b) + Math.abs(c);
    for (let k = 0; k < probes.length; k++) {
      const p = probes[k];
      const got = f(p[0], p[1], p[2]);
      const want = d0 + a * p[0] + b * p[1] + c * p[2];
      if (!Number.isFinite(got) || Math.abs(got - want) > 1e-9 * scale * 10) return null;
    }
    return { n: [a, b, c].map(tidy), d: tidy(-d0) };
  }

  /** z = h(x, y) when f(x, y, z) = 0 can be solved for z (f = αz + β(x, y),
      α a nonzero constant) — and the same for y and x. Tried in that order,
      so x² + y² − z = 0 is the paraboloid z = x² + y². */
  function solvedFor(f) {
    const probes = [[0.3, -1.2], [2.1, 0.7], [-1.6, 2.4], [-0.45, -2.9], [3.3, 1.9]];
    const at = (ax, u, v, w) => (ax === 'z' ? f(u, v, w) : ax === 'y' ? f(u, w, v) : f(w, u, v));
    for (let k = 2; k >= 0; k--) {
      const ax = AXES[k];
      let alpha = null, ok = true;
      for (let q = 0; q < probes.length && ok; q++) {
        const u = probes[q][0], v = probes[q][1];
        const f0 = at(ax, u, v, 0), f1 = at(ax, u, v, 1), f2 = at(ax, u, v, -2.5);
        if (![f0, f1, f2].every(Number.isFinite)) continue;
        const al = f1 - f0;
        if (Math.abs((f2 - f0) - al * -2.5) > 1e-9 * (1 + Math.abs(f0) + Math.abs(al) * 2.5)) ok = false;
        else if (alpha == null) alpha = al;
        else if (Math.abs(al - alpha) > 1e-9 * (1 + Math.abs(alpha))) ok = false;
      }
      if (ok && alpha != null && Math.abs(alpha) > 1e-12) {
        const A = alpha;
        return { axis: ax, h: (u, v) => -at(ax, u, v, 0) / A };
      }
    }
    return null;
  }

  function parseEquation(s) {
    if (/!=|≠/.test(s)) return { error: '≠ cannot be drawn — use =.' };
    if (/[<>]/.test(s)) return { error: '3D draws equations, not inequalities — use =.' };
    const sides = splitTop(s, '=');
    if (sides.length > 2) {
      return { error: 'One equation per row. To see where x = 4 and y = 2 meet, put them on two rows.' };
    }
    if (sides.length === 1) {
      // Desmos-style: an expression in x and y on its own is z = that expression.
      const r = compile3(s);
      if (r.error) return r;
      if (r.uses.z) return { error: 'Finish it with = and a number, like x + y + z = 6.' };
      if (!r.uses.x && !r.uses.y) return { error: 'That is a number. To plot a point, write it as (x, y, z), like (1, 2, 3).' };
      return fromFunction((x, y, z) => z - r.f(x, y, 0), 'z = ' + s);
    }
    const lhs = sides[0], rhs = sides[1];
    if (!lhs || !rhs) return { error: 'Put something on both sides of =, like x + y + z = 6.' };
    const L = compile3(lhs);
    if (L.error) return L;
    const R = compile3(rhs);
    if (R.error) return R;
    if (!L.uses.x && !L.uses.y && !L.uses.z && !R.uses.x && !R.uses.y && !R.uses.z) {
      return { error: 'There is no x, y or z in this to draw.' };
    }
    return fromFunction((x, y, z) => L.f(x, y, z) - R.f(x, y, z), s);
  }

  function fromFunction(G, text) {
    const pl = linearOf(G);
    if (pl) {
      if (len(pl.n) < 1e-12) {
        return { error: Math.abs(pl.d) < 1e-12 ? 'That is true at every point, so there is nothing to draw.' : 'No point makes that true, so there is nothing to draw.' };
      }
      return { kind: 'plane', n: pl.n, d: pl.d };
    }
    const sol = solvedFor(G);
    if (sol) return { kind: 'surface', axis: sol.axis, h: sol.h };
    return { error: 'Only planes, like 2x + y − z = 4, and surfaces written as z = …, like z = x^2 − y^2, can be drawn.' };
  }

  /**
   * Read one row. Returns one of
   *   { kind: 'empty' }
   *   { kind: 'points', pts: [{ p: [x, y, z], label }] }
   *   { kind: 'plane', n: [a, b, c], d }              a·x + b·y + c·z = d
   *   { kind: 'line', p0, dir, param, through?, name? }
   *   { kind: 'surface', axis: 'z' | 'y' | 'x', h(u, v) }   e.g. z = h(x, y)
   *   { error: 'a sentence saying what would work' }
   */
  function parseRow(src) {
    const s = clean(src);
    if (!s) return { kind: 'empty' };
    if (!expr()) return { error: 'The maths engine has not loaded.' };
    const ln = parseLine(s);
    if (ln) return ln;
    const cp = parseComponents(s);
    if (cp) return cp;
    const pts = parsePoints(s);
    if (pts) return pts;
    return parseEquation(s);
  }

  /** A point on a surface from its two free coordinates. */
  function surfacePoint(sf, u, v) {
    const w = sf.h(u, v);
    return sf.axis === 'z' ? [u, v, w] : sf.axis === 'y' ? [u, w, v] : [w, u, v];
  }

  /* ── Planes: intercepts and traces ────────────────────────────────────── */

  /** Where the plane crosses each axis: a point, nowhere (parallel to the
      axis), or everywhere (the axis lies in the plane). */
  function intercepts(pl) {
    return AXES.map((ax, i) => {
      const a = pl.n[i];
      if (Math.abs(a) < 1e-12) return { axis: ax, kind: Math.abs(pl.d) < 1e-12 ? 'all' : 'none' };
      const p = [0, 0, 0];
      p[i] = tidy(pl.d / a);
      return { axis: ax, kind: 'point', p: p, v: p[i] };
    });
  }

  const COORD_PLANES = [
    { name: 'xy', k: 2, n: [0, 0, 1] },   // z = 0
    { name: 'xz', k: 1, n: [0, 1, 0] },   // y = 0
    { name: 'yz', k: 0, n: [1, 0, 0] },   // x = 0
  ];

  /** Where the plane meets the xy-, xz- and yz-planes: the trace's equation
      in that plane (2x − y = −3), or none (parallel), or the same plane. */
  function traces(pl) {
    return COORD_PLANES.map((cp) => {
      const keep = [0, 1, 2].filter((i) => i !== cp.k);
      const co = keep.map((i) => pl.n[i]);
      if (co.every((c) => Math.abs(c) < 1e-12)) return { plane: cp.name, kind: Math.abs(pl.d) < 1e-12 ? 'same' : 'none' };
      let c2 = co, d = pl.d;
      const nz = co.filter((c) => Math.abs(c) > 1e-12), negs = nz.filter((c) => c < 0).length;
      if (negs * 2 > nz.length || (negs * 2 === nz.length && nz[0] < 0)) { c2 = co.map((c) => -c); d = -d; }
      const m = meet2(pl, { n: cp.n, d: 0 });
      return {
        plane: cp.name, kind: 'line',
        text: linearText(c2, keep.map((i) => AXES[i])) + ' = ' + fmtNum(d),
        p: m.p, dir: m.dir,
      };
    });
  }

  /* ── Where planes meet ────────────────────────────────────────────────── */

  function unitPlane(pl) {
    const l = len(pl.n);
    return { n: mul(pl.n, 1 / l), d: pl.d / l };
  }

  /** How "nice" a point is to write down: whole numbers first, then short
      decimals, then small fractions, then the smallest. */
  function niceness(p) {
    let score = 0;
    p.forEach((v) => {
      const t = fmtNum(v);
      if (/^−?\d+$/.test(t)) score += 4;
      else if (/^−?\d+\.\d+$/.test(t)) score += 3;
      else if (/\//.test(t)) score += 2;
    });
    return score * 1e6 - Math.max(Math.abs(p[0]), Math.abs(p[1]), Math.abs(p[2]));
  }

  /** A point on the line where planes A and B meet, chosen to be easy to
      write: where the line crosses a coordinate plane, usually. */
  function pointOnBoth(A, B, u) {
    const cands = [];
    for (let i = 0; i < 3; i++) {
      if (Math.abs(u[i]) < 1e-12 * len(u)) continue;
      const j = (i + 1) % 3, k = (i + 2) % 3;
      const det = A.n[j] * B.n[k] - A.n[k] * B.n[j];
      if (Math.abs(det) < 1e-15) continue;
      const p = [0, 0, 0];
      p[j] = (A.d * B.n[k] - A.n[k] * B.d) / det;
      p[k] = (A.n[j] * B.d - A.d * B.n[j]) / det;
      cands.push(p);
    }
    const uu = dot(u, u);
    cands.push(mul(add(mul(cross(B.n, u), A.d), mul(cross(u, A.n), B.d)), 1 / uu));
    let best = cands[0], bs = -Infinity;
    cands.forEach((p) => {
      if (!p.every(Number.isFinite)) return;
      const sc = niceness(p);
      if (sc > bs) { bs = sc; best = p; }
    });
    return best.map((v) => (Math.abs(v) < 1e-12 ? 0 : v));
  }

  /** A direction scaled to small whole numbers where it can be: (3, −1, −2),
      not (0.802, −0.267, −0.534). The first nonzero part is made positive. */
  function niceDir(u) {
    const m = Math.max(Math.abs(u[0]), Math.abs(u[1]), Math.abs(u[2]));
    if (!(m > 0)) return [0, 0, 0];
    u = u.map(tidy);
    let v = mul(u, 1 / m);
    let found = null;
    for (let k = 1; k <= 12 && !found; k++) {
      const w = mul(v, k);
      if (w.every((x) => Math.abs(x - Math.round(x)) < 1e-9)) found = w.map(Math.round);
    }
    if (found) {
      const g = found.reduce((a, b) => gcd(a, Math.abs(b)), 0) || 1;
      v = found.map((x) => x / g);
    } else v = v.map((x) => Number(x.toFixed(6)));
    const first = v.find((x) => Math.abs(x) > 1e-12);
    if (first < 0) v = mul(v, -1);
    return v.map((x) => (Math.abs(x) < 1e-12 ? 0 : x));
  }
  function gcd(a, b) { a = Math.abs(a); b = Math.abs(b); while (b) { const t = a % b; a = b; b = t; } return a; }

  /** Two planes: { kind: 'line', p, dir } | { kind: 'parallel' } | { kind: 'same' }. */
  function meet2(A, B) {
    const ua = unitPlane(A), ub = unitPlane(B);
    const u = cross(ua.n, ub.n);
    if (len(u) < 1e-9) {
      const s = dot(ua.n, ub.n) > 0 ? 1 : -1;
      return Math.abs(ub.d - s * ua.d) <= 1e-9 * (1 + Math.abs(ua.d)) ? { kind: 'same' } : { kind: 'parallel' };
    }
    return { kind: 'line', p: pointOnBoth(A, B, cross(A.n, B.n)), dir: niceDir(cross(A.n, B.n)) };
  }

  /** The rank of the first `cols` columns of a matrix, by elimination. */
  function rankOf(rows, cols) {
    const m = rows.map((r) => r.slice(0, cols));
    let rank = 0;
    for (let c = 0; c < cols && rank < m.length; c++) {
      let piv = rank;
      for (let r = rank + 1; r < m.length; r++) if (Math.abs(m[r][c]) > Math.abs(m[piv][c])) piv = r;
      if (Math.abs(m[piv][c]) < 1e-9) continue;
      const tmp = m[piv]; m[piv] = m[rank]; m[rank] = tmp;
      for (let r = 0; r < m.length; r++) {
        if (r === rank) continue;
        const f = m[r][c] / m[rank][c];
        for (let k = c; k < cols; k++) m[r][k] -= f * m[rank][k];
      }
      rank++;
    }
    return rank;
  }

  /**
   * What every plane in the list has in common:
   *   { kind: 'point', p }               exactly one point (the system's solution)
   *   { kind: 'line', p, dir }           a whole line — infinitely many points
   *   { kind: 'plane' }                  they are all the same plane
   *   { kind: 'none', parallel: [i, j] } no point: planes i and j are parallel
   *   { kind: 'none', parallel: null }   no point, and no two are parallel —
   *                                      three planes that meet in pairs along
   *                                      three parallel lines, like a prism
   */
  function meetAll(list) {
    if (list.length < 2) return null;
    const U = list.map(unitPlane);
    const rows = U.map((p) => [p.n[0], p.n[1], p.n[2], p.d]);
    const rA = rankOf(rows, 3), rAb = rankOf(rows, 4);
    if (rAb > rA) {
      for (let i = 0; i < list.length; i++) {
        for (let j = i + 1; j < list.length; j++) {
          if (meet2(list[i], list[j]).kind === 'parallel') return { kind: 'none', parallel: [i, j] };
        }
      }
      return { kind: 'none', parallel: null };
    }
    if (rA === 1) return { kind: 'plane' };
    if (rA === 2) {
      for (let i = 0; i < list.length; i++) {
        for (let j = i + 1; j < list.length; j++) {
          const m = meet2(list[i], list[j]);
          if (m.kind === 'line') return { kind: 'line', p: m.p, dir: m.dir };
        }
      }
    }
    // Three independent planes, then Cramer's rule — exact for whole numbers.
    const pick = [];
    for (let i = 0; i < list.length && pick.length < 3; i++) {
      const trial = pick.concat([i]);
      if (rankOf(trial.map((k) => rows[k]), 3) === trial.length) pick.push(i);
    }
    const n1 = list[pick[0]].n, n2 = list[pick[1]].n, n3 = list[pick[2]].n;
    const det = dot(n1, cross(n2, n3));
    const p = mul(add(add(mul(cross(n2, n3), list[pick[0]].d), mul(cross(n3, n1), list[pick[1]].d)), mul(cross(n1, n2), list[pick[2]].d)), 1 / det);
    return { kind: 'point', p: p.map((v) => (Math.abs(v) < 1e-12 ? 0 : v)) };
  }

  /* ── The box everything is cut to ─────────────────────────────────────── */

  function boxLo(b) { return [b.xMin, b.yMin, b.zMin]; }
  function boxHi(b) { return [b.xMax, b.yMax, b.zMax]; }
  function boxCentre(b) { return [(b.xMin + b.xMax) / 2, (b.yMin + b.yMax) / 2, (b.zMin + b.zMax) / 2]; }
  function boxSize(b) { return Math.max(b.xMax - b.xMin, b.yMax - b.yMin, b.zMax - b.zMin); }
  function inBox(p, b, slack) {
    const e = (slack || 1e-9) * boxSize(b);
    return p[0] >= b.xMin - e && p[0] <= b.xMax + e && p[1] >= b.yMin - e && p[1] <= b.yMax + e && p[2] >= b.zMin - e && p[2] <= b.zMax + e;
  }
  /** The box's six faces, each as n·p ≤ d. */
  function boxHalves(b) {
    return [
      { n: [-1, 0, 0], d: -b.xMin }, { n: [1, 0, 0], d: b.xMax },
      { n: [0, -1, 0], d: -b.yMin }, { n: [0, 1, 0], d: b.yMax },
      { n: [0, 0, -1], d: -b.zMin }, { n: [0, 0, 1], d: b.zMax },
    ];
  }

  /**
   * Keep the part of a convex polygon where n·p ≤ d (Sutherland–Hodgman).
   * `edges[i]` says whether the edge from pts[i] to pts[i+1] is a real edge
   * (worth drawing) or a cut; the new edge along n·p = d gets `newEdge`.
   */
  function clipPoly(pts, edges, n, d, eps, newEdge) {
    const N = pts.length;
    if (N < 3) return null;
    const h = pts.map((p) => dot(n, p) - d);
    const out = [], arrive = [];
    for (let i = 0; i < N; i++) {
      const pi = (i + N - 1) % N;
      const prev = pts[pi], cur = pts[i], hp = h[pi], hc = h[i], f = edges[pi];
      const pin = hp <= eps, cin = hc <= eps;
      if (pin && cin) { out.push(cur); arrive.push(f); }
      else if (pin && !cin) { out.push(lerp(prev, cur, hp / (hp - hc))); arrive.push(f); }
      else if (!pin && cin) {
        out.push(lerp(prev, cur, hp / (hp - hc))); arrive.push(newEdge);
        out.push(cur); arrive.push(f);
      }
    }
    if (out.length < 3) return null;
    // Drop repeated corners, which a cut through a vertex leaves behind.
    const P = [], E = [];
    for (let i = 0; i < out.length; i++) {
      const nxt = out[(i + 1) % out.length];
      const e = arrive[(i + 1) % out.length];
      if (len(sub(nxt, out[i])) <= eps) { if (e && E.length) E[E.length - 1] = E[E.length - 1] || e; continue; }
      P.push(out[i]); E.push(e);
    }
    return P.length >= 3 ? { pts: P, edges: E } : null;
  }

  /** Two directions across a plane with normal n. */
  function basis(n) {
    const a = Math.abs(n[0]) <= Math.abs(n[1]) && Math.abs(n[0]) <= Math.abs(n[2]) ? [1, 0, 0]
      : Math.abs(n[1]) <= Math.abs(n[2]) ? [0, 1, 0] : [0, 0, 1];
    const e1 = unit(cross(n, a));
    return [e1, cross(unit(n), e1)];
  }

  /** The piece of a plane inside the box, as a polygon: { pts, edges } or null. */
  function planeInBox(pl, box) {
    const P = unitPlane(pl);
    const c = boxCentre(box);
    const R = len(sub(boxHi(box), boxLo(box))) * 2;
    const foot = sub(c, mul(P.n, dot(P.n, c) - P.d));
    const e = basis(P.n);
    let poly = {
      pts: [[R, R], [-R, R], [-R, -R], [R, -R]].map((q) => add(foot, add(mul(e[0], q[0]), mul(e[1], q[1])))),
      edges: [false, false, false, false],
    };
    const eps = 1e-9 * boxSize(box);
    const halves = boxHalves(box);
    for (let k = 0; k < halves.length && poly; k++) poly = clipPoly(poly.pts, poly.edges, halves[k].n, halves[k].d, eps, true);
    return poly;
  }

  /** The piece of a line inside the box: [from, to], or null if it misses. */
  function lineInBox(p, dir, box) {
    const lo = boxLo(box), hi = boxHi(box);
    let t0 = -Infinity, t1 = Infinity;
    const eps = 1e-9 * boxSize(box);
    for (let i = 0; i < 3; i++) {
      if (Math.abs(dir[i]) < 1e-15) {
        if (p[i] < lo[i] - eps || p[i] > hi[i] + eps) return null;
        continue;
      }
      let a = (lo[i] - p[i]) / dir[i], b = (hi[i] - p[i]) / dir[i];
      if (a > b) { const t = a; a = b; b = t; }
      t0 = Math.max(t0, a);
      t1 = Math.min(t1, b);
    }
    if (!(t1 - t0 > 1e-9)) return null;
    return [add(p, mul(dir, t0)), add(p, mul(dir, t1))];
  }

  /**
   * A surface as small polygons, cut to the box. Cells where the surface is
   * undefined (the square root of a negative) are left out a triangle at a
   * time, so a hemisphere's rim stays round rather than stepped.
   */
  function surfaceMesh(sf, box, N) {
    const lo = boxLo(box), hi = boxHi(box);
    const iu = sf.axis === 'x' ? 1 : 0, iv = sf.axis === 'z' ? 1 : 2, iw = AXES.indexOf(sf.axis);
    const big = boxSize(box) * 1e4;
    const grid = [];
    for (let i = 0; i <= N; i++) {
      const row = [];
      const u = lo[iu] + (hi[iu] - lo[iu]) * i / N;
      for (let j = 0; j <= N; j++) {
        const v = lo[iv] + (hi[iv] - lo[iv]) * j / N;
        let p = null;
        try { p = surfacePoint(sf, u, v); } catch (e) { p = null; }
        row.push(p && Number.isFinite(p[iw]) && Math.abs(p[iw]) < big ? p : null);
      }
      grid.push(row);
    }
    const nLo = [0, 0, 0], nHi = [0, 0, 0];
    nLo[iw] = -1; nHi[iw] = 1;
    const eps = 1e-9 * boxSize(box);
    const out = [];
    const keep = (pts) => {
      let poly = { pts: pts, edges: pts.map(() => true) };
      poly = clipPoly(poly.pts, poly.edges, nLo, -lo[iw], eps, true);
      if (poly) poly = clipPoly(poly.pts, poly.edges, nHi, hi[iw], eps, true);
      if (poly) out.push(poly);
    };
    for (let i = 0; i < N; i++) {
      for (let j = 0; j < N; j++) {
        const a = grid[i][j], b = grid[i + 1][j], c = grid[i + 1][j + 1], d = grid[i][j + 1];
        if (a && b && c && d) keep([a, b, c, d]);
        else {
          if (a && b && c) keep([a, b, c]);
          if (a && c && d) keep([a, c, d]);
          if (!a && b && c && d) keep([b, c, d]);
          if (a && b && !c && d) keep([a, b, d]);
        }
      }
    }
    return out;
  }

  /* ── The camera ───────────────────────────────────────────────────────
     Turn (yaw) goes round the z axis and tilt (pitch) lifts the eye above
     the xy-plane. The projection is orthographic — parallel lines stay
     parallel — so looking straight down the z axis shows the xy-plane as a
     flat 2D graph, the way the traces are drawn in the lessons. At the
     standard view x comes out towards you, down and to the left, y runs to
     the right and z points up. */

  const DEFAULT_VIEW = { yaw: 32, pitch: 22, zoom: 1 };
  const PRESETS = {
    x: { yaw: 0, pitch: 0 },      // along the x axis: the yz-plane, y right, z up
    y: { yaw: -90, pitch: 0 },    // along the y axis: the xz-plane, x right, z up
    z: { yaw: -90, pitch: 90 },   // along the z axis: the xy-plane, x right, y up
    std: { yaw: DEFAULT_VIEW.yaw, pitch: DEFAULT_VIEW.pitch },
  };
  function wrapYaw(a) { let y = ((a + 180) % 360 + 360) % 360 - 180; if (y === -180) y = 180; return y; }

  /**
   * Where things land on a W × H screen. `equal` keeps one scale on every
   * axis (true shapes); without it the box is drawn as a cube whatever its
   * ranges. Returns project(p) → [x, y, depth] (depth grows away from you)
   * and g, the direction in which depth grows, in the graph's own units.
   */
  function camera(box, view, W, H, equal) {
    const c = boxCentre(box);
    const half = [(box.xMax - box.xMin) / 2, (box.yMax - box.yMin) / 2, (box.zMax - box.zMin) / 2];
    const big = Math.max(half[0], half[1], half[2]);
    const s = equal ? [1 / big, 1 / big, 1 / big] : half.map((h) => 1 / h);
    const yaw = view.yaw * Math.PI / 180, pitch = view.pitch * Math.PI / 180;
    const cp = Math.cos(pitch), sp = Math.sin(pitch), cy = Math.cos(yaw), sy = Math.sin(yaw);
    const e = [cp * cy, cp * sy, sp];          // towards the eye
    const r = [-sy, cy, 0];                    // screen right
    const u = [-sp * cy, -sp * sy, cp];        // screen up
    const R = Math.sqrt(half.reduce((acc, h, i) => acc + (h * s[i]) * (h * s[i]), 0));
    const k = (view.zoom || 1) * (Math.min(W, H) / 2) * 0.96 / R;
    const g = [-e[0] * s[0], -e[1] * s[1], -e[2] * s[2]];
    return {
      W: W, H: H, k: k, s: s, c: c, e: e, r: r, u: u, g: g,
      project: (p) => {
        const q = [(p[0] - c[0]) * s[0], (p[1] - c[1]) * s[1], (p[2] - c[2]) * s[2]];
        return [W / 2 + k * dot(q, r), H / 2 - k * dot(q, u), -dot(q, e)];
      },
      /** Screen direction (unit, y down) of a direction in the graph. */
      dir2d: (v) => {
        const q = [v[0] * s[0], v[1] * s[1], v[2] * s[2]];
        const x = dot(q, r), y = -dot(q, u), l = Math.hypot(x, y);
        return l > 1e-12 ? [x / l, y / l] : [0, 0];
      },
    };
  }

  /* ── Painting in the right order ──────────────────────────────────────
     Painting far things first and near things last ("painter's order")
     goes wrong for two planes that cross: each is one big shape, and
     whichever is painted second covers all of the other, including the half
     that is in front of it. So the planes go into a BSP tree: each plane is
     cut along every other plane it crosses, and for any viewpoint the tree
     says exactly which side of each plane to paint first. Everything else —
     axes, grid, lines, points, surface patches — is dropped into the same
     tree, so a plane hides exactly the part of an axis or a surface behind
     it. Inside one region between planes, small pieces are painted far to
     near, which is right for pieces that small. Something lying in a plane
     (a trace, an intercept, the line where two planes meet) is painted on
     the side facing you, so it is never hidden by the plane it lies in.

     The tree depends only on the planes, so it is built once per change to
     the graph; turning the graph only walks it again. */

  function distTo(node, p) { return dot(node.n, p) - node.d; }

  /** 1 in front, −1 behind, 0 in the plane, 2 across it. */
  function sideOf(pts, node, eps) {
    let f = false, b = false;
    for (let i = 0; i < pts.length; i++) {
      const h = distTo(node, pts[i]);
      if (h > eps) f = true; else if (h < -eps) b = true;
    }
    return f && b ? 2 : f ? 1 : b ? -1 : 0;
  }

  function cutPoly(it, node, eps) {
    const back = clipPoly(it.pts, it.edges, node.n, node.d, eps, false);
    const front = clipPoly(it.pts, it.edges, mul(node.n, -1), -node.d, eps, false);
    return {
      front: front ? Object.assign({}, it, { pts: front.pts, edges: front.edges }) : null,
      back: back ? Object.assign({}, it, { pts: back.pts, edges: back.edges }) : null,
    };
  }

  function insertPlane(node, poly, eps) {
    if (!node) {
      const U = unitPlane(poly.plane);
      return { n: U.n, d: U.d, polys: [poly], front: null, back: null };
    }
    const side = sideOf(poly.pts, node, eps);
    if (side === 0) { node.polys.push(poly); return node; }
    if (side === 1) { node.front = insertPlane(node.front, poly, eps); return node; }
    if (side === -1) { node.back = insertPlane(node.back, poly, eps); return node; }
    const parts = cutPoly(poly, node, eps);
    if (parts.front) node.front = insertPlane(node.front, parts.front, eps);
    if (parts.back) node.back = insertPlane(node.back, parts.back, eps);
    return node;
  }

  /** The tree of plane pieces. Each poly: { pts, edges, plane: { n, d }, … }. */
  function planeTree(polys, box) {
    const eps = 1e-7 * boxSize(box);
    let root = null;
    polys.forEach((p) => { root = insertPlane(root, p, eps); });
    return root;
  }

  function itemPts(it) { return it.t === 'poly' ? it.pts : it.t === 'seg' ? [it.a, it.b] : [it.p]; }

  function centreOf(it) {
    if (it.t === 'seg') return lerp(it.a, it.b, 0.5);
    if (it.t === 'poly') {
      let x = 0, y = 0, z = 0;
      it.pts.forEach((p) => { x += p[0]; y += p[1]; z += p[2]; });
      return [x / it.pts.length, y / it.pts.length, z / it.pts.length];
    }
    return it.p;
  }

  /**
   * Everything in the order to paint it, far to near, for a camera whose
   * depth grows along g. Items: { t: 'poly', pts, edges } | { t: 'seg', a, b }
   * | { t: 'dot', p } — plus whatever the caller needs to draw them, which
   * is carried along (and copied onto any pieces an item is cut into).
   */
  function sceneOrder(tree, items, g, box) {
    const eps = 1e-7 * boxSize(box);
    const out = [];
    const walk = (node, list) => {
      if (!node) {
        const keyed = list.map((it) => ({ it: it, z: dot(centreOf(it), g) }));
        keyed.sort((a, b) => b.z - a.z);
        keyed.forEach((k) => out.push(k.it));
        return;
      }
      const eyeFront = dot(node.n, g) < 0;
      const front = [], back = [];
      list.forEach((it) => {
        const side = sideOf(itemPts(it), node, eps);
        if (side === 2) {
          if (it.t === 'poly') {
            const parts = cutPoly(it, node, eps);
            if (parts.front) front.push(parts.front);
            if (parts.back) back.push(parts.back);
          } else {
            const ha = distTo(node, it.a), hb = distTo(node, it.b);
            const m = lerp(it.a, it.b, ha / (ha - hb));
            const pa = Object.assign({}, it, { b: m }), pb = Object.assign({}, it, { a: m });
            (ha > 0 ? front : back).push(pa);
            (hb > 0 ? front : back).push(pb);
          }
        } else if (side === 1) front.push(it);
        else if (side === -1) back.push(it);
        else (eyeFront ? front : back).push(it);
      });
      if (eyeFront) {
        walk(node.back, back);
        node.polys.forEach((p) => out.push(p));
        walk(node.front, front);
      } else {
        walk(node.front, front);
        node.polys.forEach((p) => out.push(p));
        walk(node.back, back);
      }
    };
    walk(tree, items);
    return out;
  }

  /** Cut a segment into n pieces, so each sorts on its own among small patches. */
  function pieces(a, b, n, extra) {
    const out = [];
    for (let i = 0; i < n; i++) out.push(Object.assign({ t: 'seg', a: lerp(a, b, i / n), b: lerp(a, b, (i + 1) / n) }, extra || {}));
    return out;
  }

  /* ── Steps and ticks ──────────────────────────────────────────────────── */

  function niceStep(span, target) {
    const raw = span / Math.max(1, target);
    const mag = Math.pow(10, Math.floor(Math.log10(raw)));
    const n = raw / mag;
    return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * mag;
  }
  function ticks(lo, hi, step) {
    const out = [];
    if (!(hi > lo) || !(step > 0)) return out;
    const a = Math.ceil(lo / step - 1e-9), b = Math.floor(hi / step + 1e-9);
    if (b - a > 400) return out;
    for (let k = a; k <= b; k++) out.push(Math.abs(k * step) < step * 1e-9 ? 0 : k * step);
    return out;
  }

  /* ── The document ─────────────────────────────────────────────────────
     Everything a 3D graph is: rows, the box, which grids and labels show,
     and where you were looking. This is what is saved and what a link
     carries, so every load goes through normaliseDoc — a saved row or a
     link someone sent is untrusted input. */

  /* Okabe and Ito's eight colours, chosen to stay distinct for the common
     kinds of colour blindness; the first three (blue, orange, purple) are
     the planes of a three-equation system. The darkest blue is lifted a
     little to read on the dark background. */
  const PALETTE = ['#56b4e9', '#e69f00', '#cc79a7', '#009e73', '#f0e442', '#d55e00', '#3d8fd1', '#b3b3b3'];
  const HEX = /^#[0-9a-f]{6}$/i;
  const MAX_ITEMS = 40;
  const MAX_SRC = 600;

  function newId() { return 'k' + Math.random().toString(36).slice(2, 10); }
  function defaultWin() {
    return { xMin: -10, xMax: 10, yMin: -10, yMax: 10, zMin: -10, zMax: 10, gridXY: true, gridXZ: false, gridYZ: false, box: true, equal: true, key: true };
  }
  function blankItem(n, src) {
    return { id: newId(), type: 'expr', src: src || '', colour: PALETTE[n % PALETTE.length], hidden: false, icpt: true, traces: false, guides: true };
  }
  function blankDoc() {
    return { v: 1, kind: '3d', title: '', win: defaultWin(), view: Object.assign({}, DEFAULT_VIEW), items: [blankItem(0, 'x + y + z = 6')] };
  }

  function num(v, d) { const n = typeof v === 'number' ? v : parseFloat(v); return Number.isFinite(n) ? n : d; }

  function normaliseDoc(raw) {
    const d = blankDoc();
    if (!raw || typeof raw !== 'object') return d;
    d.title = String(raw.title == null ? '' : raw.title).slice(0, 120);
    const w = raw.win && typeof raw.win === 'object' ? raw.win : {};
    AXES.forEach((ax) => {
      const lo = num(w[ax + 'Min'], NaN), hi = num(w[ax + 'Max'], NaN);
      if (Number.isFinite(lo) && Number.isFinite(hi) && hi - lo >= 1e-6 && hi - lo <= 1e7 && Math.abs(lo) <= 1e7 && Math.abs(hi) <= 1e7) {
        d.win[ax + 'Min'] = lo; d.win[ax + 'Max'] = hi;
      }
    });
    ['gridXY', 'gridXZ', 'gridYZ', 'box', 'equal', 'key'].forEach((f) => { if (typeof w[f] === 'boolean') d.win[f] = w[f]; });
    const v = raw.view && typeof raw.view === 'object' ? raw.view : {};
    d.view.yaw = wrapYaw(num(v.yaw, DEFAULT_VIEW.yaw));
    d.view.pitch = Math.max(-90, Math.min(90, num(v.pitch, DEFAULT_VIEW.pitch)));
    d.view.zoom = Math.max(0.2, Math.min(20, num(v.zoom, 1)));
    const items = [];
    const ids = {};
    (Array.isArray(raw.items) ? raw.items : []).slice(0, MAX_ITEMS).forEach((it, n) => {
      if (!it || typeof it !== 'object') return;
      const out = blankItem(n, String(it.src == null ? '' : it.src).slice(0, MAX_SRC));
      if (typeof it.id === 'string' && /^[A-Za-z0-9_-]{1,24}$/.test(it.id) && !ids[it.id]) out.id = it.id;
      ids[out.id] = 1;
      if (HEX.test(it.colour || '')) out.colour = it.colour.toLowerCase();
      ['hidden', 'icpt', 'traces', 'guides'].forEach((f) => { if (typeof it[f] === 'boolean') out[f] = it[f]; });
      items.push(out);
    });
    if (items.length || Array.isArray(raw.items)) d.items = items.length ? items : [blankItem(0, '')];
    return d;
  }

  /* ── A graph in a link ────────────────────────────────────────────────
     #3d=… after the address: the rows, the box, the switches and the view,
     as compact JSON in URL-safe base64. Opening the link rebuilds the graph
     exactly — nothing is stored anywhere. */

  const WIN_BITS = ['gridXY', 'gridXZ', 'gridYZ', 'box', 'equal', 'key'];
  const ITEM_BITS = ['hidden', 'icpt', 'traces', 'guides'];
  const MAX_LINK = 24000;

  function round(v, dp) { const k = Math.pow(10, dp); return Math.round(v * k) / k; }
  function toBase64Url(text) {
    const bytes = new TextEncoder().encode(text);
    let bin = '';
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function fromBase64Url(s) {
    const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4);
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  }

  function encodeShare(doc) {
    const d = normaliseDoc(doc);
    const w = d.win;
    const o = {
      v: 1,
      w: [w.xMin, w.xMax, w.yMin, w.yMax, w.zMin, w.zMax].map((x) => round(x, 6)),
      f: WIN_BITS.reduce((m, k, i) => m | (w[k] ? 1 << i : 0), 0),
      c: [round(d.view.yaw, 2), round(d.view.pitch, 2), round(d.view.zoom, 3)],
      i: d.items.map((it) => [it.src, it.colour.slice(1), ITEM_BITS.reduce((m, k, i) => m | (it[k] ? 1 << i : 0), 0)]),
    };
    if (d.title) o.t = d.title;
    return toBase64Url(JSON.stringify(o));
  }

  /** The doc a link carries, or null if it is damaged. */
  function decodeShare(s) {
    if (typeof s !== 'string' || !s || s.length > MAX_LINK || !/^[A-Za-z0-9_-]+$/.test(s)) return null;
    let o;
    try { o = JSON.parse(fromBase64Url(s)); } catch (e) { return null; }
    if (!o || typeof o !== 'object' || o.v !== 1 || !Array.isArray(o.i)) return null;
    const w = Array.isArray(o.w) ? o.w : [];
    const win = { xMin: w[0], xMax: w[1], yMin: w[2], yMax: w[3], zMin: w[4], zMax: w[5] };
    const f = Number.isInteger(o.f) ? o.f : null;
    if (f != null) WIN_BITS.forEach((k, i) => { win[k] = !!(f & (1 << i)); });
    const c = Array.isArray(o.c) ? o.c : [];
    return normaliseDoc({
      title: typeof o.t === 'string' ? o.t : '',
      win: win,
      view: { yaw: c[0], pitch: c[1], zoom: c[2] },
      items: o.i.map((r) => {
        if (!Array.isArray(r)) return null;
        const bits = Number.isInteger(r[2]) ? r[2] : 0;
        const it = { src: typeof r[0] === 'string' ? r[0] : '', colour: '#' + String(r[1] || '') };
        ITEM_BITS.forEach((k, i) => { it[k] = !!(bits & (1 << i)); });
        return it;
      }),
    });
  }

  window.FluxSpace3D = {
    // vectors
    add: add, sub: sub, mul: mul, dot: dot, cross: cross, len: len, unit: unit, lerp: lerp,
    // numbers and text
    fmtNum: fmtNum, fmtPoint: fmtPoint, planeText: planeText, lineText: lineText,
    // reading rows
    parseRow: parseRow, surfacePoint: surfacePoint, clean: clean, splitTop: splitTop,
    // planes
    intercepts: intercepts, traces: traces, meet2: meet2, meetAll: meetAll, niceDir: niceDir,
    // the box
    planeInBox: planeInBox, lineInBox: lineInBox, surfaceMesh: surfaceMesh, clipPoly: clipPoly,
    inBox: inBox, boxCentre: boxCentre, boxSize: boxSize,
    // the camera and painting order
    camera: camera, DEFAULT_VIEW: DEFAULT_VIEW, PRESETS: PRESETS, wrapYaw: wrapYaw,
    planeTree: planeTree, sceneOrder: sceneOrder, pieces: pieces,
    niceStep: niceStep, ticks: ticks,
    // the document and links
    PALETTE: PALETTE, blankDoc: blankDoc, blankItem: blankItem, normaliseDoc: normaliseDoc, defaultWin: defaultWin,
    encodeShare: encodeShare, decodeShare: decodeShare,
  };
})();
