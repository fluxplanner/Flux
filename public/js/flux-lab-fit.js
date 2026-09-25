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

  /** y = ax² + bx + c, by the normal equations. Needs 3 distinct x values. */
  function quadratic(xs, ys) {
    const n = xs.length;
    if (n < 3) return null;
    let s0 = n, s1 = 0, s2 = 0, s3 = 0, s4 = 0, t0 = 0, t1 = 0, t2 = 0;
    for (let i = 0; i < n; i++) {
      const x = xs[i], y = ys[i], x2 = x * x;
      s1 += x; s2 += x2; s3 += x2 * x; s4 += x2 * x2;
      t0 += y; t1 += x * y; t2 += x2 * y;
    }
    const sol = solve([[s4, s3, s2], [s3, s2, s1], [s2, s1, s0]], [t2, t1, t0]);
    if (!sol) return null;
    const a = sol[0], b = sol[1], c = sol[2];
    const predicted = xs.map((x) => a * x * x + b * x + c);
    return {
      kind: 'quadratic', a, b, c, um: null, uc: null,
      r2: rSquared(ys, predicted),
      predict: (x) => a * x * x + b * x + c,
      equation: (fmt) => `y = ${fmt(a)}x² ${b < 0 ? '−' : '+'} ${fmt(Math.abs(b))}x ${c < 0 ? '−' : '+'} ${fmt(Math.abs(c))}`,
    };
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

    let predict, equation, params;
    if (kind === 'power') {              // ln y = ln a + b ln x
      const a = Math.exp(lin.c), b = lin.m;
      params = { a, b };
      predict = (x) => a * Math.pow(x, b);
      equation = (fmt) => `y = ${fmt(a)}x^${fmt(b)}`;
    } else if (kind === 'exponential') { // ln y = ln a + bx
      const a = Math.exp(lin.c), b = lin.m;
      params = { a, b };
      predict = (x) => a * Math.exp(b * x);
      equation = (fmt) => `y = ${fmt(a)}e^(${fmt(b)}x)`;
    } else {                             // y = a + b ln x
      const a = lin.c, b = lin.m;
      params = { a, b };
      predict = (x) => a + b * Math.log(x);
      equation = (fmt) => `y = ${fmt(a)} ${b < 0 ? '−' : '+'} ${fmt(Math.abs(b))}ln x`;
    }
    const predicted = xs.map(predict);
    return Object.assign({ kind }, params, {
      um: null, uc: null,
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

  const FITS = { linear: linear, proportional: proportional, quadratic: quadratic };

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
        return { error: kind === 'quadratic'
          ? 'A curve needs at least three points with different x values.'
          : 'These points do not define a line — every x is the same.' };
      }
      return { fit: r };
    }
    if (kind === 'power' || kind === 'exponential' || kind === 'logarithmic') {
      const r = transformed(kind, xs, ys);
      if (!r) return { error: 'That fit could not be calculated from these points.' };
      if (r.error) return { error: r.error };
      return { fit: r };
    }
    return { error: 'Unknown fit "' + kind + '".' };
  }

  window.FluxLabFit = {
    fit: fit,
    linear: linear,
    proportional: proportional,
    quadratic: quadratic,
    transformed: transformed,
    minMaxGradient: minMaxGradient,
    resolveUncertainty: resolveUncertainty,
    rSquared: rSquared,
    moments: moments,
    KINDS: [
      { id: 'linear', name: 'Straight line', hint: 'y = mx + c' },
      { id: 'proportional', name: 'Through the origin', hint: 'y = mx' },
      { id: 'quadratic', name: 'Quadratic', hint: 'y = ax² + bx + c' },
      { id: 'power', name: 'Power', hint: 'y = axᵇ' },
      { id: 'exponential', name: 'Exponential', hint: 'y = aeᵇˣ' },
      { id: 'logarithmic', name: 'Logarithmic', hint: 'y = a + b ln x' },
    ],
  };
})();
