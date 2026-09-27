/* ════════════════════════════════════════════════════════════════════════
   FLUX · Chemistry engine — flux-chem.js
   ------------------------------------------------------------------------
   The working behind the Flux Periodic Table's tools, with no page in it:
     parse(formula)        CuSO4·5H2O, Ca(OH)2, [Cu(NH3)4]2+, SO4^2-, Fe3+ …
     molarMass(formula)    with each element's share of the mass
     balance(equation)     exact (whole-number fractions, never floats), ions
                           and electrons included
     empirical(amounts)    from grams or percentages, and the molecular
                           formula from a molar mass
     ionConfig(ec, Z, q)   the outer shell empties first, so 4s before 3d
                           and 6s before 4f; anions fill by Aufbau
     orbitals(occupancy)   the boxes, filled by Hund's rule
     ionic(cation, anion)  formula and name, with the common polyatomic ions
   Masses come from whichever element list the page gives it (useElements),
   so the tools and the table always agree.
   ════════════════════════════════════════════════════════════════════════ */
(function (root) {
  'use strict';
  if (root.FluxChem) return;

  function fail(msg) { const e = new Error(msg); e.chem = true; throw e; }

  const SUB = '₀₁₂₃₄₅₆₇₈₉', SUP = '⁰¹²³⁴⁵⁶⁷⁸⁹';
  const toSub = (s) => String(s).replace(/\d/g, (d) => SUB[d]);
  const toSup = (s) => String(s).replace(/\d/g, (d) => SUP[d]).replace(/\+/g, '⁺').replace(/-/g, '⁻');

  /* ── Elements ───────────────────────────────────────────────────────── */

  let ELS = [], BY_SYM = {};
  /** The element list in use: [{ n, s, name, mass, cat }, …]. */
  function useElements(list) {
    ELS = list.slice();
    BY_SYM = {};
    ELS.forEach((e) => { BY_SYM[e.s] = e; });
  }
  function ensure() {
    if (!ELS.length && root.fluxPeriodic && root.fluxPeriodic.ELEMENTS) useElements(root.fluxPeriodic.ELEMENTS);
    if (!ELS.length) fail('The element data has not loaded yet.');
  }
  const element = (sym) => { ensure(); return BY_SYM[sym] || null; };
  /** Relative atomic mass; exam data booklets round to 2 decimal places. */
  function massOf(sym, opts) {
    const e = element(sym);
    if (!e) fail('Unknown element: ' + sym);
    // A whisker up, so 55.845 (stored as 55.84499…) rounds to 55.85 as the booklets print it.
    return opts && opts.dp2 ? Math.round(e.mass * 100 + 1e-7) / 100 : e.mass;
  }

  /* ── Formulas ───────────────────────────────────────────────────────── */

  /** Typed variants to plain ASCII: subscripts, superscripts, dots; state symbols dropped. */
  function normalise(s) {
    return String(s)
      .replace(/[₀-₉]/g, (c) => String(SUB.indexOf(c)))
      .replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹]/g, (c) => String(SUP.indexOf(c)))
      .replace(/⁺/g, '+').replace(/[⁻−–]/g, '-')
      .replace(/[·•∙⋅]/g, '.')
      .replace(/\((s|l|g|aq)\)/gi, '');
  }

  /**
   * A formula's charge, and the formula without it.
   * SO4^2- and "SO4 2-" say it outright. Run together, the last digit is the
   * charge when there is more than one: SO42- is SO4 with 2−, Hg22+ is Hg2
   * with 2+. A single digit is the charge on a lone element (Fe3+, O2-) but a
   * subscript otherwise (NH4+, MnO4-).
   */
  function splitCharge(s) {
    let m = /(?:\^|\s)(\d*)([+-])$/.exec(s);
    if (m) return { body: s.slice(0, m.index).trim(), charge: (m[1] ? +m[1] : 1) * (m[2] === '+' ? 1 : -1) };
    m = /(\d*)([+-]+)$/.exec(s);
    if (!m) return { body: s, charge: 0 };
    const digits = m[1], signs = m[2], body = s.slice(0, m.index);
    const sign = signs[0] === '+' ? 1 : -1;
    if (signs.length > 1) {
      if (/[^+]/.test(signs) && /[^-]/.test(signs)) fail('That charge is written two ways at once.');
      return { body: body + digits, charge: sign * signs.length };          // Fe+++
    }
    if (!digits) return { body: body, charge: sign };
    if (/^[A-Z][a-z]?$/.test(body) && digits.length === 1) return { body: body, charge: sign * +digits };
    if (digits.length >= 2) return { body: body + digits.slice(0, -1), charge: sign * +digits.slice(-1) };
    return { body: body + digits, charge: sign };
  }

  /** A formula → { atoms: { Fe: 2, O: 3 }, charge, electron }. */
  function parse(input) {
    ensure();
    const s0 = normalise(input).trim();
    if (!s0) fail('Type a formula.');
    if (/^e-?$/.test(s0)) return { atoms: {}, charge: -1, electron: true };
    const sc = splitCharge(s0);
    const s = sc.body.replace(/\s+/g, '');
    const atoms = {};
    const add = (dst, src, k) => { for (const e in src) dst[e] = (dst[e] || 0) + src[e] * k; };
    // Hydrates and adducts: CuSO4.5H2O
    const parts = s.split('.').filter(Boolean);
    if (!parts.length) fail('Type a formula.');
    parts.forEach((part, pi) => {
      let coef = 1;
      const cm = /^(\d+)(.*)$/.exec(part);
      if (cm && pi > 0) { coef = +cm[1]; part = cm[2]; }
      else if (cm && cm[2]) fail('Leave the number off the front — it is the amount, not part of the formula.');
      add(atoms, group(part), coef);
    });
    if (!Object.keys(atoms).length) fail('No elements in that formula.');
    return { atoms: atoms, charge: sc.charge, electron: false };
  }
  const OPEN = { '(': ')', '[': ']', '{': '}' };
  function group(s) {
    let i = 0;
    const count = () => {
      let t = '';
      while (i < s.length && /\d/.test(s[i])) t += s[i++];
      if (t === '') return 1;
      if (+t === 0) fail('A subscript of 0 means none of that element.');
      return +t;
    };
    function seq(close) {
      const out = {};
      while (i < s.length) {
        const c = s[i];
        if (OPEN[c]) {
          i++;
          const inner = seq(OPEN[c]);
          if (s[i] !== OPEN[c]) fail('A bracket is not closed.');
          i++;
          const k = count();
          for (const e in inner) out[e] = (out[e] || 0) + inner[e] * k;
        } else if (c === ')' || c === ']' || c === '}') {
          if (c !== close) fail('A bracket closes that was never opened.');
          return out;
        } else if (/[A-Z]/.test(c)) {
          let sym = c;
          i++;
          if (i < s.length && /[a-z]/.test(s[i])) sym += s[i++];
          if (!element(sym)) {
            fail('There is no element "' + sym + '".' + (sym.length === 2 ? ' (Symbols are one capital, then at most one small letter: Co is cobalt, CO is carbon monoxide.)' : ''));
          }
          out[sym] = (out[sym] || 0) + count();
        } else if (/[a-z]/.test(c)) {
          fail('"' + c + '" needs a capital letter to be an element.');
        } else if (/\d/.test(c)) {
          fail('A number has to follow an element or a bracket.');
        } else fail('"' + c + '" is not part of a formula.');
      }
      if (close) fail('A bracket is not closed.');
      return out;
    }
    return seq(null);
  }

  /** Hill order: C, then H, then alphabetical (alphabetical throughout without carbon). */
  function hill(atoms) {
    const keys = Object.keys(atoms);
    const hasC = keys.indexOf('C') >= 0;
    return keys.sort((a, b) => {
      if (hasC) {
        if (a === 'C') return -1; if (b === 'C') return 1;
        if (a === 'H') return -1; if (b === 'H') return 1;
      }
      return a < b ? -1 : a > b ? 1 : 0;
    });
  }
  /** Written the way a book prints it: subscripts, a raised charge, · for hydrates. */
  function pretty(input) {
    const s0 = normalise(input).trim();
    const p = parse(s0);
    if (p.electron) return 'e⁻';
    const body = splitCharge(s0).body.replace(/\s+/g, '');
    const out = body.split('.').map((part, i) => {
      if (i === 0) return toSub(part);
      const m = /^(\d*)(.*)$/.exec(part);
      return m[1] + toSub(m[2]);                     // the 5 in ·5H₂O stays full size
    }).join('·');
    if (!p.charge) return out;
    const mag = Math.abs(p.charge);
    return out + toSup((mag > 1 ? mag : '') + (p.charge > 0 ? '+' : '-'));
  }

  function molarMass(input, opts) {
    const p = parse(input);
    if (p.electron) fail('An electron has (almost) no mass.');
    const parts = hill(p.atoms).map((s) => {
      const ar = massOf(s, opts);
      return { s: s, n: p.atoms[s], ar: ar, mass: ar * p.atoms[s] };
    });
    const total = parts.reduce((a, x) => a + x.mass, 0);
    parts.forEach((x) => { x.pct = (x.mass / total) * 100; });
    return { total: total, parts: parts, charge: p.charge, atoms: p.atoms };
  }

  /* ── Exact arithmetic for the balancer ──────────────────────────────── */

  const bgcd = (a, b) => { a = a < 0n ? -a : a; b = b < 0n ? -b : b; while (b) { const t = a % b; a = b; b = t; } return a; };
  function Q(n, d) {
    n = BigInt(n); d = d == null ? 1n : BigInt(d);
    if (d === 0n) fail('Division by zero.');
    if (d < 0n) { n = -n; d = -d; }
    const g = bgcd(n, d) || 1n;
    return { n: n / g, d: d / g };
  }
  const qsub = (a, b) => Q(a.n * b.d - b.n * a.d, a.d * b.d);
  const qmul = (a, b) => Q(a.n * b.n, a.d * b.d);
  const qdiv = (a, b) => Q(a.n * b.d, a.d * b.n);

  /** Null space of a rational matrix, as rational vectors. */
  function nullspace(M) {
    const rows = M.length, cols = M[0].length;
    const A = M.map((r) => r.slice());
    const piv = [];
    let r = 0;
    for (let c = 0; c < cols && r < rows; c++) {
      let p = -1;
      for (let i = r; i < rows; i++) if (A[i][c].n !== 0n) { p = i; break; }
      if (p < 0) continue;
      [A[r], A[p]] = [A[p], A[r]];
      const lead = A[r][c];
      for (let j = 0; j < cols; j++) A[r][j] = qdiv(A[r][j], lead);
      for (let i = 0; i < rows; i++) {
        if (i === r || A[i][c].n === 0n) continue;
        const f = A[i][c];
        for (let j = 0; j < cols; j++) A[i][j] = qsub(A[i][j], qmul(f, A[r][j]));
      }
      piv.push(c);
      r++;
    }
    const free = [];
    for (let c = 0; c < cols; c++) if (piv.indexOf(c) < 0) free.push(c);
    return free.map((f) => {
      const v = new Array(cols).fill(null).map(() => Q(0));
      v[f] = Q(1);
      piv.forEach((pc, i) => { v[pc] = Q(-A[i][f].n, A[i][f].d); });
      return v;
    });
  }
  /** A rational vector → the smallest whole numbers in the same ratio. */
  function integers(v) {
    let L = 1n;
    v.forEach((q) => { L = (L / bgcd(L, q.d)) * q.d; });
    let ints = v.map((q) => q.n * (L / q.d));
    let g = 0n;
    ints.forEach((x) => { g = bgcd(g, x); });
    if (g > 1n) ints = ints.map((x) => x / g);
    return ints;
  }

  /* ── Equations ──────────────────────────────────────────────────────── */

  const ARROW = /\s*(?:<=>|<->|⇌|⇄|-->|->|=>|⟶|→|=)\s*/;
  /** Split one side on the "+" signs that separate species, not the ones in charges. */
  function splitSpecies(side) {
    const out = [];
    let cur = '';
    for (let i = 0; i < side.length; i++) {
      const c = side[i];
      if (c === '+') {
        let j = i + 1;
        while (j < side.length && side[j] === ' ') j++;
        const next = side[j];
        // Separator when a new species follows ("Fe + O2", "Fe3+ + e-"); a charge otherwise.
        if (next && /[A-Z0-9([{e]/.test(next) && cur.trim()) { out.push(cur.trim()); cur = ''; continue; }
      }
      cur += c;
    }
    if (cur.trim()) out.push(cur.trim());
    return out;
  }
  function species(text) {
    const t = text.trim();
    const m = /^(\d+)\s*(?=[A-Z([{e])/.exec(t);
    const formula = m ? t.slice(m[0].length) : t;
    const p = parse(formula);
    return { text: formula, given: m ? +m[1] : null, atoms: p.atoms, charge: p.charge, electron: p.electron };
  }
  function balance(input) {
    const src = normalise(input).trim();
    if (!src) fail('Type an equation, like Fe + O2 -> Fe2O3.');
    const sides = src.split(ARROW);
    if (sides.length !== 2) fail(sides.length < 2 ? 'Put an arrow (->) between the reactants and the products.' : 'Use one arrow.');
    const L = splitSpecies(sides[0]).map(species), R = splitSpecies(sides[1]).map(species);
    if (!L.length || !R.length) fail('There must be something on both sides of the arrow.');
    const all = L.concat(R);
    const els = [];
    all.forEach((sp) => Object.keys(sp.atoms).forEach((e) => { if (els.indexOf(e) < 0) els.push(e); }));
    els.forEach((e) => {
      if (L.some((s) => s.atoms[e]) !== R.some((s) => s.atoms[e])) fail(e + ' appears on only one side, so it cannot balance.');
    });
    const charged = all.some((sp) => sp.charge);
    const sign = (j) => (j < L.length ? 1 : -1);
    const M = els.map((e) => all.map((sp, j) => Q((sp.atoms[e] || 0) * sign(j))));
    if (charged) M.push(all.map((sp, j) => Q(sp.charge * sign(j))));
    const ns = nullspace(M);
    if (!ns.length) fail('This cannot balance as written — check the formulas.');
    if (ns.length > 1) fail('This balances more than one way — it is probably two reactions written as one.');
    let c = integers(ns[0]);
    if (c.every((x) => x <= 0n)) c = c.map((x) => -x);
    if (c.some((x) => x <= 0n)) fail('This cannot balance as written — one species would need to be on the other side.');
    const coefs = c.map(Number);
    const fmt = (arr, off) => arr.map((sp, i) => (coefs[off + i] > 1 ? coefs[off + i] : '') + (sp.electron ? 'e⁻' : pretty(sp.text))).join(' + ');
    const typed = all.some((sp) => sp.given != null);
    const count = (arr, off, f) => arr.reduce((a, sp, i) => a + f(sp) * coefs[off + i], 0);
    const check = els.map((e) => ({ e: e, left: count(L, 0, (sp) => sp.atoms[e] || 0), right: count(R, L.length, (sp) => sp.atoms[e] || 0) }));
    if (charged) check.push({ e: 'charge', left: count(L, 0, (sp) => sp.charge), right: count(R, L.length, (sp) => sp.charge) });
    return {
      left: L.map((sp, i) => ({ text: sp.text, coef: coefs[i] })),
      right: R.map((sp, i) => ({ text: sp.text, coef: coefs[L.length + i] })),
      text: fmt(L, 0) + ' → ' + fmt(R, L.length),
      check: check,
      // The student's own coefficients, when they typed any: were they right?
      givenCorrect: typed ? all.every((sp, i) => (sp.given || 1) === coefs[i]) : null,
      type: kind(L, R),
    };
  }
  /** The reaction type a student is asked to name. */
  function kind(L, R) {
    const isEl = (sp) => Object.keys(sp.atoms).length === 1 && !sp.charge;
    const has = (arr, f) => arr.some((sp) => sp.text.replace(/\s/g, '') === f);
    if (L.some((sp) => sp.atoms.C && sp.atoms.H) && has(L, 'O2') && has(R, 'CO2') && has(R, 'H2O')) return 'Combustion';
    if (L.some((sp) => sp.charge || sp.electron) || R.some((sp) => sp.charge || sp.electron)) return 'Ionic';
    if (L.length === 1 && R.length > 1) return 'Decomposition';
    if (L.length > 1 && R.length === 1) return 'Synthesis';
    if (L.length === 2 && R.length === 2) {
      if (L.some(isEl) && R.some(isEl)) return 'Single displacement';
      if (!L.some(isEl) && !R.some(isEl)) return has(R, 'H2O') ? 'Neutralisation' : 'Double displacement';
    }
    return '';
  }

  /* ── Empirical and molecular formulas ───────────────────────────────── */

  /** amounts: [{ s: 'C', v: 40 }, …] in grams or percent; opts.M, the molar mass, gives the molecular formula. */
  function empirical(amounts, opts) {
    const rows = amounts.filter((a) => a && a.s && a.v > 0);
    if (!rows.length) fail('Give at least one element and its amount.');
    const seen = {};
    rows.forEach((r) => {
      if (!element(r.s)) fail('There is no element "' + r.s + '".');
      if (seen[r.s]) fail(r.s + ' is listed twice.');
      seen[r.s] = 1;
    });
    const steps = rows.map((r) => ({ s: r.s, v: r.v, ar: massOf(r.s), mol: r.v / massOf(r.s) }));
    const min = Math.min.apply(null, steps.map((x) => x.mol));
    steps.forEach((x) => { x.ratio = x.mol / min; });
    // The smallest whole multiple that makes every ratio whole, allowing for rounded data.
    let k = 1;
    for (; k <= 12; k++) if (steps.every((x) => Math.abs(x.ratio * k - Math.round(x.ratio * k)) < 0.1)) break;
    if (k > 12) fail('Those amounts do not give a whole-number ratio — check the numbers.');
    steps.forEach((x) => { x.whole = Math.round(x.ratio * k); });
    const atoms = {};
    steps.forEach((x) => { atoms[x.s] = x.whole; });
    const write = (a) => hill(a).map((s) => s + (a[s] > 1 ? a[s] : '')).join('');
    const M = hill(atoms).reduce((a, s) => a + massOf(s) * atoms[s], 0);
    const out = { steps: steps, multiplier: k, formula: write(atoms), pretty: toSub(write(atoms)), M: M };
    if (opts && opts.M > 0) {
      const f = opts.M / M, n = Math.round(f);
      if (n < 1 || Math.abs(f - n) > 0.08) fail('That molar mass is not a whole number of empirical units (' + M.toFixed(2) + ' g/mol each).');
      const mAtoms = {};
      for (const s in atoms) mAtoms[s] = atoms[s] * n;
      out.molecular = { n: n, formula: write(mAtoms), pretty: toSub(write(mAtoms)) };
    }
    return out;
  }

  /* ── Electron configurations ────────────────────────────────────────── */

  const L_OF = { s: 0, p: 1, d: 2, f: 3 };
  const CAP = [2, 6, 10, 14];
  const CORES = (() => {
    const He = '1s2', Ne = He + ' 2s2 2p6', Ar = Ne + ' 3s2 3p6', Kr = Ar + ' 3d10 4s2 4p6', Xe = Kr + ' 4d10 5s2 5p6', Rn = Xe + ' 4f14 5d10 6s2 6p6';
    return { He: He, Ne: Ne, Ar: Ar, Kr: Kr, Xe: Xe, Rn: Rn };
  })();
  const CORE_Z = { He: 2, Ne: 10, Ar: 18, Kr: 36, Xe: 54, Rn: 86 };
  /** "[Ar] 3d⁶ 4s²" (any spacing, raised or plain digits) → { '1s': 2, …, '3d': 6, '4s': 2 }. */
  function occupancy(ec) {
    let s = normalise(ec || '').replace(/\((predicted|calculated)\)/gi, '').trim();
    s = s.replace(/\[([A-Z][a-z]?)\]/, (m, g) => {
      if (!CORES[g]) fail('Unknown core [' + g + '].');
      return CORES[g] + ' ';
    });
    const occ = {};
    s.split(/\s+/).filter(Boolean).forEach((t) => {
      const m = /^(\d)([spdf])(\d+)$/.exec(t);
      if (!m) fail('Could not read "' + t + '" in the configuration.');
      occ[m[1] + m[2]] = (occ[m[1] + m[2]] || 0) + +m[3];
    });
    return occ;
  }
  /** Subshells in the order they fill (Madelung: lowest n + l first, then lowest n). */
  const AUFBAU = (() => {
    const out = [];
    for (let n = 1; n <= 8; n++) for (let l = 0; l < Math.min(n, 4); l++) out.push({ n: n, l: l, k: n + 'spdf'[l] });
    return out.sort((a, b) => (a.n + a.l) - (b.n + b.l) || a.n - b.n);
  })();
  const AUF_INDEX = {};
  AUFBAU.forEach((x, i) => { AUF_INDEX[x.k] = i; });
  const shellOrder = (a, b) => (+a[0] - +b[0]) || (L_OF[a[1]] - L_OF[b[1]]);
  const total = (occ) => Object.keys(occ).reduce((a, k) => a + occ[k], 0);
  /** Occupancy → { full, short } in shell order ("[Ar] 3d⁶ 4s²"), or filling order with opts.filling. */
  function configText(occ, opts) {
    const keys = Object.keys(occ).filter((k) => occ[k] > 0);
    const order = opts && opts.filling ? keys.sort((a, b) => AUF_INDEX[a] - AUF_INDEX[b]) : keys.sort(shellOrder);
    const part = (k) => k + toSup(occ[k]);
    const full = order.map(part).join(' ');
    const n = total(occ);
    let core = null;
    ['Rn', 'Xe', 'Kr', 'Ar', 'Ne', 'He'].some((g) => {
      if (CORE_Z[g] >= n) return false;
      const c = occupancy(CORES[g]);
      if (Object.keys(c).every((k) => occ[k] === c[k])) { core = g; return true; }
      return false;
    });
    if (!core) return { full: full, short: full, core: null };
    const c = occupancy(CORES[core]);
    return { full: full, short: '[' + core + '] ' + order.filter((k) => !(k in c)).map(part).join(' '), core: core };
  }
  /**
   * An ion's configuration. Electrons leave the outermost shell first — so
   * 4s before 3d, 6s before 4f, 5p before 5s — then the last-filled subshell;
   * they arrive in filling order.
   */
  function ionConfig(ec, z, charge) {
    const occ = occupancy(ec);
    const had = total(occ);
    if (had !== z) fail('That configuration has ' + had + ' electrons, not ' + z + '.');
    if (charge > z) fail('An atom of Z = ' + z + ' only has ' + z + ' electrons to lose.');
    const outer = Math.max.apply(null, Object.keys(occ).map((k) => +k[0]));
    let q = charge;
    while (q > 0) {
      const inOuter = Object.keys(occ).filter((k) => +k[0] === outer && occ[k] > 0).sort((a, b) => L_OF[b[1]] - L_OF[a[1]]);
      const from = inOuter.length ? inOuter[0]
        : Object.keys(occ).filter((k) => occ[k] > 0).sort((a, b) => AUF_INDEX[b] - AUF_INDEX[a])[0];
      occ[from]--;
      if (!occ[from]) delete occ[from];
      q--;
    }
    while (q < 0) {
      const next = AUFBAU.find((x) => (occ[x.k] || 0) < CAP[x.l]);
      occ[next.k] = (occ[next.k] || 0) + 1;
      q++;
    }
    return { occ: occ, text: configText(occ) };
  }
  /** Orbital boxes per subshell, filled by Hund's rule: one up in each first, then pairs. */
  function orbitals(occ) {
    return Object.keys(occ).filter((k) => occ[k] > 0).sort(shellOrder).map((k) => {
      const boxes = CAP[L_OF[k[1]]] / 2, e = occ[k];
      const out = [];
      for (let b = 0; b < boxes; b++) out.push((e > b ? 1 : 0) + (e > boxes + b ? 1 : 0));
      return { sub: k, e: e, boxes: out, unpaired: out.filter((x) => x === 1).length };
    });
  }

  /* ── Ionic compounds ────────────────────────────────────────────────── */

  const POLY = [
    ['NH4+', 'ammonium'], ['H3O+', 'hydronium'],
    ['OH-', 'hydroxide'], ['NO3-', 'nitrate'], ['NO2-', 'nitrite'], ['HCO3-', 'hydrogencarbonate'], ['HSO4-', 'hydrogensulfate'],
    ['H2PO4-', 'dihydrogenphosphate'], ['CH3COO-', 'ethanoate (acetate)'], ['CN-', 'cyanide'], ['SCN-', 'thiocyanate'],
    ['MnO4-', 'permanganate'], ['ClO-', 'hypochlorite'], ['ClO2-', 'chlorite'], ['ClO3-', 'chlorate'], ['ClO4-', 'perchlorate'],
    ['BrO3-', 'bromate'], ['IO3-', 'iodate'],
    ['CO3 2-', 'carbonate'], ['SO4 2-', 'sulfate'], ['SO3 2-', 'sulfite'], ['S2O3 2-', 'thiosulfate'], ['C2O4 2-', 'ethanedioate (oxalate)'],
    ['CrO4 2-', 'chromate'], ['Cr2O7 2-', 'dichromate'], ['HPO4 2-', 'hydrogenphosphate'], ['O2 2-', 'peroxide'], ['SiO3 2-', 'silicate'],
    ['PO4 3-', 'phosphate'],
  ].map((p) => {
    const sc = splitCharge(p[0]);
    return { f: sc.body, charge: sc.charge, name: p[1], poly: true };
  });
  const ANION_ROOT = { H: 'hydr', N: 'nitr', P: 'phosph', As: 'arsen', O: 'ox', S: 'sulf', Se: 'selen', Te: 'tellur', F: 'fluor', Cl: 'chlor', Br: 'brom', I: 'iod' };
  const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'];
  const states = (ox) => String(ox || '').split(',').map((x) => parseInt(x, 10)).filter((x) => Number.isFinite(x));
  const METALS = ['alkali', 'alkaline', 'transition', 'post-transition', 'lanthanide', 'actinide'];

  /** The simple cations and anions a school course names, with the common polyatomic ions. */
  function ions() {
    ensure();
    const D = (root.FluxPTableData && root.FluxPTableData.el) || {};
    const cations = [], anions = [];
    ELS.forEach((e) => {
      if (e.n > 103) return;
      const ox = states(D[e.n] && D[e.n].ox);
      const pos = ox.filter((x) => x > 0).sort((a, b) => a - b);
      if (METALS.indexOf(e.cat) >= 0) {
        // A Roman numeral only when the metal has more than one common charge.
        pos.forEach((q) => cations.push({ f: e.s, charge: q, name: e.name.toLowerCase() + (pos.length > 1 ? '(' + ROMAN[q] + ')' : ''), el: e.n }));
      }
      if (ANION_ROOT[e.s]) {
        const neg = ox.filter((x) => x < 0);
        if (neg.length) anions.push({ f: e.s, charge: Math.min.apply(null, neg), name: ANION_ROOT[e.s] + 'ide', el: e.n });
      }
    });
    POLY.forEach((p) => (p.charge > 0 ? cations : anions).push(p));
    return { cations: cations, anions: anions };
  }
  /** Cation + anion → the neutral compound: charges cross over, brackets round a repeated polyatomic ion. */
  function ionic(cat, an) {
    if (!(cat.charge > 0) || !(an.charge < 0)) fail('Pick a positive ion and a negative ion.');
    const a = cat.charge, b = -an.charge;
    const gcd = (x, y) => (y ? gcd(y, x % y) : x);
    const l = (a * b) / gcd(a, b);
    const nc = l / a, na = l / b;
    const multi = (ion) => ion.poly && /[A-Z][^A-Z]*[A-Z]|\d/.test(ion.f);
    const part = (ion, n) => (n === 1 ? ion.f : multi(ion) ? '(' + ion.f + ')' + n : ion.f + n);
    const formula = part(cat, nc) + part(an, na);
    return { formula: formula, pretty: toSub(formula), name: cat.name + ' ' + an.name, ratio: [nc, na] };
  }

  /* ── Amounts ────────────────────────────────────────────────────────── */

  const NA = 6.02214076e23;                              // exact, SI 2019
  const VM = { stp: 22.7, rtp: 24.0, stp1atm: 22.4 };    // dm³ mol⁻¹: 273 K & 100 kPa · 298 K & 100 kPa · 273 K & 1 atm

  root.FluxChem = {
    useElements: useElements, element: element, massOf: massOf,
    parse: parse, pretty: pretty, molarMass: molarMass, balance: balance, empirical: empirical,
    occupancy: occupancy, configText: configText, ionConfig: ionConfig, orbitals: orbitals, AUFBAU: AUFBAU,
    ions: ions, ionic: ionic, POLY: POLY, NA: NA, VM: VM,
    toSub: toSub, toSup: toSup, normalise: normalise, hill: hill, splitSpecies: splitSpecies, splitCharge: splitCharge,
  };
})(typeof window !== 'undefined' ? window : globalThis);
