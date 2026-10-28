/* ============================================================================
   FLUX TEACH · MATHEMATICS  ·  flux-teach-math.js
   Step-by-step lessons for IB Mathematics AA and AI. Every problem is built
   from random numbers and its answer and working are computed from them, so
   they are right by construction (see flux-teach-core.js).

   Units are found by title in flux-ib-syllabus.js (U below), so the unit test
   fails loudly if a title there stops matching.
   ========================================================================== */
(function () {
  'use strict';
  var root = typeof window !== 'undefined' ? window : globalThis;
  var T = root.FluxTeach, IB = root.FluxIbSyllabus;
  if (!T || !IB || root.__fluxTeachMath) return;
  root.__fluxTeachMath = true;

  var N = T.num, F = T.frac, S = T.show;
  function U(sid, title) {
    var s = IB.subjects().filter(function (x) { return x.id === sid; })[0];
    var u = s && s.units.filter(function (x) { return x.title.indexOf(title) === 0; })[0];
    if (!u) throw new Error('No unit "' + title + '" in ' + sid);
    return u.id;
  }
  var AA = function (t) { return U('math-aa', t); };
  var AI = function (t) { return U('math-ai', t); };

  /* ── formatting helpers ── */
  function m(x) { return String(x).replace(/^-/, '−'); }
  /** A value in brackets if negative, for substitution lines: 3 → 3, −2 → (−2). */
  function b(x) { return x < 0 ? '(' + m(x) + ')' : String(x); }
  /** " + 3x" / " − 3x" / "" for 0; the first term without the leading sign. */
  function term(c, v, first) {
    if (c === 0) return '';
    var a = Math.abs(c);
    var body = (a === 1 && v ? '' : S(a)) + (v || '');
    if (first) return (c < 0 ? '−' : '') + body;
    return (c < 0 ? ' − ' : ' + ') + body;
  }
  /** Polynomial from coefficients, highest power first: [2, -3, 1] → 2x^{2} − 3x + 1. */
  function poly(cs, x) {
    x = x || 'x';
    var deg = cs.length - 1, out = '';
    cs.forEach(function (c, i) {
      var p = deg - i;
      var v = p === 0 ? '' : p === 1 ? x : x + '^{' + p + '}';
      out += term(c, v, out === '');
    });
    return out || '0';
  }
  function polyAt(cs, x) { return cs.reduce(function (acc, c) { return acc * x + c; }, 0); }
  function deriv(cs) { var d = cs.length - 1; return cs.slice(0, -1).map(function (c, i) { return c * (d - i); }); }
  function fact(n) { var f = 1; for (var i = 2; i <= n; i++) f *= i; return f; }
  function nCr(n, k) { if (k < 0 || k > n) return 0; var r = 1; for (var i = 1; i <= k; i++) r = r * (n - k + i) / i; return Math.round(r); }
  function nPr(n, k) { var r = 1; for (var i = 0; i < k; i++) r *= (n - i); return r; }
  var DEG = Math.PI / 180;
  function deg(x) { return x / DEG; }
  /** Standard normal CDF from erf (Abramowitz–Stegun 7.1.26, error < 1.5e-7). */
  function phi(z) {
    var x = Math.abs(z) / Math.SQRT2, t = 1 / (1 + 0.3275911 * x);
    var y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
    return z >= 0 ? 0.5 * (1 + y) : 0.5 * (1 - y);
  }
  function invPhi(p) { var lo = -10, hi = 10; for (var i = 0; i < 100; i++) { var mid = (lo + hi) / 2; if (phi(mid) < p) lo = mid; else hi = mid; } return (lo + hi) / 2; }
  function mean(a) { return a.reduce(function (s, x) { return s + x; }, 0) / a.length; }
  function sdPop(a) { var mu = mean(a); return Math.sqrt(a.reduce(function (s, x) { return s + (x - mu) * (x - mu); }, 0) / a.length); }
  function cx(a, bb) { return m(a) + (bb < 0 ? ' − ' : ' + ') + (Math.abs(bb) === 1 ? '' : Math.abs(bb)) + 'i'; }

  var skills = [];
  function add(s) { skills.push(s); }

  /* ════════ 1 · Number and algebra ════════ */

  add({ id: 'm-sci', units: [AA('Scientific notation'), AI('Scientific notation')], title: 'Standard form and significant figures',
    method: ['Standard form is *a × 10^{k}* with 1 ≤ a < 10 and k an integer.', 'Move the decimal point until one non-zero digit is in front of it and count the places moved. A big number gives a positive k, a small one a negative k.',
      'To round to n significant figures, count from the first non-zero digit, look at the next digit, and round up if it is 5 or more.'],
    variants: [
      { id: 'to', name: 'Write in standard form', gen: function (r) {
        var k = r.int(-6, 7), a = r.int(101, 999) / 100, x = a * Math.pow(10, k);
        var written = k >= 0 ? String(Math.round(a * Math.pow(10, k + 2)) / 100) : x.toFixed(2 - k);
        return { q: 'Write ' + written + ' in standard form.', answer: x, sf: 3,
          steps: ['Put the point after the first non-zero digit: ' + a.toFixed(2) + '.', 'The point moved ' + Math.abs(k) + ' place' + (Math.abs(k) === 1 ? '' : 's') + (k >= 0 ? '; the number is big, so k = ' + k : '; the number is small, so k = ' + m(k)) + '.', 'So it is ' + a.toFixed(2) + ' × 10^{' + m(k) + '}.'] };
      } },
      { id: 'sf', name: 'Round to significant figures', gen: function (r) {
        var x = r.int(10000, 999999) / Math.pow(10, r.int(0, 4)), n = r.int(2, 4), y = T.sig(x, n);
        return { q: 'Round ' + x + ' to ' + n + ' significant figures.', answer: y, sf: n,
          steps: ['Count ' + n + ' figures from the first non-zero digit.', 'Look at the next digit: 5 or more rounds up.', 'Answer: ' + y + '.'] };
      } },
      { id: 'mult', name: 'Multiply in standard form', gen: function (r) {
        var a = r.int(11, 99) / 10, bb = r.int(11, 99) / 10, p = r.int(-5, 8), q = r.int(-5, 8);
        var prod = a * bb, k = p + q, x = prod * Math.pow(10, k);
        return { q: 'Work out (' + a + ' × 10^{' + m(p) + '}) × (' + bb + ' × 10^{' + m(q) + '}). Give your answer in standard form.', answer: x, sf: 3,
          steps: ['Multiply the numbers: ' + a + ' × ' + bb + ' = ' + S(prod, 4) + '.', 'Add the powers: 10^{' + m(p) + '} × 10^{' + m(q) + '} = 10^{' + m(k) + '}.', prod >= 10 ? 'Make the number between 1 and 10: ' + S(prod, 4) + ' = ' + S(prod / 10, 5) + ' × 10, so add 1 to the power.' : 'The number is already between 1 and 10.', 'Answer: ' + N(x, 3) + '.'] };
      } },
    ] });

  add({ id: 'm-arith', units: [AA('Arithmetic sequences'), AI('Arithmetic and geometric')], title: 'Arithmetic sequences and series',
    method: ['An arithmetic sequence adds the same *common difference d* each time.', 'nth term: *u_{n} = u_{1} + (n − 1)d*.', 'Sum of the first n terms: *S_{n} = n/2 (2u_{1} + (n − 1)d)*, or *S_{n} = n/2 (u_{1} + u_{n})* if you know the last term.', 'Two terms given? From u_{p} to u_{q} is (q − p) lots of d.'],
    variants: [
      { id: 'nth', name: 'Find the nth term', gen: function (r) {
        var u1 = r.int(-20, 30), d = r.nz(-9, 12), n = r.int(8, 60), un = u1 + (n - 1) * d;
        return { q: 'An arithmetic sequence has u_{1} = ' + m(u1) + ' and d = ' + m(d) + '. Find u_{' + n + '}.', answer: un,
          steps: ['Use u_{n} = u_{1} + (n − 1)d.', 'u_{' + n + '} = ' + m(u1) + ' + (' + n + ' − 1) × ' + b(d) + '.', '= ' + m(u1) + ' + ' + m((n - 1) * d) + ' = ' + m(un) + '.'] };
      } },
      { id: 'which', name: 'Which term is it?', gen: function (r) {
        var u1 = r.int(-10, 40), d = r.nz(-8, 9), n = r.int(10, 80), un = u1 + (n - 1) * d;
        return { q: 'The sequence ' + [0, 1, 2].map(function (i) { return m(u1 + i * d); }).join(', ') + ', … is arithmetic. Which term is ' + m(un) + '?', answer: n,
          steps: ['d = ' + m(u1 + d) + ' − ' + b(u1) + ' = ' + m(d) + '.', 'Solve ' + m(u1) + ' + (n − 1) × ' + b(d) + ' = ' + m(un) + ': (n − 1) × ' + b(d) + ' = ' + m(un - u1) + '.', 'n − 1 = ' + (n - 1) + ', so n = ' + n + '.'] };
      } },
      { id: 'two', name: 'From two terms', gen: function (r) {
        var u1 = r.int(-15, 25), d = r.nz(-7, 9), p = r.int(2, 6), q = p + r.int(3, 9), n = r.int(15, 40);
        var up = u1 + (p - 1) * d, uq = u1 + (q - 1) * d, un = u1 + (n - 1) * d;
        return { q: 'In an arithmetic sequence u_{' + p + '} = ' + m(up) + ' and u_{' + q + '} = ' + m(uq) + '. Find u_{' + n + '}.', answer: un,
          steps: ['From u_{' + p + '} to u_{' + q + '} is ' + (q - p) + ' steps: ' + (q - p) + 'd = ' + m(uq) + ' − ' + b(up) + ' = ' + m(uq - up) + ', so d = ' + m(d) + '.', 'u_{1} = u_{' + p + '} − ' + (p - 1) + 'd = ' + m(up) + ' − ' + b((p - 1) * d) + ' = ' + m(u1) + '.', 'u_{' + n + '} = ' + m(u1) + ' + ' + (n - 1) + ' × ' + b(d) + ' = ' + m(un) + '.'] };
      } },
      { id: 'sum', name: 'Sum of n terms', gen: function (r) {
        var u1 = r.int(-10, 30), d = r.nz(-6, 9), n = r.int(10, 50), s = n / 2 * (2 * u1 + (n - 1) * d);
        return { q: 'Find the sum of the first ' + n + ' terms of the arithmetic sequence with u_{1} = ' + m(u1) + ' and d = ' + m(d) + '.', answer: s,
          steps: ['S_{n} = n/2 (2u_{1} + (n − 1)d).', 'S_{' + n + '} = ' + n + '/2 × (2 × ' + b(u1) + ' + ' + (n - 1) + ' × ' + b(d) + ').', '= ' + S(n / 2) + ' × ' + b(2 * u1 + (n - 1) * d) + ' = ' + m(s) + '.'] };
      } },
      { id: 'sumlast', name: 'Sum from first and last', gen: function (r) {
        var u1 = r.int(1, 30), d = r.int(2, 9), n = r.int(10, 40), un = u1 + (n - 1) * d, s = n * (u1 + un) / 2;
        return { q: 'Find ' + u1 + ' + ' + (u1 + d) + ' + ' + (u1 + 2 * d) + ' + … + ' + un + '.', answer: s,
          steps: ['d = ' + d + '. Number of terms: n = (' + un + ' − ' + u1 + ')/' + d + ' + 1 = ' + n + '.', 'S_{n} = n/2 (u_{1} + u_{n}) = ' + n + '/2 × (' + u1 + ' + ' + un + ').', '= ' + s + '.'] };
      } },
      { id: 'sigma', name: 'Sigma notation', gen: function (r) {
        var a = r.nz(-5, 7), c = r.int(-10, 10), n = r.int(8, 30), s = 0;
        for (var k = 1; k <= n; k++) s += a * k + c;
        return { q: 'Evaluate Σ_{k=1}^{' + n + '} (' + poly([a, c], 'k') + ').', answer: s,
          steps: ['The terms are ' + m(a + c) + ', ' + m(2 * a + c) + ', ' + m(3 * a + c) + ', …: arithmetic with d = ' + m(a) + '.', 'Last term (k = ' + n + '): ' + m(a * n + c) + '.', 'S = ' + n + '/2 × (' + m(a + c) + ' + ' + b(a * n + c) + ') = ' + m(s) + '.'] };
      } },
    ] });

  add({ id: 'm-geo', units: [AA('Geometric sequences'), AA('Infinite geometric'), AI('Arithmetic and geometric')], title: 'Geometric sequences and series',
    method: ['A geometric sequence multiplies by the same *common ratio r* each time: r = u_{2} ÷ u_{1}.', 'nth term: *u_{n} = u_{1} r^{n−1}*.', 'Sum of n terms: *S_{n} = u_{1}(r^{n} − 1)/(r − 1)*.', 'If |r| < 1 the sum to infinity exists: *S_{∞} = u_{1}/(1 − r)*.'],
    variants: [
      { id: 'nth', name: 'Find the nth term', gen: function (r) {
        var u1 = r.int(2, 9) * r.sign(), q = r.pick([2, 3, -2, 1.5, 0.5]), n = r.int(5, 10), un = u1 * Math.pow(q, n - 1);
        return { q: 'A geometric sequence has u_{1} = ' + m(u1) + ' and r = ' + m(q) + '. Find u_{' + n + '}.', answer: un,
          steps: ['u_{n} = u_{1} r^{n−1}.', 'u_{' + n + '} = ' + m(u1) + ' × ' + b(q) + '^{' + (n - 1) + '}.', '= ' + m(u1) + ' × ' + m(S(Math.pow(q, n - 1), 6)) + ' = ' + m(S(un, 6)) + '.'] };
      } },
      { id: 'ratio', name: 'Find r from two terms', gen: function (r) {
        var u1 = r.int(1, 6), q = r.pick([2, 3, 4, -2, -3]), p = r.int(2, 3), k = r.pick([2, 3]);
        if (k === 2 && q < 0) return null;
        var up = u1 * Math.pow(q, p - 1), uq = u1 * Math.pow(q, p - 1 + k);
        return { q: 'In a geometric sequence u_{' + p + '} = ' + m(up) + ' and u_{' + (p + k) + '} = ' + m(uq) + ' (r real). Find r.', answer: q,
          steps: ['u_{' + (p + k) + '} ÷ u_{' + p + '} = r^{' + k + '}.', 'r^{' + k + '} = ' + m(uq) + ' ÷ ' + b(up) + ' = ' + m(Math.pow(q, k)) + '.', 'r = ' + m(q) + '.'] };
      } },
      { id: 'sum', name: 'Sum of n terms', gen: function (r) {
        var u1 = r.int(1, 9), q = r.pick([2, 3, -2, 1.5]), n = r.int(5, 12), s = u1 * (Math.pow(q, n) - 1) / (q - 1);
        return { q: 'Find the sum of the first ' + n + ' terms of the geometric sequence ' + [0, 1, 2].map(function (i) { return m(S(u1 * Math.pow(q, i), 4)); }).join(', ') + ', …', answer: s, sf: 4,
          steps: ['u_{1} = ' + u1 + ', r = ' + m(q) + '.', 'S_{n} = u_{1}(r^{n} − 1)/(r − 1) = ' + u1 + ' × (' + b(q) + '^{' + n + '} − 1)/(' + m(q) + ' − 1).', '= ' + N(s, 4) + '.'] };
      } },
      { id: 'inf', name: 'Sum to infinity', gen: function (r) {
        var u1 = r.int(2, 40), q = r.pick([0.5, -0.5, 0.25, 0.2, 0.8, 0.6, -0.4, 0.75]), s = u1 / (1 - q);
        return { q: 'Find the sum to infinity of the geometric series with first term ' + u1 + ' and common ratio ' + m(q) + '.', answer: s,
          steps: ['|r| = ' + Math.abs(q) + ' < 1, so the sum to infinity exists.', 'S_{∞} = u_{1}/(1 − r) = ' + u1 + '/(1 − ' + b(q) + ').', '= ' + u1 + '/' + S(1 - q) + ' = ' + N(s, 4) + '.'] };
      } },
      { id: 'which', name: 'First term over a value', gen: function (r) {
        var u1 = r.int(2, 9), q = r.pick([2, 3, 1.5, 1.2]), lim = r.pick([1000, 5000, 10000, 100000]);
        var n = 1; while (u1 * Math.pow(q, n - 1) <= lim) n++;
        return { q: 'A geometric sequence has u_{1} = ' + u1 + ' and r = ' + q + '. Which is the first term greater than ' + lim + '? Give n.', answer: n,
          steps: ['Solve ' + u1 + ' × ' + q + '^{n−1} > ' + lim + ': ' + q + '^{n−1} > ' + S(lim / u1, 4) + '.', 'n − 1 > log ' + S(lim / u1, 4) + ' / log ' + q + ' = ' + S(Math.log(lim / u1) / Math.log(q), 3) + '.', 'The next whole number: n = ' + n + ' (u_{' + n + '} = ' + N(u1 * Math.pow(q, n - 1), 4) + ').'] };
      } },
    ] });

  add({ id: 'm-fin', units: [AA('Financial applications'), AI('Financial mathematics')], title: 'Compound interest, depreciation and loans',
    method: ['Compound interest: *FV = PV (1 + r/(100k))^{kn}*: r = annual rate %, k = compounding periods a year, n = years.', 'Depreciation at r% a year: *value = PV (1 − r/100)^{n}*.', 'Time to reach a target: solve with logs (or the GDC) and round *up* to a whole period.', 'Loans and annuities: use the GDC finance solver (N, I%, PV, PMT, FV, P/Y, C/Y).'],
    variants: [
      { id: 'annual', name: 'Compounded yearly', gen: function (r) {
        var pv = r.step(500, 20000, 100), rate = r.pick([2, 2.5, 3, 3.5, 4, 4.5, 5, 6]), n = r.int(3, 15), fv = pv * Math.pow(1 + rate / 100, n);
        return { q: '$' + pv + ' is invested at ' + rate + '% a year, compounded yearly. Find the value after ' + n + ' years, to the nearest cent.', answer: T.round(fv, 2), tol: 0.0002, dp: 2,
          steps: ['FV = PV(1 + r/100)^{n}.', 'FV = ' + pv + ' × ' + S(1 + rate / 100, 4) + '^{' + n + '}.', '= $' + T.round(fv, 2).toFixed(2) + '.'] };
      } },
      { id: 'monthly', name: 'Compounded monthly or quarterly', gen: function (r) {
        var pv = r.step(1000, 30000, 500), rate = r.pick([3, 3.6, 4, 4.8, 6]), k = r.pick([4, 12]), n = r.int(2, 10), fv = pv * Math.pow(1 + rate / (100 * k), k * n);
        return { q: '$' + pv + ' is invested at ' + rate + '% a year, compounded ' + (k === 12 ? 'monthly' : 'quarterly') + '. Find the value after ' + n + ' years, to the nearest cent.', answer: T.round(fv, 2), tol: 0.0002, dp: 2,
          steps: ['Rate per period: ' + rate + '/' + k + ' = ' + S(rate / k, 4) + '%; periods: ' + k + ' × ' + n + ' = ' + k * n + '.', 'FV = ' + pv + ' × (1 + ' + S(rate / k, 4) + '/100)^{' + k * n + '}.', '= $' + T.round(fv, 2).toFixed(2) + '.'] };
      } },
      { id: 'dep', name: 'Depreciation', gen: function (r) {
        var pv = r.step(5000, 60000, 1000), rate = r.pick([8, 10, 12, 15, 18, 20]), n = r.int(2, 8), v = pv * Math.pow(1 - rate / 100, n);
        return { q: 'A car bought for $' + pv + ' loses ' + rate + '% of its value each year. Find its value after ' + n + ' years, to the nearest dollar.', answer: Math.round(v), tol: 0.0005, dp: 0,
          steps: ['Each year it keeps ' + (100 - rate) + '%: multiply by ' + S(1 - rate / 100, 2) + '.', 'Value = ' + pv + ' × ' + S(1 - rate / 100, 2) + '^{' + n + '}.', '= $' + Math.round(v) + '.'] };
      } },
      { id: 'time', name: 'How long to reach a target', gen: function (r) {
        var pv = r.step(1000, 10000, 500), rate = r.pick([3, 4, 5, 6, 7]), mult = r.pick([1.5, 2, 3]), target = pv * mult;
        var n = Math.ceil(Math.log(mult) / Math.log(1 + rate / 100));
        return { q: '$' + pv + ' is invested at ' + rate + '% a year, compounded yearly. After how many whole years will it first be worth at least $' + target + '?', answer: n,
          steps: ['Solve ' + pv + ' × ' + S(1 + rate / 100, 2) + '^{n} ≥ ' + target + ', so ' + S(1 + rate / 100, 2) + '^{n} ≥ ' + mult + '.', 'n ≥ log ' + mult + ' / log ' + S(1 + rate / 100, 2) + ' = ' + S(Math.log(mult) / Math.log(1 + rate / 100), 3) + '.', 'Round up to a whole year: n = ' + n + '.'] };
      } },
      { id: 'loan', name: 'Loan repayments', gen: function (r) {
        var pv = r.step(5000, 40000, 1000), rate = r.pick([3, 4.5, 6, 7.2]), yrs = r.int(2, 6);
        var i = rate / 1200, nn = yrs * 12, pmt = pv * i / (1 - Math.pow(1 + i, -nn));
        return { q: 'A loan of $' + pv + ' is repaid monthly over ' + yrs + ' years at ' + rate + '% a year, compounded monthly. Find the monthly payment, to the nearest cent.', answer: T.round(pmt, 2), tol: 0.0005, dp: 2,
          steps: ['GDC finance solver: N = ' + nn + ', I% = ' + rate + ', PV = ' + pv + ', FV = 0, P/Y = C/Y = 12; solve PMT.', 'By formula: PMT = PV × i / (1 − (1 + i)^{−N}) with i = ' + rate + '/1200.', 'PMT = $' + T.round(pmt, 2).toFixed(2) + '.'] };
      } },
    ] });

  add({ id: 'm-logs', units: [AA('Exponents and logarithms'), AA('Exponential and logarithmic'), AI('Exponents and logarithms'), AI('Laws of logarithms')], title: 'Exponents and logarithms',
    method: ['*log_{b} x = y* means *b^{y} = x*: a log asks “what power?”.', 'Laws: log(ab) = log a + log b; log(a/b) = log a − log b; log(a^{n}) = n log a.', 'To solve *a^{x} = c*, take logs: *x = ln c / ln a*.', 'a^{p/q}: the q is a root, the p is a power; a negative power means “1 over”.'],
    variants: [
      { id: 'eval', name: 'Evaluate a log', gen: function (r) {
        var p = r.pick([[2, '8', 3], [2, '32', 5], [3, '81', 4], [5, '125', 3], [10, '1000', 3], [4, '8', 1.5], [8, '4', 2 / 3], [9, '27', 1.5], [2, '1/4', -2], [3, '1/27', -3], [10, '0.001', -3], [16, '2', 0.25], [27, '9', 2 / 3], [4, '1/2', -0.5]]);
        return { q: 'Find the exact value of log_{' + p[0] + '} ' + p[1] + '.', answer: p[2],
          steps: ['Ask: ' + p[0] + ' to what power gives ' + p[1] + '?', 'Write both as powers of the same base and compare the powers.', p[0] + '^{' + F(Math.round(p[2] * 12), 12) + '} = ' + p[1] + ', so the answer is ' + F(Math.round(p[2] * 12), 12) + '.'] };
      } },
      { id: 'laws', name: 'Combine with the laws', gen: function (r) {
        var bs = r.pick([2, 3, 10]), a = Math.pow(bs, r.int(1, 3)) * r.pick([2, 3, 5, 6]), c = r.pick([2, 3, 4, 5, 6]), k = r.int(1, 4), d = a * c / Math.pow(bs, k);
        if (d !== Math.round(d) || d < 1) return null;
        return { q: 'Find the exact value of log_{' + bs + '} ' + a + ' + log_{' + bs + '} ' + c + ' − log_{' + bs + '} ' + d + '.', answer: k,
          steps: ['Add logs → multiply; subtract → divide: log_{' + bs + '} (' + a + ' × ' + c + ' ÷ ' + d + ').', a + ' × ' + c + ' ÷ ' + d + ' = ' + Math.pow(bs, k) + '.', 'log_{' + bs + '} ' + Math.pow(bs, k) + ' = ' + k + ', because ' + bs + '^{' + k + '} = ' + Math.pow(bs, k) + '.'] };
      } },
      { id: 'solve', name: 'Solve aˣ = c', gen: function (r) {
        var a = r.pick([2, 3, 5, 1.5, 7]), c = r.int(5, 400), x = Math.log(c) / Math.log(a);
        if (Math.abs(x - Math.round(x)) < 1e-9) return null;
        return { q: 'Solve ' + a + '^{x} = ' + c + '. Give x to 3 significant figures.', answer: x, sf: 3,
          steps: ['Take ln of both sides: x ln ' + a + ' = ln ' + c + '.', 'x = ln ' + c + ' / ln ' + a + ' = ' + S(Math.log(c), 4) + ' / ' + S(Math.log(a), 4) + '.', 'x = ' + N(x, 3) + '.'] };
      } },
      { id: 'logeq', name: 'Solve a log equation', gen: function (r) {
        var bs = r.pick([2, 3, 5, 10]), k = r.int(1, 4), p = r.nz(1, 5), q = r.int(-10, 10), x = (Math.pow(bs, k) - q) / p;
        return { q: 'Solve log_{' + bs + '}(' + poly([p, q]) + ') = ' + k + '.', answer: x,
          steps: ['Undo the log: ' + poly([p, q]) + ' = ' + bs + '^{' + k + '} = ' + Math.pow(bs, k) + '.', (p === 1 ? '' : p) + 'x = ' + Math.pow(bs, k) + (q >= 0 ? ' − ' + q : ' + ' + (-q)) + ' = ' + (Math.pow(bs, k) - q) + '.', 'x = ' + F(Math.pow(bs, k) - q, p) + '.'] };
      } },
      { id: 'expo', name: 'Fractional and negative powers', gen: function (r) {
        var base = r.pick([[8, 3], [27, 3], [16, 4], [16, 2], [32, 5], [125, 3], [64, 3], [81, 4], [9, 2], [25, 2]]);
        var pw = r.pick([1, 2, 3]) * r.sign(), rt = Math.round(Math.pow(base[0], 1 / base[1]));
        if (Math.abs(pw) === 3 && rt > 5) pw = pw / 3;
        var val = Math.pow(rt, pw);
        return { q: 'Find the exact value of ' + base[0] + '^{' + F(pw, base[1]) + '}.', answer: val,
          steps: ['Denominator ' + base[1] + ' → root: the ' + (base[1] === 2 ? 'square' : base[1] === 3 ? 'cube' : base[1] + 'th') + ' root of ' + base[0] + ' is ' + rt + '.', 'Numerator ' + Math.abs(pw) + ' → power: ' + rt + '^{' + Math.abs(pw) + '} = ' + Math.pow(rt, Math.abs(pw)) + '.', pw < 0 ? 'Negative power → 1 over it: ' + F(1, Math.pow(rt, -pw)) + '.' : 'Answer: ' + val + '.'] };
      } },
    ] });

  add({ id: 'm-binom', units: [AA('The binomial theorem')], title: 'The binomial theorem',
    method: ['(a + b)^{n} = Σ ^{n}C_{r} a^{n−r} b^{r} for r = 0 … n.', 'The x^{k} term of (p + qx)^{n} is *^{n}C_{k} p^{n−k} (qx)^{k}*: raise the whole bracket, sign included.', 'For (x + c/x)^{n} the general term is ^{n}C_{r} c^{r} x^{n−2r}: the constant term has n − 2r = 0.'],
    variants: [
      { id: 'coef', name: 'Coefficient of xᵏ', gen: function (r) {
        var n = r.int(4, 9), k = r.int(1, n - 1), p = r.nz(-3, 4), q = r.nz(-3, 3);
        var c = nCr(n, k) * Math.pow(p, n - k) * Math.pow(q, k);
        return { q: 'Find the coefficient of x^{' + k + '} in the expansion of (' + m(p) + term(q, 'x') + ')^{' + n + '}.', answer: c,
          steps: ['The x^{' + k + '} term is ^{' + n + '}C_{' + k + '} × ' + b(p) + '^{' + (n - k) + '} × (' + m(q) + 'x)^{' + k + '}.', '^{' + n + '}C_{' + k + '} = ' + nCr(n, k) + ', ' + b(p) + '^{' + (n - k) + '} = ' + m(Math.pow(p, n - k)) + ', ' + b(q) + '^{' + k + '} = ' + m(Math.pow(q, k)) + '.', 'Coefficient = ' + nCr(n, k) + ' × ' + b(Math.pow(p, n - k)) + ' × ' + b(Math.pow(q, k)) + ' = ' + m(c) + '.'] };
      } },
      { id: 'const', name: 'Constant term', gen: function (r) {
        var n = r.pick([4, 6, 8]), c = r.nz(-3, 3), k = n / 2, val = nCr(n, k) * Math.pow(c, k);
        return { q: 'Find the term independent of x in (x ' + (c < 0 ? '− ' : '+ ') + Math.abs(c) + '/x)^{' + n + '}.', answer: val,
          steps: ['General term: ^{' + n + '}C_{r} x^{' + n + '−r} (' + m(c) + '/x)^{r} = ^{' + n + '}C_{r} × ' + b(c) + '^{r} × x^{' + n + '−2r}.', 'Independent of x: ' + n + ' − 2r = 0, so r = ' + k + '.', '^{' + n + '}C_{' + k + '} × ' + b(c) + '^{' + k + '} = ' + nCr(n, k) + ' × ' + b(Math.pow(c, k)) + ' = ' + m(val) + '.'] };
      } },
      { id: 'ncr', name: 'Evaluate nCr', gen: function (r) {
        var n = r.int(5, 15), k = r.int(2, Math.min(6, n - 1));
        return { q: 'Evaluate ^{' + n + '}C_{' + k + '}.', answer: nCr(n, k),
          steps: ['^{n}C_{r} = n! / (r!(n − r)!).', '= (' + Array.from({ length: k }, function (_, i) { return n - i; }).join(' × ') + ') / ' + k + '!.', '= ' + nPr(n, k) + ' / ' + fact(k) + ' = ' + nCr(n, k) + '.'] };
      } },
    ] });

  add({ id: 'm-count', units: [AA('Counting principles')], title: 'Permutations and combinations',
    method: ['Order matters (arrangements, rankings): *^{n}P_{r} = n!/(n − r)!*.', 'Order does not matter (choosing a group): *^{n}C_{r} = n!/(r!(n − r)!)*.', 'Arranging n objects with repeats: n! divided by k! for each letter repeated k times.', 'Independent choices: multiply the counts.'],
    variants: [
      { id: 'perm', name: 'Arrangements (order matters)', gen: function (r) {
        var n = r.int(6, 12), k = r.int(2, 4);
        return { q: n + ' runners race. In how many ways can the first ' + k + ' places be filled?', answer: nPr(n, k),
          steps: ['Order matters: permutations, ^{' + n + '}P_{' + k + '}.', '= ' + Array.from({ length: k }, function (_, i) { return n - i; }).join(' × ') + '.', '= ' + nPr(n, k) + '.'] };
      } },
      { id: 'comb', name: 'Choosing a group', gen: function (r) {
        var men = r.int(4, 9), wom = r.int(4, 9), a = r.int(1, 3), c = r.int(1, 3), v = nCr(men, a) * nCr(wom, c);
        return { q: 'A committee of ' + (a + c) + ' is chosen from ' + men + ' boys and ' + wom + ' girls. How many committees have exactly ' + a + ' boy' + (a === 1 ? '' : 's') + ' and ' + c + ' girl' + (c === 1 ? '' : 's') + '?', answer: v,
          steps: ['Choose the boys: ^{' + men + '}C_{' + a + '} = ' + nCr(men, a) + '.', 'Choose the girls: ^{' + wom + '}C_{' + c + '} = ' + nCr(wom, c) + '.', 'Both together: ' + nCr(men, a) + ' × ' + nCr(wom, c) + ' = ' + v + '.'] };
      } },
      { id: 'word', name: 'Letters with repeats', gen: function (r) {
        var w = r.pick(['BANANA', 'LETTER', 'STATISTICS', 'COMMITTEE', 'APPLE', 'PARALLEL', 'BOOKKEEPER', 'MISSISSIPPI', 'ADDED']);
        var counts = {}; w.split('').forEach(function (ch) { counts[ch] = (counts[ch] || 0) + 1; });
        var rep = Object.keys(counts).filter(function (ch) { return counts[ch] > 1; });
        var den = rep.reduce(function (d, ch) { return d * fact(counts[ch]); }, 1), v = fact(w.length) / den;
        return { q: 'How many different arrangements are there of the letters of ' + w + '?', answer: v,
          steps: [w.length + ' letters: ' + w.length + '! arrangements if all were different.', 'Repeated: ' + rep.map(function (ch) { return ch + ' ×' + counts[ch]; }).join(', ') + '. Divide by the factorial of each count.', w.length + '! / (' + rep.map(function (ch) { return counts[ch] + '!'; }).join(' × ') + ') = ' + v + '.'] };
      } },
    ] });

  add({ id: 'm-complex', units: [AA('Complex numbers'), AA('Polar and Euler'), AI('Complex numbers')], title: 'Complex numbers',
    method: ['i^{2} = −1. Add and subtract real and imaginary parts separately.', 'Multiply out like brackets, then replace i^{2} with −1.', 'Divide: multiply top and bottom by the conjugate of the bottom (a + bi → a − bi).', 'Modulus |a + bi| = √(a^{2} + b^{2}); argument = angle from the positive real axis (check the quadrant).'],
    variants: [
      { id: 'mul', name: 'Multiply: real part', gen: function (r) {
        var a = r.nz(-6, 6), bb = r.nz(-6, 6), c = r.nz(-6, 6), d = r.nz(-6, 6), re = a * c - bb * d, im = a * d + bb * c;
        return { q: 'z = ' + cx(a, bb) + ', w = ' + cx(c, d) + '. Find the real part of zw.', answer: re,
          steps: ['zw = ' + b(a) + b(c) + ' + ' + b(a) + '(' + m(d) + 'i) + (' + m(bb) + 'i)' + b(c) + ' + (' + m(bb) + 'i)(' + m(d) + 'i).', 'The i × i term: ' + m(bb * d) + 'i^{2} = ' + m(-bb * d) + '.', 'Real part: ' + m(a * c) + ' + ' + b(-bb * d) + ' = ' + m(re) + ' (zw = ' + cx(re, im) + ').'] };
      } },
      { id: 'mulim', name: 'Multiply: imaginary part', gen: function (r) {
        var a = r.nz(-6, 6), bb = r.nz(-6, 6), c = r.nz(-6, 6), d = r.nz(-6, 6), re = a * c - bb * d, im = a * d + bb * c;
        return { q: 'Find the imaginary part of (' + cx(a, bb) + ')(' + cx(c, d) + ').', answer: im,
          steps: ['The i terms come from the outer and inner products: ' + b(a) + '(' + m(d) + 'i) + (' + m(bb) + 'i)' + b(c) + '.', '= ' + m(a * d) + 'i + ' + b(bb * c) + 'i = ' + m(im) + 'i.', 'Product = ' + cx(re, im) + ': imaginary part ' + m(im) + '.'] };
      } },
      { id: 'div', name: 'Divide', gen: function (r) {
        var c = r.nz(-5, 5), d = r.nz(-5, 5), x = r.nz(-4, 4), y = r.nz(-4, 4), a = x * c - y * d, bb = x * d + y * c;
        return { q: 'Write (' + cx(a, bb) + ') ÷ (' + cx(c, d) + ') in the form x + yi. Give x.', answer: x,
          steps: ['Multiply top and bottom by the conjugate ' + cx(c, -d) + '.', 'Bottom: ' + c * c + ' + ' + d * d + ' = ' + (c * c + d * d) + '. Real part of the top: ' + b(a) + b(c) + ' + ' + b(bb) + b(d) + ' = ' + (a * c + bb * d) + '.', 'x = ' + (a * c + bb * d) + '/' + (c * c + d * d) + ' = ' + m(x) + ' (and y = ' + m(y) + ').'] };
      } },
      { id: 'mod', name: 'Modulus', gen: function (r) {
        var t = r.pick([[3, 4], [5, 12], [8, 15], [7, 24], [6, 8], [1, 1], [2, 3], [1, 2]]), a = t[0] * r.sign(), bb = t[1] * r.sign(), md = Math.hypot(a, bb);
        return { q: 'Find |' + cx(a, bb) + '|.', answer: md, sf: 3,
          steps: ['|a + bi| = √(a^{2} + b^{2}).', '= √(' + a * a + ' + ' + bb * bb + ') = √' + (a * a + bb * bb) + '.', '= ' + N(md, 3) + '.'] };
      } },
      { id: 'arg', name: 'Argument (radians)', gen: function (r) {
        var a = r.nz(-6, 6), bb = r.nz(-6, 6), arg = Math.atan2(bb, a), ref = Math.atan(Math.abs(bb / a));
        var quad = a > 0 ? (bb > 0 ? 1 : 4) : (bb > 0 ? 2 : 3);
        return { q: 'Find arg(' + cx(a, bb) + ') in radians, −π < arg ≤ π, to 3 significant figures.', answer: arg, sf: 3,
          steps: ['Real part ' + m(a) + ', imaginary part ' + m(bb) + ': quadrant ' + quad + '.', 'Reference angle: arctan(' + Math.abs(bb) + '/' + Math.abs(a) + ') = ' + S(ref, 4) + '.', quad === 1 ? 'arg = ' + S(ref, 4) + '.' : quad === 4 ? 'Below the real axis: arg = −' + S(ref, 4) + '.' : quad === 2 ? 'arg = π − ' + S(ref, 4) + ' = ' + N(arg, 3) + '.' : 'arg = −(π − ' + S(ref, 4) + ') = ' + N(arg, 3) + '.'] };
      } },
    ] });

  add({ id: 'm-matrix', units: [AI('Matrices'), AA('Systems of linear')], title: 'Matrices and simultaneous equations',
    method: ['Multiply row by column: entry (i, j) of AB = row i of A · column j of B.', 'det [[a, b], [c, d]] = ad − bc.', 'Inverse of a 2×2: (1/det) [[d, −b], [−c, a]] (needs det ≠ 0).', 'Two equations: eliminate one variable by matching coefficients, or use X = A^{−1}B.'],
    variants: [
      { id: 'det', name: 'Determinant', gen: function (r) {
        var a = r.int(-6, 6), bb = r.int(-6, 6), c = r.int(-6, 6), d = r.int(-6, 6);
        return { q: 'Find det [[' + [a, bb].map(m).join(', ') + '], [' + [c, d].map(m).join(', ') + ']].', answer: a * d - bb * c,
          steps: ['det = ad − bc.', '= ' + b(a) + ' × ' + b(d) + ' − ' + b(bb) + ' × ' + b(c) + '.', '= ' + m(a * d) + ' − ' + b(bb * c) + ' = ' + m(a * d - bb * c) + '.'] };
      } },
      { id: 'prod', name: 'Entry of a product', gen: function (r) {
        var A = [[r.int(-4, 5), r.int(-4, 5)], [r.int(-4, 5), r.int(-4, 5)]], B = [[r.int(-4, 5), r.int(-4, 5)], [r.int(-4, 5), r.int(-4, 5)]];
        var i = r.int(0, 1), j = r.int(0, 1), v = A[i][0] * B[0][j] + A[i][1] * B[1][j];
        var w = function (M) { return '[[' + M[0].map(m).join(', ') + '], [' + M[1].map(m).join(', ') + ']]'; };
        return { q: 'A = ' + w(A) + ', B = ' + w(B) + '. Find the entry in row ' + (i + 1) + ', column ' + (j + 1) + ' of AB.', answer: v,
          steps: ['Row ' + (i + 1) + ' of A: (' + A[i].map(m).join(', ') + '). Column ' + (j + 1) + ' of B: (' + m(B[0][j]) + ', ' + m(B[1][j]) + ').', 'Multiply in pairs and add: ' + b(A[i][0]) + ' × ' + b(B[0][j]) + ' + ' + b(A[i][1]) + ' × ' + b(B[1][j]) + '.', '= ' + m(v) + '.'] };
      } },
      { id: 'solve', name: 'Solve two equations', gen: function (r) {
        var x = r.int(-6, 6), y = r.int(-6, 6), a = r.nz(-5, 5), bb = r.nz(-5, 5), c = r.nz(-5, 5), d = r.nz(-5, 5), det = a * d - bb * c;
        if (!det) return null;
        var e1 = a * x + bb * y, e2 = c * x + d * y;
        return { q: 'Solve ' + term(a, 'x', true) + term(bb, 'y') + ' = ' + m(e1) + ' and ' + term(c, 'x', true) + term(d, 'y') + ' = ' + m(e2) + '. Give x.', answer: x,
          steps: ['Match the y-coefficients: multiply the first equation by ' + m(d) + ' and the second by ' + m(bb) + '.', 'Subtract: (' + m(a * d) + ' − ' + b(bb * c) + ')x = ' + m(e1 * d) + ' − ' + b(e2 * bb) + ', so ' + m(det) + 'x = ' + m(det * x) + '.', 'x = ' + m(x) + ' (then y = ' + m(y) + ').'] };
      } },
      { id: 'inv', name: 'Entry of an inverse', gen: function (r) {
        var a = r.int(-5, 6), bb = r.int(-5, 6), c = r.int(-5, 6), d = r.int(-5, 6), det = a * d - bb * c;
        if (!det) return null;
        var inv = [[d, -bb], [-c, a]], i = r.int(0, 1), j = r.int(0, 1);
        return { q: 'A = [[' + [a, bb].map(m).join(', ') + '], [' + [c, d].map(m).join(', ') + ']]. Find the entry in row ' + (i + 1) + ', column ' + (j + 1) + ' of A^{−1}.', answer: inv[i][j] / det,
          steps: ['det A = ' + b(a) + ' × ' + b(d) + ' − ' + b(bb) + ' × ' + b(c) + ' = ' + m(det) + '.', 'A^{−1} = (1/' + m(det) + ') [[' + [d, -bb].map(m).join(', ') + '], [' + [-c, a].map(m).join(', ') + ']]: swap a and d, change the signs of b and c.', 'Entry = ' + m(inv[i][j]) + '/' + m(det) + ' = ' + F(inv[i][j], det) + '.'] };
      } },
    ] });

  /* ════════ 2 · Functions ════════ */

  add({ id: 'm-lines', units: [AA('Equations of straight'), AI('Linear models'), AA('Distance, midpoint')], title: 'Straight lines, distance and midpoint',
    method: ['Gradient through (x_{1}, y_{1}) and (x_{2}, y_{2}): *m = (y_{2} − y_{1})/(x_{2} − x_{1})*.', 'Line through a point with gradient m: *y − y_{1} = m(x − x_{1})*, then rearrange to y = mx + c.', 'Perpendicular gradients multiply to −1: m_{⊥} = −1/m.', 'Midpoint: average the coordinates. Distance: √((x_{2}−x_{1})^{2} + (y_{2}−y_{1})^{2}).'],
    variants: [
      { id: 'grad', name: 'Gradient from two points', gen: function (r) {
        var x1 = r.int(-8, 8), y1 = r.int(-8, 8), x2 = r.int(-8, 8), y2 = r.int(-8, 8);
        if (x1 === x2) return null;
        return { q: 'Find the gradient of the line through (' + m(x1) + ', ' + m(y1) + ') and (' + m(x2) + ', ' + m(y2) + ').', answer: (y2 - y1) / (x2 - x1),
          steps: ['m = (y_{2} − y_{1})/(x_{2} − x_{1}).', '= (' + m(y2) + ' − ' + b(y1) + ')/(' + m(x2) + ' − ' + b(x1) + ') = ' + m(y2 - y1) + '/' + m(x2 - x1) + '.', 'm = ' + F(y2 - y1, x2 - x1) + '.'] };
      } },
      { id: 'icept', name: 'y-intercept of a line', gen: function (r) {
        var x1 = r.int(-6, 6), mm = r.nz(-5, 5), c = r.int(-10, 10), y1 = mm * x1 + c;
        return { q: 'A line has gradient ' + m(mm) + ' and passes through (' + m(x1) + ', ' + m(y1) + '). Find its y-intercept c in y = mx + c.', answer: c,
          steps: ['Substitute the point into y = ' + m(mm) + 'x + c.', m(y1) + ' = ' + m(mm) + ' × ' + b(x1) + ' + c = ' + m(mm * x1) + ' + c.', 'c = ' + m(y1) + ' − ' + b(mm * x1) + ' = ' + m(c) + '.'] };
      } },
      { id: 'perp', name: 'Perpendicular gradient', gen: function (r) {
        var a = r.nz(-6, 6), d = r.nz(1, 5);
        return { q: 'A line has gradient ' + F(a, d) + '. Find the gradient of a line perpendicular to it.', answer: -d / a,
          steps: ['Perpendicular gradients multiply to −1.', 'Flip the fraction and change the sign: −1 ÷ ' + F(a, d) + '.', 'm_{⊥} = ' + F(-d, a) + '.'] };
      } },
      { id: 'dist', name: 'Distance between points', gen: function (r) {
        var x1 = r.int(-8, 8), y1 = r.int(-8, 8), x2 = r.int(-8, 8), y2 = r.int(-8, 8), d = Math.hypot(x2 - x1, y2 - y1);
        if (!d) return null;
        return { q: 'Find the distance between (' + m(x1) + ', ' + m(y1) + ') and (' + m(x2) + ', ' + m(y2) + ').', answer: d, sf: 3,
          steps: ['Δx = ' + m(x2 - x1) + ', Δy = ' + m(y2 - y1) + '.', 'd = √(' + (x2 - x1) * (x2 - x1) + ' + ' + (y2 - y1) * (y2 - y1) + ') = √' + ((x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1)) + '.', 'd = ' + N(d, 3) + '.'] };
      } },
      { id: 'mid', name: 'Midpoint', gen: function (r) {
        var x1 = r.int(-9, 9), y1 = r.int(-9, 9), x2 = r.int(-9, 9), y2 = r.int(-9, 9);
        return { q: 'Find the x-coordinate of the midpoint of (' + m(x1) + ', ' + m(y1) + ') and (' + m(x2) + ', ' + m(y2) + ').', answer: (x1 + x2) / 2,
          steps: ['The midpoint averages the coordinates.', 'x = (' + m(x1) + ' + ' + b(x2) + ')/2 = ' + F(x1 + x2, 2) + '.', '(Its y-coordinate is ' + F(y1 + y2, 2) + '.)'] };
      } },
      { id: '3d', name: 'Space diagonal', units: [AI('Volume, surface area'), AA('Distance, midpoint')], gen: function (r) {
        var a = r.int(1, 9), c = r.int(1, 9), h = r.int(1, 9), d = Math.sqrt(a * a + c * c + h * h);
        return { q: 'A cuboid measures ' + a + ' cm × ' + c + ' cm × ' + h + ' cm. Find the length of its space diagonal.', answer: d, sf: 3,
          steps: ['Diagonal of the base: √(' + a + '^{2} + ' + c + '^{2}) = √' + (a * a + c * c) + '.', 'Then up the height: √(' + (a * a + c * c) + ' + ' + h + '^{2}) = √' + (a * a + c * c + h * h) + '.', 'd = ' + N(d, 3) + ' cm.'] };
      } },
    ] });

  add({ id: 'm-func', units: [AA('Functions: domain'), AA('Composite functions'), AI('Composite and inverse'), AI('Functions and their graphs')], title: 'Composite and inverse functions',
    method: ['(f ∘ g)(x) = f(g(x)): work out g first, then put that into f.', 'To find f^{−1}: write y = f(x), swap x and y, and rearrange for y.', 'f^{−1}(k) is the x that makes f(x) = k.', 'Domain: no square roots of negatives, no dividing by zero, no logs of zero or negatives.'],
    variants: [
      { id: 'comp', name: 'f(g(a))', gen: function (r) {
        var a = r.nz(-5, 5), c = r.int(-6, 6), p = r.nz(-3, 3), q = r.int(-5, 5), x = r.int(-4, 4), g = p * x + q, f = a * g * g + c;
        return { q: 'f(x) = ' + poly([a, 0, c]) + ' and g(x) = ' + poly([p, q]) + '. Find (f ∘ g)(' + m(x) + ').', answer: f,
          steps: ['Inside first: g(' + m(x) + ') = ' + m(p) + ' × ' + b(x) + term(q, '') + ' = ' + m(g) + '.', 'Then f(' + m(g) + ') = ' + m(a) + ' × ' + b(g) + '^{2}' + term(c, '') + '.', '= ' + m(a * g * g) + term(c, '') + ' = ' + m(f) + '.'] };
      } },
      { id: 'inv', name: 'f⁻¹(k) of a linear function', gen: function (r) {
        var a = r.nz(-6, 6), c = r.int(-10, 10), k = r.int(-15, 20);
        return { q: 'f(x) = ' + poly([a, c]) + '. Find f^{−1}(' + m(k) + ').', answer: (k - c) / a,
          steps: ['y = ' + poly([a, c]) + '. Swap x and y: x = ' + poly([a, c], 'y') + '.', 'Rearrange: y = (x' + term(-c, '') + ')/' + b(a) + '.', 'f^{−1}(' + m(k) + ') = (' + m(k) + term(-c, '') + ')/' + b(a) + ' = ' + F(k - c, a) + '.'] };
      } },
      { id: 'invrat', name: 'f⁻¹ of a rational function', units: [AA('Rational functions'), AA('Functions: domain')], gen: function (r) {
        var a = r.nz(1, 5), c = r.nz(-4, 4), k = r.int(-6, 9);
        if (k === a) return null;
        // f(x) = (ax + 1)/(x − c); f(x) = k ⇒ ax + 1 = kx − kc ⇒ x = (−kc − 1)/(a − k)
        return { q: 'f(x) = (' + poly([a, 1]) + ')/(' + poly([1, -c]) + '). Find f^{−1}(' + m(k) + ').', answer: (-k * c - 1) / (a - k),
          steps: ['f^{−1}(' + m(k) + ') is the x with f(x) = ' + m(k) + ': ' + poly([a, 1]) + ' = ' + m(k) + '(' + poly([1, -c]) + ').', poly([a, 1]) + ' = ' + poly([k, -k * c]) + ', so (' + a + ' − ' + b(k) + ')x = ' + m(-k * c - 1) + '.', 'x = ' + F(-k * c - 1, a - k) + '.'] };
      } },
      { id: 'domain', name: 'Largest domain', units: [AA('Functions: domain')], gen: function (r) {
        var p = r.nz(1, 4), q = r.int(-9, 9);
        if (q === 0) return null;
        if (r.next() < 0.5) {
          return Object.assign(T.choice('x ≥ ' + F(-q, p), ['x > ' + F(-q, p), 'x ≤ ' + F(-q, p), 'x ≠ ' + F(-q, p), 'x ≥ ' + F(q, p)], r), {
            q: 'What is the largest possible domain of f(x) = √(' + poly([p, q]) + ')?',
            steps: ['A square root needs what is inside to be 0 or more.', poly([p, q]) + ' ≥ 0, so ' + (p === 1 ? '' : p) + 'x ≥ ' + m(-q) + '.', 'x ≥ ' + F(-q, p) + '.'] });
        }
        return Object.assign(T.choice('x ≠ ' + F(-q, p), ['x ≥ ' + F(-q, p), 'x > ' + F(-q, p), 'x ≠ ' + F(q, p), 'x ∈ ℝ'], r), {
          q: 'What is the largest possible domain of f(x) = 3/(' + poly([p, q]) + ')?',
          steps: ['You cannot divide by zero.', poly([p, q]) + ' = 0 when x = ' + F(-q, p) + '.', 'So x ≠ ' + F(-q, p) + '.'] });
      } },
    ] });

  add({ id: 'm-quad', units: [AA('Quadratic functions'), AA('Solving equations'), AA('Polynomial functions'), AI('Modelling')], title: 'Quadratics and polynomials',
    method: ['Roots: factorise, or use *x = (−b ± √(b^{2} − 4ac))/(2a)*.', 'Discriminant Δ = b^{2} − 4ac: Δ > 0 two real roots, Δ = 0 one repeated root, Δ < 0 no real roots.', 'Vertex: x = −b/(2a), then substitute for y. Completed square a(x − h)^{2} + k has vertex (h, k).', 'Remainder theorem: dividing f(x) by (x − a) leaves remainder f(a); if f(a) = 0, (x − a) is a factor.'],
    variants: [
      { id: 'fact', name: 'Roots by factorising', gen: function (r) {
        var p = r.int(-9, 9), q = r.int(-9, 9), a = r.pick([1, 1, 1, 2, 3]);
        if (p === q) return null;
        return { q: 'Solve ' + poly([a, -a * (p + q), a * p * q]) + ' = 0. Give the larger root.', answer: Math.max(p, q),
          steps: [(a > 1 ? 'Take out ' + a + ': ' + poly([1, -(p + q), p * q]) + ' = 0. ' : '') + 'Find two numbers that multiply to ' + m(p * q) + ' and add to ' + m(-(p + q)) + ': ' + m(-p) + ' and ' + m(-q) + '.', '(x' + term(-p, '') + ')(x' + term(-q, '') + ') = 0.', 'x = ' + m(p) + ' or x = ' + m(q) + '; the larger is ' + m(Math.max(p, q)) + '.'] };
      } },
      { id: 'formula', name: 'Quadratic formula', gen: function (r) {
        var a = r.nz(-4, 5), c2 = r.int(-9, 9), c = r.int(-9, 9), D = c2 * c2 - 4 * a * c;
        if (D <= 0 || Math.sqrt(D) === Math.round(Math.sqrt(D))) return null;
        var x1 = (-c2 + Math.sqrt(D)) / (2 * a), x2 = (-c2 - Math.sqrt(D)) / (2 * a);
        return { q: 'Solve ' + poly([a, c2, c]) + ' = 0. Give the larger root to 3 significant figures.', answer: Math.max(x1, x2), sf: 3,
          steps: ['a = ' + m(a) + ', b = ' + m(c2) + ', c = ' + m(c) + '.', 'Δ = b^{2} − 4ac = ' + c2 * c2 + ' − 4 × ' + b(a) + ' × ' + b(c) + ' = ' + D + '.', 'x = (' + m(-c2) + ' ± √' + D + ')/' + b(2 * a) + ' = ' + N(x1, 3) + ' or ' + N(x2, 3) + '.', 'The larger root is ' + N(Math.max(x1, x2), 3) + '.'] };
      } },
      { id: 'disc', name: 'Nature of the roots', gen: function (r) {
        var a = r.nz(-4, 4), c2 = 2 * r.int(-4, 4), c = r.next() < 0.3 ? c2 * c2 / (4 * a) : r.int(-8, 8);
        if (c !== Math.round(c)) return null;
        var D = c2 * c2 - 4 * a * c;
        var ans = D > 0 ? 'Two distinct real roots' : D === 0 ? 'One repeated real root' : 'No real roots';
        return Object.assign(T.choice(ans, ['Two distinct real roots', 'One repeated real root', 'No real roots']), {
          q: 'How many real roots does ' + poly([a, c2, c]) + ' = 0 have?',
          steps: ['Δ = b^{2} − 4ac = ' + b(c2) + '^{2} − 4 × ' + b(a) + ' × ' + b(c) + '.', 'Δ = ' + m(D) + '.', D > 0 ? 'Δ > 0: two distinct real roots.' : D === 0 ? 'Δ = 0: one repeated root.' : 'Δ < 0: no real roots.'] });
      } },
      { id: 'vertex', name: 'Vertex', gen: function (r) {
        var a = r.nz(-3, 3), h = r.int(-6, 6), k = r.int(-9, 9), cs = [a, -2 * a * h, a * h * h + k], askY = r.next() < 0.5;
        return { q: 'Find the ' + (askY ? 'y' : 'x') + '-coordinate of the vertex of y = ' + poly(cs) + '.', answer: askY ? k : h,
          steps: ['x = −b/(2a) = ' + m(-cs[1]) + '/' + b(2 * a) + ' = ' + m(h) + '.', 'y = ' + m(a) + ' × ' + b(h) + '^{2}' + term(cs[1], '') + ' × ' + b(h) + term(cs[2], '') + ' = ' + m(k) + '.', 'Vertex (' + m(h) + ', ' + m(k) + ')' + (a > 0 ? ', a minimum.' : ', a maximum.')] };
      } },
      { id: 'square', name: 'Completing the square', gen: function (r) {
        var h = r.int(-6, 6), k = r.int(-12, 12), cs = [1, 2 * h, h * h + k];
        if (!h) return null;
        return { q: 'Write ' + poly(cs) + ' in the form (x + p)^{2} + q. Find q.', answer: k,
          steps: ['Halve the x-coefficient: p = ' + m(2 * h) + '/2 = ' + m(h) + '.', '(x' + term(h, '') + ')^{2} = ' + poly([1, 2 * h, h * h]) + ', which has ' + h * h + ' too many or too few.', 'q = ' + m(cs[2]) + ' − ' + h * h + ' = ' + m(k) + '.'] };
      } },
      { id: 'factor', name: 'Remainder theorem', gen: function (r) {
        var cs = [r.nz(-3, 3), r.int(-6, 6), r.int(-6, 6), r.int(-9, 9)], a = r.nz(-3, 3), rem = polyAt(cs, a);
        return { q: 'Find the remainder when ' + poly(cs) + ' is divided by (x' + term(-a, '') + ').', answer: rem,
          steps: ['Remainder theorem: the remainder on dividing by (x − a) is f(a), here a = ' + m(a) + '.', 'f(' + m(a) + ') = ' + cs.map(function (c, i) { return m(c) + ' × ' + b(a) + '^{' + (3 - i) + '}'; }).join(' + ') + '.', '= ' + m(rem) + (rem === 0 ? ': (x' + term(-a, '') + ') is a factor.' : '.')] };
      } },
    ] });

  /* ════════ 3 · Geometry and trigonometry ════════ */

  add({ id: 'm-sohcahtoa', units: [AA('Right-angled and non-right'), AA('Bearings'), AI('Trigonometry in right')], title: 'Right-angled trigonometry',
    method: ['Label the sides from the angle: *opposite*, *adjacent*, *hypotenuse* (the longest, opposite the right angle).', 'SOH CAH TOA: sin = O/H, cos = A/H, tan = O/A. Pick the ratio that links the side you know and the one you want.', 'For an angle, use the inverse: θ = tan^{−1}(O/A) and so on. Calculator in *degrees*.'],
    variants: [
      { id: 'side', name: 'Find a side', gen: function (r) {
        var ang = r.int(15, 75), h = r.int(5, 30), fn = r.pick(['sin', 'cos', 'tan']);
        if (fn === 'tan') {
          var opp = h * Math.tan(ang * DEG);
          return { q: 'In a right-angled triangle, angle θ = ' + ang + '° and the side adjacent to θ is ' + h + ' cm. Find the side opposite θ.', answer: opp, sf: 3,
            steps: ['Know adjacent, want opposite: TOA, tan θ = O/A.', 'O = A tan θ = ' + h + ' × tan ' + ang + '°.', '= ' + N(opp, 3) + ' cm.'] };
        }
        var side = fn === 'sin' ? h * Math.sin(ang * DEG) : h * Math.cos(ang * DEG);
        return { q: 'In a right-angled triangle the hypotenuse is ' + h + ' cm and angle θ = ' + ang + '°. Find the side ' + (fn === 'sin' ? 'opposite' : 'adjacent to') + ' θ.', answer: side, sf: 3,
          steps: [fn === 'sin' ? 'Know H, want O: SOH, sin θ = O/H.' : 'Know H, want A: CAH, cos θ = A/H.', (fn === 'sin' ? 'O' : 'A') + ' = ' + h + ' × ' + fn + ' ' + ang + '°.', '= ' + N(side, 3) + ' cm.'] };
      } },
      { id: 'hyp', name: 'Find the hypotenuse', gen: function (r) {
        var ang = r.int(15, 75), o = r.int(3, 20), hyp = o / Math.sin(ang * DEG);
        return { q: 'In a right-angled triangle angle θ = ' + ang + '° and the side opposite θ is ' + o + ' m. Find the hypotenuse.', answer: hyp, sf: 3,
          steps: ['Know O, want H: SOH, sin θ = O/H.', 'H = O ÷ sin θ = ' + o + ' ÷ sin ' + ang + '°.', '= ' + N(hyp, 3) + ' m.'] };
      } },
      { id: 'angle', name: 'Find an angle', gen: function (r) {
        var o = r.int(2, 15), a = r.int(2, 15), ang = deg(Math.atan(o / a));
        return { q: 'A right-angled triangle has the side opposite θ = ' + o + ' and the side adjacent to θ = ' + a + '. Find θ in degrees.', answer: ang, sf: 3,
          steps: ['Know O and A: tan θ = O/A = ' + o + '/' + a + '.', 'θ = tan^{−1}(' + o + '/' + a + ').', 'θ = ' + N(ang, 3) + '°.'] };
      } },
      { id: 'elev', name: 'Angle of elevation', gen: function (r) {
        var d = r.int(20, 120), ang = r.int(10, 60), h = d * Math.tan(ang * DEG);
        return { q: 'From a point ' + d + ' m from the foot of a tower, the angle of elevation of the top is ' + ang + '°. Find the height of the tower.', answer: h, sf: 3,
          steps: ['The ground distance is adjacent to the angle; the height is opposite.', 'tan ' + ang + '° = h/' + d + ', so h = ' + d + ' × tan ' + ang + '°.', 'h = ' + N(h, 3) + ' m.'] };
      } },
      { id: 'bearing', name: 'Bearings', gen: function (r) {
        var brg = r.int(10, 80), d = r.int(5, 40), east = d * Math.sin(brg * DEG);
        return { q: 'A ship sails ' + d + ' km on a bearing of ' + String(brg).padStart(3, '0') + '°. How far east has it travelled?', answer: east, sf: 3,
          steps: ['Bearings are measured clockwise from north. The angle between the path and north is ' + brg + '°.', 'East is opposite that angle: east = ' + d + ' × sin ' + brg + '°.', '= ' + N(east, 3) + ' km.'] };
      } },
    ] });

  add({ id: 'm-sinecos', units: [AA('Right-angled and non-right'), AI('Trigonometry in right')], title: 'Sine rule, cosine rule and area',
    method: ['Sine rule *a/sin A = b/sin B = c/sin C*: use when you know a side and the angle opposite it.', 'Cosine rule *a^{2} = b^{2} + c^{2} − 2bc cos A*: two sides and the angle between them, or all three sides.', 'An angle from three sides: *cos A = (b^{2} + c^{2} − a^{2})/(2bc)*.', 'Area = *½ ab sin C* (two sides and the angle between them).'],
    variants: [
      { id: 'sineS', name: 'Sine rule: a side', gen: function (r) {
        var A = r.int(25, 80), B = r.int(25, 80), a = r.int(5, 25);
        if (A + B >= 170) return null;
        var bb = a * Math.sin(B * DEG) / Math.sin(A * DEG);
        return { q: 'In triangle ABC, A = ' + A + '°, B = ' + B + '° and a = ' + a + ' cm. Find b.', answer: bb, sf: 3,
          steps: ['Side a and its opposite angle A are known: sine rule.', 'b/sin ' + B + '° = ' + a + '/sin ' + A + '°.', 'b = ' + a + ' × sin ' + B + '° ÷ sin ' + A + '° = ' + N(bb, 3) + ' cm.'] };
      } },
      { id: 'sineA', name: 'Sine rule: an angle', gen: function (r) {
        var A = r.int(30, 80), a = r.int(10, 25), bb = r.int(4, a - 1), sB = bb * Math.sin(A * DEG) / a, B = deg(Math.asin(sB));
        return { q: 'In triangle ABC, A = ' + A + '°, a = ' + a + ' cm and b = ' + bb + ' cm. Find angle B.', answer: B, sf: 3,
          steps: ['sin B / b = sin A / a.', 'sin B = ' + bb + ' × sin ' + A + '° ÷ ' + a + ' = ' + S(sB, 4) + '.', 'B = sin^{−1}(' + S(sB, 4) + ') = ' + N(B, 3) + '°. (b < a, so B < A: the acute answer is the only one.)'] };
      } },
      { id: 'cosS', name: 'Cosine rule: a side', gen: function (r) {
        var bb = r.int(4, 20), c = r.int(4, 20), A = r.int(20, 140), a = Math.sqrt(bb * bb + c * c - 2 * bb * c * Math.cos(A * DEG));
        return { q: 'In triangle ABC, b = ' + bb + ' cm, c = ' + c + ' cm and A = ' + A + '°. Find a.', answer: a, sf: 3,
          steps: ['Two sides and the angle between them: cosine rule.', 'a^{2} = ' + bb + '^{2} + ' + c + '^{2} − 2 × ' + bb + ' × ' + c + ' × cos ' + A + '° = ' + S(a * a, 4) + '.', 'a = √' + S(a * a, 4) + ' = ' + N(a, 3) + ' cm.'] };
      } },
      { id: 'cosA', name: 'Cosine rule: an angle', gen: function (r) {
        var a = r.int(4, 15), bb = r.int(4, 15), c = r.int(4, 15);
        if (a >= bb + c || bb >= a + c || c >= a + bb) return null;
        var cA = (bb * bb + c * c - a * a) / (2 * bb * c), A = deg(Math.acos(cA));
        return { q: 'A triangle has sides a = ' + a + ', b = ' + bb + ', c = ' + c + '. Find angle A.', answer: A, sf: 3,
          steps: ['All three sides: cos A = (b^{2} + c^{2} − a^{2})/(2bc).', 'cos A = (' + bb * bb + ' + ' + c * c + ' − ' + a * a + ')/(2 × ' + bb + ' × ' + c + ') = ' + S(cA, 4) + '.', 'A = cos^{−1}(' + S(cA, 4) + ') = ' + N(A, 3) + '°.'] };
      } },
      { id: 'area', name: 'Area ½ab sin C', gen: function (r) {
        var a = r.int(3, 20), bb = r.int(3, 20), C = r.int(20, 150), ar = 0.5 * a * bb * Math.sin(C * DEG);
        return { q: 'Find the area of a triangle with sides ' + a + ' cm and ' + bb + ' cm and an included angle of ' + C + '°.', answer: ar, sf: 3,
          steps: ['Area = ½ ab sin C.', '= ½ × ' + a + ' × ' + bb + ' × sin ' + C + '°.', '= ' + N(ar, 3) + ' cm^{2}.'] };
      } },
    ] });

  add({ id: 'm-radians', units: [AA('Radians, arcs'), AI('Arcs and sectors')], title: 'Radians, arcs and sectors',
    method: ['π radians = 180°. Degrees → radians: × π/180. Radians → degrees: × 180/π.', 'In radians: arc length *l = rθ*; sector area *A = ½ r^{2} θ*.', 'In degrees: l = (θ/360) × 2πr; A = (θ/360) × πr^{2}.'],
    variants: [
      { id: 'toRad', name: 'Degrees to radians', gen: function (r) {
        var d = r.pick([30, 45, 60, 72, 90, 120, 135, 150, 210, 225, 240, 270, 300, 315]);
        return { q: 'Convert ' + d + '° to radians. Give a decimal to 3 s.f.', answer: d * DEG, sf: 3,
          steps: ['Multiply by π/180.', d + ' × π/180 = ' + F(d, 180) + 'π.', '= ' + N(d * DEG, 3) + ' rad.'] };
      } },
      { id: 'toDeg', name: 'Radians to degrees', gen: function (r) {
        var x = r.int(2, 50) / 10;
        return { q: 'Convert ' + x + ' radians to degrees.', answer: deg(x), sf: 3,
          steps: ['Multiply by 180/π.', x + ' × 180/π.', '= ' + N(deg(x), 3) + '°.'] };
      } },
      { id: 'arc', name: 'Arc length', gen: function (r) {
        var rad = r.int(3, 20), th = r.int(3, 30) / 10;
        return { q: 'A sector has radius ' + rad + ' cm and angle ' + th + ' radians. Find the arc length.', answer: rad * th,
          steps: ['l = rθ, θ in radians.', 'l = ' + rad + ' × ' + th + '.', 'l = ' + S(rad * th, 3) + ' cm.'] };
      } },
      { id: 'sector', name: 'Sector area', gen: function (r) {
        var rad = r.int(3, 15), th = r.int(3, 30) / 10, A = 0.5 * rad * rad * th;
        return { q: 'Find the area of a sector with radius ' + rad + ' m and angle ' + th + ' radians.', answer: A,
          steps: ['A = ½ r^{2} θ.', 'A = ½ × ' + rad * rad + ' × ' + th + '.', 'A = ' + S(A, 3) + ' m^{2}.'] };
      } },
      { id: 'sectorDeg', name: 'Sector with the angle in degrees', gen: function (r) {
        var rad = r.int(3, 15), th = r.pick([30, 40, 45, 60, 72, 80, 100, 120, 135, 150]), A = th / 360 * Math.PI * rad * rad;
        return { q: 'A sector of a circle of radius ' + rad + ' cm has angle ' + th + '°. Find its area.', answer: A, sf: 3,
          steps: ['The sector is ' + th + '/360 of the circle.', 'A = (' + th + '/360) × π × ' + rad + '^{2}.', 'A = ' + N(A, 3) + ' cm^{2}.'] };
      } },
    ] });

  var EXACT = { 30: ['1/2', '√3/2', '1/√3'], 45: ['1/√2', '1/√2', '1'], 60: ['√3/2', '1/2', '√3'] };
  add({ id: 'm-exact', units: [AA('The unit circle'), AA('Trigonometric identities')], title: 'Exact values, identities and trig equations',
    method: ['Learn sin, cos, tan of 30°, 45°, 60° from the half-equilateral and half-square triangles.', 'Unit circle: a point at angle θ is (cos θ, sin θ). CAST: all positive in quadrant 1, sin in 2, tan in 3, cos in 4.', 'Solve sin x = k on 0 ≤ x < 360°: x = α and 180° − α. cos x = k: α and 360° − α. tan x = k: α and α + 180°.', 'Identities: sin^{2} θ + cos^{2} θ = 1; sin 2θ = 2 sin θ cos θ; cos 2θ = 1 − 2 sin^{2} θ.'],
    variants: [
      { id: 'exact', name: 'Exact value', gen: function (r) {
        var base = r.pick([30, 45, 60]), fn = r.pick(['sin', 'cos', 'tan']), quad = r.int(1, 4);
        var angle = [base, 180 - base, 180 + base, 360 - base][quad - 1];
        var val = fn === 'sin' ? Math.sin(angle * DEG) : fn === 'cos' ? Math.cos(angle * DEG) : Math.tan(angle * DEG);
        var idx = fn === 'sin' ? 0 : fn === 'cos' ? 1 : 2, mag = EXACT[base][idx], ans = (val < 0 ? '−' : '') + mag;
        var other = EXACT[base][idx === 0 ? 1 : 0];
        return Object.assign(T.choice(ans, [mag, '−' + mag, other, '−' + other], r), { q: 'Find the exact value of ' + fn + ' ' + angle + '°.',
          steps: ['Reference angle: ' + base + '°, and ' + fn + ' ' + base + '° = ' + mag + '.', angle + '° is in quadrant ' + quad + ', where ' + fn + ' is ' + (val < 0 ? 'negative' : 'positive') + ' (CAST).', fn + ' ' + angle + '° = ' + ans + '.'] });
      } },
      { id: 'solveSin', name: 'Solve sin x = k', gen: function (r) {
        var k = r.pick([0.2, 0.35, 0.5, 0.6, 0.75, 0.9, -0.3, -0.5, -0.8]), a = deg(Math.asin(k));
        var sols = k >= 0 ? [a, 180 - a] : [180 - a, 360 + a];
        return { q: 'Solve sin x = ' + m(k) + ' for 0° ≤ x < 360°. Give the larger solution.', answer: Math.max.apply(null, sols), sf: 4,
          steps: ['sin^{−1}(' + m(k) + ') = ' + m(S(a, 2)) + '°.', k >= 0 ? 'sin is positive in quadrants 1 and 2: x = α and 180° − α.' : 'sin is negative in quadrants 3 and 4: x = 180° − α and 360° + α (α = ' + m(S(a, 2)) + '°).', 'x = ' + sols.map(function (v) { return S(v, 2) + '°'; }).join(' or ') + '.'] };
      } },
      { id: 'solveCos', name: 'Solve cos x = k', gen: function (r) {
        var k = r.pick([0.1, 0.3, 0.5, 0.7, 0.85, -0.2, -0.5, -0.7]), a = deg(Math.acos(k));
        return { q: 'Solve cos x = ' + m(k) + ' for 0° ≤ x < 360°. Give the larger solution.', answer: 360 - a, sf: 4,
          steps: ['cos^{−1}(' + m(k) + ') = ' + S(a, 2) + '°.', 'cos is symmetric about 0°: the other solution is 360° − ' + S(a, 2) + '°.', 'x = ' + S(a, 2) + '° or ' + S(360 - a, 2) + '°.'] };
      } },
      { id: 'pyth', name: 'From sin to cos', gen: function (r) {
        var t = r.pick([[3, 5], [5, 13], [8, 17], [7, 25], [1, 3], [2, 3]]), s = t[0] / t[1], obtuse = r.next() < 0.5, c = Math.sqrt(1 - s * s) * (obtuse ? -1 : 1);
        return { q: 'sin θ = ' + t[0] + '/' + t[1] + ' and θ is ' + (obtuse ? 'obtuse' : 'acute') + '. Find cos θ to 3 s.f.', answer: c, sf: 3,
          steps: ['sin^{2} θ + cos^{2} θ = 1, so cos^{2} θ = 1 − ' + t[0] * t[0] + '/' + t[1] * t[1] + ' = ' + F(t[1] * t[1] - t[0] * t[0], t[1] * t[1]) + '.', 'cos θ = ±√(' + F(t[1] * t[1] - t[0] * t[0], t[1] * t[1]) + ').', (obtuse ? 'Obtuse: cos is negative. ' : 'Acute: cos is positive. ') + 'cos θ = ' + N(c, 3) + '.'] };
      } },
      { id: 'double', name: 'Double angle', gen: function (r) {
        var t = r.pick([[3, 5, 4], [5, 13, 12], [8, 17, 15], [7, 25, 24]]), which = r.pick(['sin', 'cos']);
        var v = which === 'sin' ? 2 * t[0] * t[2] / (t[1] * t[1]) : (t[1] * t[1] - 2 * t[0] * t[0]) / (t[1] * t[1]);
        return { q: 'θ is acute and sin θ = ' + t[0] + '/' + t[1] + '. Find ' + which + ' 2θ.', answer: v,
          steps: ['cos θ = √(1 − sin^{2} θ) = ' + t[2] + '/' + t[1] + '.', which === 'sin' ? 'sin 2θ = 2 sin θ cos θ.' : 'cos 2θ = 1 − 2 sin^{2} θ.', which === 'sin' ? '= 2 × ' + t[0] + '/' + t[1] + ' × ' + t[2] + '/' + t[1] + ' = ' + F(2 * t[0] * t[2], t[1] * t[1]) + '.' : '= 1 − 2 × ' + t[0] * t[0] + '/' + t[1] * t[1] + ' = ' + F(t[1] * t[1] - 2 * t[0] * t[0], t[1] * t[1]) + '.'] };
      } },
    ] });

  add({ id: 'm-trigfn', units: [AA('Trigonometric functions'), AI('Modelling')], title: 'Sinusoidal models',
    method: ['y = a sin(b(x − c)) + d: *amplitude |a|*, *period 2π/b* (or 360°/b), *principal axis y = d*.', 'Maximum d + |a|, minimum d − |a|.', 'From a maximum and minimum: a = (max − min)/2, d = (max + min)/2.'],
    variants: [
      { id: 'period', name: 'Period', gen: function (r) {
        var k = r.pick([2, 3, 4, 0.5, 6]), inDeg = r.next() < 0.5;
        return { q: 'Find the period of y = 3 sin(' + k + 'x) + 1, x in ' + (inDeg ? 'degrees.' : 'radians (decimal).'), answer: inDeg ? 360 / k : 2 * Math.PI / k, sf: 3,
          steps: ['Period = ' + (inDeg ? '360°' : '2π') + ' ÷ b, with b = ' + k + '.', '= ' + (inDeg ? '360' : '2π') + ' ÷ ' + k + '.', '= ' + N(inDeg ? 360 / k : 2 * Math.PI / k, 3) + '.'] };
      } },
      { id: 'maxmin', name: 'Maximum and minimum', gen: function (r) {
        var a = r.nz(-6, 6), d = r.int(-5, 10), askMax = r.next() < 0.5;
        return { q: 'Find the ' + (askMax ? 'maximum' : 'minimum') + ' value of y = ' + m(a) + ' cos(2x)' + term(d, '') + '.', answer: askMax ? d + Math.abs(a) : d - Math.abs(a),
          steps: ['Amplitude |a| = ' + Math.abs(a) + '; principal axis y = ' + m(d) + '.', 'cos runs from −1 to 1, so y runs ' + Math.abs(a) + ' either side of ' + m(d) + '.', (askMax ? 'Max = ' + m(d) + ' + ' : 'Min = ' + m(d) + ' − ') + Math.abs(a) + ' = ' + m(askMax ? d + Math.abs(a) : d - Math.abs(a)) + '.'] };
      } },
      { id: 'model', name: 'Build a model from max and min', gen: function (r) {
        var mx = r.int(10, 30), mn = r.int(-5, mx - 4), askA = r.next() < 0.5;
        return { q: 'A tide model h = a sin(bt) + d varies between a maximum of ' + mx + ' m and a minimum of ' + mn + ' m. Find ' + (askA ? 'a (a > 0).' : 'd.'), answer: askA ? (mx - mn) / 2 : (mx + mn) / 2,
          steps: ['a = (max − min)/2 = (' + mx + ' − ' + b(mn) + ')/2 = ' + S((mx - mn) / 2) + '.', 'd = (max + min)/2 = (' + mx + ' + ' + b(mn) + ')/2 = ' + S((mx + mn) / 2) + '.', askA ? 'a = ' + S((mx - mn) / 2) + '.' : 'd = ' + S((mx + mn) / 2) + '.'] };
      } },
    ] });

  add({ id: 'm-vectors', units: [AA('Vectors'), AA('Scalar and vector'), AA('Vector equations'), AI('Vectors and their')], title: 'Vectors',
    method: ['Magnitude |(a, b, c)| = √(a^{2} + b^{2} + c^{2}).', 'Scalar product u·v = u_{1}v_{1} + u_{2}v_{2} + u_{3}v_{3} = |u||v| cos θ.', 'Angle: cos θ = u·v / (|u||v|). Perpendicular when u·v = 0.', 'A line r = a + λd: each value of λ gives a point on it.'],
    variants: [
      { id: 'mag', name: 'Magnitude', gen: function (r) {
        var v = [r.int(-6, 6), r.int(-6, 6), r.int(-6, 6)], s2 = v[0] * v[0] + v[1] * v[1] + v[2] * v[2];
        if (!s2) return null;
        return { q: 'Find |(' + v.map(m).join(', ') + ')|.', answer: Math.sqrt(s2), sf: 3,
          steps: ['Square each component and add: ' + v.map(function (x) { return x * x; }).join(' + ') + ' = ' + s2 + '.', 'Square root: √' + s2 + '.', '= ' + N(Math.sqrt(s2), 3) + '.'] };
      } },
      { id: 'dot', name: 'Scalar product', gen: function (r) {
        var u = [r.int(-6, 6), r.int(-6, 6), r.int(-6, 6)], v = [r.int(-6, 6), r.int(-6, 6), r.int(-6, 6)], d = u[0] * v[0] + u[1] * v[1] + u[2] * v[2];
        return { q: 'Find (' + u.map(m).join(', ') + ') · (' + v.map(m).join(', ') + ').', answer: d,
          steps: ['Multiply matching components: ' + u.map(function (x, i) { return b(x) + ' × ' + b(v[i]); }).join(' + ') + '.', '= ' + u.map(function (x, i) { return b(x * v[i]); }).join(' + ') + '.', '= ' + m(d) + (d === 0 ? ': the vectors are perpendicular.' : '.')] };
      } },
      { id: 'angle', name: 'Angle between vectors', gen: function (r) {
        var u = [r.int(-5, 5), r.int(-5, 5), r.int(-5, 5)], v = [r.int(-5, 5), r.int(-5, 5), r.int(-5, 5)];
        var d = u[0] * v[0] + u[1] * v[1] + u[2] * v[2], su = u[0] * u[0] + u[1] * u[1] + u[2] * u[2], sv = v[0] * v[0] + v[1] * v[1] + v[2] * v[2];
        if (!su || !sv) return null;
        var th = deg(Math.acos(d / Math.sqrt(su * sv)));
        return { q: 'Find the angle between (' + u.map(m).join(', ') + ') and (' + v.map(m).join(', ') + '), in degrees.', answer: th, sf: 3,
          steps: ['u·v = ' + m(d) + '; |u| = √' + su + ', |v| = √' + sv + '.', 'cos θ = ' + m(d) + ' ÷ (√' + su + ' × √' + sv + ') = ' + S(d / Math.sqrt(su * sv), 4) + '.', 'θ = ' + N(th, 3) + '°.'] };
      } },
      { id: 'line', name: 'Point on a line', gen: function (r) {
        var a = [r.int(-5, 5), r.int(-5, 5), r.int(-5, 5)], d = [r.nz(-4, 4), r.int(-4, 4), r.int(-4, 4)], lam = r.nz(-4, 5), c = r.int(1, 2);
        var p = a.map(function (x, i) { return x + lam * d[i]; });
        return { q: 'The line r = (' + a.map(m).join(', ') + ') + λ(' + d.map(m).join(', ') + ') passes through a point with x = ' + m(p[0]) + '. Find its ' + 'xyz'[c] + '-coordinate.', answer: p[c],
          steps: ['x-component: ' + m(a[0]) + ' + ' + m(d[0]) + 'λ = ' + m(p[0]) + ', so λ = ' + m(lam) + '.', 'Put λ = ' + m(lam) + ' into the ' + 'xyz'[c] + '-component: ' + m(a[c]) + ' + ' + b(lam) + ' × ' + b(d[c]) + '.', '= ' + m(p[c]) + '.'] };
      } },
    ] });

  /* ════════ 4 · Statistics and probability ════════ */

  add({ id: 'm-desc', units: [AA('Measures of central'), AA('Statistical diagrams'), AI('Statistical diagrams and summary')], title: 'Mean, median and standard deviation',
    method: ['Mean = sum ÷ number of values; from a frequency table, Σfx ÷ Σf.', 'Median: put the data in order; it is the middle value, or the average of the two middle values.', 'Standard deviation σ = √(Σ(x − x̄)^{2}/n); on the GDC it is σx.', 'Adding k to every value adds k to the mean and leaves σ unchanged; multiplying by k multiplies both by k.'],
    variants: [
      { id: 'mean', name: 'Mean of a list', gen: function (r) {
        var n = r.int(5, 9), a = Array.from({ length: n }, function () { return r.int(1, 40); }), s = a.reduce(function (p, x) { return p + x; }, 0);
        return { q: 'Find the mean of ' + a.join(', ') + '.', answer: s / n, sf: 3,
          steps: ['Add them: ' + s + '.', 'Divide by how many there are: ' + s + ' ÷ ' + n + '.', '= ' + N(s / n, 3) + '.'] };
      } },
      { id: 'median', name: 'Median', gen: function (r) {
        var n = r.int(6, 11), a = Array.from({ length: n }, function () { return r.int(1, 50); }), so = a.slice().sort(function (p, q) { return p - q; });
        var med = n % 2 ? so[(n - 1) / 2] : (so[n / 2 - 1] + so[n / 2]) / 2;
        return { q: 'Find the median of ' + a.join(', ') + '.', answer: med,
          steps: ['In order: ' + so.join(', ') + '.', n % 2 ? n + ' values: the middle one is number ' + (n + 1) / 2 + '.' : n + ' values: average numbers ' + n / 2 + ' and ' + (n / 2 + 1) + ' (' + so[n / 2 - 1] + ' and ' + so[n / 2] + ').', 'Median = ' + S(med) + '.'] };
      } },
      { id: 'sd', name: 'Standard deviation', gen: function (r) {
        var n = r.int(5, 8), a = Array.from({ length: n }, function () { return r.int(2, 20); }), mu = mean(a), ss = a.reduce(function (s, x) { return s + (x - mu) * (x - mu); }, 0);
        return { q: 'Find the standard deviation σ of ' + a.join(', ') + '.', answer: sdPop(a), sf: 3,
          steps: ['Mean = ' + S(mu, 4) + '.', 'Σ(x − mean)^{2} = ' + S(ss, 4) + '.', 'σ = √(' + S(ss, 4) + ' ÷ ' + n + ') = ' + N(sdPop(a), 3) + '.'] };
      } },
      { id: 'table', name: 'Mean from a frequency table', gen: function (r) {
        var xs = [0, 1, 2, 3, 4], fs = xs.map(function () { return r.int(1, 12); });
        var sf = fs.reduce(function (s, f) { return s + f; }, 0), sfx = xs.reduce(function (s, x, i) { return s + x * fs[i]; }, 0);
        return { q: 'Number of siblings x = 0, 1, 2, 3, 4 with frequencies ' + fs.join(', ') + '. Find the mean.', answer: sfx / sf, sf: 3,
          steps: ['Σfx = ' + xs.map(function (x, i) { return x + '×' + fs[i]; }).join(' + ') + ' = ' + sfx + '.', 'Σf = ' + sf + '.', 'Mean = ' + sfx + ' ÷ ' + sf + ' = ' + N(sfx / sf, 3) + '.'] };
      } },
      { id: 'transform', name: 'Changing every value', gen: function (r) {
        var mu = r.int(10, 60), sd = r.int(2, 9), k = r.int(2, 5), c = r.int(1, 20), askSd = r.next() < 0.5;
        return { q: 'A data set has mean ' + mu + ' and standard deviation ' + sd + '. Every value is multiplied by ' + k + ', then ' + c + ' is added. Find the new ' + (askSd ? 'standard deviation.' : 'mean.'), answer: askSd ? k * sd : k * mu + c,
          steps: ['× ' + k + ' multiplies the mean and the standard deviation by ' + k + '.', '+ ' + c + ' moves the mean up ' + c + ' but does not change the spread.', askSd ? 'New σ = ' + k + ' × ' + sd + ' = ' + k * sd + '.' : 'New mean = ' + k + ' × ' + mu + ' + ' + c + ' = ' + (k * mu + c) + '.'] };
      } },
    ] });

  add({ id: 'm-regr', units: [AA('Correlation and regression'), AI('Correlation and regression'), AI('Spearman')], title: 'Correlation and regression',
    method: ['Pearson’s r measures *linear* correlation, from −1 to 1. On the GDC: LinReg.', 'The regression line y = ax + b predicts y from x: use it only within the data (interpolation), and only to predict y from x.', 'Spearman’s r_{s}: rank each variable and find Pearson’s r of the ranks; with no ties, r_{s} = 1 − 6Σd^{2}/(n(n^{2} − 1)). It detects any steady increase or decrease.'],
    variants: [
      { id: 'predict', name: 'Predict from a regression line', gen: function (r) {
        var a = r.nz(-5, 8) / 2, c = r.int(-10, 30), x = r.int(2, 20);
        return { q: 'The regression line of y on x is y = ' + m(a) + 'x' + term(c, '') + '. Estimate y when x = ' + x + '.', answer: a * x + c,
          steps: ['Substitute x = ' + x + '.', 'y = ' + m(a) + ' × ' + x + term(c, '') + '.', 'y = ' + m(S(a * x + c, 3)) + '.'] };
      } },
      { id: 'pearson', name: 'Pearson’s r', gen: function (r) {
        var slope = r.pick([1, 2, -1, -2, 0.5]), xs = [], ys = [];
        for (var i = 0; i < 6; i++) { var x = i * 2 + r.int(1, 2); xs.push(x); ys.push(Math.round(slope * x + r.int(-3, 3) + 20)); }
        var mx = mean(xs), my = mean(ys), sxy = 0, sxx = 0, syy = 0;
        xs.forEach(function (x, i) { sxy += (x - mx) * (ys[i] - my); sxx += (x - mx) * (x - mx); syy += (ys[i] - my) * (ys[i] - my); });
        if (!syy) return null;
        var rr = sxy / Math.sqrt(sxx * syy);
        return { q: 'x: ' + xs.join(', ') + '\ny: ' + ys.join(', ') + '\nFind Pearson’s correlation coefficient r to 3 s.f.', answer: rr, sf: 3,
          steps: ['GDC: put the lists in, run LinReg(ax + b), read r.', 'By hand: r = S_{xy}/√(S_{xx}S_{yy}) with S_{xy} = ' + S(sxy, 3) + ', S_{xx} = ' + S(sxx, 3) + ', S_{yy} = ' + S(syy, 3) + '.', 'r = ' + N(rr, 3) + ': ' + (Math.abs(rr) > 0.75 ? 'strong' : Math.abs(rr) > 0.5 ? 'moderate' : 'weak') + ' ' + (rr > 0 ? 'positive' : 'negative') + ' correlation.'] };
      } },
      { id: 'spearman', name: 'Spearman’s rank', gen: function (r) {
        var n = 6, xs = r.sample([12, 15, 19, 23, 28, 31, 36, 40], n), ys = r.sample([4, 7, 9, 11, 14, 18, 20, 25], n);
        var rank = function (a) { var so = a.slice().sort(function (p, q) { return p - q; }); return a.map(function (v) { return so.indexOf(v) + 1; }); };
        var rx = rank(xs), ry = rank(ys), d2 = rx.reduce(function (s, v, i) { return s + (v - ry[i]) * (v - ry[i]); }, 0), rs = 1 - 6 * d2 / (n * (n * n - 1));
        return { q: 'x: ' + xs.join(', ') + '\ny: ' + ys.join(', ') + '\nFind Spearman’s rank correlation coefficient to 3 s.f.', answer: rs, sf: 3,
          steps: ['Ranks of x: ' + rx.join(', ') + '. Ranks of y: ' + ry.join(', ') + '.', 'Differences squared: Σd^{2} = ' + d2 + '.', 'r_{s} = 1 − 6 × ' + d2 + '/(' + n + ' × ' + (n * n - 1) + ') = ' + N(rs, 3) + '.'] };
      } },
    ] });

  add({ id: 'm-prob', units: [AA('Probability and Venn'), AA('Conditional probability'), AA('Bayes'), AI('Probability')], title: 'Probability',
    method: ['P(A ∪ B) = P(A) + P(B) − P(A ∩ B).', 'Independent: P(A ∩ B) = P(A)P(B). Mutually exclusive: P(A ∩ B) = 0.', 'Conditional: *P(A | B) = P(A ∩ B) / P(B)*: restrict to B, then ask how much of it is A.', 'Without replacement the second probability changes, because one item has gone.'],
    variants: [
      { id: 'union', name: 'P(A or B)', gen: function (r) {
        var pa = r.int(20, 60), pb = r.int(20, 60), pab = r.int(5, Math.min(pa, pb) - 1);
        return { q: 'P(A) = ' + pa / 100 + ', P(B) = ' + pb / 100 + ' and P(A ∩ B) = ' + pab / 100 + '. Find P(A ∪ B).', answer: (pa + pb - pab) / 100,
          steps: ['P(A ∪ B) = P(A) + P(B) − P(A ∩ B): the overlap was counted twice.', '= ' + pa / 100 + ' + ' + pb / 100 + ' − ' + pab / 100 + '.', '= ' + (pa + pb - pab) / 100 + '.'] };
      } },
      { id: 'indep', name: 'Independent events', gen: function (r) {
        var pa = r.int(10, 90), pb = r.int(10, 90);
        return { q: 'A and B are independent, P(A) = ' + pa / 100 + ' and P(B) = ' + pb / 100 + '. Find P(A ∩ B′).', answer: pa * (100 - pb) / 10000,
          steps: ['P(B′) = 1 − ' + pb / 100 + ' = ' + (100 - pb) / 100 + '.', 'Independent, so multiply: ' + pa / 100 + ' × ' + (100 - pb) / 100 + '.', '= ' + pa * (100 - pb) / 10000 + '.'] };
      } },
      { id: 'cond', name: 'Conditional from a table', gen: function (r) {
        var a = r.int(5, 30), c = r.int(5, 30), bb = r.int(5, 30), d = r.int(5, 30);
        return { q: 'Of the students who like music, ' + a + ' take Maths and ' + c + ' take Physics. Of those who do not, ' + bb + ' take Maths and ' + d + ' take Physics. A student who likes music is chosen. Find P(they take Maths).', answer: a / (a + c), sf: 3,
          steps: ['“Given they like music”: only the ' + a + ' + ' + c + ' = ' + (a + c) + ' music students count.', 'Of those, ' + a + ' take Maths.', 'P = ' + a + '/' + (a + c) + ' = ' + N(a / (a + c), 3) + '.'] };
      } },
      { id: 'norep', name: 'Without replacement', gen: function (r) {
        var red = r.int(3, 9), blue = r.int(3, 9), t = red + blue, p = red * (red - 1) / (t * (t - 1));
        return { q: 'A bag has ' + red + ' red and ' + blue + ' blue counters. Two are taken without replacement. Find P(both red).', answer: p, sf: 3,
          steps: ['First red: ' + red + '/' + t + '.', 'Second red, one red now gone: ' + (red - 1) + '/' + (t - 1) + '.', 'Multiply: ' + F(red * (red - 1), t * (t - 1)) + ' ≈ ' + N(p, 3) + '.'] };
      } },
      { id: 'bayes', name: 'Reverse conditional (tree)', gen: function (r) {
        var pa = r.int(1, 20), pt = r.int(80, 99), pf = r.int(2, 15);
        var num = pa * pt, den = pa * pt + (100 - pa) * pf;
        return { q: 'A condition affects ' + pa + '% of people. A test is positive for ' + pt + '% of those with it and ' + pf + '% of those without it. Given a positive test, find the probability the person has the condition.', answer: num / den, sf: 3,
          steps: ['P(has it and +) = ' + pa / 100 + ' × ' + pt / 100 + ' = ' + num / 10000 + '.', 'P(+) = ' + num / 10000 + ' + ' + (100 - pa) / 100 + ' × ' + pf / 100 + ' = ' + den / 10000 + '.', 'P(has it | +) = ' + num / 10000 + ' ÷ ' + den / 10000 + ' = ' + N(num / den, 3) + '.'] };
      } },
    ] });

  add({ id: 'm-dists', units: [AA('Discrete random'), AA('The binomial distribution'), AI('Discrete distributions'), AI('Poisson')], title: 'Discrete and binomial distributions',
    method: ['The probabilities add to 1; E(X) = Σ x P(X = x).', 'Binomial X ~ B(n, p): a fixed number n of independent trials, each a success with the same probability p.', '*P(X = r) = ^{n}C_{r} p^{r}(1 − p)^{n − r}*; mean np, variance np(1 − p).', 'Poisson Po(m): P(X = r) = e^{−m} m^{r}/r!; mean = variance = m.'],
    variants: [
      { id: 'missing', name: 'Missing probability', gen: function (r) {
        var ps = [r.int(5, 30), r.int(5, 30), r.int(5, 30)], k = 100 - ps.reduce(function (s, x) { return s + x; }, 0);
        if (k <= 0) return null;
        return { q: 'X takes the values 1, 2, 3, 4 with probabilities ' + ps.map(function (p) { return p / 100; }).join(', ') + ' and k. Find k.', answer: k / 100,
          steps: ['The probabilities add to 1.', ps.map(function (p) { return p / 100; }).join(' + ') + ' + k = 1.', 'k = 1 − ' + (100 - k) / 100 + ' = ' + k / 100 + '.'] };
      } },
      { id: 'ex', name: 'Expected value', gen: function (r) {
        var ps = [r.int(1, 4), r.int(1, 4), r.int(1, 4), r.int(1, 4)], tot = ps.reduce(function (s, x) { return s + x; }, 0);
        var num = ps.reduce(function (s, p, i) { return s + i * p; }, 0);
        return { q: 'P(X = x) for x = 0, 1, 2, 3 is ' + ps.map(function (p) { return F(p, tot); }).join(', ') + '. Find E(X).', answer: num / tot,
          steps: ['E(X) = Σ x P(X = x).', '= ' + ps.map(function (p, i) { return i + ' × ' + F(p, tot); }).join(' + ') + '.', '= ' + F(num, tot) + '.'] };
      } },
      { id: 'binEq', name: 'Binomial P(X = r)', gen: function (r) {
        var n = r.int(5, 15), p = r.pick([0.1, 0.2, 0.25, 0.3, 0.4, 0.5, 0.6, 0.7]), k = r.int(1, n - 1), v = nCr(n, k) * Math.pow(p, k) * Math.pow(1 - p, n - k);
        return { q: 'X ~ B(' + n + ', ' + p + '). Find P(X = ' + k + ').', answer: v, sf: 3,
          steps: ['P(X = r) = ^{n}C_{r} p^{r}(1 − p)^{n − r}.', '= ' + nCr(n, k) + ' × ' + p + '^{' + k + '} × ' + T.round(1 - p, 2) + '^{' + (n - k) + '}.', '= ' + N(v, 3) + ' (GDC: binompdf).'] };
      } },
      { id: 'binLe', name: 'Binomial P(X ≤ r)', gen: function (r) {
        var n = r.int(6, 15), p = r.pick([0.2, 0.25, 0.3, 0.4, 0.5]), k = r.int(1, Math.floor(n / 2)), v = 0;
        for (var i = 0; i <= k; i++) v += nCr(n, i) * Math.pow(p, i) * Math.pow(1 - p, n - i);
        return { q: 'X ~ B(' + n + ', ' + p + '). Find P(X ≤ ' + k + ').', answer: v, sf: 3,
          steps: ['P(X ≤ ' + k + ') = P(X = 0) + P(X = 1) + … + P(X = ' + k + ').', 'GDC: binomcdf(' + n + ', ' + p + ', ' + k + ').', '= ' + N(v, 3) + '.'] };
      } },
      { id: 'binMean', name: 'Binomial mean and variance', gen: function (r) {
        var n = r.int(10, 60), p = r.pick([0.1, 0.2, 0.25, 0.3, 0.4, 0.5]), askVar = r.next() < 0.5;
        return { q: 'X ~ B(' + n + ', ' + p + '). Find ' + (askVar ? 'Var(X).' : 'E(X).'), answer: askVar ? n * p * (1 - p) : n * p,
          steps: ['E(X) = np = ' + n + ' × ' + p + ' = ' + S(n * p) + '.', 'Var(X) = np(1 − p) = ' + S(n * p) + ' × ' + T.round(1 - p, 2) + ' = ' + S(n * p * (1 - p), 4) + '.', (askVar ? 'Var(X) = ' + S(n * p * (1 - p), 4) : 'E(X) = ' + S(n * p)) + '.'] };
      } },
      { id: 'poisson', name: 'Poisson P(X = r)', gen: function (r) {
        var mu = r.pick([1.5, 2, 2.5, 3, 4, 5.2]), k = r.int(0, 6), v = Math.exp(-mu) * Math.pow(mu, k) / fact(k);
        return { q: 'X ~ Po(' + mu + '). Find P(X = ' + k + ').', answer: v, sf: 3,
          steps: ['P(X = r) = e^{−m} m^{r}/r!.', '= e^{−' + mu + '} × ' + mu + '^{' + k + '} ÷ ' + k + '!.', '= ' + N(v, 3) + ' (GDC: poissonpdf).'] };
      } },
    ] });

  add({ id: 'm-normal', units: [AA('The normal distribution'), AI('The normal distribution')], title: 'The normal distribution',
    method: ['X ~ N(μ, σ^{2}) is symmetric about μ: about 68% lies within 1σ, 95% within 2σ, 99.7% within 3σ.', 'Standardise: *z = (x − μ)/σ*.', 'GDC: P(X < a) is normalcdf(−1E99, a, μ, σ); the value with P(X < a) = p is invNorm(p, μ, σ).'],
    variants: [
      { id: 'less', name: 'P(X < a)', gen: function (r) {
        var mu = r.int(20, 100), sd = r.int(3, 15), a = T.round(mu + r.int(-20, 20) / 10 * sd, 1);
        return { q: 'X ~ N(' + mu + ', ' + sd + '^{2}). Find P(X < ' + a + ').', answer: phi((a - mu) / sd), sf: 3,
          steps: ['z = (' + a + ' − ' + mu + ')/' + sd + ' = ' + m(S((a - mu) / sd, 3)) + '.', 'GDC: normalcdf(−1E99, ' + a + ', ' + mu + ', ' + sd + ').', '= ' + N(phi((a - mu) / sd), 3) + '.'] };
      } },
      { id: 'between', name: 'P(a < X < b)', gen: function (r) {
        var mu = r.int(20, 100), sd = r.int(3, 15), a = T.round(mu - r.int(2, 18) / 10 * sd, 1), c = T.round(mu + r.int(2, 18) / 10 * sd, 1), v = phi((c - mu) / sd) - phi((a - mu) / sd);
        return { q: 'X ~ N(' + mu + ', ' + sd + '^{2}). Find P(' + a + ' < X < ' + c + ').', answer: v, sf: 3,
          steps: ['P(a < X < b) = P(X < b) − P(X < a).', '= ' + S(phi((c - mu) / sd), 4) + ' − ' + S(phi((a - mu) / sd), 4) + '.', '= ' + N(v, 3) + '.'] };
      } },
      { id: 'inv', name: 'Find a value from a probability', gen: function (r) {
        var mu = r.int(20, 100), sd = r.int(3, 15), p = r.pick([0.05, 0.1, 0.2, 0.25, 0.75, 0.8, 0.9, 0.95]), z = invPhi(p), x = mu + sd * z;
        return { q: 'X ~ N(' + mu + ', ' + sd + '^{2}). Find a such that P(X < a) = ' + p + '.', answer: x, sf: 3,
          steps: ['The z with P(Z < z) = ' + p + ' is ' + m(S(z, 4)) + '.', 'a = μ + zσ = ' + mu + ' + ' + b(T.round(z, 4)) + ' × ' + sd + '.', 'a = ' + N(x, 3) + ' (GDC: invNorm(' + p + ', ' + mu + ', ' + sd + ')).'] };
      } },
      { id: 'sigma', name: 'Find σ from a probability', gen: function (r) {
        var mu = r.int(30, 80), p = r.pick([0.1, 0.2, 0.8, 0.9, 0.95]), a = T.round(mu + r.int(3, 12) * invPhi(p), 1), z = invPhi(p), sd = (a - mu) / z;
        return { q: 'X ~ N(' + mu + ', σ^{2}) and P(X < ' + a + ') = ' + p + '. Find σ.', answer: sd, sf: 3,
          steps: ['Standardise: P(Z < (' + a + ' − ' + mu + ')/σ) = ' + p + '.', 'invNorm(' + p + ') = ' + m(S(z, 4)) + ', so ' + m(S(a - mu, 3)) + '/σ = ' + m(S(z, 4)) + '.', 'σ = ' + m(S(a - mu, 3)) + ' ÷ ' + b(T.round(z, 4)) + ' = ' + N(sd, 3) + '.'] };
      } },
    ] });

  add({ id: 'm-chi', units: [AI('Chi-squared'), AI('Hypothesis testing')], title: 'Hypothesis tests: χ² for independence',
    method: ['H_{0}: the two variables are independent. H_{1}: they are not independent.', 'Expected frequency = row total × column total ÷ grand total.', 'χ^{2}_{calc} = Σ (O − E)^{2}/E with (rows − 1)(columns − 1) degrees of freedom.', 'If the p-value < the significance level (or χ^{2}_{calc} > the critical value), reject H_{0}.'],
    variants: [
      { id: 'expected', name: 'Expected frequency', gen: function (r) {
        var t = [[r.int(10, 50), r.int(10, 50)], [r.int(10, 50), r.int(10, 50)]];
        var R = [t[0][0] + t[0][1], t[1][0] + t[1][1]], C = [t[0][0] + t[1][0], t[0][1] + t[1][1]], G = R[0] + R[1], i = r.int(0, 1), j = r.int(0, 1);
        return { q: 'Observed: row 1: ' + t[0].join(', ') + '; row 2: ' + t[1].join(', ') + '. Find the expected frequency for row ' + (i + 1) + ', column ' + (j + 1) + '.', answer: R[i] * C[j] / G, sf: 3,
          steps: ['Row ' + (i + 1) + ' total ' + R[i] + ', column ' + (j + 1) + ' total ' + C[j] + ', grand total ' + G + '.', 'E = ' + R[i] + ' × ' + C[j] + ' ÷ ' + G + '.', '= ' + N(R[i] * C[j] / G, 3) + '.'] };
      } },
      { id: 'stat', name: 'χ² statistic (2×2)', gen: function (r) {
        var t = [[r.int(10, 50), r.int(10, 50)], [r.int(10, 50), r.int(10, 50)]];
        var R = [t[0][0] + t[0][1], t[1][0] + t[1][1]], C = [t[0][0] + t[1][0], t[0][1] + t[1][1]], G = R[0] + R[1], chi = 0, parts = [];
        for (var i = 0; i < 2; i++) for (var j = 0; j < 2; j++) { var E = R[i] * C[j] / G; chi += (t[i][j] - E) * (t[i][j] - E) / E; parts.push(S((t[i][j] - E) * (t[i][j] - E) / E, 4)); }
        return { q: 'Observed: row 1: ' + t[0].join(', ') + '; row 2: ' + t[1].join(', ') + '. Find χ^{2}_{calc} to 3 s.f.', answer: chi, sf: 3,
          steps: ['Expected for each cell: row total × column total ÷ ' + G + '.', '(O − E)^{2}/E for the four cells: ' + parts.join(', ') + '.', 'χ^{2} = ' + N(chi, 3) + ', with 1 degree of freedom (GDC: χ^{2}-Test).'] };
      } },
      { id: 'df', name: 'Degrees of freedom', gen: function (r) {
        var a = r.int(2, 5), c = r.int(2, 5);
        return { q: 'A contingency table has ' + a + ' rows and ' + c + ' columns. How many degrees of freedom does the χ^{2} test have?', answer: (a - 1) * (c - 1),
          steps: ['df = (rows − 1)(columns − 1).', '= (' + a + ' − 1)(' + c + ' − 1).', '= ' + (a - 1) * (c - 1) + '.'] };
      } },
      { id: 'decide', name: 'Reach a conclusion', gen: function (r) {
        var p = r.pick([0.003, 0.012, 0.031, 0.048, 0.062, 0.14, 0.27]), lvl = r.pick([0.01, 0.05, 0.1]);
        var yes = 'Reject H₀: there is evidence that the variables are not independent', no = 'Do not reject H₀: there is not enough evidence that they are dependent';
        return Object.assign(T.choice(p < lvl ? yes : no, [yes, no, 'Accept H₀: the variables are definitely independent']), {
          q: 'A χ^{2} test at the ' + lvl * 100 + '% level gives p = ' + p + '. What do you conclude?',
          steps: ['Compare p with the significance level ' + lvl + '.', p + (p < lvl ? ' < ' : ' ≥ ') + lvl + '.', p < lvl ? 'Reject H₀.' : 'Do not reject H₀ (you never prove it).'] });
      } },
    ] });

  /* ════════ 5 · Calculus ════════ */

  add({ id: 'm-diff', units: [AA('Limits and the derivative'), AA('Differentiation rules'), AI('Introduction to differentiation'), AI('Further differentiation')], title: 'Differentiation',
    method: ['Power rule: d/dx(ax^{n}) = nax^{n−1}; constants differentiate to 0.', 'f′(a) is the gradient of the curve at x = a.', 'Chain rule: d/dx f(g(x)) = f′(g(x)) × g′(x).', 'Product rule (uv)′ = u′v + uv′; quotient rule (u/v)′ = (u′v − uv′)/v^{2}.', '(e^{x})′ = e^{x}, (ln x)′ = 1/x, (sin x)′ = cos x, (cos x)′ = −sin x (x in radians).'],
    variants: [
      { id: 'grad', name: 'Gradient of a polynomial', gen: function (r) {
        var cs = [r.nz(-3, 4), r.int(-6, 6), r.int(-9, 9), r.int(-9, 9)], x = r.int(-3, 4), d = deriv(cs);
        return { q: 'f(x) = ' + poly(cs) + '. Find the gradient of the curve at x = ' + m(x) + '.', answer: polyAt(d, x),
          steps: ['Differentiate term by term: f′(x) = ' + poly(d) + '.', 'Substitute x = ' + m(x) + ': ' + d.map(function (c, i) { var p = d.length - 1 - i; return m(c) + (p ? ' × ' + b(x) + (p > 1 ? '^{' + p + '}' : '') : ''); }).join(' + ') + '.', 'f′(' + m(x) + ') = ' + m(polyAt(d, x)) + '.'] };
      } },
      { id: 'neg', name: 'Negative and fractional powers', gen: function (r) {
        var a = r.nz(-6, 6), n = r.pick([-1, -2, -3, 0.5, 1.5, -0.5]), x = r.pick([1, 4, 9, 16]), v = a * n * Math.pow(x, n - 1);
        var shown = n === 0.5 ? '√x' : n === -0.5 ? '1/√x' : n === 1.5 ? 'x√x' : '1/x' + (n === -1 ? '' : '^{' + (-n) + '}');
        return { q: 'f(x) = ' + (a === 1 ? '' : a === -1 ? '−' : m(a)) + shown + '. Find f′(' + x + ').', answer: v,
          steps: ['As a power: ' + m(a) + 'x^{' + m(S(n)) + '}.', 'f′(x) = ' + m(S(n)) + ' × ' + b(a) + ' x^{' + m(S(n - 1)) + '} = ' + m(S(a * n)) + 'x^{' + m(S(n - 1)) + '}.', 'f′(' + x + ') = ' + m(S(a * n)) + ' × ' + x + '^{' + m(S(n - 1)) + '} = ' + m(S(v, 4)) + '.'] };
      } },
      { id: 'chain', name: 'Chain rule', gen: function (r) {
        var p = r.nz(-4, 4), q = r.int(-5, 5), n = r.int(2, 5), x = r.int(-2, 3), inner = p * x + q, v = n * Math.pow(inner, n - 1) * p;
        return { q: 'f(x) = (' + poly([p, q]) + ')^{' + n + '}. Find f′(' + m(x) + ').', answer: v,
          steps: ['Outside: ( )^{' + n + '} → ' + n + '( )^{' + (n - 1) + '}. Inside: ' + poly([p, q]) + ' → ' + m(p) + '.', 'f′(x) = ' + n + '(' + poly([p, q]) + ')^{' + (n - 1) + '} × ' + b(p) + '.', 'At x = ' + m(x) + ': ' + n + ' × ' + b(inner) + '^{' + (n - 1) + '} × ' + b(p) + ' = ' + m(v) + '.'] };
      } },
      { id: 'exp', name: 'Exponentials and logs', gen: function (r) {
        var k = r.nz(-3, 3), a = r.nz(-4, 5);
        if (r.next() < 0.5) {
          var x = r.pick([0, 1, 0.5, 2]), v = a * k * Math.exp(k * x);
          return { q: 'f(x) = ' + m(a) + 'e^{' + (k === 1 ? '' : k === -1 ? '−' : m(k)) + 'x}. Find f′(' + x + ') to 3 s.f.', answer: v, sf: 3,
            steps: ['(e^{kx})′ = ke^{kx} (chain rule).', 'f′(x) = ' + m(a * k) + 'e^{' + m(k) + 'x}.', 'f′(' + x + ') = ' + m(a * k) + 'e^{' + m(S(k * x)) + '} = ' + N(v, 3) + '.'] };
        }
        var xx = r.pick([1, 2, 4, 5]), c = Math.abs(k) + 1;
        return { q: 'f(x) = ' + m(a) + ' ln(' + c + 'x). Find f′(' + xx + ').', answer: a / xx,
          steps: ['ln(' + c + 'x) = ln ' + c + ' + ln x, and ln ' + c + ' is a constant.', 'f′(x) = ' + m(a) + '/x.', 'f′(' + xx + ') = ' + F(a, xx) + '.'] };
      } },
      { id: 'product', name: 'Product rule', gen: function (r) {
        var n = r.int(1, 3), x = r.pick([1, 2, 0.5]), v = (n * Math.pow(x, n - 1) + Math.pow(x, n)) * Math.exp(x);
        return { q: 'f(x) = x^{' + n + '}e^{x}. Find f′(' + x + ') to 3 s.f.', answer: v, sf: 3,
          steps: ['u = x^{' + n + '}, v = e^{x}: u′ = ' + (n === 1 ? '1' : n + 'x^{' + (n - 1) + '}') + ', v′ = e^{x}.', 'f′(x) = u′v + uv′ = ' + (n === 1 ? '' : n + 'x^{' + (n - 1) + '}') + 'e^{x} + x^{' + n + '}e^{x}.', 'f′(' + x + ') = ' + N(v, 3) + '.'] };
      } },
      { id: 'quot', name: 'Quotient rule', units: [AA('Differentiation rules')], gen: function (r) {
        var a = r.nz(-4, 4), c2 = r.int(-5, 5), c = r.nz(-3, 3), d = r.int(-5, 5), x = r.int(-2, 3);
        if (c * x + d === 0 || a * d - c2 * c === 0) return null;
        var v = (a * d - c2 * c) / Math.pow(c * x + d, 2);
        return { q: 'f(x) = (' + poly([a, c2]) + ')/(' + poly([c, d]) + '). Find f′(' + m(x) + ').', answer: v,
          steps: ['u = ' + poly([a, c2]) + ', u′ = ' + m(a) + '; v = ' + poly([c, d]) + ', v′ = ' + m(c) + '.', 'f′ = (u′v − uv′)/v^{2}; the top simplifies to ' + m(a) + '(' + poly([c, d]) + ') − ' + b(c) + '(' + poly([a, c2]) + ') = ' + m(a * d - c2 * c) + '.', 'f′(' + m(x) + ') = ' + m(a * d - c2 * c) + ' ÷ ' + b(c * x + d) + '^{2} = ' + F(a * d - c2 * c, Math.pow(c * x + d, 2)) + '.'] };
      } },
      { id: 'trig', name: 'Trig derivatives', units: [AA('Differentiation rules')], gen: function (r) {
        var a = r.nz(-5, 5), k = r.int(1, 4), fn = r.pick(['sin', 'cos']), xi = r.int(0, 4);
        var xs = [0, Math.PI / 6, Math.PI / 4, Math.PI / 3, Math.PI / 2], names = ['0', 'π/6', 'π/4', 'π/3', 'π/2'], x = xs[xi];
        var v = fn === 'sin' ? a * k * Math.cos(k * x) : -a * k * Math.sin(k * x);
        return { q: 'f(x) = ' + m(a) + ' ' + fn + '(' + (k === 1 ? '' : k) + 'x). Find f′(' + names[xi] + ') to 3 s.f.', answer: v, tol: 0.006,
          steps: ['(' + fn + ' kx)′ = ' + (fn === 'sin' ? 'k cos kx' : '−k sin kx') + '.', 'f′(x) = ' + m(fn === 'sin' ? a * k : -a * k) + ' ' + (fn === 'sin' ? 'cos' : 'sin') + '(' + (k === 1 ? '' : k) + 'x).', 'f′(' + names[xi] + ') = ' + N(v, 3) + ' (radians).'] };
      } },
    ] });

  add({ id: 'm-tangent', units: [AA('Tangents and normals'), AI('Tangents, normals')], title: 'Tangents and normals',
    method: ['At x = a: the point is (a, f(a)) and the tangent’s gradient is f′(a).', 'Tangent: y − f(a) = f′(a)(x − a).', 'Normal: perpendicular to the tangent, gradient −1/f′(a), through the same point.'],
    variants: [
      { id: 'tan', name: 'Tangent: y-intercept', gen: function (r) {
        var cs = [r.nz(-3, 3), r.int(-5, 5), r.int(-6, 6)], a = r.int(-3, 3), d = deriv(cs), mm = polyAt(d, a), y0 = polyAt(cs, a), c = y0 - mm * a;
        return { q: 'Find the y-intercept of the tangent to y = ' + poly(cs) + ' at x = ' + m(a) + '.', answer: c,
          steps: ['Point: y = ' + m(y0) + ', so (' + m(a) + ', ' + m(y0) + ').', 'Gradient: dy/dx = ' + poly(d) + ' = ' + m(mm) + ' at x = ' + m(a) + '.', 'y − ' + b(y0) + ' = ' + m(mm) + '(x − ' + b(a) + ') rearranges to y = ' + (mm ? poly([mm, c]) : m(c)) + ': intercept ' + m(c) + '.'] };
      } },
      { id: 'normal', name: 'Normal gradient', gen: function (r) {
        var cs = [r.nz(-3, 3), r.int(-5, 5), r.int(-6, 6)], a = r.int(-3, 3), mm = polyAt(deriv(cs), a);
        if (!mm) return null;
        return { q: 'Find the gradient of the normal to y = ' + poly(cs) + ' at x = ' + m(a) + '.', answer: -1 / mm,
          steps: ['Tangent gradient: dy/dx = ' + poly(deriv(cs)) + ' = ' + m(mm) + ' at x = ' + m(a) + '.', 'The normal is perpendicular: −1 ÷ ' + b(mm) + '.', '= ' + F(-1, mm) + '.'] };
      } },
      { id: 'where', name: 'Where the gradient is k', gen: function (r) {
        var a = r.nz(-3, 3), c = r.int(-6, 6), x = r.int(-5, 5), k = 2 * a * x + c;
        return { q: 'At what x does y = ' + poly([a, c, r.int(-5, 5)]) + ' have gradient ' + m(k) + '?', answer: x,
          steps: ['dy/dx = ' + poly([2 * a, c]) + '.', 'Set ' + poly([2 * a, c]) + ' = ' + m(k) + '.', 'x = ' + F(k - c, 2 * a) + '.'] };
      } },
    ] });

  add({ id: 'm-stat', units: [AA('Stationary points'), AA('Increasing and decreasing'), AI('Tangents, normals')], title: 'Stationary points and optimisation',
    method: ['Stationary points: solve *f′(x) = 0*.', 'Classify with f″(x): positive → minimum, negative → maximum (or check the sign of f′ either side).', 'Optimisation: write the quantity in one variable, differentiate, set to 0, and check it is the maximum or minimum asked for.'],
    variants: [
      { id: 'cubic', name: 'Local maximum of a cubic', gen: function (r) {
        var p = r.int(-4, 3), q = p + r.int(1, 5), a = r.pick([2, 4, -2, -4]), c = r.int(-10, 10);
        var cs = [a, -1.5 * a * (p + q), 3 * a * p * q, c], d2 = deriv(deriv(cs)), xmax = a > 0 ? p : q;
        return { q: 'Find the x-coordinate of the local maximum of f(x) = ' + poly(cs) + '.', answer: xmax,
          steps: ['f′(x) = ' + poly(deriv(cs)) + ' = ' + m(3 * a) + '(x' + term(-p, '') + ')(x' + term(-q, '') + ').', 'f′(x) = 0 at x = ' + m(p) + ' and x = ' + m(q) + '.', 'f″(x) = ' + poly(d2) + ': f″(' + m(xmax) + ') = ' + m(polyAt(d2, xmax)) + ' < 0, so the maximum is at x = ' + m(xmax) + '.'] };
      } },
      { id: 'quadmin', name: 'Minimum value', gen: function (r) {
        var a = r.int(1, 4), h = r.int(-5, 5), k = r.int(-12, 12), cs = [a, -2 * a * h, a * h * h + k];
        return { q: 'Find the minimum value of f(x) = ' + poly(cs) + '.', answer: k,
          steps: ['f′(x) = ' + poly(deriv(cs)) + ' = 0 at x = ' + m(h) + '.', 'f″(x) = ' + 2 * a + ' > 0: a minimum.', 'f(' + m(h) + ') = ' + m(k) + '.'] };
      } },
      { id: 'box', name: 'Optimisation: open box', gen: function (r) {
        var s = r.pick([12, 18, 24, 30, 36]), x = s / 6;
        return { q: 'Squares of side x cm are cut from the corners of a ' + s + ' cm × ' + s + ' cm sheet, which is folded into an open box. Find the value of x that gives the largest volume.', answer: x,
          steps: ['V = x(' + s + ' − 2x)^{2}.', 'dV/dx = (' + s + ' − 2x)^{2} − 4x(' + s + ' − 2x) = (' + s + ' − 2x)(' + s + ' − 6x).', 'dV/dx = 0: x = ' + s / 2 + ' (no box at all) or x = ' + x + '. So x = ' + x + ' cm (V = ' + x * (s - 2 * x) * (s - 2 * x) + ' cm^{3}).'] };
      } },
      { id: 'fence', name: 'Optimisation: fencing', gen: function (r) {
        var L = r.step(40, 400, 20), x = L / 4;
        return { q: 'A farmer has ' + L + ' m of fencing for a rectangular pen against a straight wall (the wall is one side). Find the largest possible area.', answer: L * L / 8,
          steps: ['Two sides of x and one of ' + L + ' − 2x: A = x(' + L + ' − 2x) = ' + L + 'x − 2x^{2}.', 'dA/dx = ' + L + ' − 4x = 0, so x = ' + S(x) + '.', 'A = ' + S(x) + ' × ' + S(L - 2 * x) + ' = ' + S(L * L / 8) + ' m^{2}.'] };
      } },
    ] });

  add({ id: 'm-int', units: [AA('Integration and areas'), AA('Integration by substitution'), AA('Volumes of revolution'), AI('Introduction to integration'), AI('Further differentiation')], title: 'Integration and area',
    method: ['∫ax^{n} dx = ax^{n+1}/(n + 1) + C (n ≠ −1); ∫1/x dx = ln|x| + C; ∫e^{kx} dx = e^{kx}/k + C.', 'Definite integral: integrate, then F(upper) − F(lower).', 'Area between a curve and the x-axis: integrate between the roots, taking the size of parts below the axis.', 'Use a point on the curve to find C. Volume about the x-axis: V = π∫y^{2} dx.'],
    variants: [
      { id: 'def', name: 'Definite integral', gen: function (r) {
        var cs = [r.int(-3, 3), r.int(-6, 6), r.int(-6, 6)], a = r.int(-2, 1), c = a + r.int(1, 4);
        var I = function (x) { return cs[0] * x * x * x / 3 + cs[1] * x * x / 2 + cs[2] * x; }, v = I(c) - I(a);
        return { q: 'Evaluate ∫_{' + m(a) + '}^{' + m(c) + '} (' + poly(cs) + ') dx.', answer: v,
          steps: ['Integrate each term: ' + [cs[0] ? F(cs[0], 3) + 'x^{3}' : '', cs[1] ? F(cs[1], 2) + 'x^{2}' : '', cs[2] ? m(cs[2]) + 'x' : ''].filter(Boolean).join(' + ') + '.', 'F(' + m(c) + ') − F(' + m(a) + ') = ' + m(S(I(c), 4)) + ' − ' + b(T.round(I(a), 4)) + '.', '= ' + F(Math.round(v * 6), 6) + '.'] };
      } },
      { id: 'area', name: 'Area between the roots', gen: function (r) {
        var p = r.int(-4, 2), q = p + r.int(2, 6), a = r.pick([-1, -2, -3]), area = Math.abs(a) * Math.pow(q - p, 3) / 6;
        return { q: 'Find the area enclosed by y = ' + poly([a, -a * (p + q), a * p * q]) + ' and the x-axis.', answer: area,
          steps: ['Roots: ' + m(a) + '(x' + term(-p, '') + ')(x' + term(-q, '') + ') = 0 at x = ' + m(p) + ' and ' + m(q) + '.', 'a < 0, so the curve is above the axis between them: area = ∫_{' + m(p) + '}^{' + m(q) + '} y dx.', '= ' + F(Math.round(area * 6), 6) + '.'] };
      } },
      { id: 'const', name: 'Find C from a point', gen: function (r) {
        var a = r.nz(-3, 4), c = r.int(-5, 5), x0 = r.int(-2, 3), y0 = r.int(-10, 10), C = y0 - a * x0 * x0 - c * x0;
        return { q: 'dy/dx = ' + poly([2 * a, c]) + ' and the curve passes through (' + m(x0) + ', ' + m(y0) + '). Find the constant term of y.', answer: C,
          steps: ['Integrate each term: y = ' + poly([a, c, 0]).replace(/ \+ 0$/, '') + ' + C.', 'Substitute the point: ' + m(y0) + ' = ' + m(a * x0 * x0 + c * x0) + ' + C.', 'C = ' + m(C) + '.'] };
      } },
      { id: 'exp', name: 'Integrals of e^{kx} and 1/x', gen: function (r) {
        if (r.next() < 0.5) {
          var k = r.nz(-2, 3), a = r.int(0, 1), c = a + r.int(1, 2), v = (Math.exp(k * c) - Math.exp(k * a)) / k;
          return { q: 'Evaluate ∫_{' + a + '}^{' + c + '} e^{' + (k === 1 ? '' : m(k)) + 'x} dx to 3 s.f.', answer: v, sf: 3,
            steps: ['∫e^{kx} dx = e^{kx}/k.', '= (e^{' + m(k * c) + '} − e^{' + m(k * a) + '}) ÷ ' + b(k) + '.', '= ' + N(v, 3) + '.'] };
        }
        var cc = r.int(1, 5), lo = r.int(1, 3), hi = lo + r.int(1, 5);
        return { q: 'Evaluate ∫_{' + lo + '}^{' + hi + '} ' + cc + '/x dx to 3 s.f.', answer: cc * Math.log(hi / lo), sf: 3,
          steps: ['∫1/x dx = ln x.', '= ' + cc + '(ln ' + hi + ' − ln ' + lo + ') = ' + cc + ' ln(' + F(hi, lo) + ').', '= ' + N(cc * Math.log(hi / lo), 3) + '.'] };
      } },
      { id: 'trap', name: 'Trapezoidal rule', gen: function (r) {
        var cs = [r.int(1, 3), r.int(-2, 4), r.int(0, 6)], h = r.pick([0.5, 1]), n = r.int(3, 5), ys = [];
        for (var i = 0; i <= n; i++) ys.push(polyAt(cs, i * h));
        var mid = ys.slice(1, n).reduce(function (s, y) { return s + y; }, 0), v = h / 2 * (ys[0] + ys[n] + 2 * mid);
        return { q: 'Use the trapezoidal rule with ' + n + ' strips of width ' + h + ' to estimate ∫_{0}^{' + S(n * h) + '} (' + poly(cs) + ') dx.', answer: v,
          steps: ['y at x = ' + ys.map(function (_, i) { return S(i * h); }).join(', ') + ': ' + ys.map(function (y) { return S(y, 3); }).join(', ') + '.', 'Area ≈ h/2 × (first + last + 2 × the rest) = ' + h + '/2 × (' + S(ys[0], 3) + ' + ' + S(ys[n], 3) + ' + 2 × ' + S(mid, 4) + ').', '≈ ' + S(v, 4) + '.'] };
      } },
      { id: 'vol', name: 'Volume of revolution', gen: function (r) {
        var k = r.int(1, 4), c = r.int(1, 4), v = Math.PI * k * k * c * c / 2;
        return { q: 'The region under y = ' + (k === 1 ? '' : k) + '√x from x = 0 to x = ' + c + ' is rotated 360° about the x-axis. Find the volume to 3 s.f.', answer: v, sf: 3,
          steps: ['V = π∫y^{2} dx = π∫_{0}^{' + c + '} ' + k * k + 'x dx.', '= π[' + F(k * k, 2) + 'x^{2}]_{0}^{' + c + '} = ' + F(k * k * c * c, 2) + 'π.', '= ' + N(v, 3) + '.'] };
      } },
    ] });

  add({ id: 'm-kin', units: [AA('Kinematics'), AI('Kinematics')], title: 'Kinematics with calculus',
    method: ['Velocity v = ds/dt; acceleration a = dv/dt.', 'Displacement = ∫v dt. Distance = ∫|v| dt: split where v changes sign.', 'At rest means v = 0.'],
    variants: [
      { id: 'acc', name: 'Acceleration at a time', gen: function (r) {
        var cs = [r.nz(-2, 3), r.int(-6, 6), r.int(-5, 5)], t = r.int(1, 5), a = polyAt(deriv(cs), t);
        return { q: 'v(t) = ' + poly(cs, 't') + ' m s^{−1}. Find the acceleration when t = ' + t + '.', answer: a,
          steps: ['a = dv/dt = ' + poly(deriv(cs), 't') + '.', 'At t = ' + t + ': ' + m(a) + '.', 'a = ' + m(a) + ' m s^{−2}.'] };
      } },
      { id: 'rest', name: 'When at rest', gen: function (r) {
        var p = r.int(1, 4), q = p + r.int(1, 4), a = r.pick([1, 2, 3]);
        return { q: 'v(t) = ' + poly([a, -a * (p + q), a * p * q], 't') + '. Find the later time at which the particle is at rest.', answer: q,
          steps: ['At rest: v = 0.', (a === 1 ? '' : a) + '(t − ' + p + ')(t − ' + q + ') = 0.', 't = ' + p + ' or t = ' + q + '; the later is ' + q + ' s.'] };
      } },
      { id: 'disp', name: 'Displacement from velocity', gen: function (r) {
        var cs = [r.int(0, 3), r.int(-4, 6), r.int(0, 8)], Tt = r.int(1, 5);
        var I = function (t) { return cs[0] * t * t * t / 3 + cs[1] * t * t / 2 + cs[2] * t; };
        return { q: 'v(t) = ' + poly(cs, 't') + ' m s^{−1}. Find the displacement from t = 0 to t = ' + Tt + '.', answer: I(Tt),
          steps: ['Displacement = ∫_{0}^{' + Tt + '} v dt.', 'Integrate: ' + [cs[0] ? F(cs[0], 3) + 't^{3}' : '', cs[1] ? F(cs[1], 2) + 't^{2}' : '', cs[2] ? cs[2] + 't' : ''].filter(Boolean).join(' + ') + ', from 0 to ' + Tt + '.', '= ' + m(S(I(Tt), 4)) + ' m.'] };
      } },
      { id: 'dist', name: 'Distance when v changes sign', gen: function (r) {
        var p = r.int(1, 4), Tt = p + r.int(1, 3), d = p * p / 2 + (Tt - p) * (Tt - p) / 2;
        return { q: 'v(t) = t − ' + p + ' m s^{−1}. Find the total distance travelled from t = 0 to t = ' + Tt + '.', answer: d,
          steps: ['v = 0 at t = ' + p + ': it moves backwards before that, forwards after.', '|∫_{0}^{' + p + '} v dt| = ' + S(p * p / 2) + ' and ∫_{' + p + '}^{' + Tt + '} v dt = ' + S((Tt - p) * (Tt - p) / 2) + '.', 'Distance = ' + S(p * p / 2) + ' + ' + S((Tt - p) * (Tt - p) / 2) + ' = ' + S(d) + ' m.'] };
      } },
    ] });

  add({ id: 'm-de', units: [AA('Differential equations'), AI('Differential equations'), AI('Euler’s method')], title: 'Differential equations',
    method: ['Separate the variables: all the y with dy on one side, all the x with dx on the other, then integrate both sides.', 'dy/dx = ky gives y = Ae^{kx}: growth if k > 0, decay if k < 0.', 'Euler’s method: y_{n+1} = y_{n} + h × f(x_{n}, y_{n}), x_{n+1} = x_{n} + h.'],
    variants: [
      { id: 'growth', name: 'Exponential growth and decay', gen: function (r) {
        var A = r.int(50, 500), k = r.pick([0.02, 0.05, 0.08, 0.1, -0.03, -0.06]), t = r.int(3, 20), v = A * Math.exp(k * t);
        return { q: 'dP/dt = ' + m(k) + 'P and P(0) = ' + A + '. Find P(' + t + ') to 3 s.f.', answer: v, sf: 3,
          steps: ['Separate: ∫dP/P = ∫' + m(k) + ' dt, so ln P = ' + m(k) + 't + c and P = Ae^{' + m(k) + 't}.', 'P(0) = A = ' + A + '.', 'P(' + t + ') = ' + A + 'e^{' + m(S(k * t, 4)) + '} = ' + N(v, 3) + '.'] };
      } },
      { id: 'euler', name: 'Euler’s method', gen: function (r) {
        var h = r.pick([0.1, 0.2, 0.25, 0.5]), n = r.int(2, 4), a = r.int(1, 3), y0 = r.int(1, 3), x = 0, y = y0, lines = [];
        for (var i = 0; i < n; i++) {
          var f = x + a * y, ny = y + h * f;
          lines.push('x = ' + S(x, 3) + ', y = ' + S(y, 5) + ': f = ' + S(f, 5) + ', next y = ' + S(y, 5) + ' + ' + h + ' × ' + S(f, 5) + ' = ' + S(ny, 5) + '.');
          y = ny; x = T.round(x + h, 10);
        }
        return { q: 'dy/dx = x + ' + (a === 1 ? '' : a) + 'y with y(0) = ' + y0 + '. Use Euler’s method with step h = ' + h + ' to estimate y(' + S(x, 3) + ').', answer: y, sf: 4,
          steps: ['y_{n+1} = y_{n} + ' + h + ' × (x_{n} + ' + (a === 1 ? '' : a) + 'y_{n}).'].concat(lines) };
      } },
      { id: 'sep', name: 'Separate the variables', gen: function (r) {
        var k = r.int(1, 4), x = r.int(1, 3), y0 = r.int(1, 4), v = Math.sqrt(k * x * x + y0 * y0);
        return { q: 'dy/dx = ' + (k === 1 ? '' : k) + 'x/y with y(0) = ' + y0 + ' and y > 0. Find y when x = ' + x + ' to 3 s.f.', answer: v, sf: 3,
          steps: ['Separate: ∫y dy = ∫' + k + 'x dx, so y^{2}/2 = ' + F(k, 2) + 'x^{2} + c.', 'At x = 0, y = ' + y0 + ': c = ' + F(y0 * y0, 2) + ', so y^{2} = ' + (k === 1 ? '' : k) + 'x^{2} + ' + y0 * y0 + '.', 'y = √' + (k * x * x + y0 * y0) + ' = ' + N(v, 3) + '.'] };
      } },
    ] });

  add({ id: 'm-maclaurin', units: [AA('Maclaurin series')], title: 'Maclaurin series',
    method: ['f(x) = f(0) + f′(0)x + f″(0)x^{2}/2! + f‴(0)x^{3}/3! + …', 'Known series: e^{x} = 1 + x + x^{2}/2! + …; sin x = x − x^{3}/3! + …; cos x = 1 − x^{2}/2! + …; ln(1 + x) = x − x^{2}/2 + x^{3}/3 − …', 'For e^{kx} or sin(kx), put kx in place of x in the known series.'],
    variants: [
      { id: 'coef', name: 'Coefficient in e^{kx}', gen: function (r) {
        var k = r.nz(-3, 3), n = r.int(2, 4);
        return { q: 'Find the coefficient of x^{' + n + '} in the Maclaurin series of e^{' + m(k) + 'x}.', answer: Math.pow(k, n) / fact(n),
          steps: ['e^{u} = 1 + u + u^{2}/2! + u^{3}/3! + … with u = ' + m(k) + 'x.', 'The x^{' + n + '} term is (' + m(k) + 'x)^{' + n + '} ÷ ' + n + '!.', 'Coefficient = ' + m(Math.pow(k, n)) + ' ÷ ' + fact(n) + ' = ' + F(Math.pow(k, n), fact(n)) + '.'] };
      } },
      { id: 'approx', name: 'Estimate with the first terms', gen: function (r) {
        var x = r.pick([0.1, 0.2, 0.05, 0.3]), v = x - x * x / 2 + x * x * x / 3;
        return { q: 'Use the first three terms of the Maclaurin series of ln(1 + x) to estimate ln ' + T.round(1 + x, 2) + ' to 4 decimal places.', answer: T.round(v, 4), tol: 0.0002, dp: 4,
          steps: ['ln(1 + x) ≈ x − x^{2}/2 + x^{3}/3.', 'With x = ' + x + ': ' + x + ' − ' + S(x * x / 2, 6) + ' + ' + S(x * x * x / 3, 6) + '.', '≈ ' + T.round(v, 4).toFixed(4) + '.'] };
      } },
    ] });

  T.register(skills);
})();
