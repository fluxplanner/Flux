/* ============================================================================
   FLUX WORKING MATH  ·  flux-working-math.js
   Reads a formula the way it is written on the formula sheets — "v = u + at",
   "KE = ½mv²", "F = G·m₁m₂/r²", "Q = mcΔT", "β = 10·log₁₀(I/I₀)" — so a
   student can plug numbers into it and show their working:

       v = u + at                 ← the formula, as written
       v = 3.0 + (9.81)(2.0)      ← substituted, with the numbers they typed
       v = 22.6                   ← the answer, to their chosen sig figs

   Any one symbol can be the unknown, on either side: leave it blank and it is
   solved for (numerically, preferring a positive root — s = ut + ½at² solved
   for t gives the time, not the negative one).

   Why not flux-expr.js: that reads what people type into the grapher
   ("2x^2 - sin(x)/3"). The sheets are written in print notation — ½, Δ,
   subscripts, superscript powers, × 10⁻³⁴ — and the working needs each
   symbol's original text back to write the substituted line. So this is a
   reader for that notation, not a second general-purpose parser.

   What it refuses rather than guesses: ± and ∓, ≤ ≥, Σ, concentration
   brackets [H⁺], and words ("actual/theoretical").

   Pure functions, no DOM: window.FluxWorkingMath, tested in
   test/unit/working-math.test.mjs.
   ========================================================================== */
