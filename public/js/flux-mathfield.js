/* ════════════════════════════════════════════════════════════════════════
   FLUX · Maths fields — flux-mathfield.js
   ------------------------------------------------------------------------
   Typing an equation the way Desmos does it: ^ lifts the cursor and the
   exponent is drawn raised while you type it, / starts a stacked fraction,
   "sqrt" becomes √, x1 becomes x₁. The editor is MathQuill — the one Desmos
   grew out of — kept in public/vendor with the jQuery it needs, so it loads
   from this site and never from a CDN. It is fetched the first time an
   equation row appears; until then, or if it cannot load, the plain text
   box is there and works exactly as before.

   The grapher still reads plain text ("y=x^2+3"): that is what it parses,
   saves and checks. So this file translates both ways, keeping the meaning
   and not just the look:
     toPlain(latex)   what MathQuill holds → what the grapher reads
     toLatex(plain)   text that arrives from elsewhere — a saved graph, a
                      slider, a paste → what MathQuill shows
   In the text box 1/2x is (1/2)·x, so it comes back as ½x, never 1/(2x).
   ════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (window.FluxMathField) return;

  const JQUERY_SRC = 'public/vendor/jquery-3.7.1/jquery.min.js';
  const MQ_SRC = 'public/vendor/mathquill-0.10.1/mathquill.min.js';
  const MQ_CSS = 'public/vendor/mathquill-0.10.1/mathquill.min.css';

  /* The grapher's built-in functions (flux-expr.js), used before it loads. */
  const FNS_FALLBACK = ['sin', 'cos', 'tan', 'asin', 'acos', 'atan', 'sinh', 'cosh', 'tanh', 'ln', 'log', 'log2',
    'sqrt', 'cbrt', 'abs', 'exp', 'sign', 'floor', 'ceil', 'round', 'min', 'max', 'atan2', 'pow'];
  function isFn(name) {
    const F = window.FluxExpr && window.FluxExpr.FNS;
    return F ? Object.prototype.hasOwnProperty.call(F, name) : FNS_FALLBACK.indexOf(name) >= 0;
  }

  /* Names MathQuill sets upright as you type them. asin and friends are left
     out on purpose: Desmos reads "asin(x)" as a·sin(x), and so does this —
     the inverse is arcsin, or sin⁻¹ on the keypad. */
  const AUTO_OPERATORS = 'sin cos tan sinh cosh tanh arcsin arccos arctan ln log exp abs cbrt floor ceil round sign min max';
  /* Every name that reads back as a function, including MathQuill's own. */
  const OPERATOR_WORDS = AUTO_OPERATORS.split(' ').concat(['sec', 'csc', 'cot', 'coth', 'lg', 'gcd', 'lcm', 'det', 'arg', 'deg', 'dim', 'sup', 'inf', 'lim', 'ker', 'hom', 'Pr']);
  const FN_ALIAS = { arcsin: 'asin', arccos: 'acos', arctan: 'atan' };
  const FN_TEX = {
    sin: '\\sin', cos: '\\cos', tan: '\\tan', sinh: '\\sinh', cosh: '\\cosh', tanh: '\\tanh',
    asin: '\\arcsin', acos: '\\arccos', atan: '\\arctan', ln: '\\ln', log: '\\log', exp: '\\exp',
    min: '\\min', max: '\\max', log2: '\\log_{2}',
  };
  const GREEK = {
    alpha: 'α', beta: 'β', gamma: 'γ', delta: 'δ', epsilon: 'ε', varepsilon: 'ε', zeta: 'ζ', eta: 'η',
    theta: 'θ', vartheta: 'θ', iota: 'ι', kappa: 'κ', lambda: 'λ', mu: 'μ', nu: 'ν', xi: 'ξ', rho: 'ρ',
    sigma: 'σ', upsilon: 'υ', phi: 'φ', varphi: 'φ', chi: 'χ', psi: 'ψ', omega: 'ω',
    Gamma: 'Γ', Delta: 'Δ', Theta: 'Θ', Lambda: 'Λ', Xi: 'Ξ', Pi: 'Π', Sigma: 'Σ', Phi: 'Φ', Psi: 'Ψ', Omega: 'Ω',
  };
  const GREEK_CMD = {};
  Object.keys(GREEK).forEach((k) => { if (!GREEK_CMD[GREEK[k]] && !/^var/.test(k)) GREEK_CMD[GREEK[k]] = k; });

  /* ── MathQuill's LaTeX → the grapher's plain text ─────────────────── */

  const JOINS = /[A-Za-z0-9.α-ωΑ-Ω_']/;
  const STARTS = /[A-Za-z0-9.α-ωΑ-Ω]/;
  /** Plain text built piece by piece. A "word" (pi, sin(x), x1, ^2) must not
      run into the letter or digit after it: "a" + "sin(x)" is "a sin(x)",
      not "asin(x)", and "x^2" + "3" is "x^2 3", not "x^23". */
  function Out() { this.s = ''; this.sep = false; }
  Out.prototype.put = function (text, kind) {
    if (!text) return;
    const a = this.s.slice(-1);
    if (a && JOINS.test(a) && STARTS.test(text[0]) && (this.sep || kind === 'word')) this.s += ' ';
    this.s += text;
    this.sep = kind === 'word' || kind === 'sep';
  };

  /** One side of a fraction, bracketed unless it is a lone number or letter. */
  function side(t) {
    const x = t.trim();
    return /^[0-9.]+$/.test(x) || /^[A-Za-zα-ωΑ-Ω]$/.test(x) ? x : '(' + x + ')';
  }

  function toPlain(latex) {
    const s = String(latex == null ? '' : latex);
    let i = 0;
    const atRight = () => s.startsWith('\\right', i);

    function delim() {
      while (s[i] === ' ') i++;
      if (s[i] !== '\\') return s[i++] || '';
      i++;
      const m = /^[A-Za-z]+/.exec(s.slice(i));
      if (!m) return s[i++] || '';
      i += m[0].length;
      return ({ lbrace: '{', rbrace: '}', vert: '|', lvert: '|', rvert: '|', langle: '(', rangle: ')' })[m[0]] || '';
    }
    function group() {
      i++;
      const r = seq(() => s[i] === '}');
      if (s[i] === '}') i++;
      return r;
    }
    /** A TeX argument: {…}, one command, or one character. */
    function arg() {
      while (s[i] === ' ') i++;
      if (s[i] === '{') return group();
      if (s[i] === '\\') { const o = new Out(); command(o); return o.s; }
      return s[i++] || '';
    }
    function sub(o) {
      const t = arg().trim().replace(/[^A-Za-z0-9α-ωΑ-Ω]/g, '');
      // x_1 is the name x1 (a list or a column), the way it was always typed.
      o.s += /^\d+$/.test(t) ? t : t ? '_' + t : '';
      o.sep = true;
    }
    function power(o) {
      const e = arg().trim();
      if (!e) { o.put('^', 'plain'); return; }
      o.put('^' + (/^[A-Za-z0-9α-ωΑ-Ω]$/.test(e) ? e : '(' + e + ')'), 'sep');
    }
    function fn(o, raw) {
      let name = FN_ALIAS[raw] || raw;
      // "\log2(" and "\operatorname{atan}2(": the digits finish the name.
      const dm = /^\d+/.exec(s.slice(i));
      if (dm && isFn(name + dm[0])) { name += dm[0]; i += dm[0].length; }
      let base = null, pow = null;
      for (let k = 0; k < 2; k++) {
        while (s[i] === ' ') i++;
        if (s[i] === '_' && base == null) { i++; base = arg().trim(); } else if (s[i] === '^' && pow == null) { i++; pow = arg().trim(); }
      }
      while (s[i] === ' ') i++;
      let a;
      if (s.startsWith('\\left(', i)) {
        i += 6;
        a = seq(atRight);
        if (atRight()) { i += 6; delim(); }
      } else {
        // sin x, the way it is written on paper: up to the next + − = , or bracket.
        a = seq(() => /[+\-=<>,~}]/.test(s[i] || '') || atRight()
          || /^\\(le|ge|ne|lt|gt|sim|leq|geq|neq)(?![A-Za-z])/.test(s.slice(i)));
        if (!a.trim()) { o.put(name, 'word'); return; }
      }
      // sin⁻¹ is the inverse, as on a calculator.
      if (pow === '-1' && /^(sin|cos|tan)$/.test(name)) { name = 'a' + name; pow = null; }
      let core;
      if (base != null && name === 'log') {
        core = base === '2' ? 'log2(' + a + ')' : base === '10' ? 'log(' + a + ')'
          : base === 'e' ? 'ln(' + a + ')' : '(ln(' + a + ')/ln(' + side(base) + '))';
      } else core = name + '(' + a + ')';
      if (pow) core = '(' + core + ')^' + (/^[A-Za-z0-9]$/.test(pow) ? pow : '(' + pow + ')');
      o.put(core, 'word');
    }
    function command(o) {
      i++;
      const m = /^[A-Za-z]+/.exec(s.slice(i));
      let name;
      if (m) {
        name = m[0];
        i += name.length;
        while (s[i] === ' ') i++;
      } else {
        name = s[i] || '';
        i++;
      }
      switch (name) {
        case 'left': {
          const open = delim();
          const inner = seq(atRight);
          if (atRight()) { i += 6; delim(); }
          if (open === '(') o.put('(' + inner + ')', 'plain');
          else if (open === '[') o.put('[' + inner + ']', 'plain');
          else if (open === '{') o.put('{' + inner + '}', 'plain');
          else if (open === '|') o.put('abs(' + inner + ')', 'word');
          else o.put(inner, 'plain');
          return;
        }
        case 'right': delim(); return;
        case 'frac': case 'dfrac': case 'tfrac': {
          const a = arg(), b = arg();
          o.put('(' + side(a) + '/' + side(b) + ')', 'plain');
          return;
        }
        case 'sqrt': {
          let n = '';
          if (s[i] === '[') { i++; n = seq(() => s[i] === ']').trim(); if (s[i] === ']') i++; }
          const r = arg();
          if (!n) o.put('sqrt(' + r + ')', 'word');
          else if (n === '3') o.put('cbrt(' + r + ')', 'word');
          else o.put('((' + r + ')^(1/' + side(n) + '))', 'plain');
          return;
        }
        case 'operatorname': case 'mathrm': case 'text': case 'textrm': case 'mathit': {
          const w = arg().trim();
          if (name === 'operatorname' || OPERATOR_WORDS.indexOf(w) >= 0) fn(o, w); else o.put(w, 'word');
          return;
        }
        case 'cdot': case 'times': case 'ast': o.put('*', 'plain'); return;
        case 'div': o.put('/', 'plain'); return;
        case 'le': case 'leq': case 'leqslant': o.put('<=', 'plain'); return;
        case 'ge': case 'geq': case 'geqslant': o.put('>=', 'plain'); return;
        case 'ne': case 'neq': o.put('!=', 'plain'); return;
        case 'lt': o.put('<', 'plain'); return;
        case 'gt': o.put('>', 'plain'); return;
        case 'sim': case 'approx': o.put('~', 'plain'); return;
        case 'prime': o.put("'", 'plain'); return;
        case 'pi': case 'tau': o.put(name, 'word'); return;
        case '%': o.put('%', 'plain'); return;
        case '{': o.put('{', 'plain'); return;
        case '}': o.put('}', 'plain'); return;
        case ' ': case 'quad': case 'qquad': o.s += ' '; o.sep = false; return;
        case ',': case ';': case ':': case '!': return;
        default:
      }
      if (GREEK[name]) { o.put(GREEK[name], 'letter'); return; }
      if (OPERATOR_WORDS.indexOf(name) >= 0) { fn(o, name); return; }
      o.put(name, 'word');
    }
    function seq(stop) {
      const o = new Out();
      while (i < s.length) {
        if (stop && stop()) break;
        const c = s[i];
        if (c === ' ') { i++; continue; }
        if (c === '\\') { command(o); continue; }
        if (c === '{') { o.put(group(), 'plain'); continue; }
        if (c === '}') { if (stop) break; i++; continue; }
        if (c === '^') { i++; power(o); continue; }
        if (c === '_') { i++; sub(o); continue; }
        o.put(c, /[0-9.]/.test(c) ? 'num' : /[A-Za-zα-ωΑ-Ω]/.test(c) ? 'letter' : 'plain');
        i++;
      }
      return o.s;
    }
    return seq(null).replace(/\s+/g, ' ').trim();
  }

  /* ── Plain text → LaTeX for MathQuill ───────────────────────────────
     A small reader with flux-expr.js's own rules, so what is shown is what
     will be worked out: implicit products bind tighter than + and −, a
     fraction's top is everything multiplied so far and its bottom is the
     next factor only, and the power in x^ab is a alone. Anything it cannot
     read is passed through as it is, so nothing typed is ever lost. */

  const NAME_RE = /^[a-zA-Zπα-ωΑ-Ω][a-zA-Z0-9α-ωΑ-Ω_]*/;
  const NUM_RE = /^[0-9]*\.?[0-9]+(?:[eE][+-]?[0-9]+)?/;
  const LETTER = /[a-zA-Zπα-ωΑ-Ω]/;
  const RELATIONS = [['<=', '\\le '], ['>=', '\\ge '], ['!=', '\\ne '], ['≤', '\\le '], ['≥', '\\ge '], ['≠', '\\ne '],
    ['<', '<'], ['>', '>'], ['=', '='], ['~', '\\sim ']];
  const CONST_WORDS = ['pi', 'tau', 'e'];

  function letters(t) {
    return t.replace(/[α-ωΑ-Ω]/g, (g) => (GREEK_CMD[g] ? '\\' + GREEK_CMD[g] + ' ' : g));
  }
  function nameTex(name) {
    if (name === 'pi' || name === 'π') return '\\pi ';
    if (name === 'tau') return '\\tau ';
    if (name === 'theta') return '\\theta ';
    let m = /^([a-zA-Zα-ωΑ-Ω]+)([0-9]+)$/.exec(name);
    if (m) return letters(m[1]) + '_{' + m[2] + '}';
    m = /^([a-zA-Zα-ωΑ-Ω][a-zA-Z0-9α-ωΑ-Ω]*)_([a-zA-Z0-9α-ωΑ-Ω]+)$/.exec(name);
    if (m) return letters(m[1]) + '_{' + m[2] + '}';
    return letters(name);
  }
  function fnTex(name, inner) {
    if (name === 'sqrt') return '\\sqrt{' + inner + '}';
    if (name === 'cbrt') return '\\sqrt[3]{' + inner + '}';
    if (name === 'abs') return '\\left|' + inner + '\\right|';
    return (FN_TEX[name] || '\\operatorname{' + name + '}') + '\\left(' + inner + '\\right)';
  }
  function lit(c) {
    if (c === '{') return '\\{';
    if (c === '}') return '\\}';
    if (c === '%') return '\\%';
    if (c === '*') return '\\cdot ';
    if (c === '~') return '\\sim ';
    if (/[\\#&$^_ ]/.test(c)) return '';
    return c;
  }

  function toLatex(plain) {
    const S = String(plain == null ? '' : plain).replace(/−/g, '-').replace(/[·×]/g, '*').replace(/\s+/g, ' ');
    // Only brackets that close become \left…\right; a half-typed "(" stays a plain character.
    const match = {};
    const stack = [];
    const PAIR = { '(': ')', '[': ']', '{': '}' };
    for (let k = 0; k < S.length; k++) {
      const c = S[k];
      if (PAIR[c]) stack.push(k);
      else if (c === ')' || c === ']' || c === '}') {
        if (stack.length && PAIR[S[stack[stack.length - 1]]] === c) match[stack.pop()] = k;
        else stack.length = 0;
      }
    }
    let i = 0;
    const ws = () => { while (S[i] === ' ') i++; };
    const startsFactor = (k) => { const c = S[k]; return c != null && (/[0-9.([{]/.test(c) || LETTER.test(c)); };

    function atom(end, one) {
      ws();
      if (i >= end) return null;
      const c = S[i];
      if (c === '(' || c === '[' || c === '{') {
        const close = match[i];
        if (close == null || close >= end) return null;
        i++;
        const inner = seq(close);
        i = close + 1;
        if (c === '(') return { tex: '\\left(' + inner + '\\right)', inner: inner };
        if (c === '[') return { tex: '\\left[' + inner + '\\right]', inner: null };
        return { tex: '\\left\\{' + inner + '\\right\\}', inner: null };
      }
      const nm = NUM_RE.exec(S.slice(i, end));
      if (nm) { i += nm[0].length; return { tex: nm[0], inner: null }; }
      const m = NAME_RE.exec(S.slice(i, end));
      if (!m) return null;
      let name = m[0];
      const lower = name.toLowerCase();
      let k = i + name.length;
      while (S[k] === ' ') k++;
      if (S[k] === '(' && match[k] != null && match[k] < end && isFn(lower)) {
        const close = match[k];
        i = k + 1;
        const inner = seq(close);
        i = close + 1;
        return { tex: fnTex(lower, inner), inner: null };
      }
      // In a power, flux-expr reads one letter: x^ab is x^a · b.
      if (one && /^[a-zA-Zα-ωΑ-Ω]+$/.test(name) && name.length > 1 && CONST_WORDS.indexOf(lower) < 0) {
        name = name.slice(0, lower.indexOf('pi') === 0 ? 2 : 1);
      }
      i += name.length;
      let primes = '';
      while (S[i] === "'" || S[i] === '′') { primes += "'"; i++; }
      return { tex: nameTex(name) + primes, inner: null };
    }
    function power(end, one) {
      const base = atom(end, one);
      if (!base) return null;
      ws();
      if (i < end && S[i] === '^') {
        i++;
        const ex = unary(end, true);
        return { tex: base.tex + '^{' + (ex ? (ex.inner != null ? ex.inner : ex.tex) : '') + '}', inner: null };
      }
      return base;
    }
    function unary(end, one) {
      ws();
      if (i < end && (S[i] === '-' || S[i] === '+')) {
        const sign = S[i];
        i++;
        const u = unary(end, one);
        return { tex: sign + (u ? u.tex : ''), inner: null };
      }
      return power(end, one);
    }
    function term(end) {
      const first = unary(end, false);
      if (!first) return '';
      let out = first.tex, count = 1, only = first;
      for (;;) {
        ws();
        if (i >= end) return out;
        const c = S[i];
        if (c === '*' || c === '%') {
          i++;
          const g = unary(end, false);
          out += (c === '*' ? '\\cdot ' : '\\% ') + (g ? g.tex : '');
          count++;
          continue;
        }
        if (c === '/') {
          i++;
          const g = unary(end, false);
          if (!g) { out += '/'; count++; continue; }
          out = '\\frac{' + (count === 1 && only.inner != null ? only.inner : out) + '}{' + (g.inner != null ? g.inner : g.tex) + '}';
          count = 1;
          only = { tex: out, inner: null };
          continue;
        }
        // Side by side is multiplied, as in flux-expr: 2x, 3(x+1), a sin(x).
        if (c === '[' || c === '{' || !startsFactor(i)) return out;
        const g = unary(end, false);
        if (!g) return out;
        // 2·3 and x·2 need the dot, or they would read back as 23 and x2.
        out += (/^[0-9.]/.test(g.tex) ? '\\cdot ' : '') + g.tex;
        count++;
      }
    }
    function expr(end) {
      let out = term(end);
      for (;;) {
        ws();
        if (i < end && (S[i] === '+' || S[i] === '-')) {
          out += S[i];
          i++;
          out += term(end);
        } else return out;
      }
    }
    function seq(end) {
      let out = '';
      for (;;) {
        ws();
        if (i >= end) return out;
        const r = RELATIONS.find((x) => S.startsWith(x[0], i));
        if (r) { out += r[1]; i += r[0].length; continue; }
        if (S[i] === ',') { out += ','; i++; continue; }
        const at = i;
        const e = (startsFactor(i) || S[i] === '-' || S[i] === '+') ? expr(end) : '';
        if (i === at) { out += lit(S[i]); i++; } else out += e;
      }
    }
    return seq(S.length).trim();
  }

  /* ── Loading ─────────────────────────────────────────────────────────── */

  let MQ = null;
  let loading = null;

  function addScript(src) {
    return new Promise((resolve, reject) => {
      const el = document.createElement('script');
      el.src = src;
      el.async = true;
      el.onload = () => resolve();
      el.onerror = () => reject(new Error('Could not load ' + src));
      document.head.appendChild(el);
    });
  }

  /** Resolves to MathQuill's interface, or null if it cannot be loaded. */
  function load() {
    if (MQ) return Promise.resolve(MQ);
    if (loading) return loading;
    if (!document.querySelector('link[data-flux-mathquill]')) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = MQ_CSS;
      link.setAttribute('data-flux-mathquill', '');
      document.head.appendChild(link);
    }
    loading = (async () => {
      let jq = window.jQuery;
      const ours = !jq;
      if (ours) {
        await addScript(JQUERY_SRC);
        jq = window.jQuery;
        /* jQuery takes window.$ as it loads. The load event fires straight
           after the script runs, with nothing in between, so the page gets
           its own $ back before any of its code could see jQuery's. */
        jq.noConflict();
      }
      if (!window.MathQuill) await addScript(MQ_SRC);
      // MathQuill has kept its own reference; put window.jQuery back too.
      if (ours && window.jQuery === jq) jq.noConflict(true);
      MQ = window.MathQuill.getInterface(2);
      return MQ;
    })().catch((e) => {
      console.warn('[FluxMathField] typing stays plain text:', e && e.message);
      return null;
    });
    return loading;
  }

  /* ── A field ─────────────────────────────────────────────────────────── */

  function cursorOf(host) { return host.querySelector('.mq-cursor'); }
  function isBracketBlock(el) {
    const prev = el && el.previousElementSibling;
    return !!(prev && prev.classList.contains('mq-paren'));
  }

  /* ")" typed in an exponent or a fraction closes the bracket it belongs
     to, as in Desmos: e^(-x^2) is e to the (−x²), not e^(−x^(2)) with a
     stray pair of brackets in the power. MathQuill 0.10 would open a new
     bracket inside the exponent instead. */
  function leaveForBracket(mf, host) {
    const cur = cursorOf(host);
    if (!cur) return false;
    let target = cur.parentElement;
    if (isBracketBlock(target)) return false;
    while (target && target !== host && !target.classList.contains('mq-root-block') && !isBracketBlock(target)) {
      target = target.parentElement;
    }
    if (!target || target === host || target.classList.contains('mq-root-block')) return false;
    for (let n = 0; n < 80; n++) {
      const c = cursorOf(host);
      if (!c || c.parentElement === target) break;
      mf.keystroke('Right');
    }
    const c = cursorOf(host);
    return !!(c && c.parentElement === target);
  }

  /* 1e5 is a number — 100000 — so its 5 stays on the line. MathQuill's
     x1 → x₁ would otherwise make it e₅, showing something other than what
     the grapher reads. True when the cursor sits just after the e of 2e. */
  function afterNumberE(host) {
    const cur = cursorOf(host);
    const e = cur && cur.previousElementSibling;
    if (!e || e.tagName !== 'VAR' || e.textContent !== 'e') return false;
    const d = e.previousElementSibling;
    return !!(d && d.tagName !== 'VAR' && /^[0-9.]$/.test(d.textContent));
  }
  /* "sqrt(x+4)/2": typing sqrt makes the √ at once, so the ( that follows
     out of habit would become a bracket inside it, and the ) would close
     only that — leaving the cursor under the root, and /2 − x² with it. The
     ( typed first thing under a new root is taken as the root's own, and
     its ) steps out of the root, as it would in the plain text. */
  function sqrtOpen(host) {
    const cur = cursorOf(host);
    const stem = cur && cur.parentElement;
    if (!stem || !stem.classList.contains('mq-sqrt-stem') || stem.dataset.fluxParen) return false;
    if (stem.children.length !== 1) return false;
    stem.dataset.fluxParen = '1';
    return true;
  }
  function sqrtClose(mf, host) {
    const cur = cursorOf(host);
    for (let el = cur && cur.parentElement; el && el !== host && !el.classList.contains('mq-root-block'); el = el.parentElement) {
      if (isBracketBlock(el)) return false;          // a real bracket is nearer: that is what ) closes
      if (!el.classList.contains('mq-sqrt-stem')) continue;
      if (el.dataset.fluxParen !== '1') return false;
      const root = el.parentElement;
      for (let n = 0; n < 80 && root.contains(cursorOf(host)); n++) mf.keystroke('Right');
      return !root.contains(cursorOf(host));
    }
    return false;
  }

  /** One typed character, with the Desmos habits MathQuill 0.10 lacks. */
  function typeChar(mf, host, ch) {
    if (/^[0-9]$/.test(ch) && afterNumberE(host)) { mf.write(ch); return; }
    if (ch === '(' && sqrtOpen(host)) return;
    if (ch === ')' && sqrtClose(mf, host)) return;
    if (ch === ')' || ch === ']') leaveForBracket(mf, host);
    mf.typedText(ch);
  }

  /**
   * Turn `host` (an empty span) into a maths field. handlers:
   *   edit(latex)   the content changed because of the person, not set()
   *   enter()       Enter
   *   up() / down() the arrow keys, from the top or bottom line
   *   deleteOut()   Backspace with nothing left to delete
   */
  function create(host, handlers) {
    if (!MQ) return null;
    const h = handlers || {};
    let mf = null;
    mf = MQ.MathField(host, {
      spaceBehavesLikeTab: false,
      restrictMismatchedBrackets: true,
      sumStartsWithNEquals: true,
      supSubsRequireOperand: true,
      charsThatBreakOutOfSupSub: '+-=<>*',
      autoSubscriptNumerals: true,
      autoCommands: 'pi tau theta sqrt',
      autoOperatorNames: AUTO_OPERATORS,
      handlers: {
        edit: () => { if (!host._fluxQuiet && mf && h.edit) h.edit(mf.latex()); },
        enter: () => { if (h.enter) h.enter(); },
        upOutOf: () => { if (h.up) h.up(); },
        downOutOf: () => { if (h.down) h.down(); },
        deleteOutOf: (dir) => { if (h.deleteOut && dir === MQ.L) h.deleteOut(); },
      },
    });
    host.addEventListener('keydown', (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const own = (/^[0-9]$/.test(e.key) && afterNumberE(host))
        || (e.key === '(' && sqrtOpen(host))
        || (e.key === ')' && sqrtClose(mf, host));
      if (own) {
        e.preventDefault();
        e.stopPropagation();
        if (/^[0-9]$/.test(e.key)) mf.write(e.key);
        return;
      }
      if (e.key !== ')' && e.key !== ']') return;
      if (!leaveForBracket(mf, host)) return;
      e.preventDefault();
      e.stopPropagation();
      mf.typedText(e.key);
    }, true);

    /* Phone keyboards type without a keypress event, and MathQuill 0.10
       only reads its hidden textarea after one — so on Android nothing
       typed ever arrived. Whatever an input event leaves in the textarea — a
       phone's letter, or a whole word from its suggestions — is taken at
       once and typed in here. Not a moment later: MathQuill resets the
       textarea on a timer after every change of selection, and text typed
       in that gap was being wiped. On a computer, where MathQuill reads the
       textarea itself, it finds it already empty and does nothing more. */
    const ta = host.querySelector('textarea');
    if (ta) {
      const flush = () => {
        const text = ta.value;
        if (!text) return;
        ta.value = '';
        for (const ch of text) typeChar(mf, host, ch);
      };
      ta.addEventListener('input', (e) => { if (!e.isComposing) flush(); });
      ta.addEventListener('compositionend', flush);
      // …and their Backspace arrives as a request to delete from the empty textarea.
      ta.addEventListener('beforeinput', (e) => {
        if (e.inputType === 'deleteContentBackward' && !ta.value) {
          e.preventDefault();
          mf.keystroke('Backspace');
        }
      });
    }
    return mf;
  }

  /** Show `latex` without it counting as an edit. */
  function set(mf, latex) {
    const host = mf.el();
    host._fluxQuiet = true;
    try { mf.latex(latex || ''); } finally { host._fluxQuiet = false; }
  }

  /** Backspace from the keypad: "sin(" goes as one, name and brackets. */
  function backspace(mf) {
    const host = mf.el();
    const cur = cursorOf(host);
    const block = cur && cur.parentElement;
    const emptyBracket = !!(block && isBracketBlock(block) && block.children.length === 1);
    mf.keystroke('Backspace');
    if (!emptyBracket) return;
    // Count the name's letters first: once one goes, the rest stop being a
    // name ("si" is s·i) and could no longer be told apart from letters.
    let n = 0;
    for (let el = cursorOf(host); el && el.previousElementSibling; el = el.previousElementSibling) {
      if (!el.previousElementSibling.classList.contains('mq-operator-name')) break;
      n++;
    }
    for (let k = 0; k < n; k++) mf.keystroke('Backspace');
  }

  /* The keypad's keys are written for the plain text box ("sin(|)" puts the
     cursor at the bar). Here each becomes what typing it would do. */
  const KEY_ACTIONS = {
    'sqrt(|)': (mf) => mf.cmd('\\sqrt'),
    'cbrt(|)': (mf) => { mf.write('\\sqrt[3]{}'); mf.keystroke('Left'); },
    'abs(|)': (mf) => mf.typedText('|'),
    'asin(|)': (mf) => mf.typedText('arcsin('),
    'acos(|)': (mf) => mf.typedText('arccos('),
    'atan(|)': (mf) => mf.typedText('arctan('),
    'e^(|)': (mf) => mf.typedText('e^'),
    '10^(|)': (mf) => mf.typedText('10^'),
    '^2': (mf) => { mf.typedText('^2'); mf.keystroke('Right'); },
    '*': (mf) => mf.cmd('\\cdot'),
    'θ': (mf) => mf.cmd('\\theta'),
    'α': (mf) => mf.cmd('\\alpha'),
    'β': (mf) => mf.cmd('\\beta'),
    ' ~ ': (mf) => mf.typedText('~'),
  };
  function press(mf, key) {
    if (key === '@left') mf.keystroke('Left');
    else if (key === '@right') mf.keystroke('Right');
    else if (key === '@back') backspace(mf);
    else if (KEY_ACTIONS[key]) KEY_ACTIONS[key](mf);
    else {
      const bar = key.indexOf('|');
      // The bracket closes itself, so only what comes before the cursor is typed.
      mf.typedText((bar >= 0 ? key.slice(0, bar) : key).replace(/^ +/, ''));
    }
  }

  window.FluxMathField = {
    load: load,
    ready: () => !!MQ,
    create: create,
    set: set,
    press: press,
    toPlain: toPlain,
    toLatex: toLatex,
  };
})();
