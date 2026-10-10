/* ════════════════════════════════════════════════════════════════════════
   FLUX · Calculator engine — flux-ti84-engine.js
   ------------------------------------------------------------------------
   The language a TI-84 Plus CE speaks, reimplemented: numbers held to 14
   digits and shown to 10, complex numbers, lists {1,2,3}, matrices
   [[1,2][3,4]], variables A–Z and θ, Ans, L₁–L₆, [A]–[J], Y₁–Y₀, STO→,
   implicit multiplication, the calculator's own order of operations
   (−2² is −4, 2^3^2 is 64), and its error messages ("ERR:DOMAIN").

   Input arrives as a string of token codes produced by the calculator's
   keys (flux-ti84.js). Most codes are the symbols you see — "sin(", "√(",
   "→" — and a few are spelled so they cannot be confused with anything
   typed: negation is "⁻" (the (−) key) and subtraction "-" (the − key);
   named system values are "⟨x̄⟩", "⟨Xmin⟩", "⟨RegEQ⟩"; matrices "⟦A⟧".

   The engine owns no screen. run(code) evaluates a line against a state
   object and returns what to show; the UI keeps the state and saves it.
   ════════════════════════════════════════════════════════════════════════ */
(function (root) {
  'use strict';

  /* ── Errors ────────────────────────────────────────────────────────── */

  class TIError extends Error {
    constructor(kind) { super('ERR:' + kind); this.ti = kind; }
  }
  function fail(kind) { throw new TIError(kind); }
  const S = () => root.FluxTIStats;

  /* ── Values ────────────────────────────────────────────────────────────
     number                 a real
     { t: 'cx', re, im }    a complex number (only ever with im ≠ 0)
     { t: 'list', v: [] }   a list of reals/complexes
     { t: 'mat', v: [[]] }  a matrix of reals
     { t: 'str', v: '' }    a string                                      */

  const MAXV = 9.99999999999999e99;
  const isCx = (v) => !!v && v.t === 'cx';
  const isList = (v) => !!v && v.t === 'list';
  const isMat = (v) => !!v && v.t === 'mat';
  const isStr = (v) => !!v && v.t === 'str';
  const isNum = (v) => typeof v === 'number';
  const isScalar = (v) => isNum(v) || isCx(v);
  const list = (arr) => ({ t: 'list', v: arr });
  const mat = (rows) => ({ t: 'mat', v: rows });
  const str = (s) => ({ t: 'str', v: s });

  /** A real result: rounded to the 14 digits the calculator keeps, with its overflow and underflow. */
  function R(x) {
    if (typeof x !== 'number') return x;
    if (Number.isNaN(x)) fail('DOMAIN');
    if (!Number.isFinite(x) || Math.abs(x) > MAXV) fail('OVERFLOW');
    if (x === 0 || Math.abs(x) < 1e-99) return 0;
    return +x.toPrecision(14);
  }
  /** A complex result; collapses to a real when the imaginary part is (numerically) nothing. */
  function Cn(re, im) {
    const m = Math.max(Math.abs(re), Math.abs(im));
    if (Math.abs(im) <= 1e-13 * m || im === 0) return R(re);
    if (Math.abs(re) <= 1e-13 * m) re = 0;
    return { t: 'cx', re: R(re), im: R(im) };
  }
  const reOf = (v) => (isCx(v) ? v.re : v);
  const imOf = (v) => (isCx(v) ? v.im : 0);

  function cAdd(a, b) { return Cn(reOf(a) + reOf(b), imOf(a) + imOf(b)); }
  function cSub(a, b) { return Cn(reOf(a) - reOf(b), imOf(a) - imOf(b)); }
  function cMul(a, b) {
    const ar = reOf(a), ai = imOf(a), br = reOf(b), bi = imOf(b);
    return Cn(ar * br - ai * bi, ar * bi + ai * br);
  }
  function cDiv(a, b) {
    const ar = reOf(a), ai = imOf(a), br = reOf(b), bi = imOf(b);
    const d = br * br + bi * bi;
    if (d === 0) fail('DIVIDE BY 0');
    return Cn((ar * br + ai * bi) / d, (ai * br - ar * bi) / d);
  }
  const cAbs = (a) => Math.hypot(reOf(a), imOf(a));
  const cArg = (a) => Math.atan2(imOf(a), reOf(a));
  function cExp(a) { const m = Math.exp(reOf(a)); return Cn(m * Math.cos(imOf(a)), m * Math.sin(imOf(a))); }
  function cLn(a) {
    if (reOf(a) === 0 && imOf(a) === 0) fail('DOMAIN');
    return Cn(Math.log(cAbs(a)), cArg(a));
  }
  function cSqrt(a) {
    const r = cAbs(a), re = reOf(a), im = imOf(a);
    const sr = Math.sqrt((r + re) / 2), si = Math.sqrt(Math.max(0, (r - re) / 2));
    return Cn(sr, im < 0 ? -si : si);
  }
  function cPowInt(a, n) {
    let base = a, out = 1, k = Math.abs(n);
    while (k > 0) { if (k & 1) out = cMul(out, base); base = cMul(base, base); k = Math.floor(k / 2); }
    return n < 0 ? cDiv(1, out) : out;
  }

  /* ── Context: the state an evaluation runs against ───────────────────── */

  function freshState() {
    const lists = {};
    for (let k = 1; k <= 6; k++) lists['L' + SUB[k]] = [];
    const y = {};
    YNAMES.forEach((n) => { y[n] = ''; });
    ['u(n)', 'v(n)', 'w(n)'].forEach((n) => { y[n] = ''; });
    return {
      vars: {}, ans: 0, lists: lists, mats: {}, strs: {}, y: y, sys: {},
      sequences: { u: { initial: [0] }, v: { initial: [0] }, w: { initial: [0] } },
      mode: {
        mathprint: true, notation: 'normal', digits: 'float', angle: 'rad', graph: 'func', model: 'ce',
        complex: 'real', answers: 'auto', fracType: 'n/d', statDiag: false,
      },
      win: { Xmin: -10, Xmax: 10, Xscl: 1, Ymin: -10, Ymax: 10, Yscl: 1, Xres: 1, XFact: 4, YFact: 4, TraceStep: null,
        Tmin: 0, Tmax: 2 * Math.PI, Tstep: Math.PI / 24, 'θmin': 0, 'θmax': 2 * Math.PI, 'θstep': Math.PI / 24,
        nMin: 0, nMax: 10, PlotStart: 0, PlotStep: 1 },
      tbl: { TblStart: 0, 'ΔTbl': 1, indpnt: 'auto', depend: 'auto' },
      tvm: { N: 0, I: 0, PV: 0, PMT: 0, FV: 0, PY: 1, CY: 1, begin: false },
      seed: [12345, 67890],
    };
  }
  const SUB = ['₀', '₁', '₂', '₃', '₄', '₅', '₆', '₇', '₈', '₉'];
  const YNAMES = ['Y₁', 'Y₂', 'Y₃', 'Y₄', 'Y₅', 'Y₆', 'Y₇', 'Y₈', 'Y₉', 'Y₀'];

  /* ── Vocabulary ──────────────────────────────────────────────────────── */

  /** Functions: name → [minArgs, maxArgs]. The implementation lives in FN below. */
  const FN_ARITY = {
    'sin(': [1, 1], 'cos(': [1, 1], 'tan(': [1, 1], 'sin⁻¹(': [1, 1], 'cos⁻¹(': [1, 1], 'tan⁻¹(': [1, 1],
    'sinh(': [1, 1], 'cosh(': [1, 1], 'tanh(': [1, 1], 'sinh⁻¹(': [1, 1], 'cosh⁻¹(': [1, 1], 'tanh⁻¹(': [1, 1],
    'ln(': [1, 1], 'log(': [1, 1], 'e^(': [1, 1], '10^(': [1, 1], '√(': [1, 1], '∛(': [1, 1], 'logBASE(': [2, 2],
    'abs(': [1, 1], 'round(': [1, 2], 'iPart(': [1, 1], 'fPart(': [1, 1], 'int(': [1, 1],
    'min(': [1, 2], 'max(': [1, 2], 'lcm(': [2, 2], 'gcd(': [2, 2], 'remainder(': [2, 2],
    'conj(': [1, 1], 'real(': [1, 1], 'imag(': [1, 1], 'angle(': [1, 1],
    'randInt(': [2, 3], 'randNorm(': [2, 3], 'randBin(': [2, 3], 'randIntNoRep(': [2, 3],
    'fMin(': [4, 5], 'fMax(': [4, 5], 'nDeriv(': [3, 4], 'fnInt(': [4, 5], 'Σ(': [4, 4], 'solve(': [3, 4], 'seq(': [4, 5],
    'R▶Pr(': [2, 2], 'R▶Pθ(': [2, 2], 'P▶Rx(': [2, 2], 'P▶Ry(': [2, 2],
    'not(': [1, 1],
    'dim(': [1, 1], 'cumSum(': [1, 1], 'ΔList(': [1, 1], 'augment(': [2, 2], 'List▶matr(': [2, 99], 'Matr▶list(': [2, 3],
    'mean(': [1, 2], 'median(': [1, 2], 'sum(': [1, 3], 'prod(': [1, 3], 'stdDev(': [1, 2], 'variance(': [1, 2],
    'det(': [1, 1], 'identity(': [1, 1], 'randM(': [2, 2], 'rref(': [1, 1], 'ref(': [1, 1],
    'rowSwap(': [3, 3], 'row+(': [3, 3], '*row(': [3, 3], '*row+(': [4, 4],
    'normalpdf(': [1, 3], 'normalcdf(': [2, 4], 'invNorm(': [1, 4], 'invT(': [2, 2], 'tpdf(': [2, 2], 'tcdf(': [3, 3],
    'χ²pdf(': [2, 2], 'χ²cdf(': [3, 3], 'Fpdf(': [3, 3], 'Fcdf(': [4, 4], 'binompdf(': [2, 3], 'binomcdf(': [2, 3],
    'invBinom(': [3, 3], 'poissonpdf(': [2, 2], 'poissoncdf(': [2, 2], 'geometpdf(': [2, 2], 'geometcdf(': [2, 2],
    'npv(': [3, 4], 'irr(': [2, 3], 'bal(': [1, 2], 'ΣPrn(': [2, 3], 'ΣInt(': [2, 3], '▶Nom(': [2, 2], '▶Eff(': [2, 2], 'dbd(': [2, 2],
    'tvm_Pmt(': [0, 6], 'tvm_I%(': [0, 6], 'tvm_PV(': [0, 6], 'tvm_N(': [0, 6], 'tvm_FV(': [0, 6],
    'sub(': [1, 3], 'inString(': [2, 3], 'length(': [1, 1], 'expr(': [1, 1], 'toString(': [1, 2], 'eval(': [1, 1],
  };
  /** Functions that receive their arguments unevaluated (an expression and a variable to run it over). */
  const RAW = new Set(['fMin(', 'fMax(', 'nDeriv(', 'fnInt(', 'Σ(', 'solve(', 'seq(']);
  /** Words that are values, not calls. */
  const NULLARY = ['rand', 'getKey', 'Pmt_End', 'Pmt_Bgn', 'tvm_Pmt', 'tvm_I%', 'tvm_PV', 'tvm_N', 'tvm_FV', 'LEFT', 'CENTER', 'RIGHT'];

  /** Statements that are not expressions. */
  const STAT_CMDS = ['1-Var Stats', '2-Var Stats', 'Med-Med', 'LinReg(ax+b)', 'LinReg(a+bx)', 'QuadReg', 'CubicReg',
    'QuartReg', 'LnReg', 'ExpReg', 'PwrReg', 'Logistic', 'SinReg'];
  const CMDS = STAT_CMDS.concat(['SortA(', 'SortD(', 'ClrList', 'ClrAllLists', 'SetUpEditor', 'Fill(', 'ClrHome', 'DelVar',
    'Disp', 'Output(', 'Input', 'Prompt', 'Pause', 'ClrDraw', 'ClrTable', 'DispGraph', 'DispTable', 'FnOn', 'FnOff',
    'Degree', 'Radian', 'Normal', 'Sci', 'Eng', 'Float', 'Fix', 'a+bi', 'Real', 're^θi', 'Func', 'Param', 'Polar', 'Seq',
    'MATHPRINT', 'CLASSIC', 'Line(', 'Horizontal', 'Vertical', 'Circle(', 'Text(', 'DrawF', 'DrawInv', 'Shade(', 'Tangent(',
    'Pt-On(', 'Pt-Off(', 'Pt-Change(', 'ShadeNorm(', 'Shade_t(', 'Shadeχ²(', 'ShadeF(',
    'ZStandard', 'ZTrig', 'ZDecimal', 'ZSquare', 'ZInteger', 'ZoomStat', 'ZoomFit', 'ZQuadrant1', 'ZoomRcl', 'ZoomSto',
    'GridOn', 'GridOff', 'AxesOn', 'AxesOff', 'LabelOn', 'LabelOff', 'CoordOn', 'CoordOff',
    'If', 'Then', 'Else', 'End', 'For(', 'While', 'Repeat', 'Return', 'Stop', 'Lbl', 'Goto', 'IS>(', 'DS<(', 'Menu(', 'prgm']);
  const CONV = ['▶Frac', '▶Dec', '▶DMS', '▶Rect', '▶Polar', '▶n/d◀▶Un/d', '▶F◀▶D'];
  const POSTFIX = ['⁻¹', '²', '³', 'ᵀ', '!', '°', 'ʳ', '′', '″'];
  const WORD_OPS = ['nPr', 'nCr', 'and', 'or', 'xor'];

  const VOCAB = Object.keys(FN_ARITY).concat(NULLARY, CMDS, CONV, POSTFIX, WORD_OPS,
    ['Ans', 'ˣ√', '→', '≠', '≥', '≤', 'π', 'L₁', 'L₂', 'L₃', 'L₄', 'L₅', 'L₆'], YNAMES,
    ['X₁ᴛ', 'Y₁ᴛ', 'X₂ᴛ', 'Y₂ᴛ', 'X₃ᴛ', 'Y₃ᴛ', 'X₄ᴛ', 'Y₄ᴛ', 'X₅ᴛ', 'Y₅ᴛ', 'X₆ᴛ', 'Y₆ᴛ', 'r₁', 'r₂', 'r₃', 'r₄', 'r₅', 'r₆'])
    .sort((a, b) => b.length - a.length);

  /* ── Tokenizer ───────────────────────────────────────────────────────── */

  const NUM_RE = /^(?:\d+\.?\d*|\.\d+)(?:ᴇ[⁻-]?\d+)?/;
  const DIGIT_WORDS = ['1-Var Stats', '2-Var Stats', '10^('];
  function tokenize(src) {
    const s = String(src);
    const out = [];
    let i = 0;
    while (i < s.length) {
      const c = s[i];
      if (c === ' ' || c === '\n') { i++; continue; }
      if (c === '⟨') {
        const j = s.indexOf('⟩', i);
        if (j < 0) fail('SYNTAX');
        out.push({ k: 'sys', v: s.slice(i + 1, j) });
        i = j + 1; continue;
      }
      if (c === '⟦') {
        const j = s.indexOf('⟧', i);
        if (j < 0) fail('SYNTAX');
        out.push({ k: 'mname', v: s.slice(i + 1, j) });
        i = j + 1; continue;
      }
      if (c === '"') {
        const j = s.indexOf('"', i + 1);
        const end = j < 0 ? s.length : j;
        out.push({ k: 'str', v: s.slice(i + 1, end) });
        i = end + 1;
        // A string auto-closes before → or : when its quote is missing, as on the calculator.
        continue;
      }
      if (c === 'ʟ') {
        const m = /^ʟ([A-Zθ][A-Z0-9θ]{0,4})/.exec(s.slice(i));
        if (!m) fail('SYNTAX');
        out.push({ k: 'lname', v: 'ʟ' + m[1] });
        i += m[0].length; continue;
      }
      // Words that start with a digit, before the digit is taken as a number.
      const dw = DIGIT_WORDS.find((w) => s.startsWith(w, i));
      if (dw) { out.push({ k: 'word', v: dw }); i += dw.length; continue; }
      const nm = NUM_RE.exec(s.slice(i));
      if (nm) {
        const txt = nm[0].replace('ᴇ', 'e').replace('⁻', '-');
        const v = parseFloat(txt);
        if (Math.abs(v) > MAXV) fail('OVERFLOW');
        out.push({ k: 'num', v: v, raw: nm[0] });
        i += nm[0].length; continue;
      }
      let hit = null;
      if ('uvw'.indexOf(c) >= 0 && s[i + 1] === '(') {
        out.push({ k: 'seqname', v: c }); i++; continue;
      }
      for (const w of VOCAB) { if (s.startsWith(w, i)) { hit = w; break; } }
      if (hit) {
        let kind = 'word';
        if (/^L[₁-₆]$/.test(hit)) kind = 'lname';
        else if (YNAMES.indexOf(hit) >= 0 || /^[XY][₁-₆]ᴛ$|^r[₁-₆]$/.test(hit)) kind = 'yname';
        out.push({ k: kind, v: hit });
        i += hit.length; continue;
      }
      if (/[A-Zθ]/.test(c) || c === 'n') { out.push({ k: 'var', v: c }); i++; continue; }
      if (c === 'e') { out.push({ k: 'const', v: 'e' }); i++; continue; }
      if (c === 'i') { out.push({ k: 'imag' }); i++; continue; }
      if ('+-−*×/÷^()[]{},:=<>⁻!\'′'.indexOf(c) >= 0) { out.push({ k: 'op', v: c }); i++; continue; }
      fail('SYNTAX');
    }
    return out;
  }

  /* ── Parser ──────────────────────────────────────────────────────────── */

  function Parser(tokens) { this.t = tokens; this.i = 0; }
  Parser.prototype.peek = function (o) { return this.t[this.i + (o || 0)]; };
  Parser.prototype.next = function () { return this.t[this.i++]; };
  Parser.prototype.is = function (v, o) { const k = this.peek(o); return !!k && (k.k === 'op' || k.k === 'word') && k.v === v; };
  Parser.prototype.eat = function (v) { if (this.is(v)) { this.i++; return true; } return false; };
  Parser.prototype.atEnd = function () { const k = this.peek(); return !k || (k.k === 'op' && k.v === ':'); };
  /** A closing bracket is optional at the end of a statement and before →, as on the calculator. */
  Parser.prototype.close = function (v) {
    if (this.eat(v)) return;
    if (this.atEnd() || this.is('→')) return;
    fail('SYNTAX');
  };

  /** One statement: a command, or an expression with an optional →target and a trailing ▶conversion. */
  Parser.prototype.statement = function () {
    const k = this.peek();
    if (k && k.k === 'word' && CMDS.indexOf(k.v) >= 0) return this.command();
    const e = this.expr();
    let node = e;
    if (this.peek() && this.peek().k === 'word' && CONV.indexOf(this.peek().v) >= 0) {
      node = { k: 'conv', to: this.next().v, a: node };
    }
    while (this.eat('→')) node = { k: 'store', a: node, target: this.target() };
    if (!this.atEnd()) fail('SYNTAX');
    return node;
  };
  Parser.prototype.target = function () {
    const k = this.next();
    if (!k) fail('SYNTAX');
    if (k.k === 'var') {
      if (this.is('(')) fail('SYNTAX');
      return { k: 'var', v: k.v };
    }
    if (k.k === 'lname' || k.k === 'mname') {
      if (this.eat('(')) { const args = this.args(')'); return { k: 'elem', of: k, args: args }; }
      return { k: k.k, v: k.v };
    }
    if (k.k === 'yname') return { k: 'yname', v: k.v };
    if (k.k === 'seqname') {
      if (!this.eat('(')) fail('SYNTAX');
      const args = this.args(')');
      if (args.length !== 1) fail('ARGUMENT');
      return { k: 'seqtarget', v: k.v, n: args[0] };
    }
    if (k.k === 'sys') return { k: 'sys', v: k.v };
    if (k.k === 'word' && k.v === 'rand') return { k: 'seed' };
    if (k.k === 'word' && k.v === 'dim(') {
      const a = this.next();
      this.close(')');
      return { k: 'dim', of: a };
    }
    fail('SYNTAX');
    return null;
  };
  Parser.prototype.command = function () {
    const name = this.next().v;
    const args = [];
    const takesParen = name.endsWith('(');
    if (!this.atEnd()) {
      args.push(this.exprOrName());
      while (this.eat(',')) args.push(this.exprOrName());
      if (takesParen) this.close(')');
    }
    if (!this.atEnd()) fail('SYNTAX');
    return { k: 'cmd', name: name, args: args };
  };
  /** Command arguments may be bare names (a list, a Y-var) as well as expressions. */
  Parser.prototype.exprOrName = function () {
    const k = this.peek();
    if (k && k.k === 'yname' && !this.is('(', 1)) { this.i++; return { k: 'yref', v: k.v }; }
    return this.expr();
  };
  Parser.prototype.args = function (closer) {
    const out = [];
    if (this.eat(closer)) return out;
    out.push(this.expr());
    while (this.eat(',')) out.push(this.expr());
    this.close(closer);
    return out;
  };

  Parser.prototype.expr = function () { return this.orExpr(); };
  Parser.prototype.orExpr = function () {
    let a = this.andExpr();
    for (;;) {
      if (this.eat('or')) a = { k: 'bin', op: 'or', a: a, b: this.andExpr() };
      else if (this.eat('xor')) a = { k: 'bin', op: 'xor', a: a, b: this.andExpr() };
      else return a;
    }
  };
  Parser.prototype.andExpr = function () {
    let a = this.relExpr();
    while (this.eat('and')) a = { k: 'bin', op: 'and', a: a, b: this.relExpr() };
    return a;
  };
  Parser.prototype.relExpr = function () {
    let a = this.addExpr();
    for (;;) {
      const op = ['=', '≠', '≥', '≤', '>', '<'].find((o) => this.is(o));
      if (!op) return a;
      this.i++;
      a = { k: 'bin', op: op, a: a, b: this.addExpr() };
    }
  };
  Parser.prototype.addExpr = function () {
    let a = this.mulExpr();
    for (;;) {
      if (this.eat('+')) a = { k: 'bin', op: '+', a: a, b: this.mulExpr() };
      else if (this.eat('-') || this.eat('−')) a = { k: 'bin', op: '-', a: a, b: this.mulExpr() };
      else return a;
    }
  };
  /** What can start a factor that is multiplied on without a sign: 2A, 3(4), 2sin(…), 2⁻3. */
  Parser.prototype.startsFactor = function () {
    const k = this.peek();
    if (!k) return false;
    if (k.k === 'num' || k.k === 'var' || k.k === 'const' || k.k === 'imag' || k.k === 'sys' || k.k === 'lname'
      || k.k === 'mname' || k.k === 'yname' || k.k === 'str') return true;
    if (k.k === 'op') return k.v === '(' || k.v === '{' || k.v === '[' || k.v === '⁻';
    if (k.k === 'word') return k.v in FN_ARITY || k.v === 'Ans' || k.v === 'π' || NULLARY.indexOf(k.v) >= 0;
    return false;
  };
  Parser.prototype.mulExpr = function () {
    let a = this.permExpr();
    for (;;) {
      if (this.eat('*') || this.eat('×')) a = { k: 'bin', op: '*', a: a, b: this.permExpr() };
      else if (this.eat('/') || this.eat('÷')) a = { k: 'bin', op: '/', a: a, b: this.permExpr() };
      else if (this.startsFactor()) a = { k: 'bin', op: '*', a: a, b: this.permExpr(), implicit: true };
      else return a;
    }
  };
  Parser.prototype.permExpr = function () {
    let a = this.negExpr();
    for (;;) {
      if (this.eat('nPr')) a = { k: 'bin', op: 'nPr', a: a, b: this.negExpr() };
      else if (this.eat('nCr')) a = { k: 'bin', op: 'nCr', a: a, b: this.negExpr() };
      else return a;
    }
  };
  /** Negation sits below powers: ⁻2² is −4. A leading − with nothing before it is read as negation too. */
  Parser.prototype.negExpr = function () {
    if (this.eat('⁻') || this.eat('-') || this.eat('−')) return { k: 'neg', a: this.negExpr() };
    return this.powExpr();
  };
  /** Powers go left to right, as on the calculator: 2^3^2 is 64. */
  Parser.prototype.powExpr = function () {
    let a = this.postfix();
    for (;;) {
      if (this.eat('^')) a = { k: 'bin', op: '^', a: a, b: this.powOperand() };
      else if (this.eat('ˣ√')) a = { k: 'bin', op: 'root', a: a, b: this.powOperand() };
      else return a;
    }
  };
  Parser.prototype.powOperand = function () {
    if (this.eat('⁻') || this.eat('-') || this.eat('−')) return { k: 'neg', a: this.powOperand() };
    return this.postfix();
  };
  Parser.prototype.postfix = function () {
    let a = this.primary();
    for (;;) {
      const k = this.peek();
      if (k && k.k === 'word' && POSTFIX.indexOf(k.v) >= 0) {
        this.i++;
        if (k.v === '°' || k.v === '′') a = this.dms(a, k.v);
        else a = { k: 'post', op: k.v, a: a };
      } else if (k && k.k === 'op' && (k.v === '!' || k.v === "'")) {
        this.i++;
        a = k.v === '!' ? { k: 'post', op: '!', a: a } : this.dms(a, '′');
      } else return a;
    }
  };
  /** 30°15′20″ — degrees, minutes and seconds written without a + between them. */
  Parser.prototype.dms = function (a, first) {
    const parts = [{ v: a, mark: first }];
    const more = (mark) => {
      const k = this.peek();
      if (k && k.k === 'num' && this.peek(1) && ((this.peek(1).v === mark) || (mark === '′' && this.peek(1).v === "'"))) {
        this.i += 2;
        parts.push({ v: { k: 'num', v: k.v }, mark: mark });
        return true;
      }
      return false;
    };
    if (first === '°') { more('′'); more('″'); } else if (first === '′') more('″');
    return { k: 'dms', parts: parts };
  };
  Parser.prototype.primary = function () {
    const k = this.next();
    if (!k) fail('SYNTAX');
    switch (k.k) {
      case 'num': return { k: 'num', v: k.v };
      case 'var': return { k: 'var', v: k.v };
      case 'const': return { k: 'const', v: k.v };
      case 'imag': return { k: 'imag' };
      case 'str': return { k: 'str', v: k.v };
      case 'sys': return { k: 'sys', v: k.v };
      case 'lname': case 'mname': {
        if (this.eat('(')) return { k: 'index', of: k, args: this.args(')') };
        return { k: k.k, v: k.v };
      }
      case 'yname': {
        if (this.eat('(')) return { k: 'ycall', v: k.v, args: this.args(')') };
        return { k: 'yval', v: k.v };
      }
      case 'seqname': {
        if (!this.eat('(')) fail('SYNTAX');
        const args = this.args(')');
        if (args.length !== 1) fail('ARGUMENT');
        return { k: 'seqcall', v: k.v, args: args };
      }
      case 'op': {
        if (k.v === '(') { const e = this.expr(); this.close(')'); return e; }
        if (k.v === '{') return { k: 'list', items: this.args('}') };
        if (k.v === '[') return this.matrixLiteral();
        fail('SYNTAX');
        break;
      }
      case 'word': {
        if (k.v === 'Ans') return { k: 'ans' };
        if (k.v === 'π') return { k: 'const', v: 'π' };
        if (NULLARY.indexOf(k.v) >= 0) return { k: 'call', name: k.v, args: [] };
        if (k.v in FN_ARITY) {
          const args = this.args(')');
          const ar = FN_ARITY[k.v];
          if (args.length < ar[0] || args.length > ar[1]) fail('ARGUMENT');
          return { k: 'call', name: k.v, args: args };
        }
        fail('SYNTAX');
        break;
      }
      default: fail('SYNTAX');
    }
    return null;
  };
  /** [[1,2][3,4]] — rows in their own brackets. */
  Parser.prototype.matrixLiteral = function () {
    const rows = [];
    while (this.eat('[')) {
      rows.push(this.args(']'));
      if (this.atEnd()) break;
    }
    this.close(']');
    if (!rows.length) fail('SYNTAX');
    const w = rows[0].length;
    if (!w || rows.some((r) => r.length !== w)) fail('INVALID DIM');
    return { k: 'mat', rows: rows };
  };

  /** Parse a full line into statements (separated by :). */
  function parseLine(src) {
    const toks = tokenize(src);
    const p = new Parser(toks);
    const out = [];
    while (p.peek()) {
      if (p.eat(':')) continue;
      out.push(p.statement());
    }
    return out;
  }
  function parseExpr(src) {
    const p = new Parser(tokenize(src));
    if (!p.peek()) fail('SYNTAX');
    const e = p.expr();
    if (p.peek()) fail('SYNTAX');
    return e;
  }

  /* ── Evaluation ──────────────────────────────────────────────────────── */

  /** Evaluation context: the state, variables bound by seq(/Σ(/nDeriv(, and whether i was used. */
  function Ctx(state, hooks) {
    this.st = state;
    this.hooks = hooks || {};
    this.locals = {};
    this.sawComplex = false;
    this.depth = 0;
  }
  Ctx.prototype.mode = function () { return this.st.mode; };
  /** In REAL mode a complex answer from real input is refused, as the calculator does. */
  Ctx.prototype.allowComplex = function () {
    if (this.st.mode.complex === 'real' && !this.sawComplex) fail('NONREAL ANSWERS');
  };
  Ctx.prototype.toRad = function (x) { return this.st.mode.angle === 'deg' ? x * Math.PI / 180 : x; };
  Ctx.prototype.fromRad = function (x) { return this.st.mode.angle === 'deg' ? x * 180 / Math.PI : x; };
  Ctx.prototype.getVar = function (name) {
    if (Object.prototype.hasOwnProperty.call(this.locals, name)) return this.locals[name];
    const v = this.st.vars[name];
    if (v == null) return 0;
    if (isCx(v)) this.sawComplex = true;
    return v;
  };

  function ev(n, cx) {
    switch (n.k) {
      case 'num': return n.v;
      case 'const': return n.v === 'π' ? Math.PI : Math.E;
      case 'imag': cx.sawComplex = true; return { t: 'cx', re: 0, im: 1 };
      case 'var': return cx.getVar(n.v);
      case 'ans': {
        const a = cx.st.ans;
        if (isCx(a)) cx.sawComplex = true;
        return a == null ? 0 : a;
      }
      case 'str': return str(n.v);
      case 'sys': return getSys(n.v, cx);
      case 'lname': {
        const l = cx.st.lists[n.v];
        if (!l) fail('UNDEFINED');
        if (l.some(isCx)) cx.sawComplex = true;
        return list(l.slice());
      }
      case 'mname': {
        const m = cx.st.mats[n.v];
        if (!m) fail('UNDEFINED');
        return mat(m.map((r) => r.slice()));
      }
      case 'list': return list(n.items.map((it) => {
        const v = ev(it, cx);
        if (!isScalar(v)) fail('DATA TYPE');
        return v;
      }));
      case 'mat': return mat(n.rows.map((r) => r.map((it) => {
        const v = ev(it, cx);
        if (!isNum(v)) fail('DATA TYPE');
        return v;
      })));
      case 'index': return evIndex(n, cx);
      case 'yval': return evalY(n.v, cx.getVar('X'), cx);
      case 'ycall': {
        const a = ev(n.args[0], cx);
        if (isList(a)) return list(a.v.map((x) => scalarOf(evalY(n.v, x, cx))));
        return evalY(n.v, a, cx);
      }
      case 'seqcall': {
        const a = ev(n.args[0], cx);
        if (isList(a)) return list(a.v.map((x) => scalarOf(evalSequence(n.v, x, cx))));
        return evalSequence(n.v, a, cx);
      }
      case 'neg': return neg(ev(n.a, cx));
      case 'bin': return evBin(n, cx);
      case 'post': return evPost(n.op, ev(n.a, cx), cx);
      case 'dms': {
        let total = 0;
        n.parts.forEach((p) => {
          const v = ev(p.v, cx);
          if (!isNum(v)) fail('DATA TYPE');
          total += p.mark === '°' ? v : p.mark === '′' ? v / 60 : v / 3600;
        });
        return R(cx.st.mode.angle === 'deg' ? total : total * Math.PI / 180);
      }
      case 'call': return call(n, cx);
      case 'conv': return ev(n.a, cx);
      case 'store': {
        const v = ev(n.a, cx);
        store(n.target, v, cx);
        return v;
      }
      default: fail('SYNTAX');
    }
    return 0;
  }
  function scalarOf(v) { if (!isScalar(v)) fail('DATA TYPE'); return v; }

  /** Y₁ at a given x: the stored text is parsed and evaluated with X bound. */
  function evalY(name, x, cx) {
    if (/^[uvw]\(n\)$/.test(name)) return evalSequence(name[0], x, cx);
    const src = cx.st.y[name];
    if (src == null || !String(src).trim()) fail('INVALID');
    if (cx.depth > 12) fail('MEMORY');
    const saved = cx.locals.X, had = Object.prototype.hasOwnProperty.call(cx.locals, 'X');
    const savedT = cx.locals.T, hadT = Object.prototype.hasOwnProperty.call(cx.locals, 'T');
    cx.locals.X = x;
    if (/[ᴛ]/.test(name)) cx.locals.T = x;
    cx.depth++;
    try {
      return ev(cachedExpr(src), cx);
    } finally {
      cx.depth--;
      if (had) cx.locals.X = saved; else delete cx.locals.X;
      if (hadT) cx.locals.T = savedT; else delete cx.locals.T;
    }
  }
  function evalSequence(name, index, cx) {
    if (!isNum(index) || index !== Math.floor(index) || Math.abs(index) > 10000) return NaN;
    const cfg = (cx.st.sequences && cx.st.sequences[name]) || { initial: [0] };
    const nMin = Number.isInteger(cfg.nMin) ? cfg.nMin : (Number.isInteger(cx.st.win.nMin) ? cx.st.win.nMin : 0);
    const initial = Array.isArray(cfg.initial) && cfg.initial.length ? cfg.initial : [0];
    const offset = index - nMin;
    if (offset < 0) return NaN;
    if (offset < initial.length) return initial[offset];
    const src = cx.st.y[name + '(n)'];
    if (src == null || !String(src).trim()) return NaN;
    if (!cx.seqMemo) cx.seqMemo = Object.create(null);
    const key = name + ':' + index;
    if (Object.prototype.hasOwnProperty.call(cx.seqMemo, key)) return cx.seqMemo[key];
    if (cx.depth > 1000) fail('MEMORY');
    const had = Object.prototype.hasOwnProperty.call(cx.locals, 'n'), old = cx.locals.n;
    cx.locals.n = index;
    cx.depth++;
    try {
      const value = ev(cachedExpr(src), cx);
      if (!isNum(value)) return NaN;
      cx.seqMemo[key] = value;
      return value;
    } finally {
      cx.depth--;
      if (had) cx.locals.n = old; else delete cx.locals.n;
    }
  }
  const EXPR_CACHE = new Map();
  function cachedExpr(src) {
    let e = EXPR_CACHE.get(src);
    if (!e) {
      e = parseExpr(src);
      if (EXPR_CACHE.size > 500) EXPR_CACHE.clear();
      EXPR_CACHE.set(src, e);
    }
    return e;
  }

  function evIndex(n, cx) {
    const args = n.args.map((a) => ev(a, cx));
    if (n.of.k === 'lname') {
      const l = cx.st.lists[n.of.v];
      if (!l) fail('UNDEFINED');
      // L₁(2) is an element; L₁({1,3}) picks several.
      const pick = (i) => {
        if (!isNum(i) || i !== Math.floor(i) || i < 1 || i > l.length) fail('INVALID DIM');
        return l[i - 1];
      };
      if (args.length !== 1) fail('ARGUMENT');
      if (isList(args[0])) return list(args[0].v.map(pick));
      return pick(args[0]);
    }
    const m = cx.st.mats[n.of.v];
    if (!m) fail('UNDEFINED');
    if (args.length !== 2) fail('ARGUMENT');
    const [r, c] = args;
    if (!isNum(r) || !isNum(c) || r < 1 || c < 1 || r > m.length || c > m[0].length || r !== Math.floor(r) || c !== Math.floor(c)) fail('INVALID DIM');
    return m[r - 1][c - 1];
  }

  /* ── Storing ─────────────────────────────────────────────────────────── */

  function store(t, v, cx) {
    const st = cx.st;
    switch (t.k) {
      case 'var':
        if (!isScalar(v)) fail('DATA TYPE');
        if (isCx(v) && st.mode.complex === 'real' && !cx.sawComplex) fail('NONREAL ANSWERS');
        st.vars[t.v] = v;
        return;
      case 'lname':
        if (isList(v)) { st.lists[t.v] = v.v.slice(); return; }
        if (isScalar(v)) fail('DATA TYPE');
        fail('DATA TYPE');
        return;
      case 'mname':
        if (!isMat(v)) fail('DATA TYPE');
        st.mats[t.v] = v.v.map((r) => r.slice());
        return;
      case 'yname':
        if (!isStr(v)) fail('DATA TYPE');
        st.y[t.v] = v.v;
        return;
      case 'seqtarget': {
        if (!isNum(v)) fail('DATA TYPE');
        const index = ev(t.n, cx);
        if (!isNum(index) || !Number.isInteger(index) || Math.abs(index) > 10000) fail('INVALID DIM');
        if (!st.sequences) st.sequences = {};
        const cfg = st.sequences[t.v] || (st.sequences[t.v] = { initial: [0] });
        if (!Number.isInteger(cfg.nMin)) cfg.nMin = Number.isInteger(st.win.nMin) ? st.win.nMin : 0;
        if (!Array.isArray(cfg.initial) || !cfg.initial.length) cfg.initial = [0];
        const offset = index - cfg.nMin;
        if (offset < 0 || offset > 999) fail('INVALID DIM');
        while (cfg.initial.length <= offset) cfg.initial.push(0);
        cfg.initial[offset] = v;
        return;
      }
      case 'sys': setSys(t.v, v, cx); return;
      case 'seed': {
        if (!isNum(v)) fail('DATA TYPE');
        const n = Math.abs(Math.floor(v));
        st.seed = n === 0 ? [12345, 67890] : [(40014 * n) % 2147483563, n % 2147483399 || 1];
        return;
      }
      case 'elem': {
        const args = t.args.map((a) => ev(a, cx));
        if (t.of.k === 'lname') {
          if (!isScalar(v)) fail('DATA TYPE');
          const l = st.lists[t.of.v] || (st.lists[t.of.v] = []);
          const i = args[0];
          // One past the end grows the list, as on the calculator.
          if (!isNum(i) || i !== Math.floor(i) || i < 1 || i > l.length + 1) fail('INVALID DIM');
          l[i - 1] = v;
          return;
        }
        if (!isNum(v)) fail('DATA TYPE');
        const m = st.mats[t.of.v];
        if (!m) fail('UNDEFINED');
        const [r, c] = args;
        if (r < 1 || c < 1 || r > m.length || c > m[0].length) fail('INVALID DIM');
        m[r - 1][c - 1] = v;
        return;
      }
      case 'dim': {
        const of = t.of;
        if (of.k === 'lname') {
          if (!isNum(v) || v < 0 || v !== Math.floor(v) || v > 999) fail('INVALID DIM');
          const l = st.lists[of.v] || [];
          st.lists[of.v] = Array.from({ length: v }, (_, i) => (i < l.length ? l[i] : 0));
          return;
        }
        if (of.k === 'mname') {
          if (!isList(v) || v.v.length !== 2) fail('INVALID DIM');
          const [r, c] = v.v;
          if (r < 1 || c < 1 || r > 99 || c > 99) fail('INVALID DIM');
          const m = st.mats[of.v] || [];
          st.mats[of.v] = Array.from({ length: r }, (_, i) => Array.from({ length: c }, (_, j) => (m[i] && m[i][j] != null ? m[i][j] : 0)));
          return;
        }
        fail('SYNTAX');
        return;
      }
      default: fail('SYNTAX');
    }
  }

  /* ── System variables (VARS) ─────────────────────────────────────────── */

  const WIN_KEYS = ['Xmin', 'Xmax', 'Xscl', 'Ymin', 'Ymax', 'Yscl', 'Xres', 'XFact', 'YFact', 'TraceStep', 'Tmin', 'Tmax', 'Tstep', 'θmin', 'θmax', 'θstep', 'nMin', 'nMax', 'PlotStart', 'PlotStep'];
  const TVM_KEYS = { tvmN: 'N', 'I%': 'I', PV: 'PV', PMT: 'PMT', FV: 'FV', 'P/Y': 'PY', 'C/Y': 'CY' };
  function getSys(name, cx) {
    const st = cx.st;
    if (name === 'TraceStep') return st.win.TraceStep || 2 * (st.win.Xmax - st.win.Xmin) / (st.mode.model === 'evo' ? 319 : 264);
    if (name === 'nStep') return st.win.PlotStep;
    if (WIN_KEYS.indexOf(name) >= 0) return st.win[name];
    if (name === 'ΔX') return R((st.win.Xmax - st.win.Xmin) / (st.mode.model === 'evo' ? 319 : 264));
    if (name === 'ΔY') return R((st.win.Ymax - st.win.Ymin) / (st.mode.model === 'evo' ? 209 : 164));
    if (name === 'TblStart' || name === 'ΔTbl') return st.tbl[name];
    if (name in TVM_KEYS) return st.tvm[TVM_KEYS[name]];
    if (/^Str\d$/.test(name)) {
      const s = st.strs[name];
      if (s == null) fail('UNDEFINED');
      return str(s);
    }
    if (name === 'RegEQ') {
      if (!st.sys.RegEQ) fail('UNDEFINED');
      return str(st.sys.RegEQ);
    }
    const v = st.sys[name];
    if (v == null) fail('UNDEFINED');
    if (Array.isArray(v)) return list(v.slice());
    return v;
  }
  function setSys(name, v, cx) {
    const st = cx.st;
    if (/^Str\d$/.test(name)) { if (!isStr(v)) fail('DATA TYPE'); st.strs[name] = v.v; return; }
    if (!isNum(v)) fail('DATA TYPE');
    if (name === 'nStep') { st.win.PlotStep = v; return; }
    if (WIN_KEYS.indexOf(name) >= 0) { st.win[name] = v; return; }
    if (name === 'TblStart' || name === 'ΔTbl') { st.tbl[name] = v; return; }
    if (name in TVM_KEYS) { st.tvm[TVM_KEYS[name]] = v; return; }
    st.sys[name] = v;
  }

  /* ── Arithmetic ──────────────────────────────────────────────────────── */

  function neg(v) {
    if (isNum(v)) return R(-v);
    if (isCx(v)) return Cn(-v.re, -v.im);
    if (isList(v)) return list(v.v.map(neg));
    if (isMat(v)) return mat(v.v.map((r) => r.map((x) => R(-x))));
    fail('DATA TYPE');
    return 0;
  }
  /** Apply f elementwise across lists; scalars stretch to meet them. */
  function map2(a, b, f) {
    if (isList(a) && isList(b)) {
      if (a.v.length !== b.v.length) fail('DIM MISMATCH');
      return list(a.v.map((x, i) => f(x, b.v[i])));
    }
    if (isList(a)) { scalarOf(b); return list(a.v.map((x) => f(x, b))); }
    if (isList(b)) { scalarOf(a); return list(b.v.map((y) => f(a, y))); }
    return f(a, b);
  }
  function map1(v, f) {
    if (isList(v)) return list(v.v.map(f));
    if (isMat(v) || isStr(v)) fail('DATA TYPE');
    return f(v);
  }
  function real(v) { if (!isNum(v)) fail('DATA TYPE'); return v; }

  function add(a, b) {
    if (isStr(a) && isStr(b)) return str(a.v + b.v);
    if (isStr(a) || isStr(b)) fail('DATA TYPE');
    if (isMat(a) || isMat(b)) {
      if (!(isMat(a) && isMat(b))) fail('DATA TYPE');
      return matZip(a, b, (x, y) => R(x + y));
    }
    return map2(a, b, (x, y) => (isNum(x) && isNum(y) ? R(x + y) : cAdd(x, y)));
  }
  function sub(a, b) {
    if (isMat(a) || isMat(b)) {
      if (!(isMat(a) && isMat(b))) fail('DATA TYPE');
      return matZip(a, b, (x, y) => R(x - y));
    }
    if (isStr(a) || isStr(b)) fail('DATA TYPE');
    return map2(a, b, (x, y) => (isNum(x) && isNum(y) ? R(x - y) : cSub(x, y)));
  }
  function mul(a, b) {
    if (isStr(a) || isStr(b)) fail('DATA TYPE');
    if (isMat(a) && isMat(b)) return matMul(a.v, b.v);
    if (isMat(a) || isMat(b)) {
      const m = isMat(a) ? a : b, s = isMat(a) ? b : a;
      if (!isNum(s)) fail('DATA TYPE');
      return mat(m.v.map((r) => r.map((x) => R(x * s))));
    }
    return map2(a, b, (x, y) => (isNum(x) && isNum(y) ? R(x * y) : cMul(x, y)));
  }
  function div(a, b) {
    if (isStr(a) || isStr(b)) fail('DATA TYPE');
    if (isMat(b)) fail('DATA TYPE');
    if (isMat(a)) {
      if (!isNum(b)) fail('DATA TYPE');
      if (b === 0) fail('DIVIDE BY 0');
      return mat(a.v.map((r) => r.map((x) => R(x / b))));
    }
    return map2(a, b, (x, y) => {
      if (isNum(x) && isNum(y)) { if (y === 0) fail('DIVIDE BY 0'); return R(x / y); }
      return cDiv(x, y);
    });
  }

  /** x^y the calculator's way: (−8)^(1/3) is −2 in REAL mode, 0^0 is a domain error. */
  function powS(x, y, cx) {
    if (isNum(x) && isNum(y)) {
      if (x === 0) {
        if (y === 0) fail('DOMAIN');
        if (y < 0) fail('DIVIDE BY 0');
        return 0;
      }
      if (x > 0 || y === Math.floor(y)) return R(Math.pow(x, y));
      // A negative base: real when the exponent is a fraction with an odd denominator.
      const f = toFraction(y, 999);
      if (f && f.q % 2 === 1) {
        const mag = Math.pow(-x, y);
        return R(f.p % 2 === 0 ? mag : -mag);
      }
      cx.allowComplex();
      return cPowC(x, y);
    }
    return cPowC(x, y);
  }
  function cPowC(x, y) {
    if (reOf(x) === 0 && imOf(x) === 0) {
      if (reOf(y) > 0) return 0;
      fail('DOMAIN');
    }
    if (isNum(y) && y === Math.floor(y) && Math.abs(y) <= 1024) return cPowInt(x, y);
    return cExp(cMul(y, cLn(x)));
  }
  function pow(a, b, cx) {
    if (isMat(a)) {
      if (!isNum(b) || b !== Math.floor(b)) fail('DATA TYPE');
      return matPow(a.v, b);
    }
    if (isStr(a) || isStr(b) || isMat(b)) fail('DATA TYPE');
    return map2(a, b, (x, y) => powS(x, y, cx));
  }
  function nthRoot(n, x, cx) {
    return map2(n, x, (k, v) => {
      if (isNum(k) && isNum(v)) {
        if (k === 0) fail('DOMAIN');
        if (v < 0) {
          if (k === Math.floor(k) && Math.abs(k) % 2 === 1) return R(-Math.pow(-v, 1 / k));
          cx.allowComplex();
          return cPowC(v, 1 / k);
        }
        return R(Math.pow(v, 1 / k));
      }
      return cPowC(v, cDiv(1, k));
    });
  }

  function cmp(op, a, b) {
    if (isStr(a) || isStr(b)) {
      if (!(isStr(a) && isStr(b)) || (op !== '=' && op !== '≠')) fail('DATA TYPE');
      return (a.v === b.v) === (op === '=') ? 1 : 0;
    }
    if (isMat(a) || isMat(b)) {
      if (!(isMat(a) && isMat(b)) || (op !== '=' && op !== '≠')) fail('DATA TYPE');
      const same = a.v.length === b.v.length && a.v[0].length === b.v[0].length && a.v.every((r, i) => r.every((x, j) => x === b.v[i][j]));
      return same === (op === '=') ? 1 : 0;
    }
    return map2(a, b, (x, y) => {
      if (op === '=' || op === '≠') {
        const eq = reOf(x) === reOf(y) && imOf(x) === imOf(y);
        return eq === (op === '=') ? 1 : 0;
      }
      if (!isNum(x) || !isNum(y)) fail('DATA TYPE');
      switch (op) {
        case '>': return x > y ? 1 : 0;
        case '<': return x < y ? 1 : 0;
        case '≥': return x >= y ? 1 : 0;
        default: return x <= y ? 1 : 0;
      }
    });
  }

  function evBin(n, cx) {
    const a = ev(n.a, cx), b = ev(n.b, cx);
    switch (n.op) {
      case '+': return add(a, b);
      case '-': return sub(a, b);
      case '*': return mul(a, b);
      case '/': return div(a, b);
      case '^': return pow(a, b, cx);
      case 'root': return nthRoot(a, b, cx);
      case 'nPr': case 'nCr': return map2(a, b, (x, y) => permComb(n.op, real(x), real(y)));
      case 'and': return map2(a, b, (x, y) => (real(x) !== 0 && real(y) !== 0 ? 1 : 0));
      case 'or': return map2(a, b, (x, y) => (real(x) !== 0 || real(y) !== 0 ? 1 : 0));
      case 'xor': return map2(a, b, (x, y) => ((real(x) !== 0) !== (real(y) !== 0) ? 1 : 0));
      default: return cmp(n.op, a, b);
    }
  }

  function permComb(op, n, r) {
    if (n !== Math.floor(n) || r !== Math.floor(r) || n < 0 || r < 0) fail('DOMAIN');
    if (r > n) return 0;
    let out = 1;
    if (op === 'nPr') { for (let k = 0; k < r; k++) out *= (n - k); return R(out); }
    const k = Math.min(r, n - r);
    for (let j = 1; j <= k; j++) out = out * (n - k + j) / j;
    return R(Math.round(out));
  }
  function factorial(x) {
    if (!isNum(x)) fail('DATA TYPE');
    if (x === Math.floor(x)) {
      if (x < 0 || x > 69) fail(x < 0 ? 'DOMAIN' : 'OVERFLOW');
      let f = 1;
      for (let k = 2; k <= x; k++) f *= k;
      return R(f);
    }
    // Half-integers only, as on the calculator: 0.5! = √π/2.
    if (2 * x === Math.floor(2 * x) && x >= -0.5) return R(S().gamma(x + 1));
    fail('DOMAIN');
    return 0;
  }

  function evPost(op, v, cx) {
    switch (op) {
      case '²': return isMat(v) ? matPow(v.v, 2) : pow(v, 2, cx);
      case '³': return isMat(v) ? matPow(v.v, 3) : pow(v, 3, cx);
      case '⁻¹': {
        if (isMat(v)) return matInv(v.v);
        return map1(v, (x) => (isNum(x) ? (x === 0 ? fail('DIVIDE BY 0') : R(1 / x)) : cDiv(1, x)));
      }
      case 'ᵀ': if (!isMat(v)) fail('DATA TYPE'); return mat(v.v[0].map((_, j) => v.v.map((r) => r[j])));
      case '!': return map1(v, factorial);
      case 'ʳ': return map1(v, (x) => R(cx.st.mode.angle === 'deg' ? real(x) * 180 / Math.PI : real(x)));
      case '″': return map1(v, (x) => R(cx.toRad(real(x) / 3600)));
      default: fail('SYNTAX');
    }
    return 0;
  }

  /* ── Matrices ────────────────────────────────────────────────────────── */

  function matZip(a, b, f) {
    if (a.v.length !== b.v.length || a.v[0].length !== b.v[0].length) fail('DIM MISMATCH');
    return mat(a.v.map((r, i) => r.map((x, j) => f(x, b.v[i][j]))));
  }
  function matMul(A, B) {
    if (A[0].length !== B.length) fail('DIM MISMATCH');
    return mat(A.map((row) => B[0].map((_, j) => R(row.reduce((s, x, k) => s + x * B[k][j], 0)))));
  }
  function identityM(n) { return Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))); }
  function matPow(A, n) {
    if (A.length !== A[0].length) fail('INVALID DIM');
    if (n < 0) return matPow(matInv(A).v, -n);
    let out = identityM(A.length), base = A;
    let k = n;
    while (k > 0) {
      if (k & 1) out = matMul(out, base).v;
      base = matMul(base, base).v;
      k = Math.floor(k / 2);
    }
    return mat(out);
  }
  function matInv(A) {
    const n = A.length;
    if (n !== A[0].length) fail('INVALID DIM');
    const M = A.map((r, i) => r.concat(identityM(n)[i]));
    for (let c = 0; c < n; c++) {
      let p = c;
      for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
      if (Math.abs(M[p][c]) < 1e-13) fail('SINGULAR MAT');
      [M[c], M[p]] = [M[p], M[c]];
      const d = M[c][c];
      for (let k = 0; k < 2 * n; k++) M[c][k] /= d;
      for (let r = 0; r < n; r++) {
        if (r === c) continue;
        const f = M[r][c];
        for (let k = 0; k < 2 * n; k++) M[r][k] -= f * M[c][k];
      }
    }
    return mat(M.map((r) => r.slice(n).map(R)));
  }
  function det(A) {
    const n = A.length;
    if (n !== A[0].length) fail('INVALID DIM');
    const M = A.map((r) => r.slice());
    let d = 1;
    for (let c = 0; c < n; c++) {
      let p = c;
      for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
      if (M[p][c] === 0) return 0;
      if (p !== c) { [M[c], M[p]] = [M[p], M[c]]; d = -d; }
      d *= M[c][c];
      for (let r = c + 1; r < n; r++) {
        const f = M[r][c] / M[c][c];
        for (let k = c; k < n; k++) M[r][k] -= f * M[c][k];
      }
    }
    return R(d);
  }
  function needMat(v) { if (!isMat(v)) fail('DATA TYPE'); return v.v; }
  function needList(v) { if (!isList(v)) fail('DATA TYPE'); return v.v; }
  function needInt(v, lo) { if (!isNum(v) || v !== Math.floor(v) || (lo != null && v < lo)) fail('DOMAIN'); return v; }
  function realList(v) { const l = needList(v); l.forEach((x) => { if (!isNum(x)) fail('DATA TYPE'); }); return l; }

  /* ── Random numbers: the calculator's own generator ─────────────────────
     L'Ecuyer's combined generator with the calculator's constants, so after
     0→rand the sequence is the handheld's: .9435974025, .908318861, … */
  function rand(cx) {
    const s = cx.st.seed;
    s[0] = (s[0] * 40014) % 2147483563;
    s[1] = (s[1] * 40692) % 2147483399;
    let r = (s[0] - s[1]) / 2147483563;
    if (r < 0) r += 1;
    return r;
  }
  function randCount(n, f) {
    if (n == null) return f();
    needInt(n, 1);
    if (n > 999) fail('INVALID DIM');
    const out = [];
    for (let k = 0; k < n; k++) out.push(f());
    return list(out);
  }

  /* ── Numeric calculus ─────────────────────────────────────────────────── */

  /** Evaluate an expression node with a variable bound, as seq( and friends do. */
  function withVar(cx, name, value, node) {
    const had = Object.prototype.hasOwnProperty.call(cx.locals, name), old = cx.locals[name];
    cx.locals[name] = value;
    try { return ev(node, cx); } finally { if (had) cx.locals[name] = old; else delete cx.locals[name]; }
  }
  function varName(node) {
    if (!node || node.k !== 'var') fail('SYNTAX');
    return node.v;
  }
  /** Adaptive Gauss–Kronrod (7–15) — the calculator's fnInt( tolerance is 1ᴇ-5; this does better. */
  const GK_X = [0.991455371120812639, 0.949107912342758525, 0.864864423359769073, 0.741531185599394440,
    0.586087235467691130, 0.405845151377397167, 0.207784955007898468, 0];
  const GK_WK = [0.022935322010529225, 0.063092092629978553, 0.104790010322250184, 0.140653259715525919,
    0.169004726639267903, 0.190350578064785410, 0.204432940075298892, 0.209482141084727828];
  const GK_WG = [0, 0.129484966168869693, 0, 0.279705391489276668, 0, 0.381830050505118945, 0, 0.417959183673469388];
  function gk(f, a, b) {
    const c = (a + b) / 2, h = (b - a) / 2;
    let k = 0, g = 0;
    for (let i = 0; i < 8; i++) {
      if (GK_X[i] === 0) { const v = f(c); k += GK_WK[i] * v; g += GK_WG[i] * v; continue; }
      const v1 = f(c - h * GK_X[i]), v2 = f(c + h * GK_X[i]);
      k += GK_WK[i] * (v1 + v2); g += GK_WG[i] * (v1 + v2);
    }
    return { v: k * h, err: Math.abs((k - g) * h) };
  }
  function integrate(f, a, b, tol) {
    if (a === b) return 0;
    const t = tol || 1e-12;
    let total = 0;
    const stack = [[a, b, 0]];
    let evals = 0;
    while (stack.length) {
      const [x0, x1, depth] = stack.pop();
      const r = gk(f, x0, x1);
      evals += 15;
      if (!Number.isFinite(r.v)) fail('DOMAIN');
      if (r.err <= Math.max(t * Math.abs(r.v), 1e-14 * (x1 - x0) / (b - a) + 1e-300) || depth > 40 || evals > 200000) {
        if (depth > 40 && r.err > 1e-5 * Math.max(1, Math.abs(r.v))) fail('TOL NOT MET');
        total += r.v;
      } else {
        const m = (x0 + x1) / 2;
        stack.push([x0, m, depth + 1], [m, x1, depth + 1]);
      }
    }
    return total;
  }
  function numFn(cx, node, name) {
    return (x) => {
      const v = withVar(cx, name, x, node);
      if (!isNum(v)) fail('DATA TYPE');
      return v;
    };
  }
  /** Golden-section search for a minimum of f on [lo, hi]. */
  function goldenMin(f, lo, hi) {
    const g = (Math.sqrt(5) - 1) / 2;
    // A coarse scan first, so a wiggly function's global minimum on the interval is found.
    let bestX = lo, bestF = f(lo);
    const N = 200;
    for (let k = 1; k <= N; k++) {
      const x = lo + (hi - lo) * k / N, v = f(x);
      if (v < bestF) { bestF = v; bestX = x; }
    }
    let a = Math.max(lo, bestX - (hi - lo) / N), b = Math.min(hi, bestX + (hi - lo) / N);
    let c = b - g * (b - a), d = a + g * (b - a);
    for (let k = 0; k < 200 && Math.abs(b - a) > 1e-13 * Math.max(1, Math.abs(c)); k++) {
      if (f(c) < f(d)) b = d; else a = c;
      c = b - g * (b - a); d = a + g * (b - a);
    }
    /* Near a minimum f is flat to within rounding, so comparisons stop
       resolving x at about √ε. A few Newton steps on f′ = 0 finish it,
       kept only while they stay inside the bracket and do not climb. */
    let x = (a + b) / 2;
    const lo0 = Math.max(lo, a - (hi - lo) / N), hi0 = Math.min(hi, b + (hi - lo) / N);
    for (let k = 0; k < 4; k++) {
      const h = 1e-4 * Math.max(1, Math.abs(x));
      const fp = f(x + h), fm = f(x - h), f0 = f(x);
      const d1 = (fp - fm) / (2 * h), d2 = (fp - 2 * f0 + fm) / (h * h);
      if (!(d2 > 0) || !Number.isFinite(d1)) break;
      const nx = x - d1 / d2;
      if (!(nx >= lo0 && nx <= hi0) || f(nx) > f0) break;
      if (Math.abs(nx - x) < 1e-15 * Math.max(1, Math.abs(x))) { x = nx; break; }
      x = nx;
    }
    return x;
  }
  /** solve(expr, var, guess[, {lower, upper}]): a root near the guess. */
  function solveRoot(f, guess, lo, hi) {
    // Newton/secant from the guess first.
    let x0 = guess, x1 = guess === 0 ? 1e-3 : guess * (1 + 1e-3);
    let f0, f1;
    try { f0 = f(x0); f1 = f(x1); } catch (e) { f0 = NaN; }
    for (let k = 0; k < 100 && Number.isFinite(f0) && Number.isFinite(f1); k++) {
      if (f1 === 0) return x1;
      if (f1 === f0) break;
      const x2 = x1 - f1 * (x1 - x0) / (f1 - f0);
      if (!Number.isFinite(x2) || x2 < lo || x2 > hi) break;
      x0 = x1; f0 = f1; x1 = x2;
      try { f1 = f(x1); } catch (e) { break; }
      if (Math.abs(x1 - x0) < 1e-13 * Math.max(1, Math.abs(x1)) && Math.abs(f1) < 1e-9 * Math.max(1, Math.abs(f0))) return x1;
    }
    // Then a widening search for a sign change around the guess.
    let span = Math.max(1, Math.abs(guess));
    for (let k = 0; k < 60; k++) {
      const a = Math.max(lo, guess - span), b = Math.min(hi, guess + span);
      const N = 64;
      let px = a, pf;
      try { pf = f(a); } catch (e) { pf = NaN; }
      for (let j = 1; j <= N; j++) {
        const x = a + (b - a) * j / N;
        let fx;
        try { fx = f(x); } catch (e) { fx = NaN; }
        if (Number.isFinite(pf) && Number.isFinite(fx)) {
          if (fx === 0) return x;
          if ((pf < 0) !== (fx < 0)) {
            let l = px, r = x, fl = pf;
            for (let it = 0; it < 200; it++) {
              const m = (l + r) / 2, fm = f(m);
              if (fm === 0 || r - l < 1e-14 * Math.max(1, Math.abs(m))) return m;
              if ((fl < 0) !== (fm < 0)) r = m; else { l = m; fl = fm; }
            }
            return (l + r) / 2;
          }
        }
        px = x; pf = fx;
      }
      if (a <= lo && b >= hi) break;
      span *= 2;
    }
    fail('NO SIGN CHANGE');
    return 0;
  }

  /* ── Functions ───────────────────────────────────────────────────────── */

  function trigIn(cx, x) {
    // Exact zeros and ones at the multiples of 90°/π⁄2, where floating point leaves dust.
    const r = cx.toRad(x);
    const q = r / (Math.PI / 2);
    if (Math.abs(q - Math.round(q)) < 1e-12) return { exactQuarter: ((Math.round(q) % 4) + 4) % 4, r: r };
    return { r: r };
  }
  const FN = {
    'sin(': (a, cx) => map1(a, (x) => { const t = trigIn(cx, real(x)); return t.exactQuarter != null ? [0, 1, 0, -1][t.exactQuarter] : R(Math.sin(t.r)); }),
    'cos(': (a, cx) => map1(a, (x) => { const t = trigIn(cx, real(x)); return t.exactQuarter != null ? [1, 0, -1, 0][t.exactQuarter] : R(Math.cos(t.r)); }),
    'tan(': (a, cx) => map1(a, (x) => {
      const t = trigIn(cx, real(x));
      if (t.exactQuarter != null) { if (t.exactQuarter % 2) fail('DOMAIN'); return 0; }
      return R(Math.tan(t.r));
    }),
    'sin⁻¹(': (a, cx) => map1(a, (x) => { if (Math.abs(real(x)) > 1) fail('DOMAIN'); return R(cx.fromRad(Math.asin(x))); }),
    'cos⁻¹(': (a, cx) => map1(a, (x) => { if (Math.abs(real(x)) > 1) fail('DOMAIN'); return R(cx.fromRad(Math.acos(x))); }),
    'tan⁻¹(': (a, cx) => map1(a, (x) => R(cx.fromRad(Math.atan(real(x))))),
    'sinh(': (a) => map1(a, (x) => R(Math.sinh(real(x)))),
    'cosh(': (a) => map1(a, (x) => R(Math.cosh(real(x)))),
    'tanh(': (a) => map1(a, (x) => R(Math.tanh(real(x)))),
    'sinh⁻¹(': (a) => map1(a, (x) => R(Math.asinh(real(x)))),
    'cosh⁻¹(': (a) => map1(a, (x) => { if (real(x) < 1) fail('DOMAIN'); return R(Math.acosh(x)); }),
    'tanh⁻¹(': (a) => map1(a, (x) => { if (Math.abs(real(x)) >= 1) fail('DOMAIN'); return R(Math.atanh(x)); }),
    'ln(': (a, cx) => map1(a, (x) => {
      if (isNum(x)) {
        if (x > 0) return R(Math.log(x));
        if (x === 0) fail('DOMAIN');
        cx.allowComplex();
      }
      return cLn(x);
    }),
    'log(': (a, cx) => map1(a, (x) => {
      if (isNum(x)) {
        if (x > 0) return R(Math.log10(x));
        if (x === 0) fail('DOMAIN');
        cx.allowComplex();
      }
      return cDiv(cLn(x), Math.LN10);
    }),
    'e^(': (a) => map1(a, (x) => (isNum(x) ? R(Math.exp(x)) : cExp(x))),
    '10^(': (a) => map1(a, (x) => (isNum(x) ? R(Math.pow(10, x)) : cExp(cMul(x, Math.LN10)))),
    '√(': (a, cx) => map1(a, (x) => {
      if (isNum(x)) { if (x >= 0) return R(Math.sqrt(x)); cx.allowComplex(); }
      return cSqrt(x);
    }),
    '∛(': (a, cx) => nthRoot(3, a, cx),
    'logBASE(': (a, b, cx) => map2(a, b, (x, y) => {
      if (isNum(x) && isNum(y) && x > 0 && y > 0) { if (y === 1) fail('DIVIDE BY 0'); return R(Math.log(x) / Math.log(y)); }
      if (isNum(x) && x === 0) fail('DOMAIN');
      cx.allowComplex();
      return cDiv(cLn(x), cLn(y));
    }),
    'abs(': (a) => (isMat(a) ? mat(a.v.map((r) => r.map(Math.abs))) : map1(a, (x) => R(cAbs(x)))),
    'round(': (a, d) => {
      const places = d == null ? 9 : needInt(d, 0);
      if (places > 9) fail('DOMAIN');
      const rd = (x) => { const f = Math.pow(10, places); return R(Math.round(Math.abs(x) * f) / f * Math.sign(x)); };
      if (isMat(a)) return mat(a.v.map((r) => r.map(rd)));
      return map1(a, (x) => (isNum(x) ? rd(x) : Cn(rd(x.re), rd(x.im))));
    },
    'iPart(': (a) => map1(a, (x) => (isNum(x) ? R(Math.trunc(x)) : Cn(Math.trunc(x.re), Math.trunc(x.im)))),
    'fPart(': (a) => map1(a, (x) => (isNum(x) ? R(x - Math.trunc(x)) : Cn(x.re - Math.trunc(x.re), x.im - Math.trunc(x.im)))),
    'int(': (a) => map1(a, (x) => (isNum(x) ? R(Math.floor(x)) : Cn(Math.floor(x.re), Math.floor(x.im)))),
    'min(': (a, b) => (b == null ? R(Math.min.apply(null, realList(a))) : map2(a, b, (x, y) => Math.min(real(x), real(y)))),
    'max(': (a, b) => (b == null ? R(Math.max.apply(null, realList(a))) : map2(a, b, (x, y) => Math.max(real(x), real(y)))),
    'lcm(': (a, b) => map2(a, b, (x, y) => { needInt(x, 0); needInt(y, 0); return x === 0 || y === 0 ? 0 : R(x / gcd(x, y) * y); }),
    'gcd(': (a, b) => map2(a, b, (x, y) => gcd(needInt(x, 0), needInt(y, 0))),
    'remainder(': (a, b) => map2(a, b, (x, y) => {
      needInt(x, 0); needInt(y, 0);
      if (y === 0) fail('DIVIDE BY 0');
      return x % y;
    }),
    'conj(': (a) => map1(a, (x) => (isNum(x) ? x : Cn(x.re, -x.im))),
    'real(': (a) => map1(a, (x) => reOf(x)),
    'imag(': (a) => map1(a, (x) => imOf(x)),
    'angle(': (a, cx) => map1(a, (x) => R(cx.fromRad(cArg(x)))),
    'rand': (cx) => rand(cx),
    'randInt(': (lo, hi, n, cx) => {
      const L = Math.min(needInt(lo), needInt(hi)), H = Math.max(lo, hi);
      return randCount(n, () => L + Math.floor(rand(cx) * (H - L + 1)));
    },
    'randNorm(': (mu, sigma, n, cx) => randCount(n, () => R(real(mu) + real(sigma) * S().invPhi(Math.min(1 - 1e-15, Math.max(1e-15, rand(cx)))))),
    'randBin(': (nn, p, n, cx) => {
      needInt(nn, 1); if (!(p >= 0 && p <= 1)) fail('DOMAIN');
      return randCount(n, () => { let c = 0; for (let k = 0; k < nn; k++) if (rand(cx) < p) c++; return c; });
    },
    'randIntNoRep(': (lo, hi, n, cx) => {
      const L = Math.min(needInt(lo), needInt(hi)), H = Math.max(lo, hi);
      const all = [];
      for (let v = L; v <= H; v++) all.push(v);
      if (all.length > 999) fail('INVALID DIM');
      for (let k = all.length - 1; k > 0; k--) { const j = Math.floor(rand(cx) * (k + 1)); [all[k], all[j]] = [all[j], all[k]]; }
      return list(n == null ? all : all.slice(0, Math.min(needInt(n, 1), all.length)));
    },
    'R▶Pr(': (x, y) => map2(x, y, (a, b) => R(Math.hypot(real(a), real(b)))),
    'R▶Pθ(': (x, y, cx) => map2(x, y, (a, b) => R(cx.fromRad(Math.atan2(real(b), real(a))))),
    'P▶Rx(': (r, t, cx) => map2(r, t, (a, b) => R(real(a) * Math.cos(cx.toRad(real(b))))),
    'P▶Ry(': (r, t, cx) => map2(r, t, (a, b) => R(real(a) * Math.sin(cx.toRad(real(b))))),
    'not(': (a) => map1(a, (x) => (real(x) === 0 ? 1 : 0)),
    'dim(': (a) => {
      if (isList(a)) return a.v.length;
      if (isMat(a)) return list([a.v.length, a.v[0].length]);
      if (isStr(a)) return a.v.length;
      fail('DATA TYPE');
      return 0;
    },
    'cumSum(': (a) => {
      if (isMat(a)) {
        const out = a.v.map((r) => r.slice());
        for (let i = 1; i < out.length; i++) for (let j = 0; j < out[0].length; j++) out[i][j] = R(out[i][j] + out[i - 1][j]);
        return mat(out);
      }
      let s = 0;
      return list(realList(a).map((x) => (s = R(s + x))));
    },
    'ΔList(': (a) => { const l = realList(a); if (l.length < 2) fail('INVALID DIM'); return list(l.slice(1).map((x, i) => R(x - l[i]))); },
    'augment(': (a, b) => {
      if (isList(a) && isList(b)) return list(a.v.concat(b.v));
      if (isMat(a) && isMat(b)) {
        if (a.v.length !== b.v.length) fail('DIM MISMATCH');
        return mat(a.v.map((r, i) => r.concat(b.v[i])));
      }
      fail('DATA TYPE');
      return 0;
    },
    'mean(': (a, f) => R(S().oneVar(realList(a), f == null ? null : realList(f)).mean),
    'median(': (a, f) => R(S().oneVar(realList(a), f == null ? null : realList(f)).med),
    'sum(': (a, s, e) => { const l = sliceList(realList(a), s, e); return R(l.reduce((p, x) => p + x, 0)); },
    'prod(': (a, s, e) => { const l = sliceList(realList(a), s, e); return R(l.reduce((p, x) => p * x, 1)); },
    'stdDev(': (a, f) => { const o = S().oneVar(realList(a), f == null ? null : realList(f)); if (!Number.isFinite(o.Sx)) fail('STAT'); return R(o.Sx); },
    'variance(': (a, f) => { const o = S().oneVar(realList(a), f == null ? null : realList(f)); if (!Number.isFinite(o.Sx)) fail('STAT'); return R(o.Sx * o.Sx); },
    'det(': (a) => det(needMat(a)),
    'identity(': (n) => { needInt(n, 1); if (n > 99) fail('INVALID DIM'); return mat(identityM(n)); },
    'randM(': (r, c, cx) => {
      needInt(r, 1); needInt(c, 1);
      return mat(Array.from({ length: r }, () => Array.from({ length: c }, () => Math.floor(rand(cx) * 19) - 9)));
    },
    'rref(': (a) => mat(S().rref(needMat(a)).map((r) => r.map(R))),
    'ref(': (a) => mat(S().ref(needMat(a)).map((r) => r.map(R))),
    'rowSwap(': (a, i, j) => {
      const M = needMat(a).map((r) => r.slice());
      rowCheck(M, i); rowCheck(M, j);
      [M[i - 1], M[j - 1]] = [M[j - 1], M[i - 1]];
      return mat(M);
    },
    'row+(': (a, i, j) => {
      const M = needMat(a).map((r) => r.slice());
      rowCheck(M, i); rowCheck(M, j);
      M[j - 1] = M[j - 1].map((x, k) => R(x + M[i - 1][k]));
      return mat(M);
    },
    '*row(': (v, a, i) => {
      const M = needMat(a).map((r) => r.slice());
      rowCheck(M, i);
      M[i - 1] = M[i - 1].map((x) => R(x * real(v)));
      return mat(M);
    },
    '*row+(': (v, a, i, j) => {
      const M = needMat(a).map((r) => r.slice());
      rowCheck(M, i); rowCheck(M, j);
      M[j - 1] = M[j - 1].map((x, k) => R(x + real(v) * M[i - 1][k]));
      return mat(M);
    },
    'List▶matr(': (...args) => {
      const lists = args.slice(0, -1).filter((a) => a !== undefined).map(realList);
      const n = Math.max.apply(null, lists.map((l) => l.length));
      return mat(Array.from({ length: n }, (_, i) => lists.map((l) => (i < l.length ? l[i] : 0))));
    },
    'normalpdf(': (x, mu, sg) => map1(x, (v) => R(S().normalpdf(real(v), opt(mu), opt(sg)))),
    'normalcdf(': (lo, hi, mu, sg) => map2(lo, hi, (a, b) => R(S().normalcdf(real(a), real(b), opt(mu), opt(sg)))),
    'invNorm(': (p, mu, sg, tail) => {
      const t = tail == null ? 'LEFT' : ['LEFT', 'CENTER', 'RIGHT'][needInt(tail, 0)] || 'LEFT';
      const r = S().invNorm(real(p), opt(mu), opt(sg), t);
      return Array.isArray(r) ? list(r.map(R)) : R(r);
    },
    'invT(': (p, df) => R(S().invT(real(p), real(df))),
    'tpdf(': (x, df) => map1(x, (v) => R(S().tpdf(real(v), real(df)))),
    'tcdf(': (lo, hi, df) => R(S().tcdf(real(lo), real(hi), real(df))),
    'χ²pdf(': (x, df) => map1(x, (v) => R(S().chi2pdf(real(v), real(df)))),
    'χ²cdf(': (lo, hi, df) => R(S().chi2cdf(real(lo), real(hi), real(df))),
    'Fpdf(': (x, a, b) => map1(x, (v) => R(S().Fpdf(real(v), real(a), real(b)))),
    'Fcdf(': (lo, hi, a, b) => R(S().Fcdf(real(lo), real(hi), real(a), real(b))),
    'binompdf(': (n, p, x) => distList(x, (k) => S().binompdf(real(n), real(p), k), () => S().binompdf(real(n), real(p))),
    'binomcdf(': (n, p, x) => distList(x, (k) => S().binomcdf(real(n), real(p), k), () => S().binomcdf(real(n), real(p))),
    'invBinom(': (a, n, p) => S().invBinom(real(a), real(n), real(p)),
    'poissonpdf(': (mu, x) => map1(x, (k) => R(S().poissonpdf(real(mu), real(k)))),
    'poissoncdf(': (mu, x) => map1(x, (k) => R(S().poissoncdf(real(mu), real(k)))),
    'geometpdf(': (p, x) => map1(x, (k) => R(S().geometpdf(real(p), real(k)))),
    'geometcdf(': (p, x) => map1(x, (k) => R(S().geometcdf(real(p), real(k)))),
    'npv(': (rate, cf0, cfl, freq) => R(S().npv(real(rate), real(cf0), realList(cfl), freq == null ? null : realList(freq))),
    'irr(': (cf0, cfl, freq) => R(S().irr(real(cf0), realList(cfl), freq == null ? null : realList(freq))),
    'bal(': (n, rd, cx) => R(S().bal(cx.st.tvm, needInt(n, 0), rd == null ? null : needInt(rd, 0))),
    'ΣPrn(': (a, b, rd, cx) => R(S().sumPrn(cx.st.tvm, needInt(a, 1), needInt(b, 1), rd == null ? null : needInt(rd, 0))),
    'ΣInt(': (a, b, rd, cx) => R(S().sumInt(cx.st.tvm, needInt(a, 1), needInt(b, 1), rd == null ? null : needInt(rd, 0))),
    '▶Nom(': (e, c) => R(S().toNom(real(e), real(c))),
    '▶Eff(': (n, c) => R(S().toEff(real(n), real(c))),
    'dbd(': (a, b) => S().dbd(real(a), real(b)),
    'sub(': (s, a, b) => {
      if (isStr(s)) {
        const i = needInt(a, 1), n = needInt(b, 0);
        if (i + n - 1 > s.v.length) fail('INVALID DIM');
        return str(s.v.substr(i - 1, n));
      }
      fail('DATA TYPE');
      return 0;
    },
    'inString(': (s, t, start) => {
      if (!isStr(s) || !isStr(t)) fail('DATA TYPE');
      return s.v.indexOf(t.v, (start == null ? 1 : needInt(start, 1)) - 1) + 1;
    },
    'length(': (s) => { if (!isStr(s)) fail('DATA TYPE'); return s.v.length; },
  };
  function opt(v) { return v == null ? null : real(v); }
  function distList(x, one, all) {
    if (x == null) return list(all().map(R));
    return map1(x, (k) => R(one(real(k))));
  }
  function sliceList(l, s, e) {
    if (s == null) return l;
    const a = needInt(s, 1), b = e == null ? l.length : needInt(e, 1);
    if (a > l.length || b > l.length || a > b) fail('INVALID DIM');
    return l.slice(a - 1, b);
  }
  function rowCheck(M, i) { if (!isNum(i) || i !== Math.floor(i) || i < 1 || i > M.length) fail('INVALID DIM'); }
  function gcd(a, b) { a = Math.abs(a); b = Math.abs(b); while (b) { [a, b] = [b, a % b]; } return a; }

  /** TVM functions: tvm_Pmt[(N,I%,PV,FV,P/Y,C/Y)] — arguments, where given, override the stored values. */
  function tvmCall(name, args, cx) {
    const t = Object.assign({}, cx.st.tvm);
    const order = { 'tvm_Pmt(': ['N', 'I', 'PV', 'FV', 'PY', 'CY'], 'tvm_I%(': ['N', 'PV', 'PMT', 'FV', 'PY', 'CY'],
      'tvm_PV(': ['N', 'I', 'PMT', 'FV', 'PY', 'CY'], 'tvm_N(': ['I', 'PV', 'PMT', 'FV', 'PY', 'CY'], 'tvm_FV(': ['N', 'I', 'PV', 'PMT', 'PY', 'CY'] };
    const key = name.replace(/\($/, '') + '(';
    (order[key] || []).forEach((k, i) => { if (args[i] != null) t[k] = real(args[i]); });
    const solveFor = { 'tvm_Pmt(': 'PMT', 'tvm_I%(': 'I', 'tvm_PV(': 'PV', 'tvm_N(': 'N', 'tvm_FV(': 'FV' }[key];
    return R(S().tvmSolve(t, solveFor));
  }

  function call(n, cx) {
    const name = n.name;
    if (name === 'rand') return rand(cx);
    if (name === 'getKey') return cx.hooks.getKey ? cx.hooks.getKey() : 0;
    if (name === 'Pmt_End') { cx.st.tvm.begin = false; return 0; }
    if (name === 'Pmt_Bgn') { cx.st.tvm.begin = true; return 0; }
    // invNorm('s tail: LEFT, CENTER, RIGHT.
    if (name === 'LEFT' || name === 'CENTER' || name === 'RIGHT') return ['LEFT', 'CENTER', 'RIGHT'].indexOf(name);
    if (/^tvm_/.test(name)) return tvmCall(name, n.args.map((a) => ev(a, cx)), cx);
    if (RAW.has(name)) return rawCall(name, n.args, cx);
    if (name === 'Matr▶list(') return matrToList(n.args.map((a) => (a.k === 'lname' ? null : ev(a, cx))), n.args, cx);
    const args = n.args.map((a) => ev(a, cx));
    switch (name) {
      case 'expr(': {
        if (!isStr(args[0])) fail('DATA TYPE');
        return ev(parseExpr(args[0].v), cx);
      }
      case 'eval(': return args[0];
      case 'toString(': return str(textOf(args[0], cx.st.mode));
      default:
    }
    const f = FN[name];
    if (!f) fail('SYNTAX');
    const ar = FN_ARITY[name];
    const padded = args.slice();
    while (padded.length < ar[1]) padded.push(undefined);
    padded.push(cx);
    return f.apply(null, padded);
  }
  /** Matr▶list([A], L₁, L₂…): each column into a list; Matr▶list([A], k, L₁): column k. */
  function matrToList(vals, nodes, cx) {
    const M = needMat(vals[0]);
    if (nodes.length === 3 && isNum(vals[1])) {
      const k = needInt(vals[1], 1);
      if (k > M[0].length) fail('INVALID DIM');
      const col = M.map((r) => r[k - 1]);
      store(targetOf(nodes[2]), list(col), cx);
      return list(col);
    }
    nodes.slice(1).forEach((nd, j) => {
      if (j < M[0].length) store(targetOf(nd), list(M.map((r) => r[j])), cx);
    });
    return list(M.map((r) => r[0]));
  }
  function targetOf(node) {
    if (node.k === 'lname') return { k: 'lname', v: node.v };
    fail('SYNTAX');
    return null;
  }

  function rawCall(name, a, cx) {
    switch (name) {
      case 'seq(': {
        const v = varName(a[1]);
        const s = real(ev(a[2], cx)), e = real(ev(a[3], cx)), step = a[4] ? real(ev(a[4], cx)) : 1;
        if (step === 0) fail('INCREMENT');
        const n = Math.floor((e - s) / step + 1e-10) + 1;
        if (n < 0 || n > 999) fail('INVALID DIM');
        const out = [];
        for (let k = 0; k < n; k++) out.push(scalarOf(withVar(cx, v, R(s + k * step), a[0])));
        return list(out);
      }
      case 'Σ(': {
        const v = varName(a[1]);
        const s = needInt(real(ev(a[2], cx))), e = needInt(real(ev(a[3], cx)));
        let total = 0;
        if (e - s > 1e6) fail('INVALID DIM');
        for (let k = s; k <= e; k++) total = add(total, withVar(cx, v, k, a[0]));
        return total;
      }
      case 'nDeriv(': {
        const v = varName(a[1]);
        const x = real(ev(a[2], cx)), h = a[3] ? real(ev(a[3], cx)) : 0.001;
        if (h === 0) fail('DOMAIN');
        const f = numFn(cx, a[0], v);
        return R((f(x + h) - f(x - h)) / (2 * h));
      }
      case 'fnInt(': {
        const v = varName(a[1]);
        const lo = real(ev(a[2], cx)), hi = real(ev(a[3], cx));
        return R(integrate(numFn(cx, a[0], v), lo, hi));
      }
      case 'fMin(': case 'fMax(': {
        const v = varName(a[1]);
        const lo = real(ev(a[2], cx)), hi = real(ev(a[3], cx));
        if (!(lo < hi)) fail('DOMAIN');
        const f = numFn(cx, a[0], v);
        const g = name === 'fMin(' ? f : (x) => -f(x);
        return R(goldenMin(g, lo, hi));
      }
      case 'solve(': {
        const v = varName(a[1]);
        const g = ev(a[2], cx);
        let guess = 0, lo = -1e99, hi = 1e99;
        if (isList(g)) { guess = real(g.v[0]); if (g.v.length > 2) { lo = real(g.v[1]); hi = real(g.v[2]); } } else guess = real(g);
        if (a[3]) { const b = ev(a[3], cx); if (isList(b) && b.v.length === 2) { lo = real(b.v[0]); hi = real(b.v[1]); } }
        return R(solveRoot(numFn(cx, a[0], v), guess, lo, hi));
      }
      default: fail('SYNTAX');
    }
    return 0;
  }

  /* ── Commands ────────────────────────────────────────────────────────── */

  function listArg(node, cx, fallback) {
    if (!node) {
      if (fallback == null) return null;
      const l = cx.st.lists[fallback];
      if (!l) fail('UNDEFINED');
      return l;
    }
    return realList(ev(node, cx));
  }
  /** Stat results go where VARS ▸ Statistics reads them. */
  function setStats(cx, o) { Object.keys(o).forEach((k) => { if (o[k] === undefined) delete cx.st.sys[k]; else cx.st.sys[k] = o[k]; }); }

  function runStatCmd(name, args, cx) {
    const st = cx.st, St = S();
    const rows = [];
    const put = (label, v) => rows.push([label, v]);
    if (name === '1-Var Stats') {
      const xs = listArg(args[0], cx, 'L₁'), fs = args[1] ? listArg(args[1], cx) : null;
      const o = St.oneVar(xs, fs);
      setStats(cx, { 'x̄': R(o.mean), 'Σx': R(o.sum), 'Σx²': R(o.sum2), Sx: finiteOr(o.Sx), 'σx': R(o.sigma), n: R(o.n),
        minX: R(o.min), Q1: finiteOr(o.q1), Med: finiteOr(o.med), Q3: finiteOr(o.q3), maxX: R(o.max) });
      put('x̄', o.mean); put('Σx', o.sum); put('Σx²', o.sum2); put('Sx', o.Sx); put('σx', o.sigma); put('n', o.n);
      put('minX', o.min); put('Q₁', o.q1); put('Med', o.med); put('Q₃', o.q3); put('maxX', o.max);
      return { report: { title: '1-Var Stats', rows: rows } };
    }
    if (name === '2-Var Stats') {
      const xs = listArg(args[0], cx, 'L₁'), ys = listArg(args[1], cx, 'L₂'), fs = args[2] ? listArg(args[2], cx) : null;
      const o = St.twoVar(xs, ys, fs);
      setStats(cx, { 'x̄': R(o.mean), 'Σx': R(o.sum), 'Σx²': R(o.sum2), Sx: finiteOr(o.Sx), 'σx': R(o.sigma),
        'ȳ': R(o.ymean), 'Σy': R(o.ysum), 'Σy²': R(o.ysum2), Sy: finiteOr(o.Sy), 'σy': R(o.sigmay), 'Σxy': R(o.sxy), n: R(o.n),
        minX: R(o.minX), maxX: R(o.maxX), minY: R(o.minY), maxY: R(o.maxY) });
      put('x̄', o.mean); put('Σx', o.sum); put('Σx²', o.sum2); put('Sx', o.Sx); put('σx', o.sigma);
      put('ȳ', o.ymean); put('Σy', o.ysum); put('Σy²', o.ysum2); put('Sy', o.Sy); put('σy', o.sigmay); put('Σxy', o.sxy);
      put('n', o.n); put('minX', o.minX); put('maxX', o.maxX); put('minY', o.minY); put('maxY', o.maxY);
      return { report: { title: '2-Var Stats', rows: rows } };
    }
    // Regressions: [Xlist, Ylist[, freq]][, Y-var]; SinReg: [iterations,] Xlist, Ylist[, period][, Y-var].
    let a = args.slice();
    let yTarget = null;
    if (a.length && a[a.length - 1].k === 'yref') yTarget = a.pop().v;
    let period = null;
    if (name === 'SinReg') {
      if (a.length && a[0].k === 'num') a.shift();          // iterations: accepted, not needed
      if (a.length >= 3) { period = real(ev(a[2], cx)); a = a.slice(0, 2); }
    }
    const xs = listArg(a[0], cx, 'L₁'), ys = listArg(a[1], cx, 'L₂'), fs = a[2] ? listArg(a[2], cx) : null;
    const r = St.regress(name, xs, ys, fs, { period: period });
    ['a', 'b', 'c', 'd', 'e', 'r', 'r²', 'R²'].forEach((k) => { delete st.sys[k]; });
    const set = {};
    Object.keys(r.coef).forEach((k) => { set[k] = R(r.coef[k]); });
    if (r.r != null) { set.r = R(r.r); set['r²'] = R(r.r2); }
    if (r.R2 != null) set['R²'] = R(r.R2);
    setStats(cx, set);
    const eqText = regEqText(r);
    st.sys.RegEQ = eqText;
    if (yTarget) {
      st.y[yTarget] = eqText;
      // The Y= editor keeps its own copy of each line; drop it so the new equation shows.
      if (st.ui && st.ui.ynodes) delete st.ui.ynodes[yTarget];
      if (st.ui && st.ui.yOn) st.ui.yOn[yTarget] = true;
    }
    rows.push(['', r.eq]);
    Object.keys(r.coef).forEach((k) => put(k, r.coef[k]));
    if (r.r != null && st.mode.statDiag) { put('r²', r.r2); put('r', r.r); }
    if (r.R2 != null && st.mode.statDiag) put('R²', r.R2);
    return { report: { title: name, rows: rows } };
  }
  function finiteOr(v) { return Number.isFinite(v) ? R(v) : undefined; }
  /** The fitted equation as the engine's own text, so Y₁ can be graphed from it. */
  function regEqText(r) {
    const n = (v) => numCode(v);
    const c = r.coef;
    const plus = (v) => (R(v) < 0 ? '-' + numCode(-v) : '+' + numCode(v));
    switch (r.kind) {
      case 'LinReg(ax+b)': case 'Med-Med': return n(c.a) + 'X' + plus(c.b);
      case 'LinReg(a+bx)': return n(c.a) + plus(c.b) + 'X';
      case 'QuadReg': return n(c.a) + 'X²' + plus(c.b) + 'X' + plus(c.c);
      case 'CubicReg': return n(c.a) + 'X³' + plus(c.b) + 'X²' + plus(c.c) + 'X' + plus(c.d);
      case 'QuartReg': return n(c.a) + 'X^4' + plus(c.b) + 'X³' + plus(c.c) + 'X²' + plus(c.d) + 'X' + plus(c.e);
      case 'LnReg': return n(c.a) + plus(c.b) + 'ln(X)';
      case 'ExpReg': return n(c.a) + '*' + n(c.b) + '^X';
      case 'PwrReg': return n(c.a) + '*X^' + n(c.b);
      case 'Logistic': return n(c.c) + '/(1+' + n(c.a) + 'e^(⁻' + n(c.b) + 'X))';
      case 'SinReg': return n(c.a) + 'sin(' + n(c.b) + 'X' + plus(c.c) + ')' + plus(c.d);
      default: return '';
    }
  }
  /** A number as engine code: 14 digits, ᴇ exponent, ⁻ for negative. */
  function numCode(v) {
    const x = R(v);
    let s = String(x);
    if (/e/.test(s)) s = s.replace(/e\+?/, 'ᴇ');
    return s.replace(/-/g, '⁻');
  }

  function runCmd(node, cx) {
    const st = cx.st, name = node.name, args = node.args;
    const H = cx.hooks;
    if (STAT_CMDS.indexOf(name) >= 0) return runStatCmd(name, args, cx);
    const modeSet = {
      Degree: ['angle', 'deg'], Radian: ['angle', 'rad'], Normal: ['notation', 'normal'], Sci: ['notation', 'sci'],
      Eng: ['notation', 'eng'], Float: ['digits', 'float'], 'a+bi': ['complex', 'a+bi'], Real: ['complex', 'real'],
      're^θi': ['complex', 're^θi'], Func: ['graph', 'func'], Param: ['graph', 'par'], Polar: ['graph', 'pol'], Seq: ['graph', 'seq'],
      MATHPRINT: ['mathprint', true], CLASSIC: ['mathprint', false],
    };
    if (modeSet[name]) { st.mode[modeSet[name][0]] = modeSet[name][1]; return { done: true }; }
    switch (name) {
      case 'Fix': {
        const n = needInt(real(ev(args[0], cx)), 0);
        if (n > 9) fail('DOMAIN');
        st.mode.digits = n;
        return { done: true };
      }
      case 'SortA(': case 'SortD(': {
        const lists = args.map((a) => { if (a.k !== 'lname') fail('DATA TYPE'); return a.v; });
        const key = st.lists[lists[0]];
        if (!key) fail('UNDEFINED');
        lists.forEach((l) => { if (!st.lists[l] || st.lists[l].length !== key.length) fail('DIM MISMATCH'); });
        const order = key.map((v, i) => i).sort((i, j) => (name === 'SortA(' ? key[i] - key[j] : key[j] - key[i]));
        lists.forEach((l) => { const src = st.lists[l].slice(); st.lists[l] = order.map((i) => src[i]); });
        return { done: true };
      }
      case 'ClrList': args.forEach((a) => { if (a.k !== 'lname') fail('DATA TYPE'); st.lists[a.v] = []; }); return { done: true };
      case 'ClrAllLists': Object.keys(st.lists).forEach((k) => { st.lists[k] = []; }); return { done: true };
      case 'SetUpEditor': {
        for (let k = 1; k <= 6; k++) if (!st.lists['L' + SUB[k]]) st.lists['L' + SUB[k]] = [];
        return { done: true };
      }
      case 'Fill(': {
        const v = ev(args[0], cx);
        const t = args[1];
        if (t.k === 'lname') { if (!st.lists[t.v]) fail('UNDEFINED'); st.lists[t.v] = st.lists[t.v].map(() => scalarOf(v)); }
        else if (t.k === 'mname') { if (!st.mats[t.v]) fail('UNDEFINED'); st.mats[t.v] = st.mats[t.v].map((r) => r.map(() => real(v))); }
        else fail('DATA TYPE');
        return { done: true };
      }
      case 'ClrHome': if (H.clrHome) H.clrHome(); return { clear: true };
      case 'DelVar': {
        args.forEach((a) => {
          if (a.k === 'var') delete st.vars[a.v];
          else if (a.k === 'lname') delete st.lists[a.v];
          else if (a.k === 'mname') delete st.mats[a.v];
          else if (a.k === 'sys' && /^Str/.test(a.v)) delete st.strs[a.v];
          else if (a.k === 'yval') st.y[a.v] = '';
        });
        return { done: true };
      }
      case 'Disp': {
        const vals = args.map((a) => ev(a, cx));
        if (H.disp) vals.forEach((v) => H.disp(v));
        return { disp: vals };
      }
      default:
        if (H.command) return H.command(name, args, cx) || { done: true };
        return { done: true };
    }
  }

  /* ── Running a line ──────────────────────────────────────────────────── */

  /**
   * Evaluate a line of engine code against state.
   * Returns { value, conv, stored } for an expression, { report } for STAT output,
   * { done: true } for a command that shows "Done", or throws a TIError.
   */
  function run(code, state, hooks) {
    const cx = new Ctx(state, hooks);
    const stmts = parseLine(code);
    if (!stmts.length) fail('SYNTAX');
    /* In REAL mode the calculator gives complex answers only when a complex
       number was entered — an i anywhere on the line counts. */
    const typedI = tokenize(code).some((t) => t.k === 'imag');
    let last = null;
    stmts.forEach((s) => {
      cx.sawComplex = typedI;
      if (s.k === 'cmd') { last = runCmd(s, cx); return; }
      const v = ev(s, cx);
      state.ans = cloneValue(v);
      last = { value: v, conv: s.k === 'conv' ? s.to : null, stored: s.k === 'store' };
      // A conversion under a store (1/3▶Frac→A) still shows as a fraction.
      if (s.k === 'store' && s.a && s.a.k === 'conv') last.conv = s.a.to;
    });
    return last;
  }
  function cloneValue(v) {
    if (isList(v)) return list(v.v.slice());
    if (isMat(v)) return mat(v.v.map((r) => r.slice()));
    return v;
  }
  /** Compile an expression to a plain function of its variables — what the graph and the table call. */
  function compileFn(code, state, varNames) {
    const node = parseExpr(code);
    const cx = new Ctx(state);
    const names = varNames || ['X'];
    return function () {
      for (let k = 0; k < names.length; k++) cx.locals[names[k]] = arguments[k];
      cx.sawComplex = false;
      try {
        const v = ev(node, cx);
        return isNum(v) ? v : isList(v) ? v : NaN;
      } catch (e) {
        if (e instanceof TIError) return NaN;
        throw e;
      }
    };
  }

  /* ── Display ─────────────────────────────────────────────────────────── */

  const SUPMINUS = '⁻';
  /** A real as the calculator shows it: 10 significant digits, .5 not 0.5, ⁻ for negative, ᴇ only when ordinary notation gets unwieldy. */
  function fmtReal(x, mode) {
    const m = mode || {};
    if (x === 0) return '0';
    if (!Number.isFinite(x)) return 'undef';
    const neg = x < 0, a = Math.abs(x);
    const digits = m.digits == null ? 'float' : m.digits;
    const notation = m.notation || 'normal';
    let s;
    const sci = (engineering) => {
      let e = Math.floor(Math.log10(a));
      let mant = a / Math.pow(10, e);
      // Correct the exponent at the edges where log10 misjudges by one.
      if (mant >= 10) { mant /= 10; e += 1; } else if (mant < 1) { mant *= 10; e -= 1; }
      if (engineering) { const k = ((e % 3) + 3) % 3; mant *= Math.pow(10, k); e -= k; }
      const fmtM = (v) => (digits === 'float' ? trimZeros(v.toPrecision(10)) : v.toFixed(digits));
      let ms = fmtM(mant);
      // Rounding can carry the mantissa to 10 (or 1000).
      const lim = engineering ? 1000 : 10;
      if (parseFloat(ms) >= lim) { e += engineering ? 3 : 1; ms = fmtM(parseFloat(ms) / lim); }
      return dropLead(ms) + 'ᴇ' + (e < 0 ? SUPMINUS + (-e) : e);
    };
    const expandExponent = (text) => {
      const m = /^(\d+)(?:\.(\d*))?[eE]([+-]?\d+)$/.exec(text);
      if (!m) return text;
      const all = m[1] + (m[2] || '');
      const point = m[1].length + Number(m[3]);
      if (point <= 0) return '0.' + '0'.repeat(-point) + all;
      if (point >= all.length) return all + '0'.repeat(point - all.length);
      return all.slice(0, point) + '.' + all.slice(point);
    };
    const rounded = digits === 'float'
      ? expandExponent(a.toPrecision(10))
      : a < 1e21 ? a.toFixed(digits) : null;
    const ordinary = rounded == null ? null : dropLead(digits === 'float' ? trimZeros(rounded) : rounded);
    // The minus sign is a separate glyph on the handheld display. Count the
    // numeric body when deciding whether ordinary notation is too wide; this
    // keeps a value such as −.9880316241 out of scientific notation.
    const ordinaryWidth = ordinary == null ? Infinity : ordinary.length;

    /* Sci and Eng used to turn every answer into exponent form, so 32 became
       3.2ᴇ1. Keep decimal notation whenever the displayed answer fits in a
       short line; use Sci/Eng only for results that would otherwise be long.
       The setting still selects which exponent style to use for those values. */
    if (ordinaryWidth > 11) s = sci(notation === 'eng');
    else s = ordinary;
    return (neg ? SUPMINUS : '') + s;
  }
  function trimZeros(s) { return s.indexOf('.') >= 0 && s.indexOf('e') < 0 ? s.replace(/0+$/, '').replace(/\.$/, '') : s; }
  function dropLead(s) { return s.replace(/^0\./, '.'); }

  /** The nearest fraction p/q with q ≤ maxDen, or null (continued fractions, as ▶Frac). */
  function toFraction(x, maxDen) {
    if (!Number.isFinite(x)) return null;
    const md = maxDen || 9999;
    if (x === Math.floor(x)) return { p: x, q: 1 };
    let h0 = 0, h1 = 1, k0 = 1, k1 = 0, v = x;
    for (let it = 0; it < 64; it++) {
      const a = Math.floor(v);
      const h2 = a * h1 + h0, k2 = a * k1 + k0;
      if (k2 > md) break;
      h0 = h1; h1 = h2; k0 = k1; k1 = k2;
      if (Math.abs(x - h1 / k1) <= 1e-12 * Math.max(1, Math.abs(x))) return { p: h1, q: k1 };
      const f = v - a;
      if (f === 0) break;
      v = 1 / f;
    }
    return null;
  }

  /**
   * What to draw for a value, as plain data the UI renders:
   *   { k: 'num', text } | { k: 'frac', neg, whole, p, q } | { k: 'list', items } | { k: 'mat', rows } | { k: 'str', text }
   * opts.frac: try fractions (▶Frac, or AUTO answers with a fraction in the entry).
   */
  function display(v, mode, opts) {
    const o = opts || {};
    const m = mode || {};
    const wantFrac = o.conv === '▶Frac' || o.conv === '▶n/d◀▶Un/d' || o.conv === '▶F◀▶D' || (m.answers === 'frac' && o.conv !== '▶Dec')
      || (m.answers === 'auto' && o.fracInput && o.conv !== '▶Dec');
    const mixed = o.conv === '▶n/d◀▶Un/d' ? m.fracType !== 'Un/d' : m.fracType === 'Un/d';
    const one = (x) => {
      if (isNum(x)) {
        if (o.conv === '▶DMS') return { k: 'num', text: dmsText(x, m) };
        if (wantFrac && x !== Math.floor(x)) {
          const f = toFraction(x);
          if (f) {
            const neg = f.p < 0, p = Math.abs(f.p);
            if (mixed && p > f.q) return { k: 'frac', neg: neg, whole: Math.floor(p / f.q), p: p % f.q, q: f.q };
            return { k: 'frac', neg: neg, whole: 0, p: p, q: f.q };
          }
        }
        return { k: 'num', text: fmtReal(x, m) };
      }
      if (isCx(x)) return { k: 'num', text: cxText(x, m, o.conv) };
      return { k: 'num', text: '?' };
    };
    if (isList(v)) return { k: 'list', items: v.v.map(one) };
    if (isMat(v)) return { k: 'mat', rows: v.v.map((r) => r.map(one)) };
    if (isStr(v)) return { k: 'str', text: v.v };
    return one(v);
  }
  function dmsText(x, m) {
    const deg = m.angle === 'deg' ? x : x * 180 / Math.PI;
    const neg = deg < 0;
    const a = Math.abs(deg);
    let d = Math.floor(a), mi = Math.floor((a - d) * 60), s = (a - d - mi / 60) * 3600;
    s = Math.round(s * 1e6) / 1e6;
    if (s >= 60) { s -= 60; mi += 1; }
    if (mi >= 60) { mi -= 60; d += 1; }
    return (neg ? SUPMINUS : '') + d + '°' + mi + '′' + fmtReal(s, { digits: 'float' }).replace(/^\./, '0.') + '″';
  }
  function cxText(z, m, conv) {
    const polar = conv === '▶Polar' || (m.complex === 're^θi' && conv !== '▶Rect');
    if (polar) {
      const r = cAbs(z), t = cArg(z);
      return fmtReal(r, m) + 'e^(' + fmtReal(t, m) + 'i)';
    }
    const re = z.re, im = z.im;
    const imAbs = Math.abs(im);
    const imText = (imAbs === 1 ? '' : fmtReal(imAbs, m)) + 'i';
    if (re === 0) return (im < 0 ? SUPMINUS : '') + imText;
    return fmtReal(re, m) + (im < 0 ? '-' : '+') + imText;
  }
  /** Plain text for a value (strings, toString(, classic mode, tests). */
  function textOf(v, mode, opts) {
    return displayText(display(v, mode, opts));
  }
  function displayText(d) {
    switch (d.k) {
      case 'num': return d.text;
      case 'str': return d.text;
      case 'frac': return (d.neg ? SUPMINUS : '') + (d.whole ? d.whole + ' ' : '') + d.p + '/' + d.q;
      case 'list': return '{' + d.items.map(displayText).join(' ') + '}';
      case 'mat': return '[' + d.rows.map((r) => '[' + r.map(displayText).join(' ') + ']').join('') + ']';
      default: return '';
    }
  }

  root.FluxTI = {
    TIError: TIError, fail: fail,
    freshState: freshState, run: run, parseLine: parseLine, parseExpr: parseExpr, tokenize: tokenize,
    evaluate: function (code, state, hooks) { const cx = new Ctx(state, hooks); return ev(parseExpr(code), cx); },
    evalNode: function (node, state, hooks, locals) { const cx = new Ctx(state, hooks); if (locals) cx.locals = locals; return ev(node, cx); },
    store: function (targetCode, value, state) {
      const p = new Parser(tokenize(targetCode));
      store(p.target(), value, new Ctx(state));
    },
    compileFn: compileFn, display: display, displayText: displayText, fmtReal: fmtReal, textOf: textOf,
    toFraction: toFraction, numCode: numCode, regEqText: regEqText,
    FN_ARITY: FN_ARITY, CMDS: CMDS, STAT_CMDS: STAT_CMDS, CONV: CONV, YNAMES: YNAMES, SUB: SUB,
    isList: isList, isMat: isMat, isStr: isStr, isCx: isCx, isNum: isNum, list: list, mat: mat, str: str,
    rand: function (state) { return rand(new Ctx(state)); }, integrate: integrate, goldenMin: goldenMin, solveRoot: solveRoot,
  };
})(typeof window !== 'undefined' ? window : globalThis);
