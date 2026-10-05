/* ════════════════════════════════════════════════════════════════════════
   FLUX · Calculator apps — flux-ti84-apps.js
   ------------------------------------------------------------------------
   The screens of the calculator that are forms rather than a home line:
     • the CE's STAT WIZARDS (DISTR functions paste themselves filled in;
       STAT CALC asks for its lists and where to store the regression),
     • all 18 STAT TESTS, with Data/Stats input, Calculate and Draw, their
       results stored where VARS ▸ Statistics ▸ TEST reads them,
     • APPS ▸ Finance ▸ TVM Solver (alpha enter solves the variable under
       the cursor),
     • APPS ▸ PlySmlt2: the polynomial root finder and the simultaneous
       equation solver, with the app's MAIN / MODE / CLR / SOLVE keys on
       the top row, as on the handheld.
   Inputs are remembered between visits, as the calculator does.
   ════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (window.FluxTIApps) return;

  const T = () => window.FluxTI;
  const S = () => window.FluxTIStats;
  const core = () => window.FluxTI84.core;
  const Ed = () => window.FluxTIEditor;
  const R = (v) => (typeof v === 'number' && Number.isFinite(v) ? +v.toPrecision(14) : v);
  const sub = (k) => String(k).split('').map((d) => T().SUB[d]).join('');

  /** The remembered inputs of one form, with defaults for anything new. */
  function memo(c, group, key, defaults) {
    const ui = c.st.ui;
    if (!ui[group] || typeof ui[group] !== 'object') ui[group] = {};
    const s = ui[group][key] || (ui[group][key] = {});
    Object.keys(defaults).forEach((k) => { if (!(k in s)) s[k] = defaults[k]; });
    return s;
  }
  const num = (s, key, label) => ({ label: label, type: 'num', get: () => s[key], set: (v) => { s[key] = v; } });
  /** A list field. An optional one (a frequency list) shows 1 when empty, as the tests do. */
  const lst = (s, key, label, optional, one) => ({
    label: label, type: 'list', optional: !!optional,
    get: () => s[key] || (one ? '1' : ''), set: (v) => { s[key] = v; },
  });
  const ch = (s, key, label, opts) => ({ label: label, type: 'choice', get: () => s[key], set: (v) => { s[key] = v; }, opts: opts });
  const act = (text, run) => ({ type: 'action', text: text, run: run });
  const form = (c, rows, opts) => new (core().FormApp)(c, rows, opts);
  const report = (c, title, rows) => new (core().ReportApp)(c, title, rows);

  /* ── STAT WIZARDS ───────────────────────────────────────────────────── */

  const TAIL = [['LEFT', 'LEFT'], ['CENTER', 'CENTER'], ['RIGHT', 'RIGHT']];
  /** Each field: [key, label, default, optional-at-the-end, choices]. */
  const DISTR = {
    'normalpdf(': [['x', 'x value:'], ['mu', 'μ:', 0], ['sd', 'σ:', 1]],
    'normalcdf(': [['lo', 'lower:'], ['hi', 'upper:'], ['mu', 'μ:', 0], ['sd', 'σ:', 1]],
    'invNorm(': [['area', 'area:'], ['mu', 'μ:', 0], ['sd', 'σ:', 1], ['tail', 'Tail:', 'LEFT', false, TAIL]],
    'invT(': [['area', 'Area:'], ['df', 'df:']],
    'tpdf(': [['x', 'x value:'], ['df', 'df:']],
    'tcdf(': [['lo', 'lower:'], ['hi', 'upper:'], ['df', 'df:']],
    'χ²pdf(': [['x', 'x value:'], ['df', 'df:']],
    'χ²cdf(': [['lo', 'lower:'], ['hi', 'upper:'], ['df', 'df:']],
    'Fpdf(': [['x', 'x value:'], ['d1', 'numerator df:'], ['d2', 'denominator df:']],
    'Fcdf(': [['lo', 'lower:'], ['hi', 'upper:'], ['d1', 'numerator df:'], ['d2', 'denominator df:']],
    'binompdf(': [['n', 'trials:'], ['p', 'p:'], ['x', 'x value:', '', true]],
    'binomcdf(': [['n', 'trials:'], ['p', 'p:'], ['x', 'x value:', '', true]],
    'invBinom(': [['area', 'area:'], ['n', 'trials:'], ['p', 'p:']],
    'poissonpdf(': [['mu', 'μ:'], ['x', 'x value:']],
    'poissoncdf(': [['mu', 'μ:'], ['x', 'x value:']],
    'geometpdf(': [['p', 'p:'], ['x', 'x value:']],
    'geometcdf(': [['p', 'p:'], ['x', 'x value:']],
  };

  /** A DISTR function's wizard: fill the fields, Paste puts the finished call on the home line. */
  function distrWizard(c, name) {
    const spec = DISTR[name];
    const defs = {};
    spec.forEach((f) => { defs[f[0]] = f[2] == null ? '' : f[2]; });
    const s = memo(c, 'wiz', name, defs);
    const rows = spec.map((f) => (f[4] ? ch(s, f[0], f[1], f[4]) : num(s, f[0], f[1])));
    rows.push(act('Paste', () => {
      const parts = spec.map((f) => {
        const v = s[f[0]];
        if (f[4]) return v;
        return v === '' || v == null ? '' : T().numCode(v);
      });
      // Optional arguments at the end are left off when blank.
      while (parts.length && parts[parts.length - 1] === '' && spec[parts.length - 1][3]) parts.pop();
      // The wizard pastes onto the home screen, wherever it was opened from.
      c.quit();
      c.home.ed.insertCode(name + parts.join(',') + ')');
    }));
    c.push(form(c, rows, { title: name.replace(/\($/, ''), clearCloses: true }));
    return true;
  }

  const YVARS = [['—', ''], ['Y₁', 'Y₁'], ['Y₂', 'Y₂'], ['Y₃', 'Y₃'], ['Y₄', 'Y₄'], ['Y₅', 'Y₅']];
  /** STAT ▸ CALC's wizard: the lists, where to store the equation, then Calculate on the home screen. */
  function statWizard(c, name) {
    const s = memo(c, 'wiz', name, { x: 'L₁', y: 'L₂', f: '', eq: '', it: 3, period: '' });
    const one = name === '1-Var Stats', two = name === '2-Var Stats', sin = name === 'SinReg';
    const rows = [];
    if (sin) rows.push(num(s, 'it', 'Iterations:'));
    rows.push(lst(s, 'x', one ? 'List:' : 'Xlist:'));
    if (!one) rows.push(lst(s, 'y', 'Ylist:'));
    if (!sin) rows.push(lst(s, 'f', 'FreqList:', true));
    if (sin) rows.push(num(s, 'period', 'Period:'));
    if (!one && !two) rows.push(ch(s, 'eq', 'Store RegEQ:', YVARS));
    rows.push(act('Calculate', () => {
      const args = [s.x];
      if (sin) args.unshift(T().numCode(s.it));
      if (!one) args.push(s.y);
      if (!sin && s.f) args.push(s.f);
      if (sin && s.period !== '' && s.period != null) args.push(T().numCode(s.period));
      if (s.eq && !one && !two) args.push(s.eq);
      // The command goes onto the home screen and runs there, as the CE does it.
      c.quit();
      c.home.ed.load(Ed().nodesFromCode(name + ' ' + args.join(',')));
      c.home.exec();
    }));
    c.push(form(c, rows, { title: name, clearCloses: true }));
    return true;
  }

  function wizard(c, name) {
    if (DISTR[name]) return distrWizard(c, name);
    if (T().STAT_CMDS.indexOf(name) >= 0) return statWizard(c, name);
    return false;
  }

  /* ── STAT TESTS ─────────────────────────────────────────────────────── */

  const INPT = [['Data', 'data'], ['Stats', 'stats']];
  const ALT = { ne: '≠', lt: '<', gt: '>' };
  const alts = (sym) => [['≠' + sym, 'ne'], ['<' + sym, 'lt'], ['>' + sym, 'gt']];
  const POOLED = [['No', false], ['Yes', true]];
  const MATS = ['A', 'B', 'C', 'D', 'E'].map((m) => ['[' + m + ']', m]);

  function listData(c, name) {
    const l = c.st.lists[name];
    if (!Array.isArray(l)) T().fail('UNDEFINED');
    return l.map((v) => { if (typeof v !== 'number') T().fail('DATA TYPE'); return v; });
  }
  function freqData(c, name, n) {
    if (!name || name === '1') return null;
    const f = listData(c, name);
    if (f.length !== n) T().fail('DIM MISMATCH');
    return f;
  }
  /** x̄, Sx and n of a list (with its frequencies). */
  function sample(c, list, freq) {
    const xs = listData(c, list);
    const o = S().oneVar(xs, freqData(c, freq, xs.length));
    return { xbar: o.mean, sx: o.Sx, n: o.n };
  }
  function pairs(c, s) {
    const xs = listData(c, s.x), ys = listData(c, s.y);
    if (xs.length !== ys.length) T().fail('DIM MISMATCH');
    return { xs: xs, ys: ys, fs: freqData(c, s.f, xs.length) };
  }
  const fx = (c, v) => core().fmt(R(v), c.st.mode);
  const interval = (c, lo, hi) => '(' + fx(c, lo) + ',' + fx(c, hi) + ')';
  /** Store the regression line a LinReg test found, when a Y= was chosen. */
  function storeEq(c, yName, a, b) {
    const text = T().regEqText({ kind: 'LinReg(a+bx)', coef: { a: a, b: b } });
    c.st.sys.RegEQ = text;
    if (!yName) return;
    c.st.y[yName] = text;
    delete c.st.ui.ynodes[yName];
    c.st.ui.yOn[yName] = true;
  }
  /** Data or Stats rows for one sample. */
  const oneInput = (s, statsRows) => (s.inpt === 'data' ? [lst(s, 'list', 'List:'), lst(s, 'freq', 'Freq:', true, true)] : statsRows);
  const twoInput = (s, statsRows) => (s.inpt === 'data'
    ? [lst(s, 'l1', 'List1:'), lst(s, 'l2', 'List2:'), lst(s, 'f1', 'Freq1:', true, true), lst(s, 'f2', 'Freq2:', true, true)]
    : statsRows);
  const two = (c, s, x1, sx1, n1, x2, sx2, n2) => (s.inpt === 'data'
    ? [sample(c, s.l1, s.f1), sample(c, s.l2, s.f2)]
    : [{ xbar: s[x1], sx: sx1 ? s[sx1] : undefined, n: s[n1] }, { xbar: s[x2], sx: sx2 ? s[sx2] : undefined, n: s[n2] }]);

  const TESTS = {
    ztest: {
      title: 'Z-Test', draw: true,
      defaults: { inpt: 'data', mu0: 0, sigma: 1, list: 'L₁', freq: '', xbar: 0, n: 1, alt: 'ne' },
      rows: (s) => [ch(s, 'inpt', 'Inpt:', INPT), num(s, 'mu0', 'μ₀:'), num(s, 'sigma', 'σ:')]
        .concat(oneInput(s, [num(s, 'xbar', 'x̄:'), num(s, 'n', 'n:')]), [ch(s, 'alt', 'μ:', alts('μ₀'))]),
      run: (c, s) => {
        const d = s.inpt === 'data' ? sample(c, s.list, s.freq) : { xbar: s.xbar, n: s.n };
        const r = S().zTest(s.mu0, s.sigma, d.xbar, d.n, s.alt);
        return {
          rows: [['', 'μ' + ALT[s.alt] + fx(c, s.mu0)], ['z', r.z], ['p', r.p], ['x̄', d.xbar]].concat(d.sx != null ? [['Sx', d.sx]] : [], [['n', d.n]]),
          sys: { z: r.z, p: r.p, 'x̄': d.xbar, Sx: d.sx, n: d.n },
          dist: { k: 'z', stat: r.z, p: r.p, alt: s.alt, label: 'z' },
        };
      },
    },
    ttest: {
      title: 'T-Test', draw: true,
      defaults: { inpt: 'data', mu0: 0, list: 'L₁', freq: '', xbar: 0, sx: 1, n: 2, alt: 'ne' },
      rows: (s) => [ch(s, 'inpt', 'Inpt:', INPT), num(s, 'mu0', 'μ₀:')]
        .concat(oneInput(s, [num(s, 'xbar', 'x̄:'), num(s, 'sx', 'Sx:'), num(s, 'n', 'n:')]), [ch(s, 'alt', 'μ:', alts('μ₀'))]),
      run: (c, s) => {
        const d = s.inpt === 'data' ? sample(c, s.list, s.freq) : { xbar: s.xbar, sx: s.sx, n: s.n };
        const r = S().tTest(s.mu0, d.xbar, d.sx, d.n, s.alt);
        return {
          rows: [['', 'μ' + ALT[s.alt] + fx(c, s.mu0)], ['t', r.t], ['p', r.p], ['df', r.df], ['x̄', d.xbar], ['Sx', d.sx], ['n', d.n]],
          sys: { t: r.t, p: r.p, df: r.df, 'x̄': d.xbar, Sx: d.sx, n: d.n },
          dist: { k: 't', df: r.df, stat: r.t, p: r.p, alt: s.alt, label: 't' },
        };
      },
    },
    z2test: {
      title: '2-SampZTest', draw: true,
      defaults: { inpt: 'data', s1: 1, s2: 1, l1: 'L₁', l2: 'L₂', f1: '', f2: '', x1: 0, n1: 1, x2: 0, n2: 1, alt: 'ne' },
      rows: (s) => [ch(s, 'inpt', 'Inpt:', INPT), num(s, 's1', 'σ1:'), num(s, 's2', 'σ2:')]
        .concat(twoInput(s, [num(s, 'x1', 'x̄1:'), num(s, 'n1', 'n1:'), num(s, 'x2', 'x̄2:'), num(s, 'n2', 'n2:')]), [ch(s, 'alt', 'μ1:', alts('μ2'))]),
      run: (c, s) => {
        const [a, b] = two(c, s, 'x1', null, 'n1', 'x2', null, 'n2');
        const r = S().twoSampZTest(s.s1, s.s2, a.xbar, a.n, b.xbar, b.n, s.alt);
        const sx = a.sx != null ? [['Sx1', a.sx], ['Sx2', b.sx]] : [];
        return {
          rows: [['', 'μ1' + ALT[s.alt] + 'μ2'], ['z', r.z], ['p', r.p], ['x̄1', a.xbar], ['x̄2', b.xbar]].concat(sx, [['n1', a.n], ['n2', b.n]]),
          sys: { z: r.z, p: r.p, 'x̄1': a.xbar, 'x̄2': b.xbar, Sx1: a.sx, Sx2: b.sx, n1: a.n, n2: b.n },
          dist: { k: 'z', stat: r.z, p: r.p, alt: s.alt, label: 'z' },
        };
      },
    },
    t2test: {
      title: '2-SampTTest', draw: true,
      defaults: { inpt: 'data', l1: 'L₁', l2: 'L₂', f1: '', f2: '', x1: 0, sx1: 1, n1: 2, x2: 0, sx2: 1, n2: 2, alt: 'ne', pooled: false },
      rows: (s) => [ch(s, 'inpt', 'Inpt:', INPT)]
        .concat(twoInput(s, [num(s, 'x1', 'x̄1:'), num(s, 'sx1', 'Sx1:'), num(s, 'n1', 'n1:'), num(s, 'x2', 'x̄2:'), num(s, 'sx2', 'Sx2:'), num(s, 'n2', 'n2:')]),
          [ch(s, 'alt', 'μ1:', alts('μ2')), ch(s, 'pooled', 'Pooled:', POOLED)]),
      run: (c, s) => {
        const [a, b] = two(c, s, 'x1', 'sx1', 'n1', 'x2', 'sx2', 'n2');
        const r = S().twoSampTTest(a.xbar, a.sx, a.n, b.xbar, b.sx, b.n, s.alt, s.pooled);
        return {
          rows: [['', 'μ1' + ALT[s.alt] + 'μ2'], ['t', r.t], ['p', r.p], ['df', r.df], ['x̄1', a.xbar], ['x̄2', b.xbar], ['Sx1', a.sx], ['Sx2', b.sx]]
            .concat(s.pooled ? [['Sxp', r.sxp]] : [], [['n1', a.n], ['n2', b.n]]),
          sys: { t: r.t, p: r.p, df: r.df, 'x̄1': a.xbar, 'x̄2': b.xbar, Sx1: a.sx, Sx2: b.sx, Sxp: s.pooled ? r.sxp : undefined, n1: a.n, n2: b.n },
          dist: { k: 't', df: r.df, stat: r.t, p: r.p, alt: s.alt, label: 't' },
        };
      },
    },
    p1test: {
      title: '1-PropZTest', draw: true,
      defaults: { p0: 0.5, x: 0, n: 1, alt: 'ne' },
      rows: (s) => [num(s, 'p0', 'p₀:'), num(s, 'x', 'x:'), num(s, 'n', 'n:'), ch(s, 'alt', 'prop', alts('p₀'))],
      run: (c, s) => {
        const r = S().onePropZTest(s.p0, s.x, s.n, s.alt);
        return {
          rows: [['', 'prop' + ALT[s.alt] + fx(c, s.p0)], ['z', r.z], ['p', r.p], ['p̂', r.phat], ['n', s.n]],
          sys: { z: r.z, p: r.p, 'p̂': r.phat, n: s.n },
          dist: { k: 'z', stat: r.z, p: r.p, alt: s.alt, label: 'z' },
        };
      },
    },
    p2test: {
      title: '2-PropZTest', draw: true,
      defaults: { x1: 0, n1: 1, x2: 0, n2: 1, alt: 'ne' },
      rows: (s) => [num(s, 'x1', 'x1:'), num(s, 'n1', 'n1:'), num(s, 'x2', 'x2:'), num(s, 'n2', 'n2:'), ch(s, 'alt', 'p1:', alts('p2'))],
      run: (c, s) => {
        const r = S().twoPropZTest(s.x1, s.n1, s.x2, s.n2, s.alt);
        return {
          rows: [['', 'p1' + ALT[s.alt] + 'p2'], ['z', r.z], ['p', r.p], ['p̂1', r.p1], ['p̂2', r.p2], ['p̂', r.phat], ['n1', s.n1], ['n2', s.n2]],
          sys: { z: r.z, p: r.p, 'p̂1': r.p1, 'p̂2': r.p2, 'p̂': r.phat, n1: s.n1, n2: s.n2 },
          dist: { k: 'z', stat: r.z, p: r.p, alt: s.alt, label: 'z' },
        };
      },
    },
    zint: {
      title: 'ZInterval',
      defaults: { inpt: 'data', sigma: 1, list: 'L₁', freq: '', xbar: 0, n: 1, C: 0.95 },
      rows: (s) => [ch(s, 'inpt', 'Inpt:', INPT), num(s, 'sigma', 'σ:')]
        .concat(oneInput(s, [num(s, 'xbar', 'x̄:'), num(s, 'n', 'n:')]), [num(s, 'C', 'C-Level:')]),
      run: (c, s) => {
        const d = s.inpt === 'data' ? sample(c, s.list, s.freq) : { xbar: s.xbar, n: s.n };
        const r = S().zInterval(s.sigma, d.xbar, d.n, s.C);
        return {
          rows: [['', interval(c, r.lo, r.hi)], ['ME', r.me], ['x̄', d.xbar]].concat(d.sx != null ? [['Sx', d.sx]] : [], [['n', d.n]]),
          sys: { lower: r.lo, upper: r.hi, 'x̄': d.xbar, Sx: d.sx, n: d.n },
        };
      },
    },
    tint: {
      title: 'TInterval',
      defaults: { inpt: 'data', list: 'L₁', freq: '', xbar: 0, sx: 1, n: 2, C: 0.95 },
      rows: (s) => [ch(s, 'inpt', 'Inpt:', INPT)]
        .concat(oneInput(s, [num(s, 'xbar', 'x̄:'), num(s, 'sx', 'Sx:'), num(s, 'n', 'n:')]), [num(s, 'C', 'C-Level:')]),
      run: (c, s) => {
        const d = s.inpt === 'data' ? sample(c, s.list, s.freq) : { xbar: s.xbar, sx: s.sx, n: s.n };
        const r = S().tInterval(d.xbar, d.sx, d.n, s.C);
        return {
          rows: [['', interval(c, r.lo, r.hi)], ['ME', r.me], ['df', r.df], ['x̄', d.xbar], ['Sx', d.sx], ['n', d.n]],
          sys: { lower: r.lo, upper: r.hi, df: r.df, 'x̄': d.xbar, Sx: d.sx, n: d.n },
        };
      },
    },
    z2int: {
      title: '2-SampZInt',
      defaults: { inpt: 'data', s1: 1, s2: 1, l1: 'L₁', l2: 'L₂', f1: '', f2: '', x1: 0, n1: 1, x2: 0, n2: 1, C: 0.95 },
      rows: (s) => [ch(s, 'inpt', 'Inpt:', INPT), num(s, 's1', 'σ1:'), num(s, 's2', 'σ2:')]
        .concat(twoInput(s, [num(s, 'x1', 'x̄1:'), num(s, 'n1', 'n1:'), num(s, 'x2', 'x̄2:'), num(s, 'n2', 'n2:')]), [num(s, 'C', 'C-Level:')]),
      run: (c, s) => {
        const [a, b] = two(c, s, 'x1', null, 'n1', 'x2', null, 'n2');
        const r = S().twoSampZInt(s.s1, s.s2, a.xbar, a.n, b.xbar, b.n, s.C);
        const sx = a.sx != null ? [['Sx1', a.sx], ['Sx2', b.sx]] : [];
        return {
          rows: [['', interval(c, r.lo, r.hi)], ['x̄1', a.xbar], ['x̄2', b.xbar]].concat(sx, [['n1', a.n], ['n2', b.n]]),
          sys: { lower: r.lo, upper: r.hi, 'x̄1': a.xbar, 'x̄2': b.xbar, Sx1: a.sx, Sx2: b.sx, n1: a.n, n2: b.n },
        };
      },
    },
    t2int: {
      title: '2-SampTInt',
      defaults: { inpt: 'data', l1: 'L₁', l2: 'L₂', f1: '', f2: '', x1: 0, sx1: 1, n1: 2, x2: 0, sx2: 1, n2: 2, C: 0.95, pooled: false },
      rows: (s) => [ch(s, 'inpt', 'Inpt:', INPT)]
        .concat(twoInput(s, [num(s, 'x1', 'x̄1:'), num(s, 'sx1', 'Sx1:'), num(s, 'n1', 'n1:'), num(s, 'x2', 'x̄2:'), num(s, 'sx2', 'Sx2:'), num(s, 'n2', 'n2:')]),
          [num(s, 'C', 'C-Level:'), ch(s, 'pooled', 'Pooled:', POOLED)]),
      run: (c, s) => {
        const [a, b] = two(c, s, 'x1', 'sx1', 'n1', 'x2', 'sx2', 'n2');
        const r = S().twoSampTInt(a.xbar, a.sx, a.n, b.xbar, b.sx, b.n, s.C, s.pooled);
        return {
          rows: [['', interval(c, r.lo, r.hi)], ['df', r.df], ['x̄1', a.xbar], ['x̄2', b.xbar], ['Sx1', a.sx], ['Sx2', b.sx]]
            .concat(s.pooled ? [['Sxp', r.sxp]] : [], [['n1', a.n], ['n2', b.n]]),
          sys: { lower: r.lo, upper: r.hi, df: r.df, 'x̄1': a.xbar, 'x̄2': b.xbar, Sx1: a.sx, Sx2: b.sx, Sxp: s.pooled ? r.sxp : undefined, n1: a.n, n2: b.n },
        };
      },
    },
    p1int: {
      title: '1-PropZInt',
      defaults: { x: 0, n: 1, C: 0.95 },
      rows: (s) => [num(s, 'x', 'x:'), num(s, 'n', 'n:'), num(s, 'C', 'C-Level:')],
      run: (c, s) => {
        if (!(s.n > 0) || s.x < 0 || s.x > s.n) T().fail('DOMAIN');
        const r = S().onePropZInt(s.x, s.n, s.C);
        return { rows: [['', interval(c, r.lo, r.hi)], ['p̂', r.phat], ['n', s.n]], sys: { lower: r.lo, upper: r.hi, 'p̂': r.phat, n: s.n } };
      },
    },
    p2int: {
      title: '2-PropZInt',
      defaults: { x1: 0, n1: 1, x2: 0, n2: 1, C: 0.95 },
      rows: (s) => [num(s, 'x1', 'x1:'), num(s, 'n1', 'n1:'), num(s, 'x2', 'x2:'), num(s, 'n2', 'n2:'), num(s, 'C', 'C-Level:')],
      run: (c, s) => {
        if (!(s.n1 > 0 && s.n2 > 0)) T().fail('DOMAIN');
        const r = S().twoPropZInt(s.x1, s.n1, s.x2, s.n2, s.C);
        return {
          rows: [['', interval(c, r.lo, r.hi)], ['p̂1', r.p1], ['p̂2', r.p2], ['n1', s.n1], ['n2', s.n2]],
          sys: { lower: r.lo, upper: r.hi, 'p̂1': r.p1, 'p̂2': r.p2, n1: s.n1, n2: s.n2 },
        };
      },
    },
    chi2: {
      title: 'χ²-Test', draw: true,
      defaults: { obs: 'A', exp: 'B' },
      rows: (s) => [ch(s, 'obs', 'Observed:', MATS), ch(s, 'exp', 'Expected:', MATS)],
      run: (c, s) => {
        const M = c.st.mats[s.obs];
        if (!M) T().fail('UNDEFINED');
        const r = S().chi2Test(M);
        // The expected counts are stored, as the calculator does, for checking the conditions.
        c.st.mats[s.exp] = r.expected.map((row) => row.map(R));
        return {
          rows: [['χ²', r.chi2], ['p', r.p], ['df', r.df], ['', 'Expected counts are in [' + s.exp + ']']],
          sys: { 'χ²': r.chi2, p: r.p, df: r.df },
          dist: { k: 'chi2', df: r.df, stat: r.chi2, p: r.p, alt: 'gt', label: 'χ²' },
        };
      },
    },
    chi2gof: {
      title: 'χ²GOF-Test', draw: true,
      defaults: { obs: 'L₁', exp: 'L₂', df: 1 },
      rows: (s) => [lst(s, 'obs', 'Observed:'), lst(s, 'exp', 'Expected:'), num(s, 'df', 'df:')],
      run: (c, s) => {
        const r = S().chi2GOF(listData(c, s.obs), listData(c, s.exp), s.df);
        c.st.lists['ʟCNTRB'] = r.cntrb.map(R);
        return {
          rows: [['χ²', r.chi2], ['p', r.p], ['df', r.df], ['CNTRB', '{' + r.cntrb.map((v) => fx(c, v)).join(' ') + '}']],
          sys: { 'χ²': r.chi2, p: r.p, df: r.df },
          dist: { k: 'chi2', df: r.df, stat: r.chi2, p: r.p, alt: 'gt', label: 'χ²' },
        };
      },
    },
    ftest: {
      title: '2-SampFTest', draw: true,
      defaults: { inpt: 'data', l1: 'L₁', l2: 'L₂', f1: '', f2: '', sx1: 1, n1: 2, sx2: 1, n2: 2, alt: 'ne' },
      rows: (s) => [ch(s, 'inpt', 'Inpt:', INPT)]
        .concat(twoInput(s, [num(s, 'sx1', 'Sx1:'), num(s, 'n1', 'n1:'), num(s, 'sx2', 'Sx2:'), num(s, 'n2', 'n2:')]), [ch(s, 'alt', 'σ1:', alts('σ2'))]),
      run: (c, s) => {
        const [a, b] = two(c, s, null, 'sx1', 'n1', null, 'sx2', 'n2');
        const r = S().twoSampFTest(a.sx, a.n, b.sx, b.n, s.alt);
        const means = s.inpt === 'data' ? [['x̄1', a.xbar], ['x̄2', b.xbar]] : [];
        return {
          rows: [['', 'σ1' + ALT[s.alt] + 'σ2'], ['F', r.F], ['p', r.p], ['Sx1', a.sx], ['Sx2', b.sx]].concat(means, [['n1', a.n], ['n2', b.n]]),
          sys: { F: r.F, p: r.p, Sx1: a.sx, Sx2: b.sx, 'x̄1': s.inpt === 'data' ? a.xbar : undefined, 'x̄2': s.inpt === 'data' ? b.xbar : undefined, n1: a.n, n2: b.n },
          dist: { k: 'F', d1: r.df1, d2: r.df2, stat: r.F, p: r.p, alt: s.alt, label: 'F' },
        };
      },
    },
    lrttest: {
      title: 'LinRegTTest',
      defaults: { x: 'L₁', y: 'L₂', f: '', alt: 'ne', eq: '' },
      rows: (s) => [lst(s, 'x', 'Xlist:'), lst(s, 'y', 'Ylist:'), lst(s, 'f', 'Freq:', true, true), ch(s, 'alt', 'β & ρ:', alts('0')), ch(s, 'eq', 'RegEQ:', YVARS)],
      run: (c, s) => {
        const d = pairs(c, s);
        const r = S().linRegTTest(d.xs, d.ys, d.fs, s.alt);
        storeEq(c, s.eq, r.a, r.b);
        return {
          rows: [['', 'y=a+bx'], ['', 'β' + ALT[s.alt] + '0 and ρ' + ALT[s.alt] + '0'], ['t', r.t], ['p', r.p], ['df', r.df], ['a', r.a], ['b', r.b], ['s', r.s], ['r²', r.r2], ['r', r.r]],
          sys: { t: r.t, p: r.p, df: r.df, a: r.a, b: r.b, s: r.s, 'r²': r.r2, r: r.r },
        };
      },
    },
    lrtint: {
      title: 'LinRegTInt',
      defaults: { x: 'L₁', y: 'L₂', f: '', C: 0.95, eq: '' },
      rows: (s) => [lst(s, 'x', 'Xlist:'), lst(s, 'y', 'Ylist:'), lst(s, 'f', 'Freq:', true, true), num(s, 'C', 'C-Level:'), ch(s, 'eq', 'RegEQ:', YVARS)],
      run: (c, s) => {
        const d = pairs(c, s);
        const r = S().linRegTInt(d.xs, d.ys, d.fs, s.C);
        storeEq(c, s.eq, r.a, r.b);
        return {
          rows: [['', 'y=a+bx'], ['', interval(c, r.lo, r.hi)], ['b', r.b], ['ME', r.me], ['df', r.df], ['s', r.s], ['a', r.a], ['r²', r.r2], ['r', r.r]],
          sys: { lower: r.lo, upper: r.hi, b: r.b, df: r.df, s: r.s, a: r.a, 'r²': r.r2, r: r.r },
        };
      },
    },
    anova: {
      title: 'One-way ANOVA',
      defaults: { l1: 'L₁', l2: 'L₂', l3: '', l4: '', l5: '', l6: '' },
      rows: (s) => [lst(s, 'l1', 'List1:'), lst(s, 'l2', 'List2:'), lst(s, 'l3', 'List3:', true), lst(s, 'l4', 'List4:', true),
        lst(s, 'l5', 'List5:', true), lst(s, 'l6', 'List6:', true)],
      run: (c, s) => {
        const groups = ['l1', 'l2', 'l3', 'l4', 'l5', 'l6'].filter((k) => s[k]).map((k) => listData(c, s[k]));
        const r = S().anova(groups);
        return {
          rows: [['F', r.F], ['p', r.p], ['Factor', ''], [' df', r.factor.df], [' SS', r.factor.SS], [' MS', r.factor.MS],
            ['Error', ''], [' df', r.error.df], [' SS', r.error.SS], [' MS', r.error.MS], ['Sxp', r.sxp]],
          sys: { F: r.F, p: r.p, Sxp: r.sxp },
        };
      },
    },
  };

  function test(c, id) {
    const d = TESTS[id];
    if (!d) return false;
    const s = memo(c, 'tests', id, d.defaults);
    const calc = (drawIt) => {
      const r = d.run(c, s);
      Object.keys(r.sys || {}).forEach((k) => { if (r.sys[k] !== undefined) c.st.sys[k] = R(r.sys[k]); });
      if (drawIt && r.dist) { drawDist(c, r.dist); return; }
      c.push(report(c, d.title, r.rows));
    };
    const rows = () => d.rows(s).concat([act('Calculate', () => calc(false))], d.draw ? [act('Draw', () => calc(true))] : []);
    c.push(form(c, rows, { title: d.title, clearCloses: true }));
    return true;
  }

  /** x where an increasing cdf reaches target (bisection). */
  function quantile(cdf, target) {
    let a = 0, b = 1;
    while (cdf(b) < target && b < 1e8) b *= 2;
    for (let i = 0; i < 200; i++) { const m = (a + b) / 2; if (cdf(m) < target) a = m; else b = m; }
    return (a + b) / 2;
  }

  /** A test's Draw: the distribution, the p-value shaded, the statistic and p written under it. */
  function drawDist(c, D) {
    const st = c.st, G = window.FluxTIGraph, St = S();
    if (!G) return;
    let pdf, name, params;
    if (D.k === 'z') { pdf = (x) => St.normalpdf(x, 0, 1); name = 'ShadeNorm('; params = [0, 1]; }
    else if (D.k === 't') { pdf = (x) => St.tpdf(x, D.df); name = 'Shade_t('; params = [D.df]; }
    else if (D.k === 'chi2') { pdf = (x) => St.chi2pdf(x, D.df); name = 'Shadeχ²('; params = [D.df]; }
    else { pdf = (x) => St.Fpdf(x, D.d1, D.d2); name = 'ShadeF('; params = [D.d1, D.d2]; }
    const sym = D.k === 'z' || D.k === 't';
    let xmin, xmax;
    if (sym) { const h = Math.max(3.5, Math.min(Math.abs(D.stat) * 1.15, 12)); xmin = -h; xmax = h; }
    else if (D.k === 'chi2') { xmin = 0; xmax = Math.max(D.df + 4 * Math.sqrt(2 * D.df), Math.min(D.stat * 1.15, 1e4)); }
    else { xmin = 0; xmax = Math.max(5, Math.min(D.stat * 1.15, 100)); }
    let peak = 0;
    for (let i = 4; i <= 200; i++) { const y = pdf(xmin + (xmax - xmin) * i / 200); if (Number.isFinite(y)) peak = Math.max(peak, y); }
    if (!(peak > 0)) peak = 0.5;
    const step = sym ? 1 : Math.pow(10, Math.floor(Math.log10(xmax / 4)));
    Object.assign(st.win, { Xmin: xmin, Xmax: xmax, Xscl: step, Ymin: -peak * 0.32, Ymax: peak * 1.15, Yscl: 0 });
    const BIG = 1e99;
    const regions = [];
    if (D.alt === 'lt') regions.push([sym ? -BIG : 0, D.stat]);
    else if (D.alt === 'gt') regions.push([D.stat, BIG]);
    else if (sym) { const a = Math.abs(D.stat); regions.push([-BIG, -a], [a, BIG]); }
    else {
      // Two-sided F: the tail the statistic is in, and the same area in the other tail.
      const cdf = (x) => St.Fcdf(0, x, D.d1, D.d2);
      const lower = cdf(D.stat);
      if (lower <= 0.5) regions.push([0, D.stat], [quantile(cdf, 1 - lower), BIG]);
      else regions.push([D.stat, BIG], [0, quantile(cdf, 1 - lower)]);
    }
    const f6 = (v) => T().fmtReal(+(+v).toPrecision(6));
    st.ui.draw = regions.map((r) => ({ k: 'shade', a: r[0], b: r[1], dist: { name: name, a: [r[0], r[1]].concat(params) }, colour: '#1f6feb' }));
    st.ui.draw.push({ k: 'text', row: 136, col: 4, text: D.label + '=' + f6(D.stat) });
    st.ui.draw.push({ k: 'text', row: 150, col: 4, text: 'p=' + f6(D.p) });
    G.markDrawn(st);
    c.push(new G.GraphApp(c, { only: true }));
  }

  /* ── APPS ▸ Finance ▸ TVM Solver ────────────────────────────────────── */

  function tvm(c) {
    const t = c.st.tvm;
    let solved = '';
    const K = [['N', 'N'], ['I%', 'I'], ['PV', 'PV'], ['PMT', 'PMT'], ['FV', 'FV']];
    const rows = () => K.map((k) => ({
      label: (solved === k[1] ? '▪' : '') + k[0] + '=', type: 'num',
      get: () => t[k[1]],
      set: (v) => { t[k[1]] = v; solved = ''; },
      solve: () => { t[k[1]] = R(S().tvmSolve(t, k[1])); solved = k[1]; },
    })).concat([
      // Setting P/Y sets C/Y to match, as on the calculator.
      { label: 'P/Y=', type: 'num', get: () => t.PY, set: (v) => { if (!(v > 0)) T().fail('DOMAIN'); t.PY = v; t.CY = v; } },
      { label: 'C/Y=', type: 'num', get: () => t.CY, set: (v) => { if (!(v > 0)) T().fail('DOMAIN'); t.CY = v; } },
      { label: 'PMT:', type: 'choice', get: () => t.begin, set: (v) => { t.begin = v; }, opts: [['END', false], ['BEGIN', true]] },
    ]);
    c.push(form(c, rows, { title: 'TVM Solver', footer: 'Put the cursor on the unknown, then alpha enter (SOLVE).' }));
  }

  /* ── APPS ▸ PlySmlt2 ────────────────────────────────────────────────── */

  /** A one-page menu whose picks run a function. */
  function menuOf(c, title, items, onPick) {
    const M = core().MenuApp;
    const m = new M(c, 'APPS', c.home);
    m.tabs = [{ name: title, items: items }];
    m.key = function (k) {
      let idx = null;
      if (/^[1-9]$/.test(k)) idx = Number(k) - 1;
      else if (k === 'enter') idx = this.sel;
      if (idx == null) return M.prototype.key.call(this, k);
      const it = items[idx];
      if (it) { c.pop(); onPick(it); }
      return true;
    };
    return m;
  }

  function plysmlt(c) {
    c.push(menuOf(c, 'PlySmlt2', [
      { l: 'POLY ROOT FINDER', v: 'poly' }, { l: 'SIMULT EQN SOLVER', v: 'simul' }, { l: 'ABOUT', v: 'about' }, { l: 'QUIT APP', v: 'quit' },
    ], (it) => {
      if (it.v === 'poly') polySetup(c);
      else if (it.v === 'simul') simulSetup(c);
      else if (it.v === 'about') {
        c.push(report(c, 'PlySmlt2', [['Roots of polynomials', ''], ['up to degree 10, and', ''], ['systems of up to 10', ''],
          ['equations in 10 unknowns.', ''], ['', ''], ['On the entry screens:', ''], ['graph = SOLVE', ''], ['y= = MAIN  window = MODE', ''], ['zoom = CLR', '']]));
      }
    }));
  }
  /** The app's own keys, on the top row: y= MAIN, window MODE, zoom CLR, graph SOLVE. */
  function appKeys(c, k, solve, clear) {
    if (k === 'yequ') { c.quit(); plysmlt(c); return true; }
    if (k === 'window') { c.pop(); return true; }
    if (k === 'zoom') { clear(); return true; }
    if (k === 'graph' || k === 'solve') { solve(); return true; }
    return false;
  }
  const BAR = '<div class="t84ps-bar"><span>MAIN</span><span>MODE</span><span>CLR</span><span></span><span>SOLVE</span></div>';

  const whole = (lo, hi) => (v) => { if (v !== Math.floor(v) || v < lo || v > hi) T().fail('DOMAIN'); return v; };

  function polySetup(c) {
    const s = memo(c, 'plysmlt', 'poly', { order: 2, roots: 'a+bi', coef: [] });
    const rows = [
      { label: 'ORDER=', type: 'num', get: () => s.order, set: (v) => { s.order = whole(1, 10)(v); } },
      ch(s, 'roots', 'ROOTS:', [['REAL', 'real'], ['a+bi', 'a+bi']]),
      act('NEXT ▸', () => polyCoef(c, s)),
    ];
    c.push(form(c, rows, { title: 'POLY ROOT FINDER MODE', clearCloses: true }));
  }
  const SUP = ['', '', '²', '³', '⁴', '⁵', '⁶', '⁷', '⁸', '⁹', '¹⁰'];
  function polyCoef(c, s) {
    const n = s.order;
    while (s.coef.length < 11) s.coef.push(0);
    const term = (k) => 'a' + sub(k) + (k > 0 ? 'x' + SUP[k] : '');
    const eq = [];
    for (let k = n; k >= 0; k--) eq.push(term(k));
    const rows = [{ type: 'text', text: eq.join('+') + '=0' }];
    for (let k = n; k >= 0; k--) rows.push({ label: 'a' + sub(k) + '=', type: 'num', get: () => s.coef[k], set: (v) => { s.coef[k] = v; } });
    rows.push(act('SOLVE', () => polySolve(c, s)));
    const f = form(c, rows, { title: 'ORDER ' + n + ' POLYNOMIAL' });
    const base = f.key.bind(f);
    f.key = (k) => appKeys(c, k, () => { f.commit(); polySolve(c, s); }, () => { f.ed = null; for (let i = 0; i <= 10; i++) s.coef[i] = 0; }) || base(k);
    const render = f.render.bind(f);
    f.render = () => render().replace(/<\/div>$/, BAR + '</div>');
    c.push(f);
  }
  /** a+bi for a root [re, im]; REAL mode says nonreal instead. */
  function rootText(c, r, mode) {
    const f = (v) => T().fmtReal(+v.toPrecision(10), c.st.mode);
    if (r[1] === 0) return f(r[0]);
    if (mode === 'real') return 'nonreal';
    const im = Math.abs(r[1]) === 1 ? '' : f(Math.abs(r[1]));
    if (r[0] === 0) return (r[1] < 0 ? '-' : '') + im + 'i';
    return f(r[0]) + (r[1] < 0 ? '-' : '+') + im + 'i';
  }
  function polySolve(c, s) {
    const co = [];
    for (let k = s.order; k >= 0; k--) co.push(s.coef[k] || 0);
    if (co[0] === 0) T().fail('DOMAIN');
    const roots = S().polyRoots(co);
    const rows = roots.map((r, i) => ['x' + sub(i + 1), rootText(c, r, s.roots)]);
    // The real roots also go to Ans as a list, ready to use on the home screen.
    const reals = roots.filter((r) => r[1] === 0).map((r) => R(r[0]));
    if (reals.length) c.st.ans = T().list(reals);
    c.push(report(c, 'SOLUTION', rows.concat(reals.length ? [['', ''], ['Real roots are in Ans.', '']] : [])));
  }

  function simulSetup(c) {
    const s = memo(c, 'plysmlt', 'simul', { eqs: 2, vars: 2, m: [] });
    const rows = [
      { label: 'EQUATIONS=', type: 'num', get: () => s.eqs, set: (v) => { s.eqs = whole(1, 10)(v); } },
      { label: 'UNKNOWNS=', type: 'num', get: () => s.vars, set: (v) => { s.vars = whole(1, 10)(v); } },
      act('NEXT ▸', () => c.push(new GridApp(c, s))),
    ];
    c.push(form(c, rows, { title: 'SIMULT EQN SOLVER MODE', clearCloses: true }));
  }

  /** The system's augmented matrix, one equation per row, the constants last. */
  function GridApp(c, s) { this.c = c; this.s = s; this.r = 0; this.col = 0; this.ed = null; this.top0 = 0; this.left0 = 0; }
  GridApp.prototype.dims = function () { return [this.s.eqs, this.s.vars + 1]; };
  GridApp.prototype.cell = function (i, j) { const row = this.s.m[i]; return row && typeof row[j] === 'number' ? row[j] : 0; };
  GridApp.prototype.editor = function () { return this.ed || (this.ed = new (Ed())({ mathprint: false })); };
  GridApp.prototype.commit = function () {
    if (!this.ed) return;
    const code = this.ed.serialize();
    this.ed = null;
    if (!code.trim()) return;
    const v = T().evaluate(code, this.c.st);
    if (typeof v !== 'number') T().fail('DATA TYPE');
    const m = this.s.m;
    while (m.length <= this.r) m.push([]);
    m[this.r][this.col] = v;
  };
  GridApp.prototype.move = function (dr, dc) {
    this.commit();
    const [n, m] = this.dims();
    this.r = Math.max(0, Math.min(n - 1, this.r + dr));
    this.col = Math.max(0, Math.min(m - 1, this.col + dc));
  };
  GridApp.prototype.key = function (k) {
    const c = this.c;
    const handled = appKeys(c, k, () => { this.commit(); this.solve(); }, () => { this.ed = null; this.s.m = []; });
    if (handled) return true;
    if (k === 'up') { this.move(-1, 0); return true; }
    if (k === 'down') { this.move(1, 0); return true; }
    if (k === 'left' && !this.ed) { this.move(0, -1); return true; }
    if (k === 'right' && !this.ed) { this.move(0, 1); return true; }
    if (k === 'enter') {
      this.commit();
      const [n, m] = this.dims();
      this.col += 1;
      if (this.col >= m) { this.col = 0; this.r = Math.min(n - 1, this.r + 1); }
      return true;
    }
    if (k === 'clear') { if (this.ed) this.ed = null; else c.pop(); return true; }
    if (k === 'quit') { this.commit(); c.quit(); return true; }
    if (core().MENU_KEYS.test(k) && !/^(math|test|angle|vars)$/.test(k)) return false;
    return c.typeInto(this.editor(), k);
  };
  GridApp.prototype.solve = function () {
    const [n, m] = this.dims();
    const aug = [];
    for (let i = 0; i < n; i++) { const row = []; for (let j = 0; j < m; j++) row.push(this.cell(i, j)); aug.push(row); }
    const r = S().solveSystem(aug);
    const vars = m - 1;
    let rows;
    if (r.kind === 'unique') {
      rows = r.x.map((v, i) => ['x' + sub(i + 1), R(v)]);
      this.c.st.ans = T().list(r.x.map(R));
      rows.push(['', ''], ['The solution is in Ans.', '']);
    } else if (r.kind === 'none') rows = [['NO SOLUTION FOUND', '']];
    else rows = [['INFINITE SOLUTIONS', '']].concat(general(this.c, r.rref, vars));
    this.c.push(report(this.c, 'SOLUTION', rows));
  };
  /** The general solution from the reduced matrix: each leading unknown in terms of the free ones. */
  function general(c, Rm, vars) {
    const f = (v) => T().fmtReal(+(+v).toPrecision(10), c.st.mode);
    const pivots = {};
    Rm.forEach((row) => { const p = row.findIndex((v, k) => k < vars && v !== 0); if (p >= 0) pivots[p] = row; });
    const out = [];
    for (let j = 0; j < vars; j++) {
      const row = pivots[j];
      const name = 'x' + sub(j + 1);
      if (!row) { out.push([name, name + ' (free)']); continue; }
      let text = row[vars] !== 0 ? f(row[vars]) : '';
      for (let k = j + 1; k < vars; k++) {
        if (pivots[k] || row[k] === 0) continue;
        const coef = -row[k];
        const mag = Math.abs(coef) === 1 ? '' : f(Math.abs(coef));
        text += (coef < 0 ? '-' : text ? '+' : '') + mag + 'x' + sub(k + 1);
      }
      out.push([name, text || '0']);
    }
    return out;
  }
  GridApp.prototype.render = function () {
    const st = this.c.st, mark = this.c.cursorMark();
    const [n, m] = this.dims();
    const VISR = this.c.rows(5), VISC = 3;
    if (this.r < this.top0) this.top0 = this.r;
    if (this.r >= this.top0 + VISR) this.top0 = this.r - VISR + 1;
    if (this.col < this.left0) this.left0 = this.col;
    if (this.col >= this.left0 + VISC) this.left0 = this.col - VISC + 1;
    const cols = [];
    for (let j = this.left0; j < Math.min(m, this.left0 + VISC); j++) cols.push(j);
    const head = (j) => (j === m - 1 ? 'b' : 'x' + sub(j + 1));
    const esc = core().esc;
    let html = '<div class="t84me"><div class="t84me-t">SYSTEM MATRIX (' + n + '×' + m + ')</div>'
      + '<div class="t84me-g" style="grid-template-columns:repeat(' + cols.length + ',1fr)">'
      + cols.map((j) => '<div class="t84ps-h">' + head(j) + '</div>').join('');
    for (let i = this.top0; i < Math.min(n, this.top0 + VISR); i++) {
      cols.forEach((j) => {
        const sel = i === this.r && j === this.col;
        html += '<div class="t84me-c' + (sel ? ' is-sel' : '') + '">' + esc(core().fmt(this.cell(i, j), st.mode)) + '</div>';
      });
    }
    html += '</div><div class="t84le-b">E' + (this.r + 1) + ': ' + head(this.col) + '=' + (this.ed ? this.ed.html(mark) : esc(core().fmt(this.cell(this.r, this.col), st.mode))) + '</div>';
    return html + BAR + '</div>';
  };

  window.FluxTIApps = { wizard: wizard, test: test, tvm: tvm, plysmlt: plysmlt, TESTS: TESTS, DISTR: DISTR };
})();
