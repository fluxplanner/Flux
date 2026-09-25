/* ============================================================================
   FLUX LAB FIT  ·  flux-lab-fit.js
   The maths behind the lab grapher: curve fits, their uncertainties, and the
   max/min gradient method.

   WHY THIS IS ITS OWN FILE
   ------------------------
   A gradient is a number a student writes into a lab report and is marked on.
   A plausible wrong one is worse than no tool at all, because nothing about it
   looks wrong. So the maths lives apart from the drawing: no DOM, no state, no
   side effects — numbers in, numbers out — which means every formula here is
   checked against hand-worked examples in test/unit/lab-fit.test.mjs rather
   than eyeballed on a chart.

   WHAT IT DELIBERATELY DOES NOT DO
   --------------------------------
   It never invents a fit it cannot justify. A power or exponential fit needs
   positive values to take logs of; given a zero or a negative it returns an
   explanation rather than silently dropping the offending rows, because a line
   drawn through five of your seven readings is a lie the chart tells
   convincingly.
   ========================================================================== */
(function () {
  'use strict';

  /** Σ helper — keeps the normal equations readable. */
  function sum(a) { let s = 0; for (let i = 0; i < a.length; i++) s += a[i]; return s; }

  /**
   * The sums every least-squares result here is built from.
   * Taken about the mean (Sxx, Sxy, Syy) rather than raw: steadier numerically
   * for large x, and the form the uncertainty formulas below are written in.
   */
  function moments(xs, ys) {
    const n = xs.length;
    const mx = sum(xs) / n;
    const my = sum(ys) / n;
    let Sxx = 0, Sxy = 0, Syy = 0;
    for (let i = 0; i < n; i++) {
      const dx = xs[i] - mx, dy = ys[i] - my;
      Sxx += dx * dx; Sxy += dx * dy; Syy += dy * dy;
    }
    return { n, mx, my, Sxx, Sxy, Syy };
  }

  /** Coefficient of determination from residuals, so every fit reports it the
      same way — including the curved ones, where R² on the straightened data
      would flatter the result. */
  function rSquared(ys, predicted) {
    const my = sum(ys) / ys.length;
    let ssRes = 0, ssTot = 0;
    for (let i = 0; i < ys.length; i++) {
      ssRes += Math.pow(ys[i] - predicted[i], 2);
      ssTot += Math.pow(ys[i] - my, 2);
    }
    // A perfectly flat dataset has no variance to explain; 1 is the honest answer.
    if (ssTot === 0) return ssRes === 0 ? 1 : 0;
    return 1 - ssRes / ssTot;
  }

  /* ── y = mx + c ─────────────────────────────────────────────────────────
     Standard errors are the textbook ones:
       s²   = Σresid² / (n − 2)      residual variance; 2 dof spent on m and c
       u(m) = √(s² / Sxx)
       u(c) = s · √(1/n + x̄²/Sxx)
     n − 2 is why a two-point "fit" reports no uncertainty: two points define a
     line exactly, leaving nothing to estimate the scatter from. Saying so beats
     dividing by zero and rendering NaN into a lab report. */
  function linear(xs, ys) {
    const { n, mx, my, Sxx, Sxy } = moments(xs, ys);
    if (n < 2) return null;
    if (Sxx === 0) return null;                   // every x identical — vertical
    const m = Sxy / Sxx;
    const c = my - m * mx;
    const predicted = xs.map((x) => m * x + c);
    let ssRes = 0;
    for (let i = 0; i < n; i++) ssRes += Math.pow(ys[i] - predicted[i], 2);
    let um = null, uc = null;
    if (n > 2) {
      const s2 = ssRes / (n - 2);
      um = Math.sqrt(s2 / Sxx);
      uc = Math.sqrt(s2 * (1 / n + (mx * mx) / Sxx));
    }
    return {
      kind: 'linear', m, c, um, uc,
      params: [{ name: 'm', value: m, u: um }, { name: 'c', value: c, u: uc }],
      r2: rSquared(ys, predicted),
      predict: (x) => m * x + c,
      equation: (fmt) => `y = ${fmt(m)}x ${c < 0 ? '−' : '+'} ${fmt(Math.abs(c))}`,
    };
  }

  /* ── y = mx, forced through the origin ──────────────────────────────────
     Used constantly in physics, where theory says the line must pass through
     zero. It is NOT the straight-line fit with c thrown away: the thing being
     minimised is different, so m genuinely differs.
       m    = Σxy / Σx²
       u(m) = √( Σresid² / ((n−1)·Σx²) )     one dof spent, on m alone */
  function proportional(xs, ys) {
    const n = xs.length;
    if (n < 1) return null;
    let sxy = 0, sxx = 0;
    for (let i = 0; i < n; i++) { sxy += xs[i] * ys[i]; sxx += xs[i] * xs[i]; }
    if (sxx === 0) return null;
    const m = sxy / sxx;
    const predicted = xs.map((x) => m * x);
    let ssRes = 0;
    for (let i = 0; i < n; i++) ssRes += Math.pow(ys[i] - predicted[i], 2);
    const um = n > 1 ? Math.sqrt(ssRes / ((n - 1) * sxx)) : null;
    return {
      kind: 'proportional', m, c: 0, um, uc: null,
      params: [{ name: 'm', value: m, u: um }],
      r2: rSquared(ys, predicted),
      predict: (x) => m * x,
      equation: (fmt) => `y = ${fmt(m)}x`,
    };
  }

  /** Solve a small dense system by Gaussian elimination with partial pivoting.
      Only ever 3×3 here, so clarity beats cleverness. */
  function solve(A, b) {
    const n = b.length;
    const M = A.map((row, i) => row.concat([b[i]]));
    for (let col = 0; col < n; col++) {
      let piv = col;
      for (let r = col + 1; r < n; r++) if (Math.abs(M[r][col]) > Math.abs(M[piv][col])) piv = r;
      if (Math.abs(M[piv][col]) < 1e-12) return null;   // singular — no unique fit
      const t = M[col]; M[col] = M[piv]; M[piv] = t;
      for (let r = 0; r < n; r++) {
        if (r === col) continue;
        const f = M[r][col] / M[col][col];
        for (let k = col; k <= n; k++) M[r][k] -= f * M[col][k];
      }
    }
    return M.map((row, i) => row[n] / row[i]);
  }

  /** Inverse of a small matrix, column by column. null if singular. */
  function invert(A) {
    const n = A.length, cols = [];
    for (let j = 0; j < n; j++) {
      const x = solve(A, A.map((_, i) => (i === j ? 1 : 0)));
      if (!x) return null;
      cols.push(x);
    }
    return A.map((_, i) => cols.map((c) => c[i]));
  }

  /** "+ 3.2x" / "− 3.2x": signs that read the way they are written by hand. */
  function term(v, fmt, suffix, first) {
    if (first) return fmt(v) + suffix;
    return (v < 0 ? ' − ' : ' + ') + fmt(Math.abs(v)) + suffix;
  }

  /* ── Fits linear in their parameters: y = Σ pₖ·φₖ(x) ─────────────────
     Quadratic, cubic, inverse and inverse-square are all ordinary least
     squares on a different set of basis functions, so one routine does all
     of them — and gives every parameter its standard error from the
     covariance matrix, s²·(XᵀX)⁻¹, the same way the straight line does. */
  function basisFit(kind, names, basis, xs, ys) {
    const n = xs.length, k = basis.length;
    if (n < k) return null;
    const A = [], b = [];
    for (let i = 0; i < k; i++) { A.push(new Array(k).fill(0)); b.push(0); }
    for (let r = 0; r < n; r++) {
      const row = basis.map((f) => f(xs[r]));
      for (let i = 0; i < k; i++) {
        b[i] += row[i] * ys[r];
        for (let j = 0; j < k; j++) A[i][j] += row[i] * row[j];
      }
    }
    const p = solve(A, b);
    if (!p || p.some((v) => !Number.isFinite(v))) return null;
    const predict = (x) => { let t = 0; for (let i = 0; i < k; i++) t += p[i] * basis[i](x); return t; };
    const predicted = xs.map(predict);
    let ssRes = 0;
    for (let r = 0; r < n; r++) ssRes += Math.pow(ys[r] - predicted[r], 2);
    let us = names.map(() => null);
    if (n > k) {
      const inv = invert(A);
      if (inv) {
        const s2 = ssRes / (n - k);
        us = inv.map((row, i) => Math.sqrt(Math.max(0, row[i] * s2)));
      }
    }
    return {
      kind: kind,
      params: names.map((nm, i) => ({ name: nm, value: p[i], u: us[i] })),
      r2: rSquared(ys, predicted),
      predict: predict,
      values: p,
    };
  }

  /** y = ax² + bx + c. Needs 3 distinct x values. */
  function quadratic(xs, ys) {
    const r = basisFit('quadratic', ['a', 'b', 'c'], [(x) => x * x, (x) => x, () => 1], xs, ys);
    if (!r) return null;
    const [a, b, c] = r.values;
    return Object.assign(r, {
      a, b, c, um: null, uc: null,
      equation: (fmt) => 'y = ' + term(a, fmt, 'x²', true) + term(b, fmt, 'x') + term(c, fmt, ''),
    });
  }

  /** y = ax³ + bx² + cx + d. Needs 4 distinct x values. */
  function cubic(xs, ys) {
    const r = basisFit('cubic', ['a', 'b', 'c', 'd'], [(x) => x * x * x, (x) => x * x, (x) => x, () => 1], xs, ys);
    if (!r) return null;
    const [a, b, c, d] = r.values;
    return Object.assign(r, {
      a, b, c, d,
      equation: (fmt) => 'y = ' + term(a, fmt, 'x³', true) + term(b, fmt, 'x²') + term(c, fmt, 'x') + term(d, fmt, ''),
    });
  }

  /** y = a/x + b and y = a/x² + b — Boyle's law, and anything inverse-square. */
  function inverse(kind, xs, ys) {
    for (let i = 0; i < xs.length; i++) {
      if (xs[i] === 0) return { error: 'An inverse fit divides by x, so no x can be zero — row ' + (i + 1) + ' is 0.' };
    }
    const sq = kind === 'inverseSquare';
    const r = basisFit(kind, ['a', 'b'], [sq ? (x) => 1 / (x * x) : (x) => 1 / x, () => 1], xs, ys);
    if (!r) return null;
    const [a, b] = r.values;
    return Object.assign(r, {
      a, b,
      equation: (fmt) => 'y = ' + fmt(a) + (sq ? '/x²' : '/x') + term(b, fmt, ''),
    });
  }

  /* ── Fits that are not linear in anything: Levenberg–Marquardt ─────────
     A sine wave, a cooling curve with an offset, or any formula typed in by
     hand. Minimises Σ residual² by damped Gauss–Newton steps: large damping
     behaves like careful gradient descent far from the answer, small damping
     like Newton close to it. Derivatives are numerical, so any model works.
     Parameter uncertainties come from the covariance s²·(JᵀJ)⁻¹ at the
     answer, the same quantity the linear fits report. */
  function nonlinear(kind, names, model, p0, xs, ys) {
    const n = xs.length, k = p0.length;
    if (n < k) return { error: 'This fit has ' + k + ' numbers to find, so it needs at least ' + k + ' points.' };
    let p = p0.slice();
    const sse = (q) => {
      let t = 0;
      for (let i = 0; i < n; i++) {
        const r = ys[i] - model(q, xs[i]);
        if (!Number.isFinite(r)) return Infinity;
        t += r * r;
      }
      return t;
    };
    const jac = (q) => {
      const J = [];
      const base = xs.map((x) => model(q, x));
      for (let i = 0; i < n; i++) J.push(new Array(k));
      for (let j = 0; j < k; j++) {
        const h = Math.max(Math.abs(q[j]) * 1e-7, 1e-9);
        const qq = q.slice();
        qq[j] += h;
        for (let i = 0; i < n; i++) J[i][j] = (model(qq, xs[i]) - base[i]) / h;
      }
      return { J: J, base: base };
    };
    let cur = sse(p);
    if (!Number.isFinite(cur)) return { error: 'The starting values give no answer for some readings — try different ones.' };
    let lambda = 1e-3;
    for (let iter = 0; iter < 300; iter++) {
      const { J, base } = jac(p);
      const A = [], g = [];
      for (let a = 0; a < k; a++) { A.push(new Array(k).fill(0)); g.push(0); }
      for (let i = 0; i < n; i++) {
        const r = ys[i] - base[i];
        for (let a = 0; a < k; a++) {
          g[a] += J[i][a] * r;
          for (let b = 0; b < k; b++) A[a][b] += J[i][a] * J[i][b];
        }
      }
      let improved = false;
      while (lambda < 1e14) {
        const D = A.map((row, a) => row.map((v, b) => (a === b ? v * (1 + lambda) + 1e-12 : v)));
        const step = solve(D, g);
        if (step) {
          const next = p.map((v, j) => v + step[j]);
          const s2 = sse(next);
          if (s2 < cur) {
            const gain = cur - s2;
            p = next;
            cur = s2;
            lambda = Math.max(lambda / 10, 1e-12);
            improved = true;
            if (gain < 1e-14 * (cur + 1e-30)) iter = 1e9;   // converged
            break;
          }
        }
        lambda *= 10;
      }
      if (!improved) break;
    }
    const { J } = jac(p);
    const A = [];
    for (let a = 0; a < k; a++) A.push(new Array(k).fill(0));
    for (let i = 0; i < n; i++) for (let a = 0; a < k; a++) for (let b = 0; b < k; b++) A[a][b] += J[i][a] * J[i][b];
    let us = names.map(() => null);
    if (n > k) {
      const inv = invert(A);
      if (inv) us = inv.map((row, i) => Math.sqrt(Math.max(0, row[i] * cur / (n - k))));
    }
    const final = p.slice();
    const predict = (x) => model(final, x);
    return {
      kind: kind,
      params: names.map((nm, i) => ({ name: nm, value: final[i], u: us[i] })),
      values: final,
      r2: rSquared(ys, xs.map(predict)),
      predict: predict,
    };
  }

  /* ── y = A sin(Bx + C) + D ────────────────────────────────────────────
     Iterative fitting lives or dies on its starting guess, and a sine has a
     bad habit of settling on the wrong frequency. So the frequency is found
     first by brute force — for each of a few hundred candidates the rest is
     an ordinary linear fit (A sin + B cos + D), and the best one wins — and
     only then is everything refined together. */
  function sine(xs, ys) {
    const n = xs.length;
    if (n < 4) return { error: 'A sine fit needs at least four points.' };
    const sorted = xs.slice().sort((a, b) => a - b);
    const range = sorted[n - 1] - sorted[0];
    if (!(range > 0)) return { error: 'A sine fit needs readings at different x values.' };
    const gaps = [];
    for (let i = 1; i < n; i++) if (sorted[i] > sorted[i - 1]) gaps.push(sorted[i] - sorted[i - 1]);
    gaps.sort((a, b) => a - b);
    const step = gaps[Math.floor(gaps.length / 2)] || range / n;
    const wLo = Math.PI / range / 2, wHi = Math.PI / step;
    let best = null;
    const N = 500;
    for (let i = 0; i <= N; i++) {
      const w = wLo * Math.pow(wHi / wLo, i / N);
      const r = basisFit('sine', ['s', 'c', 'd'], [(x) => Math.sin(w * x), (x) => Math.cos(w * x), () => 1], xs, ys);
      if (!r) continue;
      let e = 0;
      for (let j = 0; j < n; j++) e += Math.pow(ys[j] - r.predict(xs[j]), 2);
      if (!best || e < best.e) best = { e: e, w: w, s: r.values[0], c: r.values[1], d: r.values[2] };
    }
    if (!best) return { error: 'No sine wave fits these readings.' };
    const model = (q, x) => q[0] * Math.sin(q[1] * x + q[2]) + q[3];
    const r = nonlinear('sine', ['A', 'B', 'C', 'D'], model,
      [Math.hypot(best.s, best.c), best.w, Math.atan2(best.c, best.s), best.d], xs, ys);
    if (r.error) return r;
    let [A, B, C, D] = r.values;
    // One canonical form: positive amplitude and frequency, phase in (−π, π].
    if (B < 0) { B = -B; C = -C + Math.PI; A = -A; }
    if (A < 0) { A = -A; C += Math.PI; }
    C = Math.atan2(Math.sin(C), Math.cos(C));
    r.values = [A, B, C, D];
    r.params.forEach((pp, i) => { pp.value = r.values[i]; });
    r.predict = (x) => A * Math.sin(B * x + C) + D;
    r.equation = (fmt) => 'y = ' + fmt(A) + ' sin(' + fmt(B) + 'x' + term(C, fmt, '') + ')' + term(D, fmt, '');
    return r;
  }

  /* ── Fits done by straightening first ───────────────────────────────────
     Power, exponential and logarithmic are each a straight-line fit on
     transformed data. The transform decides which values are usable, and that
     is the whole risk: the log of a zero or a negative is not a number. Rather
     than quietly discard those rows — leaving a confident curve drawn through
     a subset of the readings — each says which rule was broken and stops. */
  function transformed(kind, xs, ys) {
    const needPosX = kind === 'power' || kind === 'logarithmic';
    const needPosY = kind === 'power' || kind === 'exponential';
    for (let i = 0; i < xs.length; i++) {
      if (needPosX && !(xs[i] > 0)) {
        return { error: `A ${kind} fit takes the log of x, so every x has to be above zero — row ${i + 1} is ${xs[i]}.` };
      }
      if (needPosY && !(ys[i] > 0)) {
        return { error: `A ${kind} fit takes the log of y, so every y has to be above zero — row ${i + 1} is ${ys[i]}.` };
      }
    }
    const tx = xs.map((x) => (needPosX ? Math.log(x) : x));
    const ty = ys.map((y) => (needPosY ? Math.log(y) : y));
    const lin = linear(tx, ty);
    if (!lin) return null;

    let predict, equation, params, list;
    /* Uncertainties come from the straight-line fit on the transformed data.
       For a = e^c the standard error scales with a itself: u(a) = a·u(c). */
    if (kind === 'power') {              // ln y = ln a + b ln x
      const a = Math.exp(lin.c), b = lin.m;
      params = { a, b };
      list = [{ name: 'a', value: a, u: lin.uc == null ? null : a * lin.uc }, { name: 'b', value: b, u: lin.um }];
      predict = (x) => a * Math.pow(x, b);
      equation = (fmt) => `y = ${fmt(a)}x^${fmt(b)}`;
    } else if (kind === 'exponential') { // ln y = ln a + bx
      const a = Math.exp(lin.c), b = lin.m;
      params = { a, b };
      list = [{ name: 'a', value: a, u: lin.uc == null ? null : a * lin.uc }, { name: 'b', value: b, u: lin.um }];
      predict = (x) => a * Math.exp(b * x);
      equation = (fmt) => `y = ${fmt(a)}e^(${fmt(b)}x)`;
    } else {                             // y = a + b ln x
      const a = lin.c, b = lin.m;
      params = { a, b };
      list = [{ name: 'a', value: a, u: lin.uc }, { name: 'b', value: b, u: lin.um }];
      predict = (x) => a + b * Math.log(x);
      equation = (fmt) => `y = ${fmt(a)} ${b < 0 ? '−' : '+'} ${fmt(Math.abs(b))}ln x`;
    }
    const predicted = xs.map(predict);
    return Object.assign({ kind }, params, {
      um: null, uc: null,
      params: list,
      /* R² against the ORIGINAL y values, not the logged ones. The transformed
         figure is almost always higher and would overstate how well the curve
         describes the actual measurements. */
      r2: rSquared(ys, predicted),
      r2Transformed: lin.r2,
      predict, equation,
    });
  }

  /* ── Gradient uncertainty from the error bars ───────────────────────────
     The method IB physics actually asks for, and the reason a spreadsheet
     trendline is not enough: draw the steepest and shallowest lines that still
     pass through the error bars of the first and last points, and halve the
     difference.

     Steepest means starting low on the left and ending high on the right with
     the run as short as the bars allow — so the left point sits at its
     right-hand, lowest corner and the right point at its left-hand, highest
     corner. Shallowest is the mirror image. */
  function minMaxGradient(points) {
    const pts = points.slice().sort((p, q) => p.x - q.x);
    if (pts.length < 2) return null;
    const A = pts[0], B = pts[pts.length - 1];
    const ax = A.x, ay = A.y, adx = Math.abs(A.dx || 0), ady = Math.abs(A.dy || 0);
    const bx = B.x, by = B.y, bdx = Math.abs(B.dx || 0), bdy = Math.abs(B.dy || 0);

    const steepRun = (bx - bdx) - (ax + adx);
    const shallowRun = (bx + bdx) - (ax - adx);
    /* Horizontal bars so wide they overlap: the extremes cross over and the
       method stops meaning anything. Return nothing rather than an infinity. */
    if (steepRun <= 0 || shallowRun <= 0) return null;

    const mMax = ((by + bdy) - (ay - ady)) / steepRun;
    const mMin = ((by - bdy) - (ay + ady)) / shallowRun;
    return {
      mMax, mMin,
      uncertainty: Math.abs(mMax - mMin) / 2,
      steep: { x1: ax + adx, y1: ay - ady, x2: bx - bdx, y2: by + bdy },
      shallow: { x1: ax - adx, y1: ay + ady, x2: bx + bdx, y2: by - bdy },
    };
  }

  /** Absolute uncertainty for one reading, from a whole-column rule. */
  function resolveUncertainty(value, rule) {
    if (!rule || !rule.mode || rule.mode === 'none') return 0;
    const v = Number(rule.value) || 0;
    if (rule.mode === 'percent') return Math.abs(value * v / 100);
    return Math.abs(v);
  }

  const FITS = { linear: linear, proportional: proportional, quadratic: quadratic, cubic: cubic };

  /**
   * One entry point for the UI. Returns { fit } or { error } and never throws:
   * a bad column of pasted data is a normal thing for a student to have, not
   * an exceptional one.
   */
  function fit(kind, points) {
    const usable = (points || []).filter(
      (p) => Number.isFinite(p.x) && Number.isFinite(p.y),
    );
    if (usable.length < 2) {
      return { error: 'Two points with numbers in both columns are needed before anything can be fitted.' };
    }
    const xs = usable.map((p) => p.x), ys = usable.map((p) => p.y);

    if (FITS[kind]) {
      const r = FITS[kind](xs, ys);
      if (!r) {
        if (kind === 'quadratic') return { error: 'A quadratic needs at least three points with different x values.' };
        if (kind === 'cubic') return { error: 'A cubic needs at least four points with different x values.' };
        return { error: 'These points do not define a line — every x is the same.' };
      }
      return { fit: r };
    }
    if (kind === 'inverse' || kind === 'inverseSquare') {
      const r = inverse(kind, xs, ys);
      if (!r) return { error: 'That fit could not be calculated from these points.' };
      if (r.error) return { error: r.error };
      return { fit: r };
    }
    if (kind === 'sine') {
      const r = sine(xs, ys);
      return r.error ? { error: r.error } : { fit: r };
    }
    if (kind === 'power' || kind === 'exponential' || kind === 'logarithmic') {
      const r = transformed(kind, xs, ys);
      if (!r) return { error: 'That fit could not be calculated from these points.' };
      if (r.error) return { error: r.error };
      return { fit: r };
    }
    return { error: 'Unknown fit "' + kind + '".' };
  }

  /* ── Choosing the fit automatically ──────────────────────────────────
     Every fit is tried and scored by AICc — the residual sum of squares,
     penalised for each extra number the model gets to tune, with the
     small-sample correction. R² alone would always crown the most flexible
     curve: a cubic "beats" a straight line on straight-line data by fitting
     the noise. When two models fit exactly, the penalty picks the simpler. */
  function best(points) {
    const usable = (points || []).filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y));
    const n = usable.length;
    if (n < 3) return { error: 'Choosing the best fit needs at least three readings.' };
    const my = usable.reduce((a, p) => a + p.y, 0) / n;
    const syy = usable.reduce((a, p) => a + (p.y - my) * (p.y - my), 0);
    const floor = Math.max(syy, 1e-300) * 1e-12;   // an exact fit is not infinitely good
    let win = null;
    const tried = [];
    KINDS.forEach((k) => {
      const r = fit(k.id, usable);
      if (!r.fit) return;
      const kp = (r.fit.params || []).length || 2;
      if (n - kp - 1 <= 0) return;
      let sse = 0;
      usable.forEach((p) => { sse += Math.pow(p.y - r.fit.predict(p.x), 2); });
      if (!Number.isFinite(sse)) return;
      const aicc = n * Math.log(Math.max(sse, floor) / n) + 2 * kp + (2 * kp * (kp + 1)) / (n - kp - 1);
      tried.push({ kind: k.id, name: k.name, aicc: aicc });
      if (!win || aicc < win.aicc - 1e-9) win = { kind: k.id, name: k.name, aicc: aicc, fit: r.fit };
    });
    if (!win) return { error: 'No fit could be compared on these readings — add a few more.' };
    return { fit: win.fit, kind: win.kind, name: win.name, ranking: tried.sort((a, b) => a.aicc - b.aicc) };
  }

  const KINDS = [
    { id: 'linear', name: 'Straight line', hint: 'y = mx + c' },
    { id: 'proportional', name: 'Through the origin', hint: 'y = mx' },
    { id: 'quadratic', name: 'Quadratic', hint: 'y = ax² + bx + c' },
    { id: 'power', name: 'Power', hint: 'y = axᵇ' },
    { id: 'exponential', name: 'Exponential', hint: 'y = aeᵇˣ' },
    { id: 'logarithmic', name: 'Logarithmic', hint: 'y = a + b ln x' },
    { id: 'cubic', name: 'Cubic', hint: 'y = ax³ + bx² + cx + d' },
    { id: 'inverse', name: 'Inverse', hint: 'y = a/x + b' },
    { id: 'inverseSquare', name: 'Inverse square', hint: 'y = a/x² + b' },
    { id: 'sine', name: 'Sine', hint: 'y = A sin(Bx + C) + D' },
  ];

  window.FluxLabFit = {
    fit: fit,
    best: best,
    linear: linear,
    proportional: proportional,
    quadratic: quadratic,
    cubic: cubic,
    sine: sine,
    nonlinear: nonlinear,
    transformed: transformed,
    minMaxGradient: minMaxGradient,
    resolveUncertainty: resolveUncertainty,
    rSquared: rSquared,
    moments: moments,
    KINDS: KINDS,
  };
})();