(function () {
  'use strict';

  const SUP = { '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4', '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9', '⁻': '-', '⁺': '+' };
  const SUB_CHARS = '₀₁₂₃₄₅₆₇₈₉ₐₑₒₓₕₖₗₘₙₚₛₜᵢⱼ';
  const FRACTIONS = { '½': 0.5, '¼': 0.25, '¾': 0.75, '⅓': 1 / 3, '⅔': 2 / 3 };
  const FUNCS = ['sqrt', 'sin', 'cos', 'tan', 'exp', 'log', 'ln'];
  /* Symbols written with more than one letter on the sheets. Anything else
     is a product of single letters: "mgh" is m·g·h, "PV" is P·V. */
  const NAMES = ['pOH', 'pKa', 'pKb', 'GPE', 'EMF', 'emf', 'pH', 'KE', 'PE', 'Ek', 'Ep'];
  const GREEK = 'αβγδεζηθικλμνξορστυφχψωΓΘΛΞΦΨΩ';
  const UNSUPPORTED = /[\[\]Σ±∓≤≥<>%∝≈]/;

  const isLetter = (c) => /[A-Za-z]/.test(c) || GREEK.indexOf(c) >= 0;
  const isAtomStart = (t) => !!t && (t.t === 'num' || t.t === 'sym' || t.t === 'const' || t.t === 'lp' || t.t === 'fn');
  const isAtomEnd = (t) => !!t && (t.t === 'num' || t.t === 'sym' || t.t === 'const' || t.t === 'rp' || t.t === 'pow');

  /** Split one side of a formula into tokens, each keeping its original text (s) and the space before it (pre). */
  function tokenize(src) {
    const s = String(src);
    if (UNSUPPORTED.test(s)) throw new Error('unsupported');
    const out = [];
    let i = 0;
    while (i < s.length) {
      let pre = '';
      while (i < s.length && /\s/.test(s[i])) pre += s[i++];
      if (i >= s.length) break;
      const c = s[i], rest = s.slice(i);
      let m;
      if ((m = /^\d+(?:\.\d+)?(?:e[+-]?\d+(?![A-Za-z]))?/i.exec(rest)) || (m = /^\.\d+/.exec(rest))) {
        out.push({ t: 'num', v: Number(m[0]), s: m[0], pre }); i += m[0].length; continue;
      }
      if (FRACTIONS[c] != null) { out.push({ t: 'num', v: FRACTIONS[c], s: c, pre }); i++; continue; }
      if (SUP[c] != null) {
        let j = i, txt = '';
        while (j < s.length && SUP[s[j]] != null) txt += SUP[s[j++]];
        const v = Number(txt);
        if (!Number.isFinite(v)) throw new Error('unsupported');
        out.push({ t: 'pow', v, s: s.slice(i, j), pre }); i = j; continue;
      }
      if (/[ᵃ-ᶿⁿⁱ]/.test(c)) throw new Error('unsupported');           // superscript letters: rate = k[A]ᵐ
      if ('+-−'.includes(c)) { out.push({ t: 'op', v: c === '+' ? '+' : '-', s: c, pre }); i++; continue; }
      if ('×·*∙⋅'.includes(c)) { out.push({ t: 'op', v: '*', s: c, pre }); i++; continue; }
      if (c === '/' || c === '÷') { out.push({ t: 'op', v: '/', s: c, pre }); i++; continue; }
      if (c === '^') { out.push({ t: 'op', v: '^', s: c, pre }); i++; continue; }
      if (c === '(') { out.push({ t: 'lp', s: c, pre }); i++; continue; }
      if (c === ')') { out.push({ t: 'rp', s: c, pre }); i++; continue; }
      if (c === '√') { out.push({ t: 'fn', name: 'sqrt', s: c, pre }); i++; continue; }
      if (c === 'π') { out.push({ t: 'const', v: Math.PI, s: c, pre }); i++; continue; }
      // Functions, including log₁₀ written with a subscript.
      const fn = FUNCS.find((f) => rest.startsWith(f) && !/[A-Za-z]/.test(rest[f.length] || ''));
      if (fn) {
        let len = fn.length, name = fn;
        if (fn === 'log' && rest.startsWith('log₁₀')) { len += 2; name = 'log10'; }
        out.push({ t: 'fn', name, s: rest.slice(0, len), pre }); i += len; continue;
      }
      // e^(…) is Euler's number; a lone e is a symbol (the electron's charge).
      if (c === 'e' && /^e\s*\^/.test(rest)) { out.push({ t: 'const', v: Math.E, s: 'e', pre }); i++; continue; }
      if (c === 'Δ' || isLetter(c)) {
        let j = i;
        if (c === 'Δ') j++;
        const word = /^[A-Za-z]+/.exec(s.slice(j));
        const named = NAMES.find((n) => s.startsWith(n, j) && !/[A-Za-z]/.test(s[j + n.length] || ''));
        if (!named && word && word[0].length >= 4) throw new Error('unsupported');   // a word, not symbols
        let base;
        if (named) base = named;
        else if (isLetter(s[j])) base = s[j];
        else throw new Error('unsupported');
        j += base.length;
        // Subscripts: m₁, a_c, N_A, P_total, v_{o}; then primes and degree marks.
        while (j < s.length && SUB_CHARS.includes(s[j])) j++;
        if (s[j] === '_') {
          const sub = /^_(\{[^}]*\}|[A-Za-z0-9]+)/.exec(s.slice(j));
          if (sub) j += sub[0].length;
        }
        while (j < s.length && '′\'°'.includes(s[j])) j++;
        const text = s.slice(i, j);
        out.push({ t: 'sym', name: text, s: text, pre }); i = j; continue;
      }
      throw new Error('unsupported');
    }
    return out;
  }

  /** Evaluate tokens. scope maps symbol names to numbers; trig works in degrees. */
  function evaluate(tokens, scope) {
    let p = 0;
    const peek = () => tokens[p];
    const next = () => tokens[p++];
    const RAD = Math.PI / 180;
    const F = {
      sqrt: Math.sqrt, exp: Math.exp, ln: Math.log, log: Math.log10, log10: Math.log10,
      sin: (x) => Math.sin(x * RAD), cos: (x) => Math.cos(x * RAD), tan: (x) => Math.tan(x * RAD),
    };
    function atom() {
      const t = next();
      if (!t) throw new Error('incomplete');
      if (t.t === 'num' || t.t === 'const') return t.v;
      if (t.t === 'sym') {
        if (!Object.prototype.hasOwnProperty.call(scope, t.name)) throw new Error('missing:' + t.name);
        return scope[t.name];
      }
      if (t.t === 'lp') { const v = expr(); if (!peek() || peek().t !== 'rp') throw new Error('bracket'); next(); return v; }
      if (t.t === 'fn') return F[t.name](power());
      if (t.t === 'op' && t.v === '-') return -power();
      if (t.t === 'op' && t.v === '+') return power();
      throw new Error('syntax');
    }
    function power() {
      let base = atom();
      while (peek() && peek().t === 'pow') base = Math.pow(base, next().v);
      if (peek() && peek().t === 'op' && peek().v === '^') { next(); return Math.pow(base, unary()); }
      return base;
    }
    function unary() {
      const t = peek();
      if (t && t.t === 'op' && (t.v === '-' || t.v === '+')) { next(); const v = unary(); return t.v === '-' ? -v : v; }
      return power();
    }
    function term() {
      let v = unary();
      for (;;) {
        const t = peek();
        if (t && t.t === 'op' && (t.v === '*' || t.v === '/')) { next(); const r = unary(); v = t.v === '*' ? v * r : v / r; }
        else if (isAtomStart(t)) v *= power();          // implicit: mgh, 2as, (u + v)t
        else return v;
      }
    }
    function expr() {
      let v = term();
      for (;;) {
        const t = peek();
        if (t && t.t === 'op' && (t.v === '+' || t.v === '-')) { next(); const r = term(); v = t.v === '+' ? v + r : v - r; }
        else return v;
      }
    }
    const v = expr();
    if (p < tokens.length) throw new Error('syntax');
    return v;
  }

  /** "9.81", "3e8", "3.0×10⁸", "3 x 10^8", "-4.2", "½" → number, or NaN. */
  function readNumber(text) {
    const t = String(text == null ? '' : text).trim().replace(/\s*[xX]\s*10/, '×10');
    if (!t) return NaN;
    try {
      const toks = tokenize(t);
      if (toks.some((k) => k.t === 'sym')) return NaN;
      const v = evaluate(toks, {});
      return Number.isFinite(v) ? v : NaN;
    } catch (e) { return NaN; }
  }

  /**
   * Can this formula be plugged into, and with which symbols?
   * { ok, left, right, symbols: [names in order] } or { ok: false, why }.
   * Chains ("P = IV = I²R") use their first two sides.
   */
  function analyse(formula) {
    const text = String(formula || '');
    // Several identities on one line ("log(ab)=log a+log b   log(a/b)=…") are a list, not an equation.
    if (/\n|\S\s{3,}\S/.test(text)) return { ok: false, why: 'This line holds several formulas — copy the one you need into your working.' };
    // dN/dt is a rate, not d·N ÷ d·t.
    if (/\bd[A-Za-z]\s*\/\s*d[A-Za-z]/.test(text)) return { ok: false, why: 'Rates of change cannot be plugged into directly.' };
    /* A unit after a number at the end of a side ("n = V / 22.4 L") is an
       annotation, not a symbol to multiply by. */
    const sides = text.split('=').map((side) => side.replace(/(\d)\s+[A-Za-zμΩ°][A-Za-zμΩ°0-9/·⁻¹²³]*\s*$/, '$1'));
    if (sides.length < 2) return { ok: false, why: 'This is not an equation.' };
    /* "c = 2.998 × 10⁸ m/s" is a constant with its units, not a formula in m and s. */
    if (/^\s*[-−]?[\d.]+(\s*[×x·]\s*10[⁻⁺]?[⁰¹²³⁴⁵⁶⁷⁸⁹]+)?\s+[^\d\s]/.test(sides[1])) {
      return { ok: false, why: 'This is a constant — use its value in another formula.' };
    }
    try {
      const L = tokenize(sides[0]), R = tokenize(sides[1]);
      if (!L.length || !R.length) return { ok: false, why: 'One side is empty.' };
      const symbols = [];
      L.concat(R).forEach((t) => { if (t.t === 'sym' && symbols.indexOf(t.name) < 0) symbols.push(t.name); });
      if (!symbols.length) return { ok: false, why: 'There is nothing to substitute — it is a constant.' };
      // Parse once with every symbol set, so a syntax problem shows up now, not after typing.
      const probe = {};
      symbols.forEach((n) => { probe[n] = 1.37; });
      evaluate(L, probe); evaluate(R, probe);
      return { ok: true, left: sides[0].trim(), right: sides[1].trim(), leftTokens: L, rightTokens: R, symbols };
    } catch (e) {
      return { ok: false, why: 'Flux cannot work this one out automatically — write it out by hand.' };
    }
  }

  const SUPER = { '-': '⁻', 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' };
  /** A number to n significant figures, with × 10ⁿ for very large or small values. */
  function format(v, sf) {
    if (!Number.isFinite(v)) return String(v);
    const n = Math.max(1, Math.min(10, sf || 3));
    if (v === 0) return '0';
    let exp = Math.floor(Math.log10(Math.abs(v)));
    // toPrecision writes 41800 at 3 s.f. as "4.18e+4" — show that as × 10⁴ too.
    if (exp >= 6 || exp <= -4 || /e/i.test(v.toPrecision(n))) {
      let mant = v / Math.pow(10, exp);
      // 9.996 at 3 s.f. rounds to 10.0 — carry it into the exponent.
      if (Math.abs(Number(mant.toPrecision(n))) >= 10) { exp += 1; mant = v / Math.pow(10, exp); }
      return mant.toPrecision(n) + ' × 10' + String(exp).split('').map((c) => SUPER[c]).join('');
    }
    return v.toPrecision(n);
  }

  /** Rebuild a side with values in place of known symbols, keeping the original spacing. */
  function substituteSide(tokens, texts) {
    return tokens.map((t, i) => {
      if (t.t !== 'sym' || texts[t.name] == null) return t.pre + t.s;
      const val = String(texts[t.name]).trim();
      const prev = tokens[i - 1], nxt = tokens[i + 1];
      const wrap = /^[-−]/.test(val) || /[×·*/^+\s]/.test(val)
        || isAtomEnd(prev) || isAtomStart(nxt) || (!!nxt && (nxt.t === 'pow' || (nxt.t === 'op' && nxt.v === '^')));
      return t.pre + (wrap ? '(' + val + ')' : val);
    }).join('').trim();
  }

  /** Find x with f(x) = 0: scan for a sign change (positive side first), then bisect. */
  function solve(f) {
    const pos = [], neg = [];
    for (let k = -12; k <= 12; k += 0.125) { pos.push(Math.pow(10, k)); neg.push(-Math.pow(10, k)); }
    const bisect = (a, b, fa) => {
      for (let it = 0; it < 200; it++) {
        const mid = (a + b) / 2, fm = f(mid);
        if (!Number.isFinite(fm)) return null;
        if (fm === 0 || Math.abs(b - a) <= 1e-15 * Math.max(1, Math.abs(mid))) return mid;
        if ((fa < 0) === (fm < 0)) { a = mid; fa = fm; } else b = mid;
      }
      return (a + b) / 2;
    };
    for (const run of [[0].concat(pos), [0].concat(neg)]) {
      let px = run[0], pf = f(px);
      for (let i = 1; i < run.length; i++) {
        const x = run[i], fx = f(x);
        if (Number.isFinite(pf) && Number.isFinite(fx)) {
          if (fx === 0) return x;
          if ((pf < 0) !== (fx < 0)) {
            const r = bisect(px, x, pf);
            // A sign change across a pole (1/x) is not a root: check it lands near zero.
            if (r != null && Math.abs(f(r)) < 1e-6 * (1 + Math.abs(pf) + Math.abs(fx))) return r;
          }
        }
        px = x; pf = fx;
      }
    }
    return null;
  }

  /**
   * Plug values into a formula. texts: { symbol: 'typed value' } — exactly one
   * symbol left blank is the unknown. Returns { substituted, answer, unknown, value }
   * or { error }.
   */
  function plugIn(formula, texts, opts) {
    const a = analyse(formula);
    if (!a.ok) return { error: a.why };
    const scope = {}, shown = {};
    const blanks = [];
    for (const name of a.symbols) {
      const raw = texts && texts[name] != null ? String(texts[name]).trim() : '';
      if (!raw) { blanks.push(name); continue; }
      const v = readNumber(raw);
      if (!Number.isFinite(v)) return { error: `"${raw}" for ${name} is not a number.` };
      scope[name] = v; shown[name] = raw;
    }
    if (blanks.length === 0) return { error: 'Leave the one you want to find blank.' };
    if (blanks.length > 1) return { error: `Fill in all but one — ${blanks.join(', ')} are still blank.` };
    const u = blanks[0];
    const L = a.leftTokens, R = a.rightTokens;
    const lone = (side, other) => side.length === 1 && side[0].t === 'sym' && side[0].name === u
      && !other.some((t) => t.t === 'sym' && t.name === u);
    let value;
    try {
      if (lone(L, R)) value = evaluate(R, scope);
      else if (lone(R, L)) value = evaluate(L, scope);
      else {
        const f = (x) => { const sc = Object.assign({}, scope); sc[u] = x; return evaluate(L, sc) - evaluate(R, sc); };
        value = solve(f);
        if (value == null) return { error: `No value of ${u} makes this true with those numbers.` };
      }
    } catch (e) {
      return { error: 'Those numbers could not be worked through this formula.' };
    }
    if (!Number.isFinite(value)) return { error: 'That comes out undefined — check for a division by zero.' };
    const sf = opts && opts.sf ? opts.sf : 3;
    return {
      substituted: substituteSide(L, shown) + ' = ' + substituteSide(R, shown),
      answer: u + ' = ' + format(value, sf),
      unknown: u,
      value,
    };
  }

  window.FluxWorkingMath = { tokenize, evaluate, analyse, plugIn, readNumber, format };
})();
