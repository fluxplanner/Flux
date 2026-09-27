/* ════════════════════════════════════════════════════════════════════════
   FLUX · Calculator statistics — flux-ti84-stats.js
   ------------------------------------------------------------------------
   The number-crunching behind the calculator's STAT, DISTR and Finance
   menus, kept apart from the expression engine so it can be tested on its
   own: special functions, the probability distributions, one- and two-
   variable statistics, every regression on STAT ▸ CALC, the hypothesis tests
   and intervals on STAT ▸ TESTS, time-value-of-money, polynomial roots and
   linear systems.

   Results follow the calculator's conventions, not a textbook's, wherever
   the two differ — quartiles by the median-of-halves rule, ExpReg reporting
   r for the straightened data, ±1ᴇ99 standing in for infinity — so a
   student checking against a real handheld sees the same numbers.

   Pure maths: no DOM, no state. Errors are thrown as { ti: 'KIND' } so the
   engine shows them the calculator's way ("ERR:DOMAIN").
   ════════════════════════════════════════════════════════════════════════ */
(function (root) {
  'use strict';

  function fail(kind) { const e = new Error('ERR:' + kind); e.ti = kind; throw e; }

  /* ── Special functions ─────────────────────────────────────────────── */

  const LANCZOS = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313,
    -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];

  /** ln|Γ(x)|, Lanczos (g = 7), good to ~15 digits. */
  function lgamma(x) {
    if (x < 0.5) return Math.log(Math.PI / Math.abs(Math.sin(Math.PI * x))) - lgamma(1 - x);
    x -= 1;
    let a = LANCZOS[0];
    const t = x + 7.5;
    for (let i = 1; i < 9; i++) a += LANCZOS[i] / (x + i);
    return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a);
  }
  function gamma(x) {
    if (x === Math.floor(x) && x <= 0) fail('DOMAIN');
    if (x < 0.5) return Math.PI / (Math.sin(Math.PI * x) * gamma(1 - x));
    if (x === Math.floor(x) && x <= 171) { let f = 1; for (let k = 2; k < x; k++) f *= k; return f; }
    return Math.exp(lgamma(x));
  }

  /** Regularised lower incomplete gamma P(a, x). */
  function gammaP(a, x) {
    if (x <= 0) return 0;
    if (x < a + 1) {
      let sum = 1 / a, del = sum, ap = a;
      for (let n = 0; n < 2000; n++) {
        ap += 1; del *= x / ap; sum += del;
        if (Math.abs(del) < Math.abs(sum) * 1e-16) break;
      }
      return sum * Math.exp(-x + a * Math.log(x) - lgamma(a));
    }
    return 1 - gammaQcf(a, x);
  }
  /** Regularised upper incomplete gamma Q(a, x) = 1 − P, by continued fraction for the tail's precision. */
  function gammaQ(a, x) {
    if (x <= 0) return 1;
    if (x === Infinity) return 0;
    if (x < a + 1) return 1 - gammaP(a, x);
    return gammaQcf(a, x);
  }
  function gammaQcf(a, x) {
    const FPMIN = 1e-300;
    let b = x + 1 - a, c = 1 / FPMIN, d = 1 / b, h = d;
    for (let i = 1; i < 2000; i++) {
      const an = -i * (i - a);
      b += 2;
      d = an * d + b; if (Math.abs(d) < FPMIN) d = FPMIN;
      c = b + an / c; if (Math.abs(c) < FPMIN) c = FPMIN;
      d = 1 / d;
      const del = d * c;
      h *= del;
      if (Math.abs(del - 1) < 1e-16) break;
    }
    return Math.exp(-x + a * Math.log(x) - lgamma(a)) * h;
  }

  /** Regularised incomplete beta I_x(a, b). */
  function betaI(x, a, b) {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    const bt = Math.exp(lgamma(a + b) - lgamma(a) - lgamma(b) + a * Math.log(x) + b * Math.log(1 - x));
    if (x < (a + 1) / (a + b + 2)) return bt * betacf(x, a, b) / a;
    return 1 - bt * betacf(1 - x, b, a) / b;
  }
  function betacf(x, a, b) {
    const FPMIN = 1e-300;
    const qab = a + b, qap = a + 1, qam = a - 1;
    let c = 1, d = 1 - qab * x / qap;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    d = 1 / d;
    let h = d;
    for (let m = 1; m <= 3000; m++) {
      const m2 = 2 * m;
      let aa = m * (b - m) * x / ((qam + m2) * (a + m2));
      d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN;
      c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN;
      d = 1 / d; h *= d * c;
      aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2));
      d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN;
      c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN;
      d = 1 / d;
      const del = d * c;
      h *= del;
      if (Math.abs(del - 1) < 1e-16) break;
    }
    return h;
  }

  /** erfc(x), through the incomplete gamma so the far tails keep their digits. */
  function erfc(x) {
    if (x === Infinity) return 0;
    if (x < 0) return 2 - erfc(-x);
    return gammaQ(0.5, x * x);
  }
  /** Φ(z), the standard normal CDF. */
  function Phi(z) {
    if (z === Infinity) return 1;
    if (z === -Infinity) return 0;
    return 0.5 * erfc(-z / Math.SQRT2);
  }
  /** P(lo < Z < hi), computed from the nearer tail so a sliver far out is not lost to 1 − 1. */
  function PhiBetween(lo, hi) {
    if (lo > hi) return -PhiBetween(hi, lo);
    if (lo >= 0) return 0.5 * (erfc(lo / Math.SQRT2) - erfc(hi / Math.SQRT2));
    if (hi <= 0) return 0.5 * (erfc(-hi / Math.SQRT2) - erfc(-lo / Math.SQRT2));
    return 1 - 0.5 * erfc(-lo / Math.SQRT2) - 0.5 * erfc(hi / Math.SQRT2);
  }

  /** The standard normal quantile: Acklam's approximation, then one Halley step against Φ. */
  function invPhi(p) {
    if (!(p > 0 && p < 1)) fail('DOMAIN');
    const a = [-3.969683028665376e+01, 2.209460984245205e+02, -2.759285104469687e+02, 1.383577518672690e+02, -3.066479806614716e+01, 2.506628277459239e+00];
    const b = [-5.447609879822406e+01, 1.615858368580409e+02, -1.556989798598866e+02, 6.680131188771972e+01, -1.328068155288572e+01];
    const c = [-7.784894002430293e-03, -3.223964580411365e-01, -2.400758277161838e+00, -2.549732539343734e+00, 4.374664141464968e+00, 2.938163982698783e+00];
    const d = [7.784695709041462e-03, 3.224671290700398e-01, 2.445134137142996e+00, 3.754408661907416e+00];
    const lo = 0.02425, hi = 1 - lo;
    let x;
    if (p < lo) {
      const q = Math.sqrt(-2 * Math.log(p));
      x = (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
    } else if (p <= hi) {
      const q = p - 0.5, r = q * q;
      x = (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
    } else {
      const q = Math.sqrt(-2 * Math.log(1 - p));
      x = -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
    }
    for (let k = 0; k < 2; k++) {
      // Φ(x) − p, from the lower tail below ½ and the upper tail above, so neither end loses digits.
      const e = p < 0.5 ? Phi(x) - p : (1 - p) - 0.5 * erfc(x / Math.SQRT2);
      const u = e * Math.sqrt(2 * Math.PI) * Math.exp(x * x / 2);
      x = x - u / (1 + x * u / 2);
    }
    return x;
  }

  /* ── Distributions (DISTR) ──────────────────────────────────────────── */

  const BIG = 1e99;
  const clampInf = (v) => (v >= BIG ? Infinity : v <= -BIG ? -Infinity : v);

  function normalpdf(x, mu, sigma) {
    mu = mu == null ? 0 : mu; sigma = sigma == null ? 1 : sigma;
    if (!(sigma > 0)) fail('DOMAIN');
    const z = (x - mu) / sigma;
    return Math.exp(-z * z / 2) / (sigma * Math.sqrt(2 * Math.PI));
  }
  function normalcdf(lo, hi, mu, sigma) {
    mu = mu == null ? 0 : mu; sigma = sigma == null ? 1 : sigma;
    if (!(sigma > 0)) fail('DOMAIN');
    return PhiBetween((clampInf(lo) - mu) / sigma, (clampInf(hi) - mu) / sigma);
  }
  /** invNorm(area [,μ, σ [, tail]]): tail 'LEFT' (default), 'CENTER' or 'RIGHT', as on the CE. */
  function invNorm(area, mu, sigma, tail) {
    mu = mu == null ? 0 : mu; sigma = sigma == null ? 1 : sigma;
    if (!(sigma > 0) || !(area > 0 && area < 1)) fail('DOMAIN');
    const t = tail || 'LEFT';
    if (t === 'CENTER') { const z = invPhi(0.5 + area / 2); return [mu - z * sigma, mu + z * sigma]; }
    const z = invPhi(t === 'RIGHT' ? 1 - area : area);
    return mu + z * sigma;
  }

  function tpdf(x, df) {
    if (!(df > 0)) fail('DOMAIN');
    return Math.exp(lgamma((df + 1) / 2) - lgamma(df / 2) - 0.5 * Math.log(df * Math.PI) - (df + 1) / 2 * Math.log(1 + x * x / df));
  }
  /** P(T ≤ t). */
  function tCDF(t, df) {
    if (t === Infinity) return 1;
    if (t === -Infinity) return 0;
    const x = df / (df + t * t);
    const tail = 0.5 * betaI(x, df / 2, 0.5);
    return t > 0 ? 1 - tail : tail;
  }
  /** P(|T| ≥ |t|)/… — the upper tail of |t|, without cancellation. */
  function tUpper(t, df) { return 0.5 * betaI(df / (df + t * t), df / 2, 0.5); }
  function tcdf(lo, hi, df) {
    if (!(df > 0)) fail('DOMAIN');
    lo = clampInf(lo); hi = clampInf(hi);
    if (lo >= 0) return tUpperSigned(lo, df) - tUpperSigned(hi, df);
    if (hi <= 0) return tUpperSigned(-hi, df) - tUpperSigned(-lo, df);
    return 1 - tUpperSigned(-lo, df) - tUpperSigned(hi, df);
  }
  function tUpperSigned(t, df) { return t === Infinity ? 0 : tUpper(t, df); }
  function invT(area, df) {
    if (!(df > 0) || !(area > 0 && area < 1)) fail('DOMAIN');
    return invertCDF((t) => tCDF(t, df), area, invPhi(area), (t) => tpdf(t, df));
  }

  function chi2pdf(x, df) {
    if (!(df > 0)) fail('DOMAIN');
    if (x < 0) return 0;
    if (x === 0) return df === 2 ? 0.5 : df < 2 ? Infinity : 0;
    const k = df / 2;
    return Math.exp((k - 1) * Math.log(x) - x / 2 - k * Math.LN2 - lgamma(k));
  }
  function chi2cdf(lo, hi, df) {
    if (!(df > 0)) fail('DOMAIN');
    lo = Math.max(0, clampInf(lo)); hi = clampInf(hi);
    if (hi <= lo) return 0;
    // From whichever end keeps the digits.
    const a = df / 2;
    const up = (v) => (v === Infinity ? 0 : gammaQ(a, v / 2));
    return up(lo) - up(hi);
  }
  function Fpdf(x, d1, d2) {
    if (!(d1 > 0 && d2 > 0)) fail('DOMAIN');
    if (x < 0) return 0;
    if (x === 0) return d1 === 2 ? 1 : d1 < 2 ? Infinity : 0;
    return Math.exp(0.5 * (d1 * Math.log(d1 * x) + d2 * Math.log(d2) - (d1 + d2) * Math.log(d1 * x + d2))
      - Math.log(x) - (lgamma(d1 / 2) + lgamma(d2 / 2) - lgamma((d1 + d2) / 2)));
  }
  function FCDF(x, d1, d2) {
    if (x <= 0) return 0;
    if (x === Infinity) return 1;
    return betaI(d1 * x / (d1 * x + d2), d1 / 2, d2 / 2);
  }
  function FUpper(x, d1, d2) {
    if (x <= 0) return 1;
    if (x === Infinity) return 0;
    return betaI(d2 / (d2 + d1 * x), d2 / 2, d1 / 2);
  }
  function Fcdf(lo, hi, d1, d2) {
    if (!(d1 > 0 && d2 > 0)) fail('DOMAIN');
    lo = Math.max(0, clampInf(lo)); hi = clampInf(hi);
    if (hi <= lo) return 0;
    return FUpper(lo, d1, d2) - FUpper(hi, d1, d2);
  }

  function lchoose(n, k) { return lgamma(n + 1) - lgamma(k + 1) - lgamma(n - k + 1); }
  function checkInt(v, lo) { if (v !== Math.floor(v) || v < lo) fail('DOMAIN'); }
  function binomPoint(n, p, x) {
    if (x < 0 || x > n || x !== Math.floor(x)) return 0;
    if (p === 0) return x === 0 ? 1 : 0;
    if (p === 1) return x === n ? 1 : 0;
    return Math.exp(lchoose(n, x) + x * Math.log(p) + (n - x) * Math.log(1 - p));
  }
  function binompdf(n, p, x) {
    checkInt(n, 0); if (!(p >= 0 && p <= 1)) fail('DOMAIN');
    if (x == null) { const out = []; for (let k = 0; k <= n; k++) out.push(binomPoint(n, p, k)); return out; }
    return binomPoint(n, p, x);
  }
  function binomcdf(n, p, x) {
    checkInt(n, 0); if (!(p >= 0 && p <= 1)) fail('DOMAIN');
    const cum = (lim) => {
      const top = Math.min(n, Math.floor(lim));
      if (top < 0) return 0;
      if (top >= n) return 1;
      // Summed from the smaller side, the rest by complement.
      return 1 - betaI(p, top + 1, n - top);
    };
    if (x == null) { const out = []; for (let k = 0; k <= n; k++) out.push(cum(k)); return out; }
    return cum(x);
  }
  function invBinom(area, n, p) {
    checkInt(n, 0); if (!(p >= 0 && p <= 1) || !(area >= 0 && area <= 1)) fail('DOMAIN');
    for (let k = 0; k <= n; k++) if (binomcdf(n, p, k) >= area - 1e-13) return k;
    return n;
  }
  function poissonPoint(mu, x) {
    if (x < 0 || x !== Math.floor(x)) return 0;
    return Math.exp(-mu + x * Math.log(mu) - lgamma(x + 1));
  }
  function poissonpdf(mu, x) { if (!(mu > 0)) fail('DOMAIN'); return poissonPoint(mu, x); }
  function poissoncdf(mu, x) {
    if (!(mu > 0)) fail('DOMAIN');
    const k = Math.floor(x);
    if (k < 0) return 0;
    return gammaQ(k + 1, mu);
  }
  function geometpdf(p, x) {
    if (!(p > 0 && p <= 1)) fail('DOMAIN');
    if (x < 1 || x !== Math.floor(x)) return 0;
    return p * Math.pow(1 - p, x - 1);
  }
  function geometcdf(p, x) {
    if (!(p > 0 && p <= 1)) fail('DOMAIN');
    if (x < 1) return 0;
    return 1 - Math.pow(1 - p, Math.floor(x));
  }

  /** Solve cdf(x) = p for a continuous distribution: bracket, bisect, then Newton. */
  function invertCDF(cdf, p, guess, pdf) {
    let lo = guess - 1, hi = guess + 1;
    for (let k = 0; k < 200 && cdf(lo) > p; k++) lo -= Math.max(1, Math.abs(lo));
    for (let k = 0; k < 200 && cdf(hi) < p; k++) hi += Math.max(1, Math.abs(hi));
    for (let k = 0; k < 200; k++) {
      const mid = (lo + hi) / 2;
      if (cdf(mid) < p) lo = mid; else hi = mid;
      if (hi - lo < 1e-12 * Math.max(1, Math.abs(mid))) break;
    }
    let x = (lo + hi) / 2;
    if (pdf) for (let k = 0; k < 3; k++) { const d = pdf(x); if (d > 0) x -= (cdf(x) - p) / d; }
    return x;
  }

  /* ── One- and two-variable statistics ───────────────────────────────── */

  /** Frequencies as whole or real non-negative weights; the calculator allows both. */
  function weights(xs, fs) {
    if (fs == null) return xs.map(() => 1);
    if (fs.length !== xs.length) fail('DIM MISMATCH');
    fs.forEach((f) => { if (!(f >= 0)) fail('STAT'); });
    return fs;
  }
  /** Median of a sorted, weighted sample (weights must be whole numbers to split halves exactly). */
  function sortedExpand(xs, ws) {
    const pairs = xs.map((x, i) => [x, ws[i]]).filter((p) => p[1] > 0).sort((a, b) => a[0] - b[0]);
    const whole = pairs.every((p) => p[1] === Math.floor(p[1]));
    if (!whole) return null;
    const out = [];
    pairs.forEach((p) => { for (let k = 0; k < p[1]; k++) out.push(p[0]); });
    return out;
  }
  function medianSorted(s) {
    const n = s.length;
    if (!n) return NaN;
    return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2;
  }
  /** Quartiles the TI way: medians of the halves, leaving the middle value out when n is odd. */
  function quartiles(s) {
    const n = s.length;
    const med = medianSorted(s);
    if (n < 2) return { q1: NaN, med: med, q3: NaN };
    const half = Math.floor(n / 2);
    return { q1: medianSorted(s.slice(0, half)), med: med, q3: medianSorted(s.slice(n - half)) };
  }

  function oneVar(xs, fs) {
    if (!xs.length) fail('INVALID DIM');
    const ws = weights(xs, fs);
    let n = 0, sx = 0, sx2 = 0, min = Infinity, max = -Infinity;
    xs.forEach((x, i) => {
      const w = ws[i];
      if (w <= 0) return;
      n += w; sx += w * x; sx2 += w * x * x;
      if (x < min) min = x; if (x > max) max = x;
    });
    if (n <= 0) fail('STAT');
    const mean = sx / n;
    let ss = 0;
    xs.forEach((x, i) => { ss += ws[i] * (x - mean) * (x - mean); });
    const s = sortedExpand(xs, ws);
    const q = s ? quartiles(s) : { q1: NaN, med: NaN, q3: NaN };
    return {
      mean: mean, sum: sx, sum2: sx2,
      Sx: n > 1 ? Math.sqrt(ss / (n - 1)) : NaN, sigma: Math.sqrt(ss / n),
      n: n, min: min, q1: q.q1, med: q.med, q3: q.q3, max: max,
    };
  }

  function twoVar(xs, ys, fs) {
    if (xs.length !== ys.length) fail('DIM MISMATCH');
    if (!xs.length) fail('INVALID DIM');
    const ws = weights(xs, fs);
    const ox = oneVar(xs, ws), oy = oneVar(ys, ws);
    let sxy = 0;
    xs.forEach((x, i) => { sxy += ws[i] * x * ys[i]; });
    return {
      mean: ox.mean, sum: ox.sum, sum2: ox.sum2, Sx: ox.Sx, sigma: ox.sigma,
      ymean: oy.mean, ysum: oy.sum, ysum2: oy.sum2, Sy: oy.Sx, sigmay: oy.sigma,
      sxy: sxy, n: ox.n, minX: ox.min, maxX: ox.max, minY: oy.min, maxY: oy.max,
    };
  }

  /* ── Regressions (STAT ▸ CALC) ──────────────────────────────────────── */

  function linFit(xs, ys, ws) {
    let n = 0, sx = 0, sy = 0;
    xs.forEach((x, i) => { n += ws[i]; sx += ws[i] * x; sy += ws[i] * ys[i]; });
    const mx = sx / n, my = sy / n;
    let sxx = 0, syy = 0, sxy = 0;
    xs.forEach((x, i) => {
      const dx = x - mx, dy = ys[i] - my;
      sxx += ws[i] * dx * dx; syy += ws[i] * dy * dy; sxy += ws[i] * dx * dy;
    });
    if (sxx === 0) fail('DIVIDE BY 0');
    const slope = sxy / sxx;
    const r = syy === 0 ? 1 : sxy / Math.sqrt(sxx * syy);
    return { slope: slope, intercept: my - slope * mx, r: r, n: n, sxx: sxx, syy: syy, sxy: sxy, mx: mx, my: my };
  }

  /** Weighted polynomial least squares through the normal equations, on centred x for conditioning. */
  function polyFit(xs, ys, ws, deg) {
    const pts = xs.filter((x, i) => ws[i] > 0).length;
    if (pts < deg + 1) fail('STAT');
    let n = 0, mx = 0;
    xs.forEach((x, i) => { n += ws[i]; mx += ws[i] * x; });
    mx /= n;
    let sc = 0;
    xs.forEach((x) => { sc = Math.max(sc, Math.abs(x - mx)); });
    sc = sc || 1;
    const m = deg + 1;
    const A = [];
    for (let r = 0; r < m; r++) { A.push(new Array(m + 1).fill(0)); }
    xs.forEach((x, i) => {
      const w = ws[i];
      if (!w) return;
      const u = (x - mx) / sc;
      const pw = [1];
      for (let k = 1; k <= 2 * deg; k++) pw.push(pw[k - 1] * u);
      for (let r = 0; r < m; r++) {
        for (let c = 0; c < m; c++) A[r][c] += w * pw[r + c];
        A[r][m] += w * pw[r] * ys[i];
      }
    });
    const cu = solveLinear(A);                   // coefficients in u, lowest power first
    if (!cu) fail('SINGULAR MAT');
    // Expand p(u) with u = (x − mx)/sc back into powers of x.
    const cx = new Array(m).fill(0);
    for (let k = 0; k < m; k++) {
      const ck = cu[k] / Math.pow(sc, k);
      // (x − mx)^k = Σ C(k,j) x^j (−mx)^(k−j)
      for (let j = 0; j <= k; j++) cx[j] += ck * binom(k, j) * Math.pow(-mx, k - j);
    }
    const f = (x) => { let y = 0; for (let k = m - 1; k >= 0; k--) y = y * x + cx[k]; return y; };
    return { coeffs: cx.slice().reverse(), fn: f, R2: rSquared(xs, ys, ws, f) };
  }
  function binom(n, k) { let r = 1; for (let i = 1; i <= k; i++) r = r * (n - k + i) / i; return Math.round(r); }
  function rSquared(xs, ys, ws, f) {
    let n = 0, my = 0;
    ys.forEach((y, i) => { n += ws[i]; my += ws[i] * y; });
    my /= n;
    let res = 0, tot = 0;
    xs.forEach((x, i) => { const e = ys[i] - f(x); res += ws[i] * e * e; tot += ws[i] * (ys[i] - my) * (ys[i] - my); });
    return tot === 0 ? 1 : 1 - res / tot;
  }

  /** Gauss–Jordan on an augmented matrix; null if singular. */
  function solveLinear(Aug) {
    const A = Aug.map((r) => r.slice());
    const n = A.length;
    for (let c = 0; c < n; c++) {
      let p = c;
      for (let r = c + 1; r < n; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r;
      if (Math.abs(A[p][c]) < 1e-300) return null;
      [A[c], A[p]] = [A[p], A[c]];
      for (let r = 0; r < n; r++) {
        if (r === c) continue;
        const f = A[r][c] / A[c][c];
        for (let k = c; k <= n; k++) A[r][k] -= f * A[c][k];
      }
    }
    return A.map((r, i) => r[n] / A[i][i]);
  }

  /** Levenberg–Marquardt on a model f(params, x); returns the fitted parameters. */
  function levenberg(model, p0, xs, ys, ws, iters) {
    let p = p0.slice(), lambda = 1e-3;
    const m = p.length;
    const sse = (q) => { let s = 0; xs.forEach((x, i) => { const e = ys[i] - model(q, x); s += ws[i] * e * e; }); return s; };
    let cur = sse(p);
    if (!Number.isFinite(cur)) return null;
    for (let it = 0; it < (iters || 400); it++) {
      const J = [], r = [];
      xs.forEach((x, i) => {
        if (!ws[i]) return;
        const f0 = model(p, x);
        const row = [];
        for (let k = 0; k < m; k++) {
          const h = 1e-7 * Math.max(1, Math.abs(p[k]));
          const q = p.slice(); q[k] += h;
          row.push((model(q, x) - f0) / h * Math.sqrt(ws[i]));
        }
        J.push(row); r.push((ys[i] - f0) * Math.sqrt(ws[i]));
      });
      const JtJ = [], Jtr = new Array(m).fill(0);
      for (let a = 0; a < m; a++) { JtJ.push(new Array(m).fill(0)); }
      J.forEach((row, i) => {
        for (let a = 0; a < m; a++) {
          Jtr[a] += row[a] * r[i];
          for (let b = 0; b < m; b++) JtJ[a][b] += row[a] * row[b];
        }
      });
      let improved = false;
      for (let tries = 0; tries < 12; tries++) {
        const Aug = JtJ.map((row, a) => row.map((v, b) => v + (a === b ? lambda * (v || 1) : 0)).concat([Jtr[a]]));
        const step = solveLinear(Aug);
        if (!step) { lambda *= 10; continue; }
        const q = p.map((v, k) => v + step[k]);
        const s = sse(q);
        if (Number.isFinite(s) && s < cur) {
          const done = (cur - s) <= 1e-15 * Math.max(cur, 1e-300);
          p = q; cur = s; lambda = Math.max(lambda / 10, 1e-12); improved = true;
          if (done) return p;
          break;
        }
        lambda *= 10;
      }
      if (!improved) break;
    }
    return p;
  }

  /**
   * Every STAT ▸ CALC regression. kind:
   *   'LinReg(ax+b)' 'LinReg(a+bx)' 'Med-Med' 'QuadReg' 'CubicReg' 'QuartReg'
   *   'LnReg' 'ExpReg' 'PwrReg' 'Logistic' 'SinReg'
   * Returns { kind, eq: "y=ax+b" (the form), coef: {a,b,…}, r?, r2?, R2?, fn }.
   */
  function regress(kind, xs, ys, fs, opts) {
    if (xs.length !== ys.length) fail('DIM MISMATCH');
    const ws = weights(xs, fs);
    const pts = xs.filter((x, i) => ws[i] > 0).length;
    if (pts < 2) fail('STAT');
    const o = opts || {};
    switch (kind) {
      case 'LinReg(ax+b)': case 'LinReg(a+bx)': {
        const L = linFit(xs, ys, ws);
        const fn = (x) => L.slope * x + L.intercept;
        const coef = kind === 'LinReg(ax+b)' ? { a: L.slope, b: L.intercept } : { a: L.intercept, b: L.slope };
        return { kind: kind, eq: kind === 'LinReg(ax+b)' ? 'y=ax+b' : 'y=a+bx', coef: coef, r: L.r, r2: L.r * L.r, fn: fn, lin: L };
      }
      case 'Med-Med': {
        if (pts < 3) fail('STAT');
        const s = sortedPairs(xs, ys, ws);
        const n = s.length, base = Math.floor(n / 3), extra = n % 3;
        // n mod 3 = 1: the middle group takes the extra point; = 2: the outer groups do.
        const sizes = extra === 0 ? [base, base, base] : extra === 1 ? [base, base + 1, base] : [base + 1, base, base + 1];
        const g1 = s.slice(0, sizes[0]), g2 = s.slice(sizes[0], sizes[0] + sizes[1]), g3 = s.slice(sizes[0] + sizes[1]);
        const sp = (g) => [medianSorted(g.map((q) => q[0]).sort((a, b) => a - b)), medianSorted(g.map((q) => q[1]).sort((a, b) => a - b))];
        const [x1, y1] = sp(g1), [x2, y2] = sp(g2), [x3, y3] = sp(g3);
        if (x3 === x1) fail('DIVIDE BY 0');
        const a = (y3 - y1) / (x3 - x1);
        const b = ((y1 - a * x1) + (y2 - a * x2) + (y3 - a * x3)) / 3;
        return { kind: kind, eq: 'y=ax+b', coef: { a: a, b: b }, fn: (x) => a * x + b };
      }
      case 'QuadReg': case 'CubicReg': case 'QuartReg': {
        const deg = kind === 'QuadReg' ? 2 : kind === 'CubicReg' ? 3 : 4;
        const P = polyFit(xs, ys, ws, deg);
        const names = 'abcde';
        const coef = {};
        P.coeffs.forEach((c, i) => { coef[names[i]] = c; });
        const eq = deg === 2 ? 'y=ax²+bx+c' : deg === 3 ? 'y=ax³+bx²+cx+d' : 'y=ax⁴+bx³+cx²+dx+e';
        return { kind: kind, eq: eq, coef: coef, R2: P.R2, fn: P.fn };
      }
      case 'LnReg': {
        xs.forEach((x, i) => { if (ws[i] > 0 && !(x > 0)) fail('DOMAIN'); });
        const L = linFit(xs.map(Math.log), ys, ws);
        const a = L.intercept, b = L.slope;
        return { kind: kind, eq: 'y=a+b ln x', coef: { a: a, b: b }, r: L.r, r2: L.r * L.r, fn: (x) => a + b * Math.log(x) };
      }
      case 'ExpReg': {
        ys.forEach((y, i) => { if (ws[i] > 0 && !(y > 0)) fail('DOMAIN'); });
        const L = linFit(xs, ys.map(Math.log), ws);
        const a = Math.exp(L.intercept), b = Math.exp(L.slope);
        return { kind: kind, eq: 'y=a*b^x', coef: { a: a, b: b }, r: L.r, r2: L.r * L.r, fn: (x) => a * Math.pow(b, x) };
      }
      case 'PwrReg': {
        xs.forEach((x, i) => { if (ws[i] > 0 && !(x > 0 && ys[i] > 0)) fail('DOMAIN'); });
        const L = linFit(xs.map(Math.log), ys.map(Math.log), ws);
        const a = Math.exp(L.intercept), b = L.slope;
        return { kind: kind, eq: 'y=a*x^b', coef: { a: a, b: b }, r: L.r, r2: L.r * L.r, fn: (x) => a * Math.pow(x, b) };
      }
      case 'Logistic': {
        if (pts < 3) fail('STAT');
        const maxY = Math.max.apply(null, ys);
        const model = (q, x) => q[2] / (1 + q[0] * Math.exp(-q[1] * x));
        let best = null;
        [1.01, 1.1, 1.5, 2].forEach((k) => {
          const c0 = maxY * k;
          const pts2 = [];
          xs.forEach((x, i) => { const t = c0 / ys[i] - 1; if (ws[i] > 0 && t > 0) pts2.push([x, Math.log(t)]); });
          if (pts2.length < 2) return;
          let L;
          try { L = linFit(pts2.map((q) => q[0]), pts2.map((q) => q[1]), pts2.map(() => 1)); } catch (e) { return; }
          const p = levenberg(model, [Math.exp(L.intercept), -L.slope, c0], xs, ys, ws, 600);
          if (!p) return;
          const s = sseOf(model, p, xs, ys, ws);
          if (Number.isFinite(s) && (!best || s < best.s)) best = { p: p, s: s };
        });
        if (!best) fail('SINGULAR MAT');
        const [a, b, c] = best.p;
        return { kind: kind, eq: 'y=c/(1+a*e^(-bx))', coef: { a: a, b: b, c: c }, fn: (x) => c / (1 + a * Math.exp(-b * x)) };
      }
      case 'SinReg': {
        if (pts < 4) fail('STAT');
        const n = xs.length;
        let my = 0, tw = 0;
        ys.forEach((y, i) => { my += ws[i] * y; tw += ws[i]; });
        my /= tw;
        const amp = (Math.max.apply(null, ys) - Math.min.apply(null, ys)) / 2 || 1;
        const span = Math.max.apply(null, xs) - Math.min.apply(null, xs) || 1;
        const model = (q, x) => q[0] * Math.sin(q[1] * x + q[2]) + q[3];
        // A period may be given (as on the calculator); otherwise try a spread of them.
        const periods = o.period ? [o.period] : [];
        if (!o.period) for (let k = 1; k <= Math.max(8, n); k++) periods.push(2 * span / k);
        let best = null;
        periods.forEach((per) => {
          const b = 2 * Math.PI / per;
          // For a fixed b the model is linear in (A sin bx + B cos bx + d).
          const Aug = [[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]];
          xs.forEach((x, i) => {
            const w = ws[i], s = Math.sin(b * x), c = Math.cos(b * x), row = [s, c, 1];
            for (let r = 0; r < 3; r++) { for (let cc = 0; cc < 3; cc++) Aug[r][cc] += w * row[r] * row[cc]; Aug[r][3] += w * row[r] * ys[i]; }
          });
          const sol = solveLinear(Aug);
          if (!sol) return;
          const A0 = Math.hypot(sol[0], sol[1]) || amp, c0 = Math.atan2(sol[1], sol[0]);
          const p = levenberg(model, [A0, b, c0, sol[2]], xs, ys, ws, 400);
          if (!p) return;
          const s = sseOf(model, p, xs, ys, ws);
          if (Number.isFinite(s) && (!best || s < best.s - 1e-12)) best = { p: p, s: s };
        });
        if (!best) fail('SINGULAR MAT');
        let [a, b, c, d] = best.p;
        // Report it the calculator's way: a > 0 and b > 0, c in (−π, π].
        if (b < 0) { b = -b; c = -c; a = -a; }
        if (a < 0) { a = -a; c += Math.PI; }
        c = Math.atan2(Math.sin(c), Math.cos(c));
        return { kind: kind, eq: 'y=a*sin(bx+c)+d', coef: { a: a, b: b, c: c, d: d }, fn: (x) => a * Math.sin(b * x + c) + d };
      }
      default: fail('SYNTAX');
    }
    return null;
  }
  function sseOf(model, p, xs, ys, ws) { let s = 0; xs.forEach((x, i) => { const e = ys[i] - model(p, x); s += ws[i] * e * e; }); return s; }
  function sortedPairs(xs, ys, ws) {
    const out = [];
    xs.forEach((x, i) => { for (let k = 0; k < Math.round(ws[i]); k++) out.push([x, ys[i]]); });
    return out.sort((a, b) => a[0] - b[0]);
  }

  /* ── Hypothesis tests and intervals (STAT ▸ TESTS) ─────────────────── */

  /** p-value for a statistic with CDF F under an alternative: 'ne' | 'lt' | 'gt'. */
  function pValue(alt, lower, upper) {
    // lower = P(X ≤ stat), upper = P(X ≥ stat)
    if (alt === 'lt') return lower;
    if (alt === 'gt') return upper;
    return Math.min(1, 2 * Math.min(lower, upper));
  }
  const zTails = (z) => [Phi(z), Phi(-z)];
  const tTails = (t, df) => [t <= 0 ? tUpper(t, df) : 1 - tUpper(t, df), t >= 0 ? tUpper(t, df) : 1 - tUpper(t, df)];

  function zTest(mu0, sigma, xbar, n, alt) {
    if (!(sigma > 0 && n > 0)) fail('DOMAIN');
    const z = (xbar - mu0) / (sigma / Math.sqrt(n));
    const [lo, up] = zTails(z);
    return { z: z, p: pValue(alt, lo, up), xbar: xbar, n: n };
  }
  function tTest(mu0, xbar, sx, n, alt) {
    if (!(sx > 0 && n > 1)) fail('DOMAIN');
    const df = n - 1, t = (xbar - mu0) / (sx / Math.sqrt(n));
    const [lo, up] = tTails(t, df);
    return { t: t, p: pValue(alt, lo, up), df: df, xbar: xbar, sx: sx, n: n };
  }
  function twoSampZTest(s1, s2, x1, n1, x2, n2, alt) {
    const se = Math.sqrt(s1 * s1 / n1 + s2 * s2 / n2);
    if (!(se > 0)) fail('DOMAIN');
    const z = (x1 - x2) / se;
    const [lo, up] = zTails(z);
    return { z: z, p: pValue(alt, lo, up), x1: x1, x2: x2, n1: n1, n2: n2 };
  }
  function twoSampT(x1, s1, n1, x2, s2, n2, pooled) {
    if (!(n1 > 1 && n2 > 1)) fail('DOMAIN');
    if (pooled) {
      const df = n1 + n2 - 2;
      const sp = Math.sqrt(((n1 - 1) * s1 * s1 + (n2 - 1) * s2 * s2) / df);
      return { se: sp * Math.sqrt(1 / n1 + 1 / n2), df: df, sxp: sp };
    }
    const v1 = s1 * s1 / n1, v2 = s2 * s2 / n2;
    const df = (v1 + v2) * (v1 + v2) / (v1 * v1 / (n1 - 1) + v2 * v2 / (n2 - 1));
    return { se: Math.sqrt(v1 + v2), df: df };
  }
  function twoSampTTest(x1, s1, n1, x2, s2, n2, alt, pooled) {
    const k = twoSampT(x1, s1, n1, x2, s2, n2, pooled);
    if (!(k.se > 0)) fail('DOMAIN');
    const t = (x1 - x2) / k.se;
    const [lo, up] = tTails(t, k.df);
    return { t: t, p: pValue(alt, lo, up), df: k.df, x1: x1, x2: x2, sx1: s1, sx2: s2, n1: n1, n2: n2, sxp: k.sxp };
  }
  function onePropZTest(p0, x, n, alt) {
    if (!(p0 > 0 && p0 < 1) || !(n > 0) || x < 0 || x > n) fail('DOMAIN');
    const ph = x / n;
    const z = (ph - p0) / Math.sqrt(p0 * (1 - p0) / n);
    const [lo, up] = zTails(z);
    return { z: z, p: pValue(alt, lo, up), phat: ph, n: n };
  }
  function twoPropZTest(x1, n1, x2, n2, alt) {
    if (!(n1 > 0 && n2 > 0)) fail('DOMAIN');
    const p1 = x1 / n1, p2 = x2 / n2, pp = (x1 + x2) / (n1 + n2);
    const se = Math.sqrt(pp * (1 - pp) * (1 / n1 + 1 / n2));
    if (!(se > 0)) fail('DOMAIN');
    const z = (p1 - p2) / se;
    const [lo, up] = zTails(z);
    return { z: z, p: pValue(alt, lo, up), p1: p1, p2: p2, phat: pp, n1: n1, n2: n2 };
  }
  function checkLevel(C) {
    const c = C > 1 ? C / 100 : C;
    if (!(c > 0 && c < 1)) fail('DOMAIN');
    return c;
  }
  function zInterval(sigma, xbar, n, C) {
    const c = checkLevel(C), z = invPhi(0.5 + c / 2), m = z * sigma / Math.sqrt(n);
    return { lo: xbar - m, hi: xbar + m, xbar: xbar, n: n, me: m };
  }
  function tInterval(xbar, sx, n, C) {
    const c = checkLevel(C), df = n - 1;
    if (!(df > 0)) fail('DOMAIN');
    const t = invT(0.5 + c / 2, df), m = t * sx / Math.sqrt(n);
    return { lo: xbar - m, hi: xbar + m, xbar: xbar, sx: sx, n: n, df: df, me: m };
  }
  function twoSampZInt(s1, s2, x1, n1, x2, n2, C) {
    const c = checkLevel(C), z = invPhi(0.5 + c / 2), m = z * Math.sqrt(s1 * s1 / n1 + s2 * s2 / n2);
    return { lo: x1 - x2 - m, hi: x1 - x2 + m, x1: x1, x2: x2, n1: n1, n2: n2 };
  }
  function twoSampTInt(x1, s1, n1, x2, s2, n2, C, pooled) {
    const c = checkLevel(C), k = twoSampT(x1, s1, n1, x2, s2, n2, pooled);
    const m = invT(0.5 + c / 2, k.df) * k.se;
    return { lo: x1 - x2 - m, hi: x1 - x2 + m, df: k.df, x1: x1, x2: x2, sx1: s1, sx2: s2, n1: n1, n2: n2, sxp: k.sxp };
  }
  function onePropZInt(x, n, C) {
    const c = checkLevel(C), ph = x / n, m = invPhi(0.5 + c / 2) * Math.sqrt(ph * (1 - ph) / n);
    return { lo: ph - m, hi: ph + m, phat: ph, n: n };
  }
  function twoPropZInt(x1, n1, x2, n2, C) {
    const c = checkLevel(C), p1 = x1 / n1, p2 = x2 / n2;
    const m = invPhi(0.5 + c / 2) * Math.sqrt(p1 * (1 - p1) / n1 + p2 * (1 - p2) / n2);
    return { lo: p1 - p2 - m, hi: p1 - p2 + m, p1: p1, p2: p2, n1: n1, n2: n2 };
  }
  /** χ²-Test on a table of observed counts; expected counts come back too (stored to [B] on the calculator). */
  function chi2Test(obs) {
    const r = obs.length, c = obs[0].length;
    if (r < 2 || c < 2) fail('INVALID DIM');
    const rs = obs.map((row) => row.reduce((a, b) => a + b, 0));
    const cs = obs[0].map((_, j) => obs.reduce((a, row) => a + row[j], 0));
    const tot = rs.reduce((a, b) => a + b, 0);
    if (!(tot > 0)) fail('DOMAIN');
    let chi = 0;
    const exp = obs.map((row, i) => row.map((o, j) => {
      const e = rs[i] * cs[j] / tot;
      if (!(e > 0)) fail('DOMAIN');
      chi += (o - e) * (o - e) / e;
      return e;
    }));
    const df = (r - 1) * (c - 1);
    return { chi2: chi, p: gammaQ(df / 2, chi / 2), df: df, expected: exp };
  }
  function chi2GOF(obs, exp, df) {
    if (obs.length !== exp.length) fail('DIM MISMATCH');
    let chi = 0;
    const cntrb = obs.map((o, i) => { if (!(exp[i] > 0)) fail('DOMAIN'); const v = (o - exp[i]) * (o - exp[i]) / exp[i]; chi += v; return v; });
    if (!(df > 0)) fail('DOMAIN');
    return { chi2: chi, p: gammaQ(df / 2, chi / 2), df: df, cntrb: cntrb };
  }
  function twoSampFTest(s1, n1, s2, n2, alt) {
    if (!(n1 > 1 && n2 > 1 && s2 > 0)) fail('DOMAIN');
    const F = s1 * s1 / (s2 * s2), d1 = n1 - 1, d2 = n2 - 1;
    const lo = FCDF(F, d1, d2), up = FUpper(F, d1, d2);
    return { F: F, p: pValue(alt, lo, up), df1: d1, df2: d2, sx1: s1, sx2: s2 };
  }
  function linRegStats(xs, ys, fs) {
    const ws = weights(xs, fs);
    const L = linFit(xs, ys, ws);
    const df = L.n - 2;
    if (!(df > 0)) fail('STAT');
    let sse = 0;
    xs.forEach((x, i) => { const e = ys[i] - (L.slope * x + L.intercept); sse += ws[i] * e * e; });
    const s = Math.sqrt(sse / df);
    return { L: L, df: df, s: s, seb: s / Math.sqrt(L.sxx) };
  }
  function linRegTTest(xs, ys, fs, alt) {
    const k = linRegStats(xs, ys, fs);
    const t = k.seb > 0 ? k.L.slope / k.seb : (k.L.slope === 0 ? 0 : Infinity);
    const [lo, up] = Number.isFinite(t) ? tTails(t, k.df) : [t > 0 ? 1 : 0, t > 0 ? 0 : 1];
    return { t: t, p: pValue(alt, lo, up), df: k.df, a: k.L.intercept, b: k.L.slope, s: k.s, r2: k.L.r * k.L.r, r: k.L.r };
  }
  function linRegTInt(xs, ys, fs, C) {
    const c = checkLevel(C), k = linRegStats(xs, ys, fs);
    const m = invT(0.5 + c / 2, k.df) * k.seb;
    return { lo: k.L.slope - m, hi: k.L.slope + m, b: k.L.slope, df: k.df, s: k.s, a: k.L.intercept, r2: k.L.r * k.L.r, r: k.L.r, me: m };
  }
  function anova(groups) {
    if (groups.length < 2) fail('ARGUMENT');
    let N = 0, grand = 0;
    groups.forEach((g) => { if (!g.length) fail('INVALID DIM'); N += g.length; g.forEach((v) => { grand += v; }); });
    grand /= N;
    let ssb = 0, ssw = 0;
    groups.forEach((g) => {
      const m = g.reduce((a, b) => a + b, 0) / g.length;
      ssb += g.length * (m - grand) * (m - grand);
      g.forEach((v) => { ssw += (v - m) * (v - m); });
    });
    const dfb = groups.length - 1, dfw = N - groups.length;
    if (!(dfw > 0)) fail('DOMAIN');
    const msb = ssb / dfb, msw = ssw / dfw, F = msw > 0 ? msb / msw : Infinity;
    return { F: F, p: Number.isFinite(F) ? FUpper(F, dfb, dfw) : 0, factor: { df: dfb, SS: ssb, MS: msb }, error: { df: dfw, SS: ssw, MS: msw }, sxp: Math.sqrt(msw) };
  }

  /* ── Finance (APPS ▸ Finance) ───────────────────────────────────────── */

  /** Rate per payment period from the nominal annual I% and the two frequencies. */
  function periodRate(I, PY, CY) {
    if (!(PY > 0 && CY > 0)) fail('DOMAIN');
    return Math.pow(1 + I / 100 / CY, CY / PY) - 1;
  }
  /** Σ of the cash-flow equation; zero when N, I%, PV, PMT, FV are consistent. */
  function tvmResidual(t) {
    const i = periodRate(t.I, t.PY, t.CY), S = t.begin ? 1 : 0;
    if (Math.abs(i) < 1e-15) return t.PV + t.PMT * t.N + t.FV;
    const v = Math.pow(1 + i, -t.N);
    return t.PV + t.PMT * (1 + i * S) * (1 - v) / i + t.FV * v;
  }
  /** Solve the TVM equation for one of 'N' 'I' 'PV' 'PMT' 'FV'. */
  function tvmSolve(t, key) {
    const T = Object.assign({ PY: 12, CY: 12, begin: false }, t);
    const S = T.begin ? 1 : 0;
    const i = key === 'I' ? 0 : periodRate(T.I, T.PY, T.CY);
    const small = Math.abs(i) < 1e-15;
    switch (key) {
      case 'PMT': {
        if (small) { if (!T.N) fail('DIVIDE BY 0'); return -(T.PV + T.FV) / T.N; }
        const v = Math.pow(1 + i, -T.N), den = (1 + i * S) * (1 - v) / i;
        if (den === 0) fail('DIVIDE BY 0');
        return -(T.PV + T.FV * v) / den;
      }
      case 'PV': {
        if (small) return -(T.PMT * T.N + T.FV);
        const v = Math.pow(1 + i, -T.N);
        return -(T.PMT * (1 + i * S) * (1 - v) / i + T.FV * v);
      }
      case 'FV': {
        if (small) return -(T.PV + T.PMT * T.N);
        const v = Math.pow(1 + i, -T.N);
        return -(T.PV + T.PMT * (1 + i * S) * (1 - v) / i) / v;
      }
      case 'N': {
        if (small) { if (!T.PMT) fail('DIVIDE BY 0'); return -(T.PV + T.FV) / T.PMT; }
        const k = T.PMT * (1 + i * S) / i;
        const ratio = -(T.PV + k) / (T.FV - k);
        if (!(ratio > 0)) fail('NO SIGN CHANGE');
        return -Math.log(ratio) / Math.log(1 + i);
      }
      case 'I': {
        const f = (I) => tvmResidual(Object.assign({}, T, { I: I }));
        const root = findRoot(f, [0.01, 5, 20, -5, 100], -99.999, 1e5);
        if (root == null) fail('NO SIGN CHANGE');
        return root;
      }
      default: fail('SYNTAX');
    }
    return 0;
  }
  /** A root of f by a scan for a sign change, then bisection with secant steps. */
  function findRoot(f, guesses, lo, hi) {
    const pts = [];
    const N = 400;
    for (let k = 0; k <= N; k++) {
      // Dense near the guesses, spread logarithmically out to the bounds.
      const u = k / N;
      pts.push(lo + (hi - lo) * Math.pow(u, 3));
    }
    guesses.forEach((g) => pts.push(g));
    pts.sort((a, b) => a - b);
    let prevX = null, prevF = null;
    for (const x of pts) {
      let fx;
      try { fx = f(x); } catch (e) { fx = NaN; }
      if (!Number.isFinite(fx)) { prevX = null; continue; }
      if (fx === 0) return x;
      if (prevX !== null && (prevF < 0) !== (fx < 0)) return bisect(f, prevX, x, prevF, fx);
      prevX = x; prevF = fx;
    }
    return null;
  }
  function bisect(f, a, b, fa, fb) {
    for (let k = 0; k < 200; k++) {
      const m = (a + b) / 2;
      const fm = f(m);
      if (fm === 0 || Math.abs(b - a) < 1e-13 * Math.max(1, Math.abs(m))) return m;
      if ((fa < 0) !== (fm < 0)) { b = m; fb = fm; } else { a = m; fa = fm; }
    }
    return (a + b) / 2;
  }
  function expandFlows(list, freq) {
    const out = [];
    list.forEach((cf, i) => {
      const k = freq ? freq[i] : 1;
      if (k !== Math.floor(k) || k < 0) fail('DOMAIN');
      for (let j = 0; j < k; j++) out.push(cf);
    });
    return out;
  }
  function npv(rate, cf0, list, freq) {
    const flows = expandFlows(list, freq), r = rate / 100;
    let s = cf0;
    flows.forEach((cf, j) => { s += cf / Math.pow(1 + r, j + 1); });
    return s;
  }
  function irr(cf0, list, freq) {
    const root = findRoot((r) => npv(r, cf0, list, freq), [10, 1, 5, 20], -99.999, 1e4);
    if (root == null) fail('NO SIGN CHANGE');
    return root;
  }
  /** Balance after n payments; with a rounding value, each period is rounded as the calculator does. */
  function bal(t, n, round) {
    const T = Object.assign({ PY: 12, CY: 12, begin: false }, t);
    const i = periodRate(T.I, T.PY, T.CY);
    if (round == null) return tvmSolve(Object.assign({}, T, { N: n }), 'FV') * -1 * -1;
    const rd = (v) => { const f = Math.pow(10, round); return Math.round(v * f) / f; };
    let b = rd(T.PV);
    const pmt = rd(T.PMT);
    for (let k = 1; k <= n; k++) {
      if (T.begin) { b = rd(b + pmt); b = rd(b + rd(b * i)); } else { b = rd(b + rd(b * i) + pmt); }
    }
    return -(-b);
  }
  function sumPrn(t, a, b, round) { return bal(t, b, round) - bal(t, a - 1, round); }
  function sumInt(t, a, b, round) {
    const pmt = round == null ? t.PMT : Math.round(t.PMT * Math.pow(10, round)) / Math.pow(10, round);
    return (b - a + 1) * pmt - sumPrn(t, a, b, round);
  }
  function toNom(eff, CY) { return CY * (Math.pow(1 + eff / 100, 1 / CY) - 1) * 100; }
  function toEff(nom, CY) { return (Math.pow(1 + nom / 100 / CY, CY) - 1) * 100; }
  /** dbd(date1, date2): MM.DDYY or DDMM.YY, years 1950–2049. */
  function dbd(d1, d2) {
    const parse = (v) => {
      const s = String(v);
      const dot = s.indexOf('.');
      const dec = dot < 0 ? '' : s.slice(dot + 1);
      let mm, dd, yy;
      if (dec.length > 2) {                        // MM.DDYY
        mm = Math.floor(v);
        const f = dec.padEnd(4, '0');
        dd = +f.slice(0, 2); yy = +f.slice(2, 4);
      } else {                                     // DDMM.YY
        const w = String(Math.floor(v)).padStart(4, '0');
        dd = +w.slice(0, 2); mm = +w.slice(2, 4); yy = +dec.padEnd(2, '0');
      }
      const year = yy < 50 ? 2000 + yy : 1900 + yy;
      const d = new Date(Date.UTC(year, mm - 1, dd));
      if (d.getUTCMonth() !== mm - 1 || d.getUTCDate() !== dd) fail('DOMAIN');
      return d.getTime();
    };
    return Math.round((parse(d2) - parse(d1)) / 86400000);
  }

  /* ── Polynomials and systems (APPS ▸ PlySmlt2) ─────────────────────── */

  /** All roots of a polynomial, coefficients highest power first, as [re, im] pairs (Durand–Kerner, then Newton polish). */
  function polyRoots(coeffs) {
    let c = coeffs.slice();
    while (c.length && c[0] === 0) c.shift();
    const n = c.length - 1;
    if (n < 1) fail('ARGUMENT');
    const lead = c[0];
    c = c.map((v) => v / lead);
    // Roots at zero come off first, exactly.
    let zeros = 0;
    while (c.length > 1 && c[c.length - 1] === 0) { c.pop(); zeros++; }
    const m = c.length - 1;
    const roots = [];
    if (m > 0) {
      const R = 1 + Math.max.apply(null, c.slice(1).map(Math.abs));
      let z = [];
      for (let k = 0; k < m; k++) { const a = 2 * Math.PI * k / m + 0.4; z.push([R * 0.7 * Math.cos(a), R * 0.7 * Math.sin(a)]); }
      const ev = (x) => { let re = 1, im = 0; for (let k = 1; k <= m; k++) { const nre = re * x[0] - im * x[1] + c[k], nim = re * x[1] + im * x[0]; re = nre; im = nim; } return [re, im]; };
      for (let it = 0; it < 2000; it++) {
        let moved = 0;
        const nz = z.map((zi, i) => {
          let den = [1, 0];
          z.forEach((zj, j) => { if (i !== j) den = cmul(den, [zi[0] - zj[0], zi[1] - zj[1]]); });
          const q = cdiv(ev(zi), den);
          moved = Math.max(moved, Math.hypot(q[0], q[1]));
          return [zi[0] - q[0], zi[1] - q[1]];
        });
        z = nz;
        if (moved < 1e-15 * R) break;
      }
      z.forEach((r) => roots.push(r));
    }
    for (let k = 0; k < zeros; k++) roots.push([0, 0]);
    // Snap the dust off: tiny imaginary parts of real roots, and tiny real parts.
    return roots.map((r) => {
      const s = Math.max(1, Math.hypot(r[0], r[1]));
      return [Math.abs(r[0]) < 1e-11 * s ? 0 : r[0], Math.abs(r[1]) < 1e-9 * s ? 0 : r[1]];
    }).sort((a, b) => (a[1] === 0) !== (b[1] === 0) ? (a[1] === 0 ? -1 : 1) : (b[0] - a[0]) || (b[1] - a[1]));
  }
  function cmul(a, b) { return [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]]; }
  function cdiv(a, b) { const d = b[0] * b[0] + b[1] * b[1]; return [(a[0] * b[0] + a[1] * b[1]) / d, (a[1] * b[0] - a[0] * b[1]) / d]; }

  /** Reduced row-echelon form, the calculator's rref(. */
  function rref(M) {
    const A = M.map((r) => r.slice());
    const rows = A.length, cols = A[0].length;
    let lead = 0;
    for (let r = 0; r < rows && lead < cols; r++) {
      let i = r;
      let best = r;
      for (; lead < cols; lead++) {
        best = r;
        for (i = r; i < rows; i++) if (Math.abs(A[i][lead]) > Math.abs(A[best][lead])) best = i;
        if (Math.abs(A[best][lead]) > 1e-12) break;
      }
      if (lead >= cols) break;
      [A[r], A[best]] = [A[best], A[r]];
      const lv = A[r][lead];
      for (let k = 0; k < cols; k++) A[r][k] /= lv;
      for (i = 0; i < rows; i++) {
        if (i === r) continue;
        const f = A[i][lead];
        for (let k = 0; k < cols; k++) A[i][k] -= f * A[r][k];
      }
      lead++;
    }
    return A.map((row) => row.map((v) => (Math.abs(v) < 1e-12 ? 0 : v)));
  }
  /** Row-echelon form (ref(): leading 1s, zeros below only. */
  function ref(M) {
    const A = M.map((r) => r.slice());
    const rows = A.length, cols = A[0].length;
    let r = 0;
    for (let c = 0; c < cols && r < rows; c++) {
      let best = r;
      for (let i = r; i < rows; i++) if (Math.abs(A[i][c]) > Math.abs(A[best][c])) best = i;
      if (Math.abs(A[best][c]) < 1e-12) continue;
      [A[r], A[best]] = [A[best], A[r]];
      const lv = A[r][c];
      for (let k = 0; k < cols; k++) A[r][k] /= lv;
      for (let i = r + 1; i < rows; i++) {
        const f = A[i][c];
        for (let k = 0; k < cols; k++) A[i][k] -= f * A[r][k];
      }
      r++;
    }
    return A.map((row) => row.map((v) => (Math.abs(v) < 1e-12 ? 0 : v)));
  }
  /**
   * Solve a system given as an augmented matrix (n equations, n unknowns + 1).
   * Returns { kind: 'unique', x: [...] } | { kind: 'none' } | { kind: 'infinite', rref }.
   */
  function solveSystem(aug) {
    const R = rref(aug);
    const vars = aug[0].length - 1;
    for (const row of R) {
      const allZero = row.slice(0, vars).every((v) => v === 0);
      if (allZero && Math.abs(row[vars]) > 1e-10) return { kind: 'none', rref: R };
    }
    let rank = 0;
    R.forEach((row) => { if (row.slice(0, vars).some((v) => v !== 0)) rank++; });
    if (rank < vars) return { kind: 'infinite', rref: R };
    const x = new Array(vars).fill(0);
    R.forEach((row) => { const p = row.findIndex((v, k) => k < vars && v !== 0); if (p >= 0) x[p] = row[vars]; });
    return { kind: 'unique', x: x, rref: R };
  }

  root.FluxTIStats = {
    lgamma: lgamma, gamma: gamma, gammaP: gammaP, gammaQ: gammaQ, betaI: betaI, erfc: erfc, Phi: Phi, invPhi: invPhi,
    normalpdf: normalpdf, normalcdf: normalcdf, invNorm: invNorm,
    tpdf: tpdf, tcdf: tcdf, invT: invT, chi2pdf: chi2pdf, chi2cdf: chi2cdf, Fpdf: Fpdf, Fcdf: Fcdf,
    binompdf: binompdf, binomcdf: binomcdf, invBinom: invBinom, poissonpdf: poissonpdf, poissoncdf: poissoncdf,
    geometpdf: geometpdf, geometcdf: geometcdf,
    oneVar: oneVar, twoVar: twoVar, regress: regress, quartiles: quartiles, medianSorted: medianSorted,
    zTest: zTest, tTest: tTest, twoSampZTest: twoSampZTest, twoSampTTest: twoSampTTest,
    onePropZTest: onePropZTest, twoPropZTest: twoPropZTest, zInterval: zInterval, tInterval: tInterval,
    twoSampZInt: twoSampZInt, twoSampTInt: twoSampTInt, onePropZInt: onePropZInt, twoPropZInt: twoPropZInt,
    chi2Test: chi2Test, chi2GOF: chi2GOF, twoSampFTest: twoSampFTest, linRegTTest: linRegTTest, linRegTInt: linRegTInt, anova: anova,
    periodRate: periodRate, tvmSolve: tvmSolve, npv: npv, irr: irr, bal: bal, sumPrn: sumPrn, sumInt: sumInt,
    toNom: toNom, toEff: toEff, dbd: dbd, findRoot: findRoot,
    polyRoots: polyRoots, rref: rref, ref: ref, solveSystem: solveSystem, solveLinear: solveLinear,
  };
})(typeof window !== 'undefined' ? window : globalThis);
